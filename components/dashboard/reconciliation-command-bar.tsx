"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, FlaskConical, Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type ReconciliationCommandBarProps = {
  addRecordForm: ReactNode;
  autoMatchForm: ReactNode;
  /** Demo data utilities — rendered in a subtle, clearly-labelled dropdown. */
  demoForms?: ReactNode;
};

export function ReconciliationCommandBar({
  addRecordForm,
  autoMatchForm,
  demoForms,
}: ReconciliationCommandBarProps) {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="ops-panel ops-panel-accent overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-[var(--ops-line-soft)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Primary action: capture independent evidence */}
        <button
          type="button"
          onClick={() => setComposerOpen((open) => !open)}
          aria-expanded={composerOpen}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
            composerOpen
              ? "border-brand-emerald/35 bg-brand-emerald/[0.1] text-brand-emerald-ink"
              : "border-brand-emerald/30 bg-brand-emerald/[0.06] text-brand-emerald-ink hover:border-brand-emerald/45 hover:bg-brand-emerald/[0.1]",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Add external record
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", composerOpen && "rotate-180")} />
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400 sm:inline-flex">
            <Zap className="h-3 w-3" />
            Matching
          </span>
          {autoMatchForm}
          {demoForms ? (
            <details className="reconciliation-demo-utils relative">
              <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600">
                <FlaskConical className="h-3 w-3" aria-hidden="true" />
                Demo utilities
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-max max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--ops-line)] bg-white p-2.5 shadow-ops-md">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-amber-700">
                  Demo data only — not production actions
                </p>
                {demoForms}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      {composerOpen ? (
        <div className="border-b border-[var(--ops-line-soft)] bg-slate-50/40 px-3 py-3">
          <p className="mb-2.5 text-xs text-slate-500">
            Capture a bank, chain, or PSP record — independent evidence only. Saved as OPEN, then reconciled
            via auto-match or a manual link.
          </p>
          {addRecordForm}
        </div>
      ) : null}
    </div>
  );
}
