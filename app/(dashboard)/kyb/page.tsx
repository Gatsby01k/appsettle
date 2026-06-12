import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Gavel,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { KYB_COUNTERPARTIES, type CounterpartyKyb, type KybStatus } from "@/lib/kyb/mock";
import { PageHeader } from "@/components/ops/page-header";
import { cn } from "@/lib/utils";

// KYB / Counterparty Readiness — UI-ONLY pilot control screen.
// Renders static mock data from lib/kyb/mock.ts. No database writes, no
// approval mutations, no provider calls. Decision buttons are disabled mocks.

const STATUS_CHIP: Record<KybStatus, string> = {
  "Not Started": "prs-chip--neutral",
  "Documents Pending": "prs-chip--pending",
  "Under Review": "prs-chip--pending",
  "Approved for Shadow": "prs-chip--ok",
  Blocked: "prs-chip--blocked",
};

const RISK_CHIP: Record<CounterpartyKyb["riskRating"], string> = {
  Low: "prs-chip--ok",
  Medium: "prs-chip--pending",
  High: "prs-chip--blocked",
  Unrated: "prs-chip--neutral",
};

function MockDecisionButton({ label, tone }: { label: string; tone: "review" | "approve" | "block" }) {
  const toneClass =
    tone === "approve"
      ? "border-[rgba(0,199,157,0.32)] bg-[rgba(0,199,157,0.1)] text-[#5ff0cf]"
      : tone === "block"
        ? "border-[rgba(255,122,122,0.32)] bg-[rgba(255,99,99,0.1)] text-[#ffb4b4]"
        : "border-[rgba(242,173,35,0.32)] bg-[rgba(242,173,35,0.1)] text-[#ffd58a]";
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Mock control — decisions are recorded outside the app for now."
      className={cn(
        "inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold",
        toneClass,
      )}
    >
      {label}
    </button>
  );
}

function CounterpartyCard({ counterparty }: { counterparty: CounterpartyKyb }) {
  const gateDone = counterparty.eligibility.filter((item) => item.done).length;
  const gateTotal = counterparty.eligibility.length;
  const eligible = gateDone === gateTotal;

  return (
    <section className="prs-card p-5 sm:p-6" aria-label={`${counterparty.name} KYB readiness`}>
      {/* Risk card header */}
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-white">{counterparty.name}</h2>
            <span className={cn("prs-chip", STATUS_CHIP[counterparty.status])}>
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              {counterparty.status}
            </span>
            <span className={cn("prs-chip", RISK_CHIP[counterparty.riskRating])}>
              Risk: {counterparty.riskRating}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/50">{counterparty.segment}</p>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/70">{counterparty.summary}</p>
        </div>
        <div className="w-full max-w-[230px] shrink-0 sm:w-[230px]">
          <div className="flex items-baseline justify-between">
            <span className="prs-eyebrow">Pilot eligibility</span>
            <span className="text-xl font-semibold tabular-nums text-white">
              {gateDone}
              <span className="text-xs font-medium text-white/40">/{gateTotal}</span>
            </span>
          </div>
          <div className="prs-score-track mt-1.5" role="img" aria-label={`Eligibility ${gateDone} of ${gateTotal}`}>
            <div className="prs-score-fill" style={{ width: `${Math.round((gateDone / gateTotal) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-white/45">
            {eligible ? "All gate items complete" : `${gateTotal - gateDone} gate item(s) open`}
            {counterparty.reviewOwner ? ` · review owner assigned` : " · no review owner"}
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {/* 1. KYB checklist */}
        <div className="prs-panel p-4 xl:row-span-2">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <ClipboardList className="h-3 w-3" aria-hidden="true" /> KYB checklist
          </p>
          <dl className="mt-2">
            {counterparty.checklist.map((item) => (
              <div key={item.label} className="prs-passport-row">
                <dt>{item.label}</dt>
                <dd className={`prs-val--${item.state}`}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 3. Pilot eligibility gate */}
        <div className="prs-panel p-4 xl:row-span-2">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <ListChecks className="h-3 w-3" aria-hidden="true" /> Pilot eligibility gate · before real-money shadow/live-test
          </p>
          <div className="mt-2">
            {counterparty.eligibility.map((item) => (
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

        {/* 4. Missing items */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <FileWarning className="h-3 w-3" aria-hidden="true" /> Missing items
          </p>
          {counterparty.missingItems.length ? (
            <ul className="mt-2 space-y-1.5">
              {counterparty.missingItems.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[12px] leading-snug text-white/70">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#ffd58a]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-white/70">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#5ff0cf]" aria-hidden="true" />
              No outstanding items — readiness depends on the gate above.
            </p>
          )}
        </div>

        {/* 5. Decision panel */}
        <div className="prs-panel p-4">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <Gavel className="h-3 w-3" aria-hidden="true" /> Decision panel
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <MockDecisionButton label="Mark under review" tone="review" />
            <MockDecisionButton label="Approve for shadow" tone="approve" />
            <MockDecisionButton label="Block counterparty" tone="block" />
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-white/50">
            Mock controls only — no database writes, no approval mutation. In production a decision would
            require an operational role, write an audit event, and never enable live payouts by itself.
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function KybPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Counterparty Readiness"
        description="KYB checklists, risk ratings, and the pilot eligibility gate — evaluated before any counterparty joins a controlled real-money shadow or live test."
      />

      {/* Safety note */}
      <div className="flex items-start gap-2 rounded-xl border border-[var(--ops-line)] bg-white p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald-ink" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">KYB Readiness is a pilot control screen.</span> It does
          not onboard counterparties automatically, does not move funds, and does not enable live payouts. All
          data on this page is a local assessment snapshot.
        </p>
      </div>

      {KYB_COUNTERPARTIES.map((counterparty) => (
        <CounterpartyCard key={counterparty.id} counterparty={counterparty} />
      ))}
    </div>
  );
}
