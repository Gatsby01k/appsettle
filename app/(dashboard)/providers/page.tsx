import { AlertTriangle, Archive, CheckCircle2, Gauge, ListChecks, Lock, ShieldCheck, Snowflake } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { PROVIDER_RISK_PROFILES, type ProviderRiskProfile, type ReadinessLabel } from "@/lib/provider-risk/mock";
import { PageHeader } from "@/components/ops/page-header";
import { cn } from "@/lib/utils";

// Provider Risk Shield — UI-ONLY risk visibility layer.
// Renders static mock data from lib/provider-risk/mock.ts. This page makes
// no provider API calls, reads no provider secrets, and exposes no execution
// control. The kill switch is a disabled mock control.

const READINESS_CHIP: Record<ReadinessLabel, string> = {
  "Sandbox Verified": "prs-chip--ok",
  "Pilot Ready": "prs-chip--ok",
  "Commercial Review": "prs-chip--pending",
  "Pilot Blocked": "prs-chip--blocked",
};

function ProviderCard({ provider }: { provider: ProviderRiskProfile }) {
  const gateDone = provider.goLiveGate.filter((item) => item.done).length;
  const gateTotal = provider.goLiveGate.length;

  return (
    <section className="prs-card p-5 sm:p-6" aria-label={`${provider.name} risk passport`}>
      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-white">{provider.name}</h2>
            <span className={cn("prs-chip", READINESS_CHIP[provider.overallReadiness])}>
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {provider.overallReadiness}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/50">{provider.rail}</p>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/70">{provider.summary}</p>
        </div>

        {/* Trust score */}
        <div className="w-full max-w-[230px] shrink-0 sm:w-[230px]">
          <div className="flex items-baseline justify-between">
            <span className="prs-eyebrow">Trust score</span>
            <span className="text-xl font-semibold tabular-nums text-white">
              {provider.trustScore.score}
              <span className="text-xs font-medium text-white/40">/100</span>
            </span>
          </div>
          <div className="prs-score-track mt-1.5" role="img" aria-label={`Trust score ${provider.trustScore.score} of 100`}>
            <div className="prs-score-fill" style={{ width: `${provider.trustScore.score}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-white/45">
            Go-live gate {gateDone}/{gateTotal} complete
          </p>
        </div>
      </div>

      {/* Panels */}
      <div className="relative mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {/* 1. Risk passport */}
        <div className="prs-panel p-4 xl:row-span-2">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <Lock className="h-3 w-3" aria-hidden="true" /> Provider risk passport
          </p>
          <dl className="mt-2">
            {provider.passport.map((field) => (
              <div key={field.label} className="prs-passport-row">
                <dt>{field.label}</dt>
                <dd className={`prs-val--${field.state}`}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 2. Trust score gaps */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <Gauge className="h-3 w-3" aria-hidden="true" /> Why not 100 — open items
          </p>
          <ul className="mt-2 space-y-1.5">
            {provider.trustScore.missing.map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-[12px] leading-snug text-white/70">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#ffd58a]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Go-live gate */}
        <div className="prs-panel p-4 xl:row-span-2">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <ListChecks className="h-3 w-3" aria-hidden="true" /> Go-live gate · required before real pilot
          </p>
          <div className="mt-2">
            {provider.goLiveGate.map((item) => (
              <div key={item.label} className="prs-gate-item">
                <span className={cn("prs-gate-dot", item.done ? "prs-gate-dot--done" : "prs-gate-dot--open")}>
                  {item.done ? "✓" : "·"}
                </span>
                <span className={item.done ? "text-white/80" : "text-white/55"}>
                  {item.label}
                  {item.note ? <span className="block text-[11px] text-[#ffd58a]/80">{item.note}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Exposure limits */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <Gauge className="h-3 w-3" aria-hidden="true" /> Exposure limits
          </p>
          <dl className="mt-2">
            <div className="prs-passport-row">
              <dt>Max transaction</dt>
              <dd className="text-white/85">{provider.exposure.maxTransaction}</dd>
            </div>
            <div className="prs-passport-row">
              <dt>Daily exposure</dt>
              <dd className="text-white/85">{provider.exposure.dailyExposure}</dd>
            </div>
            <div className="prs-passport-row">
              <dt>Pending exposure</dt>
              <dd className="text-white/85">{provider.exposure.pendingExposure}</dd>
            </div>
            <div className="prs-passport-row">
              <dt>Unresolved payouts</dt>
              <dd className={provider.exposure.unresolvedPayouts === 0 ? "prs-val--ok" : "prs-val--blocked"}>
                {provider.exposure.unresolvedPayouts}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-white/45">
            <span className="font-semibold text-white/60">Auto-freeze rule:</span> {provider.exposure.autoFreezeRule}
          </p>
        </div>

        {/* 5. Kill switch */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <Snowflake className="h-3 w-3" aria-hidden="true" /> Kill switch
          </p>
          <div className="mt-2.5">
            <button type="button" className="prs-freeze-btn" disabled aria-disabled="true">
              <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
              Freeze provider
            </button>
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-white/50">
            Mock control only. In production this would block new payout creation while keeping provider
            status checks, reconciliation, and reporting available. Any real freeze action must create an
            audit event.
          </p>
        </div>

        {/* 6. Evidence vault */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <Archive className="h-3 w-3" aria-hidden="true" /> Evidence vault
          </p>
          <ul className="mt-2 space-y-1.5">
            {provider.evidence.map((item) => (
              <li key={item.label} className="flex items-start gap-1.5 text-[12px] leading-snug">
                {item.state === "received" ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#5ff0cf]" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#ff9d9d]" aria-hidden="true" />
                )}
                <span className={item.state === "received" ? "text-white/75" : "text-[#ff9d9d]/90"}>
                  {item.label}
                  <span className="block text-[11px] text-white/40">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default async function ProvidersPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provider Risk Shield"
        description="Provider readiness, commercial risk, operational risk, and pilot go-live blockers — evaluated before any controlled real-money shadow or live test."
      />

      {/* Safety note */}
      <div className="flex items-start gap-2 rounded-xl border border-[var(--ops-line)] bg-white p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald-ink" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Provider Risk Shield is a risk visibility and control
          layer.</span>{" "}
          It does not execute payouts, does not move funds, and does not enable live provider access. All data
          on this page is a local assessment snapshot.
        </p>
      </div>

      {PROVIDER_RISK_PROFILES.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}
