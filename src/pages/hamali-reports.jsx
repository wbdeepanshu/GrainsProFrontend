import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useLocation } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { useToast } from "../hooks/use-toast";
import {
  Menu,
  Search,
  Eye,
  FileText,
  Calendar,
  CalendarDays,
  CalendarIcon,
  Filter,
  Users,
  Weight,
  Package,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  CheckSquare,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Download,
  Check,
  ChevronsUpDown,
  Plus
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";

//const API_BASE_URL = "http://192.168.1.118:8095";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function HamaliReports() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Set default dates to current month
  const getCurrentMonthDates = () => {
    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const lastDayOfMonth = endOfMonth(today);
    return {
      startDate: firstDayOfMonth,
      endDate: lastDayOfMonth,
    };
  };

  const { startDate: defaultStartDate, endDate: defaultEndDate } = getCurrentMonthDates();
  const [fromDate, setFromDate] = useState(defaultStartDate);
  const [toDate, setToDate] = useState(defaultEndDate);
  const [dateRangePreset, setDateRangePreset] = useState("monthly"); // "today" | "weekly" | "monthly" | "custom"
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isFinalized, setIsFinalized] = useState(null); // null = all, true = finalized, false = pending
  const [selectedUser, setSelectedUser] = useState('all'); // 'all' = all users, specific user name
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(null); // null = all branches, specific branch ID
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  // Apply date range preset: set fromDate/toDate when preset is today/weekly/monthly
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

  // Handle supervisor selection
  const handleSupervisorChange = (value) => {
    // console.log("🔍 Supervisor selection changed:", value);
    setSelectedUser(value);
    setSupervisorDropdownOpen(false);
    // console.log("🔍 Selected supervisor state updated to:", value);
    
    // Reset to first page when filter changes
    setCurrentPage(1);
  };

  // Handle branch selection
  const handleBranchChange = (branchId) => {
    setSelectedBranchId(branchId === 'all' ? null : branchId);
    setBranchDropdownOpen(false);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    const now = new Date();
    setDateRangePreset("monthly");
    setFromDate(startOfMonth(now));
    setToDate(endOfMonth(now));
    setIsFinalized(null);
    setSelectedUser("all");
    setSelectedBranchId(null);
    setSearchTerm("");
    setCurrentPage(1);
  };

  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);
  const [selectedEntryForFinalize, setSelectedEntryForFinalize] = useState(null);
  const [isUpdateCompletionDialogOpen, setIsUpdateCompletionDialogOpen] = useState(false);
  const [selectedEntryForCompletion, setSelectedEntryForCompletion] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get user permissions
  const { 
    hasCreatePermission, 
    hasReadPermission, 
    hasUpdatePermission, 
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  // Helper function to format date for display
  const formatDateForApi = (date) => {
    return date ? format(new Date(date), "dd-MM-yyyy") : "";
  };

  // Helper function to convert date format from Date object to DD-MM-YYYY
  const convertDateFormat = (date) => {
    if (!date) return null;
    return formatDateForApi(date);
  };

  // Fetch hamali entries from API with proper parameters (excluding search)
  const { data: hamaliData, isLoading, error, refetch } = useQuery({
    queryKey: [
      `${API_BASE_URL}/api/process/get-hamali/`,
      currentPage,
      pageSize,
      fromDate,
      toDate,
      isFinalized,
      selectedUser,
      selectedBranchId
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
      });

      // Add date filters in DD-MM-YYYY format as expected by API
      if (fromDate) {
        params.append('start_date', convertDateFormat(fromDate));
      }
      if (toDate) {
        params.append('end_date', convertDateFormat(toDate));
      }
      if (isFinalized !== null) {
        params.append('is_finalized', isFinalized.toString());
      }
      if (selectedUser !== 'all') {
        params.append('supervised_by', selectedUser);
        // console.log('Filtering by supervised_by:', selectedUser);
      }
      if (selectedBranchId) {
        params.append('branch_id', selectedBranchId.toString());
      }

      // console.log('API URL:', `${API_BASE_URL}/api/process/get-hamali/?${params.toString()}`);
      const response = await apiRequest('GET', `${API_BASE_URL}/api/process/get-hamali/?${params.toString()}`);
      const data = await response.json();
      return data;
    },
  });

  // Extract data and pagination info
  const hamaliEntries = hamaliData?.data || [];
  const pagination = hamaliData?.pagination || {};

  // Fetch all supervised_by values for the dropdown
  const { data: supervisedByData = [], isLoading: isLoadingSupervisedBy, error: supervisedByError } = useQuery({
    queryKey: [`${API_BASE_URL}/api/process/get-hamali-supervisors/`],
    queryFn: async () => {
      try {
        // Fetch all hamali entries to get all supervised_by values
        const params = new URLSearchParams({
          page: '1',
          page_size: '1000', // Get a large number to get all entries
        });
        
        // console.log('Fetching supervised_by data...');
        const response = await apiRequest('GET', `${API_BASE_URL}/api/process/get-hamali/?${params.toString()}`);
        const data = await response.json();
        // console.log('Supervised_by API response:', data);
        return data.data || [];
      } catch (error) {
        console.error('Error fetching supervised_by data:', error);
        return [];
      }
    },
  });

  // Fetch users from API to get comprehensive supervisor list
  const { data: usersData = [], isLoading: isLoadingUsersData } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-users/`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/`);
        const data = await response.json();
        // console.log('Users API response:', data);
        return data.data || [];
      } catch (error) {
        console.error('Error fetching users data:', error);
        return [];
      }
    },
    enabled: AuthService.isAuthenticated(), // Always fetch when authenticated
  });

  // Fetch branches for branch filter dropdown
  const { data: branchesData = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-branches/`],
    queryFn: async () => {
      try {
        const token = AuthService.getAccessToken();
        if (!token) {
          throw new Error("No authentication token found");
        }
        const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
        const response = await fetch(`${backendUrl}/api/get-branches/`, {
          method: 'GET',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.data || [];
      } catch (error) {
        console.error('Error fetching branches:', error);
        return [];
      }
    },
    enabled: AuthService.isAuthenticated(),
  });

  // Get current user data to check role
  const { data: currentUserData } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-users/`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/`);
        const data = await response.json();
        return data.data || [];
      } catch (error) {
        console.error('Error fetching users data:', error);
        return [];
      }
    },
    enabled: AuthService.isAuthenticated(),
  });

  // Get current user's role_id
  const currentUser = useMemo(() => {
    if (!currentUserData || !AuthService.isAuthenticated()) return null;
    const token = AuthService.getAccessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.user_id;
      return currentUserData.find(user => user.user_id === userId);
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  }, [currentUserData]);

  const isAdmin = currentUser?.role_id === 1 || currentUser?.role_id === 6;

  // Show branch filter and Branch column only when more than one branch is available
  const showBranchFilter = (branchesData?.length ?? 0) > 1;

  // Extract unique supervisors from hamali data and users API (same pattern as stock-journal)
  const supervisors = React.useMemo(() => {
    const supervisorSet = new Set();
    
    // Add supervisors from hamali data
    if (supervisedByData.length > 0) {
      supervisedByData.forEach(entry => {
        if (entry.supervised_by) {
          supervisorSet.add(entry.supervised_by);
        }
      });
    }
    
    // Add supervisors from users API
    if (usersData.length > 0) {
      usersData.forEach(user => {
        if (user.name) {
          supervisorSet.add(user.name);
        }
      });
    }
    
    const supervisorList = Array.from(supervisorSet).sort();
    // console.log("🔍 Available supervisors:", supervisorList);
    // console.log("🔍 From hamali data:", supervisedByData.map(entry => entry.supervised_by) || []);
    // console.log("🔍 From users API:", usersData.map(user => user.name) || []);
    // console.log("🔍 SupervisedByData length:", supervisedByData.length);
    // console.log("🔍 UsersData length:", usersData.length);
    // console.log("🔍 IsLoadingSupervisedBy:", isLoadingSupervisedBy);
    // console.log("🔍 IsLoadingUsersData:", isLoadingUsersData);
    return supervisorList;
  }, [supervisedByData, usersData]);

  // Finalize hamali entry mutation
  const finalizeMutation = useMutation({
    mutationFn: async (entryId) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/process/hamali-finalize/`, {
        entry_ids: [entryId]
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Hamali entry finalized successfully",
        variant: "success",
      });
      // Invalidate and refetch the hamali entries
      queryClient.invalidateQueries({
        queryKey: [`${API_BASE_URL}/api/process/get-hamali/`],
        exact: false
      });
      setIsFinalizeDialogOpen(false);
      setSelectedEntryForFinalize(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to finalize hamali entry",
        variant: "destructive",
      });
    },
  });

  // Update completion mutation
  const updateCompletionMutation = useMutation({
    mutationFn: async (entryId) => {
      const response = await apiRequest('PUT', `${API_BASE_URL}/api/process/hamali-entry/`, {
        id: entryId,
        is_completed: true
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Hamali entry marked as completed successfully",
        variant: "success",
      });
      // Invalidate and refetch the hamali entries
      queryClient.invalidateQueries({
        queryKey: [`${API_BASE_URL}/api/process/get-hamali/`],
        exact: false
      });
      setIsUpdateCompletionDialogOpen(false);
      setSelectedEntryForCompletion(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update hamali entry completion",
        variant: "destructive",
      });
    },
  });

  // Filter entries based on search term (client-side filtering for search)
  const filteredEntries = hamaliEntries.filter(entry => {
    if (!searchTerm) return true;

    return entry.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
           entry.hamali_types_used.some(type => type.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (entry.remarks && entry.remarks.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (entry.finalized_by && entry.finalized_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (entry.branch_name && entry.branch_name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Reset to first page when API filters change (not search)
  useEffect(() => {
    setCurrentPage(1);
  }, [fromDate, toDate, isFinalized, selectedUser, selectedBranchId]);

  // Debug supervisor filtering
  React.useEffect(() => {
    // console.log("🔍 Supervisor filter changed:", selectedUser);
    // console.log("🔍 Total hamali entries:", hamaliEntries.length);
    // console.log("🔍 Available supervisors:", supervisors);
    
    if (selectedUser !== "all") {
      // console.log("🔍 Filtering for supervisor:", selectedUser);
      const matchingEntries = hamaliEntries.filter(entry => entry.supervised_by === selectedUser);
      // console.log("🔍 Entries matching supervisor:", matchingEntries.length);
      // console.log("🔍 Matching entries:", matchingEntries.map(entry => ({
      //   id: entry.id,
      //   supervised_by: entry.supervised_by
      // })));
    }
  }, [selectedUser, hamaliEntries, supervisors]);

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleViewEntries = (entryId) => {
    setLocation(`/reports/hamali/${entryId}`);
  };

  const handleFinalizeEntry = (entry) => {
    setSelectedEntryForFinalize(entry);
    setIsFinalizeDialogOpen(true);
  };

  const confirmFinalize = () => {
    if (selectedEntryForFinalize) {
      finalizeMutation.mutate(selectedEntryForFinalize.id);
    }
  };

  const cancelFinalize = () => {
    setIsFinalizeDialogOpen(false);
    setSelectedEntryForFinalize(null);
  };

  const handleUpdateCompletion = (entry) => {
    setSelectedEntryForCompletion(entry);
    setIsUpdateCompletionDialogOpen(true);
  };

  const confirmUpdateCompletion = () => {
    if (selectedEntryForCompletion) {
      updateCompletionMutation.mutate(selectedEntryForCompletion.id);
    }
  };

  const cancelUpdateCompletion = () => {
    setIsUpdateCompletionDialogOpen(false);
    setSelectedEntryForCompletion(null);
  };

  // Download Excel function
  const handleDownloadExcel = async () => {
    try {
      setIsDownloading(true);
      
      // Build query parameters with the same filters as the current view
      const params = new URLSearchParams();
      params.append('download', 'true');
      
      // Add date filters in DD-MM-YYYY format as expected by API (same as the main query)
      if (fromDate) {
        params.append('start_date', convertDateFormat(fromDate));
      }
      if (toDate) {
        params.append('end_date', convertDateFormat(toDate));
      }
      if (isFinalized !== null) {
        params.append('is_finalized', isFinalized.toString());
      }
      if (selectedUser !== 'all') {
        params.append('supervised_by', selectedUser);
      }
      if (selectedBranchId) {
        params.append('branch_id', selectedBranchId.toString());
      }
      
      const response = await apiRequest('GET', `${API_BASE_URL}/api/process/get-hamali/?${params.toString()}`);
      const data = await response.json();
      
      if (data.status === 200 && data.download_url) {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = data.download_url;
        link.download = data.filename || 'hamali_reports.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Download Started",
          description: "Excel report is being downloaded with applied filters...",
          variant: "success",
        });
      } else {
        throw new Error(data.error || 'Failed to generate Excel report');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download Excel report",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };


  if (isLoading) {
    return <Loader text="Loading Hamali reports..." />;
  }

  // Check permissions before rendering
  if (permissionsLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        <div className="app-main-content flex items-center justify-center">
          <Loader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  // Check if user has read permission for hamali
  // Check exact module name from API: "hamali"
  const hasHamaliAccess = hasReadPermission("hamali");
  
  if (!hasHamaliAccess) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        <div className="app-main-content flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view hamali reports.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

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
              <FileText className="h-8 w-8 text-gray-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Hamali Reports</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Show active filters count */}
              {(fromDate || toDate || isFinalized !== null || selectedUser !== 'all' || (showBranchFilter && selectedBranchId)) && (
                <div className="text-xs text-gray-500 mr-2">
                  Filters: {[
                    fromDate && `From ${formatDateForApi(fromDate)}`,
                    toDate && `To ${formatDateForApi(toDate)}`,
                    isFinalized !== null && (isFinalized ? 'Finalized' : 'Pending'),
                    selectedUser !== 'all' && `User: ${selectedUser}`,
                    showBranchFilter && selectedBranchId && `Branch: ${branchesData.find(b => b.id === selectedBranchId)?.name || selectedBranchId}`
                  ].filter(Boolean).join(', ')}
                </div>
              )}
              {hasCreatePermission("hamali") && (
                <Button
                  onClick={() => setLocation("/add-hamali")}
                  className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white"
                  title="Add new hamali entry"
                >
                  <Plus className="h-4 w-4" />
                  Add Hamali
                </Button>
              )}
              <Button
                onClick={handleDownloadExcel}
                disabled={isDownloading || isLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                title="Download Excel with current filters applied"
              >
                <Download className="h-4 w-4" />
                {isDownloading ? "Downloading..." : "Download Excel"}
              </Button>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-end gap-3 gap-y-4">
            {/* Date Range Preset */}
            <div className="w-40 shrink-0">
              <Label htmlFor="dateRangePreset" className="text-sm font-medium text-gray-700">
                Date Range
              </Label>
              <Select
                value={dateRangePreset}
                onValueChange={(value) => {
                  setDateRangePreset(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger id="dateRangePreset" className="mt-1 h-9">
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
            {/* From Date - Calendar Component */}
            <div className="w-40 shrink-0">
              <Label htmlFor="fromDate" className="text-sm font-medium text-gray-700">
                From Date
              </Label>
              <Popover
                open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                onOpenChange={(open) => {
                  if (dateRangePreset !== "custom") return;
                  setIsDatePickerOpen(prev => ({ ...prev, from: open }));
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={dateRangePreset !== "custom"}
                    className={`w-full justify-start text-left font-normal mt-1 ${
                      dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? formatDateForApi(fromDate) : "From Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    key={`from-${fromDate?.getTime() || 'null'}`}
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => {
                      setFromDate(date);
                      setIsDatePickerOpen(prev => ({ ...prev, from: false }));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date - Calendar Component */}
            <div className="w-40 shrink-0">
              <Label htmlFor="toDate" className="text-sm font-medium text-gray-700">
                To Date
              </Label>
              <Popover
                open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                onOpenChange={(open) => {
                  if (dateRangePreset !== "custom") return;
                  setIsDatePickerOpen(prev => ({ ...prev, to: open }));
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={dateRangePreset !== "custom"}
                    className={`w-full justify-start text-left font-normal mt-1 ${
                      dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? formatDateForApi(toDate) : "To Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    key={`to-${toDate?.getTime() || 'null'}`}
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => {
                      setToDate(date);
                      setIsDatePickerOpen(prev => ({ ...prev, to: false }));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>


 {/* Branch Filter - only show when more than one branch */}
 {showBranchFilter && (
              <div className="w-40 shrink-0">
                <Label htmlFor="branch" className="text-sm font-medium text-gray-700">
                  Branch
                </Label>
                <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={branchDropdownOpen}
                      className="w-full justify-between mt-1 h-9 text-sm"
                      disabled={isLoadingBranches}
                    >
                      <span className="truncate text-xs">
                            {isLoadingBranches 
                              ? 'Loading...' 
                              : selectedBranchId 
                                ? branchesData.find(b => b.id === selectedBranchId)?.name || 'Select Branch'
                                : 'All Branches'
                            }
                      </span>
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start" side="bottom" sideOffset={4}>
                    <Command>
                      <CommandInput placeholder="Search branches..." />
                      <CommandList>
                        <CommandEmpty>
                          {branchesData.length === 0 ? "No branches found." : "No branches match your search."}
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            key="all"
                            value="all"
                            onSelect={() => handleBranchChange("all")}
                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Check
                                className={`h-4 w-4 ${
                                  !selectedBranchId ? "opacity-100 text-blue-600" : "opacity-0"
                                }`}
                              />
                              <div>
                                <div className="font-medium text-gray-900">All Branches</div>
                              </div>
                            </div>
                          </CommandItem>
                          
                          {branchesData.map((branch) => (
                            <CommandItem
                              key={branch.id}
                              value={branch.name}
                              onSelect={() => handleBranchChange(branch.id.toString())}
                              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                            >
                              <div className="flex items-center gap-3">
                                <Check
                                  className={`h-4 w-4 ${
                                    selectedBranchId === branch.id.toString() ? "opacity-100 text-blue-600" : "opacity-0"
                                  }`}
                                />
                                <div>
                                  <div className="font-medium text-gray-900">{branch.name}</div>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}


            {/* Status - Reduced width */}
            <div className="w-32 shrink-0">
              <Label htmlFor="status" className="text-sm font-medium text-gray-700">
                Status
              </Label>
              <select
                id="status"
                value={isFinalized === null ? 'all' : isFinalized.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setIsFinalized(value === 'all' ? null : value === 'true');
                }}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All</option>
                <option value="false">Pending</option>
                <option value="true">Finalized</option>
              </select>
            </div>

           

            {/* Search - takes remaining space, full width when wrapped */}
            <div className="flex-1 min-w-[200px] w-full sm:min-w-[280px] sm:max-w-[420px]">
              <Label htmlFor="search" className="text-sm font-medium text-gray-700">
                Search
              </Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 shrink-0" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by date, branch, hamali type, or remarks..."
                  className="pl-10 pr-3 text-sm w-full min-w-0"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-auto shrink-0">
              <Button variant="outline" className="h-9 mt-1 sm:mt-6" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredEntries.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {searchTerm ? 'Filtered results' : `Showing ${pagination.start_index || 0} - ${pagination.end_index || 0} of ${pagination.total_count || 0}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.total_hamali || 0), 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Current page</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Packets</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredEntries.reduce((sum, entry) => sum + (entry.total_packets || 0), 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Current page</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
                  <Weight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredEntries.reduce((sum, entry) => {
                      const weight = parseFloat(entry.total_weight?.split(' ')[0] || 0);
                      return sum + weight;
                    }, 0).toFixed(2)} Qtl
                  </div>
                  <p className="text-xs text-muted-foreground">Current page</p>
                </CardContent>
              </Card>
            </div>


            {/* Hamali Entries Table */}
            <Card className="border-2 border-black shadow-lg">
              <CardHeader className="bg-gray-50 border-b-2 border-black">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <FileText className="h-6 w-6 text-black" />
                  Hamali Daily Entries
                  <Badge variant="secondary" className="ml-2 bg-black text-white">
                    {filteredEntries.length} entries
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hamali entries found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Date</th>
                          {showBranchFilter && (
                            <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Branch</th>
                          )}
                          <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Entries</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Amount</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Packets</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Weight</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Status</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 text-sm">Finalized By</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-900 text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span className="font-medium truncate">{entry.date}</span>
                              </div>
                            </td>
                            {showBranchFilter && (
                              <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                  <span className="font-medium truncate">{entry.branch_name || '-'}</span>
                                </div>
                              </td>
                            )}
                            <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span>{entry.completed_details}/{entry.total_details}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                              <span className="font-medium">₹{parseFloat(entry.total_hamali).toLocaleString()}</span>
                            </td>
                            <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span>{entry.total_packets}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Weight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span>{entry.total_weight}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                              <Badge variant={entry.is_finalized ? "default" : "secondary"} className="text-xs py-0">
                                {entry.is_finalized ? (
                                  <><CheckCircle className="h-3 w-3 mr-1 shrink-0" />Finalized</>
                                ) : (
                                  <><Clock className="h-3 w-3 mr-1 shrink-0" />Pending</>
                                )}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-sm align-middle whitespace-nowrap">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span className="font-medium truncate">{entry.finalized_by}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center align-middle whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewEntries(entry.id)}
                                  className="h-8 w-8 p-0 border-2 border-black hover:bg-black hover:text-white transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {!entry.is_finalized && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleFinalizeEntry(entry)}
                                    disabled={finalizeMutation.isPending}
                                    className="h-8 px-2 border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-colors text-xs"
                                  >
                                    <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                                    {finalizeMutation.isPending ? "..." : "Finalize"}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagination Controls - Only show when not searching */}
            {!searchTerm && pagination.total_pages > 1 && (
              <Card className="border-2 border-gray-300 shadow-lg mt-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>
                        Showing {pagination.start_index || 0} to {pagination.end_index || 0} of {pagination.total_count || 0} entries
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!pagination.has_previous}
                        className="flex items-center gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                          let pageNum;
                          if (pagination.total_pages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= pagination.total_pages - 2) {
                            pageNum = pagination.total_pages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!pagination.has_next}
                        className="flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Results Info */}
            {searchTerm && (
              <Card className="border-2 border-blue-300 shadow-lg mt-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Search className="h-4 w-4" />
                      <span>
                        Found {filteredEntries.length} entries matching "{searchTerm}"
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
                    >
                      Clear Search
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Finalize Confirmation Dialog */}
      <Dialog open={isFinalizeDialogOpen} onOpenChange={setIsFinalizeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-green-600" />
              Finalize Hamali Entry
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to finalize this hamali entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedEntryForFinalize && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Date:</span>
                    <p className="font-semibold">{selectedEntryForFinalize.date}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Amount:</span>
                    <p className="font-semibold">₹{parseFloat(selectedEntryForFinalize.total_hamali).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Entries:</span>
                    <p className="font-semibold">{selectedEntryForFinalize.completed_details}/{selectedEntryForFinalize.total_details}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Packets:</span>
                    <p className="font-semibold">{selectedEntryForFinalize.total_packets}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  Once finalized, this entry will be marked as approved and cannot be modified.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={cancelFinalize}
              disabled={finalizeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmFinalize}
              disabled={finalizeMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {finalizeMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Finalizing...
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Finalize Entry
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}