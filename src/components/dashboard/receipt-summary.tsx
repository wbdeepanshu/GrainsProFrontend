import { IndianRupee, Receipt, Wallet } from "lucide-react";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";

interface ReceiptsSummary {
  total_receipts: number;
  total_amount: number;
  error: string | null;
}

interface LedgerSummary {
  overall_count: number;
  not_synced_to_tally_count: number;
  error: string | null;
}

interface ExpenseSummary {
  total_entries: number;
  total_amount: number;
  error: string | null;
}

interface ReceiptSummaryProps {
  data?: ReceiptsSummary;
  ledgerData?: LedgerSummary;
  showLedgerSummary?: boolean;
  showReceiptSummary?: boolean;
  expenseData?: ExpenseSummary;
  showExpenseSummary?: boolean;
}

export default function ReceiptSummary({
  data,
  ledgerData,
  showLedgerSummary = false,
  showReceiptSummary = true,
  expenseData,
  showExpenseSummary = false,
}: ReceiptSummaryProps) {
  const summaryTitle =
    showReceiptSummary && showExpenseSummary
      ? "Receipt & Expense Summary"
      : showExpenseSummary
        ? "Expense Summary"
        : showLedgerSummary
          ? "Receipt & Ledger Summary"
          : "Receipt Summary";

  if (!showReceiptSummary && !showExpenseSummary && !showLedgerSummary) {
    return null;
  }

  if (showReceiptSummary && !data) {
    return (
      <DashboardSection title={summaryTitle} icon={Receipt}>
        <p className="text-center text-sm text-neutral-500 py-4">No receipt data available</p>
      </DashboardSection>
    );
  }

  if (showReceiptSummary && data?.error) {
    return (
      <DashboardSection title={summaryTitle} icon={Receipt}>
        <p className="text-center text-sm text-red-600 py-4">{data.error}</p>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title={summaryTitle} icon={Receipt}>
      <div className="grid grid-cols-2 gap-1.5 min-w-0">
        {showReceiptSummary && data && (
          <>
            <ThemeMetricCard
              title="Total Receipts"
              value={data.total_receipts}
              icon={Receipt}
              inline
            />
            <ThemeMetricCard
              title="Total Amount"
              value={data.total_amount}
              valueFormat="currency"
              icon={IndianRupee}
              inline
            />
          </>
        )}

        {showLedgerSummary &&
          (ledgerData?.error ? (
            <p className="col-span-2 text-sm text-red-600">{ledgerData.error}</p>
          ) : (
            <>
              <ThemeMetricCard
                title="Total Ledgers"
                value={ledgerData?.overall_count ?? 0}
                icon={Wallet}
                inline
              />
              <ThemeMetricCard
                title="Not Synced To Tally"
                value={ledgerData?.not_synced_to_tally_count ?? 0}
                icon={Wallet}
                inline
              />
            </>
          ))}

        {showExpenseSummary &&
          (expenseData?.error ? (
            <p className="col-span-2 text-sm text-red-600">{expenseData.error}</p>
          ) : (
            <>
              <ThemeMetricCard
                title="Expense Entries"
                value={expenseData?.total_entries ?? 0}
                icon={Receipt}
                inline
              />
              <ThemeMetricCard
                title="Expense Amount"
                value={expenseData?.total_amount ?? 0}
                valueFormat="currency"
                icon={IndianRupee}
                inline
              />
            </>
          ))}
      </div>
    </DashboardSection>
  );
}
