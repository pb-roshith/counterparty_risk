import type { ManufacturedCounterparty } from "@/lib/api";
import { formatMoney } from "@/lib/risk";
import type { DetailPayload } from "@/state/app-state";
import type { CounterpartyDossier } from "@/types/risk";

/** Shared calculation descriptions for metrics wherever they appear. */
export function metricDetail(label: string, dossier: CounterpartyDossier, record?: ManufacturedCounterparty): DetailPayload | undefined {
  const { exposure: e, recovery: r } = dossier;
  const exposureRows = [
    { label: "Total exposure (EAD)", value: formatMoney(e.total) },
    { label: "Collateral held", value: formatMoney(e.collateral) },
  ];
  if (label === "Eligible collateral") {
    const marketValue = record?.collateral_market_value;
    const haircut = record?.collateral_haircut ?? r.blendedHaircutPct / 100;
    return {
      kind: "RISK", title: label, subtitle: "Collateral calculation and available inputs",
      narrative: "This card shows the collateral value before haircuts. The recovery calculation applies the haircut to determine the eligible amount used for recovery.",
      reasons: [
        marketValue ? "Displayed eligible collateral = collateral market value (before haircut)" : record ? "Displayed eligible collateral = collateral held (fallback when market value is unavailable)" : "Displayed eligible collateral = the supplied recovery.eligibleCollateral value",
        "Eligible collateral used for recovery = collateral market value × (1 - haircut)",
      ],
      rows: [
        { label: "Displayed eligible collateral", value: formatMoney(r.eligibleCollateral) },
        { label: "Collateral market value", value: marketValue ? formatMoney(marketValue) : record ? "Not available in the current data" : formatMoney(r.eligibleCollateral) },
        { label: "Haircut", value: `${Number((haircut * 100).toFixed(2))}%` },
        { label: "Calculation", value: `${marketValue?.amount ?? r.eligibleCollateral.amount} × (1 - ${haircut})` },
        { label: "Post-haircut value used for recovery", value: formatMoney(e.collateral) },
      ],
      provenance: r.provenance,
    };
  }
  const formulas: Record<string, { formula: string; rows?: DetailPayload["rows"] }> = {
    "Total exposure": { formula: record ? "Total exposure = funded exposure + unfunded exposure." : "Total exposure = funded exposure + unfunded exposure + potential future exposure", rows: [
      { label: "Funded exposure", value: formatMoney(e.funded) },
      { label: "Unfunded exposure", value: formatMoney(e.unfunded) },
      { label: "Potential future exposure", value: formatMoney(e.potentialFutureExposure) },
      { label: "Total exposure", value: formatMoney(e.total) },
    ] },
    "Net exposure": { formula: "Net exposure = max(0, total exposure - collateral held)", rows: [...exposureRows, { label: "Net exposure", value: formatMoney(e.net) }] },
    "Collateral held": { formula: "Collateral held = collateral market value × (1 - haircut)", rows: [
      { label: "Collateral market value", value: formatMoney(record?.collateral_market_value ?? r.eligibleCollateral) },
      { label: "Haircut", value: `${(record?.collateral_haircut ?? r.blendedHaircutPct / 100) * 100}%` },
      { label: "Post-haircut value", value: formatMoney(e.collateral) },
    ] },
    "Estimated recovery": { formula: record?.recovery?.formula ?? "min(EAD, eligible collateral + max(0, EAD - eligible collateral) × (1 - LGD))", rows: [
      ...exposureRows,
      ...(record ? [{ label: "Loss given default (LGD)", value: `${record.exposure.lgd * 100}%` }] : []),
      { label: "Estimated recovery", value: formatMoney(r.estimatedRecovery) },
      { label: "Recovery percentage", value: `${r.recoveryPct}%` },
    ] },
    "Blended haircut": { formula: "Blended haircut (%) = (1 - post-haircut collateral value / collateral market value) × 100", rows: [
      { label: "Collateral market value", value: formatMoney(r.eligibleCollateral) },
      { label: "Post-haircut value", value: formatMoney(r.collateralValue) },
    ] },
    "Transmission paths": { formula: "Count of mapped contagion paths" },
    "Sum of path exposures": { formula: "Sum of exposure amounts across all contagion paths (paths may overlap)", rows: dossier.contagionPaths.map((p) => ({ label: p.id, value: formatMoney(p.exposure) })) },
    "Total actions": { formula: "Count of all risk actions" },
    "P1 priority": { formula: "Count of risk actions where priority = P1" },
    "Open": { formula: "Count of risk actions where status = Open" },
    "Escalated": { formula: "Count of risk actions where status = Escalated" },
    "Indicators tracked": { formula: "Count of all early warning indicators" },
    "Threshold breached": { formula: "Count of indicators where status = Breached" },
    "On watch": { formula: "Count of indicators where status = Watch" },
    "Adverse trend": { formula: "Count of indicators marked as adverse" },
    "Overall risk": { formula: "Overall risk = 0.45 × standalone risk + 0.35 × network risk + 0.10 × concentration risk + 0.10 × event risk" },
  };
  const aliases: Record<string, string> = { "Collateral": "Collateral held", "Post-haircut value": "Collateral held", "Direct bank exposure": "Total exposure" };
  if (label === "Assets and recovery") {
    return {
      kind: "RISK", title: label, subtitle: "Recovery calculation and available inputs",
      reasons: [
        "Post-haircut collateral = collateral market value × (1 - haircut)",
        "Unsecured exposure = max(0, EAD - post-haircut collateral)",
        "Estimated recovery = min(EAD, post-haircut collateral + unsecured exposure × (1 - LGD))",
        "Recovery percentage = estimated recovery / EAD × 100 (rounded; 0 when EAD is 0)",
      ],
      narrative: "EAD is total exposure. LGD is loss given default, expressed as a fraction. Total assets and collateral market value are source inputs to the recovery assessment.",
      rows: [
        { label: "Total assets", value: formatMoney(r.totalAssets) },
        { label: "Collateral market value", value: formatMoney(record?.collateral_market_value ?? r.eligibleCollateral) },
        { label: "Haircut", value: `${(record?.collateral_haircut ?? r.blendedHaircutPct / 100) * 100}%` },
        ...exposureRows,
        { label: "Unsecured exposure", value: formatMoney({ ...e.total, amount: Math.max(0, e.total.amount - e.collateral.amount) }) },
        { label: "LGD", value: record ? `${record.exposure.lgd * 100}%` : "Not available in the current data" },
        { label: "Estimated recovery", value: formatMoney(r.estimatedRecovery) },
        { label: "Recovery percentage", value: `${r.recoveryPct}%` },
      ],
      provenance: r.provenance,
    };
  }
  const calculation = formulas[aliases[label] ?? label];
  if (!calculation) return undefined;
  return { kind: "RISK", title: label, subtitle: "Calculation and available inputs", reasons: [calculation.formula], rows: calculation.rows, provenance: dossier.exposure.provenance };
}
