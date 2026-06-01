import { SettlementStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createSettlement, transitionSettlement } from "@/lib/domain";
import { canApproveSettlement } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function submitSettlement(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  await createSettlement({
    quoteId: formData.get("quoteId"),
    reference: formData.get("reference"),
    sourceAccount: formData.get("sourceAccount"),
    targetAccount: formData.get("targetAccount"),
  }, user.id, organization.id);
  redirect("/settlements");
}

async function transition(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canApproveSettlement(membership.role)) redirect("/settlements");
  await transitionSettlement(
    String(formData.get("settlementId")),
    String(formData.get("status")) as SettlementStatus,
    user.id,
    organization.id,
    "Updated from dashboard.",
  );
  redirect("/settlements");
}

export default async function SettlementsPage() {
  const { organization, membership } = await requireSession();
  const [quotes, settlements] = await Promise.all([
    prisma.quote.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    prisma.settlement.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Settlement Operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Create, approve, and track settlements</h1>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>New settlement</CardTitle></CardHeader>
          <CardContent>
            <form action={submitSettlement} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quoteId">Accepted quote</Label>
                <select id="quoteId" name="quoteId" className="h-11 rounded-xl border bg-background px-3 text-sm" required>
                  <option value="">Select quote</option>
                  {quotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.corridor} · {formatCurrency(String(quote.sourceAmount), quote.sourceCurrency)}
                    </option>
                  ))}
                </select>
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
              <Button type="submit" disabled={quotes.length === 0}>Create settlement</Button>
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
                          <Button name="status" value="APPROVED" variant="outline" size="sm">Approve</Button>
                          <Button name="status" value="EXECUTING" variant="outline" size="sm">Execute</Button>
                          <Button name="status" value="SETTLED" variant="outline" size="sm">Settle</Button>
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
