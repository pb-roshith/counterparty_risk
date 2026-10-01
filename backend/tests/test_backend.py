import json
import os
import tempfile
import unittest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.configuration.registry import methodology, taxonomy
from app.entity_resolution.providers import MockEntityResolutionProvider, SenzingEntityResolutionProvider
from app.exposure.service import aggregate, expected_loss
from app.exposure.service import facility_ead
from app.early_warning.service import sector_stress, turnover_drop
from app.graph.repository import MemoryGraphRepository
from app.manufacture_data.manufacturing import generate_counterparties
from app.metadata.store import MetadataStore
from sqlalchemy import create_engine
from app.models import CanonicalEntity, Exposure, Facility, Relationship, SourceRecord
from app.relationship_discovery.detectors import DetectionContext, detector_registry
from app.scoring.engine import (calculate_counterparty, confidence_score, final_risk,
                                network_risk, normalize_rating, parent_subsidiary_measures,
                                relationship_score, suggest_parameter_rating)
from app.manufacture_data.synthetic_model import CATEGORIES, estimate_recovery, score_categories


class MethodologyTests(unittest.TestCase):
    def test_complete_reference_and_weights(self):
        self.assertEqual(len(methodology()["relationships"]), 25)
        self.assertEqual(len(taxonomy()["relationships"]), 45)
        for item in methodology()["relationships"]:
            self.assertAlmostEqual(sum(p["weight"] for p in item["parameters"]), 1)
            self.assertTrue(all(p["formula_text"] and p["rating_thresholds_text"] for p in item["parameters"]))

    def test_normalization_and_final_score(self):
        self.assertEqual([normalize_rating(i) for i in range(1, 6)], [0, 25, 50, 75, 100])
        self.assertAlmostEqual(network_risk([20, 30]), 44)
        self.assertAlmostEqual(final_risk(60, 50, 40, 30)["score"], 51.5)
        self.assertEqual(confidence_score(80, 70, 90), 79)

    def test_parent_subsidiary_exact_measures_and_guard(self):
        values = {"parent_shares": 80, "subsidiary_shares": 100, "parent_votes": 60,
                  "total_votes": 100, "subsidiary_revenue": 40, "group_revenue": 100,
                  "subsidiary_assets": 30, "group_assets": 100, "subsidiary_ebitda": 9,
                  "group_ebitda": 20, "equity_investment": 300, "intercompany_loans": 100,
                  "intercompany_receivables": 50, "guarantees": 150, "undrawn_support": 0,
                  "expected_recapitalization": 50, "parent_adjusted_capital": 10000}
        result = parent_subsidiary_measures(values)
        self.assertEqual(result["Ownership and control"], 80)
        self.assertEqual(result["Subsidiary financial materiality"], 38.5)
        self.assertEqual(result["Parent exposure and support"], 6.5)
        values["subsidiary_ebitda"] = -1
        with self.assertRaises(ValueError):
            parent_subsidiary_measures(values)

    def test_relationship_score_and_dedup(self):
        edge = Relationship(relationship_id="r1", relationship_code="L1-01", source_entity_id="a", target_entity_id="b",
                            level_type="LEVEL_1", parameter_ratings={"Ownership and control": 5,
                            "Subsidiary financial materiality": 4, "Parent exposure and support": 3},
                            dependency_key="same-support", review_status="DEMO")
        self.assertEqual(relationship_score(edge)["score"], 76.25)
        from app.models import ScoreInputs
        inputs = ScoreInputs(provenance="DEMO", standalone=50, concentration=50, event=50, connected_stress={"b": (50, 50, 50)})
        result = calculate_counterparty(inputs, [edge, edge.model_copy(update={"relationship_id": "r2"})])
        self.assertEqual(len(result["contributions"]), 1)

    def test_methodology_specific_thresholds(self):
        self.assertEqual(suggest_parameter_rating("L1-01", "Ownership and control", 75)["rating"], 5)
        self.assertEqual(suggest_parameter_rating("L1-08", "Collateral utilisation", 110)["rating"], 4)
        self.assertEqual(suggest_parameter_rating("L1-08", "Collateral utilisation", 110.1)["rating"], 5)
        self.assertEqual(suggest_parameter_rating("L2-04", "Alternative funding coverage", 150)["rating"], 1)
        self.assertEqual(suggest_parameter_rating("L2-04", "Alternative funding coverage", 74)["rating"], 5)
        self.assertEqual(suggest_parameter_rating("L2-01", "Supplier replacement time", 6)["rating"], 4)
        with self.assertRaisesRegex(ValueError, "Qualitative"):
            suggest_parameter_rating("L1-02", "Voting and control rights", 50)

    def test_every_parameter_is_ratable_or_explicitly_manual(self):
        manual = []
        for relationship in methodology()["relationships"]:
            for parameter in relationship["parameters"]:
                try:
                    for value in (0, 0.5, 2, 5, 10, 20, 25, 35, 50, 75, 100, 150, 200):
                        result = suggest_parameter_rating(relationship["code"], parameter["name"], value)
                        self.assertIn(result["rating"], range(1, 6))
                except ValueError:
                    manual.append((relationship["code"], parameter["name"]))
        self.assertEqual(set(manual), {
            ("L1-02", "Voting and control rights"),
            ("L1-05", "Formal group classification"),
            ("L1-07", "Guarantee-chain complexity"),
            ("L1-09", "Ownership and control"),
            ("L2-05", "Sponsor ownership and control"),
        })


class GraphAndExposureTests(unittest.TestCase):
    def test_shortest_path_and_cycle(self):
        graph = MemoryGraphRepository()
        for name in "ABC":
            graph.upsert_entity(CanonicalEntity(canonical_entity_id=name, legal_name=name))
        ratings = {"Ownership and control": 3, "Subsidiary financial materiality": 3, "Parent exposure and support": 3}
        for source, target, key in (("A", "B", "ab"), ("B", "C", "bc"), ("C", "A", "ca")):
            graph.upsert_relationship(Relationship(relationship_id=key, relationship_code="L1-01",
                source_entity_id=source, target_entity_id=target, level_type="LEVEL_1", parameter_ratings=ratings))
        self.assertEqual(graph.connections("A", 2)[0]["level"], 1)
        self.assertEqual(graph.paths("A", "C", 2)[0]["relationship_ids"], ["ca"])
        self.assertIn(["A", "B", "C"], graph.cycles({"L1-01"}))

    def test_missing_loss_inputs_are_not_fabricated(self):
        exposures = [Exposure(exposure_id="e", entity_id="a", ead=100, synthetic=True)]
        self.assertIsNone(expected_loss(exposures[0]))
        self.assertIsNone(aggregate(exposures)["ecl"])
        self.assertEqual(expected_loss(exposures[0], 0.1, 0.4), 4)

    def test_facility_and_early_warning_formulas(self):
        facility = Facility(facility_id="f", entity_id="a", product="Guarantee", outstanding=100,
                            undrawn=200, ccf=0.5, funded=False)
        self.assertEqual(facility_ead(facility), 200)
        self.assertEqual(turnover_drop(100, 70)["severity"], "HIGH")
        self.assertEqual(sector_stress(80, 60, 50)["score"], 68)


class ResolutionTests(unittest.TestCase):
    def test_mock_identifier_matching(self):
        provider = MockEntityResolutionProvider()
        first = provider.add_or_update_record(SourceRecord(source_system="CRM", source_record_id="1", legal_name="Example", lei="LEI-1"))
        second = provider.add_or_update_record(SourceRecord(source_system="KYC", source_record_id="2", legal_name="Example Ltd", lei="LEI-1"))
        self.assertEqual(first["canonical_entity_id"], second["canonical_entity_id"])
        self.assertIsNone(first["provider_confidence"])

    def test_senzing_contract_fixture(self):
        class FixtureEngine:
            def add_record(self, source, record_id, payload):
                self.last_payload = json.loads(payload)
            def get_entity_by_record_id(self, source, record_id):
                return json.dumps({"RESOLVED_ENTITY": {"ENTITY_ID": 400011, "RECORDS": [
                    {"DATA_SOURCE": source, "RECORD_ID": record_id, "MATCH_KEY": "+NAME+LEI",
                     "MATCH_LEVEL_CODE": "RESOLVED", "ERRULE_CODE": "FIXTURE"}]}, "RELATED_ENTITIES": []})
            def get_entity_by_entity_id(self, entity_id):
                return json.dumps({"RESOLVED_ENTITY": {"ENTITY_ID": entity_id, "RECORDS": []}, "RELATED_ENTITIES": []})
        engine = FixtureEngine()
        provider = SenzingEntityResolutionProvider(engine)
        result = provider.add_or_update_record(SourceRecord(source_system="CRM", source_record_id="1", legal_name="Example", lei="LEI-1"))
        self.assertEqual(result["canonical_entity_id"], "SZ-400011")
        self.assertEqual(result["provider_evidence"]["match_key"], "+NAME+LEI")
        self.assertIsNone(result["provider_confidence"])
        self.assertEqual(engine.last_payload["DATA_SOURCE"], "CRM")

    def test_all_detectors_and_ancillary_evidence(self):
        registry = detector_registry({"L1-01": False})
        self.assertEqual(len(registry), 45)
        context = DetectionContext([{"relationship_code": "A-01", "source_entity_id": "a", "target_entity_id": "b", "evidence_ids": ["ev-1"]},
                                    {"relationship_code": "L1-01", "source_entity_id": "a", "target_entity_id": "b", "evidence_ids": ["ev-2"]}])
        self.assertTrue(registry["A-01"].detect(context)[0].evidence_only)
        self.assertEqual(registry["L1-01"].detect(context), [])


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.neo4j_uri = os.environ.get("NEO4J_URI")
        cls.mistral_api_key = os.environ.get("MISTRAL_API_KEY")
        os.environ["NEO4J_URI"] = ""
        os.environ["MISTRAL_API_KEY"] = ""
        os.environ["DATABASE_URL"] = "sqlite:///" + cls.temp.name.replace("\\", "/") + "/test.db"
        os.environ["API_WRITE_KEY"] = "test-key"
        from app.main import app
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        cls.client.app.state.services.metadata.engine.dispose()
        cls.temp.cleanup()
        os.environ.pop("DATABASE_URL", None)
        os.environ.pop("API_WRITE_KEY", None)
        if cls.neo4j_uri is None:
            os.environ.pop("NEO4J_URI", None)
        else:
            os.environ["NEO4J_URI"] = cls.neo4j_uri
        if cls.mistral_api_key is None:
            os.environ.pop("MISTRAL_API_KEY", None)
        else:
            os.environ["MISTRAL_API_KEY"] = cls.mistral_api_key

    def test_read_endpoints_and_authorization(self):
        self.assertEqual(self.client.get("/api/health").json()["mode"], "empty")
        self.assertEqual(self.client.get("/api/manufactured-counterparties").json(), [])
        self.assertNotEqual(self.client.get("/api/counterparties/E-ABC/risk").status_code, 200)
        self.assertEqual(self.client.post("/api/graph/entities", json={}).status_code, 403)

    def test_risk_copilot_retrieves_record_and_graph(self):
        from app.main import load_manufactured_record
        batch_id, records = generate_counterparties(1)
        services = self.client.app.state.services
        services.metadata.save_manufactured_batch(batch_id, records)
        load_manufactured_record(services.graph, services.exposures, services.risk_inputs, records[0])
        entity_id = records[0]["entity"]["canonical_entity_id"]
        response = self.client.post("/api/risk-copilot/ask", json={
            "question": "Which entities are connected?", "entity_id": entity_id})
        self.assertEqual(response.status_code, 200, response.text)
        answer = response.json()
        self.assertIn(records[0]["company"]["name"], answer["answer"])
        self.assertEqual(answer["sources"][0]["store"], "PostgreSQL")
        self.assertNotIn("Neo4j", [source["store"] for source in answer["sources"]])

    def test_generate_with_neo4j_audits_request_count(self):
        from fastapi import Request
        from app.main import ManufactureRequest, Services, manufacture_counterparties
        metadata = MagicMock()
        metadata.engine.dialect.name = "postgresql"
        neo4j = MagicMock()
        services = Services(MemoryGraphRepository(), neo4j, MagicMock(), metadata, [], {})
        request = Request({"type": "http", "client": ("testclient", 1234)})
        result = manufacture_counterparties(ManufactureRequest(count=1), request, services)
        self.assertEqual(result["created_count"], 1)
        metadata.audit.assert_called_once_with("local-user", "manufacture_counterparties",
                                               result["batch_id"], {"count": 1})
        self.assertGreater(neo4j.upsert_relationship.call_count, 15)

    def test_manufactured_records_are_complete_and_persisted(self):
        batch_id, records = generate_counterparties(3)
        self.assertEqual(len({record["entity"]["canonical_entity_id"] for record in records}), 3)
        self.assertEqual({record["company"]["riskLevel"] for record in records},
                         {"LOW", "MODERATE", "CRITICAL"})
        for record in records:
            self.assertTrue(record["synthetic_data"])
            self.assertEqual(record["provenance"], "DEMO")
            self.assertEqual(record["expected_credit_loss"], round(record["exposure"]["ead"] * record["exposure"]["pd"] * record["exposure"]["lgd"], 4))
            from app.models import ScoreInputs
            scored = [Relationship.model_validate(record["relationship"])]
            for payload in record["graph_relationships"]:
                edge = Relationship.model_validate(payload)
                if edge.parameter_ratings:
                    other = edge.target_entity_id if edge.source_entity_id == record["company"]["id"] else edge.source_entity_id
                    scored.append(edge.model_copy(update={"source_entity_id": record["company"]["id"], "target_entity_id": other}))
            eads = {record["related_entity"]["canonical_entity_id"]: record["related_exposure"]["ead"]}
            eads.update({row["entity_id"]: row["ead"] for row in record.get("related_exposures", [])})
            self.assertEqual(record["risk"]["score"], calculate_counterparty(
                ScoreInputs.model_validate(record["risk_inputs"]), scored, eads)["final_risk"]["score"])
            self.assertEqual(set(record["category_scores"]), set(CATEGORIES))
            self.assertEqual(len(record["risks"]), 15)
            direct = [row for row in record["relationships"] if row["level"] == "LEVEL_1"]
            self.assertGreaterEqual(len(direct), 15)
            self.assertLessEqual(len(direct), 20)
            self.assertTrue({"OWNS", "FUNDS", "SUPPLIES", "CUSTOMER_OF", "SECURED_BY"}.issubset(
                {row["type"] for row in direct}))
            self.assertNotIn("AFFILIATED_WITH", {row["type"] for row in record["relationships"]})
            self.assertEqual(len(record["graph_data"]["edges"]), len(record["relationships"]))
            for row in direct:
                direct_node = row["entityB"] if row["entityA"] == record["company"]["id"] else row["entityA"]
                second = [child for child in record["relationships"]
                          if child["level"] == "LEVEL_2" and direct_node in (child["entityA"], child["entityB"])]
                self.assertGreaterEqual(len(second), 5)
                self.assertLessEqual(len(second), 7)
            self.assertGreater(record["network_risk_score"], 0)
            for category in ("Contagion", "Operational", "Ownership", "Legal"):
                self.assertGreaterEqual(record["category_scores"][category]["score"], 0)
            self.assertEqual(record["net_exposure"]["amount"], round(max(0, record["exposure"]["ead"] - record["collateral"]["amount"]), 2))
            self.assertEqual(record["estimated_recovery"]["amount"], record["recovery"]["estimated_recovery"])
            self.assertEqual(score_categories(record["metrics"]), record["category_scores"])
            self.assertTrue(record["company"]["identity"]["legalName"])
            self.assertGreater(record["company"]["businessProfile"]["revenue"]["amount"], 0)
            products = [item for item in record["exposure_breakdown"] if item["dimension"] == "PRODUCT"]
            self.assertEqual([item["label"] for item in products], ["Term Loan", "Working Capital", "Bank Guarantees", "Letters of Credit", "Derivatives (PFE)"])
            self.assertAlmostEqual(sum(item["amount"] for item in products), record["exposure"]["ead"])
            self.assertAlmostEqual(record["funded_exposure"]["amount"] + record["unfunded_exposure"]["amount"], record["exposure"]["ead"])
            self.assertEqual(record["potential_future_exposure"]["amount"], products[-1]["amount"])
            self.assertTrue(5 <= len(record["assets"]) <= 8)
            self.assertTrue(2 <= len(record["guarantees"]) <= 4)
            self.assertEqual(len(record["contagion_paths"]), len([row for row in record["relationships"] if row["level"] == "LEVEL_2"]))
            self.assertTrue(all(len(path["hops"]) == 3 for path in record["contagion_paths"]))
            self.assertEqual(len(record["early_warning_indicators"]), 7)
            prior = record["early_warning_previous_inputs"]
            self.assertLess(prior["as_of"], record["generated_at"][:10])
            by_name = {item["indicator"]: item for item in record["early_warning_indicators"]}
            self.assertEqual(by_name["Bank exposure utilisation"]["previous"],
                             f"{prior['ead'] / prior['limit'] * 100:,.1f}%")
            self.assertEqual(by_name["Top supplier concentration"]["previous"],
                             f"{prior['supplier_share']:,.1f}%")
            self.assertTrue(all(item["status"] in ("Breached", "Watch", "Within Threshold")
                                for item in record["early_warning_indicators"]))
            self.assertTrue(all(item["formula"] and item["provenance"] == "DEMO"
                                for item in record["early_warning_indicators"]))
        with tempfile.TemporaryDirectory() as directory:
            engine = create_engine("sqlite:///" + directory.replace("\\", "/") + "/manufactured.db")
            store = MetadataStore(engine)
            store.save_manufactured_batch(batch_id, records)
            self.assertEqual(len(MetadataStore(engine).manufactured_counterparties()), 3)
            engine.dispose()
        with self.assertRaises(ValueError):
            generate_counterparties(1001)

    def test_recovery_formula_caps_at_ead(self):
        result = estimate_recovery(ead=100, collateral_market_value=200, haircut=.1, lgd=.5)
        self.assertEqual(result["estimated_recovery"], 100)

    def test_demo_profile_assessment_calculates_all_cards(self):
        profile = {"ead": 250, "collateral": 100, "revenue": 1000, "ebitda": 150,
                   "assets": 1400, "liabilities": 700, "debt": 500, "cash": 80,
                   "country": "India", "sector": "Manufacturing", "connected_exposure": 50,
                   "dependency_score": 40, "owner_share": 65, "supplier_share": 30,
                   "customer_share": 20, "relationship_count": 3,
                   "operational_event_count": 1, "legal_event_count": 0, "as_of": "2026-09-28"}
        response = self.client.post("/api/demo/category-assessment", json=profile)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual({row["category"] for row in result["risks"]}, set(CATEGORIES))
        self.assertEqual(result["net_exposure"], 150)
        self.assertGreater(result["estimated_recovery"], 100)
        self.assertEqual(result["provenance"], "DEMO")

    def test_manufactured_sections_are_stored_without_graph_payload(self):
        batch_id, records = generate_counterparties(1)
        original = records[0]
        with tempfile.TemporaryDirectory() as directory:
            engine = create_engine("sqlite:///" + directory.replace("\\", "/") + "/legacy.db")
            store = MetadataStore(engine)
            try:
                store.save_manufactured_batch(batch_id, [original])
                stored = store.manufactured_counterparties()[0]
                self.assertEqual(stored["company"]["id"], original["company"]["id"])
                self.assertEqual(len(stored["assets"]), len(original["assets"]))
                self.assertNotIn("graph_data", stored)
                self.assertNotIn("relationships", stored)
                entity_id = original["entity"]["canonical_entity_id"]
                self.assertEqual(store.manufactured_section(entity_id, "exposure")["exposure"]["ead"], original["exposure"]["ead"])
                self.assertEqual(len(store.manufactured_section(entity_id, "assets_recovery")["assets"]), len(original["assets"]))
                self.assertEqual(len(store.manufactured_section(entity_id, "early_warning")["early_warning_indicators"]), len(original["early_warning_indicators"]))
                self.assertEqual(store.manufactured_section(entity_id, "contagion")["network_risk_score"], original["network_risk_score"])
                from app.copilot.rag import run_tool
                graph = MagicMock()
                graph.manufactured_view.return_value = {"graph_data": original["graph_data"],
                                                        "relationships": original["relationships"]}
                graph.connections.return_value = [{"id": "NODE-1", "level": 1}]
                graph_result = run_tool("get_relationship_graph", entity_id, store, graph)
                self.assertEqual(graph_result["sources"][0]["store"], "Neo4j")
                self.assertEqual(graph_result["data"]["connections"][0]["id"], "NODE-1")
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
