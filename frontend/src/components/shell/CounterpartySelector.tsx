import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney, riskStyle } from "@/lib/risk";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RiskBadge } from "@/components/common/primitives";
import { useAppState } from "@/state/app-state";

/**
 * Counterparty context switcher. Selection lives in app state, so every page
 * follows the same counterparty as the analyst navigates.
 */
export function CounterpartySelector() {
  const { selectorOpen, setSelectorOpen, counterparties, counterpartyId, setCounterpartyId, dossierFor } =
    useAppState();

  return (
    <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle className="text-base">Change counterparty</DialogTitle>
          <DialogDescription className="text-xs">
            The selected counterparty drives every page in the workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {counterparties.map((c) => {
            const s = riskStyle(c.riskLevel);
            const dossier = dossierFor(c.id);
            const selected = c.id === counterpartyId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCounterpartyId(c.id);
                  setSelectorOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-secondary",
                  selected && "bg-secondary",
                )}
              >
                <span className={cn("h-9 w-[3px] shrink-0 rounded-full", s.dot)} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                    <RiskBadge level={c.riskLevel} size="sm" showDot={false} />
                  </span>
                  <span className="num mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {c.identity.lei} · {c.identity.country} · {c.identity.sector} · {c.bankRelationship}
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="label-caps block">Exposure</span>
                  <span className="num text-sm font-semibold text-foreground">
                    {formatMoney(dossier.exposure.total)}
                  </span>
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
