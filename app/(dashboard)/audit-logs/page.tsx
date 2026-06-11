import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { EmptyState } from "@/components/ops/empty-state";
import { FilterBar } from "@/components/ops/filter-bar";

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
  return value && typeof value === "object" ? (value as AuditPayload) : {};
}

function resourceLabel(log: { resourceType: string; resourceId: string | null; before: unknown; after: unknown }) {
  const data = { ...payload(log.before), ...payload(log.after) };
  if (data.publicId || data.reference) return [data.publicId, data.reference].filter(Boolean).join(" · ");
  if (data.externalRef) return [data.externalRef, data.source].filter(Boolean).join(" · ");
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
  if (fromStatus && toStatus && fromStatus !== toStatus) return `${fromStatus} → ${toStatus}`;
  if (toStatus) return String(toStatus);
  if (after.amount && after.currency) return `${after.amount} ${after.currency}`;
  return "Recorded";
}

function auditTone(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (action.includes("EXCEPTION") || action.includes("FAILED") || action.includes("DELETE")) return "danger";
  if (action.includes("APPROVED") || action.includes("MATCHED") || action.includes("SETTLED") || action.includes("RECONCILED")) {
    return "success";
  }
  if (action.includes("REQUESTED") || action.includes("EXECUTING") || action.includes("UPDATE")) return "warning";
  if (action.includes("CREATE")) return "info";
  return "neutral";
}

function demoAuditWhere(organizationId: string) {
  return {
    organizationId,
    OR: [{ action: { startsWith: "DEMO." } }, { resourceId: { startsWith: "SET-DEMO" } }],
  };
}

function DemoFocusBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-800">
      Demo focus mode
    </span>
  );
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; demo?: string }>;
}) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const demoFocus = params.demo === "1";
  const logs = await prisma.auditLog.findMany({
    where: demoFocus ? demoAuditWhere(organization.id) : { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });

  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredLogs = logs.filter((log) => {
    const resource = resourceLabel(log).toLowerCase();
    return (
      !query ||
      log.action.toLowerCase().includes(query) ||
      resource.includes(query) ||
      log.resourceType.toLowerCase().includes(query)
    );
  });

  const settlementEvents = logs.filter((log) => log.resourceType === "settlement").length;
  const reconciliationEvents = logs.filter((log) => log.resourceType === "reconciliation_record").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Immutable evidence trail for settlement, reconciliation, and configuration changes."
        actions={demoFocus ? <DemoFocusBadge /> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total events" value={logs.length} hint="Latest 100" />
        <MetricCard label="Settlement" value={settlementEvents} hint="Lifecycle events" tone="info" />
        <MetricCard label="Reconciliation" value={reconciliationEvents} hint="Matching events" tone="warning" />
      </div>

      <Suspense fallback={null}>
        <FilterBar searchPlaceholder="Search action, resource, reference..." />
      </Suspense>

      <div className="ops-panel p-4 sm:p-5">
        {filteredLogs.length ? (
          <div className="audit-line space-y-0.5">
            {filteredLogs.map((log) => {
              const actor = log.actorType.toLowerCase() as "user" | "api" | "system";
              const tone = auditTone(log.action);
              return (
                <div key={log.id} className={`audit-event audit-event--${actor}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[13px] font-medium tracking-tight text-slate-950">{log.action}</p>
                    <span className={`audit-actor audit-actor--${actor}`}>{log.actorType}</span>
                    {tone === "danger" ? (
                      <span className="case-chip case-chip--live">attention</span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">{resourceLabel(log)}</span>
                    <span>{eventDetail(log)}</span>
                    <span className="text-slate-400">{log.user?.email ?? log.actorType}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No audit events match" description="Try another search term or clear filters." />
        )}
      </div>
    </div>
  );
}

