import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { formatMoney, riskStyle } from "@/lib/risk";
import type { Risk } from "@/types/risk";

/**
 * RISK SOURCE MAP
 *
 * Radial "where does risk come from" visual: the counterparty sits at the
 * centre and each risk source orbits it.
 *  - node size  = materiality
 *  - node colour = risk level
 *  - link weight = contribution to overall risk
 *
 * Layout is deterministic (no physics), so it can be swapped for a real
 * force-directed / graph-DB driven renderer without changing the API.
 */
export function RiskSourceMap({
  companyName,
  overallScore,
  overallLevel,
  risks,
  onSelectRisk,
  className,
}: {
  companyName: string;
  overallScore: number;
  overallLevel: Risk["score"]["level"];
  risks: Risk[];
  onSelectRisk?: (risk: Risk) => void;
  className?: string;
}) {
  const W = 1000;
  const H = 620;
  const cx = W / 2;
  const cy = H / 2;

  const placed = useMemo(() => {
    const ordered = [...risks].sort((a, b) => b.materiality - a.materiality);
    const inner = ordered.filter((_, i) => i % 2 === 0);
    const outer = ordered.filter((_, i) => i % 2 === 1);

    const ring = (items: Risk[], radius: number, offset: number) =>
      items.map((risk, i) => {
        const angle = ((i / items.length) * 360 + offset) * (Math.PI / 180);
        return {
          risk,
          x: cx + Math.cos(angle) * radius * 1.42,
          y: cy + Math.sin(angle) * radius,
          r: 20 + risk.materiality * 26,
        };
      });

    return [...ring(inner, 148, -90), ...ring(outer, 250, -60)];
  }, [risks, cx, cy]);

  const centerStyle = riskStyle(overallLevel);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg bg-surface", className)}>
      <div className="grid-backdrop absolute inset-0 opacity-70" />
      <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full" role="img" aria-label="Risk source map">
        <defs>
          <radialGradient id="centreGlow">
            <stop offset="0%" stopColor={centerStyle.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={centerStyle.color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* orbit guides */}
        {[148, 250].map((r) => (
          <ellipse
            key={r}
            cx={cx}
            cy={cy}
            rx={r * 1.42}
            ry={r}
            fill="none"
            stroke="var(--border)"
            strokeDasharray="3 6"
          />
        ))}

        {/* links */}
        {placed.map(({ risk, x, y }) => {
          const s = riskStyle(risk.score.level);
          return (
            <line
              key={`l-${risk.id}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={s.color}
              strokeWidth={1 + risk.materiality * 3}
              strokeOpacity={0.28 + risk.materiality * 0.35}
            />
          );
        })}

        {/* centre */}
        <circle cx={cx} cy={cy} r={132} fill="url(#centreGlow)" />
        <circle cx={cx} cy={cy} r={66} fill="var(--nav)" stroke={centerStyle.color} strokeWidth={3} />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          className="fill-[var(--nav-foreground)] text-[30px] font-semibold"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {Math.round(overallScore)}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fill={centerStyle.color}
          className="text-[13px] font-semibold"
          style={{ letterSpacing: "0.12em" }}
        >
          {overallLevel}
        </text>
        <text
          x={cx}
          y={cy + 92}
          textAnchor="middle"
          className="fill-[var(--foreground)] text-[15px] font-semibold"
        >
          {companyName}
        </text>

        {/* risk nodes */}
        {placed.map(({ risk, x, y, r }) => {
          const s = riskStyle(risk.score.level);
          return (
            <g
              key={risk.id}
              className="cursor-pointer"
              onClick={() => onSelectRisk?.(risk)}
              tabIndex={0}
              role="button"
              aria-label={`${risk.category} risk`}
            >
              <circle cx={x} cy={y} r={r + 10} fill={s.color} opacity={0.14} className="node-glow" />
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="var(--surface)"
                stroke={s.color}
                strokeWidth={3}
                className="transition-[r] duration-200"
              />
              <circle cx={x} cy={y} r={r * 0.42} fill={s.color} opacity={0.85} />
              <text
                x={x}
                y={y + r + 17}
                textAnchor="middle"
                className="fill-[var(--foreground)] text-[12.5px] font-semibold"
              >
                {risk.category}
              </text>
              <text
                x={x}
                y={y + r + 31}
                textAnchor="middle"
                className="fill-[var(--muted-foreground)] text-[11px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {Math.round(risk.score.score)}
                {risk.exposure ? ` · ${formatMoney(risk.exposure)}` : ""}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Node size = materiality</span>
        {(["LOW", "MODERATE", "CRITICAL"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", riskStyle(l).dot)} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
