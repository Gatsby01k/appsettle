import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  OctagonAlert,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import {
  FINALITY_PILLARS,
  FINAL_STATEMENT,
  GO_NO_GO,
  PILOT_LIMITS,
  PROOF_DOCUMENTS,
  READINESS_CARDS,
  STOP_CONDITIONS,
  type ReadinessStatus,
} from "@/lib/pilot-readiness/mock";
import { PageHeader } from "@/components/ops/page-header";
import { cn } from "@/lib/utils";

// Pilot Readiness / Proof Pack — UI-ONLY readiness and evidence overview.
// Renders static mock data from lib/pilot-readiness/mock.ts. No DB writes,
// no provider calls, no fetch, no process.env reads. All buttons are
// disabled mocks. This page cannot enable live operations.

const STATUS_CHIP: Record<ReadinessStatus, string> = {
  Pass: "prs-chip--ok",
  "Needs Review": "prs-chip--pending",
  Blocked: "prs-chip--blocked",
};

const STATUS_VAL: Record<ReadinessStatus, string> = {
  Pass: "prs-val--ok",
  "Needs Review": "prs-val--pending",
  Blocked: "prs-val--blocked",
};

function MockButton({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Mock control — readiness review happens through the documented checklist process."
      className={cn(
        "inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold",
        primary
          ? "border-[rgba(0,199,157,0.32)] bg-[rgba(0,199,157,0.1)] text-[#5ff0cf]"
          : "border-white/15 bg-white/[0.06] text-white/65",
      )}
    >
      {label}
    </button>
  );
}

export default async function PilotReadinessPage() {
  await requireSession();

  const passCount = GO_NO_GO.filter((row) => row.status === "Pass").length;
  const blockedCount = GO_NO_GO.filter((row) => row.status === "Blocked").length;
  const reviewCount = GO_NO_GO.length - passCount - blockedCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pilot Proof Pack"
        description="Readiness and evidence overview for the controlled real-money shadow/live-test pilot — what is proven, what needs review, and what blocks go-live."
      />

      {/* Safety note */}
      <div className="flex items-start gap-2 rounded-xl border border-[var(--ops-line)] bg-white p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald-ink" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Pilot Readiness is an evidence and control
          overview.</span>{" "}
          It does not execute payouts, does not enable live operations, and does not approve production usage.
        </p>
      </div>

      {/* 2. Core principle */}
      <section className="prs-card p-5 sm:p-6" aria-label="Core principle">
        <div className="relative">
          <p className="prs-eyebrow">Core principle</p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-white">
            Payment completed ≠ settlement finalized. Provider completed ≠ ready to finalize.
          </h2>
          <p className="mt-1 text-xs text-white/50">Settlement finality requires all six pillars to agree:</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FINALITY_PILLARS.map((pillar, index) => (
              <span key={pillar} className="prs-chip prs-chip--neutral">
                <span className="text-white/35">{index + 1}</span> {pillar}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 1. Readiness overview cards */}
      <section className="prs-card p-5 sm:p-6" aria-label="Readiness overview">
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-white">Readiness overview</h2>
          <div className="flex flex-wrap gap-1.5">
            <span className="prs-chip prs-chip--ok">{passCount} Pass</span>
            <span className="prs-chip prs-chip--pending">{reviewCount} Needs Review</span>
            <span className="prs-chip prs-chip--blocked">{blockedCount} Blocked</span>
          </div>
        </div>
        <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {READINESS_CARDS.map((card) => (
            <div key={card.id} className="prs-panel p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white/90">{card.title}</p>
                <span className={cn("prs-chip", STATUS_CHIP[card.status])}>{card.status}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">{card.explanation}</p>
              <p className="mt-1.5 text-[10px] text-white/40">
                Owner: <span className="text-white/60">{card.owner}</span>
              </p>
              <p className="text-[10px] text-white/40">
                Evidence: <span className="text-white/60">{card.evidence}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Go / No-Go matrix */}
      <section className="prs-card p-5 sm:p-6" aria-label="Go / No-Go matrix">
        <h2 className="relative flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <Scale className="h-4 w-4 text-white/50" aria-hidden="true" /> Go / No-Go matrix
        </h2>
        <p className="relative mt-1 text-xs text-white/45">A single Blocked row stops the pilot.</p>
        <div className="relative mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                <th className="py-2 pr-3">Area</th>
                <th className="py-2 pr-3">Required state</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Evidence</th>
                <th className="py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {GO_NO_GO.map((row) => (
                <tr key={row.area} className="border-b border-white/[0.06]">
                  <td className="py-2 pr-3 font-semibold text-white/85">{row.area}</td>
                  <td className="py-2 pr-3 text-white/55">{row.requiredState}</td>
                  <td className="py-2 pr-3">
                    <span className={cn("prs-chip", STATUS_CHIP[row.status])}>{row.status}</span>
                  </td>
                  <td className="py-2 pr-3 text-white/55">{row.evidence}</td>
                  <td className="py-2 text-white/55">{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4 + 5: documents and limits */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="prs-card p-5 sm:p-6" aria-label="Proof documents">
          <h2 className="relative flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <Archive className="h-4 w-4 text-white/50" aria-hidden="true" /> Proof documents
          </h2>
          <div className="relative mt-3 grid gap-2.5 sm:grid-cols-2">
            {PROOF_DOCUMENTS.map((doc) => (
              <div key={doc.id} className="prs-panel p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
                  <FileText className="h-3 w-3 shrink-0 text-white/45" aria-hidden="true" />
                  {doc.title}
                </p>
                <p className="mt-1 font-mono text-[10px] text-white/35">{doc.path}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">{doc.summary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="prs-card p-5 sm:p-6" aria-label="Pilot limits">
          <h2 className="relative flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <Gauge className="h-4 w-4 text-white/50" aria-hidden="true" /> Pilot limits
          </h2>
          <p className="relative mt-1 text-xs text-white/45">
            To be agreed and signed before go — software caps must match.
          </p>
          <dl className="relative mt-2">
            {PILOT_LIMITS.map((limit) => (
              <div key={limit.label} className="prs-passport-row">
                <dt>{limit.label}</dt>
                <dd className={`prs-val--${limit.state}`}>{limit.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* 6. Stop conditions */}
      <section className="prs-card p-5 sm:p-6" aria-label="Stop conditions">
        <h2 className="relative flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <OctagonAlert className="h-4 w-4 text-white/50" aria-hidden="true" /> Stop conditions
        </h2>
        <p className="relative mt-1 text-xs text-white/45">
          Any one stops the pilot immediately — no new transactions; in-flight ones monitored to completion.
        </p>
        <div className="relative mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {STOP_CONDITIONS.map((condition, index) => (
            <div key={condition} className="flex items-start gap-1.5 text-[12px] text-white/70">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#ffd58a]" aria-hidden="true" />
              <span>
                <span className="text-white/35">{String(index + 1).padStart(2, "0")}</span> {condition}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Final readiness statement */}
      <section className="prs-card p-5 sm:p-6" aria-label="Final readiness statement">
        <div className="relative">
          <p className="prs-eyebrow flex items-center gap-1.5">
            <ClipboardCheck className="h-3 w-3" aria-hidden="true" /> Final readiness statement
          </p>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-white/85">{FINAL_STATEMENT}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <MockButton label="Review readiness package" primary />
            <MockButton label="Export proof pack" />
            <MockButton label="Start pilot review" />
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/45">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#5ff0cf]" aria-hidden="true" />
            Mock controls only — the readiness review runs through the documented checklist process
            (docs/controlled-live-test-readiness.md), not through this page.
          </p>
        </div>
      </section>
    </div>
  );
}
