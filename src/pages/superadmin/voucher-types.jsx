import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Menu, CheckCircle, XCircle, RefreshCw, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SUPERADMIN_BASE = `${API_BASE_URL}/api/superadmin`;

function getToken() {
  return localStorage.getItem("superadmin_token");
}

export default function VoucherTypes() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [organizationId, setOrganizationId] = useState(""); // '' = all
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!getToken()) setLocation("/superadmin/login");
  }, [setLocation]);

  const { data: organizationsData } = useQuery({
    queryKey: ["superadmin-organizations"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch(`${SUPERADMIN_BASE}/super-admin/organizations/`, {
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (!res.ok) throw new Error("Failed to fetch organizations");
      const result = await res.json();
      return result.status === 200 ? result.data || [] : [];
    },
    enabled: !!getToken(),
  });

  const organizations = organizationsData || [];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["superadmin-voucher-types", filter, organizationId],
    queryFn: async () => {
      const token = getToken();
      const params = new URLSearchParams();
      if (filter === "active") params.set("is_active", "true");
      else if (filter === "inactive") params.set("is_active", "false");
      if (organizationId) params.set("organization_id", organizationId);
      const url = `${SUPERADMIN_BASE}/super-admin/voucher-types/${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch voucher types");
      }
      const result = await res.json();
      return result.status === 200 ? result : { data: [], count: 0, summary: null, organization_name: null };
    },
    enabled: !!getToken() && !!organizationId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ voucherId, isActive }) => {
      const token = getToken();
      const res = await fetch(`${SUPERADMIN_BASE}/super-admin/voucher-types/update-status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ voucher_id: voucherId, is_active: isActive }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Update failed");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-voucher-types"] });
      toast({ title: "Success", description: "Voucher type status updated" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const voucherTypes = data?.data || [];
  const count = data?.count ?? voucherTypes.length;
  const summary = data?.summary ?? null;
  const organizationName = data?.organization_name ?? (organizations.find((o) => o.id === organizationId)?.name || "");

  if (!getToken()) return <CommonLoader />;

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)} className="mr-2">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Voucher Types</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Single compact toolbar: org + summary + filters (reference: voucher-settings) */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Organization</span>
                    <Select value={organizationId || "__none__"} onValueChange={(v) => setOrganizationId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="w-[220px] h-9">
                        <Building2 className="h-4 w-4 mr-1.5 text-gray-500 shrink-0" />
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Select organization —</SelectItem>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name || org.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {organizationId && (summary != null || organizationName) && (
                    <div className="flex items-center gap-4 border-l border-gray-200 pl-4">
                      {organizationName && (
                        <span className="text-sm text-gray-600">
                          <span className="font-medium text-gray-500">Org:</span> {organizationName}
                        </span>
                      )}
                      {summary != null && (
                        <>
                          <Badge variant="secondary" className="font-normal">
                            Total: {Number(summary.total) || 0}
                          </Badge>
                          <Badge className="bg-green-600/90 font-normal">Active: {Number(summary.active) || 0}</Badge>
                          <Badge variant="outline" className="font-normal text-gray-600">Inactive: {Number(summary.inactive) || 0}</Badge>
                        </>
                      )}
                    </div>
                  )}
                  {organizationId && (
                    <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-0">
                      <span className="text-sm font-medium text-gray-700">Status</span>
                      <Button
                        variant={filter === "all" ? "default" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => setFilter("all")}
                      >
                        All
                      </Button>
                      <Button
                        variant={filter === "active" ? "default" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => setFilter("active")}
                      >
                        Active
                      </Button>
                      <Button
                        variant={filter === "inactive" ? "default" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => setFilter("inactive")}
                      >
                        Inactive
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!organizationId && (
              <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
                <CardContent className="py-10 text-center">
                  <Building2 className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="font-medium text-gray-600">Select an organization first</p>
                  <p className="text-sm text-gray-500 mt-1">Choose an organization above to view and manage its voucher types.</p>
                </CardContent>
              </Card>
            )}

            {organizationId && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Voucher Types ({count})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  {isLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  )}
                  {error && (
                    <div className="text-center py-6 text-red-500 text-sm">{error.message}</div>
                  )}
                  {!isLoading && !error && voucherTypes.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">No voucher types found for this organization.</div>
                  )}
                  {!isLoading && !error && voucherTypes.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead className="py-2 px-3 text-xs font-semibold">Name</TableHead>
                            <TableHead className="py-2 px-3 text-xs font-semibold">Details</TableHead>
                            <TableHead className="py-2 px-3 text-xs font-semibold w-20">Status</TableHead>
                            <TableHead className="py-2 px-3 text-xs font-semibold w-28 text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {voucherTypes.map((vt) => (
                            <TableRow key={vt.id} className="hover:bg-gray-50">
                              <TableCell className="py-2 px-3 font-medium text-gray-900 text-sm">
                                {vt.display_name || vt.name}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-gray-500 text-sm min-w-0 max-w-[320px] truncate" title={`${vt.name}${vt.parent ? ` · ${vt.parent}` : ""}${vt.organization_name ? ` · ${vt.organization_name}` : ""}`}>
                                {vt.name}
                                {vt.parent ? ` · ${vt.parent}` : ""}
                                {vt.organization_name ? ` · ${vt.organization_name}` : ""}
                              </TableCell>
                              <TableCell className="py-2 px-3">
                                <Badge variant={vt.is_active ? "default" : "secondary"} className="text-xs">
                                  {vt.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2 px-3 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`h-7 text-xs ${vt.is_active ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                                  disabled={updateStatusMutation.isPending}
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      voucherId: vt.id,
                                      isActive: !vt.is_active,
                                    })
                                  }
                                >
                                  {vt.is_active ? (
                                    <><XCircle className="h-3.5 w-3.5 mr-1" />Deactivate</>
                                  ) : (
                                    <><CheckCircle className="h-3.5 w-3.5 mr-1" />Activate</>
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
