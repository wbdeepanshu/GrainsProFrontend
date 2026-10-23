import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Calendar, ChevronDown, ChevronRight, ClipboardList, Download, FileText, IndianRupee, Menu, RefreshCw, Search, User, Users } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function monthRange() {
  const now = new Date();
  return {
    fromDate: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return toNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function differenceClass(value) {
  const amount = toNumber(value);
  if (amount > 0) return "font-semibold text-emerald-600";
  if (amount < 0) return "font-semibold text-red-600";
  return "text-slate-700";
}

function formatQty(value, unit) {
  const amount = toNumber(value);
  const text = Number.isInteger(amount)
    ? amount.toLocaleString("en-IN")
    : amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unit ? `${text} ${unit}` : text;
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-950 text-white">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

export default function SoDeviationReport() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [datePreset, setDatePreset] = useState("today");
  const [fromDate, setFromDate] = useState(todayIsoDate);
  const [toDate, setToDate] = useState(todayIsoDate);
  const [partyId, setPartyId] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [openIds, setOpenIds] = useState({});
  const token = AuthService.getAccessToken();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["so-deviation-report", fromDate, toDate, partyId, createdBy, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (partyId) params.set("party_id", partyId);
      if (createdBy) params.set("created_by", createdBy);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const response = await apiRequest("GET", `${API_BASE_URL}/api/report/so-deviation-report/?${params.toString()}`);
      const body = await response.json();
      if (!response.ok || Number(body.status) >= 400) {
        throw new Error(body.message || "Unable to load the SO deviation report.");
      }
      return body;
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
  const summary = data?.summary || {};
  const parties = data?.parties || [];
  const creators = data?.creators || [];

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const XLSX = await import("xlsx");
      const sheetRows = rows.map((row) => ({
        Date: row.order_date_display || "—",
        "Sales Order": row.order_id || "—",
        Party: row.party_name || "—",
        "Created By": row.created_by || "—",
        "SO Amount": toNumber(row.so_amount),
        "Current Amount": toNumber(row.current_amount),
        Difference: toNumber(row.difference),
        Remarks: row.remarks || "",
      }));
      const itemRows = rows.flatMap((row) => (row.items || []).map((item) => ({
        Date: row.order_date_display || "—",
        "Sales Order": row.order_id || "—",
        Party: row.party_name || "—",
        Item: item.item_name || "—",
        "Business Type": item.business_type || "",
        Qty: toNumber(item.quantity),
        Unit: item.unit || "",
        "SO Rate": toNumber(item.so_rate),
        "Actual Rate": toNumber(item.actual_rate),
        "Rate Difference": toNumber(item.rate_difference),
        "SO Amount": toNumber(item.so_amount),
        "Actual Total": toNumber(item.actual_amount),
        "Amount Diff": toNumber(item.difference),
      })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), "SO Deviation");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(itemRows), "Items");
      XLSX.writeFile(workbook, `so-deviation-report-${fromDate || "from"}-to-${toDate || "to"}.xlsx`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app-layout">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}
      <div className="app-main-content">
        <header className="app-header flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-semibold text-slate-900">SO Deviation Report</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-blue-950 text-white hover:bg-blue-900" onClick={downloadExcel} disabled={downloading || !rows.length}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="app-main-scrollable space-y-4 p-4 sm:p-6">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Sales Orders" value={toNumber(summary.order_count).toLocaleString("en-IN")} icon={ClipboardList} />
            <SummaryCard label="SO Amount" value={formatMoney(summary.total_so_amount)} icon={IndianRupee} />
            <SummaryCard label="Current Margin Amount" value={formatMoney(summary.total_current_amount)} icon={Box} />
            <SummaryCard label="Total Difference" value={formatMoney(summary.total_difference)} icon={FileText} />
          </section>

          <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Date range</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={datePreset}
                onChange={(event) => {
                  const next = event.target.value;
                  setDatePreset(next);
                  setPartyId("");
                  setCreatedBy("");
                  if (next === "today") {
                    const today = todayIsoDate();
                    setFromDate(today);
                    setToDate(today);
                  } else if (next === "monthly") {
                    const range = monthRange();
                    setFromDate(range.fromDate);
                    setToDate(range.toDate);
                  }
                }}
              >
                <option value="today">Today</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> From date</span>
              <Input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                disabled={datePreset !== "custom"}
                onChange={(event) => {
                  const next = event.target.value;
                  setFromDate(next);
                  if (toDate && next && next > toDate) setToDate(next);
                  setPartyId("");
                  setCreatedBy("");
                }}
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> To date</span>
              <Input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                disabled={datePreset !== "custom"}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPartyId("");
                  setCreatedBy("");
                }}
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> Party</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={partyId}
                onChange={(event) => setPartyId(event.target.value)}
              >
                <option value="">All parties</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>{party.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><User className="h-4 w-4" /> Created by</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
              >
                <option value="">All users</option>
                {creators.map((creator) => (
                  <option key={creator.id} value={creator.id}>{creator.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Search className="h-4 w-4" /> Search</span>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="SO number, party, item, remarks..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </label>
          </section>

          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">SO Deviation Listing</h2>
              <p className="text-xs text-slate-500">
                {toNumber(summary.order_count).toLocaleString("en-IN")} orders · {toNumber(summary.item_count).toLocaleString("en-IN")} items
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Date", "Sales Order", "Party", "Created by", "SO Amount", "Current Amount", "Difference", "Remarks"].map((label, index) => (
                      <th key={label} className={`px-4 py-3 font-semibold ${index >= 4 && index <= 6 ? "text-right" : "text-left"}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading SO deviation report...</td></tr>
                  ) : rows.length ? rows.map((row) => {
                    const isOpen = !!openIds[row.order_id];
                    const items = row.items || [];
                    return (
                      <Fragment key={row.order_id}>
                        <tr className="odd:bg-white even:bg-slate-50">
                          <td className="border-b px-4 py-2.5 whitespace-nowrap">{row.order_date_display}</td>
                          <td className="border-b px-4 py-2.5 whitespace-nowrap">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 font-medium text-blue-950 hover:underline"
                              aria-expanded={isOpen}
                              onClick={() => setOpenIds((current) => ({ ...current, [row.order_id]: !current[row.order_id] }))}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {row.order_id}
                            </button>
                          </td>
                          <td className="max-w-[240px] truncate border-b px-4 py-2.5" title={row.party_name}>{row.party_name}</td>
                          <td className="border-b px-4 py-2.5 whitespace-nowrap">{row.created_by || "—"}</td>
                          <td className="border-b px-4 py-2.5 text-right">{formatMoney(row.so_amount)}</td>
                          <td className="border-b px-4 py-2.5 text-right">{formatMoney(row.current_amount)}</td>
                          <td className={`border-b px-4 py-2.5 text-right ${differenceClass(row.difference)}`}>{formatMoney(row.difference)}</td>
                          <td className="max-w-[220px] truncate border-b px-4 py-2.5 text-slate-600" title={row.remarks}>{row.remarks || "—"}</td>
                        </tr>
                        {isOpen && (
                          <tr key={`${row.order_id}-items`} className="bg-slate-50">
                            <td colSpan={8} className="border-b px-4 py-3">
                              <table className="w-full text-sm">
                                <thead className="text-xs uppercase tracking-wide text-slate-500">
                                  <tr>
                                    {["Item", "Qty", "SO Rate", "Actual Rate", "SO Amount", "Actual Total", "Amount Diff"].map((label, index) => (
                                      <th key={label} className={`px-3 py-2 font-semibold ${index === 0 ? "text-left" : "text-right"}`}>{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.length ? items.map((item) => (
                                    <tr key={item.item_id} className="border-t border-slate-200">
                                      <td className="px-3 py-2">
                                        <div className="font-medium text-slate-900">{item.item_name}</div>
                                        {item.business_type && <div className="text-xs text-slate-500">{item.business_type}</div>}
                                      </td>
                                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatQty(item.quantity, item.unit)}</td>
                                      <td className="px-3 py-2 text-right">{formatMoney(item.so_rate)}</td>
                                      <td className="px-3 py-2 text-right">
                                        <div>{formatMoney(item.actual_rate)}</div>
                                        <div className={`text-xs ${differenceClass(item.rate_difference)}`}>{formatMoney(item.rate_difference)}</div>
                                      </td>
                                      <td className="px-3 py-2 text-right">{formatMoney(item.so_amount)}</td>
                                      <td className="px-3 py-2 text-right">{formatMoney(item.actual_amount)}</td>
                                      <td className={`px-3 py-2 text-right ${differenceClass(item.difference)}`}>{formatMoney(item.difference)}</td>
                                    </tr>
                                  )) : (
                                    <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-500">No items on this order.</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }) : (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No sales orders found for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
      <Loader isLoading={isLoading} text="Loading sales order deviation" />
    </div>
  );
}
