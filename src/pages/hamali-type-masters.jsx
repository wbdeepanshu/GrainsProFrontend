import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { 
  Search, ChevronLeft, ChevronRight, Package, CheckCircle, XCircle, 
  Menu, RefreshCw, Filter, X, Plus, Edit, IndianRupee, Calendar,
  Building2, Scale, Hash, Trash2, Download, Users, ChevronsUpDown
} from "lucide-react";
import { fetchOrgInfo, getOrgInfoSync } from "@/lib/orgInfo";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const ITEMS_PER_PAGE = 25;

export default function HamaliTypeMasters() {
  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedHamaliGroup, setSelectedHamaliGroup] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [hamaliGroupFilterOpen, setHamaliGroupFilterOpen] = useState(false);
  const [hamaliGroupFilterSearch, setHamaliGroupFilterSearch] = useState("");
  const [editHamaliGroupOpen, setEditHamaliGroupOpen] = useState(false);
  const [editHamaliGroupSearch, setEditHamaliGroupSearch] = useState("");
  const [editingHamaliType, setEditingHamaliType] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [hamaliTypeToDelete, setHamaliTypeToDelete] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  /** @type {{ groupId: number, groupName: string, branchName: string, rate: string }[]} */
  const [groupRateRows, setGroupRateRows] = useState([]);
  
  // Form state (create uses groupRateRows for per-group rates)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    branch: "",
    rate: "",
    per_weight: "1.00",
    per_unit_id: "",
    hamali_group_id: "",
    effective_from: new Date().toISOString().split('T')[0], // Current date as default
    is_active: true
  });

  // Hooks
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { hasCreatePermission, hasUpdatePermission, hasDeletePermission } = useUserPermissions();

  // API Fetch Function
  const fetchHamaliTypes = async (hamaliGroupFilter = "All") => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const params = new URLSearchParams();
      if (hamaliGroupFilter && hamaliGroupFilter !== "All") {
        params.set("hamali_group_id", hamaliGroupFilter);
      }
      const query = params.toString();
      const url = `${backendUrl}/api/process/hamali-types/${query ? `?${query}` : ""}`;

      const response = await fetch(url, {
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
      
      if (data.status === 200 && data.data) {
        return data;
      } else if (Array.isArray(data)) {
        return { data: data, status: 200 };
      } else {
        return data;
      }
    } catch (error) {
      console.error('Fetch hamali types error:', error);
      throw error;
    }
  };

  // Fetch branches for dropdown
  const fetchBranches = async () => {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Fetch branches error:', error);
      return [];
    }
  };

  // Fetch units for dropdown
  const fetchUnits = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/get-unit-masters/`, {
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
      console.error('Fetch units error:', error);
      return [];
    }
  };

  const fetchHamaliGroups = async (branchId = null) => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const params = new URLSearchParams({ is_active: 'true' });
      if (branchId) {
        params.set('branch_id', String(branchId));
      }

      const response = await fetch(`${backendUrl}/api/hamali-groups/?${params.toString()}`, {
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
      console.error('Fetch hamali groups error:', error);
      return [];
    }
  };

  // React Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['/api/process/hamali-types', selectedHamaliGroup],
    queryFn: () => fetchHamaliTypes(selectedHamaliGroup),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: branchesData } = useQuery({
    queryKey: ['/api/get-branches'],
    queryFn: fetchBranches,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: unitsData } = useQuery({
    queryKey: ['/api/get-unit-masters'],
    queryFn: fetchUnits,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: hamaliGroupsData = [] } = useQuery({
    queryKey: ['/api/hamali-groups', 'all'],
    queryFn: () => fetchHamaliGroups(null),
    staleTime: 10 * 60 * 1000,
  });

  const { data: createHamaliGroups = [], isLoading: isLoadingCreateGroups } = useQuery({
    queryKey: ['/api/hamali-groups', 'create', formData.branch || 'all'],
    queryFn: () => fetchHamaliGroups(formData.branch || null),
    enabled: isCreateDialogOpen,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isCreateDialogOpen) return;
    const branchLabel =
      branchesData?.find((b) => String(b.id) === String(formData.branch))?.name || "";
    setGroupRateRows(
      (createHamaliGroups || []).map((group) => ({
        groupId: group.id,
        groupName: group.name,
        branchName: group.branch_name || branchLabel || "—",
        rate: "",
      }))
    );
  }, [createHamaliGroups, isCreateDialogOpen, formData.branch, branchesData]);

  const postHamaliTypeCreate = async (payload) => {
    const token = AuthService.getAccessToken();
    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

    const response = await fetch(`${backendUrl}/api/process/hamali-types/create/`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      let msg = data.message || `HTTP error! status: ${response.status}`;
      if (data.errors) {
        const errText = typeof data.errors === 'string'
          ? data.errors
          : Object.entries(data.errors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('; ');
        msg = errText || msg;
      }
      throw new Error(msg);
    }
    return data;
  };

  // Create mutation — one API call per hamali group with a rate
  const createMutation = useMutation({
    mutationFn: async (payloads) => {
      const created = [];
      const failures = [];
      for (const payload of payloads) {
        const { _groupName, ...apiPayload } = payload;
        try {
          const result = await postHamaliTypeCreate(apiPayload);
          created.push(result);
        } catch (err) {
          failures.push({
            groupName: _groupName,
            message: err.message || 'Failed to create',
          });
        }
      }
      if (created.length === 0) {
        throw new Error(failures[0]?.message || 'Failed to create hamali types');
      }
      return { created, failures };
    },
    onSuccess: ({ created, failures }) => {
      queryClient.invalidateQueries(['/api/process/hamali-types']);
      if (failures?.length) {
        toast({
          title: "Partially created",
          description: failures
            .map((f) => `${f.groupName}: ${f.message}`)
            .join(' | '),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Created ${created.length} hamali type${created.length !== 1 ? 's' : ''} successfully`,
        });
      }
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create hamali type",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }) => {
      const token = AuthService.getAccessToken();
      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/process/hamali-types/${id}/update/`, {
        method: 'PUT',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['/api/process/hamali-types']);
      toast({
        title: "Success",
        description: "Hamali type updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingHamaliType(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update hamali type",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const token = AuthService.getAccessToken();
      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/process/hamali-types/${id}/delete/`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['/api/process/hamali-types']);
      toast({
        title: "Success",
        description: "Hamali type deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete hamali type",
        variant: "destructive",
      });
    },
  });

  // Extract hamali types data from response
  const allHamaliTypes = useMemo(() => {
    if (!data) return [];
    
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    } else if (Array.isArray(data)) {
      return data;
    } else {
      return [];
    }
  }, [data]);

  // Extract unique branches from the hamali types data
  const branches = useMemo(() => {
    if (!allHamaliTypes.length) return ["All"];
    
    const uniqueBranches = [...new Set(
      allHamaliTypes
        .map(hamaliType => hamaliType.branch_name)
        .filter(branch => branch && branch.trim() !== "")
    )];
    
    return ["All", ...uniqueBranches.sort()];
  }, [allHamaliTypes]);

  // Status options
  const statusOptions = ["All", "Active", "Inactive"];

  // Sorting function
  const sortedHamaliTypes = useMemo(() => {
    if (!allHamaliTypes.length) return [];
    
    const sorted = [...allHamaliTypes].sort((a, b) => {
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
  }, [allHamaliTypes, sortField, sortDirection]);

  // Filter hamali types based on search term, branch, and status
  const filteredHamaliTypes = useMemo(() => {
    let filtered = sortedHamaliTypes;

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(hamaliType =>
        (hamaliType.name && hamaliType.name.toLowerCase().includes(searchLower)) ||
        (hamaliType.branch_name && hamaliType.branch_name.toLowerCase().includes(searchLower)) ||
        (hamaliType.hamali_group?.name && hamaliType.hamali_group.name.toLowerCase().includes(searchLower)) ||
        (hamaliType.description && hamaliType.description.toLowerCase().includes(searchLower))
      );
    }

    // Filter by branch
    if (selectedBranch && selectedBranch !== "All") {
      filtered = filtered.filter(hamaliType => hamaliType.branch_name === selectedBranch);
    }

    // Filter by status
    if (selectedStatus && selectedStatus !== "All") {
      const isActive = selectedStatus === "Active";
      filtered = filtered.filter(hamaliType => hamaliType.is_active === isActive);
    }

    return filtered;
  }, [sortedHamaliTypes, searchTerm, selectedBranch, selectedStatus]);

  // Paginate filtered results
  const paginatedHamaliTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredHamaliTypes.slice(startIndex, endIndex);
  }, [filteredHamaliTypes, currentPage]);

  // Pagination calculations
  const totalItems = filteredHamaliTypes.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startItem = totalItems > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedHamaliGroup, selectedStatus, sortField, sortDirection]);

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading hamali types",
        description: error.message || "Failed to fetch hamali type data",
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
      description: "Fetching latest hamali type information...",
    });
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedBranch("All");
    setSelectedHamaliGroup("All");
    setSelectedStatus("All");
    setSortField("name");
    setSortDirection("asc");
  };

  const buildHamaliTypePayload = (data, { isUpdate = false } = {}) => {
    const payload = {
      name: data.name,
      description: data.description || "",
      branch: data.branch,
      is_active: data.is_active,
      per_unit_id: data.per_unit_id || null,
    };

    if (!isUpdate || (data.rate !== "" && data.rate != null)) {
      payload.rate = data.rate;
      payload.per_weight = data.per_weight || "1.00";
      payload.effective_from = data.effective_from;
    }

    if (isUpdate) {
      payload.hamali_group_id = data.hamali_group_id
        ? parseInt(data.hamali_group_id, 10)
        : null;
    } else if (data.hamali_group_id) {
      payload.hamali_group_id = parseInt(data.hamali_group_id, 10);
    }

    return payload;
  };

  const renderSearchableHamaliGroupSelect = ({
    id,
    value,
    onChange,
    placeholder = "Select hamali group",
    groups = [],
    open,
    setOpen,
    search,
    setSearch,
    includeNone = false,
    includeAll = false,
  }) => {
    const selectedLabel =
      includeAll && value === "All"
        ? "All"
        : includeNone && !value
          ? "None"
          : groups.find((group) => String(group.id) === String(value))?.name || placeholder;

    const filteredGroups = groups.filter((group) =>
      !search.trim()
        ? true
        : (group.name || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false} className="w-full">
            <CommandInput
              placeholder="Search hamali group..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="!max-h-[none] overflow-visible p-0">
              <CommandEmpty>No hamali group found.</CommandEmpty>
              <CommandGroup className="overflow-visible p-0">
                <div
                  className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                  style={{ minHeight: 0 }}
                  onWheel={(e) => e.stopPropagation()}
                >
                  {includeAll && (
                    <CommandItem
                      value="all-groups"
                      onSelect={() => {
                        onChange("All");
                        setOpen(false);
                        setSearch("");
                      }}
                      className="cursor-pointer"
                    >
                      <span className="font-medium">All</span>
                    </CommandItem>
                  )}
                  {includeNone && (
                    <CommandItem
                      value="none-group"
                      onSelect={() => {
                        onChange("");
                        setOpen(false);
                        setSearch("");
                      }}
                      className="cursor-pointer"
                    >
                      <span className="font-medium">None</span>
                    </CommandItem>
                  )}
                  {filteredGroups.map((group) => (
                    <CommandItem
                      key={group.id}
                      value={`${group.name}-${group.id}`}
                      onSelect={() => {
                        onChange(String(group.id));
                        setOpen(false);
                        setSearch("");
                      }}
                      className="cursor-pointer"
                    >
                      <span className="font-medium">{group.name}</span>
                    </CommandItem>
                  ))}
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const renderHamaliGroupSelect = (id, value, onChange, placeholder = "Select hamali group (optional)") =>
    renderSearchableHamaliGroupSelect({
      id,
      value: value || "",
      onChange,
      placeholder,
      groups: hamaliGroupsData,
      open: editHamaliGroupOpen,
      setOpen: setEditHamaliGroupOpen,
      search: editHamaliGroupSearch,
      setSearch: setEditHamaliGroupSearch,
      includeNone: true,
    });

  const API_BASE_URL = import.meta.env.VITE_BASE_URL;

  // PDF: Hamali Types List (header style from inward-details)
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      let orgName = getOrgInfoSync()?.organization || "";
      let branchFromOrg = getOrgInfoSync()?.branch || "";
      if (!orgName || !branchFromOrg) {
        const token = AuthService.getAccessToken();
        const fetched = await fetchOrgInfo(API_BASE_URL, token);
        orgName = fetched?.organization || orgName;
        branchFromOrg = fetched?.branch || branchFromOrg;
      }
      const pdfBranchName = selectedBranch && selectedBranch !== "All" ? selectedBranch : (branchFromOrg || "All Branches");
      let generatedBy = "";
      try {
        const userDataStr = localStorage.getItem("cp_manager_user_data");
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          generatedBy = userData?.name || "";
        }
      } catch (_) {}
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let currentY = margin;
      const checkPageBreak = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          return true;
        }
        return false;
      };
      const addLine = () => {
        checkPageBreak(5);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 5;
      };
      if (orgName) {
        checkPageBreak(8);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 64, 175);
        pdf.text(orgName, pageWidth / 2, currentY, { align: "center" });
        currentY += 6;
      }
      pdf.setFontSize(12);
      pdf.text(pdfBranchName, pageWidth / 2, currentY, { align: "center" });
      currentY += 8;
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      checkPageBreak(10);
      pdf.text("HAMALI TYPES LIST", pageWidth / 2, currentY, { align: "center" });
      currentY += 8;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(107, 114, 128);
      const subInfo = `Branch: ${pdfBranchName} | Generated by: ${generatedBy || "N/A"} | ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      pdf.text(subInfo, pageWidth / 2, currentY, { align: "center" });
      currentY += 6;
      addLine();
      const list = filteredHamaliTypes;
      const hasPerWeightColumn = list.some((row) => {
        const pw = row.current_rate_details?.per_weight;
        return pw != null && parseFloat(String(pw)) > 1;
      });
      const colWidths = hasPerWeightColumn ? [15, 70, 30, 26, 23, 22] : [12, 50, 38, 30, 50];
      const headers = hasPerWeightColumn ? ["SlNo", "Hamali Type", "Branch", "Rate", "Per Weight", "Per Unit"] : ["SLNO", "Hamali Type", "Branch", "Rate", "Per Unit"];
      const rowHeight = 8;
      checkPageBreak(rowHeight + 10);
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, currentY - 3, contentWidth, rowHeight, "F");
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, currentY - 3, contentWidth, rowHeight, "S");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      let cellX = margin;
      headers.forEach((h, i) => {
        pdf.line(cellX, currentY - 3, cellX, currentY + rowHeight - 3);
        pdf.text(h, cellX + 2, currentY + 2, { align: "left", maxWidth: colWidths[i] - 4 });
        cellX += colWidths[i];
      });
      pdf.line(cellX, currentY - 3, cellX, currentY + rowHeight - 3);
      currentY += rowHeight;
      pdf.setFont("helvetica", "normal");
      list.forEach((row, idx) => {
        checkPageBreak(rowHeight);
        const perWeightVal = row.current_rate_details?.per_weight;
        const perWeightNum = perWeightVal != null ? parseFloat(String(perWeightVal)) : 0;
        const perUnit = row.current_rate_details?.per_unit || "—";
        const rateStr = row.current_rate != null ? `${Number(row.current_rate).toFixed(2)}` : "—";
        const perWeightStr = hasPerWeightColumn ? (perWeightNum > 1 ? String(perWeightVal) : "1") : null;
        const rowData = [
          String(idx + 1),
          row.name || "—",
          row.branch_name || "—",
          rateStr,
          ...(hasPerWeightColumn ? [perWeightStr] : []),
          perUnit,
          
        ];
        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin, currentY - 2, contentWidth, rowHeight, "F");
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(margin, currentY - 2, contentWidth, rowHeight, "S");
        cellX = margin;
        rowData.forEach((val, i) => {
          pdf.line(cellX, currentY - 2, cellX, currentY + rowHeight - 2);
          const textLines = pdf.splitTextToSize(String(val ?? "—"), colWidths[i] - 4);

          // For Hamali Type column, allow up to two lines inside the same row height
          if (i === 1) {
            if (textLines[0]) {
              pdf.text(textLines[0], cellX + 2, currentY + 1.8, {
                align: "left",
                maxWidth: colWidths[i] - 4,
              });
            }
            if (textLines[1]) {
              pdf.text(textLines[1], cellX + 2, currentY + 4.8, {
                align: "left",
                maxWidth: colWidths[i] - 4,
              });
            }
          } else {
            pdf.text(textLines[0] || "—", cellX + 2, currentY + 2, {
              align: "left",
              maxWidth: colWidths[i] - 4,
            });
          }
          cellX += colWidths[i];
        });
        pdf.line(cellX, currentY - 2, cellX, currentY + rowHeight - 2);
        pdf.line(margin, currentY + rowHeight - 2, margin + contentWidth, currentY + rowHeight - 2);
        currentY += rowHeight;
      });
      pdf.save(`Hamali-Types-List-${pdfBranchName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      branch: "",
      rate: "",
      per_weight: "1.00",
      per_unit_id: "",
      hamali_group_id: "",
      effective_from: new Date().toISOString().split('T')[0],
      is_active: true
    });
    setGroupRateRows([]);
  };

  const handleCreateDialogOpenChange = (open) => {
    setIsCreateDialogOpen(open);
    if (!open) resetForm();
  };

  const updateGroupRate = (groupId, rate) => {
    setGroupRateRows((prev) =>
      prev.map((row) => (row.groupId === groupId ? { ...row, rate } : row))
    );
  };

  const removeGroupRateRow = (groupId) => {
    setGroupRateRows((prev) => prev.filter((row) => row.groupId !== groupId));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter hamali type name",
        variant: "destructive",
      });
      return;
    }

    if (!formData.branch) {
      toast({
        title: "Validation Error",
        description: "Please select a branch",
        variant: "destructive",
      });
      return;
    }

    const rowsWithRate = groupRateRows.filter(
      (row) => row.rate !== "" && row.rate != null && !Number.isNaN(parseFloat(row.rate))
    );

    if (rowsWithRate.length === 0) {
      toast({
        title: "Validation Error",
        description: "Enter a rate for at least one hamali group",
        variant: "destructive",
      });
      return;
    }

    const payloads = rowsWithRate.map((row) => {
      const payload = buildHamaliTypePayload(
        {
          ...formData,
          rate: row.rate,
          hamali_group_id: String(row.groupId),
        },
        { isUpdate: false }
      );
      return { ...payload, _groupName: row.groupName };
    });

    createMutation.mutate(payloads);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({
      id: editingHamaliType.id,
      formData: buildHamaliTypePayload(formData, { isUpdate: true }),
    });
  };

  const handleEdit = (hamaliType) => {
    setEditingHamaliType(hamaliType);
    setFormData({
      name: hamaliType.name || "",
      description: hamaliType.description || "",
      branch: hamaliType.branch ? String(hamaliType.branch) : "",
      rate: hamaliType.current_rate || "",
      per_weight: hamaliType.current_rate_details?.per_weight || "1.00",
      per_unit_id: hamaliType.current_rate_details?.per_unit_id ? String(hamaliType.current_rate_details.per_unit_id) : "",
      hamali_group_id: hamaliType.hamali_group?.id ? String(hamaliType.hamali_group.id) : "",
      effective_from: hamaliType.current_rate_details?.effective_from || new Date().toISOString().split('T')[0],
      is_active: hamaliType.is_active
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (hamaliType) => {
    setHamaliTypeToDelete(hamaliType);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (hamaliTypeToDelete) {
      deleteMutation.mutate(hamaliTypeToDelete.id);
      setDeleteConfirmOpen(false);
      setHamaliTypeToDelete(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
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
    return <CommonLoader text="Loading hamali type masters..." />;
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
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Hamali Type Masters</h1>
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
        )}

        {/* Main Content Area */}
        <div className="flex-1 p-2.5 sm:p-3 overflow-auto">
          {/* Page Header */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Hamali Type Masters</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-0.5 text-sm">
                  Manage and view all hamali types with rates across branches
                </p>
              </div>
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={generatePDF}
                    disabled={isGeneratingPDF || !filteredHamaliTypes.length}
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>{isGeneratingPDF ? "Generating..." : "Download PDF"}</span>
                  </Button>
                  {hasCreatePermission("hamali") && (
                    <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center space-x-2">
                          <Plus className="h-4 w-4" />
                          <span>Add Hamali Type</span>
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create New Hamali Type</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              placeholder="Enter hamali type name"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="branch">Branch *</Label>
                            <Select
                              value={formData.branch}
                              onValueChange={(value) => setFormData({ ...formData, branch: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                              <SelectContent>
                                {branchesData?.map((branch) => (
                                  <SelectItem key={branch.id} value={branch.id.toString()}>
                                    {branch.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder="Enter description"
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="per_weight">Per Weight</Label>
                            <Input
                              id="per_weight"
                              type="number"
                              step="0.01"
                              value={formData.per_weight}
                              onChange={(e) => setFormData({...formData, per_weight: e.target.value})}
                              placeholder="1.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="per_unit">Unit</Label>
                            <Select value={formData.per_unit_id} onValueChange={(value) => setFormData({...formData, per_unit_id: value})}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {unitsData?.map((unit) => (
                                  <SelectItem key={unit.id} value={unit.id.toString()}>
                                    {unit.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="effective_from">Effective From *</Label>
                            <Input
                              id="effective_from"
                              type="date"
                              value={formData.effective_from}
                              onChange={(e) => setFormData({...formData, effective_from: e.target.value})}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            Rates by Hamali Group
                          </Label>
                          <p className="text-xs text-gray-500">
                            {formData.branch
                              ? "Groups mapped to the selected branch are listed below. Enter a rate per group to create one hamali type entry for each."
                              : "Select a branch to load hamali groups, or all active groups will be shown."}
                          </p>
                          {isLoadingCreateGroups ? (
                            <div className="py-6 text-center text-sm text-gray-500">Loading hamali groups...</div>
                          ) : groupRateRows.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500 border rounded-md bg-gray-50">
                              No hamali groups found for this selection.
                            </div>
                          ) : (
                            <div className="border rounded-md overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                  <tr>
                                    <th className="text-left py-2 px-3 font-medium text-gray-700">Hamali Group</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-700">Branch</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-700 w-36">Rate *</th>
                                    <th className="text-center py-2 px-2 font-medium text-gray-700 w-14"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {groupRateRows.map((row) => (
                                    <tr key={row.groupId} className="border-b last:border-b-0">
                                      <td className="py-2 px-3 font-medium text-gray-900">{row.groupName}</td>
                                      <td className="py-2 px-3 text-gray-600">{row.branchName}</td>
                                      <td className="py-2 px-3">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={row.rate}
                                          onChange={(e) => updateGroupRate(row.groupId, e.target.value)}
                                          placeholder="Rate"
                                          className="h-9"
                                        />
                                      </td>
                                      <td className="py-2 px-2 text-center">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => removeGroupRateRow(row.groupId)}
                                          title="Remove this group"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => handleCreateDialogOpenChange(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createMutation.isPending || groupRateRows.length === 0}>
                            {createMutation.isPending ? "Creating..." : "Create"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filters Section */}
          <Card className={`mb-3 transition-all duration-300 ${isMobile ? '' : showFilters ? 'opacity-100' : 'opacity-100'}`}>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* Search Input */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Search Hamali Types
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
                    <Input
                      placeholder="Search by name, branch, group..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-8 h-9"
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
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Branch
                  </label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hamali Group Filter */}
                <div className="space-y-1 min-w-0">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Hamali Group
                  </label>
                  {renderSearchableHamaliGroupSelect({
                    id: "hamali-group-filter",
                    value: selectedHamaliGroup,
                    onChange: setSelectedHamaliGroup,
                    placeholder: "Select hamali group",
                    groups: hamaliGroupsData,
                    open: hamaliGroupFilterOpen,
                    setOpen: setHamaliGroupFilterOpen,
                    search: hamaliGroupFilterSearch,
                    setSearch: setHamaliGroupFilterSearch,
                    includeAll: true,
                  })}
                </div>

                {/* Status Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-9">
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
                  <div className="flex items-center space-x-2 h-9 px-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <Package className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {allHamaliTypes.length} hamali type{allHamaliTypes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(searchTerm || selectedBranch !== "All" || selectedHamaliGroup !== "All" || selectedStatus !== "All") && (
                <div className="mt-2.5 flex justify-start">
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

          {/* Hamali Types Table */}
          <Card>
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4" />
                  <span>Hamali Types List</span>
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
                      <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                        <tr className="border-b border-slate-300 dark:border-gray-600">
                          <th className="w-12 h-9 text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">#</th>
                          <th 
                            className="h-9 text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Name</span>
                              <span className="text-xs">{getSortIcon('name')}</span>
                            </div>
                          </th>
                          
                          <th className="h-9 text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3.5 w-3.5" />
                              <span>Hamali Group</span>
                            </div>
                          </th>
                          <th 
                            className="h-9 text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('branch_name')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Branch</span>
                              <span className="text-xs">{getSortIcon('branch_name')}</span>
                            </div>
                          </th>
                          
                          <th className="h-9 text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                            <div className="flex items-center space-x-1">

                              <span>Current Rate</span>
                            </div>
                          </th>

                          {/* <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                            <div className="flex items-center space-x-1">
                              <Scale className="h-4 w-4" />
                              <span>Per Weight</span>
                            </div>
                          </th> */}

                          {/* <th 
                            className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => handleSort('is_active')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Status</span>
                              <span className="text-xs">{getSortIcon('is_active')}</span>
                            </div>
                          </th> */}
                          
                          <th 
                            className="h-9 text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('created_at')}
                          >
                            <div className="flex items-center space-x-1">
                              
                              <span>Created On</span>
                              <span className="text-xs">{getSortIcon('created_at')}</span>
                            </div>
                          </th>
                          
                          <th className="h-9 text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                            Actions
                          </th>

                        </tr>
                      </thead>
                      <tbody>
                        {paginatedHamaliTypes.map((hamaliType, index) => (
                          <tr 
                            key={hamaliType.id || index} 
                            className="border-b border-slate-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-white">
                              {startItem + index}
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="font-medium text-sm text-gray-900 dark:text-white">
                                {hamaliType.name || 'N/A'}
                              </div>
                              {hamaliType.description && (
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 max-w-xs truncate" title={hamaliType.description}>
                                  {hamaliType.description}
                                </div>
                              )}
                            </td>
                            <td className="py-1.5 px-3">
                              <span className="text-sm text-gray-900 dark:text-white">
                                {hamaliType.hamali_group?.name || "—"}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {hamaliType.branch_name || 'N/A'}
                                </span>
                              </div>
                            </td>
                            
                            <td className="py-1.5 px-3">
                              <div className="flex items-center space-x-1">
                                {/* <IndianRupee className="h-4 w-4 text-green-600" /> */}
                                <span className="font-medium text-sm text-gray-900 dark:text-white">
                                  {hamaliType.current_rate ? `₹${hamaliType.current_rate}` : 'N/A'}
                                </span>
                              </div>
                              {hamaliType.current_rate_details?.per_weight && parseFloat(hamaliType.current_rate_details.per_weight) > 1 && (
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  per {hamaliType.current_rate_details.per_weight} {hamaliType.current_rate_details?.per_unit || 'unit'}
                                </div>
                              )}
                              {hamaliType.current_rate_details?.per_unit && (!hamaliType.current_rate_details?.per_weight || parseFloat(hamaliType.current_rate_details.per_weight) <= 1) && (
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  per {hamaliType.current_rate_details.per_unit}
                                </div>
                              )}
                            </td>
                            
                            {/* <td className="py-4 px-4">
                              <div className="flex items-center space-x-1">
                                <Hash className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-900 dark:text-white">
                                  {hamaliType.current_rate_details?.per_weight || '1.00'}
                                </span>
                              </div>
                            </td> */}
                            
                            {/* <td className="py-4 px-4">
                              <Badge
                                variant={hamaliType.is_active ? "default" : "secondary"}
                                className={`${
                                  hamaliType.is_active 
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                }`}
                              >
                                {hamaliType.is_active ? (
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
                            </td> */}
                            
                            <td className="py-1.5 px-3">
                              <span className="text-gray-900 dark:text-white text-xs">
                              {new Date(hamaliType.created_at).toLocaleDateString("en-GB").replace(/\//g, "-")}
                              </span>
                            </td>
                            
                            <td className="py-1.5 px-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(hamaliType)}
                                  className="h-7 w-7 p-0"
                                  disabled={!hasUpdatePermission("hamali") || updateMutation.isPending || deleteMutation.isPending}
                                >
                                  <Edit className="h-3.5 w-3.5" />

                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(hamaliType)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  disabled={!hasDeletePermission("hamali") || updateMutation.isPending || deleteMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />

                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
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
                  <Package className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                    {allHamaliTypes.length === 0 ? 'No hamali types available' : 'No hamali types found'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    {allHamaliTypes.length === 0 
                      ? "There are currently no hamali types in the system. Create your first hamali type to get started."
                      : (searchTerm || selectedBranch !== "All" || selectedHamaliGroup !== "All" || selectedStatus !== "All")
                        ? "No hamali types match your current search criteria. Try adjusting your filters or search terms."
                        : "No hamali types are currently available."
                    }
                  </p>
                  {(searchTerm || selectedBranch !== "All" || selectedHamaliGroup !== "All" || selectedStatus !== "All") && (
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
                  {allHamaliTypes.length === 0 && (
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

          {/* Edit Dialog */}
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                setEditHamaliGroupOpen(false);
                setEditHamaliGroupSearch("");
              }
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Hamali Type</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_name">Name *</Label>
                    <Input
                      id="edit_name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter hamali type name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_branch">Branch *</Label>
                    <Select value={formData.branch} onValueChange={(value) => setFormData({...formData, branch: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchesData?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit_hamali_group_id">Hamali Group</Label>
                    {renderHamaliGroupSelect(
                      "edit_hamali_group_id",
                      formData.hamali_group_id,
                      (value) => setFormData({ ...formData, hamali_group_id: value })
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit_description">Description</Label>
                  <Textarea
                    id="edit_description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_rate">New Rate</Label>
                    <Input
                      id="edit_rate"
                      type="number"
                      step="0.01"
                      value={formData.rate}
                      onChange={(e) => setFormData({...formData, rate: e.target.value})}
                      placeholder="Enter new rate (optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_per_weight">Per Weight</Label>
                    <Input
                      id="edit_per_weight"
                      type="number"
                      step="0.01"
                      value={formData.per_weight}
                      onChange={(e) => setFormData({...formData, per_weight: e.target.value})}
                      placeholder="Enter per weight"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_per_unit">Unit</Label>
                    <Select value={formData.per_unit_id} onValueChange={(value) => setFormData({...formData, per_unit_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {unitsData?.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id.toString()}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_effective_from">Effective From</Label>
                    <Input
                      id="edit_effective_from"
                      type="date"
                      value={formData.effective_from}
                      onChange={(e) => setFormData({...formData, effective_from: e.target.value})}
                    />
                  </div>
                </div>


                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete confirmation dialog */}
          <AlertDialog
            open={deleteConfirmOpen}
            onOpenChange={(open) => {
              setDeleteConfirmOpen(open);
              if (!open) setHamaliTypeToDelete(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Hamali Type</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{hamaliTypeToDelete?.name}&quot;? This will deactivate the hamali type and it will no longer appear in the list.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setHamaliTypeToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
