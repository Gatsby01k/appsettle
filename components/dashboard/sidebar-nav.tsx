"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FileClock, LayoutDashboard, Scale, Settings, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/quotes", label: "Quotes", icon: WalletCards },
  { href: "/settlements", label: "Settlements", icon: Activity },
  { href: "/reconciliation", label: "Reconciliation", icon: Scale },
  { href: "/audit-logs", label: "Audit logs", icon: FileClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-[#07132b] text-white lg:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
        <Image src="/assets/mark.png" alt="" width={28} height={28} className="rounded-md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">INRSettle</p>
          <p className="truncate text-xs text-white/55">{organizationName}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2" aria-label="Primary">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              {active ? (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#42d5b7]" />
              ) : null}
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#42d5b7]" : "text-white/45")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <p className="text-[11px] leading-relaxed text-white/40">Treasury operations console</p>
      </div>
    </aside>
  );
}
