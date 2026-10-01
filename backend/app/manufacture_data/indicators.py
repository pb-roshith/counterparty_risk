"""Early-warning readings supported by manufactured financial and risk inputs."""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from app.early_warning.service import sector_stress


def generate_previous_inputs(record: dict, rng: random.Random) -> dict:
    """Store a coherent prior synthetic snapshot when a counterparty is made."""
    m, exposure = record["metrics"], record["exposure"]
    change = lambda value, low, high: round(max(0, value * rng.uniform(low, high)), 4)
    return {
        "as_of": (datetime.fromisoformat(record["generated_at"]) - timedelta(days=90)).date().isoformat(),
        "debt": change(m["debt"], .85, 1.15),
        "cash": change(m["cash"], .8, 1.2),
        "ebitda": change(m["ebitda"], .8, 1.2),
        "covenant_headroom": min(1, change(m["covenant_headroom"], .7, 1.3)),
        "ead": change(exposure["ead"], .75, 1.15),
        "limit": change(m["limit"], .9, 1.1),
        "supplier_share": min(100, change(m["supplier_share"], .8, 1.2)),
        "customer_revenue_share": min(100, change(m["customer_revenue_share"], .8, 1.2)),
        "country_risk_index": min(100, change(m["country_risk_index"], .85, 1.15)),
        "sector_stress_index": min(100, change(m["sector_stress_index"], .85, 1.15)),
        "incident_rate": min(100, change(m["incident_rate"], .75, 1.25)),
    }


def generate_indicators(record: dict, rng: random.Random) -> list[dict]:
    m, exposure, company = record["metrics"], record["exposure"], record["company"]
    previous = record["early_warning_previous_inputs"]
    date = record["generated_at"][:10]

    def row(code: str, name: str, category: str, current: float, previous: float,
            threshold: float, lower_bad: bool, formula: str, unit: str = "", decimals: int = 1) -> dict:
        breached = current <= threshold if lower_bad else current >= threshold
        watch = current <= threshold * 1.2 if lower_bad else current >= threshold * .8
        status = "Breached" if breached else "Watch" if watch else "Within Threshold"
        return {"id": f"EWI-{company['id']}-{code}", "indicator": name, "category": category,
                "current": f"{current:,.{decimals}f}{unit}", "previous": f"{previous:,.{decimals}f}{unit}",
                "trend": "DOWN" if current < previous else "UP" if current > previous else "FLAT",
                "adverse": current < previous if lower_bad else current > previous,
                "threshold": f"{'≤' if lower_bad else '≥'} {threshold:,.{decimals}f}{unit}",
                "status": status, "riskLevel": "HIGH" if breached else "MODERATE" if watch else "LOW",
                "date": date, "formula": formula, "provenance": "DEMO"}

    net_debt = max(0, m["debt"] - m["cash"])
    leverage = net_debt / max(m["ebitda"], .01)
    previous_leverage = max(0, previous["debt"] - previous["cash"]) / max(previous["ebitda"], .01)
    utilization = exposure["ead"] / max(m["limit"], .01) * 100
    previous_utilization = previous["ead"] / max(previous["limit"], .01) * 100
    sector = sector_stress(m["sector_stress_index"], m["country_risk_index"], m["incident_rate"])["score"]
    previous_sector = sector_stress(previous["sector_stress_index"], previous["country_risk_index"], previous["incident_rate"])["score"]

    return [
        row("LEVERAGE", "Net debt / EBITDA", "Leverage", leverage, previous_leverage, 5.5, False,
            "(Debt − cash) ÷ EBITDA; both periods use stored manufactured inputs.", "x"),
        row("COVENANT", "Covenant headroom", "Credit", m["covenant_headroom"] * 100,
            previous["covenant_headroom"] * 100, 10, True, "Stored covenant headroom × 100 for each period.", "%"),
        row("UTILIZATION", "Bank exposure utilisation", "Exposure", utilization, previous_utilization, 90, False,
            "Stored exposure at default ÷ stored applicable limit × 100 for each period.", "%"),
        row("SUPPLIER", "Top supplier concentration", "Supplier", m["supplier_share"],
            previous["supplier_share"], 30, False,
            "Stored largest-supplier share for each manufactured period.", "%"),
        row("CUSTOMER", "Top customer concentration", "Customer", m["customer_revenue_share"],
            previous["customer_revenue_share"], 40, False,
            "Stored largest-customer revenue share for each manufactured period.", "%"),
        row("COUNTRY", "Country risk score", "Country", m["country_risk_index"],
            previous["country_risk_index"], 40, False,
            "Stored normalized country risk index for each period; methodology requires an approved source for live use.", decimals=0),
        row("SECTOR", "Sector stress index", "Sector", sector, previous_sector, 60, False,
            "50% sector stress index + 30% country risk index + 20% incident rate, calculated from each period's stored inputs.", decimals=0),
    ]
