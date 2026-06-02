import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { updateSettings } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { canManageSettings } from "@/lib/permissions";
import { PageHeader } from "@/components/ops/page-header";
import { FlashMessage } from "@/components/ops/flash-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Separator } from "@/components/ui/separator";

async function saveSettings(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canManageSettings(membership.role)) redirect("/settings");
  try {
    await updateSettings(
      {
        displayName: String(formData.get("displayName") ?? ""),
        approvalThreshold: formData.get("approvalThreshold"),
        quoteTtlSeconds: formData.get("quoteTtlSeconds"),
        reconciliationEmail: String(formData.get("reconciliationEmail") ?? ""),
        webhookUrl: String(formData.get("webhookUrl") ?? ""),
      },
      user.id,
      organization.id,
    );
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/settings?success=saved");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const settings = organization.settings;
  const disabled = !canManageSettings(membership.role);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organization controls for treasury operations, approvals, and integrations." />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "saved" ? <FlashMessage message="Settings saved." /> : null}
      {disabled ? <FlashMessage message="Your role can view settings but cannot update them." tone="error" /> : null}

      <form action={saveSettings} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Workspace identity</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" defaultValue={organization.displayName} disabled={disabled} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Treasury</CardTitle>
            <CardDescription>Quote execution parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="quoteTtlSeconds">Quote TTL (seconds)</Label>
              <Input
                id="quoteTtlSeconds"
                name="quoteTtlSeconds"
                type="number"
                defaultValue={settings?.quoteTtlSeconds ?? 900}
                disabled={disabled}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>Maker-checker threshold</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="approvalThreshold">Approval threshold</Label>
              <Input
                id="approvalThreshold"
                name="approvalThreshold"
                type="number"
                step="0.01"
                defaultValue={String(settings?.approvalThreshold ?? 2500000)}
                disabled={disabled}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reconciliation</CardTitle>
            <CardDescription>Exception routing</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reconciliationEmail">Reconciliation email</Label>
              <Input
                id="reconciliationEmail"
                name="reconciliationEmail"
                type="email"
                defaultValue={settings?.reconciliationEmail ?? ""}
                disabled={disabled}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Outbound event delivery</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:max-w-xl">
            <div className="grid gap-1.5">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input id="webhookUrl" name="webhookUrl" type="url" defaultValue={settings?.webhookUrl ?? ""} disabled={disabled} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Audit</CardTitle>
            <CardDescription>Evidence retention is automatic for all operational changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              View the full immutable trail in{" "}
              <a href="/audit-logs" className="font-medium text-emerald-700 hover:underline">
                Audit logs
              </a>
              .
            </p>
            <Separator className="my-4" />
            <SubmitButton type="submit" variant="primary" disabled={disabled} pendingText="Saving...">
              Save settings
            </SubmitButton>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
