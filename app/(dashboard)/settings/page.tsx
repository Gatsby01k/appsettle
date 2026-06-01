import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { updateSettings } from "@/lib/domain";
import { canManageSettings } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function saveSettings(formData: FormData) {
  "use server";
  const { user, organization, membership } = await requireSession();
  if (!canManageSettings(membership.role)) redirect("/settings");
  await updateSettings({
    displayName: formData.get("displayName"),
    approvalThreshold: formData.get("approvalThreshold"),
    quoteTtlSeconds: formData.get("quoteTtlSeconds"),
    reconciliationEmail: formData.get("reconciliationEmail"),
    webhookUrl: formData.get("webhookUrl"),
  }, user.id, organization.id);
  redirect("/settings");
}

export default async function SettingsPage() {
  const { organization, membership } = await requireSession();
  const settings = organization.settings;
  const disabled = !canManageSettings(membership.role);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Settings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Organization controls</h1>
      </div>
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
            <Button type="submit" disabled={disabled}>Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
