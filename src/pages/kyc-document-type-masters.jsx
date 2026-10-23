import { useState, useMemo } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  Search,
  FileText,
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

const DOCUMENT_TYPE_OPTIONS = [
  { value: "registration", label: "Registration Document" },
  { value: "address_proof", label: "Address Proof" },
  { value: "identity_proof", label: "Identity Proof" },
  { value: "income_proof", label: "Income Proof" },
];

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  ...DOCUMENT_TYPE_OPTIONS,
];

const emptyForm = () => ({
  document_type: "",
  document_name: "",
  length: 20,
  is_required: false,
});

export default function KycDocumentTypeMasters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [typeFilterSearch, setTypeFilterSearch] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(emptyForm());

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

  const fetchKycDocumentTypes = async () => {
    const params = new URLSearchParams();
    if (typeFilter && typeFilter !== "all") params.set("document_type", typeFilter);

    const response = await fetch(
      `${getBackendUrl()}/api/user/kyc-document-types/?${params.toString()}`,
      { method: "GET", headers: authHeaders() }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  const saveDocumentType = async (payload) => {
    const response = await fetch(`${getBackendUrl()}/api/user/kyc-document-types/create/`, {
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

  const deleteDocumentType = async (id) => {
    const response = await fetch(
      `${getBackendUrl()}/api/user/kyc-document-types/delete/${id}/`,
      { method: "POST", headers: authHeaders() }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    return result;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["kyc-document-types", typeFilter],
    queryFn: fetchKycDocumentTypes,
    retry: 1,
    enabled: hasReadPermission("customer_management"),
    placeholderData: (previousData) => previousData,
  });

  const saveMutation = useMutation({
    mutationFn: saveDocumentType,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["kyc-document-types"] });
      toast({ title: "Success", description: result.message || "Saved successfully" });
      setIsDialogOpen(false);
      setFormData(emptyForm());
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocumentType,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["kyc-document-types"] });
      toast({ title: "Success", description: result.message || "Deleted successfully" });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const documentTypes = data?.data || [];

  const filteredDocumentTypes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return documentTypes;

    return documentTypes.filter((item) => {
      const nameMatch = (item.document_name || "").toLowerCase().includes(term);
      const typeMatch = (item.document_type_display || item.document_type || "")
        .toLowerCase()
        .includes(term);
      return nameMatch || typeMatch;
    });
  }, [documentTypes, searchTerm]);

  const filteredTypeOptions = useMemo(() => {
    const term = typeFilterSearch.trim().toLowerCase();
    if (!term) return TYPE_FILTER_OPTIONS;

    return TYPE_FILTER_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(term)
    );
  }, [typeFilterSearch]);

  const selectedTypeFilterLabel =
    TYPE_FILTER_OPTIONS.find((option) => option.value === typeFilter)?.label ||
    "Filter by type";

  const handleCreate = () => {
    setFormData(emptyForm());
    setIsDialogOpen(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      document_type: item.document_type || "",
      document_name: item.document_name || "",
      length: item.length ?? 20,
      is_required: Boolean(item.is_required),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.document_type) {
      toast({
        title: "Validation Error",
        description: "Document type is required",
        variant: "destructive",
      });
      return;
    }
    if (!formData.document_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Document name is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.is_required) {
      const lengthValue = parseInt(String(formData.length), 10);
      if (!Number.isFinite(lengthValue) || lengthValue < 1) {
        toast({
          title: "Validation Error",
          description: "Length must be a positive number",
          variant: "destructive",
        });
        return;
      }
    }

    const lengthValue = formData.is_required
      ? parseInt(String(formData.length), 10)
      : 20;

    saveMutation.mutate({
      ...(formData.id ? { id: formData.id } : {}),
      document_type: formData.document_type,
      document_name: formData.document_name.trim(),
      length: lengthValue,
      is_required: formData.is_required,
    });
  };

  const renderDocumentNumberRequired = (isRequired) => (
    <Badge variant={isRequired ? "default" : "secondary"}>
      {isRequired ? "Required" : "Not required"}
    </Badge>
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
            <FileText className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">
              You do not have permission to manage KYC document types.
            </p>
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
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="outline" size="sm" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">KYC Document Types</h1>
              <p className="text-sm text-gray-500">Manage customer KYC document master data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasCreatePermission("customer_management") && (
              <Button size="sm" onClick={handleCreate} className="bg-black hover:bg-gray-800">
                <Plus className="h-4 w-4 mr-1" />
                Add Document Type
              </Button>
            )}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Document Types ({filteredDocumentTypes.length}
                {searchTerm.trim() && filteredDocumentTypes.length !== documentTypes.length
                  ? ` of ${documentTypes.length}`
                  : ""}
                )
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search document name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {isFetching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
                <Popover
                  open={typeFilterOpen}
                  onOpenChange={(open) => {
                    setTypeFilterOpen(open);
                    if (!open) setTypeFilterSearch("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={typeFilterOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">{selectedTypeFilterLabel}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <Command shouldFilter={false} className="w-full">
                      <CommandInput
                        placeholder="Search document type..."
                        value={typeFilterSearch}
                        onValueChange={setTypeFilterSearch}
                      />
                      <CommandList className="!max-h-[none] overflow-visible p-0">
                        <CommandEmpty>No document type found.</CommandEmpty>
                        <CommandGroup className="overflow-visible p-0">
                          <div
                            className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                            style={{ minHeight: 0 }}
                            onWheel={(e) => e.stopPropagation()}
                          >
                            {filteredTypeOptions.map((option) => (
                              <CommandItem
                                key={option.value}
                                value={`${option.label}-${option.value}`}
                                onSelect={() => {
                                  setTypeFilter(option.value);
                                  setTypeFilterOpen(false);
                                  setTypeFilterSearch("");
                                }}
                                className="cursor-pointer"
                              >
                                <span className="font-medium">{option.label}</span>
                              </CommandItem>
                            ))}
                          </div>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {error.message}
                </div>
              )}

              {filteredDocumentTypes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>
                    {searchTerm.trim()
                      ? "No KYC document types match your search"
                      : "No KYC document types found"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="p-3 font-medium">#</th>
                        <th className="p-3 font-medium">Document Name</th>
                        <th className="p-3 font-medium">Type</th>
                        <th className="p-3 font-medium">Length</th>
                        <th className="p-3 font-medium">Document Number</th>
                        <th className="p-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocumentTypes.map((item, index) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">{index + 1}</td>
                          <td className="p-3 font-medium">{item.document_name}</td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {item.document_type_display || item.document_type}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {item.is_required ? (item.length ?? 20) : "—"}
                          </td>
                          <td className="p-3">{renderDocumentNumberRequired(item.is_required)}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              {hasUpdatePermission("customer_management") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {hasDeletePermission("customer_management") && item.is_active && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="h-4 w-4" />
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Edit KYC Document Type" : "Add KYC Document Type"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Document Type *</Label>
              <Select
                value={formData.document_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, document_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="document_name">Document Name *</Label>
              <Input
                id="document_name"
                value={formData.document_name}                
                placeholder="e.g. Aadhaar Card"
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setFormData((prev) => ({ ...prev, document_name: value }));
                  }
                }}
              />
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_required"
                  checked={formData.is_required}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_required: checked }))
                  }
                />
                <Label htmlFor="is_required">Document number required</Label>
              </div>
              <p className="text-xs text-gray-500">
                When enabled, ledger KYC requires a document number for this type. When disabled,
                only the image upload is required.
              </p>
            </div>
            {formData.is_required && (
              <div>
                <Label htmlFor="length">Length *</Label>
                <Input
                  id="length"
                  type="number"
                  min="1"
                  max="500"
                  value={formData.length}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, length: e.target.value }))
                  }
                  placeholder="e.g. 20"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum characters allowed for the document number.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-black hover:bg-gray-800">
                {saveMutation.isPending ? "Saving..." : formData.id ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.document_name}&quot; from active KYC document types.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
