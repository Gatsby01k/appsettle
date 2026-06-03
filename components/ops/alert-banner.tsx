import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertTone = "success" | "warning" | "danger" | "info";

const STYLES: Record<AlertTone, { wrap: string; chip: string; icon: LucideIcon }> = {
  success: {
    wrap: "border-[#00c79d]/25 bg-[#e7faf4]/70 text-[#075c4d]",
    chip: "bg-[#00c79d]/15 text-brand-emerald-ink",
    icon: CheckCircle2,
  },
  warning: {
    wrap: "border-[#f2ad23]/30 bg-[#fff8e8]/80 text-[#6c4a0f]",
    chip: "bg-[#f2ad23]/18 text-[#a5670a]",
    icon: AlertTriangle,
  },
  danger: {
    wrap: "border-rose-200 bg-rose-50/80 text-rose-900",
    chip: "bg-rose-100 text-rose-600",
    icon: AlertTriangle,
  },
  info: {
    wrap: "border-[#0bb4c4]/25 bg-[#e7f7fb]/70 text-[#0a5b66]",
    chip: "bg-[#0bb4c4]/15 text-[#0a7d86]",
    icon: Info,
  },
};

export function AlertBanner({
  title,
  description,
  href,
  tone = "warning",
}: {
  title: string;
  description: string;
  href?: string;
  tone?: AlertTone;
}) {
  const style = STYLES[tone];
  const Icon = style.icon;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-shadow",
        style.wrap,
        href && "hover:shadow-ops-sm",
      )}
    >
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", style.chip)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold tracking-tight">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed opacity-80">{description}</p>
      </div>
      {href ? <ArrowRight className="h-4 w-4 shrink-0 opacity-50" /> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
