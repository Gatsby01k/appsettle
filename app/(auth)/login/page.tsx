import Image from "next/image";
import { redirect } from "next/navigation";
import { createSession, getSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <Image src="/assets/mark.png" alt="INRSettle" width={44} height={44} className="rounded-xl" />
            <div>
              <CardTitle>INRSettle Console</CardTitle>
              <CardDescription>Sign in to manage settlement operations.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {params.error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Invalid email or password.
            </div>
          ) : null}
          <form action={login} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" size="lg">
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Seed login: ops@inrsettle.com / ChangeMe123!
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
