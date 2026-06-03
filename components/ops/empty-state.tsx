import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
  icon?: LucideIcon;
}) {
  return (
    <div className="ops-panel ops-grid-faint flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-[#00c79d]/15 to-[#0bb4c4]/5 text-brand-emerald-ink ring-1 ring-[#00c79d]/25 shadow-ops-xs">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-[15px] font-semibold tracking-tight text-slate-950">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-slate-500">{description}</p>
      {action ? (
        <Button asChild className="mt-5" variant="primary" size="sm">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
