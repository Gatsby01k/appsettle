import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { updateSettings } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { canManageSettings } from "@/lib/permissions";
import { PageHeader } from "@/components/ops/page-header";
import { FlashMessage } from "@/components/ops/flash-message";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, HelperText } from "@/components/ui/helper-text";
import { SubmitButton } from "@/components/ui/submit-button";
import { Separator } from "@/components/ui/separator";

type ChipState = "Active" | "Configured" | "Not connected";

function StatusChip({ state }: { state: ChipState }) {
  const tone = state === "Active" ? "success" : state === "Configured" ? "info" : "neutral";
  return <Badge tone={tone}>{state}</Badge>;
}

function SectionTitle({ title, chip }: { title: string; chip: ChipState }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <CardTitle>{title}</CardTitle>
      <StatusChip state={chip} />
    </div>
  );
}

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

  const reconChip: ChipState = settings?.reconciliationEmail ? "Configured" : "Not connected";
  const webhookChip: ChipState = settings?.webhookUrl ? "Active" : "Not connected";

  return (
    <div className="space-y-6">
      <PageHeader title="Organization controls" description="Treasury policy, approval rules, integrations and audit retention for your organization." />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "saved" ? <FlashMessage message="Settings saved." /> : null}
      {disabled ? <FlashMessage message="Your role can view settings but cannot update them." tone="error" /> : null}

      <form action={saveSettings} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionTitle title="General" chip="Active" />
            <CardDescription>Workspace identity and legal entity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Display name" htmlFor="displayName" required>
              <Input id="displayName" name="displayName" defaultValue={organization.displayName} disabled={disabled} required />
            </Field>
            <Field label="Legal entity" hint="Managed by INRSettle — contact support to change.">
              <Input value={organization.legalName} disabled readOnly />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Treasury controls" chip="Active" />
            <CardDescription>Quote execution parameters and rate validity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Quote TTL (seconds)" htmlFor="quoteTtlSeconds" hint="How long a generated quote stays executable." required>
              <Input
                id="quoteTtlSeconds"
                name="quoteTtlSeconds"
                type="number"
                defaultValue={settings?.quoteTtlSeconds ?? 900}
                disabled={disabled}
                required
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Approval rules" chip="Active" />
            <CardDescription>Maker-checker threshold for settlements.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Approval threshold (INR)" htmlFor="approvalThreshold" hint="Settlements above this notional require an approver." required>
              <Input
                id="approvalThreshold"
                name="approvalThreshold"
                type="number"
                step="0.01"
                defaultValue={String(settings?.approvalThreshold ?? 2500000)}
                disabled={disabled}
                required
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Reconciliation rules" chip={reconChip} />
            <CardDescription>Exception routing and matching notifications.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Reconciliation email" htmlFor="reconciliationEmail" hint="Exceptions and unmatched records are routed here.">
              <Input
                id="reconciliationEmail"
                name="reconciliationEmail"
                type="email"
                placeholder="finance@yourcompany.com"
                defaultValue={settings?.reconciliationEmail ?? ""}
                disabled={disabled}
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle title="Webhook delivery" chip={webhookChip} />
            <CardDescription>Outbound event delivery to your systems.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input id="webhookUrl" name="webhookUrl" type="url" placeholder="https://api.yourcompany.com/webhooks/inrsettle" defaultValue={settings?.webhookUrl ?? ""} disabled={disabled} />
              <HelperText>
                Receives <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">settlement.*</code> and{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">reconciliation.*</code> events.
              </HelperText>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle title="Audit & retention" chip="Active" />
            <CardDescription>Immutable evidence is retained automatically for every operational change.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              View the full immutable trail in{" "}
              <a href="/audit-logs" className="font-semibold text-brand-emerald-ink hover:underline">
                Audit logs
              </a>{" "}
              or export an audit evidence package from{" "}
              <a href="/reports" className="font-semibold text-brand-emerald-ink hover:underline">
                Reports
              </a>
              .
            </p>
            <Separator className="my-4" />
            <SubmitButton type="submit" variant="primary" disabled={disabled} pendingText="Saving...">
              Save changes
            </SubmitButton>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
