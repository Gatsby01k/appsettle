/**
 * Pure helper for the "Awaiting independent reconciliation" state
 * (settlement SETTLED, provider payout complete, no matched independent
 * record yet). Single source of truth for which reconciliation actions
 * render, so the UI can never show duplicates or unavailable actions.
 *
 * Rules:
 * - "Open reconciliation" is always the primary action.
 * - "Run auto-match" renders ONLY when the operator can reconcile, an
 *   auto-match action is wired, AND at least one unlinked independent
 *   bank/PSP record exists for the engine to work with. Otherwise it is
 *   hidden — never rendered as a disabled ghost button.
 */
/**
 * P1 RBAC: lifecycle dual-control. The settlement creator may never approve
 * their own settlement's lifecycle (REQUESTED -> APPROVED). Mirrors the
 * finality dual-control rule, which stays enforced separately and unchanged.
 *
 * Returns the violation message, or null when the transition is allowed.
 * Only the APPROVED target is dual-controlled — execution/settle transitions
 * are unaffected.
 */
export function lifecycleApprovalViolation(input: {
  targetStatus: string;
  creatorId: string | null | undefined;
  approverId: string;
}): string | null {
  if (input.targetStatus !== "APPROVED") return null;
  if (input.creatorId && input.creatorId === input.approverId) {
    return "Dual control: the settlement creator cannot approve this settlement — a different operator must approve.";
  }
  return null;
}

export type ReconciliationPendingAction = "open_reconciliation" | "run_auto_match";

export function reconciliationPendingActions(input: {
  canReconcile: boolean;
  autoMatchAvailable: boolean;
  hasOpenRecords: boolean;
}): ReconciliationPendingAction[] {
  const actions: ReconciliationPendingAction[] = ["open_reconciliation"];
  if (input.canReconcile && input.autoMatchAvailable && input.hasOpenRecords) {
    actions.push("run_auto_match");
  }
  return actions;
}
