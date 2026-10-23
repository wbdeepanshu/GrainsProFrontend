import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
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
import {
  Menu,
  Search,
  Eye,
  Calendar,
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
  UserPlus,
  History,
  Pencil,
  Trash2
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import React from "react";
import { useUserPermissions } from "../hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// Form validation schema
const routeSchema = z.object({
  route_name: z.string().min(1, "Route name is required"),
  branch_id: z.number().nullable().optional(),
  debtor_list: z.array(z.number()).optional().default([]),
  customer_list: z.array(z.number()).optional().default([]),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  is_active: z.boolean().default(true),
});

export default function RouteManagement() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRouteFormOpen, setIsRouteFormOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editingRouteDetail, setEditingRouteDetail] = useState(null);
  const [isLoadingEditRoute, setIsLoadingEditRoute] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [selectedLedgers, setSelectedLedgers] = useState([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [historyModalRoute, setHistoryModalRoute] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [customersExpanded, setCustomersExpanded] = useState(false);
  const isMobile = useIsMobile();

  const CUSTOMERS_INITIAL_SHOW = 10;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Debounce search terms to prevent API calls on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedLedgerSearchTerm = useDebounce(ledgerSearchTerm, 500);
  const debouncedCustomerSearchTerm = useDebounce(customerSearchTerm, 500);

  // Reset to page 1 when debounced search term changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

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
    resolver: zodResolver(routeSchema),
    defaultValues: {
      route_name: "",
      branch_id: null,
      debtor_list: [],
      customer_list: [],
      from_date: "",
      to_date: "",
      is_active: true,
    },
  });


  // Build query parameters for API call (using debounced search term)
  const buildQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('per_page', pageSize.toString());
    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    return params.toString();
  }, [currentPage, pageSize, debouncedSearchTerm]);

  // Fetch routes from API
  const { data: routesData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [`routes`, debouncedSearchTerm, currentPage],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/growth/route/list/${buildQueryParams ? `?${buildQueryParams}` : ''}`;
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    keepPreviousData: true, // react-query v4
    placeholderData: (previousData) => previousData, // react-query v5
  });

  const buildRouteSubmitPayload = (data) => ({
    name: data.route_name,
    organization: data.organization || null,
    branch: data.branch_id || null,
    customer_ids: data.customer_list || [],
    debtor_ids: data.debtor_list || [],
    is_active: data.is_active !== undefined ? data.is_active : true,
  });

  // Create route mutation
  const createRouteMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest(
        'POST',
        `${API_BASE_URL}/api/growth/route/create/`,
        buildRouteSubmitPayload(data)
      );
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200 || data.status === 201) {
        toast({
          title: "✅ Success",
          description: "Route created successfully",
          className: "bg-green-50 border-green-100 text-green-800",
        });
        handleCloseRouteForm();
        queryClient.invalidateQueries(['routes']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create route",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Create route error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create route",
        variant: "destructive",
      });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiRequest(
        'PATCH',
        `${API_BASE_URL}/api/growth/route/${id}/update/`,
        buildRouteSubmitPayload(data)
      );
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: "Route updated successfully",
          className: "bg-green-50 border-green-100 text-green-800",
        });
        handleCloseRouteForm();
        queryClient.invalidateQueries(['routes']);
        if (selectedRoute?.id === editingRoute?.id) {
          setSelectedRoute(data.data || selectedRoute);
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update route",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update route",
        variant: "destructive",
      });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId) => {
      const response = await apiRequest(
        'DELETE',
        `${API_BASE_URL}/api/growth/route/${routeId}/delete/`
      );
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data, routeId) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: "Route deleted successfully",
          className: "bg-green-50 border-green-100 text-green-800",
        });
        setRouteToDelete(null);
        if (selectedRoute?.id === routeId) {
          setIsDetailModalOpen(false);
          setSelectedRoute(null);
        }
        queryClient.invalidateQueries(['routes']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete route",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete route",
        variant: "destructive",
      });
    },
  });

  // Fetch ledgers with infinite scroll (same as add-inward.jsx)
  const fetchLedgers = async ({ pageParam = 1, queryKey }) => {
    const [, search] = queryKey;
    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/report/get-ledgers-groups/?type=Sales&page=${pageParam}&search=${encodeURIComponent(search || "")}`
    );
    const data = await response.json();
    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
      total: data.pagination?.total_count || 0,
    };
  };

  const {
    data: ledgersData,
    fetchNextPage: fetchNextLedgerPage,
    hasNextPage: hasNextLedgerPage,
    isFetchingNextPage: isFetchingNextLedgerPage,
  } = useInfiniteQuery({
    queryKey: ["ledgers", debouncedLedgerSearchTerm],
    queryFn: fetchLedgers,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isRouteFormOpen,
    refetchOnWindowFocus: false,
    keepPreviousData: true, // react-query v4
    placeholderData: (previousData) => previousData, // react-query v5
  });

  const ledgers = ledgersData?.pages?.flatMap((page) => page.results) || [];

  // Remember debtor names by id. The `ledgers` list changes on every debtor search,
  // so deriving selected names from it made the customers query key change (and refetch)
  // while typing in the debtor search box.
  const [debtorNameById, setDebtorNameById] = useState({});
  useEffect(() => {
    if (!ledgers.length) return;
    setDebtorNameById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const l of ledgers) {
        if (l?.id != null && l.name && next[l.id] !== l.name) {
          next[l.id] = l.name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [ledgersData]);
  useEffect(() => {
    const debtors = editingRouteDetail?.debtors || [];
    if (!debtors.length) return;
    setDebtorNameById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const d of debtors) {
        if (d?.id != null && d.name && next[d.id] !== d.name) {
          next[d.id] = d.name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [editingRouteDetail]);

  // Names of selected debtors (used to filter customers) - stable across debtor searches
  const selectedDebtorNames = useMemo(() => {
    return selectedLedgers
      .map((id) => debtorNameById[id])
      .filter(Boolean);
  }, [selectedLedgers, debtorNameById]);

  // Fetch customers with infinite scroll (filtered by selected debtors)
  const fetchCustomers = async ({ pageParam = 1, queryKey }) => {
    const [, search, debtorNames] = queryKey;

    // Build query parameters
    const params = new URLSearchParams();
    params.append('page', pageParam.toString());
    params.append('per_page', '50');
    if (search) {
      params.append('search', search);
    }
    // Add parent filter if debtors are selected (multiple parent values)
    if (debtorNames && debtorNames.length > 0) {
      debtorNames.forEach(name => {
        params.append('parent', name);
      });
    }

    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`
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
    queryKey: ["customers", debouncedCustomerSearchTerm, selectedDebtorNames],
    queryFn: fetchCustomers,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isRouteFormOpen && selectedDebtorNames.length > 0,
    refetchOnWindowFocus: false,
    keepPreviousData: true, // react-query v4
    placeholderData: (previousData) => previousData, // react-query v5
  });

  const customers = customersData?.pages?.flatMap((page) => page.results) || [];

  // Handle multiple debtor selection
  const handleDebtorToggle = (debtorId) => {
    const newSelectedDebtors = selectedLedgers.includes(debtorId)
      ? selectedLedgers.filter(id => id !== debtorId)
      : [...selectedLedgers, debtorId];

    setSelectedLedgers(newSelectedDebtors);
    form.setValue("debtor_list", newSelectedDebtors);
    setCustomersExpanded(false);
  };

  const handleRemoveDebtor = (debtorId) => {
    const removedDebtorName = debtorNameById[debtorId] || ledgers.find(l => l.id === debtorId)?.name;
    const newSelectedDebtors = selectedLedgers.filter(id => id !== debtorId);

    // Remove from selectedCustomers any customer belonging to the removed debtor
    if (removedDebtorName && customers.length > 0) {
      const customerIdsToRemove = customers
        .filter(c => (c.parent || "").toString().trim() === removedDebtorName)
        .map(c => c.id);
      const newSelectedCustomers = selectedCustomers.filter(id => !customerIdsToRemove.includes(id));
      setSelectedCustomers(newSelectedCustomers);
      form.setValue("customer_list", newSelectedCustomers);
    }

    if (newSelectedDebtors.length === 0) {
      setSelectedCustomers([]);
      form.setValue("customer_list", []);
    }

    setSelectedLedgers(newSelectedDebtors);
    form.setValue("debtor_list", newSelectedDebtors);
    setCustomersExpanded(false);
  };

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

  // Handle select all customers
  const handleSelectAllCustomers = () => {
    const allCustomerIds = customers.map(c => c.id);
    const allSelected = allCustomerIds.every(id => selectedCustomers.includes(id));

    if (allSelected) {
      // Deselect all
      setSelectedCustomers([]);
      form.setValue("customer_list", []);
    } else {
      // Select all
      setSelectedCustomers(allCustomerIds);
      form.setValue("customer_list", allCustomerIds);
    }
  };

  // Check if all customers are selected
  const areAllCustomersSelected = customers.length > 0 && customers.every(c => selectedCustomers.includes(c.id));

  const routes = routesData?.data || [];
  const totalCount = routesData?.count || routes.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNext = currentPage < totalPages;
  const hasPrevious = currentPage > 1;

  // Route assignment history list (for history modal)
  const historyPageSize = 20;
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['route-assignment-history', historyModalRoute?.id, historyPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', historyPage.toString());
      params.append('page_size', historyPageSize.toString());
      if (historyModalRoute?.id) params.append('route_id', historyModalRoute.id.toString());
      const response = await apiRequest('GET', `${API_BASE_URL}/api/growth/route/assignment/history/?${params.toString()}`);
      const data = await response.json();
      return data;
    },
    enabled: !!historyModalRoute && !!AuthService.getAccessToken(),
  });
  const historyList = historyData?.data || [];
  const historyTotal = historyData?.total_count ?? 0;
  const historyPagination = historyData?.pagination || {};
  const historyTotalPages = historyPagination.total_pages ?? 1;

  const handleViewDetails = (route) => {
    setSelectedRoute(route);
    setIsDetailModalOpen(true);
  };

  const handleOpenHistory = (route) => {
    setHistoryModalRoute(route);
    setHistoryPage(1);
  };

  const handleCloseHistoryModal = () => {
    setHistoryModalRoute(null);
    setHistoryPage(1);
  };

  const resetRouteFormState = () => {
    setSelectedLedgers([]);
    setLedgerSearchTerm("");
    setSelectedCustomers([]);
    setCustomerSearchTerm("");
    setCustomersExpanded(false);
    setEditingRoute(null);
    setEditingRouteDetail(null);
    form.reset({
      route_name: "",
      branch_id: null,
      debtor_list: [],
      customer_list: [],
      from_date: "",
      to_date: "",
      is_active: true,
    });
  };

  const handleCreateRoute = () => {
    resetRouteFormState();
    setIsRouteFormOpen(true);
  };

  const handleCloseRouteForm = () => {
    setIsRouteFormOpen(false);
    resetRouteFormState();
  };

  const handleEditRoute = async (route) => {
    try {
      setIsLoadingEditRoute(true);
      const response = await apiRequest('GET', `${API_BASE_URL}/api/growth/route/${route.id}/`);
      const result = await response.json();

      if (result.status !== 200 || !result.data) {
        throw new Error(result.message || "Failed to load route details");
      }

      const detail = result.data;
      const debtorIds = (detail.debtors || []).map((debtor) => debtor.id);
      const customerIds = (detail.customers || []).map((customer) => customer.id);

      setEditingRoute(route);
      setEditingRouteDetail(detail);
      setSelectedLedgers(debtorIds);
      setSelectedCustomers(customerIds);
      setLedgerSearchTerm("");
      setCustomerSearchTerm("");
      setCustomersExpanded(false);
      form.reset({
        route_name: detail.name || route.name || "",
        branch_id: null,
        debtor_list: debtorIds,
        customer_list: customerIds,
        from_date: "",
        to_date: "",
        is_active: detail.is_active !== false,
      });
      setIsRouteFormOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load route for editing",
        variant: "destructive",
      });
    } finally {
      setIsLoadingEditRoute(false);
    }
  };

  const getDebtorLabel = (debtorId) => {
    return (
      ledgers.find((ledger) => ledger.id === debtorId)?.name ||
      editingRouteDetail?.debtors?.find((debtor) => debtor.id === debtorId)?.name ||
      `Debtor ${debtorId}`
    );
  };

  const getCustomerLabel = (customerId) => {
    return (
      customers.find((customer) => customer.id === customerId)?.name ||
      editingRouteDetail?.customers?.find((customer) => customer.id === customerId)?.name ||
      `Customer ${customerId}`
    );
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const onSubmit = async (data) => {
    try {
      // Log form data for debugging
      console.log("Form data:", data);
      console.log("Form errors:", form.formState.errors);

      // Prepare data for API - only include fields that the API expects
      const submitData = {
        route_name: data.route_name,
        debtor_list: data.debtor_list || [],
        customer_list: data.customer_list || [],
        branch_id: data.branch_id || null,
      };

      console.log("Submitting route data:", submitData);
      if (editingRoute?.id) {
        await updateRouteMutation.mutateAsync({ id: editingRoute.id, data: submitData });
      } else {
        await createRouteMutation.mutateAsync(submitData);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit form",
        variant: "destructive",
      });
    }
  };

  const LABELS = {
    start_date: 'Start date',
    end_date: 'End date',
    salesman_id: 'Salesman ID',
    salesman_name: 'Salesman',
    customer_ids: 'Customers',
  };
  const formatHistoryFieldValue = (key, value) => {
    if (value == null) return '-';
    if (key === 'customer_ids' && Array.isArray(value)) {
      return value.length ? `${value.length} customer(s)` : 'None';
    }
    if ((key === 'start_date' || key === 'end_date') && value) {
      try { return format(new Date(value), 'dd-MM-yyyy'); } catch { return String(value); }
    }
    return String(value);
  };
  const renderHistoryValue = (val) => {
    if (val == null) return <span className="text-gray-500">—</span>;
    let obj = val;
    if (typeof val === 'string') {
      try { obj = JSON.parse(val); } catch { return <span className="break-all">{val}</span>; }
    }
    if (typeof obj !== 'object' || obj === null) {
      return <span>{String(obj)}</span>;
    }
    if (Array.isArray(obj)) {
      return <span>{obj.length ? `${obj.length} item(s)` : '—'}</span>;
    }
    const entries = Object.entries(obj);
    return (
      <dl className="text-xs space-y-0.5 mt-0.5">
        {entries.map(([k, v]) => {
          const label = LABELS[k] || k.replace(/_/g, ' ');
          const display = formatHistoryFieldValue(k, v);
          return (
            <div key={k} className="flex gap-2">
              <dt className="text-gray-500 shrink-0">{label}:</dt>
              <dd className="font-medium break-words">{display}</dd>
            </div>
          );
        })}
      </dl>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'dd-MM-yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  // Full-page loader only for the very first load, so the search input keeps focus while typing.
  if (isLoading && !routesData) {
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
                <Route className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view route management. Contact your administrator for access.
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
              <h1 className="text-2xl font-bold text-gray-900">Route Management</h1>
              <p className="text-gray-600">Create and manage delivery routes</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasCreatePermission("route_management") && (
              <Button
                onClick={handleCreateRoute}
                className="bg-black hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Route
              </Button>
            )}
            <Badge variant="outline" className="text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date().toLocaleDateString('en-GB')}
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 min-h-0">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search routes by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                      {isFetching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Routes List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Route className="h-5 w-5" />
                    <span>Routes ({routes.length})</span>
                  </div>
                  <Badge variant="outline">
                    Total: {totalCount}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {routes.map((route) => (
                    <div
                      key={route.id}
                      className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Status and Counts Row */}
                          <div className="flex items-center flex-wrap gap-2">
                            {/* Assignment Status */}
                            <Badge
                              variant={route.is_assigned ? "default" : "secondary"}
                              className="flex items-center space-x-1"
                            >
                              {route.is_assigned ? (
                                <>
                                  <CheckCircle className="h-3 w-3" />
                                  <span>Assigned</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3" />
                                  <span>Not Assigned</span>
                                </>
                              )}
                            </Badge>

                            {/* Assignment Count */}
                            {route.assignment_count > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <UserPlus className="h-3 w-3" />
                                <span>{route.assignment_count} Assignment{route.assignment_count > 1 ? 's' : ''}</span>
                              </Badge>
                            )}

                            {/* Salesmen Count */}
                            {route.salesman_count > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Users className="h-3 w-3" />
                                <span>{route.salesman_count} Salesman{route.salesman_count > 1 ? '' : ''}</span>
                              </Badge>
                            )}

                            {/* Debtors Count */}
                            {route.debtor_count > 0 && (
                              <Badge variant="secondary" className="flex items-center space-x-1">
                                <Users className="h-3 w-3" />
                                <span>{route.debtor_count} Debtor{route.debtor_count > 1 ? 's' : ''}</span>
                              </Badge>
                            )}

                            {/* Customers Count */}
                            {route.customer_count > 0 && (
                              <Badge variant="secondary" className="flex items-center space-x-1">
                                <Building className="h-3 w-3" />
                                <span>{route.customer_count} Customer{route.customer_count > 1 ? 's' : ''}</span>
                              </Badge>
                            )}
                          </div>

                          {/* Debtors List */}
                          {route.debtors && route.debtors.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-500">Debtors:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {route.debtors.slice(0, 5).map((debtor) => (
                                  <Badge key={debtor.id} variant="outline" className="text-xs">
                                    {debtor.name}
                                  </Badge>
                                ))}
                                {route.debtors.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{route.debtors.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Route Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-500">Route Name:</span>
                              <p className="font-semibold">{route.name || route.route_name}</p>
                            </div>
                            {/* <div>
                              <span className="font-medium text-gray-500">Branch:</span>
                              <p className="font-semibold">{route.branch?.name || route.branch_name || "-"}</p>
                            </div> */}
                            <div>
                              <span className="font-medium text-gray-500">Created By:</span>
                              <p className="font-semibold">{route.created_by_name || route.created_by?.username || route.created_by || "-"}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Created:</span>
                              <p className="font-semibold">{formatDate(route.created_at)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Navigate to route assignment page with route_id parameter
                              window.location.href = `/route-assignment?route_id=${route.id}`;
                            }}
                            className="flex items-center space-x-1"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            <span>Assign Route</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenHistory(route)}
                            className="flex items-center space-x-1"
                            title="Route assignment history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleViewDetails(route)}
                            className="flex items-center space-x-1"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {hasUpdatePermission("route_management") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditRoute(route)}
                              disabled={isLoadingEditRoute}
                              className="flex items-center space-x-1"
                              title="Edit route"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {hasDeletePermission("route_management") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRouteToDelete(route)}
                              className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete route"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {routes.length === 0 && (
                    <div className="text-center py-8">
                      <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No routes found</p>
                      <Button
                        onClick={handleCreateRoute}
                        className="mt-4 bg-black hover:bg-gray-800"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Route
                      </Button>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} routes
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

      {/* Create / Edit Route Modal */}
      <Dialog open={isRouteFormOpen} onOpenChange={(open) => !open && handleCloseRouteForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center space-x-2">
              <Route className="h-5 w-5" />
              <span>{editingRoute ? "Edit Route" : "Create New Route"}</span>
            </DialogTitle>
            <DialogDescription>
              {editingRoute
                ? "Update route details, debtors, and customers"
                : "Create a new delivery route with assigned customers and salesmen"}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log("Form validation errors:", errors);
              toast({
                title: "Validation Error",
                description: "Please check the form for errors",
                variant: "destructive",
              });
            })}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-4 space-y-6">
              <div className="space-y-4">
                <Input
                  id="route_name"
                  placeholder="Enter route name"
                  maxLength={30}
                  {...form.register("route_name", {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                    },
                  })}
                />

                <div>
                  <Label htmlFor="debtor_list">Debtors</Label>

                  {/* Selected Debtors Display */}
                  {selectedLedgers.length > 0 && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-md">
                      <div className="flex flex-wrap gap-2">
                        {selectedLedgers.map((debtorId) => (
                          <Badge
                            key={debtorId}
                            variant="secondary"
                            className="flex items-center gap-1 px-2 py-1"
                          >
                            <span>{getDebtorLabel(debtorId)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDebtor(debtorId)}
                              className="ml-1 hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debtors Dropdown */}
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Debtors" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <input
                          type="text"
                          placeholder="Search debtors..."
                          value={ledgerSearchTerm}
                          onChange={(e) => setLedgerSearchTerm(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                      <div
                        className="max-h-60 overflow-auto"
                        onScroll={(e) => {
                          const target = e.currentTarget;
                          if (
                            target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                            hasNextLedgerPage &&
                            !isFetchingNextLedgerPage
                          ) {
                            fetchNextLedgerPage();
                          }
                        }}
                      >
                        {ledgers.map((debtor) => (
                          <div
                            key={debtor.id}
                            className="flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleDebtorToggle(debtor.id)}
                          >
                            <input
                              type="checkbox"
                              checked={selectedLedgers.includes(debtor.id)}
                              onChange={() => handleDebtorToggle(debtor.id)}
                              className="rounded"
                            />
                            <span className="flex-1">{debtor.name}</span>
                          </div>
                        ))}
                        {isFetchingNextLedgerPage && (
                          <div className="p-2 text-center text-sm">Loading more...</div>
                        )}
                        {!isFetchingNextLedgerPage && ledgers.length === 0 && (
                          <div className="p-2 text-center text-sm text-gray-500">
                            No debtors found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.debtor_list && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.debtor_list.message}
                    </p>
                  )}
                </div>

                {/* Customers Selection - only show when debtors are selected */}
                {selectedLedgers.length > 0 && (
                  <div>
                    <Label htmlFor="customer_list">Customers</Label>

                    {/* Selected Customers Display */}
                    {selectedCustomers.length > 0 && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-md">
                        <div className="flex flex-wrap gap-2">
                          {selectedCustomers.map((customerId) => (
                            <Badge
                              key={customerId}
                              variant="secondary"
                              className="flex items-center gap-1 px-2 py-1"
                            >
                              <span>{getCustomerLabel(customerId)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomer(customerId)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Customers Dropdown */}
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <input
                            type="text"
                            placeholder="Search customers..."
                            value={customerSearchTerm}
                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full border rounded-md px-2 py-1"
                          />
                        </div>
                        <div
                          className="max-h-60 overflow-auto"
                          onScroll={(e) => {
                            const target = e.currentTarget;
                            if (
                              target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                              hasNextCustomerPage &&
                              !isFetchingNextCustomerPage
                            ) {
                              fetchNextCustomerPage();
                            }
                          }}
                        >
                          {/* Select All Option */}
                          {customers.length > 0 && (
                            <div
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200 font-medium"
                              onClick={handleSelectAllCustomers}
                            >
                              <input
                                type="checkbox"
                                checked={areAllCustomersSelected}
                                onChange={handleSelectAllCustomers}
                                className="rounded"
                              />
                              <span className="flex-1">Select All</span>
                            </div>
                          )}
                          {(customersExpanded ? customers : customers.slice(0, CUSTOMERS_INITIAL_SHOW)).map((customer) => (
                            <div
                              key={customer.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => handleCustomerToggle(customer.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCustomers.includes(customer.id)}
                                onChange={() => handleCustomerToggle(customer.id)}
                                className="rounded"
                              />
                              <span className="flex-1">{customer.name}</span>
                            </div>
                          ))}
                          {/* Show more button */}
                          {!customersExpanded && customers.length > CUSTOMERS_INITIAL_SHOW && (
                            <button
                              type="button"
                              onClick={() => setCustomersExpanded(true)}
                              className="w-full flex items-center justify-center gap-2 p-2 mt-1 border border-dashed border-gray-300 rounded-md hover:bg-gray-50 text-sm text-gray-600"
                            >
                              <Plus className="h-4 w-4" />
                              {customers.length - CUSTOMERS_INITIAL_SHOW} more customers
                            </button>
                          )}
                          {isFetchingNextCustomerPage && (
                            <div className="p-2 text-center text-sm">Loading more...</div>
                          )}
                          {!isFetchingNextCustomerPage && customers.length === 0 && (
                            <div className="p-2 text-center text-sm text-gray-500">
                              No customers found
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.customer_list && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.customer_list.message}
                      </p>
                    )}
                  </div>
                )}

                {/* <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  {...form.register("is_active")}
                  className="rounded"
                />
                <Label htmlFor="is_active">Active Route</Label>
              </div> */}
              </div>
            </div>

            <div className="shrink-0 flex justify-end space-x-4 px-6 py-4 border-t bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseRouteForm}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createRouteMutation.isPending ||
                  updateRouteMutation.isPending ||
                  form.formState.isSubmitting
                }
                className="bg-black hover:bg-gray-800"
              >
                {createRouteMutation.isPending || updateRouteMutation.isPending || form.formState.isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {editingRoute ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingRoute ? "Update Route" : "Create Route"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Route Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Route className="h-5 w-5" />
              <span>Route Details</span>
            </DialogTitle>
            <DialogDescription>
              Detailed view of route #{selectedRoute?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedRoute ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Route Name</Label>
                    <p className="text-lg font-semibold">{selectedRoute.name || selectedRoute.route_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Branch</Label>
                    <p className="text-lg font-semibold">{selectedRoute.branch_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Debtors</Label>
                    <p className="text-lg font-semibold">{selectedRoute.debtor_count || 0} assigned</p>
                    {selectedRoute.debtors && selectedRoute.debtors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedRoute.debtors.map((debtor) => (
                          <Badge key={debtor.id} variant="outline" className="text-xs">
                            {debtor.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customers</Label>
                    <p className="text-lg font-semibold">{selectedRoute.customer_count || 0} assigned</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge variant={selectedRoute.is_active ? "default" : "secondary"} className="flex items-center space-x-1 w-fit">
                      {selectedRoute.is_active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      <span className="capitalize">{selectedRoute.is_active ? "Active" : "Inactive"}</span>
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Assignment Status</Label>
                    <Badge
                      variant={selectedRoute.is_assigned ? "default" : "secondary"}
                      className="flex items-center space-x-1 w-fit"
                    >
                      {selectedRoute.is_assigned ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          <span>Assigned ({selectedRoute.assignment_count || 0})</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          <span>Not Assigned</span>
                        </>
                      )}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Assignment Count</Label>
                    <p className="text-lg font-semibold">{selectedRoute.assignment_count || 0}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total Salesmen</Label>
                    <p className="text-lg font-semibold">{selectedRoute.salesman_count || 0}</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created By</Label>
                  <p className="text-sm text-gray-700">{selectedRoute.created_by || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created At</Label>
                  <p className="text-sm text-gray-700">{formatDate(selectedRoute.created_at)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                  <p className="text-sm text-gray-700">{formatDate(selectedRoute.updated_at)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Failed to load route details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Route Confirmation */}
      <Dialog open={!!routeToDelete} onOpenChange={(open) => !open && setRouteToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              <span>Delete Route</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-900">
                {routeToDelete?.name || routeToDelete?.route_name}
              </span>
              ? This will deactivate the route and its related assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRouteToDelete(null)}
              disabled={deleteRouteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteRouteMutation.isPending}
              onClick={() => routeToDelete?.id && deleteRouteMutation.mutate(routeToDelete.id)}
            >
              {deleteRouteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Route"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Route Assignment History Modal */}
      <Dialog open={!!historyModalRoute} onOpenChange={(open) => !open && handleCloseHistoryModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>Route assignment history</span>
            </DialogTitle>
            <DialogDescription>
              {historyModalRoute ? (historyModalRoute.name || historyModalRoute.route_name || `Route #${historyModalRoute.id}`) : ''}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
                {historyList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 rounded-md border border-dashed">
                    No history for this route
                  </div>
                ) : (
                  historyList.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border bg-gray-50/50 p-4 space-y-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-2">
                        <span className="font-medium text-gray-700">
                          {String(row.change_type || '—').replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-500">
                          {row.changed_at ? formatDate(row.changed_at) : '—'}
                        </span>
                        {row.changed_by && (
                          <span className="text-gray-500">by {row.changed_by}</span>
                        )}
                        {row.salesman_name && (
                          <Badge variant="secondary" className="text-xs">
                            {row.salesman_name}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Old value</p>
                          <div className="rounded border bg-white p-2 min-h-[2.5rem]">
                            {renderHistoryValue(row.old_value)}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">New value</p>
                          <div className="rounded border bg-white p-2 min-h-[2.5rem]">
                            {renderHistoryValue(row.new_value)}
                          </div>
                        </div>
                      </div>
                      {row.change_reason && (
                        <p className="text-gray-600 text-xs">
                          <span className="font-medium text-gray-500">Reason:</span> {row.change_reason}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-gray-500">
                    Showing {historyList.length} of {historyTotal} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={!historyPagination.has_previous}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {historyPage} of {historyTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => p + 1)}
                      disabled={!historyPagination.has_next}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}