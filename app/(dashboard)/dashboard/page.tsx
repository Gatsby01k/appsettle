import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { autoMatchReconciliation } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { isPontisConfigured } from "@/lib/providers/pontis/client";
import { isPontisGatewayConfigured } from "@/lib/providers/pontis/gateway";
import { cn, formatCurrencyCompact, formatCurrencyFull, formatDateTime, formatPercent } from "@/lib/utils";
import { SectionHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import { StatusBadge } from "@/components/ops/status-badge";
import { EmptyState } from "@/components/ops/empty-state";
import { Button } from "@/components/ui/button";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

function isPontisEnabled() {
  return isPontisGatewayConfigured() || isPontisConfigured();
}

function auditTone(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (action.includes("EXCEPTION") || action.includes("FAILED") || action.includes("failed")) return "danger";
  if (
    action.includes("APPROVED") ||
    action.includes("MATCHED") ||
    action.includes("SETTLED") ||
    action.includes("RECONCILED") ||
    action.includes("settled") ||
    action.includes("auto_match")
  ) {
    return "success";
  }
  if (action.includes("REQUESTED") || action.includes("EXECUTING") || action.includes("transition")) {
    return "warning";
  }
  if (action.includes("CREATE") || action.includes("created") || action.includes("webhook")) return "info";
  return "neutral";
}

function humanizeAuditAction(action: string): string {
  const map: Record<string, string> = {
    "quote.create": "New quote created",
    "settlement.create": "Settlement created",
    "settlement.transition": "Settlement status updated",
    "reconciliation.create": "Reconciliation record created",
    "reconciliation.auto_match": "Settlement reconciled automatically",
    "reconciliation.confirm_match": "Reconciliation match confirmed",
    "reconciliation.reject_match": "Reconciliation match rejected",
    "reconciliation.resolve_exception": "Reconciliation exception resolved",
    "pontis.payout.created": "Pontis payout submitted",
    "pontis.payout.settled": "Pontis payout completed",
    "pontis.payout.status_updated": "Provider status updated",
    "pontis.payout.failed": "Pontis payout failed",
    "pontis.payout.failed_submit": "Pontis payout submission failed",
    "remitquickly.payout.created": "RemitQuickly payout submitted",
    "remitquickly.payout.settled": "RemitQuickly payout completed",
    "remitquickly.payout.failed": "RemitQuickly payout failed",
    "settings.update": "Settings updated",
    "auth.login": "User signed in",
  };
  return map[action] ?? action.replaceAll(".", " · ").replaceAll("_", " ");
}

const RECENT_PROOF_MS = 6 * 60 * 60 * 1000;

function isRecentlyCompleted(
  settlement: { reconciledAt: Date | null; settledAt: Date | null },
  now: Date,
) {
  const completedAt = settlement.reconciledAt ?? settlement.settledAt;
  if (!completedAt) return false;
  const elapsed = now.getTime() - completedAt.getTime();
  return elapsed >= 0 && elapsed < RECENT_PROOF_MS;
}

function reconciliationLabel(
  status: SettlementStatus,
  records: { status: string }[],
): string {
  if (status === SettlementStatus.RECONCILED) return "Reconciled";
  const matched = records.find((r) => ["MATCHED", "AUTO_MATCHED", "MANUAL_MATCHED"].includes(r.status));
  if (matched) return matched.status.replaceAll("_", " ");
  if (records.some((r) => r.status === "EXCEPTION")) return "Exception";
  if (status === SettlementStatus.SETTLED) return "Awaiting match";
  return "—";
}

function auditStatusLabel(status: SettlementStatus): string {
  if (status === SettlementStatus.RECONCILED) return "Recorded";
  if (status === SettlementStatus.SETTLED) return "In progress";
  return "Pending";
}

export default async function DashboardPage() {
  const { user, organization } = await requireSession();
  const now = new Date();
  const pontisConnected = isPontisEnabled();

  try {
    await autoMatchReconciliation(user.id, organization.id);
  } catch {
    // Non-fatal: dashboard still renders current state if matching fails transiently.
  }

  const [
    recentSettlements,
    latestProof,
    reconExceptions,
    auditLogs,
    expiredQuotes,
    pendingApprovals,
    settlementsByStatus,
  ] = await Promise.all([
    prisma.settlement.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { reconciliation: { take: 1, orderBy: { createdAt: "desc" } } },
    }),
    prisma.settlement.findFirst({
      where: {
        organizationId: organization.id,
        status: { in: [SettlementStatus.SETTLED, SettlementStatus.RECONCILED] },
      },
      orderBy: [{ reconciledAt: "desc" }, { settledAt: "desc" }],
      include: { reconciliation: { take: 1, orderBy: { createdAt: "desc" } } },
    }),
    prisma.reconciliationRecord.count({ where: { organizationId: organization.id, status: "EXCEPTION" } }),
    prisma.auditLog.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: true },
    }),
    prisma.quote.count({
      where: {
        organizationId: organization.id,
        OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lt: now } }],
      },
    }),
    prisma.settlement.count({ where: { organizationId: organization.id, status: SettlementStatus.REQUESTED } }),
    prisma.settlement.groupBy({
      by: ["status"],
      where: { organizationId: organization.id },
      _count: { _all: true },
    }),
  ]);

  const statusCount = (status: SettlementStatus) =>
    settlementsByStatus.find((row) => row.status === status)?._count._all ?? 0;
  const settledCount = statusCount(SettlementStatus.SETTLED);
  const reconciledCount = statusCount(SettlementStatus.RECONCILED);
  const completedCount = settledCount + reconciledCount;
  const inFlightCount =
    statusCount(SettlementStatus.APPROVED) + statusCount(SettlementStatus.EXECUTING);
  const reconciledRate = completedCount ? Math.round((reconciledCount / completedCount) * 100) : 0;

  const alerts = [
    reconExceptions > 0
      ? {
          title: `${reconExceptions} reconciliation exception${reconExceptions === 1 ? "" : "s"}`,
          description: "Unmatched records need treasury review before close of day.",
          action: "Open reconciliation",
          href: "/reconciliation?status=EXCEPTION",
          tone: "danger" as const,
        }
      : null,
    pendingApprovals > 0
      ? {
          title: `${pendingApprovals} settlement${pendingApprovals === 1 ? "" : "s"} awaiting approval`,
          description: "Approve in-flight requests to keep the rail moving.",
          action: "Review queue",
          href: "/settlements?status=REQUESTED",
          tone: "warning" as const,
        }
      : null,
    expiredQuotes > 0
      ? {
          title: `${expiredQuotes} expired quote${expiredQuotes === 1 ? "" : "s"}`,
          description: "Refresh quote inventory before creating new settlements.",
          action: "Open quotes",
          href: "/quotes?tab=expired",
          tone: "info" as const,
        }
      : null,
  ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));

  return (
    <div className="space-y-3">
      {/* Mission Control — first viewport cockpit */}
      <section className="mission-control">
        <div className="mission-control__scanline pointer-events-none absolute inset-0" aria-hidden="true" />

        <header className="mission-control__bar relative flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#42d5b7]/90">Mission Control</p>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Treasury Operations</h1>
            <p className="mt-0.5 max-w-xl text-[11.5px] leading-snug text-slate-300/90">
              {pontisConnected
                ? "Live settlement rails, provider execution, and reconciliation."
                : "Connect PontisGlobe sandbox to unlock live payout tracking."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="overview-live-badge inline-flex items-center gap-1.5 rounded-full border border-[#00c79d]/35 bg-[#00c79d]/12 px-2.5 py-1 text-[10px] font-semibold text-[#42d5b7]">
              <span className="ops-pulse" aria-hidden="true" />
              Rails live
            </span>
            {pontisConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0bb4c4]/35 bg-[#0bb4c4]/10 px-2.5 py-1 text-[10px] font-semibold text-[#5dd4e0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0bb4c4]" aria-hidden="true" />
                PontisGlobe connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                PontisGlobe offline
              </span>
            )}
            <span className="overview-monitoring-badge inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-300">
              <span className="ops-pulse ops-pulse--subtle" aria-hidden="true" />
              Monitoring
            </span>
          </div>
        </header>

        <div className="mission-control__cockpit relative grid gap-3 p-3 sm:p-4 lg:grid-cols-12">
          {/* Metric rail */}
          <div className="mission-control__metrics flex flex-row gap-2 lg:col-span-3 lg:flex-col">
            <MetricCard
              variant="mission"
              label="Completed"
              value={completedCount}
              hint="Settled + reconciled"
              tone="success"
              icon={CheckCircle2}
            />
            <MetricCard
              variant="mission"
              label="Auto-reconciled"
              value={formatPercent(reconciledRate)}
              hint="Of completed volume"
              tone="info"
              icon={TrendingUp}
            />
            <MetricCard
              variant="mission"
              label="Exceptions"
              value={reconExceptions}
              hint={reconExceptions ? "Needs review" : "All matched"}
              tone={reconExceptions ? "danger" : "neutral"}
              icon={AlertTriangle}
            />
            <MetricCard
              variant="mission"
              label="In flight"
              value={inFlightCount}
              hint="Approved + executing"
              tone="warning"
              icon={Activity}
            />
          </div>

          {/* Proof spotlight */}
          <div className="lg:col-span-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Latest settlement proof</p>
              {latestProof ? (
                <span className="text-[10px] text-slate-400">
                  {latestProof.reconciledAt
                    ? formatDateTime(latestProof.reconciledAt)
                    : latestProof.settledAt
                      ? formatDateTime(latestProof.settledAt)
                      : formatDateTime(latestProof.createdAt)}
                </span>
              ) : null}
            </div>
            {latestProof ? (
              <div
                className={cn(
                  "mission-control__spotlight-enter mission-control__spotlight ops-grid-faint overflow-hidden rounded-xl border border-[var(--ops-line)] p-3.5",
                  isRecentlyCompleted(latestProof, now) && "mission-control__spotlight-recent",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[15px] font-semibold tracking-tight text-slate-950">
                        {latestProof.publicId}
                      </p>
                      <StatusBadge status={latestProof.status} />
                    </div>
                    <p
                      className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900"
                      title={formatCurrencyFull(String(latestProof.sourceAmount), latestProof.sourceCurrency)}
                    >
                      {formatCurrencyFull(String(latestProof.sourceAmount), latestProof.sourceCurrency)}
                    </p>
                  </div>
                  <Link
                    href="/settlements"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--ops-line-soft)] bg-white/80 px-2 py-1 text-[10px] font-semibold text-brand-emerald-ink transition-colors hover:bg-[#e7faf4]"
                  >
                    View detail
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-3 rounded-xl border border-[var(--ops-line-soft)] bg-white/70 px-3 py-3">
                  <SettlementLifecycle status={latestProof.status} spotlight />
                </div>

                <dl className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                  {latestProof.provider ? (
                    <div className="rounded-lg border border-[var(--ops-line-soft)] bg-white/60 px-2.5 py-1.5">
                      <dt className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-500">Provider</dt>
                      <dd className="mt-0.5 text-[12px] font-medium text-slate-800">{latestProof.provider}</dd>
                    </div>
                  ) : null}
                  {latestProof.providerTransactionId ? (
                    <div className="rounded-lg border border-[var(--ops-line-soft)] bg-white/60 px-2.5 py-1.5">
                      <dt className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                        Provider transaction
                      </dt>
                      <dd className="mt-0.5 truncate font-mono text-[11px] text-slate-700">
                        {latestProof.providerTransactionId}
                      </dd>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-[var(--ops-line-soft)] bg-white/60 px-2.5 py-1.5">
                    <dt className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-500">Reconciliation</dt>
                    <dd className="mt-0.5">
                      <StatusBadge
                        status={reconciliationLabel(latestProof.status, latestProof.reconciliation)}
                        dot={false}
                      />
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[var(--ops-line-soft)] bg-white/60 px-2.5 py-1.5">
                    <dt className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-500">Audit status</dt>
                    <dd className="mt-0.5">
                      <StatusBadge status={auditStatusLabel(latestProof.status)} dot={false} />
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="mission-control__spotlight ops-grid-faint rounded-xl border border-dashed border-[var(--ops-line)] p-4">
                <EmptyState
                  title="No completed settlements yet"
                  description="Execute your first settlement to see provider proof here."
                  action={{ label: "Create settlement", href: "/settlements" }}
                />
              </div>
            )}
          </div>

          {/* Actions + alerts */}
          <div className="flex flex-col gap-3 lg:col-span-3">
            <div className="mission-control__actions flex flex-col gap-1.5">
              <Button asChild variant="primary" size="sm" className="ops-btn-navy w-full justify-center">
                <Link href="/quotes">
                  <Plus className="h-3.5 w-3.5" />
                  Create quote
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-center">
                <Link href="/settlements">
                  <Landmark className="h-3.5 w-3.5" />
                  Create settlement
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-center">
                <Link href="/reconciliation">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Run reconciliation
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full justify-center">
                <Link href="/audit-logs">
                  <FileText className="h-3.5 w-3.5" />
                  View audit trail
                </Link>
              </Button>
            </div>

            <div className="flex-1">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Alerts</p>
              <div className="space-y-1.5">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <Link key={alert.title} href={alert.href} className="group block">
                      <div
                        className={cn(
                          "overview-alert rounded-xl border px-2.5 py-2",
                          alert.tone === "danger" && "border-rose-200 bg-rose-50/80",
                          alert.tone === "warning" && "border-[#f2ad23]/30 bg-[#fff8e8]/80",
                          alert.tone === "info" && "border-[#0bb4c4]/25 bg-[#e7f7fb]/70",
                        )}
                      >
                        <p className="text-[12px] font-semibold tracking-tight text-slate-900">{alert.title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{alert.description}</p>
                        <span className="overview-alert__action mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand-emerald-ink group-hover:underline">
                          {alert.action}
                          <ArrowRight className="overview-alert__arrow h-3 w-3" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border border-[var(--ops-line-soft)] bg-white/70 px-2.5 py-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e7faf4] text-brand-emerald-ink ring-1 ring-[#00c79d]/25">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900">All clear</p>
                      <p className="text-[11px] text-slate-500">Rails operating normally.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Recent activity */}
        <section>
          <SectionHeader title="Recent activity" description="Human-readable operational events" />
          <div className="ops-panel divide-y divide-[var(--ops-line-soft)] px-3 py-0.5">
            {auditLogs.length ? (
              auditLogs.map((log, index) => {
                const tone = auditTone(log.action);
                const dot = {
                  neutral: "bg-slate-400",
                  success: "bg-emerald-500",
                  warning: "bg-amber-500",
                  danger: "bg-rose-500",
                  info: "bg-blue-500",
                }[tone];

                return (
                  <div
                    key={log.id}
                    className="overview-activity-item overview-activity-row flex items-start gap-2 py-2"
                    style={{ animationDelay: `${0.04 + index * 0.05}s` }}
                  >
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[12.5px] font-medium text-slate-900">{humanizeAuditAction(log.action)}</p>
                        <span className="overview-event-code rounded border border-[var(--ops-line-soft)] bg-slate-50 px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-wide text-slate-400">
                          {log.action}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {log.user?.email ?? log.actorType} · {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8">
                <EmptyState title="No activity yet" description="Operational events will appear as your team works." />
              </div>
            )}
          </div>
        </section>

        {/* Recent settlements */}
        <section>
          <SectionHeader
            title="Recent settlements"
            action={
              <Link href="/settlements" className="text-xs font-medium text-slate-600 hover:text-slate-950">
                View all
              </Link>
            }
          />
          {recentSettlements.length ? (
            <DataGrid className="overview-settlements-grid">
              <table className="w-full">
                <DataGridHead>
                  <DataGridTh className="py-2">ID</DataGridTh>
                  <DataGridTh className="py-2">Amount</DataGridTh>
                  <DataGridTh className="py-2">Status</DataGridTh>
                  <DataGridTh className="py-2">Provider</DataGridTh>
                  <DataGridTh className="py-2 text-right">When</DataGridTh>
                </DataGridHead>
                <DataGridBody>
                  {recentSettlements.map((settlement) => (
                    <DataGridRow key={settlement.id} className="overview-settlement-row">
                      <DataGridTd className="py-2 text-[12px] font-medium">{settlement.publicId}</DataGridTd>
                      <DataGridTd
                        className="py-2 whitespace-nowrap text-[12px] tabular-nums"
                        title={formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}
                      >
                        {formatCurrencyCompact(String(settlement.sourceAmount), settlement.sourceCurrency)}
                      </DataGridTd>
                      <DataGridTd className="py-2">
                        <StatusBadge status={settlement.status} />
                      </DataGridTd>
                      <DataGridTd className="py-2 text-[11px] text-slate-600">
                        {settlement.providerTransactionId ? (
                          <span className="font-mono text-[10px]" title={settlement.providerTransactionId}>
                            {settlement.provider ?? "Provider"} · {settlement.providerTransactionId.slice(0, 8)}…
                          </span>
                        ) : settlement.provider ? (
                          settlement.provider
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </DataGridTd>
                      <DataGridTd className="py-2 text-right text-[11px] text-slate-500">
                        {settlement.reconciledAt
                          ? formatDateTime(settlement.reconciledAt)
                          : settlement.settledAt
                            ? formatDateTime(settlement.settledAt)
                            : formatDateTime(settlement.createdAt)}
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
      </div>
    </div>
  );
}
