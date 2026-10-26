import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import UserInfoCard from "@/components/dashboard/user-info-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, Loader2, ChevronDown, ChevronUp, BarChart3, PieChart, FileText, Package, Truck, Receipt, Building2 } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/notifications/NotificationBell";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// Black / gold chart palette (matches app theme)
const COLORS = [
  "#141414",
  "#c9a227",
  "#e8c547",
  "#4b5563",
  "#78716c",
  "#a8a29e",
  "#57534e",
  "#d6b84a",
  "#1f1f1f",
  "#b45309",
];

const GOLD = "#c9a227";
const INK = "#141414";

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

  const MetricCard = ({ title, value, icon: Icon }) => (
    <Card className="border border-[#c9a227]/45 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-2.5 bg-white border-b border-[#c9a227]/30">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          {title}
        </CardTitle>
        {Icon ? <Icon className="h-3.5 w-3.5 text-[#c9a227]" /> : null}
      </CardHeader>
      <CardContent className="p-2.5">
        <div className="text-xl font-bold text-black tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );

  const ChartCard = ({ title, icon: Icon, children, className = "" }) => (
    <Card className={`border border-[#c9a227]/45 shadow-sm overflow-hidden ${className}`}>
      <CardHeader className="py-2 px-2.5 border-b border-[#c9a227]/30 bg-white">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className="h-4 w-4 text-[#c9a227]" /> : null}
          <CardTitle className="text-sm font-semibold text-black">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-2.5">{children}</CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="app-layout bg-neutral-100">
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
      <div className="app-layout bg-neutral-100">
        {!isMobile && <SuperAdminSidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="app-main-content">
          <div className="flex items-center justify-center min-h-screen">
            <Card className="max-w-md w-full border border-[#c9a227]/45">
              <CardContent className="p-5 text-center">
                <p className="text-red-600 mb-3 text-sm">{error.message}</p>
                <Button
                  onClick={() => refetch()}
                  className="bg-black text-white border border-[#c9a227]/70 hover:bg-neutral-800"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-neutral-100">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header bg-white border-b border-[#c9a227]/50 px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center min-w-0">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden h-8 w-8 p-0 mr-2 text-neutral-500 hover:text-black"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="h-7 w-7 rounded-md bg-black text-white border border-[#c9a227]/60 flex items-center justify-center shrink-0 mr-2">
                <BarChart3 className="h-3.5 w-3.5 text-[#c9a227]" />
              </div>
              <h1 className="text-base font-semibold text-black truncate">Dashboard</h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Label htmlFor="organizationFilter" className="sr-only">Organization</Label>
                <select
                  id="organizationFilter"
                  value={selectedOrganization}
                  onChange={(e) => setSelectedOrganization(e.target.value)}
                  className="h-8 rounded-md border border-[#c9a227]/45 bg-white px-2 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
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
                  className="h-8 rounded-md border border-[#c9a227]/45 bg-white px-2 text-xs text-black disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
                >
                  <option value="">
                    {selectedOrganization ? "All Branches" : "Select Organization first"}
                  </option>
                  {branches.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.name}
                    </option>
                  ))}
                </select>

                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={handleFromDateChange}
                  className="h-8 w-[132px] text-xs border-[#c9a227]/45"
                />
                <span className="text-xs text-neutral-500">to</span>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={handleToDateChange}
                  className="h-8 w-[132px] text-xs border-[#c9a227]/45"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetDates}
                  className="h-8 text-xs border-[#c9a227]/50 text-black hover:bg-neutral-50"
                  title="Reset to current month"
                >
                  Reset
                </Button>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-600" />}
              </div>

              <NotificationBell className="text-black hover:bg-neutral-100 bg-white border border-[#c9a227]/50 rounded-full shadow-sm" />

              <div className="relative" ref={userCardRef}>
                <div
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-neutral-50 px-1.5 py-1 rounded-md border border-transparent hover:border-[#c9a227]/40 transition-colors"
                  onClick={() => setIsUserCardVisible(!isUserCardVisible)}
                >
                  <div className="w-7 h-7 bg-black border border-[#c9a227]/60 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-[10px]">
                      {dashboardData?.data?.user_info?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("") || "SA"}
                    </span>
                  </div>
                  <span className="hidden sm:block text-xs font-medium text-black">
                    {dashboardData?.data?.user_info?.name || "Super Admin"}
                  </span>
                  {isUserCardVisible ? (
                    <ChevronUp className="h-3.5 w-3.5 text-neutral-500" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
                  )}
                </div>

                {isUserCardVisible && (
                  <UserInfoCard
                    user={
                      dashboardData?.data?.user_info || {
                        user_id: "",
                        name: "Super Admin",
                        role: "Super Admin",
                        is_admin: true,
                        role_id: 10,
                      }
                    }
                    tallyRunning={false}
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-2.5 sm:p-3">
          <div className="max-w-7xl mx-auto">
            {error ? (
              <div className="text-center py-10">
                <div className="text-red-600 mb-3">
                  <p className="text-base font-semibold">Failed to load dashboard data</p>
                  <p className="text-sm">{error.message}</p>
                </div>
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  className="border-[#c9a227]/50"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData?.data?.organization_counts && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      <MetricCard
                        title="Organizations"
                        value={dashboardData.data.organization_counts.length}
                        icon={FileText}
                      />
                      <MetricCard
                        title="Branches"
                        value={dashboardData.data.branch_counts?.length || 0}
                        icon={Building2}
                      />
                      <MetricCard
                        title="Vouchers"
                        value={dashboardData.data.organization_counts.reduce(
                          (sum, org) => sum + (org.voucher_count || 0),
                          0
                        )}
                        icon={Receipt}
                      />
                      <MetricCard
                        title="Inward"
                        value={dashboardData.data.organization_counts.reduce(
                          (sum, org) => sum + (org.inward_count || 0),
                          0
                        )}
                        icon={Package}
                      />
                      <MetricCard
                        title="Outward"
                        value={dashboardData.data.organization_counts.reduce(
                          (sum, org) => sum + (org.outward_count || 0),
                          0
                        )}
                        icon={Truck}
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      <ChartCard title="Voucher Count by Organization" icon={BarChart3}>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={dashboardData.data.organization_counts}
                            margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                            <XAxis
                              dataKey="organization_name"
                              angle={-35}
                              textAnchor="end"
                              height={70}
                              interval={0}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="voucher_count" fill={INK} name="Vouchers" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      <ChartCard title="Inward Count by Organization" icon={BarChart3}>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={dashboardData.data.organization_counts}
                            margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                            <XAxis
                              dataKey="organization_name"
                              angle={-35}
                              textAnchor="end"
                              height={70}
                              interval={0}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="inward_count" fill={GOLD} name="Inward" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      <ChartCard title="Outward Count by Organization" icon={BarChart3}>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={dashboardData.data.organization_counts}
                            margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                            <XAxis
                              dataKey="organization_name"
                              angle={-35}
                              textAnchor="end"
                              height={70}
                              interval={0}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="outward_count" fill="#57534e" name="Outward" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      <ChartCard title="Hamali Count by Organization" icon={BarChart3}>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={dashboardData.data.organization_counts}
                            margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                            <XAxis
                              dataKey="organization_name"
                              angle={-35}
                              textAnchor="end"
                              height={70}
                              interval={0}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="hamali_count" fill="#e8c547" name="Hamali" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </div>

                    <ChartCard title="All Counts by Organization (Combined)" icon={BarChart3}>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart
                          data={dashboardData.data.organization_counts}
                          margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                          <XAxis
                            dataKey="organization_name"
                            angle={-35}
                            textAnchor="end"
                            height={70}
                            interval={0}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="voucher_count" fill={INK} name="Vouchers" />
                          <Bar dataKey="inward_count" fill={GOLD} name="Inward" />
                          <Bar dataKey="outward_count" fill="#57534e" name="Outward" />
                          <Bar dataKey="hamali_count" fill="#e8c547" name="Hamali" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      <ChartCard title="Voucher Distribution" icon={PieChart}>
                        <ResponsiveContainer width="100%" height={260}>
                          <RechartsPieChart>
                            <Pie
                              data={dashboardData.data.organization_counts.filter(
                                (org) => org.voucher_count > 0
                              )}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) =>
                                `${name}: ${(percent * 100).toFixed(0)}%`
                              }
                              outerRadius={80}
                              fill={GOLD}
                              dataKey="voucher_count"
                              nameKey="organization_name"
                            >
                              {dashboardData.data.organization_counts
                                .filter((org) => org.voucher_count > 0)
                                .map((entry, index) => (
                                  <Cell
                                    key={`cell-v-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                            </Pie>
                            <Tooltip />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      <ChartCard title="Inward Distribution" icon={PieChart}>
                        <ResponsiveContainer width="100%" height={260}>
                          <RechartsPieChart>
                            <Pie
                              data={dashboardData.data.organization_counts.filter(
                                (org) => org.inward_count > 0
                              )}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) =>
                                `${name}: ${(percent * 100).toFixed(0)}%`
                              }
                              outerRadius={80}
                              fill={GOLD}
                              dataKey="inward_count"
                              nameKey="organization_name"
                            >
                              {dashboardData.data.organization_counts
                                .filter((org) => org.inward_count > 0)
                                .map((entry, index) => (
                                  <Cell
                                    key={`cell-i-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                            </Pie>
                            <Tooltip />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </div>

                    <ChartCard title="Organization-wise Counts">
                      <div className="overflow-x-auto rounded-md border border-[#c9a227]/35">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-black text-white">
                              <th className="text-left px-2.5 py-2 font-semibold uppercase tracking-wide">
                                Organization
                              </th>
                              <th className="text-right px-2.5 py-2 font-semibold uppercase tracking-wide">
                                Vouchers
                              </th>
                              <th className="text-right px-2.5 py-2 font-semibold uppercase tracking-wide">
                                Inward
                              </th>
                              <th className="text-right px-2.5 py-2 font-semibold uppercase tracking-wide">
                                Outward
                              </th>
                              <th className="text-right px-2.5 py-2 font-semibold uppercase tracking-wide">
                                Hamali
                              </th>
                              <th className="text-right px-2.5 py-2 font-semibold uppercase tracking-wide text-[#c9a227]">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardData.data.organization_counts.map((org) => {
                              const total =
                                (org.voucher_count || 0) +
                                (org.inward_count || 0) +
                                (org.outward_count || 0) +
                                (org.hamali_count || 0);
                              return (
                                <tr
                                  key={org.organization_id}
                                  className="border-b border-[#c9a227]/20 hover:bg-[#c9a227]/08"
                                >
                                  <td className="px-2.5 py-1.5 font-medium text-black">
                                    {org.organization_name}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                                    {org.voucher_count || 0}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                                    {org.inward_count || 0}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                                    {org.outward_count || 0}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                                    {org.hamali_count || 0}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                                    {total}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-[#c9a227]/50 bg-neutral-50 font-semibold">
                              <td className="px-2.5 py-2">Total</td>
                              <td className="px-2.5 py-2 text-right tabular-nums">
                                {dashboardData.data.organization_counts.reduce(
                                  (sum, org) => sum + (org.voucher_count || 0),
                                  0
                                )}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums">
                                {dashboardData.data.organization_counts.reduce(
                                  (sum, org) => sum + (org.inward_count || 0),
                                  0
                                )}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums">
                                {dashboardData.data.organization_counts.reduce(
                                  (sum, org) => sum + (org.outward_count || 0),
                                  0
                                )}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums">
                                {dashboardData.data.organization_counts.reduce(
                                  (sum, org) => sum + (org.hamali_count || 0),
                                  0
                                )}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums text-[#c9a227]">
                                {dashboardData.data.organization_counts.reduce(
                                  (sum, org) =>
                                    sum +
                                    (org.voucher_count || 0) +
                                    (org.inward_count || 0) +
                                    (org.outward_count || 0) +
                                    (org.hamali_count || 0),
                                  0
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </ChartCard>
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
