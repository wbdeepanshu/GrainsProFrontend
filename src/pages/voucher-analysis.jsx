import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { ArrowLeft, Receipt, Users, Loader2, Search, BarChart3, PieChart, ChevronDown, ChevronRight, CalendarIcon } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import Loader from "@/components/common/loader";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function VoucherAnalysis() {
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
  const [selectedVoucherType, setSelectedVoucherType] = useState("");
  const [expandedVouchers, setExpandedVouchers] = useState(new Set());

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

  // Fetch available voucher types for filter
  const { data: voucherTypesData, isLoading: voucherTypesLoading } = useQuery({
    queryKey: ['voucher-types'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-voucher-types/?is_active=true`);
      if (!response.ok) throw new Error('Failed to fetch voucher types');
      const data = await response.json();
      return data.status === 200 ? data.data : [];
    },
    enabled: !!token,
  });

  // Fetch all vouchers details by date range
  const { data: vouchersData, isLoading: vouchersLoading, refetch: refetchVouchers } = useQuery({
    queryKey: ['voucher-analysis', fromDate, toDate, selectedVoucherType],
    queryFn: async () => {
      const currentToken = AuthService.getAccessToken();
      if (!currentToken) {
        throw new Error('No access token available');
      }
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      let url = `${API_BASE_URL}/api/user/voucher-analysis/?from_date=${fromDateStr}&to_date=${toDateStr}`;
      if (selectedVoucherType) {
        url += `&voucher_type_id=${selectedVoucherType}`;
      }
      const response = await apiRequest('GET', url);
      if (!response.ok) {
        if (response.status === 401) {
          AuthService.clearAuthData();
          window.location.href = '/login';
          return null;
        }
        throw new Error('Failed to fetch vouchers details');
      }
      const data = await response.json();
      return data.status === 200 ? data.data : {};
    },
    enabled: !!token && !!fromDate && !!toDate,
    retry: false,
  });

  const handleSearch = () => {
    refetchVouchers();
  };

  const handleClearFilters = () => {
    const now = new Date();
    setDateRangePreset("monthly");
    setFromDate(startOfMonth(now));
    setToDate(endOfMonth(now));
    setSelectedVoucherType("");
    setExpandedVouchers(new Set());
  };

  const toggleVoucherExpansion = (voucherId) => {
    const newExpanded = new Set(expandedVouchers);
    if (newExpanded.has(voucherId)) {
      newExpanded.delete(voucherId);
    } else {
      newExpanded.add(voucherId);
    }
    setExpandedVouchers(newExpanded);
  };

  // Auto-load vouchers data on mount and when dates change
  useEffect(() => {
    if (fromDate && toDate && token) {
      refetchVouchers();
    }
  }, [fromDate, toDate, token]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  // Prepare chart data from vouchers data - voucher summary
  const voucherChartData = useMemo(() => {
    if (!vouchersData?.vouchers || Object.keys(vouchersData.vouchers).length === 0) return [];

    return Object.entries(vouchersData.vouchers).map(([voucherId, voucherData]) => ({
      voucherId,
      voucherName: voucherData.display_name || voucherData.voucher_name || voucherId,
      totalCount: voucherData.total_count || 0,
      usersCount: Object.keys(voucherData.users || {}).length,
    }));
  }, [vouchersData]);

  // Transform data to show user-wise voucher creation
  const userWiseChartData = useMemo(() => {
    if (!vouchersData?.vouchers || Object.keys(vouchersData.vouchers).length === 0) return [];

    // Collect all unique users and their voucher counts
    const userVoucherMap = {};
    const voucherNamesMap = {};

    // First, create a map of voucher names
    Object.entries(vouchersData.vouchers).forEach(([voucherId, voucherData]) => {
      voucherNamesMap[voucherId] = voucherData.display_name || voucherData.voucher_name || voucherId;
    });

    // Then, collect user-wise data
    Object.entries(vouchersData.vouchers).forEach(([voucherId, voucherData]) => {
      const voucherName = voucherNamesMap[voucherId];
      Object.entries(voucherData.users || {}).forEach(([userId, userData]) => {
        if (!userVoucherMap[userId]) {
          userVoucherMap[userId] = {
            userId,
            userName: userData.user_name || userId,
            vouchers: {},
            // Add voucher counts directly as properties for chart
          };
        }
        // Store count with sanitized key for chart access
        const sanitizedKey = voucherName.replace(/[^a-zA-Z0-9]/g, '_');
        userVoucherMap[userId].vouchers[voucherName] = userData.count || 0;
        userVoucherMap[userId][sanitizedKey] = userData.count || 0;
      });
    });

    // Convert to array format for chart
    return Object.values(userVoucherMap);
  }, [vouchersData]);

  // Get all unique voucher names for chart series
  const allVoucherNames = useMemo(() => {
    if (!vouchersData?.vouchers) return [];
    const names = new Set();
    Object.values(vouchersData.vouchers).forEach(voucherData => {
      names.add(voucherData.display_name || voucherData.voucher_name);
    });
    return Array.from(names);
  }, [vouchersData]);

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
              {entry.name}: {formatNumber(entry.value)}
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
                <h1 className="text-2xl font-bold text-gray-900">Voucher Analysis</h1>
                <p className="text-sm text-gray-500 mt-1">Analyze voucher transactions by date range</p>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* Date Range Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="dateRangePreset">Date Range</Label>
                  <Select
                    value={dateRangePreset}
                    onValueChange={(value) => setDateRangePreset(value)}
                  >
                    <SelectTrigger id="dateRangePreset" className="h-10">
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

                {/* From Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="from-date">From Date</Label>
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
                        className={`w-full h-10 justify-start text-left font-normal ${
                          dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                        }`}
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
                        className={`w-full h-10 justify-start text-left font-normal ${
                          dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                        }`}
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

                {/* Voucher Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="voucher-type">Voucher Type</Label>
                  <Select
                    value={selectedVoucherType || undefined}
                    onValueChange={(value) => {
                      setSelectedVoucherType(value === "all" ? "" : value);
                    }}
                    disabled={voucherTypesLoading}
                  >
                    <SelectTrigger id="voucher-type" className="h-10">
                      <SelectValue placeholder="All Voucher Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Voucher Types</SelectItem>
                      {voucherTypesData?.map((voucherType) => (
                        <SelectItem key={voucherType.id} value={voucherType.id.toString()}>
                          {voucherType.display_name || voucherType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search Button */}
                <div className="flex flex-col">
                  <Label className="h-5 invisible">Search</Label>
                  <Button
                    onClick={handleSearch}
                    disabled={vouchersLoading}
                    className="w-full h-10"
                  >
                    {vouchersLoading ? (
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
                </div>
                <div className="flex flex-col">
                  <Label className="h-5 invisible">Clear</Label>
                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="w-full h-10"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Vouchers Summary View */}
          {vouchersData?.vouchers && Object.keys(vouchersData.vouchers).length > 0 && (
            <div className="space-y-6">
              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User-wise Voucher Creation Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                      User-wise Voucher Creation Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={userWiseChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="userName" 
                          angle={-45} 
                          textAnchor="end" 
                          height={120}
                          interval={0}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {allVoucherNames.map((voucherName, index) => {
                          const sanitizedKey = voucherName.replace(/[^a-zA-Z0-9]/g, '_');
                          return (
                            <Bar 
                              key={voucherName} 
                              dataKey={sanitizedKey} 
                              name={voucherName}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                              stackId="a"
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Voucher-wise Distribution Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <PieChart className="h-5 w-5 mr-2 text-orange-600" />
                      Voucher Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="105%" height={400}>
                      <RechartsPieChart>
                        <Pie
                          data={voucherChartData.map(item => ({ name: item.voucherName, value: item.totalCount }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {voucherChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Table View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-blue-600" />
                      User-wise Voucher Creation Details
                    </span>
                    <Badge variant="secondary">{userWiseChartData.length} Users</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
{/*                           <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">User ID</th> */}
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">User Name</th>
                          {allVoucherNames.map(voucherName => (
                            <th key={voucherName} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                              {voucherName}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userWiseChartData.map((userData) => {
                          const totalTransactions = Object.values(userData.vouchers).reduce((sum, count) => sum + count, 0);
                          return (
                            <tr key={userData.userId} className="border-b hover:bg-gray-50">
{/*                               <td className="px-4 py-3"> */}
{/*                                 <p className="font-medium text-gray-900">{userData.userId}</p> */}
{/*                               </td> */}
                              <td className="px-4 py-3">
                                <p className="text-gray-700">{userData.userName}</p>
                              </td>
                              {allVoucherNames.map(voucherName => (
                                <td key={voucherName} className="px-4 py-3 text-center">
                                  <Badge variant={userData.vouchers[voucherName] > 0 ? "default" : "secondary"} className="text-xs">
                                    {userData.vouchers[voucherName] || 0}
                                  </Badge>
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center">
                                <p className="font-semibold text-blue-600">{totalTransactions}</p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 border-t-2 border-gray-300">
                          <td colSpan={1} className="px-4 py-3 font-semibold text-gray-900">
                            Grand Total
                          </td>
                          {allVoucherNames.map(voucherName => {
                            const total = userWiseChartData.reduce((sum, userData) => sum + (userData.vouchers[voucherName] || 0), 0);
                            return (
                              <td key={voucherName} className="px-4 py-3 text-center">
                                <p className="font-semibold text-gray-900">{total}</p>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <p className="font-semibold text-blue-600">
                              {userWiseChartData.reduce((sum, userData) => 
                                sum + Object.values(userData.vouchers).reduce((s, c) => s + c, 0), 0
                              )}
                            </p>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}

          {/* Loading State */}
          {vouchersLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
                <p className="text-gray-500 text-lg">Loading data...</p>
              </CardContent>
            </Card>
          )}

          {/* No Data Message */}
          {!vouchersLoading && (!vouchersData?.vouchers || Object.keys(vouchersData.vouchers).length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No voucher data found for the selected date range.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Loader isLoading={vouchersLoading} text="Loading voucher analysis" />
    </div>
  );
}
