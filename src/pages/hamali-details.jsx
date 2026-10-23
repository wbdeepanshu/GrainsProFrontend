import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { 
  Menu, 
  ArrowLeft,
  FileText, 
  Calendar,
  Users,
  Weight,
  Package,
  DollarSign,
  MapPin,
  Truck,
  User,
  Building,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  UserCheck,
  AlertCircle,
  Search,
  Download
} from "lucide-react";
import { Check, ChevronsUpDown } from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

/** Parse numeric Qtl value from API (handles "60.00 Qtl" or raw decimals). */
function parseQtlNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Format Qtl for display in tables. */
function formatQtlDisplay(value) {
  const num = parseQtlNumber(value);
  return `${num.toFixed(2)} Qtl`;
}

function formatHamaliTypeCurrentRate(hamaliType) {
  if (!hamaliType || hamaliType.current_rate == null || hamaliType.current_rate === "") {
    return null;
  }
  const rate = Number(hamaliType.current_rate);
  if (Number.isNaN(rate)) return null;
  return `₹${rate.toFixed(2)}`;
}

export default function HamaliDetails() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState(false);
  const [hamaliGroupFilter, setHamaliGroupFilter] = useState("all");
  const [hamaliGroupDropdownOpen, setHamaliGroupDropdownOpen] = useState(false);
  const [isUpdateCompletionDialogOpen, setIsUpdateCompletionDialogOpen] = useState(false);
  const [selectedEntryForCompletion, setSelectedEntryForCompletion] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [isEditEntryDialogOpen, setIsEditEntryDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [isDeleteEntryDialogOpen, setIsDeleteEntryDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    hamali_type_id: "",
    voucher_no: "",
    remarks: "",
    vehicle_no: "",
    driver_name: "",
    total_labours_count: "",
    transfer_type: "FACTORY",
    from_location: "",
    to_location: "",
    start_time: "",
    end_time: "",
    is_completed: false,
    verified_by_id: "",
    verified_by_name: "",
    is_verified: false,
  });
  const [editStockItems, setEditStockItems] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [, params] = useRoute("/reports/hamali/:id");
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const entryId = params?.id;
  
  // Get user permissions
  const { 
    hasCreatePermission, 
    hasReadPermission, 
    hasUpdatePermission, 
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  // Fetch hamali entry details from API
  const { data: hamaliDetails, isLoading, error } = useQuery({
    queryKey: [`${API_BASE_URL}/api/process/get-hamali/${entryId}/`],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/process/get-hamali/${entryId}/`);
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!entryId,
  });

  // Fetch entry details for popup
  const { data: entryDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: [`${API_BASE_URL}/api/process/entry-details/${selectedEntryId}/`],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/process/entry-details/${selectedEntryId}/`);
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!selectedEntryId,
  });

  // Fetch entry details for edit dialog
  const { data: editEntryDetails, isLoading: isLoadingEditEntry } = useQuery({
    queryKey: [`${API_BASE_URL}/api/process/entry-details/${editingEntryId}/`],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/process/entry-details/${editingEntryId}/`);
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!editingEntryId && isEditEntryDialogOpen,
  });

  // Hamali types for hamali_type dropdown
  const { data: hamaliTypes } = useQuery({
    queryKey: [`${API_BASE_URL}/api/process/hamali-types/`],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/process/hamali-types/`);
      const data = await response.json();
      return data.data || data.results || [];
    },
  });

  // Hamali groups for the "Filter by Hamali Group" dropdown.
  // Sourced from the same global endpoint used by the Labour Management page so
  // every active group is selectable (not just the ones that already appear in
  // this day's entries).
  const { data: hamaliGroupsData = [] } = useQuery({
    queryKey: [`${API_BASE_URL}/api/hamali-groups/`],
    queryFn: async () => {
      try {
        const token = AuthService.getAccessToken();
        if (!token) throw new Error("No authentication token found");
        const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
        const response = await fetch(`${backendUrl}/api/hamali-groups/?is_active=true`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.data || [];
      } catch (err) {
        console.error("Error fetching hamali groups:", err);
        return [];
      }
    },
    enabled: AuthService.isAuthenticated(),
  });

  // Update hamali entry mutation (full edit)
  const updateHamaliEntryMutation = useMutation({
    mutationFn: async (body) => {
      const response = await apiRequest('PUT', `${API_BASE_URL}/api/process/hamali-entry/`, body);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Hamali entry updated successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({
        queryKey: [`${API_BASE_URL}/api/process/get-hamali/${entryId}/`],
        exact: false,
      });
      if (editingEntryId) {
        queryClient.invalidateQueries({
          queryKey: [`${API_BASE_URL}/api/process/entry-details/${editingEntryId}/`],
          exact: false,
        });
      }
      closeEditEntryDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update hamali entry",
        variant: "destructive",
      });
    },
  });

  // Delete hamali entry mutation
  const deleteHamaliEntryMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiRequest('DELETE', `${API_BASE_URL}/api/process/hamali-entry/`, { id });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Hamali entry deleted successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({
        queryKey: [`${API_BASE_URL}/api/process/get-hamali/${entryId}/`],
        exact: false,
      });
      setIsDeleteEntryDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete hamali entry",
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
        variant: "default",
      });
      // Invalidate and refetch the hamali details
      queryClient.invalidateQueries({
        queryKey: [`${API_BASE_URL}/api/process/get-hamali/${entryId}/`],
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

  const handleBack = () => {
    setLocation('/reports/hamali');
  };

  const handleViewDetails = (entryDetailId) => {
    setSelectedEntryId(entryDetailId);
    setIsDetailModalOpen(true);
  };

  const handleUpdateCompletion = (entry) => {
    setSelectedEntryForCompletion(entry);
    setIsUpdateCompletionDialogOpen(true);
  };

  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setIsEditEntryDialogOpen(true);
  };

  const closeEditEntryDialog = () => {
    setIsEditEntryDialogOpen(false);
    setEditingEntryId(null);
  };

  const handleDeleteEntry = (entry) => {
    setEntryToDelete(entry);
    setIsDeleteEntryDialogOpen(true);
  };

  const confirmDeleteEntry = () => {
    if (entryToDelete) {
      deleteHamaliEntryMutation.mutate(entryToDelete.id);
    }
  };

  const cancelDeleteEntry = () => {
    setIsDeleteEntryDialogOpen(false);
    setEntryToDelete(null);
  };

  // Prefill edit form when edit entry details load
  useEffect(() => {
    if (!editEntryDetails || !isEditEntryDialogOpen) return;
    setEditForm({
      hamali_type_id: editEntryDetails.hamali_type?.id ?? editEntryDetails.hamali_type_id ?? "",
      voucher_no: editEntryDetails.voucher_no ?? "",
      remarks: editEntryDetails.remarks ?? "",
      vehicle_no: editEntryDetails.vehicle_no ?? "",
      driver_name: editEntryDetails.driver_name ?? "",
      total_labours_count: editEntryDetails.total_labours_count ?? "",
      transfer_type: editEntryDetails.transfer_info?.type ?? editEntryDetails.transfer_type ?? "FACTORY",
      from_location: editEntryDetails.transfer_info?.from_location ?? editEntryDetails.from_location ?? "",
      to_location: editEntryDetails.transfer_info?.to_location ?? editEntryDetails.to_location ?? "",
      start_time: editEntryDetails.start_time ?? "",
      end_time: editEntryDetails.end_time ?? "",
      is_completed: editEntryDetails.status === "Completed" || editEntryDetails.is_completed === true,
      verified_by_id: editEntryDetails.verified_by_id ?? "",
      verified_by_name: editEntryDetails.verified_by ?? "",
      is_verified: editEntryDetails.is_verified === true,
    });
    const mappedStockItems = (editEntryDetails.stock_items || []).map((item) => ({
      id: item.id,
      item_name: item.item_name,
      item_name_id: item.item_name_id ?? item.item_id ?? item.id,
      packets_count: Number(item.packets_count) || 0,
      weight_per_packet: parseQtlNumber(item.weight_per_packet_raw ?? item.weight_per_packet),
      total_weight: parseQtlNumber(item.total_weight_raw ?? item.total_weight),
      item_remarks: item.item_remarks ?? "",
    }));
    setEditStockItems(mappedStockItems);
  }, [editEntryDetails, isEditEntryDialogOpen]);

  const handleEditFormChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStockItemChange = (index, field, value) => {
    setEditStockItems((prev) => {
      const items = [...prev];
      if (!items[index]) return prev;
      if (field === "packets_count" || field === "weight_per_packet" || field === "total_weight") {
        const num = value === "" ? "" : Number(value);
        items[index] = { ...items[index], [field]: Number.isNaN(num) ? 0 : num };
      } else {
        items[index] = { ...items[index], [field]: value };
      }
      // Auto-calc total_weight if packets_count or weight_per_packet changed and both > 0
      if (field === "packets_count" || field === "weight_per_packet") {
        const p = Number(items[index].packets_count) || 0;
        const w = Number(items[index].weight_per_packet) || 0;
        if (p > 0 && w > 0) {
          items[index].total_weight = parseFloat((p * w).toFixed(3));
        }
      }
      return items;
    });
  };

  const submitEditEntry = () => {
    if (!editEntryDetails || !editingEntryId) return;
    const stockItems = (editStockItems || []).map((item) => ({
      item_name_id: item.item_name_id,
      packets_count: Number(item.packets_count) || 0,
      weight_per_packet: parseFloat(item.weight_per_packet) || 0,
      total_weight: parseFloat(item.total_weight) || 0,
      item_remarks: item.item_remarks ?? "",
    }));
    const images = (editEntryDetails.images || []).map((img) => ({
      name: img.name ?? "image",
      image: img.image ?? img.image_url ?? "",
    }));
    const body = {
      id: Number(editingEntryId),
      hamali_type_id: Number(editForm.hamali_type_id || (editEntryDetails.hamali_type?.id ?? editEntryDetails.hamali_type_id)),
      transfer_type: editForm.transfer_type,
      from_location: editForm.from_location,
      to_location: editForm.to_location,
      vehicle_no: editForm.vehicle_no,
      driver_name: editForm.driver_name,
      total_labours_count: Number(editForm.total_labours_count) || 0,
      voucher_no: editForm.voucher_no,
      remarks: editForm.remarks,
      start_time: editForm.start_time,
      end_time: editForm.end_time,
      is_completed: Boolean(editForm.is_completed),
      verified_by: editForm.verified_by_id || "",
      is_verified: Boolean(editForm.is_verified),
      stock_items: stockItems,
      images: images,
    };
    updateHamaliEntryMutation.mutate(body);
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

  const handleClearFilters = () => {
    setSearchTerm("");
    setSupervisorFilter("all");
    setHamaliGroupFilter("all");
  };

  // Download Excel function
  const handleDownloadExcel = async () => {
    try {
      setIsDownloading(true);
      
      const response = await apiRequest('GET', `${API_BASE_URL}/api/process/get-hamali/${entryId}/?download=true`);
      const data = await response.json();
      
      if (data.status === 200 && data.download_url) {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = data.download_url;
        link.download = data.filename || 'hamali_entry_details.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Download Started",
          description: "Excel report is being downloaded...",
          className: "text-white",
          style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
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

  const getStatusBadge = (status) => {
    switch (status) {
      case "Completed":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
      case "In-Progress":
      return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
          In-Progress
        </Badge>
      );
      case "Verification Pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Verification Pending
        </Badge>
      );
      case "Pending":
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Clock className="h-3 w-3 mr-1" />
            {status || "Unknown"}
        </Badge>
      );
    }
  };

  if (isLoading) {
    return <Loader text="Loading Hamali details..." />;
  }

  if (!hamaliDetails) {
    return (
      <div className="app-layout bg-gray-50 items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Hamali details not found</p>
          <Button variant="outline" onClick={handleBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </div>
      </div>
    );
  }

  const { date, summary_stats, entry_details } = hamaliDetails;

  // Extract unique supervisors from entry_details
  const uniqueSupervisors = [...new Set(entry_details.map(entry => entry.supervised_by).filter(Boolean))];

  // Hamali groups for the filter dropdown:
  // 1) all active groups from /api/hamali-groups/ (so every group is selectable
  //    even if no entry yet references it),
  // 2) plus any group already present on the current day's entries (defensive
  //    fallback in case a referenced group is inactive / org-scoped differently).
  // Sorted alphabetically and deduped by name (filter is name-based).
  const uniqueHamaliGroups = (() => {
    const set = new Set();
    (hamaliGroupsData || []).forEach((g) => {
      if (g?.name) set.add(g.name);
    });
    entry_details.forEach((entry) => {
      if (entry.hamali_group?.name) set.add(entry.hamali_group.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  })();

  // Filter entries based on search term, supervisor filter and hamali-group filter
  const filteredEntries = entry_details.filter(entry => {
    // Search term filter
    const searchMatch = !searchTerm || (() => {
      const searchLower = searchTerm.toLowerCase();
      return (
        entry.voucher_no?.toLowerCase().includes(searchLower) ||
        entry.hamali_type.name.toLowerCase().includes(searchLower) ||
        entry.hamali_group?.name?.toLowerCase().includes(searchLower) ||
        entry.supervised_by?.toLowerCase().includes(searchLower) ||
        entry.verified_by?.toLowerCase().includes(searchLower)
      );
    })();

    // Supervisor filter
    const supervisorMatch = supervisorFilter === "all" || entry.supervised_by === supervisorFilter;

    // Hamali group filter
    const hamaliGroupMatch =
      hamaliGroupFilter === "all" || entry.hamali_group?.name === hamaliGroupFilter;

    return searchMatch && supervisorMatch && hamaliGroupMatch;
  });

  // Calculate filtered summary stats based on filtered entries
  const filteredSummaryStats = {
    total_details: filteredEntries.length,
    total_packets: filteredEntries.reduce((sum, entry) => sum + (parseInt(entry.total_packets) || 0), 0),
    total_weight: filteredEntries.reduce((sum, entry) => sum + (parseFloat(entry.total_weight) || 0), 0),
    total_amount: filteredEntries.reduce((sum, entry) => sum + (parseFloat(entry.hamali_amount) || 0), 0)
  };

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
            <p className="text-gray-600">You don't have permission to view hamali details.</p>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="mr-4 flex items-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-black to-gray-600 p-2 rounded-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              <div>
                  <h1 className="text-2xl font-bold text-gray-900">Hamali Details</h1>
                  <p className="text-sm text-gray-600">View detailed hamali entry information for {date}</p>
                </div>
              </div>
            </div>
            {/* Right Side Date Display and Download Button */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleDownloadExcel}
                disabled={isDownloading || isLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="h-4 w-4" />
                {isDownloading ? "Downloading..." : "Download Excel"}
              </Button>
              <Badge variant="outline" className="text-xs px-2 py-1 h-7">
                <Calendar className="h-3 w-3 mr-1" />
                {date}
              </Badge>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              {/* Search Section */}
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="search" className="text-sm font-medium text-gray-700">
                          Search Entries
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            id="search"
                            type="text"
                            placeholder="Search by voucher number, hamali type, hamali group, supervisor, or verifier..."
                            className="pl-10 h-11 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="w-full sm:w-64 space-y-2">
                        <Label htmlFor="supervisor-filter" className="text-sm font-medium text-gray-700">
                          Filter by Supervisor
                        </Label>
                        <Popover open={supervisorDropdownOpen} onOpenChange={setSupervisorDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={supervisorDropdownOpen}
                              className="w-full justify-between h-11 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                            >
                              <span className="truncate">
                                {supervisorFilter === "all" ? "All Supervisors" : supervisorFilter || "Select Supervisor"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start" side="bottom" sideOffset={4}>
                            <Command>
                              <CommandInput placeholder="Search supervisors..." />
                              <CommandList>
                                <CommandEmpty>
                                  {uniqueSupervisors.length === 0 ? "No supervisors found." : "No supervisors match your search."}
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    key="all"
                                    value="all"
                                    onSelect={() => {
                                      setSupervisorFilter("all");
                                      setSupervisorDropdownOpen(false);
                                    }}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${
                                          supervisorFilter === "all" ? "opacity-100 text-blue-600" : "opacity-0"
                                        }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">All Supervisors</div>
                                      </div>
                                    </div>
                                  </CommandItem>
                                  {uniqueSupervisors.map((supervisor) => (
                                    <CommandItem
                                      key={supervisor}
                                      value={supervisor}
                                      onSelect={() => {
                                        setSupervisorFilter(supervisor);
                                        setSupervisorDropdownOpen(false);
                                      }}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${
                                            supervisorFilter === supervisor ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">{supervisor}</div>
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

                      <div className="w-full sm:w-64 space-y-2">
                        <Label htmlFor="hamali-group-filter" className="text-sm font-medium text-gray-700">
                          Filter by Hamali Group
                        </Label>
                        <Popover open={hamaliGroupDropdownOpen} onOpenChange={setHamaliGroupDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={hamaliGroupDropdownOpen}
                              className="w-full justify-between h-11 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                            >
                              <span className="truncate">
                                {hamaliGroupFilter === "all"
                                  ? "All Hamali Groups"
                                  : hamaliGroupFilter || "Select Hamali Group"}
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
                              <CommandInput placeholder="Search hamali groups..." />
                              <CommandList>
                                <CommandEmpty>
                                  {uniqueHamaliGroups.length === 0
                                    ? "No hamali groups found."
                                    : "No hamali groups match your search."}
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    key="all"
                                    value="all"
                                    onSelect={() => {
                                      setHamaliGroupFilter("all");
                                      setHamaliGroupDropdownOpen(false);
                                    }}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${
                                          hamaliGroupFilter === "all" ? "opacity-100 text-blue-600" : "opacity-0"
                                        }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">All Hamali Groups</div>
                                      </div>
                                    </div>
                                  </CommandItem>
                                  {uniqueHamaliGroups.map((group) => (
                                    <CommandItem
                                      key={group}
                                      value={group}
                                      onSelect={() => {
                                        setHamaliGroupFilter(group);
                                        setHamaliGroupDropdownOpen(false);
                                      }}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${
                                            hamaliGroupFilter === group ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">{group}</div>
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

                      <div className="w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearFilters}
                          className="text-gray-600 hover:text-gray-900 h-11 w-full sm:w-auto"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
                          
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Details</CardTitle>
                    <FileText className="h-4 w-4 text-gray-400" />
                </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{filteredSummaryStats.total_details}</div>
                    {(supervisorFilter !== "all" || hamaliGroupFilter !== "all") && (
                      <p className="text-xs text-gray-500 mt-1">
                        of {summary_stats.total_details} total
                      </p>
                    )}
                </CardContent>
              </Card>
              
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Packets</CardTitle>
                    <Package className="h-4 w-4 text-gray-400" />
                </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{filteredSummaryStats.total_packets}</div>
                    {(supervisorFilter !== "all" || hamaliGroupFilter !== "all") && (
                      <p className="text-xs text-gray-500 mt-1">
                        of {summary_stats.total_packets} total
                      </p>
                    )}
                </CardContent>
              </Card>
              
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Weight</CardTitle>
                    <Weight className="h-4 w-4 text-gray-400" />
                </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{(Math.floor(filteredSummaryStats.total_weight * 100) / 100).toFixed(2)}</div>
                    {(supervisorFilter !== "all" || hamaliGroupFilter !== "all") && (
                      <p className="text-xs text-gray-500 mt-1">
                        of {summary_stats.total_weight} total
                      </p>
                    )}
                </CardContent>
              </Card>
              
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Amount</CardTitle>
                    <span className="text-gray-400">₹</span>

                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">₹{parseFloat(filteredSummaryStats.total_amount).toLocaleString()}</div>
                    {(supervisorFilter !== "all" || hamaliGroupFilter !== "all") && (
                      <p className="text-xs text-gray-500 mt-1">
                        of ₹{parseFloat(summary_stats.total_amount).toLocaleString()} total
                      </p>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* Entry Details */}
              <Card className="shadow-sm border border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Entry Details</span>
                    <Badge variant="secondary" className="ml-2">
                      {filteredEntries.length} entries
                  </Badge>
                </CardTitle>
              </CardHeader>
                <CardContent>
                  {filteredEntries.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-semibold text-gray-900">No entries found</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        No entries match your current search.
                      </p>
                    </div>
                  ) : (
                <div className="space-y-3">
                      {filteredEntries.map((entry) => (
                 <Card
                 key={entry.id}
                          className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white"
               >
                          <CardContent className="p-4">
                   {/* First Row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                              <div className="space-y-1">
                       <span className="text-xs font-medium text-gray-500">Voucher Number</span>
                                <p className="text-sm font-semibold text-gray-900">
                         {entry.voucher_no || "Not Specified"}
                       </p>
                       {entry.voucher_type && entry.voucher_type !== "NA" && (
                          <p className="text-sm font-semibold text-gray-900">
                            {entry.voucher_type}
                          </p>
                        )}
                     </div>
                              <div className="space-y-1">
                       <span className="text-xs font-medium text-gray-500">Hamali Type</span>
                                <p className="text-sm font-semibold text-gray-900">{entry.hamali_type.name}</p>
                                {entry.hamali_group?.name && (
                                  <p className="text-xs text-gray-500">
                                    <span className="font-medium text-gray-500">Group:</span>{" "}
                                    <span className="text-gray-700 font-medium">{entry.hamali_group.name}</span>
                                  </p>
                                )}
                     </div>
                              <div className="space-y-1">
                       <span className="text-xs font-medium text-gray-500">
                         Supervised By / Verified By
                       </span>
                                <p className="text-sm flex items-center text-gray-900">
                         <User className="h-3 w-3 mr-1" />
                         {entry.supervised_by} / {entry.verified_by || "Not Verified"}
                       </p>
                     </div>
                              <div className="space-y-1">
                       <span className="text-xs font-medium text-gray-500">Status</span>
                       <div>{getStatusBadge(entry.status)}</div>
                     </div>                     
                   </div>
               
                   {/* Second Row */}
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between border-t border-gray-200 pt-3">
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 flex-1 min-w-0">
                     {/* <div>
                       <span className="text-xs font-medium text-gray-500">Labour Count</span>
                                <p className="text-sm font-semibold text-gray-900">{entry.labour_count}</p>
                     </div> */}
                     <div className="min-w-0 space-y-1">
                       <span className="text-xs font-medium text-gray-500">Total Packets</span>
                                <p className="text-sm font-semibold text-gray-900">{entry.total_packets}</p>
                     </div>
                     <div className="min-w-0 space-y-1">
                       <span className="text-xs font-medium text-gray-500">Total Weight</span>
                                <p className="text-sm font-semibold text-gray-900">{entry.total_weight}</p>
                     </div>
                     <div className="min-w-0 space-y-1">
                       <span className="text-xs font-medium text-gray-500">Hamali Amount</span>
                       <p className="text-sm font-semibold text-green-600">
                         ₹{parseFloat(entry.hamali_amount).toLocaleString()}
                       </p>
                     </div>
                     <div className="min-w-0 space-y-1">
                       <span className="text-xs font-medium text-gray-500">Applied Rate</span>
                                <p className="text-sm font-semibold text-gray-900 break-words">
                         ₹{entry.applied_rate}
                       </p>
                     </div>
                     <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                       <span className="text-xs font-medium text-gray-500">Entry Time</span>
                                <p
                                  className="text-sm font-semibold text-gray-900 break-words leading-snug"
                                  title={entry.created_at}
                                >
                         {entry.created_at}
                       </p>
                     </div>
                     </div>

                     {/* Button + Images */}
                     <div className="flex items-center justify-end gap-3 flex-shrink-0 flex-wrap">
                       {entry.images && entry.images.length > 0 && (
                         <div className="flex items-center text-xs text-gray-500">
                           <ImageIcon className="h-3 w-3 mr-1" />
                           <span>
                             {entry.images.length} image
                             {entry.images.length > 1 ? "s" : ""}
                           </span>
                         </div>
                       )}
                       <Button
                                  variant="outline"
                         size="sm"
                         onClick={() => handleViewDetails(entry.id)}
                                  className="hover:bg-black hover:text-white"
                       >
                                  <Eye className="h-4 w-4 mr-1" />
                         
                       </Button>
                       {hasUpdatePermission("hamali") && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleEditEntry(entry)}
                           className="hover:bg-blue-600 hover:text-white border-blue-600 text-blue-600"
                         >
                           <Pencil className="h-4 w-4 mr-1" />                           
                         </Button>
                       )}
                       {hasDeletePermission("hamali") && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleDeleteEntry(entry)}
                           disabled={deleteHamaliEntryMutation.isPending}
                           className="hover:bg-red-600 hover:text-white border-red-600 text-red-600"
                         >
                           <Trash2 className="h-4 w-4 mr-1" />
                         </Button>
                       )}
                       {entry.status === "In-Progress" && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleUpdateCompletion(entry)}
                           disabled={updateCompletionMutation.isPending}
                           className="hover:bg-green-600 hover:text-white border-green-600 text-green-600"
                         >
                           <CheckCircle className="h-4 w-4 mr-1" />
                           {updateCompletionMutation.isPending ? "Updating..." : "Mark Complete"}
                         </Button>
                       )}
                     </div>
                   </div>
                 </CardContent>
               </Card>

                  ))}
                </div>
                  )}
              </CardContent>
            </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Entry Details Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hamali Entry Details</DialogTitle>
            <div className="border-b border-gray-300 my-2"></div>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader text="Loading entry details..." />
            </div>
          ) : entryDetails ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  {/* <span className="text-sm font-medium text-gray-500">Voucher Number / Voucher Type</span> */}
                  <p className="text-sm font-semibold">{entryDetails.voucher_no} / {entryDetails.voucher_type}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">Supervisor:</span>
                  <p className="text-sm font-semibold flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {entryDetails.supervised_by}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Verified By</span>
                  <p className="text-sm font-semibold flex items-center">
                    <UserCheck className="h-3 w-3 mr-1" />
                    {entryDetails.verified_by || "Not Verified"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Status</span>
                  <div className="mt-1">
                    {getStatusBadge(entryDetails.status)}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Hamali Type</span>
                  <p className="text-sm">{entryDetails.hamali_type?.name || "—"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Hamali Group</span>
                  <p className="text-sm font-semibold">
                    {entryDetails.hamali_group?.name || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Applied Rate</span>
                  <p className="text-sm">{entryDetails.applied_rate}</p>
                </div>
                {(entryDetails.driver_name || entryDetails.vehicle_no) && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Driver & Vehicle</span>
                    <div className="mt-1 flex items-start gap-2">
                      <Truck className="h-4 w-4 mt-0.5 text-gray-500 shrink-0" />
                      <div className="text-sm space-y-1">
                        {entryDetails.driver_name ? (
                          <p className="font-medium">{entryDetails.driver_name}</p>
                        ) : null}
                        {entryDetails.vehicle_no ? (
                          <p className="text-gray-700">{entryDetails.vehicle_no}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="border-t pt-4">
                <h4 className="text-lg font-semibold mb-3">Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                    {/* <Package className="h-6 w-6 mx-auto mb-1 text-gray-600" /> */}
                    <p className="text-xl font-bold text-gray-900">{entryDetails.total_packets}</p>
                    <p className="text-sm text-gray-600">Total Packets</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                    {/* <Weight className="h-6 w-6 mx-auto mb-1 text-gray-600" /> */}
                    <p className="text-xl font-bold text-gray-900">{entryDetails.total_weight_display}</p>
                    <p className="text-sm text-gray-600">Total Weight</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                    {/* <DollarSign className="h-6 w-6 mx-auto mb-1 text-gray-600" /> */}
                    <p className="text-xl font-bold text-gray-900">₹{parseFloat(entryDetails.hamali_amount).toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Hamali Amount</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                    {/* <Users className="h-6 w-6 mx-auto mb-1 text-gray-600" /> */}
                    <p className="text-xl font-bold text-gray-900">{entryDetails.total_labours_count}</p>
                    <p className="text-sm text-gray-600">Labour Count</p>
                  </div>
                </div>
              </div>

              {/* Stock Items */}
              <div className="border-t pt-4">
                <h4 className="text-lg font-semibold mb-3">Stock Items</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-center">Packets</TableHead>
                        <TableHead className="text-center">Weight/Packet</TableHead>
                        <TableHead className="text-center">Total Weight</TableHead>
                        <TableHead className="text-center">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entryDetails.stock_items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-center">{item.packets_count}</TableCell>
                          <TableCell className="text-center">
                            {formatQtlDisplay(item.weight_per_packet_raw ?? item.weight_per_packet)}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {formatQtlDisplay(item.total_weight_raw ?? item.total_weight)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-gray-500">{item.created_at}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Images */}
              {entryDetails.images && entryDetails.images.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-semibold mb-3 flex items-center">
                    <ImageIcon className="h-5 w-5 mr-2" />
                    Images ({entryDetails.images.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {entryDetails.images.map((image, index) => (
                      <div key={image.id || index} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="aspect-video bg-gray-100 flex items-center justify-center">
                          <img
                            src={image.image_url}
                            alt={image.name || `Image ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(image.image_url, '_blank')}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-full items-center justify-center bg-gray-100">
                            <div className="text-center text-gray-500">
                              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                              <p className="text-sm">Image not available</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 bg-white">
                          <p className="text-sm font-medium text-gray-900">{image.name || `Image ${index + 1}`}</p>
                          <p className="text-xs text-gray-500">{image.created_at}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {entryDetails.remarks && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-semibold mb-2">Remarks</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{entryDetails.remarks || "-"}</p>
                </div>
              )}

              {/* Work Description */}
              {entryDetails.work_description && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-semibold mb-2">Work Description</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{entryDetails.work_description}</p>
                </div>
              )}

              <div className="border-t pt-4 text-xs text-gray-500">
                
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Entry details not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Completion Dialog */}
      <Dialog open={isUpdateCompletionDialogOpen} onOpenChange={setIsUpdateCompletionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Entry as Complete</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this hamali entry as completed? This will set the end time to the current time.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEntryForCompletion && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900">Entry Details:</h4>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p><strong>Voucher:</strong> {selectedEntryForCompletion.voucher_no || "Not Specified"}</p>
                  <p><strong>Hamali Type:</strong> {selectedEntryForCompletion.hamali_type?.name}</p>
                  <p><strong>Current Status:</strong> {selectedEntryForCompletion.status}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelUpdateCompletion}
              disabled={updateCompletionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmUpdateCompletion}
              disabled={updateCompletionMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateCompletionMutation.isPending ? "Updating..." : "Mark Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={isEditEntryDialogOpen} onOpenChange={(open) => !open && closeEditEntryDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Hamali Entry</DialogTitle>
            <DialogDescription>Update entry details and submit to save.</DialogDescription>
          </DialogHeader>

          {isLoadingEditEntry ? (
            <div className="flex items-center justify-center py-8">
              <Loader text="Loading entry..." />
            </div>
          ) : editEntryDetails ? (
            <div className="space-y-6">
              {/* Header fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-hamali_type">Hamali Type</Label>
                  <Select
                    value={String(editForm.hamali_type_id || "")}
                    onValueChange={(value) => handleEditFormChange("hamali_type_id", value)}
                  >
                    <SelectTrigger id="edit-hamali_type">
                      <SelectValue placeholder={editEntryDetails.hamali_type?.name || "Select hamali type"} />
                    </SelectTrigger>
                    <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                      {(hamaliTypes || []).map((ht) => {
                        const rateLabel = formatHamaliTypeCurrentRate(ht);
                        return (
                          <SelectItem
                            key={ht.id}
                            value={String(ht.id)}
                            textValue={ht.name || ""}
                            className="pr-3"
                          >
                            <span className="flex w-full items-center justify-between gap-3">
                              <span className="truncate">{ht.name}</span>
                              {rateLabel ? (
                                <span className="text-xs text-gray-500 shrink-0">{rateLabel}</span>
                              ) : null}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-voucher_no">Voucher Number</Label>
                  <Input
                    id="edit-voucher_no"
                    value={editForm.voucher_no}
                    onChange={(e) => handleEditFormChange("voucher_no", e.target.value)}
                    placeholder="VOUCH-001"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-transfer_type">Transfer Type</Label>
                  <Input
                    id="edit-transfer_type"
                    value={editForm.transfer_type}
                    onChange={(e) => handleEditFormChange("transfer_type", e.target.value)}
                    placeholder="FACTORY"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-from_location">From Location</Label>
                  <Input
                    id="edit-from_location"
                    value={editForm.from_location}
                    onChange={(e) => handleEditFormChange("from_location", e.target.value)}
                    placeholder="Warehouse A"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-to_location">To Location</Label>
                  <Input
                    id="edit-to_location"
                    value={editForm.to_location}
                    onChange={(e) => handleEditFormChange("to_location", e.target.value)}
                    placeholder="Warehouse B"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-vehicle_no">Vehicle Number</Label>
                  <Input
                    id="edit-vehicle_no"
                    value={editForm.vehicle_no}
                    onChange={(e) => handleEditFormChange("vehicle_no", e.target.value)}
                    placeholder="MH12AB1234"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-driver_name">Driver Name</Label>
                  <Input
                    id="edit-driver_name"
                    value={editForm.driver_name}
                    onChange={(e) => handleEditFormChange("driver_name", e.target.value)}
                    placeholder="Driver Name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-total_labours_count">Total Labours Count</Label>
                  <Input
                    id="edit-total_labours_count"
                    type="number"
                    min={0}
                    value={editForm.total_labours_count}
                    onChange={(e) => handleEditFormChange("total_labours_count", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-start_time">Start Time</Label>
                  <Input
                    id="edit-start_time"
                    value={editForm.start_time}
                    onChange={(e) => handleEditFormChange("start_time", e.target.value)}
                    placeholder="09:00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-end_time">End Time</Label>
                  <Input
                    id="edit-end_time"
                    value={editForm.end_time}
                    onChange={(e) => handleEditFormChange("end_time", e.target.value)}
                    placeholder="17:30"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="edit-remarks">Remarks</Label>
                  <Input
                    id="edit-remarks"
                    value={editForm.remarks}
                    onChange={(e) => handleEditFormChange("remarks", e.target.value)}
                    placeholder="Updated remarks text"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-is_completed"
                    checked={editForm.is_completed}
                    onChange={(e) => handleEditFormChange("is_completed", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="edit-is_completed">Completed</Label>
                </div>
                <div>
                  <Label htmlFor="edit-verified_by">Verified By</Label>
                  <Input
                    id="edit-verified_by"
                    readOnly
                    value={editForm.verified_by_name || "Not verified"}
                    className="bg-gray-50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-is_verified"
                    checked={editForm.is_verified}
                    onChange={(e) => handleEditFormChange("is_verified", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="edit-is_verified">Verified</Label>
                </div>
              </div>

              {/* Stock items editor */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Stock Items
                </h4>
                {editStockItems.length === 0 ? (
                  <p className="text-xs text-gray-500">No stock items on this entry.</p>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="w-1/3">Item</TableHead>
                          <TableHead className="text-center">Packets</TableHead>
                          <TableHead className="text-center">Weight / Packet</TableHead>
                          <TableHead className="text-center">Total Weight (Qtl)</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editStockItems.map((item, idx) => (
                          <TableRow key={item.id || idx}>
                            <TableCell className="text-sm font-medium">{item.item_name}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                value={item.packets_count}
                                onChange={(e) => handleStockItemChange(idx, "packets_count", e.target.value)}
                                className="h-8 text-sm text-center"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                step="0.001"
                                value={item.weight_per_packet}
                                onChange={(e) => handleStockItemChange(idx, "weight_per_packet", e.target.value)}
                                className="h-8 text-sm text-center"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                step="0.001"
                                value={item.total_weight}
                                onChange={(e) => handleStockItemChange(idx, "total_weight", e.target.value)}
                                className="h-8 text-sm text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.item_remarks}
                                onChange={(e) => handleStockItemChange(idx, "item_remarks", e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Remarks"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Weights are in Qtl. Changing packets or weight per packet recalculates total weight for each row.
                </p>
              </div>
            </div>
          ) : editingEntryId ? (
            <div className="text-center py-8 text-gray-500">Entry not found.</div>
          ) : null}

          {editEntryDetails && (
            <DialogFooter>
              <Button variant="outline" onClick={closeEditEntryDialog} disabled={updateHamaliEntryMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={submitEditEntry}
                disabled={updateHamaliEntryMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateHamaliEntryMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Entry Confirmation Dialog */}
      <Dialog open={isDeleteEntryDialogOpen} onOpenChange={(open) => !open && cancelDeleteEntry()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Hamali Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this hamali entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {entryToDelete && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm text-gray-600">
              <p><strong>Voucher:</strong> {entryToDelete.voucher_no || "Not Specified"}</p>
              <p><strong>Hamali Type:</strong> {entryToDelete.hamali_type?.name}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelDeleteEntry}
              disabled={deleteHamaliEntryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteEntry}
              disabled={deleteHamaliEntryMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteHamaliEntryMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}