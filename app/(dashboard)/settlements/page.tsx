import { SettlementStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createSettlement, transitionSettlement } from "@/lib/domain";
import { canApproveSettlement } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function successMessage(value?: string) {
  if (value === "created") return "Settlement created and quote marked as accepted.";
  if (value === "approved") return "Settlement approved.";
  if (value === "executing") return "Settlement moved to executing.";
  if (value === "settled") return "Settlement marked as settled.";
  return null;
}

function hasWorkflowAction(status: SettlementStatus) {
  return new Set<SettlementStatus>([
    SettlementStatus.PENDING_APPROVAL,
    SettlementStatus.APPROVED,
    SettlementStatus.EXECUTING,
  ]).has(status);
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
    const message = error instanceof Error ? error.message : "Unable to create settlement.";
    redirect(`/settlements?error=${encodeURIComponent(message)}`);
  }
  redirect("/settlements?success=created");
}

async function transition(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  const status = String(formData.get("status")) as SettlementStatus;
  await transitionSettlement(
    String(formData.get("settlementId")),
    status,
    user.id,
    organization.id,
    "Updated from dashboard.",
  );
  redirect(`/settlements?success=${status.toLowerCase()}`);
}

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const message = successMessage(params.success);
  const [quotes, settlements] = await Promise.all([
    prisma.quote.findMany({ where: { organizationId: organization.id, status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.settlement.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Settlement Operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Create, approve, and track settlements</h1>
      </div>
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
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>New settlement</CardTitle></CardHeader>
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
        <Card>
          <CardHeader><CardTitle>Settlement queue</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell className="font-medium">{settlement.publicId}<br /><span className="text-xs text-muted-foreground">{settlement.reference}</span></TableCell>
                    <TableCell>{formatCurrency(String(settlement.sourceAmount), settlement.sourceCurrency)}</TableCell>
                    <TableCell><Badge tone={settlement.status === "FAILED" ? "danger" : settlement.status === "RECONCILED" ? "success" : "warning"}>{settlement.status.replaceAll("_", " ")}</Badge></TableCell>
                    <TableCell>
                      {canApproveSettlement(membership.role) ? (
                        <form action={transition} className="flex flex-wrap gap-2">
                          <input type="hidden" name="settlementId" value={settlement.id} />
                          {settlement.status === SettlementStatus.PENDING_APPROVAL ? (
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
