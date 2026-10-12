export interface BackendRiskSummary {
  counterparty_id: string;
  network_risk_score: number;
  final_risk: {
    score: number;
    band: "Low" | "Moderate" | "Elevated" | "High" | "Critical";
    calculated_at: string;
    methodology_version: string;
  };
  provenance: "DEMO" | "OBSERVED" | "CALCULATED" | "MODEL_OUTPUT" | "ANALYST_JUDGMENT";
  synthetic_data: boolean;
}

const apiBase = import.meta.env["VITE_API_BASE_URL"] ?? "http://127.0.0.1:8000";

export interface RiskCopilotReply {
  answer: string;
  sources: { store: string; label: string; id: string }[];
  limitations: string[];
}

export async function askRiskCopilot(question: string, entityId: string): Promise<RiskCopilotReply> {
  const response = await fetch(`${apiBase}/api/risk-copilot/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, entity_id: entityId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Risk Copilot returned ${response.status}`);
  }
  return response.json() as Promise<RiskCopilotReply>;
}

import type { Asset, Company, ContagionPath, EarlyWarningIndicator, ExposureBreakdownItem, Guarantee, Money, Relationship, RelationshipGraphData, Risk, RiskDriver } from "@/types/risk";
import type { CounterpartyDossier } from "@/types/risk";

export type ReportSection = "exposure" | "contagion" | "risk-overview" | "evidence-sources";

export async function generateReportPdf(section: ReportSection, dossier: CounterpartyDossier): Promise<Blob> {
  const response = await fetch(`${apiBase}/api/reports/${section}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossier }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Report API returned ${response.status}`);
  }
  return response.blob();
}

export interface ManufacturedCounterparty {
  batch_id: string;
  entity: { canonical_entity_id: string };
  company: Company;
  exposure: { ead: number; pd: number; lgd: number };
  funded_exposure?: Money;
  unfunded_exposure?: Money;
  potential_future_exposure?: Money;
  exposure_breakdown?: ExposureBreakdownItem[];
  assets?: Asset[];
  guarantees?: Guarantee[];
  contagion_paths?: ContagionPath[];
  early_warning_indicators?: EarlyWarningIndicator[];
  collateral: Money;
  net_exposure: Money;
  expected_credit_loss: number;
  risk: { score: number; band: string; calculated_at: string };
  risks?: Risk[];
  risk_drivers?: RiskDriver[];
  relationships?: Relationship[];
  graph_data?: RelationshipGraphData;
  category_model_version?: string;
  recovery?: { eligible_collateral: number; estimated_recovery: number; formula: string };
  estimated_recovery?: Money;
  collateral_market_value?: Money;
  collateral_haircut?: number;
  methodology_version: string;
  generated_at: string;
  synthetic_data: true;
}

export async function fetchManufacturedCounterparties(): Promise<ManufacturedCounterparty[]> {
  const response = await fetch(`${apiBase}/api/manufactured-counterparties`);
  if (!response.ok) throw new Error(`Counterparty API returned ${response.status}`);
  return response.json() as Promise<ManufacturedCounterparty[]>;
}

export async function deleteCounterparty(counterpartyId: string): Promise<void> {
  const response = await fetch(`${apiBase}/api/counterparties/${encodeURIComponent(counterpartyId)}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Delete API returned ${response.status}`);
  }
}

export async function generateManufacturedCounterparties(count: number): Promise<{ batch_id: string; created_count: number }> {
  const response = await fetch(`${apiBase}/api/manufactured-counterparties/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Generate API returned ${response.status}`);
  }
  return response.json() as Promise<{ batch_id: string; created_count: number }>;
}

export interface DemoCategoryAssessment {
  risks: Risk[];
  risk_drivers: RiskDriver[];
  estimated_recovery: number;
  net_exposure: number;
  recovery_pct: number;
  model_version: string;
  provenance: "DEMO";
}

export async function assessDemoCategories(profile: Record<string, string | number>, signal?: AbortSignal): Promise<DemoCategoryAssessment> {
  const response = await fetch(`${apiBase}/api/demo/category-assessment`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile), ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`Category assessment API returned ${response.status}`);
  return response.json() as Promise<DemoCategoryAssessment>;
}

export async function fetchRiskSummary(counterpartyId: string, signal?: AbortSignal): Promise<BackendRiskSummary> {
  const response = await fetch(`${apiBase}/api/counterparties/${encodeURIComponent(counterpartyId)}/risk`, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Risk API returned ${response.status}`);
  return response.json() as Promise<BackendRiskSummary>;
}
