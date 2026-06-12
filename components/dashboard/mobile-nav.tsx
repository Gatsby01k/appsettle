"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "@/components/dashboard/sidebar-nav";

export function MobileNav({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-ops-xs transition-colors hover:border-slate-300 hover:text-slate-900 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-[18px] w-[18px]" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ops-animate-overlay fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm lg:hidden" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 w-[270px] outline-none lg:hidden"
          aria-label="Navigation"
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">Primary navigation menu</Dialog.Description>
          <div className="ops-animate-sheet h-full">
            <SidebarContent organizationName={organizationName} onNavigate={() => setOpen(false)} />
          </div>
          <Dialog.Close
            className="absolute right-3 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
