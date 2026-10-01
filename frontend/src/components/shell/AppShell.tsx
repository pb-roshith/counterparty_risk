import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Building2,
  ChevronsUpDown,
  Gauge,
  LayoutDashboard,
  Network,
  MessageSquareText,
  Search,
  DatabaseZap,
  ShieldAlert,
  Signal,
  Vault,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { riskStyle } from "@/lib/risk";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DemoBadge, RiskBadge } from "@/components/common/primitives";
import { CounterpartySelector } from "@/components/shell/CounterpartySelector";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { useAppState } from "@/state/app-state";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/counterparties", label: "Counterparties", icon: Building2 },
  { to: "/risk", label: "Risk Overview", icon: Gauge },
  { to: "/relationships", label: "Relationship Graph", icon: Network },
  { to: "/risk-copilot", label: "Risk Copilot", icon: MessageSquareText },
  { to: "/exposure", label: "Exposure", icon: Wallet },
  { to: "/assets", label: "Assets & Recovery", icon: Vault },
  { to: "/contagion", label: "Contagion Risk", icon: ShieldAlert },
  { to: "/early-warning", label: "Early Warning Indicators", icon: Signal },
  { to: "/evidence", label: "Evidence & Sources", icon: BadgeCheck },
  { to: "/manufacture-data", label: "Manufacture Data", icon: DatabaseZap },
] as const;

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useLocation().pathname;

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
      {nav.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-nav-elevated text-nav-foreground"
                : "text-nav-muted hover:bg-nav-elevated/60 hover:text-nav-foreground",
            )}
          >
            {active && (
              <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-nav-active" />
            )}
            <Icon className={cn("size-4 shrink-0", active && "text-nav-active")} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileRouteTabs() {
  const pathname = useLocation().pathname;

  return (
    <nav
      aria-label="Application sections"
      className="scrollbar-thin flex w-full gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 lg:hidden"
    >
      {nav.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;

        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-nav-border px-4 py-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-nav-active/15 ring-1 ring-nav-active/40">
        <ShieldAlert className="size-4 text-nav-active" />
      </div>
      <div className="leading-tight">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-nav-muted">COUNTERPARTY</p>
        <p className="text-[13px] font-semibold tracking-[0.06em] text-nav-foreground">
          RISK INTELLIGENCE
        </p>
      </div>
    </div>
  );
}

function CompanyContextBar() {
  const { company, dossier, counterparties, setSelectorOpen } = useAppState();
  if (counterparties.length === 0) return <div className="border-b border-border bg-surface px-4 py-3 text-sm text-muted-foreground lg:px-6">No counterparty selected</div>;
  const s = riskStyle(company.riskLevel);

  const facts = [
    { label: "LEI", value: company.identity.lei ?? "—" },
    { label: "Country", value: company.identity.country },
    { label: "Sector", value: company.identity.sector },
    { label: "Relationship", value: company.bankRelationship },
    { label: "Customer ID", value: company.customerId ?? "—" },
    { label: "Last updated", value: company.lastUpdated },
  ];

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold uppercase tracking-wide text-foreground">
              {company.name}
            </h2>
            <RiskBadge level={company.riskLevel} />
            <span className="num text-xs text-muted-foreground">
              Score {dossier.overallRisk.score}
            </span>
            <DemoBadge />
          </div>
          <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center gap-1.5">
                <dt className="uppercase tracking-wider text-muted-foreground">{f.label}</dt>
                <dd className="num font-medium text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("hidden h-9 items-center rounded-md border px-3 text-xs font-semibold uppercase tracking-wider md:inline-flex", s.bg, s.text, s.border)}>
            {company.identity.industry}
          </span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectorOpen(true)}>
            <ChevronsUpDown className="size-3.5" />
            Change Counterparty
          </Button>
        </div>
      </div>
    </div>
  );
}

function TopHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { counterparties } = useAppState();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-left text-xs text-muted-foreground transition-colors hover:border-border-strong md:max-w-xl"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="truncate">Search company, LEI, customer ID, registration number…</span>
          <kbd className="num ml-auto hidden rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] md:inline">
            ⌘K
          </kbd>
        </button>


      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* permanent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-nav lg:flex">
        <SidebarBrand />
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <TopHeader />
        <CompanyContextBar />
        <MobileRouteTabs />
        <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>

      <CounterpartySelector />
      <DetailDrawer />
    </div>
  );
}
