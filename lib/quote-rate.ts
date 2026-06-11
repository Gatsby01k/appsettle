// Quote rate resolution (pure, env-driven — NO external FX feed).
//
// The platform has no live FX integration. The executable quote rate comes
// from ONE explicit source: the QUOTE_RATE_USDT_INR environment variable — a
// manually maintained treasury desk rate. A hardcoded fallback exists ONLY for
// local development / demo mode; production without demo mode fails closed
// rather than pricing real quotes with fictional numbers.

export type QuoteRateSource = "env" | "demo_fallback";

export type QuoteRates = {
  /** INR per USDT applied to the INR -> USDT corridor. */
  INR_USDT: number;
  /** INR per USDT applied to the USDT -> INR corridor. */
  USDT_INR: number;
  source: QuoteRateSource;
  /** Product-facing label persisted into the quote audit entry. */
  label: string;
};

/** Local/demo fallback only — never used in production unless demo mode is on. */
export const DEMO_FALLBACK_RATES = { INR_USDT: 83.5, USDT_INR: 83.15 } as const;

export type QuoteRateEnv = {
  QUOTE_RATE_USDT_INR?: string;
  NODE_ENV?: string;
  NEXT_PUBLIC_DEMO_MODE?: string;
};

/**
 * Resolves the quote rates for both corridors.
 *
 * Rules (fail closed):
 *  - QUOTE_RATE_USDT_INR set and a positive finite number -> used for BOTH
 *    corridors (single manual desk rate; no synthetic spread), source "env".
 *  - QUOTE_RATE_USDT_INR set but invalid -> throws, in every environment.
 *    A misconfigured rate must never silently price a quote.
 *  - Unset -> demo fallback ONLY outside production, or in production with
 *    NEXT_PUBLIC_DEMO_MODE="true". Production without demo mode throws.
 */
export function resolveQuoteRates(env: QuoteRateEnv = process.env): QuoteRates {
  const raw = env.QUOTE_RATE_USDT_INR?.trim();

  if (raw !== undefined && raw !== "") {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `QUOTE_RATE_USDT_INR is set but invalid ("${raw}"). It must be a positive number (INR per USDT). Quotes are blocked until it is fixed.`,
      );
    }
    return {
      INR_USDT: value,
      USDT_INR: value,
      source: "env",
      label: "Manual desk rate (QUOTE_RATE_USDT_INR) — no live FX feed",
    };
  }

  const demoAllowed = env.NODE_ENV !== "production" || env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (!demoAllowed) {
    throw new Error(
      "QUOTE_RATE_USDT_INR is not set. A manual desk rate is required to generate quotes in production.",
    );
  }

  return {
    INR_USDT: DEMO_FALLBACK_RATES.INR_USDT,
    USDT_INR: DEMO_FALLBACK_RATES.USDT_INR,
    source: "demo_fallback",
    label: "Demo rate — local/demo only, no live FX feed",
  };
}
