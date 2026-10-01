# Synthetic category score formulas

These are illustrative formulas for the demo and manufactured counterparties. They are separate from methodology version 1.1.0 and are **not approved bank policy**. Each score is clipped to 0–100. The `risk_assessments` PostgreSQL table stores the inputs, score, formula text, and `synthetic-category-2.0` model version.

| Category | Illustrative score (0–100) |
| --- | --- |
| Credit | 45% × clipped net debt/EBITDA relative to 8× + 35% × clipped interest-cover shortfall relative to 4× + 20% × clipped covenant-headroom shortfall relative to 30% |
| Default | Clip(PD / 20% × 100) |
| Exposure | Clip(EAD / approved limit × 100) |
| Contagion | 60% × clipped connected EAD / own EAD + 40% × dependency score; manufactured records include a synthetic supplier dependency and its exposure |
| Recovery | Clip((EAD − estimated recovery) / EAD × 100) |
| Country | Supplied synthetic country risk index |
| Sector | Supplied synthetic sector stress index |
| Operational | 60% × incident rate index + 40% × critical dependency index |
| Liquidity | 60% × clipped cash shortfall against short-term debt + 40% × clipped current-ratio shortfall relative to 2× |
| Ownership | 70% × largest owner share + 30% × ownership complexity index |
| Supplier | 65% × largest supplier purchase share + 35% × clipped replacement time relative to 12 months |
| Customer | 65% × largest customer revenue share + 35% × overdue receivables share |
| Funding | 70% × clipped short-term debt / total debt + 30% × clipped cash shortfall against short-term debt |
| Legal | 70% × clipped legal claims / revenue + 30% × open-case index |
| Collateral | 70% × clipped uncovered EAD share + 30% × collateral haircut percentage |

`EAD` is the generated total exposure. Eligible collateral is `market value × (1 − haircut)`. Net exposure is `max(0, EAD − eligible collateral)`. Estimated recovery is `min(EAD, eligible collateral + max(0, EAD − eligible collateral) × (1 − LGD))`.

Manufactured systemic importance is classified from `50% Exposure score + 30% Sector score + 20% Operational score`. The generated overall risk score uses the separate connected counterparty formula: standalone (average Credit, Default, Liquidity), network, concentration (average Exposure, Supplier, Customer), and event (average Operational, Legal) weighted 45/35/10/10. Each manufactured record now has one synthetic Level 2 supplier link so the backend network component is calculated from a stored relationship.

For manufactured records, the generator creates the input measures first and calculates all outputs from them. The original curated demo profiles supply their existing financials, exposures, and relationship data to the backend; missing PD, LGD, haircut, limit, and short-term debt measures use the explicit synthetic assumptions returned by `/api/demo/category-assessment`. The cards remain labeled `DEMO`.

The shared Python entry point is `app.synthetic_model.calculate_all_scores(metrics, relationship, connected_ead)`. It returns all 15 scores, overall risk, estimated recovery, and net exposure. The live portfolio starts empty; Manufacture Data creates synthetic inputs and passes them through this function.
