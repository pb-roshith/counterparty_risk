from __future__ import annotations

from datetime import datetime, timezone

from app.data_quality.checks import assess_record
from app.entity_resolution.providers import EntityResolutionProvider
from app.graph.repository import MemoryGraphRepository
from app.models import CanonicalEntity, SourceRecord


def ingest(records: list[SourceRecord], resolver: EntityResolutionProvider, graph: MemoryGraphRepository) -> list[dict]:
    outcomes = []
    for record in records:
        quality = assess_record(record)
        if not quality["accepted"]:
            outcomes.append({"source_system": record.source_system, "source_record_id": record.source_record_id,
                             "reconciliation_status": "REJECTED", "quality": quality})
            continue
        resolution = resolver.add_or_update_record(record)
        entity_id = resolution["canonical_entity_id"]
        current = graph.entities.get(entity_id)
        source_ref = f"{record.source_system}:{record.source_record_id}"
        entity = CanonicalEntity(
            canonical_entity_id=entity_id, senzing_entity_id=resolution["senzing_entity_id"],
            legal_name=current.legal_name if current else record.legal_name,
            aliases=sorted(set((current.aliases if current else []) + [record.legal_name])),
            lei=record.lei or (current.lei if current else None),
            registration_number=record.registration_number or (current.registration_number if current else None),
            country=record.country or (current.country if current else None),
            source_record_ids=sorted(set((current.source_record_ids if current else []) + [source_ref])),
            data_classification=record.classification, provenance="OBSERVED",
            created_at=current.created_at if current else datetime.now(timezone.utc),
        )
        graph.upsert_entity(entity)
        graph.link_source_record(record.source_system, record.source_record_id, entity_id)
        outcomes.append({"source_system": record.source_system, "source_record_id": record.source_record_id,
                         "canonical_entity_id": entity_id, "senzing_entity_id": resolution["senzing_entity_id"],
                         "match_outcome": resolution["match_outcome"],
                         "provider_evidence": resolution["provider_evidence"],
                         "provider_confidence": resolution["provider_confidence"],
                         "provider": resolution["provider"], "quality": quality,
                         "processed_at": datetime.now(timezone.utc).isoformat(),
                         "reconciliation_status": "MATCHED"})
    return outcomes
