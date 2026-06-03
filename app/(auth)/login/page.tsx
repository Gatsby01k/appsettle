import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSession, getSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getDemoCredentials } from "@/lib/demo";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthHero } from "@/components/auth/auth-hero";
import { DemoAccessBlock } from "@/components/auth/demo-access-block";
import { LoginForm, type LoginState } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — INRSettle Console",
  description: "Access treasury, settlement, and reconciliation workflows for your organization.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://inrsettle.com/login" },
  icons: { icon: "/assets/favicon.png", apple: "/assets/favicon.png" },
};

async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  "use server";

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true }, take: 1 } },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash)) || !user.memberships[0]) {
    return { error: "Invalid email or password. Please try again." };
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

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const demoCredentials = getDemoCredentials();

  return (
    <AuthLayout hero={<AuthHero />}>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to inrsettle.com
      </Link>

      <div className="mt-8 flex items-center gap-3 lg:hidden">
        <Image
          src="/assets/mark.png"
          alt="INRSettle"
          width={40}
          height={40}
          className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-ops-xs"
        />
        <span className="text-lg font-semibold tracking-tight text-slate-900">INRSettle</span>
      </div>

      <header className="mt-8">
        <h1 className="text-[1.7rem] font-semibold leading-tight tracking-tight text-slate-900">
          Sign in to the console
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
          Access treasury, settlement, and reconciliation workflows for your organization.
        </p>
      </header>

      <div className="mt-7">
        <LoginForm action={login} />
      </div>

      <p className="mt-6 text-[13px] text-slate-500">
        Need access for your team?{" "}
        <Link
          href="/contact?intent=access"
          className="font-semibold text-brand-emerald-ink transition-colors hover:text-brand-emerald"
        >
          Request access
        </Link>
      </p>

      {demoCredentials ? (
        <div className="mt-6">
          <DemoAccessBlock credentials={demoCredentials} />
        </div>
      ) : null}

      <p className="mt-8 border-t border-slate-200/70 pt-5 text-[12px] leading-relaxed text-slate-400">
        Restricted environment. Access is logged for compliance and audit purposes.
      </p>
    </AuthLayout>
  );
}
