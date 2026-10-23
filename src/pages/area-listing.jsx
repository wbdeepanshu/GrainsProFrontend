import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  CircleX,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppPageShell from "@/components/layout/AppPageShell";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { usePermissions } from "@/hooks/usePermissions";
import { isAdminSettingEnabled } from "@/lib/adminSettings";
import { fetchBranchSettings } from "@/lib/branches_api";
import {
  createLedgerAreaGroup,
  fetchLedgerAreaGroups,
  updateLedgerAreaGroup,
} from "@/lib/tally_api";

const ALL = "all";

function SummaryCard({ label, count, icon: Icon }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 px-4 py-3.5 shadow-sm">
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
      </div>
      <span className="rounded-xl bg-[#07104f] p-2.5 text-white">
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
}

export default function AreaListing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const permissionsLoaded = usePermissions();
  const { hasPermission } = useUserPermissions();
  const areaGroupListingEnabled = isAdminSettingEnabled("area_group_listing");
  const canCreate = hasPermission("customer_management", "create");
  const canUpdate = hasPermission("customer_management", "update");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [areaName, setAreaName] = useState("");
  const [formBranchId, setFormBranchId] = useState("");

  const areasQuery = useQuery({
    queryKey: ["ledger-area-groups"],
    queryFn: async () => {
      const result = await fetchLedgerAreaGroups({
        page: 1,
        per_page: 5000,
        is_active: "all",
      });
      return result.data;
    },
    enabled: permissionsLoaded && areaGroupListingEnabled,
    staleTime: 0,
  });
  const branchesQuery = useQuery({
    queryKey: ["ledger-area-group-branches"],
    queryFn: fetchBranchSettings,
    staleTime: 5 * 60 * 1000,
  });
  const areas = areasQuery.data || [];
  const branches = branchesQuery.data || [];

  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return areas.filter((area) => {
      const matchesSearch =
        !term ||
        String(area.name || "").toLowerCase().includes(term) ||
        String(area.branch_name || "").toLowerCase().includes(term);
      const matchesBranch = branchFilter === ALL || String(area.branch_id) === branchFilter;
      const matchesStatus =
        statusFilter === ALL ||
        (statusFilter === "active" ? Boolean(area.is_active) : !area.is_active);
      return matchesSearch && matchesBranch && matchesStatus;
    });
  }, [areas, search, branchFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      total: areas.length,
      active: areas.filter((area) => Boolean(area.is_active)).length,
      inactive: areas.filter((area) => !area.is_active).length,
    }),
    [areas],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const values = { name: areaName.trim(), branch_id: formBranchId };
      return editingArea
        ? updateLedgerAreaGroup(editingArea.id, values)
        : createLedgerAreaGroup(values);
    },
    onSuccess: async (result) => {
      toast({ title: "Success", description: result?.message || "Area saved successfully." });
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["ledger-area-groups"] });
    },
    onError: (error) => {
      toast({ title: "Unable to save area", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateLedgerAreaGroup(id, { is_active: isActive }),
    onSuccess: async (result) => {
      toast({ title: "Area status updated", description: result?.message || "Status saved." });
      await queryClient.invalidateQueries({ queryKey: ["ledger-area-groups"] });
    },
    onError: (error) => {
      toast({
        title: "Unable to update area",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openCreate = () => {
    setEditingArea(null);
    setAreaName("");
    setFormBranchId(branchFilter !== ALL ? branchFilter : String(branches[0]?.id || ""));
    setDialogOpen(true);
  };

  const openEdit = (area) => {
    setEditingArea(area);
    setAreaName(area.name);
    setFormBranchId(String(area.branch_id));
    setDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setBranchFilter(ALL);
    setStatusFilter(ALL);
  };
  const hasFilters = search.trim() || branchFilter !== ALL || statusFilter !== ALL;

  if (!permissionsLoaded) {
    return <div className="p-6"><CommonLoader text="Loading permissions..." /></div>;
  }

  if (!areaGroupListingEnabled) {
    return (
      <AppPageShell>
        <div className="flex min-h-full items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h2 className="font-semibold text-slate-900">Feature disabled</h2>
            <p className="mt-2 text-sm text-slate-500">
              Area Group Listing is turned off in Admin Settings.
            </p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="min-h-full bg-slate-50">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-5 py-3">
          <h1 className="text-xl font-bold text-slate-900">Area Listing</h1>
          <div className="flex gap-2">
            {canCreate ? (
              <Button onClick={openCreate} className="bg-[#07104f] hover:bg-[#101b67]">
                <Plus className="mr-2 h-4 w-4" /> Create Area
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => areasQuery.refetch()} disabled={areasQuery.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${areasQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="space-y-5 p-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryCard label="Total Areas" count={counts.total} icon={MapPin} />
            <SummaryCard label="Active" count={counts.active} icon={CheckCircle2} />
            <SummaryCard label="Inactive" count={counts.inactive} icon={CircleX} />
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-1.5 lg:col-span-6">
                <Label className="flex items-center gap-1.5 text-sm font-medium text-[#07104f]">
                  <Search className="h-4 w-4" /> Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search areas..." className="pl-10" />
                </div>
              </div>
              <div className="space-y-1.5 lg:col-span-3">
                <Label className="flex items-center gap-1.5 text-sm font-medium text-[#07104f]">
                  <Building2 className="h-4 w-4" /> Branch
                </Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 lg:col-span-3">
                <Label className="flex items-center gap-1.5 text-sm font-medium text-[#07104f]">
                  <CheckCircle2 className="h-4 w-4" /> Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{filteredAreas.length} {filteredAreas.length === 1 ? "area" : "areas"}</span>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" /> Clear filters
                </Button>
              ) : null}
            </div>
          </section>

          {areasQuery.error || branchesQuery.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {areasQuery.error?.message || branchesQuery.error?.message}
            </div>
          ) : null}

          {areasQuery.isLoading || branchesQuery.isLoading ? (
            <div className="rounded-xl border bg-white py-8"><CommonLoader text="Loading areas..." /></div>
          ) : (
            <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <div className="min-w-[680px]">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(100px,0.7fr)_minmax(130px,auto)] gap-3 border-b bg-blue-50/70 px-4 py-3 text-sm font-medium text-slate-700">
                    <span>Area</span><span>Branch</span><span>Status</span><span className="text-right">Actions</span>
                  </div>
                  {filteredAreas.length ? filteredAreas.map((area) => (
                    <div key={area.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(100px,0.7fr)_minmax(130px,auto)] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold uppercase text-blue-800">{area.name?.slice(0, 2) || "A"}</span>
                        <span className="truncate text-sm font-semibold text-slate-900">{area.name}</span>
                      </div>
                      <span className="truncate text-sm text-slate-600">{area.branch_name}</span>
                      <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${area.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{area.is_active ? "Active" : "Inactive"}</span>
                      <div className="flex items-center justify-end gap-1.5">
                        {canUpdate ? (
                          <>
                            <Button variant="outline" size="sm" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: area.id, isActive: !area.is_active })}>
                              {statusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : area.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`Edit ${area.name}`} onClick={() => openEdit(area)}>
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )) : (
                    <div className="px-4 py-12 text-center text-sm text-slate-500">No areas found. Create an area or adjust the filters.</div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingArea ? "Edit Area" : "Create Area"}</DialogTitle></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area-name">Area name</Label>
              <Input id="area-name" value={areaName} onChange={(event) => setAreaName(event.target.value)} maxLength={150} required autoFocus placeholder="Enter area name" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={formBranchId} onValueChange={setFormBranchId}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending || !areaName.trim() || !formBranchId} className="bg-[#07104f] hover:bg-[#101b67]">
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingArea ? "Save Changes" : "Create Area"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
