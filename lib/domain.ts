import { Prisma, QuoteStatus, ReconciliationStatus, SettlementStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicSettlementId } from "@/lib/utils";
import { writeAuditLog } from "@/lib/audit";
import { quoteSchema, reconciliationSchema, settlementSchema, settingsSchema } from "@/lib/validators";

const RATE_BY_CORRIDOR = {
  INR_USDT: 83.5,
  USDT_INR: 83.15,
} as const;

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
  const quote = await prisma.quote.findFirstOrThrow({
    where: {
      id: data.quoteId,
      organizationId,
      status: QuoteStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
  });

  const settings = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } });
  const requiresApproval = quote.sourceAmount.greaterThanOrEqualTo(settings.approvalThreshold);
  const status = requiresApproval ? SettlementStatus.PENDING_APPROVAL : SettlementStatus.APPROVED;

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
        status,
      },
    });

    await tx.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.ACCEPTED },
    });

    await tx.settlementEvent.create({
      data: {
        settlementId: created.id,
        toStatus: status,
        actorId: userId,
        note: requiresApproval ? "Settlement requires checker approval." : "Auto-approved under threshold.",
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
) {
  const current = await prisma.settlement.findFirstOrThrow({
    where: { id: settlementId, organizationId },
  });

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
    before: current,
    after: updated,
  });

  return updated;
}

export async function createReconciliationRecord(input: unknown, userId: string, organizationId: string) {
  const data = reconciliationSchema.parse(input);
  const record = await prisma.reconciliationRecord.create({
    data: {
      organizationId,
      settlementId: data.settlementId || null,
      externalRef: data.externalRef,
      source: data.source,
      amount: new Prisma.Decimal(data.amount),
      currency: data.currency,
      valueDate: new Date(data.valueDate),
      status: data.status as ReconciliationStatus,
      exceptionReason: data.exceptionReason,
      rawPayload: data,
    },
  });

  if (record.settlementId && record.status === ReconciliationStatus.MATCHED) {
    await transitionSettlement(record.settlementId, SettlementStatus.RECONCILED, userId, organizationId, "Matched by reconciliation.");
  }

  await writeAuditLog({
    action: "reconciliation.create",
    resourceType: "reconciliation_record",
    resourceId: record.id,
    organizationId,
    userId,
    after: record,
  });

  return record;
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
