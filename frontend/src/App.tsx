import { Link, Route, Routes, useLocation } from "react-router";
import { lazy, Suspense, useEffect } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider, useAppState } from "@/state/app-state";
const DashboardPage = lazy(() => import("@/routes/index").then((m) => ({ default: m.DashboardPage })));
const CounterpartiesPage = lazy(() => import("@/routes/counterparties").then((m) => ({ default: m.CounterpartiesPage })));
const CompanyOverviewPage = lazy(() => import("@/routes/counterparty.$id").then((m) => ({ default: m.CompanyOverviewPage })));
const RiskOverviewPage = lazy(() => import("@/routes/risk").then((m) => ({ default: m.RiskOverviewPage })));
const RelationshipsPage = lazy(() => import("@/routes/relationships").then((m) => ({ default: m.RelationshipsPage })));
const RiskCopilotPage = lazy(() => import("@/routes/risk-copilot").then((m) => ({ default: m.RiskCopilotPage })));
const ExposurePage = lazy(() => import("@/routes/exposure").then((m) => ({ default: m.ExposurePage })));
const AssetsPage = lazy(() => import("@/routes/assets").then((m) => ({ default: m.AssetsPage })));
const ContagionPage = lazy(() => import("@/routes/contagion").then((m) => ({ default: m.ContagionPage })));
const EarlyWarningPage = lazy(() => import("@/routes/early-warning").then((m) => ({ default: m.EarlyWarningPage })));
const ManufactureDataPage = lazy(() => import("@/routes/manufacture-data").then((m) => ({ default: m.ManufactureDataPage })));

const titles: Record<string, string> = {
  "/": "Counterparty Risk Dashboard",
  "/counterparties": "Counterparty Portfolio",
  "/risk": "Risk Overview",
  "/relationships": "Relationship Graph",
  "/risk-copilot": "Risk Copilot",
  "/exposure": "Exposure",
  "/assets": "Assets & Recovery",
  "/contagion": "Contagion Risk",
  "/early-warning": "Early Warning Indicators",
  "/manufacture-data": "Manufacture Data",
};

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = pathname.startsWith("/counterparty/") ? "Company Overview" : (titles[pathname] ?? "Page not found");
    document.title = `${title} | Risk Intelligence`;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p>Page not found.</p>
      <Link to="/" className="text-primary underline">Go home</Link>
    </div>
  );
}

function PortfolioContent() {
  const { pathname } = useLocation();
  const { counterparties } = useAppState();
  if (pathname !== "/manufacture-data" && counterparties.length === 0) {
    return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">No counterparties yet</h1>
      <p className="text-sm text-muted-foreground">Generate counterparties to populate the dashboard and risk views.</p>
      <Link to="/manufacture-data" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Open Manufacture Data</Link>
    </div>;
  }
  return <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/counterparties" element={<CounterpartiesPage />} />
          <Route path="/counterparty/:id" element={<CompanyOverviewPage />} />
          <Route path="/risk" element={<RiskOverviewPage />} />
          <Route path="/relationships" element={<RelationshipsPage />} />
          <Route path="/risk-copilot" element={<RiskCopilotPage />} />
          <Route path="/exposure" element={<ExposurePage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/contagion" element={<ContagionPage />} />
          <Route path="/early-warning" element={<EarlyWarningPage />} />
          <Route path="/manufacture-data" element={<ManufactureDataPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>;
}

export function App() {
  return (
    <AppStateProvider>
      <PageTitle />
      <AppShell>
        <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Loading page…</div>}>
        <PortfolioContent />
        </Suspense>
      </AppShell>
      <Toaster position="bottom-right" />
    </AppStateProvider>
  );
}
