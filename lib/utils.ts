import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FIAT_CURRENCIES = new Set(["INR", "USD", "EUR", "GBP", "AED", "SGD"]);
const CRYPTO_CURRENCIES = new Set(["USDT", "USDC"]);

export function formatCurrency(value: number | string, currency = "INR") {
  const numeric = typeof value === "string" ? Number(value) : value;
  const code = currency.toUpperCase();

  if (CRYPTO_CURRENCIES.has(code)) {
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
    }).format(numeric);

    return `${formatted} ${code}`;
  }

  if (!FIAT_CURRENCIES.has(code)) {
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
    }).format(numeric);

    return `${formatted} ${code}`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(numeric);
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
