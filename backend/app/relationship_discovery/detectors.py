from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.configuration.registry import taxonomy


@dataclass
class RelationshipCandidate:
    relationship_code: str
    source_entity_id: str
    target_entity_id: str
    direction: str
    evidence_ids: list[str]
    calculation_inputs: dict[str, float]
    confidence_inputs: dict[str, float]
    observation_window: tuple[str | None, str | None]
    explanation: str
    detector_version: str = "1.0.0"
    evidence_only: bool = False


@dataclass
class DetectionContext:
    assertions: list[dict]


class RelationshipDetector(Protocol):
    code: str
    enabled: bool
    def detect(self, context: DetectionContext) -> list[RelationshipCandidate]: ...


@dataclass
class AssertionDetector:
    """Conservative detector: emits only source-asserted, evidenced links."""
    code: str
    enabled: bool = True

    def detect(self, context: DetectionContext) -> list[RelationshipCandidate]:
        if not self.enabled:
            return []
        result = []
        for item in context.assertions:
            if item.get("relationship_code") != self.code or not item.get("evidence_ids"):
                continue
            result.append(RelationshipCandidate(
                relationship_code=self.code,
                source_entity_id=item["source_entity_id"], target_entity_id=item["target_entity_id"],
                direction=item.get("direction", "direct"), evidence_ids=list(dict.fromkeys(item["evidence_ids"])),
                calculation_inputs=item.get("calculation_inputs", {}),
                confidence_inputs=item.get("confidence_inputs", {}),
                observation_window=(item.get("window_start"), item.get("window_end")),
                explanation=item.get("explanation", "Source asserted relationship; analyst review required."),
                evidence_only=self.code.startswith("A-"),
            ))
        return result


def detector_registry(enabled: dict[str, bool] | None = None) -> dict[str, AssertionDetector]:
    enabled = enabled or {}
    return {entry["ID"]: AssertionDetector(entry["ID"], enabled.get(entry["ID"], True))
            for entry in taxonomy()["relationships"]}
