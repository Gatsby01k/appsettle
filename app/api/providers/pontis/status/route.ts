import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getPayoutStatus, isPontisConfigured, loginOrThrow } from "@/lib/providers/pontis/client";
import { payoutStatusRequestSchema } from "@/lib/providers/pontis/schema";

export const runtime = "nodejs";

/**
 * GET  /api/providers/pontis/status?transaction_id=...
 * POST /api/providers/pontis/status  { "transaction_id": "..." }
 *
 * Reads the live status for a transaction. Logs in server-side, then queries
 * getPayoutStatus. Read-only; gated to non-production (or PONTIS_SANDBOX_TEST).
 */
export async function GET(request: NextRequest) {
  const gate = devOnlyGuard();
  if (gate) return gate;

  const transactionId = request.nextUrl.searchParams.get("transaction_id") ?? "";
  return handle(transactionId);
}

export async function POST(request: NextRequest) {
  const gate = devOnlyGuard();
  if (gate) return gate;

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }
  const transactionId =
    (rawBody as { transaction_id?: unknown })?.transaction_id?.toString?.() ?? "";
  return handle(transactionId);
}

async function handle(transactionId: string) {
  if (!isPontisConfigured()) {
    return NextResponse.json({ error: "PontisGlobe is not configured." }, { status: 503 });
  }

  try {
    const { transaction_id } = payoutStatusRequestSchema.parse({ transaction_id: transactionId });
    const jwt = await loginOrThrow();
    const result = await getPayoutStatus(transaction_id, jwt);

    if (!result.ok) {
      return NextResponse.json(
        { error: "PontisGlobe could not return the payout status.", data: result.data },
        { status: result.status },
      );
    }

    return NextResponse.json({ data: result.data });
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
