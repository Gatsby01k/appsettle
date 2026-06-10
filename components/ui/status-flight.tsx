"use client";

import { useEffect, useRef, useState } from "react";
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

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

const DURATION = {
  completed: 0.82,
  settled: 0.82,
  reconciled: 1.02,
  failed: 0.78,
  mismatch: 0.78,
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

function SuccessTrail({
  status,
  cycle,
  reducedMotion,
}: {
  status: "completed" | "settled" | "reconciled";
  cycle: number;
  reducedMotion: boolean;
}) {
  const duration = DURATION[status];
  const calmer = status === "reconciled";
  const trailDelay = reducedMotion ? 0 : duration * 0.08;
  const iconDelay = reducedMotion ? 0 : duration * 0.58;
  const glowDelay = reducedMotion ? 0 : duration * 0.5;

  const trailVia = calmer ? "via-brand-aqua/90" : "via-brand-emerald";
  const trailGlow = calmer ? "from-brand-aqua/0 via-brand-aqua/25 to-brand-aqua/0" : "from-brand-emerald/0 via-brand-emerald/30 to-brand-emerald/0";
  const iconClass = calmer ? "text-[#0a7d86]" : "text-brand-emerald-ink";
  const glowClass = calmer ? "bg-brand-aqua/12" : "bg-brand-emerald/14";

  return (
    <span className="relative inline-flex h-4 w-14 items-center" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200/80" />

      {!reducedMotion ? (
        <motion.span
          key={`trail-${cycle}`}
          className="absolute top-1/2 h-[2px] w-10 -translate-y-1/2"
          initial={{ left: "-40%", opacity: 0 }}
          animate={{ left: ["-40%", "72%"], opacity: [0, 1, 0.85, 0] }}
          transition={{ duration: duration * 0.62, ease: EASE, delay: trailDelay }}
        >
          <span className={cn("block h-full w-full rounded-full bg-gradient-to-r from-transparent to-transparent", trailVia)} />
          <span
            className={cn(
              "pointer-events-none absolute inset-0 -top-px h-[4px] rounded-full bg-gradient-to-r blur-[2px]",
              trailGlow,
            )}
          />
        </motion.span>
      ) : null}

      <motion.span
        key={`glow-${cycle}`}
        className={cn("pointer-events-none absolute inset-0 rounded-md", glowClass)}
        initial={{ opacity: 0 }}
        animate={{ opacity: reducedMotion ? 0.25 : [0, 0.55, 0.18] }}
        transition={{ duration: reducedMotion ? 0 : duration * 0.45, ease: EASE, delay: glowDelay }}
      />

      <motion.span
        key={`check-${cycle}`}
        className="absolute right-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,199,157,0.12),0_0_10px_rgba(0,199,157,0.18)]"
        initial={{ opacity: reducedMotion ? 1 : 0, scale: reducedMotion ? 1 : 0.72 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE, delay: iconDelay }}
      >
        <Check className={cn("h-2.5 w-2.5 stroke-[2.5]", iconClass)} />
      </motion.span>
    </span>
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
  const duration = DURATION[status];
  const isMismatch = status === "mismatch";
  const trailColor = isMismatch ? "from-orange-400/90 via-orange-500/80" : "from-rose-400/90 via-rose-500/85";
  const iconClass = isMismatch ? "text-orange-600" : "text-rose-600";
  const ringClass = isMismatch
    ? "shadow-[0_0_0_1px_rgba(249,115,22,0.15),0_0_8px_rgba(249,115,22,0.12)]"
    : "shadow-[0_0_0_1px_rgba(244,63,94,0.15),0_0_8px_rgba(244,63,94,0.12)]";

  return (
    <motion.span
      key={`error-${cycle}`}
      className="relative inline-flex h-4 w-14 items-center"
      aria-hidden
      animate={
        reducedMotion
          ? undefined
          : {
              x: [0, -1.2, 1.2, -0.6, 0],
            }
      }
      transition={{ duration: 0.32, ease: EASE, delay: duration * 0.52 }}
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200/70" />

      {!reducedMotion ? (
        <>
          <motion.span
            className={cn("absolute top-1/2 left-0 h-[2px] w-[38%] -translate-y-1/2 rounded-full bg-gradient-to-r to-transparent", trailColor)}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: [0, 1, 0.7] }}
            transition={{ duration: duration * 0.34, ease: EASE }}
            style={{ transformOrigin: "left center" }}
          />
          <span className="absolute top-1/2 left-[42%] h-1 w-1 -translate-y-1/2 rounded-full bg-orange-400/70" />
          <motion.span
            className="absolute top-1/2 left-[48%] h-[2px] w-[18%] -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-300/50 to-transparent"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 0.6, 0], opacity: [0, 0.45, 0] }}
            transition={{ duration: duration * 0.28, ease: EASE, delay: duration * 0.22 }}
            style={{ transformOrigin: "left center" }}
          />
        </>
      ) : null}

      <motion.span
        className={cn(
          "absolute right-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white",
          ringClass,
        )}
        initial={{ opacity: reducedMotion ? 1 : 0, scale: reducedMotion ? 1 : 0.72 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.26, ease: EASE, delay: reducedMotion ? 0 : duration * 0.48 }}
      >
        <AlertTriangle className={cn("h-2.5 w-2.5 stroke-[2.5]", iconClass)} />
      </motion.span>
    </motion.span>
  );
}

function RestingIcon({ status }: { status: StatusFlightStatus }) {
  if (SUCCESS.has(status)) {
    const calmer = status === "reconciled";
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,199,157,0.1)]"
        aria-hidden
      >
        <Check className={cn("h-2.5 w-2.5 stroke-[2.5]", calmer ? "text-[#0a7d86]" : "text-brand-emerald-ink")} />
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
