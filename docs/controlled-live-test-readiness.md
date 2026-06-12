# Controlled Real-Money Shadow / Live-Test Readiness Checklist

The single gating document for the INRSettle pilot. The pilot may not begin
until every item here is passed, reviewed, and documented. Companion
documents: `docs/controlled-pilot-dry-run.md`, `docs/pilot-env-checklist.md`,
`docs/production-env-sanity.md`, `docs/incident-handling-playbook.md`,
`docs/rbac-matrix.md`, `docs/partner-proof-package.md`.

---

## 1. Pilot Scope

The pilot is **controlled, limited, and manually reviewed**. Specifically:

- No unrestricted live payouts — there is no path in this pilot to general live operation.
- One approved provider only (allowlisted in configuration).
- Approved counterparties only (KYB gate passed).
- Limited amounts (per-settlement and daily INR caps, enforced in software).
- Limited number of transactions (counted, with a hard stop).
- Manual operator + approver review on every settlement — no auto-finalization.
- Settlement finality requires, with no exceptions: provider proof,
  independent reconciliation, audit trail, finality review, settlement
  report, and passing pilot guardrails.

## 2. Required Product Controls

All of the following exist and are verified in the repository as of this
document's date:

- [x] Quote → Settlement workflow (rate-locked quotes, lifecycle state machine)
- [x] Provider Proof capture (webhook/poll/manual; idempotent; append-only)
- [x] Independent Reconciliation (source classification; provider claims excluded)
- [x] Finality Review (deterministic engine; blockers named; no force-finalize)
- [x] Dual-control approval (finality and lifecycle APPROVED)
- [x] Creator self-approval blocked (server-side, both control points)
- [x] Settlement Report (generation audited per settlement)
- [x] Audit Logs (org-scoped, append-only)
- [x] Shadow Mode (DEMO / SHADOW / LIVE_TEST with entry guardrails)
- [x] Live Pilot Readiness controls (10-point per-settlement assessment)
- [x] Provider Risk Shield (risk passports, go-live gates, exposure limits)
- [x] Provider Boundary Hardening (signatures, replay windows, idempotency, outcome classifier — regression-tested)
- [x] RBAC hardening (P0 + P1; capability matrix documented and tested)
- [x] KYB / Counterparty Readiness (16-point checklist, 8-point eligibility gate)
- [x] Monitoring / Incident Readiness (command center; assessed state)
- [x] Incident Handling Playbook (`docs/incident-handling-playbook.md`)
- [x] Partner Proof Package (`docs/partner-proof-package.md`)
- [x] Production Env Sanity Audit (`docs/production-env-sanity.md`)

## 3. Pre-Pilot Go / No-Go Checklist

A single **Blocked** row stops the pilot. **Needs Review** rows must be
converted to Pass (with evidence) before go.

| Control | Required state | Status | Evidence | Owner |
|---|---|---|---|---|
| Live payouts disabled | `LIVE_PAYOUTS_ENABLED` unset; every read blocks | Pass | Env sanity audit §2b | Founder/Admin |
| Sandbox enforcement | No `isTest:false`; sandbox base URLs only | Pass | Env sanity audit §2a/2c | Founder/Admin |
| Pilot env variables set | `QUOTE_RATE_USDT_INR`, caps, allowlist, `NEXT_PUBLIC_DEMO_MODE=false` set in Vercel | Needs Review | Env sanity audit §1e–1g | Founder/Admin |
| Credentials hygiene | Demo/operator/approver passwords rotated | Needs Review | Rotation record | Founder/Admin |
| Dual control staffed | ≥1 approver who is not the settlement creator, login verified | Needs Review | Team page; dry-run step 3.10–3.12 | Treasury Manager |
| Self-approval blocked | Lifecycle + finality rejections verified live | Pass (re-verify in dry run) | RBAC tests; dry-run step 3.10 | Treasury Manager |
| Independent reconciliation | provider_claim excluded everywhere | Pass | Recon/finality test suites | Treasury Manager |
| Provider boundary | Signature/replay/idempotency/classifier tests green on pilot commit | Needs Review (run on pilot commit) | `npm test` output | Operator |
| KYB gate | All pilot counterparties Approved for Shadow | Needs Review | KYB records | Compliance Officer |
| Provider go-live gate | Pilot provider's gate items complete (commercial, recon format, escalation) | Blocked (today) | Provider Risk Shield — both providers have open gate items | Founder/Admin |
| Monitoring & incidents | Playbook adopted; owners named; SLA understood | Needs Review | Playbook sign-off | Founder/Admin |
| Dry run executed | `controlled-pilot-dry-run.md` completed end-to-end incl. failure cases | Needs Review | Dry-run evidence record | Operator |
| Build & tests | `npx prisma validate && npm test && npm run build` pass on tagged pilot commit | Needs Review | CI/local output + tag | Operator |
| Legal/compliance perimeter | Contracting entities and licensing position documented | Blocked (today) | Counsel memo | Founder/Admin |

## 4. Counterparty Requirements

Per counterparty, before inclusion:

- [ ] KYB status: **Approved for Shadow** (or live-test, re-reviewed at cutover)
- [ ] Beneficial ownership (UBOs 10%+) reviewed and documented
- [ ] Director/signatory information on file
- [ ] Source of funds explanation available where required
- [ ] Commercial terms accepted in writing
- [ ] Sanctions/adverse media screening completed and dated
- [ ] Pilot approval not blocked (eligibility gate complete, review owner assigned)

## 5. Provider Requirements

Per provider, before routing a pilot transaction:

- [ ] Provider approved for pilot (Risk Shield go-live gate complete)
- [ ] Status endpoint available and tested (poll fallback works)
- [ ] Webhook signing documented and verified against implementation
- [ ] Failure/reversal status strings mapped exhaustively (unknown → pending)
- [ ] UTR / transaction proof fields available per payout
- [ ] Named escalation contact with response expectations
- [ ] Commercial terms understood (pricing, prefunding, cut-offs)
- [ ] Production credentials NOT used unless explicitly approved in writing by Founder/Admin — sandbox remains the default

## 6. Transaction Limits

To be filled in and signed before go (placeholders — software caps must match):

| Limit | Value |
|---|---|
| Max transaction amount | INR ______ (≤ `LIVE_TEST_MAX_INR`, default 1,000) |
| Max daily amount | INR ______ (≤ `LIVE_TEST_DAILY_MAX_INR`, default 2,000) |
| Max number of pilot transactions | ______ (suggested: 5–10) |
| Allowed corridors | USDT → INR only |
| Allowed payout methods | ______ (e.g., IMPS sandbox-verified method only) |
| Allowed operating window | ______ IST, business days, with both operator and approver available |
| Stop conditions | Section 8 — any one triggers an immediate stop |

## 7. Operational Roles

| Role | Person | Responsibility during pilot |
|---|---|---|
| Operator | ______ | Creates quotes/settlements, records proof, ingests reconciliation, first responder |
| Treasury Manager / Approver | ______ | Approves lifecycle + finality (never own settlements), judges mismatches |
| Compliance Officer | ______ | KYB status, screening, flag-only review |
| Founder/Admin | ______ | Go/no-go, stop decision, provider escalation, env/config changes |
| Provider contact | ______ | Status, reversal, webhook questions per the communication templates |

## 8. Stop Conditions

The pilot **stops immediately** — no new transactions, in-flight ones
monitored to completion — if any of the following occurs:

1. Unexpected production payout attempt (Critical — playbook 4.7)
2. Provider reversed payout
3. Webhook verification failure pattern (repeated/unexplained)
4. Reconciliation mismatch with unexplained money difference
5. Missing provider proof on an executed settlement
6. Missing independent reconciliation past SLA
7. Finality blocked without explanation
8. LIVE_TEST cap breach attempt
9. KYB-blocked counterparty attempt
10. Audit logging failure (any evidence event not recorded)
11. Report generation failure that cannot be resolved same-day
12. Creator self-approval attempt (control fires — stop to review staffing/process if repeated)

Resumption requires a documented root cause and Founder/Admin sign-off.

## 9. Success Criteria

The pilot is successful **only if all of the following hold for every pilot
settlement**:

- [ ] Provider proof captured (transaction id + provider-reported amount)
- [ ] Independent reconciliation matched (non-provider source)
- [ ] Audit trail complete and ordered
- [ ] Finality reviewed and approved by an allowed approver
- [ ] Creator self-approval blocked where attempted (control verified, not bypassed)
- [ ] Settlement report generated and recorded
- [ ] No live payout expansion occurred at any point (flag unset throughout; sandbox/approved credentials only)
- [ ] Incident handling path tested (at least one drill or real incident handled per playbook) or verified ready
- [ ] Partner/provider communication path confirmed (at least one round-trip with the named contact)

Anything less is a partial result: document it, fix it, and re-run — do not
average it away.

## 10. Final Pre-Pilot Declaration

**INRSettle is not ready for unrestricted live operations.**

INRSettle may proceed only to a **controlled shadow/live-test pilot**, and
only when every required control in this document is passed, reviewed, and
documented — including the items currently marked Needs Review or Blocked in
Section 3. The pilot's caps, counterparty list, provider list, and stop
conditions are binding. Any expansion of scope — amounts, counterparties,
providers, automation, or live payout capability — is a new decision
requiring a new review of this checklist, not a continuation of the pilot.

| Sign-off | Name | Date |
|---|---|---|
| Founder/Admin | ______ | ______ |
| Treasury Manager / Approver | ______ | ______ |
| Compliance Officer | ______ | ______ |
