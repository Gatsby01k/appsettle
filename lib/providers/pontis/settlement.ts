import "server-only";

import { AuditActorType, Prisma, SettlementStatus, type Settlement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { transitionSettlement } from "@/lib/domain";
import {
  getPayoutStatus,
  loginOrThrow,
  sendPayoutRequest,
  type PontisEnvelope,
  type PontisPayoutData,
  type PontisPayoutRequest,
  type PontisResponse,
} from "./client";
import {
  gatewayCheckStatus,
  gatewaySendPayout,
  isPontisGatewayConfigured,
  type PontisGatewayResult,
} from "./gateway";

/** Provider name persisted on the settlement + stamped on every audit entry. */
export const PROVIDER = "PontisGlobe";

/**
 * Overrides accepted when building a payout from a settlement. The settlement
 * model does not persist granular beneficiary banking details, so sandbox-safe
 * defaults are used and any field can be overridden by the caller.
 */
export type PontisPayoutOverrides = {
  country_code?: string;
  currency_code?: string;
  payment_method?: string;
  source_amount?: string;
  source_currency?: string;
  recipient_details?: Partial<PontisPayoutData> & {
    name?: string;
    account_number?: string;
    ifsc?: string;
    [key: string]: unknown;
  };
};

/**
 * The USDT (crypto) leg of a settlement — the amount PontisGlobe pays out from.
 * For an INR->USDT corridor the USDT amount is the target leg; for USDT->INR it
 * is the source leg.
 */
function usdtLeg(settlement: Settlement): number {
  return settlement.sourceCurrency === "USDT"
    ? Number(settlement.sourceAmount)
    : Number(settlement.targetAmount);
}

/** Pontis `source_amount` is a decimal string with exactly two trailing digits. */
function formatSourceAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

/**
 * Builds a PontisGlobe payout request from a settlement plus optional overrides,
 * mirroring the documented INR sandbox payload structure. `idempotency_key` is
 * the settlement's public id so retries are idempotent and the transaction can
 * be mapped back to the correct settlement.
 */
export function buildPayoutRequest(
  settlement: Settlement,
  overrides?: PontisPayoutOverrides,
): PontisPayoutRequest {
  return {
    idempotency_key: settlement.publicId,
    country_code: overrides?.country_code ?? "IN",
    currency_code: overrides?.currency_code ?? "INR",
    payment_method: overrides?.payment_method ?? "bank_local",
    source_amount: overrides?.source_amount ?? formatSourceAmount(usdtLeg(settlement)),
    source_currency: overrides?.source_currency ?? "USDT",
    recipient_details: {
      name: overrides?.recipient_details?.name ?? "Test Beneficiary",
      account_number: overrides?.recipient_details?.account_number ?? settlement.targetAccount,
      ifsc: overrides?.recipient_details?.ifsc ?? "HDFC0001234",
      ...overrides?.recipient_details,
    },
  };
}

/** Coerces an arbitrary provider response into a Prisma-storable JSON value. */
function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

/** Normalises a direct Pontis client response into the gateway result shape. */
function normalizeDirect(
  result: PontisResponse<PontisEnvelope<PontisPayoutData>>,
  fallbackTransactionId?: string | null,
): PontisGatewayResult {
  const payout = result.data?.data ?? null;
  return {
    ok: result.ok,
    status: result.status,
    transactionId: payout?.transaction_id ?? fallbackTransactionId ?? null,
    providerStatus: payout?.status ?? null,
    statusMessage: payout?.status_message ?? null,
    response: result.data,
    error: result.ok
      ? null
      : ((result.data?.error as { message?: string })?.message ??
        payout?.status_message ??
        `PontisGlobe call failed (HTTP ${result.status}).`),
  };
}

/**
 * Submits a payout. Prefers the VPS gateway (so Pontis keys never live on
 * Vercel); only falls back to a direct Pontis call when the app itself runs on
 * the whitelisted host with the Pontis credentials configured.
 */
async function submitPayout(request: PontisPayoutRequest): Promise<PontisGatewayResult> {
  if (isPontisGatewayConfigured()) {
    return gatewaySendPayout(request);
  }
  const jwt = await loginOrThrow();
  const result = await sendPayoutRequest(request, jwt);
  return normalizeDirect(result);
}

/** Reads a payout status via the gateway, falling back to a direct Pontis call. */
async function fetchStatus(transactionId: string): Promise<PontisGatewayResult> {
  if (isPontisGatewayConfigured()) {
    return gatewayCheckStatus(transactionId);
  }
  const jwt = await loginOrThrow();
  const result = await getPayoutStatus(transactionId, jwt);
  return normalizeDirect(result, transactionId);
}

/**
 * Executes an APPROVED settlement through PontisGlobe:
 *  - logs in + submits the payout (sandbox payload structure)
 *  - persists provider = PontisGlobe and the provider transaction id
 *  - moves the settlement APPROVED -> EXECUTING
 *  - if the provider already reports a completed/failed outcome, applies it
 *    immediately (EXECUTING -> SETTLED / FAILED)
 *  - writes a `pontis.payout.created` audit entry
 */
export async function executeApprovedSettlement(
  settlementId: string,
  userId: string,
  organizationId: string,
  options: { overrides?: PontisPayoutOverrides } = {},
) {
  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId },
  });
  if (!settlement) throw new UserFacingError("Settlement was not found.");
  if (settlement.status !== SettlementStatus.APPROVED) {
    throw new UserFacingError("Only APPROVED settlements can be executed through PontisGlobe.");
  }

  const request = buildPayoutRequest(settlement, options.overrides);

  const result = await submitPayout(request);
  const transactionId = result.transactionId;

  if (!result.ok || !transactionId) {
    const message = result.error ?? `PontisGlobe rejected the payout (HTTP ${result.status}).`;
    await writeAuditLog({
      action: "pontis.payout.failed_submit",
      resourceType: "settlement",
      resourceId: settlement.id,
      organizationId,
      userId,
      actorType: AuditActorType.API,
      after: { provider: PROVIDER, status: result.status, response: result.response },
    });
    throw new UserFacingError(message);
  }

  await prisma.settlement.update({
    where: { id: settlement.id },
    data: {
      provider: PROVIDER,
      providerTransactionId: transactionId,
      providerStatus: result.providerStatus,
      providerResponse: asJson(result.response),
    },
  });

  await transitionSettlement(
    settlement.id,
    SettlementStatus.EXECUTING,
    userId,
    organizationId,
    `PontisGlobe payout submitted (transaction_id=${transactionId}).`,
  );

  await writeAuditLog({
    action: "pontis.payout.created",
    resourceType: "settlement",
    resourceId: settlement.id,
    organizationId,
    userId,
    actorType: AuditActorType.API,
    after: {
      provider: PROVIDER,
      transactionId,
      idempotencyKey: request.idempotency_key,
      sourceAmount: request.source_amount,
      sourceCurrency: request.source_currency,
      status: result.providerStatus,
    },
  });

  // The submit response may already carry a final outcome (e.g. the sandbox
  // `.00` completed trigger). Apply it right away so the settlement lands in the
  // correct state without waiting for a poll / webhook.
  const outcome = mapPontisStatus(result.providerStatus);
  let resolution = null;
  if (outcome !== "pending") {
    resolution = await applyPayoutResolution({
      settlement: { ...settlement, provider: PROVIDER, providerTransactionId: transactionId },
      outcome,
      userId,
      organizationId,
      transactionId,
      statusMessage: result.statusMessage,
      actorType: AuditActorType.API,
    });
  }

  return { transactionId, status: result.providerStatus, submit: result.response, resolution };
}

/**
 * Polls getPayoutStatus for a settlement's recorded transaction and applies the
 * outcome. Writes a `pontis.payout.status_updated` audit entry every time, and
 * (on a final status) transitions the settlement to SETTLED or FAILED.
 */
export async function checkPayoutStatus(
  settlementId: string,
  userId: string,
  organizationId: string,
) {
  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId },
  });
  if (!settlement) throw new UserFacingError("Settlement was not found.");
  if (!settlement.providerTransactionId) {
    throw new UserFacingError("This settlement has no PontisGlobe transaction to check.");
  }

  const result = await fetchStatus(settlement.providerTransactionId);

  if (!result.ok) {
    throw new UserFacingError(
      result.error ?? `PontisGlobe could not return the payout status (HTTP ${result.status}).`,
    );
  }

  const outcome = mapPontisStatus(result.providerStatus);

  await prisma.settlement.update({
    where: { id: settlement.id },
    data: {
      providerStatus: result.providerStatus,
      providerResponse: asJson(result.response),
    },
  });

  await writeAuditLog({
    action: "pontis.payout.status_updated",
    resourceType: "settlement",
    resourceId: settlement.id,
    organizationId,
    userId,
    actorType: AuditActorType.API,
    after: {
      provider: PROVIDER,
      transactionId: settlement.providerTransactionId,
      status: result.providerStatus,
      outcome,
    },
  });

  let resolution = null;
  if (outcome !== "pending") {
    resolution = await applyPayoutResolution({
      settlement,
      outcome,
      userId,
      organizationId,
      transactionId: settlement.providerTransactionId,
      statusMessage: result.statusMessage,
      actorType: AuditActorType.API,
    });
  }

  return { status: result.providerStatus, outcome, resolution };
}

type ResolutionInput = {
  settlement: Settlement;
  outcome: "success" | "failed";
  userId: string;
  organizationId: string;
  transactionId?: string | null;
  statusMessage?: string | null;
  actorType?: AuditActorType;
};

/**
 * Applies a resolved payout outcome to a settlement. Idempotent: re-delivered
 * webhooks or repeated status polls are safely ignored once the settlement has
 * left the EXECUTING state.
 *
 * On success: settlement -> SETTLED with a `pontis.payout.settled` audit entry.
 * On failure: settlement -> FAILED with a failure reason and a `pontis.payout.failed`
 *   audit entry.
 */
export async function applyPayoutResolution(input: ResolutionInput) {
  const { outcome, userId, organizationId } = input;
  const actorType = input.actorType ?? AuditActorType.SYSTEM;

  const fresh = await prisma.settlement.findFirst({
    where: { id: input.settlement.id, organizationId },
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
      `PontisGlobe payout ${input.transactionId ?? ""} completed.`,
    );

    await writeAuditLog({
      action: "pontis.payout.settled",
      resourceType: "settlement",
      resourceId: fresh.id,
      organizationId,
      userId,
      actorType,
      after: {
        provider: PROVIDER,
        transactionId: input.transactionId,
        statusMessage: input.statusMessage ?? null,
      },
    });

    return { settlementId: fresh.id, status: SettlementStatus.SETTLED };
  }

  // outcome === "failed"
  if (fresh.status === SettlementStatus.FAILED) {
    return { settlementId: fresh.id, status: fresh.status, skipped: true };
  }
  if (fresh.status !== SettlementStatus.EXECUTING && fresh.status !== SettlementStatus.APPROVED) {
    throw new UserFacingError(`Settlement ${fresh.publicId} cannot be failed from ${fresh.status}.`);
  }

  const reason = input.statusMessage?.trim() || "PontisGlobe payout failed.";
  await prisma.settlement.update({
    where: { id: fresh.id },
    data: { failureReason: reason },
  });

  await transitionSettlement(
    fresh.id,
    SettlementStatus.FAILED,
    userId,
    organizationId,
    `PontisGlobe payout ${input.transactionId ?? ""} failed: ${reason}`,
  );

  await writeAuditLog({
    action: "pontis.payout.failed",
    resourceType: "settlement",
    resourceId: fresh.id,
    organizationId,
    userId,
    actorType,
    after: { provider: PROVIDER, transactionId: input.transactionId, reason },
  });

  return { settlementId: fresh.id, status: SettlementStatus.FAILED, reason };
}

/**
 * Resolves an inbound PontisGlobe callback (or a manual sync) by transaction id.
 * The webhook has no session, so the settlement's own organization + creator are
 * used as the actor. Returns null when no settlement matches the transaction.
 */
export async function resolvePayoutByTransaction(
  transactionId: string,
  status: string,
  statusMessage?: string | null,
) {
  const settlement = await prisma.settlement.findFirst({
    where: { providerTransactionId: transactionId },
  });
  if (!settlement) return null;

  const outcome = mapPontisStatus(status);
  if (outcome === "pending") {
    return { settlementId: settlement.id, status: settlement.status, skipped: true };
  }

  return applyPayoutResolution({
    settlement,
    outcome,
    userId: settlement.createdById,
    organizationId: settlement.organizationId,
    transactionId,
    statusMessage: statusMessage ?? null,
    actorType: AuditActorType.SYSTEM,
  });
}

/**
 * Maps a PontisGlobe payout status to our resolution outcome. Final statuses are
 * `completed` (success) and `failed`/`reversed`/`rejected`/`canceled` (failed);
 * everything else (pending, processing, ...) is still in flight.
 */
export function mapPontisStatus(status: string | undefined | null): "success" | "failed" | "pending" {
  if (!status) return "pending";
  const value = status.toLowerCase();
  if (value === "completed" || value === "success" || value === "settled") return "success";
  if (["failed", "reversed", "rejected", "canceled", "cancelled"].includes(value)) return "failed";
  return "pending";
}
