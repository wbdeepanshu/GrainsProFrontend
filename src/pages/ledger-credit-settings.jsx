import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Filter, Menu, RefreshCw, Save, Search } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import Loader from "@/components/common/loader";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function draftFromRow(row) {
  return {
    credit_type_id: row.credit_type_id ? String(row.credit_type_id) : "",
    credit_limit_days: row.credit_limit_days ?? 0,
    credit_limit_amount: row.credit_limit_amount ?? "",
    credit_bills_count: row.credit_bills_count ?? 0,
  };
}

function isDirty(row, draft) {
  if (!draft) return false;
  return (
    String(draft.credit_type_id || "") !== String(row.credit_type_id || "") ||
    String(draft.credit_limit_days ?? "") !== String(row.credit_limit_days ?? 0) ||
    String(draft.credit_limit_amount ?? "") !== String(row.credit_limit_amount ?? "") ||
    String(draft.credit_bills_count ?? "") !== String(row.credit_bills_count ?? 0)
  );
}

function payloadFromDraft(partyId, draft) {
  return {
    party_id: partyId,
    credit_type_id: draft.credit_type_id ? Number(draft.credit_type_id) : null,
    credit_limit_days: draft.credit_limit_days === "" ? 0 : Number(draft.credit_limit_days),
    credit_limit_amount: draft.credit_limit_amount === "" ? null : String(draft.credit_limit_amount),
    credit_bills_count: draft.credit_bills_count === "" ? 0 : Number(draft.credit_bills_count),
  };
}

export default function LedgerCreditSettings() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState("");
  const [creditTypeFilter, setCreditTypeFilter] = useState("");
  const [onlyWithCredit, setOnlyWithCredit] = useState(false);
  const [editing, setEditing] = useState({});
  const [drafts, setDrafts] = useState({});
  const [selected, setSelected] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [savingBulk, setSavingBulk] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const token = AuthService.getAccessToken();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: creditTypesBody } = useQuery({
    queryKey: ["credit-types-for-ledger-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/accounts/credit-types/?page_size=1000`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to load credit types");
      return body;
    },
    enabled: !!token,
  });
  const creditTypes = creditTypesBody?.data || [];

  const { data: branchesBody } = useQuery({
    queryKey: ["branches-for-ledger-credit"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to load branches");
      return body;
    },
    enabled: !!token,
  });
  const branches = branchesBody?.data || branchesBody?.branches || [];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["party-credit-settings", debouncedSearch, page, branchId, creditTypeFilter, onlyWithCredit],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: "50" });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (branchId) params.set("branch_id", branchId);
      if (creditTypeFilter) params.set("credit_type_id", creditTypeFilter);
      if (onlyWithCredit) params.set("only_with_credit", "true");
      const response = await apiRequest("GET", `${API_BASE_URL}/api/party-credit-settings/?${params.toString()}`);
      const body = await response.json();
      if (!response.ok || Number(body.status) >= 400) throw new Error(body.message || "Unable to load ledger credit settings");
      return body;
    },
    enabled: !!token,
  });

  const rows = data?.data || [];
  const total = data?.pagination?.total_count || 0;
  const totalPages = data?.pagination?.total_pages || 1;

  const { data: logsBody, isFetching: logsLoading } = useQuery({
    queryKey: ["party-credit-settings-logs"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/party-credit-settings-logs/?page_size=50`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to load logs");
      return body;
    },
    enabled: !!token && logsOpen,
  });
  const logs = logsBody?.data?.logs || [];

  const dirtyRows = useMemo(
    () => rows.filter((row) => isDirty(row, drafts[row.party_id])),
    [rows, drafts],
  );

  const updateDraft = (partyId, patch) => {
    setDrafts((current) => ({ ...current, [partyId]: { ...current[partyId], ...patch } }));
  };

  const saveItems = async (items) => {
    const response = await apiRequest("POST", `${API_BASE_URL}/api/create-update-party-credit-settings/`, {
      items,
    });
    const body = await response.json();
    if (!response.ok || Number(body.status) >= 400) throw new Error(body.message || "Unable to save credit settings");
    return body;
  };

  const handleSaveOne = async (row) => {
    const draft = drafts[row.party_id] || draftFromRow(row);
    setSavingId(row.party_id);
    try {
      await saveItems([payloadFromDraft(row.party_id, draft)]);
      setEditing((current) => ({ ...current, [row.party_id]: false }));
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.party_id];
        return next;
      });
      toast({ title: "Saved", description: `${row.party_name} credit settings saved.` });
      queryClient.invalidateQueries({ queryKey: ["party-credit-settings"] });
    } catch (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveChanges = async () => {
    const targets = selected.length
      ? rows.filter((row) => selected.includes(row.party_id) && isDirty(row, drafts[row.party_id]))
      : dirtyRows;
    if (!targets.length) return;
    setSavingBulk(true);
    try {
      await saveItems(targets.map((row) => payloadFromDraft(row.party_id, drafts[row.party_id])));
      setEditing({});
      setDrafts({});
      setSelected([]);
      toast({ title: "Saved", description: `${targets.length} ledger credit setting${targets.length === 1 ? "" : "s"} saved.` });
      queryClient.invalidateQueries({ queryKey: ["party-credit-settings"] });
    } catch (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSavingBulk(false);
    }
  };

  return (
    <div className="app-layout bg-[#f4f7fb]">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
      <div className="app-main-content">
        <header className="app-header flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-semibold text-slate-900">Ledgers Credit Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLogsOpen(true)}>
              <Clock className="mr-2 h-4 w-4" /> Logs
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button className="bg-[#1e3a8a] text-white hover:bg-[#1e40af]" onClick={handleSaveChanges} disabled={savingBulk || dirtyRows.length === 0}>
              <Save className="mr-2 h-4 w-4" /> Save Changes ({dirtyRows.length})
            </Button>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">Ledgers Credit Settings</h2>
              <span className="text-sm text-slate-500">Total: {total}</span>
            </div>
            <div className="flex items-center gap-2 px-4 pb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Ledger name, contact, code..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="bg-[#1e3a8a] text-white hover:bg-[#1e40af]" aria-label="Filter">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Branch</label>
                    <Select value={branchId || "all"} onValueChange={(value) => { setBranchId(value === "all" ? "" : value); setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Credit type</label>
                    <Select value={creditTypeFilter || "all"} onValueChange={(value) => { setCreditTypeFilter(value === "all" ? "" : value); setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="All credit types" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All credit types</SelectItem>
                        <SelectItem value="__empty__">No credit type</SelectItem>
                        {creditTypes.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={onlyWithCredit} onCheckedChange={(checked) => { setOnlyWithCredit(!!checked); setPage(1); }} />
                    Only ledgers with credit
                  </label>
                </PopoverContent>
              </Popover>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-y bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        checked={rows.length > 0 && rows.every((row) => selected.includes(row.party_id))}
                        onCheckedChange={(checked) => setSelected(checked ? rows.map((row) => row.party_id) : [])}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-3">Ledger</th>
                    <th className="px-3 py-3">Edit</th>
                    <th className="px-3 py-3">Credit Type</th>
                    <th className="px-3 py-3">Credit Days</th>
                    <th className="px-3 py-3">Credit Amount</th>
                    <th className="px-3 py-3">Bills Count</th>
                    <th className="px-3 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading ledgers...</td></tr>
                  ) : rows.length ? rows.map((row) => {
                    const isEditing = !!editing[row.party_id];
                    const draft = drafts[row.party_id] || draftFromRow(row);
                    const dirty = isDirty(row, drafts[row.party_id]);
                    const subtitle = [row.contact_number, row.organization_name, row.branch_name].filter(Boolean).join(" · ");
                    return (
                      <tr key={row.party_id} className={`border-b ${dirty ? "bg-amber-50" : "bg-white"}`}>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selected.includes(row.party_id)}
                            onCheckedChange={() => setSelected((current) => current.includes(row.party_id) ? current.filter((id) => id !== row.party_id) : [...current, row.party_id])}
                            aria-label={`Select ${row.party_name}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{row.party_name}</div>
                          {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
                        </td>
                        <td className="px-3 py-3">
                          <Switch
                            checked={isEditing}
                            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-400"
                            onCheckedChange={(checked) => {
                              setEditing((current) => ({ ...current, [row.party_id]: checked }));
                              if (checked && !drafts[row.party_id]) {
                                setDrafts((current) => ({ ...current, [row.party_id]: draftFromRow(row) }));
                              }
                            }}
                            aria-label={`Edit ${row.party_name}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <Select value={draft.credit_type_id || "none"} onValueChange={(value) => updateDraft(row.party_id, { credit_type_id: value === "none" ? "" : value })}>
                              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="No credit type" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No credit type</SelectItem>
                                {creditTypes.map((type) => (
                                  <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{row.credit_type_name || "No credit type"}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <Input className="h-9 w-24" type="number" min="0" value={draft.credit_limit_days} onChange={(event) => updateDraft(row.party_id, { credit_limit_days: event.target.value })} />
                          ) : row.credit_limit_days ?? 0}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <Input className="h-9 w-32" type="number" min="0" value={draft.credit_limit_amount} onChange={(event) => updateDraft(row.party_id, { credit_limit_amount: event.target.value })} />
                          ) : (row.credit_limit_amount || "—")}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <Input className="h-9 w-24" type="number" min="0" value={draft.credit_bills_count} onChange={(event) => updateDraft(row.party_id, { credit_bills_count: event.target.value })} />
                          ) : row.credit_bills_count ?? 0}
                        </td>
                        <td className="px-3 py-3">
                          <Button variant="outline" size="sm" disabled={!dirty || savingId === row.party_id} onClick={() => handleSaveOne(row)}>
                            <Save className="mr-1 h-3.5 w-3.5" /> {savingId === row.party_id ? "Saving" : "Save"}
                          </Button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No ledgers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-600">
              <span>Page {page} of {totalPages || 1}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Credit settings history</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {logsLoading ? <p className="py-6 text-sm text-slate-500">Loading history...</p> : logs.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">Ledger</th>
                    <th className="py-2 pr-3">Change</th>
                    <th className="py-2 pr-3">By</th>
                    <th className="py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b align-top">
                      <td className="py-2 pr-3 font-medium">{log.party_name}</td>
                      <td className="py-2 pr-3 text-slate-600">{log.latest_change || "—"}</td>
                      <td className="py-2 pr-3">{log.assigned_by_name || "—"}</td>
                      <td className="py-2 whitespace-nowrap">{log.created_at || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="py-6 text-sm text-slate-500">No credit setting changes yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Loader isLoading={isLoading} text="Loading credit settings" />
    </div>
  );
}
