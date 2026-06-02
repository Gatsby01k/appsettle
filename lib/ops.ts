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

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/quotes", label: "Quotes" },
      { href: "/settlements", label: "Settlements" },
      { href: "/reconciliation", label: "Reconciliation" },
    ],
  },
  {
    label: "Treasury",
    items: [
      { href: "/counterparties", label: "Counterparties" },
      { href: "/accounts", label: "Accounts" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/audit-logs", label: "Audit logs" },
      { href: "/team", label: "Team" },
      { href: "/api-reference", label: "API" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
