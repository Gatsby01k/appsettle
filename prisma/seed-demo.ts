import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import {
  AuditActorType,
  Corridor,
  Prisma,
  PrismaClient,
  ProofReceivedVia,
  QuoteStatus,
  ReconciliationStatus,
  SettlementStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run the demo reset script.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

const DEMO_RATE = new Prisma.Decimal("83.15000000");
const DEMO_FEE_BPS = 45;

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function resolveDemoContext() {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!organization) {
    throw new Error(
      "No organization found. Run `npm run prisma:seed` first to create an organization and user.",
    );
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  if (!membership) {
    throw new Error(
      `No user/member found for organization "${organization.displayName}". Run \`npm run prisma:seed\` first.`,
    );
  }

  return { organization, user: membership.user };
}

async function deleteOldDemoRecords() {
  const deletedReconciliation = await prisma.reconciliationRecord.deleteMany({
    where: { externalRef: { startsWith: "DEMO-" } },
  });

  const deletedAuditLogs = await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { resourceId: { startsWith: "SET-DEMO" } },
        { action: { startsWith: "DEMO." } },
      ],
    },
  });

  const deletedSettlements = await prisma.settlement.deleteMany({
    where: {
      OR: [
        { publicId: { startsWith: "SET-DEMO" } },
        { reference: { startsWith: "DEMO-" } },
      ],
    },
  });

  return {
    settlements: deletedSettlements.count,
    reconciliation: deletedReconciliation.count,
    auditLogs: deletedAuditLogs.count,
  };
}

async function findOrCreateActiveQuote(
  organizationId: string,
  userId: string,
  expiresAt: Date,
) {
  const existing = await prisma.quote.findFirst({
    where: {
      organizationId,
      corridor: Corridor.USDT_INR,
      sourceCurrency: "USDT",
      targetCurrency: "INR",
      sourceAmount: new Prisma.Decimal("5000.00"),
      targetAmount: new Prisma.Decimal("415750.000000"),
      rate: DEMO_RATE,
      feeBps: DEMO_FEE_BPS,
      feeAmount: new Prisma.Decimal("22.50"),
      settlementWindow: "instant",
      status: QuoteStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return prisma.quote.update({
      where: { id: existing.id },
      data: { expiresAt },
    });
  }

  return prisma.quote.create({
    data: {
      organizationId,
      createdById: userId,
      corridor: Corridor.USDT_INR,
      sourceCurrency: "USDT",
      targetCurrency: "INR",
      sourceAmount: new Prisma.Decimal("5000.00"),
      targetAmount: new Prisma.Decimal("415750.000000"),
      rate: DEMO_RATE,
      feeBps: DEMO_FEE_BPS,
      feeAmount: new Prisma.Decimal("22.50"),
      settlementWindow: "instant",
      status: QuoteStatus.ACTIVE,
      expiresAt,
    },
  });
}

async function createCompletedProofSettlement(
  organizationId: string,
  userId: string,
  expiresAt: Date,
) {
  const approvedAt = hoursAgo(2);
  const executedAt = minutesAgo(90);
  const settledAt = minutesAgo(60);
  const reconciledAt = minutesAgo(30);
  const valueDate = new Date(settledAt);
  valueDate.setHours(0, 0, 0, 0);

  const providerResponse = {
    ok: true,
    data: {
      transaction_id: "sb_demo_pontis_001",
      status: "completed",
      status_message: "Payout settled successfully to INR Settlement Account.",
      source_amount: "10000.00",
      source_currency: "USDT",
      currency_code: "INR",
      payment_method: "bank_local",
    },
  } satisfies Prisma.InputJsonObject;

  const acceptedQuote = await prisma.quote.create({
    data: {
      organizationId,
      createdById: userId,
      corridor: Corridor.USDT_INR,
      sourceCurrency: "USDT",
      targetCurrency: "INR",
      sourceAmount: new Prisma.Decimal("10000.00"),
      targetAmount: new Prisma.Decimal("831500.000000"),
      rate: DEMO_RATE,
      feeBps: DEMO_FEE_BPS,
      feeAmount: new Prisma.Decimal("45.00"),
      settlementWindow: "instant",
      status: QuoteStatus.ACCEPTED,
      expiresAt,
    },
  });

  const settlement = await prisma.settlement.create({
    data: {
      publicId: "SET-DEMO-001",
      organizationId,
      quoteId: acceptedQuote.id,
      createdById: userId,
      reference: "DEMO-READY-001",
      corridor: Corridor.USDT_INR,
      sourceCurrency: "USDT",
      targetCurrency: "INR",
      sourceAmount: new Prisma.Decimal("10000.00"),
      targetAmount: new Prisma.Decimal("831500.000000"),
      feeAmount: new Prisma.Decimal("45.00"),
      status: SettlementStatus.RECONCILED,
      sourceAccount: "USDT Treasury Wallet",
      targetAccount: "INR Settlement Account",
      provider: "PontisGlobe",
      providerTransactionId: "sb_demo_pontis_001",
      providerStatus: "completed",
      providerResponse,
      approvedAt,
      executedAt,
      settledAt,
      reconciledAt,
    },
  });

  await prisma.settlementEvent.createMany({
    data: [
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.PENDING_APPROVAL,
        toStatus: SettlementStatus.APPROVED,
        actorId: userId,
        note: "Settlement approved by treasury manager for PontisGlobe execution.",
        createdAt: approvedAt,
      },
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.APPROVED,
        toStatus: SettlementStatus.EXECUTING,
        actorId: userId,
        note: "PontisGlobe payout submitted; provider acknowledged transaction sb_demo_pontis_001.",
        createdAt: executedAt,
      },
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.EXECUTING,
        toStatus: SettlementStatus.SETTLED,
        actorId: userId,
        note: "Provider confirmed payout completed; INR credited to beneficiary account.",
        createdAt: settledAt,
      },
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.SETTLED,
        toStatus: SettlementStatus.RECONCILED,
        actorId: userId,
        note: "Bank reconciliation record auto-matched; settlement marked reconciled.",
        createdAt: reconciledAt,
      },
    ],
  });

  // Structured provider proof (Phase 1A): the provider's own evidence of the
  // completed payout, received via webhook. One of the three independent
  // finality inputs.
  await prisma.providerProof.create({
    data: {
      settlementId: settlement.id,
      provider: "PontisGlobe",
      providerTransactionId: "sb_demo_pontis_001",
      utr: "UTR2606DEMO0001",
      providerStatus: "completed",
      actualAmount: new Prisma.Decimal("831500.00"),
      currency: "INR",
      rawResponse: providerResponse,
      receivedVia: ProofReceivedVia.WEBHOOK,
      receivedAt: settledAt,
    },
  });

  // Independent bank-statement record (source must be independent — never a
  // provider claim) matched to the settlement: the second finality input.
  const reconciliation = await prisma.reconciliationRecord.create({
    data: {
      organizationId,
      settlementId: settlement.id,
      externalRef: "DEMO-BANK-RECON-001",
      source: "bank_statement",
      amount: new Prisma.Decimal("831500.00"),
      currency: "INR",
      valueDate,
      status: ReconciliationStatus.MATCHED,
      rawPayload: {
        externalRef: "DEMO-BANK-RECON-001",
        source: "bank_statement",
        amount: 831500,
        currency: "INR",
        valueDate: valueDate.toISOString(),
        status: "MATCHED",
        providerTransactionId: "sb_demo_pontis_001",
        matchReason: "Amount, INR currency, and value date all match the settlement.",
        _matchOrigin: "AUTO",
      },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId,
        userId,
        actorType: AuditActorType.USER,
        action: "DEMO.SETTLEMENT.APPROVED",
        resourceType: "settlement",
        resourceId: "SET-DEMO-001",
        after: {
          publicId: "SET-DEMO-001",
          status: SettlementStatus.APPROVED,
          approvedAt: approvedAt.toISOString(),
        },
        createdAt: approvedAt,
      },
      {
        organizationId,
        userId,
        actorType: AuditActorType.API,
        action: "DEMO.PONTIS.PAYOUT.CREATED",
        resourceType: "settlement",
        resourceId: "SET-DEMO-001",
        after: {
          provider: "PontisGlobe",
          transactionId: "sb_demo_pontis_001",
          status: "processing",
        },
        createdAt: executedAt,
      },
      {
        organizationId,
        userId,
        actorType: AuditActorType.API,
        action: "DEMO.PONTIS.PAYOUT.STATUS_UPDATED",
        resourceType: "settlement",
        resourceId: "SET-DEMO-001",
        after: {
          provider: "PontisGlobe",
          transactionId: "sb_demo_pontis_001",
          status: "completed",
          outcome: "success",
        },
        createdAt: new Date(executedAt.getTime() + 5 * 60 * 1000),
      },
      {
        organizationId,
        userId,
        actorType: AuditActorType.SYSTEM,
        action: "DEMO.SETTLEMENT.SETTLED",
        resourceType: "settlement",
        resourceId: "SET-DEMO-001",
        after: {
          publicId: "SET-DEMO-001",
          status: SettlementStatus.SETTLED,
          settledAt: settledAt.toISOString(),
        },
        createdAt: settledAt,
      },
      {
        organizationId,
        userId,
        actorType: AuditActorType.SYSTEM,
        action: "DEMO.RECONCILIATION.AUTO_MATCHED",
        resourceType: "reconciliation_record",
        resourceId: reconciliation.id,
        after: {
          externalRef: "DEMO-BANK-RECON-001",
          settlementId: settlement.id,
          status: ReconciliationStatus.MATCHED,
          matchReason: "Amount, INR currency, and value date all match the settlement.",
        },
        createdAt: reconciledAt,
      },
      {
        organizationId,
        userId,
        actorType: AuditActorType.SYSTEM,
        action: "DEMO.AUDIT.PROOF_RECORDED",
        resourceType: "settlement",
        resourceId: "SET-DEMO-001",
        after: {
          publicId: "SET-DEMO-001",
          status: SettlementStatus.RECONCILED,
          reconciledAt: reconciledAt.toISOString(),
          proof: "completed-settlement-overview",
        },
        createdAt: reconciledAt,
      },
    ],
  });

  return settlement;
}

/**
 * Demo case 2 — "Needs review": the provider reported completed and structured
 * proof is on file, but NO independent reconciliation record is linked. The
 * payout may well have completed — but the claim is uncorroborated, so finality
 * must say needs_review, never ready_to_finalize.
 */
async function createNeedsReviewSettlement(organizationId: string, userId: string) {
  const approvedAt = hoursAgo(3);
  const executedAt = minutesAgo(150);
  const settledAt = minutesAgo(120);

  const providerResponse = {
    payout_id: 88003,
    merchantRecognitionId: "SET-DEMO-003",
    status: "success",
    utr: "UTR2606DEMO0003",
    amount: 415750,
  } satisfies Prisma.InputJsonObject;

  const settlement = await prisma.settlement.create({
    data: {
      publicId: "SET-DEMO-003",
      organizationId,
      createdById: userId,
      reference: "DEMO-REVIEW-003",
      corridor: Corridor.USDT_INR,
      sourceCurrency: "USDT",
      targetCurrency: "INR",
      sourceAmount: new Prisma.Decimal("5000.00"),
      targetAmount: new Prisma.Decimal("415750.000000"),
      feeAmount: new Prisma.Decimal("22.50"),
      status: SettlementStatus.SETTLED,
      sourceAccount: "USDT Treasury Wallet",
      targetAccount: "INR Settlement Account",
      provider: "remitquickly",
      providerTransactionId: "88003",
      providerStatus: "success",
      providerResponse,
      approvedAt,
      executedAt,
      settledAt,
    },
  });

  await prisma.settlementEvent.createMany({
    data: [
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.PENDING_APPROVAL,
        toStatus: SettlementStatus.APPROVED,
        actorId: userId,
        note: "Settlement approved by treasury manager.",
        createdAt: approvedAt,
      },
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.APPROVED,
        toStatus: SettlementStatus.EXECUTING,
        actorId: userId,
        note: "RemitQuickly payout 88003 submitted (merchantRecognitionId=SET-DEMO-003).",
        createdAt: executedAt,
      },
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.EXECUTING,
        toStatus: SettlementStatus.SETTLED,
        actorId: userId,
        note: "RemitQuickly payout 88003 reported successful (UTR UTR2606DEMO0003). Awaiting independent reconciliation.",
        createdAt: settledAt,
      },
    ],
  });

  await prisma.providerProof.create({
    data: {
      settlementId: settlement.id,
      provider: "remitquickly",
      providerTransactionId: "88003",
      utr: "UTR2606DEMO0003",
      providerStatus: "success",
      actualAmount: new Prisma.Decimal("415750.00"),
      currency: "INR",
      rawResponse: providerResponse,
      receivedVia: ProofReceivedVia.WEBHOOK,
      receivedAt: settledAt,
    },
  });

  // Deliberately NO reconciliation record: the bank statement has not been
  // ingested yet, so finality = needs_review (provider claim uncorroborated).

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      actorType: AuditActorType.SYSTEM,
      action: "DEMO.PROVIDER.PROOF_RECORDED",
      resourceType: "settlement",
      resourceId: "SET-DEMO-003",
      after: {
        publicId: "SET-DEMO-003",
        provider: "remitquickly",
        providerStatus: "success",
        utr: "UTR2606DEMO0003",
        reconciliation: "pending_independent_match",
      },
      createdAt: settledAt,
    },
  });

  return settlement;
}

/**
 * Demo case 3 — "High risk": the provider reported completed, but the proof is
 * missing a UTR and the independent bank record shows a DIFFERENT amount than
 * the settlement leg. Independent evidence contradicts the provider — finality
 * must flag high risk for operator investigation.
 */
async function createHighRiskSettlement(organizationId: string, userId: string) {
  const approvedAt = hoursAgo(5);
  const executedAt = minutesAgo(270);
  const settledAt = minutesAgo(240);
  const valueDate = new Date(settledAt);
  valueDate.setHours(0, 0, 0, 0);

  const providerResponse = {
    payout_id: 88004,
    merchantRecognitionId: "SET-DEMO-004",
    status: "success",
    amount: 249450,
  } satisfies Prisma.InputJsonObject;

  const settlement = await prisma.settlement.create({
    data: {
      publicId: "SET-DEMO-004",
      organizationId,
      createdById: userId,
      reference: "DEMO-RISK-004",
      corridor: Corridor.USDT_INR,
      sourceCurrency: "USDT",
      targetCurrency: "INR",
      sourceAmount: new Prisma.Decimal("3000.00"),
      targetAmount: new Prisma.Decimal("249450.000000"),
      feeAmount: new Prisma.Decimal("13.50"),
      status: SettlementStatus.SETTLED,
      sourceAccount: "USDT Treasury Wallet",
      targetAccount: "INR Settlement Account",
      provider: "remitquickly",
      providerTransactionId: "88004",
      providerStatus: "success",
      providerResponse,
      approvedAt,
      executedAt,
      settledAt,
    },
  });

  await prisma.settlementEvent.createMany({
    data: [
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.PENDING_APPROVAL,
        toStatus: SettlementStatus.APPROVED,
        actorId: userId,
        note: "Settlement approved by treasury manager.",
        createdAt: approvedAt,
      },
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.APPROVED,
        toStatus: SettlementStatus.EXECUTING,
        actorId: userId,
        note: "RemitQuickly payout 88004 submitted (merchantRecognitionId=SET-DEMO-004).",
        createdAt: executedAt,
      },
      {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.EXECUTING,
        toStatus: SettlementStatus.SETTLED,
        actorId: userId,
        note: "RemitQuickly payout 88004 reported successful (no UTR returned). Awaiting independent reconciliation.",
        createdAt: settledAt,
      },
    ],
  });

  // Proof completed but WITHOUT a UTR/bank reference.
  await prisma.providerProof.create({
    data: {
      settlementId: settlement.id,
      provider: "remitquickly",
      providerTransactionId: "88004",
      utr: null,
      providerStatus: "success",
      actualAmount: new Prisma.Decimal("249450.00"),
      currency: "INR",
      rawResponse: providerResponse,
      receivedVia: ProofReceivedVia.POLL,
      receivedAt: settledAt,
    },
  });

  // The bank statement shows a DIFFERENT amount (249,450 expected vs 247,950
  // received) — independent evidence contradicts the provider's claim. Seeded
  // directly as an UNMATCHED linked record; the domain layer would never match
  // these amounts.
  await prisma.reconciliationRecord.create({
    data: {
      organizationId,
      settlementId: settlement.id,
      externalRef: "DEMO-BANK-RECON-004",
      source: "bank_statement",
      amount: new Prisma.Decimal("247950.00"),
      currency: "INR",
      valueDate,
      status: ReconciliationStatus.UNMATCHED,
      exceptionReason: null,
      rawPayload: {
        externalRef: "DEMO-BANK-RECON-004",
        source: "bank_statement",
        amount: 247950,
        currency: "INR",
        valueDate: valueDate.toISOString(),
        status: "UNMATCHED",
        note: "Bank credit is 1,500.00 INR short of the expected settlement leg.",
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      actorType: AuditActorType.SYSTEM,
      action: "DEMO.RECONCILIATION.AMOUNT_MISMATCH",
      resourceType: "settlement",
      resourceId: "SET-DEMO-004",
      after: {
        publicId: "SET-DEMO-004",
        expectedAmount: 249450,
        bankAmount: 247950,
        currency: "INR",
        utr: null,
        note: "Independent bank record contradicts provider claim; operator investigation required.",
      },
      createdAt: settledAt,
    },
  });

  return settlement;
}

async function createApprovedLiveSettlement(organizationId: string, userId: string) {
  const approvedAt = minutesAgo(10);

  const settlement = await prisma.settlement.create({
    data: {
      publicId: "SET-DEMO-002",
      organizationId,
      createdById: userId,
      reference: "DEMO-PONTIS-EXECUTE-002",
      corridor: Corridor.USDT_INR,
      sourceCurrency: "USDT",
      targetCurrency: "INR",
      sourceAmount: new Prisma.Decimal("3000.00"),
      targetAmount: new Prisma.Decimal("249450.000000"),
      status: SettlementStatus.APPROVED,
      sourceAccount: "USDT Treasury Wallet",
      targetAccount: "INR Settlement Account",
      approvedAt,
    },
  });

  await prisma.settlementEvent.create({
    data: {
      settlementId: settlement.id,
      fromStatus: SettlementStatus.PENDING_APPROVAL,
      toStatus: SettlementStatus.APPROVED,
      actorId: userId,
      note: "Settlement approved and queued for live PontisGlobe execution during demo.",
      createdAt: approvedAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      actorType: AuditActorType.USER,
      action: "DEMO.SETTLEMENT.APPROVED",
      resourceType: "settlement",
      resourceId: "SET-DEMO-002",
      after: {
        publicId: "SET-DEMO-002",
        status: SettlementStatus.APPROVED,
        approvedAt: approvedAt.toISOString(),
      },
      createdAt: approvedAt,
    },
  });

  return settlement;
}

async function main() {
  const { organization, user } = await resolveDemoContext();
  const expiresAt = minutesFromNow(15);

  console.log(`Demo context: organization="${organization.displayName}" user="${user.name}" <${user.email}>`);

  const deleted = await deleteOldDemoRecords();
  console.log(
    `Deleted old demo records: settlements=${deleted.settlements} reconciliation=${deleted.reconciliation} auditLogs=${deleted.auditLogs}`,
  );

  await createCompletedProofSettlement(organization.id, user.id, expiresAt);
  console.log("Created SET-DEMO-001 (DEMO-READY-001): proof + independent match + approval -> Ready to finalize");

  await createApprovedLiveSettlement(organization.id, user.id);
  console.log("Created SET-DEMO-002 approved live demo settlement");

  await createNeedsReviewSettlement(organization.id, user.id);
  console.log("Created SET-DEMO-003 (DEMO-REVIEW-003): proof, no reconciliation -> Needs review");

  await createHighRiskSettlement(organization.id, user.id);
  console.log("Created SET-DEMO-004 (DEMO-RISK-004): proof w/o UTR + bank amount mismatch -> High risk");

  await findOrCreateActiveQuote(organization.id, user.id, expiresAt);
  console.log("Created active quote for Quotes page");

  console.log("Done");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
