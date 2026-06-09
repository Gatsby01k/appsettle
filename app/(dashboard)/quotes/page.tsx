import { Suspense } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createQuote, createSettlement } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { defaultAccountsForCorridor } from "@/lib/treasury";
import { prisma } from "@/lib/prisma";
import { displayQuoteStatus } from "@/lib/quotes";
import { cn, formatCurrencyFull, formatDateTime } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/helper-text";
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

function corridorLabel(corridor: string) {
  return corridor.replace("_", " → ");
}

function quotePublicId(id: string) {
  return `QTE-${id.slice(-6).toUpperCase()}`;
}

function quoteStatusSubtext(status: string) {
  if (status === "ACTIVE") return "Available for settlement";
  if (status === "ACCEPTED") return "Consumed by settlement";
  return "Needs refresh";
}

function formatQuoteRate(rate: string | number, corridor: string) {
  const trimmed = Number(rate)
    .toFixed(4)
    .replace(/\.?0+$/, "");
  return corridor === "USDT_INR" ? `${trimmed} INR/USDT` : `${trimmed} USDT/INR`;
}

function quoteLifecycleIndex(status: string, hasSettlement: boolean) {
  if (status === "EXPIRED") return 2;
  if (status === "ACCEPTED") return hasSettlement ? 3 : 2;
  if (status === "ACTIVE") return 1;
  return 0;
}

function QuoteMetadataChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium tabular-nums text-slate-700">{value}</span>
    </span>
  );
}

function QuoteLifecycle({ status, hasSettlement }: { status: string; hasSettlement: boolean }) {
  const isExpired = status === "EXPIRED";
  const steps = isExpired
    ? (["Generated", "Active", "Expired"] as const)
    : (["Generated", "Active", "Accepted", "Settlement"] as const);
  const current = quoteLifecycleIndex(status, hasSettlement);
  const terminalComplete = status === "ACCEPTED" && hasSettlement;

  return (
    <div className="w-full min-w-[168px]">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const done = index < current || (terminalComplete && index === current);
          const active = index === current && !terminalComplete;
          const future = index > current;
          const connectorDone = index < current || (terminalComplete && index === current);
          const connectorActive = index === current && !terminalComplete;

          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold transition-colors",
                    done && "border-[#42d5b7] bg-[#42d5b7] text-[#07132b] settlement-step-complete",
                    active &&
                      "border-[#07132b] bg-[#07132b] text-white ring-2 ring-[#42d5b7]/25 settlement-step-active",
                    future && "border-slate-200 bg-white text-slate-400",
                  )}
                  title={step}
                >
                  {done ? <Check className="h-3 w-3 settlement-step-check" /> : index + 1}
                </div>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-0.5 h-0.5 flex-1 rounded-full transition-colors",
                    connectorDone && "bg-[#42d5b7]",
                    connectorActive && "settlement-connector-active",
                    !connectorDone && !connectorActive && "bg-slate-200",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function settlementWindowLabel(window: string) {
  if (window === "instant") return "Instant";
  if (window === "same_day") return "Same day";
  if (window === "next_day") return "Next day";
  return window;
}

function QuotePreviewPlaceholder() {
  const rows = [
    { label: "Corridor", value: "—" },
    { label: "Source amount", value: "—" },
    { label: "Destination (indicative)", value: "—" },
    { label: "Settlement window", value: "—" },
    { label: "Fee", value: "—" },
    { label: "Valid until", value: "—" },
  ];

  return (
    <div className="quote-preview-panel flex h-full flex-col border-t border-[var(--ops-line-soft)] bg-slate-50/35 p-3 lg:border-l lg:border-t-0">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quote preview</p>
        <p className="mt-0.5 text-xs text-slate-400">Executable terms before you commit</p>
      </div>
      <div className="quote-preview-surface ops-grid-faint flex flex-1 flex-col justify-center rounded-xl border border-dashed border-[var(--ops-line)] bg-white/70 px-4 py-5 text-center transition-colors">
        <p className="text-sm font-medium text-slate-700">Preview appears after quote generation</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Corridor, destination amount, fee, and expiry lock once the quote is created.
        </p>
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="font-medium tabular-nums text-slate-300">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
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
    include: {
      settlements: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, publicId: true },
      },
    },
  });

  const query = params.q?.toLowerCase().trim() ?? "";
  const filtered = quotes.filter((quote) => quoteTab(quote, tab)).filter((quote) => {
    if (!query) return true;
    const publicId = quotePublicId(quote.id).toLowerCase();
    return (
      quote.corridor.toLowerCase().includes(query) ||
      quote.id.toLowerCase().includes(query) ||
      publicId.includes(query)
    );
  });

  const activeCount = quotes.filter((q) => quoteTab(q, "active")).length;
  const acceptedCount = quotes.filter((q) => quoteTab(q, "accepted")).length;
  const expiredCount = quotes.filter((q) => quoteTab(q, "expired")).length;

  const highlightNewQuote = params.success === "created" || params.success === "refreshed";
  const newestQuoteId =
    highlightNewQuote && tab === "active" && filtered.length > 0 ? filtered[0].id : null;

  const emptyTitle =
    tab === "active" ? "No active executable quotes" : query ? "No quotes match your search" : `No ${tab} quotes`;
  const emptyDescription =
    tab === "active"
      ? "Generate a quote to lock a corridor, amount and settlement window. Active quotes can be used to create settlements."
      : query
        ? "Try a different corridor or quote ID."
        : tab === "accepted"
          ? "Accepted quotes have already been used to create settlements."
          : "Expired quotes can be refreshed to generate a new executable quote.";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotes"
        description="Step 1 before settlement — generate executable quotes that lock corridor, amount, and settlement window. Promote active quotes to settlements when ready."
        className="gap-3"
      />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? (
        <FlashMessage message="Executable quote generated — it is ACTIVE and ready for settlement creation." />
      ) : null}
      {params.success === "refreshed" ? (
        <FlashMessage message="Replacement quote generated — it is ACTIVE and ready for settlement." />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Active" value={activeCount} hint="Executable · ready for settlement" tone="success" />
        <MetricCard label="Accepted" value={acceptedCount} hint="Consumed by settlements" tone="info" />
        <MetricCard label="Expired" value={expiredCount} hint="Refresh to regain execution" tone="warning" />
      </div>

      <div className="ops-panel ops-panel-accent overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[var(--ops-line-soft)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quote command center</p>
            <p className="truncate text-xs text-slate-400">
              Lock terms here · promote to{" "}
              <Link href="/settlements" className="font-medium text-brand-emerald-ink hover:underline">
                Settlements
              </Link>{" "}
              when ready
            </p>
          </div>
          <ol className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            <li className="rounded-md bg-brand-emerald/[0.1] px-2 py-0.5 text-brand-emerald-ink">Quote</li>
            <li aria-hidden="true" className="text-slate-300">
              →
            </li>
            <li className="rounded-md border border-[var(--ops-line)] bg-white px-2 py-0.5">Settlement</li>
            <li aria-hidden="true" className="text-slate-300">
              →
            </li>
            <li className="rounded-md border border-[var(--ops-line)] bg-white px-2 py-0.5">Reconcile</li>
          </ol>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="p-3">
            <p className="mb-2.5 text-xs text-slate-500">
              Configure corridor and amount. The generated quote becomes your settlement input.
            </p>
            <form action={submitQuote} className="quote-generate-form grid gap-3 sm:grid-cols-2">
              <Field label="Corridor" hint="Conversion direction.">
                <FormSelect
                  name="corridor"
                  defaultValue="USDT_INR"
                  options={[
                    { value: "USDT_INR", label: "USDT → INR" },
                    { value: "INR_USDT", label: "INR → USDT" },
                  ]}
                />
              </Field>
              <Field label="Source amount" htmlFor="sourceAmount" hint="Amount in source currency." required>
                <Input id="sourceAmount" name="sourceAmount" type="number" min="1" step="0.01" placeholder="10000" required />
              </Field>
              <Field label="Settlement window" hint="Target settlement speed.">
                <FormSelect
                  name="settlementWindow"
                  defaultValue="instant"
                  options={[
                    { value: "instant", label: "Instant" },
                    { value: "same_day", label: "Same day" },
                    { value: "next_day", label: "Next day" },
                  ]}
                />
              </Field>
              <div className="flex items-end sm:col-span-2">
                <SubmitButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  pendingText="Generating quote..."
                  className="w-full sm:w-auto"
                >
                  Generate executable quote
                </SubmitButton>
              </div>
            </form>
          </div>

          <QuotePreviewPlaceholder />
        </div>
      </div>

      <div className="ops-panel overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[var(--ops-line-soft)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quote inventory</p>
            <p className="truncate text-xs text-slate-400">Active quotes feed settlement creation</p>
          </div>
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
        </div>

        <Suspense fallback={null}>
          <FilterBar embedded searchPlaceholder="Search corridor or ID..." />
        </Suspense>

        {filtered.length ? (
          <DataGrid className="rounded-none border-0 shadow-none">
            <table className="w-full min-w-[880px]">
              <DataGridHead>
                <DataGridTh>Quote</DataGridTh>
                <DataGridTh>Execution terms</DataGridTh>
                <DataGridTh>Status</DataGridTh>
                <DataGridTh>Lifecycle</DataGridTh>
                <DataGridTh className="text-right">Actions</DataGridTh>
              </DataGridHead>
              <DataGridBody>
                {filtered.map((quote) => {
                  const displayStatus = displayQuoteStatus(quote);
                  const isActive = displayStatus === "ACTIVE";
                  const isAccepted = displayStatus === "ACCEPTED";
                  const isExpired = displayStatus === "EXPIRED";
                  const linkedSettlement = quote.settlements[0];
                  const publicId = quotePublicId(quote.id);
                  const isNewlyGenerated = quote.id === newestQuoteId;

                  return (
                    <DataGridRow
                      key={quote.id}
                      className={cn(
                        isActive && "quote-row-active",
                        isExpired && "quote-row-expired",
                        isAccepted && "quote-row-accepted",
                        isNewlyGenerated && "quote-row-highlight",
                      )}
                    >
                      <DataGridTd>
                        <p className="font-medium text-slate-950">{publicId}</p>
                        <p className="text-xs text-slate-600">{corridorLabel(quote.corridor)}</p>
                        <p className="text-[11px] text-slate-400">{settlementWindowLabel(quote.settlementWindow)}</p>
                        <p
                          className={cn(
                            "mt-1 text-[11px]",
                            isActive && "text-brand-emerald-ink",
                            isAccepted && "text-slate-500",
                            isExpired && "text-amber-700/80",
                          )}
                        >
                          {quoteStatusSubtext(displayStatus)}
                        </p>
                      </DataGridTd>
                      <DataGridTd>
                        <div className="flex flex-wrap gap-1">
                          <QuoteMetadataChip
                            label="Source"
                            value={formatCurrencyFull(String(quote.sourceAmount), quote.sourceCurrency)}
                          />
                          <QuoteMetadataChip
                            label="Dest"
                            value={formatCurrencyFull(String(quote.targetAmount), quote.targetCurrency)}
                          />
                          <QuoteMetadataChip label="Rate" value={formatQuoteRate(String(quote.rate), quote.corridor)} />
                          <QuoteMetadataChip
                            label="Fee"
                            value={formatCurrencyFull(String(quote.feeAmount), quote.sourceCurrency)}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Valid until{" "}
                          <span className="font-medium tabular-nums text-slate-600">
                            {formatDateTime(quote.expiresAt)}
                          </span>
                        </p>
                      </DataGridTd>
                      <DataGridTd>
                        {isExpired ? (
                          <span className="quote-badge-expired">EXPIRED</span>
                        ) : isAccepted ? (
                          <span className="quote-badge-accepted">ACCEPTED</span>
                        ) : (
                          <StatusBadge status={displayStatus} />
                        )}
                      </DataGridTd>
                      <DataGridTd className="min-w-[168px]">
                        <QuoteLifecycle status={displayStatus} hasSettlement={Boolean(linkedSettlement)} />
                      </DataGridTd>
                      <DataGridTd>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {isActive ? (
                            <>
                              <form action={acceptQuote}>
                                <input type="hidden" name="quoteId" value={quote.id} />
                                <input type="hidden" name="corridor" value={quote.corridor} />
                                <SubmitButton
                                  variant="primary"
                                  size="sm"
                                  pendingText="Creating..."
                                  className="quote-cta-primary"
                                >
                                  Create settlement
                                </SubmitButton>
                              </form>
                              <form action={refreshQuote}>
                                <input type="hidden" name="corridor" value={quote.corridor} />
                                <input type="hidden" name="sourceAmount" value={String(quote.sourceAmount)} />
                                <input type="hidden" name="settlementWindow" value={quote.settlementWindow} />
                                <SubmitButton
                                  variant="outline"
                                  size="sm"
                                  pendingText="Refreshing..."
                                  className="quote-refresh-cta"
                                >
                                  Refresh quote
                                </SubmitButton>
                              </form>
                            </>
                          ) : null}
                          {isAccepted && linkedSettlement ? (
                            <Link
                              href={`/settlements?q=${encodeURIComponent(linkedSettlement.publicId)}`}
                              className="quote-settlement-link inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold text-[#0a7d86]"
                            >
                              Open {linkedSettlement.publicId}
                            </Link>
                          ) : null}
                          {isExpired ? (
                            <form action={refreshQuote}>
                              <input type="hidden" name="corridor" value={quote.corridor} />
                              <input type="hidden" name="sourceAmount" value={String(quote.sourceAmount)} />
                              <input type="hidden" name="settlementWindow" value={quote.settlementWindow} />
                              <SubmitButton
                                variant="outline"
                                size="sm"
                                pendingText="Refreshing..."
                                className="quote-refresh-cta"
                              >
                                Refresh quote
                              </SubmitButton>
                            </form>
                          ) : null}
                          <details className="quote-details">
                            <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-ops-xs transition-colors hover:border-slate-300 hover:bg-slate-50">
                              Details
                            </summary>
                            <div className="quote-details-panel mt-1.5 w-52 rounded-lg border border-[var(--ops-line)] bg-slate-50/80 p-2.5 text-left shadow-ops-xs">
                              <dl className="space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Quote ID</dt>
                                  <dd className="font-medium text-slate-700">{publicId}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Corridor</dt>
                                  <dd className="font-medium text-slate-700">{corridorLabel(quote.corridor)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Source</dt>
                                  <dd className="font-medium tabular-nums text-slate-700">
                                    {formatCurrencyFull(String(quote.sourceAmount), quote.sourceCurrency)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Destination</dt>
                                  <dd className="font-medium tabular-nums text-slate-700">
                                    {formatCurrencyFull(String(quote.targetAmount), quote.targetCurrency)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Rate</dt>
                                  <dd className="font-medium tabular-nums text-slate-700">
                                    {formatQuoteRate(String(quote.rate), quote.corridor)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Fee</dt>
                                  <dd className="font-medium tabular-nums text-slate-700">
                                    {formatCurrencyFull(String(quote.feeAmount), quote.sourceCurrency)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Valid until</dt>
                                  <dd className="font-medium tabular-nums text-slate-700">
                                    {formatDateTime(quote.expiresAt)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-400">Generated</dt>
                                  <dd className="font-medium tabular-nums text-slate-700">
                                    {formatDateTime(quote.createdAt)}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          </details>
                        </div>
                      </DataGridTd>
                    </DataGridRow>
                  );
                })}
              </DataGridBody>
            </table>
          </DataGrid>
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={
              tab === "active"
                ? undefined
                : { label: tab === "expired" ? "View active" : "View active quotes", href: "/quotes?tab=active" }
            }
          />
        )}
      </div>
    </div>
  );
}
