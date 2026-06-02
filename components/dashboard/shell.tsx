import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
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
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <CommandPalette />
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-medium">{organizationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{userName}</span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
