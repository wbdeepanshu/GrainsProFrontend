import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import {
  Menu,
  Search,
  Eye,
  Calendar,
  CalendarIcon,
  Filter,
  ArrowLeft,
  Route,
  Loader2,
  Check,
  ChevronsUpDown,
  MapPin,
  User,
  Building,
  Activity,
  Image as ImageIcon,
  FileText,
  Minus,
  Plus,
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function getRouteDisplayName(route) {
  return route?.name || route?.route_name || `Route ${route?.id ?? ""}`;
}

function SearchableFilterCombobox({
  label,
  allLabel,
  value,
  onSelect,
  options = [],
  disabled = false,
  searchPlaceholder = "Search...",
  emptyMessage = "No results match your search.",
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (value === "all") return allLabel;
    const match = options.find((o) => String(o.id) === String(value));
    return match?.label ?? allLabel;
  }, [value, options, allLabel]);

  const handleSelect = (nextValue) => {
    onSelect(nextValue);
    setOpen(false);
  };

  return (
    <div>
      <Label className="text-sm font-medium text-gray-700 mb-2 block">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-10 font-normal"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 z-50"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command shouldFilter>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={allLabel.toLowerCase()}
                  onSelect={() => handleSelect("all")}
                  className="cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-4 w-4 shrink-0 ${value === "all" ? "opacity-100" : "opacity-0"
                      }`}
                  />
                  {allLabel}
                </CommandItem>
                {options.map((option) => (
                  <CommandItem
                    key={option.key ?? option.id}
                    value={`${option.label} ${option.id}`}
                    onSelect={() => handleSelect(String(option.id))}
                    className="cursor-pointer"
                  >
                    <Check
                      className={`mr-2 h-4 w-4 shrink-0 ${String(value) === String(option.id) ? "opacity-100" : "opacity-0"
                        }`}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function RouteActivity() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [ledgerGroupFilter, setLedgerGroupFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [salesmanFilter, setSalesmanFilter] = useState("all");
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfDay(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfDay(now), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("today"); // "today" | "weekly" | "monthly" | "custom"
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Get user permissions
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  // Apply date range preset: set fromDate/toDate when preset is today/weekly/monthly
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
    setCurrentPage(1);
  }, [
    routeFilter,
    ledgerGroupFilter,
    customerFilter,
    activityFilter,
    salesmanFilter,
    fromDate,
    toDate,
    dateRangePreset,
  ]);

  const handleClearFilters = () => {
    setRouteFilter("all");
    setLedgerGroupFilter("all");
    setCustomerFilter("all");
    setActivityFilter("all");
    setSalesmanFilter("all");
    setDateRangePreset("today");
    const n = new Date();
    setFromDate(format(startOfDay(n), "yyyy-MM-dd"));
    setToDate(format(endOfDay(n), "yyyy-MM-dd"));
    setCurrentPage(1);
  };

  // Build query parameters for API call
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('per_page', pageSize.toString());
    if (routeFilter && routeFilter !== 'all') params.append('route_id', routeFilter);
    if (customerFilter && customerFilter !== 'all') params.append('customer_id', customerFilter);
    if (activityFilter && activityFilter !== 'all') params.append('activity_id', activityFilter);
    if (salesmanFilter && salesmanFilter !== 'all') params.append('salesman_id', salesmanFilter);
    if (fromDate && fromDate.trim() !== "") params.append("from_date", fromDate.trim());
    if (toDate && toDate.trim() !== "") params.append("to_date", toDate.trim());
    return params.toString();
  };

  // Fetch route activities from API
  const { data: activitiesData, isLoading, error, refetch } = useQuery({
    queryKey: [
      "route-activities",
      routeFilter,
      customerFilter,
      activityFilter,
      salesmanFilter,
      fromDate,
      toDate,
      currentPage,
    ],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/growth/route/activities/${queryParams ? `?${queryParams}` : ''}`;
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch routes for filter dropdown
  const { data: routesData } = useQuery({
    queryKey: ['routes-dropdown'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/growth/route/list/?per_page=100`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch ledger groups for filter dropdown
  const { data: ledgerGroupsData } = useQuery({
    queryKey: ['ledger-groups-dropdown'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-groups/?per_page=100&is_active=true`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch customers for filter dropdown - filtered by ledger group if selected
  const { data: customersData } = useQuery({
    queryKey: ['customers-dropdown', ledgerGroupFilter],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/sales/get-customers/?per_page=100`;
      if (ledgerGroupFilter && ledgerGroupFilter !== 'all') {
        url += `&ledger_group_id=${ledgerGroupFilter}`;
      }
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch activity names for filter dropdown
  const { data: activitiesListData } = useQuery({
    queryKey: ['activity-names'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/growth/get-list/?type=route_activity_name`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch salesmen for filter dropdown
  const { data: salesmenData } = useQuery({
    queryKey: ['salesmen'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const routeOptions = useMemo(
    () =>
      (routesData || []).map((route) => ({
        id: String(route.id),
        label: getRouteDisplayName(route),
        key: route.id,
      })),
    [routesData]
  );

  const ledgerGroupOptions = useMemo(
    () =>
      (ledgerGroupsData || []).map((group) => ({
        id: String(group.id),
        label: group.name || `Group ${group.id}`,
        key: group.id,
      })),
    [ledgerGroupsData]
  );

  const customerOptions = useMemo(
    () =>
      (customersData || []).map((customer) => ({
        id: String(customer.id),
        label: customer.name || `Customer ${customer.id}`,
        key: customer.id,
      })),
    [customersData]
  );

  const activityNameOptions = useMemo(
    () =>
      (activitiesListData || []).map((activity) => ({
        id: String(activity.id),
        label: activity.name || `Activity ${activity.id}`,
        key: activity.id,
      })),
    [activitiesListData]
  );

  const salesmanOptions = useMemo(
    () =>
      (salesmenData || []).map((salesman) => ({
        id: String(salesman.user_id),
        label: salesman.name || `User ${salesman.user_id}`,
        key: salesman.user_id,
      })),
    [salesmenData]
  );

  const activities = activitiesData?.data || [];
  const totalCount = activitiesData?.count || activities.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNext = currentPage < totalPages;
  const hasPrevious = currentPage > 1;

  const {
    data: activityDetailResponse,
    isLoading: isActivityDetailLoading,
    isError: isActivityDetailError,
  } = useQuery({
    queryKey: ["route-activity-detail", selectedActivityId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/growth/route/activity/${selectedActivityId}/detail/`
      );
      return response.json();
    },
    enabled: !!selectedActivityId && isDetailModalOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const selectedActivity = activityDetailResponse?.data || null;
  const activityImages = useMemo(() => {
    if (!selectedActivity) return [];
    let raw = [];
    if (Array.isArray(selectedActivity.images) && selectedActivity.images.length > 0) {
      raw = selectedActivity.images;
    } else if (selectedActivity.image_url) {
      raw = [selectedActivity.image_url];
    }
    return raw
      .map((img, index) => {
        const url =
          typeof img === "string"
            ? img
            : img?.image_url || img?.url || img?.src || "";
        if (!String(url).trim()) return null;
        return {
          url: String(url).trim(),
          label: (typeof img === "object" && (img?.type_display || img?.type || img?.name)) || `Image ${index + 1}`,
        };
      })
      .filter(Boolean);
  }, [selectedActivity]);

  const openImageViewer = (imageUrl) => {
    setSelectedImageUrl(imageUrl);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setIsDragging(false);
    setIsImageDialogOpen(true);
  };

  const handleViewDetails = (activity) => {
    setSelectedActivityId(activity.id);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = (open) => {
    setIsDetailModalOpen(open);
    if (!open) {
      setSelectedActivityId(null);
      setIsImageDialogOpen(false);
      setSelectedImageUrl(null);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'dd-MM-yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (!hasReadPermission("route_management")) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Route className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view route activities. Contact your administrator for access.
              </p>
              <Button onClick={() => window.history.back()} variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Route Activity</h1>
              <p className="text-gray-600">View and manage route activities</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date().toLocaleDateString('en-GB')}
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 min-h-0">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateRangePreset" className="text-sm font-medium text-gray-700">
                      Date Range
                    </Label>
                    <Select
                      value={dateRangePreset}
                      onValueChange={(value) => {
                        setDateRangePreset(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger id="dateRangePreset" className="h-10">
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

                  <div className="space-y-2">
                    <Label htmlFor="fromDate" className="text-sm font-medium text-gray-700">
                      From Date
                    </Label>
                    <Popover
                      open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                      onOpenChange={(open) => {
                        if (dateRangePreset !== "custom") return;
                        setIsDatePickerOpen((prev) => ({ ...prev, from: open }));
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="fromDate"
                          type="button"
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={`h-10 w-full justify-start text-left font-normal ${dateRangePreset !== "custom"
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : ""
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
                          key={`route-from-${fromDate || "null"}`}
                          mode="single"
                          selected={fromDate ? new Date(fromDate) : undefined}
                          onSelect={(selected) => {
                            if (!selected) return;
                            const iso = format(selected, "yyyy-MM-dd");
                            setFromDate(iso);
                            if (toDate && iso > toDate) setToDate(iso);
                            setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                          }}
                          disabled={{ after: new Date() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toDate" className="text-sm font-medium text-gray-700">
                      To Date
                    </Label>
                    <Popover
                      open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                      onOpenChange={(open) => {
                        if (dateRangePreset !== "custom") return;
                        setIsDatePickerOpen((prev) => ({ ...prev, to: open }));
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="toDate"
                          type="button"
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={`h-10 w-full justify-start text-left font-normal ${dateRangePreset !== "custom"
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : ""
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
                          key={`route-to-${toDate || "null"}`}
                          mode="single"
                          selected={toDate ? new Date(toDate) : undefined}
                          onSelect={(selected) => {
                            if (!selected) return;
                            const iso = format(selected, "yyyy-MM-dd");
                            setToDate(iso);
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

                  <SearchableFilterCombobox
                    label="Route"
                    allLabel="All Routes"
                    value={routeFilter}
                    onSelect={(value) => {
                      setRouteFilter(value);
                      setCurrentPage(1);
                    }}
                    options={routeOptions}
                    searchPlaceholder="Search routes..."
                    emptyMessage="No routes match your search."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                  <SearchableFilterCombobox
                    label="Ledger Group"
                    allLabel="All Ledger Groups"
                    value={ledgerGroupFilter}
                    onSelect={(value) => {
                      setLedgerGroupFilter(value);
                      setCustomerFilter("all");
                      setCurrentPage(1);
                    }}
                    options={ledgerGroupOptions}
                    searchPlaceholder="Search ledger groups..."
                    emptyMessage="No ledger groups match your search."
                  />

                  <SearchableFilterCombobox
                    label="Customer"
                    allLabel="All Customers"
                    value={customerFilter}
                    onSelect={(value) => {
                      setCustomerFilter(value);
                      setCurrentPage(1);
                    }}
                    options={customerOptions}
                    disabled={
                      ledgerGroupFilter !== "all" && customerOptions.length === 0
                    }
                    searchPlaceholder="Search customers..."
                    emptyMessage={
                      ledgerGroupFilter !== "all" && customerOptions.length === 0
                        ? "No customers in this ledger group."
                        : "No customers match your search."
                    }
                  />

                  <SearchableFilterCombobox
                    label="Activity"
                    allLabel="All Activities"
                    value={activityFilter}
                    onSelect={(value) => {
                      setActivityFilter(value);
                      setCurrentPage(1);
                    }}
                    options={activityNameOptions}
                    searchPlaceholder="Search activities..."
                    emptyMessage="No activities match your search."
                  />

                  <SearchableFilterCombobox
                    label="Salesman"
                    allLabel="All Salesmen"
                    value={salesmanFilter}
                    onSelect={(value) => {
                      setSalesmanFilter(value);
                      setCurrentPage(1);
                    }}
                    options={salesmanOptions}
                    searchPlaceholder="Search salesmen..."
                    emptyMessage="No salesmen match your search."
                  />

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={handleClearFilters}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activities List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Route Activities ({activities.length})</span>
                  </div>
                  <Badge variant="outline">
                    Total: {totalCount}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-4">
                            <Badge variant="secondary" className="flex items-center space-x-1">
                              <Activity className="h-3 w-3" />
                              <span>{activity.activity_name || activity.activity?.name || 'N/A'}</span>
                            </Badge>
                            {activity.route_name || activity.route?.name ? (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Route className="h-3 w-3" />
                                <span>{activity.route_name || activity.route?.name}</span>
                              </Badge>
                            ) : null}
                            {activity.approval_status && activity.approval_status !== 'APPROVED' && (
                              <Badge variant={activity.approval_status === 'PENDING' ? 'secondary' : 'destructive'} className="flex items-center space-x-1">
                                <span>{activity.approval_status}</span>
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-500">Customer:</span>
                              <p className="font-semibold">{activity.customer_name || activity.customer?.name || "-"}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Amount:</span>
                              <p className="font-semibold">
                                {activity.amount ? `₹${parseFloat(activity.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Salesman:</span>
                              <p className="font-semibold">{activity.salesman_name || activity.salesman?.username || activity.salesman?.name || "-"}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Visit Date:</span>
                              <p className="font-semibold">{formatDate(activity.visit_date)}</p>
                            </div>


                          </div>
                          {activity.remarks && (
                            <div className="text-sm">
                              <span className="font-medium text-gray-500">Remarks: </span>
                              <span className="text-gray-700">{activity.remarks}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(activity)}
                            className="flex items-center space-x-1"
                          >
                            <Eye className="h-4 w-4" />
                            <span>View</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {activities.length === 0 && (
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No route activities found</p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} activities
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!hasPrevious}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!hasNext}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Activity Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={handleCloseDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Activity Details</span>
            </DialogTitle>
          </DialogHeader>

          {isActivityDetailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : isActivityDetailError || !selectedActivity ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Failed to load activity details</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Activity Name</Label>
                  <p className="text-lg font-semibold">{selectedActivity.activity_name || selectedActivity.activity?.name || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Visit Date</Label>
                  <p className="text-lg font-semibold">{formatDate(selectedActivity.visit_date)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Route</Label>
                  <p className="text-lg font-semibold">{selectedActivity.route_name || selectedActivity.route?.name || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Amount</Label>
                  <p className="text-lg font-semibold">
                    {selectedActivity.amount ? `₹ ${parseFloat(selectedActivity.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Customer</Label>
                  <p className="text-lg font-semibold">{selectedActivity.customer_name || selectedActivity.customer?.name || "-"}</p>
                  {selectedActivity.customer?.firm_name && (
                    <p className="text-sm text-gray-600">{selectedActivity.customer.firm_name}</p>
                  )}
                  {selectedActivity.customer?.parent && (
                    <p className="text-sm text-gray-600">Ledger Group: {selectedActivity.customer.parent}</p>
                  )}
                  {selectedActivity.customer?.contact_number && (
                    <p className="text-sm text-gray-600">Contact: {selectedActivity.customer.contact_number}</p>
                  )}
                </div>
                {(selectedActivity.sales_order?.order_id || selectedActivity.sales_order_id) && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Sales Order</Label>
                    <p className="text-lg font-semibold">
                      {selectedActivity.sales_order?.order_id || selectedActivity.sales_order_id}
                    </p>
                    {selectedActivity.sales_order?.order_date && (
                      <p className="text-sm text-gray-600">Date: {formatDate(selectedActivity.sales_order.order_date)}</p>
                    )}
                    {selectedActivity.sales_order?.status && (
                      <p className="text-sm text-gray-600">Status: {selectedActivity.sales_order.status}</p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-500">Salesman</Label>
                  <p className="text-lg font-semibold">{selectedActivity.salesman_name || selectedActivity.salesman?.name || "-"}</p>
                  {selectedActivity.salesman?.mobile && (
                    <p className="text-sm text-gray-600">{selectedActivity.salesman.mobile}</p>
                  )}
                  {selectedActivity.salesman?.email && (
                    <p className="text-sm text-gray-600">{selectedActivity.salesman.email}</p>
                  )}
                </div>
                {(selectedActivity.branch?.name || selectedActivity.branch_name) && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Branch</Label>
                    <p className="text-lg font-semibold">
                      {selectedActivity.branch?.name || selectedActivity.branch_name}
                    </p>
                  </div>
                )}

                {(selectedActivity.remarks) && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Remarks</Label>
                    <p className="text-lg font-semibold">
                      {selectedActivity.remarks}
                    </p>
                  </div>
                )}


                {selectedActivity.scheduled_date && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Scheduled Date</Label>
                    <p className="text-lg font-semibold">{formatDate(selectedActivity.scheduled_date)}</p>
                    {selectedActivity.is_scheduled_day_visit !== undefined && (
                      <Badge variant={selectedActivity.is_scheduled_day_visit ? "default" : "secondary"} className="mt-1">
                        {selectedActivity.is_scheduled_day_visit ? "On Schedule" : "Off Schedule"}
                      </Badge>
                    )}
                  </div>
                )}
                {selectedActivity.approved_by?.name && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Approved By</Label>
                    <p className="text-lg font-semibold">{selectedActivity.approved_by.name}</p>
                    {selectedActivity.approved_at && (
                      <p className="text-sm text-gray-600">{formatDate(selectedActivity.approved_at)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Address Information */}
              {(selectedActivity.address || selectedActivity.customer?.address) && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-gray-500 mb-2 block">Address</Label>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm">
                      {selectedActivity.address || selectedActivity.customer?.address || "-"}
                    </p>
                    {(selectedActivity.city || selectedActivity.state || selectedActivity.pincode) && (
                      <p className="text-sm mt-2">
                        {[selectedActivity.city, selectedActivity.state, selectedActivity.pincode].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {(selectedActivity.lat && selectedActivity.long) && (
                      <p className="text-xs text-gray-500 mt-2">
                        Coordinates: {selectedActivity.lat}, {selectedActivity.long}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {/* {selectedActivity.remarks && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-gray-500 mb-2 block">Remarks</Label>
                  <p className="text-sm bg-gray-50 p-4 rounded-lg">{selectedActivity.remarks}</p>
                </div>
              )} */}

              {/* Approval remarks */}
              {selectedActivity.approval_remarks && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-gray-500 mb-2 block">Approval Remarks</Label>
                  <p className="text-sm bg-gray-50 p-4 rounded-lg">{selectedActivity.approval_remarks}</p>
                </div>
              )}

              {/* Images */}
              {activityImages.length > 0 && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-gray-500 mb-2 block flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Images ({activityImages.length})
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {activityImages.map((image, index) => (
                      <button
                        key={`${image.url}-${index}`}
                        type="button"
                        onClick={() => openImageViewer(image.url)}
                        className="group relative bg-gray-50 border rounded-md overflow-hidden hover:border-blue-400 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title={`View ${image.label}`}
                      >
                        <img
                          src={image.url}
                          alt={image.label}
                          className="w-full h-20 sm:h-24 object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click an image to view with zoom</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog
        open={isImageDialogOpen}
        onOpenChange={(open) => {
          setIsImageDialogOpen(open);
          if (!open) {
            setIsDragging(false);
            setSelectedImageUrl(null);
            setImageZoom(1);
            setImagePosition({ x: 0, y: 0 });
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 z-[100]">
          {selectedImageUrl && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle className="flex items-center space-x-2">
                  <ImageIcon className="h-5 w-5" />
                  <span>Activity Image</span>
                </DialogTitle>
              </DialogHeader>

              <div
                className="relative flex items-center justify-center bg-black/50 p-6 min-h-[360px] max-h-[65vh] overflow-hidden cursor-move"
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    setIsDragging(true);
                    setDragStart({
                      x: e.clientX - imagePosition.x,
                      y: e.clientY - imagePosition.y,
                    });
                  }
                }}
                onMouseMove={(e) => {
                  if (isDragging) {
                    setImagePosition({
                      x: e.clientX - dragStart.x,
                      y: e.clientY - dragStart.y,
                    });
                  }
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? -0.1 : 0.1;
                  setImageZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
                }}
              >
                <div
                  className="relative inline-block"
                  style={{
                    transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.1s ease-out",
                    cursor: isDragging ? "grabbing" : "grab",
                  }}
                >
                  <img
                    src={selectedImageUrl}
                    alt="Activity image"
                    className="max-w-full max-h-[60vh] object-contain select-none"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImageZoom((prev) => Math.max(0.5, prev - 0.25))}
                    disabled={imageZoom <= 0.5}
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Zoom Out
                  </Button>
                  <span className="text-sm text-gray-600 px-2">{Math.round(imageZoom * 100)}%</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImageZoom((prev) => Math.min(3, prev + 0.25))}
                    disabled={imageZoom >= 3}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Zoom In
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImageZoom(1);
                      setImagePosition({ x: 0, y: 0 });
                    }}
                  >
                    Reset
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImageDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
