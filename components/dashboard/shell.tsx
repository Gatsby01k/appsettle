import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { CommandPalette } from "@/components/dashboard/command-palette";

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
    <div className="app-surface min-h-screen text-slate-950">
      <SidebarNav organizationName={organizationName} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[var(--ops-line)] bg-white/75 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <MobileNav organizationName={organizationName} />
            <CommandPalette />
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{organizationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <UserMenu userName={userName} organizationName={organizationName} logoutAction={logout} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
