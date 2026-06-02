import Link from "next/link";
import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PageHeader, SectionHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { ActivityItem } from "@/components/ops/activity-item";
import { AlertBanner } from "@/components/ops/alert-banner";
import { QuickActions } from "@/components/ops/quick-actions";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import { StatusBadge } from "@/components/ops/status-badge";
import { EmptyState } from "@/components/ops/empty-state";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

function auditTone(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (action.includes("EXCEPTION") || action.includes("FAILED")) return "danger";
  if (action.includes("APPROVED") || action.includes("MATCHED") || action.includes("SETTLED") || action.includes("RECONCILED")) {
    return "success";
  }
  if (action.includes("REQUESTED") || action.includes("EXECUTING")) return "warning";
  if (action.includes("CREATE")) return "info";
  return "neutral";
}

export default async function DashboardPage() {
  const { organization } = await requireSession();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [settlements, activeQuotes, reconExceptions, auditLogs, expiredQuotes, pendingApprovals, reconciledToday] =
    await Promise.all([
      prisma.settlement.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.quote.count({ where: { organizationId: organization.id, status: "ACTIVE" } }),
      prisma.reconciliationRecord.count({ where: { organizationId: organization.id, status: "EXCEPTION" } }),
      prisma.auditLog.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: true },
      }),
      prisma.quote.count({
        where: {
          organizationId: organization.id,
          OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lt: now } }],
        },
      }),
      prisma.settlement.count({ where: { organizationId: organization.id, status: SettlementStatus.REQUESTED } }),
      prisma.settlement.count({
        where: { organizationId: organization.id, status: SettlementStatus.RECONCILED, reconciledAt: { gte: startOfDay } },
      }),
    ]);

  const activeStatuses = new Set<SettlementStatus>([
    SettlementStatus.REQUESTED,
    SettlementStatus.APPROVED,
    SettlementStatus.EXECUTING,
  ]);
  const activeSettlements = settlements.filter((s) => activeStatuses.has(s.status)).length;
  const volume = settlements.reduce((sum, s) => sum + Number(s.sourceAmount), 0);
  const spotlight = settlements[0];

  const alerts = [
    reconExceptions > 0
      ? { title: `${reconExceptions} reconciliation exceptions`, description: "Unmatched or exception records need review.", href: "/reconciliation?status=EXCEPTION", tone: "danger" as const }
      : null,
    pendingApprovals > 0
      ? { title: `${pendingApprovals} pending approvals`, description: "Settlements awaiting treasury approval.", href: "/settlements?status=REQUESTED", tone: "warning" as const }
      : null,
    expiredQuotes > 0
      ? { title: `${expiredQuotes} expired quotes`, description: "Refresh quotes before creating settlements.", href: "/quotes?tab=expired", tone: "info" as const }
      : null,
  ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Treasury operations snapshot across settlements, quotes, reconciliation, and audit activity."
        actions={<QuickActions />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Active settlements" value={activeSettlements} hint="In workflow" />
        <MetricCard label="Pending approvals" value={pendingApprovals} hint="Requested" tone="warning" />
        <MetricCard label="Reconciled today" value={reconciledToday} hint="Since midnight" tone="success" />
        <MetricCard label="Settlement volume" value={formatCurrency(volume)} hint="Recent queue" />
        <MetricCard label="Approval queue" value={pendingApprovals} hint="Needs action" tone="warning" />
        <MetricCard label="Exceptions" value={reconExceptions} hint="Reconciliation" tone={reconExceptions ? "danger" : "neutral"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeader title="Recent activity" description="Latest operational events" />
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            {auditLogs.length ? (
              auditLogs.map((log) => (
                <ActivityItem
                  key={log.id}
                  action={log.action}
                  actor={log.user?.email ?? log.actorType}
                  timestamp={formatDateTime(log.createdAt)}
                  resource={log.resourceType.replaceAll("_", " ")}
                  detail={log.action.replaceAll("_", " ").toLowerCase()}
                  tone={auditTone(log.action)}
                />
              ))
            ) : (
              <EmptyState title="No activity yet" description="Operational events will appear as your team works." />
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <SectionHeader title="Operational alerts" />
            <div className="space-y-2">
              {alerts.length ? (
                alerts.map((alert) => (
                  <AlertBanner
                    key={alert.title}
                    title={alert.title}
                    description={alert.description}
                    href={alert.href}
                    tone={alert.tone}
                  />
                ))
              ) : (
                <div className="rounded-lg border bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
                  No active alerts. Operations are running smoothly.
                </div>
              )}
            </div>
          </div>

          {spotlight ? (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <SectionHeader title="Latest settlement" />
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-medium text-slate-950">{spotlight.publicId}</p>
                <StatusBadge status={spotlight.status} />
              </div>
              <div className="rounded-lg border bg-slate-50/60 p-3">
                <SettlementLifecycle status={spotlight.status} />
              </div>
              <Link href="/settlements" className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline">
                Open settlements →
              </Link>
            </div>
          ) : null}
        </section>
      </div>

      <section>
        <SectionHeader
          title="Recent settlements"
          action={
            <Link href="/settlements" className="text-xs font-medium text-slate-600 hover:text-slate-950">
              View all
            </Link>
          }
        />
        {settlements.length ? (
          <DataGrid>
            <table className="w-full min-w-[640px]">
              <DataGridHead>
                <DataGridTh>ID</DataGridTh>
                <DataGridTh>Reference</DataGridTh>
                <DataGridTh>Amount</DataGridTh>
                <DataGridTh>Status</DataGridTh>
              </DataGridHead>
              <DataGridBody>
                {settlements.map((settlement) => (
                  <DataGridRow key={settlement.id}>
                    <DataGridTd className="font-medium">{settlement.publicId}</DataGridTd>
                    <DataGridTd className="text-slate-600">{settlement.reference}</DataGridTd>
                    <DataGridTd className="tabular-nums">
                      {formatCurrency(String(settlement.sourceAmount), settlement.sourceCurrency)}
                    </DataGridTd>
                    <DataGridTd>
                      <StatusBadge status={settlement.status} />
                    </DataGridTd>
                  </DataGridRow>
                ))}
              </DataGridBody>
            </table>
          </DataGrid>
        ) : (
          <EmptyState
            title="No settlements yet"
            description="Create a quote, then convert it into your first settlement."
            action={{ label: "Create quote", href: "/quotes" }}
          />
        )}
      </section>

      <p className="text-xs text-slate-500">{activeQuotes} active quotes available for settlement.</p>
    </div>
  );
}
