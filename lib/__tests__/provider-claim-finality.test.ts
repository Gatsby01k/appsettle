import { describe, expect, it } from "vitest";
import { assessFinality } from "../finality";
import { buildFinalityInput } from "../finality-input";
import { isIndependentReconciliationSource } from "../reconciliation";

// Provider boundary invariant: a provider saying "completed" is a CLAIM,
// not a settlement. Finality must never become ready from provider-side
// evidence alone — an independent bank/PSP record is required.

const settlement = {
  publicId: "SET-CLAIM-1",
  status: "SETTLED",
  sourceCurrency: "USDT",
  targetCurrency: "INR",
  sourceAmount: "100",
  targetAmount: "8350",
  approvedAt: new Date("2026-06-12T09:00:00Z"),
};

const approvedEvents = [{ toStatus: "APPROVED" }, { toStatus: "EXECUTING" }, { toStatus: "SETTLED" }];

const successProof = {
  provider: "PontisGlobe",
  providerStatus: "completed",
  providerTransactionId: "tx-claim-1",
  actualAmount: "8350",
  currency: "INR",
  receivedVia: "WEBHOOK",
  receivedAt: new Date("2026-06-12T10:00:00Z"),
};

const bankRecord = {
  status: "MATCHED",
  externalRef: "UTR-CLAIM-1",
  source: "bank_statement",
  amount: "8350",
  currency: "INR",
};

const providerClaimRecord = { ...bankRecord, source: "provider_claim", externalRef: "PC-CLAIM-1" };

describe("provider completed ≠ independent reconciliation", () => {
  it("provider_claim is not an independent reconciliation source", () => {
    expect(isIndependentReconciliationSource("provider_claim")).toBe(false);
    expect(isIndependentReconciliationSource("bank_statement")).toBe(true);
    expect(isIndependentReconciliationSource("psp_report")).toBe(true);
  });

  it("a successful provider proof with NO reconciliation never reaches ready_to_finalize", () => {
    const input = buildFinalityInput(settlement, [successProof], [], approvedEvents);
    const result = assessFinality(input);
    expect(result.decision).not.toBe("ready_to_finalize");
  });

  it("finality does not become ready from a provider claim alone (even MATCHED + amount-agreeing)", () => {
    const input = buildFinalityInput(settlement, [successProof], [providerClaimRecord], approvedEvents);
    expect(input.reconciliation?.source).toBe("provider_claim");
    const result = assessFinality(input);
    expect(result.decision).not.toBe("ready_to_finalize");
    expect(result.confidence).toBeLessThan(100);
  });

  it("control: the SAME evidence with an independent bank record IS ready_to_finalize", () => {
    const input = buildFinalityInput(settlement, [successProof], [bankRecord], approvedEvents);
    const result = assessFinality(input);
    expect(result.decision).toBe("ready_to_finalize");
  });

  it("provider claim + bank record: the independent record is what finality judges by", () => {
    const input = buildFinalityInput(settlement, [successProof], [providerClaimRecord, bankRecord], approvedEvents);
    expect(input.reconciliation?.source).toBe("bank_statement");
    expect(assessFinality(input).decision).toBe("ready_to_finalize");
  });
});
