import { Suspense } from "react";
import { SettlementStatus } from "@prisma/client";
import { redirect } from "next/navigation";
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
import { FlashMessage } from "@/components/ops/flash-message";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/helper-text";
import { SubmitButton } from "@/components/ui/submit-button";

function successMessage(value?: string) {
  if (value === "created") return "Settlement created and quote marked as accepted.";
  if (value === "approved") return "Settlement approved.";
  if (value === "executing") return "Settlement moved to executing.";
  if (value === "settled") return "Settlement marked as settled.";
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
  redirect("/settlements?success=created");
}

async function transition(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const status = String(formData.get("status")) as SettlementStatus;
  try {
    await transitionSettlement(
      String(formData.get("settlementId")),
      status,
      user.id,
      organization.id,
      "Updated from dashboard.",
    );
  } catch (error) {
    redirect(`/settlements?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect(`/settlements?success=${status.toLowerCase()}`);
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const message = successMessage(params.success);
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

  return (
    <div className="space-y-6">
      <PageHeader title="Settlements" description="Operate the full settlement lifecycle from request through reconciliation." />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {message ? <FlashMessage message={message} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Requested" value={requested} hint="Awaiting approval" tone="warning" />
        <MetricCard label="In flight" value={inFlight} hint="Approved or executing" tone="info" />
        <MetricCard label="Completed" value={settled} hint="Settled or reconciled" tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create settlement</CardTitle>
          <CardDescription>Only ACTIVE, unexpired quotes appear. The quote becomes ACCEPTED after creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitSettlement} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
              <SubmitButton type="submit" variant="primary" disabled={quotes.length === 0} pendingText="Creating...">
                Create settlement
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

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
              {filteredSettlements.map((settlement) => (
                <DataGridRow key={settlement.id}>
                  <DataGridTd>
                    <p className="font-medium text-slate-950">{settlement.publicId}</p>
                    <p className="text-xs text-slate-500">{settlement.reference}</p>
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
                        <form action={transition} className="flex flex-wrap gap-1">
                          <input type="hidden" name="settlementId" value={settlement.id} />
                          {settlement.status === SettlementStatus.REQUESTED ? (
                            <SubmitButton name="status" value="APPROVED" variant="outline" size="sm" pendingText="...">
                              Approve
                            </SubmitButton>
                          ) : null}
                          {settlement.status === SettlementStatus.APPROVED ? (
                            <SubmitButton name="status" value="EXECUTING" variant="outline" size="sm" pendingText="...">
                              Execute
                            </SubmitButton>
                          ) : null}
                          {settlement.status === SettlementStatus.EXECUTING ? (
                            <SubmitButton name="status" value="SETTLED" variant="outline" size="sm" pendingText="...">
                              Settle
                            </SubmitButton>
                          ) : null}
                          {!hasWorkflowAction(settlement.status) ? <span className="text-xs text-slate-400">—</span> : null}
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">Read only</span>
                      )}
                      <SettlementDetailSheet
                        settlement={{
                          publicId: settlement.publicId,
                          reference: settlement.reference,
                          corridor: settlement.corridor.replace("_", " → "),
                          status: settlement.status,
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
              ))}
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
    </div>
  );
}
