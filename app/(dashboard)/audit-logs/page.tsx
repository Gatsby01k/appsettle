import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { EmptyState, FilterBar, MetricCard, PageHeader } from "@/components/dashboard/premium";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal, RevealGroup } from "@/components/ui/reveal";

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

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });
  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredLogs = logs.filter((log) => {
    const resource = resourceLabel(log).toLowerCase();
    return !query || log.action.toLowerCase().includes(query) || resource.includes(query) || log.resourceType.toLowerCase().includes(query);
  });
  const settlementEvents = logs.filter((log) => log.resourceType === "settlement").length;
  const reconciliationEvents = logs.filter((log) => log.resourceType === "reconciliation_record").length;

  return (
    <RevealGroup className="space-y-8">
      <Reveal>
        <PageHeader
          eyebrow="Audit logs"
          title="Evidence-grade operational activity"
          description="A chronological evidence trail for settlement, reconciliation, settings, and user activity across the workspace."
        />
      </Reveal>
      <div className="grid gap-4 md:grid-cols-3">
        <Reveal><MetricCard label="Total events" value={logs.length} helper="Most recent 100 records" tone="slate" /></Reveal>
        <Reveal><MetricCard label="Settlement events" value={settlementEvents} helper="Lifecycle and creation actions" tone="emerald" /></Reveal>
        <Reveal><MetricCard label="Recon events" value={reconciliationEvents} helper="Matching and exception records" tone="amber" /></Reveal>
      </div>
      <Reveal>
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Recent audit events</CardTitle>
          <FilterBar searchPlaceholder="Search action, resource, or reference..." statusOptions={[]} defaultSearch={params.q} />
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredLogs.length ? filteredLogs.map((log) => (
            <div key={log.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{log.action}</Badge>
                  <p className="text-sm font-semibold text-slate-950">{resourceLabel(log)}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatDateTime(log.createdAt)} · {log.user?.email ?? log.actorType}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-slate-600">{eventDetail(log)}</p>
                <DetailDrawer title={resourceLabel(log)}>
                  <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Action</span><span className="font-medium">{log.action}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Resource</span><span className="font-medium">{log.resourceType}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Detail</span><span className="font-medium">{eventDetail(log)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Actor</span><span className="font-medium">{log.user?.email ?? log.actorType}</span></div>
                  </div>
                </DetailDrawer>
              </div>
            </div>
          )) : <EmptyState title="No audit events match your filters" description="Try another search term or clear filters." />}
        </CardContent>
      </Card>
      </Reveal>
    </RevealGroup>
  );
}
