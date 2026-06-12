import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Settlement Rail Loader — INRSettle's branded loading system.
 *
 * Pattern: Provider Proof → Reconciliation → Finality → Audit/Report,
 * rendered as a thin rail with a travelling teal pulse and four nodes
 * (the last carries the gold/report accent). Pure CSS, server-safe,
 * reduced-motion renders a static rail.
 *
 * USAGE GUIDELINES
 * - `RailLoaderPage`     → route-level `loading.tsx` only (full, centered).
 * - `RailLoaderInline`   → a single card/panel that is loading. Never block
 *                          the whole screen when only a section loads.
 * - `Skeleton*` helpers  → list/table/card placeholders that match the final
 *                          layout, so content swaps in without layout shift.
 * - `RailDots`           → inside pending buttons (see SubmitButton).
 * - Prefer skeletons over loaders for anything with a known shape.
 */

const RAIL_STEPS = ["Proof", "Recon", "Finality", "Audit"] as const;

export function RailLoader({
  label,
  compact = false,
  dark = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("rail-loader", compact && "rail-loader--compact", dark && "rail-loader--dark", className)}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <div className="rail-loader__track" aria-hidden="true">
        {RAIL_STEPS.map((step) => (
          <span key={step} className="rail-loader__node" />
        ))}
      </div>
      <div className="rail-loader__labels" aria-hidden="true">
        {RAIL_STEPS.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
      {label ? <p className="rail-loader__caption">{label}</p> : null}
    </div>
  );
}

/** Full-page loader for route `loading.tsx` files. */
export function RailLoaderPage({ label = "Loading settlement workspace" }: { label?: string }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <RailLoader label={label} />
    </div>
  );
}

/** Compact loader for a single card/panel that is fetching. */
export function RailLoaderInline({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <RailLoader compact label={label} />
    </div>
  );
}

/** Pending-button indicator (three brand pulse dots, inherits text color). */
export function RailDots() {
  return (
    <span className="rail-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/* ----------------------------------------------------------------------
   Skeleton system — placeholders shaped like the real surfaces so loaded
   content swaps in without layout shift.
   ---------------------------------------------------------------------- */

/** Skeleton for a settlement case card (Settlements list). */
export function SkeletonCaseCard() {
  return (
    <div className="ops-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton for a queue/list row (reconciliation queue, audit feed). */
export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
    </div>
  );
}

/** Skeleton panel wrapping a number of rows. */
export function SkeletonListPanel({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ops-panel overflow-hidden">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}
