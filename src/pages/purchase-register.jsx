import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Download, FileText, Menu, Search } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 50;
const today = new Date();
const LOCAL_TODAY = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function queryString(filters, page, perPage) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);
  if (filters.branchId !== "all") params.set("branch_id", filters.branchId);
  if (filters.party !== "all") params.set("party", filters.party);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
}

async function readApiResponse(response) {
  const body = await response.json();
  if (!response.ok || Number(body.status) >= 400) {
    throw new Error(body.message || "The request could not be completed.");
  }
  return body;
}

export default function PurchaseRegister() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(LOCAL_TODAY);
  const [branchId, setBranchId] = useState("all");
  const [party, setParty] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const token = AuthService.getAccessToken();
  const filters = { fromDate, toDate, branchId, party, search: debouncedSearch };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, branchId, party, debouncedSearch]);

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["purchase-register-branches"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const body = await readApiResponse(response);
      return Array.isArray(body.data) ? body.data : [];
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["purchase-register", filters, page],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/purchase-register/?${queryString(filters, page, PAGE_SIZE)}`
      );
      return readApiResponse(response);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
  const pagination = data?.pagination || {};
  const summary = data?.summary || {};
  const parties = data?.parties || [];

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setBranchId("all");
    setParty("all");
    setSearch("");
  };

  const exportExcel = async () => {
    setIsExporting(true);
    setExportError("");
    try {
      const allRows = [];
      let currentPage = 1;
      let totalPages = 1;
      do {
        const response = await apiRequest(
          "GET",
          `${API_BASE_URL}/api/report/purchase-register/?${queryString(filters, currentPage, 200)}`
        );
        const body = await readApiResponse(response);
        allRows.push(...(body.data || []));
        totalPages = body.pagination?.total_pages || 1;
        currentPage += 1;
      } while (currentPage <= totalPages);

      const worksheetRows = allRows.map((row) => ({
        Date: row.date || "",
        Party: row.party || "",
        "Voucher Type": row.voucher_type || "",
        "Voucher Number": row.voucher_number || "",
        Amount: Number(row.amount || 0),
        "Tally Sync Status": row.is_tally_synced ? "Synced" : "Not Synced",
        Branch: row.branch_name || "",
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Register");
      XLSX.writeFile(workbook, "purchase-register.xlsx");
    } catch (exportException) {
      setExportError(exportException.message || "Unable to export the filtered purchase register.");
    } finally {
      setIsExporting(false);
    }
  };

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
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isMobile && (
                <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <FileText className="h-6 w-6 text-gray-600" />
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Purchase Register</h1>
            </div>
            <Button onClick={exportExcel} disabled={isExporting || isLoading}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-1">
                    <Label htmlFor="purchase-register-from">From date</Label>
                    <Input id="purchase-register-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="purchase-register-to">To date</Label>
                    <Input id="purchase-register-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="purchase-register-branch">Branch</Label>
                    <select
                      id="purchase-register-branch"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={branchId}
                      onChange={(event) => setBranchId(event.target.value)}
                      disabled={branchesLoading}
                    >
                      <option value="all">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name || branch.branch_name || branch.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="purchase-register-party">Party / Supplier</Label>
                    <select
                      id="purchase-register-party"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={party}
                      onChange={(event) => setParty(event.target.value)}
                    >
                      <option value="all">All parties</option>
                      {parties.map((partyName) => (
                        <option key={partyName} value={partyName}>{partyName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="purchase-register-search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="purchase-register-search"
                        className="pl-9"
                        placeholder="Party, voucher number or type"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-600">
                    {summary.total_vouchers || 0} vouchers · {formatAmount(summary.total_amount)}
                  </p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                </div>
              </CardContent>
            </Card>

            {exportError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{exportError}</p>}
            {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="border-b bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Party / Supplier</th>
                      <th className="px-4 py-3 font-medium">Voucher Type</th>
                      <th className="px-4 py-3 font-medium">Voucher Number</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Tally Sync Status</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Loading purchase vouchers...</td></tr>
                    ) : rows.length ? rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3">{row.date ? new Date(`${row.date}T00:00:00`).toLocaleDateString("en-IN") : "—"}</td>
                        <td className="px-4 py-3">{row.party || "—"}</td>
                        <td className="px-4 py-3">{row.voucher_type || "—"}</td>
                        <td className="px-4 py-3">{row.voucher_number || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatAmount(row.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.is_tally_synced ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                            {row.is_tally_synced ? "Synced" : "Not Synced"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.branch_name || "—"}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No purchase invoices found for these filters.</td></tr>
                    )}
                  </tbody>
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
      <Loader isLoading={isLoading} text="Loading purchase register" />
    </div>
  );
}
