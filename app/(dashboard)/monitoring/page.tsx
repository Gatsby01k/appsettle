import {
  Activity,
  AlertTriangle,
  Archive,
  BellRing,
  CheckCircle2,
  ListChecks,
  Radio,
  ShieldCheck,
  Snowflake,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import {
  EVIDENCE_READINESS,
  FREEZE_STATUS,
  INCIDENTS,
  INCIDENT_RULES,
  PROVIDER_HEALTH,
  SYSTEM_HEALTH,
  type HealthStatus,
  type Incident,
  type IncidentSeverity,
} from "@/lib/monitoring/mock";
import { PageHeader } from "@/components/ops/page-header";
import { cn } from "@/lib/utils";

// Monitoring / Incident Readiness — UI-ONLY pilot command center.
// Renders static mock data from lib/monitoring/mock.ts. No provider calls,
// no external monitoring integrations, no database writes. All controls are
// disabled mocks.

const HEALTH_CHIP: Record<HealthStatus, string> = {
  Healthy: "prs-chip--ok",
  Degraded: "prs-chip--pending",
  "Action Required": "prs-chip--pending",
  Offline: "prs-chip--blocked",
};

const HEALTH_VAL: Record<HealthStatus, string> = {
  Healthy: "prs-val--ok",
  Degraded: "prs-val--pending",
  "Action Required": "prs-val--pending",
  Offline: "prs-val--blocked",
};

const SEVERITY_CHIP: Record<IncidentSeverity, string> = {
  Low: "prs-chip--neutral",
  Medium: "prs-chip--pending",
  High: "prs-chip--blocked",
  Critical: "prs-chip--blocked",
};

const STATUS_CHIP: Record<Incident["status"], string> = {
  Open: "prs-chip--pending",
  Investigating: "prs-chip--pending",
  Resolved: "prs-chip--ok",
};

const RISK_STATE_CHIP: Record<string, string> = {
  Normal: "prs-chip--ok",
  Watch: "prs-chip--pending",
  Restricted: "prs-chip--blocked",
};

export default async function MonitoringPage() {
  await requireSession();

  const openIncidents = INCIDENTS.filter((incident) => incident.status !== "Resolved").length;
  const overall = SYSTEM_HEALTH.find((item) => item.label === "Overall readiness");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pilot Command Center"
        description="System health, provider health, incident rules and freeze status — the operational picture required before any controlled real-money shadow or live test."
      />

      {/* Safety note */}
      <div className="flex items-start gap-2 rounded-xl border border-[var(--ops-line)] bg-white p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald-ink" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Monitoring Readiness is a pilot control screen.</span>{" "}
          It does not execute payouts, does not change provider state, and does not enable live operations. All
          data on this page is a local assessment snapshot.
        </p>
      </div>

      {/* 1. System health */}
      <section className="prs-card p-5 sm:p-6" aria-label="System health">
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-white">System health</h2>
              {overall ? (
                <span className={cn("prs-chip", HEALTH_CHIP[overall.status])}>
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  Overall: {overall.status}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-white/50">
              {openIncidents} open incident{openIncidents === 1 ? "" : "s"} · live payouts disabled · sandbox rails only
            </p>
          </div>
        </div>
        <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SYSTEM_HEALTH.map((item) => (
            <div key={item.label} className="prs-panel p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white/85">{item.label}</p>
                <span className={cn("prs-chip", HEALTH_CHIP[item.status])}>{item.status}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Provider health */}
      <section className="prs-card p-5 sm:p-6" aria-label="Provider health">
        <h2 className="relative text-lg font-semibold tracking-tight text-white">Provider health</h2>
        <div className="relative mt-4 grid gap-3 lg:grid-cols-2">
          {PROVIDER_HEALTH.map((provider) => (
            <div key={provider.id} className="prs-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="prs-eyebrow flex items-center gap-1.5">
                  <Radio className="h-3 w-3" aria-hidden="true" /> {provider.name}
                </p>
                <span className={cn("prs-chip", RISK_STATE_CHIP[provider.riskState])}>
                  Risk state: {provider.riskState}
                </span>
              </div>
              <dl className="mt-2">
                <div className="prs-passport-row">
                  <dt>API reachability</dt>
                  <dd className={HEALTH_VAL[provider.apiReachability]}>{provider.apiReachability}</dd>
                </div>
                <div className="prs-passport-row">
                  <dt>Status endpoint health</dt>
                  <dd className={HEALTH_VAL[provider.statusEndpoint]}>{provider.statusEndpoint}</dd>
                </div>
                <div className="prs-passport-row">
                  <dt>Webhook delivery</dt>
                  <dd className={HEALTH_VAL[provider.webhookDelivery]}>{provider.webhookDelivery}</dd>
                </div>
                <div className="prs-passport-row">
                  <dt>Signature verification</dt>
                  <dd className={HEALTH_VAL[provider.signatureVerification]}>{provider.signatureVerification}</dd>
                </div>
                <div className="prs-passport-row">
                  <dt>Last successful check</dt>
                  <dd className="text-white/85">{provider.lastSuccessfulCheck}</dd>
                </div>
                <div className="prs-passport-row">
                  <dt>Recent failures</dt>
                  <dd className={provider.recentFailureCount === 0 ? "prs-val--ok" : "prs-val--pending"}>
                    {provider.recentFailureCount}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] leading-relaxed text-white/45">{provider.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 + 4: rules and queue */}
      <section className="prs-card p-5 sm:p-6" aria-label="Incident rules and queue">
        <h2 className="relative text-lg font-semibold tracking-tight text-white">Incidents</h2>
        <div className="relative mt-4 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Rules */}
          <div className="prs-panel p-4">
            <p className="prs-eyebrow flex items-center gap-1.5">
              <BellRing className="h-3 w-3" aria-hidden="true" /> Alert rules · mock definitions
            </p>
            <div className="mt-2">
              {INCIDENT_RULES.map((rule) => (
                <div key={rule.name} className="prs-gate-item">
                  <span className={cn("prs-chip shrink-0", SEVERITY_CHIP[rule.severity])}>{rule.severity}</span>
                  <span className="text-white/75">
                    {rule.name}
                    <span className="block text-[11px] text-white/40">{rule.trigger}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Queue */}
          <div className="prs-panel p-4">
            <p className="prs-eyebrow flex items-center gap-1.5">
              <ListChecks className="h-3 w-3" aria-hidden="true" /> Incident queue · mock data
            </p>
            <div className="mt-2 space-y-2.5">
              {INCIDENTS.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold tabular-nums text-white/40">{incident.id}</span>
                    <p className="text-xs font-semibold text-white/90">{incident.title}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={cn("prs-chip", SEVERITY_CHIP[incident.severity])}>{incident.severity}</span>
                    <span className={cn("prs-chip", STATUS_CHIP[incident.status])}>{incident.status}</span>
                    <span className="prs-chip prs-chip--neutral">{incident.owner}</span>
                    <span className="prs-chip prs-chip--neutral">SLA: {incident.slaTimer}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/60">
                    <span className="font-semibold text-white/75">Recommended:</span> {incident.recommendedAction}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">Related control: {incident.relatedControl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5 + 6: freeze status and evidence readiness */}
      <section className="prs-card p-5 sm:p-6" aria-label="Freeze status and evidence readiness">
        <h2 className="relative text-lg font-semibold tracking-tight text-white">Controls & evidence</h2>
        <div className="relative mt-4 grid gap-3 lg:grid-cols-2">
          {/* Kill switch / freeze status */}
          <div className="prs-panel p-4">
            <p className="prs-eyebrow flex items-center gap-1.5">
              <Snowflake className="h-3 w-3" aria-hidden="true" /> Kill switch / freeze status
            </p>
            <dl className="mt-2">
              {FREEZE_STATUS.map((item) => (
                <div key={item.label} className="prs-passport-row">
                  <dt>{item.label}</dt>
                  <dd className={`prs-val--${item.state}`}>{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <button type="button" className="prs-freeze-btn" disabled aria-disabled="true">
                <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
                Global freeze
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">
              Mock control only — no freeze mutation exists yet. Any real freeze must write an audit event and
              must never enable live operations as a side effect.
            </p>
          </div>

          {/* Evidence / audit readiness */}
          <div className="prs-panel p-4">
            <p className="prs-eyebrow flex items-center gap-1.5">
              <Archive className="h-3 w-3" aria-hidden="true" /> Evidence / audit readiness
            </p>
            <ul className="mt-2 space-y-1.5">
              {EVIDENCE_READINESS.map((item) => (
                <li key={item.label} className="flex items-start gap-1.5 text-[12px] leading-snug">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#5ff0cf]" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#ffd58a]" aria-hidden="true" />
                  )}
                  <span className="text-white/75">
                    {item.label}
                    <span className="block text-[11px] text-white/40">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
