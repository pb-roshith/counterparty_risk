"""Transparent, illustrative 0–100 formulas for manufactured data.

These weights are product assumptions, not part of the approved connected
counterparty methodology. They must be calibrated before use with bank data.
"""
from __future__ import annotations


MODEL_VERSION = "synthetic-category-2.0"
CATEGORIES = ("Credit", "Default", "Exposure", "Contagion", "Recovery", "Country", "Sector",
              "Operational", "Liquidity", "Ownership", "Supplier", "Customer", "Funding", "Legal", "Collateral")


def cap(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def ratio(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator > 0 else 0.0


def level(score: float) -> str:
    return "LOW" if score < 20 else "MODERATE" if score < 60 else "HIGH" if score < 80 else "CRITICAL"


def score_categories(values: dict[str, float]) -> dict[str, dict]:
    """All inputs are source facts or explicit synthetic assumptions, never card scores."""
    ead = values["ead"]
    revenue = values["revenue"]
    assets = values["assets"]
    debt = values["debt"]
    cash = values["cash"]
    ebitda = values["ebitda"]
    collateral = values["collateral"]
    recovery = values["estimated_recovery"]
    limit = values["limit"]
    formulas = {
        "Credit": ("0.45*clip(100*net_debt/EBITDA/8) + 0.35*clip(100*(1-interest_cover/4)) + 0.20*clip(100*(1-covenant_headroom/0.30))",
                   .45 * cap(100 * ratio(max(0, debt - cash), ebitda) / 8) + .35 * cap(100 * (1 - values["interest_cover"] / 4)) + .20 * cap(100 * (1 - values["covenant_headroom"] / .30))),
        "Default": ("PD / 0.20 * 100", cap(values["pd"] / .20 * 100)),
        "Exposure": ("EAD / approved_limit * 100", cap(ratio(ead, limit) * 100)),
        "Contagion": ("0.60*clip(100*connected_exposure/EAD) + 0.40*dependency_score", .60 * cap(ratio(values["connected_exposure"], ead) * 100) + .40 * values["dependency_score"]),
        "Recovery": ("(EAD - estimated_recovery) / EAD * 100", cap(100 * (1 - ratio(recovery, ead)))),
        "Country": ("country_risk_index", values["country_risk_index"]),
        "Sector": ("sector_stress_index", values["sector_stress_index"]),
        "Operational": ("0.60*incident_rate + 0.40*critical_dependency", .60 * values["incident_rate"] + .40 * values["critical_dependency"]),
        "Liquidity": ("0.60*clip(100*(1-cash/short_term_debt)) + 0.40*clip(100*(1-current_ratio/2))", .60 * cap(100 * (1 - ratio(cash, values["short_term_debt"]))) + .40 * cap(100 * (1 - values["current_ratio"] / 2))),
        "Ownership": ("0.70*owner_share + 0.30*ownership_complexity", .70 * values["owner_share"] + .30 * values["ownership_complexity"]),
        "Supplier": ("0.65*supplier_share + 0.35*clip(100*replacement_months/12)", .65 * values["supplier_share"] + .35 * cap(values["replacement_months"] / 12 * 100)),
        "Customer": ("0.65*customer_revenue_share + 0.35*overdue_receivables_share", .65 * values["customer_revenue_share"] + .35 * values["overdue_receivables_share"]),
        "Funding": ("0.70*clip(100*short_term_debt/debt) + 0.30*clip(100*(1-cash/short_term_debt))", .70 * cap(ratio(values["short_term_debt"], debt) * 100) + .30 * cap(100 * (1 - ratio(cash, values["short_term_debt"])))),
        "Legal": ("0.70*clip(100*claims/revenue) + 0.30*open_case_index", .70 * cap(ratio(values["legal_claims"], revenue) * 100) + .30 * values["open_case_index"]),
        "Collateral": ("0.70*clip(100*(1-eligible_collateral/EAD)) + 0.30*100*haircut", .70 * cap(100 * (1 - ratio(collateral, ead))) + .30 * values["collateral_haircut"] * 100),
    }
    return {category: {"score": cap(raw), "level": level(cap(raw)), "formula": formula,
                       "model_version": MODEL_VERSION, "provenance": "DEMO"}
            for category, (formula, raw) in formulas.items()}


def estimate_recovery(ead: float, collateral_market_value: float, haircut: float, lgd: float) -> dict:
    eligible = collateral_market_value * (1 - haircut)
    unsecured = max(0, ead - eligible)
    estimated = min(ead, eligible + unsecured * (1 - lgd))
    return {"eligible_collateral": round(eligible, 2), "estimated_recovery": round(estimated, 2),
            "formula": "min(EAD, collateral_market_value*(1-haircut) + max(0,EAD-eligible_collateral)*(1-LGD))",
            "model_version": MODEL_VERSION}


def calculate_all_scores(metrics: dict[str, float], relationship=None, connected_ead: float = 0) -> dict:
    """Single calculation entry point for all 15 cards, recovery, and overall risk.

    The 15 category formulas are illustrative. Overall and network scoring use
    the published connected-counterparty methodology functions.
    """
    from app.models import ScoreInputs
    from app.scoring.engine import calculate_counterparty, final_risk

    ead = metrics["ead"]
    haircut = metrics["collateral_haircut"]
    market_value = metrics["collateral_market_value"]
    lgd = metrics["lgd"]
    if ead <= 0 or market_value < 0 or not 0 <= haircut <= 1 or not 0 <= lgd <= 1:
        raise ValueError("EAD, collateral market value, haircut, or LGD is invalid")
    recovery = estimate_recovery(ead, market_value, haircut, lgd)
    prepared = {**metrics, "collateral": recovery["eligible_collateral"],
                "estimated_recovery": recovery["estimated_recovery"]}
    categories = score_categories(prepared)
    standalone = round(sum(categories[key]["score"] for key in ("Credit", "Default", "Liquidity")) / 3, 2)
    concentration = round(sum(categories[key]["score"] for key in ("Exposure", "Supplier", "Customer")) / 3, 2)
    event = round(sum(categories[key]["score"] for key in ("Operational", "Legal")) / 2, 2)
    connected_stress = {}
    if relationship is not None:
        connected_stress[relationship.target_entity_id] = (
            prepared["sector_stress_index"], prepared["incident_rate"], prepared["critical_dependency"])
    inputs = ScoreInputs(provenance="DEMO", standalone=standalone, concentration=concentration,
                         event=event, connected_stress=connected_stress,
                         no_connections_verified=relationship is None, applicable_limit=prepared["limit"])
    if relationship is None:
        overall = final_risk(standalone, 0, concentration, event)
        network = 0.0
    else:
        calculated = calculate_counterparty(inputs, [relationship], {relationship.target_entity_id: connected_ead})
        overall = calculated["final_risk"]
        network = calculated["network_risk_score"]
    return {"metrics": prepared, "category_scores": categories, "risk_inputs": inputs,
            "overall_risk": overall, "network_risk_score": network,
            "recovery": recovery, "net_exposure": round(max(0, ead - recovery["eligible_collateral"]), 2)}


def make_risk_cards(category_scores: dict[str, dict], as_of: str) -> list[dict]:
    return [{"id": f"RSK-{category.upper()}", "category": category, "label": f"{category} Risk",
             "score": {"score": result["score"], "level": result["level"], "trend": "FLAT",
                       "provenance": "DEMO", "asOf": as_of},
             "materiality": round(result["score"] / 100, 2),
             "reasons": [result["formula"]],
             "potentialImpact": result["level"], "sourceIds": [],
             "summary": ""}
            for category, result in category_scores.items()]


def make_risk_drivers(category_scores: dict[str, dict]) -> list[dict]:
    return [{"id": f"DRV-{category.upper()}", "title": f"{category} risk input",
             "riskCategory": category, "severity": category_scores[category]["level"],
             "explanation": f"Illustrative score {category_scores[category]['score']} from {category_scores[category]['formula']}.",
             "impact": "",
             "sourceIds": []}
            for category in sorted(category_scores, key=lambda key: category_scores[key]["score"], reverse=True)[:4]]


def assess_demo_profile(profile: dict) -> dict:
    """Calculate legacy demo cards from supplied demo facts and labeled assumptions."""
    ead = profile["ead"]
    debt = profile["debt"]
    ebitda = profile["ebitda"]
    assets = profile["assets"]
    cash = profile["cash"]
    collateral = profile["collateral"]
    haircut = profile.get("collateral_haircut", .25)
    pd = profile.get("pd", .04)
    lgd = profile.get("lgd", .45)
    collateral_market = collateral / (1 - haircut)
    recovery = estimate_recovery(ead, collateral_market, haircut, lgd)
    country_index = {"India": 38, "Singapore": 18, "United Kingdom": 24, "United Arab Emirates": 33}
    sector_index = {"Infrastructure & Construction": 62, "Energy & Utilities": 43,
                    "Transport & Logistics": 52, "Healthcare": 28, "Manufacturing": 47,
                    "Consumer Staples": 31, "Wholesale Trade": 55}
    values = {"ead": ead, "revenue": profile["revenue"], "assets": assets, "debt": debt,
              "cash": cash, "ebitda": ebitda, "collateral": collateral,
              "estimated_recovery": recovery["estimated_recovery"], "limit": profile.get("limit", max(ead * 1.5, 1)),
              "pd": pd, "interest_cover": min(5, ratio(ebitda, debt * .10)),
              "covenant_headroom": cap(ratio(assets - profile["liabilities"], assets) * 30) / 100,
              "connected_exposure": profile["connected_exposure"],
              "dependency_score": profile["dependency_score"],
              "country_risk_index": country_index.get(profile["country"], 50),
              "sector_stress_index": sector_index.get(profile["sector"], 50),
              "incident_rate": min(100, profile["operational_event_count"] * 20),
              "critical_dependency": profile["dependency_score"],
              "short_term_debt": debt * .35, "current_ratio": 1.3,
              "owner_share": profile["owner_share"], "ownership_complexity": min(100, profile["relationship_count"] * 5),
              "supplier_share": profile["supplier_share"], "replacement_months": 6,
              "customer_revenue_share": profile["customer_share"], "overdue_receivables_share": 20,
              "legal_claims": 0, "open_case_index": min(100, profile["legal_event_count"] * 25),
              "collateral_haircut": haircut}
    scored = score_categories(values)
    values["collateral_market_value"] = collateral_market
    return {"risks": make_risk_cards(scored, profile["as_of"]), "risk_drivers": make_risk_drivers(scored),
            "category_scores": scored, "metrics": values, "recovery": recovery,
            "estimated_recovery": recovery["estimated_recovery"],
            "net_exposure": round(max(0, ead - collateral), 2),
            "recovery_pct": round(ratio(recovery["estimated_recovery"], ead) * 100),
            "assumptions": {"pd": pd, "lgd": lgd, "collateral_haircut": haircut,
                            "approved_limit": values["limit"], "short_term_debt_share": .35,
                            "current_ratio": 1.3},
            "model_version": MODEL_VERSION, "provenance": "DEMO"}
