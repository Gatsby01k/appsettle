import { describe, expect, it } from "vitest";
import { DEMO_FALLBACK_RATES, resolveQuoteRates } from "../quote-rate";

describe("env rate is used", () => {
  it("a valid QUOTE_RATE_USDT_INR prices BOTH corridors with source 'env'", () => {
    const rates = resolveQuoteRates({ QUOTE_RATE_USDT_INR: "84.25", NODE_ENV: "production" });
    expect(rates.USDT_INR).toBe(84.25);
    expect(rates.INR_USDT).toBe(84.25);
    expect(rates.source).toBe("env");
    expect(rates.label).toMatch(/Manual desk rate/);
    expect(rates.label).toMatch(/no live FX feed/i);
  });

  it("trims whitespace and accepts integers", () => {
    const rates = resolveQuoteRates({ QUOTE_RATE_USDT_INR: " 83 ", NODE_ENV: "development" });
    expect(rates.USDT_INR).toBe(83);
    expect(rates.source).toBe("env");
  });
});

describe("invalid env rate never silently prices quotes", () => {
  it.each(["abc", "-5", "0", "NaN", "Infinity"])("'%s' throws in production", (raw) => {
    expect(() => resolveQuoteRates({ QUOTE_RATE_USDT_INR: raw, NODE_ENV: "production" })).toThrow(
      /invalid/,
    );
  });

  it("an invalid value throws even in development — never a silent fallback", () => {
    expect(() => resolveQuoteRates({ QUOTE_RATE_USDT_INR: "oops", NODE_ENV: "development" })).toThrow(
      /invalid/,
    );
  });
});

describe("fallback is dev/demo only", () => {
  it("unset rate in production WITHOUT demo mode fails closed", () => {
    expect(() => resolveQuoteRates({ NODE_ENV: "production" })).toThrow(/QUOTE_RATE_USDT_INR is not set/);
    expect(() =>
      resolveQuoteRates({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "false" }),
    ).toThrow(/not set/);
  });

  it("unset rate in development uses the demo fallback, clearly labelled", () => {
    const rates = resolveQuoteRates({ NODE_ENV: "development" });
    expect(rates.source).toBe("demo_fallback");
    expect(rates.INR_USDT).toBe(DEMO_FALLBACK_RATES.INR_USDT);
    expect(rates.USDT_INR).toBe(DEMO_FALLBACK_RATES.USDT_INR);
    expect(rates.label).toMatch(/Demo rate/);
  });

  it("unset rate in production WITH demo mode explicitly on uses the demo fallback", () => {
    const rates = resolveQuoteRates({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "true" });
    expect(rates.source).toBe("demo_fallback");
  });

  it("an empty-string env value behaves like unset", () => {
    const rates = resolveQuoteRates({ QUOTE_RATE_USDT_INR: "", NODE_ENV: "development" });
    expect(rates.source).toBe("demo_fallback");
  });
});
