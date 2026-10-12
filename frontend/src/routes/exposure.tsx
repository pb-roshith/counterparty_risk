

import { DemoBadge, MetricCard, PageHeader, ProvenanceTag, Section } from "@/components/common/primitives";
import {
  ExposureBarChart,
  ExposureColumnChart,
  ExposureDonutChart,
} from "@/components/exposure/ExposureChart";
import { useAppState } from "@/state/app-state";


export function ExposurePage() {
  const { dossier } = useAppState();
  const { exposure, exposureBreakdown, guarantees } = dossier;

  const byDimension = (dim: string) => exposureBreakdown.filter((i) => i.dimension === dim);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Exposure"
        title="Exposure analysis"
        description="How much the bank stands to lose, and where that exposure is concentrated."
        actions={<DemoBadge />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total exposure" money={exposure.total} provenance={exposure.provenance} />
        <MetricCard label="Funded" money={exposure.funded} />
        <MetricCard label="Unfunded" money={exposure.unfunded} />
        <MetricCard label="Potential future exposure" money={exposure.potentialFutureExposure} level="MODERATE" />
        <MetricCard label="Collateral" money={exposure.collateral} />
        <MetricCard label="Net exposure" money={exposure.net} level="HIGH" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Exposure by product" description="Concentration across banking products." actions={<ProvenanceTag provenance="OBSERVED" />}>
          <ExposureDonutChart data={byDimension("PRODUCT")} />
        </Section>
        <Section title="Exposure by connected entity" description="Exposure carried by entities linked to the counterparty." actions={<ProvenanceTag provenance="CALCULATED" />}>
          <ExposureBarChart data={byDimension("ENTITY")} height={260} />
        </Section>
        <Section title="Exposure by country" description="Cross-border concentration.">
          <ExposureBarChart data={byDimension("COUNTRY")} />
        </Section>
        <Section title="Maturity ladder" description="Repayment profile by bucket.">
          <ExposureColumnChart data={byDimension("MATURITY")} />
        </Section>
      </div>

      <Section
        title="Guarantees"
        description="Third-party support that reduces net exposure."
        dense
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="label-caps px-4 py-2">Guarantor</th>
                <th className="label-caps px-4 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {guarantees.map((g) => (
                <tr key={g.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{g.guarantorName}</td>
                  <td className="px-4 py-2.5 text-xs">{g.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
