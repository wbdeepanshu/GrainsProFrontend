import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  ArrowLeft,
  Package,
  Truck,
  Box,
  Loader2,
  Search,
  ShoppingBag,
  Layers,
  Star,
  CalendarIcon,
  PieChart,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Factory,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Loader from "@/components/common/loader";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);

const formatNumber = (num) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num ?? 0);

const sumAcrossGroups = (groups, moduleKey, field) =>
  (groups || []).reduce((acc, g) => acc + (g[moduleKey]?.[field] || 0), 0);

const MODULE_COLORS = ["#f59e0b", "#3b82f6", "#16a34a", "#9333ea", "#0ea5e9"];

const renderProductionItemUsageList = (items, field = "quantity_in", label = "Qtl") => {
  if (!items || items.length === 0) {
    return <p className="text-xs text-gray-500">No item usage</p>;
  }
  return (
    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
      {items.map((item) => (
        <div key={`${item.item_id}-${item.item_name}-${field}`} className="flex justify-between text-xs gap-3">
          <span className="text-gray-700 truncate">{item.item_name}</span>
          <span className="font-medium text-gray-900 whitespace-nowrap">
            {formatNumber(item[field] ?? item.quantity ?? 0)} {label}
          </span>
        </div>
      ))}
    </div>
  );
};

const renderItemUsageList = (items, unitLabel = "") => {
  if (!items || items.length === 0) {
    return <p className="text-xs text-gray-500">No item usage</p>;
  }
  return (
    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
      {items.map((item) => (
        <div key={`${item.item_id}-${item.item_name}`} className="flex justify-between text-xs gap-3">
          <span className="text-gray-700 truncate">{item.item_name}</span>
          <span className="font-medium text-gray-900 whitespace-nowrap">
            {formatNumber(item.quantity)}{unitLabel ? ` ${unitLabel}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function StockGroupAnalysis() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const token = AuthService.getAccessToken();
  const queryClient = useQueryClient();
  const { hasReadPermission, isLoading: permissionsLoading } = useUserPermissions();
  const hasAnalysisAccess = hasReadPermission("analysis_reports");

  const getCurrentMonthDates = () => {
    const now = new Date();
    return {
      firstDay: new Date(now.getFullYear(), now.getMonth(), 1),
      lastDay: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  };

  const { firstDay, lastDay } = getCurrentMonthDates();
  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(lastDay);
  const [dateRangePreset, setDateRangePreset] = useState("monthly");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [selectedStockGroup, setSelectedStockGroup] = useState("");
  const [selectedGraphGroup, setSelectedGraphGroup] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [expandedGroups, setExpandedGroups] = useState({});

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

  const fromDateStr = fromDate?.toISOString().split("T")[0];
  const toDateStr = toDate?.toISOString().split("T")[0];

  const { data: stockGroupsData, isLoading: stockGroupsLoading, refetch: refetchStockGroups } = useQuery({
    queryKey: ["stock-groups-analysis", fromDateStr, toDateStr],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/user/item-analysis-stock-groups/?from_date=${fromDateStr}&to_date=${toDateStr}`
      );
      if (!response.ok) throw new Error("Failed to fetch stock groups");
      const data = await response.json();
      return data.status === 200 ? data.data : [];
    },
    enabled: !!token && !!fromDateStr && !!toDateStr && hasAnalysisAccess,
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: async (groupId) => {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/user/stock-group/${groupId}/toggle-favourite/`);
      if (!response.ok) throw new Error("Failed to toggle favourite");
      return response.json();
    },
    onSuccess: () => {
      refetchStockGroups();
      refetchReport();
      queryClient.invalidateQueries({ queryKey: ["stock-groups-analysis"] });
      toast({
        title: "Success",
        description: "Favourite status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to toggle favourite status",
        variant: "destructive",
      });
    },
  });

  const handleToggleFavourite = (event, group) => {
    event.preventDefault();
    event.stopPropagation();
    if (!group?.id || toggleFavouriteMutation.isPending) return;
    toggleFavouriteMutation.mutate(group.id);
  };

  const {
    data: reportData,
    isLoading: reportLoading,
    refetch: refetchReport,
    isFetching,
  } = useQuery({
    queryKey: ["stock-group-analysis", fromDateStr, toDateStr, selectedStockGroup],
    queryFn: async () => {
      const params = new URLSearchParams({
        from_date: fromDateStr,
        to_date: toDateStr,
      });
      if (selectedStockGroup) {
        params.append("stock_group", selectedStockGroup);
      }
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/user/stock-group-analysis/?${params.toString()}`
      );
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = "/login";
          return null;
        }
        throw new Error("Failed to fetch analyzer report");
      }
      const data = await response.json();
      return data.status === 200 ? data.data : null;
    },
    enabled: !!token && !!fromDateStr && !!toDateStr && searchEnabled && hasAnalysisAccess,
    retry: false,
  });

  const stockGroups = reportData?.stock_groups || [];
  const productionSummary = reportData?.production_summary || null;
  const selectedStockGroupOption = useMemo(() => {
    if (!selectedStockGroup) return null;
    return (stockGroupsData || []).find(
      (group) => (group.name || group.group_name || "Unknown") === selectedStockGroup
    ) || null;
  }, [selectedStockGroup, stockGroupsData]);

  useEffect(() => {
    if (!stockGroups.length) {
      setSelectedGraphGroup("");
      return;
    }
    if (!selectedGraphGroup || !stockGroups.some((g) => g.name === selectedGraphGroup)) {
      setSelectedGraphGroup(stockGroups[0].name);
    }
  }, [stockGroups, selectedGraphGroup]);

  useEffect(() => {
    if (!stockGroups.length) {
      setExpandedGroups({});
      return;
    }
    // Keep branch-wise module data visible by default.
    const expandedByDefault = {};
    stockGroups.forEach((group) => {
      expandedByDefault[group.name] = true;
    });
    setExpandedGroups(expandedByDefault);
  }, [stockGroups]);

  const totals = useMemo(
    () => ({
      purchaseQty: sumAcrossGroups(stockGroups, "purchase", "total_quantity"),
      purchaseAmount: sumAcrossGroups(stockGroups, "purchase", "total_amount"),
      inwardWeight: sumAcrossGroups(stockGroups, "inward", "total_weight"),
      salesQty: sumAcrossGroups(stockGroups, "sales_orders", "total_quantity"),
      salesAmount: sumAcrossGroups(stockGroups, "sales_orders", "total_amount"),
      outwardQty: sumAcrossGroups(stockGroups, "outward", "total_quantity"),
      outwardAmount: sumAcrossGroups(stockGroups, "outward", "total_amount"),
      productionConsumed: sumAcrossGroups(stockGroups, "production", "inventory_in_quantity"),
      productionProduced: sumAcrossGroups(stockGroups, "production", "inventory_out_quantity"),
      productionJournals: sumAcrossGroups(stockGroups, "production", "total_count"),
    }),
    [stockGroups]
  );

  const productionItemsData = useMemo(() => {
    const items = productionSummary?.production_items || [];
    if (items.length > 0) {
      return items;
    }
    const fallback = [];
    stockGroups.forEach((group) => {
      (group.production?.production_items || []).forEach((item) => {
        fallback.push({ ...item, stock_group: item.stock_group || group.name });
      });
    });
    return fallback;
  }, [productionSummary, stockGroups]);

  const productionClosingBalanceData = productionItemsData;

  const selectedGraphGroupData = useMemo(
    () => stockGroups.find((group) => group.name === selectedGraphGroup) || null,
    [stockGroups, selectedGraphGroup]
  );

  const modulePieData = useMemo(() => {
    if (!selectedGraphGroupData) return [];
    const inwardQtyFromItems = (selectedGraphGroupData.inward?.item_usage || []).reduce(
      (acc, item) => acc + (item.quantity || 0),
      0
    );
    return [
      {
        name: "Purchase Order",
        value: selectedGraphGroupData.purchase?.total_quantity || 0,
      },
      {
        name: "Inward",
        value: inwardQtyFromItems,
      },
      {
        name: "Sales Order",
        value: selectedGraphGroupData.sales_orders?.total_quantity || 0,
      },
      {
        name: "Outward",
        value: selectedGraphGroupData.outward?.total_quantity || 0,
      },
    ];
  }, [selectedGraphGroupData]);

  const itemWiseModuleData = useMemo(() => {
    if (!selectedGraphGroupData) return [];
    const itemMap = {};
    const moduleDefs = [
      { key: "purchase", data: selectedGraphGroupData.purchase?.item_usage || [] },
      { key: "inward", data: selectedGraphGroupData.inward?.item_usage || [] },
      { key: "sales_orders", data: selectedGraphGroupData.sales_orders?.item_usage || [] },
      { key: "outward", data: selectedGraphGroupData.outward?.item_usage || [] },
    ];

    moduleDefs.forEach(({ key, data }) => {
      data.forEach((item) => {
        const id = item.item_id ?? item.item_name;
        if (!itemMap[id]) {
          itemMap[id] = {
            item_name: item.item_name || "Unknown",
            purchase: 0,
            inward: 0,
            sales_orders: 0,
            outward: 0,
          };
        }
        itemMap[id][key] = Number(item.quantity || 0);
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => a.item_name.localeCompare(b.item_name))
      .slice(0, 20);
  }, [selectedGraphGroupData]);

  const usedItemsClosingBalanceData = useMemo(() => {
    const itemMap = {};
    stockGroups.forEach((group) => {
      const moduleDefs = [
        { key: "purchase", data: group.purchase?.item_usage || [] },
        { key: "inward", data: group.inward?.item_usage || [] },
        { key: "sales_orders", data: group.sales_orders?.item_usage || [] },
        { key: "outward", data: group.outward?.item_usage || [] },
      ];
      moduleDefs.forEach(({ key, data }) => {
        data.forEach((item) => {
          const id = item.item_id ?? item.item_name;
          if (!itemMap[id]) {
            itemMap[id] = {
              item_id: item.item_id,
              item_name: item.item_name || "Unknown",
              stock_group: group.name,
              closing_balance: Number(item.closing_balance || 0),
              closing_balance_display: item.closing_balance_display || "",
              purchase: 0,
              inward: 0,
              sales_orders: 0,
              outward: 0,
            };
          }
          itemMap[id][key] += Number(item.quantity || 0);
        });
      });
    });
    return Object.values(itemMap).sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [stockGroups]);

  const handleSearch = () => {
    if (toDate < fromDate) {
      toast({
        title: "Error",
        description: "To date must be greater than or equal to from date",
        variant: "destructive",
      });
      return;
    }
    setSearchEnabled(true);
    setExpandedGroups({});
    refetchReport();
  };

  const toggleGroupExpanded = (groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };


  const loading = reportLoading || isFetching;

  if (!permissionsLoading && !hasAnalysisAccess) {
    return (
      <div className="flex h-screen bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar />}
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md">
            <CardContent className="py-8 text-center text-gray-500">
              You do not have permission to view Analyzer Report.
            </CardContent>
          </Card>
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
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analyzer Report</h1>
              <p className="text-sm text-gray-500 mt-1">
                Stock group wise purchase, inward, sales order, outward, and production (stock journal) summary
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="stock-group-select">Stock Group</Label>
                    <Select
                      value={selectedStockGroup || "all"}
                      onValueChange={(value) =>
                        setSelectedStockGroup(value === "all" ? "" : value)
                      }
                      disabled={stockGroupsLoading}
                    >
                      <SelectTrigger id="stock-group-select" className="w-full min-w-[320px]">
                        {selectedStockGroupOption ? (
                          <span className="truncate">
                            {selectedStockGroupOption.name || selectedStockGroupOption.group_name || "Unknown"}
                            {selectedStockGroupOption.item_count != null
                              ? ` (${selectedStockGroupOption.item_count})`
                              : ""}
                          </span>
                        ) : (
                          <SelectValue placeholder="All Groups" />
                        )}
                      </SelectTrigger>
                      <SelectContent className="w-[420px] max-h-80">
                        <SelectItem value="all">All Groups</SelectItem>
                        {stockGroupsLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : stockGroupsData?.length > 0 ? (
                          stockGroupsData.map((group) => {
                            const groupName = group.name || group.group_name || "Unknown";
                            return (
                              <SelectItem key={group.id ?? groupName} value={groupName} className="w-full">
                                <div className="grid grid-cols-[1fr_auto] items-center gap-2 w-full">
                                  <span className="truncate">
                                    {groupName}
                                    {group.item_count != null ? ` (${group.item_count})` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    className="justify-self-end"
                                    onClick={(e) => handleToggleFavourite(e, group)}
                                    onPointerDown={(e) => e.preventDefault()}
                                  >
                                    <Star
                                      className={`h-3.5 w-3.5 ${
                                        group.is_favourite
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="no-groups" disabled>
                            No groups found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date-range">Date Range</Label>
                    <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
                      <SelectTrigger id="date-range" className="h-10">
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

                  {dateRangePreset === "custom" && (
                    <>
                      <div className="space-y-2">
                        <Label>From Date</Label>
                        <Popover
                          open={isDatePickerOpen.from}
                          onOpenChange={(open) =>
                            setIsDatePickerOpen((prev) => ({ ...prev, from: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-10 justify-start font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {fromDate ? format(fromDate, "dd-MM-yyyy") : "From Date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={fromDate}
                              onSelect={(date) => {
                                if (!date) return;
                                setFromDate(date);
                                if (date > toDate) setToDate(date);
                                setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                              }}
                              disabled={{ after: new Date() }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>To Date</Label>
                        <Popover
                          open={isDatePickerOpen.to}
                          onOpenChange={(open) =>
                            setIsDatePickerOpen((prev) => ({ ...prev, to: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-10 justify-start font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {toDate ? format(toDate, "dd-MM-yyyy") : "To Date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={toDate}
                              onSelect={(date) => {
                                if (!date) return;
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
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Button onClick={handleSearch} disabled={loading} className="w-full">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Search
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {searchEnabled && reportData && !loading && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Purchase
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatNumber(totals.purchaseQty)}</p>
                      <p className="text-sm text-gray-500">Total weight: {formatNumber(totals.purchaseQty)} Qtl</p>
                      <p className="text-lg font-semibold text-amber-700 mt-1">
                        {formatCurrency(totals.purchaseAmount)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <Box className="h-4 w-4" />
                        Inward
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatNumber(totals.inwardWeight)}</p>
                      <p className="text-sm text-gray-500">Total weight (qtl)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Sales Orders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatNumber(totals.salesQty)}</p>
                      <p className="text-sm text-gray-500">Total weight: {formatNumber(totals.salesQty)} Qtl</p>
                      <p className="text-lg font-semibold text-green-600 mt-1">
                        {formatCurrency(totals.salesAmount)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Outward
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatNumber(totals.outwardQty)}</p>
                      <p className="text-sm text-gray-500">Total weight: {formatNumber(totals.outwardQty)} Qtl</p>
                      <p className="text-lg font-semibold text-purple-600 mt-1">
                        {formatCurrency(totals.outwardAmount)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <Factory className="h-4 w-4" />
                        Production
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatNumber(totals.productionProduced)}</p>
                      <p className="text-sm text-gray-500">
                        Produced: {formatNumber(totals.productionProduced)} Qtl
                      </p>
                      <p className="text-sm text-gray-500">
                        Consumed: {formatNumber(totals.productionConsumed)} Qtl
                      </p>
                      <p className="text-xs text-sky-700 mt-1">
                        {totals.productionJournals} stock journal{totals.productionJournals !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={viewMode === "table" ? "default" : "outline"}
                        onClick={() => setViewMode("table")}
                      >
                        Table View
                      </Button>
                      <Button
                        type="button"
                        variant={viewMode === "graph" ? "default" : "outline"}
                        onClick={() => setViewMode("graph")}
                      >
                        Graph View
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {viewMode === "graph" ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        <PieChart className="h-5 w-5 text-indigo-600" />
                        Stock Group Graph View
                      </CardTitle>
                      <div className="w-full md:w-80">
                        <Label htmlFor="graph-group-select" className="text-xs text-gray-500">
                          Stock Group
                        </Label>
                        <Select
                          value={selectedGraphGroup || "all"}
                          onValueChange={(value) =>
                            setSelectedGraphGroup(value === "all" ? (stockGroups[0]?.name || "") : value)
                          }
                        >
                          <SelectTrigger id="graph-group-select">
                            <SelectValue placeholder="Select stock group" />
                          </SelectTrigger>
                          <SelectContent>
                            {stockGroups.map((group) => (
                              <SelectItem key={group.name} value={group.name}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {!selectedGraphGroupData ? (
                        <p className="text-sm text-gray-500">No graph data available.</p>
                      ) : (
                        <>
                          <div>
                            <p className="text-sm font-medium mb-2">
                              {selectedGraphGroupData.name} - Module Quantity Distribution
                            </p>
                            <div className="h-[320px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                  <Pie
                                    data={modulePieData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={110}
                                    label={({ name, value }) => `${name}: ${formatNumber(value)}`}
                                  >
                                    {modulePieData.map((entry, index) => (
                                      <Cell key={`cell-${entry.name}`} fill={MODULE_COLORS[index % MODULE_COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value) => formatNumber(value)} />
                                  <Legend />
                                </RechartsPieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-indigo-600" />
                              Item Wise Count by Module (Top 20 Items)
                            </p>
                            {itemWiseModuleData.length === 0 ? (
                              <p className="text-sm text-gray-500">No item-wise usage data available.</p>
                            ) : (
                              <div className="h-[380px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={itemWiseModuleData} margin={{ top: 10, right: 10, left: 10, bottom: 90 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="item_name" angle={-35} textAnchor="end" interval={0} height={100} />
                                    <YAxis />
                                    <Tooltip formatter={(value) => formatNumber(value)} />
                                    <Legend />
                                    <Bar dataKey="purchase" name="Purchase Order" fill="#f59e0b" />
                                    <Bar dataKey="inward" name="Inward" fill="#3b82f6" />
                                    <Bar dataKey="sales_orders" name="Sales Order" fill="#16a34a" />
                                    <Bar dataKey="outward" name="Outward" fill="#9333ea" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Layers className="h-5 w-5 text-purple-600" />
                      Stock Group Analyzer
                      <Badge variant="secondary">
                        {stockGroups.length} group{stockGroups.length !== 1 ? "s" : ""}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {reportData.from_date} to {reportData.to_date}
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {stockGroups.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        No stock group activity found for the selected filters
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[160px]">Stock Group</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead colSpan={2} className="text-center border-l bg-amber-50/50">
                              Purchase
                            </TableHead>
                            <TableHead colSpan={2} className="text-center border-l bg-blue-50/50">
                              Inward
                            </TableHead>
                            <TableHead colSpan={2} className="text-center border-l bg-green-50/50">
                              Sales Order
                            </TableHead>
                            <TableHead colSpan={2} className="text-center border-l bg-purple-50/50">
                              Outward
                            </TableHead>
                            <TableHead colSpan={2} className="text-center border-l bg-sky-50/50">
                              Production
                            </TableHead>
                          </TableRow>
                          <TableRow className="text-xs text-gray-500">
                            <TableHead />
                            <TableHead className="text-center" />
                            <TableHead className="text-right border-l bg-amber-50/50">Weight</TableHead>
                            <TableHead className="text-right bg-amber-50/50">Amount</TableHead>
                            <TableHead className="text-right border-l bg-blue-50/50">Entries</TableHead>
                            <TableHead className="text-right bg-blue-50/50">Weight</TableHead>
                            <TableHead className="text-right border-l bg-green-50/50">Weight</TableHead>
                            <TableHead className="text-right bg-green-50/50">Amount</TableHead>
                            <TableHead className="text-right border-l bg-purple-50/50">Weight</TableHead>
                            <TableHead className="text-right bg-purple-50/50">Amount</TableHead>
                            <TableHead className="text-right border-l bg-sky-50/50">Consumed</TableHead>
                            <TableHead className="text-right bg-sky-50/50">Produced</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockGroups.map((group) => (
                            <React.Fragment key={group.name}>
                              <TableRow>
                                <TableCell className="font-medium">
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 text-left"
                                    onClick={() => toggleGroupExpanded(group.name)}
                                  >
                                    {expandedGroups[group.name] ? (
                                      <ChevronDown className="h-4 w-4 text-gray-500" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-gray-500" />
                                    )}
                                    {group.is_favourite && (
                                      <Star className="h-4 w-4 fill-amber-400 text-amber-500 shrink-0" />
                                    )}
                                    <span>{group.name}</span>
                                  </button>
                                </TableCell>
                                <TableCell className="text-center">{group.item_count || 0}</TableCell>
                                <TableCell className="text-right border-l bg-amber-50/30">
                                  {formatNumber(group.purchase?.total_quantity)} qtl
                                </TableCell>
                                <TableCell className="text-right bg-amber-50/30">
                                  {formatCurrency(group.purchase?.total_amount)}
                                </TableCell>
                                <TableCell className="text-right border-l bg-blue-50/30">
                                  {group.inward?.total_count || 0}
                                </TableCell>
                                <TableCell className="text-right bg-blue-50/30">
                                  {formatNumber(group.inward?.total_weight)} qtl
                                </TableCell>
                                <TableCell className="text-right border-l bg-green-50/30">
                                  {formatNumber(group.sales_orders?.total_quantity)} qtl
                                </TableCell>
                                <TableCell className="text-right bg-green-50/30">
                                  {formatCurrency(group.sales_orders?.total_amount)}
                                </TableCell>
                                <TableCell className="text-right border-l bg-purple-50/30">
                                  {formatNumber(group.outward?.total_quantity)} qtl
                                </TableCell>
                                <TableCell className="text-right bg-purple-50/30">
                                  {formatCurrency(group.outward?.total_amount)}
                                </TableCell>
                                <TableCell className="text-right border-l bg-sky-50/30">
                                  {formatNumber(group.production?.inventory_in_quantity)} qtl
                                </TableCell>
                                <TableCell className="text-right bg-sky-50/30">
                                  {formatNumber(group.production?.inventory_out_quantity)} qtl
                                </TableCell>
                              </TableRow>
                              {expandedGroups[group.name] && (
                                <TableRow>
                                  <TableCell colSpan={12} className="bg-gray-50/60">
                                    <div className="space-y-4 py-2">
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-amber-700 mb-1">Purchase Item Usage</p>
                                          {renderItemUsageList(group.purchase?.item_usage)}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-blue-700 mb-1">Inward Item Usage</p>
                                          {renderItemUsageList(group.inward?.item_usage)}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-green-700 mb-1">Sales Item Usage</p>
                                          {renderItemUsageList(group.sales_orders?.item_usage)}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-purple-700 mb-1">Outward Item Usage</p>
                                          {renderItemUsageList(group.outward?.item_usage)}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-sky-700 mb-1">Production (IN + OUT items)</p>
                                          {(group.production?.production_items || []).length === 0 ? (
                                            <p className="text-xs text-gray-500">No items with both IN and OUT</p>
                                          ) : (
                                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                              {(group.production?.production_items || []).map((item) => (
                                                <div
                                                  key={`${item.item_id}-${item.item_name}`}
                                                  className="text-xs border-b border-gray-100 pb-1 mb-1"
                                                >
                                                  <p className="font-medium text-gray-800 truncate">{item.item_name}</p>
                                                  <p className="text-gray-600">
                                                    In: {formatNumber(item.consumed ?? item.quantity_in)} · Out:{" "}
                                                    {formatNumber(item.produced ?? item.quantity_out)}
                                                  </p>
                                                  <p className="text-gray-500">
                                                    Open: {item.opening_balance_display || "—"}
                                                  </p>
                                                  <p className="text-gray-500">
                                                    Close: {item.closing_balance_display || "—"}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-amber-700 mb-1">Purchase - Branch Wise Weight</p>
                                          {(group.purchase?.branch_wise || []).length === 0 ? (
                                            <p className="text-xs text-gray-500">No branch data</p>
                                          ) : (
                                            <div className="space-y-1">
                                              {(group.purchase?.branch_wise || []).map((b) => (
                                                <div key={`purchase-${b.branch_id}`} className="flex justify-between text-xs">
                                                  <span>{b.branch_name}</span>
                                                  <span className="font-medium">{formatNumber(b.quantity || 0)} Qtl</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-blue-700 mb-1">Inward - Branch Wise Weight</p>
                                          {(group.inward?.branch_wise || []).length === 0 ? (
                                            <p className="text-xs text-gray-500">No branch data</p>
                                          ) : (
                                            <div className="space-y-1">
                                              {(group.inward?.branch_wise || []).map((b) => (
                                                <div key={`inward-${b.branch_id}`} className="flex justify-between text-xs">
                                                  <span>{b.branch_name}</span>
                                                  <span className="font-medium">{formatNumber(b.quantity || 0)} Qtl</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-green-700 mb-1">Sales Order - Branch Wise Weight</p>
                                          {(group.sales_orders?.branch_wise || []).length === 0 ? (
                                            <p className="text-xs text-gray-500">No branch data</p>
                                          ) : (
                                            <div className="space-y-1">
                                              {(group.sales_orders?.branch_wise || []).map((b) => (
                                                <div key={`sales-${b.branch_id}`} className="flex justify-between text-xs">
                                                  <span>{b.branch_name}</span>
                                                  <span className="font-medium">{formatNumber(b.quantity || 0)} Qtl</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-purple-700 mb-1">Outward - Branch Wise Weight</p>
                                          {(group.outward?.branch_wise || []).length === 0 ? (
                                            <p className="text-xs text-gray-500">No branch data</p>
                                          ) : (
                                            <div className="space-y-1">
                                              {(group.outward?.branch_wise || []).map((b) => (
                                                <div key={`outward-${b.branch_id}`} className="flex justify-between text-xs">
                                                  <span>{b.branch_name}</span>
                                                  <span className="font-medium">{formatNumber(b.quantity || 0)} Qtl</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div className="rounded border bg-white p-2">
                                          <p className="text-xs font-semibold text-sky-700 mb-1">Production - Branch Wise</p>
                                          {(group.production?.branch_wise || []).length === 0 ? (
                                            <p className="text-xs text-gray-500">No branch data</p>
                                          ) : (
                                            <div className="space-y-1">
                                              {(group.production?.branch_wise || []).map((b) => (
                                                <div key={`production-${b.branch_id}`} className="flex justify-between text-xs gap-2">
                                                  <span className="truncate">{b.branch_name}</span>
                                                  <span className="font-medium whitespace-nowrap">
                                                    {formatNumber(b.quantity_in || 0)} / {formatNumber(b.quantity_out || 0)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Factory className="h-5 w-5 text-sky-600" />
                      Production — Stock Journal
                      <Badge variant="secondary">
                        {productionSummary?.total_journals ?? totals.productionJournals} journal
                        {(productionSummary?.total_journals ?? totals.productionJournals) !== 1 ? "s" : ""}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      Items used in both source (IN) and destination (OUT) stock journal lines only.
                      Opening = current closing − produced + consumed (period journal qty in Qtl).
                      Closing = current stock on item master.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm font-semibold text-sky-800 mb-2">Consumed (Source — IN)</p>
                        <p className="text-2xl font-bold">{formatNumber(productionSummary?.consumed_quantity ?? totals.productionConsumed)} Qtl</p>
                        {(productionItemsData || []).length === 0 ? (
                          <p className="text-xs text-gray-500 mt-2">No dual-usage items in period</p>
                        ) : (
                          <Table className="mt-3">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Closing</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {productionItemsData.map((item) => (
                                <TableRow key={`consumed-${item.item_id}-${item.item_name}`}>
                                  <TableCell className="text-sm">{item.item_name}</TableCell>
                                  <TableCell className="text-right text-sm">
                                    {formatNumber(item.consumed ?? item.quantity_in ?? item.quantity)}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {item.opening_balance_display || "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {item.closing_balance_display || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm font-semibold text-sky-800 mb-2">Produced (Destination — OUT)</p>
                        <p className="text-2xl font-bold">{formatNumber(productionSummary?.produced_quantity ?? totals.productionProduced)} Qtl</p>
                        {(productionItemsData || []).length === 0 ? (
                          <p className="text-xs text-gray-500 mt-2">No dual-usage items in period</p>
                        ) : (
                          <Table className="mt-3">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Closing</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {productionItemsData.map((item) => (
                                <TableRow key={`produced-${item.item_id}-${item.item_name}`}>
                                  <TableCell className="text-sm">{item.item_name}</TableCell>
                                  <TableCell className="text-right text-sm">
                                    {formatNumber(item.produced ?? item.quantity_out ?? item.quantity)}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {item.opening_balance_display || "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {item.closing_balance_display || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-2">
                        Production items (IN + OUT in stock journal) — opening &amp; closing balance
                      </p>
                      {productionClosingBalanceData.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No items used in both journal IN and OUT lines for the selected period.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stock Item</TableHead>
                              <TableHead>Stock Group</TableHead>
                              <TableHead className="text-right">Consumed</TableHead>
                              <TableHead className="text-right">Produced</TableHead>
                              <TableHead className="text-right">IN Count</TableHead>
                              <TableHead className="text-right">OUT Count</TableHead>
                              <TableHead className="text-right">Opening</TableHead>
                              <TableHead className="text-right">Closing</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {productionClosingBalanceData.map((item) => (
                              <TableRow key={item.item_id ?? item.item_name}>
                                <TableCell>{item.item_name}</TableCell>
                                <TableCell className="text-sm text-gray-600">{item.stock_group || "—"}</TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(item.consumed ?? item.quantity_in)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(item.produced ?? item.quantity_out)}
                                </TableCell>
                                <TableCell className="text-right">{item.in_journal_count ?? 0}</TableCell>
                                <TableCell className="text-right">{item.out_journal_count ?? 0}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {item.opening_balance_display || "—"}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  {item.closing_balance_display || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Layers className="h-5 w-5 text-slate-600" />
                      Stock Item Closing Balance
                      <Badge variant="secondary">
                        {usedItemsClosingBalanceData.length} item
                        {usedItemsClosingBalanceData.length !== 1 ? "s" : ""}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {usedItemsClosingBalanceData.length === 0 ? (
                      <p className="text-sm text-gray-500">No stock items found.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stock Item</TableHead>
                            <TableHead className="text-right">Closing Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usedItemsClosingBalanceData.map((item) => (
                            <TableRow key={item.item_id ?? item.item_name}>
                              <TableCell>{item.item_name}</TableCell>
                              <TableCell className="text-right">
                                {item.closing_balance_display || formatNumber(item.closing_balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {loading && searchEnabled && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {!searchEnabled && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Select filters and click Search to view analyzer report by stock group
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Loader isLoading={Boolean(loading && searchEnabled)} text="Loading stock group analysis" />
    </div>
  );
}
