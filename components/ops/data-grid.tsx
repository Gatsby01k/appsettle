import { cn } from "@/lib/utils";

export function DataGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ops-panel overflow-hidden", className)}>
      <div className="ops-scroll overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataGridHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-slate-200/80 bg-slate-50/80 backdrop-blur">
      <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">{children}</tr>
    </thead>
  );
}

export function DataGridTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-semibold first:pl-5 last:pr-5", className)}>{children}</th>;
}

export function DataGridBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function DataGridRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn("text-sm text-slate-700 transition-colors hover:bg-brand-emerald/[0.05]", className)}>
      {children}
    </tr>
  );
}

export function DataGridTd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3.5 align-middle first:pl-5 last:pr-5", className)}>{children}</td>;
}
