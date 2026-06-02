import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ReportType = "settlement" | "reconciliation" | "audit";
type ReportFormat = "csv" | "json";

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return lines.join("\n");
}

async function buildRows(type: ReportType, organizationId: string): Promise<Record<string, unknown>[]> {
  if (type === "settlement") {
    const settlements = await prisma.settlement.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return settlements.map((s) => ({
      publicId: s.publicId,
      reference: s.reference,
      corridor: s.corridor,
      status: s.status,
      sourceAmount: s.sourceAmount.toString(),
      sourceCurrency: s.sourceCurrency,
      targetAmount: s.targetAmount.toString(),
      targetCurrency: s.targetCurrency,
      feeAmount: s.feeAmount.toString(),
      createdAt: s.createdAt.toISOString(),
      settledAt: s.settledAt?.toISOString() ?? "",
      reconciledAt: s.reconciledAt?.toISOString() ?? "",
    }));
  }

  if (type === "reconciliation") {
    const records = await prisma.reconciliationRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return records.map((r) => ({
      externalRef: r.externalRef,
      source: r.source,
      status: r.status,
      amount: r.amount.toString(),
      currency: r.currency,
      valueDate: r.valueDate.toISOString(),
      settlementId: r.settlementId ?? "",
      exceptionReason: r.exceptionReason ?? "",
      createdAt: r.createdAt.toISOString(),
    }));
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { user: true },
  });
  return logs.map((log) => ({
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    actor: log.user?.email ?? log.actorType,
    resourceType: log.resourceType,
    resourceId: log.resourceId ?? "",
    requestId: log.requestId ?? "",
  }));
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "settlement") as ReportType;
  const format = (searchParams.get("format") ?? "csv") as ReportFormat;

  if (!["settlement", "reconciliation", "audit"].includes(type)) {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  const rows = await buildRows(type, session.organizationId);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `inrsettle_${type}_report_${stamp}.${format}`;

  if (format === "json") {
    return new NextResponse(JSON.stringify({ type, generatedAt: new Date().toISOString(), rows }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
