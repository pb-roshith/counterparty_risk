

import { cn } from "@/lib/utils";
import { riskStyle, trendGlyph } from "@/lib/risk";
import { DemoBadge, PageHeader, ProvenanceTag, RiskBadge, Section } from "@/components/common/primitives";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { riskDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";



export function RiskOverviewPage() {
  const { dossier, openDetail } = useAppState();
  const { risks, overallRisk } = dossier;

  const ranked = [...risks].sort((a, b) => b.score.score - a.score.score);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Risk overview"
        title="Risk breakdown by category"
        actions={<DemoBadge />}
      />

      <div className="panel flex flex-wrap items-center gap-6 p-4">
        <RiskGauge score={Math.round(overallRisk.score)} level={overallRisk.level} size={140} />
        <div className="min-w-[200px] flex-1">
          <p className="label-caps">Composite assessment</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            The composite score follows the configured standalone, network, concentration and event formula.
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

    </div>
  );
}
