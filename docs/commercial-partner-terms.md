# INRSettle — Commercial Partner Terms (Pilot Draft)

**Status: draft term sheet for discussion. This is not a final legal
contract.** It sets out the commercial and operational terms INRSettle
proposes for a controlled pilot, to be refined with each partner and
formalized by counsel before any production engagement.

Audience: INR payout providers, PSPs, OTC desks, fintech infrastructure
partners, and early B2B customers.

---

## 1. Purpose

INRSettle provides settlement operations infrastructure for INR payout
workflows: quote-to-settlement lifecycle management, provider proof capture,
independent reconciliation, audit trail, finality review, settlement reports,
KYB readiness, operational monitoring, and incident handling — typically
around stablecoin-funded treasury flows. INRSettle operates the control and
evidence layer of a settlement; money movement is executed by licensed
partners and providers.

## 2. Pilot Scope

- Controlled pilot only — a deliberately small, supervised program.
- Limited transaction count (target: ______ transactions; hard stop).
- Limited transaction value (per-transaction and daily INR caps, enforced in software).
- Approved counterparties only (KYB readiness gate passed).
- Approved providers only (provider go-live gate passed).
- Manual finality review on every settlement — no auto-finalization.
- No unrestricted live payout operations under this document.
- No automated expansion of scope, volume, or capability without written approval from both parties.

## 3. Roles and Responsibilities

**INRSettle provides:**

- Settlement operations UI for operators, approvers, and reviewers
- Quote-to-settlement workflow with rate-locked quotes
- Provider proof capture (webhook, polling, manual)
- Independent reconciliation workflow with source classification
- Finality review workflow (deterministic, evidence-based)
- Settlement report generation (audited)
- Audit logging across lifecycle, evidence, and approvals
- Monitoring and incident readiness (severity model, playbook, owners)
- KYB readiness visibility per counterparty
- Operator/approver controls with role-based access and dual control

**Partner/provider provides (as applicable):**

- Actual payout execution on its licensed rails
- Payout status accuracy and timely status updates
- UTR / transaction reference availability per payout
- Webhook delivery and signing documentation
- Exhaustive failure/reversal status mapping
- A named escalation contact with response expectations
- Its compliance/KYB requirements for INRSettle and pilot counterparties
- Explicit commercial approval before any production credential usage

**Customer provides:**

- Accurate transaction instructions and beneficiary details
- Source of funds explanation where required
- Counterparty details for KYB review
- Required KYB/KYC documents
- Commercial acceptance of pilot terms
- Timely review of settlement reports and queries

## 4. Funds Flow Boundary

- INRSettle does **not** custody funds unless separately agreed in writing.
- INRSettle does **not** represent a provider's "completed" status as final settlement.
- Provider "completed" is treated as a **provider claim only** — one evidence input among several.
- Settlement finality requires: provider proof, independent reconciliation
  (bank/PSP evidence — provider claims never qualify), a complete audit
  trail, finality review with dual-control approval, a generated settlement
  report, and passing pilot guardrails (caps, allowlist, safety tripwires).
- Any live funds movement occurs only through the approved partner/provider
  process, on the partner's rails and licenses.

## 5. Commercial Model Options

Open for discussion; one or a combination of:

- Monthly platform fee
- Per-settlement fee
- Per-report fee
- Pilot setup fee (one-time)
- Provider operations fee (per active provider integration)
- Enterprise/custom pricing
- Success-based pilot fee where appropriate (e.g., payable on pilot completion against the documented success criteria)

**Placeholders to be agreed:**

| Item | Value |
|---|---|
| Pilot setup fee | TBD |
| Monthly fee | TBD |
| Per-settlement fee | TBD |
| Minimum monthly commitment | TBD |
| Payment terms | TBD |

Pilot pricing carries no implied commitment to post-pilot pricing; production
terms are negotiated separately on pilot evidence.

## 6. SLA and Operations

| Area | Expectation |
|---|---|
| Provider status updates | Definitive outcome within ______ of execution; pending states actively progressed |
| Webhook delivery | Signed deliveries; INRSettle verifies signatures and falls back to status polling on misses |
| Reconciliation review window | Independent evidence ingested and matched within ______ business hours of settlement |
| Incident response | Per the incident severity model: Critical immediate, High ______ h, Medium ______ h, Low same business day |
| Escalation channel | Named contacts both sides; channel: ______ (e-mail/phone/messaging) |
| Support hours | ______ IST, business days (pilot transactions only executed when both operator and approver are available) |
| Report delivery | Settlement report available on finality; shared with approved parties within ______ |

## 7. Risk and Liability Boundaries

Practical allocation for the pilot (to be formalized by counsel):

- **Provider payout failure** — provider investigates and reports; the settlement is failed through the normal lifecycle with reason recorded; no liability for INRSettle beyond correct recording and reporting.
- **Provider reversed payout** — treated as an uncertain state requiring review; provider explains the reversal and confirms the funds position; no re-execution until documented.
- **Incorrect beneficiary details** — responsibility of the party that supplied them (customer/counterparty); INRSettle records what was instructed and what was executed.
- **Delayed bank rails** — not a default by any party; tracked as an operational incident with provider assistance.
- **Missing or invalid reconciliation evidence** — settlement remains unfinalized by design; parties cooperate to obtain bank/PSP evidence.
- **Blocked KYB/counterparty** — the transaction does not proceed; no party is obliged to execute against a blocked counterparty.
- **Sanctions/compliance issue** — immediate stop for affected transactions; each party follows its own legal obligations; cooperation on information requests.
- **Force majeure / rail outage** — pilot pauses; in-flight transactions monitored to completion; no penalty for the pause itself.
- **INRSettle software limitation during pilot** — INRSettle is pilot-stage software provided for a controlled test; INRSettle commits to fail-safe behavior (uncertain outcomes stay pending, nothing auto-finalizes) rather than guaranteed availability; remedies during pilot are correction and re-run, not financial liability, unless otherwise agreed.

## 8. Compliance and KYB

- Counterparty KYB readiness is required before any live-test participation: approved status on the readiness gate.
- Beneficial ownership (UBOs 10%+) review.
- Director/signatory details on file.
- Source of funds explanation where required.
- Sanctions/adverse media screening, dated.
- Commercial terms acceptance recorded.
- Provider onboarding requirements: INRSettle will complete the partner's own KYB/onboarding process; both perimeters are documented.

## 9. Incident Handling

Pilot incidents are handled per INRSettle's **Incident Handling Playbook**
(severity model, ownership, response steps, communication templates) and
tracked in the Monitoring / Incident Readiness command center. Binding
principles:

- Stop conditions (Section 10) are absolute — any one halts new pilot activity.
- Every incident leaves an audit trail; evidence requirements are not relaxed during incidents.
- No manual override occurs without a written audit note (who, what, why, when).

## 10. Pilot Stop Conditions

The pilot stops immediately — no new transactions, in-flight ones monitored
to completion — if any of the following occurs:

1. Unexpected production payout attempt
2. Provider reversed payout
3. Webhook verification failure pattern
4. Reconciliation mismatch with unexplained difference
5. Missing provider proof on an executed settlement
6. Missing independent reconciliation past the review window
7. Finality blocked without explanation
8. LIVE_TEST cap breach attempt
9. KYB-blocked counterparty attempt
10. Audit logging failure
11. Report generation failure unresolved same-day
12. Creator self-approval attempt (control fires; repeated attempts trigger process review)

Resumption requires documented root cause and written sign-off from both
parties' named owners.

## 11. Data and Confidentiality

- Partner data (commercial terms, API documentation, contacts, volumes) is handled confidentially and used only for the pilot.
- No provider secrets are exposed in logs, audit metadata, or reports — verified behavior, not policy aspiration.
- No raw sensitive headers or unverified webhook payloads are logged.
- Settlement reports are shared only with approved parties named by both sides.
- The audit trail is retained and available for review by the partner and relevant compliance reviewers for agreed retention period: ______.
- A mutual NDA can precede this term sheet where preferred.

## 12. Commercial Next Steps

1. Confirm pilot scope (transaction count, caps, corridor, window).
2. Confirm the provider's role and rails (execution, status, evidence fields).
3. Confirm funds flow responsibility in writing (Section 4 boundary).
4. Confirm fees (Section 5 placeholders).
5. Confirm operational contacts on both sides.
6. Confirm the escalation process and response expectations.
7. Confirm the KYB/onboarding checklist in both directions.
8. Confirm the production credential approval process (written, explicit).
9. Confirm written approval before any live-test transaction.

## 13. Partner-Facing Summary

INRSettle operates the control layer of INR settlement: every payout is
backed by provider proof, independent bank/PSP reconciliation, a complete
audit trail, dual-control finality review, and a generated report — and
nothing finalizes without all of them. We are proposing a deliberately
small, capped, manually reviewed pilot: approved counterparties, approved
providers, sandbox-verified rails, written stop conditions, and incident
procedures agreed before the first transaction. This document is a working
term sheet, not a contract — we would like to agree scope, fees, contacts,
and the funds-flow boundary with you, put counsel around it, and run a pilot
that produces evidence both sides can stand behind.

---

*Draft for discussion only. Not legal advice and not a binding agreement.
Both parties should obtain independent legal review before execution.*
