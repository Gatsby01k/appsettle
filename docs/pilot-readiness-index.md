# INRSettle — Pilot Readiness Index / Proof Pack

The master index of INRSettle's pilot-readiness work, for partners,
providers, advisors, early B2B customers, and internal review. It links and
summarizes every readiness document and states plainly what is ready, what
needs review, and what is not approved.

- **Index date:** 2026-06-12
- **Prepared for:** controlled real-money shadow/live-test pilot review

---

## 1. Executive Summary

INRSettle is preparing for a **controlled shadow/live-test pilot — not
unrestricted live operations**. The platform operates the control and
evidence layer of INR payout settlement (quotes, lifecycle, provider proof,
independent reconciliation, audit trail, finality review, reports); licensed
partners and providers move the money. Every control described in this pack
exists in software today, most are regression-tested, and the remaining gaps
are named in Section 6 rather than papered over.

## 2. Core Principle

**Payment completed does not equal settlement finalized. Provider completed
does not equal ready to finalize.**

Settlement finality requires all of:

1. Provider Proof
2. Independent Reconciliation (provider claims never qualify)
3. Audit Trail
4. Finality Review (deterministic, dual-control approved)
5. Settlement Report
6. Pilot Guardrails (caps, allowlist, safety tripwires)

## 3. Current Product Controls

| Control | Summary |
|---|---|
| Quote → Settlement workflow | Rate-locked quotes with expiry; lifecycle state machine REQUESTED → RECONCILED |
| Provider Proof | Webhook/poll/manual capture; idempotent; append-only; provider-reported values only |
| Independent Reconciliation | Source-classified; provider_claim excluded at every decision point; confidence-scored auto-match |
| Finality Review | Deterministic engine; named blockers; no force-finalize path exists |
| Dual-control approval | Second operator required for lifecycle APPROVED and finality |
| Creator self-approval blocked | Server-side, both control points, regression-tested |
| Settlement Reports | Per-settlement evidence report; generation itself audited |
| Audit Logs | Org-scoped, append-only; lifecycle, evidence, approvals, webhooks, membership |
| Shadow Mode | DEMO / SHADOW / LIVE_TEST with entry guardrails and INR caps |
| Live Pilot Readiness | 10-point per-settlement readiness assessment |
| Provider Risk Shield | Risk passports, trust scores, go-live gates, exposure limits (UI control screen) |
| Provider Boundary Hardening | HMAC signatures + replay windows; idempotent resolution; unknown → pending; reversed → review; ~37 boundary/outcome tests |
| RBAC hardening | 6 roles; 14 server-action gates; documented matrix; read-only/compliance roles cannot mutate |
| KYB / Counterparty Readiness | 16-point checklist + 8-point eligibility gate per counterparty (UI control screen) |
| Monitoring / Incident Readiness | Pilot command center: system/provider health, alert rules, incident queue, freeze status (assessed state) |

## 4. Readiness Documents

| Document | Status | Summary |
|---|---|---|
| [`partner-proof-package.md`](./partner-proof-package.md) | Present | Full platform explanation for partners: principle, capabilities, integration boundary, pilot scope, mutual requirements, open items |
| [`incident-handling-playbook.md`](./incident-handling-playbook.md) | Present | Severity model, ownership, 11 incident types with full response steps, safety rules, provider communication templates |
| [`production-env-sanity.md`](./production-env-sanity.md) | Present | Read-only env/config audit: 22 Pass, 3 Needs Review (pilot env values), 2 local-run-required; no secrets printed |
| [`controlled-live-test-readiness.md`](./controlled-live-test-readiness.md) | Present | The gating go/no-go checklist: scope, controls, limits, roles, stop conditions, success criteria, sign-off block |
| [`commercial-partner-terms.md`](./commercial-partner-terms.md) | Present | Draft term sheet: roles, funds-flow boundary, pricing options (TBD placeholders), SLA, risk allocation, next steps |
| [`rbac-matrix.md`](./rbac-matrix.md) | Present | 13-capability × 6-role matrix, dual-control rules, role intents; backed by unit tests |
| [`controlled-pilot-dry-run.md`](./controlled-pilot-dry-run.md) | Present (supporting) | Operator runbook: 14 dry-run steps, 9 failure cases, pass/fail gate |
| [`pilot-env-checklist.md`](./pilot-env-checklist.md) | Present (supporting) | Deployment configuration checklist with invariants |

## 5. Partner / Provider Proof

What INRSettle can demonstrate today, live in the product:

- **Controlled workflow** — every settlement moves through an explicit, role-gated lifecycle; nothing skips states.
- **Evidence capture** — provider proof recorded before any transition; duplicates idempotent.
- **Reconciliation independence** — provider claims structurally excluded; a settlement cannot reconcile itself.
- **Audit trail** — every transition, approval, webhook event, and rejection recorded and reviewable.
- **Approval controls** — dual control on approval and finality; creator self-approval rejected server-side (demonstrable on request).
- **Report output** — per-settlement evidence reports suitable for partner and compliance review.
- **KYB readiness** — counterparty gate with checklist, risk rating, and eligibility scoring.
- **Provider risk visibility** — per-provider readiness passports with honest open-item lists.
- **Incident readiness** — written playbook, command center, named stop conditions.

## 6. Pilot Go / No-Go Summary

| Area | Required state | Status | Evidence document | Owner |
|---|---|---|---|---|
| Product workflow | Lifecycle + quote flow operational, tested | **Pass** | Dry-run runbook; test suite | Operator |
| Provider proof | Idempotent capture, proof-before-transition | **Pass** | Boundary tests; proof package §3 | Operator |
| Reconciliation | Independence enforced everywhere | **Pass** | Test suites; rbac/recon gates | Treasury Manager |
| Finality | Deterministic, claim-alone never ready | **Pass** | provider-claim finality tests | Treasury Manager |
| Audit logs | All control events recorded, org-scoped | **Pass** | Env sanity §4; playbook §5 | Founder/Admin |
| Reports | Generated + audited per settlement | **Pass** | Dry-run step 13 | Operator |
| RBAC / dual-control | P0+P1 gates live; matrix tested | **Pass** | rbac-matrix.md; permissions tests | Founder/Admin |
| KYB readiness | Screen + gate exist; *not yet an enforcement hook in settlement flow* | **Needs Review** | KYB module; playbook 4.10 | Compliance Officer |
| Provider risk | Risk Shield live; both providers have open go-live gate items | **Blocked** (gates open) | Provider Risk Shield | Founder/Admin |
| Monitoring | Command center live; probes/alerts not yet automated | **Needs Review** | Monitoring module; env sanity risks | Founder/Admin |
| Incident handling | Playbook adopted, owners named | **Needs Review** (sign-off pending) | incident-handling-playbook.md | Founder/Admin |
| Env sanity | Pilot env values set in hosting; secrets hygiene | **Needs Review** | production-env-sanity.md §1e–1g | Founder/Admin |
| Commercial terms | Term sheet agreed with pilot partner | **Needs Review** (draft only) | commercial-partner-terms.md | Founder/Admin |
| Provider approval | Go-live gate complete for the pilot provider | **Blocked** (commercial/KYB/recon-format items open) | Provider Risk Shield | Founder/Admin |
| Counterparty approval | ≥1 counterparty Approved for Shadow with full pack | **Needs Review** | KYB records | Compliance Officer |
| Legal/compliance perimeter | Licensing/contracting analysis documented | **Blocked** | (counsel memo — not yet produced) | Founder/Admin |

**Reading:** product controls are green; the open items are external —
provider commercial readiness, counterparty packs, deployment config, and
the legal perimeter. One Blocked row = no pilot.

## 7. What Is Still Not Approved

- INRSettle is **not approved for unrestricted live operations**.
- **Live payouts are not enabled by this package** — `LIVE_PAYOUTS_ENABLED` remains unset and every read of it blocks rather than permits.
- **Production credentials must not be used** unless explicitly approved in writing; all current rails are sandbox.
- Any real-money test must be **limited, manually reviewed, and documented** per the readiness checklist.
- The **commercial/legal perimeter still requires final review** before any scale beyond the pilot.

## 8. Next Actions Before Pilot

1. Confirm provider pilot approval (close the Risk Shield go-live gate items).
2. Confirm one approved counterparty (complete KYB pack, eligibility gate).
3. Confirm max amount and transaction count (fill Section 6 of the readiness checklist; match software caps).
4. Confirm the provider escalation contact and response expectations.
5. Confirm webhook/status behavior against provider documentation (signing, status strings, reversal mapping).
6. Confirm the reconciliation evidence format (statement/report sample received and parsed).
7. Confirm commercial pilot terms (resolve the TBD placeholders).
8. Confirm operator and approver role assignments (two distinct people, logins verified).
9. Confirm stop conditions are understood by all owners (playbook sign-off).
10. Run one full controlled pilot checklist review (`controlled-live-test-readiness.md`) and the dry run end-to-end, recording evidence.

## 9. Partner-Facing Summary

INRSettle is a settlement operations platform built on a single discipline:
a payout is finalized only when provider proof, independent bank/PSP
reconciliation, a complete audit trail, dual-control review, and a generated
report all agree — and our software refuses to finalize on anything less.
This pack indexes the full readiness record: the product controls (built and
regression-tested), the operational documents (incident playbook, runbooks,
checklists), the environment audit, and a candid go/no-go table that names
what is still open — provider commercial readiness, counterparty KYB packs,
and the legal perimeter. We are deliberately not ready for unrestricted live
operations, and we say so; we are ready to plan a small, capped, manually
reviewed pilot with the right partner, and to share any item in this pack in
a working session.
