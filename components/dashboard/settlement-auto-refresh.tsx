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

const ACTION_LABELS: Record<SettlementAction, string> = {
  approve: "Approval",
  execute: "Payout execution",
  check: "Status check",
  settle: "Settlement",
  reconcile: "Reconciliation",
  create: "Creation",
};

const BACKGROUND_STEPS = [
  "Creating or tracking payout request",
  "Waiting for PontisGlobe response",
  "Moving lifecycle to settled state",
  "Auto-match and audit trail recording",
];

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

function StepList({
  steps,
  activeIndex,
  tone = "cyan",
}: {
  steps: string[];
  activeIndex: number;
  tone?: "cyan" | "slate";
}) {
  const activeText = tone === "cyan" ? "text-cyan-100" : "text-slate-700";
  const doneText = tone === "cyan" ? "text-cyan-200/60" : "text-slate-400";
  const pendingText = tone === "cyan" ? "text-cyan-200/40" : "text-slate-300";
  const activeBg = tone === "cyan" ? "bg-cyan-300" : "bg-cyan-500";
  const doneBg = tone === "cyan" ? "bg-cyan-400/50" : "bg-emerald-400";
  const pendingBg = tone === "cyan" ? "bg-cyan-900/40" : "bg-slate-200";

  return (
    <ol className="space-y-2">
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <li
            key={step}
            className={`flex items-start gap-2 text-sm ${
              isActive ? activeText : isDone ? doneText : pendingText
            }`}
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                isActive ? `${activeBg} animate-pulse` : isDone ? doneBg : pendingBg
              }`}
            />
            <span className={isActive ? "font-medium" : undefined}>
              {step}
              {isActive ? "..." : isDone ? " — done" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
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

export function SettlementRowActivityNote({ settlementId }: { settlementId: string }) {
  const { pendingAction } = useSettlementActionsContext();

  if (!pendingAction || pendingAction.settlementId !== settlementId) {
    return null;
  }

  const steps = ACTION_STEPS[pendingAction.action];
  const currentStep = steps[pendingAction.stepIndex] ?? steps[steps.length - 1];

  return (
    <div className="mt-1.5 rounded-lg border border-cyan-200/60 bg-cyan-50 px-2 py-1.5" role="status" aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-800">
        {ACTION_LABELS[pendingAction.action]} in progress
      </p>
      <p className="mt-0.5 text-xs font-medium text-cyan-700">{currentStep}...</p>
    </div>
  );
}

export function SettlementOperationPanel({
  autoRefresh,
  settlementLabel,
}: {
  autoRefresh: boolean;
  settlementLabel?: string;
}) {
  const { pendingAction } = useSettlementActionsContext();
  const visible = Boolean(pendingAction) || autoRefresh;

  if (!visible) return null;

  const actionSteps = pendingAction ? ACTION_STEPS[pendingAction.action] : BACKGROUND_STEPS;
  const activeIndex = pendingAction
    ? pendingAction.stepIndex
    : autoRefresh
      ? 1
      : 0;

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-100">Settlement operation activity</p>
          <p className="mt-1 text-sm text-cyan-200/80">
            {pendingAction
              ? `${ACTION_LABELS[pendingAction.action]} running${settlementLabel ? ` for ${settlementLabel}` : ""}.`
              : "INRSettle is refreshing provider and reconciliation state automatically."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 px-3 py-1 text-xs font-medium text-cyan-100">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200 border-t-transparent" />
          {pendingAction ? "Processing" : "Live refresh"}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-950/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-200/70">
          {pendingAction ? `${ACTION_LABELS[pendingAction.action]} steps` : "Background monitoring"}
        </p>
        <StepList steps={actionSteps} activeIndex={activeIndex} />
      </div>
    </div>
  );
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
