import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, parse, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";

import {
  Menu,
  Search,
  Eye,
  FileText,
  Calendar,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Warehouse,
  ArrowRight,
  ArrowLeft,
  Building2,
  Hash,
  CalendarIcon,
  RotateCw,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,
  User,
  Pencil
} from "lucide-react";
import Loader from "@/components/common/loader";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useUserPermissions } from "@/hooks/useUserPermissions";
// Note: Type imports are commented out since this is a JSX file
// import { StockJournal, VoucherType, StockJournalDetail, StockJournalFilters } from "@shared/schema";

const STOCK_JOURNAL_FILTERS_STORAGE_KEY = "stock_journal_filters";
const STOCK_JOURNAL_RESTORE_FILTERS_FLAG = "stock_journal_restore_filters_once";

function getInitialStockJournalSearch() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  if (params.has("search")) {
    return params.get("search") || "";
  }

  try {
    const shouldRestore = sessionStorage.getItem(STOCK_JOURNAL_RESTORE_FILTERS_FLAG) === "1";
    if (shouldRestore) {
      sessionStorage.removeItem(STOCK_JOURNAL_RESTORE_FILTERS_FLAG);
      const raw = sessionStorage.getItem(STOCK_JOURNAL_FILTERS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) || {};
        return typeof saved.search === "string" ? saved.search : "";
      }
    } else {
      sessionStorage.removeItem(STOCK_JOURNAL_FILTERS_STORAGE_KEY);
    }
  } catch (_) {
    // ignore storage errors
  }

  return "";
}

function entryMatchesSearch(entry, searchTerm) {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return true;

  const fields = [
    entry.transaction_id,
    entry.voucher_number,
    entry.voucher_type_name,
    entry.created_by,
    entry.branch,
  ];

  return fields.some((value) => String(value ?? "").toLowerCase().includes(q));
}

// Helper function to format date for display
const formatDateForApi = (date) => {
  // alert(format(new Date(date), "dd-MM-yyyy") )
  // alert(date)
  return date ? format(new Date(date), "dd-MM-yyyy") : "";
// alert(date)


};


// Helper function to format date for input fields
const formatDateForInput = (date) => {
  return date ? format(new Date(date), "yyyy-MM-dd") : "";
};

function useDateQueryParam() {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  return query.get("date");
}

function useVoucherTypeQueryParam() {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  return query.get("voucher_type");
}

export default function StockJournal() {
  const [, setLocation] = useLocation();
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
  const selectedDate = useDateQueryParam();
  const selectedVoucherType = useVoucherTypeQueryParam();
  const storedVoucherType = (typeof window !== "undefined")
    ? (localStorage.getItem("selectedVoucherType") || localStorage.getItem("sj_voucher_type"))
    : null;
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [searchTerm, setSearchTerm] = useState(getInitialStockJournalSearch);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState(() => {
    // Initialize from URL param first, then localStorage (set by dashboard), else default to "all"
    return selectedVoucherType || storedVoucherType || "all";
  });
  const [syncFilter, setSyncFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState(false);
  const [dateRangePreset, setDateRangePreset] = useState("custom"); // "today" | "weekly" | "monthly" | "custom"

  // Handle supervisor selection
  const handleSupervisorChange = (value) => {
    // console.log("🔍 Supervisor selection changed:", value);
    setUserFilter(value);
    setSupervisorDropdownOpen(false);
    // console.log("🔍 Selected supervisor state updated to:", value);
    
    // Reset to first page when filter changes
    setCurrentPage(1);
  };
  const [fromDate, setFromDate] = useState(() => {
    // Always use start of current month as default for stock journals
    return startOfMonth(new Date());
  });
  const [toDate, setToDate] = useState(() => {
    // Always use current date as default for stock journals
    return new Date();
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);
  const isMobile = useIsMobile();
  //alert(fromDate)

  // Apply date range preset: set fromDate/toDate when preset is today/weekly/monthly
  useEffect(() => {
    const now = new Date();

    if (dateRangePreset === "today") {
      setFromDate(startOfDay(now));
      setToDate(endOfDay(now));
    } else if (dateRangePreset === "weekly") {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });     // Sunday
      setFromDate(weekStart);
      setToDate(weekEnd);
    } else if (dateRangePreset === "monthly") {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      setFromDate(monthStart);
      setToDate(monthEnd);
    }
    // "custom" leaves fromDate/toDate unchanged for manual selection
  }, [dateRangePreset]);

  // Persist search in URL and sessionStorage (same pattern as user-list.jsx).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    } else {
      params.delete("search");
    }

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    try {
      if (searchTerm.trim()) {
        sessionStorage.setItem(
          STOCK_JOURNAL_FILTERS_STORAGE_KEY,
          JSON.stringify({ search: searchTerm })
        );
      } else {
        sessionStorage.removeItem(STOCK_JOURNAL_FILTERS_STORAGE_KEY);
      }
    } catch (_) {
      // ignore storage errors
    }
  }, [searchTerm]);

  // Get user permissions
  const { 
    hasCreatePermission, 
    hasReadPermission, 
    hasUpdatePermission, 
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  // Clear filters function
  const handleClearFilters = () => {
    // console.log("🧹 Clear filters function called");
    const currentMonthStart = startOfMonth(new Date());
    const currentDate = new Date(); // Use current date instead of end of month
    // console.log("📅 Setting dates:", { currentMonthStart, currentDate });
    
    setFromDate(currentMonthStart);
    setToDate(currentDate);
    setVoucherTypeFilter("all");
    setSyncFilter("all");
    setUserFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
    
    // console.log("✅ Clear filters completed");
  };

  // Clear stored dashboard navigation data on mount after we've read it (URL params take precedence)
  useEffect(() => {
    localStorage.removeItem("fromSidebarNavigation");
    if (storedVoucherType) {
      localStorage.removeItem("selectedVoucherType");
      localStorage.removeItem("sj_voucher_type");
    }
    if (selectedDate) {
      localStorage.removeItem("DashboardStartDate");
    }
  }, []);

  // No additional navigation logic needed - always use correct defaults

  // Build API query parameters



  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    
    if (fromDate) {
      params.append('from_date', formatDateForApi(fromDate));
    }
    if (toDate) {
      params.append('to_date', formatDateForApi(toDate));
    }
    if (voucherTypeFilter && voucherTypeFilter !== "all") {
      params.append('voucher_type', voucherTypeFilter);
    }
    if (isTallyEnabled && syncFilter && syncFilter !== "all") {
      params.append('is_tally_synced', syncFilter === "synced" ? "true" : "false");
    }
    // Search is applied client-side on loaded entries (same pattern as user-list.jsx).
    // Note: supervisor filter is applied client-side on created_by name
    // if (userFilter && userFilter !== "all") {
    //   params.append('user_id', userFilter);
    // }
    return params.toString();
  };
  //alert(voucherTypeFilter);
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;

  // Fetch stock journals from API
  const { data: stockJournalsData, isLoading, error, refetch } = useQuery({
    queryKey: [
      API_BASE_URL + "/api/get-stock-journals/",
      currentPage,
      fromDate,
      toDate,
      voucherTypeFilter,
      isTallyEnabled ? syncFilter : null,
    ],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/get-stock-journals/?${queryParams}`;
      const response = await fetch(url, {
        headers: AuthService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stock journals: ${response.statusText}`);
      }

      const data = await response.json();
      // console.log("🔍 Stock journals API response:", data);
      
      // Debug: Log the first few entries to see the data structure
      if (data.data && data.data.length > 0) {
        // console.log("🔍 First stock journal entry:", data.data[0]);
        // console.log("🔍 Available fields:", Object.keys(data.data[0]));
        
        // Check for user-related fields
        const userFields = Object.keys(data.data[0]).filter(key => 
          key.toLowerCase().includes('user') || 
          key.toLowerCase().includes('created') || 
          key.toLowerCase().includes('supervisor')
        );
        // console.log("🔍 User-related fields:", userFields);
      }
      
      return data;
    },
   
    enabled: AuthService.isAuthenticated()
  });

  // Fetch voucher types from API
  const { data: voucherTypesData } = useQuery({
    queryKey: [API_BASE_URL + "/api/get-voucher-types/"],
    queryFn: async () => {
      const response = await fetch(API_BASE_URL + "/api/get-voucher-types/?is_active=true", {
        headers: AuthService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voucher types: ${response.statusText}`);
      }

      return await response.json();
    },
    enabled: AuthService.isAuthenticated()
  });

  // Fetch users from API
  const { data: usersData } = useQuery({
    queryKey: [API_BASE_URL + "/api/get-users/"],
    queryFn: async () => {
      const response = await fetch(API_BASE_URL + "/api/get-users/", {
        headers: AuthService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      return await response.json();
    },
    enabled: AuthService.isAuthenticated()
  });

  // Handle URL date param when coming from dashboard: use single-day range (from = to = date)
  // so we show only that day's entries (e.g. the 4 from "Sj Production [R] 0/4"), not full month.
  useEffect(() => {
    if (selectedDate) {
      try {
        let parsedDate = parse(selectedDate, "yyyy-MM-dd", new Date());
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date(selectedDate);
        }
        if (!isNaN(parsedDate.getTime())) {
          setFromDate(parsedDate);
          setToDate(parsedDate);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error("Error parsing date from query param:", selectedDate, err);
      }
    }
  }, [selectedDate]);

  // Handle voucher type parameter from URL (optional)
  useEffect(() => {
    if (selectedVoucherType && selectedVoucherType !== voucherTypeFilter) {
      setVoucherTypeFilter(selectedVoucherType);
    }
  }, [selectedVoucherType]);

  // If there was no URL param but a stored voucher type exists, apply it once
  useEffect(() => {
    if (!selectedVoucherType && storedVoucherType && voucherTypeFilter === "all") {
      setVoucherTypeFilter(storedVoucherType);
    }
  }, [storedVoucherType]);

  // Refetch data when dates change
  useEffect(() => {
    // console.log("Dates changed - fromDate:", fromDate, "toDate:", toDate);
    if (fromDate && toDate) {
     
      // console.log("Refetching data with dates:", fromDate, toDate);
      refetch();
    }
  }, [fromDate, toDate, refetch]);


  // Fetch stock journal details for modal
  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: [API_BASE_URL + "/api/get-stock-journals-detail/", selectedTransactionId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/get-stock-journals-detail/${selectedTransactionId}/`, {
        headers: AuthService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stock journal detail: ${response.statusText}`);
      }

      return await response.json();
    },
    enabled: AuthService.isAuthenticated() && !!selectedTransactionId
  });



  // Sync function using API
  const syncMutation = useMutation({
    mutationFn: async (transactionId) => {
      const response = await fetch(API_BASE_URL + "/api/process/sync-to-tally/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify({
          transaction_id: transactionId
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync to Tally: ${response.statusText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transaction synced to Tally successfully",
      });
      refetch(); // Refresh the main data
      // Close modal and show success
      setIsDetailModalOpen(false);
      setSelectedEntry(null);
      setSelectedTransactionId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync to Tally",
        variant: "destructive",
      });
    }
  });

  // Extract unique supervisors from stock journal data and users API
  const supervisors = React.useMemo(() => {
    const supervisorSet = new Set();
    
    // Add supervisors from stock journal data
    if (stockJournalsData?.data) {
      stockJournalsData.data.forEach(entry => {
        if (entry.created_by) {
          supervisorSet.add(entry.created_by);
        }
      });
    }
    
    // Add supervisors from users API
    if (usersData?.data) {
      usersData.data.forEach(user => {
        if (user.name) {
          supervisorSet.add(user.name);
        }
      });
    }
    
    const supervisorList = Array.from(supervisorSet).sort();
    // console.log("🔍 Available supervisors:", supervisorList);
    // console.log("🔍 From stock journal data:", stockJournalsData?.data?.map(entry => entry.created_by) || []);
    // console.log("🔍 From users API:", usersData?.data?.map(user => user.name) || []);
    return supervisorList;
  }, [stockJournalsData, usersData]);


  // Filter stock journals based on search and user filter (client-side, like user-list.jsx)
  const stockJournals = stockJournalsData?.data || [];
  const filteredEntries = stockJournals.filter((entry) => {
    const matchesSearch = entryMatchesSearch(entry, searchTerm);
    const matchesUser =
      !userFilter ||
      userFilter === "all" ||
      entry.created_by === userFilter;
    return matchesSearch && matchesUser;
  });

  // Debug supervisor filtering
  React.useEffect(() => {
    // console.log("🔍 Supervisor filter changed:", userFilter);
    // console.log("🔍 Total entries:", stockJournals.length);
    // console.log("🔍 Filtered entries:", filteredEntries.length);
    
    if (userFilter !== "all") {
      // console.log("🔍 Filtering for supervisor:", userFilter);
      const matchingEntries = stockJournals.filter(entry => entry.created_by === userFilter);
      // console.log("🔍 Entries matching supervisor:", matchingEntries.length);
      // console.log("🔍 Matching entries:", matchingEntries.map(entry => ({
      //   transaction_id: entry.transaction_id,
      //   created_by: entry.created_by
      // })));
    }
  }, [userFilter, stockJournals, filteredEntries]);

  // Pagination data
  const pagination = stockJournalsData?.pagination || {
    current_page: 1,
    page_size: 50,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false
  };

  const handleViewDetails = async (entry) => {
    setSelectedTransactionId(entry.transaction_id);
    setSelectedEntry(entry);
    setIsDetailModalOpen(true);
  };

  const handleSyncToTally = (transactionId) => {
    syncMutation.mutate(transactionId);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const getVoucherTypeBadge = (voucherType) => {
    return <Badge variant="secondary" className="text-black dark:text-white font-normal">{voucherType}</Badge>;
  };

  const getSyncBadge = (isSynced) => {
    return isSynced ? (
      <Badge variant="default" className="bg-gradient-to-r from-black to-gray-800 text-white border-green-400 border-2 pulse-glow">
        <CheckCircle className="mr-1 h-3 w-3 animate-pulse" />
        Synced
      </Badge>
    ) : (
      <Badge variant="default" className="bg-black text-white border-black border-2 animate-pulse">
        <XCircle className="mr-1 h-3 w-3" />
        Not Synced
      </Badge>
    );
  };

  // Get voucher types
  const voucherTypes = voucherTypesData?.data || [];
  
  // Get users
  const users = usersData?.data || [];

  // console.log("Current voucher type filter:", voucherTypeFilter);
  // console.log("Selected voucher type from URL:", selectedVoucherType);



  // Show loading state
  if (isLoading || (isTallyEnabled && syncMutation.isPending)) {
    return <Loader loadingText="Loading stock journal reports..." />;
  }

  // Show error state
  if (error) {
    return (
      <div className="app-layout bg-gray-50 dark:bg-gray-900">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="p-6 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Failed to load stock journals
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error.message}
              </p>
              <Button onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check permissions before rendering
  if (permissionsLoading) {
    return (
      <div className="app-layout bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <div className="flex-1 flex items-center justify-center">
          <Loader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  // Check if user has read permission for stock journals
  // Check exact module name from API: "stock_journals" (plural)
  const hasStockJournalAccess = hasReadPermission("stock_journals");
  const canCreateStockJournal = hasCreatePermission("stock_journals");
  
  if (!hasStockJournalAccess) {
    return (
      <div className="app-layout bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to view stock journal reports.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="app-main-content">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setIsMobileSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="flex items-center space-x-2">
                  <FileText className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Stock Journal Reports
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Manage production and consumption entries
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {canCreateStockJournal && (
                  <Button size="sm" onClick={() => setLocation("/stock-journal/add")}>
                    Add Journal Entry
                  </Button>
                )}
                <Badge variant="outline" className="text-xs">
                  {searchTerm.trim()
                    ? `${filteredEntries.length} filtered`
                    : `${pagination.total_count} entries`}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-4">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Filter className="h-5 w-5" />
                    <span>Filters</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                    <div className="min-w-0">
                      <Label htmlFor="dateRangePreset" className="mb-1.5 block text-sm font-medium">Date Range</Label>
                      <Select
                        value={dateRangePreset}
                        onValueChange={(value) => {
                          setDateRangePreset(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger id="dateRangePreset" className="h-10 w-full">
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
                    <div className="min-w-0">
                      <Label htmlFor="fromDate" className="mb-1.5 block text-sm font-medium">From Date</Label>
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
                            className={`h-10 w-full justify-start text-left font-normal ${
                              dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {fromDate ? formatDateForApi(fromDate) : "From Date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            key={`from-${fromDate?.getTime() || "null"}`}
                            mode="single"
                            selected={fromDate}
                            onSelect={(date) => {
                              setFromDate(date);
                              if (date) {
                                const formattedDate = format(date, "yyyy-MM-dd");
                                localStorage.setItem("DashboardStartDate", formattedDate);
                              }
                              setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toDate" className="mb-1.5 block text-sm font-medium">To Date</Label>
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
                            className={`h-10 w-full justify-start text-left font-normal ${
                              dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {toDate ? formatDateForApi(toDate) : "To Date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            key={`to-${toDate?.getTime() || "null"}`}
                            mode="single"
                            selected={toDate}
                            onSelect={(date) => {
                              setToDate(date);
                              if (date) {
                                const formattedDate = format(date, "yyyy-MM-dd");
                                localStorage.setItem("DashboardStartDate", formattedDate);
                              }
                              setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="voucherTypeFilter" className="mb-1.5 block text-sm font-medium">Voucher Type</Label>
                      <Select value={voucherTypeFilter} onValueChange={setVoucherTypeFilter}>
                        <SelectTrigger id="voucherTypeFilter" className="h-10 w-full min-w-0">
                          <SelectValue placeholder="Select Voucher Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Voucher Types</SelectItem>
                          {voucherTypes.map((type) => (
                            <SelectItem key={type.id} value={type.name}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="supervisorFilter" className="mb-1.5 block text-sm font-medium">Supervisor</Label>
                      <Popover open={supervisorDropdownOpen} onOpenChange={setSupervisorDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="supervisorFilter"
                            variant="outline"
                            role="combobox"
                            aria-expanded={supervisorDropdownOpen}
                            className="h-10 w-full min-w-0 justify-between text-left font-normal"
                          >
                            <span className="truncate text-left">
                              {userFilter === "all" ? "All Supervisors" : userFilter || "Select Supervisor"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start" side="bottom" sideOffset={4}>
                          <Command>
                            <CommandInput placeholder="Search supervisors..." />
                            <CommandList>
                              <CommandEmpty>
                                {supervisors.length === 0 ? "No supervisors found." : "No supervisors match your search."}
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  key="all"
                                  value="all"
                                  onSelect={() => handleSupervisorChange("all")}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check
                                      className={`h-4 w-4 ${
                                        userFilter === "all" ? "opacity-100 text-blue-600" : "opacity-0"
                                      }`}
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900">All Supervisors</div>
                                    </div>
                                  </div>
                                </CommandItem>
                                {supervisors.map((supervisor) => (
                                  <CommandItem
                                    key={supervisor}
                                    value={supervisor}
                                    onSelect={() => handleSupervisorChange(supervisor)}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${
                                          userFilter === supervisor ? "opacity-100 text-blue-600" : "opacity-0"
                                        }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">{supervisor}</div>
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:flex-wrap">
                    {isTallyEnabled && (
                      <div className="min-w-0 w-full lg:w-44 shrink-0">
                        <Label htmlFor="syncFilter" className="mb-1.5 block text-sm font-medium">Tally Sync</Label>
                        <Select value={syncFilter} onValueChange={setSyncFilter}>
                          <SelectTrigger id="syncFilter" className="h-10 w-full">
                            <SelectValue placeholder="Sync Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="synced">Synced</SelectItem>
                            <SelectItem value="not_synced">Not Synced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 w-full">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          id="stock-journal-search"
                          placeholder="Search by transaction ID, voucher no., voucher type, or created by..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-10"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        onClick={() => {
                          setCurrentPage(1);
                          refetch();
                        }}
                        disabled={isLoading}
                        className="bg-black hover:bg-gray-800"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Apply Filters
                      </Button>
                      <Button variant="outline" onClick={handleClearFilters}>
                        Clear Filters
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => refetch()}
                        disabled={isLoading}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {filteredEntries.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No stock journal entries found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Try adjusting your search criteria or filters.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredEntries.map((entry, index) => (
                  <Card
                    key={entry.transaction_id}
                    className="card-hover-effect border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-all duration-500 transform hover:scale-[1.02]"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animation: 'fade-in-up 0.6s ease-out forwards'
                    }}
                  >
                    <CardContent className="p-6 relative overflow-hidden">
                      {/* Animated background gradient */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -skew-y-1 transform scale-110 opacity-0 hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-3">
                              <div className="flex items-center space-x-2">
                                <Hash className="h-4 w-4 text-gray-500" />
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {entry.transaction_id}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {entry.voucher_number}
                                </span>
                              </div>
                              {getVoucherTypeBadge(entry.voucher_type_name)}
                              {isTallyEnabled && getSyncBadge(entry.is_tally_synced)}
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                 Branch: {entry.branch}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                               <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                <span className="text-gray-900 dark:text-white">{entry.created_at}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                                <span className="text-gray-900 dark:text-white font-bold">{entry.voucher_type_name}</span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-600 dark:text-gray-400">Entered by:</span>
                                <span className="text-gray-900 dark:text-white font-medium">{entry.created_by || "N/A"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(entry)}
                              className="flex items-center space-x-1 bg-gradient-to-r from-black to-gray-800 text-white border-2 border-black hover:text-white hover:scale-110 transition-all duration-300 hover:shadow-xl hover:shadow-black/50"
                            >
                              <Eye className="h-4 w-4 animate-pulse" />
                              <span className="font-semibold">View Details</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {searchTerm.trim() && (
                <Card className="mt-4 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Search className="h-4 w-4 shrink-0" />
                      <span>
                        Found {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"} matching &quot;{searchTerm.trim()}&quot; on this page
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pagination */}
              {!searchTerm.trim() && filteredEntries.length > 0 && (
                <Card className="mt-6">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>
                          Showing {filteredEntries.length} of {pagination.total_count} entries
                        </span>
                        <span>•</span>
                        <span>
                          Page {pagination.current_page} of {pagination.total_pages}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.current_page - 1)}
                          disabled={!pagination.has_previous}
                          className="flex items-center space-x-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Previous</span>
                        </Button>

                        <div className="flex items-center space-x-1">
                          {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                            const pageNum = Math.max(1, pagination.current_page - 2) + i;
                            if (pageNum > pagination.total_pages) return null;

                            return (
                              <Button
                                key={pageNum}
                                variant={pageNum === pagination.current_page ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(pageNum)}
                                className="w-8 h-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.current_page + 1)}
                          disabled={!pagination.has_next}
                          className="flex items-center space-x-1"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Stock Journal Details - {selectedEntry?.transaction_id}</span>
            </DialogTitle>
            <DialogDescription>
              Detailed view of inventory entries for voucher {selectedEntry?.voucher_number}
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader loadingText="Loading transaction details..." />
            </div>
          ) : selectedEntry && detailData?.data ? (
            <div className="space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white dark:bg-gray-900 rounded-lg border-2 border-black shadow-xl">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-black dark:text-white">Transaction ID:</span>
                    <span className="text-sm text-black dark:text-white font-bold">{detailData.data.transaction_id}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-black dark:text-white">Voucher Number:</span>
                    <span className="text-sm text-black dark:text-white font-bold">{detailData.data.voucher_number}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-black dark:text-white">Date:</span>
                    <span className="text-sm text-black dark:text-white font-bold">{detailData.data.date}</span>
                  </div>
                  {detailData?.data?.remarks && (
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-black dark:text-white">Remarks:</span>
                      <span className="text-sm text-black dark:text-white font-bold">{detailData.data.remarks}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-black dark:text-white">Voucher Type:</span>
                    <span className="text-sm text-black dark:text-white font-bold">{detailData.data.voucher_type_name}</span>
                  </div>
                  {detailData?.data?.destination_godown && (
                    <div className="flex items-center space-x-2">
                      <Warehouse className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-black dark:text-white">Destination Godown:</span>
                      <span className="text-sm text-black dark:text-white font-bold">{detailData.data.destination_godown}</span>
                    </div>
                  )}
                  {isTallyEnabled && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-black dark:text-white">Tally Sync:</span>
                        {getSyncBadge(selectedEntry.is_tally_synced)}
                      </div>
                      {!selectedEntry.is_tally_synced && (
                        <Button
                          onClick={() => handleSyncToTally(selectedEntry.transaction_id)}
                          disabled={syncMutation.isPending}
                          className="bg-black hover:bg-gray-800 text-white"
                          size="sm"
                        >
                          {syncMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RotateCw className="h-4 w-4 mr-2" />
                          )}
                          Sync Now
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end pt-1">
                    <Button
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        setLocation(`/stock-journal/add?transaction_id=${selectedEntry.transaction_id}`);
                      }}
                      className="bg-black hover:bg-gray-800 text-white"
                      size="sm"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Entry
                    </Button>
                  </div>
                </div>
              </div>

              {/* Inventory Entries In */}
              {detailData.data.inventory_entries_in && detailData.data.inventory_entries_in.length > 0 && (
                <div style={{ animation: 'slide-in-left 0.6s ease-out forwards' }}>
                  <h4 className="flex items-center space-x-2 text-lg font-semibold mb-4 bg-black text-white p-3 rounded-lg border-2 border-red-500   shadow-lg">
                    <ArrowRight className="h-5 w-5 animate-bounce" />
                    <span>Source</span>
                  </h4> 
                  <div className="space-y-4">
                    {detailData.data.inventory_entries_out.map((entry, index) => (
                      <Card
                        key={index}
                        className="bg-white dark:bg-gray-900 border-2 border-red-500 card-hover-effect transform transition-all duration-500 hover:scale-105"
                        style={{
                          animationDelay: `${index * 200}ms`,
                          animation: 'fade-in-up 0.6s ease-out forwards'
                        }}
                      >
                        <CardContent className="p-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent -skew-y-1 transform scale-110 opacity-0 hover:opacity-100 transition-opacity duration-700"></div>
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-bold text-black dark:text-white text-lg">
                                {entry.stock_item}
                              </h5>
                              <Badge variant="outline" className="bg-white text-black border-red-500 border-2 font-bold text-lg px-3 py-1 pulse-glow">
                                {entry.actual_qty?.full_text || 'N/A'}
                              </Badge>
                            </div>
                            {entry.batch_allocations && entry.batch_allocations.length > 0 && (
                              <div className="space-y-2">
                                {entry.batch_allocations.map((batch, batchIndex) => (
                                  <div key={batchIndex} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 text-black dark:text-white p-3 rounded border-2 border-red-500 hover:scale-105 transition-transform duration-300">
                                    <div className="flex items-center space-x-2">
                                      <Package className="h-4 w-4 text-red-400 animate-pulse" />
                                      <span className="font-bold text-black dark:text-white">{batch.batch_name}</span>
                                      <span className="text-red-500">•</span>
                                      <span className="text-black dark:text-white">{batch.godown}</span>
                                    </div>
                                    <span className="font-bold text-black dark:text-white">{batch.actual_qty?.full_text || 'N/A'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventory Entries Out */}
              {detailData.data.inventory_entries_out && detailData.data.inventory_entries_out.length > 0 && (
                <div style={{ animation: 'slide-in-right 0.6s ease-out forwards' }}>
                  <h4 className="flex items-center space-x-2 text-lg font-semibold mb-4 bg-black text-white p-3 rounded-lg  border-2 border-green-500 shadow-lg">
                    <ArrowLeft className="h-5 w-5 animate-bounce" />
                    <span>Destination</span>
                  </h4>
                  <div className="space-y-4">
                    {detailData.data.inventory_entries_in.map((entry, index) => (
                      <Card
                        key={index}
                        className="bg-white dark:bg-gray-900 border-2 border-green-500 card-hover-effect transform transition-all duration-500 hover:scale-105"
                        style={{
                          animationDelay: `${index * 200}ms`,
                          animation: 'fade-in-up 0.6s ease-out forwards'
                        }}
                      >
                        <CardContent className="p-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent -skew-y-1 transform scale-110 opacity-0 hover:opacity-100 transition-opacity duration-700"></div>
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-bold text-black dark:text-white text-lg">
                                {entry.stock_item}
                              </h5>
                              <Badge variant="outline" className="bg-white text-black border-green-500 border-2 font-bold text-lg px-3 py-1 pulse-glow">
                                {entry.actual_qty?.full_text || 'N/A'}
                              </Badge>
                            </div>
                            {entry.batch_allocations && entry.batch_allocations.length > 0 && (
                              <div className="space-y-2">
                                {entry.batch_allocations.map((batch, batchIndex) => (
                                  <div key={batchIndex} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 text-black dark:text-white p-3 rounded border-2 border-green-500 hover:scale-105 transition-transform duration-300">
                                    <div className="flex items-center space-x-2">
                                      <Package className="h-4 w-4 text-green-400 animate-pulse" />
                                      <span className="font-bold text-black dark:text-white">{batch.batch_name}</span>
                                      <span className="text-green-500">•</span>
                                      <span className="text-black dark:text-white">{batch.godown}</span>
                                    </div>
                                    <span className="font-bold text-black dark:text-white">{batch.actual_qty?.full_text || 'N/A'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Timestamps */}
              {(detailData.data.created_at || detailData.data.updated_at) && (
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  {detailData.data.created_at && <span>Created: {detailData.data.created_at}</span>}
                  {detailData.data.updated_at && <span>Updated: {detailData.data.updated_at}</span>}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-500">No details available for this transaction.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}