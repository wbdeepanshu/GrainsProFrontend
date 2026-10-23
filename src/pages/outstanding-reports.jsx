import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Menu,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  Eye,
  Users,
  Wallet,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatAmount(amount) {
  if (amount == null || amount === "") return "-";
  const n = Number(amount);
  return isNaN(n) ? amount : `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function OutstandingReports() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState("");
  const [selectedLedgerName, setSelectedLedgerName] = useState("");
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [ledgerDropdownOpen, setLedgerDropdownOpen] = useState(false);
  const debouncedLedgerSearch = useDebounce(ledgerSearchTerm, 500);
  const [billNumberFilter, setBillNumberFilter] = useState("");
  const [amountMinFilter, setAmountMinFilter] = useState("");
  const [amountMaxFilter, setAmountMaxFilter] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [detailsRow, setDetailsRow] = useState(null);
  const isMobile = useIsMobile();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canView = hasPermission("ledgers_account", "read");

  const { data: ledgersData, isLoading: isLoadingLedgers } = useQuery({
    queryKey: ["ledgers-outstanding-list", debouncedLedgerSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ ledgers_only: "1" });
      if (debouncedLedgerSearch && debouncedLedgerSearch.trim()) {
        params.append("search", debouncedLedgerSearch.trim());
      }
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/get-ledgers-outstanding/?${params.toString()}`
      );
      const json = await response.json();
      if (json.status !== 200) throw new Error(json.message || "Failed to fetch ledgers");
      return json.data;
    },
    enabled: !!AuthService.getAccessToken() && canView && ledgerDropdownOpen,
    refetchOnWindowFocus: false,
  });
  const ledgersList = ledgersData?.ledgers || [];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "ledgers-outstanding",
      currentPage,
      perPage,
      ledgerFilter,
      billNumberFilter,
      amountMinFilter,
      amountMaxFilter,
      sortBy,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
      });
      if (ledgerFilter) params.append("ledger_id", ledgerFilter);
      if (billNumberFilter) params.append("bill_number", billNumberFilter);
      if (amountMinFilter) params.append("amount_min", amountMinFilter);
      if (amountMaxFilter) params.append("amount_max", amountMaxFilter);
      if (sortBy) params.append("sort", sortBy);
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/get-ledgers-outstanding/?${params.toString()}`
      );
      const json = await response.json();
      if (json.status !== 200) throw new Error(json.message || "Failed to fetch");
      return json.data;
    },
    enabled: !!AuthService.getAccessToken() && canView,
    refetchOnWindowFocus: true,
  });

  const applyFilters = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setLedgerFilter("");
    setSelectedLedgerName("");
    setBillNumberFilter("");
    setAmountMinFilter("");
    setAmountMaxFilter("");
    setSortBy("");
    setCurrentPage(1);
  };

  const pagination = data?.pagination || {};
  const customers = data?.customers || [];
  const totalPages = pagination.total_pages || 1;
  const totalItems = pagination.total_count ?? 0;
  const startItem = totalItems > 0 ? (pagination.page - 1) * (pagination.per_page || perPage) + 1 : 0;
  const endItem = Math.min((pagination.page || 1) * (pagination.per_page || perPage), totalItems);

  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  if (permissionsLoading) {
    return <Loader text="Loading permissions..." />;
  }

  if (!canView) {
    return (
      <div className="flex h-screen bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <h1 className="text-2xl font-bold text-gray-900">Outstanding Reports</h1>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
            <Card className="max-w-md w-full">
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <AlertCircle className="h-12 w-12 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Access denied</h2>
                <p className="text-sm text-gray-600">
                  You need read permission for Ledgers Account to view this report.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const summaryTiles = data?.summary
    ? [
        {
          label: "Total customers",
          value: Number(data.summary.total_customers ?? 0).toLocaleString("en-IN"),
          icon: Users,
          tone: "bg-blue-50 text-blue-600",
        },
        {
          label: "Total amount",
          value: formatAmount(data.summary.total_amount),
          icon: Wallet,
          tone: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Total bills",
          value: Number(data.summary.total_bills ?? 0).toLocaleString("en-IN"),
          icon: FileText,
          tone: "bg-amber-50 text-amber-600",
        },
      ]
    : [];

  const labelClass = "text-xs font-medium text-slate-600";
  const thClass = "h-10 px-4 text-xs font-medium text-slate-500";
  const tdClass = "px-4 py-2.5";

  return (
    <div className="flex h-screen bg-slate-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex flex-shrink-0 items-center gap-3 border-b bg-white px-4 py-3 sm:px-6">
          {isMobile && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Open menu"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">Outstanding Reports</h1>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">

            {/* Summary section – only from API */}
            {!isLoading && summaryTiles.length > 0 && (
              <Card className="overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {summaryTiles.map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3">
                      <div className={`rounded-md p-2 ${tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="truncate text-xl font-semibold leading-tight tabular-nums text-slate-900">
                          {value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Filter section */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-600" />
                    <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => refetch()}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Refresh
                    </Button>
                    <Button variant="outline" size="sm" className="h-8" onClick={clearFilters}>
                      Clear all
                    </Button>
                    <Button variant="default" size="sm" className="h-8" onClick={applyFilters}>
                      Apply filters
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0 space-y-1.5">
                    <Label className={labelClass}>Ledger</Label>
                    <Popover
                      open={ledgerDropdownOpen}
                      onOpenChange={(open) => {
                        setLedgerDropdownOpen(open);
                        if (!open) setLedgerSearchTerm("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={ledgerDropdownOpen}
                          className="h-9 w-full justify-between px-3 font-normal"
                        >
                          <span className="truncate">
                            {ledgerFilter ? (selectedLedgerName || `Ledger #${ledgerFilter}`) : "All ledgers"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search ledger..."
                            value={ledgerSearchTerm}
                            onValueChange={setLedgerSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {isLoadingLedgers ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Loading ledgers...
                                </div>
                              ) : (ledgerSearchTerm && ledgerSearchTerm.trim().length > 0) ? (
                                "No ledgers found. Try a different search."
                              ) : (
                                "Type to search ledgers"
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__all__"
                                onSelect={() => {
                                  setLedgerFilter("");
                                  setSelectedLedgerName("");
                                  setCurrentPage(1);
                                  setLedgerDropdownOpen(false);
                                  setLedgerSearchTerm("");
                                }}
                                className="cursor-pointer"
                              >
                                <Check className={`mr-2 h-4 w-4 ${!ledgerFilter ? "opacity-100 text-blue-600" : "opacity-0"}`} />
                                All ledgers
                              </CommandItem>
                              <ScrollArea className="h-48">
                                {ledgersList.map((l) => (
                                  <CommandItem
                                    key={l.ledger_id}
                                    value={`${l.ledger_id}-${l.ledger_name}`}
                                    onSelect={() => {
                                      setLedgerFilter(String(l.ledger_id));
                                      setSelectedLedgerName(l.ledger_name);
                                      setCurrentPage(1);
                                      setLedgerDropdownOpen(false);
                                      setLedgerSearchTerm("");
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 shrink-0 ${
                                        ledgerFilter === String(l.ledger_id) ? "opacity-100 text-blue-600" : "opacity-0"
                                      }`}
                                    />
                                    <span className="truncate">{l.ledger_name}</span>
                                  </CommandItem>
                                ))}
                              </ScrollArea>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Bill number</Label>
                    <Input
                      className="h-9"
                      placeholder="Filter by bill number"
                      value={billNumberFilter}
                      onChange={(e) => setBillNumberFilter(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Amount range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Min"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountMinFilter}
                        onChange={(e) => setAmountMinFilter(e.target.value)}
                        className="h-9 w-full"
                      />
                      <span className="shrink-0 text-xs text-slate-400">to</span>
                      <Input
                        placeholder="Max"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountMaxFilter}
                        onChange={(e) => setAmountMaxFilter(e.target.value)}
                        className="h-9 w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Sort by</Label>
                    <Select value={sortBy || "none"} onValueChange={(v) => setSortBy(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Default (Ledger name)</SelectItem>
                        <SelectItem value="total_amount">Total amount: Low to High</SelectItem>
                        <SelectItem value="-total_amount">Total amount: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="flex items-center gap-2 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error.message}
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <Card className="overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className={thClass}>Ledger name</TableHead>
                          <TableHead className={thClass}>Ledger group</TableHead>
                          <TableHead className={`${thClass} text-right`}>Bills count</TableHead>
                          <TableHead className={`${thClass} text-right`}>Total amount</TableHead>
                          <TableHead className={`${thClass} text-right`}>Last synced</TableHead>
                          <TableHead className={`${thClass} w-[140px] text-center`}>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="px-4 py-10 text-center text-slate-500">
                              <p className="font-medium text-slate-900">No outstanding data</p>
                              <p className="mx-auto mt-1 max-w-xl text-sm">
                                Go to <strong>Import Data</strong> → <strong>Import Outstanding</strong> to fetch bills receivable from Tally. After sync completes, this list will show ledger-wise outstanding and bill details.
                              </p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          customers.map((row) => (
                            <TableRow key={row.outstanding_id}>
                              <TableCell className={`${tdClass} font-medium text-slate-900`}>{row.ledger_name}</TableCell>
                              <TableCell className={`${tdClass} text-slate-700`}>{row.ledger_group}</TableCell>
                              <TableCell className={`${tdClass} text-right tabular-nums`}>{row.bills_count}</TableCell>
                              <TableCell className={`${tdClass} whitespace-nowrap text-right font-medium tabular-nums`}>
                                {formatAmount(row.total_amount)}
                              </TableCell>
                              <TableCell className={`${tdClass} whitespace-nowrap text-right text-sm text-slate-600`}>
                                {row.last_synced}
                              </TableCell>
                              <TableCell className={`${tdClass} text-center`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 px-2.5"
                                  onClick={() => setDetailsRow(row)}
                                  disabled={!row.bills || row.bills.length === 0}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && totalItems > 0 && (
                    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
                      <div className="text-sm text-slate-600">
                        Showing <span className="font-semibold text-slate-900">{startItem}</span> to{" "}
                        <span className="font-semibold text-slate-900">{endItem}</span> of{" "}
                        <span className="font-semibold text-slate-900">{totalItems}</span> ledgers
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => handlePageChange((pagination.page || 1) - 1)}
                          disabled={!pagination.has_previous || isLoading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        {getPageNumbers(pagination.page || 1, totalPages).map((page, idx) =>
                          page === "..." ? (
                            <span key={`pagination-ellipsis-${idx}`} className="px-1.5 text-slate-400">…</span>
                          ) : (
                            <Button
                              key={`pagination-${idx}-${page}`}
                              variant={(pagination.page || 1) === page ? "default" : "outline"}
                              size="sm"
                              className="h-8 min-w-8 px-2.5"
                              onClick={() => handlePageChange(page)}
                              disabled={isLoading}
                            >
                              {page}
                            </Button>
                          )
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => handlePageChange((pagination.page || 1) + 1)}
                          disabled={!pagination.has_next || isLoading}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <Dialog open={!!detailsRow} onOpenChange={(open) => !open && setDetailsRow(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-3 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Bill details – {detailsRow?.ledger_name}
            </DialogTitle>
          </DialogHeader>

          {detailsRow?.bills?.length ? (
            <div className="flex flex-col gap-1 rounded-md border bg-slate-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-700">
                <span className="font-semibold">{detailsRow.bills.length}</span> bills
              </div>
              <div className="text-sm text-slate-700">
                <span className="mr-1 text-slate-500">Total amount:</span>
                <span className="font-semibold tabular-nums">
                  {formatAmount(
                    detailsRow.bills.reduce(
                      (sum, bill) => sum + (Number(bill.amount) || 0),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-auto rounded-md border">
            {detailsRow?.bills?.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className={thClass}>Bill #</TableHead>
                    <TableHead className={`${thClass} text-right`}>Amount</TableHead>
                    <TableHead className={thClass}>Bill date</TableHead>
                    <TableHead className={thClass}>Due date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsRow.bills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className={`${tdClass} font-medium text-slate-900`}>{bill.bill_number}</TableCell>
                      <TableCell className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>{formatAmount(bill.amount)}</TableCell>
                      <TableCell className={`${tdClass} whitespace-nowrap text-slate-600`}>{bill.bill_date}</TableCell>
                      <TableCell className={`${tdClass} whitespace-nowrap text-slate-600`}>{bill.due_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No bills.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Loader isLoading={isLoading} text="Loading outstanding reports" />
    </div>
  );
}