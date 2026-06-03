import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Helper / hint text rendered beneath form fields. Keep it short and
 * operational — explain the consequence of a field, not the obvious.
 */
export function HelperText({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ops-helper mt-1.5", className)} {...props} />;
}

export function FieldError({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;
  return (
    <p className={cn("mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-rose-600", className)} {...props}>
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

/**
 * Field — a small composer for a labelled control with optional hint/error.
 * Pairs the Label and HelperText/FieldError styling consistently.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-[13px] font-medium tracking-tight text-slate-700">
          {label}
          {required ? <span className="text-rose-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <HelperText>{hint}</HelperText> : null}
    </div>
  );
}
