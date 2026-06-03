import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FIAT_CURRENCIES = new Set(["INR", "USD", "EUR", "GBP", "AED", "SGD"]);
const CRYPTO_CURRENCIES = new Set(["USDT", "USDC"]);

function toNumber(value: number | string): number {
  const numeric = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : 0;
}

function fiatSymbol(code: string): string {
  switch (code) {
    case "INR":
      return "₹";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "SGD":
      return "S$";
    case "AED":
      return "AED ";
    default:
      return "";
  }
}

// Format a scaled magnitude with up to two decimals, truncated toward zero so
// compact labels never round a value up past its true figure, with trailing
// zeros stripped (5.00 -> "5", 1.50 -> "1.5"). toFixed(4) first absorbs binary
// float noise before we slice to two decimals.
function compact2(value: number): string {
  const fixed = value.toFixed(4);
  const [intPart, fracPart = ""] = fixed.split(".");
  const trimmed = fracPart.slice(0, 2).replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}

// Indian short scale: k (thousand), L (lakh), Cr (crore).
function compactIndian(abs: number): string {
  if (abs >= 1e7) return `${compact2(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${compact2(abs / 1e5)}L`;
  if (abs >= 1e3) return `${compact2(abs / 1e3)}k`;
  return compact2(abs);
}

// International short scale: k (thousand), M (million), B (billion).
function compactInternational(abs: number): string {
  if (abs >= 1e9) return `${compact2(abs / 1e9)}B`;
  if (abs >= 1e6) return `${compact2(abs / 1e6)}M`;
  if (abs >= 1e3) return `${compact2(abs / 1e3)}k`;
  return compact2(abs);
}

/**
 * Full-precision currency string with locale grouping. Use in tables, detail
 * sheets, and tooltips where exact figures matter.
 */
export function formatCurrencyFull(value: number | string, currency = "INR") {
  const numeric = toNumber(value);
  const code = currency.toUpperCase();

  if (CRYPTO_CURRENCIES.has(code) || !FIAT_CURRENCIES.has(code)) {
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
    }).format(numeric);

    return `${formatted} ${code}`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

/**
 * Compact currency string for metric cards and tight columns. INR uses Indian
 * notation (k / L / Cr); stablecoins and other currencies use international
 * notation (k / M / B). Always pair with the full value in a title/tooltip.
 *
 * Examples: 69450000 INR -> "₹6.94Cr", 1450000 USDT -> "1.45M USDT".
 */
export function formatCurrencyCompact(value: number | string, currency = "INR") {
  const numeric = toNumber(value);
  const code = currency.toUpperCase();
  const sign = numeric < 0 ? "-" : "";
  const abs = Math.abs(numeric);

  if (CRYPTO_CURRENCIES.has(code)) {
    return `${sign}${compactInternational(abs)} ${code}`;
  }

  const symbol = fiatSymbol(code);
  const body = code === "INR" ? compactIndian(abs) : compactInternational(abs);

  return symbol ? `${sign}${symbol}${body}` : `${sign}${body} ${code}`;
}

/**
 * Backwards-compatible alias kept for existing call sites. Resolves to the
 * full-precision formatter.
 */
export const formatCurrency = formatCurrencyFull;

/**
 * Compact, currency-less number formatting for counts and volumes using
 * international notation (k / M / B). Small values render as plain integers.
 */
export function formatNumberCompact(value: number | string) {
  const numeric = toNumber(value);
  const sign = numeric < 0 ? "-" : "";
  return `${sign}${compactInternational(Math.abs(numeric))}`;
}

/**
 * Format an already-computed percentage value (0–100) as a clean label.
 * Trailing zeros are stripped: formatPercent(95) -> "95%", formatPercent(33.3) -> "33.3%".
 */
export function formatPercent(value: number | string, fractionDigits = 1) {
  const numeric = toNumber(value);
  const fixed = numeric.toFixed(fractionDigits);
  const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
  return `${trimmed}%`;
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function publicSettlementId() {
  return `SET-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}
