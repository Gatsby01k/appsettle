// Pure builder that assembles the deterministic finality input for a settlement
// from its persisted evidence (provider proofs, reconciliation records, and
// lifecycle events). Framework/Prisma-free so the API route, the settlements
// page, and unit tests all derive the EXACT same finality input — the UI and
// the endpoint can never disagree about why a settlement is (not) safe to
// finalize.

import type { FinalityInput, FinalitySafetyInput } from "@/lib/finality";
import { isIndependentReconciliationSource } from "@/lib/reconciliation";

/** number, numeric string, or Prisma Decimal (anything with a numeric toString). */
export type NumberLike = number | string | { toString(): string };

export type ProofLike = {
  provider: string;
  providerStatus: string;
  providerTransactionId?: string | null;
  utr?: string | null;
  /** Decimal/string/number tolerated; null when the provider reported nothing. */
  actualAmount?: NumberLike | null;
  currency?: string | null;
  receivedVia: string;
  receivedAt: Date | string;
};

export type ReconciliationLike = {
  status: string;
  externalRef: string;
  source: string;
  amount: NumberLike;
  currency: string;
};

export type EventLike = {
  toStatus: string;
};

export type SettlementLike = {
  publicId: string;
  status: string;
  /** DEMO (default) | SHADOW | LIVE_TEST. */
  mode?: string | null;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: NumberLike;
  targetAmount: NumberLike;
  approvedAt?: Date | string | null;
};

function toNumber(value: NumberLike): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function toNullableNumber(value: NumberLike | null | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = toNumber(value);
  return Number.isFinite(num) ? num : null;
}

/** Latest proof by receivedAt (ties broken by array order: later wins). */
export function latestProofOf<T extends ProofLike>(proofs: T[]): T | null {
  let latest: T | null = null;
  for (const proof of proofs) {
    if (!latest || new Date(proof.receivedAt).getTime() >= new Date(latest.receivedAt).getTime()) {
      latest = proof;
    }
  }
  return latest;
}

/**
 * The reconciliation record finality should judge, in order of preference:
 *  1. a MATCHED record from an INDEPENDENT source (the only kind that can
 *     satisfy finality),
 *  2. any other MATCHED record (e.g. a legacy provider_claim match — surfaced
 *     so finality can explain why it does not count),
 *  3. the first linked record (e.g. UNMATCHED / EXCEPTION) so contradictions
 *     stay visible instead of being hidden by "no record".
 */
export function relevantReconciliationOf<T extends ReconciliationLike>(records: T[]): T | null {
  return (
    records.find((record) => record.status === "MATCHED" && isIndependentReconciliationSource(record.source)) ??
    records.find((record) => record.status === "MATCHED") ??
    records[0] ??
    null
  );
}

/**
 * Audit approval evidence: the settlement carries an approval timestamp AND a
 * lifecycle event actually moved it to APPROVED. Both must be present — a
 * timestamp without a recorded transition (or vice versa) is not a complete
 * audit trail.
 */
export function hasAuditApproval(settlement: SettlementLike, events: EventLike[]): boolean {
  return Boolean(settlement.approvedAt) && events.some((event) => event.toStatus === "APPROVED");
}

/**
 * Assembles the full deterministic finality input for a settlement. For
 * SHADOW/LIVE_TEST settlements pass `safety` (from lib/shadow-mode.ts
 * `safetyFor`) — when omitted on a shadow settlement, finality blocks with
 * "safety not evaluated" rather than assuming the caps hold.
 */
export function buildFinalityInput(
  settlement: SettlementLike,
  proofs: ProofLike[],
  reconciliationRecords: ReconciliationLike[],
  events: EventLike[],
  safety?: FinalitySafetyInput | null,
): FinalityInput {
  const proof = latestProofOf(proofs);
  const reconciliation = relevantReconciliationOf(reconciliationRecords);

  return {
    mode: settlement.mode ?? "DEMO",
    safety: safety ?? null,
    settlement: {
      publicId: settlement.publicId,
      status: settlement.status,
      sourceCurrency: settlement.sourceCurrency,
      targetCurrency: settlement.targetCurrency,
      sourceAmount: toNumber(settlement.sourceAmount),
      targetAmount: toNumber(settlement.targetAmount),
    },
    proof: proof
      ? {
          provider: proof.provider,
          providerStatus: proof.providerStatus,
          providerTransactionId: proof.providerTransactionId ?? null,
          utr: proof.utr ?? null,
          actualAmount: toNullableNumber(proof.actualAmount),
          currency: proof.currency ?? null,
          receivedVia: proof.receivedVia,
        }
      : null,
    reconciliation: reconciliation
      ? {
          status: reconciliation.status,
          externalRef: reconciliation.externalRef,
          source: reconciliation.source,
          amount: toNumber(reconciliation.amount),
          currency: reconciliation.currency,
        }
      : null,
    auditApprovalPresent: hasAuditApproval(settlement, events),
  };
}
