import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Building2, Network } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RiskBadge } from "@/components/common/primitives";
import { nodeDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";

/** Global company / entity search. Selecting a client counterparty switches context. */
export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { counterparties, manufactured, setCounterpartyId, openDetail } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const connected = manufactured.flatMap((record) => record.graph_data?.nodes.filter((node) => node.id !== record.company.id) ?? []);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search company, LEI, customer ID, registration number…" />
      <CommandList>
        <CommandEmpty>No matching counterparty.</CommandEmpty>
        <CommandGroup heading="Bank counterparties">
          {counterparties.map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.name} ${c.identity.lei} ${c.customerId} ${c.identity.registrationNumber} ${c.identity.sector}`}
              onSelect={() => {
                setCounterpartyId(c.id);
                onOpenChange(false);
                void navigate("/");
              }}
              className="gap-2"
            >
              <Building2 className="size-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="num hidden text-[11px] text-muted-foreground sm:inline">
                {c.identity.lei}
              </span>
              <RiskBadge level={c.riskLevel} size="sm" showDot={false} />
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Connected entities">
          {connected.map((n) => (
            <CommandItem
              key={n.id}
              value={`${n.label} ${n.nodeRole} ${n.entityType}`}
              onSelect={() => {
                onOpenChange(false);
                openDetail(nodeDetail(n));
              }}
              className="gap-2"
            >
              <Network className="size-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{n.label}</span>
              <span className="hidden text-[11px] uppercase tracking-wider text-muted-foreground sm:inline">
                {n.nodeRole}
              </span>
              <RiskBadge level={n.riskLevel} size="sm" showDot={false} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
