"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption = { value: string; label: string; count?: number };

/**
 * Compact segmented control — preferred over a dropdown when there are only a
 * handful of options. Renders as an accessible radio-style group.
 */
export function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
  size = "default",
  className,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--ops-line)] bg-slate-100/70 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active
                ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(7,17,31,0.08),0_4px_10px_rgba(7,17,31,0.06)]"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-brand-emerald/15 text-brand-emerald-ink" : "bg-slate-200/80 text-slate-500",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
