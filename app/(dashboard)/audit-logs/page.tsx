import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn, formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ops/empty-state";
import { FilterBar } from "@/components/ops/filter-bar";

// Display-only labels for actor types — professional copy, same data.
const ACTOR_LABEL: Record<string, string> = {
  USER: "User action",
  API: "Provider event",
  SYSTEM: "System event",
};

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
  return "Recorded event";
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
  // Provider/system events from the same dataset — actorType already exists on every log.
  const providerEvents = logs.filter((log) => log.actorType === "API" || log.actorType === "SYSTEM").length;

  return (
    <div className="space-y-4">
      {/* Command header: immutable evidence trail band (mirrors Settlements) */}
      <section className="conf-hero ov-reveal p-5 sm:p-6">
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="overview-live-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-700">
                <span className="ops-pulse ops-pulse--subtle" aria-hidden="true" />
                Immutable evidence trail
              </span>
              {demoFocus ? <DemoFocusBadge /> : null}
            </div>
            <h1 className="conf-hero__headline mt-3">Audit logs</h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-slate-500">
              Track settlement, reconciliation, approval, and configuration events with actor, timestamp, and
              resource history.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="case-chip border-emerald-200 bg-emerald-50 text-emerald-700">Immutable history</span>
              <span className="case-chip border-cyan-200 bg-cyan-50 text-cyan-800">Actor + timestamp</span>
              <span className="case-chip case-chip--gold">Required for finality</span>
              <span className="case-chip case-chip--demo">Provider + user events</span>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total events", value: logs.length, tone: "text-slate-900" },
              { label: "Settlement", value: settlementEvents, tone: "text-[#0a7d86]" },
              { label: "Reconciliation", value: reconciliationEvents, tone: "text-[#9b6810]" },
              { label: "Provider / system", value: providerEvents, tone: "text-brand-emerald-ink" },
            ].map((stat) => (
              <div key={stat.label} className="scase-stat">
                <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-400">{stat.label}</p>
                <p className={cn("scase-stat__value mt-1", stat.tone)}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why this trail exists — UI copy only */}
      <div className="flex items-start gap-2 rounded-xl border border-[var(--ops-line)] bg-white p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald-ink" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Auditable trail:</span> every settlement decision is
          recorded for review, reporting, and finality control. The audit trail is one of the six pillars a
          settlement needs to finalize.
        </p>
      </div>

      <div className="ops-panel ops-panel-accent overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ops-line-soft)] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Recorded events</p>
            <p className="truncate text-xs text-slate-400">
              Latest {logs.length} events · {filteredLogs.length} shown
            </p>
          </div>
          <p className="hidden shrink-0 text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 sm:block">
            Finality evidence
          </p>
        </div>

        <Suspense fallback={null}>
          <FilterBar embedded searchPlaceholder="Search action, resource, reference..." />
        </Suspense>

        <div className="p-4 sm:p-5">
        {filteredLogs.length ? (
          <div className="audit-line space-y-0.5">
            {filteredLogs.map((log) => {
              const actor = log.actorType.toLowerCase() as "user" | "api" | "system";
              const tone = auditTone(log.action);
              return (
                <div key={log.id} className={`audit-event audit-event--${actor}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[13px] font-medium tracking-tight text-slate-950">{log.action}</p>
                    <span className={`audit-actor audit-actor--${actor}`}>
                      {ACTOR_LABEL[log.actorType] ?? log.actorType}
                    </span>
                    {tone === "danger" ? (
                      <span className="case-chip case-chip--live">attention</span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    <span className="font-medium text-slate-700">{resourceLabel(log)}</span>
                    <span className="text-slate-500">{eventDetail(log)}</span>
                    <span className="text-slate-400">
                      {log.user?.email ?? (log.actorType === "API" ? "Provider integration" : "System")}
                    </span>
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
    </div>
  );
}

