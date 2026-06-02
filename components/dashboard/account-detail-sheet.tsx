"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export type AccountDetail = {
  name: string;
  type: string;
  currency: string;
  balance: string;
  institution: string;
  status: string;
  linkedCounterparties: { name: string; type: string }[];
  recentActivity: { label: string; amount: string; when: string }[];
};

export function AccountDetailSheet({ account }: { account: AccountDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        View
      </Button>
      <SheetContent title={account.name} description={`${account.type} · ${account.institution}`}>
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge status={account.status} />
          <span className="text-xs text-slate-500">{account.currency}</span>
        </div>

        <div className="rounded-lg border bg-slate-50/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Available balance</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#07132b]">{account.balance}</p>
        </div>

        <div className="mt-3 rounded-lg border p-3">
          <StatRow label="Account type" value={account.type} />
          <StatRow label="Currency" value={account.currency} />
          <StatRow label="Institution" value={account.institution} />
        </div>

        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Linked counterparties</p>
          {account.linkedCounterparties.length ? (
            <ul className="space-y-2">
              {account.linkedCounterparties.map((cp) => (
                <li key={cp.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700">{cp.name}</span>
                  <span className="text-xs text-slate-400">{cp.type}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No counterparties linked.</p>
          )}
        </div>

        <div className="mt-3 rounded-lg border p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recent activity</p>
          {account.recentActivity.length ? (
            <ul className="divide-y">
              {account.recentActivity.map((activity) => (
                <li key={activity.label} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-slate-700">{activity.label}</p>
                    <p className="text-xs text-slate-400">{activity.when}</p>
                  </div>
                  <span className="tabular-nums text-slate-500">{activity.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No recent activity.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
