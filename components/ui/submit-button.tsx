"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
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
    <Button {...props} disabled={disabled || showPending} aria-busy={showPending}>
      {showPending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{label}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
