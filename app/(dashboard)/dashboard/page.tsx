import Link from "next/link";
import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { availableBalance } from "@/lib/treasury";
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

  const [
    settlements,
    activeQuotes,
    reconExceptions,
    auditLogs,
    expiredQuotes,
    pendingApprovals,
    reconciledToday,
    pendingVolume,
    settledVolume,
    reconciledVolume,
    settlementsByStatus,
    settledForAvg,
    latestExceptions,
  ] = await Promise.all([
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
    prisma.settlement.aggregate({
      _sum: { sourceAmount: true },
      where: {
        organizationId: organization.id,
        status: { in: [SettlementStatus.REQUESTED, SettlementStatus.APPROVED, SettlementStatus.EXECUTING] },
      },
    }),
    prisma.settlement.aggregate({
      _sum: { sourceAmount: true },
      where: { organizationId: organization.id, status: SettlementStatus.SETTLED },
    }),
    prisma.settlement.aggregate({
      _sum: { sourceAmount: true },
      where: { organizationId: organization.id, status: SettlementStatus.RECONCILED },
    }),
    prisma.settlement.groupBy({
      by: ["status"],
      where: { organizationId: organization.id },
      _count: { _all: true },
    }),
    prisma.settlement.findMany({
      where: { organizationId: organization.id, settledAt: { not: null } },
      select: { createdAt: true, settledAt: true },
      orderBy: { settledAt: "desc" },
      take: 50,
    }),
    prisma.reconciliationRecord.findMany({
      where: { organizationId: organization.id, status: "EXCEPTION" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const availableInr = availableBalance("INR");
  const availableUsdt = availableBalance("USDT");
  const pendingVolumeValue = Number(pendingVolume._sum.sourceAmount ?? 0);
  const settledVolumeValue = Number(settledVolume._sum.sourceAmount ?? 0);
  const reconciledVolumeValue = Number(reconciledVolume._sum.sourceAmount ?? 0);

  const statusCount = (status: SettlementStatus) =>
    settlementsByStatus.find((row) => row.status === status)?._count._all ?? 0;
  const totalSettlements = settlementsByStatus.reduce((sum, row) => sum + row._count._all, 0);
  const settledCount = statusCount(SettlementStatus.SETTLED);
  const reconciledCount = statusCount(SettlementStatus.RECONCILED);
  const failedCount = statusCount(SettlementStatus.FAILED) + statusCount(SettlementStatus.CANCELLED);
  const completedCount = settledCount + reconciledCount;
  const successRate = totalSettlements ? Math.round(((completedCount) / totalSettlements) * 100) : 0;
  const reconciledRate = completedCount ? Math.round((reconciledCount / completedCount) * 100) : 0;

  const avgMinutes =
    settledForAvg.length > 0
      ? Math.round(
          settledForAvg.reduce(
            (sum, row) => sum + (new Date(row.settledAt as Date).getTime() - new Date(row.createdAt).getTime()),
            0,
          ) /
            settledForAvg.length /
            60000,
        )
      : 0;
  const avgSettlementTime =
    avgMinutes <= 0
      ? "—"
      : avgMinutes < 60
        ? `${avgMinutes}m`
        : `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`;

  const activeStatuses = new Set<SettlementStatus>([
    SettlementStatus.REQUESTED,
    SettlementStatus.APPROVED,
    SettlementStatus.EXECUTING,
  ]);
  const activeSettlements = settlements.filter((s) => activeStatuses.has(s.status)).length;
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

      <section>
        <SectionHeader
          title="Treasury snapshot"
          description="Available balances and settlement volume across the lifecycle"
          action={
            <Link href="/accounts" className="text-xs font-medium text-slate-600 hover:text-slate-950">
              View accounts
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Available INR" value={formatCurrency(availableInr, "INR")} hint="Fiat accounts" tone="success" />
          <MetricCard label="Available USDT" value={formatCurrency(availableUsdt, "USDT")} hint="Treasury wallet" tone="info" />
          <MetricCard label="Pending volume" value={formatCurrency(pendingVolumeValue)} hint="In workflow" tone="warning" />
          <MetricCard label="Settled volume" value={formatCurrency(settledVolumeValue)} hint="Awaiting reconciliation" />
          <MetricCard label="Reconciled volume" value={formatCurrency(reconciledVolumeValue)} hint="Fully matched" tone="success" />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active settlements" value={activeSettlements} hint="In workflow" />
        <MetricCard label="Approval queue" value={pendingApprovals} hint="Awaiting approval" tone="warning" />
        <MetricCard label="Reconciled today" value={reconciledToday} hint="Since midnight" tone="success" />
        <MetricCard label="Exceptions" value={reconExceptions} hint="Reconciliation" tone={reconExceptions ? "danger" : "neutral"} />
      </div>

      <section>
        <SectionHeader title="Operational intelligence" description="Settlement reliability and reconciliation performance" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Settlement success rate" value={`${successRate}%`} hint={`${completedCount} of ${totalSettlements} completed`} tone="success" />
          <MetricCard label="Auto-reconciled rate" value={`${reconciledRate}%`} hint="Of completed settlements" tone="info" />
          <MetricCard label="Avg settlement time" value={avgSettlementTime} hint="Created → settled" />
          <MetricCard label="Failed / cancelled" value={failedCount} hint="Lifetime" tone={failedCount ? "danger" : "neutral"} />
        </div>
      </section>

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

          {latestExceptions.length ? (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <SectionHeader title="Latest exceptions" />
              <ul className="divide-y">
                {latestExceptions.map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{record.externalRef}</p>
                      <p className="truncate text-xs text-slate-500">
                        {record.exceptionReason ?? record.source.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="tabular-nums text-xs text-slate-500">
                      {formatCurrency(String(record.amount), record.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/reconciliation?status=EXCEPTION"
                className="mt-2 inline-block text-xs font-medium text-teal-700 hover:underline"
              >
                Resolve in reconciliation →
              </Link>
            </div>
          ) : null}

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
              <Link href="/settlements" className="mt-3 inline-block text-xs font-medium text-teal-700 hover:underline">
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
            <table className="w-full min-w-[820px]">
              <DataGridHead>
                <DataGridTh>ID</DataGridTh>
                <DataGridTh>Reference</DataGridTh>
                <DataGridTh>Amount</DataGridTh>
                <DataGridTh>Status</DataGridTh>
                <DataGridTh className="min-w-[220px]">Lifecycle</DataGridTh>
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
                    <DataGridTd className="min-w-[220px]">
                      <SettlementLifecycle status={settlement.status} compact />
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
