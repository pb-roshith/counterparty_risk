from __future__ import annotations

from app.scoring.engine import cap
from app.configuration.registry import methodology


def connectivity_score(direct: float, indirect: float, diversity: float) -> float:
    weights = methodology()["connectivity_weights"]
    return cap(sum(value * weights[key] for key, value in (("direct", direct), ("indirect", indirect), ("diversity", diversity))))


def contagion_score(exposure_concentration: float, connectivity: float, connected_stress: float) -> float:
    weights = methodology()["contagion_weights"]
    return cap(sum(value * weights[key] for key, value in (("exposure_concentration", exposure_concentration), ("connectivity", connectivity), ("connected_stress", connected_stress))))


def committee_score(final: float, contagion: float, concentration: float, event: float) -> dict:
    weights = methodology()["committee_weights"]
    score = cap(sum(value * weights[key] for key, value in (("final", final), ("contagion", contagion), ("concentration", concentration), ("event", event))))
    labels = [(0, "Standard Monitoring"), (20, "Periodic Review"), (40, "Enhanced Monitoring"),
              (60, "Credit Review Required"), (80, "Immediate Committee Escalation")]
    return {"score": round(score, 4), "recommendation": next(label for floor, label in reversed(labels) if score >= floor)}
