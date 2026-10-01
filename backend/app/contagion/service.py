from __future__ import annotations

from math import prod
from datetime import date

from app.graph.repository import MemoryGraphRepository
from app.scoring.engine import confidence_score, relationship_score


def transmission_paths(graph: MemoryGraphRepository, trigger_id: str, max_depth: int, trigger_stress: float, confidence_threshold: float = 0, relationship_codes: set[str] | None = None, as_of: date | None = None) -> list[dict]:
    paths = []
    for row in graph.connections(trigger_id, max_depth, as_of):
        target = row["entity"]["canonical_entity_id"]
        for path in graph.paths(trigger_id, target, max_depth, as_of):
            edges = [graph.relationships[id] for id in path["relationship_ids"]]
            if any(edge.review_status not in ("APPROVED", "DEMO") for edge in edges):
                continue
            if relationship_codes and any(edge.relationship_code not in relationship_codes for edge in edges):
                continue
            if any(edge.relationship_code.startswith("A-") for edge in edges):
                continue
            if any(not edge.parameter_ratings for edge in edges):
                continue
            confidence = prod(confidence_score(edge.source_quality, edge.data_freshness, edge.verification_status) / 100 for edge in edges)
            if confidence * 100 < confidence_threshold:
                continue
            # Path strength compounds through each edge. Direct path reduces to
            # the methodology's Relationship Score × Stress × Confidence / 100.
            strength = prod(relationship_score(edge)["score"] / 100 for edge in edges)
            score = 100 * strength * trigger_stress / 100 * confidence
            paths.append({**path, "target_entity_id": target, "transmission_score": round(score, 4),
                          "path_confidence": round(confidence * 100, 4)})
    return sorted(paths, key=lambda row: (-row["transmission_score"], row["target_entity_id"]))
