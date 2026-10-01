import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney, levelRank, riskStyle } from "@/lib/risk";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DemoBadge, PageHeader, RiskBadge, Section } from "@/components/common/primitives";
import { SegmentedControl } from "@/components/common/FilterBar";
import { useAppState } from "@/state/app-state";
import type { RiskLevel } from "@/types/risk";


type LevelFilter = "ALL" | RiskLevel;

export function CounterpartiesPage() {
  const { counterparties, counterpartyId, setCounterpartyId, dossierFor } = useAppState();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return counterparties
      .filter((c) => (level === "ALL" ? true : c.riskLevel === level))
      .filter((c) =>
        q
          ? [c.name, c.identity.lei, c.customerId, c.identity.registrationNumber, c.identity.sector]
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      )
      .map((c) => ({ company: c, dossier: dossierFor(c.id) }))
      .sort((a, b) => levelRank[b.company.riskLevel] - levelRank[a.company.riskLevel]);
  }, [counterparties, dossierFor, query, level]);

  const select = (id: string) => {
    setCounterpartyId(id);
    void navigate(`/counterparty/${id}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Portfolio"
        title="Counterparties"
        description="Screen the corporate banking book and set the working counterparty context."
        actions={<DemoBadge />}
      />

      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company, LEI, customer ID, registration number…"
            className="h-9 pl-9 text-xs"
          />
        </div>
        <SegmentedControl<LevelFilter>
          value={level}
          onChange={setLevel}
          size="sm"
          options={[
            { id: "ALL", label: "All" },
            { id: "LOW", label: "Low" },
            { id: "MODERATE", label: "Moderate" },
            { id: "CRITICAL", label: "Critical" },
          ]}
        />
      </div>

      <Section title={`${rows.length} counterparties`} description="Click a row to load it into context." dense>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="label-caps px-4 py-2">Counterparty</th>
                <th className="label-caps px-4 py-2">LEI / Customer ID</th>
                <th className="label-caps px-4 py-2">Country</th>
                <th className="label-caps px-4 py-2">Sector</th>
                <th className="label-caps px-4 py-2">Relationship</th>
                <th className="label-caps px-4 py-2 text-right">Exposure</th>
                <th className="label-caps px-4 py-2 text-right">Score</th>
                <th className="label-caps px-4 py-2">Risk</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ company, dossier }) => (
                <tr
                  key={company.id}
                  onClick={() => select(company.id)}
                  className={cn(
                    "cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-muted",
                    company.id === counterpartyId && "bg-accent/50",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("h-8 w-[3px] rounded-full", riskStyle(company.riskLevel).dot)} />
                      <div>
                        <p className="font-medium text-foreground">{company.name}</p>
                        <p className="text-[11px] text-muted-foreground">{company.identity.industry}</p>
                      </div>
                    </div>
                  </td>
                  <td className="num px-4 py-3 text-xs text-muted-foreground">
                    {company.identity.lei}
                    <br />
                    {company.customerId}
                  </td>
                  <td className="px-4 py-3 text-xs">{company.identity.country}</td>
                  <td className="px-4 py-3 text-xs">{company.identity.sector}</td>
                  <td className="px-4 py-3 text-xs">{company.bankRelationship}</td>
                  <td className="num px-4 py-3 text-right font-medium">
                    {formatMoney(dossier.exposure.total)}
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold">{company.riskScore === undefined ? "—" : Math.round(company.riskScore)}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={company.riskLevel} size="sm" showDot={false} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Open counterparty">
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
