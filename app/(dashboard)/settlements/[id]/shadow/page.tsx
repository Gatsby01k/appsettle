import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AuditActorType, ProofReceivedVia } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { friendlyErrorMessage } from "@/lib/errors";
import { assessFinality } from "@/lib/finality";
import { buildFinalityInput } from "@/lib/finality-input";
import { recordProviderProof } from "@/lib/provider-proof";
import { canApproveSettlement, canWriteSettlement } from "@/lib/permissions";
import {
  MODE_DESCRIPTION,
  MODE_LABEL,
  SETTLEMENT_MODES,
  buildShadowChecklist,
  checklistComplete,
  getShadowConfig,
  inrLegOf,
  isSettlementMode,
  modeCap,
  modeChangeViolations,
  safetyFor,
  type SettlementMode,
} from "@/lib/shadow-mode";
import { buildLivePilotReadiness } from "@/lib/live-pilot";
import { cn, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ops/status-badge";
import { StatRow } from "@/components/ops/stat-row";
import { FlashMessage } from "@/components/ops/flash-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Shadow test console for one settlement.
 *
 * INRSettle never moves funds: in SHADOW/LIVE_TEST the partner/provider moves
 * money externally while this console controls the operational layer — mode,
 * readiness checklist, safety caps, manual provider proof entry, and the
 * finality decision. Live payouts stay disabled throughout (isTest unchanged).
 */

async function setMode(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  const settlementId = String(formData.get("settlementId") ?? "");
  const newMode = String(formData.get("mode") ?? "");

  if (!canApproveSettlement(membership.role)) {
    redirect(`/settlements/${settlementId}/shadow?error=${encodeURIComponent("Only approvers can change the settlement mode.")}`);
  }
  if (!isSettlementMode(newMode)) {
    redirect(`/settlements/${settlementId}/shadow?error=${encodeURIComponent("Unknown settlement mode.")}`);
  }

  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId: organization.id },
    include: { providerProofs: true, reconciliation: true, events: true },
  });
  if (!settlement) {
    redirect(`/settlements?error=${encodeURIComponent("Settlement was not found.")}`);
  }

  const config = getShadowConfig();
  const checklist = buildShadowChecklist(
    settlement,
    settlement.providerProofs,
    settlement.reconciliation,
    settlement.events,
    config,
  );
  const violations = modeChangeViolations(settlement, newMode as SettlementMode, checklist, config);
  if (violations.length > 0) {
    redirect(
      `/settlements/${settlementId}/shadow?error=${encodeURIComponent(`Cannot switch to ${MODE_LABEL[newMode as SettlementMode]}: ${violations.join(" ")}`)}`,
    );
  }

  const previousMode = settlement.testMode;
  await prisma.settlement.update({
    where: { id: settlement.id },
    data: { testMode: newMode as SettlementMode },
  });

  await writeAuditLog({
    action: "settlement.testMode_changed",
    resourceType: "settlement",
    resourceId: settlement.id,
    organizationId: organization.id,
    userId: user.id,
    actorType: AuditActorType.USER,
    before: { publicId: settlement.publicId, testMode: previousMode },
    after: { publicId: settlement.publicId, testMode: newMode, inrLeg: inrLegOf(settlement) },
  });

  revalidatePath(`/settlements/${settlementId}/shadow`);
  revalidatePath("/settlements");
  redirect(`/settlements/${settlementId}/shadow?success=mode`);
}

async function recordManualProof(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  const settlementId = String(formData.get("settlementId") ?? "");

  if (!canWriteSettlement(membership.role)) {
    redirect(`/settlements/${settlementId}/shadow?error=${encodeURIComponent("Your role cannot record provider proof.")}`);
  }

  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId: organization.id },
  });
  if (!settlement) {
    redirect(`/settlements?error=${encodeURIComponent("Settlement was not found.")}`);
  }

  const providerStatus = String(formData.get("providerStatus") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim() || settlement.provider || "external_partner";
  const transactionId = String(formData.get("transactionId") ?? "").trim() || null;
  const utr = String(formData.get("utr") ?? "").trim() || null;
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  try {
    if (!providerStatus) throw new Error("Provider status is required.");
    if (amountRaw && (!Number.isFinite(amount) || (amount as number) <= 0)) {
      throw new Error("Reported amount must be a positive number.");
    }

    await recordProviderProof({
      settlementId: settlement.id,
      organizationId: organization.id,
      userId: user.id,
      provider,
      providerTransactionId: transactionId,
      utr,
      providerStatus,
      actualAmount: amount,
      currency: amount != null ? "INR" : null,
      rawResponse: { enteredBy: user.email, note, manualEntry: true },
      receivedVia: ProofReceivedVia.MANUAL,
      actorType: AuditActorType.USER,
    });
  } catch (error) {
    redirect(`/settlements/${settlementId}/shadow?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }

  revalidatePath(`/settlements/${settlementId}/shadow`);
  redirect(`/settlements/${settlementId}/shadow?success=proof`);
}

/**
 * Dual-control foundation: an EXPLICIT finality approval, recorded in the
 * append-only audit trail, by an approver-role user who is NOT the settlement
 * creator. Limitations (by design, smallest safe foundation): approval is the
 * presence of an audit entry — there is no revocation workflow or second-channel
 * confirmation yet, and in a single-user organization the dual-control item can
 * never pass.
 */
async function approveFinality(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  const settlementId = String(formData.get("settlementId") ?? "");

  if (!canApproveSettlement(membership.role)) {
    redirect(`/settlements/${settlementId}/shadow?error=${encodeURIComponent("Only approvers can approve finality.")}`);
  }

  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId: organization.id },
  });
  if (!settlement) {
    redirect(`/settlements?error=${encodeURIComponent("Settlement was not found.")}`);
  }

  if (settlement.createdById === user.id) {
    redirect(
      `/settlements/${settlementId}/shadow?error=${encodeURIComponent(
        "Dual control: the settlement creator cannot approve finality — a different operator must approve.",
      )}`,
    );
  }

  const existing = await prisma.auditLog.findFirst({
    where: {
      organizationId: organization.id,
      action: "settlement.finality_approved",
      resourceType: "settlement",
      resourceId: settlement.id,
    },
  });
  if (existing) {
    redirect(`/settlements/${settlementId}/shadow?success=finality_approved`);
  }

  await writeAuditLog({
    action: "settlement.finality_approved",
    resourceType: "settlement",
    resourceId: settlement.id,
    organizationId: organization.id,
    userId: user.id,
    actorType: AuditActorType.USER,
    after: {
      publicId: settlement.publicId,
      approvedBy: user.email,
      createdById: settlement.createdById,
      dualControl: true,
    },
  });

  revalidatePath(`/settlements/${settlementId}/shadow`);
  redirect(`/settlements/${settlementId}/shadow?success=finality_approved`);
}

export default async function ShadowConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const { id } = await params;
  const query = await searchParams;

  const settlement = await prisma.settlement.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      providerProofs: { orderBy: { receivedAt: "desc" } },
      // No nested orderBy on this relation: combined with take it triggers a
      // Prisma 7 + @prisma/adapter-pg bug (Postgres 42809) — sorted in JS below.
      reconciliation: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!settlement) notFound();

  const reconciliationRecords = [...settlement.reconciliation].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const config = getShadowConfig();
  const isLiveTest = settlement.testMode === "LIVE_TEST";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [finalityApproval, reportGeneratedLog, todaysLiveTests] = await Promise.all([
    prisma.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        action: "settlement.finality_approved",
        resourceType: "settlement",
        resourceId: settlement.id,
      },
    }),
    prisma.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        action: "settlement.report_generated",
        resourceType: "settlement",
        resourceId: settlement.id,
      },
    }),
    isLiveTest
      ? prisma.settlement.findMany({
          where: {
            organizationId: organization.id,
            testMode: "LIVE_TEST",
            id: { not: settlement.id },
            createdAt: { gte: startOfToday },
            status: { notIn: ["FAILED", "CANCELLED"] },
          },
          select: {
            publicId: true,
            status: true,
            sourceCurrency: true,
            targetCurrency: true,
            sourceAmount: true,
            targetAmount: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const dailyUsedInrExcludingThis = todaysLiveTests.reduce((sum, row) => sum + inrLegOf(row), 0);

  const safety = {
    ...safetyFor(settlement, config),
    ...(isLiveTest
      ? {
          withinDailyCap:
            dailyUsedInrExcludingThis + inrLegOf(settlement) <= config.liveTestDailyMaxInr,
          dailyCapLabel: `INR ${config.liveTestDailyMaxInr.toLocaleString("en-IN")}`,
        }
      : {}),
  };
  const checklist = buildShadowChecklist(
    settlement,
    settlement.providerProofs,
    reconciliationRecords,
    settlement.events,
    config,
  );
  const complete = checklistComplete(checklist);
  const mode = (settlement.testMode in MODE_LABEL ? settlement.testMode : "DEMO") as SettlementMode;
  const assessment = assessFinality(
    buildFinalityInput(
      settlement,
      settlement.providerProofs,
      reconciliationRecords,
      settlement.events,
      safety,
    ),
  );
  const canChangeMode = canApproveSettlement(membership.role);
  const canRecordProof = canWriteSettlement(membership.role);

  const pilot = isLiveTest
    ? buildLivePilotReadiness(
        settlement,
        settlement.providerProofs,
        reconciliationRecords,
        settlement.events,
        {
          finalityApprovedById: finalityApproval?.userId ?? null,
          createdById: settlement.createdById,
          reportGenerated: Boolean(reportGeneratedLog),
          dailyUsedInrExcludingThis,
        },
        config,
        assessment.decision,
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/settlements" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Settlements
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/settlements/${settlement.id}/report`}>Settlement report</Link>
        </Button>
      </div>

      {query.error ? <FlashMessage message={query.error} tone="error" /> : null}
      {query.success === "mode" ? <FlashMessage message="Settlement mode updated (audit-logged)." /> : null}
      {query.success === "proof" ? (
        <FlashMessage message="Manual provider proof recorded — it is now part of the finality evidence." />
      ) : null}
      {query.success === "finality_approved" ? (
        <FlashMessage message="Finality approval recorded (dual-control, audit-logged)." />
      ) : null}

      <div className="ops-panel space-y-5 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ops-line-soft)] pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Shadow test console
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">{settlement.publicId}</h1>
            <p className="text-sm text-slate-500">{settlement.reference}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={settlement.status} />
            <span className="text-xs text-slate-500">{settlement.corridor.replace("_", " → ")}</span>
          </div>
        </div>

        {/* Money movement statement */}
        <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p className="text-sm text-indigo-900">
            <span className="font-semibold">INRSettle does not move funds.</span> In shadow and live-test modes the
            external partner/provider moves the money; INRSettle records and controls the operational layer. Live
            payouts remain disabled.
          </p>
        </div>

        {/* Mode */}
        <div className="rounded-xl border border-[var(--ops-line)] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Mode</p>
          <StatRow label="Current mode" value={`${MODE_LABEL[mode]} — ${MODE_DESCRIPTION[mode]}`} />
          <StatRow
            label="INR leg"
            value={`${formatCurrencyFull(String(inrLegOf(settlement)), "INR")}${
              modeCap(mode, config) !== null
                ? ` · cap ${formatCurrencyFull(String(modeCap(mode, config)), "INR")} (${safety.withinCap ? "within" : "EXCEEDED"})`
                : ""
            }`}
          />
          <StatRow label="Live payouts" value={safety.livePayoutsDisabled ? "Disabled" : "ENABLED — must be off"} />
          {canChangeMode ? (
            <form action={setMode} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="settlementId" value={settlement.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="mode">Switch mode</Label>
                <select
                  id="mode"
                  name="mode"
                  defaultValue={mode}
                  className="h-9 rounded-md border border-[var(--ops-line)] bg-white px-2 text-sm text-slate-900"
                >
                  {SETTLEMENT_MODES.map((value) => (
                    <option key={value} value={value}>
                      {MODE_LABEL[value]}
                      {value === "SHADOW" ? ` (cap ${config.shadowMaxInr.toLocaleString("en-IN")} INR)` : ""}
                      {value === "LIVE_TEST" ? ` (cap ${config.liveTestMaxInr.toLocaleString("en-IN")} INR)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton variant="outline" size="sm" pendingText="Switching...">
                Apply mode
              </SubmitButton>
              <p className="basis-full text-xs text-slate-400">
                Live test requires the full checklist and the tighter cap — there is no override.
              </p>
            </form>
          ) : (
            <p className="mt-2 text-xs text-slate-400">Only approvers can change the settlement mode.</p>
          )}
        </div>

        {/* Checklist */}
        <div className="rounded-xl border border-[var(--ops-line)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Shadow test readiness checklist
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
              )}
            >
              {checklist.filter((item) => item.done).length}/{checklist.length} ready
            </span>
          </div>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                  )}
                >
                  {item.done ? "✓" : "•"}
                </span>
                <div>
                  <span className={item.done ? "text-slate-700" : "font-medium text-slate-900"}>{item.label}</span>
                  <span className="block text-xs text-slate-400">{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live pilot readiness (LIVE_TEST only) */}
        {pilot ? (
          <div className="rounded-xl border border-red-200 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Live pilot readiness — LIVE_TEST
              </p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                  pilot.decision === "ready" && "bg-emerald-100 text-emerald-800",
                  pilot.decision === "needs_review" && "bg-amber-100 text-amber-800",
                  pilot.decision === "blocked" && "bg-red-100 text-red-800",
                )}
              >
                {pilot.decision === "ready"
                  ? "Ready"
                  : pilot.decision === "needs_review"
                    ? "Needs review"
                    : "Blocked"}
              </span>
            </div>
            <div className="space-y-2">
              {pilot.items.map((item) => (
                <div key={item.key} className="flex items-start gap-2 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      item.done
                        ? "bg-emerald-100 text-emerald-700"
                        : item.blocking
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {item.done ? "✓" : item.blocking ? "✕" : "•"}
                  </span>
                  <div>
                    <span className={item.done ? "text-slate-700" : "font-medium text-slate-900"}>
                      {item.label}
                      {item.blocking ? (
                        <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                          guardrail
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-slate-400">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            {canChangeMode ? (
              finalityApproval ? (
                <p className="mt-3 text-xs text-slate-500">
                  Finality approval recorded {formatDateTime(finalityApproval.createdAt)} (audit-logged).
                </p>
              ) : (
                <form action={approveFinality} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="settlementId" value={settlement.id} />
                  <SubmitButton variant="primary" size="sm" pendingText="Approving...">
                    Approve finality (dual-control)
                  </SubmitButton>
                  <p className="text-xs text-slate-400">
                    Must be a different operator than the settlement creator.
                  </p>
                </form>
              )
            ) : null}
          </div>
        ) : null}

        {/* Manual proof entry */}
        <div className="rounded-xl border border-[var(--ops-line)] p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Record provider proof manually
          </p>
          <p className="mb-3 text-xs text-slate-500">
            For shadow tests the partner/provider confirms the payout out-of-band (statement, portal, email). Record
            exactly what the provider reported — never the expected values.
          </p>
          {canRecordProof ? (
            <form action={recordManualProof} className="grid gap-2.5 sm:grid-cols-2">
              <input type="hidden" name="settlementId" value={settlement.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" name="provider" placeholder={settlement.provider ?? "external_partner"} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="providerStatus">Provider status *</Label>
                <select
                  id="providerStatus"
                  name="providerStatus"
                  required
                  defaultValue="completed"
                  className="h-9 rounded-md border border-[var(--ops-line)] bg-white px-2 text-sm text-slate-900"
                >
                  <option value="completed">completed</option>
                  <option value="processing">processing</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="transactionId">Provider transaction ID</Label>
                <Input id="transactionId" name="transactionId" placeholder="e.g. TXN-12345" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="utr">UTR / bank reference</Label>
                <Input id="utr" name="utr" placeholder="e.g. UTR2606..." />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Reported amount (INR)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="As reported by the provider" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="note">Note</Label>
                <Input id="note" name="note" placeholder="e.g. Confirmed via partner portal" />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton variant="primary" size="sm" pendingText="Recording...">
                  Record proof (manual)
                </SubmitButton>
              </div>
            </form>
          ) : (
            <p className="text-xs text-slate-400">Your role cannot record provider proof.</p>
          )}

          {settlement.providerProofs.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Proof on file</p>
              {settlement.providerProofs.map((proof) => (
                <div key={proof.id} className="rounded-lg border border-[var(--ops-line-soft)] px-3 py-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-900">{proof.provider}</span> · {proof.providerStatus} · via{" "}
                  {proof.receivedVia.toLowerCase()}
                  {proof.utr ? ` · UTR ${proof.utr}` : ""}
                  {proof.actualAmount != null && proof.currency
                    ? ` · ${formatCurrencyFull(proof.actualAmount.toString(), proof.currency)}`
                    : ""}
                  <span className="text-slate-400"> · {formatDateTime(proof.receivedAt)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Reconciliation pointer */}
        <div className="rounded-xl border border-[var(--ops-line)] p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Independent reconciliation
          </p>
          {settlement.reconciliation.length > 0 ? (
            <p className="text-sm text-slate-600">
              {settlement.reconciliation.length} record(s) linked. Manage matching on the{" "}
              <Link href="/reconciliation" className="font-medium text-slate-900 underline underline-offset-2">
                Reconciliation page
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              No record linked yet. Ingest the bank statement / PSP report (or add a manual operator record) on the{" "}
              <Link href="/reconciliation" className="font-medium text-slate-900 underline underline-offset-2">
                Reconciliation page
              </Link>{" "}
              — provider claims never count as independent evidence.
            </p>
          )}
        </div>

        {/* Finality summary */}
        <div
          className={cn(
            "rounded-xl border p-4",
            assessment.decision === "ready_to_finalize" && "border-emerald-200 bg-emerald-50",
            assessment.decision === "needs_review" && "border-amber-200 bg-amber-50",
            assessment.decision === "not_ready" && "border-slate-200 bg-slate-50",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Finality:{" "}
              {assessment.decision === "ready_to_finalize"
                ? "Ready to finalize"
                : assessment.decision === "needs_review"
                  ? "Needs review"
                  : "Not ready"}
            </p>
            <span className="text-xs text-slate-500">
              {assessment.riskLevel} risk · {assessment.confidence}% confidence
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">{assessment.summary}</p>
          <div className="mt-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/settlements/${settlement.id}/report`}>Open full settlement report</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
