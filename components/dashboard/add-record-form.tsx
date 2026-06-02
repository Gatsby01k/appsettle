"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ops/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

const NO_SETTLEMENT = "_none";

type SettlementOption = { value: string; label: string };

/**
 * Add External Record form.
 *
 * Default flow: operators capture a bank/chain/PSP record without touching a
 * settlement — it is saved as OPEN and reconciled later by the auto-match engine
 * or an explicit operator action. Linking a settlement here is an *opt-in* manual
 * match, clearly labelled so it is never confused with auto-match.
 */
export function AddRecordForm({
  action,
  settlements,
}: {
  action: (formData: FormData) => Promise<void>;
  settlements: SettlementOption[];
}) {
  const [manualSettlementId, setManualSettlementId] = useState(NO_SETTLEMENT);
  const isManualMatch = manualSettlementId !== NO_SETTLEMENT && manualSettlementId !== "";

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div className="grid gap-1.5">
        <Label htmlFor="externalRef">External reference</Label>
        <Input id="externalRef" name="externalRef" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
      </div>
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
        <Label>Source</Label>
        <FormSelect
          name="source"
          defaultValue="bank_statement"
          options={[
            { value: "bank_statement", label: "Bank statement" },
            { value: "chain_tx", label: "Chain transaction" },
            { value: "psp_report", label: "PSP report" },
            { value: "manual", label: "Manual" },
          ]}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="valueDate">Value date</Label>
        <Input id="valueDate" name="valueDate" type="date" required />
      </div>

      <div className="grid gap-2 rounded-lg border border-dashed bg-slate-50/60 p-3 lg:col-span-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual match (optional)</p>
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
              options={[
                { value: NO_SETTLEMENT, label: "Unmatched (recommended)" },
                ...settlements,
              ]}
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

      <div className="flex items-end lg:col-span-4">
        <SubmitButton type="submit" variant="primary" pendingText="Saving...">
          {isManualMatch ? "Confirm manual match" : "Add external record"}
        </SubmitButton>
      </div>
    </form>
  );
}
