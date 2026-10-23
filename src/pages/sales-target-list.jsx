import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Edit,
  Eye,
  IndianRupee,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  User,
  X,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Loader from "@/components/common/loader";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  createSalesTarget,
  deactivateSalesTarget,
  fetchSalesTargetById,
  fetchSalesTargets,
  updateSalesTarget,
} from "@/lib/sales_target_api";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const MODULE = "sales_order";
const PER_PAGE = 20;

const PERIOD_OPTIONS = [
  { value: "all", label: "All periods" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const PERIOD_FORM_OPTIONS = PERIOD_OPTIONS.filter((opt) => opt.value !== "all");

function formatCurrency(amount) {
  const n = Number(amount ?? 0);
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function formatPeriodEndDisplay(value) {
  if (!value) return "No expiry";
  return formatDisplayDate(value);
}

function periodTypeLabel(value) {
  return PERIOD_FORM_OPTIONS.find((opt) => opt.value === value)?.label || value || "—";
}

function achievementStatusMeta(row) {
  const status = row?.achievement_status || row?.achievement?.achievement_status;
  if (status === "achieved" || row?.is_achieved) {
    return {
      label: "Achieved",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  }
  if (status === "in_progress") {
    return {
      label: "In Progress",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }
  if (status === "upcoming") {
    return {
      label: "Upcoming",
      className: "bg-sky-100 text-sky-800 border-sky-200",
    };
  }
  if (status === "no_target") {
    return {
      label: "No Metric",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }
  return {
    label: "Not Started",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
}

function formatAchievementPct(value) {
  if (value == null || value === "") return "—";
  return `${Number(value).toFixed(1)}%`;
}

function AchievementProgress({ pct }) {
  if (pct == null || pct === "") return null;
  const width = Math.max(0, Math.min(100, Number(pct) || 0));
  const achieved = width >= 100;
  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          achieved ? "bg-emerald-500" : "bg-blue-600",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function getUserId(user) {
  return String(user?.user_id ?? user?.id ?? "");
}

function getUserDisplayName(user) {
  return user?.name || user?.user_name || getUserId(user) || "Unknown";
}

function extractUsersList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function emptyItemRow() {
  return {
    id: null,
    stock_item_id: "",
    stock_item_name: "",
    target_quantity: "",
    remarks: "",
  };
}

function createEmptyForm() {
  return {
    id: null,
    salesman_id: "",
    branch_id: "",
    salesman_name: "",
    period_type: "MONTHLY",
    period_start: format(new Date(), "yyyy-MM-dd"),
    period_end: "",
    target_order_count: "",
    target_order_value: "",
    remarks: "",
    items: [],
  };
}

function buildItemsPayload(items) {
  return items
    .filter((row) => row.stock_item_id)
    .map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      stock_item_id: Number(row.stock_item_id),
      target_quantity: row.target_quantity === "" ? 0 : Number(row.target_quantity),
      remarks: row.remarks || "",
    }));
}

function MetricModeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-slate-50 shrink-0">
      <button
        type="button"
        onClick={() => onChange("count")}
        className={cn(
          "px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors",
          value === "count"
            ? "bg-blue-800 text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-white",
        )}
      >
        Target Count
      </button>
      <button
        type="button"
        onClick={() => onChange("value")}
        className={cn(
          "px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors",
          value === "value"
            ? "bg-blue-800 text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-white",
        )}
      >
        Target Value
      </button>
    </div>
  );
}

function DateField({ value, onChange, placeholder = "Pick date", disabled = false, min }) {
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
          {value ? formatDisplayDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(date) => {
            if (!date) {
              onChange("");
            } else {
              onChange(format(date, "yyyy-MM-dd"));
            }
            setOpen(false);
          }}
          initialFocus
        />
        {value ? (
          <div className="p-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        ) : null}
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
  clearable = false,
  loading = false,
  onSearchChange,
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
          <span className="truncate">
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={onSearchChange}
          />
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
                {clearable ? (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {placeholder}
                  </CommandItem>
                ) : null}
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

async function fetchSalesmen({ branchId } = {}) {
  const mergeById = new Map();
  for (const roleId of [7, 11]) {
    const params = new URLSearchParams({ role_id: String(roleId) });
    if (branchId) params.set("branch_id", String(branchId));
    try {
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/get-users/?${params.toString()}`,
      );
      const data = await res.json();
      const list = extractUsersList(data);
      list.forEach((user) => {
        const id = getUserId(user);
        if (id) mergeById.set(id, user);
      });
    } catch {
      // role may not exist; continue
    }
  }
  return Array.from(mergeById.values());
}

async function fetchStockItems({ search = "", branchId } = {}) {
  const body = {
    type: "SO Material",
    list_mode: "default",
    is_active: true,
    new_page: 1,
    per_page: 100,
    search: search.trim(),
  };
  if (branchId) body.branch_id = branchId;
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/stock-items-list/`,
    body,
  );
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

export default function SalesTargetList() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = AuthService.getAccessToken();
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    isLoading: permissionsLoading,
  } = useUserPermissions();

  const canRead = hasReadPermission(MODULE);
  const canCreate = hasCreatePermission(MODULE);
  const canUpdate = hasUpdatePermission(MODULE);
  const canDelete = hasDeletePermission(MODULE);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [salesmanFilter, setSalesmanFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [formError, setFormError] = useState(null);
  const [stockItemSearch, setStockItemSearch] = useState("");
  const [targetMetricMode, setTargetMetricMode] = useState("count");
  const [showItemTargets, setShowItemTargets] = useState(false);

  const listParams = useMemo(
    () => ({
      page,
      per_page: PER_PAGE,
      ...(salesmanFilter ? { salesman_id: salesmanFilter } : {}),
      ...(branchFilter ? { branch_id: branchFilter } : {}),
      ...(periodFilter && periodFilter !== "all" ? { period_type: periodFilter } : {}),
      ...(fromDate ? { period_start_from: fromDate, from_date: fromDate } : {}),
      ...(toDate ? { period_start_to: toDate, to_date: toDate } : {}),
      is_active: statusFilter === "inactive" ? "false" : "true",
    }),
    [page, salesmanFilter, branchFilter, periodFilter, fromDate, toDate, statusFilter],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["sales-targets", listParams],
    queryFn: () => fetchSalesTargets(listParams),
    enabled: !!token && !permissionsLoading && canRead,
    staleTime: 0,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-sales-target"],
    queryFn: fetchBranches,
    enabled: !!token && !permissionsLoading && canRead,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-sales-target-filter", branchFilter],
    queryFn: () => fetchSalesmen({ branchId: branchFilter || undefined }),
    enabled: !!token && !permissionsLoading && canRead,
  });

  const formBranchId = form.branch_id || "";

  const { data: formUsers = [] } = useQuery({
    queryKey: ["users-sales-target-form", formBranchId],
    queryFn: () => fetchSalesmen({ branchId: formBranchId || undefined }),
    enabled: !!token && !permissionsLoading && canRead && dialogOpen,
  });

  const { data: stockItems = [], isLoading: stockItemsLoading } = useQuery({
    queryKey: ["stock-items-sales-target", formBranchId, stockItemSearch],
    queryFn: () =>
      fetchStockItems({
        search: stockItemSearch,
        branchId: formBranchId || undefined,
      }),
    enabled: !!token && !permissionsLoading && canRead && dialogOpen && !!formBranchId,
  });

  const targets = data?.data ?? [];
  const pagination = data?.pagination ?? {};
  const totalCount = pagination.total_count ?? targets.length;
  const totalPages = pagination.total_pages || 1;
  const currentPage = pagination.current_page || page;

  const filteredTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((row) => {
      const haystack = [
        row.salesman_name,
        row.branch_name,
        row.period_type,
        row.remarks,
        ...(row.items || []).map((item) => item.stock_item_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [targets, search]);

  const salesmanOptions = useMemo(
    () =>
      users.map((user) => ({
        value: getUserId(user),
        label: getUserDisplayName(user),
      })),
    [users],
  );

  const formSalesmanOptions = useMemo(
    () =>
      formUsers.map((user) => ({
        value: getUserId(user),
        label: getUserDisplayName(user),
      })),
    [formUsers],
  );

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: String(branch.id),
        label: branch.name || branch.branch_name || `Branch ${branch.id}`,
      })),
    [branches],
  );

  const stockItemOptions = useMemo(
    () =>
      stockItems.map((item) => ({
        value: String(item.id),
        label: item.name || item.item_name || `Item ${item.id}`,
      })),
    [stockItems],
  );

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (payload.id || payload.target_id) return updateSalesTarget(payload);
      return createSalesTarget(payload);
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: result.message || "Sales target saved successfully",
      });
      setDialogOpen(false);
      setForm(createEmptyForm());
      queryClient.invalidateQueries({ queryKey: ["sales-targets"] });
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (targetId) => deactivateSalesTarget(targetId),
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: result.message || "Sales target deactivated successfully",
      });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["sales-targets"] });
    },
    onError: (err) =>
      toast({
        title: "Error",
        description: err.message || "Failed to deactivate",
        variant: "destructive",
      }),
  });

  const openCreate = () => {
    setForm(createEmptyForm());
    setFormError(null);
    setStockItemSearch("");
    setTargetMetricMode("count");
    setShowItemTargets(false);
    setDialogOpen(true);
  };

  const handleFormBranchChange = (value) => {
    const nextBranch = value == null ? "" : String(value);
    setForm((prev) => ({
      ...prev,
      branch_id: nextBranch,
      salesman_id: "",
      salesman_name: "",
      items: showItemTargets ? [emptyItemRow()] : [],
    }));
    setStockItemSearch("");
  };

  const enableItemTargets = () => {
    setShowItemTargets(true);
    setForm((prev) => ({
      ...prev,
      items: prev.items?.length ? prev.items : [emptyItemRow()],
    }));
  };

  const openEdit = async (row) => {
    setFormError(null);
    try {
      const detail = row.items?.length ? row : await fetchSalesTargetById(row.id);
      const hasValueTarget =
        detail.target_order_value != null && String(detail.target_order_value) !== "";
      const hasCountTarget =
        detail.target_order_count != null && String(detail.target_order_count) !== "";
      const itemRows =
        detail.items?.length > 0
          ? detail.items.map((item) => ({
              id: item.id,
              stock_item_id: String(item.stock_item_id || ""),
              stock_item_name: item.stock_item_name || "",
              target_quantity:
                item.target_quantity != null ? String(item.target_quantity) : "",
              remarks: item.remarks || "",
            }))
          : [];
      setForm({
        id: detail.id,
        salesman_id: String(detail.salesman_id || ""),
        salesman_name: detail.salesman_name || "",
        branch_id: detail.branch_id != null ? String(detail.branch_id) : "",
        period_type: detail.period_type || "MONTHLY",
        period_start: detail.period_start || "",
        period_end: detail.period_end || "",
        target_order_count:
          detail.target_order_count != null ? String(detail.target_order_count) : "",
        target_order_value:
          detail.target_order_value != null ? String(detail.target_order_value) : "",
        remarks: detail.remarks || "",
        items: itemRows,
      });
      setTargetMetricMode(hasValueTarget && !hasCountTarget ? "value" : "count");
      setShowItemTargets(itemRows.length > 0);
      setDialogOpen(true);
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "Failed to load sales target",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.branch_id) {
      setFormError("Branch is required.");
      return;
    }
    if (!form.salesman_id) {
      setFormError("Salesman is required.");
      return;
    }
    if (!form.period_type) {
      setFormError("Period type is required.");
      return;
    }
    if (!form.period_start) {
      setFormError("Period start date is required.");
      return;
    }

    const items = showItemTargets ? buildItemsPayload(form.items) : [];
    const hasCount = targetMetricMode === "count" && form.target_order_count !== "";
    const hasValue = targetMetricMode === "value" && form.target_order_value !== "";
    if (!hasCount && !hasValue && items.length === 0) {
      setFormError("Provide a target count, target value, or item-wise targets.");
      return;
    }

    const payload = {
      ...(form.id ? { target_id: form.id, id: form.id } : {}),
      salesman_id: form.salesman_id,
      branch_id: form.branch_id || null,
      period_type: form.period_type,
      period_start: form.period_start,
      period_end: form.period_end || null,
      target_order_count: hasCount ? Number(form.target_order_count) : null,
      target_order_value: hasValue ? Number(form.target_order_value) : null,
      remarks: form.remarks || "",
    };

    if (showItemTargets || !form.id) {
      payload.items = items;
      payload.replace_items = true;
    }

    saveMutation.mutate(payload);
  };

  const handleMetricModeChange = (mode) => {
    setTargetMetricMode(mode);
    setForm((prev) => ({
      ...prev,
      target_order_count: mode === "count" ? prev.target_order_count : "",
      target_order_value: mode === "value" ? prev.target_order_value : "",
    }));
  };

  const updateItemRow = (index, patch) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], ...patch };
      return { ...prev, items };
    });
  };

  const addItemRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItemRow()] }));
  };

  const removeItemRow = (index) => {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: items.length ? items : [emptyItemRow()] };
    });
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
          <p className="text-gray-600">You do not have permission to view sales targets.</p>
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
                Sales Target
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage salesman targets and track achieved vs target for each period
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
                Refresh
              </Button>
              {canCreate ? (
                <Button onClick={openCreate} className="bg-blue-700 hover:bg-blue-800">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Target
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error.message}
            </div>
          ) : null}

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <div className="lg:col-span-2 xl:col-span-2 space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Search className="h-4 w-4 text-blue-700" />
                    Search
                  </Label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Salesman, branch, item..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-700" />
                    From
                  </Label>
                  <DateField
                    value={fromDate}
                    onChange={(value) => {
                      setFromDate(value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-700" />
                    To
                  </Label>
                  <DateField
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(value) => {
                      setToDate(value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-blue-700" />
                    Salesman
                  </Label>
                  <SearchableSelect
                    value={salesmanFilter}
                    options={salesmanOptions}
                    onChange={(value) => {
                      setSalesmanFilter(value);
                      setPage(1);
                    }}
                    placeholder="All salesmen"
                    clearable
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-blue-700" />
                    Branch
                  </Label>
                  <SearchableSelect
                    value={branchFilter}
                    options={branchOptions}
                    onChange={(value) => {
                      setBranchFilter(value);
                      setPage(1);
                    }}
                    placeholder="All branches"
                    clearable
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-700" />
                    Period
                  </Label>
                  <Select
                    value={periodFilter}
                    onValueChange={(value) => {
                      setPeriodFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All periods" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-blue-700" />
                    Status
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">
                Sales Targets ({totalCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-14">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : filteredTargets.length === 0 ? (
                <div className="px-4 py-14 text-center text-slate-500">
                  No sales targets found.
                </div>
              ) : (
                <div className={cn("overflow-x-auto", isFetching && "opacity-60")}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salesman</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="min-w-[140px]">Achievement</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTargets.map((row) => {
                        const statusMeta = achievementStatusMeta(row);
                        const achievedCount =
                          row.achieved_order_count ??
                          row.achievement?.achieved_order_count ??
                          0;
                        const achievedValue =
                          row.achieved_order_value ??
                          row.achievement?.achieved_order_value ??
                          0;
                        const achievementPct =
                          row.achievement_pct ?? row.achievement?.achievement_pct;
                        return (
                          <TableRow
                            key={row.id}
                            className={cn(
                              (row.is_achieved ||
                                row.achievement_status === "achieved") &&
                                "bg-emerald-50/40",
                            )}
                          >
                            <TableCell className="font-medium">
                              {row.salesman_name || "—"}
                            </TableCell>
                            <TableCell>{row.branch_name || "All branches"}</TableCell>
                            <TableCell>{periodTypeLabel(row.period_type)}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDisplayDate(row.period_start)} –{" "}
                              {formatPeriodEndDisplay(row.period_end)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="font-medium text-slate-900">
                                {achievedCount}
                                <span className="text-slate-400 font-normal">
                                  {" "}
                                  / {row.target_order_count ?? "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="font-medium text-emerald-700">
                                {formatCurrency(achievedValue)}
                              </div>
                              <div className="text-xs text-slate-500">
                                Target{" "}
                                {row.target_order_value != null
                                  ? formatCurrency(row.target_order_value)
                                  : "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-semibold tabular-nums text-slate-800">
                                {formatAchievementPct(achievementPct)}
                              </div>
                              <AchievementProgress pct={achievementPct} />
                              {(row.remaining_order_count != null ||
                                row.remaining_order_value != null ||
                                row.achievement?.remaining_order_count != null ||
                                row.achievement?.remaining_order_value != null) &&
                              !row.is_achieved &&
                              row.achievement_status !== "achieved" ? (
                                <div className="text-[11px] text-slate-500 mt-1">
                                  Left:{" "}
                                  {row.remaining_order_count ??
                                    row.achievement?.remaining_order_count ??
                                    "—"}{" "}
                                  ord
                                  {(row.remaining_order_value != null ||
                                    row.achievement?.remaining_order_value != null) && (
                                    <>
                                      {" · "}
                                      {formatCurrency(
                                        row.remaining_order_value ??
                                          row.achievement?.remaining_order_value,
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={cn("border", statusMeta.className)}
                              >
                                {statusMeta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {row.item_count ?? row.items?.length ?? 0}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setViewTarget(row)}
                                  title="View"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canUpdate && row.is_active !== false ? (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEdit(row)}
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                {canDelete && row.is_active !== false ? (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-red-600"
                                    onClick={() => setDeleteTarget(row)}
                                    title="Deactivate"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {totalPages > 1 ? (
                <div className="px-4 py-4 border-t flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Sales Target" : "Add Sales Target"}
            </DialogTitle>
            <DialogDescription>
              Set period targets for a salesman. Optionally add item-wise quantities.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Branch <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  value={form.branch_id}
                  options={branchOptions}
                  onChange={handleFormBranchChange}
                  placeholder="Select branch"
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Salesman <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  value={form.salesman_id}
                  options={
                    form.salesman_id &&
                    !formSalesmanOptions.some((opt) => opt.value === form.salesman_id)
                      ? [
                          {
                            value: form.salesman_id,
                            label: form.salesman_name || form.salesman_id,
                          },
                          ...formSalesmanOptions,
                        ]
                      : formSalesmanOptions
                  }
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      salesman_id: value == null ? "" : String(value),
                      salesman_name:
                        formSalesmanOptions.find((opt) => opt.value === String(value))
                          ?.label || "",
                    }))
                  }
                  placeholder={formBranchId ? "Select salesman" : "Select branch first"}
                  disabled={!formBranchId}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Period Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.period_type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, period_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_FORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Period Start <span className="text-red-500">*</span>
                </Label>
                <DateField
                  value={form.period_start}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, period_start: value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Period End</Label>
                <DateField
                  value={form.period_end}
                  min={form.period_start || undefined}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, period_end: value }))
                  }
                  placeholder="No expiry"
                />
                <p className="text-xs text-slate-500">Leave empty for no expiry.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
              <MetricModeToggle value={targetMetricMode} onChange={handleMetricModeChange} />
              <div className="flex-1 min-w-[180px] space-y-1.5">
                {targetMetricMode === "count" ? (
                  <>
                    <Label>Target Order Count</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.target_order_count}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          target_order_count: e.target.value,
                        }))
                      }
                      placeholder="Enter target count"
                    />
                  </>
                ) : (
                  <>
                    <Label>Target Order Value</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.target_order_value}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          target_order_value: e.target.value,
                        }))
                      }
                      placeholder="Enter target value"
                    />
                  </>
                )}
              </div>
              {!showItemTargets ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={enableItemTargets}
                  disabled={!formBranchId}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Additional item wise target
                </Button>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                rows={2}
              />
            </div>

            {showItemTargets ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-800 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-white shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">
                      Item-wise Targets
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addItemRow}
                    disabled={!formBranchId}
                    className="text-sm font-medium text-white/95 hover:text-white disabled:opacity-50"
                  >
                    + Add item
                  </button>
                </div>
                {!formBranchId ? (
                  <p className="text-sm text-slate-500 px-1">
                    Select a branch to load stock items.
                  </p>
                ) : null}
                <div className="space-y-3">
                  {form.items.map((row, index) => (
                    <div
                      key={`item-${index}-${row.id || "new"}`}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-lg border border-blue-100 p-3 bg-blue-50/30"
                    >
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-xs">Stock Item</Label>
                        <SearchableSelect
                          value={row.stock_item_id}
                          options={
                            row.stock_item_id &&
                            row.stock_item_name &&
                            !stockItemOptions.some(
                              (opt) => opt.value === row.stock_item_id,
                            )
                              ? [
                                  {
                                    value: row.stock_item_id,
                                    label: row.stock_item_name,
                                  },
                                  ...stockItemOptions,
                                ]
                              : stockItemOptions
                          }
                          onChange={(value) => {
                            const selected = stockItems.find(
                              (item) => String(item.id) === String(value),
                            );
                            updateItemRow(index, {
                              stock_item_id: value == null ? "" : String(value),
                              stock_item_name:
                                selected?.name ||
                                selected?.item_name ||
                                row.stock_item_name,
                            });
                          }}
                          onSearchChange={setStockItemSearch}
                          placeholder={
                            formBranchId ? "Select item" : "Select branch first"
                          }
                          loading={stockItemsLoading}
                          disabled={!formBranchId}
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.target_quantity}
                          onChange={(e) =>
                            updateItemRow(index, { target_quantity: e.target.value })
                          }
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-xs">Remarks</Label>
                        <Input
                          value={row.remarks}
                          onChange={(e) =>
                            updateItemRow(index, { remarks: e.target.value })
                          }
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItemRow(index)}
                          title="Remove item"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-blue-700 hover:bg-blue-800"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {form.id ? "Update Target" : "Create Target"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sales Target Details</DialogTitle>
          </DialogHeader>
          {viewTarget ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500">Salesman:</span>{" "}
                  <span className="font-medium">{viewTarget.salesman_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Branch:</span>{" "}
                  <span className="font-medium">
                    {viewTarget.branch_name || "All branches"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Period:</span>{" "}
                  <span className="font-medium">
                    {periodTypeLabel(viewTarget.period_type)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Dates:</span>{" "}
                  <span className="font-medium">
                    {formatDisplayDate(viewTarget.period_start)} –{" "}
                    {formatPeriodEndDisplay(viewTarget.period_end)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Target Orders:</span>{" "}
                  <span className="font-medium">
                    {viewTarget.target_order_count ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Target Value:</span>{" "}
                  <span className="font-medium text-emerald-700 inline-flex items-center gap-1">
                    <IndianRupee className="h-3.5 w-3.5" />
                    {viewTarget.target_order_value != null
                      ? formatCurrency(viewTarget.target_order_value)
                      : "—"}
                  </span>
                </div>
                <div>
                  <Badge variant={viewTarget.is_active === false ? "secondary" : "default"}>
                    {viewTarget.is_active === false ? "Inactive" : "Active"}
                  </Badge>
                </div>
              </div>

              {(() => {
                const statusMeta = achievementStatusMeta(viewTarget);
                const achievedCount =
                  viewTarget.achieved_order_count ??
                  viewTarget.achievement?.achieved_order_count ??
                  0;
                const achievedValue =
                  viewTarget.achieved_order_value ??
                  viewTarget.achievement?.achieved_order_value ??
                  0;
                const achievementPct =
                  viewTarget.achievement_pct ??
                  viewTarget.achievement?.achievement_pct;
                return (
                  <div
                    className={cn(
                      "rounded-xl border p-4 space-y-3",
                      viewTarget.is_achieved ||
                        viewTarget.achievement_status === "achieved"
                        ? "border-emerald-200 bg-emerald-50/70"
                        : "border-blue-100 bg-blue-50/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-semibold text-slate-900">
                        Achievement (Approved SO)
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn("border", statusMeta.className)}
                      >
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Orders</div>
                        <div className="text-base font-semibold tabular-nums">
                          {achievedCount}
                          <span className="text-slate-400 font-normal text-sm">
                            {" "}
                            / {viewTarget.target_order_count ?? "—"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Value</div>
                        <div className="text-base font-semibold tabular-nums text-emerald-700">
                          {formatCurrency(achievedValue)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Target{" "}
                          {viewTarget.target_order_value != null
                            ? formatCurrency(viewTarget.target_order_value)
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Progress</div>
                        <div className="text-base font-semibold tabular-nums">
                          {formatAchievementPct(achievementPct)}
                        </div>
                        <AchievementProgress pct={achievementPct} />
                      </div>
                    </div>
                    {(viewTarget.remaining_order_count != null ||
                      viewTarget.remaining_order_value != null ||
                      viewTarget.achievement?.remaining_order_count != null ||
                      viewTarget.achievement?.remaining_order_value != null) &&
                    !(
                      viewTarget.is_achieved ||
                      viewTarget.achievement_status === "achieved"
                    ) ? (
                      <p className="text-xs text-slate-600">
                        Remaining:{" "}
                        {viewTarget.remaining_order_count ??
                          viewTarget.achievement?.remaining_order_count ??
                          "—"}{" "}
                        orders
                        {(viewTarget.remaining_order_value != null ||
                          viewTarget.achievement?.remaining_order_value !=
                            null) && (
                          <>
                            {" · "}
                            {formatCurrency(
                              viewTarget.remaining_order_value ??
                                viewTarget.achievement?.remaining_order_value,
                            )}
                          </>
                        )}
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              {viewTarget.remarks ? (
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-slate-700">
                  {viewTarget.remarks}
                </div>
              ) : null}
              {(viewTarget.items || []).length > 0 ? (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Item Targets</h4>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewTarget.items.map((item) => (
                          <TableRow key={item.id || `${item.stock_item_id}-${item.target_quantity}`}>
                            <TableCell>
                              {item.stock_item_name || item.stock_item_id}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.target_quantity}
                            </TableCell>
                            <TableCell>{item.base_unit_name || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Sales Target?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the target for {deleteTarget?.salesman_name} (
              {formatDisplayDate(deleteTarget?.period_start)} –{" "}
              {formatPeriodEndDisplay(deleteTarget?.period_end)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget?.id) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Loader isLoading={isLoading} text="Loading sales targets" />
    </div>
  );
}
