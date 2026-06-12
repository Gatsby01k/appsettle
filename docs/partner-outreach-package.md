# INRSettle — Partner Outreach Package

Practical outreach material for INR payout providers, PSPs, OTC desks,
fintech infrastructure providers, and early B2B customers. Everything here is
copy-ready and consistent with the proof pack (`docs/pilot-readiness-index.md`).

---

## 1. Short Partner Message (LinkedIn / e-mail / Telegram)

> We're building INRSettle — a settlement operations platform for INR payout
> workflows. We handle the control layer: provider proof, independent
> reconciliation, audit trail, finality review, reports, KYB readiness,
> monitoring, and incident readiness. We're preparing a controlled pilot and
> we're not asking for unrestricted live payout access — we're looking for a
> sandbox/pilot-scope operational discussion with a provider that takes
> settlement evidence as seriously as we do. Open to a short call?

## 2. Longer Email Version

> Subject: Controlled INR settlement pilot — operational discussion
>
> Hello {name},
>
> **Who we are.** INRSettle is a B2B settlement operations platform for INR
> payout workflows, typically around stablecoin-funded treasury flows. We do
> not move funds — we operate the control and evidence layer around
> providers who do.
>
> **What INRSettle does.** Every payout we track is backed by provider proof,
> an independent bank/PSP reconciliation record, a complete audit trail, a
> dual-control finality review, and a generated settlement report. Our
> software refuses to finalize a settlement on a provider claim alone.
>
> **Current readiness.** The platform is built and regression-tested:
> quote-to-settlement lifecycle, idempotent proof capture, source-classified
> reconciliation, deterministic finality, RBAC with dual control, KYB
> readiness gating, monitoring, and a written incident playbook. We maintain
> an honest go/no-go readiness pack and we are explicitly not production-
> approved yet — sandbox rails only until jointly agreed otherwise.
>
> **Controlled pilot scope.** A small number of transactions, tightly capped
> amounts, one approved counterparty, manual review on every settlement,
> documented stop conditions, and no automated expansion.
>
> **What we'd need from you.** Sandbox or approved pilot access, your payout
> status endpoint, webhook signing documentation, UTR/proof fields, your
> failure/reversal status mapping, an escalation contact, commercial terms,
> and your KYB/onboarding requirements for us.
>
> **Proposed next step.** A 30-minute call to walk through our proof pack and
> agree whether a capped pilot makes sense. We can share the full readiness
> documentation in advance.
>
> Best regards,
> {founder name} — INRSettle

## 3. What INRSettle Can Show

A working product, live in a demo session:

- Quote → Settlement workflow (rate-locked quotes, full lifecycle state machine)
- Provider Proof capture (webhook/poll/manual; idempotent; append-only)
- Independent Reconciliation (provider claims structurally excluded)
- Finality Review (deterministic; named blockers; no force-finalize)
- Dual-control approval (second operator on lifecycle approval and finality)
- Creator self-approval blocked — server-side, demonstrable on request
- Settlement Reports (generated and audited per settlement)
- Audit Logs (org-scoped, append-only, covering every control event)
- Shadow Mode (DEMO / SHADOW / LIVE_TEST with caps and entry guardrails)
- Provider Risk Shield (readiness passports, go-live gates, exposure limits)
- KYB / Counterparty Readiness (checklist, risk rating, eligibility gate)
- Monitoring / Incident Readiness (command center plus written playbook)
- Pilot Readiness proof pack (documents + in-product go/no-go overview)

## 4. What INRSettle Needs From a Partner

- Sandbox or approved pilot access
- Payout status endpoint (polling is our fallback for missed callbacks)
- Webhook signing documentation (algorithm, headers, timestamp semantics)
- UTR / transaction proof fields per payout
- Reversal/failure status mapping — the exhaustive status list
- A named escalation contact
- Commercial terms (pricing, prefunding, cut-offs)
- Your KYB/onboarding requirements for us as a client
- Your production credential approval process, if and when applicable

## 5. Controlled Pilot Scope

- Limited transactions (counted, hard stop)
- Limited amounts (per-transaction and daily INR caps, enforced in software)
- Approved counterparty only (KYB gate passed)
- Approved provider only (go-live gate passed)
- Manual finality review on every settlement
- No unrestricted live payouts
- No automated expansion — any scope change is a new written decision
- Stop conditions documented and binding before the first transaction

## 6. Safety Positioning

- Payment completed does not equal settlement finalized.
- Provider completed does not equal ready to finalize.
- Provider claims require proof **and** independent reconciliation — a bank/PSP record, never the provider's own status.
- Finality requires proof, reconciliation, audit trail, review, report, and guardrails — all six, every time.
- No creator self-approval — enforced in software, not policy.
- No live payout expansion results from this outreach; sandbox remains the default until explicitly agreed in writing.

## 7. Partner Objections / Answers

**Are you a payment provider?**
No. We operate the settlement control layer — proof, reconciliation, audit,
finality, reporting. Licensed providers execute payouts.

**Do you custody funds?**
No, not unless separately agreed in writing. The pilot involves no custody by
INRSettle.

**Are live payouts enabled?**
No. The live-payout flag in our system is a tripwire that only blocks;
nothing in the codebase reads it as permission to execute. All rails are
sandbox today.

**Why do we need this if the provider already says "completed"?**
Because "completed" is a claim. Operations teams reconcile claims against
bank evidence anyway — we make that discipline structural: our software
cannot finalize a settlement on a provider status alone.

**How do you handle failed or reversed payouts?**
Failures are recorded as evidence and the settlement fails through the
normal lifecycle with the reason kept. Reversals never auto-fail — they open
an operator review, because money may have moved and returned. Unknown
statuses stay pending, never failed.

**What do you need from us first?**
Sandbox access, status endpoint and webhook signing docs, your
failure/reversal status list, and a named contact. Commercial discussion can
run in parallel.

**Is this production-ready?**
The control layer is built and regression-tested; we are deliberately not
approved for unrestricted live operations and we say so in our own readiness
pack. The pilot is how we earn that, together with a partner.

**What is the pilot size?**
Small by design: single provider route, single counterparty, capped amounts
(default caps: INR 1,000 per transaction, INR 2,000 per day), a handful of
transactions, manual review on each.

## 8. First Pilot Ask

What we are actually asking for — nothing more:

1. **1 approved provider route** (single corridor, USDT → INR)
2. **1 approved counterparty** (KYB pack completed on our side)
3. **A small capped test amount** (within the limits above)
4. **Status + webhook proof** (so every payout has verifiable provider evidence)
5. **Reconciliation evidence** (statement/report format we can ingest)
6. **An escalation contact** (named, with response expectations)
7. **Written pilot limits** (amounts, count, window, stop conditions — signed by both sides)

## 9. Founder Follow-Up Message

> Thanks {name} — glad this resonates. Suggest we do a 30-minute call: I'll
> walk you through the proof pack (workflow, evidence chain, readiness
> go/no-go) and you can tell us what your side needs for a sandbox/pilot
> scope. I'll send the readiness documents ahead of the call so we can spend
> the time on specifics — limits, status/webhook behavior, reconciliation
> format, and contacts. What does your calendar look like this week?

## 10. Partner-Facing Summary (copy-ready)

> INRSettle is a settlement operations platform for INR payout workflows. We
> operate the control layer: every payout is backed by provider proof, an
> independent bank/PSP reconciliation record, a complete audit trail,
> dual-control finality review, and a generated settlement report — and our
> software refuses to finalize on anything less. We are preparing a
> deliberately small, capped, manually reviewed pilot: one provider route,
> one KYB-approved counterparty, written limits and stop conditions, sandbox
> rails until jointly approved otherwise. We are not asking for unrestricted
> live payout access — we are asking for a working session to agree a pilot
> scope that produces evidence both sides can stand behind.
