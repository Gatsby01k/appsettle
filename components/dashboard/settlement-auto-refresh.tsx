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

const ACTION_STATUS_NOTES: Record<SettlementAction, string> = {
  approve: "Approving settlement...",
  execute: "Executing payout via PontisGlobe...",
  settle: "Settling settlement...",
  check: "Checking provider status...",
  reconcile: "Reconciling settlement...",
  create: "Creating settlement...",
};

type PendingAction = { settlementId: string; action: SettlementAction };

type SettlementActionsContextValue = {
  pendingAction: PendingAction | null;
  setPendingAction: (value: PendingAction | null) => void;
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

export function SettlementActionsProvider({ children }: { children: ReactNode }) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const value = useMemo(() => ({ pendingAction, setPendingAction }), [pendingAction]);

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

export function SettlementRowActivityNote({ settlementId }: { settlementId: string }) {
  const { pendingAction } = useSettlementActionsContext();

  if (!pendingAction || pendingAction.settlementId !== settlementId) {
    return null;
  }

  return (
    <p className="mt-1 text-xs font-medium text-cyan-700" role="status" aria-live="polite">
      {ACTION_STATUS_NOTES[pendingAction.action]}
    </p>
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
