# Incident Handling Playbook — controlled shadow/live-test pilot

Operator-grade playbook for the INRSettle pilot. INRSettle never moves funds;
a provider/partner executes externally while INRSettle records proof,
reconciliation, audit trail, finality, and reports. Incidents are therefore
about **evidence and control integrity**, not about money INRSettle holds.

Companion screens: Monitoring (`/monitoring`), Settlements, Reconciliation,
Provider Risk Shield (`/providers`), Counterparty Readiness (`/kyb`).
Companion docs: `docs/controlled-pilot-dry-run.md`, `docs/pilot-env-checklist.md`,
`docs/rbac-matrix.md`.

---

## 1. Severity model

| Severity | Meaning | Response target |
|---|---|---|
| **Low** | Cosmetic or single-case evidence gap; no money uncertainty | Same business day |
| **Medium** | A settlement's evidence chain is incomplete or delayed; outcome still determinable | 8h |
| **High** | Evidence contradiction, control rejection, or verification failure; money state uncertain for ≥1 settlement | 4h |
| **Critical** | A safety boundary was tested or crossed (production payout attempt, cap/tripwire event); pilot continuation in question | Immediate — stop pilot intake first, investigate second |

Severity escalates one level if the same incident type recurs within 24h or
the SLA is missed.

## 2. Ownership

| Role | Responsibility |
|---|---|
| **Operator** (SETTLEMENT_OPERATOR) | First responder: triage, evidence collection, status polls, reconciliation ingest |
| **Treasury Manager / Approver** | Owns finality decisions, mismatch judgments, approves/blocks resolution; never approves own settlements |
| **Compliance Officer** | Reviews KYB-related and screening incidents; read/flag only — no operational mutations |
| **Founder/Admin** | Owns Critical incidents, pilot freeze/resume decision, partner escalation |
| **Provider contact** | Named counterpart at PontisGlobe / RemitQuickly for status, reversal and webhook questions |

Every open incident has exactly one named owner at all times.

## 3–4. Incident types and response steps

### 4.1 Stuck settlement (> 30 minutes in EXECUTING)

- **Trigger:** EXECUTING with no provider update for 30 minutes.
- **Severity:** High.
- **First action:** Operator runs a manual provider status check (Check provider status); record the result.
- **What not to do:** Do not mark SETTLED or FAILED manually; do not retry the payout (idempotency keys exist precisely so retries never double-pay — but a stuck state is a question, not an instruction).
- **Evidence:** Provider transaction id, last proof record, status poll response, timestamps.
- **Audit requirement:** Status check writes its own audit entries; add an operator note if resolved manually.
- **Escalation:** No resolution after 2 polls / 1h → Treasury Manager → provider contact.
- **Resolution:** Provider returns a definitive outcome and the settlement transitions through the normal resolution path.
- **Post-incident:** Record duration and cause; recurring delays move the provider to "Watch" on Provider Risk Shield.

### 4.2 Provider status pending (> 15 minutes)

- **Trigger:** Outcome classifier returns `pending` for over 15 minutes.
- **Severity:** Medium.
- **First action:** Manual status poll; confirm the status string is genuinely pending (unknown statuses classify as pending **by design** — never as failed).
- **What not to do:** Do not treat pending as failed; do not fabricate an outcome.
- **Evidence:** Raw status string, classifier outcome, poll timestamps.
- **Audit requirement:** Polls are audited automatically; note any new/unknown status string for classifier review.
- **Escalation:** Pending > 1h → 4.1 path.
- **Resolution:** Definitive provider outcome recorded as proof.
- **Post-incident:** If a new status string was seen, add it to the classifier test fixtures before the next pilot run.

### 4.3 Webhook verification failure

- **Trigger:** `webhook.verification_failed` audit event (missing headers or invalid signature).
- **Severity:** High.
- **First action:** Check frequency and source pattern; confirm the poll fallback is covering affected settlements.
- **What not to do:** Do not relax signature or replay-window checks; do not process the rejected payload by hand.
- **Evidence:** Audit events (reason field only — payloads are deliberately not stored), count, time window.
- **Audit requirement:** Already automatic; add a resolution note when closed.
- **Escalation:** Repeated unexplained failures → Founder/Admin; consider rotating the gateway shared secret with the provider (a config change, not a code change).
- **Resolution:** Failures explained (misconfiguration, provider-side change) or stopped; no settlement left unresolved.
- **Post-incident:** Record whether secrets were rotated; verify signature tests still pass.

### 4.4 Reconciliation mismatch

- **Trigger:** Independent bank/PSP record contradicts provider proof (amount/reference/date).
- **Severity:** High.
- **First action:** Treasury Manager compares provider-reported values against the independent record; the settlement goes to finality review.
- **What not to do:** Do not finalize; do not edit either record to force agreement — evidence is append-only.
- **Evidence:** Both records verbatim, confidence score, finality assessment output.
- **Audit requirement:** Keep the mismatch visible in the audit trail; record the judgment and basis when resolved.
- **Escalation:** Unexplained money difference → Founder/Admin + provider contact.
- **Resolution:** Discrepancy explained and documented (fees, rounding, partial payout) or the settlement is failed/reversed through the normal path.
- **Post-incident:** If fees/rounding caused it, document the provider's fee behavior in Provider Risk Shield.

### 4.5 Finality blocked

- **Trigger:** Finality decision `not_ready`/`needs_review` past expected completion, or blocked by the safety gate.
- **Severity:** Medium.
- **First action:** Read the finality panel's blocker list — it names the exact missing pillar (proof / independent reconciliation / approval / cap / tripwire).
- **What not to do:** Do not bypass the engine; there is no manual "force finalize" and none may be added mid-pilot.
- **Evidence:** Finality assessment (decision, confidence, reasons), checklist state.
- **Audit requirement:** Approval, when it comes, must be the dual-control `settlement.finality_approved` event.
- **Escalation:** Blocked > 1 business day → Treasury Manager.
- **Resolution:** All pillars satisfied and decision reaches ready, or the settlement is deliberately closed otherwise.
- **Post-incident:** Note which pillar lagged; recurring proof gaps are a provider issue, recurring recon gaps an ingest issue.

### 4.6 LIVE_TEST cap breach attempt

- **Trigger:** Mode change rejected on per-settlement cap, daily cap, or allowlist.
- **Severity:** High.
- **First action:** Identify who attempted it and whether it was operator error or a process gap; the control worked — confirm nothing slipped through around it.
- **What not to do:** Do not raise caps to make the error go away; cap changes are a deliberate config decision by Founder/Admin, never an incident response.
- **Evidence:** Rejection message, settlement INR leg, current caps, daily usage at the time.
- **Audit requirement:** Record the attempt and explanation in an incident note.
- **Escalation:** Repeated attempts by the same user → Founder/Admin (training or access review).
- **Resolution:** Attempt explained; settlement either resized or kept in SHADOW.
- **Post-incident:** If legitimate volume pressure, schedule a deliberate cap review — separately from the incident.

### 4.7 Unexpected production payout attempt

- **Trigger:** Any sign of a non-sandbox payout request: `isTest=false`, production base URL, or `LIVE_PAYOUTS_ENABLED` set.
- **Severity:** **Critical.**
- **First action:** Founder/Admin stops pilot intake (no new settlements/mode changes); verify env state: `LIVE_PAYOUTS_ENABLED` unset, provider base URLs sandbox, RemitQuickly `isTest` defaulting true.
- **What not to do:** Do not continue the pilot while the source is unexplained; do not quietly fix and move on.
- **Evidence:** Full audit trail around the attempt, env snapshot, deployed commit hash vs pilot release tag.
- **Audit requirement:** Document the finding and remediation as an incident record shared with all owners.
- **Escalation:** Immediate — this is the one incident where everyone is notified first and investigated second.
- **Resolution:** Root cause identified (misconfiguration, wrong deploy, tampering), corrected, and the dry run re-executed before pilot resumes.
- **Post-incident:** Full writeup; revisit the deployment checklist; consider whether the tripwire detection needs to be louder.

### 4.8 Provider reversed payout

- **Trigger:** `reversed`/`refunded` provider status → `*.payout.reversed_review_required` audit event.
- **Severity:** High.
- **First action:** Treasury Manager opens the review: money may have moved and come back — the true state is uncertain by definition.
- **What not to do:** Do not auto-fail the settlement (the system already refuses to); do not re-trigger the payout until the reversal is explained.
- **Evidence:** Reversal proof record, provider explanation, any bank-side evidence of funds returning.
- **Audit requirement:** The review-required event exists; add the disposition (re-execute / fail / close) with reasoning.
- **Escalation:** Provider cannot explain within SLA → Founder/Admin; provider moves to "Restricted" consideration.
- **Resolution:** Money position confirmed by independent evidence; settlement closed through the normal lifecycle.
- **Post-incident:** Record the provider's reversal behavior in Provider Risk Shield (refund process quality is a passport field).

### 4.9 Report generation failed

- **Trigger:** Report render error, or a finalized settlement missing its `settlement.report_generated` audit event.
- **Severity:** Low.
- **First action:** Re-open the report page (generation is idempotent — re-render records the event once).
- **What not to do:** Do not hand-write a substitute report; the report must come from recorded evidence.
- **Evidence:** Error message, settlement id, audit-event presence.
- **Audit requirement:** Confirm the generation event exists after resolution.
- **Escalation:** Persistent failure → engineering fix before the settlement counts as pilot-complete.
- **Resolution:** Report renders and the audit event is recorded.
- **Post-incident:** None beyond the note, unless recurring.

### 4.10 KYB-blocked counterparty attempt

- **Trigger:** A settlement or pilot request involves a counterparty whose KYB status is Blocked or Documents Pending.
- **Severity:** Medium (High if anything actually executed).
- **First action:** Compliance Officer confirms the KYB status; Operator holds the settlement — no execution, no mode change.
- **What not to do:** Do not proceed "just for shadow"; the eligibility gate applies to all real-money modes.
- **Evidence:** KYB record state, who initiated, what stage it reached.
- **Audit requirement:** Incident note linking settlement id to the KYB decision.
- **Escalation:** If anything executed against a blocked counterparty → treat as 4.7-adjacent, Founder/Admin owns it.
- **Resolution:** Settlement cancelled or held until KYB approval is granted through the normal review.
- **Post-incident:** If the attempt was possible because KYB state isn't enforced in the settlement flow, log that as the known gap it is (KYB is currently a control screen, not an enforcement hook) and prioritize accordingly.

### 4.11 Creator self-approval attempt (blocked by dual control)

- **Trigger:** Server-side rejection of a creator approving their own lifecycle APPROVED transition or finality.
- **Severity:** Low (control worked) — Medium if repeated or argued with.
- **First action:** Confirm the rejection in the audit/error trail; route the approval to a different operator with an approval role.
- **What not to do:** Do not share approver credentials; do not weaken the check; do not approve "on behalf of".
- **Evidence:** Rejection message, settlement id, who attempted.
- **Audit requirement:** Successful approval afterwards must show approver ≠ creator (`settlement.finality_approved` metadata).
- **Escalation:** Repeated attempts → Founder/Admin (training or role assignment is wrong).
- **Resolution:** A second operator approves or declines on the merits.
- **Post-incident:** If this fires often, the team is under-staffed on approvers — fix the roster, not the control.

## 5. Pilot safety rules

These hold in every incident, with no exceptions granted by this playbook:

1. **Provider "completed" does not equal settlement finalized.** It is a claim, one pillar of three.
2. **No settlement finality** without provider proof, independent reconciliation, audit trail, finality review, a generated settlement report, and passing pilot guardrails (caps, allowlist, tripwire).
3. **No creator self-approval** — lifecycle or finality. Dual control is not waivable during incidents.
4. **No live payouts are enabled by this playbook** or by any response step in it. `LIVE_PAYOUTS_ENABLED` stays unset; `isTest` stays true.
5. **No provider state changes from the monitoring UI.** Monitoring, Provider Risk Shield and KYB screens are visibility layers; freeze/decision buttons are mocks.
6. **No manual override without an audit note.** If a human decision deviates from the standard path, it is written down — who, what, why, when — before it takes effect.

## 6. Provider communication templates

**Pending status check**
> Subject: Status check — transaction {tx_id}
> Hi {name}, we submitted payout {tx_id} ({amount} INR, {date} IST) and your API has reported it pending for over {duration}. Could you confirm its current state and expected resolution time? We hold the settlement open until you report a definitive outcome. Thanks.

**Webhook verification failure**
> Subject: Webhook signature verification — please confirm sender configuration
> Hi {name}, since {time} IST we have rejected {count} webhook delivery(ies) to our endpoint due to signature verification failure. No payload was processed. Could you confirm whether your webhook signing configuration or egress changed in this window? We are covering affected transactions via status polling in the meantime.

**Reconciliation mismatch investigation**
> Subject: Amount discrepancy — transaction {tx_id}
> Hi {name}, for payout {tx_id} your API reported {provider_amount} INR while the beneficiary-side record shows {bank_amount} INR. Could you provide the fee breakdown or an explanation for the difference? The settlement remains in review until the figures are reconciled.

**Reversed payout review**
> Subject: Reversal on transaction {tx_id} — disposition needed
> Hi {name}, your system reported payout {tx_id} as reversed on {date}. Please confirm: the reason for the reversal, whether funds have fully returned, and whether the beneficiary details require correction before any re-attempt. We will not re-execute until the reversal is documented.

**Pilot freeze notice**
> Subject: Temporary pause on pilot transactions
> Hi {name}, we are temporarily pausing new pilot transactions on our side while we review an operational item. In-flight transactions are unaffected and we will continue to consume status updates as normal. We expect to resume within {window} and will confirm when we do. No action is needed from you at this time.
