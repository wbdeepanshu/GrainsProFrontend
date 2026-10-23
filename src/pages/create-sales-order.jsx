import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { ScrollArea } from "../components/ui/scroll-area";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Menu,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  ShoppingCart,
  User,
  Calendar as CalendarIcon,
  Package,
  DollarSign,
  MapPin,
  FileText,
  Loader2,
  AlertCircle,
  ChevronsUpDown,
  IndianRupee,
  Check,
  Edit,
  X,
  CheckCircle2,
  Pencil,
  Building,
  Mic,
  Square,
  Download,
  Copy,
  Search,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import { uploadSalesOrderVoice } from "@/lib/purchaseOrderVoiceUpload";
import { downloadSalesOrderPdf } from "../utils/salesOrderPdfGenerator";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { isAdminSettingEnabled } from "@/lib/adminSettings";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// Indian number format with 2 decimals, e.g. 12234213.4 -> 1,22,34,213.40
const formatINR = (value) => {
  const num = Number(value);
  return (Number.isFinite(num) ? num : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
/** Set before navigating to list so sales-order-list refetches (query cache uses staleTime: Infinity). */
const SALES_ORDERS_LIST_REFRESH_KEY = "salesOrdersListRefresh";
const SALES_ORDERS_DETAIL_REFRESH_SO_KEY = "salesOrdersListRefreshSoNumber";

const buildStockItemFromDetailLine = (row) => {
  const stock = row.stock_item || {};
  const storedRate = parseFloat(row.rate || row.price || 0);
  const conversion = parseFloat(stock.conversion || 1);
  const altRate = row.alternate_rate
    ? parseFloat(row.alternate_rate)
    : conversion > 0
      ? parseFloat((storedRate / conversion).toFixed(2))
      : 0;

  return {
    id: row.stock_item_id,
    name: row.item_name || stock.name,
    conversion,
    gst_rate: parseFloat(row.gst_percentage) || 0,
    unit_of_measurement: row.is_primary_unit ? stock.base_unit : stock.alternate_unit,
    base_unit: stock.base_unit
      ? { id: stock.base_unit.id, name: stock.base_unit.name, price: storedRate }
      : null,
    alternate_unit: stock.alternate_unit
      ? { id: stock.alternate_unit.id, name: stock.alternate_unit.name, price: altRate }
      : null,
    item_groupings: stock.item_groupings,
    item_grouping: stock.item_grouping,
  };
};

const mapDetailItemToFormItem = (apiItem) => {
  const stock = apiItem.stock_item || {};
  const conversion = parseFloat(stock.conversion || 1);
  const storedRate = parseFloat(apiItem.rate || apiItem.price || 0);
  const baseUnitId = apiItem.base_unit?.id || stock.base_unit?.id || null;
  const alternateUnitId = stock.alternate_unit?.id || null;
  const altRate = apiItem.alternate_rate
    ? parseFloat(apiItem.alternate_rate)
    : conversion > 0
      ? parseFloat((storedRate / conversion).toFixed(2))
      : 0;

  let priceUomId = baseUnitId;
  let displayPrice = storedRate;
  let baseUnitPriceForCalc = storedRate;

  if (apiItem.is_primary_unit === false && alternateUnitId) {
    priceUomId = alternateUnitId;
    displayPrice = altRate;
    baseUnitPriceForCalc = storedRate;
  }

  const qty = parseFloat(apiItem.quantity);
  const quantity = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;

  return {
    item_id: apiItem.stock_item_id ? String(apiItem.stock_item_id) : "",
    quantity,
    price: displayPrice,
    comment: apiItem.comment || "",
    gst_percentage: parseFloat(apiItem.gst_percentage) || 0,
    gst_auto_filled: true,
    approved_quantity: quantity,
    is_approved: Boolean(apiItem.is_approved),
    is_rejected: Boolean(apiItem.is_rejected),
    base_unit_id: baseUnitId,
    price_uom_id: priceUomId,
    conversion,
    base_unit_price: storedRate,
    alternate_unit_price: altRate,
    base_unit_price_for_calc: baseUnitPriceForCalc,
  };
};

// Normalize a date string coming from the API or form to ISO `YYYY-MM-DD`.
// Accepts: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss[...]", "DD-MM-YYYY", "DD/MM/YYYY".
// Returns "" if the input can't be parsed.
const toIsoDateString = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  // Already ISO date (optionally with time component)
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  // Last-resort: let Date parse it
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
};

function isLineReadyForNextStep(line) {
  return (
    Boolean(line.item_id) &&
    parseFloat(line.quantity) > 0 &&
    line.price !== "" &&
    line.price !== null &&
    line.price !== undefined &&
    !Number.isNaN(parseFloat(line.price))
  );
}

function SalesOrderItemNextStepModal({
  open,
  onAddItem,
  onCreateOrder,
  onDismiss,
  isSaving,
  isEdit,
}) {
  const [activeChoice, setActiveChoice] = useState("save");
  const addButtonRef = useRef(null);
  const saveButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setActiveChoice("save");
    requestAnimationFrame(() => saveButtonRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || isSaving) return;

    const handleKeyDown = (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setActiveChoice("add");
        addButtonRef.current?.focus();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActiveChoice("save");
        saveButtonRef.current?.focus();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (activeChoice === "save") {
          onCreateOrder();
        } else {
          onAddItem();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, activeChoice, isSaving, onAddItem, onCreateOrder, onDismiss]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Want to Add More Items or Save the Sales Order?
          </DialogTitle>
          <DialogDescription>
            Press Enter to Save, or Use ↓ Then Enter to Add Another Item.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <Button
            ref={saveButtonRef}
            type="button"
            disabled={isSaving}
            onClick={onCreateOrder}
            onFocus={() => setActiveChoice("save")}
            className={`w-full bg-black hover:bg-gray-800 ${activeChoice === "save" ? "ring-2 ring-offset-1 ring-gray-400" : ""
              }`}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving
              ? "Saving..."
              : isEdit
                ? "Update Sales Order"
                : "Save Sales Order"}
          </Button>
          <Button
            ref={addButtonRef}
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onAddItem}
            onFocus={() => setActiveChoice("add")}
            className={`w-full ${activeChoice === "add" ? "ring-2 ring-offset-1 ring-gray-400" : ""
              }`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CreateSalesOrder() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const editSoNumber = useMemo(() => {
    const params = new URLSearchParams(searchString || "");
    return params.get("edit")?.trim() || null;
  }, [searchString]);
  const isEditMode = Boolean(editSoNumber);
  const [editFormHydrated, setEditFormHydrated] = useState(false);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission } = useUserPermissions();
  const soVoiceRemarksEnabled = isAdminSettingEnabled("so_voice_remarks");
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
  const showBrokerage =
    hasPermission("brokerage", "create") && hasPermission("brokerage", "read");
  // Stock items search state - individual for each item
  const [itemSearchTerms, setItemSearchTerms] = useState({});
  const [itemDebouncedTerms, setItemDebouncedTerms] = useState({});
  const [itemDropdownOpen, setItemDropdownOpen] = useState({});
  const itemDropdownOpenRef = useRef({});
  itemDropdownOpenRef.current = itemDropdownOpen;
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [selectedStockItemsById, setSelectedStockItemsById] = useState({});
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollPositionRef = useRef(0);
  const [isSearching, setIsSearching] = useState(false);
  const scrollLockRef = useRef(false);

  // Broker search state
  const [brokerSearchTerm, setBrokerSearchTerm] = useState("");
  const [brokerDebouncedTerm, setBrokerDebouncedTerm] = useState("");
  const [brokerDropdownOpen, setBrokerDropdownOpen] = useState(false);
  const brokerDropdownOpenRef = useRef(false);
  brokerDropdownOpenRef.current = brokerDropdownOpen;
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);

  // Customer search state
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerDebouncedTerm, setCustomerDebouncedTerm] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [isBrokerDialogOpen, setIsBrokerDialogOpen] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState("");

  // Customer dropdown state
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomerMeta, setSelectedCustomerMeta] = useState(null);

  // Ledger group state
  const [selectedLedgerGroupId, setSelectedLedgerGroupId] = useState(null);
  const [ledgerGroupDropdownOpen, setLedgerGroupDropdownOpen] = useState(false);
  const [ledgerGroupSearchTerm, setLedgerGroupSearchTerm] = useState("");

  // Address edit state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState("");

  // Previous sales order popup state
  const [isPreviousSOPopupOpen, setIsPreviousSOPopupOpen] = useState(false);
  const [previousSOData, setPreviousSOData] = useState(null);
  // Track when user dismisses (Skip or X) so the effect doesn't re-open the popup
  const [previousSOPopupDismissedForCustomerId, setPreviousSOPopupDismissedForCustomerId] = useState(null);

  // Comment edit state - track which item's comment is being edited
  const [editingCommentIndex, setEditingCommentIndex] = useState(null);

  // Quantity > 4 digits warning — shown every time user enters a 5th digit
  const [quantityExceedDialog, setQuantityExceedDialog] = useState({
    open: false,
    itemIndex: null,
    pendingQuantity: null,
  });

  // Post-create success popup + Tally sync
  const [soSuccessOpen, setSoSuccessOpen] = useState(false);
  const [createdSoNumber, setCreatedSoNumber] = useState("");
  const [createdSoTallySynced, setCreatedSoTallySynced] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isLedgerDialogOpen, setIsLedgerDialogOpen] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [voucherTypeSearchTerm, setVoucherTypeSearchTerm] = useState("");
  const [selectedVoucherType, setSelectedVoucherType] = useState(null);

  const [voiceRemarksUrl, setVoiceRemarksUrl] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceRemarksUrlRef = useRef("");
  const voiceUploadPromiseRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    customer_id: "",
    date: new Date().toISOString().split('T')[0],
    status: "PENDING",
    remarks: "",
    address: "",
    order_by: "",
    order_number: "",
    broker_id: "",
    due_date: new Date().toISOString().split('T')[0], // Set to current date by default
    branch_id: "",
    items: [
      {
        item_id: "",
        quantity: 1,
        price: 0,
        comment: "",
        gst_percentage: 0,
        gst_auto_filled: false,
        approved_quantity: 0,
        is_approved: false,
        is_rejected: false,
        base_unit_id: null, // Base unit ID for quantity (always base unit)
        price_uom_id: null, // UOM ID for price display/selection
        conversion: 1.0,
        base_unit_price: 0,
        alternate_unit_price: 0,
        base_unit_price_for_calc: 0, // Price in base unit for calculations
      }
    ]
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNextStepModal, setShowNextStepModal] = useState(false);
  const nextStepPromptedRef = useRef(false);
  const tabLeavingRowRef = useRef(null);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [pendingFocusLineIndex, setPendingFocusLineIndex] = useState(null);
  const branchTriggerRef = useRef(null);
  const ledgerGroupTriggerRef = useRef(null);
  const customerTriggerRef = useRef(null);
  const brokerTriggerRef = useRef(null);
  const dueDateRef = useRef(null);
  const headerFieldOpenedRef = useRef({
    branch: false,
    ledger: false,
    customer: false,
    broker: false,
  });
  // After Enter/select on a header dropdown, next Tab must advance (not reopen).
  const headerReadyForNextTabRef = useRef({
    branch: false,
    ledger: false,
    customer: false,
    broker: false,
  });
  const itemReadyForNextTabRef = useRef({});
  const [itemListHighlightByRow, setItemListHighlightByRow] = useState({});
  const [brokerListHighlight, setBrokerListHighlight] = useState(0);
  const brokerSearchInputRef = useRef(null);
  const itemSearchInputRefs = useRef({});
  const itemListHighlightByRowRef = useRef({});
  itemListHighlightByRowRef.current = itemListHighlightByRow;

  // Fetch ledger groups
  const fetchLedgerGroups = async ({ pageParam = 1, queryKey }) => {
    const [, search] = queryKey;
    const params = new URLSearchParams();
    params.append('page', pageParam.toString());
    params.append('per_page', '50');
    params.append('type', 'Sales');
    if (search) {
      params.append('search', search);
    }
    params.append('is_live', 'true');
    params.append('is_active', 'true');

    const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch ledger groups');
    }

    const data = await response.json();
    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
      total: data.pagination?.total_count || 0,
    };
  };

  const {
    data: ledgerGroupsData,
    fetchNextPage: fetchNextLedgerGroupPage,
    hasNextPage: hasNextLedgerGroupPage,
    isFetchingNextPage: isFetchingNextLedgerGroupPage,
  } = useInfiniteQuery({
    queryKey: ['ledger-groups', ledgerGroupSearchTerm],
    queryFn: fetchLedgerGroups,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: ledgerGroupDropdownOpen,
  });

  const ledgerGroups = ledgerGroupsData?.pages?.flatMap((page) => page.results) || [];

  // Fetch customers with ledger group filter
  const fetchCustomers = async () => {
    const params = new URLSearchParams();
    params.append('per_page', '200');
    if (customerDebouncedTerm) {
      params.append('search', customerDebouncedTerm);
    }
    // Filter by ledger group if selected
    if (selectedLedgerGroupId) {
      params.append('ledger_group_id', selectedLedgerGroupId.toString());
    }

    const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/get-customers/?type=sales&${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch customers');
    }

    const data = await response.json();
    return data.data || [];
  };

  const {
    data: customers,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useQuery({
    queryKey: ['customers', selectedLedgerGroupId, customerDebouncedTerm],
    queryFn: fetchCustomers,
    // Prefetch in background on page load so customer dropdown opens instantly.
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch brokers
  const { data: brokersData, isLoading: brokersLoading, refetch: refetchBrokers } = useQuery({
    queryKey: ['brokers'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/broker/`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch branches
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
      const response = await fetch(`${backendUrl}/api/get-branches/`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch user profile to get default branch
  const { data: userProfileData } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/user-profile/`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Fetch user permissions to get branch ID (more reliable than profile)
  const { data: userPermissionsData } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-user-permissions/`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const {
    data: editOrderData,
    isLoading: editOrderLoading,
    isError: editOrderError,
    error: editOrderErrorObj,
  } = useQuery({
    queryKey: ["sales-order-edit-detail", editSoNumber],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/sales/sales-orders/${encodeURIComponent(editSoNumber)}/`
      );
      const json = await response.json();
      if (!response.ok || (json?.status && Number(json.status) >= 400)) {
        throw new Error(json?.message || json?.error || "Failed to load sales order");
      }
      return json.data;
    },
    enabled: isEditMode && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Set default branch_id when branches and user data are loaded (create only)
  useEffect(() => {
    if (isEditMode) return;
    if (branchesData && branchesData.length > 0 && !formData.branch_id) {
      if (branchesData[0]?.id) {
        setFormData((prev) => ({ ...prev, branch_id: branchesData[0].id }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchesData, isEditMode]);

  // Hydrate form from sales order detail API in edit mode
  useEffect(() => {
    if (!isEditMode || !editOrderData || editFormHydrated) return;
    if (brokersLoading || branchesLoading) return;

    const header = editOrderData.header || {};
    const lines = editOrderData.items || [];
    const stockMap = {};
    const formItems = lines.map((row) => {
      if (row.stock_item_id) {
        stockMap[String(row.stock_item_id)] = buildStockItemFromDetailLine(row);
      }
      return mapDetailItemToFormItem(row);
    });

    setSelectedStockItemsById(stockMap);
    const todayIso = new Date().toISOString().split("T")[0];
    const orderDateIso = toIsoDateString(header.order_date) || todayIso;
    const dueDateIso =
      toIsoDateString(header.due_date) || orderDateIso || todayIso;
    setFormData({
      customer_id: header.customer_id ? String(header.customer_id) : "",
      date: orderDateIso,
      status: header.status || "PENDING",
      remarks: header.remarks || "",
      address: header.shipping_address || header.address || "",
      order_by: header.order_by || "",
      order_number: header.order_number || "",
      broker_id: header.broker_id ? String(header.broker_id) : "",
      due_date: dueDateIso,
      branch_id: header.branch_id || "",
      items:
        formItems.length > 0
          ? formItems
          : [
            {
              item_id: "",
              quantity: 1,
              price: 0,
              comment: "",
              gst_percentage: 0,
              gst_auto_filled: false,
              approved_quantity: 0,
              is_approved: false,
              is_rejected: false,
              base_unit_id: null,
              price_uom_id: null,
              conversion: 1.0,
              base_unit_price: 0,
              alternate_unit_price: 0,
              base_unit_price_for_calc: 0,
            },
          ],
    });

    if (header.customer_id) {
      setSelectedCustomerMeta({
        id: String(header.customer_id),
        name: header.customer_name || "",
      });
      setCustomerSearchTerm(header.customer_name || "");
      setPreviousSOPopupDismissedForCustomerId(String(header.customer_id));
    }

    const voiceUrl = (header.voice_remarks || "").trim();
    if (soVoiceRemarksEnabled) {
      voiceRemarksUrlRef.current = voiceUrl;
      setVoiceRemarksUrl(voiceUrl);
    }

    setEditFormHydrated(true);
  }, [
    isEditMode,
    editOrderData,
    editFormHydrated,
    brokersLoading,
    branchesLoading,
    soVoiceRemarksEnabled,
  ]);

  // Create broker mutation
  const createBrokerMutation = useMutation({
    mutationFn: async (brokerName) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/report/broker/`, {
        name: brokerName,
        contact_number: '',
        commission_rate: 0
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 201 || data.status === 200) {
        toast({
          title: "Success",
          description: "Broker created successfully",
          variant: "success",
        });
        // Refresh broker list
        refetchBrokers();
        // Select the newly created broker
        if (data.data && data.data.id) {
          handleInputChange('broker_id', data.data.id.toString());
        }
        // Close dialog and reset form
        setIsBrokerDialogOpen(false);
        setNewBrokerName("");
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create broker",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create broker",
        variant: "destructive",
      });
    },
  });

  // Lock scroll position during search operations
  useEffect(() => {
    const handleScroll = (e) => {
      if (scrollLockRef.current || isSearching) {
        e.preventDefault();
        e.stopPropagation();
        window.scrollTo(0, scrollPositionRef.current);
        return false;
      }
      scrollPositionRef.current = window.scrollY;
      setScrollPosition(window.scrollY);
    };

    const handleWheel = (e) => {
      if (scrollLockRef.current || isSearching) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleKeyDown = (e) => {
      if (scrollLockRef.current || isSearching) {
        // Let open item/broker popovers handle arrow navigation themselves
        const itemPopoverOpen = Object.values(itemDropdownOpenRef.current || {}).some(Boolean);
        if (itemPopoverOpen || brokerDropdownOpenRef.current) return;
        // Prevent arrow keys, page up/down, home, end from scrolling the page
        if ([32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearching]);

  // Debounce broker search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setBrokerDebouncedTerm(brokerSearchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [brokerSearchTerm]);

  // Debounce customer search before API call
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCustomerDebouncedTerm((customerSearchTerm || "").trim());
    }, 350);
    return () => clearTimeout(timeout);
  }, [customerSearchTerm]);

  // Debounce stock search for each item
  useEffect(() => {
    const timeouts = {};

    Object.keys(itemSearchTerms).forEach(itemIndex => {
      timeouts[itemIndex] = setTimeout(() => {
        // Lock scroll during search
        scrollLockRef.current = true;
        setIsSearching(true);

        // Add CSS to prevent scrolling
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPositionRef.current}px`;
        document.body.style.width = '100%';

        setItemDebouncedTerms(prev => ({
          ...prev,
          [itemIndex]: itemSearchTerms[itemIndex]
        }));

        // Unlock scroll after a short delay to allow API call to complete
        setTimeout(() => {
          scrollLockRef.current = false;
          setIsSearching(false);

          // Remove CSS scroll lock
          document.body.style.overflow = '';
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.width = '';

          // Restore scroll position
          const currentScroll = scrollPositionRef.current;
          if (currentScroll > 0) {
            requestAnimationFrame(() => {
              window.scrollTo({
                top: currentScroll,
                behavior: 'instant'
              });
            });
          }
        }, 500);
      }, 300);
    });

    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, [itemSearchTerms]);

  // Fetch stock items using get_margin_calculations API (customer-specific pricing)
  const fetchStockItemsForCustomer = async ({ customerId, branchId, searchTerm, pageParam = 1 }) => {
    if (!customerId) {
      return {
        results: [],
        nextPage: undefined,
        pagination: null,
      };
    }

    const response = await apiRequest('POST', `${API_BASE_URL}/api/growth/so-items-list/`, {
      customer_id: customerId,
      branch_id: branchId || undefined,
      search: (searchTerm || "").trim(),
      page: pageParam,
      per_page: 50,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stock items');
    }

    const data = await response.json();
    const pagination = data.pagination || {};
    return {
      results: data.data?.stock_items || [],
      nextPage: pagination.has_next ? (pagination.current_page || pageParam) + 1 : undefined,
      pagination,
    };
  };

  const activeItemSearchTerm = (activeItemIndex != null ? itemDebouncedTerms[activeItemIndex] : "") || "";

  const {
    data: stockItemsData,
    isLoading: stockItemsLoading,
    isFetching: isStockItemsFetching,
    fetchNextPage: fetchNextStockItemsPage,
    hasNextPage: hasNextStockItemsPage,
    isFetchingNextPage: isFetchingNextStockItemsPage,
  } = useInfiniteQuery({
    queryKey: ['stock-items-margin', formData.customer_id, formData.branch_id, activeItemSearchTerm],
    queryFn: ({ pageParam = 1 }) => fetchStockItemsForCustomer({
      customerId: formData.customer_id,
      branchId: formData.branch_id,
      searchTerm: activeItemSearchTerm,
      pageParam,
    }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!AuthService.getAccessToken() && !!formData.customer_id,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  // Lock scroll during data fetching
  useEffect(() => {
    if (isStockItemsFetching) {
      scrollLockRef.current = true;
      setIsSearching(true);

      // Add CSS to prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';
    } else {
      // Unlock scroll after fetching is complete
      setTimeout(() => {
        scrollLockRef.current = false;
        setIsSearching(false);

        // Remove CSS scroll lock
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';

        // Restore scroll position
        const currentScroll = scrollPositionRef.current;
        if (currentScroll > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: currentScroll,
              behavior: 'instant'
            });
          });
        }
      }, 100);
    }
  }, [isStockItemsFetching]);

  const stockItems = stockItemsData?.pages?.flatMap((page) => page.results || []) || [];
  const getStockItemById = useCallback((itemId) => {
    if (!itemId) return null;
    const key = itemId.toString();
    return selectedStockItemsById[key] || stockItems.find((s) => s.id?.toString() === key) || null;
  }, [selectedStockItemsById, stockItems]);
  const brokers = brokersData?.data || [];

  // Keep selected customer label stable even when current search result page does not include it.
  useEffect(() => {
    if (!formData.customer_id) {
      setSelectedCustomerMeta(null);
      return;
    }
    const selectedFromList = (customers || []).find(
      (c) => c.id.toString() === formData.customer_id.toString()
    );
    if (selectedFromList) {
      setSelectedCustomerMeta({
        id: selectedFromList.id.toString(),
        name: selectedFromList.name || "",
      });
    }
  }, [customers, formData.customer_id]);
  const customerList = customers || [];

  // Word-based customer search (token/prefix match), not loose letter-substring match.
  const filteredCustomers = useMemo(() => {
    const q = (customerSearchTerm || "").trim().toLowerCase();
    if (!q) return customerList;
    const queryTokens = q.split(/\s+/).filter(Boolean);
    return customerList.filter((customer) => {
      const nameTokens = String(customer?.name || "")
        .toLowerCase()
        .split(/[\s,./()\-]+/)
        .filter(Boolean);
      if (!nameTokens.length) return false;
      return queryTokens.every((qt) => nameTokens.some((nt) => nt.startsWith(qt)));
    });
  }, [customerList, customerSearchTerm]);

  // Fetch last sales order for customer - only when customer is selected and stock items are loaded
  const { data: previousSODataResponse } = useQuery({
    queryKey: ['previous-sales-order', formData.customer_id],
    queryFn: async () => {
      if (!formData.customer_id) return null;
      try {
        const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/previous-so-list/?customer_id=${formData.customer_id}`);
        // Handle 404 (no previous SO) gracefully - return null instead of throwing
        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          return null;
        }
        const data = await response.json();
        return data.status === 200 && data.data ? data.data : null;
      } catch (error) {
        // Silently fail - don't block the UI if API fails
        return null;
      }
    },
    enabled: !!AuthService.getAccessToken() && !!formData.customer_id && !stockItemsLoading && stockItems.length > 0,
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on failure to avoid delays
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Show popup when previous SO data is available and stock items are loaded
  useEffect(() => {
    if (isEditMode) return;
    if (previousSODataResponse && previousSODataResponse.so_number && previousSODataResponse.items && previousSODataResponse.items.length > 0) {
      // Only show popup if:
      // 1. Stock items are loaded (needed for pricing)
      // 2. Popup is not already open
      // 3. No items are already selected (to avoid showing popup if user already started)
      const hasSelectedItems = formData.items.some(item => item.item_id && item.item_id !== "");

      const userDismissedForThisCustomer = previousSOPopupDismissedForCustomerId === formData.customer_id;
      if (!stockItemsLoading && stockItems.length > 0 && !isPreviousSOPopupOpen && !hasSelectedItems && !userDismissedForThisCustomer) {
        setPreviousSOData(previousSODataResponse);
        setIsPreviousSOPopupOpen(true);
      }
    }
  }, [previousSODataResponse, stockItemsLoading, stockItems.length, isPreviousSOPopupOpen, previousSOPopupDismissedForCustomerId, formData.customer_id, formData.items]);

  // Auto-select "Direct Sales" broker when brokers are loaded and no broker is selected
  useEffect(() => {
    if (isEditMode) return;
    if (brokers.length > 0 && !formData.broker_id) {
      const directSalesBroker = brokers.find(broker =>
        broker.name && broker.name.toLowerCase().trim() === 'direct sales'
      );
      if (directSalesBroker) {
        setFormData(prev => ({
          ...prev,
          broker_id: directSalesBroker.id.toString()
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokers]);

  // Filter brokers based on search term
  const getFilteredBrokers = () => {
    if (!brokerDebouncedTerm) return brokers;
    return brokers.filter(broker =>
      broker.name?.toLowerCase().includes(brokerDebouncedTerm.toLowerCase())
    );
  };

  const selectBrokerFromList = (broker) => {
    handleInputChange("broker_id", broker.id.toString());
    markHeaderSelected("broker");
    setBrokerDropdownOpen(false);
    window.requestAnimationFrame(() => brokerTriggerRef.current?.focus());
  };

  const handleBrokerListKeyDown = (event) => {
    const options = getFilteredBrokers() || [];

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (options.length === 0) return;
      setBrokerListHighlight((current) => {
        const next = Math.min((current ?? 0) + 1, options.length - 1);
        window.requestAnimationFrame(() => {
          document
            .querySelector(`[data-broker-option="${next}"]`)
            ?.scrollIntoView({ block: "nearest" });
        });
        return next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (options.length === 0) return;
      setBrokerListHighlight((current) => {
        const next = Math.max((current ?? 0) - 1, 0);
        window.requestAnimationFrame(() => {
          document
            .querySelector(`[data-broker-option="${next}"]`)
            ?.scrollIntoView({ block: "nearest" });
        });
        return next;
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const broker = options[brokerListHighlight ?? 0];
      if (broker) selectBrokerFromList(broker);
      return;
    }

    // Tab while list/search is open → advance to Due Date
    if (event.key === "Tab" && !event.shiftKey) {
      handleHeaderComboboxTab("broker", event);
    }
  };

  // Restore scroll position when data changes
  useEffect(() => {
    const currentScroll = scrollPositionRef.current;
    if (currentScroll > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        window.scrollTo({
          top: currentScroll,
          behavior: 'instant'
        });
      });
    }
  }, [stockItemsData]);

  // Helper functions for item search
  const handleItemSearch = (itemIndex, searchTerm) => {
    setActiveItemIndex(itemIndex);
    // Lock scroll immediately when user starts typing
    scrollLockRef.current = true;
    setIsSearching(true);

    // Preserve current scroll position before search
    scrollPositionRef.current = window.scrollY;

    // Add CSS to prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';

    setItemSearchTerms(prev => ({
      ...prev,
      [itemIndex]: searchTerm
    }));
  };

  const getItemSearchTerm = (itemIndex) => {
    return itemSearchTerms[itemIndex] || "";
  };

  const getFilteredStockItems = (itemIndex) => {
    return stockItems;
  };

  const isDropdownOpen = (itemIndex) => {
    return itemDropdownOpen[itemIndex] || false;
  };

  const handleDropdownOpenChange = (itemIndex, open) => {
    if (open) {
      setActiveItemIndex(itemIndex);
      itemListHighlightByRowRef.current = {
        ...itemListHighlightByRowRef.current,
        [itemIndex]: 0,
      };
      setItemListHighlightByRow((prev) => ({ ...prev, [itemIndex]: 0 }));
      window.requestAnimationFrame(() => {
        itemSearchInputRefs.current[itemIndex]?.focus?.();
      });
    } else if (activeItemIndex === itemIndex) {
      setActiveItemIndex(null);
    }
    setItemDropdownOpen(prev => ({
      ...prev,
      [itemIndex]: open
    }));
  };

  const scrollItemOptionIntoList = (rowIndex, optionIndex) => {
    const popover = document.querySelector(`[data-item-popover="${rowIndex}"]`);
    const option =
      popover?.querySelector(`[data-item-option="${optionIndex}"]`) ||
      document.querySelector(`[data-item-option="${optionIndex}"]`);
    option?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const closeAllHeaderDropdowns = useCallback(() => {
    setBranchDropdownOpen(false);
    setLedgerGroupDropdownOpen(false);
    setCustomerDropdownOpen(false);
    setBrokerDropdownOpen(false);
  }, []);

  const focusHeaderField = useCallback((field, { open = true } = {}) => {
    closeAllHeaderDropdowns();
    window.requestAnimationFrame(() => {
      if (field === "branch") {
        if (open) {
          headerFieldOpenedRef.current.branch = true;
          setBranchDropdownOpen(true);
        }
        branchTriggerRef.current?.focus();
        return;
      }
      if (field === "ledger") {
        if (open) {
          headerFieldOpenedRef.current.ledger = true;
          setLedgerGroupDropdownOpen(true);
        }
        ledgerGroupTriggerRef.current?.focus();
        return;
      }
      if (field === "customer") {
        if (open) {
          headerFieldOpenedRef.current.customer = true;
          setCustomerDropdownOpen(true);
        }
        customerTriggerRef.current?.focus();
        return;
      }
      if (field === "broker") {
        if (open) {
          headerFieldOpenedRef.current.broker = true;
          setBrokerListHighlight(0);
          setBrokerDropdownOpen(true);
          window.requestAnimationFrame(() => brokerSearchInputRef.current?.focus());
        } else {
          brokerTriggerRef.current?.focus();
        }
        return;
      }
      if (field === "dueDate") {
        dueDateRef.current?.focus();
        return;
      }
      if (field === "item") {
        setPendingFocusLineIndex(0);
      }
    });
  }, [closeAllHeaderDropdowns]);

  const markHeaderSelected = useCallback((field) => {
    headerFieldOpenedRef.current[field] = true;
    headerReadyForNextTabRef.current[field] = true;
  }, []);

  const handleHeaderComboboxTab = useCallback(
    (field, event) => {
      const openMap = {
        branch: branchDropdownOpen,
        ledger: ledgerGroupDropdownOpen,
        customer: customerDropdownOpen,
        broker: brokerDropdownOpen,
      };
      const setOpenMap = {
        branch: setBranchDropdownOpen,
        ledger: setLedgerGroupDropdownOpen,
        customer: setCustomerDropdownOpen,
        broker: setBrokerDropdownOpen,
      };
      const nextMap = {
        branch: "ledger",
        ledger: "customer",
        customer: "broker",
        broker: "dueDate",
      };
      const prevMap = {
        broker: "customer",
        customer: "ledger",
        ledger: "branch",
        dueDate: "broker",
      };

      if (event.key === "ArrowDown") {
        if (!openMap[field]) {
          event.preventDefault();
          headerFieldOpenedRef.current[field] = true;
          setOpenMap[field](true);
          if (field === "broker") {
            setBrokerListHighlight(0);
            window.requestAnimationFrame(() => brokerSearchInputRef.current?.focus());
          }
        }
        return;
      }

      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (openMap[field]) {
          event.preventDefault();
          setOpenMap[field](false);
          const prev = prevMap[field];
          if (prev) focusHeaderField(prev, { open: false });
        }
        return;
      }

      event.preventDefault();
      const isOpen = openMap[field];
      const readyForNext = headerReadyForNextTabRef.current[field];

      // First Tab on this field → open dropdown.
      // After a selection (Enter) or while open → go to next field.
      if (!isOpen && !readyForNext) {
        headerFieldOpenedRef.current[field] = true;
        setOpenMap[field](true);
        if (field === "broker") {
          setBrokerListHighlight(0);
          window.requestAnimationFrame(() => brokerSearchInputRef.current?.focus());
        }
        return;
      }

      setOpenMap[field](false);
      headerReadyForNextTabRef.current[field] = false;
      headerFieldOpenedRef.current[field] = false;
      const next = nextMap[field];
      if (next === "dueDate") {
        focusHeaderField("dueDate", { open: false });
      } else if (next) {
        focusHeaderField(next, { open: true });
      }
    },
    [
      branchDropdownOpen,
      ledgerGroupDropdownOpen,
      customerDropdownOpen,
      brokerDropdownOpen,
      focusHeaderField,
    ]
  );

  const focusItemRowField = useCallback((index, field) => {
    window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-item-row="${index}"]`);
      if (!row) return;
      if (field === "item") {
        handleDropdownOpenChange(index, true);
        window.requestAnimationFrame(() => {
          itemSearchInputRefs.current[index]?.focus?.();
        });
        return;
      }
      if (field === "quantity") {
        row.querySelector('[data-item-qty="true"]')?.focus?.();
        return;
      }
      if (field === "price") {
        row.querySelector('[data-item-price="true"]')?.focus?.();
        return;
      }
      if (field === "uom") {
        const uom = row.querySelector('[data-item-uom="true"]');
        if (uom) {
          uom.focus?.();
          return;
        }
        row.querySelector('[data-item-gst="true"]')?.focus?.();
      }
    });
  }, []);

  // Land on page: focus Branch so first Tab can open it
  useEffect(() => {
    if (isEditMode || branchesLoading) return;
    const id = window.requestAnimationFrame(() => {
      branchTriggerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isEditMode, branchesLoading]);

  // After "Add item", open the new row's item dropdown
  useEffect(() => {
    if (pendingFocusLineIndex === null) return;
    const index = pendingFocusLineIndex;
    setPendingFocusLineIndex(null);
    window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-item-row="${index}"]`);
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (!formData.customer_id) {
        row?.querySelector('[data-item-trigger="true"]')?.focus?.();
        return;
      }
      handleDropdownOpenChange(index, true);
      row?.querySelector('[data-item-trigger="true"]')?.focus?.();
      window.requestAnimationFrame(() => {
        itemSearchInputRefs.current[index]?.focus?.();
      });
    });
  }, [pendingFocusLineIndex, formData.customer_id]);

  // Handle form field changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  // Handle item changes
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];

    // Validate quantity (allow decimals, max 5 digits before decimal point)
    if (field === 'quantity') {
      const quantityStr = value.toString();
      // Allow decimal numbers, check integer part doesn't exceed 5 digits
      const parts = quantityStr.split('.');
      const integerPart = parts[0] || '';
      if (integerPart.length > 5) {
        // Don't update if integer part exceeds 5 digits
        return;
      }
    }

    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    if (isEditMode && field === "quantity") {
      const syncedQty = parseFloat(value);
      if (!Number.isNaN(syncedQty)) {
        newItems[index].approved_quantity = syncedQty;
      }
    }

    // Auto-fill price and gst_rate when item is selected
    if (field === 'item_id') {
      if (value) {
        // Check if this item is already selected in another row
        const isItemAlreadySelected = formData.items.some((item, idx) =>
          idx !== index && item.item_id && item.item_id.toString() === value.toString()
        );

        if (isItemAlreadySelected) {
          // Find the item name for the toast message
          const selectedStockItem = getStockItemById(value);
          const itemName = selectedStockItem?.name || 'This item';

          toast({
            title: "Item Already Selected",
            description: `${itemName} is already added to the order. Please select a different item.`,
            variant: "destructive",
          });
          return; // Don't update the item
        }

        const selectedStockItem = getStockItemById(value);
        if (selectedStockItem) {
          setSelectedStockItemsById((prev) => ({
            ...prev,
            [selectedStockItem.id.toString()]: selectedStockItem,
          }));
          // Store conversion for display purposes
          const conversion = selectedStockItem.conversion || 1.0;
          newItems[index].conversion = parseFloat(conversion);

          // ALWAYS use base unit for quantity - set base_unit_id to item's base unit
          if (selectedStockItem.base_unit && selectedStockItem.base_unit.id) {
            newItems[index].base_unit_id = selectedStockItem.base_unit.id;
          } else {
            newItems[index].base_unit_id = null;
          }

          // Store both prices for display
          newItems[index].base_unit_price = selectedStockItem.base_unit?.price || 0;
          newItems[index].alternate_unit_price = selectedStockItem.alternate_unit?.price || 0;

          // Set default price UOM based on unit_of_measurement from API response
          // Match by ID first; if IDs differ, match by name (case-insensitive) for base/alternate units
          const unitOfMeasurement = selectedStockItem.unit_of_measurement;
          const baseUnitId = selectedStockItem.base_unit?.id;
          const alternateUnitId = selectedStockItem.alternate_unit?.id;
          const baseUnitName = (selectedStockItem.base_unit?.name || "").trim().toLowerCase();
          const alternateUnitName = (selectedStockItem.alternate_unit?.name || "").trim().toLowerCase();
          const uomName = (unitOfMeasurement?.name || "").trim().toLowerCase();

          const matchesBaseById = unitOfMeasurement?.id != null && unitOfMeasurement.id === baseUnitId;
          const matchesAlternateById = unitOfMeasurement?.id != null && unitOfMeasurement.id === alternateUnitId;
          const matchesBaseByName = uomName && baseUnitName && uomName === baseUnitName;
          const matchesAlternateByName = uomName && alternateUnitName && uomName === alternateUnitName;

          if (unitOfMeasurement && (unitOfMeasurement.id != null || uomName)) {
            if (matchesBaseById || matchesBaseByName) {
              // unit_of_measurement is base unit
              newItems[index].price_uom_id = baseUnitId;
              newItems[index].price = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
              newItems[index].base_unit_price_for_calc = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
            } else if (matchesAlternateById || matchesAlternateByName) {
              // unit_of_measurement is alternate unit
              newItems[index].price_uom_id = alternateUnitId;
              newItems[index].price = parseFloat(parseFloat(selectedStockItem.alternate_unit?.price || 0).toFixed(2));
              // Convert alternate unit price to base unit for calculations
              newItems[index].base_unit_price_for_calc = parseFloat((parseFloat(selectedStockItem.alternate_unit?.price || 0) * conversion).toFixed(2));
            } else {
              // unit_of_measurement doesn't match either, fallback to base unit
              if (selectedStockItem.base_unit && selectedStockItem.base_unit.id) {
                newItems[index].price_uom_id = selectedStockItem.base_unit.id;
                newItems[index].price = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
                newItems[index].base_unit_price_for_calc = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
              } else {
                newItems[index].price_uom_id = null;
                newItems[index].price = 0;
                newItems[index].base_unit_price_for_calc = 0;
              }
            }
          } else {
            // No unit_of_measurement provided, fallback to base unit if available
            if (selectedStockItem.base_unit && selectedStockItem.base_unit.id) {
              newItems[index].price_uom_id = selectedStockItem.base_unit.id;
              newItems[index].price = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
              newItems[index].base_unit_price_for_calc = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
            } else {
              newItems[index].price_uom_id = null;
              newItems[index].price = 0;
              newItems[index].base_unit_price_for_calc = 0;
            }
          }

          // If no alternate unit, force UOM to base unit only (auto-select, no dropdown later)
          if (!selectedStockItem.alternate_unit?.id && selectedStockItem.base_unit?.id) {
            newItems[index].price_uom_id = selectedStockItem.base_unit.id;
            newItems[index].price = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
            newItems[index].base_unit_price_for_calc = parseFloat(parseFloat(selectedStockItem.base_unit?.price || 0).toFixed(2));
          }

          // Auto-fill GST rate from API response - always set a value (0 if not set)
          newItems[index].gst_percentage = selectedStockItem.gst_rate !== undefined && selectedStockItem.gst_rate !== null
            ? selectedStockItem.gst_rate
            : 0;
          // Mark that GST has been auto-filled so it becomes read-only
          newItems[index].gst_auto_filled = true;
        }
      } else {
        // If item is cleared, reset all fields
        newItems[index].gst_percentage = 0;
        newItems[index].gst_auto_filled = false;
        newItems[index].base_unit_id = null;
        newItems[index].price_uom_id = null;
        newItems[index].conversion = 1.0;
        newItems[index].price = 0;
        newItems[index].base_unit_price = 0;
        newItems[index].alternate_unit_price = 0;
        newItems[index].base_unit_price_for_calc = 0;
      }
    }

    // Handle price UOM change - use API prices directly, convert base_unit_price_for_calc
    if (field === 'price_uom_id') {
      const selectedStockItem = getStockItemById(newItems[index].item_id);
      if (selectedStockItem) {
        const baseUnitId = selectedStockItem.base_unit?.id;
        const alternateUnitId = selectedStockItem.alternate_unit?.id;
        const conversion = newItems[index].conversion || 1.0;

        if (value === baseUnitId) {
          // Base unit selected - use API base unit price
          const baseUnitPrice = selectedStockItem.base_unit?.price || 0;
          if (baseUnitPrice > 0) {
            newItems[index].price = parseFloat(parseFloat(baseUnitPrice).toFixed(2));
            newItems[index].base_unit_price_for_calc = parseFloat(parseFloat(baseUnitPrice).toFixed(2));
          } else {
            // If API price not available, use current base price
            const currentBasePrice = newItems[index].base_unit_price_for_calc || 0;
            newItems[index].price = parseFloat(currentBasePrice.toFixed(2));
          }
        } else if (value === alternateUnitId) {
          // Alternate unit selected - use API alternate unit price
          const alternateUnitPrice = selectedStockItem.alternate_unit?.price || 0;
          if (alternateUnitPrice > 0) {
            newItems[index].price = parseFloat(parseFloat(alternateUnitPrice).toFixed(2));
            // Convert alternate unit price to base unit for calculations
            newItems[index].base_unit_price_for_calc = parseFloat((parseFloat(alternateUnitPrice) * conversion).toFixed(2));
          } else {
            // If API price not available, convert from current base price
            const currentBasePrice = newItems[index].base_unit_price_for_calc || 0;
            newItems[index].price = parseFloat((currentBasePrice / conversion).toFixed(2));
          }
        } else {
          // Fallback - use current base price
          const currentBasePrice = newItems[index].base_unit_price_for_calc || 0;
          newItems[index].price = parseFloat(currentBasePrice.toFixed(2));
        }
      }
    }

    // Handle price change - convert to base unit for calculations
    if (field === 'price') {
      const selectedStockItem = getStockItemById(newItems[index].item_id);
      if (selectedStockItem) {
        const baseUnitId = selectedStockItem.base_unit?.id;
        const alternateUnitId = selectedStockItem.alternate_unit?.id;
        const conversion = newItems[index].conversion || 1.0;
        const priceUomId = newItems[index].price_uom_id;

        // Keep the displayed price as entered (in selected UOM)
        // Only update base_unit_price_for_calc for calculations
        if (priceUomId === baseUnitId) {
          // Price is already in base unit
          newItems[index].base_unit_price_for_calc = parseFloat(parseFloat(value || 0).toFixed(2));
          // Keep displayed price as is
          newItems[index].price = parseFloat(parseFloat(value || 0).toFixed(2));
        } else if (priceUomId === alternateUnitId) {
          // Price is in alternate unit - convert to base unit for calculation
          newItems[index].base_unit_price_for_calc = parseFloat((parseFloat(value || 0) * conversion).toFixed(2));
          // Keep displayed price as entered (in alternate unit)
          newItems[index].price = parseFloat(parseFloat(value || 0).toFixed(2));
        } else {
          // Fallback - assume base unit
          newItems[index].base_unit_price_for_calc = parseFloat(parseFloat(value || 0).toFixed(2));
          newItems[index].price = parseFloat(parseFloat(value || 0).toFixed(2));
        }
      }
    }

    // Clear error for this field when user starts typing
    if (errors[`item_${index}_${field}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`item_${index}_${field}`];
        return newErrors;
      });
    }

    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  // Add new item
  const addItem = ({ focusNew = false } = {}) => {
    setShowNextStepModal(false);
    nextStepPromptedRef.current = false;
    setFormData((prev) => {
      const newIndex = prev.items.length;
      if (focusNew) {
        window.setTimeout(() => setPendingFocusLineIndex(newIndex), 0);
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            item_id: "",
            quantity: 1,
            price: 0,
            comment: "",
            gst_percentage: 0,
            gst_auto_filled: false,
            approved_quantity: 0,
            is_approved: false,
            is_rejected: false,
            base_unit_id: null,
            price_uom_id: null,
            conversion: 1.0,
            base_unit_price: 0,
            alternate_unit_price: 0,
            base_unit_price_for_calc: 0,
          },
        ],
      };
    });
  };

  // Remove item
  const removeItem = (index) => {
    setShowNextStepModal(false);
    nextStepPromptedRef.current = false;
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData((prev) => ({
        ...prev,
        items: newItems,
      }));
    }
  };

  // Handle previous SO popup - Auto populate items
  const handleUsePreviousSO = () => {
    if (!previousSOData || !previousSOData.items || previousSOData.items.length === 0) {
      setIsPreviousSOPopupOpen(false);
      return;
    }

    // Create items from previous SO
    const newItems = previousSOData.items.map((prevItem) => {
      // Find the stock item in the current stockItems list to get pricing
      const stockItem = getStockItemById(prevItem.item_id);

      if (!stockItem) {
        // If stock item not found, create item with default values
        return {
          item_id: prevItem.item_id?.toString() || "",
          quantity: 1,
          price: 0,
          comment: "",
          gst_percentage: 0,
          gst_auto_filled: false,
          approved_quantity: 0,
          is_approved: false,
          is_rejected: false,
          base_unit_id: null,
          price_uom_id: null,
          conversion: 1.0,
          base_unit_price: 0,
          alternate_unit_price: 0,
          base_unit_price_for_calc: 0,
        };
      }

      // Get base unit and alternate unit info
      const baseUnitId = stockItem.base_unit?.id || null;
      const alternateUnitId = stockItem.alternate_unit?.id || null;
      const conversion = parseFloat(stockItem.conversion || 1.0);

      // Get base price from stockItem
      const baseUnitPrice = parseFloat(stockItem.base_unit?.price || 0);
      const alternateUnitPrice = parseFloat(stockItem.alternate_unit?.price || 0);

      // Determine which UOM to use for price - match unit_of_measurement to base/alternate (ID or case-insensitive name)
      const unitOfMeasurement = stockItem.unit_of_measurement;
      let priceUomId = baseUnitId;
      let displayPrice = baseUnitPrice;
      let baseUnitPriceForCalc = baseUnitPrice;

      const baseUnitName = (stockItem.base_unit?.name || "").trim().toLowerCase();
      const alternateUnitName = (stockItem.alternate_unit?.name || "").trim().toLowerCase();
      const uomName = (unitOfMeasurement?.name || "").trim().toLowerCase();
      const matchesAlternateById = unitOfMeasurement?.id != null && unitOfMeasurement.id === alternateUnitId;
      const matchesAlternateByName = uomName && alternateUnitName && uomName === alternateUnitName;
      const matchesBaseById = unitOfMeasurement?.id != null && unitOfMeasurement.id === baseUnitId;
      const matchesBaseByName = uomName && baseUnitName && uomName === baseUnitName;

      if (unitOfMeasurement && (unitOfMeasurement.id != null || uomName) && baseUnitId && alternateUnitId) {
        if (matchesAlternateById || matchesAlternateByName) {
          // Price is in alternate unit
          priceUomId = alternateUnitId;
          displayPrice = alternateUnitPrice;
          baseUnitPriceForCalc = parseFloat((alternateUnitPrice * conversion).toFixed(2));
        } else if (matchesBaseById || matchesBaseByName) {
          // Price is in base unit
          priceUomId = baseUnitId;
          displayPrice = baseUnitPrice;
          baseUnitPriceForCalc = baseUnitPrice;
        }
      }

      return {
        item_id: prevItem.item_id?.toString() || "",
        quantity: 1, // Set default quantity to 1 like other items
        price: displayPrice,
        comment: "",
        gst_percentage: stockItem.gst_rate !== undefined && stockItem.gst_rate !== null ? parseFloat(stockItem.gst_rate) : 0,
        gst_auto_filled: stockItem.gst_rate !== undefined && stockItem.gst_rate !== null,
        approved_quantity: 0,
        is_approved: false,
        is_rejected: false,
        base_unit_id: baseUnitId,
        price_uom_id: priceUomId,
        conversion: conversion,
        base_unit_price: baseUnitPrice,
        alternate_unit_price: alternateUnitPrice,
        base_unit_price_for_calc: baseUnitPriceForCalc,
      };
    });

    // Update form data with new items
    setFormData(prev => ({
      ...prev,
      items: newItems.length > 0 ? newItems : [{
        item_id: "",
        quantity: 1,
        price: 0,
        comment: "",
        gst_percentage: 0,
        gst_auto_filled: false,
        approved_quantity: 0,
        is_approved: false,
        is_rejected: false,
        base_unit_id: null,
        price_uom_id: null,
        conversion: 1.0,
        base_unit_price: 0,
        alternate_unit_price: 0,
        base_unit_price_for_calc: 0,
      }]
    }));

    setIsPreviousSOPopupOpen(false);
    setPreviousSOData(null);

    toast({
      title: "Items loaded",
      description: `Loaded ${newItems.length} items from previous sales order (${previousSOData.so_number})`,
    });
  };

  // Handle skip previous SO (and keep popup closed; effect won't re-open due to dismissed flag)
  const handleSkipPreviousSO = () => {
    setPreviousSOPopupDismissedForCustomerId(formData.customer_id || null);
    setIsPreviousSOPopupOpen(false);
    setPreviousSOData(null);
  };

  // When dialog is closed (X or overlay), treat as dismissed so it doesn't re-open
  const handlePreviousSOPopupOpenChange = (open) => {
    if (!open) {
      setPreviousSOPopupDismissedForCustomerId(formData.customer_id || null);
      setPreviousSOData(null);
    }
    setIsPreviousSOPopupOpen(open);
  };

  const QUANTITY_MAX_DIGITS = 5;
  const QUANTITY_WARN_DIGITS = 4;

  const tryApplyQuantityInput = (index, inputValue) => {
    if (inputValue === "") {
      handleItemChange(index, "quantity", 0);
      return;
    }
    if (!/^\d+$/.test(inputValue)) return;
    if (inputValue.length <= QUANTITY_WARN_DIGITS) {
      handleItemChange(index, "quantity", parseInt(inputValue, 10) || 0);
      return;
    }
    if (inputValue.length === QUANTITY_MAX_DIGITS) {
      setQuantityExceedDialog({
        open: true,
        itemIndex: index,
        pendingQuantity: inputValue,
      });
    }
  };

  const handleQuantityExceedConfirm = () => {
    const { itemIndex, pendingQuantity } = quantityExceedDialog;
    if (itemIndex !== null && pendingQuantity != null) {
      handleItemChange(itemIndex, "quantity", parseInt(String(pendingQuantity), 10) || 0);
    }
    setQuantityExceedDialog({ open: false, itemIndex: null, pendingQuantity: null });
  };

  const setVoiceRemarks = (url) => {
    const value = url || "";
    voiceRemarksUrlRef.current = value;
    setVoiceRemarksUrl(value);
  };

  const clearVoiceRemarks = () => {
    setVoiceRemarks("");
    voiceUploadPromiseRef.current = null;
  };

  const stopVoiceStream = () => {
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      stopVoiceStream();
    };
  }, []);

  const startBackgroundVoiceUpload = (blob) => {
    setIsUploadingVoice(true);
    const uploadPromise = uploadSalesOrderVoice(blob)
      .then((url) => {
        setVoiceRemarks(url);
        toast({
          title: "Voice note saved",
          description: "It will be sent with the sales order when you save.",
        });
        return url;
      })
      .catch((err) => {
        setVoiceRemarks("");
        toast({
          title: "Upload failed",
          description: err?.message || "Could not upload voice note.",
          variant: "destructive",
        });
        throw err;
      })
      .finally(() => {
        setIsUploadingVoice(false);
        if (voiceUploadPromiseRef.current === uploadPromise) {
          voiceUploadPromiseRef.current = null;
        }
      });

    voiceUploadPromiseRef.current = uploadPromise;
    return uploadPromise;
  };

  const waitForVoiceUploadIfNeeded = async () => {
    if (isRecordingVoice) {
      toast({
        title: "Recording in progress",
        description: "Stop the recording before saving the sales order.",
        variant: "destructive",
      });
      return false;
    }
    if (voiceUploadPromiseRef.current) {
      try {
        await voiceUploadPromiseRef.current;
      } catch {
        return false;
      }
    }
    return true;
  };

  const handleVoiceMicClick = async () => {
    if (isUploadingVoice) return;

    if (isRecordingVoice) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Microphone unavailable",
        description: "Your browser does not support voice recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsRecordingVoice(false);
        stopVoiceStream();
        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(voiceChunksRef.current, { type: blobType });
        voiceChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (!blob.size) {
          toast({
            title: "No recording",
            description: "Record again and speak before stopping.",
            variant: "destructive",
          });
          return;
        }

        startBackgroundVoiceUpload(blob);
      };

      recorder.onerror = () => {
        setIsRecordingVoice(false);
        stopVoiceStream();
        toast({
          title: "Recording error",
          description: "Could not complete voice recording.",
          variant: "destructive",
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
    } catch (err) {
      stopVoiceStream();
      toast({
        title: "Microphone access denied",
        description: err?.message || "Allow microphone access to record a voice note.",
        variant: "destructive",
      });
    }
  };

  // Calculate total amount - quantity is always in base unit, use base_unit_price_for_calc
  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      // Quantity is always in base unit, use base_unit_price_for_calc (converted to base unit)
      return total + (parseFloat(item.quantity || 0) * parseFloat(item.base_unit_price_for_calc || 0));
    }, 0);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.customer_id) {
      newErrors.customer_id = "Customer is required";
    }

    if (!formData.date) {
      newErrors.date = "Order date is required";
    }

    if (!formData.branch_id) {
      newErrors.branch_id = "Branch is required";
    }

    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    }

    formData.items.forEach((item, index) => {
      if (!item.item_id) {
        newErrors[`item_${index}_item_id`] = "Item is required";
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = "Quantity must be greater than 0";
      }
      // Validate quantity max 5 digits in integer part
      if (item.quantity) {
        const quantityStr = item.quantity.toString();
        const parts = quantityStr.split('.');
        const integerPart = parts[0] || '';
        if (integerPart.length > 5) {
          newErrors[`item_${index}_quantity`] = "Quantity integer part must not exceed 5 digits";
        }
      }
      if (!item.price || item.price < 0) {
        newErrors[`item_${index}_price`] = "Price must be 0 or greater";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create sales order mutation
  const { data: soSyncLedgersData, isLoading: isLoadingSoSyncLedgers } = useQuery({
    queryKey: ["ledgers-for-so-create-sync"],
    queryFn: async () => {
      const fromDate = format(subDays(new Date(), 365), "yyyy-MM-dd");
      const toDate = format(new Date(), "yyyy-MM-dd");
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers-list/?from_date=${fromDate}&to_date=${toDate}&status=all&search=&page=1&limit=1000`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: isLedgerDialogOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const filteredSoSyncLedgers = useMemo(() => {
    if (!soSyncLedgersData) return [];
    if (!ledgerSearchTerm) return soSyncLedgersData;
    const searchLower = ledgerSearchTerm.toLowerCase();
    return soSyncLedgersData.filter(
      (ledger) =>
        (ledger.name && ledger.name.toLowerCase().includes(searchLower)) ||
        (ledger.parent && ledger.parent.toLowerCase().includes(searchLower))
    );
  }, [soSyncLedgersData, ledgerSearchTerm]);

  const {
    data: soVoucherTypesData,
    isLoading: isLoadingSoVoucherTypes,
    error: soVoucherTypesError,
  } = useQuery({
    queryKey: ["sales-order-voucher-types-create"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `${API_BASE_URL}/api/get-so-voucher-types/`);
        const data = await response.json();
        if (data.status === 200 && data.data) {
          return Array.isArray(data.data) ? data.data : [];
        }
        if (Array.isArray(data)) return data;
        return [];
      } catch (error) {
        console.error("Error fetching voucher types:", error);
        return [];
      }
    },
    enabled: isLedgerDialogOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const filteredSoVoucherTypes = useMemo(() => {
    if (!soVoucherTypesData) return [];
    if (!voucherTypeSearchTerm) return soVoucherTypesData;
    const searchLower = voucherTypeSearchTerm.toLowerCase();
    return soVoucherTypesData.filter(
      (vt) =>
        (vt.name && vt.name.toLowerCase().includes(searchLower)) ||
        (vt.display_name && vt.display_name.toLowerCase().includes(searchLower)) ||
        (vt.parent && vt.parent.toLowerCase().includes(searchLower))
    );
  }, [soVoucherTypesData, voucherTypeSearchTerm]);

  const syncSalesOrderMutation = useMutation({
    mutationFn: async ({ soNumber, ledgerName, voucherTypeName }) => {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/sales/sync-so/`, {
        so_number: soNumber,
        ledger_name: ledgerName,
        voucher_type_name: voucherTypeName || "SALES ORDER VAN",
      });
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: data.message || "Sales Order Synced Successfully to Tally",
        variant: "success",
      });
      setCreatedSoTallySynced(true);
      setIsLedgerDialogOpen(false);
      setSelectedLedger(null);
      setLedgerSearchTerm("");
      setSelectedVoucherType(null);
      setVoucherTypeSearchTerm("");
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"], exact: false });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to sync sales order to Tally",
        variant: "destructive",
      });
    },
  });

  const createSalesOrderMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/sales/create-direct-so/`, data);
      return response.json();
    },
    onSuccess: async (data) => {
      const soNumber =
        data?.data?.so_number ||
        data?.data?.order_id ||
        data?.so_number ||
        data?.order_id ||
        "";

      try {
        const soToRefresh = editSoNumber || soNumber;

        sessionStorage.setItem(SALES_ORDERS_LIST_REFRESH_KEY, "1");
        if (soToRefresh) {
          sessionStorage.setItem(SALES_ORDERS_DETAIL_REFRESH_SO_KEY, String(soToRefresh));
        }

        await queryClient.invalidateQueries({ queryKey: ["sales-orders"], exact: false });
        await queryClient.refetchQueries({ queryKey: ["sales-orders"], exact: false });

        if (soToRefresh) {
          await queryClient.invalidateQueries({
            queryKey: ["sales-order-detail", soToRefresh],
          });
          await queryClient.refetchQueries({
            queryKey: ["sales-order-detail", soToRefresh],
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["sales-order-detail"], exact: false });

        if (editSoNumber) {
          await queryClient.invalidateQueries({
            queryKey: ["sales-order-edit-detail", editSoNumber],
          });
          await queryClient.refetchQueries({
            queryKey: ["sales-order-edit-detail", editSoNumber],
          });
        }
      } catch (refreshError) {
        console.error("Failed to refresh sales orders list cache:", refreshError);
      }

      if (!isEditMode && soNumber) {
        setCreatedSoNumber(String(soNumber));
        setCreatedSoTallySynced(Boolean(data?.data?.is_tally_synced ?? data?.is_tally_synced));
        setSoSuccessOpen(true);
        return;
      }

      toast({
        title: "Success",
        description:
          data?.message ||
          (isEditMode ? "Sales Order Updated Successfully" : "Sales Order Created Successfully"),
        variant: "success",
      });
      setLocation("/reports/sales-order-list");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create sales order",
        variant: "destructive",
      });
    },
  });

  const shouldShowNextStepModal = (index) => {
    if (isEditMode) return false;
    if (index !== formData.items.length - 1) return false;
    return isLineReadyForNextStep(formData.items[index]);
  };

  const tryShowNextStepModal = (index) => {
    if (isEditMode || showNextStepModal || nextStepPromptedRef.current) return;
    if (!shouldShowNextStepModal(index)) return;
    nextStepPromptedRef.current = true;
    setShowNextStepModal(true);
  };

  const handleUomTabNext = (index, event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    if (index !== formData.items.length - 1) return;
    if (!isLineReadyForNextStep(formData.items[index])) return;
    event.preventDefault();
    event.stopPropagation();
    tryShowNextStepModal(index);
  };

  const handleItemTriggerKeyDown = (index, event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
      if (!isDropdownOpen(index)) {
        if (event.key === "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        setItemListHighlightByRow((prev) => ({ ...prev, [index]: 0 }));
        handleDropdownOpenChange(index, true);
        return;
      }
      // Dropdown already open — navigate / select even if focus is still on the trigger
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") {
        const options = getFilteredStockItems(index) || [];
        if (options.length === 0) return;
        const highlight = itemListHighlightByRowRef.current[index] ?? 0;
        selectStockItemForRow(index, options[highlight]);
        return;
      }
      moveItemListHighlight(index, event.key === "ArrowDown" ? "down" : "up");
      window.requestAnimationFrame(() => itemSearchInputRefs.current[index]?.focus?.());
      return;
    }
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    const readyForNext = itemReadyForNextTabRef.current[index] || Boolean(formData.items[index]?.item_id);
    if (!isDropdownOpen(index) && !readyForNext) {
      setItemListHighlightByRow((prev) => ({ ...prev, [index]: 0 }));
      handleDropdownOpenChange(index, true);
      return;
    }
    itemReadyForNextTabRef.current[index] = false;
    handleDropdownOpenChange(index, false);
    focusItemRowField(index, "quantity");
  };

  const selectStockItemForRow = (index, stockItem) => {
    if (!stockItem) return;
    handleItemChange(index, "item_id", stockItem.id.toString());
    itemReadyForNextTabRef.current[index] = true;
    handleDropdownOpenChange(index, false);
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-item-row="${index}"] [data-item-trigger="true"]`)
        ?.focus?.();
    });
  };

  const moveItemListHighlight = (index, direction) => {
    const options = getFilteredStockItems(index) || [];
    if (options.length === 0) return;
    const current = itemListHighlightByRowRef.current[index] ?? 0;
    const next =
      direction === "down"
        ? Math.min(current + 1, options.length - 1)
        : Math.max(current - 1, 0);
    itemListHighlightByRowRef.current = {
      ...itemListHighlightByRowRef.current,
      [index]: next,
    };
    setItemListHighlightByRow((prev) => ({ ...prev, [index]: next }));
    window.requestAnimationFrame(() => scrollItemOptionIntoList(index, next));
  };

  const handleItemListKeyDown = (index, event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveItemListHighlight(index, "down");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveItemListHighlight(index, "up");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const options = getFilteredStockItems(index) || [];
      if (options.length === 0) return;
      const highlight = itemListHighlightByRowRef.current[index] ?? 0;
      selectStockItemForRow(index, options[highlight]);
      return;
    }
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      handleDropdownOpenChange(index, false);
      if (formData.items[index]?.item_id || itemReadyForNextTabRef.current[index]) {
        itemReadyForNextTabRef.current[index] = false;
        focusItemRowField(index, "quantity");
      } else {
        document
          .querySelector(`[data-item-row="${index}"] [data-item-trigger="true"]`)
          ?.focus?.();
      }
    }
  };

  // Prevent page scroll from arrow keys while an item dropdown is open
  useEffect(() => {
    const openKey = Object.keys(itemDropdownOpen).find((key) => itemDropdownOpen[key]);
    if (openKey === undefined) return;

    const onKeyDownCapture = (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDownCapture, true);
    return () => window.removeEventListener("keydown", onKeyDownCapture, true);
  }, [itemDropdownOpen]);

  const handleQuantityTab = (index, event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    focusItemRowField(index, "price");
  };

  const handlePriceTab = (index, event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    const selectedStockItem = getStockItemById(formData.items[index]?.item_id);
    const hasAlternateUnit = selectedStockItem?.alternate_unit?.id != null;
    if (hasAlternateUnit) {
      focusItemRowField(index, "uom");
      return;
    }
    if (index === formData.items.length - 1 && isLineReadyForNextStep(formData.items[index])) {
      tryShowNextStepModal(index);
      return;
    }
    focusItemRowField(index, "uom");
  };

  const handleItemRowKeyDown = (index, event) => {
    if (event.key !== "Tab" || event.shiftKey) return;

    const row = event.currentTarget;
    const focusables = [
      ...row.querySelectorAll(
        'input:not([disabled]), select:not([disabled]), button:not([disabled]):not([tabindex="-1"])'
      ),
    ].filter((el) => el.offsetParent !== null);

    const activeIndex = focusables.indexOf(document.activeElement);
    if (activeIndex < 0 || activeIndex < focusables.length - 1) return;

    if (index === formData.items.length - 1 && isLineReadyForNextStep(formData.items[index])) {
      event.preventDefault();
      tryShowNextStepModal(index);
      return;
    }

    tabLeavingRowRef.current = index;
  };

  const handleItemRowBlur = (index, event) => {
    if (tabLeavingRowRef.current !== index) return;
    tabLeavingRowRef.current = null;
    if (event.currentTarget.contains(event.relatedTarget)) return;
    window.setTimeout(() => tryShowNextStepModal(index), 0);
  };

  const handleDismissNextStepModal = () => {
    setShowNextStepModal(false);
    nextStepPromptedRef.current = false;
  };

  const maybeShowNextStepModal = () => {
    const lastIndex = formData.items.length - 1;
    if (shouldShowNextStepModal(lastIndex)) {
      nextStepPromptedRef.current = true;
      setShowNextStepModal(true);
      return true;
    }
    return false;
  };

  const handleAddItemFromModal = () => {
    handleDismissNextStepModal();
    addItem({ focusNew: true });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before submitting",
        variant: "destructive",
      });
      return;
    }

    const voiceReady = soVoiceRemarksEnabled ? await waitForVoiceUploadIfNeeded() : true;
    if (!voiceReady) return;

    if (maybeShowNextStepModal()) return;

    await submitSalesOrder();
  };

  const handleCreateFromModal = async () => {
    setShowNextStepModal(false);
    await submitSalesOrder();
  };

  const submitSalesOrder = async () => {
    setIsSubmitting(true);

    try {
      // Prepare data for API - only include fields that have values
      const voiceUrlForSubmit = (voiceRemarksUrlRef.current || voiceRemarksUrl || "").trim();

      const isoOrderDate = toIsoDateString(formData.date);
      const isoDueDate = toIsoDateString(formData.due_date);
      const submitData = {
        customer_id: formData.customer_id,
        date: isoOrderDate || formData.date,
        status: formData.status || "PENDING",
        remarks: formData.remarks || undefined,
        address: formData.address || undefined,
        order_by: formData.order_by || undefined,
        order_number: (formData.order_number || "").trim(),
        broker_id: formData.broker_id ? parseInt(formData.broker_id) : undefined,
        due_date: isoDueDate || (formData.due_date || undefined),
        branch_id: formData.branch_id || undefined,
        items: formData.items.map(item => {
          // Find the selected stock item to get UOM name
          const selectedStockItem = getStockItemById(item.item_id);
          let ratePerUnit = undefined;

          // Determine rate_per_unit based on the selected UOM (price_uom_id)
          // This should always match the UOM selected in the dropdown
          if (selectedStockItem) {
            // Convert price_uom_id to number for comparison
            const priceUomId = item.price_uom_id ?
              (typeof item.price_uom_id === 'string' ? parseInt(item.price_uom_id) : item.price_uom_id) : null;

            // Get base_unit and alternate_unit IDs for comparison
            const baseUnitId = selectedStockItem.base_unit?.id ?
              (typeof selectedStockItem.base_unit.id === 'string' ? parseInt(selectedStockItem.base_unit.id) : selectedStockItem.base_unit.id) : null;
            const alternateUnitId = selectedStockItem.alternate_unit?.id ?
              (typeof selectedStockItem.alternate_unit.id === 'string' ? parseInt(selectedStockItem.alternate_unit.id) : selectedStockItem.alternate_unit.id) : null;

            // Set rate_per_unit based on selected UOM (price_uom_id)
            if (priceUomId !== null) {
              if (baseUnitId !== null && baseUnitId === priceUomId) {
                // Selected UOM is base unit
                ratePerUnit = selectedStockItem.base_unit?.name || undefined;
              } else if (alternateUnitId !== null && alternateUnitId === priceUomId) {
                // Selected UOM is alternate unit
                ratePerUnit = selectedStockItem.alternate_unit?.name || undefined;
              }
            }

            // Fallback: if price_uom_id is not set or doesn't match, use base unit name as default
            if (!ratePerUnit && selectedStockItem.base_unit?.name) {
              ratePerUnit = selectedStockItem.base_unit.name;
            }
          }

          const orderQty = parseFloat(item.quantity);
          return {
            item_id: parseInt(item.item_id),
            quantity: orderQty, // Quantity is always in base unit
            price: parseFloat(item.base_unit_price_for_calc || item.price || 0), // Always use base unit price for API
            comment: item.comment || undefined,
            gst_percentage: item.gst_percentage ? parseFloat(item.gst_percentage) : undefined,
            approved_quantity: isEditMode ? orderQty : item.approved_quantity || 0,
            is_approved: item.is_approved || false,
            is_rejected: item.is_rejected || false,
            base_unit_id: item.base_unit_id || undefined, // Always base unit ID for quantity
            rate_per_unit: ratePerUnit || undefined, // UOM name for the selected price UOM (based on price_uom_id selection)
            // Brokerage is auto-calculated on the server from broker and item config
          };
        })
      };

      if (soVoiceRemarksEnabled) {
        if (voiceUrlForSubmit) {
          submitData.voice_remarks = voiceUrlForSubmit;
        } else if (isEditMode) {
          submitData.voice_remarks = "";
        }
      }

      // Remove undefined values
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      if (isEditMode && editSoNumber) {
        submitData.order_id = editSoNumber;
      }

      await createSalesOrderMutation.mutateAsync(submitData);
    } catch (error) {
      console.error('Error creating sales order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEmptySalesOrderItem = () => ({
    item_id: "",
    quantity: 1,
    price: 0,
    comment: "",
    gst_percentage: 0,
    gst_auto_filled: false,
    approved_quantity: 0,
    is_approved: false,
    is_rejected: false,
    base_unit_id: null,
    price_uom_id: null,
    conversion: 1.0,
    base_unit_price: 0,
    alternate_unit_price: 0,
    base_unit_price_for_calc: 0,
  });

  const resetCreatedSoSuccessState = () => {
    setSoSuccessOpen(false);
    setCreatedSoNumber("");
    setCreatedSoTallySynced(false);
    setIsLedgerDialogOpen(false);
    setSelectedLedger(null);
    setLedgerSearchTerm("");
    setSelectedVoucherType(null);
    setVoucherTypeSearchTerm("");
    const today = new Date().toISOString().split("T")[0];
    setFormData({
      customer_id: "",
      date: today,
      status: "PENDING",
      remarks: "",
      address: "",
      order_by: "",
      order_number: "",
      broker_id: "",
      due_date: today,
      branch_id: branchesData?.[0]?.id || "",
      items: [getEmptySalesOrderItem()],
    });
    setSelectedStockItemsById({});
    setSelectedCustomerMeta(null);
    setCustomerSearchTerm("");
    setBrokerSearchTerm("");
    setItemSearchTerms({});
    setItemDebouncedTerms({});
    setErrors({});
    setPreviousSOPopupDismissedForCustomerId(null);
    clearVoiceRemarks();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopySoNumber = async () => {
    if (!createdSoNumber) return;
    try {
      await navigator.clipboard.writeText(createdSoNumber);
      toast({ title: "Copied", description: "Sales Order Number Copied to Clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const formatSoPdfDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd-MM-yyyy");
    } catch {
      return dateString;
    }
  };

  const handleDownloadCreatedSoPdf = async () => {
    if (!createdSoNumber) {
      toast({
        title: "Error",
        description: "Sales order number is not available for PDF download.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/sales/sales-orders/${createdSoNumber}/`
      );
      const json = await response.json();
      const orderDetail = json?.data || json;
      if (!orderDetail?.header) {
        throw new Error(json?.message || "Failed to load sales order details");
      }
      const branchRecord = branchesData?.find(
        (branch) => String(branch.id) === String(orderDetail.header?.branch_id)
      );
      await downloadSalesOrderPdf({
        orderDetail,
        userData,
        branchRecord,
        totalAmount: orderDetail.header?.amount,
        showBillingAmount: false,
        showBrokerage,
        hasBilledData: false,
        formatDateFn: formatSoPdfDate,
      });
      toast({
        title: "PDF Downloaded",
        description: "Sales order has been downloaded as PDF",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message || "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const openLedgerModalForCreatedSo = () => {
    if (!createdSoNumber) {
      toast({
        title: "Error",
        description: "Sales order number is not available for Tally sync.",
        variant: "destructive",
      });
      return;
    }
    setSelectedLedger(null);
    setLedgerSearchTerm("");
    setSelectedVoucherType(null);
    setVoucherTypeSearchTerm("");
    setIsLedgerDialogOpen(true);
  };

  const handleConfirmSoTallySync = () => {
    if (!createdSoNumber) return;
    if (!selectedVoucherType) {
      toast({
        title: "Error",
        description: "Please select a voucher type first",
        variant: "destructive",
      });
      return;
    }
    syncSalesOrderMutation.mutate({
      soNumber: createdSoNumber,
      ledgerName: selectedLedger?.name ?? "",
      voucherTypeName: selectedVoucherType.name || "SALES ORDER VAN",
    });
  };

  const finishSoSuccess = () => {
    setSoSuccessOpen(false);
    setCreatedSoNumber("");
    setCreatedSoTallySynced(false);
    setLocation("/reports/sales-order-list");
  };

  if (
    brokersLoading ||
    branchesLoading ||
    (isEditMode && (editOrderLoading || (!editFormHydrated && !editOrderError)))
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader text={isEditMode ? "Loading sales order..." : undefined} />
      </div>
    );
  }

  if (isEditMode && editOrderError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Unable to load sales order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {editOrderErrorObj?.message || "Sales order details could not be loaded."}
            </p>
            <Button variant="outline" onClick={() => setLocation("/reports/sales-order-list")}>
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      {/* Loading Overlay during submission */}
      {(isSubmitting || createSalesOrderMutation.isPending) && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-lg font-semibold text-gray-700">
              {isEditMode ? "Updating Sales Order..." : "Creating Sales Order..."}
            </p>
            <p className="text-sm text-gray-500">Please wait while we process your request</p>
          </div>
        </div>
      )}

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/reports/sales-order-list')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? `Edit Sales Order` : "Create Sales Order"}
              </h1>
              <p className="text-gray-600">
                {isEditMode
                  ? `Update sales order ${editSoNumber}`
                  : "Create a new sales order"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            <CalendarIcon className="h-4 w-4 mr-1" />
            {new Date().toLocaleDateString('en-GB')}
          </Badge>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 min-h-0">
          <div className=" mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information - Compact */}
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4 mb-4 min-w-0">
                  <div className="flex items-center gap-2 shrink-0 min-w-[140px]">
                    <ShoppingCart className="h-4 w-4 text-gray-600" />
                    <Label className="text-2xl font-semibold">Basic Information</Label>
                  </div>
                  <div className="flex-1 min-w-0 max-w-xl">
                    <div className="flex items-end gap-2">
                      <div className="shrink-0">
                        <Label
                          htmlFor="date"
                          className="text-sm font-medium text-gray-700 mb-2 block"
                        >
                          Order Date *
                        </Label>
                        <Input
                          id="date"
                          type="date"
                          tabIndex={-1}
                          aria-disabled="true"
                          value={formData.date}
                          readOnly
                          onChange={(e) => handleInputChange("date", e.target.value)}
                          className={`h-10 w-[140px] sm:w-[150px] ${
                            errors.date ? "border-red-500" : ""
                          } pointer-events-none`}
                        />
                      </div>
                      {soVoiceRemarksEnabled && (
                        <Button
                          type="button"
                          tabIndex={-1}
                          variant={isRecordingVoice ? "destructive" : "outline"}
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          disabled={isUploadingVoice || isSubmitting}
                          onClick={handleVoiceMicClick}
                          title={
                            isUploadingVoice
                              ? "Uploading voice note..."
                              : isRecordingVoice
                                ? "Stop recording"
                                : "Record voice remark"
                          }
                          aria-label={
                            isRecordingVoice ? "Stop voice recording" : "Start voice recording"
                          }
                        >
                          {isUploadingVoice ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isRecordingVoice ? (
                            <Square className="h-4 w-4 fill-current" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor="branch_id"
                          className="text-sm font-medium text-gray-700 mb-2 block"
                        >
                          Branch *
                        </Label>
                        <Popover
                          open={branchDropdownOpen}
                          onOpenChange={(open) => {
                            setBranchDropdownOpen(open);
                            if (open) headerFieldOpenedRef.current.branch = true;
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              ref={branchTriggerRef}
                              variant="outline"
                              role="combobox"
                              aria-expanded={branchDropdownOpen}
                              className={`h-10 w-full min-w-0 justify-between gap-2 overflow-hidden ${errors.branch_id ? "border-red-500" : ""}`}
                              onKeyDown={(e) => handleHeaderComboboxTab("branch", e)}
                            >
                              <span
                                className="min-w-0 flex-1 truncate text-left"
                                title={
                                  formData.branch_id
                                    ? branchesData?.find(
                                      (b) => String(b.id) === String(formData.branch_id)
                                    )?.name
                                    : undefined
                                }
                              >
                                {formData.branch_id
                                  ? branchesData?.find(
                                    (b) => String(b.id) === String(formData.branch_id)
                                  )?.name || "Select branch"
                                  : "Select branch"}
                              </span>
                              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="end" side="bottom" sideOffset={4}>
                            <Command>
                              <CommandInput
                                placeholder="Search branches..."
                                onKeyDown={(e) => handleHeaderComboboxTab("branch", e)}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {branchesLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Loading branches...
                                    </div>
                                  ) : (
                                    "No branches found."
                                  )}
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    {branchesData?.map((branch) => (
                                      <CommandItem
                                        key={branch.id}
                                        value={branch.name}
                                        onSelect={() => {
                                          handleInputChange('branch_id', branch.id);
                                          markHeaderSelected("branch");
                                          setBranchDropdownOpen(false);
                                          window.requestAnimationFrame(() => branchTriggerRef.current?.focus());
                                        }}
                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Check
                                            className={`h-4 w-4 ${String(formData.branch_id) === String(branch.id)
                                                ? "opacity-100 text-blue-600"
                                                : "opacity-0"
                                              }`}
                                          />
                                          <div className="flex-1">
                                            <div className="font-medium text-gray-900">{branch.name}</div>
                                            {branch.city && branch.state && (
                                              <div className="text-sm text-gray-500">{branch.city}, {branch.state}</div>
                                            )}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    {errors.date && (
                      <p className="text-red-500 text-sm mt-1 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.date}
                      </p>
                    )}
                    {soVoiceRemarksEnabled && isRecordingVoice && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                        Recording… tap stop to upload in background
                      </p>
                    )}
                    {soVoiceRemarksEnabled && isUploadingVoice && !isRecordingVoice && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading voice note… you can continue filling the form
                      </p>
                    )}
                    {soVoiceRemarksEnabled && voiceRemarksUrl && !isRecordingVoice && !isUploadingVoice && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-green-700">
                        <span className="truncate">Voice note attached</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={clearVoiceRemarks}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    {errors.branch_id && (
                      <p className="text-red-500 text-sm mt-1 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.branch_id}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Single Row: Ledger Groups, Customer, Broker, Due Date, Order Number */}
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    {/* Ledger Groups */}
                    <div className="w-full sm:w-[200px]">
                      <Label htmlFor="ledger_group_id" className="text-sm font-medium text-gray-700">Ledger Group</Label>
                      <Popover open={ledgerGroupDropdownOpen} onOpenChange={(open) => {
                        setLedgerGroupDropdownOpen(open);
                        if (open) headerFieldOpenedRef.current.ledger = true;
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            ref={ledgerGroupTriggerRef}
                            variant="outline"
                            role="combobox"
                            aria-expanded={ledgerGroupDropdownOpen}
                            className="w-full justify-between mt-2"
                            onKeyDown={(e) => handleHeaderComboboxTab("ledger", e)}
                          >
                            {selectedLedgerGroupId
                              ? ledgerGroups.find((lg) => lg.id === selectedLedgerGroupId)?.name || "Select ledger group"
                              : "All Groups"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0 z-50"
                          align="start"
                          side="bottom"
                          sideOffset={4}
                        >
                          <Command>
                            <CommandInput
                              placeholder="Search ledger groups..."
                              value={ledgerGroupSearchTerm}
                              onValueChange={setLedgerGroupSearchTerm}
                              onKeyDown={(e) => handleHeaderComboboxTab("ledger", e)}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {ledgerGroups.length === 0 ? (
                                  "No ledger groups found."
                                ) : (
                                  "No ledger groups match your search."
                                )}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea
                                  className="h-64"
                                  onScroll={(e) => {
                                    const target = e.currentTarget;
                                    if (
                                      target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                                      hasNextLedgerGroupPage &&
                                      !isFetchingNextLedgerGroupPage
                                    ) {
                                      fetchNextLedgerGroupPage();
                                    }
                                  }}
                                >
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setSelectedLedgerGroupId(null);
                                      setFormData(prev => ({ ...prev, customer_id: "" }));
                                      setSelectedCustomerMeta(null);
                                      markHeaderSelected("ledger");
                                      setLedgerGroupDropdownOpen(false);
                                      window.requestAnimationFrame(() => ledgerGroupTriggerRef.current?.focus());
                                    }}
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Check
                                        className={`h-4 w-4 ${selectedLedgerGroupId === null ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                      />
                                      <div>
                                        <div className="font-medium text-gray-900">All Groups</div>
                                      </div>
                                    </div>
                                  </CommandItem>
                                  {ledgerGroups.map((ledgerGroup) => (
                                    <CommandItem
                                      key={ledgerGroup.id}
                                      value={ledgerGroup.name}
                                      onSelect={() => {
                                        setSelectedLedgerGroupId(ledgerGroup.id);
                                        setFormData(prev => ({ ...prev, customer_id: "" }));
                                        setSelectedCustomerMeta(null);
                                        markHeaderSelected("ledger");
                                        setLedgerGroupDropdownOpen(false);
                                        window.requestAnimationFrame(() => ledgerGroupTriggerRef.current?.focus());
                                      }}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${selectedLedgerGroupId === ledgerGroup.id ? "opacity-100 text-blue-600" : "opacity-0"
                                            }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">{ledgerGroup.name}</div>
                                          {ledgerGroup.parent && (
                                            <div className="text-sm text-gray-500">{ledgerGroup.parent}</div>
                                          )}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                  {isFetchingNextLedgerGroupPage && (
                                    <div className="p-2 text-center text-sm">Loading more...</div>
                                  )}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Customer */}
                    <div className="flex-[1.4] min-w-0 sm:min-w-[280px]">
                      <Label htmlFor="customer_id">Customer *</Label>
                      <Popover
                        open={customerDropdownOpen}
                        onOpenChange={(open) => {
                          setCustomerDropdownOpen(open);
                          if (open) headerFieldOpenedRef.current.customer = true;
                          if (!open) setCustomerSearchTerm("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            ref={customerTriggerRef}
                            variant="outline"
                            role="combobox"
                            aria-expanded={customerDropdownOpen}
                            className={`w-full justify-between text-left h-auto min-h-10 py-2 whitespace-normal ${errors.customer_id ? "border-red-500" : ""}`}
                            onKeyDown={(e) => handleHeaderComboboxTab("customer", e)}
                          >
                            <span className="flex-1 min-w-0 break-words pr-2">
                              {formData.customer_id
                                ? (
                                  (customers || []).find(
                                    (c) => String(c.id) === String(formData.customer_id)
                                  )?.name ||
                                  (String(selectedCustomerMeta?.id) === String(formData.customer_id)
                                    ? selectedCustomerMeta.name
                                    : "") ||
                                  "Select Customer"
                                )
                                : "Select Customer"}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] min-w-[320px] p-0 z-50"
                          align="start"
                          side="bottom"
                          sideOffset={4}
                        >
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search customers..."
                              value={customerSearchTerm}
                              onValueChange={setCustomerSearchTerm}
                              onKeyDown={(e) => handleHeaderComboboxTab("customer", e)}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {(customersLoading || customersFetching) ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Loading customers...
                                  </div>
                                ) : (
                                  "No customers found."
                                )}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-64">
                                  {(customers || []).map((customer) => (
                                    <CommandItem
                                      key={customer.id}
                                      value={customer.name}
                                      onSelect={() => {
                                        handleInputChange('customer_id', customer.id.toString());
                                        // Auto-fill address if available and not empty
                                        if (customer.address && customer.address.trim() !== '') {
                                          handleInputChange('address', customer.address);
                                        }
                                        markHeaderSelected("customer");
                                        setCustomerDropdownOpen(false);
                                        setSelectedCustomerMeta({
                                          id: customer.id.toString(),
                                          name: customer.name || "",
                                        });
                                        // Reset previous SO data when customer changes so popup can show for new customer
                                        setPreviousSOData(null);
                                        setIsPreviousSOPopupOpen(false);
                                        setPreviousSOPopupDismissedForCustomerId(null);
                                        setCustomerSearchTerm("");
                                        window.requestAnimationFrame(() => customerTriggerRef.current?.focus());
                                      }}
                                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${formData.customer_id === customer.id.toString() ? "opacity-100 text-blue-600" : "opacity-0"
                                            }`}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">{customer.name}</div>
                                          {customer.parent && (
                                            <div className="text-sm text-gray-500">{customer.parent}</div>
                                          )}
                                        </div>
                                      </div>
                                      {customer.state && (
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                          {customer.state}
                                        </Badge>
                                      )}
                                    </CommandItem>
                                  ))}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {errors.customer_id && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.customer_id}
                        </p>
                      )}
                    </div>

                    {/* Broker */}
                    <div className="w-full sm:w-[180px]">
                      <Label htmlFor="broker">Broker</Label>
                      <Popover open={brokerDropdownOpen} onOpenChange={(open) => {
                        setBrokerDropdownOpen(open);
                        if (open) {
                          headerFieldOpenedRef.current.broker = true;
                          setBrokerListHighlight(0);
                          window.requestAnimationFrame(() => brokerSearchInputRef.current?.focus());
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <button
                            ref={brokerTriggerRef}
                            type="button"
                            className="w-full border rounded px-3 py-2 text-left flex items-center justify-between"
                            onKeyDown={(e) => handleHeaderComboboxTab("broker", e)}
                          >
                            <span>
                              {(() => {
                                const selectedBroker = brokers.find(broker => broker.id.toString() === formData.broker_id?.toString());
                                return selectedBroker?.name || "Select Broker";
                              })()}
                            </span>
                            <ChevronsUpDown className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[300px] p-2"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Input
                              ref={brokerSearchInputRef}
                              placeholder="Search brokers..."
                              value={brokerSearchTerm}
                              onChange={(e) => {
                                e.preventDefault();
                                setBrokerSearchTerm(e.target.value);
                                setBrokerListHighlight(0);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={handleBrokerListKeyDown}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              tabIndex={-1}
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsBrokerDialogOpen(true);
                              }}
                              className="h-9 w-9 p-0"
                              title="Add New Broker"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div
                            className="max-h-48 overflow-y-auto"
                            onWheel={(e) => e.stopPropagation()}
                            onKeyDown={handleBrokerListKeyDown}
                          >
                            {brokersLoading ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                Loading brokers...
                              </div>
                            ) : getFilteredBrokers().length > 0 ? (
                              getFilteredBrokers().map((broker, optionIndex) => {
                                const isHighlighted = (brokerListHighlight ?? 0) === optionIndex;
                                return (
                                  <button
                                    key={broker.id}
                                    type="button"
                                    data-broker-option={optionIndex}
                                    tabIndex={-1}
                                    className={`w-full text-left px-2 py-1 rounded text-sm ${isHighlighted ? "bg-gray-100" : "hover:bg-gray-100"
                                      }`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      selectBrokerFromList(broker);
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onMouseEnter={() => setBrokerListHighlight(optionIndex)}
                                  >
                                    {broker.name}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                No brokers found
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Due Date */}
                    <div className="w-full sm:w-[150px]">
                      <Label htmlFor="due_date">Due Date</Label>
                      <Popover open={isDueDatePickerOpen} onOpenChange={setIsDueDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            ref={dueDateRef}
                            id="due_date"
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-9 w-full justify-start text-left font-normal text-sm px-2.5",
                              errors.due_date ? "border-red-500" : ""
                            )}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowDown" && !isDueDatePickerOpen) {
                                e.preventDefault();
                                setIsDueDatePickerOpen(true);
                                return;
                              }
                              if (e.key !== "Tab" || e.shiftKey) return;
                              e.preventDefault();
                              setIsDueDatePickerOpen(false);
                              focusHeaderField("item", { open: true });
                            }}
                          >
                            <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0 text-gray-500" />
                            <span className="truncate text-xs sm:text-sm">
                              {formData.due_date
                                ? format(
                                  new Date(formData.due_date),
                                  isMobile ? "dd/MM/yy" : "dd-MM-yyyy"
                                )
                                : format(new Date(), isMobile ? "dd/MM/yy" : "dd-MM-yyyy")}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={
                              formData.due_date ? new Date(formData.due_date) : undefined
                            }
                            onSelect={(date) => {
                              if (!date) return;
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const selected = new Date(date);
                              selected.setHours(0, 0, 0, 0);
                              if (!isEditMode && selected < today) {
                                toast({
                                  title: "Invalid Date",
                                  description: "Due date cannot be earlier than today",
                                  variant: "destructive",
                                });
                                return;
                              }
                              handleInputChange("due_date", format(date, "yyyy-MM-dd"));
                              setIsDueDatePickerOpen(false);
                            }}
                            disabled={
                              isEditMode
                                ? undefined
                                : { before: new Date(new Date().setHours(0, 0, 0, 0)) }
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {errors.due_date && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.due_date}
                        </p>
                      )}
                    </div>

                    {/* Order Number */}
                    <div className="w-full sm:w-[150px]">
                      <Label htmlFor="order_number">Order Number</Label>
                      <Input
                        id="order_number"
                        value={formData.order_number || ""}
                        maxLength={15}
                        placeholder="Order Number"
                        className="h-9"
                        onChange={(e) =>
                          handleInputChange(
                            "order_number",
                            e.target.value.slice(0, 15)
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Second Row: Delivery Address */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-6">
                      {isEditingAddress ? (
                        <div className="space-y-2">
                          <Label htmlFor="address">Delivery Address</Label>
                          <div className="flex items-start gap-2">
                            <Textarea
                              id="address"
                              value={tempAddress}
                              onChange={(e) => setTempAddress(e.target.value)}
                              placeholder="Enter delivery address"
                              rows={3}
                              className="flex-1"
                            />
                            <div className="flex flex-col gap-2 pt-0.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  handleInputChange('address', tempAddress);
                                  setIsEditingAddress(false);
                                }}
                                className="h-8 w-8 p-0"
                                title="Save"
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTempAddress(formData.address);
                                  setIsEditingAddress(false);
                                }}
                                className="h-8 w-8 p-0"
                                title="Cancel"
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <Label className="text-sm font-medium text-gray-700 min-w-[140px] pt-2">Delivery Address:  {formData.address || <span className="text-gray-400 italic">No address available</span>}</Label>
                          <div className="flex-1 flex items-start gap-2">
                            <p className="text-sm text-gray-900 leading-relaxed flex-1">

                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTempAddress(formData.address);
                                setIsEditingAddress(true);
                              }}
                              className="h-8 w-8 p-0 flex-shrink-0"
                              title="Edit address"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items - Table Format */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Package className="h-5 w-5" />
                      <span>Order Items ({formData.items.length})</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addItem()}
                      className="flex items-center space-x-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Item</span>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[400px]">Item</TableHead>
                          <TableHead className="min-w-[160px] w-[160px] text-center">Quantity</TableHead>
                          <TableHead className="w-[120px] text-center">Price</TableHead>
                          <TableHead className="w-[100px] text-center">UOM</TableHead>
                          <TableHead className="w-[100px] text-center">GST %</TableHead>
                          <TableHead className="w-[120px] text-right">Total</TableHead>
                          <TableHead className="w-[80px] text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.items.map((item, index) => {
                          // Calculate total for this item - use base_unit_price_for_calc
                          const itemTotal = (parseFloat(item.quantity || 0) * parseFloat(item.base_unit_price_for_calc || 0));

                          return (
                            <TableRow
                              key={index}
                              data-item-row={index}
                              className="hover:bg-gray-50"
                              onKeyDown={(e) => handleItemRowKeyDown(index, e)}
                              onBlur={(e) => handleItemRowBlur(index, e)}
                            >
                              <TableCell className="p-2">
                                <Popover open={isDropdownOpen(index)} onOpenChange={(open) => handleDropdownOpenChange(index, open)}>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      data-item-trigger="true"
                                      className={`w-full border rounded px-3 py-2 text-left flex items-center justify-between h-9 ${errors[`item_${index}_item_id`] ? "border-red-500" : ""}`}
                                      onKeyDown={(e) => handleItemTriggerKeyDown(index, e)}
                                    >
                                      <span className="truncate text-sm">
                                        {(() => {
                                          const selectedItem = getStockItemById(item.item_id);
                                          return selectedItem?.name || "Select Item";
                                        })()}
                                      </span>
                                      <ChevronsUpDown className="h-4 w-4 flex-shrink-0 ml-2" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    data-item-popover={index}
                                    className="w-[390px] p-2"
                                    onOpenAutoFocus={(e) => {
                                      e.preventDefault();
                                      window.requestAnimationFrame(() => {
                                        itemSearchInputRefs.current[index]?.focus?.();
                                      });
                                    }}
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                  >
                                    <Input
                                      ref={(node) => {
                                        if (node) itemSearchInputRefs.current[index] = node;
                                        else delete itemSearchInputRefs.current[index];
                                      }}
                                      placeholder="Search stock items..."
                                      value={getItemSearchTerm(index)}
                                      onChange={(e) => {
                                        e.preventDefault();
                                        handleItemSearch(index, e.target.value);
                                        itemListHighlightByRowRef.current = {
                                          ...itemListHighlightByRowRef.current,
                                          [index]: 0,
                                        };
                                        setItemListHighlightByRow((prev) => ({ ...prev, [index]: 0 }));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => handleItemListKeyDown(index, e)}
                                      className="mb-2"
                                    />
                                    <div
                                      data-item-list-scroll="true"
                                      className="max-h-48 overflow-y-auto overscroll-contain"
                                      onWheel={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => handleItemListKeyDown(index, e)}
                                    >
                                      {stockItemsLoading ? (
                                        <div className="p-2 text-center text-sm text-muted-foreground">
                                          Loading items...
                                        </div>
                                      ) : getFilteredStockItems(index).length > 0 ? (
                                        <>
                                          {getFilteredStockItems(index).map((stockItem, optionIndex) => {
                                            // Safely get closing balance with proper error handling
                                            let closingBalance = 0;
                                            try {
                                              if (stockItem.closing_balance !== undefined && stockItem.closing_balance !== null) {
                                                const parsed = parseFloat(stockItem.closing_balance);
                                                closingBalance = isNaN(parsed) ? 0 : parsed;
                                              }
                                            } catch (error) {
                                              closingBalance = 0;
                                            }

                                            // Format balance safely with error handling
                                            let formattedBalance = '0';
                                            try {
                                              formattedBalance = closingBalance.toLocaleString('en-IN', {
                                                maximumFractionDigits: 2,
                                                minimumFractionDigits: 0
                                              });
                                            } catch (error) {
                                              // Fallback to simple string conversion if locale formatting fails
                                              formattedBalance = closingBalance.toString();
                                            }

                                            const isHighlighted = (itemListHighlightByRow[index] ?? 0) === optionIndex;

                                            return (
                                              <button
                                                key={stockItem.id}
                                                type="button"
                                                data-item-option={optionIndex}
                                                tabIndex={-1}
                                                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between ${isHighlighted
                                                    ? "bg-blue-100 text-blue-900"
                                                    : "hover:bg-gray-100"
                                                  }`}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  selectStockItemForRow(index, stockItem);
                                                }}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onMouseEnter={() => {
                                                  itemListHighlightByRowRef.current = {
                                                    ...itemListHighlightByRowRef.current,
                                                    [index]: optionIndex,
                                                  };
                                                  setItemListHighlightByRow((prev) => ({
                                                    ...prev,
                                                    [index]: optionIndex,
                                                  }));
                                                }}
                                              >
                                                <span className="flex-1 truncate pr-2">{stockItem.name}</span>
                                                <span className="text-xs text-gray-600 font-medium whitespace-nowrap ml-2">
                                                  {formattedBalance}
                                                </span>
                                              </button>
                                            );
                                          })}
                                          {hasNextStockItemsPage && (
                                            <div className="p-2 border-t border-gray-100">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="w-full"
                                                disabled={isFetchingNextStockItemsPage}
                                                onClick={() => {
                                                  if (!isFetchingNextStockItemsPage) {
                                                    fetchNextStockItemsPage();
                                                  }
                                                }}
                                              >
                                                {isFetchingNextStockItemsPage ? (
                                                  <>
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    Loading more...
                                                  </>
                                                ) : (
                                                  "Load more items"
                                                )}
                                              </Button>
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <div className="p-2 text-center text-sm text-muted-foreground">
                                          {!formData.customer_id
                                            ? "Please select a customer first"
                                            : "No stock items found"}
                                        </div>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                {errors[`item_${index}_item_id`] && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {errors[`item_${index}_item_id`]}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      data-item-qty="true"
                                      value={item.quantity && item.quantity > 0 ? Math.floor(item.quantity).toString() : ''}
                                      onChange={(e) => {
                                        const inputValue = e.target.value;
                                        if (inputValue === "" || /^\d+$/.test(inputValue)) {
                                          tryApplyQuantityInput(index, inputValue);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Tab" && !e.shiftKey) {
                                          handleQuantityTab(index, e);
                                          return;
                                        }
                                        const inputValue = e.target.value;
                                        if (/^\d$/.test(e.key)) {
                                          if (inputValue.length >= QUANTITY_MAX_DIGITS) {
                                            e.preventDefault();
                                            return;
                                          }
                                          const nextValue = inputValue + e.key;
                                          if (nextValue.length === QUANTITY_MAX_DIGITS) {
                                            e.preventDefault();
                                            setQuantityExceedDialog({
                                              open: true,
                                              itemIndex: index,
                                              pendingQuantity: nextValue,
                                            });
                                            return;
                                          }
                                        } else if (
                                          !/^\d$/.test(e.key) &&
                                          !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Enter", "Home", "End"].includes(e.key)
                                        ) {
                                          e.preventDefault();
                                        }
                                      }}
                                      onPaste={(e) => {
                                        e.preventDefault();
                                        const pastedText = e.clipboardData.getData("text").trim();
                                        if (/^\d+$/.test(pastedText) && pastedText.length <= QUANTITY_MAX_DIGITS) {
                                          tryApplyQuantityInput(index, pastedText);
                                        }
                                      }}
                                      className={`h-9 flex-1 min-w-[3.5rem] px-3 text-left ${errors[`item_${index}_quantity`] ? "border-red-500" : ""}`}
                                      placeholder="Qty"
                                    />
                                    {item.item_id && (() => {
                                      const selectedStockItem = getStockItemById(item.item_id);
                                      if (!selectedStockItem?.base_unit?.name) return null;
                                      const baseUnitName = selectedStockItem.base_unit.name;
                                      return (
                                        <span
                                          className="shrink-0 px-1.5 py-1 bg-muted border border-input rounded text-xs font-medium text-muted-foreground whitespace-nowrap max-w-[4.5rem] truncate"
                                          title={baseUnitName}
                                        >
                                          {baseUnitName}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {errors[`item_${index}_quantity`] && (
                                    <p className="text-red-500 text-xs mt-1">
                                      {errors[`item_${index}_quantity`]}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    data-item-price="true"
                                    value={item.price ? parseFloat(Number(item.price).toFixed(2)) : 0}
                                    onChange={(e) => {
                                      const newPrice = parseFloat(parseFloat(e.target.value || 0).toFixed(2));
                                      // Price will be converted to base unit in handleItemChange
                                      handleItemChange(index, 'price', newPrice);
                                    }}
                                    onKeyDown={(e) => handlePriceTab(index, e)}
                                    className={`h-9 w-full ${errors[`item_${index}_price`] ? "border-red-500" : ""}`}
                                    size="sm"
                                  />
                                  {item.item_id && (() => {
                                    const selectedStockItem = getStockItemById(item.item_id);
                                    if (!selectedStockItem) return null;

                                    const baseUnitName = selectedStockItem?.base_unit?.name || 'base';
                                    const alternateUnitName = selectedStockItem?.alternate_unit?.name || 'alternate';
                                    const baseUnitPrice = selectedStockItem?.base_unit?.price;
                                    const alternateUnitPrice = selectedStockItem?.alternate_unit?.price;


                                  })()}
                                  {errors[`item_${index}_price`] && (
                                    <p className="text-red-500 text-xs">
                                      {errors[`item_${index}_price`]}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                {item.item_id ? (
                                  (() => {
                                    const selectedStockItem = getStockItemById(item.item_id);
                                    const hasAlternateUnit = selectedStockItem?.alternate_unit?.id != null;
                                    const baseUnitName = selectedStockItem?.base_unit?.name;

                                    // No alternate unit: show base unit only as static text (no dropdown)
                                    if (!hasAlternateUnit && baseUnitName) {
                                      return (
                                        <div className="h-9 w-full flex items-center text-sm font-medium text-gray-900">
                                          {baseUnitName}
                                        </div>
                                      );
                                    }
                                    // Has alternate unit: show UOM dropdown
                                    const units = [];
                                    const unitIds = new Set();
                                    if (selectedStockItem?.base_unit?.id) {
                                      units.push({ id: selectedStockItem.base_unit.id, name: selectedStockItem.base_unit.name });
                                      unitIds.add(selectedStockItem.base_unit.id);
                                    }
                                    if (selectedStockItem?.alternate_unit?.id && !unitIds.has(selectedStockItem.alternate_unit.id)) {
                                      units.push({ id: selectedStockItem.alternate_unit.id, name: selectedStockItem.alternate_unit.name });
                                    }
                                    return (
                                      <div className="space-y-1">
                                        <Select
                                          value={item.price_uom_id?.toString() || (selectedStockItem?.base_unit?.id?.toString() ?? "none")}
                                          onValueChange={(value) => {
                                            handleItemChange(index, 'price_uom_id', value === "none" ? null : parseInt(value));
                                          }}
                                        >
                                          <SelectTrigger
                                            className="h-9 w-full"
                                            data-item-uom="true"
                                            onKeyDown={(e) => handleUomTabNext(index, e)}
                                          >
                                            <SelectValue placeholder="Select UOM" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {units.length > 0 ? (
                                              units.map((unit) => (
                                                <SelectItem key={unit.id} value={unit.id.toString()}>
                                                  {unit.name}
                                                </SelectItem>
                                              ))
                                            ) : (
                                              <SelectItem value="none" disabled>No units available</SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="h-9 w-full flex items-center text-sm text-gray-400">
                                    Select item first
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  data-item-gst="true"
                                  value={item.gst_percentage !== undefined && item.gst_percentage !== null ? item.gst_percentage : 0}
                                  onChange={(e) => handleItemChange(index, 'gst_percentage', e.target.value ? parseFloat(e.target.value) : 0)}
                                  placeholder="GST %"
                                  disabled={item.gst_auto_filled || item.item_id}
                                  className={`h-9 w-full ${item.gst_auto_filled || item.item_id ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                  size="sm"
                                />
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                <div className="text-sm font-semibold text-green-600">
                                  ₹{formatINR(itemTotal)}
                                </div>
                                {/* Show calculation info */}
                                {item.item_id && item.quantity > 0 && (() => {
                                  const selectedStockItem = getStockItemById(item.item_id);
                                  if (!selectedStockItem || !selectedStockItem.alternate_unit || !selectedStockItem.conversion || selectedStockItem.conversion === 1.0) return null;

                                  const baseUnitName = selectedStockItem.base_unit?.name || 'base';
                                  const alternateUnitName = selectedStockItem.alternate_unit.name;
                                  const alternateQuantity = parseFloat(item.quantity) / parseFloat(selectedStockItem.conversion);


                                })()}
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                {formData.items.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(index)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Delete row"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {errors.items && (
                    <div className="p-4">
                      <p className="text-red-500 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.items}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <IndianRupee className="h-5 w-5" />
                    <span>Order Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total Amount:</span>
                    <span className="text-green-600">
                      ₹{formatINR(calculateTotal())}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Brokerage is calculated automatically on save.</p>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/reports/sales-order-list')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-black hover:bg-gray-800"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isEditMode ? "Update Sales Order" : "Create Sales Order"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>

      {/* Add Broker Dialog */}
      <Dialog open={isBrokerDialogOpen} onOpenChange={setIsBrokerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Broker</DialogTitle>
            <DialogDescription>
              Enter the broker name to create a new broker.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="broker-name">Broker Name *</Label>
              <Input
                id="broker-name"
                value={newBrokerName}
                onChange={(e) => setNewBrokerName(e.target.value)}
                placeholder="Enter broker name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newBrokerName.trim()) {
                      createBrokerMutation.mutate(newBrokerName.trim());
                    }
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsBrokerDialogOpen(false);
                  setNewBrokerName("");
                }}
                disabled={createBrokerMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (newBrokerName.trim()) {
                    createBrokerMutation.mutate(newBrokerName.trim());
                  } else {
                    toast({
                      title: "Validation Error",
                      description: "Please enter a broker name",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={createBrokerMutation.isPending || !newBrokerName.trim()}
              >
                {createBrokerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>

                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Previous Sales Order Popup */}
      <Dialog open={isPreviousSOPopupOpen} onOpenChange={handlePreviousSOPopupOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Previous Bill</span>
            </DialogTitle>
            <DialogDescription>
              Found a previous sales order for this customer. Would you like to load the items?
            </DialogDescription>
          </DialogHeader>

          {previousSOData && (
            <div className="space-y-4 mt-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium text-gray-700">
                  Sales Order: <span className="font-semibold">{previousSOData.so_number}</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Items: {previousSOData.items?.length || 0}
                </p>
                {previousSOData.items && previousSOData.items.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-600">Items:</p>
                    <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5">
                      {previousSOData.items.slice(0, 5).map((item, idx) => (
                        <li key={idx}>{item.item_name}</li>
                      ))}
                      {previousSOData.items.length > 5 && (
                        <li className="text-gray-400">... and {previousSOData.items.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipPreviousSO}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  onClick={handleUsePreviousSO}
                  className="bg-black hover:bg-gray-800"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Use Items
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={quantityExceedDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setQuantityExceedDialog({ open: false, itemIndex: null, pendingQuantity: null });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quantity limit</AlertDialogTitle>
            <AlertDialogDescription>
              Quantity exceeding more than 4 digits. Click OK to confirm this entry (maximum 5 digits).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleQuantityExceedConfirm}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={soSuccessOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetCreatedSoSuccessState();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sales Order Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Your Sales Order Voucher Number:</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="flex-1 font-mono text-base font-semibold text-foreground break-all">
                {createdSoNumber}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopySoNumber}
                title="Copy sales order number"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-nowrap items-center gap-2 pt-2">
              <Button
                type="button"
                className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                disabled={!createdSoNumber || isDownloadingPdf}
                onClick={handleDownloadCreatedSoPdf}
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin shrink-0" />
                    <span className="truncate">Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <span className="truncate">Download</span>
                  </>
                )}
              </Button>
              {isTallyEnabled && !createdSoTallySynced && hasPermission("sales_order", "update") && (
                <Button
                  type="button"
                  className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  disabled={!createdSoNumber || syncSalesOrderMutation.isPending}
                  onClick={openLedgerModalForCreatedSo}
                >
                  {syncSalesOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin shrink-0" />
                      <span className="truncate">Syncing...</span>
                    </>
                  ) : (
                    <span className="truncate">Sync to Tally</span>
                  )}
                </Button>
              )}
              {isTallyEnabled && createdSoTallySynced && (
                <Button
                  type="button"
                  className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                  disabled
                >
                  <span className="truncate">Synced</span>
                </Button>
              )}
              <Button
                type="button"
                className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                onClick={resetCreatedSoSuccessState}
              >
                <span className="truncate">Skip</span>
              </Button>
              <Button
                type="button"
                className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                onClick={finishSoSuccess}
              >
                <span className="truncate">Sales Orders</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLedgerDialogOpen} onOpenChange={setIsLedgerDialogOpen}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          aria-describedby="so-create-ledger-dialog-description"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Select Ledger and Voucher Type for Tally Sync</DialogTitle>
            <DialogDescription id="so-create-ledger-dialog-description">
              Select a voucher type first (required), then optionally a sales ledger. You can sync without a ledger.
              {createdSoNumber && (
                <span className="block mt-1 font-medium">Sales Order: {createdSoNumber}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-y-auto">
            <div className="space-y-2 shrink-0">
              <p className="text-sm font-medium text-gray-700">Voucher Type (required)</p>
              {!selectedVoucherType ? (
                <>
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search voucher types by name..."
                      value={voucherTypeSearchTerm}
                      onChange={(e) => setVoucherTypeSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="border rounded-lg flex-1 min-h-0 max-h-44 overflow-y-auto">
                    {isLoadingSoVoucherTypes ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Loading voucher types...</span>
                      </div>
                    ) : filteredSoVoucherTypes && filteredSoVoucherTypes.length > 0 ? (
                      <div className="divide-y">
                        {filteredSoVoucherTypes.map((voucherType) => (
                          <div
                            key={voucherType.id}
                            onClick={() => setSelectedVoucherType(voucherType)}
                            className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <p className="font-medium text-gray-900">
                              {voucherType.display_name || voucherType.name}
                            </p>
                            {voucherType.parent && (
                              <p className="text-sm text-gray-500 mt-1">
                                Parent: {voucherType.parent}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : soVoucherTypesError ? (
                      <div className="flex items-center justify-center py-8 text-red-500">
                        <span>Error loading voucher types. Please try again.</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-gray-500">
                        {voucherTypeSearchTerm
                          ? "No voucher types found matching your search"
                          : "No voucher types available"}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-900">Selected Voucher Type:</p>
                    <p className="text-green-700 font-semibold">
                      {selectedVoucherType.display_name || selectedVoucherType.name}
                    </p>
                    {selectedVoucherType.parent && (
                      <p className="text-sm text-green-600 mt-0.5">
                        Parent: {selectedVoucherType.parent}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedVoucherType(null);
                      setVoucherTypeSearchTerm("");
                    }}
                    disabled={syncSalesOrderMutation.isPending}
                  >
                    Change Voucher Type
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 shrink-0">
              <p className="text-sm font-medium text-gray-700">Sales Ledger (optional)</p>
              {!selectedLedger ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search ledgers by name or parent..."
                      value={ledgerSearchTerm}
                      onChange={(e) => setLedgerSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="border rounded-lg max-h-44 overflow-y-auto">
                    {isLoadingSoSyncLedgers ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Loading ledgers...</span>
                      </div>
                    ) : filteredSoSyncLedgers && filteredSoSyncLedgers.length > 0 ? (
                      <div className="divide-y">
                        {filteredSoSyncLedgers.map((ledger) => (
                          <div
                            key={ledger.id}
                            onClick={() => setSelectedLedger(ledger)}
                            className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <p className="font-medium text-gray-900">{ledger.name}</p>
                            {ledger.parent && (
                              <p className="text-sm text-gray-500 mt-0.5">
                                Parent: {ledger.parent}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-center py-6 text-gray-500 text-sm">
                        {ledgerSearchTerm ? "No ledgers found" : "No ledgers available"}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Selected Ledger:</p>
                    <p className="text-blue-700 font-semibold">{selectedLedger.name}</p>
                    {selectedLedger.parent && (
                      <p className="text-sm text-blue-600 mt-0.5">
                        Parent: {selectedLedger.parent}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedLedger(null);
                      setLedgerSearchTerm("");
                    }}
                    disabled={syncSalesOrderMutation.isPending}
                  >
                    Change Ledger
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 shrink-0 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsLedgerDialogOpen(false);
                  setSelectedLedger(null);
                  setLedgerSearchTerm("");
                  setSelectedVoucherType(null);
                  setVoucherTypeSearchTerm("");
                }}
                disabled={syncSalesOrderMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSoTallySync}
                disabled={!selectedVoucherType || syncSalesOrderMutation.isPending}
                className="flex items-center gap-2"
              >
                {syncSalesOrderMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <span>Sync to Tally</span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SalesOrderItemNextStepModal
        open={showNextStepModal}
        onAddItem={handleAddItemFromModal}
        onCreateOrder={handleCreateFromModal}
        onDismiss={handleDismissNextStepModal}
        isSaving={isSubmitting || createSalesOrderMutation.isPending}
        isEdit={isEditMode}
      />
    </div>
  );
}