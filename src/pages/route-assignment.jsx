import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, eachDayOfInterval, isSameDay, eachMonthOfInterval } from "date-fns";
import { useIsMobile } from "../hooks/use-mobile";
import { useDebounce } from "../hooks/use-debounce";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import { Calendar } from "../components/ui/calendar";
import {
  Menu,
  Search,
  Eye,
  FileText,
 // Calendar,
  CalendarDays,
  Filter,
  DollarSign,
  User,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Route,
  Loader2,
  Plus,
  ArrowLeft,
  Package,
  Download,
  MapPin,
  Users,
  Save,
  X,
  Trash2,
  UserPlus,
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronDown,
  Check,
  ChevronsUpDown,
  Pencil,
  History,
  RotateCcw
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const getRouteDisplayName = (route) =>
  route?.name || route?.route_name || `Route ${route?.id ?? ""}`;

const normalizeSalesmanId = (value) => String(value ?? "").trim();

/** Keep salesman_list entries unique (string IDs) — prevents duplicate badges from type mismatch or double handlers. */
const getUniqueSalesmanList = (list) => {
  const seen = new Set();
  const unique = [];
  for (const id of list || []) {
    const normalized = normalizeSalesmanId(id);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
};

const isSalesmanInList = (list, userId) => {
  const target = normalizeSalesmanId(userId);
  return getUniqueSalesmanList(list).includes(target);
};

const toggleSalesmanInList = (list, userId) => {
  const target = normalizeSalesmanId(userId);
  const current = getUniqueSalesmanList(list);
  if (current.includes(target)) {
    return current.filter((id) => id !== target);
  }
  return [...current, target];
};

const findSalesmanByListId = (salesmenData, id) => {
  const target = normalizeSalesmanId(id);
  return (salesmenData || []).find(
    (s) =>
      normalizeSalesmanId(s.user_id) === target ||
      normalizeSalesmanId(s.salesman_id) === target ||
      normalizeSalesmanId(s.id) === target
  );
};

const dedupeSalesmenData = (salesmenData) => {
  const seen = new Set();
  return (salesmenData || []).filter((s) => {
    const id = normalizeSalesmanId(s.user_id ?? s.salesman_id ?? s.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const getSelectedSalesmanMeta = (filterId, salesmenData = []) => {
  const target = normalizeSalesmanId(filterId);
  return salesmenData.find(
    (salesman) =>
      normalizeSalesmanId(salesman.user_id) === target ||
      normalizeSalesmanId(salesman.id) === target ||
      normalizeSalesmanId(salesman.salesman_id) === target
  );
};

const normalizeRouteType = (value) => String(value ?? "").trim().toUpperCase();

const assignmentMatchesRouteTypeFilter = (assignment, filterType) => {
  if (!filterType || filterType === "all") return true;
  return normalizeRouteType(assignment?.route_type) === normalizeRouteType(filterType);
};

const assignmentMatchesSalesmanFilter = (assignment, filterId, salesmenData = []) => {
  if (!filterId || filterId === "all") return true;

  const selected = getSelectedSalesmanMeta(filterId, salesmenData);
  const targetIds = new Set([normalizeSalesmanId(filterId)]);
  if (selected) {
    [selected.user_id, selected.id, selected.salesman_id].forEach((value) => {
      if (value != null && value !== "") targetIds.add(normalizeSalesmanId(value));
    });
  }
  const selectedName = selected?.name?.trim().toLowerCase() || "";

  const salesmen = Array.isArray(assignment?.salesmen) ? assignment.salesmen : [];
  if (salesmen.length > 0) {
    return salesmen.some((salesman) => {
      const ids = [salesman.salesman_id, salesman.user_id, salesman.id]
        .filter(Boolean)
        .map(normalizeSalesmanId);
      if (ids.some((id) => targetIds.has(id))) return true;
      if (selectedName && salesman.salesman_name?.trim().toLowerCase() === selectedName) return true;
      return false;
    });
  }

  const rootIds = [assignment?.salesman_id, assignment?.user_id]
    .filter(Boolean)
    .map(normalizeSalesmanId);
  if (rootIds.some((id) => targetIds.has(id))) return true;
  if (selectedName && assignment?.salesman_name?.trim().toLowerCase() === selectedName) return true;
  return false;
};

const WEEK_DAYS = [
  { id: 1, name: "Monday", value: "monday", short: "Mon" },
  { id: 2, name: "Tuesday", value: "tuesday", short: "Tue" },
  { id: 3, name: "Wednesday", value: "wednesday", short: "Wed" },
  { id: 4, name: "Thursday", value: "thursday", short: "Thu" },
  { id: 5, name: "Friday", value: "friday", short: "Fri" },
  { id: 6, name: "Saturday", value: "saturday", short: "Sat" },
  { id: 7, name: "Sunday", value: "sunday", short: "Sun" },
];

const assignmentMatchesWeeklyDaysFilter = (assignment, filterDayValues) => {
  if (!filterDayValues?.length) return true;
  if (normalizeRouteType(assignment?.route_type) !== "WEEKLY") return false;

  const weeklyDays = assignment?.weekly_days;
  if (!Array.isArray(weeklyDays) || weeklyDays.length === 0) return false;

  const filterIndices = filterDayValues
    .map((dayValue) => WEEK_DAYS.findIndex((d) => d.value === dayValue))
    .filter((idx) => idx >= 0);

  if (filterIndices.length === 0) return true;
  return filterIndices.some((idx) => weeklyDays.includes(idx));
};

const collectCustomerNamesFromAssignment = (assignment) => {
  const names = [];
  const pushName = (value) => {
    const name = String(value || "").trim();
    if (name) names.push(name);
  };

  (Array.isArray(assignment?.customers) ? assignment.customers : []).forEach((customer) => {
    pushName(customer?.customer_name || customer?.name || customer?.party_name);
  });

  (Array.isArray(assignment?.salesmen) ? assignment.salesmen : []).forEach((salesman) => {
    (Array.isArray(salesman?.customers) ? salesman.customers : []).forEach((customer) => {
      pushName(customer?.customer_name || customer?.name || customer?.party_name);
    });
  });

  if (Array.isArray(assignment?.customer_names)) {
    assignment.customer_names.forEach(pushName);
  } else if (typeof assignment?.customer_names === "string") {
    pushName(assignment.customer_names);
  }

  return names;
};

const assignmentHasEmbeddedCustomerNames = (assignment) =>
  collectCustomerNamesFromAssignment(assignment).length > 0;

/** Client-side search (same approach as user-list): match any of the visible fields. */
const assignmentMatchesSearchTerm = (assignment, searchTerm) => {
  const term = String(searchTerm || "").trim().toLowerCase();
  if (!term) return true;

  const routeName = String(
    assignment?.route_name || assignment?.route?.name || assignment?.name || ""
  ).toLowerCase();
  const routeType = String(assignment?.route_type || "").toLowerCase();
  const salesmanRoot = String(assignment?.salesman_name || "").toLowerCase();
  const salesmanNames = (Array.isArray(assignment?.salesmen) ? assignment.salesmen : [])
    .map((s) => String(s?.salesman_name || s?.name || "").toLowerCase())
    .join(" ");
  const salesmanIds = (Array.isArray(assignment?.salesmen) ? assignment.salesmen : [])
    .map((s) => String(s?.salesman_id || s?.user_id || "").toLowerCase())
    .join(" ");
  const customerNames = collectCustomerNamesFromAssignment(assignment)
    .map((name) => name.toLowerCase())
    .join(" ");
  const assignmentId = String(assignment?.assignment_id || assignment?.id || "").toLowerCase();

  return (
    routeName.includes(term) ||
    routeType.includes(term) ||
    salesmanRoot.includes(term) ||
    salesmanNames.includes(term) ||
    salesmanIds.includes(term) ||
    customerNames.includes(term) ||
    assignmentId.includes(term)
  );
};

const getAssignmentRowId = (assignment) =>
  assignment?.assignment_id ?? assignment?.id ?? null;

/** Returns month IDs (1–12) that fall within [startDateStr, endDateStr]. Returns null if either date is missing. */
function getMonthsInDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return null;
  try {
    const start = startOfMonth(new Date(startDateStr));
    const end = endOfMonth(new Date(endDateStr));
    if (start > end) return [];
    const months = eachMonthOfInterval({ start, end });
    return months.map((d) => d.getMonth() + 1);
  } catch {
    return null;
  }
}

// Form validation schema - simplified to only validate form fields
const routeAssignmentSchema = z.object({
  route_id: z.union([z.number(), z.string()]).refine((val) => {
    if (val === null || val === undefined || val === "") return false;
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    return !isNaN(num) && num > 0;
  }, {
    message: "Route is required",
  }),
  salesman_list: z.array(z.union([z.number(), z.string()])).min(1, "At least one salesman is required"),
  customer_list: z.array(z.number()).optional().default([]),
  route_type: z.string().min(1, "Route type is required"),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  // weekly_days and monthly_days are not in form state, they're in component state
  weekly_days: z.any().optional(),
  monthly_days: z.any().optional(),
  change_reason: z.string().optional().nullable(),
});

export default function RouteAssignment() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignRouteDropdownOpen, setAssignRouteDropdownOpen] = useState(false);
  const [assignSalesmenDropdownOpen, setAssignSalesmenDropdownOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [editingMasterId, setEditingMasterId] = useState(null); // when set, assign modal is in "update" mode
  const [searchTerm, setSearchTerm] = useState("");
  const isSearchActive = searchTerm.trim() !== "";
  const [routeFilter, setRouteFilter] = useState("all");
  const [salesmanFilter, setSalesmanFilter] = useState("all");
  const [routeTypeFilter, setRouteTypeFilter] = useState("all");
  const [filterSelectedDays, setFilterSelectedDays] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const debouncedCustomerSearchTerm = useDebounce((customerSearchTerm || "").trim(), 400);
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  // Route type specific states
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]); // For MONTHLY: days (1-31) only
  const [selectedMonthlyMonths, setSelectedMonthlyMonths] = useState([]); // For WEEKLY, MONTHLY: months (1-12)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isOccupancyModalOpen, setIsOccupancyModalOpen] = useState(false);
  const [occupancyMonth, setOccupancyMonth] = useState(new Date().getMonth() + 1);
  const [occupancyYear, setOccupancyYear] = useState(new Date().getFullYear());
  const [occupancySalesmanFilter, setOccupancySalesmanFilter] = useState("");
  const [selectedDayData, setSelectedDayData] = useState(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Reset to page 1 when filters/search change (does not remount the page)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, routeFilter, salesmanFilter, routeTypeFilter, filterSelectedDays]);

  // Normalize legacy lowercase route type filter values (e.g. "weekly" → "WEEKLY")
  useEffect(() => {
    if (routeTypeFilter !== "all") {
      const normalized = normalizeRouteType(routeTypeFilter);
      if (normalized !== routeTypeFilter) {
        setRouteTypeFilter(normalized);
      }
    }
  }, [routeTypeFilter]);

  // Get user permissions
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  const form = useForm({
    resolver: zodResolver(routeAssignmentSchema),
    defaultValues: {
      route_id: null,
      salesman_list: [],
      customer_list: [],
      route_type: "",
      start_date: "",
      end_date: "",
      weekly_days: [],
      monthly_days: [],
    },
  });

  // Fetch assigned routes. Search is purely client-side — never in queryKey (avoids full-page reload while typing).
  const { data: assignmentsData, isLoading, error, refetch } = useQuery({
    queryKey: [
      "route-assignments",
      routeFilter,
      salesmanFilter,
    ],
    queryFn: async ({ queryKey }) => {
      const [, routeId, salesmanId] = queryKey;
      const isSalesmanFiltered = salesmanId && salesmanId !== "all";
      const params = new URLSearchParams();
      // Load a large page once so search/filters can run client-side without refetching on each keystroke
      params.append("page", "1");
      params.append("per_page", "500");
      if (routeId && routeId !== "all") params.append("route_id", String(routeId));
      if (isSalesmanFiltered) params.append("salesman_id", String(salesmanId));
      const queryParams = params.toString();
      const url = `${API_BASE_URL}/api/growth/route/assignments/${queryParams ? `?${queryParams}` : ""}`;
      const response = await apiRequest("GET", url);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const assignmentListRows = assignmentsData?.data || [];

  // Prefetch Assignment Details customers in the background (does not block typing / UI)
  const assignmentIdsNeedingCustomerEnrichment = useMemo(() => {
    return assignmentListRows
      .filter((assignment) => {
        if (assignmentHasEmbeddedCustomerNames(assignment)) return false;
        return Number(assignment?.customers_count ?? 0) > 0;
      })
      .map((assignment) => getAssignmentRowId(assignment))
      .filter((id) => id != null);
  }, [assignmentListRows]);

  const { data: customerEnrichmentByAssignmentId = {} } = useQuery({
    queryKey: ["route-assignments-customer-enrichment", assignmentIdsNeedingCustomerEnrichment],
    queryFn: async () => {
      const entries = await Promise.all(
        assignmentIdsNeedingCustomerEnrichment.map(async (assignmentId) => {
          try {
            const response = await apiRequest(
              "GET",
              `${API_BASE_URL}/api/growth/route/assignment/${assignmentId}/detail/`
            );
            const data = await response.json();
            const detail = data?.data || null;
            if (!detail) return [String(assignmentId), null];
            return [
              String(assignmentId),
              {
                customers: detail.customers || [],
                salesmen: detail.salesmen || [],
              },
            ];
          } catch {
            return [String(assignmentId), null];
          }
        })
      );
      return Object.fromEntries(entries.filter(([, value]) => value != null));
    },
    enabled:
      !!AuthService.getAccessToken() &&
      assignmentIdsNeedingCustomerEnrichment.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Merge detail customers into list rows for client-side search
  const assignmentsForFilter = useMemo(() => {
    return assignmentListRows.map((assignment) => {
      const id = getAssignmentRowId(assignment);
      const enrichment = id != null ? customerEnrichmentByAssignmentId[String(id)] : null;
      if (!enrichment) return assignment;
      return {
        ...assignment,
        customers: enrichment.customers?.length ? enrichment.customers : assignment.customers,
        salesmen: enrichment.salesmen?.length ? enrichment.salesmen : assignment.salesmen,
      };
    });
  }, [assignmentListRows, customerEnrichmentByAssignmentId]);

  // Fetch routes for dropdown
  const { data: routesData } = useQuery({
    queryKey: ['routes-dropdown'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/growth/route/list/?per_page=100`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch salesmen from API
  const { data: salesmenData = [], isLoading: salesmenLoading } = useQuery({
    queryKey: ['salesmen'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/?type=salesmen`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch customers with infinite scroll (similar to route-management)
  const fetchCustomers = async ({ pageParam = 1, queryKey }) => {
    const [, search] = queryKey;
    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/report/get-ledgers/?page=${pageParam}&search=${encodeURIComponent(search || "")}&per_page=50`
    );
    const data = await response.json();
    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
      total: data.pagination?.total_count || 0,
    };
  };

  const {
    data: customersData,
    fetchNextPage: fetchNextCustomerPage,
    hasNextPage: hasNextCustomerPage,
    isFetchingNextPage: isFetchingNextCustomerPage,
  } = useInfiniteQuery({
    queryKey: ["customers", debouncedCustomerSearchTerm],
    queryFn: fetchCustomers,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isAssignModalOpen, // Only fetch when modal is open
  });

  const customers = customersData?.pages?.flatMap((page) => page.results) || [];

  // Handle multiple customer selection
  const handleCustomerToggle = (customerId) => {
    const newSelectedCustomers = selectedCustomers.includes(customerId)
      ? selectedCustomers.filter(id => id !== customerId)
      : [...selectedCustomers, customerId];

    setSelectedCustomers(newSelectedCustomers);
    form.setValue("customer_list", newSelectedCustomers);
  };

  const handleRemoveCustomer = (customerId) => {
    const newSelectedCustomers = selectedCustomers.filter(id => id !== customerId);
    setSelectedCustomers(newSelectedCustomers);
    form.setValue("customer_list", newSelectedCustomers);
  };

  // Month data
  const monthsData = [
    { id: 1, name: "January", value: "01" },
    { id: 2, name: "February", value: "02" },
    { id: 3, name: "March", value: "03" },
    { id: 4, name: "April", value: "04" },
    { id: 5, name: "May", value: "05" },
    { id: 6, name: "June", value: "06" },
    { id: 7, name: "July", value: "07" },
    { id: 8, name: "August", value: "08" },
    { id: 9, name: "September", value: "09" },
    { id: 10, name: "October", value: "10" },
    { id: 11, name: "November", value: "11" },
    { id: 12, name: "December", value: "12" },
  ];

  // Week days data
  const weekDays = WEEK_DAYS;

  // Handle route type change (list filters only — do not mutate assign-form day selections)
  const handleRouteTypeChange = (routeType) => {
    setRouteTypeFilter(routeType);
    setCurrentPage(1);

    if (routeType === "DAILY") {
      setFilterSelectedDays([]);
    } else if (routeType === "WEEKLY") {
      // keep filterSelectedDays for weekly day picker
    } else {
      setFilterSelectedDays([]);
    }
  };

  const handleFilterDayToggle = (dayValue) => {
    setFilterSelectedDays((current) =>
      current.includes(dayValue)
        ? current.filter((day) => day !== dayValue)
        : [...current, dayValue]
    );
    setCurrentPage(1);
  };

  // Auto-fill dates when route_type changes to DAILY or ONE_TIME
  useEffect(() => {
    const routeType = form.watch("route_type");
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);
    const thirtyDaysLaterStr = format(thirtyDaysLater, "yyyy-MM-dd");

    if (routeType === "DAILY") {
      // Auto-fill start_date to today and end_date to 30 days later if not set
      if (!form.watch("start_date")) {
        form.setValue("start_date", todayStr);
      }
      if (!form.watch("end_date")) {
        form.setValue("end_date", thirtyDaysLaterStr);
      }
    } else if (routeType === "ONE_TIME") {
      // Auto-fill start_date to today if not set and clear any previous end_date
      if (!form.watch("start_date")) {
        form.setValue("start_date", todayStr);
      }
      // For ONE_TIME we don't ask for end_date; let backend treat it as start_date
      if (form.watch("end_date")) {
        form.setValue("end_date", "");
      }
    }
  }, [form.watch("route_type")]);

  // Keep end_date on or after start_date: if start_date changes and end_date is before it, clear end_date
  useEffect(() => {
    const startStr = form.watch("start_date");
    const endStr = form.watch("end_date");
    if (!startStr || !endStr) return;
    const start = startOfDay(new Date(startStr));
    const end = startOfDay(new Date(endStr));
    if (end < start) {
      form.setValue("end_date", "");
    }
  }, [form.watch("start_date")]);

  // Handle day selection for weekly
  const handleDayToggle = (dayValue) => {
    const newSelectedDays = selectedDays.includes(dayValue)
      ? selectedDays.filter(day => day !== dayValue)
      : [...selectedDays, dayValue];
    setSelectedDays(newSelectedDays);
  };

  // Handle date selection for daily
  const handleDateToggle = (date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const newSelectedDates = selectedDates.includes(dateString)
      ? selectedDates.filter(d => d !== dateString)
      : [...selectedDates, dateString];
    setSelectedDates(newSelectedDates);
  };

  // Handle month selection
  // For MONTHLY route type: monthId represents days (1-31)
  // For WEEKLY route type: monthId represents months (1-12)
  const handleMonthToggle = (monthId) => {
    const newSelectedMonths = selectedMonths.includes(monthId)
      ? selectedMonths.filter(id => id !== monthId)
      : [...selectedMonths, monthId];
    setSelectedMonths(newSelectedMonths);
  };

  // Months within start_date–end_date (1–12). When set, only these can be toggled; others disabled.
  const startDateStr = form.watch("start_date");
  const endDateStr = form.watch("end_date");
  const periodMonths = startDateStr && endDateStr ? getMonthsInDateRange(startDateStr, endDateStr) : null;

  // Handle month selection for MONTHLY route type (months 1-12). When periodMonths is set, only those months can be toggled.
  const handleMonthlyMonthToggle = (monthId) => {
    if (periodMonths !== null && !periodMonths.includes(monthId)) return;
    const newSelectedMonthlyMonths = selectedMonthlyMonths.includes(monthId)
      ? selectedMonthlyMonths.filter(id => id !== monthId)
      : [...selectedMonthlyMonths, monthId];
    setSelectedMonthlyMonths(newSelectedMonthlyMonths);
  };

  // Assign route mutation
  const assignRouteMutation = useMutation({
    mutationFn: async (data) => {
      // Data is already transformed in onSubmit, just send it as-is
      const submitData = {
        route_id: data.route_id,
        route_type: data.route_type,
        salesman_ids: data.salesman_list || [],
        customer_ids: data.customer_list || [],
        start_date: data.start_date || null,
        end_date: data.route_type === 'ONE_TIME' ? null : (data.end_date || null),
        weekly_days: data.weekly_days || null,
        monthly_days: data.monthly_days || null,  // For MONTHLY: days (1-31) only
        monthly_months: data.monthly_months || null,  // For WEEKLY, MONTHLY: months (1-12)
        is_active: true
      };
      const response = await apiRequest('POST', `${API_BASE_URL}/api/growth/route/assignment/create/`, submitData);
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200 || data.status === 201) {
        toast({
          title: "✅ Success",
          description: "Route assignment created successfully",
          variant: "success",
        });
        form.reset();
        setIsAssignModalOpen(false);
        queryClient.invalidateQueries(['route-assignments']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to assign route",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Assign route error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign route",
        variant: "destructive",
      });
    },
  });

  // Update route assignment mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ masterId, payload }) => {
      const response = await apiRequest(
        'PUT',
        `${API_BASE_URL}/api/growth/route/assignment/${masterId}/update/`,
        payload
      );
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: "Route assignment updated successfully.",
          variant: "success",
        });
        setEditingMasterId(null);
        setSelectedAssignment(null);
        resetForm();
        setIsAssignModalOpen(false);
        setIsDetailModalOpen(false);
        // Reset filters and pagination so listing shows all assignments
        setRouteFilter("all");
        setSalesmanFilter("all");
        setRouteTypeFilter("all");
        setSearchTerm("");
        setCurrentPage(1);
        queryClient.invalidateQueries(['route-assignments']);
        queryClient.invalidateQueries(['route-assignment-detail']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update route assignment",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update route assignment",
        variant: "destructive",
      });
    },
  });

  // Delete route assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId) => {
      const response = await apiRequest('DELETE', `${API_BASE_URL}/api/growth/route/assignment/${assignmentId}/`);
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: "Route assignment deleted successfully",
          className: "bg-green-50 border-green-100 text-green-800",
        });
        setIsDeleteModalOpen(false);
        setAssignmentToDelete(null);
        // Invalidate and refetch route assignments list
        queryClient.invalidateQueries({ queryKey: ['route-assignments'] });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete route assignment",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Delete assignment error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete route assignment",
        variant: "destructive",
      });
    },
  });

  const filteredAssignmentsAll = useMemo(() => {
    let rows = assignmentsForFilter;
    // Client-side search like user-list (instant filter on searchTerm)
    if (isSearchActive) {
      rows = rows.filter((assignment) =>
        assignmentMatchesSearchTerm(assignment, searchTerm)
      );
    }
    if (salesmanFilter !== "all") {
      rows = rows.filter((assignment) =>
        assignmentMatchesSalesmanFilter(assignment, salesmanFilter, salesmenData)
      );
    }
    if (routeTypeFilter !== "all") {
      rows = rows.filter((assignment) =>
        assignmentMatchesRouteTypeFilter(assignment, routeTypeFilter)
      );
    }
    if (routeTypeFilter === "WEEKLY" && filterSelectedDays.length > 0) {
      rows = rows.filter((assignment) =>
        assignmentMatchesWeeklyDaysFilter(assignment, filterSelectedDays)
      );
    }
    return rows;
  }, [
    assignmentsForFilter,
    isSearchActive,
    searchTerm,
    salesmanFilter,
    salesmenData,
    routeTypeFilter,
    filterSelectedDays,
  ]);

  const assignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssignmentsAll.slice(start, start + pageSize);
  }, [filteredAssignmentsAll, currentPage, pageSize]);

  const totalCount = filteredAssignmentsAll.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const hasNext = currentPage < totalPages;
  const hasPrevious = currentPage > 1;

  // Fetch route occupancy data
  const { data: occupancyData, isLoading: occupancyLoading } = useQuery({
    queryKey: ['route-occupancy', occupancyMonth, occupancyYear, occupancySalesmanFilter],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/growth/route/occupancy-analysis/?month=${occupancyMonth}&year=${occupancyYear}`;
      if (occupancySalesmanFilter && occupancySalesmanFilter !== 'all') {
        url += `&salesman_id=${occupancySalesmanFilter}`;
      }
      const response = await apiRequest('GET', url);
      if (!response.ok) throw new Error('Failed to fetch occupancy data');
      const data = await response.json();
      return data.status === 200 ? data.data : null;
    },
    enabled: isOccupancyModalOpen && !!AuthService.getAccessToken(),
  });

  // Fetch assignment details when viewing details or when assign modal is open in edit mode
  const assignmentId = selectedAssignment?.id || selectedAssignment?.assignment_id;
  const { data: assignmentDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['route-assignment-detail', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/growth/route/assignment/${assignmentId}/detail/`);
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!assignmentId && (isDetailModalOpen || (isAssignModalOpen && !!editingMasterId)),
  });

  const { data: changeHistoryData } = useQuery({
    queryKey: ['route-assignment-change-history', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/growth/route/assignment/${assignmentId}/change-history/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!assignmentId && isDetailModalOpen,
  });
  const changeHistoryList = changeHistoryData || [];

  const handleViewDetails = (assignment) => {
    setSelectedAssignment(assignment);
    setIsDetailModalOpen(true);
  };

  // Prefill assign form when opened in edit mode and detail data has loaded
  useEffect(() => {
    if (!isAssignModalOpen || !editingMasterId || !assignmentDetailData || assignmentDetailData.id !== editingMasterId) return;
    const d = assignmentDetailData;
    form.setValue('route_id', d.route?.route_id ?? null);
    form.setValue('route_type', d.route_type || '');
    form.setValue('start_date', d.start_date ? format(new Date(d.start_date), 'yyyy-MM-dd') : '');
    form.setValue('end_date', d.end_date ? format(new Date(d.end_date), 'yyyy-MM-dd') : '');
    form.setValue(
      "salesman_list",
      getUniqueSalesmanList((d.salesmen || []).map((s) => s.user_id ?? s.salesman_id))
    );
    form.setValue('customer_list', (d.customers || []).map((c) => c.customer_id));
    setRouteTypeFilter(d.route_type || "all");
    if (d.route_type === 'WEEKLY' && d.weekly_days && Array.isArray(d.weekly_days)) {
      const dayValues = d.weekly_days.map((dayIndex) => weekDays[dayIndex]?.value).filter(Boolean);
      setSelectedDays(dayValues);
    } else setSelectedDays([]);
    if (d.route_type === 'MONTHLY' && d.monthly_days && Array.isArray(d.monthly_days)) {
      setSelectedMonths(d.monthly_days);
    } else setSelectedMonths([]);
    setSelectedMonthlyMonths(Array.isArray(d.monthly_months) ? d.monthly_months : []);
    setSelectedCustomers((d.customers || []).map((c) => ({ id: c.customer_id, name: c.customer_name })));
  }, [isAssignModalOpen, editingMasterId, assignmentDetailData]);

  const handleAssignRoute = () => {
    setEditingMasterId(null);
    setSelectedAssignment(null);
    resetForm();
    setIsAssignModalOpen(true);
  };

  const handleEditAssignment = (assignment) => {
    const masterId = assignment.id || assignment.assignment_id;
    if (!masterId) return;
    setSelectedAssignment(assignment);
    setEditingMasterId(masterId);
    setIsDetailModalOpen(false);
    setIsAssignModalOpen(true);
  };

  const handleDeleteAssignment = (assignment) => {
    setAssignmentToDelete(assignment);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (assignmentToDelete) {
      const assignmentId = assignmentToDelete.assignment_id || assignmentToDelete.id;
      if (assignmentId) {
        deleteAssignmentMutation.mutate(assignmentId);
      }
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const resetForm = () => {
    form.reset();
    setSelectedDays([]);
    setSelectedDates([]);
    setSelectedMonths([]);
    setSelectedMonthlyMonths([]);
    setSelectedCustomers([]);
    setCustomerSearchTerm("");
  };

  // Check for route_id in URL parameters on mount and auto-select route
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const routeIdParam = urlParams.get('route_id');

    if (routeIdParam && routesData && routesData.length > 0) {
      const routeId = parseInt(routeIdParam, 10);
      if (!isNaN(routeId) && routeId > 0) {
        const routeExists = routesData.find(r => r.id === routeId);
        if (routeExists) {
          // Set the route in the form
          form.setValue('route_id', routeId);
          // Open the assign modal
          setIsAssignModalOpen(true);
          // Clear the URL parameter
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [routesData]);

  const onSubmit = async (data) => {
    try {
      // Log form data for debugging
      console.log("Form data:", data);
      console.log("Form errors:", form.formState.errors);
      console.log("Selected days:", selectedDays);
      console.log("Selected months:", selectedMonths);

      // Ensure route_id is a number
      const routeId = typeof data.route_id === 'string' ? parseInt(data.route_id, 10) : data.route_id;

      // Validate required fields
      if (!routeId || isNaN(routeId) || routeId <= 0) {
        toast({
          title: "Validation Error",
          description: "Please select a route",
          variant: "destructive",
        });
        return;
      }

      if (!data.salesman_list || data.salesman_list.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one salesman",
          variant: "destructive",
        });
        return;
      }

      // Ensure salesman_list contains valid IDs (keep as strings if that's what they are)
      // The backend API expects user_id which can be a string like 'USR0022'
      // Remove duplicates by converting to Set and back to array
      const uniqueSalesmanIds = getUniqueSalesmanList(data.salesman_list);
      const salesmanList = uniqueSalesmanIds.map((id) => id);

      if (!data.route_type) {
        toast({
          title: "Validation Error",
          description: "Please select a route type",
          variant: "destructive",
        });
        return;
      }

      // Validate route type specific requirements
      if (data.route_type === 'WEEKLY') {
        if (!selectedDays || selectedDays.length === 0) {
          toast({
            title: "Validation Error",
            description: "Please select at least one day of the week",
            variant: "destructive",
          });
          return;
        }
        if (!data.start_date || (typeof data.start_date === 'string' && data.start_date.trim() === '')) {
          toast({
            title: "Validation Error",
            description: "Please select a start date",
            variant: "destructive",
          });
          return;
        }
        // end_date is optional - if not provided, route runs forever
      }

      if (data.route_type === 'MONTHLY') {
        if (!selectedMonths || selectedMonths.length === 0) {
          toast({
            title: "Validation Error",
            description: "Please select at least one day of the month",
            variant: "destructive",
          });
          return;
        }
        if (!data.start_date || (typeof data.start_date === 'string' && data.start_date.trim() === '')) {
          toast({
            title: "Validation Error",
            description: "Please select a start date",
            variant: "destructive",
          });
          return;
        }
        // end_date is optional - if not provided, route runs forever
      }

      // For DAILY and ONE_TIME, dates are auto-filled by backend if not provided
      // So we don't need to validate them here - backend will handle it
      // But we can still send the dates if they are provided

      // Convert form data to match API expectations
      let weeklyDaysArray = null;
      if (data.route_type === 'WEEKLY' && selectedDays.length > 0) {
        // Convert day values (monday, tuesday, etc.) to indices (0-6 for Monday-Sunday)
        weeklyDaysArray = selectedDays.map(dayValue => {
          const dayIndex = weekDays.findIndex(d => d.value === dayValue);
          return dayIndex >= 0 ? dayIndex : null;
        }).filter(index => index !== null);
      }

      const submitData = {
        route_id: routeId,
        salesman_list: salesmanList,
        customer_list: data.customer_list || [],
        route_type: data.route_type,
        start_date: (data.start_date && typeof data.start_date === 'string' && data.start_date.trim() !== '') ? data.start_date : null,
        end_date: (data.end_date && typeof data.end_date === 'string' && data.end_date.trim() !== '') ? data.end_date : null,
        weekly_days: weeklyDaysArray && weeklyDaysArray.length > 0 ? weeklyDaysArray : null,
        monthly_days: data.route_type === 'MONTHLY' && selectedMonths.length > 0 ? selectedMonths : null,
        monthly_months: (data.route_type === 'WEEKLY' || data.route_type === 'MONTHLY') && selectedMonthlyMonths.length > 0 ? selectedMonthlyMonths : null,
      };

      if (editingMasterId) {
        const updatePayload = {
          route_type: submitData.route_type,
          salesman_ids: submitData.salesman_list,
          customer_ids: submitData.customer_list,
          start_date: submitData.start_date,
          end_date: submitData.end_date,
          weekly_days: submitData.weekly_days,
          monthly_days: submitData.monthly_days,
          monthly_months: submitData.monthly_months,
          effective_date: format(new Date(), 'yyyy-MM-dd'),
          change_reason: (data.change_reason && typeof data.change_reason === 'string') ? data.change_reason.trim() : '',
        };
        await updateAssignmentMutation.mutateAsync({ masterId: editingMasterId, payload: updatePayload });
        return;
      }

      console.log("Submitting route assignment data:", submitData);
      await assignRouteMutation.mutateAsync(submitData);
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit form",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'dd-MM-yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  // const getRouteTypeBadgeVariant = (type) => {
  //   switch (type?.toLowerCase()) {
  //     case 'daily': return 'default';
  //     case 'weekly': return 'secondary';
  //     case 'monthly': return 'outline';
  //     default: return 'outline';
  //   }
  // };

  const getRouteTypeBadgeClass = (type) => {
    switch (type?.toLowerCase()) {
      case 'daily':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'weekly':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'monthly':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'one_time':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };


  // Initial load only — never replace the whole screen while typing/searching
  if (isLoading && !assignmentsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
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
          <Loader />
        </div>
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
                <UserPlus className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view route assignments. Contact your administrator for access.
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
              <h1 className="text-2xl font-bold text-gray-900">Route Assignment</h1>
              <p className="text-gray-600">Assign routes to salesmen and manage assignments</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasCreatePermission("route_management") && (
              <Button
                onClick={handleAssignRoute}
                className="bg-black hover:bg-gray-800"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Route
              </Button>
            )}
            {/* <Badge variant="outline" className="text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date().toLocaleDateString()}
            </Badge> */}
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
              <CardContent className="space-y-4">
                {/* Single row: Search | Route | Salesman | Route Type | Months | Reset */}
                <div className="flex flex-wrap items-end gap-3">
                  {/* Search - First, compact width */}
                  <div className="min-w-[180px] max-w-[280px] flex-1">
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search by route, salesman, or customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-9"
                      />
                    </div>
                  </div>

                  {/* Route */}
                  <div className="min-w-[140px]">
                    <Label htmlFor="routeFilter" className="text-sm font-medium text-gray-700 mb-1.5 block">Route</Label>
                    <Select value={routeFilter} onValueChange={setRouteFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select route" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Routes</SelectItem>
                        {routesData?.map((route) => (
                          <SelectItem key={route.id} value={route.id.toString()}>
                            {route.name || route.route_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Salesman */}
                  <div className="min-w-[140px]">
                    <Label htmlFor="salesmanFilter" className="text-sm font-medium text-gray-700 mb-1.5 block">Salesman</Label>
                    <Select
                      value={salesmanFilter}
                      onValueChange={(value) => {
                        setSalesmanFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger id="salesmanFilter" className="h-9">
                        <SelectValue placeholder="Select salesman" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Salesmen</SelectItem>
                        {salesmenData?.map((salesman) => (
                          <SelectItem key={salesman.user_id} value={String(salesman.user_id)}>
                            {salesman.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Route Type - small width */}
                  <div className="w-[110px] shrink-0">
                    <Label htmlFor="routeTypeFilter" className="text-sm font-medium text-gray-700 mb-1.5 block">Route Type</Label>
                    <Select value={routeTypeFilter} onValueChange={handleRouteTypeChange}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="ONE_TIME">One Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Months - small width */}
                  <div className="w-[110px] shrink-0">
                    <Label htmlFor="monthlyFilter" className="text-sm font-medium text-gray-700 mb-1.5 block">Months</Label>
                    <Select>
                      <SelectTrigger className="h-9 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                        <SelectValue placeholder={selectedMonths.length > 0 ? `${selectedMonths.length} selected` : "Choose months..."} />
                      </SelectTrigger>
                      <SelectContent className="w-44 min-w-[140px]">
                        <div className="p-2">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-800">Select Months</span>
                            {selectedMonths.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMonths([]);
                                }}
                              >
                                Clear All
                              </Button>
                            )}
                          </div>

                          {/* Months - one per row, compact */}
                          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                            {monthsData.map((month) => (
                              <div
                                key={month.id}
                                className={`flex items-center space-x-2 py-1.5 px-2 rounded border cursor-pointer transition-colors ${
                                  selectedMonths.includes(month.id)
                                    ? 'bg-purple-50 border-purple-200'
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                                onClick={() => handleMonthToggle(month.id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMonths.includes(month.id)}
                                  onChange={() => handleMonthToggle(month.id)}
                                  className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 rounded"
                                />
                                <span className={`text-xs font-medium ${
                                  selectedMonths.includes(month.id) ? 'text-purple-800' : 'text-gray-700'
                                }`}>
                                  {month.name.slice(0, 3)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Selected Months Display */}
                          {selectedMonths.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-600">Selected</span>
                                <span className="text-xs text-gray-500">
                                  {selectedMonths.length}/12
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                {selectedMonths.map((monthId) => {
                                  const month = monthsData.find(m => m.id === monthId);
                                  return (
                                    <Badge
                                      key={monthId}
                                      variant="secondary"
                                      className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 transition-colors cursor-pointer group text-xs px-2 py-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMonthToggle(monthId);
                                      }}
                                    >
                                      {month?.name.slice(0, 3)}
                                      <X className="ml-1 h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reset - icon only, last */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => {
                      setRouteFilter("all");
                      setSalesmanFilter("all");
                      setRouteTypeFilter("all");
                      setSearchTerm("");
                      setCurrentPage(1);
                      setFilterSelectedDays([]);
                      setSelectedDates([]);
                      setSelectedMonths([]);
                    }}
                    title="Reset filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Conditional UI based on Route Type */}
                {routeTypeFilter === "WEEKLY" && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-800">Select Days of Week</span>
                      </div>
                      {filterSelectedDays.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setFilterSelectedDays([]);
                            setCurrentPage(1);
                          }}
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {weekDays.map((day) => (
                        <div
                          key={day.id}
                          className="flex flex-col items-center space-y-1 p-1.5 border border-green-300 rounded-md hover:bg-green-100 cursor-pointer transition-colors"
                          onClick={() => handleFilterDayToggle(day.value)}
                        >
                          <input
                            type="checkbox"
                            checked={filterSelectedDays.includes(day.value)}
                            onChange={() => handleFilterDayToggle(day.value)}
                            className="w-3.5 h-3.5 text-green-600 focus:ring-green-500 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">{day.short}</span>
                        </div>
                      ))}
                    </div>
                    {filterSelectedDays.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {filterSelectedDays.map((day) => {
                          const dayInfo = weekDays.find(d => d.value === day);
                          return (
                            <Badge key={day} variant="secondary" className="bg-green-100 text-green-800 border-green-300 text-xs px-2 py-1">
                              {dayInfo?.short}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}


                {routeTypeFilter === "DAILY" && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-blue-800">Select Dates</span>
                      </div>
                      {selectedDates.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setSelectedDates([])}
                        >
                          Clear Dates
                        </Button>
                      )}
                    </div>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal border-blue-300 hover:bg-blue-100 h-9"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDates.length > 0
                            ? `${selectedDates.length} dates selected`
                            : "Pick dates"}
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="multiple"
                          selected={selectedDates.map(date => new Date(date))}
                          onSelect={(dates) => {
                            if (dates) {
                              const newDates = dates.map(date => format(date, 'yyyy-MM-dd'));
                              setSelectedDates(newDates);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {selectedDates.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedDates.map((date) => (
                          <Badge key={date} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-2 py-1">
                            {format(new Date(date), 'MMM dd')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}


              </CardContent>
            </Card>

            {/* Search */}
            {/* <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search assignments by route name or salesman..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card> */}

            {/* Assigned Routes List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="h-5 w-5" />
                    <span>
                      Route Assignments{" "}
                      {isSearchActive
                        ? `(${filteredAssignmentsAll.length} of ${assignmentsForFilter.length})`
                        : `(${totalCount})`}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsOccupancyModalOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Day Occupancy
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.assignment_id || assignment.id || `assignment-${assignment.route_id}-${assignment.route_type}`}
                      className="bg-white rounded-lg p-3 hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-stretch sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* First Row: Route, Route Type, Salesmen */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3 pb-3 border-b border-gray-200">
                            {/* Route */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Route</span>
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {assignment.route_name || assignment.route?.name || assignment.name || 'N/A'}
                              </span>
                            </div>

                            {/* Route Type */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</span>
                              <span className={`px-2 py-1 rounded-md text-xs font-medium inline-flex items-center space-x-1 w-fit ${getRouteTypeBadgeClass(assignment.route_type)}`}>
                                <Route className="h-3 w-3" />
                                <span className="capitalize">{assignment.route_type || 'N/A'}</span>
                              </span>
                            </div>

                            {/* Salesmen */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Salesman</span>
                              <div className="flex flex-wrap gap-1.5">
                                {assignment.salesmen && assignment.salesmen.length > 0 ? (
                                  assignment.salesmen.map((salesman, idx) => (
                                    <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs py-0.5 px-2">
                                      <User className="h-3 w-3 mr-1" />
                                      {salesman.salesman_name}
                                    </Badge>
                                  ))
                                ) : assignment.salesman_name ? (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs py-0.5 px-2">
                                    <User className="h-3 w-3 mr-1" />
                                    {assignment.salesman_name}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">None</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Remaining Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-3 text-sm">

                            {/* Date Range */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date Range</span>
                              <span className="text-sm font-semibold text-gray-900">
                                {assignment.start_date ? format(new Date(assignment.start_date), 'dd-MM-yyyy') : 'N/A'}
                                {assignment.end_date ? ` to ${format(new Date(assignment.end_date), 'dd-MM-yyyy')}` : ' (ongoing)'}
                              </span>
                            </div>

                            {/* Week Days - Only for WEEKLY */}
                            {assignment.route_type === 'WEEKLY' && assignment.weekly_days && (
                              <>
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Week Days</span>
                                  <div className="flex flex-wrap gap-1">
                                    {assignment.weekly_days && assignment.weekly_days.length > 0 ? (
                                      assignment.weekly_days.map((day, idx) => {
                                        // Python weekday: 0=Monday, 1=Tuesday, ..., 6=Sunday
                                        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                        return (
                                          <Badge key={idx} variant="secondary" className="bg-green-100 text-green-800 border-green-200 text-xs py-0.5 px-2">
                                            {dayNames[day] || day}
                                          </Badge>
                                        );
                                      })
                                    ) : (
                                      <span className="text-gray-400 text-xs italic">None</span>
                                    )}
                                  </div>
                                </div>
                                {/* Monthly Days / Weekly Months - Show months for WEEKLY, days for MONTHLY */}
                                {assignment.route_type === 'WEEKLY' && assignment.monthly_months && assignment.monthly_months.length > 0 && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Months</span>
                                    <div className="flex flex-wrap gap-1">
                                      {assignment.monthly_months.map((monthId, idx) => {
                                        const month = monthsData.find(m => m.id === monthId);
                                        return (
                                          <Badge key={idx} variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 text-xs py-0.5 px-2">
                                            {month?.name.slice(0, 3) || monthId}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Month Days - Only for MONTHLY */}
                            {assignment.route_type === 'MONTHLY' && assignment.monthly_days && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Month Days</span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {assignment.monthly_days && assignment.monthly_days.length > 0
                                    ? assignment.monthly_days.sort((a, b) => a - b).join(', ')
                                    : 'None'}
                                </span>
                              </div>
                            )}

                            {/* Monthly Months - Only for MONTHLY */}
                            {assignment.route_type === 'MONTHLY' && assignment.monthly_months && assignment.monthly_months.length > 0 && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Months</span>
                                <div className="flex flex-wrap gap-1">
                                  {assignment.monthly_months.map((monthId, idx) => {
                                    const month = monthsData.find(m => m.id === monthId);
                                    return (
                                      <Badge key={idx} variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 text-xs py-0.5 px-2">
                                        {month?.name.slice(0, 3) || monthId}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Schedule - Only for DAILY */}
                            {assignment.route_type === 'DAILY' && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Schedule</span>
                                <span className="text-sm font-semibold text-gray-900">Every day</span>
                              </div>
                            )}

                            {/* Customers */}
                            {(assignment.customers_count !== undefined) && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customers</span>
                                <span className="text-sm font-semibold text-gray-900">{assignment.customers_count || 0}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right side: Created at top, Action Buttons at bottom */}
                        <div className="flex flex-col justify-between items-end flex-shrink-0 min-h-[80px]">
                          <div className="flex flex-col gap-1 text-right">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</span>
                            <span className="text-sm text-gray-700">{formatDate(assignment.created_at)}</span>
                          </div>
                          <div className="flex items-center space-x-2 mt-auto">
                          <Button
                            size="sm"
                            onClick={() => handleViewDetails(assignment)}
                            className="flex items-center space-x-1 hover:text-gray-500 h-8 w-8 p-0"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAssignment(assignment)}
                            className="flex items-center space-x-1 h-8 w-8 p-0"
                            title="Edit assignment"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAssignment(assignment)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700 h-8"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {assignments.length === 0 && (
                    <div className="text-center py-8">
                      <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">
                        {isSearchActive
                          ? "No route assignments match your search."
                          : "No route assignments found"}
                      </p>
                      {isSearchActive ? (
                        <p className="text-sm text-gray-400 mt-1">
                          Try adjusting your search criteria.
                        </p>
                      ) : (
                        <Button
                          onClick={handleAssignRoute}
                          className="mt-4 bg-black hover:bg-gray-800"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create Your First Assignment
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} assignments
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

      {/* Assign Route Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={(open) => {
        setIsAssignModalOpen(open);
        if (!open) {
          setEditingMasterId(null);
          setAssignRouteDropdownOpen(false);
          setAssignSalesmenDropdownOpen(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserPlus className="h-5 w-5" />
              <span>{editingMasterId ? 'Update Route Assignment' : 'Assign Routes to Salesmen'}</span>
            </DialogTitle>
            <DialogDescription>
              {editingMasterId
                ? 'Update the assignment. Changes apply from the effective date (today); previous assignment is ended the day before.'
                : 'Create route assignments for salesmen with scheduling options'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log("Form validation errors:", errors);
              // Get the first error message
              const firstError = Object.values(errors)[0];
              const errorMessage = firstError?.message || "Please check the form for errors";
              toast({
                title: "Validation Error",
                description: errorMessage,
                variant: "destructive",
              });
            })}
            className="space-y-6"
          >
            <div className="space-y-6">
              <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
                {/* Route, Route Type, and Salesmen in Single Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="route_id" className="text-sm font-medium text-gray-700">Route *</Label>
                    <Controller
                      name="route_id"
                      control={form.control}
                      render={({ field }) => {
                        const selectedRoute = (routesData || []).find(
                          (route) => String(route.id) === String(field.value)
                        );
                        return (
                          <Popover open={assignRouteDropdownOpen} onOpenChange={setAssignRouteDropdownOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="route_id"
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={assignRouteDropdownOpen}
                                className="mt-1 h-10 w-full justify-between font-normal border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                              >
                                <span className="truncate">
                                  {selectedRoute ? getRouteDisplayName(selectedRoute) : "Select route"}
                                </span>
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
                                <CommandInput placeholder="Search routes..." />
                                <CommandList>
                                  <CommandEmpty>No routes found.</CommandEmpty>
                                  <CommandGroup>
                                    {(routesData || []).map((route) => (
                                      <CommandItem
                                        key={route.id}
                                        value={`${getRouteDisplayName(route)} ${route.id}`}
                                        onSelect={() => {
                                          const numValue = parseInt(String(route.id), 10);
                                          if (!isNaN(numValue)) {
                                            field.onChange(numValue);
                                          }
                                          setAssignRouteDropdownOpen(false);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 shrink-0 ${
                                            String(field.value) === String(route.id)
                                              ? "opacity-100"
                                              : "opacity-0"
                                          }`}
                                        />
                                        <span className="truncate">{getRouteDisplayName(route)}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        );
                      }}
                    />
                    {form.formState.errors.route_id && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.route_id.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="route_type" className="text-sm font-medium text-gray-700">Route Type *</Label>
                    <Controller
                      name="route_type"
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                        >
                          <SelectTrigger className="mt-1 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                            <SelectValue placeholder="Select route type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DAILY">Daily</SelectItem>
                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                            <SelectItem value="ONE_TIME">One Time</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.route_type && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.route_type.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Salesmen *</Label>
                  {salesmenLoading ? (
                    <div className="flex items-center justify-center py-4 mt-1">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Loading salesmen...</span>
                    </div>
                  ) : (
                    <Popover open={assignSalesmenDropdownOpen} onOpenChange={setAssignSalesmenDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={assignSalesmenDropdownOpen}
                          className="mt-1 h-10 w-full justify-between font-normal border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        >
                          <span className="truncate">
                            {getUniqueSalesmanList(form.watch("salesman_list")).length > 0
                              ? `${getUniqueSalesmanList(form.watch("salesman_list")).length} salesmen selected`
                              : "Select salesmen..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] min-w-[280px] p-0 z-[100]"
                        align="start"
                        side="bottom"
                        sideOffset={4}
                        avoidCollisions={false}
                      >
                        <Command shouldFilter>
                          <CommandInput placeholder="Search salesmen..." />
                          <CommandList className="max-h-[280px]">
                            <CommandEmpty>No salesmen found.</CommandEmpty>
                            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                              <span className="text-sm font-medium text-gray-800">Select Salesmen</span>
                              {getUniqueSalesmanList(form.watch("salesman_list")).length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    form.setValue("salesman_list", [], { shouldDirty: true });
                                  }}
                                >
                                  Clear All
                                </Button>
                              )}
                            </div>
                            <CommandGroup>
                              {dedupeSalesmenData(salesmenData).map((salesman) => {
                                const salesmanId = normalizeSalesmanId(salesman.user_id ?? salesman.salesman_id);
                                const isSelected = isSalesmanInList(form.watch("salesman_list"), salesmanId);
                                const toggleSalesman = () => {
                                  const currentList = form.getValues("salesman_list") || [];
                                  form.setValue(
                                    "salesman_list",
                                    toggleSalesmanInList(currentList, salesmanId),
                                    { shouldDirty: true }
                                  );
                                };
                                return (
                                  <CommandItem
                                    key={salesmanId}
                                    value={`${salesman.name} ${salesman.role_name || ""}`}
                                    onSelect={toggleSalesman}
                                    className="flex items-center gap-2 cursor-pointer px-3 py-2"
                                  >
                                    <Check
                                      className={`h-4 w-4 shrink-0 ${
                                        isSelected ? "opacity-100 text-purple-600" : "opacity-0"
                                      }`}
                                    />
                                    <User className={`h-4 w-4 shrink-0 ${isSelected ? "text-purple-600" : "text-gray-500"}`} />
                                    <div className="min-w-0 flex-1">
                                      <div className={`text-sm font-medium truncate ${isSelected ? "text-purple-800" : "text-gray-700"}`}>
                                        {salesman.name}
                                      </div>
                                      {salesman.role_name && (
                                        <div className="text-xs text-gray-500 truncate">{salesman.role_name}</div>
                                      )}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                            {getUniqueSalesmanList(form.watch("salesman_list")).length > 0 && (
                              <div className="border-t border-gray-200 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-600">Selected</span>
                                  <span className="text-xs text-gray-500">
                                    {getUniqueSalesmanList(form.watch("salesman_list")).length}/{dedupeSalesmenData(salesmenData).length}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                  {getUniqueSalesmanList(form.watch("salesman_list")).map((salesmanId) => {
                                    const salesman = findSalesmanByListId(salesmenData, salesmanId);
                                    return (
                                      <Badge
                                        key={salesmanId}
                                        variant="secondary"
                                        className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 transition-colors cursor-pointer group text-xs px-2 py-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const currentList = form.getValues("salesman_list") || [];
                                          form.setValue(
                                            "salesman_list",
                                            toggleSalesmanInList(currentList, salesmanId),
                                            { shouldDirty: true }
                                          );
                                        }}
                                      >
                                        {salesman?.name || salesmanId}
                                        <X className="ml-1 h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  {form.formState.errors.salesman_list && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.salesman_list.message}
                    </p>
                  )}
                  </div>
                </div>

                {/* Customers Selection */}
{/*                 <div> */}
{/*                   <Label htmlFor="customer_list">Customers</Label> */}
{/*                    */}
{/*                    */}{/* Selected Customers Display */}
{/*                   {selectedCustomers.length > 0 && ( */}
{/*                     <div className="mb-3 p-3 bg-gray-50 rounded-md"> */}
{/*                       <div className="flex flex-wrap gap-2"> */}
{/*                         {selectedCustomers.map((customerId) => { */}
{/*                           const customer = customers.find(c => c.id === customerId); */}
{/*                           return ( */}
{/*                             <Badge */}
{/*                               key={customerId} */}
{/*                               variant="secondary" */}
{/*                               className="flex items-center gap-1 px-2 py-1" */}
{/*                             > */}
{/*                               <span>{customer?.name || `Customer ${customerId}`}</span> */}
{/*                               <button */}
{/*                                 type="button" */}
{/*                                 onClick={() => handleRemoveCustomer(customerId)} */}
{/*                                 className="ml-1 hover:text-red-500" */}
{/*                               > */}
{/*                                 <X className="h-3 w-3" /> */}
{/*                               </button> */}
{/*                             </Badge> */}
{/*                           ); */}
{/*                         })} */}
{/*                       </div> */}
{/*                     </div> */}
{/*                   )} */}

{/*                    */}{/* Customers Dropdown */}
{/*                   <Select> */}
{/*                     <SelectTrigger> */}
{/*                       <SelectValue placeholder="Select Customers" /> */}
{/*                     </SelectTrigger> */}
{/*                     <SelectContent> */}
{/*                       <div className="p-2"> */}
{/*                         <input */}
{/*                           type="text" */}
{/*                           placeholder="Search customers..." */}
{/*                           value={customerSearchTerm} */}
{/*                           onChange={(e) => setCustomerSearchTerm(e.target.value)} */}
{/*                           className="w-full border rounded-md px-2 py-1" */}
{/*                         /> */}
{/*                       </div> */}
{/*                       <div */}
{/*                         className="max-h-60 overflow-auto" */}
{/*                         onScroll={(e) => { */}
{/*                           const target = e.currentTarget; */}
{/*                           if ( */}
{/*                             target.scrollTop + target.clientHeight >= target.scrollHeight - 20 && */}
{/*                             hasNextCustomerPage && */}
{/*                             !isFetchingNextCustomerPage */}
{/*                           ) { */}
{/*                             fetchNextCustomerPage(); */}
{/*                           } */}
{/*                         }} */}
{/*                       > */}
{/*                         {customers.map((customer) => ( */}
{/*                           <div */}
{/*                             key={customer.id} */}
{/*                             className="flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer" */}
{/*                             onClick={() => handleCustomerToggle(customer.id)} */}
{/*                           > */}
{/*                             <input */}
{/*                               type="checkbox" */}
{/*                               checked={selectedCustomers.includes(customer.id)} */}
{/*                               onChange={() => handleCustomerToggle(customer.id)} */}
{/*                               className="rounded" */}
{/*                             /> */}
{/*                             <span className="flex-1">{customer.name}</span> */}
{/*                           </div> */}
{/*                         ))} */}
{/*                         {isFetchingNextCustomerPage && ( */}
{/*                           <div className="p-2 text-center text-sm">Loading more...</div> */}
{/*                         )} */}
{/*                         {!isFetchingNextCustomerPage && customers.length === 0 && ( */}
{/*                           <div className="p-2 text-center text-sm text-gray-500"> */}
{/*                             No customers found */}
{/*                           </div> */}
{/*                         )} */}
{/*                       </div> */}
{/*                     </SelectContent> */}
{/*                   </Select> */}
{/*                   {form.formState.errors.customer_list && ( */}
{/*                     <p className="text-red-500 text-sm mt-1"> */}
{/*                       {form.formState.errors.customer_list.message} */}
{/*                     </p> */}
{/*                   )} */}
{/*                 </div> */}

                {/* Conditional fields based on route type */}
                {form.watch("route_type") === "DAILY" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_date">Start Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {form.watch("start_date") ? (
                                format(new Date(form.watch("start_date")), "PPP")
                              ) : (
                                <span>Pick a start date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.watch("start_date") ? new Date(form.watch("start_date")) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  form.setValue("start_date", format(date, "yyyy-MM-dd"));
                                }
                              }}
                              disabled={(date) => date < startOfDay(new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-gray-500 mt-1">Defaults to today if not provided</p>
                      </div>
                      <div>
                        <Label htmlFor="end_date">End Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {form.watch("end_date") ? (
                                format(new Date(form.watch("end_date")), "PPP")
                              ) : (
                                <span>Pick an end date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.watch("end_date") ? new Date(form.watch("end_date")) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  form.setValue("end_date", format(date, "yyyy-MM-dd"));
                                } else {
                                  form.setValue("end_date", "");
                                }
                              }}
                              disabled={(date) => {
                                const startStr = form.watch("start_date");
                                const minDate = startStr ? startOfDay(new Date(startStr)) : startOfDay(new Date());
                                return date < minDate;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-gray-500 mt-1">Defaults to 30 days from start date if not provided</p>
                      </div>
                    </div>
                  </div>
                )}

                {form.watch("route_type") === "ONE_TIME" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="start_date">Start Date *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {form.watch("start_date") ? (
                                format(new Date(form.watch("start_date")), "PPP")
                              ) : (
                                <span>Pick a start date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.watch("start_date") ? new Date(form.watch("start_date")) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  form.setValue("start_date", format(date, "yyyy-MM-dd"));
                                }
                              }}
                              disabled={(date) => date < startOfDay(new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-gray-500 mt-1">
                          One-time assignment will be created only for this date. End date is handled automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {form.watch("route_type") === "WEEKLY" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_date">Start Date *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {form.watch("start_date") ? (
                                format(new Date(form.watch("start_date")), "PPP")
                              ) : (
                                <span>Pick a start date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.watch("start_date") ? new Date(form.watch("start_date")) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  form.setValue("start_date", format(date, "yyyy-MM-dd"));
                                }
                              }}
                              disabled={(date) => date < startOfDay(new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label htmlFor="end_date">End Date (Optional)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {form.watch("end_date") ? (
                                format(new Date(form.watch("end_date")), "PPP")
                              ) : (
                                <span>Pick an end date (optional)</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.watch("end_date") ? new Date(form.watch("end_date")) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  form.setValue("end_date", format(date, "yyyy-MM-dd"));
                                  const startStr = form.getValues("start_date");
                                  if (startStr) {
                                    const months = getMonthsInDateRange(startStr, format(date, "yyyy-MM-dd"));
                                    if (months && months.length) setSelectedMonthlyMonths(months);
                                  }
                                } else {
                                  form.setValue("end_date", "");
                                }
                              }}
                              disabled={(date) => {
                                const startStr = form.watch("start_date");
                                const minDate = startStr ? startOfDay(new Date(startStr)) : startOfDay(new Date());
                                return date < minDate;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-gray-500 mt-1">Leave empty to run forever until deactivated</p>
                      </div>
                    </div>
                    <div>
                      <Label>Select Days of Week *</Label>
                      <div className="grid grid-cols-7 gap-2 mt-2">
                        {weekDays.map((day) => (
                          <div key={day.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`day-${day.value}`}
                              checked={selectedDays.includes(day.value)}
                              onChange={() => handleDayToggle(day.value)}
                              className="rounded"
                            />
                            <Label htmlFor={`day-${day.value}`} className="text-sm">
                              {day.short}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Month Selection for WEEKLY Routes */}
                    {selectedDays.length > 0 && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                            <span className="text-sm font-medium text-purple-800">Select Months (Optional)</span>
                          </div>
                          {selectedMonthlyMonths.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setSelectedMonthlyMonths([])}
                            >
                              Clear All
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-3">
                          Select the months when these weekdays will be assigned. If no months are selected, the assignment applies to all months.
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {monthsData.map((month) => {
                            const inPeriod = periodMonths === null || periodMonths.includes(month.id);
                            return (
                              <div
                                key={month.id}
                                className={`flex items-center space-x-2 p-2 rounded-md border transition-colors ${
                                  !inPeriod
                                    ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed pointer-events-none'
                                    : selectedMonthlyMonths.includes(month.id)
                                      ? 'bg-purple-100 border-purple-300 cursor-pointer'
                                      : 'bg-white border-gray-200 hover:bg-gray-50 cursor-pointer'
                                }`}
                                onClick={() => inPeriod && handleMonthlyMonthToggle(month.id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMonthlyMonths.includes(month.id)}
                                  onChange={() => inPeriod && handleMonthlyMonthToggle(month.id)}
                                  disabled={!inPeriod}
                                  className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 rounded"
                                />
                                <span className={`text-xs font-medium ${
                                  selectedMonthlyMonths.includes(month.id) ? 'text-purple-800' : 'text-gray-700'
                                }`}>
                                  {month.name.slice(0, 3)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {selectedMonthlyMonths.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600">Selected Months</span>
                              <span className="text-xs text-gray-500">
                                {selectedMonthlyMonths.length}/12
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {selectedMonthlyMonths.map((monthId) => {
                                const month = monthsData.find(m => m.id === monthId);
                                const inPeriod = periodMonths === null || periodMonths.includes(monthId);
                                return (
                                  <Badge
                                    key={monthId}
                                    variant="secondary"
                                    className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 transition-colors cursor-pointer group text-xs px-2 py-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (inPeriod) handleMonthlyMonthToggle(monthId);
                                    }}
                                  >
                                    {month?.name.slice(0, 3)}
                                    <X className="ml-1 h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {form.watch("route_type") === "MONTHLY" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_date">Start Date *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {form.watch("start_date") ? (
                                format(new Date(form.watch("start_date")), "PPP")
                              ) : (
                                <span>Pick a start date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.watch("start_date") ? new Date(form.watch("start_date")) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  form.setValue("start_date", format(date, "yyyy-MM-dd"));
                                }
                              }}
                              disabled={(date) => date < startOfDay(new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label htmlFor="end_date">End Date (Optional)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {form.watch("end_date") ? (
                                format(new Date(form.watch("end_date")), "PPP")
                              ) : (
                                <span>Pick an end date (optional)</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={form.watch("end_date") ? new Date(form.watch("end_date")) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  form.setValue("end_date", format(date, "yyyy-MM-dd"));
                                  const startStr = form.getValues("start_date");
                                  if (startStr) {
                                    const months = getMonthsInDateRange(startStr, format(date, "yyyy-MM-dd"));
                                    if (months && months.length) setSelectedMonthlyMonths(months);
                                  }
                                } else {
                                  form.setValue("end_date", "");
                                }
                              }}
                              disabled={(date) => {
                                const startStr = form.watch("start_date");
                                const minDate = startStr ? startOfDay(new Date(startStr)) : startOfDay(new Date());
                                return date < minDate;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-gray-500 mt-1">Leave empty to run forever until deactivated</p>
                      </div>
                    </div>
                    <div>
                      <Label>Select Days of Month *</Label>
                      <div className="grid grid-cols-8 gap-2 mt-2">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <div key={day} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`month-day-${day}`}
                              checked={selectedMonths.includes(day)}
                              onChange={() => handleMonthToggle(day)}
                              className="rounded"
                            />
                            <Label htmlFor={`month-day-${day}`} className="text-sm">
                              {day}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Month Selection for MONTHLY Routes */}
                    {selectedMonths.length > 0 && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                            <span className="text-sm font-medium text-purple-800">Select Months (Optional)</span>
                          </div>
                          {selectedMonthlyMonths.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setSelectedMonthlyMonths([])}
                            >
                              Clear All
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-3">
                          Select the months when these days will be assigned. If no months are selected, the assignment applies to all months.
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {monthsData.map((month) => {
                            const inPeriod = periodMonths === null || periodMonths.includes(month.id);
                            return (
                              <div
                                key={month.id}
                                className={`flex items-center space-x-2 p-2 rounded-md border transition-colors ${
                                  !inPeriod
                                    ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed pointer-events-none'
                                    : selectedMonthlyMonths.includes(month.id)
                                      ? 'bg-purple-100 border-purple-300 cursor-pointer'
                                      : 'bg-white border-gray-200 hover:bg-gray-50 cursor-pointer'
                                }`}
                                onClick={() => inPeriod && handleMonthlyMonthToggle(month.id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMonthlyMonths.includes(month.id)}
                                  onChange={() => inPeriod && handleMonthlyMonthToggle(month.id)}
                                  disabled={!inPeriod}
                                  className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 rounded"
                                />
                                <span className={`text-xs font-medium ${
                                  selectedMonthlyMonths.includes(month.id) ? 'text-purple-800' : 'text-gray-700'
                                }`}>
                                  {month.name.slice(0, 3)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {selectedMonthlyMonths.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600">Selected Months</span>
                              <span className="text-xs text-gray-500">
                                {selectedMonthlyMonths.length}/12
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {selectedMonthlyMonths.map((monthId) => {
                                const month = monthsData.find(m => m.id === monthId);
                                const inPeriod = periodMonths === null || periodMonths.includes(monthId);
                                return (
                                  <Badge
                                    key={monthId}
                                    variant="secondary"
                                    className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 transition-colors cursor-pointer group text-xs px-2 py-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (inPeriod) handleMonthlyMonthToggle(monthId);
                                    }}
                                  >
                                    {month?.name.slice(0, 3)}
                                    <X className="ml-1 h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {editingMasterId && (
              <div className="pt-2 border-t">
                <Label className="text-sm font-medium text-gray-700">Change reason (optional)</Label>
                <Input
                  {...form.register('change_reason')}
                  placeholder="e.g. Rescheduled salesmen"
                  className="mt-1"
                />
              </div>
            )}

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setEditingMasterId(null);
                  resetForm();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={assignRouteMutation.isPending || updateAssignmentMutation.isPending || form.formState.isSubmitting}
                className="bg-black hover:bg-gray-800"
                onClick={(e) => {
                  console.log("Submit button clicked");
                  console.log("Form state:", {
                    isValid: form.formState.isValid,
                    errors: form.formState.errors,
                    isSubmitting: form.formState.isSubmitting,
                    values: form.getValues()
                  });
                }}
              >
                {(assignRouteMutation.isPending || updateAssignmentMutation.isPending || form.formState.isSubmitting) ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {editingMasterId ? 'Updating...' : 'Assigning...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingMasterId ? 'Update Assignment' : 'Assign Routes'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignment Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserPlus className="h-5 w-5" />
              <span>Assignment Details</span>
            </DialogTitle>
            <DialogDescription>
              Detailed view of assignment #{selectedAssignment?.assignment_id || selectedAssignment?.id || 'N/A'}
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Loading assignment details...</span>
            </div>
          ) : assignmentDetailData ? (
            <div className="space-y-6">
              {/* Route Information */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <Route className="h-4 w-4 mr-2" />
                  Route Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Route Name</Label>
                    <p className="text-lg font-semibold">{assignmentDetailData.route?.route_name || "-"}</p>
                  </div>
                  {assignmentDetailData.route?.branch && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Branch</Label>
                      <p className="text-sm text-gray-700">{assignmentDetailData.route.branch}</p>
                    </div>
                  )}
                  {assignmentDetailData.route?.organization && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Organization</Label>
                      <p className="text-sm text-gray-700">{assignmentDetailData.route.organization}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Information */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assignment Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Route Type</Label>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 w-fit ${getRouteTypeBadgeClass(assignmentDetailData.route_type)}`}>
                        <Route className="h-3 w-3" />
                        <span className="capitalize">{assignmentDetailData.route_type || 'N/A'}</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <div className="mt-1">
                      <Badge variant={assignmentDetailData.is_active ? "default" : "secondary"} className="flex items-center space-x-1 w-fit">
                        {assignmentDetailData.is_active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        <span className="capitalize">{assignmentDetailData.is_active ? "Active" : "Inactive"}</span>
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                    <p className="text-sm text-gray-700">
                      {assignmentDetailData.start_date ? format(new Date(assignmentDetailData.start_date), 'dd-MM-yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">End Date</Label>
                    <p className="text-sm text-gray-700">
                      {assignmentDetailData.end_date ? format(new Date(assignmentDetailData.end_date), 'dd-MM-yyyy') : 'Ongoing'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Schedule Information */}
              {(assignmentDetailData.weekly_days || assignmentDetailData.monthly_days) && (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Schedule Information
                  </h3>
                  {assignmentDetailData.route_type === 'WEEKLY' && assignmentDetailData.weekly_days && assignmentDetailData.weekly_days.length > 0 && (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Week Days</Label>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {assignmentDetailData.weekly_days.map((day, idx) => {
                            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                            return (
                              <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-800">
                                {dayNames[day] || day}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                      {assignmentDetailData.route_type === 'WEEKLY' && assignmentDetailData.monthly_months && assignmentDetailData.monthly_months.length > 0 && (
                        <div className="mt-3">
                          <Label className="text-sm font-medium text-gray-500">Months</Label>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {assignmentDetailData.monthly_months.map((monthId, idx) => {
                              const month = monthsData.find(m => m.id === monthId);
                              return (
                                <Badge key={idx} variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                                  {month?.name || monthId}
                                </Badge>
                              );
                            })}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            Assignment applies only to these months for the selected weekdays.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {assignmentDetailData.route_type === 'MONTHLY' && assignmentDetailData.monthly_days && assignmentDetailData.monthly_days.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Month Days</Label>
                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        {assignmentDetailData.monthly_days.sort((a, b) => a - b).join(', ')}
                      </p>
                    </div>
                  )}
                  {assignmentDetailData.route_type === 'MONTHLY' && assignmentDetailData.monthly_months && assignmentDetailData.monthly_months.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Months</Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {assignmentDetailData.monthly_months.map((monthId, idx) => {
                          const month = monthsData.find(m => m.id === monthId);
                          return (
                            <Badge key={idx} variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                              {month?.name || monthId}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Assignment applies only to these months for the selected days.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Salesmen Information */}
              {assignmentDetailData.salesmen && Array.isArray(assignmentDetailData.salesmen) && assignmentDetailData.salesmen.length > 0 && (
                <div className="border rounded-lg p-4 bg-green-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Assigned Salesmen ({assignmentDetailData.salesmen_count || assignmentDetailData.salesmen.length})
                  </h3>
                  <div className="space-y-3">
                    {assignmentDetailData.salesmen.map((salesman, idx) => (
                      <div key={idx} className="p-3 bg-white rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{salesman.salesman_name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">ID: {salesman.salesman_id}</p>
                          </div>
                          <Badge variant={salesman.status === 'ACTIVE' ? "default" : "secondary"} className="text-xs">
                            {salesman.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-2">
                          <div>
                            <span className="font-medium">Start:</span> {salesman.start_date ? format(new Date(salesman.start_date), 'dd-MM-yyyy') : 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">End:</span> {salesman.end_date ? format(new Date(salesman.end_date), 'dd-MM-yyyy') : 'Ongoing'}
                          </div>
                        </div>
                        {salesman.customers && salesman.customers.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500 mb-1">Customers ({salesman.customer_count || salesman.customers.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {salesman.customers.slice(0, 5).map((cust, cIdx) => (
                                <Badge key={cIdx} variant="outline" className="text-xs">
                                  {cust.customer_name}
                                </Badge>
                              ))}
                              {salesman.customers.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{salesman.customers.length - 5} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers Information */}
              {assignmentDetailData.customers && Array.isArray(assignmentDetailData.customers) && assignmentDetailData.customers.length > 0 && (
                <div className="border rounded-lg p-4 bg-purple-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Building className="h-4 w-4 mr-2" />
                    Assigned Customers ({assignmentDetailData.customers_count || assignmentDetailData.customers.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {assignmentDetailData.customers.map((customer, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{customer.customer_name || 'Unknown'}</p>
                          {customer.address && (
                            <p className="text-xs text-gray-500">{customer.address}</p>
                          )}
                        </div>
                        {customer.contact_number && (
                          <Badge variant="outline" className="text-xs">
                            {customer.contact_number}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {/* Change History */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <History className="h-4 w-4 mr-2" />
                  Change History ({changeHistoryList.length})
                </h3>
                {changeHistoryList.length === 0 ? (
                  <p className="text-sm text-gray-500">No changes recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {changeHistoryList.map((h) => (
                      <div key={h.id} className="p-2 bg-white rounded border text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-800">{h.change_type?.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-500">{h.changed_at ? format(new Date(h.changed_at), 'dd-MM-yyyy HH:mm') : ''}</span>
                        </div>
                        {h.salesman_name && <p className="text-xs text-gray-600 mt-0.5">Salesman: {h.salesman_name}</p>}
                        {h.change_reason && <p className="text-xs text-gray-500 mt-1">{h.change_reason}</p>}
                        {h.changed_by && <p className="text-xs text-gray-400 mt-0.5">By: {h.changed_by}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created By</Label>
                  <p className="text-sm text-gray-700">
                    {assignmentDetailData.created_by || "-"}
                  </p>
                </div>
                {assignmentDetailData.updated_by && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Updated By</Label>
                    <p className="text-sm text-gray-700">
                      {assignmentDetailData.updated_by || "-"}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created At</Label>
                  <p className="text-sm text-gray-700">{formatDate(assignmentDetailData.created_at)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                  <p className="text-sm text-gray-700">{formatDate(assignmentDetailData.updated_at)}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditAssignment(selectedAssignment)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Assignment
                </Button>
              </div>
            </div>
          ) : selectedAssignment ? (
            <div className="space-y-6">
              {/* Fallback to basic display if detail API fails */}
              <p className="text-sm text-gray-500">Loading detailed information...</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Failed to load assignment details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Delete Assignment</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this route assignment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {assignmentToDelete && (
            <div className="py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><span className="font-medium">Route:</span> {assignmentToDelete.route_name || assignmentToDelete.name}</p>
                <p><span className="font-medium">Salesmen:</span> {assignmentToDelete.salesman_count} assigned</p>
                <p><span className="font-medium">Type:</span> {assignmentToDelete.route_type}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteAssignmentMutation.isPending}
            >
              {deleteAssignmentMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Route Occupancy Modal */}
      <Dialog open={isOccupancyModalOpen} onOpenChange={setIsOccupancyModalOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4" />
              Route Occupancy Analysis
            </DialogTitle>
            <DialogDescription className="text-xs">
              View day-wise route assignment occupancy for the selected month
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
          {/* Month/Year/Salesman Selector */}
          <div className="flex items-center gap-3 mb-4 mt-1 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="occupancy-month">Month:</Label>
              <Select
                value={occupancyMonth.toString()}
                onValueChange={(value) => setOccupancyMonth(parseInt(value))}
              >
                <SelectTrigger id="occupancy-month" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthsData.map((month) => (
                    <SelectItem key={month.id} value={month.id.toString()}>
                      {month.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="occupancy-year">Year:</Label>
              <Input
                id="occupancy-year"
                type="number"
                value={occupancyYear}
                onChange={(e) => setOccupancyYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-24"
                min="2020"
                max="2100"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="occupancy-salesman">Salesman:</Label>
              <Select
                value={occupancySalesmanFilter || "all"}
                onValueChange={(value) => setOccupancySalesmanFilter(value === "all" ? "" : value)}
              >
                <SelectTrigger id="occupancy-salesman" className="w-48">
                  <SelectValue placeholder="All Salesmen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Salesmen</SelectItem>
                  {salesmenData && salesmenData.length > 0 ? (
                    salesmenData.map((salesman) => (
                      <SelectItem key={salesman.user_id} value={salesman.user_id}>
                        {salesman.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-salesmen" disabled>No salesmen found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {occupancyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : occupancyData ? (
            <div className="space-y-2">
              {/* Calendar and Summary Layout */}
              <div className="flex gap-3 items-start">
                {/* Calendar View - Left Side */}
                <Card className="flex-1">
                  <CardHeader className="pb-1.5 pt-2 px-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{occupancyData.month_name}</span>
                      {selectedDayData && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDayData(null)}
                          className="text-[10px] h-5 px-1.5"
                        >
                          Clear
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="flex justify-center">
                      <div className="grid grid-cols-7 gap-1 w-full max-w-lg">
                    {/* Day headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center font-semibold text-xs text-gray-600 py-1">
                        {day}
                      </div>
                    ))}
                    
                    {/* Calendar days */}
                    {(() => {
                      const days = occupancyData.days || [];
                      const firstDay = new Date(occupancyYear, occupancyMonth - 1, 1).getDay();
                      const daysInMonth = days.length;
                      const calendarDays = [];
                      
                      // Empty cells for days before month starts
                      for (let i = 0; i < firstDay; i++) {
                        calendarDays.push(<div key={`empty-${i}`} className="h-12"></div>);
                      }
                      
                      // Actual days
                      days.forEach((dayData) => {
                        const routesCount = dayData.routes_count || 0;
                        const customersCount = dayData.customers_count || 0;
                        const salesmenCount = dayData.salesmen_count || 0;
                        
                        // Determine color intensity based on occupancy
                        const maxOccupancy = Math.max(routesCount, customersCount, salesmenCount);
                        let bgColor = 'bg-gray-50';
                        let textColor = 'text-gray-700';
                        let borderColor = 'border-gray-200';
                        
                        if (maxOccupancy > 0) {
                          if (maxOccupancy >= 10) {
                            bgColor = 'bg-red-100';
                            textColor = 'text-red-900';
                            borderColor = 'border-red-300';
                          } else if (maxOccupancy >= 5) {
                            bgColor = 'bg-orange-100';
                            textColor = 'text-orange-900';
                            borderColor = 'border-orange-300';
                          } else {
                            bgColor = 'bg-green-100';
                            textColor = 'text-green-900';
                            borderColor = 'border-green-300';
                          }
                        }
                        
                        const isSelected = selectedDayData?.day === dayData.day;
                        
                        calendarDays.push(
                          <div
                            key={dayData.day}
                            className={`h-12 p-1 border rounded ${bgColor} ${textColor} ${borderColor} hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center relative group ${isSelected ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
                            onClick={() => setSelectedDayData(isSelected ? null : dayData)}
                          >
                            <div className="font-semibold text-sm">{dayData.day}</div>
                            
                            {!isSelected && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-lg">
                                <div className="font-semibold mb-1 border-b border-gray-700 pb-1">Day {dayData.day}</div>
                                <div>Routes: {routesCount}</div>
                                <div>Customers: {customersCount}</div>
                                <div>Salesmen: {salesmenCount}</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            )}
                          </div>
                        );
                      });
                      
                      return calendarDays;
                    })()}
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px]">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-gray-50 border rounded"></div>
                        <span>No assignments</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-green-100 rounded"></div>
                        <span>Low (1-4)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-orange-100 rounded"></div>
                        <span>Medium (5-9)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-red-100 rounded"></div>
                        <span>High (10+)</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary Cards - Right Side, Vertical Stack */}
                <div className="flex flex-col gap-3 w-64 flex-shrink-0">
                  <Card>
                    <CardContent className="pt-4 pb-2 px-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-1">Total Routes</p>
                        <p className="text-2xl font-bold text-blue-600">{occupancyData.summary?.max_routes || 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-2 px-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                        <p className="text-2xl font-bold text-green-600">{occupancyData.summary?.max_customers || 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-2 px-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-1">Total Salesmen</p>
                        <p className="text-2xl font-bold text-purple-600">{occupancyData.summary?.max_salesmen || 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-1">Avg Routes/Day</p>
                        <p className="text-2xl font-bold text-orange-600">{occupancyData.summary?.avg_routes?.toFixed(1) || '0.0'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              No occupancy data available
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
