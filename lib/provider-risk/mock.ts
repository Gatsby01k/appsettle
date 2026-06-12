// Provider Risk Shield — STATIC MOCK DATA ONLY.
//
// This module is a safe, local, display-only data layer for the
// /providers page. It performs no I/O, calls no provider API, reads no
// environment variables, and touches no database. Nothing here can move
// money or change provider execution behavior.

export type ReadinessLabel =
  | "Sandbox Verified"
  | "Commercial Review"
  | "Pilot Blocked"
  | "Pilot Ready";

export type PassportState = "ok" | "pending" | "blocked";

export type PassportField = {
  label: string;
  value: string;
  state: PassportState;
};

export type GateItem = {
  label: string;
  done: boolean;
  note?: string;
};

export type EvidenceItem = {
  label: string;
  state: "received" | "missing";
  detail: string;
};

export type ProviderRiskProfile = {
  id: string;
  name: string;
  rail: string;
  overallReadiness: ReadinessLabel;
  summary: string;
  passport: PassportField[];
  trustScore: {
    score: number; // 0–100
    missing: string[]; // items that explain the gap to 100
  };
  goLiveGate: GateItem[];
  exposure: {
    maxTransaction: string;
    dailyExposure: string;
    pendingExposure: string;
    unresolvedPayouts: number;
    autoFreezeRule: string;
  };
  evidence: EvidenceItem[];
};

export const PROVIDER_RISK_PROFILES: ProviderRiskProfile[] = [
  {
    id: "pontisglobe",
    name: "PontisGlobe",
    rail: "USDT → INR payout · sandbox API via VPS gateway",
    overallReadiness: "Commercial Review",
    summary:
      "Sandbox integration verified end to end (payout, status, webhook signature). Commercial review pending — contracting entity and prefunding terms are the open blockers.",
    passport: [
      { label: "Sandbox status", value: "Verified — payout & status tested", state: "ok" },
      { label: "Commercial proposal", value: "Commercial review pending", state: "pending" },
      { label: "KYB status", value: "Document list received, not submitted", state: "pending" },
      { label: "Legal entity", value: "Missing legal entity confirmation", state: "blocked" },
      { label: "Production API", value: "Not requested — sandbox only", state: "pending" },
      { label: "Webhook / status verification", value: "HMAC signature + replay window verified", state: "ok" },
      { label: "Reconciliation support", value: "Statement export format unconfirmed", state: "pending" },
      { label: "Failed payout / refund process", value: "Reversal flow documented, untested", state: "pending" },
      { label: "Support escalation", value: "Named contact, no SLA in writing", state: "pending" },
      { label: "Overall readiness", value: "Commercial Review", state: "pending" },
    ],
    trustScore: {
      score: 58,
      missing: [
        "Missing legal entity — contracting party not yet confirmed in writing",
        "Prefunding terms required — float, top-up and cut-off times undefined",
        "Reconciliation format missing — no settlement statement sample received",
        "Refund/failed payout flow untested in sandbox",
        "Support SLA not committed (response and escalation times)",
      ],
    },
    goLiveGate: [
      { label: "Sandbox payout completed", done: true },
      { label: "Provider transaction proof verified", done: true },
      { label: "Status endpoint verified", done: true },
      { label: "Reconciliation process confirmed", done: false, note: "Reconciliation format missing" },
      { label: "KYB requirements confirmed", done: false, note: "Checklist received, submission pending" },
      { label: "Contracting legal entity confirmed", done: false, note: "Missing legal entity" },
      { label: "Prefunding process confirmed", done: false, note: "Prefunding terms required" },
      { label: "Refund/failed payout process confirmed", done: false },
      { label: "Daily/monthly limits confirmed", done: false },
      { label: "Support escalation confirmed", done: false, note: "Contact known, SLA pending" },
      { label: "Commercial terms accepted", done: false, note: "Commercial review pending" },
    ],
    exposure: {
      maxTransaction: "INR 1,000 (LIVE_TEST cap)",
      dailyExposure: "INR 2,000 (daily LIVE_TEST cap)",
      pendingExposure: "INR 0 — no unreconciled provider balance",
      unresolvedPayouts: 0,
      autoFreezeRule:
        "Freeze new payouts if any payout is unresolved beyond 24h, or pending exposure exceeds the daily cap.",
    },
    evidence: [
      { label: "Commercial proposal received", state: "received", detail: "Rate card + corridor terms, v1" },
      { label: "API docs reviewed", state: "received", detail: "Payout, status, webhook signing reviewed" },
      { label: "WhatsApp onboarding thread", state: "received", detail: "Onboarding contact thread archived" },
      { label: "Sandbox proof", state: "received", detail: "Sandbox payout + signed webhook captured" },
      { label: "Legal/compliance documents", state: "missing", detail: "Missing legal entity confirmation and KYB pack" },
    ],
  },
  {
    id: "remitquickly",
    name: "RemitQuickly",
    rail: "USDT → INR payout · direct sandbox API",
    overallReadiness: "Pilot Blocked",
    summary:
      "Sandbox payout works with signed webhooks. Pilot blocked — no commercial proposal, no KYB checklist and no confirmed reconciliation or refund process yet.",
    passport: [
      { label: "Sandbox status", value: "Verified — isTest payout cycle completed", state: "ok" },
      { label: "Commercial proposal", value: "Not received", state: "blocked" },
      { label: "KYB status", value: "Requirements not provided", state: "blocked" },
      { label: "Legal entity", value: "Missing legal entity confirmation", state: "blocked" },
      { label: "Production API", value: "Not requested — sandbox only", state: "pending" },
      { label: "Webhook / status verification", value: "SHA-512 webhook signature verified", state: "ok" },
      { label: "Reconciliation support", value: "Reconciliation format missing", state: "blocked" },
      { label: "Failed payout / refund process", value: "Unconfirmed", state: "pending" },
      { label: "Support escalation", value: "Shared inbox only, no named contact", state: "pending" },
      { label: "Overall readiness", value: "Pilot Blocked", state: "blocked" },
    ],
    trustScore: {
      score: 52,
      missing: [
        "No commercial proposal — pricing and corridor terms unconfirmed",
        "Missing legal entity — contracting party unknown",
        "KYB requirements not provided",
        "Reconciliation format missing — no statement or report sample",
        "Refund/failed payout process unconfirmed",
        "No named support contact or escalation path",
      ],
    },
    goLiveGate: [
      { label: "Sandbox payout completed", done: true },
      { label: "Provider transaction proof verified", done: true },
      { label: "Status endpoint verified", done: true },
      { label: "Reconciliation process confirmed", done: false, note: "Reconciliation format missing" },
      { label: "KYB requirements confirmed", done: false, note: "Requirements not provided" },
      { label: "Contracting legal entity confirmed", done: false, note: "Missing legal entity" },
      { label: "Prefunding process confirmed", done: false, note: "Prefunding terms required" },
      { label: "Refund/failed payout process confirmed", done: false },
      { label: "Daily/monthly limits confirmed", done: false },
      { label: "Support escalation confirmed", done: false, note: "No named contact" },
      { label: "Commercial terms accepted", done: false, note: "No proposal received" },
    ],
    exposure: {
      maxTransaction: "INR 1,000 (LIVE_TEST cap)",
      dailyExposure: "INR 2,000 (daily LIVE_TEST cap)",
      pendingExposure: "INR 0 — no unreconciled provider balance",
      unresolvedPayouts: 0,
      autoFreezeRule:
        "Freeze new payouts if any payout is unresolved beyond 24h, or pending exposure exceeds the daily cap.",
    },
    evidence: [
      { label: "Commercial proposal received", state: "missing", detail: "No proposal or rate card on file" },
      { label: "API docs reviewed", state: "received", detail: "Payout + webhook signing reviewed" },
      { label: "WhatsApp onboarding thread", state: "received", detail: "Initial contact thread archived" },
      { label: "Sandbox proof", state: "received", detail: "isTest payout + signed webhook captured" },
      { label: "Legal/compliance documents", state: "missing", detail: "Missing legal entity and KYB pack" },
    ],
  },
];
