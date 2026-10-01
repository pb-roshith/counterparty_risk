from __future__ import annotations

from collections import defaultdict, deque
from datetime import date
from math import prod
from typing import Protocol

from app.models import CanonicalEntity, Evidence, Relationship
from app.scoring.engine import confidence_score


class GraphRepository(Protocol):
    def upsert_entity(self, entity: CanonicalEntity) -> None: ...
    def upsert_relationship(self, relationship: Relationship) -> None: ...
    def connections(self, entity_id: str, max_depth: int = 2, as_of: date | None = None) -> list[dict]: ...
    def paths(self, source_id: str, target_id: str, max_depth: int = 2, as_of: date | None = None, include_alternatives: bool = False) -> list[dict]: ...


class MemoryGraphRepository:
    def __init__(self):
        self.entities: dict[str, CanonicalEntity] = {}
        self.relationships: dict[str, Relationship] = {}
        self.evidence: dict[str, Evidence] = {}
        self.record_links: dict[tuple[str, str], str] = {}

    def upsert_entity(self, entity: CanonicalEntity) -> None:
        self.entities[entity.canonical_entity_id] = entity

    def upsert_relationship(self, relationship: Relationship) -> None:
        if relationship.source_entity_id not in self.entities or relationship.target_entity_id not in self.entities:
            raise ValueError("Both canonical entities must exist before a relationship is stored")
        self.relationships[relationship.relationship_id] = relationship

    def link_source_record(self, source_system: str, source_record_id: str, canonical_id: str) -> None:
        if canonical_id not in self.entities:
            raise KeyError(canonical_id)
        self.record_links[(source_system, source_record_id)] = canonical_id

    def upsert_evidence(self, evidence: Evidence) -> None:
        self.evidence[evidence.evidence_id] = evidence

    def _neighbors(self, entity_id: str, as_of: date | None = None):
        for edge in self.relationships.values():
            if as_of and ((edge.effective_from and as_of < edge.effective_from) or (edge.effective_to and as_of > edge.effective_to)):
                continue
            if edge.source_entity_id == entity_id:
                yield edge.target_entity_id, edge
            elif edge.target_entity_id == entity_id:
                yield edge.source_entity_id, edge

    def connections(self, entity_id: str, max_depth: int = 2, as_of: date | None = None) -> list[dict]:
        if not 1 <= max_depth <= 4:
            raise ValueError("Traversal depth must be 1 to 4")
        if entity_id not in self.entities:
            raise KeyError(entity_id)
        queue = deque([(entity_id, 0)])
        levels = {entity_id: 0}
        while queue:
            current, depth = queue.popleft()
            if depth >= max_depth:
                continue
            for other, _ in self._neighbors(current, as_of):
                if other not in levels:
                    levels[other] = depth + 1
                    queue.append((other, depth + 1))
        return [{"entity": self.entities[node].model_dump(mode="json"), "level": level,
                 "relationship_ids": [edge.relationship_id for _, edge in self._neighbors(node, as_of)]}
                for node, level in sorted(levels.items(), key=lambda item: (item[1], item[0])) if node != entity_id]

    def paths(self, source_id: str, target_id: str, max_depth: int = 2, as_of: date | None = None, include_alternatives: bool = False) -> list[dict]:
        if not 1 <= max_depth <= 4:
            raise ValueError("Traversal depth must be 1 to 4")
        if source_id not in self.entities or target_id not in self.entities:
            raise KeyError("Unknown entity")
        queue = deque([(source_id, [source_id], [])])
        results = []
        shortest = None
        while queue:
            current, nodes, edges = queue.popleft()
            if not include_alternatives and shortest is not None and len(edges) >= shortest:
                continue
            for other, edge in self._neighbors(current, as_of):
                if other in nodes:
                    continue
                new_nodes, new_edges = nodes + [other], edges + [edge]
                if other == target_id:
                    shortest = min(shortest, len(new_edges)) if shortest is not None else len(new_edges)
                    confidence = prod(confidence_score(e.source_quality, e.data_freshness, e.verification_status) / 100 for e in new_edges)
                    results.append({"entity_ids": new_nodes, "relationship_ids": [e.relationship_id for e in new_edges], "path_confidence": round(confidence * 100, 4)})
                elif len(new_edges) < max_depth:
                    queue.append((other, new_nodes, new_edges))
        return sorted(results, key=lambda path: (len(path["relationship_ids"]), -path["path_confidence"]))

    def cycles(self, relationship_codes: set[str], max_depth: int = 4) -> list[list[str]]:
        cycles = set()
        for start in self.entities:
            stack = [(start, [start])]
            while stack:
                current, path = stack.pop()
                for edge in self.relationships.values():
                    if edge.relationship_code not in relationship_codes or edge.source_entity_id != current:
                        continue
                    other = edge.target_entity_id
                    if other == start and len(path) > 1:
                        nodes = path[:]
                        rotations = [tuple(nodes[i:] + nodes[:i]) for i in range(len(nodes))]
                        cycles.add(min(rotations))
                    elif other not in path and len(path) < max_depth:
                        stack.append((other, path + [other]))
        return [list(cycle) for cycle in sorted(cycles)]

    def hubs(self) -> list[dict]:
        counts = defaultdict(set)
        for edge in self.relationships.values():
            counts[edge.source_entity_id].add(edge.target_entity_id)
            counts[edge.target_entity_id].add(edge.source_entity_id)
        return sorted(({"entity_id": key, "degree": len(value)} for key, value in counts.items()), key=lambda row: -row["degree"])


class Neo4jGraphRepository:
    """Parameterized graph writes. The service keeps scoring in Python."""

    SCHEMA = (
        "CREATE CONSTRAINT canonical_id IF NOT EXISTS FOR (n:CanonicalEntity) REQUIRE n.canonical_entity_id IS UNIQUE",
        "CREATE CONSTRAINT relationship_id IF NOT EXISTS FOR ()-[r:CONNECTED]-() REQUIRE r.relationship_id IS UNIQUE",
        "CREATE CONSTRAINT evidence_id IF NOT EXISTS FOR (e:Evidence) REQUIRE e.evidence_id IS UNIQUE",
        "CREATE CONSTRAINT source_record_id IF NOT EXISTS FOR (s:SourceRecord) REQUIRE s.source_key IS UNIQUE",
        "CREATE INDEX entity_legal_name IF NOT EXISTS FOR (n:CanonicalEntity) ON (n.legal_name)",
        "CREATE INDEX entity_lei IF NOT EXISTS FOR (n:CanonicalEntity) ON (n.lei)",
        "CREATE INDEX entity_country IF NOT EXISTS FOR (n:CanonicalEntity) ON (n.country)",
        "CREATE INDEX entity_industry IF NOT EXISTS FOR (n:CanonicalEntity) ON (n.industry)",
        "CREATE INDEX entity_group IF NOT EXISTS FOR (n:CanonicalEntity) ON (n.primary_group_id)",
        "CREATE INDEX entity_status IF NOT EXISTS FOR (n:CanonicalEntity) ON (n.status)",
    )

    def __init__(self, uri: str, user: str, password: str):
        from neo4j import GraphDatabase
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def health_check(self) -> bool:
        self.driver.verify_connectivity()
        return True

    def bootstrap(self) -> None:
        for statement in self.SCHEMA:
            self.driver.execute_query(statement)
        self.driver.execute_query("MERGE (m:SchemaMigration {version: $version}) ON CREATE SET m.applied_at = datetime()", version="1")

    def upsert_entity(self, entity: CanonicalEntity) -> None:
        # No unrestricted source attributes or raw sensitive IDs enter Neo4j.
        fields = entity.model_dump(mode="json", include={"canonical_entity_id", "legal_name", "entity_type", "senzing_entity_id", "aliases", "lei", "registration_number", "country", "industry", "group_ids", "primary_group_id", "status", "source_record_ids", "data_classification", "provenance"})
        fields["payload"] = entity.model_dump_json()
        self.driver.execute_query("MERGE (n:CanonicalEntity {canonical_entity_id: $id}) SET n += $fields", id=entity.canonical_entity_id, fields=fields)

    def save_manufactured_view(self, record: dict) -> None:
        """Keep UI graph layout and path descriptions with the graph, never in SQL."""
        import json
        entity_id = record["entity"]["canonical_entity_id"]
        self.driver.execute_query(
            "MATCH (n:CanonicalEntity {canonical_entity_id: $id}) "
            "SET n.manufactured_graph_data = $graph_data, "
            "n.manufactured_relationships = $relationships, "
            "n.manufactured_contagion_paths = $contagion_paths",
            id=entity_id, graph_data=json.dumps(record.get("graph_data", {})),
            relationships=json.dumps(record.get("relationships", [])),
            contagion_paths=json.dumps(record.get("contagion_paths", [])))

    def manufactured_view(self, entity_id: str) -> dict:
        import json
        rows, _, _ = self.driver.execute_query(
            "MATCH (n:CanonicalEntity {canonical_entity_id: $id}) "
            "RETURN n.manufactured_graph_data AS graph_data, "
            "n.manufactured_relationships AS relationships, "
            "n.manufactured_contagion_paths AS contagion_paths", id=entity_id)
        if not rows:
            return {}
        return {key: json.loads(rows[0][key]) for key in ("graph_data", "relationships", "contagion_paths")
                if rows[0][key] is not None}

    def upsert_relationship(self, relationship: Relationship) -> None:
        fields = {"relationship_code": relationship.relationship_code, "level_type": relationship.level_type,
                  "methodology_version": relationship.methodology_version,
                  "review_status": relationship.review_status, "payload": relationship.model_dump_json()}
        self.driver.execute_query("MATCH (a:CanonicalEntity {canonical_entity_id: $source}), (b:CanonicalEntity {canonical_entity_id: $target}) MERGE (a)-[r:CONNECTED {relationship_id: $id}]->(b) SET r += $fields", source=relationship.source_entity_id, target=relationship.target_entity_id, id=relationship.relationship_id, fields=fields)

    def upsert_evidence(self, evidence: Evidence) -> None:
        fields = {"source_system": evidence.source_system, "source_record_id": evidence.source_record_id,
                  "payload": evidence.model_dump_json()}
        self.driver.execute_query("MERGE (e:Evidence {evidence_id: $id}) SET e += $fields", id=evidence.evidence_id, fields=fields)

    def link_source_record(self, source_system: str, source_record_id: str, canonical_id: str) -> None:
        source_key = f"{source_system}:{source_record_id}"
        self.driver.execute_query("MATCH (n:CanonicalEntity {canonical_entity_id: $id}) MERGE (s:SourceRecord {source_key: $key}) MERGE (s)-[:RESOLVES_TO]->(n)", id=canonical_id, key=source_key)

    def load_graph(self) -> MemoryGraphRepository:
        cache = MemoryGraphRepository()
        rows, _, _ = self.driver.execute_query("MATCH (n:CanonicalEntity) RETURN n.payload AS payload LIMIT 10001")
        if len(rows) > 10000:
            raise RuntimeError("Graph cache entity limit exceeded; configure a paged repository")
        for row in rows:
            cache.upsert_entity(CanonicalEntity.model_validate_json(row["payload"]))
        rows, _, _ = self.driver.execute_query("MATCH ()-[r:CONNECTED]->() RETURN r.payload AS payload LIMIT 50001")
        if len(rows) > 50000:
            raise RuntimeError("Graph cache relationship limit exceeded; configure a paged repository")
        for row in rows:
            cache.upsert_relationship(Relationship.model_validate_json(row["payload"]))
        rows, _, _ = self.driver.execute_query("MATCH (e:Evidence) RETURN e.payload AS payload LIMIT 50001")
        if len(rows) > 50000:
            raise RuntimeError("Graph cache evidence limit exceeded; configure a paged repository")
        for row in rows:
            cache.upsert_evidence(Evidence.model_validate_json(row["payload"]))
        return cache

    def connections(self, entity_id: str, max_depth: int = 2, as_of: date | None = None) -> list[dict]:
        if not 1 <= max_depth <= 4:
            raise ValueError("Traversal depth must be 1 to 4")
        # Cypher variable-length bounds cannot be parameters; selecting from a
        # validated integer is safe and preserves bounded traversal.
        query = f"MATCH p=(root:CanonicalEntity {{canonical_entity_id: $id}})-[:CONNECTED*1..{max_depth}]-(other:CanonicalEntity) RETURN other.canonical_entity_id AS id, min(length(p)) AS level ORDER BY level, id LIMIT 500"
        rows, _, _ = self.driver.execute_query(query, id=entity_id)
        return [dict(row) for row in rows]

    def paths(self, source_id: str, target_id: str, max_depth: int = 2, as_of: date | None = None, include_alternatives: bool = False) -> list[dict]:
        if not 1 <= max_depth <= 4:
            raise ValueError("Traversal depth must be 1 to 4")
        query = f"MATCH p=(a:CanonicalEntity {{canonical_entity_id: $source}})-[:CONNECTED*1..{max_depth}]-(b:CanonicalEntity {{canonical_entity_id: $target}}) RETURN [n IN nodes(p) | n.canonical_entity_id] AS entity_ids, [r IN relationships(p) | r.relationship_id] AS relationship_ids, [r IN relationships(p) | r.payload] AS edge_payloads, length(p) AS depth ORDER BY depth LIMIT 100"
        rows, _, _ = self.driver.execute_query(query, source=source_id, target=target_id)
        results = []
        for row in rows:
            edges = [Relationship.model_validate_json(payload) for payload in row["edge_payloads"]]
            if as_of and any((edge.effective_from and as_of < edge.effective_from) or (edge.effective_to and as_of > edge.effective_to) for edge in edges):
                continue
            confidence = prod(confidence_score(edge.source_quality, edge.data_freshness, edge.verification_status) / 100 for edge in edges)
            results.append({"entity_ids": row["entity_ids"], "relationship_ids": row["relationship_ids"],
                            "path_confidence": round(confidence * 100, 4)})
        results.sort(key=lambda path: (len(path["relationship_ids"]), -path["path_confidence"]))
        if not include_alternatives and results:
            shortest = len(results[0]["relationship_ids"])
            results = [result for result in results if len(result["relationship_ids"]) == shortest]
        return results
