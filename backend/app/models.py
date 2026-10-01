from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SourceRecord(BaseModel):
    source_system: str
    source_record_id: str
    legal_name: str
    lei: str | None = None
    registration_number: str | None = None
    country: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    classification: Literal["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] = "INTERNAL"
    observed_at: datetime = Field(default_factory=utc_now)

    @field_validator("attributes")
    @classmethod
    def reject_sensitive_keys(cls, value: dict[str, Any]) -> dict[str, Any]:
        blocked = ("tax", "account_number", "email", "phone", "device", "ip_address", "ipaddress", "pan_number")
        if any(any(secret in key.lower() for secret in blocked) for key in value):
            raise ValueError("Sensitive identifiers must be tokenised before ingestion")
        return value


class CanonicalEntity(BaseModel):
    canonical_entity_id: str
    legal_name: str
    entity_type: str = "LegalEntity"
    senzing_entity_id: str | None = None
    aliases: list[str] = Field(default_factory=list)
    lei: str | None = None
    registration_number: str | None = None
    country: str | None = None
    industry: str | None = None
    group_ids: list[str] = Field(default_factory=list)
    primary_group_id: str | None = None
    status: str = "ACTIVE"
    source_record_ids: list[str] = Field(default_factory=list)
    entity_resolution_confidence: float | None = Field(default=None, ge=0, le=100)
    data_classification: str = "INTERNAL"
    provenance: str = "DEMO"
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Evidence(BaseModel):
    evidence_id: str
    source_system: str
    source_record_id: str
    observed_at: datetime
    description: str
    confidence: float = Field(ge=0, le=100)
    classification: str = "INTERNAL"


class Relationship(BaseModel):
    relationship_id: str
    relationship_code: str
    relationship_category: str | None = None
    relationship_type: str | None = None
    source_entity_id: str
    target_entity_id: str
    direction: str = "direct"
    level_type: Literal["LEVEL_1", "LEVEL_2", "ANCILLARY"]
    parameter_ratings: dict[str, int] = Field(default_factory=dict)
    parameter_values: dict[str, float] = Field(default_factory=dict)
    evidence_ids: list[str] = Field(default_factory=list)
    data_sources: list[str] = Field(default_factory=list)
    source_quality: float = Field(default=0, ge=0, le=100)
    data_freshness: float = Field(default=0, ge=0, le=100)
    verification_status: float = Field(default=0, ge=0, le=100)
    effective_from: date | None = None
    effective_to: date | None = None
    observation_window_start: date | None = None
    observation_window_end: date | None = None
    methodology_version: str = "1.1.0"
    review_status: str = "UNREVIEWED"
    calculation_run_id: str | None = None
    dependency_key: str | None = None
    provenance: str = "DEMO"

    @model_validator(mode="after")
    def valid_dates(self):
        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValueError("effective_from is after effective_to")
        return self


class Exposure(BaseModel):
    exposure_id: str
    entity_id: str
    ead: float = Field(ge=0)
    pd: float | None = Field(default=None, ge=0, le=1)
    lgd: float | None = Field(default=None, ge=0, le=1)
    ccf: float | None = Field(default=None, ge=0, le=1)
    currency: str = "INR"
    group_id: str | None = None
    product: str | None = None
    source_record_id: str | None = None
    synthetic: bool = False


class Facility(BaseModel):
    facility_id: str
    entity_id: str
    product: str
    outstanding: float = Field(ge=0)
    undrawn: float = Field(default=0, ge=0)
    ccf: float | None = Field(default=None, ge=0, le=1)
    approved_limit: float | None = Field(default=None, ge=0)
    funded: bool = True
    synthetic: bool = False


class ScoreInputs(BaseModel):
    provenance: Literal["DEMO", "OBSERVED", "MODEL_OUTPUT", "ANALYST_JUDGMENT"] = "ANALYST_JUDGMENT"
    standalone: float = Field(ge=0, le=100)
    concentration: float = Field(ge=0, le=100)
    event: float = Field(ge=0, le=100)
    connected_stress: dict[str, tuple[float, float, float]] = Field(default_factory=dict)
    no_connections_verified: bool = False
    applicable_limit: float | None = Field(default=None, gt=0)
    direct_relationship_score: float | None = Field(default=None, ge=0, le=100)
    indirect_relationship_score: float | None = Field(default=None, ge=0, le=100)
    relationship_diversity_score: float | None = Field(default=None, ge=0, le=100)
    exposure_concentration_score: float | None = Field(default=None, ge=0, le=100)
    connected_entity_stress_score: float | None = Field(default=None, ge=0, le=100)
    evidence_ids: list[str] = Field(default_factory=list)
    source_timestamps: dict[str, datetime] = Field(default_factory=dict)
    approved_by: str | None = None

    @model_validator(mode="after")
    def require_approved_lineage(self):
        if self.provenance != "DEMO" and (not self.approved_by or not self.evidence_ids or not self.source_timestamps):
            raise ValueError("Non-demo risk inputs require approver, evidence IDs, and source timestamps")
        if self.provenance != "DEMO" and self.applicable_limit is None:
            raise ValueError("Non-demo risk inputs require an approved applicable limit")
        return self
