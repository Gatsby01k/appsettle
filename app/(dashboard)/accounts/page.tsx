import { requireSession } from "@/lib/auth";
import { ACCOUNTS, availableBalance, counterpartiesForAccount } from "@/lib/treasury";
import { formatCurrencyCompact, formatCurrencyFull } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { AccountDetailSheet } from "@/components/dashboard/account-detail-sheet";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

function recentActivityFor(balance: number, currency: string) {
  return [
    { label: "Inbound settlement", fraction: 0.12, when: "Today, 11:42" },
    { label: "Outbound payout", fraction: -0.06, when: "Yesterday, 17:08" },
    { label: "Inbound settlement", fraction: 0.09, when: "2 days ago" },
  ].map((row) => ({
    label: row.label,
    amount: `${row.fraction < 0 ? "-" : "+"}${formatCurrencyFull(Math.round(Math.abs(balance * row.fraction)), currency)}`,
    when: row.when,
  }));
}

export default async function AccountsPage() {
  await requireSession();

  const inr = availableBalance("INR");
  const usdt = availableBalance("USDT");
  const usdc = availableBalance("USDC");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Reference balances you record for operations. INRSettle holds no funds and provides no liquidity."
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <MetricCard
          label="Recorded INR"
          value={formatCurrencyCompact(inr, "INR")}
          valueTitle={formatCurrencyFull(inr, "INR")}
          hint="Reference only"
          tone="success"
        />
        <MetricCard
          label="Recorded USDT"
          value={formatCurrencyCompact(usdt, "USDT")}
          valueTitle={formatCurrencyFull(usdt, "USDT")}
          hint="Reference only"
          tone="info"
        />
        <MetricCard
          label="Recorded USDC"
          value={formatCurrencyCompact(usdc, "USDC")}
          valueTitle={formatCurrencyFull(usdc, "USDC")}
          hint="Reference only"
          tone="info"
        />
        <MetricCard label="Accounts" value={ACCOUNTS.length} hint="Across institutions" />
      </div>

      <DataGrid>
        <table className="w-full min-w-[760px]">
          <DataGridHead>
            <DataGridTh>Account</DataGridTh>
            <DataGridTh>Type</DataGridTh>
            <DataGridTh>Institution</DataGridTh>
            <DataGridTh>Currency</DataGridTh>
            <DataGridTh>Balance</DataGridTh>
            <DataGridTh>Status</DataGridTh>
            <DataGridTh className="text-right">Detail</DataGridTh>
          </DataGridHead>
          <DataGridBody>
            {ACCOUNTS.map((account) => (
              <DataGridRow key={account.id}>
                <DataGridTd className="font-medium text-slate-950">{account.name}</DataGridTd>
                <DataGridTd className="text-slate-600">{account.type}</DataGridTd>
                <DataGridTd className="text-slate-600">{account.institution}</DataGridTd>
                <DataGridTd className="text-slate-600">{account.currency}</DataGridTd>
                <DataGridTd
                  className="whitespace-nowrap tabular-nums font-medium"
                  title={formatCurrencyFull(account.balance, account.currency)}
                >
                  {formatCurrencyFull(account.balance, account.currency)}
                </DataGridTd>
                <DataGridTd>
                  <StatusBadge status={account.status} />
                </DataGridTd>
                <DataGridTd className="text-right">
                  <AccountDetailSheet
                    account={{
                      name: account.name,
                      type: account.type,
                      currency: account.currency,
                      balance: formatCurrencyFull(account.balance, account.currency),
                      institution: account.institution,
                      status: account.status,
                      linkedCounterparties: counterpartiesForAccount(account).map((cp) => ({
                        name: cp.name,
                        type: cp.type,
                      })),
                      recentActivity: recentActivityFor(account.balance, account.currency),
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
