import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Download,
  IndianRupee,
  Menu,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 50;

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "salesman", label: "Sales Man" },
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_group", label: "Customer Group" },
  { key: "customer_type", label: "Customer Type" },
  { key: "customer_category", label: "Customer Category" },
  { key: "route_name", label: "Route Name" },
  { key: "bill_no", label: "Bill No." },
  { key: "article_code", label: "Article Code" },
  { key: "product_name", label: "Product Name" },
  { key: "ean_code", label: "Ean Code" },
  { key: "group", label: "Group" },
  { key: "category", label: "Category" },
  { key: "sub_category", label: "Sub Category" },
  { key: "total_qty", label: "Total Qty", align: "right" },
  { key: "total_weight", label: "Total Weight (Kg)", align: "right" },
  { key: "billing_price", label: "Billing Price", align: "right" },
  { key: "total_value", label: "Total Value", align: "right" },
];

function toLocalDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPeriodRange(period) {
  const end = new Date();
  const endDate = toLocalDateString(end);
  if (period === "today") return { fromDate: endDate, toDate: endDate };
  if (period === "this_week") {
    const start = new Date(end);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return { fromDate: toLocalDateString(start), toDate: endDate };
  }
  if (period === "this_month") {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    return { fromDate: toLocalDateString(start), toDate: toLocalDateString(monthEnd) };
  }
  return { fromDate: "", toDate: endDate };
}

function buildQuery(filters, page, sort, exporting) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(exporting ? 10000 : PAGE_SIZE),
    sort: sort.key,
    direction: sort.direction,
  });
  if (exporting) params.set("export", "1");
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
}

async function readApiResponse(response) {
  const body = await response.json();
  if (!response.ok || Number(body.status) >= 400) {
    throw new Error(body.message || "Unable to load the sales master report.");
  }
  return body;
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatQty(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function cellText(row, key) {
  if (key === "date") return formatDate(row.date);
  if (key === "total_qty" || key === "total_weight") return formatQty(row[key]);
  if (key === "billing_price" || key === "total_value") return formatAmount(row[key]);
  return row[key] || "—";
}

export default function SalesMasterReport() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [period, setPeriod] = useState("this_month");
  const [fromDate, setFromDate] = useState(() => getPeriodRange("this_month").fromDate);
  const [toDate, setToDate] = useState(() => getPeriodRange("this_month").toDate);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "date", direction: "desc" });
  const [downloading, setDownloading] = useState(false);
  const token = AuthService.getAccessToken();
  const filters = { fromDate, toDate, search: debouncedSearch };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [period, fromDate, toDate, debouncedSearch, sort.key, sort.direction]);

  const handlePeriodChange = (value) => {
    setPeriod(value);
    if (value !== "custom") {
      const range = getPeriodRange(value);
      setFromDate(range.fromDate);
      setToDate(range.toDate);
    }
  };

  const toggleSort = (key) => {
    setSort((current) => (
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: ["date", "total_value", "billing_price", "total_qty", "total_weight"].includes(key) ? "desc" : "asc" }
    ));
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["sales-master-report", filters, page, sort],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/sales-master-report/?${buildQuery(filters, page, sort, false)}`
      );
      return readApiResponse(response);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/sales-master-report/?${buildQuery(filters, 1, sort, true)}`
      );
      const body = await readApiResponse(response);
      const exportRows = body.data || [];
      const XLSX = await import("xlsx");
      const sheetRows = exportRows.map((row) => {
        const record = {};
        COLUMNS.forEach((column) => {
          record[column.label] = cellText(row, column.key);
        });
        return record;
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), "Sales Master");
      XLSX.writeFile(workbook, `sales-master-report-${fromDate || "start"}-${toDate || "end"}.xlsx`);
    } catch (downloadError) {
      window.alert(downloadError.message || "Unable to download the sales master report.");
    } finally {
      setDownloading(false);
    }
  };

  const cards = [
    { label: "Customers", value: summary.customers ?? 0, icon: Users },
    { label: "Bills", value: summary.bills ?? 0, icon: Receipt },
    { label: "Total Products", value: summary.products ?? 0, icon: Package },
    { label: "Total Value", value: formatAmount(summary.total_value), icon: IndianRupee },
  ];

  return (
    <div className="app-layout bg-[#f4f7fb]">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isMobile && (
                <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Sales Master Report</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="bg-slate-900 text-white hover:bg-slate-800"
                onClick={downloadExcel}
                disabled={downloading || isLoading || !(summary.row_count > 0)}
              >
                <Download className="mr-2 h-4 w-4" />
                {downloading ? "Downloading" : "Download"}
              </Button>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                <span className="ml-2 hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="app-main-scrollable space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm text-slate-500">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{isLoading ? "—" : card.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              );
            })}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="sales-master-period" className="flex items-center gap-1 text-slate-600">
                  <CalendarDays className="h-4 w-4" /> Date range
                </Label>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger id="sales-master-period">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this_week">This week</SelectItem>
                    <SelectItem value="this_month">This month</SelectItem>
                    <SelectItem value="till_date">Till date</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sales-master-from">From date</Label>
                <Input
                  id="sales-master-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) => { setPeriod("custom"); setFromDate(event.target.value); }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sales-master-to">To date</Label>
                <Input
                  id="sales-master-to"
                  type="date"
                  value={toDate}
                  onChange={(event) => { setPeriod("custom"); setToDate(event.target.value); }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sales-master-search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="sales-master-search"
                    className="pl-9"
                    placeholder="Bill no, customer, product, article, EAN"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error.message}
            </p>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">Sales Master Listing</h2>
              <span className="text-sm text-slate-500">{summary.row_count || 0} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2200px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key} className={`px-3 py-3 font-medium ${column.align === "right" ? "text-right" : ""}`}>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 ${column.align === "right" ? "ml-auto" : ""}`}
                          onClick={() => toggleSort(column.key)}
                        >
                          {column.label}
                          {sort.key === column.key ? (
                            sort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5 text-slate-300" />
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">Loading sales lines...</td>
                    </tr>
                  ) : rows.length ? rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      {COLUMNS.map((column) => (
                        <td
                          key={column.key}
                          className={`whitespace-nowrap px-3 py-2.5 text-slate-800 ${column.align === "right" ? "text-right" : ""} ${column.key === "customer_name" || column.key === "product_name" ? "max-w-[220px] truncate" : ""}`}
                          title={cellText(row, column.key)}
                        >
                          {cellText(row, column.key)}
                        </td>
                      ))}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                        No sales order lines found for these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-sm text-slate-600">
                  Page {pagination.current_page || 1} of {pagination.total_pages || 1}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!pagination.has_previous || isLoading} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={!pagination.has_next || isLoading} onClick={() => setPage((current) => current + 1)}>Next</Button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
      <Loader isLoading={isLoading} text="Loading sales master report" />
    </div>
  );
}
