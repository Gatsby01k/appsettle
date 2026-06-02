import { requireSession } from "@/lib/auth";
import { ACCOUNTS, availableBalance } from "@/lib/treasury";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ops/page-header";
import { MetricCard } from "@/components/ops/metric-card";
import { StatusBadge } from "@/components/ops/status-badge";
import {
  DataGrid,
  DataGridBody,
  DataGridHead,
  DataGridRow,
  DataGridTd,
  DataGridTh,
} from "@/components/ops/data-grid";

export default async function AccountsPage() {
  await requireSession();

  const inr = availableBalance("INR");
  const usdt = availableBalance("USDT");
  const usdc = availableBalance("USDC");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Fiat operating and settlement accounts alongside stablecoin treasury wallets."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Available INR" value={formatCurrency(inr, "INR")} hint="Fiat accounts" tone="success" />
        <MetricCard label="Available USDT" value={formatCurrency(usdt, "USDT")} hint="Treasury wallet" tone="info" />
        <MetricCard label="Available USDC" value={formatCurrency(usdc, "USDC")} hint="Reserve" tone="info" />
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
          </DataGridHead>
          <DataGridBody>
            {ACCOUNTS.map((account) => (
              <DataGridRow key={account.id}>
                <DataGridTd className="font-medium text-slate-950">{account.name}</DataGridTd>
                <DataGridTd className="text-slate-600">{account.type}</DataGridTd>
                <DataGridTd className="text-slate-600">{account.institution}</DataGridTd>
                <DataGridTd className="text-slate-600">{account.currency}</DataGridTd>
                <DataGridTd className="tabular-nums font-medium">
                  {formatCurrency(account.balance, account.currency)}
                </DataGridTd>
                <DataGridTd>
                  <StatusBadge status={account.status} />
                </DataGridTd>
              </DataGridRow>
            ))}
          </DataGridBody>
        </table>
      </DataGrid>
    </div>
  );
}
