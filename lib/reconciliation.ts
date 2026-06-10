// Pure reconciliation matching helpers (no framework/Prisma coupling) so they can
// run in the auto-match engine (server domain) and in page render for display.

export type MatchType = "AUTO_MATCHED" | "MANUAL_MATCHED" | "SUGGESTED" | "MANUAL_REVIEW" | "EXCEPTION" | "RESOLVED";

/**
 * How a linked record came to be matched:
 *  - AUTO: linked by the auto-match engine (exact 100% match, no operator action)
 *  - MANUAL: linked by an operator (confirming a suggestion or a manual match at create time)
 */
export type MatchOrigin = "AUTO" | "MANUAL";

/** Confidence at/above which a candidate may be surfaced as a SUGGESTED match (operator confirm/reject). */
export const SUGGESTED_MIN_CONFIDENCE = 80;
/** Confidence required for the engine to auto-match and reconcile without operator action. */
export const AUTO_MATCH_MIN_CONFIDENCE = 100;

// --- Reconciliation source classification ---------------------------------------
//
// Core product rule: provider "completed" is provider proof/status, never
// reconciliation. Reconciliation must be INDEPENDENT evidence — something the
// provider cannot fabricate on its own.

/** A record that merely restates what the payout provider claims. Never independent. */
export const PROVIDER_CLAIM_SOURCE = "provider_claim";

/**
 * Sources that count as independent reconciliation evidence for finality:
 *  - bank_statement   — the bank's own record of the money movement
 *  - psp_report       — an external PSP/partner report
 *  - manual_operator  — an operator attesting to independently verified evidence
 *  - manual           — legacy alias of manual_operator (pre-classification records)
 *  - chain_tx         — an on-chain transaction observed independently
 */
export const INDEPENDENT_RECONCILIATION_SOURCES = new Set([
  "bank_statement",
  "psp_report",
  "manual_operator",
  "manual",
  "chain_tx",
]);

/**
 * Whether a reconciliation source counts as independent evidence for finality.
 * `provider_claim` (and anything unknown) does NOT count: a provider repeating
 * its own claim can never corroborate that claim.
 */
export function isIndependentReconciliationSource(source: string | null | undefined): boolean {
  return Boolean(source && INDEPENDENT_RECONCILIATION_SOURCES.has(source));
}

export const RECONCILIATION_SOURCE_LABEL: Record<string, string> = {
  bank_statement: "Bank statement",
  psp_report: "PSP report",
  manual_operator: "Manual (operator)",
  manual: "Manual (operator)",
  chain_tx: "Chain transfer",
  provider_claim: "Provider claim",
};

export type SettlementLegs = {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  refDate: Date;
};

export function settlementLegAmount(settlement: SettlementLegs, currency: string): number | null {
  if (settlement.sourceCurrency === currency) return settlement.sourceAmount;
  if (settlement.targetCurrency === currency) return settlement.targetAmount;
  return null;
}

/**
 * Confidence that a reconciliation record matches a settlement.
 *  - 100: amount + currency + value date all align
 *  -  90: amount + currency align (date differs)
 *  -   0: no usable amount/currency match
 */
export function computeConfidence(
  amount: number,
  currency: string,
  valueDate: Date,
  settlement: SettlementLegs | null,
): number {
  if (!settlement) return 0;
  const leg = settlementLegAmount(settlement, currency);
  if (leg === null) return 0;
  if (Math.abs(leg - amount) > 0.01) return 0;
  const sameDay = new Date(settlement.refDate).toDateString() === new Date(valueDate).toDateString();
  return sameDay ? 100 : 90;
}

/**
 * Derives the display/lifecycle match type from the record's *persisted* state.
 *
 * The match type is driven by the real status + settlement linkage + how it was
 * matched (origin), never by a recomputed score alone. This guarantees a linked
 * record is shown as matched (AUTO_MATCHED or MANUAL_MATCHED) and is NEVER shown as
 * "Suggested". SUGGESTED is reserved for unlinked records that have a strong
 * candidate awaiting an operator Confirm/Reject decision.
 */
export function matchTypeFor(
  status: string,
  confidence: number,
  hasSettlement: boolean,
  origin?: MatchOrigin | null,
): MatchType {
  if (status === "EXCEPTION") return "EXCEPTION";

  // A resolved exception has been reviewed by an operator. It is never shown as
  // matched/reconciled and never carries a settlement link.
  if (status === "RESOLVED") return "RESOLVED";

  // A record linked to a settlement is matched/reconciled, not a pending suggestion.
  // Prefer the recorded origin; fall back to confidence for legacy records.
  if (hasSettlement) {
    if (origin === "MANUAL") return "MANUAL_MATCHED";
    if (origin === "AUTO") return "AUTO_MATCHED";
    return confidence >= AUTO_MATCH_MIN_CONFIDENCE ? "AUTO_MATCHED" : "MANUAL_MATCHED";
  }

  // Unlinked: a strong candidate is a suggestion awaiting Confirm/Reject; anything
  // weaker is manual review. Unlinked records are never shown as matched.
  if (confidence >= SUGGESTED_MIN_CONFIDENCE) return "SUGGESTED";
  return "MANUAL_REVIEW";
}

/**
 * Human-readable explanation of why a record matched (or partially matched) a
 * settlement. Used both in the reconciliation detail panel and audit logs.
 */
export function matchReasonFor(confidence: number, currency: string): string {
  if (confidence >= 100) {
    return `Amount, ${currency} currency, and value date all match the settlement.`;
  }
  if (confidence >= 90) {
    return `Amount and ${currency} currency match; value date differs.`;
  }
  return "No settlement with a matching amount and currency.";
}

export const MATCH_LABEL: Record<MatchType, string> = {
  AUTO_MATCHED: "Auto-matched",
  MANUAL_MATCHED: "Manual match",
  SUGGESTED: "Suggested match",
  MANUAL_REVIEW: "Manual review",
  EXCEPTION: "Exception",
  RESOLVED: "Resolved",
};

export const MATCH_TONE: Record<MatchType, "success" | "info" | "warning" | "danger" | "neutral"> = {
  AUTO_MATCHED: "success",
  MANUAL_MATCHED: "success",
  SUGGESTED: "info",
  MANUAL_REVIEW: "warning",
  EXCEPTION: "danger",
  RESOLVED: "neutral",
};
