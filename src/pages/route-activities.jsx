import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Menu,
  RefreshCw,
  Filter,
  X,
  Plus,
  Edit,
  ClipboardList,
  MapPin,
} from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const ITEMS_PER_PAGE = 25;

const normalizeBranchIds = (ids = []) =>
  ids.map((id) => String(id).trim()).filter(Boolean);

const getAllBranchIds = (branchList = []) =>
  branchList.map((branch) => String(branch.id).trim()).filter(Boolean);

const buildAliasFromName = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
    .join("_");

const defaultFormData = {
  id: null,
  name: "",
  branch_ids: [],
  is_active: true,
  is_visit_required: true,
};

export default function RouteActivities() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("Active");
  const [selectedVisitRequired, setSelectedVisitRequired] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    isLoading: permissionsLoading,
  } = useUserPermissions();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_BASE_URL;

  const getAuthHeaders = () => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const fetchRouteActivities = async () => {
    const params = new URLSearchParams({
      page: "1",
      page_size: "500",
    });

    if (selectedBranch !== "All") params.set("branch_id", selectedBranch);
    if (selectedStatus === "Active") params.set("is_active", "true");
    else if (selectedStatus === "Inactive") params.set("is_active", "false");
    else params.set("is_active", "all");
    if (selectedVisitRequired === "Yes") params.set("is_visit_required", "true");
    else if (selectedVisitRequired === "No") params.set("is_visit_required", "false");

    const response = await fetch(`${backendUrl}/api/growth/route-activity-names/?${params}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    return data;
  };

  const fetchBranches = async () => {
    const response = await fetch(`${backendUrl}/api/get-branches/`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  };

  const saveRouteActivity = async (payload) => {
    const response = await fetch(`${backendUrl}/api/growth/route-activity-name/create/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    return data;
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "route-activity-names",
      selectedBranch,
      selectedStatus,
      selectedVisitRequired,
    ],
    queryFn: fetchRouteActivities,
    retry: 1,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-for-route-activities"],
    queryFn: fetchBranches,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: saveRouteActivity,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["route-activity-names"] });
      toast({
        title: "Success",
        description: result.message || "Route activity saved successfully",
      });
      setIsFormDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to save route activity",
        variant: "destructive",
      });
    },
  });

  const activities = data?.data || [];

  const getActivitySearchText = (item) => {
    const parts = [
      item.name,
      item.alias_name,
      item.is_active ? "active" : "inactive",
      item.is_visit_required ? "yes visit required" : "no visit required",
    ];
    (item.branches || []).forEach((branch) => {
      parts.push(branch?.name);
    });
    return parts.filter(Boolean).join(" ").toLowerCase();
  };

  const filteredActivities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activities;
    return activities.filter((item) => getActivitySearchText(item).includes(term));
  }, [activities, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / ITEMS_PER_PAGE));

  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredActivities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredActivities, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setFormData(defaultFormData);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleBranch = (branchId) => {
    const normalizedId = String(branchId).trim();
    setFormData((prev) => {
      const ids = normalizeBranchIds(prev.branch_ids || []);
      const next = ids.includes(normalizedId)
        ? ids.filter((id) => id !== normalizedId)
        : [...ids, normalizedId];
      return { ...prev, branch_ids: next };
    });
  };

  const handleCreate = () => {
    setFormData({
      ...defaultFormData,
      branch_ids: getAllBranchIds(branches),
    });
    setIsFormDialogOpen(true);
  };

  useEffect(() => {
    if (isFormDialogOpen && !formData.id && branches.length > 0 && formData.branch_ids.length === 0) {
      setFormData((prev) => ({
        ...prev,
        branch_ids: getAllBranchIds(branches),
      }));
    }
  }, [isFormDialogOpen, formData.id, formData.branch_ids.length, branches]);

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name || "",
      branch_ids: item.branch_ids?.length
        ? normalizeBranchIds(item.branch_ids)
        : getAllBranchIds(branches),
      is_active: item.is_active ?? true,
      is_visit_required: item.is_visit_required ?? true,
    });
    setIsFormDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Activity name is required",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formData.name.trim(),
      alias_name: buildAliasFromName(formData.name),
      branch_ids: formData.branch_ids?.length
        ? normalizeBranchIds(formData.branch_ids)
        : getAllBranchIds(branches),
      is_active: formData.id ? formData.is_active : true,
      is_visit_required: formData.is_visit_required,
    };

    if (formData.id) {
      payload.id = formData.id;
    }

    saveMutation.mutate(payload);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedBranch("All");
    setSelectedStatus("Active");
    setSelectedVisitRequired("All");
    setCurrentPage(1);
  };

  const isEditing = Boolean(formData.id);
  const canSave = isEditing ? hasUpdatePermission("route_management") : hasCreatePermission("route_management");

  if (isLoading && !data) {
    return <CommonLoader />;
  }

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

  if (!hasReadPermission("route_management")) {
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
              <ClipboardList className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You don&apos;t have permission to view route activities. Contact your administrator for access.
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
    <div className="flex h-screen bg-gray-50">
      {isMobile ? (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      ) : (
        <Sidebar />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isMobile && (
                <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} className="p-2">
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <ClipboardList className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Activity name</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center space-x-1">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {hasCreatePermission("route_management") && (
                <Button onClick={handleCreate} className="flex items-center space-x-1 bg-blue-600 hover:bg-green-700">
                  <Plus className="h-4 w-4" />
                  <span>Add Activity</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search by name or alias..."
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
                    {(searchTerm || selectedBranch !== "All" || selectedStatus !== "Active" || selectedVisitRequired !== "All") && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="flex items-center space-x-1">
                        <X className="h-4 w-4" />
                        <span>Clear</span>
                      </Button>
                    )}
                  </div>
                </div>

                {showFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Branch</Label>
                      <Select value={selectedBranch} onValueChange={(v) => { setSelectedBranch(v); setCurrentPage(1); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="All branches" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Branches</SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={String(branch.id)}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
                      <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="All">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Visit Required</Label>
                      <Select value={selectedVisitRequired} onValueChange={(v) => { setSelectedVisitRequired(v); setCurrentPage(1); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="p-4 text-red-700">
                {error.message || "Failed to load route activities"}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Activity name ({filteredActivities.length}
                  {searchTerm.trim() && filteredActivities.length !== activities.length
                    ? ` of ${activities.length}`
                    : ""}
                  )
                </span>
                {filteredActivities.length > 0 && (
                  <Badge variant="secondary">
                    Page {currentPage} of {totalPages}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredActivities.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm.trim() ? "No activity names match your search" : "No activity names found"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm.trim() || selectedBranch !== "All" || selectedStatus !== "Active" || selectedVisitRequired !== "All"
                      ? "Try adjusting your filters"
                      : "Get started by creating your first route activity"}
                  </p>
                  {!searchTerm.trim() && hasCreatePermission("route_management") && (
                    <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Activity
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
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Alias</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Branches</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Visit Required</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedActivities.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                            <td className="py-3 px-4 text-gray-600">{item.alias_name || "—"}</td>
                            <td className="py-3 px-4">
                              {item.branches?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.branches.map((branch) => (
                                    <Badge key={branch.id} variant="outline" className="text-xs">
                                      {branch.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">All / Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={item.is_visit_required ? "default" : "secondary"}>
                                {item.is_visit_required ? "Yes" : "No"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                {item.is_active ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className={`text-sm ${item.is_active ? "text-green-600" : "text-red-600"}`}>
                                  {item.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end">
                                {hasUpdatePermission("route_management") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(item)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-500">
                        Showing {filteredActivities.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredActivities.length)} of{" "}
                        {filteredActivities.length} results
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
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
                          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                          disabled={currentPage >= totalPages}
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

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Activity name" : "Add Activity name"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g. Hard Ware"
                maxLength={20}
                required
              />
            </div>
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <MapPin className="h-4 w-4" />
                Branches
              </Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {branches.length === 0 ? (
                  <p className="text-sm text-gray-500">No branches available</p>
                ) : (
                  branches.map((branch) => (
                    <div key={branch.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`branch-${branch.id}`}
                        checked={normalizeBranchIds(formData.branch_ids || []).includes(String(branch.id).trim())}
                        onCheckedChange={() => toggleBranch(branch.id)}
                      />
                      <Label htmlFor={`branch-${branch.id}`} className="text-sm font-normal cursor-pointer">
                        {branch.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_visit_required"
                checked={formData.is_visit_required}
                onCheckedChange={(checked) => handleInputChange("is_visit_required", checked)}
              />
              <Label htmlFor="is_visit_required">Visit Required</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsFormDialogOpen(false)}>
                Cancel
              </Button>
              {canSave && (
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saveMutation.isPending ? "Saving..." : isEditing ? "Update" : "Save"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
