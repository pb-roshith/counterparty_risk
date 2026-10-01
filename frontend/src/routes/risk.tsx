
import { useState } from "react";

import { cn } from "@/lib/utils";
import { formatMoney, formatPct, riskStyle, trendGlyph } from "@/lib/risk";
import { DemoBadge, PageHeader, ProvenanceTag, RiskBadge, Section } from "@/components/common/primitives";
import { SegmentedControl } from "@/components/common/FilterBar";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { riskDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";


type View = "TABLE" | "HEATMAP";

export function RiskOverviewPage() {
  const { dossier, openDetail } = useAppState();
  const { risks, overallRisk } = dossier;
  const [view, setView] = useState<View>("HEATMAP");

  const ranked = [...risks].sort((a, b) => b.score.score - a.score.score);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Risk overview"
        title="Risk breakdown by category"
        actions={
          <>
            <DemoBadge />
            <SegmentedControl<View>
              value={view}
              onChange={setView}
              size="sm"
              options={[
                { id: "TABLE", label: "Table" },
                { id: "HEATMAP", label: "Heatmap" },
              ]}
            />
          </>
        }
      />

      <div className="panel flex flex-wrap items-center gap-6 p-4">
        <RiskGauge score={Math.round(overallRisk.score)} level={overallRisk.level} size={140} />
        <div className="min-w-[200px] flex-1">
          <p className="label-caps">Composite assessment</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            The composite score follows the configured standalone, network, concentration and event formula.
            Synthetic category formulas are illustrative and must
            be calibrated before use with bank data.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RiskBadge level={overallRisk.level} />
            <ProvenanceTag provenance={overallRisk.provenance} />
            {overallRisk.previousScore !== undefined && <span className="num text-xs text-muted-foreground">
              Previous {Math.round(overallRisk.previousScore)} {trendGlyph[overallRisk.trend]}
            </span>}
          </div>
        </div>
      </div>

      {view === "TABLE" && (
        <Section title="Risk register" description="Click a row to see its formula and available inputs." dense>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left">
                  <th className="label-caps px-4 py-2">Risk</th>
                  <th className="label-caps px-4 py-2 text-right">Score</th>
                  <th className="label-caps px-4 py-2 text-right">Previous</th>
                  <th className="label-caps px-4 py-2">Trend</th>
                  <th className="label-caps px-4 py-2 text-right">Materiality</th>
                  <th className="label-caps px-4 py-2 text-right">Exposure</th>
                  <th className="label-caps px-4 py-2">Potential impact</th>
                  <th className="label-caps px-4 py-2">Level</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((risk) => (
                  <tr
                    key={risk.id}
                    onClick={() => openDetail(riskDetail(risk))}
                    className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{risk.category}</p>
                      <p className="text-[11px] text-muted-foreground">{risk.label}</p>
                    </td>
                    <td className="num px-4 py-2.5 text-right font-semibold">{Math.round(risk.score.score)}</td>
                    <td className="num px-4 py-2.5 text-right text-muted-foreground">
                      {risk.score.previousScore === undefined ? "—" : Math.round(risk.score.previousScore)}
                    </td>
                    <td className="num px-4 py-2.5">{trendGlyph[risk.score.trend]}</td>
                    <td className="num px-4 py-2.5 text-right">{formatPct(risk.materiality)}</td>
                    <td className="num px-4 py-2.5 text-right">{formatMoney(risk.exposure)}</td>
                    <td className="px-4 py-2.5">
                      <RiskBadge level={risk.potentialImpact} size="sm" showDot={false} />
                    </td>
                    <td className="px-4 py-2.5">
                      <RiskBadge level={risk.score.level} size="sm" showDot={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {view === "HEATMAP" && (
        <Section
          title="Risk heatmap"
          description="Risk scores by category."
        >
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {ranked.map((risk) => {
              const displayLevel = risk.score.level === "HIGH" ? "CRITICAL" : risk.score.level;
              const s = riskStyle(displayLevel);
              return (
                <button
                  key={risk.id}
                  type="button"
                  onClick={() => openDetail(riskDetail(risk))}
                  style={{ opacity: 0.55 + risk.materiality * 0.45 }}
                  className={cn(
                    "flex flex-col justify-between rounded-md border p-3 text-left transition-transform hover:scale-[1.02]",
                    s.bg,
                    s.border,
                  )}
                >
                  <span className={cn("text-xs font-semibold uppercase tracking-wider", s.text)}>
                    {risk.category}
                  </span>
                  <span className="num mt-4 text-2xl font-semibold text-foreground">
                    {Math.round(risk.score.score)}
                  </span>
                  <span className={cn("text-xs font-semibold uppercase", s.text)}>
                    {displayLevel}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

    </div>
  );
}
