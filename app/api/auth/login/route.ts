import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { take: 1 } },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash)) || !user.memberships[0]) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const membership = user.memberships[0];
  await createSession(user.id, membership.organizationId);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({
    action: "auth.login",
    resourceType: "user",
    resourceId: user.id,
    organizationId: membership.organizationId,
    userId: user.id,
  });

  return NextResponse.json({ ok: true });
}
