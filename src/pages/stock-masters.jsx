import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AuthService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

async function requestJson(method, path, data) {
  const response = await apiRequest(method, `${API_BASE_URL}/api/${path}`, data);
  return response.json();
}

async function expectSuccess(response) {
  if (response?.status !== 200) {
    throw new Error(response?.message || "The stock master request failed.");
  }
  return response;
}

export default function StockMasters() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const user = AuthService.getUserData() || {};
  const isTallyEnabled = !(
    user.is_tally_enabled === false ||
    user.is_tally_enabled === 0 ||
    user.is_tally_enabled === "0" ||
    user.is_tally_enabled === "false" ||
    user.is_tally_enabled === "False"
  );
  const canManage = !isTallyEnabled;

  const [tab, setTab] = useState("groups");
  const [branchId, setBranchId] = useState("all");
  const [search, setSearch] = useState("");
  const [itemFilter, setItemFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [godownId, setGodownId] = useState("");

  const branchQuery = useQuery({
    queryKey: ["stock-masters-branches"],
    queryFn: () => requestJson("GET", "get-branches/"),
  });
  const branches = Array.isArray(branchQuery.data?.data) ? branchQuery.data.data : [];
  const branchParam = branchId === "all" ? "" : branchId;
  const params = new URLSearchParams();
  if (branchParam) params.set("branch_id", branchParam);
  const queryString = params.toString();

  const groupsQuery = useQuery({
    queryKey: ["stock-masters-groups", branchParam],
    queryFn: () => requestJson("GET", `get-stock-groups/${queryString ? `?${queryString}` : ""}`),
  });
  const categoriesQuery = useQuery({
    queryKey: ["stock-masters-categories", branchParam],
    queryFn: () => requestJson("GET", `get-stock-categories/${queryString ? `?${queryString}` : ""}`),
  });
  const subCategoriesQuery = useQuery({
    queryKey: ["stock-masters-sub-categories", branchParam],
    queryFn: () => requestJson("GET", `get-stock-sub-categories/${queryString ? `?${queryString}` : ""}`),
  });
  const godownsQuery = useQuery({
    queryKey: ["stock-masters-godowns"],
    queryFn: () => requestJson("GET", "get-godowns/"),
  });

  const groups = Array.isArray(groupsQuery.data?.data) ? groupsQuery.data.data : [];
  const categories = Array.isArray(categoriesQuery.data?.data) ? categoriesQuery.data.data : [];
  const subCategories = Array.isArray(subCategoriesQuery.data?.data) ? subCategoriesQuery.data.data : [];
  const godowns = Array.isArray(godownsQuery.data?.data) ? godownsQuery.data.data : [];
  const rootCategories = categories.filter((category) => !category.parent);

  const rows = useMemo(() => {
    let source = tab === "groups" ? groups : tab === "categories" ? rootCategories : subCategories;
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      source = source.filter((row) =>
        [row.name, row.parent_name, row.category_name, row.branch_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      );
    }
    if (statusFilter !== "all") {
      source = source.filter((row) => Boolean(row.is_active) === (statusFilter === "active"));
    }
    if (itemFilter === "with") source = source.filter((row) => Number(row.item_count) > 0);
    if (itemFilter === "without") source = source.filter((row) => Number(row.item_count) === 0);
    return source;
  }, [tab, groups, rootCategories, subCategories, search, statusFilter, itemFilter]);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [String(category.id), category.name])),
    [categories],
  );
  const groupStats = useMemo(
    () => ({
      total: groups.length,
      active: groups.filter((group) => group.is_active).length,
      linked: groups.reduce((sum, group) => sum + Number(group.item_count || 0), 0),
      withItems: groups.filter((group) => Number(group.item_count) > 0).length,
    }),
    [groups],
  );
  const categoryStats = useMemo(
    () => ({
      total: rootCategories.length,
      linked: rootCategories.reduce((sum, category) => sum + Number(category.item_count || 0), 0),
      withItems: rootCategories.filter((category) => Number(category.item_count) > 0).length,
      empty: rootCategories.filter((category) => Number(category.item_count) === 0).length,
    }),
    [rootCategories],
  );
  const subCategoryStats = useMemo(
    () => ({
      total: subCategories.length,
      linked: subCategories.reduce((sum, category) => sum + Number(category.item_count || 0), 0),
      withItems: subCategories.filter((category) => Number(category.item_count) > 0).length,
      empty: subCategories.filter((category) => Number(category.item_count) === 0).length,
    }),
    [subCategories],
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock-masters-groups"] }),
      queryClient.invalidateQueries({ queryKey: ["stock-masters-categories"] }),
      queryClient.invalidateQueries({ queryKey: ["stock-masters-sub-categories"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: formName.trim() };
      if (branchParam) payload.branch_id = branchParam;
      if (form === "group") {
        return expectSuccess(await requestJson("POST", "add-stock-group/", payload));
      }
      if (form === "subcategory") {
        return expectSuccess(await requestJson("POST", "create-stock-sub-category/", {
          ...payload,
          parent_id: formParentId,
        }));
      }
      return expectSuccess(await requestJson("POST", "add-stock-category/", payload));
    },
    onSuccess: async () => {
      toast({ title: "Created", description: `${form === "group" ? "Stock group" : form === "subcategory" ? "Sub-category" : "Category"} created successfully.` });
      setForm(null);
      setFormName("");
      setFormParentId("");
      await refresh();
    },
    onError: (error) => toast({ title: "Unable to create", description: error.message, variant: "destructive" }),
  });

  const mapGodownMutation = useMutation({
    mutationFn: async () => expectSuccess(await requestJson("POST", "update-stock-category-godown/", {
      category_id: editingCategory.id,
      godown_id: godownId || null,
    })),
    onSuccess: async () => {
      toast({ title: "Mapping saved", description: "Primary godown mapping updated." });
      setEditingCategory(null);
      setGodownId("");
      await queryClient.invalidateQueries({ queryKey: ["stock-masters-categories"] });
    },
    onError: (error) => toast({ title: "Unable to update mapping", description: error.message, variant: "destructive" }),
  });

  const groupMutation = useMutation({
    mutationFn: async ({ group, action }) => {
      if (action === "delete") {
        return expectSuccess(await requestJson("POST", "delete-stock-group/", { group_id: group.id }));
      }
      const nextName = window.prompt("Enter stock group name", group.name);
      if (nextName === null) return null;
      return expectSuccess(await requestJson("POST", "update-stock-group/", {
        group_id: group.id,
        name: nextName,
      }));
    },
    onSuccess: async (result) => {
      if (!result) return;
      toast({ title: "Updated", description: result.message });
      await queryClient.invalidateQueries({ queryKey: ["stock-masters-groups"] });
    },
    onError: (error) => toast({ title: "Unable to update group", description: error.message, variant: "destructive" }),
  });

  const isLoading = groupsQuery.isLoading || categoriesQuery.isLoading || subCategoriesQuery.isLoading;
  const error = groupsQuery.error || categoriesQuery.error || subCategoriesQuery.error;
  if (isLoading) return <CommonLoader text="Loading stock masters..." />;

  const titles = {
    groups: { label: "Stock Groups", icon: Layers, count: groupStats.total },
    categories: { label: "Stock Categories", icon: Tag, count: categoryStats.total },
    subcategories: { label: "Stock Sub Categories", icon: Warehouse, count: subCategoryStats.total },
  };
  const activeTitle = titles[tab];
  const ActiveIcon = activeTitle.icon;
  const statItems = tab === "groups"
    ? [
        { label: "Total Groups", value: groupStats.total, icon: Layers, style: "from-indigo-800 to-indigo-700" },
        { label: "Active Groups", value: groupStats.active, icon: CheckCircle, style: "from-emerald-600 to-emerald-500" },
        { label: "Linked Items", value: groupStats.linked, icon: Package, style: "from-purple-600 to-violet-500" },
        { label: "With Items", value: groupStats.withItems, icon: Package, style: "from-slate-700 to-slate-600" },
      ]
    : tab === "categories"
      ? [
          { label: "Total Categories", value: categoryStats.total, icon: Tag, style: "from-indigo-800 to-indigo-700" },
          { label: "Linked Items", value: categoryStats.linked, icon: Package, style: "from-emerald-600 to-emerald-500" },
          { label: "With Items", value: categoryStats.withItems, icon: CheckCircle, style: "from-purple-600 to-violet-500" },
          { label: "Empty Categories", value: categoryStats.empty, icon: X, style: "from-slate-700 to-slate-600" },
        ]
      : [
          { label: "Total Sub Categories", value: subCategoryStats.total, icon: Warehouse, style: "from-indigo-800 to-indigo-700" },
          { label: "Linked Items", value: subCategoryStats.linked, icon: Package, style: "from-emerald-600 to-emerald-500" },
          { label: "With Items", value: subCategoryStats.withItems, icon: CheckCircle, style: "from-purple-600 to-violet-500" },
          { label: "Empty Sub Categories", value: subCategoryStats.empty, icon: X, style: "from-slate-700 to-slate-600" },
        ];

  return (
    <div className="app-layout bg-slate-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <main className="app-main-content min-w-0">
        <div className="flex items-center justify-between border-b bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            {isMobile && <Button variant="outline" size="sm" onClick={() => setMobileSidebarOpen(true)}>Menu</Button>}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Stock Masters</h1>
          </div>
          <Button variant="default" onClick={refresh} className="bg-indigo-950 hover:bg-indigo-900">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="app-main-scrollable space-y-3 p-3 md:p-4">
          <div className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-xl border bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {Object.entries(titles).map(([key, title]) => {
              const Icon = title.icon;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${tab === key ? "bg-indigo-950 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-gray-700"}`}
                >
                  <Icon className="h-4 w-4" />
                  {title.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${tab === key ? "bg-white/15 text-white" : "bg-slate-100 dark:bg-gray-700"}`}>{title.count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statItems.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className={`border-0 bg-gradient-to-r ${stat.style} text-white shadow-sm`}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm text-white/80">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold">{Number(stat.value || 0).toLocaleString()}</p>
                    </div>
                    <span className="rounded-xl bg-white/15 p-3"><Icon className="h-6 w-6" /></span>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-slate-200 dark:border-gray-700">
            <CardContent className={`grid gap-3 p-3 lg:items-end ${tab === "categories" ? "lg:grid-cols-[minmax(220px,1fr)_150px_150px_150px_150px_auto]" : "lg:grid-cols-[minmax(220px,1fr)_170px_170px_170px_auto]"}`}>
              <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Search {activeTitle.label}</span>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search by ${tab === "groups" ? "group" : "category"} name...`} />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Branch</span>
                <Select value={branchId} onValueChange={(value) => { setBranchId(value); }}>
                  <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              {tab === "categories" && (
                <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>Stock Group</span>
                  <Select value="all" onValueChange={() => {}}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stock groups</SelectItem>
                      {groups.map((group) => <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              )}
              <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Items</span>
                <Select value={itemFilter} onValueChange={setItemFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="with">With items</SelectItem>
                    <SelectItem value="without">Without items</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Status</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <Button
                variant="outline"
                aria-label="Clear filters"
                className="h-10 w-fit gap-1.5 px-3"
                onClick={() => { setSearch(""); setItemFilter("all"); setStatusFilter("all"); setBranchId("all"); }}
              >
                <X className="h-4 w-4" /> Clear
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b px-4 py-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <ActiveIcon className="h-5 w-5 text-indigo-900 dark:text-indigo-300" />
                <h2 className="font-semibold text-slate-900 dark:text-white">{activeTitle.label}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-gray-700 dark:text-slate-200">{rows.length} shown</span>
              </div>
              {canManage && (
                <Button
                  onClick={() => { setForm(tab === "groups" ? "group" : tab === "categories" ? "category" : "subcategory"); setFormName(""); setFormParentId(""); }}
                  className="bg-indigo-950 hover:bg-indigo-900"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add {tab === "groups" ? "Group" : tab === "categories" ? "Category" : "Sub Category"}
                </Button>
              )}
            </div>

            {error ? (
              <div className="p-8 text-center text-sm text-red-600">{error.message || "Could not load stock masters."}</div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">No {activeTitle.label.toLowerCase()} match these filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-gray-800 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">{tab === "groups" ? "Group Name" : tab === "categories" ? "Category Name" : "Sub Category Name"}</th>
                      {tab !== "groups" && <th className="px-4 py-3">Parent</th>}
                      {tab === "categories" && <th className="px-4 py-3">Primary Godown</th>}
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Linked Items</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                    {rows.map((row, index) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-gray-800/60">
                        <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-3 font-semibold text-slate-900 dark:text-white">
                            <span className="rounded-lg border border-slate-200 p-2 text-blue-600 dark:border-gray-600"><ActiveIcon className="h-4 w-4" /></span>
                            {row.name}
                          </span>
                        </td>
                        {tab !== "groups" && <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{tab === "categories" ? (row.parent_name || "Primary") : (row.category_name || categoryMap.get(String(row.category_id)) || "—")}</td>}
                        {tab === "categories" && <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.primary_godown_name || "Not mapped"}</td>}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${row.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "border-slate-200 bg-slate-100 text-slate-600 dark:border-gray-600 dark:bg-gray-700 dark:text-slate-300"}`}>
                            <CheckCircle className="h-3.5 w-3.5" /> {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <Package className="h-4 w-4" /> {Number(row.item_count || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManage && tab === "categories" && (
                            <Button variant="outline" size="sm" onClick={() => { setEditingCategory(row); setGodownId(row.primary_godown_id ? String(row.primary_godown_id) : ""); }}>
                              <Warehouse className="mr-1.5 h-4 w-4" /> Edit
                            </Button>
                          )}
                          {canManage && tab === "groups" && (
                            <div className="inline-flex gap-2">
                              <Button variant="outline" size="icon" aria-label={`Rename ${row.name}`} onClick={() => groupMutation.mutate({ group: row, action: "edit" })}>
                                <Tag className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" aria-label={`Delete ${row.name}`} onClick={() => {
                                if (window.confirm(`Delete stock group "${row.name}"?`)) groupMutation.mutate({ group: row, action: "delete" });
                              }}>
                                <Trash2 className="h-4 w-4 text-rose-500" />
                              </Button>
                            </div>
                          )}
                          {canManage && tab === "subcategories" && <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Dialog open={Boolean(form)} onOpenChange={(open) => { if (!open) { setForm(null); setFormName(""); setFormParentId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form === "group" ? "Add Stock Group" : form === "subcategory" ? "Add Stock Sub Category" : "Add Stock Category"}</DialogTitle>
            <DialogDescription>New master data will be associated with the selected branch when one is selected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="block space-y-2 text-sm font-medium">
              <span>{form === "group" ? "Group name" : "Category name"}</span>
              <Input value={formName} onChange={(event) => setFormName(event.target.value)} autoFocus />
            </label>
            {form === "subcategory" && (
              <label className="block space-y-2 text-sm font-medium">
                <span>Parent category</span>
                <Select value={formParentId} onValueChange={setFormParentId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {rootCategories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button
              disabled={!formName.trim() || (form === "subcategory" && !formParentId) || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="bg-indigo-950 hover:bg-indigo-900"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingCategory)} onOpenChange={(open) => { if (!open) setEditingCategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Primary Godown Mapping</DialogTitle>
            <DialogDescription>Choose the primary godown for {editingCategory?.name}. This mapping is informational and will not change stock workflow defaults.</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            <span>Primary godown</span>
            <Select value={godownId || "none"} onValueChange={(value) => setGodownId(value === "none" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Not mapped" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not mapped</SelectItem>
                {godowns
                  .filter((godown) => !branchParam || !godown.branch_id || String(godown.branch_id) === branchParam)
                  .map((godown) => <SelectItem key={godown.id} value={String(godown.id)}>{godown.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
            <Button onClick={() => mapGodownMutation.mutate()} disabled={mapGodownMutation.isPending} className="bg-indigo-950 hover:bg-indigo-900">
              {mapGodownMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
