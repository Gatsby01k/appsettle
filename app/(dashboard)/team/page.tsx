import { Check } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { ACCESS_ROLES, DEMO_TEAM } from "@/lib/treasury";
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
  const { user } = await requireSession();

  const members = [
    { name: user.name, email: user.email, role: "OWNER" as const, status: "ACTIVE" as const, lastActive: "Now (you)" },
    ...DEMO_TEAM,
  ];

  const activeMembers = members.filter((m) => m.status === "ACTIVE").length;
  const pendingInvites = members.filter((m) => m.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & access"
        description="Role-based access control for treasury, settlement, compliance and finance teams."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Members" value={members.length} hint="In this organization" />
        <MetricCard label="Active" value={activeMembers} hint="Signed-in access" tone="success" />
        <MetricCard label="Pending invites" value={pendingInvites} hint="Awaiting acceptance" tone="warning" />
      </div>

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
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#0c8f78]" />
                    {permission}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataGrid>
        <table className="w-full min-w-[680px]">
          <DataGridHead>
            <DataGridTh>Member</DataGridTh>
            <DataGridTh>Role</DataGridTh>
            <DataGridTh>Last active</DataGridTh>
            <DataGridTh>Status</DataGridTh>
          </DataGridHead>
          <DataGridBody>
            {members.map((member) => (
              <DataGridRow key={member.email}>
                <DataGridTd>
                  <p className="font-medium text-slate-950">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </DataGridTd>
                <DataGridTd>
                  <Badge tone={member.role === "OWNER" ? "info" : "neutral"}>{member.role}</Badge>
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
  );
}
