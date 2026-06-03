// Shared quote-status helpers so the displayed status is always consistent with
// the quote's expiry, regardless of the stored DB status. A quote can sit in the
// database as ACTIVE long after its expiresAt has passed (there is no background
// job that flips it to EXPIRED), so every UI surface must derive expiry here.

export type QuoteForStatus = {
  status: string;
  expiresAt: Date | string;
};

/** True when a quote is past its TTL (an ACTIVE quote whose expiresAt is in the past) or already stored EXPIRED. */
export function isQuoteExpired(quote: QuoteForStatus, now: Date = new Date()): boolean {
  if (quote.status === "EXPIRED") return true;
  if (quote.status === "ACTIVE") return new Date(quote.expiresAt).getTime() < now.getTime();
  return false;
}

/**
 * The status to display to operators. A time-expired ACTIVE quote is shown as
 * EXPIRED; everything else shows its stored status. This is display-only and never
 * mutates the database.
 */
export function displayQuoteStatus(quote: QuoteForStatus, now: Date = new Date()): string {
  return isQuoteExpired(quote, now) ? "EXPIRED" : quote.status;
}
