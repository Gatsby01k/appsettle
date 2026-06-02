import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { updateSettings } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { canManageSettings } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function saveSettings(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canManageSettings(membership.role)) redirect("/settings");
  try {
    await updateSettings({
      displayName: String(formData.get("displayName") ?? ""),
      approvalThreshold: formData.get("approvalThreshold"),
      quoteTtlSeconds: formData.get("quoteTtlSeconds"),
      reconciliationEmail: String(formData.get("reconciliationEmail") ?? ""),
      webhookUrl: String(formData.get("webhookUrl") ?? ""),
    }, user.id, organization.id);
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/settings?success=saved");
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { organization, membership } = await requireSession();
  const params = await searchParams;
  const settings = organization.settings;
  const disabled = !canManageSettings(membership.role);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Settings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Organization controls</h1>
      </div>
      {params.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {params.error}
        </div>
      ) : null}
      {params.success === "saved" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Settings saved.
        </div>
      ) : null}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Operational settings</CardTitle>
          <CardDescription>Configure maker-checker thresholds, quote expiry, webhooks, and reconciliation routing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveSettings} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" defaultValue={organization.displayName} disabled={disabled} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="approvalThreshold">Approval threshold</Label>
              <Input id="approvalThreshold" name="approvalThreshold" type="number" step="0.01" defaultValue={String(settings?.approvalThreshold ?? 2500000)} disabled={disabled} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quoteTtlSeconds">Quote TTL seconds</Label>
              <Input id="quoteTtlSeconds" name="quoteTtlSeconds" type="number" defaultValue={settings?.quoteTtlSeconds ?? 900} disabled={disabled} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reconciliationEmail">Reconciliation email</Label>
              <Input id="reconciliationEmail" name="reconciliationEmail" type="email" defaultValue={settings?.reconciliationEmail ?? ""} disabled={disabled} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input id="webhookUrl" name="webhookUrl" type="url" defaultValue={settings?.webhookUrl ?? ""} disabled={disabled} />
            </div>
            <SubmitButton type="submit" disabled={disabled} pendingText="Saving settings...">Save settings</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
