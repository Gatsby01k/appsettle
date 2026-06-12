# INRSettle — Partner Proof Package

Prepared for banking partners, PSPs, INR payout providers, OTC desks, fintech
infrastructure providers, and early pilot customers.

---

## 1. Executive Summary

INRSettle is a B2B settlement operations platform for INR payout workflows.
It sits between a treasury (typically stablecoin-funded) and external payout
providers, and operates the control layer of a settlement: quote, settlement
lifecycle, provider proof capture, independent reconciliation, audit trail,
finality review, and settlement reporting.

INRSettle does not move funds. Money movement is executed by licensed
providers and partners; INRSettle records, verifies, reconciles, and
finalizes the operation — with KYB readiness checks on counterparties,
provider risk controls, operational monitoring, and incident readiness around
it.

The platform is currently operating in a controlled pre-pilot state: sandbox
provider rails, capped test modes, and a documented path to a limited
real-money shadow/live-test pilot.

## 2. Core Product Principle

**Payment completed does not equal settlement finalized.**

A provider reporting "completed" is a claim — necessary, but not sufficient.
Provider completed does not equal ready to finalize. In INRSettle, settlement
finality requires all of the following to agree:

1. **Provider Proof** — structured, append-only evidence of what the provider reported
2. **Independent Reconciliation** — a bank statement, PSP report, or operator-verified record; provider claims never count as independent evidence
3. **Audit Trail** — every transition, approval, and evidence event recorded
4. **Finality Review** — a deterministic engine that evaluates the evidence and renders ready / needs review / not ready
5. **Settlement Report** — a generated, audited report per settlement
6. **Pilot Guardrails** — amount caps, provider allowlist, and safety tripwires passing at the moment of finality

If any pillar is missing or contradicts another, the settlement does not
finalize. There is no manual override that bypasses the engine.

## 3. Current Platform Capabilities

- **Quote → Settlement workflow** — rate-locked quotes (manual desk rate, explicitly labeled; no implied live FX feed) with expiry, converted into settlements with a full lifecycle state machine (REQUESTED → APPROVED → EXECUTING → SETTLED → RECONCILED).
- **Provider Proof capture** — webhook, polling, and manual channels; idempotent on natural keys; only provider-reported values are stored (expected values are never substituted).
- **Independent Reconciliation** — source-classified records (bank statement, PSP report, operator record); an auto-match engine that links only unambiguous, high-confidence matches; manual review queues for everything else.
- **Finality Review** — deterministic assessment with a confidence breakdown and named blockers; reversed or unknown provider outcomes can never auto-finalize or auto-fail a settlement.
- **Dual-control approval** — finality and lifecycle approval each require a second operator; the settlement creator can never approve their own settlement (enforced server-side).
- **Settlement Reports** — per-settlement evidence reports; generation itself is an audited event.
- **Audit Logs** — organization-scoped, append-only, covering lifecycle, evidence, approvals, webhooks, and membership changes.
- **Shadow Mode** — DEMO / SHADOW / LIVE_TEST modes with per-mode caps and entry guardrails, so real-world operations are tracked before any live test.
- **Live Pilot Readiness** — a 10-point readiness assessment per settlement combining guardrails and evidence.
- **Provider Risk Shield** — per-provider risk passports, trust scoring, go-live gates, exposure limits, and an evidence vault.
- **Provider Boundary Hardening** — signature verification (HMAC, replay windows), idempotent resolution, deterministic idempotency keys, and a regression-tested outcome classifier.
- **RBAC hardening** — six roles with a documented capability matrix; read-only and compliance roles are blocked from all mutations server-side.
- **KYB / Counterparty Readiness** — a 16-point KYB checklist, risk ratings, and an 8-point pilot eligibility gate per counterparty.
- **Monitoring / Incident Readiness** — a pilot command center covering system health, provider health, alert rules, an incident queue, and freeze status, backed by a written incident handling playbook.

## 4. Pilot Safety Controls

- No live payouts are enabled by default; the live-payout flag is a tripwire that only blocks — nothing in the codebase reads it as permission to execute.
- LIVE_TEST guardrails: per-settlement cap, cumulative daily cap, provider allowlist, beneficiary verification, and operator approval — enforced at mode entry and re-checked at finality.
- Dual-control approval on finality and lifecycle approval.
- Creator self-approval is blocked server-side, in all modes.
- Provider "completed" is never treated as finality.
- Independent reconciliation is required; provider claims are excluded by classification, not by convention.
- A complete audit trail is required for finality.
- A generated settlement report is required for pilot completion.
- KYB readiness is checked before counterparties join the pilot.
- Monitoring incidents are tracked against a written severity and ownership model.
- Kill switch / freeze readiness is shown as control state only — freeze controls in the UI are explicit mocks today and will require audited mutations when implemented.

## 5. Provider Integration Boundary

INRSettle is designed to be a careful consumer of provider infrastructure:

- INRSettle does not rely on provider claims alone — every claim must be corroborated by independent evidence before finality.
- Provider webhooks are treated as claims until verified: signatures are checked against the raw request bytes, with a bounded timestamp window against replay.
- Invalid or unsigned webhook deliveries are rejected and recorded as safe audit events (rejection reason only — unverified payload content is never stored).
- Unknown provider outcomes remain **pending**, never failed. Uncertain money is not failed money.
- A reversed payout requires operator review; it never auto-fails or auto-finalizes a settlement.
- Duplicate webhooks and proofs are idempotent end to end: deterministic idempotency keys per settlement/action, natural-key proof deduplication, and no-op re-resolution.
- No provider secrets or raw sensitive headers are exposed in logs, audit metadata, or reports.

## 6. Pilot Scope

The intended pilot is a **controlled real-money shadow/live-test**, defined as:

- A small, named set of KYB-approved counterparties.
- Strictly limited amounts (per-settlement and daily INR caps, enforced in software).
- Approved, allowlisted providers only.
- Manual finality review on every settlement — no auto-finalization.
- No automated expansion of live payout capability; any scope change is a deliberate, documented decision.
- Incident handling procedures in place before scale (see the incident playbook).
- An established partner/provider support channel with named contacts before the first real-money operation.

## 7. What INRSettle Needs From a Partner

- Sandbox credentials initially; production test credentials when jointly approved.
- Payout status endpoint access (polling is our fallback for missed callbacks).
- Webhook signing documentation (algorithm, header format, timestamp semantics).
- UTR / transaction proof fields available per payout, for independent verification.
- Reversal and failure status mapping — the exhaustive list of status strings and their meaning.
- Commercial terms: pricing, corridor coverage, settlement/prefunding mechanics, and cut-off times.
- A named operational contact.
- A defined escalation process with expected response times.
- Your KYB/onboarding requirements for us as a client, so both perimeters are explicit.

## 8. What INRSettle Provides

- A settlement operations UI for operators, approvers, and compliance reviewers.
- A complete evidence trail per settlement: proof, reconciliation, approvals, and reports.
- A reconciliation workflow with source classification and confidence-scored matching.
- Operator/approver controls with role-based access and dual control.
- Per-settlement reports suitable for partner and compliance review.
- Incident readiness: severity model, ownership, playbook, and communication templates.
- Provider risk visibility: readiness passports, exposure limits, and go-live gates.
- Pilot governance: documented checklists, dry-run runbooks, and guardrail enforcement in software.

## 9. Open Items Before Real Scale

Stated plainly, because partners should know where the boundary is today:

- Final commercial agreements with payout providers.
- Production credentials approval (all current rails are sandbox).
- Legal and compliance perimeter: licensing analysis, contracting entities, and jurisdiction mapping.
- Full monitoring integration (the current command center reflects assessed state; automated probes and alerting are not yet wired).
- External security review.
- Incident SLA alignment with each provider.
- A formal customer onboarding policy built on the existing KYB readiness gate.

## 10. Partner-Facing Summary

INRSettle is a settlement operations platform built on one discipline: a
payout is not settled because a provider says so — it is settled when
provider proof, an independent financial record, and a complete audit trail
agree, a second operator approves, and a report documents it. We are
preparing a deliberately small, capped, manually reviewed real-money pilot on
sandbox-verified provider rails, with KYB gating on counterparties, risk
controls on providers, and incident procedures written before they are
needed. We move carefully by design, and we are looking for partners who see
that as the right way to build INR settlement infrastructure. We would value
the opportunity to walk you through the platform and agree on the scope of a
first controlled pilot together.
