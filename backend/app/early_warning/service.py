from __future__ import annotations

from app.configuration.registry import methodology


def _severity(value: float, thresholds: list[float]) -> str:
    low, medium, high = thresholds
    return "LOW" if value < low else "MEDIUM" if value < medium else "HIGH" if value <= high else "CRITICAL"


def turnover_drop(previous_quarter: float, current_quarter: float) -> dict:
    if previous_quarter <= 0:
        raise ValueError("Previous quarter turnover must be positive")
    change_percent = (current_quarter - previous_quarter) / previous_quarter * 100
    decline = max(0, -change_percent)
    severity = _severity(decline, methodology()["early_warning"]["turnover_decline_thresholds"])
    return {"signal": "Account Turnover Drop", "change_percent": round(change_percent, 4),
            "decline_percent": round(decline, 4), "severity": severity,
            "formula": "(current_quarter - previous_quarter) / previous_quarter * 100"}


def sector_stress(industry_default_rate_score: float, rating_downgrades_score: float, market_indicator_score: float) -> dict:
    values = (industry_default_rate_score, rating_downgrades_score, market_indicator_score)
    if any(not 0 <= value <= 100 for value in values):
        raise ValueError("Sector components must be 0 to 100")
    weights = methodology()["early_warning"]["sector_stress_weights"]
    score = sum(value * weights[key] for key, value in zip(("industry_default_rate", "rating_downgrades", "market_indicators"), values))
    severity = _severity(score, methodology()["early_warning"]["sector_stress_thresholds"])
    return {"signal": "Sector Stress", "score": round(score, 4), "severity": severity,
            "weights": weights}


def evaluate(observations: dict[str, float], approved_thresholds: dict[str, float]) -> list[dict]:
    """Only configured signals are emitted; missing observations are not inferred."""
    return [{"signal": key, "observed": observations[key], "threshold": threshold,
             "status": "BREACH", "provenance": "CALCULATED"}
            for key, threshold in approved_thresholds.items()
            if key in observations and observations[key] >= threshold]
