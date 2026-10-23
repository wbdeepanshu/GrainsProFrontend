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
import { ArrowLeft, Users, Package, Truck, Receipt, Route, MapPin, Loader2, Search, BarChart3, PieChart, Check, ChevronsUpDown, Building, CalendarIcon } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
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

export default function SalesmanAnalysis() {
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
  const [selectedSalesman, setSelectedSalesman] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

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

  // Fetch branches (same pattern as user-list)
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await fetch(`${backendUrl}/api/get-branches/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch branches');
      const data = await response.json();
      if (data.status === 200 && data.data) return data.data;
      if (Array.isArray(data)) return data;
      return data;
    },
    enabled: !!token,
  });

  // Fetch salesmen list; filter by branch via API when branch selected
  const { data: salesmenData, isLoading: salesmenLoading } = useQuery({
    queryKey: ['salesmen', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: 'analysis',
        per_page: '1000',
      });
      if (selectedBranch && selectedBranch !== 'All' && selectedBranch.id) {
        params.append('branch_id', selectedBranch.id);
      }
      if (selectedBranch && selectedBranch !== 'All' && selectedBranch.name) {
        params.append('branch_name', selectedBranch.name);
      }
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch salesmen');
      const data = await response.json();
      return data.status === 200 ? data.data : [];
    },
    enabled: !!token,
  });

  // Client-side filter by branch_name (fallback if API doesn't filter); match user-list logic
  const filteredSalesmen = useMemo(() => {
    if (!salesmenData || !Array.isArray(salesmenData)) return [];
    if (!selectedBranch || selectedBranch === 'All') return salesmenData;
    return salesmenData.filter(
      (u) => u.branch_name && String(u.branch_name).toLowerCase().includes(String(selectedBranch.name).toLowerCase())
    );
  }, [salesmenData, selectedBranch]);

  const selectedUser = useMemo(() => {
    if (!selectedSalesman) return null;
    return (
      filteredSalesmen?.find((u) => String(u.user_id) === String(selectedSalesman)) ||
      salesmenData?.find((u) => String(u.user_id) === String(selectedSalesman)) ||
      null
    );
  }, [selectedSalesman, filteredSalesmen, salesmenData]);

  const isSelectedUserSupervisor = /supervisor/i.test(
    String(selectedUser?.role_name || selectedUser?.role || "").trim()
  );

  // Fetch all users details by date range (default view), optionally filtered by branch
  const { data: allUsersData, isLoading: allUsersLoading, refetch: refetchAllUsers } = useQuery({
    queryKey: ['user-analysis-all', fromDate, toDate, selectedBranch],
    queryFn: async () => {
      const currentToken = AuthService.getAccessToken();
      if (!currentToken) {
        throw new Error('No access token available');
      }
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      let url = `${API_BASE_URL}/api/user/user-analysis/?from_date=${fromDateStr}&to_date=${toDateStr}`;
      if (selectedBranch && selectedBranch !== 'All' && selectedBranch.id) {
        url += `&branch_id=${selectedBranch.id}`;
      }
      const response = await apiRequest('GET', url);
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = '/login'; 
          return null;
        }
        throw new Error('Failed to fetch all users details');
      }
      const data = await response.json();
      return data.status === 200 ? data.data : {};
    },
    enabled: !!token && !!fromDate && !!toDate && !selectedSalesman,
    retry: false,
  });

  // Fetch single user details by date range (when user is selected), optionally filtered by branch
  const { data: salesmanDetailsData, isLoading: salesmanDetailsLoading, refetch: refetchSalesmanDetails } = useQuery({
    queryKey: ['user-analysis', selectedSalesman, fromDate, toDate, selectedBranch],
    queryFn: async () => {
      if (!selectedSalesman) return null;
      const currentToken = AuthService.getAccessToken();
      if (!currentToken) {
        throw new Error('No access token available');
      }
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      let url = `${API_BASE_URL}/api/user/user-analysis/${selectedSalesman}/?from_date=${fromDateStr}&to_date=${toDateStr}`;
      if (selectedBranch && selectedBranch !== 'All' && selectedBranch.id) {
        url += `&branch_id=${selectedBranch.id}`;
      }
      const response = await apiRequest('GET', url);
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = '/login';
          return null;
        }
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch salesman details');
      }
      const data = await response.json();
      return data.status === 200 ? data.data : null;
    },
    enabled: !!token && !!selectedSalesman && !!fromDate && !!toDate,
    retry: false,
  });

  const handleSearch = () => {
    if (selectedSalesman) {
      refetchSalesmanDetails();
    } else {
      refetchAllUsers();
    }
  };

  const handleUserSelect = (userId) => {
    setSelectedSalesman(userId);
    setUserDropdownOpen(false);
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setBranchDropdownOpen(false);
    setSelectedSalesman(''); // clear user when branch changes
  };

  const handleClearSelection = () => {
    setSelectedSalesman("");
    setSelectedBranch(null);
  };

  // Auto-load all users data on mount and when dates/branch change (if no user selected)
  useEffect(() => {
    if (!selectedSalesman && fromDate && toDate && token) {
      refetchAllUsers();
    }
  }, [fromDate, toDate, selectedSalesman, selectedBranch, token]);

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

  // Prepare chart data from all users data; filter by selected branch (only users in filteredSalesmen)
  const chartData = useMemo(() => {
    if (!allUsersData || Object.keys(allUsersData).length === 0) return [];
    const userIdsInBranch = new Set((filteredSalesmen || []).map((s) => String(s.user_id)));
    return Object.entries(allUsersData)
      .filter(([userId]) => !selectedBranch || selectedBranch === 'All' || userIdsInBranch.has(userId))
      .map(([userId, userData]) => ({
      userId,
      userName: userData.user_name || userId,
      transactions: userData.transactions?.total_vouchers || 0,
      hamaliEntries: userData.hamali?.total_details || 0,
      hamaliAmount: userData.hamali?.total_amount || 0,
      inwardEntries: userData.inward?.total_assigned_entries || 0,
      salesOrders: userData.sales_orders?.total_count || 0,
      salesOrdersAmount: userData.sales_orders?.total_amount || 0,
      outwardEntries: userData.outward?.total_count || 0,
      outwardAmount: userData.outward?.total_amount || 0,
      receipts: userData.receipts?.total_count || 0,
      receiptsAmount: userData.receipts?.total_amount || 0,
      routes: userData.routes?.total_count || 0,
      visits: userData.visits?.total_count || 0,
    }));
  }, [allUsersData, filteredSalesmen, selectedBranch]);

  // Filtered all-users entries for table (by branch)
  const filteredAllUsersDataEntries = useMemo(() => {
    if (!allUsersData || Object.keys(allUsersData).length === 0) return [];
    const userIdsInBranch = new Set((filteredSalesmen || []).map((s) => String(s.user_id)));
    return Object.entries(allUsersData).filter(
      ([userId]) => !selectedBranch || selectedBranch === 'All' || userIdsInBranch.has(userId)
    );
  }, [allUsersData, filteredSalesmen, selectedBranch]);

  // Prepare hamali chart data - only users with hamali entries > 0
  const hamaliChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    return chartData
      .filter(item => item.hamaliEntries > 0)
      .map(item => ({
        userId: item.userId,
        userName: item.userName,
        hamaliEntries: item.hamaliEntries,
        hamaliAmount: parseFloat(item.hamaliAmount) || 0,
      }));
  }, [chartData]);

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
                onClick={() => setLocation("/dashboard")}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Analysis</h1>
                <p className="text-sm text-gray-500 mt-1">Analyze user performance by date range</p>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                {/* Branch Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    Branch
                  </label>
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
                          {selectedBranch === "All" ? "All Branches" : selectedBranch ? selectedBranch.name : "Select branch"}
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
                        <CommandInput placeholder="Search branches..." />
                        <CommandList>
                          <CommandEmpty>
                            {branchesLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading branches...
                              </div>
                            ) : (
                              "No branches found."
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              <CommandItem
                                key="all"
                                value="All"
                                onSelect={() => handleBranchSelect("All")}
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                              >
                                <div className="flex items-center gap-3">
                                  <Check
                                    className={`h-4 w-4 ${selectedBranch === "All" ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                  />
                                  <div className="font-medium text-gray-900">All Branches</div>
                                </div>
                              </CommandItem>
                              {branchesData?.map((branch) => (
                                <CommandItem
                                  key={branch.id}
                                  value={branch.name}
                                  onSelect={() => handleBranchSelect(branch)}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check
                                      className={`h-4 w-4 ${selectedBranch?.id === branch.id ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900">{branch.name}</div>
                                      {branch.organization && (
                                        <div className="text-sm text-gray-500">{branch.organization}</div>
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

                {/* User Selection with Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-600" />
                    User
                  </label>
                  <div className="relative">
                    <Popover open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={userDropdownOpen}
                          className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={salesmenLoading}
                        >
                          <span className="truncate">
                            {selectedSalesman 
                              ? (filteredSalesmen?.find(s => s.user_id.toString() === selectedSalesman) || salesmenData?.find(s => s.user_id.toString() === selectedSalesman))?.name || "Select User"
                              : "Select User"}
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
                          <CommandInput placeholder="Search user..." />
                          <CommandList>
                            <CommandEmpty>
                              {salesmenLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Loading users...
                                </div>
                              ) : (
                                "No user found."
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                {filteredSalesmen?.length > 0 ? (
                                  filteredSalesmen.map((salesman) => (
                                    <CommandItem
                                      key={salesman.user_id}
                                      value={salesman.name}
                                      onSelect={() => handleUserSelect(salesman.user_id.toString())}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${
                                            selectedSalesman === salesman.user_id.toString() ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">{salesman.name}</div>
                                          {salesman.user_id && (
                                            <div className="text-sm text-gray-500">{salesman.user_id}</div>
                                          )}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-gray-500">No user found</div>
                                )}
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
                      disabled={salesmanDetailsLoading || allUsersLoading}
                      className="flex-1"
                    >
                      {(salesmanDetailsLoading || allUsersLoading) ? (
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
                    {(selectedSalesman || (selectedBranch && selectedBranch !== "All")) && (
                      <Button
                        onClick={handleClearSelection}
                        variant="outline"
                        className="flex-1"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Users Summary View */}
          {!selectedSalesman && allUsersData && Object.keys(allUsersData).length > 0 && (
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
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
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
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
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
                )}

                {/* Receipts Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Receipt className="h-5 w-5 mr-2 text-purple-600" />
                      Receipts Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="receipts" fill="#8b5cf6" name="Receipts" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Receipts Amount Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Receipt className="h-5 w-5 mr-2 text-teal-600" />
                      Receipts Amount Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="receiptsAmount" fill="#06b6d4" name="Amount (₹)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Routes Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Route className="h-5 w-5 mr-2 text-indigo-600" />
                      Routes Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="routes" fill="#6366f1" name="Routes" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Visits Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MapPin className="h-5 w-5 mr-2 text-red-600" />
                      Visits Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="visits" fill="#ef4444" name="Visits" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Transactions Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-blue-600" />
                      Transactions Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="transactions" fill="#3b82f6" name="Vouchers" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Hamali Comparison Chart */}
                {hamaliChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Truck className="h-5 w-5 mr-2 text-green-600" />
                      Hamali Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={hamaliChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="hamaliEntries" fill="#10b981" name="Hamali Entries" />
                        <Bar dataKey="hamaliAmount" fill="#059669" name="Hamali Amount (₹)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                )}
              </div>

              {/* Table View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-blue-600" />
                      All Users Analysis Summary
                    </span>
                    <Badge variant="secondary">{filteredAllUsersDataEntries.length} Users</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">User</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Transactions</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Hamali</th>
                          {hasInwardAccess && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Inward</th>}
                          {hasSalesOrderAccess && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Sales Orders</th>}
                          {hasOutwardAccess && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Outward</th>}
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Receipts</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Routes</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Visits</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAllUsersDataEntries.map(([userId, userData]) => (
                          <tr key={userId} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{userData.user_name || userId}</p>
                                <p className="text-xs text-gray-500">{userId}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div>
                                <p className="font-semibold text-blue-600">{userData.transactions?.total_vouchers || 0}</p>
                                <p className="text-xs text-gray-500">Vouchers</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div>
                                <p className="font-semibold text-green-600">{userData.hamali?.total_details || 0}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(userData.hamali?.total_amount || 0)}</p>
                              </div>
                            </td>
                            {hasInwardAccess && (
                            <td className="px-4 py-3 text-center">
                              <div>
                                <p className="font-semibold text-purple-600">{userData.inward?.total_assigned_entries || 0}</p>
                                <p className="text-xs text-gray-500">{userData.inward?.total_unloaded || 0} unloaded</p>
                              </div>
                            </td>
                            )}
                            {hasSalesOrderAccess && (
                            <td className="px-4 py-3 text-center">
                              <div>
                                <p className="font-semibold text-orange-600">{userData.sales_orders?.total_count || 0}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(userData.sales_orders?.total_amount || 0)}</p>
                              </div>
                            </td>
                            )}
                            {hasOutwardAccess && (
                            <td className="px-4 py-3 text-center">
                              <div>
                                <p className="font-semibold text-indigo-600">{userData.outward?.total_count || 0}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(userData.outward?.total_amount || 0)}</p>
                              </div>
                            </td>
                            )}
                            <td className="px-4 py-3 text-center">
                              <div>
                                <p className="font-semibold text-teal-600">{userData.receipts?.total_count || 0}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(userData.receipts?.total_amount || 0)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <p className="font-semibold text-red-600">{userData.routes?.total_count || 0}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <p className="font-semibold text-pink-600">{userData.visits?.total_count || 0}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUserSelect(userId)}
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
            </div>
          )}

          {/* Single User Detailed View */}
          {selectedSalesman && salesmanDetailsData && (
            <div className="space-y-4">
              {/* User Info Header */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {salesmenData?.find(s => s.user_id === selectedSalesman)?.name || selectedSalesman}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">User ID: {selectedSalesman}</p>
                    </div>
                    <Button onClick={handleClearSelection} variant="outline">
                      Back to All Users
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transactions Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-blue-600" />
                      Transactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <p className="text-sm text-gray-600">Total Vouchers</p>
                      <p className="text-2xl font-bold text-blue-600">{salesmanDetailsData.transactions?.total_vouchers || 0}</p>
                    </div>
                    {salesmanDetailsData.transactions?.voucher_type_counts && Object.keys(salesmanDetailsData.transactions.voucher_type_counts).length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">By Voucher Type:</p>
                        <div className="space-y-2">
                          {Object.entries(salesmanDetailsData.transactions.voucher_type_counts).map(([type, count]) => (
                            <div key={type} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                              <span className="text-sm text-gray-700">{type}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sales Orders Card */}
                {hasSalesOrderAccess && !isSelectedUserSupervisor && (
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
                        <p className="text-2xl font-bold text-blue-600">{salesmanDetailsData.sales_orders?.total_count || 0}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Items</p>
                        <p className="text-2xl font-bold text-green-600">{salesmanDetailsData.sales_orders?.total_items || 0}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Quantity</p>
                        <p className="text-2xl font-bold text-purple-600">{formatNumber(salesmanDetailsData.sales_orders?.total_quantity || 0)}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(salesmanDetailsData.sales_orders?.total_amount || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Hamali Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Truck className="h-5 w-5 mr-2 text-green-600" />
                      Hamali Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Entries</p>
                        <p className="text-2xl font-bold text-green-600">{salesmanDetailsData.hamali?.total_details || 0}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(salesmanDetailsData.hamali?.total_amount || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Inward Card */}
                {hasInwardAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-purple-600" />
                      Inward Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Assigned</p>
                        <p className="text-2xl font-bold text-purple-600">{salesmanDetailsData.inward?.total_assigned_entries || 0}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Unloaded</p>
                        <p className="text-2xl font-bold text-purple-600">{salesmanDetailsData.inward?.total_unloaded || 0}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Quantity</p>
                        <p className="text-2xl font-bold text-purple-600">{formatNumber(salesmanDetailsData.inward?.total_quantity || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Sales Orders Card */}
                {hasSalesOrderAccess && !isSelectedUserSupervisor && (
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
                      <p className="text-2xl font-bold text-blue-600">{salesmanDetailsData.sales_orders?.total_count || 0}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Items</p>
                      <p className="text-2xl font-bold text-green-600">{salesmanDetailsData.sales_orders?.total_items || 0}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Quantity</p>
                      <p className="text-2xl font-bold text-purple-600">{formatNumber(salesmanDetailsData.sales_orders?.total_quantity || 0)}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(salesmanDetailsData.sales_orders?.total_amount || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
                )}

              {/* Right Column - Invoiced Order (Outward) */}
              {hasOutwardAccess && !isSelectedUserSupervisor && (
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
                      <p className="text-2xl font-bold text-blue-600">{salesmanDetailsData.outward?.total_count || 0}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Items</p>
                      <p className="text-2xl font-bold text-green-600">{salesmanDetailsData.outward?.total_items || 0}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Quantity</p>
                      <p className="text-2xl font-bold text-purple-600">{formatNumber(salesmanDetailsData.outward?.total_quantity || 0)}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(salesmanDetailsData.outward?.total_amount || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Bottom Row - Receipts, Routes, Visits in one row */}
              {!isSelectedUserSupervisor && <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Receipt className="h-5 w-5 mr-2 text-purple-600" />
                    Receipts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Receipts</p>
                      <p className="text-2xl font-bold text-blue-600">{salesmanDetailsData.receipts?.total_count || 0}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(salesmanDetailsData.receipts?.total_amount || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>}

              {!isSelectedUserSupervisor && <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Route className="h-5 w-5 mr-2 text-indigo-600" />
                    Routes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Total Routes</p>
                    <p className="text-2xl font-bold text-indigo-600">{salesmanDetailsData.routes?.total_count || 0}</p>
                  </div>
                  {salesmanDetailsData.routes?.route_names && salesmanDetailsData.routes.route_names.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Route Names:</p>
                      <div className="flex flex-wrap gap-2">
                        {salesmanDetailsData.routes.route_names.map((name, index) => (
                          <Badge key={index} variant="secondary" className="text-sm">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>}

              {!isSelectedUserSupervisor && <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-red-600" />
                    Visits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Visits</p>
                    <p className="text-2xl font-bold text-red-600">{salesmanDetailsData.visits?.total_count || 0}</p>
                  </div>
                  {salesmanDetailsData.visits?.visit_dates && salesmanDetailsData.visits.visit_dates.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Visit Timestamps:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {salesmanDetailsData.visits.visit_dates.map((date, index) => (
                          <div key={index} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {date}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>}

              {/* Customers Card */}
              {!isSelectedUserSupervisor && <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-teal-600" />
                    Customers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-teal-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Total Customers</p>
                    <p className="text-2xl font-bold text-teal-600">{salesmanDetailsData.customers?.total_count || 0}</p>
                  </div>
                  {salesmanDetailsData.customers?.customer_names && salesmanDetailsData.customers.customer_names.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Customer Names:</p>
                      <div className="flex flex-wrap gap-2">
                        {salesmanDetailsData.customers.customer_names.map((name, index) => (
                          <Badge key={index} variant="secondary" className="text-sm">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>}
              </div>
            </div>
          )}

          {/* Loading State */}
          {(allUsersLoading || salesmanDetailsLoading) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
                <p className="text-gray-500 text-lg">Loading data...</p>
              </CardContent>
            </Card>
          )}

          {/* No Data Message - Single User */}
          {selectedSalesman && !salesmanDetailsLoading && !salesmanDetailsData && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 text-lg">No data found for the selected user and date range.</p>
              </CardContent>
            </Card>
          )}

          {/* No Data Message - All Users */}
          {!selectedSalesman && !allUsersLoading && (!allUsersData || Object.keys(allUsersData).length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No data found for the selected date range.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
