
import { Download, FileBarChart, Printer } from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/risk";
import { AS_OF_DATE } from "@/data/demo";
import { Button } from "@/components/ui/button";
import {
  DemoBadge,
  KeyValueList,
  PageHeader,
  ProvenanceTag,
  RiskBadge,
  Section,
} from "@/components/common/primitives";
import { useAppState } from "@/state/app-state";


const reportPacks = [
  {
    id: "RPT-CREDIT",
    name: "Credit committee pack",
    description:
      "Full dossier: identity, risk breakdown, exposure, collateral, contagion and recommended actions.",
    sections: 9,
    audience: "Credit Committee",
  },
  {
    id: "RPT-EXPOSURE",
    name: "Exposure summary",
    description: "Funded and unfunded exposure with concentration and maturity analysis.",
    sections: 4,
    audience: "Portfolio Risk",
  },
  {
    id: "RPT-CONTAGION",
    name: "Contagion review",
    description: "Relationship graph and transmission paths.",
    sections: 5,
    audience: "Systemic Risk",
  },
  {
    id: "RPT-EVIDENCE",
    name: "Evidence appendix",
    description: "Source register, evidence extracts and provenance for audit.",
    sections: 3,
    audience: "Internal Audit",
  },
];

export function ReportsPage() {
  const { dossier } = useAppState();
  const { company, overallRisk, exposure, recovery } = dossier;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reporting"
        title="Risk reports"
        description="Assemble committee-ready packs from the current assessment. Export wiring is stubbed in this build."
        actions={
          <>
            <DemoBadge />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Print view
            </Button>
          </>
        }
      />

      <Section
        title="Executive summary"
        description={`Auto-drafted from the current assessment as of ${AS_OF_DATE}.`}
        actions={<ProvenanceTag provenance="MODEL_OUTPUT" />}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {company.name} carries an overall risk score of {Math.round(overallRisk.score)} ({overallRisk.level}).
          Total exposure stands at {formatMoney(exposure.total)}, of which{" "}
          {formatMoney(exposure.net)} is unsecured after collateral. Estimated recovery under default
          is {formatMoney(recovery.estimatedRecovery)}, around {recovery.recoveryPct}% of exposure.
          The dominant drivers are concentration in the counterparty's connected group and
          deteriorating leverage headroom.
        </p>
        <div className="mt-4">
          <KeyValueList
            items={[
              { label: "Counterparty", value: company.name },
              { label: "Overall risk", value: <RiskBadge level={overallRisk.level} size="sm" showDot={false} /> },
              { label: "Score", value: String(Math.round(overallRisk.score)) },
              { label: "Total exposure", value: formatMoney(exposure.total) },
              { label: "Net exposure", value: formatMoney(exposure.net) },
              { label: "Estimated recovery", value: formatMoney(recovery.estimatedRecovery) },
            ]}
          />
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        {reportPacks.map((pack) => (
          <article key={pack.id} className="panel flex flex-col p-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm bg-secondary">
                <FileBarChart className="size-4 text-secondary-foreground" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{pack.name}</p>
                <p className="num text-[11px] uppercase tracking-wider text-muted-foreground">
                  {pack.sections} sections · {pack.audience}
                </p>
              </div>
            </div>
            <p className="mt-2.5 flex-1 text-xs leading-relaxed text-muted-foreground">
              {pack.description}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() =>
                toast.info(`${pack.name} queued`, {
                  description: "Export is not wired up in this framework build.",
                })
              }
            >
              <Download className="size-3.5" />
              Generate report
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
