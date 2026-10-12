import unittest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool

from app.main import app, services, Services, load_manufactured_record
from app.graph.repository import MemoryGraphRepository
from app.metadata.store import MetadataStore
from app.manufacture_data.manufacturing import generate_counterparties


class CounterpartyDeleteTests(unittest.TestCase):
    def test_delete_persists_and_preserves_other_counterparties(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
        metadata = MetadataStore(engine)
        batch, records = generate_counterparties(2)
        metadata.save_manufactured_batch(batch, records)
        graph, exposures, inputs = MemoryGraphRepository(), [], {}
        for record in records:
            load_manufactured_record(graph, exposures, inputs, record)
        neo4j = MagicMock()
        state = Services(graph, neo4j, MagicMock(), metadata, exposures, inputs)
        entity_id = records[0]["company"]["id"]
        other_id = records[1]["company"]["id"]
        app.dependency_overrides[services] = lambda: state
        try:
            client = TestClient(app)
            self.assertEqual(client.delete(f"/api/counterparties/{entity_id}").status_code, 204)
            self.assertEqual([row["company"]["id"] for row in metadata.manufactured_counterparties()], [other_id])
            self.assertNotIn(entity_id, graph.entities)
            self.assertIn(other_id, graph.entities)
            self.assertNotIn(entity_id, inputs)
            self.assertTrue(all(item.entity_id != entity_id for item in exposures))
            self.assertTrue(all(entity_id not in (edge.source_entity_id, edge.target_entity_id)
                                for edge in graph.relationships.values()))
            neo4j.delete_counterparty.assert_called_once_with(entity_id)
            self.assertEqual(client.delete(f"/api/counterparties/{entity_id}").status_code, 404)
        finally:
            app.dependency_overrides.pop(services, None)
            engine.dispose()
