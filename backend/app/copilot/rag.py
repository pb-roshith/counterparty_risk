"""Read-only tools for risk retrieval. Graph data is only read from Neo4j."""
from __future__ import annotations

import re

from app.security.access import redact_for_llm


TOOL_SECTIONS = {
    "get_counterparty_details": ("counterparty", "counterparty_details"),
    "get_exposure": ("exposure", "exposure"),
    "get_assets_recovery": ("assets_recovery", "assets_recovery"),
    "get_early_warning": ("early_warning", "early_warning"),
    "get_contagion_risk": ("contagion", "contagion_risk"),
    "get_risk_assessment": ("risk", "risk_assessments"),
    "get_other_information": ("other", "other_info"),
}
TOOL_DESCRIPTIONS = {
    "get_counterparty_details": "Company identity, profile, country, sector and other counterparty details.",
    "get_exposure": "EAD, funded and unfunded exposure, PD, LGD, net exposure and exposure breakdown.",
    "get_assets_recovery": "Assets, collateral, guarantees, haircuts and estimated recovery.",
    "get_early_warning": "Early warning indicators and previous warning inputs.",
    "get_contagion_risk": "Network contagion risk score and graph transmission paths.",
    "get_risk_assessment": "Overall risk score, risk categories, drivers and model inputs.",
    "get_other_information": "Other non-graph evidence and actions.",
    "get_relationship_graph": "Connected nodes and relationship graph from Neo4j.",
}


def resolve_entity(question: str, selected_id: str | None, metadata) -> str | None:
    records = metadata.manufactured_index()
    query = question.casefold()
    for row in records:
        if row["entity_id"].casefold() in query or row["name"].casefold() in query:
            return row["entity_id"]
    words = set(re.findall(r"[a-z0-9]+", query))
    for row in records:
        name_words = set(re.findall(r"[a-z0-9]+", row["name"].casefold()))
        if len(name_words & words) >= 2:
            return row["entity_id"]
    if selected_id and metadata.manufactured_section(selected_id, "counterparty"):
        return selected_id
    return None


def tool_specs() -> list[dict]:
    return [{"type": "function", "function": {"name": name, "description": description,
             "parameters": {"type": "object", "properties": {"entity_id": {"type": "string"}},
                            "required": ["entity_id"], "additionalProperties": False}}}
            for name, description in TOOL_DESCRIPTIONS.items()]


def run_tool(name: str, entity_id: str, metadata, neo4j) -> dict:
    if not metadata.manufactured_section(entity_id, "counterparty"):
        return {"data": None, "sources": [], "error": "Unknown manufactured counterparty"}
    if name == "get_relationship_graph":
        if neo4j is None:
            return {"data": None, "sources": [], "error": "Neo4j is not configured"}
        view = neo4j.manufactured_view(entity_id)
        connected = neo4j.connections(entity_id, 2)[:30]
        return {"data": {"graph_data": view.get("graph_data"),
                         "relationships": view.get("relationships"), "connections": connected},
                "sources": [{"store": "Neo4j", "label": "Relationship graph", "id": entity_id}]}
    if name not in TOOL_SECTIONS:
        raise ValueError("Unknown retrieval tool")
    section, table = TOOL_SECTIONS[name]
    data = metadata.manufactured_section(entity_id, section)
    sources = [{"store": "PostgreSQL", "label": table, "id": entity_id}] if data else []
    if data and name == "get_exposure" and data.get("exposure_breakdown"):
        sources.append({"store": "PostgreSQL", "label": "exposure_breakdown", "id": entity_id})
    if data and name == "get_assets_recovery" and data.get("assets"):
        sources.append({"store": "PostgreSQL", "label": "assets", "id": entity_id})
    if data and name == "get_early_warning" and data.get("early_warning_indicators"):
        sources.append({"store": "PostgreSQL", "label": "early_warning_indicators", "id": entity_id})
    if name == "get_contagion_risk" and neo4j is not None:
        data = {**(data or {}), "contagion_paths": neo4j.manufactured_view(entity_id).get("contagion_paths", [])}
        sources.append({"store": "Neo4j", "label": "Contagion paths", "id": entity_id})
    return {"data": redact_for_llm(data), "sources": sources}


def fallback_tools(question: str) -> list[str]:
    q = question.casefold()
    names = ["get_counterparty_details"]
    matches = {
        "get_exposure": ("exposure", "ead", "pd", "lgd", "facility"),
        "get_assets_recovery": ("asset", "collateral", "recovery", "guarantee", "haircut"),
        "get_early_warning": ("warning", "indicator", "alert"),
        "get_contagion_risk": ("contagion", "transmission", "propagation"),
        "get_risk_assessment": ("risk", "score", "category", "driver"),
        "get_relationship_graph": ("connect", "relationship", "supplier", "customer", "graph", "network"),
        "get_other_information": ("evidence", "action"),
    }
    names.extend(name for name, terms in matches.items() if any(term in q for term in terms))
    return names[:5]


def factual_answer(question: str, tool_results: dict[str, dict]) -> str:
    detail = (tool_results.get("get_counterparty_details") or {}).get("data") or {}
    company = detail.get("company") or {}
    name = company.get("name", detail.get("entity_id", "The counterparty"))
    parts = []
    risk = (tool_results.get("get_risk_assessment") or {}).get("data") or {}
    if risk.get("risk"):
        score = risk["risk"]
        parts.append(f"risk score {score.get('score')} ({score.get('band', 'unknown band')})")
    exposure = (tool_results.get("get_exposure") or {}).get("data") or {}
    if exposure.get("exposure"):
        parts.append(f"EAD {exposure['exposure'].get('ead')} INR Cr")
    assets = (tool_results.get("get_assets_recovery") or {}).get("data") or {}
    if assets.get("estimated_recovery"):
        parts.append(f"estimated recovery {assets['estimated_recovery'].get('amount')} INR Cr")
    graph = (tool_results.get("get_relationship_graph") or {}).get("data") or {}
    if graph.get("connections"):
        parts.append(f"{len(graph['connections'])} connected entities within two hops")
    warnings = (tool_results.get("get_early_warning") or {}).get("data") or {}
    if warnings.get("early_warning_indicators") is not None:
        parts.append(f"{len(warnings['early_warning_indicators'])} early warning indicators")
    if not parts:
        return f"{name} is a synthetic counterparty. No matching facts were found for that question."
    return f"{name}: " + "; ".join(parts) + ". These figures are synthetic."
