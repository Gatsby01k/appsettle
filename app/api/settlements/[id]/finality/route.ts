import { NextRequest, NextResponse } from "next/server";
import { ReconciliationStatus } from "@prisma/client";
import { jsonError, requireApiContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assessFinality } from "@/lib/finality";

export const runtime = "nodejs";

/**
 * GET /api/settlements/[id]/finality
 *
 * Read-only finality review for a settlement. Returns the deterministic
 * assessment from lib/finality.ts built from the three independent inputs:
 * latest provider proof, the linked reconciliation record, and the audit
 * trail's approval evidence. Never mutates anything — this is the minimal
 * surface for verifying the Phase 1A flow before any finality UI exists.
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
        providerProofs: { orderBy: { receivedAt: "desc" }, take: 1 },
        reconciliation: { orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: "Settlement was not found." }, { status: 404 });
    }

    const proof = settlement.providerProofs[0] ?? null;

    // Prefer a MATCHED record; otherwise surface the most recent linked record
    // (e.g. an EXCEPTION/UNMATCHED one) so contradictions are visible.
    const linkedRecords = settlement.reconciliation;
    const reconciliation =
      linkedRecords.find((record) => record.status === ReconciliationStatus.MATCHED) ??
      linkedRecords[0] ??
      null;

    // Audit approval evidence: an approval timestamp plus a lifecycle event
    // that actually moved the settlement to APPROVED.
    const auditApprovalPresent =
      settlement.approvedAt !== null &&
      settlement.events.some((event) => event.toStatus === "APPROVED");

    const assessment = assessFinality({
      settlement: {
        publicId: settlement.publicId,
        status: settlement.status,
        sourceCurrency: settlement.sourceCurrency,
        targetCurrency: settlement.targetCurrency,
        sourceAmount: Number(settlement.sourceAmount),
        targetAmount: Number(settlement.targetAmount),
      },
      proof: proof
        ? {
            provider: proof.provider,
            providerStatus: proof.providerStatus,
            providerTransactionId: proof.providerTransactionId,
            utr: proof.utr,
            actualAmount: proof.actualAmount === null ? null : Number(proof.actualAmount),
            currency: proof.currency,
            receivedVia: proof.receivedVia,
          }
        : null,
      reconciliation: reconciliation
        ? {
            status: reconciliation.status,
            externalRef: reconciliation.externalRef,
            source: reconciliation.source,
            amount: Number(reconciliation.amount),
            currency: reconciliation.currency,
          }
        : null,
      auditApprovalPresent,
    });

    return NextResponse.json({
      data: {
        settlementId: settlement.id,
        publicId: settlement.publicId,
        status: settlement.status,
        assessment,
        inputs: {
          proof: proof
            ? {
                id: proof.id,
                provider: proof.provider,
                providerStatus: proof.providerStatus,
                providerTransactionId: proof.providerTransactionId,
                utr: proof.utr,
                actualAmount: proof.actualAmount?.toString() ?? null,
                currency: proof.currency,
                receivedVia: proof.receivedVia,
                receivedAt: proof.receivedAt.toISOString(),
              }
            : null,
          reconciliation: reconciliation
            ? {
                id: reconciliation.id,
                status: reconciliation.status,
                externalRef: reconciliation.externalRef,
                source: reconciliation.source,
                amount: reconciliation.amount.toString(),
                currency: reconciliation.currency,
              }
            : null,
          auditApprovalPresent,
        },
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
