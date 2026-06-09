"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ops/segmented";
import { cn } from "@/lib/utils";

export function FilterBar({
  statusOptions = [],
  searchPlaceholder = "Search...",
  embedded = false,
}: {
  statusOptions?: string[];
  searchPlaceholder?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams],
  );

  const activeStatus = searchParams.get("status") ?? "";
  const activeQuery = searchParams.get("q") ?? "";

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 p-2.5 lg:flex-row lg:items-center lg:justify-between",
        embedded ? "border-b border-[var(--ops-line-soft)] bg-slate-50/50" : "ops-panel gap-3 p-3",
      )}
    >
      <form
        className="relative w-full min-w-0 lg:max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          apply({ q: String(data.get("q") ?? "") });
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          name="q"
          defaultValue={activeQuery}
          placeholder={searchPlaceholder}
          aria-label="Search"
          className="pl-9 pr-9"
        />
        {activeQuery ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => apply({ q: "" })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </form>

      {statusOptions.length ? (
        <div className={cn("flex items-center gap-2 overflow-x-auto", pending && "opacity-60")}>
          <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400 sm:inline">
            Status
          </span>
          <Segmented
            ariaLabel="Filter by status"
            size="sm"
            value={activeStatus}
            onChange={(next) => apply({ status: next })}
            options={[
              { value: "", label: "All" },
              ...statusOptions.map((status) => ({
                value: status,
                label: status.replaceAll("_", " "),
              })),
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
