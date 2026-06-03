import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createQuote, createSettlement } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { defaultAccountsForCorridor } from "@/lib/treasury";
import { prisma } from "@/lib/prisma";
import { displayQuoteStatus } from "@/lib/quotes";
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

async function acceptQuote(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  const quoteId = String(formData.get("quoteId") ?? "");
  const corridor = String(formData.get("corridor") ?? "INR_USDT") as "INR_USDT" | "USDT_INR";
  const accounts = defaultAccountsForCorridor(corridor);
  try {
    await createSettlement(
      {
        quoteId,
        reference: `auto_${quoteId.slice(-6)}_${Date.now().toString(36)}`,
        sourceAccount: accounts.sourceAccount,
        targetAccount: accounts.targetAccount,
      },
      user.id,
      organization.id,
    );
  } catch (error) {
    redirect(`/quotes?error=${encodeURIComponent(friendlyErrorMessage(error))}&tab=active`);
  }
  redirect("/settlements?success=created");
}

async function refreshQuote(formData: FormData) {
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
    redirect(`/quotes?error=${encodeURIComponent(friendlyErrorMessage(error))}&tab=expired`);
  }
  redirect("/quotes?success=refreshed&tab=active");
}

// Bucket a quote by its *displayed* status so a time-expired ACTIVE quote is
// treated as EXPIRED everywhere (tabs, counts, badges), never as ACTIVE.
function quoteTab(quote: { status: string; expiresAt: Date }, tab: string) {
  const status = displayQuoteStatus(quote);
  if (tab === "active") return status === "ACTIVE";
  if (tab === "accepted") return status === "ACCEPTED";
  if (tab === "expired") return status === "EXPIRED";
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
      {params.success === "refreshed" ? (
        <FlashMessage message="Replacement quote generated — it is ACTIVE and ready for settlement." />
      ) : null}

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
                  <DataGridTh className="text-right">Action</DataGridTh>
                </DataGridHead>
                <DataGridBody>
                  {filtered.map((quote) => {
                    const displayStatus = displayQuoteStatus(quote);
                    const isActive = displayStatus === "ACTIVE";
                    const isExpired = displayStatus === "EXPIRED";
                    return (
                      <DataGridRow key={quote.id}>
                        <DataGridTd className="font-medium">{quote.corridor.replace("_", " → ")}</DataGridTd>
                        <DataGridTd className="tabular-nums">
                          {formatCurrency(String(quote.sourceAmount), quote.sourceCurrency)}
                        </DataGridTd>
                        <DataGridTd className="tabular-nums">
                          {formatCurrency(String(quote.targetAmount), quote.targetCurrency)}
                        </DataGridTd>
                        <DataGridTd>
                          <StatusBadge status={displayStatus} />
                        </DataGridTd>
                        <DataGridTd className="text-xs text-slate-500">{quote.expiresAt.toLocaleString()}</DataGridTd>
                        <DataGridTd className="text-right">
                          {isActive ? (
                            <form action={acceptQuote} className="flex justify-end">
                              <input type="hidden" name="quoteId" value={quote.id} />
                              <input type="hidden" name="corridor" value={quote.corridor} />
                              <SubmitButton variant="primary" size="sm" pendingText="...">
                                Create settlement
                              </SubmitButton>
                            </form>
                          ) : isExpired ? (
                            <form action={refreshQuote} className="flex flex-col items-end gap-1">
                              <input type="hidden" name="corridor" value={quote.corridor} />
                              <input type="hidden" name="sourceAmount" value={String(quote.sourceAmount)} />
                              <input type="hidden" name="settlementWindow" value={quote.settlementWindow} />
                              <SubmitButton variant="outline" size="sm" pendingText="Refreshing...">
                                Refresh quote
                              </SubmitButton>
                              <span className="text-[11px] text-slate-400">Generate a new quote to continue.</span>
                            </form>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </DataGridTd>
                      </DataGridRow>
                    );
                  })}
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
