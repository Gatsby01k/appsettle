import Image from "next/image";
import { FileLock2, ShieldCheck, UserCheck, Users } from "lucide-react";

// Security/status stack: states the controls that protect the console.
// Display copy only — every item reflects a real, enforced control.
const securityStack = [
  { icon: FileLock2, label: "Audit logging active", state: "Active" },
  { icon: Users, label: "RBAC enforced", state: "Enforced" },
  { icon: UserCheck, label: "Dual-control ready", state: "Ready" },
  { icon: ShieldCheck, label: "Demo workspace protected", state: "Protected" },
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

      <div className="relative flex items-center gap-3 px-12 pt-12">
        <Image
          src="/assets/mark.png"
          alt="INRSettle"
          width={44}
          height={44}
          className="rounded-xl border border-white/10 bg-white/5 p-1.5"
        />
        <span className="text-lg font-semibold tracking-tight">INRSettle</span>
      </div>

      <div className="relative max-w-md space-y-7 px-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-tight text-brand-emerald-2 backdrop-blur-sm">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Protected treasury environment
        </p>
        <h1 className="text-[2rem] font-semibold leading-[1.12] tracking-tight">
          The control layer behind <span className="brand-gradient-text">INR settlement</span> operations.
        </h1>
        <p className="text-[15px] leading-relaxed text-white/65">
          Provider proof, reconciliation, finality review and audit trail in one protected workspace.
        </p>
      </div>

      {/* Security / status stack */}
      <div className="relative px-12 pb-12">
        <div className="auth-status-card max-w-sm rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">Workspace controls</p>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-emerald-2">
              <span className="auth-live-dot h-1.5 w-1.5 rounded-full bg-brand-emerald" aria-hidden="true" />
              Live
            </span>
          </div>
          <div className="mt-1.5">
            {securityStack.map(({ icon: Icon, label, state }) => (
              <div
                key={label}
                className="flex items-center gap-3 border-b border-white/[0.06] py-2 text-[13px] font-medium text-white/70 last:border-b-0"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-brand-emerald-2">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="shrink-0 rounded-full border border-[rgba(0,199,157,0.3)] bg-[rgba(0,199,157,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#5ff0cf]">
                  {state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
