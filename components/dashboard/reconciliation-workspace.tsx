"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FileClock,
  ShieldCheck,
  X,
} from "lucide-react";
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
  /** Omitted for read-only roles — mutation buttons are hidden, not disabled. */
  confirmAction?: (formData: FormData) => Promise<void>;
  rejectAction?: (formData: FormData) => Promise<void>;
  resolveAction?: (formData: FormData) => Promise<void>;
  embedded?: boolean;
};

const QUEUE_ACCENT: Record<MatchType, string> = {
  AUTO_MATCHED: "reconciliation-queue-accent-success",
  MANUAL_MATCHED: "reconciliation-queue-accent-success",
  SUGGESTED: "reconciliation-queue-accent-info",
  MANUAL_REVIEW: "reconciliation-queue-accent-warning",
  EXCEPTION: "reconciliation-queue-accent-danger",
  RESOLVED: "reconciliation-queue-accent-neutral",
};

const RESOLUTION_HEADER: Record<
  MatchType,
  { title: string; subtitle: string; panel: string }
> = {
  AUTO_MATCHED: {
    title: "Reconciled",
    subtitle: "External record matched — settlement linked and reconciled",
    panel: "reconciliation-panel-success reconciliation-panel-matched",
  },
  MANUAL_MATCHED: {
    title: "Reconciled",
    subtitle: "External record matched — manually linked by an operator",
    panel: "reconciliation-panel-success reconciliation-panel-matched",
  },
  SUGGESTED: {
    title: "Suggested match",
    subtitle: "Review the candidate and confirm or reject",
    panel: "reconciliation-panel-info",
  },
  MANUAL_REVIEW: {
    title: "Manual review",
    subtitle: "Open external record — awaiting settlement link",
    panel: "reconciliation-panel-warning",
  },
  EXCEPTION: {
    title: "Exception",
    subtitle: "Flagged for operator review — not reconciled",
    panel: "reconciliation-panel-danger",
  },
  RESOLVED: {
    title: "Resolved",
    subtitle: "Exception reviewed and cleared from queue",
    panel: "reconciliation-panel-neutral",
  },
};

function formatSource(source: string) {
  return source.replaceAll("_", " ");
}

function queueContext(record: ReconciliationRow) {
  if (record.matchType === "EXCEPTION" && record.exceptionReason) {
    return record.exceptionReason;
  }
  if (record.matchType === "RESOLVED") {
    return "Reviewed · no settlement linked";
  }
  if (record.settlement) {
    return `Linked · ${record.settlement.publicId} · ${record.settlement.reference}`;
  }
  if (record.suggestion) {
    return `Suggested ${record.suggestion.publicId} · ${record.suggestion.confidence}% confidence`;
  }
  return `${record.valueDate} · Awaiting match`;
}

function ConfidenceMeter({ confidence, prominent = false }: { confidence: number; prominent?: boolean }) {
  const tone =
    confidence >= 100 ? "bg-brand-emerald" : confidence >= 90 ? "bg-brand-aqua" : "bg-brand-amber";
  const labelTone =
    confidence >= 100
      ? "text-brand-emerald-ink"
      : confidence >= 90
        ? "text-[#0a7d86]"
        : "text-[#9b6810]";
  const width = `${Math.max(confidence, 6)}%`;

  return (
    <div className={cn("flex items-center gap-2.5", prominent && "w-full")}>
      <div
        className={cn(
          "reconciliation-confidence-track overflow-hidden rounded-full bg-slate-200/80",
          prominent ? "h-2 min-w-0 flex-1" : "h-1.5 w-24",
        )}
      >
        <div
          key={width}
          className={cn("reconciliation-confidence-fill h-full rounded-full", tone)}
          style={{ width }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums transition-colors duration-300",
          prominent ? "text-sm" : "text-xs font-medium text-slate-600",
          prominent && labelTone,
        )}
      >
        {confidence}%
      </span>
    </div>
  );
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="reconciliation-block-title text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </p>
  );
}

function SettlementPill({ publicId, reference }: { publicId: string; reference: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-emerald-200/90 bg-emerald-50/80 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100">
      <CheckCircle2 className="h-3 w-3 shrink-0 text-brand-emerald" aria-hidden="true" />
      <span className="settlement-tx-pill truncate">{publicId}</span>
      <span className="truncate text-emerald-700/80">· {reference}</span>
    </span>
  );
}

function ConsoleFooter({
  externalRef,
  settlementPublicId,
}: {
  externalRef: string;
  settlementPublicId?: string;
}) {
  return (
    <div className="reconciliation-console-footer mt-auto flex flex-wrap items-center gap-1.5 border-t border-[var(--ops-line-soft)] bg-slate-50/50 px-3 py-2">
      {settlementPublicId ? (
        <Link
          href={`/settlements?q=${encodeURIComponent(settlementPublicId)}`}
          className="reconciliation-footer-action inline-flex items-center gap-1 rounded-md border border-[var(--ops-line-soft)] bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800"
        >
          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
          Open settlement
        </Link>
      ) : null}
      <Link
        href={`/audit-logs?q=${encodeURIComponent(settlementPublicId ?? externalRef)}`}
        className="reconciliation-footer-action inline-flex items-center gap-1 rounded-md border border-[var(--ops-line-soft)] bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        <FileClock className="h-3 w-3 shrink-0 opacity-60" />
        View audit trail
      </Link>
    </div>
  );
}

export function ReconciliationWorkspace({
  records,
  confirmAction,
  rejectAction,
  resolveAction,
  embedded = false,
}: WorkspaceProps) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0],
    [records, selectedId],
  );

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

  const header = selected ? RESOLUTION_HEADER[selected.matchType] : null;

  return (
    <div
      className={cn(
        "grid min-h-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
        embedded ? "reconciliation-console-grid" : "ops-panel min-h-[460px]",
      )}
    >
      <div className="border-b border-[var(--ops-line)] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--ops-line-soft)] bg-slate-50/60 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="reconciliation-live-dot h-1.5 w-1.5 rounded-full bg-brand-emerald" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">
              Evidence queue · {records.length} external record{records.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <ul className="ops-scroll reconciliation-console-scroll divide-y divide-slate-100/90 overflow-y-auto">
          {records.map((record) => {
            const active = record.id === selected?.id;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className={cn(
                    "reconciliation-queue-item w-full px-3 py-2.5 text-left",
                    QUEUE_ACCENT[record.matchType],
                    active && "reconciliation-queue-item-active",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="settlement-tx-pill truncate text-[11px] font-medium text-slate-800">
                      {record.externalRef}
                    </span>
                    <Badge tone={MATCH_TONE[record.matchType]} dot className="shrink-0">
                      {record.matchLabel}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {formatSource(record.source)}
                    </p>
                    <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-950">{record.amount}</p>
                  </div>
                  <p
                    className={cn(
                      "mt-1 truncate text-[11px]",
                      record.matchType === "EXCEPTION"
                        ? "text-rose-600"
                        : record.suggestion
                          ? "font-medium text-[#0a7d86]"
                          : record.settlement
                            ? "text-brand-emerald-ink"
                            : "text-slate-400",
                    )}
                  >
                    {queueContext(record)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected && header ? (
        <div key={selected.id} className="reconciliation-detail-enter flex min-h-0 flex-col">
          <div className="reconciliation-console-scroll flex-1 overflow-y-auto p-3">
            <div
              className={cn(
                "reconciliation-resolution-header reconciliation-block-enter rounded-lg border px-3 py-2.5",
                header.panel,
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {showMatched ? (
                  <CheckCircle2 className="settlement-complete-icon h-4 w-4 shrink-0 text-brand-emerald" />
                ) : null}
                <h3 className="text-sm font-semibold text-slate-950">{header.title}</h3>
                <Badge
                  tone={MATCH_TONE[selected.matchType]}
                  dot
                  className="reconciliation-badge-pop"
                  key={selected.matchType}
                >
                  {selected.matchLabel}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{header.subtitle}</p>
            </div>

            <section className="reconciliation-block reconciliation-block-enter reconciliation-block-enter-delay-1 mt-2.5 rounded-lg border border-[var(--ops-line-soft)] bg-white px-3 py-2.5">
              <BlockTitle>External record</BlockTitle>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Reference</span>
                  <span className="settlement-tx-pill truncate font-medium text-slate-800">{selected.externalRef}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Source</span>
                  <span className="font-medium text-slate-800">{formatSource(selected.source)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold tabular-nums text-slate-950">{selected.amount}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Value date</span>
                  <span className="font-medium text-slate-800">{selected.valueDate}</span>
                </div>
                {selected.exceptionReason ? (
                  <div className="flex items-start justify-between gap-2 rounded-md border border-rose-100 bg-rose-50/60 px-2 py-1 text-[11px]">
                    <span className="shrink-0 text-rose-600">Exception</span>
                    <span className="text-right font-medium text-rose-800">{selected.exceptionReason}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="reconciliation-block reconciliation-block-enter reconciliation-block-enter-delay-2 mt-2 rounded-lg border border-[var(--ops-line-soft)] bg-slate-50/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <BlockTitle>Match result</BlockTitle>
                {(showMatched || showSuggestion) && selected.confidence > 0 ? (
                  <ConfidenceMeter confidence={selected.confidence} />
                ) : null}
              </div>

              <div className="mt-2 space-y-2">
                {(showMatched || showSuggestion) && selected.confidence > 0 ? (
                  <div className="rounded-md border border-[var(--ops-line-soft)] bg-white px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                      Confidence
                    </p>
                    <ConfidenceMeter confidence={selected.confidence} prominent />
                  </div>
                ) : null}

                {showMatched && selected.settlement ? (
                  <div className="reconciliation-matched-settlement rounded-md border border-emerald-200/80 bg-emerald-50/50 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-700/80">
                      Linked settlement
                    </p>
                    <div className="mt-1.5">
                      <SettlementPill
                        publicId={selected.settlement.publicId}
                        reference={selected.settlement.reference}
                      />
                    </div>
                    {selected.matchReason ? (
                      <p className="mt-1.5 text-[11px] text-emerald-800/80">{selected.matchReason}</p>
                    ) : null}
                  </div>
                ) : showSuggestion && selected.suggestion ? (
                  <div className="rounded-md border border-cyan-200/70 bg-cyan-50/40 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#0a7d86]/80">
                      Suggested settlement
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-800">
                      {selected.suggestion.publicId} · {selected.suggestion.reference}
                    </p>
                    {selected.suggestion.reason ? (
                      <p className="mt-1 text-[11px] text-slate-600">{selected.suggestion.reason}</p>
                    ) : null}
                  </div>
                ) : isException ? (
                  <p className="text-[11px] text-rose-700">No settlement linked — exception blocks reconciliation.</p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No settlement candidate found. Exact matches reconcile automatically; otherwise link manually or
                    run auto-match.
                  </p>
                )}
              </div>
            </section>

            {/* Finality impact: independent reconciliation is a finality pillar —
                display-only, derived from the record's existing matched state. */}
            <section
              className={cn(
                "reconciliation-block reconciliation-block-enter reconciliation-block-enter-delay-2 mt-2 rounded-lg border px-3 py-2.5",
                showMatched
                  ? "border-emerald-200/80 bg-emerald-50/50"
                  : "border-amber-200/70 bg-amber-50/40",
              )}
            >
              <BlockTitle>Finality impact</BlockTitle>
              {showMatched ? (
                <div className="mt-1.5 flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-emerald" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-900">
                      This independent match can unlock finality review.
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800/80">
                      External record matched · settlement linked. Finality review can proceed once provider
                      proof and approvals agree.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5">
                  <p className="text-xs font-semibold text-amber-900">
                    Finality remains blocked until independent reconciliation matches.
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800/80">
                    Provider claims are excluded — only an external bank/PSP record can satisfy this pillar.
                  </p>
                </div>
              )}
            </section>

            <section className="reconciliation-block reconciliation-block-enter reconciliation-block-enter-delay-3 mt-2 rounded-lg border border-[var(--ops-line)] px-3 py-2.5">
              <BlockTitle>Resolution summary</BlockTitle>

              {isException ? (
                <div className="mt-2 space-y-2.5">
                  <p className="text-xs text-rose-700">
                    This record is flagged as an exception and is not reconciled. Review the reason above, then resolve
                    once handled.
                  </p>
                  {resolveAction ? (
                    <form action={resolveAction}>
                      <input type="hidden" name="recordId" value={selected.id} />
                      <SubmitButton variant="primary" size="sm" pendingText="Resolving...">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Resolve exception
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="text-[11px] text-slate-500">Resolving requires an operational role.</p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Resolving marks the exception as reviewed and clears it from the queue. It does not link a
                    settlement.
                  </p>
                </div>
              ) : isResolved ? (
                <p className="mt-2 text-xs text-slate-600">
                  Exception reviewed and resolved by an operator. No settlement was linked.
                </p>
              ) : showMatched && selected.settlement ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700">
                      {selected.externalRef}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                    <span className="rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-1 font-medium text-brand-emerald-ink">
                      {selected.settlement.publicId}
                    </span>
                  </div>
                  <p className="text-xs text-brand-emerald-ink">
                    {selected.matchType === "AUTO_MATCHED"
                      ? "Auto-reconciled at high confidence — no operator action required."
                      : "Manually reconciled — record linked and settlement moved to RECONCILED."}
                  </p>
                </div>
              ) : showSuggestion && selected.suggestion ? (
                <div className="mt-2 space-y-2.5">
                  {confirmAction && rejectAction ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={confirmAction}>
                          <input type="hidden" name="recordId" value={selected.id} />
                          <input type="hidden" name="settlementId" value={selected.suggestion.settlementId} />
                          <SubmitButton variant="primary" size="sm" pendingText="Confirming...">
                            <Check className="h-3.5 w-3.5" />
                            Confirm match
                          </SubmitButton>
                        </form>
                        <form action={rejectAction}>
                          <input type="hidden" name="recordId" value={selected.id} />
                          <input type="hidden" name="settlementId" value={selected.suggestion.settlementId} />
                          <SubmitButton variant="outline" size="sm" pendingText="Rejecting...">
                            <X className="h-3.5 w-3.5" />
                            Reject match
                          </SubmitButton>
                        </form>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Confirming links this record and moves the settlement to RECONCILED. Rejecting keeps it in
                        manual review.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Suggested match found. Confirming or rejecting requires an operational role.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Run auto-match or link a settlement manually from the command bar above.
                </p>
              )}
            </section>
          </div>

          <ConsoleFooter
            externalRef={selected.externalRef}
            settlementPublicId={selected.settlement?.publicId}
          />
        </div>
      ) : null}
    </div>
  );
}
