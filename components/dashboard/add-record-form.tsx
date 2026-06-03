"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ops/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type SegmentedOption = { value: string; label: string };

function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-lg border border-input bg-slate-50 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
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
}: {
  action: (formData: FormData) => Promise<void>;
  settlements: SettlementOption[];
}) {
  const [manualSettlementId, setManualSettlementId] = useState(NO_SETTLEMENT);
  const [source, setSource] = useState("bank_statement");
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState(todayISO());
  const isManualMatch = manualSettlementId !== NO_SETTLEMENT && manualSettlementId !== "";

  const valueDate = dateMode === "today" ? todayISO() : dateMode === "yesterday" ? yesterdayISO() : customDate;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="valueDate" value={valueDate} />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="externalRef">External reference</Label>
          <Input id="externalRef" name="externalRef" placeholder="BANK-AUTO-001" />
          <p className="text-xs text-slate-500">Leave blank to auto-generate.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Source</Label>
        <Segmented ariaLabel="Source" options={SOURCES} value={source} onChange={setSource} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
        <div className="grid gap-1.5">
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

      <details className="group rounded-lg border border-dashed bg-slate-50/60 p-3">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500 marker:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90">›</span>
            Manual match / exception handling
          </span>
        </summary>
        <div className="mt-3 grid gap-2">
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
            <p className="text-xs font-medium text-sky-700">
              This will link the record and reconcile the settlement.
            </p>
          ) : null}
        </div>
      </details>

      <div className="flex items-center">
        <SubmitButton type="submit" variant="primary" pendingText="Saving...">
          {isManualMatch ? "Confirm manual match" : "Add external record"}
        </SubmitButton>
      </div>
    </form>
  );
}
