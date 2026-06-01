import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AuditLogsPage() {
  const { organization } = await requireSession();
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Audit Logs</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Immutable activity trail</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent audit events</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>{log.user?.email ?? log.actorType}</TableCell>
                  <TableCell><Badge>{log.action}</Badge></TableCell>
                  <TableCell>{log.resourceType}{log.resourceId ? ` / ${log.resourceId.slice(0, 8)}` : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
