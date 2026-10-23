import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  Menu,
  Package,
  Search,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Link2,
  Filter,
  CheckCircle,
  TrendingUp,
  X,
  RefreshCw,
} from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const ITEMS_PER_PAGE = 50;

/** Backend values used by `/api/update-stock-item-groupings/` (aligned with item-masters). */
const GROUPING_KEYS = {
  rawMaterial: "Raw Material",
  processItem: "Process Machine",
  finishedGoods: "Finished Materials",
  po: "PO Material",
  so: "SO Material",
  bagsBardans: "Bags/ Bardans",
};

const COLUMN_LABELS = {
  rawMaterial: "Raw Material",
  processItem: "Process Machine",
  finishedGoods: "Finished Materials",
  po: "PO Material",
  so: "SO Material",
  bagsBardans: "Bags/ Bardans",
};

const COLUMN_ORDER = ["rawMaterial", "processItem", "finishedGoods", "po", "so", "bagsBardans"];

/** Filter dropdown options (same as item-masters list API `type` param). */
const ITEM_GROUPING_FILTER_OPTIONS = [
  "Raw Material",
  "Process Machine",
  "Finished Materials",
  "PO Material",
  "SO Material",
  "Bags/ Bardans",
];

const parseGroupingValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

const groupingsToFlags = (groupings) => {
  const set = new Set(groupings);
  return {
    rawMaterial: set.has(GROUPING_KEYS.rawMaterial),
    processItem: set.has(GROUPING_KEYS.processItem),
    finishedGoods: set.has(GROUPING_KEYS.finishedGoods),
    po: set.has(GROUPING_KEYS.po),
    so: set.has(GROUPING_KEYS.so),
    bagsBardans: set.has(GROUPING_KEYS.bagsBardans),
  };
};

export default function AllItemMapping() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedItemGrouping, setSelectedItemGrouping] = useState("");
  const [inStockFilter, setInStockFilter] = useState("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState("active");
  const [currentPage, setCurrentPage] = useState(1);
  /** itemId -> selected grouping strings (API values) */
  const [draftGroupingsByItemId, setDraftGroupingsByItemId] = useState({});
  const [changedItemIds, setChangedItemIds] = useState(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedItemGrouping, inStockFilter, activeStatusFilter]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedItemGrouping("");
    setInStockFilter("all");
    setActiveStatusFilter("active");
    setCurrentPage(1);
  };

  const fetchItems = async () => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");

    let isActiveValue = null;
    if (activeStatusFilter === "active") isActiveValue = true;
    else if (activeStatusFilter === "deactive") isActiveValue = false;

    const requestBody = {
      search: debouncedSearch.trim(),
      type: selectedItemGrouping || "",
      list_mode: "default",
      stock_group: "",
      stock_category: "",
      godown: "",
      is_active: isActiveValue,
      new_page: currentPage,
      per_page: ITEMS_PER_PAGE,
    };

    if (inStockFilter === "in_stock") {
      requestBody.in_stock = true;
    } else if (inStockFilter === "out_of_stock") {
      requestBody.in_stock = false;
    }

    const response = await fetch(`${API_BASE_URL}/api/stock-items-list/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return {
      data: responseData.data || [],
      total_count: responseData.total_count ?? 0,
      pagination: responseData.pagination ?? {
        current_page: currentPage,
        per_page: ITEMS_PER_PAGE,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    };
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [
      "/api/all-item-mapping",
      "/api/stock-items-list",
      debouncedSearch,
      selectedItemGrouping,
      inStockFilter,
      activeStatusFilter,
      currentPage,
    ],
    queryFn: fetchItems,
    enabled: !!AuthService.getAccessToken(),
    placeholderData: (prev) => prev,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/all-item-mapping"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list"] });
    refetch();
  };

  // const handleRefresh = () => {
  //   queryClient.invalidateQueries({ queryKey: ["/api/all-item-mapping"] });
  //   refetch();
  // };

  const displayItems = data?.data ?? [];
  const pagination = data?.pagination ?? {};
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, pagination.total_pages ?? 1);
  const hasNext = pagination.has_next ?? currentPage < totalPages;
  const hasPrevious = pagination.has_previous ?? currentPage > 1;

  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading items",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  /** Seed draft from server when we have no local override for that item. */
  useEffect(() => {
    if (!displayItems.length) return;
    setDraftGroupingsByItemId((prev) => {
      const next = { ...prev };
      for (const item of displayItems) {
        const id = item.id;
        if (id == null) continue;
        const key = String(id);
        if (!(key in next)) {
          next[key] = parseGroupingValue(item.item_groupings);
        }
      }
      return next;
    });
  }, [displayItems]);

  const getGroupingsForItem = useCallback(
    (item) => {
      const id = item?.id != null ? String(item.id) : "";
      if (!id) return [];
      if (Object.prototype.hasOwnProperty.call(draftGroupingsByItemId, id)) {
        return draftGroupingsByItemId[id] || [];
      }
      return parseGroupingValue(item.item_groupings);
    },
    [draftGroupingsByItemId]
  );

  const toggleFlag = (item, columnKey, checked) => {
    const id = item?.id != null ? String(item.id) : "";
    if (!id) return;
    const current = [...getGroupingsForItem(item)];
    const set = new Set(current);
    const apiVal = GROUPING_KEYS[columnKey];
    if (checked) set.add(apiVal);
    else set.delete(apiVal);
    const nextArr = Array.from(set);

    setDraftGroupingsByItemId((prev) => ({
      ...prev,
      [id]: nextArr,
    }));
    setChangedItemIds((prev) => new Set(prev).add(id));
  };

  const getColumnSelectState = useCallback(
    (columnKey) => {
      if (!displayItems.length) {
        return { checked: false, indeterminate: false };
      }
      let checkedCount = 0;
      for (const item of displayItems) {
        const flags = groupingsToFlags(getGroupingsForItem(item));
        if (flags[columnKey]) checkedCount += 1;
      }
      return {
        checked: checkedCount === displayItems.length,
        indeterminate: checkedCount > 0 && checkedCount < displayItems.length,
      };
    },
    [displayItems, getGroupingsForItem]
  );

  const getRowSelectState = useCallback(
    (item) => {
      const flags = groupingsToFlags(getGroupingsForItem(item));
      const checkedCount = COLUMN_ORDER.filter((key) => flags[key]).length;
      return {
        checked: checkedCount === COLUMN_ORDER.length,
        indeterminate: checkedCount > 0 && checkedCount < COLUMN_ORDER.length,
      };
    },
    [getGroupingsForItem]
  );

  const toggleColumnForPage = (columnKey, checked) => {
    const apiVal = GROUPING_KEYS[columnKey];
    const idsToChange = [];

    setDraftGroupingsByItemId((prev) => {
      const next = { ...prev };
      for (const item of displayItems) {
        const id = item?.id != null ? String(item.id) : "";
        if (!id) continue;
        const current = Object.prototype.hasOwnProperty.call(next, id)
          ? [...(next[id] || [])]
          : parseGroupingValue(item.item_groupings);
        const set = new Set(current);
        if (checked) set.add(apiVal);
        else set.delete(apiVal);
        next[id] = Array.from(set);
        idsToChange.push(id);
      }
      return next;
    });

    if (idsToChange.length) {
      setChangedItemIds((prev) => {
        const next = new Set(prev);
        idsToChange.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleRowAll = (item, checked) => {
    const id = item?.id != null ? String(item.id) : "";
    if (!id) return;

    setDraftGroupingsByItemId((prev) => ({
      ...prev,
      [id]: checked ? Object.values(GROUPING_KEYS) : [],
    }));
    setChangedItemIds((prev) => new Set(prev).add(id));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (changedItemIds.size === 0) {
        throw new Error("No changes to save.");
      }
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");

      const items = Array.from(changedItemIds).map((idStr) => ({
        stock_item_id: Number(idStr),
        item_groupings: draftGroupingsByItemId[idStr] || [],
      }));

      const response = await fetch(`${API_BASE_URL}/api/update-stock-item-groupings/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      });
      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || resJson?.status >= 400) {
        throw new Error(resJson?.message || `HTTP error! status: ${response.status}`);
      }
      return resJson;
    },
    onSuccess: (res) => {
      toast({
        title: "Saved",
        description: res?.message || "Item mapping updated successfully.",
      });
      const savedIds = Array.from(changedItemIds);
      setDraftGroupingsByItemId((prev) => {
        const next = { ...prev };
        savedIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setChangedItemIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/all-item-mapping"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list"] });
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Save failed",
        description: err.message || "Failed to save item mapping.",
        variant: "destructive",
      });
    },
  });

  const startSl = useMemo(() => {
    if (!totalCount) return 0;
    const per = pagination.per_page ?? ITEMS_PER_PAGE;
    const page = pagination.current_page ?? currentPage;
    return (page - 1) * per + 1;
  }, [totalCount, pagination, currentPage]);

  if (isLoading && !data) {
    return <CommonLoader text="Loading item mapping..." />;
  }

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main-content flex flex-col overflow-hidden">
        <header className="border-b bg-white dark:bg-gray-900 px-4 py-4 sm:px-6 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setIsMobileSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  Item Mapping
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Map items to Raw material, Process, Finished goods, PO, and SO.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/item-masters")}
              >
                <Package className="h-4 w-4 mr-2" />
                Item Masters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                title="Refresh list"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
              <Button
                size="sm"
                disabled={saveMutation.isPending || changedItemIds.size === 0}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="space-y-2 flex-1 min-w-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-600" />
                    Search Items
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="mapping-search"
                      placeholder="Search by name, group, category..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-8 h-11 w-full"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 w-full lg:w-52 shrink-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Filter className="h-4 w-4 text-purple-600" />
                    Item Grouping
                  </label>
                  <Select
                    value={selectedItemGrouping || "all"}
                    onValueChange={(value) => setSelectedItemGrouping(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select item grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All groupings</SelectItem>
                      {ITEM_GROUPING_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={`filter-grouping-${option}`} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 w-full lg:w-40 shrink-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    Status
                  </label>
                  <Select value={activeStatusFilter} onValueChange={setActiveStatusFilter}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="deactive">Deactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 w-full lg:w-44 shrink-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Stock
                  </label>
                  <Select value={inStockFilter} onValueChange={setInStockFilter}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All balances</SelectItem>
                      <SelectItem value="in_stock">In stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={clearAllFilters}
                  title="Clear filters"
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="text-lg">All item mapping</CardTitle>
              {changedItemIds.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {changedItemIds.size} item(s) modified — click Save to apply
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Group cards (visual header for checkbox columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {COLUMN_ORDER.map((key) => (
                  <div
                    key={`group-card-${key}`}
                    className="rounded-lg border bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {COLUMN_LABELS[key]}
                  </div>
                ))}
              </div>

              <div className="rounded-md border w-full max-h-[min(72vh,calc(100vh-14rem))] overflow-auto relative isolate">
                <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center whitespace-nowrap w-14 sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">
                        <span className="text-xs font-medium">All</span>
                      </TableHead>
                      <TableHead className="w-14 whitespace-nowrap sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">
                        Sl No
                      </TableHead>
                      <TableHead className="min-w-[180px] sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">
                        Item name
                      </TableHead>
                      {COLUMN_ORDER.map((key) => {
                        const columnState = getColumnSelectState(key);
                        return (
                          <TableHead
                            key={key}
                            className="text-center whitespace-nowrap min-w-[100px] sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]"
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              <span>{COLUMN_LABELS[key]}</span>
                              <Checkbox
                                checked={
                                  columnState.indeterminate
                                    ? "indeterminate"
                                    : columnState.checked
                                }
                                onCheckedChange={(value) =>
                                  toggleColumnForPage(key, value === true)
                                }
                                disabled={displayItems.length === 0}
                                aria-label={`Select all ${COLUMN_LABELS[key]} on this page`}
                              />
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3 + COLUMN_ORDER.length} className="text-center text-muted-foreground py-8">
                          No items found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayItems.map((item, idx) => {
                        const g = getGroupingsForItem(item);
                        const flags = groupingsToFlags(g);
                        const rowState = getRowSelectState(item);
                        const sl = startSl + idx;
                        return (
                          <TableRow key={item.id ?? idx}>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={
                                    rowState.indeterminate
                                      ? "indeterminate"
                                      : rowState.checked
                                  }
                                  onCheckedChange={(value) =>
                                    toggleRowAll(item, value === true)
                                  }
                                  aria-label={`Select all groupings for ${item.name}`}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{sl}</TableCell>
                            <TableCell className="font-medium">
                              {item.name || item.display_name || "—"}
                            </TableCell>
                            {COLUMN_ORDER.map((colKey) => (
                              <TableCell key={colKey} className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={!!flags[colKey]}
                                    onCheckedChange={(c) =>
                                      toggleFlag(item, colKey, c === true)
                                    }
                                    aria-label={`${COLUMN_LABELS[colKey]} for ${item.name}`}
                                  />
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  {totalCount > 0
                    ? `Showing ${startSl}–${startSl + displayItems.length - 1} of ${totalCount}`
                    : "No results"}
                  {isFetching ? " · Updating…" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrevious || isFetching}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-foreground tabular-nums">
                    Page {pagination.current_page ?? currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNext || isFetching}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
