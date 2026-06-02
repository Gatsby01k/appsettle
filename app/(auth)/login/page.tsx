import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createSession, getSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true }, take: 1 } },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash)) || !user.memberships[0]) {
    redirect("/login?error=invalid");
  }

  const membership = user.memberships[0];
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, membership.organizationId);
  await writeAuditLog({
    action: "auth.login",
    resourceType: "user",
    resourceId: user.id,
    organizationId: membership.organizationId,
    userId: user.id,
  });
  redirect("/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — the bridge from the marketing site */}
      <section className="relative hidden overflow-hidden bg-[#07132b] text-white lg:flex lg:flex-col lg:justify-between">
        <div className="brand-glow pointer-events-none absolute inset-0" />
        <div className="relative flex items-center gap-3 px-12 pt-12">
          <Image src="/assets/mark.png" alt="" width={40} height={40} className="rounded-xl" />
          <span className="text-lg font-semibold tracking-tight">INRSettle</span>
        </div>
        <div className="relative space-y-6 px-12">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-[#42d5b7]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected treasury environment
          </p>
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            The operations console behind <span className="brand-gradient-text">INR ↔ stablecoin</span> settlement rails.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Quote, settle, reconcile and audit cross-border liquidity in one institutional workspace. Access is
            restricted to authorized treasury and settlement operators.
          </p>
        </div>
        <div className="relative flex items-center gap-6 px-12 pb-12 text-xs text-white/55">
          <span>SOC 2 aligned controls</span>
          <span>Immutable audit trail</span>
          <span>Role-based access</span>
        </div>
      </section>

      {/* Access form */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to inrsettle.com
          </Link>

          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/assets/mark.png" alt="INRSettle" width={40} height={40} className="rounded-xl" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">INRSettle</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in to the console</h2>
          <p className="mt-1.5 text-sm text-slate-500">Manage settlement operations for your organization.</p>

          {params.error ? (
            <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              Invalid email or password.
            </div>
          ) : null}

          <form action={login} className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" size="lg" variant="primary" className="mt-1">
              Sign in to console
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Demo access</span> · ops@inrsettle.com · ChangeMe123!
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-400">
            This is a restricted environment. Activity is logged for compliance and audit purposes.
          </p>
        </div>
      </section>
    </main>
  );
}
