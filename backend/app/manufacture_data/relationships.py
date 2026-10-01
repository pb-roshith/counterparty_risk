"""Synthetic two-hop relationship networks for manufactured counterparties."""
from __future__ import annotations

import math
import random

from app.configuration.registry import taxonomy
from app.configuration.registry import relationship_definition
from app.models import CanonicalEntity, Evidence, Exposure, Relationship, ScoreInputs
from app.scoring.engine import calculate_counterparty
from app.manufacture_data.synthetic_model import level


def attach_relationship_network(record: dict, rng: random.Random) -> dict:
    center = record["company"]["id"]
    name = record["company"]["name"]
    country = record["company"]["country"]
    date = record["generated_at"][:10]
    catalog = {item["ID"]: item for item in taxonomy()["relationships"]}
    entities: list[dict] = []
    evidence: list[dict] = []
    relationships: list[dict] = []
    register: list[dict] = []
    nodes = [{"id": center, "label": name, "entityType": "COMPANY", "nodeRole": "Counterparty",
              "riskLevel": record["company"]["riskLevel"], "weight": 1, "level": "LEVEL_1", "x": .5, "y": .5}]
    edges: list[dict] = []
    scored_edges: list[Relationship] = []
    related_exposures: list[dict] = []
    direct_count = rng.randint(15, 20)
    guarantee_count = rng.randint(2, 4)

    def add_link(source: str, target: str, code: str, kind: str, verb: str, source_name: str,
                 target_name: str, level: str, ordinal: int) -> None:
        item = catalog[code]
        rel_id = f"REL-{center}-{ordinal}"
        evidence_id = f"EV-{center}-{ordinal}"
        strength = round(rng.uniform(.42, .93), 4)
        dependency = round(rng.uniform(.18, .88), 4)
        evidence.append(Evidence(evidence_id=evidence_id, source_system="SYNTHETIC_GENERATOR",
                                 source_record_id=rel_id, observed_at=record["generated_at"],
                                 description=f"Synthetic example: {source_name} {verb} {target_name}",
                                 confidence=round(strength * 100, 2)).model_dump(mode="json"))
        graph_level = "LEVEL_1" if code.startswith("L1-") else "LEVEL_2"
        rating = 5 if record.get("risk_profile") == "CRITICAL" and level == "LEVEL_1" and kind != "OWNS" else None
        ratings = ({parameter["name"]: rating for parameter in relationship_definition(code)["parameters"]}
                   if rating else {})
        relationship = Relationship(relationship_id=rel_id, relationship_code=code,
                                           relationship_category=item["Relationship Category"],
                                           relationship_type=kind, source_entity_id=source,
                                           target_entity_id=target, level_type=graph_level,
                                           parameter_ratings=ratings,
                                           evidence_ids=[evidence_id], data_sources=["SYNTHETIC_GENERATOR"],
                                           source_quality=75, data_freshness=100, verification_status=70,
                                           review_status="DEMO", provenance="DEMO")
        relationships.append(relationship.model_dump(mode="json"))
        if rating:
            connected_id = target if source == center else source
            scored_edges.append(relationship.model_copy(update={"source_entity_id": center, "target_entity_id": connected_id}))
            related_exposures.append(Exposure(exposure_id=f"EXP-{connected_id}", entity_id=connected_id,
                                             ead=record["risk_inputs"]["applicable_limit"],
                                             pd=record["exposure"]["pd"], lgd=record["exposure"]["lgd"],
                                             synthetic=True).model_dump(mode="json"))
        register.append({"relationshipId": rel_id, "taxonomyId": f"TX-{code}", "level": level,
                         "category": item["Relationship Category"], "type": kind,
                         "entityA": source, "entityB": target,
                         "definition": f"{source_name} {verb} {target_name} (synthetic).",
                         "strength": strength, "dependency": dependency,
                         "exposure": {"amount": round(record["exposure"]["ead"] * dependency, 2),
                                      "currency": "INR", "unit": "Cr"},
                         "riskRelevance": item["Regulatory / Risk Relevance"],
                         "confidence": "HIGH" if strength >= .75 else "MEDIUM",
                         "sourceIds": [evidence_id], "effectiveDate": date,
                         "lastRefreshed": date, "provenance": "DEMO"})
        edges.append({"id": f"EDGE-{rel_id}", "relationshipId": rel_id,
                      "from": source, "to": target, "type": kind,
                      "riskLevel": "MODERATE", "strength": strength})

    ordinal = 0
    for i in range(direct_count):
        direct_id = f"LINK-{center}-{i + 1}"
        kind = "GUARANTEES" if i >= direct_count - guarantee_count else ("OWNS", "FUNDS", "SUPPLIES", "CUSTOMER_OF", "SECURED_BY")[i % 5]
        is_person = kind == "OWNS"
        direct_name = (f"Synthetic Owner {i + 1} {center[-5:]}" if is_person else
                       f"{name.split()[0]} Network Partner {i + 1} Ltd")
        role = {"OWNS": "Owner", "FUNDS": "Funder", "SUPPLIES": "Supplier",
                "CUSTOMER_OF": "Customer", "SECURED_BY": "Security provider", "GUARANTEES": "Guarantor"}[kind]
        entities.append(CanonicalEntity(canonical_entity_id=direct_id, legal_name=direct_name,
                                        entity_type="Person" if is_person else "LegalEntity",
                                        country=country, provenance="DEMO",
                                        data_classification="PUBLIC").model_dump(mode="json"))
        angle = 2 * math.pi * i / direct_count
        nodes.append({"id": direct_id, "label": direct_name,
                      "entityType": "PERSON" if is_person else "COMPANY", "nodeRole": role,
                      "riskLevel": "MODERATE", "weight": .65, "level": "LEVEL_1",
                      "x": round(.5 + .29 * math.cos(angle), 4),
                      "y": round(.5 + .29 * math.sin(angle), 4)})
        ordinal += 1
        if kind == "OWNS":
            add_link(direct_id, center, "L1-02", "OWNS", "owns", direct_name, name, "LEVEL_1", ordinal)
        elif kind == "FUNDS":
            add_link(direct_id, center, "L2-04", "FUNDS", "funds", direct_name, name, "LEVEL_1", ordinal)
        elif kind == "SUPPLIES":
            add_link(direct_id, center, "L2-01", "SUPPLIES", "supplies", direct_name, name, "LEVEL_1", ordinal)
        elif kind == "CUSTOMER_OF":
            add_link(direct_id, center, "L2-02", "CUSTOMER_OF", "is a customer of", direct_name, name,
                     "LEVEL_1", ordinal)
        elif kind == "GUARANTEES":
            add_link(direct_id, center, "L1-06", "GUARANTEES", "guarantees", direct_name, name,
                     "LEVEL_1", ordinal)
        else:
            add_link(center, direct_id, "L1-08", "SECURED_BY", "is secured by", name, direct_name,
                     "LEVEL_1", ordinal)
        second_count = rng.randint(5, 7)
        for j in range(second_count):
            second_id = f"LINK-{center}-{i + 1}-{j + 1}"
            second_kind = ("OWNS", "FUNDS", "SUPPLIES", "CUSTOMER_OF", "SECURED_BY")[(i + j) % 5]
            if is_person:
                second_kind = "OWNS"
            second_person = second_kind == "OWNS" and not is_person
            second_name = (f"Synthetic Investor {i + 1}-{j + 1} {center[-5:]}" if second_person else
                           f"{name.split()[0]} Network Company {i + 1}-{j + 1} Ltd")
            entities.append(CanonicalEntity(canonical_entity_id=second_id, legal_name=second_name,
                                            entity_type="Person" if second_person else "LegalEntity",
                                            country=country, provenance="DEMO",
                                            data_classification="PUBLIC").model_dump(mode="json"))
            spoke = angle + (j - (second_count - 1) / 2) * .07
            nodes.append({"id": second_id, "label": second_name,
                          "entityType": "PERSON" if second_person else "COMPANY",
                          "nodeRole": "Owner" if second_person else "Network company",
                          "riskLevel": "MODERATE", "weight": .4, "level": "LEVEL_2",
                          "x": round(.5 + .46 * math.cos(spoke), 4),
                          "y": round(.5 + .46 * math.sin(spoke), 4)})
            ordinal += 1
            if is_person:
                add_link(direct_id, second_id, "L1-01", "OWNS", "owns", direct_name,
                         second_name, "LEVEL_2", ordinal)
            elif second_kind == "OWNS":
                add_link(second_id, direct_id, "L1-02", "OWNS", "owns", second_name,
                         direct_name, "LEVEL_2", ordinal)
            elif second_kind == "FUNDS":
                add_link(second_id, direct_id, "L2-04", "FUNDS", "funds", second_name,
                         direct_name, "LEVEL_2", ordinal)
            elif second_kind == "SUPPLIES":
                add_link(second_id, direct_id, "L2-01", "SUPPLIES", "supplies", second_name,
                         direct_name, "LEVEL_2", ordinal)
            elif second_kind == "CUSTOMER_OF":
                add_link(second_id, direct_id, "L2-02", "CUSTOMER_OF", "is a customer of", second_name,
                         direct_name, "LEVEL_2", ordinal)
            else:
                add_link(direct_id, second_id, "L1-08", "SECURED_BY", "is secured by",
                         direct_name, second_name, "LEVEL_2", ordinal)

    record.update({"related_entities": entities, "evidence_records": evidence,
                   "graph_relationships": relationships, "relationships": register,
                   "related_exposures": related_exposures,
                   "graph_data": {"centerId": center, "nodes": nodes, "edges": edges}})
    if scored_edges:
        inputs = ScoreInputs.model_validate(record["risk_inputs"])
        inputs.connected_stress.update({edge.target_entity_id: (98, 98, 98) for edge in scored_edges})
        legacy = Relationship.model_validate(record["relationship"])
        eads = {record["related_entity"]["canonical_entity_id"]: record["related_exposure"]["ead"]}
        eads.update({exposure["entity_id"]: exposure["ead"] for exposure in related_exposures})
        assessment = calculate_counterparty(inputs, [legacy, *scored_edges], eads)
        risk = assessment["final_risk"]
        record["risk_inputs"] = inputs.model_dump(mode="json")
        record["risk"] = risk
        record["network_risk_score"] = assessment["network_risk_score"]
        record["company"]["riskScore"] = risk["score"]
        record["company"]["riskLevel"] = level(risk["score"])
        nodes[0]["riskLevel"] = record["company"]["riskLevel"]
    return record
