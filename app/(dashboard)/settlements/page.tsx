import { Suspense } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { SettlementStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  autoMatchReconciliation,
  createSettlement,
  generateSettlementBankRecordAndReconcile,
  transitionSettlement,
} from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { assessFinality } from "@/lib/finality";
import { buildFinalityInput, hasAuditApproval, latestProofOf, relevantReconciliationOf } from "@/lib/finality-input";
import {
  INDEPENDENT_RECONCILIATION_SOURCES,
  RECONCILIATION_SOURCE_LABEL,
  isIndependentReconciliationSource,
} from "@/lib/reconciliation";
import { MODE_LABEL, getShadowConfig, safetyFor, type SettlementMode } from "@/lib/shadow-mode";
import { canApproveSettlement } from "@/lib/permissions";
import { counterpartyForCorridor } from "@/lib/treasury";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrencyCompact, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ops/status-badge";
import { FilterBar } from "@/components/ops/filter-bar";
import { FormSelect } from "@/components/ops/form-select";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import {
  SettlementDetailSheet,
  type SettlementDetail,
} from "@/components/dashboard/settlement-detail-sheet";
import {
  SettlementOperationConsoleRow,
  SettlementPageFlash,
  SettlementRowStatusSubtext,
  type SettlementOperationConsoleData,
} from "@/components/dashboard/settlement-operation-console";
import {
  SettlementActionForm,
  SettlementActionsProvider,
  SettlementAutoRefresh,
} from "@/components/dashboard/settlement-auto-refresh";
import { RemitQuicklyTestButton } from "@/components/providers/remitquickly-test-button";
import { isRemitQuicklyConfigured } from "@/lib/providers/remitquickly/client";
import { isSandboxTestEnabled } from "@/lib/providers/remitquickly/flags";
import { executeApprovedSettlement } from "@/lib/providers/remitquickly/settlement";
import { isPontisConfigured } from "@/lib/providers/pontis/client";
import { isPontisGatewayConfigured } from "@/lib/providers/pontis/gateway";
import {
  executeApprovedSettlement as executePontisSettlement,
  checkPayoutStatus as checkPontisPayoutStatus,
} from "@/lib/providers/pontis/settlement";

/**
 * PontisGlobe is "enabled" whenever either the VPS gateway is configured (the
 * production path on Vercel — Pontis keys live only on the gateway) or the
 * Pontis credentials are present directly (e.g. running on the VPS host itself).
 */
function isPontisEnabled() {
  return isPontisGatewayConfigured() || isPontisConfigured();
}

function revalidateSettlementsPage() {
  revalidatePath("/settlements");
  revalidatePath("/dashboard/settlements");
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/helper-text";
import { SubmitButton } from "@/components/ui/submit-button";

function pageFlashMessage(value?: string) {
  if (value === "created") return "Settlement created.";
  if (value === "reconciled" || value === "matched") {
    return "Settlement complete — provider payout, reconciliation and audit trail recorded.";
  }
  return null;
}

function hasWorkflowAction(status: SettlementStatus) {
  return new Set<SettlementStatus>([
    SettlementStatus.REQUESTED,
    SettlementStatus.APPROVED,
    SettlementStatus.EXECUTING,
  ]).has(status);
}

function isInFlight(status: SettlementStatus) {
  return new Set<SettlementStatus>([SettlementStatus.APPROVED, SettlementStatus.EXECUTING]).has(status);
}

function isCompleted(status: SettlementStatus) {
  return new Set<SettlementStatus>([SettlementStatus.SETTLED, SettlementStatus.RECONCILED]).has(status);
}

function rowShowsConsole(status: SettlementStatus) {
  return new Set<SettlementStatus>([
    SettlementStatus.APPROVED,
    SettlementStatus.EXECUTING,
    SettlementStatus.SETTLED,
    SettlementStatus.RECONCILED,
  ]).has(status);
}

function successMatchesRow(success: string | undefined, status: SettlementStatus) {
  if (!success) return false;
  const map: Partial<Record<string, SettlementStatus>> = {
    approved: SettlementStatus.APPROVED,
    executing: SettlementStatus.EXECUTING,
    settled: SettlementStatus.SETTLED,
    reconciled: SettlementStatus.RECONCILED,
    matched: SettlementStatus.RECONCILED,
    checked: SettlementStatus.EXECUTING,
  };
  return map[success] === status;
}

/**
 * One dominant operational state + human summary per case (display only).
 * The lifecycle status stays visible; this names what the OPERATOR should
 * care about right now.
 */
function caseOperationalSummary(
  status: SettlementStatus,
  finality: { decision: string; riskLevel: string; reconciliation: { status: string; independent: boolean } | null },
): string {
  if (status === SettlementStatus.REQUESTED) {
    return "Awaiting approval before execution.";
  }
  if (status === SettlementStatus.APPROVED) {
    return "Approved. Execute the payout via the provider to start tracking.";
  }
  if (status === SettlementStatus.EXECUTING) {
    return "Payout submitted. Tracking provider status.";
  }
  if (status === SettlementStatus.FAILED) {
    return "Provider reported a terminal failure before money moved.";
  }
  if (status === SettlementStatus.RECONCILED && finality.decision === "ready_to_finalize") {
    return "Proof, independent reconciliation and audit trail agree — safe to finalize.";
  }
  if (status === SettlementStatus.SETTLED || status === SettlementStatus.RECONCILED) {
    const recon = finality.reconciliation;
    if (recon && (recon.status === "UNMATCHED" || recon.status === "EXCEPTION")) {
      return "Provider payout completed, but independent evidence does not match — investigate before finality.";
    }
    if (finality.riskLevel === "high") {
      return "Provider payout completed, but a high-risk issue blocks finality.";
    }
    return "Provider payout completed. Reconciliation is still pending before finality.";
  }
  return "Settlement in progress.";
}

function demoSettlementWhere(organizationId: string) {
  return {
    organizationId,
    OR: [{ publicId: { startsWith: "SET-DEMO" } }, { reference: { startsWith: "DEMO-" } }],
  };
}

const MODE_CHIP_CLASS: Record<SettlementMode, string> = {
  DEMO: "case-chip--demo",
  SHADOW: "case-chip--shadow",
  LIVE_TEST: "case-chip--live",
};

function ModeChip({ testMode }: { testMode: string }) {
  const key = (testMode in MODE_CHIP_CLASS ? testMode : "DEMO") as SettlementMode;
  return (
    <span
      className={cn("case-chip", MODE_CHIP_CLASS[key])}
      title="DEMO: fake data · SHADOW/LIVE TEST: money moves externally via the partner/provider — INRSettle does not move funds"
    >
      {MODE_LABEL[key]}
    </span>
  );
}

function DemoFocusBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-800">
      Demo focus mode
    </span>
  );
}

type SettlementRow = Awaited<
  ReturnType<
    typeof prisma.settlement.findMany<{
      include: { events: true; reconciliation: true; providerProofs: true };
    }>
  >
>[number];

/**
 * Builds the serializable "Proof-to-Settlement" case file for the detail
 * sheet. The decision itself comes from the deterministic engine
 * (lib/finality.ts) over the same shared input builder the API route uses —
 * the dashboard and GET /api/settlements/[id]/finality can never disagree.
 */
function toFinalityReviewData(settlement: SettlementRow): SettlementDetail["finality"] {
  const assessment = assessFinality(
    buildFinalityInput(
      settlement,
      settlement.providerProofs,
      settlement.reconciliation,
      settlement.events,
      safetyFor(settlement, getShadowConfig()),
    ),
  );
  const proof = latestProofOf(settlement.providerProofs);
  const reconciliation = relevantReconciliationOf(settlement.reconciliation);

  return {
    decision: assessment.decision,
    riskLevel: assessment.riskLevel,
    confidence: assessment.confidence,
    summary: assessment.summary,
    blockingIssues: assessment.blockingIssues,
    warnings: assessment.warnings,
    evidence: assessment.evidence,
    recommendedActions: assessment.recommendedActions,
    proof: proof
      ? {
          provider: proof.provider,
          providerStatus: proof.providerStatus,
          providerTransactionId: proof.providerTransactionId ?? undefined,
          utr: proof.utr ?? undefined,
          actualAmount:
            proof.actualAmount != null && proof.currency
              ? formatCurrencyFull(proof.actualAmount.toString(), proof.currency)
              : undefined,
          currency: proof.currency ?? undefined,
          receivedVia: proof.receivedVia,
          receivedAt: formatDateTime(proof.receivedAt),
        }
      : null,
    proofCount: settlement.providerProofs.length,
    reconciliation: reconciliation
      ? {
          status: reconciliation.status,
          externalRef: reconciliation.externalRef,
          source: reconciliation.source,
          sourceLabel: RECONCILIATION_SOURCE_LABEL[reconciliation.source] ?? reconciliation.source,
          independent: isIndependentReconciliationSource(reconciliation.source),
          amount: formatCurrencyFull(String(reconciliation.amount), reconciliation.currency),
        }
      : null,
    auditApprovalPresent: hasAuditApproval(settlement, settlement.events),
  };
}

function toSettlementDetail(settlement: SettlementRow): SettlementDetail {
  const cp = counterpartyForCorridor(settlement.corridor);
  return {
    publicId: settlement.publicId,
    reference: settlement.reference,
    corridor: settlement.corridor.replace("_", " → "),
    status: settlement.status,
    provider: settlement.provider ?? undefined,
    providerTransactionId: settlement.providerTransactionId ?? undefined,
    sourceAmount: formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency),
    targetAmount: formatCurrencyFull(String(settlement.targetAmount), settlement.targetCurrency),
    feeAmount: formatCurrencyFull(String(settlement.feeAmount), settlement.sourceCurrency),
    createdAt: formatDateTime(settlement.createdAt),
    approvedAt: settlement.approvedAt ? formatDateTime(settlement.approvedAt) : undefined,
    settledAt: settlement.settledAt ? formatDateTime(settlement.settledAt) : undefined,
    reconciledAt: settlement.reconciledAt ? formatDateTime(settlement.reconciledAt) : undefined,
    sourceAccount: settlement.sourceAccount,
    targetAccount: settlement.targetAccount,
    counterparty: { name: cp.name, type: cp.type, country: cp.country },
    events: settlement.events.map((event) => ({
      label: event.toStatus.replaceAll("_", " "),
      note: event.note ?? undefined,
      at: formatDateTime(event.createdAt),
    })),
    reconciliation: settlement.reconciliation.map((record) => ({
      externalRef: record.externalRef,
      source: record.source,
      status: record.status,
      amount: formatCurrencyFull(String(record.amount), record.currency),
      valueDate: formatDateTime(record.valueDate),
    })),
    finality: toFinalityReviewData(settlement),
  };
}

function toOperationConsoleData(settlement: SettlementRow): SettlementOperationConsoleData {
  return {
    status: settlement.status,
    corridor: settlement.corridor.replace("_", " → "),
    amount: formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency),
    provider: settlement.provider ?? undefined,
    providerStatus: settlement.providerStatus ?? undefined,
    providerTransactionId: settlement.providerTransactionId ?? undefined,
    hasReconciliation: settlement.reconciliation.length > 0,
    hasAuditEvents: settlement.events.length > 0,
  };
}

async function submitSettlement(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  try {
    await createSettlement(
      {
        quoteId: String(formData.get("quoteId") ?? ""),
        reference: String(formData.get("reference") ?? ""),
        sourceAccount: String(formData.get("sourceAccount") ?? ""),
        targetAccount: String(formData.get("targetAccount") ?? ""),
      },
      user.id,
      organization.id,
    );
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  revalidateSettlementsPage();
  redirect("/settlements?success=created");
}

async function transition(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const status = String(formData.get("status")) as SettlementStatus;
  const settlementId = String(formData.get("settlementId"));
  let finalStatus: string = status;
  try {
    // When a payout provider is configured, executing a settlement creates a real
    // sandbox payout and records the provider transaction id before moving to
    // EXECUTING. PontisGlobe takes precedence, then RemitQuickly; otherwise we
    // fall back to the plain lifecycle transition.
    if (status === SettlementStatus.EXECUTING && isPontisEnabled()) {
      const result = await executePontisSettlement(settlementId, user.id, organization.id);
      // The provider may already report a final outcome on submit (e.g. the
      // sandbox completed trigger), in which case the settlement is already SETTLED.
      if (result.resolution?.status) finalStatus = result.resolution.status;
    } else if (status === SettlementStatus.EXECUTING && isRemitQuicklyConfigured()) {
      await executeApprovedSettlement(settlementId, user.id, organization.id);
    } else {
      await transitionSettlement(settlementId, status, user.id, organization.id, "Updated from dashboard.");
    }
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  if (finalStatus === SettlementStatus.FAILED) {
    revalidateSettlementsPage();
    redirect(`/settlements?error=${encodeURIComponent("PontisGlobe reported the payout failed.")}`);
  }
  revalidateSettlementsPage();
  redirect(`/settlements?success=${finalStatus.toLowerCase()}`);
}

async function runAutoMatch(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const settlementId = String(formData.get("settlementId") ?? "");
  try {
    await autoMatchReconciliation(user.id, organization.id);
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  if (settlementId) {
    const settlement = await prisma.settlement.findFirst({
      where: { id: settlementId, organizationId: organization.id },
    });
    if (settlement?.status === SettlementStatus.RECONCILED) {
      revalidateSettlementsPage();
      redirect("/settlements?success=reconciled");
    }
    if (settlement?.status === SettlementStatus.SETTLED) {
      revalidateSettlementsPage();
      redirect(`/settlements?reconcileRequired=${settlementId}`);
    }
  }
  revalidateSettlementsPage();
  redirect("/settlements");
}

async function generateAndReconcile(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const settlementId = String(formData.get("settlementId") ?? "");

  // P0 guard: this helper FABRICATES an independent bank record. It must never
  // run against SHADOW/LIVE_TEST settlements — real cases require a real
  // bank/PSP record via the Reconciliation page.
  const target = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId: organization.id },
    select: { testMode: true },
  });
  if (!target || target.testMode !== "DEMO") {
    redirect(
      `/settlements?reconcileRequired=${settlementId}&error=${encodeURIComponent(
        "Demo reconciliation is only available in DEMO mode.",
      )}`,
    );
  }

  try {
    await generateSettlementBankRecordAndReconcile(settlementId, user.id, organization.id);
  } catch (error) {
    redirect(
      `/settlements?reconcileRequired=${settlementId}&error=${encodeURIComponent(friendlyErrorMessage(error))}`,
    );
  }
  revalidateSettlementsPage();
  redirect("/settlements?success=reconciled");
}

async function checkStatus(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const settlementId = String(formData.get("settlementId"));
  let result: Awaited<ReturnType<typeof checkPontisPayoutStatus>>;
  try {
    result = await checkPontisPayoutStatus(settlementId, user.id, organization.id);
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  if (result.outcome === "success") {
    revalidateSettlementsPage();
    redirect("/settlements?success=settled");
  }
  if (result.outcome === "failed") {
    revalidateSettlementsPage();
    redirect(`/settlements?error=${encodeURIComponent(`PontisGlobe payout failed (${result.status ?? "failed"}).`)}`);
  }
  revalidateSettlementsPage();
  redirect("/settlements?success=checked");
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    error?: string;
    success?: string;
    q?: string;
    status?: string;
    reconcileRequired?: string;
    demo?: string;
  }>;
}) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const demoFocus = params.demo === "1";
  const settlementWhere = demoFocus
    ? demoSettlementWhere(organization.id)
    : { organizationId: organization.id };
  const flashMessage = pageFlashMessage(params.success);
  const justCompleted =
    params.success === "reconciled" || params.success === "matched";
  const canApprove = canApproveSettlement(membership.role);

  const [quotes, settlements, openIndependentRecords] = await Promise.all([
    prisma.quote.findMany({
      where: { organizationId: organization.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.settlement.findMany({
      where: settlementWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        events: { orderBy: { createdAt: "asc" } },
        reconciliation: true,
        providerProofs: { orderBy: { receivedAt: "desc" } },
      },
    }),
    // Display-only signal: is there anything for auto-match to work with?
    // Mirrors the auto-match engine's input filter (unlinked + independent).
    prisma.reconciliationRecord.count({
      where: {
        organizationId: organization.id,
        settlementId: null,
        status: { in: ["OPEN", "UNMATCHED"] },
        source: { in: [...INDEPENDENT_RECONCILIATION_SOURCES] },
      },
    }),
  ]);
  const hasOpenRecords = openIndependentRecords > 0;

  const query = params.q?.toLowerCase().trim() ?? "";
  const modeFilter = params.mode && ["DEMO", "SHADOW", "LIVE_TEST"].includes(params.mode) ? params.mode : null;

  // Case files: settlement + its full deterministic finality detail, computed
  // once and reused for stats, cards, evidence strips and the detail sheet.
  const caseFiles = settlements.map((settlement) => ({
    settlement,
    detail: toSettlementDetail(settlement),
  }));

  const filteredCases = caseFiles.filter(({ settlement }) => {
    const matchesSearch =
      !query ||
      settlement.publicId.toLowerCase().includes(query) ||
      settlement.reference.toLowerCase().includes(query);
    const matchesStatus = !params.status || settlement.status === params.status;
    const matchesMode = !modeFilter || settlement.testMode === modeFilter;
    return matchesSearch && matchesStatus && matchesMode;
  });

  const requested = settlements.filter((s) => s.status === SettlementStatus.REQUESTED).length;
  const inFlight = settlements.filter((s) => isInFlight(s.status)).length;
  const reconciledCount = settlements.filter((s) => s.status === SettlementStatus.RECONCILED).length;
  const finalityReadyCount = caseFiles.filter(({ detail }) => detail.finality.decision === "ready_to_finalize").length;
  const needsReviewCount = caseFiles.filter(({ detail }) => detail.finality.decision === "needs_review").length;
  const liveTestCases = settlements.filter((s) => s.testMode === "LIVE_TEST").length;

  const modeHref = (mode: string | null) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status) sp.set("status", params.status);
    if (demoFocus) sp.set("demo", "1");
    if (mode) sp.set("mode", mode);
    const qs = sp.toString();
    return qs ? `/settlements?${qs}` : "/settlements";
  };
  const autoRefreshSettlements = settlements.some(
    (s) =>
      s.status === SettlementStatus.EXECUTING ||
      (s.provider &&
        s.providerStatus &&
        !["completed", "failed", "settled", "reconciled"].includes(s.providerStatus.toLowerCase())),
  );
  const showSandboxTest = isSandboxTestEnabled();
  const pontisConfigured = isPontisEnabled();

  return (
    <SettlementActionsProvider>
    <div className="space-y-4">
      {/* Command header: operations console band */}
      <section className="conf-hero ov-reveal p-5 sm:p-6">
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="overview-live-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-700">
                <span className="ops-pulse ops-pulse--subtle" aria-hidden="true" />
                Operations console
              </span>
              {demoFocus ? <DemoFocusBadge /> : null}
            </div>
            <h1 className="conf-hero__headline mt-3">Settlements</h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-slate-500">
              Track provider proof, reconciliation and approvals through to finality.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Requested", value: requested, tone: "text-[#9b6810]" },
              { label: "In flight", value: inFlight, tone: "text-[#0a7d86]" },
              { label: "Needs review", value: needsReviewCount, tone: needsReviewCount ? "text-[#9b6810]" : "text-slate-400" },
              { label: "Finality ready", value: finalityReadyCount, tone: "text-brand-emerald-ink" },
              { label: "Reconciled", value: reconciledCount, tone: "text-brand-emerald-ink" },
              { label: "Live test", value: liveTestCases, tone: liveTestCases ? "text-rose-600" : "text-slate-400" },
            ].map((stat) => (
              <div key={stat.label} className="scase-stat">
                <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-400">{stat.label}</p>
                <p className={cn("scase-stat__value mt-1", stat.tone)}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SettlementAutoRefresh enabled={autoRefreshSettlements} />

      {params.error && !params.reconcileRequired ? (
        <SettlementPageFlash message={params.error} tone="error" />
      ) : null}
      {flashMessage ? <SettlementPageFlash message={flashMessage} /> : null}

      {showSandboxTest ? (
        <Card>
          <CardHeader>
            <CardTitle>RemitQuickly sandbox</CardTitle>
            <CardDescription>
              Private-beta only. Runs a safe end-to-end sandbox payout (submit → simulate → status) without
              touching any settlement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RemitQuicklyTestButton />
          </CardContent>
        </Card>
      ) : null}

      {/* Control bar: search + status + mode filters */}
      <div className="ov-reveal ov-reveal-1 space-y-2">
        <Suspense fallback={null}>
          <FilterBar
            searchPlaceholder="Search ID or reference..."
            statusOptions={["REQUESTED", "APPROVED", "EXECUTING", "SETTLED", "RECONCILED"]}
          />
        </Suspense>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400">Mode</span>
          <Link href={modeHref(null)} className={cn("mode-filter", !modeFilter && "mode-filter--on")}>
            All
          </Link>
          {(["DEMO", "SHADOW", "LIVE_TEST"] as const).map((mode) => (
            <Link
              key={mode}
              href={modeHref(mode)}
              className={cn("mode-filter", modeFilter === mode && "mode-filter--on")}
            >
              {MODE_LABEL[mode]}
            </Link>
          ))}
          {justCompleted ? (
            <span className="ml-auto case-chip border-emerald-200 bg-emerald-50 text-emerald-700">+1 completed just now</span>
          ) : null}
        </div>
      </div>

      {filteredCases.length ? (
        <div className="space-y-3">
          {filteredCases.map(({ settlement, detail }) => {
            const rowAutoRefresh =
              settlement.status === SettlementStatus.EXECUTING ||
              Boolean(
                settlement.provider &&
                  settlement.providerStatus &&
                  !["completed", "failed", "settled", "reconciled"].includes(
                    settlement.providerStatus.toLowerCase(),
                  ),
              );
            const showConsole = rowShowsConsole(settlement.status);
            const rowJustUpdated = successMatchesRow(params.success, settlement.status);
            const finality = detail.finality;
            const reconBad =
              finality.reconciliation &&
              (["UNMATCHED", "EXCEPTION"].includes(finality.reconciliation.status) || !finality.reconciliation.independent);
            const reconOk =
              finality.reconciliation && finality.reconciliation.independent && finality.reconciliation.status === "MATCHED";
            const chain = [
              { name: "Provider proof", state: finality.proof ? "ok" : "pending" },
              { name: "Reconciliation", state: reconOk ? "ok" : reconBad ? "bad" : "pending" },
              { name: "Audit trail", state: finality.auditApprovalPresent ? "ok" : "pending" },
              {
                name: "Finality",
                // "Mismatch" is reserved for real evidence contradictions; an
                // in-flight settlement with no proof yet is simply not ready.
                state: finality.decision === "ready_to_finalize" ? "ok" : reconBad ? "bad" : "pending",
              },
            ] as const;
            // The blocker is the FIRST non-verified step; later steps are consequences.
            const blockerIndex = chain.findIndex((step) => step.state !== "ok");
            const operationalSummary = caseOperationalSummary(settlement.status, finality);
            const inFlightCase = (["REQUESTED", "APPROVED", "EXECUTING"] as string[]).includes(settlement.status);
            const awaitingRecon =
              (settlement.status === SettlementStatus.SETTLED || settlement.status === SettlementStatus.RECONCILED) &&
              finality.decision !== "ready_to_finalize";
            // Display-only recommendation, matched to the settlement's actual state.
            const recommendedAction =
              settlement.status === SettlementStatus.REQUESTED
                ? "Approve the settlement to continue."
                : settlement.status === SettlementStatus.EXECUTING
                  ? "Check provider status and record proof when available."
                  : awaitingRecon && settlement.status === SettlementStatus.SETTLED && !reconBad
                    ? "Match this settlement with a bank or PSP record."
                    : finality.decision === "ready_to_finalize"
                      ? "Generate the settlement report and finalize — all three evidence sources agree."
                      : finality.recommendedActions[0] ?? null;

            return (
              <article
                key={settlement.id}
                className={cn(
                  "scase",
                  `scase--${settlement.testMode in MODE_CHIP_CLASS ? settlement.testMode : "DEMO"}`,
                  finality.riskLevel === "high"
                    ? "scase--fin-risk"
                    : finality.decision === "ready_to_finalize"
                      ? "scase--fin-ready"
                      : finality.decision === "needs_review"
                        ? "scase--fin-review"
                        : undefined,
                  showConsole && "settlement-row-active",
                  rowJustUpdated && "settlement-row-highlight",
                )}
              >
                {/* Case header */}
                <div className="scase__header">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[15px] font-semibold tracking-tight text-slate-950">{settlement.publicId}</p>
                      <ModeChip testMode={settlement.testMode} />
                      <StatusBadge status={settlement.status} />
                      <span
                        className={cn(
                          "state-chip",
                          finality.decision === "ready_to_finalize" && "state-chip--ready",
                          finality.decision === "needs_review" && "state-chip--review",
                          finality.decision === "not_ready" && "state-chip--pending",
                        )}
                        title={finality.summary}
                      >
                        {finality.decision === "ready_to_finalize"
                          ? "✓ Finality ready"
                          : finality.decision === "needs_review"
                            ? "Needs review"
                            : "Finality pending"}
                      </span>
                      {finality.riskLevel === "high" ? <span className="state-chip state-chip--risk">High risk</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {settlement.reference}
                      {settlement.provider ? <span className="text-slate-400"> · {settlement.provider}</span> : null}
                      {settlement.providerTransactionId ? (
                        <span className="text-slate-400"> · tx {settlement.providerTransactionId.slice(0, 16)}</span>
                      ) : null}
                    </p>
                    <p className="scase__summary">{operationalSummary}</p>
                    <SettlementRowStatusSubtext status={settlement.status} settlementId={settlement.id} />
                  </div>
                  <div className="scase__fin">
                    <p className="scase__amount" title={formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}>
                      {formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}
                    </p>
                    <div className="scase__fin-row mt-1.5">
                      <span>Corridor</span>
                      <span className="font-medium text-slate-600">{settlement.corridor.replace("_", " → ")}</span>
                    </div>
                    <div className="scase__fin-row mt-0.5">
                      <span>{settlement.settledAt ? "Settled" : "Created"}</span>
                      <span className="font-medium tabular-nums text-slate-600">
                        {formatDateTime(settlement.settledAt ?? settlement.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evidence strip + lifecycle rail */}
                <div className="scase__body grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div className="evidence-chain evidence-chain--mini" aria-label="Evidence chain">
                    {chain.map((step, index) => {
                      const isBlocker = index === blockerIndex && step.state !== "ok";
                      const isDownstream = blockerIndex >= 0 && index > blockerIndex && step.state !== "ok";
                      return (
                        <div
                          key={step.name}
                          className={cn(
                            "evidence-chain__pillar",
                            `evidence-chain__pillar--${step.state}`,
                            isBlocker && "evidence-chain__pillar--focus",
                            isDownstream && "evidence-chain__pillar--downstream",
                          )}
                        >
                          <span className="evidence-chain__label">{step.name}</span>
                          <span className="evidence-chain__state">
                            {step.state === "ok"
                              ? step.name === "Finality"
                                ? "Ready"
                                : "Verified"
                              : step.state === "bad"
                                ? "Mismatch"
                                : step.name === "Reconciliation" && !finality.proof
                                  ? "Waiting for proof"
                                  : step.name === "Finality"
                                    ? inFlightCase
                                      ? "Not ready"
                                      : "Pending"
                                    : "Pending"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="scase__rail">
                    <SettlementLifecycle status={settlement.status} />
                  </div>
                </div>

                {recommendedAction ? (
                  <div className={cn("scase__next", finality.decision === "ready_to_finalize" && "scase__next--ready")}>
                    <span className="text-[10px] font-bold uppercase tracking-[0.07em]">
                      {finality.decision === "ready_to_finalize" ? "Ready" : "Next"}
                    </span>
                    <span>
                      <strong className="font-semibold">Recommended action:</strong> {recommendedAction}
                    </span>
                  </div>
                ) : null}

                {/* Case actions */}
                <div className="scase__actions">
                  {canApprove && hasWorkflowAction(settlement.status) ? (
                    <SettlementActionForm
                      settlementId={settlement.id}
                      action={
                        settlement.status === SettlementStatus.REQUESTED
                          ? "approve"
                          : settlement.status === SettlementStatus.APPROVED
                            ? "execute"
                            : "settle"
                      }
                      serverAction={transition}
                      className="flex flex-wrap gap-1.5"
                    >
                      <input type="hidden" name="settlementId" value={settlement.id} />
                      {settlement.status === SettlementStatus.REQUESTED ? (
                        <SubmitButton
                          name="status"
                          value="APPROVED"
                          variant="primary"
                          size="sm"
                          pendingText="Approving..."
                          settlementId={settlement.id}
                          action="approve"
                        >
                          Approve settlement
                        </SubmitButton>
                      ) : null}
                      {settlement.status === SettlementStatus.APPROVED ? (
                        <SubmitButton
                          name="status"
                          value="EXECUTING"
                          variant="primary"
                          size="sm"
                          pendingText="Executing..."
                          settlementId={settlement.id}
                          action="execute"
                        >
                          {pontisConfigured ? "Execute via PontisGlobe" : "Execute"}
                        </SubmitButton>
                      ) : null}
                      {settlement.status === SettlementStatus.EXECUTING && !(pontisConfigured && settlement.provider) ? (
                        <SubmitButton
                          name="status"
                          value="SETTLED"
                          variant="primary"
                          size="sm"
                          pendingText="Settling..."
                          settlementId={settlement.id}
                          action="settle"
                        >
                          Settle
                        </SubmitButton>
                      ) : null}
                    </SettlementActionForm>
                  ) : !canApprove ? (
                    <span className="case-chip case-chip--demo">Read-only role</span>
                  ) : null}
                  {/* Reconciliation actions live in ONE place: the embedded console
                      panel below renders them whenever this settlement is SETTLED
                      with no linked record. This top-row fallback only appears when
                      that panel is absent (a record is already linked but finality
                      is not ready), so the actions are never duplicated. */}
                  {awaitingRecon &&
                  settlement.status === SettlementStatus.SETTLED &&
                  settlement.reconciliation.length > 0 ? (
                    <>
                      <Button asChild variant="primary" size="sm">
                        <Link href={`/reconciliation${demoFocus ? "?demo=1" : ""}`}>Open reconciliation</Link>
                      </Button>
                      {canApprove && hasOpenRecords ? (
                        <form action={runAutoMatch}>
                          <input type="hidden" name="settlementId" value={settlement.id} />
                          <SubmitButton variant="outline" size="sm" pendingText="Matching...">
                            Run auto-match
                          </SubmitButton>
                        </form>
                      ) : null}
                    </>
                  ) : null}
                  {settlement.status === SettlementStatus.RECONCILED && finality.decision === "ready_to_finalize" ? (
                    <Button asChild variant="primary" size="sm">
                      <Link href={`/settlements/${settlement.id}/report`}>Generate report</Link>
                    </Button>
                  ) : null}
                  {canApprove &&
                  settlement.status === SettlementStatus.EXECUTING &&
                  pontisConfigured &&
                  settlement.provider ? (
                    <SettlementActionForm settlementId={settlement.id} action="check" serverAction={checkStatus}>
                      <input type="hidden" name="settlementId" value={settlement.id} />
                      <SubmitButton
                        type="submit"
                        variant="primary"
                        size="sm"
                        pendingText="Checking..."
                        settlementId={settlement.id}
                        action="check"
                      >
                        Check provider status
                      </SubmitButton>
                    </SettlementActionForm>
                  ) : null}

                  <span className="scase__actions-spacer" aria-hidden="true" />

                  <SettlementDetailSheet
                    key={`${settlement.id}-${settlement.status}-${settlement.providerTransactionId ?? ""}-${settlement.events.length}`}
                    settlement={detail}
                    triggerLabel={isCompleted(settlement.status) ? "View proof" : "Case details"}
                  />
                  {settlement.status === SettlementStatus.RECONCILED ? (
                    <SettlementDetailSheet
                      key={`${settlement.id}-audit-${settlement.events.length}`}
                      settlement={detail}
                      defaultTab="audit"
                      triggerLabel="Audit trail"
                    />
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/settlements/${settlement.id}/report`}>Report</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/settlements/${settlement.id}/shadow`}>
                      {settlement.testMode === "LIVE_TEST" ? "Live pilot" : "Shadow"}
                    </Link>
                  </Button>
                </div>

                {/* Embedded case console (provider tracking / reconcile) */}
                {showConsole ? (
                  <div className="scase__console">
                    <SettlementOperationConsoleRow
                      asCard
                      settlementId={settlement.id}
                      settlement={toOperationConsoleData(settlement)}
                      autoRefresh={rowAutoRefresh}
                      canReconcile={canApprove}
                      autoMatchAction={runAutoMatch}
                      hasOpenRecords={hasOpenRecords}
                      generateReconcileAction={settlement.testMode === "DEMO" ? generateAndReconcile : undefined}
                      reconcileRequired={params.reconcileRequired === settlement.id}
                      inlineError={params.reconcileRequired === settlement.id ? params.error : undefined}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-compact ops-panel">
          <span className="empty-compact__icon">
            <Landmark className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-slate-900">No settlement cases match</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {modeFilter
                ? `No ${MODE_LABEL[modeFilter as keyof typeof MODE_LABEL]} settlements. Set mode from a settlement's Shadow console.`
                : "Create a settlement from an active quote, or adjust search and filters."}
            </p>
          </div>
          <Link
            href="/quotes"
            className="shrink-0 rounded-lg border border-[var(--ops-line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-ops-xs transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            View quotes
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create settlement</CardTitle>
          <CardDescription>Only ACTIVE, unexpired quotes appear. The quote becomes ACCEPTED after creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettlementActionForm
            settlementId="__create__"
            action="create"
            serverAction={submitSettlement}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"
          >
            <Field label="Quote" hint="Only ACTIVE, unexpired quotes appear." required className="lg:col-span-2">
              <FormSelect
                name="quoteId"
                placeholder="Select quote"
                required
                disabled={quotes.length === 0}
                options={
                  quotes.length
                    ? quotes.map((quote) => ({
                        value: quote.id,
                        label: `${quote.corridor.replace("_", " → ")} · ${formatCurrencyCompact(String(quote.sourceAmount), quote.sourceCurrency)}`,
                      }))
                    : [{ value: "_none", label: "No active quotes" }]
                }
              />
            </Field>
            <Field label="Reference" htmlFor="reference" hint="Your internal batch identifier." required>
              <Input id="reference" name="reference" placeholder="psp_batch_1842" required />
            </Field>
            <Field label="Source account" htmlFor="sourceAccount" hint="Account to debit." required>
              <Input id="sourceAccount" name="sourceAccount" required />
            </Field>
            <Field label="Target account" htmlFor="targetAccount" hint="Account to credit." required>
              <Input id="targetAccount" name="targetAccount" required />
            </Field>
            <div className="flex items-end md:col-span-2 lg:col-span-5">
              <SubmitButton
                type="submit"
                variant="primary"
                disabled={quotes.length === 0}
                pendingText="Creating..."
                settlementId="__create__"
                action="create"
              >
                Create settlement
              </SubmitButton>
            </div>
          </SettlementActionForm>
        </CardContent>
      </Card>
    </div>
    </SettlementActionsProvider>
  );
}
