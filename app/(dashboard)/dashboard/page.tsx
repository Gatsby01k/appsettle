import Link from "next/link";
import { ArrowRight, FileText, Landmark, Plus, ShieldCheck } from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { autoMatchReconciliation } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { assessFinality } from "@/lib/finality";
import { buildFinalityInput, hasAuditApproval, latestProofOf } from "@/lib/finality-input";
import { isPontisConfigured } from "@/lib/providers/pontis/client";
import { isPontisGatewayConfigured } from "@/lib/providers/pontis/gateway";
import { isRemitQuicklyConfigured } from "@/lib/providers/remitquickly/client";
import { MODE_LABEL, getShadowConfig, inrLegOf, safetyFor, type SettlementMode } from "@/lib/shadow-mode";
import { cn, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { MetricCard } from "@/components/ops/metric-card";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import { StatusBadge } from "@/components/ops/status-badge";
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
  "settlement.finality_approved",
  "settlement.report_generated",
  "provider.proof.recorded",
]);

function humanizeStreamAction(action: string): string {
  const map: Record<string, string> = {
    "pontis.payout.created": "Provider payout submitted",
    "remitquickly.payout.created": "Provider payout submitted",
    "pontis.payout.status_updated": "Provider status updated",
    "pontis.payout.settled": "Provider payout completed",
    "remitquickly.payout.settled": "Provider payout completed",
    "reconciliation.auto_match": "Settlement reconciled automatically",
    "reconciliation.confirm_match": "Settlement reconciled",
    "settlement.transition": "Lifecycle recorded",
    "settlement.finality_approved": "Finality approved (dual-control)",
    "settlement.report_generated": "Settlement report generated",
    "provider.proof.recorded": "Provider proof recorded",
  };
  return map[action] ?? action.replaceAll(".", " · ").replaceAll("_", " ");
}

function isStreamActivity(log: { action: string; after: unknown }) {
  if (log.action.startsWith("auth.")) return false;
  if (STREAM_EVENT_ACTIONS.has(log.action)) return true;
  if (log.action === "settlement.transition") {
    const after = log.after as { toStatus?: string } | null;
    return after?.toStatus === SettlementStatus.RECONCILED;
  }
  return false;
}

function demoSettlementWhere(organizationId: string) {
  return {
    organizationId,
    OR: [{ publicId: { startsWith: "SET-DEMO" } }, { reference: { startsWith: "DEMO-" } }],
  };
}

function demoAuditWhere(organizationId: string) {
  return {
    organizationId,
    OR: [{ action: { startsWith: "DEMO." } }, { resourceId: { startsWith: "SET-DEMO" } }],
  };
}

function DemoFocusBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-800">
      Demo focus mode
    </span>
  );
}

const FINALITY_CHIP = {
  ready_to_finalize: { label: "Finality ready", className: "case-chip border-emerald-200 bg-emerald-50 text-emerald-700" },
  needs_review: { label: "Finality review", className: "case-chip case-chip--gold" },
  not_ready: { label: "Finality pending", className: "case-chip case-chip--demo" },
} as const;

const MODE_CHIP = {
  DEMO: "case-chip case-chip--demo",
  SHADOW: "case-chip case-chip--shadow",
  LIVE_TEST: "case-chip case-chip--live",
} as const;

type StepState = "ok" | "pending" | "blocked";
const STEP_STATE_LABEL: Record<StepState, string> = { ok: "Verified", pending: "Pending", blocked: "Blocked" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { user, organization } = await requireSession();
  const params = await searchParams;
  const demoFocus = params.demo === "1";
  const demoQuery = demoFocus ? "?demo=1" : "";
  const now = new Date();
  const pontisConnected = isPontisEnabled();
  const remitQuicklyConnected = isRemitQuicklyConfigured();
  const shadowConfig = getShadowConfig();
  const settlementWhere = demoFocus
    ? demoSettlementWhere(organization.id)
    : { organizationId: organization.id };
  const auditWhere = demoFocus
    ? demoAuditWhere(organization.id)
    : { organizationId: organization.id };

  try {
    await autoMatchReconciliation(user.id, organization.id);
  } catch {
    // Non-fatal: dashboard still renders current state if matching fails transiently.
  }

  const completedStatus = { in: [SettlementStatus.SETTLED, SettlementStatus.RECONCILED] };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // NOTE: the reconciliation relation is fetched FLAT (no nested take/orderBy —
  // historical Prisma 7 + adapter-pg hazard) and attached manually below.
  const [
    recentSettlementsRaw,
    latestProofPreferredRaw,
    latestProofFallbackRaw,
    reconExceptions,
    auditLogs,
    expiredQuotes,
    pendingApprovals,
    completedCount,
    inFlightCount,
    reconciledCount,
    reportsGenerated,
    liveTestCount,
    shadowCount,
    todaysLiveTests,
  ] = await Promise.all([
    prisma.settlement.findMany({
      where: settlementWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { events: true, providerProofs: true },
    }),
    demoFocus
      ? prisma.settlement.findFirst({
          where: { organizationId: organization.id, publicId: "SET-DEMO-001", status: completedStatus },
          include: { events: true, providerProofs: true },
        })
      : Promise.resolve(null),
    prisma.settlement.findFirst({
      where: { ...settlementWhere, status: completedStatus },
      orderBy: [{ reconciledAt: "desc" }, { settledAt: "desc" }],
      include: { events: true, providerProofs: true },
    }),
    prisma.reconciliationRecord.count({
      where: demoFocus
        ? { organizationId: organization.id, status: "EXCEPTION", externalRef: { startsWith: "DEMO-" } }
        : { organizationId: organization.id, status: "EXCEPTION" },
    }),
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true },
    }),
    demoFocus
      ? Promise.resolve(0)
      : prisma.quote.count({
          where: {
            organizationId: organization.id,
            OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lt: now } }],
          },
        }),
    prisma.settlement.count({ where: { ...settlementWhere, status: SettlementStatus.REQUESTED } }),
    prisma.settlement.count({ where: { ...settlementWhere, status: completedStatus } }),
    prisma.settlement.count({
      where: { ...settlementWhere, status: { in: [SettlementStatus.APPROVED, SettlementStatus.EXECUTING] } },
    }),
    prisma.settlement.count({ where: { ...settlementWhere, status: SettlementStatus.RECONCILED } }),
    prisma.auditLog.count({
      where: { organizationId: organization.id, action: "settlement.report_generated" },
    }),
    prisma.settlement.count({ where: { organizationId: organization.id, testMode: "LIVE_TEST" } }),
    prisma.settlement.count({ where: { organizationId: organization.id, testMode: "SHADOW" } }),
    prisma.settlement.findMany({
      where: {
        organizationId: organization.id,
        testMode: "LIVE_TEST",
        createdAt: { gte: startOfToday },
        status: { notIn: ["FAILED", "CANCELLED"] },
      },
      select: {
        publicId: true,
        status: true,
        sourceCurrency: true,
        targetCurrency: true,
        sourceAmount: true,
        targetAmount: true,
      },
    }),
  ]);

  // Latest linked reconciliation per settlement (flat fetch, attached manually).
  const proofSettlementIds = Array.from(
    new Set(
      [
        ...recentSettlementsRaw.map((s) => s.id),
        latestProofPreferredRaw?.id,
        latestProofFallbackRaw?.id,
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const reconciliationRecords = proofSettlementIds.length
    ? await prisma.reconciliationRecord.findMany({
        where: { settlementId: { in: proofSettlementIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const reconBySettlement = new Map<string, typeof reconciliationRecords>();
  for (const record of reconciliationRecords) {
    if (!record.settlementId) continue;
    const list = reconBySettlement.get(record.settlementId) ?? [];
    list.push(record);
    reconBySettlement.set(record.settlementId, list);
  }

  type RawSettlement = (typeof recentSettlementsRaw)[number];
  const withCaseFile = (settlement: RawSettlement) => {
    const recon = reconBySettlement.get(settlement.id) ?? [];
    const assessment = assessFinality(
      buildFinalityInput(settlement, settlement.providerProofs, recon, settlement.events, safetyFor(settlement, shadowConfig)),
    );
    return { ...settlement, reconciliation: recon, assessment };
  };

  const recentSettlements = recentSettlementsRaw.map(withCaseFile);
  const latestProofPreferred = latestProofPreferredRaw ? withCaseFile(latestProofPreferredRaw) : null;
  const latestProofFallback = latestProofFallbackRaw ? withCaseFile(latestProofFallbackRaw) : null;
  const latestProof = demoFocus ? (latestProofPreferred ?? latestProofFallback) : latestProofFallback;

  // Pipeline state from the latest completed case (the org's "current story").
  const latestReportLog = latestProof
    ? await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: "settlement.report_generated",
          resourceType: "settlement",
          resourceId: latestProof.id,
        },
      })
    : null;
  const pipeline: { name: string; state: StepState }[] = latestProof
    ? [
        { name: "Provider proof", state: latestProof.providerProofs.length > 0 ? "ok" : "pending" },
        {
          name: "Independent recon",
          state: latestProof.reconciliation.some((r) => r.status === "MATCHED")
            ? "ok"
            : latestProof.reconciliation.some((r) => ["UNMATCHED", "EXCEPTION"].includes(r.status))
              ? "blocked"
              : "pending",
        },
        { name: "Audit trail", state: hasAuditApproval(latestProof, latestProof.events) ? "ok" : "pending" },
        {
          name: "Finality review",
          state:
            latestProof.assessment.decision === "ready_to_finalize"
              ? "ok"
              : latestProof.assessment.riskLevel === "high"
                ? "blocked"
                : "pending",
        },
        { name: "Settlement report", state: latestReportLog ? "ok" : "pending" },
      ]
    : [
        { name: "Provider proof", state: "pending" },
        { name: "Independent recon", state: "pending" },
        { name: "Audit trail", state: "pending" },
        { name: "Finality review", state: "pending" },
        { name: "Settlement report", state: "pending" },
      ];

  const operatingMode: SettlementMode = liveTestCount > 0 ? "LIVE_TEST" : shadowCount > 0 ? "SHADOW" : "DEMO";
  const dailyUsedInr = todaysLiveTests.reduce((sum, row) => sum + inrLegOf(row), 0);
  const settledAwaitingRecon = Math.max(0, completedCount - reconciledCount);
  const autoReconciledRate = completedCount > 0 ? Math.round((reconciledCount / completedCount) * 100) : null;
  const operationsStream = (demoFocus ? auditLogs : auditLogs.filter(isStreamActivity)).slice(0, 6);

  const riskItems = [
    reconExceptions > 0 && {
      label: `${reconExceptions} reconciliation exception${reconExceptions === 1 ? "" : "s"}`,
      detail: "Independent evidence contradicts or cannot corroborate a settlement.",
      href: `/reconciliation?status=EXCEPTION${demoFocus ? "&demo=1" : ""}`,
      severity: "high" as const,
    },
    settledAwaitingRecon > 0 && {
      label: `${settledAwaitingRecon} settled without independent reconciliation`,
      detail: "Provider claims completion — uncorroborated until a bank/PSP record matches.",
      href: `/settlements?status=SETTLED${demoFocus ? "&demo=1" : ""}`,
      severity: "medium" as const,
    },
    pendingApprovals > 0 && {
      label: `${pendingApprovals} settlement${pendingApprovals === 1 ? "" : "s"} awaiting approval`,
      detail: "Approval is required audit evidence for finality.",
      href: `/settlements?status=REQUESTED${demoFocus ? "&demo=1" : ""}`,
      severity: "medium" as const,
    },
    expiredQuotes > 0 && {
      label: `${expiredQuotes} expired quote${expiredQuotes === 1 ? "" : "s"}`,
      detail: "Refresh or archive stale quotes before the next settlement run.",
      href: "/quotes?tab=expired",
      severity: "low" as const,
    },
    shadowConfig.livePayoutsEnabled && {
      label: "LIVE_PAYOUTS_ENABLED is set",
      detail: "Tripwire: finality is blocked for all shadow/live-test settlements until this is off.",
      href: "/settlements",
      severity: "high" as const,
    },
  ].filter(Boolean) as { label: string; detail: string; href: string; severity: "high" | "medium" | "low" }[];

  const pilotItems = [
    { label: "Live payouts", ok: !shadowConfig.livePayoutsEnabled, detail: shadowConfig.livePayoutsEnabled ? "ENABLED — must be off" : "Disabled (guarded)" },
    { label: "Per-settlement cap", ok: true, detail: `INR ${shadowConfig.liveTestMaxInr.toLocaleString("en-IN")}` },
    {
      label: "Daily pilot cap",
      ok: dailyUsedInr <= shadowConfig.liveTestDailyMaxInr,
      detail: `INR ${dailyUsedInr.toLocaleString("en-IN")} of ${shadowConfig.liveTestDailyMaxInr.toLocaleString("en-IN")} used today`,
    },
    { label: "Provider allowlist", ok: true, detail: shadowConfig.liveTestAllowedProviders.join(", ") },
    { label: "Operator approval", ok: true, detail: "Required for every settlement (audit-logged)" },
    { label: "Second approver", ok: true, detail: "Dual-control: creator self-approval rejected" },
    { label: "Settlement report", ok: reportsGenerated > 0, detail: `${reportsGenerated} generated to date` },
  ];

  const latestCompletedAt = latestProof
    ? latestProof.reconciledAt ?? latestProof.settledAt ?? latestProof.createdAt
    : null;
  const latestFinality = latestProof ? FINALITY_CHIP[latestProof.assessment.decision] : null;

  return (
    <div className="space-y-5">
      {/* 1 ── Executive command hero ─────────────────────────────────────── */}
      <section className="conf-hero p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="overview-live-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-700">
                <span className="ops-pulse ops-pulse--subtle" aria-hidden="true" />
                Rails live
              </span>
              <span className={MODE_CHIP[operatingMode]}>{MODE_LABEL[operatingMode]} workspace</span>
              <span className={cn("case-chip", pontisConnected ? "case-chip--shadow" : "case-chip--demo")}>
                {pontisConnected ? "PontisGlobe connected" : "Pontis offline"}
              </span>
              {demoFocus ? <DemoFocusBadge /> : null}
            </div>

            <h1 className="conf-hero__headline mt-4">
              Payment completed <span className="conf-hero__neq">≠</span> settlement finalized.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
              {organization.displayName} settles on evidence, not provider claims: provider proof, independent
              reconciliation and the audit trail must agree before finality.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button asChild variant="primary" size="sm">
                <Link href={`/quotes${demoQuery}`} className="inline-flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  New quote
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/settlements${demoQuery}`} className="inline-flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5" />
                  Operations console
                </Link>
              </Button>
              {latestProof ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/settlements/${latestProof.id}/report`} className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Latest report
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Latest settlement proof case panel */}
          <div className="conf-hero__proof p-4">
            {latestProof ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="ops-eyebrow">Latest settlement proof</p>
                  {latestCompletedAt ? (
                    <time className="text-[11px] tabular-nums text-slate-400">{formatDateTime(latestCompletedAt)}</time>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold tracking-tight text-slate-950">{latestProof.publicId}</p>
                  <StatusBadge status={latestProof.status} />
                  <span className={MODE_CHIP[(latestProof.testMode in MODE_CHIP ? latestProof.testMode : "DEMO") as SettlementMode]}>
                    {MODE_LABEL[(latestProof.testMode in MODE_LABEL ? latestProof.testMode : "DEMO") as SettlementMode]}
                  </span>
                </div>
                <p className="case-card__amount mt-2">
                  {formatCurrencyFull(String(latestProof.sourceAmount), latestProof.sourceCurrency)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {latestProof.provider ? <span>{latestProof.provider}</span> : null}
                  {latestProof.providerTransactionId ? (
                    <span className="tabular-nums">{latestProof.providerTransactionId.slice(0, 14)}</span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                    <span className={latestFinality?.className}>{latestFinality?.label}</span>
                    <span className="tabular-nums">{latestProof.assessment.confidence}% confidence</span>
                  </div>
                  <div className="confidence-meter mt-1.5">
                    <div
                      className={cn(
                        "confidence-meter__fill",
                        latestProof.assessment.decision === "ready_to_finalize"
                          ? "confidence-meter__fill--ready"
                          : latestProof.assessment.decision === "needs_review"
                            ? "confidence-meter__fill--review"
                            : "confidence-meter__fill--neutral",
                      )}
                      style={{ width: `${latestProof.assessment.confidence}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50/80 p-2.5">
                  <SettlementLifecycle status={latestProof.status} compact />
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-600">No completed settlement yet</p>
                <p className="mt-1 text-xs text-slate-400">Create a quote to start the evidence chain.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2 ── Settlement confidence pipeline (main anchor) ───────────────── */}
      <section aria-label="Settlement confidence pipeline">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="ops-eyebrow">Settlement confidence pipeline</p>
          <p className="text-[11px] text-slate-400">
            {latestProof ? `Tracking ${latestProof.publicId}` : "Awaiting first case"}
          </p>
        </div>
        <div className="conf-pipeline">
          {pipeline.map((step, index) => (
            <div key={step.name} className={cn("conf-step", `conf-step--${step.state}`)}>
              <p className="conf-step__index">STEP {index + 1}</p>
              <p className="conf-step__name">{step.name}</p>
              <p className="conf-step__state">{STEP_STATE_LABEL[step.state]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3+4 ── Pilot snapshot + operations health ───────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="ops-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="ops-eyebrow">Live pilot readiness</p>
            <span className={cn("case-chip", liveTestCount > 0 ? "case-chip--live" : "case-chip--demo")}>
              {liveTestCount > 0 ? `${liveTestCount} live-test case${liveTestCount === 1 ? "" : "s"}` : "No pilot case yet"}
            </span>
          </div>
          <div className="mt-2 space-y-0.5">
            {pilotItems.map((item) => (
              <div key={item.label} className="check-item text-sm">
                <span className={cn("check-dot", item.ok ? "check-dot--done" : "check-dot--blocked")}>
                  {item.ok ? "✓" : "✕"}
                </span>
                <div className="min-w-0">
                  <span className="text-slate-700">{item.label}</span>
                  <span className="block truncate text-xs text-slate-400">{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 border-t border-[var(--ops-line-soft)] pt-2 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-emerald-ink" />
            INRSettle does not move funds. The partner/provider moves money externally; INRSettle controls the
            operational layer.
          </p>
        </div>

        <div>
          <p className="ops-eyebrow mb-2">Operations health</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Completed" value={completedCount} hint="Settled or reconciled" tone="success" />
            <MetricCard
              label="Auto-reconciled"
              value={autoReconciledRate !== null ? `${autoReconciledRate}%` : "—"}
              hint="Of completed settlements"
              tone="info"
            />
            <MetricCard
              label="Exceptions"
              value={reconExceptions}
              hint="Operations queue"
              tone={reconExceptions ? "danger" : "neutral"}
            />
            <MetricCard label="In flight" value={inFlightCount} hint="Approved or executing" tone="info" />
            <MetricCard
              label="Needs review"
              value={settledAwaitingRecon}
              hint="Settled, not yet corroborated"
              tone={settledAwaitingRecon ? "warning" : "neutral"}
            />
            <MetricCard label="Reports generated" value={reportsGenerated} hint="Executive settlement reports" />
          </div>
        </div>
      </section>

      {/* 5 ── Risk & exceptions ──────────────────────────────────────────── */}
      <section className="ops-panel p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="ops-eyebrow">Risk &amp; exceptions</p>
          <span className={cn("case-chip", riskItems.length ? "case-chip--gold" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
            {riskItems.length ? `${riskItems.length} open` : "All clear"}
          </span>
        </div>
        {riskItems.length ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {riskItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "group flex items-start justify-between gap-3 rounded-xl border p-3 transition-shadow hover:shadow-[var(--ops-shadow-xs)]",
                  item.severity === "high" && "border-red-200 bg-red-50/50",
                  item.severity === "medium" && "border-amber-200 bg-amber-50/50",
                  item.severity === "low" && "border-[var(--ops-line)] bg-white",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                </div>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No open exceptions, uncorroborated settlements, stale quotes, or blocked finality.
          </p>
        )}
      </section>

      {/* 6 ── Recent settlement case cards ───────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="ops-eyebrow">Recent settlement cases</p>
          <Link href={`/settlements${demoQuery}`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
            Open console →
          </Link>
        </div>
        {recentSettlements.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentSettlements.map((settlement) => {
              const finality = FINALITY_CHIP[settlement.assessment.decision];
              const modeKey = (settlement.testMode in MODE_CHIP ? settlement.testMode : "DEMO") as SettlementMode;
              const matched = settlement.reconciliation.some((r) => r.status === "MATCHED");
              return (
                <Link key={settlement.id} href={`/settlements/${settlement.id}/report`} className="case-card p-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[13px] font-semibold tracking-tight text-slate-950">{settlement.publicId}</p>
                    <span className={MODE_CHIP[modeKey]}>{MODE_LABEL[modeKey]}</span>
                    <span className="ml-auto">
                      <StatusBadge status={settlement.status} />
                    </span>
                  </div>
                  <p className="case-card__amount mt-2">
                    {formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {settlement.provider ?? "No provider"} · {settlement.reference}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className={cn("case-chip", settlement.providerProofs.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "case-chip--demo")}>
                      proof {settlement.providerProofs.length ? "✓" : "—"}
                    </span>
                    <span className={cn("case-chip", matched ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "case-chip--demo")}>
                      recon {matched ? "✓" : "—"}
                    </span>
                    <span className={finality.className}>{finality.label}</span>
                  </div>
                  <div className="confidence-meter mt-2.5">
                    <div
                      className={cn(
                        "confidence-meter__fill",
                        settlement.assessment.decision === "ready_to_finalize"
                          ? "confidence-meter__fill--ready"
                          : settlement.assessment.decision === "needs_review"
                            ? "confidence-meter__fill--review"
                            : "confidence-meter__fill--neutral",
                      )}
                      style={{ width: `${settlement.assessment.confidence}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ops-panel p-8 text-center text-sm text-slate-500">
            No settlements yet — create a quote to open the first case.
          </div>
        )}
      </section>

      {/* 7+8 ── Provider rails + operations stream ───────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="ops-eyebrow mb-2">Provider rail health</p>
          <div className="space-y-2">
            {[
              {
                name: "PontisGlobe",
                role: "INR payout rail · VPS gateway",
                up: pontisConnected,
                safety: "Sandbox · live payouts disabled",
              },
              {
                name: "RemitQuickly",
                role: "IMPS payout rail",
                up: remitQuicklyConnected,
                safety: "Sandbox · isTest enforced",
              },
              {
                name: "BuyUcoin",
                role: "INR liquidity venue (reference)",
                up: true,
                safety: "Reference counterparty",
              },
            ].map((rail) => (
              <div key={rail.name} className="rail-health flex items-center gap-3 p-3">
                <span className={cn("rail-health__dot", rail.up ? "rail-health__dot--up" : "rail-health__dot--idle")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-tight text-slate-950">{rail.name}</p>
                  <p className="truncate text-xs text-slate-400">{rail.role}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-medium", rail.up ? "text-emerald-700" : "text-slate-400")}>
                    {rail.up ? "Connected" : "Not configured"}
                  </p>
                  <p className="text-[10px] text-slate-400">{rail.safety}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ops-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="ops-eyebrow">Operations stream</p>
            <Link href={`/audit-logs${demoQuery}`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
              Full audit trail →
            </Link>
          </div>
          {operationsStream.length ? (
            <div className="audit-line mt-2 space-y-0.5">
              {operationsStream.map((log) => {
                const actor = log.actorType.toLowerCase() as "user" | "api" | "system";
                return (
                  <div key={log.id} className={`audit-event audit-event--${actor}`}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-[13px] font-medium tracking-tight text-slate-950">
                        {humanizeStreamAction(log.action)}
                      </p>
                      <span className={`audit-actor audit-actor--${actor}`}>{log.actorType}</span>
                      <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{log.user?.email ?? log.actorType}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No operational activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
