import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  Search,
  Percent,
  Menu,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronsUpDown,
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

const GST_RATE_OPTIONS = [0, 5, 9, 12, 18, 28];
const LEDGER_TYPE_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
];

const emptyForm = () => ({
  id: null,
  ledger_type: "sales",
  ledger_account_id: "",
  ledger_account_name: "",
  applied_gst_rate: 0,
  is_active: true,
});

export default function GstMasters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [ledgerPopoverOpen, setLedgerPopoverOpen] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = useState("");

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLedgerSearch(ledgerSearch.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [ledgerSearch]);

  const fetchGstMappings = async () => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("ledger_type", typeFilter);

    const response = await fetch(
      `${getBackendUrl()}/api/gst-ledgers-mapping/?${params.toString()}`,
      { method: "GET", headers: authHeaders() }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  /**
   * get-ledgers — search is sent only after debounce when the user has typed.
   * No parent / is_active filters from this screen.
   */
  const fetchLedgers = async ({ search }) => {
    const params = new URLSearchParams({
      page: "1",
      per_page: "50",
    });

    if (search) {
      params.set("search", search);
    }

    const response = await fetch(
      `${getBackendUrl()}/api/report/get-ledgers/?${params.toString()}`,
      { method: "GET", headers: authHeaders() }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || `HTTP error! status: ${response.status}`);
    }
    return result.data || [];
  };

  const saveMapping = async (payload) => {
    const isEdit = Boolean(payload.id);
    const url = isEdit
      ? `${getBackendUrl()}/api/update-gst-ledgers-mapping/${payload.id}/`
      : `${getBackendUrl()}/api/create-gst-ledgers-mapping/`;

    const body = {
      ledger_type: payload.ledger_type,
      ledger_account_id: payload.ledger_account_id,
      applied_gst_rate: payload.applied_gst_rate,
      is_active: payload.is_active,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  const deleteMapping = async (id) => {
    const response = await fetch(
      `${getBackendUrl()}/api/delete-gst-ledgers-mapping/${id}/`,
      { method: "POST", headers: authHeaders() }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["gst-ledgers-mapping", typeFilter],
    queryFn: fetchGstMappings,
    retry: 1,
    enabled: hasReadPermission("customer_management"),
    placeholderData: (previousData) => previousData,
  });

  const { data: ledgers = [], isFetching: ledgersLoading } = useQuery({
    queryKey: ["gst-config-ledgers", debouncedLedgerSearch],
    queryFn: () =>
      fetchLedgers({
        search: debouncedLedgerSearch,
      }),
    enabled:
      isDialogOpen &&
      ledgerPopoverOpen &&
      hasReadPermission("customer_management"),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const saveMutation = useMutation({
    mutationFn: saveMapping,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["gst-ledgers-mapping"] });
      toast({
        title: "Success",
        description: result.message || "GST config saved successfully",
      });
      setIsDialogOpen(false);
      setFormData(emptyForm());
      setLedgerSearch("");
      setDebouncedLedgerSearch("");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMapping,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["gst-ledgers-mapping"] });
      toast({
        title: "Success",
        description: result.message || "GST config deleted successfully",
      });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const mappings = data?.data || [];

  const filteredMappings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return mappings;
    return mappings.filter((item) => {
      const haystack = [
        item.ledger_account_name,
        item.ledger_account_tally_name,
        item.ledger_type,
        String(item.applied_gst_rate),
        item.branch_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [mappings, searchTerm]);

  const handleCreate = () => {
    setFormData(emptyForm());
    setLedgerSearch("");
    setDebouncedLedgerSearch("");
    setIsDialogOpen(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      ledger_type: item.ledger_type || "sales",
      ledger_account_id: item.ledger_account_id || "",
      ledger_account_name: item.ledger_account_name || item.ledger_account_tally_name || "",
      applied_gst_rate:
        item.applied_gst_rate === 0 || item.applied_gst_rate
          ? Number(item.applied_gst_rate)
          : 0,
      is_active: item.is_active !== false,
    });
    setLedgerSearch("");
    setDebouncedLedgerSearch("");
    setIsDialogOpen(true);
  };

  const handleTypeChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      ledger_type: value,
      ledger_account_id: "",
      ledger_account_name: "",
    }));
    setLedgerSearch("");
    setDebouncedLedgerSearch("");
  };

  const handleSubmit = () => {
    if (!formData.ledger_type) {
      toast({
        title: "Validation Error",
        description: "Please select a type",
        variant: "destructive",
      });
      return;
    }
    if (!formData.ledger_account_id) {
      toast({
        title: "Validation Error",
        description: "Please select a ledger",
        variant: "destructive",
      });
      return;
    }
    if (!GST_RATE_OPTIONS.includes(Number(formData.applied_gst_rate))) {
      toast({
        title: "Validation Error",
        description: "Please select a valid GST rate",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      id: formData.id,
      ledger_type: formData.ledger_type,
      ledger_account_id: Number(formData.ledger_account_id),
      applied_gst_rate: Number(formData.applied_gst_rate),
      is_active: formData.is_active,
    });
  };

  const selectedLedgerLabel =
    formData.ledger_account_name ||
    (formData.ledger_account_id ? `Ledger #${formData.ledger_account_id}` : "Select ledger");

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

  if (!hasReadPermission("customer_management")) {
    return (
      <div className="flex h-screen bg-gray-50">
        {isMobile ? (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        ) : (
          <Sidebar />
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
            <Percent className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">You do not have permission to manage GST configs.</p>
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

  return (
    <div className="flex h-screen bg-gray-50">
      {isMobile ? (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      ) : (
        <Sidebar />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b px-3 py-2 flex items-center justify-between md:px-4">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="outline" size="sm" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">GST Masters</h1>
              <p className="text-xs text-gray-500">Map GST rates to sales and purchase ledgers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasCreatePermission("customer_management") && (
              <Button size="sm" onClick={handleCreate} className="bg-black hover:bg-gray-800">
                <Plus className="h-4 w-4 mr-1" />
                Add GST Config
              </Button>
            )}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-2.5 sm:p-3">
          <Card>
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Percent className="h-4 w-4" />
                GST Configs ({filteredMappings.length}
                {searchTerm.trim() && filteredMappings.length !== mappings.length
                  ? ` of ${mappings.length}`
                  : ""}
                )
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-3 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search ledger, type, GST rate..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-9 h-9"
                  />
                  {isFetching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {LEDGER_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {error.message}
                </div>
              )}

              {filteredMappings.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Percent className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No GST configs found</p>
                  <p className="text-sm mt-1">Click Add GST Config to create one.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-slate-300">
                        <th className="text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">Type</th>
                        <th className="text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">Ledger</th>
                        <th className="text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">GST Rate</th>
                        <th className="text-left px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                        <th className="text-right px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMappings.map((item) => (
                        <tr key={item.id} className="border-b border-slate-200 last:border-b-0 hover:bg-gray-50">
                          <td className="px-3 py-1.5 capitalize">{item.ledger_type}</td>
                          <td className="px-3 py-1.5">
                            <div className="font-medium text-gray-900">
                              {item.ledger_account_name || "-"}
                            </div>
                            {item.ledger_account_tally_name &&
                              item.ledger_account_tally_name !== item.ledger_account_name && (
                                <div className="text-[10px] text-gray-500">
                                  {item.ledger_account_tally_name}
                                </div>
                              )}
                          </td>
                          <td className="px-3 py-1.5">{item.applied_gst_rate}%</td>
                          <td className="px-3 py-1.5">
                            <Badge variant={item.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                              {item.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center justify-end gap-1">
                              {hasUpdatePermission("customer_management") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEdit(item)}
                                  title="Edit"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {hasDeletePermission("customer_management") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600 hover:text-red-700"
                                  onClick={() => setDeleteTarget(item)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
        </main>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setFormData(emptyForm());
            setLedgerPopoverOpen(false);
            setLedgerSearch("");
            setDebouncedLedgerSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{formData.id ? "Edit GST Config" : "Add GST Config"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.ledger_type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {LEDGER_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ledger</Label>
              <Popover open={ledgerPopoverOpen} onOpenChange={setLedgerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={ledgerPopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedLedgerLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      autoFocus
                      placeholder="Search ledgers..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="h-11 border-0 shadow-none focus-visible:ring-0 px-0"
                    />
                    {ledgersLoading && (
                      <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-gray-400" />
                    )}
                  </div>
                  <div
                    className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain p-1"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {ledgersLoading && ledgers.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading ledgers...
                      </div>
                    ) : ledgers.length === 0 ? (
                      <div className="py-6 text-center text-sm text-gray-500">
                        No ledger found.
                      </div>
                    ) : (
                      ledgers.map((ledger) => {
                        const label =
                          ledger.name || ledger.tally_name || `Ledger #${ledger.id}`;
                        const isSelected =
                          String(formData.ledger_account_id) === String(ledger.id);
                        return (
                          <button
                            type="button"
                            key={ledger.id}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                ledger_account_id: ledger.id,
                                ledger_account_name: label,
                              }));
                              setLedgerPopoverOpen(false);
                            }}
                            className={`w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                              isSelected ? "bg-accent" : ""
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{label}</span>
                              {ledger.parent && (
                                <span className="text-xs text-gray-500">{ledger.parent}</span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Applied GST Rate</Label>
              <Select
                value={String(formData.applied_gst_rate)}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    applied_gst_rate: Number(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GST rate" />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATE_OPTIONS.map((rate) => (
                    <SelectItem key={rate} value={String(rate)}>
                      {rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label htmlFor="gst-active">Active</Label>
              <Switch
                id="gst-active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {formData.id ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GST Config</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the{" "}
              <strong>{deleteTarget?.ledger_type}</strong> mapping for{" "}
              <strong>{deleteTarget?.ledger_account_name || "this ledger"}</strong> at{" "}
              <strong>{deleteTarget?.applied_gst_rate}%</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget?.id) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
