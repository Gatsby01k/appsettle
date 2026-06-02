import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { autoMatchReconciliation, createReconciliationRecord } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { computeConfidence, matchTypeFor, MATCH_LABEL } from "@/lib/reconciliation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { FlashMessage } from "@/components/ops/flash-message";
import { FilterBar } from "@/components/ops/filter-bar";
import { FormSelect } from "@/components/ops/form-select";
import { ReconciliationWorkspace } from "@/components/dashboard/reconciliation-workspace";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function submitRecord(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  const settlementRaw = String(formData.get("settlementId") || "");
  try {
    await createReconciliationRecord(
      {
        externalRef: String(formData.get("externalRef") ?? ""),
        source: String(formData.get("source") ?? ""),
        amount: formData.get("amount"),
        currency: String(formData.get("currency") ?? ""),
        settlementId: settlementRaw && settlementRaw !== "_none" ? settlementRaw : undefined,
        valueDate: String(formData.get("valueDate") ?? ""),
        status: String(formData.get("status") ?? ""),
        exceptionReason: String(formData.get("exceptionReason") || "") || undefined,
      },
      user.id,
      organization.id,
    );
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=created");
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

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string; matched?: string; scanned?: string }>;
}) {
  const { organization } = await requireSession();
  const params = await searchParams;

  const [records, settlements] = await Promise.all([
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
  ]);

  const confidenceFor = (record: (typeof records)[number]) =>
    record.settlement
      ? computeConfidence(Number(record.amount), record.currency, record.valueDate, {
          sourceCurrency: record.settlement.sourceCurrency,
          targetCurrency: record.settlement.targetCurrency,
          sourceAmount: Number(record.settlement.sourceAmount),
          targetAmount: Number(record.settlement.targetAmount),
          refDate: record.settlement.settledAt ?? record.settlement.createdAt,
        })
      : 0;

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

  const autoMatched = records.filter(
    (r) => matchTypeFor(r.status, confidenceFor(r), Boolean(r.settlement)) === "AUTO_MATCHED",
  ).length;
  const suggested = records.filter(
    (r) => matchTypeFor(r.status, confidenceFor(r), Boolean(r.settlement)) === "SUGGESTED",
  ).length;
  const manualReview = records.filter(
    (r) => matchTypeFor(r.status, confidenceFor(r), Boolean(r.settlement)) === "MANUAL_REVIEW",
  ).length;
  const exceptions = records.filter((r) => r.status === "EXCEPTION").length;
  const matchRate = records.length
    ? Math.round(((autoMatched + suggested) / records.length) * 100)
    : 0;

  const workspaceRows = filteredRecords.map((record) => {
    const confidence = confidenceFor(record);
    const matchType = matchTypeFor(record.status, confidence, Boolean(record.settlement));
    return {
      id: record.id,
      externalRef: record.externalRef,
      source: record.source,
      amount: formatCurrency(String(record.amount), record.currency),
      currency: record.currency,
      status: record.status,
      matchType,
      matchLabel: MATCH_LABEL[matchType],
      confidence,
      exceptionReason: record.exceptionReason,
      valueDate: record.valueDate.toLocaleDateString(),
      settlement: record.settlement
        ? { publicId: record.settlement.publicId, reference: record.settlement.reference }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Auto-match external records to settlements, review suggestions, and resolve exceptions."
        actions={
          <form action={runAutoMatch}>
            <SubmitButton variant="primary" size="sm" pendingText="Matching...">
              Run auto-match
            </SubmitButton>
          </form>
        }
      />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? <FlashMessage message="Reconciliation record saved." /> : null}
      {params.success === "automatch" ? (
        <FlashMessage
          message={`Auto-match complete — ${params.matched ?? 0} of ${params.scanned ?? 0} open records matched and reconciled.`}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Auto-matched" value={autoMatched} hint="100% confidence" tone="success" />
        <MetricCard label="Manual review" value={manualReview + suggested} hint="Needs operator" tone="warning" />
        <MetricCard label="Exceptions" value={exceptions} hint="Operations queue" tone={exceptions ? "danger" : "neutral"} />
        <MetricCard label="Match rate" value={`${matchRate}%`} hint="Matched + suggested" tone="info" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add record</CardTitle>
          <CardDescription>MATCHED requires a settlement. EXCEPTION requires a reason and cannot link a settlement.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitRecord} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="externalRef">External reference</Label>
              <Input id="externalRef" name="externalRef" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
            </div>
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <FormSelect
                name="currency"
                defaultValue="INR"
                options={[
                  { value: "INR", label: "INR" },
                  { value: "USDT", label: "USDT" },
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Source</Label>
              <FormSelect
                name="source"
                defaultValue="bank_statement"
                options={[
                  { value: "bank_statement", label: "Bank statement" },
                  { value: "chain_tx", label: "Chain transaction" },
                  { value: "psp_report", label: "PSP report" },
                  { value: "manual", label: "Manual" },
                ]}
              />
            </div>
            <div className="grid gap-1.5 lg:col-span-2">
              <Label>Settlement match</Label>
              <FormSelect
                name="settlementId"
                defaultValue="_none"
                options={[
                  { value: "_none", label: "Unmatched" },
                  ...settlements.map((s) => ({ value: s.id, label: `${s.publicId} · ${s.reference}` })),
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="valueDate">Value date</Label>
              <Input id="valueDate" name="valueDate" type="date" required />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <FormSelect
                name="status"
                defaultValue="OPEN"
                options={[
                  { value: "OPEN", label: "Open" },
                  { value: "MATCHED", label: "Matched" },
                  { value: "PARTIALLY_MATCHED", label: "Partially matched" },
                  { value: "UNMATCHED", label: "Unmatched" },
                  { value: "EXCEPTION", label: "Exception" },
                  { value: "RESOLVED", label: "Resolved" },
                ]}
              />
            </div>
            <div className="grid gap-1.5 lg:col-span-2">
              <Label htmlFor="exceptionReason">Exception reason</Label>
              <Input id="exceptionReason" name="exceptionReason" placeholder="Required for EXCEPTION status" />
            </div>
            <div className="flex items-end lg:col-span-4">
              <SubmitButton type="submit" variant="primary" pendingText="Saving...">
                Save record
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Suspense fallback={null}>
        <FilterBar
          searchPlaceholder="Search reference, source, settlement..."
          statusOptions={["OPEN", "MATCHED", "PARTIALLY_MATCHED", "UNMATCHED", "EXCEPTION", "RESOLVED"]}
        />
      </Suspense>

      <ReconciliationWorkspace records={workspaceRows} />
    </div>
  );
}
