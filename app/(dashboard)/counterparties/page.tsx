import { requireSession } from "@/lib/auth";
import { COUNTERPARTIES, accountsForCounterparty } from "@/lib/treasury";
import { formatCurrencyCompact, formatCurrencyFull } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { CounterpartyDetailSheet } from "@/components/dashboard/counterparty-detail-sheet";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

function recentSettlementsFor(volume: number, corridor: "INR_USDT" | "USDT_INR") {
  if (volume <= 0) return [];
  const currency = corridor === "INR_USDT" ? "INR" : "USDT";
  return [
    { fraction: 0.18, status: "RECONCILED", when: "2 days ago" },
    { fraction: 0.11, status: "SETTLED", when: "5 days ago" },
    { fraction: 0.07, status: "RECONCILED", when: "1 week ago" },
  ].map((row, index) => ({
    reference: `psp_batch_${1840 - index}`,
    amount: formatCurrencyFull(Math.round(volume * row.fraction), currency),
    status: row.status,
    when: row.when,
  }));
}

export default async function CounterpartiesPage() {
  await requireSession();

  const active = COUNTERPARTIES.filter((cp) => cp.status === "ACTIVE").length;
  const pending = COUNTERPARTIES.filter((cp) => cp.status === "PENDING").length;
  const totalVolume = COUNTERPARTIES.reduce((sum, cp) => sum + cp.settledVolume, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Counterparties"
        description="Exchanges, PSPs and banking partners that settle across your corridors."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Counterparties" value={COUNTERPARTIES.length} hint="Across corridors" />
        <MetricCard label="Active" value={active} hint="Live settlement" tone="success" />
        <MetricCard label="Onboarding" value={pending} hint="KYB in review" tone="warning" />
        <MetricCard
          label="Lifetime settled"
          value={formatCurrencyCompact(totalVolume)}
          valueTitle={formatCurrencyFull(totalVolume)}
          hint="All counterparties"
        />
      </div>

      <DataGrid>
        <table className="w-full min-w-[820px]">
          <DataGridHead>
            <DataGridTh>Counterparty</DataGridTh>
            <DataGridTh>Type</DataGridTh>
            <DataGridTh>Corridor</DataGridTh>
            <DataGridTh>Country</DataGridTh>
            <DataGridTh>Settled volume</DataGridTh>
            <DataGridTh>Status</DataGridTh>
            <DataGridTh className="text-right">Detail</DataGridTh>
          </DataGridHead>
          <DataGridBody>
            {COUNTERPARTIES.map((cp) => (
              <DataGridRow key={cp.id}>
                <DataGridTd>
                  <p className="font-medium text-slate-950">{cp.name}</p>
                  <p className="max-w-[280px] truncate text-xs text-slate-500">{cp.notes}</p>
                </DataGridTd>
                <DataGridTd className="text-slate-600">{cp.type}</DataGridTd>
                <DataGridTd className="text-slate-600">{cp.corridor.replace("_", " → ")}</DataGridTd>
                <DataGridTd className="text-slate-600">{cp.country}</DataGridTd>
                <DataGridTd
                  className="whitespace-nowrap tabular-nums"
                  title={formatCurrencyFull(cp.settledVolume)}
                >
                  {formatCurrencyFull(cp.settledVolume)}
                </DataGridTd>
                <DataGridTd>
                  <StatusBadge status={cp.status} />
                </DataGridTd>
                <DataGridTd className="text-right">
                  <CounterpartyDetailSheet
                    counterparty={{
                      name: cp.name,
                      type: cp.type,
                      country: cp.country,
                      corridor: cp.corridor.replace("_", " → "),
                      status: cp.status,
                      settledVolume: formatCurrencyFull(cp.settledVolume),
                      notes: cp.notes,
                      linkedAccounts: accountsForCounterparty(cp).map((account) => ({
                        name: account.name,
                        currency: account.currency,
                        balance: formatCurrencyFull(account.balance, account.currency),
                      })),
                      recentSettlements: recentSettlementsFor(cp.settledVolume, cp.corridor),
                    }}
                  />
                </DataGridTd>
              </DataGridRow>
            ))}
          </DataGridBody>
        </table>
      </DataGrid>
    </div>
  );
}
