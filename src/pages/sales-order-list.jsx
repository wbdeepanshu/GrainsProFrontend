import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useIsMobile } from "../hooks/use-mobile";
import { useLocation } from "wouter";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { ScrollArea } from "../components/ui/scroll-area";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import {
  Menu,
  Search,
  Eye,
  FileText,
  Calendar,
  CalendarDays,
  CalendarIcon,
  Filter,
  DollarSign,
  User,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingCart,
  Loader2,
  Plus,
  ArrowLeft,
  Package,
  Download,
  MapPin,
  Edit,
  Trash2,
  MoreVertical,
  Truck,
  RefreshCw,
  CheckCircle2,
  Pencil,
  X,
  ChevronsUpDown,
  Check,
  Volume2,
  Pause,
  Image,
  Minus
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { downloadSalesOrderPdf } from "../utils/salesOrderPdfGenerator";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SALES_ORDERS_LIST_REFRESH_KEY = "salesOrdersListRefresh";
const SALES_ORDERS_DETAIL_REFRESH_SO_KEY = "salesOrdersListRefreshSoNumber";

const getSalesOrderPhotoUrl = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  return trimmed;
};

// Helper function to format date for display
const formatDateForApi = (date) => {
  return date ? format(new Date(date), "dd-MM-yyyy") : "";
};

/** Sales orders editable from list/details when workflow status is pending or approved. */
const isSalesOrderEditableStatus = (soStatus) => {
  const normalized = String(soStatus || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
  return normalized === "pending" || normalized === "approved";
};

const actionIconButtonClass =
  "inline-flex items-center justify-center shrink-0 h-8 w-8 min-h-8 min-w-8 p-0";

export default function SalesOrderList() {
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voiceAudioRef = useRef(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [isApproveRejectModalOpen, setIsApproveRejectModalOpen] = useState(false);
  const [selectedOrderForAction, setSelectedOrderForAction] = useState(null);
  const [actionType, setActionType] = useState(""); // "approve" or "reject"
  const [actionRemarks, setActionRemarks] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [itemUpdates, setItemUpdates] = useState([]); // For item-level updates
  const [editingItem, setEditingItem] = useState(null); // For item-wise edit modal
  const [isItemEditModalOpen, setIsItemEditModalOpen] = useState(false);
  const [itemEditData, setItemEditData] = useState({
    item_id: null,
    approved_quantity: 0,
    rate: 0,
    base_unit_id: null,
    action_remarks: "",
    action: ""
  });
  // State for inline item editing in details view
  const [itemEdits, setItemEdits] = useState({}); // { itemId: { approved_quantity, rate, base_unit_id, action_remarks, fixed_total, hasChanges } }
  // State for stock item pricing in details view (for inline editing)
  const [itemPricingMap, setItemPricingMap] = useState({}); // { itemId: { base_unit, alternate_unit, conversion, etc. } }
  // State for editing comment index
  const [editingCommentIndex, setEditingCommentIndex] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedLedgerGroupId, setSelectedLedgerGroupId] = useState(null);
  const [selectedLedgerGroupName, setSelectedLedgerGroupName] = useState("");
  const [ledgerGroupDropdownOpen, setLedgerGroupDropdownOpen] = useState(false);
  const [ledgerGroupSearchTerm, setLedgerGroupSearchTerm] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [selectedItemFilterId, setSelectedItemFilterId] = useState(null);
  const [selectedItemFilterName, setSelectedItemFilterName] = useState("");
  const [itemFilterOpen, setItemFilterOpen] = useState(false);
  const [itemFilterSearch, setItemFilterSearch] = useState("");
  const [debouncedItemFilterSearch, setDebouncedItemFilterSearch] = useState("");
  // State for ledger selection dialog
  const [isLedgerDialogOpen, setIsLedgerDialogOpen] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [orderToSync, setOrderToSync] = useState(null);
  const [voucherTypeName, setVoucherTypeName] = useState("SALES ORDER VAN");
  const [selectedVoucherType, setSelectedVoucherType] = useState(null);
  const [voucherTypeSearchTerm, setVoucherTypeSearchTerm] = useState("");
  // State for edit sales order dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  // State for editing delivery address in details modal
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState("");
  const [editFormData, setEditFormData] = useState({
    customer_id: null,
    address: "",
    branch_id: null
  });
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");

  // Initialize with URL parameters if available, otherwise default to today (current date)
  const getInitialValues = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlFromDate = urlParams.get('from_date');
    const urlToDate = urlParams.get('to_date');
    const hasUrlDates = !!(urlFromDate && urlToDate);
    const now = new Date();
    return {
      statusFilter: urlParams.get('status') || "all",
      fromDate: urlFromDate ? new Date(urlFromDate) : startOfDay(now),
      toDate: urlToDate ? new Date(urlToDate) : endOfDay(now),
      dateRangePreset: hasUrlDates ? "custom" : "today",
    };
  };

  const initialValues = getInitialValues();
  const [statusFilter, setStatusFilter] = useState(initialValues.statusFilter);
  const [fromDate, setFromDate] = useState(initialValues.fromDate);
  const [toDate, setToDate] = useState(initialValues.toDate);
  const [dateRangePreset, setDateRangePreset] = useState(initialValues.dateRangePreset); // "today" | "weekly" | "monthly" | "custom"
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);

  // Apply date range preset: set fromDate/toDate when preset is today/weekly/monthly
  useEffect(() => {
    const now = new Date();
    if (dateRangePreset === "today") {
      setFromDate(startOfDay(now));
      setToDate(endOfDay(now));
    } else if (dateRangePreset === "weekly") {
      setFromDate(startOfWeek(now, { weekStartsOn: 1 })); // Monday
      setToDate(endOfWeek(now, { weekStartsOn: 1 }));     // Sunday
    } else if (dateRangePreset === "monthly") {
      setFromDate(startOfMonth(now));
      setToDate(endOfMonth(now));
    }
  }, [dateRangePreset]);

  const [pageSize] = useState(20);
  const [selectedSalesOrders, setSelectedSalesOrders] = useState([]); // Array of so_number strings
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Get user permissions
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    hasPermission,
    isLoading: permissionsLoading
  } = useUserPermissions();
  // Show brokerage data only when user has brokerage create and read permission
  const showBrokerage = hasPermission("brokerage", "create") && hasPermission("brokerage", "read");
  // Show Billing Amount only when user has Outward R permission; show GP button only when user has outward c permission
  const showBillingAmount = hasReadPermission("outward");
  const showGPButton = hasCreatePermission("outward");
  // Normalize status value for API (convert to expected format)
  const normalizeStatusValue = (value) => {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalized === "partially approved") return "partial approved";
    return normalized;
  };

  const normalizeStatusForAPI = (status) => {
    if (!status || status === 'all') return '';

    const statusMap = {
      pending: 'Pending',
      approved: 'Approved',
      'partial approved': 'Partial Approved',
      'partially approved': 'Partial Approved',
      rejected: 'Rejected',
      completed: 'Completed',
    };

    const normalized = normalizeStatusValue(status);
    return statusMap[normalized] || '';
  };

  // Fetch ledger groups for filter (Sales debtor groups)
  const fetchLedgerGroups = async ({ pageParam = 1, queryKey }) => {
    const [, search] = queryKey;
    const params = new URLSearchParams();
    params.append('page', pageParam.toString());
    params.append('per_page', '50');
    params.append('type', 'Sales');
    if (search) {
      params.append('search', search);
    }
    params.append('is_live', 'true');
    params.append('is_active', 'true');

    const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch ledger groups');
    }

    const data = await response.json();
    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
    };
  };

  const {
    data: ledgerGroupsData,
    fetchNextPage: fetchNextLedgerGroupPage,
    hasNextPage: hasNextLedgerGroupPage,
    isFetchingNextPage: isFetchingNextLedgerGroupPage,
  } = useInfiniteQuery({
    queryKey: ['sales-order-list-ledger-groups', ledgerGroupSearchTerm],
    queryFn: fetchLedgerGroups,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: ledgerGroupDropdownOpen && !!AuthService.getAccessToken(),
  });

  const ledgerGroups = ledgerGroupsData?.pages?.flatMap((page) => page.results) || [];

  // Build query parameters for API call (all filtering + pagination handled server-side)
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('per_page', pageSize.toString());

    // Use debouncedSearchTerm for API calls to avoid fetching on every keystroke
    // If debouncedSearchTerm is present, don't apply date filters (search across all dates)
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      params.append('search', debouncedSearchTerm.trim());
      // Don't include date filters when searching - allow search across all dates
    } else {
      // Only apply date filters if there's no search term
      // Backend expects date_from/date_to (or from_date/to_date)
      if (fromDate) {
        params.append('date_from', format(fromDate, 'yyyy-MM-dd'));
      }
      if (toDate) {
        params.append('date_to', format(toDate, 'yyyy-MM-dd'));
      }
    }

    if (selectedLedgerGroupName && selectedLedgerGroupName.trim()) {
      params.append('debtor_name', selectedLedgerGroupName.trim());
    }

    if (statusFilter && statusFilter !== 'all' && statusFilter !== '') {
      const normalizedStatus = normalizeStatusForAPI(statusFilter);
      if (normalizedStatus) {
        params.append('so_status', normalizedStatus);
      }
    }

    if (selectedBranchId && selectedBranchId !== 'all' && selectedBranchId !== '') {
      params.append('branch_id', selectedBranchId);
    }

    if (selectedItemFilterId) {
      params.append('item_id', String(selectedItemFilterId));
    }

    return params.toString();
  };

  // Fetch stock items for item filter dropdown (SO Material)
  const { data: stockItemsForFilter = [], isLoading: stockItemsFilterLoading } = useQuery({
    queryKey: ["so-list-item-filter", debouncedItemFilterSearch],
    queryFn: async () => {
      const requestBody = {
        type: "SO Material",
        list_mode: "default",
        stock_group: "",
        stock_category: "",
        is_active: true,
        new_page: 1,
        per_page: 100,
      };
      if (debouncedItemFilterSearch.trim()) {
        requestBody.search = debouncedItemFilterSearch.trim();
      }
      const response = await apiRequest("POST", `${API_BASE_URL}/api/stock-items-list/`, requestBody);
      const responseData = await response.json();
      if (responseData.status && Number(responseData.status) >= 400) {
        throw new Error(responseData.message || "Failed to fetch stock items");
      }
      return responseData.data || [];
    },
    enabled: !!AuthService.getAccessToken() && itemFilterOpen,
    refetchOnWindowFocus: false,
  });

  // Fetch sales orders from API
  const { data: ordersData, isLoading, error, refetch } = useQuery({
    queryKey: [`sales-orders`, fromDate, toDate, statusFilter, currentPage, debouncedSearchTerm, selectedLedgerGroupName, selectedBranchId, selectedItemFilterId],
    queryFn: async () => {
      try {
        const queryParams = buildQueryParams();
        const url = `${API_BASE_URL}/api/sales/sales-orders${queryParams ? `?${queryParams}` : ''}`;
        // alert(url);
        // console.log('Fetching sales orders from:', url);
        const response = await apiRequest('GET', url);
        const data = await response.json();
        // console.log('Sales orders response:', data);
        return data;
      } catch (err) {
        // console.error('Error fetching sales orders:', err);

        // Check if it's a 404 error (no sales orders found)
        if (err.message && err.message.includes('404')) {
          // Return empty data structure instead of throwing error
          return {
            data: [],
            summary: {
              total_orders: 0,
              total_customers: 0,
              total_amount: 0,
            },
            pagination: {
              total_count: 0,
              total_pages: 1,
              has_next: false,
              has_previous: false,
            },
          };
        }

        throw err;
      }
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    keepPreviousData: true, // react-query v4
    placeholderData: (previousData) => previousData, // react-query v5
  });

  // After create/edit on another page, refetch list (global staleTime is Infinity).
  useEffect(() => {
    if (!location.includes("sales-order-list")) return;
    if (sessionStorage.getItem(SALES_ORDERS_LIST_REFRESH_KEY) !== "1") return;

    sessionStorage.removeItem(SALES_ORDERS_LIST_REFRESH_KEY);
    const refreshSoNumber = sessionStorage.getItem(SALES_ORDERS_DETAIL_REFRESH_SO_KEY);
    sessionStorage.removeItem(SALES_ORDERS_DETAIL_REFRESH_SO_KEY);

    const refreshList = async () => {
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"], exact: false });
      await refetch();

      await queryClient.invalidateQueries({ queryKey: ["sales-order-detail"], exact: false });
      if (refreshSoNumber) {
        await queryClient.invalidateQueries({
          queryKey: ["sales-order-detail", refreshSoNumber],
        });
        await queryClient.refetchQueries({
          queryKey: ["sales-order-detail", refreshSoNumber],
        });
      }
      await queryClient.refetchQueries({ queryKey: ["sales-order-detail"], exact: false });
    };

    void refreshList();
  }, [location, queryClient, refetch]);

  const deleteSalesOrderMutation = useMutation({
    mutationFn: async (soNumber) => {
      const response = await apiRequest(
        "DELETE",
        `${API_BASE_URL}/api/sales/delete-sales-order/${encodeURIComponent(soNumber)}/`
      );
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to delete sales order");
      }
      return data;
    },
    onSuccess: (data, soNumber) => {
      toast({
        title: "Deleted",
        description: data?.message || `Sales order ${soNumber} deleted successfully.`,
      });
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
      if (selectedOrder?.so_number === soNumber) {
        setIsDetailModalOpen(false);
        setSelectedOrder(null);
      }
      queryClient.invalidateQueries({ queryKey: ["sales-orders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["sales-order-detail"], exact: false });
      void refetch();
    },
    onError: (err) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Unable to delete sales order.",
        variant: "destructive",
      });
    },
  });

  const openDeleteDialog = (order) => {
    setOrderToDelete(order);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSalesOrder = () => {
    if (!orderToDelete?.so_number) return;
    deleteSalesOrderMutation.mutate(orderToDelete.so_number);
  };

  const canDeleteSalesOrder = (order) =>
    hasDeletePermission("sales_order") && !order?.has_outward_entry;

  // State for stock item pricing (for UOM selection)
  const [stockItemPricing, setStockItemPricing] = useState(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);

  // Fetch stock item pricing for UOM selection
  const fetchStockItemPricing = async (customerId, stockItemId) => {
    if (!customerId || !stockItemId) return null;
    setIsLoadingPricing(true);
    try {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/growth/so-items-list/`, {
        customer_id: customerId,
        stock_item_id: stockItemId,
        include_zero_selling_stock: true,
      });
      const data = await response.json();
      if (data.status === 200 && data.data?.stock_items?.length > 0) {
        return data.data.stock_items[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching stock item pricing:', error);
      return null;
    } finally {
      setIsLoadingPricing(false);
    }
  };

  // Fetch detailed sales order when viewing details
  const {
    data: orderDetail,
    isLoading: isDetailLoading,
    isFetching: isDetailFetching,
    refetch: refetchOrderDetail,
  } = useQuery({
    queryKey: [`sales-order-detail`, selectedOrder?.so_number],
    queryFn: async () => {
      if (!selectedOrder?.so_number) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/sales-orders/${selectedOrder.so_number}/`);
      const data = await response.json();
      return data.data;
    },
    enabled: !!selectedOrder?.so_number && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Always load fresh detail when opening the modal (global staleTime is Infinity).
  useEffect(() => {
    if (!isDetailModalOpen || !selectedOrder?.so_number) return;

    const loadFreshDetail = async () => {
      await queryClient.invalidateQueries({
        queryKey: ["sales-order-detail", selectedOrder.so_number],
      });
      await refetchOrderDetail();
    };

    void loadFreshDetail();
  }, [isDetailModalOpen, selectedOrder?.so_number, queryClient, refetchOrderDetail]);

  // Fetch customers for edit dialog
  const { data: customersData } = useQuery({
    queryKey: ['customers', customerSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('per_page', '50');
      if (customerSearchTerm) {
        params.append('search', customerSearchTerm);
      }
      const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/get-customers/?${params.toString()}`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: isEditDialogOpen,
    retry: 1,
  });

  // Fetch branches for filter, list display, edit dialog, and PDF
  const { data: branchesData = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-branches/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    retry: 1,
  });

  const getOrderBranchName = (order) => {
    if (!order) return "-";
    if (order.branch_name) return order.branch_name;
    if (typeof order.branch === "string" && order.branch.trim()) return order.branch;
    if (order.branch?.name) return order.branch.name;
    if (order.branch_id != null && branchesData?.length) {
      const match = branchesData.find((b) => String(b.id) === String(order.branch_id));
      if (match?.name) return match.name;
    }
    return "-";
  };

  // Fetch order details for edit dialog
  const { data: editOrderDetail } = useQuery({
    queryKey: ['sales-order-detail-edit', orderToEdit?.so_number],
    queryFn: async () => {
      if (!orderToEdit?.so_number) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/sales-orders/${orderToEdit.so_number}/`);
      const data = await response.json();
      return data.data;
    },
    enabled: !!orderToEdit?.so_number && isEditDialogOpen,
    refetchOnWindowFocus: false,
  });

  // Populate form data when order details are fetched
  useEffect(() => {
    if (editOrderDetail && isEditDialogOpen && orderToEdit) {
      const header = editOrderDetail.header || {};

      setEditFormData({
        customer_id: header.customer_id || null,
        address: header.shipping_address || header.address || "",
        branch_id: header.branch_id || null
      });
    }
  }, [editOrderDetail, isEditDialogOpen, orderToEdit]);

  // Reset address editing state when modal closes or order changes
  useEffect(() => {
    if (!isDetailModalOpen || !selectedOrder) {
      setIsEditingAddress(false);
      setEditedAddress("");
    }
  }, [isDetailModalOpen, selectedOrder]);

  const stopVoiceRemarkPlayback = () => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.currentTime = 0;
    }
    setVoicePlaying(false);
  };

  useEffect(() => {
    if (!isDetailModalOpen) {
      stopVoiceRemarkPlayback();
      voiceAudioRef.current = null;
    }
  }, [isDetailModalOpen]);

  useEffect(() => {
    stopVoiceRemarkPlayback();
    voiceAudioRef.current = null;
  }, [selectedOrder?.so_number]);

  const toggleVoiceRemarkPlayback = () => {
    const url = (orderDetail?.header?.voice_remarks || "").trim();
    if (!url) return;

    let audio = voiceAudioRef.current;
    if (!audio) {
      audio = new Audio(url);
      audio.onended = () => setVoicePlaying(false);
      audio.onerror = () => setVoicePlaying(false);
      voiceAudioRef.current = audio;
    } else if (audio.src !== url) {
      audio.src = url;
    }

    if (voicePlaying) {
      audio.pause();
      setVoicePlaying(false);
    } else {
      audio
        .play()
        .then(() => setVoicePlaying(true))
        .catch(() => setVoicePlaying(false));
    }
  };

  // Auto-initialize approved quantity with ordered quantity when order details are loaded
  useEffect(() => {
    if (orderDetail?.items && hasUpdatePermission("sales_order") && isDetailModalOpen) {
      setItemEdits(prev => {
        const newEdits = { ...prev };
        let hasChanges = false;

        orderDetail.items.forEach((item) => {
          const isPending = !item.is_approved && !item.is_rejected;
          // Auto-fill with ordered quantity for pending items if not already set in edits
          if (isPending) {
            const currentApprovedQty = newEdits[item.id]?.approved_quantity;
            const itemApprovedQty = item.approved_quantity;

            // IMPORTANT: If user has already entered a value (hasChanges is true), preserve it
            // Don't reset user input when order detail is refetched after approving another item
            if (newEdits[item.id]?.hasChanges && currentApprovedQty !== undefined && currentApprovedQty !== null) {
              // User has made changes and entered a value - preserve it, don't reset
              return;
            }

            // Determine default base_unit_id based on is_primary_unit
            // Prioritize item.stock_item (always available from API) for accurate unit selection
            let defaultBaseUnitId = null;
            // Convert is_primary_unit to boolean if it's a string
            const isPrimaryUnit = item.is_primary_unit === true || item.is_primary_unit === "true";

            // console.log(`[UOM Init] Item ID: ${item.id}, is_primary_unit:`, item.is_primary_unit, `(type: ${typeof item.is_primary_unit}), converted: ${isPrimaryUnit}`);

            if (isPrimaryUnit) {
              // If is_primary_unit is true, use base unit (first option)
              defaultBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;
              // console.log(`[UOM Init] is_primary_unit=true, defaultBaseUnitId: ${defaultBaseUnitId} (base unit)`);
            } else {
              // If is_primary_unit is false or not provided, use alternate unit (second option)
              defaultBaseUnitId = item.stock_item?.alternate_unit?.id || item.base_unit?.id || null;
              // console.log(`[UOM Init] is_primary_unit=false, defaultBaseUnitId: ${defaultBaseUnitId} (alternate unit)`);
            }

            // Calculate initial fixed_total
            // Use integer for quantity
            const initialQty = itemApprovedQty !== undefined && itemApprovedQty !== null && itemApprovedQty > 0
              ? Math.floor(parseFloat(itemApprovedQty))
              : Math.floor(parseFloat(item.quantity || 0));

            // ALWAYS use base unit price (item.price) for total calculation
            // regardless of is_primary_unit. The displayed price can be alternate unit,
            // but total should always be: quantity (base) * base_unit_price
            const baseUnitPrice = parseFloat(item.price || item.rate || 0);
            const initialTotal = initialQty * baseUnitPrice;

            // Initialize if not in edits, or if approved_quantity is explicitly undefined/null (not 0, as 0 could be user input)
            if (!newEdits[item.id]) {
              // If item has approved_quantity > 0, use it; otherwise use ordered quantity
              if (itemApprovedQty !== undefined && itemApprovedQty !== null && itemApprovedQty > 0) {
                newEdits[item.id] = {
                  approved_quantity: itemApprovedQty,
                  base_unit_id: defaultBaseUnitId,
                  fixed_total: initialTotal,
                  hasChanges: false
                };
              } else {
                newEdits[item.id] = {
                  approved_quantity: item.quantity || 0,
                  base_unit_id: defaultBaseUnitId,
                  fixed_total: initialTotal,
                  hasChanges: false
                };
              }
              hasChanges = true;
            } else if ((currentApprovedQty === undefined || currentApprovedQty === null) && !newEdits[item.id].hasChanges) {
              // Only initialize if approved_quantity is explicitly undefined/null (not 0, as 0 could be valid user input)
              // Also check if user hasn't made changes - if hasChanges is true, don't reset
              if (itemApprovedQty !== undefined && itemApprovedQty !== null && itemApprovedQty > 0) {
                newEdits[item.id] = {
                  ...newEdits[item.id],
                  approved_quantity: itemApprovedQty,
                  base_unit_id: newEdits[item.id].base_unit_id !== undefined && newEdits[item.id].base_unit_id !== null ? newEdits[item.id].base_unit_id : defaultBaseUnitId,
                  fixed_total: newEdits[item.id].fixed_total !== undefined ? newEdits[item.id].fixed_total : initialTotal
                };
              } else {
                newEdits[item.id] = {
                  ...newEdits[item.id],
                  approved_quantity: item.quantity || 0,
                  base_unit_id: newEdits[item.id].base_unit_id !== undefined && newEdits[item.id].base_unit_id !== null ? newEdits[item.id].base_unit_id : defaultBaseUnitId,
                  fixed_total: newEdits[item.id].fixed_total !== undefined ? newEdits[item.id].fixed_total : initialTotal
                };
              }
              hasChanges = true;
            } else if (newEdits[item.id].base_unit_id === undefined || newEdits[item.id].base_unit_id === null) {
              // Initialize base_unit_id if not set
              newEdits[item.id] = {
                ...newEdits[item.id],
                base_unit_id: defaultBaseUnitId,
                fixed_total: newEdits[item.id].fixed_total !== undefined ? newEdits[item.id].fixed_total : initialTotal
              };
              hasChanges = true;
            } else if (newEdits[item.id].fixed_total === undefined) {
              // Initialize fixed_total if not set
              newEdits[item.id] = {
                ...newEdits[item.id],
                fixed_total: initialTotal
              };
              hasChanges = true;
            }
          }
        });

        return hasChanges ? newEdits : prev;
      });
    }
  }, [orderDetail?.items, isDetailModalOpen, hasUpdatePermission]);

  // Fetch pricing for all items when order detail is loaded
  useEffect(() => {
    if (orderDetail?.items && orderDetail?.header?.customer_id) {
      const customerId = orderDetail.header.customer_id;

      // Fetch pricing for all items that have stock_item_id
      orderDetail.items.forEach((item) => {
        if (item.stock_item_id && !itemPricingMap[item.id]) {
          fetchStockItemPricing(customerId, item.stock_item_id).then(pricing => {
            if (pricing) {
              setItemPricingMap(prev => ({ ...prev, [item.id]: pricing }));
            }
          });
        }
      });
    }
  }, [orderDetail?.items, orderDetail?.header?.customer_id]);

  // Calculate dynamic total amount based on item edits
  // Check if there's any billed quantity or billing amount to show those columns
  const hasBilledData = useMemo(() => {
    if (!orderDetail?.items || orderDetail.items.length === 0) {
      return false;
    }
    return orderDetail.items.some(item => {
      const billedQty = parseFloat(item.billed_quantity || 0);
      const billingAmount = parseFloat(item.billing_amount || 0);
      return billedQty > 0 || billingAmount > 0;
    });
  }, [orderDetail?.items]);

  const calculatedTotalAmount = useMemo(() => {
    if (!orderDetail?.items || orderDetail.items.length === 0) {
      return parseFloat(orderDetail?.header?.amount || 0);
    }

    return orderDetail.items.reduce((total, item) => {
      const itemEdit = itemEdits[item.id] || {};
      const baseUnitPrice = parseFloat(item.price || item.rate || 0);

      // For approved/rejected items, use actual data from API
      if (item.is_approved || item.is_rejected) {
        const approvedQty = parseFloat(item.approved_quantity || item.quantity || 0);
        return total + (approvedQty * baseUnitPrice);
      } else {
        // For pending items, use itemEdit.fixed_total if available, otherwise calculate
        if (itemEdit.fixed_total !== undefined) {
          return total + itemEdit.fixed_total;
        } else {
          const currentApprovedQty = itemEdit.approved_quantity !== undefined
            ? parseFloat(itemEdit.approved_quantity)
            : parseFloat(item.approved_quantity || item.quantity || 0);
          return total + (currentApprovedQty * baseUnitPrice);
        }
      }
    }, 0);
  }, [orderDetail?.items, orderDetail?.header?.amount, itemEdits]);

  const orders = ordersData?.data || [];
  const totalCount = ordersData?.pagination?.total_count || 0;
  const totalPages = ordersData?.pagination?.total_pages || 1;
  const hasNext = ordersData?.pagination?.has_next || false;
  const hasPrevious = ordersData?.pagination?.has_previous || false;
  const listStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const listEnd = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

  const summaryStats = React.useMemo(() => {
    const apiSummary = ordersData?.summary;
    return {
      totalAmount: parseFloat(apiSummary?.total_amount) || 0,
      totalCustomers: Number(apiSummary?.total_customers) || 0,
      totalOrders: Number(apiSummary?.total_orders ?? totalCount) || 0,
    };
  }, [ordersData?.summary, totalCount]);

  // Extract unique sales-order statuses from parent `status` field
  const getAvailableStatuses = () => {
    // Default SO statuses that should always be available (in lowercase for internal use)
    const defaultStatuses = ['all', 'pending', 'approved', 'partial approved', 'rejected', 'completed'];

    // If no orders data yet, return default statuses
    if (!orders || orders.length === 0) {
      return defaultStatuses;
    }

    // Extract unique statuses from parent status field
    const statusMap = new Map(); // Map lowercase -> original format

    orders.forEach(order => {
      const orderStatus = order.status;
      if (orderStatus && String(orderStatus).trim() !== '') {
        const normalized = normalizeStatusValue(orderStatus);
        // Store original format if not already stored, or if current is more standard
        if (!statusMap.has(normalized)) {
          statusMap.set(normalized, String(orderStatus));
        }
      }
    });

    // Get normalized statuses (lowercase) for comparison
    const normalizedStatuses = Array.from(statusMap.keys());

    // Normalize default statuses to lowercase for comparison
    const normalizedDefaults = defaultStatuses.map((s) => normalizeStatusValue(s));

    // Combine default statuses with statuses from data
    const allNormalizedStatuses = new Set([...normalizedDefaults, ...normalizedStatuses]);

    // Convert to array and sort, keeping 'all' first
    const statusArray = Array.from(allNormalizedStatuses);
    const allIndex = statusArray.indexOf('all');
    if (allIndex > 0) {
      statusArray.splice(allIndex, 1);
      statusArray.unshift('all');
    }

    // Sort remaining statuses alphabetically (excluding 'all')
    const otherStatuses = statusArray.slice(1).sort();
    return ['all', ...otherStatuses];
  };

  const availableStatuses = getAvailableStatuses();

  // Fetch ledgers for selection
  const { data: ledgersData, isLoading: isLoadingLedgers } = useQuery({
    queryKey: ['ledgers-for-sync'],
    queryFn: async () => {
      const fromDate = format(subDays(new Date(), 365), "yyyy-MM-dd");
      const toDate = format(new Date(), "yyyy-MM-dd");
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-list/?from_date=${fromDate}&to_date=${toDate}&status=all&search=&page=1&limit=1000`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: isLedgerDialogOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Filter ledgers based on search term
  const filteredLedgers = useMemo(() => {
    if (!ledgersData) return [];
    if (!ledgerSearchTerm) return ledgersData;
    const searchLower = ledgerSearchTerm.toLowerCase();
    return ledgersData.filter(ledger =>
      (ledger.name && ledger.name.toLowerCase().includes(searchLower)) ||
      (ledger.parent && ledger.parent.toLowerCase().includes(searchLower))
    );
  }, [ledgersData, ledgerSearchTerm]);

  // Fetch voucher types for sales orders
  const { data: voucherTypesData, isLoading: isLoadingVoucherTypes, error: voucherTypesError } = useQuery({
    queryKey: ['sales-order-voucher-types'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/get-so-voucher-types/`);
        const data = await response.json();
        // Handle both Response format (status, data) and direct array
        if (data.status === 200 && data.data) {
          return Array.isArray(data.data) ? data.data : [];
        } else if (Array.isArray(data)) {
          return data;
        }
        return [];
      } catch (error) {
        console.error('Error fetching voucher types:', error);
        return [];
      }
    },
    enabled: isLedgerDialogOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Filter voucher types based on search term
  const filteredVoucherTypes = useMemo(() => {
    if (!voucherTypesData) return [];
    if (!voucherTypeSearchTerm) return voucherTypesData;
    const searchLower = voucherTypeSearchTerm.toLowerCase();
    return voucherTypesData.filter(vt =>
      (vt.name && vt.name.toLowerCase().includes(searchLower)) ||
      (vt.display_name && vt.display_name.toLowerCase().includes(searchLower)) ||
      (vt.parent && vt.parent.toLowerCase().includes(searchLower))
    );
  }, [voucherTypesData, voucherTypeSearchTerm]);

  // Sync sales order to Tally mutation
  const syncSalesOrderMutation = useMutation({
    mutationFn: async ({ soNumber, ledgerName, voucherTypeName }) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/sales/sync-so/`, {
        so_number: soNumber,
        ledger_name: ledgerName,
        voucher_type_name: voucherTypeName || "SALES ORDER VAN",
      });
      return response.json();
    },
    onSuccess: async (data, variables) => {
      const syncedSoNumber = variables.soNumber;
      toast({
        title: "Success",
        description: data.message || "Sales order synced successfully to Tally",
        variant: "success",
      });

      // Close dialog and reset state first
      setIsLedgerDialogOpen(false);
      setSelectedLedger(null);
      setLedgerSearchTerm("");
      setOrderToSync(null);
      setVoucherTypeName("SALES ORDER VAN");
      setSelectedVoucherType(null);
      setVoucherTypeSearchTerm("");

      // Close the detail modal to show the list
      setIsDetailModalOpen(false);
      setSelectedOrder(null);

      // Invalidate and refetch sales orders list from backend
      await queryClient.invalidateQueries({ queryKey: ['sales-orders'], exact: false });

      // Refetch the sales orders list to get updated sync status from backend
      await refetch();
    },
    onError: (error) => {
      const errorMessage = error.message || "Failed to sync sales order to Tally";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Handle sync button click - open ledger selection dialog
  const handleSyncClick = (order) => {
    if (!order?.so_number) {
      toast({
        title: "Error",
        description: "Sales order number is required",
        variant: "destructive",
      });
      return;
    }
    // Open ledger selection dialog
    setOrderToSync(order);
    setSelectedLedger(null);
    setLedgerSearchTerm("");
    setVoucherTypeName("SALES ORDER VAN");
    setSelectedVoucherType(null);
    setVoucherTypeSearchTerm("");
    setIsLedgerDialogOpen(true);
  };

  // Sync to Tally: voucher type is required; sales ledger is optional (API sends XML without ledger section if not passed)
  const handleLedgerSelectAndSync = () => {
    if (!orderToSync) {
      toast({
        title: "Error",
        description: "Sales order is required",
        variant: "destructive",
      });
      return;
    }
    if (!selectedVoucherType) {
      toast({
        title: "Error",
        description: "Please select a voucher type first",
        variant: "destructive",
      });
      return;
    }
    syncSalesOrderMutation.mutate({
      soNumber: orderToSync.so_number,
      ledgerName: selectedLedger?.name ?? "",
      voucherTypeName: selectedVoucherType.name || voucherTypeName.trim() || "SALES ORDER VAN",
    });
  };

  // Approve/Reject sales order mutation
  // Update sales order mutation
  const updateSalesOrderMutation = useMutation({
    mutationFn: async ({ soNumber, updateData }) => {
      const response = await apiRequest('PUT', `${API_BASE_URL}/api/sales/sales-orders/${soNumber}/update/`, updateData);
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: data.message || "Sales order updated successfully",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      // Invalidate order detail query if updating from details modal
      if (selectedOrder?.so_number) {
        queryClient.invalidateQueries({ queryKey: ['sales-order-detail', selectedOrder.so_number] });
      }
      // Close edit dialog if it was open
      setIsEditDialogOpen(false);
      setOrderToEdit(null);
      // Reset address editing state
      setIsEditingAddress(false);
      setEditedAddress("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update sales order",
        variant: "destructive",
      });
    },
  });

  // Update delivery address mutation
  const updateAddressMutation = useMutation({
    mutationFn: async ({ soNumber, address }) => {
      const trimmedAddress = (address || "").trim();
      // console.log(trimmedAddress);
      if (!trimmedAddress) {
        throw new Error("Address cannot be empty");
      }
      const response = await apiRequest('POST', `${API_BASE_URL}/api/sales/sales-orders/${soNumber}/update-address/`, {
        address: trimmedAddress,
        lat: "",
        long: ""
      });
      // console.log(response);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to update address: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // console.log(data);
      toast({
        title: "Success",
        description: data.message || "Delivery address updated successfully",
        variant: "success",
      });
      // Optimistically update the cache so the UI shows the saved address immediately
      if (variables.soNumber && variables.address) {
        queryClient.setQueryData(
          ['sales-order-detail', variables.soNumber],
          (prev) => {
            if (!prev || !prev.header) return prev;
            return {
              ...prev,
              header: {
                ...prev.header,
                address: variables.address,
                shipping_address: variables.address,
              },
            };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-detail'] });
      // Reset address editing state
      setIsEditingAddress(false);
      setEditedAddress("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update delivery address",
        variant: "destructive",
      });
      // Don't reset editing state on error so user can retry
    },
  });

  const approveRejectMutation = useMutation({
    mutationFn: async ({ soNumber, action, items, orderRemarks }) => {
      const response = await apiRequest('PUT', `${API_BASE_URL}/api/sales/sales-orders/${soNumber}/approve-reject/`, {
        action,
        items: items || [],
        order_remarks: orderRemarks || "",
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      const isItemWise = variables.items && variables.items.length > 0;
      toast({
        title: "Success",
        description: data.message || `${isItemWise ? 'Item' : 'Sales order'} ${variables.action}d successfully`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });

      if (!isItemWise) {
        // For whole order approval/rejection, clear all edits and close modals
        setItemEdits({});
        queryClient.invalidateQueries({ queryKey: ['sales-order-detail', selectedOrder?.so_number] });
        // Close both modals
        setIsApproveRejectModalOpen(false);
        setIsDetailModalOpen(false);
        resetApproveRejectForm();
        // Navigate back to sales-order-list page
        setLocation('/reports/sales-order-list');
      } else {
        // For item-wise approval/rejection, only remove the specific item from edits
        // Preserve other items' edits to prevent dialog refresh
        setIsProcessing(false);
        if (variables.items && variables.items.length > 0) {
          const itemId = variables.items[0].item_id;
          setItemEdits(prev => {
            const newEdits = { ...prev };
            delete newEdits[itemId];
            return newEdits;
          });
        }
        // Invalidate and refetch order detail, but preserve other items' edits
        queryClient.invalidateQueries({ queryKey: ['sales-order-detail', selectedOrder?.so_number] });
        // Refetch order detail to get updated data for the approved item
        if (selectedOrder?.so_number) {
          refetchOrderDetail().then(() => {
            // After refetch, preserve edits for items that weren't just approved/rejected
            // This prevents other items' approved quantities from being reset
            if (variables.items && variables.items.length > 0) {
              const approvedItemId = variables.items[0].item_id;
              setItemEdits(prev => {
                // Keep all edits except for the item that was just approved/rejected
                const preservedEdits = { ...prev };
                // The approved item is already removed above, so we just need to preserve others
                return preservedEdits;
              });
            }
          });
        }
      }
    },
    onError: (error, variables) => {
      const isItemWise = variables.items && variables.items.length > 0;
      toast({
        title: "Error",
        description: error.message || `Failed to ${variables.action} ${isItemWise ? 'item' : 'sales order'}`,
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  // Handle action button click (opens modal with toggle)
  const handleActionOrder = (order) => {
    setSelectedOrderForAction(order);
    setActionType("approve"); // Default to approve
    setActionRemarks("");
    setItemUpdates([]);
    setIsApproveRejectModalOpen(true);
  };

  // Reset approve/reject form
  const resetApproveRejectForm = () => {
    setSelectedOrderForAction(null);
    setActionType("");
    setActionRemarks("");
    setItemUpdates([]);
    setIsProcessing(false);
  };

  // Submit approve/reject
  const handleApproveRejectSubmit = () => {
    if (!selectedOrderForAction) return;

    // Validate rejection reason
    if (actionType === 'reject' && !actionRemarks.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    approveRejectMutation.mutate({
      soNumber: selectedOrderForAction.so_number,
      action: actionType,
      items: itemUpdates.length > 0 ? itemUpdates : undefined,
      orderRemarks: actionRemarks,
    });
  };

  // Handle item-wise action button click (opens modal with toggle)
  const handleItemAction = async (item) => {
    setEditingItem(item);
    // Always use stock_item.base_unit as source of truth for base unit
    const currentBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;

    setItemEditData({
      item_id: item.id,
      approved_quantity: item.approved_quantity || item.quantity || 0,
      rate: item.price || item.rate || 0,
      base_unit_id: currentBaseUnitId,
      action_remarks: item.action_remarks || "",
      action: "approve", // Default to approve
    });

    // Fetch stock item pricing if customer and stock_item_id are available
    const customerId = selectedOrder?.customer_id || orderDetail?.header?.customer_id;
    if (customerId && item.stock_item_id) {
      const pricing = await fetchStockItemPricing(customerId, item.stock_item_id);
      setStockItemPricing(pricing);
    } else {
      setStockItemPricing(null);
    }

    setIsItemEditModalOpen(true);
  };

  // Submit item-wise approve/reject
  const handleItemApproveRejectSubmit = () => {
    if (!editingItem || !selectedOrder) return;

    // Validate rejection reason
    if (itemEditData.action === 'reject' && !itemEditData.action_remarks.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    // Validate approved quantity
    if (itemEditData.action === 'approve' && itemEditData.approved_quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Approved quantity must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (itemEditData.action === 'approve' && itemEditData.approved_quantity > editingItem.quantity) {
      toast({
        title: "Validation Error",
        description: `Approved quantity cannot exceed ordered quantity (${editingItem.quantity})`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    const approvedQty = itemEditData.action === 'approve' ? itemEditData.approved_quantity : 0;

    const itemPayload = {
      item_id: itemEditData.item_id,
      approved_quantity: approvedQty,
      action_remarks: itemEditData.action_remarks
    };

    // Only include rate and base_unit_id when approving and approved quantity > 0
    if (itemEditData.action === 'approve' && approvedQty > 0) {
      if (itemEditData.rate !== undefined) {
        itemPayload.rate = parseFloat(itemEditData.rate);
      }
      if (itemEditData.base_unit_id !== undefined && itemEditData.base_unit_id !== null) {
        itemPayload.base_unit_id = itemEditData.base_unit_id;
      }
    }

    approveRejectMutation.mutate({
      soNumber: selectedOrder.so_number,
      action: itemEditData.action,
      items: [itemPayload],
      orderRemarks: "",
    }, {
      onSuccess: () => {
        setIsItemEditModalOpen(false);
        setEditingItem(null);
        setStockItemPricing(null);
        setItemEditData({
          item_id: null,
          approved_quantity: 0,
          rate: 0,
          base_unit_id: null,
          action_remarks: "",
          action: ""
        });
      }
    });
  };

  // Handle inline item edit in details view
  const handleItemFieldChange = (itemId, field, value) => {
    setItemEdits(prev => {
      const current = prev[itemId] || {};
      const item = orderDetail?.items?.find(i => i.id === itemId);
      if (!item) return prev;

      const newValue = {
        ...current,
        [field]: value,
        hasChanges: true
      };

      // Check if there are actual changes from original values
      // NOTE: Quantities are ALWAYS in base unit, never converted
      const originalApprovedQty = item.approved_quantity !== undefined ? item.approved_quantity : (item.is_approved ? item.quantity : 0);

      // Determine original rate and UOM based on rate_per_unit from API response
      // rate_per_unit indicates which unit the price is in
      const ratePerUnit = item.rate_per_unit ? String(item.rate_per_unit).trim().toUpperCase() : '';
      const stockBaseUnitName = item.stock_item?.base_unit?.name ? String(item.stock_item.base_unit.name).trim().toUpperCase() : '';
      const stockAlternateUnitName = item.stock_item?.alternate_unit?.name ? String(item.stock_item.alternate_unit.name).trim().toUpperCase() : '';

      // Check if rate_per_unit matches base_unit or alternate_unit
      const isRateInBaseUnit = ratePerUnit === stockBaseUnitName;
      const isRateInAlternateUnit = ratePerUnit === stockAlternateUnitName;

      // Determine original rate and UOM ID based on rate_per_unit
      let originalRate = 0;
      let originalBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;

      if (isRateInBaseUnit) {
        // rate_per_unit matches base_unit, use item.price
        originalRate = parseFloat(item.price || item.rate || 0);
        originalBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;
      } else if (isRateInAlternateUnit) {
        // rate_per_unit matches alternate_unit, use item.alternate_rate
        originalRate = parseFloat(item.alternate_rate || item.price || item.rate || 0);
        originalBaseUnitId = item.stock_item?.alternate_unit?.id || item.alternate_unit?.id || null;
      } else {
        // Fallback to is_primary_unit logic if rate_per_unit doesn't match
        const isPrimaryUnit = item.is_primary_unit === true || item.is_primary_unit === "true";
        if (isPrimaryUnit) {
          originalRate = parseFloat(item.price || item.rate || 0);
          originalBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;
        } else {
          originalRate = parseFloat(item.alternate_rate || item.price || item.rate || 0);
          originalBaseUnitId = item.stock_item?.alternate_unit?.id || item.alternate_unit?.id || null;
        }
      }

      // If quantity changes, recalculate total
      // Formula:
      // - If base unit: total = approved_quantity * base_price
      // - If alternate unit: total = approved_quantity * alternate_price * conversion
      if (field === 'approved_quantity') {
        const currentRate = newValue.rate !== undefined ? newValue.rate : originalRate;
        const currentUOMId = newValue.base_unit_id !== undefined ? newValue.base_unit_id : originalBaseUnitId;
        const isRateInBaseUnit = currentUOMId === item.stock_item?.base_unit?.id;

        const enteredQty = parseFloat(value || 0);
        let calculatedTotal = 0;

        if (isRateInBaseUnit) {
          // Base unit: total = approved_quantity * base_price
          calculatedTotal = enteredQty * parseFloat(currentRate || 0);
        } else if (item.stock_item?.conversion) {
          // Alternate unit: total = approved_quantity * alternate_price * conversion
          const conversion = parseFloat(item.stock_item.conversion) || 1;
          calculatedTotal = enteredQty * parseFloat(currentRate || 0) * conversion;
        } else {
          // Fallback: use base unit price
          calculatedTotal = enteredQty * parseFloat(originalRate || 0);
        }

        newValue.fixed_total = calculatedTotal;
      }

      // If rate changes, recalculate total
      // Formula:
      // - If base unit: total = approved_quantity * base_price
      // - If alternate unit: total = approved_quantity * alternate_price * conversion
      if (field === 'rate') {
        const currentQty = newValue.approved_quantity !== undefined ? newValue.approved_quantity : originalApprovedQty;
        // Determine which unit the entered rate is in based on current UOM selection
        const currentUOMId = newValue.base_unit_id !== undefined ? newValue.base_unit_id : originalBaseUnitId;
        const isRateInBaseUnit = currentUOMId === item.stock_item?.base_unit?.id;

        const enteredRate = parseFloat(value || 0);
        let calculatedTotal = 0;

        if (isRateInBaseUnit) {
          // Base unit: total = approved_quantity * base_price
          calculatedTotal = parseFloat(currentQty || 0) * enteredRate;
        } else if (item.stock_item?.conversion) {
          // Alternate unit: total = approved_quantity * alternate_price * conversion
          const conversion = parseFloat(item.stock_item.conversion) || 1;
          calculatedTotal = parseFloat(currentQty || 0) * enteredRate * conversion;
        } else {
          // Fallback: treat as base unit
          calculatedTotal = parseFloat(currentQty || 0) * enteredRate;
        }

        newValue.fixed_total = calculatedTotal;
      }

      // If UOM changes, recalculate total if rate was already set
      // Formula:
      // - If base unit: total = approved_quantity * base_price
      // - If alternate unit: total = approved_quantity * alternate_price * conversion
      if (field === 'base_unit_id') {
        const currentQty = newValue.approved_quantity !== undefined ? newValue.approved_quantity : originalApprovedQty;
        const currentRate = newValue.rate !== undefined ? newValue.rate : originalRate;

        // Determine which unit the current rate is in (the newly selected UOM)
        const isRateInBaseUnit = value === item.stock_item?.base_unit?.id;

        const enteredRate = parseFloat(currentRate || 0);
        let calculatedTotal = 0;

        if (isRateInBaseUnit) {
          // Base unit: total = approved_quantity * base_price
          calculatedTotal = parseFloat(currentQty || 0) * enteredRate;
        } else if (item.stock_item?.conversion) {
          // Alternate unit: total = approved_quantity * alternate_price * conversion
          const conversion = parseFloat(item.stock_item.conversion) || 1;
          calculatedTotal = parseFloat(currentQty || 0) * enteredRate * conversion;
        } else {
          // Fallback: treat as base unit
          calculatedTotal = parseFloat(currentQty || 0) * enteredRate;
        }

        // Recalculate total
        newValue.fixed_total = calculatedTotal;
      }

      const hasActualChanges =
        (newValue.approved_quantity !== undefined && newValue.approved_quantity !== originalApprovedQty) ||
        (newValue.rate !== undefined && parseFloat(newValue.rate) !== parseFloat(originalRate)) ||
        (newValue.base_unit_id !== undefined && newValue.base_unit_id !== originalBaseUnitId) ||
        (newValue.action_remarks !== undefined && newValue.action_remarks.trim() !== "");

      // If UOM changed, fetch pricing if not already loaded
      if (field === 'base_unit_id' && item.stock_item_id && selectedOrder?.customer_id && !itemPricingMap[itemId]) {
        fetchStockItemPricing(selectedOrder.customer_id, item.stock_item_id).then(pricing => {
          if (pricing) {
            setItemPricingMap(prev => ({ ...prev, [itemId]: pricing }));
          }
        });
      }

      return {
        ...prev,
        [itemId]: {
          ...newValue,
          hasChanges: hasActualChanges
        }
      };
    });
  };

  // Handle inline item approve/reject
  const handleInlineItemAction = (itemId, action, skipRemarksValidation = false) => {
    const item = orderDetail?.items?.find(i => i.id === itemId);
    if (!item || !selectedOrder) return;

    const editData = itemEdits[itemId] || {};

    // Get current values from edits or fallback to item values
    // Always prioritize the value from itemEdits if it exists (even if it's 0)
    // Check if itemEdits has this item and has approved_quantity set
    let currentApprovedQty;
    if (itemEdits[itemId] && itemEdits[itemId].approved_quantity !== undefined && itemEdits[itemId].approved_quantity !== null) {
      // Use the value from itemEdits (user's input)
      currentApprovedQty = parseFloat(itemEdits[itemId].approved_quantity);
    } else if (item.approved_quantity !== undefined && item.approved_quantity !== null) {
      // Use existing approved_quantity from item
      currentApprovedQty = parseFloat(item.approved_quantity);
    } else {
      // Fallback to ordered quantity
      currentApprovedQty = parseFloat(item.quantity || 0);
    }

    const currentRate = editData.rate !== undefined
      ? editData.rate
      : (parseFloat(item.price || item.rate || 0));

    const currentBaseUnitId = editData.base_unit_id !== undefined && editData.base_unit_id !== null
      ? editData.base_unit_id
      : (item.base_unit?.id || null);

    // Validate rejection reason (skip if approved quantity is 0)
    if (action === 'reject' && !skipRemarksValidation && !editData.action_remarks?.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    // Validate approved quantity for approval
    if (action === 'approve') {
      if (currentApprovedQty <= 0) {
        toast({
          title: "Validation Error",
          description: "Approved quantity must be greater than 0",
          variant: "destructive",
        });
        return;
      }
    }

    setIsProcessing(true);
    // Ensure approved_quantity is a number
    const approvedQtyToSend = action === 'approve' ? parseFloat(currentApprovedQty) : 0;

    // Debug: Log the values being used
    // console.log('Saving item:', {
    //   itemId,
    //   action,
    //   approvedQtyFromEdits: itemEdits[itemId]?.approved_quantity,
    //   currentApprovedQty,
    //   approvedQtyToSend,
    //   itemApprovedQty: item.approved_quantity,
    //   itemQuantity: item.quantity
    // });

    const itemPayload = {
      item_id: itemId,
      approved_quantity: approvedQtyToSend,
      action_remarks: editData.action_remarks || ""
    };

    // Only include rate and base_unit_id when approving and approved quantity > 0
    if (action === 'approve' && currentApprovedQty > 0) {
      if (currentRate > 0) {
        itemPayload.rate = parseFloat(currentRate);
      }
      if (currentBaseUnitId !== null) {
        itemPayload.base_unit_id = currentBaseUnitId;
      }

    }

    approveRejectMutation.mutate({
      soNumber: selectedOrder.so_number,
      action: action, // Pass the action parameter ('approve' or 'reject')
      items: [itemPayload],
      orderRemarks: "",
    }, {
      onSuccess: () => {
        // Clear the edit data for this item
        setItemEdits(prev => {
          const newEdits = { ...prev };
          delete newEdits[itemId];
          return newEdits;
        });
        setIsProcessing(false);
      },
      onError: () => {
        setIsProcessing(false);
      }
    });
  };

  // Reset item edits when modal closes
  const handleDetailModalClose = (open) => {
    if (!open) {
      setItemEdits({});
      setItemPricingMap({});
    }
    setIsDetailModalOpen(open);
  };

  const handleCreateOrder = () => {
    setLocation('/create-sales-order');
  };

  const handleEditOrder = (soNumber) => {
    setLocation(`/update-sales-order/${soNumber}`);
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  // Reset to first page when filters change (server refetches with page=1)
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, fromDate, toDate, selectedLedgerGroupName, selectedItemFilterId, selectedBranchId]);

  // Debounce search term - update debouncedSearchTerm after user stops typing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setCurrentPage(1); // Reset to first page when searching
    }, 300); // 300ms debounce: responsive typing with fewer refetches

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedItemFilterSearch(itemFilterSearch);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [itemFilterSearch]);

  const handleDateFilterChange = () => {
    setCurrentPage(1);
    refetch();
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Handle sales order selection for outward entry
  const toggleSalesOrderSelection = (soNumber) => {
    setSelectedSalesOrders(prev => {
      if (prev.includes(soNumber)) {
        return prev.filter(so => so !== soNumber);
      } else {
        return [...prev, soNumber];
      }
    });
  };

  const handleSelectAll = (checked) => {
    const approvedOrders = orders
      .filter(order =>
        (order.status?.toLowerCase() === 'approved' ||
          order.status?.toLowerCase() === 'partially_approved') &&
        !order.has_outward_entry
      )
      .map(order => order.so_number);

    if (checked) {
      setSelectedSalesOrders(approvedOrders);
    } else {
      setSelectedSalesOrders([]);
    }
  };

  const handleCreateOutwardFromSelection = () => {
    if (selectedSalesOrders.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one sales order to create outward entry",
        variant: "destructive",
      });
      return;
    }

    // Navigate to add-outward with multiple sales orders
    const soNumbers = selectedSalesOrders.join(',');
    setLocation(`/outward/add-outward?so_numbers=${soNumbers}`);
  };

  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'default';
      case 'approved': return 'default';
      case 'cancelled': return 'destructive';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';      
      case 'draft': return 'secondary';
      case 'partially_approved': return 'outline';
      case 'processing': return 'outline';
      default: return 'outline';
    }
  };

  /** Custom colors: pending = #eab308, approved = green */
  const getStatusBadgeClassName = (status) => {
    const normalized = String(status || "")
      .toLowerCase()
      .replace(/_/g, " ")
      .trim();
    if (normalized === "pending") {
      return "border-transparent bg-[#eab308] text-white hover:bg-[#eab308]";
    }
    if (normalized === "approved") {
      return "border-transparent bg-green-600 text-white hover:bg-green-600";
    }
    return "";
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      case 'approved': return <CheckCircle className="h-3 w-3" />;
      case 'cancelled': return <XCircle className="h-3 w-3" />;
      case 'rejected': return <XCircle className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      case 'draft': return <Clock className="h-3 w-3" />;
      case 'partially_approved': return <CheckCircle className="h-3 w-3" />;
      case 'processing': return <Clock className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  // Helper functions for so_status
  const getSoStatusBadgeVariant = (soStatus) => {
    if (!soStatus) return 'outline';
    const statusLower = soStatus.toLowerCase();
    switch (statusLower) {
      case 'delivery note created': return 'default';
      case 'gate pass created': return 'outline';
      case 'rejected': return 'destructive';
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSoStatusBadgeClassName = (soStatus) => getStatusBadgeClassName(soStatus);

  const getSoStatusIcon = (soStatus) => {
    if (!soStatus) return <Clock className="h-3 w-3" />;
    const statusLower = soStatus.toLowerCase();
    switch (statusLower) {
      case 'delivery note created': return <FileText className="h-3 w-3" />;
      case 'gate pass created': return <Truck className="h-3 w-3" />;
      case 'rejected': return <XCircle className="h-3 w-3" />;
      case 'approved': return <CheckCircle className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return "₹0.00";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      if (dateString instanceof Date && !Number.isNaN(dateString.getTime())) {
        return format(dateString, "dd-MM-yyyy");
      }

      const raw = String(dateString).trim();
      // Already dd-mm-yyyy or dd/mm/yyyy from API — do not parse with Date()
      const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (dmy) {
        const day = dmy[1].padStart(2, "0");
        const month = dmy[2].padStart(2, "0");
        return `${day}-${month}-${dmy[3]}`;
      }

      // ISO yyyy-mm-dd (optionally with time)
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        return `${iso[3]}-${iso[2]}-${iso[1]}`;
      }

      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return format(parsed, "dd-MM-yyyy");
      }
      return raw;
    } catch {
      return dateString;
    }
  };

  const handleDownloadSalesOrderPdf = async () => {
    if (!orderDetail?.header) return;
    setIsPdfGenerating(true);
    try {
      const branchRecord = branchesData?.find(
        (branch) => String(branch.id) === String(orderDetail.header?.branch_id)
      );
      await downloadSalesOrderPdf({
        orderDetail,
        userData,
        branchRecord,
        totalAmount: calculatedTotalAmount ?? orderDetail.header?.amount,
        showBillingAmount: showBillingAmount && hasBilledData,
        showBrokerage,
        hasBilledData,
        formatDateFn: formatDate,
      });
      toast({
        title: "PDF Downloaded",
        description: "Sales order has been downloaded as PDF",
        className: "bg-green-50 border-green-100 text-green-800",
      });
    } catch (error) {
      console.error("Error generating sales order PDF:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const openImageViewer = (imageUrl, label) => {
    if (!imageUrl) return;
    setSelectedImage({
      image_url: imageUrl,
      type_display: label,
      type: label,
    });
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setIsImageDialogOpen(true);
  };

  if (error) {
    // Check if it's a 404 error (no sales orders found)
    if (error.message && error.message.includes('404')) {
      return (
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Sales Orders Found</h3>
                  <p className="text-gray-500 mb-4">There are no sales orders available at the moment.</p>
                  <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // For other errors, show the error message
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading sales orders: {error.message}</p>
          <Button onClick={() => refetch()}>Retry</Button>
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
          <Loader />
        </div>
      </div>
    );
  }

  if (!hasReadPermission("sales_order")) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <ShoppingCart className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view sales order reports. Contact your administrator for access.
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

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-3">
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
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Sales Order List</h1>
              <p className="text-sm text-gray-600 leading-tight">View and Manage Sales Order Records</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {hasCreatePermission("sales_order") && (
              <Button
                onClick={handleCreateOrder}
                className="bg-black hover:bg-gray-800 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create Order</span>
              </Button>
            )}
            <Badge variant="outline" className="text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              {totalCount} Orders
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-5 min-h-0">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-0.5">Total Amount</p>
                      <p className="text-xl font-bold">{formatCurrency(summaryStats.totalAmount)}</p>
                    </div>
                    <div className="bg-blue-400 bg-opacity-30 rounded-full p-2 flex items-center justify-center">
                      <span className="text-xl font-bold leading-none">₹</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium mb-0.5">Total Customers</p>
                      <p className="text-xl font-bold">{summaryStats.totalCustomers}</p>
                    </div>
                    <div className="bg-green-400 bg-opacity-30 rounded-full p-2">
                      <User className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium mb-0.5">Total Sales Orders</p>
                      <p className="text-xl font-bold">{summaryStats.totalOrders}</p>
                    </div>
                    <div className="bg-purple-400 bg-opacity-30 rounded-full p-2">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">

                  <div className="lg:col-span-2">
                    <Label htmlFor="dateRangePreset" className="mb-1.5 block text-sm font-medium">Date Range</Label>
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
                  <div className="lg:col-span-2">
                    <Label htmlFor="fromDate" className="mb-1.5 block text-sm font-medium">From Date</Label>
                    <Popover
                      open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                      onOpenChange={(open) => {
                        if (dateRangePreset !== "custom") return;
                        setIsDatePickerOpen(prev => ({ ...prev, from: open }));
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={`h-10 w-full justify-start text-left font-normal ${dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">{fromDate ? formatDateForApi(fromDate) : "From Date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`from-${fromDate?.getTime() || 'null'}`}
                          mode="single"
                          selected={fromDate}
                          onSelect={(date) => {
                            setFromDate(date);
                            if (date && toDate && date > toDate) setToDate(date);
                            setIsDatePickerOpen(prev => ({ ...prev, from: false }));
                          }}
                          disabled={{ after: new Date() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="toDate" className="mb-1.5 block text-sm font-medium">To Date</Label>
                    <Popover
                      open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                      onOpenChange={(open) => {
                        if (dateRangePreset !== "custom") return;
                        setIsDatePickerOpen(prev => ({ ...prev, to: open }));
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={`h-10 w-full justify-start text-left font-normal ${dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">{toDate ? formatDateForApi(toDate) : "To Date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`to-${toDate?.getTime() || 'null'}`}
                          mode="single"
                          selected={toDate}
                          onSelect={(date) => {
                            setToDate(date);
                            setIsDatePickerOpen(prev => ({ ...prev, to: false }));
                          }}
                          disabled={[
                            fromDate ? { before: fromDate } : null,
                            { after: new Date() }
                          ].filter(Boolean)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="min-w-0 sm:col-span-2 lg:col-span-2">
                    <Label htmlFor="ledgerGroupFilter" className="mb-1.5 block text-sm font-medium">Ledger Group</Label>
                    <Popover open={ledgerGroupDropdownOpen} onOpenChange={setLedgerGroupDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="ledgerGroupFilter"
                          variant="outline"
                          role="combobox"
                          aria-expanded={ledgerGroupDropdownOpen}
                          className="h-10 w-full justify-between font-normal"
                        >
                          <span className="truncate">
                            {selectedLedgerGroupName || "All Groups"}
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
                        <Command>
                          <CommandInput
                            placeholder="Search Ledger Groups..."
                            value={ledgerGroupSearchTerm}
                            onValueChange={setLedgerGroupSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {ledgerGroups.length === 0
                                ? "No Ledger Groups Found."
                                : "No Ledger Groups Match Your Search."}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea
                                className="h-64"
                                onScroll={(e) => {
                                  const target = e.currentTarget;
                                  if (
                                    target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                                    hasNextLedgerGroupPage &&
                                    !isFetchingNextLedgerGroupPage
                                  ) {
                                    fetchNextLedgerGroupPage();
                                  }
                                }}
                              >
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    setSelectedLedgerGroupId(null);
                                    setSelectedLedgerGroupName("");
                                    setLedgerGroupDropdownOpen(false);
                                    setCurrentPage(1);
                                  }}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check
                                      className={`h-4 w-4 ${selectedLedgerGroupId === null ? "opacity-100 text-blue-600" : "opacity-0"
                                        }`}
                                    />
                                    <div className="font-medium text-gray-900">All Groups</div>
                                  </div>
                                </CommandItem>
                                {ledgerGroups.map((ledgerGroup) => (
                                  <CommandItem
                                    key={ledgerGroup.id}
                                    value={ledgerGroup.name}
                                    onSelect={() => {
                                      setSelectedLedgerGroupId(ledgerGroup.id);
                                      setSelectedLedgerGroupName(ledgerGroup.name || "");
                                      setLedgerGroupDropdownOpen(false);
                                      setCurrentPage(1);
                                    }}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${selectedLedgerGroupId === ledgerGroup.id ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">{ledgerGroup.name}</div>
                                        {ledgerGroup.parent && (
                                          <div className="text-sm text-gray-500">{ledgerGroup.parent}</div>
                                        )}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                                {isFetchingNextLedgerGroupPage && (
                                  <div className="p-2 text-center text-sm text-gray-500">Loading more...</div>
                                )}
                              </ScrollArea>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="branchFilter" className="mb-1.5 block text-sm font-medium">Branch</Label>
                    <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="branchFilter"
                          variant="outline"
                          role="combobox"
                          aria-expanded={branchDropdownOpen}
                          className="h-10 w-full justify-between font-normal"
                          disabled={branchesLoading}
                        >
                          <span className="truncate">
                            {branchesLoading
                              ? "Loading branches..."
                              : selectedBranchId === "all"
                                ? "All Branches"
                                : (branchesData.find((b) => b.id?.toString() === selectedBranchId)?.name || "Select Branch")}
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
                        <Command>
                          <CommandInput placeholder="Search Branches..." />
                          <CommandList>
                            <CommandEmpty>
                              {branchesLoading
                                ? "Loading branches..."
                                : branchesData.length === 0
                                  ? "No Branches Found."
                                  : "No Branches Match Your Search."}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                <CommandItem
                                  key="all"
                                  value="all"
                                  onSelect={() => {
                                    setSelectedBranchId("all");
                                    setCurrentPage(1);
                                    setBranchDropdownOpen(false);
                                  }}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check
                                      className={`h-4 w-4 ${selectedBranchId === "all" ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                    />
                                    <div className="font-medium text-gray-900">All Branches</div>
                                  </div>
                                </CommandItem>
                                {branchesData.map((branch) => (
                                  <CommandItem
                                    key={branch.id}
                                    value={branch.name}
                                    onSelect={() => {
                                      setSelectedBranchId(branch.id?.toString() || "all");
                                      setCurrentPage(1);
                                      setBranchDropdownOpen(false);
                                    }}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${selectedBranchId === branch.id?.toString()
                                          ? "opacity-100 text-blue-600"
                                          : "opacity-0"
                                          }`}
                                      />
                                      <div className="font-medium text-gray-900">{branch.name}</div>
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
                  <div className="lg:col-span-2">
                    <Label htmlFor="statusFilter" className="mb-1.5 block text-sm font-medium">Status</Label>
                    <Select value={statusFilter} onValueChange={(value) => {
                      setStatusFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger id="statusFilter" className="h-10">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map((status) => {
                          const formatStatusName = (statusValue) => {
                            if (statusValue === 'all') return 'All Status';
                            if (statusValue.includes(' ')) {
                              return statusValue
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                            }
                            return statusValue
                              .split('_')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                          };

                          return (
                            <SelectItem key={status} value={status}>
                              {formatStatusName(status)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 sm:col-span-2 lg:col-span-2">
                    <Label htmlFor="itemFilter" className="mb-1.5 block text-sm font-medium">Item</Label>
                    <Popover
                      open={itemFilterOpen}
                      onOpenChange={(open) => {
                        setItemFilterOpen(open);
                        if (!open) setItemFilterSearch("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="itemFilter"
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemFilterOpen}
                          className="h-10 w-full justify-between font-normal"
                        >
                          <span className="truncate">
                            {selectedItemFilterId
                              ? (selectedItemFilterName || `Item #${selectedItemFilterId}`)
                              : "All Items"}
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
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search Items..."
                            value={itemFilterSearch}
                            onValueChange={setItemFilterSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {stockItemsFilterLoading ? "Loading items..." : "No items found."}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                <CommandItem
                                  key="all-items"
                                  value="all-items"
                                  onSelect={() => {
                                    setSelectedItemFilterId(null);
                                    setSelectedItemFilterName("");
                                    setCurrentPage(1);
                                    setItemFilterOpen(false);
                                  }}
                                  className="flex items-center cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${!selectedItemFilterId ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                  />
                                  All Items
                                </CommandItem>
                                {stockItemsForFilter.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.name}
                                    onSelect={() => {
                                      setSelectedItemFilterId(item.id);
                                      setSelectedItemFilterName(item.name || "");
                                      setCurrentPage(1);
                                      setItemFilterOpen(false);
                                    }}
                                    className="flex items-center cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${selectedItemFilterId === item.id ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                    />
                                    {item.name}
                                  </CommandItem>
                                ))}
                              </ScrollArea>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Search - sits right after the Item filter */}
                  <div className="min-w-0 sm:col-span-2 lg:col-span-7">
                    <Label htmlFor="searchTerm" className="mb-1.5 block text-sm font-medium">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="searchTerm"
                        placeholder="Search by SO Number, Customer, Branch, Status..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 pl-10"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                  <Button
                    variant="outline"
                    className="h-10 shrink-0"
                    onClick={() => {
                      setDateRangePreset("today");
                      const now = new Date();
                      setFromDate(startOfDay(now));
                      setToDate(endOfDay(now));
                      setStatusFilter("all");
                      setSearchTerm("");
                      setDebouncedSearchTerm("");
                      setSelectedLedgerGroupId(null);
                      setSelectedLedgerGroupName("");
                      setLedgerGroupSearchTerm("");
                      setSelectedBranchId("all");
                      setSelectedItemFilterId(null);
                      setSelectedItemFilterName("");
                      setItemFilterSearch("");
                      setCurrentPage(1);
                      refetch();
                    }}
                  >
                    Clear Filters
                  </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sales Orders List */}
            <Card>
              <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-gray-800">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span>Sales Orders ({orders.length} on this page)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedSalesOrders.length > 0 && (
                      <Button
                        onClick={handleCreateOutwardFromSelection}
                        className="bg-green-600 hover:bg-green-700 text-white h-8"
                        size="sm"
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        Create Outward ({selectedSalesOrders.length})
                      </Button>
                    )}
                    <Badge variant="outline">
                      Total: {totalCount}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                )}
                {/* Select All Checkbox */}
                <div className="mb-3 flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    id="select-all"
                    checked={
                      (() => {
                        const approvedOrders = orders.filter(order =>
                          order.is_gate_pass_eligible === true
                        );
                        return approvedOrders.length > 0 &&
                          approvedOrders.every(order => selectedSalesOrders.includes(order.so_number));
                      })()
                    }
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All Approved Orders
                  </Label>
                  {selectedSalesOrders.length > 0 && (
                    <span className="text-sm text-gray-500">
                      ({selectedSalesOrders.length} selected)
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {orders.map((order) => {
                    const isApproved = order.is_gate_pass_eligible === true;
                    const canSelect = isApproved;
                    const isSelected = selectedSalesOrders.includes(order.so_number);

                    return (
                      <div
                        key={order.so_number}
                        className={`bg-white rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors border ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Checkbox for selection - only show for approved orders without outward entry */}
                            {canSelect && (
                              <div className="pt-1">
                                <Checkbox
                                  id={`select-${order.so_number}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSalesOrderSelection(order.so_number)}
                                />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="outline" className="font-mono text-sm">
                                  {order.so_number}
                                </Badge>
                                {order.order_number ? (
                                  <Badge variant="outline" className="font-mono text-sm">
                                    Order No. {order.order_number}
                                  </Badge>
                                ) : null}
                                {order.total_item > 0 && (
                                  <Badge className="flex items-center space-x-1 text-xs">
                                    <Package className="h-3 w-3" />
                                    <span>{order.total_item} items</span>
                                  </Badge>
                                )}
                                {isTallyEnabled && (
                                  <Badge
                                    variant={order.is_tally_synced ? "default" : "secondary"}
                                    className="flex items-center space-x-1 text-xs"
                                  >
                                    {order.is_tally_synced ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span>Synced</span>
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="h-3 w-3" />
                                        <span>Not Synced</span>
                                      </>
                                    )}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="font-mono text-sm">
                                  Order Date {formatDate(order.order_date)}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-sm">
                                  Due Date {formatDate(order.due_date)}
                                </Badge>
                              </div>
                              <div
                                className={`grid grid-cols-2 md:grid-cols-3 gap-3 text-sm items-end ${showBillingAmount ? "lg:grid-cols-7" : "lg:grid-cols-6"
                                  }`}
                              >
                                <div className="col-span-2">
                                  <span className="text-xs text-gray-500 block mb-0.5">Customer</span>
                                  <p className="font-semibold text-sm">{order.customer_name || "-"}</p>
                                  <p className="text-sm">{order.debtor_name || "-"}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-0.5">Branch</span>
                                  <p className="font-semibold text-sm">{getOrderBranchName(order)}</p>
                                </div>
                                {/* <div>
                                  <span className="text-xs text-gray-500 block mb-0.5">Order Date</span>
                                  <p className="font-semibold text-sm">{formatDate(order.order_date)}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-0.5">Due Date</span>
                                  <p className="font-semibold text-sm">{formatDate(order.due_date)}</p>
                                </div> */}
                                <div>
                                  <span className="text-xs text-gray-500 block mb-0.5">Amount</span>
                                  <p className="font-semibold text-sm text-green-600">
                                    {order.total_amount ? formatCurrency(order.total_amount) : "-"}
                                  </p>
                                </div>
                                {showBillingAmount && (
                                  <div>
                                    <span className="text-xs text-gray-500 block mb-0.5">Billing Amount</span>
                                    <p className="font-semibold text-sm text-blue-600">
                                      {order.billing_amount ? formatCurrency(order.billing_amount) : "-"}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-xs text-gray-500 block mb-0.5">Status</span>
                                  {order.status ? (
                                    <Badge
                                      variant={getStatusBadgeVariant(order.status)}
                                      className={`flex items-center space-x-1 text-xs w-fit ${getStatusBadgeClassName(order.status)}`}
                                    >
                                      {getStatusIcon(order.status)}
                                      <span>
                                        {String(order.status)
                                          .replace(/_/g, ' ')
                                          .toLowerCase()
                                          .replace(/\b\w/g, (char) => char.toUpperCase())}
                                      </span>
                                    </Badge>
                                  ) : (
                                    <p className="font-semibold text-sm text-gray-400">-</p>
                                  )}
                                </div>
                                <div>
                                  {/* <span className="text-xs text-gray-500 block mb-0.5">{order.order_reference || "Order By"}</span> */}
                                  <span className="text-xs text-gray-500 block mb-0.5">{"Created By"}</span>
                                  <p className="font-semibold text-sm">{order.created_by || "-"}</p>

                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col shrink-0 border-t border-gray-100 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4 sm:min-w-[11.5rem]">
                            <span className="text-xs text-gray-500 block mb-1.5">Action</span>
                            <div className="flex items-center gap-1.5 flex-nowrap h-8">
                              {hasReadPermission("sales_order") && (
                                <Button
                                  type="button"
                                  variant="default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(order);
                                  }}
                                  title="View Details"
                                  className={`${actionIconButtonClass} bg-black text-white hover:bg-gray-800 border border-black`}
                                >
                                  <Eye className="h-4 w-4 shrink-0" />
                                </Button>
                              )}
                              {hasUpdatePermission("sales_order") &&
                                isSalesOrderEditableStatus(order.so_status || order.status) && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLocation(
                                        `/create-sales-order?edit=${encodeURIComponent(order.so_number)}`
                                      );
                                    }}
                                    title="Edit Sales Order"
                                    className={`${actionIconButtonClass} border-blue-600 text-blue-600 hover:bg-blue-50`}
                                  >
                                    <Edit className="h-4 w-4 shrink-0" />
                                  </Button>
                                )}
                              {canDeleteSalesOrder(order) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteDialog(order);
                                  }}
                                  title="Delete Sales Order"
                                  className={`${actionIconButtonClass} border-red-600 text-red-600 hover:bg-red-50`}
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />
                                </Button>
                              )}
                              {hasUpdatePermission("sales_order") &&
                                order.status?.toLowerCase() !== "approved" &&
                                order.status?.toLowerCase() !== "rejected" &&
                                (order.status?.toLowerCase() === "pending" ||
                                  order.status?.toLowerCase() === "draft" ||
                                  order.status?.toLowerCase() === "partially_approved") && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrderForAction(order);
                                        setActionType("approve");
                                        setActionRemarks("");
                                        setItemUpdates([]);
                                        setIsApproveRejectModalOpen(true);
                                      }}
                                      title="Approve"
                                      className={`${actionIconButtonClass} border-green-600 text-green-600 hover:bg-green-50`}
                                    >
                                      <CheckCircle className="h-4 w-4 shrink-0" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrderForAction(order);
                                        setActionType("reject");
                                        setActionRemarks("");
                                        setItemUpdates([]);
                                        setIsApproveRejectModalOpen(true);
                                      }}
                                      title="Reject"
                                      className={`${actionIconButtonClass} border-red-600 text-red-600 hover:bg-red-50`}
                                    >
                                      <XCircle className="h-4 w-4 shrink-0" />
                                    </Button>
                                  </>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!isLoading && orders.length === 0 && (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No sales orders found</p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <div className="text-sm text-gray-500">
                      Showing {listStart} to {listEnd} of {totalCount} orders
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

      {/* Sales Order Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={handleDetailModalClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <ShoppingCart className="h-5 w-5" />
                  <span>Sales Order Details</span>
                </div>
                {/* Status Wizard Flow - only when user has Outward R permission */}
                {showBillingAmount && (() => {
                  const soStatus = (orderDetail?.header?.so_status || selectedOrder?.so_status || '').toLowerCase().trim();

                  if (!soStatus) return null;

                  // Define wizard steps
                  const steps = [
                    { label: 'Created', key: 'created' },
                    { label: 'Approved/Rejected', key: 'approved' },
                    { label: 'GP Created', key: 'gp_created' },
                    { label: 'DN Created', key: 'dn_created' },
                    { label: 'Invoice', key: 'invoice' }
                  ];

                  // Determine current step index based on status
                  let currentStepIndex = 0;
                  if (soStatus === 'pending') {
                    currentStepIndex = 0; // Created
                  } else if (soStatus === 'approved' || soStatus === 'rejected') {
                    currentStepIndex = 1; // Approved/Rejected
                  } else if (soStatus === 'gate pass created' || soStatus === 'gatepass created') {
                    currentStepIndex = 2; // GP Created
                  } else if (soStatus === 'delivery note created' || soStatus === 'deliverynote created') {
                    currentStepIndex = 3; // DN Created
                  } else if (soStatus === 'invoice' || soStatus === 'invoiced') {
                    currentStepIndex = 4; // Invoice
                  }

                  return (
                    <div className="flex items-center space-x-1 w-full lg:w-auto lg:flex-1 lg:max-w-2xl overflow-x-auto pb-2 lg:pb-0">
                      {steps.map((step, index) => {
                        const isCompleted = index <= currentStepIndex;

                        return (
                          <div key={step.key} className="flex items-center flex-shrink-0">
                            {/* Step Circle */}
                            <div className="flex flex-col items-center min-w-[60px]">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'bg-red-500 border-red-500 text-white'
                                  }`}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <span className="text-xs">{index + 1}</span>
                                )}
                              </div>
                              <span
                                className={`text-xs mt-1 text-center whitespace-nowrap ${isCompleted ? 'text-green-600 font-medium' : 'text-red-600 font-medium'
                                  }`}
                              >
                                {step.label}
                              </span>
                            </div>
                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                              <div
                                className={`h-0.5 w-8 lg:w-auto lg:flex-1 mx-1 min-w-[20px] ${index < currentStepIndex ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              {(() => {
                if (!selectedOrder) return null;

                const isNotSynced =
                  selectedOrder.is_tally_synced === false || selectedOrder.is_tally_synced === undefined;
                const soStatus = orderDetail?.header?.so_status || selectedOrder?.so_status || "";
                const soStatusNorm = String(soStatus).toLowerCase().trim();
                const isPending = soStatusNorm === "pending";
                const shouldShowSync = isTallyEnabled && isNotSynced && !isPending;
                const detailGatePassEligible = !!(
                  orderDetail?.header?.is_gate_pass_eligible ?? selectedOrder?.is_gate_pass_eligible
                );
                const canEditSalesOrder =
                  hasUpdatePermission("sales_order") &&
                  isSalesOrderEditableStatus(soStatus);

                const canDeleteDetail = canDeleteSalesOrder(selectedOrder);
                const hasDetailActions =
                  canEditSalesOrder ||
                  shouldShowSync ||
                  (showGPButton && detailGatePassEligible) ||
                  canDeleteDetail;

                if (!hasDetailActions && !orderDetail?.header) {
                  return null;
                }

                return (
                  <div className="flex items-center gap-2 mr-8 flex-wrap justify-end">
                    {orderDetail?.header && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadSalesOrderPdf}
                        disabled={isPdfGenerating || isDetailLoading || isDetailFetching}
                        className="flex items-center border-gray-300"
                      >
                        {isPdfGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-1" />
                           
                          </>
                        )}
                      </Button>
                    )}
                    {canDeleteDetail && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDeleteDialog(selectedOrder)}
                        className="flex items-center border-red-600 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {/* <span>Delete</span> */}
                      </Button>
                    )}
                    {canEditSalesOrder && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          setLocation(
                            `/create-sales-order?edit=${encodeURIComponent(selectedOrder.so_number)}`
                          );
                        }}
                        className="flex items-center border-blue-600 text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {/* <span>Edit</span> */}
                      </Button>
                    )}
                    {showGPButton && detailGatePassEligible && (
                      <Button
                        size="sm"
                        onClick={() => setLocation(`/outward/add-outward?so_number=${selectedOrder.so_number}`)}
                        className="bg-green-600 hover:bg-green-700 text-white flex items-center"
                      >
                        <Truck className="h-4 w-4 mr-1" />
                        <span>GP</span>
                      </Button>
                    )}
                    {shouldShowSync && (
                      <Button
                        size="sm"
                        onClick={() => handleSyncClick(selectedOrder)}
                        disabled={syncSalesOrderMutation.isPending}
                        className="flex items-center"
                      >
                        {syncSalesOrderMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Syncing...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            <span>Sync to Tally</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })()}
            </DialogTitle>

          </DialogHeader>

          {isDetailLoading || isDetailFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orderDetail ? (
            <div className="space-y-4">
              {/* Header Information */}
              <div className="space-y-4">
                {/* First Row: Main 4 columns */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Sales Order Number</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.so_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Order Date</Label>
                    <p className="text-lg font-semibold">{formatDate(orderDetail.header?.order_date)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">SO Status</Label>
                    {orderDetail.header?.so_status ? (
                      <Badge
                        variant={getSoStatusBadgeVariant(orderDetail.header.so_status)}
                        className={`flex items-center space-x-1 w-fit ${getSoStatusBadgeClassName(orderDetail.header.so_status)}`}
                      >
                        {getSoStatusIcon(orderDetail.header.so_status)}
                        <span>{orderDetail.header.so_status}</span>
                      </Badge>
                    ) : (
                      <p className="text-lg font-semibold text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.customer_name || "-"}</p>
                  </div>
                </div>
                {/* Second Row: Additional fields */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Order Number</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.order_number || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Due Date</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.due_date ? formatDate(orderDetail.header.due_date) : "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Broker</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.broker_name || "-"}</p>
                  </div>
                  {/*                   <div> */}
                  {/*                     <Label className="text-sm font-medium text-gray-500">Created By</Label> */}
                  {/*                     <p className="text-lg font-semibold">{orderDetail.header?.salesman_name || "-"}</p> */}
                  {/*                   </div> */}
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Created By</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.order_by_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Branch</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.branch || "-"}</p>
                  </div>
                </div>
                {/* Third Row: More fields */}
                <div className={`grid grid-cols-1 ${showBillingAmount && hasBilledData ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-6`}>

                  <div>
                    <Label className="text-sm font-medium text-gray-500">Credit Type</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.credit_type || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total Items</Label>
                    <p className="text-lg font-semibold">{orderDetail.header?.total_item || 0}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total Amount</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {calculatedTotalAmount !== undefined && calculatedTotalAmount !== null
                        ? formatCurrency(calculatedTotalAmount)
                        : (orderDetail.header?.amount ? formatCurrency(orderDetail.header.amount) : "-")}
                    </p>
                  </div>
                  {showBillingAmount && hasBilledData && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Billing Amount</Label>
                      <p className="text-2xl font-bold text-blue-600">
                        {orderDetail.header?.billing_amount ? formatCurrency(orderDetail.header.billing_amount) : "-"}
                      </p>
                    </div>
                  )}
                </div>

                {(() => {
                  const photo1 = getSalesOrderPhotoUrl(
                    orderDetail.header?.photo1 ?? orderDetail?.photo1
                  );
                  const photo2 = getSalesOrderPhotoUrl(
                    orderDetail.header?.photo2 ?? orderDetail?.photo2
                  );
                  if (!photo1 && !photo2) return null;
                  return (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Photos</Label>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {photo1 ? (
                          <button
                            type="button"
                            onClick={() => openImageViewer(photo1, "Photo 1")}
                            className="block shrink-0 rounded-md border border-gray-200 overflow-hidden hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="View photo 1"
                          >
                            <img
                              src={photo1}
                              alt="Sales order photo 1"
                              className="h-20 w-20 object-cover bg-gray-50 cursor-pointer"
                            />
                          </button>
                        ) : null}
                        {photo2 ? (
                          <button
                            type="button"
                            onClick={() => openImageViewer(photo2, "Photo 2")}
                            className="block shrink-0 rounded-md border border-gray-200 overflow-hidden hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="View photo 2"
                          >
                            <img
                              src={photo2}
                              alt="Sales order photo 2"
                              className="h-20 w-20 object-cover bg-gray-50 cursor-pointer"
                            />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Delivery address row — 4-col grid aligned with header; voice icon in last column under Total Amount */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <div className={orderDetail.header?.remarks ? "md:col-span-2" : "md:col-span-3"}>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm font-medium text-gray-500">Delivery Address</Label>
                    {hasUpdatePermission("sales_order") &&
                      (orderDetail.header?.status?.toLowerCase() === 'pending' ||
                        orderDetail.header?.so_status?.toLowerCase() === 'pending') && (
                        !isEditingAddress ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditedAddress(
                                orderDetail.header?.shipping_address ||
                                orderDetail.header?.address ||
                                ""
                              );
                              setIsEditingAddress(true);
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setIsEditingAddress(false);
                                setEditedAddress("");
                              }}
                              className="h-7 px-2 text-xs"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (!selectedOrder?.so_number) return;
                                const trimmedAddress = (editedAddress || "").trim();
                                if (!trimmedAddress) {
                                  toast({
                                    title: "Error",
                                    description: "Please enter a delivery address",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                updateAddressMutation.mutate({
                                  soNumber: selectedOrder.so_number,
                                  address: trimmedAddress
                                });
                              }}
                              disabled={updateAddressMutation.isPending}
                              className="h-7 px-2 text-xs"
                            >
                              {updateAddressMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              )}
                            </Button>
                          </div>
                        )
                      )}
                  </div>
                  {isEditingAddress ? (
                    <Textarea
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      placeholder="Enter delivery address"
                      rows={3}
                      className="mt-1"
                    />
                  ) : (
                    <div className="flex items-start space-x-2 mt-1 p-3 bg-gray-50 rounded-md">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                      <p className="text-gray-700">
                        {orderDetail.header?.shipping_address
                          ? orderDetail.header.shipping_address
                          : orderDetail.header?.address
                            ? orderDetail.header.address
                            : "No address provided"}
                      </p>
                    </div>
                  )}
                </div>
                {orderDetail.header?.remarks && (
                  <div className="md:col-span-1">
                    <Label className="text-sm font-medium text-gray-500">Remarks</Label>
                    <p className="text-gray-700 mt-1 p-3 bg-gray-50 rounded-md">{orderDetail.header.remarks}</p>
                  </div>
                )}
                {(orderDetail.header?.voice_remarks || "").trim() ? (
                  <div className="md:col-span-1 flex justify-end items-end md:pt-6 pb-0.5">
                    <Button
                      type="button"
                      size="icon"
                      className={`h-11 w-11 shrink-0 rounded-full shadow-lg border-2 transition-colors ${voicePlaying
                          ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-4 ring-amber-200"
                          : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700 ring-4 ring-blue-200"
                        }`}
                      onClick={toggleVoiceRemarkPlayback}
                      title={voicePlaying ? "Pause voice recording" : "Listen to voice recording"}
                      aria-label={voicePlaying ? "Pause voice recording" : "Listen to voice recording"}
                    >
                      {voicePlaying ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Order Items - Table Format */}
              {orderDetail.items && orderDetail.items.length > 0 && (
                <Card>
                  <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                    <CardTitle className="flex items-center space-x-2 text-sm font-semibold text-gray-800">
                      <Package className="h-4 w-4" />
                      <span>Order Items ({orderDetail.items.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[500px]">Item</TableHead>
                            <TableHead className="w-[100px] text-center">Ordered Qty</TableHead>
                            <TableHead className="w-[90px] text-center">Approved Qty</TableHead>
                            <TableHead className="w-[90px] text-center">Dispatched Qty</TableHead>
                            {hasBilledData && (
                              <TableHead className="w-[100px] text-center">Billed Qty</TableHead>
                            )}
                            <TableHead className="w-[250px] text-center">Price</TableHead>
                            <TableHead className="w-[100px] text-center">UOM</TableHead>
                            <TableHead className="w-[60px] text-center">GST</TableHead>
                            <TableHead className="w-[140px] text-right">Total</TableHead>
                            {showBrokerage && (
                              <TableHead className="w-[110px] text-center">Brokerage</TableHead>
                            )}
                            {showBillingAmount && hasBilledData && (
                              <TableHead className="w-[120px] text-right">Billing Amount</TableHead>
                            )}
                            <TableHead className="w-[120px] text-center">Status</TableHead>
                            {hasUpdatePermission("sales_order") && orderDetail.items.some(item => !item.is_approved && !item.is_rejected) && (
                              <TableHead className="w-[150px]">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderDetail.items.map((item, index) => {
                            const itemEdit = itemEdits[item.id] || {};
                            const hasChanges = itemEdit.hasChanges || false;
                            const isPending = !item.is_approved && !item.is_rejected;
                            const canEdit = hasUpdatePermission("sales_order") && isPending;
                            // Auto-fill approved quantity with ordered quantity if not set or is 0 for pending items
                            const originalApprovedQty = canEdit && (item.approved_quantity === undefined || item.approved_quantity === null || item.approved_quantity === 0)
                              ? item.quantity || 0
                              : (item.approved_quantity !== undefined && item.approved_quantity !== null
                                ? item.approved_quantity
                                : (item.is_approved ? item.quantity : 0));

                            // Determine original rate and UOM based on rate_per_unit
                            // rate_per_unit indicates which unit the price is in
                            // Match rate_per_unit against stock_item units to determine which price to use
                            const ratePerUnit = item.rate_per_unit ? String(item.rate_per_unit).trim().toUpperCase() : '';
                            const stockBaseUnitName = item.stock_item?.base_unit?.name ? String(item.stock_item.base_unit.name).trim().toUpperCase() : '';
                            const stockAlternateUnitName = item.stock_item?.alternate_unit?.name ? String(item.stock_item.alternate_unit.name).trim().toUpperCase() : '';

                            // Check if rate_per_unit matches base_unit or alternate_unit
                            const isRateInBaseUnit = ratePerUnit === stockBaseUnitName;
                            const isRateInAlternateUnit = ratePerUnit === stockAlternateUnitName;

                            // Determine original rate and UOM ID based on rate_per_unit
                            let originalRate = 0;
                            let currentUOM = 'N/A';
                            let originalBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;

                            if (isRateInBaseUnit) {
                              // rate_per_unit matches base_unit, use item.price
                              originalRate = parseFloat(item.price || item.rate || 0);
                              currentUOM = item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A';
                              originalBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;
                            } else if (isRateInAlternateUnit) {
                              // rate_per_unit matches alternate_unit, use item.alternate_rate
                              originalRate = parseFloat(item.alternate_rate || item.price || item.rate || 0);
                              currentUOM = item.stock_item?.alternate_unit?.name || item.alternate_unit?.name || 'N/A';
                              originalBaseUnitId = item.stock_item?.alternate_unit?.id || item.alternate_unit?.id || null;
                            } else {
                              // Fallback to is_primary_unit logic if rate_per_unit doesn't match
                              const isPrimaryUnit = item.is_primary_unit === true || item.is_primary_unit === "true";
                              if (isPrimaryUnit) {
                                originalRate = parseFloat(item.price || item.rate || 0);
                                currentUOM = item.base_unit?.name || 'N/A';
                                originalBaseUnitId = item.stock_item?.base_unit?.id || item.base_unit?.id || null;
                              } else {
                                originalRate = parseFloat(item.alternate_rate || item.price || item.rate || 0);
                                currentUOM = item.alternate_unit?.name || 'N/A';
                                originalBaseUnitId = item.stock_item?.alternate_unit?.id || item.alternate_unit?.id || null;
                              }
                            }

                            const currentApprovedQty = itemEdit.approved_quantity !== undefined ? itemEdit.approved_quantity : originalApprovedQty;
                            const currentRate = itemEdit.rate !== undefined ? itemEdit.rate : originalRate;

                            // Get brokerage amount for this item - from item-level response
                            let itemBrokerageAmount = 0;
                            if (showBrokerage && item.brokerage_amount) {
                              itemBrokerageAmount = parseFloat(item.brokerage_amount || 0);
                            }

                            // Calculate total based on selected UOM
                            // Formula:
                            // - If base unit: total = approved_quantity * base_price
                            // - If alternate unit: total = approved_quantity * alternate_price * conversion
                            // Quantities are ALWAYS in base unit, never converted

                            // For approved items, use actual data from API (ignore itemEdits)
                            // For pending items, use itemEdits if available, otherwise calculate
                            let itemTotal = 0;
                            if (item.is_approved || item.is_rejected) {
                              // Item is approved/rejected - use actual approved_quantity and base unit price from API
                              const approvedQty = parseFloat(item.approved_quantity || item.quantity || 0);
                              const baseUnitPrice = parseFloat(item.price || item.rate || 0);
                              itemTotal = approvedQty * baseUnitPrice;
                            } else {
                              // Item is pending - use itemEdit.fixed_total if available (already calculated)
                              if (itemEdit.fixed_total !== undefined) {
                                itemTotal = itemEdit.fixed_total;
                              } else {
                                // Calculate total based on selected UOM
                                const currentUOMId = itemEdit.base_unit_id !== undefined ? itemEdit.base_unit_id : originalBaseUnitId;
                                const isRateInBaseUnit = currentUOMId === item.stock_item?.base_unit?.id;
                                const enteredRate = parseFloat(currentRate || 0);

                                if (isRateInBaseUnit) {
                                  // Base unit: total = approved_quantity * base_price
                                  itemTotal = parseFloat(currentApprovedQty || 0) * enteredRate;
                                } else if (item.stock_item?.conversion) {
                                  // Alternate unit: total = approved_quantity * alternate_price * conversion
                                  const conversion = parseFloat(item.stock_item.conversion) || 1;
                                  itemTotal = parseFloat(currentApprovedQty || 0) * enteredRate * conversion;
                                } else {
                                  // Fallback: treat as base unit
                                  const baseUnitPrice = parseFloat(item.price || item.rate || 0);
                                  itemTotal = parseFloat(currentApprovedQty || 0) * baseUnitPrice;
                                }
                              }
                            }
                            // Total column shows item amount only (brokerage not included)

                            return (
                              <TableRow key={item.id || index} className="hover:bg-gray-50">
                                <TableCell className="p-3">
                                  <div className="font-medium text-gray-900">
                                    {item.item_name || `Item ${index + 1}`}
                                  </div>

                                  {item.live_stock !== null && item.live_stock !== undefined && (
                                    <div className="font-medium text-gray-500">
                                      Current Balance: {item.live_stock}
                                    </div>
                                  )}
                                </TableCell>

                                <TableCell className="p-3 text-center">
                                  {/* Ordered Qty - ALWAYS use stock_item.base_unit (actual base unit) */}
                                  <span className="font-semibold text-gray-900">{Math.floor(parseFloat(item.quantity || 0))} {item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A'}</span>
                                </TableCell>

                                {/* Approved Qty - ALWAYS in base unit, never converted */}
                                <TableCell className="p-3">
                                  <div className="space-y-1">
                                    {canEdit ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={Math.floor(parseFloat(currentApprovedQty || 0))}
                                        onChange={(e) => {
                                          const inputValue = e.target.value.trim();
                                          // If input is empty, set to 0, otherwise parse as integer
                                          // NOTE: Quantity is always in base unit, never converted
                                          if (inputValue === '' || inputValue === null || inputValue === undefined) {
                                            handleItemFieldChange(item.id, 'approved_quantity', 0);
                                          } else {
                                            const value = parseInt(inputValue, 10);
                                            // Only update if it's a valid integer (including 0)
                                            if (!isNaN(value) && value >= 0) {
                                              // Quantity is always in base unit
                                              handleItemFieldChange(item.id, 'approved_quantity', value);
                                            }
                                          }
                                        }}
                                        className="h-9 w-full text-center"
                                        size="sm"
                                      />
                                    ) : (
                                      <p className="font-semibold text-green-600 text-center">{Math.floor(parseFloat(originalApprovedQty || 0))} {item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A'}</p>
                                    )}
                                    {/* Base and Alternate Unit Conversion Display */}
                                    {item.stock_item?.base_unit?.name && item.stock_item?.alternate_unit?.name && item.stock_item?.conversion && (() => {
                                      const approvedQty = Math.floor(parseFloat(currentApprovedQty || 0));
                                      const conversion = parseFloat(item.stock_item.conversion || 1);
                                      const alternateQty = approvedQty * conversion;
                                      // Format to remove trailing zeros
                                      const formattedAlternateQty = alternateQty % 1 === 0 ? alternateQty.toString() : alternateQty.toFixed(2).replace(/\.?0+$/, '');
                                      return (
                                        <div className="text-xs text-gray-600 text-center mt-1">
                                          <span className="font-medium">
                                            {approvedQty} {item.stock_item.base_unit.name}
                                          </span>
                                          <span className="mx-1">=</span>
                                          <span className="font-medium">
                                            {formattedAlternateQty} {item.stock_item.alternate_unit.name}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </TableCell>
                                {/* Delivered Qty - ALWAYS in base unit, never converted */}
                                <TableCell className="p-3 text-center">
                                  <p className="font-semibold text-blue-600">
                                    {Math.floor(parseFloat(item.delivered_quantity || 0))} {item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A'}
                                  </p>
                                </TableCell>
                                {/* Billed Qty Column - Conditionally rendered */}
                                {hasBilledData && (
                                  <TableCell className="p-3 text-center">
                                    <div className="space-y-1">
                                      <p className="font-semibold text-blue-600">
                                        {item.billed_quantity ? `${Math.floor(parseFloat(item.billed_quantity || 0))} ${item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A'}` : "-"}
                                      </p>
                                      {/* Base and Alternate Unit Conversion Display for Billed Qty */}
                                      {item.billed_quantity && item.stock_item?.base_unit?.name && item.stock_item?.alternate_unit?.name && item.stock_item?.conversion && (() => {
                                        const billedQty = Math.floor(parseFloat(item.billed_quantity || 0));
                                        const conversion = parseFloat(item.stock_item.conversion || 1);
                                        const alternateQty = billedQty * conversion;
                                        // Format to remove trailing zeros
                                        const formattedAlternateQty = alternateQty % 1 === 0 ? alternateQty.toString() : alternateQty.toFixed(2).replace(/\.?0+$/, '');
                                        return (
                                          <div className="text-xs text-gray-600 text-center mt-1">
                                            <span className="font-medium">
                                              {billedQty} {item.stock_item.base_unit.name}
                                            </span>
                                            <span className="mx-1">=</span>
                                            <span className="font-medium">
                                              {formattedAlternateQty} {item.stock_item.alternate_unit.name}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </TableCell>
                                )}
                                <TableCell className="p-3 w-[250px]">
                                  {canEdit ? (
                                    <div className="space-y-1">
                                      {(() => {
                                        // Determine current UOM selection
                                        const currentUOMId = itemEdit.base_unit_id !== undefined ? itemEdit.base_unit_id : originalBaseUnitId;
                                        const isBaseUnitSelected = currentUOMId === item.stock_item?.base_unit?.id;
                                        const isAlternateUnitSelected = currentUOMId === item.stock_item?.alternate_unit?.id;

                                        // Show only the price input for the selected UOM
                                        if (isBaseUnitSelected) {
                                          // Show only base unit price
                                          return (
                                            <div className="space-y-1">
                                              <Input
                                                type="number"
                                                min="0"
                                                max="9999999.99"
                                                step="0.01"
                                                value={currentRate}
                                                onChange={(e) => {
                                                  const inputValue = e.target.value;
                                                  const numericValue = inputValue.replace(/[^0-9.]/g, '');
                                                  const parts = numericValue.split('.');
                                                  const integerPart = parts[0] || '';

                                                  if (integerPart.length > 7) {
                                                    const limitedValue = integerPart.substring(0, 7) + (parts[1] ? '.' + parts[1] : '');
                                                    const value = parseFloat(limitedValue) || 0;
                                                    handleItemFieldChange(item.id, 'rate', value);
                                                  } else {
                                                    const value = parseFloat(numericValue) || 0;
                                                    if (value <= 9999999.99) {
                                                      handleItemFieldChange(item.id, 'rate', value);
                                                    }
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  const inputValue = e.target.value;
                                                  const parts = inputValue.split('.');
                                                  const integerPart = parts[0] || '';

                                                  if (integerPart.length >= 7 &&
                                                    /^\d$/.test(e.key) &&
                                                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '.', 'Enter'].includes(e.key)) {
                                                    e.preventDefault();
                                                  }
                                                }}
                                                className="h-9 w-full text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                                size="sm"
                                                placeholder="Base price"
                                              />
                                              <p className="text-xs text-gray-500 text-center">
                                                / {item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A'}
                                              </p>
                                            </div>
                                          );
                                        } else if (isAlternateUnitSelected && item.stock_item?.alternate_unit) {
                                          // Show only alternate unit price
                                          return (
                                            <div className="space-y-1">
                                              <Input
                                                type="number"
                                                min="0"
                                                max="9999999.99"
                                                step="0.01"
                                                value={currentRate}
                                                onChange={(e) => {
                                                  const inputValue = e.target.value;
                                                  const numericValue = inputValue.replace(/[^0-9.]/g, '');
                                                  const parts = numericValue.split('.');
                                                  const integerPart = parts[0] || '';

                                                  if (integerPart.length > 7) {
                                                    const limitedValue = integerPart.substring(0, 7) + (parts[1] ? '.' + parts[1] : '');
                                                    const value = parseFloat(limitedValue) || 0;
                                                    handleItemFieldChange(item.id, 'rate', value);
                                                  } else {
                                                    const value = parseFloat(numericValue) || 0;
                                                    if (value <= 9999999.99) {
                                                      handleItemFieldChange(item.id, 'rate', value);
                                                    }
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  const inputValue = e.target.value;
                                                  const parts = inputValue.split('.');
                                                  const integerPart = parts[0] || '';

                                                  if (integerPart.length >= 7 &&
                                                    /^\d$/.test(e.key) &&
                                                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '.', 'Enter'].includes(e.key)) {
                                                    e.preventDefault();
                                                  }
                                                }}
                                                className="h-9 w-full text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                                size="sm"
                                                placeholder="Alternate price"
                                              />
                                              <p className="text-xs text-gray-500 text-center">
                                                / {item.stock_item?.alternate_unit?.name || item.alternate_unit?.name || 'N/A'}
                                              </p>
                                            </div>
                                          );
                                        } else {
                                          // Fallback: show base unit price
                                          return (
                                            <div className="space-y-1">
                                              <Input
                                                type="number"
                                                min="0"
                                                max="9999999.99"
                                                step="0.01"
                                                value={currentRate}
                                                onChange={(e) => {
                                                  const inputValue = e.target.value;
                                                  const numericValue = inputValue.replace(/[^0-9.]/g, '');
                                                  const parts = numericValue.split('.');
                                                  const integerPart = parts[0] || '';

                                                  if (integerPart.length > 7) {
                                                    const limitedValue = integerPart.substring(0, 7) + (parts[1] ? '.' + parts[1] : '');
                                                    const value = parseFloat(limitedValue) || 0;
                                                    handleItemFieldChange(item.id, 'rate', value);
                                                  } else {
                                                    const value = parseFloat(numericValue) || 0;
                                                    if (value <= 9999999.99) {
                                                      handleItemFieldChange(item.id, 'rate', value);
                                                    }
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  const inputValue = e.target.value;
                                                  const parts = inputValue.split('.');
                                                  const integerPart = parts[0] || '';

                                                  if (integerPart.length >= 7 &&
                                                    /^\d$/.test(e.key) &&
                                                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '.', 'Enter'].includes(e.key)) {
                                                    e.preventDefault();
                                                  }
                                                }}
                                                className="h-9 w-full text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                                size="sm"
                                                placeholder="Price"
                                              />
                                              <p className="text-xs text-gray-500 text-center">
                                                / {item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A'}
                                              </p>
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      {(() => {
                                        // Determine current UOM from rate_per_unit
                                        const ratePerUnit = item.rate_per_unit ? String(item.rate_per_unit).trim().toUpperCase() : '';
                                        const stockBaseUnitName = item.stock_item?.base_unit?.name ? String(item.stock_item.base_unit.name).trim().toUpperCase() : '';
                                        const stockAlternateUnitName = item.stock_item?.alternate_unit?.name ? String(item.stock_item.alternate_unit.name).trim().toUpperCase() : '';
                                        const isRateInBaseUnit = ratePerUnit === stockBaseUnitName;
                                        const isRateInAlternateUnit = ratePerUnit === stockAlternateUnitName;

                                        // Show only the price for the selected UOM
                                        if (isRateInAlternateUnit && item.alternate_rate) {
                                          return (
                                            <div>
                                              <p className="font-semibold text-green-600">
                                                {formatCurrency(parseFloat(item.alternate_rate || 0))}
                                              </p>
                                              <p className="text-xs text-gray-500 mt-0.5">
                                                / {item.stock_item?.alternate_unit?.name || item.alternate_unit?.name || 'N/A'}
                                              </p>
                                            </div>
                                          );
                                        } else {
                                          return (
                                            <div>
                                              <p className="font-semibold text-green-600">
                                                {formatCurrency(parseFloat(item.price || item.rate || 0))}
                                              </p>
                                              <p className="text-xs text-gray-500 mt-0.5">
                                                / {item.stock_item?.base_unit?.name || item.base_unit?.name || 'N/A'}
                                              </p>
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                  )}
                                </TableCell>

                                {/* UOM Column (for price/rate display only - quantities always in base unit) */}
                                <TableCell className="p-3 text-center">
                                  {canEdit && item.stock_item_id && (item.stock_item?.base_unit || item.stock_item?.alternate_unit || itemPricingMap[item.id]) ? (
                                    <Select
                                      value={(() => {
                                        // If user has edited, use the edited value
                                        if (itemEdits[item.id]?.base_unit_id !== undefined && itemEdits[item.id]?.base_unit_id !== null) {
                                          return itemEdits[item.id].base_unit_id.toString();
                                        }

                                        // Default UOM based on rate_per_unit
                                        // rate_per_unit indicates which unit the price is in
                                        const ratePerUnit = item.rate_per_unit ? String(item.rate_per_unit).trim().toUpperCase() : '';
                                        const stockBaseUnitName = item.stock_item?.base_unit?.name ? String(item.stock_item.base_unit.name).trim().toUpperCase() : '';
                                        const stockAlternateUnitName = item.stock_item?.alternate_unit?.name ? String(item.stock_item.alternate_unit.name).trim().toUpperCase() : '';

                                        // Check if rate_per_unit matches base_unit or alternate_unit
                                        if (ratePerUnit === stockBaseUnitName && item.stock_item?.base_unit?.id) {
                                          return item.stock_item.base_unit.id.toString();
                                        } else if (ratePerUnit === stockAlternateUnitName && item.stock_item?.alternate_unit?.id) {
                                          return item.stock_item.alternate_unit.id.toString();
                                        }

                                        // Fallback to is_primary_unit logic if rate_per_unit doesn't match
                                        const isPrimaryUnit = item.is_primary_unit === true || item.is_primary_unit === "true";
                                        if (isPrimaryUnit) {
                                          // Price is in item.base_unit, find matching stock_item unit
                                          const priceUnitName = item.base_unit?.name;
                                          if (priceUnitName && item.stock_item) {
                                            if (item.stock_item.base_unit?.name === priceUnitName) {
                                              return item.stock_item.base_unit.id.toString();
                                            } else if (item.stock_item.alternate_unit?.name === priceUnitName) {
                                              return item.stock_item.alternate_unit.id.toString();
                                            }
                                          }
                                          // Fallback to item.base_unit.id
                                          return (item.base_unit?.id?.toString() || "none");
                                        } else {
                                          // Price is in item.alternate_unit, find matching stock_item unit
                                          const priceUnitName = item.alternate_unit?.name;
                                          if (priceUnitName && item.stock_item) {
                                            if (item.stock_item.base_unit?.name === priceUnitName) {
                                              return item.stock_item.base_unit.id.toString();
                                            } else if (item.stock_item.alternate_unit?.name === priceUnitName) {
                                              return item.stock_item.alternate_unit.id.toString();
                                            }
                                          }
                                          // Fallback to item.alternate_unit.id
                                          return (item.alternate_unit?.id?.toString() || "none");
                                        }
                                      })()}
                                      onValueChange={async (value) => {
                                        if (value === "none") {
                                          handleItemFieldChange(item.id, 'base_unit_id', null);
                                          return;
                                        }

                                        const selectedUnitId = parseInt(value);

                                        // Update rate based on selected UOM using API response prices
                                        // NOTE: This only affects price/rate display. Quantities remain in base unit.
                                        const itemEdit = itemEdits[item.id] || {};
                                        // currentApprovedQty is always in base unit - never convert
                                        const currentApprovedQty = itemEdit.approved_quantity !== undefined
                                          ? parseInt(itemEdit.approved_quantity)
                                          : parseInt(item.approved_quantity || item.quantity || 0);

                                        let newRate = 0;
                                        if (selectedUnitId === item.stock_item?.base_unit?.id) {
                                          // Selected base unit - use base unit price from API
                                          newRate = parseFloat(item.price || item.rate || 0);
                                        } else if (selectedUnitId === item.stock_item?.alternate_unit?.id) {
                                          // Selected alternate unit - use alternate unit price from API
                                          newRate = parseFloat(item.alternate_rate || item.price || item.rate || 0);
                                        }

                                        // Update base_unit_id (for price display) and rate
                                        handleItemFieldChange(item.id, 'base_unit_id', selectedUnitId);
                                        handleItemFieldChange(item.id, 'rate', parseFloat(newRate.toFixed(2)));

                                        // Recalculate total based on selected UOM
                                        // Formula:
                                        // - If base unit: total = approved_quantity * base_price
                                        // - If alternate unit: total = approved_quantity * alternate_price * conversion
                                        let newTotal = 0;
                                        if (selectedUnitId === item.stock_item?.base_unit?.id) {
                                          // Base unit: total = approved_quantity * base_price
                                          newTotal = currentApprovedQty * parseFloat(newRate.toFixed(2));
                                        } else if (selectedUnitId === item.stock_item?.alternate_unit?.id && item.stock_item?.conversion) {
                                          // Alternate unit: total = approved_quantity * alternate_price * conversion
                                          const conversion = parseFloat(item.stock_item.conversion) || 1;
                                          newTotal = currentApprovedQty * parseFloat(newRate.toFixed(2)) * conversion;
                                        } else {
                                          // Fallback: use base unit price
                                          const baseUnitPrice = parseFloat(item.price || item.rate || 0);
                                          newTotal = currentApprovedQty * baseUnitPrice;
                                        }
                                        handleItemFieldChange(item.id, 'fixed_total', newTotal);
                                      }}
                                      disabled={isProcessing || isLoadingPricing}
                                    >
                                      <SelectTrigger className="h-9 w-full">
                                        <SelectValue>
                                          {(() => {
                                            // Determine current unit ID (edited value, or default based on rate_per_unit, or item's base_unit)
                                            const currentUnitId = (() => {
                                              if (itemEdits[item.id]?.base_unit_id !== undefined && itemEdits[item.id]?.base_unit_id !== null) {
                                                return itemEdits[item.id].base_unit_id;
                                              }

                                              // Default based on rate_per_unit (case-insensitive, trimmed comparison)
                                              // Priority: stock_item (always available) > pricing map (async) > fallback
                                              if (item.rate_per_unit && item.stock_item) {
                                                const ratePerUnitNormalized = String(item.rate_per_unit).trim().toUpperCase();

                                                // Check stock_item first (always available from API response)
                                                const baseUnitName = item.stock_item.base_unit?.name ? String(item.stock_item.base_unit.name).trim().toUpperCase() : null;
                                                const alternateUnitName = item.stock_item.alternate_unit?.name ? String(item.stock_item.alternate_unit.name).trim().toUpperCase() : null;

                                                if (ratePerUnitNormalized === alternateUnitName && item.stock_item.alternate_unit?.id) {
                                                  return item.stock_item.alternate_unit.id;
                                                } else if (ratePerUnitNormalized === baseUnitName && item.stock_item.base_unit?.id) {
                                                  return item.stock_item.base_unit.id;
                                                }

                                                // Also check pricing map if available (for additional validation)
                                                const pricing = itemPricingMap[item.id];
                                                if (pricing) {
                                                  const pricingAltName = pricing.alternate_unit?.name ? String(pricing.alternate_unit.name).trim().toUpperCase() : null;
                                                  const pricingBaseName = pricing.base_unit?.name ? String(pricing.base_unit.name).trim().toUpperCase() : null;

                                                  if (ratePerUnitNormalized === pricingAltName && pricing.alternate_unit?.id) {
                                                    return pricing.alternate_unit.id;
                                                  } else if (ratePerUnitNormalized === pricingBaseName && pricing.base_unit?.id) {
                                                    return pricing.base_unit.id;
                                                  }
                                                }
                                              }

                                              // Final fallback based on is_primary_unit
                                              // When is_primary_unit is true, use item.base_unit (rate_per_unit unit)
                                              // When is_primary_unit is false, use item.alternate_unit
                                              const isPrimaryUnit = item.is_primary_unit === true || item.is_primary_unit === "true";
                                              if (isPrimaryUnit) {
                                                // Match item.base_unit to stock_item units
                                                const priceUnitName = item.base_unit?.name;
                                                if (priceUnitName && item.stock_item) {
                                                  if (item.stock_item.base_unit?.name === priceUnitName) {
                                                    return item.stock_item.base_unit.id;
                                                  } else if (item.stock_item.alternate_unit?.name === priceUnitName) {
                                                    return item.stock_item.alternate_unit.id;
                                                  }
                                                }
                                                return item.base_unit?.id || null;
                                              } else {
                                                // Match item.alternate_unit to stock_item units
                                                const priceUnitName = item.alternate_unit?.name;
                                                if (priceUnitName && item.stock_item) {
                                                  if (item.stock_item.base_unit?.name === priceUnitName) {
                                                    return item.stock_item.base_unit.id;
                                                  } else if (item.stock_item.alternate_unit?.name === priceUnitName) {
                                                    return item.stock_item.alternate_unit.id;
                                                  }
                                                }
                                                return item.alternate_unit?.id || null;
                                              }
                                            })();

                                            const pricing = itemPricingMap[item.id];

                                            if (pricing) {
                                              if (currentUnitId === pricing.base_unit?.id) {
                                                return pricing.base_unit.name;
                                              } else if (currentUnitId === pricing.alternate_unit?.id) {
                                                return pricing.alternate_unit.name;
                                              }
                                            }

                                            if (item.stock_item) {
                                              if (currentUnitId === item.stock_item.base_unit?.id) {
                                                return item.stock_item.base_unit.name;
                                              } else if (currentUnitId === item.stock_item.alternate_unit?.id) {
                                                return item.stock_item.alternate_unit.name;
                                              }
                                            }

                                            // Fallback based on rate_per_unit (same logic as currentUOM calculation)
                                            const ratePerUnit = item.rate_per_unit ? String(item.rate_per_unit).trim().toUpperCase() : '';
                                            const stockBaseUnitName = item.stock_item?.base_unit?.name ? String(item.stock_item.base_unit.name).trim().toUpperCase() : '';
                                            const stockAlternateUnitName = item.stock_item?.alternate_unit?.name ? String(item.stock_item.alternate_unit.name).trim().toUpperCase() : '';

                                            if (ratePerUnit === stockBaseUnitName) {
                                              return item.stock_item?.base_unit?.name || item.base_unit?.name || 'Select UOM';
                                            } else if (ratePerUnit === stockAlternateUnitName) {
                                              return item.stock_item?.alternate_unit?.name || item.alternate_unit?.name || 'Select UOM';
                                            }

                                            // Final fallback to is_primary_unit
                                            const isPrimaryUnit = item.is_primary_unit === true || item.is_primary_unit === "true";
                                            return isPrimaryUnit
                                              ? (item.base_unit?.name || 'Select UOM')
                                              : (item.alternate_unit?.name || 'Select UOM');
                                          })()}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(() => {
                                          const pricing = itemPricingMap[item.id];
                                          const stockItem = item.stock_item;

                                          // Use pricing data if available, otherwise use stock_item data
                                          const baseUnit = pricing?.base_unit || stockItem?.base_unit;
                                          const alternateUnit = pricing?.alternate_unit || stockItem?.alternate_unit;

                                          if (!baseUnit && !alternateUnit) {
                                            return (
                                              <SelectItem value="none" disabled>
                                                No UOM available
                                              </SelectItem>
                                            );
                                          }

                                          return (
                                            <>
                                              {baseUnit && baseUnit.id != null && (
                                                <SelectItem value={String(baseUnit.id)}>
                                                  {baseUnit.name}
                                                  {pricing?.base_unit?.price !== undefined &&
                                                    ` (${parseFloat(pricing.base_unit.price).toFixed(2)})`}
                                                </SelectItem>
                                              )}
                                              {alternateUnit && alternateUnit.id != null && (
                                                <SelectItem value={String(alternateUnit.id)}>
                                                  {alternateUnit.name}
                                                  {pricing?.alternate_unit?.price !== undefined &&
                                                    ` (${parseFloat(pricing.alternate_unit.price).toFixed(2)})`}
                                                </SelectItem>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="font-semibold text-gray-900">{currentUOM || 'N/A'}</span>
                                  )}
                                </TableCell>
                                <TableCell className="p-3 text-center">
                                  {item.gst_percentage ? (
                                    <span className="font-semibold text-gray-900">{item.gst_percentage}%</span>
                                  ) : (
                                    <span className="font-semibold text-gray-900">0%</span>
                                  )}
                                </TableCell>
                                <TableCell className="p-3 text-right">
                                  <div className="text-sm font-semibold text-green-600">
                                    {formatCurrency(itemTotal)}
                                  </div>
                                </TableCell>
                                {/* Brokerage column - brokerage and approved brokerage stacked */}
                                {showBrokerage && (
                                  <TableCell className="p-3 text-center">
                                    <div className="flex flex-col items-center gap-0.5 text-xs">
                                      {item.brokerage_amount != null && item.brokerage_amount !== "" ? (
                                        <>
                                          <span className="text-gray-700">Brokerage: {formatCurrency(item.brokerage_amount)}</span>
                                          {item.approved_brokerage_amount != null && item.approved_brokerage_amount !== "" ? (
                                            <span className="text-green-600 font-medium">Approved: {formatCurrency(item.approved_brokerage_amount)}</span>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </div>
                                  </TableCell>
                                )}
                                {/* Billing Amount Column - Conditionally rendered when Outward R permission */}
                                {showBillingAmount && hasBilledData && (
                                  <TableCell className="p-3 text-right">
                                    <div className="text-sm font-semibold text-blue-600">
                                      {item.billing_amount ? formatCurrency(item.billing_amount) : "-"}
                                    </div>
                                  </TableCell>
                                )}
                                <TableCell className="p-3">
                                  <div className="flex justify-center">
                                    {item.is_approved ? (
                                      <Badge variant="default" className="flex items-center space-x-1">
                                        <CheckCircle className="h-3 w-3" />
                                        <span>Approved</span>
                                      </Badge>
                                    ) : item.is_rejected ? (
                                      <Badge variant="destructive" className="flex items-center space-x-1">
                                        <XCircle className="h-3 w-3" />
                                        <span>Rejected</span>
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="flex items-center space-x-1">
                                        <Clock className="h-3 w-3" />
                                        <span>Pending</span>
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                {/* Actions column - Show approve/reject for pending items OR GP button for approved items when no pending items */}
                                {hasUpdatePermission("sales_order") && (
                                  <TableCell className="p-3">
                                    {/* Show approve/reject buttons for pending items */}
                                    {!item.is_approved && !item.is_rejected && canEdit && (
                                      <div className="space-y-2 min-w-[120px]">
                                        <div className="flex gap-1.5 justify-center">
                                          {/* Show Save button when Approved Qty > 0 and <= Ordered Qty and Price > 0 */}
                                          {currentApprovedQty > 0 && currentRate > 0 && (
                                            <Button
                                              variant="default"
                                              size="sm"
                                              onClick={() => handleInlineItemAction(item.id, 'approve')}
                                              disabled={isProcessing || currentApprovedQty <= 0 || currentRate <= 0}
                                              className="bg-green-600 hover:bg-green-700 text-white flex-2 h-8 text-xs"
                                            >
                                              {isProcessing ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <>
                                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />

                                                </>
                                              )}
                                            </Button>
                                          )}
                                          {/* Show Reject button for all pending items */}
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleInlineItemAction(item.id, 'reject', true)}
                                            disabled={isProcessing}
                                            className="flex-2 h-8 text-xs"
                                          >
                                            {isProcessing ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <>
                                                <XCircle className="h-3.5 w-3.5 mr-1" />

                                              </>
                                            )}
                                          </Button>
                                        </div>
                                        {/* Show both buttons when there are changes but not at the extremes - HIDDEN */}
                                        {/* {hasChanges && currentApprovedQty !== item.quantity && currentApprovedQty > 0 && (
                                          <div className="flex gap-2">
                                            <Button
                                              variant="default"
                                              size="sm"
                                              onClick={() => handleInlineItemAction(item.id, 'approve')}
                                              disabled={isProcessing || currentApprovedQty <= 0 || currentApprovedQty > item.quantity}
                                              className="bg-green-600 hover:bg-green-700 text-white flex-1 h-9"
                                            >
                                              {isProcessing ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <>
                                                  <CheckCircle className="h-4 w-4 mr-1.5" />
                                                  Approve
                                                </>
                                              )}
                                            </Button>
                                            <Button
                                              variant="destructive"
                                              size="sm"
                                              onClick={() => handleInlineItemAction(item.id, 'reject')}
                                              disabled={isProcessing || !itemEdit.action_remarks?.trim()}
                                              className="flex-1 h-9"
                                            >
                                              {isProcessing ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <>
                                                  <XCircle className="h-4 w-4 mr-1.5" />
                                                  Reject
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        )} */}
                                        {/* <div>
                                          <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Action Remarks</Label>
                                          <Textarea
                                            value={itemEdit.action_remarks || ""}
                                            onChange={(e) => handleItemFieldChange(item.id, 'action_remarks', e.target.value)}
                                            placeholder="Enter remarks..."
                                            rows={3}
                                            className="text-sm resize-none"
                                          />
                                        </div> */}
                                        {item.action_remarks && !canEdit && (
                                          <div className="pt-2 border-t">
                                            <span className="text-sm font-medium text-gray-500">Action Remarks:</span>
                                            <p className="text-gray-700 mt-1 text-sm italic">{item.action_remarks}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Location Information */}
              {/* {(orderDetail.header?.lat || orderDetail.header?.long) && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Location Coordinates</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                    <div>
                      <span className="text-sm text-gray-500">Latitude:</span>
                      <p className="font-mono text-sm">{orderDetail.header.lat || "-"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Longitude:</span>
                      <p className="font-mono text-sm">{orderDetail.header.long || "-"}</p>
                    </div>
                  </div>
                </div>
              )} */}

            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Failed to load sales order details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Item-wise Approve/Reject Modal */}
      <Dialog open={isItemEditModalOpen} onOpenChange={(open) => {
        if (!open && !isProcessing) {
          setIsItemEditModalOpen(false);
          setEditingItem(null);
          setStockItemPricing(null);
          setItemEditData({
            item_id: null,
            approved_quantity: 0,
            rate: 0,
            base_unit_id: null,
            action_remarks: "",
            action: ""
          });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MoreVertical className="h-5 w-5" />
              <span>Item Action</span>
            </DialogTitle>
            <DialogDescription>
              Choose to approve or reject this item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Item Information */}
            {editingItem && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Item:</strong> {editingItem.item_name || 'Unknown Item'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Ordered Quantity:</strong> {editingItem.quantity || 0}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Current Status:</strong> {
                    editingItem.is_approved ? 'Approved' :
                      editingItem.is_rejected ? 'Rejected' :
                        'Pending'
                  }
                </p>
              </div>
            )}

            {/* Toggle Switch for Approve/Reject */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center space-x-3">
                {itemEditData.action === 'approve' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    {itemEditData.action === 'approve' ? 'Approve' : 'Reject'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {itemEditData.action === 'approve'
                      ? 'Approve this item'
                      : 'Reject this item'}
                  </p>
                </div>
              </div>
              <Switch
                checked={itemEditData.action === 'approve'}
                onCheckedChange={(checked) => {
                  setItemEditData(prev => ({
                    ...prev,
                    action: checked ? 'approve' : 'reject',
                    action_remarks: checked ? prev.action_remarks : "" // Clear remarks when switching to reject
                  }));
                }}
                disabled={isProcessing}
              />
            </div>

            {/* Approved Quantity / Rate / Brokerage (for approval) */}
            {itemEditData.action === 'approve' && (
              <>
                <div>
                  <Label htmlFor="approved-quantity" className="text-sm font-medium text-gray-700">
                    Approved Quantity *
                  </Label>
                  <Input
                    id="approved-quantity"
                    type="number"
                    min="0"
                    max={editingItem?.quantity || 0}
                    step="0.01"
                    value={itemEditData.approved_quantity}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const maxQty = parseFloat(editingItem?.quantity || 0);
                      setItemEditData(prev => ({
                        ...prev,
                        approved_quantity: value > maxQty ? maxQty : value
                      }));
                    }}
                    disabled={isProcessing}
                    className="mt-1"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: {editingItem?.quantity || 0} (ordered quantity)
                  </p>
                </div>
                <div>
                  <Label htmlFor="item-rate" className="text-sm font-medium text-gray-700">
                    Rate *
                  </Label>
                  <Input
                    id="item-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemEditData.rate}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setItemEditData(prev => ({
                        ...prev,
                        rate: value
                      }));
                    }}
                    disabled={isProcessing}
                    className="mt-1"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Rate per unit
                  </p>
                </div>

                {/* UOM Selection */}
                {itemEditData.action === 'approve' && editingItem?.stock_item_id && stockItemPricing && (stockItemPricing.base_unit || stockItemPricing.alternate_unit) && (
                  <div>
                    <Label htmlFor="item-uom" className="text-sm font-medium text-gray-700">
                      Unit of Measurement
                    </Label>
                    <Select
                      value={itemEditData.base_unit_id?.toString() || editingItem.base_unit?.id?.toString() || "none"}
                      onValueChange={async (value) => {
                        if (value === "none") {
                          setItemEditData(prev => ({ ...prev, base_unit_id: null }));
                          return;
                        }

                        const selectedUnitId = parseInt(value);
                        setItemEditData(prev => ({ ...prev, base_unit_id: selectedUnitId }));

                        // Update price based on selected UOM
                        if (stockItemPricing) {
                          const baseUnitId = stockItemPricing.base_unit?.id;
                          const alternateUnitId = stockItemPricing.alternate_unit?.id;

                          if (selectedUnitId === baseUnitId && stockItemPricing.base_unit?.price !== undefined) {
                            setItemEditData(prev => ({
                              ...prev,
                              base_unit_id: selectedUnitId,
                              rate: parseFloat(parseFloat(stockItemPricing.base_unit.price).toFixed(2))
                            }));
                          } else if (selectedUnitId === alternateUnitId && stockItemPricing.alternate_unit?.price !== undefined) {
                            setItemEditData(prev => ({
                              ...prev,
                              base_unit_id: selectedUnitId,
                              rate: parseFloat(parseFloat(stockItemPricing.alternate_unit.price).toFixed(2))
                            }));
                          }
                        }
                      }}
                      disabled={isProcessing || isLoadingPricing}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select UOM">
                          {(() => {
                            const currentUnitId = itemEditData.base_unit_id || editingItem.base_unit?.id;
                            if (currentUnitId === stockItemPricing?.base_unit?.id) {
                              return stockItemPricing.base_unit.name;
                            } else if (currentUnitId === stockItemPricing?.alternate_unit?.id) {
                              return stockItemPricing.alternate_unit.name;
                            }
                            return editingItem.base_unit?.name || 'Select UOM';
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {stockItemPricing?.base_unit && stockItemPricing.base_unit.id != null && (
                          <SelectItem value={String(stockItemPricing.base_unit.id)}>
                            {stockItemPricing.base_unit.name}
                            {stockItemPricing.base_unit.price !== undefined && ` (${parseFloat(stockItemPricing.base_unit.price).toFixed(2)})`}
                          </SelectItem>
                        )}
                        {stockItemPricing?.alternate_unit && stockItemPricing.alternate_unit.id != null && (
                          <SelectItem value={String(stockItemPricing.alternate_unit.id)}>
                            {stockItemPricing.alternate_unit.name}
                            {stockItemPricing.alternate_unit.price !== undefined && ` (${parseFloat(stockItemPricing.alternate_unit.price).toFixed(2)})`}
                          </SelectItem>
                        )}
                        {stockItemPricing?.unit_of_measurement &&
                          stockItemPricing.unit_of_measurement.id != null &&
                          stockItemPricing.unit_of_measurement.id !== stockItemPricing.base_unit?.id &&
                          stockItemPricing.unit_of_measurement.id !== stockItemPricing.alternate_unit?.id && (
                            <SelectItem value={String(stockItemPricing.unit_of_measurement.id)}>
                              {stockItemPricing.unit_of_measurement.name}
                            </SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                    {stockItemPricing?.conversion && stockItemPricing.conversion !== 1.0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Conversion: {parseFloat(stockItemPricing.conversion).toFixed(2)}x
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Action Remarks */}
            <div>
              <Label htmlFor="item-action-remarks" className="text-sm font-medium text-gray-700">
                {itemEditData.action === 'approve' ? 'Remarks (Optional)' : 'Rejection Reason *'}
              </Label>
              <Textarea
                id="item-action-remarks"
                placeholder={itemEditData.action === 'approve'
                  ? 'Enter any remarks for approval...'
                  : 'Please provide reason for rejection...'}
                value={itemEditData.action_remarks}
                onChange={(e) => setItemEditData(prev => ({ ...prev, action_remarks: e.target.value }))}
                rows={4}
                disabled={isProcessing}
                className="mt-1"
                required={itemEditData.action === 'reject'}
              />
              {itemEditData.action === 'reject' && (
                <p className="text-xs text-gray-500 mt-1">
                  This field is required for rejection.
                </p>
              )}
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (!isProcessing) {
                    setIsItemEditModalOpen(false);
                    setEditingItem(null);
                    setItemEditData({ item_id: null, approved_quantity: 0, rate: 0, action_remarks: "", action: "" });
                  }
                }}
                className="flex-1"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleItemApproveRejectSubmit}
                disabled={
                  isProcessing ||
                  (itemEditData.action === 'reject' && !itemEditData.action_remarks.trim()) ||
                  (itemEditData.action === 'approve' && itemEditData.approved_quantity <= 0)
                }
                className={`flex-1 ${itemEditData.action === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {itemEditData.action === 'approve' ? 'Approve Item' : 'Reject Item'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Modal (Order-level) */}
      <Dialog open={isApproveRejectModalOpen} onOpenChange={(open) => {
        if (!open && !isProcessing) {
          setIsApproveRejectModalOpen(false);
          resetApproveRejectForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MoreVertical className="h-5 w-5" />
              <span>Sales Order Action</span>
            </DialogTitle>
            <DialogDescription>
              Choose to approve or reject this sales order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Order Information */}
            {selectedOrderForAction && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Order Number:</strong> {selectedOrderForAction.so_number}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Customer:</strong> {selectedOrderForAction.customer_name || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Status:</strong> {selectedOrderForAction.status || 'N/A'}
                </p>
              </div>
            )}

            {/* Toggle Switch for Approve/Reject */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center space-x-3">
                {actionType === 'approve' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    {actionType === 'approve' ? 'Approve' : 'Reject'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {actionType === 'approve'
                      ? 'Approve this sales order'
                      : 'Reject this sales order'}
                  </p>
                </div>
              </div>
              <Switch
                checked={actionType === 'approve'}
                onCheckedChange={(checked) => {
                  setActionType(checked ? 'approve' : 'reject');
                  if (!checked) {
                    setActionRemarks(""); // Clear remarks when switching to reject
                  }
                }}
                disabled={isProcessing}
              />
            </div>

            {/* Action Remarks */}
            <div>
              <Label htmlFor="action-remarks" className="text-sm font-medium text-gray-700">
                {actionType === 'approve' ? 'Remarks (Optional)' : 'Rejection Reason *'}
              </Label>
              <Textarea
                id="action-remarks"
                placeholder={actionType === 'approve'
                  ? 'Enter any remarks for approval...'
                  : 'Please provide reason for rejection...'}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                rows={4}
                disabled={isProcessing}
                className="mt-1"
                required={actionType === 'reject'}
              />
              {actionType === 'reject' && (
                <p className="text-xs text-gray-500 mt-1">
                  This field is required for rejection.
                </p>
              )}
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (!isProcessing) {
                    setIsApproveRejectModalOpen(false);
                    resetApproveRejectForm();
                  }
                }}
                className="flex-1"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveRejectSubmit}
                disabled={
                  isProcessing ||
                  (actionType === 'reject' && !actionRemarks.trim())
                }
                className={`flex-1 ${actionType === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionType === 'approve' ? 'Approve' : 'Reject'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ledger Selection Dialog for Tally Sync */}
      <Dialog open={isLedgerDialogOpen} onOpenChange={setIsLedgerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" aria-describedby="ledger-dialog-description">
          <DialogHeader className="shrink-0">
            <DialogTitle>Select Ledger and Voucher Type for Tally Sync</DialogTitle>
            <DialogDescription id="ledger-dialog-description">
              Select a voucher type first (required), then optionally a sales ledger. You can sync without a ledger.
              {orderToSync && (
                <span className="block mt-1 font-medium">
                  Sales Order: {orderToSync.so_number}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-y-auto">
            {/* 1. Voucher Type (required) - first */}
            <div className="space-y-2 shrink-0">
              <Label className="text-sm font-medium text-gray-700">
                Voucher Type <span className="text-red-500">(required)</span>
              </Label>
              {!selectedVoucherType ? (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 p-2.5 backdrop-blur-sm">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search voucher types by name..."
                        value={voucherTypeSearchTerm}
                        onChange={(e) => setVoucherTypeSearchTerm(e.target.value)}
                        className="h-9 border-gray-200 bg-white pl-9 shadow-none focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto">
                    {isLoadingVoucherTypes ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Loading voucher types...</span>
                      </div>
                    ) : filteredVoucherTypes && filteredVoucherTypes.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {filteredVoucherTypes.map((voucherType) => (
                          <button
                            key={voucherType.id}
                            type="button"
                            onClick={() => setSelectedVoucherType(voucherType)}
                            className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-blue-50/70 focus:bg-blue-50 focus:outline-none"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-gray-900">
                                {voucherType.display_name || voucherType.name}
                              </p>
                              {voucherType.parent && (
                                <p className="mt-0.5 truncate text-xs text-gray-500">
                                  Parent: {voucherType.parent}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : voucherTypesError ? (
                      <div className="flex items-center justify-center py-8 text-sm text-red-500">
                        <span>Error loading voucher types. Please try again.</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                        {voucherTypeSearchTerm
                          ? "No voucher types found matching your search"
                          : "No voucher types available"}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-900">Selected Voucher Type:</p>
                    <p className="truncate font-semibold text-green-700">
                      {selectedVoucherType.display_name || selectedVoucherType.name}
                    </p>
                    {selectedVoucherType.parent && (
                      <p className="mt-0.5 text-sm text-green-600">
                        Parent: {selectedVoucherType.parent}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setSelectedVoucherType(null);
                      setVoucherTypeSearchTerm("");
                    }}
                    disabled={syncSalesOrderMutation.isPending}
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

           

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2 shrink-0 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsLedgerDialogOpen(false);
                  setSelectedLedger(null);
                  setLedgerSearchTerm("");
                  setOrderToSync(null);
                  setVoucherTypeName("SALES ORDER VAN");
                  setSelectedVoucherType(null);
                  setVoucherTypeSearchTerm("");
                }}
                disabled={syncSalesOrderMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLedgerSelectAndSync}
                disabled={!selectedVoucherType || syncSalesOrderMutation.isPending}
                className="flex items-center gap-2"
              >
                {syncSalesOrderMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Sync to Tally</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Sales Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sales Order - {orderToEdit?.so_number}</DialogTitle>
            <DialogDescription>
              Update customer, address, or branch. Only pending orders can be edited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {editFormData.customer_id && customersData
                      ? customersData.find((c) => c.id === editFormData.customer_id)?.name || "Select customer..."
                      : "Select customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Search customers..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {customersData && customersData.length > 0 ? (
                      customersData
                        .filter((customer) =>
                          customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase())
                        )
                        .map((customer) => (
                          <div
                            key={customer.id}
                            className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              setEditFormData({ ...editFormData, customer_id: customer.id });
                            }}
                          >
                            {customer.name}
                          </div>
                        ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-gray-500">No customers found</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                placeholder="Enter address"
                rows={3}
              />
            </div>

            {/* Branch Selection */}
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select
                value={editFormData.branch_id?.toString() || "none"}
                onValueChange={(value) => setEditFormData({ ...editFormData, branch_id: value === "none" ? null : parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {branchesData?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setOrderToEdit(null);
                  setEditFormData({
                    customer_id: null,
                    address: "",
                    branch_id: null
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!editFormData.customer_id) {
                    toast({
                      title: "Validation Error",
                      description: "Please select a customer",
                      variant: "destructive",
                    });
                    return;
                  }
                  const updateData = {};
                  if (editFormData.customer_id) updateData.customer_id = editFormData.customer_id;
                  if (editFormData.address !== undefined) updateData.address = editFormData.address;
                  if (editFormData.branch_id) updateData.branch_id = editFormData.branch_id;

                  updateSalesOrderMutation.mutate({
                    soNumber: orderToEdit.so_number,
                    updateData
                  });
                }}
                disabled={updateSalesOrderMutation.isPending}
              >
                {updateSalesOrderMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog
        open={isImageDialogOpen}
        onOpenChange={(open) => {
          setIsImageDialogOpen(open);
          if (!open) setIsDragging(false);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          {selectedImage && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle className="flex items-center space-x-2">
                  <Image className="h-5 w-5" />
                  <span>{selectedImage.type_display || selectedImage.type || "Image"}</span>
                </DialogTitle>
              </DialogHeader>

              <div
                className="relative flex items-center justify-center bg-black/50 p-6 min-h-[400px] max-h-[70vh] overflow-hidden cursor-move"
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
                    src={selectedImage.image_url}
                    alt={selectedImage.type_display || selectedImage.type || "Image"}
                    className="max-w-full max-h-[70vh] object-contain select-none"
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
                    variant="outline"
                    size="sm"
                    onClick={() => setImageZoom((prev) => Math.min(3, prev + 0.25))}
                    disabled={imageZoom >= 3}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Zoom In
                  </Button>
                  <Button
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
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedImage.image_url, "_blank")}
                >
                  Open in New Tab
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove sales order{" "}
              <strong>{orderToDelete?.so_number}</strong> from active records. This action is only
              allowed when no outward entry has been created for this order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteSalesOrderMutation.isPending}
              onClick={() => setOrderToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteSalesOrderMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteSalesOrder();
              }}
            >
              {deleteSalesOrderMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Loader isLoading={isLoading} text="Loading sales orders" />
    </div>
  );
}