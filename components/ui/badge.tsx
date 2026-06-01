import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "success" | "warning" | "danger" | "neutral";
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  const tones = {
    default: "bg-primary/10 text-emerald-800",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    neutral: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
