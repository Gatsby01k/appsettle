# INRSettle — Demo Proof Walkthrough

Founder demo guide for partners, PSPs, OTC desks, advisors, and early B2B
customers. The demo's job is to prove one discipline on screen, repeatedly:
**nothing finalizes on a provider claim alone.**

**Prep (5 minutes before the call):**

- Two browser profiles logged in: operator (`ops@…`) and approver (`approver@…`) — the dual-control moment needs both.
- One settlement already EXECUTING or SETTLED so you don't wait on lifecycle during the call.
- Demo focus mode (`?demo=1`) if you want only demo cases visible.
- Know your one-liner numbers: caps default INR 1,000/transaction, INR 2,000/day; finality needs six pillars.

---

## 1. Opening context (30 seconds, before any screen)

Say it plainly:

> "INRSettle is a settlement operations platform — not an unrestricted
> payout provider. Providers move the money; we run the control layer.
> One principle drives everything you're about to see: **payment completed
> does not equal settlement finalized.** A provider saying 'completed' is a
> claim. Our software refuses to finalize until that claim is proven,
> independently reconciled, audited, reviewed by a second person, and
> reported."

## 2–3. Demo flow, screen by screen

### Screen 1 — Quotes (Quote terminal)

- **Viewer sees:** the quote builder, a rate-locked quote with a live expiry countdown, and an explicit rate-source label ("Manual desk rate — no live FX feed").
- **Why it matters:** terms lock before money is discussed; quotes expire; nothing executes from a stale price.
- **Risk reduced:** rate disputes and silent repricing.
- **Likely question:** *"Where does the rate come from?"* — Answer honestly: a configured desk rate, fail-closed in production if unset; live FX feeds are a roadmap item, not a claim.

### Screen 2 — Settlements (case cards)

- **Viewer sees:** settlement case files with a mode chip (DEMO/SHADOW/LIVE_TEST), a lifecycle rail, and a four-pillar evidence chain (Provider proof / Reconciliation / Audit trail / Finality).
- **Why it matters:** every settlement is a case with evidence state, not a row in a table. The first unverified pillar is highlighted as the blocker.
- **Risk reduced:** "where are we on this payment?" ambiguity; ops chasing status by chat.
- **Likely question:** *"What are the modes?"* — DEMO is fake data; SHADOW tracks a real external operation; LIVE_TEST is a tiny capped provider test with entry guardrails.

### Screen 3 — Provider proof capture

- **Viewer sees:** the provider tracking panel on an EXECUTING settlement; proof records with transaction ID, provider status, channel (webhook/poll/manual), and timestamps.
- **Why it matters:** proof is append-only and idempotent — a re-delivered webhook can't duplicate evidence or transitions. Only provider-reported values are stored; we never substitute expected amounts.
- **Risk reduced:** double-processing, fabricated agreement between expectation and reality.
- **Likely question:** *"What if our webhook doesn't arrive?"* — Status polling is the fallback; signature verification and a replay window protect the endpoint.

### Screen 4 — Provider completed = provider claim

- **Viewer sees:** a SETTLED settlement where provider status reads "completed" — and the Reconciliation pillar still says Pending, finality still not ready.
- **Why it matters:** **this is the core slide of the demo.** The provider said done; the system still refuses to finalize.
- **Risk reduced:** booking settlements off provider say-so; the failure mode behind most reconciliation write-offs.
- **Likely question:** *"Isn't this overkill for small amounts?"* — The discipline is cheap in software and priceless in an audit; it's the same flow at any amount.

### Screen 5 — Independent reconciliation

- **Viewer sees:** the reconciliation console: external bank/PSP records, source classification chips ("Independent evidence" / "Provider claims excluded"), confidence-scored auto-match, manual review queue.
- **Why it matters:** only independent sources reconcile a settlement — a provider claim record is structurally excluded from counting.
- **Risk reduced:** circular verification (provider confirming itself).
- **Likely question:** *"What formats can you ingest?"* — Today: manual capture and structured records; statement-format ingestion is agreed per-partner (this is one of the things we ask partners for).

### Screen 6 — Finality review

- **Viewer sees:** the finality panel: decision (ready / needs review / not ready), confidence breakdown, named blockers, and the safety gate (caps, tripwire).
- **Why it matters:** finality is deterministic — same evidence, same answer. There is no force-finalize button anywhere in the product.
- **Risk reduced:** judgment-call finalization under pressure.
- **Likely question:** *"Can an admin override it?"* — No. Missing evidence can only be fixed by supplying evidence.

### Screen 7 — Creator self-approval blocked (live)

- **Viewer sees:** you, as the operator who created the settlement, click approve — and the server rejects it with the dual-control error, on screen.
- **Why it matters:** dual control is enforced in software, not in a policy PDF. Demonstrate the failure deliberately.
- **Risk reduced:** single-operator fraud and error; the classic "one person did everything" finding.
- **Likely question:** *"What if you're a one-person company?"* — The demo org has a real second approver account; staffing the role is a pilot precondition.

### Screen 8 — Approver approval

- **Viewer sees:** switch profiles; the approver approves finality; the audit log records who, when, and that approver ≠ creator.
- **Why it matters:** the approval itself becomes evidence.
- **Risk reduced:** unaccountable approvals.

### Screen 9 — Settlement report

- **Viewer sees:** the per-settlement report: amounts, proof, reconciliation source, approvals, mode — print-ready.
- **Why it matters:** the report is generated from recorded evidence (and its generation is itself audited) — it's the artifact a partner or reviewer takes away.
- **Risk reduced:** hand-assembled, unverifiable settlement summaries.
- **Likely question:** *"Can we get these per transaction?"* — Yes, that's exactly what they are.

### Screen 10 — Audit trail

- **Viewer sees:** the audit log: lifecycle transitions, proof events, reconciliation matches, finality approval, report generation, even rejected webhook deliveries — in order, org-scoped.
- **Why it matters:** every claim the demo made is checkable here.
- **Risk reduced:** unreconstructable history.

### Screen 11 — KYB readiness (`/kyb`)

- **Viewer sees:** counterparty cards: 16-point KYB checklist, risk rating, 8-point pilot eligibility gate, missing items, a blocked counterparty example.
- **Why it matters:** counterparties don't join the pilot on a handshake; the gate names exactly what's missing.
- **Risk reduced:** onboarding unknown principals into a real-money test.
- **Likely question:** *"Is this enforced in the flow?"* — Today it's a control screen with a documented process; flow-level enforcement is on the roadmap and we say so.

### Screen 12 — Provider risk (`/providers`)

- **Viewer sees:** Provider Risk Shield: per-provider risk passports, trust scores with the gaps that explain them, go-live gates, exposure limits, a mock kill switch.
- **Why it matters:** we grade our providers with the same honesty we grade ourselves — both current providers show open gate items.
- **Risk reduced:** routing real money over a commercially unfinished rail.
- **Likely question (from a provider):** *"What would make us 'Pilot Ready'?"* — Show their gate list: that IS the answer, and it doubles as your asks.

### Screen 13 — Monitoring / incident readiness (`/monitoring`)

- **Viewer sees:** the pilot command center: system health, provider health, alert rules, an incident queue with SLAs and owners, freeze status (live payouts: Disabled).
- **Why it matters:** incidents have a written playbook, owners, and stop conditions agreed before the first real transaction.
- **Risk reduced:** improvising during the first real-money incident.
- **Honest note if asked:** assessed state today, automated probes are an open item — it's marked as such on the screen itself.

### Screen 14 — Pilot readiness proof pack (`/pilot-readiness`)

- **Viewer sees:** the go/no-go matrix: product controls green, and the open items — provider gates, counterparty packs, legal perimeter — shown as Needs Review / **Blocked**, on our own dashboard.
- **Why it matters:** end on candor. A readiness page that admits what's not ready is the strongest trust signal in the demo.
- **Likely question:** *"When do you go live?"* — When every row passes and both sides sign the limits. Not before.

## 4. 3-minute demo script

> "Quick version. INRSettle runs the control layer of INR settlement —
> providers move money, we prove it settled. [Quotes] Terms lock here, with
> an expiry. [Settlements] Every settlement is a case with four evidence
> pillars. Watch this one — the provider already says *completed*… and the
> system still says not ready. That's the whole product: provider completed
> is a claim. [Reconciliation] It needs an independent bank record — provider
> claims are structurally excluded from counting. [Finality] Now watch me
> approve my own settlement — rejected. Dual control is in the software.
> [Switch profile] Second operator approves; [Report] here's the evidence
> report; [Audit] and here's every step recorded. We're preparing a small,
> capped, manually reviewed pilot — and here's our own go/no-go page showing
> exactly what's still open. That candor is the product."

## 5. 7-minute deeper demo script

Minutes 1–2 — Quote and settlement: rate lock, expiry, lifecycle, modes
(DEMO/SHADOW/LIVE_TEST and what the caps are). State the funds-flow boundary
early: "we never hold or move funds."

Minutes 2–4 — The evidence chain: proof capture (idempotent, append-only,
webhook signatures + replay window, poll fallback), then the core moment —
provider "completed" with reconciliation still pending. Then reconciliation:
independence classification, confidence-scored auto-match, manual review.
Pause here; this is where serious partners ask questions.

Minutes 4–5 — Finality and dual control: deterministic decision, no
override path, live self-approval rejection, approver flow on the second
profile, the audit entry it produces.

Minutes 5–6 — The institution around it: report output, audit trail, KYB
gate (show the blocked counterparty), Provider Risk Shield (show their own
gate if they're a provider), monitoring and the incident playbook.

Minutes 6–7 — Pilot readiness: the go/no-go matrix with its honest Blocked
rows, default caps, stop conditions, and what a pilot would look like — one
route, one counterparty, a handful of capped transactions, written limits.
Then the closing ask.

## 6. Closing ask

Three questions, then stop talking:

1. **"What would you want to see different or additional before you'd trust a controlled pilot like this?"** (pilot feedback)
2. **"What provider, status, and reconciliation fields does your side require or provide — status strings, UTR fields, statement formats, webhook signing?"** (integration specifics)
3. **"Could you support a limited pilot scope — one route, one counterparty, capped amounts, written stop conditions? If yes, what's your process to approve it?"** (the actual ask)

Whatever they answer, follow up within a day with the proof pack
(`docs/pilot-readiness-index.md`) and the term sheet draft
(`docs/commercial-partner-terms.md`).
