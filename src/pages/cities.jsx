import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, ChevronLeft, ChevronRight, MapPin, CheckCircle, XCircle, Menu, RefreshCw, Filter, X, Plus, Edit, Trash2 } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const ITEMS_PER_PAGE = 25;

const CITY_TYPES = [
  { value: "METRO", label: "Metro" },
  { value: "TIER_1", label: "Tier 1" },
  { value: "TIER_2", label: "Tier 2" },
  { value: "TIER_3", label: "Tier 3" },
  { value: "RURAL", label: "Rural" },
];

export default function Cities() {
  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    district_id: "",
    city_type: "",
    margin_percent: "",
    pin_codes: "",
    is_active: true
  });
  
  // Hooks
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { hasCreatePermission, hasUpdatePermission, hasDeletePermission } = useUserPermissions();

  // API Fetch Function
  const fetchCities = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const params = new URLSearchParams({
        page: "1",
        page_size: "500",
      });

      const response = await fetch(`${backendUrl}/api/accounts/cities/?${params}`, {
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
      console.error("Error fetching cities:", error);
      throw error;
    }
  };

  // Fetch Districts for dropdown
  const fetchDistricts = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/accounts/districts/?page_size=1000`, {
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
      console.error("Error fetching districts:", error);
      return [];
    }
  };

  // Create/Update Function
  const createUpdateCity = async (data) => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/accounts/create-city/`, {
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
      console.error("Error creating/updating city:", error);
      throw error;
    }
  };

  // React Query hooks
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    retry: 1,
  });

  const { data: districtsData } = useQuery({
    queryKey: ['districts-for-cities'],
    queryFn: fetchDistricts,
    retry: 1,
  });

  const createUpdateMutation = useMutation({
    mutationFn: createUpdateCity,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['cities']);
      toast({
        title: "Success",
        description: data.message || "City saved successfully",
      });
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save city",
        variant: "destructive",
      });
    },
  });

  // Computed values
  const cities = data?.data || [];
  const districts = districtsData || [];

  const filteredCities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return cities;

    return cities.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const district = String(item.district_name || item.district?.name || "").toLowerCase();
      const state = String(item.state_name || item.state?.name || "").toLowerCase();
      const cityType = String(item.city_type || "").toLowerCase();
      const margin = String(item.margin_percent ?? "").toLowerCase();
      const pinCodes = String(item.pin_codes || "").toLowerCase();
      return (
        name.includes(term) ||
        district.includes(term) ||
        state.includes(term) ||
        cityType.includes(term) ||
        margin.includes(term) ||
        pinCodes.includes(term)
      );
    });
  }, [cities, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCities.length / ITEMS_PER_PAGE));

  const paginatedCities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCities, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Form handlers
  const resetForm = () => {
    setFormData({
      name: "",
      district_id: "",
      city_type: "",
      margin_percent: "",
      pin_codes: "",
      is_active: true
    });
    setEditingItem(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name || "",
      district_id: item.district?.id || "",
      city_type: item.city_type || "",
      margin_percent: item.margin_percent || "",
      pin_codes: item.pin_codes || "",
      is_active: item.is_active
    });
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "City name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.district_id) {
      toast({
        title: "Validation Error",
        description: "District selection is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.city_type) {
      toast({
        title: "Validation Error",
        description: "City type selection is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.margin_percent || isNaN(parseFloat(formData.margin_percent))) {
      toast({
        title: "Validation Error",
        description: "Valid margin percentage is required",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
      margin_percent: parseFloat(formData.margin_percent)
    };

    createUpdateMutation.mutate(submitData);
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  // Loading state
  if (isLoading && !data) {
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
                <MapPin className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Cities</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {hasCreatePermission("margin_settings") && (
                <Button
                  onClick={handleCreate}
                  className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add City</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Search and Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search cities..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center space-x-1"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cities List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Cities ({filteredCities.length}
                  {searchTerm.trim() && filteredCities.length !== cities.length
                    ? ` of ${cities.length}`
                    : ""}
                  )
                </span>
                {filteredCities.length > 0 && (
                  <Badge variant="secondary">
                    Page {currentPage} of {totalPages}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCities.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm.trim() ? "No cities match your search" : "No cities found"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm.trim() ? "Try adjusting your search criteria" : "Get started by creating your first city"}
                  </p>
                  {!searchTerm.trim() && hasCreatePermission("margin_settings") && (
                    <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add City
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">District</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">State</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Margin %</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Created</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCities.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{item.name}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-gray-600">{item.district_name || "—"}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-gray-600">{item.state_name || "—"}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{item.city_type || "—"}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={item.margin_percent >= 0 ? "default" : "destructive"}>
                                {item.margin_percent > 0 ? "+" : ""}{item.margin_percent}%
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                {item.is_active ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className={`text-sm ${item.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                  className="h-8 w-8 p-0"
                                  disabled={!hasUpdatePermission("margin_settings")}
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
                        Showing {filteredCities.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredCities.length)} of{" "}
                        {filteredCities.length} results
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add City</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter city name"
                required
              />
            </div>
            <div>
              <Label htmlFor="district_id">District *</Label>
              <Select value={formData.district_id} onValueChange={(value) => handleInputChange('district_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a district" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((district) => (
                    <SelectItem key={district.id} value={district.id.toString()}>
                      {district.name} ({district.state_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="city_type">City Type *</Label>
              <Select value={formData.city_type} onValueChange={(value) => handleInputChange('city_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city type" />
                </SelectTrigger>
                <SelectContent>
                  {CITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="margin_percent">Margin Percentage *</Label>
              <Input
                id="margin_percent"
                type="number"
                step="0.01"
                value={formData.margin_percent}
                onChange={(e) => handleInputChange('margin_percent', e.target.value)}
                placeholder="Enter margin percentage"
                required
              />
            </div>
            <div>
              <Label htmlFor="pin_codes">PIN Codes</Label>
              <Input
                id="pin_codes"
                value={formData.pin_codes}
                onChange={(e) => handleInputChange('pin_codes', e.target.value)}
                placeholder="Enter PIN codes (comma separated)"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUpdateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createUpdateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit City</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter city name"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_district_id">District *</Label>
              <Select value={formData.district_id} onValueChange={(value) => handleInputChange('district_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a district" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((district) => (
                    <SelectItem key={district.id} value={district.id.toString()}>
                      {district.name} ({district.state_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_city_type">City Type *</Label>
              <Select value={formData.city_type} onValueChange={(value) => handleInputChange('city_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city type" />
                </SelectTrigger>
                <SelectContent>
                  {CITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_margin_percent">Margin Percentage *</Label>
              <Input
                id="edit_margin_percent"
                type="number"
                step="0.01"
                value={formData.margin_percent}
                onChange={(e) => handleInputChange('margin_percent', e.target.value)}
                placeholder="Enter margin percentage"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_pin_codes">PIN Codes</Label>
              <Input
                id="edit_pin_codes"
                value={formData.pin_codes}
                onChange={(e) => handleInputChange('pin_codes', e.target.value)}
                placeholder="Enter PIN codes (comma separated)"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="edit_is_active">Active</Label>
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
                disabled={createUpdateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createUpdateMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
