"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  description,
  eyebrow,
  footer,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  eyebrow?: string;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ops-animate-overlay fixed inset-0 z-50 bg-[rgba(7,17,31,0.46)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "ops-animate-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-[var(--ops-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.92))] shadow-[var(--ops-shadow-lg)] outline-none sm:inset-y-2 sm:right-2 sm:rounded-2xl sm:border",
          className,
        )}
        {...props}
      >
        <span className="pointer-events-none absolute inset-x-5 top-0 h-[2px] rounded-full bg-[linear-gradient(90deg,transparent,rgba(0,199,157,0.8),rgba(242,173,35,0.55),transparent)]" />
        <div className="flex items-start justify-between gap-3 border-b border-[var(--ops-line-soft)] px-5 py-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-emerald-ink">
                {eyebrow}
              </p>
            ) : null}
            <DialogPrimitive.Title className="truncate text-[15px] font-semibold tracking-tight text-slate-950">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 truncate text-[13px] text-slate-500">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title} details</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="ops-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--ops-line-soft)] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
