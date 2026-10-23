import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Menu, Search, Plus, Edit, Trash2, User, Phone, Mail, Building, Calendar, Users, Check, ChevronsUpDown, Loader2, X, AlertTriangle, Percent } from "lucide-react";
import Loader from "@/components/common/loader";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const USER_LIST_FILTERS_STORAGE_KEY = "user_list_filters";
const USER_LIST_RESTORE_FILTERS_FLAG = "user_list_restore_filters_once";

export default function UserList() {
  const getInitialFilterValues = () => {
    const params = new URLSearchParams(window.location.search);
    const hasUrlFilter =
      params.has("search") ||
      params.has("role") ||
      params.has("branch_id") ||
      params.has("branch_name");

    if (hasUrlFilter) {
      const search = params.get("search") || "";
      const role = params.get("role");
      const branchId = params.get("branch_id");
      const branchName = params.get("branch_name");

      let initialBranch = null;
      if (branchId === "all") {
        initialBranch = "All";
      } else if (branchId || branchName) {
        initialBranch = { id: branchId || "", name: branchName || "" };
      }

      return {
        search,
        role: role || null,
        branch: initialBranch,
      };
    }

    // Only restore filters from sessionStorage when navigating back from a
    // successful user update. The flag is set by add-user.jsx and consumed
    // here so a page refresh always starts with no filters.
    try {
      const shouldRestore = sessionStorage.getItem(USER_LIST_RESTORE_FILTERS_FLAG) === "1";
      if (shouldRestore) {
        sessionStorage.removeItem(USER_LIST_RESTORE_FILTERS_FLAG);
        const raw = sessionStorage.getItem(USER_LIST_FILTERS_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) || {};
          return {
            search: typeof saved.search === "string" ? saved.search : "",
            role: saved.role || null,
            branch: saved.branch ?? null,
          };
        }
      } else {
        // Plain refresh / fresh visit — clear any stale persisted filters.
        sessionStorage.removeItem(USER_LIST_FILTERS_STORAGE_KEY);
      }
    } catch (_) {
      // ignore storage errors
    }

    return {
      search: "",
      role: null,
      branch: null,
    };
  };

  const initialFilters = getInitialFilterValues();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialFilters.search);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(initialFilters.branch);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(initialFilters.role);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const isMobile = useIsMobile();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [isEpUser, setIsEpUser] = useState(false);
  const [epAdminId, setEpAdminId] = useState(null);
  const [isEpUsersDialogOpen, setIsEpUsersDialogOpen] = useState(false);
  const [epEmployeesLoading, setEpEmployeesLoading] = useState(false);
  const [epEmployees, setEpEmployees] = useState([]);
  const [epSelectedEmployeeKeys, setEpSelectedEmployeeKeys] = useState(() => new Set());
  const [epSubmitting, setEpSubmitting] = useState(false);
  const [epBranchFilter, setEpBranchFilter] = useState("All");
  const [epSearchTerm, setEpSearchTerm] = useState("");
  const [isEpRoleDialogOpen, setIsEpRoleDialogOpen] = useState(false);
  const [epRolesLoading, setEpRolesLoading] = useState(false);
  const [epRoles, setEpRoles] = useState([]);
  const [epSelectedRoleId, setEpSelectedRoleId] = useState("");
  const [epPendingSelectedUsers, setEpPendingSelectedUsers] = useState([]);
  const [epStatusByMobile, setEpStatusByMobile] = useState({});
  const [epStatusLoaded, setEpStatusLoaded] = useState(false);
  const [, setLocation] = useLocation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const { toast } = useToast();
  
  // Get user permissions
  const { 
    hasCreatePermission, 
    hasUpdatePermission, 
    hasDeletePermission,
    hasReadPermission,
    isLoading: permissionsLoading 
  } = useUserPermissions();
  
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;

  // Easy Pagar: Portal employees for EP users
  
  const EASY_PAGAR_PORTAL_GET_MY_EMPLOYEES =
    "https://easypagar.com/portalv1apis/api/Portal/GetMyEmployees";

  useEffect(() => {
    try {
      const userDataStr = localStorage.getItem("cp_manager_user_data");
      if (!userDataStr) return;
      const userData = JSON.parse(userDataStr);

      const epFlag = userData?.is_ep_user ?? userData?.isEpUser ?? userData?.IsEPUser ?? false;
      setIsEpUser(Boolean(epFlag));

      const adminId = userData?.user_id ?? userData?.userId ?? null;
      setEpAdminId(adminId != null ? String(adminId) : null);
    } catch (e) {
      // ignore parse errors; EP button will stay hidden
    }
  }, []);

  // Fetch branches
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    retry: 1,
  });

  async function fetchBranches() {
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response structures
      if (data.status === 200 && data.data) {
        return data.data;
      } else if (Array.isArray(data)) {
        return data;
      } else {
        return data;
      }
    } catch (error) {
      console.error('Fetch branches error:', error);
      throw error;
    }
  }

  // Fetch users function
  const fetchUsers = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const response = await fetch(API_BASE_URL + '/api/get-users/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  };

  const fetchEpEmployees = async () => {
    if (!epAdminId) {
      toast({
        title: "Easy Pagar",
        description: "Admin ID is not available from login data.",
        variant: "destructive",
      });
      return;
    }

    setEpEmployeesLoading(true);
    try {
      const portalBranchIds = (Array.isArray(branchesData) ? branchesData : [])
        .map((b) => b?.id)
        .filter((id) => id != null && String(id).trim() !== "")
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id));

      const response = await fetch(EASY_PAGAR_PORTAL_GET_MY_EMPLOYEES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          AdminID: epAdminId,
          ListType: "All",
          SubOrgIds: [],
          BranchIds: portalBranchIds,
          DeptIds: [],
          EmployeeTypeID: [],
          DesignationID: [],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || `HTTP error! Status: ${response.status}`);
      }

      const rawList =
        data?.List ??
        data?.list ??
        data?.data?.List ??
        data?.data ??
        [];

      const list = Array.isArray(rawList) ? rawList : [];
      const portalBranches = Array.isArray(branchesData) ? branchesData : [];
      const portalBranchByName = new Map(
        portalBranches
          .filter((b) => b?.id != null && b?.name)
          .map((b) => [String(b.name).trim().toLowerCase(), b])
      );

      const normalized = list.map((emp, idx) => {
        const name = String(emp?.Name ?? emp?.name ?? emp?.EmployeeName ?? "").trim();
        const mobileRaw = String(emp?.Mobile ?? emp?.mobile ?? emp?.Phone ?? "").trim();
        const mobile = mobileRaw.replace(/\D/g, "");
        const email = String(emp?.Email ?? emp?.email ?? "").trim();

        const cityName = String(emp?.CityName ?? emp?.cityName ?? emp?.City ?? "").trim();
        const stateVal = String(emp?.state ?? emp?.State ?? "").trim();

        const rawEmpUserId =
          emp?.UserID ??
          emp?.UserId ??
          emp?.user_id ??
          emp?.EmployeeID ??
          emp?.EmployeeId ??
          emp?.EmpID ??
          emp?.EmpId ??
          emp?.ID ??
          emp?.Id ??
          null;
        const empUserId =
          rawEmpUserId != null && String(rawEmpUserId).trim() !== "" ? String(rawEmpUserId).trim() : null;

        const branchId =
          emp?.BranchID ??
          emp?.BranchId ??
          emp?.Branch_id ??
          emp?.branch_id ??
          null;
        const branchName = String(emp?.Branch ?? emp?.BranchName ?? emp?.branch_name ?? "").trim();
        const portalBranchMatch = branchName ? portalBranchByName.get(branchName.trim().toLowerCase()) : null;
        const resolvedPortalBranchId =
          portalBranchMatch?.id != null
            ? String(portalBranchMatch.id)
            : branchId != null && String(branchId).trim() !== "" && !Number.isNaN(Number(branchId))
              ? String(Number(branchId))
              : null;

        return {
          // Use stable unique key even when mobile duplicates/missing
          key: `${empUserId || mobile || "no-id"}-${String(branchId ?? "no-branch")}-${idx}`,
          ep_user_id: empUserId,
          name,
          mobile,
          email,
          cityName,
          state: stateVal,
          // Use portal branch id (preferred) so backend accepts it
          branchId: resolvedPortalBranchId,
          branchName,
          // No password input provided by UI; using mobile as default password.
          password: mobile,
        };
      });

      setEpEmployees(normalized);
      // console.log("EP employees:", normalized);
      setEpSelectedEmployeeKeys(new Set());
    } catch (e) {
      toast({
        title: "Easy Pagar",
        description: e?.message || "Could not load EP employees.",
        variant: "destructive",
      });
    } finally {
      setEpEmployeesLoading(false);
    }
  };

  const fetchEpEmployeesRawList = async () => {
    if (!epAdminId) return [];
    const portalBranchIds = (Array.isArray(branchesData) ? branchesData : [])
      .map((b) => b?.id)
      .filter((id) => id != null && String(id).trim() !== "")
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id));

    const response = await fetch(EASY_PAGAR_PORTAL_GET_MY_EMPLOYEES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        AdminID: epAdminId,
        ListType: "All",
        SubOrgIds: [],
        BranchIds: portalBranchIds,
        DeptIds: [],
        EmployeeTypeID: [],
        DesignationID: [],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || `HTTP error! Status: ${response.status}`);
    }

    const rawList = data?.List ?? data?.list ?? data?.data?.List ?? data?.data ?? [];
    return Array.isArray(rawList) ? rawList : [];
  };

  useEffect(() => {
    if (!isEpUser || !epAdminId) return;
    if (!Array.isArray(branchesData) || branchesData.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const list = await fetchEpEmployeesRawList();
        if (cancelled) return;

        const map = {};
        list.forEach((emp) => {
          const mobile = String(emp?.Mobile ?? emp?.mobile ?? emp?.Phone ?? "").replace(/\D/g, "");
          if (!mobile) return;
          const isActiveRaw = emp?.IsActive ?? emp?.is_active ?? emp?.isActive;
          const isActive =
            isActiveRaw === true ||
            String(isActiveRaw).toLowerCase() === "true" ||
            String(isActiveRaw) === "1";
          map[mobile] = isActive;
        });

        setEpStatusByMobile(map);
      } catch (e) {
        setEpStatusByMobile({});
      } finally {
        if (!cancelled) setEpStatusLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEpUser, epAdminId, branchesData]);

  const fetchRoles = async () => {
    const token = AuthService.getAccessToken();
    setEpRolesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/get-roles/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP error! Status: ${res.status}`);
      const rolesList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setEpRoles(rolesList);
      if (rolesList.length > 0) {
        const firstId = rolesList[0]?.id ?? rolesList[0]?.role_id;
        setEpSelectedRoleId(firstId != null ? String(firstId) : "");
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e?.message || "Could not load roles.",
        variant: "destructive",
      });
    } finally {
      setEpRolesLoading(false);
    }
  };

  const postPagarUsers = async (usersArray, roleId) => {
    const token = AuthService.getAccessToken();
    const adminId = AuthService.getUserData()?.user_id ?? epAdminId ?? null;
    const payload = {
      users: usersArray.map((emp) => ({
        // admin id (logged-in portal user) for audit/linking
        admin_id: adminId,
        role_id: roleId,
        // unique id per employee (fallback to mobile if API doesn't provide one)
        user_id: emp.ep_user_id || emp.mobile,
        // Send both camel/capitalized and lowercase keys to satisfy backend validation
        name: emp.name,
        mobile: emp.mobile,
        password: emp.password,
        email: emp.email || undefined,
        city_name: emp.cityName,
        state: emp.state,
        branch_id: emp.branchId,

        Name: emp.name,
        Mobile: emp.mobile,
        Password: emp.password,
        Email: emp.email || undefined,
        CityName: emp.cityName,
        BranchID: emp.branchId,
      })),
    };

    const res = await fetch(`${API_BASE_URL}/api/pagar-user/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `HTTP error! Status: ${res.status}`);
    }
    return data;
  };

  const handleCreateEpUsers = async () => {
    const selected = epEmployees.filter((e) => epSelectedEmployeeKeys.has(e.key));
    if (selected.length === 0) {
      toast({
        title: "Easy Pagar",
        description: "Select at least one user.",
        variant: "destructive",
      });
      return;
    }

    const missingBranch = selected.filter((e) => !e.branchId || Number.isNaN(Number(e.branchId)));
    if (missingBranch.length > 0) {
      toast({
        title: "Easy Pagar",
        description: "Valid BranchID is missing for one or more selected employees.",
        variant: "destructive",
      });
      return;
    }

    setEpPendingSelectedUsers(selected);
    setIsEpRoleDialogOpen(true);
    if (epRoles.length === 0) {
      fetchRoles();
    }
  };

  const handleConfirmCreateEpUsersWithRole = async () => {
    if (!epSelectedRoleId) {
      toast({
        title: "Role required",
        description: "Please select a role.",
        variant: "destructive",
      });
      return;
    }

    setEpSubmitting(true);
    try {
      await postPagarUsers(epPendingSelectedUsers, Number(epSelectedRoleId));

      toast({
        title: "Success",
        description: `EP users created: ${epPendingSelectedUsers.length}`,
        variant: "success",
      });

      setIsEpRoleDialogOpen(false);
      setIsEpUsersDialogOpen(false);
      setEpSelectedEmployeeKeys(new Set());
      setEpEmployees([]);
      setEpPendingSelectedUsers([]);

      fetchUsers()
        .then((data) => setUsers(data?.data || []))
        .catch((err) => setError(err.message));
    } catch (e) {
      toast({
        title: "Error",
        description: e?.message || "Failed to create EP users.",
        variant: "destructive",
      });
    } finally {
      setEpSubmitting(false);
    }
  };

  const epBranchOptions = ["All", ...new Set(epEmployees.map((e) => e.branchName).filter(Boolean))];
  const filteredEpEmployees = epEmployees.filter((emp) => {
    const byBranch = epBranchFilter === "All" || (emp.branchName || "") === epBranchFilter;
    const q = epSearchTerm.trim().toLowerCase();
    const bySearch =
      !q ||
      (emp.name || "").toLowerCase().includes(q) ||
      (emp.mobile || "").toLowerCase().includes(q);
    return byBranch && bySearch;
  });

  // Simulate loading user data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 900);

    fetchUsers()
      .then(data => {
        setUsers(data?.data || []);
      })
      .catch(err => {
        setError(err.message);
      });
    return () => clearTimeout(timer);    
  }, []);

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(API_BASE_URL + '/api/delete-user/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "✅ Success",
          description: data.message || "User deleted successfully",
          variant: "success",
        });
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
        // Refresh user list
        fetchUsers()
          .then(data => {
            setUsers(data?.data || []);
          })
          .catch(err => {
            setError(err.message);
          });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete user",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Delete user error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Handle delete click
  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.user_id);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setUserToDelete(null);
  };
  

  // Handle branch selection
  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setBranchDropdownOpen(false);
  };

  // Handle role selection
  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setRoleDropdownOpen(false);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedBranch(null);
    setSelectedRole(null);
  };

  const usersMatchedWithEp = isEpUser
    ? users.filter((u) => {
        const mobile = String(u?.mobile || "").replace(/\D/g, "");
        return mobile && epStatusByMobile[mobile] === true;
      })
    : users;

  const usersForList = isEpUser && epStatusLoaded ? usersMatchedWithEp : users;

  // Extract unique roles from users data
  const uniqueRoles = [...new Set(usersForList.map(user => user.role_name).filter(role => role))].sort();

  // Filter users based on search term, branch, and role
  const filteredUsers = usersForList.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.mobile.includes(searchTerm);
    
    const matchesBranch = !selectedBranch || selectedBranch === "All" || 
      (user.branch_name && user.branch_name.toLowerCase().includes(selectedBranch.name.toLowerCase()));
    
    const matchesRole = !selectedRole || selectedRole === "All" || user.role_name === selectedRole;
    
    return matchesSearch && matchesBranch && matchesRole;
  });





  const getRoleColor = (role) => {
    switch (role) {
      case "Lab Technician":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Supervisor":
        return "bg-green-100 text-green-800 border-green-200";
      case "Admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getBranchShortName = (branchName) => {
    if (branchName.includes("Main Branch")) {
      return "Main Branch";
    } else if (branchName.includes("Rayapur")) {
      return "Rayapur";
    }
    return branchName.split(" - ")[0] || branchName;
  };

  // Resolve URL-initialized branch id/name to a full branch object once data is available.
  useEffect(() => {
    if (!Array.isArray(branchesData) || branchesData.length === 0) return;
    if (!selectedBranch || selectedBranch === "All") return;
    if (selectedBranch?.name && selectedBranch?.id) return;

    const matched = branchesData.find((b) =>
      String(b?.id) === String(selectedBranch?.id) ||
      (selectedBranch?.name && String(b?.name).trim().toLowerCase() === String(selectedBranch?.name).trim().toLowerCase())
    );
    if (matched) setSelectedBranch(matched);
  }, [branchesData, selectedBranch]);

  // Persist filters in URL so browser back from edit keeps state.
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    if (selectedRole && selectedRole !== "All") params.set("role", selectedRole);

    if (selectedBranch === "All") {
      params.set("branch_id", "all");
    } else if (selectedBranch && selectedBranch !== "All") {
      if (selectedBranch?.id != null && String(selectedBranch.id).trim() !== "") {
        params.set("branch_id", String(selectedBranch.id));
      }
      if (selectedBranch?.name) {
        params.set("branch_name", String(selectedBranch.name));
      }
    }

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    // Mirror filters to sessionStorage so they survive a navigation away
    // (e.g. edit user → update → setLocation('/users') without query string).
    try {
      const hasAnyFilter =
        (searchTerm && searchTerm.trim() !== "") ||
        (selectedRole && selectedRole !== "All") ||
        !!selectedBranch;
      if (hasAnyFilter) {
        sessionStorage.setItem(
          USER_LIST_FILTERS_STORAGE_KEY,
          JSON.stringify({
            search: searchTerm,
            role: selectedRole,
            branch: selectedBranch,
          })
        );
      } else {
        sessionStorage.removeItem(USER_LIST_FILTERS_STORAGE_KEY);
      }
    } catch (_) {
      // ignore storage errors
    }
  }, [searchTerm, selectedRole, selectedBranch]);

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
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-black to-gray-600 p-2 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                  <p className="text-sm text-gray-600">Manage system users and their roles</p>
                </div>
              </div>
            </div>
            {hasCreatePermission("user_management") && !isEpUser && (
              <Button
                onClick={() => setLocation("/add-user")}
                className="bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}

            {hasCreatePermission("user_management") && isEpUser && (
              <Button
                type="button"
                onClick={() => {
                  setIsEpUsersDialogOpen(true);
                  if (epEmployees.length === 0 && !epEmployeesLoading) {
                    fetchEpEmployees();
                  }
                }}
                disabled={epEmployeesLoading}
                className="bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white"
              >
                <Users className="h-4 w-4 mr-2" />
                {epEmployeesLoading ? "Loading EP Users..." : "Import Easy Pagar Users"}
              </Button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              {/* Show loading state while permissions are being fetched */}
              {permissionsLoading ? (
                <Card className="shadow-sm border border-gray-200">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                      <Loader text="Loading permissions..." />
                    </div>
                  </CardContent>
                </Card>
              ) : !hasReadPermission('user_management') ? (
                <Card className="shadow-sm border border-gray-200">
                  <CardContent className="p-8">
                    <div className="text-center">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
                      <p className="text-gray-600">You don't have permission to view user management.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
              {/* Stats Cards - Summary Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-indigo-100 text-sm mb-1">Total Users</p>
                        <p className="text-3xl font-bold">{usersForList.length}</p>
                      </div>
                      <div className="bg-indigo-400 bg-opacity-30 p-3 rounded-lg">
                        <Users className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm mb-1">Lab Technician</p>
                        <p className="text-3xl font-bold">{usersForList.filter(u => u.role_name === "Lab Technician" || u.role_name === "Lab Tech").length}</p>
                      </div>
                      <div className="bg-purple-400 bg-opacity-30 p-3 rounded-lg">
                        <User className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm mb-1">Supervisor</p>
                        <p className="text-3xl font-bold">{usersForList.filter(u => u.role_name === "Supervisor").length}</p>
                      </div>
                      <div className="bg-green-400 bg-opacity-30 p-3 rounded-lg">
                        <User className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm mb-1">Salesman</p>
                        <p className="text-3xl font-bold">{usersForList.filter(u => u.role_name === "Salesman" || u.role_name === "Sales Man").length}</p>
                      </div>
                      <div className="bg-blue-400 bg-opacity-30 p-3 rounded-lg">
                        <User className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100 text-sm mb-1">Mistry</p>
                        <p className="text-3xl font-bold">{usersForList.filter(u => u.role_name === "Mistry" || u.role_name === "Mistry").length}</p>
                      </div>
                      <div className="bg-orange-400 bg-opacity-30 p-3 rounded-lg">
                        <User className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-teal-100 text-sm mb-1">Accountant</p>
                        <p className="text-3xl font-bold">{usersForList.filter(u => u.role_name === "Accountant" || u.role_name === "Accountant").length}</p>
                      </div>
                      <div className="bg-teal-400 bg-opacity-30 p-3 rounded-lg">
                        <User className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Combined Filters - Branch, Role, and Search */}
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
                  
                   {/* Search */}
                   <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Search className="h-4 w-4 text-gray-600" />
                        Search
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-11"
                        />
                      </div>
                    </div>
                  
                  
                    {/* Branch Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        Branch
                      </label>
                      <div className="relative">
                        <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={branchDropdownOpen}
                              className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <span className="truncate">
                                {selectedBranch === "All" ? "All Branches" : selectedBranch ? selectedBranch.name : "Select branch"}
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
                                    {/* All Branches Option */}
                                    <CommandItem
                                      key="all"
                                      value="All"
                                      onSelect={() => handleBranchSelect("All")}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${
                                            selectedBranch === "All" ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">All Branches</div>
                                          {/* <div className="text-sm text-gray-500">{users.length} user(s)</div> */}
                                        </div>
                                      </div>
                                      {/* <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        All
                                      </Badge> */}
                                    </CommandItem>
                                    
                                    {/* Individual Branches */}
                                    {branchesData?.map((branch) => (
                                      <CommandItem
                                        key={branch.id}
                                        value={branch.name}
                                        onSelect={() => handleBranchSelect(branch)}
                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Check
                                            className={`h-4 w-4 ${
                                              selectedBranch?.id === branch.id ? "opacity-100 text-blue-600" : "opacity-0"
                                            }`}
                                          />
                                          <div>
                                            <div className="font-medium text-gray-900">{branch.name}</div>
                                            {branch.organization && (
                                              <div className="text-sm text-gray-500">{branch.organization}</div>
                                            )}
                                          </div>
                                        </div>
                                        {/* <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                          Active
                                        </Badge> */}
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-600" />
                        Role
                      </label>
                      <div className="relative">
                        <Popover open={roleDropdownOpen} onOpenChange={setRoleDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={roleDropdownOpen}
                              className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                              <span className="truncate">
                                {selectedRole === "All" ? "All Roles" : selectedRole ? selectedRole : "Select role"}
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
                              <CommandInput placeholder="Search roles..." />
                              <CommandList>
                                <CommandEmpty>
                                  {uniqueRoles.length === 0 ? (
                                    "No roles found."
                                  ) : (
                                    "No roles match your search."
                                  )}
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    {/* All Roles Option */}
                                    <CommandItem
                                      key="all"
                                      value="All"
                                      onSelect={() => handleRoleSelect("All")}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${
                                            selectedRole === "All" ? "opacity-100 text-green-600" : "opacity-0"
                                          }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">All Roles</div>
                                          {/* <div className="text-sm text-gray-500">{users.length} user(s)</div> */}
                                        </div>
                                      </div>
                                      {/* <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-medium">
                                        All
                                      </Badge> */}
                                    </CommandItem>
                                    
                                    {/* Individual Roles */}
                                    {uniqueRoles.map((role) => (
                                      <CommandItem
                                        key={role}
                                        value={role}
                                        onSelect={() => handleRoleSelect(role)}
                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Check
                                            className={`h-4 w-4 ${
                                              selectedRole === role ? "opacity-100 text-green-600" : "opacity-0"
                                            }`}
                                          />
                                          <div>
                                            <div className="font-medium text-gray-900">{role}</div>
                                            {/* <div className="text-sm text-gray-500">
                                              {usersForList.filter(user => user.role_name === role).length} user(s)
                                            </div> */}
                                          </div>
                                        </div>
                                        {/* <Badge 
                                          className={`${getRoleColor(role)} font-medium`}
                                        >
                                          {role}
                                        </Badge> */}
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                   

                    {/* Results Summary and Clear Filters */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Results
                      </label>
                      <div className="flex flex-col gap-2">
                        <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
                          {filteredUsers.length} of {usersForList.length} users
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        &nbsp;
                      </label>
                      <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="h-11 w-full"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>

                  {/* Active Filters Display */}
                  {(selectedBranch || selectedRole) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-600">Active filters:</span>
                        {selectedBranch && selectedBranch !== "All" && (
                          <Badge variant="outline" className="text-xs">
                            Branch: {selectedBranch.name}
                          </Badge>
                        )}
                        {selectedRole && selectedRole !== "All" && (
                          <Badge variant="outline" className="text-xs">
                            Role: {selectedRole}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Users Table */}
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-0">
                  <div className="w-full max-h-[min(72vh,calc(100vh-14rem))] overflow-auto relative isolate">
                    <table className="w-full border-separate border-spacing-0">
                      <thead className="bg-gray-50 border-b-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                        <tr>
                          <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">User</th>
                          <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Contact</th>
                          <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Role</th>
                          <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Branch</th>
                          <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Created</th>
                          <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((user, index) => (
                          <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-r from-black to-gray-600 rounded-full flex items-center justify-center">
                                  <span className="text-white font-semibold text-sm">
                                    {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                  {/* <div className="text-sm text-gray-500">{user.user_id}</div> */}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center text-sm text-gray-900">
                                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                                  {user.mobile}
                                </div>
                                {user.email && (
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                                    {user.email}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={`${getRoleColor(user.role_name)} font-medium`}>
                                {user.role_name}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Building className="h-4 w-4 mr-2 text-gray-400" />
                                <span className="truncate max-w-32" title={user.branch_name}>
                                  {getBranchShortName(user.branch_name)}
                                </span>
                              </div>
                            </td>
                            
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                                {user.created_at}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {hasUpdatePermission('user_management') && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="hover:bg-black hover:text-white"
                                    onClick={() => setLocation(`/add-user?edit=true&user_id=${user.user_id}`)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {hasDeletePermission('user_management') && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDeleteClick(user)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {user.role_name?.toLowerCase() === "broker" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="hover:bg-blue-50 hover:text-blue-700"
                                    onClick={() => {
                                      try {
                                        sessionStorage.setItem("brokerage_config_filter_broker_id", String(user.user_id));
                                      } catch (_) {}
                                      setLocation("/margin-settings/brokerage-configuration");
                                    }}
                                    title="Brokerage Configuration"
                                  >
                                    {/* <Percent className="h-4 w-4" /> */}
                                    Brokerage
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {filteredUsers.length === 0 && (
                <Card className="shadow-sm border border-gray-200">
                  <CardContent className="p-12 text-center">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-gray-500">Try adjusting your search criteria or add a new user.</p>
                  </CardContent>
                </Card>
              )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Loader */}
      <Loader isLoading={isLoading} text="Loading user list" />

      {/* EP Users Dialog (Easy Pagar) */}
      <Dialog
        open={isEpUsersDialogOpen}
        onOpenChange={(open) => {
          setIsEpUsersDialogOpen(open);
          if (!open) {
            setEpSelectedEmployeeKeys(new Set());
            setEpBranchFilter("All");
            setEpSearchTerm("");
            setEpPendingSelectedUsers([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>EP Users</span>
            </DialogTitle>
            <DialogDescription>
              Select employees from Easy Pagar, then create them in the portal (pagar-user).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Branch</label>
                <select
                  value={epBranchFilter}
                  onChange={(e) => setEpBranchFilter(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm"
                >
                  {epBranchOptions.map((branchName) => (
                    <option key={branchName} value={branchName}>
                      {branchName === "All" ? "All branches" : branchName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Search (Name/Mobile)</label>
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={epSearchTerm}
                    onChange={(e) => setEpSearchTerm(e.target.value)}
                    placeholder="Search by name or mobile"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {epEmployeesLoading && (
              <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching EP employees...
              </div>
            )}

            {!epEmployeesLoading && filteredEpEmployees.length === 0 && (
              <div className="text-sm text-gray-600">No EP employees found.</div>
            )}

            {filteredEpEmployees.length > 0 && (
              <ScrollArea className="h-[48vh] pr-2">
                <div className="space-y-2">
                  {filteredEpEmployees.map((emp, index) => (
                    <div
                      key={emp.key}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                    >
                      <div className="pt-1">
                        <Checkbox
                          checked={epSelectedEmployeeKeys.has(emp.key)}
                          onCheckedChange={(checked) => {
                            setEpSelectedEmployeeKeys((prev) => {
                              const next = new Set(prev);
                              if (checked === true) next.add(emp.key);
                              else next.delete(emp.key);
                              return next;
                            });
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                           {index + 1}. {emp.name || "-"}
                        </div>
                        <div className="text-xs text-gray-600">
                          Branch: {emp.branchName || "-"} •
                          {" "}{emp.state || "-"} • {emp.cityName || "-"} •
                          {" "}Mobile: {emp.mobile || "-"}
                        </div>
                        <div className="text-xs text-gray-500"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEpUsersDialogOpen(false)}
              disabled={epSubmitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateEpUsers} disabled={epSubmitting}>
              {epSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Selected"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEpRoleDialogOpen} onOpenChange={setIsEpRoleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Role</DialogTitle>
            <DialogDescription>
              Choose role to apply for selected EP users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {epRolesLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading roles...
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select
                  value={epSelectedRoleId}
                  onChange={(e) => setEpSelectedRoleId(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="">Select role</option>
                  {epRoles.map((role) => (
                    <option key={role.id ?? role.role_id} value={String(role.id ?? role.role_id)}>
                      {role.name ?? role.role_name ?? `Role ${role.id ?? role.role_id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsEpRoleDialogOpen(false)} disabled={epSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmCreateEpUsersWithRole} disabled={epSubmitting || epRolesLoading}>
              {epSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Delete User</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? The user will be deactivated (is_active will be set to False). This action can be reversed by reactivating the user.
            </DialogDescription>
          </DialogHeader>
          
          {userToDelete && (
            <div className="py-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><span className="font-medium">Name:</span> {userToDelete.name}</p>
                <p><span className="font-medium">User ID:</span> {userToDelete.user_id}</p>
                <p><span className="font-medium">Mobile:</span> {userToDelete.mobile}</p>
                <p><span className="font-medium">Role:</span> {userToDelete.role_name}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={deleteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteUserMutation.isPending}
              className="flex items-center space-x-2"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Delete User</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}