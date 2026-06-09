import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createQuote, createSettlement } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { defaultAccountsForCorridor } from "@/lib/treasury";
import { prisma } from "@/lib/prisma";
import { displayQuoteStatus } from "@/lib/quotes";
import { cn, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
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
  return "Refresh to regain execution";
}

function formatQuoteRate(rate: string | number, corridor: string) {
  const trimmed = Number(rate)
    .toFixed(4)
    .replace(/\.?0+$/, "");
  return corridor === "USDT_INR" ? `${trimmed} INR/USDT` : `${trimmed} USDT/INR`;
}

function settlementWindowLabel(window: string) {
  if (window === "instant") return "Instant";
  if (window === "same_day") return "Same day";
  if (window === "next_day") return "Next day";
  return window;
}

function formatExpiryCountdown(expiresAt: Date) {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 60) {
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hr}h ${remMin}m left`;
  }
  return min > 0 ? `${min}m ${sec}s left` : `${sec}s left`;
}

const EXECUTION_PATH = [
  "Quote",
  "Lock terms",
  "Create settlement",
  "Execute payout",
  "Reconcile",
] as const;

function ExecutionPathStrip({ activeStep }: { activeStep: number }) {
  return (
    <ol className="quote-execution-path flex flex-wrap items-center gap-1">
      {EXECUTION_PATH.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;

        return (
          <li key={step} className="flex items-center gap-1">
            <span
              className={cn(
                "quote-execution-step rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-all duration-300",
                isActive && "quote-execution-step-active bg-brand-emerald/[0.14] text-brand-emerald-ink ring-1 ring-brand-emerald/20",
                isDone && "quote-execution-step-done bg-brand-emerald/[0.08] text-brand-emerald-ink/80",
                !isActive && !isDone && "border border-[var(--ops-line)] bg-white text-slate-400",
              )}
            >
              {step}
            </span>
            {index < EXECUTION_PATH.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "quote-execution-connector text-[10px] transition-colors duration-300",
                  index < activeStep ? "quote-execution-connector-done text-brand-emerald/55" : "text-slate-300",
                )}
              >
                →
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

type PreviewQuote = {
  corridor: string;
  sourceAmount: unknown;
  sourceCurrency: string;
  targetAmount: unknown;
  targetCurrency: string;
  rate: unknown;
  feeAmount: unknown;
  expiresAt: Date;
  settlementWindow: string;
};

function QuotePreviewPanel({ quote }: { quote?: PreviewQuote | null }) {
  const isLocked = Boolean(quote);
  const rows = quote
    ? [
        { label: "Corridor", value: corridorLabel(quote.corridor) },
        {
          label: "Source amount",
          value: formatCurrencyFull(String(quote.sourceAmount), quote.sourceCurrency),
        },
        {
          label: "Destination amount",
          value: formatCurrencyFull(String(quote.targetAmount), quote.targetCurrency),
        },
        { label: "Rate", value: formatQuoteRate(String(quote.rate), quote.corridor) },
        { label: "Fee", value: formatCurrencyFull(String(quote.feeAmount), quote.sourceCurrency) },
        { label: "Valid until", value: formatDateTime(quote.expiresAt) },
        { label: "Settlement window", value: settlementWindowLabel(quote.settlementWindow) },
      ]
    : [
        { label: "Corridor", value: "USDT → INR", estimated: true },
        { label: "Source amount", value: "—", estimated: true },
        { label: "Indicative payout", value: "—", estimated: true },
        { label: "Rate", value: "—", estimated: true },
        { label: "Fee", value: "—", estimated: true },
        { label: "Validity", value: "15 min", estimated: true },
      ];

  return (
    <div
      className={cn(
        "quote-preview-panel flex flex-col border-t border-[var(--ops-line-soft)] bg-gradient-to-b from-[#f4fbf8]/80 to-slate-50/40 p-3 lg:border-l lg:border-t-0",
        isLocked && "quote-preview-panel-locked",
      )}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {isLocked ? "Locked quote terms" : "Estimated preview"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {isLocked ? "Executable terms ready for settlement" : "Final terms lock after generation"}
          </p>
        </div>
        {isLocked ? (
          <span className="quote-preview-locked shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
            Locked
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--ops-line)] bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Indicative
          </span>
        )}
      </div>

      <div
        className={cn(
          "quote-preview-surface ops-grid-faint rounded-xl border bg-white/90 p-3 transition-colors",
          isLocked
            ? "border-brand-emerald/25 shadow-[inset_0_0_0_1px_rgba(0,199,157,0.08)]"
            : "border-[var(--ops-line-soft)]",
        )}
      >
        <dl className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
              <dt className="text-slate-500">{row.label}</dt>
              <dd
                className={cn(
                  "font-medium tabular-nums text-right",
                  "estimated" in row && row.estimated ? "text-slate-400" : "text-slate-800",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-2.5 rounded-lg border border-[var(--ops-line-soft)] bg-white/60 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">Settlement path</p>
        <p className="mt-0.5 text-[11px] font-medium text-slate-600">
          Quote → Settlement → Execute → Reconcile
        </p>
      </div>
    </div>
  );
}

function CompactQuoteMetrics({
  active,
  accepted,
  expired,
}: {
  active: number;
  accepted: number;
  expired: number;
}) {
  const items = [
    { label: "Active", value: active, tone: "success" as const },
    { label: "Accepted", value: accepted, tone: "info" as const },
    { label: "Expired", value: expired, tone: "warning" as const },
  ];

  return (
    <div className="quote-metrics-compact flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-[var(--ops-line-soft)] bg-white/70 px-3 py-2">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-2">
          {index > 0 ? <span aria-hidden="true" className="hidden h-3 w-px bg-[var(--ops-line)] sm:block" /> : null}
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-slate-400">{item.label}</span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums leading-none",
              item.tone === "success" && "text-brand-emerald-ink",
              item.tone === "info" && "text-[#0a7d86]",
              item.tone === "warning" && "text-[#9b6810]",
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
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
  const previewQuote =
    newestQuoteId != null ? (filtered.find((q) => q.id === newestQuoteId) ?? quotes.find((q) => q.id === newestQuoteId)) : null;
  const previewStep = previewQuote ? 1 : 0;

  const emptyTitle =
    tab === "active" ? "No executable quotes" : query ? "No quotes match your search" : `No ${tab} quotes`;
  const emptyDescription =
    tab === "active"
      ? "Generate a quote to lock corridor, amount and settlement window before settlement creation."
      : query
        ? "Try a different corridor or quote ID."
        : tab === "accepted"
          ? "Accepted quotes have already been used to create settlements."
          : "Expired quotes can be refreshed to generate a new executable quote.";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotes"
        description="Lock executable terms before settlement creation."
        className="gap-2"
      />

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? (
        <FlashMessage message="Executable quote generated — it is ACTIVE and ready for settlement creation." />
      ) : null}
      {params.success === "refreshed" ? (
        <FlashMessage message="Replacement quote generated — it is ACTIVE and ready for settlement." />
      ) : null}

      <CompactQuoteMetrics active={activeCount} accepted={acceptedCount} expired={expiredCount} />

      <div id="quote-ticket" className="quote-ticket ops-panel ops-panel-accent scroll-mt-4 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[var(--ops-line-soft)] px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quote ticket</p>
            <p className="truncate text-xs text-slate-500">
              Configure execution input · promote to{" "}
              <Link href="/settlements" className="font-medium text-brand-emerald-ink hover:underline">
                Settlements
              </Link>{" "}
              when terms are locked
            </p>
          </div>
          <ExecutionPathStrip activeStep={previewStep} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="quote-ticket-form p-3">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-emerald/15 bg-brand-emerald/[0.06] px-2.5 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">Corridor</span>
              <span className="text-sm font-semibold text-brand-emerald-ink">USDT → INR</span>
              <span className="ml-auto text-[10px] text-slate-400">Primary execution lane</span>
            </div>

            <form action={submitQuote} className="quote-generate-form grid gap-2.5 sm:grid-cols-2">
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
                  pendingText="Locking quote..."
                  className="quote-ticket-cta w-full sm:w-auto"
                >
                  Generate executable quote
                </SubmitButton>
              </div>
            </form>
          </div>

          <QuotePreviewPanel quote={previewQuote} />
        </div>
      </div>

      <div className="ops-panel overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[var(--ops-line-soft)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quote inventory</p>
            <p className="truncate text-xs text-slate-400">Executable tickets ready for settlement creation</p>
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
            <table className="w-full min-w-[760px]">
              <DataGridHead>
                <DataGridTh>Quote ticket</DataGridTh>
                <DataGridTh>Execution terms</DataGridTh>
                <DataGridTh>Status</DataGridTh>
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
                  const expiryCountdown = isActive ? formatExpiryCountdown(quote.expiresAt) : null;

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
                        {isActive ? (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold text-slate-950">Executable quote locked</p>
                              <span className="quote-badge-locked quote-badge-live">LOCKED</span>
                            </div>
                            <p className="mt-0.5 text-[11px] font-medium text-brand-emerald-ink">
                              {quoteStatusSubtext(displayStatus)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {publicId} · {corridorLabel(quote.corridor)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-950">{publicId}</p>
                            <p className="mt-0.5 text-xs font-medium text-slate-700">{corridorLabel(quote.corridor)}</p>
                            <p className="text-[11px] text-slate-400">{settlementWindowLabel(quote.settlementWindow)}</p>
                            <p
                              className={cn(
                                "mt-1.5 text-[11px] font-medium",
                                isAccepted && "text-slate-500",
                                isExpired && "text-amber-700/80",
                              )}
                            >
                              {quoteStatusSubtext(displayStatus)}
                            </p>
                            {isAccepted && linkedSettlement ? (
                              <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                                <span className="quote-chain-node">Consumed</span>
                                <span className="quote-chain-link" aria-hidden="true">
                                  →
                                </span>
                                <span className="quote-chain-node-settlement font-medium">{linkedSettlement.publicId}</span>
                              </p>
                            ) : null}
                          </>
                        )}
                      </DataGridTd>
                      <DataGridTd>
                        <dl className="space-y-1 text-[11px]">
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-slate-400">Source</dt>
                            <dd className="text-sm font-semibold tabular-nums text-slate-900">
                              {formatCurrencyFull(String(quote.sourceAmount), quote.sourceCurrency)}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-slate-400">Destination</dt>
                            <dd className="text-sm font-semibold tabular-nums text-slate-900">
                              {formatCurrencyFull(String(quote.targetAmount), quote.targetCurrency)}
                            </dd>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 text-slate-500">
                            <span>
                              Rate{" "}
                              <span className="font-medium tabular-nums text-slate-700">
                                {formatQuoteRate(String(quote.rate), quote.corridor)}
                              </span>
                            </span>
                            <span>
                              Fee{" "}
                              <span className="font-medium tabular-nums text-slate-700">
                                {formatCurrencyFull(String(quote.feeAmount), quote.sourceCurrency)}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-3 text-slate-500">
                            <dt>Valid until</dt>
                            <dd className="text-right">
                              <span className="font-medium tabular-nums text-slate-600">
                                {formatDateTime(quote.expiresAt)}
                              </span>
                              {expiryCountdown ? (
                                <span className="quote-expiry-countdown ml-1.5 font-semibold tabular-nums text-brand-emerald-ink">
                                  · {expiryCountdown}
                                </span>
                              ) : null}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3 text-slate-500">
                            <dt>Settlement window</dt>
                            <dd className="font-medium text-slate-700">{settlementWindowLabel(quote.settlementWindow)}</dd>
                          </div>
                        </dl>
                      </DataGridTd>
                      <DataGridTd>
                        {isExpired ? (
                          <span className="quote-badge-expired">EXPIRED</span>
                        ) : isAccepted ? (
                          <span className="quote-badge-accepted">ACCEPTED</span>
                        ) : isActive ? (
                          <span className="quote-badge-locked quote-badge-live">LOCKED</span>
                        ) : (
                          <StatusBadge status={displayStatus} />
                        )}
                      </DataGridTd>
                      <DataGridTd>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {isActive ? (
                            <div className="quote-active-actions flex w-full min-w-[168px] flex-col items-end gap-1">
                              <form action={acceptQuote} className="w-full">
                                <input type="hidden" name="quoteId" value={quote.id} />
                                <input type="hidden" name="corridor" value={quote.corridor} />
                                <SubmitButton
                                  variant="primary"
                                  size="sm"
                                  pendingText="Creating..."
                                  className="quote-cta-primary w-full"
                                >
                                  Create settlement
                                </SubmitButton>
                              </form>
                              <p className="quote-cta-hint max-w-[196px] text-right text-[10px] leading-snug text-slate-400">
                                Promotes this quote into the settlement lifecycle.
                              </p>
                              <div className="quote-cta-secondary-row mt-0.5 flex flex-wrap items-center justify-end gap-1">
                                <form action={refreshQuote}>
                                  <input type="hidden" name="corridor" value={quote.corridor} />
                                  <input type="hidden" name="sourceAmount" value={String(quote.sourceAmount)} />
                                  <input type="hidden" name="settlementWindow" value={quote.settlementWindow} />
                                  <SubmitButton
                                    variant="outline"
                                    size="sm"
                                    pendingText="Refreshing..."
                                    className="quote-refresh-cta quote-cta-secondary h-7 px-2 text-[11px]"
                                  >
                                    Refresh rate
                                  </SubmitButton>
                                </form>
                                <details className="quote-details">
                                  <summary className="inline-flex h-7 cursor-pointer list-none items-center rounded-lg border border-slate-200/80 bg-white/80 px-2 text-[11px] font-medium text-slate-500 shadow-none transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700">
                                    Details
                                  </summary>
                                  <div className="quote-details-panel mt-1.5 w-52 rounded-lg border border-[var(--ops-line)] bg-slate-50/80 p-2.5 text-left shadow-ops-xs">
                                    <dl className="space-y-1.5 text-[11px]">
                                      <div className="flex items-center justify-between gap-3">
                                        <dt className="text-slate-400">Quote ID</dt>
                                        <dd className="font-medium text-slate-700">{publicId}</dd>
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
                            </div>
                          ) : null}
                          {isExpired ? (
                            <form action={refreshQuote} className="quote-expired-refresh-form">
                              <input type="hidden" name="corridor" value={quote.corridor} />
                              <input type="hidden" name="sourceAmount" value={String(quote.sourceAmount)} />
                              <input type="hidden" name="settlementWindow" value={quote.settlementWindow} />
                              <SubmitButton
                                variant="primary"
                                size="sm"
                                pendingText="Refreshing..."
                                className="quote-refresh-cta quote-expired-refresh"
                              >
                                Refresh rate
                              </SubmitButton>
                            </form>
                          ) : null}
                          {isAccepted && linkedSettlement ? (
                            <div className="quote-accepted-chain flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400" aria-hidden="true">
                                <span className="quote-chain-node rounded px-1 py-px">Quote</span>
                                <span className="quote-chain-link">→</span>
                                <span className="quote-chain-node quote-chain-node-settlement rounded px-1 py-px">
                                  {linkedSettlement.publicId}
                                </span>
                              </div>
                              <Link
                                href={`/settlements?q=${encodeURIComponent(linkedSettlement.publicId)}`}
                                className="quote-settlement-link inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold text-[#0a7d86]"
                              >
                                Open settlement
                              </Link>
                            </div>
                          ) : null}
                          {!isActive ? (
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
                          ) : null}
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
                ? { label: "Generate quote", href: "#quote-ticket" }
                : { label: tab === "expired" ? "View active" : "View active quotes", href: "/quotes?tab=active" }
            }
          />
        )}
      </div>
    </div>
  );
}
