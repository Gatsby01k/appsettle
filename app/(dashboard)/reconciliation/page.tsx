import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  autoMatchReconciliation,
  bestSettlementMatch,
  confirmReconciliationMatch,
  createExceptionDemoRecord,
  createMatchingDemoRecord,
  createReconciliationRecord,
  matchOriginOf,
  rejectReconciliationSuggestion,
  rejectedSettlementIdsOf,
  resolveReconciliationException,
} from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import {
  SUGGESTED_MIN_CONFIDENCE,
  computeConfidence,
  matchReasonFor,
  matchTypeFor,
  MATCH_LABEL,
} from "@/lib/reconciliation";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrencyFull, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { FlashMessage } from "@/components/ops/flash-message";
import { FilterBar } from "@/components/ops/filter-bar";
import { AddRecordForm } from "@/components/dashboard/add-record-form";
import { ReconciliationCommandBar } from "@/components/dashboard/reconciliation-command-bar";
import { ReconciliationWorkspace } from "@/components/dashboard/reconciliation-workspace";
import { SubmitButton } from "@/components/ui/submit-button";

async function submitRecord(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  const settlementRaw = String(formData.get("settlementId") || "");
  const exceptionReason = String(formData.get("exceptionReason") || "").trim() || undefined;
  const hasManualSettlement = Boolean(settlementRaw) && settlementRaw !== "_none";

  // Status is derived, never picked from a free dropdown: an exception reason flags
  // an EXCEPTION; an explicitly selected settlement is a MANUAL match (reconciles);
  // otherwise the record is simply captured as OPEN for the auto-match engine.
  const status = exceptionReason ? "EXCEPTION" : hasManualSettlement ? "MATCHED" : "OPEN";
  const settlementId = status === "MATCHED" ? settlementRaw : undefined;

  let isManualMatch = false;
  try {
    await createReconciliationRecord(
      {
        externalRef: String(formData.get("externalRef") ?? ""),
        source: String(formData.get("source") ?? ""),
        amount: formData.get("amount"),
        currency: String(formData.get("currency") ?? ""),
        settlementId,
        valueDate: String(formData.get("valueDate") ?? ""),
        status,
        exceptionReason,
      },
      user.id,
      organization.id,
    );
    isManualMatch = status === "MATCHED";
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect(`/reconciliation?success=${isManualMatch ? "manual" : "created"}`);
}

async function runAutoMatch() {
  "use server";
  const { user, organization } = await requireSession();
  let result = { matched: 0, scanned: 0 };
  try {
    result = await autoMatchReconciliation(user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect(`/reconciliation?success=automatch&matched=${result.matched}&scanned=${result.scanned}`);
}

async function createMatchingBankRecord() {
  "use server";
  const { user, organization } = await requireSession();
  try {
    await createMatchingDemoRecord("bank_statement", user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=demo_match");
}

async function createMatchingChainRecord() {
  "use server";
  const { user, organization } = await requireSession();
  try {
    await createMatchingDemoRecord("chain_tx", user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=demo_match");
}

async function createExceptionRecord() {
  "use server";
  const { user, organization } = await requireSession();
  try {
    await createExceptionDemoRecord(user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=demo_exception");
}

async function confirmMatch(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  const recordId = String(formData.get("recordId") || "");
  const settlementId = String(formData.get("settlementId") || "");
  try {
    await confirmReconciliationMatch(recordId, settlementId, user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=confirmed");
}

async function rejectSuggestion(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  const recordId = String(formData.get("recordId") || "");
  const settlementId = String(formData.get("settlementId") || "");
  try {
    await rejectReconciliationSuggestion(recordId, settlementId, user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=rejected");
}

async function resolveException(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  const recordId = String(formData.get("recordId") || "");
  try {
    await resolveReconciliationException(recordId, user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=resolved");
}

function demoSettlementWhere(organizationId: string) {
  return {
    organizationId,
    OR: [{ publicId: { startsWith: "SET-DEMO" } }, { reference: { startsWith: "DEMO-" } }],
  };
}

function demoReconciliationWhere(organizationId: string) {
  return {
    organizationId,
    OR: [
      { externalRef: { startsWith: "DEMO-" } },
      { settlement: { publicId: { startsWith: "SET-DEMO" } } },
    ],
  };
}

function DemoFocusBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-800">
      Demo focus mode
    </span>
  );
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string; matched?: string; scanned?: string; demo?: string }>;
}) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const demoFocus = params.demo === "1";
  const settlementWhere = demoFocus
    ? demoSettlementWhere(organization.id)
    : { organizationId: organization.id };

  // Auto-match is an explicit operator action (the "Run auto-match" button), never a
  // side effect of opening the page or saving a record. Saving an external record
  // leaves it OPEN until the engine or an operator reconciles it.

  const [records, settlements, settledCandidates] = await Promise.all([
    prisma.reconciliationRecord.findMany({
      where: demoFocus ? demoReconciliationWhere(organization.id) : { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { settlement: true },
    }),
    prisma.settlement.findMany({
      where: settlementWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.settlement.findMany({
      where: { ...settlementWhere, status: "SETTLED" },
      orderBy: { settledAt: "desc" },
    }),
  ]);

  // Best open settlement candidate for an unlinked record (excludes rejected ones).
  const suggestionFor = (record: (typeof records)[number]) => {
    if (record.settlement || record.status === "EXCEPTION" || record.status === "RESOLVED") return null;
    const best = bestSettlementMatch(record, settledCandidates, {
      excludeSettlementIds: new Set(rejectedSettlementIdsOf(record.rawPayload)),
      minConfidence: SUGGESTED_MIN_CONFIDENCE,
    });
    if (!best) return null;
    return {
      settlementId: best.settlement.id,
      publicId: best.settlement.publicId,
      reference: best.settlement.reference,
      confidence: best.confidence,
      reason: matchReasonFor(best.confidence, record.currency),
    };
  };

  const confidenceFor = (record: (typeof records)[number]) => {
    if (record.settlement) {
      return computeConfidence(Number(record.amount), record.currency, record.valueDate, {
        sourceCurrency: record.settlement.sourceCurrency,
        targetCurrency: record.settlement.targetCurrency,
        sourceAmount: Number(record.settlement.sourceAmount),
        targetAmount: Number(record.settlement.targetAmount),
        refDate: record.settlement.settledAt ?? record.settlement.createdAt,
      });
    }
    return suggestionFor(record)?.confidence ?? 0;
  };

  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      !query ||
      record.externalRef.toLowerCase().includes(query) ||
      record.source.toLowerCase().includes(query) ||
      record.settlement?.reference.toLowerCase().includes(query);
    const matchesStatus = !params.status || record.status === params.status;
    return matchesSearch && matchesStatus;
  });

  const matchedCount = records.filter((r) => Boolean(r.settlement) && r.status === "MATCHED").length;
  const manualReview = records.filter(
    (r) => !r.settlement && r.status !== "EXCEPTION" && r.status !== "RESOLVED",
  ).length;
  const suggestedCount = records.filter((r) => !r.settlement && r.status !== "EXCEPTION" && suggestionFor(r)).length;
  const exceptions = records.filter((r) => r.status === "EXCEPTION").length;
  const matchRate = records.length ? Math.round((matchedCount / records.length) * 100) : 0;
  const metricsRefresh = Boolean(params.success);

  const workspaceRows = filteredRecords.map((record) => {
    const confidence = confidenceFor(record);
    const origin = matchOriginOf(record.rawPayload);
    const matchType = matchTypeFor(record.status, confidence, Boolean(record.settlement), origin);
    const suggestion = suggestionFor(record);
    const matchReason = record.settlement
      ? matchReasonFor(confidence, record.currency)
      : suggestion?.reason ?? null;
    return {
      id: record.id,
      externalRef: record.externalRef,
      source: record.source,
      amount: formatCurrencyFull(String(record.amount), record.currency),
      currency: record.currency,
      status: record.status,
      matchType,
      matchLabel: MATCH_LABEL[matchType],
      matchReason,
      confidence,
      exceptionReason: record.exceptionReason,
      valueDate: record.valueDate.toLocaleDateString(),
      settlement: record.settlement
        ? { publicId: record.settlement.publicId, reference: record.settlement.reference }
        : null,
      suggestion: suggestion
        ? {
            settlementId: suggestion.settlementId,
            publicId: suggestion.publicId,
            reference: suggestion.reference,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          }
        : null,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reconciliation"
        className="gap-3"
        actions={demoFocus ? <DemoFocusBadge /> : undefined}
      />

      {/* Independence rule, stated where matching happens */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="case-chip border-emerald-200 bg-emerald-50 text-emerald-700">Independent evidence</span>
        <span className="case-chip case-chip--gold">Provider claims excluded</span>
      </div>

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? (
        <FlashMessage message="Record saved as OPEN. Run auto-match to reconcile." />
      ) : null}
      {params.success === "manual" ? (
        <FlashMessage message="Manual match confirmed — record linked and settlement reconciled." />
      ) : null}
      {params.success === "confirmed" ? (
        <FlashMessage message="Match confirmed — settlement reconciled." />
      ) : null}
      {params.success === "rejected" ? (
        <FlashMessage message="Suggestion rejected — record kept in manual review." />
      ) : null}
      {params.success === "resolved" ? (
        <FlashMessage message="Exception resolved — marked reviewed and cleared from the exceptions queue." />
      ) : null}
      {params.success === "automatch" ? (
        <FlashMessage
          message={`Auto-match complete — ${params.matched ?? 0} of ${params.scanned ?? 0} open records matched and reconciled.`}
        />
      ) : null}
      {params.success === "demo_match" ? (
        <FlashMessage message="Matching external record created. Run auto-match to reconcile." />
      ) : null}
      {params.success === "demo_exception" ? (
        <FlashMessage message="Exception record created — sent to the operations queue for manual review." />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cn("reconciliation-metric-enter", metricsRefresh && "reconciliation-metric-value-pulse")}>
          <MetricCard label="Matched" value={matchedCount} hint="Linked & reconciled" tone="success" />
        </div>
        <div
          className={cn(
            "reconciliation-metric-enter reconciliation-metric-enter-delay-1",
            metricsRefresh && "reconciliation-metric-value-pulse",
          )}
        >
          <MetricCard
            label="Manual review"
            value={manualReview}
            hint={`${suggestedCount} with suggestions`}
            tone={manualReview ? "warning" : "neutral"}
          />
        </div>
        <div
          className={cn(
            "reconciliation-metric-enter reconciliation-metric-enter-delay-2",
            metricsRefresh && "reconciliation-metric-value-pulse",
          )}
        >
          <MetricCard label="Exceptions" value={exceptions} hint="Operations queue" tone={exceptions ? "danger" : "neutral"} />
        </div>
        <div
          className={cn(
            "reconciliation-metric-enter reconciliation-metric-enter-delay-3",
            metricsRefresh && "reconciliation-metric-value-pulse",
          )}
        >
          <MetricCard
            label="Match rate"
            value={formatPercent(matchRate)}
            hint="Reconciled records"
            tone="info"
          />
        </div>
      </div>

      <ReconciliationCommandBar
        addRecordForm={
          <AddRecordForm
            action={submitRecord}
            compact
            settlements={settlements.map((s) => ({ value: s.id, label: `${s.publicId} · ${s.reference}` }))}
          />
        }
        autoMatchForm={
          <form action={runAutoMatch}>
            <SubmitButton variant="primary" size="sm" pendingText="Matching...">
              Run auto-match
            </SubmitButton>
          </form>
        }
        demoForms={
          <div className="flex flex-wrap items-center gap-1.5">
            <form action={createMatchingBankRecord}>
              <SubmitButton variant="outline" size="sm" pendingText="Creating...">
                Bank demo
              </SubmitButton>
            </form>
            <form action={createMatchingChainRecord}>
              <SubmitButton variant="outline" size="sm" pendingText="Creating...">
                Chain demo
              </SubmitButton>
            </form>
            <form action={createExceptionRecord}>
              <SubmitButton variant="outline" size="sm" pendingText="Creating...">
                Exception demo
              </SubmitButton>
            </form>
          </div>
        }
      />

      <div className="ops-panel ops-panel-accent reconciliation-console overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ops-line-soft)] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Reconciliation console</p>
            <p className="truncate text-xs text-slate-400">Queue on the left · resolution console on the right</p>
          </div>
          <p className="hidden shrink-0 text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 sm:block">
            Select a record
          </p>
        </div>

        <Suspense fallback={null}>
          <FilterBar
            embedded
            searchPlaceholder="Search reference, source, settlement..."
            statusOptions={["OPEN", "MATCHED", "PARTIALLY_MATCHED", "UNMATCHED", "EXCEPTION", "RESOLVED"]}
          />
        </Suspense>

        <ReconciliationWorkspace
          embedded
          records={workspaceRows}
          confirmAction={confirmMatch}
          rejectAction={rejectSuggestion}
          resolveAction={resolveException}
        />
      </div>
    </div>
  );
}
