import { Check } from "lucide-react";
import { SETTLEMENT_LIFECYCLE, settlementStepIndex } from "@/lib/ops";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  EXECUTING: "Executing",
  SETTLED: "Settled",
  RECONCILED: "Reconciled",
};

export function SettlementLifecycle({ status, compact }: { status: string; compact?: boolean }) {
  const current = settlementStepIndex(status);

  return (
    <div className="w-full">
      <div className="flex items-center">
        {SETTLEMENT_LIFECYCLE.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const future = index > current;

          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition-colors",
                    done && "border-[#42d5b7] bg-[#42d5b7] text-[#07132b]",
                    active && "border-[#07132b] bg-[#07132b] text-white ring-4 ring-[#42d5b7]/25",
                    future && "border-slate-200 bg-white text-slate-400",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                {!compact ? (
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-wide",
                      active ? "text-[#07132b]" : done ? "text-teal-700" : "text-slate-400",
                    )}
                  >
                    {LABELS[step]}
                  </span>
                ) : null}
              </div>
              {index < SETTLEMENT_LIFECYCLE.length - 1 ? (
                <div className={cn("mx-1 h-0.5 flex-1", index < current ? "bg-[#42d5b7]" : "bg-slate-200")} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
