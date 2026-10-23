import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import UserInfoCard from "@/components/dashboard/user-info-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Menu, Loader2, ChevronDown, ChevronUp, BarChart3, PieChart, FileText, Package, Truck, Receipt, Building2 } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/notifications/NotificationBell";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// Color palette for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isUserCardVisible, setIsUserCardVisible] = useState(false);
  const isMobile = useIsMobile();
  const userCardRef = useRef(null);

  // Set default dates to current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(lastDay.toISOString().split('T')[0]);
  }, []);

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    const user = localStorage.getItem("superadmin_user");
    
    if (!token || !user) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  // Handle click outside to close user card
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userCardRef.current && !userCardRef.current.contains(event.target)) {
        setIsUserCardVisible(false);
      }
    };

    if (isUserCardVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserCardVisible]);

  // Validate date range before API call
  useEffect(() => {
    if (fromDate && toDate && fromDate > toDate) {
      toast({
        title: "Warning",
        description: "From date is greater than To date. Dates will be swapped automatically.",
        variant: "default",
      });
    }
  }, [fromDate, toDate, toast]);

  // Reset branch when organization changes
  useEffect(() => {
    setSelectedBranch("");
  }, [selectedOrganization]);

  // Fetch organizations for header filter
  const { data: organizations = [] } = useQuery({
    queryKey: ["superadmin-dashboard-organizations"],
    queryFn: async () => {
      const token = localStorage.getItem("superadmin_token");
      const res = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/organizations/`, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch organizations");
      const result = await res.json();
      return result.status === 200 ? (result.data || []) : [];
    },
  });

  // Fetch branches filtered by selected organization
  const { data: branches = [] } = useQuery({
    queryKey: ["superadmin-dashboard-branches", selectedOrganization],
    queryFn: async () => {
      const token = localStorage.getItem("superadmin_token");
      const params = new URLSearchParams();
      if (selectedOrganization) params.append("organization_id", selectedOrganization);
      const url = `${API_BASE_URL}/api/superadmin/super-admin/branches/${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch branches");
      const result = await res.json();
      return result.status === 200 ? (result.data || []) : [];
    },
    enabled: !!selectedOrganization,
  });

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-dashboard', fromDate, toDate, selectedOrganization, selectedBranch],
    queryFn: async () => {
      const token = localStorage.getItem("superadmin_token");
      if (!token) {
        throw new Error("No token found");
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (fromDate) {
        params.append('from_date', fromDate);
      }
      if (toDate) {
        params.append('to_date', toDate);
      }
      if (selectedOrganization) {
        params.append('organization_id', selectedOrganization);
      }
      if (selectedBranch) {
        params.append('branch_id', selectedBranch);
      }
      
      const queryString = params.toString();
      const url = `${API_BASE_URL}/api/superadmin/super-admin/dashboard/${queryString ? '?' + queryString : ''}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("superadmin_token");
          localStorage.removeItem("superadmin_user");
          setLocation("/superadmin/login");
          throw new Error("Session expired. Please login again.");
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to fetch dashboard data");
      }

      const result = await response.json();
      if (result.status === 200) {
        // Show warning if API returned one
        if (result.warning) {
          toast({
            title: "Warning",
            description: result.warning,
            variant: "default",
          });
        }
        
        return {
          status: 200,
          message: result.message,
          data: result.data,
          filters_applied: result.filters_applied || { from_date: fromDate, to_date: toDate },
          warning: result.warning
        };
      } else {
        throw new Error(result.message || result.error || "Failed to fetch dashboard data");
      }
    },
    enabled: !!fromDate && !!toDate, // Only fetch when dates are set
  });

  const handleFromDateChange = (event) => {
    setFromDate(event.target.value);
  };

  const handleToDateChange = (event) => {
    setToDate(event.target.value);
  };

  const handleResetDates = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(lastDay.toISOString().split('T')[0]);
  };

  const user = dashboardData?.data?.user_info;

  if (isLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <SuperAdminSidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="app-main-content">
          <div className="flex items-center justify-center min-h-screen">
            <CommonLoader />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <SuperAdminSidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="app-main-content">
          <div className="flex items-center justify-center min-h-screen">
            <Card className="max-w-md w-full">
              <CardContent className="p-6 text-center">
                <p className="text-red-600 mb-4">{error.message}</p>
                <Button onClick={() => refetch()}>Retry</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      {/* Desktop Sidebar */}
      {!isMobile && <SuperAdminSidebar />}

      {/* Mobile Sidebar */}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="app-main-content">
        {/* Top Header */}
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Date Range Filter */}
              <div className="flex items-center space-x-2">
                <Label htmlFor="organizationFilter" className="sr-only">Organization</Label>
                <select
                  id="organizationFilter"
                  value={selectedOrganization}
                  onChange={(e) => setSelectedOrganization(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                <Label htmlFor="branchFilter" className="sr-only">Branch</Label>
                <select
                  id="branchFilter"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={!selectedOrganization}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                >
                  <option value="">{selectedOrganization ? "All Branches" : "Select Organization first"}</option>
                  {branches.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.name}
                    </option>
                  ))}
                </select>

                <Label htmlFor="fromDate" className="sr-only">From Date</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={handleFromDateChange}
                  className="w-40 text-sm"
                />
                <span className="text-sm text-gray-500">to</span>
                <Label htmlFor="toDate" className="sr-only">To Date</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={handleToDateChange}
                  className="w-40 text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetDates}
                  className="text-xs"
                  title="Reset to current month"
                >
                  Reset
                </Button>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
              </div>

              {/* Notification Bell */}
              <NotificationBell className="text-gray-700 hover:bg-blue-100 hover:text-gray-900 bg-blue-50 border border-blue-200 rounded-full shadow-md" />

              {/* User Profile - Clickable */}
              <div className="relative" ref={userCardRef}>
                <div 
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors duration-200"
                  onClick={() => setIsUserCardVisible(!isUserCardVisible)}
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-black to-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {dashboardData?.data?.user_info?.name?.split(" ").map(n => n[0]).join("") || "SA"}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {dashboardData?.data?.user_info?.name || "Super Admin"}
                  </span>
                  {isUserCardVisible ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                
                {/* User Info Dropdown */}
                {isUserCardVisible && (
                  <UserInfoCard
                    user={dashboardData?.data?.user_info || {
                      user_id: "",
                      name: "Super Admin",
                      role: "Super Admin",
                      is_admin: true,
                      role_id: 10
                    }}
                    tallyRunning={false}
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">
                  <p className="text-lg font-semibold">Failed to load dashboard data</p>
                  <p className="text-sm">{error.message}</p>
                </div>
                <Button onClick={() => refetch()} variant="outline">
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Summary Cards */}
                {dashboardData?.data?.organization_counts && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {dashboardData.data.organization_counts.length}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {dashboardData.data.branch_counts?.length || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Vouchers</CardTitle>
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {dashboardData.data.organization_counts.reduce((sum, org) => sum + (org.voucher_count || 0), 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Inward</CardTitle>
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {dashboardData.data.organization_counts.reduce((sum, org) => sum + (org.inward_count || 0), 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Outward</CardTitle>
                          <Truck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {dashboardData.data.organization_counts.reduce((sum, org) => sum + (org.outward_count || 0), 0)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Voucher Count Chart */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                            <CardTitle>Voucher Count by Organization</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dashboardData.data.organization_counts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="organization_name" 
                                angle={-45} 
                                textAnchor="end" 
                                height={100}
                                interval={0}
                              />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="voucher_count" fill="#0088FE" name="Vouchers" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Inward Count Chart */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-green-600" />
                            <CardTitle>Inward Count by Organization</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dashboardData.data.organization_counts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="organization_name" 
                                angle={-45} 
                                textAnchor="end" 
                                height={100}
                                interval={0}
                              />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="inward_count" fill="#00C49F" name="Inward" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Outward Count Chart */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-orange-600" />
                            <CardTitle>Outward Count by Organization</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dashboardData.data.organization_counts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="organization_name" 
                                angle={-45} 
                                textAnchor="end" 
                                height={100}
                                interval={0}
                              />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="outward_count" fill="#FF8042" name="Outward" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Hamali Count Chart */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-purple-600" />
                            <CardTitle>Hamali Count by Organization</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dashboardData.data.organization_counts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="organization_name" 
                                angle={-45} 
                                textAnchor="end" 
                                height={100}
                                interval={0}
                              />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="hamali_count" fill="#8884d8" name="Hamali" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Combined Chart */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          <CardTitle>All Counts by Organization (Combined)</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={dashboardData.data.organization_counts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="organization_name" 
                              angle={-45} 
                              textAnchor="end" 
                              height={100}
                              interval={0}
                            />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="voucher_count" fill="#0088FE" name="Vouchers" />
                            <Bar dataKey="inward_count" fill="#00C49F" name="Inward" />
                            <Bar dataKey="outward_count" fill="#FF8042" name="Outward" />
                            <Bar dataKey="hamali_count" fill="#8884d8" name="Hamali" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Pie Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Voucher Distribution Pie Chart */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-blue-600" />
                            <CardTitle>Voucher Distribution</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <RechartsPieChart>
                              <Pie
                                data={dashboardData.data.organization_counts.filter(org => org.voucher_count > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="voucher_count"
                                nameKey="organization_name"
                              >
                                {dashboardData.data.organization_counts.filter(org => org.voucher_count > 0).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Inward Distribution Pie Chart */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-green-600" />
                            <CardTitle>Inward Distribution</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <RechartsPieChart>
                              <Pie
                                data={dashboardData.data.organization_counts.filter(org => org.inward_count > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="inward_count"
                                nameKey="organization_name"
                              >
                                {dashboardData.data.organization_counts.filter(org => org.inward_count > 0).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Data Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Organization-wise Counts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Organization</th>
                                <th className="text-right p-3 font-semibold">Vouchers</th>
                                <th className="text-right p-3 font-semibold">Inward</th>
                                <th className="text-right p-3 font-semibold">Outward</th>
                                <th className="text-right p-3 font-semibold">Hamali</th>
                                <th className="text-right p-3 font-semibold">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardData.data.organization_counts.map((org, index) => {
                                const total = (org.voucher_count || 0) + (org.inward_count || 0) + (org.outward_count || 0) + (org.hamali_count || 0);
                                return (
                                  <tr key={org.organization_id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium">{org.organization_name}</td>
                                    <td className="p-3 text-right">{org.voucher_count || 0}</td>
                                    <td className="p-3 text-right">{org.inward_count || 0}</td>
                                    <td className="p-3 text-right">{org.outward_count || 0}</td>
                                    <td className="p-3 text-right">{org.hamali_count || 0}</td>
                                    <td className="p-3 text-right font-semibold">{total}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 font-semibold">
                                <td className="p-3">Total</td>
                                <td className="p-3 text-right">
                                  {dashboardData.data.organization_counts.reduce((sum, org) => sum + (org.voucher_count || 0), 0)}
                                </td>
                                <td className="p-3 text-right">
                                  {dashboardData.data.organization_counts.reduce((sum, org) => sum + (org.inward_count || 0), 0)}
                                </td>
                                <td className="p-3 text-right">
                                  {dashboardData.data.organization_counts.reduce((sum, org) => sum + (org.outward_count || 0), 0)}
                                </td>
                                <td className="p-3 text-right">
                                  {dashboardData.data.organization_counts.reduce((sum, org) => sum + (org.hamali_count || 0), 0)}
                                </td>
                                <td className="p-3 text-right">
                                  {dashboardData.data.organization_counts.reduce((sum, org) => 
                                    sum + (org.voucher_count || 0) + (org.inward_count || 0) + (org.outward_count || 0) + (org.hamali_count || 0), 0
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
