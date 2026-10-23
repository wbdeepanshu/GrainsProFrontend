import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, ChevronLeft, ChevronRight, Building2, CheckCircle, XCircle, Menu, RefreshCw, Filter, X, Plus, Edit, Trash2, MapPin, User, Percent, LocateFixed } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const ITEMS_PER_PAGE = 25;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const getAddressComponent = (components, type) => {
  const component = (components || []).find((item) => item.types?.includes(type));
  return component?.long_name || "";
};

export default function BranchSettings() {
  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressSuggestionsLoading, setAddressSuggestionsLoading] = useState(false);
  const [addressApiError, setAddressApiError] = useState("");
  const [addressTarget, setAddressTarget] = useState("add");
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  const [currentLocationTarget, setCurrentLocationTarget] = useState("add");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    contact_person: "",
    contact_designation: "",
    margin_percent: "0",
    is_active: true,
    lat: "",
    long: "",
  });

  // Hooks
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissions();

  const canManageMargin = useMemo(() => {
    return (permissions || []).some((permission) => {
      const alias = String(permission?.alias || "").toLowerCase();
      const moduleName = String(permission?.module_name || "").toLowerCase();
      return (
        alias === "margin_settings" ||
        alias === "branch_settings" ||
        moduleName.includes("margin settings") ||
        moduleName.includes("branch settings")
      );
    });
  }, [permissions]);

  // API Fetch Function
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
      return data;
    } catch (error) {
      console.error("Error fetching branches:", error);
      throw error;
    }
  };

  // Update Function
  const updateBranch = async (branchId, data) => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/add-branch/${branchId}/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error updating branch:", error);
      throw error;
    }
  };

  // Create Function
  const createBranch = async (data) => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/add-branch/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error creating branch:", error);
      throw error;
    }
  };

  // React Query hooks
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['branches', currentPage, searchTerm],
    queryFn: fetchBranches,
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: ({ branchId, data }) => updateBranch(branchId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['branches']);
      toast({
        title: "Success",
        description: data.message || "Branch updated successfully",
      });
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update branch",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => createBranch(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['branches']);
      toast({
        title: "Success",
        description: data.message || "Branch created successfully",
      });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create branch",
        variant: "destructive",
      });
    },
  });

  // Computed values
  const branches = data?.data || [];
  const totalBranches = data?.total_branches || branches.length;

  // Processed data with search
  const filteredBranches = useMemo(() => {
    if (!searchTerm.trim()) return branches;

    const searchLower = searchTerm.toLowerCase();
    return branches.filter(branch =>
      branch.name?.toLowerCase().includes(searchLower) ||
      branch.city?.toLowerCase().includes(searchLower) ||
      branch.state?.toLowerCase().includes(searchLower) ||
      branch.contact_person?.toLowerCase().includes(searchLower)
    );
  }, [branches, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredBranches.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedBranches = filteredBranches.slice(startIndex, endIndex);

  // Form handlers
  const resetAddressState = () => {
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setAddressSuggestionsLoading(false);
    setAddressApiError("");
    setAddressTarget("add");
    setCurrentLocationLoading(false);
    setCurrentLocationTarget("add");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      contact_person: "",
      contact_designation: "",
      margin_percent: "0",
      is_active: true,
      lat: "",
      long: "",
    });
    setEditingItem(null);
    resetAddressState();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEdit = (item) => {
    resetAddressState();
    setFormData({
      name: item.name || "",
      address: item.address || "",
      city: item.city || "",
      state: item.state || "",
      pincode: item.pincode || "",
      contact_person: item.contact_person || "",
      contact_designation: item.contact_designation || "",
      margin_percent: item.margin_percent ?? "0",
      is_active: item.is_active,
      lat: item.lat || "",
      long: item.long || "",
    });
    setEditingItem(item);
    setIsEditDialogOpen(true);
    setAddressTarget("edit");
  };

  const normalizeGoogleAddressComponent = (component) => ({
    types: component?.types || [],
    long_name: component?.longText || component?.long_name || "",
    short_name: component?.shortText || component?.short_name || "",
  });

  const applyGooglePlaceDetailsToForm = (placeData) => {
    const rawComponents = placeData?.addressComponents || placeData?.address_components || [];
    const components = rawComponents.map(normalizeGoogleAddressComponent);

    const cityFromPlace =
      getAddressComponent(components, "locality") ||
      getAddressComponent(components, "administrative_area_level_2") ||
      getAddressComponent(components, "sublocality") ||
      getAddressComponent(components, "postal_town");
    const stateFromPlace = getAddressComponent(components, "administrative_area_level_1");
    const pincodeFromPlace = getAddressComponent(components, "postal_code");

    const latValue =
      placeData?.location?.latitude ??
      placeData?.location?.lat ??
      placeData?.geometry?.location?.lat ??
      "";
    const longValue =
      placeData?.location?.longitude ??
      placeData?.location?.lng ??
      placeData?.geometry?.location?.lng ??
      "";

    setFormData((prev) => ({
      ...prev,
      address: placeData?.formattedAddress || placeData?.formatted_address || prev.address,
      city: cityFromPlace || prev.city,
      state: stateFromPlace || prev.state,
      pincode: pincodeFromPlace || prev.pincode,
      lat: latValue !== "" ? String(latValue) : prev.lat,
      long: longValue !== "" ? String(longValue) : prev.long,
    }));
  };

  const fetchAddressSuggestions = async (query) => {
    if (!GOOGLE_MAPS_API_KEY) {
      setAddressApiError("Google Maps API key is missing. Please set VITE_GOOGLE_MAPS_API_KEY.");
      return;
    }
    if (!query || query.trim().length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setAddressSuggestionsLoading(true);
    setAddressApiError("");

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
        },
        body: JSON.stringify({
          input: query.trim(),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error?.message || `Autocomplete failed (${response.status})`);
      }

      const data = await response.json();
      const suggestions =
        (data?.suggestions || [])
          .map((item) => item?.placePrediction)
          .filter(Boolean)
          .map((prediction) => ({
            placeId: prediction.placeId,
            label:
              prediction?.text?.text ||
              prediction?.structuredFormat?.mainText?.text ||
              "",
          })) || [];

      setAddressSuggestions(suggestions);
      setShowAddressSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error("Google address autocomplete failed:", error);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setAddressApiError(error?.message || "Failed to fetch address suggestions");
    } finally {
      setAddressSuggestionsLoading(false);
    }
  };

  const fetchAndApplyPlaceDetails = async (placeId) => {
    if (!placeId || !GOOGLE_MAPS_API_KEY) return;
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=formattedAddress,addressComponents,location`,
        {
          headers: {
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          },
        }
      );
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error?.message || `Place details failed (${response.status})`);
      }
      const placeData = await response.json();
      applyGooglePlaceDetailsToForm(placeData);
    } catch (error) {
      console.error("Google place details fetch failed:", error);
      setAddressApiError(error?.message || "Failed to fetch selected address details");
    }
  };

  const reverseGeocodeCoordinates = async (latitude, longitude) => {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${latitude},${longitude}`)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error_message || `Reverse geocoding failed (${response.status})`);
    }

    if (data?.status !== "OK" || !data?.results?.length) {
      throw new Error(data?.error_message || "Current location address could not be resolved.");
    }

    const firstResult = data.results[0];
    applyGooglePlaceDetailsToForm({
      formattedAddress: firstResult.formatted_address,
      addressComponents: firstResult.address_components,
      location: {
        latitude,
        longitude,
      },
    });
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser.");
    }

    const getPosition = (options) =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    const getPositionByWatch = (options) =>
      new Promise((resolve, reject) => {
        let watchId = null;
        const timeoutId = window.setTimeout(() => {
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
          }
          reject({ code: 3, message: "Location watch timed out." });
        }, options.timeout ?? 15000);

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            window.clearTimeout(timeoutId);
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
            }
            resolve(position);
          },
          (error) => {
            window.clearTimeout(timeoutId);
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
            }
            reject(error);
          },
          options
        );
      });

    try {
      return await getPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      });
    } catch (firstError) {
      console.warn("[branch-location] getCurrentPosition(high-accuracy) failed:", firstError);
      try {
        return await getPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      } catch (secondError) {
        console.warn("[branch-location] getCurrentPosition(relaxed) failed:", secondError);
        return await getPositionByWatch({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 120000,
        });
      }
    }
  };

  const fetchCurrentLocation = async (target) => {
    if (!GOOGLE_MAPS_API_KEY) {
      setAddressApiError("Google Maps API key is missing. Please set VITE_GOOGLE_MAPS_API_KEY.");
      return;
    }

    setCurrentLocationTarget(target);
    setCurrentLocationLoading(true);
    setAddressTarget(target);
    setAddressApiError("");
    setShowAddressSuggestions(false);

    try {
      if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        throw new Error("Location access requires HTTPS or localhost.");
      }

      const position = await getCurrentLocation();
      const latitude = position?.coords?.latitude;
      const longitude = position?.coords?.longitude;
      if (latitude == null || longitude == null) {
        throw new Error("Unable to read current coordinates.");
      }

      await reverseGeocodeCoordinates(latitude, longitude);

      toast({
        title: "Current location added",
        description: "Address details were filled from your device location.",
      });
    } catch (error) {
      console.error("Current location fetch failed:", error);
      let message = error?.message || "Failed to fetch current location.";
      if (typeof error?.code === "number") {
        if (error.code === 1) message = "Location permission denied. Please allow location access and try again.";
        if (error.code === 2) message = "Current location is unavailable right now.";
        if (error.code === 3) message = "Timed out while fetching current location.";
      }
      setAddressApiError(message);
    } finally {
      setCurrentLocationLoading(false);
    }
  };

  const renderAddressField = ({ target, id, label, required = false }) => (
    <div>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={formData.address}
          onChange={(e) => {
            handleInputChange("address", e.target.value);
            setAddressTarget(target);
            void fetchAddressSuggestions(e.target.value);
          }}
          onFocus={() => {
            if (addressTarget === target && addressSuggestions.length > 0) {
              setShowAddressSuggestions(true);
            }
          }}
          placeholder="Type address or use current location"
          autoComplete="off"
          required={required}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => void fetchCurrentLocation(target)}
          disabled={currentLocationLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="Use current location"
          aria-label="Use current location"
        >
          <LocateFixed className={`h-4 w-4 ${currentLocationLoading && currentLocationTarget === target ? "animate-pulse" : ""}`} />
        </button>
        {addressTarget === target && showAddressSuggestions && (
          <div className="absolute z-[200] mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-auto">
            {addressSuggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                onClick={() => {
                  handleInputChange("address", suggestion.label);
                  setShowAddressSuggestions(false);
                  void fetchAndApplyPlaceDetails(suggestion.placeId);
                }}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Coordinates: {formData.lat || "-"}, {formData.long || "-"}
      </p>
      {addressTarget === target && addressSuggestionsLoading && (
        <p className="text-xs text-blue-600 mt-1">Fetching address suggestions...</p>
      )}
      {currentLocationLoading && currentLocationTarget === target && (
        <p className="text-xs text-blue-600 mt-1">Fetching current location...</p>
      )}
      {addressTarget === target && addressApiError && (
        <p className="text-xs text-red-600 mt-1">{addressApiError}</p>
      )}
    </div>
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Branch name is required",
        variant: "destructive",
      });
      return;
    }

    const parsedMarginPercent = parseFloat(formData.margin_percent);
    const safeMarginPercent = Number.isFinite(parsedMarginPercent) ? parsedMarginPercent : 0;

    const submitData = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      pincode: formData.pincode.trim(),
      contact_person: formData.contact_person.trim(),
      contact_designation: formData.contact_designation.trim(),
      margin_percent: canManageMargin ? safeMarginPercent : 0,
      is_active: formData.is_active,
      lat: formData.lat?.trim() || "",
      long: formData.long?.trim() || "",
    };

    updateMutation.mutate({
      branchId: editingItem.id,
      data: submitData
    });
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Loading state
  if (isLoading) {
    return <CommonLoader />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {isMobile ? (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      ) : (
        <Sidebar />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="p-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <Building2 className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Branch Settings</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsAddDialogOpen(true);
                }}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Branch</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">


          {/* Branches List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Branches ({totalBranches})</span>
                {totalBranches > 0 && (
                  <Badge variant="secondary">
                    Page {currentPage} of {totalPages}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paginatedBranches.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No branches found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm ? "Try adjusting your search criteria" : "Branches will appear here once they are created"}
                  </p>
                  {searchTerm && (
                    <Button
                      variant="outline"
                      onClick={() => setSearchTerm("")}
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Branch Details</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Location</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
                          {canManageMargin && (
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Margin</th>
                          )}
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedBranches.map((branch) => (
                          <tr key={branch.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <Building2 className="h-8 w-8 text-blue-600" />
                                </div>
                                <div className="ml-3">
                                  <div className="font-medium text-gray-900">{branch.name}</div>

                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-gray-900">
                                {branch.city && branch.state ? (
                                  <>
                                    <div className="flex items-center">
                                      <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                                      {branch.city}, {branch.state}
                                    </div>

                                  </>
                                ) : (
                                  <span className="text-gray-400">Not specified</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-gray-900">
                                {branch.contact_person ? (
                                  <>
                                    <div className="flex items-center">
                                      <User className="h-4 w-4 text-gray-400 mr-1" />
                                      {branch.contact_person}
                                    </div>

                                  </>
                                ) : (
                                  <span className="text-gray-400">Not specified</span>
                                )}
                              </div>
                            </td>
                            {canManageMargin && (
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    {branch.margin_percent || 0}%
                                  </Badge>
                                </div>
                              </td>
                            )}
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                {branch.is_active ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className={`text-sm ${branch.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                  {branch.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(branch)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
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
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-500">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredBranches.length)} of {filteredBranches.length} results
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
                        <span className="text-sm text-gray-500">
                          Page {currentPage} of {totalPages}
                        </span>
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Branch Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={`grid grid-cols-1 gap-4 ${canManageMargin ? "md:grid-cols-2" : ""}`}>
              <div>
                <Label htmlFor="name">Branch Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter branch name"
                  required
                />
              </div>
              {canManageMargin && (
                <div>
                  <Label htmlFor="margin_percent">Margin Percentage</Label>
                  <Input
                    id="margin_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.margin_percent}
                    onChange={(e) => handleInputChange('margin_percent', e.target.value)}
                    placeholder="Enter margin percentage"
                  />
                </div>
              )}
            </div>

            {renderAddressField({ target: "edit", id: "address", label: "Address" })}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Enter city"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="Enter state"
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange('pincode', e.target.value)}
                  placeholder="Enter pincode"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => handleInputChange('contact_person', e.target.value)}
                  placeholder="Enter contact person name"
                />
              </div>
              <div>
                <Label htmlFor="contact_designation">Contact Designation</Label>
                <Input
                  id="contact_designation"
                  value={formData.contact_designation}
                  onChange={(e) => handleInputChange('contact_designation', e.target.value)}
                  placeholder="Enter contact designation"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Active Branch</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateMutation.isPending ? "Updating..." : "Update Branch"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (!formData.name.trim() || !formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.pincode.trim()) {
                toast({
                  title: "Validation Error",
                  description: "Name, Address, City, State and Pincode are required",
                  variant: "destructive",
                });
                return;
              }

              createMutation.mutate({
                name: formData.name.trim(),
                address: formData.address.trim(),
                city: formData.city.trim(),
                state: formData.state.trim(),
                pincode: formData.pincode.trim(),
                contact_person: formData.contact_person.trim(),
                contact_designation: formData.contact_designation.trim(),
                margin_percent: canManageMargin
                  ? (Number.isFinite(parseFloat(formData.margin_percent)) ? parseFloat(formData.margin_percent) : 0)
                  : 0,
                is_active: formData.is_active,
                lat: formData.lat?.trim() || "",
                long: formData.long?.trim() || "",
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add_name">Branch Name *</Label>
                <Input
                  id="add_name"
                  value={formData.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      handleInputChange("name", value);
                    }
                  }}
                  placeholder="Enter branch name"
                  required
                  maxLength={35}
                />
              </div>
              <div>
                <Label htmlFor="add_pincode">Pincode *</Label>
                <Input
                  id="add_pincode"
                  value={formData.pincode}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*$/.test(value)) {
                      handleInputChange("pincode", value);
                    }
                  }}
                  placeholder="Enter pincode"
                  required
                  maxLength={6}
                />
              </div>
            </div>

            {renderAddressField({ target: "add", id: "add_address", label: "Address", required: true })}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add_city">City *</Label>
                <Input
                  id="add_city"
                  value={formData.city}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      handleInputChange("city", value);
                    }
                  }}
                  placeholder="Enter city"
                  required
                  maxLength={20}
                />
              </div>
              <div>
                <Label htmlFor="add_state">State *</Label>
                <Input
                  id="add_state"
                  value={formData.state}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      handleInputChange("state", value);
                    }
                  }}
                  placeholder="Enter state"
                  required
                  maxLength={20}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add_contact_person">Contact Person</Label>
                <Input
                  id="add_contact_person"
                  value={formData.contact_person}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      handleInputChange("contact_person", value);
                    }
                  }}
                  placeholder="Enter contact person name"
                  maxLength={30}
                />
              </div>
              <div>
                <Label htmlFor="add_contact_designation">Contact Designation</Label>
                <Input
                  id="add_contact_designation"
                  value={formData.contact_designation}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      handleInputChange("contact_designation", value);
                    }
                  }}
                  placeholder="Enter contact designation"
                  maxLength={30}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="add_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="add_is_active">Active Branch</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending ? "Creating..." : "Create Branch"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}