import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AuthService } from "@/lib/auth";
import { uploadMediaFile } from "@/lib/media_upload_api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

async function requestJson(method, path, data) {
  const response = await apiRequest(method, `${API_BASE_URL}${path}`, data);
  const result = await response.json();
  if (!response.ok || ![200, 201].includes(result?.status)) {
    throw new Error(result?.message || `Request failed (${response.status})`);
  }
  return result;
}

export default function BrokerMasters() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("all");
  const [brokerFormOpen, setBrokerFormOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState(null);
  const [brokerName, setBrokerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [brokerBranchId, setBrokerBranchId] = useState("");
  const [activeBroker, setActiveBroker] = useState(null);
  const [kycFormOpen, setKycFormOpen] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentFile, setDocumentFile] = useState(null);

  const brokersQuery = useQuery({
    queryKey: ["broker-master-list"],
    queryFn: () => requestJson("GET", "/api/report/broker/"),
  });
  const branchesQuery = useQuery({
    queryKey: ["broker-master-branches"],
    queryFn: () => requestJson("GET", "/api/get-branches/"),
  });
  const kycTypesQuery = useQuery({
    queryKey: ["broker-master-kyc-types"],
    queryFn: () => requestJson("GET", "/api/user/kyc-document-types/"),
  });
  const brokers = Array.isArray(brokersQuery.data?.data) ? brokersQuery.data.data : [];
  const branches = Array.isArray(branchesQuery.data?.data) ? branchesQuery.data.data : [];
  const documentTypes = Array.isArray(kycTypesQuery.data?.data) ? kycTypesQuery.data.data : [];

  const brokerKycQuery = useQuery({
    queryKey: ["broker-kyc-documents", activeBroker?.id],
    queryFn: () => requestJson("GET", `/api/report/broker-kyc/?broker_id=${activeBroker.id}`),
    enabled: Boolean(activeBroker?.id),
  });
  const documents = Array.isArray(brokerKycQuery.data?.data) ? brokerKycQuery.data.data : [];

  const filteredBrokers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return brokers.filter((broker) => {
      const matchesSearch = !term || [broker.name, broker.contact_number, broker.branch_name]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const matchesKyc = kycFilter === "all" ||
        (kycFilter === "verified" ? broker.kyc_verified : !broker.kyc_verified);
      return matchesSearch && matchesKyc;
    });
  }, [brokers, search, kycFilter]);
  const verifiedCount = brokers.filter((broker) => broker.kyc_verified).length;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["broker-master-list"] });
  const saveBrokerMutation = useMutation({
    mutationFn: () => requestJson("POST", "/api/report/broker/", {
      ...(editingBroker ? { id: editingBroker.id } : {}),
      name: brokerName.trim(),
      contact_number: contactNumber.trim(),
      branch_id: brokerBranchId || null,
    }),
    onSuccess: async (result) => {
      toast({ title: "Success", description: result.message || "Broker saved." });
      setBrokerFormOpen(false);
      setEditingBroker(null);
      setBrokerName("");
      setContactNumber("");
      setBrokerBranchId("");
      await refresh();
    },
    onError: (error) => toast({ title: "Unable to save broker", description: error.message, variant: "destructive" }),
  });
  const deleteBrokerMutation = useMutation({
    mutationFn: (broker) => requestJson("DELETE", "/api/report/broker/", { id: broker.id }),
    onSuccess: async (result) => {
      toast({ title: "Success", description: result.message || "Broker deactivated." });
      await refresh();
    },
    onError: (error) => toast({ title: "Unable to delete broker", description: error.message, variant: "destructive" }),
  });
  const saveKycMutation = useMutation({
    mutationFn: async () => {
      if (!documentFile) throw new Error("Choose a document image first.");
      const fileUrl = await uploadMediaFile(documentFile, "broker_kyc");
      return requestJson("POST", "/api/report/broker-kyc/", {
        broker_id: activeBroker.id,
        document_name: documentName,
        document_number: documentNumber.trim(),
        file_url: fileUrl,
      });
    },
    onSuccess: async (result) => {
      toast({ title: "KYC saved", description: result.message });
      setKycFormOpen(false);
      setDocumentName("");
      setDocumentNumber("");
      setDocumentFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["broker-kyc-documents", activeBroker?.id] }),
        refresh(),
      ]);
    },
    onError: (error) => toast({ title: "Unable to save KYC", description: error.message, variant: "destructive" }),
  });
  const deleteKycMutation = useMutation({
    mutationFn: (documentId) => requestJson("DELETE", "/api/report/broker-kyc/", {
      broker_id: activeBroker.id,
      document_id: documentId,
    }),
    onSuccess: async () => {
      toast({ title: "Document removed", description: "Broker KYC document deleted." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["broker-kyc-documents", activeBroker?.id] }),
        refresh(),
      ]);
    },
    onError: (error) => toast({ title: "Unable to remove document", description: error.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingBroker(null);
    setBrokerName("");
    setContactNumber("");
    setBrokerBranchId("");
    setBrokerFormOpen(true);
  };
  const openEdit = (broker) => {
    setEditingBroker(broker);
    setBrokerName(broker.name || "");
    setContactNumber(broker.contact_number || "");
    setBrokerBranchId(broker.branch_id ? String(broker.branch_id) : "");
    setBrokerFormOpen(true);
  };
  const openKyc = (broker) => {
    setActiveBroker(broker);
    setDocumentName("");
    setDocumentNumber("");
    setDocumentFile(null);
  };
  const goToBrokerage = (broker) => {
    try {
      sessionStorage.setItem("brokerage_config_filter_broker_id", String(broker.id));
    } catch {
      toast({ title: "Navigation issue", description: "Could not preserve the broker filter.", variant: "destructive" });
    }
    setLocation("/margin-settings/brokerage-configuration");
  };
  const isLoading = brokersQuery.isLoading || branchesQuery.isLoading;

  if (isLoading) return <CommonLoader text="Loading brokers..." />;

  return (
    <div className="app-layout bg-slate-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="app-main-content min-w-0">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 md:px-6">
          <div className="flex items-center gap-3">
            {isMobile && <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)}>Menu</Button>}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Brokers Master</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/margin-settings/brokerage-configuration")}>
              <Wallet className="mr-2 h-4 w-4" /> Brokerage
            </Button>
            <Button onClick={openCreate} className="bg-indigo-950 hover:bg-indigo-900">
              <Plus className="mr-2 h-4 w-4" /> Add Broker
            </Button>
            <Button variant="outline" onClick={refresh} disabled={brokersQuery.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${brokersQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </header>

        <div className="app-main-scrollable space-y-4 p-3 md:p-4">
          {brokersQuery.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to load brokers: {brokersQuery.error.message}
            </div>
          )}
          <section className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Total Brokers", value: brokers.length, icon: Users },
              { label: "KYC Verified", value: verifiedCount, icon: BadgeCheck },
              { label: "Pending KYC", value: brokers.length - verifiedCount, icon: ShieldAlert },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="border-blue-200 bg-gradient-to-br from-white to-blue-50 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
                  <CardContent className="flex items-center justify-between p-4">
                    <div><p className="text-sm text-slate-600 dark:text-slate-300">{stat.label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p></div>
                    <span className="rounded-xl bg-indigo-950 p-3 text-white"><Icon className="h-5 w-5" /></span>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <Card className="border-blue-100 shadow-sm dark:border-gray-700">
            <CardContent className="grid gap-4 p-4 md:grid-cols-2">
              <Label className="space-y-2">
                <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Search</span>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brokers..." />
              </Label>
              <Label className="space-y-2">
                <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> KYC Status</span>
                <Select value={kycFilter} onValueChange={setKycFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All KYC statuses</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Not verified</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
              <p className="text-sm text-slate-500 md:col-span-2">{filteredBrokers.length} Broker(s) shown</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-blue-100 shadow-sm dark:border-gray-700">
            {filteredBrokers.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">{brokers.length ? "No brokers match these filters." : "No brokers yet. Add a broker to get started."}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Broker</th>
                      <th className="px-4 py-3 font-semibold">Contact</th>
                      <th className="px-4 py-3 font-semibold">Branch</th>
                      <th className="px-4 py-3 font-semibold">KYC Status</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                    {filteredBrokers.map((broker) => (
                      <tr key={broker.id} className="bg-white hover:bg-slate-50 dark:bg-gray-900 dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800">{broker.name?.slice(0, 2).toUpperCase()}</span>
                            <div><p className="font-semibold text-slate-900 dark:text-white">{broker.name}</p><p className="text-xs text-slate-500">{broker.kyc_document_count || 0} document(s)</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{broker.contact_number || "—"}</span></td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{broker.branch_name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-3 py-1 text-xs ${broker.kyc_verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                            {broker.kyc_verified ? "Verified" : "Not Verified"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />{broker.created_at || "—"}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="icon" title="View KYC" onClick={() => openKyc(broker)}><Eye className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" title="Edit broker" onClick={() => openEdit(broker)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" title="Delete broker" onClick={() => {
                              if (window.confirm(`Deactivate broker "${broker.name}"?`)) deleteBrokerMutation.mutate(broker);
                            }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                            <Button variant="outline" size="sm" title="Brokerage settings" onClick={() => goToBrokerage(broker)}><Wallet className="h-4 w-4" /></Button>
                          </div>
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

      <Dialog open={brokerFormOpen} onOpenChange={(open) => { setBrokerFormOpen(open); if (!open) setEditingBroker(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBroker ? "Edit Broker" : "Add Broker"}</DialogTitle>
            <DialogDescription>Broker details are saved to the existing broker master.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label className="space-y-2"><span>Name</span><Input value={brokerName} onChange={(event) => setBrokerName(event.target.value)} placeholder="Broker name" /></Label>
            <Label className="space-y-2"><span>Contact</span><Input value={contactNumber} onChange={(event) => setContactNumber(event.target.value.replace(/[^\d+]/g, "").slice(0, 15))} placeholder="Mobile number" inputMode="tel" /></Label>
            <Label className="space-y-2">
              <span>Branch</span>
              <Select value={brokerBranchId || "default"} onValueChange={(value) => setBrokerBranchId(value === "default" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="User's default branch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">User's default branch</SelectItem>
                  {branches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrokerFormOpen(false)}>Cancel</Button>
            <Button disabled={!brokerName.trim() || saveBrokerMutation.isPending} onClick={() => saveBrokerMutation.mutate()} className="bg-indigo-950 hover:bg-indigo-900">
              {saveBrokerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingBroker ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeBroker) && !kycFormOpen} onOpenChange={(open) => { if (!open) setActiveBroker(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{activeBroker?.name}</DialogTitle>
            <DialogDescription>{activeBroker?.contact_number || "No contact number"} · {activeBroker?.branch_name || "No branch"}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">KYC Documents</h3>
            <Button onClick={() => setKycFormOpen(true)} className="bg-indigo-950 hover:bg-indigo-900"><Plus className="mr-2 h-4 w-4" /> Add KYC</Button>
          </div>
          {brokerKycQuery.isLoading ? (
            <div className="py-10 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : brokerKycQuery.error ? (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{brokerKycQuery.error.message}</div>
          ) : documents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-slate-500"><FileText className="mx-auto mb-2 h-8 w-8" />No KYC documents yet.</div>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div><p className="font-medium">{document.document_name}</p><p className="text-sm text-slate-500">{document.document_number || "No document number"} · {document.created_at}</p></div>
                  <div className="flex gap-2">
                    {document.file_url && <Button asChild variant="outline" size="sm"><a href={document.file_url} target="_blank" rel="noreferrer"><Eye className="mr-1 h-4 w-4" /> View</a></Button>}
                    <Button variant="outline" size="icon" aria-label="Delete KYC document" onClick={() => {
                      if (window.confirm(`Delete ${document.document_name}?`)) deleteKycMutation.mutate(document.id);
                    }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={kycFormOpen} onOpenChange={(open) => { setKycFormOpen(open); if (!open) { setDocumentFile(null); setDocumentNumber(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Broker KYC</DialogTitle>
            <DialogDescription>{activeBroker?.name} · Upload an image; the broker is verified when at least one document image is saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label className="space-y-2">
              <span>Document name</span>
              <Select value={documentName} onValueChange={setDocumentName}>
                <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
                <SelectContent>{documentTypes.map((type) => <SelectItem key={type.id} value={type.document_name}>{type.document_name}</SelectItem>)}</SelectContent>
              </Select>
              {kycTypesQuery.error && <p className="text-xs text-red-600">{kycTypesQuery.error.message}</p>}
            </Label>
            <Label className="space-y-2"><span>Document number (optional)</span><Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Document number" /></Label>
            <Label className="block space-y-2">
              <span>Document image</span>
              <Input type="file" accept="image/*" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} />
              {documentFile && <span className="block text-xs text-slate-500">{documentFile.name} · {(documentFile.size / 1024 / 1024).toFixed(2)} MB</span>}
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKycFormOpen(false)}>Cancel</Button>
            <Button disabled={!documentName || !documentFile || saveKycMutation.isPending} onClick={() => saveKycMutation.mutate()} className="bg-indigo-950 hover:bg-indigo-900">
              {saveKycMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save KYC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
