import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FlashMessage({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  const isError = tone === "error";
  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13.5px] font-medium",
        isError
          ? "border-rose-200 bg-rose-50/80 text-rose-800"
          : "border-[#00c79d]/25 bg-[#e7faf4]/80 text-brand-emerald-ink",
      )}
      role="status"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
