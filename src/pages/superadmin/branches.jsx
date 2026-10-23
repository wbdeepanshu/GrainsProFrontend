import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  Info,
  Pencil,
  Eye
} from "lucide-react";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Menu } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const getAddressComponent = (components, type) => {
  const component = (components || []).find((item) => item.types?.includes(type));
  return component?.long_name || "";
};

export default function Branches() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    branch_id: "",
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    lat: "",
    long: "",
    is_active: true,
  });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    const user = localStorage.getItem("superadmin_user");
    
    if (!token || !user) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  // If organization_id is provided in URL, preselect it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get("organization_id");
    if (orgId) {
      setSelectedOrganization(orgId);
    }
  }, []);

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery({
    queryKey: ['superadmin-organizations'],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("superadmin_token");
        const response = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/organizations/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch organizations' }));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to fetch organizations`);
        }
        
        const result = await response.json();
        if (result.status === 200) {
          return result.data || [];
        } else {
          throw new Error(result.message || result.error || 'Failed to fetch organizations');
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
        throw err;
      }
    },
  });

  // Fetch branches
  const { data: branchesData, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-branches', selectedOrganization, page],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("superadmin_token");
        let url = `${API_BASE_URL}/api/superadmin/super-admin/branches/`;
        const params = new URLSearchParams();
        if (selectedOrganization) {
          params.append('organization_id', selectedOrganization);
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch branches' }));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to fetch branches`);
        }
        
        const result = await response.json();
        if (result.status === 200) {
          return result.data || [];
        } else {
          throw new Error(result.message || result.error || 'Failed to fetch branches');
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
        throw err;
      }
    },
  });

  const filteredBranches = branchesData?.filter(branch =>
    branch.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.organization_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.state?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(branch.pincode || "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  const handleViewDetails = (branch) => {
    setSelectedBranch(branch);
    setIsDetailsDialogOpen(true);
  };

  const handleEditBranch = (branch) => {
    setEditForm({
      branch_id: branch.id || "",
      name: branch.name || "",
      address: branch.address || "",
      city: branch.city || "",
      state: branch.state || "",
      pincode: branch.pincode || "",
      lat: branch.lat || "",
      long: branch.long || "",
      is_active: !!branch.is_active,
    });
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setAddressError("");
    setIsEditDialogOpen(true);
  };

  const normalizeGoogleAddressComponent = (component) => ({
    types: component?.types || [],
    long_name: component?.longText || component?.long_name || "",
    short_name: component?.shortText || component?.short_name || "",
  });

  const applyGooglePlaceDetailsToEditForm = (placeData) => {
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

    setEditForm((prev) => ({
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
      setAddressError("Google Maps API key missing. Please configure VITE_GOOGLE_MAPS_API_KEY.");
      return;
    }
    if (!query || query.trim().length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    setAddressLoading(true);
    setAddressError("");
    try {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
        },
        body: JSON.stringify({ input: query.trim() }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Autocomplete failed (${response.status})`);
      }
      const data = await response.json();
      const suggestions = (data?.suggestions || [])
        .map((item) => item?.placePrediction)
        .filter(Boolean)
        .map((prediction) => ({
          placeId: prediction.placeId,
          label: prediction?.text?.text || "",
        }));
      setAddressSuggestions(suggestions);
      setShowAddressSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error("Superadmin branch autocomplete failed:", error);
      setAddressError(error?.message || "Failed to fetch suggestions");
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    } finally {
      setAddressLoading(false);
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
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Place details failed (${response.status})`);
      }
      const placeData = await response.json();
      applyGooglePlaceDetailsToEditForm(placeData);
    } catch (error) {
      console.error("Superadmin branch place details failed:", error);
      setAddressError(error?.message || "Failed to fetch selected address details");
    }
  };

  const handleSaveBranch = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem("superadmin_token");
      const response = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/branches/update/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();
      if (!response.ok || result?.status !== 200) {
        throw new Error(result?.message || result?.error || "Failed to update branch");
      }
      toast({
        title: "Updated",
        description: "Branch updated successfully.",
        variant: "success",
      });
      setIsEditDialogOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update branch.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  const totalPages = Math.ceil(filteredBranches.length / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedBranches = filteredBranches.slice(startIndex, startIndex + perPage);

  if (isLoading) {
    return <CommonLoader />;
  }

  if (error) {
    return (
      <div className="flex h-screen">
        <SuperAdminSidebar />
        <div className="flex-1 p-8">
          <div className="text-red-500">Error loading branches: {error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="mr-1"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLocation("/superadmin/organizations")}
              className="text-gray-700 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search branches by name, organization, city, or state..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="w-full md:w-64">
                    <select
                      value={selectedOrganization || ""}
                      onChange={(e) => {
                        setSelectedOrganization(e.target.value || null);
                        setPage(1);
                      }}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white"
                    >
                      <option value="">All Organizations</option>
                      {organizationsData?.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Branches Listing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  All Branches ({filteredBranches.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paginatedBranches.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No branches found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-600">
                            <th className="py-3 pr-4 font-medium">Branch Name</th>
                            <th className="py-3 pr-4 font-medium">Organization</th>
                            <th className="py-3 pr-4 font-medium">City</th>
                            <th className="py-3 pr-4 font-medium">State</th>
                            <th className="py-3 pr-4 font-medium">Pincode</th>
                            <th className="py-3 pr-4 font-medium">Status</th>
                            <th className="py-3 pr-4 font-medium">Created At</th>
                            <th className="py-3 pr-4 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBranches.map((branch) => (
                            <tr key={branch.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 pr-4 font-medium text-gray-900">{branch.name || "-"}</td>
                              <td className="py-3 pr-4 text-gray-700">{branch.organization_name || "-"}</td>
                              <td className="py-3 pr-4 text-gray-700">{branch.city || "-"}</td>
                              <td className="py-3 pr-4 text-gray-700">{branch.state || "-"}</td>
                              <td className="py-3 pr-4 text-gray-700">{branch.pincode || "-"}</td>
                              <td className="py-3 pr-4">
                                <Badge variant={branch.is_active ? "default" : "secondary"}>
                                  {branch.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </td>
                              <td className="py-3 pr-4 text-gray-700">{branch.created_at || "-"}</td>
                              <td className="py-3 pr-4">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditBranch(branch)}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDetails(branch)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                   
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(startIndex + perPage, filteredBranches.length)} of {filteredBranches.length} branches
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="text-sm text-gray-600">
                        Page {page} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Branch Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Branch Details
            </DialogTitle>
          </DialogHeader>
          {selectedBranch ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Branch Name</p>
                <p className="font-medium text-gray-900">{selectedBranch.name || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Branch ID</p>
                <p className="font-medium text-gray-900">{selectedBranch.id || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Organization</p>
                <p className="font-medium text-gray-900">{selectedBranch.organization_name || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Organization ID</p>
                <p className="font-medium text-gray-900">{selectedBranch.organization_id || "-"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{selectedBranch.address || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">City</p>
                <p className="font-medium text-gray-900">{selectedBranch.city || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">State</p>
                <p className="font-medium text-gray-900">{selectedBranch.state || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Pincode</p>
                <p className="font-medium text-gray-900">{selectedBranch.pincode || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Latitude</p>
                <p className="font-medium text-gray-900">{selectedBranch.lat || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Longitude</p>
                <p className="font-medium text-gray-900">{selectedBranch.long || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Contact Person</p>
                <p className="font-medium text-gray-900">{selectedBranch.contact_person || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Designation</p>
                <p className="font-medium text-gray-900">{selectedBranch.contact_designation || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">Margin Percent</p>
                <p className="font-medium text-gray-900">
                  {selectedBranch.margin_percent !== undefined && selectedBranch.margin_percent !== null
                    ? `${selectedBranch.margin_percent}%`
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <Badge variant={selectedBranch.is_active ? "default" : "secondary"}>
                  {selectedBranch.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Created At</p>
                <p className="font-medium text-gray-900">{selectedBranch.created_at || "-"}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="md:col-span-2">
              <p className="text-gray-500 mb-1">Branch Name</p>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-500 mb-1">Address</p>
              <div className="relative">
                <Input
                  value={editForm.address}
                  onChange={(e) => {
                    setEditForm((p) => ({ ...p, address: e.target.value }));
                    void fetchAddressSuggestions(e.target.value);
                  }}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowAddressSuggestions(true);
                  }}
                  autoComplete="off"
                />
                {showAddressSuggestions && (
                  <div className="absolute z-[200] mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-auto">
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                        onClick={() => {
                          setEditForm((p) => ({ ...p, address: suggestion.label }));
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
                Coordinates: {editForm.lat || "-"}, {editForm.long || "-"}
              </p>
              {addressLoading && <p className="mt-1 text-xs text-blue-600">Fetching address suggestions...</p>}
              {addressError && <p className="mt-1 text-xs text-red-600">{addressError}</p>}
            </div>
            <div>
              <p className="text-gray-500 mb-1">City</p>
              <Input
                value={editForm.city}
                onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div>
              <p className="text-gray-500 mb-1">State</p>
              <Input
                value={editForm.state}
                onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
              />
            </div>
            <div>
              <p className="text-gray-500 mb-1">Pincode</p>
              <Input
                value={editForm.pincode}
                onChange={(e) => setEditForm((p) => ({ ...p, pincode: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editForm.is_active}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Is Active
              </label>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveBranch} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
