import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Gauge,
  ListChecks,
  ShieldCheck,
  Snowflake,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { PROVIDER_RISK_PROFILES, type ProviderRiskProfile, type ReadinessLabel } from "@/lib/provider-risk/mock";
import { PageHeader } from "@/components/ops/page-header";
import { cn } from "@/lib/utils";

// Provider Risk Shield — UI-ONLY risk visibility layer.
// Renders static mock data from lib/provider-risk/mock.ts. This page makes
// no provider API calls, reads no provider secrets, and exposes no execution
// control. All derived values below (decision label, verified/blocker split,
// next actions) are pure DISPLAY transforms of the same snapshot data.

const READINESS_CHIP: Record<ReadinessLabel, string> = {
  "Sandbox Verified": "prs-chip--ok",
  "Pilot Ready": "prs-chip--ok",
  "Commercial Review": "prs-chip--pending",
  "Pilot Blocked": "prs-chip--blocked",
};

// Display-only decision wording per readiness state (no new logic).
const DECISION_LABEL: Record<ReadinessLabel, string> = {
  "Sandbox Verified": "Shadow-ready only",
  "Pilot Ready": "Pilot ready",
  "Commercial Review": "Commercial review pending",
  "Pilot Blocked": "Not ready for real pilot",
};

function decisionChip(readiness: ReadinessLabel) {
  return READINESS_CHIP[readiness];
}

function ProviderDecisionCard({ provider }: { provider: ProviderRiskProfile }) {
  const gateDone = provider.goLiveGate.filter((item) => item.done).length;
  const gateTotal = provider.goLiveGate.length;
  // Pure display split of the existing passport rows.
  const verified = provider.passport.filter((f) => f.state === "ok" && f.label !== "Overall readiness");
  const openIssues = provider.passport.filter((f) => f.state !== "ok" && f.label !== "Overall readiness");
  // Next actions: the first open gate items, verbatim from the snapshot.
  const nextActions = provider.goLiveGate.filter((item) => !item.done).slice(0, 4);

  return (
    <section className="prs-card p-4 sm:p-5" aria-label={`${provider.name} readiness decision`}>
      {/* ---- Provider summary surface ---- */}
      <div className="prs-panel relative flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-white">{provider.name}</h2>
            <span className={cn("prs-chip", READINESS_CHIP[provider.overallReadiness])}>
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {provider.overallReadiness}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/50">{provider.rail}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="prs-eyebrow">Trust score</p>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="text-2xl font-semibold tabular-nums leading-none text-white">
                {provider.trustScore.score}
                <span className="text-xs font-medium text-white/40">/100</span>
              </span>
              <div className="prs-score-track w-24" role="img" aria-label={`Trust score ${provider.trustScore.score} of 100`}>
                <div className="prs-score-fill" style={{ width: `${provider.trustScore.score}%` }} />
              </div>
            </div>
          </div>
          <div>
            <p className="prs-eyebrow">Gate</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums leading-none text-white">
              {gateDone}
              <span className="text-xs font-medium text-white/40">/{gateTotal}</span>
            </p>
          </div>
          <div>
            <p className="prs-eyebrow">Decision</p>
            <span className={cn("prs-chip mt-1", decisionChip(provider.overallReadiness))}>
              {DECISION_LABEL[provider.overallReadiness]}
            </span>
          </div>
        </div>
      </div>

      {/* ---- Recommended next actions (prominent) ---- */}
      <div className="prs-panel relative mt-3 border-[rgba(242,173,35,0.25)] bg-[rgba(242,173,35,0.05)] p-4">
        <p className="prs-eyebrow flex items-center gap-1.5 text-[#ffd58a]">
          <ArrowRight className="h-3 w-3" aria-hidden="true" /> Recommended next actions
        </p>
        <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {nextActions.map((action, index) => (
            <li key={action.label} className="flex items-start gap-2 text-[12.5px] leading-snug text-white/80">
              <span className="mt-px flex h-[18px] w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.08] text-[10px] font-bold text-[#ffd58a]">
                {index + 1}
              </span>
              <span>
                {action.label}
                {action.note ? <span className="block text-[11px] text-white/45">{action.note}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* ---- Modules: Verified / Blockers / Gate / Exposure ---- */}
      <div className="relative mt-3 grid gap-3 lg:grid-cols-2">
        {/* A. Verified */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5 text-[#5ff0cf]">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Verified
          </p>
          <ul className="mt-2 space-y-1.5">
            {verified.map((field) => (
              <li key={field.label} className="flex items-start gap-1.5 text-[12px] leading-snug">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#5ff0cf]" aria-hidden="true" />
                <span className="text-white/80">
                  {field.label}
                  <span className="block text-[11px] text-white/40">{field.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* B. Blockers / open issues */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5 text-[#ff9d9d]">
            <CircleSlash className="h-3 w-3" aria-hidden="true" /> Blockers & open issues
          </p>
          <ul className="mt-2 space-y-1.5">
            {openIssues.map((field) => (
              <li key={field.label} className="flex items-start gap-1.5 text-[12px] leading-snug">
                <AlertTriangle
                  className={cn("mt-0.5 h-3 w-3 shrink-0", field.state === "blocked" ? "text-[#ff9d9d]" : "text-[#ffd58a]")}
                  aria-hidden="true"
                />
                <span className={field.state === "blocked" ? "text-[#ffb4b4]" : "text-white/75"}>
                  {field.label}
                  <span className="block text-[11px] text-white/40">{field.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* C. Go-live gate */}
        <div className="prs-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="prs-eyebrow flex items-center gap-1.5">
              <ListChecks className="h-3 w-3" aria-hidden="true" /> Go-live gate · before real pilot
            </p>
            <span className="prs-chip prs-chip--neutral">{gateDone}/{gateTotal}</span>
          </div>
          <div className="prs-score-track mt-2.5" role="img" aria-label={`Gate ${gateDone} of ${gateTotal} complete`}>
            <div className="prs-score-fill" style={{ width: `${Math.round((gateDone / gateTotal) * 100)}%` }} />
          </div>
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

        {/* D. Exposure limits + controls */}
        <div className="flex flex-col gap-3">
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
              <span className="font-semibold text-white/60">Auto-freeze:</span> {provider.exposure.autoFreezeRule}
            </p>
          </div>

          {/* Evidence + kill switch, compact secondary row */}
          <div className="prs-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="prs-eyebrow flex items-center gap-1.5">
                <Archive className="h-3 w-3" aria-hidden="true" /> Evidence vault
              </p>
              <button type="button" className="prs-freeze-btn !px-2.5 !py-1.5 text-[11px]" disabled aria-disabled="true">
                <Snowflake className="h-3 w-3" aria-hidden="true" />
                Freeze provider
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {provider.evidence.map((item) => (
                <li key={item.label} className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                  {item.state === "received" ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#5ff0cf]" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#ff9d9d]" aria-hidden="true" />
                  )}
                  <span className={item.state === "received" ? "text-white/70" : "text-[#ff9d9d]/90"}>{item.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] leading-relaxed text-white/40">
              Freeze is a mock control — in production it would block new payout creation, keep status checks and
              reporting available, and write an audit event.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function ProvidersPage() {
  await requireSession();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Provider Risk Shield"
          description="Provider readiness and pilot go-live gating, decided on evidence."
        />
        {/* Status summary: per-provider decision at a glance (current data only) */}
        <div className="flex flex-wrap gap-2">
          {PROVIDER_RISK_PROFILES.map((provider) => {
            const gateDone = provider.goLiveGate.filter((item) => item.done).length;
            return (
              <div
                key={provider.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--ops-line)] bg-white px-3 py-2 shadow-ops-xs"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{provider.name}</p>
                  <p className="text-xs font-semibold text-slate-700">
                    {provider.trustScore.score}/100 · gate {gateDone}/{provider.goLiveGate.length}
                  </p>
                </div>
                <span
                  className={cn(
                    "case-chip",
                    provider.overallReadiness === "Pilot Blocked"
                      ? "case-chip--live"
                      : provider.overallReadiness === "Commercial Review"
                        ? "case-chip--gold"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}
                >
                  {DECISION_LABEL[provider.overallReadiness]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety note — slim, single line */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--ops-line)] bg-white px-3 py-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand-emerald-ink" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Risk visibility layer only</span> — no payout execution,
          no fund movement, no live provider access. Local assessment snapshot.
        </p>
      </div>

      {PROVIDER_RISK_PROFILES.map((provider) => (
        <ProviderDecisionCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}
