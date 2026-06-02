// Pure reconciliation matching helpers (no framework/Prisma coupling) so they can
// run in the auto-match engine (server domain) and in page render for display.

export type MatchType = "AUTO_MATCHED" | "SUGGESTED" | "MANUAL_REVIEW" | "EXCEPTION";

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

export function matchTypeFor(status: string, confidence: number, hasSettlement: boolean): MatchType {
  if (status === "EXCEPTION") return "EXCEPTION";
  if (hasSettlement && confidence >= 100) return "AUTO_MATCHED";
  if (hasSettlement && confidence >= 90) return "SUGGESTED";
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
  SUGGESTED: "Suggested match",
  MANUAL_REVIEW: "Manual review",
  EXCEPTION: "Exception",
};

export const MATCH_TONE: Record<MatchType, "success" | "info" | "warning" | "danger"> = {
  AUTO_MATCHED: "success",
  SUGGESTED: "info",
  MANUAL_REVIEW: "warning",
  EXCEPTION: "danger",
};
