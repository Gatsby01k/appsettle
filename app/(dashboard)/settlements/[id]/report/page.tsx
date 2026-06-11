import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assessFinality, type FinalityAssessment } from "@/lib/finality";
import { buildFinalityInput, hasAuditApproval, latestProofOf, relevantReconciliationOf } from "@/lib/finality-input";
import { RECONCILIATION_SOURCE_LABEL, isIndependentReconciliationSource } from "@/lib/reconciliation";
import {
  MODE_DESCRIPTION,
  MODE_LABEL,
  buildShadowChecklist,
  getShadowConfig,
  inrLegOf,
  safetyFor,
  type SettlementMode,
} from "@/lib/shadow-mode";
import { buildLivePilotReadiness } from "@/lib/live-pilot";
import { writeAuditLog } from "@/lib/audit";
import { cn, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { Button } from "@/components/ui/button";

/**
 * Settlement Report — the demo-ready "Proof-to-Settlement" package for one
 * settlement. Read-only, server-rendered, screenshot-friendly. Everything on
 * this page derives from persisted evidence plus the deterministic finality
 * engine; nothing is recomputed differently from the API or the Finality tab.
 */

const DECISION_META = {
  ready_to_finalize: {
    label: "Ready to finalize",
    icon: CheckCircle2,
    banner: "finality-banner finality-banner--ready text-emerald-900",
    fill: "confidence-meter__fill--ready",
  },
  needs_review: {
    label: "Needs review",
    icon: AlertTriangle,
    banner: "finality-banner finality-banner--review text-amber-900",
    fill: "confidence-meter__fill--review",
  },
  not_ready: {
    label: "Not ready",
    icon: CircleDashed,
    banner: "finality-banner finality-banner--neutral text-slate-700",
    fill: "confidence-meter__fill--neutral",
  },
} as const;

const RISK_CHIP = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
} as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{children}</p>
  );
}

function ReportList({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DecisionBanner({ assessment }: { assessment: FinalityAssessment }) {
  const meta = DECISION_META[assessment.decision];
  const Icon = meta.icon;
  const confidence = Math.max(0, Math.min(100, assessment.confidence));

  return (
    <div className={meta.banner}>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" />
          <p className="text-base font-semibold tracking-tight">{meta.label}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
            RISK_CHIP[assessment.riskLevel],
          )}
        >
          {assessment.riskLevel} risk
        </span>
      </div>
      <p className="mt-2 pl-2 text-sm leading-relaxed opacity-90">{assessment.summary}</p>
      <div className="mt-3 pl-2">
        <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] opacity-70">
          <span>Finality confidence</span>
          <span className="tabular-nums">{confidence}%</span>
        </div>
        <div className="confidence-meter mt-1">
          <div className={cn("confidence-meter__fill", meta.fill)} style={{ width: `${confidence}%` }} />
        </div>
      </div>
    </div>
  );
}

export default async function SettlementReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, organization } = await requireSession();
  const { id } = await params;

  const settlement = await prisma.settlement.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      providerProofs: { orderBy: { receivedAt: "desc" } },
      // No nested orderBy on this relation: combined with take it triggers a
      // Prisma 7 + @prisma/adapter-pg bug (Postgres 42809) — sorted in JS below.
      reconciliation: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!settlement) notFound();

  const reconciliationRecords = [...settlement.reconciliation].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const shadowConfig = getShadowConfig();
  const isLiveTest = settlement.testMode === "LIVE_TEST";

  // "Settlement report generated" is itself pilot evidence: record it once in
  // the append-only audit trail (deduped; best-effort — a failed write never
  // blocks rendering the report).
  try {
    const existingReportLog = await prisma.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        action: "settlement.report_generated",
        resourceType: "settlement",
        resourceId: settlement.id,
      },
    });
    if (!existingReportLog) {
      await writeAuditLog({
        action: "settlement.report_generated",
        resourceType: "settlement",
        resourceId: settlement.id,
        organizationId: organization.id,
        userId: user.id,
        after: { publicId: settlement.publicId, testMode: settlement.testMode },
      });
    }
  } catch {
    // Non-fatal: the report still renders; the checklist item simply stays open.
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [finalityApproval, todaysLiveTests] = await Promise.all([
    prisma.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        action: "settlement.finality_approved",
        resourceType: "settlement",
        resourceId: settlement.id,
      },
    }),
    isLiveTest
      ? prisma.settlement.findMany({
          where: {
            organizationId: organization.id,
            testMode: "LIVE_TEST",
            id: { not: settlement.id },
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
        })
      : Promise.resolve([]),
  ]);
  const dailyUsedInrExcludingThis = todaysLiveTests.reduce((sum, row) => sum + inrLegOf(row), 0);

  const safety = {
    ...safetyFor(settlement, shadowConfig),
    ...(isLiveTest
      ? {
          withinDailyCap:
            dailyUsedInrExcludingThis + inrLegOf(settlement) <= shadowConfig.liveTestDailyMaxInr,
          dailyCapLabel: `INR ${shadowConfig.liveTestDailyMaxInr.toLocaleString("en-IN")}`,
        }
      : {}),
  };
  const checklist = buildShadowChecklist(
    settlement,
    settlement.providerProofs,
    reconciliationRecords,
    settlement.events,
    shadowConfig,
  );
  const mode = (settlement.testMode in MODE_LABEL ? settlement.testMode : "DEMO") as SettlementMode;
  const isShadowMode = mode === "SHADOW" || mode === "LIVE_TEST";

  const assessment = assessFinality(
    buildFinalityInput(
      settlement,
      settlement.providerProofs,
      reconciliationRecords,
      settlement.events,
      safety,
    ),
  );
  const proof = latestProofOf(settlement.providerProofs);
  const reconciliation = relevantReconciliationOf(reconciliationRecords);
  const approvalRecorded = hasAuditApproval(settlement, settlement.events);
  const generatedAt = new Date();

  const pilot = isLiveTest
    ? buildLivePilotReadiness(
        settlement,
        settlement.providerProofs,
        reconciliationRecords,
        settlement.events,
        {
          finalityApprovedById: finalityApproval?.userId ?? null,
          createdById: settlement.createdById,
          reportGenerated: true, // this render just recorded it
          dailyUsedInrExcludingThis,
        },
        shadowConfig,
        assessment.decision,
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="report-print-hide flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/settlements" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Settlements
          </Link>
        </Button>
        <p className="text-[11px] text-slate-400">
          Generated {formatDateTime(generatedAt)} · INRSettle settlement report
        </p>
      </div>

      <div className="report-sheet space-y-5 p-5 sm:p-6">
        {/* Header */}
        <div className="report-band -mx-5 -mt-5 flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Settlement report
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">{settlement.publicId}</h1>
            <p className="text-sm text-slate-500">{settlement.reference}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={settlement.status} />
            <span
              className={cn(
                "case-chip",
                mode === "DEMO" && "case-chip--demo",
                mode === "SHADOW" && "case-chip--shadow",
                mode === "LIVE_TEST" && "case-chip--live",
              )}
            >
              {MODE_LABEL[mode]} mode
            </span>
            <span className="text-xs text-slate-500">{settlement.corridor.replace("_", " → ")}</span>
          </div>
        </div>

        {/* Finality decision */}
        <DecisionBanner assessment={assessment} />

        {/* Mode + money movement + safety checklist */}
        <div className="report-section p-4">
          <SectionTitle>Test mode &amp; safety</SectionTitle>
          <StatRow label="Mode" value={`${MODE_LABEL[mode]} — ${MODE_DESCRIPTION[mode]}`} />
          <StatRow
            label="Funds moved by INRSettle"
            value={mode === "DEMO" ? "No — demo data only" : "No — external provider moved money"}
          />
          {isShadowMode ? (
            <>
              <StatRow
                label="Safety cap"
                value={`${safety.capLabel} · ${safety.withinCap ? "within cap" : "EXCEEDED"}`}
              />
              <StatRow
                label="Live payouts"
                value={safety.livePayoutsDisabled ? "Disabled" : "ENABLED — must be turned off"}
              />
            </>
          ) : null}
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Shadow test checklist
            </p>
            {checklist.map((item) => (
              <div key={item.key} className="check-item text-sm">
                <span className={cn("check-dot", item.done ? "check-dot--done" : "check-dot--pending")}>
                  {item.done ? "✓" : "•"}
                </span>
                <div>
                  <span className={item.done ? "text-slate-700" : "font-medium text-slate-900"}>{item.label}</span>
                  <span className="block text-xs text-slate-400">{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
          {isShadowMode ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              Funds were moved by the external provider. INRSettle recorded and verified the settlement.
              {isLiveTest ? " Live payouts disabled." : ""}
            </p>
          ) : null}
        </div>

        {/* Live pilot readiness (LIVE_TEST only) */}
        {pilot ? (
          <div className="report-section p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <SectionTitle>Live pilot readiness</SectionTitle>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                  pilot.decision === "ready" && "bg-emerald-100 text-emerald-800",
                  pilot.decision === "needs_review" && "bg-amber-100 text-amber-800",
                  pilot.decision === "blocked" && "bg-red-100 text-red-800",
                )}
              >
                {pilot.decision === "ready"
                  ? "Ready"
                  : pilot.decision === "needs_review"
                    ? "Needs review"
                    : "Blocked"}
              </span>
            </div>
            <div className="space-y-2">
              {pilot.items.map((item) => (
                <div key={item.key} className="check-item text-sm">
                  <span
                    className={cn(
                      "check-dot",
                      item.done ? "check-dot--done" : item.blocking ? "check-dot--blocked" : "check-dot--pending",
                    )}
                  >
                    {item.done ? "✓" : item.blocking ? "✕" : "•"}
                  </span>
                  <div>
                    <span className={item.done ? "text-slate-700" : "font-medium text-slate-900"}>{item.label}</span>
                    <span className="block text-xs text-slate-400">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Settlement summary */}
        <div className="report-section p-4">
          <SectionTitle>Settlement summary</SectionTitle>
          <StatRow
            label="Source"
            value={`${formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)} · ${settlement.sourceAccount}`}
          />
          <StatRow
            label="Destination"
            value={`${formatCurrencyFull(String(settlement.targetAmount), settlement.targetCurrency)} · ${settlement.targetAccount}`}
          />
          <StatRow label="Fee" value={formatCurrencyFull(String(settlement.feeAmount), settlement.sourceCurrency)} />
          <StatRow label="Provider" value={settlement.provider ?? "—"} />
          <StatRow label="Created" value={formatDateTime(settlement.createdAt)} />
          {settlement.approvedAt ? <StatRow label="Approved" value={formatDateTime(settlement.approvedAt)} /> : null}
          {settlement.settledAt ? <StatRow label="Settled" value={formatDateTime(settlement.settledAt)} /> : null}
          {settlement.reconciledAt ? (
            <StatRow label="Reconciled" value={formatDateTime(settlement.reconciledAt)} />
          ) : null}
        </div>

        {/* Provider proof */}
        <div className="report-section p-4">
          <SectionTitle>Provider proof</SectionTitle>
          {proof ? (
            <>
              <StatRow label="Provider" value={proof.provider} />
              <StatRow label="Provider status" value={proof.providerStatus} />
              <StatRow label="Transaction" value={proof.providerTransactionId ?? "—"} />
              <StatRow label="UTR / reference" value={proof.utr ?? "Not provided"} />
              <StatRow
                label="Reported amount"
                value={
                  proof.actualAmount != null && proof.currency
                    ? formatCurrencyFull(proof.actualAmount.toString(), proof.currency)
                    : "Not reported"
                }
              />
              <StatRow label="Received via" value={proof.receivedVia.toLowerCase()} />
              <StatRow label="Received at" value={formatDateTime(proof.receivedAt)} />
              {settlement.providerProofs.length > 1 ? (
                <StatRow label="Proof records" value={String(settlement.providerProofs.length)} />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-400">No provider proof recorded.</p>
          )}
        </div>

        {/* Independent reconciliation */}
        <div className="report-section p-4">
          <SectionTitle>Independent reconciliation</SectionTitle>
          {reconciliation ? (
            <>
              <StatRow label="External reference" value={reconciliation.externalRef} />
              <StatRow
                label="Source"
                value={RECONCILIATION_SOURCE_LABEL[reconciliation.source] ?? reconciliation.source}
              />
              <StatRow label="Status" value={reconciliation.status} />
              <StatRow
                label="Amount"
                value={formatCurrencyFull(String(reconciliation.amount), reconciliation.currency)}
              />
              <StatRow label="Value date" value={formatDateTime(reconciliation.valueDate)} />
              <div className="mt-2">
                {isIndependentReconciliationSource(reconciliation.source) ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-emerald-700">
                    Independent evidence
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-amber-800">
                    Provider claim — does not count toward finality
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              Missing reconciliation record. Provider claim unverified.
            </p>
          )}
        </div>

        {/* Audit trail */}
        <div className="report-section p-4">
          <SectionTitle>Audit trail</SectionTitle>
          <StatRow label="Approval recorded" value={approvalRecorded ? "Yes" : "No"} />
          {settlement.events.length ? (
            <ol className="mt-3 relative space-y-3 border-l border-slate-200 pl-4">
              {settlement.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-emerald" />
                  <p className="text-sm font-medium text-slate-950">
                    {event.fromStatus ? `${event.fromStatus} → ` : ""}
                    {event.toStatus}
                  </p>
                  {event.note ? <p className="text-xs text-slate-500">{event.note}</p> : null}
                  <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(event.createdAt)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No lifecycle events recorded.</p>
          )}
        </div>

        {/* Finality detail */}
        {assessment.blockingIssues.length > 0 ? (
          <div className="report-section p-4">
            <SectionTitle>Blocking issues</SectionTitle>
            <ReportList items={assessment.blockingIssues} dot="bg-red-500" />
          </div>
        ) : null}
        {assessment.warnings.length > 0 ? (
          <div className="report-section p-4">
            <SectionTitle>Warnings</SectionTitle>
            <ReportList items={assessment.warnings} dot="bg-amber-500" />
          </div>
        ) : null}
        {assessment.evidence.length > 0 ? (
          <div className="report-section p-4">
            <SectionTitle>Evidence</SectionTitle>
            <ReportList items={assessment.evidence} dot="bg-emerald-500" />
          </div>
        ) : null}
        {assessment.recommendedActions.length > 0 ? (
          <div className="report-section p-4">
            <SectionTitle>Recommended actions</SectionTitle>
            <ReportList items={assessment.recommendedActions} dot="bg-slate-400" />
          </div>
        ) : null}

        <p className="report-footnote pt-3">
          Finality requires provider proof, independent reconciliation and audit approval. Provider
          &quot;completed&quot; alone never finalizes a settlement.
        </p>
      </div>
    </div>
  );
}
