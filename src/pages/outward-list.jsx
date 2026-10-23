import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { CalendarIcon, Package, Menu, Filter, Plus, Edit, Search, Eye, ArrowLeft, Truck, FileText, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { startOfDay, endOfWeek, startOfWeek, startOfMonth as dfStartOfMonth, endOfMonth as dfEndOfMonth, format } from "date-fns";

const ITEMS_PER_PAGE = 50;

const getTodayOnlyDate = () => startOfDay(new Date());

const getPresetDateRange = (preset) => {
  const now = new Date();
  if (preset === "today") {
    const todayOnly = getTodayOnlyDate();
    return { from: todayOnly, to: todayOnly };
  }
  if (preset === "weekly") {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return { from: weekStart, to: weekEnd };
  }
  if (preset === "monthly") {
    return { from: dfStartOfMonth(now), to: dfEndOfMonth(now) };
  }
  return { from: null, to: null };
};

const formatDateForApi = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
};

const OUTWARD_STATUS_FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "partial_completed", label: "Partial Completed" },
  { value: "completed", label: "Completed" },
];

const statusColors = {
  approved: "bg-green-100 text-green-700",
  completed: "bg-green-200 text-green-800",
  rejected: "bg-red-100 text-red-700",
  unloaded_but_rejected: "bg-red-200 text-red-800",
  pending: "bg-yellow-100 text-yellow-700",
  "assignment-pending": "bg-yellow-200 text-yellow-800",
  unloaded: "bg-blue-100 text-blue-700",
  "not uploaded": "bg-gray-100 text-gray-700",
  partial_completed: "bg-orange-100 text-orange-700",
};

const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const toCount = (value) => (typeof value === "number" ? value : parseInt(value, 10)) || 0;

export default function OutwardList() {
  const [location, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // Initialize with URL parameters if available, otherwise use defaults
  const getInitialValues = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get('from_date') || urlParams.get('start_date');
    const toDateParam = urlParams.get('to_date') || urlParams.get('end_date');
    const presetParam = urlParams.get("date_range");
    const todayRange = getPresetDateRange("today");

    let dateRangePreset = "today";
    if (presetParam && ["today", "weekly", "monthly", "custom"].includes(presetParam)) {
      dateRangePreset = presetParam;
    } else if (fromDateParam && toDateParam) {
      dateRangePreset = "custom";
    }

    let fromDate = formatDateForApi(todayRange.from);
    let toDate = formatDateForApi(todayRange.to);

    if (dateRangePreset === "custom") {
      fromDate = fromDateParam || fromDate;
      toDate = toDateParam || toDate;
    } else {
      const range = getPresetDateRange(dateRangePreset);
      fromDate = formatDateForApi(range.from);
      toDate = formatDateForApi(range.to);
    }

    return {
      fromDate,
      toDate,
      statusFilter: urlParams.get('status') || "all",
      dateRangePreset,
      searchTerm: urlParams.get('search') || "",
      vehicleNo: urlParams.get('vehicle_no') || "",
    };
  };

  const initialValues = getInitialValues();
  const [filters, setFilters] = useState({
    fromDate: initialValues.fromDate,
    toDate: initialValues.toDate,
    statusFilter: initialValues.statusFilter,
    vehicleNo: initialValues.vehicleNo,
    searchTerm: initialValues.searchTerm,
  });
  const [searchInput, setSearchInput] = useState(initialValues.searchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialValues.searchTerm);
  const [dateRangePreset, setDateRangePreset] = useState(initialValues.dateRangePreset);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchInput.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      searchTerm: debouncedSearchTerm,
    }));
  }, [debouncedSearchTerm]);

  const { toast } = useToast();
  const isMobile = useIsMobile();

  const applyDateRangePreset = (preset) => {
    if (preset === "custom") return;
    const { from, to } = getPresetDateRange(preset);
    if (from && to) {
      setFilters((prev) => ({
        ...prev,
        fromDate: formatDateForApi(from),
        toDate: formatDateForApi(to),
      }));
    }
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", String(currentPage));
    params.append("per_page", String(ITEMS_PER_PAGE));
    if (filters.fromDate) params.append('start_date', filters.fromDate);
    if (filters.toDate) params.append('end_date', filters.toDate);
    if (filters.statusFilter && filters.statusFilter !== 'all') {
      params.append('status', filters.statusFilter);
    }
    if (filters.vehicleNo) params.append('vehicle_no', filters.vehicleNo);
    if (filters.searchTerm?.trim()) params.append('search', filters.searchTerm.trim());
    return params.toString();
  };

  // Fetch outward entries
  const { data: outwardData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [
      'outward-entries',
      filters.fromDate,
      filters.toDate,
      filters.statusFilter,
      filters.vehicleNo,
      filters.searchTerm,
      currentPage,
    ],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${import.meta.env.VITE_BASE_URL}/api/sales/outward-entries/?${queryParams}`;

      let response;
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AuthService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (networkErr) {
        throw new Error(
          `Cannot reach API at ${import.meta.env.VITE_BASE_URL}. Is the Django server running? (${networkErr?.message || 'network error'})`,
        );
      }

      if (!response.ok) {
        let detail = "";
        try {
          const errBody = await response.json();
          detail = errBody?.message || errBody?.error || errBody?.detail || "";
        } catch {
          /* ignore */
        }
        if (response.status === 401) {
          throw new Error(detail || "Session expired. Please log in again.");
        }
        throw new Error(
          detail
            ? `${detail} (HTTP ${response.status})`
            : `Failed to fetch outward entries (HTTP ${response.status})`,
        );
      }

      const data = await response.json();

      if (data.status && data.status !== 200) {
        throw new Error(data.message || 'Failed to fetch outward entries');
      }

      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    keepPreviousData: true, // react-query v4
    placeholderData: (previousData) => previousData, // react-query v5
  });

  const outwardEntries = outwardData?.data || [];
  const apiSummary = outwardData?.summary || null;
  const pagination = outwardData?.pagination || {
    current_page: 1,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  };
  const totalItems = pagination.total_count || apiSummary?.filtered_total_entries || 0;

  const summaryStats = React.useMemo(() => {
    if (!apiSummary) {
      return {
        uniqueVehicles: 0,
        totalItems: 0,
        totalSalesOrders: 0,
        statusCounts: null,
      };
    }
    return {
      uniqueVehicles: apiSummary.unique_vehicles ?? 0,
      totalItems: apiSummary.total_items ?? 0,
      totalSalesOrders: apiSummary.total_sales_orders ?? 0,
      statusCounts: apiSummary,
    };
  }, [apiSummary]);

  const prevFilterScopeRef = React.useRef(null);
  useEffect(() => {
    const scopeKey = JSON.stringify({
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      statusFilter: filters.statusFilter,
      vehicleNo: filters.vehicleNo,
      searchTerm: filters.searchTerm,
    });
    if (prevFilterScopeRef.current !== null && prevFilterScopeRef.current !== scopeKey) {
      setCurrentPage(1);
    }
    prevFilterScopeRef.current = scopeKey;
  }, [filters.fromDate, filters.toDate, filters.statusFilter, filters.vehicleNo, filters.searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRangePreset) params.set("date_range", dateRangePreset);
    if (filters.fromDate) params.set("from_date", filters.fromDate);
    if (filters.toDate) params.set("to_date", filters.toDate);
    if (filters.statusFilter && filters.statusFilter !== "all") {
      params.set("status", filters.statusFilter);
    }
    if (filters.vehicleNo) params.set("vehicle_no", filters.vehicleNo);
    if (filters.searchTerm?.trim()) params.set("search", filters.searchTerm.trim());
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [dateRangePreset, filters]);

  useEffect(() => {
    if (dateRangePreset === "custom") return;
    const { from, to } = getPresetDateRange(dateRangePreset);
    const expectedFrom = formatDateForApi(from);
    const expectedTo = formatDateForApi(to);
    if (filters.fromDate !== expectedFrom || filters.toDate !== expectedTo) {
      setFilters((prev) => ({ ...prev, fromDate: expectedFrom, toDate: expectedTo }));
    }
  }, [dateRangePreset]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    if (key === "searchTerm") {
      setSearchInput(value);
      return;
    }
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.total_pages) return;
    setCurrentPage(page);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    const todayOnly = getTodayOnlyDate();
    const todayStr = formatDateForApi(todayOnly);
    setDateRangePreset("today");
    setSearchInput("");
    setDebouncedSearchTerm("");
    setFilters({
      fromDate: todayStr,
      toDate: todayStr,
      statusFilter: "all",
      vehicleNo: "",
      searchTerm: "",
    });
    setCurrentPage(1);
  };

  const handleViewDetails = (entry) => {
    setLocation(`/outward-details/${entry.id}`);
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'partial_completed':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };


  // Get priority badge variant
  const getPriorityBadgeVariant = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Apply date range preset when user changes dropdown
  const handleDateRangePresetChange = (value) => {
    setDateRangePreset(value);
    setCurrentPage(1);
    if (value !== "custom") {
      applyDateRangePreset(value);
    }
  };

  // Get user permissions
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  const formatValue = (value) => {
    if (value === null || value === undefined) return "0";
    if (typeof value === "number") {
      return value.toLocaleString("en-IN");
    }
    return value.toString();
  };

  // Full-page loader only for the very first load (no data yet), so the
  // search input stays mounted and keeps focus while typing.
  if (isLoading && !outwardData) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <CommonLoader />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading outward entries: {error.message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  // Check permissions
  if (permissionsLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <CommonLoader />
        </div>
      </div>
    );
  }

  // Check if user has any access to outward module (read, create, update, or delete)
  const hasOutwardAccess = hasModuleAccess("outward") ||
    hasReadPermission("outward") ||
    hasCreatePermission("outward") ||
    hasUpdatePermission("outward") ||
    hasDeletePermission("outward");

  if (!hasOutwardAccess) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Package className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view outward reports. Contact your administrator for access.
              </p>
              <Button onClick={() => setLocation('/dashboard')} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summaryTiles = [
    { label: "Total vehicles", value: summaryStats.uniqueVehicles, icon: Truck, tone: "bg-purple-50 text-purple-600" },
    { label: "Total items", value: summaryStats.totalItems, icon: Package, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Total sales orders", value: summaryStats.totalSalesOrders, icon: FileText, tone: "bg-blue-50 text-blue-600" },
  ];

  const hasActiveFilters =
    filters.statusFilter !== "all" ||
    !!filters.vehicleNo ||
    !!filters.searchTerm ||
    dateRangePreset !== "today";

  const labelClass = "text-xs font-medium text-slate-600";

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-6">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Go back"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">Gate Pass Reports</h1>
              <p className="truncate text-sm text-slate-500">Manage outward inventory entries</p>
            </div>
          </div>

          {hasCreatePermission("outward") && (
            <Button
              size="sm"
              className="h-9 shrink-0 gap-2"
              aria-label="Add gate pass"
              onClick={() => setLocation("/outward/add-outward")}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add gate pass</span>
            </Button>
          )}
        </header>

        {/* Main Content */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 sm:p-6">
            {/* Filters */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[150px_150px_150px_170px_minmax(0,1fr)_auto] lg:items-end">
                  {/* Date Range Preset */}
                  <div className="space-y-1.5">
                    <Label htmlFor="dateRangePreset" className={labelClass}>Date range</Label>
                    <Select value={dateRangePreset} onValueChange={handleDateRangePresetChange}>
                      <SelectTrigger id="dateRangePreset" className="h-9">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="weekly">Weekly (Mon–Sun)</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fromDate" className={labelClass}>From</Label>
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
                          className={`h-9 w-full justify-start px-3 text-left font-normal ${dateRangePreset !== "custom" ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                          id="fromDate"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {filters.fromDate ? format(new Date(filters.fromDate), "dd-MM-yyyy") : "From date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`from-${filters.fromDate || "null"}`}
                          mode="single"
                          selected={filters.fromDate ? new Date(filters.fromDate) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const iso = format(date, "yyyy-MM-dd");
                            handleFilterChange("fromDate", iso);
                            if (filters.toDate && iso > filters.toDate) {
                              handleFilterChange("toDate", iso);
                            }
                            setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                          }}
                          disabled={{ after: new Date() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="toDate" className={labelClass}>To</Label>
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
                          className={`h-9 w-full justify-start px-3 text-left font-normal ${dateRangePreset !== "custom" ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                          id="toDate"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {filters.toDate ? format(new Date(filters.toDate), "dd-MM-yyyy") : "To date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`to-${filters.toDate || "null"}`}
                          mode="single"
                          selected={filters.toDate ? new Date(filters.toDate) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const iso = format(date, "yyyy-MM-dd");
                            handleFilterChange("toDate", iso);
                            setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                          }}
                          disabled={[
                            filters.fromDate ? { before: new Date(filters.fromDate) } : null,
                            { after: new Date() },
                          ].filter(Boolean)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="status" className={labelClass}>Status</Label>
                    <Select value={filters.statusFilter} onValueChange={(value) => handleFilterChange("statusFilter", value)}>
                      <SelectTrigger id="status" className="h-9">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partial_completed">Partial Completed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="searchTerm" className={labelClass}>Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="searchTerm"
                        placeholder="Gate pass or vehicle number"
                        value={searchInput}
                        onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                        className="h-9 pl-8 pr-14"
                      />
                      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                        {searchInput && (
                          <button
                            type="button"
                            onClick={() => handleFilterChange("searchTerm", "")}
                            className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                          >
                            <span className="sr-only">Clear search</span>
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="h-9 sm:col-span-2 lg:col-span-1"
                    onClick={handleClearFilters}
                    disabled={!hasActiveFilters}
                  >
                    Clear filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {summaryTiles.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3">
                    <div className={`rounded-md p-2 ${tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-xl font-semibold leading-tight tabular-nums text-slate-900">
                        {formatValue(value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {summaryStats.statusCounts && OUTWARD_STATUS_FILTERS.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t bg-slate-50/60 px-4 py-2.5">
                  <span className="mr-1 text-xs font-medium text-slate-500">Filter by status</span>
                  {OUTWARD_STATUS_FILTERS.map((filter) => {
                    const count = summaryStats.statusCounts[filter.value] ?? 0;
                    const isActive = filters.statusFilter === filter.value;
                    return (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => {
                          handleFilterChange("statusFilter", isActive ? "all" : filter.value);
                          setCurrentPage(1);
                        }}
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          isActive
                            ? "border-blue-500 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/60"
                        }`}
                      >
                        {filter.label}: {formatValue(count)}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Results */}
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  Gate pass entries
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {formatValue(totalItems)}
                  </Badge>
                </h2>
              </div>

              {outwardEntries.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Gate pass no.</TableHead>
                          <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Source</TableHead>
                          <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Vehicle no.</TableHead>
                          <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Status</TableHead>
                          <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Created by</TableHead>
                          <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Date</TableHead>
                          <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outwardEntries.map((entry) => {
                          const soCount = toCount(entry.sales_orders);
                          const prCount = toCount(entry.purchase_returns);
                          return (
                            <TableRow key={entry.id}>
                              <TableCell className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                                GP-{entry.outward_entry_no || entry.bill_no}
                              </TableCell>
                              <TableCell className="px-4 py-2.5">
                                {soCount > 0 || prCount > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {soCount > 0 && (
                                      <Badge variant="outline" className="w-fit text-xs font-normal">
                                        SO: {soCount}
                                      </Badge>
                                    )}
                                    {prCount > 0 && (
                                      <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-xs font-normal text-amber-700">
                                        PR: {prCount}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap px-4 py-2.5">{entry.vehicle_no || <span className="text-slate-400">—</span>}</TableCell>
                              <TableCell className="px-4 py-2.5">
                                <span
                                  className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    statusColors[entry.status] || "bg-gray-200 text-gray-800"
                                  }`}
                                >
                                  {capitalizeFirst(entry.status?.replace(/_/g, " ") || "pending")}
                                </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap px-4 py-2.5">{entry.created_by || <span className="text-slate-400">—</span>}</TableCell>
                              <TableCell className="whitespace-nowrap px-4 py-2.5 text-slate-600">{entry.created_at || <span className="text-slate-400">—</span>}</TableCell>
                              <TableCell className="px-4 py-2.5">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 px-2.5"
                                    onClick={() => handleViewDetails(entry)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    View
                                  </Button>
                                  {hasUpdatePermission("outward") && entry.status === "pending" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1.5 px-2.5"
                                      onClick={() => setLocation(`/outward/add-outward?edit_id=${entry.id}`)}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-3">
                      <p className="text-sm text-slate-600">
                        Page {pagination.current_page} of {pagination.total_pages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => handlePageChange(pagination.current_page - 1)}
                          disabled={!pagination.has_previous}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => handlePageChange(pagination.current_page + 1)}
                          disabled={!pagination.has_next}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-4 py-12 text-center">
                  <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-base font-medium text-slate-900">No outward entries found</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                    {hasActiveFilters
                      ? "Try adjusting your filters to see more results."
                      : "No gate passes for today yet."}
                  </p>
                  {hasCreatePermission("outward") && (
                    <Button className="mt-4 h-9 gap-2" onClick={() => setLocation("/outward/add-outward")}>
                      <Plus className="h-4 w-4" />
                      Add gate pass
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}