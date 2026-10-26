import { useLocation } from "wouter";
import {
  CloudOff,
  FileText,
  Package,
  PackageOpen,
  RotateCcw,
  ShoppingBag,
  Truck,
  ArrowLeftRight,
} from "lucide-react";
import DashboardSection from "./DashboardSection";
import { DEFAULT_SYNC_STATUS, withNumericDefaults } from "@/lib/dashboardHelpers";

function MiniStatusCard({ title, fullTitle, value, icon: Icon, onClick }) {
  const display = Number(value || 0).toLocaleString("en-IN");
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${fullTitle || title}: ${display}`}
      className="min-w-0 w-full text-left rounded-lg border border-[#c9a227]/50 bg-gradient-to-br from-white to-neutral-50 px-1.5 py-1 shadow-sm hover:border-[#c9a227] hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-[9px] sm:text-[10px] leading-tight font-medium text-neutral-500 line-clamp-2">
            {title}
          </p>
          <p
            title={display}
            className="mt-0.5 text-xs sm:text-sm font-bold tabular-nums text-black leading-none whitespace-nowrap truncate"
          >
            {display}
          </p>
        </div>
        {Icon ? (
          <div className="h-5 w-5 rounded-md bg-black text-white shadow-sm border border-[#c9a227]/55 shrink-0 flex items-center justify-center">
            <Icon className="h-2.5 w-2.5" strokeWidth={2.25} />
          </div>
        ) : null}
      </div>
    </button>
  );
}

export default function SyncStatusSummary({ data, toDate }) {
  const [, setLocation] = useLocation();
  const summary = withNumericDefaults(data, DEFAULT_SYNC_STATUS);

  const go = (path, extra = {}) => {
    const params = new URLSearchParams();
    if (toDate) params.set("to_date", toDate);
    Object.entries(extra).forEach(([k, v]) => {
      if (v != null && v !== "") params.set(k, String(v));
    });
    const qs = params.toString();
    setLocation(qs ? `${path}?${qs}` : path);
  };

  const cards = [
    {
      title: "Sales Invoice NS",
      fullTitle: "Sales Invoice Not Synced",
      value: summary.sales_invoice_not_synced,
      icon: ShoppingBag,
      onClick: () => go("/outward/delivery-notes", { tally_sync: "not_synced" }),
    },
    {
      title: "Sales Return NS",
      fullTitle: "Sales Return Not Synced",
      value: summary.sales_return_not_synced,
      icon: RotateCcw,
      onClick: () => go("/reports/sales-return-reports", { tally_sync: "not_synced" }),
    },
    {
      title: "Purchase Invoice NS",
      fullTitle: "Purchase Invoice Not Synced",
      value: summary.purchase_invoice_not_synced,
      icon: Package,
      onClick: () => go("/add-purchase-order"),
    },
    {
      title: "GP Pending/Partial",
      fullTitle: "Gate Pass Pending / Partial",
      value: summary.gate_pass_pending_or_partial,
      icon: Truck,
      onClick: () => go("/outward/outward-list", { status: "pending" }),
    },
    {
      title: "Inward Pending",
      fullTitle: "Inward Not Completed",
      value: summary.inward_not_completed,
      icon: PackageOpen,
      onClick: () => go("/reports/inward-list", { status: "not_completed" }),
    },
    {
      title: "Credit Note NS",
      fullTitle: "Credit Note Not Synced",
      value: summary.credit_note_not_synced,
      icon: FileText,
      onClick: () => go("/reports/sales-order-list"),
    },
    {
      title: "Debit Note NS",
      fullTitle: "Debit Note Not Synced",
      value: summary.debit_note_not_synced,
      icon: FileText,
      onClick: () => go("/reports/sales-order-list"),
    },
    {
      title: "Contra Entry NS",
      fullTitle: "Contra Entry Not Synced",
      value: summary.contra_entry_not_synced,
      icon: ArrowLeftRight,
      onClick: () => go("/reports/sales-order-list"),
    },
  ];

  return (
    <DashboardSection
      title="Sync & Pending Status"
      icon={CloudOff}
      className="[&>div:last-child]:p-2 sm:[&>div:last-child]:p-2.5"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1.5">
        {cards.map((card) => (
          <MiniStatusCard
            key={card.fullTitle}
            title={card.title}
            fullTitle={card.fullTitle}
            value={card.value}
            icon={card.icon}
            onClick={card.onClick}
          />
        ))}
      </div>
    </DashboardSection>
  );
}
