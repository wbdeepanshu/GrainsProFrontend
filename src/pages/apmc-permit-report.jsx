import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, FileText, Layers, Menu, RefreshCw, Search } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQty(value) {
  return toNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoney(value) {
  return toNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRupee(value) {
  return `₹${formatMoney(value)}`;
}

function formatRoundOff(value) {
  const amount = toNumber(value);
  if (amount === 0) return formatMoney(0);
  const absolute = formatMoney(Math.abs(amount));
  return amount < 0 ? `(-)${absolute}` : absolute;
}

const headerStyle = { backgroundColor: "#282a2f", color: "#ffffff" };
const totalStyle = { backgroundColor: "#dbe4f8", color: "#1e3a8a" };

function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3" style={headerStyle}>
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ApmcPermitReport() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [fromDate, setFromDate] = useState(todayIsoDate);
  const [toDate, setToDate] = useState(todayIsoDate);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const token = AuthService.getAccessToken();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["apmc-permit-report", fromDate, toDate, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const response = await apiRequest("GET", `${API_BASE_URL}/api/report/apmc-permit-report/?${params.toString()}`);
      const body = await response.json();
      if (!response.ok || Number(body.status) >= 400) {
        throw new Error(body.message || "Unable to load the APMC permit report.");
      }
      return body;
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
  const totals = data?.totals || {};
  const headSummary = data?.apmc_head_summary || [];
  const filtersApplied = data?.filters_applied || {};
  const rangeLabel = filtersApplied.from_date_display && filtersApplied.to_date_display
    ? (filtersApplied.from_date_display === filtersApplied.to_date_display
      ? filtersApplied.from_date_display
      : `${filtersApplied.from_date_display} to ${filtersApplied.to_date_display}`)
    : "—";

  const headTotals = headSummary.reduce((acc, row) => {
    acc.item_count += toNumber(row.item_count);
    acc.total_pkt += toNumber(row.total_pkt);
    acc.apmc_qty += toNumber(row.apmc_qty);
    acc.amount += toNumber(row.amount);
    acc.tax_amount += toNumber(row.tax_amount);
    acc.gross_total += toNumber(row.gross_total);
    return acc;
  }, { item_count: 0, total_pkt: 0, apmc_qty: 0, amount: 0, tax_amount: 0, gross_total: 0 });

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const XLSX = await import("xlsx");
      const sheetRows = rows.map((row) => ({
        Date: row.date || "—",
        Particulars: row.particulars || "—",
        "Supplier Invoice No": row.invoice_number || "—",
        "Alt. Units": row.alt_units_display || `${formatQty(row.alt_units)} Qtls`,
        Basic: formatMoney(row.basic),
        "Tax Amount": formatMoney(row.tax_amount),
        "Round Off": formatRoundOff(row.round_off),
        "Gross Total": formatMoney(row.gross_total),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), "APMC Permit Report");
      XLSX.writeFile(workbook, `apmc-permit-report-${fromDate}-${toDate}.xlsx`);
    } catch (downloadError) {
      window.alert(downloadError.message || "Unable to download the APMC permit report.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app-layout bg-[#f4f7fb]">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
      <div className="app-main-content">
        <header className="app-header flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-semibold text-slate-900">APMC Permit Report</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button className="text-white hover:opacity-90" style={headerStyle} onClick={downloadExcel} disabled={downloading || !rows.length}>
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
          <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> From Date</span>
              <Input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> To Date</span>
              <Input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1"><Search className="h-4 w-4" /> Search</span>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Party / invoice / vehicle..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </label>
          </section>

          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

          <Section
            title="APMC Head Summary"
            icon={Layers}
            action={(
              <div className="text-right text-xs text-blue-100">
                <div className="font-semibold">Heads: {headSummary.length}</div>
                <div>Total amount: {formatRupee(headTotals.gross_total)}</div>
                <div>{rangeLabel}</div>
              </div>
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr>
                    {["APMC Head", "Item Count", "Total Pkt", "APMC Qty", "Rate/Qtl", "Amount", "Tax", "Gross"].map((label, index) => (
                      <th key={label} style={headerStyle} className={`px-4 py-3 font-semibold ${index === 0 ? "text-left" : "text-right"}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading APMC permit report...</td></tr>
                  ) : headSummary.length ? headSummary.map((row, index) => (
                    <tr key={row.apmc_head} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                      <td className="border-b px-4 py-2.5 font-medium">{row.apmc_head}</td>
                      <td className="border-b px-4 py-2.5 text-right">{toNumber(row.item_count).toLocaleString("en-IN")}</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatQty(row.total_pkt)}</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatQty(row.apmc_qty)} Qtls</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatRupee(row.rate_qtl)}</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatRupee(row.amount)}</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatRupee(row.tax_amount)}</td>
                      <td className="border-b px-4 py-2.5 text-right font-semibold">{formatRupee(row.gross_total)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No APMC head summary for the selected filters.</td></tr>
                  )}
                </tbody>
                {headSummary.length > 0 && (
                  <tfoot>
                    <tr className="font-semibold" style={totalStyle}>
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right">{headTotals.item_count.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right">{formatQty(headTotals.total_pkt)}</td>
                      <td className="px-4 py-3 text-right">{formatQty(headTotals.apmc_qty)} Qtls</td>
                      <td className="px-4 py-3 text-right text-slate-500">—</td>
                      <td className="px-4 py-3 text-right">{formatRupee(headTotals.amount)}</td>
                      <td className="px-4 py-3 text-right">{formatRupee(headTotals.tax_amount)}</td>
                      <td className="px-4 py-3 text-right">{formatRupee(headTotals.gross_total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Section>

          <Section
            title="APMC Permit Listing"
            icon={FileText}
            action={(
              <div className="text-right text-xs text-blue-100">
                <div className="font-semibold">Vouchers: {toNumber(totals.voucher_count)}</div>
                <div>Total amount: {formatRupee(totals.gross_total)}</div>
                <div>{rangeLabel}</div>
              </div>
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr>
                    {["Date", "Particulars", "Supplier Invoice No", "Alt. Units", "Basic", "Tax Amount", "Round Off", "Gross Total"].map((label, index) => (
                      <th key={label} style={headerStyle} className={`px-4 py-3 font-semibold ${index < 3 ? "text-left" : "text-right"}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading APMC permit report...</td></tr>
                  ) : rows.length ? rows.map((row) => (
                    <tr key={row.inward_entry_id} className="odd:bg-white even:bg-slate-50">
                      <td className="border-b px-4 py-2.5 whitespace-nowrap">{row.date}</td>
                      <td className="max-w-[280px] truncate border-b px-4 py-2.5" title={row.particulars}>{row.particulars}</td>
                      <td className="border-b px-4 py-2.5 whitespace-nowrap">{row.invoice_number || "—"}</td>
                      <td className="border-b px-4 py-2.5 text-right whitespace-nowrap">{row.alt_units_display}</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatMoney(row.basic)}</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatMoney(row.tax_amount)}</td>
                      <td className="border-b px-4 py-2.5 text-right">{formatRoundOff(row.round_off)}</td>
                      <td className="border-b px-4 py-2.5 text-right font-semibold">{formatMoney(row.gross_total)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No purchase invoices found for the selected filters.</td></tr>
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="font-semibold" style={totalStyle}>
                      <td className="px-4 py-3" colSpan={3}>Grand Total</td>
                      <td className="px-4 py-3 text-right">{formatQty(totals.alt_units)} Qtls</td>
                      <td className="px-4 py-3 text-right">{formatMoney(totals.basic)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(totals.tax_amount)}</td>
                      <td className="px-4 py-3 text-right">{formatRoundOff(totals.round_off)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(totals.gross_total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Section>
        </main>
      </div>
      <Loader isLoading={isLoading} text="Loading APMC permit report" />
    </div>
  );
}
