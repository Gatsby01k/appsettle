import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusTone(status: SettlementStatus) {
  if (new Set<SettlementStatus>([SettlementStatus.SETTLED, SettlementStatus.RECONCILED, SettlementStatus.APPROVED]).has(status)) return "success";
  if (new Set<SettlementStatus>([SettlementStatus.FAILED, SettlementStatus.CANCELLED]).has(status)) return "danger";
  if (new Set<SettlementStatus>([SettlementStatus.PENDING_APPROVAL, SettlementStatus.EXECUTING, SettlementStatus.ON_HOLD]).has(status)) return "warning";
  return "neutral";
}

export default async function DashboardPage() {
  const { organization } = await requireSession();
  const [settlements, quotes, reconciliation, auditLogs] = await Promise.all([
    prisma.settlement.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.quote.count({ where: { organizationId: organization.id } }),
    prisma.reconciliationRecord.count({ where: { organizationId: organization.id, status: "EXCEPTION" } }),
    prisma.auditLog.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);

  const volume = settlements.reduce((sum, settlement) => sum + Number(settlement.sourceAmount), 0);
  const pending = settlements.filter((settlement) => settlement.status === SettlementStatus.PENDING_APPROVAL).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Operations Overview</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Settlement command center</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Monitor quote activity, settlement lifecycle state, reconciliation exceptions, and audit events across your organization.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle>Volume</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatCurrency(volume)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Open Quotes</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{quotes}</CardContent></Card>
        <Card><CardHeader><CardTitle>Pending Approval</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{pending}</CardContent></Card>
        <Card><CardHeader><CardTitle>Recon Exceptions</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{reconciliation}</CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <Card>
          <CardHeader><CardTitle>Recent settlements</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell className="font-medium">{settlement.publicId}</TableCell>
                    <TableCell>{settlement.reference}</TableCell>
                    <TableCell>{formatCurrency(String(settlement.sourceAmount), settlement.sourceCurrency)}</TableCell>
                    <TableCell><Badge tone={statusTone(settlement.status)}>{settlement.status.replaceAll("_", " ")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-xl border p-3">
                <p className="text-sm font-semibold">{log.action}</p>
                <p className="text-xs text-muted-foreground">{log.resourceType} · {log.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
