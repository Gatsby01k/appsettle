"use client";

import * as React from "react";
import { Check, Copy, FlaskConical } from "lucide-react";
import type { DemoCredentials } from "@/lib/demo";
import { cn } from "@/lib/utils";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — fail quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 shadow-ops-xs transition-colors",
        "hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald/40",
        copied && "border-brand-emerald/40 text-brand-emerald-ink",
      )}
    >
      {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="truncate font-mono text-[13px] text-slate-700">{value}</dd>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function DemoAccessBlock({ credentials }: { credentials: DemoCredentials }) {
  return (
    <section
      aria-label="Demo environment access"
      className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-ops-xs backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-emerald/10 text-brand-emerald-ink">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-slate-800">Demo environment</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
        Explore the console with sample treasury data. Credentials reset periodically.
      </p>
      <dl className="mt-2.5 divide-y divide-slate-100">
        <CredentialRow label="Email" value={credentials.email} />
        <CredentialRow label="Password" value={credentials.password} />
      </dl>
    </section>
  );
}
