// Shadow test testMode: caps, safety checks, and the readiness checklist for
// SHADOW / LIVE_TEST settlements.
//
// Core principle: INRSettle NEVER moves funds directly. In SHADOW and
// LIVE_TEST modes a partner/provider moves money externally while INRSettle
// records and controls the operational layer (quote → settlement → provider
// proof → independent reconciliation → audit trail → finality → report).
//
// Everything here is deterministic and takes config/data as parameters so it
// can be unit-tested; only `getShadowConfig` / `isLivePayoutDisabled` read the
// environment.

import { isIndependentReconciliationSource } from "@/lib/reconciliation";
import { hasAuditApproval, type EventLike, type NumberLike } from "@/lib/finality-input";
import type { FinalitySafetyInput } from "@/lib/finality";

export type SettlementMode = "DEMO" | "SHADOW" | "LIVE_TEST";

export const SETTLEMENT_MODES: SettlementMode[] = ["DEMO", "SHADOW", "LIVE_TEST"];

export const MODE_LABEL: Record<SettlementMode, string> = {
  DEMO: "Demo",
  SHADOW: "Shadow",
  LIVE_TEST: "Live test",
};

export const MODE_DESCRIPTION: Record<SettlementMode, string> = {
  DEMO: "Fake/demo data — no real-world money anywhere.",
  SHADOW: "Real-world operation tracked by INRSettle. Money moves externally via a partner/provider; INRSettle does not move funds.",
  LIVE_TEST: "Tiny, capped, manually guarded provider test. INRSettle does not move funds directly.",
};

export type ShadowConfig = {
  /** Maximum INR leg for a SHADOW settlement. */
  shadowMaxInr: number;
  /** Maximum INR leg for a LIVE_TEST settlement (tighter than shadow). */
  liveTestMaxInr: number;
  /** Manual proof entry must be available/required for shadow tests. */
  requireManualProof: boolean;
  /** Independent reconciliation is required for shadow finality. */
  requireIndependentReconciliation: boolean;
  /**
   * True only if someone explicitly sets LIVE_PAYOUTS_ENABLED=true. Nothing in
   * the codebase sets it; finality BLOCKS shadow/live-test settlements when it
   * is on, as an extra tripwire.
   */
  livePayoutsEnabled: boolean;
};

export const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  shadowMaxInr: 10_000,
  liveTestMaxInr: 1_000,
  requireManualProof: true,
  requireIndependentReconciliation: true,
  livePayoutsEnabled: false,
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Reads the shadow-test configuration from the environment (with safe defaults). */
export function getShadowConfig(): ShadowConfig {
  return {
    shadowMaxInr: envNumber("SHADOW_MAX_INR", DEFAULT_SHADOW_CONFIG.shadowMaxInr),
    liveTestMaxInr: envNumber("LIVE_TEST_MAX_INR", DEFAULT_SHADOW_CONFIG.liveTestMaxInr),
    requireManualProof: true,
    requireIndependentReconciliation: true,
    livePayoutsEnabled: process.env.LIVE_PAYOUTS_ENABLED === "true",
  };
}

// --- Settlement shapes (framework-free) ------------------------------------------

export type ShadowSettlementLike = {
  publicId: string;
  status: string;
  testMode?: string | null;
  provider?: string | null;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: NumberLike;
  targetAmount: NumberLike;
  sourceAccount?: string | null;
  targetAccount?: string | null;
  approvedAt?: Date | string | null;
};

export type ShadowProofLike = { receivedVia: string };
export type ShadowReconciliationLike = { status: string; source: string };

function toNumber(value: NumberLike): number {
  return typeof value === "number" ? value : Number(value.toString());
}

/** The INR leg of a settlement — the amount the safety caps apply to. */
export function inrLegOf(settlement: ShadowSettlementLike): number {
  if (settlement.sourceCurrency === "INR") return toNumber(settlement.sourceAmount);
  if (settlement.targetCurrency === "INR") return toNumber(settlement.targetAmount);
  return 0;
}

/** The applicable cap for a mode, or null when the mode is uncapped (DEMO). */
export function modeCap(mode: string | null | undefined, config: ShadowConfig): number | null {
  if (mode === "SHADOW") return config.shadowMaxInr;
  if (mode === "LIVE_TEST") return config.liveTestMaxInr;
  return null;
}

export function isWithinCap(settlement: ShadowSettlementLike, config: ShadowConfig): boolean {
  const cap = modeCap(settlement.testMode, config);
  if (cap === null) return true;
  return inrLegOf(settlement) <= cap;
}

/** The safety block passed into the finality engine for SHADOW/LIVE_TEST settlements. */
export function safetyFor(settlement: ShadowSettlementLike, config: ShadowConfig): FinalitySafetyInput {
  const cap = modeCap(settlement.testMode, config);
  return {
    withinCap: isWithinCap(settlement, config),
    capLabel: cap !== null ? `INR ${cap.toLocaleString("en-IN")}` : "uncapped",
    livePayoutsDisabled: !config.livePayoutsEnabled,
  };
}

// --- Readiness checklist -----------------------------------------------------------

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  detail: string;
};

/**
 * The shadow-test readiness checklist. Every item is derived deterministically
 * from persisted data + config — nothing is self-attested without evidence.
 */
export function buildShadowChecklist(
  settlement: ShadowSettlementLike,
  proofs: ShadowProofLike[],
  reconciliationRecords: ShadowReconciliationLike[],
  events: EventLike[],
  config: ShadowConfig,
): ChecklistItem[] {
  const inrLeg = inrLegOf(settlement);
  const cap = modeCap(settlement.testMode, config);
  const independentLinked = reconciliationRecords.some((record) =>
    isIndependentReconciliationSource(record.source),
  );

  return [
    {
      key: "provider_selected",
      label: "Provider selected",
      done: Boolean(settlement.provider?.trim()),
      detail: settlement.provider?.trim()
        ? `Provider: ${settlement.provider}`
        : "Assign the partner/provider that moves the money externally.",
    },
    {
      key: "proof_capture",
      label: "Provider proof captured",
      done: proofs.length > 0,
      detail:
        proofs.length > 0
          ? `${proofs.length} proof record(s) on file (manual entry available).`
          : "Record at least one provider proof — manual entry is available on this console.",
    },
    {
      key: "beneficiary_verified",
      label: "Beneficiary details recorded",
      done: Boolean(settlement.targetAccount && settlement.targetAccount.trim().length >= 3),
      detail: settlement.targetAccount?.trim()
        ? `Target account: ${settlement.targetAccount}. Verify against partner records before any live test.`
        : "Record the beneficiary/target account.",
    },
    {
      key: "expected_inr",
      label: "Expected INR amount entered",
      done: inrLeg > 0,
      detail:
        inrLeg > 0
          ? `Expected INR leg: ${inrLeg.toLocaleString("en-IN")}${cap !== null ? ` (cap ${cap.toLocaleString("en-IN")})` : ""}.`
          : "The settlement must carry a positive INR leg.",
    },
    {
      key: "operator_approval",
      label: "Operator approval recorded",
      done: hasAuditApproval(settlement, events),
      detail: hasAuditApproval(settlement, events)
        ? "Approval timestamp and APPROVED lifecycle event are both on file."
        : "Approve the settlement through the normal workflow (audit-logged).",
    },
    {
      key: "independent_recon",
      label: "Independent reconciliation source linked",
      done: independentLinked,
      detail: independentLinked
        ? "An independent-source record (bank statement / PSP report / operator) is linked."
        : "Link an independent record on the Reconciliation page — provider claims never count.",
    },
    {
      key: "live_payout_disabled",
      label: "Live payouts disabled",
      done: !config.livePayoutsEnabled,
      detail: config.livePayoutsEnabled
        ? "LIVE_PAYOUTS_ENABLED is set — turn it OFF before any shadow/live test."
        : "Live payouts are structurally off (sandbox isTest stays true; no live flag set).",
    },
    {
      key: "finality_report",
      label: "Finality report enabled",
      done: true,
      detail: "Deterministic finality review and the settlement report are available for this settlement.",
    },
  ];
}

export function checklistComplete(items: ChecklistItem[]): boolean {
  return items.every((item) => item.done);
}

// --- Mode transitions ---------------------------------------------------------------

export function isSettlementMode(value: string): value is SettlementMode {
  return (SETTLEMENT_MODES as string[]).includes(value);
}

/**
 * Guard for switching a settlement's mode. Returns the list of violations
 * (empty when allowed). LIVE_TEST cannot be entered over the cap or with an
 * incomplete checklist — there is deliberately no override path.
 */
export function modeChangeViolations(
  settlement: ShadowSettlementLike,
  newMode: SettlementMode,
  checklist: ChecklistItem[],
  config: ShadowConfig,
): string[] {
  const violations: string[] = [];

  if (newMode === "DEMO") return violations;

  if (config.livePayoutsEnabled) {
    violations.push("LIVE_PAYOUTS_ENABLED is set — shadow/live-test modes are blocked until it is off.");
  }

  const cap = newMode === "SHADOW" ? config.shadowMaxInr : config.liveTestMaxInr;
  const inrLeg = inrLegOf(settlement);
  if (inrLeg <= 0) {
    violations.push("The settlement has no positive INR leg.");
  } else if (inrLeg > cap) {
    violations.push(
      `INR leg ${inrLeg.toLocaleString("en-IN")} exceeds the ${MODE_LABEL[newMode]} cap of ${cap.toLocaleString("en-IN")}.`,
    );
  }

  if (newMode === "LIVE_TEST") {
    const incomplete = checklist.filter((item) => !item.done);
    for (const item of incomplete) {
      violations.push(`Checklist incomplete: ${item.label}.`);
    }
  }

  return violations;
}
