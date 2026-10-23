import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Menu, RefreshCw, Search } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 50;
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
    return { fromDate: toLocalDateString(new Date(end.getFullYear(), end.getMonth(), 1)), toDate: endDate };
  }
  return { fromDate: "", toDate: endDate };
}

function buildQuery(filters, page) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(PAGE_SIZE),
  });
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);
  if (filters.partyId !== "all") params.set("party_id", filters.partyId);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
}

async function readApiResponse(response) {
  const body = await response.json();
  if (!response.ok || Number(body.status) >= 400) {
    throw new Error(body.message || "Unable to load the sales register.");
  }
  return body;
}

export default function SalesRegister() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [period, setPeriod] = useState("till_date");
  const [fromDate, setFromDate] = useState(() => getPeriodRange("till_date").fromDate);
  const [toDate, setToDate] = useState(() => getPeriodRange("till_date").toDate);
  const [partyId, setPartyId] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const token = AuthService.getAccessToken();
  const filters = { fromDate, toDate, partyId, search: debouncedSearch };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [period, fromDate, toDate, partyId, debouncedSearch]);

  const handlePeriodChange = (value) => {
    setPeriod(value);
    if (value !== "custom") {
      const range = getPeriodRange(value);
      setFromDate(range.fromDate);
      setToDate(range.toDate);
    }
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["sales-register", filters, page],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/sales-register/?${buildQuery(filters, page)}`
      );
      return readApiResponse(response);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
  const parties = data?.parties || [];
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};
  const formatAmount = (value) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isMobile && (
                <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <FileText className="h-6 w-6 text-gray-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Sales Register</h1>
                <p className="text-sm text-gray-500">Sales invoices from outward gate pass entries</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1">
                    <Label htmlFor="sales-register-period">Period</Label>
                    <Select value={period} onValueChange={handlePeriodChange}>
                      <SelectTrigger id="sales-register-period">
                        <CalendarDays className="mr-2 h-4 w-4 text-indigo-600" />
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="till_date">Till Date</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sales-register-from">From date</Label>
                    <Input id="sales-register-from" type="date" value={fromDate} onChange={(event) => { setPeriod("custom"); setFromDate(event.target.value); }} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sales-register-to">To date</Label>
                    <Input id="sales-register-to" type="date" value={toDate} onChange={(event) => { setPeriod("custom"); setToDate(event.target.value); }} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sales-register-party">Party</Label>
                    <select
                      id="sales-register-party"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={partyId}
                      onChange={(event) => setPartyId(event.target.value)}
                    >
                      <option value="all">All parties</option>
                      {parties.map((party) => (
                        <option key={party.id} value={party.id}>{party.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sales-register-search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="sales-register-search"
                        className="pl-9"
                        placeholder="Voucher number, party or SO"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error.message}
              </p>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Sales Invoice Vouchers ({summary.total_vouchers || 0})</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">Total amount: {formatAmount(summary.total_amount)}</p>
                </div>
                <span className="text-xs text-gray-500">
                  Page {pagination.current_page || 1} of {pagination.total_pages || 1} · {PAGE_SIZE} per page
                </span>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-y bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Particulars</th>
                      <th className="px-4 py-3 font-medium">Vch Type</th>
                      <th className="px-4 py-3 font-medium">Vch No.</th>
                      <th className="px-4 py-3 font-medium">Tally Sync</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Loading sales invoices...</td></tr>
                    ) : rows.length ? rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3">{row.date ? new Date(`${row.date}T00:00:00`).toLocaleDateString("en-IN") : "—"}</td>
                        <td className="px-4 py-3">{row.party || "—"}</td>
                        <td className="px-4 py-3">{row.voucher_type || "Sales Invoice"}</td>
                        <td className="px-4 py-3 font-medium">{row.voucher_number || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.is_tally_synced ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                            {row.is_tally_synced ? "Synced" : "Not Synced"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatAmount(row.amount)}</td>
                      </tr>
                    )) : !isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                          No sales gate pass entries with loaded items found for these filters. Sales invoice rows use the gate pass bill number unless an invoice bill number was entered. Try widening the period or clearing other filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  {!isLoading && rows.length > 0 && pagination.current_page === pagination.total_pages && (
                    <tfoot className="border-t-2 bg-slate-50 font-semibold text-slate-900">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right">Total for all matching invoices</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatAmount(summary.total_amount)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <CardContent className="flex items-center justify-between border-t py-3">
                <span className="text-sm text-gray-600">
                  Page {pagination.current_page || 1} of {pagination.total_pages || 1}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!pagination.has_previous || isLoading} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={!pagination.has_next || isLoading} onClick={() => setPage((current) => current + 1)}>Next</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <Loader isLoading={isLoading} text="Loading sales register" />
    </div>
  );
}
