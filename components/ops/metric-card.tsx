import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
type Variant = "default" | "mission";

export function MetricCard({
  label,
  value,
  valueTitle,
  hint,
  tone = "neutral",
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  /** Full-precision value surfaced on hover when `value` is shown compact. */
  valueTitle?: string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
  variant?: Variant;
}) {
  const valueTone: Record<Tone, string> = {
    neutral: "text-brand-ink",
    success: "text-brand-emerald-ink",
    warning: "text-[#9b6810]",
    danger: "text-rose-700",
    info: "text-[#0a7d86]",
  };

  const rail: Record<Tone, string> = {
    neutral: "bg-brand-ink/15",
    success: "bg-brand-emerald",
    warning: "bg-brand-amber",
    danger: "bg-rose-500",
    info: "bg-brand-aqua",
  };

  const iconWrap: Record<Tone, string> = {
    neutral: "bg-slate-100 text-slate-500 ring-slate-200/70",
    success: "bg-[#e7faf4] text-brand-emerald-ink ring-[#00c79d]/25",
    warning: "bg-[#fff5de] text-[#9b6810] ring-[#f2ad23]/25",
    danger: "bg-rose-50 text-rose-600 ring-rose-200/70",
    info: "bg-[#e7f7fb] text-[#0a7d86] ring-[#0bb4c4]/22",
  };

  if (variant === "mission") {
    return (
      <div className="mission-metric relative overflow-hidden rounded-xl border border-[var(--ops-line-soft)] bg-white/72 px-3 py-2.5 backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-[220ms] hover:-translate-y-px hover:border-[rgba(0,199,157,0.22)] hover:shadow-[var(--ops-shadow-sm)]">
        <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-full", rail[tone])} />
        <div className="flex items-center justify-between gap-2 pl-1">
          <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">{label}</p>
          {Icon ? (
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md ring-1", iconWrap[tone])}>
              <Icon className="h-3 w-3" />
            </span>
          ) : null}
        </div>
        <p
          title={valueTitle ?? (typeof value === "string" ? value : undefined)}
          className={cn(
            "mt-1 min-w-0 truncate whitespace-nowrap pl-1 text-[22px] font-semibold leading-none tracking-tight tabular-nums",
            valueTone[tone],
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 truncate pl-1 text-[11px] text-slate-500">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="ops-panel ops-card-hover relative overflow-hidden p-[18px] pl-5">
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-full", rail[tone])} />
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] font-medium uppercase tracking-[0.06em] text-slate-500">{label}</p>
        {Icon ? (
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1", iconWrap[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p
        title={valueTitle ?? (typeof value === "string" ? value : undefined)}
        className={cn(
          "mt-2 min-w-0 truncate whitespace-nowrap text-[26px] font-semibold leading-none tracking-tight tabular-nums",
          valueTone[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 truncate text-[12.5px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
