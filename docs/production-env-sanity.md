# Production Environment Sanity Audit

- **Audit date:** 2026-06-12
- **Scope:** Read-only audit of the INRSettle repository working tree and local
  environment file *key names*. No values were read or printed, no secrets
  rotated, no configuration changed, no code modified. Vercel/Neon dashboards
  were NOT inspected — hosted environment variables must be verified there
  separately.
- **Method:** Static inspection (grep by variable name, file presence checks,
  control-point greps). Checks marked "local run required" cannot execute in
  the audit sandbox.

---

## Checks performed

1. Enumerated every `process.env.*` reference in `app/`, `lib/`, `gateway/`, `scripts/`, `prisma/` plus the parameterized reads (`QUOTE_RATE_USDT_INR`, `SHADOW_MAX_INR`, `LIVE_TEST_*` via `getShadowConfig`).
2. Compared against the **key names** present in `.env`, `.env.local`, `.env.production.local` (keys only — values never read).
3. Searched all code paths for `isTest: false`, live-payout enablement, and production execution surfaces.
4. Verified mock/disabled state of Provider Risk Shield, KYB, and Monitoring controls.
5. Verified migration directory state and env-file git hygiene.
6. Re-verified provider boundary, RBAC, and dual-control control points.

## Pass / Needs Review table

| # | Check | Result | Evidence |
|---|---|---|---|
| 1a | `DATABASE_URL` present (name) | **Pass** | Key in `.env` and `.env.local` |
| 1b | `SESSION_SECRET` present (name); ≥32 chars enforced in code | **Pass** | Key present; `lib/auth.ts` throws if short |
| 1c | RemitQuickly env names present (`REMITQUICKLY_BASE_URL/API_KEY/API_SECRET/WEBHOOK_SECRET`) | **Pass** | Keys in `.env`/`.env.local` |
| 1d | Pontis env names absent from app env files | **Pass (by design)** | Pontis API secrets live only on the VPS gateway; `PONTIS_GATEWAY_URL/SECRET` are the app-side names — **not present in local files, set in Vercel? → verify** |
| 1e | `QUOTE_RATE_USDT_INR` present | **Needs Review** | Not in any local env file; production quotes fail closed without it |
| 1f | Pilot caps (`LIVE_TEST_MAX_INR`, `LIVE_TEST_DAILY_MAX_INR`, `LIVE_TEST_ALLOWED_PROVIDERS`, `SHADOW_MAX_INR`) | **Needs Review** | Not set locally — safe code defaults apply (1,000 / 2,000 / allowlist / 10,000), but pilot env should set them explicitly |
| 1g | `NEXT_PUBLIC_DEMO_MODE=false` explicitly in pilot/prod | **Needs Review** | Unset everywhere; prod defaults to hidden demo creds, but the checklist requires explicit `false` |
| 1h | Env files git-ignored | **Pass** | `.gitignore` covers `.env*`; only `.env.example` tracked |
| 2a | No `isTest: false` in any code path | **Pass** | Zero matches; RemitQuickly defaults `isTest ?? true`, sole caller passes `true` |
| 2b | No live payout enablement | **Pass** | `LIVE_PAYOUTS_ENABLED` read in 3 modules — every read **blocks** (finality, mode entry, pilot readiness); nothing executes on it |
| 2c | No production payout execution path from UI | **Pass** | Execution routes use sandbox base URLs; test routes gated dev-only/`*_SANDBOX_TEST` |
| 2d | Provider execution guarded | **Pass** | Role-gated transition + APPROVED-only execution + idempotency keys |
| 2e | Provider Risk Shield / KYB / Monitoring buttons mock/disabled | **Pass** | All decision/freeze buttons render `disabled` with no actions wired (verified per page) |
| 3a | Prisma schema validates | **Local run required** | Run `npx prisma validate` (sandbox cannot execute prisma binaries) |
| 3b | No new migrations from this audit | **Pass** | Latest remains `20260611120000_rename_settlement_mode_to_test_mode`; git status clean of `prisma/` |
| 3c | No schema changes needed/created | **Pass** | Documentation-only output |
| 4a | No provider secrets logged | **Pass** | Only logs: webhook error *message*, gateway port number; audit metadata excludes payloads/headers |
| 4b | Invalid webhook signatures → safe audit events only | **Pass** | `webhook.verification_failed` records reason only; 400/401 preserved |
| 4c | Provider completed ≠ finality | **Pass** | Regression-tested (`provider-claim-finality.test.ts`): claim-only evidence → `needs_review`, never ready |
| 4d | Reconciliation independence | **Pass** | `provider_claim` excluded at create/match/confirm/finality; tested |
| 4e | Reversed → review; unknown → pending | **Pass** | Classifier + resolution tests for both providers |
| 5a | Creator self-approval blocked | **Pass** | Finality (shadow console) + lifecycle APPROVED (`lifecycleApprovalViolation`) both server-side |
| 5b | `FINANCE_VIEWER` cannot mutate | **Pass** | 14 server-action gates + matrix tests |
| 5c | `COMPLIANCE_OFFICER` cannot create quote/settlement/recon evidence | **Pass** | Same gates + explicit tests |
| 5d | Finality approval role-gated | **Pass** | `canApproveSettlement` (OWNER/ADMIN/TREASURY_MANAGER) unchanged |
| 6 | Pilot screens exist | **Pass** | `/providers`, `/kyb`, `/monitoring`, finality review (shadow console), `/settlements/[id]/report`, `/reports`, `/audit-logs`, shadow mode console — all present |
| 7 | `npm test` / `npm run build` | **Local run required** | Sandbox cannot execute vitest/next binaries; `npx tsc --noEmit` = 0 errors at audit time |

## Risks found

1. **Pilot env values not yet set** (1e–1g): `QUOTE_RATE_USDT_INR`, the cap/allowlist variables, and explicit `NEXT_PUBLIC_DEMO_MODE=false` are absent from local env files and unverified in Vercel. Behavior is fail-safe (quotes fail closed in prod; caps default conservatively; demo creds hidden in prod) — but the pilot checklist requires them explicit.
2. **Hosted environment unverified**: this audit could not inspect Vercel/Neon. Names verified in code ≠ values verified in the deployment.
3. **Local `.env` contains Neon-pulled credentials** (keys observed: `PGPASSWORD`, `POSTGRES_*`). Properly git-ignored, but it is a live-credential file on a development machine — handle accordingly and rotate demo-era credentials before pilot.
4. **Known accepted gaps** (documented elsewhere): KYB is a control screen, not an enforcement hook in the settlement flow; monitoring is assessed-state, not automated probes; freeze controls are mocks.

## Required next actions before controlled real-money shadow/live-test

1. Set in the pilot environment (Vercel): `QUOTE_RATE_USDT_INR`, `LIVE_TEST_MAX_INR`, `LIVE_TEST_DAILY_MAX_INR`, `LIVE_TEST_ALLOWED_PROVIDERS`, `NEXT_PUBLIC_DEMO_MODE=false`, and confirm `LIVE_PAYOUTS_ENABLED` is **unset**.
2. Verify `PONTIS_GATEWAY_URL`/`PONTIS_GATEWAY_SECRET` exist only in Vercel and the Pontis API secrets only on the VPS gateway.
3. Rotate demo/operator/approver passwords (`ops@`, `demo@`, `approver@inrsettle.com`).
4. Run locally on the pilot commit: `npx prisma validate && npm test && npm run build`, then `npx prisma migrate deploy` against the pilot database.
5. Execute `docs/controlled-pilot-dry-run.md` end to end and record evidence.

## Statement

**No secret values were read, printed, or exposed by this audit** — only
variable *names* were enumerated. **No configuration was changed**: no env
files, schema, migrations, auth/session logic, provider code, or hosted
settings were modified. The only file produced is this report.
