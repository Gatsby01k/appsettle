import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createReconciliationRecord } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { EmptyState, FilterBar, MetricCard, PageHeader, PremiumStatusBadge } from "@/components/dashboard/premium";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
import { SubmitButton } from "@/components/ui/submit-button";

async function submitRecord(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  try {
    await createReconciliationRecord({
      externalRef: String(formData.get("externalRef") ?? ""),
      source: String(formData.get("source") ?? ""),
      amount: formData.get("amount"),
      currency: String(formData.get("currency") ?? ""),
      settlementId: String(formData.get("settlementId") || "") || undefined,
      valueDate: String(formData.get("valueDate") ?? ""),
      status: String(formData.get("status") ?? ""),
      exceptionReason: String(formData.get("exceptionReason") || "") || undefined,
    }, user.id, organization.id);
  } catch (error) {
    redirect(`/reconciliation?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/reconciliation?success=created");
}

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string }> }) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const [records, settlements] = await Promise.all([
    prisma.reconciliationRecord.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { settlement: true },
    }),
    prisma.settlement.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredRecords = records.filter((record) => {
    const matchesSearch = !query || record.externalRef.toLowerCase().includes(query) || record.source.toLowerCase().includes(query) || record.settlement?.reference.toLowerCase().includes(query);
    const matchesStatus = !params.status || record.status === params.status;
    return matchesSearch && matchesStatus;
  });
  const matched = records.filter((record) => record.status === "MATCHED").length;
  const exceptions = records.filter((record) => record.status === "EXCEPTION").length;
  const unmatched = records.filter((record) => !record.settlement).length;

  return (
    <RevealGroup className="space-y-8">
      <Reveal>
        <PageHeader
          eyebrow="Reconciliation"
          title="Exception-led matching workspace"
          description="Review bank, chain, and PSP records, link matched settlements, and resolve exceptions with clear operational context."
        />
      </Reveal>
      {params.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {params.error}
        </div>
      ) : null}
      {params.success === "created" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Reconciliation record saved.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Reveal><MetricCard label="Matched" value={matched} helper="Linked to settlements" tone="emerald" /></Reveal>
        <Reveal><MetricCard label="Unmatched" value={unmatched} helper="Needs matching review" tone="amber" /></Reveal>
        <Reveal><MetricCard label="Exceptions" value={exceptions} helper="Requires operations decision" tone={exceptions > 0 ? "rose" : "slate"} /></Reveal>
      </div>

      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>Add reconciliation record</CardTitle>
            <p className="text-sm text-slate-500">MATCHED records require a settlement. EXCEPTION records require a reason and cannot be linked to a settlement.</p>
          </CardHeader>
          <CardContent>
            <form action={submitRecord} className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="externalRef">External reference</Label><Input id="externalRef" name="externalRef" required /></div>
              <div className="grid gap-2"><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" min="1" step="0.01" required /></div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <select id="currency" name="currency" className="h-11 rounded-xl border bg-background px-3 text-sm"><option>INR</option><option>USDT</option></select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source">Source</Label>
                <select id="source" name="source" className="h-11 rounded-xl border bg-background px-3 text-sm">
                  <option value="bank_statement">Bank statement</option>
                  <option value="chain_tx">Chain transaction</option>
                  <option value="psp_report">PSP report</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="settlementId">Settlement match</Label>
                <select id="settlementId" name="settlementId" className="h-11 rounded-xl border bg-background px-3 text-sm">
                  <option value="">Unmatched</option>
                  {settlements.map((settlement) => <option key={settlement.id} value={settlement.id}>{settlement.publicId} · {settlement.reference}</option>)}
                </select>
              </div>
              <div className="grid gap-2"><Label htmlFor="valueDate">Value date</Label><Input id="valueDate" name="valueDate" type="date" required /></div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" className="h-11 rounded-xl border bg-background px-3 text-sm">
                  <option>OPEN</option><option>MATCHED</option><option>PARTIALLY_MATCHED</option><option>UNMATCHED</option><option>EXCEPTION</option><option>RESOLVED</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exceptionReason">Exception reason</Label>
                <Input id="exceptionReason" name="exceptionReason" />
                <p className="text-sm text-muted-foreground">Required when status is EXCEPTION.</p>
              </div>
              <SubmitButton type="submit" pendingText="Saving record...">Save record</SubmitButton>
            </form>
          </CardContent>
        </Card>
        </Reveal>
        <Reveal>
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Records</CardTitle>
            <FilterBar
              searchPlaceholder="Search external ref, source, or settlement..."
              statusOptions={["OPEN", "MATCHED", "PARTIALLY_MATCHED", "UNMATCHED", "EXCEPTION", "RESOLVED"]}
              defaultSearch={params.q}
              defaultStatus={params.status}
            />
          </CardHeader>
          <CardContent className="grid gap-3">
                {filteredRecords.length ? filteredRecords.map((record) => (
                  <div key={record.id} className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-semibold text-slate-950">{record.externalRef}</p>
                          <PremiumStatusBadge status={record.status} />
                          {record.settlement ? <PremiumStatusBadge status="MATCHED" /> : <PremiumStatusBadge status="UNMATCHED" />}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{record.source} · {formatCurrency(String(record.amount), record.currency)}</p>
                      {record.status === "EXCEPTION" && record.exceptionReason ? (
                        <div className="mt-1 text-xs text-red-700">Reason: {record.exceptionReason}</div>
                      ) : null}
                      </div>
                      <div className="min-w-48">
                      {record.settlement ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Matched settlement</p>
                          <div className="mt-1 text-sm font-medium text-slate-950">
                            {record.settlement.publicId} · {record.settlement.reference}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No settlement linked</p>
                      )}
                      </div>
                      <DetailDrawer title={`Reconciliation ${record.externalRef}`}>
                        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Source</span><span className="font-medium">{record.source}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-medium">{formatCurrency(String(record.amount), record.currency)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Value date</span><span className="font-medium">{record.valueDate.toLocaleDateString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Status</span><PremiumStatusBadge status={record.status} /></div>
                        </div>
                      </DetailDrawer>
                    </div>
                  </div>
                )) : <EmptyState title="No reconciliation records match" description="Adjust your filters or add a record from the intake form." />}
          </CardContent>
        </Card>
        </Reveal>
      </div>
    </RevealGroup>
  );
}
