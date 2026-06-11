import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Provider boundary safety: webhook signatures, gateway secret, and payout
// resolution idempotency. Server modules are importable here because vitest
// aliases the `server-only` marker to a stub (see vitest.config.ts) —
// production behavior is unchanged.

// ---------------------------------------------------------------------------
// Mocks for DB-coupled collaborators (resolution tests only). Declared before
// importing the provider settlement module.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  prisma: { settlement: { findFirst: vi.fn(), update: vi.fn() } },
  writeAuditLog: vi.fn(async () => ({})),
  recordProviderProof: vi.fn(async () => ({ id: "proof-1" })),
  transitionSettlement: vi.fn(async () => ({})),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/provider-proof", () => ({ recordProviderProof: mocks.recordProviderProof }));
vi.mock("@/lib/domain", () => ({ transitionSettlement: mocks.transitionSettlement }));

const prismaMock = mocks.prisma;
const writeAuditLogMock = mocks.writeAuditLog;
const recordProviderProofMock = mocks.recordProviderProof;
const transitionSettlementMock = mocks.transitionSettlement;

import { verifyWebhookSignature as verifyPontisSignature } from "../providers/pontis/client";
import { verifyGatewaySecret } from "../providers/pontis/gateway";
import {
  decodeWebhookPayload,
  verifyWebhookSignature as verifyRemitQuicklySignature,
} from "../providers/remitquickly/client";
import { applyPayoutResolution, mapPontisStatus } from "../providers/pontis/settlement";

// ---------------------------------------------------------------------------
// Test credentials (fake, test-only — never real secrets).
// ---------------------------------------------------------------------------
const HMAC_KEY = Buffer.from("test-hmac-key-32-bytes-padding!!", "utf8");
const PONTIS_ENV = {
  PONTIS_BASE_URL: "https://sandbox.example.test",
  PONTIS_API_KEY: "test-api-key",
  PONTIS_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString("base64url"),
  PONTIS_HMAC_SECRET: HMAC_KEY.toString("base64url"),
  PONTIS_EMAIL: "test@example.test",
  PONTIS_PASSWORD: "test-password",
};

const RQ_SECRET = "test-remitquickly-webhook-secret";
const RQ_ENV = {
  REMITQUICKLY_BASE_URL: "https://sandbox.example.test",
  REMITQUICKLY_API_KEY: "test-key",
  REMITQUICKLY_API_SECRET: "test-api-secret",
  REMITQUICKLY_WEBHOOK_SECRET: RQ_SECRET,
};

const GATEWAY_SECRET = "test-gateway-shared-secret";

const ENV_KEYS = [...Object.keys(PONTIS_ENV), ...Object.keys(RQ_ENV), "PONTIS_GATEWAY_SECRET"];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  Object.assign(process.env, PONTIS_ENV, RQ_ENV, { PONTIS_GATEWAY_SECRET: GATEWAY_SECRET });
  prismaMock.settlement.findFirst.mockReset();
  prismaMock.settlement.update.mockReset().mockResolvedValue({});
  writeAuditLogMock.mockClear();
  recordProviderProofMock.mockClear();
  transitionSettlementMock.mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function pontisSign(timestamp: string, rawBody: string): string {
  return "sha256=" + crypto.createHmac("sha256", HMAC_KEY).update(`${timestamp}.${rawBody}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Pontis webhook signature
// ---------------------------------------------------------------------------
describe("Pontis webhook signature verification", () => {
  const body = JSON.stringify({ transaction_id: "tx-1", status: "completed" });

  it("accepts a valid signature within the timestamp window", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyPontisSignature(ts, pontisSign(ts, body), body)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = pontisSign(ts, body);
    expect(verifyPontisSignature(ts, sig, body.replace("completed", "failed"))).toBe(false);
  });

  it("rejects a wrong signature and a missing sha256= prefix", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyPontisSignature(ts, "sha256=" + "0".repeat(64), body)).toBe(false);
    expect(verifyPontisSignature(ts, pontisSign(ts, body).slice("sha256=".length), body)).toBe(false);
  });

  it("rejects stale and far-future timestamps (replay window)", () => {
    const stale = String(Math.floor(Date.now() / 1000) - 301);
    expect(verifyPontisSignature(stale, pontisSign(stale, body), body)).toBe(false);
    const future = String(Math.floor(Date.now() / 1000) + 301);
    expect(verifyPontisSignature(future, pontisSign(future, body), body)).toBe(false);
  });

  it("rejects missing headers and unconfigured provider", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyPontisSignature("", pontisSign(ts, body), body)).toBe(false);
    expect(verifyPontisSignature(ts, "", body)).toBe(false);
    delete process.env.PONTIS_HMAC_SECRET;
    expect(verifyPontisSignature(ts, pontisSign(ts, body), body)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RemitQuickly webhook signature
// ---------------------------------------------------------------------------
describe("RemitQuickly webhook signature verification", () => {
  const payload = Buffer.from(JSON.stringify({ payout_id: 7, status: "success" })).toString("base64");
  const sign = (data: string, secret = RQ_SECRET) =>
    crypto.createHmac("sha512", secret).update(data).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifyRemitQuicklySignature(payload, sign(payload))).toBe(true);
  });

  it("rejects tampered payloads, wrong secrets, and missing headers", () => {
    expect(verifyRemitQuicklySignature(payload + "x", sign(payload))).toBe(false);
    expect(verifyRemitQuicklySignature(payload, sign(payload, "wrong-secret"))).toBe(false);
    expect(verifyRemitQuicklySignature("", sign(payload))).toBe(false);
    expect(verifyRemitQuicklySignature(payload, "")).toBe(false);
  });

  it("decodes flat and { body } wrapped payloads", () => {
    expect(decodeWebhookPayload(payload)).toEqual({ payout_id: 7, status: "success" });
    const wrapped = Buffer.from(JSON.stringify({ body: { payout_id: 8 }, timestamp: 1 })).toString("base64");
    expect(decodeWebhookPayload(wrapped)).toEqual({ payout_id: 8 });
  });
});

// ---------------------------------------------------------------------------
// Gateway shared secret
// ---------------------------------------------------------------------------
describe("Pontis VPS gateway secret verification", () => {
  it("accepts only the exact configured secret", () => {
    expect(verifyGatewaySecret(GATEWAY_SECRET)).toBe(true);
    expect(verifyGatewaySecret("wrong")).toBe(false);
    expect(verifyGatewaySecret(GATEWAY_SECRET + "x")).toBe(false);
    expect(verifyGatewaySecret("")).toBe(false);
    expect(verifyGatewaySecret(null)).toBe(false);
  });

  it("rejects everything when the secret is not configured", () => {
    delete process.env.PONTIS_GATEWAY_SECRET;
    expect(verifyGatewaySecret(GATEWAY_SECRET)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Payout resolution idempotency (DB collaborators mocked)
// ---------------------------------------------------------------------------
describe("Pontis payout resolution idempotency", () => {
  const baseSettlement = {
    id: "set-1",
    publicId: "SET-1",
    organizationId: "org-1",
    createdById: "user-1",
    status: "EXECUTING",
    sourceCurrency: "USDT",
    targetCurrency: "INR",
    sourceAmount: "10",
    targetAmount: "850",
  } as never;

  const input = (overrides: Record<string, unknown>) =>
    ({
      settlement: baseSettlement,
      userId: "user-1",
      organizationId: "org-1",
      transactionId: "tx-1",
      ...overrides,
    }) as never;

  it("success from EXECUTING records proof BEFORE transitioning to SETTLED", async () => {
    prismaMock.settlement.findFirst.mockResolvedValue({ ...(baseSettlement as object), status: "EXECUTING" });
    const result = await applyPayoutResolution(input({ outcome: "success", providerStatus: "completed" }));
    expect(recordProviderProofMock).toHaveBeenCalledTimes(1);
    expect(transitionSettlementMock).toHaveBeenCalledWith("set-1", "SETTLED", "user-1", "org-1", expect.any(String));
    expect(recordProviderProofMock.mock.invocationCallOrder[0]).toBeLessThan(
      transitionSettlementMock.mock.invocationCallOrder[0],
    );
    expect(result).toMatchObject({ settlementId: "set-1", status: "SETTLED" });
  });

  it("duplicate success delivery is a no-op (no proof, no transition, no audit)", async () => {
    prismaMock.settlement.findFirst.mockResolvedValue({ ...(baseSettlement as object), status: "SETTLED" });
    const result = await applyPayoutResolution(input({ outcome: "success", providerStatus: "completed" }));
    expect(result).toMatchObject({ skipped: true });
    expect(recordProviderProofMock).not.toHaveBeenCalled();
    expect(transitionSettlementMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("failed from EXECUTING records proof, sets a failure reason and transitions to FAILED", async () => {
    prismaMock.settlement.findFirst.mockResolvedValue({ ...(baseSettlement as object), status: "EXECUTING" });
    const result = await applyPayoutResolution(
      input({ outcome: "failed", providerStatus: "failed", statusMessage: "Beneficiary account invalid" }),
    );
    expect(recordProviderProofMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.settlement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failureReason: "Beneficiary account invalid" } }),
    );
    expect(transitionSettlementMock).toHaveBeenCalledWith("set-1", "FAILED", "user-1", "org-1", expect.any(String));
    expect(result).toMatchObject({ status: "FAILED" });
  });

  it("duplicate failed delivery is a no-op", async () => {
    prismaMock.settlement.findFirst.mockResolvedValue({ ...(baseSettlement as object), status: "FAILED" });
    const result = await applyPayoutResolution(input({ outcome: "failed", providerStatus: "failed" }));
    expect(result).toMatchObject({ skipped: true });
    expect(recordProviderProofMock).not.toHaveBeenCalled();
    expect(transitionSettlementMock).not.toHaveBeenCalled();
  });

  it("reversed requires review: proof + audit recorded, lifecycle NOT auto-failed", async () => {
    prismaMock.settlement.findFirst.mockResolvedValue({ ...(baseSettlement as object), status: "EXECUTING" });
    const result = await applyPayoutResolution(input({ outcome: "reversed", providerStatus: "reversed" }));
    expect(recordProviderProofMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pontis.payout.reversed_review_required" }),
    );
    expect(transitionSettlementMock).not.toHaveBeenCalled();
    expect(prismaMock.settlement.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ reviewRequired: true, status: "EXECUTING" });
  });

  it("unknown provider statuses classify as pending — resolution is never invoked as failed", () => {
    expect(mapPontisStatus("weird_new_status")).toBe("pending");
    expect(mapPontisStatus(undefined)).toBe("pending");
    expect(mapPontisStatus("reversed")).toBe("reversed");
    expect(mapPontisStatus("completed")).toBe("success");
  });
});
