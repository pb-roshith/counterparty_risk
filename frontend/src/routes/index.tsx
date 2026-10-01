import { Link } from "react-router";
import { useState } from "react";
import { LoaderCircle, Network } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney, riskStyle } from "@/lib/risk";
import { Button } from "@/components/ui/button";
import {
  DemoBadge,
  KeyValueList,
  MetricCard,
  PageHeader,
  RiskBadge,
  Section,
} from "@/components/common/primitives";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { RiskScoreCard } from "@/components/risk/RiskScoreCard";
import { RiskSourceMap } from "@/components/risk/RiskSourceMap";
import { driverDetail, riskDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";
import { generateReportPdf, type ReportSection } from "@/lib/api";


const headlineRiskOrder = [
  "RSK-CREDIT",
  "RSK-DEFAULT",
  "RSK-EXPOSURE",
  "RSK-CONTAGION",
  "RSK-RECOVERY",
  "RSK-COUNTRY",
  "RSK-SECTOR",
  "RSK-OPERATIONAL",
];

export function DashboardPage() {
  const { dossier, openDetail } = useAppState();
  const [generating, setGenerating] = useState<ReportSection[]>([]);
  const [reportError, setReportError] = useState("");
  const { company, overallRisk, risks, riskDrivers, exposure } = dossier;

  async function downloadReport(section: ReportSection) {
    if (generating.includes(section)) return;
    setGenerating((current) => [...current, section]);
    setReportError("");
    try {
      const pdf = await generateReportPdf(section, dossier);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${section}-${company.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Could not generate report");
    } finally {
      setGenerating((current) => current.filter((item) => item !== section));
    }
  }

  const headline = headlineRiskOrder
    .map((id) => risks.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Counterparty risk overview"
        title={company.name}
        actions={
          <>
            <DemoBadge />
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/relationships">
                <Network className="size-3.5" />
                Open relationship graph
              </Link>
            </Button>
          </>
        }
      />

      <section aria-labelledby="ai-reports-title" className="space-y-3">
        <div>
          <h2 id="ai-reports-title" className="text-lg font-semibold">AI summary Report Generation</h2>
          <p className="text-sm text-muted-foreground">Generate and download a two-page PDF summary for this counterparty.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ["exposure", "Exposure"],
            ["contagion", "Contagion Risk"],
            ["risk-overview", "Risk Overview"],
            ["evidence-sources", "Evidence & Sources"],
          ] as const).map(([section, title]) => (
            <div className="panel flex min-h-32 flex-col justify-between gap-4 p-4" key={section}>
              <h3 className="font-semibold">{title}</h3>
              <Button type="button" size="sm" disabled={generating.includes(section)} onClick={() => void downloadReport(section)}>
                {generating.includes(section) ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Generating PDF…</> : "Generate report"}
              </Button>
            </div>
          ))}
        </div>
        {reportError && <p role="alert" className="text-sm text-destructive">{reportError}</p>}
      </section>

      {/* Overall risk + headline category scores */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="panel flex flex-col items-center p-5">
          <div className="flex w-full items-center justify-between">
            <p className="label-caps">Overall risk</p>
            <RiskBadge level={overallRisk.level} />
          </div>
          <RiskGauge
            score={overallRisk.score}
            level={overallRisk.level}
            label={overallRisk.previousScore === undefined ? `Backend calculation · ${overallRisk.provenance.toLowerCase()}` : `Previous ${overallRisk.previousScore} · demo data`}
            className="mt-3"
          />
          <div className="mt-4 w-full border-t border-border pt-3">
            <KeyValueList
              columns={1}
              items={[
                { label: "Bank relationship", value: company.bankRelationship },
                { label: "Total exposure", value: formatMoney(exposure.total) },
                { label: "Net exposure", value: formatMoney(exposure.net) },
                {
                  label: "Systemic importance",
                  value: (
                    <RiskBadge level={company.criticality.systemicImportance} size="sm" showDot={false} />
                  ),
                },
              ]}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {headline.map((risk) => (
            <RiskScoreCard key={risk.id} risk={risk} onSelect={(r) => openDetail(riskDetail(r))} />
          ))}
        </div>
      </div>

      {/* Risk source map */}
      <Section
        title="Risk Source Map"
        description="Where the risk comes from. Node size reflects materiality, colour reflects risk level."
        actions={<DemoBadge />}
        dense
      >
        <RiskSourceMap
          companyName={company.name}
          overallScore={overallRisk.score}
          overallLevel={overallRisk.level}
          risks={risks}
          onSelectRisk={(r) => openDetail(riskDetail(r))}
        />
      </Section>

      <div >
        {/* Key risk drivers */}
        <Section
          title="Key Risk Drivers"
          description="Why the counterparty is risky, ranked by severity."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {riskDrivers.map((driver) => {
              const s = riskStyle(driver.severity);
              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => openDetail(driverDetail(driver))}
                  className="group rounded-md border border-border bg-surface p-3 text-left transition-shadow hover:shadow-raised"
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", s.dot)} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{driver.title}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {driver.riskCategory} · {driver.severity}
                      </p>
                    </div>
                  </div>
                  {driver.impact && driver.impact !== "Review the synthetic inputs and formula before using this score for a decision." && <p className="mt-2 border-t border-border pt-2 text-xs leading-relaxed text-foreground">
                    <span className="label-caps mr-1.5">Impact</span>
                    {driver.impact}
                  </p>}
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    {driver.exposure && <span className="num text-muted-foreground">{formatMoney(driver.exposure)}</span>}
                    <span className="font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      View details →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

      </div>

      {/* Exposure strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total exposure" money={exposure.total} provenance={exposure.provenance} />
        <MetricCard label="Net exposure" money={exposure.net} level={risks.find((risk) => risk.id === "RSK-EXPOSURE")?.score.level ?? "UNKNOWN"} />
        <MetricCard label="Collateral held" money={exposure.collateral} level={risks.find((risk) => risk.id === "RSK-COLLATERAL")?.score.level ?? "UNKNOWN"} />
        <MetricCard
          label="Estimated recovery"
          money={dossier.recovery.estimatedRecovery}
          sublabel={`${dossier.recovery.recoveryPct}% of exposure`}
          provenance={dossier.recovery.provenance}
        />
      </div>
    </div>
  );
}
