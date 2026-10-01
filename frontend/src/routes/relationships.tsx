
import { useEffect, useMemo, useState } from "react";

import { confidenceLabel, formatMoney, formatPct } from "@/lib/risk";
import { DemoBadge, PageHeader, ProvenanceTag, Section } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { RelationshipGraph, type GraphFilters } from "@/components/graph/RelationshipGraph";
import { edgeDetail, nodeDetail, relationshipDetail } from "@/lib/detail";
import { entityLabel } from "@/data/demo";
import { useAppState } from "@/state/app-state";

export function RelationshipsPage() {
  const { dossier, openDetail } = useAppState();
  const [selectedDirectId, setSelectedDirectId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDirectId(null);
  }, [dossier.company.id]);

  const filters: GraphFilters = { levels: "ALL", riskLevels: [] };

  const directRows = useMemo(() => dossier.relationships.filter((row) => row.level === "LEVEL_1"), [dossier.relationships]);
  const directNodes = useMemo(() => {
    const ids = new Set(directRows.map((row) => row.entityA === dossier.graph.centerId ? row.entityB : row.entityA));
    return dossier.graph.nodes.filter((node) => ids.has(node.id));
  }, [directRows, dossier.graph]);
  const directNodeIds = useMemo(() => new Set(directNodes.map((node) => node.id)), [directNodes]);
  const expandedRows = useMemo(() => selectedDirectId ? dossier.relationships.filter(
    (row) => row.level === "LEVEL_2" && (row.entityA === selectedDirectId || row.entityB === selectedDirectId),
  ) : [], [dossier.relationships, selectedDirectId]);
  const visibleDirectRows = useMemo(() => selectedDirectId ? directRows.filter(
    (row) => row.entityA === selectedDirectId || row.entityB === selectedDirectId,
  ) : directRows, [directRows, selectedDirectId]);
  const rows = useMemo(() => [...visibleDirectRows, ...expandedRows], [visibleDirectRows, expandedRows]);

  const graphData = useMemo(() => {
    const relationshipIds = new Set(rows.map((row) => row.relationshipId));
    const edges = dossier.graph.edges.filter((edge) => relationshipIds.has(edge.relationshipId));
    const nodeIds = new Set([dossier.graph.centerId, ...edges.flatMap((edge) => [edge.from, edge.to])]);
    const nodes = dossier.graph.nodes.filter((node) => nodeIds.has(node.id));
    return { ...dossier.graph, edges, nodes };
  }, [dossier.graph, rows]);
  const selectedDirectNode = directNodes.find((node) => node.id === selectedDirectId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Relationship intelligence"
        title="Relationship graph"
        description="Who the counterparty is connected to, how strong each connection is, and how risk could travel along it."
        actions={
          <>
            <DemoBadge />
            {selectedDirectId && <Button variant="outline" size="sm" onClick={() => setSelectedDirectId(null)}>Back to Level 1</Button>}
          </>
        }
      />

      <p className="text-sm text-muted-foreground">
        {selectedDirectNode
          ? `Showing ${expandedRows.length} further relationship${expandedRows.length === 1 ? "" : "s"} for ${selectedDirectNode.label}. Use Back to Level 1 to choose another node.`
          : "Showing Level 1 relationships. Select a direct node to expand its relationships."}
      </p>
      <RelationshipGraph
        key={`${dossier.company.id}-${selectedDirectId ?? "level-1"}`}
        data={graphData}
        mode="RELATIONSHIP"
        filters={filters}
        onSelectNode={(node) => {
          if (directNodeIds.has(node.id)) {
            setSelectedDirectId(node.id);
          } else {
            openDetail(nodeDetail(node));
          }
        }}
        onSelectEdge={(edge) => openDetail(edgeDetail(edge))}
      />

      <Section
        title={`Relationship register · ${rows.length}`}
        description="Every mapped relationship with strength, dependency, confidence and source."
        actions={<ProvenanceTag provenance={dossier.company.provenance} />}
        dense
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="label-caps px-4 py-2">Entity A</th>
                <th className="label-caps px-4 py-2">Relationship</th>
                <th className="label-caps px-4 py-2">Entity B</th>
                <th className="label-caps px-4 py-2">Level</th>
                <th className="label-caps px-4 py-2 text-right">Strength</th>
                <th className="label-caps px-4 py-2 text-right">Dependency</th>
                <th className="label-caps px-4 py-2 text-right">Exposure</th>
                <th className="label-caps px-4 py-2">Confidence</th>
                <th className="label-caps px-4 py-2">Refreshed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rel) => (
                <tr
                  key={rel.relationshipId}
                  onClick={() => openDetail(relationshipDetail(rel))}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-muted"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{dossier.graph.nodes.find((node) => node.id === rel.entityA)?.label ?? entityLabel(rel.entityA)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {rel.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{dossier.graph.nodes.find((node) => node.id === rel.entityB)?.label ?? entityLabel(rel.entityB)}</td>
                  <td className="px-4 py-2.5 text-xs">{rel.level.replace("_", " ")}</td>
                  <td className="num px-4 py-2.5 text-right">{formatPct(rel.strength)}</td>
                  <td className="num px-4 py-2.5 text-right">{formatPct(rel.dependency)}</td>
                  <td className="num px-4 py-2.5 text-right">{formatMoney(rel.exposure)}</td>
                  <td className="px-4 py-2.5 text-xs">{confidenceLabel[rel.confidence]}</td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">{rel.lastRefreshed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  );
}
