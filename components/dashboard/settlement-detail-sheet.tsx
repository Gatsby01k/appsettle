"use client";

import { useState } from "react";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function SettlementDetailSheet({
  settlement,
}: {
  settlement: {
    publicId: string;
    reference: string;
    corridor: string;
    status: string;
    sourceAmount: string;
    targetAmount: string;
    createdAt: string;
    approvedAt?: string;
    settledAt?: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Details
      </Button>
      <SheetContent title={settlement.publicId} description={settlement.reference}>
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={settlement.status} />
        </div>
        <div className="rounded-lg border bg-slate-50/60 p-4">
          <SettlementLifecycle status={settlement.status} />
        </div>
        <div className="mt-4 rounded-lg border p-3">
          <StatRow label="Corridor" value={settlement.corridor} />
          <StatRow label="Source amount" value={settlement.sourceAmount} />
          <StatRow label="Destination amount" value={settlement.targetAmount} />
          <StatRow label="Created" value={settlement.createdAt} />
          {settlement.approvedAt ? <StatRow label="Approved" value={settlement.approvedAt} /> : null}
          {settlement.settledAt ? <StatRow label="Settled" value={settlement.settledAt} /> : null}
          <StatRow label="Status" value={<StatusBadge status={settlement.status} />} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
