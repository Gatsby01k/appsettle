import { describe, expect, it } from "vitest";
import {
  classifyPontisStatus,
  classifyRemitQuicklyStatus,
  pontisIdempotencyKeyFor,
  proofFingerprint,
} from "../providers/outcome";

describe("outcome classification (uncertainty never fails a settlement)", () => {
  it("explicit success statuses classify as success", () => {
    expect(classifyPontisStatus("completed")).toBe("success");
    expect(classifyPontisStatus("Settled")).toBe("success");
    expect(classifyRemitQuicklyStatus("processed")).toBe("success");
    expect(classifyRemitQuicklyStatus("payout successful")).toBe("success");
  });

  it("explicit failures classify as failed", () => {
    expect(classifyPontisStatus("failed")).toBe("failed");
    expect(classifyPontisStatus("REJECTED")).toBe("failed");
    expect(classifyRemitQuicklyStatus("payout failed")).toBe("failed");
  });

  it("reversals are their OWN outcome — never an automatic failure", () => {
    expect(classifyPontisStatus("reversed")).toBe("reversed");
    expect(classifyPontisStatus("refunded")).toBe("reversed");
    expect(classifyRemitQuicklyStatus("transaction reversed by bank")).toBe("reversed");
    expect(classifyPontisStatus("reversed")).not.toBe("failed");
  });

  it("unknown statuses are PENDING, never failed (uncertain money is not failed money)", () => {
    expect(classifyPontisStatus("some_new_status")).toBe("pending");
    expect(classifyPontisStatus("")).toBe("pending");
    expect(classifyPontisStatus(null)).toBe("pending");
    expect(classifyPontisStatus(undefined)).toBe("pending");
    expect(classifyRemitQuicklyStatus("weird-bank-code-77")).toBe("pending");
  });
});

describe("stable idempotency key", () => {
  it("is deterministic per settlement — retries reuse the SAME key", () => {
    const a = pontisIdempotencyKeyFor("SET-9F2A");
    const b = pontisIdempotencyKeyFor("SET-9F2A");
    expect(a).toBe(b);
    expect(a).toContain("SET-9F2A");
  });

  it("differs across settlements", () => {
    expect(pontisIdempotencyKeyFor("SET-A")).not.toBe(pontisIdempotencyKeyFor("SET-B"));
  });
});

describe("proof fingerprint (webhook/poll de-duplication)", () => {
  const base = {
    settlementId: "s1",
    provider: "remitquickly",
    providerTransactionId: "88004",
    providerStatus: "success",
    receivedVia: "WEBHOOK",
  };

  it("a re-delivered webhook produces the same fingerprint (no duplicate proof)", () => {
    expect(proofFingerprint(base)).toBe(proofFingerprint({ ...base }));
    expect(proofFingerprint(base)).toBe(proofFingerprint({ ...base, providerStatus: "SUCCESS" }));
    expect(proofFingerprint({ ...base, providerTransactionId: " 88004 " })).toBe(proofFingerprint(base));
  });

  it("a CHANGED status is new evidence (different fingerprint)", () => {
    expect(proofFingerprint(base)).not.toBe(proofFingerprint({ ...base, providerStatus: "reversed" }));
  });

  it("different channels and transactions are distinct evidence", () => {
    expect(proofFingerprint(base)).not.toBe(proofFingerprint({ ...base, receivedVia: "POLL" }));
    expect(proofFingerprint(base)).not.toBe(proofFingerprint({ ...base, providerTransactionId: "99001" }));
    expect(proofFingerprint(base)).not.toBe(proofFingerprint({ ...base, settlementId: "s2" }));
  });
});
