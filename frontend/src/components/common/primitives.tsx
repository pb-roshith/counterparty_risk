import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatMoney, provenanceLabel, riskStyle, trendGlyph } from "@/lib/risk";
import type { Money, Provenance, RiskLevel, Trend } from "@/types/risk";

/* ------------------------------ RiskBadge ------------------------------ */

export function RiskBadge({
  level,
  size = "md",
  className,
  showDot = true,
}: {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
  className?: string;
  showDot?: boolean;
}) {
  const s = riskStyle(level);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-semibold uppercase tracking-wider",
        s.bg,
        s.text,
        s.border,
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "md" && "px-2 py-0.5 text-[11px]",
        size === "lg" && "px-2.5 py-1 text-xs",
        className,
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", s.dot)} />}
      {level}
    </span>
  );
}

/* ----------------------------- StatusBadge ----------------------------- */

const statusTone: Record<string, string> = {
  Open: "bg-secondary text-secondary-foreground border-border",
  "In Progress": "bg-risk-moderate-soft text-risk-moderate border-risk-moderate/30",
  "Pending Review": "bg-accent text-accent-foreground border-border",
  Completed: "bg-risk-low-soft text-risk-low border-risk-low/30",
  Escalated: "bg-risk-critical-soft text-risk-critical border-risk-critical/30",
  Breached: "bg-risk-critical-soft text-risk-critical border-risk-critical/30",
  Watch: "bg-risk-moderate-soft text-risk-moderate border-risk-moderate/30",
  "Within Threshold": "bg-risk-low-soft text-risk-low border-risk-low/30",
  VERIFIED: "bg-risk-low-soft text-risk-low border-risk-low/30",
  PENDING: "bg-risk-moderate-soft text-risk-moderate border-risk-moderate/30",
  UNVERIFIED: "bg-risk-unknown-soft text-risk-unknown border-risk-unknown/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium",
        statusTone[status] ?? "bg-secondary text-secondary-foreground border-border",
        className,
      )}
    >
      {status}
    </span>
  );
}

/* --------------------------- ProvenanceTag --------------------------- */

const provenanceTone: Record<Provenance, string> = {
  DEMO: "text-muted-foreground border-border-strong border-dashed",
  OBSERVED: "text-chart-2 border-chart-2/35",
  CALCULATED: "text-chart-1 border-chart-1/35",
  MODEL_OUTPUT: "text-chart-4 border-chart-4/40",
  ANALYST_JUDGMENT: "text-chart-3 border-chart-3/35",
};

export function ProvenanceTag({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  if (provenance === "DEMO") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        provenanceTone[provenance],
        className,
      )}
      title={`Data provenance: ${provenanceLabel[provenance]}`}
    >
      {provenanceLabel[provenance]}
    </span>
  );
}

/* ----------------------------- MetricCard ----------------------------- */

export function MetricCard({
  label,
  value,
  sublabel,
  money,
  level,
  trend,
  provenance,
  onClick,
  className,
  accent = false,
}: {
  label: string;
  value?: string | number;
  sublabel?: string;
  money?: Money;
  level?: RiskLevel;
  trend?: Trend;
  provenance?: Provenance;
  onClick?: () => void;
  className?: string;
  accent?: boolean;
}) {
  const s = level ? riskStyle(level) : null;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "panel group relative overflow-hidden p-4 text-left",
        onClick && "cursor-pointer transition-shadow hover:shadow-raised",
        className,
      )}
    >
      {s && <span className={cn("absolute inset-y-0 left-0 w-[3px]", s.dot)} />}
      {accent && !s && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps">{label}</p>
        {level && <RiskBadge level={level} size="sm" showDot={false} />}
      </div>
      <p className="num mt-2 text-2xl font-semibold text-foreground">
        {money ? formatMoney(money) : (value ?? "—")}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        {trend && (
          <span
            className={cn(
              "num text-[11px]",
              trend === "UP" ? "text-risk-high" : trend === "DOWN" ? "text-risk-low" : "text-muted-foreground",
            )}
          >
            {trendGlyph[trend]}
          </span>
        )}
      </div>
      {provenance && <ProvenanceTag provenance={provenance} className="mt-3" />}
    </Comp>
  );
}

/* ------------------------------ Section ------------------------------ */

export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  dense = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  dense?: boolean;
}) {
  return (
    <section className={cn("panel", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className={cn(dense ? "" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ----------------------------- PageHeader ----------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label-caps">{eyebrow}</p>}
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------ DataFreshnessIndicator ------------------------ */

export function DataFreshnessIndicator({
  label,
  level = "LOW",
  className,
}: {
  label: string;
  level?: RiskLevel;
  className?: string;
}) {
  const s = riskStyle(level);
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span className="relative flex size-2">
        <span className={cn("absolute inset-0 rounded-full node-glow", s.dot)} />
        <span className={cn("relative size-2 rounded-full", s.dot)} />
      </span>
      {label}
    </span>
  );
}

/* ------------------------------ KeyValue ------------------------------ */

export function KeyValueList({
  items,
  columns = 2,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-0",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-4 border-b border-border/70 py-2 last:border-b-0"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="num text-right text-sm font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ DemoRibbon ------------------------------ */

export function DemoBadge(_props: { className?: string }) {
  return null;
}
