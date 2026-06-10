"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type StatusFlightStatus =
  | "pending"
  | "completed"
  | "settled"
  | "reconciled"
  | "failed"
  | "mismatch";

type StatusFlightMode = "row" | "screen";

type StatusFlightProps = {
  status: StatusFlightStatus;
  trigger?: boolean;
  mode?: StatusFlightMode;
  label?: string;
  className?: string;
  onComplete?: () => void;
};

const SUCCESS: ReadonlySet<StatusFlightStatus> = new Set(["completed", "settled", "reconciled"]);
const ERROR: ReadonlySet<StatusFlightStatus> = new Set(["failed", "mismatch"]);

const EASE: [number, number, number, number] = [0.22, 0.68, 0.14, 1];

const OVERLAY_DURATION_MS = 1000;
const FLIGHT_OFFSET_PX = 80;

const FLIGHT_DURATION = {
  completed: 0.78,
  settled: 0.78,
  reconciled: 0.82,
  failed: 0.72,
  mismatch: 0.72,
} as const;

type SwiftPalette = {
  teal: string;
  emerald: string;
  gold: string;
  glow: string;
};

const SUCCESS_PALETTES: Record<"completed" | "settled" | "reconciled", SwiftPalette> = {
  completed: {
    teal: "#0bb4c4",
    emerald: "#00c79d",
    gold: "#e8c45c",
    glow: "rgba(0, 199, 157, 0.5)",
  },
  settled: {
    teal: "#0bb4c4",
    emerald: "#00c79d",
    gold: "#d4b84a",
    glow: "rgba(11, 180, 196, 0.45)",
  },
  reconciled: {
    teal: "#0bb4c4",
    emerald: "#0a9eaa",
    gold: "#9edce2",
    glow: "rgba(11, 180, 196, 0.42)",
  },
};

function useRowWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const update = () => setWidth(node.getBoundingClientRect().width);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

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
      className={cn("h-8 w-16", className)}
      style={{ filter: `drop-shadow(0 0 5px ${palette.glow}) drop-shadow(0 1px 8px ${palette.glow})` }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="14" x2="56" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.teal} stopOpacity="0.5" />
          <stop offset="40%" stopColor={palette.emerald} />
          <stop offset="82%" stopColor={palette.emerald} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.gold} />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
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
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 7 16.5 C 16 23.5, 30 22, 48 14.5"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.6"
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

function RowTrailSvg({
  gradientId,
  palette,
  className,
}: {
  gradientId: string;
  palette: SwiftPalette;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 220 32" fill="none" className={cn("h-8 w-[220px]", className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="16" x2="220" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.teal} stopOpacity="0" />
          <stop offset="18%" stopColor={palette.teal} stopOpacity="0.18" />
          <stop offset="55%" stopColor={palette.emerald} stopOpacity="0.55" />
          <stop offset="88%" stopColor={palette.gold} stopOpacity="0.22" />
          <stop offset="100%" stopColor={palette.gold} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M 0 16 C 36 15, 78 16.8, 118 15.6 C 156 14.6, 188 16.2, 220 16"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        style={{ filter: `blur(3px) drop-shadow(0 0 8px ${palette.glow})` }}
      />
      <path
        d="M 8 16.4 C 48 15.8, 92 17, 138 16.2 C 172 15.6, 200 16.6, 216 16.2"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.65"
        style={{ filter: `blur(1px)` }}
      />
      <path
        d="M 20 16.8 C 70 16.2, 120 17.2, 170 16.4"
        stroke={`url(#${gradientId})`}
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeOpacity="0.35"
      />
    </svg>
  );
}

function BrokenRowTrailSvg({
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
    <svg viewBox="0 0 220 32" fill="none" className={cn("h-8 w-[220px]", className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="16" x2="220" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={primary} stopOpacity="0" />
          <stop offset="40%" stopColor={primary} stopOpacity="0.75" />
          <stop offset="100%" stopColor={secondary} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path
        d="M 4 16 L 72 16"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        style={{ filter: isMismatch ? "drop-shadow(0 0 6px rgba(249,115,22,0.35))" : "drop-shadow(0 0 6px rgba(244,63,94,0.35))" }}
      />
      <circle cx="88" cy="16" r="1.4" fill={primary} fillOpacity="0.6" />
      <path d="M 98 14.2 L 138 17.8" stroke={`url(#${gradientId})`} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.8" />
      <circle cx="148" cy="16" r="1.2" fill={secondary} fillOpacity="0.5" />
      <path
        d="M 158 16.8 L 196 15.2"
        stroke={secondary}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.45"
        strokeDasharray="3 4"
      />
    </svg>
  );
}

function RowSuccessOverlay({
  status,
  cycle,
  reducedMotion,
}: {
  status: "completed" | "settled" | "reconciled";
  cycle: number;
  reducedMotion: boolean;
}) {
  const uid = useId();
  const { ref, width } = useRowWidth();
  const palette = SUCCESS_PALETTES[status];
  const flightDuration = reducedMotion ? 0 : FLIGHT_DURATION[status];
  const birdGradId = `${uid}-bird-${cycle}`;
  const trailGradId = `${uid}-trail-${cycle}`;
  const glowFilterId = `${uid}-glow-${cycle}`;
  const start = -FLIGHT_OFFSET_PX;
  const end = width + FLIGHT_OFFSET_PX;

  if (reducedMotion) {
    return (
      <div ref={ref} className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-emerald/10 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.35, 0] }}
          transition={{ duration: 0.5 }}
        />
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.div
        key={`wash-${cycle}`}
        className="absolute inset-0 bg-gradient-to-r from-brand-aqua/[0.03] via-brand-emerald/[0.08] to-brand-amber/[0.03]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.75, 0.2, 0] }}
        transition={{ duration: flightDuration * 1.1, ease: EASE, times: [0, 0.35, 0.72, 1] }}
      />

      {width > 0 ? (
        <>
          <motion.div
            key={`trail-${cycle}`}
            className="absolute top-1/2 -translate-y-1/2 will-change-[left,opacity]"
            initial={{ left: start, opacity: 0 }}
            animate={{ left: [start, end], opacity: [0, 0.9, 0.7, 0] }}
            transition={{ duration: flightDuration, ease: EASE, times: [0, 0.14, 0.78, 1] }}
          >
            <RowTrailSvg gradientId={trailGradId} palette={palette} />
          </motion.div>

          <motion.div
            key={`bird-${cycle}`}
            className="absolute top-1/2 -translate-y-1/2 will-change-[left,opacity,transform]"
            initial={{ left: start, opacity: 0, scale: 0.86 }}
            animate={{
              left: [start, end],
              opacity: [0, 1, 1, 0.55, 0],
              scale: [0.86, 1.05, 1, 0.94, 0.88],
            }}
            transition={{
              duration: flightDuration,
              ease: EASE,
              times: [0, 0.12, 0.55, 0.82, 1],
              delay: 0.03,
            }}
          >
            <SwiftBirdSvg gradientId={birdGradId} glowId={glowFilterId} palette={palette} />
          </motion.div>

          <motion.div
            key={`exit-glow-${cycle}`}
            className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-brand-emerald/18 via-brand-aqua/8 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.85, 0] }}
            transition={{ duration: 0.36, ease: EASE, delay: flightDuration * 0.74, times: [0, 0.15, 0.45, 1] }}
          />
        </>
      ) : null}
    </div>
  );
}

function RowErrorOverlay({
  status,
  cycle,
  reducedMotion,
}: {
  status: "failed" | "mismatch";
  cycle: number;
  reducedMotion: boolean;
}) {
  const uid = useId();
  const { ref, width } = useRowWidth();
  const isMismatch = status === "mismatch";
  const flightDuration = reducedMotion ? 0 : FLIGHT_DURATION[status];
  const trailGradId = `${uid}-err-${cycle}`;
  const start = -FLIGHT_OFFSET_PX;
  const end = width + FLIGHT_OFFSET_PX;

  if (reducedMotion) {
    return (
      <div ref={ref} className="absolute inset-0 overflow-hidden">
        <motion.div
          className={cn(
            "absolute inset-0",
            isMismatch ? "bg-gradient-to-r from-transparent via-orange-500/8 to-transparent" : "bg-gradient-to-r from-transparent via-rose-500/8 to-transparent",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.35, 0] }}
          transition={{ duration: 0.5 }}
        />
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.div
        key={`err-wash-${cycle}`}
        className={cn(
          "absolute inset-0",
          isMismatch ? "bg-gradient-to-r from-transparent via-orange-500/[0.06] to-transparent" : "bg-gradient-to-r from-transparent via-rose-500/[0.06] to-transparent",
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.65, 0] }}
        transition={{ duration: flightDuration * 1.05, ease: EASE }}
      />

      {width > 0 ? (
        <motion.div
          key={`err-trail-${cycle}`}
          className="absolute top-1/2 -translate-y-1/2"
          initial={{ left: start, opacity: 0 }}
          animate={{ left: [start, end], opacity: [0, 1, 0.65, 0] }}
          transition={{ duration: flightDuration, ease: EASE, times: [0, 0.16, 0.76, 1] }}
        >
          <BrokenRowTrailSvg gradientId={trailGradId} isMismatch={isMismatch} />
        </motion.div>
      ) : null}
    </div>
  );
}

function RowOverlay({
  status,
  cycle,
  reducedMotion,
}: {
  status: StatusFlightStatus;
  cycle: number;
  reducedMotion: boolean;
}) {
  if (SUCCESS.has(status)) {
    return (
      <RowSuccessOverlay
        status={status as "completed" | "settled" | "reconciled"}
        cycle={cycle}
        reducedMotion={reducedMotion}
      />
    );
  }

  if (ERROR.has(status)) {
    return (
      <RowErrorOverlay
        status={status as "failed" | "mismatch"}
        cycle={cycle}
        reducedMotion={reducedMotion}
      />
    );
  }

  return null;
}

export function StatusFlight({
  status,
  trigger = false,
  mode = "row",
  label,
  className,
  onComplete,
}: StatusFlightProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [cycle, setCycle] = useState(0);
  const [active, setActive] = useState(false);
  const prevTrigger = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (trigger && !prevTrigger.current && status !== "pending") {
      setCycle((value) => value + 1);
      setActive(true);
    }
    prevTrigger.current = trigger;
  }, [trigger, status]);

  useEffect(() => {
    if (!active) return undefined;

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setActive(false);
      onCompleteRef.current?.();
    }, OVERLAY_DURATION_MS);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [active, cycle]);

  if (!active || status === "pending") return null;

  const overlayClass =
    mode === "screen"
      ? "pointer-events-none fixed inset-0 z-50 overflow-hidden"
      : "pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-hidden";

  return (
    <div className={cn(overlayClass, className)} aria-hidden={label ? undefined : true}>
      <RowOverlay status={status} cycle={cycle} reducedMotion={reducedMotion} />
    </div>
  );
}

export function SettlementRowFlightOverlay({ status }: { status: StatusFlightStatus }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <td
      colSpan={5}
      className="!absolute !inset-0 !z-[5] !m-0 !block !h-full !w-full !max-w-none !border-0 !bg-transparent !p-0 pointer-events-none"
      aria-hidden
    >
      <StatusFlight mode="row" status={status} trigger onComplete={() => setVisible(false)} />
    </td>
  );
}
