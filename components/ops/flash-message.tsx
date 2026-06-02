import { cn } from "@/lib/utils";

export function FlashMessage({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm font-medium",
        tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-900",
      )}
    >
      {message}
    </div>
  );
}
