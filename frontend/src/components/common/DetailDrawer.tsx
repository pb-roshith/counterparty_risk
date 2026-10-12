import { Link } from "react-router";
import { Network, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { riskStyle } from "@/lib/risk";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProvenanceTag, RiskBadge } from "@/components/common/primitives";
import { useAppState } from "@/state/app-state";

const kindLabel: Record<string, string> = {
  RISK: "Risk detail",
  RELATIONSHIP: "Relationship detail",
  ENTITY: "Entity detail",
  EVIDENCE: "Evidence detail",
  ACTION: "Action detail",
  ASSET: "Asset detail",
};

const actionIcon = (label: string) => {
  if (label.toLowerCase().includes("graph")) return Network;
  return Play;
};

/**
 * Reusable right-side drawer. Every clickable risk, relationship, entity,
 * or action funnels through here so the interaction model is uniform.
 * On small screens the Sheet renders full-width.
 */
export function DetailDrawer() {
  const { detail, closeDetail } = useAppState();

  if (!detail) return null;
  const s = detail.riskLevel ? riskStyle(detail.riskLevel) : null;
  const rows = (detail.rows ?? []).filter((row) => !/\b(evidence|sources?)\b/i.test(row.label));
  const actions = (detail.actions ?? []).filter((action) => action.to !== "/evidence" && !/\b(evidence|sources?)\b/i.test(action.label));

  return (
    <Sheet open onOpenChange={(open) => !open && closeDetail()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[440px]"
      >
        <SheetHeader className={cn("gap-2 border-b border-border p-5", s?.bg)}>
          <p className="label-caps">{kindLabel[detail.kind] ?? "Detail"}</p>
          <SheetTitle className="text-lg leading-snug">{detail.title}</SheetTitle>
          {detail.subtitle && (
            <p className="text-xs text-muted-foreground">{detail.subtitle}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {detail.riskLevel && <RiskBadge level={detail.riskLevel} />}
            {detail.score !== undefined && (
              <span className="num text-sm font-semibold text-foreground">Score {Math.round(detail.score)}</span>
            )}
            {detail.provenance && <ProvenanceTag provenance={detail.provenance} />}
          </div>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {detail.narrative && (
            <p className="text-sm leading-relaxed text-muted-foreground">{detail.narrative}</p>
          )}

          {detail.reasons && detail.reasons.length > 0 && (
            <div>
              <p className="label-caps">{detail.kind === "RISK" ? "Formula" : "Why?"}</p>
              <ul className="mt-2 space-y-1.5">
                {detail.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-foreground">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", s?.dot ?? "bg-primary")} />
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <div>
              <p className="label-caps">Attributes</p>
              <dl className="mt-2">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 border-b border-border/70 py-2 last:border-0"
                  >
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="num text-right text-sm font-medium text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}


          {detail.lastUpdated && (
            <p className="num text-[11px] text-muted-foreground">Last updated {detail.lastUpdated}</p>
          )}
        </div>

        {actions.length > 0 && (
          <div className="sticky bottom-0 mt-auto flex flex-wrap gap-2 border-t border-border bg-surface p-4">
            {actions.map((a) => {
              const Icon = actionIcon(a.label);
              if (a.to) {
                return (
                  <Button key={a.label} asChild variant="outline" size="sm" className="gap-1.5">
                    <Link to={a.to} onClick={closeDetail}>
                      <Icon className="size-3.5" />
                      {a.label}
                    </Link>
                  </Button>
                );
              }
              return (
                <Button
                  key={a.label}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => a.onSelect?.()}
                >
                  <Icon className="size-3.5" />
                  {a.label}
                </Button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
