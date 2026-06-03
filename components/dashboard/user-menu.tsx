"use client";

import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({
  userName,
  organizationName,
  logoutAction,
}: {
  userName: string;
  organizationName: string;
  logoutAction: () => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2 text-left shadow-ops-xs transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-ink text-[11px] font-semibold text-white">
          {initials(userName)}
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-[13px] font-medium text-slate-900">{userName}</span>
          <span className="block truncate text-[11px] text-slate-500">{organizationName}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="border-b border-slate-100 px-2.5 py-2 sm:hidden">
          <p className="truncate text-[13px] font-medium text-slate-900">{userName}</p>
          <p className="truncate text-[11px] text-slate-500">{organizationName}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
