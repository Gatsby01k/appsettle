import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createQuote } from "@/lib/domain";
import { friendlyErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { organization } = await requireSession();
  const params = await searchParams;
  const quotes = await prisma.quote.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Treasury Quotes</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Create and manage corridor quotes</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          ACTIVE quotes can be used to create settlements until they expire. ACCEPTED quotes are already consumed by an existing settlement but remain visible here for history.
        </p>
      </div>
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
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>New quote</CardTitle></CardHeader>
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
        <Card>
          <CardHeader><CardTitle>Quote history</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Corridor</TableHead><TableHead>Source</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>{quote.corridor.replace("_", " → ")}</TableCell>
                    <TableCell>{formatCurrency(String(quote.sourceAmount), quote.sourceCurrency)}</TableCell>
                    <TableCell>{formatCurrency(String(quote.targetAmount), quote.targetCurrency)}</TableCell>
                    <TableCell>
                      <Badge tone={quote.status === "ACTIVE" ? "success" : "neutral"}>{quote.status}</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {quote.status === "ACTIVE" ? "Available for settlement creation" : "Already consumed or unavailable"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
