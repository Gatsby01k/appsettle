"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export type CounterpartyDetail = {
  name: string;
  type: string;
  country: string;
  corridor: string;
  status: string;
  settledVolume: string;
  notes: string;
  linkedAccounts: { name: string; currency: string; balance: string }[];
  recentSettlements: { reference: string; amount: string; status: string; when: string }[];
};

export function CounterpartyDetailSheet({ counterparty }: { counterparty: CounterpartyDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        View
      </Button>
      <SheetContent eyebrow="Counterparty" title={counterparty.name} description={`${counterparty.type} · ${counterparty.country}`}>
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge status={counterparty.status} />
          <span className="text-xs text-slate-500">{counterparty.corridor}</span>
        </div>

        <div className="rounded-xl border border-[var(--ops-line)] p-3">
          <StatRow label="Type" value={counterparty.type} />
          <StatRow label="Country" value={counterparty.country} />
          <StatRow label="Corridor" value={counterparty.corridor} />
          <StatRow label="Settled volume" value={counterparty.settledVolume} />
        </div>

        <div className="mt-3 rounded-xl border border-[var(--ops-line)] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Linked accounts</p>
          {counterparty.linkedAccounts.length ? (
            <ul className="space-y-2">
              {counterparty.linkedAccounts.map((account) => (
                <li key={account.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700">{account.name}</span>
                  <span className="tabular-nums text-slate-500">{account.balance}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No accounts linked yet.</p>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-[var(--ops-line)] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Recent settlements</p>
          {counterparty.recentSettlements.length ? (
            <ul className="divide-y divide-slate-100">
              {counterparty.recentSettlements.map((settlement) => (
                <li key={settlement.reference} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{settlement.reference}</p>
                    <p className="text-xs text-slate-400">{settlement.when}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-slate-500">{settlement.amount}</span>
                    <StatusBadge status={settlement.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No settlement history.</p>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-[var(--ops-line-soft)] bg-slate-50/70 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Notes</p>
          <p className="text-sm text-slate-600">{counterparty.notes}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
