import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";

import { DEFAULT_COUNTERPARTY_ID, getDossier } from "@/data/demo";
import { assessDemoCategories, deleteCounterparty as deleteCounterpartyRecord, fetchManufacturedCounterparties, fetchRiskSummary,
  type BackendRiskSummary, type DemoCategoryAssessment, type ManufacturedCounterparty } from "@/lib/api";
import type { Company, ContagionPath, CounterpartyDossier, Provenance, RiskLevel } from "@/types/risk";

function twoHopPaths(record: ManufacturedCounterparty): ContagionPath[] {
  const center = record.company.id;
  const nodes = new Map((record.graph_data?.nodes ?? []).map((node) => [node.id, node]));
  const direct = new Map(record.relationships?.filter((relation) => relation.level === "LEVEL_1")
    .map((relation) => [relation.entityA === center ? relation.entityB : relation.entityA, relation]) ?? []);
  return (record.relationships ?? []).filter((relation) => relation.level === "LEVEL_2").flatMap((relation) => {
    const middleId = direct.has(relation.entityA) ? relation.entityA : relation.entityB;
    const first = direct.get(middleId);
    const endId = relation.entityA === middleId ? relation.entityB : relation.entityA;
    const middle = nodes.get(middleId);
    const end = nodes.get(endId);
    if (!first || !middle || !end) return [];
    return [{
      id: relation.relationshipId,
      hops: [
        { entityId: center, entityName: record.company.name, entityType: "COMPANY" as const },
        { entityId: middleId, entityName: middle.label, entityType: middle.entityType, relationshipType: first.type },
        { entityId: endId, entityName: end.label, entityType: end.entityType, relationshipType: relation.type },
      ],
      transmissionChannel: `${first.type} → ${relation.type}`,
      exposure: { amount: Math.min(first.exposure?.amount ?? 0, relation.exposure?.amount ?? 0), currency: "INR" as const, unit: "Cr" as const },
      dependency: Number((first.dependency * relation.dependency).toFixed(4)),
      potentialImpact: `Stress could travel from ${record.company.name} through ${middle.label} to ${end.label}.`,
      riskLevel: record.company.riskLevel,
      provenance: "DEMO" as const,
    }];
  });
}

/* ------------------------- Detail drawer payload ------------------------- */

export interface DetailRow {
  label: string;
  value: string;
}

export interface DetailAction {
  label: string;
  to?: string | undefined;
  onSelect?: (() => void) | undefined;
}

export interface DetailPayload {
  kind: "RISK" | "RELATIONSHIP" | "ENTITY" | "EVIDENCE" | "ACTION" | "ASSET";
  title: string;
  subtitle?: string | undefined;
  riskLevel?: RiskLevel | undefined;
  score?: number | undefined;
  /** "Why?" bullets — the reasoning behind the assessment. */
  reasons?: string[] | undefined;
  rows?: DetailRow[] | undefined;
  narrative?: string | undefined;
  evidenceIds?: string[] | undefined;
  provenance?: Provenance | undefined;
  lastUpdated?: string | undefined;
  actions?: DetailAction[] | undefined;
}

/* ------------------------------ Context ------------------------------ */

interface AppState {
  counterpartyId: string;
  setCounterpartyId: (id: string) => void;
  company: Company;
  dossier: CounterpartyDossier;
  counterparties: Company[];
  manufactured: ManufacturedCounterparty[];
  refreshManufactured: () => Promise<void>;
  deleteCounterparty: (id: string) => Promise<void>;
  dossierFor: (id: string) => CounterpartyDossier;

  detail: DetailPayload | null;
  openDetail: (payload: DetailPayload) => void;
  closeDetail: () => void;

  selectorOpen: boolean;
  setSelectorOpen: (open: boolean) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [backendRisk, setBackendRisk] = useState<BackendRiskSummary | null>(null);
  const [demoCategory, setDemoCategory] = useState<{ id: string; result: DemoCategoryAssessment } | null>(null);
  const [manufactured, setManufactured] = useState<ManufacturedCounterparty[]>([]);

  const refreshManufactured = useCallback(async () => {
    const records = await fetchManufacturedCounterparties();
    setManufactured(records);
    setCounterpartyId((current) => records.some((record) => record.company.id === current) ? current : (records[0]?.company.id ?? ""));
  }, []);

  useEffect(() => { void refreshManufactured().catch(console.warn); }, [refreshManufactured]);

  const deleteCounterparty = useCallback(async (id: string) => {
    await deleteCounterpartyRecord(id);
    const remaining = manufactured.filter((record) => record.company.id !== id);
    setManufactured(remaining);
    setCounterpartyId((current) => current === id ? (remaining[0]?.company.id ?? "") : current);
    setDetail(null);
  }, [manufactured]);

  const dossierFor = useCallback((id: string): CounterpartyDossier => {
    const generated = manufactured.find((record) => record.company.id === id);
    if (!generated) return getDossier(id);
    const base = getDossier(DEFAULT_COUNTERPARTY_ID);
    const zero = { amount: 0, currency: "INR" as const, unit: "Cr" as const };
    return {
      ...base, company: generated.company,
      overallRisk: { score: generated.risk.score, level: generated.company.riskLevel, trend: "FLAT",
                     provenance: "DEMO", asOf: generated.risk.calculated_at },
      risks: generated.risks ?? [], riskDrivers: generated.risk_drivers ?? [], relationships: generated.relationships ?? [],
      graph: generated.graph_data ?? { centerId: id, nodes: [], edges: [] },
      exposure: { total: { ...zero, amount: generated.exposure.ead }, funded: generated.funded_exposure ?? zero,
                  unfunded: generated.unfunded_exposure ?? zero, potentialFutureExposure: generated.potential_future_exposure ?? zero, collateral: generated.collateral,
                  net: generated.net_exposure, asOf: generated.generated_at, provenance: "DEMO" },
      exposureBreakdown: generated.exposure_breakdown ?? [], assets: generated.assets ?? [], collateral: [], guarantees: generated.guarantees ?? [],
      recovery: { totalAssets: generated.company.businessProfile.totalAssets,
                  eligibleCollateral: generated.collateral_market_value ?? generated.collateral,
                  collateralValue: generated.collateral,
                  blendedHaircutPct: Math.round((generated.collateral_haircut ?? 0) * 100),
                  estimatedRecovery: generated.estimated_recovery ?? generated.collateral,
                  recoveryPct: generated.exposure.ead > 0 ? Math.round((generated.estimated_recovery?.amount ?? generated.collateral.amount) / generated.exposure.ead * 100) : 0,
                  provenance: "DEMO" },
      contagionPaths: twoHopPaths(generated),
      indicators: generated.early_warning_indicators ?? [], actions: [], sources: [], evidence: [], events: [],
    };
  }, [manufactured]);

  useEffect(() => {
    const controller = new AbortController();
    setBackendRisk(null);
    if (!counterpartyId) return () => controller.abort();
    fetchRiskSummary(counterpartyId, controller.signal)
      .then(setBackendRisk)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.warn("Risk API unavailable; showing labeled demo values", error);
      });
    return () => controller.abort();
  }, [counterpartyId]);

  useEffect(() => {
    const controller = new AbortController();
    setDemoCategory(null);
    if (!counterpartyId || manufactured.some((record) => record.company.id === counterpartyId)) return () => controller.abort();
    const demo = getDossier(counterpartyId);
    const profile = demo.company.businessProfile;
    const linked = demo.relationships.filter((relation) => relation.entityA === counterpartyId || relation.entityB === counterpartyId);
    const maxDependency = (keyword: string) => Math.round(Math.max(0, ...linked.filter((relation) => relation.type.toUpperCase().includes(keyword)).map((relation) => relation.dependency)) * 100);
    const payload = {
      ead: demo.exposure.total.amount, collateral: demo.exposure.collateral.amount,
      revenue: profile.revenue.amount, ebitda: profile.ebitda.amount, assets: profile.totalAssets.amount,
      liabilities: profile.totalLiabilities.amount, debt: profile.debt.amount, cash: profile.cash.amount,
      country: demo.company.identity.country, sector: demo.company.identity.sector,
      connected_exposure: linked.reduce((sum, relation) => sum + (relation.exposure?.amount ?? 0), 0),
      dependency_score: Math.round(Math.max(0, ...linked.map((relation) => relation.dependency)) * 100),
      owner_share: Math.round(Math.max(0, ...linked.filter((relation) => relation.type.toUpperCase().includes("OWN")).map((relation) => relation.strength)) * 100),
      supplier_share: maxDependency("SUPPL"), customer_share: maxDependency("CUSTOMER"),
      relationship_count: linked.length,
      operational_event_count: demo.events.filter((event) => event.category.toLowerCase().includes("operational")).length,
      legal_event_count: demo.events.filter((event) => event.category.toLowerCase().includes("legal")).length,
      as_of: demo.overallRisk.asOf,
    };
    assessDemoCategories(payload, controller.signal)
      .then((result) => setDemoCategory({ id: counterpartyId, result }))
      .catch((error: unknown) => { if (!controller.signal.aborted) console.warn("Category assessment unavailable", error); });
    return () => controller.abort();
  }, [counterpartyId, manufactured]);

  const openDetail = useCallback((payload: DetailPayload) => setDetail(payload), []);
  const closeDetail = useCallback(() => setDetail(null), []);

  const dossier = useMemo(() => {
    const source = dossierFor(counterpartyId);
    const calculated = demoCategory?.id === counterpartyId ? demoCategory.result : null;
    const demo = calculated ? {
      ...source, risks: calculated.risks, riskDrivers: calculated.risk_drivers,
      exposure: { ...source.exposure, net: { ...source.exposure.net, amount: calculated.net_exposure } },
      recovery: { ...source.recovery, estimatedRecovery: { ...source.recovery.estimatedRecovery, amount: calculated.estimated_recovery },
                  recoveryPct: calculated.recovery_pct, provenance: "DEMO" as const },
    } : source;
    if (!backendRisk || backendRisk.counterparty_id !== counterpartyId) {
      return { ...demo, overallRisk: { ...demo.overallRisk, provenance: "DEMO" as const } };
    }
    const level: RiskLevel = backendRisk.final_risk.band === "Critical" ? "CRITICAL"
      : backendRisk.final_risk.band === "High" ? "HIGH"
      : backendRisk.final_risk.band === "Low" ? "LOW" : "MODERATE";
    return {
      ...demo,
      company: { ...demo.company, riskScore: backendRisk.final_risk.score, riskLevel: level },
      overallRisk: {
        ...demo.overallRisk,
        score: backendRisk.final_risk.score,
        level,
        previousScore: undefined,
        trend: "FLAT" as const,
        provenance: backendRisk.synthetic_data ? "DEMO" as const : "CALCULATED" as const,
        asOf: backendRisk.final_risk.calculated_at,
      },
    };
  }, [counterpartyId, backendRisk, dossierFor, demoCategory]);

  const value = useMemo<AppState>(
    () => ({
      counterpartyId,
      setCounterpartyId,
      company: dossier.company,
      dossier,
      counterparties: manufactured.map((record) => record.company),
      manufactured,
      refreshManufactured,
      deleteCounterparty,
      dossierFor,
      detail,
      openDetail,
      closeDetail,
      selectorOpen,
      setSelectorOpen,
    }),
    [counterpartyId, dossier, manufactured, refreshManufactured, deleteCounterparty, dossierFor, detail, openDetail, closeDetail, selectorOpen],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}

/** Convenience hook for the currently selected counterparty dossier. */
export const useDossier = () => useAppState().dossier;
