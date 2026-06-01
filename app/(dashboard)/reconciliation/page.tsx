import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createReconciliationRecord } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function submitRecord(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  await createReconciliationRecord({
    externalRef: formData.get("externalRef"),
    source: formData.get("source"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    settlementId: formData.get("settlementId") || undefined,
    valueDate: formData.get("valueDate"),
    status: formData.get("status"),
    exceptionReason: formData.get("exceptionReason") || undefined,
  }, user.id, organization.id);
  redirect("/reconciliation");
}

export default async function ReconciliationPage() {
  const { organization } = await requireSession();
  const [records, settlements] = await Promise.all([
    prisma.reconciliationRecord.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.settlement.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Reconciliation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Match external records to settlements</h1>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Add reconciliation record</CardTitle></CardHeader>
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
              <div className="grid gap-2"><Label htmlFor="exceptionReason">Exception reason</Label><Input id="exceptionReason" name="exceptionReason" /></div>
              <Button type="submit">Save record</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Records</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.externalRef}</TableCell>
                    <TableCell>{formatCurrency(String(record.amount), record.currency)}</TableCell>
                    <TableCell>{record.source}</TableCell>
                    <TableCell><Badge tone={record.status === "MATCHED" ? "success" : record.status === "EXCEPTION" ? "danger" : "warning"}>{record.status.replaceAll("_", " ")}</Badge></TableCell>
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
