from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).parent


@lru_cache
def methodology() -> dict:
    data = json.loads((ROOT / "methodology_v1.json").read_text(encoding="utf-8"))
    if data["status"] != "published" or not data["approver"] or not data["effective_date"]:
        raise ValueError("Methodology must be approved, effective and published")
    for item in data["relationships"]:
        if abs(sum(p["weight"] for p in item["parameters"]) - 1) > 1e-9:
            raise ValueError(f"Invalid parameter weights for {item['code']}")
    for group in ("stress_weights", "confidence_weights", "final_weights", "connectivity_weights", "contagion_weights", "committee_weights", "scenario_severity_weights"):
        if abs(sum(data[group].values()) - 1) > 1e-9:
            raise ValueError(f"Invalid {group}")
    for group in ("relationship_bands", "final_bands"):
        if [row[0] for row in data[group]] != [0, 20, 40, 60, 80]:
            raise ValueError("Risk bands have gaps or overlaps")
    if abs(sum(data["early_warning"]["sector_stress_weights"].values()) - 1) > 1e-9:
        raise ValueError("Invalid sector stress weights")
    return data


@lru_cache
def taxonomy() -> dict:
    data = json.loads((ROOT / "taxonomy_v0_1.json").read_text(encoding="utf-8"))
    codes = [entry["ID"] for entry in data["relationships"]]
    if len(codes) != 45 or len(set(codes)) != 45:
        raise ValueError("Incomplete or duplicate taxonomy")
    if set(codes[:25]) != {entry["code"] for entry in methodology()["relationships"]}:
        raise ValueError("Methodology and taxonomy codes differ")
    return data


def relationship_definition(code: str) -> dict:
    for item in methodology()["relationships"]:
        if item["code"] == code:
            return item
    raise KeyError(code)
