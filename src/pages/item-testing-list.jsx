import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarIcon,
  Clock,
  FileText,
  FlaskConical,
  ImageIcon,
  Menu,
  Package,
  ScanEye,
  SquarePen,
  Search,
  TestTube,
  X,
  XCircle,
  Plus,
  Pencil,
  ChevronsUpDown,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import CommonLoader from "@/components/common/loader";
import ZoomImageViewerDialog from "@/components/common/ZoomImageViewerDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const formatDateForApi = (date) => (date ? format(new Date(date), "dd-MM-yyyy") : "");
const formatDateForQuery = (date) => (date ? format(new Date(date), "yyyy-MM-dd") : "");
const REPORT_API = `${API_BASE_URL}/api/report`;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const themedCardClass = "shadow-lg border-0 bg-white/90 backdrop-blur-sm overflow-hidden";
const themedCardHeaderClass = "bg-black text-white rounded-t-lg p-3";
const fieldTriggerClass =
  "h-10 w-full border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const SUMMARY_CARDS = [
  {
    key: "total",
    label: "Total Entries",
    statusFilter: "all",
    gradient: "from-indigo-500 to-indigo-600",
    iconBg: "bg-indigo-400 bg-opacity-30",
    icon: TestTube,
  },
  {
    key: "pending",
    label: "Total Pending",
    statusFilter: "pending",
    gradient: "from-amber-500 to-amber-600",
    iconBg: "bg-amber-400 bg-opacity-30",
    icon: Clock,
  },
  {
    key: "approved",
    label: "Total Approved",
    statusFilter: "approved",
    gradient: "from-green-500 to-green-600",
    iconBg: "bg-green-400 bg-opacity-30",
    icon: CheckCircle2,
  },
  {
    key: "rejected",
    label: "Total Rejected",
    statusFilter: "rejected",
    gradient: "from-red-500 to-red-600",
    iconBg: "bg-red-400 bg-opacity-30",
    icon: XCircle,
  },
];

function statusBadgeClass(status) {
  if (status === "approved") return "bg-green-100 text-green-800 border-green-200";
  if (status === "rejected") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

function formatParamValueWithUnit(param) {
  const value =
    param?.value != null && String(param.value).trim() !== ""
      ? String(param.value).trim()
      : "—";
  const unit = param?.unit != null ? String(param.unit).trim() : "";
  if (value === "—" || !unit) return value;
  return `${value} ${unit}`;
}

function DetailSection({ title, icon: Icon, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-gray-600 shrink-0" /> : null}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <dl className="divide-y divide-gray-100">{children}</dl>
    </section>
  );
}

function DetailRow({ label, value, children, className }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-[minmax(8rem,11rem)_1fr] gap-1 sm:gap-4 px-4 py-3",
        className
      )}
    >
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide sm:pt-0.5">
        {label}
      </dt>
      <dd className="text-sm font-medium text-gray-900 break-words min-w-0">
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

export default function ItemTestingList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [godownFilter, setGodownFilter] = useState("all");
  const [godownFilterOpen, setGodownFilterOpen] = useState(false);
  const [godownFilterSearch, setGodownFilterSearch] = useState("");
  const now = new Date();
  const [fromDate, setFromDate] = useState(() => startOfDay(now));
  const [toDate, setToDate] = useState(() => endOfDay(now));
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const current = new Date();
    if (dateRangePreset === "today") {
      setFromDate(startOfDay(current));
      setToDate(endOfDay(current));
    } else if (dateRangePreset === "weekly") {
      setFromDate(startOfWeek(current, { weekStartsOn: 1 }));
      setToDate(endOfWeek(current, { weekStartsOn: 1 }));
    } else if (dateRangePreset === "monthly") {
      setFromDate(startOfMonth(current));
      setToDate(endOfMonth(current));
    }
  }, [dateRangePreset]);
  const [selectedId, setSelectedId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const [viewerImage, setViewerImage] = useState(null);

  const openTestingImageViewer = (img) => {
    if (!img?.image) return;
    setViewerImage({
      url: img.image,
      title: "Testing image",
      remarks: img.remarks || "",
    });
  };

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead = hasPermission("item_testing", "read");
  const canCreate = hasPermission("item_testing", "create");
  const canUpdate = hasPermission("item_testing", "update");
  const canReview = hasPermission("item_testing", "update");

  const { data: godowns = [] } = useQuery({
    queryKey: ["item-testing-godowns"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-godowns/`);
      const payload = await response.json();
      return payload?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
  });

  const filteredGodowns = useMemo(() => {
    const term = godownFilterSearch.trim().toLowerCase();
    const sorted = [...godowns].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
    if (!term) return sorted;
    return sorted.filter((godown) => (godown.name || "").toLowerCase().includes(term));
  }, [godowns, godownFilterSearch]);

  const selectedGodownLabel =
    godownFilter === "all"
      ? "All godowns"
      : godowns.find((g) => String(g.id) === godownFilter)?.name || "Select godown";

  const {
    data: listPayload,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "stock-item-testings",
      page,
      statusFilter,
      godownFilter,
      search,
      dateRangePreset,
      fromDate?.getTime(),
      toDate?.getTime(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
      });
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (godownFilter && godownFilter !== "all") {
        params.set("godown_id", godownFilter);
      }
      const fromStr = formatDateForQuery(fromDate);
      const toStr = formatDateForQuery(toDate);
      if (fromStr) {
        params.set("from_date", fromStr);
      }
      if (toStr) {
        params.set("to_date", toStr);
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const response = await apiRequest(
        "GET",
        `${REPORT_API}/get-stock-item-testings/?${params.toString()}`
      );
      const payload = await response.json();
      if (!response.ok || (payload?.status && Number(payload.status) >= 400)) {
        throw new Error(payload?.error || payload?.message || "Failed to load item testing list");
      }
      return payload;
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
  });

  const entries = listPayload?.data || [];
  const pagination = listPayload?.pagination || {};

  const summary = useMemo(() => {
    const raw =
      listPayload?.summary ??
      listPayload?.pagination?.summary ??
      listPayload?.summary_stats ??
      null;
    const normalized = {
      total: Number(raw?.total ?? 0),
      pending: Number(raw?.pending ?? 0),
      approved: Number(raw?.approved ?? 0),
      rejected: Number(raw?.rejected ?? 0),
    };
    const listTotal = Number(pagination?.total_count ?? 0);
    const summaryLooksMissing =
      raw == null ||
      (normalized.total === 0 &&
        normalized.pending === 0 &&
        normalized.approved === 0 &&
        normalized.rejected === 0 &&
        listTotal > 0);
    if (
      summaryLooksMissing &&
      statusFilter === "all" &&
      !search.trim() &&
      godownFilter === "all" &&
      dateRangePreset === "today"
    ) {
      return {
        total: listTotal,
        pending: entries.filter((e) => e.status === "pending").length,
        approved: entries.filter((e) => e.status === "approved").length,
        rejected: entries.filter((e) => e.status === "rejected").length,
      };
    }
    return normalized;
  }, [
    listPayload,
    pagination?.total_count,
    entries,
    statusFilter,
    search,
    godownFilter,
    dateRangePreset,
    fromDate,
    toDate,
  ]);

  const perPage = Number(pagination?.per_page) || 20;
  const currentPage = Number(pagination?.current_page) || page;
  const serialStart = (currentPage - 1) * perPage;

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["stock-item-testing-detail", selectedId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${REPORT_API}/get-stock-item-testings/${selectedId}/`
      );
      const payload = await response.json();
      if (!response.ok || (payload?.status && Number(payload.status) >= 400)) {
        throw new Error(payload?.error || payload?.message || "Failed to load details");
      }
      return payload?.data;
    },
    enabled: !!selectedId && isDetailOpen && canRead,
  });

  const filteredCountLabel = useMemo(() => {
    const total = pagination?.total_count ?? entries.length;
    return `${total} record${total === 1 ? "" : "s"}`;
  }, [pagination?.total_count, entries.length]);

  const openDetail = (id) => {
    setSelectedId(id);
    setIsDetailOpen(true);
  };

  const handleEdit = (row) => {
    if (row.status !== "pending") {
      toast({
        title: "Cannot edit",
        description: "Only pending entries can be updated.",
        variant: "destructive",
      });
      return;
    }
    setLocation(`/item-testing/add?testing_id=${row.id}`);
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ testingId, status, remarks }) => {
      const response = await apiRequest("POST", `${REPORT_API}/review-stock-item-testing/`, {
        testing_id: testingId,
        status,
        reviewer_remarks: remarks,
      });
      const payload = await response.json();
      if (!response.ok || (payload?.status && Number(payload.status) >= 400)) {
        throw new Error(
          payload?.error || payload?.message || "Failed to update testing status"
        );
      }
      return payload;
    },
    onSuccess: (payload, variables) => {
      const label = variables.status === "approved" ? "approved" : "rejected";
      toast({
        title: "Success",
        description: payload?.message || `Testing entry ${label} successfully.`,
      });
      setReviewDialogOpen(false);
      setReviewTarget(null);
      setReviewAction(null);
      setReviewerRemarks("");
      queryClient.invalidateQueries({ queryKey: ["stock-item-testings"] });
      if (selectedId) {
        queryClient.invalidateQueries({
          queryKey: ["stock-item-testing-detail", selectedId],
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Action failed",
        description: err?.message || "Could not update testing status.",
        variant: "destructive",
      });
    },
  });

  const openReviewDialog = (row, action) => {
    setReviewTarget(row);
    setReviewAction(action);
    setReviewerRemarks("");
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (!reviewTarget?.id || !reviewAction) return;
    reviewMutation.mutate({
      testingId: reviewTarget.id,
      status: reviewAction,
      remarks: reviewerRemarks.trim(),
    });
  };

  const handleSummaryClick = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setGodownFilter("all");
    setDateRangePreset("today");
    const current = new Date();
    setFromDate(startOfDay(current));
    setToDate(endOfDay(current));
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== ""
    || statusFilter !== "all"
    || godownFilter !== "all"
    || dateRangePreset !== "today";

  if (permissionsLoading) {
    return (
      <div className="flex h-screen">
        <CommonLoader />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="app-layout bg-gray-50">
        <Sidebar />
        <div className="app-main-content flex items-center justify-center p-6">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You do not have read permission for Item Testing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      <Sidebar />
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-2"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <div className="flex items-center space-x-3 min-w-0">
                <div className="bg-gradient-to-r from-black to-gray-600 p-2 rounded-lg shrink-0">
                  <TestTube className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                    Item Testing
                  </h1>
                  <p className="text-sm text-gray-600 hidden sm:block">
                    Stock quality tests by godown, item, and batch
                  </p>
                </div>
              </div>
            </div>
            {canCreate && (
              <Button
                onClick={() => setLocation("/item-testing/add")}
                className="bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Test
              </Button>
            )}
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 min-h-0">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SUMMARY_CARDS.map((card) => {
                const Icon = card.icon;
                const count = summary[card.key] ?? 0;
                const isActive = statusFilter === card.statusFilter;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => handleSummaryClick(card.statusFilter)}
                    className={cn(
                      "text-left rounded-xl transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black",
                      isActive && "ring-2 ring-offset-2 ring-black"
                    )}
                  >
                    <Card
                      className={cn(
                        `bg-gradient-to-br ${card.gradient} text-white border-0 shadow-md`
                      )}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-white/80 text-sm mb-1">{card.label}</p>
                            <p className="text-3xl font-bold">{count}</p>
                          </div>
                          <div className={cn("p-3 rounded-lg", card.iconBg)}>
                            <Icon className="h-6 w-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>

            {/* Filters */}
            <Card >
              <CardHeader >
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Search className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                  <div className="sm:col-span-2 lg:col-span-2 space-y-2 min-w-0">
                    <Label htmlFor="dateRangePreset" className="text-sm font-medium text-gray-700">
                      Date Range
                    </Label>
                    <Select
                      value={dateRangePreset}
                      onValueChange={(value) => {
                        setDateRangePreset(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger id="dateRangePreset" className={fieldTriggerClass}>
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
                  <div className="sm:col-span-2 lg:col-span-2 space-y-2 min-w-0">
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
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={cn(
                            fieldTriggerClass,
                            "w-full justify-start text-left font-normal",
                            dateRangePreset !== "custom" && "bg-gray-100 text-gray-500 cursor-not-allowed"
                          )}
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
                            if (!date) return;
                            setFromDate(startOfDay(date));
                            if (toDate && date > toDate) setToDate(endOfDay(date));
                            setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                            setPage(1);
                          }}
                          disabled={{ after: new Date() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2 space-y-2 min-w-0">
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
                          variant="outline"
                          disabled={dateRangePreset !== "custom"}
                          className={cn(
                            fieldTriggerClass,
                            "w-full justify-start text-left font-normal",
                            dateRangePreset !== "custom" && "bg-gray-100 text-gray-500 cursor-not-allowed"
                          )}
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
                            if (!date) return;
                            setToDate(endOfDay(date));
                            setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                            setPage(1);
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
                  <div className="sm:col-span-2 lg:col-span-2 space-y-2 min-w-0">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => {
                        setStatusFilter(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className={fieldTriggerClass}>
                        <SelectValue placeholder="Status" />
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
                  <div className="sm:col-span-2 lg:col-span-2 space-y-2 min-w-0">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Godown
                    </label>
                    <Popover
                      open={godownFilterOpen}
                      onOpenChange={(open) => {
                        setGodownFilterOpen(open);
                        if (!open) setGodownFilterSearch("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={godownFilterOpen}
                          className={cn(fieldTriggerClass, "justify-between font-normal px-3")}
                        >
                          <span className="truncate">{selectedGodownLabel}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[max(16rem,var(--radix-popover-trigger-width))] max-w-[min(28rem,95vw)] p-0 z-50"
                        align="start"
                        side="bottom"
                        sideOffset={4}
                      >
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search godowns..."
                            value={godownFilterSearch}
                            onValueChange={setGodownFilterSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {godowns.length === 0
                                ? "No godowns found."
                                : "No godowns match your search."}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                <CommandItem
                                  value="All godowns"
                                  onSelect={() => {
                                    setGodownFilter("all");
                                    setPage(1);
                                    setGodownFilterOpen(false);
                                    setGodownFilterSearch("");
                                  }}
                                  className="flex items-start cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <Check
                                      className={`mt-0.5 h-4 w-4 shrink-0 ${godownFilter === "all" ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                    />
                                    <div className="font-medium text-gray-900">All godowns</div>
                                  </div>
                                </CommandItem>
                                {filteredGodowns.map((godown) => (
                                  <CommandItem
                                    key={godown.id}
                                    value={godown.name}
                                    onSelect={() => {
                                      setGodownFilter(String(godown.id));
                                      setPage(1);
                                      setGodownFilterOpen(false);
                                      setGodownFilterSearch("");
                                    }}
                                    className="flex items-start cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <Check
                                        className={`mt-0.5 h-4 w-4 shrink-0 ${godownFilter === String(godown.id) ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-gray-900 leading-snug">{godown.name}</div>
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
                  <div className="sm:col-span-2 lg:col-span-2 space-y-2 min-w-0">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        className={cn(fieldTriggerClass, "pl-9")}
                        placeholder="Item, godown, batch, tester..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-gray-300"
                    onClick={handleClearFilters}
                    disabled={!hasActiveFilters}
                  >
                    Clear Filters
                  </Button>
                </div>
                {hasActiveFilters && (
                  <p className="text-xs text-muted-foreground">
                    Showing filtered results — {filteredCountLabel}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Table */}
            <Card className={themedCardClass}>
              <CardHeader >
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <FileText className="h-5 w-5" />
                  Testing Entries
                </CardTitle>
                <span className="text-sm text-white/80">{filteredCountLabel}</span>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                {isLoading ? (
                  <div className="py-16 flex justify-center">
                    <CommonLoader text="Loading entries..." />
                  </div>
                ) : isError ? (
                  <div className="text-center py-12 px-4">
                    <p className="text-destructive mb-3">{error?.message || "Failed to load data"}</p>
                    <Button variant="outline" onClick={() => refetch()}>
                      Retry
                    </Button>
                  </div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <FlaskConical className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">No testing entries found.</p>
                    {canCreate && (
                      <Button
                        className="mt-4 bg-black hover:bg-gray-800"
                        onClick={() => setLocation("/item-testing/add")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create first test
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead className="font-semibold w-16">S.No</TableHead>
                            <TableHead className="font-semibold">Godown</TableHead>
                            <TableHead className="font-semibold min-w-[160px]">Item</TableHead>
                            <TableHead className="font-semibold">Batch</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Tested by</TableHead>
                            <TableHead className="font-semibold">Tested at</TableHead>
                            <TableHead className="font-semibold text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((row, index) => (
                            <TableRow key={row.id} className="hover:bg-blue-50/50">
                              <TableCell className="font-medium text-gray-700">
                                {serialStart + index + 1}
                              </TableCell>
                              <TableCell>{row.godown_name || "—"}</TableCell>
                              <TableCell className="max-w-[200px] truncate" title={row.stock_item_name}>
                                {row.stock_item_name || "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  <span>{row.batch_name || "Primary"}</span>
                                  {(row.stock_balance_display ||
                                    (row.balance != null && row.base_unit)) && (
                                    <span className="text-xs text-muted-foreground">
                                      {row.stock_balance_display ||
                                        `${Number(row.balance) === Math.floor(Number(row.balance)) ? Math.floor(Number(row.balance)) : row.balance} ${row.base_unit}`.trim()}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusBadgeClass(row.status)}>
                                  {row.status_display || row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{row.tested_by_name || "—"}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {row.tested_at || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title="View details"
                                    className="h-8 w-8 shrink-0 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                    onClick={() => openDetail(row.id)}
                                  >
                                    <ScanEye className="h-4 w-4" />
                                  </Button>
                                  {canUpdate && row.status === "pending" && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      title="Edit entry"
                                      className="h-8 w-8 shrink-0 border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
                                      onClick={() => handleEdit(row)}
                                    >
                                      <SquarePen className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {pagination?.total_pages > 1 && (
                      <div className="flex items-center justify-between px-4 py-4 border-t bg-gray-50/80">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!pagination?.has_previous}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {pagination.current_page} of {pagination.total_pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!pagination?.has_next}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          className={cn(
            "max-w-4xl max-h-[90vh] overflow-hidden p-0 gap-0",
            "[&>button]:absolute [&>button]:right-4 [&>button]:top-4 [&>button]:z-10",
            "[&>button]:text-white [&>button]:opacity-100",
            "[&>button]:hover:text-white [&>button]:hover:bg-white/20 [&>button]:hover:opacity-100",
            "[&>button]:focus:ring-white/50 [&>button]:ring-offset-0"
          )}
        >
          <DialogHeader className="relative bg-black text-white px-6 py-4 pr-14 rounded-t-lg space-y-1">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <FlaskConical className="h-5 w-5 shrink-0" />
              Testing Detail #{selectedId}
            </DialogTitle>
            {detailData && (
              <p className="text-sm text-white/80">
                {detailData.stock_item_name} · {detailData.godown_name}
              </p>
            )}
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(90vh-5rem)] p-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
            {detailLoading ? (
              <CommonLoader text="Loading details..." />
            ) : detailData ? (
              <div className="space-y-5">
                <DetailSection title="Item Details" icon={Package}>
                  <DetailRow label="Godown" value={detailData.godown_name} />
                  <DetailRow label="Stock item" value={detailData.stock_item_name} />
                  <DetailRow label="Batch" value={detailData.batch_name || "Primary"} />
                  <DetailRow
                    label="Stock balance"
                    value={
                      detailData.stock_balance_display ||
                      detailData.stock_balance ||
                      "—"
                    }
                  />
                </DetailSection>

                <DetailSection title="Testing Details" icon={FlaskConical}>
                  <DetailRow label="Tested by" value={detailData.tested_by_name} />
                  <DetailRow label="Tested at" value={detailData.tested_at} />
                  <DetailRow label="Status">
                    <Badge variant="outline" className={statusBadgeClass(detailData.status)}>
                      {detailData.status_display || detailData.status}
                    </Badge>
                  </DetailRow>
                  <DetailRow label="Tester remarks" value={detailData.tester_remarks} />
                  {detailData.reviewed_by_name ? (
                    <>
                      <DetailRow label="Reviewed by" value={detailData.reviewed_by_name} />
                      <DetailRow label="Reviewed at" value={detailData.reviewed_at} />
                      <DetailRow label="Reviewer remarks" value={detailData.reviewer_remarks} />
                    </>
                  ) : null}
                </DetailSection>

                <Card className="border shadow-sm">
                  <CardHeader className="py-3 px-4 bg-white border-b">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-600" />
                      Test Parameters
                      <Badge variant="secondary" className="ml-1 font-normal">
                        {(detailData.test_params || []).length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {(detailData.test_params || []).length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No parameters recorded.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {detailData.test_params.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col"
                          >
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-start justify-between gap-3">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {p.parameter_name || "—"}
                              </h4>
                              <span className="text-base font-bold text-purple-700 whitespace-nowrap shrink-0">
                                {formatParamValueWithUnit(p)}
                              </span>
                            </div>
                            <div className="p-4 flex flex-col gap-3 flex-1">
                              {p.remarks ? (
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium text-gray-600">Remarks: </span>
                                  {p.remarks}
                                </p>
                              ) : null}
                              {p.test_image ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewerImage({
                                      url: p.test_image,
                                      title: p.parameter_name || "Test parameter image",
                                      remarks: p.remarks || "",
                                    })
                                  }
                                  className="block w-full rounded-md border border-gray-200 overflow-hidden bg-gray-50 hover:opacity-95 transition-opacity cursor-zoom-in"
                                  title={`View ${p.parameter_name || "parameter"} image`}
                                >
                                  <img
                                    src={p.test_image}
                                    alt={`${p.parameter_name || "Test"} image`}
                                    className="w-full max-h-48 object-contain pointer-events-none"
                                  />
                                </button>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  No image uploaded
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border shadow-sm">
                  <CardHeader className="py-3 px-4 bg-white border-b">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-blue-600" />
                      Testing Images
                      <Badge variant="secondary" className="ml-1 font-normal">
                        {(detailData.images || []).length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {(detailData.images || []).length === 0 ? (
                      <p className="text-muted-foreground text-sm">No additional images uploaded.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {detailData.images.map((img) => (
                          <div
                            key={img.id}
                            className="rounded-lg border border-gray-200 bg-white overflow-hidden flex flex-col"
                          >
                            {img.image ? (
                              <button
                                type="button"
                                onClick={() => openTestingImageViewer(img)}
                                className="block w-full bg-gray-50 hover:opacity-95 transition-opacity cursor-zoom-in"
                                title="View image"
                              >
                                <img
                                  src={img.image}
                                  alt={`Testing image ${img.id}`}
                                  className="w-full max-h-52 object-contain pointer-events-none"
                                />
                              </button>
                            ) : (
                              <p className="text-xs text-muted-foreground italic p-4">
                                No image URL
                              </p>
                            )}
                            {img.remarks ? (
                              <p className="text-xs text-muted-foreground px-3 py-2 border-t">
                                <span className="font-medium text-gray-600">Remarks: </span>
                                {img.remarks}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {detailData.status === "pending" && (canReview || canUpdate) && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {canReview && (
                      <>
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          disabled={reviewMutation.isPending}
                          onClick={() => openReviewDialog(detailData, "rejected")}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={reviewMutation.isPending}
                          onClick={() => openReviewDialog(detailData, "approved")}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </>
                    )}
                    {canUpdate && (
                      <Button
                        className="bg-black hover:bg-gray-800"
                        onClick={() => {
                          setIsDetailOpen(false);
                          setLocation(`/item-testing/add?testing_id=${detailData.id}`);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit entry
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No details available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewAction === "approved" ? "Approve testing entry" : "Reject testing entry"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewTarget
                ? `${reviewTarget.stock_item_name || "Item"} · ${reviewTarget.godown_name || "Godown"}`
                : "Confirm your decision for this testing entry."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reviewer-remarks">Reviewer remarks</Label>
            <Textarea
              id="reviewer-remarks"
              placeholder={
                reviewAction === "rejected"
                  ? "Reason for rejection (optional)"
                  : "Approval remarks (optional)"
              }
              value={reviewerRemarks}
              onChange={(e) => setReviewerRemarks(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reviewMutation.isPending}
              className={cn(
                reviewAction === "approved"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
              onClick={(e) => {
                e.preventDefault();
                submitReview();
              }}
            >
              {reviewMutation.isPending
                ? "Saving..."
                : reviewAction === "approved"
                  ? "Approve"
                  : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ZoomImageViewerDialog
        open={Boolean(viewerImage)}
        onOpenChange={(open) => {
          if (!open) setViewerImage(null);
        }}
        imageUrl={viewerImage?.url || ""}
        title={viewerImage?.title || "Testing image"}
        remarks={viewerImage?.remarks || ""}
      />

      {reviewMutation.isPending && <CommonLoader text="Updating status..." />}
    </div>
  );
}
