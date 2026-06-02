import { SettlementStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createSettlement, transitionSettlement } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { canApproveSettlement } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { EmptyState, FilterBar, Lifecycle, MetricCard, PageHeader, PremiumStatusBadge } from "@/components/dashboard/premium";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
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

function canApproveStatus(status: SettlementStatus) {
  return status === SettlementStatus.REQUESTED;
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
    await createSettlement({
      quoteId: String(formData.get("quoteId") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      sourceAccount: String(formData.get("sourceAccount") ?? ""),
      targetAccount: String(formData.get("targetAccount") ?? ""),
    }, user.id, organization.id);
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

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string }> }) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const message = successMessage(params.success);
  const [quotes, settlements] = await Promise.all([
    prisma.quote.findMany({ where: { organizationId: organization.id, status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.settlement.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredSettlements = settlements.filter((settlement) => {
    const matchesSearch = !query || settlement.publicId.toLowerCase().includes(query) || settlement.reference.toLowerCase().includes(query);
    const matchesStatus = !params.status || settlement.status === params.status;
    return matchesSearch && matchesStatus;
  });
  const requested = settlements.filter((settlement) => settlement.status === SettlementStatus.REQUESTED).length;
  const inFlight = settlements.filter((settlement) => isInFlight(settlement.status)).length;
  const settled = settlements.filter((settlement) => isCompleted(settlement.status)).length;

  return (
    <RevealGroup className="space-y-8">
      <Reveal>
        <PageHeader
          eyebrow="Settlement operations"
          title="Lifecycle control for treasury settlements"
          description="Create settlements from active quotes, approve execution, monitor state changes, and inspect every operation from a drawer-based workflow."
        />
      </Reveal>
      {params.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {params.error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Reveal><MetricCard label="Requested" value={requested} helper="Awaiting approval" tone="amber" /></Reveal>
        <Reveal><MetricCard label="In flight" value={inFlight} helper="Approved or executing" tone="slate" /></Reveal>
        <Reveal><MetricCard label="Completed" value={settled} helper="Settled or reconciled" tone="emerald" /></Reveal>
      </div>

      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>New settlement</CardTitle>
            <p className="text-sm text-slate-500">Create from an ACTIVE quote. The quote will be marked ACCEPTED once the settlement is created.</p>
          </CardHeader>
          <CardContent>
            <form action={submitSettlement} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quoteId">Active quote</Label>
                <p className="text-sm text-muted-foreground">
                  Only ACTIVE, unexpired quotes can create new settlements. Once a settlement is created, the selected quote is marked as ACCEPTED and removed from this list.
                </p>
                <select id="quoteId" name="quoteId" className="h-11 rounded-xl border bg-background px-3 text-sm" required>
                  <option value="">Select quote</option>
                  {quotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.corridor} · {formatCurrency(String(quote.sourceAmount), quote.sourceCurrency)}
                    </option>
                  ))}
                </select>
                {quotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active unexpired quotes are available. Create a fresh quote first.</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference">Reference</Label>
                <Input id="reference" name="reference" placeholder="psp_batch_1842" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sourceAccount">Source account</Label>
                <Input id="sourceAccount" name="sourceAccount" placeholder="INR treasury account" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="targetAccount">Target account</Label>
                <Input id="targetAccount" name="targetAccount" placeholder="USDT wallet or payout rail" required />
              </div>
              <SubmitButton type="submit" disabled={quotes.length === 0} pendingText="Creating settlement...">
                Create settlement
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
        </Reveal>
        <Reveal>
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Settlement queue</CardTitle>
            <FilterBar
              searchPlaceholder="Search public ID or reference..."
              statusOptions={["REQUESTED", "APPROVED", "EXECUTING", "SETTLED", "RECONCILED"]}
              defaultSearch={params.q}
              defaultStatus={params.status}
            />
          </CardHeader>
          <CardContent className="grid gap-4">
            {filteredSettlements.length ? filteredSettlements.map((settlement) => (
              <div key={settlement.id} className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-semibold text-slate-950">{settlement.publicId}</p>
                        <PremiumStatusBadge status={settlement.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{settlement.reference}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(String(settlement.sourceAmount), settlement.sourceCurrency)}</p>
                      <p className="text-xs text-slate-500">Source amount</p>
                    </div>
                  </div>
                  <Lifecycle active={settlement.status} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <DetailDrawer title={`${settlement.publicId} settlement`}>
                      <Lifecycle active={settlement.status} />
                      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-medium">{settlement.reference}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Source</span><span className="font-medium">{formatCurrency(String(settlement.sourceAmount), settlement.sourceCurrency)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="font-medium">{formatCurrency(String(settlement.targetAmount), settlement.targetCurrency)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Status</span><PremiumStatusBadge status={settlement.status} /></div>
                      </div>
                    </DetailDrawer>
                    <div>
                      {canApproveSettlement(membership.role) ? (
                        <form action={transition} className="flex flex-wrap gap-2">
                          <input type="hidden" name="settlementId" value={settlement.id} />
                          {canApproveStatus(settlement.status) ? (
                            <SubmitButton name="status" value="APPROVED" variant="outline" size="sm" pendingText="Approving...">
                              Approve
                            </SubmitButton>
                          ) : null}
                          {settlement.status === SettlementStatus.APPROVED ? (
                            <SubmitButton name="status" value="EXECUTING" variant="outline" size="sm" pendingText="Executing...">
                              Execute
                            </SubmitButton>
                          ) : null}
                          {settlement.status === SettlementStatus.EXECUTING ? (
                            <SubmitButton name="status" value="SETTLED" variant="outline" size="sm" pendingText="Settling...">
                              Settle
                            </SubmitButton>
                          ) : null}
                          {!hasWorkflowAction(settlement.status) ? (
                            <span className="text-sm text-muted-foreground">No actions available</span>
                          ) : null}
                        </form>
                      ) : "Read only"}
                    </div>
                  </div>
                </div>
              </div>
            )) : <EmptyState title="No settlements match your filters" description="Create a settlement from an active quote or adjust your filters." />}
          </CardContent>
        </Card>
        </Reveal>
      </div>
    </RevealGroup>
  );
}
