
import { useState } from "react";

import { DemoBadge, MetricCard, PageHeader, ProvenanceTag, Section, StatusBadge } from "@/components/common/primitives";
import { SegmentedControl } from "@/components/common/FilterBar";
import { actionDetail } from "@/lib/detail";
import { useAppState } from "@/state/app-state";
import type { ActionStatus } from "@/types/risk";


type Filter = "ALL" | ActionStatus;

export function ActionsPage() {
  const { dossier, openDetail } = useAppState();
  const [filter, setFilter] = useState<Filter>("ALL");

  const rows = dossier.actions.filter((a) => (filter === "ALL" ? true : a.status === filter));
  const p1 = dossier.actions.filter((a) => a.priority === "P1").length;
  const open = dossier.actions.filter((a) => a.status === "Open").length;
  const escalated = dossier.actions.filter((a) => a.status === "Escalated").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Actions"
        title="What should be done next"
        description="Mitigation actions derived from the risk assessment, with an owner and a date against each one."
        actions={
          <>
            <DemoBadge />
            <ProvenanceTag provenance="ANALYST_JUDGMENT" />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total actions" value={dossier.actions.length} accent />
        <MetricCard label="P1 priority" value={p1} level="CRITICAL" />
        <MetricCard label="Open" value={open} level="MODERATE" />
        <MetricCard label="Escalated" value={escalated} level="HIGH" />
      </div>

      <div className="panel p-3">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { id: "ALL", label: "All" },
            { id: "Open", label: "Open" },
            { id: "In Progress", label: "In progress" },
            { id: "Pending Review", label: "Pending review" },
            { id: "Escalated", label: "Escalated" },
            { id: "Completed", label: "Completed" },
          ]}
        />
      </div>

      <Section title={`${rows.length} actions`} description="Click an action for detail and linked evidence." dense>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="label-caps px-4 py-2">Priority</th>
                <th className="label-caps px-4 py-2">Risk</th>
                <th className="label-caps px-4 py-2">Recommended action</th>
                <th className="label-caps px-4 py-2">Owner</th>
                <th className="label-caps px-4 py-2">Due</th>
                <th className="label-caps px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => openDetail(actionDetail(a))}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-muted"
                >
                  <td className="num px-4 py-2.5 font-semibold">{a.priority}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.risk}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{a.recommendedAction}</td>
                  <td className="px-4 py-2.5 text-xs">{a.owner}</td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">{a.dueDate}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
