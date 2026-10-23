import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HardHat,
  Menu,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Eye,
  Loader2,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import CommonLoader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

async function apiFetch(path, options = {}) {
  const token = AuthService.getAccessToken();
  if (!token) throw new Error("No authentication token found");
  const response = await fetch(`${BACKEND_URL}/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

const emptyGroupForm = () => ({
  id: null,
  branch_id: "",
  name: "",
  contact_person: "",
  contact_number: "",
  margin_percent: "0",
  remarks: "",
  is_active: true,
});

const emptyLabourForm = () => ({
  id: null,
  group_id: "",
  name: "",
  contact_number: "",
  remarks: "",
  is_active: true,
});

export default function LabourManagement() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("groups");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [labourGroupFilter, setLabourGroupFilter] = useState("all");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [labourDialogOpen, setLabourDialogOpen] = useState(false);
  const [groupLaboursModal, setGroupLaboursModal] = useState({ open: false, group: null });
  const [groupForm, setGroupForm] = useState(emptyGroupForm());
  const [labourForm, setLabourForm] = useState(emptyLabourForm());

  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    isLoading: permissionsLoading,
  } = useUserPermissions();

  const canRead = hasReadPermission("hamali");
  const canCreate = hasCreatePermission("hamali");
  const canUpdate = hasUpdatePermission("hamali");

  const statusQuery =
    statusFilter === "active" ? "true" : statusFilter === "inactive" ? "false" : "";

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/get-branches"],
    queryFn: async () => {
      const res = await apiFetch("/get-branches/");
      return res.data || [];
    },
    enabled: canRead,
    staleTime: 10 * 60 * 1000,
  });

  const groupsQuery = useQuery({
    queryKey: ["/api/hamali-groups", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusQuery) params.set("is_active", statusQuery);
      const qs = params.toString();
      const res = await apiFetch(`/hamali-groups/${qs ? `?${qs}` : ""}`);
      return res.data || [];
    },
    enabled: canRead,
    placeholderData: (previousData) => previousData,
  });

  const laboursQuery = useQuery({
    queryKey: ["/api/hamali-labours", statusFilter, labourGroupFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusQuery) params.set("is_active", statusQuery);
      if (labourGroupFilter !== "all") params.set("group_id", labourGroupFilter);
      const qs = params.toString();
      const res = await apiFetch(`/hamali-labours/${qs ? `?${qs}` : ""}`);
      return res.data || [];
    },
    enabled: canRead && activeTab === "labours",
    placeholderData: (previousData) => previousData,
  });

  const groupLaboursQuery = useQuery({
    queryKey: ["/api/hamali-labours", "group-modal", groupLaboursModal.group?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("group_id", String(groupLaboursModal.group.id));
      const res = await apiFetch(`/hamali-labours/?${params.toString()}`);
      return res.data || [];
    },
    enabled: canRead && groupLaboursModal.open && !!groupLaboursModal.group?.id,
  });

  const groups = groupsQuery.data || [];
  const labours = laboursQuery.data || [];
  const groupModalLabours = groupLaboursQuery.data || [];

  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return groups;

    return groups.filter((row) => {
      const fields = [
        row.name,
        row.contact_person,
        row.contact_number,
        row.branch_name,
      ];
      return fields.some((field) => (field || "").toLowerCase().includes(term));
    });
  }, [groups, searchTerm]);

  const filteredLabours = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return labours;

    return labours.filter((row) => {
      const fields = [row.name, row.contact_number, row.group_name, row.branch_name];
      return fields.some((field) => (field || "").toLowerCase().includes(term));
    });
  }, [labours, searchTerm]);

  const groupOptions = useMemo(
    () => [{ id: "all", name: "All groups" }, ...groups.map((g) => ({ id: String(g.id), name: g.name }))],
    [groups]
  );

  const groupById = useMemo(() => {
    const map = {};
    groups.forEach((g) => {
      map[String(g.id)] = g;
    });
    return map;
  }, [groups]);

  const selectedLabourGroup = labourForm.group_id ? groupById[labourForm.group_id] : null;

  const saveGroupMutation = useMutation({
    mutationFn: (payload) =>
      apiFetch("/hamali-group/", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (res) => {
      toast({ title: "Success", description: res.message || "Group saved" });
      setGroupDialogOpen(false);
      setGroupForm(emptyGroupForm());
      queryClient.invalidateQueries({ queryKey: ["/api/hamali-groups"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveLabourMutation = useMutation({
    mutationFn: (payload) =>
      apiFetch("/hamali-labour/", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (res) => {
      toast({ title: "Success", description: res.message || "Labour saved" });
      setLabourDialogOpen(false);
      setLabourForm(emptyLabourForm());
      queryClient.invalidateQueries({ queryKey: ["/api/hamali-labours"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hamali-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hamali-labours", "group-modal"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openCreateGroup = () => {
    setGroupForm(emptyGroupForm());
    setGroupDialogOpen(true);
  };

  const openEditGroup = (row) => {
    setGroupForm({
      id: row.id,
      branch_id: row.branch_id ? String(row.branch_id) : "",
      name: row.name || "",
      contact_person: row.contact_person || "",
      contact_number: row.contact_number || "",
      margin_percent: String(row.margin_percent ?? "0"),
      remarks: row.remarks || "",
      is_active: row.is_active !== false,
    });
    setGroupDialogOpen(true);
  };

  const openCreateLabour = (groupId = "") => {
    const resolvedGroupId =
      groupId ||
      (labourGroupFilter !== "all" ? labourGroupFilter : "") ||
      (groupLaboursModal.group?.id ? String(groupLaboursModal.group.id) : "");
    setLabourForm({
      ...emptyLabourForm(),
      group_id: resolvedGroupId,
    });
    setLabourDialogOpen(true);
  };

  const openGroupLabours = (group) => {
    setGroupLaboursModal({ open: true, group });
  };

  const closeGroupLabours = () => {
    setGroupLaboursModal({ open: false, group: null });
  };

  const openEditLabour = (row) => {
    setLabourForm({
      id: row.id,
      group_id: row.group_id ? String(row.group_id) : "",
      name: row.name || "",
      contact_number: row.contact_number || "",
      remarks: row.remarks || "",
      is_active: row.is_active !== false,
    });
    setLabourDialogOpen(true);
  };

  const handleSaveGroup = () => {
    if (!groupForm.name.trim()) {
      toast({ title: "Validation", description: "Group name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: groupForm.name.trim(),
      contact_person: groupForm.contact_person || null,
      contact_number: groupForm.contact_number || null,
      // margin_percent: hidden in UI for now; backend keeps existing / defaults to 0 on create
      remarks: groupForm.remarks || null,
      is_active: groupForm.is_active,
    };
    if (groupForm.branch_id) payload.branch_id = groupForm.branch_id;
    if (groupForm.id) payload.id = groupForm.id;
    saveGroupMutation.mutate(payload);
  };

  const handleSaveLabour = () => {
    if (!labourForm.name.trim()) {
      toast({ title: "Validation", description: "Labour name is required", variant: "destructive" });
      return;
    }
    if (!labourForm.group_id) {
      toast({
        title: "Validation",
        description: "Hamali group is required (branch is taken from the group)",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      name: labourForm.name.trim(),
      contact_number: labourForm.contact_number || null,
      remarks: labourForm.remarks || null,
      is_active: labourForm.is_active,
      group_id: parseInt(labourForm.group_id, 10),
    };
    if (labourForm.id) payload.id = labourForm.id;
    saveLabourMutation.mutate(payload);
  };

  const isInitialLoading =
    permissionsLoading ||
    (activeTab === "groups" && groupsQuery.isLoading && !groupsQuery.data) ||
    (activeTab === "labours" && laboursQuery.isLoading && !laboursQuery.data);

  const isFetching =
    activeTab === "groups" ? groupsQuery.isFetching : laboursQuery.isFetching;

  if (!permissionsLoading && !canRead) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-6">
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              You do not have permission to access Labour Management (Hamali read required).
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <HardHat className="h-6 w-6 text-indigo-600" />
              <h1 className="text-xl font-semibold text-gray-900">Labour Management</h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "groups") groupsQuery.refetch();
              else laboursQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          {isInitialLoading ? (
            <CommonLoader />
          ) : (
            <Card className="shadow-sm border border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Hamali groups & labours</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="groups">Groups</TabsTrigger>
                    <TabsTrigger value="labours">Labours</TabsTrigger>
                  </TabsList>

                  <div className="flex flex-col md:flex-row gap-3 mb-4">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        className="pl-9 pr-9"
                        placeholder="Search by name or contact..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {isFetching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-40">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    {activeTab === "labours" && (
                      <Select value={labourGroupFilter} onValueChange={setLabourGroupFilter}>
                        <SelectTrigger className="w-full md:w-48">
                          <SelectValue placeholder="Group" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupOptions.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {activeTab === "groups" && canCreate && (
                      <Button onClick={openCreateGroup}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add group
                      </Button>
                    )}
                    {activeTab === "labours" && canCreate && (
                      <Button onClick={openCreateLabour}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add labour
                      </Button>
                    )}
                  </div>

                  <TabsContent value="groups">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Contact</TableHead>
                            {/* <TableHead>Margin %</TableHead> */}
                            <TableHead>Labours</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredGroups.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                {searchTerm.trim()
                                  ? "No hamali groups match your search"
                                  : "No hamali groups found"}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredGroups.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">{row.name}</TableCell>
                                <TableCell>{row.branch_name || "—"}</TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {row.contact_person && <div>{row.contact_person}</div>}
                                    {row.contact_number && (
                                      <div className="text-gray-500">{row.contact_number}</div>
                                    )}
                                  </div>
                                </TableCell>
                                {/* <TableCell>{row.margin_percent}</TableCell> */}
                                <TableCell>{row.labour_count ?? 0}</TableCell>
                                <TableCell>
                                  <Badge variant={row.is_active ? "default" : "secondary"}>
                                    {row.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => openGroupLabours(row)}
                                      title="View labours"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {canUpdate && (
                                      <Button variant="ghost" size="sm" onClick={() => openEditGroup(row)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="labours">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLabours.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                {searchTerm.trim()
                                  ? "No labours match your search"
                                  : "No labours found"}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredLabours.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">{row.name}</TableCell>
                                <TableCell>{row.group_name || "—"}</TableCell>
                                <TableCell>{row.branch_name || "—"}</TableCell>
                                <TableCell>{row.contact_number || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={row.is_active ? "default" : "secondary"}>
                                    {row.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {canUpdate && (
                                    <Button variant="ghost" size="sm" onClick={() => openEditLabour(row)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{groupForm.id ? "Edit hamali group" : "Add hamali group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={groupForm.name}
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setGroupForm((f) => ({ ...f, name: value }));
                  }
                }}
              />
            </div>
            <div>
              <Label>Branch</Label>
              <Select
                value={groupForm.branch_id || "none"}
                onValueChange={(v) =>
                  setGroupForm((f) => ({ ...f, branch_id: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default (your branch)</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contact person</Label>
              <Input
                value={groupForm.contact_person}
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setGroupForm((f) => ({ ...f, contact_person: value }));
                  }
                }}
              />
            </div>
            <div>
              <Label>Contact number</Label>
              <Input
                value={groupForm.contact_number}
                maxLength={10}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value)) {
                    setGroupForm((f) => ({ ...f, contact_number: value }));
                  }
                }}
              />
            </div>
            {/* Margin % — hidden for now
            <div>
              <Label>Margin %</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={groupForm.margin_percent}
                onChange={(e) => setGroupForm((f) => ({ ...f, margin_percent: e.target.value }))}
              />
            </div>
            */}
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={groupForm.remarks}
                onChange={(e) => setGroupForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={groupForm.is_active}
                onCheckedChange={(v) => setGroupForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveGroup}
                disabled={
                  saveGroupMutation.isPending ||
                  (groupForm.id ? !canUpdate : !canCreate)
                }
              >
                {saveGroupMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={groupLaboursModal.open}
        onOpenChange={(open) => {
          if (!open) closeGroupLabours();
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>
              {groupLaboursModal.group?.name || "Group"} — Labours
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {groupLaboursModal.group?.branch_name && (
                <span>Branch: {groupLaboursModal.group.branch_name}</span>
              )}
              {groupLaboursModal.group?.contact_person && (
                <span className="ml-3">Contact: {groupLaboursModal.group.contact_person}</span>
              )}
              {groupLaboursModal.group?.contact_number && (
                <span className="ml-1">({groupLaboursModal.group.contact_number})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => groupLaboursQuery.refetch()}
                disabled={groupLaboursQuery.isFetching}
              >
                {groupLaboursQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Refresh
              </Button>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => openCreateLabour(String(groupLaboursModal.group?.id || ""))}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add labour
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupLaboursQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                        Loading labours...
                      </TableCell>
                    </TableRow>
                  ) : groupModalLabours.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No labours in this group
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupModalLabours.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.group_name || groupLaboursModal.group?.name || "—"}</TableCell>
                        <TableCell>{row.branch_name || groupLaboursModal.group?.branch_name || "—"}</TableCell>
                        <TableCell>{row.contact_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={row.is_active ? "default" : "secondary"}>
                            {row.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canUpdate && (
                            <Button variant="ghost" size="sm" onClick={() => openEditLabour(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={labourDialogOpen} onOpenChange={setLabourDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{labourForm.id ? "Edit labour" : "Add labour"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={labourForm.name}
                onChange={(e) => setLabourForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Hamali group *</Label>
              <Select
                value={labourForm.group_id || ""}
                onValueChange={(v) => setLabourForm((f) => ({ ...f, group_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hamali group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                      {g.branch_name ? ` (${g.branch_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLabourGroup?.branch_name && (
                <p className="text-xs text-gray-500 mt-1">
                  Branch: {selectedLabourGroup.branch_name} (from group)
                </p>
              )}
            </div>
            <div>
              <Label>Contact number</Label>
              <Input
                value={labourForm.contact_number}
                onChange={(e) => setLabourForm((f) => ({ ...f, contact_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={labourForm.remarks}
                onChange={(e) => setLabourForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={labourForm.is_active}
                onCheckedChange={(v) => setLabourForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLabourDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveLabour}
                disabled={
                  saveLabourMutation.isPending ||
                  (labourForm.id ? !canUpdate : !canCreate)
                }
              >
                {saveLabourMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
