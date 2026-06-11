import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHADOW_CONFIG,
  buildShadowChecklist,
  checklistComplete,
  inrLegOf,
  isWithinCap,
  modeCap,
  modeChangeViolations,
  safetyFor,
  type ShadowSettlementLike,
} from "../shadow-mode";

const config = { ...DEFAULT_SHADOW_CONFIG }; // shadow 10,000 / live test 1,000 / payouts off

const baseSettlement: ShadowSettlementLike = {
  publicId: "SET-SHADOW-1",
  status: "SETTLED",
  testMode: "SHADOW",
  provider: "remitquickly",
  sourceCurrency: "USDT",
  targetCurrency: "INR",
  sourceAmount: "100.00",
  targetAmount: "8315.00",
  sourceAccount: "USDT Treasury Wallet",
  targetAccount: "1234567890",
  approvedAt: new Date("2026-06-11T09:00:00Z"),
};

const approvedEvents = [{ toStatus: "APPROVED" }];
const proof = [{ receivedVia: "MANUAL" }];
const independentRecon = [{ status: "MATCHED", source: "bank_statement" }];

describe("caps", () => {
  it("resolves the INR leg from either side of the corridor", () => {
    expect(inrLegOf(baseSettlement)).toBe(8315);
    expect(
      inrLegOf({ ...baseSettlement, sourceCurrency: "INR", targetCurrency: "USDT", sourceAmount: "5000", targetAmount: "60" }),
    ).toBe(5000);
  });

  it("applies the right cap per mode (DEMO uncapped)", () => {
    expect(modeCap("DEMO", config)).toBeNull();
    expect(modeCap("SHADOW", config)).toBe(10_000);
    expect(modeCap("LIVE_TEST", config)).toBe(1_000);
  });

  it("checks the cap against the INR leg", () => {
    expect(isWithinCap(baseSettlement, config)).toBe(true); // 8,315 <= 10,000
    expect(isWithinCap({ ...baseSettlement, targetAmount: "10001" }, config)).toBe(false);
    expect(isWithinCap({ ...baseSettlement, testMode: "LIVE_TEST" }, config)).toBe(false); // 8,315 > 1,000
    expect(isWithinCap({ ...baseSettlement, testMode: "DEMO", targetAmount: "9999999" }, config)).toBe(true);
  });

  it("safetyFor reflects cap and live-payout tripwire", () => {
    expect(safetyFor(baseSettlement, config)).toEqual({
      withinCap: true,
      capLabel: "INR 10,000",
      livePayoutsDisabled: true,
    });
    expect(safetyFor(baseSettlement, { ...config, livePayoutsEnabled: true }).livePayoutsDisabled).toBe(false);
  });
});

describe("checklist", () => {
  it("is complete when provider, proof, beneficiary, amount, approval, independent recon are all on file", () => {
    const items = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, config);
    expect(checklistComplete(items)).toBe(true);
    expect(items).toHaveLength(8);
  });

  it("flags each missing input", () => {
    const items = buildShadowChecklist(
      { ...baseSettlement, provider: null, targetAccount: "", approvedAt: null },
      [],
      [],
      [],
      config,
    );
    const byKey = Object.fromEntries(items.map((item) => [item.key, item.done]));
    expect(byKey.provider_selected).toBe(false);
    expect(byKey.proof_capture).toBe(false);
    expect(byKey.beneficiary_verified).toBe(false);
    expect(byKey.operator_approval).toBe(false);
    expect(byKey.independent_recon).toBe(false);
    expect(byKey.live_payout_disabled).toBe(true);
    expect(checklistComplete(items)).toBe(false);
  });

  it("a provider_claim record does not satisfy the independent reconciliation item", () => {
    const items = buildShadowChecklist(
      baseSettlement,
      proof,
      [{ status: "MATCHED", source: "provider_claim" }],
      approvedEvents,
      config,
    );
    expect(items.find((item) => item.key === "independent_recon")?.done).toBe(false);
  });

  it("live_payout_disabled fails when the tripwire env is set", () => {
    const items = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, {
      ...config,
      livePayoutsEnabled: true,
    });
    expect(items.find((item) => item.key === "live_payout_disabled")?.done).toBe(false);
  });
});

describe("mode transitions (LIVE_TEST cannot bypass caps/checklist)", () => {
  it("allows SHADOW within cap with basic data", () => {
    const checklist = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, config);
    expect(modeChangeViolations(baseSettlement, "SHADOW", checklist, config)).toEqual([]);
  });

  it("blocks SHADOW over the shadow cap", () => {
    const over = { ...baseSettlement, targetAmount: "10001" };
    const checklist = buildShadowChecklist(over, proof, independentRecon, approvedEvents, config);
    const violations = modeChangeViolations(over, "SHADOW", checklist, config);
    expect(violations.join(" ")).toMatch(/exceeds the Shadow cap/);
  });

  it("blocks LIVE_TEST over the tighter live-test cap even when the checklist is complete", () => {
    const checklist = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, config);
    expect(checklistComplete(checklist)).toBe(true);
    const violations = modeChangeViolations(baseSettlement, "LIVE_TEST", checklist, config); // 8,315 > 1,000
    expect(violations.join(" ")).toMatch(/exceeds the Live test cap/);
  });

  it("blocks LIVE_TEST with an incomplete checklist even under the cap", () => {
    const tiny = { ...baseSettlement, targetAmount: "500.00" };
    const checklist = buildShadowChecklist(tiny, [], [], approvedEvents, config);
    const violations = modeChangeViolations(tiny, "LIVE_TEST", checklist, config);
    expect(violations.join(" ")).toMatch(/Checklist incomplete: Provider proof captured/);
    expect(violations.join(" ")).toMatch(/Checklist incomplete: Independent reconciliation/);
  });

  it("blocks SHADOW and LIVE_TEST when live payouts are enabled", () => {
    const hot = { ...config, livePayoutsEnabled: true };
    const checklist = buildShadowChecklist(baseSettlement, proof, independentRecon, approvedEvents, hot);
    expect(modeChangeViolations(baseSettlement, "SHADOW", checklist, hot).join(" ")).toMatch(/LIVE_PAYOUTS_ENABLED/);
  });

  it("switching back to DEMO is always allowed", () => {
    const checklist = buildShadowChecklist(baseSettlement, [], [], [], config);
    expect(modeChangeViolations(baseSettlement, "DEMO", checklist, config)).toEqual([]);
  });
});
