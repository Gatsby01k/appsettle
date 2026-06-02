import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createQuote } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { EmptyState } from "@/components/ops/empty-state";
import { FlashMessage } from "@/components/ops/flash-message";
import { TabLinks } from "@/components/ops/tab-links";
import { FilterBar } from "@/components/ops/filter-bar";
import { FormSelect } from "@/components/ops/form-select";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function submitQuote(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  try {
    await createQuote(
      {
        corridor: String(formData.get("corridor") ?? ""),
        sourceAmount: formData.get("sourceAmount"),
        settlementWindow: String(formData.get("settlementWindow") ?? ""),
      },
      user.id,
      organization.id,
    );
  } catch (error) {
    redirect(`/quotes?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/quotes?success=created&tab=active");
}

function quoteTab(quote: { status: string; expiresAt: Date }, tab: string) {
  const expired = quote.status === "EXPIRED" || (quote.status === "ACTIVE" && quote.expiresAt < new Date());
  if (tab === "active") return quote.status === "ACTIVE" && !expired;
  if (tab === "accepted") return quote.status === "ACCEPTED";
  if (tab === "expired") return expired || quote.status === "EXPIRED";
  return true;
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string; tab?: string }>;
}) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const tab = params.tab ?? "active";
  const quotes = await prisma.quote.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const query = params.q?.toLowerCase().trim() ?? "";
  const filtered = quotes.filter((quote) => quoteTab(quote, tab)).filter((quote) => {
    if (!query) return true;
    return quote.corridor.toLowerCase().includes(query) || quote.id.toLowerCase().includes(query);
  });

  const activeCount = quotes.filter((q) => quoteTab(q, "active")).length;
  const acceptedCount = quotes.filter((q) => quoteTab(q, "accepted")).length;
  const expiredCount = quotes.filter((q) => quoteTab(q, "expired")).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description="Create corridor quotes and manage active, accepted, and expired inventory." />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? <FlashMessage message="Quote created. Use it from Settlements while ACTIVE." /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Active" value={activeCount} hint="Available for settlement" tone="success" />
        <MetricCard label="Accepted" value={acceptedCount} hint="Consumed by settlements" />
        <MetricCard label="Expired" value={expiredCount} hint="Needs refresh" tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New quote</CardTitle>
            <CardDescription>Generate an executable corridor quote.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitQuote} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Corridor</Label>
                <FormSelect
                  name="corridor"
                  defaultValue="INR_USDT"
                  options={[
                    { value: "INR_USDT", label: "INR → USDT" },
                    { value: "USDT_INR", label: "USDT → INR" },
                  ]}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sourceAmount">Source amount</Label>
                <Input id="sourceAmount" name="sourceAmount" type="number" min="1" step="0.01" required />
              </div>
              <div className="grid gap-1.5">
                <Label>Settlement window</Label>
                <FormSelect
                  name="settlementWindow"
                  defaultValue="instant"
                  options={[
                    { value: "instant", label: "Instant" },
                    { value: "same_day", label: "Same day" },
                    { value: "next_day", label: "Next day" },
                  ]}
                />
              </div>
              <SubmitButton type="submit" variant="primary" pendingText="Generating...">
                Generate quote
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabLinks
              basePath="/quotes"
              active={tab}
              preserve={params.q ? { q: params.q } : undefined}
              tabs={[
                { id: "active", label: "Active", count: activeCount },
                { id: "accepted", label: "Accepted", count: acceptedCount },
                { id: "expired", label: "Expired", count: expiredCount },
              ]}
            />
            <Suspense fallback={null}>
              <FilterBar searchPlaceholder="Search corridor or ID..." />
            </Suspense>
          </div>

          {filtered.length ? (
            <DataGrid>
              <table className="w-full min-w-[640px]">
                <DataGridHead>
                  <DataGridTh>Corridor</DataGridTh>
                  <DataGridTh>Source</DataGridTh>
                  <DataGridTh>Target</DataGridTh>
                  <DataGridTh>Status</DataGridTh>
                  <DataGridTh>Expires</DataGridTh>
                </DataGridHead>
                <DataGridBody>
                  {filtered.map((quote) => (
                    <DataGridRow key={quote.id}>
                      <DataGridTd className="font-medium">{quote.corridor.replace("_", " → ")}</DataGridTd>
                      <DataGridTd className="tabular-nums">
                        {formatCurrency(String(quote.sourceAmount), quote.sourceCurrency)}
                      </DataGridTd>
                      <DataGridTd className="tabular-nums">
                        {formatCurrency(String(quote.targetAmount), quote.targetCurrency)}
                      </DataGridTd>
                      <DataGridTd>
                        <StatusBadge status={quote.status} />
                      </DataGridTd>
                      <DataGridTd className="text-xs text-slate-500">{quote.expiresAt.toLocaleString()}</DataGridTd>
                    </DataGridRow>
                  ))}
                </DataGridBody>
              </table>
            </DataGrid>
          ) : (
            <EmptyState
              title={`No ${tab} quotes`}
              description={
                tab === "active" ? "Generate a quote to start settlement creation." : "Nothing in this tab matches your search."
              }
              action={tab === "active" ? undefined : { label: "View active", href: "/quotes?tab=active" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
