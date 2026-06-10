// Pure settlement lifecycle rules (no framework/Prisma-client coupling beyond
// the generated enum) so they can be unit-tested and shared by the domain
// layer. Extracted verbatim from lib/domain.ts — the transition table is
// behavior-identical.

import { SettlementStatus } from "@prisma/client";
import { UserFacingError } from "@/lib/errors";

/**
 * The canonical settlement state machine. RECONCILED is intentionally only
 * reachable from SETTLED (and, at the domain layer, only via a matched
 * reconciliation record): a provider-reported "completed" payout is never, by
 * itself, a reconciled settlement.
 */
export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  [SettlementStatus.REQUESTED]: [SettlementStatus.APPROVED],
  [SettlementStatus.QUOTED]: [SettlementStatus.APPROVED],
  [SettlementStatus.PENDING_APPROVAL]: [SettlementStatus.APPROVED],
  [SettlementStatus.APPROVED]: [SettlementStatus.EXECUTING, SettlementStatus.FAILED],
  [SettlementStatus.EXECUTING]: [SettlementStatus.SETTLED, SettlementStatus.FAILED],
  [SettlementStatus.SETTLED]: [SettlementStatus.RECONCILED],
  [SettlementStatus.RECONCILED]: [],
  [SettlementStatus.FAILED]: [],
  [SettlementStatus.CANCELLED]: [],
  [SettlementStatus.ON_HOLD]: [],
};

export function isValidSettlementTransition(from: SettlementStatus, to: SettlementStatus): boolean {
  return SETTLEMENT_TRANSITIONS[from].includes(to);
}

export function assertValidSettlementTransition(from: SettlementStatus, to: SettlementStatus) {
  if (!isValidSettlementTransition(from, to)) {
    throw new UserFacingError(`Cannot move settlement from ${from} to ${to}.`);
  }
}
