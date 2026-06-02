import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createQuote } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { EmptyState, FilterBar, MetricCard, PageHeader, PremiumStatusBadge } from "@/components/dashboard/premium";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
import { SubmitButton } from "@/components/ui/submit-button";

async function submitQuote(formData: FormData) {
  "use server";
  const { user, organization } = await requireSession();
  try {
    await createQuote({
      corridor: String(formData.get("corridor") ?? ""),
      sourceAmount: formData.get("sourceAmount"),
      settlementWindow: String(formData.get("settlementWindow") ?? ""),
    }, user.id, organization.id);
  } catch (error) {
    redirect(`/quotes?error=${encodeURIComponent(friendlyErrorMessage(error))}`);
  }
  redirect("/quotes?success=created");
}

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string }> }) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const quotes = await prisma.quote.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const query = params.q?.toLowerCase().trim() ?? "";
  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch = !query || quote.corridor.toLowerCase().includes(query) || quote.id.toLowerCase().includes(query);
    const matchesStatus = !params.status || quote.status === params.status;
    return matchesSearch && matchesStatus;
  });
  const activeCount = quotes.filter((quote) => quote.status === "ACTIVE").length;
  const acceptedCount = quotes.filter((quote) => quote.status === "ACCEPTED").length;

  return (
    <RevealGroup className="space-y-8">
      <Reveal>
        <PageHeader
          eyebrow="Treasury quotes"
          title="Quote orchestration for corridor liquidity"
          description="Create executable corridor quotes, monitor inventory, and preserve accepted quotes for treasury history."
        />
      </Reveal>
      {params.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {params.error}
        </div>
      ) : null}
      {params.success === "created" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Quote created. Use it from the settlement form while it is ACTIVE.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Reveal><MetricCard label="Total quotes" value={quotes.length} helper="All quote history" tone="slate" /></Reveal>
        <Reveal><MetricCard label="Active" value={activeCount} helper="Available for settlement creation" tone="emerald" /></Reveal>
        <Reveal><MetricCard label="Accepted" value={acceptedCount} helper="Consumed by settlements" tone="amber" /></Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <Reveal>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New quote</CardTitle>
            <p className="text-sm text-slate-500">ACTIVE quotes can be converted into settlements until they expire. ACCEPTED quotes are already consumed but remain visible in history.</p>
          </CardHeader>
          <CardContent>
            <form action={submitQuote} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="corridor">Corridor</Label>
                <select id="corridor" name="corridor" className="h-11 rounded-xl border bg-background px-3 text-sm">
                  <option value="INR_USDT">INR → USDT</option>
                  <option value="USDT_INR">USDT → INR</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sourceAmount">Source amount</Label>
                <Input id="sourceAmount" name="sourceAmount" type="number" min="1" step="0.01" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="settlementWindow">Settlement window</Label>
                <select id="settlementWindow" name="settlementWindow" className="h-11 rounded-xl border bg-background px-3 text-sm">
                  <option value="instant">Instant</option>
                  <option value="same_day">Same day</option>
                  <option value="next_day">Next day</option>
                </select>
              </div>
              <SubmitButton type="submit" pendingText="Generating quote...">Generate quote</SubmitButton>
            </form>
          </CardContent>
        </Card>
        </Reveal>
        <Reveal>
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Quote history</CardTitle>
            <FilterBar
              searchPlaceholder="Search corridor or quote id..."
              statusOptions={["ACTIVE", "ACCEPTED", "EXPIRED", "REJECTED"]}
              defaultSearch={params.q}
              defaultStatus={params.status}
            />
          </CardHeader>
          <CardContent className="grid gap-3">
            {filteredQuotes.length ? filteredQuotes.map((quote) => (
              <div key={quote.id} className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-slate-950">{quote.corridor.replace("_", " → ")}</p>
                      <PremiumStatusBadge status={quote.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Quote {quote.id.slice(0, 10)} · expires {quote.expiresAt.toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <p className="text-slate-500">Source</p>
                      <p className="font-semibold text-slate-950">{formatCurrency(String(quote.sourceAmount), quote.sourceCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Target</p>
                      <p className="font-semibold text-slate-950">{formatCurrency(String(quote.targetAmount), quote.targetCurrency)}</p>
                    </div>
                  </div>
                  <DetailDrawer title={`${quote.corridor.replace("_", " → ")} quote`}>
                    <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Rate</span><span className="font-medium">{String(quote.rate)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Fee</span><span className="font-medium">{formatCurrency(String(quote.feeAmount), quote.sourceCurrency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Window</span><span className="font-medium">{quote.settlementWindow}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Status</span><PremiumStatusBadge status={quote.status} /></div>
                    </div>
                  </DetailDrawer>
                </div>
              </div>
            )) : (
              <EmptyState title="No quotes match your filters" description="Adjust the search or create a new corridor quote." />
            )}
          </CardContent>
        </Card>
        </Reveal>
      </div>
    </RevealGroup>
  );
}
