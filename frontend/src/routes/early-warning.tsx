

import { cn } from "@/lib/utils";
import { riskStyle, trendGlyph } from "@/lib/risk";
import { DemoBadge, MetricCard, PageHeader, ProvenanceTag, Section, StatusBadge } from "@/components/common/primitives";
import { indicatorDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";


export function EarlyWarningPage() {
  const { dossier, openDetail } = useAppState();
  const { indicators } = dossier;

  const breached = indicators.filter((i) => i.status === "Breached").length;
  const watch = indicators.filter((i) => i.status === "Watch").length;
  const adverse = indicators.filter((i) => i.adverse).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Early warning"
        title="Signals of deterioration"
        description="Leading indicators tracked against thresholds, so problems surface before they show up in the score."
        actions={
          <>
            <DemoBadge />
            <ProvenanceTag provenance={dossier.recovery.provenance} />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Indicators tracked" value={indicators.length} accent />
        <MetricCard label="Threshold breached" value={breached} level="CRITICAL" />
        <MetricCard label="On watch" value={watch} level="MODERATE" />
        <MetricCard label="Adverse trend" value={adverse} level="HIGH" />
      </div>

      <Section
        title="Indicator register"
        description="Click an indicator for readings, threshold and status history."
        dense
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="label-caps px-4 py-2">Indicator</th>
                <th className="label-caps px-4 py-2">Category</th>
                <th className="label-caps px-4 py-2 text-right">Current</th>
                <th className="label-caps px-4 py-2 text-right">Previous</th>
                <th className="label-caps px-4 py-2">Trend</th>
                <th className="label-caps px-4 py-2">Threshold</th>
                <th className="label-caps px-4 py-2">Status</th>
                <th className="label-caps px-4 py-2">As of</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind) => (
                <tr
                  key={ind.id}
                  onClick={() => openDetail(indicatorDetail(ind))}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-muted"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{ind.indicator}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{ind.category}</td>
                  <td className="num px-4 py-2.5 text-right font-semibold">{ind.current}</td>
                  <td className="num px-4 py-2.5 text-right text-muted-foreground">{ind.previous}</td>
                  <td
                    className={cn(
                      "num px-4 py-2.5 text-xs",
                      ind.adverse ? riskStyle("HIGH").text : riskStyle("LOW").text,
                    )}
                  >
                    {trendGlyph[ind.trend]}
                  </td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">{ind.threshold}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={ind.status} />
                  </td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">{ind.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
