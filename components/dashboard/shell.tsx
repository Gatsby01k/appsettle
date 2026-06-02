import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Building2, FileClock, LayoutDashboard, Scale, Settings, WalletCards } from "lucide-react";
import { clearSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/quotes", label: "Quotes", icon: WalletCards },
  { href: "/settlements", label: "Settlements", icon: Activity },
  { href: "/reconciliation", label: "Reconciliation", icon: Scale },
  { href: "/audit-logs", label: "Audit Logs", icon: FileClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

async function logout() {
  "use server";
  await clearSession();
  redirect("/login");
}

export function DashboardShell({
  children,
  organizationName,
  userName,
}: {
  children: React.ReactNode;
  organizationName: string;
  userName: string;
}) {
  return (
    <div className="min-h-screen text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-slate-200/70 bg-white/75 p-5 shadow-[12px_0_48px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-3xl border border-slate-200/70 bg-white/80 p-3 shadow-sm">
          <Image src="/assets/mark.png" alt="INRSettle" width={44} height={44} className="rounded-2xl" />
          <div>
            <div className="font-semibold tracking-[-0.03em]">INRSettle</div>
            <div className="text-xs text-slate-500">{organizationName}</div>
          </div>
        </Link>
        <div className="mt-5 rounded-3xl border border-emerald-200/70 bg-emerald-50/80 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <Building2 className="h-4 w-4" />
            Treasury workspace
          </div>
          <p className="mt-3 text-sm leading-6 text-emerald-950/70">Monitor quotes, settlement lifecycle, reconciliation, and audit evidence from one operations console.</p>
        </div>
        <nav className="mt-6 grid gap-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-950 hover:text-white"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-white/15 group-hover:text-white">
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          );})}
        </nav>
      </aside>
      <div className="lg:pl-80">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200/70 bg-white/70 px-4 backdrop-blur-xl lg:px-8">
          <div>
            <p className="text-sm font-semibold text-slate-950">{organizationName}</p>
            <p className="text-xs text-slate-500">Signed in as {userName}</p>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
