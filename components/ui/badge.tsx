import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "danger" | "neutral" | "info";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
};

const TONES: Record<BadgeTone, string> = {
  default: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/70",
  success: "bg-[#e7faf4] text-brand-emerald-ink ring-1 ring-inset ring-[#00c79d]/20",
  warning: "bg-[#fff5de] text-[#9b6810] ring-1 ring-inset ring-[#f2ad23]/25",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/80",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/70",
  info: "bg-[#e7f7fb] text-[#0a7d86] ring-1 ring-inset ring-[#0bb4c4]/22",
};

const DOTS: Record<BadgeTone, string> = {
  default: "bg-slate-400",
  success: "bg-brand-emerald",
  warning: "bg-brand-amber",
  danger: "bg-rose-500",
  neutral: "bg-slate-400",
  info: "bg-brand-aqua",
};

export function Badge({ className, tone = "default", dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold tracking-tight tabular-nums",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[tone])} /> : null}
      {children}
    </span>
  );
}
