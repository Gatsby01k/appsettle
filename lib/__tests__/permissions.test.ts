import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  canApproveSettlement,
  canCreateQuote,
  canCreateSettlement,
  canManageCompliance,
  canManageSettings,
  canRunReconciliationMatch,
  canWriteReconciliation,
  canWriteSettlement,
  isReadOnly,
  roleErrorMessage,
} from "../permissions";

// Full role × capability matrix. P0 RBAC: read-only and compliance roles
// must be blocked from every mutation; the write set is exactly
// OWNER / ADMIN / TREASURY_MANAGER / SETTLEMENT_OPERATOR.

const ALL_ROLES = Object.values(Role);
const WRITE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.TREASURY_MANAGER, Role.SETTLEMENT_OPERATOR];
const APPROVE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.TREASURY_MANAGER];

const MUTATION_GATES = [
  ["canCreateQuote", canCreateQuote],
  ["canCreateSettlement", canCreateSettlement],
  ["canWriteReconciliation", canWriteReconciliation],
  ["canRunReconciliationMatch", canRunReconciliationMatch],
  ["canWriteSettlement", canWriteSettlement],
] as const;

describe("role × capability matrix", () => {
  it.each(MUTATION_GATES)("%s allows exactly the write set", (_name, gate) => {
    for (const role of ALL_ROLES) {
      expect(gate(role)).toBe(WRITE_ROLES.includes(role));
    }
  });

  it("OWNER, ADMIN, TREASURY_MANAGER and SETTLEMENT_OPERATOR are allowed all operational writes", () => {
    for (const role of WRITE_ROLES) {
      for (const [, gate] of MUTATION_GATES) expect(gate(role)).toBe(true);
    }
  });

  it("finality approval stays OWNER/ADMIN/TREASURY_MANAGER — operator and compliance excluded", () => {
    for (const role of ALL_ROLES) {
      expect(canApproveSettlement(role)).toBe(APPROVE_ROLES.includes(role));
    }
    expect(canApproveSettlement(Role.SETTLEMENT_OPERATOR)).toBe(false);
    expect(canApproveSettlement(Role.COMPLIANCE_OFFICER)).toBe(false);
    expect(canApproveSettlement(Role.FINANCE_VIEWER)).toBe(false);
  });
});

describe("COMPLIANCE_OFFICER is read/compliance-only", () => {
  it("cannot create quotes, settlements, or reconciliation evidence", () => {
    expect(canCreateQuote(Role.COMPLIANCE_OFFICER)).toBe(false);
    expect(canCreateSettlement(Role.COMPLIANCE_OFFICER)).toBe(false);
    expect(canWriteReconciliation(Role.COMPLIANCE_OFFICER)).toBe(false);
    expect(canRunReconciliationMatch(Role.COMPLIANCE_OFFICER)).toBe(false);
  });

  it("keeps its existing compliance-management capability (unchanged)", () => {
    expect(canManageCompliance(Role.COMPLIANCE_OFFICER)).toBe(true);
    expect(canManageSettings(Role.COMPLIANCE_OFFICER)).toBe(false);
  });
});

describe("FINANCE_VIEWER is the read-only auditor: no mutations at all", () => {
  it("cannot create a quote", () => {
    expect(canCreateQuote(Role.FINANCE_VIEWER)).toBe(false);
  });
  it("cannot create a settlement", () => {
    expect(canCreateSettlement(Role.FINANCE_VIEWER)).toBe(false);
  });
  it("cannot create a reconciliation record", () => {
    expect(canWriteReconciliation(Role.FINANCE_VIEWER)).toBe(false);
  });
  it("cannot run auto-match", () => {
    expect(canRunReconciliationMatch(Role.FINANCE_VIEWER)).toBe(false);
  });
  it("is the only role flagged read-only, with explicit rejection copy", () => {
    for (const role of ALL_ROLES) {
      expect(isReadOnly(role)).toBe(role === Role.FINANCE_VIEWER);
    }
    expect(roleErrorMessage(Role.FINANCE_VIEWER)).toBe("Read-only role cannot perform this action.");
    expect(roleErrorMessage(Role.COMPLIANCE_OFFICER)).toBe("Your role does not allow this action.");
  });
});
