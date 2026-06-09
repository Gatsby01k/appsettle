"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ops/form-select";
import { Segmented } from "@/components/ops/segmented";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelperText } from "@/components/ui/helper-text";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

const NO_SETTLEMENT = "_none";

type SettlementOption = { value: string; label: string };

const SOURCES = [
  { value: "bank_statement", label: "Bank statement" },
  { value: "chain_tx", label: "Chain transfer" },
  { value: "psp_report", label: "PSP report" },
];

/** Format a Date as a local YYYY-MM-DD string (for native date inputs / value date). */
function localISODate(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function todayISO(): string {
  return localISODate(new Date());
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISODate(d);
}

/**
 * Add External Record form.
 *
 * Default flow: operators capture a bank/chain/PSP record without touching a
 * settlement — it is saved as OPEN and reconciled later by the auto-match engine
 * or an explicit operator action. The external reference can be left blank to
 * auto-generate, the value date defaults to today, and linking a settlement is an
 * *opt-in* manual match tucked behind a collapsible section so it is never confused
 * with auto-match.
 */
export function AddRecordForm({
  action,
  settlements,
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  settlements: SettlementOption[];
  compact?: boolean;
}) {
  const [manualSettlementId, setManualSettlementId] = useState(NO_SETTLEMENT);
  const [source, setSource] = useState("bank_statement");
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState(todayISO());
  const isManualMatch = manualSettlementId !== NO_SETTLEMENT && manualSettlementId !== "";

  const valueDate = dateMode === "today" ? todayISO() : dateMode === "yesterday" ? yesterdayISO() : customDate;

  return (
    <form action={action} className={compact ? "grid gap-2.5" : "grid gap-4"}>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="valueDate" value={valueDate} />

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2")}>
        <div className="grid gap-1.5">
          <Label htmlFor="externalRef">External reference</Label>
          <Input id="externalRef" name="externalRef" placeholder="BANK-AUTO-001" />
          {!compact ? <HelperText>Leave blank to auto-generate.</HelperText> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
        </div>
        {compact ? (
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Source</Label>
            <Segmented ariaLabel="Source" options={SOURCES} value={source} onChange={setSource} />
          </div>
        ) : null}
        {compact ? (
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Currency</Label>
            <FormSelect
              name="currency"
              defaultValue="INR"
              options={[
                { value: "INR", label: "INR" },
                { value: "USDT", label: "USDT" },
              ]}
            />
          </div>
        ) : null}
      </div>

      {!compact ? (
        <div className="grid gap-1.5">
          <Label>Source</Label>
          <Segmented ariaLabel="Source" options={SOURCES} value={source} onChange={setSource} />
        </div>
      ) : null}

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "md:grid-cols-2")}>
        {!compact ? (
          <div className="grid gap-1.5">
            <Label>Currency</Label>
            <FormSelect
              name="currency"
              defaultValue="INR"
              options={[
                { value: "INR", label: "INR" },
                { value: "USDT", label: "USDT" },
              ]}
            />
          </div>
        ) : null}
        <div className={cn("grid gap-1.5", compact && "sm:col-span-2")}>
          <Label>Value date</Label>
          <Segmented
            ariaLabel="Value date"
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "custom", label: "Custom" },
            ]}
            value={dateMode}
            onChange={(next) => setDateMode(next as typeof dateMode)}
          />
          {dateMode === "custom" ? (
            <Input
              type="date"
              aria-label="Custom value date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              className="mt-1"
            />
          ) : null}
        </div>
      </div>

      <details
        className={cn(
          "group rounded-xl border border-dashed border-[var(--ops-line)] bg-slate-50/60",
          compact ? "p-2.5" : "p-3",
        )}
      >
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500 marker:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90">›</span>
            Manual match / exception handling
          </span>
        </summary>
        <div className="mt-3 grid gap-2 reconciliation-details-content">
          <p className="text-xs text-slate-500">
            Leave as <span className="font-medium">Unmatched</span> to let the auto-match engine reconcile this record.
            Pick a settlement only to reconcile it manually right now.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Settlement</Label>
              <FormSelect
                name="settlementId"
                defaultValue={NO_SETTLEMENT}
                onValueChange={setManualSettlementId}
                options={[{ value: NO_SETTLEMENT, label: "Unmatched (recommended)" }, ...settlements]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exceptionReason">Exception reason (optional)</Label>
              <Input id="exceptionReason" name="exceptionReason" placeholder="Flags the record as an EXCEPTION" />
            </div>
          </div>
          {isManualMatch ? (
            <p className="reconciliation-manual-hint-pop text-xs font-medium text-[#0a7d86]">
              This will link the record and reconcile the settlement.
            </p>
          ) : null}
        </div>
      </details>

      <div className="flex items-center">
        <SubmitButton type="submit" variant="primary" size={compact ? "sm" : "default"} pendingText="Saving...">
          {isManualMatch ? "Confirm manual match" : "Add external record"}
        </SubmitButton>
      </div>
    </form>
  );
}
