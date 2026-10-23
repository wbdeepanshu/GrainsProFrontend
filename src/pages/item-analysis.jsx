import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { ArrowLeft, Package, Truck, Box, Loader2, Search, BarChart3, PieChart, Layers, Star, CalendarIcon } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function ItemAnalysis() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const token = AuthService.getAccessToken();

  // Set default dates to current month
  const getCurrentMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };

  const { firstDay, lastDay } = getCurrentMonthDates();
  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(lastDay);
  const [dateRangePreset, setDateRangePreset] = useState("monthly"); // "today" | "weekly" | "monthly" | "custom"
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [selectedStockGroup, setSelectedStockGroup] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Apply date range preset when dropdown changes
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

  // Fetch stock groups from analysis API (only groups with data)
  const { data: stockGroupsData, isLoading: stockGroupsLoading, refetch: refetchStockGroups } = useQuery({
    queryKey: ['stock-groups-analysis', fromDate, toDate],
    queryFn: async () => {
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      const response = await apiRequest('GET', `${API_BASE_URL}/api/user/item-analysis-stock-groups/?from_date=${fromDateStr}&to_date=${toDateStr}`);
      if (!response.ok) throw new Error('Failed to fetch stock groups');
      const data = await response.json();
      return data.status === 200 ? data.data : [];
    },
    enabled: !!token && !!fromDate && !!toDate,
  });

  // Toggle favourite mutation
  const toggleFavouriteMutation = useMutation({
    mutationFn: async (groupId) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/user/stock-group/${groupId}/toggle-favourite/`);
      if (!response.ok) throw new Error('Failed to toggle favourite');
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      // Refetch stock groups and all items data after toggling
      refetchStockGroups();
      refetchAllItems();
      queryClient.invalidateQueries({ queryKey: ['stock-groups-analysis'] });
      queryClient.invalidateQueries({ queryKey: ['item-analysis-all'] });
      toast({
        title: "Success",
        description: "Favourite status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle favourite status",
        variant: "destructive",
      });
    },
  });


  // Handle toggle favourite
  const handleToggleFavourite = (e, groupId) => {
    e.stopPropagation();
    if (groupId) {
      toggleFavouriteMutation.mutate(groupId);
    }
  };

  // Fetch stock items - show all by default, filter by stock group if selected
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['stock-items', selectedStockGroup, searchQuery],
    queryFn: async () => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/stock-items/`, {
        type: 'default',
        search: searchQuery || '',
      });
      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();
      let items = data.status === 200 ? data.data : [];
      
      // Filter by stock group if selected (parent field)
      if (selectedStockGroup && items.length > 0) {
        items = items.filter(item => item.parent === selectedStockGroup);
      }
      
      return items;
    },
    enabled: !!token,
  });

  // Fetch all stock items details by date range (default view)
  const { data: allItemsData, isLoading: allItemsLoading, refetch: refetchAllItems } = useQuery({
    queryKey: ['item-analysis-all', fromDate, toDate, selectedStockGroup],
    queryFn: async () => {
      const currentToken = AuthService.getAccessToken();
      if (!currentToken) {
        throw new Error('No access token available');
      }
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      let url = `${API_BASE_URL}/api/user/item-analysis/?from_date=${fromDateStr}&to_date=${toDateStr}`;
      if (selectedStockGroup) {
        url += `&stock_group=${encodeURIComponent(selectedStockGroup)}`;
      }
      const response = await apiRequest('GET', url);
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = '/login';
          return null;
        }
        throw new Error('Failed to fetch all items details');
      }
      const data = await response.json();
      return data.status === 200 ? data.data : {};
    },
    enabled: !!token && !!fromDate && !!toDate && !selectedItem,
    retry: false,
  });

  // Fetch single item details by date range (when item is selected)
  const { data: itemDetailsData, isLoading: itemDetailsLoading, refetch: refetchItemDetails } = useQuery({
    queryKey: ['item-analysis', selectedItem, fromDate, toDate],
    queryFn: async () => {
      if (!selectedItem) return null;
      const currentToken = AuthService.getAccessToken();
      if (!currentToken) {
        throw new Error('No access token available');
      }
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      const response = await apiRequest('GET', `${API_BASE_URL}/api/user/item-analysis/${selectedItem}/?from_date=${fromDateStr}&to_date=${toDateStr}`);
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = '/login';
          return null;
        }
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch item details');
      }
      const data = await response.json();
      return data.status === 200 ? data.data : null;
    },
    enabled: !!token && !!selectedItem && !!fromDate && !!toDate,
    retry: false,
  });

  const handleSearch = () => {
    if (selectedItem) {
      refetchItemDetails();
    } else {
      refetchAllItems();
    }
  };

  const handleItemSelect = (itemId) => {
    setSelectedItem(itemId);
  };

  const handleClearSelection = () => {
    setSelectedItem("");
  };

  // Auto-load all items data on mount and when dates change (if no item selected)
  useEffect(() => {
    if (!selectedItem && fromDate && toDate) {
      refetchAllItems();
    }
  }, [fromDate, toDate, selectedItem]);

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Prepare stock group wise chart data
  const stockGroupChartData = useMemo(() => {
    if (!allItemsData || !allItemsData.stock_groups) return [];
    
    return Object.entries(allItemsData.stock_groups).map(([groupName, groupData]) => ({
      groupName: groupName || 'Ungrouped',
      totalItems: groupData.total_items || 0,
      salesOrders: groupData.sales_orders?.total_count || 0,
      salesOrdersAmount: groupData.sales_orders?.total_amount || 0,
      inwardEntries: groupData.inward?.total_count || 0,
      inwardWeight: groupData.inward?.total_weight || 0,
      outwardEntries: groupData.outward?.total_count || 0,
      outwardAmount: groupData.outward?.total_amount || 0,
    }));
  }, [allItemsData]);

  // Prepare item wise chart data (when stock group is selected)
  const itemChartData = useMemo(() => {
    if (!allItemsData || !selectedStockGroup) return [];
    
    // Combine items from all modules
    const itemsMap = new Map();
    
    // Add items from sales_orders
    if (allItemsData.sales_orders) {
      Object.entries(allItemsData.sales_orders).forEach(([itemId, itemData]) => {
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, {
            itemId,
            itemName: itemData.item_name || itemId,
            itemGroup: itemData.item_group || 'Ungrouped',
            salesOrders: 0,
            salesOrdersAmount: 0,
            inwardEntries: 0,
            inwardWeight: 0,
            outwardEntries: 0,
            outwardAmount: 0,
          });
        }
        itemsMap.get(itemId).salesOrders = itemData.total_count || 0;
        itemsMap.get(itemId).salesOrdersAmount = itemData.total_amount || 0;
      });
    }
    
    // Add items from inward
    if (allItemsData.inward) {
      Object.entries(allItemsData.inward).forEach(([itemId, itemData]) => {
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, {
            itemId,
            itemName: itemData.item_name || itemId,
            itemGroup: itemData.item_group || 'Ungrouped',
            salesOrders: 0,
            salesOrdersAmount: 0,
            inwardEntries: 0,
            inwardWeight: 0,
            outwardEntries: 0,
            outwardAmount: 0,
          });
        }
        itemsMap.get(itemId).inwardEntries = itemData.total_count || 0;
        itemsMap.get(itemId).inwardWeight = itemData.total_weight || 0;
      });
    }
    
    // Add items from outward
    if (allItemsData.outward) {
      Object.entries(allItemsData.outward).forEach(([itemId, itemData]) => {
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, {
            itemId,
            itemName: itemData.item_name || itemId,
            itemGroup: itemData.item_group || 'Ungrouped',
            salesOrders: 0,
            salesOrdersAmount: 0,
            inwardEntries: 0,
            inwardWeight: 0,
            outwardEntries: 0,
            outwardAmount: 0,
          });
        }
        itemsMap.get(itemId).outwardEntries = itemData.total_count || 0;
        itemsMap.get(itemId).outwardAmount = itemData.total_amount || 0;
      });
    }
    
    return Array.from(itemsMap.values());
  }, [allItemsData, selectedStockGroup]);

  // Colors for charts
  const CHART_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' && entry.value > 1000 
                ? formatCurrency(entry.value) 
                : formatNumber(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar />}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/reports")}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Item Analysis</h1>
                <p className="text-sm text-gray-500 mt-1">Analyze item performance across sales orders, inward, and outward</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filters Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Stock Group Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="stock-group-select">Stock Group</Label>
                    <Select
                      value={selectedStockGroup || "all"}
                      onValueChange={(value) => setSelectedStockGroup(value === "all" ? "" : value)}
                      disabled={stockGroupsLoading}
                    >
                      <SelectTrigger id="stock-group-select" className="w-full">
                        <SelectValue placeholder="All Groups" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {stockGroupsLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : stockGroupsData && stockGroupsData.length > 0 ? (
                          stockGroupsData.map((group) => {
                            const groupName = group.name || group.group_name || 'Unknown';
                            const groupValue = group.name || group.group_name || 'Unknown';
                            return (
                              <SelectItem key={group.id || groupName} value={groupValue}>
                                <div className="flex items-center space-x-2">
                                  {group.is_favourite && (
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  )}
                                  <span>{groupName} ({group.item_count} items)</span>
                                </div>
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="no-groups" disabled>No groups found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Item Search */}
                  <div className="space-y-2">
                    <Label htmlFor="item-search">Search Item</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="item-search"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Item Select */}
                  <div className="space-y-2">
                    <Label htmlFor="item-select">Select Item</Label>
                    <Select
                      value={selectedItem || "all"}
                      onValueChange={(value) => setSelectedItem(value === "all" ? "" : value)}
                      disabled={itemsLoading}
                    >
                      <SelectTrigger id="item-select" className="w-full">
                        <SelectValue placeholder="All Items" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Items</SelectItem>
                        {itemsLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : itemsData && itemsData.length > 0 ? (
                          itemsData.map((item) => (
                            <SelectItem key={item.id} value={item.id.toString()}>
                              {item.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-items" disabled>No items found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range Dropdown + Custom Dates */}
                  <div className="space-y-2">
                    <Label htmlFor="date-range">Date Range</Label>
                    <Select
                      value={dateRangePreset}
                      onValueChange={(value) => setDateRangePreset(value)}
                    >
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
                      {/* From Date Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="from-date">From Date</Label>
                        <Popover
                          open={isDatePickerOpen.from}
                          onOpenChange={(open) =>
                            setIsDatePickerOpen((prev) => ({ ...prev, from: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-10 justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {fromDate ? format(fromDate, "dd-MM-yyyy") : "From Date"}
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
                                setFromDate(date);
                                if (date && toDate && date > toDate) {
                                  setToDate(date);
                                }
                                setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                              }}
                              disabled={{ after: new Date() }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* To Date Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="to-date">To Date</Label>
                        <Popover
                          open={isDatePickerOpen.to}
                          onOpenChange={(open) =>
                            setIsDatePickerOpen((prev) => ({ ...prev, to: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-10 justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {toDate ? format(toDate, "dd-MM-yyyy") : "To Date"}
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

                  {/* Search Button */}
                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Button
                      onClick={handleSearch}
                      disabled={allItemsLoading || itemDetailsLoading}
                      className="w-full"
                    >
                      {(allItemsLoading || itemDetailsLoading) ? (
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

            {/* Loading State */}
            {(allItemsLoading || itemDetailsLoading) && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {/* All Items Analysis View */}
            {!selectedItem && allItemsData && Object.keys(allItemsData).length > 0 && (
              <div className="space-y-6">
                {/* Stock Groups Summary */}
                {allItemsData.stock_groups && Object.keys(allItemsData.stock_groups).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Layers className="h-5 w-5 mr-2 text-purple-600" />
                          Stock Groups Summary
                        </span>
                        <Badge variant="secondary">{Object.keys(allItemsData.stock_groups).length} Groups</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(allItemsData.stock_groups).map(([groupName, groupData]) => {
                          // Find the group ID from stockGroupsData
                          const stockGroupInfo = stockGroupsData?.find(g => (g.name || g.group_name) === groupName);
                          const groupId = stockGroupInfo?.id;
                          const isFavourite = stockGroupInfo?.is_favourite || false;
                          
                          return (
                          <Card key={groupName} className="bg-gradient-to-br from-purple-50 to-blue-50">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center justify-between text-sm font-medium text-gray-700">
                                <span>{groupName || 'Ungrouped'}</span>
                                {groupId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-transparent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleFavourite(e, groupId);
                                    }}
                                    disabled={toggleFavouriteMutation.isPending}
                                    title={isFavourite ? "Remove from favourites" : "Add to favourites"}
                                  >
                                    <Star 
                                      className={`h-5 w-5 transition-colors ${
                                        isFavourite 
                                          ? 'fill-yellow-400 text-yellow-400' 
                                          : 'text-gray-400 hover:text-yellow-400'
                                      }`}
                                    />
                                  </Button>
                                )}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <p className="text-xs text-gray-500">Total Items: {groupData.total_items || 0}</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-gray-600">Sales Orders</p>
                                    <p className="font-semibold text-blue-600">{groupData.sales_orders?.total_count || 0}</p>
                                    <p className="text-gray-500">{formatCurrency(groupData.sales_orders?.total_amount || 0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Inward</p>
                                    <p className="font-semibold text-green-600">{groupData.inward?.total_count || 0}</p>
                                    <p className="text-gray-500">{formatNumber(groupData.inward?.total_weight || 0)} qtl</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Outward</p>
                                    <p className="font-semibold text-orange-600">{groupData.outward?.total_count || 0}</p>
                                    <p className="text-gray-500">{formatCurrency(groupData.outward?.total_amount || 0)}</p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Charts Section - Show stock group wise when no group selected, item wise when group selected */}
                {!selectedStockGroup && stockGroupChartData.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales Orders Comparison Chart - Stock Groups */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                          Sales Orders by Stock Group
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={stockGroupChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="groupName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="salesOrders" fill="#3b82f6" name="Sales Orders" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Sales Orders Amount Comparison Chart - Stock Groups */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                          Sales Orders Amount by Stock Group
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={stockGroupChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="groupName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="salesOrdersAmount" fill="#10b981" name="Amount (₹)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Inward Comparison Chart - Stock Groups */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Box className="h-5 w-5 mr-2 text-indigo-600" />
                          Inward by Stock Group
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={stockGroupChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="groupName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="inwardEntries" fill="#6366f1" name="Inward Entries" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Outward Comparison Chart - Stock Groups */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Truck className="h-5 w-5 mr-2 text-orange-600" />
                          Outward by Stock Group
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={stockGroupChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="groupName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="outwardEntries" fill="#f59e0b" name="Outward Entries" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Item Wise Charts - When Stock Group is Selected */}
                {selectedStockGroup && itemChartData.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales Orders Comparison Chart - Items */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                          Sales Orders by Item ({selectedStockGroup})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={itemChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="itemName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="salesOrders" fill="#3b82f6" name="Sales Orders" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Sales Orders Amount Comparison Chart - Items */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                          Sales Orders Amount by Item ({selectedStockGroup})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={itemChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="itemName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="salesOrdersAmount" fill="#10b981" name="Amount (₹)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Inward Comparison Chart - Items */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Box className="h-5 w-5 mr-2 text-indigo-600" />
                          Inward by Item ({selectedStockGroup})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={itemChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="itemName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="inwardEntries" fill="#6366f1" name="Inward Entries" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Outward Comparison Chart - Items */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Truck className="h-5 w-5 mr-2 text-orange-600" />
                          Outward by Item ({selectedStockGroup})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={itemChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="itemName" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="outwardEntries" fill="#f59e0b" name="Outward Entries" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Table View - Stock Groups when no group selected, Items when group selected */}
                {!selectedStockGroup && stockGroupChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Layers className="h-5 w-5 mr-2 text-purple-600" />
                          Stock Groups Analysis Summary
                        </span>
                        <Badge variant="secondary">
                          {stockGroupChartData.length} Groups
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stock Group</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Total Items</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Sales Orders</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Inward</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Outward</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockGroupChartData.map((group) => (
                              <tr key={group.groupName} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium text-gray-900">{group.groupName}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <p className="font-semibold text-gray-600">{group.totalItems}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-blue-600">{group.salesOrders}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(group.salesOrdersAmount)}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-green-600">{group.inwardEntries}</p>
                                    <p className="text-xs text-gray-500">{formatNumber(group.inwardWeight)} qtl</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-orange-600">{group.outwardEntries}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(group.outwardAmount)}</p>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Item Wise Table - When Stock Group is Selected */}
                {selectedStockGroup && itemChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Package className="h-5 w-5 mr-2 text-blue-600" />
                          Items Analysis Summary ({selectedStockGroup})
                        </span>
                        <Badge variant="secondary">
                          {itemChartData.length} Items
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Sales Orders</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Inward</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Outward</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemChartData.map((item) => (
                              <tr key={item.itemId} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium text-gray-900">{item.itemName}</p>
                                    <p className="text-xs text-gray-500">ID: {item.itemId}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-blue-600">{item.salesOrders}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(item.salesOrdersAmount)}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-green-600">{item.inwardEntries}</p>
                                    <p className="text-xs text-gray-500">{formatNumber(item.inwardWeight)} qtl</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-orange-600">{item.outwardEntries}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(item.outwardAmount)}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleItemSelect(item.itemId)}
                                  >
                                    View Details
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Single Item Detailed View */}
            {selectedItem && itemDetailsData && (
              <div className="space-y-4">
                {/* Item Info Header */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {itemsData?.find(i => i.id.toString() === selectedItem)?.name || itemDetailsData.item_name || selectedItem}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Item ID: {itemDetailsData.item_id || selectedItem}</p>
                        {itemDetailsData.item_group && (
                          <Badge variant="outline" className="mt-2">
                            Group: {itemDetailsData.item_group}
                          </Badge>
                        )}
                      </div>
                      <Button onClick={handleClearSelection} variant="outline">
                        Back to All Items
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Sales Orders Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Package className="h-5 w-5 mr-2 text-blue-600" />
                        Sales Orders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Orders</p>
                          <p className="text-2xl font-bold text-blue-600">{itemDetailsData.sales_orders?.total_count || 0}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Items</p>
                          <p className="text-2xl font-bold text-green-600">{itemDetailsData.sales_orders?.total_items || 0}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Quantity</p>
                          <p className="text-2xl font-bold text-purple-600">{formatNumber(itemDetailsData.sales_orders?.total_quantity || 0)}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-2xl font-bold text-orange-600">{formatCurrency(itemDetailsData.sales_orders?.total_amount || 0)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Inward Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Box className="h-5 w-5 mr-2 text-green-600" />
                        Inward
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Entries</p>
                          <p className="text-2xl font-bold text-blue-600">{itemDetailsData.inward?.total_count || 0}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Items</p>
                          <p className="text-2xl font-bold text-green-600">{itemDetailsData.inward?.total_items || 0}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg col-span-2">
                          <p className="text-sm text-gray-600">Total Weight</p>
                          <p className="text-2xl font-bold text-purple-600">{formatNumber(itemDetailsData.inward?.total_weight || 0)} qtl</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Outward Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Truck className="h-5 w-5 mr-2 text-orange-600" />
                        Outward
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Entries</p>
                          <p className="text-2xl font-bold text-blue-600">{itemDetailsData.outward?.total_count || 0}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Items</p>
                          <p className="text-2xl font-bold text-green-600">{itemDetailsData.outward?.total_items || 0}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Quantity</p>
                          <p className="text-2xl font-bold text-purple-600">{formatNumber(itemDetailsData.outward?.total_quantity || 0)}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-2xl font-bold text-orange-600">{formatCurrency(itemDetailsData.outward?.total_amount || 0)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* No Data State */}
            {!allItemsLoading && !itemDetailsLoading && !selectedItem && (!allItemsData || Object.keys(allItemsData).length === 0) && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No data found for the selected date range</p>
                </CardContent>
              </Card>
            )}

            {/* Initial State */}
            {!selectedItem && (!allItemsData || Object.keys(allItemsData).length === 0) && !allItemsLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Select date range to view item analysis</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
