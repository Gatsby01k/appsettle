import { Check, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApproveSettlement } from "@/lib/permissions";
import { ACCESS_ROLES, DEMO_TEAM } from "@/lib/treasury";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

export default async function TeamPage() {
  const { user, organization } = await requireSession();

  // Real, login-capable members of this organization (read-only — RBAC and
  // auth are untouched). These are the users who can actually act in the app,
  // including the dual-control finality approver.
  const memberships = await prisma.membership.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  const realMembers = memberships.map((membership) => ({
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    isYou: membership.user.id === user.id,
    canApprove: canApproveSettlement(membership.role),
    lastLoginAt: membership.user.lastLoginAt,
  }));

  const approverCount = realMembers.filter((member) => member.canApprove).length;
  const dualControlPossible = approverCount >= 2 || (approverCount >= 1 && realMembers.length >= 2);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & access"
        description="Role-based access control for treasury, settlement, compliance and finance teams."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Database members" value={realMembers.length} hint="Can sign in and act" />
        <MetricCard label="Finality approvers" value={approverCount} hint="Can approve settlements & finality" tone="success" />
        <MetricCard
          label="Dual control"
          value={dualControlPossible ? "Available" : "Not yet"}
          hint={
            dualControlPossible
              ? "A second operator can approve finality"
              : "Add a second member (npm run demo:approver)"
          }
          tone={dualControlPossible ? "success" : "warning"}
        />
      </div>

      {/* Dual-control explainer */}
      <div className="flex items-start gap-2 rounded-xl border border-[var(--ops-line)] bg-white p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald-ink" />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Dual control:</span> LIVE_TEST finality requires approval by
          a second operator. Creators can&apos;t approve their own settlements.
        </p>
      </div>

      {/* Real database members */}
      <div>
        <p className="ops-eyebrow mb-2">Organization members · database users</p>
        <DataGrid>
          <table className="w-full min-w-[680px]">
            <DataGridHead>
              <DataGridTh>Member</DataGridTh>
              <DataGridTh>Role</DataGridTh>
              <DataGridTh>Finality approval</DataGridTh>
              <DataGridTh>Last sign-in</DataGridTh>
            </DataGridHead>
            <DataGridBody>
              {realMembers.map((member) => (
                <DataGridRow key={member.email}>
                  <DataGridTd>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-950">{member.name}</p>
                      {member.isYou ? <span className="case-chip case-chip--shadow">you</span> : null}
                      <span className="case-chip border-emerald-200 bg-emerald-50 text-emerald-700">DB user</span>
                    </div>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </DataGridTd>
                  <DataGridTd>
                    <Badge tone={member.role === "OWNER" ? "info" : "neutral"}>{member.role}</Badge>
                  </DataGridTd>
                  <DataGridTd>
                    {member.canApprove ? (
                      <span className="case-chip case-chip--gold">Can approve finality</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </DataGridTd>
                  <DataGridTd className="text-xs text-slate-500">
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                  </DataGridTd>
                </DataGridRow>
              ))}
            </DataGridBody>
          </table>
        </DataGrid>
      </div>

      {/* Role matrix */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESS_ROLES.map((role) => (
          <Card key={role.role}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge tone={role.role === "OWNER" ? "info" : "neutral"}>{role.role}</Badge>
              </CardTitle>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {role.permissions.map((permission) => (
                  <li key={permission} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-brand-emerald-ink" />
                    {permission}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Demo roster — display-only sample data, clearly separated */}
      <div>
        <p className="ops-eyebrow mb-2">
          Sample directory <span className="case-chip case-chip--demo ml-1">display only</span>
        </p>
        <DataGrid>
          <table className="w-full min-w-[680px]">
            <DataGridHead>
              <DataGridTh>Member</DataGridTh>
              <DataGridTh>Role</DataGridTh>
              <DataGridTh>Last active (sample)</DataGridTh>
              <DataGridTh>Status</DataGridTh>
            </DataGridHead>
            <DataGridBody>
              {DEMO_TEAM.map((member) => (
                <DataGridRow key={member.email}>
                  <DataGridTd>
                    <p className="font-medium text-slate-950">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </DataGridTd>
                  <DataGridTd>
                    <Badge tone="neutral">{member.role}</Badge>
                  </DataGridTd>
                  <DataGridTd className="text-xs text-slate-500">{member.lastActive}</DataGridTd>
                  <DataGridTd>
                    <StatusBadge status={member.status} />
                  </DataGridTd>
                </DataGridRow>
              ))}
            </DataGridBody>
          </table>
        </DataGrid>
      </div>
    </div>
  );
}
