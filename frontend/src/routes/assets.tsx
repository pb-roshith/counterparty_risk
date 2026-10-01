

import { formatMoney } from "@/lib/risk";
import { DemoBadge, MetricCard, PageHeader, ProvenanceTag, Section } from "@/components/common/primitives";
import { assetDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";


const encumbranceLabel: Record<string, string> = {
  UNENCUMBERED: "Unencumbered",
  PARTIALLY_ENCUMBERED: "Partially encumbered",
  ENCUMBERED: "Encumbered",
};

export function AssetsPage() {
  const { dossier, openDetail } = useAppState();
  const { assets, recovery } = dossier;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Assets and recovery"
        title="What could be recovered"
        description="Assets available to the bank, how much of them is pledged, and the recovery estimate after haircuts."
        actions={<DemoBadge />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total assets" money={recovery.totalAssets} provenance="OBSERVED" />
        <MetricCard label="Eligible collateral" money={recovery.eligibleCollateral} />
        <MetricCard label="Post-haircut value" money={recovery.collateralValue} />
        <MetricCard label="Blended haircut" value={`${recovery.blendedHaircutPct}%`} level="MODERATE" />
        <MetricCard
          label="Estimated recovery"
          money={recovery.estimatedRecovery}
          sublabel={`${recovery.recoveryPct}% of exposure`}
          provenance={recovery.provenance}
        />
      </div>

      <Section
        title="Asset register"
        description="Click an asset for valuation, ownership and encumbrance detail."
        actions={<ProvenanceTag provenance="OBSERVED" />}
        dense
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="label-caps px-4 py-2">Asset</th>
                <th className="label-caps px-4 py-2">Type</th>
                <th className="label-caps px-4 py-2">Ownership</th>
                <th className="label-caps px-4 py-2 text-right">Gross value</th>
                <th className="label-caps px-4 py-2 text-right">Haircut</th>
                <th className="label-caps px-4 py-2 text-right">Collateral value</th>
                <th className="label-caps px-4 py-2">Encumbrance</th>
                <th className="label-caps px-4 py-2 text-right">Priority</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => openDetail(assetDetail(a))}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-muted"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{a.name}</td>
                  <td className="px-4 py-2.5 text-xs">{a.type}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.ownership}</td>
                  <td className="num px-4 py-2.5 text-right">{formatMoney(a.value)}</td>
                  <td className="num px-4 py-2.5 text-right">{a.haircutPct}%</td>
                  <td className="num px-4 py-2.5 text-right font-medium">{formatMoney(a.collateralValue)}</td>
                  <td className="px-4 py-2.5 text-xs">{encumbranceLabel[a.encumbrance]}</td>
                  <td className="num px-4 py-2.5 text-right">{a.recoveryPriority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>


    </div>
  );
}
