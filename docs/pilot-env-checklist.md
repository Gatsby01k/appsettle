# Pilot environment checklist (SHADOW / LIVE_TEST)

Internal pre-deployment checklist for a controlled pilot. INRSettle never
moves funds; a partner/provider executes externally while INRSettle records
proof, reconciliation, audit, and finality.

## Environment configuration

- [ ] `NEXT_PUBLIC_DEMO_MODE=false` (hides demo credentials on login, disables the demo
      quote-rate fallback and gated sandbox test routes; leave `NEXT_PUBLIC_DEMO_EMAIL`
      and `NEXT_PUBLIC_DEMO_PASSWORD` unset — they are inlined into the client bundle)
- [ ] Rotate demo/operator/approver passwords in the database
      (`ops@inrsettle.com`, `demo@inrsettle.com`, `approver@inrsettle.com` —
      seed/script defaults must not survive into the pilot)
- [ ] Set `SESSION_SECRET` (≥ 32 chars, random; the app refuses shorter values)
- [ ] Set `DATABASE_URL` (pilot database, not the demo database)
- [ ] Set `QUOTE_RATE_USDT_INR` (manual desk rate; quotes fail closed in
      production if unset)
- [ ] Set `LIVE_TEST_MAX_INR` (per-settlement LIVE_TEST cap; default 1000)
- [ ] Set `LIVE_TEST_DAILY_MAX_INR` (cumulative daily LIVE_TEST cap; default 2000)
- [ ] Set `LIVE_TEST_ALLOWED_PROVIDERS` (comma-separated allowlist)
- [ ] Confirm provider keys are **sandbox/test** credentials
      (`PONTIS_BASE_URL=https://sandbox.pontisglobe.com`, RemitQuickly sandbox base URL;
      Pontis API secrets live ONLY on the VPS gateway, never on Vercel)
- [ ] Confirm live payouts disabled: `LIVE_PAYOUTS_ENABLED` is **unset**
      (setting it to true only trips the finality block — there is no "go live" path)
- [ ] Confirm `isTest` enforced: RemitQuickly payouts default `isTest: true`
      and no caller passes `false`

## Deploy & verify

- [ ] `npx prisma migrate deploy`
- [ ] `npx prisma validate`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Smoke test: login → dashboard → create quote → settlement lifecycle →
      provider proof + independent reconciliation → finality review
      (dual-control: approver ≠ creator) → settlement report

## Invariants (must hold in every environment)

- Demo reconciliation fabricator only works on DEMO-mode settlements.
- `provider_claim` reconciliation never counts as independent evidence.
- Creator self-approval of finality is rejected server-side.
- Webhook signatures and the gateway shared secret fail closed when unconfigured.
- No secret has a `NEXT_PUBLIC_` prefix; no secrets are logged.
