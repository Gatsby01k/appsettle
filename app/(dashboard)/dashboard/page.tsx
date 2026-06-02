import { SettlementStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { EmptyState, Lifecycle, MetricCard, PageHeader, PremiumStatusBadge } from "@/components/dashboard/premium";
import { Reveal, RevealGroup } from "@/components/ui/reveal";

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
  const pending = settlements.filter((settlement) => settlement.status === SettlementStatus.REQUESTED).length;
  const activeSettlement = settlements[0];

  return (
    <RevealGroup className="space-y-8">
      <Reveal>
        <PageHeader
          eyebrow="Operations overview"
          title="Executive settlement command center"
          description="A real-time view of treasury throughput, quote activity, reconciliation exceptions, and audit evidence across your INRSettle workspace."
        />
      </Reveal>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Reveal><MetricCard label="Settlement volume" value={formatCurrency(volume)} helper="Recent settlement queue value" tone="emerald" /></Reveal>
        <Reveal><MetricCard label="Quote inventory" value={quotes} helper="Quotes created in this workspace" tone="slate" /></Reveal>
        <Reveal><MetricCard label="Requested" value={pending} helper="Awaiting approval" tone="amber" /></Reveal>
        <Reveal><MetricCard label="Recon exceptions" value={reconciliation} helper="Needs operations review" tone={reconciliation > 0 ? "rose" : "emerald"} /></Reveal>
      </div>

      <Reveal>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-200/70 bg-gradient-to-r from-slate-950 to-slate-800 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl tracking-[-0.03em]">Settlement lifecycle</CardTitle>
              <p className="mt-2 text-sm text-slate-300">Latest settlement progression from request to reconciliation.</p>
            </div>
            {activeSettlement ? <PremiumStatusBadge status={activeSettlement.status} /> : null}
          </CardHeader>
          <CardContent className="p-6">
            {activeSettlement ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{activeSettlement.publicId} · {activeSettlement.reference}</p>
                    <p className="text-sm text-slate-500">{formatCurrency(String(activeSettlement.sourceAmount), activeSettlement.sourceCurrency)} corridor settlement</p>
                  </div>
                  <DetailDrawer title={`${activeSettlement.publicId} details`}>
                    <Lifecycle active={activeSettlement.status} />
                    <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-medium">{activeSettlement.reference}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-medium">{formatCurrency(String(activeSettlement.sourceAmount), activeSettlement.sourceCurrency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Status</span><PremiumStatusBadge status={activeSettlement.status} /></div>
                    </div>
                  </DetailDrawer>
                </div>
                <Lifecycle active={activeSettlement.status} />
              </div>
            ) : (
              <EmptyState title="No settlement activity yet" description="Create a quote, convert it into a settlement, and lifecycle telemetry will appear here." />
            )}
          </CardContent>
        </Card>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.75fr]">
        <Reveal>
          <Card>
            <CardHeader><CardTitle>Recent settlements</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {settlements.length ? settlements.map((settlement) => (
                <div key={settlement.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3"><p className="font-semibold text-slate-950">{settlement.publicId}</p><PremiumStatusBadge status={settlement.status} /></div>
                    <p className="mt-1 text-sm text-slate-500">{settlement.reference}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-semibold text-slate-950">{formatCurrency(String(settlement.sourceAmount), settlement.sourceCurrency)}</p>
                    <p className="text-xs text-slate-500">Treasury amount</p>
                  </div>
                </div>
              )) : <EmptyState title="No settlements found" description="Settlement records will appear once your team creates them." />}
            </CardContent>
          </Card>
        </Reveal>
        <Reveal>
          <Card>
            <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {auditLogs.length ? auditLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
                  <p className="text-sm font-semibold text-slate-950">{log.action}</p>
                  <p className="mt-1 text-xs text-slate-500">{log.resourceType} · {log.createdAt.toLocaleString()}</p>
                </div>
              )) : <EmptyState title="No audit events" description="Operational events will be recorded here automatically." />}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </RevealGroup>
  );
}
