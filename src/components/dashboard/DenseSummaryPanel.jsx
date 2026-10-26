import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, Package, ShoppingBag, ShoppingCart } from "lucide-react";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";
import {
  DEFAULT_ITEM_DETAILS,
  DEFAULT_SALES_ORDER,
  formatCurrency,
  withNumericDefaults,
} from "@/lib/dashboardHelpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DenseSummaryPanel({
  salesOrderSummary,
  itemDetailsSummary,
  selectedDate,
}) {
  const [, setLocation] = useLocation();
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);

  const so = withNumericDefaults(salesOrderSummary, DEFAULT_SALES_ORDER);
  const items = withNumericDefaults(itemDetailsSummary, DEFAULT_ITEM_DETAILS);

  const goSalesOrders = () => {
    const params = new URLSearchParams();
    if (selectedDate) {
      params.set("from_date", selectedDate);
      params.set("to_date", selectedDate);
    }
    setLocation(`/reports/sales-order-list?${params.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-stretch">
      <DashboardSection
        title="Sales Order Details"
        icon={ShoppingCart}
        className="h-full"
        headerAction={
          <button
            type="button"
            onClick={goSalesOrders}
            title="View sales orders"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#c9a227]/70 bg-white text-black hover:bg-neutral-50 cursor-pointer"
          >
            <Eye className="h-4 w-4" />
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <ThemeMetricCard
            title="Sales Orders"
            value={so.total_sales_orders || so.total_count}
            icon={ShoppingCart}
            inline
            onClick={goSalesOrders}
          />
          <ThemeMetricCard
            title="SO Value"
            value={so.total_sales_order_value}
            valueFormat="currency"
            icon={ShoppingBag}
            inline
            onClick={goSalesOrders}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Item Details Summary"
        icon={Package}
        className="h-full"
        headerAction={
          <button
            type="button"
            onClick={() => setItemDetailsOpen(true)}
            title="View item details"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#c9a227]/70 bg-white text-black hover:bg-neutral-50 cursor-pointer"
          >
            <Eye className="h-4 w-4" />
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          <ThemeMetricCard
            title="Top Selling"
            value={items.top_selling_items_count}
            icon={Package}
            inline
            onClick={() => setItemDetailsOpen(true)}
          />
          <ThemeMetricCard
            title="PO Parties"
            value={items.party_wise_purchase_order_count}
            icon={ShoppingCart}
            inline
            onClick={() => setItemDetailsOpen(true)}
          />
          <ThemeMetricCard
            title="Purchase Orders"
            value={items.purchase_order_count}
            icon={ShoppingBag}
            inline
            onClick={() => setLocation("/add-purchase-order")}
          />
        </div>
      </DashboardSection>

      <Dialog open={itemDetailsOpen} onOpenChange={setItemDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Item Details Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Top Selling Items
              </p>
              {(items.top_selling_items || []).length === 0 ? (
                <p className="text-sm text-slate-500 py-2">No top selling items for this date.</p>
              ) : (
                <ul className="space-y-2">
                  {items.top_selling_items.map((row) => (
                    <li
                      key={row.stock_item_id}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm flex justify-between gap-3"
                    >
                      <span className="font-medium text-slate-800 min-w-0 truncate">
                        #{row.rank} {row.stock_item_name}
                      </span>
                      <span className="tabular-nums text-slate-600 shrink-0">
                        {Number(row.total_quantity || 0).toLocaleString("en-IN")}{" "}
                        {row.base_unit || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                PO Parties ({items.party_wise_purchase_order_count})
              </p>
              {(items.party_wise_purchase_orders || []).length === 0 ? (
                <p className="text-sm text-slate-500 py-2">No purchase orders for this date.</p>
              ) : (
                <ul className="space-y-2">
                  {items.party_wise_purchase_orders.map((party) => (
                    <li
                      key={party.party_name}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm flex justify-between gap-3"
                    >
                      <span className="font-medium text-slate-800 min-w-0 truncate">
                        {party.party_name}
                      </span>
                      <span className="tabular-nums text-slate-600 shrink-0">
                        {party.purchase_order_count} PO
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-slate-500">
              SO Value today: {formatCurrency(so.total_sales_order_value)}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
