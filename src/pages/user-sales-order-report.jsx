import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardList,
  Clock3,
  Eye,
  IndianRupee,
  ListOrdered,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Target,
  User,
  Users,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";
import {
  fetchUserSalesOrderDetails,
  fetchUserSalesOrderItems,
  fetchUserSalesOrderSummary,
} from "@/lib/sales_target_reports_api";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const DATE_PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "weekly", label: "Weekly (Mon–Sun)" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

const tableScrollClass = "overflow-x-auto overflow-y-auto max-h-[65vh]";
const nestedTableScrollClass = "overflow-x-auto overflow-y-auto max-h-56";

function matchesSearch(haystack, needle) {
  if (!needle) return true;
  return String(haystack ?? "")
    .toLowerCase()
    .includes(needle);
}

function formatCurrency(amount) {
  const n = Number(amount ?? 0);
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
}

function formatDisplayDate(value) {
  if (!value) return "—";
  try {
    const parsed = parseISO(String(value).slice(0, 10));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return format(parsed, "dd-MM-yyyy");
  } catch {
    return String(value);
  }
}

function formatTargetDisplay(row) {
  const parts = [];
  if (row?.target_order_count != null && row.target_order_count !== "") {
    parts.push(`${Number(row.target_order_count).toLocaleString("en-IN")} orders`);
  }
  if (row?.target_order_value != null && row.target_order_value !== "") {
    parts.push(formatCurrency(row.target_order_value));
  }
  if (!parts.length && row?.target_item_quantity != null && row.target_item_quantity !== "") {
    parts.push(`${Number(row.target_item_quantity).toLocaleString("en-IN")} qty`);
  }
  return parts.join(" · ") || "—";
}

function formatRemainingDisplay(row) {
  const parts = [];
  if (row?.remaining_order_count != null && row.remaining_order_count !== "") {
    parts.push(`${Number(row.remaining_order_count).toLocaleString("en-IN")} orders`);
  }
  if (row?.remaining_order_value != null && row.remaining_order_value !== "") {
    parts.push(formatCurrency(row.remaining_order_value));
  }
  return parts.join(" · ") || "—";
}

function achievementTone(value) {
  if (value == null || value === "") return "slate";
  const n = Number(value);
  if (n >= 100) return "green";
  if (n >= 50) return "amber";
  return "red";
}

function bucketBadge(bucket) {
  const value = String(bucket || "").toLowerCase();
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value === "rejected") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function StatCard({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function DateField({ value, onChange, disabled = false, min }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(String(value).slice(0, 10)) : undefined;
  const minDate = min ? parseISO(String(min).slice(0, 10)) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDisplayDate(value) : "Pick date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(date) => {
            if (date) onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results.",
  disabled = false,
  loading = false,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((opt) => String(opt.value) === String(value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-10 font-normal"
        >
          <span className="truncate">{selected?.label || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-56">
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")}
                  />
                  {placeholder}
                </CommandItem>
                {options.map((opt) => (
                  <CommandItem
                    key={String(opt.value)}
                    value={`${opt.label} ${opt.value}`}
                    onSelect={() => {
                      onChange(String(opt.value));
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        String(value) === String(opt.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

async function fetchBranches() {
  const res = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
  const data = await res.json();
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

export default function UserSalesOrderReport() {
  const isMobile = useIsMobile();
  const token = AuthService.getAccessToken();
  const { hasReadPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead = hasReadPermission("sales_order");

  const now = new Date();
  const [fromDate, setFromDate] = useState(() => format(startOfDay(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(() => format(endOfDay(now), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [branchId, setBranchId] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detailView, setDetailView] = useState("orders");
  const [salesmanUsersCache, setSalesmanUsersCache] = useState([]);

  useEffect(() => {
    const current = new Date();
    if (dateRangePreset === "today") {
      setFromDate(format(startOfDay(current), "yyyy-MM-dd"));
      setToDate(format(endOfDay(current), "yyyy-MM-dd"));
    } else if (dateRangePreset === "weekly") {
      setFromDate(format(startOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setToDate(format(endOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (dateRangePreset === "monthly") {
      setFromDate(format(startOfMonth(current), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(current), "yyyy-MM-dd"));
    }
  }, [dateRangePreset]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const effectiveFromDate =
    dateRangePreset === "custom"
      ? fromDate
      : (() => {
          const n = new Date();
          if (dateRangePreset === "today") return format(startOfDay(n), "yyyy-MM-dd");
          if (dateRangePreset === "weekly") {
            return format(startOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd");
          }
          if (dateRangePreset === "monthly") return format(startOfMonth(n), "yyyy-MM-dd");
          return fromDate;
        })();

  const effectiveToDate =
    dateRangePreset === "custom"
      ? toDate
      : (() => {
          const n = new Date();
          if (dateRangePreset === "today") return format(endOfDay(n), "yyyy-MM-dd");
          if (dateRangePreset === "weekly") {
            return format(endOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd");
          }
          if (dateRangePreset === "monthly") return format(endOfMonth(n), "yyyy-MM-dd");
          return toDate;
        })();

  const filterParams = useMemo(
    () => ({
      from_date: effectiveFromDate || undefined,
      to_date: effectiveToDate || undefined,
      branch_id: branchId || undefined,
      user_id: filterUserId || undefined,
      ...(searchDebounced ? { search: searchDebounced } : {}),
    }),
    [effectiveFromDate, effectiveToDate, branchId, filterUserId, searchDebounced],
  );

  const detailParams = useMemo(
    () => ({
      from_date: effectiveFromDate || undefined,
      to_date: effectiveToDate || undefined,
      branch_id: branchId || undefined,
      user_id: selectedUserId || undefined,
      ...(searchDebounced ? { search: searchDebounced } : {}),
    }),
    [effectiveFromDate, effectiveToDate, branchId, selectedUserId, searchDebounced],
  );

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches-user-sales-order-report"],
    queryFn: fetchBranches,
    enabled: !!token && !permissionsLoading && canRead,
  });

  const {
    data: summaryResponse,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["user-sales-order-summary", filterParams],
    queryFn: () => fetchUserSalesOrderSummary(filterParams),
    enabled: !!token && !permissionsLoading && canRead && !selectedUserId,
    placeholderData: (previous) => previous,
  });

  const {
    data: detailResponse,
    isLoading: detailLoading,
    isFetching: detailFetching,
    error: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["user-sales-order-details", detailParams],
    queryFn: () => fetchUserSalesOrderDetails(detailParams),
    enabled:
      !!token &&
      !permissionsLoading &&
      canRead &&
      Boolean(selectedUserId) &&
      detailView === "orders",
    placeholderData: (previous) => previous,
  });

  const {
    data: itemsResponse,
    isLoading: itemsLoading,
    isFetching: itemsFetching,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ["user-sales-order-items", detailParams],
    queryFn: () => fetchUserSalesOrderItems(detailParams),
    enabled:
      !!token &&
      !permissionsLoading &&
      canRead &&
      Boolean(selectedUserId) &&
      detailView === "items",
    placeholderData: (previous) => previous,
  });

  const summaryRowsRaw = summaryResponse?.data ?? [];
  const summaryTotals = summaryResponse?.totals ?? {};
  const salesmanUsers = summaryResponse?.salesman_users?.length
    ? summaryResponse.salesman_users
    : salesmanUsersCache;

  useEffect(() => {
    if (Array.isArray(summaryResponse?.salesman_users) && summaryResponse.salesman_users.length) {
      setSalesmanUsersCache(summaryResponse.salesman_users);
    }
  }, [summaryResponse]);

  const searchNeedle = searchDebounced.toLowerCase();

  const summaryRows = useMemo(() => {
    if (!searchNeedle) return summaryRowsRaw;
    return summaryRowsRaw.filter(
      (row) =>
        matchesSearch(row.user_name, searchNeedle) ||
        matchesSearch(row.user_id, searchNeedle) ||
        matchesSearch(row.role_name, searchNeedle) ||
        matchesSearch(row.branch_name, searchNeedle),
    );
  }, [summaryRowsRaw, searchNeedle]);

  const detailData = detailResponse?.data;
  const detailOrdersRaw = detailData?.orders ?? [];
  const detailTotals = detailData?.totals ?? {};
  const detailUser = detailData?.user || itemsResponse?.data?.user;

  const detailOrders = useMemo(() => {
    if (!searchNeedle) return detailOrdersRaw;
    return detailOrdersRaw.filter((order) => {
      if (
        matchesSearch(order.so_number, searchNeedle) ||
        matchesSearch(order.customer_name, searchNeedle) ||
        matchesSearch(order.branch_name, searchNeedle) ||
        matchesSearch(order.so_status, searchNeedle)
      ) {
        return true;
      }
      return (order.items || []).some(
        (item) =>
          matchesSearch(item.item_name, searchNeedle) ||
          matchesSearch(item.stock_item_name, searchNeedle),
      );
    });
  }, [detailOrdersRaw, searchNeedle]);

  const itemRowsRaw = itemsResponse?.data?.items ?? [];
  const itemTotals = itemsResponse?.data?.totals ?? {};

  const itemRows = useMemo(() => {
    if (!searchNeedle) return itemRowsRaw;
    return itemRowsRaw.filter(
      (item) =>
        matchesSearch(item.item_name, searchNeedle) ||
        matchesSearch(item.base_unit, searchNeedle) ||
        matchesSearch(item.alternate_unit, searchNeedle),
    );
  }, [itemRowsRaw, searchNeedle]);

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: String(branch.id),
        label: branch.name || branch.branch_name || `Branch ${branch.id}`,
      })),
    [branches],
  );

  const userOptions = useMemo(
    () =>
      salesmanUsers.map((user) => ({
        value: String(user.user_id),
        label: `${user.user_name || user.name || user.user_id}${
          user.role_name ? ` (${user.role_name})` : ""
        }`,
      })),
    [salesmanUsers],
  );

  const openUserDetail = (userId) => {
    setSelectedUserId(userId);
    setDetailView("orders");
  };

  const backToSummary = () => {
    setSelectedUserId(null);
    setDetailView("orders");
  };

  const handleRefresh = () => {
    if (!selectedUserId) {
      refetchSummary();
      return;
    }
    if (detailView === "items") refetchItems();
    else refetchDetail();
  };

  if (permissionsLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar />}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex h-screen bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar />}
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-gray-600">
            You do not have permission to view salesman reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="h-6 w-6 text-blue-700" />
                Salesman Report
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Achievement vs targets with order and item drill-down
              </p>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw
                className={cn(
                  "h-4 w-4 mr-2",
                  summaryFetching || detailFetching || itemsFetching
                    ? "animate-spin"
                    : "",
                )}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Search className="h-4 w-4 text-blue-700" />
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={
                        selectedUserId
                          ? "SO number, customer, item..."
                          : "Salesman, user id, branch, role..."
                      }
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-56 lg:w-64 shrink-0 space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-700" />
                    Branch
                  </Label>
                  <SearchableSelect
                    value={branchId}
                    options={branchOptions}
                    onChange={(value) => {
                      setBranchId(value);
                      if (selectedUserId) setSelectedUserId(null);
                    }}
                    placeholder="All branches"
                    searchPlaceholder="Search branches..."
                    emptyText="No branches found"
                    disabled={branchesLoading}
                    loading={branchesLoading}
                  />
                </div>
                <div className="w-full sm:w-56 lg:w-64 shrink-0 space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-blue-700" />
                    Salesman
                  </Label>
                  <SearchableSelect
                    value={filterUserId}
                    options={userOptions}
                    onChange={(value) => {
                      setFilterUserId(value);
                      if (selectedUserId && value && value !== selectedUserId) {
                        setSelectedUserId(null);
                      }
                    }}
                    placeholder="All salesmen"
                    searchPlaceholder="Search salesmen..."
                    emptyText="No salesmen found"
                    disabled={!selectedUserId && summaryLoading && userOptions.length === 0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-700" />
                    Date Range
                  </Label>
                  <Select
                    value={dateRangePreset}
                    onValueChange={(value) => {
                      setDateRangePreset(value);
                      if (selectedUserId) setSelectedUserId(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRESET_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-700" />
                    From Date
                  </Label>
                  <DateField
                    value={fromDate}
                    disabled={dateRangePreset !== "custom"}
                    onChange={(value) => {
                      setFromDate(value);
                      if (toDate && value > toDate) setToDate(value);
                      if (selectedUserId) setSelectedUserId(null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-700" />
                    To Date
                  </Label>
                  <DateField
                    value={toDate}
                    min={dateRangePreset === "custom" ? fromDate : undefined}
                    disabled={dateRangePreset !== "custom"}
                    onChange={(value) => {
                      setToDate(value);
                      if (selectedUserId) setSelectedUserId(null);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {!selectedUserId ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  icon={Users}
                  label="Salesmen"
                  value={summaryTotals.users_count ?? 0}
                  tone="blue"
                />
                <StatCard
                  icon={ClipboardList}
                  label="Orders"
                  value={summaryTotals.total_orders ?? 0}
                  tone="slate"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Approved"
                  value={summaryTotals.approved_count ?? 0}
                  tone="green"
                />
                <StatCard
                  icon={IndianRupee}
                  label="Total value"
                  value={formatCurrency(summaryTotals.total_value)}
                  tone="blue"
                />
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold">
                    Salesman-wise sales order summary ({summaryRows.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {summaryLoading && !summaryResponse ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : summaryError ? (
                    <p className="p-6 text-sm text-red-600">{summaryError.message}</p>
                  ) : summaryRows.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">
                      No salesman sales orders found for the selected filters.
                    </p>
                  ) : (
                    <div className={tableScrollClass}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Target</TableHead>
                            <TableHead className="text-center">Orders</TableHead>
                            <TableHead className="text-center">Approved</TableHead>
                            <TableHead className="text-right">Total value</TableHead>
                            <TableHead className="text-right">Approved value</TableHead>
                            <TableHead className="text-center">Achievement %</TableHead>
                            <TableHead className="text-right">Remaining</TableHead>
                            <TableHead className="text-center w-[72px]">View</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaryRows.map((row) => (
                            <TableRow key={row.user_id}>
                              <TableCell>
                                <p className="font-medium text-slate-900">{row.user_name}</p>
                                <p className="text-xs text-slate-500">
                                  {row.user_id}
                                  {row.role_name ? ` · ${row.role_name}` : ""}
                                  {row.branch_name ? ` · ${row.branch_name}` : ""}
                                </p>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatTargetDisplay(row)}
                              </TableCell>
                              <TableCell className="text-center tabular-nums font-semibold">
                                {row.total_orders}
                              </TableCell>
                              <TableCell className="text-center tabular-nums text-emerald-700 font-medium">
                                {row.approved_count}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">
                                {formatCurrency(row.total_value)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold text-emerald-700">
                                {formatCurrency(row.approved_value)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-center tabular-nums font-semibold",
                                  Number(row.achievement_pct) >= 100
                                    ? "text-emerald-700"
                                    : Number(row.achievement_pct) >= 50
                                      ? "text-amber-700"
                                      : row.achievement_pct == null
                                        ? "text-slate-400"
                                        : "text-red-700",
                                )}
                              >
                                {formatPercent(row.achievement_pct)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatRemainingDisplay(row)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={`View ${row.user_name}`}
                                  onClick={() => openUserDetail(row.user_id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={backToSummary}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to summary
                </Button>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {detailUser?.user_name || selectedUserId}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {detailUser?.user_id}
                    {detailUser?.role_name ? ` · ${detailUser.role_name}` : ""}
                    {detailUser?.branch_name ? ` · ${detailUser.branch_name}` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <StatCard
                  icon={Target}
                  label="Target"
                  value={
                    detailView === "items" && itemTotals.target_quantity != null
                      ? `${itemTotals.target_quantity}`
                      : formatTargetDisplay(
                          detailView === "items" ? itemTotals : detailTotals,
                        )
                  }
                  tone="blue"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Achievement"
                  value={formatPercent(
                    detailView === "items"
                      ? itemTotals.achievement_pct
                      : detailTotals.achievement_pct,
                  )}
                  tone={achievementTone(
                    detailView === "items"
                      ? itemTotals.achievement_pct
                      : detailTotals.achievement_pct,
                  )}
                />
                <StatCard
                  icon={Clock3}
                  label="Remaining"
                  value={
                    detailView === "items" && itemTotals.remaining_quantity != null
                      ? `${itemTotals.remaining_quantity}`
                      : formatRemainingDisplay(
                          detailView === "items" ? itemTotals : detailTotals,
                        )
                  }
                  tone="amber"
                />
                <StatCard
                  icon={ClipboardList}
                  label="Orders"
                  value={
                    detailView === "items"
                      ? (itemTotals.items_count ?? 0)
                      : (detailTotals.total_orders ?? 0)
                  }
                />
                <StatCard
                  icon={CheckCircle2}
                  label={detailView === "items" ? "Appr. Qty" : "Approved"}
                  value={
                    detailView === "items"
                      ? (itemTotals.approved_quantity ?? 0)
                      : (detailTotals.approved_count ?? 0)
                  }
                  tone="green"
                />
                <StatCard
                  icon={IndianRupee}
                  label="Approved value"
                  value={formatCurrency(
                    detailView === "items"
                      ? itemTotals.approved_amount
                      : detailTotals.approved_value,
                  )}
                  tone="green"
                />
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 border-b">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      {detailView === "items" ? (
                        <>
                          <Package className="h-4 w-4" />
                          Item-wise sales ({itemRows.length})
                        </>
                      ) : (
                        <>
                          <ListOrdered className="h-4 w-4" />
                          Sales orders ({detailOrders.length})
                        </>
                      )}
                    </CardTitle>
                    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setDetailView("orders")}
                        className={cn(
                          "inline-flex items-center gap-1.5 h-9 px-3 text-sm",
                          detailView === "orders"
                            ? "bg-blue-800 text-white"
                            : "text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                        Orders
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailView("items")}
                        className={cn(
                          "inline-flex items-center gap-1.5 h-9 px-3 text-sm border-l border-gray-200",
                          detailView === "items"
                            ? "bg-blue-800 text-white"
                            : "text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Items view
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {detailView === "orders" ? (
                    detailLoading && !detailResponse ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      </div>
                    ) : detailError ? (
                      <p className="p-6 text-sm text-red-600">{detailError.message}</p>
                    ) : detailOrders.length === 0 ? (
                      <p className="p-6 text-sm text-slate-500">
                        No orders found for this salesman in the selected range.
                      </p>
                    ) : (
                      <div className={tableScrollClass}>
                        <div className="divide-y divide-gray-100">
                          {detailOrders.map((order) => (
                            <div key={order.so_number} className="p-4 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {order.so_number}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {order.order_date}
                                    {order.customer_name
                                      ? ` · ${order.customer_name}`
                                      : ""}
                                    {order.branch_name ? ` · ${order.branch_name}` : ""}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${bucketBadge(order.bucket)}`}
                                  >
                                    {order.so_status || order.bucket}
                                  </span>
                                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                                    {formatCurrency(order.total_value)}
                                  </span>
                                  <span className="text-xs text-emerald-700 tabular-nums">
                                    Approved: {formatCurrency(order.approved_value)}
                                  </span>
                                </div>
                              </div>

                              <div
                                className={`rounded-lg border border-gray-100 ${nestedTableScrollClass}`}
                              >
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Item</TableHead>
                                      <TableHead className="text-center">Qty</TableHead>
                                      <TableHead className="text-center">
                                        Approved
                                      </TableHead>
                                      <TableHead className="text-center">Price</TableHead>
                                      <TableHead className="text-right">Amount</TableHead>
                                      <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(order.items || []).map((item) => (
                                      <TableRow
                                        key={item.id || `${order.so_number}-${item.item_name}`}
                                      >
                                        <TableCell>
                                          <p className="font-medium">
                                            {item.item_name || "—"}
                                          </p>
                                          <p className="text-[11px] text-slate-500">
                                            GST {item.gst_percentage ?? 0}%
                                          </p>
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                          {item.quantity}
                                          {item.base_unit ? ` ${item.base_unit}` : ""}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums text-emerald-700">
                                          {item.approved_quantity}
                                          {item.base_unit ? ` ${item.base_unit}` : ""}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                          {formatCurrency(item.display_rate)}
                                          <div className="text-[10px] text-slate-500">
                                            /{" "}
                                            {item.rate_per_unit ||
                                              item.base_unit ||
                                              "unit"}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-medium">
                                          {formatCurrency(item.amount)}
                                          {item.approved_amount > 0 ? (
                                            <div className="text-[10px] text-emerald-700">
                                              Appr: {formatCurrency(item.approved_amount)}
                                            </div>
                                          ) : null}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <span
                                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                              item.is_rejected
                                                ? bucketBadge("rejected")
                                                : item.is_approved
                                                  ? bucketBadge("approved")
                                                  : bucketBadge("pending")
                                            }`}
                                          >
                                            {item.is_rejected
                                              ? "Rejected"
                                              : item.is_approved
                                                ? "Approved"
                                                : "Pending"}
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ) : itemsLoading && !itemsResponse ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : itemsError ? (
                    <p className="p-6 text-sm text-red-600">{itemsError.message}</p>
                  ) : itemRows.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">
                      No item-wise sales found for this salesman in the selected range.
                    </p>
                  ) : (
                    <div className={tableScrollClass}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-center">Orders</TableHead>
                            <TableHead className="text-center">Total Qty</TableHead>
                            <TableHead className="text-center">Approved Qty</TableHead>
                            <TableHead className="text-center">Pending Qty</TableHead>
                            <TableHead className="text-center">Rejected Qty</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-right">Approved Amount</TableHead>
                            <TableHead className="text-center">Target Qty</TableHead>
                            <TableHead className="text-center">Achievement %</TableHead>
                            <TableHead className="text-center">Remaining Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemRows.map((item) => (
                            <TableRow key={item.item_id || item.item_name}>
                              <TableCell>
                                <p className="font-medium text-slate-900">
                                  {item.item_name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.base_unit || "—"}
                                  {item.alternate_unit
                                    ? ` / ${item.alternate_unit}`
                                    : ""}
                                  {item.line_count ? ` · ${item.line_count} lines` : ""}
                                </p>
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {item.order_count}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {item.total_quantity}
                                {item.base_unit ? ` ${item.base_unit}` : ""}
                              </TableCell>
                              <TableCell className="text-center tabular-nums text-emerald-700">
                                {item.approved_quantity}
                                {item.base_unit ? ` ${item.base_unit}` : ""}
                              </TableCell>
                              <TableCell className="text-center tabular-nums text-amber-700">
                                {item.pending_quantity}
                                {item.base_unit ? ` ${item.base_unit}` : ""}
                              </TableCell>
                              <TableCell className="text-center tabular-nums text-red-700">
                                {item.rejected_quantity}
                                {item.base_unit ? ` ${item.base_unit}` : ""}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">
                                {formatCurrency(item.total_amount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold text-emerald-700">
                                {formatCurrency(item.approved_amount)}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {item.target_quantity != null
                                  ? `${item.target_quantity}${
                                      item.base_unit ? ` ${item.base_unit}` : ""
                                    }`
                                  : "—"}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-center tabular-nums font-semibold",
                                  Number(item.achievement_pct) >= 100
                                    ? "text-emerald-700"
                                    : Number(item.achievement_pct) >= 50
                                      ? "text-amber-700"
                                      : item.achievement_pct == null
                                        ? "text-slate-400"
                                        : "text-red-700",
                                )}
                              >
                                {formatPercent(item.achievement_pct)}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {item.remaining_quantity != null
                                  ? `${item.remaining_quantity}${
                                      item.base_unit ? ` ${item.base_unit}` : ""
                                    }`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
      <Loader
        isLoading={selectedUserId ? detailLoading : summaryLoading}
        text="Loading salesman report"
      />
    </div>
  );
}
