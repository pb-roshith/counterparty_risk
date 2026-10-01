from __future__ import annotations

from app.models import Exposure, Facility


def facility_ead(facility: Facility) -> float | None:
    if facility.funded:
        return facility.outstanding
    if facility.ccf is None:
        return None
    return facility.outstanding + facility.undrawn * facility.ccf


def utilization(outstanding: float, approved_limit: float) -> float:
    if approved_limit <= 0:
        raise ValueError("Approved limit must be positive")
    return outstanding / approved_limit * 100


def expected_loss(exposure: Exposure, pd: float | None = None, lgd: float | None = None) -> float | None:
    probability = pd if pd is not None else exposure.pd
    loss_given_default = lgd if lgd is not None else exposure.lgd
    if probability is None or loss_given_default is None:
        return None
    if not 0 <= probability <= 1 or not 0 <= loss_given_default <= 1:
        raise ValueError("PD and LGD must be fractions from 0 to 1")
    return exposure.ead * probability * loss_given_default


def aggregate(exposures: list[Exposure], entity_ids: set[str] | None = None) -> dict:
    unique = {item.exposure_id: item for item in exposures if entity_ids is None or item.entity_id in entity_ids}
    values = list(unique.values())
    ecl = [expected_loss(item) for item in values]
    return {"ead": round(sum(item.ead for item in values), 4),
            "ecl": round(sum(ecl), 4) if all(value is not None for value in ecl) else None,
            "exposure_count": len(values), "synthetic": all(item.synthetic for item in values) if values else False,
            "missing_pd_lgd": [item.exposure_id for item in values if expected_loss(item) is None]}
