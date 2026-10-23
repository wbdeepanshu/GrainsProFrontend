import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Bell, Edit, Menu, Plus } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import CommonLoader from "@/components/common/loader";
import { AuthService } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const emptyForm = {
  rule_id: null,
  module_id: "",
  event_key: "",
  title: "",
  stock_group_id: "",
  branch_id: "",
  recipient_user_ids: [],
};

export default function NotificationSettings() {
  const user = AuthService.getUserData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const authHeaders = {
    "Content-Type": "application/json",
    ...AuthService.getAuthHeaders(),
  };

  const fetchModules = async () => {
    const res = await fetch(`${API_BASE_URL}/api/get-access-modules/`, { headers: authHeaders });
    const data = await res.json();
    return data?.data || [];
  };

  const fetchBranches = async () => {
    const res = await fetch(`${API_BASE_URL}/api/get-branches/`, { headers: authHeaders });
    const data = await res.json();
    return data?.data || [];
  };

  const fetchUsers = async () => {
    const res = await fetch(`${API_BASE_URL}/api/get-users/`, { headers: authHeaders });
    const data = await res.json();
    return data?.data || [];
  };

  const fetchStockGroups = async () => {
    const res = await fetch(`${API_BASE_URL}/api/get-stock-groups/`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        search: "",
      }),
    });
    const data = await res.json();
    return data?.data || [];
  };

  const fetchRules = async () => {
    const res = await fetch(`${API_BASE_URL}/api/notification-rule-settings/`, { headers: authHeaders });
    const data = await res.json();
    return data?.data || [];
  };

  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["notification-modules"],
    queryFn: fetchModules,
    enabled: !!user?.user_id,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["notification-branches"],
    queryFn: fetchBranches,
    enabled: !!user?.user_id,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["notification-users"],
    queryFn: fetchUsers,
    enabled: !!user?.user_id,
  });

  const { data: stockGroups = [], isLoading: stockGroupsLoading } = useQuery({
    queryKey: ["notification-stock-groups"],
    queryFn: fetchStockGroups,
    enabled: !!user?.user_id,
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["notification-rules"],
    queryFn: fetchRules,
    enabled: !!user?.user_id,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch(`${API_BASE_URL}/api/notification-rule-settings/upsert/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to save notification rule");
      }
      return data;
    },
    onSuccess: (resp) => {
      toast({ title: "Success", description: resp?.message || "Saved successfully" });
      setIsDialogOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredRules = useMemo(() => {
    if (!search.trim()) return rules;
    const q = search.toLowerCase();
    return rules.filter((r) =>
      `${r.event_key || ""} ${r.title || ""} ${r.module_name || ""} ${r.branch_name || ""} ${r.stock_group_name || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [rules, search]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule) => {
    setForm({
      rule_id: rule.id,
      module_id: rule.module ? String(rule.module) : "",
      event_key: rule.event_key || "",
      title: rule.title || "",
      description: rule.description || "",
      stock_group_id: rule.stock_group ? String(rule.stock_group) : "",
      branch_id: rule.branch || "",
      recipient_user_ids: (rule.recipients || []).map((u) => u.user_id),
    });
    setIsDialogOpen(true);
  };

  const toggleRecipient = (userId, checked) => {
    setForm((prev) => ({
      ...prev,
      recipient_user_ids: checked
        ? [...prev.recipient_user_ids, userId]
        : prev.recipient_user_ids.filter((id) => id !== userId),
    }));
  };

  const handleSubmit = () => {
    if (!form.event_key.trim() || form.recipient_user_ids.length === 0) {
      toast({
        title: "Validation Error",
        description: "Event Key and at least one recipient user are required.",
        variant: "destructive",
      });
      return;
    }

    if (!form.module_id && !form.branch_id && !form.stock_group_id) {
      toast({
        title: "Validation Error",
        description: "Select at least one scope: Module or Branch or Stock Group.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      ...(form.rule_id ? { rule_id: form.rule_id } : {}),
      module_id: form.module_id ? Number(form.module_id) : null,
      event_key: form.event_key.trim(),
      title: form.title || null,
      stock_group_id: form.stock_group_id ? Number(form.stock_group_id) : null,
      branch_id: form.branch_id || null,
      recipient_user_ids: form.recipient_user_ids,
    };
    upsertMutation.mutate(payload);
  };

  if (user?.role_id !== 1) {
    return (
      <div className="p-8 text-center text-gray-600">
        This page is available only for role 1 users.
      </div>
    );
  }

  const loading = modulesLoading || branchesLoading || usersLoading || stockGroupsLoading || rulesLoading;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <Bell className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{form.rule_id ? "Edit Notification Rule" : "Add Notification Rule"}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label>Module</Label>
                    <Select value={form.module_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, module_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="All modules" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All modules</SelectItem>
                        {modules.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Event Key *</Label>
                    <Input value={form.event_key} onChange={(e) => setForm((p) => ({ ...p, event_key: e.target.value }))} placeholder="e.g. STOCK_AUDIT_STARTED" />
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <Select value={form.branch_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, branch_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All branches</SelectItem>
                        {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Stock Group</Label>
                    <Select value={form.stock_group_id || "none"} onValueChange={(v) => setForm((p) => ({ ...p, stock_group_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="All stock groups" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All stock groups</SelectItem>
                        {stockGroups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Recipient Users *</Label>
                    <div className="border rounded-md p-3 max-h-52 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
                      {users.map((u) => (
                        <div key={u.user_id} className="flex items-center gap-2">
                          <Checkbox
                            id={`recipient_${u.user_id}`}
                            checked={form.recipient_user_ids.includes(u.user_id)}
                            onCheckedChange={(checked) => toggleRecipient(u.user_id, Boolean(checked))}
                          />
                          <Label htmlFor={`recipient_${u.user_id}`}>
                            {u.name} ({u.role_name || "No Role"})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? "Saving..." : (form.rule_id ? "Update" : "Create")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Configured Rules</CardTitle>
              <Input
                placeholder="Search by event, module, branch, stock group"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </CardHeader>
            <CardContent>
              {loading ? (
                <CommonLoader />
              ) : filteredRules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No notification rules found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Stock Group</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="font-medium">{rule.event_key}</div>
                          <div className="text-xs text-gray-500">{rule.title || "-"}</div>
                        </TableCell>
                        <TableCell>{rule.module_name || "All"}</TableCell>
                        <TableCell>{rule.branch_name || "All"}</TableCell>
                        <TableCell>{rule.stock_group_name || "All"}</TableCell>
                        <TableCell>{(rule.recipients || []).length}</TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? "default" : "secondary"}>
                            {rule.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
