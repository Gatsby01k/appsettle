// Deterministic finality review engine (pure — no framework/Prisma coupling).
//
// Core product rule: provider status "completed" means the payout MAY have
// completed. A settlement is only safe to finalize when three independent
// inputs agree:
//   1. provider proof   — structured evidence of what the provider reported
//   2. reconciliation   — an independent record (bank statement / PSP report)
//      matched to the settlement
//   3. audit trail      — the settlement was approved through the controlled
//      lifecycle (approval recorded)
//
// The same input always produces the same output: no randomness, no clock
// reads, no I/O.

export type FinalityDecision = "ready_to_finalize" | "needs_review" | "not_ready";
export type FinalityRiskLevel = "low" | "medium" | "high";

export type FinalitySettlementInput = {
  publicId: string;
  status: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
};

export type FinalityProofInput = {
  provider: string;
  providerStatus: string;
  providerTransactionId?: string | null;
  utr?: string | null;
  actualAmount?: number | null;
  currency?: string | null;
  receivedVia: string;
};

export type FinalityReconciliationInput = {
  status: string;
  externalRef: string;
  source: string;
  amount: number;
  currency: string;
};

export type FinalityInput = {
  settlement: FinalitySettlementInput;
  /** Latest provider proof for the settlement, or null when none recorded. */
  proof: FinalityProofInput | null;
  /** Reconciliation record linked to the settlement, or null when none. */
  reconciliation: FinalityReconciliationInput | null;
  /** True when the audit trail records an approval for this settlement. */
  auditApprovalPresent: boolean;
};

export type FinalityAssessment = {
  decision: FinalityDecision;
  riskLevel: FinalityRiskLevel;
  /** 0–100. 100 only when proof + reconciliation + audit all agree. */
  confidence: number;
  summary: string;
  blockingIssues: string[];
  warnings: string[];
  evidence: string[];
  recommendedActions: string[];
};

/** Provider statuses treated as "the provider claims the payout completed". */
const COMPLETED_PROVIDER_STATUSES = new Set(["completed", "success", "successful", "settled", "processed"]);
/** Provider statuses treated as a failed payout. */
const FAILED_PROVIDER_STATUSES = new Set(["failed", "reversed", "rejected", "canceled", "cancelled"]);

/** Reconciliation statuses that count as an independent match. */
const MATCHED_RECONCILIATION_STATUSES = new Set(["MATCHED"]);
/** Reconciliation statuses that actively contradict the settlement. */
const UNMATCHED_RECONCILIATION_STATUSES = new Set(["UNMATCHED", "EXCEPTION"]);

const AMOUNT_TOLERANCE = 0.01;

export function isCompletedProviderStatus(status: string | null | undefined): boolean {
  return Boolean(status && COMPLETED_PROVIDER_STATUSES.has(status.toLowerCase()));
}

export function isFailedProviderStatus(status: string | null | undefined): boolean {
  return Boolean(status && FAILED_PROVIDER_STATUSES.has(status.toLowerCase()));
}

/** The settlement leg amount in the given currency, or null when neither leg matches. */
export function settlementExpectedAmount(
  settlement: FinalitySettlementInput,
  currency: string | null | undefined,
): number | null {
  if (!currency) return null;
  if (settlement.sourceCurrency === currency) return settlement.sourceAmount;
  if (settlement.targetCurrency === currency) return settlement.targetAmount;
  return null;
}

function amountsAgree(expected: number, actual: number): boolean {
  return Math.abs(expected - actual) <= AMOUNT_TOLERANCE;
}

function riskRank(level: FinalityRiskLevel): number {
  return level === "high" ? 2 : level === "medium" ? 1 : 0;
}

function maxRisk(a: FinalityRiskLevel, b: FinalityRiskLevel): FinalityRiskLevel {
  return riskRank(b) > riskRank(a) ? b : a;
}

/**
 * Assesses whether a settlement is safe to finalize. Deterministic rules:
 *
 *  - provider status not completed            -> not_ready
 *  - provider proof missing                   -> needs_review (high risk)
 *  - reconciliation missing                   -> needs_review (medium risk)
 *  - reconciliation unmatched / exception     -> needs_review (high risk)
 *  - expected vs reported amount differs      -> needs_review (high risk)
 *  - audit approval missing                   -> needs_review (high risk)
 *  - proof + reconciliation + audit agree     -> ready_to_finalize (low risk)
 */
export function assessFinality(input: FinalityInput): FinalityAssessment {
  const { settlement, proof, reconciliation, auditApprovalPresent } = input;

  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const evidence: string[] = [];
  const recommendedActions: string[] = [];
  let riskLevel: FinalityRiskLevel = "low";
  let confidence = 0;

  // --- 1. Provider status gate -------------------------------------------------
  const providerStatus = proof?.providerStatus ?? null;
  const providerCompleted = isCompletedProviderStatus(providerStatus);
  const providerFailed = isFailedProviderStatus(providerStatus);

  if (!providerCompleted) {
    if (proof) {
      evidence.push(
        `Provider ${proof.provider} reported status "${proof.providerStatus}" via ${proof.receivedVia.toLowerCase()}.`,
      );
    }
    if (providerFailed) {
      blockingIssues.push(`Provider reports a failed/terminal status ("${providerStatus}").`);
      recommendedActions.push("Investigate the failed payout with the provider before any finalization.");
      riskLevel = "high";
    } else if (proof) {
      blockingIssues.push(`Provider status is "${providerStatus}", not completed — payout still in flight.`);
      recommendedActions.push("Wait for a final provider status (webhook or status poll) before review.");
      riskLevel = "medium";
    } else {
      blockingIssues.push("No provider proof recorded — provider outcome is unknown.");
      recommendedActions.push("Execute the payout and record provider proof (webhook, poll, or manual sync).");
      riskLevel = "high";
    }

    return {
      decision: "not_ready",
      riskLevel,
      confidence: 0,
      summary: `Settlement ${settlement.publicId} is not ready for finality review: no completed provider outcome.`,
      blockingIssues,
      warnings,
      evidence,
      recommendedActions,
    };
  }

  // Provider claims completion. From here on, every missing or disagreeing
  // input downgrades to needs_review — provider word alone is never enough.
  confidence += 25;
  evidence.push(
    `Provider ${proof!.provider} reported "${proof!.providerStatus}" via ${proof!.receivedVia.toLowerCase()}` +
      (proof!.providerTransactionId ? ` (transaction ${proof!.providerTransactionId})` : "") +
      (proof!.utr ? `, UTR ${proof!.utr}` : "") +
      ".",
  );

  // --- 2. Proof amount vs expected leg -----------------------------------------
  const expectedForProof = settlementExpectedAmount(settlement, proof!.currency);
  if (proof!.actualAmount != null && proof!.currency) {
    if (expectedForProof === null) {
      blockingIssues.push(
        `Provider reported currency ${proof!.currency}, which matches neither settlement leg (${settlement.sourceCurrency}/${settlement.targetCurrency}).`,
      );
      recommendedActions.push("Verify the provider payout currency against the settlement legs.");
      riskLevel = "high";
    } else if (!amountsAgree(expectedForProof, proof!.actualAmount)) {
      blockingIssues.push(
        `Amount mismatch: expected ${expectedForProof} ${proof!.currency}, provider reported ${proof!.actualAmount} ${proof!.currency}.`,
      );
      recommendedActions.push("Investigate the amount difference with the provider before finalizing.");
      riskLevel = "high";
    } else {
      confidence += 15;
      evidence.push(`Provider-reported amount ${proof!.actualAmount} ${proof!.currency} matches the settlement leg.`);
    }
  } else {
    warnings.push("Provider proof does not include a payout amount; amount agreement relies on reconciliation only.");
    confidence += 5;
  }

  // --- 3. Independent reconciliation -------------------------------------------
  if (!reconciliation) {
    blockingIssues.push("No reconciliation record is linked to this settlement — provider claim is uncorroborated.");
    recommendedActions.push("Ingest the bank statement / PSP report and match it to this settlement.");
    riskLevel = maxRisk(riskLevel, "medium");
  } else if (UNMATCHED_RECONCILIATION_STATUSES.has(reconciliation.status)) {
    blockingIssues.push(
      `Linked reconciliation record ${reconciliation.externalRef} is ${reconciliation.status} — independent evidence contradicts the provider.`,
    );
    recommendedActions.push("Resolve the reconciliation exception before finalizing.");
    riskLevel = "high";
  } else if (!MATCHED_RECONCILIATION_STATUSES.has(reconciliation.status)) {
    blockingIssues.push(
      `Linked reconciliation record ${reconciliation.externalRef} is ${reconciliation.status}, not MATCHED.`,
    );
    recommendedActions.push("Complete reconciliation matching for this settlement.");
    riskLevel = maxRisk(riskLevel, "medium");
  } else {
    const expectedForRecon = settlementExpectedAmount(settlement, reconciliation.currency);
    if (expectedForRecon === null) {
      blockingIssues.push(
        `Reconciliation record currency ${reconciliation.currency} matches neither settlement leg.`,
      );
      recommendedActions.push("Verify the reconciliation record was matched to the correct settlement.");
      riskLevel = "high";
    } else if (!amountsAgree(expectedForRecon, reconciliation.amount)) {
      blockingIssues.push(
        `Amount mismatch: expected ${expectedForRecon} ${reconciliation.currency}, reconciliation record shows ${reconciliation.amount} ${reconciliation.currency}.`,
      );
      recommendedActions.push("Investigate the reconciliation amount difference before finalizing.");
      riskLevel = "high";
    } else {
      confidence += 35;
      evidence.push(
        `Independent ${reconciliation.source} record ${reconciliation.externalRef} (MATCHED) confirms ${reconciliation.amount} ${reconciliation.currency}.`,
      );
    }
  }

  // --- 4. Audit trail approval --------------------------------------------------
  if (!auditApprovalPresent) {
    blockingIssues.push("No approval is recorded in the audit trail for this settlement.");
    recommendedActions.push("Verify the settlement went through the approval workflow; re-approve if required.");
    riskLevel = "high";
  } else {
    confidence += 25;
    evidence.push("Audit trail records an approval for this settlement.");
  }

  // --- Decision ------------------------------------------------------------------
  if (blockingIssues.length === 0) {
    return {
      decision: "ready_to_finalize",
      riskLevel: "low",
      confidence: Math.min(confidence, 100),
      summary: `Settlement ${settlement.publicId} is safe to finalize: provider proof, reconciliation, and audit trail agree.`,
      blockingIssues,
      warnings,
      evidence,
      recommendedActions:
        recommendedActions.length > 0 ? recommendedActions : ["Finalize the settlement and issue the settlement report."],
    };
  }

  return {
    decision: "needs_review",
    riskLevel,
    confidence: Math.min(confidence, 100),
    summary: `Settlement ${settlement.publicId} needs operator review: provider reports completed but ${blockingIssues.length} issue(s) block finality.`,
    blockingIssues,
    warnings,
    evidence,
    recommendedActions,
  };
}
