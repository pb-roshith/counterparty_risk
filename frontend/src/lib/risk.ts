import type { Confidence, Money, Provenance, RiskLevel, Trend } from "@/types/risk";

export const RISK_LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN"];

interface RiskStyle {
  label: string;
  text: string;
  bg: string;
  border: string;
  dot: string;
  /** raw css colour for svg/inline usage */
  color: string;
  softColor: string;
}

export const riskStyles: Record<RiskLevel, RiskStyle> = {
  LOW: {
    label: "Low",
    text: "text-risk-low",
    bg: "bg-risk-low-soft",
    border: "border-risk-low/30",
    dot: "bg-risk-low",
    color: "var(--risk-low)",
    softColor: "var(--risk-low-soft)",
  },
  MODERATE: {
    label: "Moderate",
    text: "text-risk-moderate",
    bg: "bg-risk-moderate-soft",
    border: "border-risk-moderate/35",
    dot: "bg-risk-moderate",
    color: "var(--risk-moderate)",
    softColor: "var(--risk-moderate-soft)",
  },
  HIGH: {
    label: "High",
    text: "text-risk-high",
    bg: "bg-risk-high-soft",
    border: "border-risk-high/35",
    dot: "bg-risk-high",
    color: "var(--risk-high)",
    softColor: "var(--risk-high-soft)",
  },
  CRITICAL: {
    label: "Critical",
    text: "text-risk-critical",
    bg: "bg-risk-critical-soft",
    border: "border-risk-critical/35",
    dot: "bg-risk-critical",
    color: "var(--risk-critical)",
    softColor: "var(--risk-critical-soft)",
  },
  UNKNOWN: {
    label: "Unknown",
    text: "text-risk-unknown",
    bg: "bg-risk-unknown-soft",
    border: "border-risk-unknown/30",
    dot: "bg-risk-unknown",
    color: "var(--risk-unknown)",
    softColor: "var(--risk-unknown-soft)",
  },
};

export const riskStyle = (level: RiskLevel | undefined) => riskStyles[level ?? "UNKNOWN"];

export const levelFromScore = (score: number): RiskLevel =>
  score >= 80 ? "CRITICAL" : score >= 65 ? "HIGH" : score >= 40 ? "MODERATE" : "LOW";

const currencySymbol: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export function formatMoney(money: Money | undefined, opts?: { compact?: boolean }): string {
  if (!money) return "—";
  const sym = currencySymbol[money.currency] ?? "";
  const unit = money.unit ? ` ${money.unit}` : "";
  const amount = opts?.compact
    ? money.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : money.amount.toLocaleString("en-IN");
  return `${sym}${amount}${unit}`;
}

export const formatNumber = (n: number) => n.toLocaleString("en-IN");

export const formatPct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const trendGlyph: Record<Trend, string> = { UP: "▲", DOWN: "▼", FLAT: "▬" };

export const provenanceLabel: Record<Provenance, string> = {
  DEMO: "Demo data",
  OBSERVED: "Observed",
  CALCULATED: "Calculated",
  MODEL_OUTPUT: "Model output",
  ANALYST_JUDGMENT: "Analyst judgment",
};

export const confidenceLabel: Record<Confidence, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
};

/** Levels ordered so filters and sorts stay consistent everywhere. */
export const levelRank: Record<RiskLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
  UNKNOWN: 0,
};

export const sortByRisk = <T extends { riskLevel: RiskLevel }>(items: T[]) =>
  [...items].sort((a, b) => levelRank[b.riskLevel] - levelRank[a.riskLevel]);
