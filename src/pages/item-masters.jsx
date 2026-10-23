import { useState, useEffect, useMemo, Fragment } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, ChevronLeft, ChevronRight, ChevronDown, Package, Menu, TrendingUp, Building2, Filter, X, RefreshCw, Check, ChevronsUpDown, Loader2, XCircle, AlertTriangle, CheckCircle, Pencil, Save, Plus, Settings, Warehouse, Lock, Unlock, Layers } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS_PER_PAGE = 50;

export default function ItemMasters() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItemGrouping, setSelectedItemGrouping] = useState("");
  const [inStockFilter, setInStockFilter] = useState("all"); // "all" | "in_stock"
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showGodownWiseView, setShowGodownWiseView] = useState(false);
  const [selectedGodownFilter, setSelectedGodownFilter] = useState(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState("active"); // "all", "active", "deactive"
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingConversion, setIsEditingConversion] = useState(false);
  const [isUpdateStocksDialogOpen, setIsUpdateStocksDialogOpen] = useState(false);
  const [stockUpdateRows, setStockUpdateRows] = useState([]);
  // Confirm dialog state for the "Release locked stock" action. Holds the
  // batch row whose unlock icon was clicked so we can show context and
  // pass the batch name through to the release API.
  const [releaseLockConfirm, setReleaseLockConfirm] = useState(null);
  // Per-godown expansion state for the Godown Details table. Maps a godown
  // name to true when its batch-wise sub-row is expanded.
  const [expandedGodowns, setExpandedGodowns] = useState({});
  // Cache of batch allocations per godown for the currently selected item.
  // Keyed by godown name; value: { loading, error, data: [batchRow,...] }.
  const [godownBatchDetails, setGodownBatchDetails] = useState({});
  const [editBaseUnitId, setEditBaseUnitId] = useState("");
  const [editAlternateUnitId, setEditAlternateUnitId] = useState("");
  const [editConversion, setEditConversion] = useState("");
  const [editApmcHead, setEditApmcHead] = useState("");
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [itemToDeactivate, setItemToDeactivate] = useState(null);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = useState(false);
  const [isStockGroupDialogOpen, setIsStockGroupDialogOpen] = useState(false);
  const [isCreateStockGroupDialogOpen, setIsCreateStockGroupDialogOpen] = useState(false);
  const [stockGroupSearch, setStockGroupSearch] = useState("");
  const [isStockCategoryDialogOpen, setIsStockCategoryDialogOpen] = useState(false);
  const [isCreateStockCategoryDialogOpen, setIsCreateStockCategoryDialogOpen] = useState(false);
  const [stockCategorySearch, setStockCategorySearch] = useState("");
  const [newStockGroupForm, setNewStockGroupForm] = useState({ name: "", is_favourite: false });
  const [newStockCategoryForm, setNewStockCategoryForm] = useState({ name: "", parent_name: "" });
  const [isGroupingSettingsOpen, setIsGroupingSettingsOpen] = useState(false);
  const [selectedGroupingCard, setSelectedGroupingCard] = useState("");
  const [groupingItemSearch, setGroupingItemSearch] = useState("");
  const [debouncedGroupingSearch, setDebouncedGroupingSearch] = useState("");
  const [groupingSettingsPage, setGroupingSettingsPage] = useState(1);
  const [groupingDraftByItem, setGroupingDraftByItem] = useState({});
  const [changedGroupingItemIds, setChangedGroupingItemIds] = useState([]);
  const [itemGroupingDropdownOpen, setItemGroupingDropdownOpen] = useState(false);
  const [createItemParentDropdownOpen, setCreateItemParentDropdownOpen] = useState(false);
  const [createItemCategoryDropdownOpen, setCreateItemCategoryDropdownOpen] = useState(false);
  const [createItemForm, setCreateItemForm] = useState({
    name: "",
    parent: "",
    category_id: "",
    base_unit_id: "",
    alternate_unit_id: "",
    conversion: "",
    gst_rate: "0",
    apmc_head: "",
    item_groupings: [],
  });
  const ITEM_GROUPING_OPTIONS = [
    "Raw Material",
    "Process Machine",
    "Finished Materials",
    "PO Material",
    "SO Material",
    "Bags/ Bardans",
  ];

  const parseGroupingValue = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim()).filter(Boolean);
    }
    return String(value)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  };
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  /**
   * Tally flag from login: when false, hide HSN (Tally-oriented field).
   * Conversion/units edit is separate — gated by Control Settings `u` only (backend has no Tally check).
   */
  const isTallyEnabledForItemDetails = AuthService.getUserData()?.is_tally_enabled !== false;
  const canCreateManualItem = AuthService.getUserData()?.is_tally_enabled === false;
  const canCreateStockGroupOrCategory = AuthService.getUserData()?.is_tally_enabled === false;

  // Debounce search to reduce API calls while typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchItems = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    let isActiveValue = null;
    if (activeStatusFilter === "active") {
      isActiveValue = true;
    } else if (activeStatusFilter === "deactive") {
      isActiveValue = false;
    }

    const requestBody = {
      search: debouncedSearch.trim(),
      type: selectedItemGrouping || "",
      list_mode: "default",
      stock_group: selectedGroup || "",
      stock_category: selectedCategory || "",
      is_active: isActiveValue,
      new_page: currentPage,
      per_page: ITEMS_PER_PAGE,
    };

    if (selectedGodownFilter?.name) {
      requestBody.godown_name = selectedGodownFilter.name;
      requestBody.godown = selectedGodownFilter.name;
    }
    if (selectedGodownFilter?.id) {
      requestBody.godown_id = selectedGodownFilter.id;
    }

    if (inStockFilter === "in_stock") {
      requestBody.in_stock = true;
    } else if (inStockFilter === "out_of_stock") {
      requestBody.in_stock = false;
    }

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;

    const response = await fetch(API_BASE_URL + "/api/stock-items-list/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();

    return {
      data: responseData.data || [],
      count: responseData.count || 0,
      total_count: responseData.total_count ?? 0,
      pagination: responseData.pagination ?? {
        current_page: currentPage,
        per_page: ITEMS_PER_PAGE,
        total_pages: 1,
        has_next: false,
        has_previous: false,
        next_page: null,
        previous_page: null
      }
    };
  };

  // Fetch stock groups from API (uses POST method)
  const fetchStockGroups = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch(API_BASE_URL + "/api/get-stock-groups/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData.data || [];
  };

  // Fetch stock categories from API (uses GET method)
  const fetchStockCategories = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch(API_BASE_URL + "/api/get-stock-categories/", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData.data || [];
  };

  const fetchUnits = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }
    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch(API_BASE_URL + "/api/get-unit-masters/", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const responseData = await response.json();
    return responseData.data || [];
  };

  const fetchGodowns = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch(API_BASE_URL + "/api/get-godowns/", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData.data || [];
  };

  // Fetch stock groups and categories
  const {
    data: stockGroupsData,
    isLoading: isLoadingGroups,
    error: groupsError
  } = useQuery({
    queryKey: ['/api/get-stock-groups'],
    queryFn: fetchStockGroups,
    enabled: !!AuthService.getAccessToken(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  const {
    data: stockCategoriesData,
    isLoading: isLoadingCategories,
    error: categoriesError
  } = useQuery({
    queryKey: ['/api/get-stock-categories'],
    queryFn: fetchStockCategories,
    enabled: !!AuthService.getAccessToken(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  const { data: unitsData } = useQuery({
    queryKey: ['/api/get-unit-masters'],
    queryFn: fetchUnits,
    enabled: !!AuthService.getAccessToken(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  const { data: godownsData } = useQuery({
    queryKey: ['/api/get-godowns', 'item-masters'],
    queryFn: fetchGodowns,
    enabled: !!AuthService.getAccessToken() && (isDialogOpen || showGodownWiseView),
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  const { data: userPermissionsData } = useQuery({
    queryKey: ['/api/get-user-permissions', 'item-masters'],
    queryFn: async () => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");
      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/get-user-permissions/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!AuthService.getAccessToken(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const fetchGroupingSettingsItems = async () => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const groupingTypeFilter = selectedGroupingCard === "Bags/ Bardans" ? "bardan" : "";

    const response = await fetch(API_BASE_URL + "/api/get-stock-items/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search: debouncedGroupingSearch.trim(),
        type: groupingTypeFilter,
        stock_group: "",
        stock_category: "",
        godown: "",
        new_page: groupingSettingsPage,
        per_page: 50,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  };

  const { data: groupingItemsResponse, refetch: refetchGroupingItems } = useQuery({
    queryKey: ["/api/get-stock-items/grouping-settings", isGroupingSettingsOpen, debouncedGroupingSearch, groupingSettingsPage, selectedGroupingCard],
    queryFn: fetchGroupingSettingsItems,
    enabled: !!AuthService.getAccessToken() && isGroupingSettingsOpen,
    refetchOnWindowFocus: false,
  });

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: [
      '/api/stock-items-list/',
      selectedItemGrouping,
      inStockFilter,
      selectedGroup,
      selectedCategory,
      activeStatusFilter,
      currentPage,
      debouncedSearch,
      selectedGodownFilter?.name || "",
    ],
    queryFn: fetchItems,
    enabled: !!AuthService.getAccessToken(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    placeholderData: (previousData) => previousData, // keep showing list while typing; only list updates when new data arrives (no full-screen reload)
  });

  // Toggle item active status mutation (activate/deactivate)
  const toggleItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, isActive }) => {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(API_BASE_URL + "/api/enable-stock/", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item_ids: [itemId],
          is_active: isActive
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: variables.isActive ? "Item activated successfully" : "Item deactivated successfully",
      });
      // Refetch items to update the list
      queryClient.invalidateQueries({ queryKey: ['/api/stock-items-list/'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item status",
        variant: "destructive",
      });
    },
  });

  // Bulk activate/deactivate mutation (current screen selection)
  const bulkToggleStatusMutation = useMutation({
    mutationFn: async ({ itemIds, isActive }) => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");
      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(API_BASE_URL + "/api/enable-stock/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item_ids: itemIds, is_active: isActive }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      const count = data?.data?.updated_count ?? variables.itemIds.length;
      toast({
        title: "Success",
        description: variables.isActive
          ? `Activated ${count} item(s) successfully`
          : `Deactivated ${count} item(s) successfully`,
      });
      setSelectedItemIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list/"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item status",
        variant: "destructive",
      });
    },
  });

  const updateConversionMutation = useMutation({
    mutationFn: async ({ itemId, baseUnitId, alternateUnitId, conversion, apmcHead }) => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");
      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(API_BASE_URL + "/api/update-stock-item-conversion/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item_id: itemId,
          base_unit_id: baseUnitId || null,
          alternate_unit_id: alternateUnitId || null,
          conversion,
          apmc_head: apmcHead ?? "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status >= 400) {
        throw new Error(data?.message || data?.error || `HTTP error! status: ${response.status}`);
      }
      return data;
    },
    onSuccess: (res) => {
      const d = res?.data || {};
      setSelectedItem((prev) => prev ? ({
        ...prev,
        base_units_name: d?.base_unit?.name || prev.base_units_name,
        secondary_unit: d?.alternate_unit?.name || prev.secondary_unit,
        conversion: d?.conversion || prev.conversion,
        apmc_head: d?.apmc_head ?? prev.apmc_head,
      }) : prev);
      setIsEditingConversion(false);
      toast({
        title: "Updated",
        description: res?.message || "Units/conversion updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list/"] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update conversion",
        variant: "destructive",
      });
    },
  });

  const updateStocksMutation = useMutation({
    mutationFn: async ({ itemId, godowns }) => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(API_BASE_URL + "/api/user/update-current-stock-by-godown/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock_item_id: itemId,
          godowns,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status >= 400) {
        const firstError = Array.isArray(data?.data?.errors) ? data.data.errors[0] : null;
        throw new Error(firstError || data?.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    },
    onSuccess: async (res) => {
      const totalBalance = Number(res?.data?.total_closing_balance ?? selectedItem?.total_closing_balance ?? 0);

      setSelectedItem((prev) => (
        prev ? { ...prev, total_closing_balance: totalBalance } : prev
      ));
      setIsUpdateStocksDialogOpen(false);

      if (selectedItem?.id) {
        await fetchItemDetails(selectedItem);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list/"] });

      toast({
        title: "Stocks updated",
        description: res?.message || "Godown stock balances updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update stock balances",
        variant: "destructive",
      });
    },
  });

  // Releases *future* batch lock(s) for the selected stock item. The backend
  // (`POST /api/release-stock-batch-lock/`) sets `locking_end_at = now()` on
  // every still-active lock that matches. When `batchName` is provided only
  // that specific batch is released; otherwise every future lock on the item
  // is released. `godownName` is captured so the expanded sub-table can be
  // refreshed in place after success.
  const releaseStockMutation = useMutation({
    mutationFn: async ({ itemId, batchName }) => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");
      if (!itemId) throw new Error("Stock item id is required");

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const payload = { item_id: itemId };
      if (batchName) payload.batch_name = batchName;
      const response = await fetch(API_BASE_URL + "/api/release-stock-batch-lock/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status >= 400) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    },
    onSuccess: async (res, variables) => {
      setReleaseLockConfirm(null);
      if (selectedItem?.id) {
        await fetchItemDetails(selectedItem);
      }
      // Refresh the expanded batch sub-table so its row's lock badge and
      // Release button disappear without needing a manual reload.
      if (variables?.godownName) {
        await fetchGodownBatchDetails(variables.godownName, { forceRefresh: true });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list/"] });
      const releasedCount = res?.data?.released_count ?? 0;
      toast({
        title: releasedCount > 0 ? "Stock released" : "No locks to release",
        description:
          releasedCount > 0
            ? `${releasedCount} batch lock${releasedCount === 1 ? "" : "s"} released for ${res?.data?.stock_item_name || "this item"}.`
            : res?.message || "No active future locks were found.",
      });
    },
    onError: (error) => {
      toast({
        title: "Release failed",
        description: error.message || "Failed to release locked stock",
        variant: "destructive",
      });
    },
  });

  const createManualItemMutation = useMutation({
    mutationFn: async () => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");

      if (!createItemForm.name.trim()) throw new Error("Item name is required");
      if (!createItemForm.parent.trim()) throw new Error("Parent is required");
      if (!createItemForm.category_id) throw new Error("Category is required");
      if (!createItemForm.base_unit_id) throw new Error("Base unit is required");
      if (!createItemForm.conversion || Number(createItemForm.conversion) <= 0) {
        throw new Error("Conversion must be greater than 0");
      }
      if (
        createItemForm.alternate_unit_id &&
        String(createItemForm.alternate_unit_id) === String(createItemForm.base_unit_id)
      ) {
        throw new Error("Alternate unit must be different from base unit");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const payload = {
        items: [
          {
            name: createItemForm.name.trim(),
            parent: createItemForm.parent.trim(),
            category_id: Number(createItemForm.category_id),
            base_unit_id: Number(createItemForm.base_unit_id),
            alternate_unit_id: createItemForm.alternate_unit_id
              ? Number(createItemForm.alternate_unit_id)
              : undefined,
            conversion: String(createItemForm.conversion),
            gst_rate: createItemForm.gst_rate !== "" ? String(createItemForm.gst_rate) : undefined,
            apmc_head: createItemForm.apmc_head.trim() || null,
            item_groupings: Array.isArray(createItemForm.item_groupings)
              ? createItemForm.item_groupings
              : [],
          },
        ],
      };

      const response = await fetch(API_BASE_URL + "/api/add-stock-items/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status >= 400) {
        const firstError = data?.data?.errors?.[0]?.error;
        throw new Error(firstError || data?.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    },
    onSuccess: (res) => {
      toast({
        title: "Success",
        description: res?.message || "Item created successfully",
      });
      setIsCreateItemDialogOpen(false);
      setCreateItemForm({
        name: "",
        parent: "",
        category_id: "",
        base_unit_id: "",
        alternate_unit_id: "",
        conversion: "",
        gst_rate: "0",
        apmc_head: "",
        item_groupings: [],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list/"] });
    },
    onError: (error) => {
      toast({
        title: "Create failed",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const createStockGroupMutation = useMutation({
    mutationFn: async () => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");
      if (!newStockGroupForm.name.trim()) throw new Error("Stock group name is required");

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(API_BASE_URL + "/api/add-stock-group/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStockGroupForm.name.trim(),
          is_favourite: newStockGroupForm.is_favourite,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status >= 400) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    },
    onSuccess: (res) => {
      toast({
        title: "Success",
        description: res?.message || "Stock group created successfully",
      });
      setNewStockGroupForm({ name: "", is_favourite: false });
      setIsCreateStockGroupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/get-stock-groups"] });
    },
    onError: (error) => {
      toast({
        title: "Create failed",
        description: error.message || "Failed to create stock group",
        variant: "destructive",
      });
    },
  });

  const createStockCategoryMutation = useMutation({
    mutationFn: async () => {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");
      if (!newStockCategoryForm.name.trim()) throw new Error("Stock category name is required");

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const payload = { name: newStockCategoryForm.name.trim() };
      if (newStockCategoryForm.parent_name?.trim()) {
        payload.parent_name = newStockCategoryForm.parent_name.trim();
      }

      const response = await fetch(API_BASE_URL + "/api/add-stock-category/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status >= 400) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    },
    onSuccess: (res) => {
      toast({
        title: "Success",
        description: res?.message || "Stock category created successfully",
      });
      setNewStockCategoryForm({ name: "", parent_name: "" });
      setIsCreateStockCategoryDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/get-stock-categories"] });
    },
    onError: (error) => {
      toast({
        title: "Create failed",
        description: error.message || "Failed to create stock category",
        variant: "destructive",
      });
    },
  });

  const updateItemGroupingsMutation = useMutation({
    mutationFn: async () => {
      if (!changedGroupingItemIds.length) {
        throw new Error("No grouping changes to save.");
      }
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");

      const payload = {
        items: changedGroupingItemIds.map((id) => ({
          stock_item_id: Number(id),
          item_groupings: groupingDraftByItem[id] || [],
        })),
      };

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(API_BASE_URL + "/api/update-stock-item-groupings/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status >= 400) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    },
    onSuccess: (res) => {
      toast({
        title: "Updated",
        description: res?.message || "Item groupings updated successfully",
      });
      setChangedGroupingItemIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items-list/"] });
      refetchGroupingItems();
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update item groupings",
        variant: "destructive",
      });
    },
  });

  // Handle errors for groups and categories
  useEffect(() => {
    if (groupsError) {
      toast({
        title: "Error loading stock groups",
        description: groupsError.message,
        variant: "destructive",
      });
    }
  }, [groupsError, toast]);

  useEffect(() => {
    if (categoriesError) {
      toast({
        title: "Error loading stock categories",
        description: categoriesError.message,
        variant: "destructive",
      });
    }
  }, [categoriesError, toast]);

  // Use API response directly - pagination and search handled by API
  const displayItems = useMemo(() => {
    if (!data) return [];
    return data.data || [];
  }, [data]);

  const pagination = data?.pagination ?? {};
  const totalItems = data?.total_count ?? 0;
  const totalPages = pagination.total_pages ?? 1;
  const startItem = totalItems > 0 ? ((pagination.current_page ?? 1) - 1) * (pagination.per_page ?? ITEMS_PER_PAGE) + 1 : 0;
  const endItem = totalItems > 0 ? Math.min((pagination.current_page ?? 1) * (pagination.per_page ?? ITEMS_PER_PAGE), totalItems) : 0;

  // Reset to first page when filters change (use debouncedSearch so we don't reset on every keystroke — keeps cursor in search box)
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedItemGrouping,
    inStockFilter,
    selectedGroup,
    selectedCategory,
    debouncedSearch,
    activeStatusFilter,
    selectedGodownFilter?.name,
  ]);

  // Clear selection when page changes (selection is for current screen only)
  useEffect(() => {
    setSelectedItemIds([]);
  }, [currentPage]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading items",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing data",
      description: "Fetching latest item information...",
    });
  };

  // Handle activate/deactivate button click
  const handleToggleStatus = async (e, item) => {
    e.stopPropagation(); // Prevent row click event
    setItemToDeactivate(item);
    setIsDeactivateDialogOpen(true);
  };

  // Confirm status toggle (activate/deactivate)
  const confirmToggleStatus = () => {
    if (itemToDeactivate) {
      // If current filter is "active", we're deactivating (set to false). If "deactive", we're activating (set to true).
      const newStatus = activeStatusFilter === "deactive"; // true when viewing deactive items (we want to activate them)
      toggleItemStatusMutation.mutate({
        itemId: itemToDeactivate.id,
        isActive: newStatus
      });
      setIsDeactivateDialogOpen(false);
      setItemToDeactivate(null);
    }
  };

  // Cancel status toggle
  const cancelToggleStatus = () => {
    setIsDeactivateDialogOpen(false);
    setItemToDeactivate(null);
  };

  // Determine if we should show activate or deactivate button
  const shouldShowActivate = activeStatusFilter === "deactive";

  // Note: Sorting is now handled by the API, but we keep this for potential client-side sorting
  // If you want to add sorting, you'll need to add sort parameters to the API request
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    // TODO: Add sorting parameters to API request if needed
  };

  // Handle group selection
  const handleGroupSelect = (groupName) => {
    setSelectedGroup(groupName);
    setSelectedGroupId(null);
    setGroupDropdownOpen(false);
  };

  // Handle category selection
  const handleCategorySelect = (categoryName) => {
    setSelectedCategory(categoryName);
    setSelectedCategoryId(null);
    setCategoryDropdownOpen(false);
  };

  // Get stock groups from API data
  const stockGroups = useMemo(() => {
    if (!stockGroupsData || !Array.isArray(stockGroupsData)) return [];
    return stockGroupsData
      .map((group) => ({
        id: group.id || null,
        name: group.name || "",
        guid: group.guid || null,
        parent: group.parent || null,
        is_active: group.is_active !== false,
        item_count: group.item_count || 0,
      }))
      .filter((group) => group.name) // Filter out empty names
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [stockGroupsData]);

  const filteredStockGroups = useMemo(() => {
    const query = stockGroupSearch.trim().toLowerCase();
    if (!query) return stockGroups;
    return stockGroups.filter((group) =>
      String(group.name || "").toLowerCase().includes(query)
    );
  }, [stockGroups, stockGroupSearch]);

  // Get stock categories from API data
  const stockCategories = useMemo(() => {
    if (!stockCategoriesData || !Array.isArray(stockCategoriesData)) return [];
    return stockCategoriesData
      .map((category) => ({
        id: category.id || null,
        name: category.name || "",
        guid: category.guid || null,
        parent: category.parent || null,
        parent_name: category.parent_name || null,
        item_count: category.item_count || 0,
      }))
      .filter((category) => category.name) // Filter out empty names
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [stockCategoriesData]);

  const filteredStockCategories = useMemo(() => {
    const query = stockCategorySearch.trim().toLowerCase();
    if (!query) return stockCategories;
    return stockCategories.filter((category) => {
      const name = String(category.name || "").toLowerCase();
      const parentName = String(category.parent_name || "").toLowerCase();
      return name.includes(query) || parentName.includes(query);
    });
  }, [stockCategories, stockCategorySearch]);

  // Auto-select category in Create Item form when only one category exists.
  useEffect(() => {
    if (!isCreateItemDialogOpen) return;
    if (!Array.isArray(stockCategories) || stockCategories.length !== 1) return;
    const onlyCategoryId = stockCategories[0]?.id;
    if (!onlyCategoryId) return;
    setCreateItemForm((prev) => (
      prev.category_id ? prev : { ...prev, category_id: String(onlyCategoryId) }
    ));
  }, [isCreateItemDialogOpen, stockCategories]);

  const units = useMemo(() => {
    if (!Array.isArray(unitsData)) return [];
    return unitsData
      .map((u) => ({ id: u.id, name: u.name }))
      .filter((u) => u.id && u.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [unitsData]);

  const availableGodowns = useMemo(() => {
    if (!Array.isArray(godownsData)) return [];
    return godownsData
      .map((g) => ({
        id: g.id,
        name: g.name,
        branch: g.branch || g.branch_name || "",
        stock_item_count: Number(g.stock_item_count || 0),
        stock_balance: Number(g.stock_balance || 0),
      }))
      .filter((g) => g.id && g.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [godownsData]);

  const hasControlSettingsUpdate = useMemo(() => {
    const list = userPermissionsData?.data;
    if (!Array.isArray(list)) return false;
    const row = list.find((p) => {
      const name = String(p.module_name || "").trim().toLowerCase();
      const alias = String(p.alias || "").trim().toLowerCase();
      return name === "control settings" || alias === "control_settings";
    });
    const summary = row?.permission_summary;
    if (!Array.isArray(summary)) return false;
    return summary.includes("u");
  }, [userPermissionsData]);

  const canEditItemUnitsConversion = hasControlSettingsUpdate;

  useEffect(() => {
    if (!canEditItemUnitsConversion) {
      setIsEditingConversion(false);
    }
  }, [canEditItemUnitsConversion]);

  const groupingItems = useMemo(() => {
    return Array.isArray(groupingItemsResponse?.data) ? groupingItemsResponse.data : [];
  }, [groupingItemsResponse]);
  const groupingPagination = groupingItemsResponse?.pagination || {};
  const groupingTotalCount = groupingItemsResponse?.total_count || 0;

  useEffect(() => {
    if (!isGroupingSettingsOpen) return;
    const initialDraft = {};
    groupingItems.forEach((item) => {
      initialDraft[item.id] = parseGroupingValue(item.item_groupings);
    });
    setGroupingDraftByItem(initialDraft);
    setChangedGroupingItemIds([]);
  }, [isGroupingSettingsOpen, groupingItems]);

  const visibleGroupingItems = useMemo(() => {
    let list = groupingItems;
    if (selectedGroupingCard) {
      return [...list].sort((a, b) => {
        const aHas = (groupingDraftByItem[a.id] || []).includes(selectedGroupingCard);
        const bHas = (groupingDraftByItem[b.id] || []).includes(selectedGroupingCard);
        return Number(bHas) - Number(aHas);
      });
    }
    return list;
  }, [groupingItems, selectedGroupingCard, groupingDraftByItem]);

  useEffect(() => {
    if (!isGroupingSettingsOpen) return;
    const t = setTimeout(() => {
      setDebouncedGroupingSearch(groupingItemSearch);
      setGroupingSettingsPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [groupingItemSearch, isGroupingSettingsOpen]);

  const filteredGroupingItemIds = useMemo(
    () => visibleGroupingItems.map((item) => item.id),
    [visibleGroupingItems]
  );

  const filteredSelectedCount = useMemo(() => {
    if (!selectedGroupingCard) return 0;
    return visibleGroupingItems.filter((item) =>
      (groupingDraftByItem[item.id] || []).includes(selectedGroupingCard)
    ).length;
  }, [visibleGroupingItems, groupingDraftByItem, selectedGroupingCard]);

  const isAllFilteredSelected =
    !!selectedGroupingCard &&
    filteredGroupingItemIds.length > 0 &&
    filteredSelectedCount === filteredGroupingItemIds.length;

  const isSomeFilteredSelected =
    !!selectedGroupingCard &&
    filteredSelectedCount > 0 &&
    filteredSelectedCount < filteredGroupingItemIds.length;

  const markGroupingChanged = (itemId) => {
    setChangedGroupingItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
  };

  const toggleGroupingForSelectedCard = (itemId, checked) => {
    if (!selectedGroupingCard) return;
    setGroupingDraftByItem((prev) => {
      const current = Array.isArray(prev[itemId]) ? prev[itemId] : [];
      const nextGroups = checked
        ? Array.from(new Set([...current, selectedGroupingCard]))
        : current.filter((g) => g !== selectedGroupingCard);
      return { ...prev, [itemId]: nextGroups };
    });
    markGroupingChanged(itemId);
  };

  const handleSelectAllFilteredForCard = (checked) => {
    if (!selectedGroupingCard) return;
    const ids = filteredGroupingItemIds;
    setGroupingDraftByItem((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        const current = Array.isArray(next[id]) ? next[id] : [];
        next[id] = checked
          ? Array.from(new Set([...current, selectedGroupingCard]))
          : current.filter((g) => g !== selectedGroupingCard);
      });
      return next;
    });
    setChangedGroupingItemIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const conversionPreview = useMemo(() => {
    const base = units.find((u) => String(u.id) === String(editBaseUnitId))?.name || selectedItem?.base_units_name || "Base";
    const alt = units.find((u) => String(u.id) === String(editAlternateUnitId))?.name || selectedItem?.secondary_unit || "Alternate";
    const conv = Number(editConversion);
    if (!Number.isFinite(conv) || conv <= 0) {
      return `1 ${base} = - ${alt}`;
    }
    return `1 ${base} = ${conv} ${alt}`;
  }, [editBaseUnitId, editAlternateUnitId, editConversion, units, selectedItem]);

  const hasListFiltersApplied = useMemo(() => {
    return Boolean(
      searchTerm ||
        selectedItemGrouping ||
        activeStatusFilter !== "active" ||
        inStockFilter !== "all" ||
        selectedGodownFilter?.name
    );
  }, [searchTerm, selectedItemGrouping, activeStatusFilter, inStockFilter, selectedGodownFilter]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedItemGrouping("");
    setInStockFilter("all");
    setSelectedGroup(null);
    setSelectedCategory(null);
    setSelectedGodownFilter(null);
    setActiveStatusFilter("active");
    setSortField("name");
    setSortDirection("asc");
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      return value.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    return value.toString();
  };

  const createStockUpdateRow = (overrides = {}) => ({
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    godown_id: "",
    balance: "",
    ...overrides,
  });

  const createConversionPreview = useMemo(() => {
    const baseName = units.find((u) => String(u.id) === String(createItemForm.base_unit_id))?.name || "Base Unit";
    const altName = units.find((u) => String(u.id) === String(createItemForm.alternate_unit_id))?.name || "Alternate Unit";
    const conv = createItemForm.conversion || "-";
    return `1 ${baseName} = ${conv} ${altName}`;
  }, [createItemForm.base_unit_id, createItemForm.alternate_unit_id, createItemForm.conversion, units]);

  // Pagination helper
  const getPageNumbers = (current, total) => {
    const delta = 2; // pages before and after current
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const fetchItemDetails = async (item) => {
    if (!item?.id) {
      setItemDetails(null);
      return;
    }

    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      
      const response = await fetch(`${API_BASE_URL}/api/item-wise-godowns/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock_item_id: item.id
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setItemDetails(data);
      // Reset per-godown expansion + batch cache for the new item — the
      // godown rows belong to this item, so old cached batches would be
      // stale.
      setExpandedGodowns({});
      setGodownBatchDetails({});
    } catch (error) {
      console.error('Error fetching item details:', error);
      toast({
        title: "Error",
        description: "Failed to load item details",
        variant: "destructive",
      });
      setItemDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Lazily loads batch-wise data for one godown via `get_item_lot_details`.
  // Cached in `godownBatchDetails[godownName]` so re-expanding the same row
  // doesn't refetch. `forceRefresh=true` is used after a successful release
  // to refresh the batch list in place.
  const fetchGodownBatchDetails = async (godownName, { forceRefresh = false } = {}) => {
    if (!selectedItem?.id || !godownName) return;
    if (!forceRefresh && godownBatchDetails[godownName]?.data) return;

    setGodownBatchDetails((prev) => ({
      ...prev,
      [godownName]: { ...(prev[godownName] || {}), loading: true, error: null },
    }));

    try {
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/item-lot-details/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock_item_id: selectedItem.id,
          godown_name: godownName,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `HTTP error! status: ${response.status}`);
      }
      setGodownBatchDetails((prev) => ({
        ...prev,
        [godownName]: {
          loading: false,
          error: null,
          data: Array.isArray(data?.batch_allocations) ? data.batch_allocations : [],
        },
      }));
    } catch (error) {
      console.error("Error fetching batch details:", error);
      setGodownBatchDetails((prev) => ({
        ...prev,
        [godownName]: {
          loading: false,
          error: error.message || "Failed to load batches",
          data: [],
        },
      }));
    }
  };

  const toggleGodownExpansion = (godownName) => {
    if (!godownName) return;
    setExpandedGodowns((prev) => {
      const next = { ...prev, [godownName]: !prev[godownName] };
      return next;
    });
    if (!expandedGodowns[godownName]) {
      fetchGodownBatchDetails(godownName);
    }
  };

  // Handle row click to fetch item details
  const handleRowClick = async (item) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
    setIsLoadingDetails(true);
    setIsEditingConversion(false);
    setIsUpdateStocksDialogOpen(false);
    const baseMatched = units.find((u) => String(u.name).toLowerCase() === String(item.base_units_name || "").toLowerCase());
    const altMatched = units.find((u) => String(u.name).toLowerCase() === String(item.secondary_unit || "").toLowerCase());
    setEditBaseUnitId(baseMatched ? String(baseMatched.id) : "");
    setEditAlternateUnitId(altMatched ? String(altMatched.id) : "");
    setEditConversion(String(item.conversion ?? ""));
    setEditApmcHead(item.apmc_head || "");

    await fetchItemDetails(item);
  };

  const handleSaveConversion = () => {
    if (!selectedItem?.id) return;
    if (!canEditItemUnitsConversion) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to update units and conversion.",
        variant: "destructive",
      });
      return;
    }
    if (!editBaseUnitId) {
      toast({
        title: "Validation Error",
        description: "Please select a base unit.",
        variant: "destructive",
      });
      return;
    }
    const conv = Number(editConversion);
    if (!Number.isFinite(conv) || conv <= 0) {
      toast({
        title: "Validation Error",
        description: "Conversion must be greater than 0.",
        variant: "destructive",
      });
      return;
    }
    if (editBaseUnitId && editAlternateUnitId && String(editBaseUnitId) === String(editAlternateUnitId)) {
      toast({
        title: "Validation Error",
        description: "Base unit and alternate unit cannot be same.",
        variant: "destructive",
      });
      return;
    }
    updateConversionMutation.mutate({
      itemId: selectedItem.id,
      baseUnitId: editBaseUnitId,
      alternateUnitId: editAlternateUnitId || null,
      conversion: String(editConversion),
      apmcHead: editApmcHead.trim(),
    });
  };

  useEffect(() => {
    if (!isDialogOpen) {
      setIsUpdateStocksDialogOpen(false);
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (!isUpdateStocksDialogOpen) return;

    if (Array.isArray(itemDetails?.data) && itemDetails.data.length > 0) {
      const rows = itemDetails.data.map((godown) => {
        const matchedGodown = availableGodowns.find(
          (option) => String(option.name).trim().toLowerCase() === String(godown.godown || "").trim().toLowerCase()
        );

        return createStockUpdateRow({
          godown_id: matchedGodown ? String(matchedGodown.id) : "",
          balance: godown.current_balance != null ? String(godown.current_balance) : "",
        });
      });

      setStockUpdateRows(rows.length > 0 ? rows : [createStockUpdateRow()]);
      return;
    }

    setStockUpdateRows([createStockUpdateRow()]);
  }, [isUpdateStocksDialogOpen, itemDetails, availableGodowns]);

  const handleAddStockRow = () => {
    setStockUpdateRows((prev) => [...prev, createStockUpdateRow()]);
  };

  const handleRemoveStockRow = (rowId) => {
    setStockUpdateRows((prev) => {
      if (prev.length <= 1) {
        return [createStockUpdateRow()];
      }
      return prev.filter((row) => row.rowId !== rowId);
    });
  };

  const handleStockRowChange = (rowId, field, value) => {
    setStockUpdateRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleSaveStocks = () => {
    if (!selectedItem?.id) return;

    const rowsWithMissingGodown = stockUpdateRows.filter(
      (row) => String(row.balance ?? "").trim() !== "" && !String(row.godown_id ?? "").trim()
    );
    if (rowsWithMissingGodown.length > 0) {
      toast({
        title: "Validation Error",
        description: "Please select a godown for every balance row.",
        variant: "destructive",
      });
      return;
    }

    const payloadRows = stockUpdateRows
      .filter((row) => String(row.godown_id ?? "").trim() !== "")
      .map((row) => ({
        godown_id: Number(row.godown_id),
        balance: String(row.balance ?? "").trim() === "" ? "0" : String(row.balance),
      }));

    updateStocksMutation.mutate({
      itemId: selectedItem.id,
      godowns: payloadRows,
    });
  };

  // Only show full-page loader on initial load (no data yet). When user types, do NOT unmount the page — only the item list below should update, so the search input keeps focus and cursor stays visible.
  const isInitialLoad = isLoading && data === undefined;
  if (isInitialLoad) {
    return <CommonLoader text="Loading item masters..." />;
  }

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main-content">
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Item Masters</h1>
            </div>
            <div className="flex items-center gap-2">
              {canCreateStockGroupOrCategory && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsStockGroupDialogOpen(true)}
                    className="h-9"
                    title="Stock Group"
                  >
                    <Building2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsStockCategoryDialogOpen(true)}
                    className="h-9"
                    title="Stock Category"
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </>
              )}
              {canCreateManualItem && (
                <Button
                  size="sm"
                  onClick={() => setIsCreateItemDialogOpen(true)}
                  className="h-9"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                className="p-2"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/all-item-mapping")}
                className="p-2"
                title="Item Mapping"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Item Masters</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Manage and view all stock item information
                </p>
              </div>
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  {canCreateStockGroupOrCategory && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsStockGroupDialogOpen(true)}
                        className="flex items-center space-x-2"
                      >
                        <Building2 className="h-4 w-4" />
                        <span>Stock Group</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsStockCategoryDialogOpen(true)}
                        className="flex items-center space-x-2"
                      >
                        <Layers className="h-4 w-4" />
                        <span>Stock Category</span>
                      </Button>
                    </>
                  )}
                  {canCreateManualItem && (
                    <Button
                      onClick={() => setIsCreateItemDialogOpen(true)}
                      className="flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Item</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/all-item-mapping")}
                    className="flex items-center space-x-2"
                    title="Item Mapping"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Item Mapping</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Filters Section */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                {/* Search */}
                <div className="space-y-2 flex-1 min-w-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-600" />
                    Search Items
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, group, category..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-8 h-11 w-full"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Item Grouping */}
                <div className="space-y-2 w-full lg:w-52 shrink-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Filter className="h-4 w-4 text-purple-600" />
                    Item Grouping
                  </label>
                  <Select
                    value={selectedItemGrouping || "all"}
                    onValueChange={(value) => setSelectedItemGrouping(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select item grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All groupings</SelectItem>
                      {ITEM_GROUPING_OPTIONS.map((option) => (
                        <SelectItem key={`list-grouping-${option}`} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Status Filter */}
                <div className="space-y-2 w-full lg:w-40 shrink-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    Status
                  </label>
                  <Select value={activeStatusFilter} onValueChange={setActiveStatusFilter}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* <SelectItem value="all">All</SelectItem> */}
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="deactive">Deactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* In Stock Filter */}
                <div className="space-y-2 w-full lg:w-44 shrink-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Stock
                  </label>
                  <Select value={inStockFilter} onValueChange={setInStockFilter}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select stock filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All balances</SelectItem>
                      <SelectItem value="in_stock">In stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={clearAllFilters}
                  title="Clear filters"
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Item List</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  {selectedGodownFilter?.name && (
                    <Badge variant="secondary" className="font-normal">
                      Godown: {selectedGodownFilter.name}
                    </Badge>
                  )}
                  <Button
                    variant={showGodownWiseView ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowGodownWiseView((prev) => !prev)}
                    className="gap-2"
                  >
                    {showGodownWiseView ? (
                      <>
                        <Package className="h-4 w-4" />
                        Stock Item View
                      </>
                    ) : (
                      <>
                        <Warehouse className="h-4 w-4" />
                        Godown Wise View
                      </>
                    )}
                  </Button>
                  {isFetching && (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Refreshing...</span>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showGodownWiseView && (
                <div className="mb-4 rounded-lg border bg-slate-50/60 p-4 dark:bg-slate-900/30">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Select Godown</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Choose a godown to load item balances for that godown only.
                      </p>
                    </div>
                    {selectedGodownFilter?.name && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedGodownFilter(null);
                          setCurrentPage(1);
                        }}
                      >
                        Clear godown filter
                      </Button>
                    )}
                  </div>

                  {availableGodowns.length > 0 ? (
                    <div className="grid max-h-80 grid-cols-1 gap-3 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGodownFilter(null);
                          setCurrentPage(1);
                        }}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          !selectedGodownFilter
                            ? "border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/40"
                            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">All Godowns</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Show stock items without godown filter</p>
                          </div>
                          <Warehouse className="h-4 w-4 text-gray-400" />
                        </div>
                      </button>

                      {availableGodowns.map((godown) => {
                        const isSelected = String(selectedGodownFilter?.id || "") === String(godown.id);
                        return (
                          <button
                            key={godown.id}
                            type="button"
                            onClick={() => {
                              setSelectedGodownFilter(godown);
                              setCurrentPage(1);
                            }}
                            className={`rounded-lg border p-4 text-left transition-colors ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/40"
                                : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-900"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900 dark:text-gray-100">{godown.name}</p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Branch: {godown.branch || "No branch assigned"}
                                </p>
                              </div>
                              <Warehouse className={`h-4 w-4 shrink-0 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Godown Balance</p>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                  {formatValue(godown.stock_balance)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Items</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{godown.stock_item_count}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      No godowns available for this user.
                    </div>
                  )}
                </div>
              )}

              {totalItems > 0 ? (
                <>
                  {/* Bulk actions bar when items selected */}
                  {selectedItemIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 py-3 px-4 mb-4 rounded-lg border bg-muted/50">
                      <span className="text-sm font-medium">
                        {selectedItemIds.length} selected
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                          onClick={() =>
                            bulkToggleStatusMutation.mutate({
                              itemIds: selectedItemIds,
                              isActive: true,
                            })
                          }
                          disabled={bulkToggleStatusMutation.isPending}
                        >
                          {bulkToggleStatusMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Activate selected
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() =>
                            bulkToggleStatusMutation.mutate({
                              itemIds: selectedItemIds,
                              isActive: false,
                            })
                          }
                          disabled={bulkToggleStatusMutation.isPending}
                        >
                          {bulkToggleStatusMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1" />
                          )}
                          Deactivate selected
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedItemIds([])}
                        >
                          Clear selection
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="w-full max-h-[min(72vh,calc(100vh-14rem))] overflow-auto relative isolate">
                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 pr-0 sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">
                            <Checkbox
                              checked={
                                displayItems.length > 0 &&
                                displayItems.every((item) => selectedItemIds.includes(item.id))
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedItemIds(displayItems.map((item) => item.id));
                                } else {
                                  setSelectedItemIds([]);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Select all on page"
                            />
                          </TableHead>
                          <TableHead className="w-12 sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">#</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Item Name</span>
                              <span className="text-xs">{getSortIcon('name')}</span>
                            </div>
                            </TableHead>
                          <TableHead className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">
                            APMC Head
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]"
                            onClick={() => handleSort('parent')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Group</span>
                              <span className="text-xs">{getSortIcon('parent')}</span>
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]"
                            onClick={() => handleSort('category')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Category</span>
                              <span className="text-xs">{getSortIcon('category')}</span>
                            </div>
                          </TableHead>
                          <TableHead className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Base Unit</TableHead>
                          <TableHead className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Conversion</TableHead>
                          <TableHead
                            className="text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]"
                            onClick={() => handleSort('total_closing_balance')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Balance</span>
                              <span className="text-xs">{getSortIcon('total_closing_balance')}</span>
                            </div>
                          </TableHead>
                          <TableHead className="w-24 text-center sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayItems.map((item, index) => (
                          <TableRow 
                            key={`item-${item.id ?? index}-${index}`}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => handleRowClick(item)}
                          >
                            <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedItemIds.includes(item.id)}
                                onCheckedChange={() => {
                                  setSelectedItemIds((prev) =>
                                    prev.includes(item.id)
                                      ? prev.filter((id) => id !== item.id)
                                      : [...prev, item.id]
                                  );
                                }}
                                aria-label={`Select ${item.name}`}
                              />
                            </TableCell>
                            <TableCell>
                               {startItem + index}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center space-x-2">
                                <Package className="h-4 w-4 text-blue-500" />
                                <span>{item.name}</span>
                              </div>
                            </TableCell>
                            
                            <TableCell>{item.apmc_head || "Not Available"}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <span>{item.parent || "Primary"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <span>{item.category || "General"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.base_units_name}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.conversion} {item.secondary_unit || "Qtl"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <TrendingUp className={`h-4 w-4 shrink-0 ${item.total_closing_balance > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                                <span>
                                  {formatValue(item.total_closing_balance)}
                                  {item.base_units_name ? (
                                    <span className="text-gray-600 dark:text-gray-400 font-normal"> {item.base_units_name}</span>
                                  ) : null}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleToggleStatus(e, item)}
                                disabled={toggleItemStatusMutation.isPending}
                                className={`h-8 w-8 p-0 ${
                                  shouldShowActivate
                                    ? "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                    : "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                }`}
                                title={shouldShowActivate ? "Activate item" : "Deactivate item"}
                              >
                                {toggleItemStatusMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : shouldShowActivate ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  </div>

                  {/* Pagination - based on API response */}
                  {totalItems > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Showing <span className="font-semibold">{startItem}</span> to{" "}
                        <span className="font-semibold">{endItem}</span> of{" "}
                        <span className="font-semibold">{totalItems}</span> results
                      </div>
                      {totalPages > 1 && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage <= 1 || isLoading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>

                        {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                          page === "..." ? (
                            <span key={`pagination-ellipsis-${idx}`} className="px-2">...</span>
                          ) : (
                            <Button
                              key={`pagination-${idx}-${page}`}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                              disabled={isLoading}
                            >
                              {page}
                            </Button>
                          )
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage >= totalPages || isLoading}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Empty State */
                <div className="text-center py-12">
                  <Package className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                    {totalItems === 0 ? 'No items available' : 'No items found'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    {totalItems === 0 
                      ? "There are currently no items in the system. Contact your administrator to add items."
                      : hasListFiltersApplied
                        ? "No items match your current search criteria. Try adjusting your filters or search terms."
                        : "No items are currently available."
                    }
                  </p>
                  {hasListFiltersApplied && (
                    <Button
                      variant="outline"
                      onClick={clearAllFilters}
                      className="mt-4 mx-auto"
                    >
                      Clear Filters
                    </Button>
                  )}
                  {totalItems === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isFetching}
                      className="mt-4 flex items-center space-x-2 mx-auto"
                    >
                      <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Item Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Item Details - {itemDetails?.stock_item_name || selectedItem?.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2 text-gray-600">Loading item details...</span>
            </div>
          ) : itemDetails ? (
            <div className="space-y-6">
              {/* Basic Item Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Basic Information</span>
                    {canEditItemUnitsConversion && (
                      !isEditingConversion ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingConversion(true)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit Units & Conversion
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingConversion(false);
                              setEditConversion(String(selectedItem?.conversion ?? ""));
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveConversion}
                            disabled={updateConversionMutation.isPending}
                          >
                            {updateConversionMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            Save
                          </Button>
                        </div>
                      )
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Item Name</label>
                      <p className="text-sm font-semibold">{itemDetails.stock_item_name || selectedItem?.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Category</label>
                      <p className="text-sm">{selectedItem?.category || "General"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">APMC Head</label>
                      {canEditItemUnitsConversion && isEditingConversion ? (
                        <Input
                          maxLength={255}
                          value={editApmcHead}
                          onChange={(e) => setEditApmcHead(e.target.value)}
                          placeholder="APMC head"
                          className="h-9 mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedItem?.apmc_head || "Not Available"}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Base Unit</label>
                      {canEditItemUnitsConversion && isEditingConversion ? (
                        <Select value={editBaseUnitId ? String(editBaseUnitId) : undefined} onValueChange={setEditBaseUnitId}>
                          <SelectTrigger className="h-9 mt-1">
                            <SelectValue placeholder="Select base unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={`base-unit-${u.id}`} value={String(u.id)}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm">{selectedItem?.base_units_name}</p>
                      )}
                    </div>
                    {isTallyEnabledForItemDetails ? (
                      <div>
                        <label className="text-sm font-medium text-gray-500">HSN Code</label>
                        <p className="text-sm">{selectedItem?.hsn_code || "NA"}</p>
                      </div>
                    ) : null}
                    <div>
                      <label className="text-sm font-medium text-gray-500">Secondary Unit</label>
                      {canEditItemUnitsConversion && isEditingConversion ? (
                        <Select value={editAlternateUnitId ? String(editAlternateUnitId) : undefined} onValueChange={setEditAlternateUnitId}>
                          <SelectTrigger className="h-9 mt-1">
                            <SelectValue placeholder="Select alternate unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={`alt-unit-${u.id}`} value={String(u.id)}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm">{selectedItem?.secondary_unit || "NA"}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Conversion</label>
                      {canEditItemUnitsConversion && isEditingConversion ? (
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={editConversion}
                          onChange={(e) => setEditConversion(e.target.value)}
                          className="h-9 mt-1"
                        />
                      ) : (
                        <p className="text-sm">
                          {selectedItem?.conversion} {selectedItem?.secondary_unit || "Qtl"}
                        </p>
                      )}
                    </div>
                    {(selectedItem?.item_groupings || "").toString().trim() ? (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Item Groupings</label>
                        <p className="text-sm">{selectedItem.item_groupings}</p>
                      </div>
                    ) : (
                      <div />
                    )}
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Unit Comparison</label>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mt-1">
                        {canEditItemUnitsConversion && isEditingConversion
                          ? conversionPreview
                          : `1 ${selectedItem?.base_units_name || "Base"} = ${selectedItem?.conversion || "-"} ${selectedItem?.secondary_unit || "Alternate"}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Godown Details */}
              {itemDetails.data && itemDetails.data.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between gap-3">
                      <span>Godown Details</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsUpdateStocksDialogOpen(true)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Update stocks
                      </Button>
                    </CardTitle>
                    <p className="text-sm text-gray-600">Total Count: {itemDetails.count} godowns</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Godown Name</TableHead>
                            <TableHead>Current Balance (base unit)</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemDetails.data.map((godown, index) => {
                            const godownName = godown.godown || "";
                            const rowKey = `godown-${index}-${godownName}`;
                            const isExpanded = !!expandedGodowns[godownName];
                            const batchState = godownBatchDetails[godownName];
                            return (
                              <Fragment key={rowKey}>
                                <TableRow
                                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                                  onClick={() => toggleGodownExpansion(godownName)}
                                >
                                  <TableCell className="w-8 align-middle">
                                    <span
                                      className="inline-flex items-center justify-center h-6 w-6 rounded text-gray-500"
                                      aria-label={isExpanded ? "Collapse batches" : "Expand batches"}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center space-x-2">
                                      <Building2 className="h-4 w-4 text-gray-500" />
                                      <span>{godownName || 'N/A'}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center space-x-1 flex-wrap gap-x-1">
                                      <TrendingUp className={`h-4 w-4 shrink-0 ${godown.current_balance > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                                      <span>
                                        {formatValue(godown.current_balance)}
                                        {selectedItem?.base_units_name ? (
                                          <span className="text-gray-600 dark:text-gray-400 font-normal"> {selectedItem.base_units_name}</span>
                                        ) : null}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={godown.current_balance > 0 ? "default" : "secondary"}>
                                        {godown.current_balance > 0 ? 'Available' : 'Out of Stock'}
                                      </Badge>
                                      {Number(godown.locked_qty) > 0 ? (
                                        <TooltipProvider delayDuration={100}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span
                                                className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-100 text-amber-700 text-xs cursor-help"
                                                aria-label="Locked stock in this godown"
                                              >
                                                <Lock className="h-3 w-3" />
                                                {formatValue(godown.locked_qty)}
                                                {selectedItem?.base_units_name ? ` ${selectedItem.base_units_name}` : ''} locked
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                              Click the row to view & release batches
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {isExpanded ? (
                                  <TableRow
                                    key={`${rowKey}-batches`}
                                    className="bg-gray-50/60 dark:bg-gray-800/30 hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                                  >
                                    <TableCell colSpan={4} className="p-0">
                                      <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700">
                                        {batchState?.loading ? (
                                          <div className="inline-flex items-center text-xs text-gray-500 py-2">
                                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                            Loading batches…
                                          </div>
                                        ) : null}
                                        {batchState?.error ? (
                                          <div className="text-xs text-red-600 py-2">
                                            {batchState.error}
                                          </div>
                                        ) : null}
                                        {!batchState?.loading && !batchState?.error && Array.isArray(batchState?.data) ? (
                                          batchState.data.length === 0 ? (
                                            <div className="text-xs text-gray-500 py-2">
                                              No batch records found for this godown.
                                            </div>
                                          ) : (
                                            <div className="overflow-x-auto rounded border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
                                              <Table>
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead>Batch / Lot</TableHead>
                                                    <TableHead>Current Balance</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Action</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {batchState.data.map((batch, batchIdx) => {
                                                    const isBatchLocked = Number(batch.locked_qty) > 0;
                                                    return (
                                                      <TableRow key={`batch-${batchIdx}-${batch.batch_name || ''}`}>
                                                        <TableCell className="font-medium">
                                                          <div className="flex items-center gap-2">
                                                            <Layers className="h-3.5 w-3.5 text-gray-400" />
                                                            <span>{batch.batch_name || 'N/A'}</span>
                                                          </div>
                                                        </TableCell>
                                                        <TableCell>
                                                          <span className="text-sm">
                                                            {batch.current_balance_full || batch.current_balance || formatValue(batch.balance)}
                                                          </span>
                                                        </TableCell>
                                                        <TableCell>
                                                          {isBatchLocked ? (
                                                            <TooltipProvider delayDuration={100}>
                                                              <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                  <span
                                                                    className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-100 text-amber-700 text-xs cursor-help"
                                                                    aria-label="Batch is locked"
                                                                  >
                                                                    <Lock className="h-3 w-3" />
                                                                    {formatValue(batch.locked_qty)}
                                                                    {selectedItem?.base_units_name ? ` ${selectedItem.base_units_name}` : ''} locked
                                                                  </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">
                                                                  Under fumigation / batch locking period
                                                                </TooltipContent>
                                                              </Tooltip>
                                                            </TooltipProvider>
                                                          ) : (
                                                            <Badge variant="default">Available</Badge>
                                                          )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                          {isBatchLocked ? (
                                                            <Button
                                                              type="button"
                                                              variant="outline"
                                                              size="sm"
                                                              className="h-7 px-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                              onClick={() =>
                                                                setReleaseLockConfirm({
                                                                  godownName: godownName || "this godown",
                                                                  batchName: batch.batch_name || "",
                                                                  lockedQty: batch.locked_qty,
                                                                })
                                                              }
                                                              disabled={releaseStockMutation.isPending}
                                                            >
                                                              <Unlock className="h-3.5 w-3.5 mr-1" />
                                                              Release
                                                            </Button>
                                                          ) : (
                                                            <span className="text-xs text-gray-400">—</span>
                                                          )}
                                                        </TableCell>
                                                      </TableRow>
                                                    );
                                                  })}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          )
                                        ) : null}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No Godown Data</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No godown information available for this item.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setIsUpdateStocksDialogOpen(true)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Update stocks
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No Details Available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Unable to load item details.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isUpdateStocksDialogOpen} onOpenChange={setIsUpdateStocksDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Stocks</DialogTitle>
            <DialogDescription>
              Update godown-wise balance for `{selectedItem?.name}`. Batch will be saved as `Primary`.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-gray-50">
              <div className="text-sm font-medium text-gray-900">{selectedItem?.name || "-"}</div>
              <div className="text-xs text-gray-500 mt-1">
                Base unit: {selectedItem?.base_units_name || "-"} | Batch: Primary
              </div>
            </div>

            <div className="space-y-3">
              {stockUpdateRows.map((row, index) => (
                <div
                  key={row.rowId}
                  className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-3 items-end border rounded-md p-3"
                >
                  <div>
                    <label className="text-sm font-medium text-gray-600">Godown</label>
                    <Select
                      value={row.godown_id ? String(row.godown_id) : undefined}
                      onValueChange={(value) => handleStockRowChange(row.rowId, "godown_id", value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select godown" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGodowns.map((godown) => (
                          <SelectItem key={`stock-godown-${godown.id}`} value={String(godown.id)}>
                            {godown.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Balance</label>
                    <Input
                      type="number"
                      step="0.001"
                      value={row.balance}
                      onChange={(e) => handleStockRowChange(row.rowId, "balance", e.target.value)}
                      placeholder="Enter balance"
                      className="mt-1"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveStockRow(row.rowId)}
                    aria-label={`Remove stock row ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={handleAddStockRow}>
                <Plus className="h-4 w-4 mr-1" />
                Add godown
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUpdateStocksDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveStocks}
                  disabled={updateStocksMutation.isPending}
                >
                  {updateStocksMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save stocks
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Release Locked Stock Confirmation Dialog */}
      <Dialog
        open={!!releaseLockConfirm}
        onOpenChange={(open) => {
          if (!open && !releaseStockMutation.isPending) {
            setReleaseLockConfirm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-emerald-600" />
              Release locked stock
            </DialogTitle>
            <DialogDescription>
              {releaseLockConfirm?.batchName ? (
                <>
                  This will release the active lock on batch{" "}
                  <strong>{releaseLockConfirm.batchName}</strong> of{" "}
                  <strong>{selectedItem?.name || "this item"}</strong>. The
                  locked quantity will become available immediately.
                </>
              ) : (
                <>
                  This will release <strong>all active (future)</strong>{" "}
                  batch locks for{" "}
                  <strong>{selectedItem?.name || "this item"}</strong>.
                </>
              )}
              {releaseLockConfirm?.lockedQty != null && (
                <>
                  {" "}This row shows{" "}
                  <strong>
                    {formatValue(releaseLockConfirm.lockedQty)}
                    {selectedItem?.base_units_name
                      ? ` ${selectedItem.base_units_name}`
                      : ""}
                  </strong>{" "}
                  locked
                  {releaseLockConfirm.godownName
                    ? ` at ${releaseLockConfirm.godownName}`
                    : ""}
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setReleaseLockConfirm(null)}
              disabled={releaseStockMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                releaseStockMutation.mutate({
                  itemId: selectedItem?.id,
                  batchName: releaseLockConfirm?.batchName,
                  godownName: releaseLockConfirm?.godownName,
                })
              }
              disabled={
                releaseStockMutation.isPending || !selectedItem?.id
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {releaseStockMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Releasing...
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Release stock
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Groupings Settings Dialog */}
      <Dialog open={isGroupingSettingsOpen} onOpenChange={setIsGroupingSettingsOpen}>
        <DialogContent className="sm:max-w-[1100px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Item Groupings Settings</DialogTitle>
            <DialogDescription>
              Choose a grouping card, then update items for that grouping. Existing grouping values are shown and preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ITEM_GROUPING_OPTIONS.map((option) => (
                <button
                  key={`grouping-card-${option}`}
                  type="button"
                  onClick={() => setSelectedGroupingCard(option)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedGroupingCard === option
                      ? "border-indigo-500 bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-900 shadow-sm"
                      : "border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50 hover:border-gray-300 hover:from-blue-50 hover:to-indigo-50"
                  }`}
                >
                  <div className="font-medium text-sm">{option}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <Input
                  placeholder="Search items by name or group"
                  value={groupingItemSearch}
                  onChange={(e) => setGroupingItemSearch(e.target.value)}
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-2 rounded-md border px-3">
                <Checkbox
                  checked={isAllFilteredSelected ? true : (isSomeFilteredSelected ? "indeterminate" : false)}
                  disabled={!selectedGroupingCard || filteredGroupingItemIds.length === 0}
                  onCheckedChange={(val) => handleSelectAllFilteredForCard(!!val)}
                />
                <span className="text-xs text-gray-700">
                  Select All Filtered ({filteredGroupingItemIds.length})
                </span>
              </div>
              <div className="md:col-span-3">
                <Button
                  className="w-full"
                  onClick={() => updateItemGroupingsMutation.mutate()}
                  disabled={!selectedGroupingCard || !changedGroupingItemIds.length || updateItemGroupingsMutation.isPending}
                >
                  {updateItemGroupingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    `Save Changes (${changedGroupingItemIds.length})`
                  )}
                </Button>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden bg-white">
              <div className="max-h-[48vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-100 z-10">
                  <TableRow>
                    <TableHead className="w-[40%]">Item Name</TableHead>
                    <TableHead className="w-[25%]">Stock Group</TableHead>
                    <TableHead className="w-[20%]">Current Groupings</TableHead>
                    <TableHead className="w-[15%] text-center">
                      {selectedGroupingCard ? `In "${selectedGroupingCard}"` : "Select Card"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleGroupingItems.map((item) => {
                    const currentGroups = groupingDraftByItem[item.id] || [];
                    const checked = selectedGroupingCard ? currentGroups.includes(selectedGroupingCard) : false;
                    return (
                      <TableRow key={`grouping-item-${item.id}`}>
                        <TableCell className="font-medium">{item.name || "-"}</TableCell>
                        <TableCell>{item.parent || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {currentGroups.length ? (
                              currentGroups.map((g) => (
                                <Badge key={`group-badge-${item.id}-${g}`} variant="outline" className="text-[11px]">
                                  {g}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-gray-500">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={checked}
                            disabled={!selectedGroupingCard}
                            onCheckedChange={(val) => toggleGroupingForSelectedCard(item.id, !!val)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visibleGroupingItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-6">
                        No items found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div>
                Showing page {groupingPagination.current_page || 1} of {groupingPagination.total_pages || 1} | Total items: {groupingTotalCount}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!groupingPagination.has_previous}
                  onClick={() => setGroupingSettingsPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!groupingPagination.has_next}
                  onClick={() => setGroupingSettingsPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activate/Deactivate Confirmation Dialog */}
      <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                shouldShowActivate
                  ? "bg-green-100 dark:bg-green-900/20"
                  : "bg-red-100 dark:bg-red-900/20"
              }`}>
                <AlertTriangle className={`h-6 w-6 ${
                  shouldShowActivate
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`} />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  {shouldShowActivate ? "Activate Item" : "Deactivate Item"}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {shouldShowActivate
                    ? "This action will make the item available in the list"
                    : "This action will hide the item from the list"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to {shouldShowActivate ? "activate" : "deactivate"} <span className="font-semibold text-gray-900 dark:text-white">"{itemToDeactivate?.name}"</span>?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {shouldShowActivate
                ? "This item will be available in the list and can be used in transactions."
                : "This item will be hidden from the list and cannot be used in transactions until reactivated."}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={cancelToggleStatus}
              disabled={toggleItemStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={shouldShowActivate ? "default" : "destructive"}
              onClick={confirmToggleStatus}
              disabled={toggleItemStatusMutation.isPending}
              className={shouldShowActivate
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {toggleItemStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {shouldShowActivate ? "Activating..." : "Deactivating..."}
                </>
              ) : (
                <>
                  {shouldShowActivate ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Item Dialog (non-tally org only) */}
      <Dialog open={isCreateItemDialogOpen} onOpenChange={setIsCreateItemDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Create Item</DialogTitle>
            <DialogDescription>
              Add a stock item for you item masters.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
            {/* Row 1 */}
            <div className="space-y-2 md:col-span-3">
              <label className="text-sm font-medium">Item Name *</label>
              <Input
                value={createItemForm.name}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Enter item name"
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <label className="text-sm font-medium">Item Groupings</label>
              <Popover open={itemGroupingDropdownOpen} onOpenChange={setItemGroupingDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={itemGroupingDropdownOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {createItemForm.item_groupings?.length
                        ? createItemForm.item_groupings.join(", ")
                        : "Select item groupings"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search groupings..." />
                    <CommandList>
                      <CommandEmpty>No grouping found.</CommandEmpty>
                      <CommandGroup>
                        {ITEM_GROUPING_OPTIONS.map((option) => {
                          const isSelected = createItemForm.item_groupings.includes(option);
                          return (
                            <CommandItem
                              key={`item-grouping-${option}`}
                              value={option}
                              onSelect={() => {
                                setCreateItemForm((prev) => {
                                  const current = Array.isArray(prev.item_groupings) ? prev.item_groupings : [];
                                  return {
                                    ...prev,
                                    item_groupings: isSelected
                                      ? current.filter((v) => v !== option)
                                      : [...current, option],
                                  };
                                });
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                              {option}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Row 2 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Parent (Stock Group) *</label>
              <Popover open={createItemParentDropdownOpen} onOpenChange={setCreateItemParentDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={createItemParentDropdownOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {createItemForm.parent || "Select stock group"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search stock groups..." />
                    <CommandList>
                      <CommandEmpty>No stock group found.</CommandEmpty>
                      <CommandGroup>
                        {stockGroups.map((group) => (
                          <CommandItem
                            key={`create-parent-${group.id || group.name}`}
                            value={group.name}
                            onSelect={() => {
                              setCreateItemForm((p) => ({ ...p, parent: group.name }));
                              setCreateItemParentDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                createItemForm.parent === group.name ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {group.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category *</label>
              <Popover open={createItemCategoryDropdownOpen} onOpenChange={setCreateItemCategoryDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={createItemCategoryDropdownOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {stockCategories.find(
                        (category) => String(category.id) === String(createItemForm.category_id)
                      )?.name || "Select category"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandList>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup>
                        {stockCategories.map((category) => (
                          <CommandItem
                            key={`create-category-${category.id}`}
                            value={`${category.name} ${category.parent_name || ""}`}
                            onSelect={() => {
                              setCreateItemForm((p) => ({ ...p, category_id: String(category.id) }));
                              setCreateItemCategoryDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                String(createItemForm.category_id) === String(category.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            <span className="truncate">
                              {category.name}
                              {category.parent_name ? (
                                <span className="text-muted-foreground ml-1">({category.parent_name})</span>
                              ) : null}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">GST Rate</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={createItemForm.gst_rate}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, gst_rate: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">APMC Head</label>
              <Input
                maxLength={255}
                value={createItemForm.apmc_head}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, apmc_head: e.target.value }))}
                placeholder="Same text groups lines on the APMC permit report"
              />
            </div>

            {/* Row 3 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Base Unit *</label>
              <Select
                value={createItemForm.base_unit_id || undefined}
                onValueChange={(val) => setCreateItemForm((p) => ({ ...p, base_unit_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select base unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={`create-base-unit-${u.id}`} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Alternate Unit (Optional)</label>
              <Select
                value={createItemForm.alternate_unit_id || "none"}
                onValueChange={(val) =>
                  setCreateItemForm((p) => ({ ...p, alternate_unit_id: val === "none" ? "" : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select alternate unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {units
                    .filter((u) => String(u.id) !== String(createItemForm.base_unit_id))
                    .map((u) => (
                      <SelectItem key={`create-alt-unit-${u.id}`} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Conversion *</label>
              <Input
                type="number"
                min="0"
                step="0.000001"
                value={createItemForm.conversion}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, conversion: e.target.value }))}
                placeholder="e.g. 100"
              />
            </div>

            <div className="md:col-span-3">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {createConversionPreview}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateItemDialogOpen(false)}
              disabled={createManualItemMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createManualItemMutation.mutate()}
              disabled={createManualItemMutation.isPending}
            >
              {createManualItemMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Item"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Group listing dialog (non-tally org only) */}
      {canCreateStockGroupOrCategory && (
      <Dialog
        open={isStockGroupDialogOpen}
        onOpenChange={(open) => {
          setIsStockGroupDialogOpen(open);
          if (!open) setStockGroupSearch("");
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Stock Groups</DialogTitle>
            <DialogDescription>
              View stock groups for item masters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={stockGroupSearch}
                  onChange={(e) => setStockGroupSearch(e.target.value)}
                  placeholder="Search stock groups..."
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                onClick={() => setIsCreateStockGroupDialogOpen(true)}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
            <div className="border rounded-md">
              <ScrollArea className="h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingGroups ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Loading stock groups...
                        </TableCell>
                      </TableRow>
                    ) : filteredStockGroups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {stockGroupSearch.trim()
                            ? "No stock groups match your search."
                            : "No stock groups found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStockGroups.map((group, index) => (
                        <TableRow key={`stock-group-row-${group.id || group.name}`}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{group.name}</TableCell>
                          <TableCell>{group.item_count ?? 0}</TableCell>
                          <TableCell>
                            <Badge variant={group.is_active ? "default" : "secondary"}>
                              {group.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Create Stock Group dialog */}
      {canCreateStockGroupOrCategory && (
      <Dialog
        open={isCreateStockGroupDialogOpen}
        onOpenChange={(open) => {
          setIsCreateStockGroupDialogOpen(open);
          if (!open) setNewStockGroupForm({ name: "", is_favourite: false });
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create Stock Group</DialogTitle>
            <DialogDescription>
              Add a new stock group for item masters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name *</label>
              <Input
                value={newStockGroupForm.name}
                onChange={(e) => setNewStockGroupForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Enter stock group name"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stock-group-favourite"
                checked={newStockGroupForm.is_favourite}
                onCheckedChange={(checked) =>
                  setNewStockGroupForm((p) => ({ ...p, is_favourite: checked === true }))
                }
              />
              <label htmlFor="stock-group-favourite" className="text-sm font-medium">
                Favourite
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateStockGroupDialogOpen(false)}
                disabled={createStockGroupMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => createStockGroupMutation.mutate()}
                disabled={createStockGroupMutation.isPending || !newStockGroupForm.name.trim()}
              >
                {createStockGroupMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Group"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Stock Category listing dialog (non-tally org only) */}
      {canCreateStockGroupOrCategory && (
      <Dialog
        open={isStockCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsStockCategoryDialogOpen(open);
          if (!open) setStockCategorySearch("");
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Stock Categories</DialogTitle>
            <DialogDescription>
              View stock categories for item masters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={stockCategorySearch}
                  onChange={(e) => setStockCategorySearch(e.target.value)}
                  placeholder="Search stock categories..."
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                onClick={() => setIsCreateStockCategoryDialogOpen(true)}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Category
              </Button>
            </div>
            <div className="border rounded-md">
              <ScrollArea className="h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingCategories ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Loading stock categories...
                        </TableCell>
                      </TableRow>
                    ) : filteredStockCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {stockCategorySearch.trim()
                            ? "No stock categories match your search."
                            : "No stock categories found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStockCategories.map((category, index) => {
                        const parentName =
                          category.parent_name ||
                          (category.parent
                            ? stockCategories.find((c) => c.id === category.parent)?.name
                            : null) ||
                          "-";
                        return (
                          <TableRow key={`stock-category-row-${category.id}`}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{category.name}</TableCell>
                            <TableCell>{parentName}</TableCell>
                            <TableCell>{category.item_count ?? 0}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Create Stock Category dialog */}
      {canCreateStockGroupOrCategory && (
      <Dialog
        open={isCreateStockCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsCreateStockCategoryDialogOpen(open);
          if (!open) setNewStockCategoryForm({ name: "", parent_name: "" });
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create Stock Category</DialogTitle>
            <DialogDescription>
              Add a new stock category for item masters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name *</label>
              <Input
                value={newStockCategoryForm.name}
                onChange={(e) => setNewStockCategoryForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Enter category name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Parent Name</label>
              <Input
                value={newStockCategoryForm.parent_name}
                onChange={(e) => setNewStockCategoryForm((p) => ({ ...p, parent_name: e.target.value }))}
                placeholder="Optional; defaults to category name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateStockCategoryDialogOpen(false)}
                disabled={createStockCategoryMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => createStockCategoryMutation.mutate()}
                disabled={
                  createStockCategoryMutation.isPending || !newStockCategoryForm.name.trim()
                }
              >
                {createStockCategoryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Category"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
