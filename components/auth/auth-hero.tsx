import Image from "next/image";
import { FileLock2, ShieldCheck, Users } from "lucide-react";

const trustSignals = [
  { icon: ShieldCheck, label: "SOC 2 aligned controls" },
  { icon: FileLock2, label: "Immutable audit trail" },
  { icon: Users, label: "Role-based access" },
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
        <path d="M-40,520 C 180,640 380,420 580,560 S 760,640 820,500" stroke="url(#authRailB)" strokeWidth="1.4" strokeDasharray="2 10" />
        <path d="M-40,180 C 240,260 420,120 620,240" stroke="url(#authRailB)" strokeWidth="1" strokeDasharray="2 12" />
        <g>
          <circle cx="200" cy="180" r="22" fill="url(#authNode)" />
          <circle cx="200" cy="180" r="2.6" fill="#24ddb6" />
          <circle cx="560" cy="300" r="26" fill="url(#authNodeAmber)" />
          <circle cx="560" cy="300" r="2.8" fill="#f2ad23" />
          <circle cx="380" cy="488" r="20" fill="url(#authNode)" />
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
          The operations console behind{" "}
          <span className="brand-gradient-text">INR &harr; stablecoin</span> settlement rails.
        </h1>
        <p className="text-[15px] leading-relaxed text-white/65">
          Quote, settle, reconcile, and audit cross-border liquidity in one institutional workspace — built for
          authorized treasury and settlement operators.
        </p>
      </div>

      <div className="relative space-y-3 px-12 pb-12">
        {trustSignals.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 text-[13px] font-medium text-white/55">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-brand-emerald-2">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
