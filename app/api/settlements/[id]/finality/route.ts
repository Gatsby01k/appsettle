import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireApiContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assessFinality } from "@/lib/finality";
import { buildFinalityInput } from "@/lib/finality-input";

export const runtime = "nodejs";

/**
 * GET /api/settlements/[id]/finality
 *
 * Read-only "Proof-to-Settlement" case file for a settlement:
 *  - settlement summary
 *  - every provider proof record (append-only evidence)
 *  - reconciliation records linked to the settlement
 *  - lifecycle/audit events
 *  - the deterministic finality assessment from lib/finality.ts
 *
 * Never mutates anything. The assessment input is built by the same shared
 * builder the dashboard uses (lib/finality-input.ts), so API and UI always
 * agree.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  const { id } = await params;

  try {
    const settlement = await prisma.settlement.findFirst({
      where: { id, organizationId: context.organization.id },
      include: {
        providerProofs: { orderBy: { receivedAt: "desc" } },
        reconciliation: { orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: "Settlement was not found." }, { status: 404 });
    }

    const assessment = assessFinality(
      buildFinalityInput(settlement, settlement.providerProofs, settlement.reconciliation, settlement.events),
    );

    return NextResponse.json({
      data: {
        settlement: {
          id: settlement.id,
          publicId: settlement.publicId,
          reference: settlement.reference,
          corridor: settlement.corridor,
          status: settlement.status,
          sourceAmount: settlement.sourceAmount.toString(),
          sourceCurrency: settlement.sourceCurrency,
          targetAmount: settlement.targetAmount.toString(),
          targetCurrency: settlement.targetCurrency,
          feeAmount: settlement.feeAmount.toString(),
          provider: settlement.provider,
          providerTransactionId: settlement.providerTransactionId,
          providerStatus: settlement.providerStatus,
          createdAt: settlement.createdAt.toISOString(),
          approvedAt: settlement.approvedAt?.toISOString() ?? null,
          settledAt: settlement.settledAt?.toISOString() ?? null,
          reconciledAt: settlement.reconciledAt?.toISOString() ?? null,
        },
        providerProofs: settlement.providerProofs.map((proof) => ({
          id: proof.id,
          provider: proof.provider,
          providerStatus: proof.providerStatus,
          providerTransactionId: proof.providerTransactionId,
          utr: proof.utr,
          actualAmount: proof.actualAmount?.toString() ?? null,
          currency: proof.currency,
          receivedVia: proof.receivedVia,
          receivedAt: proof.receivedAt.toISOString(),
        })),
        reconciliation: settlement.reconciliation.map((record) => ({
          id: record.id,
          status: record.status,
          externalRef: record.externalRef,
          source: record.source,
          amount: record.amount.toString(),
          currency: record.currency,
          valueDate: record.valueDate.toISOString(),
          exceptionReason: record.exceptionReason,
        })),
        auditEvents: settlement.events.map((event) => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          note: event.note,
          createdAt: event.createdAt.toISOString(),
        })),
        finality: assessment,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
