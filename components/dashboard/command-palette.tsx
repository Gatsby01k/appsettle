"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/ops";

const actions = [
  { label: "Create quote", href: "/quotes" },
  { label: "Create settlement", href: "/settlements" },
  { label: "Add reconciliation record", href: "/reconciliation" },
  { label: "View audit trail", href: "/audit-logs" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-500 shadow-ops-xs transition-colors hover:border-slate-300 hover:text-slate-700 lg:flex"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span>Search</span>
        <kbd className="ml-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
          ⌘K
        </kbd>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="ops-animate-overlay fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
          <Dialog.Content className="ops-animate-pop fixed left-1/2 top-[12%] z-50 w-[92%] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--ops-line)] bg-white shadow-ops-lg outline-none">
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>
            <Dialog.Description className="sr-only">Search pages and quick actions</Dialog.Description>
            <Command>
              <CommandInput placeholder="Search pages and actions..." />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Navigate">
                  {NAV_ITEMS.map((item) => (
                    <CommandItem key={item.href} onSelect={() => go(item.href)}>
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="Quick actions">
                  {actions.map((item) => (
                    <CommandItem key={item.label} onSelect={() => go(item.href)}>
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
