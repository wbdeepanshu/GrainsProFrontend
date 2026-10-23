import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, ChevronLeft, ChevronRight, Settings, Menu, CheckCircle, XCircle, Building2, Calendar, Package2, GitBranch, 
  ArrowRightLeft, ArrowLeftRight, Target, X, Save, RotateCcw, Edit3, Type, Inbox, Send, Tags } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const ITEMS_PER_PAGE = 50;

const VOUCHER_CATEGORY_OPTIONS = [
  { value: "consumption_note", label: "Consumption Note" },
  { value: "production_note", label: "Production Note" },
  { value: "stock_transfer", label: "Stock Transfer" },
  { value: "brand_transfer", label: "Brand Transfer" },
  { value: "fumigation", label: "Fumigation" },
  { value: "journal_entry", label: "Journal Entry" },
];

function formatVoucherCategoryLabel(value) {
  if (!value) return "";
  const match = VOUCHER_CATEGORY_OPTIONS.find((o) => o.value === value);
  return match ? match.label : String(value).replace(/_/g, " ");
}

function VoucherDetailSection({ title, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-slate-50/60 p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function SettingToggleRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2.5">
      <span className="text-sm text-gray-700">{label}</span>
      {children}
    </div>
  );
}

export default function VoucherSettings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Active");
  const [selectedParent, setSelectedParent] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [voucherChanges, setVoucherChanges] = useState({}); // Track changes per voucher
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState({}); // Track which display names are being edited
  const [detailsOpen, setDetailsOpen] = useState({}); // Track which details popups are open
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Get user permissions
  const { 
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  const fetchVouchers = async ({ queryKey }) => {
    const [, { status }] = queryKey;
    
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const params = new URLSearchParams();
    if (status !== "All") {
      params.append("is_active", status === "Active" ? "true" : "false");
    }
    params.append("page", "1");
    params.append("limit", "500"); // Fetch more for client-side search and parent filter

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const url = `${API_BASE_URL}/api/get-voucher-types/${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const allVouchers = data.data || [];
    return { data: allVouchers };
  };

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/get-voucher-types', { status: selectedStatus }],
    queryFn: fetchVouchers,
    enabled: !!AuthService.getAccessToken(),
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading voucher settings",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const allVouchers = data?.data || [];
  const parentOptions = ["All", ...[...new Set(allVouchers.map((v) => (v.parent || "").trim()).filter(Boolean))].sort()];

  // Client-side filter: search (Name, Display Name, Parent) + parent dropdown (same pattern as godown-masters)
  const filteredVouchers = (() => {
    let filtered = allVouchers;

    // Filter by search term (Name, Display Name, Parent)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (v) =>
          (v.name && String(v.name).toLowerCase().includes(searchLower)) ||
          ((v.display_name || v.name) && String(v.display_name || v.name).toLowerCase().includes(searchLower)) ||
          (v.parent && String(v.parent).toLowerCase().includes(searchLower)) ||
          (v.voucher_category &&
            formatVoucherCategoryLabel(v.voucher_category).toLowerCase().includes(searchLower))
      );
    }

    // Filter by parent
    if (selectedParent !== "All") {
      filtered = filtered.filter((v) => (v.parent || "").trim() === selectedParent);
    }

    // Filter by voucher category
    if (selectedCategory !== "All") {
      filtered = filtered.filter((v) => (v.voucher_category || "") === selectedCategory);
    }

    return filtered;
  })();
  const totalItems = filteredVouchers.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const vouchers = filteredVouchers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleParentChange = (value) => {
    setSelectedParent(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), "dd-MM-yyyy");
    } catch (error) {
      return dateString?.split('T')[0] || "-";
    }
  };

  // Toggle function for voucher fields
  const toggleVoucherField = (voucherId, field) => {
    setVoucherChanges((prev) => {
      const currentChanges = prev[voucherId] || {};
      const row = allVouchers.find((v) => v.id === voucherId) || vouchers.find((v) => v.id === voucherId);
      let base = currentChanges[field] !== undefined ? currentChanges[field] : row?.[field];
      if (base === undefined && (field === "inward_enabled" || field === "outward_enabled")) base = false;

      return {
        ...prev,
        [voucherId]: {
          ...currentChanges,
          [field]: !base,
        },
      };
    });
  };

  // Handle display name editing
  const handleDisplayNameEdit = (voucherId) => {
    setEditingDisplayName(prev => ({
      ...prev,
      [voucherId]: true
    }));
  };

  const handleDisplayNameChange = (voucherId, value) => {
    setVoucherChanges(prev => {
      const currentChanges = prev[voucherId] || {};
      return {
        ...prev,
        [voucherId]: {
          ...currentChanges,
          display_name: value
        }
      };
    });
  };

  const handleDisplayNameSave = (voucherId) => {
    setEditingDisplayName(prev => ({
      ...prev,
      [voucherId]: false
    }));
  };

  const handleVoucherCategoryChange = (voucherId, value) => {
    setVoucherChanges((prev) => ({
      ...prev,
      [voucherId]: {
        ...(prev[voucherId] || {}),
        voucher_category: value || null,
      },
    }));
  };

  const handleDisplayNameCancel = (voucherId) => {
    setEditingDisplayName(prev => ({
      ...prev,
      [voucherId]: false
    }));
    // Reset display_name change
    setVoucherChanges(prev => {
      const currentChanges = prev[voucherId] || {};
      const newChanges = { ...currentChanges };
      delete newChanges.display_name;
      return {
        ...prev,
        [voucherId]: newChanges
      };
    });
  };

  // Handle details popup
  const handleDetailsOpen = (voucherId) => {
    setDetailsOpen(prev => ({
      ...prev,
      [voucherId]: true
    }));
  };

  const handleDetailsClose = (voucherId) => {
    setDetailsOpen(prev => ({
      ...prev,
      [voucherId]: false
    }));
  };

  // Check if voucher has any changes
  const hasChanges = (voucherId) => {
    return voucherChanges[voucherId] && Object.keys(voucherChanges[voucherId]).length > 0;
  };

  // Get current value for a field (either changed value or original)
  const getCurrentValue = (voucher, field) => {
    const changes = voucherChanges[voucher.id];
    if (changes && changes[field] !== undefined) return changes[field];
    const v = voucher[field];
    if (v === undefined && (field === "inward_enabled" || field === "outward_enabled")) return false;
    return v;
  };

  // Update voucher API call
  const updateVoucher = async (voucherId) => {
    const changes = voucherChanges[voucherId];
    if (!changes || Object.keys(changes).length === 0) return;

    setIsUpdating(true);
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const url = `${API_BASE_URL}/api/update-voucher/${voucherId}/`;

      const requestBody = { ...changes };
      if ("voucher_category" in requestBody && !requestBody.voucher_category) {
        requestBody.voucher_category = "";
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Clear changes for this voucher
      setVoucherChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[voucherId];
        return newChanges;
      });

      // Refetch data
      refetch();

      toast({
        title: "Success",
        description: "Voucher updated successfully",
        variant: "default",
      });

    } catch (error) {
      toast({
        title: "Error updating voucher",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset changes for a voucher
  const resetChanges = (voucherId) => {
    setVoucherChanges(prev => {
      const newChanges = { ...prev };
      delete newChanges[voucherId];
      return newChanges;
    });
    setEditingDisplayName(prev => {
      const newEditing = { ...prev };
      delete newEditing[voucherId];
      return newEditing;
    });
    setDetailsOpen(prev => {
      const newDetails = { ...prev };
      delete newDetails[voucherId];
      return newDetails;
    });
  };

  const statusOptions = ["All", "Active", "Inactive"];

  if (isLoading) {
    return <CommonLoader text="Loading voucher settings..." />;
  }

  // Check permissions
  if (permissionsLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        {isMobile ? (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        ) : (
          <Sidebar />
        )}
        <div className="flex-1 flex items-center justify-center">
          <CommonLoader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  if (!hasReadPermission("control_settings")) {
    return (
      <div className="flex h-screen bg-gray-50">
        {isMobile ? (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        ) : (
          <Sidebar />
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Settings className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view voucher settings. Contact your administrator for access.
              </p>
              <Button onClick={() => window.history.back()} variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
      />
      
      <div className="app-main-content">
        {/* Mobile Header */}
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Voucher Settings</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Voucher Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Manage and view all voucher type configurations</p>
          </div>

          {/* Filters Section */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Search Input */}
                <div className="space-y-2 md:col-span-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search Vouchers
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, display name, parent..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10 pr-8"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => { setSearchTerm(""); setCurrentPage(1); }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-9 w-full max-w-[9.5rem]">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Settings className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                        <SelectValue placeholder="Status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Parent Filter */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Parent
                  </label>
                  <Select value={selectedParent} onValueChange={handleParentChange}>
                    <SelectTrigger className="h-9 w-full max-w-[9.5rem]">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                        <SelectValue placeholder="Parent" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.map((parent) => (
                        <SelectItem key={parent} value={parent}>
                          {parent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Voucher Category Filter */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="h-9 w-full max-w-[9.5rem]">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Tags className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                        <SelectValue placeholder="Category" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      {VOUCHER_CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Total Count */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Count
                  </label>
                  <div className="flex items-center space-x-2">
                    <Settings className="h-5 w-5 text-blue-500" />
                    <Badge variant="secondary" className="text-lg font-semibold">
                      {totalItems} vouchers
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vouchers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Voucher List</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vouchers.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Display Name</TableHead>
                          <TableHead>Parent</TableHead>
                          <TableHead>Is Active</TableHead>
                          <TableHead>Created At</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vouchers.map((voucher) => (
                          <TableRow key={voucher.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center space-x-2">
                                <Settings className="h-4 w-4 text-blue-500 shrink-0" />
                                <span>{voucher.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {editingDisplayName[voucher.id] ? (
                                <div className="flex items-center space-x-2">
                                  <Input
                                    value={getCurrentValue(voucher, 'display_name') || ''}
                                    onChange={(e) => handleDisplayNameChange(voucher.id, e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Enter display name"
                                  />
                                  {hasUpdatePermission("control_settings") && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDisplayNameSave(voucher.id)}
                                      className="h-8 px-2"
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDisplayNameCancel(voucher.id)}
                                    className="h-8 px-2"
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <Type className="h-4 w-4 text-gray-500" />
                                  <span className="flex-1">{getCurrentValue(voucher, 'display_name') || voucher.name}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDisplayNameEdit(voucher.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center space-x-2">
                                  <Building2 className="h-4 w-4 text-gray-500 shrink-0" />
                                  <span>{voucher.parent || "-"}</span>
                                </div>
                                {getCurrentValue(voucher, "voucher_category") ? (
                                  <span className="text-xs text-gray-500 ml-6 mt-0.5">
                                    {formatVoucherCategoryLabel(getCurrentValue(voucher, "voucher_category"))}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => toggleVoucherField(voucher.id, 'is_active')}
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                  getCurrentValue(voucher, 'is_active')
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                              >
                                {getCurrentValue(voucher, 'is_active') ? (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                ) : (
                                  <XCircle className="h-3 w-3 mr-1" />
                                )}
                                {getCurrentValue(voucher, 'is_active') ? "Active" : "Inactive"}
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <span>{formatDate(voucher.created_at)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Dialog open={detailsOpen[voucher.id]} onOpenChange={(open) => open ? handleDetailsOpen(voucher.id) : handleDetailsClose(voucher.id)}>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 text-xs"
                                    >
                                      <Settings className="h-3 w-3 mr-1" />
                                      View Details
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
                                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 pr-12">
                                      <DialogTitle className="flex items-center gap-2 text-lg">
                                        <Settings className="h-5 w-5 text-blue-500 shrink-0" />
                                        <span className="truncate">Voucher Details — {voucher.name}</span>
                                      </DialogTitle>
                                      <DialogDescription className="text-left">
                                        View and update voucher configuration settings.
                                      </DialogDescription>
                                    </DialogHeader>

                                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                                      <VoucherDetailSection title="Basic Information">
                                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                          <div>
                                            <dt className="text-xs text-gray-500">Name</dt>
                                            <dd className="mt-0.5 font-medium text-gray-900">{voucher.name}</dd>
                                          </div>
                                          <div>
                                            <dt className="text-xs text-gray-500">Display Name</dt>
                                            <dd className="mt-0.5 font-medium text-gray-900">
                                              {getCurrentValue(voucher, "display_name") || voucher.name}
                                            </dd>
                                          </div>
                                          <div>
                                            <dt className="text-xs text-gray-500">Parent</dt>
                                            <dd className="mt-0.5 font-medium text-gray-900">{voucher.parent || "—"}</dd>
                                          </div>
                                          <div>
                                            <dt className="text-xs text-gray-500">Created</dt>
                                            <dd className="mt-0.5 font-medium text-gray-900">{formatDate(voucher.created_at)}</dd>
                                          </div>
                                        </dl>
                                      </VoucherDetailSection>

                                      <VoucherDetailSection title="Voucher Category">
                                        {hasUpdatePermission("control_settings") ? (
                                          <Select
                                            value={getCurrentValue(voucher, "voucher_category") || "__none__"}
                                            onValueChange={(v) =>
                                              handleVoucherCategoryChange(
                                                voucher.id,
                                                v === "__none__" ? "" : v
                                              )
                                            }
                                          >
                                            <SelectTrigger className="h-9 w-full bg-white font-normal shadow-sm focus:ring-1 focus:ring-gray-300 focus:ring-offset-0">
                                              <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__none__">None</SelectItem>
                                              {VOUCHER_CATEGORY_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                  {opt.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <p className="text-sm font-medium text-gray-900">
                                            {formatVoucherCategoryLabel(
                                              getCurrentValue(voucher, "voucher_category")
                                            ) || "—"}
                                          </p>
                                        )}
                                      </VoucherDetailSection>

                                      <VoucherDetailSection title="Settings">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <SettingToggleRow label="Is Active">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "is_active")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "is_active")
                                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              {getCurrentValue(voucher, "is_active") ? (
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                              ) : (
                                                <XCircle className="h-3 w-3 mr-1" />
                                              )}
                                              {getCurrentValue(voucher, "is_active") ? "Active" : "Inactive"}
                                            </button>
                                          </SettingToggleRow>
                                          <SettingToggleRow label="Is Batch">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "is_batch")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "is_batch")
                                                  ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              <Package2 className="h-3 w-3 mr-1" />
                                              {getCurrentValue(voucher, "is_batch") ? "Yes" : "No"}
                                            </button>
                                          </SettingToggleRow>
                                          <SettingToggleRow label="Batch Validation">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "is_batch_validation")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "is_batch_validation")
                                                  ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              <Target className="h-3 w-3 mr-1" />
                                              {getCurrentValue(voucher, "is_batch_validation") ? "Yes" : "No"}
                                            </button>
                                          </SettingToggleRow>
                                          <SettingToggleRow label="Add Bardan">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "add_bardan")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "add_bardan")
                                                  ? "bg-purple-100 text-purple-800 hover:bg-purple-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              <GitBranch className="h-3 w-3 mr-1" />
                                              {getCurrentValue(voucher, "add_bardan") ? "Yes" : "No"}
                                            </button>
                                          </SettingToggleRow>
                                          <SettingToggleRow label="In Source">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "in_source")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "in_source")
                                                  ? "bg-orange-100 text-orange-800 hover:bg-orange-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                                              {getCurrentValue(voucher, "in_source") ? "Yes" : "No"}
                                            </button>
                                          </SettingToggleRow>
                                          <SettingToggleRow label="In Destination">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "in_destination")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "in_destination")
                                                  ? "bg-teal-100 text-teal-800 hover:bg-teal-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              <Target className="h-3 w-3 mr-1" />
                                              {getCurrentValue(voucher, "in_destination") ? "Yes" : "No"}
                                            </button>
                                          </SettingToggleRow>
                                          <SettingToggleRow label="Inward Enabled">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "inward_enabled")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "inward_enabled")
                                                  ? "bg-cyan-100 text-cyan-800 hover:bg-cyan-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              <Inbox className="h-3 w-3 mr-1" />
                                              {getCurrentValue(voucher, "inward_enabled") ? "Yes" : "No"}
                                            </button>
                                          </SettingToggleRow>
                                          <SettingToggleRow label="Outward Enabled">
                                            <button
                                              type="button"
                                              onClick={() => toggleVoucherField(voucher.id, "outward_enabled")}
                                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                                getCurrentValue(voucher, "outward_enabled")
                                                  ? "bg-sky-100 text-sky-800 hover:bg-sky-200"
                                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                              }`}
                                            >
                                              <Send className="h-3 w-3 mr-1" />
                                              {getCurrentValue(voucher, "outward_enabled") ? "Yes" : "No"}
                                            </button>
                                          </SettingToggleRow>
                                        </div>
                                      </VoucherDetailSection>
                                    </div>

                                    <DialogFooter className="px-6 py-4 border-t bg-slate-50/60 shrink-0 sm:justify-end gap-2">
                                      {hasChanges(voucher.id) && (
                                        <>
                                          {hasUpdatePermission("control_settings") && (
                                            <Button
                                              className="bg-green-700 text-white hover:bg-green-800"
                                              onClick={() => updateVoucher(voucher.id)}
                                              disabled={isUpdating}
                                            >
                                              <Save className="h-4 w-4 mr-1" />
                                              Update
                                            </Button>
                                          )}
                                          <Button
                                            variant="outline"
                                            onClick={() => resetChanges(voucher.id)}
                                            disabled={isUpdating}
                                          >
                                            <RotateCcw className="h-4 w-4 mr-1" />
                                            Reset
                                          </Button>
                                        </>
                                      )}
                                      <Button
                                        variant="outline"
                                        onClick={() => handleDetailsClose(voucher.id)}
                                      >
                                        Close
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-500">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} vouchers
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                          {totalPages > 5 && (
                            <>
                              <span className="px-2">...</span>
                              <Button
                                variant={currentPage === totalPages ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(totalPages)}
                              >
                                {totalPages}
                              </Button>
                            </>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Settings className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No vouchers found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No vouchers match your current filters.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}