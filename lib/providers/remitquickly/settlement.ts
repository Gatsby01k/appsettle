import "server-only";

import { AuditActorType, ProofReceivedVia, SettlementStatus, type Settlement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { transitionSettlement } from "@/lib/domain";
import { recordProviderProof } from "@/lib/provider-proof";
import { classifyRemitQuicklyStatus, type ProviderOutcome } from "@/lib/providers/outcome";
import {
  extractPayoutId,
  simulatePayoutOutcome,
  submitImpsPayout,
  type ImpsPayoutRequest,
  type SimulateOutcome,
} from "./client";
import type { BeneficiaryOverrides } from "./schema";

export const PROVIDER = "remitquickly";

/** The INR leg of a settlement (the IMPS payout is always denominated in INR). */
function inrLeg(settlement: Settlement): { amount: number; currency: "INR" } {
  const amount =
    settlement.sourceCurrency === "INR" ? Number(settlement.sourceAmount) : Number(settlement.targetAmount);
  return { amount, currency: "INR" };
}

/**
 * Builds an IMPS payout request from a settlement plus optional overrides.
 *
 * The settlement model does not persist granular beneficiary banking details, so
 * sandbox-safe defaults are used and any field can be overridden by the caller.
 * `merchantRecognitionId` is set to the settlement's public id so inbound webhooks
 * and status lookups can be mapped back to the correct settlement.
 */
export function buildPayoutRequest(
  settlement: Settlement,
  overrides: BeneficiaryOverrides | undefined,
  options: { isTest?: boolean } = {},
): ImpsPayoutRequest {
  const { amount } = inrLeg(settlement);
  const defaultQuoteId = Number(process.env.REMITQUICKLY_DEFAULT_QUOTE_ID ?? 1);

  return {
    merchantRecognitionId: settlement.publicId,
    acc_id: overrides?.acc_id ?? settlement.targetAccount,
    name: overrides?.name ?? "Test Beneficiary",
    bank_name: overrides?.bank_name ?? "HDFC Bank",
    ifsc: overrides?.ifsc ?? "HDFC0001234",
    acc_type: overrides?.acc_type ?? "savings",
    amount: overrides?.amount ?? amount,
    mobile: overrides?.mobile ?? "9999999999",
    quote_id: overrides?.quote_id ?? defaultQuoteId,
    email: overrides?.email,
    mobile_code: "+91",
    remarks: settlement.reference,
    isTest: options.isTest ?? true,
  };
}

/**
 * Executes an APPROVED settlement through RemitQuickly:
 *  - submits the IMPS payout
 *  - records the provider payout id (audit log + lifecycle event note)
 *  - moves the settlement APPROVED -> EXECUTING
 *  - optionally simulates an outcome (sandbox only)
 */
export async function executeApprovedSettlement(
  settlementId: string,
  userId: string,
  organizationId: string,
  options: { overrides?: BeneficiaryOverrides; simulateOutcome?: SimulateOutcome } = {},
) {
  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId },
  });
  if (!settlement) throw new UserFacingError("Settlement was not found.");
  if (settlement.status !== SettlementStatus.APPROVED) {
    throw new UserFacingError("Only APPROVED settlements can be executed through RemitQuickly.");
  }

  const request = buildPayoutRequest(settlement, options.overrides);
  const result = await submitImpsPayout(request);

  if (!result.ok) {
    const message =
      (result.data as { error?: string })?.error ??
      `RemitQuickly rejected the payout (HTTP ${result.status}).`;
    await writeAuditLog({
      action: "remitquickly.payout.failed_submit",
      resourceType: "settlement",
      resourceId: settlement.id,
      organizationId,
      userId,
      actorType: AuditActorType.API,
      after: { provider: PROVIDER, status: result.status, response: result.data },
    });
    throw new UserFacingError(message);
  }

  const payoutId = extractPayoutId(result.data);

  await transitionSettlement(
    settlement.id,
    SettlementStatus.EXECUTING,
    userId,
    organizationId,
    `RemitQuickly payout ${payoutId ?? "(pending id)"} submitted (merchantRecognitionId=${settlement.publicId}).`,
  );

  await writeAuditLog({
    action: "remitquickly.payout.created",
    resourceType: "settlement",
    resourceId: settlement.id,
    organizationId,
    userId,
    actorType: AuditActorType.API,
    after: {
      provider: PROVIDER,
      payoutId,
      merchantRecognitionId: settlement.publicId,
      amount: request.amount,
    },
  });

  let simulate;
  if (options.simulateOutcome && payoutId != null) {
    simulate = await simulatePayoutOutcome(payoutId, options.simulateOutcome);
  }

  return { payoutId, submit: result.data, simulate: simulate?.data };
}

type ResolutionInput = {
  settlement: Settlement;
  outcome: Exclude<ProviderOutcome, "pending">;
  userId: string;
  organizationId: string;
  payoutId?: number | string | null;
  utr?: string | null;
  comment?: string | null;
  /** Raw provider status string (e.g. "success", "failed"), when known. */
  providerStatus?: string | null;
  /** Amount the provider claims was paid out, when reported. */
  actualAmount?: number | null;
  /** Full provider payload backing this resolution (webhook record / status row). */
  rawResponse?: unknown;
  /** How this outcome reached us. Defaults to POLL. */
  receivedVia?: ProofReceivedVia;
  actorType?: AuditActorType;
};

/**
 * Applies a resolved payout outcome to a settlement. Idempotent: re-delivered
 * webhooks or repeated status polls are safely ignored once the settlement has
 * left the EXECUTING state.
 *
 * IMPORTANT (finality model): provider status "completed/success" only means
 * the payout MAY have completed. This function records structured provider
 * proof and moves the settlement to SETTLED — it NEVER creates or matches a
 * reconciliation record. Reconciliation must come from an independent source
 * (bank statement / PSP report ingest), and finality review (lib/finality.ts)
 * requires proof + reconciliation + audit trail to agree.
 *
 * On success: provider proof recorded, then settlement -> SETTLED + audit event.
 * On failure: provider proof recorded, then settlement -> FAILED with a
 *   failure reason + audit event.
 */
export async function applyPayoutResolution(input: ResolutionInput) {
  const { settlement, outcome, userId, organizationId } = input;
  const actorType = input.actorType ?? AuditActorType.SYSTEM;
  const receivedVia = input.receivedVia ?? ProofReceivedVia.POLL;

  const fresh = await prisma.settlement.findFirst({
    where: { id: settlement.id, organizationId },
  });
  if (!fresh) throw new UserFacingError("Settlement was not found.");

  if (outcome === "success") {
    if (fresh.status === SettlementStatus.SETTLED || fresh.status === SettlementStatus.RECONCILED) {
      return { settlementId: fresh.id, status: fresh.status, skipped: true };
    }
    if (fresh.status !== SettlementStatus.EXECUTING) {
      throw new UserFacingError(`Settlement ${fresh.publicId} is not executing; cannot mark settled.`);
    }

    // Record evidence BEFORE the transition: if the proof write fails, the
    // settlement stays EXECUTING and the webhook/poll can be retried safely.
    // Only provider-reported values go into proof — never substitute expected
    // amounts, or the finality amount check would always "agree".
    const proof = await recordProviderProof({
      settlementId: fresh.id,
      organizationId,
      userId,
      provider: PROVIDER,
      providerTransactionId: input.payoutId != null ? String(input.payoutId) : null,
      utr: input.utr,
      providerStatus: input.providerStatus ?? "success",
      actualAmount: input.actualAmount ?? null,
      currency: input.actualAmount != null ? "INR" : null,
      rawResponse: input.rawResponse,
      receivedVia,
      actorType,
    });

    await transitionSettlement(
      fresh.id,
      SettlementStatus.SETTLED,
      userId,
      organizationId,
      `RemitQuickly payout ${input.payoutId ?? ""} reported successful${input.utr ? ` (UTR ${input.utr})` : ""}. Awaiting independent reconciliation.`,
    );

    await writeAuditLog({
      action: "remitquickly.payout.settled",
      resourceType: "settlement",
      resourceId: fresh.id,
      organizationId,
      userId,
      actorType,
      after: {
        provider: PROVIDER,
        payoutId: input.payoutId,
        utr: input.utr,
        proofId: proof.id,
        receivedVia,
        reconciliation: "pending_independent_match",
      },
    });

    return { settlementId: fresh.id, status: SettlementStatus.SETTLED, proofId: proof.id };
  }

  if (outcome === "reversed") {
    // A reversal means money may have moved and come back — the true state is
    // UNCERTAIN, so the settlement is NEVER auto-failed. Record the provider's
    // claim as proof and flag for operator review; the lifecycle stays put.
    await recordProviderProof({
      settlementId: fresh.id,
      organizationId,
      userId,
      provider: PROVIDER,
      providerTransactionId: input.payoutId != null ? String(input.payoutId) : null,
      utr: input.utr,
      providerStatus: input.providerStatus ?? "reversed",
      actualAmount: input.actualAmount ?? null,
      currency: input.actualAmount != null ? "INR" : null,
      rawResponse: input.rawResponse,
      receivedVia,
      actorType,
    });

    await writeAuditLog({
      action: "remitquickly.payout.reversed_review_required",
      resourceType: "settlement",
      resourceId: fresh.id,
      organizationId,
      userId,
      actorType,
      after: {
        provider: PROVIDER,
        payoutId: input.payoutId,
        utr: input.utr,
        note: "Provider reports a reversal — money movement uncertain. Operator review required; settlement not auto-failed.",
      },
    });

    return { settlementId: fresh.id, status: fresh.status, reviewRequired: true };
  }

  // outcome === "failed"
  if (fresh.status === SettlementStatus.FAILED) {
    return { settlementId: fresh.id, status: fresh.status, skipped: true };
  }
  if (fresh.status !== SettlementStatus.EXECUTING && fresh.status !== SettlementStatus.APPROVED) {
    throw new UserFacingError(`Settlement ${fresh.publicId} cannot be failed from ${fresh.status}.`);
  }

  const reason = input.comment?.trim() || "RemitQuickly payout failed.";

  // Failed outcomes are evidence too — record proof before the transition.
  await recordProviderProof({
    settlementId: fresh.id,
    organizationId,
    userId,
    provider: PROVIDER,
    providerTransactionId: input.payoutId != null ? String(input.payoutId) : null,
    utr: input.utr,
    providerStatus: input.providerStatus ?? "failed",
    actualAmount: input.actualAmount ?? null,
    currency: input.actualAmount != null ? "INR" : null,
    rawResponse: input.rawResponse,
    receivedVia,
    actorType,
  });

  await prisma.settlement.update({
    where: { id: fresh.id },
    data: { failureReason: reason },
  });

  await transitionSettlement(
    fresh.id,
    SettlementStatus.FAILED,
    userId,
    organizationId,
    `RemitQuickly payout ${input.payoutId ?? ""} failed: ${reason}`,
  );

  await writeAuditLog({
    action: "remitquickly.payout.failed",
    resourceType: "settlement",
    resourceId: fresh.id,
    organizationId,
    userId,
    actorType,
    after: { provider: PROVIDER, payoutId: input.payoutId, reason },
  });

  return { settlementId: fresh.id, status: SettlementStatus.FAILED, reason };
}

/**
 * Maps a RemitQuickly payout status string to our resolution outcome.
 *
 * Live-pilot safety: `reversed` is its own outcome (operator review, never an
 * automatic FAILED) and unknown statuses are `pending`, never failed.
 */
export function mapPayoutStatus(status: string | undefined | null): ProviderOutcome {
  return classifyRemitQuicklyStatus(status);
}
