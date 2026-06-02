import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REPORTS = [
  {
    type: "settlement",
    title: "Settlement report",
    description: "Full settlement ledger with lifecycle timestamps, amounts and fees across both corridors.",
  },
  {
    type: "reconciliation",
    title: "Reconciliation report",
    description: "External references, match status and exceptions for finance and audit review.",
  },
  {
    type: "audit",
    title: "Audit report",
    description: "Immutable audit trail of every operator and system action for compliance.",
  },
] as const;

export default async function ReportsPage() {
  const { organization } = await requireSession();

  const [settlementCount, reconciliationCount, auditCount] = await Promise.all([
    prisma.settlement.count({ where: { organizationId: organization.id } }),
    prisma.reconciliationRecord.count({ where: { organizationId: organization.id } }),
    prisma.auditLog.count({ where: { organizationId: organization.id } }),
  ]);

  const counts: Record<string, number> = {
    settlement: settlementCount,
    reconciliation: reconciliationCount,
    audit: auditCount,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate enterprise settlement, reconciliation and audit exports for finance and compliance."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Settlement records" value={settlementCount} hint="Exportable rows" />
        <MetricCard label="Reconciliation records" value={reconciliationCount} hint="Exportable rows" />
        <MetricCard label="Audit events" value={auditCount} hint="Exportable rows" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.type} className="flex flex-col">
            <CardHeader>
              <CardTitle>{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-3">
              <p className="text-xs text-slate-500">
                {counts[report.type]} record{counts[report.type] === 1 ? "" : "s"} ready
              </p>
              <div className="flex gap-2">
                <a
                  href={`/api/reports?type=${report.type}&format=csv`}
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }), "flex-1")}
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </a>
                <a
                  href={`/api/reports?type=${report.type}&format=json`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
                >
                  <Download className="h-3.5 w-3.5" />
                  JSON
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Exports respect your organization scope and are generated on demand from live data.
      </p>
    </div>
  );
}
