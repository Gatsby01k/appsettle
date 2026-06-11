import crypto from "node:crypto";

// Pure provider-outcome classification + idempotency helpers (no framework /
// server-only coupling, so both provider modules and unit tests share them).
//
// Live-pilot safety principle: when the real movement of money is UNCERTAIN,
// never mark the settlement FAILED. Only an explicit, unambiguous provider
// failure may fail a settlement; reversals and unknown statuses are surfaced
// for operator review instead.

/**
 * Classified provider outcome:
 *  - success:  provider explicitly reports the payout completed
 *  - failed:   provider explicitly reports the payout failed/rejected/cancelled
 *              BEFORE money moved (safe to mark FAILED)
 *  - reversed: provider reports a reversal — money may have moved and come
 *              back; requires operator review, never an automatic FAILED
 *  - pending:  in flight, or any UNKNOWN status (fail-safe: unknown is treated
 *              as pending, not as failed)
 */
export type ProviderOutcome = "success" | "failed" | "reversed" | "pending";

const SUCCESS_STATUSES = new Set(["completed", "success", "successful", "settled", "processed"]);
const FAILED_STATUSES = new Set(["failed", "failure", "rejected", "canceled", "cancelled", "declined"]);
const REVERSED_STATUSES = new Set(["reversed", "reversal", "refunded", "returned", "chargeback"]);

/**
 * Classifies a PontisGlobe payout status. Unknown statuses are PENDING, never
 * failed — uncertainty must not finalize anything in either direction.
 */
export function classifyPontisStatus(status: string | undefined | null): ProviderOutcome {
  return classifyStatus(status);
}

/**
 * Classifies a RemitQuickly payout status. Tolerates verbose status strings
 * ("payout failed", "transaction reversed by bank") via substring checks after
 * the exact-match pass.
 */
export function classifyRemitQuicklyStatus(status: string | undefined | null): ProviderOutcome {
  const exact = classifyStatus(status);
  if (exact !== "pending" || !status) return exact;

  const value = status.toLowerCase();
  if (value.includes("revers") || value.includes("refund") || value.includes("return")) return "reversed";
  if (value.includes("fail") || value.includes("reject")) return "failed";
  if (value.includes("success") || value.includes("processed") || value.includes("complete")) return "success";
  return "pending";
}

function classifyStatus(status: string | undefined | null): ProviderOutcome {
  if (!status) return "pending";
  const value = status.trim().toLowerCase();
  if (SUCCESS_STATUSES.has(value)) return "success";
  if (REVERSED_STATUSES.has(value)) return "reversed";
  if (FAILED_STATUSES.has(value)) return "failed";
  return "pending";
}

/**
 * Fixed INRSettle namespace for deterministic (RFC 4122 v5) UUIDs. Changing
 * this constant would change every derived idempotency key — never change it.
 */
const INRSETTLE_UUID_NAMESPACE = "3f1c6e8a-9b4d-4f2a-8c7e-1d5a2b9e0c43";

/**
 * Deterministic RFC 4122 version-5 UUID (SHA-1, name-based): the same name
 * always yields the same UUID; different names yield different UUIDs.
 */
export function deterministicUuid(name: string, namespace: string = INRSETTLE_UUID_NAMESPACE): string {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  if (namespaceBytes.length !== 16) {
    throw new Error("UUID namespace must be a valid UUID.");
  }

  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(name, "utf8")]))
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Stable PontisGlobe idempotency key for a settlement action, as a VALID UUID
 * (the provider requires UUID format). Deterministically derived from
 * provider + action + settlement public id — never random — so a retry after
 * a timeout reuses the SAME key and the provider deduplicates instead of
 * creating a second payout. RemitQuickly achieves the same via
 * merchantRecognitionId = publicId.
 */
export function pontisIdempotencyKeyFor(settlementPublicId: string, action: string = "payout"): string {
  return deterministicUuid(`pontisglobe:${action}:${settlementPublicId}`);
}

export type ProofFingerprintInput = {
  settlementId: string;
  provider: string;
  providerTransactionId?: string | null;
  providerStatus: string;
  receivedVia: string;
};

/**
 * Natural key for provider-proof deduplication: the same settlement + provider
 * + transaction + status + channel is the same piece of evidence, however many
 * times the webhook/poll delivers it. A *changed* status (e.g. processing ->
 * completed) is new evidence and gets its own row.
 */
export function proofFingerprint(input: ProofFingerprintInput): string {
  return [
    input.settlementId,
    input.provider,
    input.providerTransactionId?.trim() || "-",
    input.providerStatus.trim().toLowerCase(),
    input.receivedVia,
  ].join("|");
}
