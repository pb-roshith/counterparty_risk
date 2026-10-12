import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Boxes,
  Building2,
  FileStack,
  Globe2,
  HardHat,
  Landmark,
  Layers,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney, riskStyle } from "@/lib/risk";
import { Button } from "@/components/ui/button";
import type {
  EntityType,
  GraphEdge,
  GraphNode,
  GraphViewMode,
  RelationshipGraphData,
  RelationshipLevel,
  RiskLevel,
} from "@/types/risk";

export const graphViewModes: Array<{ id: GraphViewMode; label: string }> = [
  { id: "RELATIONSHIP", label: "Relationship View" },
  { id: "EXPOSURE", label: "Exposure View" },
  { id: "RISK", label: "Risk View" },
  { id: "CONTAGION", label: "Contagion View" },
  { id: "OWNERSHIP", label: "Ownership View" },
];

const entityIcon: Record<EntityType, typeof Building2> = {
  COMPANY: Building2,
  PERSON: User,
  BANK: Landmark,
  COUNTRY: Globe2,
  SECTOR: Layers,
  PROJECT: HardHat,
  COLLATERAL: FileStack,
  FUND: Banknote,
};

const OWNERSHIP_TYPES = ["OWNS", "ULTIMATE BENEFICIAL OWNER OF", "INVESTS IN"];

export interface GraphFilters {
  levels: RelationshipLevel[] | "ALL";
  riskLevels: RiskLevel[];
}

export function RelationshipGraph({
  data,
  mode,
  filters,
  onSelectNode,
  onSelectEdge,
  height = 620,
  layout = "radial",
  className,
}: {
  data: RelationshipGraphData;
  mode: GraphViewMode;
  filters: GraphFilters;
  onSelectNode?: (node: GraphNode) => void;
  onSelectEdge?: (edge: GraphEdge) => void;
  height?: number;
  layout?: "radial" | "clusters";
  className?: string;
}) {
  const [zoom, setZoom] = useState(layout === "clusters" ? 1.8 : 1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const suppressClick = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((value) => Math.max(0.25, Math.min(12, value * Math.exp(-event.deltaY * 0.002))));
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const branchLayout = useMemo(() => {
    if (layout !== "clusters") return null;
    const directIds = new Set(data.edges.filter((edge) => edge.from === data.centerId || edge.to === data.centerId)
      .map((edge) => edge.from === data.centerId ? edge.to : edge.from));
    const direct = data.nodes.filter((node) => directIds.has(node.id));
    const groups = direct.map((node) => ({ node, children: [] as GraphNode[] }));
    for (const node of data.nodes) {
      if (node.id === data.centerId || directIds.has(node.id)) continue;
      const group = groups.find(({ node: parent }) => data.edges.some((edge) =>
        (edge.from === parent.id && edge.to === node.id) || (edge.to === parent.id && edge.from === node.id)));
      if (group) group.children.push(node);
    }
    const unlinked = data.nodes.filter((node) => node.id !== data.centerId && !directIds.has(node.id)
      && !groups.some((group) => group.children.some((child) => child.id === node.id)));
    const clusterRadius = Math.max(170, ...groups.map((group) => group.children.length * 190 / (Math.PI * 1.5)));
    const groupCount = groups.length + (unlinked.length ? 1 : 0);
    // Keep neighboring satellite clusters apart and leave room around the center.
    const parentRadius = Math.max(clusterRadius + 230,
      groupCount > 1 ? (clusterRadius + 130) / Math.sin(Math.PI / Math.max(2, groupCount)) : 0);
    const size = Math.ceil((parentRadius + clusterRadius + 160) * 2);
    const center = size / 2;
    const positions = new Map<string, { x: number; y: number }>();
    groups.forEach(({ node, children }, groupIndex) => {
      const angle = -Math.PI / 2 + groupIndex * 2 * Math.PI / Math.max(1, groupCount);
      const parent = { x: center + parentRadius * Math.cos(angle), y: center + parentRadius * Math.sin(angle) };
      positions.set(node.id, parent);
      children.forEach((child, index) => {
        // Fan satellites around their parent, leaving the inward connection clear.
        const childAngle = angle + (children.length === 1 ? 0 : -Math.PI * 0.75 + index * Math.PI * 1.5 / (children.length - 1));
        positions.set(child.id, { x: parent.x + clusterRadius * Math.cos(childAngle), y: parent.y + clusterRadius * Math.sin(childAngle) });
      });
    });
    unlinked.forEach((node, index) => {
      const angle = -Math.PI / 2 + groups.length * 2 * Math.PI / Math.max(1, groupCount);
      positions.set(node.id, { x: center + parentRadius * Math.cos(angle) + (index % 3 - 1) * 180,
        y: center + parentRadius * Math.sin(angle) + Math.floor(index / 3) * 150 });
    });
    positions.set(data.centerId, { x: center, y: center });
    return { positions, height: size };
  }, [data, layout]);
  const W = branchLayout?.height ?? 1000;
  const H = branchLayout?.height ?? 620;

  const visibleNodes = useMemo(() => {
    return data.nodes.filter((n) => {
      if (n.id === data.centerId) return true;
      if (collapsed && n.level !== "LEVEL_1") return false;
      if (filters.levels !== "ALL" && !filters.levels.includes(n.level)) return false;
      if (filters.riskLevels.length && !filters.riskLevels.includes(n.riskLevel)) return false;
      if (mode === "OWNERSHIP") {
        return data.edges.some(
          (e) =>
            OWNERSHIP_TYPES.includes(e.type) && (e.from === n.id || e.to === n.id),
        );
      }
      if (mode === "EXPOSURE") return Boolean(n.exposure) || n.id === data.centerId;
      return true;
    });
  }, [data, filters, mode, collapsed]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      data.edges.filter((e) => {
        if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) return false;
        if (mode === "OWNERSHIP") return OWNERSHIP_TYPES.includes(e.type);
        if (mode === "CONTAGION") return e.riskLevel === "HIGH" || e.riskLevel === "CRITICAL";
        return true;
      }),
    [data.edges, visibleIds, mode],
  );

  const positions = useMemo(() => {
    if (branchLayout) return branchLayout.positions;
    const directIds = new Set(data.edges.filter((edge) => edge.from === data.centerId || edge.to === data.centerId)
      .map((edge) => edge.from === data.centerId ? edge.to : edge.from));
    const direct = data.nodes.filter((node) => directIds.has(node.id));
    const indirect = data.nodes.filter((node) => node.id !== data.centerId && !directIds.has(node.id));
    const result = new Map<string, { x: number; y: number }>([[data.centerId, { x: W / 2, y: H / 2 }]]);
    if (direct.length === 1 && indirect.length > 0) {
      result.set(data.centerId, { x: 160, y: H / 2 });
      result.set(direct[0]!.id, { x: 470, y: H / 2 });
      indirect.forEach((node, index) => {
        result.set(node.id, { x: 790, y: 85 + index * 450 / Math.max(1, indirect.length - 1) });
      });
    } else {
      direct.forEach((node, index) => {
        const angle = -Math.PI / 2 + index * 2 * Math.PI / direct.length;
        result.set(node.id, { x: W / 2 + 390 * Math.cos(angle), y: H / 2 + 225 * Math.sin(angle) });
      });
      indirect.forEach((node, index) => {
        const angle = -Math.PI / 2 + index * 2 * Math.PI / indirect.length;
        result.set(node.id, { x: W / 2 + 440 * Math.cos(angle), y: H / 2 + 245 * Math.sin(angle) });
      });
    }
    return result;
  }, [data, branchLayout, W, H]);
  const pos = (n: GraphNode) => positions.get(n.id) ?? { x: W / 2, y: H / 2 };

  const nodeRadius = (n: GraphNode) => {
    const weight = Math.max(0, Math.min(1, n.weight));
    const base = layout === "clusters"
      ? n.id === data.centerId ? 76 : n.level === "LEVEL_1" ? 44 + weight * 12 : 16 + weight * 18
      : n.id === data.centerId ? 46 : 16 + n.weight * 18;
    if (mode === "EXPOSURE" && n.exposure) return base + Math.min(18, n.exposure.amount / 30);
    return base;
  };

  const edgeColor = (e: GraphEdge) =>
    mode === "RELATIONSHIP" || mode === "OWNERSHIP" ? "var(--border-strong)" : riskStyle(e.riskLevel).color;

  const nodeColor = (n: GraphNode) =>
    layout === "clusters" && n.id !== data.centerId && n.level === "LEVEL_1"
      ? "#eab308"
      : mode === "RELATIONSHIP" ? "var(--chart-1)" : riskStyle(n.riskLevel).color;

  const fit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <div className="grid-backdrop absolute inset-0 opacity-60" />

      {/* graph controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <div className="flex w-8 flex-col overflow-hidden rounded-md border border-border bg-surface shadow-panel">
          <Button variant="ghost" size="icon" className="!size-8 shrink-0 rounded-none p-0" onClick={() => setZoom((z) => Math.min(12, z * 1.3))} aria-label="Zoom in">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="!size-8 shrink-0 rounded-none border-t border-border p-0" onClick={() => setZoom((z) => Math.max(0.25, z / 1.3))} aria-label="Zoom out">
            <Minus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="!size-8 shrink-0 rounded-none border-t border-border p-0" onClick={fit} aria-label="Fit to screen">
            <Maximize2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="!size-8 shrink-0 rounded-none border-t border-border p-0" onClick={() => { setZoom(layout === "clusters" ? 1.8 : 1); setPan({ x: 0, y: 0 }); setCollapsed(false); }} aria-label="Reset">
            <RotateCcw className="size-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 bg-surface px-2 text-[11px]"
          onClick={() => setCollapsed((c) => !c)}
        >
          <Boxes className="size-3.5" />
          {collapsed ? "Expand all" : "Collapse all"}
        </Button>
      </div>

      <div className="relative" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ height, touchAction: "none" }}
        className="relative w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Relationship intelligence graph"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          suppressClick.current = false;
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          if (Math.hypot(dx, dy) > 4 && !suppressClick.current) {
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (!suppressClick.current) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const scale = Math.min(bounds.width / W, bounds.height / H);
          setPan({ x: drag.current.panX + dx / scale, y: drag.current.panY + dy / scale });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onDoubleClick={() => setZoom((value) => Math.min(12, value * 1.5))}
      >
        <g transform={`translate(${W / 2 + pan.x} ${H / 2 + pan.y}) scale(${zoom}) translate(${-W / 2} ${-H / 2})`}>
          {visibleEdges.map((e) => {
            const a = visibleNodes.find((n) => n.id === e.from);
            const b = visibleNodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            const p1 = pos(a);
            const p2 = pos(b);
            const mx = (p1.x + p2.x) / 2;
            const parallel = visibleEdges.filter((other) =>
              (other.from === e.from && other.to === e.to) || (other.from === e.to && other.to === e.from),
            );
            const parallelIndex = parallel.findIndex((other) => other.id === e.id);
            const my = (p1.y + p2.y) / 2 + (parallelIndex - (parallel.length - 1) / 2) * 23;
            const active = hovered === e.id;
            const directConnection = e.from === data.centerId || e.to === data.centerId;
            const width =
              mode === "RELATIONSHIP" && directConnection
                ? 1.5 + Math.max(0, Math.min(1, e.strength)) * 7
                : mode === "EXPOSURE"
                ? 1 + (e.strength * 5)
                : mode === "CONTAGION"
                  ? 1.5 + e.strength * 3.5
                  : 1 + e.strength * 1.6;
            return (
              <g key={e.id} onMouseEnter={() => setHovered(e.id)} onMouseLeave={() => setHovered(null)}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={edgeColor(e)}
                  strokeWidth={active ? width + 2 : width}
                  vectorEffect="non-scaling-stroke"
                  strokeOpacity={active ? 0.95 : 0.55}
                  strokeDasharray={e.type === "DEPENDS ON" ? "6 5" : undefined}
                  className="cursor-pointer"
                  onClick={() => { if (!suppressClick.current) onSelectEdge?.(e); }}
                />
                <title>{`${e.type} · Strength: ${Math.round(e.strength * 100)}%`}</title>
                {(!branchLayout || active) && (
                  <>
                    <rect
                      x={mx - e.type.length * 3.4 - 6}
                      y={my - 9}
                      width={e.type.length * 6.8 + 12}
                      height={18}
                      rx={3}
                      fill="var(--surface)"
                      stroke="var(--border)"
                    />
                    <text
                      x={mx}
                      y={my + 4}
                      textAnchor="middle"
                      className="pointer-events-none fill-[var(--foreground)] text-[10.5px] font-semibold"
                      style={{ letterSpacing: "0.04em" }}
                    >
                      {e.type}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {visibleNodes.map((n) => {
            const { x, y } = pos(n);
            const r = nodeRadius(n);
            const color = nodeColor(n);
            const Icon = entityIcon[n.entityType];
            const isCenter = n.id === data.centerId;
            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => { if (!suppressClick.current) onSelectNode?.(n); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectNode?.(n);
                  }
                }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                tabIndex={0}
                role="button"
                aria-label={n.label}
              >
                <circle cx={x} cy={y} r={r + 8} fill={color} opacity={0.15} className={isCenter ? "node-glow" : undefined} />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={isCenter ? "var(--nav)" : "var(--surface)"}
                  stroke={color}
                  strokeWidth={isCenter ? 4 : 2.5}
                />
                <foreignObject x={x - r * 0.45} y={y - r * 0.45} width={r * 0.9} height={r * 0.9}>
                  <div className="flex h-full w-full items-center justify-center">
                    <Icon
                      style={{ color: isCenter ? "var(--nav-foreground)" : color, width: "80%", height: "80%" }}
                    />
                  </div>
                </foreignObject>
                <text
                  x={x}
                  y={y + r + 15}
                  textAnchor="middle"
                  className="fill-[var(--foreground)] text-[11.5px] font-semibold"
                >
                  {n.label.match(/.{1,25}(?:\s|$)|\S+/g)?.map((line, index) => (
                    <tspan key={index} x={x} dy={index === 0 ? 0 : 14}>{line.trim()}</tspan>
                  ))}
                </text>
                <text
                  x={x}
                  y={y + r + 28 + (Math.ceil(n.label.length / 25) - 1) * 14}
                  textAnchor="middle"
                  className="fill-[var(--muted-foreground)] text-[10px]"
                  style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                >
                  {n.nodeRole}
                  {mode === "EXPOSURE" && n.exposure ? ` · ${formatMoney(n.exposure)}` : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>Scroll to zoom · Drag to pan{mode === "RELATIONSHIP" ? " · Thicker center links = stronger relationships" : ""}</span>
        <span className="font-semibold uppercase tracking-wider">
          {visibleNodes.length} entities · {visibleEdges.length} relationships
        </span>
        {(["LOW", "MODERATE", "HIGH", "CRITICAL"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", riskStyle(l).dot)} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
