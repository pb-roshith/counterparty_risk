import { cn } from "@/lib/utils";
import { formatMoney, riskStyle } from "@/lib/risk";
import type { Risk } from "@/types/risk";

export function RiskScoreCard({
  risk,
  onSelect,
  className,
}: {
  risk: Risk;
  onSelect?: (risk: Risk) => void;
  className?: string;
}) {
  const displayLevel = risk.score.level === "HIGH" ? "CRITICAL" : risk.score.level;
  const displayStyle = riskStyle(displayLevel);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(risk)}
      className={cn(
        "panel group relative flex flex-col overflow-hidden p-3.5 text-left transition-all hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", displayStyle.dot)} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {risk.category}
        </p>
      </div>

      <div className="mt-2">
        <span className="num text-2xl font-semibold leading-none text-foreground">
          {Math.round(risk.score.score)}
        </span>
      </div>

      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", displayStyle.dot)}
          style={{ width: `${risk.score.score}%` }}
        />
      </div>

      <div className="mt-2.5">
        <span className={cn("inline-flex rounded-sm border px-2 py-0.5 text-xs font-semibold uppercase", displayStyle.bg, displayStyle.border, displayStyle.text)}>
          {displayStyle.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
        {risk.exposure && <span className="num">{formatMoney(risk.exposure)}</span>}
        <span className="ml-auto font-medium text-primary">
          View details →
        </span>
      </div>
    </button>
  );
}
