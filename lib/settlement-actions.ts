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
