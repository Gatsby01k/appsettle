"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/auth/form-field";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  action?: React.ReactNode;
  /** Optional decorative leading icon (display only). */
  leadingIcon?: React.ReactNode;
};

export function PasswordField({ id, label, error, hint, action, leadingIcon, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <FormField id={id} label={label} error={error} hint={hint} required={props.required} action={action}>
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {leadingIcon}
          </span>
        ) : null}
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className={cn("pr-11", leadingIcon && "pl-10", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 transition-colors hover:text-slate-700 focus-visible:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald/40"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </FormField>
  );
}
