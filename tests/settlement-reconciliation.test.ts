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
      findMany: vi.fn(async ({ where }) => {
        return store.settlements.filter((settlement) => {
          return settlement.organizationId === where.organizationId &&
            (!where.status || settlement.status === where.status);
        });
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
          if (where.id) {
            return record.id === where.id && record.organizationId === where.organizationId;
          }
          return record.organizationId === where.organizationId &&
            record.source === where.source &&
            record.externalRef === where.externalRef;
        }) ?? null;
      }),
      findMany: vi.fn(async ({ where }) => {
        const statuses: string[] | undefined = where.status?.in;
        return store.reconciliationRecords.filter((record) => {
          return record.organizationId === where.organizationId &&
            (where.settlementId === undefined || record.settlementId === where.settlementId) &&
            (!statuses || statuses.includes(record.status as string));
        });
      }),
      create: vi.fn(async ({ data }) => {
        const record = { id: nextId("recon"), createdAt: new Date(), updatedAt: new Date(), ...data };
        store.reconciliationRecords.push(record);
        return record;
      }),
      update: vi.fn(async ({ where, data }) => {
        const record = store.reconciliationRecords.find((item) => item.id === where.id);
        if (!record) throw new Error("Reconciliation record not found");
        Object.assign(record, data);
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

  function seedSettledSettlement(overrides: Partial<MockSettlement> & { settledAt: Date }): MockSettlement {
    const settlement: MockSettlement = {
      id: `settlement_${mock.store.settlements.length + 1}`,
      organizationId: "org_1",
      publicId: `SET-${mock.store.settlements.length + 1}`,
      reference: `ref_${mock.store.settlements.length + 1}`,
      status: SettlementStatus.SETTLED,
      sourceCurrency: "INR",
      targetCurrency: "USDT",
      sourceAmount: 2500000,
      targetAmount: 29900,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      ...overrides,
    };
    mock.store.settlements.push(settlement);
    return settlement;
  }

  function seedOpenRecord(overrides: Partial<MockRecord> & { valueDate: Date }): MockRecord {
    const record: MockRecord = {
      id: `recon_${mock.store.reconciliationRecords.length + 1}`,
      organizationId: "org_1",
      source: "bank_statement",
      externalRef: `bank_ref_${mock.store.reconciliationRecords.length + 1}`,
      amount: 2500000,
      currency: "INR",
      status: ReconciliationStatus.OPEN,
      settlementId: null,
      rawPayload: null,
      ...overrides,
    };
    mock.store.reconciliationRecords.push(record);
    return record;
  }

  it("auto-matches only exact (100%) matches and reconciles their settlements", async () => {
    const { autoMatchReconciliation } = await import("@/lib/domain");
    const valueDate = new Date("2026-06-02T00:00:00Z");

    const exactSettlement = seedSettledSettlement({ settledAt: valueDate });
    seedSettledSettlement({ settledAt: new Date("2026-05-20T00:00:00Z") });

    const exactRecord = seedOpenRecord({ valueDate });
    const suggestedRecord = seedOpenRecord({ valueDate, amount: 2500000 });
    // Force the second record to only ever be a 90% (value-date-differs) candidate by
    // leaving the only same-day settlement consumed by the exact record.

    const result = await autoMatchReconciliation("user_1", "org_1");

    expect(result.matched).toBe(1);
    expect(exactRecord.status).toBe(ReconciliationStatus.MATCHED);
    expect(exactRecord.settlementId).toBe(exactSettlement.id);
    expect(exactSettlement.status).toBe(SettlementStatus.RECONCILED);
    expect((exactRecord.rawPayload as { _matchOrigin?: string })._matchOrigin).toBe("AUTO");

    // The non-exact record is left for operator review — never auto-matched.
    expect(suggestedRecord.status).toBe(ReconciliationStatus.OPEN);
    expect(suggestedRecord.settlementId).toBeNull();

    const autoMatchLogs = mock.store.auditLogs.filter((log) => log.action === "reconciliation.auto_match");
    expect(autoMatchLogs).toHaveLength(1);
    const reconcileTransition = mock.store.auditLogs.find(
      (log) => log.action === "settlement.transition",
    );
    expect(reconcileTransition).toBeTruthy();
  });

  it("confirms a suggested match: links record, reconciles settlement, writes audit", async () => {
    const { confirmReconciliationMatch } = await import("@/lib/domain");
    // 90% candidate: amount + currency match but value date differs.
    const settlement = seedSettledSettlement({ settledAt: new Date("2026-05-20T00:00:00Z") });
    const record = seedOpenRecord({ valueDate: new Date("2026-06-02T00:00:00Z") });

    const result = await confirmReconciliationMatch(record.id, settlement.id, "user_1", "org_1");

    expect(result.confidence).toBe(90);
    expect(record.status).toBe(ReconciliationStatus.MATCHED);
    expect(record.settlementId).toBe(settlement.id);
    expect(settlement.status).toBe(SettlementStatus.RECONCILED);
    expect(mock.store.auditLogs.some((log) => log.action === "reconciliation.confirm_match")).toBe(true);
    expect(
      mock.store.auditLogs.some(
        (log) =>
          log.action === "settlement.transition" &&
          (log.after as { toStatus?: string })?.toStatus === SettlementStatus.RECONCILED,
      ),
    ).toBe(true);
  });

  it("rejects a suggested match: keeps record in manual review and remembers the rejection", async () => {
    const { rejectReconciliationSuggestion } = await import("@/lib/domain");
    const settlement = seedSettledSettlement({ settledAt: new Date("2026-05-20T00:00:00Z") });
    const record = seedOpenRecord({ valueDate: new Date("2026-06-02T00:00:00Z") });

    await rejectReconciliationSuggestion(record.id, settlement.id, "user_1", "org_1");

    expect(record.status).toBe(ReconciliationStatus.UNMATCHED);
    expect(record.settlementId).toBeNull();
    expect((record.rawPayload as { _rejectedSettlementIds?: string[] })._rejectedSettlementIds).toContain(
      settlement.id,
    );
    expect(mock.store.auditLogs.some((log) => log.action === "reconciliation.reject_match")).toBe(true);
  });

  it("saving an external record does not reconcile by default", async () => {
    const { createReconciliationRecord } = await import("@/lib/domain");
    // A SETTLED settlement that would match perfectly exists...
    const settlement = seedSettledSettlement({ settledAt: new Date("2026-06-02T00:00:00Z") });

    // ...but simply adding the external record (no settlement selected) must NOT link or reconcile it.
    const record = await createReconciliationRecord({
      externalRef: "bank_ref_open_1",
      source: "bank_statement",
      amount: 2500000,
      currency: "INR",
      valueDate: "2026-06-02",
      status: "OPEN",
    }, "user_1", "org_1");

    expect(record.status).toBe(ReconciliationStatus.OPEN);
    expect(record.settlementId).toBeNull();
    expect(settlement.status).toBe(SettlementStatus.SETTLED);
    expect(mock.store.auditLogs.some((log) => log.action === "settlement.transition")).toBe(false);
    expect((record.rawPayload as { _matchOrigin?: string })._matchOrigin).toBeUndefined();
  });

  it("a 90% suggested match is not auto-reconciled until explicitly confirmed", async () => {
    const { autoMatchReconciliation, confirmReconciliationMatch } = await import("@/lib/domain");
    // Amount + currency match, value date differs -> 90% suggestion, never auto-matched.
    const settlement = seedSettledSettlement({ settledAt: new Date("2026-05-20T00:00:00Z") });
    const record = seedOpenRecord({ valueDate: new Date("2026-06-02T00:00:00Z") });

    const result = await autoMatchReconciliation("user_1", "org_1");
    expect(result.matched).toBe(0);
    expect(record.status).toBe(ReconciliationStatus.OPEN);
    expect(record.settlementId).toBeNull();
    expect(settlement.status).toBe(SettlementStatus.SETTLED);

    // Only an explicit confirmation reconciles it.
    await confirmReconciliationMatch(record.id, settlement.id, "user_1", "org_1");
    expect(record.status).toBe(ReconciliationStatus.MATCHED);
    expect(record.settlementId).toBe(settlement.id);
    expect(settlement.status).toBe(SettlementStatus.RECONCILED);
    expect((record.rawPayload as { _matchOrigin?: string })._matchOrigin).toBe("MANUAL");
  });

  it("auto-generates a BANK-AUTO-### reference when the external reference is blank", async () => {
    const { createReconciliationRecord } = await import("@/lib/domain");

    const first = await createReconciliationRecord({
      externalRef: "",
      source: "bank_statement",
      amount: 1000,
      currency: "INR",
      valueDate: "2026-06-02",
      status: "OPEN",
    }, "user_1", "org_1");

    const second = await createReconciliationRecord({
      source: "psp_report",
      amount: 2000,
      currency: "INR",
      valueDate: "2026-06-02",
      status: "OPEN",
    }, "user_1", "org_1");

    expect(first.externalRef).toBe("BANK-AUTO-001");
    expect(second.externalRef).toBe("BANK-AUTO-002");
  });

  it("creates a quick matching bank record as OPEN and lets auto-match reconcile it", async () => {
    const { createMatchingDemoRecord, autoMatchReconciliation } = await import("@/lib/domain");
    const settlement = seedSettledSettlement({ settledAt: new Date("2026-06-02T00:00:00Z") });

    const record = await createMatchingDemoRecord("bank_statement", "user_1", "org_1");

    // Saved OPEN and unlinked — never auto-reconciled on create.
    expect(record.status).toBe(ReconciliationStatus.OPEN);
    expect(record.settlementId).toBeNull();
    expect(record.source).toBe("bank_statement");
    expect(record.externalRef).toMatch(/^BANK-AUTO-\d{3}$/);
    expect(settlement.status).toBe(SettlementStatus.SETTLED);

    // Running auto-match reconciles the quick matching record (settlement -> RECONCILED).
    const result = await autoMatchReconciliation("user_1", "org_1");
    expect(result.matched).toBe(1);
    expect(record.status).toBe(ReconciliationStatus.MATCHED);
    expect(record.settlementId).toBe(settlement.id);
    expect(settlement.status).toBe(SettlementStatus.RECONCILED);
    expect((record.rawPayload as { _matchOrigin?: string })._matchOrigin).toBe("AUTO");
    expect(mock.store.auditLogs.some((log) => log.action === "reconciliation.auto_match")).toBe(true);
  });

  it("creates a quick matching chain record with source chain_tx", async () => {
    const { createMatchingDemoRecord } = await import("@/lib/domain");
    seedSettledSettlement({ settledAt: new Date("2026-06-02T00:00:00Z") });

    const record = await createMatchingDemoRecord("chain_tx", "user_1", "org_1");

    expect(record.source).toBe("chain_tx");
    expect(record.status).toBe(ReconciliationStatus.OPEN);
    expect(record.settlementId).toBeNull();
  });

  it("requires a SETTLED settlement before a quick matching record can be created", async () => {
    const { createMatchingDemoRecord } = await import("@/lib/domain");

    await expect(createMatchingDemoRecord("bank_statement", "user_1", "org_1")).rejects.toThrow(
      "No SETTLED settlement is waiting to be reconciled.",
    );
  });

  it("creates a quick exception record that stays an EXCEPTION for manual review", async () => {
    const { createExceptionDemoRecord, autoMatchReconciliation } = await import("@/lib/domain");
    // A perfectly matching settlement exists, but the exception record must never match it.
    const settlement = seedSettledSettlement({ settledAt: new Date("2026-06-02T00:00:00Z") });

    const record = await createExceptionDemoRecord("user_1", "org_1");

    expect(record.status).toBe(ReconciliationStatus.EXCEPTION);
    expect(record.settlementId).toBeNull();
    expect(record.exceptionReason).toBeTruthy();

    // Auto-match never touches exception records, and the settlement stays SETTLED.
    const result = await autoMatchReconciliation("user_1", "org_1");
    expect(result.matched).toBe(0);
    expect(record.status).toBe(ReconciliationStatus.EXCEPTION);
    expect(settlement.status).toBe(SettlementStatus.SETTLED);
  });

  it("a manual match reconciles only when a settlement is explicitly selected", async () => {
    const { createReconciliationRecord } = await import("@/lib/domain");
    const settlement = seedSettledSettlement({ settledAt: new Date("2026-06-02T00:00:00Z") });

    const record = await createReconciliationRecord({
      externalRef: "bank_ref_manual_1",
      source: "bank_statement",
      amount: 2500000,
      currency: "INR",
      settlementId: settlement.id,
      valueDate: "2026-06-02",
      status: "MATCHED",
    }, "user_1", "org_1");

    expect(record.status).toBe(ReconciliationStatus.MATCHED);
    expect(record.settlementId).toBe(settlement.id);
    expect(settlement.status).toBe(SettlementStatus.RECONCILED);
    expect((record.rawPayload as { _matchOrigin?: string })._matchOrigin).toBe("MANUAL");
    expect(
      mock.store.auditLogs.some(
        (log) =>
          log.action === "settlement.transition" &&
          (log.after as { toStatus?: string })?.toStatus === SettlementStatus.RECONCILED,
      ),
    ).toBe(true);
  });
});

describe("matchTypeFor display lifecycle", () => {
  it("never shows a linked/matched record as a suggestion", async () => {
    const { matchTypeFor } = await import("@/lib/reconciliation");
    // Legacy/unknown origin falls back to confidence.
    expect(matchTypeFor("MATCHED", 100, true)).toBe("AUTO_MATCHED");
    expect(matchTypeFor("MATCHED", 90, true)).toBe("MANUAL_MATCHED");
    expect(matchTypeFor("MATCHED", 90, true)).not.toBe("SUGGESTED");
  });

  it("uses the recorded match origin for linked records", async () => {
    const { matchTypeFor } = await import("@/lib/reconciliation");
    // Origin wins over confidence: a manual 100% link is still "Manual", an auto link is "Auto".
    expect(matchTypeFor("MATCHED", 100, true, "MANUAL")).toBe("MANUAL_MATCHED");
    expect(matchTypeFor("MATCHED", 90, true, "AUTO")).toBe("AUTO_MATCHED");
  });

  it("classifies unlinked records by candidate strength", async () => {
    const { matchTypeFor } = await import("@/lib/reconciliation");
    expect(matchTypeFor("OPEN", 90, false)).toBe("SUGGESTED");
    expect(matchTypeFor("UNMATCHED", 0, false)).toBe("MANUAL_REVIEW");
  });

  it("always reports EXCEPTION regardless of score or linkage", async () => {
    const { matchTypeFor } = await import("@/lib/reconciliation");
    expect(matchTypeFor("EXCEPTION", 100, true)).toBe("EXCEPTION");
    expect(matchTypeFor("EXCEPTION", 0, false)).toBe("EXCEPTION");
  });
});
