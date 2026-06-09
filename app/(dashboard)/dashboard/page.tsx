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

const PROOF_DUPLICATE_ACTIONS = new Set([
  "pontis.payout.settled",
  "remitquickly.payout.settled",
  "reconciliation.auto_match",
  "reconciliation.confirm_match",
]);

const SUMMARY_EVENT_ACTIONS = new Set([
  "pontis.payout.created",
  "settlement.create",
  "quote.create",
  "remitquickly.payout.created",
]);

function isAuthEvent(action: string) {
  return action.startsWith("auth.");
}

function humanizeStreamAction(action: string): string {
  const map: Record<string, string> = {
    "quote.create": "Quote drafted",
    "settlement.create": "Settlement initiated",
    "pontis.payout.created": "Payout submitted to provider",
    "pontis.payout.failed": "Provider payout failed",
    "pontis.payout.failed_submit": "Payout submission failed",
    "remitquickly.payout.created": "Payout submitted to provider",
    "remitquickly.payout.failed": "Provider payout failed",
    "reconciliation.reject_match": "Match review opened",
    "reconciliation.resolve_exception": "Exception cleared",
  };
  return map[action] ?? action.replaceAll(".", " · ").replaceAll("_", " ");
}

function isStreamActivity(action: string) {
  if (isAuthEvent(action) || NOISE_EVENT_ACTIONS.has(action) || PROOF_DUPLICATE_ACTIONS.has(action)) {
    return false;
  }
  return SUMMARY_EVENT_ACTIONS.has(action);
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

function proofMilestones(status: SettlementStatus) {
  const settled =
    status === SettlementStatus.SETTLED || status === SettlementStatus.RECONCILED;
  const reconciled = status === SettlementStatus.RECONCILED;
  return [
    { label: "Payout confirmed", done: settled },
    { label: "Reconciled", done: reconciled },
    { label: "Proof recorded", done: reconciled },
  ];
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

  const [recentSettlements, latestProof, reconExceptions, auditLogs, expiredQuotes, pendingApprovals] =
    await Promise.all([
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
    ]);

  const operationsStream = auditLogs.filter((log) => isStreamActivity(log.action)).slice(0, 4);

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
              action: "Open quotes",
              href: "/quotes?tab=expired",
              tone: "info" as const,
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
            <span className="overview-live-badge mission-control__pill">
              <span className="ops-pulse" aria-hidden="true" />
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

                <ul className="mission-control__milestones">
                  {proofMilestones(latestProof.status).map((item, index) => (
                    <li
                      key={item.label}
                      className={cn(
                        "mission-control__milestone",
                        item.done && "mission-control__milestone--done",
                      )}
                      style={{ animationDelay: `${0.06 + index * 0.05}s` }}
                    >
                      {item.done ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : null}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>

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
              <Button asChild variant="primary" size="sm" className="ops-btn-navy mission-control__action-primary">
                <Link href="/quotes">
                  <Plus className="h-3.5 w-3.5" />
                  Create quote
                </Link>
              </Button>
              <Link href="/settlements" className="mission-control__action">
                <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
                Create settlement
              </Link>
              <Link href="/reconciliation" className="mission-control__action">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Run reconciliation
              </Link>
              <Link href="/audit-logs" className="mission-control__action mission-control__action--muted">
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
                      primaryAlert.tone === "info" && "overview-alert--info",
                    )}
                  >
                    <AlertTriangle className="mission-control__alert-icon" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="mission-control__alert-title">{primaryAlert.title}</p>
                      <span className="overview-alert__action mission-control__alert-cta">
                        {primaryAlert.action}
                        <ArrowRight className="overview-alert__arrow h-3 w-3" aria-hidden="true" />
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
                  style={{ animationDelay: `${0.03 + index * 0.03}s` }}
                >
                  <p className="ops-stream-title">{humanizeStreamAction(log.action)}</p>
                  <p className="ops-stream-time">{formatDateTime(log.createdAt)}</p>
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
            <p className="overview-section__empty">No prior proofs yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
