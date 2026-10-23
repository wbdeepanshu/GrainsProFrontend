import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isValid } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  Search,
  Truck,
  Menu,
  RefreshCw,
  Plus,
  Eye,
  Pencil,
  Building2,
  UserRound,
  MapPin,
  Loader2,
  CalendarIcon,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const onlyLetters = (value, max = 30) =>
  String(value || "")
    .replace(/[^a-zA-Z\s.'-]/g, "")
    .slice(0, max);

const onlyDigits = (value, max) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, max);

const limitText = (value, max) => String(value || "").slice(0, max);

const toIsoDate = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(raw);
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : "";
};

const formatDisplayDate = (iso) => {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, "dd-MM-yyyy") : iso;
  } catch {
    return iso;
  }
};

function ThemeDateField({ value, onChange, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const iso = toIsoDate(value);
  const selected = iso ? parseISO(iso) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-10 px-3 inline-flex items-center justify-between rounded-md border border-input bg-white text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={`inline-flex items-center ${iso ? "text-gray-900" : "text-gray-500"}`}>
            <CalendarIcon className="mr-2 h-4 w-4 text-gray-500 shrink-0" />
            {iso ? formatDisplayDate(iso) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[100]" align="start">
        <CalendarComponent
          mode="single"
          selected={selected && isValid(selected) ? selected : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((opt) => String(opt.value) === String(value));
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) =>
      String(opt.label || "")
        .toLowerCase()
        .includes(term)
    );
  }, [options, search]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 font-normal bg-white"
        >
          <span className={`truncate ${selected ? "text-gray-900" : "text-gray-500"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 z-[100]"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={String(opt.value)}
                  value={String(opt.label)}
                  onSelect={() => {
                    onChange(String(opt.value));
                    setOpen(false);
                    setSearch("");
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      String(value) === String(opt.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const MODULE_ALIAS = "logistics_management";

const PROVIDER_TYPES = [
  { value: "partnership", label: "Partnership" },
  { value: "company", label: "Company" },
  { value: "service_provider", label: "Service Provider" },
];

const VEHICLE_TYPES = [
  { value: "truck", label: "Truck" },
  { value: "trailer", label: "Trailer" },
  { value: "pickup", label: "Pickup" },
  { value: "tempo", label: "Tempo" },
  { value: "container", label: "Container" },
  { value: "tanker", label: "Tanker" },
  { value: "other", label: "Other" },
];

const CAPACITY_UNITS = [
  { value: "kg", label: "KG" },
  { value: "mt", label: "Metric Ton" },
  { value: "bags", label: "Bags" },
  { value: "ltr", label: "Litre" },
];

const VEHICLE_STATUSES = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_TYPES = [
  { id: "providers", label: "Providers", icon: Building2 },
  { id: "drivers", label: "Drivers", icon: UserRound },
  { id: "vehicles", label: "Vehicles", icon: Truck },
  { id: "routes", label: "Serviceable Routes", icon: MapPin },
];

const TAB_DETAILS = {
  providers: {
    heading: "Logistics Providers",
    description: "Manage transport vendors, contacts, and provider status.",
    addLabel: "Add Provider",
    searchPlaceholder: "Search providers by name, contact, city...",
    emptyMessage: "No providers found",
  },
  drivers: {
    heading: "Logistics Drivers",
    description: "Manage driver profiles, licenses, and provider mapping.",
    addLabel: "Add Driver",
    searchPlaceholder: "Search drivers by name, mobile, license...",
    emptyMessage: "No drivers found",
  },
  vehicles: {
    heading: "Logistics Vehicles",
    description: "Maintain fleet records, capacity, validity, and driver mapping.",
    addLabel: "Add Vehicle",
    searchPlaceholder: "Search vehicles by number, driver, provider...",
    emptyMessage: "No vehicles found",
  },
  routes: {
    heading: "Serviceable Routes",
    description: "Manage route coverage by area, city, state, and vehicle.",
    addLabel: "Add Route",
    searchPlaceholder: "Search routes by area, city, state, vehicle...",
    emptyMessage: "No serviceable routes found",
  },
};

const actionIconButtonClass =
  "inline-flex items-center justify-center shrink-0 h-8 w-8 min-h-8 min-w-8 p-0";

function FormLabel({ children, required }) {
  return (
    <label className="text-sm font-semibold text-gray-800 block">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : null}
    </label>
  );
}

function FormSection({ title, description, children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <div className="border-b border-gray-200 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {description ? <p className="text-xs text-gray-500 mt-0.5">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-lg font-semibold text-gray-900 break-words">{value ?? "—"}</dd>
    </div>
  );
}

function ListActions({ onView, onEdit, canEdit }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        type="button"
        variant="default"
        onClick={onView}
        title="View details"
        className={`${actionIconButtonClass} bg-black text-white hover:bg-gray-800 border border-black`}
      >
        <Eye className="h-4 w-4 shrink-0" />
      </Button>
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          onClick={onEdit}
          title="Edit"
          className={`${actionIconButtonClass} border-blue-600 text-blue-600 hover:bg-blue-50`}
        >
          <Pencil className="h-4 w-4 shrink-0" />
        </Button>
      ) : null}
    </div>
  );
}

const getBackendUrl = () => {
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  return import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
};

const authHeaders = () => {
  const token = AuthService.getAccessToken();
  if (!token) throw new Error("No authentication token found");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const emptyProviderForm = () => ({
  id: null,
  provider_type: "company",
  company_name: "",
  contact_person: "",
  mobile_number: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  remarks: "",
  is_active: true,
});

const emptyDriverForm = () => ({
  id: null,
  driver_type: "individual",
  provider_id: "",
  driver_name: "",
  mobile_number: "",
  alternate_mobile: "",
  license_number: "",
  license_expiry: "",
  aadhaar_number: "",
  address: "",
  remarks: "",
  is_active: true,
  vehicle_id: "",
});

const emptyVehicleForm = () => ({
  id: null,
  owner_type: "individual",
  provider_id: "",
  driver_id: "",
  vehicle_number: "",
  vehicle_type: "truck",
  capacity: "",
  capacity_unit: "mt",
  insurance_expiry: "",
  permit_expiry: "",
  fitness_expiry: "",
  pollution_expiry: "",
  remarks: "",
  status: "available",
  create_new_driver: false,
  new_driver: emptyDriverForm(),
});

const emptyRouteForm = () => ({
  id: null,
  vehicle_id: "",
  area_name: "",
  city: "",
  state: "",
  is_active: true,
});

async function parseApiResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const looksLikeHtml = text.trimStart().startsWith("<");

  if (!text) {
    throw new Error(
      response.ok
        ? "Empty response from server"
        : `Request failed (HTTP ${response.status})`
    );
  }

  if (looksLikeHtml || (!contentType.includes("application/json") && !text.trimStart().startsWith("{") && !text.trimStart().startsWith("["))) {
    throw new Error(
      response.status === 404
        ? "Logistics API not found on this server. Use the tech server URL in VITE_BASE_URL (logistics is not deployed on live GrainPro yet)."
        : `Server returned HTML instead of JSON (HTTP ${response.status}). Check VITE_BASE_URL.`
    );
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response from server");
  }

  if (!response.ok) {
    throw new Error(result.message || `HTTP error! status: ${response.status}`);
  }
  return result;
}

async function apiGet(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      qs.set(key, String(value));
    }
  });
  const url = `${getBackendUrl()}${path}${qs.toString() ? `?${qs}` : ""}`;
  const response = await fetch(url, { method: "GET", headers: authHeaders() });
  return parseApiResponse(response);
}

async function apiPost(path, payload) {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return parseApiResponse(response);
}

function matchesSearch(item, term, fields) {
  if (!term) return true;
  const haystack = fields
    .map((field) => item?.[field])
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function StatusBadge({ active }) {
  return (
    <Badge variant={active ? "default" : "secondary"} className={active ? "bg-green-600" : ""}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export default function LogisticsManagement({ defaultTab = "providers" }) {
  const safeDefaultTab = PAGE_TYPES.some((tab) => tab.id === defaultTab) ? defaultTab : "providers";
  const [activeTab, setActiveTab] = useState(safeDefaultTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const [providerForm, setProviderForm] = useState(emptyProviderForm());
  const [driverForm, setDriverForm] = useState(emptyDriverForm());
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm());
  const [routeForm, setRouteForm] = useState(emptyRouteForm());

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const {
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    isLoading: permissionsLoading,
  } = useUserPermissions();

  const canRead = hasReadPermission(MODULE_ALIAS);
  const canCreate = hasCreatePermission(MODULE_ALIAS);
  const canUpdate = hasUpdatePermission(MODULE_ALIAS);

  const providersQuery = useQuery({
    queryKey: ["logistics-providers"],
    queryFn: () => apiGet("/api/logistics/providers/", { per_page: 100 }),
    enabled: canRead && activeTab === "providers",
    retry: 1,
  });

  const driversQuery = useQuery({
    queryKey: ["logistics-drivers"],
    queryFn: () => apiGet("/api/logistics/drivers/", { per_page: 100 }),
    enabled: canRead && (activeTab === "drivers" || isDialogOpen || isViewOpen),
    retry: 1,
  });

  const vehiclesQuery = useQuery({
    queryKey: ["logistics-vehicles"],
    queryFn: () => apiGet("/api/logistics/vehicles/", { per_page: 100 }),
    enabled: canRead && (activeTab === "vehicles" || activeTab === "routes" || isDialogOpen || isViewOpen),
    retry: 1,
  });

  const routesQuery = useQuery({
    queryKey: ["logistics-routes"],
    queryFn: () => apiGet("/api/logistics/serviceable-routes/", { per_page: 100 }),
    enabled: canRead && activeTab === "routes",
    retry: 1,
  });

  const providersForSelect = useQuery({
    queryKey: ["logistics-providers-select"],
    queryFn: () => apiGet("/api/logistics/providers/", { is_active: "true", per_page: 200 }),
    enabled: canRead && (isDialogOpen || isViewOpen),
    retry: 1,
  });

  const driversForSelect = useQuery({
    queryKey: ["logistics-drivers-select"],
    queryFn: () => apiGet("/api/logistics/drivers/", { is_active: "true", per_page: 200 }),
    enabled: canRead && isDialogOpen && (activeTab === "vehicles" || activeTab === "drivers"),
    retry: 1,
  });

  const vehiclesForSelect = useQuery({
    queryKey: ["logistics-vehicles-select"],
    queryFn: () => apiGet("/api/logistics/vehicles/", { per_page: 200 }),
    enabled: canRead && isDialogOpen && (activeTab === "routes" || activeTab === "drivers"),
    retry: 1,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["logistics-providers"] });
    queryClient.invalidateQueries({ queryKey: ["logistics-drivers"] });
    queryClient.invalidateQueries({ queryKey: ["logistics-vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["logistics-routes"] });
    queryClient.invalidateQueries({ queryKey: ["logistics-providers-select"] });
    queryClient.invalidateQueries({ queryKey: ["logistics-drivers-select"] });
    queryClient.invalidateQueries({ queryKey: ["logistics-vehicles-select"] });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ type, payload }) => {
      const endpoints = {
        providers: "/api/logistics/providers/create-update/",
        drivers: "/api/logistics/drivers/create-update/",
        vehicles: "/api/logistics/vehicles/create-update/",
        routes: "/api/logistics/serviceable-routes/create-update/",
      };
      return apiPost(endpoints[type], payload);
    },
    onSuccess: (result) => {
      invalidateAll();
      toast({ title: "Success", description: result.message || "Saved successfully" });
      setIsDialogOpen(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const searchLower = searchTerm.trim().toLowerCase();

  const providers = useMemo(
    () =>
      (providersQuery.data?.data || []).filter((item) =>
        matchesSearch(item, searchLower, [
          "company_name",
          "contact_person",
          "mobile_number",
          "email",
          "city",
          "state",
          "pincode",
          "provider_type",
          "provider_type_display",
        ])
      ),
    [providersQuery.data, searchLower]
  );

  const drivers = useMemo(
    () =>
      (driversQuery.data?.data || []).filter((item) =>
        matchesSearch(item, searchLower, [
          "driver_name",
          "mobile_number",
          "alternate_mobile",
          "license_number",
          "provider_name",
          "driver_type",
          "driver_type_display",
        ])
      ),
    [driversQuery.data, searchLower]
  );

  const vehicles = useMemo(
    () =>
      (vehiclesQuery.data?.data || []).filter((item) =>
        matchesSearch(item, searchLower, [
          "vehicle_number",
          "vehicle_type",
          "vehicle_type_display",
          "driver_name",
          "provider_name",
          "status",
          "status_display",
        ])
      ),
    [vehiclesQuery.data, searchLower]
  );

  const routes = useMemo(
    () =>
      (routesQuery.data?.data || []).filter((item) =>
        matchesSearch(item, searchLower, [
          "area_name",
          "city",
          "state",
          "vehicle_number",
          "provider_name",
          "driver_name",
        ])
      ),
    [routesQuery.data, searchLower]
  );

  const providerOptions = providersForSelect.data?.data || [];
  const driverOptions = driversForSelect.data?.data || [];
  const vehicleOptions = vehiclesForSelect.data?.data || [];

  const currentQuery = useMemo(() => {
    if (activeTab === "providers") return providersQuery;
    if (activeTab === "drivers") return driversQuery;
    if (activeTab === "vehicles") return vehiclesQuery;
    return routesQuery;
  }, [activeTab, providersQuery, driversQuery, vehiclesQuery, routesQuery]);

  useEffect(() => {
    if (PAGE_TYPES.some((tab) => tab.id === defaultTab)) {
      setActiveTab(defaultTab);
      setSearchTerm("");
    }
  }, [defaultTab]);

  const openCreate = () => {
    if (activeTab === "providers") setProviderForm(emptyProviderForm());
    if (activeTab === "drivers") setDriverForm(emptyDriverForm());
    if (activeTab === "vehicles") setVehicleForm(emptyVehicleForm());
    if (activeTab === "routes") setRouteForm(emptyRouteForm());
    setIsDialogOpen(true);
  };

  const openEdit = (item) => {
    if (activeTab === "providers") {
      setProviderForm({
        id: item.id,
        provider_type: item.provider_type || "company",
        company_name: item.company_name || "",
        contact_person: item.contact_person || "",
        mobile_number: item.mobile_number || "",
        email: item.email || "",
        address: item.address || "",
        city: item.city || "",
        state: item.state || "",
        pincode: item.pincode || "",
        remarks: item.remarks || "",
        is_active: item.is_active !== false,
      });
    } else if (activeTab === "drivers") {
      setDriverForm({
        id: item.id,
        driver_type: item.driver_type || "individual",
        provider_id: item.provider ? String(item.provider) : "",
        driver_name: item.driver_name || "",
        mobile_number: item.mobile_number || "",
        alternate_mobile: item.alternate_mobile || "",
        license_number: item.license_number || "",
        license_expiry: toIsoDate(item.license_expiry || ""),
        aadhaar_number: item.aadhaar_number || "",
        address: item.address || "",
        remarks: item.remarks || "",
        is_active: item.is_active !== false,
        vehicle_id: "",
      });
    } else if (activeTab === "vehicles") {
      setVehicleForm({
        id: item.id,
        owner_type: item.owner_type || "individual",
        provider_id: item.provider ? String(item.provider) : "",
        driver_id: item.driver ? String(item.driver) : "",
        vehicle_number: item.vehicle_number || "",
        vehicle_type: item.vehicle_type || "truck",
        capacity: item.capacity != null ? String(item.capacity) : "",
        capacity_unit: item.capacity_unit || "mt",
        insurance_expiry: toIsoDate(item.insurance_expiry || ""),
        permit_expiry: toIsoDate(item.permit_expiry || ""),
        fitness_expiry: toIsoDate(item.fitness_expiry || ""),
        pollution_expiry: toIsoDate(item.pollution_expiry || ""),
        remarks: item.remarks || "",
        status: item.status || "available",
        create_new_driver: false,
        new_driver: emptyDriverForm(),
      });
    } else {
      setRouteForm({
        id: item.id,
        vehicle_id: item.vehicle ? String(item.vehicle) : "",
        area_name: item.area_name || "",
        city: item.city || "",
        state: item.state || "",
        is_active: item.is_active !== false,
      });
    }
    setIsDialogOpen(true);
  };

  const openView = (item) => {
    setViewItem(item);
    setIsViewOpen(true);
  };

  const openEditFromView = () => {
    if (!viewItem) return;
    setIsViewOpen(false);
    openEdit(viewItem);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (activeTab === "providers") {
      if (!providerForm.company_name.trim() || !providerForm.contact_person.trim() || !providerForm.mobile_number.trim()) {
        toast({ title: "Validation Error", description: "Company name, contact person and mobile are required", variant: "destructive" });
        return;
      }
      if (!providerForm.city.trim() || !providerForm.state.trim() || !providerForm.pincode.trim()) {
        toast({ title: "Validation Error", description: "City, state and pincode are required", variant: "destructive" });
        return;
      }
      const payload = {
        ...(providerForm.id ? { id: providerForm.id } : {}),
        provider_type: providerForm.provider_type,
        company_name: providerForm.company_name.trim(),
        contact_person: providerForm.contact_person.trim(),
        mobile_number: providerForm.mobile_number.trim(),
        email: providerForm.email.trim() || null,
        address: providerForm.address.trim(),
        city: providerForm.city.trim(),
        state: providerForm.state.trim(),
        pincode: providerForm.pincode.trim(),
        remarks: providerForm.remarks.trim() || null,
        is_active: providerForm.is_active,
      };
      saveMutation.mutate({ type: "providers", payload });
      return;
    }

    if (activeTab === "drivers") {
      const driverName = onlyLetters(driverForm.driver_name, 30).trim();
      const mobile = onlyDigits(driverForm.mobile_number, 10);
      const alternateMobile = onlyDigits(driverForm.alternate_mobile, 10);
      const aadhaar = onlyDigits(driverForm.aadhaar_number, 12);
      const licenseNumber = limitText(driverForm.license_number, 20).trim();
      const licenseExpiry = toIsoDate(driverForm.license_expiry);

      if (!driverName || !mobile || !licenseNumber || !licenseExpiry) {
        toast({ title: "Validation Error", description: "Driver name, mobile, license number and expiry are required", variant: "destructive" });
        return;
      }
      if (!/^[a-zA-Z\s.'-]+$/.test(driverName)) {
        toast({ title: "Validation Error", description: "Driver name must contain letters only (max 30)", variant: "destructive" });
        return;
      }
      if (mobile.length !== 10) {
        toast({ title: "Validation Error", description: "Mobile number must be exactly 10 digits", variant: "destructive" });
        return;
      }
      if (alternateMobile && alternateMobile.length !== 10) {
        toast({ title: "Validation Error", description: "Alternate mobile must be exactly 10 digits", variant: "destructive" });
        return;
      }
      if (aadhaar && aadhaar.length !== 12) {
        toast({ title: "Validation Error", description: "Aadhaar must be exactly 12 digits", variant: "destructive" });
        return;
      }
      if (licenseNumber.length > 20) {
        toast({ title: "Validation Error", description: "License number must be at most 20 characters", variant: "destructive" });
        return;
      }
      if (driverForm.driver_type === "provider_driver" && !driverForm.provider_id) {
        toast({ title: "Validation Error", description: "Provider is required for provider drivers", variant: "destructive" });
        return;
      }
      const payload = {
        ...(driverForm.id ? { id: driverForm.id } : {}),
        driver_type: driverForm.driver_type,
        provider_id: driverForm.provider_id ? Number(driverForm.provider_id) : null,
        driver_name: driverName,
        mobile_number: mobile,
        alternate_mobile: alternateMobile || null,
        license_number: licenseNumber,
        license_expiry: licenseExpiry,
        aadhaar_number: aadhaar || null,
        address: driverForm.address.trim(),
        remarks: driverForm.remarks.trim() || null,
        is_active: driverForm.is_active,
        ...(driverForm.vehicle_id ? { vehicle_id: Number(driverForm.vehicle_id) } : {}),
      };
      saveMutation.mutate({ type: "drivers", payload });
      return;
    }

    if (activeTab === "vehicles") {
      const vehicleNumber = limitText(vehicleForm.vehicle_number.trim().toUpperCase(), 10);
      if (!vehicleNumber || !vehicleForm.capacity) {
        toast({ title: "Validation Error", description: "Vehicle number and capacity are required", variant: "destructive" });
        return;
      }
      if (vehicleNumber.length > 10) {
        toast({ title: "Validation Error", description: "Vehicle number must be at most 10 characters", variant: "destructive" });
        return;
      }
      if (vehicleForm.owner_type === "provider" && !vehicleForm.provider_id) {
        toast({ title: "Validation Error", description: "Provider is required when owner type is provider", variant: "destructive" });
        return;
      }
      if (!vehicleForm.id && !vehicleForm.create_new_driver && !vehicleForm.driver_id) {
        toast({ title: "Validation Error", description: "Select a driver or create a new one", variant: "destructive" });
        return;
      }
      if (vehicleForm.create_new_driver) {
        const nd = vehicleForm.new_driver;
        if (!nd.driver_name.trim() || !nd.mobile_number.trim() || !nd.license_number.trim() || !nd.license_expiry) {
          toast({ title: "Validation Error", description: "New driver details are incomplete", variant: "destructive" });
          return;
        }
      }

      const payload = {
        ...(vehicleForm.id ? { id: vehicleForm.id } : {}),
        owner_type: vehicleForm.owner_type,
        provider_id: vehicleForm.provider_id ? Number(vehicleForm.provider_id) : null,
        vehicle_number: vehicleNumber,
        vehicle_type: vehicleForm.vehicle_type,
        capacity: vehicleForm.capacity,
        capacity_unit: vehicleForm.capacity_unit,
        insurance_expiry: toIsoDate(vehicleForm.insurance_expiry) || null,
        permit_expiry: toIsoDate(vehicleForm.permit_expiry) || null,
        fitness_expiry: toIsoDate(vehicleForm.fitness_expiry) || null,
        pollution_expiry: toIsoDate(vehicleForm.pollution_expiry) || null,
        remarks: vehicleForm.remarks.trim() || null,
        status: vehicleForm.status,
      };

      if (vehicleForm.create_new_driver) {
        const nd = vehicleForm.new_driver;
        payload.driver = {
          driver_type: nd.driver_type || "individual",
          provider_id: nd.provider_id ? Number(nd.provider_id) : (vehicleForm.provider_id ? Number(vehicleForm.provider_id) : null),
          driver_name: nd.driver_name.trim(),
          mobile_number: nd.mobile_number.trim(),
          alternate_mobile: nd.alternate_mobile.trim() || null,
          license_number: nd.license_number.trim(),
          license_expiry: nd.license_expiry,
          aadhaar_number: nd.aadhaar_number.trim() || null,
          address: nd.address.trim(),
          remarks: nd.remarks.trim() || null,
          is_active: true,
        };
      } else if (vehicleForm.driver_id) {
        payload.driver_id = Number(vehicleForm.driver_id);
      }

      saveMutation.mutate({ type: "vehicles", payload });
      return;
    }

    if (!routeForm.vehicle_id || !routeForm.area_name.trim() || !routeForm.city.trim() || !routeForm.state.trim()) {
      toast({ title: "Validation Error", description: "Vehicle, area, city and state are required", variant: "destructive" });
      return;
    }
    const areaName = onlyLetters(routeForm.area_name, 20).trim();
    const city = onlyLetters(routeForm.city, 20).trim();
    const state = onlyLetters(routeForm.state, 20).trim();
    if (!areaName || !city || !state) {
      toast({ title: "Validation Error", description: "Area, city and state must contain letters only (max 20)", variant: "destructive" });
      return;
    }
    const payload = {
      ...(routeForm.id ? { id: routeForm.id } : {}),
      vehicle_id: Number(routeForm.vehicle_id),
      area_name: areaName,
      city,
      state,
      is_active: routeForm.is_active,
    };
    saveMutation.mutate({ type: "routes", payload });
  };

  const dialogTitle = () => {
    const editing =
      (activeTab === "providers" && providerForm.id) ||
      (activeTab === "drivers" && driverForm.id) ||
      (activeTab === "vehicles" && vehicleForm.id) ||
      (activeTab === "routes" && routeForm.id);
    const labels = {
      providers: "Provider",
      drivers: "Driver",
      vehicles: "Vehicle",
      routes: "Serviceable Route",
    };
    return `${editing ? "Edit" : "Add"} ${labels[activeTab]}`;
  };

  const pageMeta = TAB_DETAILS[activeTab] || TAB_DETAILS.providers;
  const PageIcon = PAGE_TYPES.find((tab) => tab.id === activeTab)?.icon || Truck;

  const listCount =
    activeTab === "providers"
      ? providers.length
      : activeTab === "drivers"
        ? drivers.length
        : activeTab === "vehicles"
          ? vehicles.length
          : routes.length;

  const renderListing = () => {
    if (activeTab === "providers") {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Company</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                  {pageMeta.emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              providers.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900">{item.company_name}</TableCell>
                  <TableCell>{item.provider_type_display || item.provider_type}</TableCell>
                  <TableCell>
                    <div className="text-sm">{item.contact_person}</div>
                    <div className="text-xs text-gray-500">{item.mobile_number}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.city}, {item.state} - {item.pincode}
                  </TableCell>
                  <TableCell><StatusBadge active={item.is_active} /></TableCell>
                  <TableCell className="text-right">
                    <ListActions
                      onView={() => openView(item)}
                      onEdit={() => openEdit(item)}
                      canEdit={canUpdate}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      );
    }

    if (activeTab === "drivers") {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Driver</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-10">
                  {pageMeta.emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900">{item.driver_name}</TableCell>
                  <TableCell>{item.driver_type_display || item.driver_type}</TableCell>
                  <TableCell>{item.mobile_number}</TableCell>
                  <TableCell>
                    <div className="text-sm">{item.license_number}</div>
                    <div className="text-xs text-gray-500">Exp: {item.license_expiry || "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{item.provider_name || "—"}</TableCell>
                  <TableCell><StatusBadge active={item.is_active} /></TableCell>
                  <TableCell className="text-right">
                    <ListActions
                      onView={() => openView(item)}
                      onEdit={() => openEdit(item)}
                      canEdit={canUpdate}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      );
    }

    if (activeTab === "vehicles") {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead>Vehicle No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-10">
                  {pageMeta.emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900">{item.vehicle_number}</TableCell>
                  <TableCell>
                    <div className="text-sm">{item.vehicle_type_display || item.vehicle_type}</div>
                    <div className="text-xs text-gray-500">{item.owner_type_display || item.owner_type}</div>
                  </TableCell>
                  <TableCell>
                    {item.capacity} {item.capacity_unit_display || item.capacity_unit}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{item.driver_name || "—"}</div>
                    <div className="text-xs text-gray-500">{item.driver_mobile || ""}</div>
                  </TableCell>
                  <TableCell className="text-sm">{item.provider_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.status_display || item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ListActions
                      onView={() => openView(item)}
                      onEdit={() => openEdit(item)}
                      canEdit={canUpdate}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80">
            <TableHead>Area</TableHead>
            <TableHead>City</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                {pageMeta.emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            routes.map((item) => (
              <TableRow key={item.id} className="hover:bg-gray-50">
                <TableCell className="font-medium text-gray-900">{item.area_name}</TableCell>
                <TableCell>{item.city}</TableCell>
                <TableCell>{item.state}</TableCell>
                <TableCell>{item.vehicle_number || "—"}</TableCell>
                <TableCell><StatusBadge active={item.is_active} /></TableCell>
                <TableCell className="text-right">
                  <ListActions
                    onView={() => openView(item)}
                    onEdit={() => openEdit(item)}
                    canEdit={canUpdate}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    );
  };

  const renderViewContent = () => {
    if (!viewItem) return null;

    if (activeTab === "providers") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailField label="Company Name" value={viewItem.company_name} />
          <DetailField label="Provider Type" value={viewItem.provider_type_display || viewItem.provider_type} />
          <DetailField label="Contact Person" value={viewItem.contact_person} />
          <DetailField label="Mobile" value={viewItem.mobile_number} />
          <DetailField label="Email" value={viewItem.email} />
          <DetailField label="Address" value={viewItem.address} />
          <DetailField label="City" value={viewItem.city} />
          <DetailField label="State" value={viewItem.state} />
          <DetailField label="Pincode" value={viewItem.pincode} />
          <DetailField label="Remarks" value={viewItem.remarks} />
          <DetailField label="Status" value={viewItem.is_active ? "Active" : "Inactive"} />
        </div>
      );
    }

    if (activeTab === "drivers") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailField label="Driver Name" value={viewItem.driver_name} />
          <DetailField label="Driver Type" value={viewItem.driver_type_display || viewItem.driver_type} />
          <DetailField label="Mobile" value={viewItem.mobile_number} />
          <DetailField label="Alternate Mobile" value={viewItem.alternate_mobile} />
          <DetailField label="License Number" value={viewItem.license_number} />
          <DetailField label="License Expiry" value={viewItem.license_expiry} />
          <DetailField label="Aadhaar" value={viewItem.aadhaar_number} />
          <DetailField label="Provider" value={viewItem.provider_name} />
          <DetailField label="Address" value={viewItem.address} />
          <DetailField label="Remarks" value={viewItem.remarks} />
          <DetailField label="Status" value={viewItem.is_active ? "Active" : "Inactive"} />
        </div>
      );
    }

    if (activeTab === "vehicles") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailField label="Vehicle Number" value={viewItem.vehicle_number} />
          <DetailField label="Vehicle Type" value={viewItem.vehicle_type_display || viewItem.vehicle_type} />
          <DetailField label="Owner Type" value={viewItem.owner_type_display || viewItem.owner_type} />
          <DetailField
            label="Capacity"
            value={`${viewItem.capacity ?? "—"} ${viewItem.capacity_unit_display || viewItem.capacity_unit || ""}`.trim()}
          />
          <DetailField label="Driver" value={viewItem.driver_name} />
          <DetailField label="Driver Mobile" value={viewItem.driver_mobile} />
          <DetailField label="Provider" value={viewItem.provider_name} />
          <DetailField label="Insurance Expiry" value={viewItem.insurance_expiry} />
          <DetailField label="Permit Expiry" value={viewItem.permit_expiry} />
          <DetailField label="Fitness Expiry" value={viewItem.fitness_expiry} />
          <DetailField label="Pollution Expiry" value={viewItem.pollution_expiry} />
          <DetailField label="Status" value={viewItem.status_display || viewItem.status} />
          <DetailField label="Remarks" value={viewItem.remarks} />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DetailField label="Area Name" value={viewItem.area_name} />
        <DetailField label="City" value={viewItem.city} />
        <DetailField label="State" value={viewItem.state} />
        <DetailField label="Vehicle" value={viewItem.vehicle_number} />
        <DetailField label="Status" value={viewItem.is_active ? "Active" : "Inactive"} />
      </div>
    );
  };

  if (permissionsLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        )}
        <div className="app-main-content flex items-center justify-center">
          <CommonLoader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        )}
        <div className="app-main-content flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
            <Truck className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">You do not have permission to view Logistics Management.</p>
            <Button onClick={() => window.history.back()} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className="app-main-content">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <PageIcon className="h-6 w-6 text-gray-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{pageMeta.heading}</h1>
                  <p className="text-sm text-gray-500 hidden sm:block">{pageMeta.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => currentQuery.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {canCreate && (
                <Button onClick={openCreate} className="bg-black hover:bg-gray-900 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  {pageMeta.addLabel}
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full max-w-md">
                  <FormLabel>Search</FormLabel>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      className="pl-9 h-9"
                      placeholder={pageMeta.searchPlaceholder}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {pageMeta.heading} ({listCount})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {currentQuery.isLoading ? (
                  <div className="flex justify-center py-16">
                    <CommonLoader text="Loading..." />
                  </div>
                ) : currentQuery.error ? (
                  <div className="py-10 text-center text-red-600">{currentQuery.error.message}</div>
                ) : (
                  <div className="overflow-x-auto">{renderListing()}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle()}</DialogTitle>
            <DialogDescription>Fill in the details section wise below.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === "providers" && (
              <>
                <FormSection title="Basic Information" description="Company and provider classification">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Provider Type</FormLabel>
                      <Select value={providerForm.provider_type} onValueChange={(v) => setProviderForm((p) => ({ ...p, provider_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROVIDER_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FormLabel required>Company Name</FormLabel>
                      <Input
                        value={providerForm.company_name}
                        maxLength={30}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                          setProviderForm((p) => ({
                            ...p,
                            company_name: value,
                          }));
                        }}
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Contact Details" description="Primary contact information">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <FormLabel required>Contact Person</FormLabel>
                      <Input
                        value={providerForm.contact_person}
                        maxLength={30}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                          setProviderForm((p) => ({
                            ...p,
                            contact_person: value,
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <FormLabel required>Mobile</FormLabel>
                      <Input
                        value={providerForm.mobile_number}
                        maxLength={10}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setProviderForm((p) => ({
                            ...p,
                            mobile_number: value,
                          }));
                        }}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FormLabel>Email</FormLabel>
                      <Input maxLength={40} type="email" value={providerForm.email} onChange={(e) => setProviderForm((p) => ({ ...p, email: e.target.value }))} />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Location" description="Address and geographic details">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">


                    <div>
                      <FormLabel required>City</FormLabel>
                      <Input
                        value={providerForm.city}
                        maxLength={20}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                          setProviderForm((p) => ({
                            ...p,
                            city: value,
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <FormLabel required>State</FormLabel>
                      <Input
                        value={providerForm.state}
                        maxLength={20}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                          setProviderForm((p) => ({
                            ...p,
                            state: value,
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <FormLabel required>Pincode</FormLabel>
                      <Input
                        value={providerForm.pincode}
                        maxLength={6}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setProviderForm((p) => ({
                            ...p,
                            pincode: value,
                          }));
                        }}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <FormLabel>Address</FormLabel>
                      <Textarea value={providerForm.address} onChange={(e) => setProviderForm((p) => ({ ...p, address: e.target.value }))} />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Additional" description="Remarks and status">
                  <div>
                    <FormLabel>Remarks</FormLabel>
                    <Textarea value={providerForm.remarks} onChange={(e) => setProviderForm((p) => ({ ...p, remarks: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={providerForm.is_active} onCheckedChange={(v) => setProviderForm((p) => ({ ...p, is_active: v }))} />
                    <FormLabel>Active</FormLabel>
                  </div>
                </FormSection>
              </>
            )}

            {activeTab === "drivers" && (
              <>
                <FormSection title="Driver Profile" description="Basic driver identification">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Driver Type</FormLabel>
                      <Select value={driverForm.driver_type} onValueChange={(v) => setDriverForm((p) => ({ ...p, driver_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Individual Owner</SelectItem>
                          <SelectItem value="provider_driver">Provider Driver</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {driverForm.driver_type === "provider_driver" && (
                      <div>
                        <FormLabel required>Provider</FormLabel>
                        <Select value={driverForm.provider_id} onValueChange={(v) => setDriverForm((p) => ({ ...p, provider_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                          <SelectContent>
                            {providerOptions.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <FormLabel required>Driver Name</FormLabel>
                      <Input
                        value={driverForm.driver_name}
                        maxLength={30}
                        placeholder="Enter driver name"
                        onChange={(e) =>
                          setDriverForm((p) => ({
                            ...p,
                            driver_name: onlyLetters(e.target.value, 30),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FormLabel required>Mobile</FormLabel>
                      <Input
                        value={driverForm.mobile_number}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="Enter here"
                        onChange={(e) =>
                          setDriverForm((p) => ({
                            ...p,
                            mobile_number: onlyDigits(e.target.value, 10),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FormLabel>Alternate Mobile</FormLabel>
                      <Input
                        value={driverForm.alternate_mobile}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="Enter here"
                        onChange={(e) =>
                          setDriverForm((p) => ({
                            ...p,
                            alternate_mobile: onlyDigits(e.target.value, 10),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FormLabel>Aadhaar</FormLabel>
                      <Input
                        value={driverForm.aadhaar_number}
                        inputMode="numeric"
                        maxLength={12}
                        placeholder="12-digit Aadhaar"
                        onChange={(e) =>
                          setDriverForm((p) => ({
                            ...p,
                            aadhaar_number: onlyDigits(e.target.value, 12),
                          }))
                        }
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="License & Mapping" description="License validity and vehicle assignment">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <FormLabel required>License Number</FormLabel>
                      <Input
                        value={driverForm.license_number}
                        maxLength={20}
                        placeholder="Enter here"
                        onChange={(e) =>
                          setDriverForm((p) => ({
                            ...p,
                            license_number: limitText(e.target.value.toUpperCase(), 20),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FormLabel required>License Expiry</FormLabel>
                      <ThemeDateField
                        value={driverForm.license_expiry}
                        onChange={(iso) => setDriverForm((p) => ({ ...p, license_expiry: iso }))}
                        placeholder="Select license expiry"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FormLabel>Map to Vehicle (optional)</FormLabel>
                      <Select value={driverForm.vehicle_id || "none"} onValueChange={(v) => setDriverForm((p) => ({ ...p, vehicle_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {vehicleOptions.map((v) => (
                            <SelectItem key={v.id} value={String(v.id)}>{v.vehicle_number}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Additional" description="Address, remarks and status">
                  <div>
                    <FormLabel>Address</FormLabel>
                    <Textarea value={driverForm.address} onChange={(e) => setDriverForm((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div>
                    <FormLabel>Remarks</FormLabel>
                    <Textarea value={driverForm.remarks} onChange={(e) => setDriverForm((p) => ({ ...p, remarks: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={driverForm.is_active} onCheckedChange={(v) => setDriverForm((p) => ({ ...p, is_active: v }))} />
                    <FormLabel>Active</FormLabel>
                  </div>
                </FormSection>
              </>
            )}

            {activeTab === "vehicles" && (
              <>
                <FormSection title="Vehicle Information" description="Registration and classification">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Owner Type</FormLabel>
                      <Select value={vehicleForm.owner_type} onValueChange={(v) => setVehicleForm((p) => ({ ...p, owner_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Individual (no provider)</SelectItem>
                          <SelectItem value="provider">Provider</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {vehicleForm.owner_type === "provider" && (
                      <div>
                        <FormLabel required>Provider</FormLabel>
                        <Select value={vehicleForm.provider_id} onValueChange={(v) => setVehicleForm((p) => ({ ...p, provider_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                          <SelectContent>
                            {providerOptions.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <FormLabel required>Vehicle Number</FormLabel>
                      <Input
                        value={vehicleForm.vehicle_number}
                        maxLength={10}
                        placeholder="Max 10 characters"
                        onChange={(e) =>
                          setVehicleForm((p) => ({
                            ...p,
                            vehicle_number: limitText(e.target.value.toUpperCase(), 10),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FormLabel>Vehicle Type</FormLabel>
                      <SearchableSelect
                        value={vehicleForm.vehicle_type}
                        onChange={(v) => setVehicleForm((p) => ({ ...p, vehicle_type: v }))}
                        options={VEHICLE_TYPES}
                        placeholder="Select vehicle type"
                        searchPlaceholder="Search vehicle type..."
                        emptyMessage="No vehicle type found."
                      />
                    </div>
                    <div>
                      <FormLabel required>Capacity in Tons </FormLabel>
                      <Input
                        maxLength={2}
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter capacity"
                        value={vehicleForm.capacity}
                        onChange={(e) => {
                          const next = e.target.value.replace(/[^\d.]/g, "");
                          const parts = next.split(".");
                          const sanitized =
                            parts.length > 2
                              ? `${parts[0]}.${parts.slice(1).join("")}`
                              : next;
                          setVehicleForm((p) => ({ ...p, capacity: sanitized }));
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </div>
                    <div>
                      <FormLabel>Capacity Unit</FormLabel>
                      <SearchableSelect
                        value={vehicleForm.capacity_unit}
                        onChange={(v) => setVehicleForm((p) => ({ ...p, capacity_unit: v }))}
                        options={CAPACITY_UNITS}
                        placeholder="Select capacity unit"
                        searchPlaceholder="Search capacity unit..."
                        emptyMessage="No capacity unit found."
                      />
                    </div>
                    <div>
                      <FormLabel>Status</FormLabel>
                      <Select value={vehicleForm.status} onValueChange={(v) => setVehicleForm((p) => ({ ...p, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VEHICLE_STATUSES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Document Validity" description="Insurance, permit and fitness dates">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Insurance Expiry</FormLabel>
                      <ThemeDateField
                        value={vehicleForm.insurance_expiry}
                        onChange={(iso) => setVehicleForm((p) => ({ ...p, insurance_expiry: iso }))}
                        placeholder="Select insurance expiry"
                      />
                    </div>
                    <div>
                      <FormLabel>Permit Expiry</FormLabel>
                      <ThemeDateField
                        value={vehicleForm.permit_expiry}
                        onChange={(iso) => setVehicleForm((p) => ({ ...p, permit_expiry: iso }))}
                        placeholder="Select permit expiry"
                      />
                    </div>
                    <div>
                      <FormLabel>Fitness Expiry</FormLabel>
                      <ThemeDateField
                        value={vehicleForm.fitness_expiry}
                        onChange={(iso) => setVehicleForm((p) => ({ ...p, fitness_expiry: iso }))}
                        placeholder="Select fitness expiry"
                      />
                    </div>
                    <div>
                      <FormLabel>Pollution Expiry</FormLabel>
                      <ThemeDateField
                        value={vehicleForm.pollution_expiry}
                        onChange={(iso) => setVehicleForm((p) => ({ ...p, pollution_expiry: iso }))}
                        placeholder="Select pollution expiry"
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Driver Mapping" description="Assign an existing driver or create a new one">
                  {!vehicleForm.id && (
                    <div className="flex items-center gap-2 pb-1">
                      <Switch
                        checked={vehicleForm.create_new_driver}
                        onCheckedChange={(v) => setVehicleForm((p) => ({ ...p, create_new_driver: v }))}
                      />
                      <span className="text-sm text-gray-700">Create new driver</span>
                    </div>
                  )}

                  {!vehicleForm.create_new_driver ? (
                    <div>
                      <FormLabel required={!vehicleForm.id}>Driver</FormLabel>
                      <SearchableSelect
                        value={vehicleForm.driver_id}
                        onChange={(v) => setVehicleForm((p) => ({ ...p, driver_id: v }))}
                        options={driverOptions.map((d) => ({
                          value: String(d.id),
                          label: `${d.driver_name} (${d.mobile_number})`,
                        }))}
                        placeholder="Select driver"
                        searchPlaceholder="Search driver..."
                        emptyMessage="No drivers found."
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <FormLabel required>Driver Name</FormLabel>
                        <Input
                          value={vehicleForm.new_driver.driver_name}
                          maxLength={30}
                          onChange={(e) =>
                            setVehicleForm((p) => ({
                              ...p,
                              new_driver: {
                                ...p.new_driver,
                                driver_name: onlyLetters(e.target.value, 30),
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <FormLabel required>Mobile</FormLabel>
                        <Input
                          value={vehicleForm.new_driver.mobile_number}
                          inputMode="numeric"
                          maxLength={10}
                          onChange={(e) =>
                            setVehicleForm((p) => ({
                              ...p,
                              new_driver: {
                                ...p.new_driver,
                                mobile_number: onlyDigits(e.target.value, 10),
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <FormLabel required>License Number</FormLabel>
                        <Input
                          value={vehicleForm.new_driver.license_number}
                          maxLength={20}
                          onChange={(e) =>
                            setVehicleForm((p) => ({
                              ...p,
                              new_driver: {
                                ...p.new_driver,
                                license_number: limitText(e.target.value, 20),
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <FormLabel required>License Expiry</FormLabel>
                        <ThemeDateField
                          value={vehicleForm.new_driver.license_expiry}
                          onChange={(iso) =>
                            setVehicleForm((p) => ({
                              ...p,
                              new_driver: { ...p.new_driver, license_expiry: iso },
                            }))
                          }
                          placeholder="Select license expiry"
                        />
                      </div>
                    </div>
                  )}
                </FormSection>

                <FormSection title="Additional" description="Remarks">
                  <div>
                    <FormLabel>Remarks</FormLabel>
                    <Textarea value={vehicleForm.remarks} onChange={(e) => setVehicleForm((p) => ({ ...p, remarks: e.target.value }))} />
                  </div>
                </FormSection>
              </>
            )}

            {activeTab === "routes" && (
              <>
                <FormSection title="Route Details" description="Serviceable area and vehicle mapping">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <FormLabel required>Vehicle</FormLabel>
                      <SearchableSelect
                        value={routeForm.vehicle_id}
                        onChange={(v) => setRouteForm((p) => ({ ...p, vehicle_id: v }))}
                        options={vehicleOptions.map((v) => ({
                          value: String(v.id),
                          label: v.vehicle_number,
                        }))}
                        placeholder="Select vehicle"
                        searchPlaceholder="Search vehicle..."
                        emptyMessage="No vehicles found."
                      />
                    </div>
                    <div>
                      <FormLabel required>Area Name</FormLabel>
                      <Input
                        value={routeForm.area_name}
                        maxLength={20}
                        placeholder="Enter here"
                        onChange={(e) =>
                          setRouteForm((p) => ({
                            ...p,
                            area_name: onlyLetters(e.target.value, 20),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FormLabel required>City</FormLabel>
                      <Input
                        value={routeForm.city}
                        maxLength={20}
                        placeholder="Enter here"
                        onChange={(e) =>
                          setRouteForm((p) => ({
                            ...p,
                            city: onlyLetters(e.target.value, 20),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FormLabel required>State</FormLabel>
                      <Input
                        value={routeForm.state}
                        maxLength={20}
                        placeholder="Enter here"
                        onChange={(e) =>
                          setRouteForm((p) => ({
                            ...p,
                            state: onlyLetters(e.target.value, 20),
                          }))
                        }
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Status" description="Route availability">
                  <div className="flex items-center gap-2">
                    <Switch checked={routeForm.is_active} onCheckedChange={(v) => setRouteForm((p) => ({ ...p, is_active: v }))} />
                    <FormLabel>Active</FormLabel>
                  </div>
                </FormSection>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-black hover:bg-gray-900 text-white min-w-[6rem]"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
            <DialogDescription>{pageMeta.heading}</DialogDescription>
          </DialogHeader>
          <div className="py-2">{renderViewContent()}</div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                onClick={openEditFromView}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
