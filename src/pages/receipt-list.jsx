import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useLocation } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import { formatMoneyDisplay, roundMoney } from "../utils/moneyUtils";
import { useDebounce } from "../hooks/use-debounce";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Settings,
  Menu,
  Search,
  Eye,
  FileText,
  Calendar,
  Filter,
  DollarSign,
  User,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  Loader2,
  Plus,
  ArrowLeft,
  CreditCard,
  Smartphone,
  Banknote,
  CheckSquare,
  IndianRupee,
  Pencil,
  ChevronsUpDown,
  Check,
  AlertCircle,
  X,
  Image,
  Minus,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');
const RECEIPT_LIST_DEFAULT_PRESET = "today";

const getInitialReceiptListFilters = () => {
  const params = new URLSearchParams(window.location.search);
  const today = getTodayStr();
  const from = params.get("from_date") || today;
  const to = params.get("to_date") || today;
  const urlPreset = params.get("date_range");
  const hasUrlDates = !!(params.get("from_date") && params.get("to_date"));
  const allowedPresets = new Set(["today", "weekly", "monthly", "custom"]);
  const dateRangePreset = allowedPresets.has(urlPreset)
    ? urlPreset
    : (hasUrlDates ? "custom" : RECEIPT_LIST_DEFAULT_PRESET);

  const pageParam = parseInt(params.get("page") || "1", 10);
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  return {
    fromDate: from,
    toDate: to,
    dateRangePreset,
    searchTerm: params.get("search") || "",
    paymentTypeFilter: params.get("payment_type") || "all",
    tallySyncFilter: params.get("tally_sync") || "all",
    customerFilters: (params.get("customer_ids") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    salesmanFilter: (params.get("salesman_ids") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    currentPage,
  };
};

const COLUMN_DEFS = [
  { key: "receiptId", label: "Receipt ID", cellClass: "whitespace-nowrap font-medium text-slate-900" },
  { key: "customer", label: "Customer", cellClass: "max-w-[260px]" },
  { key: "branch", label: "Branch", cellClass: "whitespace-nowrap" },
  { key: "amount", label: "Paid amount", align: "right", cellClass: "whitespace-nowrap text-right font-semibold tabular-nums text-green-600" },
  { key: "date", label: "Date", cellClass: "whitespace-nowrap text-slate-600" },
  { key: "createdBy", label: "Created by", cellClass: "whitespace-nowrap" },
  { key: "payments", label: "Payments", align: "right", cellClass: "text-right tabular-nums" },
  { key: "tally", label: "Tally", requiresTally: true, cellClass: "" },
  { key: "reference", label: "Reference", cellClass: "max-w-[220px]" },
  { key: "remarks", label: "Remarks", cellClass: "max-w-[260px]" },
];
const DEFAULT_VISIBLE_COLUMNS = ["receiptId", "customer", "amount", "date", "createdBy", "tally"];
const COLUMN_STORAGE_KEY = "receipt-list-visible-columns";

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

export default function ReceiptList() {
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
  const [location, setLocation] = useLocation();
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const initialFilterValues = getInitialReceiptListFilters();
  const [searchTerm, setSearchTerm] = useState(initialFilterValues.searchTerm);
  // Debounced copy of searchTerm: the input updates instantly, the API is called after a short pause.
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState((initialFilterValues.searchTerm || "").trim());
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm((searchTerm || "").trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  // State for sync to tally dialog
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [receiptToSync, setReceiptToSync] = useState(null);
  const [selectedVoucherType, setSelectedVoucherType] = useState(null);
  const [voucherTypeSearchTerm, setVoucherTypeSearchTerm] = useState("");
  const [bankLedgerName, setBankLedgerName] = useState("");
  const [bankLedgerSearchTerm, setBankLedgerSearchTerm] = useState("");
  const [bankLedgerDropdownOpen, setBankLedgerDropdownOpen] = useState(false);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState(initialFilterValues.paymentTypeFilter);
  const [tallySyncFilter, setTallySyncFilter] = useState(initialFilterValues.tallySyncFilter);
  const [customerFilters, setCustomerFilters] = useState(initialFilterValues.customerFilters); // Multi-select: array of customer IDs (strings)
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [salesmanFilter, setSalesmanFilter] = useState(initialFilterValues.salesmanFilter);
  const [salesmanDropdownOpen, setSalesmanDropdownOpen] = useState(false);
  const now = new Date();
  const [fromDate, setFromDate] = useState(initialFilterValues.fromDate);
  const [toDate, setToDate] = useState(initialFilterValues.toDate);
  const [dateRangePreset, setDateRangePreset] = useState(initialFilterValues.dateRangePreset); // "today" | "weekly" | "monthly" | "custom"
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(initialFilterValues.currentPage);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [pageSize] = useState(20);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const isMobile = useIsMobile();

  // Apply date range preset when dropdown changes
  useEffect(() => {
    const n = new Date();
    if (dateRangePreset === "today") {
      setFromDate(format(startOfDay(n), 'yyyy-MM-dd'));
      setToDate(format(endOfDay(n), 'yyyy-MM-dd'));
    } else if (dateRangePreset === "weekly") {
      setFromDate(format(startOfWeek(n, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setToDate(format(endOfWeek(n, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (dateRangePreset === "monthly") {
      setFromDate(format(startOfMonth(n), 'yyyy-MM-dd'));
      setToDate(format(endOfMonth(n), 'yyyy-MM-dd'));
    }
  }, [dateRangePreset]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("date_range", dateRangePreset);
    if (fromDate) params.set("from_date", fromDate);
    else params.delete("from_date");
    if (toDate) params.set("to_date", toDate);
    else params.delete("to_date");

    if (searchTerm?.trim()) params.set("search", searchTerm.trim());
    else params.delete("search");

    if (paymentTypeFilter && paymentTypeFilter !== "all") params.set("payment_type", paymentTypeFilter);
    else params.delete("payment_type");

    if (tallySyncFilter && tallySyncFilter !== "all") params.set("tally_sync", tallySyncFilter);
    else params.delete("tally_sync");

    if (customerFilters.length > 0) params.set("customer_ids", customerFilters.join(","));
    else params.delete("customer_ids");

    if (salesmanFilter.length > 0) params.set("salesman_ids", salesmanFilter.join(","));
    else params.delete("salesman_ids");

    if (currentPage > 1) params.set("page", String(currentPage));
    else params.delete("page");

    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [
    dateRangePreset,
    fromDate,
    toDate,
    searchTerm,
    paymentTypeFilter,
    tallySyncFilter,
    customerFilters,
    salesmanFilter,
    currentPage,
  ]);

  const queryClient = useQueryClient();
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

  // Fetch customers
  const fetchCustomers = async () => {
    const params = new URLSearchParams();
    params.append('per_page', '1000'); // Load more customers for client-side filtering

    const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/get-customers/?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch customers');
    }

    const data = await response.json();
    return data.data || [];
  };

  const {
    data: customers,
    isLoading: customersLoading,
  } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch salesmen from API (always fetch when salesman filter is used, so receipts can filter by name)
  const { data: salesmenData = [], isLoading: salesmenLoading } = useQuery({
    queryKey: ['salesmen'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/?role_id=7`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && (salesmanDropdownOpen || salesmanFilter.length > 0),
    refetchOnWindowFocus: false,
  });

  const isMultiCustomer = Array.isArray(customerFilters) && customerFilters.length >= 1;
  const isMultiSalesman = Array.isArray(salesmanFilter) && salesmanFilter.length >= 1;

  // Build query parameters for API call (no multi-select params when multi - we fetch per item and merge)
  const buildQueryParams = (opts = {}) => {
    const { customerId = null, salesmanId = null, page = currentPage, pageSize: ps = pageSize } = opts;
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', ps.toString());
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (paymentTypeFilter && paymentTypeFilter !== 'all') params.append('payment_type', paymentTypeFilter);
    if (isTallyEnabled && tallySyncFilter && tallySyncFilter !== 'all') params.append('is_tally_synced', tallySyncFilter);
    if (customerId) params.append('customer_id', customerId);
    else if (!isMultiCustomer && customerFilters?.length === 1) params.append('customer_id', customerFilters[0]);
    if (salesmanId) params.append('salesman_id', salesmanId);
    else if (!isMultiSalesman && salesmanFilter?.length === 1) params.append('salesman_id', salesmanFilter[0]);
    if (debouncedSearchTerm) {
      if (debouncedSearchTerm.match(/^REC\d+$/)) params.append('receipt_id', debouncedSearchTerm);
      else params.append('customer_name', debouncedSearchTerm);
    }
    return params.toString();
  };

  // Fetch receipts from API
  const { data: receiptsData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [`receipts`, fromDate, toDate, paymentTypeFilter, tallySyncFilter, [...customerFilters].sort().join(','), [...salesmanFilter].sort().join(','), (isMultiCustomer || isMultiSalesman) ? null : currentPage, debouncedSearchTerm],
    queryFn: async () => {
      if (isMultiCustomer || isMultiSalesman) {
        // API doesn't support multi-select: fetch per customer/salesman, merge, filter client-side
        const PER_FETCH_LIMIT = 500;
        let promises = [];

        if (isMultiCustomer && isMultiSalesman) {
          promises = salesmanFilter.map((salesmanId) => {
            const q = buildQueryParams({ salesmanId, page: 1, pageSize: PER_FETCH_LIMIT });
            return apiRequest('GET', `${API_BASE_URL}/api/accounts/receipts/?${q}`).then((r) => r.json());
          });
        } else if (isMultiCustomer) {
          promises = customerFilters.map((custId) => {
            const q = buildQueryParams({ customerId: custId, page: 1, pageSize: PER_FETCH_LIMIT });
            return apiRequest('GET', `${API_BASE_URL}/api/accounts/receipts/?${q}`).then((r) => r.json());
          });
        } else {
          promises = salesmanFilter.map((salesmanId) => {
            const q = buildQueryParams({ salesmanId, page: 1, pageSize: PER_FETCH_LIMIT });
            return apiRequest('GET', `${API_BASE_URL}/api/accounts/receipts/?${q}`).then((r) => r.json());
          });
        } 

        const results = await Promise.all(promises);
        const seen = new Set();
        let merged = [];
        for (const res of results) {
          const items = res.data || [];
          for (const r of items) {
            const rid = r.receipt_id;
            if (rid && !seen.has(rid)) {
              seen.add(rid);
              merged.push(r);
            }
          }
        }
        // Client-side filter: API may not support multi-select or may ignore params.
        // Customer filter uses customer_id which receipts always have.
        // Salesman filter: we already pass salesman_id in each API call; rely on API for filtering.
        // If receipt has created_by/salesman_id, apply extra client-side filter as fallback.
        if (customerFilters.length > 0) {
          const custSet = new Set(customerFilters.map(String));
          merged = merged.filter((r) => custSet.has(String(r.customer_id)));
        }
        if (salesmanFilter.length > 0) {
          const salesmanSet = new Set(salesmanFilter.map(String));
          // Receipts may only have created_by_name (display name), not created_by (user id) - fetch salesmen to filter by name
          const salesmenList = await queryClient.fetchQuery({
            queryKey: ['salesmen'],
            queryFn: async () => {
              const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/`);
              const data = await response.json();
              return data.data || [];
            },
          }) || [];
          const selectedNames = new Set(
            (salesmenList || [])
              .filter((s) => salesmanSet.has(String(s.user_id)))
              .map((s) => (s.name || '').trim().toLowerCase())
              .filter(Boolean)
          );
          merged = merged.filter((r) => {
            const rid = r.created_by != null ? String(r.created_by) : (r.salesman_id != null ? String(r.salesman_id) : (r.created_by_id != null ? String(r.created_by_id) : null));
            if (rid && salesmanSet.has(rid)) return true; // Match by user id
            const name = (r.created_by_name || '').trim().toLowerCase();
            if (name && selectedNames.has(name)) return true; // Match by display name (receipts often only have this)
            if (!rid && !name) return true; // No salesman info - include (rely on API)
            return false; // Has salesman info but doesn't match selected salesmen
          });
        }
        merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const total = merged.length;
        const tp = Math.max(1, Math.ceil(total / pageSize));

        return {
          data: merged,
          pagination: {
            total_count: total,
            total_pages: tp,
            current_page: 1,
            page_size: pageSize,
            has_next: tp > 1,
            has_previous: false,
          },
          _multiSelectMode: true,
        };
      }

      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/accounts/receipts/${queryParams ? `?${queryParams}` : ''}`;
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    keepPreviousData: true, // react-query v4
    placeholderData: (previousData) => previousData, // react-query v5
  });

  // Go back to page 1 when the (debounced) search changes, but not on first mount.
  const prevSearchRef = React.useRef(debouncedSearchTerm);
  useEffect(() => {
    if (prevSearchRef.current !== debouncedSearchTerm) {
      prevSearchRef.current = debouncedSearchTerm;
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  // Fetch detailed receipt when viewing details
  const { data: receiptDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: [`receipt-detail`, selectedReceipt?.receipt_id],
    queryFn: async () => {
      if (!selectedReceipt?.receipt_id) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/accounts/receipts/${selectedReceipt.receipt_id}/`);
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!selectedReceipt?.receipt_id && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch voucher types for receipts
  const { data: voucherTypesData, isLoading: isLoadingVoucherTypes, error: voucherTypesError } = useQuery({
    queryKey: ['receipt-voucher-types'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/get-voucher-types/`);
        const data = await response.json();
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
    enabled: isSyncDialogOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const filteredCustomers = useMemo(() => {
    if (!customers || !Array.isArray(customers)) return [];
    if (!customerSearchTerm.trim()) return customers;
    const term = customerSearchTerm.toLowerCase().trim();
    return customers.filter((c) =>
      (c.name && String(c.name).toLowerCase().includes(term)) ||
      (c.parent && String(c.parent).toLowerCase().includes(term))
    );
  }, [customers, customerSearchTerm]);

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

  // Debounce bank ledger search term
  const debouncedBankLedgerSearch = useDebounce(bankLedgerSearchTerm, 500);

  // Fetch bank/cash ledgers from get-ledgers API
  const { data: bankLedgersData, isLoading: isLoadingBankLedgers } = useQuery({
    queryKey: ['bank-ledgers', debouncedBankLedgerSearch],
    queryFn: async () => {
      if (!debouncedBankLedgerSearch || !debouncedBankLedgerSearch.trim()) {
        return { data: [], pagination: {} };
      }
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('per_page', '50');
      params.append('search', debouncedBankLedgerSearch.trim());
      
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bank ledgers');
      }
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken() && bankLedgerDropdownOpen && !!debouncedBankLedgerSearch && debouncedBankLedgerSearch.trim().length > 0,
    refetchOnWindowFocus: false,
  });

  const bankLedgers = bankLedgersData?.data || [];

  // Sync receipt to Tally mutation
  const syncReceiptMutation = useMutation({
    mutationFn: async ({ receiptId, voucherTypeName, bankLedgerName }) => {
      const payload = {
        receipt_id: receiptId,
        voucher_type_name: voucherTypeName,
      };
      // Only include bank_ledger_name if it's provided (for non-cash payments)
      if (bankLedgerName && bankLedgerName.trim()) {
        payload.bank_ledger_name = bankLedgerName.trim();
      }
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/sync-receipt-to-tally/`, payload);
      return response.json();
    },
    onSuccess: async (data, variables) => {
      toast({
        title: "Success",
        description: data.message || "Receipt synced successfully to Tally",
        variant: "success",
      });

      // Close dialog and reset state
      setIsSyncDialogOpen(false);
      setReceiptToSync(null);
      setSelectedVoucherType(null);
      setVoucherTypeSearchTerm("");
      setBankLedgerName("");

      // Close the detail modal to show the list
      setIsDetailModalOpen(false);
      setSelectedReceipt(null);

      // Invalidate and refetch receipts list
      await queryClient.invalidateQueries({ queryKey: ['receipts'], exact: false });
      await refetch();
    },
    onError: (error) => {
      const errorMessage = error.message || "Failed to sync receipt to Tally";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: async (receiptId) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/delete-receipt/${encodeURIComponent(receiptId)}/`);
      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to delete receipt");
      }
      return data;
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: data?.message || "Receipt deleted successfully",
        variant: "success",
      });
      setIsDeleteDialogOpen(false);
      setReceiptToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['receipts'], exact: false });
      await refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete receipt",
        variant: "destructive",
      });
    },
  });

  const handleDeleteReceipt = (receipt) => {
    if (!receipt?.receipt_id) return;
    setReceiptToDelete(receipt);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!receiptToDelete?.receipt_id) return;
    deleteReceiptMutation.mutate(receiptToDelete.receipt_id);
  };

  // Handle sync button click
  const handleSyncClick = (receipt) => {
    if (!receipt?.receipt_id) {
      toast({
        title: "Error",
        description: "Receipt ID is required",
        variant: "destructive",
      });
      return;
    }
    setReceiptToSync(receipt);
    setSelectedVoucherType(null);
    setVoucherTypeSearchTerm("");
    setBankLedgerName(""); // Reset bank ledger name
    setBankLedgerSearchTerm(""); // Reset bank ledger search
    setBankLedgerDropdownOpen(false);
    setIsSyncDialogOpen(true);
  };

  // Handle sync with selected voucher type
  const handleSyncToTally = () => {
    if (!receiptToSync?.receipt_id) {
      toast({
        title: "Error",
        description: "Receipt ID is required",
        variant: "destructive",
      });
      return;
    }
    if (!selectedVoucherType) {
      toast({
        title: "Error",
        description: "Please select a voucher type",
        variant: "destructive",
      });
      return;
    }
    
    if (!bankLedgerName?.trim()) {
      toast({
        title: "Error",
        description: "Please enter or select a bank ledger name",
        variant: "destructive",
      });
      return;
    }
    
    const voucherTypeName = selectedVoucherType.display_name || selectedVoucherType.name;
    syncReceiptMutation.mutate({
      receiptId: receiptToSync.receipt_id,
      voucherTypeName: voucherTypeName,
      bankLedgerName: bankLedgerName.trim(),
    });
  };

  const allReceipts = receiptsData?.data || [];
  const isMultiSelectMode = !!receiptsData?._multiSelectMode;
  const receipts = React.useMemo(() => {
    if (!isMultiSelectMode) return allReceipts;
    const start = (currentPage - 1) * pageSize;
    return allReceipts.slice(start, start + pageSize);
  }, [allReceipts, isMultiSelectMode, currentPage, pageSize]);
  const totalCount = receiptsData?.pagination?.total_count || allReceipts.length;
  const totalPages = isMultiSelectMode
    ? Math.max(1, Math.ceil(totalCount / pageSize))
    : (receiptsData?.pagination?.total_pages || 1);
  const hasNext = isMultiSelectMode ? currentPage < totalPages : (receiptsData?.pagination?.has_next || false);
  const hasPrevious = isMultiSelectMode ? currentPage > 1 : (receiptsData?.pagination?.has_previous || false);

  // Calculate summary statistics (use allReceipts for totals when multi-select paginated)
  const summaryStats = React.useMemo(() => {
    const base = isMultiSelectMode ? allReceipts : receipts;
    const totalAmount = base.reduce((sum, receipt) => sum + (roundMoney(receipt.total_paid_amount) || 0), 0);
    const totalSynced = base.filter(receipt => receipt.is_tally_synced === true).length;
    const uniqueSalesmen = new Set(base.map(receipt => receipt.created_by_name).filter(Boolean)).size;

    return {
      totalReceipts: totalCount,
      totalAmount,
      totalSynced,
      totalSalesmen: uniqueSalesmen
    };
  }, [receipts, allReceipts, isMultiSelectMode, totalCount]);

  const handleViewDetails = (receipt) => {
    setSelectedReceipt(receipt);
    setIsDetailModalOpen(true);
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

  const handleDateFilterChange = () => {
    setCurrentPage(1);
    refetch();
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Handle multiple salesman selection
  const handleCustomerToggle = (customerId) => {
    const idStr = customerId.toString();
    setCustomerFilters((prev) => {
      const isSelected = prev.includes(idStr);
      if (isSelected) return prev.filter((id) => id !== idStr);
      return [...prev, idStr];
    });
    setCurrentPage(1);
  };
  const handleSelectAllCustomers = () => setCustomerFilters((customers || []).map((c) => c.id.toString()));
  const handleClearAllCustomers = () => { setCustomerFilters([]); setCurrentPage(1); };

  const handleSalesmanToggle = (salesmanId) => {
    const newSalesmanFilter = salesmanFilter.includes(salesmanId)
      ? salesmanFilter.filter(id => id !== salesmanId)
      : [...salesmanFilter, salesmanId];

    setSalesmanFilter(newSalesmanFilter);
    setCurrentPage(1);
    // The query will automatically refetch because salesmanFilter is in the queryKey
  };

  const handleRemoveSalesman = (salesmanId) => {
    const newSalesmanFilter = salesmanFilter.filter(id => id !== salesmanId);
    setSalesmanFilter(newSalesmanFilter);
    setCurrentPage(1);
  };
  const handleClearAllSalesmen = () => {
    setSalesmanFilter([]);
    setSalesmanDropdownOpen(false);
    setCurrentPage(1);
  };

  const getPaymentTypeIcon = (paymentType) => {
    switch (paymentType) {
      case 'CASH': return <Banknote className="h-4 w-4" />;
      case 'UPI': return <Smartphone className="h-4 w-4" />;
      case 'CHEQUE': return <FileText className="h-4 w-4" />;
      case 'IMPS': return <CreditCard className="h-4 w-4" />;
      case 'NEFT': return <CreditCard className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPaymentTypeBadgeVariant = (paymentType) => {
    switch (paymentType) {
      case 'CASH': return 'default';
      case 'UPI': return 'secondary';
      case 'CHEQUE': return 'outline';
      case 'IMPS': return 'secondary';
      case 'NEFT': return 'secondary';
      default: return 'outline';
    }
  };

  const formatCurrency = (amount) => formatMoneyDisplay(amount);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'dd-MM-yyyy');
    } catch {
      return dateString;
    }
  };

  // Filter out null values from payment_details object
  const filterNonNullPaymentDetails = (paymentDetails) => {
    if (!paymentDetails || typeof paymentDetails !== 'object') {
      return {};
    }
    const filtered = {};
    Object.keys(paymentDetails).forEach(key => {
      if (paymentDetails[key] !== null && paymentDetails[key] !== undefined && paymentDetails[key] !== '') {
        filtered[key] = paymentDetails[key];
      }
    });
    return filtered;
  };

  // Full-page loader only for the very first load, so the search input keeps focus while typing.
  if (isLoading && !receiptsData) {
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

  if (!hasReadPermission("receipt_management")) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Receipt className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view receipt reports. Contact your administrator for access.
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
    { label: "Total receipts", value: summaryStats.totalReceipts, icon: Receipt, tone: "bg-blue-50 text-blue-600" },
    { label: "Total amount", value: formatCurrency(summaryStats.totalAmount), icon: IndianRupee, tone: "bg-green-50 text-green-600" },
    ...(isTallyEnabled
      ? [{ label: "Total synced", value: summaryStats.totalSynced, icon: CheckSquare, tone: "bg-purple-50 text-purple-600" }]
      : []),
    { label: "Total salesman", value: summaryStats.totalSalesmen, icon: User, tone: "bg-orange-50 text-orange-600" },
  ];

  const thClass = "h-10 whitespace-nowrap px-4 text-xs font-medium text-slate-500";
  const tdClass = "px-4 py-2.5";
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

  const renderCell = (key, receipt) => {
    switch (key) {
      case "receiptId":
        return <span className="font-mono">{receipt.receipt_id}</span>;
      case "customer":
        return (
          <span className="block truncate text-slate-900" title={receipt.customer_name || undefined}>
            {receipt.customer_name || dash}
          </span>
        );
      case "branch":
        return receipt.branch_name || dash;
      case "amount":
        return formatCurrency(receipt.total_paid_amount);
      case "date":
        return formatDate(receipt.created_at);
      case "createdBy":
        return receipt.created_by_name || dash;
      case "payments":
        return receipt.payment_count > 0 ? receipt.payment_count : dash;
      case "tally":
        if (receipt.is_tally_synced) {
          return (
            <Badge variant="outline" className="whitespace-nowrap border-green-300 bg-green-100 text-xs text-green-800">
              Synced
            </Badge>
          );
        }
        if (receipt.is_tally_synced === false) {
          return (
            <Badge variant="outline" className="whitespace-nowrap border-gray-300 bg-gray-100 text-xs text-gray-700">
              Not Synced
            </Badge>
          );
        }
        return dash;
      case "reference":
        return (
          <span className="block truncate" title={receipt.reference_number || undefined}>
            {receipt.reference_number || dash}
          </span>
        );
      case "remarks":
        return (
          <span className="block truncate" title={receipt.remarks || undefined}>
            {receipt.remarks || dash}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
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
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">Receipt List</h1>
              <p className="truncate text-sm text-slate-500">View and manage receipt records</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant="outline" className="hidden text-sm font-normal md:inline-flex">
              <Calendar className="mr-1.5 h-4 w-4" />
              {new Date().toLocaleDateString('en-GB')}
            </Badge>
            {hasCreatePermission("receipt_management") && (
              <Button
                size="sm"
                onClick={() => setLocation('/add-receipt')}
                aria-label="Add receipt"
                className="h-9 gap-2 bg-black hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Receipt</span>
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
            {/* Summary */}
            <Card className="overflow-hidden shadow-sm">
              <div className={`grid grid-cols-2 gap-px bg-slate-200 ${isTallyEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
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

            {/* Filters */}
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                  <div className="lg:col-span-2">
                    <Label htmlFor="dateRangePreset" className="mb-1.5 block text-xs font-medium text-slate-600">Date Range</Label>
                    <Select
                      value={dateRangePreset}
                      onValueChange={(value) => {
                        setDateRangePreset(value);
                        setCurrentPage(1);
                      }}
                    >
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
                  <div className="lg:col-span-2">
                    <Label htmlFor="fromDate" className="mb-1.5 block text-xs font-medium text-slate-600">
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
                            setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                          }}
                          disabled={{ after: new Date() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="toDate" className="mb-1.5 block text-xs font-medium text-slate-600">
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
                  <div className="lg:col-span-2">
                    <Label htmlFor="customerFilter" className="mb-1.5 block text-xs font-medium text-slate-600">Customer</Label>
                    <Popover open={customerDropdownOpen} onOpenChange={(open) => { setCustomerDropdownOpen(open); if (!open) setCustomerSearchTerm(""); }}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerDropdownOpen}
                          className="h-9 w-full justify-between min-h-9 h-auto py-1.5 text-left"
                        >
                          <span className="flex flex-col items-stretch text-left flex-1 min-w-0 overflow-hidden">
                            {customerFilters?.length > 0 ? (
                              customerFilters.length === 1 ? (
                                <span className="block text-sm font-medium whitespace-normal break-words">
                                  {customers?.find((c) => c.id.toString() === customerFilters[0])?.name || customerFilters[0]}
                                </span>
                              ) : (
                                <span className="block text-sm font-medium">{customerFilters.length} customers selected</span>
                              )
                            ) : (
                              "All Customers"
                            )}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="min-w-[320px] max-w-[min(90vw,400px)] p-0 z-50"
                        align="start"
                        side="bottom"
                        sideOffset={4}
                      >
                        <div className="p-2 border-b flex items-center justify-between gap-2 flex-wrap">
                          <Input
                            placeholder="Search customers..."
                            value={customerSearchTerm}
                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            className="h-9 flex-1 min-w-[160px]"
                          />
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleSelectAllCustomers}>Select all</Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleClearAllCustomers}>Clear</Button>
                          </div>
                        </div>
                        <div className="py-1">
                          {customersLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Loading customers...
                            </div>
                          ) : filteredCustomers.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500">
                              {customers?.length === 0 ? "No customers found." : "No customers match your search."}
                            </div>
                          ) : (
                            <ScrollArea className="h-64">
                              <div
                                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-sm"
                                onClick={handleClearAllCustomers}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClearAllCustomers(); } }}
                                role="button"
                                tabIndex={0}
                              >
                                <Checkbox checked={customerFilters.length === 0} onCheckedChange={handleClearAllCustomers} className="border-gray-400" />
                                <div className="font-medium text-gray-900">All Customers</div>
                              </div>
                              {filteredCustomers.map((customer) => (
                                <div
                                  key={customer.id}
                                  className="flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-sm"
                                  onClick={() => handleCustomerToggle(customer.id)}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCustomerToggle(customer.id); } }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Checkbox
                                      checked={customerFilters.includes(customer.id.toString())}
                                      onCheckedChange={() => handleCustomerToggle(customer.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-gray-400 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-gray-900 whitespace-normal break-words">{customer.name}</div>
                                      {customer.parent && (
                                        <div className="text-sm text-gray-500 whitespace-normal break-words">{customer.parent}</div>
                                      )}
                                    </div>
                                  </div>
                                  {customer.state && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                                      {customer.state}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </ScrollArea>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="salesmanFilter" className="mb-1.5 block text-xs font-medium text-slate-600">Salesman</Label>
                    <Popover open={salesmanDropdownOpen} onOpenChange={setSalesmanDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={salesmanDropdownOpen}
                          className="h-9 w-full justify-between min-h-9 h-auto py-1.5 text-left"
                        >
                          {salesmanFilter.length > 0
                            ? `${salesmanFilter.length} salesmen selected`
                            : "All Salesmen"}
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
                          <CommandInput placeholder="Search salesmen..." />
                          <CommandList>
                            <CommandEmpty>
                              {salesmenLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Loading salesmen...
                                </div>
                              ) : (
                                "No salesmen found."
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                <CommandItem
                                  value="all"
                                  onSelect={handleClearAllSalesmen}
                                  className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <Checkbox checked={salesmanFilter.length === 0} onCheckedChange={handleClearAllSalesmen} className="border-gray-400" />
                                  <div className="font-medium text-gray-900">All Salesmen</div>
                                </CommandItem>
                                {salesmenData?.map((salesman) => (
                                  <CommandItem
                                    key={salesman.user_id}
                                    value={salesman.name}
                                    onSelect={() => handleSalesmanToggle(salesman.user_id)}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <Checkbox
                                        checked={salesmanFilter.includes(salesman.user_id)}
                                        onCheckedChange={() => handleSalesmanToggle(salesman.user_id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="border-gray-400 shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-gray-900 whitespace-normal break-words">{salesman.name}</div>
                                        {salesman.role_name && (
                                          <div className="text-sm text-gray-500 whitespace-normal break-words">{salesman.role_name}</div>
                                        )}
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
                  <div className="lg:col-span-2">
                    <Label htmlFor="paymentTypeFilter" className="mb-1.5 block text-xs font-medium text-slate-600">Payment Type</Label>
                    <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                      <SelectTrigger id="paymentTypeFilter" className="h-9">
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                        <SelectItem value="IMPS">IMPS Transfer</SelectItem>
                        <SelectItem value="NEFT">NEFT Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isTallyEnabled && (
                    <div className="lg:col-span-2">
                      <Label htmlFor="tallySyncFilter" className="mb-1.5 block text-xs font-medium text-slate-600">Tally Sync</Label>
                      <Select value={tallySyncFilter} onValueChange={setTallySyncFilter}>
                        <SelectTrigger id="tallySyncFilter" className="h-9">
                          <SelectValue placeholder="Select sync status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="true">Synced</SelectItem>
                          <SelectItem value="false">Not Synced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search by receipt ID (e.g., REC20241201001) or customer name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 pl-9 pr-16"
                    />
                    <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                      {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm("")}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                        >
                          <span className="sr-only">Clear search</span>
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleDateFilterChange} className="h-9 gap-2 bg-black hover:bg-gray-800">
                      <Search className="h-4 w-4" />
                      Apply filters
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        const now = new Date();
                        setDateRangePreset("today");
                        setFromDate(format(startOfDay(now), "yyyy-MM-dd"));
                        setToDate(format(endOfDay(now), "yyyy-MM-dd"));
                        setPaymentTypeFilter("all");
                        setTallySyncFilter("all");
                        setCustomerFilters([]);
                        setSalesmanFilter([]);
                        setSearchTerm("");
                        setCurrentPage(1);
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                </div>
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
                        placeholder="Search by receipt ID (e.g., REC20241201001) or customer name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card> */}

            {/* Receipts List */}
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  Receipts
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {totalCount}
                  </Badge>
                </h2>
              </div>

              {receipts.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <IndianRupee className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm text-slate-500">No receipts found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
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
                      {receipts.map((receipt) => (
                        <TableRow key={receipt.receipt_id}>
                          {activeColumns.map((col) => (
                            <TableCell key={col.key} className={`${tdClass} ${col.cellClass}`}>
                              {renderCell(col.key, receipt)}
                            </TableCell>
                          ))}
                          <TableCell className={tdClass}>
                            <div className="flex items-center justify-end gap-1.5">
                              {hasReadPermission("receipt_management") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(receipt)}
                                  title="View Details"
                                  aria-label="View Details"
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {hasUpdatePermission("receipt_management") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setLocation(`/update-receipt/${receipt.receipt_id}${window.location.search || ""}`)}
                                  title="Edit Receipt"
                                  aria-label="Edit Receipt"
                                  className="h-8 w-8 p-0"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {hasDeletePermission("receipt_management") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteReceipt(receipt)}
                                  disabled={deleteReceiptMutation.isPending}
                                  title="Delete Receipt"
                                  aria-label="Delete Receipt"
                                  className="h-8 w-8 border-red-200 p-0 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 sm:flex-row">
                  <div className="text-sm text-slate-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} receipts
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!hasPrevious}
                    >
                      Previous
                    </Button>
                    <span className="px-1 text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!hasNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (deleteReceiptMutation.isPending) return;
          setIsDeleteDialogOpen(open);
          if (!open) {
            setReceiptToDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-black text-white px-6 py-4 text-center">
            <DialogTitle className="text-lg font-semibold">Delete Receipt</DialogTitle>
          </div>
          <div className="px-6 py-5 space-y-4 text-center">
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to delete receipt{" "}
              <span className="font-semibold text-gray-900">{receiptToDelete?.receipt_id || "-"}</span>?
              <br />
              This action cannot be undone.
            </DialogDescription>
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (deleteReceiptMutation.isPending) return;
                  setIsDeleteDialogOpen(false);
                  setReceiptToDelete(null);
                }}
                disabled={deleteReceiptMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteReceiptMutation.isPending}
                className="bg-black hover:bg-gray-800 text-white min-w-[110px]"
              >
                {deleteReceiptMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <IndianRupee className="h-5 w-5" />
              <span>Receipt Details</span>
            </DialogTitle>
            <DialogDescription>
              {/* Detailed view of receipt {selectedReceipt?.receipt_id} */}
            </DialogDescription>
          </DialogHeader>
          
          {isDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : receiptDetail ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Receipt ID</Label>
                    <p className="text-lg font-semibold font-mono">{receiptDetail.receipt_id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer</Label>
                    <p className="text-lg font-semibold">{receiptDetail.customer_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total Paid</Label>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(receiptDetail.total_paid_amount)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Branch</Label>
                    <p className="text-lg font-semibold">{receiptDetail.branch_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Phone</Label>
                    <p className="text-lg font-semibold">{receiptDetail.customer_phone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Date</Label>
                    <p className="text-lg font-semibold">{formatDate(receiptDetail.created_at)}</p>
                  </div>
                  {isTallyEnabled && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Tally Sync</Label>
                      <Badge variant={receiptDetail.is_tally_synced ? "default" : "secondary"} className="flex items-center space-x-1 w-fit">
                        {receiptDetail.is_tally_synced ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        <span>{receiptDetail.is_tally_synced ? "Synced" : "Not Synced"}</span>
                      </Badge>
                    </div>
                  )}
                </div>
              </div>


              {/* Payment Details */}
              {receiptDetail.payment_details && receiptDetail.payment_details.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Payment Details</Label>
                  <div className="mt-2 space-y-4">
                    {receiptDetail.payment_details.map((payment, index) => {
                      const filteredPaymentDetails = filterNonNullPaymentDetails(payment.payment_details || {});
                      const paymentDetailKeys = Object.keys(filteredPaymentDetails);
                      
                      return (
                        <div key={payment.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="space-y-4">
                            {/* Basic Payment Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-500">Bill Numbers:</span>
                                <p className="font-semibold mt-1">{payment.bill_number || "-"}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">Payment Type:</span>
                                <div className="mt-1">
                                  <Badge variant={getPaymentTypeBadgeVariant(payment.payment_type)} className="flex items-center space-x-1 w-fit">
                                    {getPaymentTypeIcon(payment.payment_type)}
                                    <span>{payment.payment_type}</span>
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            {/* Payment Details Fields - Display as individual columns */}
                            {paymentDetailKeys.length > 0 && (
                              <div>
                                <span className="text-sm font-medium text-gray-500 mb-2 block">Payment Information:</span>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {paymentDetailKeys.map((key) => {
                                    // Format key name for display (convert snake_case to Title Case)
                                    const formatKeyName = (key) => {
                                      return key
                                        .split('_')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');
                                    };
                                    
                                    return (
                                      <div key={key} className="bg-white border rounded-lg p-3">
                                        <span className="text-xs font-medium text-gray-500 block mb-1">
                                          {formatKeyName(key)}:
                                        </span>
                                        <p className="font-semibold text-sm text-gray-900 break-words">
                                          {filteredPaymentDetails[key]}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bill Details */}
              {receiptDetail.bill_details && receiptDetail.bill_details.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Bill Details ({receiptDetail.bill_details.length})</Label>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {receiptDetail.bill_details.map((bill, index) => (
                      <div key={bill.id} className="bg-gray-50 border rounded-lg p-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-500 block mb-1">Bill Number:</span>
                            <p className="font-semibold text-sm">{bill.bill_number || "-"}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500 block mb-1">Amount:</span>
                            <p className="font-semibold text-sm text-green-600">{formatCurrency(bill.amount)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Details */}
              {(receiptDetail.reference_number || receiptDetail.remarks || receiptDetail.signature || receiptDetail.customer_image || receiptDetail.store_incharge) && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {receiptDetail.reference_number && (
                            <div>
                              <Label className="text-sm font-medium text-gray-500">
                                Reference Number
                              </Label>
                              <p className="text-gray-700 mt-1 p-3 bg-gray-50 rounded-md">
                                {receiptDetail.reference_number}
                              </p>
                            </div>
                          )}

                          {receiptDetail.store_incharge && (
                            <div>
                              <Label className="text-sm font-medium text-gray-500">
                                Store Incharge
                              </Label>
                              <p className="text-gray-700 mt-1 p-3 bg-gray-50 rounded-md">
                                {receiptDetail.store_incharge}
                              </p>
                            </div>
                          )}
                        </div>

                  {receiptDetail.remarks && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Remarks</Label>
                      <p className="text-gray-700 mt-1 p-3 bg-gray-50 rounded-md">{receiptDetail.remarks}</p>
                    </div>
                  )}

                  {(receiptDetail.signature || receiptDetail.customer_image) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {receiptDetail.signature && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Signature</Label>
                          <div className="mt-1">
                            <img
                              src={receiptDetail.signature}
                              alt="Signature"
                              className="w-full h-32 object-contain border rounded-lg p-1 bg-gray-50 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => openImageViewer(receiptDetail.signature, "Signature")}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = 'block';
                                }
                              }}
                            />
                            <p className="text-gray-700 mt-1 text-xs break-all hidden">{receiptDetail.signature}</p>
                          </div>
                        </div>
                      )}
                      {receiptDetail.customer_image && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Customer Image</Label>
                          <div className="mt-1">
                            <img
                              src={receiptDetail.customer_image}
                              alt="Customer"
                              className="w-full h-32 object-contain border rounded-lg p-1 bg-gray-50 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => openImageViewer(receiptDetail.customer_image, "Customer Image")}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = 'block';
                                }
                              }}
                            />
                            <p className="text-gray-700 mt-1 text-xs break-all hidden">{receiptDetail.customer_image}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sync to Tally Button */}
              {isTallyEnabled && !receiptDetail.is_tally_synced && hasUpdatePermission("receipt_management") && (
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => handleSyncClick(selectedReceipt)}
                    className="bg-black hover:bg-gray-800 flex items-center space-x-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Sync to Tally</span>
                  </Button>
                </div>
              )}


            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Failed to load receipt details</p>
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
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          {selectedImage && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center space-x-2">
                    <Image className="h-5 w-5" />
                    <span>{selectedImage.type_display || selectedImage.type || "Image"}</span>
                  </DialogTitle>
                </div>
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
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t bg-white">
                <div className="flex items-center justify-between">
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sync to Tally Dialog */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5" />
              <span>Sync Receipt to Tally</span>
            </DialogTitle>
            <DialogDescription>
              Select voucher type to sync receipt {receiptToSync?.receipt_id} to Tally
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {!selectedVoucherType ? (
              <>
                {/* Search Input for Voucher Types */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search voucher types by name..."
                    value={voucherTypeSearchTerm}
                    onChange={(e) => setVoucherTypeSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Voucher Types List */}
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  {isLoadingVoucherTypes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Loading voucher types...</span>
                    </div>
                  ) : filteredVoucherTypes && filteredVoucherTypes.length > 0 ? (
                    <div className="divide-y">
                      {filteredVoucherTypes.map((voucherType) => (
                        <div
                          key={voucherType.id || voucherType.name}
                          onClick={() => setSelectedVoucherType(voucherType)}
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {voucherType.display_name || voucherType.name}
                              </p>
                              {voucherType.parent && (
                                <p className="text-sm text-gray-500 mt-1">Parent: {voucherType.parent}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : voucherTypesError ? (
                    <div className="flex items-center justify-center py-8 text-red-500">
                      <span>Error loading voucher types. Please try again.</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      {voucherTypeSearchTerm ? 'No voucher types found matching your search' : 'No voucher types available'}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Selected Voucher Type Display */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-1">Selected Voucher Type:</p>
                      <p className="text-green-700 font-semibold text-lg">
                        {selectedVoucherType.display_name || selectedVoucherType.name}
                      </p>
                      {selectedVoucherType.parent && (
                        <p className="text-sm text-green-600 mt-1">Parent: {selectedVoucherType.parent}</p>
                      )}
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                </div>
                
                {/* Bank Ledger Name Input - Always visible */}
                <div className="space-y-2">
                  <Label htmlFor="bankLedgerName" className="text-sm font-medium">
                    Bank Ledger Name <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={bankLedgerDropdownOpen} onOpenChange={(open) => {
                    setBankLedgerDropdownOpen(open);
                    if (!open) {
                      setBankLedgerSearchTerm("");
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          id="bankLedgerName"
                          placeholder="Type to search bank ledger..."
                          value={bankLedgerName}
                          onChange={(e) => {
                            setBankLedgerName(e.target.value);
                            setBankLedgerSearchTerm(e.target.value);
                            if (e.target.value) {
                              setBankLedgerDropdownOpen(true);
                            }
                          }}
                          onFocus={() => {
                            if (bankLedgerSearchTerm) {
                              setBankLedgerDropdownOpen(true);
                            }
                          }}
                          className="w-full pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setBankLedgerDropdownOpen(!bankLedgerDropdownOpen)}
                        >
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search bank ledger..."
                          value={bankLedgerSearchTerm}
                          onValueChange={(value) => {
                            setBankLedgerSearchTerm(value);
                            setBankLedgerName(value);
                            if (value) {
                              setBankLedgerDropdownOpen(true);
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingBankLedgers ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading ledgers...
                              </div>
                            ) : bankLedgerSearchTerm && bankLedgerSearchTerm.trim().length > 0 ? (
                              "No ledgers found. Continue typing or enter manually."
                            ) : (
                              "Start typing to search for bank ledgers"
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              {bankLedgers.map((ledger) => (
                                <CommandItem
                                  key={ledger.id}
                                  value={ledger.tally_name}
                                  onSelect={() => {
                                    setBankLedgerName(ledger.tally_name);
                                    setBankLedgerSearchTerm("");
                                    setBankLedgerDropdownOpen(false);
                                  }}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check
                                      className={`h-4 w-4 ${
                                        bankLedgerName === ledger.name ? "opacity-100 text-blue-600" : "opacity-0"
                                      }`}
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900">{ledger.name}</div>
                                      {ledger.parent && (
                                        <div className="text-sm text-gray-500">{ledger.parent}</div>
                                      )}
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
                  <p className="text-xs text-gray-500">
                    Type to search for bank ledgers from Tally or enter manually
                  </p>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              {selectedVoucherType ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedVoucherType(null);
                    setVoucherTypeSearchTerm("");
                  }}
                  disabled={syncReceiptMutation.isPending}
                >
                  Change Voucher Type
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => {
                  setIsSyncDialogOpen(false);
                  setReceiptToSync(null);
                  setSelectedVoucherType(null);
                  setVoucherTypeSearchTerm("");
                  setBankLedgerName("");
                  setBankLedgerSearchTerm("");
                  setBankLedgerDropdownOpen(false);
                }}
                disabled={syncReceiptMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSyncToTally}
                disabled={syncReceiptMutation.isPending || !selectedVoucherType || !bankLedgerName?.trim()}
                className="flex items-center space-x-2 bg-black hover:bg-gray-800"
              >
                {syncReceiptMutation.isPending ? (
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
    </div>
  );
}