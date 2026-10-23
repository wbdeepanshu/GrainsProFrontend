import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { ArrowLeft, Users, Package, Truck, Receipt, Route, MapPin, Loader2, Search, BarChart3, PieChart, Check, ChevronsUpDown, ArrowDown, CalendarIcon } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Loader from "@/components/common/loader";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const truncateLabel = (text, max = 32) => {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
};

const SalesOrdersPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const percent = item?.payload?.percent;
  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
      <p className="font-semibold text-sm break-words">{item.name}</p>
      <p className="text-sm text-gray-600">Orders: {new Intl.NumberFormat("en-IN").format(item.value || 0)}</p>
      {percent != null && (
        <p className="text-sm text-gray-600">Share: {(percent * 100).toFixed(1)}%</p>
      )}
    </div>
  );
};

export default function CustomerAnalysis() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const token = AuthService.getAccessToken();
  
  // Get user permissions for modules
  const { hasReadPermission, isLoading: permissionsLoading } = useUserPermissions();
  
  // Check permissions for each module
  const hasSalesOrderAccess = hasReadPermission("sales_order");
  const hasInwardAccess = hasReadPermission("inward");
  const hasOutwardAccess = hasReadPermission("outward");

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
  const [selectedLedgerGroup, setSelectedLedgerGroup] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  
  // Set default active table based on permissions (inward has priority)
  const getDefaultActiveTable = () => {
    if (hasInwardAccess) return "inward";
    if (hasOutwardAccess || hasSalesOrderAccess) return "outward";
    return "inward"; // fallback
  };
  
  const [activeTable, setActiveTable] = useState("inward"); // Will be updated based on permissions
  
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

  // Update active table when permissions load
  React.useEffect(() => {
    if (!permissionsLoading) {
      setActiveTable(getDefaultActiveTable());
    }
  }, [permissionsLoading, hasInwardAccess, hasOutwardAccess, hasSalesOrderAccess]);

  // Fetch ledger groups
  const { data: ledgerGroupsData, isLoading: ledgerGroupsLoading } = useQuery({
    queryKey: ['ledger-groups'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-groups/?is_live=true&is_active=true&per_page=1000`);
      if (!response.ok) throw new Error('Failed to fetch ledger groups');
      const data = await response.json();
      return data.status === 200 ? data.data : [];
    },
    enabled: !!token,
  });

  // Fetch customers - show all by default, filter by ledger group if selected
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers', selectedLedgerGroup],
    queryFn: async () => {
      const params = new URLSearchParams({
        per_page: '1000',
      });
      if (selectedLedgerGroup) {
        params.append('ledger_group_id', selectedLedgerGroup);
      }
      const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/get-customers/?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      return data.status === 200 ? data.data : [];
    },
    enabled: !!token,
  });

  // Fetch all customers details by date range (default view)
  const { data: allCustomersData, isLoading: allCustomersLoading, refetch: refetchAllCustomers } = useQuery({
    queryKey: ['customer-analysis-all', fromDate, toDate],
    queryFn: async () => {
      const currentToken = AuthService.getAccessToken();
      if (!currentToken) {
        throw new Error('No access token available');
      }
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      const response = await apiRequest('GET', `${API_BASE_URL}/api/user/customer-analysis/?from_date=${fromDateStr}&to_date=${toDateStr}`);
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = '/login';
          return null;
        }
        throw new Error('Failed to fetch all customers details');
      }
      const data = await response.json();
      return data.status === 200 ? data.data : {};
    },
    enabled: !!token && !!fromDate && !!toDate && !selectedCustomer,
    retry: false,
  });

  // Fetch single customer details by date range (when customer is selected)
  const { data: customerDetailsData, isLoading: customerDetailsLoading, refetch: refetchCustomerDetails } = useQuery({
    queryKey: ['customer-analysis', selectedCustomer, fromDate, toDate],
    queryFn: async () => {
      if (!selectedCustomer) return null;
      const currentToken = AuthService.getAccessToken();
      if (!currentToken) {
        throw new Error('No access token available');
      }
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      const response = await apiRequest('GET', `${API_BASE_URL}/api/user/customer-analysis/${selectedCustomer}/?from_date=${fromDateStr}&to_date=${toDateStr}`);
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = '/login';
          return null;
        }
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch customer details');
      }
      const data = await response.json();
      return data.status === 200 ? data.data : null;
    },
    enabled: !!token && !!selectedCustomer && !!fromDate && !!toDate,
    retry: false,
  });

  const handleSearch = () => {
    if (selectedCustomer) {
      refetchCustomerDetails();
    } else {
      refetchAllCustomers();
    }
  };

  const handleCustomerSelect = (customer) => {
    if (customer === "All") {
      setSelectedCustomer("");
    } else {
      setSelectedCustomer(customer);
    }
    setCustomerDropdownOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedCustomer("");
  };

  // Auto-load all customers data on mount and when dates change (if no customer selected)
  useEffect(() => {
    if (!selectedCustomer && fromDate && toDate && token) {
      refetchAllCustomers();
    }
  }, [fromDate, toDate, selectedCustomer, token]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  // Prepare chart data from all customers data - include customers from any module user has access to
  const chartData = useMemo(() => {
    if (!allCustomersData) return [];
    
    // Get all customer IDs from modules user has access to
    const customerIdsSet = new Set();
    
    if (hasSalesOrderAccess && allCustomersData.sales_orders) {
      Object.keys(allCustomersData.sales_orders).forEach(id => customerIdsSet.add(id));
    }
    if (hasOutwardAccess && allCustomersData.outward) {
      Object.keys(allCustomersData.outward).forEach(id => customerIdsSet.add(id));
    }
    if (hasInwardAccess && allCustomersData.inward) {
      Object.keys(allCustomersData.inward).forEach(id => customerIdsSet.add(id));
    }
    
    if (customerIdsSet.size === 0) return [];
    
    // Build chart data from all customer IDs
    return Array.from(customerIdsSet).map((customerId, index) => ({
      index: index + 1, // Use index instead of customer name
      customerId,
      customerName: allCustomersData.inward?.[customerId]?.customer_name || 
                   allCustomersData.sales_orders?.[customerId]?.customer_name || 
                   allCustomersData.outward?.[customerId]?.customer_name || 
                   customerId,
      salesOrders: allCustomersData.sales_orders?.[customerId]?.total_count || 0,
      salesOrdersAmount: allCustomersData.sales_orders?.[customerId]?.total_amount || 0,
      outwardEntries: allCustomersData.outward?.[customerId]?.total_count || 0,
      outwardAmount: allCustomersData.outward?.[customerId]?.total_amount || 0,
      inwardCreated: allCustomersData.inward?.[customerId]?.total_count || 0,
      inwardCompleted: allCustomersData.inward?.[customerId]?.total_completed || 0,
    }));
  }, [allCustomersData, hasSalesOrderAccess, hasOutwardAccess, hasInwardAccess]);

  // Prepare inward summary chart data
  const inwardChartData = useMemo(() => {
    if (!allCustomersData?.inward_summary) return [];
    
    const summary = allCustomersData.inward_summary;
    return [
      { name: 'Total Created', value: summary.total_created || 0 },
      { name: 'Total Completed', value: summary.total_completed || 0 },
    ];
  }, [allCustomersData]);

  const salesOrdersPieData = useMemo(() => {
    const items = chartData
      .filter((item) => item.salesOrders > 0)
      .map((item) => ({
        name: item.customerName,
        value: item.salesOrders,
      }));
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return items.map((item) => ({
      ...item,
      percent: total > 0 ? item.value / total : 0,
    }));
  }, [chartData]);

  // Colors for charts
  const CHART_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Find customer name from the data
      const dataIndex = label - 1; // label is the index from chart
      const customerName = chartData[dataIndex]?.customerName || `Customer ${label}`;
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold mb-2">{customerName}</p>
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
                onClick={() => setLocation("/dashboard")}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Customer Analysis</h1>
                <p className="text-sm text-gray-500 mt-1">Analyze customer performance by date range</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Filters Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="h-5 w-5 mr-2" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Ledger Group Filter */}
                <div className="space-y-2">
                  <Label htmlFor="ledger-group">Ledger Group</Label>
                  <Select
                    value={selectedLedgerGroup || undefined}
                    onValueChange={(value) => {
                      setSelectedLedgerGroup(value === "all" ? "" : value);
                      setSelectedCustomer(""); // Reset customer when ledger group changes
                    }}
                    disabled={ledgerGroupsLoading}
                  >
                    <SelectTrigger id="ledger-group">
                      <SelectValue placeholder="All Ledger Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ledger Groups</SelectItem>
                      {ledgerGroupsData?.map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Filter with Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    Customer
                  </label>
                  <div className="relative">
                    <Popover open={customerDropdownOpen} onOpenChange={setCustomerDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerDropdownOpen}
                          className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <span className="truncate">
                            {selectedCustomer === "" || selectedCustomer === "All" 
                              ? "All Customers" 
                              : customersData?.find(c => c.id.toString() === selectedCustomer)?.name || "Select customer"}
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
                        <Command>
                          <CommandInput placeholder="Search customers..." />
                          <CommandList>
                            <CommandEmpty>
                              {customersLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Loading customers...
                                </div>
                              ) : (
                                "No customers found."
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                {/* All Customers Option */}
                                <CommandItem
                                  key="all"
                                  value="All"
                                  onSelect={() => handleCustomerSelect("All")}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check
                                      className={`h-4 w-4 ${
                                        selectedCustomer === "" || selectedCustomer === "All" ? "opacity-100 text-blue-600" : "opacity-0"
                                      }`}
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900">All Customers</div>
                                    </div>
                                  </div>
                                </CommandItem>
                                
                                {/* Individual Customers */}
                                {customersData?.map((customer) => (
                                  <CommandItem
                                    key={customer.id}
                                    value={customer.name}
                                    onSelect={() => handleCustomerSelect(customer.id.toString())}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${
                                          selectedCustomer === customer.id.toString() ? "opacity-100 text-blue-600" : "opacity-0"
                                        }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">{customer.name}</div>
                                        {customer.mobile && (
                                          <div className="text-sm text-gray-500">{customer.mobile}</div>
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
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSearch}
                      disabled={customerDetailsLoading || allCustomersLoading}
                      className="flex-1"
                    >
                      {(customerDetailsLoading || allCustomersLoading) ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search
                        </>
                      )}
                    </Button>
                    {selectedCustomer && (
                      <Button
                        onClick={handleClearSelection}
                        variant="outline"
                        className="flex-1"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Customers Summary View */}
          {!selectedCustomer && allCustomersData && (
            (hasSalesOrderAccess && allCustomersData.sales_orders && Object.keys(allCustomersData.sales_orders).length > 0) ||
            (hasOutwardAccess && allCustomersData.outward && Object.keys(allCustomersData.outward).length > 0) ||
            (hasInwardAccess && allCustomersData.inward && Object.keys(allCustomersData.inward).length > 0)
          ) && (
            <div className="space-y-6">
              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Orders Comparison Chart */}
                {hasSalesOrderAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                      Sales Orders Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="index"
                          tick={false}
                          axisLine={false}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="salesOrders" fill="#3b82f6" name="Sales Orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                )}

                {/* Sales Orders Amount Comparison Chart */}
                {hasSalesOrderAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                      Sales Orders Amount Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="index"
                          tick={false}
                          axisLine={false}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="salesOrdersAmount" fill="#10b981" name="Amount (₹)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                )}

                {/* Outward Comparison Chart */}
                {hasOutwardAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Truck className="h-5 w-5 mr-2 text-indigo-600" />
                      Outward Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="index"
                          tick={false}
                          axisLine={false}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="outwardEntries" fill="#6366f1" name="Outward Entries" />
                        <Bar dataKey="outwardAmount" fill="#8b5cf6" name="Outward Amount (₹)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                )}

                {/* Inward Summary Chart - Created vs Completed */}
                {hasInwardAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-purple-600" />
                      Inward Summary - Created vs Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="index"
                          tick={false}
                          axisLine={false}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="inwardCreated" fill="#9333ea" name="Inward Created" />
                        <Bar dataKey="inwardCompleted" fill="#10b981" name="Inward Completed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                )}

                {/* Inward Overall Summary Pie Chart */}
                {hasInwardAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <PieChart className="h-5 w-5 mr-2 text-purple-600" />
                      Inward Overall Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {inwardChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={inwardChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {inwardChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#9333ea' : '#10b981'} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        No inward data available
                      </div>
                    )}
                  </CardContent>
                </Card>
                )}

                {/* Sales Orders Distribution Pie Chart */}
                {hasSalesOrderAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <PieChart className="h-5 w-5 mr-2 text-orange-600" />
                      Sales Orders Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {salesOrdersPieData.length > 0 ? (
                      <div className="space-y-4">
                        <ResponsiveContainer width="100%" height={260}>
                          <RechartsPieChart>
                            <Pie
                              data={salesOrdersPieData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={false}
                              outerRadius={90}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {salesOrdersPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<SalesOrdersPieTooltip />} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs max-h-36 overflow-y-auto pr-1">
                          {salesOrdersPieData.map((item, index) => (
                            <div key={`${item.name}-${index}`} className="flex items-start gap-2 min-w-0">
                              <span
                                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              />
                              <span className="leading-snug text-gray-700" title={item.name}>
                                {truncateLabel(item.name)}: {(item.percent * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        No sales orders data available
                      </div>
                    )}
                  </CardContent>
                </Card>
                )}
              </div>

              {/* Table View with Toggle */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-blue-600" />
                      All Customers Analysis Summary (Inward Based)
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {(() => {
                          const customerIdsSet = new Set();
                          if (hasSalesOrderAccess && allCustomersData.sales_orders) {
                            Object.keys(allCustomersData.sales_orders).forEach(id => customerIdsSet.add(id));
                          }
                          if (hasOutwardAccess && allCustomersData.outward) {
                            Object.keys(allCustomersData.outward).forEach(id => customerIdsSet.add(id));
                          }
                          if (hasInwardAccess && allCustomersData.inward) {
                            Object.keys(allCustomersData.inward).forEach(id => customerIdsSet.add(id));
                          }
                          return customerIdsSet.size;
                        })()} Customers
                      </Badge>
                      {/* Toggle Buttons - Only show if user has access to both modules */}
                      {(hasInwardAccess || hasOutwardAccess || hasSalesOrderAccess) && (
                      <div className="flex gap-2 ml-4">
                        {hasInwardAccess && (
                        <Button
                          variant={activeTable === "inward" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveTable("inward")}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Inward
                        </Button>
                        )}
                        {(hasOutwardAccess || hasSalesOrderAccess) && (
                        <Button
                          variant={activeTable === "outward" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveTable("outward")}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Outward & Sales Orders
                        </Button>
                        )}
                      </div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Inward Overall Summary */}
                  {hasInwardAccess && allCustomersData.inward_summary && (
                    <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h3 className="text-lg font-semibold text-purple-900 mb-3">Inward Overall Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Total Created</p>
                          <p className="text-2xl font-bold text-purple-600">{allCustomersData.inward_summary.total_created || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Completed</p>
                          <p className="text-2xl font-bold text-green-600">{allCustomersData.inward_summary.total_completed || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Items</p>
                          <p className="text-2xl font-bold text-blue-600">{allCustomersData.inward_summary.total_items || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Quantity</p>
                          <p className="text-2xl font-bold text-indigo-600">{formatNumber(allCustomersData.inward_summary.total_quantity || 0)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Inward Table */}
                  {activeTable === "inward" && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Inward Created</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Inward Completed</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Total Items</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Total Quantity</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(allCustomersData.inward || {}).map(([customerId, customerData]) => (
                            <tr key={customerId} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900">{customerData.customer_name || customerId}</p>
                                  <p className="text-xs text-gray-500">ID: {customerId}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div>
                                  <p className="font-semibold text-purple-600">{customerData.total_count || 0}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div>
                                  <p className="font-semibold text-green-600">{customerData.total_completed || 0}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <p className="font-semibold text-blue-600">{customerData.total_items || 0}</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <p className="font-semibold text-indigo-600">{formatNumber(customerData.total_quantity || 0)}</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCustomerSelect(customerId)}
                                >
                                  View Details
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Outward & Sales Orders Table */}
                  {(hasOutwardAccess || hasSalesOrderAccess) && activeTable === "outward" && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Sales Orders</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Sales Orders Amount</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Outward Entries</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Outward Amount</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Get all customer IDs that have sales_orders or outward data
                            const customerIdsSet = new Set();
                            if (hasSalesOrderAccess && allCustomersData.sales_orders) {
                              Object.keys(allCustomersData.sales_orders).forEach(id => customerIdsSet.add(id));
                            }
                            if (hasOutwardAccess && allCustomersData.outward) {
                              Object.keys(allCustomersData.outward).forEach(id => customerIdsSet.add(id));
                            }
                            return Array.from(customerIdsSet);
                          })().map((customerId) => {
                            const salesOrderData = allCustomersData.sales_orders?.[customerId];
                            const outwardData = allCustomersData.outward?.[customerId];
                            const customerName = salesOrderData?.customer_name || outwardData?.customer_name || customerId;
                            
                            return (
                              <tr key={customerId} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium text-gray-900">{customerName}</p>
                                    <p className="text-xs text-gray-500">ID: {customerId}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-orange-600">{salesOrderData?.total_count || 0}</p>
                                    <p className="text-xs text-gray-500">{salesOrderData?.total_items || 0} items</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-green-600">{formatCurrency(salesOrderData?.total_amount || 0)}</p>
                                    <p className="text-xs text-gray-500">{formatNumber(salesOrderData?.total_quantity || 0)} qty</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-indigo-600">{outwardData?.total_count || 0}</p>
                                    <p className="text-xs text-gray-500">{outwardData?.total_items || 0} items</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div>
                                    <p className="font-semibold text-purple-600">{formatCurrency(outwardData?.total_amount || 0)}</p>
                                    <p className="text-xs text-gray-500">{formatNumber(outwardData?.total_quantity || 0)} qty</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCustomerSelect(customerId)}
                                  >
                                    View Details
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Single Customer Detailed View */}
          {selectedCustomer && customerDetailsData && (
            <div className="space-y-4">
              {/* Customer Info Header */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {customersData?.find(c => c.id.toString() === selectedCustomer)?.name || selectedCustomer}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">Customer ID: {selectedCustomer}</p>
                    </div>
                    <Button onClick={handleClearSelection} variant="outline">
                      Back to All Customers
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sales Orders Card */}
                {hasSalesOrderAccess && (
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
                        <p className="text-2xl font-bold text-blue-600">{customerDetailsData.sales_orders?.total_count || 0}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Items</p>
                        <p className="text-2xl font-bold text-green-600">{customerDetailsData.sales_orders?.total_items || 0}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Quantity</p>
                        <p className="text-2xl font-bold text-purple-600">{formatNumber(customerDetailsData.sales_orders?.total_quantity || 0)}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(customerDetailsData.sales_orders?.total_amount || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Invoiced Order (Outward) Card */}
                {hasOutwardAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Truck className="h-5 w-5 mr-2 text-green-600" />
                      Invoiced Order
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Entries</p>
                        <p className="text-2xl font-bold text-blue-600">{customerDetailsData.outward?.total_count || 0}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Items</p>
                        <p className="text-2xl font-bold text-green-600">{customerDetailsData.outward?.total_items || 0}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Quantity</p>
                        <p className="text-2xl font-bold text-purple-600">{formatNumber(customerDetailsData.outward?.total_quantity || 0)}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(customerDetailsData.outward?.total_amount || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Inward Card */}
                {hasInwardAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-purple-600" />
                      Inward
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Inward Created</p>
                        <p className="text-2xl font-bold text-purple-600">{customerDetailsData.inward?.total_count || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">Total Entries</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Inward Completed</p>
                        <p className="text-2xl font-bold text-green-600">{customerDetailsData.inward?.total_completed || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">Completed Items</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Items</p>
                        <p className="text-2xl font-bold text-blue-600">{customerDetailsData.inward?.total_items || 0}</p>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Quantity</p>
                        <p className="text-2xl font-bold text-indigo-600">{formatNumber(customerDetailsData.inward?.total_quantity || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

              </div>
            </div>
          )}

          {/* Loading State */}
          {(allCustomersLoading || customerDetailsLoading) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
                <p className="text-gray-500 text-lg">Loading data...</p>
              </CardContent>
            </Card>
          )}

          {/* No Data Message - Single Customer */}
          {selectedCustomer && !customerDetailsLoading && !customerDetailsData && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 text-lg">No data found for the selected customer and date range.</p>
              </CardContent>
            </Card>
          )}

          {/* No Data Message - All Customers */}
          {!selectedCustomer && !allCustomersLoading && (!allCustomersData || Object.keys(allCustomersData).length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No data found for the selected date range.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Loader
        isLoading={allCustomersLoading || customerDetailsLoading}
        text="Loading customer analysis"
      />
    </div>
  );
}
