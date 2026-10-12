import { Link, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { Network, Trash2 } from "lucide-react";

import { formatMoney, formatNumber } from "@/lib/risk";
import { previousQuarterLabel } from "@/lib/reporting-period";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DemoBadge,
  KeyValueList,
  MetricCard,
  PageHeader,
  ProvenanceTag,
  RiskBadge,
  Section,
} from "@/components/common/primitives";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { useAppState } from "@/state/app-state";


export function CompanyOverviewPage() {
  const { id } = useParams();
  const { counterpartyId, setCounterpartyId, dossierFor, dossier: activeDossier, deleteCounterparty } = useAppState();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Deep links set the working context so the rest of the workspace follows.
  useEffect(() => {
    if (id && id !== counterpartyId) setCounterpartyId(id);
  }, [id, counterpartyId, setCounterpartyId]);

  const dossier = id === counterpartyId ? activeDossier : dossierFor(id ?? "");
  const { company, overallRisk, exposure, recovery } = dossier;
  const p = company.businessProfile;
  const identity = company.identity;
  const financialPeriod = previousQuarterLabel();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Company overview"
        title={company.name}
        description={`${identity.industry} · ${identity.sector} · ${identity.country}`}
        actions={
          <>
            <DemoBadge />
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/relationships">
                <Network className="size-3.5" />
                Relationship graph
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/">Risk dashboard</Link>
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => { setDeleteError(null); setConfirmDelete(true); }}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </>
        }
      />

      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!deleting) setConfirmDelete(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete counterparty?</DialogTitle>
            <DialogDescription>Do you want to delete {company.name}?</DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setConfirmDelete(false)}>No, cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={async () => {
              setDeleting(true);
              setDeleteError(null);
              try {
                await deleteCounterparty(company.id);
                void navigate("/counterparties", { replace: true });
              } catch (error) {
                setDeleteError(error instanceof Error ? error.message : "Unable to delete counterparty. Please try again.");
              } finally {
                setDeleting(false);
              }
            }}>{deleting ? "Deleting..." : "Yes, delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="panel flex flex-col items-center p-5">
          <div className="flex w-full items-center justify-between">
            <p className="label-caps">Overall risk</p>
            <RiskBadge level={overallRisk.level} />
          </div>
          <RiskGauge score={overallRisk.score} level={overallRisk.level} size={180} className="mt-3" />
          <ProvenanceTag provenance={overallRisk.provenance} className="mt-2" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Total exposure" money={exposure.total} provenance={exposure.provenance} />
          <MetricCard label="Net exposure" money={exposure.net} level={dossier.risks.find((risk) => risk.id === "RSK-EXPOSURE")?.score.level ?? "UNKNOWN"} />
          <MetricCard
            label="Estimated recovery"
            money={recovery.estimatedRecovery}
            sublabel={`${recovery.recoveryPct}%`}
          />
          <MetricCard label="Revenue" money={p.revenue} sublabel={financialPeriod} provenance={company.provenance} />
          <MetricCard label="EBITDA" money={p.ebitda} sublabel={financialPeriod} provenance={company.provenance} />
          <MetricCard label="Employees" value={formatNumber(p.employees)} provenance={company.provenance} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Company Identity"
          description="Golden-source identity attributes."
          actions={<ProvenanceTag provenance={company.provenance} />}
        >
          <KeyValueList
            columns={1}
            items={[
              { label: "Legal name", value: identity.legalName },
              { label: "LEI", value: identity.lei ?? "—" },
              { label: "Registration number", value: identity.registrationNumber ?? "—" },
              { label: "Country of incorporation", value: identity.country },
              { label: "Incorporation date", value: identity.incorporationDate ?? "—" },
              { label: "Industry", value: identity.industry },
              { label: "Sector", value: identity.sector },
              { label: "Parent", value: identity.parentName ?? "—" },
              { label: "Ultimate beneficial owner", value: identity.uboName ?? "—" },
              { label: "Listing status", value: identity.listing.replace("_", " ") },
              { label: "Bank customer ID", value: company.customerId ?? "—" },
              { label: "Bank relationship", value: company.bankRelationship },
            ]}
          />
        </Section>

        <div className="space-y-4">
          <Section
            title="Business Profile"
            description={`Financials for ${p.fiscalYear}.`}
            actions={<ProvenanceTag provenance={company.provenance} />}
          >
            <KeyValueList
              columns={1}
              items={[
                { label: "Revenue", value: formatMoney(p.revenue) },
                { label: "EBITDA", value: formatMoney(p.ebitda) },
                { label: "Total assets", value: formatMoney(p.totalAssets) },
                { label: "Total liabilities", value: formatMoney(p.totalLiabilities) },
                { label: "Debt", value: formatMoney(p.debt) },
                { label: "Cash", value: formatMoney(p.cash) },
                { label: "Employees", value: formatNumber(p.employees) },
              ]}
            />
          </Section>

        </div>
      </div>
    </div>
  );
}
