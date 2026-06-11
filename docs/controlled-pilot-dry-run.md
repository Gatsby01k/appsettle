# Controlled pilot dry-run runbook

Operator-facing runbook for a SHADOW / LIVE_TEST pilot dry run. Work through it
top to bottom in one sitting; record evidence as you go.

## 1. Purpose

This is a controlled pilot in which **INRSettle does not move money directly**.
A provider/partner moves funds externally. INRSettle records, verifies,
reconciles, finalizes, and reports:

quote → settlement → provider proof → independent reconciliation → audit trail
→ finality review (dual-control) → settlement report.

A settlement is only safe to finalize when provider proof, independent
reconciliation, and the audit log agree. "Payment completed" from a provider is
a claim, not a settlement.

## 2. Preconditions

Verify ALL of these before starting (see also `docs/pilot-env-checklist.md`):

- [ ] Deployed commit matches the local pilot release (tag/commit hash recorded).
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` — login page shows no demo credentials.
- [ ] Live payouts disabled — `LIVE_PAYOUTS_ENABLED` is unset.
- [ ] `isTest` enforced — provider payouts run in sandbox/test mode.
- [ ] `QUOTE_RATE_USDT_INR` set (quotes fail closed in production without it).
- [ ] `LIVE_TEST_MAX_INR` set (per-settlement cap).
- [ ] `LIVE_TEST_DAILY_MAX_INR` set (cumulative daily cap).
- [ ] `LIVE_TEST_ALLOWED_PROVIDERS` set (comma-separated allowlist).
- [ ] Two real users exist in the pilot org: an **operator** (creator) and a
      separate **approver** with an approval-capable role. Check Team & access.
- [ ] Creator self-approval is blocked (verified again in step 3.10).
- [ ] Provider keys are sandbox/test unless a real-money micro-test was
      separately approved in writing.
- [ ] Provider/counterparty for the test is known and the beneficiary account
      is verified.
- [ ] Test amount's INR leg is under `LIVE_TEST_MAX_INR` and fits within the
      remaining daily cap.

## 3. Dry-run steps

1. **Login as operator.** Confirm the login page shows no demo-credentials
   block. Confirm `auth.login` appears in the audit log.
2. **Create a quote** on the Quotes page. Note the rate source label — it must
   say manual desk rate (env), NOT "Demo rate". Record the quote public ID.
3. **Create a settlement** from the quote before it expires. Record the
   settlement public ID. It starts in `REQUESTED`.
4. **Set the mode** on the settlement's Shadow/Pilot panel: `SHADOW` for a
   tracked external operation, `LIVE_TEST` for a tiny capped provider test.
   LIVE_TEST entry checks caps, allowlist, beneficiary, and operator approval;
   proof and reconciliation are enforced later, at finality.
5. **Confirm guardrails**: the mode change succeeds only if the INR leg is
   under the cap, the daily cap has headroom, the provider (if assigned) is
   allowlisted, the beneficiary is on file, and the settlement is approved.
   Read the checklist panel — `live_payout_disabled` must show as satisfied.
6. **Provider/partner moves funds externally.** INRSettle does nothing here.
   Approve and execute the settlement record so its lifecycle tracks the
   real-world operation (`APPROVED` → `EXECUTING`).
7. **Record provider proof**: via webhook/poll if the sandbox provider is
   wired, otherwise enter manual proof (provider, transaction ID, status,
   provider-reported amount — never type the expected amount as the actual).
8. **Add independent reconciliation**: a `bank_statement` / `psp_report` /
   `manual_operator` record matching the settlement. A `provider_claim` must
   NOT count — verify the independent-reconciliation checklist item stays
   unsatisfied if that is all you have.
9. **Confirm finality status** on the finality review: decision should move to
   `needs_review` / ready once proof + independent reconciliation agree;
   confidence and pillar breakdown should be consistent with the evidence.
10. **Attempt creator approval**: as the operator who created the settlement,
    try to approve finality. It MUST be rejected server-side. Record the error.
11. **Login as the second approver** (separate browser/profile recommended).
12. **Approve finality.** Audit log must show `settlement.finality_approved`
    by the approver, not the creator.
13. **Generate the settlement report.** Verify it shows proof, reconciliation
    source classification, approvals, and the mode.
14. **Check the audit trail** end to end: quote creation, transitions, mode
    change, proof recorded, reconciliation match, finality approval, report
    generated — in order, with the right actors.

## 4. Expected evidence

- [ ] Quote created (public ID + rate source recorded).
- [ ] Settlement created (public ID recorded).
- [ ] Provider proof recorded (transaction ID + provider-reported amount).
- [ ] Independent reconciliation matched (source is independent, not
      `provider_claim`).
- [ ] Finality ready / approved with consistent confidence breakdown.
- [ ] Second-approver approval in the audit log (approver ≠ creator).
- [ ] Settlement report generated.
- [ ] Audit trail complete and ordered.

## 5. Failure cases to test

Each must fail safely — run them and record the observed behavior:

- [ ] **No provider proof** → finality not ready; proof pillar unsatisfied.
- [ ] **No reconciliation** → finality not ready; recon pillar unsatisfied.
- [ ] **Amount mismatch** (proof/recon amount ≠ settlement) → mismatch
      surfaced; settlement goes to review, never auto-finalizes.
- [ ] **Provider reversed** → proof recorded, review-required audit entry,
      NO automatic transition or auto-fail.
- [ ] **Duplicate webhook/proof delivery** → idempotent no-op; no duplicate
      proof, transition, or audit entry.
- [ ] **Cap exceeded** (INR leg over `LIVE_TEST_MAX_INR`, or daily cap) →
      LIVE_TEST entry blocked with a cap violation message.
- [ ] **Provider not allowlisted** → LIVE_TEST entry blocked.
- [ ] **Creator self-approval** → rejected server-side (step 3.10).
- [ ] **Demo reconciliation hidden outside DEMO** → the demo reconcile action
      is absent on SHADOW/LIVE_TEST settlements; a forced request returns
      "Demo reconciliation is only available in DEMO mode."

## 6. Pass/fail checklist

- [ ] All preconditions verified (section 2).
- [ ] All 14 dry-run steps completed without manual workarounds.
- [ ] All 8 expected-evidence items present (section 4).
- [ ] All 9 failure cases behaved safely (section 5).
- [ ] No unexpected errors in server logs during the run.
- [ ] No secret values appeared in any log, report, or audit entry.

Any unchecked box = FAIL. Fix, redeploy, and rerun the full dry run.

## 7. Do not proceed to a real client pilot unless

- [ ] All P0 audit findings fixed.
- [ ] P1 pilot-readiness findings fixed.
- [ ] `npm test` passes on the pilot commit.
- [ ] `npm run build` passes on the pilot commit.
- [ ] Settlement report generated during the dry run.
- [ ] Audit trail complete for the dry-run settlement.
- [ ] No live-payout execution switch enabled anywhere
      (`LIVE_PAYOUTS_ENABLED` unset; provider `isTest` still true).
