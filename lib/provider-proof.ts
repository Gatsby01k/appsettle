import "server-only";

import { AuditActorType, Prisma, ProofReceivedVia, type ProviderProof } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export type { ProviderProof };
export { ProofReceivedVia };

export type RecordProviderProofInput = {
  settlementId: string;
  organizationId: string;
  /** Actor recorded on the audit entry (settlement creator for webhooks). */
  userId: string;
  provider: string;
  providerTransactionId?: string | null;
  /** Bank UTR / external payment reference, when the provider supplies one. */
  utr?: string | null;
  providerStatus: string;
  /** The amount the provider claims was paid out, when reported. */
  actualAmount?: number | string | null;
  currency?: string | null;
  rawResponse?: unknown;
  receivedVia: ProofReceivedVia;
  actorType?: AuditActorType;
};

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asDecimal(value: number | string | null | undefined): Prisma.Decimal | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return new Prisma.Decimal(num);
}

/**
 * Persists an append-only provider proof row and writes a `provider.proof.recorded`
 * audit entry.
 *
 * Provider proof is evidence, not truth: a proof row with providerStatus
 * "completed" means the provider CLAIMS the payout completed. It never moves the
 * settlement lifecycle by itself — reconciliation against an independent source
 * and the audit trail must agree before finality review can pass (lib/finality.ts).
 *
 * IDEMPOTENT on the natural key (settlement + provider + transaction + status +
 * channel): re-delivered webhooks and repeated polls return the existing row
 * instead of duplicating evidence or audit entries. A *changed* provider status
 * is new evidence and gets its own row.
 *
 * Callers should record proof BEFORE applying any lifecycle transition so a
 * failed write leaves the settlement in a retryable state rather than settled
 * without evidence.
 */
export async function recordProviderProof(input: RecordProviderProofInput): Promise<ProviderProof> {
  const duplicate = await prisma.providerProof.findFirst({
    where: {
      settlementId: input.settlementId,
      provider: input.provider,
      providerTransactionId: input.providerTransactionId?.trim() || null,
      providerStatus: { equals: input.providerStatus.trim(), mode: "insensitive" },
      receivedVia: input.receivedVia,
    },
    orderBy: { receivedAt: "desc" },
  });
  if (duplicate) return duplicate;

  const proof = await prisma.providerProof.create({
    data: {
      settlementId: input.settlementId,
      provider: input.provider,
      providerTransactionId: input.providerTransactionId ?? null,
      utr: input.utr?.trim() || null,
      providerStatus: input.providerStatus,
      actualAmount: asDecimal(input.actualAmount),
      currency: input.currency ?? null,
      rawResponse: asJson(input.rawResponse),
      receivedVia: input.receivedVia,
    },
  });

  await writeAuditLog({
    action: "provider.proof.recorded",
    resourceType: "provider_proof",
    resourceId: proof.id,
    organizationId: input.organizationId,
    userId: input.userId,
    actorType: input.actorType ?? AuditActorType.SYSTEM,
    after: {
      settlementId: proof.settlementId,
      provider: proof.provider,
      providerTransactionId: proof.providerTransactionId,
      utr: proof.utr,
      providerStatus: proof.providerStatus,
      actualAmount: proof.actualAmount?.toString() ?? null,
      currency: proof.currency,
      receivedVia: proof.receivedVia,
    },
  });

  return proof;
}

/** Latest proof recorded for a settlement, or null when none exists yet. */
export async function latestProviderProof(settlementId: string): Promise<ProviderProof | null> {
  return prisma.providerProof.findFirst({
    where: { settlementId },
    orderBy: { receivedAt: "desc" },
  });
}
