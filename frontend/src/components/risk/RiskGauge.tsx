import { useAppState } from "@/state/app-state";
import { metricDetail } from "@/lib/metric-detail";
import { cn } from "@/lib/utils";
import { riskStyle } from "@/lib/risk";
import type { RiskLevel } from "@/types/risk";

/**
 * Semi-circular risk gauge. Purely presentational — score/level come from the
 * risk model output so it can be repointed at real scores later.
 */
export function RiskGauge({
  score,
  level,
  size = 200,
  label,
  className,
}: {
  score: number;
  level: RiskLevel;
  size?: number;
  label?: string;
  className?: string;
}) {
  const { dossier, openDetail } = useAppState();
  const calculation = metricDetail("Overall risk", dossier);
  const s = riskStyle(level);
  const stroke = Math.max(10, size * 0.075);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;

  const arc = (from: number, to: number) => {
    const p = (t: number) => {
      const a = Math.PI * (1 - t);
      return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
    };
    return `M ${p(from)} A ${r} ${r} 0 0 1 ${p(to)}`;
  };

  const bands: Array<[number, number, RiskLevel]> = [
    [0, 0.4, "LOW"],
    [0.4, 0.65, "MODERATE"],
    [0.65, 0.8, "HIGH"],
    [0.8, 1, "CRITICAL"],
  ];

  return (
    <button type="button" aria-label="Overall risk: view formula" onClick={() => calculation && openDetail(calculation)} className={cn("flex flex-col items-center cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-primary", className)}>
      <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`}>
        {bands.map(([from, to, lvl]) => (
          <path
            key={lvl}
            d={arc(from + 0.004, to - 0.004)}
            fill="none"
            stroke={riskStyle(lvl).softColor}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        ))}
        <path
          d={arc(0, 1)}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        <circle
          cx={cx + r * Math.cos(Math.PI * (1 - pct))}
          cy={cy - r * Math.sin(Math.PI * (1 - pct))}
          r={stroke * 0.42}
          fill="var(--surface)"
          stroke={s.color}
          strokeWidth={3}
        />
      </svg>
      <div className="-mt-[18%] flex flex-col items-center">
        <p className="num text-4xl font-semibold leading-none text-foreground">
          {Math.round(score)}
          <span className="text-base font-normal text-muted-foreground"> / 100</span>
        </p>
        <p className={cn("mt-1 text-sm font-semibold uppercase tracking-[0.14em]", s.text)}>
          {level} RISK
        </p>
        {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
      </div>
    </button>
  );
}
