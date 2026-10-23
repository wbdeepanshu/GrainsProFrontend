import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Settings, Save, Menu, Loader2, Building2 } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SUPERADMIN_BASE = `${API_BASE_URL}/api/superadmin`;

function getToken() {
  return localStorage.getItem("superadmin_token");
}

export default function TallyConfig() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const userId = searchParams.get("user_id");

  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCompany, setIsFetchingCompany] = useState(false);
  const { toast } = useToast();

  const [adminInfo, setAdminInfo] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    tally_host: "",
    tally_port: "",
    address: "",
    city: "",
    state: "",
  });
  const [readOnlyData, setReadOnlyData] = useState(null);
  const [companyListForSelection, setCompanyListForSelection] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      setLocation("/superadmin/login");
      return;
    }
    if (!userId) {
      setLocation("/superadmin/admin-list");
      return;
    }
  }, [userId, setLocation]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setIsLoading(true);
      const token = getToken();
      const headers = { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };

      try {
        const res = await fetch(
          `${SUPERADMIN_BASE}/super-admin/tally-config/?user_id=${encodeURIComponent(userId)}`,
          { headers }
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Failed to load tally config");
        }

        if (data.admin_info) {
          setAdminInfo(data.admin_info);
        }

        if (data.data) {
          const d = data.data;
          setFormData({
            name: d.name || "",
            tally_host: d.tally_host || "",
            tally_port: d.tally_port || "",
            address: d.address || "",
            city: d.city || "",
            state: d.state || "",
          });
          setReadOnlyData({
            company_id: d.company_id,
            organization_name: d.organization_name,
            books_from: d.books_from,
            created_at: d.created_at,
            updated_at: d.updated_at,
          });
        } else {
          setReadOnlyData(null);
          setFormData({
            name: data.admin_info?.organization_name || "",
            tally_host: "",
            tally_port: "",
            address: "",
            city: "",
            state: "",
          });
        }
      } catch (e) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
        setLocation("/superadmin/admin-list");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userId, setLocation, toast]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const fetchCompanyName = async () => {
    const host = (formData.tally_host || "").trim();
    const port = (formData.tally_port || "").trim();
    if (!host || !port) {
      toast({ title: "Error", description: "Enter Tally host and port first", variant: "destructive" });
      return;
    }
    const tallyUrl = host.startsWith("http") ? `${host.replace(/\/+$/, "")}:${port}` : `http://${host}:${port}`;
    setIsFetchingCompany(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/tally/company-name/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tally_url: tallyUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch company name");
      }
      const companyNames = data?.data?.company_names ?? [];
      if (companyNames.length === 0) {
        toast({ title: "Notice", description: data.message || "No company name in Tally response" });
      } else if (companyNames.length === 1) {
        setFormData((prev) => ({ ...prev, name: companyNames[0] }));
        toast({ title: "Success", description: "Company name fetched from Tally" });
      } else {
        setCompanyListForSelection(companyNames);
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsFetchingCompany(false);
    }
  };

  const save = async () => {
    const token = getToken();
    setIsSaving(true);
    try {
      const res = await fetch(`${SUPERADMIN_BASE}/super-admin/tally-config/update/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({
          user_id: userId,
          name: formData.name,
          tally_host: formData.tally_host || undefined,
          tally_port: formData.tally_port || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast({ title: "Success", description: data.message || "Tally config saved successfully" });
      setReadOnlyData((prev) => ({
        ...prev,
        ...data.data,
        updated_at: new Date().toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      }));
      if (data.data) {
        setFormData((prev) => ({
          ...prev,
          name: data.data.name ?? prev.name,
          tally_host: data.data.tally_host ?? prev.tally_host,
          tally_port: data.data.tally_port ?? prev.tally_port,
          address: data.data.address ?? prev.address,
          city: data.data.city ?? prev.city,
          state: data.data.state ?? prev.state,
        }));
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <CommonLoader />;

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)} className="mr-2">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/superadmin/admin-list")}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="bg-gradient-to-r from-black to-gray-600 p-2 rounded-lg">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tally Configuration</h1>
              <p className="text-sm text-gray-600">
                {adminInfo?.name} ({adminInfo?.organization_name})
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">

            <Card className="shadow-sm border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Tally Settings</CardTitle>
                <p className="text-sm text-gray-500">Configure Tally connection and company details for this organization.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tally_host">Tally host</Label>
                    <Input
                      id="tally_host"
                      value={formData.tally_host}
                      onChange={(e) => handleInputChange("tally_host", e.target.value)}
                      placeholder="e.g. localhost or IP"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tally_port">Tally port</Label>
                    <div className="flex h-11 rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                      <Input
                        id="tally_port"
                        value={formData.tally_port}
                        onChange={(e) => handleInputChange("tally_port", e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 9000"
                        className="h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                      />
                      <Button
                        type="button"
                        onClick={fetchCompanyName}
                        disabled={isFetchingCompany}
                        className="h-full rounded-none bg-black hover:bg-gray-800 text-white shrink-0 px-4 font-medium"
                      >
                        {isFetchingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch company name"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Company / Config name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Company or config name (use Fetch to get from Tally)"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      placeholder="Address"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      placeholder="City"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange("state", e.target.value)}
                      placeholder="State"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button onClick={save} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSaving ? "Saving..." : "Save Tally Config"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Select company popup (when Tally returns multiple companies) */}
      <Dialog open={!!companyListForSelection?.length} onOpenChange={(open) => !open && setCompanyListForSelection(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Select company name
            </DialogTitle>
            <DialogDescription>
              Tally returned multiple companies. Choose one to use as Company / Config name.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-2 pr-2">
            {companyListForSelection?.map((name) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                className="w-full justify-start h-auto py-3 text-left font-normal"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, name }));
                  setCompanyListForSelection(null);
                  toast({ title: "Success", description: "Company name selected" });
                }}
              >
                {name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
