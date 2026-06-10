import { NextRequest, NextResponse } from "next/server";
import { ProofReceivedVia } from "@prisma/client";
import { jsonError, requireApiContext } from "@/lib/api";
import { getOrderStatus, isRemitQuicklyConfigured } from "@/lib/providers/remitquickly/client";
import { applyPayoutResolution, mapPayoutStatus } from "@/lib/providers/remitquickly/settlement";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/providers/remitquickly/order-status/[id]
 *
 * Reads the live status for a provider payout id. Read-only by default. Pass
 * `?sync=1` to also apply the resolution to the matching settlement (move it to
 * SETTLED + reconcile, or FAIL it) — useful when a webhook was missed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  if (!isRemitQuicklyConfigured()) {
    return NextResponse.json({ error: "RemitQuickly is not configured." }, { status: 503 });
  }

  const { id } = await params;
  const searchBy = request.nextUrl.searchParams.get("by") === "merchantRecognitionId"
    ? "merchantRecognitionId"
    : "payout_id";
  const sync = request.nextUrl.searchParams.get("sync") === "1";

  try {
    const result = await getOrderStatus({ searchBy, searchValue: id });

    if (!result.ok) {
      return NextResponse.json(
        { error: "RemitQuickly could not return the order status.", data: result.data },
        { status: result.status },
      );
    }

    const record = Array.isArray((result.data as { data?: unknown[] })?.data)
      ? ((result.data as { data: Array<Record<string, unknown>> }).data[0] ?? null)
      : null;

    let resolution = null;
    if (sync && record) {
      const outcome = mapPayoutStatus(record.status as string | undefined);
      const merchantRecognitionId = record.merchantRecognitionId as string | undefined;

      if (outcome !== "pending" && merchantRecognitionId) {
        const settlement = await prisma.settlement.findFirst({
          where: { publicId: merchantRecognitionId, organizationId: context.organization.id },
        });
        if (settlement) {
          resolution = await applyPayoutResolution({
            settlement,
            outcome,
            userId: context.user.id,
            organizationId: context.organization.id,
            payoutId: record.payout_id as number | undefined,
            utr: (record.utr ?? record.reference) as string | undefined,
            comment: record.comment as string | undefined,
            providerStatus: record.status as string | undefined,
            actualAmount: typeof record.amount === "number" ? record.amount : Number(record.amount) || null,
            rawResponse: record,
            receivedVia: ProofReceivedVia.POLL,
          });
        }
      }
    }

    return NextResponse.json({ data: result.data, resolution });
  } catch (err) {
    return jsonError(err);
  }
}
