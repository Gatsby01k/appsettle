import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/quotes", label: "Quotes" },
  { href: "/settlements", label: "Settlements" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/audit-logs", label: "Audit Logs" },
  { href: "/settings", label: "Settings" },
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
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r bg-white/80 p-5 backdrop-blur lg:block">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/assets/mark.png" alt="INRSettle" width={42} height={42} className="rounded-xl" />
          <div>
            <div className="font-bold tracking-tight">INRSettle</div>
            <div className="text-xs text-muted-foreground">{organizationName}</div>
          </div>
        </Link>
        <nav className="mt-8 grid gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white/80 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-semibold">{organizationName}</p>
            <p className="text-xs text-muted-foreground">Signed in as {userName}</p>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
