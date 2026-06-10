import { Fragment, Suspense } from "react";
import Link from "next/link";
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
import { RECONCILIATION_SOURCE_LABEL, isIndependentReconciliationSource } from "@/lib/reconciliation";
import { MODE_LABEL, getShadowConfig, safetyFor, type SettlementMode } from "@/lib/shadow-mode";
import { canApproveSettlement } from "@/lib/permissions";
import { counterpartyForCorridor } from "@/lib/treasury";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrencyCompact, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { SettlementRowFlightOverlay, type StatusFlightStatus } from "@/components/ui/status-flight";
import { EmptyState } from "@/components/ops/empty-state";
import { FilterBar } from "@/components/ops/filter-bar";
import { FormSelect } from "@/components/ops/form-select";
import { SettlementLifecycle } from "@/components/ops/settlement-lifecycle";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";
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

function settlementStatusFlight(status: SettlementStatus): StatusFlightStatus | null {
  switch (status) {
    case SettlementStatus.SETTLED:
      return "settled";
    case SettlementStatus.RECONCILED:
      return "reconciled";
    case SettlementStatus.FAILED:
      return "failed";
    default:
      return null;
  }
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

function demoSettlementWhere(organizationId: string) {
  return {
    organizationId,
    OR: [{ publicId: { startsWith: "SET-DEMO" } }, { reference: { startsWith: "DEMO-" } }],
  };
}

const MODE_CHIP_CLASS: Record<SettlementMode, string> = {
  DEMO: "border-slate-200 bg-slate-50 text-slate-500",
  SHADOW: "border-indigo-200 bg-indigo-50 text-indigo-700",
  LIVE_TEST: "border-red-200 bg-red-50 text-red-700",
};

function ModeChip({ mode }: { mode: string }) {
  const key = (mode in MODE_CHIP_CLASS ? mode : "DEMO") as SettlementMode;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]",
        MODE_CHIP_CLASS[key],
      )}
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

  const [quotes, settlements] = await Promise.all([
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
  ]);

  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredSettlements = settlements.filter((settlement) => {
    const matchesSearch =
      !query ||
      settlement.publicId.toLowerCase().includes(query) ||
      settlement.reference.toLowerCase().includes(query);
    const matchesStatus = !params.status || settlement.status === params.status;
    return matchesSearch && matchesStatus;
  });

  const requested = settlements.filter((s) => s.status === SettlementStatus.REQUESTED).length;
  const inFlight = settlements.filter((s) => isInFlight(s.status)).length;
  const settled = settlements.filter((s) => isCompleted(s.status)).length;
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
      <PageHeader
        title="Settlements"
        className="gap-3"
        actions={demoFocus ? <DemoFocusBadge /> : undefined}
      />

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

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Requested" value={requested} hint="Awaiting approval" tone="warning" />
        <MetricCard label="In flight" value={inFlight} hint="Approved or executing" tone="info" />
        <MetricCard
          label="Completed"
          value={settled}
          hint={justCompleted ? "Settled or reconciled · +1 just now" : "Settled or reconciled"}
          tone="success"
        />
      </div>

      <Suspense fallback={null}>
        <FilterBar
          searchPlaceholder="Search ID or reference..."
          statusOptions={["REQUESTED", "APPROVED", "EXECUTING", "SETTLED", "RECONCILED"]}
        />
      </Suspense>

      {filteredSettlements.length ? (
        <DataGrid>
          <table className="w-full min-w-[960px]">
            <DataGridHead>
              <DataGridTh>Settlement</DataGridTh>
              <DataGridTh>Amount</DataGridTh>
              <DataGridTh>Status</DataGridTh>
              <DataGridTh>Lifecycle</DataGridTh>
              <DataGridTh className="text-right">Actions</DataGridTh>
            </DataGridHead>
            <DataGridBody>
              {filteredSettlements.map((settlement) => {
                const rowAutoRefresh =
                  settlement.status === SettlementStatus.EXECUTING ||
                  Boolean(
                    settlement.provider &&
                      settlement.providerStatus &&
                      !["completed", "failed", "settled", "reconciled"].includes(
                        settlement.providerStatus.toLowerCase(),
                      ),
                  );
                const settlementDetail = toSettlementDetail(settlement);

                const showConsole = rowShowsConsole(settlement.status);
                const rowJustUpdated = successMatchesRow(params.success, settlement.status);
                const statusFlight = settlementStatusFlight(settlement.status);

                return (
                <Fragment key={settlement.id}>
                <DataGridRow
                  className={cn(
                    "relative isolate overflow-hidden",
                    showConsole && "settlement-row-active",
                    rowJustUpdated && "settlement-row-highlight",
                  )}
                >
                  {statusFlight && rowJustUpdated ? (
                    <SettlementRowFlightOverlay status={statusFlight} />
                  ) : null}
                  <DataGridTd>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-slate-950">{settlement.publicId}</p>
                      <ModeChip mode={settlement.mode} />
                    </div>
                    <p className="text-xs text-slate-500">{settlement.reference}</p>
                    <SettlementRowStatusSubtext
                      status={settlement.status}
                      settlementId={settlement.id}
                    />
                  </DataGridTd>
                  <DataGridTd
                    className="whitespace-nowrap tabular-nums"
                    title={formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}
                  >
                    {formatCurrencyFull(String(settlement.sourceAmount), settlement.sourceCurrency)}
                  </DataGridTd>
                  <DataGridTd>
                    <StatusBadge status={settlement.status} />
                  </DataGridTd>
                  <DataGridTd className="min-w-[240px]">
                    <SettlementLifecycle status={settlement.status} compact />
                  </DataGridTd>
                  <DataGridTd>
                    <div className="flex flex-wrap items-center justify-end gap-2">
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
                          className="flex flex-wrap gap-1"
                        >
                          <input type="hidden" name="settlementId" value={settlement.id} />
                          {settlement.status === SettlementStatus.REQUESTED ? (
                            <SubmitButton
                              name="status"
                              value="APPROVED"
                              variant="outline"
                              size="sm"
                              pendingText="Approving..."
                              settlementId={settlement.id}
                              action="approve"
                            >
                              Approve
                            </SubmitButton>
                          ) : null}
                          {settlement.status === SettlementStatus.APPROVED ? (
                            <SubmitButton
                              name="status"
                              value="EXECUTING"
                              variant="outline"
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
                              variant="outline"
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
                        <span className="text-xs text-slate-400">Read only</span>
                      ) : null}
                      {canApprove &&
                      settlement.status === SettlementStatus.EXECUTING &&
                      pontisConfigured &&
                      settlement.provider ? (
                        <SettlementActionForm
                          settlementId={settlement.id}
                          action="check"
                          serverAction={checkStatus}
                        >
                          <input type="hidden" name="settlementId" value={settlement.id} />
                          <SubmitButton
                            type="submit"
                            variant="outline"
                            size="sm"
                            pendingText="Checking..."
                            settlementId={settlement.id}
                            action="check"
                          >
                            Check status
                          </SubmitButton>
                        </SettlementActionForm>
                      ) : null}
                      <SettlementDetailSheet
                        key={`${settlement.id}-${settlement.status}-${settlement.providerTransactionId ?? ""}-${settlement.events.length}`}
                        settlement={settlementDetail}
                        triggerLabel={
                          isCompleted(settlement.status) ? "View proof" : "Details"
                        }
                      />
                      {settlement.status === SettlementStatus.RECONCILED ? (
                        <SettlementDetailSheet
                          key={`${settlement.id}-audit-${settlement.events.length}`}
                          settlement={settlementDetail}
                          defaultTab="audit"
                          triggerLabel="Audit trail"
                        />
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/settlements/${settlement.id}/report`}>Report</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/settlements/${settlement.id}/shadow`}>Shadow</Link>
                      </Button>
                    </div>
                  </DataGridTd>
                </DataGridRow>
                <SettlementOperationConsoleRow
                  settlementId={settlement.id}
                  settlement={toOperationConsoleData(settlement)}
                  autoRefresh={rowAutoRefresh}
                  canReconcile={canApprove}
                  autoMatchAction={runAutoMatch}
                  generateReconcileAction={generateAndReconcile}
                  reconcileRequired={params.reconcileRequired === settlement.id}
                  inlineError={
                    params.reconcileRequired === settlement.id ? params.error : undefined
                  }
                />
                </Fragment>
                );
              })}
            </DataGridBody>
          </table>
        </DataGrid>
      ) : (
        <EmptyState
          title="No settlements match"
          description="Create from an active quote or adjust filters."
          action={{ label: "View quotes", href: "/quotes" }}
        />
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
