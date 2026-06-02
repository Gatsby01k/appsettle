"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { EmptyState } from "@/components/ops/empty-state";
import { cn } from "@/lib/utils";

export type ReconciliationRow = {
  id: string;
  externalRef: string;
  source: string;
  amount: string;
  currency: string;
  status: string;
  exceptionReason: string | null;
  valueDate: string;
  settlement: { publicId: string; reference: string } | null;
};

export function ReconciliationWorkspace({ records }: { records: ReconciliationRow[] }) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0],
    [records, selectedId],
  );

  if (!records.length) {
    return (
      <EmptyState
        title="No reconciliation records"
        description="Add a bank, chain, or PSP record to start matching settlements."
      />
    );
  }

  return (
    <div className="grid min-h-[460px] overflow-hidden rounded-lg border bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="border-b lg:border-b-0 lg:border-r">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-medium text-slate-500">{records.length} records</p>
        </div>
        <ul className="max-h-[520px] divide-y overflow-y-auto">
          {records.map((record) => {
            const active = record.id === selected?.id;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className={cn(
                    "w-full px-3 py-3 text-left transition-colors hover:bg-slate-50",
                    active && "bg-slate-50 ring-1 ring-inset ring-slate-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-950">{record.externalRef}</span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {record.source.replaceAll("_", " ")} · {record.amount}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {selected ? (
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{selected.externalRef}</h3>
            <StatusBadge status={selected.status} />
          </div>
          <div className="mt-4 rounded-lg border bg-slate-50/50 p-3">
            <StatRow label="Source" value={selected.source.replaceAll("_", " ")} />
            <StatRow label="Amount" value={selected.amount} />
            <StatRow label="Value date" value={selected.valueDate} />
            {selected.exceptionReason ? <StatRow label="Exception" value={selected.exceptionReason} /> : null}
          </div>
          <div className="mt-4 rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Match</p>
            {selected.settlement ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                  {selected.externalRef}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200/80">
                  {selected.settlement.publicId} · {selected.settlement.reference}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No settlement linked to this record.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
