import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReconciliationStatus, SettlementStatus } from "@prisma/client";

type MockQuote = {
  id: string;
  organizationId: string;
  status: string;
  expiresAt: Date;
  [key: string]: unknown;
};

type MockSettlement = {
  id: string;
  organizationId: string;
  publicId: string;
  reference: string;
  status: string;
  [key: string]: unknown;
};

type MockRecord = {
  id: string;
  organizationId?: string;
  source?: string;
  externalRef?: string;
  [key: string]: unknown;
};

const mock = vi.hoisted(() => {
  let id = 1;
  const nextId = (prefix: string) => `${prefix}_${id++}`;

  const store = {
    quotes: [] as MockQuote[],
    settlements: [] as MockSettlement[],
    settlementEvents: [] as MockRecord[],
    reconciliationRecords: [] as MockRecord[],
    auditLogs: [] as MockRecord[],
    settings: {
      organizationId: "org_1",
      approvalThreshold: "100000000",
      quoteTtlSeconds: 900,
    },
  };

  const prisma = {
    organizationSettings: {
      findUnique: vi.fn(async () => store.settings),
      findUniqueOrThrow: vi.fn(async () => store.settings),
    },
    quote: {
      create: vi.fn(async ({ data }) => {
        const quote = {
          id: nextId("quote"),
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.quotes.push(quote);
        return quote;
      }),
      findFirst: vi.fn(async ({ where }) => {
        return store.quotes.find((quote) => {
          return quote.id === where.id &&
            quote.organizationId === where.organizationId &&
            (!where.status || quote.status === where.status) &&
            (!where.expiresAt?.gt || quote.expiresAt > where.expiresAt.gt);
        }) ?? null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const quote = store.quotes.find((item) => item.id === where.id);
        if (!quote) throw new Error("Quote not found");
        Object.assign(quote, data);
        return quote;
      }),
    },
    settlement: {
      create: vi.fn(async ({ data }) => {
        const settlement = {
          id: nextId("settlement"),
          publicId: `SET-${id}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.settlements.push(settlement);
        return settlement;
      }),
      findFirst: vi.fn(async ({ where }) => {
        return store.settlements.find((settlement) => {
          return settlement.id === where.id && settlement.organizationId === where.organizationId;
        }) ?? null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const settlement = store.settlements.find((item) => item.id === where.id);
        if (!settlement) throw new Error("Settlement not found");
        Object.assign(settlement, data);
        return settlement;
      }),
    },
    settlementEvent: {
      create: vi.fn(async ({ data }) => {
        const event = { id: nextId("event"), createdAt: new Date(), ...data };
        store.settlementEvents.push(event);
        return event;
      }),
    },
    reconciliationRecord: {
      findFirst: vi.fn(async ({ where }) => {
        return store.reconciliationRecords.find((record) => {
          return record.organizationId === where.organizationId &&
            record.source === where.source &&
            record.externalRef === where.externalRef;
        }) ?? null;
      }),
      create: vi.fn(async ({ data }) => {
        const record = { id: nextId("recon"), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.reconciliationRecords.push(record);
        return record;
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }) => {
        const log = { id: nextId("audit"), createdAt: new Date(), ...data };
        store.auditLogs.push(log);
        return log;
      }),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };

  return { store, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mock.prisma }));

describe("settlement and reconciliation workflow", () => {
  beforeEach(() => {
    mock.store.quotes.length = 0;
    mock.store.settlements.length = 0;
    mock.store.settlementEvents.length = 0;
    mock.store.reconciliationRecords.length = 0;
    mock.store.auditLogs.length = 0;
    vi.clearAllMocks();
  });

  it("covers Quote -> Settlement -> Approval -> Execute -> Settle -> Reconcile", async () => {
    const { createQuote, createSettlement, transitionSettlement, createReconciliationRecord } = await import("@/lib/domain");

    const quote = await createQuote({
      corridor: "INR_USDT",
      sourceAmount: 2500000,
      settlementWindow: "same_day",
    }, "user_1", "org_1");

    expect(quote.status).toBe("ACTIVE");

    const settlement = await createSettlement({
      quoteId: quote.id,
      reference: "psp_batch_1842",
      sourceAccount: "INR treasury",
      targetAccount: "USDT wallet",
    }, "user_1", "org_1");

    expect(settlement.status).toBe(SettlementStatus.REQUESTED);
    expect(mock.store.quotes[0].status).toBe("ACCEPTED");

    const approved = await transitionSettlement(settlement.id, SettlementStatus.APPROVED, "user_1", "org_1");
    expect(approved.status).toBe(SettlementStatus.APPROVED);

    const executing = await transitionSettlement(settlement.id, SettlementStatus.EXECUTING, "user_1", "org_1");
    expect(executing.status).toBe(SettlementStatus.EXECUTING);

    const settled = await transitionSettlement(settlement.id, SettlementStatus.SETTLED, "user_1", "org_1");
    expect(settled.status).toBe(SettlementStatus.SETTLED);

    const record = await createReconciliationRecord({
      externalRef: "bank_ref_001",
      source: "bank_statement",
      amount: 2500000,
      currency: "INR",
      settlementId: settlement.id,
      valueDate: "2026-06-02",
      status: ReconciliationStatus.MATCHED,
    }, "user_1", "org_1");

    expect(record.status).toBe(ReconciliationStatus.MATCHED);
    expect(mock.store.settlements[0].status).toBe(SettlementStatus.RECONCILED);
  });

  it("blocks invalid settlement transitions", async () => {
    const { transitionSettlement } = await import("@/lib/domain");
    mock.store.settlements.push({
      id: "settlement_1",
      organizationId: "org_1",
      publicId: "SET-1",
      reference: "ref_1",
      status: SettlementStatus.REQUESTED,
    });

    await expect(
      transitionSettlement("settlement_1", SettlementStatus.SETTLED, "user_1", "org_1"),
    ).rejects.toThrow("Cannot move settlement from REQUESTED to SETTLED.");
  });

  it("rejects contradictory reconciliation states", async () => {
    const { createReconciliationRecord } = await import("@/lib/domain");
    mock.store.settlements.push({
      id: "settlement_1",
      organizationId: "org_1",
      publicId: "SET-1",
      reference: "ref_1",
      status: SettlementStatus.SETTLED,
    });

    await expect(createReconciliationRecord({
      externalRef: "bank_ref_002",
      source: "bank_statement",
      amount: 100,
      currency: "INR",
      valueDate: "2026-06-02",
      status: ReconciliationStatus.MATCHED,
    }, "user_1", "org_1")).rejects.toThrow("A MATCHED reconciliation record must be linked to a settlement.");

    await expect(createReconciliationRecord({
      externalRef: "bank_ref_003",
      source: "bank_statement",
      amount: 100,
      currency: "INR",
      settlementId: "settlement_1",
      valueDate: "2026-06-02",
      status: ReconciliationStatus.EXCEPTION,
      exceptionReason: "Amount mismatch",
    }, "user_1", "org_1")).rejects.toThrow("An EXCEPTION reconciliation record cannot be linked to a settlement.");

    await expect(createReconciliationRecord({
      externalRef: "bank_ref_004",
      source: "bank_statement",
      amount: 100,
      currency: "INR",
      settlementId: "settlement_1",
      valueDate: "2026-06-02",
      status: ReconciliationStatus.MATCHED,
      exceptionReason: "Contradiction",
    }, "user_1", "org_1")).rejects.toThrow("Exception reason can only be used when status is EXCEPTION.");
  });
});
