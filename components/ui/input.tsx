import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-1 text-sm text-slate-900 shadow-ops-xs transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-brand-emerald focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-emerald/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
