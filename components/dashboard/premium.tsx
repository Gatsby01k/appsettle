import { ArrowUpRight, Circle, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {eyebrow}
        </div>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 md:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tone = "emerald",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: "emerald" | "slate" | "amber" | "rose";
}) {
  const tones = {
    emerald: "from-emerald-500/16 to-emerald-500/0 text-emerald-700",
    slate: "from-slate-500/14 to-slate-500/0 text-slate-700",
    amber: "from-amber-500/18 to-amber-500/0 text-amber-700",
    rose: "from-rose-500/16 to-rose-500/0 text-rose-700",
  };

  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b", tones[tone])} />
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <ArrowUpRight className="h-4 w-4 text-slate-400" />
        </div>
        <div className="mt-7 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{value}</div>
        <p className="mt-2 text-sm text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function PremiumStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone =
    ["SETTLED", "RECONCILED", "APPROVED", "MATCHED", "ACTIVE"].includes(normalized)
      ? "success"
      : ["FAILED", "CANCELLED", "EXCEPTION", "REJECTED"].includes(normalized)
        ? "danger"
        : ["EXECUTING", "REQUESTED", "OPEN", "PARTIALLY_MATCHED"].includes(normalized)
          ? "warning"
          : "neutral";

  return <Badge tone={tone}>{normalized.replaceAll("_", " ")}</Badge>;
}

export function FilterBar({
  searchName = "q",
  searchPlaceholder = "Search by reference...",
  statusName = "status",
  statusOptions = [],
  defaultSearch,
  defaultStatus,
}: {
  searchName?: string;
  searchPlaceholder?: string;
  statusName?: string;
  statusOptions?: string[];
  defaultSearch?: string;
  defaultStatus?: string;
}) {
  return (
    <form className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-white/80 p-3 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur md:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          name={searchName}
          defaultValue={defaultSearch}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-2xl border border-transparent bg-slate-50 pl-10 pr-3 text-sm outline-none ring-0 transition focus:border-emerald-200 focus:bg-white"
        />
      </div>
      {statusOptions.length ? (
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            name={statusName}
            defaultValue={defaultStatus ?? ""}
            className="h-11 min-w-48 rounded-2xl border border-transparent bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-200 focus:bg-white"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
      ) : null}
      <button className="h-11 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800">
        Apply filters
      </button>
    </form>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">
        <Circle className="h-4 w-4 text-emerald-500" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export function Lifecycle({
  active,
}: {
  active: string;
}) {
  const steps = ["REQUESTED", "APPROVED", "EXECUTING", "SETTLED", "RECONCILED"];
  const activeIndex = Math.max(0, steps.indexOf(active));

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {steps.map((step, index) => {
        const isDone = index <= activeIndex;
        return (
          <div key={step} className={cn("rounded-2xl border p-4", isDone ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white/70")}>
            <div className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-bold", isDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}>
              {index + 1}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{step}</p>
          </div>
        );
      })}
    </div>
  );
}

