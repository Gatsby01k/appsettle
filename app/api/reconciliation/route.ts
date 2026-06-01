import { NextRequest, NextResponse } from "next/server";
import { createReconciliationRecord } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiContext } from "@/lib/api";

export async function GET() {
  const { context, error } = await requireApiContext();
  if (error) return error;

  const records = await prisma.reconciliationRecord.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  try {
    const record = await createReconciliationRecord(await request.json(), context.user.id, context.organization.id);
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
