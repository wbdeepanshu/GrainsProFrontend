import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import {
  Menu,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FilterX,
  CheckCircle2,
  Clock,
  User,
  Users,
  Layers,
  SlidersHorizontal,
  Building,
  MapPin,
  Store,
  CreditCard,
  FileText,
  Calendar,
  X,
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useIsMobile } from "../hooks/use-mobile";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 50;

const LEDGER_TYPE_OPTIONS = [
  { value: "SUNDRY DEBTORS", label: "Sundry Debtor" },
  { value: "SUNDRY CREDITORS", label: "Sundry Creditor" },
  { value: "BOTH", label: "Both" },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
];

const LEDGER_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  ...LEDGER_TYPE_OPTIONS,
];

const WEEK_OFF_OPTIONS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PARTY_PROFILE_PENDING_FIELDS = [
  { value: "taxation_type", label: "Taxation Type" },
  { value: "customer_type", label: "Customer Type" },
  { value: "address", label: "Address" },
  { value: "contact_number", label: "Contact Number" },
  { value: "gst_number", label: "GST Number" },
  { value: "pan_number", label: "PAN Number" },
  { value: "religion", label: "Religion" },
  { value: "exact_location", label: "Exact Location" },
];

const emptyMoreFiltersDraft = {
  parent: null,
  branchFilter: null,
  isActive: "all",
  areaGroupIds: [],
  ledgerType: null,
  accountType: "all",
  createdByIds: [],
  businessTypeIds: [],
  creditTypeIds: [],
  categoryTypeIds: [],
  religions: [],
  weekOffs: [],
};

const normalizeLedgerTypeValue = (ledgerType, isSupplierFallback) => {
  const raw = String(ledgerType ?? "").trim();
  const normalized = raw.toLowerCase();
  if (
    ["sundry debtors", "sundry debtor", "customer", "customers", "debtor", "debtors"].includes(normalized)
  ) {
    return "SUNDRY DEBTORS";
  }
  if (
    ["sundry creditors", "sundry creditor", "supplier", "suppliers", "creditor", "creditors"].includes(
      normalized
    )
  ) {
    return "SUNDRY CREDITORS";
  }
  if (normalized === "both") return "BOTH";
  if (raw.toUpperCase() === "SUNDRY DEBTORS") return "SUNDRY DEBTORS";
  if (raw.toUpperCase() === "SUNDRY CREDITORS") return "SUNDRY CREDITORS";
  if (raw.toUpperCase() === "BOTH") return "BOTH";
  if (isSupplierFallback === true) return "SUNDRY CREDITORS";
  if (isSupplierFallback === false) return "SUNDRY DEBTORS";
  return raw || "SUNDRY DEBTORS";
};

const formatLedgerTypeLabel = (ledgerType, isSupplierFallback) => {
  const canonical = normalizeLedgerTypeValue(ledgerType, isSupplierFallback);
  if (canonical === "SUNDRY DEBTORS") return "Sundry Debtor";
  if (canonical === "SUNDRY CREDITORS") return "Sundry Creditor";
  if (canonical === "BOTH") return "Both";
  return ledgerType ? String(ledgerType) : "—";
};

const normalizeAccountTypeValue = (accountType) => {
  const raw = String(accountType ?? "").trim();
  if (!raw || raw.toLowerCase() === "none" || raw.toLowerCase() === "null") return "none";
  const upper = raw.toUpperCase();
  if (upper === "ASSET" || upper === "LIABILITY") return upper;
  return "none";
};

const formatAccountTypeLabel = (accountType) => {
  const normalized = normalizeAccountTypeValue(accountType);
  if (normalized === "ASSET") return "Asset";
  if (normalized === "LIABILITY") return "Liability";
  return "None";
};

const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p += 1) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("...");
  if (total > 1) pages.push(total);
  return pages;
};

export default function AdditionalLedgers() {
  const userData = AuthService.getUserData();
  const rawTallyEnabled =
    userData?.is_tally_enabled ??
    userData?.user_info?.is_tally_enabled ??
    userData?.organization?.is_tally_enabled;
  const isTallyEnabled = !(
    rawTallyEnabled === false ||
    rawTallyEnabled === 0 ||
    rawTallyEnabled === "0" ||
    rawTallyEnabled === "false" ||
    rawTallyEnabled === "False"
  );

  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedIsSupplier, setSelectedIsSupplier] = useState(null);
  const [selectedAccountTypeFilter, setSelectedAccountTypeFilter] = useState("all");
  const [selectedIsActive, setSelectedIsActive] = useState("all");
  const [selectedIsTallySync, setSelectedIsTallySync] = useState(null);
  const [selectedPendingField, setSelectedPendingField] = useState(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(null);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [selectedAreaGroupIds, setSelectedAreaGroupIds] = useState([]);
  const [selectedCreatedByIds, setSelectedCreatedByIds] = useState([]);
  const [selectedBusinessTypeIds, setSelectedBusinessTypeIds] = useState([]);
  const [selectedCreditTypeIds, setSelectedCreditTypeIds] = useState([]);
  const [selectedCategoryTypeIds, setSelectedCategoryTypeIds] = useState([]);
  const [selectedReligions, setSelectedReligions] = useState([]);
  const [selectedWeekOffs, setSelectedWeekOffs] = useState([]);
  const [moreFiltersDraft, setMoreFiltersDraft] = useState({ ...emptyMoreFiltersDraft });
  const [selectedLedgerIds, setSelectedLedgerIds] = useState([]);
  const [isBulkTypeDialogOpen, setIsBulkTypeDialogOpen] = useState(false);
  const [bulkLedgerType, setBulkLedgerType] = useState("SUNDRY DEBTORS");
  const [bulkAccountType, setBulkAccountType] = useState("none");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (selectedParent) params.append("parent", selectedParent);
    if (selectedIsSupplier !== null) {
      params.append("ledger_type", selectedIsSupplier);
    }
    if (selectedAccountTypeFilter && selectedAccountTypeFilter !== "all") {
      params.append(
        "account_type",
        selectedAccountTypeFilter === "none" ? "none" : selectedAccountTypeFilter
      );
    }
    if (selectedIsActive && selectedIsActive !== "all") {
      params.append("is_active", selectedIsActive === "active" ? "true" : "false");
    } else {
      params.append("is_active", "all");
    }
    if (selectedIsTallySync !== null) {
      params.append("is_tally_sync", selectedIsTallySync);
    }
    if (selectedPendingField) {
      params.append("pending_field", selectedPendingField);
    }
    if (selectedBranchFilter?.id != null && String(selectedBranchFilter.id).trim() !== "") {
      params.append("branch_id", String(selectedBranchFilter.id));
    }
    selectedAreaGroupIds.forEach((id) => params.append("area_group_id", String(id)));
    selectedCreatedByIds.forEach((id) => params.append("created_by", String(id)));
    selectedBusinessTypeIds.forEach((id) => params.append("business_type_id", String(id)));
    selectedCreditTypeIds.forEach((id) => params.append("credit_type_id", String(id)));
    selectedCategoryTypeIds.forEach((id) => params.append("category_type_id", String(id)));
    selectedReligions.forEach((religion) => params.append("religion", religion));
    selectedWeekOffs.forEach((day) => params.append("week_off", day));
    params.append("page", String(currentPage));
    params.append("per_page", String(PAGE_SIZE));
    return params.toString();
  };

  const { data: ledgerGroupsForParent } = useQuery({
    queryKey: ["ledger-groups-for-parent"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("is_live", "true");
      params.append("page", "1");
      params.append("per_page", "1000");
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const uniqueParents = useMemo(() => {
    if (!ledgerGroupsForParent) return [];
    return [
      ...new Set(
        ledgerGroupsForParent.map((group) => group.name).filter((name) => name && name.trim() !== "")
      ),
    ].sort();
  }, [ledgerGroupsForParent]);

  const { data: branchesData = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const branchFilterOptions = useMemo(() => {
    return (branchesData || []).filter((b) => b?.name && String(b.name).trim() !== "");
  }, [branchesData]);

  const { data: areaGroupsData = [] } = useQuery({
    queryKey: ["ledger-area-groups-filter"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledger-area-groups/?is_active=true&page_size=1000`
      );
      const data = await response.json();
      return data.data || data.results || [];
    },
    enabled: !!AuthService.getAccessToken() && isMoreFiltersOpen,
    refetchOnWindowFocus: false,
  });

  const { data: orgUsersData = [] } = useQuery({
    queryKey: ["org-users-for-ledger-filters"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-users/`);
      const data = await response.json();
      return data.data || data.users || [];
    },
    enabled: !!AuthService.getAccessToken() && isMoreFiltersOpen,
    refetchOnWindowFocus: false,
  });

  const { data: businessTypesData = [] } = useQuery({
    queryKey: ["business-types"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/business-types/?page_size=1000`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && isMoreFiltersOpen,
    refetchOnWindowFocus: false,
  });

  const { data: creditTypesData = [] } = useQuery({
    queryKey: ["credit-types"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/credit-types/?page_size=1000`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && isMoreFiltersOpen,
    refetchOnWindowFocus: false,
  });

  const { data: commonListingsData } = useQuery({
    queryKey: ["common-listings", "category_types"],
    queryFn: async () => {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/growth/get-list/`, {
        names: ["category_types"],
      });
      const data = await response.json();
      return data.data || {};
    },
    enabled: !!AuthService.getAccessToken() && isMoreFiltersOpen,
    refetchOnWindowFocus: false,
  });

  const categoryTypes = commonListingsData?.category_types || [];

  const { data: religionsData = [] } = useQuery({
    queryKey: ["religions"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/user/religions/?page_size=1000`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && isMoreFiltersOpen,
    refetchOnWindowFocus: false,
  });

  const religionOptions = useMemo(() => {
    return (religionsData || []).filter((item) => (item.religion || "").trim());
  }, [religionsData]);

  const { data: responseData, isLoading, refetch } = useQuery({
    queryKey: [
      "additional-ledgers",
      debouncedSearch,
      selectedParent,
      selectedIsSupplier,
      selectedAccountTypeFilter,
      selectedIsActive,
      selectedIsTallySync,
      selectedPendingField,
      selectedBranchFilter?.id ?? null,
      selectedAreaGroupIds,
      selectedCreatedByIds,
      selectedBusinessTypeIds,
      selectedCreditTypeIds,
      selectedCategoryTypeIds,
      selectedReligions,
      selectedWeekOffs,
      currentPage,
    ],
    queryFn: async () => {
      const qs = buildQueryParams();
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-additional-ledgers/?${qs}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to fetch additional ledgers");
      }
      return {
        data: data.data ?? [],
        summary: data.summary ?? null,
        pagination: data.pagination ?? {
          current_page: 1,
          total_count: 0,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      };
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const ledgerEntries = responseData?.data || [];
  const profileSummary = responseData?.summary || null;
  const pagination = responseData?.pagination || {
    current_page: 1,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  };

  useEffect(() => {
    setSelectedLedgerIds([]);
  }, [responseData?.data, responseData?.pagination?.current_page]);

  const bulkUpdateLedgersTypeMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/report/bulk-update-ledgers-type/`,
        payload
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "Success",
          description:
            data.message || `${data.data?.updated_count ?? 0} ledger(s) updated successfully`,
        });
        setIsBulkTypeDialogOpen(false);
        setSelectedLedgerIds([]);
        queryClient.invalidateQueries({ queryKey: ["additional-ledgers"] });
        refetch();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update ledger types",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update ledger types",
        variant: "destructive",
      });
    },
  });

  const handleLedgerSelect = (ledgerId, checked) => {
    if (checked) {
      setSelectedLedgerIds((prev) => [...prev, ledgerId]);
    } else {
      setSelectedLedgerIds((prev) => prev.filter((id) => id !== ledgerId));
    }
  };

  const handleSelectAllLedgersOnPage = () => {
    const pageIds = ledgerEntries.map((e) => e.id);
    setSelectedLedgerIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  };

  const handleClearLedgerSelection = () => setSelectedLedgerIds([]);

  const areAllLedgersOnPageSelected =
    ledgerEntries.length > 0 && ledgerEntries.every((e) => selectedLedgerIds.includes(e.id));
  const areSomeLedgersOnPageSelected =
    ledgerEntries.length > 0 && ledgerEntries.some((e) => selectedLedgerIds.includes(e.id));

  const clearAllFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedParent(null);
    setSelectedIsSupplier(null);
    setSelectedAccountTypeFilter("all");
    setSelectedIsActive("all");
    setSelectedIsTallySync(null);
    setSelectedPendingField(null);
    setSelectedBranchFilter(null);
    setSelectedAreaGroupIds([]);
    setSelectedCreatedByIds([]);
    setSelectedBusinessTypeIds([]);
    setSelectedCreditTypeIds([]);
    setSelectedCategoryTypeIds([]);
    setSelectedReligions([]);
    setSelectedWeekOffs([]);
    setMoreFiltersDraft({ ...emptyMoreFiltersDraft });
    setCurrentPage(1);
    refetch();
  };

  const openMoreFilters = () => {
    setMoreFiltersDraft({
      parent: selectedParent,
      branchFilter: selectedBranchFilter,
      isActive: selectedIsActive || "all",
      areaGroupIds: [...selectedAreaGroupIds],
      ledgerType: selectedIsSupplier,
      accountType: selectedAccountTypeFilter || "all",
      createdByIds: [...selectedCreatedByIds],
      businessTypeIds: [...selectedBusinessTypeIds],
      creditTypeIds: [...selectedCreditTypeIds],
      categoryTypeIds: [...selectedCategoryTypeIds],
      religions: [...selectedReligions],
      weekOffs: [...selectedWeekOffs],
    });
    setIsMoreFiltersOpen(true);
  };

  const clearMoreFiltersDraft = () => {
    setMoreFiltersDraft({ ...emptyMoreFiltersDraft });
  };

  const applyMoreFilters = () => {
    setSelectedParent(moreFiltersDraft.parent || null);
    setSelectedBranchFilter(moreFiltersDraft.branchFilter || null);
    setSelectedIsActive(moreFiltersDraft.isActive || "all");
    setSelectedAreaGroupIds([...(moreFiltersDraft.areaGroupIds || [])]);
    setSelectedIsSupplier(moreFiltersDraft.ledgerType || null);
    setSelectedAccountTypeFilter(moreFiltersDraft.accountType || "all");
    setSelectedCreatedByIds([...(moreFiltersDraft.createdByIds || [])]);
    setSelectedBusinessTypeIds([...(moreFiltersDraft.businessTypeIds || [])]);
    setSelectedCreditTypeIds([...(moreFiltersDraft.creditTypeIds || [])]);
    setSelectedCategoryTypeIds([...(moreFiltersDraft.categoryTypeIds || [])]);
    setSelectedReligions([...(moreFiltersDraft.religions || [])]);
    setSelectedWeekOffs([...(moreFiltersDraft.weekOffs || [])]);
    setCurrentPage(1);
    setIsMoreFiltersOpen(false);
  };

  const moreFiltersActiveCount = [
    selectedParent,
    selectedBranchFilter,
    selectedIsActive !== "all" ? selectedIsActive : null,
    selectedIsSupplier,
    selectedAccountTypeFilter !== "all" ? selectedAccountTypeFilter : null,
    selectedAreaGroupIds.length ? selectedAreaGroupIds : null,
    selectedCreatedByIds.length ? selectedCreatedByIds : null,
    selectedBusinessTypeIds.length ? selectedBusinessTypeIds : null,
    selectedCreditTypeIds.length ? selectedCreditTypeIds : null,
    selectedCategoryTypeIds.length ? selectedCategoryTypeIds : null,
    selectedReligions.length ? selectedReligions : null,
    selectedWeekOffs.length ? selectedWeekOffs : null,
  ].filter(Boolean).length;

  const toggleMultiValue = (list, value) => {
    if (list.includes(value)) {
      return list.filter((item) => item !== value);
    }
    return [...list, value];
  };

  const handlePendingFieldSelect = (value) => {
    setSelectedPendingField(value === "all" ? null : value);
    setCurrentPage(1);
  };

  const togglePendingFieldFilter = (fieldKey) => {
    setSelectedPendingField((current) => (current === fieldKey ? null : fieldKey));
    setCurrentPage(1);
  };

  const getPendingFieldLabel = (fieldKey) =>
    PARTY_PROFILE_PENDING_FIELDS.find((field) => field.value === fieldKey)?.label || fieldKey;

  const handleBulkUpdateTypesSubmit = () => {
    if (selectedLedgerIds.length === 0) return;
    bulkUpdateLedgersTypeMutation.mutate({
      ledger_ids: selectedLedgerIds,
      ledger_type: normalizeLedgerTypeValue(bulkLedgerType),
      account_type:
        normalizeAccountTypeValue(bulkAccountType) === "none"
          ? null
          : normalizeAccountTypeValue(bulkAccountType),
    });
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.total_pages) return;
    setCurrentPage(page);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="h-5 w-5 text-slate-700 shrink-0" />
              <h1 className="text-lg font-semibold truncate">Additional Ledgers</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-[1400px] mx-auto space-y-3">
            <Card>
              <CardContent className="py-2.5 px-3">
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <Input
                      placeholder="Search ledgers..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>

                  {isTallyEnabled && (
                    <Select
                      value={selectedIsTallySync || "all"}
                      onValueChange={(value) => {
                        setSelectedIsTallySync(value === "all" ? null : value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[130px] shrink-0 text-sm">
                        <SelectValue placeholder="Tally Sync" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tally: All</SelectItem>
                        <SelectItem value="true">Synced</SelectItem>
                        <SelectItem value="false">Not Synced</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Select
                    value={selectedPendingField || "all"}
                    onValueChange={handlePendingFieldSelect}
                  >
                    <SelectTrigger className="h-8 w-[160px] shrink-0 text-sm">
                      <SelectValue placeholder="Pending field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All fields</SelectItem>
                      {PARTY_PROFILE_PENDING_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                          {profileSummary ? ` (${profileSummary[field.value] ?? 0})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={openMoreFilters}
                    className="h-8 shrink-0 border-gray-300 px-2.5"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                    More filters
                    {moreFiltersActiveCount > 0 && (
                      <Badge className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                        {moreFiltersActiveCount}
                      </Badge>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearAllFilters}
                    title="Clear filters"
                    aria-label="Clear filters"
                    className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                  >
                    <FilterX className="h-4 w-4" />
                  </Button>
                </div>

                {profileSummary && (
                  <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-medium text-gray-600">Profile pending summary</span>
                      <span className="text-[11px] text-gray-500">
                        Total ledgers: {profileSummary.total_entries ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PARTY_PROFILE_PENDING_FIELDS.map((field) => {
                        const count = profileSummary[field.value] ?? 0;
                        const isActive = selectedPendingField === field.value;
                        return (
                          <button
                            key={field.value}
                            type="button"
                            onClick={() => togglePendingFieldFilter(field.value)}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              isActive
                                ? "border-orange-500 bg-orange-50 text-orange-800"
                                : "border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50/60"
                            }`}
                            title={`Filter ledgers with empty ${field.label}`}
                          >
                            {field.label}: {count}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(selectedParent ||
                  selectedBranchFilter ||
                  selectedIsSupplier !== null ||
                  selectedAccountTypeFilter !== "all" ||
                  selectedIsActive !== "all" ||
                  selectedIsTallySync !== null ||
                  selectedPendingField ||
                  selectedAreaGroupIds.length > 0 ||
                  selectedCreatedByIds.length > 0 ||
                  selectedBusinessTypeIds.length > 0 ||
                  selectedCreditTypeIds.length > 0 ||
                  selectedCategoryTypeIds.length > 0 ||
                  selectedReligions.length > 0 ||
                  selectedWeekOffs.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600">Active filters:</span>
                      {selectedParent && (
                        <Badge variant="outline" className="text-xs">
                          Parent: {selectedParent}
                        </Badge>
                      )}
                      {selectedBranchFilter && (
                        <Badge variant="outline" className="text-xs">
                          Branch: {selectedBranchFilter.name}
                        </Badge>
                      )}
                      {selectedIsSupplier !== null && (
                        <Badge variant="outline" className="text-xs">
                          Ledger Type: {formatLedgerTypeLabel(selectedIsSupplier)}
                        </Badge>
                      )}
                      {selectedAccountTypeFilter !== "all" && (
                        <Badge variant="outline" className="text-xs">
                          Account Type: {formatAccountTypeLabel(selectedAccountTypeFilter)}
                        </Badge>
                      )}
                      {selectedIsActive !== "all" && (
                        <Badge variant="outline" className="text-xs">
                          Status: {selectedIsActive === "inactive" ? "Inactive" : "Active"}
                        </Badge>
                      )}
                      {selectedIsTallySync !== null && (
                        <Badge variant="outline" className="text-xs">
                          Tally Sync: {selectedIsTallySync === "true" ? "Synced" : "Not Synced"}
                        </Badge>
                      )}
                      {selectedPendingField && (
                        <Badge
                          variant="outline"
                          className="text-xs border-orange-300 text-orange-800 bg-orange-50"
                        >
                          Pending: {getPendingFieldLabel(selectedPendingField)}
                        </Badge>
                      )}
                      {selectedAreaGroupIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Area groups: {selectedAreaGroupIds.length}
                        </Badge>
                      )}
                      {selectedCreatedByIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Created by: {selectedCreatedByIds.length}
                        </Badge>
                      )}
                      {selectedBusinessTypeIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Business types: {selectedBusinessTypeIds.length}
                        </Badge>
                      )}
                      {selectedCreditTypeIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Credit types: {selectedCreditTypeIds.length}
                        </Badge>
                      )}
                      {selectedCategoryTypeIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Category types: {selectedCategoryTypeIds.length}
                        </Badge>
                      )}
                      {selectedReligions.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Religions: {selectedReligions.length}
                        </Badge>
                      )}
                      {selectedWeekOffs.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Week offs: {selectedWeekOffs.join(", ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base">
                    Additional Ledgers ({pagination.total_count})
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllLedgersOnPage}
                      disabled={ledgerEntries.length === 0}
                    >
                      Select all (page)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearLedgerSelection}
                      disabled={selectedLedgerIds.length === 0}
                    >
                      Clear selection
                    </Button>
                    {selectedLedgerIds.length > 0 && (
                      <>
                        <span className="text-sm text-muted-foreground px-1">
                          {selectedLedgerIds.length} selected
                        </span>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setBulkLedgerType("SUNDRY DEBTORS");
                            setBulkAccountType("none");
                            setIsBulkTypeDialogOpen(true);
                          }}
                          disabled={bulkUpdateLedgersTypeMutation.isPending}
                        >
                          Update type
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 sm:px-2">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="w-10 px-2 py-2">
                          <Checkbox
                            checked={
                              areAllLedgersOnPageSelected
                                ? true
                                : areSomeLedgersOnPageSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) => {
                              if (checked) handleSelectAllLedgersOnPage();
                              else {
                                const pageIds = new Set(ledgerEntries.map((e) => e.id));
                                setSelectedLedgerIds((prev) =>
                                  prev.filter((id) => !pageIds.has(id))
                                );
                              }
                            }}
                            aria-label="Select all on page"
                          />
                        </TableHead>
                        <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Ledger
                        </TableHead>
                        <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Ledger Type
                        </TableHead>
                        <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Account Type
                        </TableHead>
                        {isTallyEnabled && (
                          <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Tally
                          </TableHead>
                        )}
                        <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Parent
                        </TableHead>
                        <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Created
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((entry) => (
                        <TableRow key={entry.id} className="hover:bg-muted/40 border-b border-gray-100">
                          <TableCell className="px-2 py-2 align-middle">
                            <Checkbox
                              checked={selectedLedgerIds.includes(entry.id)}
                              onCheckedChange={(checked) =>
                                handleLedgerSelect(entry.id, checked === true)
                              }
                              aria-label={`Select ${entry.name}`}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-2 align-middle max-w-[220px]">
                            <p className="text-sm font-semibold truncate leading-tight">
                              {entry.name || "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                              {entry.branch_name || "—"}
                            </p>
                          </TableCell>
                          <TableCell className="px-2 py-2 align-middle">
                            <Badge
                              variant="outline"
                              className="w-fit text-[10px] px-1.5 py-0 h-5 font-medium gap-0.5"
                            >
                              <User className="h-2.5 w-2.5" />
                              {formatLedgerTypeLabel(entry.ledger_type, entry.is_supplier)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 py-2 align-middle text-xs">
                            {formatAccountTypeLabel(entry.account_type)}
                          </TableCell>
                          {isTallyEnabled && (
                            <TableCell className="px-2 py-2 align-middle">
                              <Badge
                                variant="outline"
                                className={`w-fit text-[10px] px-1.5 py-0 h-5 gap-0.5 ${
                                  entry.is_tally_sync
                                    ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                    : "border-amber-300 text-amber-700 bg-amber-50"
                                }`}
                              >
                                {entry.is_tally_sync ? (
                                  <>
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Synced
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-2.5 w-2.5" />
                                    Not Synced
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="px-2 py-2 align-middle">
                            <Badge
                              variant="outline"
                              className={`w-fit text-[10px] px-1.5 py-0 h-5 gap-0.5 ${
                                entry.is_active
                                  ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                  : "border-gray-300 text-gray-600 bg-gray-50"
                              }`}
                            >
                              {entry.is_active ? (
                                <CheckCircle className="h-2.5 w-2.5" />
                              ) : (
                                <XCircle className="h-2.5 w-2.5" />
                              )}
                              {entry.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 py-2 align-middle text-xs max-w-[160px]">
                            <span className="truncate block" title={entry.parent || ""}>
                              {entry.parent || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
                            {entry.created_at || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {ledgerEntries.length === 0 && !isLoading && (
                    <div className="text-center py-10 text-gray-500">
                      <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>No additional ledgers found matching your criteria.</p>
                    </div>
                  )}
                </div>

                {pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between mt-4 px-2">
                    <div className="text-sm text-gray-500">
                      Showing{" "}
                      {(pagination.current_page - 1) * (pagination.per_page || PAGE_SIZE) + 1} to{" "}
                      {Math.min(
                        pagination.current_page * (pagination.per_page || PAGE_SIZE),
                        pagination.total_count
                      )}{" "}
                      of {pagination.total_count}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.current_page - 1)}
                        disabled={!pagination.has_previous}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      {getPageNumbers(pagination.current_page, pagination.total_pages).map(
                        (page, idx) =>
                          page === "..." ? (
                            <span key={`e-${idx}`} className="px-2">
                              ...
                            </span>
                          ) : (
                            <Button
                              key={`p-${page}`}
                              variant={pagination.current_page === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </Button>
                          )
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.current_page + 1)}
                        disabled={!pagination.has_next}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog
        open={isBulkTypeDialogOpen}
        onOpenChange={(open) => {
          if (!bulkUpdateLedgersTypeMutation.isPending) setIsBulkTypeDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update ledger &amp; account type</DialogTitle>
            <DialogDescription>
              Apply ledger type and account type to {selectedLedgerIds.length} selected ledger
              {selectedLedgerIds.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Ledger Type</Label>
              <Select value={bulkLedgerType} onValueChange={setBulkLedgerType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ledger type" />
                </SelectTrigger>
                <SelectContent>
                  {LEDGER_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <Select value={bulkAccountType} onValueChange={setBulkAccountType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkTypeDialogOpen(false)}
              disabled={bulkUpdateLedgersTypeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBulkUpdateTypesSubmit}
              disabled={bulkUpdateLedgersTypeMutation.isPending}
            >
              {bulkUpdateLedgersTypeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b bg-slate-900 text-white space-y-1">
            <SheetTitle className="text-white">More filters</SheetTitle>
            <SheetDescription className="text-slate-300">
              Apply additional ledger filters.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-600" />
                Parent
              </Label>
              <Select
                value={moreFiltersDraft.parent || "all"}
                onValueChange={(value) =>
                  setMoreFiltersDraft((prev) => ({
                    ...prev,
                    parent: value === "all" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All parents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parents</SelectItem>
                  {uniqueParents.map((parent) => (
                    <SelectItem key={parent} value={parent}>
                      {parent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                  Branch
                </Label>
                <Select
                  value={
                    moreFiltersDraft.branchFilter?.id != null
                      ? String(moreFiltersDraft.branchFilter.id)
                      : "all"
                  }
                  onValueChange={(value) => {
                    if (value === "all") {
                      setMoreFiltersDraft((prev) => ({ ...prev, branchFilter: null }));
                      return;
                    }
                    const branch = (branchFilterOptions || []).find(
                      (b) => String(b.id) === String(value)
                    );
                    setMoreFiltersDraft((prev) => ({
                      ...prev,
                      branchFilter: branch ? { id: branch.id, name: branch.name } : null,
                    }));
                  }}
                  disabled={branchesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {(branchFilterOptions || []).map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  Status
                </Label>
                <Select
                  value={moreFiltersDraft.isActive || "all"}
                  onValueChange={(value) =>
                    setMoreFiltersDraft((prev) => ({ ...prev, isActive: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-600" />
                Area Group
              </Label>
              <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                {(areaGroupsData || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">No area groups found</p>
                ) : (
                  (areaGroupsData || []).map((area) => {
                    const areaId = Number(area.id);
                    const checked = moreFiltersDraft.areaGroupIds.includes(areaId);
                    return (
                      <label
                        key={area.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              areaGroupIds: toggleMultiValue(prev.areaGroupIds, areaId),
                            }))
                          }
                        />
                        <span className="truncate">{area.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  Ledger Type
                </Label>
                <Select
                  value={moreFiltersDraft.ledgerType || "all"}
                  onValueChange={(value) =>
                    setMoreFiltersDraft((prev) => ({
                      ...prev,
                      ledgerType: value === "all" ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEDGER_TYPE_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-600" />
                  Account Type
                </Label>
                <Select
                  value={moreFiltersDraft.accountType || "all"}
                  onValueChange={(value) =>
                    setMoreFiltersDraft((prev) => ({
                      ...prev,
                      accountType: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-600" />
                  Created By
                </Label>
                <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                  {(orgUsersData || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">No users found</p>
                  ) : (
                    (orgUsersData || []).map((user) => {
                      const userId = String(user.user_id || user.id || "");
                      if (!userId) return null;
                      const checked = moreFiltersDraft.createdByIds.includes(userId);
                      return (
                        <label
                          key={userId}
                          className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              setMoreFiltersDraft((prev) => ({
                                ...prev,
                                createdByIds: toggleMultiValue(prev.createdByIds, userId),
                              }))
                            }
                          />
                          <span className="truncate">{user.name || userId}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-emerald-600" />
                  Business Type
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(businessTypesData || []).map((type) => {
                    const typeId = Number(type.id);
                    const checked = moreFiltersDraft.businessTypeIds.includes(typeId);
                    return (
                      <label
                        key={type.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              businessTypeIds: toggleMultiValue(prev.businessTypeIds, typeId),
                            }))
                          }
                        />
                        <span className="truncate">{type.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-violet-600" />
                  Credit Type
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(creditTypesData || []).map((type) => {
                    const typeId = Number(type.id);
                    const checked = moreFiltersDraft.creditTypeIds.includes(typeId);
                    return (
                      <label
                        key={type.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              creditTypeIds: toggleMultiValue(prev.creditTypeIds, typeId),
                            }))
                          }
                        />
                        <span className="truncate">{type.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-600" />
                  Category Type
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(categoryTypes || []).map((type) => {
                    const typeId = Number(type.id);
                    const checked = moreFiltersDraft.categoryTypeIds.includes(typeId);
                    return (
                      <label
                        key={type.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              categoryTypeIds: toggleMultiValue(prev.categoryTypeIds, typeId),
                            }))
                          }
                        />
                        <span className="truncate">{type.type || type.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-600" />
                  Religion
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(religionOptions || []).map((item) => {
                    const value = item.religion;
                    const checked = moreFiltersDraft.religions.includes(value);
                    return (
                      <label
                        key={item.id || value}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              religions: toggleMultiValue(prev.religions, value),
                            }))
                          }
                        />
                        <span className="truncate">{value}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-600" />
                Week Off
              </Label>
              <div className="border rounded-md p-2 grid grid-cols-2 gap-1">
                {WEEK_OFF_OPTIONS.map((day) => {
                  const checked = moreFiltersDraft.weekOffs.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setMoreFiltersDraft((prev) => ({
                            ...prev,
                            weekOffs: toggleMultiValue(prev.weekOffs, day),
                          }))
                        }
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <SheetFooter className="px-6 py-4 border-t gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={clearMoreFiltersDraft} className="flex-1">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button
              type="button"
              onClick={applyMoreFilters}
              className="flex-1 bg-slate-900 hover:bg-slate-800"
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {isLoading && <Loader />}
    </div>
  );
}
