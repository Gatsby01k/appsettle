// Monitoring / Incident Readiness — STATIC MOCK DATA ONLY.
//
// Safe, local, display-only data layer for the /monitoring page. No I/O, no
// provider calls, no external monitoring integrations, no env reads, no
// database access. Nothing here executes payouts, changes provider state, or
// enables live operations.

export type HealthStatus = "Healthy" | "Degraded" | "Action Required" | "Offline";

export type SystemHealthItem = {
  label: string;
  status: HealthStatus;
  detail: string;
};

export type ProviderHealth = {
  id: string;
  name: string;
  apiReachability: HealthStatus;
  statusEndpoint: HealthStatus;
  webhookDelivery: HealthStatus;
  signatureVerification: HealthStatus;
  lastSuccessfulCheck: string;
  recentFailureCount: number;
  riskState: "Normal" | "Watch" | "Restricted";
  note: string;
};

export type IncidentRule = {
  name: string;
  trigger: string;
  severity: IncidentSeverity;
};

export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";
export type IncidentStatus = "Open" | "Investigating" | "Resolved";

export type Incident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  owner: string;
  slaTimer: string;
  recommendedAction: string;
  relatedControl: string;
};

export type FreezeStatusItem = {
  label: string;
  value: string;
  state: "ok" | "pending" | "blocked";
};

export type EvidenceReadinessItem = {
  label: string;
  done: boolean;
  detail: string;
};

export const SYSTEM_HEALTH: SystemHealthItem[] = [
  { label: "App status", status: "Healthy", detail: "Console serving; no error spike in current session" },
  { label: "Database status", status: "Healthy", detail: "Primary reachable; migrations in sync" },
  { label: "Provider gateway status", status: "Degraded", detail: "VPS gateway configured; heartbeat check not yet automated" },
  { label: "Webhook status", status: "Healthy", detail: "Endpoints live; signature + replay window enforced" },
  { label: "Reconciliation queue", status: "Action Required", detail: "1 settlement awaiting independent reconciliation" },
  { label: "Report generation", status: "Healthy", detail: "On-demand reports rendering; generation audited" },
  { label: "Audit logging", status: "Healthy", detail: "All settlement, finality and webhook events recorded" },
  { label: "Overall readiness", status: "Degraded", detail: "Pilot-capable; open items tracked in the incident queue" },
];

export const PROVIDER_HEALTH: ProviderHealth[] = [
  {
    id: "pontisglobe",
    name: "PontisGlobe",
    apiReachability: "Healthy",
    statusEndpoint: "Healthy",
    webhookDelivery: "Degraded",
    signatureVerification: "Healthy",
    lastSuccessfulCheck: "Today 10:42 IST · sandbox status poll",
    recentFailureCount: 1,
    riskState: "Watch",
    note: "Sandbox does not deliver callbacks — webhook path verified synthetically; poll fallback covers misses.",
  },
  {
    id: "remitquickly",
    name: "RemitQuickly",
    apiReachability: "Healthy",
    statusEndpoint: "Healthy",
    webhookDelivery: "Healthy",
    signatureVerification: "Healthy",
    lastSuccessfulCheck: "Today 09:15 IST · isTest payout cycle",
    recentFailureCount: 0,
    riskState: "Normal",
    note: "SHA-512 webhook signature verified on every delivery; duplicate deliveries are idempotent no-ops.",
  },
];

export const INCIDENT_RULES: IncidentRule[] = [
  { name: "Stuck settlement", trigger: "EXECUTING with no provider update > 30 minutes", severity: "High" },
  { name: "Provider status pending", trigger: "Outcome unresolved > 15 minutes", severity: "Medium" },
  { name: "Webhook verification failure", trigger: "Any webhook.verification_failed audit event", severity: "High" },
  { name: "Reconciliation mismatch", trigger: "Independent record contradicts provider proof", severity: "High" },
  { name: "Finality blocked", trigger: "Decision blocked by safety gate or missing evidence", severity: "Medium" },
  { name: "LIVE_TEST cap breach attempt", trigger: "Mode change rejected on cap or daily cap", severity: "High" },
  { name: "Unexpected production payout attempt", trigger: "Any non-sandbox payout request observed", severity: "Critical" },
  { name: "Provider reversed payout", trigger: "reversed_review_required audit event", severity: "High" },
  { name: "Report generation failed", trigger: "Report render error or missing generation audit", severity: "Low" },
];

export const INCIDENTS: Incident[] = [
  {
    id: "INC-014",
    title: "Webhook verification failed (PontisGlobe)",
    severity: "High",
    status: "Investigating",
    owner: "Operations lead",
    slaTimer: "2h 10m remaining (4h SLA)",
    recommendedAction: "Confirm sender, rotate gateway shared secret if unexplained, rely on poll fallback meanwhile.",
    relatedControl: "Webhook HMAC + replay window · webhook.verification_failed audit",
  },
  {
    id: "INC-015",
    title: "Settlement awaiting independent reconciliation",
    severity: "Medium",
    status: "Open",
    owner: "Settlement operator",
    slaTimer: "6h 30m remaining (8h SLA)",
    recommendedAction: "Ingest the bank/PSP record and run auto-match; finality stays blocked until matched.",
    relatedControl: "Independent reconciliation requirement (provider claims never count)",
  },
  {
    id: "INC-016",
    title: "Provider outcome pending too long",
    severity: "Medium",
    status: "Investigating",
    owner: "Operations lead",
    slaTimer: "40m remaining (1h SLA)",
    recommendedAction: "Trigger a manual status poll; unknown outcomes remain pending — never auto-failed.",
    relatedControl: "Outcome classifier (unknown → pending) · status poll fallback",
  },
  {
    id: "INC-017",
    title: "Reconciliation mismatch on amount",
    severity: "High",
    status: "Open",
    owner: "Treasury manager",
    slaTimer: "3h 45m remaining (4h SLA)",
    recommendedAction: "Compare provider-reported amount vs bank record; route to finality review — do not finalize.",
    relatedControl: "Finality amount-agreement check · needs_review decision",
  },
  {
    id: "INC-018",
    title: "Finality blocked by missing evidence",
    severity: "Low",
    status: "Resolved",
    owner: "Treasury manager",
    slaTimer: "Met (resolved in 1h 20m)",
    recommendedAction: "Evidence completed: proof + independent match + dual-control approval recorded.",
    relatedControl: "Deterministic finality engine · dual-control approval",
  },
];

export const FREEZE_STATUS: FreezeStatusItem[] = [
  { label: "Global live payout status", value: "Disabled (LIVE_PAYOUTS_ENABLED unset — tripwire only blocks)", state: "ok" },
  { label: "Provider freeze status", value: "No provider frozen · freeze control is mock-only", state: "ok" },
  { label: "LIVE_TEST cap enforcement", value: "Per-settlement and daily caps enforced at mode entry + finality", state: "ok" },
  { label: "Auto-freeze readiness", value: "Rule defined (unresolved > 24h or exposure > daily cap) — not yet automated", state: "pending" },
  { label: "Manual override status", value: "No overrides active; any real override must write an audit event", state: "ok" },
];

export const EVIDENCE_READINESS: EvidenceReadinessItem[] = [
  { label: "Audit logging enabled", done: true, detail: "Settlement, reconciliation, finality, webhook and membership events" },
  { label: "Provider failure audit visible", done: true, detail: "webhook.verification_failed + webhook.resolution_failed events" },
  { label: "Report generation tracked", done: true, detail: "settlement.report_generated recorded once per settlement" },
  { label: "Finality approval tracked", done: true, detail: "settlement.finality_approved with dual-control metadata" },
  { label: "Role permission hardening complete", done: true, detail: "P0 + P1 RBAC gates live; matrix in docs/rbac-matrix.md" },
  { label: "KYB readiness screen available", done: true, detail: "Counterparty Readiness gate before pilot participation" },
];
