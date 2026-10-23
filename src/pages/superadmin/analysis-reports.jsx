import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Building2, 
  BarChart3,
  TrendingUp,
  Package,
  Truck,
  Receipt,
  Users,
  FileText,
  Settings,
  Route,
  Calendar,
  Loader2,
  Menu,
  RefreshCw
} from "lucide-react";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/notifications/NotificationBell";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// Color palette for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

export default function AnalysisReports() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { toast } = useToast();

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    const user = localStorage.getItem("superadmin_user");
    
    if (!token || !user) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  // Set default dates to current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(lastDay.toISOString().split('T')[0]);
  }, []);

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery({
    queryKey: ['superadmin-organizations'],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("superadmin_token");
        const response = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/organizations/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }
        
        const result = await response.json();
        if (result.status === 200) {
          return result.data || [];
        } else {
          throw new Error(result.message || result.error || 'Failed to fetch organizations');
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
        throw err;
      }
    },
  });

  // Fetch branches for filter (filtered by organization if selected)
  const { data: branchesData } = useQuery({
    queryKey: ['superadmin-branches', selectedOrganization],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("superadmin_token");
        let url = `${API_BASE_URL}/api/superadmin/super-admin/branches/`;
        const params = new URLSearchParams();
        if (selectedOrganization) {
          params.append('organization_id', selectedOrganization);
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch branches');
        }
        
        const result = await response.json();
        if (result.status === 200) {
          return result.data || [];
        } else {
          throw new Error(result.message || result.error || 'Failed to fetch branches');
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
        throw err;
      }
    },
    enabled: !!selectedOrganization, // Only fetch when organization is selected
  });

  // Fetch analysis data
  const { data: analysisData, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-analysis', selectedOrganization, selectedBranch, fromDate, toDate],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("superadmin_token");
        
        let url = `${API_BASE_URL}/api/superadmin/super-admin/branch-analysis/`;
        const params = new URLSearchParams();
        if (selectedOrganization) {
          params.append('organization_id', selectedOrganization);
        }
        if (selectedBranch) {
          params.append('branch_id', selectedBranch);
        }
        if (fromDate) {
          params.append('from_date', fromDate);
        }
        if (toDate) {
          params.append('to_date', toDate);
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch analysis data' }));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to fetch analysis data`);
        }
        
        const result = await response.json();
        if (result.status === 200) {
          // Show warning if API returned one
          if (result.warning || result.data?.warning) {
            toast({
              title: "Warning",
              description: result.warning || result.data?.warning,
              variant: "default",
            });
          }
          return result.data;
        } else {
          throw new Error(result.message || result.error || 'Failed to fetch analysis data');
        }
      } catch (err) {
        console.error('Error fetching analysis data:', err);
        throw err;
      }
    },
    enabled: !!fromDate && !!toDate, // Only require dates, organization is optional
  });

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
    setSelectedBranch(null);
  }, [selectedOrganization]);

  // Prepare module-wise chart data
  const prepareModuleChartData = (moduleName) => {
    if (!analysisData) return [];
    
    // Organization-wise view
    if (analysisData.view_type === 'organization_wise' && analysisData.organization_breakdown) {
      return analysisData.organization_breakdown.map(org => {
        let value = 0;
        if (org[moduleName]) {
          value = org[moduleName].total_entries || 
                  org[moduleName].total_orders || 
                  org[moduleName].total_details || 
                  org[moduleName].total_receipts || 0;
        }
        return {
          name: org.organization_name,
          value: value,
        };
      });
    }
    
    // Branch-wise view
    if (analysisData.view_type === 'branch_wise' && analysisData.branch_breakdown) {
      return analysisData.branch_breakdown.map(branch => {
        let value = 0;
        if (branch[moduleName]) {
          value = branch[moduleName].total_entries || 
                  branch[moduleName].total_orders || 
                  branch[moduleName].total_details || 
                  branch[moduleName].total_receipts || 0;
        }
        return {
          name: branch.branch_name,
          value: value,
        };
      });
    }
    
    // Detailed view (single branch) - return empty as we'll show summary cards
    if (analysisData.view_type === 'detailed') {
      return [];
    }
    
    return [];
  };

  const prepareVoucherChartData = () => {
    if (!analysisData) return [];
    
    const vouchers = analysisData.view_type === 'detailed' 
      ? analysisData.vouchers 
      : analysisData.summary?.vouchers;
    
    if (!vouchers?.voucher_breakdown) return [];
    
    return Object.entries(vouchers.voucher_breakdown).map(([name, value]) => ({
      name,
      value
    }));
  };
  
  // Get summary data based on view type
  const getSummaryData = () => {
    if (!analysisData) return null;
    
    if (analysisData.view_type === 'detailed') {
      // For detailed view, data is directly in analysisData
      return {
        inward: analysisData.inward,
        outward: analysisData.outward,
        sales_orders: analysisData.sales_orders,
        hamali: analysisData.hamali,
        machines: analysisData.machines,
        routes: analysisData.routes,
        receipts: analysisData.receipts,
        customers: analysisData.customers,
        vouchers: analysisData.vouchers,
      };
    }
    
    // For organization_wise and branch_wise, data is in summary
    return analysisData.summary || null;
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Analysis data has been refreshed",
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="mr-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Analysis Reports</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <NotificationBell />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <select
                      id="organization"
                      value={selectedOrganization || ""}
                      onChange={(e) => setSelectedOrganization(e.target.value || null)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white"
                    >
                      <option value="">All Organizations</option>
                      {organizationsData?.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <select
                      id="branch"
                      value={selectedBranch || ""}
                      onChange={(e) => setSelectedBranch(e.target.value || null)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white"
                      disabled={!selectedOrganization}
                    >
                      <option value="">All Branches</option>
                      {branchesData?.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromDate">From Date</Label>
                    <Input
                      id="fromDate"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toDate">To Date</Label>
                    <Input
                      id="toDate"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading analysis data...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-red-500">
                    <p className="font-semibold">Error loading analysis data</p>
                    <p className="text-sm mt-2">{error.message}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Data */}
            {analysisData && !isLoading && (
              <>
                {/* View Info Header */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {analysisData.view_type === 'organization_wise' && 'Organization-wise Analysis'}
                          {analysisData.view_type === 'branch_wise' && `${analysisData.organization_name} - Branch-wise Analysis`}
                          {analysisData.view_type === 'detailed' && `${analysisData.organization_name} - ${analysisData.branch_name || 'Branch'} - Detailed Analysis`}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Date Range: {analysisData.date_range?.from_date} to {analysisData.date_range?.to_date}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Module-wise Graphs - Only show for organization_wise and branch_wise views */}
                {(analysisData.view_type === 'organization_wise' || analysisData.view_type === 'branch_wise') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Inward Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-blue-600" />
                          Inward
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={prepareModuleChartData('inward')}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#0088FE" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Outward Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Truck className="h-5 w-5 text-green-600" />
                          Outward
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={prepareModuleChartData('outward')}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#00C49F" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Sales Orders Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-purple-600" />
                          Sales Orders
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={prepareModuleChartData('sales_orders')}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#FFBB28" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Hamali Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="h-5 w-5 text-orange-600" />
                          Hamali
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={prepareModuleChartData('hamali')}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#FF8042" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Receipts Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Receipt className="h-5 w-5 text-orange-600" />
                          Receipts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={prepareModuleChartData('receipts')}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Detailed View - Module-wise Graphs for Single Branch */}
                {analysisData.view_type === 'detailed' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Inward Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-blue-600" />
                          Inward
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={[{ name: analysisData.branch_name || 'Branch', value: analysisData.inward?.total_entries || 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#0088FE" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Outward Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Truck className="h-5 w-5 text-green-600" />
                          Outward
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={[{ name: analysisData.branch_name || 'Branch', value: analysisData.outward?.total_entries || 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#00C49F" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Sales Orders Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-purple-600" />
                          Sales Orders
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={[{ name: analysisData.branch_name || 'Branch', value: analysisData.sales_orders?.total_orders || 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#FFBB28" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Hamali Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="h-5 w-5 text-orange-600" />
                          Hamali
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={[{ name: analysisData.branch_name || 'Branch', value: analysisData.hamali?.total_details || 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#FF8042" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Receipts Module Graph */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Receipt className="h-5 w-5 text-orange-600" />
                          Receipts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={[{ name: analysisData.branch_name || 'Branch', value: analysisData.receipts?.total_receipts || 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Key Metrics Grid */}
                {(() => {
                  const summary = getSummaryData();
                  if (!summary) return null;
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Inward */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-gray-600">Inward</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-bold">{summary.inward?.total_entries || 0}</span>
                              <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <p className="text-xs text-gray-500">Total Entries</p>
                            <div className="flex items-center gap-4 text-xs">
                              <span>Items: {summary.inward?.total_items || 0}</span>
                              <span>Completed: {summary.inward?.completed_items || 0}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Outward */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-gray-600">Outward</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-bold">{summary.outward?.total_entries || 0}</span>
                              <Truck className="h-5 w-5 text-green-600" />
                            </div>
                            <p className="text-xs text-gray-500">Total Entries</p>
                            <div className="flex items-center gap-4 text-xs">
                              <span>Amount: ₹{summary.outward?.total_amount?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Sales Orders */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-gray-600">Sales Orders</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-bold">{summary.sales_orders?.total_orders || 0}</span>
                              <FileText className="h-5 w-5 text-purple-600" />
                            </div>
                            <p className="text-xs text-gray-500">Total Orders</p>
                            <div className="flex items-center gap-4 text-xs">
                              <span>Amount: ₹{summary.sales_orders?.total_amount?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Receipts */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-gray-600">Receipts</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-bold">{summary.receipts?.total_receipts || 0}</span>
                              <Receipt className="h-5 w-5 text-orange-600" />
                            </div>
                            <p className="text-xs text-gray-500">Total Receipts</p>
                            <div className="flex items-center gap-4 text-xs">
                              <span>Amount: ₹{summary.receipts?.total_amount?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* Detailed Metrics - Only show for detailed view */}
                {analysisData.view_type === 'detailed' && (() => {
                  const summary = getSummaryData();
                  if (!summary) return null;
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Hamali */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Settings className="h-5 w-5" />
                              Hamali
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold">Total Details</span>
                                <Badge variant="outline">{summary.hamali?.total_details || 0}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-500">Completed</p>
                                  <p className="text-xl font-bold text-green-600">{summary.hamali?.completed || 0}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Pending</p>
                                  <p className="text-xl font-bold text-orange-600">{summary.hamali?.pending || 0}</p>
                                </div>
                              </div>
                              <div className="pt-2 border-t">
                                <p className="text-sm text-gray-500">Total Amount</p>
                                <p className="text-xl font-bold">₹{summary.hamali?.total_amount?.toLocaleString() || 0}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Machines */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Settings className="h-5 w-5" />
                              Machines Performance
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold">Total Reports</span>
                                <Badge variant="outline">{summary.machines?.total_reports || 0}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-500">Verified</p>
                                  <p className="text-xl font-bold text-green-600">{summary.machines?.verified || 0}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Unverified</p>
                                  <p className="text-xl font-bold text-orange-600">{summary.machines?.unverified || 0}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Routes */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Route className="h-5 w-5" />
                              Routes
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold">Total Routes</span>
                                <Badge variant="outline">{summary.routes?.total_routes || 0}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-500">Total Visits</p>
                                  <p className="text-xl font-bold">{summary.routes?.total_visits || 0}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Salesmen</p>
                                  <p className="text-xl font-bold">{summary.routes?.unique_salesmen || 0}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Customers & Vouchers */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Users className="h-5 w-5" />
                              Customers & Vouchers
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm text-gray-500">Total Customers</p>
                                <p className="text-xl font-bold">{summary.customers?.total_customers || 0}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Total Vouchers</p>
                                <p className="text-xl font-bold">{summary.vouchers?.total_vouchers || 0}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Voucher Breakdown Chart */}
                      {summary.vouchers?.voucher_breakdown && Object.keys(summary.vouchers.voucher_breakdown).length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5" />
                              Voucher Breakdown
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={prepareVoucherChartData()}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {prepareVoucherChartData().map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* Empty State - Only show if no data and not loading */}
            {!analysisData && !isLoading && !error && fromDate && toDate && (
              <Card>
                <CardContent className="p-12">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="font-semibold">No data available for the selected date range</p>
                    <p className="text-sm mt-2">Try adjusting the date range or filters</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
