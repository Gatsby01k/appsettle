"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, CircleCheckBig, Copy, XCircle } from "lucide-react";
import {
  SettlementActionForm,
  useSettlementActionsOptional,
} from "@/components/dashboard/settlement-auto-refresh";
import { SubmitButton } from "@/components/ui/submit-button";
import { reconciliationPendingActions } from "@/lib/settlement-actions";
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
  "Request sent",
  "Provider confirmation",
  "Settlement update",
  "Reconciliation",
];


function TrackLane({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ol className="ptrack" aria-label="Provider tracking">
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <li key={step} className={cn("ptrack__step", isDone && "ptrack__step--done", isActive && "ptrack__step--active")}>
            <span className="ptrack__dot" aria-hidden="true">
              {isDone ? "✓" : ""}
            </span>
            <span className="ptrack__label">{step}</span>
            <span className="ptrack__state">{isDone ? "Done" : isActive ? "Waiting" : "Next"}</span>
          </li>
        );
      })}
    </ol>
  );
}

type ConsoleMode = "approved" | "executing" | "settled" | "reconcile_required" | "reconciled";

function MetadataChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </span>
  );
}

function TransactionIdPill({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="settlement-tx-pill group inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/60 px-2 py-0.5 text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
      title="Copy transaction id"
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <span className="truncate">{value}</span>
      <Copy className="h-2.5 w-2.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-80" />
    </button>
  );
}

const CONSOLE_GLOW: Record<ConsoleMode, string> = {
  approved: "border-amber-200/80",
  executing: "border-cyan-200/80 settlement-console-glow",
  settled: "border-emerald-200/80",
  reconcile_required: "border-amber-200/80",
  reconciled: "border-emerald-300/90 settlement-console-glow",
};

function ConsolePanel({
  mode,
  children,
}: {
  mode: ConsoleMode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "settlement-console-enter rounded-lg border px-3 py-2.5",
        CONSOLE_GLOW[mode],
        mode === "approved" && "bg-amber-50/40",
        mode === "executing" && "bg-cyan-50/30",
        (mode === "settled" || mode === "reconciled") && "bg-emerald-50/30",
        mode === "reconcile_required" && "bg-amber-50/30",
      )}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

function ProofItem({
  label,
  value,
  index = 0,
  mono,
}: {
  label: string;
  value: string;
  index?: number;
  mono?: boolean;
}) {
  return (
    <div
      className="settlement-proof-enter flex items-center justify-between gap-2 rounded-md border border-emerald-100/90 bg-white/90 px-2 py-1 text-[11px]"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <span className="shrink-0 text-slate-500">{label}</span>
      {mono ? (
        <TransactionIdPill value={value} />
      ) : (
        <span className="truncate text-right font-medium text-emerald-700">{value}</span>
      )}
    </div>
  );
}

function resolveConsoleMode(
  settlement: SettlementOperationConsoleData,
  settlementId: string,
  pendingSettlementId?: string,
  pendingAction?: string,
  reconcileRequired?: boolean,
): ConsoleMode | null {
  if (pendingSettlementId === settlementId) {
    if (pendingAction === "execute" || pendingAction === "check") return "executing";
    if (pendingAction === "approve") return "approved";
    if (pendingAction === "reconcile") {
      if (settlement.status === "RECONCILED") return "reconciled";
      if (reconcileRequired) return "reconcile_required";
      return "settled";
    }
  }

  if (settlement.status === "RECONCILED") return "reconciled";
  if (settlement.status === "SETTLED" && !settlement.hasReconciliation) {
    return reconcileRequired ? "reconcile_required" : "settled";
  }

  if (!CONSOLE_STATUSES.has(settlement.status)) return null;

  if (settlement.status === "EXECUTING") return "executing";
  if (settlement.status === "APPROVED") return "approved";
  return null;
}

export function SettlementRowStatusSubtext({
  status,
  settlementId,
}: {
  status: string;
  settlementId: string;
}) {
  const actions = useSettlementActionsOptional();
  const isPending = actions?.pendingAction?.settlementId === settlementId;

  let hint: string | null = null;
  if (status === "APPROVED") hint = "Ready to execute";
  else if (status === "EXECUTING") hint = "Tracking via PontisGlobe";
  else if (status === "SETTLED") hint = "Awaiting independent reconciliation";
  else if (status === "RECONCILED") hint = "Reconciled automatically";

  if (!hint) return null;

  return (
    <p
      className={cn("text-xs", isPending ? "text-cyan-600" : "text-slate-500")}
      role="status"
      aria-live="polite"
    >
      {isPending ? `${hint} · processing` : hint}
    </p>
  );
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

function ReconciliationProofGrid({
  settlement,
  providerStatus,
}: {
  settlement: SettlementOperationConsoleData;
  providerStatus: string;
}) {
  const items = [
    { label: "Provider", value: settlement.provider ?? providerLabel("live") },
    { label: "Provider status", value: providerStatus },
    ...(settlement.providerTransactionId
      ? [{ label: "Provider transaction id", value: settlement.providerTransactionId, mono: true }]
      : []),
    { label: "Settlement status", value: "settled" },
    { label: "Audit trail", value: settlement.hasAuditEvents ? "Recorded" : "Pending" },
  ];

  return (
    <div className="mt-2 grid gap-1 sm:grid-cols-2">
      {items.map((item, index) => (
        <ProofItem
          key={item.label}
          label={item.label}
          value={item.value}
          index={index}
          mono={"mono" in item ? item.mono : undefined}
        />
      ))}
    </div>
  );
}

function ReconciledProofGrid({
  settlement,
  providerStatus,
}: {
  settlement: SettlementOperationConsoleData;
  providerStatus: string;
}) {
  const items = [
    { label: "Provider", value: settlement.provider ?? providerLabel("live") },
    { label: "Provider status", value: providerStatus },
    ...(settlement.providerTransactionId
      ? [{ label: "Provider transaction id", value: settlement.providerTransactionId, mono: true }]
      : []),
    { label: "Settlement", value: "Settled" },
    { label: "Reconciliation", value: "Matched" },
    { label: "Audit trail", value: "Recorded" },
  ];

  return (
    <div className="mt-1.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <ProofItem
          key={item.label}
          label={item.label}
          value={item.value}
          index={index}
          mono={"mono" in item ? item.mono : undefined}
        />
      ))}
    </div>
  );
}

export function SettlementOperationConsoleRow({
  settlementId,
  settlement,
  autoRefresh = false,
  canReconcile = false,
  autoMatchAction,
  hasOpenRecords = true,
  generateReconcileAction,
  reconcileRequired = false,
  inlineError,
  colSpan = 5,
  asCard = false,
}: {
  settlementId: string;
  settlement: SettlementOperationConsoleData;
  autoRefresh?: boolean;
  canReconcile?: boolean;
  autoMatchAction?: (formData: FormData) => Promise<void>;
  /** Whether any unlinked, independent bank/PSP record exists for auto-match. */
  hasOpenRecords?: boolean;
  generateReconcileAction?: (formData: FormData) => Promise<void>;
  reconcileRequired?: boolean;
  inlineError?: string;
  colSpan?: number;
  /** Render as a plain block (for case-card layouts) instead of a table row. */
  asCard?: boolean;
}) {
  const actions = useSettlementActionsOptional();
  const pending = actions?.pendingAction;
  const mode = resolveConsoleMode(
    settlement,
    settlementId,
    pending?.settlementId,
    pending?.action,
    reconcileRequired,
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

  // Single source of truth for the reconciliation-pending action list:
  // unavailable actions are HIDDEN (never disabled ghosts), and the list
  // is regression-tested in lib/__tests__/settlement-actions.test.ts.
  const settledActions = reconciliationPendingActions({
    canReconcile,
    autoMatchAvailable: Boolean(autoMatchAction),
    hasOpenRecords,
  });

  const content = (
    <>
        {mode === "approved" ? (
          <ConsolePanel mode="approved">
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
          </ConsolePanel>
        ) : null}

        {mode === "executing" ? (
          <ConsolePanel mode="executing">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">Provider tracking</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Payout submitted via PontisGlobe. Waiting for provider confirmation.
                </p>
              </div>
              {autoRefresh ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-200/90 bg-white px-2 py-0.5 text-[10px] font-medium text-cyan-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="settlement-live-dot absolute inset-0 rounded-full bg-cyan-500 text-cyan-500" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  </span>
                  Tracking
                </span>
              ) : null}
            </div>
            <div className="mt-2">
              <TrackLane steps={EXECUTING_STEPS} activeIndex={executingActiveIndex} />
            </div>
            {settlement.providerTransactionId ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-cyan-100/80 pt-1.5">
                <span className="text-[10px] text-slate-500">Provider transaction</span>
                <TransactionIdPill value={settlement.providerTransactionId} />
              </div>
            ) : null}
          </ConsolePanel>
        ) : null}

        {mode === "settled" ? (
          <ConsolePanel mode="settled">
            <div>
              <p className="text-xs font-semibold text-slate-900">Awaiting independent reconciliation</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Provider payout is complete. Add or match a bank/PSP record before finality.
              </p>
            </div>
            <ReconciliationProofGrid settlement={settlement} providerStatus={providerStatus} />
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-emerald-100/80 pt-2">
              <Link
                href="/reconciliation"
                className="inline-flex h-8 items-center rounded-lg bg-brand-emerald px-3 text-xs font-semibold text-white shadow-ops-xs transition-colors hover:bg-brand-emerald-ink"
              >
                Open reconciliation
              </Link>
              {settledActions.includes("run_auto_match") && autoMatchAction ? (
                <SettlementActionForm
                  settlementId={settlementId}
                  action="reconcile"
                  serverAction={autoMatchAction}
                >
                  <input type="hidden" name="settlementId" value={settlementId} />
                  <SubmitButton
                    type="submit"
                    variant="outline"
                    size="sm"
                    pendingText="Matching..."
                    settlementId={settlementId}
                    action="reconcile"
                  >
                    Run auto-match
                  </SubmitButton>
                </SettlementActionForm>
              ) : null}
            </div>
          </ConsolePanel>
        ) : null}

        {mode === "reconcile_required" ? (
          <ConsolePanel mode="reconcile_required">
            <div>
              <p className="text-xs font-semibold text-slate-900">Reconciliation record required</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Provider payout completed, but no matching bank record was found for this settlement.
              </p>
            </div>
            <ReconciliationProofGrid settlement={settlement} providerStatus={providerStatus} />
            {inlineError ? (
              <p className="mt-2 text-[11px] font-medium text-rose-700" role="alert">
                {inlineError}
              </p>
            ) : null}
            <p className="mt-2 text-[11px] text-slate-600">
              Create a matching bank record and reconcile this settlement.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-amber-100/80 pt-2">
              {canReconcile && generateReconcileAction ? (
                <SettlementActionForm
                  settlementId={settlementId}
                  action="reconcile"
                  serverAction={generateReconcileAction}
                >
                  <input type="hidden" name="settlementId" value={settlementId} />
                  <SubmitButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    pendingText="Generating..."
                    settlementId={settlementId}
                    action="reconcile"
                  >
                    Generate bank record & reconcile
                  </SubmitButton>
                </SettlementActionForm>
              ) : null}
              <Link
                href="/reconciliation"
                className="text-[11px] font-medium text-cyan-700 underline-offset-2 hover:text-cyan-800 hover:underline"
              >
                Open reconciliation
              </Link>
            </div>
          </ConsolePanel>
        ) : null}

        {mode === "reconciled" ? (
          <ConsolePanel mode="reconciled">
            <div className="flex items-start gap-2">
              <CircleCheckBig className="settlement-complete-icon mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-900">Settlement complete</p>
                <p className="mt-0.5 text-[11px] text-emerald-700/85">
                  Provider payout, settlement update, reconciliation and audit trail are complete.
                </p>
              </div>
            </div>
            <ReconciledProofGrid settlement={settlement} providerStatus={providerStatus} />
          </ConsolePanel>
        ) : null}
    </>
  );

  if (asCard) {
    return <div className="text-sm">{content}</div>;
  }

  return (
    <tr className="text-sm">
      <td colSpan={colSpan} className="px-4 pb-2 pt-0 first:pl-5 last:pr-5">
        {content}
      </td>
    </tr>
  );
}
