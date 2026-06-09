import { Fragment, Suspense } from "react";
import { SettlementStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSettlement, transitionSettlement } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { canApproveSettlement } from "@/lib/permissions";
import { counterpartyForCorridor } from "@/lib/treasury";
import { prisma } from "@/lib/prisma";
import { formatCurrencyCompact, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { StatusBadge } from "@/components/ops/status-badge";
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
import { SettlementDetailSheet } from "@/components/dashboard/settlement-detail-sheet";
import {
  SettlementOperationConsoleRow,
  SettlementPageFlash,
  type SettlementOperationConsoleData,
} from "@/components/dashboard/settlement-operation-console";
import {
  SettlementActionForm,
  SettlementActionsProvider,
  SettlementAutoRefresh,
  SettlementRowStatusHint,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/helper-text";
import { SubmitButton } from "@/components/ui/submit-button";

function pageFlashMessage(value?: string) {
  if (value === "created") return "Settlement created.";
  return null;
}

function pickHighlightSettlementId(
  settlements: Array<{ id: string; status: SettlementStatus }>,
  success?: string,
) {
  if (success === "settled") {
    return settlements.find(
      (s) => s.status === SettlementStatus.SETTLED || s.status === SettlementStatus.RECONCILED,
    )?.id;
  }
  if (success === "approved") {
    return settlements.find((s) => s.status === SettlementStatus.APPROVED)?.id;
  }
  if (success === "executing" || success === "checked") {
    return settlements.find((s) => s.status === SettlementStatus.EXECUTING)?.id;
  }
  return undefined;
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

function toOperationConsoleData(settlement: {
  status: SettlementStatus;
  corridor: string;
  sourceAmount: unknown;
  sourceCurrency: string;
  provider: string | null;
  providerStatus: string | null;
  providerTransactionId: string | null;
  events: unknown[];
  reconciliation: unknown[];
}): SettlementOperationConsoleData {
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
  searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const flashMessage = pageFlashMessage(params.success);
  const canApprove = canApproveSettlement(membership.role);

  const [quotes, settlements] = await Promise.all([
    prisma.quote.findMany({
      where: { organizationId: organization.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.settlement.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        events: { orderBy: { createdAt: "asc" } },
        reconciliation: true,
      },
    }),
  ]);

  const highlightSettlementId = pickHighlightSettlementId(settlements, params.success);

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
    <div className="space-y-6">
      <PageHeader title="Settlements" description="Operate the full settlement lifecycle from request through reconciliation." />

      <SettlementAutoRefresh enabled={autoRefreshSettlements} />

      {params.error ? <SettlementPageFlash message={params.error} tone="error" /> : null}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Requested" value={requested} hint="Awaiting approval" tone="warning" />
        <MetricCard label="In flight" value={inFlight} hint="Approved or executing" tone="info" />
        <MetricCard label="Completed" value={settled} hint="Settled or reconciled" tone="success" />
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

                return (
                <Fragment key={settlement.id}>
                <DataGridRow>
                  <DataGridTd>
                    <p className="font-medium text-slate-950">{settlement.publicId}</p>
                    <p className="text-xs text-slate-500">{settlement.reference}</p>
                    <SettlementRowStatusHint status={settlement.status} settlementId={settlement.id} />
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
                      {canApprove ? (
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
                          {!hasWorkflowAction(settlement.status) ? <span className="text-xs text-slate-400">—</span> : null}
                        </SettlementActionForm>
                      ) : (
                        <span className="text-xs text-slate-400">Read only</span>
                      )}
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
                        settlement={{
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
                          counterparty: (() => {
                            const cp = counterpartyForCorridor(settlement.corridor);
                            return { name: cp.name, type: cp.type, country: cp.country };
                          })(),
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
                        }}
                      />
                    </div>
                  </DataGridTd>
                </DataGridRow>
                <SettlementOperationConsoleRow
                  settlementId={settlement.id}
                  settlement={toOperationConsoleData(settlement)}
                  autoRefresh={rowAutoRefresh}
                  highlightCompleted={highlightSettlementId === settlement.id}
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
