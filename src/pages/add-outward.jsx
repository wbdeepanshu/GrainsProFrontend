import { useRef, useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  UserPlus,
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
  Image,
  Loader2,
  Tag,
  Pencil,
  ArrowUp,
  ArrowDown,
  GripVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Loader from "@/components/common/loader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { ChevronsUpDown, Search } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { createOutwardEntry, fetchOutwardEntries, fetchOutwardEntryDetail } from "@/lib/outward_api";
import ManageVehicleSplitModal from "@/components/outward/ManageVehicleSplitModal";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

/** Lot row from item-lot-details — name field varies by API version. */
function resolveLotBatchName(detail) {
  if (!detail || typeof detail !== "object") return "";
  return String(detail.batch_name ?? detail.batch ?? detail.name ?? "").trim();
}

/** Resolve a godown to a numeric ID (handles numeric strings and godown names). */
function coerceGodownId(rawId, itemGodowns, allGodownsMaster, allGodownsList) {
  if (rawId === "" || rawId === null || rawId === undefined) return null;

  const asNumber = typeof rawId === "number" ? rawId : parseInt(String(rawId).trim(), 10);
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;

  const name = String(rawId).trim();
  if (!name) return null;

  const fromMaster = (allGodownsMaster || []).find((g) => g.godown === name);
  if (fromMaster?.godown_id != null && fromMaster.godown_id !== "") {
    const id = Number(fromMaster.godown_id);
    if (!Number.isNaN(id) && id > 0) return id;
  }

  if (Array.isArray(allGodownsList)) {
    const fromAll = allGodownsList.find((g) => g.name === name);
    if (fromAll?.id != null) {
      const id = Number(fromAll.id);
      if (!Number.isNaN(id) && id > 0) return id;
    }
  }

  for (const list of Object.values(itemGodowns || {})) {
    if (!Array.isArray(list)) continue;
    const found = list.find((g) => g.godown === name);
    if (found?.godown_id != null && found.godown_id !== "") {
      const id = Number(found.godown_id);
      if (!Number.isNaN(id) && id > 0) return id;
    }
  }

  return null;
}

function resolveGodownName(godownId, itemGodowns, allGodownsMaster, allGodownsList) {
  if (Array.isArray(allGodownsList)) {
    const found = allGodownsList.find((g) => Number(g.id) === Number(godownId));
    if (found?.name) return found.name;
  }

  const fromMaster = (allGodownsMaster || []).find((g) => Number(g.godown_id) === Number(godownId));
  if (fromMaster?.godown) return fromMaster.godown;

  for (const list of Object.values(itemGodowns || {})) {
    if (!Array.isArray(list)) continue;
    const found = list.find((g) => Number(g.godown_id) === Number(godownId));
    if (found?.godown) return found.godown;
  }

  return `Godown ${godownId}`;
}

function extractSelectedGodownsFromSalesOrders(salesOrders, itemGodowns, allGodownsMaster, allGodownsList) {
  const godownMap = new Map();
  if (!salesOrders?.length) return [];

  salesOrders.forEach((salesOrder) => {
    salesOrder.items?.forEach((item) => {
      item.godowns?.forEach((godown) => {
        const hasNamedBatch = (godown.batches || []).some(
          (batch) => batch?.name && String(batch.name).trim()
        );
        if (!hasNamedBatch) return;

        const godownId = coerceGodownId(
          godown.godown_id,
          itemGodowns,
          allGodownsMaster,
          allGodownsList
        );
        if (godownId && !godownMap.has(godownId)) {
          godownMap.set(godownId, {
            id: godownId,
            name: resolveGodownName(godownId, itemGodowns, allGodownsMaster, allGodownsList),
          });
        }
      });
    });
  });

  return Array.from(godownMap.values());
}

// Form validation schema for batches within a godown section
const batchSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
  number_of_bags: z.union([z.number(), z.string()]).optional(),
  // Note: supervisor_id removed from batch level - only at godown level
});

// Form validation schema for godown section with batches
const godownBatchSchema = z.object({
  godown_id: z.union([z.number(), z.string()]).refine((val) => {
    if (val === "" || val === null || val === undefined) return false;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return !isNaN(num) && num > 0;
  }, "Godown is required"),
  supervisor_id: z.string().optional(), // Optional godown-level supervisor (applies to all batches if not specified at batch level)
  batches: z.array(batchSchema).min(1, "At least one batch is required for each godown"),
});

// Form validation schema for outward items
const outwardItemSchema = z.object({
  item_id: z.union([z.number(), z.string()]).refine((val) => {
    if (val === "" || val === null || val === undefined) return false;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return !isNaN(num) && num > 0;
  }, "Stock item is required"),
  remarks: z.string().optional(), // Remarks for the item
  total_quantity: z.union([z.number(), z.string()]).optional(), // Total quantity (bags count)
  godowns: z.array(godownBatchSchema).min(1, "At least one godown with batches is required"),
});

// Sales order with items schema
const salesOrderSchema = z.object({
  sales_order_id: z.string().min(1, "Sales order ID is required"),
  items: z.array(outwardItemSchema), // Allow empty items array - user can remove items
});

const addOutwardSchema = z.object({
  date: z.string().optional(),
  vehicle_no: z.string().min(1, "Vehicle number is required"),
  sales_orders: z.array(salesOrderSchema).min(1, "At least one sales order is required"),
  godown_sequence: z.array(z.number()).optional(), // Array of godown IDs in sequence order
});

const collectFormErrorMessages = (node, path = [], sectionName = "Sales order") => {
  if (!node || typeof node !== "object") return [];
  const messages = [];
  if (typeof node.message === "string" && node.message.trim()) {
    const sectionIndex = path[0] === "sales_orders" && path[1] != null ? Number(path[1]) + 1 : null;
    const itemPos = path.indexOf("items");
    const itemIndex = itemPos >= 0 && path[itemPos + 1] != null ? Number(path[itemPos + 1]) + 1 : null;
    const where = [
      sectionIndex ? `${sectionName} ${sectionIndex}` : "",
      itemIndex ? `item ${itemIndex}` : "",
    ].filter(Boolean).join(", ");
    let text = node.message.trim();
    if (sectionName === "Purchase return") {
      text = text
        .replace("Sales order ID is required", "Purchase return is required")
        .replace("At least one sales order is required", "At least one purchase return is required");
    }
    messages.push(where ? `${where}: ${text}` : text);
  }
  Object.entries(node).forEach(([key, value]) => {
    if (["message", "type", "ref", "types"].includes(key)) return;
    if (value && typeof value === "object") {
      messages.push(...collectFormErrorMessages(value, [...path, key], sectionName));
    }
  });
  return [...new Set(messages)];
};

// Component to manage godown sequence
function GodownSequenceSelector({ form, itemGodowns, allGodownsMaster, cachedSelectedGodowns }) {
  const watchedSalesOrders = form.watch("sales_orders");
  const currentSequence = form.watch("godown_sequence") || [];
  const [allGodowns, setAllGodowns] = useState([]);
  const [isLoadingGodowns, setIsLoadingGodowns] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch all godowns on mount
  useEffect(() => {
    const fetchAllGodowns = async () => {
      try {
        setIsLoadingGodowns(true);
        const response = await apiRequest("GET", `${API_BASE_URL}/api/get-godowns/`, null);
        const data = await response.json();
        const godownsList = data.data || data || [];

        // Transform to { id, name } format
        const formattedGodowns = godownsList.map(g => ({
          id: g.id || g.godown_id,
          name: g.name || g.godown || `Godown ${g.id || g.godown_id}`
        }));

        setAllGodowns(formattedGodowns);
      } catch (error) {
        console.error('Error fetching godowns:', error);
        setAllGodowns([]);
      } finally {
        setIsLoadingGodowns(false);
      }
    };

    fetchAllGodowns();
  }, []);

  // Use cached selected godowns if available, otherwise extract from form data
  const selectedGodowns = useMemo(() => {
    if (cachedSelectedGodowns && cachedSelectedGodowns.length > 0) {
      return cachedSelectedGodowns;
    }

    return extractSelectedGodownsFromSalesOrders(
      watchedSalesOrders,
      itemGodowns,
      allGodownsMaster,
      allGodowns
    );
  }, [cachedSelectedGodowns, watchedSalesOrders, itemGodowns, allGodownsMaster, allGodowns]);

  // Initialize sequence with selected godowns if batches are selected
  useEffect(() => {
    if (selectedGodowns.length > 0) {
      const selectedGodownIds = selectedGodowns.map(g => g.id);

      if (currentSequence.length === 0) {
        // Initialize with selected godowns in order
        form.setValue("godown_sequence", selectedGodownIds, { shouldDirty: false });
      } else {
        // Update sequence to match selected godowns
        // Remove godowns that are no longer selected, keep existing order
        const filteredSequence = currentSequence.filter(id => selectedGodownIds.includes(id));
        // Add any new selected godowns that weren't in the sequence
        const newGodowns = selectedGodownIds.filter(id => !currentSequence.includes(id));
        const updatedSequence = [...filteredSequence, ...newGodowns];

        if (updatedSequence.length !== currentSequence.length ||
            updatedSequence.some((id, idx) => id !== currentSequence[idx])) {
          form.setValue("godown_sequence", updatedSequence, { shouldDirty: false });
        }
      }
    } else if (selectedGodowns.length === 0 && currentSequence.length > 0) {
      // Clear sequence if no batches are selected
      form.setValue("godown_sequence", [], { shouldDirty: false });
    }
  }, [selectedGodowns, form, currentSequence]);

  // Handle sequence number change
  const handleSequenceChange = (godownId, newSequence) => {
    const seqNum = parseInt(newSequence);
    if (isNaN(seqNum) || seqNum < 1) return;

    const currentSeq = [...currentSequence];
    const maxSeq = currentSeq.length;

    // If new sequence is out of bounds, clamp it
    const clampedSeq = Math.max(1, Math.min(seqNum, maxSeq));

    // Remove godown from current position
    const filteredSeq = currentSeq.filter(id => id !== godownId);

    // Insert at new position (1-indexed, so subtract 1 for array index)
    filteredSeq.splice(clampedSeq - 1, 0, godownId);

    form.setValue("godown_sequence", filteredSeq);
  };

  // Get godowns in sequence order (always calculate, use conditionally)
  const sequencedGodowns = useMemo(() => {
    if (selectedGodowns.length === 0) {
      return [];
    }

    if (currentSequence.length === 0) {
      // If no sequence set, use selected godowns in order
      return selectedGodowns;
    }

    // Order by sequence
    const godownMap = new Map(selectedGodowns.map(g => [g.id, g]));
    const ordered = currentSequence
      .map(id => godownMap.get(id))
      .filter(Boolean);

    // Add any selected godowns not in sequence
    selectedGodowns.forEach(godown => {
      if (!currentSequence.includes(godown.id)) {
        ordered.push(godown);
      }
    });

    return ordered;
  }, [currentSequence, selectedGodowns]);

  if (isLoadingGodowns) {
    return (
      <div className="text-xs text-gray-500 italic h-9 flex items-center">
        Loading godowns...
      </div>
    );
  }

  // If batches are selected, show button that opens dialog with sequence
  if (selectedGodowns.length > 0) {
    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3 text-gray-500" />
              <span className="text-xs">
                {sequencedGodowns.length} Godown{sequencedGodowns.length !== 1 ? 's' : ''} Selected
              </span>
            </div>
            <ChevronsUpDown className="h-3 w-3 text-gray-500" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Godown Sequence</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <div className="max-h-60 overflow-y-auto border rounded-md p-3 space-y-2 bg-gray-50">
              {sequencedGodowns.map((godown, index) => {
                // Get sequence number from currentSequence, or use index + 1 as fallback
                const seqIndex = currentSequence.indexOf(godown.id);
                const currentSeqNum = seqIndex >= 0 ? seqIndex + 1 : index + 1;

                return (
                  <div
                    key={godown.id}
                    className="flex items-center gap-2 p-2 bg-white rounded border text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate flex-1 font-medium">{godown.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Label className="text-sm text-gray-600 whitespace-nowrap">Sequence:</Label>
                      <Input
                        type="number"
                        min="1"
                        max={sequencedGodowns.length}
                        value={currentSeqNum}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d+$/.test(value)) {
                            handleSequenceChange(godown.id, value);
                          }
                        }}
                        className="h-8 w-16 text-center text-sm"
                        onKeyDown={(e) => {
                          if (!/^\d$/.test(e.key) &&
                              !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 text-center">
              {sequencedGodowns.length} unique godown{sequencedGodowns.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // No batches/godowns selected yet
  return (
    <Select disabled>
      <SelectTrigger className="h-9">
        <SelectValue placeholder="Add batches to set godown sequence" />
      </SelectTrigger>
    </Select>
  );
}

export default function AddOutward() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { hasPermission } = useUserPermissions();
  const canCreatePurchaseReturn = hasPermission("purchase_return", "create");
  const [entryMode, setEntryMode] = useState("sales_order"); // sales_order | purchase_return
  const [manageVehicleOpen, setManageVehicleOpen] = useState(false);
  const [splitCreating, setSplitCreating] = useState(false);
  const [manageVehicleSalesOrders, setManageVehicleSalesOrders] = useState([]);
  const manageVehicleEnabled = true; // Split loading UI; gate with manage_vehilce_settings later if needed
  const [assignSupervisorOpen, setAssignSupervisorOpen] = useState(false);
  const [assignSupervisorDraft, setAssignSupervisorDraft] = useState([]); // [{ godownKey, godownName, supervisor_id }]
  const [assignSupervisorLoading, setAssignSupervisorLoading] = useState(false);

  // Edit mode state (set when ?edit_id=... is present in the URL)
  const editId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("edit_id");
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, []);
  const isEditMode = editId !== null;
  const [isLoadingEditData, setIsLoadingEditData] = useState(isEditMode);
  const [editPrefillApplied, setEditPrefillApplied] = useState(false);
  // { [sourceId]: "SO-123 - Acme Pvt Ltd" } — populated from the gate-pass
  // details response so we can render the source label in edit mode before
  // the /sales-orders dropdown query resolves.
  const [editSourceNameMap, setEditSourceNameMap] = useState({});

  // Remarks edit state - track which item's remarks is being edited (format: "soIndex-itemIndex")
  const [editingRemarksIndex, setEditingRemarksIndex] = useState(null);

  // Sales order state
  const [salesOrderSearchTerm, setSalesOrderSearchTerm] = useState("");
  const [selectedSalesOrder, setSelectedSalesOrder] = useState(null);
  const [selectedSalesOrderData, setSelectedSalesOrderData] = useState(null);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [processedSalesOrderId, setProcessedSalesOrderId] = useState(null);
  const [processedSalesOrderIds, setProcessedSalesOrderIds] = useState(new Set()); // Track all processed sales orders
  const [isInitializing, setIsInitializing] = useState(true);

  // Stock items search state
  const [stockSearch, setStockSearch] = useState("");
  const [additionalStockItems, setAdditionalStockItems] = useState([]);

  // State for batch selection modal - now supports multiple godown sections
  const [batchModalOpen, setBatchModalOpen] = useState({}); // { itemIndex: boolean }
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  // Changed to support multiple godown sections: array of { godown: "", supervisor_id: undefined, batches: [] }
  const [modalGodownSections, setModalGodownSections] = useState([]);

  // Store sales order item base units (format: "soIndex-itemIndex": base_unit_name)
  const [salesOrderItemBaseUnits, setSalesOrderItemBaseUnits] = useState({});

  // Store approved quantities for each item (format: "soIndex-itemIndex": approved_quantity)
  const [salesOrderItemApprovedQuantities, setSalesOrderItemApprovedQuantities] = useState({});

  // Confirm when loading qty exceeds approved (per item, after user clicks OK)
  const [exceedApprovedConfirm, setExceedApprovedConfirm] = useState(null);
  const [exceedApprovedConfirmedKeys, setExceedApprovedConfirmedKeys] = useState({});

  // Track which loading-qty fields the user has explicitly typed into (or
  // cleared). When set, the auto-sync useEffect and the render fallback skip
  // overwriting the user's value with the calculated batch-sum. Key format:
  // "soIndex-itemId" (matches `salesOrderItemApprovedQuantities`).
  const [userEditedLoadingQty, setUserEditedLoadingQty] = useState({});

  // Store sales order item name for display (so gate pass shows same name as sales order, not matched stock item variant)
  const [salesOrderItemDisplayNames, setSalesOrderItemDisplayNames] = useState({});

  // Cache for selected godowns from all batches across all items
  const [cachedSelectedGodowns, setCachedSelectedGodowns] = useState([]); // Array of { id, name }

  // Debounce sales order search
  useEffect(() => {
    const handler = setTimeout(() => {
      // This will be used for sales order search
    }, 300);
    return () => clearTimeout(handler);
  }, [salesOrderSearchTerm]);

  // Debounce stock search
  useEffect(() => {
    const handler = setTimeout(() => {
      // This will be used for stock item search
    }, 300);
    return () => clearTimeout(handler);
  }, [stockSearch]);

  // Initialize entry mode from URL (supports deep-link from purchase return listing)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestedMode = urlParams.get("mode");
    if (requestedMode === "purchase_return" && canCreatePurchaseReturn) {
      setEntryMode("purchase_return");
    }
  }, [canCreatePurchaseReturn]);


  // Fetch stock items
  const fetchStockItems = async ({ pageParam = 1 }) => {
    try {
    const response = await apiRequest('POST', `${API_BASE_URL}/api/get-stock-items/`, {
        new_page: pageParam,
      per_page: 50,
        search: stockSearch || "",
      type: "",
      stock_group: "",
      godown: "",
      voucher_type: ""
    });
    const data = await response.json();

    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
      totalCount: data.total_count || 0,
      pagination: data.pagination
    };
    } catch (error) {
      console.error('Error fetching stock items:', error);
      return {
        results: [],
        nextPage: undefined,
        totalCount: 0,
        pagination: null
      };
    }
  };

  const {
    data: stockItemsPages,
    fetchNextPage: fetchNextStockItems,
    hasNextPage: hasNextStockItems,
    isFetchingNextPage: isFetchingNextStockItems,
    isLoading: stockItemsLoading,
  } = useInfiniteQuery({
    queryKey: ['stock-items', stockSearch],
    queryFn: fetchStockItems,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken(),
  });

  const stockItems = stockItemsPages?.pages?.flatMap((page) => page.results) ?? [];

  // Combined stock items (original + search results)
  const allStockItems = useMemo(() => {
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

  // Function to search for specific stock items by name
  const searchStockItemByName = async (itemName) => {
    try {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/get-stock-items/`, {
        new_page: 1,
        per_page: 100, // Increased to get more results
        search: itemName,
        type: "",
        stock_group: "",
        godown: "",
        voucher_type: ""
      });
      const data = await response.json();
      const searchResults = data.data || [];

      // Add search results to additional stock items if not already present
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

  // Fetch item-wise godowns. Prefer stock_item_id so response stock_item_name matches sales order item name.
  const fetchItemWiseGodowns = async (itemName, stockItemId) => {
    if (!itemName && !stockItemId) {
      console.log('fetchItemWiseGodowns: No item name or stock_item_id provided');
      return [];
    }

    try {
      const requestBody = {
        type: ""
      };
      if (stockItemId != null && stockItemId !== "") {
        requestBody.stock_item_id = typeof stockItemId === 'string' ? parseInt(stockItemId, 10) : stockItemId;
      }
      if (itemName) {
        requestBody.item_name = itemName;
      }

      console.log('fetchItemWiseGodowns: Calling API with', requestBody);
      const response = await apiRequest("POST", `${API_BASE_URL}/api/item-wise-godowns/`, requestBody);
      const data = await response.json();
      console.log('fetchItemWiseGodowns: API response', data);

      if (data.status === 200 && data.data) {
        return Array.isArray(data.data) ? data.data : [];
      } else {
        console.log('fetchItemWiseGodowns: Unexpected response format', data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching item-wise godowns:', error);
      return [];
    }
  };

  // Fetch all godowns from master (fallback when godown_id is not found)
  const fetchAllGodownsMaster = async () => {
    if (allGodownsMaster.length > 0) {
      return allGodownsMaster; // Return cached data
    }

    setLoadingAllGodowns(true);
    try {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-godowns/`, null);
      const data = await response.json();

      if (data.status === 200 && data.data) {
        const godowns = data.data.map(g => ({
          godown: g.name,
          godown_id: g.id,
          current_balance: 0.0
        }));
        setAllGodownsMaster(godowns);
        return godowns;
      } else {
        console.log('fetchAllGodownsMaster: Unexpected response format', data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching all godowns master:', error);
      return [];
    } finally {
      setLoadingAllGodowns(false);
    }
  };

  // State to store item-wise godowns for each item
  const [itemGodowns, setItemGodowns] = useState({});
  const [loadingItemGodowns, setLoadingItemGodowns] = useState({});

  // State to store all godowns from master (fallback when godown_id is not found)
  const [allGodownsMaster, setAllGodownsMaster] = useState([]);
  const [loadingAllGodowns, setLoadingAllGodowns] = useState(false);

  // State to store batch details for each item-godown combination
  const [itemBatchDetails, setItemBatchDetails] = useState({});
  const [loadingBatchDetails, setLoadingBatchDetails] = useState({});


  // Fetch batch details for item-godown combination
  const fetchBatchDetails = async (itemName, godownName) => {
    if (!itemName || !godownName) {
      console.log('fetchBatchDetails: Missing itemName or godownName');
      return [];
    }

    try {
      const requestBody = {
        item_name: itemName,
        godown_name: godownName
      };

      console.log('fetchBatchDetails: Calling API with', requestBody);
      const response = await apiRequest("POST", `${API_BASE_URL}/api/item-lot-details/`, requestBody);
      const data = await response.json();
      console.log('fetchBatchDetails: API response', data);

      if (data && data.batch_allocations) {
        return data.batch_allocations;
      } else {
        console.log('fetchBatchDetails: No batch_allocations in response', data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching batch details:', error);
      return [];
    }
  };

  // Function to load godowns for a specific item. Pass itemId (stock_item_id) so API returns same name as sales order.
  const loadGodownsForItem = async (itemId, itemName) => {
    if (!itemId && !itemName) {
      console.log('loadGodownsForItem: Missing itemId and itemName', { itemId, itemName });
      return;
    }

    console.log('loadGodownsForItem: Loading godowns for item', { itemId, itemName });
    const key = (itemId != null && itemId !== '') ? itemId : (itemName || 'unknown');
    setLoadingItemGodowns(prev => ({ ...prev, [key]: true }));

    try {
      const godowns = await fetchItemWiseGodowns(itemName, itemId);
      const normalizedGodowns = godowns.map((g) => ({
        ...g,
        godown_id: g.godown_id ?? g.id,
      }));
      console.log('loadGodownsForItem: Received godowns', { itemId, godowns: normalizedGodowns });
      setItemGodowns(prev => ({ ...prev, [key]: normalizedGodowns }));
    } catch (error) {
      console.error('Error loading godowns for item:', error);
      setItemGodowns(prev => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingItemGodowns(prev => ({ ...prev, [key]: false }));
    }
  };

  // Function to load batch details for a specific item-godown combination
  const loadBatchDetails = async (itemId, itemName, godownName) => {
    if (!itemId || !itemName || !godownName) {
      console.log('loadBatchDetails: Missing parameters', { itemId, itemName, godownName });
      return;
    }

    const batchKey = `${String(itemId)}-${godownName}`;
    console.log('loadBatchDetails: Loading batches', { itemId, itemName, godownName, batchKey });
    setLoadingBatchDetails(prev => ({ ...prev, [batchKey]: true }));

    try {
      const batchDetails = await fetchBatchDetails(itemName, godownName);
      console.log('loadBatchDetails: Received batch details', { batchKey, batchDetails });
      setItemBatchDetails(prev => ({ ...prev, [batchKey]: batchDetails }));
    } catch (error) {
      console.error('Error loading batch details for item-godown:', error);
      setItemBatchDetails(prev => ({ ...prev, [batchKey]: [] }));
    } finally {
      setLoadingBatchDetails(prev => ({ ...prev, [batchKey]: false }));
    }
  };

  // Fetch supervisors (users) - fallback to all supervisors
  const fetchSupervisors = async () => {
    try {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-users/?role_id=2`);
    const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      return [];
    }
  };

  // Fetch supervisors by godown name
  const fetchSupervisorsByGodown = async (godownName) => {
    if (!godownName) {
      return [];
    }
    try {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-users/?godown_name=${encodeURIComponent(godownName)}`);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching supervisors by godown:', error);
      return [];
    }
  };

  // State to track selected godown for supervisor fetching
  const [selectedGodownForSupervisor, setSelectedGodownForSupervisor] = useState(null);

  // Fetch all supervisors (fallback)
  const { data: allSupervisors, isLoading: allSupervisorsLoading } = useQuery({
    queryKey: ['supervisors'],
    queryFn: fetchSupervisors,
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch supervisors by godown
  const { data: godownSupervisors, isLoading: godownSupervisorsLoading } = useQuery({
    queryKey: ['supervisors-by-godown', selectedGodownForSupervisor],
    queryFn: () => fetchSupervisorsByGodown(selectedGodownForSupervisor),
    enabled: !!selectedGodownForSupervisor && !!AuthService.getAccessToken(),
  });

  // Helper function to get supervisors for a specific section
  // If godown-specific supervisors are available and match the section's godown, use them
  // Otherwise, fallback to all supervisors
  const getSupervisorsForSection = (sectionGodown) => {
    if (sectionGodown && selectedGodownForSupervisor === sectionGodown && godownSupervisors && godownSupervisors.length > 0) {
      return { supervisors: godownSupervisors, loading: godownSupervisorsLoading };
    }
    return { supervisors: allSupervisors || [], loading: allSupervisorsLoading };
  };

  // Auto-select first supervisor when godown-specific supervisors are loaded
  useEffect(() => {
    if (godownSupervisors && godownSupervisors.length > 0 && selectedGodownForSupervisor && !godownSupervisorsLoading) {
      // Find the section with the matching godown and auto-select first supervisor if not already selected
      setModalGodownSections(prevSections => {
        const updatedSections = [...prevSections];
        let hasUpdated = false;

        updatedSections.forEach((section, index) => {
          if (section.godown === selectedGodownForSupervisor && !section.supervisor_id) {
            updatedSections[index] = {
              ...section,
              supervisor_id: godownSupervisors[0].user_id
            };
            hasUpdated = true;
          }
        });

        return hasUpdated ? updatedSections : prevSections;
      });
    }
  }, [godownSupervisors, selectedGodownForSupervisor, godownSupervisorsLoading]);


  // Fetch source list based on selected mode
  const fetchSourceOrders = async () => {
    try {
      if (entryMode === "purchase_return") {
        const response = await apiRequest("GET", `${API_BASE_URL}/api/voucher/purchase-return-orders/`);
        const data = await response.json();
        const rows = data?.data || [];
        return rows.map((row) => ({
          so_number: row.voucher_number || String(row.id),
          order_id: String(row.id),
          customer_name: row.party_name || row.party || "",
          _raw: row,
        }));
      }
      // Do not force so_status=Approved — rescheduled SOs are often status=Completed
      // but still need a new gate pass (remaining qty after return).
      const salesOrderParams = new URLSearchParams({
        page: "1",
        per_page: "200",
      });
      const response = await apiRequest("GET", `${API_BASE_URL}/api/sales/sales-orders/?${salesOrderParams.toString()}`);
      const data = await response.json();
      const rows = data.data || [];
      // Prefer gate-pass eligible orders; keep others so search can still find an SO number
      return rows;
    } catch (error) {
      console.error("Error fetching source orders:", error);
      return [];
    }
  };

  const { data: salesOrders, isLoading: salesOrdersLoading } = useQuery({
    queryKey: ['add-outward-source-orders', entryMode],
    queryFn: fetchSourceOrders,
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch details based on selected mode
  const fetchSourceDetails = async (sourceIdOrNumber) => {
    try {
      if (entryMode === "purchase_return") {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/voucher/purchase-return-orders/${sourceIdOrNumber}/`);
        const data = await response.json();
        const detail = data?.data;
        if (!detail) return null;
        return {
          so_number: detail.voucher_number || String(detail.id),
          order_id: String(detail.id),
          items: (detail.items || []).map((item) => ({
            is_approved: true,
            item_name: item.stock_item_name || item.item_name || "",
            approved_quantity: item.return_qty ?? item.purchase_qty ?? 0,
            stock_item: {
              base_unit: {
                name: item.uom_name || item.uom || "",
              },
            },
            base_unit: { name: item.uom_name || item.uom || "" },
          })),
        };
      }
      const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/sales-orders/${sourceIdOrNumber}/`);
      const data = await response.json();
      const payload = data?.data;
      if (!payload) return null;
      // Detail API returns { header, items, ... } — flatten for gate-pass autofill
      if (payload.header || Array.isArray(payload.items)) {
        return {
          ...payload.header,
          so_number: payload.header?.so_number || payload.header?.order_id || sourceIdOrNumber,
          order_id: payload.header?.order_id || payload.header?.so_number || sourceIdOrNumber,
          items: payload.items || [],
        };
      }
      return payload;
    } catch (error) {
      console.error('Error fetching source details:', error);
      return null;
    }
  };

  const form = useForm({
    resolver: zodResolver(addOutwardSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      vehicle_no: "",
      godown_sequence: [],
      sales_orders: [{
        sales_order_id: "",
        items: [{
          item_id: "",
          remarks: "",
          total_quantity: "",
          godowns: [{
            godown_id: "",
            supervisor_id: undefined, // Optional godown-level supervisor
            batches: [{
              name: "",
              number_of_bags: ""
              // Note: supervisor_id removed from batch level - only at godown level
            }]
          }]
        }]
      }]
    },
  });

  // When lot API returns exactly one batch for an item+godown, pre-select it so qty inputs appear (user still enters qty).
  useEffect(() => {
    if (editingItemIndex == null) return;
    if (!batchModalOpen[editingItemIndex]) return;

    const parts = String(editingItemIndex).split("-");
    if (parts.length !== 2) return;
    const soIndex = parseInt(parts[0], 10);
    const itemIndex = parseInt(parts[1], 10);
    if (Number.isNaN(soIndex) || Number.isNaN(itemIndex)) return;

    const currentItemId = form.getValues(`sales_orders.${soIndex}.items.${itemIndex}.item_id`);
    if (!currentItemId) return;

    setModalGodownSections((prev) => {
      let changed = false;
      const next = prev.map((section) => {
        if (!section.godown || !String(section.godown).trim()) return section;

        const batchKey = `${String(currentItemId)}-${section.godown}`;
        if (loadingBatchDetails[batchKey]) return section;

        const details = itemBatchDetails[batchKey] || [];
        if (details.length !== 1) return section;

        const onlyName = resolveLotBatchName(details[0]);
        if (!onlyName) return section;

        const batches = section.batches || [];
        const hasNamed = batches.some((b) => b.name && String(b.name).trim());
        if (hasNamed) return section;

        changed = true;
        return {
          ...section,
          batches: [{ name: onlyName, number_of_bags: "" }],
        };
      });
      return changed ? next : prev;
    });
  }, [editingItemIndex, batchModalOpen, itemBatchDetails, loadingBatchDetails, form]);

  const { fields: salesOrderFields, append: appendSalesOrder, remove: removeSalesOrderFromArray } = useFieldArray({
    control: form.control,
    name: "sales_orders",
  });

  // ------------------------------------------------------------------
  // Edit mode: pre-fill the form from an existing outward entry. Only the
  // header (date / vehicle_no), source orders and their items are restored;
  // loaded quantities are intentionally ignored — the update API rejects
  // entries that already have any loading progress.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isEditMode || editPrefillApplied) return;
    if (!editId) return;

    let cancelled = false;
    const loadEntry = async () => {
      setIsLoadingEditData(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/sales/outward-entries/${editId}/`,
          {
            headers: {
              Authorization: `Bearer ${AuthService.getAccessToken()}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${response.status}: Failed to load gate pass`);
        }
        const payload = await response.json();
        if (payload.status && payload.status !== 200) {
          throw new Error(payload.message || "Failed to load gate pass for editing");
        }
        const entry = payload.data || {};
        if (entry.status && entry.status !== "pending") {
          toast({
            title: "Cannot edit",
            description: `Gate pass is in '${entry.status}' state and can no longer be edited.`,
            variant: "destructive",
          });
          setLocation("/outward/outward-list");
          return;
        }

        // Convert dd-mm-yyyy → yyyy-mm-dd for the <input type="date">.
        const formatDateForInput = (raw) => {
          if (!raw) return new Date().toISOString().split("T")[0];
          const parts = String(raw).split("-");
          if (parts.length === 3 && parts[0].length <= 2) {
            const [dd, mm, yyyy] = parts;
            return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
          }
          return raw;
        };

        const sourceArray =
          Array.isArray(entry.purchase_returns) && entry.purchase_returns.length > 0
            ? entry.purchase_returns
            : Array.isArray(entry.sales_orders)
              ? entry.sales_orders
              : [];
        const isPRMode =
          Array.isArray(entry.purchase_returns) && entry.purchase_returns.length > 0;

        // Build form payload from the response.
        const nameMap = {};
        const formSalesOrders = sourceArray.map((source, soIdx) => {
          const sourceId = isPRMode
            ? String(
                source.purchase_return_id ??
                source.voucher_number ??
                source.order_id ??
                ""
              )
            : String(source.order_id ?? source.so_number ?? "");

          // Capture a human-readable label so `getSalesOrderName` can render
          // it before the /sales-orders dropdown resolves.
          if (sourceId) {
            const labelId = isPRMode
              ? (source.voucher_number || source.order_id || sourceId)
              : (source.so_number || source.order_id || sourceId);
            const labelParty = isPRMode
              ? (source.party_name || "")
              : (source.customer_name || "");
            nameMap[sourceId] = labelParty
              ? `${labelId} - ${labelParty}`
              : String(labelId);
          }

          const items = (source.items || []).map((item) => {
            const itemId = item.item_id ?? item.item;
            const remarks = item.remarks || "";
            const totalQty =
              item.total_quantity !== undefined && item.total_quantity !== null
                ? Math.round(parseFloat(item.total_quantity)).toString()
                : "";

            // Seed additionalStockItems with a stub so the item dropdown can
            // render the existing stock item even before /get-stock-items
            // returns it.
            if (itemId && item.item_name) {
              const stubItem = {
                id: itemId,
                item_name: item.item_name,
                name: item.item_name,
                base_unit: item.item_unit
                  ? { name: item.item_unit }
                  : null,
                alternate_unit: item.alternate_unit
                  ? { name: item.alternate_unit }
                  : null,
                conversion: item.conversion || null,
              };
              setAdditionalStockItems((prev) => {
                if (prev.some((existing) => String(existing.id) === String(itemId))) {
                  return prev;
                }
                return [...prev, stubItem];
              });
            }

            // Cache base-unit hint so the qty input shows the right suffix.
            if (itemId && item.item_unit) {
              setSalesOrderItemBaseUnits((prev) => ({
                ...prev,
                [`${soIdx}-${itemId}`]: item.item_unit,
              }));
            }

            // Cache approved_quantity so the "APPROVED QTY" column shows the
            // SO/PR value. The lookup key the render path uses is
            // `${soIndex}-${itemId}` — see `salesOrderItemApprovedQuantities`.
            if (
              itemId &&
              item.approved_quantity !== undefined &&
              item.approved_quantity !== null
            ) {
              const approvedNum = parseFloat(item.approved_quantity);
              if (!Number.isNaN(approvedNum)) {
                setSalesOrderItemApprovedQuantities((prev) => ({
                  ...prev,
                  [`${soIdx}-${itemId}`]: approvedNum,
                }));
              }
            }

            const godowns = (item.godowns || []).map((godown) => ({
              godown_id: godown.godown_id ?? "",
              supervisor_id: godown.supervisor_id ?? undefined,
              batches: (godown.batches || []).map((batch) => ({
                name: batch.name || "",
                number_of_bags:
                  batch.number_of_bags !== undefined && batch.number_of_bags !== null
                    ? Math.round(parseFloat(batch.number_of_bags)).toString()
                    : "",
              })),
            }));

            // Trigger godown lookup so the godown dropdown can render names.
            if (itemId && item.item_name) {
              try {
                loadGodownsForItem(itemId, item.item_name);
              } catch (e) {
                // Non-fatal — submit still works because godown_id is numeric.
              }
            }

            return {
              item_id: itemId ?? "",
              remarks,
              total_quantity: totalQty,
              godowns:
                godowns.length > 0
                  ? godowns
                  : [
                      {
                        godown_id: "",
                        supervisor_id: undefined,
                        batches: [{ name: "", number_of_bags: "" }],
                      },
                    ],
            };
          });

          return {
            sales_order_id: sourceId,
            items:
              items.length > 0
                ? items
                : [
                    {
                      item_id: "",
                      remarks: "",
                      total_quantity: "",
                      godowns: [
                        {
                          godown_id: "",
                          supervisor_id: undefined,
                          batches: [{ name: "", number_of_bags: "" }],
                        },
                      ],
                    },
                  ],
          };
        });

        if (cancelled) return;

        if (isPRMode && canCreatePurchaseReturn) {
          setEntryMode("purchase_return");
        } else {
          setEntryMode("sales_order");
        }

        form.reset({
          date: formatDateForInput(entry.date),
          vehicle_no: entry.vehicle_no || "",
          godown_sequence: Array.isArray(entry.godown_sequence)
            ? entry.godown_sequence
            : (entry.godown_sequence_details || []).map((g) => g.godown_id),
          sales_orders:
            formSalesOrders.length > 0
              ? formSalesOrders
              : [
                  {
                    sales_order_id: "",
                    items: [
                      {
                        item_id: "",
                        remarks: "",
                        total_quantity: "",
                        godowns: [
                          {
                            godown_id: "",
                            supervisor_id: undefined,
                            batches: [{ name: "", number_of_bags: "" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
        });

        setEditSourceNameMap(nameMap);
        setEditPrefillApplied(true);
        // Block the URL-driven auto-fill flow from running on top of us.
        setIsInitializing(false);
      } catch (err) {
        if (cancelled) return;
        toast({
          title: "Failed to load gate pass",
          description: err.message || "Unable to fetch gate pass for editing.",
          variant: "destructive",
        });
        setLocation("/outward/outward-list");
      } finally {
        if (!cancelled) {
          setIsLoadingEditData(false);
        }
      }
    };

    loadEntry();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEditMode, editPrefillApplied]);

  // Watch sales orders / vehicle to keep cache + supervisor UI in sync
  const watchedSalesOrders = form.watch("sales_orders");
  const watchedVehicleNo = form.watch("vehicle_no");

  // Keep cache in sync with form data - extract godowns from all items
  useEffect(() => {
    if (!watchedSalesOrders || watchedSalesOrders.length === 0) {
      setCachedSelectedGodowns([]);
      return;
    }

    const uniqueGodowns = extractSelectedGodownsFromSalesOrders(
      watchedSalesOrders,
      itemGodowns,
      allGodownsMaster,
      null
    );
    setCachedSelectedGodowns(uniqueGodowns);
  }, [watchedSalesOrders, allGodownsMaster, itemGodowns]);

  // Auto-select source orders from URL query parameters
  useEffect(() => {
    const initializeFromURL = async () => {
      // Only run once when component mounts and sales orders are loaded
      if (!isInitializing) return;
      if (isEditMode) return; // Edit-mode prefill owns the form state
      if (salesOrdersLoading) return; // Wait for sales orders to load

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const isPurchaseReturnMode = entryMode === "purchase_return";
        const singleParam = isPurchaseReturnMode
          ? (urlParams.get("pr_id") || urlParams.get("purchase_return_id") || urlParams.get("pr_number"))
          : urlParams.get("so_number");
        const multiParam = isPurchaseReturnMode
          ? (urlParams.get("pr_ids") || urlParams.get("purchase_return_ids") || urlParams.get("pr_numbers"))
          : urlParams.get("so_numbers");

        const sourceIdentifiers = multiParam
          ? multiParam.split(",").map((s) => s.trim()).filter(Boolean)
          : singleParam
            ? [singleParam]
            : [];

        if (sourceIdentifiers.length > 0) {
          // Clear existing sales orders and add new ones
          const newSalesOrders = [];
          const salesOrderDetailsMap = new Map(); // Store details for each sales order

          // Fetch details for all sales orders
          for (const sourceIdentifier of sourceIdentifiers) {
            // Find the source order in the list
            const order = (salesOrders || []).find(o =>
              isPurchaseReturnMode
                ? String(o.order_id || o.id || "") === String(sourceIdentifier) ||
                  String(o.so_number || o.voucher_number || "") === String(sourceIdentifier)
                : String(o.so_number || o.order_id || "") === String(sourceIdentifier)
            );

            if (order) {
              const selectedSourceId = isPurchaseReturnMode
                ? String(order.order_id || order.id || sourceIdentifier)
                : String(order.so_number || order.order_id || sourceIdentifier);
              newSalesOrders.push({
                sales_order_id: selectedSourceId,
                items: []
              });

              // Fetch details for each source
              const details = await fetchSourceDetails(selectedSourceId);
              if (details) {
                salesOrderDetailsMap.set(selectedSourceId, details);
              }
            } else {
              // Fallback: URL-provided ID/number may be valid even when not present in current dropdown list
              // (e.g. partial-delivery SO not in "Approved" filter list). Try direct details lookup.
              const details = await fetchSourceDetails(sourceIdentifier);
              if (details) {
                const selectedSourceId = isPurchaseReturnMode
                  ? String(details.order_id || sourceIdentifier)
                  : String(details.so_number || details.order_id || sourceIdentifier);

                newSalesOrders.push({
                  sales_order_id: selectedSourceId,
                  items: []
                });
                salesOrderDetailsMap.set(selectedSourceId, details);
              } else {
                toast({
                  title: `${isPurchaseReturnMode ? "Purchase Return" : "Sales Order"} Not Found`,
                  description: `${isPurchaseReturnMode ? "Purchase return" : "Sales order"} ${sourceIdentifier} not found.`,
                  variant: "destructive",
                });
              }
            }
          }

          if (newSalesOrders.length > 0) {
            // Set form with all sales orders
            form.setValue('sales_orders', newSalesOrders, { shouldValidate: true, shouldDirty: true });

            // Auto-fill items for each sales order
            for (let i = 0; i < newSalesOrders.length; i++) {
              const soNum = newSalesOrders[i].sales_order_id;
              const details = salesOrderDetailsMap.get(soNum);

              if (details && details.items && details.items.length > 0) {
                // Process items for this sales order
                await processSalesOrderItems(details, i);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing from URL:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeFromURL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesOrders, salesOrdersLoading, isInitializing, entryMode]);

  // Function to process and auto-fill items for a specific sales order
  const processSalesOrderItems = async (salesOrderDetails, salesOrderIndex) => {
    if (!salesOrderDetails || !salesOrderDetails.items || salesOrderDetails.items.length === 0) {
      toast({
        title: "No SO items",
        description: "Sales order details returned no items.",
        variant: "destructive",
      });
      return;
    }

    // Check if this sales order has already been processed
    const soNumber = salesOrderDetails.so_number || salesOrderDetails.order_id;
    const processKey = `${salesOrderIndex}-${soNumber}`;
    if (processedSalesOrderIds.has(processKey)) {
      return; // Already processed
    }

    setIsAutoFilling(true);

    const newItems = [];
    const stockItemsMap = new Map(); // Store stock items found during processing
    const deliverStatus = String(
      salesOrderDetails.deliver_status || salesOrderDetails.header?.deliver_status || ""
    ).toLowerCase();

    // Ensure SO id is on the form before autofill (Controller onChange can lag getValues)
    let selectedSOId = form.getValues(`sales_orders.${salesOrderIndex}.sales_order_id`);
    if (!selectedSOId && soNumber) {
      form.setValue(`sales_orders.${salesOrderIndex}.sales_order_id`, soNumber, {
        shouldDirty: true,
        shouldValidate: true,
      });
      selectedSOId = soNumber;
    }
    if (!selectedSOId) {
      setIsAutoFilling(false);
      toast({
        title: "Sales order not selected",
        description: "Could not bind sales order id on the gate pass form.",
        variant: "destructive",
      });
      return;
    }

    // Mark processed only after we know autofill can run
    setProcessedSalesOrderIds(prev => new Set([...prev, processKey]));

    for (const soItem of salesOrderDetails.items) {
          // Only process approved items for gate pass creation
          // Rescheduled SO: still allow lines that were already delivered/approved historically
          if (!soItem.is_approved && deliverStatus !== "rescheduled") {
            continue;
          }
          if (soItem.is_rejected) {
            continue;
          }

          // console.log('Processing sales order item:', soItem);

          const soItemName = (soItem.item_name || "").trim();
          // Prefer exact match so we don't pick a different variant (e.g. "EMPTY PKT W XXXL" when SO has "W XXXL")
          let stockItem = allStockItems.find(item => {
            const itemName = (item.item_name || item.name || "").trim();
            return itemName.toLowerCase() === soItemName.toLowerCase();
          });

          // If not found, try partial match but prefer stock item whose name equals or is shorter than SO name (avoid "EMPTY PKT ..." variant)
          if (!stockItem) {
            const partialMatches = allStockItems.filter(item => {
              const itemName = (item.item_name || item.name || "").trim();
              return itemName.toLowerCase() === soItemName.toLowerCase() ||
                     (soItemName.toLowerCase().includes(itemName.toLowerCase()) && itemName.length <= soItemName.length) ||
                     (itemName.toLowerCase().includes(soItemName.toLowerCase()) && itemName.length <= soItemName.length);
            });
            stockItem = partialMatches.find(item => (item.item_name || item.name || "").trim().toLowerCase() === soItemName.toLowerCase())
                       || partialMatches[0];
          }

          // If still not found, search by name and prefer exact match
          if (!stockItem && soItemName) {
            const searchResults = await searchStockItemByName(soItem.item_name);
            if (searchResults.length > 0) {
              stockItem = searchResults.find(item => {
                const itemName = (item.item_name || item.name || "").trim();
                return itemName.toLowerCase() === soItemName.toLowerCase();
              }) || searchResults.find(item => {
                const itemName = (item.item_name || item.name || "").trim();
                return itemName.length <= soItemName.length && soItemName.toLowerCase().includes(itemName.toLowerCase());
              }) || searchResults[0];

              // If we found a stock item from search, make sure it's added to additional items
              if (stockItem) {
                setAdditionalStockItems(prev => {
                  const exists = prev.find(existing => existing.id === stockItem.id);
                  if (!exists) {
                    return [...prev, stockItem];
                  }
                  return prev;
                });
              }
            }
          }

          // console.log('Found stock item:', stockItem);

          // Store stock item in map for later use
          if (stockItem) {
            stockItemsMap.set(stockItem.id, stockItem);
          }

          const approvedQtyValue = parseFloat(soItem.approved_quantity || soItem.quantity || 0) || 0;
          const deliveredQtyValue = parseFloat(soItem.delivered_quantity || 0) || 0;
          const returnedQtyValue = parseFloat(soItem.rescheduled_return_qty || 0) || 0;
          const apiRemaining = parseFloat(soItem.remaining_dispatch_qty);
          let remainingQtyValue =
            Number.isFinite(apiRemaining) && apiRemaining > 0
              ? apiRemaining
              : Math.max(approvedQtyValue - deliveredQtyValue, 0);
          // Fallback when reschedule return exists but delivered_quantity was not reduced
          if (remainingQtyValue <= 0 && returnedQtyValue > 0) {
            remainingQtyValue = returnedQtyValue;
          }
          // Last resort for rescheduled SO: allow re-dispatch of approved qty
          if (remainingQtyValue <= 0 && deliverStatus === "rescheduled" && approvedQtyValue > 0) {
            remainingQtyValue = approvedQtyValue;
          }
          if (remainingQtyValue <= 0) {
            continue;
          }

          // Calculate total weight based on conversion factor
          let calculatedWeight = remainingQtyValue.toString();
          if (stockItem && stockItem.conversion && remainingQtyValue) {
            const conversion = parseFloat(stockItem.conversion) || 1.0;
            const quantity = remainingQtyValue;
            calculatedWeight = (quantity * conversion).toString();
          }

          // Create new item - auto-fill with pending qty only (approved - delivered)
          // NOTE: quantity is ALWAYS in base unit
          const quantity = remainingQtyValue.toString();
          // Get base unit name from stock_item.base_unit (actual base unit) - quantities are always in base unit, never converted
          // Always use stock_item.base_unit as it's the source of truth, not item.base_unit which might be incorrect
          const baseUnitName = soItem.stock_item?.base_unit?.name || soItem.base_unit?.name || "";

          // Store base unit for this item (for display and validation) - use item_id for stable key
          const itemIdForKey = stockItem ? (typeof stockItem.id === 'string' ? stockItem.id : String(stockItem.id)) : '';
          const itemKey = itemIdForKey ? `${salesOrderIndex}-${itemIdForKey}` : `${salesOrderIndex}-${newItems.length}`;
          if (baseUnitName) {
            setSalesOrderItemBaseUnits(prev => ({
              ...prev,
              [itemKey]: baseUnitName
            }));
          }

          // Store max-allowed quantity for this item (pending qty = approved - delivered, in base unit)
          const approvedQty = remainingQtyValue;
          setSalesOrderItemApprovedQuantities(prev => ({
            ...prev,
            [itemKey]: approvedQty
          }));

          // Store sales order item name for display so gate pass shows same name as sales order
          if (soItem.item_name) {
            setSalesOrderItemDisplayNames(prev => ({
              ...prev,
              [itemKey]: soItem.item_name
            }));
          }

          newItems.push({
            item_id: stockItem ? stockItem.id : "",
            remarks: "",
            total_quantity: quantity,
            godowns: [{
              godown_id: "",
              supervisor_id: undefined,
              batches: [{ name: "", number_of_bags: "" }],
            }],
          });
        }

        // Update form with new items for the specific sales order index
        if (newItems.length === 0) {
          // Allow retry on next select
          setProcessedSalesOrderIds((prev) => {
            const next = new Set(prev);
            next.delete(processKey);
            return next;
          });
          toast({
            title: "No loadable qty",
            description:
              "This sales order has no remaining quantity for gate pass. For a rescheduled return, confirm inward is complete and refresh, then select the SO again.",
            variant: "destructive",
          });
          setIsAutoFilling(false);
          return;
        }
        form.setValue(`sales_orders.${salesOrderIndex}.items`, newItems, { shouldValidate: true, shouldDirty: true });

        // Load godowns for each item after form is updated
        // Use stockItemsMap to avoid timing issues with state updates
        setTimeout(async () => {
          for (let i = 0; i < newItems.length; i++) {
            const item = newItems[i];
            if (item.item_id) {
              const itemId = typeof item.item_id === 'string' ? parseInt(item.item_id) : item.item_id;

              // Get stock item from map first (most reliable)
              let stockItemForThisItem = stockItemsMap.get(itemId);

              // If not in map, try to find in allStockItems or additionalStockItems
              if (!stockItemForThisItem) {
                stockItemForThisItem = allStockItems.find(si => {
                  const siId = typeof si.id === 'string' ? parseInt(si.id) : si.id;
                  return siId === itemId;
                });

                if (!stockItemForThisItem) {
                  stockItemForThisItem = additionalStockItems.find(si => {
                    const siId = typeof si.id === 'string' ? parseInt(si.id) : si.id;
                    return siId === itemId;
                  });
                }
              }

              if (stockItemForThisItem) {
                const itemName = stockItemForThisItem.name || stockItemForThisItem.item_name;
                if (itemName) {
                  console.log('Auto-fill: Loading godowns for item', { itemId, itemName, index: i, salesOrderIndex });
                  await loadGodownsForItem(itemId, itemName);
                } else {
                  console.log('Auto-fill: No item name found for item', { itemId, stockItemForThisItem });
                }
              } else {
                console.log('Auto-fill: Stock item not found for item_id', { itemId, allStockItemsCount: allStockItems.length, additionalStockItemsCount: additionalStockItems.length });
              }
            }
          }
          setIsAutoFilling(false);
        }, 300);
  };

  // Auto-fill items when sales order is selected (for manual selection via dropdown)
  useEffect(() => {
    if (selectedSalesOrderData && selectedSalesOrderData.items && !isAutoFilling) {
      setIsAutoFilling(true);
      setProcessedSalesOrderId(selectedSalesOrderData.so_number);

      // Find the index of the selected sales order in the form
      const salesOrders = form.getValues('sales_orders');
      const soIndex = salesOrders.findIndex(so =>
        (so.sales_order_id === selectedSalesOrderData.so_number ||
         so.sales_order_id === selectedSalesOrderData.order_id)
      );

      if (soIndex >= 0) {
        processSalesOrderItems(selectedSalesOrderData, soIndex);
      } else {
        setIsAutoFilling(false);
      }
    }
  }, [selectedSalesOrderData, form, isAutoFilling, processedSalesOrderId, allStockItems, additionalStockItems]); // Added dependencies

  // Auto-sync total_quantity with calculated batches total for all items across all sales orders
  useEffect(() => {
    if (!watchedSalesOrders || watchedSalesOrders.length === 0) return;

    watchedSalesOrders.forEach((salesOrder, soIndex) => {
      if (salesOrder.items && salesOrder.items.length > 0) {
        salesOrder.items.forEach((item, itemIndex) => {
          if (item.godowns && item.godowns.length > 0) {
            // Skip auto-sync if the user has explicitly edited (or cleared)
            // this loading-qty field — otherwise the calculated batch sum
            // immediately overwrites the empty value, preventing the user
            // from clearing the input to retype.
            const editedKey = item.item_id
              ? `${soIndex}-${item.item_id}`
              : `${soIndex}-${itemIndex}`;
            if (userEditedLoadingQty[editedKey]) return;

            const calculatedTotal = item.godowns.reduce((godownSum, godown) => {
              if (godown.batches && godown.batches.length > 0) {
                const godownTotal = godown.batches.reduce((sum, batch) => {
                  const bags = batch.number_of_bags;
                  if (bags && bags !== "") {
                    const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                    return sum + (isNaN(numBags) ? 0 : numBags);
                  }
                  return sum;
                }, 0);
                return godownSum + godownTotal;
              }
              return godownSum;
            }, 0);

            if (calculatedTotal > 0) {
              const calculatedStr = Math.floor(calculatedTotal).toString();
              const currentTotal = form.getValues(`sales_orders.${soIndex}.items.${itemIndex}.total_quantity`);
              // Only update if field is empty or matches calculated value (allows manual override)
              if (!currentTotal || currentTotal === calculatedStr) {
                form.setValue(`sales_orders.${soIndex}.items.${itemIndex}.total_quantity`, calculatedStr, { shouldDirty: false });
              }
            }
          }
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSalesOrders, userEditedLoadingQty]);

  // Create / update outward entry mutation. When `editId` is set the same
  // payload is sent as a PUT to the update endpoint; otherwise it's a POST
  // to the create endpoint. Frontend transformation logic is identical.
  const createOutwardMutation = useMutation({
    mutationFn: async (data) => {
      const endpoint = isEditMode
        ? `${API_BASE_URL}/api/sales/update-outward-entry/${editId}/`
        : `${API_BASE_URL}/api/sales/add-outward-entry/`;
      const method = isEditMode ? 'PUT' : 'POST';
      const response = await apiRequest(method, endpoint, data);
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Success",
        description: isEditMode
          ? "Gate Pass Updated Successfully"
          : "Gate Pass Created Successfully",
        variant: "success",
      });
      queryClient.invalidateQueries(['outward-entries']);
      setLocation("/outward/outward-list");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error.message ||
          (isEditMode ? "Failed to Update Gate Pass" : "Failed to create Gate Pass"),
        variant: "destructive",
      });
    },
  });

  const applyLoadingQuantityValue = (soIndex, itemIndex, value, fieldOnChange) => {
    fieldOnChange(value);
    // Record that the user has taken explicit control of this field's value
    // so the auto-sync useEffect / render fallback don't immediately push the
    // calculated batch-sum back in (which prevents the user from clearing
    // the input to type a new number).
    const itemIdForMark = form.getValues(`sales_orders.${soIndex}.items.${itemIndex}.item_id`);
    const editedKey = itemIdForMark ? `${soIndex}-${itemIdForMark}` : `${soIndex}-${itemIndex}`;
    setUserEditedLoadingQty((prev) => (prev[editedKey] ? prev : { ...prev, [editedKey]: true }));
    const currentBatches = form.getValues(`sales_orders.${soIndex}.items.${itemIndex}.batches`) || [];
    if (currentBatches.length > 0 && value) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        const updatedBatches = [...currentBatches];
        updatedBatches[0] = {
          ...updatedBatches[0],
          number_of_bags: value,
        };
        form.setValue(`sales_orders.${soIndex}.items.${itemIndex}.batches`, updatedBatches);
      }
    }
  };

  const handleConfirmExceedApprovedQty = () => {
    if (!exceedApprovedConfirm) return;
    const { itemKey, soIndex, itemIndex, value, fieldOnChange } = exceedApprovedConfirm;
    setExceedApprovedConfirmedKeys((prev) => ({ ...prev, [itemKey]: true }));
    applyLoadingQuantityValue(soIndex, itemIndex, value, fieldOnChange);
    setExceedApprovedConfirm(null);
  };

  const trySetLoadingQuantity = (soIndex, itemIndex, value, itemKey, approvedQty, fieldOnChange) => {
    const numValue = value === "" ? 0 : parseInt(value, 10);
    if (value !== "" && numValue > approvedQty && !exceedApprovedConfirmedKeys[itemKey]) {
      setExceedApprovedConfirm({
        soIndex,
        itemIndex,
        value,
        itemKey,
        approvedQty,
        baseUnitName: salesOrderItemBaseUnits[itemKey] || "",
        fieldOnChange,
      });
      return;
    }
    applyLoadingQuantityValue(soIndex, itemIndex, value, fieldOnChange);
  };

  const onSubmit = (data) => {
    try {
      // Check for validation errors
      if (Object.keys(form.formState.errors).length > 0) {
        return;
      }

      // Check if vehicle_no is empty
      if (!data.vehicle_no || data.vehicle_no.trim() === '') {
        toast({
          title: "Validation Error",
          description: "Vehicle number is required",
          variant: "destructive",
        });
        return;
      }

      // Transform the data to match API expectations (new structure with sales_orders array)
      console.log('Form data before transformation:', JSON.stringify(data, null, 2));

      const transformedSections = data.sales_orders.map((salesOrder, soIdx) => {
        return {
          ...(entryMode === "purchase_return"
            ? { purchase_return_id: parseInt(salesOrder.sales_order_id) }
            : { sales_order_id: salesOrder.sales_order_id }),
          items: salesOrder.items.map((item, idx) => {
            const itemId = typeof item.item_id === 'string' ? parseInt(item.item_id) : item.item_id;

            return {
              item_id: parseInt(item.item_id),
              remarks: item.remarks && item.remarks.trim() !== "" ? item.remarks.trim() : null, // Remarks for the item
              godowns: item.godowns.map((godownSection, godownIdx) => {
                // Convert godown name to godown_id by looking it up in itemGodowns
                let godownId = null;
                const godownSupervisorId = godownSection.supervisor_id && godownSection.supervisor_id !== "" ? godownSection.supervisor_id : null;

                // Validate and convert godown_id (required)
                if (!godownSection.godown_id) {
                  throw new Error(`Sales Order ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown section ${godownIdx + 1}: Godown is required`);
                }

                if (itemId) {
                  const godownsForItem = itemGodowns[itemId] || [];
                  const selectedGodown = godownsForItem.find(g => {
                    const godownIdStr = String(godownSection.godown_id);
                    return g.godown === godownIdStr || String(g.godown_id) === godownIdStr;
                  });

                  if (selectedGodown && selectedGodown.godown_id) {
                    godownId = selectedGodown.godown_id;
                  } else {
                    // If not found in item-wise godowns, try to find in all godowns master
                    const allGodowns = allGodownsMaster.length > 0 ? allGodownsMaster : [];
                    const godownIdStr = String(godownSection.godown_id);
                    const masterGodown = allGodowns.find(g => {
                      return g.godown === godownIdStr || String(g.godown_id) === godownIdStr;
                    });

                    if (masterGodown && masterGodown.godown_id) {
                      godownId = masterGodown.godown_id;
                    } else {
                      // Try to parse as integer if it's a numeric string
                      if (typeof godownSection.godown_id === 'string' && !isNaN(godownSection.godown_id)) {
                        godownId = parseInt(godownSection.godown_id);
                      } else if (typeof godownSection.godown_id === 'number') {
                        godownId = godownSection.godown_id;
                      } else {
                        // If still not found, send the godown name and let backend handle it
                        throw new Error(`Sales Order ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown section ${godownIdx + 1}: Could not find godown "${godownSection.godown_id}"`);
                      }
                    }
                  }
                } else {
                  throw new Error(`Sales Order ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown section ${godownIdx + 1}: Invalid item_id`);
                }

                // Validate batches array
                if (!godownSection.batches || godownSection.batches.length === 0) {
                  throw new Error(`Sales Order ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown section ${godownIdx + 1}: At least one batch is required`);
                }

                // Validate supervisor_id is required at godown level
                if (!godownSupervisorId) {
                  throw new Error(`Sales Order ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown section ${godownIdx + 1}: Supervisor is required at godown level`);
                }

                // Process batches in this godown
                const batches = godownSection.batches.map((batch, batchIdx) => {
                  // Validate batch name (required)
                  if (!batch.name || !batch.name.trim()) {
                    throw new Error(`Sales Order ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown section ${godownIdx + 1}, Batch ${batchIdx + 1}: Batch name is required`);
                  }

                  return {
                    name: batch.name.trim(), // Batch name as string
                    number_of_bags: batch.number_of_bags ? parseInt(batch.number_of_bags, 10) : null,
                    // Note: supervisor_id removed from batch level - only at godown level
                  };
                });

                return {
                  godown_id: typeof godownId === 'number' ? godownId : parseInt(godownId),
                  supervisor_id: godownSupervisorId || undefined, // Optional godown-level supervisor
                  batches: batches,
                };
              })
            };
          })
        };
      });

      const transformedData = {
        date: data.date,
        vehicle_no: data.vehicle_no,
        godown_sequence: data.godown_sequence || [],
        ...(entryMode === "purchase_return"
          ? { purchase_returns: transformedSections }
          : { sales_orders: transformedSections }),
      };

      console.log('Submitting outward entry data:', JSON.stringify(transformedData, null, 2));

      createOutwardMutation.mutate(transformedData);
    } catch (error) {
      toast({
        title: "Validation Error",
        description: error.message || "Please fill all required fields (godown, batch name, and supervisor) for all batches",
        variant: "destructive",
      });
    }
  };

  const buildOutwardPayloadForSalesOrders = (data, salesOrderIds, vehicleNo) => {
    const idSet = new Set(salesOrderIds.map((id) => String(id)));
    const filtered = (data.sales_orders || []).filter((so) =>
      idSet.has(String(so.sales_order_id)),
    );
    if (!filtered.length) {
      throw new Error(`No form sales orders match vehicle ${vehicleNo}`);
    }

    const transformedSections = filtered.map((salesOrder) => ({
      sales_order_id: salesOrder.sales_order_id,
      items: salesOrder.items.map((item) => {
        const itemId = typeof item.item_id === "string" ? parseInt(item.item_id, 10) : item.item_id;
        return {
          item_id: parseInt(item.item_id, 10),
          remarks: item.remarks && item.remarks.trim() !== "" ? item.remarks.trim() : null,
          godowns: item.godowns.map((godownSection, godownIdx) => {
            let godownId = null;
            const godownSupervisorId =
              godownSection.supervisor_id && godownSection.supervisor_id !== ""
                ? godownSection.supervisor_id
                : null;

            if (!godownSection.godown_id) {
              throw new Error(
                `SO ${salesOrder.sales_order_id}, Item ${item.item_id}: Godown is required`,
              );
            }

            const godownsForItem = itemGodowns[itemId] || [];
            const selectedGodown = godownsForItem.find((g) => {
              const godownIdStr = String(godownSection.godown_id);
              return g.godown === godownIdStr || String(g.godown_id) === godownIdStr;
            });
            if (selectedGodown?.godown_id) {
              godownId = selectedGodown.godown_id;
            } else {
              const masterGodown = (allGodownsMaster || []).find((g) => {
                const godownIdStr = String(godownSection.godown_id);
                return g.godown === godownIdStr || String(g.godown_id) === godownIdStr;
              });
              if (masterGodown?.godown_id) {
                godownId = masterGodown.godown_id;
              } else if (
                typeof godownSection.godown_id === "string" &&
                !Number.isNaN(Number(godownSection.godown_id))
              ) {
                godownId = parseInt(godownSection.godown_id, 10);
              } else if (typeof godownSection.godown_id === "number") {
                godownId = godownSection.godown_id;
              } else {
                throw new Error(
                  `SO ${salesOrder.sales_order_id}: Could not find godown "${godownSection.godown_id}"`,
                );
              }
            }

            if (!godownSection.batches?.length) {
              throw new Error(
                `SO ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown ${godownIdx + 1}: batch required`,
              );
            }
            if (!godownSupervisorId) {
              throw new Error(
                `SO ${salesOrder.sales_order_id}, Item ${item.item_id}, Godown ${godownIdx + 1}: supervisor required`,
              );
            }

            return {
              godown_id: typeof godownId === "number" ? godownId : parseInt(godownId, 10),
              supervisor_id: godownSupervisorId,
              batches: godownSection.batches.map((batch, batchIdx) => {
                if (!batch.name?.trim()) {
                  throw new Error(
                    `SO ${salesOrder.sales_order_id}: Batch ${batchIdx + 1} name required`,
                  );
                }
                return {
                  name: batch.name.trim(),
                  number_of_bags: batch.number_of_bags
                    ? parseInt(batch.number_of_bags, 10)
                    : null,
                };
              }),
            };
          }),
        };
      }),
    }));

    return {
      date: data.date,
      vehicle_no: vehicleNo,
      godown_sequence: data.godown_sequence || [],
      sales_orders: transformedSections,
    };
  };

  const handleSplitConfirm = async (mappings) => {
    const data = form.getValues();
    const formSoIds = (data.sales_orders || [])
      .map((so) => String(so.sales_order_id || "").trim())
      .filter(Boolean);

    for (const mapping of mappings) {
      const missing = mapping.sales_order_ids.filter((id) => !formSoIds.includes(String(id)));
      if (missing.length) {
        toast({
          title: "Split loading",
          description: `Add these sales orders on the form first (with godown/batch/supervisor): ${missing.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    setSplitCreating(true);
    const created = [];
    try {
      for (const mapping of mappings) {
        const payload = buildOutwardPayloadForSalesOrders(
          data,
          mapping.sales_order_ids,
          mapping.vehicle_no,
        );
        const result = await createOutwardEntry(payload);
        const status = Number(result?.status);
        if (!(status === 200 || status === 201)) {
          throw new Error(
            result?.message || `Failed to create gate pass for ${mapping.vehicle_no}`,
          );
        }
        created.push({
          vehicle_no: mapping.vehicle_no,
          bill_no: result?.data?.bill_no || result?.data?.id || null,
          so_count: mapping.sales_order_ids.length,
        });
      }

      setManageVehicleOpen(false);
      toast({
        title: "Split Gate Passes Created Successfully",
        description: created
          .map((row) => `${row.vehicle_no}: ${row.bill_no || "OK"} (${row.so_count} SO)`)
          .join(" · "),
      });
      queryClient.invalidateQueries(["outward-entries"]);
      setLocation("/outward/outward-list");
    } catch (err) {
      toast({
        title: "Split Gate Pass Creation Failed",
        description: created.length
          ? `${err?.message || "Error"} (${created.length} already created)`
          : err?.message || "Unable to create split gate passes",
        variant: "destructive",
      });
    } finally {
      setSplitCreating(false);
    }
  };

  const buildManageVehicleSalesOrders = () => {
    const rows = form.getValues("sales_orders") || [];
    const list = salesOrders || [];
    return rows
      .map((row) => {
        const soId = String(row?.sales_order_id || "").trim();
        if (!soId) return null;
        const fromList = list.find(
          (o) => String(o.so_number || o.order_id) === soId,
        );
        return {
          so_number: soId,
          order_id: soId,
          sales_order_id: soId,
          customer_id: fromList?.customer_id ?? null,
          customer_name: fromList?.customer_name || "",
        };
      })
      .filter(Boolean);
  };

  const openManageVehicle = () => {
    const selected = buildManageVehicleSalesOrders();
    if (selected.length < 1) {
      toast({
        title: "Select sales orders",
        description: "Add at least one sales order before Manage Vehicle.",
        variant: "destructive",
      });
      return;
    }
    setManageVehicleSalesOrders(selected);
    setManageVehicleOpen(true);
  };

  /** Collect configured godown sections from the form (with resolved names). */
  const collectFormGodownSections = () => {
    const salesOrders = form.getValues("sales_orders") || [];
    const sections = [];
    salesOrders.forEach((so, soIndex) => {
      (so?.items || []).forEach((item, itemIndex) => {
        (item?.godowns || []).forEach((g, godownIndex) => {
          if (g?.godown_id === "" || g?.godown_id == null) return;
          const resolvedId = coerceGodownId(
            g.godown_id,
            itemGodowns,
            allGodownsMaster,
            null
          );
          const godownName = resolvedId
            ? resolveGodownName(resolvedId, itemGodowns, allGodownsMaster, null)
            : String(g.godown_id);
          sections.push({
            soIndex,
            itemIndex,
            godownIndex,
            godownKey: String(resolvedId || godownName).toLowerCase(),
            godownName,
            supervisor_id: g.supervisor_id != null && g.supervisor_id !== ""
              ? String(g.supervisor_id)
              : "",
          });
        });
      });
    });
    return sections;
  };

  const buildUniqueGodownDraft = (sections) => {
    const map = new Map();
    sections.forEach((s) => {
      if (!map.has(s.godownKey)) {
        map.set(s.godownKey, {
          godownKey: s.godownKey,
          godownName: s.godownName,
          supervisor_id: s.supervisor_id || "",
        });
      } else if (s.supervisor_id && !map.get(s.godownKey).supervisor_id) {
        map.get(s.godownKey).supervisor_id = s.supervisor_id;
      }
    });
    return Array.from(map.values());
  };

  const applySupervisorDraftToForm = (draft) => {
    const byKey = new Map(draft.map((d) => [d.godownKey, d.supervisor_id || ""]));
    const salesOrders = form.getValues("sales_orders") || [];
    const next = salesOrders.map((so) => ({
      ...so,
      items: (so.items || []).map((item) => ({
        ...item,
        godowns: (item.godowns || []).map((g) => {
          if (g?.godown_id === "" || g?.godown_id == null) return g;
          const resolvedId = coerceGodownId(
            g.godown_id,
            itemGodowns,
            allGodownsMaster,
            null
          );
          const godownName = resolvedId
            ? resolveGodownName(resolvedId, itemGodowns, allGodownsMaster, null)
            : String(g.godown_id);
          const key = String(resolvedId || godownName).toLowerCase();
          if (!byKey.has(key)) return g;
          const supervisorId = byKey.get(key);
          return {
            ...g,
            supervisor_id: supervisorId ? supervisorId : undefined,
          };
        }),
      })),
    }));
    form.setValue("sales_orders", next, { shouldDirty: true, shouldValidate: true });
  };

  /** Prefer supervisors used on the last gate pass for this vehicle number. */
  const fetchVehicleSupervisorMap = async (vehicleNo) => {
    const vehicle = String(vehicleNo || "").trim();
    if (!vehicle) return {};
    try {
      const listRes = await fetchOutwardEntries({
        vehicle_no: vehicle,
        page: 1,
        per_page: 1,
      });
      const first = (listRes?.data || [])[0];
      const outwardId = first?.id ?? first?.outward_id ?? first?.outward_entry_id;
      if (!outwardId) return {};
      const detail = await fetchOutwardEntryDetail(outwardId);
      const sources =
        Array.isArray(detail?.purchase_returns) && detail.purchase_returns.length > 0
          ? detail.purchase_returns
          : Array.isArray(detail?.sales_orders)
            ? detail.sales_orders
            : [];
      const map = {};
      sources.forEach((source) => {
        (source?.items || []).forEach((item) => {
          (item?.godowns || []).forEach((godown) => {
            const sid = godown?.supervisor_id;
            if (sid == null || sid === "") return;
            const resolvedId = coerceGodownId(
              godown.godown_id,
              itemGodowns,
              allGodownsMaster,
              null
            );
            const godownName =
              godown.godown_name ||
              (resolvedId
                ? resolveGodownName(resolvedId, itemGodowns, allGodownsMaster, null)
                : String(godown.godown_id || ""));
            const key = String(resolvedId || godownName).toLowerCase();
            if (key && key !== "undefined") {
              map[key] = String(sid);
            }
            if (godownName) {
              map[String(godownName).toLowerCase()] = String(sid);
            }
          });
        });
      });
      return map;
    } catch (err) {
      console.error("Failed to load vehicle supervisor history:", err);
      return {};
    }
  };

  const openAssignSupervisor = async () => {
    const sections = collectFormGodownSections();
    if (sections.length === 0) {
      toast({
        title: "Add batches first",
        description: "Configure godown/batches on items before assigning supervisors.",
        variant: "destructive",
      });
      return;
    }
    setAssignSupervisorLoading(true);
    try {
      let draft = buildUniqueGodownDraft(sections);
      const vehicleMap = await fetchVehicleSupervisorMap(form.getValues("vehicle_no"));
      draft = draft.map((row) => {
        if (row.supervisor_id) return row;
        const fromVehicle =
          vehicleMap[row.godownKey] ||
          vehicleMap[String(row.godownName || "").toLowerCase()];
        return fromVehicle ? { ...row, supervisor_id: fromVehicle } : row;
      });
      // Fill remaining blanks from godown-specific / all supervisors
      const filled = await Promise.all(
        draft.map(async (row) => {
          if (row.supervisor_id) return row;
          const byGodown = await fetchSupervisorsByGodown(row.godownName);
          const pick = (byGodown?.[0] || allSupervisors?.[0])?.user_id;
          return pick ? { ...row, supervisor_id: String(pick) } : row;
        })
      );
      setAssignSupervisorDraft(filled);
      setAssignSupervisorOpen(true);
    } finally {
      setAssignSupervisorLoading(false);
    }
  };

  const handleAutoAssignSupervisors = async () => {
    setAssignSupervisorLoading(true);
    try {
      const vehicleMap = await fetchVehicleSupervisorMap(form.getValues("vehicle_no"));
      const next = await Promise.all(
        assignSupervisorDraft.map(async (row) => {
          const fromVehicle =
            vehicleMap[row.godownKey] ||
            vehicleMap[String(row.godownName || "").toLowerCase()];
          if (fromVehicle) return { ...row, supervisor_id: fromVehicle };
          const byGodown = await fetchSupervisorsByGodown(row.godownName);
          const pick = (byGodown?.[0] || allSupervisors?.[0])?.user_id;
          return pick ? { ...row, supervisor_id: String(pick) } : row;
        })
      );
      setAssignSupervisorDraft(next);
      toast({
        title: "Supervisors auto-assigned",
        description: form.getValues("vehicle_no")
          ? "Used last gate pass for this vehicle where available, otherwise godown supervisors."
          : "Assigned first available supervisor per godown.",
      });
    } finally {
      setAssignSupervisorLoading(false);
    }
  };

  const handleApplyAssignSupervisors = () => {
    applySupervisorDraftToForm(assignSupervisorDraft);
    setAssignSupervisorOpen(false);
    toast({
      title: "Supervisors applied",
      description: "Godown supervisors updated across sales order items.",
    });
  };

  const supervisorAssignmentStatus = useMemo(() => {
    let configured = 0;
    let missing = 0;
    let selectedOrders = 0;
    (watchedSalesOrders || []).forEach((so) => {
      if (so?.sales_order_id) selectedOrders += 1;
      (so?.items || []).forEach((item) => {
        (item?.godowns || []).forEach((g) => {
          if (g?.godown_id === "" || g?.godown_id == null) return;
          configured += 1;
          if (!g.supervisor_id || g.supervisor_id === "") missing += 1;
        });
      });
    });
    return {
      hasGodowns: configured > 0,
      allAssigned: configured > 0 && missing === 0,
      missingCount: missing,
      selectedOrders,
    };
  }, [watchedSalesOrders]);

  // Highlight Manage Vehicle when vehicle + SO are set but supervisors are incomplete
  const highlightManageVehicle =
    manageVehicleEnabled &&
    !isEditMode &&
    entryMode === "sales_order" &&
    Boolean(String(watchedVehicleNo || "").trim()) &&
    supervisorAssignmentStatus.selectedOrders > 0 &&
    supervisorAssignmentStatus.hasGodowns &&
    !supervisorAssignmentStatus.allAssigned;

  const addSalesOrder = () => {
    appendSalesOrder({
      sales_order_id: "",
      items: [{
        item_id: "",
        remarks: "",
        total_quantity: "",
        godowns: [{
          godown_id: "",
          supervisor_id: undefined,
          batches: [{
            name: "",
            number_of_bags: ""
            // Note: supervisor_id removed from batch level - only at godown level
          }]
        }]
      }]
    });
  };

  const handleRemoveSalesOrder = (soIndex) => {
    if (salesOrderFields.length > 1) {
      removeSalesOrderFromArray(soIndex);
    }
  };
  // console.log("salesOrderFields", salesOrderFields);

  const addItem = (soIndex) => {
    const currentItems = form.getValues(`sales_orders.${soIndex}.items`) || [];
    form.setValue(`sales_orders.${soIndex}.items`, [
      ...currentItems,
      {
        item_id: "",
        remarks: "",
        total_quantity: "",
        godowns: [{
          godown_id: "",
          supervisor_id: undefined,
          batches: [{
            name: "",
            number_of_bags: ""
            // Note: supervisor_id removed from batch level - only at godown level
          }]
        }]
      }
    ]);
  };

  const removeItem = (soIndex, itemIndex) => {
    const currentItems = form.getValues(`sales_orders.${soIndex}.items`) || [];
    const itemToRemove = currentItems[itemIndex];
    const itemIdToRemove = itemToRemove?.item_id ? String(itemToRemove.item_id) : null;
    // Remove from cache so values don't shift to other rows
    if (itemIdToRemove) {
      const cacheKey = `${soIndex}-${itemIdToRemove}`;
      setSalesOrderItemApprovedQuantities(prev => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
      setSalesOrderItemBaseUnits(prev => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
      setSalesOrderItemDisplayNames(prev => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
    }
    // Allow removing items even if only 1 item remains (user can remove all items if needed)
    const updatedItems = currentItems.filter((_, idx) => idx !== itemIndex);
    form.setValue(`sales_orders.${soIndex}.items`, updatedItems, { shouldValidate: true, shouldDirty: true });
  };

  // Get item name by ID
  const getItemName = (itemId) => {
    const item = stockItems.find(item => item.id === parseInt(itemId));
    return item ? item.name : "";
  };

  // Get godown name by ID (no longer needed as we store godown names directly)
  // const getGodownName = (godownId) => {
  //   const godown = godowns.find(godown => godown.id === parseInt(godownId));
  //   return godown ? (godown.name || godown.godown_name || godown.location) : "";
  // };

  // Get supervisor name by ID
  const getSupervisorName = (supervisorId) => {
    const list = Array.isArray(supervisors) ? supervisors : [];
    const supervisor = list.find(supervisor =>
      supervisor.user_id === supervisorId ||
      supervisor.id === parseInt(supervisorId)
    );
    return supervisor ? (supervisor.name || supervisor.user_name || supervisor.full_name) : "";
  };

  const getSupervisorDisplayName = (supervisor) => {
    const name = supervisor?.name || supervisor?.user_name || supervisor?.full_name || "—";
    const roleName = supervisor?.role_name || "Supervisor";
    return `${name} - ${roleName}`;
  };

  const SupervisorStatusBadge = ({ activeStatus }) => {
    const isPresent = activeStatus === true;
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold leading-none ${
          isPresent ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}
      >
        {isPresent ? "Present" : "Absent"}
      </span>
    );
  };

  const renderSupervisorOptionLabel = (supervisor) => (
    <div className="flex w-full min-w-0 items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate text-left text-sm">
        {getSupervisorDisplayName(supervisor)}
      </span>
      <SupervisorStatusBadge activeStatus={supervisor?.active_status} />
    </div>
  );

  // Get sales order name by ID. Falls back to the edit-mode source map (built
  // from the gate-pass details payload) when the sales-orders dropdown query
  // hasn't resolved yet — without this guard the lookup can crash with
  // "Cannot read properties of undefined (reading 'find')" in edit mode.
  const getSalesOrderName = (salesOrderId) => {
    const list = Array.isArray(salesOrders) ? salesOrders : [];
    const order = list.find(
      (order) =>
        order.so_number === salesOrderId || order.order_id === salesOrderId
    );
    if (order) {
      return `${order.so_number || order.order_id} - ${order.customer_name || ''}`;
    }
    const fallback = editSourceNameMap?.[String(salesOrderId)];
    if (fallback) {
      return fallback;
    }
    return salesOrderId ? String(salesOrderId) : "";
  };

  const modeLabelPlural = entryMode === "purchase_return" ? "Purchase Returns" : "Sales Orders";
  const modeLabelSingular = entryMode === "purchase_return" ? "Purchase Return" : "Sales Order";
  const modeSearchPlaceholder = entryMode === "purchase_return" ? "Search purchase returns..." : "Search sales orders...";

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      {/* Loading Overlay during submission */}
      {createOutwardMutation.isPending && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-lg font-semibold text-gray-700">
              {isEditMode ? "Updating Gate Pass..." : "Creating Gate Pass..."}
            </p>
            <p className="text-sm text-gray-500">Please wait while we process your request</p>
          </div>
        </div>
      )}

      {/* Loading Overlay while fetching existing gate pass for editing */}
      {isLoadingEditData && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-lg font-semibold text-gray-700">Loading gate pass...</p>
            <p className="text-sm text-gray-500">Prefilling the form for editing</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setLocation("/reports/sales-order-list")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {createOutwardMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-600" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">
                {isEditMode ? "Edit Gate Pass" : "Add Gate Pass"}
              </h1>
              <p className="text-[11px] text-zinc-500 leading-tight">
                {isEditMode
                  ? "Update an existing gate pass entry"
                  : "Create new gate pass entry"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] h-6 border-amber-300 text-amber-800 bg-amber-50">
            <Calendar className="h-3 w-3 mr-1 text-amber-700" />
            {new Date().toLocaleDateString('en-GB')}
          </Badge>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 p-2 sm:p-3 min-h-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5">
            {/* Basic Information */}
            <div className="bg-white rounded-md border border-zinc-200 shadow-none overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50">
                <div className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-amber-600" />
                  <h2 className="text-sm font-semibold text-zinc-900">Basic Information</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    onClick={openAssignSupervisor}
                    disabled={assignSupervisorLoading}
                  >
                    {assignSupervisorLoading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                    )}
                    Assign Supervisor
                    {supervisorAssignmentStatus.missingCount > 0 ? (
                      <span className="ml-1 tabular-nums">({supervisorAssignmentStatus.missingCount})</span>
                    ) : null}
                  </Button>
                  {!isEditMode && entryMode === "sales_order" && manageVehicleEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      className={`h-7 text-xs ${
                        highlightManageVehicle
                          ? "bg-violet-600 hover:bg-violet-700 text-white ring-2 ring-violet-300 ring-offset-1 animate-pulse"
                          : "bg-violet-100 hover:bg-violet-200 text-violet-800 border border-violet-300"
                      }`}
                      onClick={openManageVehicle}
                      title={
                        highlightManageVehicle
                          ? "Supervisors incomplete — open Manage Vehicle / split loading"
                          : "Manage Vehicle / Split Loading"
                      }
                    >
                      <Truck className="h-3.5 w-3.5 mr-1" />
                      Manage Vehicle
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-2.5 grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1.2fr)_minmax(0,1fr)] gap-2 items-end">
                <div>
                  <Label htmlFor="date" className="text-[11px] font-medium text-zinc-600 mb-0.5 block">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    {...form.register("date")}
                    className={`h-8 text-sm ${form.formState.errors.date ? "border-red-500" : ""}`}
                  />
                  {form.formState.errors.date && (
                    <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.date.message}</p>
                  )}
                </div>
                <div className="min-w-0">
                  <Label htmlFor="vehicle_no" className="text-[11px] font-medium text-zinc-600 mb-0.5 block">Vehicle *</Label>
                  <Controller
                    name="vehicle_no"
                    control={form.control}
                    render={({ field }) => (
                      <Input
                        id="vehicle_no"
                        placeholder="Enter Vehicle Number"
                        maxLength={10}
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
                          field.onChange(value);
                        }}
                        className={`h-8 min-w-0 w-full text-sm ${form.formState.errors.vehicle_no ? "border-red-500" : ""}`}
                      />
                    )}
                  />
                  {form.formState.errors.vehicle_no && (
                    <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.vehicle_no.message}</p>
                  )}
                </div>
                <div className="min-w-0">
                  <Label className="text-[11px] font-medium text-zinc-600 mb-0.5 block">Godown Sequence</Label>
                  <GodownSequenceSelector form={form} itemGodowns={itemGodowns} allGodownsMaster={allGodownsMaster} cachedSelectedGodowns={cachedSelectedGodowns} />
                </div>
              </div>
            </div>

            {/* Sales Orders Section */}
            <Card className="border-zinc-200 shadow-none">
              <CardHeader className="px-3 py-1.5 border-b border-zinc-200 bg-zinc-50 rounded-t-md">
                <CardTitle className="flex flex-wrap items-center justify-between gap-1.5 text-sm font-semibold text-zinc-900">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-amber-600" />
                    {modeLabelPlural} ({salesOrderFields.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {canCreatePurchaseReturn && (
                      <div className="flex items-center rounded-md border border-zinc-200 p-0.5 bg-white">
                        <Button
                          type="button"
                          variant={entryMode === "sales_order" ? "default" : "ghost"}
                          size="sm"
                          className={`h-7 text-xs ${entryMode === "sales_order" ? "bg-violet-600 hover:bg-violet-700" : ""}`}
                          onClick={() => {
                            if (entryMode !== "sales_order") {
                              setEntryMode("sales_order");
                              form.reset({
                                date: form.getValues("date"),
                                vehicle_no: form.getValues("vehicle_no"),
                                godown_sequence: [],
                                sales_orders: [{
                                  sales_order_id: "",
                                  items: [{ item_id: "", remarks: "", total_quantity: "", godowns: [{ godown_id: "", supervisor_id: undefined, batches: [{ name: "", number_of_bags: "" }] }] }]
                                }]
                              });
                            }
                          }}
                        >
                          Sales Order
                        </Button>
                        <Button
                          type="button"
                          variant={entryMode === "purchase_return" ? "default" : "ghost"}
                          size="sm"
                          className={`h-7 text-xs ${entryMode === "purchase_return" ? "bg-violet-600 hover:bg-violet-700" : ""}`}
                          onClick={() => {
                            if (entryMode !== "purchase_return") {
                              setEntryMode("purchase_return");
                              form.reset({
                                date: form.getValues("date"),
                                vehicle_no: form.getValues("vehicle_no"),
                                godown_sequence: [],
                                sales_orders: [{
                                  sales_order_id: "",
                                  items: [{ item_id: "", remarks: "", total_quantity: "", godowns: [{ godown_id: "", supervisor_id: undefined, batches: [{ name: "", number_of_bags: "" }] }] }]
                                }]
                              });
                            }
                          }}
                        >
                          Purchase Return
                        </Button>
                      </div>
                    )}
                  <Button type="button" onClick={addSalesOrder} variant="outline" size="sm" className="h-7 text-xs border-violet-200 text-violet-800 hover:bg-violet-50">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add {modeLabelSingular}
                  </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2.5">
                <div className="space-y-2">
                  {salesOrderFields.length === 0 ? (
                    <div className="text-center text-zinc-500 py-3 text-sm">
                      No {modeLabelPlural.toLowerCase()} added. Click "Add {modeLabelSingular}" to get started.
                    </div>
                  ) : (
                    salesOrderFields.map((salesOrderField, soIndex) => {
                      const currentItems = form.watch(`sales_orders.${soIndex}.items`) || [];
                      const salesOrderId = form.watch(`sales_orders.${soIndex}.sales_order_id`);
                      return (
                        <Card key={salesOrderField.id} className="border border-zinc-200 shadow-none">
                          <CardHeader className="py-1.5 px-2.5 bg-zinc-50/80 border-b border-zinc-200">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {salesOrderId ? (
                                  <span className="text-xs sm:text-sm font-semibold text-zinc-800 break-words">
                                    {getSalesOrderName(salesOrderId)}
                                  </span>
                                ) : (
                                  <Controller
                                    name={`sales_orders.${soIndex}.sales_order_id`}
                                    control={form.control}
                                    render={({ field }) => (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            role="combobox"
                                            className="h-8 text-sm justify-between"
                                            size="sm"
                                          >
                                            Select {modeLabelSingular.toLowerCase()}...
                                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0">
                                          <div className="p-2">
                                            <div className="relative">
                                              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input
                                                placeholder={modeSearchPlaceholder}
                                                value={salesOrderSearchTerm}
                                                onChange={(e) => setSalesOrderSearchTerm(e.target.value)}
                                                className="pl-8"
                                              />
                                            </div>
                                          </div>
                                          <div className="max-h-60 overflow-auto">
                                            {salesOrdersLoading ? (
                                              <div className="p-4 text-center">
                                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                              </div>
                                            ) : (
                                              salesOrders
                                                .filter(order =>
                                                  (!salesOrderSearchTerm ||
                                                  (order.so_number || order.order_id || '').toLowerCase().includes(salesOrderSearchTerm.toLowerCase()) ||
                                                  (order.customer_name || '').toLowerCase().includes(salesOrderSearchTerm.toLowerCase()))
                                                  && (order.is_gate_pass_eligible !== false || Boolean(salesOrderSearchTerm))
                                                )
                                                .map((order) => (
                                                  <Button
                                                    key={order.so_number || order.order_id}
                                                    variant="ghost"
                                                    className="w-full justify-start"
                                                    onClick={async () => {
                                                      const selectedKey = entryMode === "purchase_return"
                                                        ? String(order.order_id || "")
                                                        : String(order.so_number || order.order_id || "");
                                                      field.onChange(selectedKey);
                                                      setSelectedSalesOrder(order);
                                                      setSalesOrderSearchTerm("");

                                                      const soNumber = selectedKey;
                                                      setProcessedSalesOrderId(null);
                                                      setProcessedSalesOrderIds(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete(`${soIndex}-${soNumber}`);
                                                        return newSet;
                                                      });

                                                      const details = await fetchSourceDetails(soNumber);
                                                      if (details) {
                                                        setSelectedSalesOrderData(details);
                                                        // Ensure manual dropdown selection behaves like GP deep-link autofill.
                                                        // Process immediately for this row to avoid state/effect timing misses.
                                                        await processSalesOrderItems(details, soIndex);
                                                      } else {
                                                        toast({
                                                          title: "Sales order details failed",
                                                          description: `Could not load items for ${soNumber}. Restart backend and try again.`,
                                                          variant: "destructive",
                                                        });
                                                      }
                                                    }}
                                                  >
                                                    {(entryMode === "purchase_return"
                                                      ? (order.so_number || order.order_id)
                                                      : (order.so_number || order.order_id)
                                                    )} - {order.customer_name || ''}
                                                  </Button>
                                                ))
                                            )}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  />
                                )}
                                {form.formState.errors.sales_orders?.[soIndex]?.sales_order_id && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {entryMode === "purchase_return"
                                      ? "Purchase return is required"
                                      : form.formState.errors.sales_orders[soIndex].sales_order_id.message}
                                  </p>
                                )}
                              </div>
                              {salesOrderFields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveSalesOrder(soIndex)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Remove sales order"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 px-0 pb-0">
                            {currentItems.length === 0 ? (
                              <div className="text-center text-zinc-500 py-3 text-sm px-2.5">
                                No items. Select sales order to auto-fill items.
                              </div>
                            ) : (
                              <div className="divide-y divide-zinc-200 border-t border-zinc-100">
                                {currentItems.map((item, itemIndex) => {
                                  // Check if batches are saved for this item
                                  const godowns = form.watch(`sales_orders.${soIndex}.items.${itemIndex}.godowns`) || [];
                                  const hasSavedBatches = godowns.length > 0 && godowns.some(godown =>
                                    godown.batches && godown.batches.length > 0 &&
                                    godown.batches.some(batch => batch.name && batch.name.trim() !== "")
                                  );

                                  const currentItemId = form.watch(`sales_orders.${soIndex}.items.${itemIndex}.item_id`);
                                  const currentItem = allStockItems.find(s => s.id === currentItemId) || additionalStockItems.find(s => s.id === currentItemId);
                                  const itemCacheKey = currentItemId ? `${soIndex}-${currentItemId}` : `${soIndex}-${itemIndex}`;
                                  // Prefer sales order item name so gate pass shows same name as in sales order
                                  const itemName = salesOrderItemDisplayNames[itemCacheKey] || currentItem?.name || currentItem?.item_name || "No item selected";
                                  const totalQuantity = form.watch(`sales_orders.${soIndex}.items.${itemIndex}.total_quantity`) || "";
                                  const baseUnitName = salesOrderItemBaseUnits[itemCacheKey] || "";

                                  const handleRowClick = () => {
                                    if (!currentItemId) return;

                                    // Load existing godown sections if available
                                    const existingGodowns = (form.watch(`sales_orders.${soIndex}.items.${itemIndex}.godowns`) || [])
                                      .filter((godownSection) => {
                                        const godownId = coerceGodownId(
                                          godownSection?.godown_id,
                                          itemGodowns,
                                          allGodownsMaster,
                                          null
                                        );
                                        const hasNamedBatch = (godownSection.batches || []).some(
                                          (batch) => batch?.name && String(batch.name).trim()
                                        );
                                        return godownId && hasNamedBatch;
                                      });

                                    if (existingGodowns.length > 0) {
                                      // Convert all existing godown sections to modal format
                                      const godownSectionsForModal = existingGodowns.map((godownSection) => {
                                        const resolvedId = coerceGodownId(
                                          godownSection.godown_id,
                                          itemGodowns,
                                          allGodownsMaster,
                                          null
                                        );
                                        const godownName = resolvedId
                                          ? resolveGodownName(resolvedId, itemGodowns, allGodownsMaster, null)
                                          : String(godownSection.godown_id || "");

                                        // Convert batches to modal format
                                        const batchesForModal = (godownSection.batches || []).map(batch => ({
                                          name: batch.name || "",
                                          number_of_bags: batch.number_of_bags || ""
                                        }));

                                        return {
                                          godown: godownName,
                                          supervisor_id: godownSection.supervisor_id || undefined,
                                          batches: batchesForModal.length > 0 ? batchesForModal : [{ name: "", number_of_bags: "" }]
                                        };
                                      });

                                      setModalGodownSections(godownSectionsForModal);

                                      // Load batch details for all godowns
                                      const itemKeyForExisting = currentItemId ? `${soIndex}-${currentItemId}` : `${soIndex}-${itemIndex}`;
                                      const itemNameForBatch = (
                                        currentItem?.name ||
                                        currentItem?.item_name ||
                                        salesOrderItemDisplayNames[itemKeyForExisting] ||
                                        ""
                                      ).trim();
                                      if (itemNameForBatch) {
                                        godownSectionsForModal.forEach((section) => {
                                          if (section.godown) {
                                            loadBatchDetails(currentItemId, itemNameForBatch, section.godown);
                                          }
                                        });
                                      }
                                    } else {
                                      // Initialize empty state with one godown section
                                      setModalGodownSections([{
                                        godown: "",
                                        supervisor_id: undefined,
                                        batches: [{ name: "", number_of_bags: "" }]
                                      }]);
                                    }

                                    setEditingItemIndex(`${soIndex}-${itemIndex}`);
                                    setBatchModalOpen(prev => ({ ...prev, [`${soIndex}-${itemIndex}`]: true }));
                                  };

                                  return (
                                    <div
                                      key={`so-${soIndex}-item-${currentItemId ?? itemIndex}`}
                                      onClick={handleRowClick}
                                      className={`px-2 py-1.5 border-b border-zinc-200 last:border-b-0 cursor-pointer transition-colors ${
                                        hasSavedBatches
                                          ? "bg-emerald-50/70 hover:bg-emerald-50"
                                          : "bg-white hover:bg-amber-50/40"
                                      }`}
                                    >
                                      <div className="grid grid-cols-12 gap-2 items-center">
                                        {/* Delete Button */}
                                        <div className="col-span-1 flex items-center justify-center">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeItem(soIndex, itemIndex);
                                            }}
                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            title="Remove item"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>

                                        {/* Item Name - Read Only (full name, wrap if needed) */}
                                        <div className="col-span-3 min-w-0">
                                          <div className="text-sm font-medium text-zinc-900 leading-snug break-words">
                                            {itemName}
                                          </div>
                                        </div>

                                        {/* Approved Quantity - Read Only */}
                                        <div className="col-span-2">
                                          <div className="flex flex-col leading-tight">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Approved</span>
                                            {(() => {
                                              const itemKey = currentItemId ? `${soIndex}-${currentItemId}` : `${soIndex}-${itemIndex}`;
                                              const approvedQty = salesOrderItemApprovedQuantities[itemKey] || 0;
                                              return (
                                                <div className="text-sm font-semibold text-zinc-700 tabular-nums">
                                                  {Math.floor(approvedQty)} {baseUnitName || ''}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>

                                        {/* Loading Quantity - Editable */}
                                        <div className="col-span-3">
                                          <Controller
                                            name={`sales_orders.${soIndex}.items.${itemIndex}.total_quantity`}
                                            control={form.control}
                                            render={({ field }) => {
                                              const godowns = form.watch(`sales_orders.${soIndex}.items.${itemIndex}.godowns`) || [];
                                              const calculatedTotal = godowns.reduce((godownSum, godown) => {
                                                if (godown.batches && godown.batches.length > 0) {
                                                  const godownTotal = godown.batches.reduce((sum, batch) => {
                                                    const bags = batch.number_of_bags;
                                                    if (bags && bags !== "") {
                                                      const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                                                      return sum + (isNaN(numBags) ? 0 : numBags);
                                                    }
                                                    return sum;
                                                  }, 0);
                                                  return godownSum + godownTotal;
                                                }
                                                return godownSum;
                                              }, 0);

                                              const calculatedStr = calculatedTotal > 0 ? Math.floor(calculatedTotal).toString() : "";
                                              // Ensure display value is always an integer. Once the user has
                                              // explicitly typed in (or cleared) this loading-qty field, respect
                                              // `field.value` even when empty so they can backspace to retype.
                                              const editedKeyForDisplay = currentItemId
                                                ? `${soIndex}-${currentItemId}`
                                                : `${soIndex}-${itemIndex}`;
                                              const userEdited = !!userEditedLoadingQty[editedKeyForDisplay];
                                              const rawValue = userEdited ? (field.value ?? "") : (field.value || calculatedStr);
                                              const displayValue = rawValue ? Math.floor(parseFloat(rawValue) || 0).toString() : "";

                                              return (
                                                <div onClick={(e) => e.stopPropagation()} className="flex flex-col leading-tight">
                                                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-0.5">Loading</span>
                                                  <div className="flex items-center gap-1">
                                                    <Input
                                                      type="text"
                                                      inputMode="numeric"
                                                      pattern="[0-9]*"
                                                      placeholder="Qty"
                                                      value={displayValue}
                                                    onKeyDown={(e) => {
                                                      // Allow control keys: Backspace, Delete, Tab, Escape, Enter, Arrow keys
                                                      const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                                                      if (allowedKeys.includes(e.key)) {
                                                        return;
                                                      }
                                                      // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                                                      if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                                                        return;
                                                      }
                                                      // Only allow digits (0-9)
                                                      if (!/^[0-9]$/.test(e.key)) {
                                                        e.preventDefault();
                                                      }
                                                    }}
                                                    onChange={(e) => {
                                                      let value = e.target.value;
                                                      // Remove any non-digit characters
                                                      value = value.replace(/[^0-9]/g, '');
                                                      // Only allow integers
                                                      if (value === '' || /^\d+$/.test(value)) {
                                                        const itemKey = currentItemId ? `${soIndex}-${currentItemId}` : `${soIndex}-${itemIndex}`;
                                                        const approvedQty = salesOrderItemApprovedQuantities[itemKey] || 0;
                                                        trySetLoadingQuantity(
                                                          soIndex,
                                                          itemIndex,
                                                          value,
                                                          itemKey,
                                                          approvedQty,
                                                          field.onChange
                                                        );
                                                      }
                                                    }}
                                                    onPaste={(e) => {
                                                      e.preventDefault();
                                                      const pastedText = e.clipboardData.getData('text');
                                                      const integerOnly = pastedText.replace(/[^0-9]/g, '');
                                                      if (integerOnly) {
                                                        const itemKey = currentItemId ? `${soIndex}-${currentItemId}` : `${soIndex}-${itemIndex}`;
                                                        const approvedQty = salesOrderItemApprovedQuantities[itemKey] || 0;
                                                        trySetLoadingQuantity(
                                                          soIndex,
                                                          itemIndex,
                                                          integerOnly,
                                                          itemKey,
                                                          approvedQty,
                                                          field.onChange
                                                        );
                                                      }
                                                    }}
                                                    className={`flex-1 h-8 text-sm ${form.formState.errors.sales_orders?.[soIndex]?.items?.[itemIndex]?.total_quantity ? "border-red-500" : ""}`}
                                                  />
                                                  {baseUnitName && (
                                                    <div className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-300 rounded text-[10px] font-medium text-zinc-700 min-w-[40px] text-center whitespace-nowrap">
                                                      {baseUnitName}
                                                    </div>
                                                  )}
                                                  </div>
                                                </div>
                                              );
                                            }}
                                          />
                                        </div>

                                        {/* Batches Status */}
                                        <div className="col-span-3 flex items-center justify-end">
                                          {(() => {
                                            const godowns = form.watch(`sales_orders.${soIndex}.items.${itemIndex}.godowns`) || [];
                                            const totalBatches = godowns.reduce((sum, godown) => sum + (godown.batches?.length || 0), 0);
                                            const missingSupervisor = godowns.some(
                                              (g) => g?.godown_id && (!g.supervisor_id || g.supervisor_id === "")
                                            );
                                            return (
                                              <div className="flex items-center gap-1.5">
                                                {missingSupervisor ? (
                                                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] h-5 px-1.5">
                                                    <UserPlus className="h-3 w-3 mr-0.5" />
                                                    Supervisor
                                                  </Badge>
                                                ) : null}
                                                {hasSavedBatches ? (
                                                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] h-5 px-1.5">
                                                    <CheckCircle className="h-3 w-3 mr-0.5" />
                                                    {totalBatches} Batch{totalBatches !== 1 ? 'es' : ''}
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="outline" className="text-zinc-600 text-[10px] h-5 px-1.5">
                                                    <Tag className="h-3 w-3 mr-0.5" />
                                                    Add Batches
                                                  </Badge>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {(() => {
              const sectionName = entryMode === "purchase_return" ? "Purchase return" : "Sales order";
              const messages = collectFormErrorMessages(form.formState.errors, [], sectionName);
              if (!messages.length) return null;
              return (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <p className="mb-0.5 font-medium">Fix these before creating the gate pass:</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setLocation("/outward/outward-list")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createOutwardMutation.isPending}
                className="h-8 text-xs bg-zinc-900 hover:bg-black text-white border border-amber-500/30"
              >
                {createOutwardMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditMode ? "Update Gate Pass" : "Create Gate Pass"}
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Batch & Godown Selection Modal */}
          {editingItemIndex !== null && (
            <Dialog
              open={batchModalOpen[editingItemIndex] || false}
              onOpenChange={(open) => {
                setBatchModalOpen(prev => ({ ...prev, [editingItemIndex]: open }));
                if (!open) {
                  setEditingItemIndex(null);
                  setModalGodownSections([]);
                }
              }}
            >
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Batches & Godowns</DialogTitle>
                </DialogHeader>

                {editingItemIndex !== null && (() => {
                  // Parse soIndex and itemIndex from editingItemIndex (format: "soIndex-itemIndex")
                  const [soIndex, itemIndex] = editingItemIndex.split('-').map(Number);
                  const currentItemId = form.watch(`sales_orders.${soIndex}.items.${itemIndex}.item_id`);
                  const currentItem = allStockItems.find(s => String(s.id) === String(currentItemId)) || additionalStockItems.find(s => String(s.id) === String(currentItemId));
                  const itemKeyForModal = currentItemId ? `${soIndex}-${currentItemId}` : `${soIndex}-${itemIndex}`;
                  const currentItemName = salesOrderItemDisplayNames[itemKeyForModal] || currentItem?.name || currentItem?.item_name || "Selected Item";
                  const currentItemGodowns = itemGodowns[currentItemId] || itemGodowns[String(currentItemId)] || [];
                  const isLoadingGodowns = loadingItemGodowns[currentItemId] || loadingItemGodowns[String(currentItemId)] || false;

                  const currentQuantity = form.watch(`sales_orders.${soIndex}.items.${itemIndex}.total_quantity`) || "";
                  const currentBaseUnit = salesOrderItemBaseUnits[itemKeyForModal] || "";

                  // Get approved quantity for validation - use item_id for stable lookup
                  const approvedQty = salesOrderItemApprovedQuantities[itemKeyForModal] || 0;
                  const baseUnitName = salesOrderItemBaseUnits[itemKeyForModal] || '';

                  // Use loading qty (total_quantity) for modal display and validation; fallback to approved qty if loading qty empty
                  const loadingQtyNum = (currentQuantity !== "" && currentQuantity != null)
                    ? (typeof currentQuantity === 'number' ? currentQuantity : parseFloat(String(currentQuantity)))
                    : approvedQty;
                  const quantityDenominator = (!isNaN(loadingQtyNum) && loadingQtyNum >= 0) ? Math.floor(loadingQtyNum) : Math.floor(approvedQty);
                  // Max quantity allowed in batches = loading qty when set, else approved qty (so validation matches "X/Y Pkt")
                  const maxQuantityForBatches = quantityDenominator;

                  // Calculate total entered quantity from all batches across all godown sections
                  const totalEnteredQuantity = modalGodownSections.reduce((total, section) => {
                    const sectionTotal = (section.batches || []).reduce((sum, batch) => {
                      const bags = batch.number_of_bags;
                      if (bags && bags !== "" && bags !== null) {
                        const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                        return sum + (isNaN(numBags) ? 0 : numBags);
                      }
                      return sum;
                    }, 0);
                    return total + sectionTotal;
                  }, 0);

                  return (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-blue-900">
                            Item: <span className="font-semibold">{currentItemName}</span>
                          </p>
                          <p className="text-sm font-medium text-blue-900">
                            Quantity: <span className="font-semibold">{totalEnteredQuantity}/{quantityDenominator} {baseUnitName}</span>
                          </p>
                        </div>
                      </div>

                      {/* Multiple Godown Sections */}
                      <div className="space-y-4">
                        {modalGodownSections.map((godownSection, sectionIndex) => (
                          <Card key={sectionIndex} className="p-4 border-2">
                            <div className="flex items-center justify-between mb-4">
                              <Label className="text-base font-semibold">
                                Godown Section {sectionIndex + 1}
                              </Label>
                              {modalGodownSections.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setModalGodownSections(prev => prev.filter((_, i) => i !== sectionIndex));
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>

                            {/* Step 1: Godown and Supervisor Selection (Same Row) */}
                            <div className="mb-4">
                              <Label className="text-sm font-medium mb-2 block">Step 1: Select Godown & Supervisor *</Label>
                              <div className="grid grid-cols-2 gap-3">
                                {/* Godown Selection */}
                                <div>
                                  <Select
                                    value={godownSection.godown || undefined}
                                    onValueChange={async (value) => {
                                      const updatedSections = [...modalGodownSections];
                                      updatedSections[sectionIndex] = {
                                        ...updatedSections[sectionIndex],
                                        godown: value || "",
                                        supervisor_id: "", // Reset to empty string when godown changes
                                        batches: [] // Reset batches when godown changes
                                      };
                                      setModalGodownSections(updatedSections);

                                      // Set selected godown for supervisor fetching
                                      if (value) {
                                        setSelectedGodownForSupervisor(value);
                                        // console.log("selected godown for supervisor", value);
                                      } else {
                                        setSelectedGodownForSupervisor(null);
                                      }

                                      // Load batch details when godown is selected
                                      const itemNameForLots = (
                                        currentItem?.name ||
                                        currentItem?.item_name ||
                                        salesOrderItemDisplayNames[itemKeyForModal] ||
                                        ""
                                      ).trim();
                                      if (currentItemId && value && itemNameForLots) {
                                        loadBatchDetails(currentItemId, itemNameForLots, value);
                                      }
                                    }}
                                    disabled={!currentItemId}
                                  >
                                    <SelectTrigger className={!godownSection.godown ? "border-red-500" : ""}>
                                      <SelectValue placeholder={!currentItemId ? "Select item first" : isLoadingGodowns ? "Loading godowns..." : "Select godown..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {isLoadingGodowns ? (
                                        <div className="p-4 text-center">
                                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                          <p className="text-sm text-gray-500 mt-2">Loading godowns...</p>
                                        </div>
                                      ) : (() => {
                                        const godownsWithId = currentItemGodowns.filter(g => g.godown_id);
                                        const godownsWithoutId = currentItemGodowns.filter(g => !g.godown_id);

                                        if (godownsWithoutId.length > 0 && allGodownsMaster.length === 0 && !loadingAllGodowns) {
                                          fetchAllGodownsMaster();
                                        }

                                        const availableGodowns = godownsWithId.length > 0
                                          ? currentItemGodowns
                                          : (allGodownsMaster.length > 0 ? allGodownsMaster : currentItemGodowns);

                                        if (availableGodowns.length > 0) {
                                          return availableGodowns.map((godown, godownIndex) => (
                                            <SelectItem
                                              key={`${currentItemId}-${godownIndex}`}
                                              value={godown.godown}
                                            >
                                              <div className="flex items-center justify-between w-full">
                                                <span>{godown.godown}</span>
                                                {godown.godown_id ? (
                                                  <span className="text-sm text-gray-500 ml-2">
                                                    Stock: {godown.current_balance}
                                                  </span>
                                                ) : (
                                                  <span className="text-sm text-gray-400 ml-2">
                                                    (Type batch name)
                                                  </span>
                                                )}
                                              </div>
                                            </SelectItem>
                                          ));
                                        } else {
                                          return (
                                            <div className="p-2 text-center text-sm text-gray-500">
                                              {currentItemId ? (loadingAllGodowns ? "Loading godowns..." : "No godowns available") : "Select a stock item first"}
                                            </div>
                                          );
                                        }
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Supervisor Selection */}
                                {godownSection.godown && (() => {
                                  const sectionSupervisors = getSupervisorsForSection(godownSection.godown);
                                  return (
                                    <div>
                                      <Select
                                        value={godownSection.supervisor_id || ""}
                                        onValueChange={(value) => {
                                          const updatedSections = [...modalGodownSections];
                                          updatedSections[sectionIndex] = {
                                            ...updatedSections[sectionIndex],
                                            supervisor_id: value || ""
                                          };
                                          setModalGodownSections(updatedSections);
                                        }}
                                        required
                                      >
                                        <SelectTrigger
                                          className={`${!godownSection.supervisor_id ? "border-red-500" : ""} h-10`}
                                        >
                                          {(() => {
                                            const selectedSupervisor = sectionSupervisors.supervisors?.find(
                                              (s) =>
                                                String(s.user_id) ===
                                                String(godownSection.supervisor_id)
                                            );
                                            if (selectedSupervisor) {
                                              return (
                                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden pr-1 text-left">
                                                  <span className="min-w-0 flex-1 truncate text-sm">
                                                    {getSupervisorDisplayName(selectedSupervisor)}
                                                  </span>
                                                  <SupervisorStatusBadge
                                                    activeStatus={selectedSupervisor.active_status}
                                                  />
                                                </div>
                                              );
                                            }
                                            return (
                                              <SelectValue placeholder="Select supervisor..." />
                                            );
                                          })()}
                                        </SelectTrigger>
                                        <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]">
                                          {sectionSupervisors.loading ? (
                                            <div className="p-4 text-center">
                                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                              <p className="text-sm text-gray-500 mt-2">Loading supervisors...</p>
                                            </div>
                                          ) : sectionSupervisors.supervisors && sectionSupervisors.supervisors.length > 0 ? (
                                            sectionSupervisors.supervisors.map((supervisor) => (
                                              <SelectItem
                                                key={supervisor.user_id}
                                                value={String(supervisor.user_id)}
                                                textValue={getSupervisorDisplayName(supervisor)}
                                                className="py-2 pr-3 [&>span:last-of-type]:flex [&>span:last-of-type]:w-full [&>span:last-of-type]:min-w-0"
                                              >
                                                {renderSupervisorOptionLabel(supervisor)}
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <div className="p-2 text-center text-sm text-gray-500">
                                              No supervisors available
                                            </div>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Step 2: Multi-Select Batches with Quantities */}
                            {godownSection.godown && godownSection.supervisor_id && (
                              <div className="mb-4">
                                <Label className="text-sm font-medium mb-2 block">Step 2: Select Batches & Add Quantities *</Label>

                                {(() => {
                                  const batchKey = `${String(currentItemId)}-${godownSection.godown}`;
                                  const currentBatchDetails = itemBatchDetails[batchKey] || [];
                                  const isLoadingBatches = loadingBatchDetails[batchKey] || false;

                                  // Check if current godown has godown_id
                                  const currentGodownData = currentItemGodowns.find(g => g.godown === godownSection.godown) ||
                                                            allGodownsMaster.find(g => g.godown === godownSection.godown);
                                  const hasGodownId = currentGodownData && currentGodownData.godown_id;

                                  // Get currently selected batch names
                                  const selectedBatchNames = new Set((godownSection.batches || []).map(b => b.name).filter(Boolean));

                                  return (
                                    <div className="space-y-3">
                                      {/* Multi-Select Batch Dropdown */}
                                      {hasGodownId ? (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className="w-full justify-between"
                                              size="sm"
                                            >
                                              {selectedBatchNames.size > 0
                                                ? `${selectedBatchNames.size} batch${selectedBatchNames.size > 1 ? 'es' : ''} selected`
                                                : isLoadingBatches
                                                  ? "Loading batches..."
                                                  : "Select batches..."}
                                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[400px] p-0" align="start">
                                            <div className="max-h-60 overflow-auto">
                                              {isLoadingBatches ? (
                                                <div className="p-4 text-center">
                                                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                  <p className="text-sm text-gray-500 mt-2">Loading batches...</p>
                                                </div>
                                              ) : currentBatchDetails.length > 0 ? (
                                                <div className="p-2 space-y-1">
                                                  {currentBatchDetails.map((batchDetail, detailIndex) => {
                                                    const lotName = resolveLotBatchName(batchDetail);
                                                    const isSelected = lotName ? selectedBatchNames.has(lotName) : false;
                                                    return (
                                                      <div
                                                        key={`${batchKey}-${detailIndex}`}
                                                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                                                      >
                                                        <Checkbox
                                                          checked={isSelected}
                                                          onCheckedChange={(checked) => {
                                                            const updatedSections = [...modalGodownSections];
                                                            const currentBatches = updatedSections[sectionIndex].batches || [];

                                                            if (checked) {
                                                              // Check if batch already exists to prevent duplicates
                                                              const batchExists = currentBatches.some(
                                                                b => b.name === lotName
                                                              );

                                                              if (!batchExists) {
                                                                // Add batch only if it doesn't exist
                                                                updatedSections[sectionIndex].batches = [
                                                                  ...currentBatches,
                                                                  { name: lotName, number_of_bags: "" }
                                                                ];
                                                                setModalGodownSections(updatedSections);
                                                              }
                                                            } else {
                                                              // Remove batch
                                                              updatedSections[sectionIndex].batches = currentBatches.filter(
                                                                b => b.name !== lotName
                                                              );
                                                              setModalGodownSections(updatedSections);
                                                            }
                                                          }}
                                                        />
                                                        <div
                                                          className="flex-1 cursor-pointer"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const updatedSections = [...modalGodownSections];
                                                            const currentBatches = updatedSections[sectionIndex].batches || [];

                                                            if (isSelected) {
                                                              // Remove batch
                                                              updatedSections[sectionIndex].batches = currentBatches.filter(
                                                                b => b.name !== lotName
                                                              );
                                                            } else {
                                                              // Check if batch already exists to prevent duplicates
                                                              const batchExists = currentBatches.some(
                                                                b => b.name === lotName
                                                              );

                                                              if (!batchExists) {
                                                                // Add batch only if it doesn't exist
                                                                updatedSections[sectionIndex].batches = [
                                                                  ...currentBatches,
                                                                  { name: lotName, number_of_bags: "" }
                                                                ];
                                                              }
                                                            }
                                                            setModalGodownSections(updatedSections);
                                                          }}
                                                        >
                                                          <div className="font-medium text-sm">{lotName}</div>
                                                          <div className="text-xs text-gray-500">Balance: {batchDetail.current_balance}</div>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              ) : (
                                                <div className="p-2 text-center text-sm text-gray-500">
                                                  No batches available
                                                </div>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      ) : (
                                        <Input
                                          placeholder="Type batch name..."
                                          value={(godownSection.batches && godownSection.batches[0]?.name) || ""}
                                          onChange={(e) => {
                                            const updatedSections = [...modalGodownSections];
                                            updatedSections[sectionIndex] = {
                                              ...updatedSections[sectionIndex],
                                              batches: [{
                                                name: e.target.value,
                                                number_of_bags: (godownSection.batches && godownSection.batches[0]?.number_of_bags) || "",
                                              }]
                                            };
                                            setModalGodownSections(updatedSections);
                                          }}
                                          disabled={!godownSection.godown}
                                        />
                                      )}

                                      {/* Selected Batches List with Quantities */}
                                      {godownSection.batches && godownSection.batches.length > 0 && (
                                        <div className="space-y-1.5 mt-3">
                                          <Label className="text-xs font-medium text-gray-600">Selected Batches:</Label>
                                          {godownSection.batches.map((batch, batchIndex) => {
                                            if (!batch.name || !batch.name.trim()) return null;

                                            // Find batch balance from currentBatchDetails
                                            const batchDetail = currentBatchDetails.find(
                                              (bd) => resolveLotBatchName(bd) === batch.name
                                            );
                                            const batchBalance = batchDetail?.current_balance || "N/A";

                                            return (
                                              <div key={batchIndex} className="flex items-center gap-2 p-1.5 border rounded bg-gray-50">
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-sm font-medium truncate">{batch.name}</div>
                                                  <div className="text-xs text-gray-500">Balance: {batchBalance}</div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                  {/* Quantity Input */}
                                                  <div className="flex flex-col gap-0.5">
                                                    <Label className="text-xs text-gray-500">Qty</Label>
                                                    <Input
                                                      type="text"
                                                      inputMode="numeric"
                                                      pattern="[0-9]*"
                                                      placeholder="Qty"
                                                      value={batch.number_of_bags || ""}
                                                      onKeyDown={(e) => {
                                                        // Allow control keys: Backspace, Delete, Tab, Escape, Enter, Arrow keys
                                                        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                                                        if (allowedKeys.includes(e.key)) {
                                                          return;
                                                        }
                                                        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                                                        if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                                                          return;
                                                        }
                                                        // Only allow digits (0-9)
                                                        if (!/^[0-9]$/.test(e.key)) {
                                                          e.preventDefault();
                                                        }
                                                      }}
                                                      onChange={(e) => {
                                                        let value = e.target.value;
                                                        // Remove any non-digit characters
                                                        value = value.replace(/[^0-9]/g, '');
                                                        // Only allow integers
                                                        if (value === '' || /^\d+$/.test(value)) {
                                                          // Calculate total quantity from all batches across all godown sections
                                                          // including the new value being entered
                                                          const newValue = value === '' ? 0 : parseInt(value, 10);
                                                          const totalBagsFromBatches = modalGodownSections.reduce((total, section, sIdx) => {
                                                            const sectionTotal = (section.batches || []).reduce((sum, batch, bIdx) => {
                                                              // Use the new value if this is the batch being edited
                                                              if (sIdx === sectionIndex && bIdx === batchIndex) {
                                                                return sum + (isNaN(newValue) ? 0 : newValue);
                                                              }
                                                              const bags = batch.number_of_bags;
                                                              if (bags && bags !== "" && bags !== null) {
                                                                const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                                                                return sum + (isNaN(numBags) ? 0 : numBags);
                                                              }
                                                              return sum;
                                                            }, 0);
                                                            return total + sectionTotal;
                                                          }, 0);

                                                          // Validate against loading qty (or approved qty if loading qty not set)
                                                          if (value !== '' && totalBagsFromBatches > maxQuantityForBatches) {
                                                            toast({
                                                              title: "Validation Error",
                                                              description: `Total quantity (${totalBagsFromBatches}) cannot exceed loading quantity (${maxQuantityForBatches} ${baseUnitName})`,
                                                              variant: "destructive",
                                                              duration: 2000,
                                                            });
                                                            return; // Don't update if exceeds loading quantity
                                                          }

                                                          // Also validate individual field - prevent entering more than remaining available
                                                          const otherBatchesTotal = modalGodownSections.reduce((total, section, sIdx) => {
                                                            const sectionTotal = (section.batches || []).reduce((sum, batch, bIdx) => {
                                                              // Skip the current batch being edited
                                                              if (sIdx === sectionIndex && bIdx === batchIndex) {
                                                                return sum;
                                                              }
                                                              const bags = batch.number_of_bags;
                                                              if (bags && bags !== "" && bags !== null) {
                                                                const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                                                                return sum + (isNaN(numBags) ? 0 : numBags);
                                                              }
                                                              return sum;
                                                            }, 0);
                                                            return total + sectionTotal;
                                                          }, 0);
                                                          const remainingAvailable = Math.floor(maxQuantityForBatches) - otherBatchesTotal;

                                                          // Prevent entering more than remaining available
                                                          if (value !== '' && newValue > remainingAvailable) {
                                                            toast({
                                                              title: "Validation Error",
                                                              description: `You can only enter up to ${remainingAvailable} ${baseUnitName} (${remainingAvailable}/${maxQuantityForBatches} ${baseUnitName} remaining)`,
                                                              variant: "destructive",
                                                              duration: 2000,
                                                            });
                                                            return; // Don't update if exceeds remaining available
                                                          }

                                                          const updatedSections = [...modalGodownSections];
                                                          updatedSections[sectionIndex].batches[batchIndex] = {
                                                            ...updatedSections[sectionIndex].batches[batchIndex],
                                                            number_of_bags: value
                                                          };
                                                          setModalGodownSections(updatedSections);
                                                        }
                                                      }}
                                                      onPaste={(e) => {
                                                        e.preventDefault();
                                                        const pastedText = e.clipboardData.getData('text');
                                                        const integerOnly = pastedText.replace(/[^0-9]/g, '');
                                                        if (integerOnly) {
                                                          const newValue = parseInt(integerOnly, 10);

                                                          // Calculate total quantity from all batches across all godown sections
                                                          // including the new value being pasted
                                                          const totalBagsFromBatches = modalGodownSections.reduce((total, section, sIdx) => {
                                                            const sectionTotal = (section.batches || []).reduce((sum, batch, bIdx) => {
                                                              // Use the new value if this is the batch being edited
                                                              if (sIdx === sectionIndex && bIdx === batchIndex) {
                                                                return sum + (isNaN(newValue) ? 0 : newValue);
                                                              }
                                                              const bags = batch.number_of_bags;
                                                              if (bags && bags !== "" && bags !== null) {
                                                                const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                                                                return sum + (isNaN(numBags) ? 0 : numBags);
                                                              }
                                                              return sum;
                                                            }, 0);
                                                            return total + sectionTotal;
                                                          }, 0);

                                                          // Validate against loading qty (or approved qty if loading qty not set)
                                                          if (!isNaN(newValue) && totalBagsFromBatches > maxQuantityForBatches) {
                                                            toast({
                                                              title: "Validation Error",
                                                              description: `Total quantity (${totalBagsFromBatches}) cannot exceed loading quantity (${maxQuantityForBatches} ${baseUnitName})`,
                                                              variant: "destructive",
                                                              duration: 2000,
                                                            });
                                                            return; // Don't update if exceeds loading quantity
                                                          }

                                                          // Also validate individual field - prevent entering more than remaining available
                                                          const otherBatchesTotalPaste = modalGodownSections.reduce((total, section, sIdx) => {
                                                            const sectionTotal = (section.batches || []).reduce((sum, batch, bIdx) => {
                                                              // Skip the current batch being edited
                                                              if (sIdx === sectionIndex && bIdx === batchIndex) {
                                                                return sum;
                                                              }
                                                              const bags = batch.number_of_bags;
                                                              if (bags && bags !== "" && bags !== null) {
                                                                const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                                                                return sum + (isNaN(numBags) ? 0 : numBags);
                                                              }
                                                              return sum;
                                                            }, 0);
                                                            return total + sectionTotal;
                                                          }, 0);
                                                          const remainingAvailablePaste = Math.floor(maxQuantityForBatches) - otherBatchesTotalPaste;

                                                          // Prevent entering more than remaining available
                                                          if (!isNaN(newValue) && newValue > remainingAvailablePaste) {
                                                            toast({
                                                              title: "Validation Error",
                                                              description: `You can only enter up to ${remainingAvailablePaste} ${baseUnitName} (${remainingAvailablePaste}/${maxQuantityForBatches} ${baseUnitName} remaining)`,
                                                              variant: "destructive",
                                                              duration: 2000,
                                                            });
                                                            return; // Don't update if exceeds remaining available
                                                          }

                                                          const updatedSections = [...modalGodownSections];
                                                          updatedSections[sectionIndex].batches[batchIndex] = {
                                                            ...updatedSections[sectionIndex].batches[batchIndex],
                                                            number_of_bags: integerOnly
                                                          };
                                                          setModalGodownSections(updatedSections);
                                                        }
                                                      }}
                                                      className="h-7 w-20 text-sm"
                                                    />
                                                  </div>
                                                  {salesOrderItemBaseUnits[itemKeyForModal] && (
                                                    <div className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-medium text-gray-700 min-w-[40px] text-center mt-5">
                                                      {salesOrderItemBaseUnits[itemKeyForModal]}
                                                    </div>
                                                  )}
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                      const updatedSections = [...modalGodownSections];
                                                      updatedSections[sectionIndex].batches = updatedSections[sectionIndex].batches.filter(
                                                        (_, i) => i !== batchIndex
                                                      );
                                                      setModalGodownSections(updatedSections);
                                                    }}
                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0 mt-5"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </Card>
                        ))}

                        {/* Add Another Godown Section Button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setModalGodownSections(prev => [
                              ...prev,
                              {
                                godown: "",
                                supervisor_id: undefined,
                                batches: [{ name: "", number_of_bags: "" }]
                              }
                            ]);
                          }}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Another Godown Section
                        </Button>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setBatchModalOpen(prev => ({ ...prev, [editingItemIndex]: false }));
                            setEditingItemIndex(null);
                            setModalGodownSections([]);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            // Validate all godown sections
                            if (modalGodownSections.length === 0) {
                              toast({
                                title: "Validation Error",
                                description: "At least one godown section is required",
                                variant: "destructive",
                              });
                              return;
                            }

                            // Validate each godown section
                            for (let sectionIndex = 0; sectionIndex < modalGodownSections.length; sectionIndex++) {
                              const section = modalGodownSections[sectionIndex];

                              // Validate godown is selected
                              if (!section.godown || !section.godown.trim()) {
                                toast({
                                  title: "Validation Error",
                                  description: `Please select a godown for section ${sectionIndex + 1}`,
                                  variant: "destructive",
                                });
                                return;
                              }

                              // Validate supervisor is selected
                              if (!section.supervisor_id) {
                                toast({
                                  title: "Validation Error",
                                  description: `Please select a supervisor for godown section ${sectionIndex + 1}`,
                                  variant: "destructive",
                                });
                                return;
                              }

                              // Validate that at least one batch exists
                              if (!section.batches || section.batches.length === 0) {
                                toast({
                                  title: "Validation Error",
                                  description: `At least one batch is required for godown section ${sectionIndex + 1}`,
                                  variant: "destructive",
                                });
                                return;
                              }

                              // Validate that all batches have name
                              const batchesWithoutName = section.batches.filter(b =>
                                !b.name || !b.name.trim()
                              );

                              if (batchesWithoutName.length > 0) {
                                toast({
                                  title: "Validation Error",
                                  description: `All batches must have a batch name in godown section ${sectionIndex + 1}`,
                                  variant: "destructive",
                                });
                                return;
                              }

                              // Validate that all batches have quantity
                              const batchesWithoutQuantity = section.batches.filter(b =>
                                !b.number_of_bags || b.number_of_bags === "" || parseInt(b.number_of_bags, 10) <= 0
                              );

                              if (batchesWithoutQuantity.length > 0) {
                                toast({
                                  title: "Validation Error",
                                  description: `All batches must have a valid quantity (greater than 0) in godown section ${sectionIndex + 1}`,
                                  variant: "destructive",
                                });
                                return;
                              }
                            }

                            // Parse soIndex and itemIndex from editingItemIndex
                            const [soIndex, itemIndex] = editingItemIndex.split('-').map(Number);
                            const currentItemIdForSave = form.getValues(`sales_orders.${soIndex}.items.${itemIndex}.item_id`);
                            const itemKeyForSave = currentItemIdForSave ? `${soIndex}-${currentItemIdForSave}` : `${soIndex}-${itemIndex}`;

                            // Validate total quantity against loading qty (or approved qty if loading qty not set)
                            const approvedQtySave = salesOrderItemApprovedQuantities[itemKeyForSave] || 0;
                            const baseUnitNameSave = salesOrderItemBaseUnits[itemKeyForSave] || '';
                            const loadingQtySave = form.getValues(`sales_orders.${soIndex}.items.${itemIndex}.total_quantity`);
                            const loadingQtyNumSave = (loadingQtySave !== "" && loadingQtySave != null)
                              ? (typeof loadingQtySave === 'number' ? loadingQtySave : parseFloat(String(loadingQtySave)))
                              : null;
                            const maxQtyForSave = (!isNaN(loadingQtyNumSave) && loadingQtyNumSave >= 0)
                              ? Math.floor(loadingQtyNumSave)
                              : Math.floor(approvedQtySave);

                            // Calculate total quantity from all batches across all godowns
                            const totalBagsFromBatches = modalGodownSections.reduce((total, section) => {
                              const sectionTotal = (section.batches || []).reduce((sum, batch) => {
                                const bags = batch.number_of_bags;
                                if (bags && bags !== "" && bags !== null) {
                                  const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                                  return sum + (isNaN(numBags) ? 0 : numBags);
                                }
                                return sum;
                              }, 0);
                              return total + sectionTotal;
                            }, 0);

                            if (totalBagsFromBatches > maxQtyForSave) {
                              toast({
                                title: "Validation Error",
                                description: `Total quantity (${totalBagsFromBatches}) cannot exceed loading quantity (${maxQtyForSave} ${baseUnitNameSave})`,
                                variant: "destructive",
                                duration: 1000,
                              });
                              return;
                            }
                            
                            // Convert all godown sections to form format
                            const updatedGodowns = modalGodownSections.map((section) => {
                              let godownId = null;
                              const currentGodownData = currentItemGodowns.find(g => g.godown === section.godown) ||
                                                        allGodownsMaster.find(g => g.godown === section.godown);

                              if (currentGodownData && currentGodownData.godown_id) {
                                godownId = currentGodownData.godown_id;
                              } else if (section.godown && !isNaN(section.godown)) {
                                godownId = parseInt(section.godown, 10);
                              } else {
                                const masterGodown = allGodownsMaster.find(g => g.godown === section.godown);
                                if (masterGodown && masterGodown.godown_id) {
                                  godownId = masterGodown.godown_id;
                                } else {
                                  throw new Error(`Could not find godown ID for "${section.godown}". Please select a valid godown.`);
                                }
                              }

                              const resolvedGodownId = coerceGodownId(
                                godownId,
                                itemGodowns,
                                allGodownsMaster,
                                null
                              ) ?? (typeof godownId === "number" && godownId > 0 ? godownId : null);

                              if (!resolvedGodownId) {
                                throw new Error(`Could not resolve godown ID for "${section.godown}". Please select a valid godown.`);
                              }

                              return {
                                godown_id: resolvedGodownId,
                                supervisor_id: section.supervisor_id || undefined,
                                batches: section.batches.map(batch => ({
                                  name: batch.name.trim(),
                                  number_of_bags: batch.number_of_bags ? parseInt(batch.number_of_bags, 10) : null
                                }))
                              };
                            });
                            
                            // Calculate total quantity from all batches across all godowns
                            const totalBags = updatedGodowns.reduce((total, godown) => {
                              const godownTotal = godown.batches.reduce((sum, batch) => {
                                const bags = batch.number_of_bags;
                                if (bags && bags !== null && bags !== "") {
                                  const numBags = typeof bags === 'string' ? parseInt(bags, 10) : bags;
                                  return sum + (isNaN(numBags) ? 0 : numBags);
                                }
                                return sum;
                              }, 0);
                              return total + godownTotal;
                            }, 0);
                            
                            // Update form with all godown sections
                            form.setValue(`sales_orders.${soIndex}.items.${itemIndex}.godowns`, updatedGodowns);
                            if (totalBags > 0) {
                              form.setValue(`sales_orders.${soIndex}.items.${itemIndex}.total_quantity`, totalBags.toString());
                            }

                            const salesOrdersForCache = form.getValues("sales_orders").map((so, idx) => {
                              if (idx !== soIndex) return so;
                              return {
                                ...so,
                                items: so.items.map((item, iIdx) =>
                                  iIdx === itemIndex ? { ...item, godowns: updatedGodowns } : item
                                ),
                              };
                            });
                            setCachedSelectedGodowns(
                              extractSelectedGodownsFromSalesOrders(
                                salesOrdersForCache,
                                itemGodowns,
                                allGodownsMaster,
                                null
                              )
                            );

                            setBatchModalOpen(prev => ({ ...prev, [editingItemIndex]: false }));
                            setEditingItemIndex(null);
                            setModalGodownSections([]);
                            setSelectedGodownForSupervisor(null);
                            
                            const totalBatches = updatedGodowns.reduce((sum, godown) => sum + godown.batches.length, 0);
                            toast({
                              title: "Success",
                              description: `${totalBatches} Batches Saved Across ${updatedGodowns.length} Godown Section`,
                            });
                          }}
                        >
                          Save All Godown Sections
                        </Button>
                      </div>
                      </div>
                  );
                })()}
              </DialogContent>
            </Dialog>
          )}
        </main>
      </div>

      <Dialog
        open={!!exceedApprovedConfirm}
        onOpenChange={(open) => {
          if (!open) setExceedApprovedConfirm(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Confirm Loading Quantity</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are You Sure You Want to Load More Items Than the Approved Quantity
            {exceedApprovedConfirm
              ? ` (${Math.floor(exceedApprovedConfirm.approvedQty)} ${exceedApprovedConfirm.baseUnitName || ""})`
              : ""}
            ?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExceedApprovedConfirm(null)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleConfirmExceedApprovedQty}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignSupervisorOpen} onOpenChange={setAssignSupervisorOpen}>
        <DialogContent className="sm:max-w-lg p-4 gap-3">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-emerald-700" />
              Assign Supervisor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Auto-assign uses the last gate pass for this vehicle when available, otherwise the first godown supervisor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {assignSupervisorDraft.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No godowns configured yet.</p>
            ) : (
              assignSupervisorDraft.map((row) => (
                <div
                  key={row.godownKey}
                  className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 border-b border-zinc-200 pb-2 last:border-b-0"
                >
                  <div className="sm:w-[40%] min-w-0">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Godown</p>
                    <p className="text-sm font-medium text-zinc-900 truncate" title={row.godownName}>
                      {row.godownName}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-0.5">Supervisor</p>
                    <Select
                      value={row.supervisor_id || undefined}
                      onValueChange={(value) => {
                        setAssignSupervisorDraft((prev) =>
                          prev.map((r) =>
                            r.godownKey === row.godownKey
                              ? { ...r, supervisor_id: value }
                              : r
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        {(allSupervisors || []).map((sup) => (
                          <SelectItem
                            key={sup.user_id}
                            value={String(sup.user_id)}
                          >
                            {sup.name || sup.username || `User ${sup.user_id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setAssignSupervisorOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              onClick={handleAutoAssignSupervisors}
              disabled={assignSupervisorLoading || assignSupervisorDraft.length === 0}
            >
              {assignSupervisorLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5 mr-1" />
              )}
              Auto Assign
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={handleApplyAssignSupervisors}
              disabled={assignSupervisorDraft.length === 0}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ManageVehicleSplitModal
        open={manageVehicleOpen}
        onClose={() => setManageVehicleOpen(false)}
        salesOrders={manageVehicleSalesOrders}
        defaultVehicleNo={form.watch("vehicle_no") || ""}
        confirming={splitCreating}
        onConfirm={handleSplitConfirm}
      />
    </div>
  );
}