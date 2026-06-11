"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Live quote-validity countdown. Derives everything from the quote's existing
 * `expiresAt` timestamp — no invented data. Server-renders a stable
 * placeholder ("—") and only starts ticking after mount, so there is no
 * hydration mismatch. Interval is cleared on unmount; shows the expired text
 * once remaining time reaches zero.
 */
export function QuoteCountdown({
  expiresAt,
  prefix = "",
  expiredText = "Expired",
  expiredClassName = "text-amber-700",
  className,
}: {
  /** ISO timestamp of quote expiry. */
  expiresAt: string;
  prefix?: string;
  expiredText?: string;
  expiredClassName?: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pre-mount placeholder keeps server and client markup identical.
  if (now === null) {
    return (
      <span className={className} suppressHydrationWarning>
        {prefix}—
      </span>
    );
  }

  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) {
    return <span className={cn(className, expiredClassName)}>{expiredText}</span>;
  }

  const totalSec = Math.floor(ms / 1000);
  const hr = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const label =
    hr > 0 ? `${hr}h ${min}m left` : min > 0 ? `${min}m ${String(sec).padStart(2, "0")}s left` : `${sec}s left`;

  return (
    <span className={className}>
      {prefix}
      {label}
    </span>
  );
}

/**
 * Periodic refresh for the Quotes page so server-derived state (LOCKED ->
 * EXPIRED, tab counts) catches up without a manual reload. Mirrors the
 * settlements auto-refresh pattern; enabled only while active quotes exist.
 */
export function QuotesAutoRefresh({ enabled, intervalMs = 30000 }: { enabled: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
