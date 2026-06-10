import { describe, expect, it } from "vitest";
import {
  AUTO_MATCH_MIN_CONFIDENCE,
  SUGGESTED_MIN_CONFIDENCE,
  computeConfidence,
  matchReasonFor,
  matchTypeFor,
  settlementLegAmount,
  type SettlementLegs,
} from "../reconciliation";

const legs: SettlementLegs = {
  sourceCurrency: "INR",
  targetCurrency: "USDT",
  sourceAmount: 500000,
  targetAmount: 5961.5,
  refDate: new Date("2026-06-10T10:00:00Z"),
};

describe("computeConfidence", () => {
  it("returns 100 when amount, currency, and value date all align", () => {
    expect(computeConfidence(500000, "INR", new Date("2026-06-10T18:00:00Z"), legs)).toBe(
      AUTO_MATCH_MIN_CONFIDENCE,
    );
  });

  it("returns 90 when amount and currency align but the value date differs", () => {
    expect(computeConfidence(500000, "INR", new Date("2026-06-11T10:00:00Z"), legs)).toBe(90);
  });

  it("matches against the target leg too", () => {
    expect(computeConfidence(5961.5, "USDT", new Date("2026-06-10T10:00:00Z"), legs)).toBe(100);
  });

  it("returns 0 when the amount differs beyond tolerance", () => {
    expect(computeConfidence(500001, "INR", new Date("2026-06-10T10:00:00Z"), legs)).toBe(0);
    expect(computeConfidence(499999.5, "INR", new Date("2026-06-10T10:00:00Z"), legs)).toBe(0);
  });

  it("tolerates sub-paisa rounding differences", () => {
    expect(computeConfidence(500000.005, "INR", new Date("2026-06-10T10:00:00Z"), legs)).toBe(100);
  });

  it("returns 0 when the currency matches neither leg", () => {
    expect(computeConfidence(500000, "USDC", new Date("2026-06-10T10:00:00Z"), legs)).toBe(0);
  });

  it("returns 0 when there is no settlement candidate", () => {
    expect(computeConfidence(500000, "INR", new Date(), null)).toBe(0);
  });
});

describe("settlementLegAmount", () => {
  it("resolves the leg by currency and returns null otherwise", () => {
    expect(settlementLegAmount(legs, "INR")).toBe(500000);
    expect(settlementLegAmount(legs, "USDT")).toBe(5961.5);
    expect(settlementLegAmount(legs, "EUR")).toBeNull();
  });
});

describe("matchTypeFor", () => {
  it("never shows a linked record as a pending suggestion", () => {
    expect(matchTypeFor("MATCHED", 100, true, "AUTO")).toBe("AUTO_MATCHED");
    expect(matchTypeFor("MATCHED", 85, true, "MANUAL")).toBe("MANUAL_MATCHED");
    // Legacy records without an origin fall back to confidence.
    expect(matchTypeFor("MATCHED", 100, true, null)).toBe("AUTO_MATCHED");
    expect(matchTypeFor("MATCHED", 90, true, null)).toBe("MANUAL_MATCHED");
  });

  it("unlinked records are suggestions at >=80, manual review below", () => {
    expect(matchTypeFor("OPEN", SUGGESTED_MIN_CONFIDENCE, false)).toBe("SUGGESTED");
    expect(matchTypeFor("OPEN", 79, false)).toBe("MANUAL_REVIEW");
    expect(matchTypeFor("OPEN", 0, false)).toBe("MANUAL_REVIEW");
  });

  it("exceptions and resolved records keep their lifecycle type", () => {
    expect(matchTypeFor("EXCEPTION", 100, false)).toBe("EXCEPTION");
    expect(matchTypeFor("RESOLVED", 100, false)).toBe("RESOLVED");
  });
});

describe("matchReasonFor", () => {
  it("explains full, partial, and failed matches", () => {
    expect(matchReasonFor(100, "INR")).toMatch(/value date all match/);
    expect(matchReasonFor(90, "INR")).toMatch(/value date differs/);
    expect(matchReasonFor(0, "INR")).toMatch(/No settlement/);
  });
});
