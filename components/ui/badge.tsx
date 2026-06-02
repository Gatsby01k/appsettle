import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "success" | "warning" | "danger" | "neutral" | "info";
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-teal-50 text-teal-800 ring-1 ring-teal-200/80",
    warning: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
    danger: "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80",
    neutral: "bg-slate-100 text-slate-600",
    info: "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80",
  };

  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}
