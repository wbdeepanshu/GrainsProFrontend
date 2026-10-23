import { useState, useMemo, useEffect, useCallback } from "react";
import {
  format,
  parse,
  compareAsc,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, Search, CalendarIcon, GitCompare, Package, Check, ChevronsUpDown, Loader2, FileDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import CommonLoader from "@/components/common/loader";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function formatDateApi(d) {
  return d ? format(d, "dd-MM-yyyy") : "";
}

function fmtQty(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtQtyQtl(n) {
  const q = fmtQty(n);
  return q === "—" ? "—" : `${q} Qtl`;
}

function sumAnchorPrimaryQty(items) {
  if (!items?.length) return 0;
  return items.filter((i) => i.is_anchor).reduce((s, i) => s + (Number(i.actual_qty_primary) || 0), 0);
}

function anchorQtyDisplay(items) {
  const anchors = (items || []).filter((i) => i.is_anchor);
  if (!anchors.length) return "";
  return anchors
    .map((a) =>
      (a.actual_qty_text && String(a.actual_qty_text).trim()) ||
      `${a.actual_qty_primary ?? ""} ${a.actual_qty_primary_unit || ""}`.trim()
    )
    .filter(Boolean)
    .join(" + ");
}

function groupComparisonRowsByDate(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const d = r.date || "";
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(r);
  }
  return [...map.entries()]
    .sort(([a], [b]) =>
      compareAsc(parse(a, "dd-MM-yyyy", new Date()), parse(b, "dd-MM-yyyy", new Date()))
    )
    .map(([date, list]) => ({
      date,
      rows: [...list].sort((x, y) => String(x.transaction_id || "").localeCompare(String(y.transaction_id || ""))),
    }));
}

function splitRowsBySide(rows) {
  const inward = [];
  const outward = [];
  for (const r of rows || []) {
    if ((r.inward_voucher || "").trim()) inward.push(r);
    if ((r.outward_voucher || "").trim()) outward.push(r);
  }
  return { inward, outward };
}

function buildComparisonRowsFromVouchers(vouchers) {
  if (!vouchers?.length) return [];
  return vouchers.map((v) => {
    // One-side rule: if report item is on IN -> show left only; if on OUT -> show right only.
    const inLines = v.inventory_entries_in ?? v.inward_side?.items ?? v.destination_side?.items ?? [];
    const outLines = v.inventory_entries_out ?? v.outward_side?.items ?? v.source_side?.items ?? [];
    const hasIn = inLines.some((i) => i.is_anchor);
    const hasOut = outLines.some((i) => i.is_anchor);
    const partnerIn = v.partner_items_inward ?? v.partner_items_destination ?? [];
    const partnerOut = v.partner_items_outward ?? v.partner_items_source ?? [];
    const vch = (v.voucher_label || `${v.voucher_type_name || ""} #${v.voucher_number || ""}`).trim();
    const by = v.created_by || "";
    const showLeft = hasIn;
    const showRight = hasOut;
    return {
      date: v.date,
      transaction_id: v.transaction_id,
      inward_voucher: showLeft ? vch : "",
      inward_items: showLeft && Array.isArray(partnerIn) ? partnerIn.join(", ") : "",
      inward_quantity_primary: showLeft ? sumAnchorPrimaryQty(inLines) : null,
      inward_quantity_display: showLeft ? anchorQtyDisplay(inLines) : "",
      created_by: showLeft ? by : "",
      outward_voucher: showRight ? vch : "",
      outward_items: showRight && Array.isArray(partnerOut) ? partnerOut.join(", ") : "",
      outward_quantity_primary: showRight ? sumAnchorPrimaryQty(outLines) : null,
      outward_quantity_display: showRight ? anchorQtyDisplay(outLines) : "",
      outward_created_by: showRight ? by : "",
    };
  });
}

async function fetchProcessMachineStockItems({ pageParam = 1, queryKey }) {
  const searchTerm = String(queryKey[2] ?? "").trim();
  const requestBody = {
    type: "Process Machine",
    list_mode: "default",
    stock_group: "",
    stock_category: "",
    is_active: true,
    new_page: pageParam,
    per_page: 50,
  };
  if (searchTerm) {
    requestBody.search = searchTerm;
  }
  const response = await apiRequest("POST", `${API_BASE_URL}/api/stock-items-list/`, requestBody);
  const data = await response.json();
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || "Failed to fetch stock items");
  }
  return {
    results: data.data || [],
    nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
  };
}

export default function ProcessStockFlowReport() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [queryItem, setQueryItem] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const [fromDate, setFromDate] = useState(() => startOfDay(new Date()));
  const [toDate, setToDate] = useState(() => startOfDay(new Date()));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [excelDownloading, setExcelDownloading] = useState(false);

  const [itemComboOpen, setItemComboOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [selectedStockItem, setSelectedStockItem] = useState(null);

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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedItemSearch(itemSearch), 350);
    return () => clearTimeout(t);
  }, [itemSearch]);

  const fromStr = fromDate ? formatDateApi(fromDate) : "";
  const toStr = toDate ? formatDateApi(toDate) : "";

  const { hasReadPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead = hasReadPermission("stock_journals");

  const {
    data: pickerPages,
    isFetching: pickerLoading,
    fetchNextPage: fetchNextPickerPage,
    hasNextPage: hasNextPickerPage,
    isFetchingNextPage: fetchingMorePicker,
  } = useInfiniteQuery({
    queryKey: ["/api/stock-items-list", "Process Machine", debouncedItemSearch],
    queryFn: fetchProcessMachineStockItems,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: itemComboOpen && canRead && !permissionsLoading,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const pickerItems = pickerPages?.pages?.flatMap((page) => page.results) ?? [];

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (queryItem.trim()) p.set("stock_item_name", queryItem.trim());
    if (fromStr) p.set("from_date", fromStr);
    if (toStr) p.set("to_date", toStr);
    return p.toString();
  }, [queryItem, fromStr, toStr]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["process-stock-flow-report", queryParams],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/process/process-stock-flow-report/?${queryParams}`;
      const res = await fetch(url, { headers: AuthService.getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `Request failed (${res.status})`);
      }
      if (json.status !== 200) {
        throw new Error(json.message || "Failed to load report");
      }
      return json.data;
    },
    enabled: Boolean(queryItem.trim() && fromStr && toStr),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const comparisonRows = useMemo(() => {
    const raw = data?.comparison_rows;
    if (Array.isArray(raw) && raw.length) return raw;
    return buildComparisonRowsFromVouchers(data?.vouchers);
  }, [data?.comparison_rows, data?.vouchers]);

  const groupedByDate = useMemo(() => {
    if (Array.isArray(data?.grouped_by_date) && data.grouped_by_date.length) {
      return data.grouped_by_date;
    }
    return groupComparisonRowsByDate(comparisonRows);
  }, [data?.grouped_by_date, comparisonRows]);

  const { inward: inwardRows, outward: outwardRows } = useMemo(
    () => splitRowsBySide(comparisonRows),
    [comparisonRows]
  );
  const inwardGroupedByDate = useMemo(() => groupComparisonRowsByDate(inwardRows), [inwardRows]);
  const outwardGroupedByDate = useMemo(() => groupComparisonRowsByDate(outwardRows), [outwardRows]);
  const mergedByDate = useMemo(() => {
    const leftMap = new Map(inwardGroupedByDate.map((g) => [g.date, g.rows]));
    const rightMap = new Map(outwardGroupedByDate.map((g) => [g.date, g.rows]));
    const dates = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort((a, b) =>
      compareAsc(parse(a, "dd-MM-yyyy", new Date()), parse(b, "dd-MM-yyyy", new Date()))
    );
    return dates.map((date) => {
      const left = leftMap.get(date) || [];
      const right = rightMap.get(date) || [];
      const n = Math.max(left.length, right.length);
      const rows = Array.from({ length: n }).map((_, i) => ({
        left: left[i] || null,
        right: right[i] || null,
      }));
      return { date, rows };
    });
  }, [inwardGroupedByDate, outwardGroupedByDate]);

  const summary = useMemo(() => {
    if (data?.summary) return data.summary;
    const ti = comparisonRows.reduce((s, r) => s + (Number(r.inward_quantity_primary) || 0), 0);
    const to = comparisonRows.reduce((s, r) => s + (Number(r.outward_quantity_primary) || 0), 0);
    const net = ti - to;
    return {
      opening_balance_primary: 0,
      total_inward_primary: ti,
      total_outward_primary: to,
      net_change_primary: net,
      closing_balance_primary: net,
    };
  }, [data?.summary, comparisonRows]);

  const downloadExcel = useCallback(async () => {
    if (!queryItem.trim() || !fromStr || !toStr) return;
    setExcelDownloading(true);
    try {
      const p = new URLSearchParams();
      p.set("stock_item_name", queryItem.trim());
      p.set("from_date", fromStr);
      p.set("to_date", toStr);
      p.set("export_excel", "true");
      const res = await fetch(`${API_BASE_URL}/api/process/process-stock-flow-report/?${p.toString()}`, {
        headers: AuthService.getAuthHeaders(),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        if (ct.includes("application/json")) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || j.error || `Download failed (${res.status})`);
        }
        throw new Error(`Download failed (${res.status})`);
      }
      if (ct.includes("application/json")) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Server returned JSON instead of Excel");
      }
      const blob = await res.blob();
      const dispo = res.headers.get("content-disposition") || "";
      const m = /filename="?([^";]+)"?/i.exec(dispo);
      const fname = m?.[1] || `process_stock_flow_${queryItem.trim().slice(0, 40)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: fname });
    } catch (e) {
      const msg = typeof e === "string" ? e : e?.message || "Could not download the file.";
      toast({
        title: "Excel export failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setExcelDownloading(false);
    }
  }, [queryItem, fromStr, toStr, toast]);

  const runSearch = () => {
    const name = (selectedStockItem?.name || "").trim();
    if (!name) return;
    setQueryItem(name);
  };

  if (!permissionsLoading && !canRead) {
    return (
      <div className="app-layout bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-gray-600 dark:text-gray-400">You do not have permission to view this report.</p>
        </div>
      </div>
    );
  }

  const periodLabel =
    data?.query?.date_range_label ||
    (fromStr && toStr ? (fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`) : "");

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="app-main-content flex flex-col min-h-0">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <GitCompare className="h-7 w-7 text-gray-700 dark:text-gray-200" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Process Report</h1>

              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[1800px] mx-auto space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Filters
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Stock items are Process Machine masters from item grouping. Quantities in the report are shown in{" "}
                  <span className="font-medium text-foreground">Qtl</span> (primary).
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-end gap-2 md:gap-3">
                  <div className="flex flex-wrap items-end gap-2 shrink-0">
                    <Select
                      value={dateRangePreset}
                      onValueChange={(v) => {
                        setDateRangePreset(v);
                      }}
                    >
                      <SelectTrigger className="h-10 w-[140px] md:w-[155px]">
                        <SelectValue placeholder="Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="weekly">Week (Mon–Sun)</SelectItem>
                        <SelectItem value="monthly">Month</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>

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
                          className={`h-10 w-[132px] md:w-[140px] justify-start text-left font-normal px-3 ${
                            dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">{fromDate ? formatDateApi(fromDate) : "From"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fromDate}
                          onSelect={(d) => {
                            if (d) {
                              setFromDate(startOfDay(d));
                              setDateRangePreset("custom");
                            }
                            setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

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
                          className={`h-10 w-[132px] md:w-[140px] justify-start text-left font-normal px-3 ${
                            dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">{toDate ? formatDateApi(toDate) : "To"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={toDate}
                          onSelect={(d) => {
                            if (d) {
                              setToDate(endOfDay(d));
                              setDateRangePreset("custom");
                            }
                            setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex-1 min-w-[200px] max-w-full md:max-w-xl">
                    <Popover
                      open={itemComboOpen}
                      onOpenChange={(open) => {
                        setItemComboOpen(open);
                        if (!open) setItemSearch("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemComboOpen}
                          disabled={permissionsLoading || !canRead}
                          className="h-10 w-full justify-between font-normal"
                        >
                          <span className="truncate text-left">
                            {selectedStockItem?.name || "Process machine…"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 z-50" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search process machines…"
                            value={itemSearch}
                            onValueChange={setItemSearch}
                          />
                          <CommandList>
                            {pickerLoading && !pickerItems.length ? (
                              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading items…
                              </div>
                            ) : (
                              <>
                                <CommandEmpty>No process machines match your search.</CommandEmpty>
                                <CommandGroup>
                                  <div
                                    className="max-h-[280px] overflow-auto"
                                    onScroll={(e) => {
                                      const target = e.currentTarget;
                                      if (
                                        target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                                        hasNextPickerPage &&
                                        !fetchingMorePicker
                                      ) {
                                        fetchNextPickerPage();
                                      }
                                    }}
                                  >
                                  {pickerItems.map((row) => (
                                    <CommandItem
                                      key={row.id}
                                      value={`${row.id}-${row.name}`}
                                      onSelect={() => {
                                        setSelectedStockItem({ id: row.id, name: row.name });
                                        setItemComboOpen(false);
                                        setItemSearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedStockItem?.id === row.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate font-medium">{row.name}</span>
                                        {row.parent ? (
                                          <span className="text-xs text-muted-foreground truncate">{row.parent}</span>
                                        ) : null}
                                      </div>
                                    </CommandItem>
                                  ))}
                                    {fetchingMorePicker ? (
                                      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading more…
                                      </div>
                                    ) : null}
                                  </div>
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button
                    onClick={runSearch}
                    disabled={
                      permissionsLoading || !canRead || !(selectedStockItem?.name || "").trim() || isFetching
                    }
                    className="h-10 bg-black text-white hover:bg-gray-800 shrink-0"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {isFetching ? "Loading…" : "Generate report"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {permissionsLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking permissions…
              </div>
            )}

            {!permissionsLoading && canRead && !queryItem && (
              <p className="text-sm text-gray-500 text-center py-8">
                Set the date range, pick a process machine, then run the report.
              </p>
            )}

            {queryItem && isLoading && <CommonLoader />}

            {queryItem && error && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <CardContent className="pt-6 text-red-800 dark:text-red-200">{error.message}</CardContent>
              </Card>
            )}

            {queryItem && data && !isLoading && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    Period: <strong className="text-gray-900 dark:text-white">{periodLabel}</strong>
                    {" · "}
                    {data.vouchers?.length || 0} voucher{(data.vouchers?.length || 0) !== 1 ? "s" : ""} in the table
                    below
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={downloadExcel}
                      disabled={excelDownloading || !queryItem.trim() || !fromStr || !toStr}
                    >
                      {excelDownloading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      Download Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      Refresh
                    </Button>
                  </div>
                </div>

                <Card className="border-2 border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <CardHeader className="py-3 px-4 border-b bg-gray-50 dark:bg-gray-900/60">
                    <CardTitle className="text-base">Vouchers (table)</CardTitle>
                  </CardHeader>
                  <div className="px-4 py-3 border-b bg-muted/40 dark:bg-muted/20">
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
                      <div className="xl:col-span-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Process item</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {data.query?.stock_item_name || "—"}
                      </p>
                      </div>
                      <div className="xl:col-span-9 rounded-md border border-amber-300/70 dark:border-amber-700/70 bg-amber-50/70 dark:bg-amber-950/25 px-3 py-2">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <p className="text-[11px] text-muted-foreground">Opening</p>
                            <p className="font-mono font-semibold">{fmtQtyQtl(summary.opening_balance_primary)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Inward total</p>
                            <p className="font-mono font-semibold text-rose-700 dark:text-rose-300">
                              {fmtQtyQtl(summary.total_inward_primary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Outward total</p>
                            <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                              {fmtQtyQtl(summary.total_outward_primary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Net (In − Out)</p>
                            <p
                              className={cn(
                                "font-mono font-semibold",
                                summary.net_change_primary > 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : summary.net_change_primary < 0
                                    ? "text-rose-700 dark:text-rose-400"
                                    : ""
                              )}
                            >
                              {fmtQtyQtl(summary.net_change_primary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Closing</p>
                            <p className="font-mono font-bold text-gray-900 dark:text-white">
                              {fmtQtyQtl(summary.closing_balance_primary)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3 sm:p-4 space-y-4">
                    {comparisonRows.length === 0 ? (
                      <p className="text-center text-muted-foreground py-10 text-sm">
                        No vouchers in this range contain that stock item.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead rowSpan={2} className="w-[96px] min-w-[88px] border border-gray-200 dark:border-gray-700">
                                Date
                              </TableHead>
                              <TableHead colSpan={4} className="text-center border border-gray-200 dark:border-gray-700 bg-rose-50/70 dark:bg-rose-950/25">
                                Inward Report
                              </TableHead>
                              <TableHead colSpan={5} className="text-center border-2  dark:border-gray-100 bg-emerald-50/70 dark:bg-emerald-950/25">
                                Outward Report
                              </TableHead>
                            </TableRow>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="border border-gray-200 dark:border-gray-700">Voucher</TableHead>
                              <TableHead className="border border-gray-200 dark:border-gray-700">Items</TableHead>
                              <TableHead className="text-right border border-gray-200 dark:border-gray-700">Qty</TableHead>
                              <TableHead className="border border-gray-200 dark:border-gray-700">Created by</TableHead>
                              <TableHead className="border-l-4 border-l-gray-900 dark:border-l-gray-100 border-r border-y border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                Date
                              </TableHead>
                              <TableHead className="border border-gray-200 dark:border-gray-700">Voucher</TableHead>
                              <TableHead className="border border-gray-200 dark:border-gray-700">Items</TableHead>
                              <TableHead className="text-right border border-gray-200 dark:border-gray-700">Qty</TableHead>
                              <TableHead className="border border-gray-200 dark:border-gray-700">Created by</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mergedByDate.flatMap((g) =>
                              g.rows.map((row, idx) => {
                                const l = row.left;
                                const r = row.right;
                                const inQty = l
                                  ? (l.inward_quantity_display || "").trim() || fmtQtyQtl(l.inward_quantity_primary)
                                  : "—";
                                const outQty = r
                                  ? (r.outward_quantity_display || "").trim() || fmtQtyQtl(r.outward_quantity_primary)
                                  : "—";
                                return (
                                  <TableRow key={`m-${g.date}-${idx}`}>
                                    {idx === 0 ? (
                                      <TableCell
                                        rowSpan={g.rows.length}
                                        className="align-top font-semibold text-sm whitespace-nowrap border border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/50"
                                      >
                                        {g.date}
                                      </TableCell>
                                    ) : null}
                                    <TableCell className="align-top border border-gray-200 dark:border-gray-700 bg-rose-50/20 dark:bg-rose-950/10 py-2">
                                      <div className="text-sm font-medium">{l?.inward_voucher || "—"}</div>
                                    </TableCell>
                                    <TableCell className="align-top border border-gray-200 dark:border-gray-700 bg-rose-50/20 dark:bg-rose-950/10 py-2">
                                      <span className="text-xs sm:text-sm break-words">{l?.inward_items || "—"}</span>
                                    </TableCell>
                                    <TableCell className="align-top text-right border border-gray-200 dark:border-gray-700 bg-rose-50/20 dark:bg-rose-950/10 py-2">
                                      <span className="font-mono text-xs sm:text-sm">{inQty}</span>
                                    </TableCell>
                                    <TableCell className="align-top text-sm border border-gray-200 dark:border-gray-700 bg-rose-50/20 dark:bg-rose-950/10 py-2">
                                      {l?.created_by || "—"}
                                    </TableCell>
                                    <TableCell className="align-top border-l-4 border-l-gray-900 dark:border-l-gray-100 border-r border-y border-gray-200 dark:border-gray-700 bg-emerald-50/20 dark:bg-emerald-950/10 py-2 whitespace-nowrap text-sm font-medium">
                                      {r?.date || g.date || "—"}
                                    </TableCell>
                                    <TableCell className="align-top border border-gray-200 dark:border-gray-700 bg-emerald-50/20 dark:bg-emerald-950/10 py-2">
                                      <div className="text-sm font-medium">{r?.outward_voucher || "—"}</div>
                                    </TableCell>
                                    <TableCell className="align-top border border-gray-200 dark:border-gray-700 bg-emerald-50/20 dark:bg-emerald-950/10 py-2">
                                      <span className="text-xs sm:text-sm break-words">{r?.outward_items || "—"}</span>
                                    </TableCell>
                                    <TableCell className="align-top text-right border border-gray-200 dark:border-gray-700 bg-emerald-50/20 dark:bg-emerald-950/10 py-2">
                                      <span className="font-mono text-xs sm:text-sm">{outQty}</span>
                                    </TableCell>
                                    <TableCell className="align-top text-sm border border-gray-200 dark:border-gray-700 bg-emerald-50/20 dark:bg-emerald-950/10 py-2">
                                      {r?.outward_created_by || r?.created_by || "—"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                            <TableRow className="bg-slate-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-700">
                              <TableCell colSpan={3} className="text-right font-semibold">Total (primary Qtl)</TableCell>
                              <TableCell className="text-right font-mono font-bold">{fmtQtyQtl(summary.total_inward_primary)}</TableCell>
                              <TableCell />
                              <TableCell colSpan={3} className="text-right font-semibold border-l-4  dark:border-l-gray-100">
                                Total (primary Qtl)
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">{fmtQtyQtl(summary.total_outward_primary)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
      <CommonLoader isLoading={Boolean(queryItem && isLoading)} text="Loading process stock flow" />
    </div>
  );
}
