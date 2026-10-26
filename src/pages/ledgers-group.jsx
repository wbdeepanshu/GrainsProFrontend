import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  CreditCard,
  FolderTree,
  Layers,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/useDebounce";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const TABS = [
  { id: "ledger_groups", label: "Ledger Groups", icon: FolderTree },
  { id: "business_types", label: "Business Types", icon: Building2 },
  { id: "credit_types", label: "Credit Types", icon: CreditCard },
  { id: "category_types", label: "Category Types", icon: Layers },
];

const DEFAULT_PARENT_OPTIONS = ["Primary", "Sundry Debtors", "Sundry Creditors"];

const actionIconButtonClass =
  "inline-flex items-center justify-center shrink-0 h-8 w-8 min-h-8 min-w-8 p-0";

function TypeMasterCardGrid({ items, emptyMessage, onEdit, onDelete, deletingId, valueLabel = "Margin %" }) {
  if (!items?.length) {
    return (
      <div className="text-center text-neutral-500 py-8 border border-dashed border-[#c9a227]/40 rounded-lg text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {items.map((item) => {
        const title = item.name || item.type || "—";
        const extra =
          valueLabel.toLowerCase().includes("min")
            ? item.min_order_value ?? "—"
            : item.margin_percent ?? "—";
        return (
          <div
            key={item.id}
            className="rounded-lg border border-[#c9a227]/45 bg-white p-2.5 shadow-sm hover:border-[#c9a227] transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-black break-words">{title}</p>
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                  {item.description?.trim() ? item.description : "No description"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(item)}
                  title="Edit"
                  className={`${actionIconButtonClass} border-black text-black hover:bg-neutral-50`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id}
                  title="Delete"
                  className={`${actionIconButtonClass} border-red-400 text-red-600 hover:bg-red-50`}
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-[#c9a227]/25 text-xs">
              <span className="text-neutral-500">{valueLabel}</span>
              <span className="ml-1 font-semibold text-black tabular-nums">{extra}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ active, label }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-neutral-100 text-neutral-500 border border-neutral-200"
      }`}
    >
      {label}
    </span>
  );
}

export default function LedgersGroup() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ledger_groups");

  const [ledgerGroupSearch, setLedgerGroupSearch] = useState("");
  const debouncedLedgerSearch = useDebounce(ledgerGroupSearch, 300);
  const [ledgerGroupPage, setLedgerGroupPage] = useState(1);
  const [isLedgerGroupDialogOpen, setIsLedgerGroupDialogOpen] = useState(false);
  const [ledgerGroupForm, setLedgerGroupForm] = useState({
    name: "",
    parent: "Sundry Debtors",
    is_active: true,
    is_live: false,
  });

  const [isBusinessTypeDialogOpen, setIsBusinessTypeDialogOpen] = useState(false);
  const [editingBusinessTypeId, setEditingBusinessTypeId] = useState(null);
  const [businessTypeForm, setBusinessTypeForm] = useState({
    name: "",
    description: "",
    margin_percent: "",
  });

  const [isCreditTypeDialogOpen, setIsCreditTypeDialogOpen] = useState(false);
  const [editingCreditTypeId, setEditingCreditTypeId] = useState(null);
  const [creditTypeForm, setCreditTypeForm] = useState({
    name: "",
    description: "",
    margin_percent: "",
  });

  const [isCategoryTypeDialogOpen, setIsCategoryTypeDialogOpen] = useState(false);
  const [editingCategoryTypeId, setEditingCategoryTypeId] = useState(null);
  const [categoryTypeForm, setCategoryTypeForm] = useState({
    type: "",
    min_order_value: "",
    margin_percent: "0",
  });

  const {
    data: ledgerGroupsResponse,
    isLoading: isLoadingLedgerGroups,
  } = useQuery({
    queryKey: ["ledger-groups-page", debouncedLedgerSearch, ledgerGroupPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(ledgerGroupPage));
      params.set("per_page", "60");
      if (debouncedLedgerSearch.trim()) params.set("search", debouncedLedgerSearch.trim());
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok || (data.status && Number(data.status) >= 400)) {
        throw new Error(data.message || data.error || "Failed to fetch ledger groups");
      }
      return data;
    },
    enabled: !!AuthService.getAccessToken() && activeTab === "ledger_groups",
  });

  const ledgerGroups = useMemo(
    () => (Array.isArray(ledgerGroupsResponse?.data) ? ledgerGroupsResponse.data : []),
    [ledgerGroupsResponse]
  );
  const ledgerGroupsPagination = ledgerGroupsResponse?.pagination || {};
  const parentOptions = useMemo(() => {
    const fromApi = ledgerGroupsResponse?.parent_options;
    return Array.isArray(fromApi) && fromApi.length ? fromApi : DEFAULT_PARENT_OPTIONS;
  }, [ledgerGroupsResponse]);

  const { data: businessTypesData = [], isLoading: isLoadingBusinessTypes } = useQuery({
    queryKey: ["business-types"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/business-types/?page_size=1000`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && activeTab === "business_types",
  });

  const { data: creditTypesData = [], isLoading: isLoadingCreditTypes } = useQuery({
    queryKey: ["credit-types"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/credit-types/?page_size=1000`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && activeTab === "credit_types",
  });

  const { data: categoryTypesData = [], isLoading: isLoadingCategoryTypes } = useQuery({
    queryKey: ["category-types"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/growth/category-types/`);
      const data = await response.json();
      if (!response.ok || (data.status && data.status !== 200)) {
        throw new Error(data.message || "Failed to fetch category types");
      }
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && activeTab === "category_types",
  });

  const createLedgerGroupMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/report/create-ledger-group/`,
        payload
      );
      const data = await response.json();
      if (!response.ok || (data.status && Number(data.status) >= 400)) {
        throw new Error(data.message || data.error || "Failed to create ledger group");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Ledger group created" });
      queryClient.invalidateQueries({ queryKey: ["ledger-groups-page"] });
      setIsLedgerGroupDialogOpen(false);
      setLedgerGroupForm({
        name: "",
        parent: "Sundry Debtors",
        is_active: true,
        is_live: false,
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLedgerGroupMutation = useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const response = await apiRequest(
        "PUT",
        `${API_BASE_URL}/api/report/update-ledger-group/${id}/`,
        payload
      );
      const data = await response.json();
      if (!response.ok || (data.status && Number(data.status) >= 400)) {
        throw new Error(data.message || data.error || "Failed to update ledger group");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Ledger group updated" });
      queryClient.invalidateQueries({ queryKey: ["ledger-groups-page"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveBusinessTypeMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/accounts/create-business-type/`,
        payload
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || "Failed to save business type");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Business type saved" });
      queryClient.invalidateQueries({ queryKey: ["business-types"] });
      setIsBusinessTypeDialogOpen(false);
      setEditingBusinessTypeId(null);
      setBusinessTypeForm({ name: "", description: "", margin_percent: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveCreditTypeMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/accounts/create-credit-type/`,
        payload
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || "Failed to save credit type");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Credit type saved" });
      queryClient.invalidateQueries({ queryKey: ["credit-types"] });
      setIsCreditTypeDialogOpen(false);
      setEditingCreditTypeId(null);
      setCreditTypeForm({ name: "", description: "", margin_percent: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveCategoryTypeMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/growth/create-category-type/`,
        payload
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || "Failed to save category type");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Category type saved" });
      queryClient.invalidateQueries({ queryKey: ["category-types"] });
      queryClient.invalidateQueries({ queryKey: ["common-listings"] });
      setIsCategoryTypeDialogOpen(false);
      setEditingCategoryTypeId(null);
      setCategoryTypeForm({ type: "", min_order_value: "", margin_percent: "0" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBusinessTypeMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiRequest(
        "DELETE",
        `${API_BASE_URL}/api/accounts/delete-business-type/${id}/`
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || "Failed to delete business type");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Business type deleted" });
      queryClient.invalidateQueries({ queryKey: ["business-types"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCreditTypeMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiRequest(
        "DELETE",
        `${API_BASE_URL}/api/accounts/delete-credit-type/${id}/`
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || "Failed to delete credit type");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Credit type deleted" });
      queryClient.invalidateQueries({ queryKey: ["credit-types"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCategoryTypeMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiRequest(
        "DELETE",
        `${API_BASE_URL}/api/growth/delete-category-type/${id}/`
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || "Failed to delete category type");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message || "Category type deleted" });
      queryClient.invalidateQueries({ queryKey: ["category-types"] });
      queryClient.invalidateQueries({ queryKey: ["common-listings"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveLedgerGroup = () => {
    if (createLedgerGroupMutation.isPending) return;
    if (!ledgerGroupForm.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (!ledgerGroupForm.parent) {
      toast({ title: "Validation Error", description: "Parent is required", variant: "destructive" });
      return;
    }
    createLedgerGroupMutation.mutate({
      name: ledgerGroupForm.name.trim(),
      parent: ledgerGroupForm.parent,
      is_active: Boolean(ledgerGroupForm.is_active),
      is_live: Boolean(ledgerGroupForm.is_live),
    });
  };

  const handleSaveBusinessType = () => {
    if (saveBusinessTypeMutation.isPending) return;
    if (!businessTypeForm.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (businessTypeForm.margin_percent === "" || Number.isNaN(Number(businessTypeForm.margin_percent))) {
      toast({
        title: "Validation Error",
        description: "Valid margin percent is required",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      name: businessTypeForm.name.trim(),
      description: businessTypeForm.description.trim(),
      margin_percent: Number(businessTypeForm.margin_percent),
    };
    if (editingBusinessTypeId) payload.id = editingBusinessTypeId;
    saveBusinessTypeMutation.mutate(payload);
  };

  const handleSaveCreditType = () => {
    if (saveCreditTypeMutation.isPending) return;
    if (!creditTypeForm.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (creditTypeForm.margin_percent === "" || Number.isNaN(Number(creditTypeForm.margin_percent))) {
      toast({
        title: "Validation Error",
        description: "Valid margin percent is required",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      name: creditTypeForm.name.trim(),
      description: creditTypeForm.description.trim(),
      margin_percent: Number(creditTypeForm.margin_percent),
    };
    if (editingCreditTypeId) payload.id = editingCreditTypeId;
    saveCreditTypeMutation.mutate(payload);
  };

  const handleSaveCategoryType = () => {
    if (saveCategoryTypeMutation.isPending) return;
    if (!categoryTypeForm.type.trim()) {
      toast({ title: "Validation Error", description: "Type is required", variant: "destructive" });
      return;
    }
    const payload = {
      type: categoryTypeForm.type.trim(),
      min_order_value: categoryTypeForm.min_order_value.trim(),
      margin_percent: Number(categoryTypeForm.margin_percent || 0),
    };
    if (editingCategoryTypeId) payload.id = editingCategoryTypeId;
    saveCategoryTypeMutation.mutate(payload);
  };

  const totalLedgerPages = Math.max(1, Number(ledgerGroupsPagination.total_pages) || 1);

  return (
    <div className="flex h-screen bg-neutral-100">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-[#c9a227]/55 px-3 py-2 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="h-7 w-7 rounded-md bg-black text-white border border-[#c9a227]/60 flex items-center justify-center shrink-0">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <h1 className="text-base font-semibold text-black truncate">Ledgers Group</h1>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-2.5 sm:p-3">
          <div className="max-w-[1400px] mx-auto space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-[#c9a227]/45 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === "ledger_groups" && (
              <Card className="border border-[#c9a227]/45 shadow-sm overflow-hidden">
                <CardHeader className="py-2 px-2.5 border-b border-[#c9a227]/45 bg-white flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-sm font-semibold text-black flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    Ledger Groups
                    <span className="text-xs font-medium text-neutral-500 tabular-nums">
                      ({ledgerGroupsPagination.total_count ?? ledgerGroups.length})
                    </span>
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      setLedgerGroupForm({
                        name: "",
                        parent: parentOptions[1] || parentOptions[0] || "Sundry Debtors",
                        is_active: true,
                        is_live: false,
                      });
                      setIsLedgerGroupDialogOpen(true);
                    }}
                    className="h-7 text-xs bg-black text-white border border-[#c9a227]/70 hover:bg-neutral-800"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Ledger Group
                  </Button>
                </CardHeader>
                <CardContent className="p-2.5 space-y-2.5">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                    <Input
                      value={ledgerGroupSearch}
                      onChange={(e) => {
                        setLedgerGroupSearch(e.target.value);
                        setLedgerGroupPage(1);
                      }}
                      placeholder="Search ledger groups..."
                      className="h-8 pl-8 text-sm"
                    />
                  </div>

                  {isLoadingLedgerGroups ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
                    </div>
                  ) : !ledgerGroups.length ? (
                    <div className="text-center text-neutral-500 py-8 border border-dashed border-[#c9a227]/40 rounded-lg text-sm">
                      No ledger groups found
                    </div>
                  ) : (
                    <>
                      <div className="overflow-auto border border-[#c9a227]/35 rounded-lg max-h-[min(70vh,calc(100vh-14rem))]">
                        <table className="w-full text-sm border-collapse min-w-[720px]">
                          <thead className="sticky top-0 z-10 bg-neutral-50">
                            <tr>
                              <th className="text-left px-2.5 py-1.5 font-semibold text-neutral-700 border-b border-[#c9a227]/35">
                                Name
                              </th>
                              <th className="text-left px-2.5 py-1.5 font-semibold text-neutral-700 border-b border-[#c9a227]/35">
                                Parent
                              </th>
                              <th className="text-right px-2.5 py-1.5 font-semibold text-neutral-700 border-b border-[#c9a227]/35">
                                Ledgers
                              </th>
                              <th className="text-left px-2.5 py-1.5 font-semibold text-neutral-700 border-b border-[#c9a227]/35">
                                Status
                              </th>
                              <th className="text-left px-2.5 py-1.5 font-semibold text-neutral-700 border-b border-[#c9a227]/35">
                                Created
                              </th>
                              <th className="text-right px-2.5 py-1.5 font-semibold text-neutral-700 border-b border-[#c9a227]/35">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerGroups.map((group) => {
                              const updating =
                                updateLedgerGroupMutation.isPending &&
                                updateLedgerGroupMutation.variables?.id === group.id;
                              return (
                                <tr key={group.id} className="hover:bg-neutral-50/80">
                                  <td className="px-2.5 py-1.5 border-b border-neutral-100 font-medium text-black">
                                    {group.name || "—"}
                                  </td>
                                  <td className="px-2.5 py-1.5 border-b border-neutral-100 text-neutral-600">
                                    {group.parent || "—"}
                                  </td>
                                  <td className="px-2.5 py-1.5 border-b border-neutral-100 text-right tabular-nums text-neutral-700">
                                    {group.ledger_count ?? 0}
                                  </td>
                                  <td className="px-2.5 py-1.5 border-b border-neutral-100">
                                    <div className="flex flex-wrap gap-1">
                                      <StatusPill active={group.is_active} label={group.is_active ? "Active" : "Inactive"} />
                                      <StatusPill active={group.is_live} label={group.is_live ? "Live" : "Not live"} />
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-1.5 border-b border-neutral-100 text-neutral-500 text-xs">
                                    {group.created_at || "—"}
                                  </td>
                                  <td className="px-2.5 py-1.5 border-b border-neutral-100">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={updating}
                                        className="h-7 text-[11px] px-2"
                                        onClick={() =>
                                          updateLedgerGroupMutation.mutate({
                                            id: group.id,
                                            is_active: !group.is_active,
                                          })
                                        }
                                      >
                                        {group.is_active ? "Deactivate" : "Activate"}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={updating}
                                        className="h-7 text-[11px] px-2"
                                        onClick={() =>
                                          updateLedgerGroupMutation.mutate({
                                            id: group.id,
                                            is_live: !group.is_live,
                                          })
                                        }
                                      >
                                        {updating ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : group.is_live ? (
                                          "Unlive"
                                        ) : (
                                          "Make Live"
                                        )}
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {totalLedgerPages > 1 ? (
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                          <span>
                            Page {ledgerGroupsPagination.current_page || ledgerGroupPage} of {totalLedgerPages}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={ledgerGroupPage <= 1}
                              onClick={() => setLedgerGroupPage((p) => Math.max(1, p - 1))}
                            >
                              Previous
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={ledgerGroupPage >= totalLedgerPages}
                              onClick={() => setLedgerGroupPage((p) => Math.min(totalLedgerPages, p + 1))}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "business_types" && (
              <Card className="border border-[#c9a227]/45 shadow-sm overflow-hidden">
                <CardHeader className="py-2 px-2.5 border-b border-[#c9a227]/45 bg-white flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold text-black flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Business Types
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingBusinessTypeId(null);
                      setBusinessTypeForm({ name: "", description: "", margin_percent: "" });
                      setIsBusinessTypeDialogOpen(true);
                    }}
                    className="h-7 text-xs bg-black text-white border border-[#c9a227]/70 hover:bg-neutral-800"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Business Type
                  </Button>
                </CardHeader>
                <CardContent className="p-2.5">
                  {isLoadingBusinessTypes ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
                    </div>
                  ) : (
                    <TypeMasterCardGrid
                      items={businessTypesData}
                      emptyMessage="No business types found"
                      onEdit={(item) => {
                        setEditingBusinessTypeId(item.id);
                        setBusinessTypeForm({
                          name: item.name || "",
                          description: item.description || "",
                          margin_percent: item.margin_percent != null ? String(item.margin_percent) : "",
                        });
                        setIsBusinessTypeDialogOpen(true);
                      }}
                      onDelete={(item) => {
                        if (!item?.id) return;
                        if (!window.confirm(`Delete business type "${item.name}"?`)) return;
                        deleteBusinessTypeMutation.mutate(item.id);
                      }}
                      deletingId={
                        deleteBusinessTypeMutation.isPending
                          ? deleteBusinessTypeMutation.variables
                          : null
                      }
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "credit_types" && (
              <Card className="border border-[#c9a227]/45 shadow-sm overflow-hidden">
                <CardHeader className="py-2 px-2.5 border-b border-[#c9a227]/45 bg-white flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold text-black flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credit Types
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCreditTypeId(null);
                      setCreditTypeForm({ name: "", description: "", margin_percent: "" });
                      setIsCreditTypeDialogOpen(true);
                    }}
                    className="h-7 text-xs bg-black text-white border border-[#c9a227]/70 hover:bg-neutral-800"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Credit Type
                  </Button>
                </CardHeader>
                <CardContent className="p-2.5">
                  {isLoadingCreditTypes ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
                    </div>
                  ) : (
                    <TypeMasterCardGrid
                      items={creditTypesData}
                      emptyMessage="No credit types found"
                      onEdit={(item) => {
                        setEditingCreditTypeId(item.id);
                        setCreditTypeForm({
                          name: item.name || "",
                          description: item.description || "",
                          margin_percent: item.margin_percent != null ? String(item.margin_percent) : "",
                        });
                        setIsCreditTypeDialogOpen(true);
                      }}
                      onDelete={(item) => {
                        if (!item?.id) return;
                        if (!window.confirm(`Delete credit type "${item.name}"?`)) return;
                        deleteCreditTypeMutation.mutate(item.id);
                      }}
                      deletingId={
                        deleteCreditTypeMutation.isPending
                          ? deleteCreditTypeMutation.variables
                          : null
                      }
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "category_types" && (
              <Card className="border border-[#c9a227]/45 shadow-sm overflow-hidden">
                <CardHeader className="py-2 px-2.5 border-b border-[#c9a227]/45 bg-white flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold text-black flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Category Types
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCategoryTypeId(null);
                      setCategoryTypeForm({ type: "", min_order_value: "", margin_percent: "0" });
                      setIsCategoryTypeDialogOpen(true);
                    }}
                    className="h-7 text-xs bg-black text-white border border-[#c9a227]/70 hover:bg-neutral-800"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Category Type
                  </Button>
                </CardHeader>
                <CardContent className="p-2.5">
                  {isLoadingCategoryTypes ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
                    </div>
                  ) : (
                    <TypeMasterCardGrid
                      items={categoryTypesData}
                      emptyMessage="No category types found"
                      valueLabel="Min order value:"
                      onEdit={(item) => {
                        setEditingCategoryTypeId(item.id);
                        setCategoryTypeForm({
                          type: item.type || item.name || "",
                          min_order_value:
                            item.min_order_value != null ? String(item.min_order_value) : "",
                          margin_percent:
                            item.margin_percent != null ? String(item.margin_percent) : "0",
                        });
                        setIsCategoryTypeDialogOpen(true);
                      }}
                      onDelete={(item) => {
                        if (!item?.id) return;
                        const label = item.type || item.name || item.id;
                        if (!window.confirm(`Delete category type "${label}"?`)) return;
                        deleteCategoryTypeMutation.mutate(item.id);
                      }}
                      deletingId={
                        deleteCategoryTypeMutation.isPending
                          ? deleteCategoryTypeMutation.variables
                          : null
                      }
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <Dialog
        open={isLedgerGroupDialogOpen}
        onOpenChange={(open) => {
          if (!open && createLedgerGroupMutation.isPending) return;
          setIsLedgerGroupDialogOpen(open);
          if (!open) {
            setLedgerGroupForm({
              name: "",
              parent: "Sundry Debtors",
              is_active: true,
              is_live: false,
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ledger Group</DialogTitle>
            <DialogDescription>Create a ledger group under a default parent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={ledgerGroupForm.name}
                placeholder="Enter ledger group name"
                onChange={(e) =>
                  setLedgerGroupForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Parent</Label>
              <select
                value={ledgerGroupForm.parent}
                onChange={(e) =>
                  setLedgerGroupForm((prev) => ({ ...prev, parent: e.target.value }))
                }
                className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
              >
                {parentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ledgerGroupForm.is_active}
                  onChange={(e) =>
                    setLedgerGroupForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                Active
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ledgerGroupForm.is_live}
                  onChange={(e) =>
                    setLedgerGroupForm((prev) => ({ ...prev, is_live: e.target.checked }))
                  }
                />
                Live
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsLedgerGroupDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveLedgerGroup}
                disabled={createLedgerGroupMutation.isPending}
                className="bg-black text-white hover:bg-neutral-800"
              >
                {createLedgerGroupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBusinessTypeDialogOpen}
        onOpenChange={(open) => {
          if (!open && saveBusinessTypeMutation.isPending) return;
          setIsBusinessTypeDialogOpen(open);
          if (!open) {
            setEditingBusinessTypeId(null);
            setBusinessTypeForm({ name: "", description: "", margin_percent: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBusinessTypeId ? "Edit Business Type" : "Add Business Type"}
            </DialogTitle>
            <DialogDescription>Manage business types used in ledger classification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={businessTypeForm.name}
                placeholder="Enter business type name"
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setBusinessTypeForm((prev) => ({ ...prev, name: value }));
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={businessTypeForm.description}
                onChange={(e) =>
                  setBusinessTypeForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Margin %</Label>
              <Input
                type="number"
                step="0.01"
                value={businessTypeForm.margin_percent}
                onChange={(e) =>
                  setBusinessTypeForm((prev) => ({ ...prev, margin_percent: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsBusinessTypeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveBusinessType}
                disabled={saveBusinessTypeMutation.isPending}
                className="bg-black text-white hover:bg-neutral-800"
              >
                {saveBusinessTypeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingBusinessTypeId ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreditTypeDialogOpen}
        onOpenChange={(open) => {
          if (!open && saveCreditTypeMutation.isPending) return;
          setIsCreditTypeDialogOpen(open);
          if (!open) {
            setEditingCreditTypeId(null);
            setCreditTypeForm({ name: "", description: "", margin_percent: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCreditTypeId ? "Edit Credit Type" : "Add Credit Type"}
            </DialogTitle>
            <DialogDescription>Manage credit types used in ledger classification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={creditTypeForm.name}
                placeholder="Enter credit type name"
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setCreditTypeForm((prev) => ({ ...prev, name: value }));
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={creditTypeForm.description}
                onChange={(e) =>
                  setCreditTypeForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Margin %</Label>
              <Input
                type="number"
                step="0.01"
                value={creditTypeForm.margin_percent}
                onChange={(e) =>
                  setCreditTypeForm((prev) => ({ ...prev, margin_percent: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsCreditTypeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCreditType}
                disabled={saveCreditTypeMutation.isPending}
                className="bg-black text-white hover:bg-neutral-800"
              >
                {saveCreditTypeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingCreditTypeId ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCategoryTypeDialogOpen}
        onOpenChange={(open) => {
          if (!open && saveCategoryTypeMutation.isPending) return;
          setIsCategoryTypeDialogOpen(open);
          if (!open) {
            setEditingCategoryTypeId(null);
            setCategoryTypeForm({ type: "", min_order_value: "", margin_percent: "0" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategoryTypeId ? "Edit Category Type" : "Add Category Type"}
            </DialogTitle>
            <DialogDescription>Manage category types used in ledger classification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Input
                value={categoryTypeForm.type}
                placeholder="e.g. A - >50K"
                onChange={(e) =>
                  setCategoryTypeForm((prev) => ({ ...prev, type: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Min order value</Label>
              <Input
                value={categoryTypeForm.min_order_value}
                placeholder="e.g. 50000"
                onChange={(e) =>
                  setCategoryTypeForm((prev) => ({ ...prev, min_order_value: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Margin %</Label>
              <Input
                type="number"
                step="0.01"
                value={categoryTypeForm.margin_percent}
                onChange={(e) =>
                  setCategoryTypeForm((prev) => ({ ...prev, margin_percent: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsCategoryTypeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCategoryType}
                disabled={saveCategoryTypeMutation.isPending}
                className="bg-black text-white hover:bg-neutral-800"
              >
                {saveCategoryTypeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingCategoryTypeId ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
