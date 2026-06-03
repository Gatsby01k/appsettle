import * as React from "react";

/**
 * Split-screen authentication shell.
 *
 * - Desktop: brand panel (left) + form column (right).
 * - Tablet / mobile: brand panel collapses; the form column carries a compact
 *   brand + hero treatment so identity is preserved without the side panel.
 */
export function AuthLayout({ hero, children }: { hero: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="app-surface grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {hero}
      <section className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[400px]">{children}</div>
      </section>
    </main>
  );
}
