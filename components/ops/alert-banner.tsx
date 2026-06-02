import Link from "next/link";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function AlertBanner({
  title,
  description,
  href,
  tone = "warning",
}: {
  title: string;
  description: string;
  href?: string;
  tone?: "warning" | "danger" | "info";
}) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-950",
    info: "border-blue-200 bg-blue-50 text-blue-950",
  }[tone];

  const Icon = tone === "info" ? Info : AlertTriangle;

  const content = (
    <div className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", styles)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs opacity-80">{description}</p>
      </div>
      {href ? <ArrowRight className="h-4 w-4 shrink-0 opacity-60" /> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition hover:opacity-90">
      {content}
    </Link>
  ) : (
    content
  );
}
