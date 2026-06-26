# INRSettle Commercial Product Audit

> Read-only audit. No code, schema, secrets, or payout settings were changed to produce this.
> Date: 2026-06-12.

---

## 1. Executive Summary

**What INRSettle currently feels like.** Two products wearing one name. The
**authenticated app** has been hardened into a credible *settlement evidence and
control system*: quote → settlement → provider proof → independent
reconciliation → audit → finality review → report, with RBAC, dual-control,
KYB readiness, provider risk, monitoring, and a pilot-readiness proof pack. That
half tells the right story. The **public landing page** tells a different,
riskier story: "Stablecoin Settlement Infrastructure for India Payment Flows",
"INR ↔ USDT treasury and settlement **rails**", "24/7 **liquidity**",
"Modernize Your India Settlement **Stack**". A reader of the marketing site
reasonably concludes INRSettle *moves money, provides rails, and supplies
liquidity* — the exact thing the product must not claim.

**What it should become.** A focused **settlement operations control room**: the
system of record that proves a payout actually settled, sold to teams who
*already* move money through providers. The promise is verification and control,
not movement. "Providers move money. INRSettle proves what happened."

**The biggest gap.** Positioning incoherence between the landing page (movement/
infrastructure language) and the app (proof/control language), compounded by an
app surface that is *too broad for a first sale* — 16 nav items, several of
which are mock control screens — with no pricing, no onboarding, and no
single obvious "what you buy" path. Fix the story and narrow the surface and
this is demo- and paid-pilot-ready; leave them and it reads as an ambitious
demo.

---

## 2. Correct Product Definition

**One sentence.**
INRSettle is the settlement operations control layer that proves a payout
actually finalized — provider proof, independent reconciliation, audit trail,
and finality review in one workspace — for teams that already move money through
providers.

**One paragraph.**
INRSettle is a B2B settlement operations platform for teams running INR payout,
stablecoin treasury, OTC/on-off-ramp, PSP, and payment operations workflows. It
does not move funds. Providers move money; INRSettle records and proves what
happened: it captures structured provider proof, requires an independent
bank/PSP reconciliation record (provider claims never count on their own), keeps
an immutable audit trail, and runs a deterministic finality review that refuses
to mark a settlement final until proof, reconciliation, and approvals agree —
under dual control, with KYB and pilot guardrails around it. The output is a
settlement report you can hand to a partner, an auditor, or a regulator.

**Investor / customer positioning.**
"Payment completed ≠ settlement finalized." Every team moving money through
payout providers eventually eats a loss, a dispute, or an audit finding because
"the provider said it was done" was treated as truth. INRSettle is the control
room that turns provider claims into proven, reconciled, audited settlement
finality — the operating layer that sits *on top of* the rails everyone already
uses, not a new rail. We sell certainty and auditability to the people
responsible when money is supposed to have moved.

---

## 3. Current Product Story (what the app actually says today)

- **Landing page:** "We are stablecoin settlement infrastructure / rails /
  liquidity for India payment flows." This reads as a *payment/treasury
  infrastructure provider that moves INR↔USDT* — i.e., a processor/treasury
  rail. Wrong and risky.
- **App shell:** "A broad treasury + settlement operations suite." 16 nav items
  across Operations / Treasury / Organization. Impressive, but it signals
  "platform that does everything" rather than "the one thing you buy."
- **Core flow (Quotes → Settlements → Reconciliation → Finality → Report):**
  This is the *right* story and it is genuinely present and well-built: provider
  proof is a claim, independent reconciliation is required, finality is
  deterministic, dual-control holds. A knowledgeable operator who reaches the
  Settlements case cards will "get it."
- **Control screens (Providers, KYB, Monitoring, Pilot Readiness):** These
  correctly frame INRSettle as a control/visibility layer and are honest about
  being snapshots/mocks — strong for the thesis, but they currently sit at the
  same visual weight as core paid functionality, which dilutes focus.
- **Net:** the app *under-sells* the sharp thesis on first contact (you have to
  navigate to find it) while the landing page *mis-sells* it.

---

## 4. Intended Product Story

A single, repeatable narrative everywhere:

1. Providers move money. You already use them.
2. "Completed" from a provider is a claim, not proof.
3. INRSettle captures the proof, demands an independent reconciliation record,
   keeps the audit trail, and runs finality review under dual control.
4. Nothing is "final" until the evidence agrees.
5. You get a settlement report that stands up to a partner, auditor, or
   regulator.

The hero of the story is **finality you can prove**, and the buyer is the person
**accountable** when settlement is questioned — head of payment ops, treasury
lead, COO/founder of a payout/OTC/PSP business.

---

## 5. Alignment Score (1–10)

| Dimension | Score | Note |
|---|---|---|
| Product clarity | 6 | Sharp thesis exists but buried under breadth; landing contradicts it |
| ICP clarity | 4 | "Merchants, PSPs, payment operators, treasury" is everyone = no one |
| Commercial readiness | 3 | No pricing, no onboarding, no "buy" path in-product |
| Demo readiness | 7 | Core flow + control screens demo very well with a guided script |
| Paid pilot readiness | 5 | Pilot docs exist; product lacks pilot scoping/limits UI + billing |
| Investor readiness | 5 | Strong thesis + build quality; weak ICP, traction, and metrics story |
| Compliance / safety clarity | 5 | App is careful; landing implies money movement/liquidity (risk) |
| UX / navigation clarity | 5 | 16 items, mock screens at full weight, no role-based entry |
| Copy quality | 6 | App copy is strong post-audit; landing + a few empty states weak |
| Technical readiness | 8 | Genuinely strong: tests, RBAC, dual-control, idempotency, fail-closed |

**Headline:** technically the strongest dimension, commercially the weakest.
The gap is positioning and packaging, not engineering.

---

## 6. Page-by-Page Audit

> Importance = commercial weight for a first sale. Risk = positioning/compliance/UX risk.

### Landing `/` (`index.html` via `components/marketing/static-marketing-page.tsx`)
- **Purpose:** convert cold visitors.
- **Works:** premium visual quality; hero console demonstrates the workflow; rail/proof motion is on-brand.
- **Confusing/risky:** headline and body sell *infrastructure/rails/liquidity*, not proof/control. "Stablecoin Settlement Infrastructure", "settlement rails", "24/7 liquidity needs", "Modernize Your India Settlement Stack."
- **Should change:** reposition top-to-bottom to the proof/finality thesis; remove "rails/liquidity/infrastructure-that-moves-money" language; add an explicit "INRSettle does not move funds" line; add ICP and paid-pilot CTA.
- **Importance: high · Risk: high.**
- **Copy:** H1 → "Prove every settlement is actually final." Sub → "Providers move the money. INRSettle proves what happened — provider proof, independent reconciliation, audit trail and finality review in one workspace." (Section 12 has the full set.)

### Login `/login` (`app/(auth)/login/page.tsx`)
- **Purpose:** access gate / first trust point.
- **Works:** premium redesign, Trust Stack, evidence mini-flow, no live-money implication.
- **Confusing:** none material.
- **Should change:** keep. Optionally surface the thesis line already present.
- **Importance: medium · Risk: low.**

### Overview `/dashboard`
- **Purpose:** operational state at a glance.
- **Works:** real metrics, evidence-stream activity, finality emphasis.
- **Confusing:** "Treasury operations console" framing leans treasury, not proof.
- **Should change:** lead the Overview with finality posture (how many settlements are *proven final* vs *awaiting evidence*) as the hero stat.
- **Importance: high · Risk: low.**

### Quotes `/quotes`
- **Purpose:** rate-locked quote → settlement entry.
- **Works:** terminal UI, expiry, explicit "manual desk rate, no live FX feed."
- **Confusing:** quotes can read as "we price FX/liquidity." It is operational scaffolding, not a pricing engine.
- **Should change:** label clearly as "operational quote (your desk rate)"; keep the no-FX-feed disclaimer prominent.
- **Importance: medium · Risk: medium** (FX/pricing implication).

### Settlements `/settlements`
- **Purpose:** the core case workspace — the product.
- **Works:** case cards, evidence chain (Proof/Recon/Audit/Finality), state-based actions, dual-control.
- **Confusing:** competes for attention with 15 other nav items.
- **Should change:** make this the default landing surface after login; it *is* the product.
- **Importance: high · Risk: low.**

### Reconciliation `/reconciliation`
- **Purpose:** independent evidence matching.
- **Works:** independence classification, "provider claims excluded", finality-impact banner (post-polish).
- **Confusing:** demo utilities (now in a dropdown) must never look like production ingestion.
- **Should change:** keep; ensure real ingestion path is clearly the primary, demo clearly secondary.
- **Importance: high · Risk: low.**

### Finality review (within `/settlements/[id]/shadow`)
- **Purpose:** the decision moment + dual-control.
- **Works:** deterministic decision, named blockers, creator-self-approval blocked server-side.
- **Confusing:** lives under a route literally named "shadow"; buyers won't guess that's where finality is.
- **Should change:** surface finality review as a first-class concept/route name; "shadow" is internal jargon.
- **Importance: high · Risk: low.**

### Settlement Report `/settlements/[id]/report`
- **Purpose:** the deliverable artifact.
- **Works:** evidence-backed, audited generation, print-ready.
- **Should change:** this is a key *sellable* output — feature it in demo and landing.
- **Importance: high · Risk: low.**

### Reports `/reports`
- **Purpose:** export/index.
- **Works:** org-scoped counts.
- **Confusing:** overlaps conceptually with per-settlement report; thin.
- **Should change:** position as "evidence exports / period reporting"; or fold into Settlements.
- **Importance: medium · Risk: low.**

### Audit Logs `/audit-logs`
- **Purpose:** immutable evidence trail.
- **Works:** premium hero, actor-type badges, finality framing (post-polish).
- **Importance: high (trust signal) · Risk: low.**

### Providers / Provider Risk Shield `/providers`
- **Purpose:** provider readiness/risk gating.
- **Works:** decision-screen redesign, trust score, go-live gate, honest open items.
- **Confusing:** mock kill switch; could imply INRSettle controls providers.
- **Should change:** keep mock labels explicit; frame as "your assessment of providers," not "we govern providers."
- **Importance: medium · Risk: medium** (provider-guarantee implication).

### KYB / Counterparties `/kyb`, `/counterparties`
- **Purpose:** counterparty readiness gating + directory.
- **Works:** checklist, eligibility gate, blocked example.
- **Confusing:** `/kyb` (mock control screen) and `/counterparties` (sample directory) overlap; neither is enforced in the settlement flow.
- **Should change:** merge into one "Counterparties & KYB" area; state plainly it's a readiness register, not an onboarding/identity provider.
- **Importance: medium · Risk: medium** (could imply INRSettle performs KYC/KYB).

### Monitoring `/monitoring`
- **Purpose:** pilot command center.
- **Works:** health, incident rules/queue, freeze status, evidence readiness.
- **Confusing:** "assessed state," not live probes; mock freeze.
- **Should change:** label "operational readiness view (assessed)"; keep freeze mock-explicit.
- **Importance: low–medium · Risk: medium** (could imply live monitoring/control it doesn't have).

### Pilot Readiness `/pilot-readiness`
- **Purpose:** go/no-go proof pack.
- **Works:** candid go/no-go matrix, stop conditions, non-approval statement.
- **Confusing:** internal-facing; investors love it, customers may not.
- **Should change:** keep as an internal/investor surface; deprioritize in the customer nav.
- **Importance: medium (investor) · Risk: low.**

### Accounts `/accounts`
- **Purpose:** balances/wallets view.
- **Confusing/risky:** "Available INR / USDT liquidity / treasury wallets" strongly implies INRSettle *holds funds and provides liquidity*. This is the single most off-thesis app page.
- **Should change:** either remove for the commercial cut, or reframe explicitly as "reference/operational balances you record — INRSettle holds no funds."
- **Importance: low · Risk: high.**

### Team `/team`
- **Purpose:** RBAC / dual-control roster.
- **Works:** real members, approver counter, dual-control explainer.
- **Importance: medium (trust) · Risk: low.**

### API Reference `/api-reference`, Developers, Docs
- **Purpose:** integration story.
- **Confusing:** API implies "build on us"; fine, but endpoints must read as *evidence/reporting* APIs, not *payout* APIs.
- **Importance: medium · Risk: medium** (payout-API implication).

### Settings `/settings`
- **Purpose:** org config.
- **Importance: low · Risk: low.**

### Marketing sub-pages (`/infrastructure`, `/inr-settlement-india`, `/use-cases`, `/risk`, `/security`, `/compliance`, `/status`, `/pontis`)
- **Confusing/risky:** `/infrastructure` and `/inr-settlement-india` names reinforce the "we are rails/infrastructure" misread.
- **Should change:** rename/reframe toward "settlement operations" and "proof/finality"; audit each for liquidity/rails language.
- **Importance: low–medium · Risk: medium.**

---

## 7. Copy and Messaging Audit

| File | Current text | Why weak/misaligned | Replacement | Copy-only safe? |
|---|---|---|---|---|
| `index.html` (H1) | "Stablecoin Settlement Infrastructure for India Payment Flows" | Implies INRSettle *is* settlement infrastructure that moves money | "Prove every settlement is actually final." | Yes |
| `index.html` (lead) | "INR ↔ USDT treasury and settlement rails for merchants, PSPs…" | "rails" implies money movement; ICP too broad | "The control layer that proves what your payout providers actually settled — for INR payout, OTC and PSP operations teams." | Yes |
| `index.html` (problem card) | "24/7 liquidity needs / Operators need access to liquidity…" | Implies INRSettle provides liquidity | "24/7 settlement uncertainty — operations run when banks don't, but proof can't wait." | Yes |
| `index.html` (CTA band) | "Modernize Your India Settlement Stack / INR ↔ USDT settlement … on one corridor-native operating layer" | Implies a settlement/movement stack | "Prove your settlements. Add the control layer your providers don't give you." | Yes |
| `index.html` (footer) | "Stablecoin settlement infrastructure for India payment flows." | Same infra/movement implication | "Settlement proof and finality control for teams that move money through providers." | Yes |
| `app/(dashboard)/accounts/page.tsx` | "Available INR / USDT liquidity / treasury wallets" | Implies INRSettle holds funds & provides liquidity | "Reference balances you record. INRSettle holds no funds." (or remove from commercial cut) | Copy-safe to reframe; removal is UI change |
| `app/(dashboard)/dashboard/page.tsx` | "Treasury operations console" | Leans treasury-movement, not proof | "Settlement finality console" | Yes |
| `quotes/page.tsx` | "Quote terminal / execution" wording | "execution" can imply payout execution | "Operational quote (desk rate)" / "create settlement from quote" | Yes |
| route name `…/shadow` | "Shadow" | Internal jargon for the finality surface | Expose as "Finality review" in nav/labels | Label-safe; route rename is UI change |
| `/infrastructure` page/nav | "Infrastructure" | Reinforces "we are rails" | "How it works" / "Settlement operations" | Yes |
| Generic empty states ("No … yet") across pages | varies | Miss the chance to teach the thesis | Add one-line thesis-aligned hint, e.g. "Settlements appear here once a provider payout is recorded for proof." | Yes |

---

## 8. Compliance / Positioning Risk Audit

| # | File / surface | Current wording/behavior | Risk it implies | Recommended fix |
|---|---|---|---|---|
| 1 | `index.html` hero/footer | "Stablecoin Settlement Infrastructure", "settlement rails" | INRSettle **processes funds / is a rail** | Reposition to proof/control; add "INRSettle does not move funds" line in hero and footer |
| 2 | `index.html` problem cards | "24/7 liquidity needs", "access to liquidity" | INRSettle **provides liquidity** | Remove liquidity framing; replace with settlement-uncertainty framing |
| 3 | `app/(dashboard)/accounts/page.tsx` | "Available INR/USDT liquidity", "treasury wallets" | INRSettle **holds funds / provides liquidity** | Reframe as recorded reference balances, or remove for commercial cut |
| 4 | `index.html` CTA | "Modernize Your India Settlement Stack" | INRSettle **is the settlement stack (moves money)** | Reframe as control/proof layer added on top |
| 5 | `quotes` "execution" copy | "execution terminal" | INRSettle **executes payouts** | Use "record/operate," reserve "execution" for the provider |
| 6 | `/providers` kill switch + "freeze provider" | Mock control over providers | INRSettle **governs/guarantees providers** | Keep "mock control" labels; add "your assessment; INRSettle does not control or guarantee providers" |
| 7 | `/kyb` | KYB checklist screen | INRSettle **performs KYC/KYB** | State "readiness register; you perform KYB, we record the gate" |
| 8 | `api-reference` / developers | Endpoints incl. `/v1/settlements`, `/v1/reconciliation` | INRSettle exposes a **payout API** | Frame API as evidence/reconciliation/reporting; clarify it records, not pays |
| 9 | `inr-settlement-india`, `infrastructure` pages | infra/corridor/rails framing | Rail/processor implication | Rename + reframe to operations/proof |
| 10 | Hero console live numbers | "Available INR ₹42.8M", flowing legs | Could read as **real custodied balances/flows** | Label the console "illustrative operational view" |

**Cross-cutting fix:** adopt one mandatory disclaimer line, used on landing, pricing, and pilot docs: *"INRSettle is a settlement operations and proof platform. It does not move, custody, route, or provide funds or liquidity. Providers move money; INRSettle records and proves settlement."*

---

## 9. Commercial Readiness Gaps

**To charge for a paid pilot:**
- Product: a pilot scoping/limits surface customers can see (caps, counterparties, providers, stop conditions) — exists in docs, not as a customer-facing in-app object.
- Product: data ingestion path for *their* real records (CSV/upload/API) so reconciliation isn't demo-only.
- Product: per-customer workspace isolation messaging (org scoping exists technically; needs to be visible/trustable).
- Copy: a pricing/offer page and an explicit "what you get / what we do / what we don't do" panel.
- Copy: a one-page pilot SOW (the docs exist — surface as a sellable offer).

**To charge monthly SaaS:**
- Billing/subscription (none present).
- Seat/role plan tiers mapped to RBAC.
- Self-serve onboarding (org create, invite, first settlement) — currently seed/script-driven.
- Usage/value metric in-product (settlements proven, exceptions caught, reports generated).

**Settlement ops review (services):**
- A structured "ops review" deliverable template (can reuse audit/proof-pack docs).
- Intake form + scheduling (contact flow exists; not productized).

**Provider workspace:**
- Provider-facing read-only view or shared report link (currently operator-only).

**Investor demo:**
- A single guided "golden path" demo dataset and script (the dry-run runbook is close).
- Metrics/traction slide hooks (design partners, pilots, LOIs) — not yet real.

---

## 10. Final Product Direction

- **Primary ICP:** operations/treasury leads at **INR payout providers, OTC desks, and on/off-ramp businesses** moving money through third-party providers at volume, who get burned by "completed ≠ settled."
- **Secondary ICP:** **PSPs and cross-border/stablecoin treasury teams** needing audit-grade settlement evidence for partners/regulators.
- **Core promise:** "Prove every settlement is final — or know exactly why it isn't."
- **Main workflow:** Quote → Settlement → Provider Proof → Independent Reconciliation → Audit Trail → Finality Review → Settlement Report.
- **Must-have pages:** Settlements (home), Reconciliation, Finality Review, Settlement Report, Audit Logs, Providers (risk), Counterparties/KYB, Team/RBAC, Settings, Pricing/Pilot.
- **Must-have reports:** per-settlement Settlement Report; period evidence export; exception/finality summary.
- **Must-have CTAs:** "Start a paid pilot", "Book a settlement ops review", "See a sample settlement report."
- **Must-have trust signals:** "does not move funds" statement; dual-control; immutable audit; independent-reconciliation rule; KYB gate; SOC2-aligned roadmap (honestly stated).
- **Must-not-have distractions:** liquidity/treasury-wallet framing; "rails/infrastructure" language; anything implying payout execution, FX pricing, custody, or provider guarantees.

---

## 11. Recommended App Structure

Collapse 16 items into role-aware groups; lead with the product.

```
Settle (core)
  • Settlements        ← default after login (the product)
  • Reconciliation
  • Finality review     ← promoted out of "shadow"
  • Reports            ← settlement reports + exports

Counterparties & providers
  • Counterparties & KYB   ← merge /kyb + /counterparties
  • Providers (risk)

Assurance
  • Audit logs
  • Monitoring (assessed)  ← deprioritized
  • Pilot readiness        ← internal/investor (hide from customer default)

Organization
  • Team & access
  • Settings
  • API & docs
```

Drop or merge for the commercial cut: **Accounts** (high-risk, off-thesis),
**Quotes** as a top-level item (fold into Settlements as "new settlement"),
collapse marketing `/infrastructure` + `/inr-settlement-india` into one
"How it works."

---

## 12. Recommended Landing / Sales Story

- **Hero headline:** "Prove every settlement is actually final."
- **Subheadline:** "Providers move the money. INRSettle proves what happened — provider proof, independent reconciliation, audit trail and finality review in one workspace. We never touch funds."
- **Main sections:**
  1. The problem — "Completed ≠ settled" (the loss/dispute/audit story).
  2. How it works — the 6-pillar workflow with the hero console (relabeled illustrative).
  3. The proof chain — provider proof → independent reconciliation → finality → report.
  4. Built-in controls — dual-control, RBAC, immutable audit, KYB gate.
  5. Sample settlement report — show the artifact.
  6. ICP section (below).
  7. Trust/safety (below).
  8. Paid pilot CTA.
- **ICP section:** "For INR payout providers, OTC desks, on/off-ramps, PSPs, and stablecoin treasury teams who already move money through providers."
- **Workflow section:** the seven-step rail, each step one line, ending on "Settlement Report."
- **Trust/safety section:** the mandatory "does not move/custody/route funds" statement; controls list; honest roadmap (no fake certifications).
- **Paid pilot CTA:** "Start a 30-day proof pilot" → pilot offer page.

---

## 13. Paid Pilot Package

- **Name:** "Settlement Proof Pilot — 30 days."
- **Target customer:** one ops/treasury lead at an INR payout / OTC / PSP business already running provider payouts.
- **What they get:** a private workspace; their real settlements modeled through the proof chain; independent-reconciliation setup on their bank/PSP records; finality review with dual-control; a signed-off settlement report per settlement; an exceptions/finality summary at day 30; a 1-hour settlement-ops review readout.
- **What INRSettle does:** records provider proof, requires/operates independent reconciliation, runs finality review, produces audit trail and reports, assesses provider/counterparty readiness.
- **What INRSettle does NOT do:** move, custody, route, price, or provide funds/liquidity; execute payouts; act as exchange/broker/PSP; perform KYC/KYB of end users; guarantee providers.
- **Pricing suggestion:** $2k–$5k fixed for the 30-day pilot (setup + review), creditable toward an annual plan; anchors value without pretending to be self-serve SaaS yet.
- **Onboarding steps:** scope call → workspace + roles (operator + approver) → import a sample of real settlements/records → run the proof chain on 5–10 cases → day-30 readout.
- **Success metrics:** % settlements with complete evidence chain; exceptions/mismatches caught; time-to-finality; reports generated; "would you keep paying" (the real metric).
- **30-day outcome:** a reconciled, audited set of proven settlements + a written ops-review with the gaps found and a finality-readiness verdict.

---

## 14. Investor-Ready Narrative

- **Problem:** Everyone moving money through payout providers treats "completed" as settled. It isn't. The gap surfaces as reconciliation losses, partner disputes, and failed audits — and no incumbent owns *proof of finality* as a product.
- **Why now:** stablecoin/OTC/cross-border payout volume into India (and similar corridors) is exploding; provider sprawl is up; compliance/audit pressure is rising; teams are stitching this together in spreadsheets and chat.
- **Product:** the settlement operations control layer — provider proof + independent reconciliation + audit + finality review + report — on top of the rails they already use.
- **Traction signals (to build next):** design partners, paid pilots, LOIs, a referenceable settlement report. (Be honest: not yet present — the 90-day plan exists to create them.)
- **Market wedge:** start narrow — INR payout/OTC proof — then expand to any provider-mediated settlement corridor and to recurring SaaS + ops-review services.
- **Business model:** paid pilots → monthly SaaS (seats + usage) → ops-review services → provider/partner reporting tier.
- **Why founder:** built a working, controls-hardened system solo (RBAC, dual-control, idempotent provider boundary, fail-closed finality) — execution + domain judgment in one.
- **Next 90 days:** reposition + narrow product; 3–5 paid pilots; 1 referenceable report; pricing live; ingestion path for real records.
- **Funding ask / use of funds:** pre-seed to convert pilots to contracts — design-partner sales, real-data ingestion + billing, and compliance/security review to unlock larger accounts.

---

## 15. Fix Plan

### Copy-only fixes (safe, fast, highest ROI)
- Rewrite landing hero/lead/CTA/footer to proof-control thesis (Section 7 rows).
- Remove all "liquidity / rails / infrastructure / stack" movement language from marketing.
- Add the mandatory "does not move/custody/route funds" line to landing + footer.
- Reframe Accounts copy ("reference balances, no funds held").
- Relabel "Treasury operations console" → "Settlement finality console"; quotes "execution" → "record/operate"; hero console "illustrative."
- Thesis-aligned empty states across pages.

### UI / navigation fixes
- Make **Settlements** the post-login default.
- Collapse nav per Section 11; merge `/kyb`+`/counterparties`; promote "Finality review" out of `/shadow`.
- Deprioritize Monitoring + Pilot Readiness in the customer nav (keep for internal/investor).
- Remove or gate **Accounts** in the commercial cut.

### Product logic fixes (only if necessary)
- Add a real-record ingestion path (CSV/upload) for reconciliation — needed for paid pilots, not before.
- Surface a customer-visible pilot-scope object (caps/counterparties/providers/stop conditions).
- (Later) billing/subscription for SaaS.
- None of these require touching finality/RBAC/dual-control/provider-boundary logic.

### Commercialization fixes
- Pricing/pilot offer page + "what you get / do / don't" panel.
- Productized "Settlement Proof Pilot" intake + SOW (reuse existing docs).
- Sample settlement report as a public artifact.
- Define and display the value metric (settlements proven / exceptions caught).

### Do-not-touch areas
- Finality engine, independent-reconciliation rule, provider proof, audit logging.
- RBAC, dual-control, creator-self-approval block.
- Provider integration/secrets/gateway, webhook verification, payout execution, `isTest`, live-payout tripwire.
- Prisma schema/migrations, auth/session, `app/api/*`, `middleware.ts`.

---

## 16. 7-Day Refocus Plan

- **Day 1 — Positioning lock.** Finalize the one-sentence/paragraph/positioning (Section 2) and the mandatory disclaimer line. Decide ICP = INR payout/OTC/PSP ops leads. (Doc only.)
- **Day 2 — Landing copy rewrite (copy-only).** Apply Section 7/12 to the marketing site; strip liquidity/rails/infrastructure language; add disclaimer; add paid-pilot CTA.
- **Day 3 — App copy + nav reframe.** Settlements as home; collapse nav; relabel finality review; reframe Accounts (or hide); thesis-aligned empty states.
- **Day 4 — Sellable surfaces.** Build the Pricing/Pilot offer page and the "what you get/do/don't" panel; publish a sample settlement report.
- **Day 5 — Demo golden path.** Lock one demo dataset + script (reuse dry-run runbook) that walks proof → reconciliation → finality → report in <7 min, ending on the report artifact.
- **Day 6 — Pilot machinery.** Productize the Settlement Proof Pilot: intake form, SOW from existing docs, success metrics; draft 5 target design partners.
- **Day 7 — Investor pack + outreach.** Assemble the narrative (Section 14) + proof pack + sample report into a short deck; begin design-partner/pilot outreach.

> Net: Days 1–3 are copy/UX only (safe), Days 4–7 add packaging and outreach. No
> changes to finality, RBAC, dual-control, provider boundary, schema, auth, or
> payout safety are required to reach paid-pilot/investor-ready.
