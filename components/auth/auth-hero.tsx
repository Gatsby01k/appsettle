import Image from "next/image";
import { FileLock2, Scale, ShieldCheck, UserCheck, Users } from "lucide-react";

// Trust Stack: the controls protecting the console. Display copy only —
// every item reflects a real, enforced control. No live-production claims.
const securityStack = [
  { icon: FileLock2, label: "Audit logging", state: "Active" },
  { icon: Users, label: "RBAC", state: "Enforced" },
  { icon: UserCheck, label: "Dual-control", state: "Ready" },
  { icon: Scale, label: "Finality review", state: "Protected" },
];

/** Soft corridor lines + glowing settlement nodes behind the brand panel. */
function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(0,199,157,0.22),transparent_70%)] blur-2xl" />
      <div className="absolute -bottom-28 right-[-10%] h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(11,180,196,0.16),transparent_70%)] blur-2xl" />
      <div className="absolute right-[14%] top-[18%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(242,173,35,0.12),transparent_70%)] blur-2xl" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 720 900" fill="none" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="authRailA" x1="0" y1="0" x2="720" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0bb4c4" stopOpacity="0" />
            <stop offset="0.28" stopColor="#0bb4c4" stopOpacity="0.55" />
            <stop offset="0.72" stopColor="#f2ad23" stopOpacity="0.42" />
            <stop offset="1" stopColor="#f2ad23" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="authRailB" x1="0" y1="0" x2="720" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00c79d" stopOpacity="0" />
            <stop offset="0.5" stopColor="#00c79d" stopOpacity="0.4" />
            <stop offset="1" stopColor="#00c79d" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="authNode" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#24ddb6" stopOpacity="0.9" />
            <stop offset="1" stopColor="#24ddb6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="authNodeAmber" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f2ad23" stopOpacity="0.85" />
            <stop offset="1" stopColor="#f2ad23" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M-40,300 C 200,180 360,420 560,300 S 760,220 820,340" stroke="url(#authRailA)" strokeWidth="1.6" />
        <path className="auth-rail-dash" d="M-40,520 C 180,640 380,420 580,560 S 760,640 820,500" stroke="url(#authRailB)" strokeWidth="1.4" strokeDasharray="2 10" />
        <path className="auth-rail-dash auth-rail-dash--slow" d="M-40,180 C 240,260 420,120 620,240" stroke="url(#authRailB)" strokeWidth="1" strokeDasharray="2 12" />
        <g>
          <circle className="auth-node-pulse" cx="200" cy="180" r="22" fill="url(#authNode)" />
          <circle cx="200" cy="180" r="2.6" fill="#24ddb6" />
          <circle className="auth-node-pulse auth-node-pulse--late" cx="560" cy="300" r="26" fill="url(#authNodeAmber)" />
          <circle cx="560" cy="300" r="2.8" fill="#f2ad23" />
          <circle className="auth-node-pulse auth-node-pulse--later" cx="380" cy="488" r="20" fill="url(#authNode)" />
          <circle cx="380" cy="488" r="2.4" fill="#24ddb6" />
        </g>
      </svg>
    </div>
  );
}

export function AuthHero() {
  return (
    <section className="ops-rail relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between">
      <HeroBackground />

      {/* Top bar: brand + workspace posture (no "live" implication) */}
      <div className="relative flex items-center justify-between gap-3 px-12 pt-10">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/mark.png"
            alt="INRSettle"
            width={44}
            height={44}
            className="rounded-xl border border-white/10 bg-white/5 p-1.5"
          />
          <span className="text-lg font-semibold tracking-tight">INRSettle</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55 backdrop-blur-sm">
          <ShieldCheck className="h-3 w-3 text-brand-emerald-2" aria-hidden="true" />
          Protected workspace
        </span>
      </div>

      <div className="relative max-w-md space-y-6 px-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-tight text-brand-emerald-2 backdrop-blur-sm">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Settlement operations console
        </p>
        <h1 className="text-[2.15rem] font-semibold leading-[1.08] tracking-[-0.025em]">
          The control layer for <span className="brand-gradient-text">settlement finality</span>.
        </h1>
        <p className="max-w-sm text-[15px] leading-relaxed text-white/60">
          Provider proof, independent reconciliation, finality review and audit evidence in one protected
          workspace.
        </p>
      </div>

      {/* Trust Stack: operational control surface */}
      <div className="relative px-12 pb-10">
        <div className="auth-status-card max-w-md rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Trust stack</p>
            <span className="rounded-full border border-[rgba(0,199,157,0.28)] bg-[rgba(0,199,157,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[#5ff0cf]">
              Demo workspace protected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {securityStack.map(({ icon: Icon, label, state }) => (
              <div key={label} className="auth-trust-card flex items-center gap-2.5 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-brand-emerald-2">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-white/80">{label}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5ff0cf]/80">
                    <i className="auth-trust-dot" aria-hidden="true" />
                    {state}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* Mini evidence flow */}
          <div className="mt-4 border-t border-white/[0.08] pt-3.5">
            <div className="auth-flow" aria-label="Evidence flow: provider proof, reconciliation, finality, audit">
              {["Provider proof", "Reconciliation", "Finality", "Audit"].map((step) => (
                <div key={step} className="auth-flow-step">
                  <i aria-hidden="true" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[10.5px] text-white/35">
              Provider completed ≠ settlement finalized — evidence decides.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
