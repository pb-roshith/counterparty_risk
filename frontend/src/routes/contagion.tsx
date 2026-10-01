
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import { formatMoney, formatPct } from "@/lib/risk";
import { DemoBadge, MetricCard, PageHeader, ProvenanceTag } from "@/components/common/primitives";
import { useAppState } from "@/state/app-state";


export function ContagionPage() {
  const { dossier, openDetail } = useAppState();
  const paths = dossier.contagionPaths;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(paths.length / 10));
  useEffect(() => setPage(0), [dossier.company.id]);
  const currentPage = Math.min(page, pageCount - 1);
  const visiblePaths = paths.slice(currentPage * 10, currentPage * 10 + 10);

  const pagination = (
    <nav aria-label="Contagion paths pagination" className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
      <span className="text-sm text-muted-foreground">{paths.length ? `${currentPage * 10 + 1}–${Math.min((currentPage + 1) * 10, paths.length)} of ${paths.length}` : "0 paths"}</span>
      <Button variant="outline" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</Button>
    </nav>
  );

  const totalAtRisk = paths.reduce((sum, p) => sum + p.exposure.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contagion"
        title="How risk could spread"
        description="Each path traces distress from the counterparty through connected entities, and shows where it returns to the bank."
        actions={<DemoBadge />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Transmission paths" value={paths.length} accent />
        <MetricCard
          label="Sum of path exposures"
          money={{ amount: totalAtRisk, currency: "INR", unit: "Cr" }}
          provenance="CALCULATED"
        />
        <MetricCard
          label="Direct bank exposure"
          money={dossier.exposure.total}
          provenance={dossier.exposure.provenance}
        />
      </div>

      <div className="space-y-3">
        {pagination}
        {visiblePaths.map((path) => {
          return (
            <article key={path.id} className="panel overflow-hidden">
              <header
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{path.transmissionChannel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="num">
                    <span className="label-caps mr-1.5">Exposure</span>
                    {formatMoney(path.exposure)}
                  </span>
                  <span className="num">
                    <span className="label-caps mr-1.5">Dependency</span>
                    {formatPct(path.dependency)}
                  </span>
                  <ProvenanceTag provenance={path.provenance} />
                </div>
              </header>

              <div className="flex flex-wrap items-center gap-2 px-4 py-4">
                {path.hops.map((hop, i) => (
                  <div key={`${path.id}-${hop.entityId}`} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openDetail({
                          kind: "ENTITY",
                          title: hop.entityName,
                          subtitle: `${hop.entityType.toLowerCase()} · hop ${i + 1} of ${path.hops.length}`,
                          provenance: path.provenance,
                          rows: [
                            { label: "Entity ID", value: hop.entityId },
                            { label: "Relationship", value: hop.relationshipType ?? "—" },
                            { label: "Channel", value: path.transmissionChannel },
                          ],
                          actions: [{ label: "View Graph", to: "/relationships" }],
                        })
                      }
                      className="rounded-md border border-border bg-surface px-3 py-2 text-left transition-shadow hover:shadow-raised"
                    >
                      <span className="block text-xs font-semibold text-foreground">{hop.entityName}</span>
                      <span className="label-caps block">{hop.entityType}</span>
                    </button>
                    {i < path.hops.length - 1 && (
                      <div className="flex flex-col items-center">
                        <ArrowRight className="size-4 text-muted-foreground" />
                        {path.hops[i + 1]?.relationshipType && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {path.hops[i + 1]?.relationshipType}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </article>
          );
        })}
        {pagination}
      </div>

    </div>
  );
}
