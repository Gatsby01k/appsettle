import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  getPayoutStatus,
  isPontisConfigured,
  loginOrThrow,
  sendPayoutRequest,
  type PontisPayoutRequest,
} from "@/lib/providers/pontis/client";
import { testPayoutOverridesSchema } from "@/lib/providers/pontis/schema";

export const runtime = "nodejs";

/**
 * POST /api/providers/pontis/test-payout
 *
 * Dev-only sandbox smoke test: logs in, submits the documented INR sandbox
 * payout, then (by default) polls getPayoutStatus once so the full round trip is
 * visible. Body fields are optional overrides — without them the documented
 * defaults are used.
 *
 * Sandbox trigger codes live in the trailing cents of source_amount:
 *   .00 -> completed   .01 -> insufficient funds   .02 -> account not found
 *   .03 -> stays pending   .04 -> provider declined
 */
export async function POST(request: NextRequest) {
  const gate = devOnlyGuard();
  if (gate) return gate;

  if (!isPontisConfigured()) {
    return NextResponse.json({ error: "PontisGlobe is not configured." }, { status: 503 });
  }

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  try {
    const overrides = testPayoutOverridesSchema.parse(rawBody ?? {});

    const payout: PontisPayoutRequest = {
      idempotency_key: overrides.idempotency_key ?? crypto.randomUUID(),
      country_code: overrides.country_code ?? "IN",
      currency_code: overrides.currency_code ?? "INR",
      payment_method: overrides.payment_method ?? "bank_local",
      source_amount: overrides.source_amount ?? "10.00",
      source_currency: overrides.source_currency ?? "USDT",
      recipient_details: {
        name: overrides.recipient_details?.name ?? "Test Beneficiary",
        account_number: overrides.recipient_details?.account_number ?? "1234567890",
        ifsc: overrides.recipient_details?.ifsc ?? "HDFC0001234",
        ...overrides.recipient_details,
      },
    };

    const jwt = await loginOrThrow();
    const submit = await sendPayoutRequest(payout, jwt);
    const transactionId = submit.data?.data?.transaction_id ?? null;

    const shouldPoll = overrides.pollStatus !== false;
    const status =
      shouldPoll && transactionId ? await getPayoutStatus(transactionId, jwt) : null;

    return NextResponse.json({
      mode: "sandbox-connectivity",
      data: {
        idempotencyKey: payout.idempotency_key,
        transactionId,
        submit: { status: submit.status, ok: submit.ok, body: submit.data },
        status: status ? { status: status.status, ok: status.ok, body: status.data } : null,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

function devOnlyGuard(): NextResponse | null {
  const enabled =
    process.env.NODE_ENV !== "production" || process.env.PONTIS_SANDBOX_TEST === "true";
  if (!enabled) {
    return NextResponse.json(
      { error: "PontisGlobe test routes are disabled in this environment." },
      { status: 403 },
    );
  }
  return null;
}
