import { NextRequest, NextResponse } from "next/server";
import { AuditActorType, ProofReceivedVia } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  decodeWebhookPayload,
  isRemitQuicklyConfigured,
  verifyWebhookSignature,
} from "@/lib/providers/remitquickly/client";
import { applyPayoutResolution, mapPayoutStatus } from "@/lib/providers/remitquickly/settlement";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/providers/remitquickly/webhook
 *
 * Public endpoint hit by RemitQuickly when a payout reaches a final state. The
 * request is authenticated by HMAC-SHA512 over the X-PAYOUT-PAYLOAD header; the
 * decoded payload carries the payout record. We map merchantRecognitionId back to
 * the settlement (publicId) and apply the resolution.
 *
 * Always returns 2xx for authentic, processed deliveries so the provider does not
 * retry a payload we have already handled.
 */
export async function POST(request: NextRequest) {
  if (!isRemitQuicklyConfigured()) {
    return NextResponse.json({ error: "RemitQuickly is not configured." }, { status: 503 });
  }

  // Consume the body so the connection closes cleanly even though the signed
  // payload travels in the headers.
  await request.text().catch(() => "");

  const payloadHeader = request.headers.get("x-payout-payload") ?? "";
  const signatureHeader = request.headers.get("x-payout-signature") ?? "";

  if (!payloadHeader || !signatureHeader) {
    return NextResponse.json({ error: "Missing webhook signature headers." }, { status: 400 });
  }

  if (!verifyWebhookSignature(payloadHeader, signatureHeader)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let record: Record<string, unknown>;
  try {
    record = decodeWebhookPayload(payloadHeader);
  } catch {
    return NextResponse.json({ error: "Malformed webhook payload." }, { status: 400 });
  }

  const merchantRecognitionId = record.merchantRecognitionId as string | undefined;
  const outcome = mapPayoutStatus(record.status as string | undefined);

  if (!merchantRecognitionId) {
    return NextResponse.json({ received: true, handled: false, reason: "no merchantRecognitionId" });
  }

  const settlement = await prisma.settlement.findUnique({
    where: { publicId: merchantRecognitionId },
  });

  if (!settlement) {
    await writeAuditLog({
      action: "remitquickly.webhook.unmatched",
      resourceType: "provider",
      resourceId: "remitquickly",
      actorType: AuditActorType.SYSTEM,
      after: { merchantRecognitionId, status: record.status },
    });
    return NextResponse.json({ received: true, handled: false, reason: "settlement not found" });
  }

  await writeAuditLog({
    action: "remitquickly.webhook.received",
    resourceType: "settlement",
    resourceId: settlement.id,
    organizationId: settlement.organizationId,
    actorType: AuditActorType.SYSTEM,
    after: {
      merchantRecognitionId,
      payoutId: record.payout_id,
      status: record.status,
      outcome,
    },
  });

  if (outcome === "pending") {
    return NextResponse.json({ received: true, handled: false, reason: "non-final status" });
  }

  try {
    const resolution = await applyPayoutResolution({
      settlement,
      outcome,
      // Webhooks have no interactive user; attribute the lifecycle event to the
      // settlement creator while tagging the audit log as a SYSTEM action.
      userId: settlement.createdById,
      organizationId: settlement.organizationId,
      payoutId: record.payout_id as number | undefined,
      utr: (record.utr ?? record.reference) as string | undefined,
      comment: record.comment as string | undefined,
      providerStatus: record.status as string | undefined,
      actualAmount: typeof record.amount === "number" ? record.amount : Number(record.amount) || null,
      rawResponse: record,
      receivedVia: ProofReceivedVia.WEBHOOK,
      actorType: AuditActorType.SYSTEM,
    });

    return NextResponse.json({ received: true, handled: true, resolution });
  } catch (error) {
    // Acknowledge receipt (we verified + recorded it) but surface the handling
    // problem so it is visible without forcing endless provider retries.
    return NextResponse.json({
      received: true,
      handled: false,
      error: error instanceof Error ? error.message : "resolution failed",
    });
  }
}
