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
 * Stable PontisGlobe idempotency key for a settlement payout. Derived from the
 * settlement's public id (never random), so a retry after a timeout reuses the
 * SAME key and the provider deduplicates instead of creating a second payout.
 * RemitQuickly achieves the same via merchantRecognitionId = publicId.
 */
export function pontisIdempotencyKeyFor(settlementPublicId: string): string {
  return `inrsettle-payout-${settlementPublicId}`;
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
