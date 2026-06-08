import { NextRequest, NextResponse } from "next/server";
import { AuditActorType } from "@prisma/client";
import { jsonError, requireApiContext } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canManageSettings } from "@/lib/permissions";
import { isRemitQuicklyConfigured, setWebhookUrl } from "@/lib/providers/remitquickly/client";
import { setWebhookSchema } from "@/lib/providers/remitquickly/schema";

export const runtime = "nodejs";

/**
 * POST /api/providers/remitquickly/set-webhook
 *
 * Registers our webhook URL with RemitQuickly. The URL resolves in this order:
 *   1. `url` in the request body
 *   2. REMITQUICKLY_WEBHOOK_URL env var
 *   3. derived from the request origin (+ /api/providers/remitquickly/webhook)
 */
export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  if (!canManageSettings(context.membership.role)) {
    return NextResponse.json({ error: "You do not have permission to configure webhooks." }, { status: 403 });
  }

  if (!isRemitQuicklyConfigured()) {
    return NextResponse.json({ error: "RemitQuickly is not configured." }, { status: 503 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const input = setWebhookSchema.parse(body ?? {});
    const fallback = `${request.nextUrl.origin}/api/providers/remitquickly/webhook`;
    const webhookUrl = input.url ?? process.env.REMITQUICKLY_WEBHOOK_URL ?? fallback;

    const result = await setWebhookUrl(webhookUrl);

    await writeAuditLog({
      action: "remitquickly.webhook.set",
      resourceType: "provider",
      resourceId: "remitquickly",
      organizationId: context.organization.id,
      userId: context.user.id,
      actorType: AuditActorType.USER,
      after: { webhookUrl, status: result.status, ok: result.ok },
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "RemitQuickly rejected the webhook URL.", data: result.data },
        { status: result.status },
      );
    }

    return NextResponse.json({ data: { webhookUrl, response: result.data } });
  } catch (err) {
    return jsonError(err);
  }
}
