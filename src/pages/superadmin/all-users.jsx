import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Users,
  Search,
  ChevronRight,
  ChevronLeft,
  Building2,
  Calendar,
  User,
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  Pencil,
  Menu,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import NotificationBell from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function AllUsers() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [orgSearchTerm, setOrgSearchTerm] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [detailsUser, setDetailsUser] = useState(null);

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    const user = localStorage.getItem("superadmin_user");

    if (!token || !user) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

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

  // Fetch branches for filter (filtered by organization if selected)
  const { data: branchesData } = useQuery({
    queryKey: ['superadmin-branches', selectedOrganization],
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
    enabled: true, // Always fetch branches
  });

  // Fetch users
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['superadmin-users', selectedOrganization, selectedBranch, page],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("superadmin_token");
        let url = `${API_BASE_URL}/api/superadmin/super-admin/users/`;
        const params = new URLSearchParams();
        if (selectedOrganization && String(selectedOrganization).trim()) {
          params.append('organization_id', String(selectedOrganization).trim());
        }
        if (selectedBranch && String(selectedBranch).trim()) {
          params.append('branch_id', String(selectedBranch).trim());
        }
        params.append('page', page.toString());
        params.append('per_page', perPage.toString());
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
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to fetch users`);
        }

        const result = await response.json();
        if (result.status === 200) {
          return result;
        } else {
          throw new Error(result.message || result.error || 'Failed to fetch users');
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        throw err;
      }
    },
    enabled: !!selectedOrganization,
  });

  // Reset branch filter when organization changes
  useEffect(() => {
    setSelectedBranch(null);
    setBranchSearchTerm("");
    setBranchDropdownOpen(false);
    setPage(1);
  }, [selectedOrganization]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedOrganization, selectedBranch, searchQuery]);

  const users = usersData?.data || [];
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const name = String(user?.name || "").toLowerCase();
      const mobile = String(user?.mobile || "").toLowerCase();
      const email = String(user?.email || "").toLowerCase();
      const userId = String(user?.user_id || "").toLowerCase();
      return (
        name.includes(query) ||
        mobile.includes(query) ||
        email.includes(query) ||
        userId.includes(query)
      );
    });
  }, [users, searchQuery]);

  const organizations = organizationsData || [];
  const branches = branchesData || [];

  const filteredOrganizations = useMemo(() => {
    const term = orgSearchTerm.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((org) =>
      String(org?.name || "").toLowerCase().includes(term)
    );
  }, [organizations, orgSearchTerm]);

  const filteredBranches = useMemo(() => {
    const term = branchSearchTerm.trim().toLowerCase();
    if (!term) return branches;
    return branches.filter((branch) =>
      String(branch?.name || "").toLowerCase().includes(term)
    );
  }, [branches, branchSearchTerm]);

  const selectedOrganizationName =
    organizations.find((org) => String(org.id) === String(selectedOrganization))?.name || "";
  const selectedBranchName =
    branches.find((branch) => String(branch.id) === String(selectedBranch))?.name || "";

  const pagination = usersData?.pagination || {};
  const totalPages = pagination.total_pages || 1;

  if (isLoading) {
    return <CommonLoader />;
  }

  if (error) {
    return (
      <div className="flex h-screen">
        <SuperAdminSidebar />
        <div className="flex-1 p-8">
          <div className="text-red-500">Error loading users: {error.message}</div>
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
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="mr-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">All Users</h1>
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
                  <div className="w-full md:w-64">
                    <Popover
                      open={orgDropdownOpen}
                      onOpenChange={(open) => {
                        setOrgDropdownOpen(open);
                        if (!open) setOrgSearchTerm("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={orgDropdownOpen}
                          className="w-full h-10 justify-between font-normal bg-white"
                        >
                          <span className="truncate">
                            {selectedOrganization ? selectedOrganizationName : "All Organizations"}
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
                            placeholder="Search organizations..."
                            value={orgSearchTerm}
                            onValueChange={setOrgSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>No organizations found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="all-organizations"
                                onSelect={() => {
                                  setSelectedOrganization(null);
                                  setOrgDropdownOpen(false);
                                  setOrgSearchTerm("");
                                  setPage(1);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !selectedOrganization ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                All Organizations
                              </CommandItem>
                              {filteredOrganizations.map((org) => (
                                <CommandItem
                                  key={org.id}
                                  value={`${org.name}-${org.id}`}
                                  onSelect={() => {
                                    setSelectedOrganization(String(org.id));
                                    setOrgDropdownOpen(false);
                                    setOrgSearchTerm("");
                                    setPage(1);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      String(selectedOrganization) === String(org.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <span className="truncate">{org.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="w-full md:w-64">
                    <Popover
                      open={branchDropdownOpen}
                      onOpenChange={(open) => {
                        if (!selectedOrganization) return;
                        setBranchDropdownOpen(open);
                        if (!open) setBranchSearchTerm("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={branchDropdownOpen}
                          disabled={!selectedOrganization}
                          className="w-full h-10 justify-between font-normal bg-white disabled:opacity-60"
                        >
                          <span className="truncate">
                            {selectedBranch ? selectedBranchName : "All Branches"}
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
                            placeholder="Search branches..."
                            value={branchSearchTerm}
                            onValueChange={setBranchSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>No branches found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="all-branches"
                                onSelect={() => {
                                  setSelectedBranch(null);
                                  setBranchDropdownOpen(false);
                                  setBranchSearchTerm("");
                                  setPage(1);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !selectedBranch ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                All Branches
                              </CommandItem>
                              {filteredBranches.map((branch) => (
                                <CommandItem
                                  key={branch.id}
                                  value={`${branch.name}-${branch.id}`}
                                  onSelect={() => {
                                    setSelectedBranch(String(branch.id));
                                    setBranchDropdownOpen(false);
                                    setBranchSearchTerm("");
                                    setPage(1);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      String(selectedBranch) === String(branch.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <span className="truncate">{branch.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search users by name, mobile, email, or user ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Users ({searchQuery.trim() ? filteredUsers.length : (pagination.total_count || 0)})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedOrganization ? (
                  <div className="text-center py-12 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Please select an organization to view users</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-600">
                          <th className="py-3 pr-4 font-medium">Name</th>
                          <th className="py-3 pr-4 font-medium">Mobile</th>
                          <th className="py-3 pr-4 font-medium">Organization</th>
                          <th className="py-3 pr-4 font-medium">Role</th>
                          <th className="py-3 pr-4 font-medium">Status</th>
                          <th className="py-3 pr-4 font-medium">Created At</th>
                          <th className="py-3 pr-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{user.name || "-"}</span>
                                {/* <Badge variant="outline" className="text-xs">{user.user_id}</Badge> */}
                                {/* <Badge variant={user.is_active ? "default" : "secondary"}>
                                  {user.is_active ? "Active" : "Inactive"}
                                </Badge> */}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">{user.mobile || "-"}</td>
                            <td className="py-3 pr-4 text-gray-700">{user.organization_name || "N/A"}</td>
                            <td className="py-3 pr-4 text-gray-700">{user.role_name || "N/A"}</td>
                            <td className="py-3 pr-4 text-gray-700"> <Badge variant={user.is_active ? "default" : "secondary"}>
                              {user.is_active ? "Active" : "Inactive"}
                            </Badge>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">{user.created_at || "-"}</td>
                            <td className="py-3 pr-4">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDetailsUser(user)}
                                  className="flex items-center gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {user.role_id === 1 && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setLocation(`/superadmin/edit-admin?user_id=${user.user_id}`)}
                                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {selectedOrganization && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-600">
                      Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, pagination.total_count || 0)} of {pagination.total_count || 0} users
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

      {/* View Details Dialog */}
      <Dialog open={!!detailsUser} onOpenChange={(open) => !open && setDetailsUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Details
            </DialogTitle>
          </DialogHeader>
          {detailsUser && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-gray-900">{detailsUser.name}</span>
                <Badge variant="outline">{detailsUser.user_id}</Badge>
                <Badge variant={detailsUser.is_active ? "default" : "secondary"}>
                  {detailsUser.is_active ? "Active" : "Inactive"}
                </Badge>
                {detailsUser.is_verified ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">Verified</Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400">Not Verified</Badge>
                )}
                {detailsUser.role_id === 1 && (
                  <Badge variant="outline" className="text-purple-600 border-purple-600">Admin</Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Organization</p>
                  <p className="font-medium">{detailsUser.organization_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Branch</p>
                  <p className="font-medium">{detailsUser.branch_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Role</p>
                  <p className="font-medium">{detailsUser.role_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Mobile</p>
                  <p className="font-medium">{detailsUser.mobile}</p>
                </div>
                {detailsUser.email && (
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{detailsUser.email}</p>
                  </div>
                )}
                {detailsUser.address && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Address</p>
                    <p className="font-medium">{detailsUser.address}</p>
                  </div>
                )}
                {(detailsUser.city || detailsUser.state || detailsUser.pincode) && (
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p className="font-medium">
                      {[detailsUser.city, detailsUser.state, detailsUser.pincode].filter(Boolean).join(", ") || "N/A"}
                    </p>
                  </div>
                )}
                {detailsUser.last_login && (
                  <div>
                    <p className="text-gray-500">Last Login</p>
                    <p className="font-medium">{detailsUser.last_login}</p>
                  </div>
                )}
                {detailsUser.created_at && (
                  <div>
                    <p className="text-gray-500">Created At</p>
                    <p className="font-medium">{detailsUser.created_at}</p>
                  </div>
                )}
              </div>
              {detailsUser.role_id === 1 && (
                <div className="pt-2 border-t">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setDetailsUser(null);
                      setLocation(`/superadmin/edit-admin?user_id=${detailsUser.user_id}`);
                    }}
                    className="bg-gray-800 hover:bg-gray-700"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Admin
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
