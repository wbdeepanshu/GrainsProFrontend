import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, User, Save, KeyRound, Eye, EyeOff, Menu, Loader2 } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SUPERADMIN_BASE = `${API_BASE_URL}/api/superadmin`;

const CRUD_KEYS = ["c", "r", "u", "d"];
const FULL_CRUD = ["c", "r", "u", "d"];

const normalizeModuleName = (value) => String(value || "").toLowerCase().trim();
const normalizeModuleAlias = (value) => String(value || "").toLowerCase().trim();

function isInwardModule(module, moduleAlias) {
  const selectedName = normalizeModuleName(module?.name);
  const selectedAlias = normalizeModuleAlias(moduleAlias);
  return (
    selectedName === "inward" ||
    selectedAlias === "inward" ||
    (selectedAlias.includes("inward") && !selectedAlias.includes("assignment"))
  );
}

function isOutwardModule(module, moduleAlias) {
  const selectedName = normalizeModuleName(module?.name);
  const selectedAlias = normalizeModuleAlias(moduleAlias);
  return (
    selectedName === "outward" ||
    selectedAlias === "outward" ||
    (selectedAlias.includes("outward") && !selectedAlias.includes("assignment"))
  );
}

function isInwardDependentModule(module) {
  const name = normalizeModuleName(module?.name);
  const alias = normalizeModuleAlias(module?.alias);
  return (
    ["inward assignment", "purchase order", "stock journals", "customer management"].includes(name) ||
    alias === "inward_assignment" ||
    alias === "purchase_order" ||
    alias === "stock_journals" ||
    alias === "customer_management"
  );
}

function isOutwardBundleModule(module) {
  const name = normalizeModuleName(module?.name);
  const alias = normalizeModuleAlias(module?.alias);
  return (
    ["outward", "outward assignment", "sales order", "customer management"].includes(name) ||
    alias === "outward" ||
    alias === "outward_assignment" ||
    alias === "sales_order" ||
    alias === "customer_management" ||
    (alias.includes("outward") && alias.includes("assignment"))
  );
}

function isOutwardUncheckDependentModule(module) {
  const name = normalizeModuleName(module?.name);
  const alias = normalizeModuleAlias(module?.alias);
  return (
    ["customer management", "sales order", "outward assignment", "purchase order", "stock journals"].includes(name) ||
    alias === "customer_management" ||
    alias === "sales_order" ||
    alias === "outward_assignment" ||
    (alias.includes("outward") && alias.includes("assignment"))
  );
}

function isInwardUncheckDependentModule(module) {
  const name = normalizeModuleName(module?.name);
  const alias = normalizeModuleAlias(module?.alias);
  return (
    ["inward assignment", "customer management", "outward assignment", "purchase order", "stock journals"].includes(name) ||
    alias === "inward_assignment" ||
    alias === "customer_management" ||
    alias === "outward_assignment" ||
    alias === "purchase_order" ||
    alias === "stock_journals" ||
    (alias.includes("outward") && alias.includes("assignment"))
  );
}

function findUserManagementModule(modules) {
  return (modules || []).find((m) => {
    const name = normalizeModuleName(m?.name);
    const alias = normalizeModuleAlias(m?.alias);
    return (
      name === "user management" ||
      alias === "user_management" ||
      alias === "users" ||
      alias.includes("user_management")
    );
  });
}

function applyInwardCheckRules(next, modules) {
  modules.forEach((m) => {
    if (isInwardDependentModule(m) && m.alias) {
      next[m.alias] = [...FULL_CRUD];
    }
  });
}

function applyOutwardCheckRules(next, modules) {
  const userManagementModule = findUserManagementModule(modules);
  if (userManagementModule?.alias) {
    next[userManagementModule.alias] = [...FULL_CRUD];
  }
  modules.forEach((m) => {
    if (isOutwardBundleModule(m) && m.alias) {
      next[m.alias] = [...FULL_CRUD];
    }
  });
}

function applyInwardUncheckRules(next, modules) {
  modules.forEach((m) => {
    if (isInwardUncheckDependentModule(m) && m.alias) {
      next[m.alias] = [];
    }
  });
}

function applyOutwardUncheckRules(next, modules) {
  modules.forEach((m) => {
    if (isOutwardUncheckDependentModule(m) && m.alias) {
      next[m.alias] = [];
    }
  });
}

function normalizePermissionSummary(summary) {
  if (!Array.isArray(summary)) return [];
  return [
    ...new Set(
      summary
        .map((x) => String(x).toLowerCase())
        .filter((x) => CRUD_KEYS.includes(x))
    ),
  ];
}

/** Map API permission rows onto the full modules list so every module alias has an array for checkboxes. */
function mergePermissionsFromApi(modules, permissionRows) {
  const permsByLowerAlias = {};
  (permissionRows || []).forEach((p) => {
    if (!p.alias) return;
    permsByLowerAlias[String(p.alias).toLowerCase()] = normalizePermissionSummary(p.permission_summary);
  });
  const merged = {};
  (modules || []).forEach((m) => {
    if (!m?.alias) return;
    const summary = permsByLowerAlias[String(m.alias).toLowerCase()];
    merged[m.alias] = summary ? [...summary] : [];
  });
  return merged;
}

function getToken() {
  return localStorage.getItem("superadmin_token");
}

export default function EditAdmin() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const userId = searchParams.get("user_id");

  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    password: "",
  });
  const [accessModules, setAccessModules] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [adminInfo, setAdminInfo] = useState(null);

  useEffect(() => {
    if (!getToken() || !userId) {
      setLocation("/superadmin/login");
      return;
    }
  }, [userId, setLocation]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setIsLoading(true);
      const token = getToken();
      const headers = { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };

      try {
        const [detailsRes, permsRes, modulesRes] = await Promise.all([
          fetch(`${SUPERADMIN_BASE}/super-admin/admins/details/?user_id=${encodeURIComponent(userId)}`, { headers }),
          fetch(`${SUPERADMIN_BASE}/super-admin/admins/permissions/?user_id=${encodeURIComponent(userId)}`, { headers }),
          fetch(`${SUPERADMIN_BASE}/super-admin/modules/`, { headers }),
        ]);

        if (!detailsRes.ok || !permsRes.ok) {
          const err = await detailsRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load admin");
        }

        const detailsData = await detailsRes.json();
        const permsData = await permsRes.json();
        const modulesData = await modulesRes.json();

        if (detailsData.status === 200 && detailsData.data) {
          const d = detailsData.data;
          setFormData({
            name: d.name || "",
            mobile: d.mobile || "",
            email: d.email || "",
            address: d.address || "",
            city: d.city || "",
            state: d.state || "",
            pincode: d.pincode || "",
            password: permsData.user_info?.password || "",
          });
          setAdminInfo(d);
        }

        const modules = modulesData?.data || [];
        setAccessModules(modules);

        setPermissions(mergePermissionsFromApi(modules, permsData.data));
      } catch (e) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
        setLocation("/superadmin/admin-list");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userId, setLocation, toast]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePermissionChange = (moduleAlias, permission, checked) => {
    setPermissions((prev) => {
      const next = { ...prev };
      if (!next[moduleAlias]) next[moduleAlias] = [];
      if (checked) {
        if (!next[moduleAlias].includes(permission)) next[moduleAlias].push(permission);
      } else {
        next[moduleAlias] = next[moduleAlias].filter((p) => p !== permission);
      }

      // Dependency rule:
      // When any Inward checkbox is enabled, auto-enable full CRUD on dependent modules.
      if (checked) {
        const selectedModule = accessModules.find((m) => m.alias === moduleAlias);
        if (isInwardModule(selectedModule, moduleAlias)) {
          applyInwardCheckRules(next, accessModules);
        }
        if (isOutwardModule(selectedModule, moduleAlias)) {
          applyOutwardCheckRules(next, accessModules);
        }
      } else {
        const selectedModule = accessModules.find((m) => m.alias === moduleAlias);
        if (isInwardModule(selectedModule, moduleAlias)) {
          applyInwardUncheckRules(next, accessModules);
        }
        if (isOutwardModule(selectedModule, moduleAlias)) {
          applyOutwardUncheckRules(next, accessModules);
        }
      }
      return next;
    });
  };

  const handleSelectAll = (moduleAlias, checked) => {
    setPermissions((prev) => {
      const next = {
        ...prev,
        [moduleAlias]: checked ? ["c", "r", "u", "d"] : [],
      };

      if (checked) {
        const selectedModule = accessModules.find((m) => m.alias === moduleAlias);
        if (isInwardModule(selectedModule, moduleAlias)) {
          applyInwardCheckRules(next, accessModules);
        }
        if (isOutwardModule(selectedModule, moduleAlias)) {
          applyOutwardCheckRules(next, accessModules);
        }
      } else {
        const selectedModule = accessModules.find((m) => m.alias === moduleAlias);
        if (isInwardModule(selectedModule, moduleAlias)) {
          applyInwardUncheckRules(next, accessModules);
        }
        if (isOutwardModule(selectedModule, moduleAlias)) {
          applyOutwardUncheckRules(next, accessModules);
        }
      }

      return next;
    });
  };

  const isAllSelected = (moduleAlias) => {
    const p = permissions[moduleAlias] || [];
    return p.length === 4 && ["c", "r", "u", "d"].every((x) => p.includes(x));
  };

  const handleSelectAllModules = (checked) => {
    setPermissions((prev) => {
      const next = { ...prev };
      accessModules.forEach((m) => {
        next[m.alias] = checked ? ["c", "r", "u", "d"] : [];
      });
      return next;
    });
  };

  const isAllModulesSelected = () => {
    return accessModules.every((m) => isAllSelected(m.alias));
  };

  const saveDetails = async () => {
    const token = getToken();
    const payload = {
      user_id: userId,
      ...formData,
    };
    if (!payload.password) delete payload.password;
    setIsSavingDetails(true);
    try {
      const res = await fetch(`${SUPERADMIN_BASE}/super-admin/admins/update/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.errors?.[0] || "Update failed");
      toast({ title: "Success", description: "Admin details updated successfully" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const refetchPermissions = async () => {
    if (!userId) return;
    const token = getToken();
    const headers = { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };
    try {
      const permsRes = await fetch(`${SUPERADMIN_BASE}/super-admin/admins/permissions/?user_id=${encodeURIComponent(userId)}`, { headers });
      if (!permsRes.ok) return;
      const permsData = await permsRes.json();
      setPermissions(mergePermissionsFromApi(accessModules, permsData.data));
    } catch (_) {}
  };

  const savePermissions = async () => {
    const token = getToken();
    const permissionsList = Object.entries(permissions)
      .filter(([, perms]) => perms && perms.length > 0)
      .map(([alias, perms]) => {
        const module = accessModules.find((m) => m.alias === alias);
        if (!module) return null;
        return {
          module_id: module.id,
          can_create: perms.includes("c"),
          can_read: perms.includes("r"),
          can_update: perms.includes("u"),
          can_delete: perms.includes("d"),
        };
      })
      .filter(Boolean);

    setIsSavingPermissions(true);
    try {
      const res = await fetch(`${SUPERADMIN_BASE}/super-admin/admins/grant-permissions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ user_id: userId, permissions: permissionsList }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save permissions");
      toast({ title: "Success", description: "Permissions updated successfully" });
      await refetchPermissions();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  if (isLoading) return <CommonLoader />;

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
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/superadmin/admin-list")}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="bg-gradient-to-r from-black to-gray-600 p-2 rounded-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Admin</h1>
              <p className="text-sm text-gray-600">
                {adminInfo?.name} ({adminInfo?.user_id})
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card className="shadow-sm border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value.replace(/[^A-Za-z ]/g, ""))}
                      placeholder="Full name"
                      maxLength={25}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile *</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange("mobile", e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Mobile"
                      maxLength={10}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="Email"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      placeholder="Address"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value.replace(/[^A-Za-z ]/g, ""))}
                      placeholder="City"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange("state", e.target.value.replace(/[^A-Za-z ]/g, ""))}
                      placeholder="State"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => handleInputChange("pincode", e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Pincode"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={saveDetails}
                    disabled={isSavingDetails}
                    className="bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white"
                  >
                    {isSavingDetails ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Access Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="h-12 px-4 py-3 text-center font-semibold text-gray-900 uppercase text-xs w-24">
                          <div className="flex flex-col items-center gap-1">
                            <span>All</span>
                            <Checkbox
                              checked={isAllModulesSelected()}
                              onCheckedChange={handleSelectAllModules}
                            />
                          </div>
                        </th>
                        <th className="h-12 px-4 py-3 text-left font-semibold text-gray-900 uppercase text-xs">
                          Module
                        </th>
                        <th className="h-12 px-4 py-3 text-center font-semibold text-gray-900 uppercase text-xs">
                          Create
                        </th>
                        <th className="h-12 px-4 py-3 text-center font-semibold text-gray-900 uppercase text-xs">
                          Read
                        </th>
                        <th className="h-12 px-4 py-3 text-center font-semibold text-gray-900 uppercase text-xs">
                          Update
                        </th>
                        <th className="h-12 px-4 py-3 text-center font-semibold text-gray-900 uppercase text-xs">
                          Delete
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {accessModules.map((module) => (
                        <tr key={module.id} className="hover:bg-gray-50">
                          <td className="px-2 py-3 text-center">
                            <Checkbox
                              checked={isAllSelected(module.alias)}
                              onCheckedChange={(checked) => handleSelectAll(module.alias, checked)}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{module.name}</td>
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={permissions[module.alias]?.includes("c") || false}
                              onCheckedChange={(c) => handlePermissionChange(module.alias, "c", c)}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={permissions[module.alias]?.includes("r") || false}
                              onCheckedChange={(c) => handlePermissionChange(module.alias, "r", c)}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={permissions[module.alias]?.includes("u") || false}
                              onCheckedChange={(c) => handlePermissionChange(module.alias, "u", c)}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={permissions[module.alias]?.includes("d") || false}
                              onCheckedChange={(c) => handlePermissionChange(module.alias, "d", c)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    type="button"
                    onClick={savePermissions}
                    disabled={isSavingPermissions}
                    className="bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white"
                  >
                    {isSavingPermissions ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <KeyRound className="h-4 w-4 mr-2" />
                    )}
                    Save Permissions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
