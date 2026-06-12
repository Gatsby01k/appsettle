import { describe, expect, it } from "vitest";
import { reconciliationPendingActions } from "../settlement-actions";

// Regression guard for the Settlements "Awaiting independent reconciliation"
// panel: exactly one action area, no duplicate auto-match, and no unavailable
// (ghost/disabled) actions ever in the list.

describe("reconciliation-pending action list", () => {
  it("always offers Open reconciliation as the primary action", () => {
    const actions = reconciliationPendingActions({
      canReconcile: false,
      autoMatchAvailable: false,
      hasOpenRecords: false,
    });
    expect(actions).toEqual(["open_reconciliation"]);
  });

  it("offers Run auto-match only when a real independent candidate exists", () => {
    expect(
      reconciliationPendingActions({ canReconcile: true, autoMatchAvailable: true, hasOpenRecords: true }),
    ).toEqual(["open_reconciliation", "run_auto_match"]);
  });

  it("hides Run auto-match when there is no open independent record", () => {
    expect(
      reconciliationPendingActions({ canReconcile: true, autoMatchAvailable: true, hasOpenRecords: false }),
    ).toEqual(["open_reconciliation"]);
  });

  it("hides Run auto-match for read-only roles or when no action is wired", () => {
    expect(
      reconciliationPendingActions({ canReconcile: false, autoMatchAvailable: true, hasOpenRecords: true }),
    ).toEqual(["open_reconciliation"]);
    expect(
      reconciliationPendingActions({ canReconcile: true, autoMatchAvailable: false, hasOpenRecords: true }),
    ).toEqual(["open_reconciliation"]);
  });

  it("never contains duplicates", () => {
    for (const canReconcile of [true, false]) {
      for (const autoMatchAvailable of [true, false]) {
        for (const hasOpenRecords of [true, false]) {
          const actions = reconciliationPendingActions({ canReconcile, autoMatchAvailable, hasOpenRecords });
          expect(new Set(actions).size).toBe(actions.length);
          expect(actions.filter((a) => a === "run_auto_match").length).toBeLessThanOrEqual(1);
          expect(actions[0]).toBe("open_reconciliation");
        }
      }
    }
  });
});
