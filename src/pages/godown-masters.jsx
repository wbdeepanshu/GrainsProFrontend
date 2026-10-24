import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, ChevronLeft, ChevronRight, Warehouse, CheckCircle, XCircle, Menu, RefreshCw, Filter, X, Building, Check, ChevronsUpDown, Loader2, Pencil, Plus } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS_PER_PAGE = 25;

export default function GodownMasters() {
  const userData = AuthService.getUserData();
  const rawTallyEnabled =
    userData?.is_tally_enabled ??
    userData?.user_info?.is_tally_enabled ??
    userData?.organization?.is_tally_enabled;
  const isTallyEnabled = !(
    rawTallyEnabled === false ||
    rawTallyEnabled === 0 ||
    rawTallyEnabled === "0" ||
    rawTallyEnabled === "false" ||
    rawTallyEnabled === "False"
  );

  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState(null);
  const [editBranchId, setEditBranchId] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createGodownName, setCreateGodownName] = useState("");
  const [createBranchId, setCreateBranchId] = useState("");
  
  // Hooks
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // API Fetch Function
  const fetchGodowns = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/get-godowns/`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response structures
      if (data.status === 200 && data.data) {
        return data;
      } else if (Array.isArray(data)) {
        return { data: data, status: 200 };
      } else {
        return data;
      }
    } catch (error) {
      console.error('Fetch godowns error:', error);
      throw error;
    }
  };

  // React Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['/api/get-godowns'],
    queryFn: fetchGodowns,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Extract godowns data from response
  const allGodowns = useMemo(() => {
    if (!data) return [];
    
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    } else if (Array.isArray(data)) {
      return data;
    } else {
      return [];
    }
  }, [data]);

  // Fetch branches from API (same as user-list.jsx)
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    retry: 1,
  });

  async function fetchBranches() {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/get-branches/`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response structures
      if (data.status === 200 && data.data) {
        return data.data;
      } else if (Array.isArray(data)) {
        return data;
      } else {
        return data;
      }
    } catch (error) {
      console.error('Fetch branches error:', error);
      throw error;
    }
  }

  // Extract branches from API data
  const branches = useMemo(() => {
    if (!branchesData) return ["All"];
    
    const branchNames = branchesData.map(branch => branch.name).filter(name => name);
    return ["All", ...branchNames.sort()];
  }, [branchesData]);

  const branchOptions = useMemo(() => {
    if (!Array.isArray(branchesData)) return [];
    return branchesData
      .filter((branch) => branch?.id && branch?.name)
      .map((branch) => ({ id: String(branch.id), name: branch.name }));
  }, [branchesData]);

  const createGodownMutation = useMutation({
    mutationFn: async ({ godownName, branchId }) => {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
      const payload = { godown_name: godownName };
      if (branchId) {
        payload.branch_id = Number(branchId);
      }

      const response = await fetch(`${backendUrl}/api/user/create-godown-master/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || (data?.status !== 201 && data?.status !== 200)) {
        throw new Error(data?.message || "Failed to create godown");
      }
      return data;
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: data?.message || "Godown created successfully",
      });
      setIsCreateDialogOpen(false);
      setCreateGodownName("");
      setCreateBranchId("");
      await queryClient.invalidateQueries({ queryKey: ["/api/get-godowns"] });
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to create godown",
        variant: "destructive",
      });
    },
  });

  const updateGodownMutation = useMutation({
    mutationFn: async ({ godownId, branchId, isActive }) => {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
      const response = await fetch(`${backendUrl}/api/update-godown-branch-status/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          godown_id: godownId,
          branch_id: branchId,
          is_active: isActive,
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to update godown");
      }
      return data;
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: data?.message || "Godown updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingGodown(null);
      setEditBranchId("");
      setEditStatus("active");
      await queryClient.invalidateQueries({ queryKey: ['/api/get-godowns'] });
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to update godown",
        variant: "destructive",
      });
    }
  });

  // Status options
  const statusOptions = ["All", "Active", "Inactive"];

  // Sorting function
  const sortedGodowns = useMemo(() => {
    if (!allGodowns.length) return [];
    
    const sorted = [...allGodowns].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle different data types
      if (sortField === 'created_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      } else if (typeof aValue === 'boolean') {
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [allGodowns, sortField, sortDirection]);

  // Filter godowns based on search term, branch, and status
  const filteredGodowns = useMemo(() => {
    let filtered = sortedGodowns;

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(godown =>
        (godown.name && godown.name.toLowerCase().includes(searchLower)) ||
        (godown.branch && godown.branch.toLowerCase().includes(searchLower)) ||
        (godown.parent && godown.parent.toLowerCase().includes(searchLower))
      );
    }

    // Filter by branch
    if (selectedBranch && selectedBranch !== "All") {
      filtered = filtered.filter(godown => godown.branch === selectedBranch);
    }

    // Filter by status
    if (selectedStatus && selectedStatus !== "All") {
      const isActive = selectedStatus === "Active";
      filtered = filtered.filter(godown => godown.is_active === isActive);
    }

    return filtered;
  }, [sortedGodowns, searchTerm, selectedBranch, selectedStatus]);

  // Paginate filtered results
  const paginatedGodowns = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredGodowns.slice(startIndex, endIndex);
  }, [filteredGodowns, currentPage]);

  // Pagination calculations
  const totalItems = filteredGodowns.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startItem = totalItems > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedStatus, sortField, sortDirection]);

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading godowns",
        description: error.message || "Failed to fetch godown data",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Event Handlers
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing data",
      description: "Fetching latest godown information...",
    });
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setBranchDropdownOpen(false);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedBranch("All");
    setSelectedStatus("All");
    setSortField("name");
    setSortDirection("asc");
  };

  const openEditDialog = (godown) => {
    const matchedBranch = branchOptions.find((branch) => branch.name === godown.branch);
    setEditingGodown(godown);
    setEditBranchId(matchedBranch ? matchedBranch.id : "");
    setEditStatus(godown.is_active ? "active" : "inactive");
    setIsEditDialogOpen(true);
  };

  const handleUpdateGodown = () => {
    if (!editingGodown?.id) return;
    if (!editBranchId) {
      toast({
        title: "Validation Error",
        description: "Please select a branch",
        variant: "destructive",
      });
      return;
    }
    updateGodownMutation.mutate({
      godownId: editingGodown.id,
      branchId: editBranchId,
      isActive: editStatus === "active",
    });
  };

  const resetCreateForm = () => {
    setCreateGodownName("");
    setCreateBranchId("");
  };

  const handleCreateGodown = () => {
    const godownName = createGodownName.trim();
    if (!godownName) {
      toast({
        title: "Validation Error",
        description: "Please enter a godown name",
        variant: "destructive",
      });
      return;
    }
    createGodownMutation.mutate({
      godownName,
      branchId: createBranchId || null,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Generate pagination numbers
  const getPaginationNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  // Loading State
  if (isLoading) {
    return <CommonLoader text="Loading godown masters..." />;
  }

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="app-main-content">
        {/* Mobile Header */}
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-2.5 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Godown Masters</h1>
            <div className="flex items-center gap-2">
              {!isTallyEnabled && (
                <Button
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-black hover:bg-gray-900 text-white p-2"
                  title="Create Godown"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                className="p-2"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 p-2.5 sm:p-3 overflow-auto">
          {/* Page Header */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Godown Masters</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-0.5 text-sm">
                  Manage and view all godown information across branches
                </p>
              </div>
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  {!isTallyEnabled && (
                    <Button
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="bg-black hover:bg-gray-900 text-white flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Godown</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Filters Section */}
          <Card className={`mb-3 transition-all duration-300 ${isMobile ? '' : showFilters ? 'opacity-100' : 'opacity-100'}`}>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Search Input */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Search Godowns
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, branch..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-8"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Branch Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    Branch
                  </label>
                  <div className="relative">
                    <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={branchDropdownOpen}
                          className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <span className="truncate">
                            {selectedBranch === "All" ? "All Branches" : selectedBranch}
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
                              ) : branches.length === 0 ? (
                                "No branches found."
                              ) : (
                                "No branches match your search."
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                {branches.map((branch) => (
                                  <CommandItem
                                    key={branch}
                                    value={branch}
                                    onSelect={() => handleBranchSelect(branch)}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${
                                          selectedBranch === branch ? "opacity-100 text-blue-600" : "opacity-0"
                                        }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">{branch}</div>
                                        <div className="text-sm text-gray-500">
                                          {branch === "All" 
                                            ? `${allGodowns.length} godown(s)` 
                                            : `${allGodowns.filter(godown => godown.branch === branch).length} godown(s)`
                                          }
                                        </div>
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      Active
                                    </Badge>
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

                {/* Status Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
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

                {/* Results Summary */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Results Summary
                  </label>
                  <div className="flex items-center space-x-2 h-10 px-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <Warehouse className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {allGodowns.length} godown{allGodowns.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(searchTerm || selectedBranch !== "All" || selectedStatus !== "All") && (
                <div className="mt-4 flex justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="flex items-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Clear All Filters</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Godowns Table */}
          <Card>
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center space-x-2">
                  <Warehouse className="h-4 w-4" />
                  <span>Godown List</span>
                </div>
                <div className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  {isFetching && (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Refreshing...</span>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {totalItems > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="overflow-x-auto max-h-[min(72vh,calc(100vh-14rem))]">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50 border-b-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                        <tr>
                          <th className="w-12 h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs">#</th>
                          <th 
                            className="h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Name</span>
                              <span className="text-xs">{getSortIcon('name')}</span>
                            </div>
                          </th>
                          
                          <th 
                            className="h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('branch')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Branch</span>
                              <span className="text-xs">{getSortIcon('branch')}</span>
                            </div>
                          </th>
                          <th className="h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Parent</th>
                          <th 
                            className="h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('is_active')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Status</span>
                              <span className="text-xs">{getSortIcon('is_active')}</span>
                            </div>
                          </th>
                          <th 
                            className="h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('created_at')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Created Date</span>
                              <span className="text-xs">{getSortIcon('created_at')}</span>
                            </div>
                          </th>
                          <th className="h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedGodowns.map((godown, index) => (
                          <tr 
                            key={godown.id || index} 
                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-white">
                              {startItem + index}
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="font-medium text-sm text-gray-900 dark:text-white">
                                {godown.name || 'N/A'}
                              </div>
                            </td>
                           
                            <td className="py-1.5 px-3">
                              <span className="text-gray-900 dark:text-white">
                                {godown.branch || 'N/A'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <span className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate block" title={godown.parent}>
                                {godown.parent || 'N/A'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <Badge
                                variant={godown.is_active ? "default" : "secondary"}
                                className={`text-[10px] px-1.5 py-0 ${
                                  godown.is_active 
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                }`}
                              >
                                {godown.is_active ? (
                                  <div className="flex items-center space-x-1">
                                    <CheckCircle className="h-3 w-3" />
                                    <span>Active</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <XCircle className="h-3 w-3" />
                                    <span>Inactive</span>
                                  </div>
                                )}
                              </Badge>
                            </td>
                            <td className="py-1.5 px-3">
                              <span className="text-gray-900 dark:text-white text-xs">
                                {formatDate(godown.created_at)}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(godown)}
                                className="h-7 w-7 p-0"
                                title="Edit godown"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-3 gap-2">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Showing <span className="font-semibold">{startItem}</span> to{" "}
                        <span className="font-semibold">{endItem}</span> of{" "}
                        <span className="font-semibold">{totalItems}</span> results
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="flex items-center space-x-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Previous</span>
                        </Button>

                        <div className="flex space-x-1">
                          {getPaginationNumbers().map((pageNumber, index) => (
                            <Button
                              key={index}
                              variant={currentPage === pageNumber ? "default" : "outline"}
                              size="sm"
                              onClick={() => typeof pageNumber === 'number' && handlePageChange(pageNumber)}
                              disabled={pageNumber === '...'}
                              className="min-w-[40px]"
                            >
                              {pageNumber}
                            </Button>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="flex items-center space-x-1"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Empty State */
                <div className="text-center py-12">
                  <Warehouse className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                    {allGodowns.length === 0 ? 'No godowns available' : 'No godowns found'}
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    {allGodowns.length === 0 
                      ? "There are currently no godowns in the system. Contact your administrator to add godowns."
                      : (searchTerm || selectedBranch !== "All" || selectedStatus !== "All")
                        ? "No godowns match your current search criteria. Try adjusting your filters or search terms."
                        : "No godowns are currently available."
                    }
                  </p>
                  {(searchTerm || selectedBranch !== "All" || selectedStatus !== "All") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                      className="mt-4 flex items-center space-x-2 mx-auto"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear All Filters</span>
                    </Button>
                  )}
                  {allGodowns.length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isFetching}
                      className="mt-4 flex items-center space-x-2 mx-auto"
                    >
                      <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Godown</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Godown Name *</Label>
              <Input
                value={createGodownName}
                onChange={(e) => setCreateGodownName(e.target.value)}
                placeholder="Enter godown name"
              />
            </div>

            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={createBranchId} onValueChange={setCreateBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                If not selected, your default branch will be used.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={createGodownMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateGodown} disabled={createGodownMutation.isPending}>
              {createGodownMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Godown</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Godown Name</Label>
              <Input value={editingGodown?.name || ""} disabled />
            </div>

            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={editBranchId} onValueChange={setEditBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateGodownMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateGodown} disabled={updateGodownMutation.isPending}>
              {updateGodownMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}