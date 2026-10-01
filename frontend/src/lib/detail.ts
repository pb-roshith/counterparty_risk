import { entityLabel, relationships, sources } from "@/data/demo";
import { confidenceLabel, formatMoney, formatPct } from "@/lib/risk";
import type { DetailPayload } from "@/state/app-state";
import type {
  Asset,
  EarlyWarningIndicator,
  Evidence,
  GraphEdge,
  GraphNode,
  Relationship,
  Risk,
  RiskAction,
  RiskDriver,
} from "@/types/risk";

/**
 * Mappers from domain objects → drawer payloads.
 * Keeping them here means every screen opens an identical drawer for the same
 * kind of object.
 */

export const riskDetail = (risk: Risk): DetailPayload => ({
  kind: "RISK",
  title: `${risk.category} Risk`,
  subtitle: risk.label,
  riskLevel: risk.score.level,
  score: risk.score.score,
  narrative: risk.summary.startsWith("Calculated from synthetic inputs using ") ? undefined : risk.summary,
  reasons: risk.reasons.map((reason) => reason.replace(/^Illustrative formula:\s*/i, "")),
  provenance: risk.score.provenance,
  rows: [
    { label: "Exposure", value: formatMoney(risk.exposure) },
    { label: "Potential impact", value: risk.potentialImpact },
    { label: "Materiality", value: formatPct(risk.materiality) },
    { label: "Previous score", value: risk.score.previousScore === undefined ? "—" : String(Math.round(risk.score.previousScore)) },
    { label: "Trend", value: risk.score.trend },
    {
      label: "Sources",
      value: risk.sourceIds
        .map((id) => sources.find((s) => s.id === id)?.name ?? id)
        .join(", "),
    },
  ],
  actions: [
    { label: "View Evidence", to: "/evidence" },
    { label: "View Graph", to: "/relationships" },
  ],
});

export const driverDetail = (driver: RiskDriver): DetailPayload => ({
  kind: "RISK",
  title: driver.title,
  subtitle: `${driver.riskCategory} risk driver`,
  riskLevel: driver.severity,
  narrative: driver.explanation,
  provenance: "MODEL_OUTPUT",
  rows: [
    { label: "Category", value: driver.riskCategory },
    { label: "Severity", value: driver.severity },
    { label: "Exposure", value: formatMoney(driver.exposure) },
  ],
  actions: [
    { label: "View Evidence", to: "/evidence" },
    { label: "View Graph", to: "/relationships" },
  ],
});

export const relationshipDetail = (rel: Relationship): DetailPayload => ({
  kind: "RELATIONSHIP",
  title: `${entityLabel(rel.entityA)} → ${entityLabel(rel.entityB)}`,
  subtitle: rel.type,
  narrative: rel.definition,
  reasons: [rel.riskRelevance],
  provenance: rel.provenance,
  lastUpdated: rel.lastRefreshed,
  rows: [
    { label: "Relationship ID", value: rel.relationshipId },
    { label: "Taxonomy ID", value: rel.taxonomyId },
    { label: "Level", value: rel.level.replace("_", " ") },
    { label: "Category", value: rel.category },
    { label: "Strength", value: formatPct(rel.strength) },
    { label: "Dependency", value: formatPct(rel.dependency) },
    { label: "Exposure", value: formatMoney(rel.exposure) },
    { label: "Confidence", value: confidenceLabel[rel.confidence] },
    {
      label: "Source",
      value: rel.sourceIds.map((id) => sources.find((s) => s.id === id)?.name ?? id).join(", "),
    },
    { label: "Effective date", value: rel.effectiveDate },
  ],
  actions: [
    { label: "View Evidence", to: "/evidence" },
    { label: "View Graph", to: "/relationships" },
  ],
});

export const edgeDetail = (edge: GraphEdge): DetailPayload => {
  const rel = relationships.find((r) => r.relationshipId === edge.relationshipId);
  if (rel) return { ...relationshipDetail(rel), riskLevel: edge.riskLevel };
  return {
    kind: "RELATIONSHIP",
    title: edge.type,
    riskLevel: edge.riskLevel,
    rows: [{ label: "Relationship ID", value: edge.relationshipId }],
  };
};

export const nodeDetail = (node: GraphNode): DetailPayload => {
  const rels = relationships.filter((r) => r.entityA === node.id || r.entityB === node.id);
  return {
    kind: "ENTITY",
    title: node.label,
    subtitle: `${node.nodeRole} · ${node.entityType.toLowerCase()}`,
    riskLevel: node.riskLevel,
    narrative: `${node.label} is connected to the counterparty through ${rels.length} mapped relationship(s) in the taxonomy.`,
    reasons: rels.slice(0, 4).map((r) => `${r.type} — ${r.definition}`),
    provenance: "DEMO",
    rows: [
      { label: "Entity ID", value: node.id },
      { label: "Entity type", value: node.entityType },
      { label: "Relationship level", value: node.level.replace("_", " ") },
      { label: "Materiality", value: formatPct(node.weight) },
      { label: "Exposure", value: formatMoney(node.exposure) },
      { label: "Relationships", value: String(rels.length) },
    ],
    actions: [
      { label: "View Graph", to: "/relationships" },
      { label: "View Evidence", to: "/evidence" },
    ],
  };
};

export const evidenceDetail = (item: Evidence): DetailPayload => ({
  kind: "EVIDENCE",
  title: item.title,
  subtitle: sources.find((s) => s.id === item.sourceId)?.name,
  narrative: item.excerpt,
  provenance: "OBSERVED",
  lastUpdated: item.capturedAt,
  evidenceIds: [item.id],
  rows: [
    { label: "Document reference", value: item.documentRef ?? "—" },
    { label: "Confidence", value: confidenceLabel[item.confidence] },
    { label: "Linked items", value: item.linkedTo.map((l) => `${l.kind}:${l.id}`).join(", ") },
  ],
});

export const actionDetail = (action: RiskAction): DetailPayload => ({
  kind: "ACTION",
  title: action.recommendedAction,
  subtitle: action.risk,
  narrative: `Owner ${action.owner}. Due ${action.dueDate}.`,
  provenance: "ANALYST_JUDGMENT",
  rows: [
    { label: "Priority", value: action.priority },
    { label: "Owner", value: action.owner },
    { label: "Due date", value: action.dueDate },
    { label: "Status", value: action.status },
  ],
  actions: [{ label: "View Evidence", to: "/evidence" }],
});

export const assetDetail = (asset: Asset): DetailPayload => ({
  kind: "ASSET",
  title: asset.name,
  subtitle: asset.type,
  provenance: asset.provenance,
  lastUpdated: asset.valuationDate,
  rows: [
    { label: "Gross value", value: formatMoney(asset.value) },
    { label: "Collateral value", value: formatMoney(asset.collateralValue) },
    { label: "Haircut", value: `${asset.haircutPct}%` },
    { label: "Ownership", value: asset.ownership },
    { label: "Encumbrance", value: asset.encumbrance.replace(/_/g, " ") },
    { label: "Recovery priority", value: String(asset.recoveryPriority) },
  ],
  actions: [{ label: "View Evidence", to: "/evidence" }],
});

export const indicatorDetail = (ind: EarlyWarningIndicator): DetailPayload => ({
  kind: "RISK",
  title: ind.indicator,
  subtitle: `${ind.category} early warning indicator`,
  riskLevel: ind.riskLevel,
  narrative: `Current reading ${ind.current} against a threshold of ${ind.threshold}.`,
  provenance: ind.provenance ?? "OBSERVED",
  lastUpdated: ind.date,
  rows: [
    { label: "Current", value: ind.current },
    { label: "Previous", value: ind.previous },
    { label: "Threshold", value: ind.threshold },
    { label: "Trend", value: ind.trend },
    { label: "Status", value: ind.status },
    ...(ind.formula ? [{ label: "Calculation and inputs", value: ind.formula }] : []),
  ],
  actions: [
    { label: "View Evidence", to: "/evidence" },
    { label: "View Graph", to: "/relationships" },
  ],
});
