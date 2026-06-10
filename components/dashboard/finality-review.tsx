"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, FileCheck2, Landmark, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Display-only "Proof-to-Settlement" case file panel. All inputs are
// precomputed, serializable values — this component never fetches and never
// decides; the deterministic decision comes from lib/finality.ts on the server.

export type FinalityReviewData = {
  decision: "ready_to_finalize" | "needs_review" | "not_ready";
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  summary: string;
  blockingIssues: string[];
  warnings: string[];
  evidence: string[];
  recommendedActions: string[];
  proof: {
    provider: string;
    providerStatus: string;
    providerTransactionId?: string;
    utr?: string;
    actualAmount?: string;
    currency?: string;
    receivedVia: string;
    receivedAt: string;
  } | null;
  proofCount: number;
  reconciliation: {
    status: string;
    externalRef: string;
    source: string;
    amount: string;
  } | null;
  auditApprovalPresent: boolean;
};

const DECISION_META = {
  ready_to_finalize: {
    label: "Ready to finalize",
    icon: CheckCircle2,
    banner: "border-emerald-200 bg-emerald-50 text-emerald-900",
    chip: "bg-emerald-100 text-emerald-800",
  },
  needs_review: {
    label: "Needs review",
    icon: AlertTriangle,
    banner: "border-amber-200 bg-amber-50 text-amber-900",
    chip: "bg-amber-100 text-amber-800",
  },
  not_ready: {
    label: "Not ready",
    icon: CircleDashed,
    banner: "border-slate-200 bg-slate-50 text-slate-700",
    chip: "bg-slate-200 text-slate-700",
  },
} as const;

const RISK_META = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
} as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{children}</p>
  );
}

function IssueList({ items, tone }: { items: string[]; tone: "danger" | "warning" | "info" | "neutral" }) {
  const dot =
    tone === "danger"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "info"
          ? "bg-emerald-500"
          : "bg-slate-400";
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function FinalityReview({ data }: { data: FinalityReviewData }) {
  const meta = DECISION_META[data.decision];
  const Icon = meta.icon;
  const confidence = Math.max(0, Math.min(100, data.confidence));

  return (
    <div className="space-y-3">
      {/* Decision banner */}
      <div className={cn("rounded-xl border p-3", meta.banner)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">{meta.label}</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
              RISK_META[data.riskLevel],
            )}
          >
            {data.riskLevel} risk
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed opacity-90">{data.summary}</p>
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] opacity-70">
            <span>Finality confidence</span>
            <span className="tabular-nums">{confidence}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/60">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                data.decision === "ready_to_finalize"
                  ? "bg-emerald-500"
                  : data.decision === "needs_review"
                    ? "bg-amber-500"
                    : "bg-slate-400",
              )}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* Blocking issues / warnings */}
      {data.blockingIssues.length > 0 ? (
        <div className="rounded-xl border border-[var(--ops-line)] p-3">
          <SectionLabel>Blocking issues</SectionLabel>
          <IssueList items={data.blockingIssues} tone="danger" />
        </div>
      ) : null}
      {data.warnings.length > 0 ? (
        <div className="rounded-xl border border-[var(--ops-line)] p-3">
          <SectionLabel>Warnings</SectionLabel>
          <IssueList items={data.warnings} tone="warning" />
        </div>
      ) : null}

      {/* Independent evidence: proof + reconciliation + audit */}
      <div className="rounded-xl border border-[var(--ops-line)] p-3">
        <SectionLabel>Provider proof</SectionLabel>
        {data.proof ? (
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-medium text-slate-900">{data.proof.provider}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-slate-600">
                {data.proof.providerStatus}
              </span>
              <span className="text-[10px] uppercase tracking-[0.05em] text-slate-400">
                via {data.proof.receivedVia.toLowerCase()}
              </span>
            </div>
            {data.proof.providerTransactionId ? <p>Transaction {data.proof.providerTransactionId}</p> : null}
            {data.proof.utr ? <p>UTR {data.proof.utr}</p> : null}
            {data.proof.actualAmount ? (
              <p>
                Reported amount {data.proof.actualAmount} {data.proof.currency ?? ""}
              </p>
            ) : (
              <p className="text-slate-400">No payout amount reported by the provider.</p>
            )}
            <p className="text-slate-400">
              Received {data.proof.receivedAt}
              {data.proofCount > 1 ? ` · ${data.proofCount} proof records on file` : ""}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No provider proof recorded yet.</p>
        )}
      </div>

      <div className="rounded-xl border border-[var(--ops-line)] p-3">
        <SectionLabel>Independent reconciliation</SectionLabel>
        {data.reconciliation ? (
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <div className="space-y-0.5">
              <p>
                <span className="font-medium text-slate-900">{data.reconciliation.externalRef}</span>{" "}
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-slate-600">
                  {data.reconciliation.status}
                </span>
              </p>
              <p>
                {data.reconciliation.source} · {data.reconciliation.amount}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            No reconciliation record linked — provider claim is uncorroborated.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[var(--ops-line)] p-3">
        <SectionLabel>Audit trail</SectionLabel>
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck
            className={cn("h-3.5 w-3.5", data.auditApprovalPresent ? "text-emerald-500" : "text-slate-300")}
          />
          <span className={data.auditApprovalPresent ? "text-slate-600" : "text-slate-400"}>
            {data.auditApprovalPresent
              ? "Approval recorded in the audit trail."
              : "No approval recorded in the audit trail."}
          </span>
        </div>
      </div>

      {/* Evidence + recommended actions */}
      {data.evidence.length > 0 ? (
        <div className="rounded-xl border border-[var(--ops-line)] p-3">
          <SectionLabel>Evidence</SectionLabel>
          <IssueList items={data.evidence} tone="info" />
        </div>
      ) : null}
      {data.recommendedActions.length > 0 ? (
        <div className="rounded-xl border border-[var(--ops-line)] p-3">
          <SectionLabel>Recommended actions</SectionLabel>
          <IssueList items={data.recommendedActions} tone="neutral" />
        </div>
      ) : null}
    </div>
  );
}
