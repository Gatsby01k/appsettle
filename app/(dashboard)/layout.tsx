import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <DashboardShell
      organizationName={session.organization.displayName}
      userName={session.user.name}
    >
      {children}
    </DashboardShell>
  );
}
