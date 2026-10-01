"""Synthetic counterparty fixtures for local demonstrations only."""
from __future__ import annotations

import random
from datetime import datetime, timezone
from uuid import uuid4

from app.configuration.registry import methodology
from app.models import CanonicalEntity, Evidence, Exposure, Relationship, ScoreInputs
from app.scoring.engine import suggest_parameter_rating
from app.manufacture_data.synthetic_model import MODEL_VERSION, calculate_all_scores, level, make_risk_cards, make_risk_drivers
from app.manufacture_data.relationships import attach_relationship_network
from app.manufacture_data.exposure_assets import enrich_record
from app.manufacture_data.indicators import generate_indicators, generate_previous_inputs

PREFIXES = ("Aster", "Banyan", "Cedar", "Delta", "Evergreen", "Falcon", "Granite", "Harbor", "Indigo", "Juniper")
SECTORS = (("Infrastructure & Construction", "Civil Engineering"), ("Energy & Utilities", "Power Generation"),
           ("Transport & Logistics", "Freight Transport"), ("Healthcare", "Pharmaceuticals"),
           ("Manufacturing", "Industrial Equipment"), ("Consumer Staples", "Food Processing"))
COUNTRIES = ("India", "Singapore", "United Kingdom", "United Arab Emirates")
COUNTRY_RISK = {"India": 38, "Singapore": 18, "United Kingdom": 24, "United Arab Emirates": 33}
SECTOR_STRESS = {"Infrastructure & Construction": 62, "Energy & Utilities": 43,
                 "Transport & Logistics": 52, "Healthcare": 28, "Manufacturing": 47,
                 "Consumer Staples": 31}
SECTOR_SUFFIX = {"Infrastructure & Construction": "Infrastructure", "Energy & Utilities": "Energy",
                 "Transport & Logistics": "Logistics", "Healthcare": "Pharma",
                 "Manufacturing": "Industries", "Consumer Staples": "Foods"}


def generate_counterparties(count: int) -> tuple[str, list[dict]]:
    if not 1 <= count <= 1000:
        raise ValueError("Count must be between 1 and 1000")
    batch_id = uuid4().hex
    rng = random.SystemRandom()
    profile_offset = rng.randrange(3)
    now = datetime.now(timezone.utc)
    records = []
    for index in range(count):
        risk_profile = ("LOW", "MODERATE", "CRITICAL")[(index + profile_offset) % 3]
        entity_id = f"MFG-{uuid4().hex[:16].upper()}"
        sector, industry = rng.choice(SECTORS)
        name = f"{rng.choice(PREFIXES)} {SECTOR_SUFFIX[sector]} {index + 1:04d} Ltd"
        country = rng.choice(COUNTRIES)
        revenue = rng.randint(150, 15000)
        ebitda = round(revenue * rng.uniform(.06, .3), 2)
        assets = round(revenue * rng.uniform(.8, 2.4), 2)
        liabilities = round(assets * rng.uniform(.3, .8), 2)
        debt = round(liabilities * rng.uniform(.35, .8), 2)
        cash = round(assets * rng.uniform(.02, .15), 2)
        ead = round(rng.uniform(10, min(1500, debt)), 2)
        collateral_market_value = round(ead * rng.uniform(.2, 1.1), 2)
        collateral_haircut = round(rng.uniform(.1, .45), 4)
        collateral = round(collateral_market_value * (1 - collateral_haircut), 2)
        pd = round(rng.uniform(.005, .18), 4)
        lgd = round(rng.uniform(.2, .75), 4)
        limit = round(ead * rng.uniform(1.05, 2.5), 2)
        short_term_debt = round(debt * rng.uniform(.15, .7), 2)
        metrics = {
            "ead": ead, "revenue": revenue, "assets": assets, "debt": debt, "cash": cash, "ebitda": ebitda,
            "collateral": collateral, "limit": limit,
            "pd": pd, "lgd": lgd, "interest_cover": round(rng.uniform(.8, 5), 2),
            "covenant_headroom": round(rng.uniform(.02, .4), 4), "connected_exposure": 0,
            "dependency_score": 0, "country_risk_index": COUNTRY_RISK[country],
            "sector_stress_index": SECTOR_STRESS[sector], "incident_rate": round(rng.uniform(0, 75), 2),
            "critical_dependency": round(rng.uniform(0, 90), 2), "short_term_debt": short_term_debt,
            "current_ratio": round(rng.uniform(.6, 2.7), 2), "owner_share": round(rng.uniform(10, 85), 2),
            "ownership_complexity": round(rng.uniform(0, 75), 2),
            "supplier_share": round(rng.uniform(5, 75), 2), "replacement_months": round(rng.uniform(.5, 16), 2),
            "customer_revenue_share": round(rng.uniform(5, 70), 2),
            "overdue_receivables_share": round(rng.uniform(0, 75), 2),
            "legal_claims": round(revenue * rng.uniform(0, .25), 2),
            "open_case_index": round(rng.uniform(0, 75), 2), "collateral_haircut": collateral_haircut,
            "collateral_market_value": collateral_market_value,
        }
        if risk_profile == "LOW":
            metrics.update(debt=round(liabilities * .15, 2), cash=round(assets * .25, 2),
                           ebitda=round(revenue * .35, 2), pd=.005, lgd=.2,
                           short_term_debt=round(liabilities * .015, 2), interest_cover=8,
                           covenant_headroom=.6, current_ratio=3.5, limit=round(ead * 6, 2),
                           incident_rate=3, critical_dependency=5, owner_share=8,
                           ownership_complexity=5, supplier_share=5, replacement_months=.5,
                           customer_revenue_share=5, overdue_receivables_share=2,
                           legal_claims=0, open_case_index=0, country_risk_index=10,
                           sector_stress_index=10, collateral_market_value=round(ead * 1.4, 2),
                           collateral_haircut=.05)
        elif risk_profile == "MODERATE":
            moderate_debt = round(liabilities * .55, 2)
            metrics.update(debt=moderate_debt, cash=round(assets * .08, 2),
                           ebitda=round(max(revenue * .08, moderate_debt / 3.5), 2),
                           pd=.08, lgd=.45, short_term_debt=round(moderate_debt * .4, 2),
                           interest_cover=2.5, covenant_headroom=.15, current_ratio=1.5,
                           limit=round(ead * 1.8, 2), incident_rate=35,
                           critical_dependency=40, owner_share=35,
                           ownership_complexity=35, supplier_share=35,
                           replacement_months=5, customer_revenue_share=35,
                           overdue_receivables_share=30, legal_claims=round(revenue * .08, 2),
                           open_case_index=30, country_risk_index=35,
                           sector_stress_index=40, collateral_market_value=round(ead * .75, 2),
                           collateral_haircut=.2)
        elif risk_profile == "CRITICAL":
            metrics.update(debt=round(liabilities * .9, 2), cash=round(assets * .005, 2),
                           ebitda=round(revenue * .025, 2), pd=.19, lgd=.8,
                           short_term_debt=round(liabilities * .765, 2), interest_cover=.2,
                           covenant_headroom=0, current_ratio=.4, limit=round(ead * 1.02, 2),
                           incident_rate=98, critical_dependency=98, owner_share=90,
                           ownership_complexity=95, supplier_share=95, replacement_months=18,
                           customer_revenue_share=95, overdue_receivables_share=95,
                           legal_claims=round(revenue * .4, 2), open_case_index=95,
                           country_risk_index=85, sector_stress_index=90,
                           collateral_market_value=round(ead * .05, 2), collateral_haircut=.6)
        debt, cash, ebitda = metrics["debt"], metrics["cash"], metrics["ebitda"]
        pd, lgd, limit = metrics["pd"], metrics["lgd"], metrics["limit"]
        collateral_market_value = metrics["collateral_market_value"]
        collateral_haircut = metrics["collateral_haircut"]
        collateral = round(collateral_market_value * (1 - collateral_haircut), 2)
        money = lambda amount: {"amount": round(amount, 2), "currency": "INR", "unit": "Cr"}
        company = {
            "id": entity_id, "entityType": "COMPANY", "name": name, "country": country,
            "riskLevel": "UNKNOWN", "riskScore": 0, "provenance": "DEMO",
            "customerId": f"SYN-{entity_id[-10:]}", "isBankClient": True,
            "bankRelationship": rng.choice(("Borrower", "Depositor", "Trading Counterparty")),
            "lastUpdated": now.date().isoformat(),
            "identity": {"legalName": name, "registrationNumber": f"SYN-{entity_id[-12:]}",
                         "lei": f"SYN{entity_id[-16:]}", "country": country, "industry": industry,
                         "sector": sector, "incorporationDate": f"01 Jan {rng.randint(1995, 2022)}",
                         "uboName": f"Synthetic Owner {index + 1}", "listing": "PRIVATE"},
            "businessProfile": {"revenue": money(revenue), "ebitda": money(ebitda), "totalAssets": money(assets),
                                "totalLiabilities": money(liabilities), "debt": money(debt), "cash": money(cash),
                                "employees": rng.randint(25, 15000), "fiscalYear": str(now.year)},
            "criticality": {"bankRelationshipCriticality": "UNKNOWN", "sectorCriticality": "UNKNOWN",
                            "operationalCriticality": "UNKNOWN", "systemicImportance": "UNKNOWN", "substitutability": "UNKNOWN"},
        }
        entity = CanonicalEntity(canonical_entity_id=entity_id, legal_name=name, country=country,
                                 industry=industry, registration_number=company["identity"]["registrationNumber"],
                                 provenance="DEMO", data_classification="PUBLIC", source_record_ids=[f"SYN-{batch_id}-{index}"])
        exposure = Exposure(exposure_id=f"EXP-{entity_id}", entity_id=entity_id, ead=ead, pd=pd, lgd=lgd,
                            synthetic=True, source_record_id=f"SYN-{batch_id}-{index}")
        record = {"batch_id": batch_id, "risk_profile": risk_profile,
                        "entity": entity.model_dump(mode="json"), "company": company,
                        "exposure": exposure.model_dump(mode="json"), "risk_inputs": {},
                        "risk": {}, "category_scores": {}, "risks": [], "risk_drivers": [],
                        "category_model_version": MODEL_VERSION, "metrics": metrics,
                        "collateral": money(collateral), "net_exposure": money(max(0, ead - collateral)),
                        "collateral_market_value": money(collateral_market_value), "collateral_haircut": collateral_haircut,
                        "recovery": {}, "estimated_recovery": money(0),
                        "expected_credit_loss": round(ead * pd * lgd, 4),
                        "relationships": [], "evidence": [], "actions": [], "early_warnings": [],
                        "methodology_version": methodology()["version"], "generated_at": now.isoformat(),
                        "provenance": "DEMO", "synthetic_data": True}
        generated = enrich_record(attach_relationship_network(_attach_synthetic_dependency(record, rng), rng), rng)
        generated["early_warning_previous_inputs"] = generate_previous_inputs(generated, rng)
        generated["early_warning_indicators"] = generate_indicators(generated, rng)
        records.append(generated)
    return batch_id, records


def _attach_synthetic_dependency(record: dict, rng: random.Random) -> dict:
    """Create a visible synthetic supplier link and recalculate all derived scores."""
    company = record["company"]
    entity_id = company["id"]
    related_id = f"LINK-{entity_id}"
    metrics = record["metrics"]
    ead = record["exposure"]["ead"]
    if record.get("risk_profile") == "LOW":
        metrics["connected_exposure"] = round(ead * .02, 2)
        metrics["dependency_score"] = 5
    elif record.get("risk_profile") == "CRITICAL":
        metrics["connected_exposure"] = round(ead * .98, 2)
        metrics["dependency_score"] = 98
    else:
        metrics["connected_exposure"] = round(ead * .4, 2)
        metrics["dependency_score"] = 40
    if metrics.get("incident_rate", 0) == 0:
        metrics["incident_rate"] = round(rng.uniform(5, 75), 2)
    if metrics.get("critical_dependency", 0) == 0:
        metrics["critical_dependency"] = round(rng.uniform(10, 85), 2)
    if metrics.get("owner_share", 0) == 0:
        metrics["owner_share"] = round(rng.uniform(15, 80), 2)
    if metrics.get("ownership_complexity", 0) == 0:
        metrics["ownership_complexity"] = round(rng.uniform(5, 70), 2)
    if metrics.get("legal_claims", 0) == 0:
        metrics["legal_claims"] = round(metrics["revenue"] * rng.uniform(.01, .20), 2)
    if metrics.get("open_case_index", 0) == 0:
        metrics["open_case_index"] = round(rng.uniform(5, 70), 2)
    if metrics.get("supplier_share", 0) == 0:
        metrics["supplier_share"] = round(rng.uniform(15, 75), 2)
    name = f"Synthetic Supply Partner {entity_id[-6:]}"
    related_entity = CanonicalEntity(canonical_entity_id=related_id, legal_name=name, entity_type="Supplier",
                                      country=company["country"], provenance="DEMO", data_classification="PUBLIC")
    related_exposure = Exposure(exposure_id=f"EXP-{related_id}", entity_id=related_id,
                                ead=metrics["connected_exposure"], pd=record["exposure"]["pd"],
                                lgd=record["exposure"]["lgd"], synthetic=True)
    evidence_id = f"EV-{entity_id}"
    evidence = Evidence(evidence_id=evidence_id, source_system="SYNTHETIC_GENERATOR",
                        source_record_id=entity_id, observed_at=record["generated_at"],
                        description="Manufactured supplier dependency for demonstration", confidence=80)
    ratings = {
        "Purchase dependency": suggest_parameter_rating("L2-01", "Purchase dependency", metrics["supplier_share"])["rating"],
        "Supplier replacement time": suggest_parameter_rating("L2-01", "Supplier replacement time", metrics["replacement_months"])["rating"],
        "Production dependency": suggest_parameter_rating("L2-01", "Production dependency", metrics["dependency_score"])["rating"],
    }
    relationship = Relationship(relationship_id=f"REL-{entity_id}", relationship_code="L2-01",
                                relationship_category="Operational Dependencies", relationship_type="SUPPLIES",
                                source_entity_id=entity_id, target_entity_id=related_id, level_type="LEVEL_2",
                                parameter_ratings=ratings, evidence_ids=[evidence_id],
                                data_sources=["SYNTHETIC_GENERATOR"], source_quality=80, data_freshness=100,
                                verification_status=80, review_status="DEMO", provenance="DEMO",
                                dependency_key=related_id)
    assessment = calculate_all_scores(metrics, relationship, related_exposure.ead)
    metrics = assessment["metrics"]
    category_scores = assessment["category_scores"]
    inputs = assessment["risk_inputs"]
    risk = assessment["overall_risk"]
    company["riskScore"] = risk["score"]
    company["riskLevel"] = level(risk["score"])
    systemic_score = .5 * category_scores["Exposure"]["score"] + .3 * category_scores["Sector"]["score"] + .2 * category_scores["Operational"]["score"]
    company["criticality"] = {"bankRelationshipCriticality": level(category_scores["Exposure"]["score"]),
                              "sectorCriticality": level(category_scores["Sector"]["score"]),
                              "operationalCriticality": level(category_scores["Operational"]["score"]),
                              "systemicImportance": level(systemic_score),
                              "substitutability": level(category_scores["Supplier"]["score"])}
    risk_cards = make_risk_cards(category_scores, record["generated_at"])
    money = lambda amount: {"amount": round(amount, 2), "currency": "INR", "unit": "Cr"}
    record.update({"company": company, "metrics": metrics, "category_scores": category_scores,
                   "risks": risk_cards, "risk_drivers": make_risk_drivers(category_scores),
                   "category_model_version": MODEL_VERSION, "risk_inputs": inputs.model_dump(mode="json"),
                   "risk": risk, "network_risk_score": assessment["network_risk_score"],
                   "collateral": money(assessment["recovery"]["eligible_collateral"]),
                   "net_exposure": money(assessment["net_exposure"]),
                   "recovery": assessment["recovery"],
                   "estimated_recovery": money(assessment["recovery"]["estimated_recovery"]),
                   "related_entity": related_entity.model_dump(mode="json"),
                   "related_exposure": related_exposure.model_dump(mode="json"),
                   "relationship": relationship.model_dump(mode="json"), "evidence_record": evidence.model_dump(mode="json"),
                   "relationships": [{"relationshipId": relationship.relationship_id, "taxonomyId": "TX-L2-001",
                                      "level": "LEVEL_2", "category": "Operational Dependencies", "type": "SUPPLIES",
                                      "entityA": entity_id, "entityB": related_id,
                                      "definition": f"{company['name']} depends on {name} (synthetic).",
                                      "strength": round(metrics["dependency_score"] / 100, 4),
                                      "dependency": round(metrics["dependency_score"] / 100, 4),
                                      "exposure": {"amount": related_exposure.ead, "currency": "INR", "unit": "Cr"},
                                      "riskRelevance": "Synthetic supplier contagion", "confidence": "MEDIUM",
                                      "sourceIds": [evidence_id], "effectiveDate": record["generated_at"][:10],
                                      "lastRefreshed": record["generated_at"][:10], "provenance": "DEMO"}],
                   "graph_data": {"centerId": entity_id,
                                  "nodes": [{"id": entity_id, "label": company["name"], "entityType": "COMPANY",
                                             "nodeRole": "Counterparty", "riskLevel": company["riskLevel"], "weight": 1,
                                             "level": "LEVEL_1", "x": .5, "y": .5},
                                            {"id": related_id, "label": name, "entityType": "COMPANY",
                                             "nodeRole": "Supplier", "riskLevel": level(metrics["sector_stress_index"]),
                                             "weight": .55, "level": "LEVEL_2", "x": .78, "y": .47}],
                                  "edges": [{"id": f"EDGE-{relationship.relationship_id}",
                                             "relationshipId": relationship.relationship_id, "from": entity_id,
                                             "to": related_id, "type": "SUPPLIES",
                                             "riskLevel": level(category_scores["Contagion"]["score"]),
                                             "strength": round(metrics["dependency_score"] / 100, 4)}]}})
    return record
