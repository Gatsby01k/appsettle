"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useSettlementActionsOptional } from "@/components/dashboard/settlement-auto-refresh";
import { cn } from "@/lib/utils";

export type SettlementOperationConsoleData = {
  status: string;
  corridor?: string;
  amount: string;
  provider?: string;
  providerStatus?: string;
  providerTransactionId?: string;
  hasReconciliation: boolean;
  hasAuditEvents: boolean;
};

const CONSOLE_STATUSES = new Set(["APPROVED", "EXECUTING", "SETTLED", "RECONCILED"]);

const EXECUTING_STEPS = [
  "Payout request created",
  "Waiting for provider status",
  "Settlement update",
  "Auto-reconciliation",
];

function MetadataChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </span>
  );
}

function CompactStepper({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        const stateLabel = isDone ? "completed" : isActive ? "active" : "upcoming";

        return (
          <li key={step} className="flex items-center gap-1">
            <div
              className={`flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                isActive
                  ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  isActive ? "animate-pulse bg-cyan-500" : isDone ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <span className={isActive ? "font-medium" : undefined}>{step}</span>
              <span className="hidden text-[10px] uppercase tracking-wide opacity-70 sm:inline">
                — {stateLabel}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
                →
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-100 bg-white px-2.5 py-1.5 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-emerald-700">{value}</span>
    </div>
  );
}

type ConsoleMode = "approved" | "executing" | "settled" | "reconciled";

function resolveConsoleMode(
  settlement: SettlementOperationConsoleData,
  settlementId: string,
  pendingSettlementId?: string,
  pendingAction?: string,
  highlightCompleted = false,
): ConsoleMode | null {
  if (pendingSettlementId === settlementId) {
    if (pendingAction === "execute" || pendingAction === "check") return "executing";
    if (pendingAction === "approve") return "approved";
  }

  if (!CONSOLE_STATUSES.has(settlement.status)) return null;

  if (settlement.status === "RECONCILED") return highlightCompleted ? "reconciled" : null;
  if (settlement.status === "SETTLED") return highlightCompleted ? "settled" : null;
  if (settlement.status === "EXECUTING") return "executing";
  if (settlement.status === "APPROVED") return "approved";
  return null;
}

export function SettlementPageFlash({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "error";
}) {
  const isError = tone === "error";
  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
        isError
          ? "border-rose-200 bg-rose-50/80 text-rose-800"
          : "border-[#00c79d]/25 bg-[#e7faf4]/80 text-brand-emerald-ink",
      )}
      role="status"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  );
}

function providerLabel(mode: "sandbox" | "live") {
  return mode === "sandbox" ? "PontisGlobe sandbox" : "PontisGlobe";
}

export function SettlementOperationConsoleRow({
  settlementId,
  settlement,
  autoRefresh = false,
  highlightCompleted = false,
  colSpan = 5,
}: {
  settlementId: string;
  settlement: SettlementOperationConsoleData;
  autoRefresh?: boolean;
  highlightCompleted?: boolean;
  colSpan?: number;
}) {
  const actions = useSettlementActionsOptional();
  const pending = actions?.pendingAction;
  const mode = resolveConsoleMode(
    settlement,
    settlementId,
    pending?.settlementId,
    pending?.action,
    highlightCompleted,
  );

  if (!mode) return null;

  const executingActiveIndex =
    pending?.settlementId === settlementId &&
    (pending.action === "execute" || pending.action === "check")
      ? Math.min(pending.stepIndex, EXECUTING_STEPS.length - 1)
      : autoRefresh
        ? 1
        : settlement.providerTransactionId
          ? 1
          : 0;

  const providerStatus = settlement.providerStatus ?? "completed";

  return (
    <tr className="text-sm">
      <td colSpan={colSpan} className="px-4 pb-3 pt-0 first:pl-5 last:pr-5">
        {mode === "approved" ? (
          <div
            className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">Ready for provider execution</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Settlement approved. Execute payout via PontisGlobe to start provider tracking.
                </p>
              </div>
              <MetadataChip label="Next step" value="Execute payout" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <MetadataChip label="Provider" value={providerLabel("sandbox")} />
              <MetadataChip label="Amount" value={settlement.amount} />
              {settlement.corridor ? <MetadataChip label="Route" value={settlement.corridor} /> : null}
            </div>
          </div>
        ) : null}

        {mode === "executing" ? (
          <div
            className="rounded-lg border border-cyan-200/80 bg-cyan-50/30 px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">Provider execution in progress</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  INRSettle is tracking the payout status from PontisGlobe.
                </p>
              </div>
              {autoRefresh ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[10px] font-medium text-cyan-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                  Live refresh
                </span>
              ) : null}
            </div>
            <div className="mt-2">
              <CompactStepper steps={EXECUTING_STEPS} activeIndex={executingActiveIndex} />
            </div>
            {settlement.providerTransactionId ? (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-cyan-100/80 pt-2">
                <MetadataChip label="Transaction" value={settlement.providerTransactionId} />
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "settled" ? (
          <div
            className="rounded-lg border border-emerald-200/80 bg-emerald-50/30 px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <div>
              <p className="text-xs font-semibold text-slate-900">Payout completed</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Provider execution completed and settlement was recorded.
              </p>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              <ProofItem label="Provider" value={providerLabel("live")} />
              <ProofItem label="Provider status" value={providerStatus} />
              {settlement.providerTransactionId ? (
                <ProofItem label="Provider transaction id" value={settlement.providerTransactionId} />
              ) : null}
              <ProofItem label="Settlement status" value="settled" />
              <ProofItem
                label="Audit trail"
                value={settlement.hasAuditEvents ? "Recorded" : "Pending"}
              />
            </div>
          </div>
        ) : null}

        {mode === "reconciled" ? (
          <div
            className="rounded-lg border border-emerald-200/80 bg-emerald-50/30 px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <div>
              <p className="text-xs font-semibold text-slate-900">Settlement reconciled</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Provider payout, settlement update, reconciliation and audit trail are complete.
              </p>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              <ProofItem label="Provider payout" value="Completed" />
              <ProofItem label="Settlement" value="Settled" />
              <ProofItem
                label="Reconciliation"
                value={settlement.hasReconciliation ? "Matched" : "Not linked"}
              />
              <ProofItem
                label="Audit trail"
                value={settlement.hasAuditEvents ? "Recorded" : "Pending"}
              />
            </div>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
