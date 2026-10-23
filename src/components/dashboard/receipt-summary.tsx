import { Card, CardContent } from "@/components/ui/card";
import { Receipt } from "lucide-react";

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
  const summaryTitle = showReceiptSummary && showExpenseSummary
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
      <Card className="shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Receipt className="h-5 w-5 mr-2" />
            {summaryTitle}
          </h3>
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">No receipt data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showReceiptSummary && data?.error) {
    return (
      <Card className="shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Receipt className="h-5 w-5 mr-2" />
            {summaryTitle}
          </h3>
          <div className="flex items-center justify-center py-8">
            <div className="text-red-500 text-sm">{data.error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border border-gray-200 min-w-0">
      <CardContent className="p-6 min-w-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Receipt className="h-5 w-5 mr-2" />
          {summaryTitle}
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
          {showReceiptSummary && data && (
            <>
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200 min-w-0 overflow-hidden">
                <p className="text-sm text-blue-600 mb-1 font-medium">Total Receipts</p>
                <p className="text-sm sm:text-base font-bold text-blue-900 tabular-nums leading-tight truncate max-w-full">
                  {data.total_receipts.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200 min-w-0 overflow-hidden">
                <p className="text-sm text-green-600 mb-1 font-medium">Total Amount</p>
                <p
                  className="text-sm sm:text-base font-bold text-green-900 tabular-nums leading-tight truncate max-w-full"
                  title={`₹${data.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                >
                  ₹{data.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </>
          )}

          {showLedgerSummary && (
            <>
              {ledgerData?.error ? (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200 sm:col-span-2">
                  <p className="text-sm text-red-700 font-medium">{ledgerData.error}</p>
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 min-w-0 overflow-hidden">
                    <p className="text-sm text-purple-600 mb-1 font-medium">Total Ledgers</p>
                    <p className="text-lg sm:text-xl font-bold text-purple-900 tabular-nums leading-tight break-words">
                      {(ledgerData?.overall_count ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 min-w-0 overflow-hidden">
                    <p className="text-sm text-orange-600 mb-1 font-medium">Not Synced To Tally</p>
                    <p className="text-lg sm:text-xl font-bold text-orange-900 tabular-nums leading-tight break-words">
                      {(ledgerData?.not_synced_to_tally_count ?? 0).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {showExpenseSummary && (
            <>
              {expenseData?.error ? (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200 sm:col-span-2">
                  <p className="text-sm text-red-700 font-medium">{expenseData.error}</p>
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 min-w-0 overflow-hidden">
                    <p className="text-sm text-purple-600 mb-1 font-medium">Expense Entries</p>
                    <p className="text-lg sm:text-xl font-bold text-purple-900 tabular-nums leading-tight break-words">
                      {(expenseData?.total_entries ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 sm:p-4 border border-orange-200 min-w-0 overflow-hidden">
                    <p className="text-sm text-orange-600 mb-1 font-medium">Expense Amount</p>
                    <p
                      className="text-sm sm:text-base font-bold text-orange-900 tabular-nums leading-tight truncate max-w-full"
                      title={`₹${(expenseData?.total_amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    >
                      ₹{(expenseData?.total_amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
