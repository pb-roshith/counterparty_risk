import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { generateManufacturedCounterparties } from "@/lib/api";
import { formatMoney } from "@/lib/risk";
import { useAppState } from "@/state/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoBadge, PageHeader, RiskBadge, Section } from "@/components/common/primitives";

export function ManufactureDataPage() {
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { manufactured, refreshManufactured, setCounterpartyId } = useAppState();
  const navigate = useNavigate();

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    const requested = Number(count);
    if (!Number.isInteger(requested) || requested < 1 || requested > 1000) {
      setError("Enter a whole number from 1 to 1000.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await generateManufacturedCounterparties(requested);
      await refreshManufactured();
      setMessage(`${result.created_count} synthetic counterparties saved to PostgreSQL. Batch ${result.batch_id.slice(0, 8)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-5">
    <PageHeader eyebrow="Synthetic data" title="Manufacture Data"
      description="Generate fictional counterparty records for development and testing. Records persist in PostgreSQL."
      actions={<DemoBadge />} />
    <Section title="Generate counterparties" description="Each synthetic record includes company identity, financials, exposure, recovery and 15 formula-calculated risk categories.">
      <form onSubmit={(event) => void generate(event)} className="flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1.5 text-xs font-medium" htmlFor="manufacture-count">
          Number of counterparties
          <Input id="manufacture-count" type="number" min={1} max={1000} step={1} required
            value={count} onChange={(event) => setCount(event.target.value)} className="w-48" />
        </label>
        <Button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate"}</Button>
      </form>
      {message && <p role="status" className="px-4 pb-4 text-sm text-foreground">{message}</p>}
      {error && <p role="alert" className="px-4 pb-4 text-sm text-destructive">{error}</p>}
    </Section>
    <Section title={`${manufactured.length} generated counterparties`} description="Saved synthetic records. Select one to view its available details." dense>
      <div className="max-h-[540px] overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-border bg-surface-muted text-left">
            <th className="px-4 py-2">Counterparty</th><th className="px-4 py-2">Sector</th>
            <th className="px-4 py-2">Country</th><th className="px-4 py-2 text-right">EAD</th>
            <th className="px-4 py-2 text-right">Risk score</th><th className="px-4 py-2">Risk</th>
          </tr></thead>
          <tbody>{manufactured.map((record) => <tr key={record.company.id} className="cursor-pointer border-b border-border/70 hover:bg-surface-muted"
            onClick={() => { setCounterpartyId(record.company.id); void navigate(`/counterparty/${record.company.id}`); }}>
            <td className="px-4 py-3 font-medium">{record.company.name}</td>
            <td className="px-4 py-3">{record.company.identity.sector}</td>
            <td className="px-4 py-3">{record.company.country}</td>
            <td className="px-4 py-3 text-right">{formatMoney({ amount: record.exposure.ead, currency: "INR", unit: "Cr" })}</td>
            <td className="px-4 py-3 text-right">{Math.round(record.risk.score)}</td>
            <td className="px-4 py-3"><RiskBadge level={record.company.riskLevel} size="sm" /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </Section>
  </div>;
}
