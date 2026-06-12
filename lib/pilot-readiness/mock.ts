// Pilot Readiness / Proof Pack — STATIC MOCK DATA ONLY.
//
// Safe, local, display-only data layer for the /pilot-readiness page.
// No I/O, no fetch, no provider calls, no process.env reads, no database
// access, no filesystem reads. Mirrors docs/pilot-readiness-index.md so the
// UI and the document tell the same story. Nothing here executes payouts,
// enables live operations, or approves production usage.

export type ReadinessStatus = "Pass" | "Needs Review" | "Blocked";

export type ReadinessCard = {
  id: string;
  title: string;
  status: ReadinessStatus;
  owner: string;
  evidence: string;
  explanation: string;
};

export type GoNoGoRow = {
  area: string;
  requiredState: string;
  status: ReadinessStatus;
  evidence: string;
  owner: string;
};

export type ProofDocument = {
  id: string;
  title: string;
  path: string;
  summary: string;
};

export type PilotLimit = {
  label: string;
  value: string;
  state: "ok" | "pending" | "blocked";
};

export const FINALITY_PILLARS = [
  "Provider Proof",
  "Independent Reconciliation",
  "Audit Trail",
  "Finality Review",
  "Settlement Report",
  "Pilot Guardrails",
] as const;

export const READINESS_CARDS: ReadinessCard[] = [
  {
    id: "workflow",
    title: "Product Workflow",
    status: "Pass",
    owner: "Operator",
    evidence: "Dry-run runbook · lifecycle test suite",
    explanation: "Rate-locked quotes and a full settlement state machine; nothing skips states.",
  },
  {
    id: "proof",
    title: "Provider Proof",
    status: "Pass",
    owner: "Operator",
    evidence: "Provider boundary tests (proof-before-transition, idempotency)",
    explanation: "Webhook/poll/manual capture; append-only; duplicates are no-ops.",
  },
  {
    id: "reconciliation",
    title: "Independent Reconciliation",
    status: "Pass",
    owner: "Treasury Manager",
    evidence: "Reconciliation + finality test suites",
    explanation: "Provider claims structurally excluded; a settlement cannot reconcile itself.",
  },
  {
    id: "finality",
    title: "Finality Review",
    status: "Pass",
    owner: "Treasury Manager",
    evidence: "Provider-claim finality regression tests",
    explanation: "Deterministic engine; claim-only evidence never reaches ready; no force-finalize exists.",
  },
  {
    id: "reports",
    title: "Settlement Reports",
    status: "Pass",
    owner: "Operator",
    evidence: "Report page · settlement.report_generated audit events",
    explanation: "Per-settlement evidence report; generation itself is audited, once.",
  },
  {
    id: "audit",
    title: "Audit Logs",
    status: "Pass",
    owner: "Founder/Admin",
    evidence: "Env sanity audit §4 · org-scoped queries",
    explanation: "Append-only, organization-scoped trail across lifecycle, evidence, approvals and webhooks.",
  },
  {
    id: "rbac",
    title: "RBAC / Dual Control",
    status: "Pass",
    owner: "Founder/Admin",
    evidence: "docs/rbac-matrix.md · permissions test matrix",
    explanation: "14 server-action gates; creator self-approval blocked on lifecycle and finality.",
  },
  {
    id: "kyb",
    title: "KYB Readiness",
    status: "Needs Review",
    owner: "Compliance Officer",
    evidence: "KYB module · playbook §4.10",
    explanation: "Checklist and eligibility gate live as a control screen; not yet an enforcement hook in the settlement flow.",
  },
  {
    id: "provider-risk",
    title: "Provider Risk",
    status: "Blocked",
    owner: "Founder/Admin",
    evidence: "Provider Risk Shield go-live gates",
    explanation: "Both providers carry open gate items (commercial terms, reconciliation format, escalation SLA).",
  },
  {
    id: "monitoring",
    title: "Monitoring",
    status: "Needs Review",
    owner: "Founder/Admin",
    evidence: "Pilot command center · env sanity risks",
    explanation: "Command center reflects assessed state; automated probes and alerting not yet wired.",
  },
  {
    id: "incidents",
    title: "Incident Handling",
    status: "Needs Review",
    owner: "Founder/Admin",
    evidence: "docs/incident-handling-playbook.md",
    explanation: "Playbook written with owners and templates; team sign-off pending.",
  },
  {
    id: "commercial",
    title: "Commercial Terms",
    status: "Needs Review",
    owner: "Founder/Admin",
    evidence: "docs/commercial-partner-terms.md",
    explanation: "Term sheet drafted; fees and SLA placeholders unresolved with the pilot partner.",
  },
  {
    id: "env",
    title: "Production Env Sanity",
    status: "Needs Review",
    owner: "Founder/Admin",
    evidence: "docs/production-env-sanity.md",
    explanation: "Code-side checks pass; pilot env values (rate, caps, demo flag) must be set and verified in hosting.",
  },
];

export const GO_NO_GO: GoNoGoRow[] = [
  { area: "Product workflow", requiredState: "Lifecycle + quote flow operational, tested", status: "Pass", evidence: "Dry-run runbook; test suite", owner: "Operator" },
  { area: "Provider proof", requiredState: "Idempotent capture, proof-before-transition", status: "Pass", evidence: "Boundary tests", owner: "Operator" },
  { area: "Reconciliation", requiredState: "Independence enforced everywhere", status: "Pass", evidence: "Recon/finality suites", owner: "Treasury Manager" },
  { area: "Finality", requiredState: "Deterministic; claim-alone never ready", status: "Pass", evidence: "Claim-finality tests", owner: "Treasury Manager" },
  { area: "Audit logs", requiredState: "All control events recorded, org-scoped", status: "Pass", evidence: "Env sanity §4", owner: "Founder/Admin" },
  { area: "Reports", requiredState: "Generated + audited per settlement", status: "Pass", evidence: "Dry-run step 13", owner: "Operator" },
  { area: "RBAC / dual-control", requiredState: "P0+P1 gates live; matrix tested", status: "Pass", evidence: "rbac-matrix.md; tests", owner: "Founder/Admin" },
  { area: "KYB readiness", requiredState: "Gate passed for all pilot counterparties", status: "Needs Review", evidence: "KYB records", owner: "Compliance Officer" },
  { area: "Provider risk", requiredState: "Go-live gate complete for pilot provider", status: "Blocked", evidence: "Provider Risk Shield", owner: "Founder/Admin" },
  { area: "Monitoring", requiredState: "Owners named; alerting path agreed", status: "Needs Review", evidence: "Command center", owner: "Founder/Admin" },
  { area: "Incident handling", requiredState: "Playbook adopted and signed off", status: "Needs Review", evidence: "Playbook", owner: "Founder/Admin" },
  { area: "Env sanity", requiredState: "Pilot env values set in hosting", status: "Needs Review", evidence: "production-env-sanity.md", owner: "Founder/Admin" },
  { area: "Commercial terms", requiredState: "Term sheet agreed with pilot partner", status: "Needs Review", evidence: "commercial-partner-terms.md", owner: "Founder/Admin" },
  { area: "Provider approval", requiredState: "Pilot provider approved in writing", status: "Blocked", evidence: "Risk Shield gate", owner: "Founder/Admin" },
  { area: "Counterparty approval", requiredState: "≥1 counterparty Approved for Shadow", status: "Needs Review", evidence: "KYB records", owner: "Compliance Officer" },
  { area: "Legal/compliance perimeter", requiredState: "Licensing/contracting analysis documented", status: "Blocked", evidence: "Counsel memo (pending)", owner: "Founder/Admin" },
];

export const PROOF_DOCUMENTS: ProofDocument[] = [
  { id: "partner-proof", title: "Partner Proof Package", path: "docs/partner-proof-package.md", summary: "Platform explanation for partners: principle, capabilities, integration boundary, mutual requirements." },
  { id: "playbook", title: "Incident Handling Playbook", path: "docs/incident-handling-playbook.md", summary: "Severity model, ownership, 11 incident types with response steps, communication templates." },
  { id: "env-sanity", title: "Production Env Sanity", path: "docs/production-env-sanity.md", summary: "Read-only env/config audit; 22 pass, named review items; no secrets printed." },
  { id: "readiness", title: "Controlled Live-Test Readiness", path: "docs/controlled-live-test-readiness.md", summary: "The gating go/no-go checklist: scope, limits, roles, stop conditions, sign-off." },
  { id: "commercial", title: "Commercial Partner Terms", path: "docs/commercial-partner-terms.md", summary: "Draft term sheet: roles, funds-flow boundary, pricing options, SLA, risk allocation." },
  { id: "index", title: "Pilot Readiness Index", path: "docs/pilot-readiness-index.md", summary: "Master proof pack indexing all readiness work with the go/no-go summary." },
  { id: "rbac", title: "RBAC Matrix", path: "docs/rbac-matrix.md", summary: "13-capability × 6-role matrix with dual-control rules, backed by unit tests." },
];

export const PILOT_LIMITS: PilotLimit[] = [
  { label: "Max transaction amount", value: "TBD (≤ LIVE_TEST cap, default INR 1,000)", state: "pending" },
  { label: "Max daily amount", value: "TBD (≤ daily cap, default INR 2,000)", state: "pending" },
  { label: "Max pilot transactions", value: "TBD (suggested 5–10, hard stop)", state: "pending" },
  { label: "Approved provider", value: "Needs Review — go-live gate items open", state: "blocked" },
  { label: "Approved counterparty", value: "Needs Review — KYB pack incomplete", state: "pending" },
  { label: "Operating window", value: "TBD (IST business days, operator + approver available)", state: "pending" },
  { label: "Stop conditions", value: "Required — 12 conditions defined and binding", state: "ok" },
];

export const STOP_CONDITIONS: string[] = [
  "Unexpected production payout attempt",
  "Provider reversed payout",
  "Webhook verification failure pattern",
  "Reconciliation mismatch",
  "Missing provider proof",
  "Missing independent reconciliation",
  "Finality blocked",
  "LIVE_TEST cap breach attempt",
  "KYB blocked counterparty attempt",
  "Audit logging failure",
  "Report generation failure",
  "Creator self-approval attempt",
];

export const FINAL_STATEMENT =
  "INRSettle is not approved for unrestricted live operations. A controlled shadow/live-test pilot may proceed only after required controls, provider approval, counterparty approval, commercial terms, and stop conditions are reviewed and documented.";
