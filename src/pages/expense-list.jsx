import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
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
import { Textarea } from "../components/ui/textarea";
import { useLocation } from "wouter";
import {
  Menu,
  Search,
  Eye,
  FileText,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  Loader2,
  Plus,
  ArrowLeft,
  Image as ImageIcon,
  Download,
  IndianRupee,
  Building,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const actionIconButtonClass =
  "inline-flex items-center justify-center shrink-0 h-8 w-8 min-h-8 min-w-8 p-0";

const DetailField = ({ label, value, children, className = "" }) => (
  <div className={className}>
    <Label className="text-sm font-medium text-gray-500">{label}</Label>
    {children ?? <p className="text-lg font-semibold break-words">{value ?? "-"}</p>}
  </div>
);

const FormSection = ({
  title,
  icon: Icon,
  children,
  className = "border-gray-200 bg-gray-50/60",
  headerClassName = "",
}) => (
  <div className={`rounded-lg border p-4 space-y-4 ${className}`}>
    <div
      className={`flex items-center gap-2 border-b border-gray-200 pb-2 -mx-4 -mt-4 mb-2 px-4 pt-3 rounded-t-lg ${headerClassName}`.trim()}
    >
      {Icon && <Icon className="h-4 w-4 text-blue-600 shrink-0" />}
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">{title}</h3>
    </div>
    {children}
  </div>
);

const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function ExpenseList() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expenseTypeFilter, setExpenseTypeFilter] = useState("all");
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfDay(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfDay(now), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [isApproved, setIsApproved] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get user permissions
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    isLoading: permissionsLoading
  } = useUserPermissions();

  // Set fromDate/toDate when date range preset changes (today, weekly, monthly)
  useEffect(() => {
    const n = new Date();
    if (dateRangePreset === "today") {
      setFromDate(format(startOfDay(n), "yyyy-MM-dd"));
      setToDate(format(endOfDay(n), "yyyy-MM-dd"));
    } else if (dateRangePreset === "weekly") {
      setFromDate(format(startOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setToDate(format(endOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (dateRangePreset === "monthly") {
      setFromDate(format(startOfMonth(n), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(n), "yyyy-MM-dd"));
    }
  }, [dateRangePreset]);

  // Effective date range for API: derived from preset in same render so data always matches selection
  const effectiveFromDate =
    dateRangePreset === "custom"
      ? fromDate
      : (() => {
        const n = new Date();
        if (dateRangePreset === "today") return format(startOfDay(n), "yyyy-MM-dd");
        if (dateRangePreset === "weekly") return format(startOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd");
        if (dateRangePreset === "monthly") return format(startOfMonth(n), "yyyy-MM-dd");
        return fromDate;
      })();
  const effectiveToDate =
    dateRangePreset === "custom"
      ? toDate
      : (() => {
        const n = new Date();
        if (dateRangePreset === "today") return format(endOfDay(n), "yyyy-MM-dd");
        if (dateRangePreset === "weekly") return format(endOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd");
        if (dateRangePreset === "monthly") return format(endOfMonth(n), "yyyy-MM-dd");
        return toDate;
      })();

  // Build query parameters for API call
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('page_size', pageSize.toString());
    if (effectiveFromDate) params.append('from_date', effectiveFromDate);
    if (effectiveToDate) params.append('to_date', effectiveToDate);
    if (statusFilter && statusFilter !== 'all' && statusFilter !== '') params.append('status', statusFilter);
    if (expenseTypeFilter && expenseTypeFilter !== 'all' && expenseTypeFilter !== '') params.append('expense_type', expenseTypeFilter);
    return params.toString();
  };

  // Fetch expenses from API (uses effective date range so filter matches selection)
  const { data: expensesData, isLoading, error, refetch } = useQuery({
    queryKey: [`expenses`, effectiveFromDate, effectiveToDate, statusFilter, expenseTypeFilter, currentPage],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/accounts/expenses/${queryParams ? `?${queryParams}` : ''}`;
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch detailed expense when viewing details
  const { data: expenseDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: [`expense-detail`, selectedExpense?.id],
    queryFn: async () => {
      if (!selectedExpense?.id) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/accounts/expenses/${selectedExpense.id}/`);
      const data = await response.json();
      return data.data?.[0] || null;
    },
    enabled: !!selectedExpense?.id && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const expenses = expensesData?.data || [];
  const totalCount = expensesData?.total_count || 0;
  const totalPages = expensesData?.total_pages || 1;
  const hasNext = expensesData?.has_next || false;
  const hasPrevious = expensesData?.has_previous || false;

  const filteredExpenses = expenses.filter(expense => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      expense.expense_type?.toLowerCase().includes(searchLower) ||
      expense.sub_type?.toLowerCase().includes(searchLower) ||
      expense.salesman_name?.toLowerCase().includes(searchLower) ||
      expense.branch_name?.toLowerCase().includes(searchLower) ||
      expense.remarks?.toLowerCase().includes(searchLower)
    );
  });

  const handleViewDetails = (expense) => {
    setSelectedExpense(expense);
    setIsDetailModalOpen(true);
  };

  const handleDateFilterChange = () => {
    setCurrentPage(1);
    refetch();
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-3 w-3" />;
      case 'rejected': return <XCircle className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return "₹0.00";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'dd-MM-yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (expense) => {
    if (expense?.created_at) return expense.created_at;
    if (expense?.expense_date) return expense.expense_date;
    return "-";
  };

  const handleDownloadAttachment = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'expense-attachment';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle approval/rejection toggle
  const handleApprovalToggle = (approved) => {
    if (approved) {
      setIsApproved(true);
      setIsRejected(false);
      setApprovedAmount(expenseDetail?.amount || "");
    } else {
      setIsApproved(false);
      setIsRejected(true);
      setApprovedAmount("");
    }
  };

  // Reset approval state when modal opens/closes
  const handleModalOpenChange = (open) => {
    setIsDetailModalOpen(open);
    if (!open) {
      setIsApproved(false);
      setIsRejected(false);
      setApprovedAmount("");
      setRemarks("");
    }
  };

  // Submit approval/rejection
  const submitApprovalMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/expense/action/`, data);
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data, variables) => {
      if (data.status === 200) {
        toast({
          title: "Success",
          description: variables.is_approved
            ? "Expense approved successfully"
            : "Expense rejected successfully",
          className: "bg-green-50 border-green-100 text-green-800",
        });
        setIsApproved(false);
        setIsRejected(false);
        setApprovedAmount("");
        setRemarks("");
        queryClient.invalidateQueries(['expenses']);
        queryClient.invalidateQueries(['expense-detail']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update expense status",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Approval error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update expense status",
        variant: "destructive",
      });
    },
  });

  const handleSubmitApproval = () => {
    if (!selectedExpense?.id) return;

    const submitData = {
      expense_id: selectedExpense.id,
      is_approved: isApproved,
      is_rejected: isRejected,
      approved_amount: isApproved ? approvedAmount : null,
      remarks: remarks
    };

    submitApprovalMutation.mutate(submitData);
  };

  const getExpenseStatusBadge = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "approved") {
      return "bg-green-100 text-green-700 border border-green-300";
    }
    if (normalized === "rejected") {
      return "bg-red-100 text-red-700 border border-red-300";
    }
    return "bg-yellow-100 text-yellow-700 border border-yellow-300";
  };

  const getDisplayAmount = (expense) => {
    if (expense.approved_amount) {
      return { value: formatCurrency(expense.approved_amount), className: "text-green-600" };
    }
    if (expense.status?.toLowerCase() === "rejected") {
      return { value: formatCurrency(expense.amount), className: "text-red-600" };
    }
    return { value: formatCurrency(expense.amount), className: "text-amber-600" };
  };

  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let last;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (const page of range) {
      if (last) {
        if (page - last === 2) {
          rangeWithDots.push(last + 1);
        } else if (page - last !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(page);
      last = page;
    }

    return rangeWithDots;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  // Check permissions
  if (permissionsLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <Loader />
        </div>
      </div>
    );
  }

  if (!hasReadPermission("expense_management")) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Receipt className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view expense reports. Contact your administrator for access.
              </p>
              <Button onClick={() => setLocation('/dashboard')} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="app-main-content">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Receipt className="h-6 w-6 text-gray-600 shrink-0" />
                  <h1 className="text-2xl font-bold text-gray-900 truncate">Expense List</h1>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">View and manage expense records</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasCreatePermission("expense_management") && (
                <Button
                  onClick={() => setLocation('/add-expense')}
                  className="bg-black hover:bg-gray-900 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              )}
              <Badge variant="outline" className="text-sm hidden sm:flex">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date().toLocaleDateString('en-GB')}
              </Badge>
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-10 lg:items-end">
                  <div className="lg:col-span-2">
                    <Label htmlFor="dateRangePreset" className="mb-1.5 block text-sm font-medium">Date Range</Label>
                    <Select
                      value={dateRangePreset}
                      onValueChange={(value) => {
                        setDateRangePreset(value);
                        setCurrentPage(1);
                      }}
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
                  <div className="lg:col-span-2">
                    <Label htmlFor="fromDate" className="mb-1.5 block text-sm font-medium">
                      From Date
                    </Label>
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
                          className={`h-10 w-full justify-start text-left font-normal ${
                            dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "From Date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`from-${fromDate || "null"}`}
                          mode="single"
                          selected={fromDate ? new Date(fromDate) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const iso = format(startOfDay(date), "yyyy-MM-dd");
                            setFromDate(iso);
                            if (toDate && iso > toDate) {
                              setToDate(iso);
                            }
                            setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                          }}
                          disabled={{ after: new Date() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="toDate" className="mb-1.5 block text-sm font-medium">
                      To Date
                    </Label>
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
                          className={`h-10 w-full justify-start text-left font-normal ${
                            dateRangePreset !== "custom" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {toDate ? format(new Date(toDate), "dd-MM-yyyy") : "To Date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          key={`to-${toDate || "null"}`}
                          mode="single"
                          selected={toDate ? new Date(toDate) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const iso = format(endOfDay(date), "yyyy-MM-dd");
                            setToDate(iso);
                            setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                          }}
                          disabled={[
                            fromDate ? { before: new Date(fromDate) } : null,
                            { after: new Date() },
                          ].filter(Boolean)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="statusFilter" className="mb-1.5 block text-sm font-medium">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="statusFilter" className="h-10">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="expenseTypeFilter" className="mb-1.5 block text-sm font-medium">Expense Type</Label>
                    <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
                      <SelectTrigger id="expenseTypeFilter" className="h-10">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Travel">Travel</SelectItem>
                        <SelectItem value="Food">Food</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search expenses by type, salesman, branch, or remarks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button onClick={handleDateFilterChange} className="bg-black hover:bg-gray-800">
                    <Search className="h-4 w-4 mr-2" />
                    Apply Filters
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const now = new Date();
                      setDateRangePreset("today");
                      setFromDate(format(startOfDay(now), "yyyy-MM-dd"));
                      setToDate(format(endOfDay(now), "yyyy-MM-dd"));
                      setStatusFilter("all");
                      setExpenseTypeFilter("all");
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>

              </CardContent>
            </Card>

            {/* Search */}


            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5" />
                    Expenses ({filteredExpenses.length})
                  </CardTitle>
                  <Badge variant="outline">Total records: {totalCount}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredExpenses.map((expense) => {
                    const amountDisplay = getDisplayAmount(expense);
                    return (
                      <div
                        key={expense.id}
                        className="bg-white rounded-lg p-4 hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1 text-xs">
                              <Receipt className="h-3 w-3" />
                              <span>
                                {expense.expense_type}
                                {expense.sub_type ? ` / ${expense.sub_type}` : ""}
                              </span>
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-1 text-xs capitalize ${getExpenseStatusBadge(expense.status)}`}
                            >
                              {getStatusIcon(expense.status)}
                              <span>{expense.status}</span>
                            </Badge>
                            {expense.branch_name && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1 max-w-full">
                                <Building className="h-3 w-3 shrink-0" />
                                <span className="truncate">{expense.branch_name}</span>
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-col xl:flex-row xl:items-end gap-3 xl:gap-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm flex-1 min-w-0">
                              <div className="min-w-0">
                                <span className="text-xs text-gray-500 block mb-0.5">Expense Type</span>
                                <p className="font-semibold text-sm break-words">{expense.expense_type || "-"}</p>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-500 block mb-0.5">Sub-Type</span>
                                <p className="font-semibold text-sm break-words">{expense.sub_type || "-"}</p>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-500 block mb-0.5">Amount</span>
                                <p className={`font-semibold text-sm tabular-nums ${amountDisplay.className}`}>
                                  {amountDisplay.value}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-500 block mb-0.5">Salesman</span>
                                <p className="font-semibold text-sm break-words">{expense.salesman_name || "-"}</p>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs text-gray-500 block mb-0.5">Date & Time</span>
                                <p className="font-semibold text-sm tabular-nums break-words">
                                  {formatDateTime(expense)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-end gap-1.5 shrink-0 xl:pb-0.5">
                              <Button
                                type="button"
                                variant="default"
                                onClick={() => handleViewDetails(expense)}
                                title="View Details"
                                className={`${actionIconButtonClass} bg-black text-white hover:bg-gray-800 border border-black`}
                              >
                                <Eye className="h-4 w-4 shrink-0" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredExpenses.length === 0 && (
                    <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                      <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No expenses found</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or search terms</p>
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} expenses
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!hasPrevious}
                      >
                        Previous
                      </Button>
                      {getPageNumbers(currentPage, totalPages).map((page, index) =>
                        page === "..." ? (
                          <span key={`dots-${index}`} className="px-2 text-gray-400">...</span>
                        ) : (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            className={currentPage === page ? "bg-black hover:bg-gray-800" : ""}
                          >
                            {page}
                          </Button>
                        )
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!hasNext}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={isDetailModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              <span>Expense Details</span>
            </DialogTitle>
            <DialogDescription>
              Detailed view of expense #{selectedExpense?.id}
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : expenseDetail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`capitalize ${getExpenseStatusBadge(expenseDetail.status)}`}
                >
                  {getStatusIcon(expenseDetail.status)}
                  <span className="ml-1">{expenseDetail.status}</span>
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  ID #{expenseDetail.id}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {formatDateTime(expenseDetail)}
                </Badge>
              </div>

              <FormSection title="Expense Information" icon={Receipt} headerClassName="bg-blue-50 border-blue-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <DetailField label="Expense Type" value={expenseDetail.expense_type} />
                  <DetailField label="Sub-Type" value={expenseDetail.sub_type || "-"} />
                  <DetailField label="Salesman" value={expenseDetail.salesman_name} />
                  <DetailField label="Branch" value={expenseDetail.branch_name} />
                </div>
              </FormSection>

              <FormSection title="Amount Details" icon={IndianRupee} headerClassName="bg-emerald-50 border-emerald-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <DetailField label="Requested Amount">
                    <p className="text-2xl font-bold text-blue-600 tabular-nums">
                      {formatCurrency(expenseDetail.amount)}
                    </p>
                  </DetailField>
                  {expenseDetail.approved_amount != null && expenseDetail.approved_amount !== "" && (
                    <DetailField label="Approved Amount">
                      <p className="text-2xl font-bold text-green-600 tabular-nums">
                        {formatCurrency(expenseDetail.approved_amount)}
                      </p>
                    </DetailField>
                  )}
                  <DetailField label="Expense Date" value={formatDate(expenseDetail.expense_date)} />
                  <DetailField label="Date & Time" value={formatDateTime(expenseDetail)} />
                </div>
              </FormSection>

              {(expenseDetail.remarks || expenseDetail.action_by) && (
                <FormSection title="Additional Information" icon={FileText}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {expenseDetail.remarks && (
                      <DetailField label="Remarks" className="md:col-span-2">
                        <p className="text-gray-700 mt-1 p-3 bg-white rounded-md border border-gray-200 whitespace-pre-wrap">
                          {expenseDetail.remarks}
                        </p>
                      </DetailField>
                    )}
                    {expenseDetail.action_by && (
                      <DetailField label="Action By" value={expenseDetail.action_by} />
                    )}
                  </div>
                </FormSection>
              )}

              {expenseDetail.attachments && expenseDetail.attachments.length > 0 && (
                <FormSection title={`Attachments (${expenseDetail.attachment_count || expenseDetail.attachments.length})`} icon={ImageIcon} headerClassName="bg-slate-50 border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {expenseDetail.attachments.map((attachment, index) => (
                      <div key={attachment.id || index} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-800">Attachment {index + 1}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadAttachment(attachment.url, `expense-${expenseDetail.id}-attachment-${index + 1}`)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                        <div className="aspect-video bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                          <img
                            src={attachment.url}
                            alt={`Expense attachment ${index + 1}`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.style.display = "none";
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                          <div
                            className="w-full h-full hidden items-center justify-center text-gray-500"
                          >
                            <div className="text-center">
                              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                              <p className="text-sm">Preview not available</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Uploaded: {formatDate(attachment.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </FormSection>
              )}

              <FormSection title="System Information" icon={Clock}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DetailField label="Created At" value={expenseDetail.created_at} />
                  <DetailField label="Last Updated" value={expenseDetail.updated_at || expenseDetail.created_at} />
                </div>
              </FormSection>

              {expenseDetail.status === "pending" && hasUpdatePermission("expense_management") && (
                <FormSection title="Expense Action" icon={CheckCircle} headerClassName="bg-amber-50 border-amber-100">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => handleApprovalToggle(true)}
                        className={
                          isApproved
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "border border-green-600 text-green-700 bg-green-50 hover:bg-green-100"
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleApprovalToggle(false)}
                        className={
                          isRejected
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "border border-red-600 text-red-700 bg-red-50 hover:bg-red-100"
                        }
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>

                    {isApproved && (
                      <div>
                        <Label htmlFor="approvedAmount" className="text-sm font-medium">
                          Approved Amount
                        </Label>
                        <Input
                          id="approvedAmount"
                          type="number"
                          step="0.01"
                          placeholder="Enter approved amount"
                          value={approvedAmount}
                          onChange={(e) => setApprovedAmount(e.target.value)}
                          className="mt-1 max-w-xs"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Original amount: {formatCurrency(expenseDetail.amount)}
                        </p>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="remarks" className="text-sm font-medium">
                        Remarks
                      </Label>
                      <Textarea
                        id="remarks"
                        placeholder="Enter remarks for this action..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    {(isApproved || isRejected) && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsApproved(false);
                            setIsRejected(false);
                            setApprovedAmount("");
                            setRemarks("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSubmitApproval}
                          disabled={submitApprovalMutation.isPending}
                          className={isApproved ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                        >
                          {submitApprovalMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : isApproved ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve Expense
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject Expense
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </FormSection>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">Failed to load expense details</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
