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

const PROOF_RAIL_STEPS = ["Approved", "Executed", "Provider", "Settled", "Reconciled"] as const;

function proofRailIndex(status: string): number {
  switch (status.toUpperCase()) {
    case "RECONCILED":
      return 4;
    case "SETTLED":
      return 3;
    case "EXECUTING":
      return 2;
    case "APPROVED":
      return 1;
    default:
      return 0;
  }
}

export function SettlementLifecycle({
  status,
  compact,
  spotlight,
  proofRail,
}: {
  status: string;
  compact?: boolean;
  spotlight?: boolean;
  /** Compact proof rail: Approved → Executed → Provider → Settled → Reconciled */
  proofRail?: boolean;
}) {
  if (proofRail) {
    const current = proofRailIndex(status);
    const terminalComplete = status.toUpperCase() === "RECONCILED";

    return (
      <div className="w-full">
        <div className="flex items-center">
          {PROOF_RAIL_STEPS.map((label, index) => {
            const done = index < current || (terminalComplete && index === current);
            const active = index === current && !terminalComplete;
            const future = index > current;
            const connectorDone = index < current || (terminalComplete && index === current);
            const connectorActive = index === current && !terminalComplete;

            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div
                  className="proof-rail-step flex flex-col items-center gap-1"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold transition-colors",
                      done && "border-[#42d5b7] bg-[#42d5b7] text-[#07132b] settlement-step-complete",
                      active &&
                        "border-[#07132b] bg-[#07132b] text-white ring-2 ring-[#42d5b7]/30 settlement-step-active",
                      future && "border-slate-200/90 bg-white/80 text-slate-400",
                    )}
                    style={done ? { animationDelay: `${index * 90}ms` } : undefined}
                  >
                    {done ? (
                      <Check
                        className="h-3 w-3 settlement-step-check"
                        style={{ animationDelay: `${index * 90 + 100}ms` }}
                      />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "max-w-[4.5rem] truncate text-center text-[9px] font-semibold uppercase tracking-wide",
                      active ? "text-[#07132b]" : done ? "text-teal-700" : "text-slate-400",
                    )}
                  >
                    {label}
                  </span>
                </div>
                {index < PROOF_RAIL_STEPS.length - 1 ? (
                  <div
                    className={cn(
                      "proof-rail-connector mx-0.5 h-px flex-1 rounded-full",
                      connectorDone && "bg-[#42d5b7]",
                      connectorActive && "settlement-connector-active",
                      !connectorDone && !connectorActive && "bg-slate-200/80",
                    )}
                    style={{ animationDelay: `${index * 70 + 40}ms` }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const current = settlementStepIndex(status);
  // When fully reconciled, the lifecycle is complete — every step, including the
  // final RECONCILED step, should render as done rather than "in progress".
  const terminalComplete = status.toUpperCase() === "RECONCILED";

  return (
    <div className="w-full">
      <div className="flex items-center">
        {SETTLEMENT_LIFECYCLE.map((step, index) => {
          const done = index < current || (terminalComplete && index === current);
          const active = index === current && !terminalComplete;
          const future = index > current;
          const connectorDone = index < current || (terminalComplete && index === current);
          const connectorActive = index === current && !terminalComplete;

          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div
                className="flex flex-col items-center gap-1.5"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div
                  className={cn(
                    "grid place-items-center rounded-full border font-semibold transition-colors",
                    spotlight ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs",
                    done && "border-[#42d5b7] bg-[#42d5b7] text-[#07132b] settlement-step-complete",
                    active &&
                      "border-[#07132b] bg-[#07132b] text-white ring-4 ring-[#42d5b7]/25 settlement-step-active",
                    future && "border-slate-200 bg-white text-slate-400",
                  )}
                  style={done ? { animationDelay: `${index * 80}ms` } : undefined}
                >
                  {done ? (
                    <Check
                      className={cn("settlement-step-check", spotlight ? "h-4 w-4" : "h-3.5 w-3.5")}
                      style={{ animationDelay: `${index * 80 + 120}ms` }}
                    />
                  ) : (
                    index + 1
                  )}
                </div>
                {!compact ? (
                  <span
                    className={cn(
                      "font-medium uppercase tracking-wide",
                      spotlight ? "text-[11px]" : "text-[10px]",
                      active ? "text-[#07132b]" : done ? "text-teal-700" : "text-slate-400",
                    )}
                  >
                    {LABELS[step]}
                  </span>
                ) : null}
              </div>
              {index < SETTLEMENT_LIFECYCLE.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded-full transition-colors",
                    connectorDone && "bg-[#42d5b7]",
                    connectorActive && "settlement-connector-active",
                    !connectorDone && !connectorActive && "bg-slate-200",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
