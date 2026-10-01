from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String, Text, create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.configuration.registry import methodology


class Base(DeclarativeBase):
    pass


class ConfigurationVersion(Base):
    __tablename__ = "configuration_versions"
    version: Mapped[str] = mapped_column(String(40), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    approver: Mapped[str] = mapped_column(String(200), nullable=False)
    effective_date: Mapped[str] = mapped_column(String(20), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AuditRecord(Base):
    __tablename__ = "audit_records"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    object_id: Mapped[str] = mapped_column(String(200), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class RiskRun(Base):
    __tablename__ = "risk_runs"
    fingerprint: Mapped[str] = mapped_column(String(64), primary_key=True)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    result: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ExposureRecord(Base):
    __tablename__ = "exposure_records"
    exposure_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class RiskInputRecord(Base):
    __tablename__ = "risk_input_records"
    entity_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class ManufacturedDetail(Base):
    __tablename__ = "counterparty_details"
    entity_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    batch_id: Mapped[str] = mapped_column(String(50), index=True)
    company: Mapped[dict] = mapped_column(JSON)
    risk_profile: Mapped[str | None] = mapped_column(String(30))
    generated_at: Mapped[str] = mapped_column(String(40))
    methodology_version: Mapped[str | None] = mapped_column(String(40))
    provenance: Mapped[str | None] = mapped_column(String(30))
    synthetic_data: Mapped[bool] = mapped_column(default=True)


class ManufacturedExposure(Base):
    __tablename__ = "exposure"
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), primary_key=True)
    exposure: Mapped[dict] = mapped_column(JSON)
    funded_exposure: Mapped[dict | None] = mapped_column(JSON)
    unfunded_exposure: Mapped[dict | None] = mapped_column(JSON)
    potential_future_exposure: Mapped[dict | None] = mapped_column(JSON)
    net_exposure: Mapped[dict | None] = mapped_column(JSON)
    related_exposure: Mapped[dict | None] = mapped_column(JSON)
    related_exposures: Mapped[list | None] = mapped_column(JSON)


class ManufacturedExposureBreakdown(Base):
    __tablename__ = "exposure_breakdown"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), index=True)
    item: Mapped[dict] = mapped_column(JSON)


class ManufacturedAssetsRecovery(Base):
    __tablename__ = "assets_recovery"
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), primary_key=True)
    collateral: Mapped[dict | None] = mapped_column(JSON)
    collateral_market_value: Mapped[dict | None] = mapped_column(JSON)
    collateral_haircut: Mapped[float | None] = mapped_column(Float)
    recovery: Mapped[dict | None] = mapped_column(JSON)
    estimated_recovery: Mapped[dict | None] = mapped_column(JSON)
    guarantees: Mapped[list | None] = mapped_column(JSON)


class ManufacturedAsset(Base):
    __tablename__ = "assets"
    asset_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), index=True)
    item: Mapped[dict] = mapped_column(JSON)


class ManufacturedEarlyWarning(Base):
    __tablename__ = "early_warning"
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), primary_key=True)
    early_warnings: Mapped[list | None] = mapped_column(JSON)
    previous_inputs: Mapped[dict | None] = mapped_column(JSON)


class ManufacturedEarlyWarningIndicator(Base):
    __tablename__ = "early_warning_indicators"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), index=True)
    item: Mapped[dict] = mapped_column(JSON)


class ManufacturedContagion(Base):
    __tablename__ = "contagion_risk"
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), primary_key=True)
    network_risk_score: Mapped[float | None] = mapped_column(Float)


class ManufacturedRisk(Base):
    __tablename__ = "risk_assessments"
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), primary_key=True)
    risk: Mapped[dict] = mapped_column(JSON)
    risk_inputs: Mapped[dict] = mapped_column(JSON)
    metrics: Mapped[dict | None] = mapped_column(JSON)
    category_scores: Mapped[dict | None] = mapped_column(JSON)
    risks: Mapped[list | None] = mapped_column(JSON)
    risk_drivers: Mapped[list | None] = mapped_column(JSON)
    category_model_version: Mapped[str | None] = mapped_column(String(40))
    expected_credit_loss: Mapped[float | None] = mapped_column(Float)


class ManufacturedOtherInfo(Base):
    __tablename__ = "other_info"
    entity_id: Mapped[str] = mapped_column(ForeignKey("counterparty_details.entity_id"), primary_key=True)
    evidence: Mapped[list | None] = mapped_column(JSON)
    actions: Mapped[list | None] = mapped_column(JSON)


class WorkflowAction(Base):
    __tablename__ = "workflow_actions"
    action_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    owner_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def database_engine():
    default_path = Path(__file__).resolve().parents[2] / "data" / "demo.sqlite3"
    default_path.parent.mkdir(exist_ok=True)
    return create_engine(os.getenv("DATABASE_URL", f"sqlite:///{default_path.as_posix()}"), pool_pre_ping=True)


class MetadataStore:
    def __init__(self, engine=None):
        self.engine = engine or database_engine()
        Base.metadata.create_all(self.engine)
        self.publish_reference()

    def publish_reference(self):
        config = methodology()
        with Session(self.engine) as session:
            current = session.get(ConfigurationVersion, config["version"])
            payload = json.dumps(config, sort_keys=True)
            if current and current.payload != payload:
                raise ValueError("Published methodology versions are immutable")
            if current is None:
                session.add(ConfigurationVersion(version=config["version"], status="PUBLISHED",
                                                 approver=config["approver"], effective_date=config["effective_date"], payload=payload))
                session.commit()

    def audit(self, actor: str, action: str, object_id: str, payload: dict):
        with Session(self.engine) as session:
            session.add(AuditRecord(actor=actor, action=action, object_id=object_id, payload=json.dumps(payload, default=str)))
            session.commit()

    def get_risk_run(self, fingerprint: str) -> dict | None:
        with Session(self.engine) as session:
            row = session.get(RiskRun, fingerprint)
            return json.loads(row.result) if row else None

    def save_risk_run(self, fingerprint: str, entity_id: str, result: dict):
        with Session(self.engine) as session:
            try:
                session.add(RiskRun(fingerprint=fingerprint, entity_id=entity_id, result=json.dumps(result)))
                session.commit()
                return result
            except IntegrityError:
                session.rollback()
                existing = self.get_risk_run(fingerprint)
                if existing is None:
                    raise
                return existing

    def save_exposure(self, exposure):
        with Session(self.engine) as session:
            session.merge(ExposureRecord(exposure_id=exposure.exposure_id, payload=exposure.model_dump_json()))
            session.commit()

    def exposures(self):
        from app.models import Exposure
        with Session(self.engine) as session:
            return [Exposure.model_validate_json(row.payload) for row in session.scalars(select(ExposureRecord)).all()]

    def save_risk_inputs(self, entity_id: str, inputs):
        with Session(self.engine) as session:
            session.merge(RiskInputRecord(entity_id=entity_id, payload=inputs.model_dump_json()))
            session.commit()

    def risk_inputs(self):
        from app.models import ScoreInputs
        with Session(self.engine) as session:
            return {row.entity_id: ScoreInputs.model_validate_json(row.payload) for row in session.scalars(select(RiskInputRecord)).all()}

    def save_manufactured_batch(self, batch_id: str, records: list[dict]) -> None:
        with Session(self.engine) as session:
            for record in records:
                entity_id = record["entity"]["canonical_entity_id"]
                session.add(ManufacturedDetail(entity_id=entity_id, batch_id=batch_id, company=record["company"],
                    risk_profile=record.get("risk_profile"), generated_at=record["generated_at"],
                    methodology_version=record.get("methodology_version"), provenance=record.get("provenance"),
                    synthetic_data=record.get("synthetic_data", True)))
                session.flush()  # PostgreSQL must see the parent before foreign-key child rows.
                session.add(ManufacturedExposure(entity_id=entity_id, **{key: record.get(key) for key in (
                    "exposure", "funded_exposure", "unfunded_exposure", "potential_future_exposure",
                    "net_exposure", "related_exposure", "related_exposures")}))
                session.add(ManufacturedAssetsRecovery(entity_id=entity_id, **{key: record.get(key) for key in (
                    "collateral", "collateral_market_value", "collateral_haircut", "recovery",
                    "estimated_recovery", "guarantees")}))
                session.add(ManufacturedEarlyWarning(entity_id=entity_id, early_warnings=record.get("early_warnings"),
                    previous_inputs=record.get("early_warning_previous_inputs")))
                session.add(ManufacturedContagion(entity_id=entity_id, network_risk_score=record.get("network_risk_score")))
                session.add(ManufacturedRisk(entity_id=entity_id, **{key: record.get(key) for key in (
                    "risk", "risk_inputs", "metrics", "category_scores", "risks", "risk_drivers",
                    "category_model_version", "expected_credit_loss")}))
                session.add(ManufacturedOtherInfo(entity_id=entity_id, evidence=record.get("evidence"),
                    actions=record.get("actions")))
                session.add_all(ManufacturedAsset(asset_id=item["id"], entity_id=entity_id, item=item)
                                for item in record.get("assets", []))
                session.add_all(ManufacturedExposureBreakdown(entity_id=entity_id, item=item)
                                for item in record.get("exposure_breakdown", []))
                session.add_all(ManufacturedEarlyWarningIndicator(entity_id=entity_id, item=item)
                                for item in record.get("early_warning_indicators", []))
            session.commit()

    def manufactured_section(self, entity_id: str, section: str) -> dict | None:
        """Read one approved section without loading other counterparty data."""
        models = {"counterparty": ManufacturedDetail, "exposure": ManufacturedExposure,
                  "assets_recovery": ManufacturedAssetsRecovery, "early_warning": ManufacturedEarlyWarning,
                  "contagion": ManufacturedContagion, "risk": ManufacturedRisk,
                  "other": ManufacturedOtherInfo}
        model = models.get(section)
        if model is None:
            raise ValueError("Unknown manufactured section")
        with Session(self.engine) as session:
            row = session.get(model, entity_id)
            if row is None:
                return None
            result = {column.name: getattr(row, column.name) for column in model.__table__.columns}
            if section == "exposure":
                result["exposure_breakdown"] = [item.item for item in session.scalars(select(ManufacturedExposureBreakdown).where(ManufacturedExposureBreakdown.entity_id == entity_id).order_by(ManufacturedExposureBreakdown.id))]
            elif section == "assets_recovery":
                result["assets"] = [item.item for item in session.scalars(select(ManufacturedAsset).where(ManufacturedAsset.entity_id == entity_id).order_by(ManufacturedAsset.asset_id))]
            elif section == "early_warning":
                result["early_warning_indicators"] = [item.item for item in session.scalars(select(ManufacturedEarlyWarningIndicator).where(ManufacturedEarlyWarningIndicator.entity_id == entity_id).order_by(ManufacturedEarlyWarningIndicator.id))]
                result["early_warning_previous_inputs"] = result.pop("previous_inputs")
            return result

    def manufactured_counterparties(self) -> list[dict]:
        with Session(self.engine) as session:
            details = session.scalars(select(ManufacturedDetail).order_by(ManufacturedDetail.generated_at.desc())).all()
            records = {row.entity_id: {"batch_id": row.batch_id,
                       "entity": {"canonical_entity_id": row.entity_id}, "company": row.company,
                       "risk_profile": row.risk_profile, "generated_at": row.generated_at,
                       "methodology_version": row.methodology_version, "provenance": row.provenance,
                       "synthetic_data": row.synthetic_data} for row in details}
            for model in (ManufacturedExposure, ManufacturedAssetsRecovery, ManufacturedEarlyWarning,
                          ManufacturedContagion, ManufacturedRisk, ManufacturedOtherInfo):
                for row in session.scalars(select(model)):
                    data = {column.name: getattr(row, column.name) for column in model.__table__.columns
                            if column.name != "entity_id"}
                    if model is ManufacturedEarlyWarning:
                        data["early_warning_previous_inputs"] = data.pop("previous_inputs")
                    records[row.entity_id].update(data)
            for model, key in ((ManufacturedExposureBreakdown, "exposure_breakdown"),
                               (ManufacturedAsset, "assets"),
                               (ManufacturedEarlyWarningIndicator, "early_warning_indicators")):
                for row in session.scalars(select(model).order_by(model.id if hasattr(model, "id") else model.asset_id)):
                    records[row.entity_id].setdefault(key, []).append(row.item)
            for record in records.values():
                for key in ("exposure_breakdown", "assets", "early_warning_indicators"):
                    record.setdefault(key, [])
            return list(records.values())

    def manufactured_index(self) -> list[dict]:
        with Session(self.engine) as session:
            return [{"entity_id": row.entity_id, "name": row.company.get("name", "")}
                    for row in session.scalars(select(ManufacturedDetail))]

    def save_action(self, action: dict):
        with Session(self.engine) as session:
            session.merge(WorkflowAction(action_id=action["action_id"], entity_id=action["entity_id"],
                                         owner_id=action.get("owner_id"), status=action["status"],
                                         payload=json.dumps(action), updated_at=datetime.now(timezone.utc)))
            session.commit()

    def actions(self, entity_id: str | None = None) -> list[dict]:
        with Session(self.engine) as session:
            query = select(WorkflowAction)
            if entity_id:
                query = query.where(WorkflowAction.entity_id == entity_id)
            return [json.loads(row.payload) for row in session.scalars(query).all()]

    def audit_records(self, limit: int = 100) -> list[dict]:
        with Session(self.engine) as session:
            rows = session.scalars(select(AuditRecord).order_by(AuditRecord.id.desc()).limit(limit)).all()
            return [{"id": row.id, "actor": row.actor, "action": row.action, "object_id": row.object_id,
                     "payload": json.loads(row.payload), "created_at": row.created_at.isoformat()} for row in rows]
