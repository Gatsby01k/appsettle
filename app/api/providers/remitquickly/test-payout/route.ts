import { NextRequest, NextResponse } from "next/server";
import { AuditActorType } from "@prisma/client";
import { jsonError, requireApiContext } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import {
  extractPayoutId,
  getOrderStatus,
  isRemitQuicklyConfigured,
  simulatePayoutOutcome,
  submitImpsPayout,
  type ImpsPayoutRequest,
} from "@/lib/providers/remitquickly/client";
import { isPrivateBetaMode } from "@/lib/providers/remitquickly/flags";
import { executeApprovedSettlement } from "@/lib/providers/remitquickly/settlement";
import { testPayoutSchema } from "@/lib/providers/remitquickly/schema";

export const runtime = "nodejs";

const PROVIDER_RESOURCE = "remitquickly";

/**
 * Sandbox-only test endpoint. Gated behind demo / private-beta mode so it can
 * never run from a public production build.
 *
 * - Without a settlementId: runs a self-contained connectivity smoke test
 *   (submit isTest payout -> simulate outcome -> read status). It does NOT touch
 *   any settlement, so it is safe to click repeatedly.
 * - With a settlementId: drives the real lifecycle (execute APPROVED settlement,
 *   then optionally simulate the chosen outcome).
 */
export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  if (!isRemitQuicklyConfigured()) {
    return NextResponse.json({ error: "RemitQuickly is not configured." }, { status: 503 });
  }
  if (!isPrivateBetaMode()) {
    return NextResponse.json({ error: "Sandbox testing is disabled in this environment." }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const input = testPayoutSchema.parse(body ?? {});

    if (input.settlementId) {
      const result = await executeApprovedSettlement(
        input.settlementId,
        context.user.id,
        context.organization.id,
        { overrides: input.overrides, simulateOutcome: input.outcome },
      );
      return NextResponse.json({ testMode: "settlement", data: result });
    }

    // Connectivity smoke test — no settlement is created or mutated.
    const merchantRecognitionId = `SANDBOX-TEST-${Date.now()}`;
    const payoutRequest: ImpsPayoutRequest = {
      merchantRecognitionId,
      acc_id: input.overrides?.acc_id ?? "9876543210",
      name: input.overrides?.name ?? "Test Beneficiary",
      bank_name: input.overrides?.bank_name ?? "HDFC Bank",
      ifsc: input.overrides?.ifsc ?? "HDFC0001234",
      acc_type: input.overrides?.acc_type ?? "savings",
      amount: input.overrides?.amount ?? 101,
      mobile: input.overrides?.mobile ?? "9999999999",
      quote_id: input.overrides?.quote_id ?? Number(process.env.REMITQUICKLY_DEFAULT_QUOTE_ID ?? 1),
      email: input.overrides?.email,
      mobile_code: "+91",
      remarks: "INRSettle sandbox connectivity test",
      isTest: true,
    };

    const submit = await submitImpsPayout(payoutRequest);
    const payoutId = extractPayoutId(submit.data);

    const simulate = payoutId != null ? await simulatePayoutOutcome(payoutId, input.outcome) : null;
    const status =
      payoutId != null
        ? await getOrderStatus({ searchBy: "payout_id", searchValue: String(payoutId) })
        : null;

    await writeAuditLog({
      action: "remitquickly.sandbox_test",
      resourceType: "provider",
      resourceId: PROVIDER_RESOURCE,
      organizationId: context.organization.id,
      userId: context.user.id,
      actorType: AuditActorType.USER,
      after: { merchantRecognitionId, payoutId, outcome: input.outcome, submitStatus: submit.status },
    });

    return NextResponse.json({
      testMode: "connectivity",
      data: {
        merchantRecognitionId,
        payoutId,
        submit: { status: submit.status, ok: submit.ok, body: submit.data },
        simulate: simulate ? { status: simulate.status, ok: simulate.ok, body: simulate.data } : null,
        status: status ? { status: status.status, ok: status.ok, body: status.data } : null,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
