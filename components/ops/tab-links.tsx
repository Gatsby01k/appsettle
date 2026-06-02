import Link from "next/link";
import { cn } from "@/lib/utils";

export function TabLinks({
  tabs,
  active,
  basePath,
  preserve,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  basePath: string;
  preserve?: Record<string, string>;
}) {
  return (
    <div className="inline-flex h-9 items-center gap-1 rounded-lg border bg-slate-100/80 p-1">
      {tabs.map((tab) => {
        const params = new URLSearchParams(preserve);
        params.set("tab", tab.id);
        return (
          <Link
            key={tab.id}
            href={`${basePath}?${params.toString()}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition",
              active === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="rounded-full bg-slate-200 px-1.5 text-[10px] tabular-nums text-slate-600">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
