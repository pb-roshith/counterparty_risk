from __future__ import annotations

from datetime import datetime, timezone
from math import prod
import re
from uuid import uuid4

from app.configuration.registry import methodology, relationship_definition
from app.models import Relationship, ScoreInputs


def cap(value: float) -> float:
    return max(0.0, min(100.0, value))


def normalize_rating(rating: int) -> float:
    if isinstance(rating, bool) or rating not in range(1, 6):
        raise ValueError("Parameter rating must be an integer from 1 to 5")
    return (rating - 1) / 4 * 100


def band(score: float, kind: str = "relationship") -> str:
    key = "relationship_bands" if kind == "relationship" else "final_bands"
    return next(label for floor, label in reversed(methodology()[key]) if score >= floor)


def confidence_band(score: float) -> str:
    return "Very High" if score >= 90 else "High" if score >= 75 else "Medium" if score >= 50 else "Low"


def relationship_score(relationship: Relationship) -> dict:
    definition = relationship_definition(relationship.relationship_code)
    if relationship.level_type == "ANCILLARY":
        raise ValueError("Ancillary evidence cannot be scored as a business relationship")
    expected = {p["name"] for p in definition["parameters"]}
    if set(relationship.parameter_ratings) != expected:
        raise ValueError(f"Parameter ratings must match: {', '.join(sorted(expected))}")
    trace = [
        {"parameter": p["name"], "rating": relationship.parameter_ratings[p["name"]],
         "normalized_score": normalize_rating(relationship.parameter_ratings[p["name"]]),
         "weight": p["weight"], "formula": p["formula_text"],
         "rating_thresholds": p["rating_thresholds_text"],
         "observed_value": relationship.parameter_values.get(p["name"])}
        for p in definition["parameters"]
    ]
    score = cap(sum(row["normalized_score"] * row["weight"] for row in trace))
    confidence = confidence_score(relationship.source_quality, relationship.data_freshness, relationship.verification_status)
    return {"relationship_id": relationship.relationship_id, "relationship_code": relationship.relationship_code,
            "score": round(score, 4), "band": band(score), "parameters": trace,
            "confidence_score": round(confidence, 4), "confidence_factor": round(confidence / 100, 4),
            "confidence_band": confidence_band(confidence),
            "evidence_ids": list(dict.fromkeys(relationship.evidence_ids)), "data_sources": relationship.data_sources,
            "effective_from": relationship.effective_from.isoformat() if relationship.effective_from else None,
            "effective_to": relationship.effective_to.isoformat() if relationship.effective_to else None,
            "review_status": relationship.review_status,
            "methodology_version": methodology()["version"], "calculated_at": datetime.now(timezone.utc).isoformat()}


def ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        raise ValueError("A positive denominator is required")
    return numerator / denominator * 100


def parent_subsidiary_measures(values: dict[str, float]) -> dict[str, float]:
    """Approved L1-01 formulas; negative EBITDA requires manual review."""
    required = {"parent_shares", "subsidiary_shares", "parent_votes", "total_votes", "subsidiary_revenue", "group_revenue", "subsidiary_assets", "group_assets", "subsidiary_ebitda", "group_ebitda", "equity_investment", "intercompany_loans", "intercompany_receivables", "guarantees", "undrawn_support", "expected_recapitalization", "parent_adjusted_capital"}
    missing = required - values.keys()
    if missing:
        raise ValueError(f"Missing L1-01 inputs: {', '.join(sorted(missing))}")
    if values["subsidiary_ebitda"] < 0 or values["group_ebitda"] <= 0:
        raise ValueError("Negative or zero EBITDA requires approved manual review")
    ownership = max(ratio(values["parent_shares"], values["subsidiary_shares"]), ratio(values["parent_votes"], values["total_votes"]))
    materiality = (0.4 * ratio(values["subsidiary_revenue"], values["group_revenue"])
                   + 0.3 * ratio(values["subsidiary_assets"], values["group_assets"])
                   + 0.3 * ratio(values["subsidiary_ebitda"], values["group_ebitda"]))
    support = ratio(sum(values[key] for key in ("equity_investment", "intercompany_loans", "intercompany_receivables", "guarantees", "undrawn_support", "expected_recapitalization")), values["parent_adjusted_capital"])
    return {"Ownership and control": ownership, "Subsidiary financial materiality": materiality, "Parent exposure and support": support}


def suggest_parameter_rating(code: str, parameter_name: str, observed_value: float) -> dict:
    """Apply source-specific numeric thresholds; qualitative overrides need review.

    This is a rating suggestion, not an approved risk score. The published
    methodology text remains the source of truth for all 75 parameters.
    """
    definition = relationship_definition(code)
    parameter = next((p for p in definition["parameters"] if p["name"] == parameter_name), None)
    if parameter is None:
        raise KeyError(parameter_name)
    text = parameter["rating_thresholds_text"]
    clauses = dict((int(number), clause.strip()) for number, clause in
                   re.findall(r"([1-5]):\s*(.*?)(?=\s+[1-5]:|$)", text))
    if len(clauses) != 5:
        raise ValueError("Incomplete rating thresholds")
    if parameter_name == "Overlapping tenure":
        floors = [3, 12, 36, 60]  # input is months
        rating = 1 + sum(observed_value >= floor for floor in floors)
    elif parameter_name == "Supply-path depth":
        rating = 1 if observed_value > 5 else 2 if observed_value >= 4 else 3 if observed_value >= 3 else 4 if observed_value >= 2 else 5
    elif parameter_name == "Ownership-path complexity":
        rating = 1 if observed_value < 2 else 2 if observed_value < 4 else 3 if observed_value < 6 else 4 if observed_value <= 8 else 5
    elif clauses[1].lower().startswith("more than"):
        numbers = [float(re.search(r"\d+(?:\.\d+)?", clauses[i]).group()) for i in (1, 2, 3, 4)]
        rating = 1 if observed_value > numbers[0] else 2 if observed_value >= numbers[1] else 3 if observed_value >= numbers[2] else 4 if observed_value >= numbers[3] else 5
    elif re.match(r"\d+(?:\.\d+)?%? or more", clauses[1], re.I):
        numbers = [float(re.search(r"\d+(?:\.\d+)?", clauses[i]).group()) for i in (1, 2, 3, 4)]
        rating = 1 if observed_value >= numbers[0] else 2 if observed_value >= numbers[1] else 3 if observed_value >= numbers[2] else 4 if observed_value >= numbers[3] else 5
    elif clauses[1].lower().startswith("below") or re.match(r"0 to below", clauses[1], re.I):
        if any(not re.match(r"(?:\d+(?:\.\d+)?|Above \d+(?:\.\d+)?)", clauses[i], re.I) for i in (2, 3, 4, 5)):
            raise ValueError("Qualitative threshold requires an approved analyst rating")
        floors = [float(re.search(r"\d+(?:\.\d+)?", clauses[i]).group()) for i in (2, 3, 4, 5)]
        rating = 1 + sum(observed_value >= floor for floor in floors)
        if clauses[5].lower().startswith("above") and observed_value == floors[-1]:
            rating = 4
    else:
        raise ValueError("Qualitative threshold requires an approved analyst rating")
    needs_review = any(" or " in clauses[i].lower() and not clauses[i].lower().strip().endswith("or more.") for i in range(1, 6))
    return {"rating": rating, "normalized_score": normalize_rating(rating), "observed_value": observed_value,
            "rating_thresholds": text, "methodology_version": methodology()["version"],
            "provisional": True, "requires_qualitative_override_review": needs_review}


def confidence_score(source_quality: float, data_freshness: float, verification_status: float) -> float:
    if any(not 0 <= value <= 100 for value in (source_quality, data_freshness, verification_status)):
        raise ValueError("Confidence components must be 0 to 100")
    weights = methodology()["confidence_weights"]
    return sum(value * weights[key] for key, value in (("source_quality", source_quality), ("data_freshness", data_freshness), ("verification_status", verification_status)))


def stress_score(financial_liquidity: float, credit_market: float, operational_legal_reputation: float) -> float:
    if any(not 0 <= value <= 100 for value in (financial_liquidity, credit_market, operational_legal_reputation)):
        raise ValueError("Stress components must be 0 to 100")
    weights = methodology()["stress_weights"]
    return sum(value * weights[key] for key, value in (("financial_liquidity", financial_liquidity), ("credit_market", credit_market), ("operational_legal_reputation", operational_legal_reputation)))


def exposure_factor(connected_ead: float, applicable_limit: float | None) -> float:
    if connected_ead < 0:
        raise ValueError("EAD cannot be negative")
    if applicable_limit is None:
        return 1.0
    percent = ratio(connected_ead, applicable_limit)
    return next(factor for floor, factor in reversed(methodology()["exposure_factors"]) if percent >= floor)


def relationship_contribution(relationship_score_value: float, connected_stress: float, direction_factor: float, confidence_factor: float, exposure_factor_value: float) -> float:
    if any(value < 0 for value in (relationship_score_value, connected_stress, direction_factor, confidence_factor, exposure_factor_value)):
        raise ValueError("Risk contribution inputs cannot be negative")
    return cap(relationship_score_value * connected_stress / 100 * direction_factor * confidence_factor * exposure_factor_value)


def network_risk(contributions: list[float]) -> float:
    return cap(100 * (1 - prod(1 - cap(value) / 100 for value in contributions)))


def final_risk(standalone: float, network: float, concentration: float, event: float) -> dict:
    if any(not 0 <= value <= 100 for value in (standalone, network, concentration, event)):
        raise ValueError("Final score components must be 0 to 100")
    weights = methodology()["final_weights"]
    inputs = {"standalone": standalone, "network": network, "concentration": concentration, "event": event}
    score = cap(sum(inputs[key] * weights[key] for key in inputs))
    return {"score": round(score, 4), "band": band(score, "final"), "inputs": inputs,
            "weights": weights, "methodology_version": methodology()["version"],
            "calculated_at": datetime.now(timezone.utc).isoformat()}


def calculate_counterparty(inputs: ScoreInputs, relationships: list[Relationship], connected_eads: dict[str, float] | None = None) -> dict:
    connected_eads = connected_eads or {}
    strongest_by_dependency = {}
    # One economic dependency can have many source records; take its strongest
    # verified route rather than inflating the network score with duplicates.
    for relationship in relationships:
        if relationship.review_status not in ("APPROVED", "DEMO"):
            raise ValueError(f"Relationship {relationship.relationship_id} requires approval before central risk scoring")
        key = relationship.dependency_key or relationship.target_entity_id
        components = inputs.connected_stress.get(relationship.target_entity_id)
        if components is None:
            raise ValueError(f"Connected stress inputs missing for {relationship.target_entity_id}")
        scored = relationship_score(relationship)
        stress = stress_score(*components)
        confidence = confidence_score(relationship.source_quality, relationship.data_freshness, relationship.verification_status)
        direction = methodology()["direction_factors"].get(relationship.direction)
        if direction is None:
            raise ValueError(f"Unknown direction factor: {relationship.direction}")
        exp_factor = exposure_factor(connected_eads.get(relationship.target_entity_id, 0), inputs.applicable_limit)
        value = relationship_contribution(scored["score"], stress, direction, confidence / 100, exp_factor)
        row = {"relationship_id": relationship.relationship_id, "entity_id": relationship.target_entity_id,
                              "relationship_score": scored["score"], "stress_score": stress,
                              "confidence_score": confidence, "direction_factor": direction,
                              "exposure_factor": exp_factor, "contribution": round(value, 4),
                              "evidence_ids": list(dict.fromkeys(relationship.evidence_ids))}
        if key not in strongest_by_dependency or row["contribution"] > strongest_by_dependency[key]["contribution"]:
            strongest_by_dependency[key] = row
    contributions = list(strongest_by_dependency.values())
    network = network_risk([row["contribution"] for row in contributions])
    result = final_risk(inputs.standalone, network, inputs.concentration, inputs.event)
    result["evidence_ids"] = list(dict.fromkeys(inputs.evidence_ids + [evidence for row in contributions for evidence in row["evidence_ids"]]))
    result["source_timestamps"] = {key: timestamp.isoformat() for key, timestamp in inputs.source_timestamps.items()}
    result["approved_by"] = inputs.approved_by
    return {"calculation_run_id": str(uuid4()), "network_risk_score": round(network, 4),
            "network_formula": methodology()["network_formula"],
            "final_formula": methodology()["final_formula"],
            "final_risk": result, "contributions": contributions}
