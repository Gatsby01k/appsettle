export const SETTLEMENT_LIFECYCLE = [
  "REQUESTED",
  "APPROVED",
  "EXECUTING",
  "SETTLED",
  "RECONCILED",
] as const;

export type SettlementLifecycleStep = (typeof SETTLEMENT_LIFECYCLE)[number];

export function settlementStepIndex(status: string) {
  const index = SETTLEMENT_LIFECYCLE.indexOf(status as SettlementLifecycleStep);
  return index >= 0 ? index : 0;
}

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/quotes", label: "Quotes" },
  { href: "/settlements", label: "Settlements" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/audit-logs", label: "Audit logs" },
  { href: "/settings", label: "Settings" },
] as const;
