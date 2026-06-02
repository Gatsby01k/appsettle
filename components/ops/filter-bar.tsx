"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FilterBar({
  statusOptions = [],
  searchPlaceholder = "Search...",
}: {
  statusOptions?: string[];
  searchPlaceholder?: string;
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

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        apply({ q: String(data.get("q") ?? ""), status: String(data.get("status") ?? "") });
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input name="q" defaultValue={searchParams.get("q") ?? ""} placeholder={searchPlaceholder} className="pl-9" />
      </div>
      {statusOptions.length ? (
        <select
          name="status"
          defaultValue={searchParams.get("status") ?? ""}
          className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm sm:w-44"
        >
          <option value="">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="h-9">
        {pending ? "Filtering..." : "Apply"}
      </Button>
    </form>
  );
}
