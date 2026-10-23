import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import {
  Settings,
  ArrowRightLeft,
  ArrowLeft,
  Plus,
  Search,
  Eye,
  Pencil,
  PackageCheck,
  Truck,
  HardHat,
  Calendar,
  CalendarIcon,
  Menu,
  X,
  CheckCircle,
  Clock,
  Trash2,
  Mic,
  Square,
  Loader2,
  Play,
  Pause,
  Check,
  ChevronsUpDown,
  Package,
  Building2,
  User,
  Download,
} from "lucide-react";

import { uploadAudioRecording } from "@/lib/purchaseOrderVoiceUpload";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const MODULE = "stock_transfer";

const COLUMN_DEFS = [
  { key: "voucher", label: "Voucher no.", cellClass: "whitespace-nowrap font-medium text-slate-900" },
  { key: "date", label: "Transfer date", cellClass: "whitespace-nowrap text-slate-600" },
  { key: "route", label: "Source → Destination", cellClass: "max-w-[340px]" },
  { key: "items", label: "Items", align: "right", cellClass: "text-right tabular-nums" },
  { key: "transit", label: "Transit", cellClass: "whitespace-nowrap" },
  { key: "dispatched", label: "Dispatched", align: "right", cellClass: "text-right font-semibold tabular-nums text-blue-600" },
  { key: "received", label: "Received", align: "right", cellClass: "text-right font-semibold tabular-nums text-green-600" },
  { key: "status", label: "Status", cellClass: "" },
  { key: "dispatchedBy", label: "Dispatched by", cellClass: "whitespace-nowrap" },
];
const DEFAULT_VISIBLE_COLUMNS = ["voucher", "date", "route", "dispatched", "received", "status"];
const COLUMN_STORAGE_KEY = "stock-transfer-visible-columns";

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

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "dispatched", label: "Dispatched" },
  { value: "partially_received", label: "Partially Received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

const TRANSIT_OPTIONS = [
  { value: "vehicle", label: "Vehicle" },
  { value: "hamali", label: "Hamali / Labour" },
];

const ITEM_GROUPING_FILTER_OPTIONS = [
  "Raw Material",
  "Process Machine",
  "Finished Materials",
  "PO Material",
  "SO Material",
  "Bags/ Bardans",
];

const STOCK_BALANCE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

const toDdMmYyyy = (d) => {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const ddMmYyyyToIso = (text) => {
  const t = String(text || "").trim();
  const m = t.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const isoToDdMmYyyy = (iso) => {
  const t = String(iso || "").trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const todayDdMmYyyy = () => toDdMmYyyy(new Date());

const formatDateForApi = (date) => (date ? format(new Date(date), "dd-MM-yyyy") : "");

const nowDdMmYyyyHms = () => {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
};

const ddMmYyyyHmsToDatetimeLocal = (text) => {
  const t = String(text || "").trim();
  const m = t.match(
    /^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return "";
  const now = new Date();
  const hh = m[4] ?? String(now.getHours()).padStart(2, "0");
  const mi = m[5] ?? String(now.getMinutes()).padStart(2, "0");
  return `${m[3]}-${m[2]}-${m[1]}T${hh}:${mi}`;
};

const resolveReceivedAtForSubmit = (value) => {
  const raw = String(value || "").trim();
  if (/\d{1,2}:\d{2}/.test(raw)) {
    return raw;
  }
  return nowDdMmYyyyHms();
};

const datetimeLocalToDdMmYyyyHms = (iso) => {
  const t = String(iso || "").trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}:00`;
};

const DEFAULT_BATCH_NAME = "Primary";

const statusBadge = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "received") return "bg-green-100 text-green-800 border-green-300";
  if (s === "partially_received") return "bg-amber-100 text-amber-800 border-amber-300";
  if (s === "dispatched") return "bg-blue-100 text-blue-800 border-blue-300";
  if (s === "cancelled") return "bg-red-100 text-red-800 border-red-300";
  return "bg-gray-100 text-gray-800 border-gray-300";
};

const statusIcon = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "received") return <CheckCircle className="h-3.5 w-3.5" />;
  if (s === "partially_received") return <PackageCheck className="h-3.5 w-3.5" />;
  if (s === "dispatched") return <Truck className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

const canEditOrReceive = (status) => {
  const s = String(status || "").toLowerCase();
  return ["draft", "dispatched", "partially_received"].includes(s);
};

const godownBranchId = (godown) => godown?.branch_id ?? godown?.branchId ?? "";

const godownsForBranch = (godowns, branchId, branches) => {
  if (!branchId) return [];
  const branchName = (branches || [])
    .find((b) => String(b.id) === String(branchId))
    ?.name?.trim()
    .toLowerCase();
  return (godowns || []).filter((g) => {
    const gid = godownBranchId(g);
    if (gid && String(gid) === String(branchId)) return true;
    if (branchName) {
      const gBranch = String(g.branch ?? g.branch_name ?? "").trim().toLowerCase();
      return gBranch === branchName;
    }
    return false;
  });
};

const fetchGodownsForBranch = async (branchId) => {
  if (!branchId) return [];
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/get-godowns/?branch_id=${encodeURIComponent(branchId)}`
  );
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
};

const emptyItemRow = () => ({
  stock_item_id: "",
  stock_item_name: "",
  source_godown_id: "",
  source_batch_name: "",
  batch_name: "",
  uom_id: "",
  uom_name: "",
  dispatched_qty: "",
  closing_balance: "",
  batch_qty: "",
});

const emptyDestinationRow = () => ({
  destination_godown_id: "",
  destination_batch_name: DEFAULT_BATCH_NAME,
  received_qty: "",
  remarks: "",
});

const computeItemPendingQty = (line) => {
  const pending =
    Number(line?.dispatched_qty ?? 0) - Number(line?.received_qty ?? 0);
  return pending > 0.0005 ? pending : 0;
};

const VOICE_UPLOAD_FOLDER = "CPxGrowth/stock_transfer_voice";

const looksLikeAudioUrl = (value) => {
  if (!value) return false;
  const s = String(value).trim().toLowerCase();
  return (
    s.startsWith("http://") || s.startsWith("https://")
  ) && /\.(webm|mp3|m4a|ogg|wav|mp4|aac)(\?.*)?$/.test(s);
};

const formatClosingBalance = (value, unit) => {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const trimmed = num
    .toFixed(3)
    .replace(/\.?0+$/, "");
  return unit ? `${trimmed} ${unit}` : trimmed;
};

const parseQtyLimit = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "object") {
    const primary =
      value?.primary_qty ??
      value?.qty ??
      value?.current_balance ??
      value?.opening_balance;
    if (primary !== undefined) return parseQtyLimit(primary);
    const fullText = value?.full_text ?? value?.text ?? "";
    if (fullText) return parseQtyLimit(fullText);
    return null;
  }
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return null;
  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;
  const matched = text.match(/-?\d+(\.\d+)?/);
  if (!matched) return null;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Max dispatch qty for a row (batch current_balance preferred, else item current_balance). */
const getDispatchQtyLimit = (row) => {
  const batchLimit = parseQtyLimit(row?.batch_qty);
  const itemLimit = parseQtyLimit(row?.closing_balance);
  if (batchLimit != null && itemLimit != null) return Math.min(batchLimit, itemLimit);
  if (batchLimit != null) return batchLimit;
  if (itemLimit != null) return itemLimit;
  return null;
};

const formatQtyLimitLabel = (limit, unit) => {
  const trimmed = Number(limit)
    .toFixed(3)
    .replace(/\.?0+$/, "");
  return unit ? `${trimmed} ${unit}` : trimmed;
};

const isDispatchQtyOverLimit = (qtyValue, row) => {
  const qty = Number(qtyValue);
  const limit = getDispatchQtyLimit(row);
  if (!Number.isFinite(qty) || limit == null) return false;
  return qty > limit + 0.0005;
};

function SearchableBatchSelect({
  value,
  options,
  placeholder = DEFAULT_BATCH_NAME,
  disabled = false,
  onValueChange,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value || "");

  useEffect(() => {
    setText(value || "");
  }, [value]);

  const batchOptions =
    Array.isArray(options) && options.length > 0
      ? options
      : [{ name: DEFAULT_BATCH_NAME, qty: "" }];

  const commitValue = (next) => {
    const normalized = String(next || "").trim() || DEFAULT_BATCH_NAME;
    setText(normalized);
    onValueChange?.(normalized);
  };

  return (
    <div className="flex gap-1">
      <Input
        className="h-9 bg-white"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onValueChange?.(next);
        }}
        onBlur={() => {
          if (!String(text || "").trim()) {
            commitValue(DEFAULT_BATCH_NAME);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="h-9 w-9 shrink-0"
            aria-label="Browse batches"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0 z-50" align="end">
          <Command>
            <CommandInput placeholder="Search batch..." />
            <CommandList>
              <CommandEmpty>No batch found.</CommandEmpty>
              <CommandGroup>
                {batchOptions.map((b, idx) => {
                  const batchName = String(b?.name || "").trim() || DEFAULT_BATCH_NAME;
                  return (
                    <CommandItem
                      key={`batch-option-${batchName}-${idx}`}
                      value={`${batchName} ${(b?.qty ?? "").toString()}`}
                      onSelect={() => {
                        commitValue(batchName);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${value === batchName ? "opacity-100 text-blue-600" : "opacity-0"
                          }`}
                      />
                      <span className="truncate">{batchName}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function StockTransfer() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    isLoading: permissionsLoading,
  } = useUserPermissions();

  const canRead = hasReadPermission(MODULE);
  const canCreate = hasCreatePermission(MODULE);
  const canUpdate = hasUpdatePermission(MODULE);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transitFilter, setTransitFilter] = useState("all");
  const [sourceBranchFilter, setSourceBranchFilter] = useState("all");
  const [destBranchFilter, setDestBranchFilter] = useState("all");
  const [fromDate, setFromDate] = useState(() => startOfDay(new Date()));
  const [toDate, setToDate] = useState(() => endOfDay(new Date()));
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);

  useEffect(() => {
    const now = new Date();
    if (dateRangePreset === "today") {
      setFromDate(startOfDay(now));
      setToDate(endOfDay(now));
    } else if (dateRangePreset === "weekly") {
      setFromDate(startOfWeek(now, { weekStartsOn: 1 }));
      setToDate(endOfWeek(now, { weekStartsOn: 1 }));
    } else if (dateRangePreset === "monthly") {
      setFromDate(startOfMonth(now));
      setToDate(endOfMonth(now));
    }
  }, [dateRangePreset]);

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);

  // ---------------- Reference data ----------------
  const godownsQuery = useQuery({
    queryKey: ["stock-transfer/godowns"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/get-godowns/`);
      const data = await res.json();
      return Array.isArray(data?.data) ? data.data : [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    staleTime: 5 * 60 * 1000,
  });
  const godowns = godownsQuery.data || [];

  const hamaliGroupsQuery = useQuery({
    queryKey: ["stock-transfer/hamali-groups"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/hamali-groups/`);
      const data = await res.json();
      return Array.isArray(data?.data) ? data.data : [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    staleTime: 5 * 60 * 1000,
  });
  const hamaliGroups = hamaliGroupsQuery.data || [];

  const branchesQuery = useQuery({
    queryKey: ["godown-transfer/branches"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const data = await res.json();
      const rows = data?.data ?? data?.branches ?? data;
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    staleTime: 5 * 60 * 1000,
  });
  const branches = branchesQuery.data || [];

  // Stock items lookup (POST /api/stock-items-list/), keyed by source godown
  const fetchStockItems = async ({ godownName, search, grouping, balance, page, perPage = 50 }) => {
    if (!godownName) return { rows: [], pagination: null };
    const body = {
      list_mode: "source",
      stock_group: "",
      stock_category: "",
      is_active: true,
      new_page: page || 1,
      per_page: perPage,
      godown_name: godownName,
      godown: godownName,
    };
    if (grouping) body.type = grouping;
    if ((search || "").trim()) body.search = search.trim();
    if (balance === "in_stock") body.in_stock = true;
    if (balance === "out_of_stock") body.in_stock = false;
    const res = await apiRequest("POST", `${API_BASE_URL}/api/stock-items-list/`, body);
    const payload = await res.json();
    if (payload?.status && Number(payload.status) >= 400) {
      throw new Error(payload?.message || "Failed to fetch stock items");
    }
    return {
      rows: Array.isArray(payload?.data) ? payload.data : [],
      pagination: payload?.pagination || null,
    };
  };

  // Batch lookup for a (godown, item) pair
  const fetchBatchOptions = async ({ godownName, itemName }) => {
    if (!godownName || !itemName) return [{ name: "Primary Batch", qty: "" }];
    const res = await apiRequest("POST", `${API_BASE_URL}/api/item-lot-details/`, {
      item_name: itemName,
      godown_name: godownName,
    });
    const payload = await res.json();
    const raw = payload?.batch_allocations || [];
    const mapped = raw
      .map((row) => ({
        name: String(row.batch_name || row.batch || row.name || "Primary Batch").trim(),
        qty: parseQtyLimit(row.current_balance ?? row.opening_balance ?? row.qty ?? ""),
      }))
      .filter((x) => x.name);
    return mapped.length > 0 ? mapped : [{ name: "Primary Batch", qty: "" }];
  };

  // ---------------- Vouchers list ----------------
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (transitFilter !== "all") p.set("transit_mode", transitFilter);
    if (sourceBranchFilter !== "all") p.set("source_branch_id", sourceBranchFilter);
    if (destBranchFilter !== "all") p.set("destination_branch_id", destBranchFilter);
    if (fromDate) p.set("start_date", formatDateForApi(fromDate));
    if (toDate) p.set("end_date", formatDateForApi(toDate));
    p.set("new_page", String(currentPage));
    p.set("per_page", "20");
    return p.toString();
  }, [search, statusFilter, transitFilter, sourceBranchFilter, destBranchFilter, fromDate, toDate, currentPage]);

  const vouchersQuery = useQuery({
    queryKey: ["godown-transfer/vouchers", queryString],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/stock-transfer-vouchers/?${queryString}`
      );
      const data = await res.json();
      return data || {};
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    keepPreviousData: true,
  });

  const vouchers = vouchersQuery.data?.data || [];
  const summary = vouchersQuery.data?.summary || {};
  const totalCount = vouchersQuery.data?.total_count || 0;
  const pagination = vouchersQuery.data?.pagination || {};

  const openAdd = () => {
    setSelectedVoucherId(null);
    setAddOpen(true);
  };
  const openEdit = (id) => {
    setSelectedVoucherId(id);
    setEditOpen(true);
  };
  const openDetail = (id) => {
    setSelectedVoucherId(id);
    setDetailOpen(true);
  };
  const openReceive = (id) => {
    setSelectedVoucherId(id);
    setReceiveOpen(true);
  };

  const refreshList = () => {
    queryClient.invalidateQueries({ queryKey: ["godown-transfer/vouchers"] });
    queryClient.invalidateQueries({ queryKey: ["godown-transfer/detail"] });
    queryClient.invalidateQueries({ queryKey: ["godown-transfer/receive-detail"] });
    queryClient.invalidateQueries({ queryKey: ["godown-transfer/edit-detail"] });
  };

  if (permissionsLoading) {
    return <Loader />;
  }

  if (!canRead) {
    return (
      <div className="flex h-screen">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar isOpen={isMobileSidebarOpen} setIsOpen={setIsMobileSidebarOpen} />
        )}
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="py-10 text-center">
              <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
              <p className="text-sm text-gray-600">
                You do not have permission to view godown transfer vouchers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    Boolean(search) ||
    statusFilter !== "all" ||
    transitFilter !== "all" ||
    sourceBranchFilter !== "all" ||
    destBranchFilter !== "all" ||
    dateRangePreset !== "today";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTransitFilter("all");
    setSourceBranchFilter("all");
    setDestBranchFilter("all");
    setDateRangePreset("today");
    setCurrentPage(1);
  };

  const summaryTiles = [
    { label: "Total vouchers", value: summary.total_vouchers || 0, icon: ArrowRightLeft, tone: "bg-blue-50 text-blue-600" },
    { label: "Dispatched", value: summary.dispatched_vouchers || 0, icon: Truck, tone: "bg-amber-50 text-amber-600" },
    { label: "Received", value: summary.received_vouchers || 0, icon: CheckCircle, tone: "bg-green-50 text-green-600" },
  ];

  const labelClass = "text-xs font-medium text-slate-600";
  const thClass = "h-10 whitespace-nowrap px-4 text-xs font-medium text-slate-500";
  const tdClass = "px-4 py-2.5";
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

  const renderCell = (key, v) => {
    switch (key) {
      case "voucher":
        return <span className="font-mono">{v.voucher_number || dash}</span>;
      case "date":
        return v.transfer_date || dash;
      case "route":
        return (
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{v.source_branch_name || "-"}</span>
            <span className="shrink-0 text-slate-400">→</span>
            <span className="truncate">{v.destination_branch_name || "-"}</span>
          </span>
        );
      case "items":
        return Number(v.items_count) > 0 ? v.items_count : dash;
      case "transit":
        return (
          <span className="inline-flex items-center gap-1.5">
            {v.transit_mode === "hamali" ? (
              <HardHat className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <Truck className="h-3.5 w-3.5 text-slate-500" />
            )}
            {v.transit_mode === "hamali" ? "Hamali" : "Vehicle"}
            {v.vehicle_number ? ` · ${v.vehicle_number}` : ""}
          </span>
        );
      case "dispatched":
        return v.total_dispatched_qty || 0;
      case "received":
        return v.total_received_qty || 0;
      case "status":
        return (
          <Badge className={`flex w-fit items-center gap-1 border text-xs ${statusBadge(v.status)}`}>
            {statusIcon(v.status)}
            <span>{v.status.charAt(0).toUpperCase() + v.status.slice(1).toLowerCase()}</span>
          </Badge>
        );
      case "dispatchedBy":
        return v.dispatched_by || dash;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} setIsOpen={setIsMobileSidebarOpen} />
      )}

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
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">Godown Transfer</h1>
              <p className="hidden truncate text-sm text-slate-500 sm:block">
                Transfer stock between branches; dispatch from source godowns and receive at destination godowns
              </p>
            </div>
          </div>
          {canCreate && (
            <Button
              size="sm"
              onClick={openAdd}
              aria-label="Add voucher entry"
              className="h-9 shrink-0 gap-2 bg-black hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Voucher Entry</span>
            </Button>
          )}
        </div>

        {/* Main Content */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
            {/* Summary */}
            <Card className="overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-3">
                {summaryTiles.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="flex items-center gap-3 bg-white px-4 py-3">
                    <div className={`rounded-md p-2 ${tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-xl font-semibold leading-tight tabular-nums text-slate-900">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Filters */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[150px_150px_150px_170px_minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="dateRangePreset" className={labelClass}>Date range</Label>
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
                          className={`h-9 w-full justify-start px-3 text-left font-normal ${dateRangePreset !== "custom" ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">{fromDate ? formatDateForApi(fromDate) : "From date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`from-${fromDate?.getTime() || "null"}`}
                          mode="single"
                          selected={fromDate}
                          onSelect={(date) => {
                            setFromDate(date);
                            if (date && toDate && date > toDate) setToDate(date);
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
                          className={`h-9 w-full justify-start px-3 text-left font-normal ${dateRangePreset !== "custom" ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">{toDate ? formatDateForApi(toDate) : "To date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`to-${toDate?.getTime() || "null"}`}
                          mode="single"
                          selected={toDate}
                          onSelect={(date) => {
                            setToDate(date);
                            setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                          }}
                          disabled={[
                            fromDate ? { before: fromDate } : null,
                            { after: new Date() },
                          ].filter(Boolean)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => {
                        setCurrentPage(1);
                        setStatusFilter(v);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* <div className="lg:col-span-2">
                    <Label className="mb-1.5 block text-sm font-medium">Transit</Label>
                    <Select
                      value={transitFilter}
                      onValueChange={(v) => {
                        setCurrentPage(1);
                        setTransitFilter(v);
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {TRANSIT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div> */}
                  {/* <div className="lg:col-span-2">
                    <Label className="mb-1.5 block text-sm font-medium">Source Godown</Label>
                    <Select
                      value={sourceGodownFilter}
                      onValueChange={(v) => {
                        setCurrentPage(1);
                        setSourceGodownFilter(v);
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {godowns.map((g) => (
                          <SelectItem key={`src-${g.id}`} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div> */}
                  {/* <div className="lg:col-span-2">
                    <Label className="mb-1.5 block text-sm font-medium">Destination Godown</Label>
                    <Select
                      value={destGodownFilter}
                      onValueChange={(v) => {
                        setCurrentPage(1);
                        setDestGodownFilter(v);
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {godowns.map((g) => (
                          <SelectItem key={`dst-${g.id}`} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div> */}
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="voucherSearch" className={labelClass}>Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="voucherSearch"
                        placeholder="Voucher #, vehicle, driver, branch, remarks..."
                        value={search}
                        onChange={(e) => {
                          setCurrentPage(1);
                          setSearch(e.target.value);
                        }}
                        className="h-9 pl-9 pr-9"
                      />
                      {search && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPage(1);
                            setSearch("");
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                        >
                          <span className="sr-only">Clear search</span>
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="h-9 sm:col-span-2 lg:col-span-1"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                  >
                    Clear filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Listing */}
            <Card className="overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  Godown Transfers
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {totalCount}
                  </Badge>
                </h2>
              </div>

              {vouchersQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : vouchers.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <ArrowRightLeft className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-base font-medium text-slate-900">No Stock Transfers Found</h3>
                  <p className="mt-1 text-sm text-slate-500">Adjust your filters or create a new voucher.</p>
                  {canCreate && (
                    <Button onClick={openAdd} className="mt-4 h-9 gap-2 bg-black hover:bg-gray-800">
                      <Plus className="h-4 w-4" /> Add Voucher Entry
                    </Button>
                  )}
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
                      {vouchers.map((v) => {
                        const canAct = canEditOrReceive(v.status);
                        return (
                          <TableRow key={v.id}>
                            {activeColumns.map((col) => (
                              <TableCell key={col.key} className={`${tdClass} ${col.cellClass}`}>
                                {renderCell(col.key, v)}
                              </TableCell>
                            ))}
                            <TableCell className={tdClass}>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => openDetail(v.id)}
                                  title="View Details"
                                  aria-label="View Details"
                                  className="h-8 w-8 border-black bg-black p-0 text-white hover:bg-gray-700"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canUpdate && canAct && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEdit(v.id)}
                                    title="Edit Voucher"
                                    aria-label="Edit Voucher"
                                    className="h-8 w-8 border-blue-600 p-0 text-blue-600 hover:bg-blue-50"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canUpdate && canAct && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openReceive(v.id)}
                                    title="Receive at destination godowns"
                                    aria-label="Receive at destination godowns"
                                    className="h-8 w-8 border-green-600 p-0 text-green-600 hover:bg-green-50"
                                  >
                                    <PackageCheck className="h-4 w-4" />
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
              )}

              {pagination.total_pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                  <div className="text-slate-600">
                    Page {pagination.current_page} of {pagination.total_pages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      disabled={!pagination.has_previous}
                      onClick={() => setCurrentPage(pagination.previous_page || 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      disabled={!pagination.has_next}
                      onClick={() => setCurrentPage(pagination.next_page || 1)}
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

      {/* Add dialog */}
      {addOpen && (
        <VoucherFormDialog
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          branches={branches}
          godowns={godowns}
          hamaliGroups={hamaliGroups}
          fetchStockItems={fetchStockItems}
          fetchBatchOptions={fetchBatchOptions}
          onSuccess={() => {
            setAddOpen(false);
            refreshList();
          }}
        />
      )}

      {/* Edit dialog */}
      {editOpen && selectedVoucherId && (
        <VoucherFormDialog
          mode="edit"
          voucherId={selectedVoucherId}
          open={editOpen}
          onOpenChange={setEditOpen}
          branches={branches}
          godowns={godowns}
          hamaliGroups={hamaliGroups}
          fetchStockItems={fetchStockItems}
          fetchBatchOptions={fetchBatchOptions}
          onSuccess={() => {
            setEditOpen(false);
            refreshList();
          }}
        />
      )}

      {/* Detail dialog */}
      {detailOpen && selectedVoucherId && (
        <VoucherDetailDialog
          voucherId={selectedVoucherId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}

      {/* Receive dialog */}
      {receiveOpen && selectedVoucherId && (
        <ReceiveVoucherDialog
          voucherId={selectedVoucherId}
          open={receiveOpen}
          onOpenChange={setReceiveOpen}
          godowns={godowns}
          fetchBatchOptions={fetchBatchOptions}
          onSuccess={() => {
            setReceiveOpen(false);
            refreshList();
          }}
        />
      )}
      <Loader isLoading={vouchersQuery.isLoading} text="Loading stock transfers" />
    </div>
  );
}

/* =========================================================================
   Voice recorder field — record audio, upload via vouchersApp/upload, return
   the Cloudinary URL through `onChange`. Mirrors the pattern in
   create-sales-order.jsx.
   ========================================================================= */

function VoiceRecorderField({
  value,
  onChange,
  label,
  helpText = "Tap the mic to record. The audio URL will be saved as remarks.",
  disabled = false,
}) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      stopStream();
    };
  }, []);

  const handleMicClick = async () => {
    if (isUploading || disabled) return;

    if (isRecording) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") recorder.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Microphone unavailable",
        description: "Your browser does not support voice recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        stopStream();
        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        if (!blob.size) {
          toast({
            title: "No recording",
            description: "Record again and speak before stopping.",
            variant: "destructive",
          });
          return;
        }
        setIsUploading(true);
        try {
          const url = await uploadAudioRecording(blob, VOICE_UPLOAD_FOLDER);
          onChange(url);
          toast({ title: "Voice note saved" });
        } catch (err) {
          toast({
            title: "Upload failed",
            description: err?.message || "Could not upload voice note.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      };
      recorder.onerror = () => {
        setIsRecording(false);
        stopStream();
        toast({
          title: "Recording error",
          description: "Could not complete voice recording.",
          variant: "destructive",
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      stopStream();
      toast({
        title: "Microphone access denied",
        description: err?.message || "Allow microphone access to record a voice note.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-1.5">
      {label ? <Label>{label}</Label> : null}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={isUploading || disabled}
          onClick={handleMicClick}
          title={
            isUploading
              ? "Uploading voice note..."
              : isRecording
                ? "Stop recording"
                : "Record voice remark"
          }
          aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          {isRecording ? (
            <div className="text-xs text-red-600 flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Recording…
            </div>
          ) : isUploading ? (
            <div className="text-xs text-muted-foreground">Uploading voice note…</div>
          ) : value ? (
            <div className="flex items-center gap-2 min-w-0">
              <AudioPreview url={value} compact />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-700"
                onClick={() => onChange("")}
                disabled={disabled}
                title="Remove voice note"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AudioPreview({ url, compact = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => { });
    } else {
      a.pause();
    }
  };

  return (
    <div className={`flex items-center gap-2 min-w-0 ${compact ? "text-xs" : "text-sm"}`}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-7 w-7 shrink-0"
        onClick={toggle}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <audio
        ref={audioRef}
        src={url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate text-blue-600 hover:underline"
        title={url}
      >
        Voice note
      </a>
    </div>
  );
}

/* =========================================================================
   Stock item picker — Radix Select with embedded filters (grouping / balance /
   search) used inside add/edit dialog rows. Modeled on add-stock-journal.jsx
   source section so the user gets a consistent UX.
   ========================================================================= */

function StockItemPickerContent({
  godownName,
  filters,
  setFilters,
  selectedName,
  fetchStockItems,
}) {
  const { search, grouping, balance } = filters;
  const [localSearch, setLocalSearch] = useState(search || "");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const debounceRef = useRef(null);

  const load = async (nextPage = 1, append = false, overrideSearch) => {
    if (!godownName) return;
    setLoading(true);
    try {
      const { rows: nextRows, pagination: nextPagination } = await fetchStockItems({
        godownName,
        search: overrideSearch != null ? overrideSearch : localSearch,
        grouping,
        balance,
        page: nextPage,
      });
      setPagination(nextPagination);
      setRows((prev) => {
        const merged = append ? [...prev, ...nextRows] : nextRows;
        return merged.filter(
          (it, idx, arr) => arr.findIndex((x) => x.id === it.id) === idx
        );
      });
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [godownName, grouping, balance]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: localSearch }));
      load(1, false, localSearch);
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const selectedInList = selectedName
    ? rows.some((it) => String(it.name || "").trim() === String(selectedName).trim())
    : false;

  const getItemCount = (item) => {
    const raw =
      item?.total_closing_balance ??
      item?.current_balance ??
      item?.available_qty ??
      item?.qty ??
      item?.quantity ??
      item?.balance ??
      item?.closing_balance ??
      0;
    const num = Number(raw);
    if (Number.isFinite(num)) {
      const formatted = num.toFixed(3).replace(/\.?0+$/, "");
      return formatted === "" ? "0" : formatted;
    }
    const fallback = String(raw ?? "").trim();
    return fallback === "" ? "0" : fallback;
  };

  return (
    <>
      <div
        className="p-2 border-b space-y-2 bg-muted/30"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Item grouping</Label>
            <Select
              value={grouping || "__all__"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, grouping: v === "__all__" ? "" : v }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[100]">
                <SelectItem value="__all__">All groupings</SelectItem>
                {ITEM_GROUPING_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stock balance</Label>
            <Select
              value={balance}
              onValueChange={(v) => setFilters((f) => ({ ...f, balance: v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[100]">
                {STOCK_BALANCE_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Search item..."
          className="h-8"
        />
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">Loading items...</div>
      ) : null}
      {!loading && rows.length === 0 && !selectedName ? (
        <div className="py-4 text-center text-xs text-muted-foreground">No items found.</div>
      ) : null}
      {selectedName && !selectedInList ? (
        <SelectItem
          key={`selected-${selectedName}`}
          value={String(selectedName)}
          className="pr-2 [&>span:last-child]:w-full [&>span:last-child]:min-w-0"
        >
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <span className="truncate">{selectedName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">0</span>
          </div>
        </SelectItem>
      ) : null}
      {rows.map((it) => (
        <SelectItem
          key={`item-${it.id}`}
          value={it.name}
          className="pr-2 [&>span:last-child]:w-full [&>span:last-child]:min-w-0"
        >
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <span className="truncate">{it.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {getItemCount(it)}
            </span>
          </div>
        </SelectItem>
      ))}
      {pagination?.has_next ? (
        <div className="p-2 border-t" onPointerDown={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              load(pagination.next_page || page + 1, true);
            }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/* =========================================================================
   Create / Edit voucher dialog
   ========================================================================= */

function VoucherFormDialog({
  mode,
  voucherId,
  open,
  onOpenChange,
  branches,
  godowns,
  hamaliGroups,
  fetchStockItems,
  fetchBatchOptions,
  onSuccess,
}) {
  const { toast } = useToast();

  const [form, setForm] = useState({
    source_branch_id: "",
    destination_branch_id: "",
    transfer_date: todayDdMmYyyy(),
    transit_mode: "vehicle",
    vehicle_number: "",
    driver_name: "",
    hamali_group_id: "",
    dispatch_remarks: "",
  });
  const [items, setItems] = useState([emptyItemRow()]);
  const [pickerFiltersByRow, setPickerFiltersByRow] = useState({});
  const [godownSearchByRow, setGodownSearchByRow] = useState({});
  const [batchOptionsByRow, setBatchOptionsByRow] = useState({});
  const [batchLoadingByRow, setBatchLoadingByRow] = useState({});
  const [isTransferDatePickerOpen, setIsTransferDatePickerOpen] = useState(false);

  const selectedTransferDate = useMemo(() => {
    const iso = ddMmYyyyToIso(form.transfer_date);
    if (!iso) return undefined;
    const date = new Date(`${iso}T00:00:00`);
    return isNaN(date.getTime()) ? undefined : date;
  }, [form.transfer_date]);

  const sourceGodownsQuery = useQuery({
    queryKey: ["godown-transfer/source-godowns", form.source_branch_id],
    queryFn: () => fetchGodownsForBranch(form.source_branch_id),
    enabled: open && !!form.source_branch_id,
    staleTime: 60 * 1000,
  });
  const sourceGodowns =
    sourceGodownsQuery.data ??
    godownsForBranch(godowns, form.source_branch_id, branches);

  const godownNameById = (godownId) => {
    const g =
      sourceGodowns.find((x) => String(x.id) === String(godownId)) ||
      godowns.find((x) => String(x.id) === String(godownId));
    return g?.name || "";
  };

  // Preload existing voucher when editing
  const detailQuery = useQuery({
    queryKey: ["godown-transfer/edit-detail", voucherId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/stock-transfer-vouchers/${voucherId}/`
      );
      const data = await res.json();
      return data?.data || null;
    },
    enabled: mode === "edit" && !!voucherId,
  });

  useEffect(() => {
    if (mode === "edit" && detailQuery.data) {
      const d = detailQuery.data;
      setForm({
        source_branch_id: d.source_branch_id ? String(d.source_branch_id) : "",
        destination_branch_id: d.destination_branch_id ? String(d.destination_branch_id) : "",
        transfer_date: d.transfer_date || todayDdMmYyyy(),
        transit_mode: d.transit_mode || "vehicle",
        vehicle_number: d.vehicle_number || "",
        driver_name: d.driver_name || "",
        hamali_group_id: d.hamali_group_id ? String(d.hamali_group_id) : "",
        dispatch_remarks: d.dispatch_remarks || "",
      });
      setItems(
        (d.items || []).map((line) => ({
          stock_item_id: line.stock_item_id ? String(line.stock_item_id) : "",
          stock_item_name: line.stock_item_name || "",
          source_godown_id: line.source_godown_id ? String(line.source_godown_id) : "",
          source_batch_name: line.source_batch_name || line.batch_name || "",
          batch_name: line.source_batch_name || line.batch_name || "",
          uom_id: line.uom_id ? String(line.uom_id) : "",
          uom_name: line.uom_name || "",
          dispatched_qty: line.dispatched_qty != null ? String(line.dispatched_qty) : "",
          closing_balance: "",
          batch_qty: "",
        }))
      );
    }
  }, [mode, detailQuery.data]);

  const updateRow = (idx, patch) =>
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setItems((rows) => [...rows, emptyItemRow()]);
  const removeRow = (idx) =>
    setItems((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)));

  const getRowFilters = (idx) =>
    pickerFiltersByRow[idx] || { search: "", grouping: "", balance: "all" };
  const setRowFilters = (idx, updater) =>
    setPickerFiltersByRow((prev) => {
      const current = prev[idx] || { search: "", grouping: "", balance: "all" };
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [idx]: next };
    });

  const loadBatchesForRow = async (idx, itemName, godownId) => {
    const godownName = godownNameById(godownId);
    if (!godownName || !itemName) {
      setBatchOptionsByRow((prev) => ({ ...prev, [idx]: [{ name: DEFAULT_BATCH_NAME, qty: "" }] }));
      return;
    }
    setBatchLoadingByRow((prev) => ({ ...prev, [idx]: true }));
    try {
      const options = await fetchBatchOptions({ godownName, itemName });
      setBatchOptionsByRow((prev) => ({ ...prev, [idx]: options }));

      // Refresh item-level current_balance for edit rows and validation.
      try {
        const { rows: stockRows } = await fetchStockItems({
          godownName,
          search: itemName,
          grouping: getRowFilters(idx).grouping,
          balance: getRowFilters(idx).balance,
          page: 1,
          perPage: 10,
        });
        const stockMatch = stockRows.find(
          (r) => String(r.name || "").trim() === String(itemName).trim()
        );
        if (stockMatch) {
          const closing =
            parseQtyLimit(
              stockMatch?.total_closing_balance ??
              stockMatch?.current_balance ??
              stockMatch?.closing_balance ??
              stockMatch?.available_qty ??
              stockMatch?.qty ??
              ""
            ) ?? "";
          setItems((rows) =>
            rows.map((r, i) =>
              i === idx ? { ...r, closing_balance: closing } : r
            )
          );
        }
      } catch {
        /* item balance is optional for batch-only validation */
      }
      setItems((rows) =>
        rows.map((r, i) => {
          if (i !== idx) return r;
          const batchKey = r.source_batch_name || r.batch_name;
          const matchedBatch = options.find((opt) => opt.name === batchKey);
          if (matchedBatch) {
            return {
              ...r,
              batch_name: batchKey,
              source_batch_name: batchKey,
              batch_qty: matchedBatch.qty ?? "",
            };
          }
          const first = options[0];
          if (!first) return r;
          return {
            ...r,
            batch_name: first.name,
            source_batch_name: first.name,
            batch_qty: first.qty ?? "",
          };
        })
      );
    } finally {
      setBatchLoadingByRow((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const previousSourceBranchRef = useRef(form.source_branch_id);
  useEffect(() => {
    if (previousSourceBranchRef.current !== form.source_branch_id) {
      previousSourceBranchRef.current = form.source_branch_id;
      if (mode === "create") {
        setItems([emptyItemRow()]);
        setPickerFiltersByRow({});
        setBatchOptionsByRow({});
      }
    }
  }, [form.source_branch_id, mode]);

  useEffect(() => {
    if (mode !== "edit") return;
    items.forEach((row, idx) => {
      if (row.stock_item_name && row.source_godown_id && !batchOptionsByRow[idx]) {
        loadBatchesForRow(idx, row.stock_item_name, row.source_godown_id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, form.source_branch_id, items.length]);

  const handlePickItem = (idx, itemName) => {
    const row = items[idx];
    const godownName = godownNameById(row?.source_godown_id);
    if (!godownName) {
      toast({
        title: "Validation",
        description: "Select source godown for this row first",
        variant: "destructive",
      });
      return;
    }
    const filters = getRowFilters(idx);
    fetchStockItems({
      godownName,
      search: itemName,
      grouping: filters.grouping,
      balance: filters.balance,
      page: 1,
      perPage: 10,
    })
      .then(({ rows }) => {
        const match = rows.find(
          (r) => String(r.name || "").trim() === itemName.trim()
        );
        const unitName =
          match?.base_units_name || match?.base_unit_name || "";
        const closing =
          parseQtyLimit(
            match?.total_closing_balance ??
            match?.current_balance ??
            match?.closing_balance ??
            match?.available_qty ??
            match?.qty ??
            ""
          ) ?? "";
        const patch = {
          stock_item_id: match?.id ? String(match.id) : "",
          stock_item_name: itemName,
          uom_id: match?.base_unit_id
            ? String(match.base_unit_id)
            : match?.base_units_id
              ? String(match.base_units_id)
              : "",
          uom_name: unitName,
          closing_balance: closing,
          batch_name: "",
          source_batch_name: "",
          batch_qty: "",
        };
        if (row?.dispatched_qty && isDispatchQtyOverLimit(row.dispatched_qty, { ...row, ...patch })) {
          patch.dispatched_qty = "";
          toast({
            title: "Validation",
            description: `Dispatched qty cannot exceed available balance (${formatQtyLimitLabel(
              parseQtyLimit(closing),
              unitName
            )})`,
            variant: "destructive",
          });
        }
        updateRow(idx, patch);
      })
      .finally(() => loadBatchesForRow(idx, itemName, row?.source_godown_id));
  };

  const handlePickBatch = (idx, batchName) => {
    const options = batchOptionsByRow[idx] || [];
    const match = options.find((b) => b.name === batchName);
    const row = items[idx];
    const nextBatchQty = match?.qty ?? "";
    const patch = {
      batch_name: batchName,
      source_batch_name: batchName,
      batch_qty: nextBatchQty,
    };
    if (
      row?.dispatched_qty &&
      isDispatchQtyOverLimit(row.dispatched_qty, { ...row, ...patch })
    ) {
      patch.dispatched_qty = "";
      toast({
        title: "Validation",
        description: `Dispatched qty cannot exceed batch balance (${formatQtyLimitLabel(
          parseQtyLimit(nextBatchQty),
          row?.uom_name
        )})`,
        variant: "destructive",
      });
    }
    updateRow(idx, patch);
  };

  const handleDispatchQtyChange = (idx, value) => {
    const row = items[idx];
    if (value !== "" && isDispatchQtyOverLimit(value, row)) {
      const limit = getDispatchQtyLimit(row);
      toast({
        title: "Validation",
        description: `Dispatched qty cannot exceed available balance (${formatQtyLimitLabel(
          limit,
          row?.uom_name
        )})`,
        variant: "destructive",
      });
      return;
    }
    updateRow(idx, { dispatched_qty: value });
  };

  const handleRowGodownChange = (idx, godownId) => {
    updateRow(idx, {
      source_godown_id: godownId,
      stock_item_id: "",
      stock_item_name: "",
      batch_name: "",
      source_batch_name: "",
      dispatched_qty: "",
      closing_balance: "",
      batch_qty: "",
    });
    setBatchOptionsByRow((prev) => ({ ...prev, [idx]: undefined }));
  };

  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      const url =
        mode === "edit"
          ? `${API_BASE_URL}/api/voucher/stock-transfer-voucher/${voucherId}/`
          : `${API_BASE_URL}/api/voucher/stock-transfer-voucher/`;
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await apiRequest(method, url, payload);
      const data = await res.json();
      if (!res.ok || data?.status >= 400) {
        throw new Error(data?.message || "Failed to save voucher");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: mode === "edit" ? "Voucher updated" : "Voucher created",
        description:
          data?.data?.voucher_number ||
          (mode === "edit" ? "Updated successfully" : "Created successfully"),
      });
      onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: "Save failed",
        description: err?.message || "Unable to save voucher",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!form.source_branch_id) {
      toast({ title: "Validation", description: "Source branch is required", variant: "destructive" });
      return;
    }
    if (!form.destination_branch_id) {
      toast({ title: "Validation", description: "Destination branch is required", variant: "destructive" });
      return;
    }
    if (form.transit_mode === "hamali" && !form.hamali_group_id) {
      toast({ title: "Validation", description: "Hamali group is required for hamali transit", variant: "destructive" });
      return;
    }
    if (form.transit_mode === "vehicle" && !String(form.vehicle_number || "").trim()) {
      toast({ title: "Validation", description: "Vehicle number is required for vehicle transit", variant: "destructive" });
      return;
    }
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      const qty = String(row.dispatched_qty || "").trim();
      if (!qty) continue;
      if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) {
        toast({
          title: "Validation",
          description: `Enter a valid dispatched qty for row ${i + 1}`,
          variant: "destructive",
        });
        return;
      }
      if (isDispatchQtyOverLimit(qty, row)) {
        const limit = getDispatchQtyLimit(row);
        toast({
          title: "Validation",
          description: `Row ${i + 1}: dispatched qty cannot exceed available balance (${formatQtyLimitLabel(
            limit,
            row.uom_name
          )})`,
          variant: "destructive",
        });
        return;
      }
    }

    const cleanItems = items
      .map((r) => ({
        stock_item_id: r.stock_item_id ? Number(r.stock_item_id) : null,
        source_godown_id: r.source_godown_id ? Number(r.source_godown_id) : null,
        source_batch_name: (r.source_batch_name || r.batch_name || "").trim(),
        uom_id: r.uom_id ? Number(r.uom_id) : null,
        dispatched_qty: r.dispatched_qty,
      }))
      .filter(
        (r) =>
          r.stock_item_id &&
          r.source_godown_id &&
          r.source_batch_name &&
          Number(r.dispatched_qty) > 0
      );

    if (cleanItems.length === 0) {
      toast({
        title: "Validation",
        description: "Add at least one item with source godown, batch and quantity",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      source_branch_id: form.source_branch_id,
      destination_branch_id: form.destination_branch_id,
      transfer_date: form.transfer_date,
      transit_mode: form.transit_mode,
      vehicle_number:
        form.transit_mode === "vehicle" ? String(form.vehicle_number || "").trim() || null : null,
      driver_name: form.driver_name || null,
      hamali_group_id: form.transit_mode === "hamali" ? Number(form.hamali_group_id) : null,
      dispatch_remarks: form.dispatch_remarks || null,
      items: cleanItems,
    };

    submitMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit" ? "Edit Godown Transfer Voucher" : "Add Godown Transfer Voucher"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2 space-y-4">
          {/* Header row 1: source / destination branch / date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Source Branch *</Label>
              <Select
                value={form.source_branch_id}
                onValueChange={(v) => setForm((f) => ({ ...f, source_branch_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select source branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={`src-br-${b.id}`} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">
                Each line item picks its own source godown from this branch.
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Destination Branch *</Label>
              <Select
                value={form.destination_branch_id}
                onValueChange={(v) => setForm((f) => ({ ...f, destination_branch_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select destination branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={`dst-br-${b.id}`} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Transfer Date
              </Label>
              <Popover open={isTransferDatePickerOpen} onOpenChange={setIsTransferDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
                    <span className="truncate">
                      {form.transfer_date || todayDdMmYyyy()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedTransferDate}
                    onSelect={(date) => {
                      if (date) {
                        setForm((f) => ({ ...f, transfer_date: toDdMmYyyy(date) }));
                      }
                      setIsTransferDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Header row 2: transit mode + transit details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Transit Mode *</Label>
              <Select
                value={form.transit_mode}
                onValueChange={(v) => setForm((f) => ({ ...f, transit_mode: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.transit_mode === "vehicle" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Vehicle Number *</Label>
                  <Input
                    value={form.vehicle_number}
                    maxLength={10}
                    onChange={(e) => {
                      const value = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "") // remove spaces & special chars
                        .slice(0, 10); // enforce max length

                      setForm((f) => ({
                        ...f,
                        vehicle_number: value,
                      }));
                    }}
                    placeholder="KA25WB1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Driver Name</Label>
                  <Input
                    value={form.driver_name}
                    onChange={(e) => setForm((f) => ({ ...f, driver_name: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Hamali Group *</Label>
                <Select
                  value={form.hamali_group_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, hamali_group_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select hamali group" /></SelectTrigger>
                  <SelectContent>
                    {hamaliGroups.map((g) => (
                      <SelectItem key={`hg-${g.id}`} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <VoiceRecorderField
            label="Dispatch Remarks (voice)"
            value={form.dispatch_remarks}
            onChange={(url) => setForm((f) => ({ ...f, dispatch_remarks: url }))}
            helpText="Tap the mic to record a voice note. The audio URL is stored as dispatch remarks."
          />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Items</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addRow}
                disabled={!form.source_branch_id}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>

            {!form.source_branch_id ? (
              <div className="border border-dashed rounded-md px-4 py-6 text-center text-sm text-muted-foreground">
                Select a source branch to add items.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((row, idx) => {
                  const filters = getRowFilters(idx);
                  const godownSearchText = godownSearchByRow[idx] || "";
                  const filteredSourceGodowns = sourceGodowns.filter((g) =>
                    String(g?.name || "")
                      .toLowerCase()
                      .includes(godownSearchText.toLowerCase())
                  );
                  const batchOptions =
                    batchOptionsByRow[idx] || [{ name: DEFAULT_BATCH_NAME, qty: "" }];
                  const itemClosing = formatClosingBalance(
                    row.closing_balance,
                    row.uom_name
                  );
                  const batchClosing = formatClosingBalance(
                    row.batch_qty,
                    row.uom_name
                  );
                  return (
                    <div
                      key={`row-${idx}`}
                      className="border rounded-md p-2"
                    >
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-12 md:col-span-3 space-y-1">
                          <Label className="text-xs">Source Godown *</Label>
                          <Select
                            value={row.source_godown_id || ""}
                            onValueChange={(v) => {
                              handleRowGodownChange(idx, v);
                              setGodownSearchByRow((prev) => ({ ...prev, [idx]: "" }));
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Godown" />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="p-2 border-b" onPointerDown={(e) => e.stopPropagation()}>
                                <Input
                                  value={godownSearchText}
                                  onChange={(e) =>
                                    setGodownSearchByRow((prev) => ({
                                      ...prev,
                                      [idx]: e.target.value,
                                    }))
                                  }
                                  onPointerDown={(e) => e.stopPropagation()}
                                  placeholder="Search godown..."
                                  className="h-8"
                                />
                              </div>
                              {filteredSourceGodowns.map((g) => (
                                <SelectItem key={`row-g-${idx}-${g.id}`} value={String(g.id)}>
                                  {g.name}
                                </SelectItem>
                              ))}
                              {filteredSourceGodowns.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                  No godowns found.
                                </div>
                              ) : null}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-12 md:col-span-4 space-y-1">
                          <Label className="text-xs">Stock Item *</Label>
                          <Select
                            value={row.stock_item_name || ""}
                            onValueChange={(v) => handlePickItem(idx, v)}
                            disabled={!row.source_godown_id}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
                              <StockItemPickerContent
                                godownName={godownNameById(row.source_godown_id)}
                                filters={filters}
                                setFilters={(updater) => setRowFilters(idx, updater)}
                                selectedName={row.stock_item_name}
                                fetchStockItems={fetchStockItems}
                              />
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="hidden" aria-hidden="true">
                          <Label className="text-xs">Source Batch *</Label>
                          <Select
                            value={row.source_batch_name || row.batch_name || ""}
                            onValueChange={(v) => handlePickBatch(idx, v)}
                            disabled={!row.stock_item_name}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue
                                placeholder={
                                  batchLoadingByRow[idx]
                                    ? "Loading..."
                                    : !row.stock_item_name
                                      ? "Pick item first"
                                      : "Select batch"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {batchOptions.map((b, bIdx) => (
                                <SelectItem key={`b-${idx}-${bIdx}`} value={b.name}>
                                  {b.name}
                                  {b.qty !== "" && b.qty !== null && b.qty !== undefined
                                    ? ` (Qty: ${b.qty})`
                                    : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-11 md:col-span-3 space-y-1">
                          <Label className="text-xs">Dispatched Qty *</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              className="h-9"
                              type="number"
                              min="0"
                              max={
                                getDispatchQtyLimit(row) != null
                                  ? getDispatchQtyLimit(row)
                                  : undefined
                              }
                              step="0.001"
                              value={row.dispatched_qty}
                              onChange={(e) => handleDispatchQtyChange(idx, e.target.value)}
                            />
                            {row.uom_name ? (
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {row.uom_name}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="col-span-1 flex items-end justify-end h-full pb-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(idx)}
                            disabled={items.length <= 1}
                            title="Remove row"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>

                      {/* Meta line: closing balances similar to add-stock-journal */}
                      {(itemClosing || batchClosing) && (
                        <div className="grid grid-cols-12 gap-2 mt-1 text-[11px]">
                          <div className="col-span-12 md:col-span-5 text-muted-foreground truncate">
                            {itemClosing ? `Closing Balance: ${itemClosing}` : ""}
                          </div>
                          <div className="col-span-12 md:col-span-3 text-muted-foreground truncate">
                            {batchClosing ? `Batch Qty: ${batchClosing}` : ""}
                          </div>
                          <div className="col-span-12 md:col-span-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
            {submitMutation.isPending
              ? "Saving…"
              : mode === "edit"
                ? "Save Changes"
                : "Create Voucher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
   Detail dialog
   ========================================================================= */

function RemarksValue({ value }) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return <span className="text-gray-400">—</span>;
  }
  if (looksLikeAudioUrl(value)) {
    return <AudioPreview url={value} />;
  }
  return <span className="text-gray-800 break-words">{value}</span>;
}

function DetailField({ label, children, span = 1 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      <div className="text-sm font-medium text-gray-900 min-h-[2.25rem] px-3 py-2 rounded-md border border-gray-200 bg-gray-50 flex items-center flex-wrap gap-2 break-words">
        {children}
      </div>
    </div>
  );
}

function VoucherDetailDialog({ voucherId, open, onOpenChange }) {
  const detailQuery = useQuery({
    queryKey: ["godown-transfer/detail", voucherId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/stock-transfer-vouchers/${voucherId}/`
      );
      const data = await res.json();
      return data?.data || null;
    },
    enabled: !!voucherId,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const d = detailQuery.data;
  const transitLabel = d?.transit_mode === "hamali" ? "Hamali / Labour" : "Vehicle";
  const sourceSection = d?.source_section || [];
  const destinationSection = d?.destination_section || [];

  const [, setLocation] = useLocation();
  const [isPdfLanguageDialogOpen, setIsPdfLanguageDialogOpen] = useState(false);
  const [selectedPdfLanguage, setSelectedPdfLanguage] = useState("en");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0">
          <div className="px-6 pt-6">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-3">
                <span>Godown Transfer Voucher Detail</span>
                {d && (
                  <Button
                    size="sm"
                    onClick={() => setIsPdfLanguageDialogOpen(true)}
                    className="flex items-center gap-2 mr-6"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                )}
              </DialogTitle>
              <DialogDescription>
                Full header information, transit details and item-wise dispatch &
                receipt status.
              </DialogDescription>
            </DialogHeader>
          </div>

          {detailQuery.isLoading || !d ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="px-6 pb-2 pt-2 space-y-4">
              {/* Row 1: source / destination / transfer date / voucher number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <DetailField label="Source Branch">
                  {d.source_branch_name || "-"}
                </DetailField>
                <DetailField label="Destination Branch">
                  {d.destination_branch_name || "-"}
                </DetailField>
                <DetailField label="Transfer Date">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-500" />
                    {d.transfer_date || "-"}
                  </span>
                </DetailField>
                <DetailField label="Voucher Number">
                  <span className="font-mono">{d.voucher_number || "-"}</span>
                </DetailField>
              </div>

              {/* Row 2: transit mode / status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <DetailField label="Transit Mode">
                  <span className="inline-flex items-center gap-1.5">
                    {d.transit_mode === "hamali" ? (
                      <HardHat className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <Truck className="h-3.5 w-3.5 text-gray-500" />
                    )}
                    {transitLabel}
                  </span>
                </DetailField>
                <DetailField label="Status">
                  <Badge
                    className={`flex items-center gap-1 border text-xs w-fit ${statusBadge(
                      d.status
                    )}`}
                  >
                    {statusIcon(d.status)}
                    <span>
                      {d.status?.charAt(0).toUpperCase() + d.status?.slice(1).toLowerCase()}
                    </span>
                  </Badge>
                </DetailField>
                <DetailField label="Vehicle Number">
                  {d.vehicle_number || "-"}
                </DetailField>
                <DetailField label="Driver Name">
                  {d.driver_name || "-"}
                </DetailField>
              </div>

              {/* Row 3: hamali / dispatched / received */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <DetailField label="Hamali Group">
                  {d.hamali_group_name || "-"}
                </DetailField>
                <DetailField label="Dispatched By">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                    {d.dispatched_by || "-"}
                  </span>
                </DetailField>
                <DetailField label="Received By">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                    {d.received_by || "-"}
                  </span>
                </DetailField>
                <DetailField label="Received At">
                  {d.received_at || "-"}
                </DetailField>
              </div>

              {/* Remarks row (side-by-side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Dispatch Remarks
                  </Label>
                  <div className="text-sm font-medium text-gray-900 min-h-[2.25rem] px-3 py-2 rounded-md border border-gray-200 bg-gray-50 break-words">
                    <RemarksValue value={d.dispatch_remarks} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Receipt Remarks
                  </Label>
                  <div className="text-sm font-medium text-gray-900 min-h-[2.25rem] px-3 py-2 rounded-md border border-gray-200 bg-gray-50 break-words">
                    <RemarksValue value={d.received_remarks} />
                  </div>
                </div>
              </div>

              {/* Source section — dispatch / outgoing godowns */}
              <div className="pt-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" />
                    Source Section ({d.source_section_count ?? sourceSection.length})
                  </Label>
                  <span className="text-xs font-normal text-gray-500">
                    Total dispatched:{" "}
                    <span className="font-semibold text-blue-600">
                      {d.total_dispatched_qty || 0}
                    </span>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-md border border-blue-100 bg-blue-50/20">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock Item</TableHead>
                        <TableHead>Source Godown</TableHead>
                        <TableHead>Source Batch</TableHead>
                        <TableHead className="text-right">Dispatched Qty</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourceSection.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-sm text-gray-500 py-6"
                          >
                            No source lines.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sourceSection.map((row) => (
                          <TableRow key={`src-${row.item_id}`}>
                            <TableCell className="font-medium">
                              {row.stock_item_name || "—"}
                            </TableCell>
                            <TableCell>{row.godown_name || row.source_godown_name || "—"}</TableCell>
                            <TableCell>{row.batch_name || row.source_batch_name || "—"}</TableCell>
                            <TableCell className="text-right text-blue-600 font-medium">
                              {row.dispatched_qty ?? row.quantity ?? "—"}
                            </TableCell>
                            <TableCell>{row.uom_name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                                {/* {row.item_status
                                  ? row.item_status.charAt(0).toUpperCase() + row.item_status.slice(1)
                                  : "—"} */}
                                Dispatched
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                              {row.remarks || "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Destination section — receipt / incoming godowns */}
              <div className="pt-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-600" />
                    Destination Section ({d.destination_section_count ?? destinationSection.length})
                  </Label>
                  <span className="text-xs font-normal text-gray-500">
                    Total received at destinations:{" "}
                    <span className="font-semibold text-green-600">
                      {d.total_destination_qty ?? d.total_received_qty ?? 0}
                    </span>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-md border border-green-100 bg-green-50/20">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock Item</TableHead>
                        <TableHead>Destination Godown</TableHead>
                        <TableHead>Destination Batch</TableHead>
                        <TableHead className="text-right">Received Qty</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {destinationSection.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-sm text-gray-500 py-6"
                          >
                            No destination allocations yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        destinationSection.map((row) => (
                          <TableRow key={`dst-${row.id}`}>
                            <TableCell className="font-medium">
                              {row.stock_item_name || "—"}
                            </TableCell>
                            <TableCell>
                              {row.godown_name || row.destination_godown_name || "—"}
                            </TableCell>
                            <TableCell>
                              {row.batch_name || row.destination_batch_name || "—"}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {row.received_qty ?? row.quantity ?? "—"}
                            </TableCell>
                            <TableCell>{row.uom_name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                                {row.status
                                  ? row.status.charAt(0).toUpperCase() + row.status.slice(1)
                                  : "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                              {row.remarks || "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPdfLanguageDialogOpen} onOpenChange={setIsPdfLanguageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select PDF Language</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a language for Godown Transfer Voucher PDF. Numbers and codes
              remain unchanged.
            </p>
            <Select value={selectedPdfLanguage} onValueChange={setSelectedPdfLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="kn">Kannada (ಕನ್ನಡ)</SelectItem>
                <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
                <SelectItem value="gu">Gujarati (ગુજરાતી)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsPdfLanguageDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const id = voucherId || d?.id;
                  setIsPdfLanguageDialogOpen(false);
                  setLocation(
                    `/stock-transfer/voucher-pdf?id=${id}&lang=${selectedPdfLanguage || "en"}`
                  );
                }}
              >
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* =========================================================================
   Receive voucher dialog (receiver-side update)
   ========================================================================= */

function ReceiveVoucherDialog({
  voucherId,
  open,
  onOpenChange,
  godowns,
  fetchBatchOptions,
  onSuccess,
}) {
  const { toast } = useToast();

  const detailQuery = useQuery({
    queryKey: ["godown-transfer/receive-detail", voucherId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/stock-transfer-vouchers/${voucherId}/`
      );
      const data = await res.json();
      return data?.data || null;
    },
    enabled: !!voucherId,
  });

  const destinationBranchId = detailQuery.data?.destination_branch_id;
  const destGodownsQuery = useQuery({
    queryKey: ["godown-transfer/dest-godowns", destinationBranchId],
    queryFn: () => fetchGodownsForBranch(destinationBranchId),
    enabled: open && !!destinationBranchId,
    staleTime: 60 * 1000,
  });
  const destGodowns = destGodownsQuery.data ?? [];

  const [rows, setRows] = useState([]);
  const [received_at, setReceivedAt] = useState(nowDdMmYyyyHms());
  const [received_remarks, setReceivedRemarks] = useState("");
  const [destBatchOptions, setDestBatchOptions] = useState({});
  const [destGodownSearch, setDestGodownSearch] = useState({});

  useEffect(() => {
    if (open) {
      setReceivedAt(nowDdMmYyyyHms());
      setDestGodownSearch({});
    }
  }, [open]);

  useEffect(() => {
    if (detailQuery.data) {
      setRows(
        (detailQuery.data.items || [])
          .map((line) => {
            const pending_qty = computeItemPendingQty(line);
            return {
              item_id: line.id,
              stock_item_name: line.stock_item_name,
              source_godown_name: line.source_godown_name,
              source_batch_name: line.source_batch_name || line.batch_name,
              uom_name: line.uom_name || "",
              dispatched_qty: line.dispatched_qty,
              received_qty: line.received_qty,
              pending_qty,
              remarks: line.remarks || "",
              destinations: [emptyDestinationRow()],
            };
          })
          .filter((row) => row.pending_qty > 0)
      );
      setReceivedRemarks(detailQuery.data.received_remarks || "");
    }
  }, [detailQuery.data]);

  const fullyReceivedCount = useMemo(() => {
    if (!detailQuery.data?.items) return 0;
    return detailQuery.data.items.filter((line) => computeItemPendingQty(line) <= 0).length;
  }, [detailQuery.data]);

  const loadDestBatches = async (rowIdx, destIdx, godownId, itemName) => {
    const g = destGodowns.find((x) => String(x.id) === String(godownId));
    if (!g?.name || !itemName) return;
    const key = `${rowIdx}-${destIdx}`;
    const options = await fetchBatchOptions({ godownName: g.name, itemName });
    setDestBatchOptions((prev) => ({ ...prev, [key]: options }));
  };

  const updateDestination = (rowIdx, destIdx, patch) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const destinations = row.destinations.map((d, j) =>
          j === destIdx ? { ...d, ...patch } : d
        );
        return { ...row, destinations };
      })
    );
  };

  const addDestination = (rowIdx) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIdx
          ? { ...row, destinations: [...row.destinations, emptyDestinationRow()] }
          : row
      )
    );
  };

  const removeDestination = (rowIdx, destIdx) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const destinations =
          row.destinations.length <= 1
            ? row.destinations
            : row.destinations.filter((_, j) => j !== destIdx);
        return { ...row, destinations };
      })
    );
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const itemsPayload = rows
        .map((row) => {
          const destinations = row.destinations
            .filter(
              (d) =>
                d.destination_godown_id &&
                Number(d.received_qty) > 0
            )
            .map((d) => ({
              destination_godown_id: Number(d.destination_godown_id),
              destination_batch_name:
                (d.destination_batch_name || DEFAULT_BATCH_NAME).trim() || DEFAULT_BATCH_NAME,
              received_qty: d.received_qty,
              remarks: d.remarks || null,
            }));
          if (destinations.length === 0) return null;
          return {
            item_id: row.item_id,
            remarks: row.remarks || null,
            destinations,
          };
        })
        .filter(Boolean);

      if (itemsPayload.length === 0) {
        throw new Error("Add at least one destination allocation with quantity");
      }

      const payload = {
        received_at: resolveReceivedAtForSubmit(received_at),
        received_remarks: received_remarks || null,
        items: itemsPayload,
      };
      const res = await apiRequest(
        "PUT",
        `${API_BASE_URL}/api/voucher/stock-transfer-voucher/${voucherId}/receive/`,
        payload
      );
      const data = await res.json();
      if (!res.ok || data?.status >= 400) {
        throw new Error(data?.message || "Failed to update receipt");
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Receipt updated", description: "Godown transfer receipt saved" });
      onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: "Receipt failed",
        description: err?.message || "Unable to update receipt",
        variant: "destructive",
      });
    },
  });

  const header = detailQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle>Receive Godown Transfer</DialogTitle>
            <DialogDescription>
              Allocate received stock to destination godowns and batches (destination branch:{" "}
              {header?.destination_branch_name || "—"}).
            </DialogDescription>
          </DialogHeader>
        </div>

        {detailQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="px-6 pb-2 space-y-4">
            {header?.voucher_number && (
              <Card className="border border-gray-200 bg-gray-50/80 shadow-none">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {header.voucher_number}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {header.source_branch_name} → {header.destination_branch_name}
                    </span>
                    {fullyReceivedCount > 0 && (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        {fullyReceivedCount} item{fullyReceivedCount === 1 ? "" : "s"} already received
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Received At</Label>
                <Input
                  type="datetime-local"
                  value={ddMmYyyyHmsToDatetimeLocal(received_at)}
                  onChange={(e) =>
                    setReceivedAt(datetimeLocalToDdMmYyyyHms(e.target.value))
                  }
                />
                <div className="text-[11px] text-muted-foreground mt-1">
                  {received_at || nowDdMmYyyyHms()}
                </div>
              </div>
              <VoiceRecorderField
                label="Received Remarks"
                value={received_remarks}
                onChange={setReceivedRemarks}
                helpText="Tap the mic to record a voice note. The audio URL is stored as receipt remarks."
              />
            </div>

            {rows.length === 0 ? (
              <Card className="border border-dashed border-gray-300 shadow-none">
                <CardContent className="py-10 text-center">
                  <PackageCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="font-medium text-gray-900">All items are fully received</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    There is no pending quantity left to receive on this voucher.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {rows.length} item{rows.length === 1 ? "" : "s"} pending receipt
                </p>
                {rows.map((row, rowIdx) => (
                  <Card
                    key={`recv-row-${row.item_id}`}
                    className="border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <CardHeader className="pb-3 bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Package className="h-4 w-4 shrink-0 text-gray-500" />
                            <span className="truncate">{row.stock_item_name}</span>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            From {row.source_godown_name || "—"}
                            <span className="mx-1">·</span>
                            Batch {row.source_batch_name || "—"}
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 shrink-0 w-fit">
                          Pending: {row.pending_qty}
                          {row.uom_name ? ` ${row.uom_name}` : ""}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="rounded-md border bg-blue-50/50 px-3 py-2">
                          <span className="text-xs text-gray-500 block">Dispatched</span>
                          <p className="font-semibold text-sm text-blue-700">
                            {row.dispatched_qty}
                          </p>
                        </div>
                        <div className="rounded-md border bg-green-50/50 px-3 py-2">
                          <span className="text-xs text-gray-500 block">Already received</span>
                          <p className="font-semibold text-sm text-green-700">
                            {row.received_qty ?? 0}
                          </p>
                        </div>
                        <div className="rounded-md border bg-amber-50/50 px-3 py-2">
                          <span className="text-xs text-gray-500 block">To receive</span>
                          <p className="font-semibold text-sm text-amber-700">
                            {row.pending_qty}
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2 pt-0 pb-4">
                      {row.destinations.map((dest, destIdx) => {
                        const batchKey = `${rowIdx}-${destIdx}`;
                        const godownSearchKey = batchKey;
                        const batchOpts =
                          destBatchOptions[batchKey] || [{ name: DEFAULT_BATCH_NAME, qty: "" }];
                        const godownSearchText = destGodownSearch[godownSearchKey] || "";
                        const filteredDestGodowns = destGodowns.filter((g) =>
                          String(g?.name || "")
                            .toLowerCase()
                            .includes(godownSearchText.toLowerCase())
                        );
                        return (
                          <div
                            key={`dest-${row.item_id}-${destIdx}`}
                            className="grid grid-cols-12 gap-2 items-end rounded-lg border border-gray-100 bg-slate-50/80 p-3"
                          >
                            <div className="col-span-12 sm:col-span-4 space-y-1">
                              <Label className="text-xs">Destination Godown *</Label>
                              <Select
                                value={dest.destination_godown_id || ""}
                                onValueChange={(v) => {
                                  updateDestination(rowIdx, destIdx, {
                                    destination_godown_id: v,
                                    destination_batch_name: DEFAULT_BATCH_NAME,
                                  });
                                  setDestGodownSearch((prev) => ({
                                    ...prev,
                                    [godownSearchKey]: "",
                                  }));
                                  loadDestBatches(
                                    rowIdx,
                                    destIdx,
                                    v,
                                    row.stock_item_name
                                  );
                                }}
                              >
                                <SelectTrigger className="h-9 bg-white">
                                  <SelectValue placeholder="Godown" />
                                </SelectTrigger>
                                <SelectContent>
                                  <div
                                    className="p-2 border-b"
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <Input
                                      value={godownSearchText}
                                      onChange={(e) =>
                                        setDestGodownSearch((prev) => ({
                                          ...prev,
                                          [godownSearchKey]: e.target.value,
                                        }))
                                      }
                                      onPointerDown={(e) => e.stopPropagation()}
                                      placeholder="Search godown..."
                                      className="h-8"
                                    />
                                  </div>
                                  {filteredDestGodowns.map((g) => (
                                    <SelectItem key={`dg-${g.id}`} value={String(g.id)}>
                                      {g.name}
                                    </SelectItem>
                                  ))}
                                  {filteredDestGodowns.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                      No godowns found.
                                    </div>
                                  ) : null}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-6 sm:col-span-3 space-y-1">
                              <Label className="text-xs">Destination Batch *</Label>
                              <SearchableBatchSelect
                                value={dest.destination_batch_name || DEFAULT_BATCH_NAME}
                                options={batchOpts}
                                disabled={!dest.destination_godown_id}
                                onValueChange={(v) =>
                                  updateDestination(rowIdx, destIdx, {
                                    destination_batch_name: v || DEFAULT_BATCH_NAME,
                                  })
                                }
                                placeholder={DEFAULT_BATCH_NAME}
                              />
                            </div>
                            <div className="col-span-5 sm:col-span-4 space-y-1">
                              <Label className="text-xs">Received Qty *</Label>
                              <Input
                                className="h-9 bg-white"
                                type="number"
                                min="0"
                                max={row.pending_qty}
                                step="0.001"
                                placeholder={`Max ${row.pending_qty}`}
                                value={dest.received_qty}
                                onChange={(e) =>
                                  updateDestination(rowIdx, destIdx, {
                                    received_qty: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDestination(rowIdx, destIdx)}
                                disabled={row.destinations.length <= 1}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        onClick={() => addDestination(rowIdx)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add destination row
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || rows.length === 0}
          >
            {submitMutation.isPending ? "Saving…" : "Confirm Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}