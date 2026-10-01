from __future__ import annotations

import json
from abc import ABC, abstractmethod
from hashlib import sha256
from typing import Any

from app.models import SourceRecord


class EntityResolutionProvider(ABC):
    @abstractmethod
    def add_or_update_record(self, record: SourceRecord) -> dict: ...

    @abstractmethod
    def resolve_records(self, records: list[SourceRecord]) -> list[dict]: ...

    @abstractmethod
    def get_entity(self, entity_id: str) -> dict | None: ...

    @abstractmethod
    def get_entity_records(self, entity_id: str) -> list[dict]: ...

    @abstractmethod
    def get_related_entities(self, entity_id: str) -> list[dict]: ...

    @abstractmethod
    def explain_match(self, source: tuple[str, str], target: tuple[str, str]) -> dict: ...

    @abstractmethod
    def explain_non_match(self, source: tuple[str, str], target: tuple[str, str]) -> dict: ...

    @abstractmethod
    def health_check(self) -> dict: ...


class MockEntityResolutionProvider(EntityResolutionProvider):
    def __init__(self):
        self.records: dict[tuple[str, str], SourceRecord] = {}
        self.record_entities: dict[tuple[str, str], str] = {}

    def _entity_id(self, record: SourceRecord) -> str:
        # Deterministic fixture matching. Name-only matches are deliberately
        # excluded because they are unsafe for production identity resolution.
        key = (record.lei or (f"{record.country}:{record.registration_number}" if record.registration_number else f"{record.source_system}:{record.source_record_id}")).casefold()
        return "MOCK-" + sha256(key.encode()).hexdigest()[:16]

    def add_or_update_record(self, record: SourceRecord) -> dict:
        key = (record.source_system, record.source_record_id)
        entity_id = self._entity_id(record)
        self.records[key] = record
        self.record_entities[key] = entity_id
        matched_on = "LEI" if record.lei else "registration" if record.registration_number else "source_record"
        return {"canonical_entity_id": entity_id, "senzing_entity_id": None,
                "match_outcome": "MOCK_IDENTIFIER_MATCH" if matched_on != "source_record" else "MOCK_RECORD_ONLY", "provider": "mock", "provider_evidence": {"matched_on": matched_on},
                "provider_confidence": None}

    def resolve_records(self, records: list[SourceRecord]) -> list[dict]:
        return [self.add_or_update_record(record) for record in records]

    def get_entity(self, entity_id: str) -> dict | None:
        records = self.get_entity_records(entity_id)
        return {"entity_id": entity_id, "records": records} if records else None

    def get_entity_records(self, entity_id: str) -> list[dict]:
        return [record.model_dump(mode="json") for key, record in self.records.items() if self.record_entities[key] == entity_id]

    def get_related_entities(self, entity_id: str) -> list[dict]:
        return []

    def explain_match(self, source: tuple[str, str], target: tuple[str, str]) -> dict:
        same = self.record_entities.get(source) == self.record_entities.get(target) and source in self.record_entities and target in self.record_entities
        return {"matched": same, "provider": "mock", "evidence": "same canonical identifier" if same else "no deterministic identifier match"}

    def explain_non_match(self, source: tuple[str, str], target: tuple[str, str]) -> dict:
        result = self.explain_match(source, target)
        return {**result, "non_match": not result["matched"]}

    def health_check(self) -> dict:
        return {"provider": "mock", "status": "ok"}


class SenzingEntityResolutionProvider(EntityResolutionProvider):
    """Adapter for an injected Senzing v4 SzEngine instance.

    The caller owns SDK installation, licensed engine initialization and source
    registration. Only documented v4 methods are used here.
    """

    def __init__(self, engine: Any, source_mappings: dict[str, dict[str, str]] | None = None):
        self.engine = engine
        self.source_mappings = source_mappings or {}
        self.record_entities: dict[tuple[str, str], str] = {}

    def _mapped_record(self, record: SourceRecord) -> dict:
        mapping = self.source_mappings.get(record.source_system, {})
        result = {"DATA_SOURCE": record.source_system, "RECORD_ID": record.source_record_id,
                  "NAME_FULL": record.legal_name}
        if record.lei:
            result["LEI"] = record.lei
        if record.registration_number:
            result["REGISTRATION_NUMBER"] = record.registration_number
        if record.country:
            result["COUNTRY"] = record.country
        for source_field, senzing_field in mapping.items():
            if source_field in record.attributes:
                result[senzing_field] = record.attributes[source_field]
        return result

    def add_or_update_record(self, record: SourceRecord) -> dict:
        payload = self._mapped_record(record)
        self.engine.add_record(record.source_system, record.source_record_id, json.dumps(payload))
        raw = json.loads(self.engine.get_entity_by_record_id(record.source_system, record.source_record_id))
        resolved = raw["RESOLVED_ENTITY"]
        entity_id = str(resolved["ENTITY_ID"])
        self.record_entities[(record.source_system, record.source_record_id)] = entity_id
        own_record = next((item for item in resolved.get("RECORDS", []) if item.get("DATA_SOURCE") == record.source_system and str(item.get("RECORD_ID")) == record.source_record_id), {})
        return {"canonical_entity_id": f"SZ-{entity_id}", "senzing_entity_id": entity_id,
                "match_outcome": own_record.get("MATCH_LEVEL_CODE", "RESOLVED"), "provider": "senzing-v4",
                "provider_evidence": {"match_key": own_record.get("MATCH_KEY"), "rule_code": own_record.get("ERRULE_CODE")},
                "provider_confidence": None}

    def resolve_records(self, records: list[SourceRecord]) -> list[dict]:
        return [self.add_or_update_record(record) for record in records]

    def get_entity(self, entity_id: str) -> dict | None:
        return json.loads(self.engine.get_entity_by_entity_id(int(entity_id.removeprefix("SZ-"))))

    def get_entity_records(self, entity_id: str) -> list[dict]:
        return self.get_entity(entity_id)["RESOLVED_ENTITY"].get("RECORDS", [])

    def get_related_entities(self, entity_id: str) -> list[dict]:
        return self.get_entity(entity_id).get("RELATED_ENTITIES", [])

    def explain_match(self, source: tuple[str, str], target: tuple[str, str]) -> dict:
        left = self.record_entities.get(source)
        right = self.record_entities.get(target)
        return {"matched": bool(left and left == right), "provider": "senzing-v4",
                "left_entity_id": left, "right_entity_id": right,
                "provider_evidence": self.get_entity(f"SZ-{left}") if left and left == right else None}

    def explain_non_match(self, source: tuple[str, str], target: tuple[str, str]) -> dict:
        result = self.explain_match(source, target)
        return {**result, "non_match": not result["matched"]}

    def health_check(self) -> dict:
        return {"provider": "senzing-v4", "status": "configured" if self.engine else "unavailable"}
