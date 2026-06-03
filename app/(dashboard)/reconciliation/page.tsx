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
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { FlashMessage } from "@/components/ops/flash-message";
import { FilterBar } from "@/components/ops/filter-bar";
import { AddRecordForm } from "@/components/dashboard/add-record-form";
import { ReconciliationWorkspace } from "@/components/dashboard/reconciliation-workspace";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string; matched?: string; scanned?: string }>;
}) {
  const { organization } = await requireSession();
  const params = await searchParams;

  // Auto-match is an explicit operator action (the "Run auto-match" button), never a
  // side effect of opening the page or saving a record. Saving an external record
  // leaves it OPEN until the engine or an operator reconciles it.

  const [records, settlements, settledCandidates] = await Promise.all([
    prisma.reconciliationRecord.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { settlement: true },
    }),
    prisma.settlement.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.settlement.findMany({
      where: { organizationId: organization.id, status: "SETTLED" },
      orderBy: { settledAt: "desc" },
    }),
  ]);

  // Best open settlement candidate for an unlinked record (excludes rejected ones).
  const suggestionFor = (record: (typeof records)[number]) => {
    if (record.settlement || record.status === "EXCEPTION") return null;
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
  const manualReview = records.filter((r) => !r.settlement && r.status !== "EXCEPTION").length;
  const suggestedCount = records.filter((r) => !r.settlement && r.status !== "EXCEPTION" && suggestionFor(r)).length;
  const exceptions = records.filter((r) => r.status === "EXCEPTION").length;
  const matchRate = records.length ? Math.round((matchedCount / records.length) * 100) : 0;

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
      amount: formatCurrency(String(record.amount), record.currency),
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
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Capture external records, run the auto-match engine, review suggestions, and resolve exceptions."
      />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? (
        <FlashMessage message="External record saved as OPEN — run auto-match to reconcile it." />
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Matched" value={matchedCount} hint="Linked & reconciled" tone="success" />
        <MetricCard
          label="Manual review"
          value={manualReview}
          hint={`${suggestedCount} with suggestions`}
          tone={manualReview ? "warning" : "neutral"}
        />
        <MetricCard label="Exceptions" value={exceptions} hint="Operations queue" tone={exceptions ? "danger" : "neutral"} />
        <MetricCard label="Match rate" value={`${matchRate}%`} hint="Reconciled records" tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Add external record</CardTitle>
            <CardDescription>
              Capture a bank, chain, or PSP record. It is saved as OPEN — reconcile it with the auto-match engine or an
              optional manual match.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddRecordForm
              action={submitRecord}
              settlements={settlements.map((s) => ({ value: s.id, label: `${s.publicId} · ${s.reference}` }))}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auto-match engine</CardTitle>
              <CardDescription>
                Scans every OPEN/UNMATCHED record and reconciles only exact 100% matches against SETTLED settlements
                (same amount, currency, and value date). 80–99% candidates become suggestions for review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={runAutoMatch}>
                <SubmitButton variant="primary" pendingText="Matching...">
                  Run auto-match
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick create</CardTitle>
              <CardDescription>
                Generate demo external records in one click. Matching records are saved as OPEN — run auto-match to
                reconcile them.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <form action={createMatchingBankRecord}>
                <SubmitButton variant="outline" pendingText="Creating..." className="w-full justify-start">
                  Create matching bank record
                </SubmitButton>
              </form>
              <form action={createMatchingChainRecord}>
                <SubmitButton variant="outline" pendingText="Creating..." className="w-full justify-start">
                  Create matching chain record
                </SubmitButton>
              </form>
              <form action={createExceptionRecord}>
                <SubmitButton variant="outline" pendingText="Creating..." className="w-full justify-start">
                  Create exception record
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Suspense fallback={null}>
        <FilterBar
          searchPlaceholder="Search reference, source, settlement..."
          statusOptions={["OPEN", "MATCHED", "PARTIALLY_MATCHED", "UNMATCHED", "EXCEPTION", "RESOLVED"]}
        />
      </Suspense>

      <ReconciliationWorkspace
        records={workspaceRows}
        confirmAction={confirmMatch}
        rejectAction={rejectSuggestion}
      />
    </div>
  );
}
