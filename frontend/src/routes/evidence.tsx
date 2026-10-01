

import { confidenceLabel } from "@/lib/risk";
import { DemoBadge, PageHeader, ProvenanceTag, Section, StatusBadge } from "@/components/common/primitives";
import { evidenceDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";


export function EvidencePage() {
  const { dossier, openDetail } = useAppState();
  const { sources, evidence } = dossier;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Evidence and provenance"
        title="Where every number comes from"
        description="Nothing in this workspace is unsourced. Each item records its origin, owner, freshness and confidence."
        actions={
          <>
            <DemoBadge />
            <ProvenanceTag provenance="OBSERVED" />
          </>
        }
      />

      <Section
        title={`Source register · ${sources.length}`}
        description="Internal and external feeds behind the assessment."
        dense
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="label-caps px-4 py-2">Source</th>
                <th className="label-caps px-4 py-2">Type</th>
                <th className="label-caps px-4 py-2">Origin</th>
                <th className="label-caps px-4 py-2">Data owner</th>
                <th className="label-caps px-4 py-2">Refresh cadence</th>
                <th className="label-caps px-4 py-2">Last refreshed</th>
                <th className="label-caps px-4 py-2">Confidence</th>
                <th className="label-caps px-4 py-2">Verification</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-2.5 text-xs">{s.sourceType}</td>
                  <td className="px-4 py-2.5 text-xs">{s.origin}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.dataOwner}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.refreshCadence}</td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">{s.lastRefreshed}</td>
                  <td className="px-4 py-2.5 text-xs">{confidenceLabel[s.confidence]}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={s.verification} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title={`Evidence items · ${evidence.length}`}
        description="Extracts linked to the risks, relationships and assets they support."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {evidence.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openDetail(evidenceDetail(item))}
              className="rounded-md border border-border bg-surface p-3 text-left transition-shadow hover:shadow-raised"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <span className="label-caps shrink-0">{confidenceLabel[item.confidence]}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.excerpt}</p>
              <p className="num mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                {sources.find((s) => s.id === item.sourceId)?.name ?? item.sourceId} · {item.capturedAt}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Linked to {item.linkedTo.map((l) => l.kind.toLowerCase()).join(", ")}
              </p>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
