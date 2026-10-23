import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { X, Settings, Menu, Plus, Search, Eye, Edit3, Calendar, CalendarIcon, FileText, User, IndianRupee, Package, Filter, Users, CheckSquare, Square, Clock, CheckCircle, XCircle, Building, Truck, ChevronsUpDown, Check } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const getStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "bg-green-100 text-green-800 border-green-300";
  if (normalized === "partially_completed") return "bg-blue-100 text-blue-800 border-blue-300";
  if (normalized === "cancelled" || normalized === "rejected") return "bg-red-100 text-red-800 border-red-300";
  return "bg-yellow-100 text-yellow-800 border-yellow-300";
};

const getStatusIcon = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "partially_completed") return <CheckCircle className="h-3.5 w-3.5" />;
  if (normalized === "cancelled" || normalized === "rejected") return <XCircle className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

const COLUMN_DEFS = [
  { key: "voucher", label: "Voucher no.", cellClass: "whitespace-nowrap font-medium text-slate-900" },
  { key: "po", label: "PO", cellClass: "whitespace-nowrap" },
  { key: "party", label: "Party", cellClass: "max-w-[260px]" },
  { key: "items", label: "Items", align: "right", cellClass: "text-right tabular-nums" },
  { key: "amount", label: "Amount", align: "right", cellClass: "whitespace-nowrap text-right font-medium tabular-nums" },
  { key: "status", label: "Status", cellClass: "" },
  { key: "tally", label: "Tally", requiresTally: true, cellClass: "" },
  { key: "createdBy", label: "Created by", cellClass: "whitespace-nowrap" },
  { key: "date", label: "Date", cellClass: "whitespace-nowrap text-slate-600" },
];
const DEFAULT_VISIBLE_COLUMNS = ["voucher", "party", "amount", "status", "tally", "date"];
const COLUMN_STORAGE_KEY = "purchase-return-visible-columns";

const loadVisibleColumns = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || "null");
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((key) => COLUMN_DEFS.some((col) => col.key === key));
      if (valid.length) return valid;
    }
  } catch {
    // ignore unreadable storage and fall back to defaults
  }
  return DEFAULT_VISIBLE_COLUMNS;
};

export default function PurchaseReturnReports() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedParty, setSelectedParty] = useState("all");
  const [partyFilterOpen, setPartyFilterOpen] = useState(false);
  const [partyFilterSearch, setPartyFilterSearch] = useState("");
  const [debouncedPartyFilterSearch, setDebouncedPartyFilterSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfDay(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfDay(now), "yyyy-MM-dd"));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [selectedReturns, setSelectedReturns] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead =
    hasPermission("purchase_return", "read") || hasPermission("purchase_order", "read");
  const canCreate =
    hasPermission("purchase_return", "create") ||
    hasPermission("purchase_return", "read") ||
    hasPermission("purchase_order", "create") ||
    hasPermission("purchase_order", "read");
  const canUpdate =
    hasPermission("purchase_return", "update") ||
    hasPermission("purchase_order", "update") ||
    hasPermission("purchase_order", "read");
  const canCreateOutward = hasPermission("outward", "create");

  const userData = AuthService.getUserData();
  const rawTallyEnabled =
    userData?.is_tally_enabled ??
    userData?.user_info?.is_tally_enabled ??
    userData?.organization?.is_tally_enabled;
  const isTallyEnabled = !(
    rawTallyEnabled === false ||
    rawTallyEnabled === 0 ||
    rawTallyEnabled === "0" ||
    rawTallyEnabled === "false" ||
    rawTallyEnabled === "False"
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.append("search", search.trim());
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (selectedParty !== "all") params.append("party_id", selectedParty);
    if (selectedBranchId !== "all") params.append("branch_id", selectedBranchId);
    if (fromDate) params.append("start_date", fromDate);
    if (toDate) params.append("end_date", toDate);
    params.append("new_page", String(currentPage));
    params.append("per_page", "20");
    return params.toString();
  }, [search, statusFilter, selectedParty, selectedBranchId, fromDate, toDate, currentPage]);

  useEffect(() => {
    const n = new Date();
    if (dateRangePreset === "today") {
      setFromDate(format(startOfDay(n), "yyyy-MM-dd"));
      setToDate(format(endOfDay(n), "yyyy-MM-dd"));
    } else if (dateRangePreset === "weekly") {
      setFromDate(format(startOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setToDate(format(endOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (dateRangePreset === "monthly") {
      setFromDate(format(startOfMonth(n), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(n), "yyyy-MM-dd"));
    }
  }, [dateRangePreset]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedPartyFilterSearch(partyFilterSearch);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [partyFilterSearch]);

  const { data: partiesData = [] } = useQuery({
    queryKey: ["purchase-return-parties-filter"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/report/get-ledgers/?per_page=1000&is_supplier=true`);
      const json = await res.json();
      return json?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
  });

  const { data: branchesData = [] } = useQuery({
    queryKey: ["purchase-return-branches-filter"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const json = await res.json();
      return json?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["purchase-return-list", queryParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/voucher/purchase-return-orders/?${queryParams}`);
      return res.json();
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["purchase-return-detail-modal", selectedId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/voucher/purchase-return-orders/${selectedId}/`);
      return res.json();
    },
    enabled: !!selectedId && isDetailOpen,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
  const pagination = data?.pagination || {};
  const apiSummary = data?.summary || {};
  const summary = {
    totalRows: apiSummary.total_returns ?? data?.total_count ?? 0,
    totalAmount: apiSummary.total_amount ?? 0,
    completed: apiSummary.completed_returns ?? 0,
    pending: apiSummary.pending_returns ?? 0,
    totalParties: apiSummary.unique_parties ?? 0,
  };

  const getBranchId = (row) =>
    row?.branch_id?.toString?.() ||
    row?.branch?.id?.toString?.() ||
    row?.branch?.branch_id?.toString?.() ||
    "";

  const getBranchName = (row) =>
    row?.branch_name ||
    row?.branch?.name ||
    row?.branch?.branch_name ||
    row?.branch ||
    "";

  const getCreatedBy = (row) =>
    row?.created_by_name ||
    row?.created_by ||
    row?.creator_name ||
    row?.entered_by ||
    "";

  const getItemName = (row) => {
    if (row?.item_name) return row.item_name;
    if (row?.stock_item_name) return row.stock_item_name;
    if (Array.isArray(row?.items) && row.items.length > 0) {
      return row.items
        .map((item) => item?.stock_item_name || item?.item_name || item?.name || "")
        .filter(Boolean)
        .join(", ");
    }
    return "";
  };

  const branchOptions = useMemo(() => {
    const map = new Map();
    branchesData.forEach((branch) => {
      const id = branch?.id?.toString?.();
      const name = branch?.name || branch?.branch_name || "";
      if (id && name) map.set(id, name);
    });
    rows.forEach((row) => {
      const id = getBranchId(row);
      const name = getBranchName(row);
      if (id && name && !map.has(id)) map.set(id, name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [branchesData, rows]);

  const filteredParties = useMemo(() => {
    const term = debouncedPartyFilterSearch.trim().toLowerCase();
    const sorted = [...partiesData].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
    if (!term) return sorted;
    return sorted.filter((party) => (party.name || "").toLowerCase().includes(term));
  }, [partiesData, debouncedPartyFilterSearch]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => {
      const branchName = getBranchName(row);

      const branchMatches =
        selectedBranchId === "all" ||
        getBranchId(row) === selectedBranchId ||
        branchName.toLowerCase() ===
          (branchOptions.find((branch) => branch.id === selectedBranchId)?.name || "").toLowerCase();

      const searchMatches =
        !normalizedSearch ||
        [
          row?.voucher_number,
          row?.purchase_order_voucher,
          row?.party_name,
          row?.remarks,
          row?.status,
          getCreatedBy(row),
          getItemName(row),
          branchName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return branchMatches && searchMatches;
    });
  }, [rows, selectedBranchId, branchOptions, search]);

  const allSelected = filteredRows.length > 0 && selectedReturns.size === filteredRows.length;

  const handleRowSelect = (id) => {
    setSelectedReturns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedReturns(new Set());
      return;
    }
    setSelectedReturns(new Set(filteredRows.map((row) => row.id)));
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="flex-1 flex items-center justify-center"><Loader /></div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">You don't have permission to view purchase return.</p>
            <Button onClick={() => window.history.back()} variant="outline">Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  const summaryTiles = [
    { label: "Total parties", value: summary.totalParties, icon: Users, tone: "bg-blue-50 text-blue-600" },
    {
      label: "Total amount",
      value: `₹${Number(summary.totalAmount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      icon: IndianRupee,
      tone: "bg-green-50 text-green-600",
    },
    { label: "Total returns", value: summary.totalRows, icon: Package, tone: "bg-purple-50 text-purple-600" },
    { label: "Completed returns", value: summary.completed, icon: FileText, tone: "bg-orange-50 text-orange-600" },
  ];

  const labelClass = "text-xs font-medium text-slate-600";
  const thClass = "h-10 whitespace-nowrap px-4 text-xs font-medium text-slate-500";
  const tdClass = "px-4 py-2.5";
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
  const dash = <span className="text-slate-400">—</span>;

  const availableColumns = COLUMN_DEFS.filter((col) => !col.requiresTally || isTallyEnabled);
  const activeColumns = availableColumns.filter((col) => visibleColumns.includes(col.key));

  const saveVisibleColumns = (next) => {
    setVisibleColumns(next);
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable; the choice still applies for this session
    }
  };

  const toggleColumn = (key) => {
    const isVisible = visibleColumns.includes(key);
    if (isVisible && activeColumns.length === 1) return;
    saveVisibleColumns(
      COLUMN_DEFS.map((col) => col.key).filter((k) => (k === key ? !isVisible : visibleColumns.includes(k))),
    );
  };

  const renderCell = (key, row) => {
    switch (key) {
      case "voucher":
        return row.voucher_number || dash;
      case "po":
        return row.purchase_order_voucher || dash;
      case "party":
        return (
          <span className="block truncate text-slate-900" title={row.party_name || undefined}>
            {row.party_name || dash}
          </span>
        );
      case "items":
        return row.items_count || row.items?.length || dash;
      case "amount":
        return currencyFormatter.format(Number(row.amount) || 0);
      case "status":
        return (
          <Badge
            variant="outline"
            className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${getStatusClass(row.status)}`}
          >
            {getStatusIcon(row.status)}
            <span className="capitalize">{String(row.status || "unknown").replaceAll("_", " ")}</span>
          </Badge>
        );
      case "tally":
        return (
          <Badge
            variant="outline"
            className={`whitespace-nowrap text-xs ${
              row.is_tally_synced
                ? "border-green-300 bg-green-100 text-green-800"
                : "border-gray-300 bg-gray-100 text-gray-700"
            }`}
          >
            {row.is_tally_synced ? "Synced" : "Not Synced"}
          </Badge>
        );
      case "createdBy":
        return row.created_by || row.created_by_name || dash;
      case "date":
        return row.created_at
          ? new Date(row.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
          : dash;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
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
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">Purchase Return</h1>
              <p className="truncate text-sm text-slate-500">Listing and quick actions</p>
            </div>
          </div>
          {canCreate && (
            <Button
              size="sm"
              className="h-9 shrink-0 gap-2"
              aria-label="Add purchase return"
              onClick={() => (window.location.href = "/add-purchase-return")}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Purchase Return</span>
            </Button>
          )}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto w-full max-w-[1500px] space-y-4 p-4 sm:p-6">
          {/* Summary */}
          <Card className="overflow-hidden shadow-sm">
            <div className="grid grid-cols-2 gap-px bg-slate-200 lg:grid-cols-4">
              {summaryTiles.map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="flex min-w-0 items-center gap-3 bg-white px-4 py-3">
                  <div className={`shrink-0 rounded-md p-2 ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-500">{label}</p>
                    <p className="truncate text-xl font-semibold leading-tight tabular-nums text-slate-900">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4 text-slate-600" />
                <span>Filters &amp; Search</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dateRangePreset" className={labelClass}>
                    Date Range
                  </Label>
                  <Select value={dateRangePreset} onValueChange={(v) => { setDateRangePreset(v); setCurrentPage(1); }}>
                    <SelectTrigger id="dateRangePreset" className="h-9"><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="weekly">Weekly (Mon-Sun)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fromDate" className={labelClass}>From Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, from: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={dateRangePreset !== "custom"}
                        className={`h-9 w-full justify-start text-left font-normal ${
                          dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "From Date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`from-${fromDate || "null"}`}
                        mode="single"
                        selected={fromDate ? new Date(fromDate) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          const iso = format(startOfDay(date), "yyyy-MM-dd");
                          setFromDate(iso);
                          if (toDate && iso > toDate) {
                            setToDate(iso);
                          }
                          setCurrentPage(1);
                          setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                        }}
                        disabled={{ after: new Date() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="toDate" className={labelClass}>To Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, to: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={dateRangePreset !== "custom"}
                        className={`h-9 w-full justify-start text-left font-normal ${
                          dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {toDate ? format(new Date(toDate), "dd-MM-yyyy") : "To Date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`to-${toDate || "null"}`}
                        mode="single"
                        selected={toDate ? new Date(toDate) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          const iso = format(endOfDay(date), "yyyy-MM-dd");
                          setToDate(iso);
                          setCurrentPage(1);
                          setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                        }}
                        disabled={[
                          fromDate ? { before: new Date(fromDate) } : null,
                          { after: new Date() },
                        ].filter(Boolean)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Party (Ledger)</Label>
                  <Popover
                    open={partyFilterOpen}
                    onOpenChange={(open) => {
                      setPartyFilterOpen(open);
                      if (!open) setPartyFilterSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={partyFilterOpen}
                        className="w-full justify-between h-9 font-normal"
                      >
                        <span className="truncate">
                          {selectedParty === "all"
                            ? "All Parties"
                            : partiesData.find((p) => String(p.id) === selectedParty)?.name || "Select party"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[max(20rem,var(--radix-popover-trigger-width))] max-w-[min(32rem,95vw)] p-0 z-50"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search parties..."
                          value={partyFilterSearch}
                          onValueChange={setPartyFilterSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {partiesData.length === 0
                              ? "No parties found."
                              : "No parties match your search."}
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              <CommandItem
                                value="All Parties"
                                onSelect={() => {
                                  setSelectedParty("all");
                                  setCurrentPage(1);
                                  setPartyFilterOpen(false);
                                  setPartyFilterSearch("");
                                }}
                                className="flex items-start cursor-pointer hover:bg-gray-50 px-3 py-2"
                              >
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <Check
                                    className={`mt-0.5 h-4 w-4 shrink-0 ${selectedParty === "all" ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                  />
                                  <div className="font-medium text-gray-900">All Parties</div>
                                </div>
                              </CommandItem>
                              {filteredParties.map((party) => (
                                <CommandItem
                                  key={party.id}
                                  value={party.name}
                                  onSelect={() => {
                                    setSelectedParty(String(party.id));
                                    setCurrentPage(1);
                                    setPartyFilterOpen(false);
                                    setPartyFilterSearch("");
                                  }}
                                  className="flex items-start cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <Check
                                      className={`mt-0.5 h-4 w-4 shrink-0 ${selectedParty === String(party.id) ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-gray-900 leading-snug">{party.name}</div>
                                    </div>
                                  </div>
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
                  <Label className={labelClass}>Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-9">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-gray-500" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partially_completed">Partially Completed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Branch</Label>
                  <Select value={selectedBranchId} onValueChange={(v) => { setSelectedBranchId(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branchOptions.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 lg:col-span-3">
                  <Label className={labelClass}>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-9 pl-9 pr-9"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                      placeholder="Search by voucher number, party name, reference..."
                    />
                    {search && (
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                        onClick={() => {
                          setSearch("");
                          setCurrentPage(1);
                          refetch();
                        }}
                      >
                        <span className="sr-only">Clear search</span>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listing */}
          <Card className="overflow-hidden shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Purchase Return
                <span className="ml-1.5 text-sm font-normal tabular-nums text-slate-500">({filteredRows.length})</span>
              </h2>
            </div>

            {filteredRows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                No purchase return orders found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="h-10 w-10 px-4">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                          title={allSelected ? "Deselect all" : "Select all"}
                          aria-label={allSelected ? "Deselect all" : "Select all"}
                        >
                          {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                        </button>
                      </TableHead>
                      {activeColumns.map((col) => (
                        <TableHead
                          key={col.key}
                          className={`${thClass} ${col.align === "right" ? "text-right" : ""}`}
                        >
                          {col.label}
                        </TableHead>
                      ))}
                      <TableHead className="h-10 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <span className="whitespace-nowrap text-xs font-medium text-slate-500">Actions</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500 hover:text-slate-900"
                                title="Choose columns"
                                aria-label="Choose columns"
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-56 p-2">
                              <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-slate-500">Show columns</p>
                              {availableColumns.map((col) => {
                                const checked = visibleColumns.includes(col.key);
                                return (
                                  <label
                                    key={col.key}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300"
                                      checked={checked}
                                      disabled={checked && activeColumns.length === 1}
                                      onChange={() => toggleColumn(col.key)}
                                    />
                                    {col.label}
                                  </label>
                                );
                              })}
                              <div className="mt-1 border-t pt-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-full justify-start px-2 text-xs"
                                  onClick={() => saveVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                                >
                                  Reset to default
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id} data-state={selectedReturns.has(row.id) ? "selected" : undefined}>
                        <TableCell className="w-10 px-4 py-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowSelect(row.id);
                            }}
                            className="rounded p-0.5 hover:bg-slate-100"
                            aria-label="Select row"
                          >
                            {selectedReturns.has(row.id) ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                        </TableCell>
                        {activeColumns.map((col) => (
                          <TableCell key={col.key} className={`${tdClass} ${col.cellClass}`}>
                            {renderCell(col.key, row)}
                          </TableCell>
                        ))}
                        <TableCell className={tdClass}>
                          <div className="flex items-center justify-end gap-1.5">
                            {canCreateOutward && String(row.status || "").toLowerCase() === "pending" && (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 w-8 flex-shrink-0 bg-green-600 p-0 text-white hover:bg-green-700"
                                title="Create Gate Pass"
                                aria-label="Create Gate Pass"
                                onClick={() => {
                                  const prId = row.id || row.purchase_return_id;
                                  if (!prId) return;
                                  window.location.href = `/outward/add-outward?mode=purchase_return&pr_id=${prId}`;
                                }}
                              >
                                <Truck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="View Details"
                              aria-label="View Details"
                              onClick={() => { setSelectedId(row.id); setIsDetailOpen(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canUpdate && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Edit"
                                aria-label="Edit"
                                onClick={() => (window.location.href = `/add-purchase-return?edit=${row.id}`)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-slate-600">
                Page {pagination.current_page || 1} of {pagination.total_pages || 1}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  disabled={!pagination.has_previous}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  disabled={!pagination.has_next}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
          </div>
        </main>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Purchase Return Detail</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 flex justify-center"><Loader /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Voucher</p><p>{detailData?.data?.voucher_number || "-"}</p></div>
                <div><p className="text-muted-foreground text-xs">PO</p><p>{detailData?.data?.purchase_order_voucher || "-"}</p></div>
                <div><p className="text-muted-foreground text-xs">Party</p><p>{detailData?.data?.party_name || "-"}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><p>{String(detailData?.data?.status || "-").replaceAll("_", " ")}</p></div>
                <div><p className="text-muted-foreground text-xs">Amount</p><p>₹ {(Number(detailData?.data?.amount) || 0).toFixed(2)}</p></div>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full min-w-[900px] text-xs">
                  <thead>
                    <tr className="border-b bg-gray-100">
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-left">UOM</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailData?.data?.items || []).map((line) => (
                      <tr key={line.id} className="border-b">
                        <td className="px-2 py-2">{line.stock_item_name || "-"}</td>
                        <td className="px-2 py-2">{line.uom || "-"}</td>
                        <td className="px-2 py-2 text-right">{line.return_qty || "-"}</td>
                        <td className="px-2 py-2 text-right">{line.rate || "-"}</td>
                        <td className="px-2 py-2 text-right">₹ {(Number(line.amount) || 0).toFixed(2)}</td>
                        <td className="px-2 py-2">{String(line.item_status || "-").replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}