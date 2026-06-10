"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusFlightStatus =
  | "pending"
  | "completed"
  | "settled"
  | "reconciled"
  | "failed"
  | "mismatch";

type StatusFlightProps = {
  status: StatusFlightStatus;
  trigger?: boolean;
  label?: string;
  className?: string;
};

const SUCCESS: ReadonlySet<StatusFlightStatus> = new Set(["completed", "settled", "reconciled"]);
const ERROR: ReadonlySet<StatusFlightStatus> = new Set(["failed", "mismatch"]);

const EASE: [number, number, number, number] = [0.22, 0.68, 0.18, 1];

const DURATION = {
  completed: 0.9,
  settled: 0.9,
  reconciled: 0.95,
  failed: 0.82,
  mismatch: 0.82,
} as const;

function displayLabel(status: StatusFlightStatus, label?: string) {
  if (label !== undefined) return label || undefined;
  if (status === "reconciled") return "Reconciliation matched";
  return undefined;
}

function PendingIndicator({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
      {!reducedMotion ? (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-amber/35" />
      ) : null}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-amber shadow-[0_0_6px_rgba(242,173,35,0.35)]" />
    </span>
  );
}

type SwiftPalette = {
  teal: string;
  emerald: string;
  gold: string;
  glow: string;
  iconClass: string;
  ringShadow: string;
};

const SUCCESS_PALETTES: Record<"completed" | "settled" | "reconciled", SwiftPalette> = {
  completed: {
    teal: "#0bb4c4",
    emerald: "#00c79d",
    gold: "#e8c45c",
    glow: "rgba(0, 199, 157, 0.55)",
    iconClass: "text-brand-emerald-ink",
    ringShadow: "0 0 0 1px rgba(0,199,157,0.14), 0 0 12px rgba(0,199,157,0.22)",
  },
  settled: {
    teal: "#0bb4c4",
    emerald: "#00c79d",
    gold: "#d4b84a",
    glow: "rgba(11, 180, 196, 0.5)",
    iconClass: "text-brand-emerald-ink",
    ringShadow: "0 0 0 1px rgba(0,199,157,0.14), 0 0 12px rgba(11,180,196,0.2)",
  },
  reconciled: {
    teal: "#0bb4c4",
    emerald: "#0a9eaa",
    gold: "#7ec8cf",
    glow: "rgba(11, 180, 196, 0.48)",
    iconClass: "text-[#0a7d86]",
    ringShadow: "0 0 0 1px rgba(11,180,196,0.16), 0 0 12px rgba(11,180,196,0.2)",
  },
};

function SwiftBirdSvg({
  gradientId,
  glowId,
  palette,
  className,
}: {
  gradientId: string;
  glowId: string;
  palette: SwiftPalette;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 56 28"
      fill="none"
      className={cn("h-7 w-14", className)}
      style={{ filter: `drop-shadow(0 0 4px ${palette.glow}) drop-shadow(0 1px 6px ${palette.glow})` }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="14" x2="56" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.teal} stopOpacity="0.55" />
          <stop offset="38%" stopColor={palette.emerald} />
          <stop offset="78%" stopColor={palette.emerald} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.gold} />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${glowId})`}>
        <path
          d="M 3 15 Q 0 14.2 0 15"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeOpacity="0.45"
        />
        <path
          d="M 4 15 C 12 6.5, 26 4, 50 12.5"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 7 16.5 C 16 23.5, 30 22, 48 14.5"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 50 12.5 L 54 14"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function FlightTrailSvg({
  gradientId,
  palette,
  className,
}: {
  gradientId: string;
  palette: SwiftPalette;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 56 28" fill="none" className={cn("h-7 w-14", className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="14" x2="56" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.teal} stopOpacity="0" />
          <stop offset="25%" stopColor={palette.teal} stopOpacity="0.35" />
          <stop offset="65%" stopColor={palette.emerald} stopOpacity="0.7" />
          <stop offset="100%" stopColor={palette.gold} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d="M 0 14.5 C 10 13.5, 22 14.8, 34 14.2 C 42 13.8, 48 14, 52 14.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        style={{ filter: `blur(2px) drop-shadow(0 0 5px ${palette.glow})` }}
      />
      <path
        d="M 2 15.2 C 14 14.6, 26 15.4, 40 14.8"
        stroke={`url(#${gradientId})`}
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.55"
        style={{ filter: `blur(1px)` }}
      />
    </svg>
  );
}

function SuccessTrail({
  status,
  cycle,
  reducedMotion,
}: {
  status: "completed" | "settled" | "reconciled";
  cycle: number;
  reducedMotion: boolean;
}) {
  const uid = useId();
  const duration = DURATION[status];
  const palette = SUCCESS_PALETTES[status];
  const birdGradId = `${uid}-bird-${cycle}`;
  const trailGradId = `${uid}-trail-${cycle}`;
  const glowFilterId = `${uid}-glow-${cycle}`;
  const iconDelay = reducedMotion ? 0 : duration * 0.58;
  const flightDuration = reducedMotion ? 0 : duration * 0.62;

  return (
    <span className="relative inline-flex h-8 w-16 items-center overflow-visible" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200/70" />

      {!reducedMotion ? (
        <>
          <motion.span
            key={`trail-${cycle}`}
            className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2"
            initial={{ x: "-42%", opacity: 0, scaleX: 0.55 }}
            animate={{
              x: ["-42%", "8%", "52%"],
              opacity: [0, 0.85, 0.55, 0],
              scaleX: [0.55, 1, 1.05, 0.9],
            }}
            transition={{
              duration: flightDuration,
              ease: EASE,
              times: [0, 0.2, 0.72, 1],
            }}
          >
            <FlightTrailSvg gradientId={trailGradId} palette={palette} />
          </motion.span>

          <motion.span
            key={`bird-${cycle}`}
            className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2"
            initial={{ x: "-38%", opacity: 0, scale: 0.82 }}
            animate={{
              x: ["-38%", "18%", "58%"],
              opacity: [0, 1, 1, 0],
              scale: [0.82, 1.04, 0.96, 0.86],
            }}
            transition={{
              duration: flightDuration,
              ease: EASE,
              times: [0, 0.16, 0.68, 1],
              delay: duration * 0.04,
            }}
          >
            <SwiftBirdSvg
              gradientId={birdGradId}
              glowId={glowFilterId}
              palette={palette}
            />
          </motion.span>
        </>
      ) : null}

      <motion.span
        key={`glow-${cycle}`}
        className="pointer-events-none absolute inset-0 rounded-md bg-brand-emerald/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: reducedMotion ? 0.2 : [0, 0.5, 0.12] }}
        transition={{ duration: reducedMotion ? 0 : duration * 0.42, ease: EASE, delay: duration * 0.48 }}
      />

      <motion.span
        key={`check-${cycle}`}
        className="absolute right-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white"
        style={{ boxShadow: palette.ringShadow }}
        initial={{ opacity: reducedMotion ? 1 : 0, scale: reducedMotion ? 1 : 0.65 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.3, ease: EASE, delay: iconDelay }}
      >
        <Check className={cn("h-2.5 w-2.5 stroke-[2.5]", palette.iconClass)} />
      </motion.span>
    </span>
  );
}

function BrokenTrailSvg({
  gradientId,
  isMismatch,
  className,
}: {
  gradientId: string;
  isMismatch: boolean;
  className?: string;
}) {
  const primary = isMismatch ? "#f97316" : "#f43f5e";
  const secondary = isMismatch ? "#fb923c" : "#fb7185";

  return (
    <svg viewBox="0 0 56 28" fill="none" className={cn("h-7 w-14", className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="14" x2="56" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={primary} stopOpacity="0.2" />
          <stop offset="50%" stopColor={primary} stopOpacity="0.85" />
          <stop offset="100%" stopColor={secondary} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M 2 14 L 14 14"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        style={{ filter: isMismatch ? "drop-shadow(0 0 4px rgba(249,115,22,0.35))" : "drop-shadow(0 0 4px rgba(244,63,94,0.35))" }}
      />
      <circle cx="18" cy="14" r="1.1" fill={primary} fillOpacity="0.55" />
      <path
        d="M 22 12.8 L 30 15.2"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />
      <circle cx="33" cy="14" r="0.9" fill={secondary} fillOpacity="0.45" />
      <path
        d="M 36 14.6 L 44 13.4"
        stroke={secondary}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.4"
        strokeDasharray="2 3"
      />
    </svg>
  );
}

function ErrorTrail({
  status,
  cycle,
  reducedMotion,
}: {
  status: "failed" | "mismatch";
  cycle: number;
  reducedMotion: boolean;
}) {
  const uid = useId();
  const duration = DURATION[status];
  const isMismatch = status === "mismatch";
  const trailGradId = `${uid}-err-${cycle}`;
  const iconClass = isMismatch ? "text-orange-600" : "text-rose-600";
  const ringClass = isMismatch
    ? "shadow-[0_0_0_1px_rgba(249,115,22,0.16),0_0_10px_rgba(249,115,22,0.14)]"
    : "shadow-[0_0_0_1px_rgba(244,63,94,0.16),0_0_10px_rgba(244,63,94,0.14)]";

  return (
    <motion.span
      key={`error-${cycle}`}
      className="relative inline-flex h-8 w-16 items-center"
      aria-hidden
      animate={
        reducedMotion
          ? undefined
          : {
              x: [0, -1.4, 1.4, -0.7, 0],
            }
      }
      transition={{ duration: 0.34, ease: EASE, delay: duration * 0.5 }}
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200/70" />

      {!reducedMotion ? (
        <motion.span
          className="absolute top-1/2 left-0 -translate-y-1/2"
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: [0, 1, 0.75], scaleX: [0.4, 1, 1] }}
          transition={{ duration: duration * 0.38, ease: EASE }}
          style={{ transformOrigin: "left center" }}
        >
          <BrokenTrailSvg gradientId={trailGradId} isMismatch={isMismatch} />
        </motion.span>
      ) : null}

      <motion.span
        className={cn(
          "absolute right-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white",
          ringClass,
        )}
        initial={{ opacity: reducedMotion ? 1 : 0, scale: reducedMotion ? 1 : 0.65 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE, delay: reducedMotion ? 0 : duration * 0.48 }}
      >
        <AlertTriangle className={cn("h-2.5 w-2.5 stroke-[2.5]", iconClass)} />
      </motion.span>
    </motion.span>
  );
}

function RestingIcon({ status }: { status: StatusFlightStatus }) {
  if (SUCCESS.has(status)) {
    const palette = SUCCESS_PALETTES[status as "completed" | "settled" | "reconciled"];
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,199,157,0.1)]"
        aria-hidden
      >
        <Check className={cn("h-2.5 w-2.5 stroke-[2.5]", palette.iconClass)} />
      </span>
    );
  }

  if (ERROR.has(status)) {
    const isMismatch = status === "mismatch";
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(244,63,94,0.1)]"
        aria-hidden
      >
        <AlertTriangle className={cn("h-2.5 w-2.5 stroke-[2.5]", isMismatch ? "text-orange-600" : "text-rose-600")} />
      </span>
    );
  }

  return null;
}

export function StatusFlight({ status, trigger = false, label, className }: StatusFlightProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [cycle, setCycle] = useState(0);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (trigger && !prevTrigger.current) {
      setCycle((value) => value + 1);
    }
    prevTrigger.current = trigger;
  }, [trigger]);

  const text = displayLabel(status, label);
  const isAnimating = trigger && status !== "pending";

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
      aria-label={text ?? status}
    >
      {status === "pending" ? <PendingIndicator reducedMotion={reducedMotion} /> : null}

      {isAnimating && (status === "completed" || status === "settled" || status === "reconciled") ? (
        <SuccessTrail status={status} cycle={cycle} reducedMotion={reducedMotion} />
      ) : null}

      {isAnimating && (status === "failed" || status === "mismatch") ? (
        <ErrorTrail status={status} cycle={cycle} reducedMotion={reducedMotion} />
      ) : null}

      {!isAnimating && status !== "pending" ? <RestingIcon status={status} /> : null}

      {text ? (
        <span className="text-[11.5px] font-medium tracking-tight text-slate-600">{text}</span>
      ) : null}
    </span>
  );
}
