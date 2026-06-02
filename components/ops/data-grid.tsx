import { cn } from "@/lib/utils";

export function DataGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-white shadow-sm", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataGridHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b bg-slate-50/95 backdrop-blur">
      <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">{children}</tr>
    </thead>
  );
}

export function DataGridTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2.5 font-medium", className)}>{children}</th>;
}

export function DataGridBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function DataGridRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("text-sm transition-colors hover:bg-slate-50/80", className)}>{children}</tr>;
}

export function DataGridTd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}
