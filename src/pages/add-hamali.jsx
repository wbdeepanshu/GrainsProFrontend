import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { 
  Menu, 
  ArrowLeft,
  FileText,
  ChevronDown,
  Plus,
  Trash2,
  Package,
  Weight,
  Upload,
  X,
  Clock,
  User,
  Truck,
  FileCheck,
  Check,
  ChevronsUpDown,
  Loader2
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function AddHamali() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [hamaliTypeDropdownOpen, setHamaliTypeDropdownOpen] = useState(false);
  const [transferTypeDropdownOpen, setTransferTypeDropdownOpen] = useState(false);
  const [fromLocationDropdownOpen, setFromLocationDropdownOpen] = useState(false);
  const [toLocationDropdownOpen, setToLocationDropdownOpen] = useState(false);
  const [stockItemDropdownOpen, setStockItemDropdownOpen] = useState(false);
  const [selectedHamaliType, setSelectedHamaliType] = useState("");
  const [selectedTransferType, setSelectedTransferType] = useState("");
  const [selectedFromLocation, setSelectedFromLocation] = useState("");
  const [selectedToLocation, setSelectedToLocation] = useState("");
  const [fromLocationCustomMode, setFromLocationCustomMode] = useState(false);
  const [toLocationCustomMode, setToLocationCustomMode] = useState(false);
  const [stockItems, setStockItems] = useState([]);
  const [selectedStockItem, setSelectedStockItem] = useState("");
  const [packets, setPackets] = useState("");
  const [weightPerParcel, setWeightPerParcel] = useState("");
  
  // Additional form fields for API requirements
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [totalLaboursCount, setTotalLaboursCount] = useState(1);
  const [voucherNo, setVoucherNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [selectedHamaliGroup, setSelectedHamaliGroup] = useState("");
  const [hamaliGroupDropdownOpen, setHamaliGroupDropdownOpen] = useState(false);
  
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // Get user permissions
  const { 
    hasCreatePermission, 
    hasReadPermission, 
    hasUpdatePermission, 
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  // Fetch branches (same as Create Sales Order)
  const { data: branchesData = [], isLoading: branchesLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-branches/`],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-branches/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Auto-select first branch when branches load
  useEffect(() => {
    if (branchesData && branchesData.length > 0 && !branchId) {
      const firstId = branchesData[0]?.id;
      if (firstId != null) setBranchId(firstId);
    }
  }, [branchesData]);

  // Fetch hamali types — filtered by branch and selected hamali group
  const { data: hamaliTypes = [], isLoading: isLoadingHamaliTypes, error: hamaliTypesError } = useQuery({
    queryKey: [`${API_BASE_URL}/api/process/get-hamali-types/`, branchId, selectedHamaliGroup],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (branchId) params.append('branch_id', String(branchId));
        if (selectedHamaliGroup === "none") {
          params.append('hamali_group_id', 'none');
        } else if (selectedHamaliGroup) {
          params.append('hamali_group_id', String(selectedHamaliGroup));
        }
        const query = params.toString();
        const url = `${API_BASE_URL}/api/process/get-hamali-types/${query ? `?${query}` : ''}`;
        const response = await apiRequest('GET', url);
        const data = await response.json();
        return data.data || [];
      } catch (err) {
        toast({
          variant: 'destructive',
          title: "Error",
          description: "Failed to load hamali types",
        });
        throw err;
      }
    },
    enabled: !!branchId,
  });

  // Fetch hamali groups for selected branch (Labour Management master)
  const {
    data: hamaliGroups = [],
    isLoading: isLoadingHamaliGroups,
    error: hamaliGroupsError,
  } = useQuery({
    queryKey: [`${API_BASE_URL}/api/hamali-groups/`, branchId],
    queryFn: async () => {
      const params = new URLSearchParams({ is_active: "true" });
      if (branchId) params.set("branch_id", String(branchId));
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/hamali-groups/?${params.toString()}`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!branchId && !!AuthService.getAccessToken(),
  });

  // Clear hamali type & group when branch changes (lists may differ)
  useEffect(() => {
    setSelectedHamaliType("");
    setSelectedHamaliGroup("");
  }, [branchId]);

  // Stock items search state - search triggers API with full data (paginated)
  const [stockSearch, setStockSearch] = useState("");
  const [stockDebounced, setStockDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setStockDebounced(stockSearch), 300);
    return () => clearTimeout(t);
  }, [stockSearch]);

  // Fetch stock items with pagination and search (same as add-inward)
  const fetchStockItems = async ({ pageParam = 1, queryKey }) => {
    const [, { search }] = queryKey;
    const response = await apiRequest('POST', `${API_BASE_URL}/api/get-stock-items/`, {
      new_page: pageParam,
      per_page: 50,
      search: search || "",
      type: "",
      stock_group: "",
      godown: "",
      voucher_type: ""
    });
    const data = await response.json();
    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
    };
  };

  const {
    data: stockItemsPages,
    fetchNextPage: fetchNextStockPage,
    hasNextPage: hasNextStockPage,
    isFetchingNextPage: isFetchingNextStockPage,
    isLoading: isLoadingStockItems,
  } = useInfiniteQuery({
    queryKey: ['stock-items', { search: stockDebounced }],
    queryFn: fetchStockItems,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken(),
  });

  const allStockItems = stockItemsPages?.pages?.flatMap((page) => page.results) ?? [];

  // Fetch users for verified_by field with role=2
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-users/?role=2`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/?role=2`);
        const data = await response.json();
        return data.data || [];
      } catch (err) {
        console.error("Failed to load users:", err);
        return [];
      }
    },
  });

  // Fetch godowns for location dropdowns
  const { data: godowns = [], isLoading: isLoadingGodowns } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-godowns/`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/get-godowns/`);
        const data = await response.json();
        return data.data || [];
      } catch (err) {
        console.error("Failed to load godowns:", err);
        return [];
      }
    },
  });

  const handleBack = () => {
    setLocation('/dashboard');
  };

  // Transfer types mapping to API constants
  const transferTypes = [
    { value: "GODOWN_TO_GODOWN", label: "Godown to Godown" },
    { value: "GODOWN_TO_LOCATION", label: "Godown to Location" },
    { value: "LOCATION_TO_GODOWN", label: "Location to Godown" },
    { value: "LOCATION_TO_LOCATION", label: "Location to Location" },
    { value: "FACTORY", label: "Factory" },
    { value: "GODOWN", label: "Godown" }
  ];

  // Get location options based on transfer type – godowns in both dropdowns by default; add Location/Factory where applicable
  const godownNames = godowns.map((g) => g.name);
  const getLocationOptions = (transferType) => {
    switch (transferType) {
      case "GODOWN_TO_GODOWN":
        return { from: godownNames, to: godownNames };
      case "GODOWN_TO_LOCATION":
        return { from: godownNames, to: [...godownNames, "Location"] };
      case "LOCATION_TO_GODOWN":
        return { from: ["Location", ...godownNames], to: godownNames };
      case "LOCATION_TO_LOCATION":
        return { from: [...godownNames, "Location"], to: [...godownNames, "Location"] };
      case "FACTORY":
        return { from: [...godownNames, "Factory"], to: [...godownNames, "Factory"] };
      case "GODOWN":
        return { from: godownNames, to: godownNames };
      default:
        return { from: [], to: [] };
    }
  };

  const handleHamaliTypeChange = (value) => {
    setSelectedHamaliType(value);
    setHamaliTypeDropdownOpen(false);
  };

  const handleHamaliGroupChange = (value) => {
    setSelectedHamaliGroup(value);
    setSelectedHamaliType("");
    setHamaliGroupDropdownOpen(false);
  };

  const handleTransferTypeChange = (value) => {
    setSelectedTransferType(value);
    setTransferTypeDropdownOpen(false);
    setFromLocationCustomMode(false);
    setToLocationCustomMode(false);
    const locationOptions = getLocationOptions(value);
    if (locationOptions.from.length > 0) {
      setSelectedFromLocation(locationOptions.from[0]);
    }
    if (locationOptions.to.length > 0) {
      setSelectedToLocation(locationOptions.to[0]);
    }
  };

  const handleFromLocationChange = (value) => {
    setSelectedFromLocation(value);
    setFromLocationDropdownOpen(false);
  };

  const handleToLocationChange = (value) => {
    setSelectedToLocation(value);
    setToLocationDropdownOpen(false);
  };

  const handleFromLocationCustomMode = () => {
    setFromLocationCustomMode(true);
    setFromLocationDropdownOpen(false);
    setSelectedFromLocation("");
  };

  const handleToLocationCustomMode = () => {
    setToLocationCustomMode(true);
    setToLocationDropdownOpen(false);
    setSelectedToLocation("");
  };

  const locationOptions = getLocationOptions(selectedTransferType);

  // Stock item handlers
  const handleStockItemChange = (value) => {
    setSelectedStockItem(value);
    setStockItemDropdownOpen(false);
    setPackets("");
    
    // Auto-fill weight per packet using conversion value
    const selectedItem = allStockItems.find(item => item.id.toString() === value);
    if (selectedItem) {
      const conversion = parseFloat(selectedItem.conversion || 0);
      const weightPerPacket = conversion === 0 ? 1 : conversion * 100;
      setWeightPerParcel(weightPerPacket.toString());
    }
  };

  const handlePacketsChange = (e) => {
    const value = e.target.value;
    setPackets(value);
  };

  const handlePacketsBlur = () => {
    // Auto-add stock item when packets field loses focus and all required fields are filled
    if (packets && selectedStockItem && weightPerParcel) {
      const packetsCount = parseInt(packets);
      if (packetsCount > 0) {
        addStockItemAutomatically();
      }
    }
  };

  const addStockItemAutomatically = () => {
    if (!selectedStockItem || !packets || !weightPerParcel) return;
    
    const selectedItem = allStockItems.find(item => item.id.toString() === selectedStockItem);
    if (!selectedItem) return;

    const packetsCount = parseInt(packets);
    const weightPerParcelValue = parseFloat(weightPerParcel);
    const conversion = parseFloat(selectedItem.conversion || 0);
    
    // Calculate total weight in QTL: (packets × weight per packet in kg) / 100
    // Convert kg to QTL: 1 QTL = 100 kg
    const totalWeightInQTL = (packetsCount * weightPerParcelValue) / 100;

    const newStockItem = {
      id: Date.now(), // temporary ID for list management
      item_name_id: selectedItem.id, // API expects this field name
      name: selectedItem.name,
      weight: weightPerParcelValue,
      conversion: conversion,
      packets_count: packetsCount, // API expects this field name
      totalWeight: totalWeightInQTL,
      item_remarks: "" // API expects this field
    };

    setStockItems([...stockItems, newStockItem]);
    setSelectedStockItem("");
    setPackets("");
    setWeightPerParcel("");
    
    // Show success toast
    toast({
      variant: 'success',
      title: "Success",
      description: "Stock item added automatically",
    });
  };

  const addStockItem = () => {
    if (!selectedStockItem || !packets || !weightPerParcel) return;
    
    const selectedItem = allStockItems.find(item => item.id.toString() === selectedStockItem);
    if (!selectedItem) return;

    const packetsCount = parseInt(packets);
    const weightPerParcelValue = parseFloat(weightPerParcel);
    const conversion = parseFloat(selectedItem.conversion || 0);
    
    // Calculate total weight in QTL: (packets × weight per packet in kg) / 100
    // Convert kg to QTL: 1 QTL = 100 kg
    const totalWeightInQTL = (packetsCount * weightPerParcelValue) / 100;

    const newStockItem = {
      id: Date.now(), // temporary ID for list management
      item_name_id: selectedItem.id, // API expects this field name
      name: selectedItem.name,
      weight: weightPerParcelValue,
      conversion: conversion,
      packets_count: packetsCount, // API expects this field name
      totalWeight: totalWeightInQTL,
      item_remarks: "" // API expects this field
    };

    setStockItems([...stockItems, newStockItem]);
    setSelectedStockItem("");
    setPackets("");
    setWeightPerParcel("");
    
    // Show success toast
    toast({
      variant: 'success',
      title: "Success",
      description: "Stock item added successfully",
    });
  };

  const removeStockItem = (id) => {
    setStockItems(stockItems.filter(item => item.id !== id));
    
    // Show success toast
    toast({
      variant: 'success',
      title: "Success",
      description: "Stock item removed successfully",
    });
  };

  // Image upload functionality
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
          const newImage = {
            id: Date.now() + Math.random(),
            name: file.name,
            image: base64,
            file: file
          };
          setImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (id) => {
    setImages(images.filter(img => img.id !== id));
  };

  // Form submission
  const handleSubmit = async () => {
    if (!selectedHamaliType || !selectedTransferType || stockItems.length === 0) {
      toast({
        variant: 'destructive',
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one stock item",
      });
      return;
    }

    // Additional validation for required fields
    if (!selectedFromLocation || !selectedToLocation) {
      toast({
        variant: 'destructive',
        title: "Validation Error",
        description: "Please select transfer type to auto-fill location fields",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = {
        ...(branchId ? { branch_id: branchId } : {}),
        hamali_type_id: parseInt(selectedHamaliType),
        ...(selectedHamaliGroup && selectedHamaliGroup !== "none"
          ? { hamali_group_id: parseInt(selectedHamaliGroup, 10) }
          : {}),
        transfer_type: selectedTransferType,
        from_location: selectedFromLocation.trim(),
        to_location: selectedToLocation.trim(),
        stock_items: stockItems.map(item => ({
          item_name_id: item.item_name_id,
          packets_count: item.packets_count,
          item_remarks: item.item_remarks || ""
        })),
        vehicle_no: vehicleNo,
        driver_name: driverName,
        total_labours_count: parseInt(totalLaboursCount),
        voucher_no: voucherNo,
        remarks: remarks,
        start_time: startTime,
        end_time: endTime,
        verified_by: verifiedBy || null,
        images: images.map(img => ({
          name: img.name,
          image: img.image
        }))
      };

      const response = await apiRequest('POST', `${API_BASE_URL}/api/process/hamali-entry/`, formData);
      const data = await response.json();

      if (response.ok) {
        toast({
          variant: 'success',
          title: "Success",
          description: data.message || "Hamali entry created successfully",
        });
        // Reset form
        setSelectedHamaliType("");
        setSelectedHamaliGroup("");
        setSelectedTransferType("");
        setSelectedFromLocation("");
        setSelectedToLocation("");
        setFromLocationCustomMode(false);
        setToLocationCustomMode(false);
        setStockItems([]);
        setVehicleNo("");
        setDriverName("");
        setTotalLaboursCount(1);
        setVoucherNo("");
        setRemarks("");
        setStartTime("");
        setEndTime("");
        setVerifiedBy("");
        setImages([]);
        setBranchId(branchesData?.[0]?.id ?? "");
      } else {
        throw new Error(data.error || data.message || 'Failed to create hamali entry');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Error",
        description: error.message || "Failed to create hamali entry",
      });
    } finally {
      setIsSubmitting(false);
    }
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

  // Check if user has create permission for hamali
  // Check exact module name from API: "hamali"
  const hasHamaliAccess = hasCreatePermission("hamali");
  
  if (!hasHamaliAccess) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        <div className="app-main-content flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to create hamali entries.</p>
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
                  <h1 className="text-2xl font-bold text-gray-900">Add Hamali</h1>
                  <p className="text-sm text-gray-600">Create a new hamali entry</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              {/* Hamali Entry Form */}
              <Card className="shadow-sm border border-gray-200">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Hamali Entry Form</span>
                  </CardTitle>
                  <div className="flex items-center gap-2 min-w-0 max-w-[280px]">
                    <Label htmlFor="branch" className="text-sm font-medium text-gray-700 whitespace-nowrap shrink-0">
                      Branch *
                    </Label>
                    <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={branchDropdownOpen}
                          className="w-full min-w-[140px] justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        >
                          <span className="truncate">
                            {branchId
                              ? branchesData?.find((b) => b.id === branchId || String(b.id) === String(branchId))?.name || "Select branch"
                              : "Select branch"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="end" side="bottom" sideOffset={4}>
                        <Command>
                          <CommandInput placeholder="Search branches..." />
                          <CommandList>
                            <CommandEmpty>
                              {branchesLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Loading branches...
                                </div>
                              ) : (
                                "No branches found."
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              <ScrollArea className="h-64">
                                {branchesData?.map((branch) => (
                                  <CommandItem
                                    key={branch.id}
                                    value={branch.name}
                                    onSelect={() => {
                                      setBranchId(branch.id);
                                      setBranchDropdownOpen(false);
                                      setSelectedHamaliGroup("");
                                    }}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${
                                          (branchId === branch.id || String(branchId) === String(branch.id)) ? "opacity-100 text-blue-600" : "opacity-0"
                                        }`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-900">{branch.name}</div>
                                        {branch.city && branch.state && (
                                          <div className="text-xs text-gray-500">{branch.city}, {branch.state}</div>
                                        )}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </ScrollArea>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                      {/* Hamali Group — optional; filters hamali types when selected */}
                      <div className="space-y-2">
                        <Label htmlFor="hamali-group" className="text-sm font-medium text-gray-700">
                          Hamali Group
                          <span className="text-gray-400 font-normal ml-1">(optional)</span>
                        </Label>
                        <Popover
                          open={hamaliGroupDropdownOpen}
                          onOpenChange={setHamaliGroupDropdownOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={hamaliGroupDropdownOpen}
                              disabled={!branchId || isLoadingHamaliGroups}
                              className="w-full justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 min-w-0"
                            >
                              <span className="truncate text-left">
                                {!branchId
                                  ? "Select branch first"
                                  : isLoadingHamaliGroups
                                    ? "Loading groups..."
                                    : !selectedHamaliGroup
                                      ? "All hamali types"
                                      : selectedHamaliGroup === "none"
                                        ? "Unassigned types only"
                                        : hamaliGroups.find(
                                            (g) => String(g.id) === String(selectedHamaliGroup)
                                          )?.name || "Choose hamali group..."}
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
                                  {isLoadingHamaliGroups
                                    ? "Loading hamali groups..."
                                    : hamaliGroupsError
                                      ? "Failed to load groups."
                                      : "No hamali groups for this branch."}
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    <CommandItem
                                      value="__all__"
                                      onSelect={() => handleHamaliGroupChange("")}
                                      className="cursor-pointer px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 shrink-0 ${
                                            !selectedHamaliGroup ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <span className="text-sm text-gray-600">All hamali types</span>
                                      </div>
                                    </CommandItem>
                                    <CommandItem
                                      value="__unassigned__"
                                      onSelect={() => handleHamaliGroupChange("none")}
                                      className="cursor-pointer px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 shrink-0 ${
                                            selectedHamaliGroup === "none" ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <span className="text-sm text-gray-600">Unassigned types only</span>
                                      </div>
                                    </CommandItem>
                                    {hamaliGroups.map((group) => (
                                      <CommandItem
                                        key={group.id}
                                        value={`${group.name} ${group.branch_name || ""}`}
                                        onSelect={() =>
                                          handleHamaliGroupChange(String(group.id))
                                        }
                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <Check
                                            className={`h-4 w-4 shrink-0 ${
                                              selectedHamaliGroup === String(group.id)
                                                ? "opacity-100 text-blue-600"
                                                : "opacity-0"
                                            }`}
                                          />
                                          <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-sm truncate">
                                              {group.name}
                                            </span>
                                            {group.branch_name && (
                                              <span className="text-xs text-gray-500 truncate">
                                                {group.branch_name}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Hamali Type — filtered by selected group */}
                      <div className="space-y-2">
                        <Label htmlFor="hamali-type" className="text-sm font-medium text-gray-700">
                          Select Hamali Type *
                        </Label>
                        <Popover open={hamaliTypeDropdownOpen} onOpenChange={setHamaliTypeDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={hamaliTypeDropdownOpen}
                              disabled={!branchId || isLoadingHamaliTypes}
                              className="w-full justify-between items-start min-h-10 h-auto py-2 pl-3 pr-2 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 min-w-0 text-left"
                            >
                              <span className="flex flex-col items-stretch text-left flex-1 min-w-0 overflow-hidden">
                                {!branchId
                                  ? "Select branch first"
                                  : isLoadingHamaliTypes
                                    ? "Loading hamali types..."
                                    : selectedHamaliType
                                      ? (() => {
                                          const selectedType = hamaliTypes.find(
                                            (type) => type.id.toString() === selectedHamaliType
                                          );
                                          if (!selectedType) return "Choose hamali type...";
                                          const rateDetails = selectedType.current_rate_details;
                                          return (
                                            <>
                                              <span className="block text-xs sm:text-sm font-medium whitespace-normal break-words text-left w-full text-indent-0">
                                                {selectedType.name}
                                              </span>
                                              {rateDetails?.rate && (
                                                <span className="block text-[11px] sm:text-xs text-gray-500 whitespace-normal text-left w-full text-indent-0">
                                                  ₹{rateDetails.rate} per {rateDetails.per_weight} {rateDetails.per_unit}
                                                </span>
                                              )}
                                            </>
                                          );
                                        })()
                                      : "Choose hamali type..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 mt-0.5 flex-shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0 z-50"
                            align="start"
                            side="bottom"
                            sideOffset={4}
                          >
                            <Command>
                              <CommandInput placeholder="Search hamali types..." />
                              <CommandList>
                                <CommandEmpty>
                                  {hamaliTypesError
                                    ? "Failed to load hamali types."
                                    : isLoadingHamaliTypes
                                      ? "Loading hamali types..."
                                      : "No hamali types for this group."}
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    {hamaliTypes.map((type) => (
                                      <CommandItem
                                        key={type.id}
                                        value={`${type.name} ${type.current_rate_details?.rate || ""} ${type.current_rate_details?.per_weight || ""} ${type.current_rate_details?.per_unit || ""}`}
                                        onSelect={() => handleHamaliTypeChange(type.id.toString())}
                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <Check
                                            className={`h-4 w-4 shrink-0 ${
                                              selectedHamaliType === type.id.toString() ? "opacity-100 text-blue-600" : "opacity-0"
                                            }`}
                                          />
                                          <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-sm whitespace-normal break-words">
                                              {type.name}
                                            </span>
                                            <span className="text-xs text-gray-500 whitespace-normal">
                                              ₹{type.current_rate_details?.rate} per {type.current_rate_details?.per_weight} {type.current_rate_details?.per_unit}
                                            </span>
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Transfer Type Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Transfer Type
                        </Label>
                        <Popover open={transferTypeDropdownOpen} onOpenChange={setTransferTypeDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={transferTypeDropdownOpen}
                              className="w-full justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 min-w-0"
                            >
                              <span className="truncate">
                                {selectedTransferType
                                  ? transferTypes.find((t) => t.value === selectedTransferType)?.label || "Choose transfer type..."
                                  : "Choose transfer type..."}
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
                              <CommandInput placeholder="Search transfer types..." />
                              <CommandList>
                                <CommandEmpty>No transfer types found.</CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    {transferTypes.map((type) => (
                                      <CommandItem
                                        key={type.value}
                                        value={type.label}
                                        onSelect={() => handleTransferTypeChange(type.value)}
                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Check
                                            className={`h-4 w-4 shrink-0 ${
                                              selectedTransferType === type.value ? "opacity-100 text-blue-600" : "opacity-0"
                                            }`}
                                          />
                                          <span className="font-medium text-sm">{type.label}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* From Location Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          From Location
                        </Label>
                        {fromLocationCustomMode ? (
                          <div className="space-y-1">
                            <Input
                              value={selectedFromLocation}
                              onChange={(e) => setSelectedFromLocation(e.target.value)}
                              placeholder="Enter from location"
                              className="h-10 border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => { setFromLocationCustomMode(false); setSelectedFromLocation(locationOptions.from[0] || ""); }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Choose from list
                            </button>
                          </div>
                        ) : (
                          <Popover open={fromLocationDropdownOpen} onOpenChange={setFromLocationDropdownOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={fromLocationDropdownOpen}
                                disabled={!selectedTransferType || isLoadingGodowns}
                                className="w-full justify-between min-h-10 h-auto py-2 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="flex flex-col text-left whitespace-normal break-words flex-1 min-w-0">
                                  {isLoadingGodowns
                                    ? "Loading godowns..."
                                    : !selectedTransferType
                                      ? "Select transfer type first"
                                      : selectedFromLocation
                                        ? (() => {
                                            const godown = godowns.find((g) => g.name === selectedFromLocation);
                                            return godown
                                              ? `${selectedFromLocation}${godown.branch ? ` (${godown.branch})` : ""}`
                                              : selectedFromLocation;
                                          })()
                                        : "Select from location..."}
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
                                <CommandInput placeholder="Search from location..." />
                                <CommandList>
                                  <CommandEmpty>No locations found.</CommandEmpty>
                                  <CommandGroup>
                                    <ScrollArea className="h-64">
                                      {locationOptions.from.map((location) => {
                                        const godown = godowns.find((g) => g.name === location);
                                        return (
                                          <CommandItem
                                            key={location}
                                            value={`${location} ${godown?.branch || ""}`}
                                            onSelect={() => handleFromLocationChange(location)}
                                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                              <Check
                                                className={`h-4 w-4 shrink-0 ${
                                                  selectedFromLocation === location ? "opacity-100 text-blue-600" : "opacity-0"
                                                }`}
                                              />
                                              <div className="flex flex-col min-w-0">
                                                <span className="font-medium text-sm">{location}</span>
                                                {godown?.branch && (
                                                  <span className="text-xs text-gray-500">{godown.branch}</span>
                                                )}
                                              </div>
                                            </div>
                                          </CommandItem>
                                        );
                                      })}
                                    </ScrollArea>
                                    <CommandItem
                                      onSelect={handleFromLocationCustomMode}
                                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-2 border-t border-gray-100"
                                    >
                                      <Plus className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm text-blue-600">Add custom location</span>
                                    </CommandItem>
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      {/* To Location Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          To Location
                        </Label>
                        {toLocationCustomMode ? (
                          <div className="space-y-1">
                            <Input
                              value={selectedToLocation}
                              onChange={(e) => setSelectedToLocation(e.target.value)}
                              placeholder="Enter to location"
                              className="h-10 border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => { setToLocationCustomMode(false); setSelectedToLocation(locationOptions.to[0] || ""); }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Choose from list
                            </button>
                          </div>
                        ) : (
                          <Popover open={toLocationDropdownOpen} onOpenChange={setToLocationDropdownOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={toLocationDropdownOpen}
                                disabled={!selectedTransferType || isLoadingGodowns}
                                className="w-full justify-between min-h-10 h-auto py-2 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="flex flex-col text-left whitespace-normal break-words flex-1 min-w-0">
                                  {isLoadingGodowns
                                    ? "Loading godowns..."
                                    : !selectedTransferType
                                      ? "Select transfer type first"
                                      : selectedToLocation
                                        ? (() => {
                                            const godown = godowns.find((g) => g.name === selectedToLocation);
                                            return godown
                                              ? `${selectedToLocation}${godown.branch ? ` (${godown.branch})` : ""}`
                                              : selectedToLocation;
                                          })()
                                        : "Select to location..."}
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
                                <CommandInput placeholder="Search to location..." />
                                <CommandList>
                                  <CommandEmpty>No locations found.</CommandEmpty>
                                  <CommandGroup>
                                    <ScrollArea className="h-64">
                                      {locationOptions.to.map((location) => {
                                        const godown = godowns.find((g) => g.name === location);
                                        return (
                                          <CommandItem
                                            key={location}
                                            value={`${location} ${godown?.branch || ""}`}
                                            onSelect={() => handleToLocationChange(location)}
                                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                              <Check
                                                className={`h-4 w-4 shrink-0 ${
                                                  selectedToLocation === location ? "opacity-100 text-blue-600" : "opacity-0"
                                                }`}
                                              />
                                              <div className="flex flex-col min-w-0">
                                                <span className="font-medium text-sm">{location}</span>
                                                {godown?.branch && (
                                                  <span className="text-xs text-gray-500">{godown.branch}</span>
                                                )}
                                              </div>
                                            </div>
                                          </CommandItem>
                                        );
                                      })}
                                    </ScrollArea>
                                    <CommandItem
                                      onSelect={handleToLocationCustomMode}
                                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-2 border-t border-gray-100"
                                    >
                                      <Plus className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm text-blue-600">Add custom location</span>
                                    </CommandItem>
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </div>
                </CardContent>
              </Card>

              {/* Add Stock Items Section */}
              <Card className="shadow-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <CardTitle className="flex items-center space-x-2 text-gray-800">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-lg">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold">Add Stock Items</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingStockItems ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader text="Loading stock items..." />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Stock Item Selection - Compact Layout */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center space-x-2 mb-4">
                          <Package className="h-5 w-5 text-gray-600" />
                          <h3 className="text-lg font-semibold text-gray-900">Add Stock Item</h3>
                        </div>
                        
                        {/* Single Row Layout */}
                        <div className="flex items-end space-x-4">
                          {/* Stock Item Selection */}
                          <div className="flex-1 space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                              Choose Stock Item
                            </Label>
                            <Popover open={stockItemDropdownOpen} onOpenChange={setStockItemDropdownOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={stockItemDropdownOpen}
                                  className="w-full justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                >
                                  <span className="truncate">
                                    {selectedStockItem ? (() => {
                                      const item = allStockItems.find(i => i.id.toString() === selectedStockItem);
                                      return item ? item.name : "Select a stock item...";
                                    })() : "Select a stock item..."}
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
                                <Command shouldFilter={false}>
                                  <CommandInput
                                    placeholder="Search stock items..."
                                    value={stockSearch}
                                    onValueChange={setStockSearch}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      {isLoadingStockItems ? (
                                        "Loading stock items..."
                                      ) : allStockItems.length === 0 ? (
                                        stockSearch ? (
                                          `No stock items found for "${stockSearch}"`
                                        ) : (
                                          "No stock items found."
                                        )
                                      ) : (
                                        "No stock items match your search."
                                      )}
                                    </CommandEmpty>
                                    <CommandGroup>
                                      <ScrollArea
                                        className="h-64"
                                        onScroll={(e) => {
                                          const target = e.currentTarget;
                                          if (
                                            target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                                            hasNextStockPage &&
                                            !isFetchingNextStockPage
                                          ) {
                                            fetchNextStockPage();
                                          }
                                        }}
                                      >
                                        {allStockItems.map((item) => {
                                          const conversion = parseFloat(item.conversion || 0);
                                          const weightPerPacket = conversion === 0 ? 1 : conversion * 100;
                                          return (
                                            <CommandItem
                                              key={item.id}
                                              value={`${item.name} ${weightPerPacket}kg`}
                                              onSelect={() => handleStockItemChange(item.id.toString())}
                                              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                            >
                                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Check
                                                  className={`h-4 w-4 shrink-0 ${
                                                    selectedStockItem === item.id.toString() ? "opacity-100 text-blue-600" : "opacity-0"
                                                  }`}
                                                />
                                                <div className="flex flex-col min-w-0">
                                                  <span className="font-medium text-sm truncate">{item.name}</span>
                                                  <span className="text-xs text-gray-500">
                                                    Weight/Packet: {weightPerPacket}kg
                                                  </span>
                                                </div>
                                              </div>
                                            </CommandItem>
                                          );
                                        })}
                                        {isFetchingNextStockPage && (
                                          <div className="p-2 text-center text-sm">Loading more...</div>
                                        )}
                                        {isLoadingStockItems && allStockItems.length === 0 && (
                                          <div className="p-2 text-center text-sm">Loading stock items...</div>
                                        )}
                                      </ScrollArea>
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Weight per Packet Display */}
                          <div className="flex-1 space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                              Weight per Packet
                            </Label>
                            <div className="h-10 border border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100 rounded-md flex items-center px-3">
                              <span className="text-gray-700 font-medium text-sm">
                                {weightPerParcel ? `${weightPerParcel} kg` : 'Select item first'}
                              </span>
                            </div>
                          </div>

                          {/* Number of Packets */}
                          <div className="flex-1 space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                              Number of Packets
                            </Label>
                            <Input
                              type="number"
                              placeholder="Enter packets..."
                              value={packets}
                              onChange={handlePacketsChange}
                              onBlur={handlePacketsBlur}
                              className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                              min="1"
                              step="1"
                            />
                          </div>

                          {/* Add Button - Icon Only */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-black-700 opacity-0">
                              Action
                            </Label>
                            <Button
                              onClick={addStockItem}
                              disabled={!selectedStockItem || !packets || !weightPerParcel}
                              className="h-10 w-10 p-0 bg-black hover:bg-gray-800 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Add Stock Item"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Total Weight Preview - Below the row */}
                        {packets && weightPerParcel && (
                          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-green-700">Total Weight:</span>
                              <span className="text-green-700 font-semibold">
                                {((parseInt(packets) || 0) * parseFloat(weightPerParcel)) / 100} QTL
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Added Stock Items List */}
                      {stockItems.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                              <Package className="h-5 w-5 mr-2 text-gray-600" />
                              Added Stock Items
                            </h4>
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                              {stockItems.length} item{stockItems.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                             {stockItems.map((item, index) => (
                               <div key={item.id} className="group relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                 <div className="p-3 pl-8">
                                   <div className="space-y-2">
                                     {/* Item Name */}
                                     <div>
                                       <p className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">{item.name}</p>
                                       <p className="text-xs text-gray-500 mt-1">Weight/Packet: {item.weight}kg</p>
                                     </div>
                                     
                                     {/* Packets and Weight Row */}
                                     <div className="flex items-center justify-between">
                                       <div className="text-center">
                                         <div className="bg-blue-50 rounded-md px-2 py-1">
                                           <p className="font-bold text-blue-700 text-sm">{item.packets_count}</p>
                                         </div>
                                         <p className="text-xs text-gray-500 mt-1">Packets</p>
                                       </div>
                                       
                                       <div className="text-center">
                                         <div className="bg-green-50 rounded-md px-2 py-1">
                                           <p className="font-bold text-green-700 text-sm">{item.totalWeight.toFixed(2)}</p>
                                         </div>
                                         <p className="text-xs text-gray-500 mt-1">QTL</p>
                                       </div>
                                     </div>
                                     
                                     {/* Remove Button */}
                                     <div className="flex justify-end">
                                       <Button
                                         variant="outline"
                                         size="sm"
                                         onClick={() => removeStockItem(item.id)}
                                         className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 border-gray-300 h-7 w-7 p-0"
                                       >
                                         <Trash2 className="h-3 w-3" />
                                       </Button>
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Additional Information Section */}
              <Card className="shadow-sm border border-gray-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <FileCheck className="h-5 w-5" />
                      <span>Additional Information</span>
                    </CardTitle>
                    {/* Vehicle Information Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowVehicleInfo(!showVehicleInfo)}
                      className="flex items-center space-x-2 border-gray-300 hover:bg-gray-50"
                    >
                      <Truck className="h-4 w-4" />
                      <span>{showVehicleInfo ? 'Hide' : 'Add'} Vehicle Info</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showVehicleInfo ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Vehicle Information Fields - Collapsible */}
                  {showVehicleInfo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      {/* Vehicle Number */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Vehicle Number
                        </Label>
                        <Input
                          type="text"
                          placeholder="Enter vehicle number..."
                          value={vehicleNo}
                          onChange={(e) => setVehicleNo(e.target.value)}
                          className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                        />
                      </div>

                      {/* Driver Name */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Driver Name
                        </Label>
                        <Input
                          type="text"
                          placeholder="Enter driver name..."
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Total Labours Count */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">
                        Total Labours Count
                      </Label>
                      <Input
                        type="number"
                        placeholder="Enter labours count..."
                        value={totalLaboursCount}
                        onChange={(e) => setTotalLaboursCount(parseInt(e.target.value))}
                        className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                        min="1"
                      />
                    </div>

                    {/* Voucher Number */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">
                        Voucher Number
                      </Label>
                      <Input
                        type="text"
                        placeholder="Enter voucher number..."
                        value={voucherNo}
                        onChange={(e) => setVoucherNo(e.target.value)}
                        className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                      />
                    </div>

                    {/* Start Time */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Start Time
                      </Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                      />
                    </div>

                    {/* End Time */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        End Time
                      </Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                      />
                    </div>
                  </div>

                  {/* Verified By */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Verified By (Optional)
                    </Label>
                    <Select value={verifiedBy} onValueChange={setVerifiedBy}>
                      <SelectTrigger className="h-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                        <SelectValue placeholder="Select verifier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            <span className="font-medium text-sm">{user.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Remarks
                    </Label>
                    <Textarea
                      placeholder="Enter any additional remarks..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Image Upload Section */}
              <Card className="shadow-sm border border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="h-5 w-5" />
                    <span>Upload Images</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                          <p className="text-xs text-gray-500">PNG, JPG, JPEG (MAX. 10MB each)</p>
                      </div>
                      <input
                        id="image-upload"
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>

                  {/* Display uploaded images */}
                  {images.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Uploaded Images:</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {images.map((image) => (
                          <div key={image.id} className="relative group">
                            <img
                              src={`data:image/jpeg;base64,${image.image}`}
                              alt={image.name}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              onClick={() => removeImage(image.id)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <p className="text-xs text-gray-500 mt-1 truncate">{image.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>


              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedHamaliType || !selectedTransferType || !selectedFromLocation || !selectedToLocation || stockItems.length === 0}
                  className="bg-black hover:bg-gray-800 text-white font-semibold px-8 py-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? ( 
                    <>
                      <Loader text="Creating..." />
                      Creating Entry...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Create Hamali Entry
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


// api/get-stock-items
