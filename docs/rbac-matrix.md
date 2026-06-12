# RBAC matrix

Current role capabilities, as enforced in code. Source of truth:
`lib/permissions.ts` (gates), `lib/settlement-actions.ts` (lifecycle
dual-control), the server actions in `app/(dashboard)/**`, and
`lib/__tests__/permissions.test.ts` (which asserts this matrix).

All data access is organization-scoped (`organizationId`) for every role —
RBAC controls *what you can do*, membership controls *what you can see*.

| Capability | OWNER | ADMIN | TREASURY_MANAGER | SETTLEMENT_OPERATOR | COMPLIANCE_OFFICER | FINANCE_VIEWER |
|---|---|---|---|---|---|---|
| View dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create quote | ✓ | ✓ | ✓ | ✓ | — | — |
| Create settlement | ✓ | ✓ | ✓ | ✓ | — | — |
| Record provider proof (manual) | ✓ | ✓ | ✓ | ✓ | — | — |
| Add reconciliation record | ✓ | ✓ | ✓ | ✓ | — | — |
| Run auto-match | ✓ | ✓ | ✓ | ✓ | — | — |
| Approve lifecycle (REQUESTED → APPROVED) | ✓* | ✓* | ✓* | — | — | — |
| Approve finality | ✓* | ✓* | ✓* | — | — | — |
| View reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View audit logs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Provider Risk Shield | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage settings | ✓ | ✓ | — | — | — | — |
| Compliance review / flag only | ✓ | ✓ | — | — | ✓ | — |

`✓*` = **dual control**: the settlement **creator can never approve their own
settlement** — neither the lifecycle APPROVED transition nor finality. A
different operator with an approval role must approve. Both checks are
enforced server-side (`lifecycleApprovalViolation` for lifecycle; the
`approveFinality` action + `lib/live-pilot.ts` for finality).

## Role intents

- **OWNER / ADMIN** — full admin/write. Settings management, all operational
  writes, approvals (never of their own settlements).
- **TREASURY_MANAGER** — the approver/write role. Operational writes plus
  lifecycle/finality approval of *other operators'* settlements.
- **SETTLEMENT_OPERATOR** — operational writes (quotes, settlements, proof,
  reconciliation), no approvals.
- **COMPLIANCE_OFFICER** — read/compliance-only. `canManageCompliance` is
  reserved; no quote/settlement/reconciliation mutations, no approvals.
- **FINANCE_VIEWER** — read-only auditor. No mutations anywhere; blocked
  server-side with "Read-only role cannot perform this action."

## Next steps (documented, not yet implemented)

- **Compliance "flag for review" action**: a minimal, audit-only action
  (`compliance.flagged_for_review` event, no state transition) for
  COMPLIANCE_OFFICER. Deferred to keep this hardening pass free of new
  mutation surfaces.
- In-app role management UI with `membership.role_changed` audit events
  (script-side events exist today in `scripts/create-demo-approver.ts`).
