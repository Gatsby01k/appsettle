"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type SettlementAction,
  useSettlementActionStep,
  useSettlementActionsOptional,
} from "@/components/dashboard/settlement-auto-refresh";

type SubmitButtonProps = ButtonProps & {
  pendingText?: string;
  settlementId?: string;
  action?: SettlementAction;
};

export function SubmitButton({
  children,
  disabled,
  pendingText = "Working...",
  settlementId,
  action,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const rowPending = useSettlementActionsOptional();
  const currentStep = useSettlementActionStep(settlementId, action);
  const isRowActionPending =
    Boolean(settlementId && action && rowPending?.pendingAction) &&
    rowPending?.pendingAction?.settlementId === settlementId &&
    rowPending?.pendingAction?.action === action;
  const showPending = pending || isRowActionPending;
  const label = showPending && currentStep ? `${currentStep}...` : pendingText;

  return (
    <Button
      {...props}
      disabled={disabled || showPending}
      aria-busy={showPending}
      className={cn(
        className,
        "reconciliation-btn-content",
        // Pending: keep the button fully readable — the base variant's
        // disabled:opacity-50 would stack with the pending pulse animation
        // and leave a near-invisible "ghost" button.
        showPending && "reconciliation-btn-pending cursor-wait disabled:opacity-90",
        // Explicitly disabled: a visible, readable disabled state instead of
        // stacked opacities (no white-on-pale text, label stays legible).
        disabled &&
          !showPending &&
          "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500 shadow-none disabled:opacity-100",
      )}
    >
      {showPending ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="ops-submit-spinner reconciliation-spinner-enter inline-block h-3 w-3 rounded-full border-2 border-current/30 border-t-current"
            aria-hidden="true"
          />
          <span className="font-medium">{label}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
