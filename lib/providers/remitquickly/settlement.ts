import "server-only";

import { AuditActorType, SettlementStatus, type Settlement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { createReconciliationRecord, transitionSettlement } from "@/lib/domain";
import {
  extractPayoutId,
  simulatePayoutOutcome,
  submitImpsPayout,
  type ImpsPayoutRequest,
  type SimulateOutcome,
} from "./client";
import type { BeneficiaryOverrides } from "./schema";

export const PROVIDER = "remitquickly";
const RECON_SOURCE = "psp_report";

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
  outcome: "success" | "failed";
  userId: string;
  organizationId: string;
  payoutId?: number | string | null;
  utr?: string | null;
  comment?: string | null;
  actorType?: AuditActorType;
};

/**
 * Applies a resolved payout outcome to a settlement. Idempotent: re-delivered
 * webhooks or repeated status polls are safely ignored once the settlement has
 * left the EXECUTING state.
 *
 * On success: settlement -> SETTLED, then a MATCHED reconciliation record is
 *   created (which reconciles the settlement) and an audit event is written.
 * On failure: settlement -> FAILED with a failure reason and an audit event.
 */
export async function applyPayoutResolution(input: ResolutionInput) {
  const { settlement, outcome, userId, organizationId } = input;
  const actorType = input.actorType ?? AuditActorType.SYSTEM;

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

    await transitionSettlement(
      fresh.id,
      SettlementStatus.SETTLED,
      userId,
      organizationId,
      `RemitQuickly payout ${input.payoutId ?? ""} succeeded${input.utr ? ` (UTR ${input.utr})` : ""}.`,
    );

    const externalRef = input.utr?.trim() || `RQ-${input.payoutId ?? fresh.publicId}`;
    const existingRecord = await prisma.reconciliationRecord.findFirst({
      where: { organizationId, source: RECON_SOURCE, externalRef },
    });

    if (!existingRecord) {
      const { amount, currency } = inrLeg(fresh);
      await createReconciliationRecord(
        {
          externalRef,
          source: RECON_SOURCE,
          amount,
          currency,
          settlementId: fresh.id,
          valueDate: new Date().toISOString(),
          status: "MATCHED",
        },
        userId,
        organizationId,
      );
    }

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
        externalRef,
      },
    });

    return { settlementId: fresh.id, status: SettlementStatus.SETTLED, externalRef };
  }

  // outcome === "failed"
  if (fresh.status === SettlementStatus.FAILED) {
    return { settlementId: fresh.id, status: fresh.status, skipped: true };
  }
  if (fresh.status !== SettlementStatus.EXECUTING && fresh.status !== SettlementStatus.APPROVED) {
    throw new UserFacingError(`Settlement ${fresh.publicId} cannot be failed from ${fresh.status}.`);
  }

  const reason = input.comment?.trim() || "RemitQuickly payout failed.";
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

/** Maps a RemitQuickly payout status string to our resolution outcome. */
export function mapPayoutStatus(status: string | undefined | null): "success" | "failed" | "pending" {
  if (!status) return "pending";
  const value = status.toLowerCase();
  if (value.includes("fail")) return "failed";
  if (value.includes("success") || value.includes("processed")) return "success";
  return "pending";
}
