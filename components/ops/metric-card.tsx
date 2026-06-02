import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const valueTone: Record<string, string> = {
    neutral: "text-[#07132b]",
    success: "text-teal-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
    info: "text-sky-700",
  };

  const accent: Record<string, string> = {
    neutral: "before:bg-[#07132b]/15",
    success: "before:bg-[#42d5b7]",
    warning: "before:bg-[#f5a300]",
    danger: "before:bg-rose-500",
    info: "before:bg-[#4fe3ff]",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md",
        "before:absolute before:inset-y-0 before:left-0 before:w-0.5",
        accent[tone],
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", valueTone[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
