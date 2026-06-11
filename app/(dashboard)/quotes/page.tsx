import { Suspense } from "react";
import Link from "next/link";
import { FileSearch, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createQuote, createSettlement } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { defaultAccountsForCorridor } from "@/lib/treasury";
import { prisma } from "@/lib/prisma";
import { displayQuoteStatus } from "@/lib/quotes";
import { cn, formatCurrencyFull, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ops/status-badge";
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

function isDemoQuote(quote: {
  corridor: string;
  status: string;
  sourceAmount: unknown;
  settlements: { publicId: string }[];
}) {
  if (quote.settlements.some((s) => s.publicId.startsWith("SET-DEMO"))) return true;
  if (
    quote.status === "ACTIVE" &&
    quote.corridor === "USDT_INR" &&
    Number(quote.sourceAmount) === 5000
  ) {
    return true;
  }
  return false;
}

function DemoFocusBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-800">
      Demo focus mode
    </span>
  );
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
  "Draft input",
  "Quote locked",
  "Settlement created",
  "Provider execution",
  "Reconciliation",
] as const;

function ExecutionPathStrip({ activeStep }: { activeStep: number }) {
  return (
    <ol className="qpath" aria-label="Execution flow">
      {EXECUTION_PATH.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;
        return (
          <li key={step} className="contents">
            {index > 0 ? (
              <span aria-hidden="true" className={cn("qpath__link", isDone || isActive ? "qpath__link--done" : "")} />
            ) : null}
            <span
              className={cn(
                "qpath__step",
                isActive && "qpath__step--active",
                isDone && "qpath__step--done",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="qpath__num">{isDone ? "✓" : index + 1}</span>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type PreviewQuote = {
  id?: string;
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
  const payout = quote ? formatCurrencyFull(String(quote.targetAmount), quote.targetCurrency) : null;
  const rows = quote
    ? [
        { label: "Corridor", value: corridorLabel(quote.corridor) },
        { label: "Source amount", value: formatCurrencyFull(String(quote.sourceAmount), quote.sourceCurrency) },
        { label: "Rate", value: formatQuoteRate(String(quote.rate), quote.corridor) },
        { label: "Fee", value: formatCurrencyFull(String(quote.feeAmount), quote.sourceCurrency) },
        { label: "Window", value: settlementWindowLabel(quote.settlementWindow) },
        { label: "Valid until", value: formatDateTime(quote.expiresAt) },
      ]
    : [
        { label: "Corridor", value: "USDT → INR" },
        { label: "Source amount", value: "Awaiting input" },
        { label: "Rate", value: "Locks on generation" },
        { label: "Fee", value: "45 bps indicative" },
        { label: "Window", value: "Instant / same day" },
        { label: "Valid until", value: "15:00 from lock" },
      ];

  return (
    <div className={cn("qlock p-4", isLocked && "qlock--locked")}>
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
            INR payout · Quote lock preview
          </p>
          {isLocked && quote?.id ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="qlock__quoteid">{quotePublicId(quote.id)}</span>
              <span className="qlock__source-tag">Active locked quote · from inventory</span>
            </p>
          ) : (
            <p className="mt-1">
              <span className="qlock__source-tag">Draft preview · reflects standard quote terms</span>
            </p>
          )}
          <p className="mt-1 text-[11px] text-white/50">
            {isLocked
              ? "Locked execution terms — independent of the draft form on the left."
              : "Values lock when you generate the quote; the draft form does not move money."}
          </p>
        </div>
        <span className={cn("qlock__chip shrink-0", isLocked ? "qlock__chip--locked" : "qlock__chip--indicative")}>
          {isLocked ? "● Locked" : "Indicative"}
        </span>
      </div>

      <div className="relative mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">INR payout</p>
        <p className={cn("qlock__payout mt-1", !payout && "qlock__payout--empty")}>
          {payout ?? "₹ —"}
        </p>
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-2">
        <span className="qlock__timer">
          <span className="qlock__timer-dot" aria-hidden="true" />
          {isLocked && quote ? `Valid · ${formatExpiryCountdown(quote.expiresAt) ?? "expired"}` : "Validity · 15:00 on lock"}
        </span>
      </div>

      <dl className="relative mt-3">
        {rows.map((row) => (
          <div key={row.label} className="qlock__row">
            <dt>{row.label}</dt>
            <dd className={cn(!isLocked && "is-empty")}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="qlock__note relative mt-auto pt-2.5">
        A settlement can only be created from a locked, unexpired quote. Final terms lock after quote generation.
      </p>
    </div>
  );
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string; tab?: string; demo?: string }>;
}) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const demoFocus = params.demo === "1";
  const tab = params.tab ?? "active";
  const allQuotes = await prisma.quote.findMany({
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

  const quotes = demoFocus ? allQuotes.filter(isDemoQuote) : allQuotes;

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

  // Hero quick stats: average quote validity (TTL) and most recent quote time.
  const avgValidityMin = quotes.length
    ? Math.round(
        quotes.reduce((sum, q) => sum + (q.expiresAt.getTime() - q.createdAt.getTime()), 0) /
          quotes.length /
          60000,
      )
    : null;
  const lastQuoteAt = quotes[0]?.createdAt ?? null;

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
      {/* 1 ── Quote command hero ─────────────────────────────────────────── */}
      <section className="conf-hero ov-reveal p-5 sm:p-7">
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="case-chip case-chip--shadow">USDT treasury → INR bank settlement</span>
            <span className="case-chip case-chip--demo">Sandbox</span>
            <span className="case-chip case-chip--demo">isTest enforced</span>
            <span className="case-chip case-chip--demo">Live payouts disabled</span>
            {demoFocus ? <DemoFocusBadge /> : null}
          </div>
          <h1 className="conf-hero__headline mt-4">Lock executable settlement terms.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
            A settlement can only be created from a locked, unexpired quote — corridor, amount, rate and window are
            fixed before any money moves on the external rail.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--ops-line-soft)] pt-4">
            {[
              { label: "Active", value: String(activeCount), tone: "text-brand-emerald-ink" },
              { label: "Accepted", value: String(acceptedCount), tone: "text-[#0a7d86]" },
              { label: "Expired", value: String(expiredCount), tone: "text-[#9b6810]" },
              { label: "Avg validity", value: avgValidityMin !== null ? `${avgValidityMin} min` : "—", tone: "text-slate-700" },
              { label: "Last quote", value: lastQuoteAt ? formatDateTime(lastQuoteAt) : "—", tone: "text-slate-700" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{stat.label}</p>
                <p className={cn("mt-0.5 text-sm font-semibold tabular-nums tracking-tight", stat.tone)}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 ── Corridor visualizer (page anchor) ──────────────────────────── */}
      <section className="corridor-viz ov-reveal ov-reveal-1" aria-label="Settlement corridor">
        <div className="corridor-viz__station corridor-viz__station--source">
          <span className="corridor-viz__label">Source</span>
          <span className="corridor-viz__name">USDT Treasury</span>
          <span className="corridor-viz__hint">Stablecoin float · Fireblocks vault</span>
        </div>
        <span className="corridor-viz__line corridor-viz__line--in" aria-hidden="true" />
        <div className="corridor-viz__station corridor-viz__station--lock">
          <span className="corridor-viz__medal" aria-hidden="true">
            <Lock className="h-3.5 w-3.5" />
          </span>
          <span className="corridor-viz__label">Terms</span>
          <span className="corridor-viz__name">Quote Lock</span>
          <span className="corridor-viz__hint">Rate · fee · window fixed 15 min</span>
        </div>
        <span className="corridor-viz__line corridor-viz__line--out" aria-hidden="true" />
        <div className="corridor-viz__station corridor-viz__station--target">
          <span className="corridor-viz__label">Destination</span>
          <span className="corridor-viz__name">INR Settlement</span>
          <span className="corridor-viz__hint">Bank rail via external provider</span>
        </div>
      </section>

      {params.error ? <FlashMessage message={params.error} tone="error" /> : null}
      {params.success === "created" ? (
        <FlashMessage message="Executable quote generated — it is ACTIVE and ready for settlement creation." />
      ) : null}
      {params.success === "refreshed" ? (
        <FlashMessage message="Replacement quote generated — it is ACTIVE and ready for settlement." />
      ) : null}

      <div id="quote-ticket" className="quote-ticket ops-panel ops-panel-accent ov-reveal ov-reveal-2 scroll-mt-4 overflow-hidden">
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

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="quote-ticket-form p-3.5 sm:p-4">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-emerald/15 bg-brand-emerald/[0.06] px-2.5 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">Execution lane</span>
              <span className="text-sm font-semibold text-brand-emerald-ink">USDT → INR</span>
              <span className="ml-auto case-chip case-chip--demo">sandbox</span>
            </div>

            <p className="ticket-section-title mb-2">Trade parameters</p>

            <form action={submitQuote} className="quote-generate-form grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="ticket-param">
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
              </div>
              <div className="ticket-param">
                <Field label="Source amount" htmlFor="sourceAmount" hint="Amount in source currency." required>
                  <Input id="sourceAmount" name="sourceAmount" type="number" min="1" step="0.01" placeholder="10000" required />
                </Field>
              </div>
              <div className="ticket-param">
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
              </div>
              <div className="ticket-param">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Execution lane</p>
                <p className="mt-1.5 text-xs font-semibold text-slate-700">External provider rail</p>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                  RemitQuickly / PontisGlobe sandbox · INRSettle does not move funds
                </p>
              </div>
              <div className="ticket-param">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Rate basis · quote terms</p>
                <dl className="mt-1">
                  <div className="ticket-term">
                    <dt>Reference</dt>
                    <dd>Treasury desk rate</dd>
                  </div>
                  <div className="ticket-term">
                    <dt>Fee</dt>
                    <dd>45 bps</dd>
                  </div>
                </dl>
              </div>
              <div className="ticket-param">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Validity terms</p>
                <dl className="mt-1">
                  <div className="ticket-term">
                    <dt>Quote validity</dt>
                    <dd>15 min</dd>
                  </div>
                  <div className="ticket-term">
                    <dt>Terms</dt>
                    <dd>Lock on generation</dd>
                  </div>
                </dl>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-3">
                <p className="text-[11px] leading-snug text-slate-400">
                  Generating locks rate, fee and window — the ticket becomes executable for settlement creation.
                </p>
                <SubmitButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  pendingText="Locking quote..."
                  className="quote-ticket-cta shrink-0"
                >
                  Generate executable quote
                </SubmitButton>
              </div>
            </form>
          </div>

          <QuotePreviewPanel quote={previewQuote} />
        </div>
      </div>

      <div className="ops-panel ov-reveal ov-reveal-3 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[var(--ops-line-soft)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quote inventory</p>
            <p className="truncate text-xs text-slate-400">Executable tickets ready for settlement creation</p>
          </div>
          <TabLinks
            basePath="/quotes"
            active={tab}
            preserve={{
              ...(params.q ? { q: params.q } : {}),
              ...(demoFocus ? { demo: "1" } : {}),
            }}
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

        {tab === "expired" && filtered.length ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ops-line-soft)] bg-amber-50/40 px-3 py-2 text-xs text-slate-600">
            <span className="case-chip case-chip--gold">{expiredCount} expired</span>
            <span>Stale quotes cannot create settlements — refresh to lock current terms.</span>
          </div>
        ) : null}

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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="quote-ticket-id">{publicId}</p>
                              <span className="quote-badge-locked quote-badge-live">LOCKED</span>
                            </div>
                            <p className="mt-0.5 text-xs font-semibold text-slate-700">{corridorLabel(quote.corridor)}</p>
                            <p className="mt-1 text-[11px] font-medium text-brand-emerald-ink">
                              Executable — {quoteStatusSubtext(displayStatus).toLowerCase()}
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
                                href={`/settlements?q=${encodeURIComponent(linkedSettlement.publicId)}${demoFocus ? "&demo=1" : ""}`}
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
          <div className="empty-compact">
            <span className="empty-compact__icon">
              {tab === "active" ? <Lock className="h-[18px] w-[18px]" /> : <FileSearch className="h-[18px] w-[18px]" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight text-slate-900">{emptyTitle}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{emptyDescription}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {acceptedCount > 0 ? (
                  <span className="case-chip case-chip--shadow">{acceptedCount} consumed by settlements</span>
                ) : null}
                {expiredCount > 0 ? (
                  <span className="case-chip case-chip--gold">{expiredCount} expired — refresh to re-arm</span>
                ) : null}
                {acceptedCount === 0 && expiredCount === 0 ? (
                  <span className="case-chip case-chip--demo">No quotes generated yet</span>
                ) : null}
              </div>
            </div>
            <Link
              href={tab === "active" ? "#quote-ticket" : "/quotes?tab=active"}
              className="shrink-0 rounded-lg border border-[var(--ops-line)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-ops-xs transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {tab === "active" ? "Generate quote" : "View active"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
