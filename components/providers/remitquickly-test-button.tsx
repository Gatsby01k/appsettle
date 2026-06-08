"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type TestResult = {
  ok: boolean;
  message: string;
  detail?: string;
};

/**
 * Safe, sandbox-only control. Runs a self-contained RemitQuickly connectivity test
 * (submit a test payout, simulate SUCCESS, read status) without creating or
 * mutating any settlement. Rendered only in demo / private-beta mode.
 */
export function RemitQuicklyTestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/providers/remitquickly/test-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "SUCCESS" }),
      });
      const json = await response.json();

      if (!response.ok) {
        setResult({ ok: false, message: json.error ?? "Sandbox test failed." });
        return;
      }

      const payoutId = json?.data?.payoutId;
      setResult({
        ok: true,
        message: payoutId
          ? `Sandbox payout submitted (payout_id ${payoutId}).`
          : "Sandbox request completed.",
        detail: JSON.stringify(json.data, null, 2),
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Network error.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading}>
          {loading ? "Testing..." : "Test RemitQuickly Sandbox Payout"}
        </Button>
        {result ? (
          <span className={result.ok ? "text-xs text-[#0a7d86]" : "text-xs text-red-600"}>
            {result.message}
          </span>
        ) : null}
      </div>
      {result?.detail ? (
        <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
          {result.detail}
        </pre>
      ) : null}
    </div>
  );
}
