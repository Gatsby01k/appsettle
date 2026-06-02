import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditPayload = {
  publicId?: string;
  reference?: string;
  externalRef?: string;
  source?: string;
  status?: string;
  fromStatus?: string;
  toStatus?: string;
  amount?: string;
  currency?: string;
  settlementPublicId?: string;
  settlementReference?: string;
};

function payload(value: unknown): AuditPayload {
  return value && typeof value === "object" ? value as AuditPayload : {};
}

function resourceLabel(log: { resourceType: string; resourceId: string | null; before: unknown; after: unknown }) {
  const before = payload(log.before);
  const after = payload(log.after);
  const data = { ...before, ...after };

  if (data.publicId || data.reference) {
    return [data.publicId, data.reference].filter(Boolean).join(" · ");
  }

  if (data.externalRef) {
    return [data.externalRef, data.source].filter(Boolean).join(" · ");
  }

  if (data.settlementPublicId || data.settlementReference) {
    return [data.settlementPublicId, data.settlementReference].filter(Boolean).join(" · ");
  }

  return `${log.resourceType}${log.resourceId ? ` / ${log.resourceId.slice(0, 8)}` : ""}`;
}

function eventDetail(log: { before: unknown; after: unknown }) {
  const before = payload(log.before);
  const after = payload(log.after);
  const fromStatus = after.fromStatus ?? before.status;
  const toStatus = after.toStatus ?? after.status;

  if (fromStatus && toStatus && fromStatus !== toStatus) {
    return `${fromStatus} → ${toStatus}`;
  }

  if (toStatus) return toStatus;
  if (after.amount && after.currency) return `${after.amount} ${after.currency}`;
  return "Recorded";
}

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
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>{log.user?.email ?? log.actorType}</TableCell>
                  <TableCell><Badge>{log.action}</Badge></TableCell>
                  <TableCell>{resourceLabel(log)}</TableCell>
                  <TableCell>{eventDetail(log)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
