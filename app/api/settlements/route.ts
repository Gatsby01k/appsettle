import { NextRequest, NextResponse } from "next/server";
import { createSettlement } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiContext } from "@/lib/api";

export async function GET() {
  const { context, error } = await requireApiContext();
  if (error) return error;

  const settlements = await prisma.settlement.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { quote: true, events: { orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json({ data: settlements });
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  try {
    const settlement = await createSettlement(await request.json(), context.user.id, context.organization.id);
    return NextResponse.json({ data: settlement }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
