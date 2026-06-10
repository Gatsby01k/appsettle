import { describe, expect, it } from "vitest";
import {
  assessFinality,
  isCompletedProviderStatus,
  isFailedProviderStatus,
  settlementExpectedAmount,
  type FinalityInput,
} from "../finality";

const settlement = {
  publicId: "SET-TEST1",
  status: "SETTLED",
  sourceCurrency: "INR",
  targetCurrency: "USDT",
  sourceAmount: 500000,
  targetAmount: 5961.5,
};

const completedProof = {
  provider: "remitquickly",
  providerStatus: "success",
  providerTransactionId: "12345",
  utr: "UTR2026061100001",
  actualAmount: 500000,
  currency: "INR",
  receivedVia: "WEBHOOK",
};

const matchedReconciliation = {
  status: "MATCHED",
  externalRef: "UTR2026061100001",
  source: "bank_statement",
  amount: 500000,
  currency: "INR",
};

function input(overrides: Partial<FinalityInput> = {}): FinalityInput {
  return {
    settlement,
    proof: completedProof,
    reconciliation: matchedReconciliation,
    auditApprovalPresent: true,
    ...overrides,
  };
}

describe("provider status gate", () => {
  it("is not_ready (high risk) when no provider proof exists", () => {
    const result = assessFinality(input({ proof: null }));
    expect(result.decision).toBe("not_ready");
    expect(result.riskLevel).toBe("high");
    expect(result.confidence).toBe(0);
    expect(result.blockingIssues.join(" ")).toMatch(/No provider proof/);
  });

  it("is not_ready when the provider status is still in flight", () => {
    const result = assessFinality(
      input({ proof: { ...completedProof, providerStatus: "processing" } }),
    );
    expect(result.decision).toBe("not_ready");
    expect(result.blockingIssues.join(" ")).toMatch(/not completed/);
  });

  it("is not_ready (high risk) when the provider reports failure", () => {
    const result = assessFinality(input({ proof: { ...completedProof, providerStatus: "failed" } }));
    expect(result.decision).toBe("not_ready");
    expect(result.riskLevel).toBe("high");
  });

  it('provider "completed" alone is NEVER enough to finalize', () => {
    const result = assessFinality(
      input({ reconciliation: null, auditApprovalPresent: false }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.decision).not.toBe("ready_to_finalize");
  });
});

describe("needs_review rules", () => {
  it("missing reconciliation -> needs_review, at least medium risk", () => {
    const result = assessFinality(input({ reconciliation: null }));
    expect(result.decision).toBe("needs_review");
    expect(["medium", "high"]).toContain(result.riskLevel);
    expect(result.blockingIssues.join(" ")).toMatch(/No reconciliation record/);
  });

  it("unmatched/exception reconciliation -> needs_review, high risk", () => {
    for (const status of ["UNMATCHED", "EXCEPTION"]) {
      const result = assessFinality(
        input({ reconciliation: { ...matchedReconciliation, status } }),
      );
      expect(result.decision).toBe("needs_review");
      expect(result.riskLevel).toBe("high");
    }
  });

  it("provider-reported amount mismatch -> needs_review, high risk", () => {
    const result = assessFinality(
      input({ proof: { ...completedProof, actualAmount: 499000 } }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.riskLevel).toBe("high");
    expect(result.blockingIssues.join(" ")).toMatch(/Amount mismatch/);
  });

  it("reconciliation amount mismatch -> needs_review, high risk", () => {
    const result = assessFinality(
      input({ reconciliation: { ...matchedReconciliation, amount: 499000 } }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.riskLevel).toBe("high");
  });

  it("missing audit approval -> needs_review, high risk", () => {
    const result = assessFinality(input({ auditApprovalPresent: false }));
    expect(result.decision).toBe("needs_review");
    expect(result.riskLevel).toBe("high");
    expect(result.blockingIssues.join(" ")).toMatch(/No approval/);
  });
});

describe("ready_to_finalize", () => {
  it("requires proof + reconciliation + audit to agree", () => {
    const result = assessFinality(input());
    expect(result.decision).toBe("ready_to_finalize");
    expect(result.riskLevel).toBe("low");
    expect(result.confidence).toBe(100);
    expect(result.blockingIssues).toEqual([]);
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it("still finalizes without a provider-reported amount, but warns and lowers confidence", () => {
    const result = assessFinality(
      input({ proof: { ...completedProof, actualAmount: null, currency: null } }),
    );
    expect(result.decision).toBe("ready_to_finalize");
    expect(result.confidence).toBeLessThan(100);
    expect(result.warnings.join(" ")).toMatch(/does not include a payout amount/);
  });

  it("tolerates sub-paisa rounding differences", () => {
    const result = assessFinality(
      input({ reconciliation: { ...matchedReconciliation, amount: 500000.005 } }),
    );
    expect(result.decision).toBe("ready_to_finalize");
  });
});

describe("determinism", () => {
  it("identical input always produces identical output", () => {
    const a = assessFinality(input());
    const b = assessFinality(input());
    expect(a).toEqual(b);
  });
});

describe("status helpers", () => {
  it("classifies completed and failed provider statuses case-insensitively", () => {
    expect(isCompletedProviderStatus("Completed")).toBe(true);
    expect(isCompletedProviderStatus("SUCCESS")).toBe(true);
    expect(isCompletedProviderStatus("processing")).toBe(false);
    expect(isCompletedProviderStatus(null)).toBe(false);
    expect(isFailedProviderStatus("REVERSED")).toBe(true);
    expect(isFailedProviderStatus("pending")).toBe(false);
  });
});

describe("settlementExpectedAmount", () => {
  it("resolves the expected leg by currency", () => {
    expect(settlementExpectedAmount(settlement, "INR")).toBe(500000);
    expect(settlementExpectedAmount(settlement, "USDT")).toBe(5961.5);
    expect(settlementExpectedAmount(settlement, "EUR")).toBeNull();
    expect(settlementExpectedAmount(settlement, null)).toBeNull();
  });
});
