import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Settings, Menu, Plus, Search, Eye, Edit3, Calendar, CalendarIcon, FileText, User, IndianRupee, Package, Filter, Users, Clock, CheckCircle, XCircle, Building, Check, X, Truck, RefreshCw, Trash2 } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  getSalesReturnStatusKey,
  isSalesReturnInwardEligible,
} from "@/lib/return_helpers";
import {
  approveRejectSalesReturn,
  deleteSalesReturn,
  syncSalesReturnToTally,
} from "@/lib/sales_api";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const ITEMS_PER_PAGE = 20;

const COLUMN_DEFS = [
  { key: "returnNo", label: "Return no.", cellClass: "whitespace-nowrap font-medium text-slate-900" },
  { key: "salesOrder", label: "Sales order", cellClass: "whitespace-nowrap" },
  { key: "customer", label: "Customer", cellClass: "max-w-[240px]" },
  { key: "items", label: "Items", align: "right", cellClass: "text-right tabular-nums" },
  { key: "amount", label: "Amount", align: "right", cellClass: "whitespace-nowrap text-right font-medium tabular-nums" },
  { key: "status", label: "Status", cellClass: "" },
  { key: "type", label: "Type", cellClass: "" },
  { key: "tally", label: "Tally", cellClass: "" },
  { key: "createdBy", label: "Created by", cellClass: "whitespace-nowrap" },
  { key: "date", label: "Date", cellClass: "whitespace-nowrap text-slate-600" },
];
const DEFAULT_VISIBLE_COLUMNS = ["returnNo", "salesOrder", "customer", "amount", "status", "date"];
const COLUMN_STORAGE_KEY = "sales-return-visible-columns";

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

const getStatusClass = (status) => {
  const normalized = getSalesReturnStatusKey({ status });
  if (normalized === "completed" || normalized === "inward_created") return "bg-green-100 text-green-800 border-green-300";
  if (normalized === "partially_completed" || normalized === "partially_approved" || normalized === "approved") {
    return "bg-blue-100 text-blue-800 border-blue-300";
  }
  if (normalized === "cancelled" || normalized === "rejected") return "bg-red-100 text-red-800 border-red-300";
  return "bg-yellow-100 text-yellow-800 border-yellow-300";
};

const getStatusIcon = (status) => {
  const normalized = getSalesReturnStatusKey({ status });
  if (normalized === "completed" || normalized === "partially_completed" || normalized === "inward_created" || normalized === "approved") {
    return <CheckCircle className="h-3.5 w-3.5" />;
  }
  if (normalized === "cancelled" || normalized === "rejected") return <XCircle className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

const isPendingReturn = (rowOrStatus) => {
  if (rowOrStatus && typeof rowOrStatus === "object") {
    return getSalesReturnStatusKey(rowOrStatus) === "pending";
  }
  return getSalesReturnStatusKey({ status: rowOrStatus }) === "pending";
};

const canDeleteReturn = (rowOrStatus) => {
  const key =
    rowOrStatus && typeof rowOrStatus === "object"
      ? getSalesReturnStatusKey(rowOrStatus)
      : getSalesReturnStatusKey({ status: rowOrStatus });
  return key === "pending" || key === "rejected";
};

const canShowTallySync = (row) =>
  ["approved", "partially_approved", "partially_completed", "inward_created", "completed"].includes(
    getSalesReturnStatusKey(row),
  );

export default function SalesReturnReports() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfDay(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfDay(now), "yyyy-MM-dd"));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [selectedId, setSelectedId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveAction, setApproveAction] = useState(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [approvalLines, setApprovalLines] = useState([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead =
    hasPermission("sales_return", "read") || hasPermission("sales_order", "read");
  const canCreate =
    hasPermission("sales_return", "create") || hasPermission("sales_order", "create");
  const canUpdate =
    hasPermission("sales_return", "update") || hasPermission("sales_order", "update");
  const canDelete =
    hasPermission("sales_return", "delete") ||
    hasPermission("sales_order", "delete") ||
    canUpdate;
  const canCreateInward = hasPermission("inward", "create") || hasPermission("inward", "read");
  const [syncingReturnId, setSyncingReturnId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (selectedCustomer !== "all") params.append("customer_id", selectedCustomer);
    if (fromDate) params.append("start_date", fromDate);
    if (toDate) params.append("end_date", toDate);
    params.append("new_page", "1");
    params.append("per_page", "500");
    return params.toString();
  }, [statusFilter, selectedCustomer, fromDate, toDate]);

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

  const { data: customersData = [] } = useQuery({
    queryKey: ["sales-return-parties-filter"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/sales/get-customers/?per_page=1000&`);
      const json = await res.json();
      return json?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
  });

  const { data: branchesData = [] } = useQuery({
    queryKey: ["sales-return-branches-filter"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const json = await res.json();
      return json?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sales-return-list", queryParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/voucher/sales-return-orders/?${queryParams}`);
      return res.json();
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["sales-return-detail-modal", selectedId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/voucher/sales-return-orders/${selectedId}/`);
      return res.json();
    },
    enabled: !!selectedId && isDetailOpen,
    refetchOnWindowFocus: false,
  });

  const rows = data?.data || [];
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
          row?.return_number,
          row?.order_id,
          row?.customer_name,
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
  }, [rows, branchOptions, search, selectedBranchId]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const approveRejectMutation = useMutation({
    mutationFn: async ({ salesReturnId, action, remarks, items }) => {
      const json = await approveRejectSalesReturn(salesReturnId, {
        action,
        action_remarks: remarks,
        items,
      });
      if (json?.status !== 200) {
        throw new Error(json?.message || `Failed to ${action} sales return`);
      }
      return json;
    },
    onSuccess: (json, variables) => {
      toast({
        title: "Success",
        description: json?.message || `Sales return ${variables.action}d successfully`,
        className: "bg-green-50 border-green-100 text-green-800",
      });
      setApproveDialogOpen(false);
      setApproveAction(null);
      setActionRemarks("");
      setApprovalLines([]);
      setIsDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sales-return-list"] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["sales-return-detail-modal", selectedId] });
      }
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Unable to update sales return status",
        variant: "destructive",
      });
    },
  });

  const syncTallyMutation = useMutation({
    mutationFn: async ({ salesReturnId, forceResync = false }) => {
      setSyncingReturnId(salesReturnId);
      const json = await syncSalesReturnToTally({
        salesReturnId,
        forceResync,
        markSynced: true,
      });
      if (json?.status && Number(json.status) >= 400) {
        throw new Error(json?.message || "Tally sync failed");
      }
      return json;
    },
    onSuccess: (json) => {
      toast({
        title: "Tally Credit Note",
        description:
          json?.message ||
          "Sales return marked for Credit Note sync (voucher). Stock is updated in GrainsPRO on inward complete — not by this button.",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      queryClient.invalidateQueries({ queryKey: ["sales-return-list"] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["sales-return-detail-modal", selectedId] });
      }
    },
    onError: (err) => {
      toast({
        title: "Tally sync failed",
        description: err?.message || "Unable to sync sales return",
        variant: "destructive",
      });
    },
    onSettled: () => setSyncingReturnId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (salesReturnId) => {
      const json = await deleteSalesReturn(salesReturnId);
      if (json?.status && Number(json.status) >= 400) {
        throw new Error(json?.message || "Failed to delete sales return");
      }
      return json;
    },
    onSuccess: (json, salesReturnId) => {
      toast({
        title: "Deleted",
        description: json?.message || "Sales return deleted successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      setDeleteDialogOpen(false);
      setReturnToDelete(null);
      if (selectedId && selectedId === salesReturnId) {
        setIsDetailOpen(false);
        setSelectedId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["sales-return-list"] });
    },
    onError: (err) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Unable to delete sales return",
        variant: "destructive",
      });
    },
  });

  const openDeleteDialog = (row) => {
    if (!row?.id) return;
    setReturnToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleCreateInward = (row) => {
    if (!row?.id) return;
    window.location.href = `/add-inward?sales_return_id=${encodeURIComponent(row.id)}`;
  };

  const openApproveDialog = (action) => {
    const detail = detailData?.data;
    if (!detail?.items?.length) {
      toast({ title: "No items", description: "No line items found on this return.", variant: "destructive" });
      return;
    }
    setApproveAction(action);
    setActionRemarks("");
    setApprovalLines(
      detail.items.map((line) => ({
        item_id: line.id,
        stock_item_name: line.stock_item_name,
        return_qty: line.return_qty,
        approved_return_qty:
          action === "approve"
            ? String(line.approved_return_qty && Number(line.approved_return_qty) > 0
              ? line.approved_return_qty
              : line.return_qty || "")
            : "0",
      }))
    );
    setApproveDialogOpen(true);
  };

  const submitApproveReject = () => {
    if (!selectedId || !approveAction) return;
    const items =
      approveAction === "approve"
        ? approvalLines.map((line) => ({
            item_id: line.item_id,
            approved_return_qty: Number(line.approved_return_qty) || 0,
          }))
        : approvalLines.map((line) => ({ item_id: line.item_id, approved_return_qty: 0 }));
    approveRejectMutation.mutate({
      salesReturnId: selectedId,
      action: approveAction,
      remarks: actionRemarks.trim(),
      items,
    });
  };

  if (permissionsLoading || (isLoading && !data)) {
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
            <p className="text-red-600 mb-4">You don't have permission to view sales return.</p>
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

  const activeColumns = COLUMN_DEFS.filter((col) => visibleColumns.includes(col.key));

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
    if (isVisible && visibleColumns.length === 1) return;
    saveVisibleColumns(
      COLUMN_DEFS.map((col) => col.key).filter((k) => (k === key ? !isVisible : visibleColumns.includes(k))),
    );
  };

  const renderCell = (key, row) => {
    switch (key) {
      case "returnNo":
        return row.return_number || dash;
      case "salesOrder":
        return row.order_id || dash;
      case "customer":
        return (
          <span className="block truncate text-slate-900" title={row.customer_name || undefined}>
            {row.customer_name || dash}
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
            className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${getStatusClass(row.status_key || row.status)}`}
          >
            {getStatusIcon(row.status_key || row.status)}
            <span className="capitalize">
              {String(row.status || row.status_key || "unknown").replaceAll("_", " ")}
            </span>
          </Badge>
        );
      case "type":
        return row.return_type ? (
          <Badge variant="outline" className="whitespace-nowrap text-xs capitalize">
            {String(row.return_type).replaceAll("_", " ")}
          </Badge>
        ) : (
          dash
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
        return row.created_at || row.return_date || dash;
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
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">Sales Return</h1>
              <p className="truncate text-sm text-slate-500">Listing and quick actions</p>
            </div>
          </div>
          {canCreate && (
            <Button
              size="sm"
              className="h-9 shrink-0 gap-2"
              aria-label="Add sales return"
              onClick={() => (window.location.href = "/add-sales-return")}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Sales Return</span>
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
                      <p className="truncate text-xl font-semibold leading-tight tabular-nums text-slate-900">
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Filters */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <h2 className="text-sm font-semibold text-slate-900">Filters &amp; Search</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dateRangePreset" className={labelClass}>Date range</Label>
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
                    <Label htmlFor="fromDate" className={labelClass}>From date</Label>
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
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={`h-9 w-full justify-start px-3 text-left font-normal ${
                            dateRangePreset !== "custom" ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "From date"}
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
                    <Label htmlFor="toDate" className={labelClass}>To date</Label>
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
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={`h-9 w-full justify-start px-3 text-left font-normal ${
                            dateRangePreset !== "custom" ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {toDate ? format(new Date(toDate), "dd-MM-yyyy") : "To date"}
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
                    <Label className={labelClass}>Customer (ledger)</Label>
                    <Select value={selectedCustomer} onValueChange={(v) => { setSelectedCustomer(v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Parties</SelectItem>
                        {customersData.map((customer) => (
                          <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Status</Label>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="salesReturnSearch" className={labelClass}>Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="salesReturnSearch"
                        className="h-9 pl-9 pr-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Return number, customer name, reference..."
                      />
                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
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

            {/* Results */}
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-base font-semibold text-slate-900">
                  Sales Return
                  <span className="ml-1.5 text-sm font-normal tabular-nums text-slate-500">
                    ({filteredRows.length}
                    {search.trim() && filteredRows.length !== rows.length ? ` of ${rows.length}` : ""})
                  </span>
                </h2>
              </div>

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
                              {COLUMN_DEFS.map((col) => {
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
                                      disabled={checked && visibleColumns.length === 1}
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
                    {paginatedRows.map((row) => (
                      <TableRow key={row.id}>
                        {activeColumns.map((col) => (
                          <TableCell key={col.key} className={`${tdClass} ${col.cellClass}`}>
                            {renderCell(col.key, row)}
                          </TableCell>
                        ))}
                        <TableCell className={tdClass}>
                          <div className="flex items-center justify-end gap-1.5">
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
                            {canCreateInward && isSalesReturnInwardEligible(row) && (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 w-8 bg-emerald-600 p-0 text-white hover:bg-emerald-700"
                                title="Create Inward"
                                aria-label="Create Inward"
                                onClick={() => handleCreateInward(row)}
                              >
                                <Truck className="h-4 w-4" />
                              </Button>
                            )}
                            {canShowTallySync(row) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-8 w-8 p-0 ${
                                  row.is_tally_synced
                                    ? "border-green-300 text-green-700 hover:bg-green-50"
                                    : ""
                                }`}
                                title={
                                  row.is_tally_synced
                                    ? "Re-sync Credit Note to Tally"
                                    : "Sync Credit Note to Tally"
                                }
                                aria-label={
                                  row.is_tally_synced
                                    ? "Re-sync Credit Note to Tally"
                                    : "Sync Credit Note to Tally"
                                }
                                disabled={syncTallyMutation.isPending && syncingReturnId === row.id}
                                onClick={() => syncTallyMutation.mutate({
                                  salesReturnId: row.id,
                                  forceResync: Boolean(row.is_tally_synced),
                                })}
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${
                                    syncingReturnId === row.id ? "animate-spin" : ""
                                  }`}
                                />
                              </Button>
                            )}
                            {canUpdate && isPendingReturn(row) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => (window.location.href = `/add-sales-return?edit=${row.id}`)}
                              >
                                <Edit3 className="mr-1.5 h-4 w-4" />
                                Edit
                              </Button>
                            )}
                            {canDelete && canDeleteReturn(row) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 border-red-200 p-0 text-red-700 hover:bg-red-50"
                                title="Delete"
                                aria-label="Delete"
                                disabled={deleteMutation.isPending}
                                onClick={() => openDeleteDialog(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={activeColumns.length + 1} className="px-4 py-12 text-center text-sm text-slate-500">
                          {search.trim()
                            ? "No sales return orders match your search."
                            : "No sales return orders found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 sm:flex-row">
                <p className="text-sm text-slate-600">
                  Showing {filteredRows.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    disabled={currentPage >= totalPages}
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
            <DialogTitle>Sales Return Detail</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 flex justify-center"><Loader /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Return No</p><p>{detailData?.data?.return_number || "-"}</p></div>
                <div><p className="text-muted-foreground text-xs">Sales Order</p><p>{detailData?.data?.order_id || detailData?.data?.so_number || "-"}</p></div>
                <div><p className="text-muted-foreground text-xs">Party</p><p>{detailData?.data?.customer_name || "-"}</p></div>
                <div><p className="text-muted-foreground text-xs">Return Type</p><p className="capitalize">{String(detailData?.data?.return_type || "-").replaceAll("_", " ")}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><p>{String(detailData?.data?.status || detailData?.data?.status_key || "-").replaceAll("_", " ")}</p></div>
                <div>
                  <p className="text-muted-foreground text-xs">Tally</p>
                  <Badge
                    variant="outline"
                    className={`mt-0.5 inline-flex items-center justify-center text-xs ${
                      detailData?.data?.is_tally_synced
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-gray-100 text-gray-700 border-gray-300"
                    }`}
                  >
                    {detailData?.data?.is_tally_synced ? "Synced" : "Not Synced"}
                  </Badge>
                </div>
                <div><p className="text-muted-foreground text-xs">Amount</p><p>₹ {(Number(detailData?.data?.amount) || 0).toFixed(2)}</p></div>
              </div>
              {detailData?.data?.selected_invoice_numbers ? (
                <p className="text-sm text-muted-foreground">
                  Invoice(s): <span className="text-foreground">{detailData.data.selected_invoice_numbers}</span>
                </p>
              ) : null}
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full min-w-[900px] text-xs">
                  <thead>
                    <tr className="border-b bg-gray-100">
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-left">UOM</th>
                      <th className="px-2 py-2 text-right">Return Qty</th>
                      <th className="px-2 py-2 text-right">Approved Qty</th>
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
                        <td className="px-2 py-2 text-right">{line.approved_return_qty || "-"}</td>
                        <td className="px-2 py-2 text-right">{line.rate || "-"}</td>
                        <td className="px-2 py-2 text-right">₹ {(Number(line.amount) || 0).toFixed(2)}</td>
                        <td className="px-2 py-2">{String(line.item_status || "-").replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canUpdate && isPendingReturn(detailData?.data) && (
                <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    disabled={approveRejectMutation.isPending}
                    onClick={() => openApproveDialog("reject")}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={approveRejectMutation.isPending}
                    onClick={() => openApproveDialog("approve")}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              )}
              {canDelete && detailData?.data && canDeleteReturn(detailData.data) && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    disabled={deleteMutation.isPending}
                    onClick={() => openDeleteDialog(detailData.data)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
              {canCreateInward && detailData?.data && isSalesReturnInwardEligible(detailData.data) && (
                <div className="flex justify-end pt-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleCreateInward(detailData.data)}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Create Inward
                  </Button>
                </div>
              )}
              {detailData?.data && canShowTallySync(detailData.data) && (
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 w-8 p-0 ${
                      detailData.data.is_tally_synced
                        ? "border-green-300 text-green-700 hover:bg-green-50"
                        : ""
                    }`}
                    title={
                      detailData.data.is_tally_synced
                        ? "Re-sync Credit Note to Tally"
                        : "Sync Credit Note to Tally"
                    }
                    aria-label={
                      detailData.data.is_tally_synced
                        ? "Re-sync Credit Note to Tally"
                        : "Sync Credit Note to Tally"
                    }
                    disabled={
                      syncTallyMutation.isPending && syncingReturnId === detailData.data.id
                    }
                    onClick={() =>
                      syncTallyMutation.mutate({
                        salesReturnId: detailData.data.id,
                        forceResync: Boolean(detailData.data.is_tally_synced),
                      })
                    }
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        syncingReturnId === detailData.data.id ? "animate-spin" : ""
                      }`}
                    />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approveAction === "approve" ? "Approve sales return" : "Reject sales return"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {detailData?.data?.return_number
                ? `${detailData.data.return_number} · ${detailData.data.customer_name || "Customer"}`
                : "Confirm action for this sales return."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {approveAction === "approve" && (
            <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-2">
              {approvalLines.map((line, idx) => (
                <div key={line.item_id} className="grid grid-cols-[1fr_120px] gap-2 items-center text-sm">
                  <span className="truncate">{line.stock_item_name}</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={line.approved_return_qty}
                    onChange={(e) => {
                      const val = e.target.value;
                      setApprovalLines((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, approved_return_qty: val } : row))
                      );
                    }}
                    placeholder="Approved qty"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 py-2">
            <Label htmlFor="sr-action-remarks">Remarks</Label>
            <Textarea
              id="sr-action-remarks"
              placeholder={approveAction === "reject" ? "Reason for rejection (optional)" : "Approval remarks (optional)"}
              value={actionRemarks}
              onChange={(e) => setActionRemarks(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveRejectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveRejectMutation.isPending}
              className={approveAction === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              onClick={(e) => {
                e.preventDefault();
                submitApproveReject();
              }}
            >
              {approveRejectMutation.isPending
                ? "Saving..."
                : approveAction === "approve"
                  ? "Approve"
                  : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setReturnToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales return?</AlertDialogTitle>
            <AlertDialogDescription>
              {returnToDelete?.return_number
                ? `This will permanently remove ${returnToDelete.return_number}${
                    returnToDelete.customer_name ? ` (${returnToDelete.customer_name})` : ""
                  } from the list. Only pending or rejected returns can be deleted.`
                : "This will permanently remove this sales return from the list. Only pending or rejected returns can be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending || !returnToDelete?.id}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                if (returnToDelete?.id) deleteMutation.mutate(returnToDelete.id);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}