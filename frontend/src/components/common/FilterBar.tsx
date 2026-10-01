import { Filter } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterDef {
  id: string;
  label: string;
  options: string[];
}

/** Generic filter bar. Filters drive the demo visualisations client-side. */
export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  className,
  children,
}: {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onReset?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-wrap items-center gap-2 px-3 py-2.5",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 pr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="size-3.5" />
        Filters
      </span>
      {filters.map((f) => (
        <Select key={f.id} value={values[f.id] ?? f.options[0] ?? ""} onValueChange={(v) => onChange(f.id, v)}>
          <SelectTrigger className="h-8 w-auto min-w-[7.5rem] gap-1.5 text-xs">

            <span className="text-muted-foreground">{f.label}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {f.options.map((o) => (
              <SelectItem key={o} value={o} className="text-xs">
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {children}
      {onReset && (
        <Button variant="ghost" size="sm" className="ml-auto h-8 text-xs" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  );
}

/** Segmented toggle used for graph modes, view switches and level filters. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface-muted p-1",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-sm font-medium transition-colors",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
            value === o.id
              ? "bg-primary text-primary-foreground shadow-panel"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
