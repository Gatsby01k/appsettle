// Pure reconciliation matching helpers (no framework/Prisma coupling) so they can
// run in the auto-match engine (server domain) and in page render for display.

export type MatchType = "AUTO_MATCHED" | "MANUAL_MATCHED" | "SUGGESTED" | "MANUAL_REVIEW" | "EXCEPTION";

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
};

export const MATCH_TONE: Record<MatchType, "success" | "info" | "warning" | "danger"> = {
  AUTO_MATCHED: "success",
  MANUAL_MATCHED: "success",
  SUGGESTED: "info",
  MANUAL_REVIEW: "warning",
  EXCEPTION: "danger",
};
