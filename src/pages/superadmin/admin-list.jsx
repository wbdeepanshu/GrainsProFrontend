import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users,
  Search,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Phone,
  Mail,
  Calendar,
  User,
  Building2,
  MapPin,
  Shield,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Menu,
  AlertTriangle,
  Eye,
  Pencil,
  Settings,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/notifications/NotificationBell";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SUPERADMIN_BASE = `${API_BASE_URL}/api/superadmin`;

export default function AdminList() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [detailsAdmin, setDetailsAdmin] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    const user = localStorage.getItem("superadmin_user");
    if (!token || !user) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  const { data: organizationsData } = useQuery({
    queryKey: ["superadmin-organizations"],
    queryFn: async () => {
      const token = localStorage.getItem("superadmin_token");
      const res = await fetch(`${SUPERADMIN_BASE}/super-admin/organizations/`, {
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (!res.ok) throw new Error("Failed to fetch organizations");
      const result = await res.json();
      return result.status === 200 ? result.data || [] : [];
    },
  });

  const { data: branchesData } = useQuery({
    queryKey: ["superadmin-branches", selectedOrganization],
    queryFn: async () => {
      const token = localStorage.getItem("superadmin_token");
      let url = `${SUPERADMIN_BASE}/super-admin/branches/`;
      if (selectedOrganization) url += `?organization_id=${selectedOrganization}`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (!res.ok) throw new Error("Failed to fetch branches");
      const result = await res.json();
      return result.status === 200 ? result.data || [] : [];
    },
    enabled: true,
  });

  const { data: adminsData, isLoading, error, refetch } = useQuery({
    queryKey: ["superadmin-admins", selectedOrganization, selectedBranch, page],
    queryFn: async () => {
      const token = localStorage.getItem("superadmin_token");
      const params = new URLSearchParams();
      if (selectedOrganization && String(selectedOrganization).trim()) {
        params.append("organization_id", String(selectedOrganization).trim());
      }
      if (selectedBranch && String(selectedBranch).trim()) {
        params.append("branch_id", String(selectedBranch).trim());
      }
      params.append("page", page.toString());
      params.append("per_page", perPage.toString());
      const url = `${SUPERADMIN_BASE}/super-admin/admins/?${params.toString()}`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to fetch admins");
      }
      return res.json();
    },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: async (userId) => {
      const token = localStorage.getItem("superadmin_token");
      const res = await fetch(`${SUPERADMIN_BASE}/super-admin/admins/delete/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to delete admin");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Admin deactivated successfully" });
      setIsDeleteDialogOpen(false);
      setAdminToDelete(null);
      refetch();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => setSelectedBranch(null), [selectedOrganization]);
  useEffect(() => setPage(1), [selectedOrganization, selectedBranch]);

  const handleDeleteClick = (admin) => {
    setAdminToDelete(admin);
    setIsDeleteDialogOpen(true);
  };
  const confirmDelete = () => {
    if (adminToDelete) deleteAdminMutation.mutate(adminToDelete.user_id);
  };

  if (isLoading) return <CommonLoader />;
  if (error) {
    return (
      <div className="flex h-screen">
        <SuperAdminSidebar />
        <div className="flex-1 p-8">
          <div className="text-red-500">Error loading admins: {error.message}</div>
        </div>
      </div>
    );
  }

  const admins = adminsData?.data || [];
  const filteredAdmins = admins.filter((admin) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(admin.name || "").toLowerCase().includes(q) ||
      String(admin.mobile || "").toLowerCase().includes(q) ||
      String(admin.email || "").toLowerCase().includes(q) ||
      String(admin.user_id || "").toLowerCase().includes(q)
    );
  });
  const pagination = adminsData?.pagination || {};
  const totalPages = pagination.total_pages || 1;

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)} className="mr-2">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Admin List</h1>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setLocation("/superadmin/add-admin")}
              className="gap-2 bg-gray-800 hover:bg-gray-700"
            >
              <UserPlus className="h-4 w-4" />
              New Registration
            </Button>
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
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
                  <div className="w-full md:w-64">
                    <select
                      value={selectedBranch || ""}
                      onChange={(e) => {
                        setSelectedBranch(e.target.value || null);
                        setPage(1);
                      }}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white"
                      disabled={!selectedOrganization}
                    >
                      <option value="">All Branches</option>
                      {branchesData?.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search admins by name, mobile, email, or user ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Admins (Role: Admin) ({pagination.total_count || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredAdmins.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No admins found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAdmins.map((admin) => (
                      <Card key={admin.user_id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <User className="h-5 w-5 text-purple-600" />
                                <h3 className="text-lg font-semibold text-gray-900">{admin.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {admin.user_id}
                                </Badge>
                                <Badge variant={admin.is_active ? "default" : "secondary"}>
                                  {admin.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {admin.is_verified && (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                                {!admin.is_verified && (
                                  <Badge variant="outline" className="text-gray-400 border-gray-400">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Not Verified
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                                <div className="flex items-start gap-2">
                                  <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                                  <div>
                                    <p className="text-xs text-gray-500">Organization</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {admin.organization_name || "N/A"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Settings className="h-4 w-4 text-gray-400 mt-0.5" />
                                  <div>
                                    <p className="text-xs text-gray-500">Tally Enabled</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {admin.is_tally_enabled ? "Yes" : "No"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                                  <div>
                                    <p className="text-xs text-gray-500">Branch</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {admin.branch_name || "N/A"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
                                  <div>
                                    <p className="text-xs text-gray-500">Mobile</p>
                                    <p className="text-sm font-medium text-gray-900">{admin.mobile}</p>
                                  </div>
                                </div>
                                {admin.email && (
                                  <div className="flex items-start gap-2">
                                    <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                      <p className="text-xs text-gray-500">Email</p>
                                      <p className="text-sm font-medium text-gray-900">{admin.email}</p>
                                    </div>
                                  </div>
                                )}
                                {admin.last_login && (
                                  <div className="flex items-start gap-2">
                                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                      <p className="text-xs text-gray-500">Last Login</p>
                                      <p className="text-sm font-medium text-gray-900">{admin.last_login}</p>
                                    </div>
                                  </div>
                                )}
                                {admin.created_at && (
                                  <div className="flex items-start gap-2">
                                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                      <p className="text-xs text-gray-500">Created</p>
                                      <p className="text-sm font-medium text-gray-900">{admin.created_at}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 flex-shrink-0 w-full sm:w-auto sm:max-w-[280px]">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDetailsAdmin(admin)}
                                className="flex items-center gap-1 justify-center"
                              >
                                <Eye className="h-4 w-4" />
                                View Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="hover:bg-black hover:text-white flex items-center justify-center"
                                onClick={() => setLocation(`/superadmin/edit-admin?user_id=${admin.user_id}`)}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              {admin.is_tally_enabled && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setLocation(`/superadmin/tally-config?user_id=${admin.user_id}`)}
                                  className="flex items-center gap-1 justify-center"
                                >
                                  <Settings className="h-4 w-4" />
                                  Tally Config
                                </Button>
                              )}
                              {admin.is_active && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 col-span-2 flex items-center justify-center"
                                  onClick={() => handleDeleteClick(admin)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-600">
                      Showing {(page - 1) * perPage + 1} to{" "}
                      {Math.min(page * perPage, pagination.total_count || 0)} of{" "}
                      {pagination.total_count || 0} admins
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      {/* View Details Dialog */}
      <Dialog open={!!detailsAdmin} onOpenChange={(open) => !open && setDetailsAdmin(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              Admin Details
            </DialogTitle>
          </DialogHeader>
          {detailsAdmin && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-gray-900">{detailsAdmin.name}</span>
                <Badge variant="outline">{detailsAdmin.user_id}</Badge>
                <Badge variant={detailsAdmin.is_active ? "default" : "secondary"}>
                  {detailsAdmin.is_active ? "Active" : "Inactive"}
                </Badge>
                {detailsAdmin.is_verified ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">Verified</Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400">Not Verified</Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Organization</p>
                  <p className="font-medium">{detailsAdmin.organization_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tally Enabled</p>
                  <p className="font-medium">{detailsAdmin.is_tally_enabled ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Branch</p>
                  <p className="font-medium">{detailsAdmin.branch_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Mobile</p>
                  <p className="font-medium">{detailsAdmin.mobile}</p>
                </div>
                {detailsAdmin.email && (
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{detailsAdmin.email}</p>
                  </div>
                )}
                {detailsAdmin.address && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Address</p>
                    <p className="font-medium">{detailsAdmin.address}</p>
                  </div>
                )}
                {(detailsAdmin.city || detailsAdmin.state || detailsAdmin.pincode) && (
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p className="font-medium">
                      {[detailsAdmin.city, detailsAdmin.state, detailsAdmin.pincode].filter(Boolean).join(", ") || "N/A"}
                    </p>
                  </div>
                )}
                {detailsAdmin.last_login && (
                  <div>
                    <p className="text-gray-500">Last Login</p>
                    <p className="font-medium">{detailsAdmin.last_login}</p>
                  </div>
                )}
                {detailsAdmin.created_at && (
                  <div>
                    <p className="text-gray-500">Created At</p>
                    <p className="font-medium">{detailsAdmin.created_at}</p>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setDetailsAdmin(null);
                    setLocation(`/superadmin/edit-admin?user_id=${detailsAdmin.user_id}`);
                  }}
                  className="bg-gray-800 hover:bg-gray-700"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Admin
                </Button>
                {detailsAdmin.is_tally_enabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailsAdmin(null);
                      setLocation(`/superadmin/tally-config?user_id=${detailsAdmin.user_id}`);
                    }}
                    className="flex items-center gap-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    View Tally Config
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Deactivate Admin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this admin? They will no longer be able to log in. You can
              reactivate them later.
            </DialogDescription>
          </DialogHeader>
          {adminToDelete && (
            <div className="py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p>
                  <span className="font-medium">Name:</span> {adminToDelete.name}
                </p>
                <p>
                  <span className="font-medium">User ID:</span> {adminToDelete.user_id}
                </p>
                <p>
                  <span className="font-medium">Mobile:</span> {adminToDelete.mobile}
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteAdminMutation.isPending}
              className="flex items-center gap-2"
            >
              {deleteAdminMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Deactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
