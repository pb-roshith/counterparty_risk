
import { useEffect, useMemo, useState } from "react";

import { confidenceLabel, formatPct } from "@/lib/risk";
import { DemoBadge, PageHeader, ProvenanceTag, Section } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RelationshipGraph, type GraphFilters } from "@/components/graph/RelationshipGraph";
import { edgeDetail, nodeDetail, relationshipDetail } from "@/lib/detail";
import { entityLabel } from "@/data/demo";
import { useAppState } from "@/state/app-state";

export function RelationshipsPage() {
  const { dossier, openDetail } = useAppState();
  const [selectedDirectId, setSelectedDirectId] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState("ALL");
  const [graphLevel, setGraphLevel] = useState<"LEVEL_1" | "LEVEL_2">("LEVEL_1");

  useEffect(() => {
    setSelectedDirectId(null);
    setSelectedRelationType("ALL");
    setGraphLevel("LEVEL_1");
  }, [dossier.company.id]);

  const filters: GraphFilters = { levels: "ALL", riskLevels: [] };

  const directRows = useMemo(() => dossier.relationships.filter((row) => row.level === "LEVEL_1"), [dossier.relationships]);
  const relationTypes = useMemo(() => [...new Set(directRows.map((row) => row.type))].sort(), [directRows]);
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
  ) : directRows.filter((row) => selectedRelationType === "ALL" || row.type === selectedRelationType), [directRows, selectedDirectId, selectedRelationType]);
  const rows = useMemo(() => graphLevel === "LEVEL_2"
    ? dossier.relationships.filter((row) => row.level === "LEVEL_1" || row.level === "LEVEL_2")
    : [...visibleDirectRows, ...expandedRows], [graphLevel, dossier.relationships, visibleDirectRows, expandedRows]);

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
        {graphLevel === "LEVEL_2"
          ? "Showing all Level 1 and Level 2 relationships."
          : selectedDirectNode
          ? `Showing ${expandedRows.length} further relationship${expandedRows.length === 1 ? "" : "s"} for ${selectedDirectNode.label}. Use Back to Level 1 to choose another node.`
          : "Showing Level 1 relationships. Select a direct node to expand its relationships."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Graph level">
          {(["LEVEL_1", "LEVEL_2"] as const).map((level) => (
            <Button key={level} size="sm" variant={graphLevel === level ? "default" : "outline"}
              aria-pressed={graphLevel === level}
              onClick={() => { setGraphLevel(level); setSelectedDirectId(null); }}>
              {level === "LEVEL_1" ? "Level 1" : "Level 2"}
            </Button>
          ))}
        </div>
      {graphLevel === "LEVEL_1" && !selectedDirectId && (
        <>
          <label htmlFor="relation-type-filter" className="text-sm font-medium">Relation type</label>
          <Select value={selectedRelationType} onValueChange={setSelectedRelationType}>
            <SelectTrigger id="relation-type-filter" className="w-[240px] bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All relations</SelectItem>
              {relationTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )}
      </div>
      <RelationshipGraph
        key={`${dossier.company.id}-${graphLevel}-${selectedDirectId ?? "all"}`}
        data={graphData}
        mode="RELATIONSHIP"
        layout={graphLevel === "LEVEL_2" ? "clusters" : "radial"}
        height={graphLevel === "LEVEL_2" ? 800 : 620}
        filters={filters}
        onSelectNode={(node) => {
          if (graphLevel === "LEVEL_1" && directNodeIds.has(node.id)) {
            setSelectedDirectId(node.id);
          } else {
            openDetail(nodeDetail(node));
          }
        }}
        onSelectEdge={(edge) => openDetail(edgeDetail(edge))}
      />

      <Section
        title={`Relationship register · ${rows.length}`}
        description="Every mapped relationship with strength, confidence and source."
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
