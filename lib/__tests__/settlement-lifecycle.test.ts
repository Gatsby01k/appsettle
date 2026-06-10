import { describe, expect, it } from "vitest";
import { SettlementStatus } from "@prisma/client";
import {
  SETTLEMENT_TRANSITIONS,
  assertValidSettlementTransition,
  isValidSettlementTransition,
} from "../settlement-lifecycle";

describe("settlement state machine", () => {
  it("allows the canonical happy path", () => {
    expect(isValidSettlementTransition(SettlementStatus.REQUESTED, SettlementStatus.APPROVED)).toBe(true);
    expect(isValidSettlementTransition(SettlementStatus.APPROVED, SettlementStatus.EXECUTING)).toBe(true);
    expect(isValidSettlementTransition(SettlementStatus.EXECUTING, SettlementStatus.SETTLED)).toBe(true);
    expect(isValidSettlementTransition(SettlementStatus.SETTLED, SettlementStatus.RECONCILED)).toBe(true);
  });

  it("allows failure only from APPROVED or EXECUTING", () => {
    expect(isValidSettlementTransition(SettlementStatus.APPROVED, SettlementStatus.FAILED)).toBe(true);
    expect(isValidSettlementTransition(SettlementStatus.EXECUTING, SettlementStatus.FAILED)).toBe(true);
    expect(isValidSettlementTransition(SettlementStatus.REQUESTED, SettlementStatus.FAILED)).toBe(false);
    expect(isValidSettlementTransition(SettlementStatus.SETTLED, SettlementStatus.FAILED)).toBe(false);
  });

  it("never allows skipping straight to SETTLED or RECONCILED", () => {
    expect(isValidSettlementTransition(SettlementStatus.REQUESTED, SettlementStatus.SETTLED)).toBe(false);
    expect(isValidSettlementTransition(SettlementStatus.APPROVED, SettlementStatus.SETTLED)).toBe(false);
    expect(isValidSettlementTransition(SettlementStatus.REQUESTED, SettlementStatus.RECONCILED)).toBe(false);
    expect(isValidSettlementTransition(SettlementStatus.EXECUTING, SettlementStatus.RECONCILED)).toBe(false);
  });

  it("RECONCILED is reachable only from SETTLED", () => {
    for (const from of Object.values(SettlementStatus)) {
      const allowed = isValidSettlementTransition(from, SettlementStatus.RECONCILED);
      expect(allowed).toBe(from === SettlementStatus.SETTLED);
    }
  });

  it("terminal states have no outgoing transitions", () => {
    for (const terminal of [
      SettlementStatus.RECONCILED,
      SettlementStatus.FAILED,
      SettlementStatus.CANCELLED,
      SettlementStatus.ON_HOLD,
    ]) {
      expect(SETTLEMENT_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it("rejects self-transitions", () => {
    for (const status of Object.values(SettlementStatus)) {
      expect(isValidSettlementTransition(status, status)).toBe(false);
    }
  });

  it("assertValidSettlementTransition throws a user-facing message on invalid moves", () => {
    expect(() =>
      assertValidSettlementTransition(SettlementStatus.REQUESTED, SettlementStatus.SETTLED),
    ).toThrowError(/Cannot move settlement from REQUESTED to SETTLED/);
    expect(() =>
      assertValidSettlementTransition(SettlementStatus.SETTLED, SettlementStatus.RECONCILED),
    ).not.toThrow();
  });
});
