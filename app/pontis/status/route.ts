import { NextRequest, NextResponse } from "next/server";
import {
  getPayoutStatus,
  isPontisConfigured,
  loginOrThrow,
} from "@/lib/providers/pontis/client";
import {
  GATEWAY_SECRET_HEADER,
  type GatewayResponseBody,
  verifyGatewaySecret,
} from "@/lib/providers/pontis/gateway";
import { payoutStatusRequestSchema } from "@/lib/providers/pontis/schema";

export const runtime = "nodejs";

/**
 * POST /pontis/status  (VPS gateway endpoint)
 *
 * Runs on the whitelisted VPS static IP. Authenticates the shared gateway
 * secret, logs in to Pontis, reads the live payout status for a transaction, and
 * returns a normalised result to the Vercel app.
 */
export async function POST(request: NextRequest) {
  if (!verifyGatewaySecret(request.headers.get(GATEWAY_SECRET_HEADER))) {
    return NextResponse.json<GatewayResponseBody>({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!isPontisConfigured()) {
    return NextResponse.json<GatewayResponseBody>(
      { ok: false, error: "PontisGlobe is not configured on the gateway." },
      { status: 503 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json<GatewayResponseBody>({ ok: false, error: "Malformed request body." }, { status: 400 });
  }

  const parsed = payoutStatusRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json<GatewayResponseBody>(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status request." },
      { status: 400 },
    );
  }

  try {
    const jwt = await loginOrThrow();
    const result = await getPayoutStatus(parsed.data.transaction_id, jwt);
    const payout = result.data?.data ?? null;

    return NextResponse.json<GatewayResponseBody>(
      {
        ok: result.ok,
        transaction_id: parsed.data.transaction_id,
        status: payout?.status ?? null,
        status_message: payout?.status_message ?? null,
        provider_response: result.data,
        error: result.ok ? null : `PontisGlobe could not return the status (HTTP ${result.status}).`,
      },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json<GatewayResponseBody>(
      { ok: false, error: error instanceof Error ? error.message : "Gateway error." },
      { status: 502 },
    );
  }
}
