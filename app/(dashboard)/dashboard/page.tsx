import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
} from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { autoMatchReconciliation } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { isPontisConfigured } from "@/lib/providers/pontis/client";
import { isPontisGatewayConfigured } from "@/lib/providers/pontis/gateway";
import { cn, formatCurrencyCompact, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { MetricCard } from "@/components/ops/metric-card";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import { StatusBadge } from "@/components/ops/status-badge";
import { EmptyState } from "@/components/ops/empty-state";
import { Button } from "@/components/ui/button";

function isPontisEnabled() {
  return isPontisGatewayConfigured() || isPontisConfigured();
}

const STREAM_EVENT_ACTIONS = new Set([
  "pontis.payout.created",
  "remitquickly.payout.created",
  "pontis.payout.status_updated",
  "pontis.payout.settled",
  "remitquickly.payout.settled",
  "reconciliation.auto_match",
  "reconciliation.confirm_match",
]);

function isAuthEvent(action: string) {
  return action.startsWith("auth.");
}

function humanizeStreamAction(action: string): string {
  const map: Record<string, string> = {
    "pontis.payout.created": "Provider payout submitted",
    "remitquickly.payout.created": "Provider payout submitted",
    "pontis.payout.status_updated": "Provider status updated",
    "pontis.payout.settled": "Provider payout completed",
    "remitquickly.payout.settled": "Provider payout completed",
    "reconciliation.auto_match": "Settlement reconciled automatically",
    "reconciliation.confirm_match": "Settlement reconciled",
    "settlement.transition": "Audit trail recorded",
  };
  return map[action] ?? action.replaceAll(".", " · ").replaceAll("_", " ");
}

function streamDotTone(action: string): "success" | "info" | "neutral" {
  if (
    action.includes("settled") ||
    action.includes("reconcil") ||
    action === "settlement.transition"
  ) {
    return "success";
  }
  if (action.includes("created") || action.includes("status_updated")) {
    return "info";
  }
  return "neutral";
}

function isStreamActivity(log: { action: string; after: unknown }) {
  if (isAuthEvent(log.action)) return false;
  if (STREAM_EVENT_ACTIONS.has(log.action)) return true;
  if (log.action === "settlement.transition") {
    const after = log.after as { toStatus?: string } | null;
    return after?.toStatus === SettlementStatus.RECONCILED;
  }
  return false;
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

function proofSummaryCopy(status: SettlementStatus) {
  if (status === SettlementStatus.RECONCILED) {
    return "Provider payout completed. Settlement reconciled. Audit trail recorded.";
  }
  if (status === SettlementStatus.SETTLED) {
    return "Provider payout completed. Awaiting reconciliation.";
  }
  return "Settlement in progress.";
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
    completedCount,
    inFlightCount,
    reconciledCount,
  ] = await Promise.all([
      prisma.settlement.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "desc" },
        take: 6,
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
      prisma.reconciliationRecord.count({
        where: { organizationId: organization.id, status: "EXCEPTION" },
      }),
      prisma.auditLog.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "desc" },
        take: 16,
        include: { user: true },
      }),
      prisma.quote.count({
        where: {
          organizationId: organization.id,
          OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lt: now } }],
        },
      }),
      prisma.settlement.count({
        where: { organizationId: organization.id, status: SettlementStatus.REQUESTED },
      }),
      prisma.settlement.count({
        where: {
          organizationId: organization.id,
          status: { in: [SettlementStatus.SETTLED, SettlementStatus.RECONCILED] },
        },
      }),
      prisma.settlement.count({
        where: {
          organizationId: organization.id,
          status: { in: [SettlementStatus.APPROVED, SettlementStatus.EXECUTING] },
        },
      }),
      prisma.settlement.count({
        where: { organizationId: organization.id, status: SettlementStatus.RECONCILED },
      }),
    ]);

  const autoReconciledRate =
    completedCount > 0 ? Math.round((reconciledCount / completedCount) * 100) : null;

  const operationsStream = auditLogs.filter((log) => isStreamActivity(log)).slice(0, 4);

  const proofFeed = recentSettlements
    .filter((settlement) => settlement.id !== latestProof?.id)
    .slice(0, 4);

  const primaryAlert =
    reconExceptions > 0
      ? {
          title: `${reconExceptions} reconciliation exception${reconExceptions === 1 ? "" : "s"}`,
          action: "Review",
          href: "/reconciliation?status=EXCEPTION",
          tone: "danger" as const,
        }
      : pendingApprovals > 0
        ? {
            title: `${pendingApprovals} awaiting approval`,
            action: "Review queue",
            href: "/settlements?status=REQUESTED",
            tone: "warning" as const,
          }
        : expiredQuotes > 0
          ? {
              title: `${expiredQuotes} expired quote${expiredQuotes === 1 ? "" : "s"}`,
              body: "Refresh or archive stale quotes before the next settlement run.",
              action: "Open quotes",
              href: "/quotes?tab=expired",
              tone: "warning" as const,
            }
          : null;

  const latestCompletedAt = latestProof
    ? latestProof.reconciledAt ?? latestProof.settledAt ?? latestProof.createdAt
    : null;

  return (
    <div className="overview-page">
      <section className="mission-control">
        <div className="mission-control__hero-glow pointer-events-none absolute inset-x-0 top-0 h-40" aria-hidden="true" />
        <div className="mission-control__scanline pointer-events-none absolute inset-0" aria-hidden="true" />

        <header className="mission-control__bar relative flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="mission-control__eyebrow">Mission Control</p>
            <h1 className="mission-control__title">Treasury Operations</h1>
          </div>
          <div className="mission-control__status">
            <span className="overview-live-badge mission-control__pill mission-control__pill--live">
              <span className="ops-pulse ops-pulse--subtle" aria-hidden="true" />
              Live
            </span>
            <span
              className={cn(
                "mission-control__pill",
                pontisConnected ? "mission-control__pill--connected" : "mission-control__pill--offline",
              )}
            >
              {pontisConnected ? "PontisGlobe" : "Pontis offline"}
            </span>
          </div>
        </header>

        <div className="mission-control__cockpit">
          <div className="mission-control__proof-zone">
            {latestProof ? (
              <div
                className={cn(
                  "mission-control__proof",
                  isRecentlyCompleted(latestProof, now) && "mission-control__proof--recent",
                )}
              >
                <div className="mission-control__proof-head">
                  <div className="min-w-0">
                    <p className="mission-control__proof-label">Latest settlement proof</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="mission-control__proof-id">{latestProof.publicId}</p>
                      <StatusBadge status={latestProof.status} />
                    </div>
                  </div>
                  {latestCompletedAt ? (
                    <time className="mission-control__proof-time">{formatDateTime(latestCompletedAt)}</time>
                  ) : null}
                </div>

                <p
                  className="mission-control__proof-amount"
                  title={formatCurrencyFull(String(latestProof.sourceAmount), latestProof.sourceCurrency)}
                >
                  {formatCurrencyFull(String(latestProof.sourceAmount), latestProof.sourceCurrency)}
                </p>

                <div className="mission-control__proof-meta">
                  {latestProof.provider ? (
                    <span className="mission-control__proof-chip">{latestProof.provider}</span>
                  ) : null}
                  {latestProof.providerTransactionId ? (
                    <span className="mission-control__proof-tx" title={latestProof.providerTransactionId}>
                      {truncateTx(latestProof.providerTransactionId)}
                    </span>
                  ) : null}
                </div>

                <p className="mission-control__proof-summary">{proofSummaryCopy(latestProof.status)}</p>

                <div className="proof-lifecycle-wrap proof-rail--hero">
                  <SettlementLifecycle status={latestProof.status} proofRail compact />
                </div>

                <div
                  className="mission-control__telemetry mission-control__telemetry--chips"
                  aria-label="Operations telemetry"
                >
                  <MetricCard label="Completed" value={completedCount} tone="success" variant="telemetry" />
                  <MetricCard
                    label="Auto-reconciled"
                    value={autoReconciledRate !== null ? `${autoReconciledRate}%` : "—"}
                    tone="info"
                    variant="telemetry"
                  />
                  <MetricCard label="Exceptions" value={reconExceptions} tone="danger" variant="telemetry" />
                  <MetricCard label="In flight" value={inFlightCount} tone="neutral" variant="telemetry" />
                </div>

                <Link href="/settlements" className="mission-control__proof-link">
                  Open proof
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="mission-control__proof mission-control__proof--empty">
                <EmptyState
                  title="No completed settlements yet"
                  description="Execute your first settlement to see provider proof here."
                  action={{ label: "Create settlement", href: "/settlements" }}
                />
              </div>
            )}
          </div>

          <aside className="mission-control__rail">
            <nav className="mission-control__actions" aria-label="Quick actions">
              <Button
                asChild
                variant="primary"
                size="sm"
                className="mission-control__action-primary mission-control__action-primary--premium"
              >
                <Link href="/quotes">
                  <Plus className="h-3.5 w-3.5" />
                  Create quote
                </Link>
              </Button>
              <Link href="/settlements" className="mission-control__action mission-action-card">
                <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
                Create settlement
              </Link>
              <Link href="/reconciliation" className="mission-control__action mission-action-card">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Run reconciliation
              </Link>
              <Link href="/audit-logs" className="mission-control__action mission-action-card">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Audit trail
              </Link>
            </nav>

            <div className="mission-control__alert-slot">
              {primaryAlert ? (
                <Link href={primaryAlert.href} className="group block">
                  <div
                    className={cn(
                      "overview-alert mission-control__alert",
                      primaryAlert.tone === "danger" && "overview-alert--danger",
                      primaryAlert.tone === "warning" && "overview-alert--warning",
                    )}
                  >
                    <AlertTriangle className="mission-control__alert-icon" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="mission-control__alert-title">{primaryAlert.title}</p>
                      {"body" in primaryAlert && primaryAlert.body ? (
                        <p className="mission-control__alert-body">{primaryAlert.body}</p>
                      ) : null}
                      <span className="overview-alert__action mission-control__alert-cta">
                        {primaryAlert.action} →
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="mission-control__alert mission-control__alert--clear">
                  <CheckCircle2 className="mission-control__alert-icon mission-control__alert-icon--clear" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="mission-control__alert-title">All clear</p>
                    <p className="mission-control__alert-sub">Rails operating normally</p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="overview-below">
        <section className="overview-section">
          <div className="overview-section__head">
            <h2 className="overview-section__title">Operations stream</h2>
          </div>
          {operationsStream.length ? (
            <ul className="ops-stream">
              {operationsStream.map((log, index) => (
                <li
                  key={log.id}
                  className={cn("ops-stream-item", index === 0 && "ops-stream-item--latest")}
                  style={{ animationDelay: `${0.04 + index * 0.045}s` }}
                >
                  <div className="ops-stream-item__head">
                    <span
                      className={cn(
                        "ops-stream-dot",
                        index === 0 && "ops-stream-dot--live",
                        index !== 0 && `ops-stream-dot--${streamDotTone(log.action)}`,
                      )}
                      aria-hidden="true"
                    />
                    <p className="ops-stream-title">{humanizeStreamAction(log.action)}</p>
                    <time className="ops-stream-time">{formatDateTime(log.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-section__empty">No recent treasury activity.</p>
          )}
        </section>

        <section className="overview-section">
          <div className="overview-section__head">
            <h2 className="overview-section__title">Recent proofs</h2>
            <Link href="/settlements" className="overview-section__link">
              View all
            </Link>
          </div>
          {proofFeed.length ? (
            <div className="proof-feed">
              {proofFeed.map((settlement, index) => {
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
                    style={{ animationDelay: `${0.02 + index * 0.03}s` }}
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
                      <span className="proof-feed-item__provider">{settlement.provider ?? "—"}</span>
                      {settlement.providerTransactionId ? (
                        <span className="proof-feed-tx proof-feed-tx--pill" title={settlement.providerTransactionId}>
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
            <p className="overview-section__empty">No prior proofs yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
