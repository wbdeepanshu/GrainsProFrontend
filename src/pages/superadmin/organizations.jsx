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
  ChevronLeft,
  Eye,
  Pencil
} from "lucide-react";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function Organizations() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTallyRequiredFilter, setIsTallyRequiredFilter] = useState("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    organization_id: "",
    name: "",
    gst_number: "",
    organization_type: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    is_tally_enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    const user = localStorage.getItem("superadmin_user");
    
    if (!token || !user) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  // Fetch organizations
  const { data: organizationsData, isLoading, error, refetch } = useQuery({
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

  const handleViewBranches = (org) => {
    setLocation(`/superadmin/branches?organization_id=${org.id}`);
  };

  const handleEditOrganization = (org) => {
    setEditForm({
      organization_id: org.id || "",
      name: org.name || "",
      gst_number: org.gst_number || "",
      organization_type: org.organization_type || "",
      address: org.address || "",
      city: org.city || "",
      state: org.state || "",
      pincode: org.pincode || "",
      is_tally_enabled: !!org.is_tally_enabled,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveOrganization = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem("superadmin_token");
      const response = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/organizations/update/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();
      if (!response.ok || result?.status !== 200) {
        throw new Error(result?.message || result?.error || "Failed to update organization");
      }

      toast({
        title: "Updated",
        description: "Organization updated successfully.",
        variant: "success",
      });
      setIsEditDialogOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update organization.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredOrganizations = organizationsData?.filter((org) => {
    const tallyEnabled = !!org.is_tally_enabled;
    if (isTallyRequiredFilter === "yes" && !tallyEnabled) return false;
    if (isTallyRequiredFilter === "no" && tallyEnabled) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      org.name?.toLowerCase().includes(q) ||
      org.organization_type?.toLowerCase().includes(q) ||
      org.city?.toLowerCase().includes(q) ||
      org.state?.toLowerCase().includes(q) ||
      String(org.pincode || "").toLowerCase().includes(q)
    );
  }) || [];

  if (isLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <SuperAdminSidebar />}
        <div className="app-main-content flex items-center justify-center">
          <CommonLoader text="Loading organizations..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <SuperAdminSidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="app-main-content flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading organizations: {error.message || 'Unknown error'}</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main-content">
        {/* Mobile Header */}
        {isMobile && (
          <div className="bg-white shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold">Organizations</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="h-8 w-8" />
                  Organizations
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage and view all organizations
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setLocation("/superadmin/dashboard")}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            {/* Search + Tally Required Filter */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-56">
                <select
                  value={isTallyRequiredFilter}
                  onChange={(e) => setIsTallyRequiredFilter(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="all">Tally Required: All</option>
                  <option value="yes">Tally Required: Yes</option>
                  <option value="no">Tally Required: No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Organizations Listing */}
          {filteredOrganizations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  {searchQuery ? "No organizations found matching your search" : "No organizations available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  All Organizations ({filteredOrganizations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-3 pr-4 font-medium">Organization Name</th>
                        <th className="py-3 pr-4 font-medium">Type</th>
                        <th className="py-3 pr-4 font-medium">City</th>
                        <th className="py-3 pr-4 font-medium">State</th>
                        <th className="py-3 pr-4 font-medium">Available Branches</th>
                        <th className="py-3 pr-4 font-medium">Tally Required</th>
                        <th className="py-3 pr-4 font-medium">Created At</th>
                        <th className="py-3 pr-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrganizations.map((org) => (
                        <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-900">{org.name || "-"}</div>
                          </td>
                          <td className="py-3 pr-4 text-gray-700">{org.organization_type || "-"}</td>
                          <td className="py-3 pr-4 text-gray-700">{org.city || "-"}</td>
                          <td className="py-3 pr-4 text-gray-700">{org.state || "-"}</td>
                          <td className="py-3 pr-4 text-gray-700">{org.available_branch_count ?? 0}</td>
                          <td className="py-3 pr-4">
                            <Badge variant={org.is_tally_enabled ? "default" : "secondary"}>
                              {org.is_tally_enabled ? "Yes" : "No"}
                            </Badge>
                          </td>

                          <td className="py-3 pr-4 text-gray-700">{org.created_at || "-"}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditOrganization(org)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                               
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewBranches(org)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Branches
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Total Count */}
          {filteredOrganizations.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-600">
              Showing {filteredOrganizations.length} of {organizationsData?.length || 0} organizations
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="md:col-span-2">
              <p className="text-gray-500 mb-1">Organization Name</p>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <p className="text-gray-500 mb-1">GST Number</p>
              <Input
                value={editForm.gst_number}
                onChange={(e) => setEditForm((p) => ({ ...p, gst_number: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <p className="text-gray-500 mb-1">Organization Type</p>
              <Input
                value={editForm.organization_type}
                onChange={(e) => setEditForm((p) => ({ ...p, organization_type: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-500 mb-1">Address</p>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
              />
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
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveOrganization} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
