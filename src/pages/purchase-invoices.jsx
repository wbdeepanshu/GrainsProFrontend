import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 20;

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodDates(period) {
  const today = new Date();
  const toDate = dateInputValue(today);
  if (period === "today") return { fromDate: toDate, toDate };
  if (period === "this-month") {
    return {
      fromDate: dateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      toDate,
    };
  }
  if (period === "this-week") {
    const dayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOffset);
    return { fromDate: dateInputValue(monday), toDate };
  }
  return { fromDate: "", toDate: "" };
}

async function parseResponse(response) {
  const body = await response.json();
  if (!response.ok || Number(body.status) >= 400) {
    throw new Error(body.message || body.error || "Could not load purchase invoices.");
  }
  return body;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN");
}

function formatAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatQuantity(value, unit) {
  const quantity = Number(value || 0);
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(quantity)}${unit ? ` ${unit}` : ""}`;
}

export default function PurchaseInvoices() {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { hasPermission } = useUserPermissions();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branchId, setBranchId] = useState("all");
  const [supplierId, setSupplierId] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedVehicles, setExpandedVehicles] = useState({});
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const token = AuthService.getAccessToken();
  const filters = { fromDate, toDate, branchId, supplierId, search: debouncedSearch };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["inward-purchase-invoices", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) });
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (branchId !== "all") params.set("branch_id", branchId);
      if (supplierId !== "all") params.set("party_id", supplierId);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-inward-purchase-invoices/?${params.toString()}`
      );
      return parseResponse(response);
    },
    enabled: !!token,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  const { data: invoiceDetails, isLoading: isLoadingDetails, error: detailsError } = useQuery({
    queryKey: ["inward-purchase-invoice-details", selectedInvoiceId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-inwards/${selectedInvoiceId}/`
      );
      return parseResponse(response);
    },
    enabled: !!selectedInvoiceId && !!token,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
  const pagination = data?.pagination || {};
  const branches = data?.branches || [];
  const suppliers = data?.suppliers || [];

  const vehicleGroups = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const key = row.vehicle_number || "Vehicle not recorded";
      if (!groups.has(key)) {
        groups.set(key, {
          vehicle: key,
          invoices: [],
          parties: new Set(),
          quantitiesByUnit: new Map(),
          weightsByUnit: new Map(),
        });
      }
      const group = groups.get(key);
      group.invoices.push(row);
      group.parties.add(row.supplier_id);
      const quantityUnit = row.quantity_unit || "";
      const weightUnit = row.weight_unit || "";
      group.quantitiesByUnit.set(
        quantityUnit,
        (group.quantitiesByUnit.get(quantityUnit) || 0) + Number(row.quantity || 0)
      );
      group.weightsByUnit.set(
        weightUnit,
        (group.weightsByUnit.get(weightUnit) || 0) + Number(row.weight || 0)
      );
    });
    return Array.from(groups.values());
  }, [rows]);

  const updatePeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") {
      const range = getPeriodDates(nextPeriod);
      setFromDate(range.fromDate);
      setToDate(range.toDate);
    }
    setPage(1);
  };

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setPeriod("all");
    setFromDate("");
    setToDate("");
    setBranchId("all");
    setSupplierId("all");
    setSearch("");
    setPage(1);
  };

  const toggleVehicle = (vehicle) => {
    setExpandedVehicles((current) => ({ ...current, [vehicle]: !current[vehicle] }));
  };

  const openInvoice = (id) => setSelectedInvoiceId(id);

  const closeInvoice = (open) => {
    if (!open) setSelectedInvoiceId(null);
  };

  const items = invoiceDetails?.items || [];
  const entry = invoiceDetails?.data || {};
  const invoicedItems = items.filter((item) => item.status === "invoice_created");
  const canCreatePurchaseReturn = hasPermission("purchase_return", "create");

  return (
    <div className="app-layout bg-slate-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header flex items-center justify-between border-b bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {isMobile && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Open menu"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Purchase Invoice</h1>
              <p className="text-sm text-slate-500">Inward invoices linked to unloading</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        <main className="app-main-scrollable space-y-5 p-4 sm:p-6">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-period">Period</Label>
                <select
                  id="invoice-period"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={period}
                  onChange={(event) => updatePeriod(event.target.value)}
                >
                  <option value="all">All dates</option>
                  <option value="today">Today</option>
                  <option value="this-week">This week</option>
                  <option value="this-month">This month</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-from-date">From Date</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="invoice-from-date"
                    type="date"
                    className="pl-9"
                    value={fromDate}
                    onChange={(event) => {
                      setPeriod("custom");
                      setFromDate(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-to-date">To Date</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="invoice-to-date"
                    type="date"
                    className="pl-9"
                    value={toDate}
                    onChange={(event) => {
                      setPeriod("custom");
                      setToDate(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-branch">Branch</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    id="invoice-branch"
                    className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                    value={branchId}
                    onChange={updateFilter(setBranchId)}
                  >
                    <option value="all">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-supplier">Supplier</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    id="invoice-supplier"
                    className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                    value={supplierId}
                    onChange={updateFilter(setSupplierId)}
                  >
                    <option value="all">All Suppliers</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="invoice-search"
                    className="pl-9"
                    placeholder="Invoice, inward, PO, vehicle"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-end justify-end md:col-span-2 xl:col-span-6">
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error.message}
            </div>
          )}

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-5 w-5 text-indigo-600" />
                Invoice Entries ({pagination.total_count || 0})
                {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Vehicle Number</th>
                    <th className="px-5 py-3 font-medium">Parties</th>
                    <th className="px-5 py-3 font-medium">Qty</th>
                    <th className="px-5 py-3 font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-500">Loading purchase invoices...</td></tr>
                  ) : vehicleGroups.length ? vehicleGroups.map((group) => {
                    const isExpanded = expandedVehicles[group.vehicle] ?? true;
                    return (
                      <Fragment key={group.vehicle}>
                        <tr
                          className="cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70"
                          onClick={() => toggleVehicle(group.vehicle)}
                        >
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            <span className="inline-flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {group.vehicle}
                            </span>
                          </td>
                          <td className="px-5 py-3">{group.parties.size} {group.parties.size === 1 ? "party" : "parties"}</td>
                          <td className="px-5 py-3 font-medium">
                            {Array.from(group.quantitiesByUnit, ([unit, quantity]) => formatQuantity(quantity, unit)).join(", ")}
                          </td>
                          <td className="px-5 py-3 font-medium">
                            {Array.from(group.weightsByUnit, ([unit, weight]) => formatQuantity(weight, unit)).join(", ")}
                          </td>
                        </tr>
                        {isExpanded && (
                          <>
                            <tr className="bg-slate-50 text-slate-600">
                              <th className="px-5 py-2.5 font-medium">Invoice No / References</th>
                              <th className="px-5 py-2.5 font-medium">Party</th>
                              <th className="px-5 py-2.5 font-medium">Date / Unloading</th>
                              <th className="px-5 py-2.5 font-medium">Tally Sync / Actions</th>
                            </tr>
                            {group.invoices.map((invoice) => (
                              <tr key={invoice.id} className="hover:bg-slate-50">
                                <td className="px-5 py-3">
                                  <div className="font-semibold text-slate-900">{invoice.invoice_number || "—"}</div>
                                  <div className="mt-1 text-xs text-slate-500">Inward {invoice.inward_number || "—"}</div>
                                  <div className="text-xs text-slate-500">PO {invoice.purchase_order_number || "—"}</div>
                                </td>
                                <td className="px-5 py-3">
                                  <div>{invoice.supplier_name || "—"}</div>
                                  <div className="mt-1 text-xs text-slate-500">{invoice.branch_name || "—"}</div>
                                </td>
                                <td className="px-5 py-3">
                                  <div>{formatDate(invoice.date)}</div>
                                  <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                    {invoice.unloading_status}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Sync unavailable</span>
                                    <div className="flex shrink-0 gap-2">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label={`View invoice ${invoice.invoice_number}`}
                                        onClick={() => openInvoice(invoice.id)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      {canCreatePurchaseReturn && invoice.purchase_order_id && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setLocation(`/add-purchase-return?purchase_order_id=${invoice.purchase_order_id}`)}
                                        >
                                          <Plus className="mr-1 h-4 w-4" />
                                          Add Return
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </Fragment>
                    );
                  }) : (
                    <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-500">No purchase invoices match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <CardContent className="flex items-center justify-between border-t py-3">
              <p className="text-sm text-slate-500">
                Page {pagination.current_page || 1} of {pagination.total_pages || 1}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_previous || isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_next || isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={!!selectedInvoiceId} onOpenChange={closeInvoice}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Invoice Details</DialogTitle>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : detailsError ? (
            <p role="alert" className="text-sm text-red-600">{detailsError.message}</p>
          ) : invoiceDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-4">
                <div><p className="text-slate-500">Invoice No</p><p className="font-medium">{entry.invoice_number || "—"}</p></div>
                <div><p className="text-slate-500">Supplier</p><p className="font-medium">{entry.party_name || "—"}</p></div>
                <div><p className="text-slate-500">Inward No</p><p className="font-medium">{entry.sl_no || "—"}</p></div>
                <div><p className="text-slate-500">Vehicle</p><p className="font-medium">{entry.vehicle_no || "—"}</p></div>
                <div><p className="text-slate-500">Date</p><p className="font-medium">{entry.date || "—"}</p></div>
                <div><p className="text-slate-500">Purchase Order</p><p className="font-medium">{entry.purchase_order_no || "—"}</p></div>
                <div><p className="text-slate-500">Bill Ref</p><p className="font-medium">{entry.bill_no || "—"}</p></div>
                <div><p className="text-slate-500">Additional Payment</p><p className="font-medium">{formatAmount(entry.additional_payment)}</p></div>
              </div>
              {detailsError && <p role="alert" className="text-sm text-red-600">{detailsError.message}</p>}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Quantity</th>
                      <th className="px-4 py-3 font-medium">Weight</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoicedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{item.item_name || "—"}</td>
                        <td className="px-4 py-3">{formatQuantity(item.number_of_bags, item.base_unit || item.unit)}</td>
                        <td className="px-4 py-3">{formatQuantity(item.total_weight, item.alternate_unit || item.unit)}</td>
                        <td className="px-4 py-3 text-right">{formatAmount(item.billed_amount)}</td>
                      </tr>
                    ))}
                    {!invoicedItems.length && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No invoiced lines were found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedInvoiceId(null);
                    setLocation(`/reports/inward-list?search=${encodeURIComponent(entry.sl_no || "")}`);
                  }}
                >
                  Open Inward Entry
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Loader isLoading={isLoading} text="Loading purchase invoices" />
    </div>
  );
}
