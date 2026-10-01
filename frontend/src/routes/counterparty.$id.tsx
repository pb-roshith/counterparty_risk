import { Link, useParams } from "react-router";
import { useEffect } from "react";
import { Network } from "lucide-react";

import { formatMoney, formatNumber } from "@/lib/risk";
import { Button } from "@/components/ui/button";
import {
  DemoBadge,
  KeyValueList,
  MetricCard,
  PageHeader,
  ProvenanceTag,
  RiskBadge,
  Section,
} from "@/components/common/primitives";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { useAppState } from "@/state/app-state";


export function CompanyOverviewPage() {
  const { id } = useParams();
  const { counterpartyId, setCounterpartyId, dossierFor, dossier: activeDossier } = useAppState();

  // Deep links set the working context so the rest of the workspace follows.
  useEffect(() => {
    if (id && id !== counterpartyId) setCounterpartyId(id);
  }, [id, counterpartyId, setCounterpartyId]);

  const dossier = id === counterpartyId ? activeDossier : dossierFor(id ?? "");
  const { company, overallRisk, exposure, recovery } = dossier;
  const p = company.businessProfile;
  const identity = company.identity;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Company overview"
        title={company.name}
        description={`${identity.industry} · ${identity.sector} · ${identity.country}`}
        actions={
          <>
            <DemoBadge />
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/relationships">
                <Network className="size-3.5" />
                Relationship graph
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/">Risk dashboard</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="panel flex flex-col items-center p-5">
          <div className="flex w-full items-center justify-between">
            <p className="label-caps">Overall risk</p>
            <RiskBadge level={overallRisk.level} />
          </div>
          <RiskGauge score={overallRisk.score} level={overallRisk.level} size={180} className="mt-3" />
          <ProvenanceTag provenance={overallRisk.provenance} className="mt-2" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Total exposure" money={exposure.total} provenance={exposure.provenance} />
          <MetricCard label="Net exposure" money={exposure.net} level={dossier.risks.find((risk) => risk.id === "RSK-EXPOSURE")?.score.level ?? "UNKNOWN"} />
          <MetricCard
            label="Estimated recovery"
            money={recovery.estimatedRecovery}
            sublabel={`${recovery.recoveryPct}%`}
          />
          <MetricCard label="Revenue" money={p.revenue} sublabel={p.fiscalYear} provenance={company.provenance} />
          <MetricCard label="EBITDA" money={p.ebitda} sublabel={p.fiscalYear} provenance={company.provenance} />
          <MetricCard label="Employees" value={formatNumber(p.employees)} provenance={company.provenance} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Company Identity"
          description="Golden-source identity attributes."
          actions={<ProvenanceTag provenance={company.provenance} />}
        >
          <KeyValueList
            columns={1}
            items={[
              { label: "Legal name", value: identity.legalName },
              { label: "LEI", value: identity.lei ?? "—" },
              { label: "Registration number", value: identity.registrationNumber ?? "—" },
              { label: "Country of incorporation", value: identity.country },
              { label: "Incorporation date", value: identity.incorporationDate ?? "—" },
              { label: "Industry", value: identity.industry },
              { label: "Sector", value: identity.sector },
              { label: "Parent", value: identity.parentName ?? "—" },
              { label: "Ultimate beneficial owner", value: identity.uboName ?? "—" },
              { label: "Listing status", value: identity.listing.replace("_", " ") },
              { label: "Bank customer ID", value: company.customerId ?? "—" },
              { label: "Bank relationship", value: company.bankRelationship },
            ]}
          />
        </Section>

        <div className="space-y-4">
          <Section
            title="Business Profile"
            description={`Financials for ${p.fiscalYear}.`}
            actions={<ProvenanceTag provenance={company.provenance} />}
          >
            <KeyValueList
              columns={1}
              items={[
                { label: "Revenue", value: formatMoney(p.revenue) },
                { label: "EBITDA", value: formatMoney(p.ebitda) },
                { label: "Total assets", value: formatMoney(p.totalAssets) },
                { label: "Total liabilities", value: formatMoney(p.totalLiabilities) },
                { label: "Debt", value: formatMoney(p.debt) },
                { label: "Cash", value: formatMoney(p.cash) },
                { label: "Employees", value: formatNumber(p.employees) },
              ]}
            />
          </Section>

        </div>
      </div>
    </div>
  );
}