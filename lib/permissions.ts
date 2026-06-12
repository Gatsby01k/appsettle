import { Role } from "@prisma/client";

export function canApproveSettlement(role: Role) {
  return new Set<Role>([Role.OWNER, Role.ADMIN, Role.TREASURY_MANAGER]).has(role);
}

export function canManageSettings(role: Role) {
  return new Set<Role>([Role.OWNER, Role.ADMIN]).has(role);
}

export function canManageCompliance(role: Role) {
  return new Set<Role>([Role.OWNER, Role.ADMIN, Role.COMPLIANCE_OFFICER]).has(role);
}

export function canWriteSettlement(role: Role) {
  return new Set<Role>([
    Role.OWNER,
    Role.ADMIN,
    Role.TREASURY_MANAGER,
    Role.SETTLEMENT_OPERATOR,
  ]).has(role);
}

// --- P0 RBAC hardening: mutation gates ------------------------------------
// COMPLIANCE_OFFICER stays read/compliance-only; FINANCE_VIEWER is the
// read-only auditor. Neither may create quotes, settlements, or
// reconciliation evidence — reconciliation records count as INDEPENDENT
// evidence in finality, so writing them is a privileged operation.

/** OWNER / ADMIN / TREASURY_MANAGER / SETTLEMENT_OPERATOR may create quotes. */
export function canCreateQuote(role: Role) {
  return canWriteSettlement(role);
}

/** Same write set may create settlements (directly or from a quote). */
export function canCreateSettlement(role: Role) {
  return canWriteSettlement(role);
}

/** Same write set may create/link/resolve reconciliation records. */
export function canWriteReconciliation(role: Role) {
  return canWriteSettlement(role);
}

/** Same write set may run the auto-match engine. */
export function canRunReconciliationMatch(role: Role) {
  return canWriteSettlement(role);
}

/** FINANCE_VIEWER is the read-only auditor role: no mutations anywhere. */
export function isReadOnly(role: Role) {
  return role === Role.FINANCE_VIEWER;
}

/** Standard rejection copy for blocked mutations. */
export function roleErrorMessage(role: Role) {
  return isReadOnly(role)
    ? "Read-only role cannot perform this action."
    : "Your role does not allow this action.";
}
