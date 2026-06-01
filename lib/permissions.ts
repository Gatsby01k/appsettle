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
