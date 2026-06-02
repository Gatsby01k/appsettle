import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ops/status-badge";

export function ActivityItem({
  action,
  actor,
  timestamp,
  resource,
  detail,
  tone = "neutral",
}: {
  action: string;
  actor: string;
  timestamp: string;
  resource: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const dot = {
    neutral: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-blue-500",
  }[tone];

  return (
    <div className="relative flex gap-3 pb-5 pl-5 last:pb-0">
      <span className={cn("absolute left-0 top-1.5 h-2 w-2 rounded-full ring-4 ring-white", dot)} />
      <div className="min-w-0 flex-1 border-l border-slate-200 pl-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={action} />
          <span className="text-sm font-medium text-slate-950">{resource}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
        <p className="mt-1 text-xs text-slate-500">
          {actor} · {timestamp}
        </p>
      </div>
    </div>
  );
}
