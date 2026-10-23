import { useRef, useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useParams, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import React, { useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";

import {
  Menu,
  Plus,
  Truck,
  User,
  FileText,
  Weight,
  Package,
  Building2,
  Users,
  Hash,
  Trash2,
  Save,
  Calendar,
  X,
  FlaskConical,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  Camera,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { isAdminSettingDisabled, isAdminSettingEnabled } from "@/lib/adminSettings";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronsUpDown, Search, Check } from "lucide-react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import VoiceRemarkPlaybackButton from "@/components/common/VoiceRemarkPlaybackButton";
import InwardItemVoiceRecorder from "@/components/common/InwardItemVoiceRecorder";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

async function uploadMediaFile(file) {
  const token = AuthService.getAccessToken();
  if (!token) throw new Error("No authentication token found");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/voucher/upload-media-file/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== 200) {
    throw new Error(result.message || "Failed to upload media");
  }
  return result.data?.url;
}

function resolvePoBrokerName(po) {
  if (!po?.broker) return "";
  const broker = po.broker;
  if (typeof broker === "string") return broker.trim();
  if (broker.name) return String(broker.name).trim();
  return "";
}

function resolvePoVoiceRemarksUrl(po) {
  const raw = po?.voice_remarks;
  if (raw == null || typeof raw !== "string") return "";
  return raw.trim();
}

function getStockItemConversion(stockItem) {
  if (!stockItem) return null;
  const raw =
    stockItem.conversion ??
    stockItem.conversion_factor ??
    stockItem.conv;
  const num = parseFloat(String(raw));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function computeTotalWeightFromBags(stockItem, bags) {
  const conversion = getStockItemConversion(stockItem);
  const qty = typeof bags === "number" ? bags : parseFloat(String(bags));
  if (!conversion || !Number.isFinite(qty) || qty <= 0) return "";
  return (qty * conversion).toFixed(3);
}

/** Pick the first positive numeric qty from API fields (SRO / PO). */
function resolvePositiveOrderQty(...candidates) {
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === "") continue;
    const direct = parseFloat(String(raw).replace(/,/g, "").trim());
    if (Number.isFinite(direct) && direct > 0) {
      return Number.isInteger(direct) ? String(direct) : String(Number(direct.toFixed(3)));
    }
    const match = String(raw).match(/(\d+\.?\d*)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(3)));
      }
    }
  }
  return "";
}

/** Normalize sales return API line to the same shape used for PO autofill. */
function normalizeSroLineForInward(line) {
  const qty = resolvePositiveOrderQty(
    line?.approved_return_qty,
    line?.return_qty,
    line?.returnable_qty,
  );
  return {
    id: line?.id,
    item_id: line?.stock_item_id,
    stock_item: line?.stock_item_name || "",
    qty,
    actual_qty: qty,
    item_quality: null,
  };
}

function buildSelectedOrderData(orderLinkMode, selectedPOData, selectedSROData) {
  if (orderLinkMode === "sales_return" && selectedSROData) {
    const lines = (selectedSROData.items || []).filter((line) => {
      if (line?.is_rejected) return false;
      if (line?.is_approved) return true;
      const approvedQty = Number(line?.approved_return_qty);
      return Number.isFinite(approvedQty) && approvedQty > 0;
    });
    return {
      ...selectedSROData,
      voucher_number: selectedSROData.return_number,
      party: selectedSROData.customer_name,
      customer_name: selectedSROData.customer_name,
      autofill_party_id: selectedSROData.customer_id,
      party_id: selectedSROData.customer_id,
      purchase_items: (lines.length ? lines : selectedSROData.items || []).map(
        normalizeSroLineForInward,
      ),
      broker: null,
      voice_remarks: null,
    };
  }
  return selectedPOData;
}

/** True when ledger name indicates URD (e.g. contains URD, (URD), or U R D). */
function ledgerNameIndicatesURD(name) {
  if (!name || typeof name !== "string") return false;
  const upper = name.toUpperCase();
  if (upper.includes("(URD)")) return true;
  if (/U\s+R\s+D/.test(upper)) return true;
  const forWordBoundary = upper.replace(/[^\w\s]/g, " ");
  if (/\bURD\b/.test(forWordBoundary)) return true;
  return false;
}

// Image type choices removed as images section is not supported by the API

// Form validation schema
const labTestSchema = z.object({
  test_param_id: z.number().optional(),
  value: z.string().optional(),
  image: z.string().optional(), // Uploaded image URL for parameters that require images
  remarks: z.string().optional(),
});

const itemSchema = z.object({
  item_id: z.union([z.number(), z.string()]).refine((val) => {
    if (val === "" || val === null || val === undefined) return false;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return !isNaN(num) && num > 0;
  }, "Stock item is required"),
  po_line_id: z.union([z.number(), z.string()]).optional(),
  number_of_bags: z.union([z.number(), z.string()]).refine((val) => {
    if (val === "" || val === null || val === undefined) return false;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return !isNaN(num) && num > 0;
  }, "Number of bags is required"),
  quality_id: z.union([z.number(), z.string()]).optional(),
  item_group_id: z.union([z.number(), z.string()]).optional(),
  brand: z.string().optional(),
  our_brand: z.string().optional(),
  total_weight: z.union([z.number(), z.string()]).optional(),
  tare_weight: z.union([z.number(), z.string()]).optional(),
  net_weight: z.union([z.number(), z.string()]).optional(),
  sample_weight: z.union([z.number(), z.string()]).optional(),
  unloaded_weight: z.union([z.number(), z.string()]).optional(),
  lab_tests: z.array(labTestSchema).optional(),
  remarks: z.string().optional(),
});

function hasValidStockItemId(itemId) {
  if (itemId === "" || itemId === null || itemId === undefined) return false;
  const num = typeof itemId === "string" ? parseInt(itemId, 10) : itemId;
  return !Number.isNaN(num) && num > 0;
}

const addInwardSchema = z.object({
  party_id: z.union([z.number(), z.string()]).refine((val) => {
    if (val === "" || val === null || val === undefined) return false;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return !isNaN(num) && num > 0;
  }, "Party is required"),
  vehicle_no: z.string().min(1, "Vehicle number is required"),
  bill_no: z.string().optional(),
  broker_name: z.string().optional(),
  party_name: z.string().max(20, "Party name must be 20 characters or less").optional(),
  purchase_order_id: z.union([z.number(), z.string()]).optional(),
  sales_return_id: z.union([z.number(), z.string()]).optional(),
  remarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
}).superRefine((data, ctx) => {
  const hasSelectedStockItem = (data.items || []).some((item) => hasValidStockItemId(item.item_id));
  if (!hasSelectedStockItem) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one stock item must be selected",
      path: ["items"],
    });
  }
});




export default function AddInward() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user permissions
  const {
    hasCreatePermission,
    hasReadPermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    hasPermission,
    isLoading: permissionsLoading
  } = useUserPermissions();

  // Match sidebar: sales return inward works with sales_return or sales_order access
  const hasSalesReturnAccess =
    hasModuleAccess("sales_return") ||
    hasPermission("sales_return", "read") ||
    hasPermission("sales_return", "create") ||
    hasPermission("sales_order", "read");
  const poVoiceRemarksEnabled = !isAdminSettingDisabled("po_voice_remarks");
  const voiceRemarksEnabled = isAdminSettingEnabled("voice_remarks");
  const allowMultipleInwardImages = isAdminSettingEnabled("inward_multiple_images");
  const [orderLinkMode, setOrderLinkMode] = useState(() => {
    if (typeof window === "undefined") return "purchase_order";
    const params = new URLSearchParams(window.location.search || "");
    if (
      params.get("sales_return_id") ||
      params.get("sales_return_order_id") ||
      params.get("sales_return_ids")
    ) {
      return "sales_return";
    }
    return "purchase_order";
  });

  // Per-item voice recorders — each row owns an isolated recorder/upload state
  // so recording on one item never animates the mic of any other item. Keyed
  // by react-hook-form field id (stable across array reorders).
  const itemVoiceRecordersRef = useRef({});
  const registerItemVoiceRecorder = useCallback((fieldId, instance) => {
    if (!fieldId) return;
    if (instance) {
      itemVoiceRecordersRef.current[fieldId] = instance;
    } else {
      delete itemVoiceRecordersRef.current[fieldId];
    }
  }, []);

  const [loadedBillNumber, setloadedBillNumber] = useState("");
  const [selectedPOData, setSelectedPOData] = useState(null);
  const [selectedSROData, setSelectedSROData] = useState(null);
  const [autoFillTrigger, setAutoFillTrigger] = useState(0);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  // Track which item indices have been manually cleared to prevent auto-fill
  const [clearedItems, setClearedItems] = useState(new Set());
  // Track the last processed linked order ID to prevent re-processing
  const lastProcessedOrderIdRef = useRef(null);
  // Auto-fill disabled - removed PartyName state
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [poSearchTerm, setPoSearchTerm] = useState("");
  const [debouncedPoSearch, setDebouncedPoSearch] = useState("");
  const [sroSearchTerm, setSroSearchTerm] = useState("");
  const [debouncedSroSearch, setDebouncedSroSearch] = useState("");
  const poScrollSentinelRef = useRef(null);
  const poScrollAreaRef = useRef(null);
  const sroScrollAreaRef = useRef(null);

  const selectedOrderData = React.useMemo(
    () => buildSelectedOrderData(orderLinkMode, selectedPOData, selectedSROData),
    [orderLinkMode, selectedPOData, selectedSROData]
  );
  //alert(selectedPOData?.reference)
  //alert(PartyName  + "gggg")
  // Auto-fill party when PO is selected - DISABLED
  // Commented out to prevent auto-filling when purchase order is selected
  // useEffect(() => {
  //   if (PartyName !== null) {
  //     form.setValue("party_id", PartyName, { shouldValidate: true });
  //   }
  // }, [PartyName]);

  const fetchParties = async ({ pageParam = 1, queryKey }) => {
    const [, search] = queryKey; // 👈 second item is search term

    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/report/get-ledgers/?page=${pageParam}&search=${encodeURIComponent(search || "")}`
    );
    const data = await response.json();
    //console.log("Fetched page:", pageParam, "Search:", search, data.pagination);

    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
    };
  };
  const {
    data: partiesPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: partiesLoading,
    isFetching: partiesFetching,
  } = useInfiniteQuery({
    queryKey: ["parties", debouncedSearch], // 👈 debounce applied
    queryFn: fetchParties,
    placeholderData: keepPreviousData, // keep old list visible while new search loads
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken(),
  });

  const parties = partiesPages?.pages?.flatMap((page) => page.results) ?? [];
  // wait 300ms after typing before updating
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Auto-fill disabled - removed PartyName related logic
  const form = useForm({
    resolver: zodResolver(addInwardSchema),
    defaultValues: {
      party_id: 0, // Auto-fill disabled - removed PartyName
      vehicle_no: "",
      bill_no: "", // Auto-fill disabled - removed selectedPOData?.reference
      purchase_order_id: "",
      sales_return_id: "",
      broker_name: "",
      party_name: "",
      remarks: "",
      items: [{
        item_id: "",
        po_line_id: "",
        sro_line_id: "",
        number_of_bags: "",
        quality_id: "",
        brand: "Binmark",
        our_brand: "",
        total_weight: "",
        tare_weight: "",
        net_weight: "",
        sample_weight: "",
        unloaded_weight: "",
        lab_tests: [],
        remarks: "",
        voice_remarks: ""
      }]
    },
  });

  //alert(form?.party_id + "  ffff")
  // Auto-fill bill number when PO is selected - DISABLED
  // Commented out to prevent auto-filling when purchase order is selected
  // useEffect(() => {
  //   if (selectedPOData?.reference) {
  //     form.setValue("bill_no", selectedPOData.reference, {
  //       shouldValidate: true, // triggers zod validation
  //       shouldDirty: true,
  //     });
  //   }
  // }, [selectedPOData, form]);

  const itemSearchRefs = useRef([]);
  const [itemSearchTerms, setItemSearchTerms] = useState({});

  const handleSearchChange = (index, value) => {
    setItemSearchTerms(prev => ({ ...prev, [index]: value }));
  };

  const handleFocusSearch = (index) => {
    setTimeout(() => {
      itemSearchRefs.current[index]?.focus();
    }, 50);
  };

  const searchInputRef = useRef < HTMLInputElement | null > (null);

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items"
  });

  // Clean up selected lab test params when items are removed
  const handleRemoveItem = (index) => {
    removeItem(index);
    // Clean up selected lab test params for this item
    setSelectedLabTestParams(prev => {
      const newState = { ...prev };
      delete newState[index];
      // Shift remaining items down
      const shiftedState = {};
      Object.keys(newState).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum > index) {
          shiftedState[keyNum - 1] = newState[key];
        } else if (keyNum < index) {
          shiftedState[keyNum] = newState[key];
        }
      });
      return shiftedState;
    });
    setItemQtyWeightMode((prev) => {
      const next = { ...prev };
      delete next[index];
      const shifted = {};
      Object.keys(next).forEach((key) => {
        const keyNum = parseInt(key, 10);
        if (keyNum > index) shifted[keyNum - 1] = next[key];
        else if (keyNum < index) shifted[keyNum] = next[key];
      });
      return shifted;
    });
  };

  // --- PO / Sales Return dropdown state ---
  const [poDropdownOpen, setPoDropdownOpen] = useState(false);
  const [sroDropdownOpen, setSroDropdownOpen] = useState(false);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const partySearchInputRef = useRef(null);

  // Purchase Orders infinite query with search
  const fetchPurchaseOrders = async ({ pageParam = 1, queryKey }) => {
    const [, search] = queryKey;

    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/report/purchase-orders/?page=${pageParam}&per_page=50&status=pending&search=${encodeURIComponent(search || "")}`
    );
    const data = await response.json();

    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next && data.pagination?.next_page ? data.pagination.next_page : undefined,
      totalCount: data.total_count || 0,
    };
  };

  const {
    data: purchaseOrdersPages,
    fetchNextPage: fetchNextPOPage,
    hasNextPage: hasNextPOPage,
    isFetchingNextPage: isFetchingNextPOPage,
    isLoading: purchaseOrdersLoading,
  } = useInfiniteQuery({
    queryKey: ["purchaseOrders", debouncedPoSearch],
    queryFn: fetchPurchaseOrders,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken(),
  });

  // Flatten and deduplicate purchase orders by id to prevent duplicates
  const purchaseOrders = React.useMemo(() => {
    const allOrders = purchaseOrdersPages?.pages?.flatMap((page) => page.results) ?? [];
    // Remove duplicates based on id
    const uniqueOrders = allOrders.reduce((acc, order) => {
      if (!acc.find(existing => existing.id === order.id)) {
        acc.push(order);
      }
      return acc;
    }, []);
    return uniqueOrders;
  }, [purchaseOrdersPages]);

  const fetchSalesReturnOrders = async ({ pageParam = 1, queryKey }) => {
    const [, search] = queryKey;
    const params = new URLSearchParams();
    params.append("new_page", String(pageParam));
    params.append("per_page", "50");
    params.append("for_inward", "1");
    if (search) params.append("search", search);
    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/voucher/sales-return-orders/?${params.toString()}`
    );
    const data = await response.json();
    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next && data.pagination?.next_page ? data.pagination.next_page : undefined,
      totalCount: data.total_count || 0,
    };
  };

  const {
    data: salesReturnOrdersPages,
    fetchNextPage: fetchNextSROPage,
    hasNextPage: hasNextSROPage,
    isFetchingNextPage: isFetchingNextSROPage,
    isLoading: salesReturnOrdersLoading,
  } = useInfiniteQuery({
    queryKey: ["salesReturnOrders", debouncedSroSearch],
    queryFn: fetchSalesReturnOrders,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken() && hasSalesReturnAccess && orderLinkMode === "sales_return",
  });

  const salesReturnOrders = React.useMemo(() => {
    const allOrders = salesReturnOrdersPages?.pages?.flatMap((page) => page.results) ?? [];
    const uniqueOrders = allOrders.reduce((acc, order) => {
      if (!acc.find((existing) => Number(existing.id) === Number(order.id))) {
        acc.push(order);
      }
      return acc;
    }, []);
    // Deep-link / detail fetch: keep selected SRO visible even if list page hasn't loaded it
    if (
      selectedSROData?.id != null &&
      !uniqueOrders.find((existing) => Number(existing.id) === Number(selectedSROData.id))
    ) {
      uniqueOrders.unshift({
        id: selectedSROData.id,
        return_number: selectedSROData.return_number,
        customer_name: selectedSROData.customer_name,
        status: selectedSROData.status,
        status_key: selectedSROData.status_key,
      });
    }
    return uniqueOrders;
  }, [salesReturnOrdersPages, selectedSROData]);

  // Debounce PO search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPoSearch(poSearchTerm);
    }, 300);

    return () => clearTimeout(handler);
  }, [poSearchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSroSearch(sroSearchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [sroSearchTerm]);

  // Scroll event listener for PO infinite scroll
  useEffect(() => {
    if (!poDropdownOpen) return;

    let viewport = null;
    let cleanup = null;

    // Use a small delay to ensure ScrollArea is rendered
    const timer = setTimeout(() => {
      const scrollArea = poScrollAreaRef.current;
      if (!scrollArea) return;

      // Find the viewport element inside ScrollArea - Radix UI uses data-radix-scroll-area-viewport
      viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      if (!viewport) return;

      const handleScroll = () => {
        if (!hasNextPOPage || isFetchingNextPOPage) return;

        const scrollTop = viewport.scrollTop;
        const scrollHeight = viewport.scrollHeight;
        const clientHeight = viewport.clientHeight;

        // Load more when within 100px of bottom
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          fetchNextPOPage();
        }
      };

      viewport.addEventListener('scroll', handleScroll, { passive: true });

      // Store cleanup function
      cleanup = () => {
        viewport.removeEventListener('scroll', handleScroll);
      };
    }, 100);

    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [hasNextPOPage, isFetchingNextPOPage, fetchNextPOPage, poDropdownOpen]);

  useEffect(() => {
    if (!sroDropdownOpen) return;
    let viewport = null;
    let cleanup = null;
    const timer = setTimeout(() => {
      const scrollArea = sroScrollAreaRef.current;
      if (!scrollArea) return;
      viewport = scrollArea.querySelector("[data-radix-scroll-area-viewport]");
      if (!viewport) return;
      const handleScroll = () => {
        if (!hasNextSROPage || isFetchingNextSROPage) return;
        const scrollTop = viewport.scrollTop;
        const scrollHeight = viewport.scrollHeight;
        const clientHeight = viewport.clientHeight;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          fetchNextSROPage();
        }
      };
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      cleanup = () => viewport.removeEventListener("scroll", handleScroll);
    }, 100);
    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [hasNextSROPage, isFetchingNextSROPage, fetchNextSROPage, sroDropdownOpen]);

  const [, setLocation] = useLocation();
  const [selectedstockItems, setselectedstockItems] = useState([]);
  const [selectedLabTestParams, setSelectedLabTestParams] = useState({});
  const [labTestParamSearch, setLabTestParamSearch] = useState({});
  const [itemQtyWeightMode, setItemQtyWeightMode] = useState({ 0: "quantity" });
  const [labTestImageUploading, setLabTestImageUploading] = useState({});

  // Popup state for lab test selection
  const [isLabTestPopupOpen, setIsLabTestPopupOpen] = useState({});
  const [popupSelectedItemGroup, setPopupSelectedItemGroup] = useState({});
  const [popupSelectedParams, setPopupSelectedParams] = useState({});
  const [popupSelectedTestType, setPopupSelectedTestType] = useState({});

  const getMaxBagsFromPOItem = (poItem) => {
    if (!poItem) return null;
    const resolved = resolvePositiveOrderQty(poItem.qty, poItem.actual_qty);
    if (!resolved) return null;
    const qtyVal = parseFloat(resolved);
    if (!Number.isFinite(qtyVal) || qtyVal <= 0) return null;
    return qtyVal;
  };

  const getMaxAllowedBagsForIndex = (itemIndex) => {
    if (!selectedOrderData?.purchase_items?.[itemIndex]) return null;
    return getMaxBagsFromPOItem(selectedOrderData.purchase_items[itemIndex]);
  };

  const clearLinkedOrderSelection = () => {
    lastProcessedOrderIdRef.current = null;
    setSelectedPOData(null);
    setSelectedSROData(null);
    setClearedItems(new Set());
    form.setValue("purchase_order_id", "", { shouldValidate: true, shouldDirty: true });
    form.setValue("sales_return_id", "", { shouldValidate: true, shouldDirty: true });
    form.setValue("bill_no", "", { shouldValidate: true, shouldDirty: true });
    form.setValue("broker_name", "", { shouldValidate: true, shouldDirty: true });
  };

  const switchOrderLinkMode = (mode) => {
    if (mode === orderLinkMode) return;
    setOrderLinkMode(mode);
    clearLinkedOrderSelection();
    setPoDropdownOpen(false);
    setSroDropdownOpen(false);
  };


  // Purchase orders are now fetched via infinite query above



  // Handle PO selection - fetch full PO details from details API for auto-fill
  const handlePOSelect = async (poId, field) => {
    const poIdNum = parseInt(poId);
    field.onChange(poIdNum === 0 ? 0 : poIdNum);
    setPoDropdownOpen(false);

    if (poIdNum === 0) {
      lastProcessedOrderIdRef.current = null;
      setSelectedPOData(null);
      setSelectedSROData(null);
      setClearedItems(new Set());
      form.setValue("sales_return_id", "", { shouldValidate: false, shouldDirty: true });
      form.setValue("bill_no", "", { shouldValidate: true, shouldDirty: true });
      form.setValue("broker_name", "", { shouldValidate: true, shouldDirty: true });
      return;
    }

    form.setValue("sales_return_id", "", { shouldValidate: false, shouldDirty: true });
    setSelectedSROData(null);
  // Reset so auto-fill effect will run when details arrive
    lastProcessedOrderIdRef.current = null;
    setClearedItems(new Set());

    try {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/report/purchase-orders/${poIdNum}/`);
      const json = await response.json();
      if (json.status !== 200 || !json.data) {
        toast({ title: "Error", description: json.message || "Failed to load purchase order details", variant: "destructive" });
        return;
      }
      const poDetail = json.data;
      setSelectedPOData(poDetail);
      form.setValue("bill_no", poDetail.voucher_number || "", { shouldValidate: true, shouldDirty: true });
      const brokerName = resolvePoBrokerName(poDetail);
      if (brokerName) {
        form.setValue("broker_name", brokerName, { shouldValidate: true, shouldDirty: true });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to load purchase order details", variant: "destructive" });
    }
  };

  const handleSROSelect = async (sroId, field) => {
    const sroIdNum = parseInt(sroId, 10);
    field.onChange(sroIdNum === 0 ? 0 : sroIdNum);
    setSroDropdownOpen(false);

    if (sroIdNum === 0) {
      lastProcessedOrderIdRef.current = null;
      setSelectedSROData(null);
      setClearedItems(new Set());
      form.setValue("purchase_order_id", "", { shouldValidate: false, shouldDirty: true });
      form.setValue("bill_no", "", { shouldValidate: true, shouldDirty: true });
      form.setValue("broker_name", "", { shouldValidate: true, shouldDirty: true });
      return;
    }

    form.setValue("purchase_order_id", "", { shouldValidate: false, shouldDirty: true });
    setSelectedPOData(null);
    lastProcessedOrderIdRef.current = null;
    setClearedItems(new Set());

    try {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/voucher/sales-return-orders/${sroIdNum}/`);
      const json = await response.json();
      if (json.status !== 200 || !json.data) {
        toast({
          title: "Error",
          description: json.message || "Failed to load sales return order details",
          variant: "destructive",
        });
        return;
      }
      const sroDetail = json.data;
      setSelectedSROData(sroDetail);
      form.setValue("bill_no", sroDetail.return_number || "", { shouldValidate: true, shouldDirty: true });
      form.setValue("broker_name", "", { shouldValidate: true, shouldDirty: true });
      if (sroDetail.customer_id) {
        const partyIdNum = Number(sroDetail.customer_id);
        form.setValue("party_id", partyIdNum, { shouldValidate: true, shouldDirty: true });
        if (sroDetail.customer_name) {
          setAdditionalParties((prev) => {
            if (prev.find((p) => Number(p.id) === partyIdNum)) return prev;
            return [...prev, { id: partyIdNum, name: sroDetail.customer_name }];
          });
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "Failed to load sales return order details",
        variant: "destructive",
      });
    }
  };

  // Deep-link from sales return list: /add-inward?sales_return_id=123
  const salesReturnPrefillDoneRef = useRef(false);
  useEffect(() => {
    if (permissionsLoading || salesReturnPrefillDoneRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const rawId =
      params.get("sales_return_id") ||
      params.get("sales_return_order_id") ||
      (params.get("sales_return_ids") || "").split(",")[0];
    const sroIdNum = parseInt(String(rawId || "").trim(), 10);
    if (!sroIdNum) return;
    // Wait until we know whether sales-return linking is allowed
    if (!hasSalesReturnAccess) return;

    salesReturnPrefillDoneRef.current = true;
    setOrderLinkMode("sales_return");
    (async () => {
      try {
        const response = await apiRequest(
          "GET",
          `${API_BASE_URL}/api/voucher/sales-return-orders/${sroIdNum}/`,
        );
        const json = await response.json();
        if (json.status !== 200 || !json.data) {
          toast({
            title: "Error",
            description: json.message || "Failed to load sales return for inward",
            variant: "destructive",
          });
          return;
        }
        const sroDetail = json.data;
        form.setValue("sales_return_id", sroIdNum, { shouldValidate: true, shouldDirty: true });
        form.setValue("purchase_order_id", "", { shouldValidate: false, shouldDirty: true });
        setSelectedPOData(null);
        setSelectedSROData(sroDetail);
        form.setValue("bill_no", sroDetail.return_number || "", { shouldValidate: true, shouldDirty: true });
        form.setValue("broker_name", "", { shouldValidate: true, shouldDirty: true });
        if (sroDetail.customer_id) {
          const partyIdNum = Number(sroDetail.customer_id);
          form.setValue("party_id", partyIdNum, {
            shouldValidate: true,
            shouldDirty: true,
          });
          // Ensure ledger combobox can display the name immediately
          if (sroDetail.customer_name) {
            setAdditionalParties((prev) => {
              if (prev.find((p) => Number(p.id) === partyIdNum)) return prev;
              return [
                ...prev,
                { id: partyIdNum, name: sroDetail.customer_name },
              ];
            });
          }
        }
        lastProcessedOrderIdRef.current = null;
        setClearedItems(new Set());
        setIsAutoFilling(false);
        setAutoFillTrigger((n) => n + 1);
      } catch (err) {
        toast({
          title: "Error",
          description: err?.message || "Failed to load sales return for inward",
          variant: "destructive",
        });
      }
    })();
  }, [permissionsLoading, hasSalesReturnAccess, form, toast]);

  // Handle Party/Ledger selection
  const handlePartySelect = (partyId, field) => {
    const partyIdNum = parseInt(partyId);
    field.onChange(partyIdNum === 0 ? 0 : partyIdNum);
    setPartyDropdownOpen(false);
  };

  // Handle Stock Item selection
  const getAlternateWeightUnitName = (stockItem) => {
    if (!stockItem) return "";
    return (
      stockItem?.secondary_unit ||
      stockItem?.alternate_units_name ||
      stockItem?.alternate_unit_name ||
      stockItem?.alternate_unit?.name ||
      stockItem?.alternate_units?.name ||
      ""
    );
  };

  const handleStockItemSelect = (stockItemId, field, itemIndex) => {
    const stockItemIdNum = parseInt(stockItemId);
    field.onChange(stockItemIdNum === 0 ? 0 : stockItemIdNum);
    setStockDropdownOpen(prev => ({ ...prev, [itemIndex]: false }));

    // Remove from cleared items when user selects a new item
    setClearedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemIndex);
      return newSet;
    });

    // Find the selected stock item and show conversion in alert
    const selectedStockItem = allStockItems.find(item => item.id === stockItemIdNum);

    if (selectedStockItem) {
      if (selectedStockItem.conversion) {
        const mode = getQtyWeightMode(itemIndex);
        if (mode === "quantity") {
          const numberOfBags = parseFloat(String(form.watch(`items.${itemIndex}.number_of_bags`) ?? ""));
          if (Number.isFinite(numberOfBags) && numberOfBags > 0) {
            applyTotalWeightFromBags(itemIndex, numberOfBags);
            const conversion = parseFloat(selectedStockItem.conversion);
            const altUnitName = getAlternateWeightUnitName(selectedStockItem);
            toast({
              title: "Total Weight Calculated",
              description: `${numberOfBags} x ${conversion} = ${(numberOfBags * conversion).toFixed(3)}${altUnitName ? ` ${altUnitName}` : ""}`,
            });
          }
        } else {
          const totalWeight = parseFloat(String(form.watch(`items.${itemIndex}.total_weight`) ?? ""));
          if (Number.isFinite(totalWeight) && totalWeight > 0) {
            applyBagsFromTotalWeight(itemIndex, totalWeight);
          }
        }
      } else {
        toast({
          title: "Stock Item Selected",
          description: `${selectedStockItem.name} - Conversion Factor: Not available`,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error",
        description: "Stock item not found",
        variant: "destructive",
      });
    }
  };

  const hasLinkedOrderSelected = () => {
    if (orderLinkMode === "sales_return") {
      const sroId = form.watch("sales_return_id");
      return sroId !== "" && sroId != null && sroId !== undefined && Number(sroId) !== 0;
    }
    const poId = form.watch("purchase_order_id");
    return poId !== "" && poId != null && poId !== undefined && Number(poId) !== 0;
  };

  const getOrderLineIdForRow = (itemIndex) => {
    if (orderLinkMode === "sales_return") {
      return form.watch(`items.${itemIndex}.sro_line_id`);
    }
    return form.watch(`items.${itemIndex}.po_line_id`);
  };

  const getPoLineByFormLineId = (lineId) => {
    if (lineId == null || lineId === "" || !selectedOrderData?.purchase_items) return null;
    return selectedOrderData.purchase_items.find((p) => String(p.id) === String(lineId)) || null;
  };

  const getStockItemForPoLine = (poLine) => {
    if (!poLine) return null;
    const stockId = poLine.item_id ?? poLine.stock_item_id;
    if (stockId != null && String(stockId).trim() !== "") {
      const found = allStockItems.find((item) => String(item.id) === String(stockId));
      if (found) return found;
    }
    return buildStockItemFromPOItem(poLine);
  };

  const getPoLineDisplayName = (poLine) => {
    if (!poLine) return "";
    const name = poLine.stock_item || `Item ${poLine.id}`;
    const quality = poLine.item_quality ? ` · ${poLine.item_quality}` : "";
    return `${name}${quality}`;
  };

  const getPoLineQualityForItem = (itemIndex) => {
    const poLineIdForRow = getOrderLineIdForRow(itemIndex);
    const poLine = getPoLineByFormLineId(poLineIdForRow);
    const quality = poLine?.item_quality;
    return quality == null ? "" : String(quality).trim();
  };

  const getWeightUnitForItem = (itemIndex) => {
    const stock = getStockItemForIndex(itemIndex);
    return getAlternateWeightUnitName(stock);
  };

  const getBaseUnitForItem = (itemIndex) => {
    const selectedStockItem = getStockItemForIndex(itemIndex);
    if (!selectedStockItem) return "";
    return (
      selectedStockItem?.base_units_name ||
      selectedStockItem?.base_unit_name ||
      selectedStockItem?.base_unit?.name ||
      selectedStockItem?.base_units?.name ||
      ""
    );
  };

  const getQtyWeightMode = (itemIndex) => itemQtyWeightMode[itemIndex] ?? "quantity";

  const getStockItemForIndex = (itemIndex) => {
    const selectedStockId = form.watch(`items.${itemIndex}.item_id`);
    if (!selectedStockId) return null;
    return allStockItems.find((item) => String(item.id) === String(selectedStockId)) || null;
  };

  const getConversionForItemIndex = (itemIndex) => {
    const stock = getStockItemForIndex(itemIndex);
    return getStockItemConversion(stock);
  };

  const formatInwardQtyValue = (value) => {
    if (!Number.isFinite(value) || value <= 0) return "";
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  };

  const sanitizeInwardDecimal = (raw) => {
    if (raw === "" || raw == null) return "";
    const s = String(raw);
    let result = "";
    let seenDot = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c >= "0" && c <= "9") result += c;
      else if (c === "." && !seenDot) {
        result += c;
        seenDot = true;
      }
    }
    return result;
  };

  const applyTotalWeightFromBags = (itemIndex, bags) => {
    const conversion = getConversionForItemIndex(itemIndex);
    if (!conversion || !Number.isFinite(bags) || bags <= 0) return;
    form.setValue(`items.${itemIndex}.total_weight`, (bags * conversion).toFixed(3), {
      shouldDirty: true,
    });
  };

  const applyBagsFromTotalWeight = (itemIndex, weight) => {
    const conversion = getConversionForItemIndex(itemIndex);
    if (!conversion || !Number.isFinite(weight) || weight <= 0) return;

    let bags = weight / conversion;
    const maxAllowed = getMaxAllowedBagsForIndex(itemIndex);
    if (maxAllowed != null && bags > maxAllowed) {
      bags = maxAllowed;
      form.setError(`items.${itemIndex}.number_of_bags`, {
        type: "manual",
        message: `Number of bags cannot be more than qty (${maxAllowed})`,
      });
      form.setValue(`items.${itemIndex}.total_weight`, (bags * conversion).toFixed(3), {
        shouldDirty: true,
      });
    } else {
      form.clearErrors(`items.${itemIndex}.number_of_bags`);
    }
    form.setValue(`items.${itemIndex}.number_of_bags`, formatInwardQtyValue(bags), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleQtyWeightModeChange = (itemIndex, mode) => {
    setItemQtyWeightMode((prev) => ({ ...prev, [itemIndex]: mode }));
    if (mode === "quantity") {
      const bags = parseFloat(String(form.watch(`items.${itemIndex}.number_of_bags`) ?? ""));
      if (Number.isFinite(bags) && bags > 0) applyTotalWeightFromBags(itemIndex, bags);
    } else {
      const weight = parseFloat(String(form.watch(`items.${itemIndex}.total_weight`) ?? ""));
      if (Number.isFinite(weight) && weight > 0) applyBagsFromTotalWeight(itemIndex, weight);
    }
  };


  const inwardQtyWeightSegmentClass = (active) =>
    active
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
      : "text-muted-foreground hover:bg-background/70 hover:text-foreground";

  const handleInwardQtyInputChange = (itemIndex, rawValue) => {
    const sanitized = sanitizeInwardDecimal(rawValue);
    if (sanitized === "") {
      form.setValue(`items.${itemIndex}.number_of_bags`, "");
      form.setValue(`items.${itemIndex}.total_weight`, "");
      form.clearErrors(`items.${itemIndex}.number_of_bags`);
      return;
    }
    const maxAllowed = getMaxAllowedBagsForIndex(itemIndex);
    let bags = parseFloat(sanitized);
    if (!Number.isFinite(bags)) {
      form.setValue(`items.${itemIndex}.number_of_bags`, sanitized);
      return;
    }
    if (maxAllowed != null && bags > maxAllowed) {
      bags = maxAllowed;
      form.setError(`items.${itemIndex}.number_of_bags`, {
        type: "manual",
        message: `Number of bags cannot be more than qty (${maxAllowed})`,
      });
    } else {
      form.clearErrors(`items.${itemIndex}.number_of_bags`);
    }
    form.setValue(`items.${itemIndex}.number_of_bags`, formatInwardQtyValue(bags), {
      shouldDirty: true,
      shouldValidate: true,
    });
    applyTotalWeightFromBags(itemIndex, bags);
  };

  const handleInwardWeightInputChange = (itemIndex, rawValue) => {
    const sanitized = sanitizeInwardDecimal(rawValue);
    form.setValue(`items.${itemIndex}.total_weight`, sanitized, { shouldDirty: true });
    if (sanitized === "") {
      form.setValue(`items.${itemIndex}.number_of_bags`, "");
      form.clearErrors(`items.${itemIndex}.number_of_bags`);
      return;
    }
    const weight = parseFloat(sanitized);
    if (Number.isFinite(weight) && weight > 0) {
      applyBagsFromTotalWeight(itemIndex, weight);
    }
  };

  const renderInwardQtyWeightInput = (itemIndex) => {
    const conversion = getConversionForItemIndex(itemIndex);
    const baseUnit = getBaseUnitForItem(itemIndex);
    const weightUnit = getWeightUnitForItem(itemIndex);
    const canUseWeight = conversion != null;
    const mode = getQtyWeightMode(itemIndex) === "weight" && canUseWeight ? "weight" : "quantity";
    const qtyToggleLabel = baseUnit || "Pkt";
    const weightToggleLabel = weightUnit || "Qtl";
    const qtyLabel = baseUnit ? `Quantity (${baseUnit})` : "Quantity";
    const weightLabel = weightUnit ? `Total weight (${weightUnit})` : "Total weight";
    const placeholder =
      mode === "weight"
        ? weightUnit
          ? `Enter ${weightUnit}`
          : "Enter weight"
        : baseUnit
          ? `Enter ${baseUnit}`
          : "Enter quantity...";

    const bagsVal = form.watch(`items.${itemIndex}.number_of_bags`);
    const weightVal = form.watch(`items.${itemIndex}.total_weight`);
    const hasBags = bagsVal !== "" && bagsVal != null && String(bagsVal).trim() !== "";
    const hasWeight = weightVal !== "" && weightVal != null && String(weightVal).trim() !== "";
    const combinedSummary =
      hasBags || hasWeight
        ? `${hasBags ? bagsVal : "-"} ${qtyToggleLabel} = ${hasWeight ? weightVal : "-"} ${weightToggleLabel}`
        : "";

    const displayValue =
      mode === "weight"
        ? String(weightVal ?? "")
        : String(bagsVal ?? "");

    const labelRow = (
      <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
        <Label className="mb-0 text-sm font-medium leading-none">
          {mode === "weight" ? weightLabel : "Quantity"}
        </Label>
        {canUseWeight ? (
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-md border border-input bg-muted/50 p-0.5"
            role="tablist"
            aria-label="Quantity Unit"
            aria-orientation="horizontal"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "quantity"}
              title={qtyLabel}
              className={`h-6 rounded-sm px-2 text-xs font-semibold transition-all ${inwardQtyWeightSegmentClass(mode === "quantity")}`}
              onClick={() => handleQtyWeightModeChange(itemIndex, "quantity")}
            >
              {qtyToggleLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "weight"}
              title={weightLabel}
              className={`h-6 rounded-sm px-2 text-xs font-semibold transition-all ${inwardQtyWeightSegmentClass(mode === "weight")}`}
              onClick={() => handleQtyWeightModeChange(itemIndex, "weight")}
            >
              {weightToggleLabel}
            </button>
          </div>
        ) : null}
      </div>
    );

    if (!canUseWeight) {
      return (
        <div className="md:col-span-3 flex flex-col">
          <Label className="mb-1 min-h-6 text-sm font-medium leading-none">Quantity</Label>
          <Input
            type="number"
            className="h-9"
            placeholder="Enter Quantity..."
            max={getMaxAllowedBagsForIndex(itemIndex) ?? undefined}
            {...form.register(`items.${itemIndex}.number_of_bags`, {
              onChange: (e) => handleInwardQtyInputChange(itemIndex, e.target.value),
            })}
          />
          {combinedSummary && (
            <p className="mt-0.5 text-xs text-muted-foreground">{combinedSummary}</p>
          )}
          {form.formState.errors.items?.[itemIndex]?.number_of_bags && (
            <p className="text-red-500 text-xs mt-0.5">
              {form.formState.errors.items[itemIndex].number_of_bags.message}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="md:col-span-3 flex flex-col">
        {labelRow}
        <Input
          type="number"
          step="any"
          min="0"
          className="h-9"
          value={displayValue}
          onChange={(e) =>
            mode === "weight"
              ? handleInwardWeightInputChange(itemIndex, e.target.value)
              : handleInwardQtyInputChange(itemIndex, e.target.value)
          }
          placeholder={placeholder}
          max={mode === "quantity" ? getMaxAllowedBagsForIndex(itemIndex) ?? undefined : undefined}
          aria-label={mode === "weight" ? weightLabel : qtyLabel}
        />
        {combinedSummary && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{combinedSummary}</span>
          </p>
        )}
        {form.formState.errors.items?.[itemIndex]?.number_of_bags && (
          <p className="text-red-500 text-xs mt-0.5">
            {form.formState.errors.items[itemIndex].number_of_bags.message}
          </p>
        )}
      </div>
    );
  };


  // Broker is now handled as a text input (broker_name) instead of a dropdown

  // Fetch quality types
  const { data: qualityTypes = [], isLoading: qualityLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/process/get-quality-types/`],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/process/get-quality-types/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Stock items search state - search will trigger API calls
  const [stockSearch, setStockSearch] = useState("");
  const [stockDebounced, setStockDebounced] = useState("");
  const [stockDropdownOpen, setStockDropdownOpen] = useState({}); // Track dropdown state per item index
  /** Per item: 'quantity' = user enters bags/qty; 'weight' = user enters total weight */

  // debounce effect - when user types, debounce and trigger API call
  useEffect(() => {
    const t = setTimeout(() => setStockDebounced(stockSearch), 300);
    return () => clearTimeout(t);
  }, [stockSearch]);

  // Fetch stock items mapped as PO Material (item_grouping filter)
  const fetchStockItems = async ({ pageParam = 1, queryKey }) => {
    const searchTerm = String(queryKey[2] ?? "").trim();

    const requestBody = {
      type: "PO Material",
      list_mode: "default",
      stock_group: "",
      stock_category: "",
      is_active: true,
      new_page: pageParam,
      per_page: 50,
    };
    if (searchTerm) {
      requestBody.search = searchTerm;
    }

    const response = await apiRequest('POST', `${API_BASE_URL}/api/stock-items-list/`, requestBody);

    const data = await response.json();

    if (data.status && Number(data.status) >= 400) {
      throw new Error(data.message || "Failed to fetch stock items");
    }

    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
      totalCount: data.total_count || 0,
      pagination: data.pagination
    };
  };

  const {
    data: stockItemsPages,
    fetchNextPage: fetchNextStockPage,
    hasNextPage: hasNextStockPage,
    isFetchingNextPage: isFetchingNextStockPage,
    isLoading: stockItemsLoading,
    refetch: refetchStockItems,
  } = useInfiniteQuery({
    queryKey: ['/api/stock-items-list', 'PO Material', stockDebounced],
    queryFn: fetchStockItems,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken(),
  });

  // Flatten all pages into a single array - API handles search, so no need for additional items
  const stockItems = stockItemsPages?.pages?.flatMap((page) => page.results) ?? [];

  // State to store additional parties found through search
  const [additionalParties, setAdditionalParties] = useState([]);

  // State to store additional stock items found through search (for PO auto-fill)
  const [additionalStockItems, setAdditionalStockItems] = useState([]);

  // Combine stock items from API and additional items found via search
  const allStockItems = React.useMemo(() => {
    const combined = [...stockItems, ...additionalStockItems];
    // Remove duplicates based on id
    const uniqueItems = combined.reduce((acc, item) => {
      if (!acc.find(existing => existing.id === item.id)) {
        acc.push(item);
      }
      return acc;
    }, []);
    return uniqueItems;
  }, [stockItems, additionalStockItems]);

  // Combined parties (original + search results)
  const allParties = useMemo(() => {
    const combined = [...parties, ...additionalParties];
    // Remove duplicates based on id
    const uniqueItems = combined.reduce((acc, item) => {
      if (!acc.find(existing => existing.id === item.id)) {
        acc.push(item);
      }
      return acc;
    }, []);
    return uniqueItems;
  }, [parties, additionalParties]);

  // Keep focus in the ledger search box while results change / become empty
  useEffect(() => {
    if (!partyDropdownOpen) return;
    const id = window.requestAnimationFrame(() => {
      if (document.activeElement !== partySearchInputRef.current) {
        partySearchInputRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [partyDropdownOpen, searchTerm, allParties.length, partiesFetching]);

  // Clear party_name when party is changed away from a URD-style ledger
  const selectedPartyId = form.watch("party_id");
  useEffect(() => {
    const selectedParty = allParties.find(p => p.id === selectedPartyId);
    const isURDSelected = ledgerNameIndicatesURD(selectedParty?.name);

    if (!isURDSelected) {
      form.setValue("party_name", "", { shouldValidate: false });
    }
  }, [selectedPartyId, allParties, form]);

  // Function to search for specific stock items by name (used for PO item matching).
  // For PO auto-fill we do NOT restrict by `type` so we can find the exact item
  // even if it isn't tagged with the "PO Material" grouping.
  const searchStockItemByName = async (itemName, { restrictToPOMaterial = false } = {}) => {
    try {
      const searchTerm = String(itemName ?? "").trim();
      const requestBody = {
        list_mode: "default",
        stock_group: "",
        stock_category: "",
        is_active: true,
        new_page: 1,
        per_page: 100,
      };
      if (restrictToPOMaterial) {
        requestBody.type = "PO Material";
      }
      if (searchTerm) {
        requestBody.search = searchTerm;
      }

      const response = await apiRequest('POST', `${API_BASE_URL}/api/stock-items-list/`, requestBody);
      const data = await response.json();
      const searchResults = data.data || [];

      // Always add found items to additionalStockItems to ensure they're available for dropdown display
      if (searchResults.length > 0) {
        setAdditionalStockItems(prev => {
          const newItems = searchResults.filter(searchItem =>
            !prev.find(existing => existing.id === searchItem.id) &&
            !stockItems.find(original => original.id === searchItem.id)
          );
          return [...prev, ...newItems];
        });
      }

      return searchResults;
    } catch (error) {
      console.error('Error searching stock item:', error);
      return [];
    }
  };

  // Build a minimal stock item object from a PO line so the dropdown can render
  // a label/name even when the item isn't returned by the stock-items search API.
  const buildStockItemFromPOItem = (poItem, sourceStock = null) => {
    if (!poItem) return null;
    const rawId = poItem.item_id ?? sourceStock?.id;
    if (rawId == null || String(rawId).trim() === "") return null;
    const numericId = typeof rawId === "number"
      ? rawId
      : parseInt(String(rawId).trim(), 10);
    if (!Number.isFinite(numericId)) return null;
    const conversionFromSource = getStockItemConversion(sourceStock);
    const conversionFromLine =
      poItem.conversion != null && poItem.conversion !== ""
        ? parseFloat(poItem.conversion)
        : undefined;
    const conversion = conversionFromSource ?? (
      Number.isFinite(conversionFromLine) ? conversionFromLine : undefined
    );
    const altUnit =
      sourceStock?.secondary_unit ||
      sourceStock?.alternate_units_name ||
      sourceStock?.alternate_unit?.name ||
      sourceStock?.alternate_units?.name ||
      poItem.alternate_unit;
    const baseUnit =
      sourceStock?.base_units_name ||
      sourceStock?.base_unit?.name ||
      sourceStock?.base_units?.name ||
      poItem.item_unit;
    return {
      id: numericId,
      name: sourceStock?.name || poItem.stock_item || `Item ${numericId}`,
      conversion,
      base_unit: baseUnit ? { name: baseUnit } : undefined,
      alternate_unit: altUnit ? { name: altUnit } : undefined,
      base_units_name: baseUnit || undefined,
      secondary_unit: altUnit || undefined,
      alternate_units: sourceStock?.alternate_units,
      alternate_units_name: sourceStock?.alternate_units_name,
    };
  };

  const ensureStockItemFromPOInList = (poItem, sourceStock = null) => {
    const synthesized = buildStockItemFromPOItem(poItem, sourceStock);
    if (!synthesized) return null;
    setAdditionalStockItems((prev) => {
      if (prev.find((p) => p.id === synthesized.id)) return prev;
      if (stockItems.find((p) => p.id === synthesized.id)) return prev;
      return [...prev, synthesized];
    });
    return synthesized;
  };

  // Function to search for specific parties by name
  const searchPartyByName = async (partyName, skipStateUpdate = false) => {
    try {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers/?search=${encodeURIComponent(partyName)}&page=1&per_page=100`);
      const data = await response.json();
      const searchResults = data.data || [];

      // Always update state to ensure party is available for dropdown display
      // Even when skipStateUpdate is true, we need to add it for autofill to work
      if (searchResults.length > 0) {
        setAdditionalParties(prev => {
          const newItems = searchResults.filter(searchItem =>
            !prev.find(existing => existing.id === searchItem.id) &&
            !parties.find(original => original.id === searchItem.id)
          );
          return [...prev, ...newItems];
        });
      }

      return searchResults;
    } catch (error) {
      console.error('Error searching party:', error);
      return [];
    }
  };

  // When a PO or sales return is selected, auto-fill form data (party, items, bill_no, broker)
  useEffect(() => {
    const currentOrderId = selectedOrderData?.id;
    if (!currentOrderId || !selectedOrderData?.purchase_items?.length) {
      return;
    }

    // Allow one autofill pass per linked order + mode (re-run if deep-link reset the ref)
    const processKey = `${orderLinkMode}:${currentOrderId}`;
    if (processKey === lastProcessedOrderIdRef.current || isAutoFilling) {
      return;
    }

    lastProcessedOrderIdRef.current = processKey;
    setIsAutoFilling(true);

    const brokerFromPO =
      orderLinkMode === "purchase_order" && selectedOrderData.broker && selectedOrderData.broker.name
        ? String(selectedOrderData.broker.name).trim()
        : "";
    form.setValue("broker_name", brokerFromPO, { shouldValidate: true, shouldDirty: true });

    const processPOItems = async () => {
      const newItems = [];

      for (const poItem of selectedOrderData.purchase_items) {
          // First try exact match by item_id if available
          let stockItem = null;
          if (poItem.item_id) {
            // Try to match by item_id - handle both string and number comparisons
            const poItemId = poItem.item_id.toString().trim();
            stockItem = allStockItems.find((item) => {
              const itemId = (item.id || item.item_id || "").toString().trim();
              return itemId === poItemId;
            });
          }

          // If no exact match by ID, try name matching in current stock items
          if (!stockItem) {
            stockItem = allStockItems.find(
              (item) => {
                const itemName = item.name || item.item_name || "";
                const poItemName = poItem.stock_item || "";
                return itemName.toLowerCase().trim() === poItemName.toLowerCase().trim() ||
                  itemName.toLowerCase().includes(poItemName.toLowerCase()) ||
                  poItemName.toLowerCase().includes(itemName.toLowerCase());
              }
            );
          }

          // If still not found, search for the specific item by name
          if (!stockItem && poItem.stock_item) {
            try {
              const searchResults = await searchStockItemByName(poItem.stock_item);

              // Only proceed if we got results (handle empty response gracefully)
              if (searchResults && searchResults.length > 0) {
                // Find the best match from search results - prioritize exact match
                stockItem = searchResults.find(
                  (item) => {
                    const itemName = (item.name || "").toLowerCase().trim();
                    const poItemName = (poItem.stock_item || "").toLowerCase().trim();
                    return itemName === poItemName;
                  }
                ) || searchResults.find(
                  (item) => {
                    const itemName = (item.name || "").toLowerCase().trim();
                    const poItemName = (poItem.stock_item || "").toLowerCase().trim();
                    return itemName.includes(poItemName) || poItemName.includes(itemName);
                  }
                ) || searchResults[0]; // Use first result if no match

                // Ensure the found item is in additionalStockItems for dropdown display
                if (stockItem && stockItem.id) {
                  setAdditionalStockItems(prev => {
                    const exists = prev.find(p => p.id === stockItem.id);
                    if (!exists) {
                      return [...prev, stockItem];
                    }
                    return prev;
                  });
                }
              }
              // If empty response, keep as is (don't set stock item)
            } catch (error) {
              console.error('Error searching for stock item:', error);
              // On error, keep as is (don't set stock item)
            }
          }

          // Final fallback: synthesize a stock item from the PO line itself.
          // This guarantees the dropdown can show the correct item even when
          // the search API returns nothing (e.g. item isn't tagged as PO Material).
          if (!stockItem && poItem.item_id) {
            stockItem = ensureStockItemFromPOInList(poItem);
          } else if (stockItem && poItem.item_id) {
            stockItem = ensureStockItemFromPOInList(poItem, stockItem) || stockItem;
          }

          // Extract qty — for SRO, approved_return_qty may be 0 while return_qty holds the value
          const numberOfBags = resolvePositiveOrderQty(poItem.qty, poItem.actual_qty);

          // Calculate total_weight from stock conversion (same rule as manual qty entry / PO autofill)
          let totalWeight = computeTotalWeightFromBags(stockItem, numberOfBags);
          if (!totalWeight && poItem.item_weight) {
            const weightMatch = String(poItem.item_weight).match(/(\d+\.?\d*)/);
            if (weightMatch) {
              totalWeight = weightMatch[1];
            }
          }

          // Store purchase order line id (tblPurchaseItems.id) for API `id` field
          const poLineId = poItem.id != null
            ? (typeof poItem.id === "number" ? poItem.id : parseInt(String(poItem.id).trim(), 10))
            : "";

          const stockItemId =
            stockItem && stockItem.id != null
              ? typeof stockItem.id === "number"
                ? stockItem.id
                : parseInt(String(stockItem.id).trim(), 10)
              : "";

          newItems.push({
            item_id: !Number.isNaN(stockItemId) && stockItemId !== "" ? stockItemId : "",
            po_line_id:
              orderLinkMode === "purchase_order" && !Number.isNaN(poLineId) && poLineId !== ""
                ? poLineId
                : "",
            sro_line_id:
              orderLinkMode === "sales_return" && !Number.isNaN(poLineId) && poLineId !== ""
                ? poLineId
                : "",
            quality_id: "",
            brand: poItem.brand || "",
            our_brand: poItem.our_brand || "",
            number_of_bags: numberOfBags,
            total_weight: totalWeight,
            tare_weight: "",
            net_weight: "",
            sample_weight: "",
            unloaded_weight: "",
            lab_tests: [],
            remarks: ""
          });
        }

        // Update form with new items - use a delay to ensure stock items are in state
        // This ensures the dropdown can find and display the selected items
        setTimeout(() => {
          form.setValue("items", newItems, { shouldValidate: true, shouldDirty: true });
          newItems.forEach((row, idx) => {
            const bags = parseFloat(row.number_of_bags);
            if (!Number.isFinite(bags) || bags <= 0) return;
            if (row.total_weight) {
              form.setValue(`items.${idx}.total_weight`, row.total_weight, {
                shouldDirty: true,
                shouldValidate: true,
              });
              return;
            }
            applyTotalWeightFromBags(idx, bags);
          });
          form.setValue(
            "broker_name",
            orderLinkMode === "purchase_order" && selectedOrderData.broker && selectedOrderData.broker.name
              ? selectedOrderData.broker.name
              : "",
            { shouldValidate: true, shouldDirty: true }
          );
        }, 150);

        // Update party information if available
        // Priority: autofill_party_id > party_id > search by name
        let partyIdToSet = null;
        let foundParty = null;

        // First, try to use autofill_party_id if available (most reliable)
        if (selectedOrderData.autofill_party_id) {
          partyIdToSet = selectedOrderData.autofill_party_id;
        }
        // Fallback to party_id if autofill_party_id is not available
        else if (selectedOrderData.party_id) {
          partyIdToSet = selectedOrderData.party_id;
        }

        // If we have a party ID, verify it exists in the parties list
        if (partyIdToSet) {
          const poPartyId = typeof partyIdToSet === 'number' ? partyIdToSet : parseInt(partyIdToSet.toString().trim(), 10);

          // Check in current parties list - handle both string and number IDs
          foundParty = parties.find(p => {
            const partyId = typeof p.id === 'number' ? p.id : parseInt((p.id || "").toString().trim(), 10);
            return !isNaN(partyId) && !isNaN(poPartyId) && partyId === poPartyId;
          });

          // Also check additionalParties if not found in main parties list
          if (!foundParty) {
            foundParty = additionalParties.find(p => {
              const partyId = typeof p.id === 'number' ? p.id : parseInt((p.id || "").toString().trim(), 10);
              return !isNaN(partyId) && !isNaN(poPartyId) && partyId === poPartyId;
            });
          }
        }

        // If party not found by ID, search by name
        if (!foundParty && selectedOrderData.party) {
          try {
            const updatedParties = await searchPartyByName(selectedOrderData.party, false);

            // Only proceed if we got results (handle empty response gracefully)
            if (updatedParties && updatedParties.length > 0) {
              // Find the best match from search results - prioritize exact match
              foundParty = updatedParties.find(
                (item) => {
                  const itemName = (item.name || "").toLowerCase().trim();
                  const poPartyName = (selectedOrderData.party || "").toLowerCase().trim();
                  return itemName === poPartyName;
                }
              ) || updatedParties.find(
                (item) => {
                  const itemName = (item.name || "").toLowerCase().trim();
                  const poPartyName = (selectedOrderData.party || "").toLowerCase().trim();
                  return itemName.includes(poPartyName) || poPartyName.includes(itemName);
                }
              ) || updatedParties[0]; // Use first result if no match

              // If found via search, use the found party's ID
              if (foundParty && foundParty.id) {
                partyIdToSet = foundParty.id;

                // Immediately ensure party is in additionalParties for dropdown display
                // This is important because allParties depends on additionalParties
                setAdditionalParties(prev => {
                  const exists = prev.find(p => p.id === foundParty.id);
                  if (!exists) {
                    return [...prev, foundParty];
                  }
                  return prev;
                });
              }
            }
            // If empty response, keep as is (don't set party)
          } catch (error) {
            console.error('Error searching for party:', error);
            // On error, keep as is (don't set party)
          }
        } else if (foundParty && foundParty.id) {
          // If found in existing lists, use the found party's ID (in case of any mismatch)
          partyIdToSet = foundParty.id;
        }

        // Set the party if we have a valid ID
        if (partyIdToSet) {
          // Set the form value - the party should now be in allParties due to state update above
          // Use a small delay to ensure React has processed the state update
          setTimeout(() => {
            form.setValue("party_id", partyIdToSet, { shouldValidate: true, shouldDirty: true });
          }, 150);
        }

        // Reset auto-filling flag and trigger re-render
        setTimeout(() => {
          setIsAutoFilling(false);
          setAutoFillTrigger(prev => prev + 1);
        }, 200);
      };

      processPOItems();
  }, [
    selectedOrderData?.id,
    selectedOrderData?.purchase_items?.length,
    orderLinkMode,
    allStockItems.length,
    parties.length,
    additionalParties.length,
    form,
    searchStockItemByName,
    searchPartyByName,
    isAutoFilling,
  ]);


  // Fetch item groups
  const { data: itemGroups = [], isLoading: itemGroupsLoading } = useQuery({
    queryKey: ['item-groups'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/test-params-groups/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch lab test parameters (will be filtered based on popup selection)
  const { data: labTestParams = [], isLoading: labTestParamsLoading } = useQuery({
    queryKey: ['lab-test-params'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/lab-test-params/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });


  // Auto-fill disabled - removed poStockItemsList
  const [isItemSelectOpen, setIsItemSelectOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");

  const filteredStockItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(itemSearchTerm.toLowerCase())
  );

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/report/add-inward/`, data);
      const responseData = await response.json();
      return {
        httpStatus: response.status,
        ...responseData,
        // Prefer API body status, fall back to HTTP status
        status: responseData?.status ?? response.status,
      };
    },
    onSuccess: (data) => {
      const ok =
        data.httpStatus === 201 ||
        data.httpStatus === 200 ||
        data.status === 201 ||
        data.status === 200;
      if (ok) {
        const inwardId = data?.data?.inward_entry_id || data?.data?.id;
        toast({
          title: "Success",
          description: data.message || "Inward entry created successfully",
        });
        Object.values(itemVoiceRecordersRef.current || {}).forEach((inst) => {
          inst?.clearVoiceRemarks?.();
        });
        itemVoiceRecordersRef.current = {};
        form.reset();
        setSelectedLabTestParams({});
        setIsLabTestPopupOpen({});
        setPopupSelectedItemGroup({});
        setPopupSelectedParams({});
        setPopupSelectedTestType({});
        setLabTestParamSearch({});
        setSelectedPOData(null);
        setSelectedSROData(null);
        // Leave add page so deep-link prefill does not look like "nothing happened"
        if (inwardId) {
          setLocation(`/inward-details/${inwardId}`);
        } else {
          setLocation("/reports/inward-list");
        }
        return;
      }

      toast({
        title: "Error",
        description:
          data.message ||
          data.error ||
          data.details ||
          "Failed to create inward entry",
        variant: "destructive",
      });
    },
    onError: (error) => {
      console.error("Submit error:", error);
      let description = error?.message || "Failed to create inward entry";
      // apiRequest throws "400: {json}" — surface API message when present
      try {
        const raw = String(error?.message || "");
        const jsonStart = raw.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(raw.slice(jsonStart));
          description =
            parsed.message || parsed.error || parsed.details || description;
        }
      } catch {
        // keep original description
      }
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Clear lab test parameters state on page load/refresh
  useEffect(() => {
    setSelectedLabTestParams({});
    setIsLabTestPopupOpen({});
    setPopupSelectedItemGroup({});
    setPopupSelectedParams({});
    setPopupSelectedTestType({});
    setLabTestParamSearch({});
  }, []);


  const addNewItem = () => {
    const newIndex = itemFields.length;
    appendItem({
      item_id: "",
      po_line_id: "",
      sro_line_id: "",
      number_of_bags: "",
      quality_id: "",
      brand: "Binmark",
      our_brand: "",
      total_weight: "",
      tare_weight: "",
      net_weight: "",
      sample_weight: "",
      unloaded_weight: "",
      lab_tests: [],
      remarks: "",
      voice_remarks: ""
    });
    setItemQtyWeightMode((prev) => ({ ...prev, [newIndex]: "quantity" }));
  };

  // addJaliDetail function removed as jali_details is not supported by the API


  function CustomItemSelect({ items, value, onChange, placeholder = "Select item", index }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredItems = items.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedItem = items.find(item => item.id.toString() === value?.toString());

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full border rounded px-3 py-2 text-left flex items-center justify-between"
          >
            <span>{selectedItem?.name || placeholder}</span>
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[300px] p-2">
          <Input
            autoFocus
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-60 overflow-auto">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer px-3 py-2 hover:bg-muted rounded"
                  onClick={() => {
                    onChange(item.id);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  {item.name}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-red-500">
                No records found
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }




  // removeJaliDetail function removed as jali_details is not supported by the API

  // Lab test parameter search function
  const handleLabTestParamSearch = (itemIndex, searchTerm) => {
    setLabTestParamSearch(prev => ({
      ...prev,
      [itemIndex]: searchTerm
    }));
  };

  // Popup handlers
  const handleOpenLabTestPopup = (itemIndex) => {
    setIsLabTestPopupOpen(prev => ({
      ...prev,
      [itemIndex]: true
    }));
    // Initialize popup state for this item
    setPopupSelectedItemGroup(prev => ({
      ...prev,
      [itemIndex]: null
    }));
    setPopupSelectedParams(prev => ({
      ...prev,
      [itemIndex]: []
    }));
    setPopupSelectedTestType(prev => ({
      ...prev,
      [itemIndex]: "all"
    }));
  };

  const handleCloseLabTestPopup = (itemIndex) => {
    setIsLabTestPopupOpen(prev => ({
      ...prev,
      [itemIndex]: false
    }));
  };

  const handlePopupItemGroupChange = (itemIndex, itemGroup) => {
    setPopupSelectedItemGroup(prev => ({
      ...prev,
      [itemIndex]: itemGroup
    }));
    // Clear selected params when item group changes
    setPopupSelectedParams(prev => ({
      ...prev,
      [itemIndex]: []
    }));
    // Automatically set to "pre_test" when item group is selected in add inward page
    setPopupSelectedTestType(prev => ({
      ...prev,
      [itemIndex]: itemGroup ? "pre_test" : "all"
    }));
  };

  const handlePopupParamToggle = (itemIndex, paramId) => {
    const currentSelected = popupSelectedParams[itemIndex] || [];
    const isSelected = currentSelected.includes(paramId);

    if (isSelected) {
      setPopupSelectedParams(prev => ({
        ...prev,
        [itemIndex]: currentSelected.filter(id => id !== paramId)
      }));
    } else {
      setPopupSelectedParams(prev => ({
        ...prev,
        [itemIndex]: [...currentSelected, paramId]
      }));
    }
  };

  const handleApplyLabTestSelection = (itemIndex) => {
    const selectedParams = popupSelectedParams[itemIndex] || [];

    // Update the main form with selected parameters
    setSelectedLabTestParams(prev => ({
      ...prev,
      [itemIndex]: selectedParams
    }));

    // Add to form data
    const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];
    const newTests = selectedParams.map(paramId => ({
      test_param_id: paramId,
      value: "",
      remarks: ""
    }));
    form.setValue(`items.${itemIndex}.lab_tests`, newTests);

    // Close popup
    handleCloseLabTestPopup(itemIndex);
  };

  // Lab test parameter management functions
  const handleLabTestParamToggle = (itemIndex, paramId) => {
    const currentSelected = selectedLabTestParams[itemIndex] || [];
    const isSelected = currentSelected.includes(paramId);

    let updatedSelected;
    if (isSelected) {
      // Remove parameter
      updatedSelected = currentSelected.filter(id => id !== paramId);
      // Remove from form data
      const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];
      const updatedLabTests = currentLabTests.filter(test => test.test_param_id !== paramId);
      form.setValue(`items.${itemIndex}.lab_tests`, updatedLabTests);
    } else {
      // Add parameter
      updatedSelected = [...currentSelected, paramId];
      // Add to form data
      const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];
      const newTest = {
        test_param_id: paramId,
        value: "",
        remarks: ""
      };
      form.setValue(`items.${itemIndex}.lab_tests`, [...currentLabTests, newTest]);
    }

    setSelectedLabTestParams(prev => ({
      ...prev,
      [itemIndex]: updatedSelected
    }));
  };

  const handleAddLabTestParam = (itemIndex, paramId) => {
    const currentSelected = selectedLabTestParams[itemIndex] || [];

    if (!currentSelected.includes(paramId)) {
      const updatedSelected = [...currentSelected, paramId];
      setSelectedLabTestParams(prev => ({
        ...prev,
        [itemIndex]: updatedSelected
      }));

      // Add to form data
      const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];
      const newTest = {
        test_param_id: paramId,
        value: "",
        image: "" // Add image field for parameters that require images
      };
      form.setValue(`items.${itemIndex}.lab_tests`, [...currentLabTests, newTest]);
    }
  };

  const handleAddMultipleLabTestParams = (itemIndex, paramIds) => {
    const currentSelected = selectedLabTestParams[itemIndex] || [];
    const newParams = paramIds.filter(id => !currentSelected.includes(id));

    if (newParams.length > 0) {
      const updatedSelected = [...currentSelected, ...newParams];
      setSelectedLabTestParams(prev => ({
        ...prev,
        [itemIndex]: updatedSelected
      }));

      // Add to form data
      const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];
      const newTests = newParams.map(paramId => ({
        test_param_id: paramId,
        value: ""
      }));
      form.setValue(`items.${itemIndex}.lab_tests`, [...currentLabTests, ...newTests]);
    }
  };

  const handleRemoveLabTestParam = (itemIndex, paramId) => {
    const currentSelected = selectedLabTestParams[itemIndex] || [];
    const updatedSelected = currentSelected.filter(id => id !== paramId);

    setSelectedLabTestParams(prev => ({
      ...prev,
      [itemIndex]: updatedSelected
    }));

    // Remove from form data
    const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];
    const updatedLabTests = currentLabTests.filter(test => test.test_param_id !== paramId);
    form.setValue(`items.${itemIndex}.lab_tests`, updatedLabTests);

    // Clear validation error for this parameter
    const errorKey = `${itemIndex}-${paramId}`;
    setLabTestValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  };

  // State to store validation errors for lab test values
  const [labTestValidationErrors, setLabTestValidationErrors] = useState({});

  const isColorLabTestParam = (param) =>
    String(param?.parameter_name ?? "").trim().toLowerCase() === "color";

  // Color test value: letters, numbers, and spaces only, max 20 characters
  const sanitizeLabTestColorValue = (rawValue) => {
    const text = String(rawValue ?? "");
    return text.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 20);
  };

  // Validation function for lab test values
  const validateLabTestValue = (param, value) => {
    if (isColorLabTestParam(param)) {
      if (param.is_validation_required && (!value || String(value).trim() === "")) {
        return "Please enter a value";
      }
      return null;
    }

    if (!param.is_validation_required || !value || value.trim() === "") {
      return null; // No validation error if validation not required or value is empty
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return "Please enter a valid number";
    }

    if (param.min_value !== null && param.min_value !== undefined && numValue < param.min_value) {
      return `Value must be at least ${param.min_value} ${param.unit || ''}`;
    }

    if (param.max_value !== null && param.max_value !== undefined && numValue > param.max_value) {
      return `Value must be at most ${param.max_value} ${param.unit || ''}`;
    }

    return null; // No error
  };

  // Lab test values should be numeric only (digits with optional single decimal point).
  const sanitizeLabTestNumericValue = (rawValue) => {
    const text = String(rawValue ?? "");
    let cleaned = text.replace(/[^\d.]/g, "");
    const dotIndex = cleaned.indexOf(".");
    if (dotIndex !== -1) {
      cleaned = `${cleaned.slice(0, dotIndex + 1)}${cleaned.slice(dotIndex + 1).replace(/\./g, "")}`;
    }
    const [intPart, decimalPart] = cleaned.split(".");
    const limitedIntPart = (intPart || "").slice(0, 3);
    if (cleaned.includes(".")) {
      return `${limitedIntPart}.${decimalPart || ""}`;
    }
    return limitedIntPart;
  };

  const formatCountableTotal = (value) => {
    if (!Number.isFinite(value)) return "0";
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  };

  const handleLabTestValueChange = (itemIndex, paramId, value) => {
    const param = labTestParams.find((p) => p.id === paramId);
    const sanitizedValue =
      param && isColorLabTestParam(param)
        ? sanitizeLabTestColorValue(value)
        : sanitizeLabTestNumericValue(value);
    const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];
    const updatedLabTests = currentLabTests.map(test =>
      test.test_param_id === paramId
        ? { ...test, value: sanitizedValue }
        : test
    );
    form.setValue(`items.${itemIndex}.lab_tests`, updatedLabTests);

    // Validate the value instantly
    if (param) {
      const error = validateLabTestValue(param, sanitizedValue);
      const errorKey = `${itemIndex}-${paramId}`;
      setLabTestValidationErrors(prev => {
        if (error) {
          return { ...prev, [errorKey]: error };
        } else {
          const newErrors = { ...prev };
          delete newErrors[errorKey];
          return newErrors;
        }
      });

      // Show toast for validation error
      if (error) {
        toast({
          title: "Validation Error",
          description: error,
          variant: "destructive",
          duration: 2000,
        });
      }
    }
  };

  const handleLabTestImageChange = async (itemIndex, paramId, file) => {
    if (!file) return;

    const currentLabTests = form.getValues(`items.${itemIndex}.lab_tests`) || [];

    if (!allowMultipleInwardImages) {
      const hasExistingImage = currentLabTests.some(
        (test) => test.test_param_id !== paramId && String(test.image || "").trim()
      );
      if (hasExistingImage) {
        toast({
          title: "Single image only",
          description: "Only one lab test image is allowed per item.",
          variant: "destructive",
        });
        return;
      }
    }

    const uploadKey = `${itemIndex}-${paramId}`;
    setLabTestImageUploading((prev) => ({ ...prev, [uploadKey]: true }));

    try {
      const url = await uploadMediaFile(file);
      const updatedLabTests = currentLabTests.map((test) =>
        test.test_param_id === paramId ? { ...test, image: url } : test
      );
      form.setValue(`items.${itemIndex}.lab_tests`, updatedLabTests);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload lab test image",
        variant: "destructive",
      });
    } finally {
      setLabTestImageUploading((prev) => {
        const next = { ...prev };
        delete next[uploadKey];
        return next;
      });
    }
  };

  const getValidationStatus = (param) => {
    if (!param.is_validation_required) {
      return { status: "none", text: "No Validation", icon: CheckCircle, color: "text-gray-500" };
    }

    if (param.min_value && param.max_value) {
      return { status: "range", text: `${param.min_value} - ${param.max_value} ${param.unit || ''}`, icon: AlertTriangle, color: "text-blue-500" };
    }

    return { status: "required", text: "Validation Required", icon: AlertTriangle, color: "text-orange-500" };
  };

  // Get filtered lab test parameters for popup
  const getFilteredLabTestParams = (itemIndex) => {
    const selectedItemGroup = popupSelectedItemGroup[itemIndex];
    const selectedTestType = popupSelectedTestType[itemIndex] || "all";

    let filtered = labTestParams;

    // First filter by item group if selected
    if (selectedItemGroup) {
      filtered = filtered.filter(param =>
        param.item_groups && param.item_groups.some(group => group.id === selectedItemGroup.id)
      );
    }

    // Then filter by test type if selected
    if (selectedTestType && selectedTestType !== "all") {
      filtered = filtered.filter(param => {
        if (!param.test_type) return false;
        // Filter based on test_type field
        if (selectedTestType === "pre_test") {
          return param.test_type === "pre_test" || param.test_type === "both";
        } else if (selectedTestType === "post_test") {
          return param.test_type === "post_test" || param.test_type === "both";
        }
        return true;
      });
    }

    return filtered;
  };

  const onSubmit = async (data) => {
    try {
      // Helper function to safely convert to decimal
      const toDecimal = (value) => {
        if (!value || value === "") return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };

      // Helper function to safely convert to integer
      const toInteger = (value) => {
        if (!value || value === "") return null;
        const num = parseInt(value);
        return isNaN(num) ? null : num;
      };

      const selectedStockItems = (data.items || []).filter((item) => hasValidStockItemId(item.item_id));
      if (selectedStockItems.length === 0) {
        form.setError("items", {
          type: "manual",
          message: "At least one stock item must be selected",
        });
        const firstEmptyIndex = (data.items || []).findIndex((item) => !hasValidStockItemId(item.item_id));
        if (firstEmptyIndex >= 0) {
          form.setError(`items.${firstEmptyIndex}.item_id`, {
            type: "manual",
            message: "Stock item is required",
          });
        }
        toast({
          title: "Validation Error",
          description: "Select at least one stock item before creating the inward entry.",
          variant: "destructive",
        });
        return;
      }

      const selectedPartyForSubmit = allParties.find(
        (p) => Number(p.id) === Number(data.party_id),
      );
      if (
        ledgerNameIndicatesURD(selectedPartyForSubmit?.name) &&
        !(String(data.party_name || "").trim())
      ) {
        form.setError("party_name", {
          type: "manual",
          message: "Party name is required for this ledger (URD)",
        });
        toast({
          title: "Validation Error",
          description: "Enter party name for the selected URD ledger.",
          variant: "destructive",
        });
        return;
      }

      // Validate: number_of_bags should not be more than qty from PO response
      for (let itemIndex = 0; itemIndex < data.items.length; itemIndex++) {
        const maxAllowed = getMaxAllowedBagsForIndex(itemIndex);
        if (maxAllowed == null) continue;
        const enteredBags = parseFloat(String(data.items[itemIndex]?.number_of_bags ?? ""));
        if (!Number.isNaN(enteredBags) && enteredBags > maxAllowed) {
          form.setError(`items.${itemIndex}.number_of_bags`, {
            type: "manual",
            message: `Number of bags cannot be more than qty (${maxAllowed})`
          });
          toast({
            title: "Validation Error",
            description: `Item ${itemIndex + 1}: Number of bags cannot exceed qty (${maxAllowed}).`,
            variant: "destructive"
          });
          return;
        }
      }

      // Wait for ALL per-item voice uploads to finish before we send the
      // payload (each item owns its own recorder/upload state).
      const itemVoiceInstances = Object.values(itemVoiceRecordersRef.current || {});
      for (const inst of itemVoiceInstances) {
        if (!inst) continue;
        const ok = await inst.waitForVoiceUploadIfNeeded();
        if (!ok) {
          toast({
            title: "Voice upload pending",
            description: "Wait for voice remarks to finish uploading, then save again.",
            variant: "destructive",
          });
          return;
        }
      }
      // Resolve final URLs after upload completion (refs hold latest values).
      const itemVoiceUrls = data.items.map((_, idx) => {
        const fieldId = itemFields[idx]?.id;
        const inst = fieldId ? itemVoiceRecordersRef.current[fieldId] : null;
        const fromInstance = inst ? inst.getVoiceUrlForSubmit() : "";
        return (fromInstance || data.items[idx]?.voice_remarks || "").trim();
      });

      const purchaseOrderId =
        orderLinkMode === "purchase_order" ? toInteger(data.purchase_order_id) : null;
      const salesReturnId =
        orderLinkMode === "sales_return" && hasSalesReturnAccess
          ? toInteger(data.sales_return_id)
          : null;

      // Transform data to match exact API requirements
      const transformedData = {
        party_id: toInteger(data.party_id),
        vehicle_no: (data.vehicle_no || "").trim().toUpperCase(),
        bill_no: data.bill_no || "",
        broker_name: data.broker_name || "",
        party_name: data.party_name || "",
        purchase_order_id: purchaseOrderId,
        ...(salesReturnId ? { sales_return_id: salesReturnId } : {}),
        remarks: data.remarks || "",
        items: data.items.map((item, itemIndex) => {
          const itemVoiceUrl = itemVoiceUrls[itemIndex] || "";
          const stockItemId = toInteger(item.item_id);
          const orderLineId =
            orderLinkMode === "sales_return"
              ? toInteger(item.sro_line_id)
              : toInteger(item.po_line_id);
          const itemPayload = {
            item_id: stockItemId,
            ...((purchaseOrderId || salesReturnId) && orderLineId != null ? { id: orderLineId } : {}),
            number_of_bags: toInteger(item.number_of_bags),
            quality_id: toInteger(item.quality_id),
            item_group_id: popupSelectedItemGroup[itemIndex]?.id ? toInteger(popupSelectedItemGroup[itemIndex].id) : null,
            brand: (item.brand || "").trim() || "Binmark",
            our_brand: (item.our_brand || "").trim() || "Regular",
            remarks: item.remarks || "",
            ...(voiceRemarksEnabled && itemVoiceUrl ? { voice_remarks: itemVoiceUrl } : {}),
            // Transform lab tests data
            lab_tests: (item.lab_tests || [])
              .filter((test) => {
                const hasParam = toInteger(test.test_param_id) !== null;
                const hasValue = String(test?.value ?? "").trim() !== "";
                return hasParam && hasValue;
              })
              .map((test) => {
                const paramDef = labTestParams.find((p) => p.id === test.test_param_id);
                const testValue =
                  paramDef && isColorLabTestParam(paramDef)
                    ? sanitizeLabTestColorValue(test.value)
                    : toDecimal(test.value);
                return {
                  test_param_id: toInteger(test.test_param_id),
                  value: testValue,
                  remarks: test.remarks || "",
                  image: test.image || "",
                };
              })
          };

          const itemTareWeight = toDecimal(item.tare_weight);
          const itemNetWeight = toDecimal(item.net_weight);
          const itemSampleWeight = toDecimal(item.sample_weight);
          const itemUnloadedWeight = toDecimal(item.unloaded_weight);
          const itemTotalWeight = toDecimal(item.total_weight);

          if (itemTareWeight !== null) itemPayload.tare_weight = itemTareWeight;
          if (itemNetWeight !== null) itemPayload.net_weight = itemNetWeight;
          if (itemSampleWeight !== null) itemPayload.sample_weight = itemSampleWeight;
          if (itemUnloadedWeight !== null) itemPayload.unloaded_weight = itemUnloadedWeight;
          if (itemTotalWeight !== null) itemPayload.total_weight = itemTotalWeight;

          return itemPayload;
        })
      };

      await submitMutation.mutateAsync(transformedData);
    } catch (error) {
      console.error("Form submission error:", error);
      // Mutation onError already toasts API failures; show anything else here
      if (!submitMutation.isError) {
        toast({
          title: "Error",
          description: error?.message || "Failed to save inward entry",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  // Check permissions before rendering
  if (permissionsLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        <div className="app-main-content flex items-center justify-center">
          <Loader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  // Check if user has create permission for inward
  if (!hasCreatePermission("inward")) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        <div className="app-main-content flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to create inward entries.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center space-x-4">

              <Button
                variant="outline"
                onClick={() => setLocation("/reports/inward-list")}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Inward Entry</h1>
              <p className="text-gray-600">Create new inward inventory entry</p>
            </div>

          </div>
          <Badge variant="outline" className="text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date().toLocaleDateString('en-GB')}
            </Badge>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-3 sm:p-4 min-h-0">
          <div className="max-w-7xl mx-auto">
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              // console.log("Form validation failed:", errors);
              // console.log("Form values:", form.getValues());
              // console.log("Form state:", form.formState);

              // Show detailed validation errors
              const errorMessages = [];
              if (errors.party_id) errorMessages.push("Party is required");
              if (errors.vehicle_no) errorMessages.push("Vehicle number is required");
              if (errors.items) {
                if (typeof errors.items.message === "string" && errors.items.message) {
                  errorMessages.push(errors.items.message);
                }
                if (Array.isArray(errors.items)) {
                  errors.items.forEach((itemError, index) => {
                    if (itemError?.item_id) errorMessages.push(`Item ${index + 1}: Stock item is required`);
                    if (itemError?.number_of_bags) errorMessages.push(`Item ${index + 1}: Number of bags is required`);
                  });
                }
              }

              toast({
                title: "Validation Error",
                description: errorMessages.length > 0 ? errorMessages.join(", ") : "Please check all required fields",
                variant: "destructive",
              });
            })} className="space-y-3">
              {/* Basic Information */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-black text-white rounded-t-lg px-3 py-2">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <FileText className="h-4 w-4" />
                    <span>Basic Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2">
                    {hasSalesReturnAccess ? (
                      <div className="md:col-span-12 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 mr-1">Link to:</span>
                        <Button
                          type="button"
                          size="sm"
                          variant={orderLinkMode === "purchase_order" ? "default" : "outline"}
                          className={orderLinkMode === "purchase_order" ? "bg-black hover:bg-gray-800" : ""}
                          onClick={() => switchOrderLinkMode("purchase_order")}
                        >
                          Purchase Order
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={orderLinkMode === "sales_return" ? "default" : "outline"}
                          className={orderLinkMode === "sales_return" ? "bg-black hover:bg-gray-800" : ""}
                          onClick={() => switchOrderLinkMode("sales_return")}
                        >
                          Sales Return
                        </Button>
                      </div>
                    ) : null}

                    {orderLinkMode === "purchase_order" || !hasSalesReturnAccess ? (
                    <div className="md:col-span-4">
                      <Label htmlFor="purchase_order_id">PO Number</Label>
                      <Controller
                        name="purchase_order_id"
                        control={form.control}
                        render={({ field }) => {
                          // Find the currently selected PO object by id
                          const selectedPO = purchaseOrders.find(po => po.id === field.value);

                          return (
                            <div className="relative w-full">
                              <Popover open={poDropdownOpen} onOpenChange={setPoDropdownOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={poDropdownOpen}
                                    className="w-full justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    onPaste={(e) => {
                                      const pastedValue = (e.clipboardData?.getData("text") || "")
                                        .replace(/\s+/g, " ")
                                        .trim();
                                      if (!pastedValue) return;
                                      e.preventDefault();
                                      setPoSearchTerm(pastedValue);
                                      setDebouncedPoSearch(pastedValue);
                                      setPoDropdownOpen(true);
                                    }}
                                  >
                                    <span className="truncate">
                                      {selectedPO ? selectedPO.voucher_number : "Select PO Number (Optional)"}
                                    </span>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-[--radix-popover-trigger-width] p-0 z-50"
                                  align="start"
                                  side="bottom"
                                  sideOffset={4}
                                >
                                  <Command shouldFilter={false}>
                                    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                      <Input
                                        placeholder="Search / paste PO number..."
                                        value={poSearchTerm}
                                        className="h-11 border-0 shadow-none focus-visible:ring-0 px-0"
                                        onChange={(e) => setPoSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            setDebouncedPoSearch(poSearchTerm.trim());
                                          }
                                        }}
                                        onPaste={(e) => {
                                          const pastedValue = (e.clipboardData?.getData("text") || "")
                                            .replace(/\s+/g, " ")
                                            .trim();
                                          if (!pastedValue) return;
                                          e.preventDefault();
                                          setPoSearchTerm(pastedValue);
                                          setDebouncedPoSearch(pastedValue);
                                        }}
                                        autoFocus
                                      />
                                    </div>
                                    <CommandList>
                                      <CommandEmpty>
                                        {purchaseOrdersLoading ? (
                                          "Loading..."
                                        ) : purchaseOrders.length === 0 ? (
                                          "No POs found."
                                        ) : (
                                          "No POs match your search."
                                        )}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        <ScrollArea
                                          ref={poScrollAreaRef}
                                          className="h-64"
                                        >
                                          {/* Optional/No Selection Option */}
                                          <CommandItem
                                            key="optional"
                                            value="Optional"
                                            onSelect={() => handlePOSelect("0", field)}
                                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-3">
                                              <Check
                                                className={`h-4 w-4 ${!field.value || field.value === 0 ? "opacity-100 text-blue-600" : "opacity-0"
                                                  }`}
                                              />
                                              <div>
                                                <div className="font-medium text-gray-900">Optional (No PO)</div>
                                              </div>
                                            </div>
                                          </CommandItem>

                                          {/* Individual PO Numbers - Deduplicated by id */}
                                          {purchaseOrders.map((po) => (
                                            <CommandItem
                                              key={po.id}
                                              value={po.voucher_number}
                                              onSelect={() => handlePOSelect(po.id.toString(), field)}
                                              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                            >
                                              <div className="flex items-center gap-3">
                                                <Check
                                                  className={`h-4 w-4 ${field.value === po.id ? "opacity-100 text-blue-600" : "opacity-0"
                                                    }`}
                                                />
                                                <div>
                                                  <div className="font-medium text-gray-900">{po.voucher_number}</div>
                                                </div>
                                              </div>
                                            </CommandItem>
                                          ))}
                                          {/* Infinite scroll loading */}
                                          {isFetchingNextPOPage && (
                                            <div className="p-2 text-center text-sm">Loading more...</div>
                                          )}
                                          {/* Show total count if available */}
                                          {purchaseOrdersPages?.pages?.[0]?.totalCount && (
                                            <div className="p-2 text-center text-xs text-gray-500">
                                              Showing {purchaseOrders.length} of {purchaseOrdersPages.pages[0].totalCount} POs
                                              {hasNextPOPage && " - Scroll for more"}
                                            </div>
                                          )}
                                        </ScrollArea>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {selectedPO && (
                                <button
                                  type="button"
                                  className="absolute right-8 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-gray-200 shrink-0 rounded flex items-center justify-center z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handlePOSelect("0", field);
                                  }}
                                  aria-label="Clear selection"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        }}
                      />
                    </div>
                    ) : (
                    <div className="md:col-span-4">
                      <Label htmlFor="sales_return_id">Sales Return Number</Label>
                      <Controller
                        name="sales_return_id"
                        control={form.control}
                        render={({ field }) => {
                          const selectedSRO =
                            salesReturnOrders.find(
                              (sro) => Number(sro.id) === Number(field.value),
                            ) ||
                            (selectedSROData &&
                            Number(selectedSROData.id) === Number(field.value)
                              ? selectedSROData
                              : null);
                          return (
                            <div className="relative w-full">
                              <Popover open={sroDropdownOpen} onOpenChange={setSroDropdownOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={sroDropdownOpen}
                                    className="w-full justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    onPaste={(e) => {
                                      const pastedValue = (e.clipboardData?.getData("text") || "")
                                        .replace(/\s+/g, " ")
                                        .trim();
                                      if (!pastedValue) return;
                                      e.preventDefault();
                                      setSroSearchTerm(pastedValue);
                                      setDebouncedSroSearch(pastedValue);
                                      setSroDropdownOpen(true);
                                    }}
                                  >
                                    <span className="truncate">
                                      {selectedSRO
                                        ? selectedSRO.return_number
                                        : "Select Sales Return (Optional)"}
                                    </span>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start" side="bottom" sideOffset={4}>
                                  <Command shouldFilter={false}>
                                    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                      <Input
                                        placeholder="Search / paste sales return..."
                                        value={sroSearchTerm}
                                        className="h-11 border-0 shadow-none focus-visible:ring-0 px-0"
                                        onChange={(e) => setSroSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") setDebouncedSroSearch(sroSearchTerm.trim());
                                        }}
                                        onPaste={(e) => {
                                          const pastedValue = (e.clipboardData?.getData("text") || "")
                                            .replace(/\s+/g, " ")
                                            .trim();
                                          if (!pastedValue) return;
                                          e.preventDefault();
                                          setSroSearchTerm(pastedValue);
                                          setDebouncedSroSearch(pastedValue);
                                        }}
                                        autoFocus
                                      />
                                    </div>
                                    <CommandList>
                                      <CommandEmpty>
                                        {salesReturnOrdersLoading ? "Loading..." : "No sales returns found."}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        <ScrollArea ref={sroScrollAreaRef} className="h-64">
                                          <CommandItem
                                            key="sro-optional"
                                            value="Optional"
                                            onSelect={() => handleSROSelect("0", field)}
                                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-3">
                                              <Check className={`h-4 w-4 ${!field.value || field.value === 0 ? "opacity-100 text-blue-600" : "opacity-0"}`} />
                                              <div className="font-medium text-gray-900">Optional (No Sales Return)</div>
                                            </div>
                                          </CommandItem>
                                          {salesReturnOrders.map((sro) => (
                                            <CommandItem
                                              key={sro.id}
                                              value={sro.return_number}
                                              onSelect={() => handleSROSelect(sro.id.toString(), field)}
                                              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                            >
                                              <div className="flex items-center gap-3">
                                                <Check className={`h-4 w-4 ${Number(field.value) === Number(sro.id) ? "opacity-100 text-blue-600" : "opacity-0"}`} />
                                                <div>
                                                  <div className="font-medium text-gray-900">{sro.return_number}</div>
                                                  {sro.customer_name ? (
                                                    <div className="text-xs text-gray-500">{sro.customer_name}</div>
                                                  ) : null}
                                                </div>
                                              </div>
                                            </CommandItem>
                                          ))}
                                          {isFetchingNextSROPage ? (
                                            <div className="p-2 text-center text-sm">Loading more...</div>
                                          ) : null}
                                        </ScrollArea>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {selectedSRO ? (
                                <button
                                  type="button"
                                  className="absolute right-8 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-gray-200 shrink-0 rounded flex items-center justify-center z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleSROSelect("0", field);
                                  }}
                                  aria-label="Clear selection"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              ) : null}
                            </div>
                          );
                        }}
                      />
                    </div>
                    )}

                    <div className="md:col-span-5">
                      <Label htmlFor="party_id">Ledgers</Label>
                      <Controller
                        name="party_id"
                        control={form.control}
                        render={({ field }) => {
                          // Auto-fill party when PO / sales return is selected
                          const selectedPartyId = field.value || 0;
                          const selectedParty =
                            allParties.find(
                              (p) => Number(p.id) === Number(selectedPartyId),
                            ) ||
                            (selectedOrderData &&
                            Number(
                              selectedOrderData.autofill_party_id ||
                                selectedOrderData.party_id ||
                                selectedOrderData.customer_id,
                            ) === Number(selectedPartyId)
                              ? {
                                  id: selectedPartyId,
                                  name:
                                    selectedOrderData.party ||
                                    selectedOrderData.customer_name ||
                                    "Selected ledger",
                                }
                              : null);

                          return (
                            <Popover
                              open={partyDropdownOpen}
                              onOpenChange={(open) => {
                                // Prevent opening if linked order is selected
                                if (open && selectedOrderData) {
                                  return;
                                }
                                setPartyDropdownOpen(open);
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={partyDropdownOpen}
                                  disabled={!!selectedOrderData}
                                  className="w-full justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <span className="truncate">
                                    {selectedParty ? selectedParty.name : "Select Ledger"}
                                  </span>
                                  <div className="flex items-center gap-2 ml-2">
                                    {selectedParty && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 hover:bg-gray-200 shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePartySelect("0", field);
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                  </div>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[--radix-popover-trigger-width] p-0 z-50"
                                align="start"
                                side="bottom"
                                sideOffset={4}
                                avoidCollisions={false}
                              >
                                <Command shouldFilter={false}>
                                  <CommandInput
                                    ref={partySearchInputRef}
                                    placeholder="Search ledgers..."
                                    value={searchTerm}
                                    onValueChange={setSearchTerm}
                                  />
                                  <CommandList className="min-h-[16.5rem]">
                                    <CommandEmpty>
                                      {partiesFetching
                                        ? "Searching..."
                                        : allParties.length === 0
                                          ? "No ledgers found."
                                          : "No ledgers match your search."}
                                    </CommandEmpty>
                                    <CommandGroup>
                                      <ScrollArea
                                        className="h-64"
                                        onScroll={(e) => {
                                          const target = e.currentTarget;
                                          if (
                                            target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                                            hasNextPage &&
                                            !isFetchingNextPage
                                          ) {
                                            fetchNextPage();
                                          }
                                        }}
                                      >
                                        {allParties.map((party) => (
                                          <CommandItem
                                            key={party.id}
                                            value={party.name}
                                            onSelect={() => handlePartySelect(party.id.toString(), field)}
                                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-3">
                                              <Check
                                                className={`h-4 w-4 ${field.value === party.id ? "opacity-100 text-blue-600" : "opacity-0"
                                                  }`}
                                              />
                                              <div>
                                                <div className="font-medium text-gray-900">{party.name}</div>
                                              </div>
                                            </div>
                                          </CommandItem>
                                        ))}
                                        {/* Infinite scroll loading */}
                                        {isFetchingNextPage && (
                                          <div className="p-2 text-center text-sm">Loading more...</div>
                                        )}
                                      </ScrollArea>
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          );
                        }}
                      />
                      {form.formState.errors.party_id && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.party_id.message}
                        </p>
                      )}
                    </div>

                    {/* Party name: only for ledgers whose name includes URD / U R D */}
                    {(() => {
                      const watchedPartyId = form.watch("party_id");
                      const selectedParty = allParties.find((p) => p.id === watchedPartyId);
                      const isURDSelected = ledgerNameIndicatesURD(selectedParty?.name);

                      return isURDSelected ? (
                        <div className="md:col-span-4">
                          <Label htmlFor="party_name">Party Name</Label>
                          <Input
                            id="party_name"
                            placeholder="Enter party name"
                            maxLength={20}
                            {...form.register("party_name", {
                              onChange: (e) => {
                                e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                              },
                            })}
                          />
                          {form.formState.errors.party_name && (
                            <p className="text-red-500 text-sm mt-1">
                              {form.formState.errors.party_name.message}
                            </p>
                          )}
                        </div>
                      ) : null;
                    })()}

                    <div className="md:col-span-3">
                      <Label htmlFor="broker_name">Broker Name</Label>
                      <Input
                        id="broker_name"
                        placeholder="Enter broker name (optional)"
                        {...form.register("broker_name")}
                      />
                      {form.formState.errors.broker_name && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.broker_name.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <Label htmlFor="bill_no">Bill Number</Label>
                      <Controller
                        name="bill_no"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            id="bill_no"
                            placeholder="Enter bill number"
                            {...field}
                            // Auto-fill disabled - removed selectedPOData?.reference
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        )}
                      />
                      {form.formState.errors.bill_no && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.bill_no.message}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <Label htmlFor="vehicle_no">Vehicle Number</Label>
                      <Input
                        id="vehicle_no"
                        placeholder="Enter vehicle number"
                        maxLength={10}
                        className="uppercase"
                        {...(() => {
                          const reg = form.register("vehicle_no");
                          return {
                            ...reg,
                            onChange: (e) => {
                              const input = e.target;
                              const start = input.selectionStart;
                              const end = input.selectionEnd;
                              input.value = input.value.toUpperCase();
                              // keep the caret where the user was typing
                              input.setSelectionRange(start, end);
                              reg.onChange(e);
                            },
                          };
                        })()}
                      />
                      {form.formState.errors.vehicle_no && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.vehicle_no.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-6 flex items-end justify-end">
                      {poVoiceRemarksEnabled &&
                      orderLinkMode === "purchase_order" &&
                      resolvePoVoiceRemarksUrl(selectedPOData) ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                            Purchase Order Remarks
                          </span>
                          <VoiceRemarkPlaybackButton
                            url={resolvePoVoiceRemarksUrl(selectedPOData)}
                            title="Play purchase order voice remarks (reference only)"
                            size="icon"
                          />
                        </div>
                      ) : null}
                      {orderLinkMode === "sales_return" && selectedSROData?.remarks ? (
                        <div className="flex flex-col items-end gap-1 max-w-full">
                          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                            Sales Return Remarks
                          </span>
                          <span className="text-xs text-gray-700 text-right line-clamp-2">
                            {selectedSROData.remarks}
                          </span>
                        </div>
                      ) : null}
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-black text-white rounded-t-lg px-3 py-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4" />
                      <span>Items & Testing</span>
                    </div>
                    <Button type="button" onClick={addNewItem} size="sm" className="h-8 bg-white hover:bg-white/50 text-black  border-white/30">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {itemFields.map((item, itemIndex) => (
                    <div key={item.id} className="px-3 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          Item {itemIndex + 1}
                        </h4>
                        {itemFields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleRemoveItem(itemIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 items-start">
                        <div className="md:col-span-3 flex flex-col">
                          <Label className="mb-1 min-h-6 text-sm font-medium leading-none">Stock Item</Label>
                          <Controller
                            name={`items.${itemIndex}.item_id`}
                            control={form.control}
                            render={({ field }) => {
                              // Auto-fill disabled - removed auto-selection logic
                              const selectedStockId = field.value;
                              const stockOptionsForDropdown = allStockItems;

                              // Filter stock options based on search
                              const filteredStockOptions = React.useMemo(() => {
                                return stockOptionsForDropdown.filter((item) =>
                                  (item.name || "").toLowerCase().includes(stockSearch.toLowerCase())
                                );
                              }, [stockOptionsForDropdown, stockSearch]);

                              const poLineIdForRow = getOrderLineIdForRow(itemIndex);

                              // Auto-set stock item + order line when PO / sales return is selected
                              React.useEffect(() => {
                                if (
                                  selectedOrderData &&
                                  selectedOrderData.purchase_items?.[itemIndex] &&
                                  (!field.value || field.value === null || field.value === undefined) &&
                                  !clearedItems.has(itemIndex)
                                ) {
                                  const poItem = selectedOrderData.purchase_items[itemIndex];
                                  if (poItem?.item_id) {
                                    ensureStockItemFromPOInList(poItem);
                                  }

                                  const applyPoAutofill = async () => {
                                    let stockItem = null;
                                    if (poItem.item_id) {
                                      stockItem = allStockItems.find(
                                        (item) =>
                                          String(item.id) === String(poItem.item_id)
                                      );
                                    }
                                    if (!stockItem && poItem.stock_item) {
                                      const searchResults = await searchStockItemByName(
                                        poItem.stock_item
                                      );
                                      stockItem = searchResults?.[0] || null;
                                    }
                                    if (!stockItem && poItem.item_id) {
                                      stockItem = ensureStockItemFromPOInList(poItem);
                                    } else if (stockItem && poItem.item_id) {
                                      stockItem = ensureStockItemFromPOInList(poItem, stockItem) || stockItem;
                                    }
                                    const bagsStr = resolvePositiveOrderQty(poItem.qty, poItem.actual_qty);
                                    if (bagsStr) {
                                      form.setValue(`items.${itemIndex}.number_of_bags`, bagsStr, {
                                        shouldValidate: true,
                                        shouldDirty: true,
                                      });
                                    }
                                    if (stockItem?.id != null) {
                                      const stockId =
                                        typeof stockItem.id === "number"
                                          ? stockItem.id
                                          : parseInt(String(stockItem.id).trim(), 10);
                                      if (!Number.isNaN(stockId)) {
                                        form.setValue(`items.${itemIndex}.item_id`, stockId, {
                                          shouldValidate: true,
                                        });
                                      }
                                      const bags = parseFloat(bagsStr);
                                      if (Number.isFinite(bags) && bags > 0) {
                                        const totalWeight = computeTotalWeightFromBags(stockItem, bags);
                                        if (totalWeight) {
                                          form.setValue(`items.${itemIndex}.total_weight`, totalWeight, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                          });
                                        } else {
                                          applyTotalWeightFromBags(itemIndex, bags);
                                        }
                                      }
                                    }
                                    if (poItem?.id != null) {
                                      const poLineId =
                                        typeof poItem.id === "number"
                                          ? poItem.id
                                          : parseInt(String(poItem.id).trim(), 10);
                                      if (!Number.isNaN(poLineId)) {
                                        const lineField =
                                          orderLinkMode === "sales_return"
                                            ? `items.${itemIndex}.sro_line_id`
                                            : `items.${itemIndex}.po_line_id`;
                                        form.setValue(lineField, poLineId, {
                                          shouldValidate: false,
                                        });
                                      }
                                    }
                                  };
                                  applyPoAutofill();
                                }
                              }, [selectedOrderData, orderLinkMode, itemIndex, allStockItems, field.value, clearedItems]);

                              const selectedPoLine = selectedOrderData
                                ? getPoLineByFormLineId(poLineIdForRow)
                                : null;
                              const selectedStockItem = allStockItems.find((item) => {
                                const itemId =
                                  typeof item.id === "number"
                                    ? item.id
                                    : parseInt(String(item.id || "").trim(), 10);
                                const selectedId =
                                  typeof selectedStockId === "number"
                                    ? selectedStockId
                                    : parseInt(String(selectedStockId || "").trim(), 10);
                                return (
                                  !Number.isNaN(itemId) &&
                                  !Number.isNaN(selectedId) &&
                                  itemId === selectedId
                                );
                              });
                              const stockItemDisplayName = selectedPoLine
                                ? getPoLineDisplayName(selectedPoLine)
                                : selectedStockItem?.name || "Select Stock Item";

                              return (
                                <Popover
                                  open={stockDropdownOpen[itemIndex] || false}
                                  onOpenChange={(open) => {
                                    // Prevent opening if linked order is selected
                                    if (open && selectedOrderData) {
                                      return;
                                    }
                                    setStockDropdownOpen(prev => ({ ...prev, [itemIndex]: open }));
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={stockDropdownOpen[itemIndex] || false}
                                      disabled={!!selectedOrderData}
                                      className="w-full justify-between h-9 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <span className="truncate">
                                        {stockItemDisplayName}
                                      </span>
                                      <div className="flex items-center gap-2 ml-2">
                                        {selectedStockItem && (
                                          <span
                                            role="button"
                                            tabIndex={0}
                                            className="h-5 w-5 p-0 hover:bg-gray-200 shrink-0 inline-flex items-center justify-center rounded-sm cursor-pointer"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStockItemSelect("0", field, itemIndex);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleStockItemSelect("0", field, itemIndex);
                                              }
                                            }}
                                          >
                                            <X className="h-3 w-3" />
                                          </span>
                                        )}
                                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                      </div>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[--radix-popover-trigger-width] p-0 z-50"
                                    align="start"
                                    side="bottom"
                                    sideOffset={4}
                                  >
                                    <Command shouldFilter={false}>
                                      <CommandInput
                                        placeholder="Search stock items..."
                                        value={stockSearch}
                                        onValueChange={(value) => {
                                          setStockSearch(value);
                                          // Reset to page 1 when search changes
                                          if (value !== stockDebounced) {
                                            // Query will reset automatically when stockDebounced changes
                                          }
                                        }}
                                      />
                                      <CommandList>
                                        <CommandEmpty>
                                          {stockItemsLoading ? (
                                            "Loading stock items..."
                                          ) : allStockItems.length === 0 ? (
                                            stockSearch ? (
                                              `No stock items found for "${stockSearch}"`
                                            ) : (
                                              "No stock items found."
                                            )
                                          ) : (
                                            "No stock items match your search."
                                          )}
                                        </CommandEmpty>
                                        <CommandGroup>
                                          <ScrollArea
                                            className="h-64"
                                            onScroll={(e) => {
                                              const target = e.currentTarget;
                                              if (
                                                target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                                                hasNextStockPage &&
                                                !isFetchingNextStockPage
                                              ) {
                                                fetchNextStockPage();
                                              }
                                            }}
                                          >
                                            {allStockItems.map((stock) => (
                                              <CommandItem
                                                key={stock.id}
                                                value={stock.name}
                                                onSelect={() => handleStockItemSelect(stock.id.toString(), field, itemIndex)}
                                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                              >
                                                <div className="flex items-center gap-3">
                                                  <Check
                                                    className={`h-4 w-4 ${(() => {
                                                        const fieldId = typeof field.value === 'number' ? field.value : parseInt((field.value || "").toString().trim(), 10);
                                                        const stockId = typeof stock.id === 'number' ? stock.id : parseInt((stock.id || "").toString().trim(), 10);
                                                        return !isNaN(fieldId) && !isNaN(stockId) && fieldId === stockId;
                                                      })() ? "opacity-100 text-blue-600" : "opacity-0"
                                                      }`}
                                                  />
                                                  <div className="flex items-center space-x-2">
                                                    <Package className="h-4 w-4 text-blue-500" />
                                                    <div>
                                                      <div className="font-medium text-gray-900">{stock.name}</div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </CommandItem>
                                            ))}
                                            {/* Infinite scroll loading */}
                                            {isFetchingNextStockPage && (
                                              <div className="p-2 text-center text-sm">Loading more...</div>
                                            )}
                                            {stockItemsLoading && allStockItems.length === 0 && (
                                              <div className="p-2 text-center text-sm">Loading stock items...</div>
                                            )}
                                          </ScrollArea>
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              );
                            }}
                          />
                        </div>

                        <div className="md:col-span-3 flex flex-col">
                          <Label className="mb-1 min-h-6 text-sm font-medium leading-none">Supplier Brand</Label>
                          <Input
                            className="h-9"
                            placeholder="Binmark"
                            {...form.register(`items.${itemIndex}.brand`)}
                          />
                          {
                            form.formState.errors.items?.[itemIndex]?.brand && (
                              <p className="text-red-500 text-sm mt-1">
                                {form.formState.errors.items[itemIndex].brand.message}
                              </p>
                            )
                          }
                        </div>
                        <div className="md:col-span-3 flex flex-col">
                          <Label className="mb-1 min-h-6 text-sm font-medium leading-none">Our Brand</Label>
                          <Input
                            className="h-9"
                            placeholder="Regular"
                            {...form.register(`items.${itemIndex}.our_brand`)}
                          />
                          {
                            form.formState.errors.items?.[itemIndex]?.our_brand && (
                              <p className="text-red-500 text-sm mt-1">
                                {form.formState.errors.items[itemIndex].our_brand.message}
                              </p>
                            )
                          }
                        </div>
                        {renderInwardQtyWeightInput(itemIndex)}
                      </div>

                      {hasLinkedOrderSelected() && getPoLineQualityForItem(itemIndex) ? (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium text-gray-700">Item Quality:</Label>
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 border border-blue-200"
                          >
                            {getPoLineQualityForItem(itemIndex)}
                          </Badge>
                        </div>
                      ) : null}

                      {/* Lab Test Parameters Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium flex items-center gap-2 text-sm">
                            <FlaskConical className="h-4 w-4 text-purple-600" />
                            Lab Test Parameters
                          </h5>

                          <div className="flex items-center gap-2">
                            <Dialog open={isLabTestPopupOpen[itemIndex] || false} onOpenChange={(open) => {
                              if (open) {
                                handleOpenLabTestPopup(itemIndex);
                              } else {
                                handleCloseLabTestPopup(itemIndex);
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 bg-black hover:bg-gray-800 text-white"
                                >
                                  <Plus />
                                  Add Test Parameter
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <FlaskConical className="h-5 w-5" />
                                    Select Lab Test Parameters
                                  </DialogTitle>
                                </DialogHeader>

                                <div className="space-y-6">
                                  {/* Item Group Filter */}
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Filter by Item Group</Label>
                                    <Select
                                      value={popupSelectedItemGroup[itemIndex]?.id?.toString() || "all"}
                                      onValueChange={(value) => {
                                        if (value && value !== "all") {
                                          const itemGroup = itemGroups.find(g => g.id.toString() === value);
                                          handlePopupItemGroupChange(itemIndex, itemGroup);
                                        } else {
                                          handlePopupItemGroupChange(itemIndex, null);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select item group to filter parameters" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">Select Parameters</SelectItem>
                                        {itemGroups.map((group) => (
                                          <SelectItem key={group.id} value={group.id.toString()}>
                                            {group.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {popupSelectedItemGroup[itemIndex] && (
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Package className="h-4 w-4" />
                                        <span>Showing parameters for: <strong>{popupSelectedItemGroup[itemIndex].name}</strong></span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Test Type Filter - Only show when item group is selected */}
                                  {popupSelectedItemGroup[itemIndex] && (
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Filter by Test Type</Label>
                                      <div className="flex gap-2">
                                        <Button
                                          type="button"
                                          variant={popupSelectedTestType[itemIndex] === "all" || !popupSelectedTestType[itemIndex] ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setPopupSelectedTestType(prev => ({
                                            ...prev,
                                            [itemIndex]: "all"
                                          }))}
                                          className="flex-1"
                                        >
                                          All Tests
                                        </Button>
                                        <Button
                                          type="button"
                                          variant={popupSelectedTestType[itemIndex] === "pre_test" ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setPopupSelectedTestType(prev => ({
                                            ...prev,
                                            [itemIndex]: "pre_test"
                                          }))}
                                          className="flex-1"
                                        >
                                          Pre Test
                                        </Button>
                                        <Button
                                          type="button"
                                          variant={popupSelectedTestType[itemIndex] === "post_test" ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setPopupSelectedTestType(prev => ({
                                            ...prev,
                                            [itemIndex]: "post_test"
                                          }))}
                                          className="flex-1"
                                        >
                                          Post Test
                                        </Button>
                                      </div>
                                      {popupSelectedTestType[itemIndex] && popupSelectedTestType[itemIndex] !== "all" && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <FlaskConical className="h-4 w-4" />
                                          <span>Showing: <strong>
                                            {popupSelectedTestType[itemIndex] === "pre_test" ? "Pre Test" :
                                              popupSelectedTestType[itemIndex] === "post_test" ? "Post Test" : "All Tests"}
                                          </strong> parameters</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Lab Test Parameters List */}
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-medium">Available Parameters</Label>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                          const filteredParams = getFilteredLabTestParams(itemIndex);
                                          const allParamIds = filteredParams.map(param => param.id);
                                          const currentSelected = popupSelectedParams[itemIndex] || [];

                                          const allSelected = allParamIds.every(id => currentSelected.includes(id));

                                          if (allSelected) {
                                            setPopupSelectedParams(prev => ({
                                              ...prev,
                                              [itemIndex]: []
                                            }));
                                          } else {
                                            setPopupSelectedParams(prev => ({
                                              ...prev,
                                              [itemIndex]: allParamIds
                                            }));
                                          }
                                        }}
                                        className="text-xs px-3 py-1 h-7"
                                      >
                                        {(() => {
                                          const filteredParams = getFilteredLabTestParams(itemIndex);
                                          const allParamIds = filteredParams.map(param => param.id);
                                          const currentSelected = popupSelectedParams[itemIndex] || [];
                                          const allSelected = allParamIds.every(id => currentSelected.includes(id));
                                          return allSelected ? 'Deselect All' : 'Select All';
                                        })()}
                                      </Button>
                                    </div>
                                    {labTestParamsLoading ? (
                                      <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                                        <p className="text-xs text-gray-600 mt-2">Loading parameters...</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                        {getFilteredLabTestParams(itemIndex).map((param) => {
                                          const validation = getValidationStatus(param);
                                          const ValidationIcon = validation.icon;
                                          const isSelected = popupSelectedParams[itemIndex]?.includes(param.id) || false;

                                          return (
                                            <div
                                              key={param.id}
                                              className={`border rounded-lg p-3 cursor-pointer transition-colors ${isSelected
                                                ? 'border-purple-500 bg-purple-50'
                                                : 'border-gray-200 hover:border-purple-300'
                                                }`}
                                              onClick={() => handlePopupParamToggle(itemIndex, param.id)}
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <Checkbox
                                                    checked={isSelected}
                                                    onChange={() => handlePopupParamToggle(itemIndex, param.id)}
                                                  />
                                                  <FlaskConical className="h-4 w-4 text-purple-500" />
                                                  <span className="text-sm font-medium">{param.parameter_name}</span>
                                                  {param.unit && (
                                                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                                      {param.unit}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <ValidationIcon className={`h-3 w-3 ${validation.color}`} />
                                                  {param.is_image_required && (
                                                    <Camera className="h-3 w-3 text-blue-500" />
                                                  )}
                                                </div>
                                              </div>
                                              {param.remarks && (
                                                <p className="text-xs text-gray-500 mt-1 ml-6">{param.remarks}</p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => handleCloseLabTestPopup(itemIndex)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => handleApplyLabTestSelection(itemIndex)}
                                      disabled={!popupSelectedParams[itemIndex]?.length}
                                    >
                                      Apply Selection ({popupSelectedParams[itemIndex]?.length || 0})
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Clear all item fields - use null instead of undefined for Select component
                                form.setValue(`items.${itemIndex}.item_id`, null, { shouldValidate: false, shouldDirty: false });
                                form.setValue(`items.${itemIndex}.po_line_id`, "", { shouldValidate: false, shouldDirty: false });
                                form.setValue(`items.${itemIndex}.quality_id`, null, { shouldValidate: false, shouldDirty: false });
                                form.setValue(`items.${itemIndex}.brand`, "Binmark");
                                form.setValue(`items.${itemIndex}.our_brand`, "");
                                form.setValue(`items.${itemIndex}.number_of_bags`, "");
                                form.setValue(`items.${itemIndex}.total_weight`, "");
                                setItemQtyWeightMode((prev) => ({ ...prev, [itemIndex]: "quantity" }));
                                form.setValue(`items.${itemIndex}.tare_weight`, "");
                                form.setValue(`items.${itemIndex}.net_weight`, "");
                                form.setValue(`items.${itemIndex}.sample_weight`, "");
                                form.setValue(`items.${itemIndex}.unloaded_weight`, "");

                                // Mark this item as manually cleared to prevent auto-fill
                                setClearedItems(prev => new Set([...prev, itemIndex]));

                                // Clear lab test parameters
                                const currentSelected = selectedLabTestParams[itemIndex] || [];
                                currentSelected.forEach(paramId => {
                                  handleRemoveLabTestParam(itemIndex, paramId);
                                });

                                // Clear search states
                                setStockSearch("");
                                setItemSearchTerms(prev => ({ ...prev, [itemIndex]: "" }));

                                // Trigger re-render
                                setAutoFillTrigger(prev => prev + 1);

                                // Show success message
                                //  toast({
                                //    title: "Item Cleared",
                                //    description: "All item fields have been reset",
                                //  });
                              }}
                              className="text-xs text-white hover:text-white bg-red-600 hover:bg-red-700 border-red-600 px-2 py-1 h-7"
                            >
                              Clear
                            </Button>
                            <Badge
                              variant="secondary"
                              className="text-sm bg-purple-100 text-purple-800"
                            >
                              {selectedLabTestParams[itemIndex]?.length || 0} selected
                            </Badge>
                          </div>
                        </div>



                        {/* Selected Lab Test Parameters Input Fields */}
                        {selectedLabTestParams[itemIndex]?.length > 0 && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-2 space-y-2">
                            {/* Section Title */}
                            <h6 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Test Values & Results
                            </h6>

                            {/* Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                              {[...(selectedLabTestParams[itemIndex] || [])]
                                .sort((a, b) => {
                                  const paramA = labTestParams.find(p => p.id === a);
                                  const paramB = labTestParams.find(p => p.id === b);
                                  const aCountable = paramA?.is_countable ? 1 : 0;
                                  const bCountable = paramB?.is_countable ? 1 : 0;
                                  return aCountable - bCountable;
                                })
                                .map((paramId) => {
                                const param = labTestParams.find(p => p.id === paramId);
                                if (!param) return null;

                                const currentLabTests = form.watch(`items.${itemIndex}.lab_tests`) || [];
                                const currentTest = currentLabTests.find(test => test.test_param_id === paramId);
                                const itemHasOtherLabTestImage = currentLabTests.some(
                                  (test) =>
                                    test.test_param_id !== paramId &&
                                    String(test.image || "").trim()
                                );
                                const labTestImageDisabled =
                                  !allowMultipleInwardImages &&
                                  itemHasOtherLabTestImage &&
                                  !String(currentTest?.image || "").trim();
                                const validation = getValidationStatus(param);
                                const ValidationIcon = validation.icon;
                                const isColorParam = isColorLabTestParam(param);

                                return (
                                  <div
                                    key={paramId}
                                    className={`border rounded-md p-2 space-y-1.5 shadow-sm ${
                                      param.is_countable
                                        ? "bg-blue-50 border-blue-200"
                                        : "bg-white border-gray-200"
                                    }`}
                                  >
                                    {/* Header with remove button */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <FlaskConical className="h-4 w-4 text-purple-500" />
                                        <span className="font-medium text-xs">{param.parameter_name}</span>
                                        {param.unit && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"
                                          >
                                            ({param.unit})
                                          </Badge>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRemoveLabTestParam(itemIndex, paramId)}
                                        className="text-white hover:text-white h-6 w-6 p-0 bg-black hover:bg-gray-800 border-black"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>

                                    {/* Range info (if required) */}
                                    {param.is_validation_required && param.min_value && param.max_value && (
                                      <div className="bg-blue-50 border border-blue-200 rounded p-1.5">
                                        <p className="text-[11px] text-blue-700">
                                          <strong>Range:</strong> {param.min_value} - {param.max_value} {param.unit || ''}
                                        </p>
                                      </div>
                                    )}

                                    {/* Input field with compact image upload icon */}
                                    <div>
                                      <Label className="text-[11px] font-medium text-gray-700 mb-1 block">Test Value *</Label>
                                      <div className="relative">
                                        {param.is_image_required && (
                                          <>
                                            <input
                                              id={`lab-image-${itemIndex}-${paramId}`}
                                              type="file"
                                              accept="image/*"
                                              multiple={allowMultipleInwardImages}
                                              disabled={labTestImageDisabled}
                                              onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                const file = files[0];
                                                if (file) {
                                                  handleLabTestImageChange(itemIndex, paramId, file);
                                                }
                                                e.target.value = "";
                                              }}
                                              className="hidden"
                                            />
                                            <label
                                              htmlFor={`lab-image-${itemIndex}-${paramId}`}
                                              className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-5 w-5 rounded z-10 ${
                                                labTestImageDisabled
                                                  ? "text-gray-300 cursor-not-allowed"
                                                  : "text-gray-500 hover:text-purple-600 hover:bg-purple-50 cursor-pointer"
                                              }`}
                                              title={
                                                labTestImageDisabled
                                                  ? "Only one lab test image is allowed per item"
                                                  : currentTest?.image
                                                    ? "Change lab sample image"
                                                    : "Upload lab sample image"
                                              }
                                            >
                                              <Camera className="h-3.5 w-3.5" />
                                            </label>
                                          </>
                                        )}
                                        <Input
                                          placeholder={isColorParam ? "Letters, numbers & spaces (max 20)" : "Enter value"}
                                          value={currentTest?.value || ""}
                                          onChange={(e) =>
                                            handleLabTestValueChange(itemIndex, paramId, e.target.value)
                                          }
                                          onKeyDown={(e) => {
                                            if (isColorParam) {
                                              if (
                                                e.key.length === 1 &&
                                                !/^[a-zA-Z0-9 ]$/.test(e.key)
                                              ) {
                                                e.preventDefault();
                                              }
                                              return;
                                            }
                                            if (["e", "E", "+", "-"].includes(e.key)) {
                                              e.preventDefault();
                                            }
                                          }}
                                          onBlur={(e) => {
                                            const sanitizedValue = isColorParam
                                              ? sanitizeLabTestColorValue(e.target.value)
                                              : sanitizeLabTestNumericValue(e.target.value);
                                            if (sanitizedValue !== e.target.value) {
                                              handleLabTestValueChange(itemIndex, paramId, sanitizedValue);
                                            }
                                            const error = validateLabTestValue(param, sanitizedValue);
                                            const errorKey = `${itemIndex}-${paramId}`;
                                            setLabTestValidationErrors(prev => {
                                              if (error) {
                                                return { ...prev, [errorKey]: error };
                                              } else {
                                                const newErrors = { ...prev };
                                                delete newErrors[errorKey];
                                                return newErrors;
                                              }
                                            });
                                          }}
                                          type="text"
                                          inputMode={isColorParam ? "text" : "decimal"}
                                          maxLength={isColorParam ? 20 : 8}
                                          step={isColorParam ? undefined : "0.001"}
                                          min={
                                            !isColorParam && param.is_validation_required && param.min_value
                                              ? param.min_value
                                              : undefined
                                          }
                                          max={
                                            !isColorParam && param.is_validation_required && param.max_value
                                              ? param.max_value
                                              : undefined
                                          }
                                          className={`text-sm h-8 ${param.is_image_required ? "pr-8" : ""} ${labTestValidationErrors[`${itemIndex}-${paramId}`]
                                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                              : ""
                                            }`}
                                        />
                                      </div>
                                      {param.is_image_required && labTestImageUploading[`${itemIndex}-${paramId}`] && (
                                        <p className="text-[10px] text-blue-600 font-medium mt-1 flex items-center gap-1">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Uploading...
                                        </p>
                                      )}
                                      {param.is_image_required &&
                                        !labTestImageUploading[`${itemIndex}-${paramId}`] &&
                                        currentTest?.image && (
                                          <p className="text-[10px] text-green-600 font-medium mt-1">Image uploaded</p>
                                        )}
                                      {labTestValidationErrors[`${itemIndex}-${paramId}`] && (
                                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          {labTestValidationErrors[`${itemIndex}-${paramId}`]}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {(() => {
                              const selectedParamIds = selectedLabTestParams[itemIndex] || [];
                              const countableParamIds = selectedParamIds.filter((paramId) => {
                                const param = labTestParams.find((p) => p.id === paramId);
                                return Boolean(param?.is_countable);
                              });

                              if (countableParamIds.length === 0) return null;

                              const currentLabTests = form.watch(`items.${itemIndex}.lab_tests`) || [];
                              const totalCountable = countableParamIds.reduce((sum, paramId) => {
                                const test = currentLabTests.find((entry) => entry.test_param_id === paramId);
                                const parsed = Number.parseFloat(String(test?.value ?? "").trim());
                                return Number.isNaN(parsed) ? sum : sum + parsed;
                              }, 0);

                              return (
                                <div className="pt-1 border-t border-green-200">
                                  <p className="text-sm font-semibold text-blue-700">
                                    Countables : {formatCountableTotal(totalCountable)}/100
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Quality Type + Remarks (single row after lab test params) */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2">
                          <div className="md:col-span-4">
                            <Label>Quality Type</Label>
                            <Controller
                              name={`items.${itemIndex}.quality_id`}
                              control={form.control}
                              render={({ field }) => (
                                <Select
                                  key={`quality-after-lab-${itemIndex}-${autoFillTrigger}`}
                                  value={field.value && field.value !== 0 && field.value !== undefined ? field.value.toString() : undefined}
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Quality Type" />
                                    {field.value && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-gray-200"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          field.onChange(0);
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {qualityLoading ? (
                                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                                    ) : (
                                      qualityTypes.map((quality) => (
                                        <SelectItem key={quality.id} value={quality.id.toString()}>
                                          {quality.name} ({quality.grade})
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          <div className="md:col-span-8">
                            <Label htmlFor={`items.${itemIndex}.remarks`}>Remarks</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id={`items.${itemIndex}.remarks`}
                                placeholder="Enter Remarks"
                                className="flex-1"
                                {...form.register(`items.${itemIndex}.remarks`)}
                              />
                              {voiceRemarksEnabled && (
                                <InwardItemVoiceRecorder
                                  ref={(instance) => registerItemVoiceRecorder(item.id, instance)}
                                  value={form.watch(`items.${itemIndex}.voice_remarks`)}
                                  onUrlChange={(url) => {
                                    const current = form.getValues(`items.${itemIndex}.voice_remarks`) || "";
                                    if (current !== url) {
                                      form.setValue(`items.${itemIndex}.voice_remarks`, url, {
                                        shouldDirty: true,
                                      });
                                    }
                                  }}
                                  disabled={submitMutation.isPending}
                                />
                              )}
                            </div>
                            {voiceRemarksEnabled && Boolean(form.watch(`items.${itemIndex}.voice_remarks`)) && (
                              <p className="text-xs text-green-700 mt-1 font-medium">
                                Voice note attached to Item {itemIndex + 1} — will be saved with this entry
                              </p>
                            )}
                            {form.formState.errors.items?.[itemIndex]?.remarks && (
                              <p className="text-red-500 text-sm mt-1">
                                {form.formState.errors.items[itemIndex].remarks.message}
                              </p>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Sample Images section removed as it's not supported by the API */}

                      {/* Jali Details section removed as it's not supported by the API */}

                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4 pb-6">
                <Button type="button" variant="outline" onClick={() => {
                  // Clear lab test parameters state when resetting form
                  setSelectedLabTestParams({});
                  setIsLabTestPopupOpen({});
                  setPopupSelectedItemGroup({});
                  setPopupSelectedParams({});
                  setPopupSelectedTestType({});
                  setLabTestParamSearch({});
                  setLabTestValidationErrors({});
                  // Clear all search states
                  setStockSearch("");
                  setStockDebounced("");
                  setItemSearchTerms({});
                  setSearchTerm("");
                  setDebouncedSearch("");
                  setItemSearchTerm("");
                  setPoSearchTerm("");
                  setDebouncedPoSearch("");
                  setSroSearchTerm("");
                  setDebouncedSroSearch("");

                  // Clear linked order selection
                  setSelectedPOData(null);
                  setSelectedSROData(null);
                  setPoDropdownOpen(false);
                  setSroDropdownOpen(false);
                  setOrderLinkMode("purchase_order");

                  // Clear Party dropdown state
                  setPartyDropdownOpen(false);

                  // Clear Stock Item dropdown states
                  setStockDropdownOpen({});
                  setClearedItems(new Set());

                  // Get current items count before reset
                  const currentItems = form.getValues('items') || [];
                  const itemsCount = currentItems.length;

                  // Reset form
                  form.reset();

                  // Use setTimeout to ensure form.reset() completes before resetting fields
                  setTimeout(() => {
                    // Explicitly reset all item_id and quality_id fields using resetField to ensure dropdown shows placeholder
                    for (let index = 0; index < itemsCount; index++) {
                      // Reset field to undefined to show placeholder
                      form.resetField(`items.${index}.item_id`, { defaultValue: undefined });
                      form.resetField(`items.${index}.quality_id`, { defaultValue: undefined });
                      // Also set value explicitly to undefined as fallback
                      form.setValue(`items.${index}.item_id`, undefined, { shouldValidate: false, shouldDirty: false });
                      form.setValue(`items.${index}.quality_id`, undefined, { shouldValidate: false, shouldDirty: false });
                    }

                    // Trigger re-render to update dropdowns
                    setAutoFillTrigger(prev => prev + 1);
                  }, 10);
                }} className="px-6 py-2">
                  Reset
                </Button>

                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="bg-black hover:bg-gray-800 text-white px-8 py-2 shadow-lg"
                >
                  {submitMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Entry
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}