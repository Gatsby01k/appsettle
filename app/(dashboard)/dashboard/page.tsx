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
import { MetricCard } from "@/components/ops/metric-card";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import { StatusBadge } from "@/components/ops/status-badge";
import { EmptyState } from "@/components/ops/empty-state";
import { Button } from "@/components/ui/button";

function isPontisEnabled() {
  return isPontisGatewayConfigured() || isPontisConfigured();
}

const NOISE_EVENT_ACTIONS = new Set([
  "auth.login",
  "settlement.transition",
  "reconciliation.create",
  "pontis.payout.status_updated",
  "settings.update",
]);

const SUMMARY_EVENT_ACTIONS = new Set([
  "pontis.payout.settled",
  "pontis.payout.created",
  "reconciliation.auto_match",
  "reconciliation.confirm_match",
  "settlement.create",
  "quote.create",
  "remitquickly.payout.settled",
  "remitquickly.payout.created",
]);

function humanizeAuditAction(action: string): string {
  const map: Record<string, string> = {
    "quote.create": "New quote created",
    "settlement.create": "Settlement created",
    "settlement.transition": "Settlement status updated",
    "reconciliation.create": "Reconciliation record created",
    "reconciliation.auto_match": "Reconciliation matched",
    "reconciliation.confirm_match": "Reconciliation matched",
    "reconciliation.reject_match": "Reconciliation match rejected",
    "reconciliation.resolve_exception": "Reconciliation exception resolved",
    "pontis.payout.created": "Pontis payout submitted",
    "pontis.payout.settled": "Provider payout completed",
    "pontis.payout.status_updated": "Provider status updated",
    "pontis.payout.failed": "Pontis payout failed",
    "pontis.payout.failed_submit": "Pontis payout submission failed",
    "remitquickly.payout.created": "RemitQuickly payout submitted",
    "remitquickly.payout.settled": "Provider payout completed",
    "remitquickly.payout.failed": "RemitQuickly payout failed",
    "settings.update": "Settings updated",
    "auth.login": "User signed in",
  };
  return map[action] ?? action.replaceAll(".", " · ").replaceAll("_", " ");
}

function streamEventCode(action: string): string | null {
  if (NOISE_EVENT_ACTIONS.has(action)) return null;
  const human = humanizeAuditAction(action);
  if (human === action.replaceAll(".", " · ").replaceAll("_", " ")) return action;
  return null;
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

function truncateTx(id: string, max = 14) {
  if (id.length <= max) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function reconciliationLabel(
  status: SettlementStatus,
  records: { status: string }[],
): string {
  if (status === SettlementStatus.RECONCILED) return "Matched";
  const matched = records.find((r) => ["MATCHED", "AUTO_MATCHED", "MANUAL_MATCHED"].includes(r.status));
  if (matched) return "Matched";
  if (records.some((r) => r.status === "EXCEPTION")) return "Exception";
  if (status === SettlementStatus.SETTLED) return "Awaiting match";
  return "—";
}

function proofMilestones(status: SettlementStatus) {
  const settled =
    status === SettlementStatus.SETTLED || status === SettlementStatus.RECONCILED;
  const reconciled = status === SettlementStatus.RECONCILED;
  return [
    { label: "Provider payout completed", done: settled },
    { label: "Reconciliation matched", done: reconciled },
    { label: "Audit trail recorded", done: reconciled },
  ];
}

function isSummaryActivity(action: string) {
  if (NOISE_EVENT_ACTIONS.has(action)) return false;
  return SUMMARY_EVENT_ACTIONS.has(action);
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
      take: 12,
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

  const operationsStream = auditLogs.filter((log) => isSummaryActivity(log.action)).slice(0, 4);

  const primaryAlert =
    reconExceptions > 0
      ? {
          title: `${reconExceptions} reconciliation exception${reconExceptions === 1 ? "" : "s"}`,
          action: "Open reconciliation",
          href: "/reconciliation?status=EXCEPTION",
          tone: "danger" as const,
        }
      : pendingApprovals > 0
        ? {
            title: `${pendingApprovals} settlement${pendingApprovals === 1 ? "" : "s"} awaiting approval`,
            action: "Review queue",
            href: "/settlements?status=REQUESTED",
            tone: "warning" as const,
          }
        : expiredQuotes > 0
          ? {
              title: `${expiredQuotes} expired quote${expiredQuotes === 1 ? "" : "s"}`,
              action: "Open quotes",
              href: "/quotes?tab=expired",
              tone: "info" as const,
            }
          : null;

  const latestCompletedAt = latestProof
    ? latestProof.reconciledAt ?? latestProof.settledAt ?? latestProof.createdAt
    : null;

  return (
    <div className="overview-page space-y-2">
      <section className="mission-control">
        <div className="mission-control__hero-glow pointer-events-none absolute inset-x-0 top-0 h-36" aria-hidden="true" />
        <div className="mission-control__scanline pointer-events-none absolute inset-0" aria-hidden="true" />

        <header className="mission-control__bar relative flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#42d5b7]/80">Mission Control</p>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-[1.25rem]">Treasury Operations</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="overview-live-badge inline-flex items-center gap-1.5 rounded-full border border-[#00c79d]/30 bg-[#00c79d]/10 px-2.5 py-1 text-[10px] font-semibold text-[#42d5b7]">
              <span className="ops-pulse" aria-hidden="true" />
              Settlement rails live
            </span>
            {pontisConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0bb4c4]/28 bg-[#0bb4c4]/8 px-2.5 py-1 text-[10px] font-semibold text-[#5dd4e0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0bb4c4] shadow-[0_0_8px_rgba(11,180,196,0.55)]" aria-hidden="true" />
                PontisGlobe connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                PontisGlobe offline
              </span>
            )}
          </div>
        </header>

        <div className="mission-control__telemetry relative">
          <MetricCard
            variant="telemetry"
            label="Completed"
            value={completedCount}
            tone="success"
            icon={CheckCircle2}
          />
          <MetricCard
            variant="telemetry"
            label="Auto-reconciled"
            value={formatPercent(reconciledRate)}
            tone="info"
            icon={TrendingUp}
          />
          <MetricCard
            variant="telemetry"
            label="Exceptions"
            value={reconExceptions}
            tone={reconExceptions ? "danger" : "neutral"}
            icon={AlertTriangle}
          />
          <MetricCard
            variant="telemetry"
            label="In flight"
            value={inFlightCount}
            tone="warning"
            icon={Activity}
          />
        </div>

        <div className="mission-control__cockpit relative grid gap-3 p-4 sm:p-5 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {latestProof ? (
              <div
                className={cn(
                  "proof-card mission-control__spotlight-enter p-4 sm:p-5",
                  isRecentlyCompleted(latestProof, now) && "mission-control__spotlight-recent",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400/80">
                      Latest settlement proof
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold tracking-tight text-white/90 sm:text-base">
                        {latestProof.publicId}
                      </p>
                      <StatusBadge status={latestProof.status} />
                    </div>
                  </div>
                  {latestCompletedAt ? (
                    <p className="shrink-0 text-[11px] text-slate-400/90">{formatDateTime(latestCompletedAt)}</p>
                  ) : null}
                </div>

                <p
                  className="proof-hero-amount mt-3"
                  title={formatCurrencyFull(String(latestProof.sourceAmount), latestProof.sourceCurrency)}
                >
                  {formatCurrencyFull(String(latestProof.sourceAmount), latestProof.sourceCurrency)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {latestProof.provider ? (
                    <span className="proof-provider-chip">{latestProof.provider}</span>
                  ) : null}
                  {latestProof.providerTransactionId ? (
                    <span className="proof-tx-pill" title={latestProof.providerTransactionId}>
                      {truncateTx(latestProof.providerTransactionId)}
                    </span>
                  ) : null}
                </div>

                <ul className="proof-milestones mt-4">
                  {proofMilestones(latestProof.status).map((item, index) => (
                    <li
                      key={item.label}
                      className={cn("proof-milestone", item.done && "proof-milestone--done")}
                      style={{ animationDelay: `${0.08 + index * 0.06}s` }}
                    >
                      <span className="proof-milestone__icon" aria-hidden="true">
                        {item.done ? <CheckCircle2 className="h-3 w-3" /> : null}
                      </span>
                      <span className="proof-milestone__label">{item.label}</span>
                    </li>
                  ))}
                </ul>

                <div className="proof-lifecycle-wrap mt-3.5">
                  <SettlementLifecycle status={latestProof.status} proofRail />
                </div>

                <Link href="/settlements" className="proof-cta mt-4">
                  View proof
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="proof-card proof-card--empty p-5">
                <EmptyState
                  title="No completed settlements yet"
                  description="Execute your first settlement to see provider proof here."
                  action={{ label: "Create settlement", href: "/settlements" }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 lg:col-span-4">
            <div className="mission-control__actions mission-action-card p-2.5">
              <Button asChild variant="primary" size="sm" className="ops-btn-navy mb-1.5 w-full justify-center">
                <Link href="/quotes">
                  <Plus className="h-3.5 w-3.5" />
                  Create quote
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="mb-1.5 w-full justify-center border-white/12 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]">
                <Link href="/settlements">
                  <Landmark className="h-3.5 w-3.5" />
                  Create settlement
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="mb-1.5 w-full justify-center border-white/12 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]">
                <Link href="/reconciliation">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Run reconciliation
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full justify-center text-slate-300 hover:bg-white/[0.05] hover:text-white">
                <Link href="/audit-logs">
                  <FileText className="h-3.5 w-3.5" />
                  View audit trail
                </Link>
              </Button>
            </div>

            <div className="flex-1">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Needs attention</p>
              {primaryAlert ? (
                <Link href={primaryAlert.href} className="group block">
                  <div
                    className={cn(
                      "overview-alert mission-action-card px-3.5 py-2.5",
                      primaryAlert.tone === "danger" && "overview-alert--danger",
                      primaryAlert.tone === "warning" && "overview-alert--warning",
                      primaryAlert.tone === "info" && "overview-alert--info",
                    )}
                  >
                    <p className="text-[12px] font-semibold tracking-tight text-slate-100">{primaryAlert.title}</p>
                    <span className="overview-alert__action mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#42d5b7] group-hover:underline">
                      {primaryAlert.action}
                      <ArrowRight className="overview-alert__arrow h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="overview-all-clear flex items-center gap-2.5 px-3.5 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#00c79d]/12 text-[#42d5b7]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-100">All clear</p>
                    <p className="text-[11px] text-slate-400">Settlement rails operating normally.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="overview-compact-grid">
        <section className="overview-compact-panel">
          <div className="overview-compact-panel__head">
            <h2 className="overview-compact-panel__title">Operations stream</h2>
            <Link href="/audit-logs" className="overview-compact-panel__link">
              Full trail
            </Link>
          </div>
          {operationsStream.length ? (
            <ul className="ops-stream">
              {operationsStream.map((log, index) => {
                const code = streamEventCode(log.action);
                return (
                  <li
                    key={log.id}
                    className={cn("ops-stream-item", index === 0 && "ops-stream-item--latest")}
                    style={{ animationDelay: `${0.04 + index * 0.04}s` }}
                  >
                    <div className="ops-stream-item__head">
                      <p className="ops-stream-title">{humanizeAuditAction(log.action)}</p>
                      {code ? <span className="ops-stream-event-code">{code}</span> : null}
                      {index === 0 ? (
                        <span className="ops-stream-live">
                          <span className="ops-pulse ops-pulse--subtle" aria-hidden="true" />
                          Live
                        </span>
                      ) : null}
                    </div>
                    <p className="ops-stream-time">{formatDateTime(log.createdAt)}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="overview-compact-empty">No recent operations yet.</p>
          )}
        </section>

        <section className="overview-compact-panel">
          <div className="overview-compact-panel__head">
            <h2 className="overview-compact-panel__title">Recent proofs</h2>
            <Link href="/settlements" className="overview-compact-panel__link">
              View all
            </Link>
          </div>
          {recentSettlements.length ? (
            <div className="proof-feed">
              {recentSettlements.slice(0, 4).map((settlement, index) => {
                const when = settlement.reconciledAt
                  ? formatDateTime(settlement.reconciledAt)
                  : settlement.settledAt
                    ? formatDateTime(settlement.settledAt)
                    : formatDateTime(settlement.createdAt);

                return (
                  <Link
                    key={settlement.id}
                    href="/settlements"
                    className="proof-feed-item"
                    style={{ animationDelay: `${0.03 + index * 0.04}s` }}
                  >
                    <div className="proof-feed-item__primary">
                      <span className="proof-feed-item__id">{settlement.publicId}</span>
                      <StatusBadge status={settlement.status} />
                      <span
                        className="proof-feed-item__amount"
                        title={formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}
                      >
                        {formatCurrencyCompact(String(settlement.sourceAmount), settlement.sourceCurrency)}
                      </span>
                    </div>
                    <div className="proof-feed-item__meta">
                      <span className="proof-feed-item__provider">{settlement.provider ?? "No provider"}</span>
                      {settlement.providerTransactionId ? (
                        <span className="proof-feed-tx" title={settlement.providerTransactionId}>
                          {truncateTx(settlement.providerTransactionId)}
                        </span>
                      ) : null}
                      <span className="proof-feed-item__time">{when}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
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
