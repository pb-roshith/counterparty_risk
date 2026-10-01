

import { DemoBadge, KeyValueList, PageHeader, Section, StatusBadge } from "@/components/common/primitives";
import { relationshipTaxonomy } from "@/data/taxonomy";
import { useAppState } from "@/state/app-state";


const integrations = [
  { name: "Core banking exposure feed", status: "PENDING", note: "Daily exposure and limits" },
  { name: "Collateral management system", status: "PENDING", note: "Valuations and haircuts" },
  { name: "Corporate registry", status: "PENDING", note: "Ownership and directorships" },
  { name: "Rating agency feed", status: "PENDING", note: "Ratings and outlook changes" },
  { name: "Adverse media screening", status: "UNVERIFIED", note: "News and litigation signals" },
  { name: "Relationship taxonomy import", status: "VERIFIED", note: "Registry-driven, extensible" },
];

export function SettingsPage() {
  const { dossier } = useAppState();

  const levels = ["LEVEL_1", "LEVEL_2", "ANCILLARY"] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Workspace configuration"
        description="What is currently demo data and what will be replaced when real systems are connected."
        actions={<DemoBadge />}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Integration readiness" description="Planned data connections." dense>
          <ul className="divide-y divide-border">
            {integrations.map((i) => (
              <li key={i.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{i.name}</p>
                  <p className="text-[11px] text-muted-foreground">{i.note}</p>
                </div>
                <StatusBadge status={i.status} />
              </li>
            ))}
          </ul>
        </Section>

        <div className="space-y-4">
          <Section title="Taxonomy coverage" description="Relationship types available to the graph.">
            <KeyValueList
              columns={1}
              items={[
                { label: "Taxonomy rows", value: String(relationshipTaxonomy.length) },
                ...levels.map((lvl) => ({
                  label: lvl.replace("_", " "),
                  value: String(relationshipTaxonomy.filter((t) => t.level === lvl).length),
                })),
                { label: "Mapped relationships (current counterparty)", value: String(dossier.relationships.length) },
              ]}
            />
          </Section>

          <Section title="Risk model" description="Scoring placeholders pending calibration.">
            <KeyValueList
              columns={1}
              items={[
                { label: "Scoring scale", value: "0–100, higher is riskier" },
                { label: "Composite method", value: "Materiality-weighted roll-up" },
                { label: "Contagion model", value: "Placeholder" },
                { label: "Recovery model", value: "Haircut-based placeholder" },
                { label: "Currency", value: "INR, crore" },
              ]}
            />
          </Section>
        </div>
      </div>

      <Section title="Framework note" description="For the implementation team.">
        <p className="text-xs leading-relaxed text-muted-foreground">
          All figures in this build come from a single demo dataset and are clearly labelled as such.
          The interface reads from a typed counterparty dossier, so swapping the demo source for live
          bank systems, a graph database or a risk model requires no changes to the screens.
        </p>
      </Section>
    </div>
  );
}
