import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useLocation } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { ScrollArea } from "../components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import {
  Menu,
  Search,
  Eye,
  FileText,
  Calendar,
  CalendarDays,
  Filter,
  Truck,
  Weight,
  IndianRupee,
  User,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  Receipt,
  CheckSquare,
  Square,
  Edit3,
  Download,
  ChevronsUpDown, Check, CalendarIcon,
  Volume2,
  Pause,
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supervisorList, godownList } from "../lib/static-data";
import Loader from "../components/common/loader";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { formatItemWeightWithAlternateUnit } from "@/lib/weightDisplay";
import { downloadPurchaseOrderPdf } from "../utils/purchaseOrderPdfGenerator";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const ITEMS_PER_PAGE = 50; // API default pagination

// Today in YYYY-MM-DD for date input max attribute
const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

function getPurchaseOrderBrokerName(order) {
  const broker = order?.broker;
  if (!broker) return null;
  if (typeof broker === "object" && broker.name) return broker.name;
  return null;
}


export default function PurchaseOrdersReports() {
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
  const [, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerNameInput, setLedgerNameInput] = useState("");
  const [orderToSync, setOrderToSync] = useState(null);
  const [selectedVoucherType, setSelectedVoucherType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedParty, setSelectedParty] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfDay(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfDay(now), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("today"); // "today" | "weekly" | "monthly" | "custom"
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [selectedGodown, setSelectedGodown] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [isBulkActionModalOpen, setIsBulkActionModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [voucherSearchTerm, setVoucherSearchTerm] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [partyFilterOpen, setPartyFilterOpen] = useState(false);
  const [partyFilterSearch, setPartyFilterSearch] = useState("");
  const [selectedItemFilterId, setSelectedItemFilterId] = useState(null);
  const [selectedItemFilterName, setSelectedItemFilterName] = useState("");
  const [itemFilterOpen, setItemFilterOpen] = useState(false);
  const [itemFilterSearch, setItemFilterSearch] = useState("");

  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();

  // Debounce search query to avoid too many API calls
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState(searchQuery);
  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = React.useState("");
  const [debouncedVoucherSearch, setDebouncedVoucherSearch] = React.useState("purchase");
  const [debouncedPartyFilterSearch, setDebouncedPartyFilterSearch] = React.useState("");
  const [debouncedItemFilterSearch, setDebouncedItemFilterSearch] = React.useState("");

  const LEDGER_MODAL_PER_PAGE = 20;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Debounce ledger search in sync modal
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedLedgerSearch(ledgerSearchTerm);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [ledgerSearchTerm]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedVoucherSearch(voucherSearchTerm.trim() || "purchase");
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [voucherSearchTerm]);

  useEffect(() => {
    setLedgerPage(1);
  }, [debouncedLedgerSearch]);

  // Debounce Party (Ledger) search in Filters & Search so typing stays smooth
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedPartyFilterSearch(partyFilterSearch);
    }, 250); // short debounce for responsive typing

    return () => clearTimeout(timeoutId);
  }, [partyFilterSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedItemFilterSearch(itemFilterSearch);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [itemFilterSearch]);

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

  // Fetch complete ledgers list for party filter
  const { data: ledgersData } = useQuery({
    queryKey: [`${API_BASE_URL}/api/report/get-ledgers/`],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/report/get-ledgers/?per_page=1000&is_active=true`;
      const response = await apiRequest('GET', url);
      const responseData = await response.json();
      return responseData.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch purchase ledgers for Tally sync via get_party_entries_list (search=purchase + pagination)
  const { data: tallyPurchaseLedgersResponse, isLoading: isLoadingPurchaseLedgers } = useQuery({
    queryKey: [
      `${API_BASE_URL}/api/report/get-ledgers/`,
      "tally-purchase-ledgers",
      debouncedLedgerSearch,
      ledgerPage,
      isLedgerModalOpen,
    ],
    queryFn: async () => {
      const search = debouncedLedgerSearch.trim() || "purchase";
      const params = new URLSearchParams({
        search,
        page: String(ledgerPage),
        per_page: String(LEDGER_MODAL_PER_PAGE),
        is_active: "true",
      });
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`
      );
      const responseData = await response.json();
      return {
        data: responseData.data || [],
        pagination: responseData.pagination || {},
      };
    },
    enabled: !!AuthService.getAccessToken() && isLedgerModalOpen,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const tallyPurchaseLedgersData = tallyPurchaseLedgersResponse?.data || [];
  const tallyPurchaseLedgersPagination = tallyPurchaseLedgersResponse?.pagination || {};

  // Fetch branches for branch filter dropdown
  const { data: branchesData = [], isLoading: branchesLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-branches/`],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const responseData = await response.json();
      return responseData.data || [];
    },
    enabled: !!AuthService.getAccessToken() && hasPermission("purchase_order", "read"),
    refetchOnWindowFocus: false,
  });

  const { data: stockItemsForFilter = [], isLoading: stockItemsFilterLoading } = useQuery({
    queryKey: ["po-report-item-filter", debouncedItemFilterSearch],
    queryFn: async () => {
      const requestBody = {
        type: "PO Material",
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
    enabled: !!AuthService.getAccessToken() && itemFilterOpen && hasPermission("purchase_order", "read"),
    refetchOnWindowFocus: false,
  });

  // Build query parameters for API call (including search - handled by backend)
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (fromDate && fromDate.trim() !== '') params.append('start_date', fromDate.trim());
    if (toDate && toDate.trim() !== '') params.append('end_date', toDate.trim());
    // Status is always 'pending' now, but keeping the filter structure
    if (statusFilter && statusFilter !== 'all' && statusFilter !== '') params.append('status', statusFilter);
    if (selectedBranchId && selectedBranchId !== 'all' && selectedBranchId !== '') params.append('branch_id', selectedBranchId);
    if (selectedParty && selectedParty !== 'all' && selectedParty !== '') params.append('party_id', selectedParty);
    // Send search query to backend (use debounced value)
    if (debouncedSearchQuery && debouncedSearchQuery.trim() !== '') params.append('search', debouncedSearchQuery.trim());
    if (selectedItemFilterId) params.append('item_id', String(selectedItemFilterId));
    params.append('page', currentPage);
    params.append('per_page', ITEMS_PER_PAGE);
    return params.toString();
  };

  // Fetch purchase orders from API (all filters including search handled by backend)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [`${API_BASE_URL}/api/report/purchase-orders/`, fromDate, toDate, statusFilter, selectedBranchId, selectedParty, selectedItemFilterId, debouncedSearchQuery, currentPage],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/report/purchase-orders/${queryParams ? `?${queryParams}` : ''}`;
      const response = await apiRequest('GET', url);
      const responseData = await response.json();

      // Handle different response structures
      const items = responseData.data || responseData || [];
      const totalCount = responseData.pagination?.total_count || responseData.total_count || items.length;
      const currentPageNum = responseData.pagination?.current_page || responseData.current_page || currentPage;
      const totalPagesCount = responseData.pagination?.total_pages || responseData.total_pages || Math.ceil(totalCount / ITEMS_PER_PAGE);
      const summary = responseData.summary || {};

      return {
        data: items,
        total: totalCount,
        page: currentPageNum,
        totalPages: totalPagesCount,
        summary: summary,
      };
    },
    enabled: !!AuthService.getAccessToken() && hasPermission("purchase_order", "read"),
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const allEntries = data?.data || [];
  const totalItems = data?.total || allEntries.length;
  const totalPages = data?.totalPages || Math.ceil(allEntries.length / ITEMS_PER_PAGE);
  const summaryStats = data?.summary || {};

  // No client-side filtering - all filtering handled by backend
  const filteredOrders = allEntries;

  // Use API summary statistics (API calculates based on all filters including search)
  const dynamicSummaryStats = React.useMemo(() => {
    return {
      unique_parties: summaryStats.unique_parties || 0,
      total_amount: summaryStats.total_amount || 0,
      total_orders: summaryStats.total_orders || 0,
      total_items: summaryStats.total_items || 0
    };
  }, [summaryStats]);

  // Use complete ledgers list for party filter
  const uniqueParties = React.useMemo(() => {
    if (!ledgersData || !Array.isArray(ledgersData)) return [];

    return ledgersData
      .map(ledger => ({
        id: ledger.id,
        name: ledger.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgersData]);

  // Filtered parties for searchable Party (Ledger) dropdown
  const filteredParties = React.useMemo(() => {
    const term = (debouncedPartyFilterSearch || "").trim().toLowerCase();
    if (!term) return uniqueParties;
    return uniqueParties.filter((p) => p.name?.toLowerCase().includes(term));
  }, [uniqueParties, debouncedPartyFilterSearch]);

  // Detail modal: full PO data from details API (list API returns minimal payload)
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voiceAudioRef = useRef(null);
  const entryDetail = detailEntry || selectedEntry;

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
      setDetailEntry(null);
    }
  }, [isDetailModalOpen]);

  useEffect(() => {
    stopVoiceRemarkPlayback();
    voiceAudioRef.current = null;
  }, [entryDetail?.id]);

  const toggleVoiceRemarkPlayback = () => {
    const url = (entryDetail?.voice_remarks || "").trim();
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

  const handleViewDetails = async (entry) => {
    setSelectedEntry(entry);
    setDetailEntry(null);
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const res = await apiRequest('GET', `${API_BASE_URL}/api/report/purchase-orders/${entry.id}/`);
      const json = await res.json();
      if (json?.status === 200 && json?.data) {
        setDetailEntry(json.data);
      } else {
        console.error('Failed to load purchase order details', json);
      }
    } catch (e) {
      console.error('Failed to load purchase order details', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const purchaseItemsForDetail = detailEntry?.purchase_items ?? [];

  const handleDateFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
    refetch();
  };

  const handleDownloadPurchaseOrderPdf = async (entryDetail) => {
    if (!entryDetail) return;
    try {
      await downloadPurchaseOrderPdf(entryDetail, { userData });
    } catch (err) {
      console.error("Failed to generate purchase order PDF:", err);
      alert("Unable to download PDF. Please try again.");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset to first page when filters change (API filters including search)
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, selectedParty, selectedItemFilterId, fromDate, toDate, debouncedSearchQuery]);

  // Ensure current page doesn't exceed available pages
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleStatusChange = (item, status) => {
    setSelectedItem(item);
    setNewStatus(status);
    setIsStatusModalOpen(true);
  };

  // Sync purchase order to Tally. Item names = reserved_name from stock master; godown defaults to "A Main Location".
  const syncToTallyMutation = useMutation({
    mutationFn: async ({ purchase_order_id, item_ledger_name, voucher_type, godown_name }) => {
      const payload = {
        purchase_order_id: typeof purchase_order_id === "number" ? purchase_order_id : parseInt(purchase_order_id, 10),
        item_ledger_name: (item_ledger_name || "").trim(),
      };
      if (voucher_type && String(voucher_type).trim()) payload.voucher_type = String(voucher_type).trim();
      if (godown_name && String(godown_name).trim()) payload.godown_name = String(godown_name).trim();
      const headers = { ...AuthService.getAuthHeaders(), "Content-Type": "application/json" };
      const response = await fetch(`${API_BASE_URL}/api/sync-purchase-order-to-tally/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, ...data };
    },
    onSuccess: (result) => {
      if (result.ok && result.status === 200) {
        queryClient.invalidateQueries({
          queryKey: [`${API_BASE_URL}/api/report/purchase-orders/`, fromDate, toDate, statusFilter, selectedBranchId, selectedParty, selectedItemFilterId, debouncedSearchQuery, currentPage]
        });
        if (selectedEntry) {
          setSelectedEntry((prev) => prev ? { ...prev, is_tally_synced: true } : prev);
        }
        setIsLedgerModalOpen(false);
        setOrderToSync(null);
        setLedgerNameInput("");
        setLedgerSearchTerm("");
        setLedgerPage(1);
        setVoucherSearchTerm("");
        setSelectedVoucherType("");
      } else {
        const msg = result.message || result.error || "Sync to Tally failed.";
        alert(msg);
      }
    },
    onError: (error) => {
      console.error('Sync to Tally error:', error);
      alert(error?.message || "Sync to Tally failed. Please try again.");
    }
  });

  const openLedgerModalForOrder = (order) => {
    if (!order) return;
    setOrderToSync(order);
    setLedgerNameInput("");
    setLedgerSearchTerm("");
    setLedgerPage(1);
    setVoucherSearchTerm("");
    setSelectedVoucherType("");
    setIsLedgerModalOpen(true);
  };

  // Fetch voucher types for sync modal (search defaults to purchase)
  const { data: voucherTypesResponse, isLoading: isLoadingVoucherTypes } = useQuery({
    queryKey: ["voucher-types", debouncedVoucherSearch, isLedgerModalOpen],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedVoucherSearch || "purchase",
      });
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/get-voucher-types/?${params.toString()}`
      );
      const json = await response.json();
      if (response.ok && json.data) return json.data;
      return [];
    },
    enabled: !!AuthService.getAccessToken() && isLedgerModalOpen,
  });
  const voucherTypesList = Array.isArray(voucherTypesResponse) ? voucherTypesResponse : [];

  const handleConfirmLedgerSync = () => {
    if (!orderToSync) return;
    const trimmed = (ledgerNameInput || "").trim();
    syncToTallyMutation.mutate({
      purchase_order_id: orderToSync.id,
      item_ledger_name: trimmed || undefined,
      voucher_type: selectedVoucherType || undefined,
    });
  };

  const handleStatusSubmit = () => {
    // Here you would normally make an API call to update the status
    // console.log("Status updated:", {
    //   item: selectedItem,
    //   status: newStatus,
    //   supervisor: selectedSupervisor,
    //   godown: selectedGodown,
    //   reason: rejectionReason
    // });

    // Reset form
    setIsStatusModalOpen(false);
    setSelectedItem(null);
    setNewStatus("");
    setSelectedSupervisor("");
    setSelectedGodown("");
    setRejectionReason("");
  };

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ purchaseOrderIds, status }) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/report/purchase-orders/bulk-update-status/`, {
        purchase_order_ids: purchaseOrderIds,
        status: status,
        update_items: true
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Refresh the data
      queryClient.invalidateQueries({
        queryKey: [`${API_BASE_URL}/api/report/purchase-orders/`, fromDate, toDate, statusFilter, selectedBranchId, selectedParty, selectedItemFilterId, debouncedSearchQuery, currentPage]
      });

      // Clear selections
      setSelectedOrders(new Set());
      setIsBulkActionModalOpen(false);
      setBulkStatus("");

      // Show success message (you can add a toast notification here)
      // console.log('Bulk update successful:', data);
    },
    onError: (error) => {
      console.error('Bulk update failed:', error);
      // Show error message (you can add a toast notification here)
    },
    onSettled: () => {
      setIsBulkUpdating(false);
    }
  });

  // Handle individual order selection
  const handleOrderSelect = (orderId) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // Handle select all orders
  const handleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)));
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async () => {
    if (selectedOrders.size === 0 || !bulkStatus) return;

    setIsBulkUpdating(true);
    bulkUpdateMutation.mutate({
      purchaseOrderIds: Array.from(selectedOrders),
      status: bulkStatus
    });
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'completed': return 'default';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      case 'partial_unloaded': return 'outline';
      case 'partial_rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4 mr-0.5" />;
      case 'partial_unloaded': return <Truck className="w-4 h-4" />;
      case 'partial_rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (permissionsLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="app-main-content flex items-center justify-center">
          <Loader isLoading={true} text="Loading permissions..." />
        </div>
      </div>
    );
  }

  if (!hasPermission("purchase_order", "read")) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="app-main-content flex items-center justify-center">
          <div className="text-center bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
            <FileText className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">You don't have permission to view purchase orders.</p>
            <Button onClick={() => window.history.back()} variant="outline">Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Sidebar */}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="app-main-content">
        {/* Top Header */}
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
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
              <div className="flex items-center space-x-2">
                <FileText className="h-6 w-6 text-gray-600" />
                <h1 className="text-2xl font-bold text-gray-900">Purchase Orders Reports</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* {(fromDate || toDate) && (
                <div className="hidden sm:flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {fromDate
                      ? new Date(fromDate).toLocaleDateString('en-GB')
                      : 'All'}{" "}
                    to{" "}
                    {toDate
                      ? new Date(toDate).toLocaleDateString('en-GB')
                      : 'All'}
                  </span>
                </div>
              )} */}

              {/* Bulk Actions - only when user has purchase_order update permission */}
              {hasPermission("purchase_order", "update") && selectedOrders.size > 0 && (
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium text-blue-700">
                    {selectedOrders.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBulkActionModalOpen(true)}
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Update Status
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrders(new Set())}
                    className="text-blue-700 hover:bg-blue-100"
                  >
                    Clear
                  </Button>
                </div>
              )}

              {hasPermission("purchase_order", "create") && (
                <Button
                  onClick={() => setLocation('/add-purchase-order')}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Purchase Order
                </Button>
              )}
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
            </div>
          </div>
        </header>

        {/* Reports Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              {/* Summary Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Receipt className="h-5 w-5" />
                    <span>Purchase Orders Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Unique Parties */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Total Parties
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {dynamicSummaryStats.unique_parties}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border min-w-0">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg shrink-0">
                          <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Total Amount
                          </p>
                          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-all leading-tight">
                            ₹{Number(dynamicSummaryStats.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Total Orders */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                          <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Total Orders
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {dynamicSummaryStats.total_orders}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Total Items Count */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                          <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Total Items
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {dynamicSummaryStats.total_items}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Filter className="h-5 w-5" />
                    <span>Filters & Search</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date Range Preset */}
                    <div className="space-y-2">
                      <Label htmlFor="dateRangePreset" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                      <Label htmlFor="fromDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                            key={`from-${fromDate || "null"}`}
                            mode="single"
                            selected={fromDate ? new Date(fromDate) : undefined}
                            onSelect={(date) => {
                              if (!date) return;
                              const iso = format(date, "yyyy-MM-dd");
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
                      <Label htmlFor="toDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                            key={`to-${toDate || "null"}`}
                            mode="single"
                            selected={toDate ? new Date(toDate) : undefined}
                            onSelect={(date) => {
                              if (!date) return;
                              const iso = format(date, "yyyy-MM-dd");
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


                    {/* Party Filter - Using complete ledgers list with searchable dropdown (like Role filter) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Party (Ledger)
                      </Label>
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
                            className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <span className="truncate">
                              {selectedParty === "all"
                                ? "All Parties"
                                : (uniqueParties.find((p) => p.id.toString() === selectedParty)?.name || "Select party")}
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
                              placeholder="Search parties..."
                              value={partyFilterSearch}
                              onValueChange={setPartyFilterSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {uniqueParties.length === 0
                                  ? "No parties found."
                                  : "No parties match your search."}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-64">
                                  {/* All Parties option */}
                                  <CommandItem
                                    key="all"
                                    value="All"
                                    onSelect={() => {
                                      setSelectedParty("all");
                                      setCurrentPage(1);
                                      setPartyFilterOpen(false);
                                    }}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${selectedParty === "all" ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">All Parties</div>
                                      </div>
                                    </div>
                                  </CommandItem>

                                  {/* Individual parties */}
                                  {filteredParties.map((party) => (
                                    <CommandItem
                                      key={party.id}
                                      value={party.name}
                                      onSelect={() => {
                                        const idStr = party.id?.toString();
                                        setSelectedParty(idStr || "all");
                                        setCurrentPage(1);
                                        setPartyFilterOpen(false);
                                      }}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${selectedParty === party.id?.toString()
                                            ? "opacity-100 text-blue-600"
                                            : "opacity-0"
                                            }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">{party.name}</div>
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

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                          setStatusFilter(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-gray-500" />
                            <SelectValue placeholder="Select status" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="partial_unloaded">Partial Unloaded</SelectItem>
                          <SelectItem value="partial_rejected">Partial Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Branch Filter - searchable dropdown like Godown Masters */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        Branch
                      </Label>
                      <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={branchDropdownOpen}
                            className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                          <Command shouldFilter={false}>
                            <CommandInput placeholder="Search branches..." />
                            <CommandList>
                              <CommandEmpty>
                                {branchesLoading
                                  ? (
                                    <div className="flex items-center justify-center py-6">
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Loading branches...
                                    </div>
                                  )
                                  : (branchesData.length === 0
                                    ? "No branches found."
                                    : "No branches match your search.")}
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
                                        className={`h-4 w-4 ${selectedBranchId === "all" ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">All Branches</div>
                                      </div>
                                    </div>
                                  </CommandItem>
                                  {branchesData.map((branch) => (
                                    <CommandItem
                                      key={branch.id}
                                      value={branch.name}
                                      onSelect={() => {
                                        const idStr = branch.id?.toString();
                                        setSelectedBranchId(idStr || "all");
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
                                        <div>
                                          <div className="font-medium text-gray-900">{branch.name}</div>
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

                    {/* Item Filter - show POs that contain the selected stock item */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-600" />
                        Item
                      </Label>
                      <Popover
                        open={itemFilterOpen}
                        onOpenChange={(open) => {
                          setItemFilterOpen(open);
                          if (!open) setItemFilterSearch("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={itemFilterOpen}
                            className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              placeholder="Search items..."
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

                    {/* Search Field - in same row as Branch on large screens */}
                    <div className="space-y-2 lg:col-span-3">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Search
                      </Label>
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Search by voucher number, party name, reference..."
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="pl-10"
                          />
                          {isLoading && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                        {searchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchQuery("");
                              setCurrentPage(1);
                            }}
                            className="px-3"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Purchase Orders List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Purchase Orders ({filteredOrders.length})</CardTitle>
                    {hasPermission("purchase_order", "update") && filteredOrders.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        className="flex items-center space-x-2"
                      >
                        {selectedOrders.size === filteredOrders.length ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        <span>
                          {selectedOrders.size === filteredOrders.length ? 'Deselect All' : 'Select All'}
                        </span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredOrders.length > 0 ? (
                    <div className="space-y-4">
                      {filteredOrders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-white rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors border border-gray-200"
                        >
                          <div className="grid grid-cols-[auto_1fr] gap-x-3">
                            {/* Checkbox - spans both rows */}
                            <div className="row-span-2 flex pt-0.5">
                              {hasPermission("purchase_order", "update") && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOrderSelect(order.id);
                                  }}
                                  className="p-0.5 hover:bg-gray-100 rounded shrink-0"
                                >
                                  {selectedOrders.has(order.id) ? (
                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              )}
                            </div>
                            {/* Row 1: Voucher + statuses, Actions */}
                            <div className="grid grid-cols-[1fr_auto] gap-x-4 items-center">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex flex-col shrink-0 min-w-[220px] max-w-[280px]">
                                  <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                                    <span className="truncate font-medium text-gray-900">
                                      {order.voucher_number || "N/A"}
                                    </span>
                                  </div>
                                  {order.branch_name ? (
                                    <span
                                      className="text-[10px] leading-tight text-gray-500 pl-5 truncate"
                                      title={order.branch_name}
                                    >
                                      {order.branch_name}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                                  <Badge
                                    variant={getStatusBadgeVariant(order.status || 'unknown')}
                                    className={`inline-flex items-center justify-center min-w-[130px] whitespace-nowrap text-xs ${(order.status || '') === 'pending'
                                      ? 'bg-yellow-200 text-black border border-yellow-300'
                                      : (order.status || '') === 'completed'
                                        ? 'bg-green-200 text-black border border-green-500'
                                        : (order.status || '') === 'rejected'
                                          ? 'bg-red-200 text-black border border-red-500'
                                          : (order.status || '') === 'partial_unloaded'
                                            ? 'bg-blue-200 text-black border border-blue-500'
                                            : (order.status || '') === 'partial_rejected'
                                              ? 'bg-orange-200 text-black border border-orange-500'
                                              : ''
                                      }`}
                                  >
                                    {getStatusIcon(order.status || 'unknown')}
                                    <span className="capitalize">{(order.status || 'unknown').replace('_', ' ')}</span>
                                  </Badge>
                                  {isTallyEnabled && (
                                    <Badge
                                      variant={order.is_tally_synced ? "default" : "outline"}
                                      className={`inline-flex items-center justify-center min-w-[85px] text-xs shrink-0 ${order.is_tally_synced
                                        ? "bg-green-100 text-green-800 border-green-300"
                                        : "bg-gray-100 text-gray-700 border-gray-300"
                                        }`}
                                    >
                                      {order.is_tally_synced ? "Synced" : "Not Synced"}
                                    </Badge>
                                  )}
                                </div>

                              </div>
                              <div className="flex items-center gap-2 justify-end shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(order);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1.5" />
                                  View Details
                                </Button>
                                {isTallyEnabled && !order.is_tally_synced && hasPermission("purchase_order", "update") && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8"
                                      disabled={syncToTallyMutation.isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openLedgerModalForOrder(order);
                                      }}
                                    >
                                      {syncToTallyMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                      ) : null}
                                      Sync to Tally
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {/* Row 2 & 3: two-line metadata without boxed blocks */}
                            <div className="mt-2 space-y-2 text-sm text-gray-600">
                              <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2 xl:grid-cols-5 xl:items-start">
                                <div className="flex items-start gap-1.5 min-w-0">
                                  <User className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                  <span className="font-medium text-gray-900 break-words leading-snug line-clamp-2" title={order.party || "N/A"}>
                                    {order.party || "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-start gap-1.5 min-w-0">
                                  <Users className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                  <span className="break-words leading-snug line-clamp-2" title={getPurchaseOrderBrokerName(order) || "—"}>
                                    Broker:{" "}
                                    <span className="font-medium text-gray-900">
                                      {getPurchaseOrderBrokerName(order) || "—"}
                                    </span>
                                  </span>
                                </div>
                                <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
                                  <div className="flex min-w-0 items-start gap-1.5">
                                    <Package className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                    <span className="leading-snug">Items: {order.items_count ?? "N/A"}</span>
                                  </div>
                                  <div className="flex min-w-0 items-start gap-1.5">
                                    <IndianRupee className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                    <span className="whitespace-nowrap font-medium text-gray-700 leading-snug">
                                      {new Intl.NumberFormat("en-IN", {
                                        style: "currency",
                                        currency: "INR",
                                        maximumFractionDigits: 2,
                                      }).format(order.amount || 0)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-start min-w-0 leading-snug">
                                  <span className="break-words line-clamp-2" title={order.created_by || "N/A"}>
                                    Created By: {order.created_by || "N/A"}
                                  </span>
                                </div>
                                {order.updated_by && (
                                <div className="flex items-start min-w-0 leading-snug">
                                  <span
                                    className="break-words line-clamp-2"
                                    title={
                                      order.updated_by !== null &&
                                      order.updated_by !== undefined &&
                                      order.updated_by !== ""
                                        ? order.updated_by
                                        : "—"
                                    }
                                  >
                                    Updated By:{" "}
                                    {order.updated_by !== null &&
                                    order.updated_by !== undefined &&
                                    order.updated_by !== ""
                                      ? order.updated_by
                                      : "—"}
                                  </span>
                                </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                                  <span className="break-words">
                                    Created At:{" "}
                                    {order.created_at
                                      ? format(new Date(order.created_at), "dd-MM-yyyy hh:mm a")
                                      : "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                                  <span className="break-words">
                                    Updated Date:{" "}
                                    {order.updated_at
                                      ? format(new Date(order.updated_at), "dd-MM-yyyy hh:mm a")
                                      : "N/A"}
                                  </span>
                                </div>
                                <div className="break-words">
                                  Due Date: <span className="text-gray-700 font-medium">{order.order_due_date || "N/A"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No purchase orders found matching your criteria.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pagination */}
              {filteredOrders.length > 0 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500">
                    {filteredOrders.length > 0 ? (
                      <>
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of{" "}
                        {totalItems} items
                      </>
                    ) : (
                      "No items found"
                    )}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <Button
                          key={i + 1}
                          variant={
                            currentPage === i + 1 ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handlePageChange(i + 1)}
                        >
                          {i + 1}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div >

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Purchase Order Details - {selectedEntry?.voucher_number}</span>
                </DialogTitle>
                <DialogDescription>
                  View and manage purchase order details including items and their status.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {entryDetail && entryDetail.is_editable !== false && hasPermission("purchase_order", "update") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/add-purchase-order?edit=${entryDetail.id}`)}
                    className="shrink-0"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {entryDetail && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPurchaseOrderPdf(entryDetail)}
                    className="shrink-0"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                )}
                {isTallyEnabled && entryDetail && !entryDetail.is_tally_synced && hasPermission("purchase_order", "update") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={syncToTallyMutation.isPending}
                    onClick={() => openLedgerModalForOrder(entryDetail)}
                    className="shrink-0 mr-4"
                  >
                    {syncToTallyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : null}
                    Sync to Tally
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : entryDetail ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card className="border border-gray-200 rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Voucher Number</p>
                      <p className="font-semibold">{entryDetail.voucher_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Party</p>
                      <p className="font-semibold">{entryDetail.party}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Broker</p>
                      <p className="font-semibold">
                        {getPurchaseOrderBrokerName(entryDetail) || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <p className="text-sm text-gray-600 mb-0.5">Reference</p>
                      <p className="font-semibold">{entryDetail.reference || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 items-end">
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Effective Date</p>
                      <p className="font-semibold">
                        {entryDetail.effective_date}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Order Due Date</p>
                      <p className="font-semibold">
                        {entryDetail.order_due_date}
                      </p>
                    </div>
                    <div className="flex justify-start sm:justify-end lg:justify-end pb-0.5">
                      {(entryDetail.voice_remarks || "").trim() ? (
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
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Details */}
              <Card className="border border-gray-200 rounded-lg shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg">Order Details</CardTitle>
                    <Badge
                      variant={getStatusBadgeVariant(entryDetail.status)}
                      className="inline-flex items-center space-x-1"
                    >
                      {getStatusIcon(entryDetail.status)}
                      <span className="capitalize">
                        {(entryDetail.status || 'unknown').replace('_', ' ')}
                      </span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Total Amount</p>
                      <p className="font-semibold text-green-600">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 2,
                        }).format(entryDetail.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Created By</p>
                      <p className="font-semibold">{entryDetail.created_by || 'System'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Created At</p>
                      <p className="font-semibold">
                        {entryDetail.created_at}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Updated By</p>
                      <p className="font-semibold">{entryDetail.updated_by || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-0.5">Updated At</p>
                      <p className="font-semibold">
                        {entryDetail.updated_at}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Summary */}
              {entryDetail.status_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{entryDetail.total_items}</p>
                        <p className="text-sm text-gray-600">Total Items</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{entryDetail.status_summary.approved_items}</p>
                        <p className="text-sm text-gray-600">Approved</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">{entryDetail.status_summary.pending_items}</p>
                        <p className="text-sm text-gray-600">Pending</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{entryDetail.status_summary.rejected_items}</p>
                        <p className="text-sm text-gray-600">Rejected</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Test Information */}
              {/* <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Test Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Tested By</p>
                      <p className="font-semibold">{entryDetail.tested_by}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Test Date</p>
                      <p className="font-semibold">{entryDetail.test_date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created At</p>
                      <p className="font-semibold">{entryDetail.created_at}</p>
                    </div>
                  </div>
                </CardContent>
              </Card> */}

              {/* Purchase Items Section */}
              <Card className="border border-gray-200 rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Purchase Items ({detailLoading ? "…" : purchaseItemsForDetail.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      Loading purchase items...
                    </div>
                  ) : !detailEntry ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>Could not load purchase items. Please close and try again.</p>
                    </div>
                  ) : purchaseItemsForDetail.length > 0 ? (
                    <div className="space-y-4">
                      {purchaseItemsForDetail.map((item, index) => (
                        <div key={item.id || index} className="bg-gray-50 p-4 rounded-lg border">
                          <div className="space-y-4">
                            {/* Item Header */}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg">{item.stock_item || 'Unknown Item'}</h4>

                              </div>
                            </div>

                            {/* Item Details */}
                            <div className="bg-white p-3 rounded border">
                              <h5 className="font-medium mb-2">Item Details</h5>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-600">Item Name:</span>
                                  <span className="ml-1 font-medium">{item.stock_item || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Rate:</span>
                                  <span className="ml-1 font-medium">
                                    {item.rate != null && item.rate !== "" ? `₹${item.rate}` : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Amount:</span>
                                  <span className="ml-1 font-medium">
                                    {item.amount != null && item.amount !== "" ? `₹${item.amount}` : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Pending Qty:</span>
                                  <span className="ml-1 font-medium">{item.qty ?? "—"}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Actual Qty:</span>
                                  <span className="ml-1 font-medium">{item.actual_qty || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Billed Qty:</span>
                                  <span className="ml-1 font-medium">{item.billed_qty || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Received Qty:</span>
                                  <span className="ml-1 font-medium">{item.received_qty ?? "—"}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Remaining Weight:</span>
                                  <span className="ml-1 font-medium">
                                    {formatItemWeightWithAlternateUnit(
                                      item.item_weight,
                                      item.alternate_unit
                                    )}
                                  </span>
                                </div>
                                {(item.uom || item.item_unit) && (
                                  <div>
                                    <span className="text-gray-600">UOM:</span>
                                    <span className="ml-1 font-medium">{item.uom || item.item_unit || '—'}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-gray-600">Brokerage Amount:</span>
                                  <span className="ml-1 font-medium">
                                    {item.brokerage_amount != null && item.brokerage_amount !== ''
                                      ? `₹${Number(item.brokerage_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                      : '—'}
                                  </span>
                                </div>

                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-2 gap-2 text-sm mt-2">
                                <div>
                                  <span className="text-gray-600">Item Quality:</span>
                                  <span className="ml-1 font-medium">
                                    {item.item_quality != null && item.item_quality !== ''
                                      ? <p>
                                        {item.item_quality
                                          .replace(/[{}']/g, "")
                                          .replace(/,/g, " | ")}
                                      </p>
                                      : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No purchase items found for this order.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No entry details available.</p>
            </div>
          )}
        </DialogContent>
      </Dialog >

      {/* Ledger Name Modal for Tally Sync */}
      <Dialog open={isLedgerModalOpen} onOpenChange={setIsLedgerModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync Purchase Order to Tally</DialogTitle>
            <DialogDescription>
              Choose voucher type and enter the purchase ledger to use while syncing this purchase order to Tally.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Voucher Type (optional)
              </Label>
              <Command className="rounded-md border border-input min-h-10 mt-1">
                <CommandInput
                  placeholder="Search voucher types (default filter: purchase)..."
                  value={voucherSearchTerm}
                  onValueChange={setVoucherSearchTerm}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingVoucherTypes ? "Loading voucher types..." : "No voucher types found."}
                  </CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-40">
                      <CommandItem
                        value="default purchase order"
                        onSelect={() => setSelectedVoucherType("")}
                        className={!selectedVoucherType ? "bg-primary/10" : ""}
                      >
                        Default (Purchase Order)
                      </CommandItem>
                      {voucherTypesList.map((v) => {
                        const value = v.name || String(v.id);
                        const isSelected = selectedVoucherType === value;
                        return (
                          <CommandItem
                            key={v.id}
                            value={`${value} ${v.parent || ""}`}
                            onSelect={() => setSelectedVoucherType(value)}
                            className={isSelected ? "bg-primary/10" : ""}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{v.name}</span>
                              {v.parent && (
                                <span className="text-xs text-gray-500">{v.parent}</span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
              {selectedVoucherType && (
                <p className="text-xs text-primary mt-1">
                  Selected:{" "}
                  {(() => {
                    const v = voucherTypesList.find(
                      (x) => (x.name || String(x.id)) === selectedVoucherType
                    );
                    return v
                      ? `${v.name}${v.parent ? ` (${v.parent})` : ""}`
                      : selectedVoucherType;
                  })()}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">
                Voucher types filtered by &quot;purchase&quot;. Leave default to use Purchase Order.
              </p>
            </div>
            <div>
              <Label htmlFor="ledger_name" className="text-sm font-medium text-gray-700">
                Purchase Ledger (optional)
              </Label>
              <Command className="rounded-md border border-input min-h-10">
                <CommandInput
                  placeholder="Search by Tally name or ledger name..."
                  value={ledgerSearchTerm}
                  onValueChange={(value) => {
                    setLedgerSearchTerm(value);
                    setLedgerNameInput(value);
                  }}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingPurchaseLedgers
                      ? "Loading ledgers..."
                      : "No ledgers found. Continue typing or enter manually."}
                  </CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-64">
                      {Array.isArray(tallyPurchaseLedgersData) &&
                        tallyPurchaseLedgersData.map((ledger) => {
                          const displayTallyName =
                            (ledger.tally_name || ledger.name || "").trim() || ledger.name;
                          const isSelected = ledgerNameInput === displayTallyName;
                          return (
                            <CommandItem
                              key={ledger.id}
                              value={`${displayTallyName} ${ledger.parent || ""}`}
                              onSelect={() => {
                                setLedgerNameInput(displayTallyName);
                                setLedgerSearchTerm(displayTallyName);
                              }}
                              className={isSelected ? "bg-primary/10" : ""}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                  {displayTallyName}
                                </span>
                                {ledger.parent && (
                                  <span className="text-xs text-gray-500">
                                    {ledger.parent}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
              {(tallyPurchaseLedgersPagination.total_pages || 0) > 1 && (
                <div className="flex items-center justify-between mt-2 text-sm">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      isLoadingPurchaseLedgers ||
                      !tallyPurchaseLedgersPagination.has_previous
                    }
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-gray-600">
                    Page {tallyPurchaseLedgersPagination.current_page || ledgerPage} of{" "}
                    {tallyPurchaseLedgersPagination.total_pages || 1}
                    {tallyPurchaseLedgersPagination.total_count != null && (
                      <> ({tallyPurchaseLedgersPagination.total_count} ledgers)</>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      isLoadingPurchaseLedgers || !tallyPurchaseLedgersPagination.has_next
                    }
                    onClick={() => setLedgerPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Ledgers show Tally name; the same Tally name is sent in the sync payload. Item names use reserved name from stock master. Godown defaults to &quot;A Main Location&quot;. Sync is without GST.
            </p>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsLedgerModalOpen(false);
                setOrderToSync(null);
                setLedgerNameInput("");
                setLedgerSearchTerm("");
                setLedgerPage(1);
                setVoucherSearchTerm("");
                setSelectedVoucherType("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmLedgerSync}
              disabled={syncToTallyMutation.isPending}
            >
              {syncToTallyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync to Tally"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      < Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {newStatus === 'approved' ? 'Approve Item' : 'Reject Item'}
            </DialogTitle>
            <DialogDescription>
              {newStatus === 'approved'
                ? 'Select supervisor and godown to approve this item.'
                : 'Provide a reason for rejecting this item.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {newStatus === 'approved' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700">Select Supervisor</label>
                  <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisorList.map(supervisor => (
                        <SelectItem key={supervisor.id} value={supervisor.id.toString()}>
                          {supervisor.name} - {supervisor.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Select Godown</label>
                  <Select value={selectedGodown} onValueChange={setSelectedGodown}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a godown" />
                    </SelectTrigger>
                    <SelectContent>
                      {godownList.map(godown => (
                        <SelectItem key={godown.id} value={godown.id.toString()}>
                          {godown.name} - {godown.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {newStatus === 'rejected' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Rejection Reason</label>
                <Textarea
                  placeholder="Please provide reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsStatusModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStatusSubmit}
                disabled={
                  (newStatus === 'approved' && (!selectedSupervisor || !selectedGodown)) ||
                  (newStatus === 'rejected' && !rejectionReason)
                }
                className="flex-1"
              >
                {newStatus === 'approved' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Bulk Action Modal */}
      <Dialog open={isBulkActionModalOpen} onOpenChange={setIsBulkActionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>Bulk Update Status</span>
            </DialogTitle>
            <DialogDescription>
              Update the status of {selectedOrders.size} selected purchase order{selectedOrders.size > 1 ? 's' : ''} and their associated items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Select New Status</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="partial_unloaded">Partial Unloaded</SelectItem>
                  <SelectItem value="partial_rejected">Partial Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This will update both the purchase order status and all associated item statuses to "{bulkStatus}".
              </p>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBulkActionModalOpen(false);
                  setBulkStatus("");
                }}
                className="flex-1"
                disabled={isBulkUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatus || isBulkUpdating}
                className="flex-1"
              >
                {isBulkUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Status'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loader */}
      < Loader isLoading={isLoading} text="Loading purchase orders" />
    </div >
  );
}