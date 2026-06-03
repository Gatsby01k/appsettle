"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/auth/form-field";
import { PasswordField } from "@/components/auth/password-field";

export type LoginState = { error?: string | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 px-3.5 py-3 text-[13px] font-medium text-rose-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function LoginForm({
  action,
}: {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
}) {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(action, { error: null });
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const errors: { email?: string; password?: string } = {};

    if (!email) errors.email = "Enter your work email.";
    else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    formAction(formData);
  }

  return (
    <form action={handleSubmit} noValidate className="space-y-4">
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <FormField id="email" label="Work email" required error={fieldErrors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@company.com"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
      </FormField>

      <PasswordField
        id="password"
        name="password"
        label="Password"
        required
        autoComplete="current-password"
        placeholder="Enter your password"
        error={fieldErrors.password}
        action={
          <Link
            href="/contact?intent=access"
            className="text-[12.5px] font-medium text-brand-emerald-ink transition-colors hover:text-brand-emerald"
          >
            Forgot password?
          </Link>
        }
      />

      <Button type="submit" size="lg" variant="primary" disabled={isPending} className="mt-1 w-full">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in to console"
        )}
      </Button>
    </form>
  );
}
