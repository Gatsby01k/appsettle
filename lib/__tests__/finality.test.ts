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

describe("independent reconciliation requirement", () => {
  it("a MATCHED provider_claim record -> needs_review, never ready_to_finalize", () => {
    const result = assessFinality(
      input({ reconciliation: { ...matchedReconciliation, source: "provider_claim" } }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.decision).not.toBe("ready_to_finalize");
    expect(["medium", "high"]).toContain(result.riskLevel);
    expect(result.blockingIssues.join(" ")).toMatch(/provider claims do not count/i);
    expect(result.recommendedActions.join(" ")).toMatch(/independent evidence/i);
  });

  it("provider proof + provider_claim reconciliation + audit approval is still not enough", () => {
    // The provider agreeing with itself twice must never finalize a settlement.
    const result = assessFinality(
      input({ reconciliation: { ...matchedReconciliation, source: "provider_claim" }, auditApprovalPresent: true }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.confidence).toBeLessThan(100);
  });

  it("each independent source can satisfy finality", () => {
    for (const source of ["bank_statement", "psp_report", "manual_operator", "manual", "chain_tx"]) {
      const result = assessFinality(input({ reconciliation: { ...matchedReconciliation, source } }));
      expect(result.decision).toBe("ready_to_finalize");
    }
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

describe("shadow / live-test mode", () => {
  const safeShadow = { withinCap: true, capLabel: "INR 10,000", livePayoutsDisabled: true };

  it("SHADOW without proof -> not_ready", () => {
    const result = assessFinality(input({ proof: null, testMode: "SHADOW", safety: safeShadow }));
    expect(result.decision).toBe("not_ready");
    expect(result.evidence.join(" ")).toMatch(/did not move funds directly/);
  });

  it("SHADOW without independent reconciliation -> needs_review", () => {
    const result = assessFinality(input({ reconciliation: null, testMode: "SHADOW", safety: safeShadow }));
    expect(result.decision).toBe("needs_review");
  });

  it("SHADOW with proof + independent reconciliation + audit -> ready_to_finalize", () => {
    const result = assessFinality(input({ testMode: "SHADOW", safety: safeShadow }));
    expect(result.decision).toBe("ready_to_finalize");
    expect(result.riskLevel).toBe("low");
    expect(result.evidence.join(" ")).toMatch(/INRSettle did not move funds directly/);
  });

  it("provider completed alone never finalizes a SHADOW settlement", () => {
    const result = assessFinality(
      input({ testMode: "SHADOW", safety: safeShadow, reconciliation: null, auditApprovalPresent: false }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.decision).not.toBe("ready_to_finalize");
  });

  it("a cap violation blocks ready_to_finalize even with perfect evidence (no bypass)", () => {
    const result = assessFinality(
      input({ testMode: "LIVE_TEST", safety: { ...safeShadow, withinCap: false, capLabel: "INR 1,000" } }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.riskLevel).toBe("high");
    expect(result.blockingIssues.join(" ")).toMatch(/safety cap/);
  });

  it("live payouts enabled blocks ready_to_finalize (tripwire)", () => {
    const result = assessFinality(
      input({ testMode: "SHADOW", safety: { ...safeShadow, livePayoutsDisabled: false } }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.riskLevel).toBe("high");
    expect(result.blockingIssues.join(" ")).toMatch(/LIVE_PAYOUTS_ENABLED/);
  });

  it("LIVE_TEST over the DAILY cap blocks ready_to_finalize even with perfect evidence", () => {
    const result = assessFinality(
      input({
        testMode: "LIVE_TEST",
        safety: { ...safeShadow, withinDailyCap: false, dailyCapLabel: "INR 2,000" },
      }),
    );
    expect(result.decision).toBe("needs_review");
    expect(result.riskLevel).toBe("high");
    expect(result.blockingIssues.join(" ")).toMatch(/daily pilot cap/);
  });

  it("uncertain provider outcome (reversed) is never treated as safe to finalize", () => {
    const result = assessFinality(
      input({ testMode: "LIVE_TEST", safety: safeShadow, proof: { ...completedProof, providerStatus: "reversed" } }),
    );
    expect(result.decision).toBe("not_ready");
    expect(result.decision).not.toBe("ready_to_finalize");
  });

  it("missing safety evaluation blocks a SHADOW settlement", () => {
    const result = assessFinality(input({ testMode: "SHADOW", safety: null }));
    expect(result.decision).toBe("needs_review");
    expect(result.blockingIssues.join(" ")).toMatch(/Safety status was not evaluated/);
  });

  it("DEMO mode is unaffected by safety inputs", () => {
    const result = assessFinality(input({ testMode: "DEMO" }));
    expect(result.decision).toBe("ready_to_finalize");
    expect(result.confidence).toBe(100);
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
