import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useLocation } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Menu,
  Search,
  Eye,
  FileText,
  Calendar,
  CalendarDays,
  Filter,
  Truck,
  Weight,
  User,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Loader2,
  X
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function InwardReports() {
  const [location] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Initialize with URL parameters if available, otherwise use defaults
  const getInitialValues = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      fromDate: urlParams.get('from_date') || "",
      toDate: urlParams.get('to_date') || "",
      statusFilter: urlParams.get('status') || "all"
    };
  };

  const initialValues = getInitialValues();
  const [fromDate, setFromDate] = useState(initialValues.fromDate);
  const [toDate, setToDate] = useState(initialValues.toDate);
  const [statusFilter, setStatusFilter] = useState(initialValues.statusFilter);

  // Sync state with URL parameters when they change
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlFromDate = urlParams.get('from_date');
    const urlToDate = urlParams.get('to_date');
    const urlStatus = urlParams.get('status');
    
    // console.log('URL Parameters detected:', { urlFromDate, urlToDate, urlStatus });
    // console.log('Current state values:', { fromDate, toDate, statusFilter });
    
    if (urlFromDate !== null) {
      // console.log('Setting fromDate from URL:', urlFromDate);
      setFromDate(urlFromDate);
    }
    if (urlToDate !== null) {
      // console.log('Setting toDate from URL:', urlToDate);
      setToDate(urlToDate);
    }
    if (urlStatus !== null) {
      // console.log('Setting statusFilter from URL:', urlStatus);
      setStatusFilter(urlStatus);
    }
  }, [location]); // Re-run when location changes
  const [statusFilters, setStatusFilters] = useState([]);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();


  // Get URL parameters for immediate use in API calls
  const getUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      urlFromDate: urlParams.get('from_date'),
      urlToDate: urlParams.get('to_date'),
      urlStatus: urlParams.get('status')
    };
  };

  // Build query parameters for API call
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    const urlParams = getUrlParams();
    
    // Use URL parameters if available, otherwise use state
    const effectiveFromDate = urlParams.urlFromDate || fromDate;
    const effectiveToDate = urlParams.urlToDate || toDate;
    const effectiveStatus = urlParams.urlStatus || statusFilter;
    
    // console.log('buildQueryParams - URL params:', urlParams);
    // console.log('buildQueryParams - State values:', { fromDate, toDate, statusFilter });
    // console.log('buildQueryParams - Effective values:', { effectiveFromDate, effectiveToDate, effectiveStatus });
    
    // Only add from_date if it's not empty
    if (effectiveFromDate && effectiveFromDate.trim() !== '') {
      params.append('from_date', effectiveFromDate);
    }
    // Only add to_date if it's not empty
    if (effectiveToDate && effectiveToDate.trim() !== '') {
      params.append('to_date', effectiveToDate);
    }
    if (effectiveStatus && effectiveStatus !== 'all' && effectiveStatus !== '') {
      params.append('status', effectiveStatus);
    }
    return params.toString();
  };

  // Get user role for role-based status filters
  const userData = AuthService.getUserData();
  const userRoleId = userData?.role_id;

  // Define role-based status filters
  const getRoleBasedStatusFilters = () => {
    if (userRoleId === 1 || userRoleId === 6) {
      // Admin roles (1, 6) - show simplified status options
      return [
        { value: 'pending', label: 'Pending' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'approved', label: 'Approved' },
        { value: 'completed', label: 'Completed' }
      ];
    } else if (userRoleId === 4) {
      // Role 4 - show all detailed status options
      return [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'unloaded_but_rejected', label: 'Unloaded But Rejected' },
        { value: 'assignment_pending', label: 'Assignment Pending' },
        { value: 'unloading_pending', label: 'Unloading Pending' },
        { value: 'unloaded', label: 'Unloaded' },
        { value: 'completed', label: 'Completed' }
      ];
    } else {
      // Other roles - show all detailed status options
      return [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'unloaded_but_rejected', label: 'Unloaded But Rejected' },
        { value: 'assignment_pending', label: 'Assignment Pending' },
        { value: 'unloading_pending', label: 'Unloading Pending' },
        { value: 'unloaded', label: 'Unloaded' },
        { value: 'completed', label: 'Completed' }
      ];
    }
  };

  // Set status filters based on user role
  useEffect(() => {
    const roleBasedFilters = getRoleBasedStatusFilters();
    setStatusFilters(roleBasedFilters);
    // console.log('Role-based status filters set for role_id:', userRoleId, roleBasedFilters);
    
    // Log role-specific information
    if (userRoleId === 1 || userRoleId === 6) {
      // console.log('Admin role detected - showing simplified status filters: Pending, In Progress, Approved, Completed');
    } else if (userRoleId === 4) {
      // console.log('Role 4 detected - showing all detailed status filters');
    } else {
      // console.log('Other role detected - showing all detailed status filters');
    }
  }, [userRoleId]);

  // Fetch inward entries from API
  const { data: inwardEntries = [], isLoading, error, refetch } = useQuery({
    queryKey: [`${API_BASE_URL}/api/report/get-inwards/`, buildQueryParams()],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/report/get-inwards/${queryParams ? `?${queryParams}` : ''}`;
      // console.log('Inward Reports API Call:', url);
      // console.log('Query Params:', queryParams);
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch detailed entry when viewing details
  const { data: entryDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/report/get-inwards/`, selectedEntry?.id],
    queryFn: async () => {
      if (!selectedEntry?.id) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-inwards/${selectedEntry.id}/`);
      const data = await response.json();
      return data.data;
    },
    enabled: !!selectedEntry?.id && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });


  const filteredEntries = inwardEntries.filter(entry => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return entry.sl_no.toLowerCase().includes(searchLower) ||
      entry.party_name.toLowerCase().includes(searchLower) ||
      entry.vehicle_no.toLowerCase().includes(searchLower) ||
      entry.broker_name.toLowerCase().includes(searchLower);
  });

  const handleViewDetails = (entry) => {
    setSelectedEntry(entry);
    setIsDetailModalOpen(true);
  };

  const handleDateFilterChange = () => {
    // console.log('Date filter button clicked');
    // console.log('Current fromDate:', fromDate);
    // console.log('Current toDate:', toDate);
    // console.log('Current statusFilter:', statusFilter);
    refetch();
  };

  // Helper functions for date management
  const clearFromDate = () => {
    setFromDate("");
  };

  const clearToDate = () => {
    setToDate("");
  };

  const clearAllDates = () => {
    setFromDate("");
    setToDate("");
  };


  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4 text-green-800" />;
    }
  };

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
              <div className="flex items-center space-x-2">
                <FileText className="h-6 w-6 text-gray-600" />
                <h1 className="text-2xl font-bold text-gray-900">Inward Reports</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {!fromDate && !toDate 
                    ? "All data (no date filter)"
                    : !fromDate 
                      ? `Up to ${toDate}`
                      : !toDate
                        ? `From ${fromDate} onwards`
                        : `${fromDate} to ${toDate}`
                  }
                </span>
              </div>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
            </div>
          </div>
        </header>

        {/* Reports Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Filter className="h-5 w-5" />
                    <span>Filters & Search</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Date Range Filter */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-700">Date Range Filter</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearAllDates}
                          className="text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear All
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="fromDate" className="text-sm font-medium text-gray-700">
                            From Date (Optional)
                          </Label>
                          <div className="relative mt-1">
                            <Input
                              id="fromDate"
                              type="date"
                              value={fromDate}
                              onChange={(e) => {
                                // console.log('From date changed:', e.target.value);
                                setFromDate(e.target.value);
                              }}
                              className="pr-8"
                              placeholder="Select start date"
                            />
                            {fromDate && (
                              <button
                                type="button"
                                onClick={clearFromDate}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty to show all data from the beginning
                          </p>
                        </div>
                        
                        <div>
                          <Label htmlFor="toDate" className="text-sm font-medium text-gray-700">
                            To Date (Optional)
                          </Label>
                          <div className="relative mt-1">
                            <Input
                              id="toDate"
                              type="date"
                              value={toDate}
                              onChange={(e) => {
                                // console.log('To date changed:', e.target.value);
                                setToDate(e.target.value);
                              }}
                              className="pr-8"
                              placeholder="Select end date"
                            />
                            {toDate && (
                              <button
                                type="button"
                                onClick={clearToDate}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty to show all data up to today
                          </p>
                        </div>
                        
                        <div className="flex items-end space-x-2">
                          <Button 
                            onClick={handleDateFilterChange} 
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            type="button"
                            disabled={false}
                            style={{ cursor: 'pointer', opacity: 1 }}
                          >
                            <CalendarDays className="h-4 w-4 mr-2" />
                            Apply Filter
                          </Button>
                          <Button 
                            onClick={() => {
                              // console.log('Test button clicked');
                              alert('Test button works!');
                            }} 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            type="button"
                            size="sm"
                          >
                            Test
                          </Button>
                        </div>
                      </div>
                      
                      {/* Date Range Summary */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Current Filter:</span>
                          <span className="text-sm text-gray-600">
                            {!fromDate && !toDate 
                              ? "All data (no date filter)"
                              : !fromDate 
                                ? `Up to ${toDate}`
                                : !toDate
                                  ? `From ${fromDate} onwards`
                                  : `${fromDate} to ${toDate}`
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Search and Status Filter */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Search by Serial No, Party, Vehicle, Broker..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="w-full sm:w-48">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Filter by Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {statusFilters.map((filter) => (
                              <SelectItem key={filter.value} value={filter.value}>
                                {filter.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Approved</p>
                        <p className="text-2xl font-bold text-green-900">
                          {filteredEntries.filter(e => e.status === 'approved').length}
                        </p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Rejected</p>
                        <p className="text-2xl font-bold text-red-900">
                          {filteredEntries.filter(e => e.status === 'rejected').length}
                        </p>
                      </div>
                      <XCircle className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-yellow-600">Pending</p>
                        <p className="text-2xl font-bold text-yellow-900">
                          {filteredEntries.filter(e => e.status === 'pending').length}
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Total</p>
                        <p className="text-2xl font-bold text-blue-900">{filteredEntries.length}</p>
                      </div>
                      <Package className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Inward Entries List */}
              <Card>
                <CardHeader>
                  <CardTitle>Inward Entries ({filteredEntries.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                        onClick={() => handleViewDetails(entry)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center space-x-4">
                              <Badge variant="outline" className="font-mono">
                                {entry.sl_no}
                              </Badge>
                              {/* <Badge variant={getStatusBadgeVariant(entry.status)} className="flex items-center space-x-1">
                              {getStatusIcon(entry.status)}
                              <span className="capitalize">{entry.status}</span>
                            </Badge> */}


                              <Badge
                                variant={getStatusBadgeVariant(entry.status)}
                                className={`flex items-center space-x-1 ${entry.status === 'pending'
                                    ? 'bg-yellow-200 text-black border border-yellow-300'
                                    : entry.status === 'approved'
                                      ? 'bg-green-200 text-black border border-green-500'
                                      : entry.status === 'completed'
                                        ? 'bg-green-400 text-black border border-green-500'
                                        : entry.status === 'rejected'
                                          ? 'bg-red-400 text-black border border-red-500'
                                          : ''
                                  }`}
                              >
                                {getStatusIcon(entry.status)}
                                <span className="capitalize">{entry.status}</span>
                              </Badge>

                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                              <div className="flex items-center space-x-2">
                                <Building className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-700">{entry.party_name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Truck className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-700">{entry.vehicle_no}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Weight className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-700">{entry.net_weight} KG</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-700">{entry.tested_by}</span>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500">
                              Created: {entry.created_at} | Test Date: {entry.test_date}
                            </div>
                          </div>

                          <Button variant="outline" size="sm" className="self-start">
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}

                    {filteredEntries.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No inward entries found matching your criteria.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div >

      {/* Detail Modal */}
      < Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen} >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Inward Entry Details - {selectedEntry?.sl_no}</span>
            </DialogTitle>
            <DialogDescription>
              View and manage inward entry details including stock items and their approval status.
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading entry details...</span>
            </div>
          ) : entryDetail ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Serial No.</p>
                        <p className="font-semibold">{entryDetail.sl_no}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="font-semibold">{entryDetail.date}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Party</p>
                        <p className="font-semibold">{entryDetail.party}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Broker</p>
                        <p className="font-semibold">{entryDetail.broker}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vehicle No.</p>
                        <p className="font-semibold">{entryDetail.vehicle_no}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Bill No.</p>
                        <p className="font-semibold">{entryDetail.bill_no}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Weight Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Gross Weight</p>
                        <p className="font-semibold">{entryDetail.gross_weight} KG</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tare Weight</p>
                        <p className="font-semibold">{entryDetail.tare_weight} KG</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Net Weight</p>
                        <p className="font-semibold text-blue-600">{entryDetail.net_weight} KG</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <Badge variant={getStatusBadgeVariant(entryDetail.status)} className="flex items-center space-x-1">
                          {getStatusIcon(entryDetail.status)}
                          <span className="capitalize">{entryDetail.status}</span>
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Status Summary */}
              {entryDetail.status_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{entryDetail.total_items}</p>
                        <p className="text-sm text-gray-600">Total Items</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{entryDetail.status_summary.approved_items}</p>
                        <p className="text-sm text-gray-600">Approved</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">{entryDetail.status_summary.pending_items}</p>
                        <p className="text-sm text-gray-600">Pending</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{entryDetail.status_summary.rejected_items}</p>
                        <p className="text-sm text-gray-600">Rejected</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Test Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Test Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Tested By</p>
                      <p className="font-semibold">{entryDetail.tested_by}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Test Date</p>
                      <p className="font-semibold">{entryDetail.test_date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created At</p>
                      <p className="font-semibold">{entryDetail.created_at}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stock Items Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stock Items ({entryDetail.stock_items?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {entryDetail.stock_items && entryDetail.stock_items.length > 0 ? (
                    <div className="space-y-4">
                      {entryDetail.stock_items.map((item, index) => (
                        <div key={item.id || index} className="bg-gray-50 p-4 rounded-lg border">
                          <div className="space-y-4">
                            {/* Item Header */}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg">{item.item_name}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                                  <span><strong>Quality:</strong> {item.quality_name}</span>
                                  <span><strong>Brand:</strong> {item.brand}</span>
                                  <span><strong>Our Brand:</strong> {item.our_brand}</span>
                                  <span><strong>Unit:</strong> {item.unit}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-sm">
                                  <span><strong>Bags:</strong> {item.number_of_bags}</span>
                                  <span><strong>Weight:</strong> {item.total_weight} KG</span>
                                  <span><strong>Remarks:</strong> {item.remarks}</span>
                                </div>
                              </div>
                              <Badge variant={getStatusBadgeVariant(item.status)} className="ml-4">
                                {item.status}
                              </Badge>
                            </div>

                            {/* Testing Parameters */}
                            {item.testing_parameters && (
                              <div className="bg-white p-3 rounded border">
                                <h5 className="font-medium mb-2">Testing Parameters</h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                  {Object.entries(item.testing_parameters).map(([key, value]) => (
                                    value && (
                                      <div key={key}>
                                        <span className="text-gray-600">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                                        <span className="ml-1 font-medium">{value}</span>
                                      </div>
                                    )
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Jali Details */}
                            {item.jali_details && item.jali_details.length > 0 && (
                              <div className="bg-white p-3 rounded border">
                                <h5 className="font-medium mb-2">Jali Details</h5>
                                <div className="space-y-2">
                                  {item.jali_details.map((jali, jaliIndex) => (
                                    <div key={jali.id || jaliIndex} className="grid grid-cols-4 gap-2 text-sm bg-gray-50 p-2 rounded">
                                      <span><strong>Jali:</strong> {jali.jali_number}</span>
                                      <span><strong>Type:</strong> {jali.weight_type}</span>
                                      <span><strong>Weight:</strong> {jali.weight_value} KG</span>
                                      <span><strong>Bags:</strong> {jali.bags_count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Status Information */}
                            <div className="flex justify-between items-center pt-2 border-t">
                              <div className="text-sm text-gray-600">
                                {item.tested_by && <span>Tested by: {item.tested_by}</span>}
                                {item.tested_date && <span className="ml-4">Date: {item.tested_date}</span>}
                                {item.approved_by && <span className="ml-4">Approved by: {item.approved_by}</span>}
                                {item.supervisor && <span className="ml-4">Supervisor: {item.supervisor}</span>}
                                {item.godown_location && <span className="ml-4">Godown: {item.godown_location}</span>}
                              </div>
                              <Badge variant={getStatusBadgeVariant(item.status)} className="flex items-center space-x-1">
                                {getStatusIcon(item.status)}
                                <span className="capitalize">{item.status.replace('_', ' ')}</span>
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No stock items found for this entry.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No entry details available.</p>
            </div>
          )}
        </DialogContent>
      </Dialog >


      {/* Loader */}
      < Loader isLoading={isLoading} text="Loading inward reports" />
    </div >
  );
}