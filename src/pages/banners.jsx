import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
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
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { cn } from "../lib/utils";
import {
  Menu,
  Search,
  Eye,
  Image as ImageIcon,
  Loader2,
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  X,
  Upload,
  CheckCircle,
  XCircle,
  Calendar,
  CalendarIcon,
  Building,
  MapPin,
  Users,
  Tag,
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import ZoomImageViewerDialog from "../components/common/ZoomImageViewerDialog";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

/** Parse form datetime value (`yyyy-MM-dd'T'HH:mm` or ISO) to a Date. */
const parseBannerDateTime = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // datetime-local style
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  try {
    const d = parseISO(raw);
    return isValid(d) ? d : null;
  } catch {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
};

const toBannerDateTimeValue = (date, time = "00:00") => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const datePart = format(date, "yyyy-MM-dd");
  const timePart = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${datePart}T${timePart}`;
};

/** Navbar-style calendar for date + always-visible hour/minute (works inside Dialog). */
function BannerDateTimeField({
  id,
  value,
  onChange,
  placeholder = "Select date & time",
}) {
  const [open, setOpen] = useState(false);
  const selected = parseBannerDateTime(value);
  const hourValue = selected ? format(selected, "HH") : "00";
  const minuteValue = selected ? format(selected, "mm") : "00";
  const timeValue = `${hourValue}:${minuteValue}`;

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  const handleDateSelect = (date) => {
    if (!date) {
      onChange("");
      return;
    }
    onChange(toBannerDateTimeValue(date, timeValue));
    setOpen(false);
  };

  const handleHourChange = (hour) => {
    const baseDate = selected || new Date();
    onChange(toBannerDateTimeValue(baseDate, `${hour}:${minuteValue}`));
  };

  const handleMinuteChange = (minute) => {
    const baseDate = selected || new Date();
    onChange(toBannerDateTimeValue(baseDate, `${hourValue}:${minute}`));
  };

  return (
    <div className="space-y-2">
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full h-10 justify-start text-left font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">
              {selected ? format(selected, "dd-MM-yyyy") : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 z-[200]"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
        >
          <CalendarComponent
            mode="single"
            selected={selected || undefined}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-2">
        <Label htmlFor={`${id}-hour`} className="text-xs text-gray-600 shrink-0 w-10">
          Time
        </Label>
        <Select value={hourValue} onValueChange={handleHourChange}>
          <SelectTrigger id={`${id}-hour`} className="h-9 flex-1 bg-white">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className="z-[220] max-h-48">
            {hours.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm font-semibold text-gray-600">:</span>
        <Select value={minuteValue} onValueChange={handleMinuteChange}>
          <SelectTrigger id={`${id}-minute`} className="h-9 flex-1 bg-white" aria-label={`${id}-minute`}>
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent className="z-[220] max-h-48">
            {minutes.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function Banners() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [bannerZoomImage, setBannerZoomImage] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [bannerTypeFilter, setBannerTypeFilter] = useState("all");
  const [isLiveFilter, setIsLiveFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get user permissions
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  // Form state
  const [formData, setFormData] = useState({
    banner_type: "",
    branch_id: "none",
    is_live: true,
    roles: [],
    business_type: [],
    state: "",
    city: "",
    start_date: "",
    end_date: "",
    image: null,
  });

  // Build query parameters for API call
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('per_page', pageSize.toString());
    if (bannerTypeFilter && bannerTypeFilter !== 'all') params.append('banner_type', bannerTypeFilter);
    if (isLiveFilter && isLiveFilter !== 'all') params.append('is_live', isLiveFilter);
    return params.toString();
  };

  // Fetch banners from API
  const { data: bannersData, isLoading, error, refetch } = useQuery({
    queryKey: ['banners', bannerTypeFilter, isLiveFilter, currentPage],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/growth/banners/${queryParams ? `?${queryParams}` : ''}`;
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken() && hasReadPermission("banners"),
    refetchOnWindowFocus: false,
  });

  // Fetch branches for dropdown
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-branches/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Auto-select first branch when create modal opens
  useEffect(() => {
    if (isCreateModalOpen && branchesData && branchesData.length > 0) {
      setFormData(prev => {
        // Only update if branch_id is "none" (not already set)
        if (prev.branch_id === "none") {
          return {
            ...prev,
            branch_id: branchesData[0].id.toString()
          };
        }
        return prev;
      });
    }
  }, [isCreateModalOpen, branchesData]);

  // Fetch roles for dropdown
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/`);
      const data = await response.json();
      // Extract unique roles
      const rolesMap = new Map();
      (data.data || []).forEach(user => {
        if (user.role_id && user.role_name) {
          if (!rolesMap.has(user.role_id)) {
            rolesMap.set(user.role_id, { id: user.role_id, name: user.role_name });
          }
        }
      });
      return Array.from(rolesMap.values());
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch business types for dropdown
  const { data: businessTypesData } = useQuery({
    queryKey: ['business-types'],
    queryFn: async () => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/growth/get-list/`, {
        names: ['business_types']
      });
      const data = await response.json();
      return data.data?.business_types || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const banners = bannersData?.data || [];
  const totalCount = bannersData?.pagination?.total_count || 0;
  const totalPages = bannersData?.pagination?.total_pages || 1;
  const hasNext = bannersData?.pagination?.has_next || false;
  const hasPrevious = bannersData?.pagination?.has_previous || false;

  // Filter banners by search term
  const filteredBanners = useMemo(() => {
    if (!searchTerm) return banners;
    const searchLower = searchTerm.toLowerCase();
    return banners.filter(banner =>
      banner.banner_type?.toLowerCase().includes(searchLower) ||
      banner.branch_name?.toLowerCase().includes(searchLower) ||
      banner.state?.toLowerCase().includes(searchLower) ||
      banner.city?.toLowerCase().includes(searchLower)
    );
  }, [banners, searchTerm]);

  // Convert image file to base64
  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle image selection
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image size should be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Reset form
  const resetForm = () => {
    // Auto-select first branch if available
    const defaultBranchId = branchesData && branchesData.length > 0
      ? branchesData[0].id.toString()
      : "none";

    setFormData({
      banner_type: "",
      branch_id: defaultBranchId,
      is_live: true,
      roles: [],
      business_type: [],
      state: "",
      city: "",
      start_date: "",
      end_date: "",
      image: null,
    });
    setImagePreview(null);
    setImageFile(null);
  };

  // Handle create
  const handleCreate = () => {
    resetForm(); // resetForm already auto-selects first branch
    setIsCreateModalOpen(true);
  };

  // Handle edit
  const handleEdit = (banner) => {
    setFormData({
      banner_type: banner.banner_type || "",
      branch_id: banner.branch ? banner.branch.toString() : "none",
      is_live: banner.is_live ?? true,
      roles: banner.roles?.map(r => r.id) || [],
      business_type: banner.business_type?.map(bt => bt.id) || [],
      state: banner.state || "",
      city: banner.city || "",
      start_date: banner.start_date ? format(new Date(banner.start_date), "yyyy-MM-dd'T'HH:mm") : "",
      end_date: banner.end_date ? format(new Date(banner.end_date), "yyyy-MM-dd'T'HH:mm") : "",
      image: null,
    });
    setImagePreview(banner.image_url || null);
    setImageFile(null);
    setSelectedBanner(banner);
    setIsEditModalOpen(true);
  };

  // Handle delete
  const handleDelete = (banner) => {
    setBannerToDelete(banner);
    setIsDeleteModalOpen(true);
  };

  // Create banner mutation
  const createBannerMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/growth/banners/upload/`, data);
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: "Banner uploaded successfully",
          variant: "success",
        });
        resetForm();
        setIsCreateModalOpen(false);
        queryClient.invalidateQueries(['banners']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to upload banner",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Create banner error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload banner",
        variant: "destructive",
      });
    },
  });

  // Update banner mutation
  const updateBannerMutation = useMutation({
    mutationFn: async ({ bannerId, data }) => {
      const response = await apiRequest('PUT', `${API_BASE_URL}/api/growth/banners/${bannerId}/update/`, data);
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: "Banner updated successfully",
          variant: "success",
        });
        resetForm();
        setIsEditModalOpen(false);
        setSelectedBanner(null);
        queryClient.invalidateQueries(['banners']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update banner",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Update banner error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update banner",
        variant: "destructive",
      });
    },
  });

  // Delete banner mutation
  const deleteBannerMutation = useMutation({
    mutationFn: async (bannerId) => {
      const response = await apiRequest('DELETE', `${API_BASE_URL}/api/growth/banners/${bannerId}/delete/`);
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: "Banner deleted successfully",
          variant: "success",
        });
        setIsDeleteModalOpen(false);
        setBannerToDelete(null);
        queryClient.invalidateQueries(['banners']);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete banner",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Delete banner error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete banner",
        variant: "destructive",
      });
    },
  });

  // Handle form submit (create)
  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!formData.banner_type.trim()) {
      toast({
        title: "Validation Error",
        description: "Banner type is required",
        variant: "destructive",
      });
      return;
    }

    if (!imageFile && !imagePreview) {
      toast({
        title: "Validation Error",
        description: "Please select an image",
        variant: "destructive",
      });
      return;
    }

    try {
      let imageBase64 = null;
      if (imageFile) {
        // Convert file to base64 - backend will handle data URL prefix removal
        imageBase64 = await convertImageToBase64(imageFile);
      } else if (imagePreview && !imagePreview.startsWith('data:')) {
        // If it's already a URL, we can't update without new image
        toast({
          title: "Validation Error",
          description: "Please select a new image to update",
          variant: "destructive",
        });
        return;
      } else if (imagePreview && imagePreview.startsWith('data:')) {
        // Use the base64 data URL - backend will extract the base64 part
        imageBase64 = imagePreview;
      }

      const submitData = {
        banner_type: formData.banner_type,
        branch_id: formData.branch_id && formData.branch_id !== "none" ? formData.branch_id : null,
        is_live: formData.is_live,
        roles: formData.roles,
        business_type: formData.business_type,
        state: formData.state || "",
        city: formData.city || "",
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        image: imageBase64, // Send base64 (backend handles data URL prefix removal)
      };

      await createBannerMutation.mutateAsync(submitData);
    } catch (error) {
      console.error("Submit error:", error);
    }
  };

  // Handle form submit (update)
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();

    if (!formData.banner_type.trim()) {
      toast({
        title: "Validation Error",
        description: "Banner type is required",
        variant: "destructive",
      });
      return;
    }

    if (!selectedBanner?.id) return;

    try {
      let imageBase64 = null;
      if (imageFile) {
        // Convert file to base64 - backend will handle data URL prefix removal
        imageBase64 = await convertImageToBase64(imageFile);
      } else if (imagePreview && imagePreview.startsWith('data:')) {
        // Use the base64 data URL - backend will extract the base64 part
        imageBase64 = imagePreview;
      }

      const submitData = {
        banner_type: formData.banner_type,
        branch_id: formData.branch_id && formData.branch_id !== "none" ? formData.branch_id : null,
        is_live: formData.is_live,
        roles: formData.roles,
        business_type: formData.business_type,
        state: formData.state || "",
        city: formData.city || "",
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        ...(imageBase64 && { image: imageBase64 }), // Send base64 (backend handles data URL prefix removal)
      };

      await updateBannerMutation.mutateAsync({ bannerId: selectedBanner.id, data: submitData });
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  // Handle delete confirmation
  const confirmDelete = () => {
    if (bannerToDelete) {
      deleteBannerMutation.mutate(bannerToDelete.id);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'dd-MM-yyyy HH:mm');
    } catch {
      return dateString;
    }
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

  if (!hasReadPermission("banners")) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <ImageIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don't have permission to view banners. Contact your administrator for access.
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
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
              <p className="text-gray-600">Manage banner advertisements</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasCreatePermission("banners") && (
              <Button
                onClick={handleCreate}
                className="bg-black hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Banner
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 min-h-0">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* <div>
                    <Label htmlFor="bannerTypeFilter">Banner Type</Label>
                    <Input
                      id="bannerTypeFilter"
                      placeholder="Search by banner type..."
                      value={bannerTypeFilter === 'all' ? '' : bannerTypeFilter}
                      onChange={(e) => setBannerTypeFilter(e.target.value || 'all')}
                    />
                  </div> */}

                  <div>
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="search"
                        placeholder="Search banners..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="isLiveFilter">Status</Label>
                    <Select value={isLiveFilter} onValueChange={setIsLiveFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Live</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>
                <div className="flex items-center space-x-4">
                  <Button onClick={() => refetch()} className="bg-black hover:bg-gray-800">
                    <Search className="h-4 w-4 mr-2" />
                    Apply Filters
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBannerTypeFilter("all");
                      setIsLiveFilter("all");
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Banners List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="h-5 w-5" />
                    <span>Banners ({filteredBanners.length})</span>
                  </div>
                  <Badge variant="outline">
                    Total: {totalCount}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBanners.map((banner) => (
                    <div
                      key={banner.id}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Banner Image */}
                      {banner.image_url && (
                        <div className="w-full h-48 bg-gray-100 overflow-hidden">
                          <img
                            src={banner.image_url}
                            alt={banner.banner_type}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Banner Info */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{banner.banner_type}</h3>
                          <Badge variant={banner.is_live ? "default" : "secondary"}>
                            {banner.is_live ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Live
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Inactive
                              </>
                            )}
                          </Badge>
                        </div>

                        {banner.branch_name && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Building className="h-4 w-4 mr-1" />
                            {banner.branch_name}
                          </div>
                        )}

                        {(banner.state || banner.city) && (
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mr-1" />
                            {[banner.city, banner.state].filter(Boolean).join(", ")}
                          </div>
                        )}

                        {banner.roles && banner.roles.length > 0 && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Users className="h-4 w-4 mr-1" />
                            {banner.roles.length} role(s)
                          </div>
                        )}

                        {banner.business_type && banner.business_type.length > 0 && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Tag className="h-4 w-4 mr-1" />
                            {banner.business_type.length} business type(s)
                          </div>
                        )}

                        <div className="flex items-center text-xs text-gray-500 pt-2 border-t">
                          <Calendar className="h-3 w-3 mr-1" />
                          Created: {formatDate(banner.created_at)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBanner(banner);
                              setIsDetailModalOpen(true);
                            }}
                            className="flex-1"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {hasUpdatePermission("banners") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(banner)}
                              className="flex-1"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          {hasDeletePermission("banners") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(banner)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredBanners.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No banners found</p>
                      {hasCreatePermission("banners") && (
                        <Button
                          onClick={handleCreate}
                          className="mt-4 bg-black hover:bg-gray-800"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Banner
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} banners
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!hasPrevious}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
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

      {/* Create Banner Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Create Banner</span>
            </DialogTitle>
            <DialogDescription>
              Upload a banner image and configure its settings
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="banner_type">Banner Type *</Label>
                <Input
                  id="banner_type"
                  value={formData.banner_type}
                  placeholder="e.g., Homepage Banner, Product Banner"
                  required
                  maxLength={30}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      setFormData({ ...formData, banner_type: value });
                    }
                  }}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="image">Banner Image *</Label>
                <div className="mt-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="cursor-pointer"
                  />
                  {imagePreview && (
                    <div className="mt-4">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full h-48 object-contain border rounded-md"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="branch_id">Branch</Label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {branchesData?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  placeholder="State name"
                  maxLength={20}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      setFormData({ ...formData, state: value });
                    }
                  }}
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  placeholder="City name"
                  maxLength={20}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      setFormData({ ...formData, city: value });
                    }
                  }}
                />
              </div>

              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <BannerDateTimeField
                  id="start_date"
                  value={formData.start_date}
                  onChange={(next) => setFormData({ ...formData, start_date: next })}
                  placeholder="Select start date & time"
                />
              </div>

              <div>
                <Label htmlFor="end_date">End Date</Label>
                <BannerDateTimeField
                  id="end_date"
                  value={formData.end_date}
                  onChange={(next) => setFormData({ ...formData, end_date: next })}
                  placeholder="Select end date & time"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


              <div className="md:col-span-2">
                <Label htmlFor="business_type">Business Types</Label>
                <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                  {businessTypesData?.map((bt) => (
                    <div key={bt.id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={`bt-${bt.id}`}
                        checked={formData.business_type.includes(bt.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ ...formData, business_type: [...formData.business_type, bt.id] });
                          } else {
                            setFormData({ ...formData, business_type: formData.business_type.filter(id => id !== bt.id) });
                          }
                        }}
                      />
                      <Label htmlFor={`bt-${bt.id}`} className="text-sm cursor-pointer">
                        {bt.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createBannerMutation.isPending}
                className="bg-black hover:bg-gray-800"
              >
                {createBannerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Banner
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Banner Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5" />
              <span>Edit Banner</span>
            </DialogTitle>
            <DialogDescription>
              Update banner details and image
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="edit_banner_type">Banner Type *</Label>
                <Input
                  id="edit_banner_type"
                  value={formData.banner_type}
                  onChange={(e) => setFormData({ ...formData, banner_type: e.target.value })}
                  placeholder="e.g., Homepage Banner, Product Banner"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="edit_image">Banner Image (Leave empty to keep current)</Label>
                <div className="mt-2">
                  <Input
                    id="edit_image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="cursor-pointer"
                  />
                  {imagePreview && (
                    <div className="mt-4">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full h-48 object-contain border rounded-md"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="edit_branch_id">Branch</Label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {branchesData?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="edit_state">State</Label>
                <Input
                  id="edit_state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="State name (optional)"
                />
              </div>

              <div>
                <Label htmlFor="edit_city">City</Label>
                <Input
                  id="edit_city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City name (optional)"
                />
              </div>

              <div>
                <Label htmlFor="edit_start_date">Start Date</Label>
                <BannerDateTimeField
                  id="edit_start_date"
                  value={formData.start_date}
                  onChange={(next) => setFormData({ ...formData, start_date: next })}
                  placeholder="Select start date & time"
                />
              </div>

              <div>
                <Label htmlFor="edit_end_date">End Date</Label>
                <BannerDateTimeField
                  id="edit_end_date"
                  value={formData.end_date}
                  onChange={(next) => setFormData({ ...formData, end_date: next })}
                  placeholder="Select end date & time"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit_is_live"
                    checked={formData.is_live}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_live: checked })}
                  />
                  <Label htmlFor="edit_is_live">Is Live</Label>
                </div>
              </div>



              <div className="md:col-span-2">
                <Label htmlFor="edit_business_type">Business Types</Label>
                <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                  {businessTypesData?.map((bt) => (
                    <div key={bt.id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={`edit_bt-${bt.id}`}
                        checked={formData.business_type.includes(bt.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ ...formData, business_type: [...formData.business_type, bt.id] });
                          } else {
                            setFormData({ ...formData, business_type: formData.business_type.filter(id => id !== bt.id) });
                          }
                        }}
                      />
                      <Label htmlFor={`edit_bt-${bt.id}`} className="text-sm cursor-pointer">
                        {bt.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  resetForm();
                  setSelectedBanner(null);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateBannerMutation.isPending}
                className="bg-black hover:bg-gray-800"
              >
                {updateBannerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Banner
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Banner Details</span>
            </DialogTitle>
            <DialogDescription>
              View complete banner information
            </DialogDescription>
          </DialogHeader>

          {selectedBanner && (
            <div className="space-y-6">
              {/* Banner Image */}
              {selectedBanner.image_url && (
                <button
                  type="button"
                  onClick={() =>
                    setBannerZoomImage({
                      url: selectedBanner.image_url,
                      title: selectedBanner.banner_type || "Banner image",
                    })
                  }
                  className="w-full bg-gray-100 rounded-lg overflow-hidden hover:opacity-95 transition-opacity cursor-zoom-in"
                  title="Click to zoom"
                >
                  <img
                    src={selectedBanner.image_url}
                    alt={selectedBanner.banner_type}
                    className="w-full h-auto max-h-96 object-contain pointer-events-none"
                  />
                </button>
              )}

              {/* Banner Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Banner Type</Label>
                  <p className="text-lg font-semibold">{selectedBanner.banner_type}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <div className="mt-1">
                    <Badge variant={selectedBanner.is_live ? "default" : "secondary"}>
                      {selectedBanner.is_live ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Live
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </div>
                </div>

                {selectedBanner.branch_name && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Branch</Label>
                    <p className="text-sm">{selectedBanner.branch_name}</p>
                  </div>
                )}

                {selectedBanner.state && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">State</Label>
                    <p className="text-sm">{selectedBanner.state}</p>
                  </div>
                )}

                {selectedBanner.city && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">City</Label>
                    <p className="text-sm">{selectedBanner.city}</p>
                  </div>
                )}

                {selectedBanner.start_date && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                    <p className="text-sm">{formatDate(selectedBanner.start_date)}</p>
                  </div>
                )}

                {selectedBanner.end_date && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">End Date</Label>
                    <p className="text-sm">{formatDate(selectedBanner.end_date)}</p>
                  </div>
                )}

                {selectedBanner.created_by_name && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Created By</Label>
                    <p className="text-sm">{selectedBanner.created_by_name}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-500">Created At</Label>
                  <p className="text-sm">{formatDate(selectedBanner.created_at)}</p>
                </div>
              </div>

              {/* Roles */}
              {selectedBanner.roles && selectedBanner.roles.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Roles</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedBanner.roles.map((role) => (
                      <Badge key={role.id} variant="outline">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Business Types */}
              {selectedBanner.business_type && selectedBanner.business_type.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Business Types</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedBanner.business_type.map((bt) => (
                      <Badge key={bt.id} variant="outline">
                        {bt.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ZoomImageViewerDialog
        open={Boolean(bannerZoomImage)}
        onOpenChange={(open) => {
          if (!open) setBannerZoomImage(null);
        }}
        imageUrl={bannerZoomImage?.url || ""}
        title={bannerZoomImage?.title || "Banner image"}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <span>Delete Banner</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this banner? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {bannerToDelete && (
            <div className="py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><span className="font-medium">Banner Type:</span> {bannerToDelete.banner_type}</p>
                {bannerToDelete.branch_name && (
                  <p><span className="font-medium">Branch:</span> {bannerToDelete.branch_name}</p>
                )}
                <p><span className="font-medium">Status:</span> {bannerToDelete.is_live ? "Live" : "Inactive"}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteBannerMutation.isPending}
            >
              {deleteBannerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
