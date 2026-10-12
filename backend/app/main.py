from __future__ import annotations

import os
import hashlib
import json
import httpx
from mistralai.client.errors.sdkerror import SDKError
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.configuration.registry import methodology, relationship_definition, taxonomy
from app.copilot.providers import MistralProvider, MockLLMProvider, grounded_answer
from app.copilot.rag import resolve_entity
from app.copilot.agent import answer_with_tools
from app.early_warning.service import sector_stress, turnover_drop
from app.entity_resolution.providers import EntityResolutionProvider, MockEntityResolutionProvider, SenzingEntityResolutionProvider
from app.exposure.service import aggregate, facility_ead, utilization
from app.graph.repository import MemoryGraphRepository, Neo4jGraphRepository
from app.ingestion.pipeline import ingest
from app.metadata.store import MetadataStore
from app.manufacture_data.manufacturing import generate_counterparties
from app.models import CanonicalEntity, Evidence, Exposure, Facility, Relationship, ScoreInputs, SourceRecord
from app.relationship_discovery.detectors import DetectionContext, detector_registry
from app.scoring.engine import calculate_counterparty, confidence_score, parent_subsidiary_measures, relationship_score, suggest_parameter_rating
from app.scoring.insights import committee_score, connectivity_score, contagion_score
from app.security.access import require_write_access
from app.manufacture_data.synthetic_model import assess_demo_profile
from app.reports import AGENTS, SECTION_FIELDS, render_pdf

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


@dataclass
class Services:
    graph: MemoryGraphRepository
    neo4j: Neo4jGraphRepository | None
    resolver: EntityResolutionProvider
    metadata: MetadataStore
    exposures: list[Exposure]
    risk_inputs: dict[str, ScoreInputs]


def load_manufactured_record(graph: MemoryGraphRepository, exposures: list[Exposure],
                             risk_inputs: dict[str, ScoreInputs], record: dict) -> None:
    if record["entity"].get("legal_name"):
        graph.upsert_entity(CanonicalEntity.model_validate(record["entity"]))
    if record.get("related_entity"):
        graph.upsert_entity(CanonicalEntity.model_validate(record["related_entity"]))
    for payload in record.get("related_entities", []):
        graph.upsert_entity(CanonicalEntity.model_validate(payload))
    if record.get("evidence_record"):
        graph.upsert_evidence(Evidence.model_validate(record["evidence_record"]))
    for payload in record.get("evidence_records", []):
        graph.upsert_evidence(Evidence.model_validate(payload))
    if record.get("relationship"):
        graph.upsert_relationship(Relationship.model_validate(record["relationship"]))
    for payload in record.get("graph_relationships", []):
        graph.upsert_relationship(Relationship.model_validate(payload))
    for payload in (record["exposure"], record.get("related_exposure"), *record.get("related_exposures", [])):
        if payload:
            exposure = Exposure.model_validate(payload)
            if not any(item.exposure_id == exposure.exposure_id for item in exposures):
                exposures.append(exposure)
    risk_inputs[record["entity"]["canonical_entity_id"]] = ScoreInputs.model_validate(record["risk_inputs"])


def persist_manufactured_graph(neo4j: Neo4jGraphRepository, record: dict) -> None:
    for entity_data in [record["entity"], *([record["related_entity"]] if record.get("related_entity") else []),
                        *record.get("related_entities", [])]:
        neo4j.upsert_entity(CanonicalEntity.model_validate(entity_data))
    for evidence_data in [*([record["evidence_record"]] if record.get("evidence_record") else []),
                          *record.get("evidence_records", [])]:
        neo4j.upsert_evidence(Evidence.model_validate(evidence_data))
    for relationship_data in [*([record["relationship"]] if record.get("relationship") else []),
                              *record.get("graph_relationships", [])]:
        neo4j.upsert_relationship(Relationship.model_validate(relationship_data))
    neo4j.save_manufactured_view(record)


@asynccontextmanager
async def lifespan(app: FastAPI):
    metadata = MetadataStore()
    neo4j = None
    if os.getenv("NEO4J_URI"):
        neo4j = Neo4jGraphRepository(os.environ["NEO4J_URI"], os.environ["NEO4J_USER"], os.environ["NEO4J_PASSWORD"])
        neo4j.health_check()
        neo4j.bootstrap()
        graph = neo4j.load_graph()
        exposures, risk_inputs = [], {}
    else:
        graph = MemoryGraphRepository()
        exposures, risk_inputs = [], {}
    # Rebuild the in-memory graph from the current manufactured rows at startup.
    for record in metadata.manufactured_counterparties():
        load_manufactured_record(graph, exposures, risk_inputs, record)
    if os.getenv("SENZING_PROVIDER", "mock") == "senzing":
        from senzing_core import SzAbstractFactoryCore
        config_json = os.environ["SENZING_ENGINE_CONFIGURATION_JSON"]
        mappings = json.loads(os.getenv("SENZING_SOURCE_MAPPINGS_JSON", "{}"))
        resolver = SenzingEntityResolutionProvider(SzAbstractFactoryCore("CounterpartyRisk", config_json).create_engine(), mappings)
    else:
        resolver = MockEntityResolutionProvider()
    stored_exposures = metadata.exposures()
    exposure_by_id = {item.exposure_id: item for item in [*exposures, *stored_exposures]}
    app.state.services = Services(graph, neo4j, resolver, metadata,
                                  list(exposure_by_id.values()), {**risk_inputs, **metadata.risk_inputs()})
    yield
    if neo4j:
        neo4j.driver.close()


app = FastAPI(title="Connected Counterparty Risk API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://127.0.0.1:8080,http://localhost:8080").split(","), allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["X-API-Key", "Content-Type"])


def services():
    return app.state.services


def not_found(error: KeyError):
    raise HTTPException(404, f"Unknown identifier: {error.args[0]}") from error


@app.get("/api/health")
def health(s: Services = Depends(services)):
    return {"status": "ok", "mode": "manufactured" if s.graph.entities else "empty", "entity_resolution": s.resolver.health_check(),
            "methodology_version": methodology()["version"]}


@app.get("/api/methodology")
def get_methodology():
    return methodology()


@app.get("/api/taxonomy")
def get_taxonomy():
    return taxonomy()


@app.get("/api/methodology/relationships/{code}")
def get_relationship_definition(code: str):
    try:
        return relationship_definition(code)
    except KeyError as error:
        not_found(error)


@app.get("/api/counterparties")
def counterparties(s: Services = Depends(services)):
    return [entity.model_dump(mode="json") for entity in s.graph.entities.values()]


@app.get("/api/manufactured-counterparties")
def manufactured_counterparties(s: Services = Depends(services)):
    rows = s.metadata.manufactured_counterparties()
    if s.neo4j:
        for row in rows:
            row.update(s.neo4j.manufactured_view(row["entity"]["canonical_entity_id"]))
    return rows


class ReportRequest(BaseModel):
    dossier: dict


@app.post("/api/reports/{section}/pdf")
def generate_report(section: str, payload: ReportRequest):
    if section not in AGENTS:
        raise HTTPException(404, "Unknown report section")
    dossier = payload.dossier
    company = dossier.get("company")
    if not isinstance(company, dict) or not company.get("id") or not company.get("name"):
        raise HTTPException(422, "A counterparty dossier is required")
    facts = {"company": company, **{field: dossier.get(field) for field in SECTION_FIELDS[section]}}
    try:
        narrative = AGENTS[section].generate(facts)
        pdf = render_pdf(section, dossier, narrative)
    except (RuntimeError, httpx.HTTPError, SDKError) as error:
        raise HTTPException(503, f"Report generation unavailable: {error}") from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    filename = f"{section}-{str(company['id']).replace('/', '_')}.pdf"
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


class DemoProfileRequest(BaseModel):
    ead: float = Field(ge=0)
    collateral: float = Field(ge=0)
    revenue: float = Field(gt=0)
    ebitda: float = Field(gt=0)
    assets: float = Field(gt=0)
    liabilities: float = Field(ge=0)
    debt: float = Field(ge=0)
    cash: float = Field(ge=0)
    country: str
    sector: str
    connected_exposure: float = Field(default=0, ge=0)
    dependency_score: float = Field(default=0, ge=0, le=100)
    owner_share: float = Field(default=0, ge=0, le=100)
    supplier_share: float = Field(default=0, ge=0, le=100)
    customer_share: float = Field(default=0, ge=0, le=100)
    relationship_count: int = Field(default=0, ge=0)
    operational_event_count: int = Field(default=0, ge=0)
    legal_event_count: int = Field(default=0, ge=0)
    as_of: str


@app.post("/api/demo/category-assessment")
def demo_category_assessment(payload: DemoProfileRequest):
    return assess_demo_profile(payload.model_dump())


class ManufactureRequest(BaseModel):
    count: int = Field(ge=1, le=1000)


@app.post("/api/manufactured-counterparties/generate")
def manufacture_counterparties(payload: ManufactureRequest, request: Request, s: Services = Depends(services)):
    if not request.client or request.client.host not in ("127.0.0.1", "::1", "testclient"):
        raise HTTPException(403, "Synthetic data generation is limited to local access")
    if s.metadata.engine.dialect.name != "postgresql":
        raise HTTPException(503, "Configure PostgreSQL DATABASE_URL before generating records")
    if not s.neo4j:
        raise HTTPException(503, "Configure Neo4j before generating graph-backed records")
    batch_id, records = generate_counterparties(payload.count)
    for record in records:
        persist_manufactured_graph(s.neo4j, record)
    s.metadata.save_manufactured_batch(batch_id, records)
    for record in records:
        load_manufactured_record(s.graph, s.exposures, s.risk_inputs, record)
    s.metadata.audit("local-user", "manufacture_counterparties", batch_id, {"count": payload.count})
    return {"batch_id": batch_id, "created_count": len(records), "entity_ids": [row["entity"]["canonical_entity_id"] for row in records]}


@app.delete("/api/counterparties/{entity_id}", status_code=204)
def delete_counterparty(entity_id: str, request: Request, s: Services = Depends(services)):
    if not request.client or request.client.host not in ("127.0.0.1", "::1", "testclient"):
        require_write_access(request.headers.get("X-API-Key"))
    if not any(row["entity_id"] == entity_id for row in s.metadata.manufactured_index()):
        raise HTTPException(404, "Counterparty not found")
    if s.neo4j:
        s.neo4j.delete_counterparty(entity_id)
    s.metadata.delete_counterparty(entity_id)
    s.graph.entities.pop(entity_id, None)
    s.graph.relationships = {key: edge for key, edge in s.graph.relationships.items()
                            if entity_id not in (edge.source_entity_id, edge.target_entity_id)}
    s.graph.record_links = {key: value for key, value in s.graph.record_links.items() if value != entity_id}
    s.exposures[:] = [item for item in s.exposures if item.entity_id != entity_id]
    s.risk_inputs.pop(entity_id, None)
    s.metadata.audit("local-user", "delete_counterparty", entity_id, {})
    return Response(status_code=204)


@app.get("/api/counterparties/{entity_id}")
def counterparty(entity_id: str, s: Services = Depends(services)):
    try:
        return s.graph.entities[entity_id]
    except KeyError as error:
        not_found(error)


@app.get("/api/counterparties/{entity_id}/relationships")
def connections(entity_id: str, depth: int = Query(default=2, ge=1, le=4), as_of: date | None = None, s: Services = Depends(services)):
    try:
        return s.graph.connections(entity_id, depth, as_of)
    except KeyError as error:
        not_found(error)


@app.get("/api/paths/{source_id}/{target_id}")
def paths(source_id: str, target_id: str, depth: int = Query(default=2, ge=1, le=4), as_of: date | None = None,
          alternatives: bool = False, s: Services = Depends(services)):
    try:
        return s.graph.paths(source_id, target_id, depth, as_of, alternatives)
    except KeyError as error:
        not_found(error)


@app.get("/api/graph/hubs")
def hubs(s: Services = Depends(services)):
    return s.graph.hubs()


@app.get("/api/relationships")
def list_relationships(code: str | None = None, level_type: str | None = None, source: str | None = None,
                       as_of: date | None = None, min_score: float = Query(default=0, ge=0, le=100),
                       min_confidence: float = Query(default=0, ge=0, le=100),
                       limit: int = Query(default=100, ge=1, le=500), s: Services = Depends(services)):
    result = []
    for edge in s.graph.relationships.values():
        if code and edge.relationship_code != code:
            continue
        if level_type and edge.level_type != level_type:
            continue
        if source and source not in edge.data_sources:
            continue
        if as_of and ((edge.effective_from and as_of < edge.effective_from) or (edge.effective_to and as_of > edge.effective_to)):
            continue
        confidence = confidence_score(edge.source_quality, edge.data_freshness, edge.verification_status)
        if confidence < min_confidence:
            continue
        try:
            scored = relationship_score(edge) if edge.parameter_ratings and edge.level_type != "ANCILLARY" else None
        except (ValueError, KeyError):
            scored = None
        if min_score and (scored is None or scored["score"] < min_score):
            continue
        result.append({"relationship": edge.model_dump(mode="json"), "score": scored,
                       "confidence_score": confidence})
        if len(result) >= limit:
            break
    return result


@app.get("/api/graph/cycles")
def cycles(s: Services = Depends(services)):
    return {"ownership": s.graph.cycles({"L1-01", "L1-02", "L1-03"}),
            "guarantees": s.graph.cycles({"L1-06", "L1-07"})}


@app.get("/api/counterparties/{entity_id}/exposure")
def exposure_summary(entity_id: str, s: Services = Depends(services)):
    if entity_id not in s.graph.entities:
        raise HTTPException(404, "Unknown entity")
    return aggregate(s.exposures, {entity_id})


@app.get("/api/groups/{group_id}/exposure")
def group_exposure(group_id: str, s: Services = Depends(services)):
    grouped = [item for item in s.exposures if item.group_id == group_id]
    if not grouped:
        raise HTTPException(404, "Unknown group or no approved exposures")
    return aggregate(grouped)


@app.post("/api/calculate/facility-ead")
def calculate_facility_ead(facility: Facility, actor: str = Depends(require_write_access)):
    ead = facility_ead(facility)
    return {"facility_id": facility.facility_id, "ead": ead,
            "utilization_percent": utilization(facility.outstanding, facility.approved_limit) if facility.approved_limit else None,
            "synthetic": facility.synthetic,
            "limitations": ["CCF missing; unfunded EAD not calculated"] if ead is None else []}


class TurnoverRequest(BaseModel):
    previous_quarter: float
    current_quarter: float


@app.post("/api/early-warning/turnover")
def turnover(request: TurnoverRequest, actor: str = Depends(require_write_access)):
    try:
        return turnover_drop(request.previous_quarter, request.current_quarter)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


class SectorStressRequest(BaseModel):
    industry_default_rate_score: float
    rating_downgrades_score: float
    market_indicator_score: float


@app.post("/api/early-warning/sector")
def sector_warning(request: SectorStressRequest, actor: str = Depends(require_write_access)):
    try:
        return sector_stress(request.industry_default_rate_score, request.rating_downgrades_score, request.market_indicator_score)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@app.get("/api/counterparties/{entity_id}/risk")
def risk_summary(entity_id: str, s: Services = Depends(services)):
    try:
        return _risk_summary(entity_id, s)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


def _risk_summary(entity_id: str, s: Services):
    if entity_id not in s.risk_inputs:
        raise HTTPException(422, "No approved standalone, concentration and event inputs for this entity")
    edges = []
    for edge in s.graph.relationships.values():
        if entity_id in (edge.source_entity_id, edge.target_entity_id) and edge.parameter_ratings:
            other = edge.target_entity_id if edge.source_entity_id == entity_id else edge.source_entity_id
            edges.append(edge.model_copy(update={"source_entity_id": entity_id, "target_entity_id": other}))
    if not edges and not s.risk_inputs[entity_id].no_connections_verified:
        raise HTTPException(422, "No reviewed network evidence or verified no-connection assertion")
    eads = {other: aggregate(s.exposures, {other})["ead"] for other in s.graph.entities}
    fingerprint = hashlib.sha256(json.dumps({"entity_id": entity_id, "inputs": s.risk_inputs[entity_id].model_dump(mode="json"),
                                     "relationships": [edge.model_dump(mode="json") for edge in edges],
                                     "eads": eads, "methodology_version": methodology()["version"]}, sort_keys=True).encode()).hexdigest()
    cached = s.metadata.get_risk_run(fingerprint)
    if cached:
        return cached
    result = calculate_counterparty(s.risk_inputs[entity_id], edges, eads)
    output = {**result, "counterparty_id": entity_id, "provenance": s.risk_inputs[entity_id].provenance,
              "synthetic_data": s.risk_inputs[entity_id].provenance == "DEMO"}
    return s.metadata.save_risk_run(fingerprint, entity_id, output)


@app.get("/api/counterparties/{entity_id}/insights")
def insights(entity_id: str, s: Services = Depends(services)):
    inputs = s.risk_inputs.get(entity_id)
    if inputs is None:
        raise HTTPException(422, "Approved insight inputs are unavailable")
    values = (inputs.direct_relationship_score, inputs.indirect_relationship_score,
              inputs.relationship_diversity_score, inputs.exposure_concentration_score,
              inputs.connected_entity_stress_score)
    if any(value is None for value in values):
        raise HTTPException(422, "Connectivity or contagion input is missing")
    connectivity = connectivity_score(values[0], values[1], values[2])
    contagion = contagion_score(values[3], connectivity, values[4])
    final = _risk_summary(entity_id, s)["final_risk"]["score"]
    levels = s.graph.connections(entity_id, 2)
    level_1 = {row["entity"]["canonical_entity_id"] for row in levels if row["level"] == 1}
    level_2 = {row["entity"]["canonical_entity_id"] for row in levels if row["level"] == 2}
    entity = s.graph.entities[entity_id]
    group_ids = set(entity.group_ids)
    if entity.primary_group_id:
        group_ids.add(entity.primary_group_id)
    group_members = {member_id for member_id, member in s.graph.entities.items()
                     if group_ids.intersection({*member.group_ids, *([member.primary_group_id] if member.primary_group_id else [])})}
    product_ead = {}
    for exposure in s.exposures:
        if exposure.entity_id in group_members:
            product = exposure.product or "Unclassified"
            product_ead[product] = product_ead.get(product, 0) + exposure.ead
    group_ead = aggregate(s.exposures, group_members)["ead"] if group_ids else None
    product_mix = {product: {"ead": round(ead, 4), "share_percent": round(ead / group_ead * 100, 4)}
                   for product, ead in sorted(product_ead.items())} if group_ead else {}
    network_nodes = {entity_id, *level_1, *level_2}
    network_links = sum(1 for edge in s.graph.relationships.values()
                        if edge.source_entity_id in network_nodes and edge.target_entity_id in network_nodes)
    return {"connectivity_score": round(connectivity, 4), "contagion_score": round(contagion, 4),
            "committee": committee_score(final, contagion, inputs.concentration, inputs.event),
            "direct_exposure": aggregate(s.exposures, {entity_id}),
            "level_1_exposure": aggregate(s.exposures, level_1),
            "level_2_exposure": aggregate(s.exposures, level_2),
            "indirect_ead": round(aggregate(s.exposures, level_1 | level_2)["ead"], 4),
            "group_ead": round(group_ead, 4) if group_ead is not None else None,
            "product_exposure_mix": product_mix,
            "network_link_count": network_links,
            "level_1_entities": len(level_1), "level_2_entities": len(level_2),
            "methodology_version": methodology()["version"]}


@app.get("/api/evidence/{evidence_id}")
def evidence(evidence_id: str, s: Services = Depends(services)):
    try:
        return s.graph.evidence[evidence_id]
    except KeyError as error:
        not_found(error)


class WorkflowActionPayload(BaseModel):
    action_id: str
    entity_id: str
    title: str
    owner_id: str | None = None
    status: str = "Open"
    due_date: date | None = None
    evidence_ids: list[str] = Field(default_factory=list)


@app.get("/api/actions")
def actions(entity_id: str | None = None, s: Services = Depends(services)):
    return s.metadata.actions(entity_id)


@app.post("/api/actions")
def save_action(action: WorkflowActionPayload, actor: str = Depends(require_write_access), s: Services = Depends(services)):
    if action.entity_id not in s.graph.entities:
        raise HTTPException(422, "Unknown entity")
    if action.status not in {"Open", "In Progress", "Pending Review", "Completed", "Escalated"}:
        raise HTTPException(422, "Invalid action status")
    payload = action.model_dump(mode="json")
    s.metadata.save_action(payload)
    s.metadata.audit(actor, "save_action", action.action_id, payload)
    return payload


@app.get("/api/audit")
def audit_records(limit: int = Query(default=100, ge=1, le=500), actor: str = Depends(require_write_access), s: Services = Depends(services)):
    return s.metadata.audit_records(limit)


class RelationshipScoreRequest(BaseModel):
    relationship: Relationship


class RatingSuggestionRequest(BaseModel):
    relationship_code: str
    parameter_name: str
    observed_value: float


@app.post("/api/methodology/ratings/suggest")
def suggest_rating(request: RatingSuggestionRequest, actor: str = Depends(require_write_access)):
    try:
        return suggest_parameter_rating(request.relationship_code, request.parameter_name, request.observed_value)
    except (KeyError, ValueError) as error:
        raise HTTPException(422, str(error)) from error


@app.post("/api/calculate/relationship")
def score_relationship(request: RelationshipScoreRequest, actor: str = Depends(require_write_access), s: Services = Depends(services)):
    try:
        result = relationship_score(request.relationship)
    except (ValueError, KeyError) as error:
        raise HTTPException(422, str(error)) from error
    s.metadata.audit(actor, "relationship_score", request.relationship.relationship_id, result)
    return result


@app.post("/api/calculate/parent-subsidiary-measures")
def parent_measures(values: dict[str, float], actor: str = Depends(require_write_access)):
    try:
        return parent_subsidiary_measures(values)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@app.post("/api/ingestion/records")
def ingest_records(records: list[SourceRecord], actor: str = Depends(require_write_access), s: Services = Depends(services)):
    outcomes = ingest(records, s.resolver, s.graph)
    if s.neo4j:
        for outcome in outcomes:
            if outcome.get("canonical_entity_id"):
                s.neo4j.upsert_entity(s.graph.entities[outcome["canonical_entity_id"]])
                s.neo4j.link_source_record(outcome["source_system"], outcome["source_record_id"], outcome["canonical_entity_id"])
    s.metadata.audit(actor, "ingestion", "batch", {"outcomes": outcomes})
    return outcomes


@app.post("/api/graph/entities")
def upsert_entity(entity: CanonicalEntity, actor: str = Depends(require_write_access), s: Services = Depends(services)):
    s.graph.upsert_entity(entity)
    if s.neo4j:
        s.neo4j.upsert_entity(entity)
    s.metadata.audit(actor, "upsert_entity", entity.canonical_entity_id, {"provenance": entity.provenance})
    return entity


@app.post("/api/graph/relationships")
def upsert_relationship(relationship: Relationship, actor: str = Depends(require_write_access), s: Services = Depends(services)):
    if relationship.relationship_code not in {entry["ID"] for entry in taxonomy()["relationships"]}:
        raise HTTPException(422, "Unknown relationship code")
    expected_level = "ANCILLARY" if relationship.relationship_code.startswith("A-") else "LEVEL_1" if relationship.relationship_code.startswith("L1-") else "LEVEL_2"
    if relationship.level_type != expected_level:
        raise HTTPException(422, f"{relationship.relationship_code} must have level_type {expected_level}")
    taxon = next(item for item in taxonomy()["relationships"] if item["ID"] == relationship.relationship_code)
    relationship = relationship.model_copy(update={
        "relationship_category": taxon.get("Relationship Category"),
        "relationship_type": taxon.get("Relationship Type"),
    })
    if relationship.review_status == "APPROVED":
        if not relationship.evidence_ids:
            raise HTTPException(422, "Approved relationships require evidence")
        if not {"source_quality", "data_freshness", "verification_status"}.issubset(relationship.model_fields_set):
            raise HTTPException(422, "Approved relationships require explicit confidence components")
        if relationship.level_type != "ANCILLARY":
            try:
                relationship_score(relationship)
            except (KeyError, ValueError) as error:
                raise HTTPException(422, str(error)) from error
    try:
        s.graph.upsert_relationship(relationship)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    if s.neo4j:
        s.neo4j.upsert_relationship(relationship)
    s.metadata.audit(actor, "upsert_relationship", relationship.relationship_id, relationship.model_dump(mode="json"))
    return relationship


@app.post("/api/exposures")
def upsert_exposure(exposure: Exposure, actor: str = Depends(require_write_access), s: Services = Depends(services)):
    if exposure.entity_id not in s.graph.entities:
        raise HTTPException(422, "Unknown entity")
    s.exposures = [item for item in s.exposures if item.exposure_id != exposure.exposure_id] + [exposure]
    s.metadata.save_exposure(exposure)
    s.metadata.audit(actor, "upsert_exposure", exposure.exposure_id, exposure.model_dump(mode="json"))
    return exposure


@app.post("/api/counterparties/{entity_id}/risk-inputs")
def upsert_risk_inputs(entity_id: str, inputs: ScoreInputs, actor: str = Depends(require_write_access), s: Services = Depends(services)):
    if entity_id not in s.graph.entities:
        raise HTTPException(422, "Unknown entity")
    s.risk_inputs[entity_id] = inputs
    s.metadata.save_risk_inputs(entity_id, inputs)
    s.metadata.audit(actor, "upsert_risk_inputs", entity_id, inputs.model_dump(mode="json"))
    return inputs


class DiscoveryRequest(BaseModel):
    assertions: list[dict]
    enabled: dict[str, bool] = Field(default_factory=dict)


@app.post("/api/relationships/discover")
def discover(request: DiscoveryRequest, actor: str = Depends(require_write_access)):
    registry = detector_registry(request.enabled)
    context = DetectionContext(request.assertions)
    return [candidate.__dict__ for detector in registry.values() for candidate in detector.detect(context)]


class CopilotRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    entity_id: str


class RiskCopilotRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    entity_id: str | None = None


@app.post("/api/risk-copilot/ask")
def risk_copilot_ask(request: RiskCopilotRequest, s: Services = Depends(services)):
    entity_id = resolve_entity(request.question, request.entity_id, s.metadata)
    if entity_id is None:
        return {"answer": "I could not find a matching manufactured counterparty.",
                "sources": [], "limitations": ["No matching counterparty found."], "tools_used": []}
    return answer_with_tools(request.question, entity_id, s.metadata, s.neo4j)


@app.post("/api/copilot/ask")
def ask(request: CopilotRequest, actor: str = Depends(require_write_access), s: Services = Depends(services)):
    if request.entity_id not in s.graph.entities:
        raise HTTPException(404, "Unknown entity")
    facts = {"related_entities": [row["entity"]["legal_name"] for row in s.graph.connections(request.entity_id, 2)],
             "supporting_metrics": {"ead": aggregate(s.exposures, {request.entity_id})["ead"]},
             "methodology_version": methodology()["version"], "data_as_of": methodology()["effective_date"],
             "limitations": ["Synthetic demo data"]}
    provider = MistralProvider() if os.getenv("MISTRAL_API_KEY") else MockLLMProvider()
    s.metadata.audit(actor, "copilot_query", request.entity_id, {"question": request.question})
    try:
        return grounded_answer(request.question, facts, provider)
    except (ValueError, RuntimeError) as error:
        raise HTTPException(422, str(error)) from error
