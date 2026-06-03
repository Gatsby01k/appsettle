import { Prisma, QuoteStatus, ReconciliationStatus, SettlementStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicSettlementId } from "@/lib/utils";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import {
  AUTO_MATCH_MIN_CONFIDENCE,
  SUGGESTED_MIN_CONFIDENCE,
  computeConfidence,
  matchReasonFor,
  type MatchOrigin,
} from "@/lib/reconciliation";
import { quoteSchema, reconciliationSchema, settlementSchema, settingsSchema } from "@/lib/validators";

const RATE_BY_CORRIDOR = {
  INR_USDT: 83.5,
  USDT_INR: 83.15,
} as const;

function assertValidSettlementTransition(from: SettlementStatus, to: SettlementStatus) {
  const allowed: Record<SettlementStatus, SettlementStatus[]> = {
    [SettlementStatus.REQUESTED]: [SettlementStatus.APPROVED],
    [SettlementStatus.QUOTED]: [SettlementStatus.APPROVED],
    [SettlementStatus.PENDING_APPROVAL]: [SettlementStatus.APPROVED],
    [SettlementStatus.APPROVED]: [SettlementStatus.EXECUTING],
    [SettlementStatus.EXECUTING]: [SettlementStatus.SETTLED],
    [SettlementStatus.SETTLED]: [SettlementStatus.RECONCILED],
    [SettlementStatus.RECONCILED]: [],
    [SettlementStatus.FAILED]: [],
    [SettlementStatus.CANCELLED]: [],
    [SettlementStatus.ON_HOLD]: [],
  };

  if (!allowed[from].includes(to)) {
    throw new UserFacingError(`Cannot move settlement from ${from} to ${to}.`);
  }
}

export async function createQuote(input: unknown, userId: string, organizationId: string) {
  const data = quoteSchema.parse(input);
  const sourceCurrency = data.corridor === "INR_USDT" ? "INR" : "USDT";
  const targetCurrency = data.corridor === "INR_USDT" ? "USDT" : "INR";
  const rate = RATE_BY_CORRIDOR[data.corridor];
  const feeBps = 45;
  const feeAmount = data.sourceAmount * (feeBps / 10000);
  const targetAmount =
    data.corridor === "INR_USDT"
      ? (data.sourceAmount - feeAmount) / rate
      : (data.sourceAmount - feeAmount) * rate;

  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId } });
  const quote = await prisma.quote.create({
    data: {
      organizationId,
      createdById: userId,
      corridor: data.corridor,
      sourceCurrency,
      targetCurrency,
      sourceAmount: new Prisma.Decimal(data.sourceAmount),
      targetAmount: new Prisma.Decimal(targetAmount),
      rate: new Prisma.Decimal(rate),
      feeBps,
      feeAmount: new Prisma.Decimal(feeAmount),
      settlementWindow: data.settlementWindow,
      expiresAt: new Date(Date.now() + (settings?.quoteTtlSeconds ?? 900) * 1000),
    },
  });

  await writeAuditLog({
    action: "quote.create",
    resourceType: "quote",
    resourceId: quote.id,
    organizationId,
    userId,
    after: quote,
  });

  return quote;
}

export async function createSettlement(input: unknown, userId: string, organizationId: string) {
  const data = settlementSchema.parse(input);
  const quote = await prisma.quote.findFirst({
    where: {
      id: data.quoteId,
      organizationId,
      status: QuoteStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
  });

  if (!quote) {
    throw new UserFacingError("Selected quote is unavailable, expired, or does not belong to this organization.");
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: {
        publicId: publicSettlementId(),
        organizationId,
        createdById: userId,
        quoteId: quote.id,
        reference: data.reference,
        corridor: quote.corridor,
        sourceCurrency: quote.sourceCurrency,
        targetCurrency: quote.targetCurrency,
        sourceAmount: quote.sourceAmount,
        targetAmount: quote.targetAmount,
        feeAmount: quote.feeAmount,
        sourceAccount: data.sourceAccount,
        targetAccount: data.targetAccount,
        status: SettlementStatus.REQUESTED,
      },
    });

    await tx.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.ACCEPTED },
    });

    await tx.settlementEvent.create({
      data: {
        settlementId: created.id,
        toStatus: SettlementStatus.REQUESTED,
        actorId: userId,
        note: "Settlement created from accepted quote.",
      },
    });

    return created;
  });

  await writeAuditLog({
    action: "settlement.create",
    resourceType: "settlement",
    resourceId: settlement.id,
    organizationId,
    userId,
    after: settlement,
  });

  return settlement;
}

export async function transitionSettlement(
  settlementId: string,
  status: SettlementStatus,
  userId: string,
  organizationId: string,
  note?: string,
  options: { allowReconcile?: boolean } = {},
) {
  const current = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId },
  });

  if (!current) {
    throw new UserFacingError("Settlement was not found.");
  }

  assertValidSettlementTransition(current.status, status);

  if (status === SettlementStatus.RECONCILED && !options.allowReconcile) {
    throw new UserFacingError("Settlements can only be reconciled by a matched reconciliation record.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status,
        approvedAt: status === SettlementStatus.APPROVED ? new Date() : current.approvedAt,
        executedAt: status === SettlementStatus.EXECUTING ? new Date() : current.executedAt,
        settledAt: status === SettlementStatus.SETTLED ? new Date() : current.settledAt,
        reconciledAt: status === SettlementStatus.RECONCILED ? new Date() : current.reconciledAt,
      },
    });

    await tx.settlementEvent.create({
      data: {
        settlementId,
        fromStatus: current.status,
        toStatus: status,
        actorId: userId,
        note,
      },
    });

    return next;
  });

  await writeAuditLog({
    action: "settlement.transition",
    resourceType: "settlement",
    resourceId: settlementId,
    organizationId,
    userId,
    before: {
      id: current.id,
      publicId: current.publicId,
      reference: current.reference,
      status: current.status,
    },
    after: {
      id: updated.id,
      publicId: updated.publicId,
      reference: updated.reference,
      fromStatus: current.status,
      toStatus: updated.status,
    },
  });

  return updated;
}

const AUTO_REF_PREFIX = "BANK-AUTO-";

/**
 * Generates the next sequential auto external reference for an organization
 * (BANK-AUTO-001, BANK-AUTO-002, ...). Used when an operator leaves the external
 * reference blank so reconciliation feels like a matching engine, not data entry.
 */
async function generateExternalRef(organizationId: string): Promise<string> {
  const existing = await prisma.reconciliationRecord.findMany({
    where: { organizationId, externalRef: { startsWith: AUTO_REF_PREFIX } },
    select: { externalRef: true },
  });

  let max = 0;
  for (const { externalRef } of existing) {
    const parsed = Number.parseInt(externalRef.slice(AUTO_REF_PREFIX.length), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }

  return `${AUTO_REF_PREFIX}${String(max + 1).padStart(3, "0")}`;
}

export async function createReconciliationRecord(input: unknown, userId: string, organizationId: string) {
  const data = reconciliationSchema.parse(input);
  const externalRef =
    data.externalRef && data.externalRef.trim()
      ? data.externalRef.trim()
      : await generateExternalRef(organizationId);
  const matchedSettlement = data.settlementId
    ? await prisma.settlement.findFirst({
        where: {
          id: data.settlementId,
          organizationId,
        },
      })
    : null;

  if (data.settlementId && !matchedSettlement) {
    throw new UserFacingError("Selected settlement was not found for this organization.");
  }

  if (data.status === "MATCHED" && !matchedSettlement) {
    throw new UserFacingError("A MATCHED reconciliation record must be linked to a settlement.");
  }

  if (data.status === "MATCHED" && data.exceptionReason) {
    throw new UserFacingError("A MATCHED reconciliation record cannot include an exception reason.");
  }

  if (data.status === "EXCEPTION" && matchedSettlement) {
    throw new UserFacingError("An EXCEPTION reconciliation record cannot be linked to a settlement.");
  }

  if (data.status === "UNMATCHED" && matchedSettlement) {
    throw new UserFacingError("An UNMATCHED reconciliation record cannot be linked to a settlement.");
  }

  if (data.status === "MATCHED" && matchedSettlement?.status !== SettlementStatus.SETTLED) {
    throw new UserFacingError("Only SETTLED settlements can be matched for reconciliation.");
  }

  const existing = await prisma.reconciliationRecord.findFirst({
    where: {
      organizationId,
      source: data.source,
      externalRef,
    },
  });

  if (existing) {
    throw new UserFacingError("A reconciliation record with this external reference already exists for this source.");
  }

  // A manual match (operator picks a settlement at create time) is an explicit,
  // operator-driven reconciliation — tag its origin so the UI never labels it "Auto".
  const isManualMatch = data.status === "MATCHED" && Boolean(matchedSettlement);
  const payloadData = { ...data, externalRef };
  const rawPayload: Prisma.InputJsonValue = isManualMatch
    ? ({ ...payloadData, _matchOrigin: "MANUAL" } as Prisma.InputJsonValue)
    : (payloadData as Prisma.InputJsonValue);

  const record = await prisma.reconciliationRecord.create({
    data: {
      organizationId,
      settlementId: matchedSettlement?.id || null,
      externalRef,
      source: data.source,
      amount: new Prisma.Decimal(data.amount),
      currency: data.currency,
      valueDate: new Date(data.valueDate),
      status: data.status as ReconciliationStatus,
      exceptionReason: data.exceptionReason,
      rawPayload,
    },
  });

  if (record.settlementId && record.status === ReconciliationStatus.MATCHED) {
    await transitionSettlement(
      record.settlementId,
      SettlementStatus.RECONCILED,
      userId,
      organizationId,
      "Matched by reconciliation.",
      { allowReconcile: true },
    );
  }

  await writeAuditLog({
    action: "reconciliation.create",
    resourceType: "reconciliation_record",
    resourceId: record.id,
    organizationId,
    userId,
    after: {
      id: record.id,
      status: record.status,
      externalRef: record.externalRef,
      source: record.source,
      amount: record.amount.toString(),
      currency: record.currency,
      settlementId: record.settlementId,
      settlementPublicId: matchedSettlement?.publicId,
      settlementReference: matchedSettlement?.reference,
    },
  });

  return record;
}

/**
 * Demo helper: creates a realistic OPEN external record that mirrors the latest
 * SETTLED (not-yet-reconciled) settlement's leg amount, currency, and value date so
 * the auto-match engine can reconcile it on the next run. It deliberately does NOT
 * link the settlement — that is the engine's (or operator's) job.
 */
export async function createMatchingDemoRecord(source: string, userId: string, organizationId: string) {
  const settled = await prisma.settlement.findMany({
    where: { organizationId, status: SettlementStatus.SETTLED },
  });

  if (settled.length === 0) {
    throw new UserFacingError(
      "No SETTLED settlement is waiting to be reconciled. Settle a settlement first, then create a matching record.",
    );
  }

  // Latest SETTLED settlement (by settle time, falling back to creation time).
  const settlement = settled
    .slice()
    .sort((a, b) => {
      const aDate = (a.settledAt ?? a.createdAt).getTime();
      const bDate = (b.settledAt ?? b.createdAt).getTime();
      return bDate - aDate;
    })[0];

  const refDate = settlement.settledAt ?? settlement.createdAt;

  // Use the full ISO timestamp so the generated value date is the *same day* as the
  // settlement's reference date regardless of timezone, guaranteeing a 100% match.
  return createReconciliationRecord(
    {
      externalRef: "",
      source,
      amount: Number(settlement.sourceAmount),
      currency: settlement.sourceCurrency,
      valueDate: new Date(refDate).toISOString(),
      status: "OPEN",
    },
    userId,
    organizationId,
  );
}

/**
 * Demo helper: creates an external record that intentionally matches no settlement
 * and is flagged as an EXCEPTION for manual review, with a realistic reason.
 */
export async function createExceptionDemoRecord(userId: string, organizationId: string) {
  // A deliberately unusual amount so it never matches a real settlement leg.
  const amount = Math.round((4000 + Math.random() * 6000) * 100) / 100;
  return createReconciliationRecord(
    {
      externalRef: "",
      source: "bank_statement",
      amount,
      currency: "INR",
      valueDate: new Date().toISOString(),
      status: "EXCEPTION",
      exceptionReason: "Unidentified bank credit with no matching settlement reference.",
    },
    userId,
    organizationId,
  );
}

type SettlementCandidate = {
  id: string;
  publicId: string;
  reference: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: Prisma.Decimal;
  targetAmount: Prisma.Decimal;
  settledAt: Date | null;
  createdAt: Date;
};

type RecordForMatch = {
  amount: Prisma.Decimal;
  currency: string;
  valueDate: Date;
};

/** Settlement IDs an operator has explicitly rejected for a record (stored in rawPayload). */
export function rejectedSettlementIdsOf(rawPayload: Prisma.JsonValue | null | undefined): string[] {
  if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    const value = (rawPayload as Record<string, unknown>)._rejectedSettlementIds;
    if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string");
  }
  return [];
}

/** How a linked record was matched (stored in rawPayload): "AUTO" by the engine, "MANUAL" by an operator. */
export function matchOriginOf(rawPayload: Prisma.JsonValue | null | undefined): MatchOrigin | null {
  if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    const value = (rawPayload as Record<string, unknown>)._matchOrigin;
    if (value === "AUTO" || value === "MANUAL") return value;
  }
  return null;
}

function baseRawPayload(rawPayload: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
    ? (rawPayload as Record<string, unknown>)
    : {};
}

/**
 * Finds the highest-confidence settlement candidate for a record using
 * amount + currency + value date. Returns null when nothing meets `minConfidence`.
 */
export function bestSettlementMatch<T extends SettlementCandidate>(
  record: RecordForMatch,
  candidates: T[],
  options: { excludeSettlementIds?: Set<string>; usedSettlementIds?: Set<string>; minConfidence?: number } = {},
): { settlement: T; confidence: number } | null {
  const min = options.minConfidence ?? SUGGESTED_MIN_CONFIDENCE;
  let best: { settlement: T; confidence: number } | null = null;

  for (const settlement of candidates) {
    if (options.excludeSettlementIds?.has(settlement.id)) continue;
    if (options.usedSettlementIds?.has(settlement.id)) continue;
    const confidence = computeConfidence(Number(record.amount), record.currency, record.valueDate, {
      sourceCurrency: settlement.sourceCurrency,
      targetCurrency: settlement.targetCurrency,
      sourceAmount: Number(settlement.sourceAmount),
      targetAmount: Number(settlement.targetAmount),
      refDate: settlement.settledAt ?? settlement.createdAt,
    });
    if (confidence >= min && (!best || confidence > best.confidence)) {
      best = { settlement, confidence };
    }
  }

  return best;
}

/**
 * Auto-reconciliation engine. Scans the open/unmatched queue and only auto-links
 * records that match a SETTLED settlement at 100% confidence (amount + currency +
 * value date). Exact matches are linked, marked MATCHED, the settlement transitions
 * SETTLED -> RECONCILED, and a reconciliation.auto_match audit event is written —
 * with no operator action required. Lower-confidence candidates are intentionally
 * left for operator review (Confirm / Reject) and are not touched here.
 */
export async function autoMatchReconciliation(userId: string, organizationId: string) {
  const open = await prisma.reconciliationRecord.findMany({
    where: {
      organizationId,
      settlementId: null,
      status: { in: [ReconciliationStatus.OPEN, ReconciliationStatus.UNMATCHED] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (open.length === 0) return { matched: 0, scanned: 0 };

  const candidates = await prisma.settlement.findMany({
    where: { organizationId, status: SettlementStatus.SETTLED },
  });

  const used = new Set<string>();
  let matched = 0;

  for (const record of open) {
    const rejected = new Set(rejectedSettlementIdsOf(record.rawPayload));

    // Exact (100%) candidates: same amount + same currency + same value date, SETTLED,
    // and neither previously rejected nor already consumed in this run.
    const exactMatches = candidates.filter((settlement) => {
      if (rejected.has(settlement.id) || used.has(settlement.id)) return false;
      const confidence = computeConfidence(Number(record.amount), record.currency, record.valueDate, {
        sourceCurrency: settlement.sourceCurrency,
        targetCurrency: settlement.targetCurrency,
        sourceAmount: Number(settlement.sourceAmount),
        targetAmount: Number(settlement.targetAmount),
        refDate: settlement.settledAt ?? settlement.createdAt,
      });
      return confidence >= AUTO_MATCH_MIN_CONFIDENCE;
    });

    // Only auto-reconcile when exactly one unambiguous 100% match exists. Zero (no
    // match) or more than one (ambiguous) are left for operator review.
    if (exactMatches.length !== 1) continue;

    const settlement = exactMatches[0];
    used.add(settlement.id);

    await prisma.reconciliationRecord.update({
      where: { id: record.id },
      data: {
        status: ReconciliationStatus.MATCHED,
        settlementId: settlement.id,
        rawPayload: { ...baseRawPayload(record.rawPayload), _matchOrigin: "AUTO" } as Prisma.InputJsonValue,
      },
    });

    await transitionSettlement(
      settlement.id,
      SettlementStatus.RECONCILED,
      userId,
      organizationId,
      `Auto-matched (100%) to ${record.externalRef}`,
      { allowReconcile: true },
    );

    await writeAuditLog({
      action: "reconciliation.auto_match",
      resourceType: "reconciliation_record",
      resourceId: record.id,
      organizationId,
      userId,
      after: {
        confidence: AUTO_MATCH_MIN_CONFIDENCE,
        matchReason: matchReasonFor(AUTO_MATCH_MIN_CONFIDENCE, record.currency),
        externalRef: record.externalRef,
        settlementId: settlement.id,
        settlementPublicId: settlement.publicId,
        settlementReference: settlement.reference,
      },
    });

    matched += 1;
  }

  return { matched, scanned: open.length };
}

/**
 * Operator confirms a suggested (sub-100%) match. Links the record to the
 * settlement, marks it MATCHED, transitions the settlement to RECONCILED, and
 * writes an audit trail capturing the confidence and reason at confirmation time.
 */
export async function confirmReconciliationMatch(
  recordId: string,
  settlementId: string,
  userId: string,
  organizationId: string,
) {
  const record = await prisma.reconciliationRecord.findFirst({
    where: { id: recordId, organizationId },
  });
  if (!record) {
    throw new UserFacingError("Reconciliation record was not found.");
  }
  if (record.settlementId) {
    throw new UserFacingError("This record is already linked to a settlement.");
  }
  if (record.status === ReconciliationStatus.EXCEPTION) {
    throw new UserFacingError("Exception records cannot be matched until the exception is resolved.");
  }

  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId },
  });
  if (!settlement) {
    throw new UserFacingError("Suggested settlement was not found for this organization.");
  }
  if (settlement.status !== SettlementStatus.SETTLED) {
    throw new UserFacingError("Only SETTLED settlements can be matched for reconciliation.");
  }

  const confidence = computeConfidence(Number(record.amount), record.currency, record.valueDate, {
    sourceCurrency: settlement.sourceCurrency,
    targetCurrency: settlement.targetCurrency,
    sourceAmount: Number(settlement.sourceAmount),
    targetAmount: Number(settlement.targetAmount),
    refDate: settlement.settledAt ?? settlement.createdAt,
  });
  if (confidence <= 0) {
    throw new UserFacingError("This settlement no longer matches the record's amount and currency.");
  }

  await prisma.reconciliationRecord.update({
    where: { id: record.id },
    data: {
      status: ReconciliationStatus.MATCHED,
      settlementId: settlement.id,
      rawPayload: { ...baseRawPayload(record.rawPayload), _matchOrigin: "MANUAL" } as Prisma.InputJsonValue,
    },
  });

  await transitionSettlement(
    settlement.id,
    SettlementStatus.RECONCILED,
    userId,
    organizationId,
    `Operator-confirmed match (${confidence}%) to ${record.externalRef}`,
    { allowReconcile: true },
  );

  await writeAuditLog({
    action: "reconciliation.confirm_match",
    resourceType: "reconciliation_record",
    resourceId: record.id,
    organizationId,
    userId,
    after: {
      confidence,
      matchReason: matchReasonFor(confidence, record.currency),
      externalRef: record.externalRef,
      settlementId: settlement.id,
      settlementPublicId: settlement.publicId,
      settlementReference: settlement.reference,
    },
  });

  return { recordId: record.id, settlementId: settlement.id, confidence };
}

/**
 * Operator rejects a suggested match. The record stays in manual review and the
 * rejected settlement is remembered (in rawPayload) so auto-match and the
 * suggestion panel never propose it again.
 */
export async function rejectReconciliationSuggestion(
  recordId: string,
  settlementId: string,
  userId: string,
  organizationId: string,
) {
  const record = await prisma.reconciliationRecord.findFirst({
    where: { id: recordId, organizationId },
  });
  if (!record) {
    throw new UserFacingError("Reconciliation record was not found.");
  }
  if (record.settlementId) {
    throw new UserFacingError("This record is already linked and cannot reject a suggestion.");
  }

  const rejected = new Set(rejectedSettlementIdsOf(record.rawPayload));
  rejected.add(settlementId);

  await prisma.reconciliationRecord.update({
    where: { id: record.id },
    data: {
      status: ReconciliationStatus.UNMATCHED,
      rawPayload: {
        ...baseRawPayload(record.rawPayload),
        _rejectedSettlementIds: Array.from(rejected),
      } as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    action: "reconciliation.reject_match",
    resourceType: "reconciliation_record",
    resourceId: record.id,
    organizationId,
    userId,
    after: {
      externalRef: record.externalRef,
      rejectedSettlementId: settlementId,
      rejectedSettlementIds: Array.from(rejected),
    },
  });

  return { recordId: record.id, rejectedSettlementId: settlementId };
}

/**
 * Operator resolves an EXCEPTION record after reviewing it. The record moves from
 * EXCEPTION to RESOLVED so it drops off the exceptions queue / dashboard alert. It
 * never links a settlement and never reconciles one — resolving simply marks the
 * exception as reviewed.
 */
export async function resolveReconciliationException(
  recordId: string,
  userId: string,
  organizationId: string,
  note?: string,
) {
  const record = await prisma.reconciliationRecord.findFirst({
    where: { id: recordId, organizationId },
  });
  if (!record) {
    throw new UserFacingError("Reconciliation record was not found.");
  }
  if (record.status !== ReconciliationStatus.EXCEPTION) {
    throw new UserFacingError("Only EXCEPTION records can be resolved.");
  }

  const resolutionNote = note?.trim() || "Marked reviewed by operator.";

  const updated = await prisma.reconciliationRecord.update({
    where: { id: record.id },
    data: {
      status: ReconciliationStatus.RESOLVED,
      rawPayload: {
        ...baseRawPayload(record.rawPayload),
        _resolutionNote: resolutionNote,
      } as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    action: "reconciliation.resolve_exception",
    resourceType: "reconciliation_record",
    resourceId: record.id,
    organizationId,
    userId,
    before: { id: record.id, status: record.status, exceptionReason: record.exceptionReason },
    after: { id: updated.id, status: updated.status, resolutionNote },
  });

  return updated;
}

export async function updateSettings(input: unknown, userId: string, organizationId: string) {
  const data = settingsSchema.parse(input);
  const before = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { settings: true },
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: { displayName: data.displayName },
    });

    return tx.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        approvalThreshold: new Prisma.Decimal(data.approvalThreshold),
        quoteTtlSeconds: data.quoteTtlSeconds,
        reconciliationEmail: data.reconciliationEmail || null,
        webhookUrl: data.webhookUrl || null,
      },
      update: {
        approvalThreshold: new Prisma.Decimal(data.approvalThreshold),
        quoteTtlSeconds: data.quoteTtlSeconds,
        reconciliationEmail: data.reconciliationEmail || null,
        webhookUrl: data.webhookUrl || null,
      },
    });
  });

  await writeAuditLog({
    action: "settings.update",
    resourceType: "organization_settings",
    resourceId: updated.id,
    organizationId,
    userId,
    before,
    after: updated,
  });

  return updated;
}
