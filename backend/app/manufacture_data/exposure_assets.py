"""Presentation data for synthetic exposure and recovery views."""
from __future__ import annotations

import random


PRODUCTS = ("Term Loan", "Working Capital", "Bank Guarantees", "Letters of Credit", "Derivatives (PFE)")
MATURITIES = ("0-1 year", "1-3 years", "3-5 years", "5+ years")
ASSET_TYPES = ("Land", "Buildings", "Plant and machinery", "Inventory", "Receivables", "Vehicles", "Cash deposits", "Equipment")


def enrich_record(record: dict, rng: random.Random) -> dict:
    company = record["company"]
    center = company["id"]
    ead = record["exposure"]["ead"]
    money = lambda value: {"amount": round(value, 2), "currency": "INR", "unit": "Cr"}

    def split(total: float, count: int) -> list[float]:
        weights = [rng.uniform(.6, 1.4) for _ in range(count)]
        amounts = [round(total * weight / sum(weights), 2) for weight in weights[:-1]]
        return [*amounts, round(total - sum(amounts), 2)]

    product_amounts = split(ead, len(PRODUCTS))
    funded = round(sum(product_amounts[:2]), 2)
    unfunded = round(ead - funded, 2)
    # PFE is the generated derivatives contribution to total EAD; it is not added again.
    pfe = product_amounts[4]
    risk = company["riskLevel"]
    breakdown = []

    def add(dimension: str, labels: list[str], amounts: list[float], ids: list[str] | None = None) -> None:
        for index, (label, amount) in enumerate(zip(labels, amounts)):
            breakdown.append({"key": f"{dimension}-{index}", "label": label, "amount": amount,
                              "riskLevel": risk, "currency": "INR", "dimension": dimension,
                              **({"entityId": ids[index]} if ids else {})})

    add("PRODUCT", list(PRODUCTS), product_amounts)
    direct = [node for node in record["graph_data"]["nodes"] if node["level"] == "LEVEL_1" and node["id"] != center]
    connected = direct[:min(5, len(direct))]
    entity_amounts = split(ead, len(connected) + 1)
    add("ENTITY", [company["name"], *[node["label"] for node in connected]], entity_amounts,
        [center, *[node["id"] for node in connected]])
    countries = list(dict.fromkeys([company["country"], "India", "Singapore", "United Kingdom", "United Arab Emirates"]))[:3]
    add("COUNTRY", countries, split(ead, len(countries)))
    add("MATURITY", list(MATURITIES), split(ead, len(MATURITIES)))

    asset_count = rng.randint(5, 8)
    asset_values = split(company["businessProfile"]["totalAssets"]["amount"], asset_count)
    collateral_amounts = split(record["collateral"]["amount"], asset_count)
    assets = []
    for index, (value, collateral) in enumerate(zip(asset_values, collateral_amounts)):
        asset_type = ASSET_TYPES[index]
        assets.append({"id": f"AST-{center}-{index + 1}", "name": f"{company['name']} {asset_type}",
                       "type": asset_type, "value": money(value), "ownership": company["name"],
                       "encumbrance": "PARTIALLY_ENCUMBERED" if collateral else "UNENCUMBERED",
                       "collateralValue": money(collateral),
                       "haircutPct": round(max(0, 100 * (1 - collateral / value))) if value else 0,
                       "valuationDate": record["generated_at"][:10], "recoveryPriority": index + 1,
                       "provenance": "DEMO"})

    names = {node["id"]: node["label"] for node in record["graph_data"]["nodes"]}
    guarantees = []
    for relation in record["relationships"]:
        if relation["type"] != "GUARANTEES" or relation["entityB"] != center:
            continue
        guarantees.append({"id": relation["relationshipId"], "guarantorId": relation["entityA"],
                           "guarantorName": names[relation["entityA"]], "beneficiaryEntityId": center,
                           "amount": relation["exposure"], "type": "Guarantee",
                           "enforceability": "MODERATE"})

    paths = []
    nodes = {node["id"]: node for node in record["graph_data"]["nodes"]}
    direct_links = {}
    for relation in record["relationships"]:
        if relation["level"] == "LEVEL_1":
            linked_id = relation["entityA"] if relation["entityB"] == center else relation["entityB"]
            direct_links[linked_id] = relation
    for relation in record["relationships"]:
        if relation["level"] != "LEVEL_2":
            continue
        linked_id = relation["entityA"] if relation["entityA"] in direct_links else relation["entityB"]
        if linked_id not in direct_links:
            continue
        terminal_id = relation["entityB"] if relation["entityA"] == linked_id else relation["entityA"]
        first = direct_links[linked_id]
        linked = nodes[linked_id]
        terminal = nodes[terminal_id]
        dependency = round(first["dependency"] * relation["dependency"], 4)
        amount = min(first["exposure"]["amount"], relation["exposure"]["amount"])
        paths.append({"id": relation["relationshipId"], "hops": [
            {"entityId": center, "entityName": company["name"], "entityType": "COMPANY"},
            {"entityId": linked_id, "entityName": linked["label"], "entityType": linked["entityType"],
             "relationshipType": first["type"]},
            {"entityId": terminal_id, "entityName": terminal["label"], "entityType": terminal["entityType"],
             "relationshipType": relation["type"]}],
            "transmissionChannel": f"{first['type']} → {relation['type']}",
            "exposure": money(amount), "dependency": dependency,
            "potentialImpact": f"Stress could travel from {company['name']} through {linked['label']} to {terminal['label']}.",
            "riskLevel": risk, "provenance": "DEMO"})

    record.update({"funded_exposure": money(funded), "unfunded_exposure": money(unfunded),
                   "potential_future_exposure": money(pfe), "exposure_breakdown": breakdown,
                   "assets": assets, "guarantees": guarantees, "contagion_paths": paths})
    return record
