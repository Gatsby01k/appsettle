import { describe, expect, it } from "vitest";
import { assessFinality } from "../finality";
import {
  buildFinalityInput,
  hasAuditApproval,
  latestProofOf,
  relevantReconciliationOf,
} from "../finality-input";

const settlement = {
  publicId: "SET-CASE1",
  status: "SETTLED",
  sourceCurrency: "INR",
  targetCurrency: "USDT",
  sourceAmount: "500000",
  targetAmount: "5961.5",
  approvedAt: new Date("2026-06-11T09:00:00Z"),
};

const approvedEvents = [{ toStatus: "APPROVED" }, { toStatus: "EXECUTING" }, { toStatus: "SETTLED" }];

const olderProof = {
  provider: "remitquickly",
  providerStatus: "processing",
  providerTransactionId: "111",
  receivedVia: "POLL",
  receivedAt: new Date("2026-06-11T10:00:00Z"),
};

const newerProof = {
  provider: "remitquickly",
  providerStatus: "success",
  providerTransactionId: "111",
  utr: "UTR-1",
  actualAmount: "500000",
  currency: "INR",
  receivedVia: "WEBHOOK",
  receivedAt: new Date("2026-06-11T10:05:00Z"),
};

const matchedRecord = {
  status: "MATCHED",
  externalRef: "UTR-1",
  source: "bank_statement",
  amount: "500000",
  currency: "INR",
};

describe("latestProofOf", () => {
  it("returns null for no proofs and the newest proof otherwise, regardless of order", () => {
    expect(latestProofOf([])).toBeNull();
    expect(latestProofOf([olderProof, newerProof])?.providerStatus).toBe("success");
    expect(latestProofOf([newerProof, olderProof])?.providerStatus).toBe("success");
  });
});

describe("relevantReconciliationOf", () => {
  it("prefers a MATCHED record over earlier non-matched ones", () => {
    const unmatched = { ...matchedRecord, status: "UNMATCHED", externalRef: "X-1" };
    expect(relevantReconciliationOf([unmatched, matchedRecord])?.status).toBe("MATCHED");
  });

  it("surfaces a contradicting record instead of hiding it when nothing matched", () => {
    const exception = { ...matchedRecord, status: "EXCEPTION", externalRef: "X-2" };
    expect(relevantReconciliationOf([exception])?.status).toBe("EXCEPTION");
    expect(relevantReconciliationOf([])).toBeNull();
  });
});

describe("hasAuditApproval", () => {
  it("requires BOTH the approval timestamp and the APPROVED lifecycle event", () => {
    expect(hasAuditApproval(settlement, approvedEvents)).toBe(true);
    expect(hasAuditApproval({ ...settlement, approvedAt: null }, approvedEvents)).toBe(false);
    expect(hasAuditApproval(settlement, [{ toStatus: "EXECUTING" }])).toBe(false);
  });
});

describe("buildFinalityInput", () => {
  it("coerces decimal strings to numbers and uses the latest proof", () => {
    const input = buildFinalityInput(settlement, [olderProof, newerProof], [matchedRecord], approvedEvents);
    expect(input.settlement.sourceAmount).toBe(500000);
    expect(input.proof?.providerStatus).toBe("success");
    expect(input.proof?.actualAmount).toBe(500000);
    expect(input.reconciliation?.amount).toBe(500000);
    expect(input.auditApprovalPresent).toBe(true);
  });

  it("produces ready_to_finalize end-to-end when all evidence agrees", () => {
    const input = buildFinalityInput(settlement, [olderProof, newerProof], [matchedRecord], approvedEvents);
    const result = assessFinality(input);
    expect(result.decision).toBe("ready_to_finalize");
    expect(result.confidence).toBe(100);
  });

  it("judges by the LATEST proof: a stale success followed by a newer failure blocks finality", () => {
    const failureAfterSuccess = {
      ...newerProof,
      providerStatus: "failed",
      receivedAt: new Date("2026-06-11T10:10:00Z"),
    };
    const input = buildFinalityInput(
      settlement,
      [newerProof, failureAfterSuccess],
      [matchedRecord],
      approvedEvents,
    );
    const result = assessFinality(input);
    expect(result.decision).toBe("not_ready");
  });

  it("maps missing evidence to nulls so finality reports the right gaps", () => {
    const input = buildFinalityInput(settlement, [], [], []);
    expect(input.proof).toBeNull();
    expect(input.reconciliation).toBeNull();
    expect(input.auditApprovalPresent).toBe(false);
    expect(assessFinality(input).decision).toBe("not_ready");
  });
});
