import { NextRequest, NextResponse } from "next/server";
import {
  isPontisConfigured,
  loginOrThrow,
  sendPayoutRequest,
} from "@/lib/providers/pontis/client";
import {
  GATEWAY_SECRET_HEADER,
  type GatewayResponseBody,
  verifyGatewaySecret,
} from "@/lib/providers/pontis/gateway";
import { payoutRequestSchema } from "@/lib/providers/pontis/schema";

export const runtime = "nodejs";

/**
 * POST /pontis/payout  (VPS gateway endpoint)
 *
 * Runs on the whitelisted VPS static IP — the only place the PontisGlobe API
 * keys live. The Vercel app calls this endpoint (instead of Pontis directly)
 * with the shared `x-inrsettle-gateway-secret`. We authenticate the secret, log
 * in to Pontis, submit the payout, and return a normalised result.
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

  const parsed = payoutRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json<GatewayResponseBody>(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payout request." },
      { status: 400 },
    );
  }

  try {
    const jwt = await loginOrThrow();
    const result = await sendPayoutRequest(parsed.data, jwt);
    const payout = result.data?.data ?? null;

    return NextResponse.json<GatewayResponseBody>(
      {
        ok: result.ok && Boolean(payout?.transaction_id),
        transaction_id: payout?.transaction_id ?? null,
        status: payout?.status ?? null,
        status_message: payout?.status_message ?? null,
        provider_response: result.data,
        error: result.ok
          ? null
          : ((result.data?.error as { message?: string })?.message ??
            `PontisGlobe rejected the payout (HTTP ${result.status}).`),
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
