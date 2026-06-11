import { describe, expect, it } from "vitest";
import {
  classifyPontisStatus,
  classifyRemitQuicklyStatus,
  deterministicUuid,
  pontisIdempotencyKeyFor,
  proofFingerprint,
} from "../providers/outcome";

/** RFC 4122 v5 UUID: version nibble = 5, variant nibble = 8/9/a/b. */
const UUID_V5_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

describe("stable idempotency key (valid UUID)", () => {
  it("generates a VALID RFC 4122 UUID (provider requires UUID format)", () => {
    expect(pontisIdempotencyKeyFor("SET-9F2A")).toMatch(UUID_V5_PATTERN);
    expect(pontisIdempotencyKeyFor("SET-9F2A", "status")).toMatch(UUID_V5_PATTERN);
  });

  it("is deterministic per settlement/action — retries reuse the SAME UUID", () => {
    expect(pontisIdempotencyKeyFor("SET-9F2A")).toBe(pontisIdempotencyKeyFor("SET-9F2A"));
    expect(pontisIdempotencyKeyFor("SET-9F2A", "payout")).toBe(pontisIdempotencyKeyFor("SET-9F2A", "payout"));
  });

  it("differs across settlements and across actions", () => {
    expect(pontisIdempotencyKeyFor("SET-A")).not.toBe(pontisIdempotencyKeyFor("SET-B"));
    expect(pontisIdempotencyKeyFor("SET-A", "payout")).not.toBe(pontisIdempotencyKeyFor("SET-A", "refund"));
  });

  it("deterministicUuid is name-based and namespace-validated", () => {
    expect(deterministicUuid("x")).toBe(deterministicUuid("x"));
    expect(deterministicUuid("x")).not.toBe(deterministicUuid("y"));
    expect(deterministicUuid("x")).toMatch(UUID_V5_PATTERN);
    expect(() => deterministicUuid("x", "not-a-uuid")).toThrow(/valid UUID/);
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
