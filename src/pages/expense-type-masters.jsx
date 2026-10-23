import { useState, Fragment, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  Search,
  Receipt,
  CheckCircle,
  XCircle,
  Menu,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const getBackendUrl = () => {
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  return import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
};

const authHeaders = () => {
  const token = AuthService.getAccessToken();
  if (!token) {
    throw new Error("No authentication token found");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const emptySubTypeRow = () => ({ sub_type: "", is_active: true });

export default function ExpenseTypeMasters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedTypeId, setExpandedTypeId] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newSubTypeName, setNewSubTypeName] = useState("");
  const [formData, setFormData] = useState({
    type: "",
    is_active: true,
    sub_types: [emptySubTypeRow()],
  });

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    isLoading: permissionsLoading,
  } = useUserPermissions();

  const fetchExpenseTypesMaster = async () => {
    const params = new URLSearchParams();
    if (includeInactive) params.set("include_inactive", "true");

    const response = await fetch(
      `${getBackendUrl()}/api/accounts/expense-types-master/?${params.toString()}`,
      { method: "GET", headers: authHeaders() }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  const saveExpenseType = async (payload) => {
    const response = await fetch(`${getBackendUrl()}/api/accounts/create-expense-type/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  const deleteExpenseType = async ({ type, id }) => {
    const url =
      type === "type"
        ? `${getBackendUrl()}/api/accounts/delete-expense-type/${id}/`
        : `${getBackendUrl()}/api/accounts/delete-expense-sub-type/${id}/`;

    const response = await fetch(url, { method: "POST", headers: authHeaders() });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["expense-types-master", includeInactive],
    queryFn: fetchExpenseTypesMaster,
    retry: 1,
    enabled: hasReadPermission("expense_management"),
    placeholderData: (previousData) => previousData,
  });

  const saveMutation = useMutation({
    mutationFn: saveExpenseType,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["expense-types-master"] });
      toast({ title: "Success", description: result.message || "Saved successfully" });
      setIsDialogOpen(false);
      resetForm();
      setNewSubTypeName("");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpenseType,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["expense-types-master"] });
      toast({ title: "Success", description: result.message || "Deleted successfully" });
      setDeleteTarget(null);
      setExpandedTypeId(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const expenseTypes = data?.data || [];

  const filteredExpenseTypes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return expenseTypes;

    return expenseTypes.filter((item) => {
      const typeMatch = (item.type || "").toLowerCase().includes(term);
      const subTypeMatch = (item.sub_types || []).some((subType) =>
        (subType.sub_type || "").toLowerCase().includes(term)
      );
      return typeMatch || subTypeMatch;
    });
  }, [expenseTypes, searchTerm]);

  const resetForm = () => {
    setFormData({ type: "", is_active: true, sub_types: [emptySubTypeRow()] });
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      type: item.type || "",
      is_active: item.is_active,
      sub_types:
        item.sub_types?.length > 0
          ? item.sub_types.map((st) => ({
              id: st.id,
              sub_type: st.sub_type,
              is_active: st.is_active,
            }))
          : [emptySubTypeRow()],
    });
    setIsDialogOpen(true);
  };

  const handleSubTypeFieldChange = (index, field, value) => {
    setFormData((prev) => {
      const subTypes = [...prev.sub_types];
      subTypes[index] = { ...subTypes[index], [field]: value };
      return { ...prev, sub_types: subTypes };
    });
  };

  const addSubTypeRow = () => {
    setFormData((prev) => ({
      ...prev,
      sub_types: [...prev.sub_types, emptySubTypeRow()],
    }));
  };

  const removeSubTypeRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      sub_types: prev.sub_types.filter((_, i) => i !== index),
    }));
  };

  const buildPayload = (typeItem, extraSubTypes = []) => {
    const existingSubTypes = (typeItem.sub_types || []).map((st) => ({
      id: st.id,
      sub_type: st.sub_type,
      is_active: st.is_active,
    }));
    const newSubTypes = extraSubTypes
      .map((name) => name.trim())
      .filter(Boolean)
      .map((sub_type) => ({ sub_type, is_active: true }));

    return {
      id: typeItem.id,
      type: typeItem.type,
      is_active: typeItem.is_active,
      sub_types: [...existingSubTypes, ...newSubTypes],
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.type.trim()) {
      toast({
        title: "Validation Error",
        description: "Expense type name is required",
        variant: "destructive",
      });
      return;
    }

    const subTypes = formData.sub_types
      .map((st) => ({
        ...(st.id ? { id: st.id } : {}),
        sub_type: (st.sub_type || "").trim(),
        is_active: st.is_active,
      }))
      .filter((st) => st.sub_type);

    saveMutation.mutate({
      ...(formData.id ? { id: formData.id } : {}),
      type: formData.type.trim(),
      is_active: formData.is_active,
      sub_types: subTypes,
    });
  };

  const handleAddSubTypeInline = (typeItem) => {
    const name = newSubTypeName.trim();
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Sub-type name is required",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(buildPayload(typeItem, [name]));
  };

  const toggleExpanded = (typeId) => {
    setExpandedTypeId((prev) => (prev === typeId ? null : typeId));
    setNewSubTypeName("");
  };

  const renderStatus = (isActive) => (
    <div className="flex items-center space-x-2">
      {isActive ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={`text-sm ${isActive ? "text-green-600" : "text-red-600"}`}>
        {isActive ? "Active" : "Inactive"}
      </span>
    </div>
  );

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

  if (!hasReadPermission("expense_management")) {
    return (
      <div className="flex h-screen bg-gray-50">
        {isMobile ? (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        ) : (
          <Sidebar />
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
            <Receipt className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">You do not have permission to manage expense types.</p>
            <Button onClick={() => window.history.back()} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return <CommonLoader />;
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center text-red-600">{error.message}</div>
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
              <Receipt className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Expense Types</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {hasCreatePermission("expense_management") && (
                <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense Type
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="flex-1 relative min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search expense types or sub-types..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-9"
                  />
                  {isFetching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include_inactive"
                    checked={includeInactive}
                    onCheckedChange={setIncludeInactive}
                  />
                  <Label htmlFor="include_inactive">Show inactive</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Expense Types ({filteredExpenseTypes.length}
                {searchTerm.trim() && filteredExpenseTypes.length !== expenseTypes.length
                  ? ` of ${expenseTypes.length}`
                  : ""}
                )
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredExpenseTypes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm.trim() ? "No expense types match your search" : "No expense types found"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Sub-Types</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Created</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenseTypes.map((item) => (
                        <Fragment key={item.id}>
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-900">{item.type}</td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary">{item.sub_type_count || 0}</Badge>
                            </td>
                            <td className="py-3 px-4">{renderStatus(item.is_active)}</td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpanded(item.id)}
                                  className="text-blue-600"
                                >
                                  {expandedTypeId === item.id ? (
                                    <>
                                      <ChevronUp className="h-4 w-4 mr-1" />
                                      View Less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-4 w-4 mr-1" />
                                      View More
                                    </>
                                  )}
                                </Button>
                                {hasUpdatePermission("expense_management") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(item)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {hasDeletePermission("expense_management") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTarget({ type: "type", id: item.id, name: item.type })}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedTypeId === item.id && (
                            <tr key={`${item.id}-expanded`} className="bg-gray-50 border-b border-gray-100">
                              <td colSpan={5} className="px-4 py-4">
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-gray-700">Sub-Types</h4>
                                  {item.sub_types?.length > 0 ? (
                                    <div className="space-y-2">
                                      {item.sub_types.map((subType) => (
                                        <div
                                          key={subType.id}
                                          className="flex items-center justify-between bg-white border rounded-md px-3 py-2"
                                        >
                                          <span className="text-sm text-gray-900">{subType.sub_type}</span>
                                          <div className="flex items-center gap-2">
                                            {renderStatus(subType.is_active)}
                                            {hasDeletePermission("expense_management") && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600"
                                                onClick={() =>
                                                  setDeleteTarget({
                                                    type: "sub_type",
                                                    id: subType.id,
                                                    name: subType.sub_type,
                                                  })
                                                }
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">No sub-types added yet.</p>
                                  )}

                                  {hasCreatePermission("expense_management") && (
                                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                      <Input
                                        placeholder="Add new sub-type"
                                        value={expandedTypeId === item.id ? newSubTypeName : ""}
                                        onChange={(e) => setNewSubTypeName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddSubTypeInline(item);
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        onClick={() => handleAddSubTypeInline(item)}
                                        disabled={saveMutation.isPending}
                                        className="bg-blue-600 hover:bg-blue-700 shrink-0"
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Sub-Type
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formData.id ? "Edit Expense Type" : "Add Expense Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="type">Expense Type *</Label>
              <Input
                id="type"
                value={formData.type}
                placeholder="e.g. Travel, Food"
                required
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setFormData((prev) => ({ ...prev, type: value }));
                  }
                }}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Sub-Types</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSubTypeRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Row
                </Button>
              </div>
              {formData.sub_types.map((subType, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={subType.sub_type}
                    onChange={(e) => handleSubTypeFieldChange(index, "sub_type", e.target.value)}
                    placeholder={`Sub-type ${index + 1}`}
                    className="flex-1"
                  />
                  {formData.sub_types.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSubTypeRow(index)}
                      className="text-red-600 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              {deleteTarget?.type === "type" && " All sub-types under this expense type will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
