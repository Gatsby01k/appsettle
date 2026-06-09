"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export type SettlementAction = "approve" | "execute" | "settle" | "check" | "reconcile" | "create";

export const ACTION_STEPS: Record<SettlementAction, string[]> = {
  approve: ["Validating settlement", "Approving request", "Ready for execution"],
  execute: [
    "Creating Pontis payout",
    "Receiving transaction id",
    "Checking provider status",
    "Settling settlement",
    "Reconciling records",
  ],
  check: ["Checking provider status", "Updating settlement"],
  settle: ["Updating settlement status", "Recording lifecycle event"],
  reconcile: ["Matching records", "Finalizing reconciliation"],
  create: ["Validating quote", "Creating settlement"],
};

const EXECUTING_STEPS = [
  "Payout request created",
  "Waiting for provider status",
  "Settlement update",
  "Auto-reconciliation",
];

export type OperationPanelSettlement = {
  publicId: string;
  status: string;
  corridor: string;
  amount: string;
  provider?: string;
  providerStatus?: string;
  providerTransactionId?: string;
  hasReconciliation: boolean;
  hasAuditEvents: boolean;
};

type OperationPanelVisualState = "approved" | "executing" | "completed";

type PendingAction = { settlementId: string; action: SettlementAction; stepIndex: number };

type SettlementActionsContextValue = {
  pendingAction: PendingAction | null;
  setPendingAction: (value: Omit<PendingAction, "stepIndex"> | null) => void;
};

const SettlementActionsContext = createContext<SettlementActionsContextValue | null>(null);

function useSettlementActionsContext() {
  const context = useContext(SettlementActionsContext);
  if (!context) {
    throw new Error("Settlement action components must be used within SettlementActionsProvider.");
  }
  return context;
}

export function useSettlementActionsOptional() {
  return useContext(SettlementActionsContext);
}

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: string }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function MetadataChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-600">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </span>
  );
}

function CompactStepper({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1">
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        const stateLabel = isDone ? "completed" : isActive ? "active" : "upcoming";

        return (
          <li key={step} className="flex items-center gap-1 sm:contents">
            <div
              className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs sm:rounded-full sm:px-2.5 sm:py-0.5 ${
                isActive
                  ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-400"
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

function resolvePanelState(
  settlement: OperationPanelSettlement | null | undefined,
  pendingAction: PendingAction | null,
  autoRefresh: boolean,
  successHint?: string,
): OperationPanelVisualState | null {
  if (pendingAction?.action === "execute" || pendingAction?.action === "check") return "executing";
  if (settlement?.status === "EXECUTING" || autoRefresh || successHint === "executing" || successHint === "checked") {
    return "executing";
  }
  if (settlement?.status === "APPROVED" || pendingAction?.action === "approve" || successHint === "approved") {
    return "approved";
  }
  if (
    settlement?.status === "SETTLED" ||
    settlement?.status === "RECONCILED" ||
    successHint === "settled"
  ) {
    return "completed";
  }
  return null;
}

function providerLabel(mode: "sandbox" | "live") {
  return mode === "sandbox" ? "PontisGlobe sandbox" : "PontisGlobe";
}

export function SettlementActionsProvider({ children }: { children: ReactNode }) {
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(null);

  const setPendingAction = useCallback((value: Omit<PendingAction, "stepIndex"> | null) => {
    if (!value) {
      setPendingActionState(null);
      return;
    }
    setPendingActionState({ ...value, stepIndex: 0 });
  }, []);

  useEffect(() => {
    if (!pendingAction) return;
    const maxStep = ACTION_STEPS[pendingAction.action].length - 1;
    if (pendingAction.stepIndex >= maxStep) return;

    const timer = window.setInterval(() => {
      setPendingActionState((current) => {
        if (!current) return null;
        const last = ACTION_STEPS[current.action].length - 1;
        if (current.stepIndex >= last) return current;
        return { ...current, stepIndex: current.stepIndex + 1 };
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [pendingAction?.settlementId, pendingAction?.action, pendingAction?.stepIndex]);

  const value = useMemo(() => ({ pendingAction, setPendingAction }), [pendingAction, setPendingAction]);

  return <SettlementActionsContext.Provider value={value}>{children}</SettlementActionsContext.Provider>;
}

export function SettlementActionForm({
  settlementId,
  action,
  serverAction,
  children,
  className,
}: {
  settlementId: string;
  action: SettlementAction;
  serverAction: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const { setPendingAction } = useSettlementActionsContext();

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      setPendingAction({ settlementId, action });
      try {
        await serverAction(formData);
        router.refresh();
      } catch (error) {
        if (isNextRedirect(error)) {
          router.refresh();
          throw error;
        }
        setPendingAction(null);
        throw error;
      } finally {
        setPendingAction(null);
      }
    },
    [action, router, serverAction, setPendingAction, settlementId],
  );

  return (
    <form action={handleSubmit} className={className}>
      {children}
    </form>
  );
}

export function useSettlementActionStep(settlementId?: string, action?: SettlementAction) {
  const context = useSettlementActionsOptional();
  if (!context?.pendingAction || !settlementId || !action) return null;
  if (
    context.pendingAction.settlementId !== settlementId ||
    context.pendingAction.action !== action
  ) {
    return null;
  }
  const steps = ACTION_STEPS[action];
  return steps[context.pendingAction.stepIndex] ?? steps[steps.length - 1];
}

const ROW_STATUS_HINTS: Record<string, string> = {
  APPROVED: "Ready to execute",
  EXECUTING: "Tracking via PontisGlobe",
  SETTLED: "Payout completed",
  RECONCILED: "Reconciled automatically",
};

export function SettlementRowStatusHint({
  status,
  settlementId,
}: {
  status: string;
  settlementId: string;
}) {
  const { pendingAction } = useSettlementActionsContext();
  const hint = ROW_STATUS_HINTS[status];
  if (!hint) return null;

  const isPending = pendingAction?.settlementId === settlementId;

  return (
    <p className={`text-xs ${isPending ? "text-cyan-600" : "text-slate-500"}`} role="status" aria-live="polite">
      {isPending ? `${hint} · processing` : hint}
    </p>
  );
}

export function SettlementRowActivityNote(_props: { settlementId: string }) {
  return null;
}

export function SettlementOperationPanel({
  autoRefresh,
  focusSettlement,
  successHint,
}: {
  autoRefresh: boolean;
  focusSettlement?: OperationPanelSettlement | null;
  successHint?: string;
}) {
  const { pendingAction } = useSettlementActionsContext();
  const panelState = resolvePanelState(focusSettlement, pendingAction, autoRefresh, successHint);

  if (!panelState) return null;

  const executingActiveIndex = pendingAction
    ? Math.min(pendingAction.stepIndex, EXECUTING_STEPS.length - 1)
    : autoRefresh
      ? 1
      : focusSettlement?.providerTransactionId
        ? 1
        : 0;

  if (panelState === "approved" && focusSettlement) {
    return (
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Ready for provider execution</p>
            <p className="mt-1 text-sm text-slate-600">
              Settlement approved. Execute payout via PontisGlobe to start provider tracking.
            </p>
          </div>
          <MetadataChip label="Next step" value="Execute payout" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetadataChip label="Provider" value={providerLabel("sandbox")} />
          <MetadataChip label="Amount" value={focusSettlement.amount} />
          {focusSettlement.corridor ? (
            <MetadataChip label="Route" value={focusSettlement.corridor} />
          ) : null}
          <MetadataChip label="Settlement" value={focusSettlement.publicId} />
        </div>
      </div>
    );
  }

  if (panelState === "executing") {
    return (
      <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Provider execution in progress</p>
            <p className="mt-1 text-sm text-slate-600">
              INRSettle is tracking the payout status from PontisGlobe.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-cyan-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-cyan-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
            Live refresh
          </span>
        </div>
        <div className="mt-3">
          <CompactStepper steps={EXECUTING_STEPS} activeIndex={executingActiveIndex} />
        </div>
        {focusSettlement ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-cyan-100 pt-3">
            <MetadataChip label="Provider" value={providerLabel("sandbox")} />
            {focusSettlement.amount ? <MetadataChip label="Amount" value={focusSettlement.amount} /> : null}
            {focusSettlement.providerTransactionId ? (
              <MetadataChip label="Transaction" value={focusSettlement.providerTransactionId} />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (panelState === "completed" && focusSettlement) {
    const settlementStatus =
      focusSettlement.status === "RECONCILED" ? "reconciled" : "settled";
    const providerStatus = focusSettlement.providerStatus ?? "completed";

    return (
      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">Payout completed</p>
          <p className="mt-1 text-sm text-slate-600">
            Provider execution completed and settlement was recorded.
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs">
            <span className="text-slate-500">Provider</span>
            <span className="font-medium text-slate-800">{providerLabel("live")}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs">
            <span className="text-slate-500">Provider status</span>
            <span className="font-medium capitalize text-emerald-700">{providerStatus}</span>
          </div>
          {focusSettlement.providerTransactionId ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs sm:col-span-2">
              <span className="text-slate-500">Provider transaction id</span>
              <span className="font-mono font-medium text-slate-800">{focusSettlement.providerTransactionId}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs">
            <span className="text-slate-500">Settlement</span>
            <span className="font-medium capitalize text-emerald-700">{settlementStatus}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs">
            <span className="text-slate-500">Audit trail</span>
            <span className="font-medium text-emerald-700">
              {focusSettlement.hasAuditEvents ? "Recorded" : "Pending"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs sm:col-span-2">
            <span className="text-slate-500">Reconciliation</span>
            <span className="font-medium text-emerald-700">
              {focusSettlement.hasReconciliation ? "Auto matched" : "Not linked"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function SettlementAutoRefresh({
  enabled,
  intervalMs = 2500,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}
