import { describe, expect, it } from "vitest";
import { DEFAULT_SHADOW_CONFIG } from "../shadow-mode";
import { buildLivePilotReadiness, isProviderAllowedForLiveTest, type LivePilotFlags } from "../live-pilot";

// Defaults: per-settlement cap 1,000 INR; daily cap 2,000 INR;
// allowed providers remitquickly + PontisGlobe; live payouts off.
const config = { ...DEFAULT_SHADOW_CONFIG };

const settlement = {
  publicId: "SET-PILOT-1",
  status: "SETTLED",
  testMode: "LIVE_TEST",
  provider: "remitquickly",
  sourceCurrency: "USDT",
  targetCurrency: "INR",
  sourceAmount: "10.00",
  targetAmount: "800.00",
  sourceAccount: "USDT Treasury Wallet",
  targetAccount: "1234567890",
  approvedAt: new Date("2026-06-11T09:00:00Z"),
};

const approvedEvents = [{ toStatus: "APPROVED" }, { toStatus: "SETTLED" }];
const proofs = [{ receivedVia: "MANUAL" }];
const matchedIndependent = [{ status: "MATCHED", source: "bank_statement" }];

const readyFlags: LivePilotFlags = {
  finalityApprovedById: "user-approver",
  createdById: "user-creator",
  reportGenerated: true,
  dailyUsedInrExcludingThis: 0,
};

function readiness(overrides: {
  settlement?: Partial<typeof settlement>;
  proofs?: typeof proofs;
  recons?: typeof matchedIndependent;
  events?: typeof approvedEvents;
  flags?: Partial<LivePilotFlags>;
  config?: Partial<typeof config>;
  finality?: "ready_to_finalize" | "needs_review" | "not_ready";
}) {
  return buildLivePilotReadiness(
    { ...settlement, ...overrides.settlement },
    overrides.proofs ?? proofs,
    overrides.recons ?? matchedIndependent,
    overrides.events ?? approvedEvents,
    { ...readyFlags, ...overrides.flags },
    { ...config, ...overrides.config },
    overrides.finality ?? "ready_to_finalize",
  );
}

describe("ready only when everything passes", () => {
  it("proof + independent reconciliation + audit + dual-control + report + caps -> ready", () => {
    const result = readiness({});
    expect(result.decision).toBe("ready");
    expect(result.blockedReasons).toEqual([]);
    expect(result.pendingItems).toEqual([]);
  });
});

describe("hard guardrails -> blocked (cannot bypass)", () => {
  it("LIVE_TEST over the per-settlement cap is blocked even with perfect evidence", () => {
    const result = readiness({ settlement: { targetAmount: "1001.00" } });
    expect(result.decision).toBe("blocked");
    expect(result.blockedReasons.join(" ")).toMatch(/EXCEEDS the cap/);
  });

  it("exceeding the DAILY cap is blocked", () => {
    const result = readiness({ flags: { dailyUsedInrExcludingThis: 1500 } }); // 1500 + 800 > 2000
    expect(result.decision).toBe("blocked");
    expect(result.blockedReasons.join(" ")).toMatch(/over the daily cap/);
  });

  it("a provider off the allowlist is blocked", () => {
    const result = readiness({ settlement: { provider: "unknown_psp" } });
    expect(result.decision).toBe("blocked");
    expect(result.blockedReasons.join(" ")).toMatch(/not on the allowlist/);
  });

  it("LIVE_PAYOUTS_ENABLED tripwire blocks the pilot", () => {
    const result = readiness({ config: { livePayoutsEnabled: true } });
    expect(result.decision).toBe("blocked");
    expect(result.blockedReasons.join(" ")).toMatch(/must not move funds/);
  });
});

describe("missing evidence -> needs_review (never ready)", () => {
  it("without provider proof, the pilot cannot finalize", () => {
    const result = readiness({ proofs: [], finality: "not_ready" });
    expect(result.decision).toBe("needs_review");
    expect(result.pendingItems).toContain("Provider proof recorded");
    expect(result.pendingItems).toContain("Finality review passes");
  });

  it("without independent reconciliation, the pilot cannot finalize", () => {
    const result = readiness({ recons: [], finality: "needs_review" });
    expect(result.decision).toBe("needs_review");
    expect(result.pendingItems).toContain("Independent reconciliation matched");
  });

  it("a provider_claim match does NOT satisfy independent reconciliation", () => {
    const result = readiness({
      recons: [{ status: "MATCHED", source: "provider_claim" }],
      finality: "needs_review",
    });
    expect(result.decision).toBe("needs_review");
    expect(result.pendingItems).toContain("Independent reconciliation matched");
  });

  it("provider completed alone (finality needs_review) never makes the pilot ready", () => {
    const result = readiness({ recons: [], flags: { finalityApprovedById: null }, finality: "needs_review" });
    expect(result.decision).toBe("needs_review");
    expect(result.decision).not.toBe("ready");
  });
});

describe("dual-control foundation", () => {
  it("no explicit finality approval -> pending", () => {
    const result = readiness({ flags: { finalityApprovedById: null } });
    expect(result.decision).toBe("needs_review");
    expect(result.pendingItems).toContain("Finality approved by a second operator");
  });

  it("self-approval by the settlement creator does NOT count", () => {
    const result = readiness({ flags: { finalityApprovedById: "user-creator" } });
    expect(result.decision).toBe("needs_review");
    expect(result.items.find((item) => item.key === "dual_control")?.detail).toMatch(/DIFFERENT operator/);
  });
});

describe("settlement report requirement", () => {
  it("the pilot is not ready until a settlement report was generated", () => {
    const result = readiness({ flags: { reportGenerated: false } });
    expect(result.decision).toBe("needs_review");
    expect(result.pendingItems).toContain("Settlement report generated");
  });
});

describe("provider allowlist helper", () => {
  it("matches case-insensitively and rejects unknown/missing providers", () => {
    expect(isProviderAllowedForLiveTest("remitquickly", config)).toBe(true);
    expect(isProviderAllowedForLiveTest("PONTISGLOBE", config)).toBe(true);
    expect(isProviderAllowedForLiveTest("acme_pay", config)).toBe(false);
    expect(isProviderAllowedForLiveTest(null, config)).toBe(false);
    expect(isProviderAllowedForLiveTest("", config)).toBe(false);
  });
});
