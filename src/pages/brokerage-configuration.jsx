import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, Percent, CheckCircle, XCircle, Menu, RefreshCw, Plus, Edit, Eye } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function formatAssignedDate(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return isoStr;
  }
}

export default function BrokerageConfiguration() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [brokerFilter, setBrokerFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [formData, setFormData] = useState({
    broker_id: "",
    brokerage_level: "GENERAL",
    brokerage_percent: "",
    stock_group_ids: [],
    stock_category_ids: [],
    stock_item_ids: [],
    is_active: true,
  });
  const [stockListSearch, setStockListSearch] = useState("");

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();

  const token = () => AuthService.getAccessToken();
  const headers = () => ({
    Authorization: `Bearer ${token()}`,
    "Content-Type": "application/json",
  });

  const fetchList = async () => {
    const params = new URLSearchParams();
    if (brokerFilter) params.set("broker_id", brokerFilter);
    if (activeFilter !== "all") params.set("is_active", activeFilter);
    const response = await fetch(
      `${API_BASE_URL}/api/accounts/brokerage-configuration/?${params}`,
      { method: "GET", headers: headers() }
    );
    if (!response.ok) throw new Error("Failed to fetch brokerage configurations");
    return response.json();
  };

  const fetchUsers = async () => {
    const response = await fetch(`${API_BASE_URL}/api/get-users/?role_id=11`, {
      method: "GET",
      headers: headers(),
    });
    if (!response.ok) throw new Error("Failed to fetch users");
    const data = await response.json();
    return data.data || [];
  };

  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: ["brokerage-configuration", brokerFilter, activeFilter],
    queryFn: fetchList,
    enabled: !!token() && hasPermission("brokerage", "read"),
  });

  const { data: usersList = [] } = useQuery({
    queryKey: ["users-for-brokerage"],
    queryFn: fetchUsers,
    enabled: !!token() && (hasPermission("brokerage", "read") || isCreateDialogOpen || isEditDialogOpen),
  });

  // When navigated from user-list (Brokerage button): auto-select Broker filter
  useEffect(() => {
    try {
      const brokerId = sessionStorage.getItem("brokerage_config_filter_broker_id");
      if (!brokerId) return;
      sessionStorage.removeItem("brokerage_config_filter_broker_id");
      setBrokerFilter(brokerId);
    } catch (_) {}
  }, []);

  // When navigated from add-user after creating a Broker: open Add Configuration with that broker pre-selected
  useEffect(() => {
    if (permissionsLoading) return;
    try {
      const brokerId = sessionStorage.getItem("brokerage_config_open_with_broker");
      if (!brokerId || !hasPermission("brokerage", "create")) return;
      sessionStorage.removeItem("brokerage_config_open_with_broker");
      queryClient.invalidateQueries(["users-for-brokerage"]);
      setFormData({
        broker_id: brokerId,
        brokerage_level: "GENERAL",
        brokerage_percent: "",
        stock_group_ids: [],
        stock_category_ids: [],
        stock_item_ids: [],
        is_active: true,
      });
      setStockListSearch("");
      setIsCreateDialogOpen(true);
    } catch (_) {}
  }, [permissionsLoading]);

  const fetchStockGroups = async () => {
    const r = await fetch(`${API_BASE_URL}/api/get-stock-groups/`, { method: "POST", headers: headers(), body: JSON.stringify({}) });
    if (!r.ok) throw new Error("Failed to fetch stock groups");
    const d = await r.json();
    return d.data || [];
  };
  const fetchStockCategories = async () => {
    const r = await fetch(`${API_BASE_URL}/api/get-stock-categories/`, { method: "GET", headers: headers() });
    if (!r.ok) throw new Error("Failed to fetch stock categories");
    const d = await r.json();
    return d.data || [];
  };
  const fetchStockItems = async () => {
    const r = await fetch(`${API_BASE_URL}/api/get-stock-items/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ new_page: 1, per_page: 500, search: stockListSearch || "", type: "", stock_group: "", godown: "", voucher_type: "" }),
    });
    if (!r.ok) throw new Error("Failed to fetch stock items");
    const d = await r.json();
    return d.data || [];
  };

  const dialogsOpen = isCreateDialogOpen || isEditDialogOpen;
  const level = formData.brokerage_level;
  const { data: stockGroupsList = [] } = useQuery({
    queryKey: ["brokerage-stock-groups"],
    queryFn: fetchStockGroups,
    enabled: !!token() && dialogsOpen && level === "GROUP",
  });
  const { data: stockCategoriesList = [] } = useQuery({
    queryKey: ["brokerage-stock-categories"],
    queryFn: fetchStockCategories,
    enabled: !!token() && dialogsOpen && level === "CATEGORY",
  });
  const { data: stockItemsList = [] } = useQuery({
    queryKey: ["brokerage-stock-items", stockListSearch],
    queryFn: fetchStockItems,
    enabled: !!token() && dialogsOpen && level === "ITEM",
  });

  const addMutation = useMutation({
    mutationFn: async (body) => {
      const response = await fetch(
        `${API_BASE_URL}/api/accounts/brokerage-configuration/add/`,
        { method: "POST", headers: headers(), body: JSON.stringify(body) }
      );
      const data = await response.json();
      if (data.status !== 201) throw new Error(data.message || "Failed to add");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["brokerage-configuration"]);
      toast({ title: "Success", description: data.message || "Brokerage configuration added." });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message || "Failed to add", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }) => {
      const response = await fetch(
        `${API_BASE_URL}/api/accounts/brokerage-configuration/${id}/update/`,
        { method: "PUT", headers: headers(), body: JSON.stringify(body) }
      );
      const data = await response.json();
      if (data.status !== 200) throw new Error(data.message || "Failed to update");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["brokerage-configuration"]);
      toast({ title: "Success", description: data.message || "Brokerage configuration updated." });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      resetForm();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      broker_id: "",
      brokerage_level: "GENERAL",
      brokerage_percent: "",
      stock_group_ids: [],
      stock_category_ids: [],
      stock_item_ids: [],
      is_active: true,
    });
    setStockListSearch("");
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "brokerage_level") {
        next.stock_group_ids = [];
        next.stock_category_ids = [];
        next.stock_item_ids = [];
      }
      return next;
    });
  };

  const toggleId = (field, id) => {
    setFormData((prev) => {
      const arr = prev[field] || [];
      const set = new Set(arr);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [field]: Array.from(set) };
    });
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleView = (row) => {
    setViewingItem(row);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (row) => {
    setEditingItem(row);
    setFormData({
      broker_id: row.broker_id || "",
      brokerage_level: row.brokerage_level || "GENERAL",
      brokerage_percent: row.brokerage_percent ?? "",
      stock_group_ids: row.stock_group_ids || [],
      stock_category_ids: row.stock_category_ids || [],
      stock_item_ids: row.stock_item_ids || [],
      is_active: row.is_active !== false,
    });
    setStockListSearch("");
    setIsEditDialogOpen(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formData.broker_id) {
      toast({ title: "Validation", description: "Broker is required", variant: "destructive" });
      return;
    }
    if (formData.brokerage_percent === "" || isNaN(parseFloat(formData.brokerage_percent))) {
      toast({ title: "Validation", description: "Valid brokerage percentage is required", variant: "destructive" });
      return;
    }
    const percent = parseFloat(formData.brokerage_percent);
    if (percent < 0 || percent > 100) {
      toast({ title: "Validation", description: "Brokerage percentage must be between 0 and 100", variant: "destructive" });
      return;
    }
    const body = {
      broker_id: formData.broker_id,
      brokerage_level: formData.brokerage_level,
      brokerage_percent: String(percent),
    };
    if (formData.brokerage_level === "GROUP" && formData.stock_group_ids.length) body.stock_group_ids = formData.stock_group_ids;
    if (formData.brokerage_level === "CATEGORY" && formData.stock_category_ids.length) body.stock_category_ids = formData.stock_category_ids;
    if (formData.brokerage_level === "ITEM" && formData.stock_item_ids.length) body.stock_item_ids = formData.stock_item_ids;
    addMutation.mutate(body);
  };

  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    if (!editingItem?.id) return;
    if (formData.brokerage_percent !== "" && !isNaN(parseFloat(formData.brokerage_percent))) {
      const percent = parseFloat(formData.brokerage_percent);
      if (percent < 0 || percent > 100) {
        toast({ title: "Validation", description: "Brokerage percentage must be between 0 and 100", variant: "destructive" });
        return;
      }
    }
    const body = {
      brokerage_level: formData.brokerage_level,
      brokerage_percent: formData.brokerage_percent !== "" ? String(parseFloat(formData.brokerage_percent)) : undefined,
      is_active: formData.is_active,
    };
    if (formData.brokerage_level === "GROUP") body.stock_group_ids = formData.stock_group_ids;
    if (formData.brokerage_level === "CATEGORY") body.stock_category_ids = formData.stock_category_ids;
    if (formData.brokerage_level === "ITEM") body.stock_item_ids = formData.stock_item_ids;
    updateMutation.mutate({ id: editingItem.id, body });
  };

  const configs = listData?.data || [];

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

  if (!hasPermission("brokerage", "read")) {
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
              <Percent className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">You don't have permission to view brokerage configuration.</p>
              <Button onClick={() => window.history.back()} variant="outline">Go Back</Button>
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
                <Percent className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Brokerage Configuration</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center space-x-1">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {hasPermission("brokerage", "create") && (
                <Button onClick={handleCreate} className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  <span>Add Configuration</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600">Broker</Label>
                  <Select value={brokerFilter || "all"} onValueChange={(v) => setBrokerFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All brokers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All brokers</SelectItem>
                      {usersList.map((u) => (
                        <SelectItem key={u.user_id} value={String(u.user_id)}>
                          {u.name} ({u.user_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600">Status</Label>
                  <Select value={activeFilter} onValueChange={setActiveFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Brokerage configurations ({configs.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <CommonLoader />
              ) : configs.length === 0 ? (
                <div className="text-center py-8">
                  <Percent className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No configurations found</h3>
                  <p className="text-gray-500 mb-4">Add a brokerage configuration to get started.</p>
                  {hasPermission("brokerage", "create") && (
                    <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Configuration
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Broker</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Level</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Brokerage %</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Assigned count</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Assigned date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Assigned by</th>

                        <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{row.broker_name || row.broker_id || "—"}</div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary">{row.brokerage_level_display || row.brokerage_level}</Badge>
                          </td>
                          <td className="py-3 px-4 font-medium">{row.brokerage_percent}%</td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {row.assigned_count != null ? row.assigned_count : "—"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatAssignedDate(row.created_at)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {row.created_by_name || "—"}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {row.is_active ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={`text-sm ${row.is_active ? "text-green-600" : "text-red-600"}`}>
                                {row.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(row)}
                                className="h-8 w-8 p-0"
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasPermission("brokerage", "update") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(row)}
                                  className="h-8 w-8 p-0"
                                  title="Edit"
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Brokerage Configuration Details</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 text-xs">Broker</Label>
                  <p className="font-medium">{viewingItem.broker_name || viewingItem.broker_id || "—"}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Level</Label>
                  <p className="font-medium"><Badge variant="secondary">{viewingItem.brokerage_level_display || viewingItem.brokerage_level}</Badge></p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Brokerage %</Label>
                  <p className="font-medium">{viewingItem.brokerage_percent}%</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Status</Label>
                  <p className="font-medium">
                    {viewingItem.is_active ? (
                      <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Active</span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1"><XCircle className="h-4 w-4" /> Inactive</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Branch</Label>
                  <p className="font-medium">{viewingItem.branch_name || "—"}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Assigned count</Label>
                  <p className="font-medium">{viewingItem.assigned_count != null ? viewingItem.assigned_count : "—"}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Assigned date</Label>
                  <p className="font-medium">{formatAssignedDate(viewingItem.created_at)}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Assigned by</Label>
                  <p className="font-medium">{viewingItem.created_by_name || "—"}</p>
                </div>
              </div>

              {/* Stock Groups section */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  Stock Groups
                  <Badge variant="outline" className="font-normal">
                    {(viewingItem.stock_groups && viewingItem.stock_groups.length) || viewingItem.stock_group_count || 0}
                  </Badge>
                </h4>
                {((viewingItem.stock_groups && viewingItem.stock_groups.length) || viewingItem.stock_group_ids?.length) > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Id</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewingItem.stock_groups || viewingItem.stock_group_ids?.map((id, idx) => ({ id, name: viewingItem.stock_group_names?.[idx] || "—" })) || []).map((g) => (
                          <tr key={g.id} className="border-t border-gray-100">
                            <td className="py-2 px-3 text-gray-700">{g.id}</td>
                            <td className="py-2 px-3">{g.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No stock groups assigned.</p>
                )}
              </div>

              {/* Stock Categories section */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  Stock Categories
                  <Badge variant="outline" className="font-normal">
                    {(viewingItem.stock_categories && viewingItem.stock_categories.length) || viewingItem.stock_category_count || 0}
                  </Badge>
                </h4>
                {((viewingItem.stock_categories && viewingItem.stock_categories.length) || viewingItem.stock_category_ids?.length) > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Id</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewingItem.stock_categories || viewingItem.stock_category_ids?.map((id, idx) => ({ id, name: viewingItem.stock_category_names?.[idx] || "—" })) || []).map((c) => (
                          <tr key={c.id} className="border-t border-gray-100">
                            <td className="py-2 px-3 text-gray-700">{c.id}</td>
                            <td className="py-2 px-3">{c.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No stock categories assigned.</p>
                )}
              </div>

              {/* Stock Items section */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  Stock Items
                  <Badge variant="outline" className="font-normal">
                    {(viewingItem.stock_items && viewingItem.stock_items.length) || viewingItem.stock_item_count || 0}
                  </Badge>
                </h4>
                {((viewingItem.stock_items && viewingItem.stock_items.length) || viewingItem.stock_item_ids?.length) > 0 ? (
                  <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Id</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewingItem.stock_items || viewingItem.stock_item_ids?.map((id, idx) => ({ id, name: viewingItem.stock_item_names?.[idx] || "—" })) || []).map((i) => (
                          <tr key={i.id} className="border-t border-gray-100">
                            <td className="py-2 px-3 text-gray-700">{i.id}</td>
                            <td className="py-2 px-3">{i.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No stock items assigned.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Brokerage Configuration</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <Label>Broker (User) *</Label>
              <Select
                value={formData.broker_id}
                onValueChange={(v) => handleInputChange("broker_id", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select broker" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.name} ({u.user_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Brokerage Level *</Label>
              <Select
                value={formData.brokerage_level}
                onValueChange={(v) => handleInputChange("brokerage_level", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="GROUP">Stock Group</SelectItem>
                  <SelectItem value="CATEGORY">Stock Category</SelectItem>
                  <SelectItem value="ITEM">Stock Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.brokerage_level === "GROUP" && (
              <div>
                <Label>Select Stock Groups</Label>
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 mt-1">
                  {(stockGroupsList || []).map((g) => (
                    <label key={g.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formData.stock_group_ids.includes(g.id)}
                        onChange={() => toggleId("stock_group_ids", g.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{g.name}</span>
                    </label>
                  ))}
                  {stockGroupsList.length === 0 && <p className="text-sm text-gray-500 py-2">No stock groups found.</p>}
                </div>
              </div>
            )}
            {formData.brokerage_level === "CATEGORY" && (
              <div>
                <Label>Select Stock Categories</Label>
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 mt-1">
                  {(stockCategoriesList || []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formData.stock_category_ids.includes(c.id)}
                        onChange={() => toggleId("stock_category_ids", c.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))}
                  {stockCategoriesList.length === 0 && <p className="text-sm text-gray-500 py-2">No stock categories found.</p>}
                </div>
              </div>
            )}
            {formData.brokerage_level === "ITEM" && (
              <div>
                <Label>Select Stock Items</Label>
                <Input
                  placeholder="Search items..."
                  value={stockListSearch}
                  onChange={(e) => setStockListSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 mt-1">
                  {(stockItemsList || []).map((i) => (
                    <label key={i.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formData.stock_item_ids.includes(i.id)}
                        onChange={() => toggleId("stock_item_ids", i.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{i.name}</span>
                    </label>
                  ))}
                  {stockItemsList.length === 0 && <p className="text-sm text-gray-500 py-2">No stock items found.</p>}
                </div>
              </div>
            )}
            <div>
              <Label>Brokerage Percentage * (0–100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.brokerage_percent}
                onChange={(e) => handleInputChange("brokerage_percent", e.target.value)}
                placeholder="e.g. 2.5"
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {addMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Brokerage Configuration</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSubmit} className="space-y-4">
            <div>
              <Label>Broker</Label>
              <Input value={editingItem?.broker_name || editingItem?.broker_id || "—"} disabled className="bg-gray-100" />
            </div>
            <div>
              <Label>Brokerage Level</Label>
              <Select
                value={formData.brokerage_level}
                onValueChange={(v) => handleInputChange("brokerage_level", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="GROUP">Stock Group</SelectItem>
                  <SelectItem value="CATEGORY">Stock Category</SelectItem>
                  <SelectItem value="ITEM">Stock Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.brokerage_level === "GROUP" && (
              <div>
                <Label>Select Stock Groups</Label>
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 mt-1">
                  {(stockGroupsList || []).map((g) => (
                    <label key={g.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formData.stock_group_ids.includes(g.id)}
                        onChange={() => toggleId("stock_group_ids", g.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{g.name}</span>
                    </label>
                  ))}
                  {stockGroupsList.length === 0 && <p className="text-sm text-gray-500 py-2">No stock groups found.</p>}
                </div>
              </div>
            )}
            {formData.brokerage_level === "CATEGORY" && (
              <div>
                <Label>Select Stock Categories</Label>
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 mt-1">
                  {(stockCategoriesList || []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formData.stock_category_ids.includes(c.id)}
                        onChange={() => toggleId("stock_category_ids", c.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))}
                  {stockCategoriesList.length === 0 && <p className="text-sm text-gray-500 py-2">No stock categories found.</p>}
                </div>
              </div>
            )}
            {formData.brokerage_level === "ITEM" && (
              <div>
                <Label>Select Stock Items</Label>
                <Input
                  placeholder="Search items..."
                  value={stockListSearch}
                  onChange={(e) => setStockListSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 mt-1">
                  {(stockItemsList || []).map((i) => (
                    <label key={i.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={formData.stock_item_ids.includes(i.id)}
                        onChange={() => toggleId("stock_item_ids", i.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{i.name}</span>
                    </label>
                  ))}
                  {stockItemsList.length === 0 && <p className="text-sm text-gray-500 py-2">No stock items found.</p>}
                </div>
              </div>
            )}
            <div>
              <Label>Brokerage Percentage (0–100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.brokerage_percent}
                onChange={(e) => handleInputChange("brokerage_percent", e.target.value)}
                placeholder="e.g. 2.5"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => handleInputChange("is_active", v)}
              />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {updateMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
