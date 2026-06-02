import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { friendlyErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function requireApiContext() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      organizationId: session.organizationId,
    },
    include: { user: true, organization: true },
  });

  if (!membership) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) as NextResponse };
  }

  return {
    context: {
      user: membership.user,
      organization: membership.organization,
      membership,
    },
  };
}

export function jsonError(error: unknown) {
  return NextResponse.json({ error: friendlyErrorMessage(error) }, { status: 400 });
}
