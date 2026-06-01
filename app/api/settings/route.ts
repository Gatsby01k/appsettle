import { NextRequest, NextResponse } from "next/server";
import { updateSettings } from "@/lib/domain";
import { canManageSettings } from "@/lib/permissions";
import { jsonError, requireApiContext } from "@/lib/api";

export async function GET() {
  const { context, error } = await requireApiContext();
  if (error) return error;
  return NextResponse.json({
    data: {
      organization: context.organization,
      role: context.membership.role,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  if (!canManageSettings(context.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await updateSettings(await request.json(), context.user.id, context.organization.id);
    return NextResponse.json({ data: settings });
  } catch (err) {
    return jsonError(err);
  }
}
