"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { StatRow } from "@/components/ops/stat-row";
import { EmptyState } from "@/components/ops/empty-state";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { MATCH_TONE, type MatchType } from "@/lib/reconciliation";
import { cn } from "@/lib/utils";

export type ReconciliationSuggestion = {
  settlementId: string;
  publicId: string;
  reference: string;
  confidence: number;
  reason: string;
};

export type ReconciliationRow = {
  id: string;
  externalRef: string;
  source: string;
  amount: string;
  currency: string;
  status: string;
  matchType: MatchType;
  matchLabel: string;
  matchReason: string | null;
  confidence: number;
  exceptionReason: string | null;
  valueDate: string;
  settlement: { publicId: string; reference: string } | null;
  suggestion: ReconciliationSuggestion | null;
};

type WorkspaceProps = {
  records: ReconciliationRow[];
  confirmAction: (formData: FormData) => Promise<void>;
  rejectAction: (formData: FormData) => Promise<void>;
  resolveAction: (formData: FormData) => Promise<void>;
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full", confidence >= 100 ? "bg-[#42d5b7]" : "bg-[#4fe3ff]")}
          style={{ width: `${Math.max(confidence, 6)}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-slate-600">{confidence}%</span>
    </div>
  );
}

export function ReconciliationWorkspace({ records, confirmAction, rejectAction, resolveAction }: WorkspaceProps) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0],
    [records, selectedId],
  );

  // An EXCEPTION (or already-resolved) record must never display as matched or
  // "reconciled", even if a settlement is somehow linked to it.
  const isException = selected?.matchType === "EXCEPTION";
  const isResolved = selected?.matchType === "RESOLVED";
  const showMatched = Boolean(selected?.settlement) && !isException && !isResolved;
  const showSuggestion = Boolean(selected?.suggestion) && !isException && !isResolved;

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
                    <Badge tone={MATCH_TONE[record.matchType]}>{record.matchLabel}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {record.source.replaceAll("_", " ")} · {record.amount}
                  </p>
                  {record.suggestion ? (
                    <p className="mt-1 truncate text-xs font-medium text-sky-700">
                      Suggested {record.suggestion.publicId} · {record.suggestion.confidence}%
                    </p>
                  ) : null}
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
            <Badge tone={MATCH_TONE[selected.matchType]}>{selected.matchLabel}</Badge>
          </div>
          <div className="mt-4 rounded-lg border bg-slate-50/50 p-3">
            <StatRow label="Source" value={selected.source.replaceAll("_", " ")} />
            <StatRow label="Amount" value={selected.amount} />
            <StatRow label="Value date" value={selected.valueDate} />
            {selected.exceptionReason ? <StatRow label="Exception" value={selected.exceptionReason} /> : null}
          </div>
          <div className="mt-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Match</p>
              {showMatched || showSuggestion ? <ConfidenceBar confidence={selected.confidence} /> : null}
            </div>

            <div className="mt-3 grid gap-0.5 rounded-lg border bg-slate-50/50 px-3 py-1">
              <StatRow label="Match type" value={selected.matchLabel} />
              {showMatched || showSuggestion ? <StatRow label="Confidence" value={`${selected.confidence}%`} /> : null}
              {showMatched && selected.settlement ? (
                <StatRow
                  label="Matched settlement"
                  value={`${selected.settlement.publicId} · ${selected.settlement.reference}`}
                />
              ) : showSuggestion && selected.suggestion ? (
                <StatRow
                  label="Suggested settlement"
                  value={`${selected.suggestion.publicId} · ${selected.suggestion.reference}`}
                />
              ) : isException ? (
                <StatRow label="Matched settlement" value="No match" />
              ) : null}
              {isException && selected.exceptionReason ? (
                <StatRow label="Reason" value={selected.exceptionReason} />
              ) : selected.matchReason ? (
                <StatRow label="Reason" value={selected.matchReason} />
              ) : null}
            </div>

            {isException ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-rose-700">
                  This record is flagged as an exception and is not reconciled. Review the reason above, then resolve it
                  once handled.
                </p>
                <form action={resolveAction}>
                  <input type="hidden" name="recordId" value={selected.id} />
                  <SubmitButton variant="primary" size="sm" pendingText="Resolving...">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Resolve exception
                  </SubmitButton>
                </form>
                <p className="text-xs text-slate-500">
                  Resolving marks the exception as reviewed and clears it from the exceptions queue. It does not link or
                  reconcile a settlement.
                </p>
              </div>
            ) : isResolved ? (
              <p className="mt-3 text-xs text-slate-600">
                Exception reviewed and resolved by an operator. No settlement was linked.
              </p>
            ) : showMatched && selected.settlement ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    {selected.externalRef}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="rounded-md bg-teal-50 px-2 py-1 font-medium text-teal-700 ring-1 ring-teal-200/80">
                    {selected.settlement.publicId} · {selected.settlement.reference}
                  </span>
                </div>
                <p className="mt-3 text-xs text-teal-700">
                  {selected.matchType === "AUTO_MATCHED"
                    ? "Auto-reconciled at 100% confidence — no operator action required."
                    : "Manually reconciled by an operator — record linked and settlement reconciled."}
                </p>
              </>
            ) : showSuggestion && selected.suggestion ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <form action={confirmAction}>
                    <input type="hidden" name="recordId" value={selected.id} />
                    <input type="hidden" name="settlementId" value={selected.suggestion.settlementId} />
                    <SubmitButton variant="primary" size="sm" pendingText="Confirming...">
                      <Check className="h-3.5 w-3.5" />
                      Confirm Match
                    </SubmitButton>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="recordId" value={selected.id} />
                    <input type="hidden" name="settlementId" value={selected.suggestion.settlementId} />
                    <SubmitButton variant="outline" size="sm" pendingText="Rejecting...">
                      <X className="h-3.5 w-3.5" />
                      Reject Match
                    </SubmitButton>
                  </form>
                </div>
                <p className="text-xs text-slate-500">
                  Confirming links this record and moves the settlement to RECONCILED. Rejecting keeps it in manual
                  review and hides this suggestion.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No settlement candidate found. Exact (100%) matches reconcile automatically; this record needs a manual
                link or has no SETTLED settlement with the same amount and currency.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
