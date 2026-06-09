import { NextRequest, NextResponse } from "next/server";
import { isPontisConfigured, verifyWebhookSignature } from "@/lib/providers/pontis/client";
import { webhookPayloadSchema } from "@/lib/providers/pontis/schema";
import { resolvePayoutByTransaction } from "@/lib/providers/pontis/settlement";

export const runtime = "nodejs";

/**
 * POST /api/providers/pontis/webhook
 *
 * Public endpoint PontisGlobe calls when a LIVE transaction reaches a final
 * state. (Sandbox transactions never call back — this is here for parity and
 * for the live cutover.)
 *
 * Auth is an HMAC-SHA256 signature over `"${timestamp}.${rawBody}"`, delivered
 * as `x-pontis-signature: sha256=<hex>` with `x-pontis-timestamp`. The signature
 * MUST be verified against the EXACT raw bytes — never a re-serialised object.
 *
 * Always responds 2xx for authentic, processed (and duplicate) deliveries; the
 * provider does not retry, so we acknowledge and fall back to polling on misses.
 *
 * Docs: https://docs.pontisglobe.com/callbacks
 */

/**
 * In-memory de-dup of recently seen event ids. Best-effort only (per server
 * instance); pair with a durable store before relying on it in production.
 */
const seenEventIds = new Set<string>();
const SEEN_EVENT_LIMIT = 1000;

export async function POST(request: NextRequest) {
  if (!isPontisConfigured()) {
    return NextResponse.json({ error: "PontisGlobe is not configured." }, { status: 503 });
  }

  // Read the raw body exactly as received — required for signature verification.
  const rawBody = await request.text().catch(() => "");

  const timestamp = request.headers.get("x-pontis-timestamp") ?? "";
  const signature = request.headers.get("x-pontis-signature") ?? "";
  const eventId = request.headers.get("x-pontis-event-id") ?? "";

  if (!timestamp || !signature) {
    return NextResponse.json({ error: "Missing webhook signature headers." }, { status: 400 });
  }

  if (!verifyWebhookSignature(timestamp, signature, rawBody)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  // Duplicate delivery — acknowledge silently with 2xx.
  if (eventId && seenEventIds.has(eventId)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  let parsed: ReturnType<typeof webhookPayloadSchema.safeParse>;
  try {
    parsed = webhookPayloadSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Malformed webhook payload." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: "Unexpected webhook payload." }, { status: 400 });
  }

  if (eventId) rememberEventId(eventId);

  const { transaction_id, status, status_message } = parsed.data;

  // Map the provider transaction back to its settlement and apply the outcome
  // (EXECUTING -> SETTLED / FAILED). Idempotent: re-deliveries / already-resolved
  // settlements are safely ignored. We still acknowledge with 2xx regardless so
  // the provider marks delivery successful and does not retry.
  let resolution = null;
  try {
    resolution = await resolvePayoutByTransaction(transaction_id, status, status_message ?? null);
  } catch (error) {
    console.error("[pontis.webhook] failed to resolve settlement:", error);
  }

  return NextResponse.json({
    received: true,
    handled: resolution !== null,
    transaction_id,
    status,
    status_message: status_message ?? null,
  });
}

function rememberEventId(eventId: string) {
  if (seenEventIds.size >= SEEN_EVENT_LIMIT) {
    const oldest = seenEventIds.values().next().value;
    if (oldest !== undefined) seenEventIds.delete(oldest);
  }
  seenEventIds.add(eventId);
}
