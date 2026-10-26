import { useLocation } from "wouter";

export const QUICK_LINKS = [
  {
    label: "Sales Order",
    path: "/create-sales-order",
    cardClass:
      "border-blue-300 bg-gradient-to-br from-white to-blue-50 text-blue-900 hover:border-blue-400 hover:shadow-md",
  },
  {
    label: "Purchase Order",
    path: "/add-purchase-order",
    cardClass:
      "border-amber-300 bg-gradient-to-br from-white to-amber-50 text-amber-900 hover:border-amber-400 hover:shadow-md",
  },
  {
    label: "Receipt",
    path: "/add-receipt",
    cardClass:
      "border-emerald-300 bg-gradient-to-br from-white to-emerald-50 text-emerald-900 hover:border-emerald-400 hover:shadow-md",
  },
  {
    label: "Price Masters",
    path: "/price-master",
    cardClass:
      "border-sky-300 bg-gradient-to-br from-white to-sky-50 text-sky-900 hover:border-sky-400 hover:shadow-md",
  },
  {
    label: "Stock Journals",
    path: "/stock-journal/add",
    cardClass:
      "border-orange-300 bg-gradient-to-br from-white to-orange-50 text-orange-900 hover:border-orange-400 hover:shadow-md",
  },
  {
    label: "Ledgers",
    path: "/ledger-masters",
    cardClass:
      "border-teal-300 bg-gradient-to-br from-white to-teal-50 text-teal-900 hover:border-teal-400 hover:shadow-md",
  },
  {
    label: "Stock Audit",
    path: "/stock-auditing",
    cardClass:
      "border-rose-300 bg-gradient-to-br from-white to-rose-50 text-rose-900 hover:border-rose-400 hover:shadow-md",
  },
];

export function DashboardQuickLinksRow() {
  const [, setLocation] = useLocation();

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-2 shadow-sm">
      <ul className="flex flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
        {QUICK_LINKS.map((item) => (
          <li key={item.path} className="min-w-[5.75rem] flex-1">
            <button
              type="button"
              onClick={() => setLocation(item.path)}
              className={`w-full rounded-full border px-2.5 py-1.5 text-center text-[11px] sm:text-xs font-semibold shadow-sm cursor-pointer transition-all active:scale-[0.98] truncate ${item.cardClass}`}
              title={item.label}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
