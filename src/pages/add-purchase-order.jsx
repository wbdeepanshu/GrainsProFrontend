import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInCalendarDays, startOfDay } from "date-fns";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatMoneyDisplay } from "@/utils/moneyUtils";

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
  ArrowLeft,
  Copy,
  CalendarIcon,
  ClipboardCheck,
  Mic,
  Square,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { isAdminSettingDisabled, isAdminSettingEnabled } from "@/lib/adminSettings";
import { apiRequest } from "@/lib/queryClient";
import { uploadPurchaseOrderVoice } from "@/lib/purchaseOrderVoiceUpload";
import { formatItemWeightWithAlternateUnit } from "@/lib/weightDisplay";
import { downloadPurchaseOrderPdf } from "@/utils/purchaseOrderPdfGenerator";
import Loader from "@/components/common/loader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const LEDGER_MODAL_PER_PAGE = 20;

function getPurchaseOrderBrokerName(order) {
  const broker = order?.broker;
  if (!broker) return null;
  if (typeof broker === "object" && broker.name) return broker.name;
  return null;
}

const QUANTITY_MAX_INTEGER_DIGITS = 5;

function getTodayDateString() {
  return format(new Date(), "yyyy-MM-dd");
}

function getTodayStart() {
  return startOfDay(new Date());
}

/** Normalize API/form dates to yyyy-MM-dd (handles dd-MM-yyyy and ISO strings). */
function normalizeToIsoDateString(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return format(parsed, "yyyy-MM-dd");
  return "";
}

function parseFormDate(value) {
  const iso = normalizeToIsoDateString(value);
  if (!iso) return undefined;
  const date = parseISO(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatFormDateDisplay(value, displayFormat = "dd-MM-yyyy") {
  const date = parseFormDate(value);
  if (!date) return "";
  return format(date, displayFormat);
}

function computeDaysFromOrderDate(orderDateStr, dueDateStr) {
  if (!orderDateStr || !dueDateStr) return null;
  try {
    const startIso = normalizeToIsoDateString(orderDateStr);
    const endIso = normalizeToIsoDateString(dueDateStr);
    if (!startIso || !endIso) return null;
    const start = parseISO(`${startIso}T00:00:00`);
    const end = parseISO(`${endIso}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const days = differenceInCalendarDays(end, start);
    return days >= 0 ? days : null;
  } catch {
    return null;
  }
}

// Form validation schema
const itemSchema = z.object({
  item_id: z.union([z.number(), z.string()]).refine((val) => {
    const num = typeof val === "string" ? parseInt(val) : val;
    return !isNaN(num) && num > 0;
  }, "Stock item is required"),
  actual_qty: z
    .string()
    .min(1, "Actual quantity is required")
    .refine(
      (val) => getQtyIntegerPartLength(val) <= QUANTITY_MAX_INTEGER_DIGITS,
      `Quantity must not exceed ${QUANTITY_MAX_INTEGER_DIGITS} digits before the decimal`
    ),
  billed_qty: z.string().optional(),
  rate: z.string().optional(),
  remarks: z.string().optional(),
  uom: z.string().optional(),
  good_quality: z.string().optional(),
  moisture: z.string().optional(),
});

const addPurchaseOrderSchema = z
  .object({
    party: z.string().min(1, "Party is required"),
    broker_id: z.string().optional(),
    reference: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    order_due_date: z.string().min(1, "Order due date is required"),
    items: z.array(itemSchema).min(1, "At least one item is required"),
  })
  .refine(
    (data) => !data.date || !data.order_due_date || data.order_due_date >= data.date,
    { message: "Order due date must be on or after the order date", path: ["order_due_date"] }
  );

function buildAddPurchaseOrderSchema(allowBackDateOrderEntry, skipBackDateValidation = false) {
  if (allowBackDateOrderEntry || skipBackDateValidation) {
    return addPurchaseOrderSchema;
  }
  return addPurchaseOrderSchema.refine(
    (data) => !data.date || data.date >= getTodayDateString(),
    { message: "Order date cannot be before today", path: ["date"] }
  );
}

// Parse numeric qty from PO item actual_qty/billed_qty string (e.g. "10.00 pkt" -> "10")
function parseQtyFromString(str) {
  if (str == null || str === "") return "";
  const s = String(str).trim();
  const match = s.match(/^(\d+\.?\d*)/);
  return match ? match[1] : s;
}

// Parse numeric rate from PO item rate string (e.g. "4050.00/qtl" -> "4050.00")
function parseRateFromString(str) {
  if (str == null || str === "") return "";
  const s = String(str).trim();
  const slashIdx = s.indexOf("/");
  const numPart = slashIdx >= 0 ? s.slice(0, slashIdx).trim() : s;
  const match = numPart.match(/^[\d.]+/);
  return match ? match[0] : numPart || "";
}

// Restrict input to digits and at most one decimal (no 'e', '-', '+', or other chars)
function allowOnlyNumeric(value) {
  if (value === "" || value == null) return "";
  const s = String(value);
  let result = "";
  let seenDecimal = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c >= "0" && c <= "9") result += c;
    else if (c === "." && !seenDecimal) { result += c; seenDecimal = true; }
  }
  return result;
}


const QUANTITY_WARN_INTEGER_DIGITS = 4;

function getQtyIntegerPartLength(value) {
  const s = allowOnlyNumeric(String(value ?? ""));
  if (!s) return 0;
  return (s.split(".")[0] || "").length;
}

function normalizeUnitName(value) {
  return String(value || "").trim().toLowerCase();
}

/** Build API item_quality string from independent Good quality / Moisture fields. */
function formatItemQualityForApi(goodQuality, moisture) {
  const parts = [];
  const good = String(goodQuality ?? "").trim();
  const moist = String(moisture ?? "").trim();
  if (good) parts.push(`Good Quality: ${good}`);
  if (moist) parts.push(`Moisture: ${moist}`);
  return parts.join(", ");
}

/** Parse stored item_quality back into form fields (edit mode). */
function parseItemQualityFields(itemQualityStr) {
  const s = String(itemQualityStr ?? "").trim();
  if (!s) return { good_quality: "", moisture: "" };

  // New API format example:
  // "{'moisture': '12%', 'good_material': '34%'}"
  // Handle JSON-like object strings first, then fallback to legacy label parsing.
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const normalizedJson = s.replace(/'/g, "\"");
      const parsed = JSON.parse(normalizedJson);
      const goodRaw =
        parsed?.good_quality ??
        parsed?.good_material ??
        parsed?.goodMaterial ??
        parsed?.good ??
        "";
      const moistRaw =
        parsed?.moisture ??
        parsed?.moisture_content ??
        parsed?.moistureContent ??
        "";
      return {
        good_quality: String(goodRaw ?? "").trim(),
        moisture: String(moistRaw ?? "").trim(),
      };
    } catch {
      // Fall through to regex parsing below.
    }
  }

  const goodLabelMatch = s.match(/Good\s+Quality:\s*([^,]+)/i);
  const moistLabelMatch = s.match(/Moisture:\s*(.+)$/i);
  if (goodLabelMatch || moistLabelMatch) {
    return {
      good_quality: goodLabelMatch ? goodLabelMatch[1].trim() : "",
      moisture: moistLabelMatch ? moistLabelMatch[1].trim() : "",
    };
  }

  // Fallback for non-JSON map-like strings that still contain keys.
  const goodKeyMatch = s.match(/(?:good_quality|good_material)\s*['"]?\s*:\s*['"]?([^,'"}]+)/i);
  const moistKeyMatch = s.match(/moisture\s*['"]?\s*:\s*['"]?([^,'"}]+)/i);
  return {
    good_quality: goodKeyMatch ? goodKeyMatch[1].trim() : "",
    moisture: moistKeyMatch ? moistKeyMatch[1].trim() : "",
  };
}

const EMPTY_ITEM_ROW = {
  item_id: "",
  actual_qty: "",
  billed_qty: "",
  rate: "",
  remarks: "",
  uom: "base",
  good_quality: "",
  moisture: "",
};

function isLineReadyForNextStep(line) {
  return (
    Boolean(line?.item_id) &&
    parseFloat(line?.actual_qty) > 0 &&
    Boolean(line?.uom || line?.base_unit)
  );
}

function PurchaseOrderItemNextStepModal({
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
            Want to Add More Items or Save The Purchase Order?
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
            className={cn(
              "w-full bg-black hover:bg-gray-800",
              activeChoice === "save" ? "ring-2 ring-offset-1 ring-gray-400" : ""
            )}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving
              ? "Saving..."
              : isEdit
                ? "Update Purchase Order"
                : "Save Purchase Order"}
          </Button>
          <Button
            ref={addButtonRef}
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onAddItem}
            onFocus={() => setActiveChoice("add")}
            className={cn(
              "w-full",
              activeChoice === "add" ? "ring-2 ring-offset-1 ring-gray-400" : ""
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AddPurchaseOrder() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(typeof searchString === "string" ? searchString : (typeof window !== "undefined" ? window.location.search : ""));
  const editId = searchParams.get("edit");
  const editIdNum = editId ? parseInt(editId, 10) : null;
  const isEditMode = !!editIdNum && !isNaN(editIdNum);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const poVoiceRemarksEnabled = !isAdminSettingDisabled("po_voice_remarks");
  const poTestingParamsEnabled = !isAdminSettingDisabled("po_testing_params");
  const allowBackDateOrderEntry = isAdminSettingEnabled("back_date_order_entry");
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

  const purchaseOrderSchema = useMemo(
    () => buildAddPurchaseOrderSchema(allowBackDateOrderEntry, isEditMode),
    [allowBackDateOrderEntry, isEditMode]
  );

  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState("");
  const [brokerDropdownOpen, setBrokerDropdownOpen] = useState(false);
  const [brokerSearchTerm, setBrokerSearchTerm] = useState("");
  const debouncedBrokerSearch = useDebounce((brokerSearchTerm || "").trim(), 300);
  const [isBrokerDialogOpen, setIsBrokerDialogOpen] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockDebounced, setStockDebounced] = useState("");
  const [stockDropdownOpenIndex, setStockDropdownOpenIndex] = useState(null);
  const [uomDropdownOpenIndex, setUomDropdownOpenIndex] = useState(null);
  // Cache selected stock item names and unit metadata by id so dropdowns still show correct info after search is cleared
  const [selectedStockLabelsByItemId, setSelectedStockLabelsByItemId] = useState({});
  const [selectedStockMetaByItemId, setSelectedStockMetaByItemId] = useState({});
  const [poSuccessOpen, setPoSuccessOpen] = useState(false);
  const [createdVoucherNumber, setCreatedVoucherNumber] = useState("");
  const [createdPurchaseOrderId, setCreatedPurchaseOrderId] = useState(null);
  const [createdPoTallySynced, setCreatedPoTallySynced] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerNameInput, setLedgerNameInput] = useState("");
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [voucherSearchTerm, setVoucherSearchTerm] = useState("");
  const [selectedVoucherType, setSelectedVoucherType] = useState("");
  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = useState("");
  const [debouncedVoucherSearch, setDebouncedVoucherSearch] = useState("purchase");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);
  const [qualityDialogIndex, setQualityDialogIndex] = useState(null);
  const [quantityExceedDialog, setQuantityExceedDialog] = useState({
    open: false,
    itemIndex: null,
    pendingQuantity: null,
  });
  const [voiceRemarksUrl, setVoiceRemarksUrl] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceRemarksUrlRef = useRef("");
  const voiceUploadPromiseRef = useRef(null);

  // Tab / keyboard navigation (same flow as create-sales-order)
  const partyTriggerRef = useRef(null);
  const remarksRef = useRef(null);
  const brokerTriggerRef = useRef(null);
  const dueDateRef = useRef(null);
  const partySearchInputRef = useRef(null);
  const brokerSearchInputRef = useRef(null);
  const itemSearchInputRefs = useRef({});
  const headerReadyForNextTabRef = useRef({ party: false, broker: false });
  const headerFieldOpenedRef = useRef({ party: false, broker: false });
  const itemReadyForNextTabRef = useRef({});
  const nextStepPromptedRef = useRef(false);
  const tabLeavingRowRef = useRef(null);
  const [partyListHighlight, setPartyListHighlight] = useState(0);
  const partyListHighlightRef = useRef(0);
  partyListHighlightRef.current = partyListHighlight;
  const [brokerListHighlight, setBrokerListHighlight] = useState(0);
  const [itemListHighlightByRow, setItemListHighlightByRow] = useState({});
  const itemListHighlightByRowRef = useRef({});
  itemListHighlightByRowRef.current = itemListHighlightByRow;
  const [showNextStepModal, setShowNextStepModal] = useState(false);
  const [pendingFocusLineIndex, setPendingFocusLineIndex] = useState(null);

  // debounce effect for stock search
  useEffect(() => {
    const t = setTimeout(() => setStockDebounced(stockSearch), 300);
    return () => clearTimeout(t);
  }, [stockSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLedgerSearch(ledgerSearchTerm), 400);
    return () => clearTimeout(t);
  }, [ledgerSearchTerm]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedVoucherSearch(voucherSearchTerm.trim() || "purchase");
    }, 400);
    return () => clearTimeout(t);
  }, [voucherSearchTerm]);

  useEffect(() => {
    setLedgerPage(1);
  }, [debouncedLedgerSearch]);

  const form = useForm({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      party: "",
      broker_id: "",
      reference: "",
      date: format(new Date(), 'yyyy-MM-dd'),
      order_due_date: getTodayDateString(),
      items: [{ ...EMPTY_ITEM_ROW }],
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items"
  });

  // Fetch parties (ledgers) - like Role dropdown in user-list
  const fetchParties = async () => {
    const params = new URLSearchParams();
    params.append('per_page', '300');
    params.append('is_supplier', 'true');

    const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch parties');
    }

    const data = await response.json();
    return data.data || [];
  };

  const {
    data: parties,
    isLoading: partiesLoading,
  } = useQuery({
    queryKey: ['supplier-parties'],
    queryFn: fetchParties,
    enabled: !!AuthService.getAccessToken() && (partyDropdownOpen || (isEditMode && !!editIdNum)),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!partyDropdownOpen) return;
    window.requestAnimationFrame(() => partySearchInputRef.current?.focus());
  }, [partyDropdownOpen]);

  // Client-side party search (same approach as the broker dropdown)
  const filteredParties = (() => {
    const list = parties || [];
    const term = (partySearchTerm || "").trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (party) =>
        party.name?.toLowerCase().includes(term) ||
        party.parent?.toLowerCase().includes(term)
    );
  })();

  const { data: brokersData, isLoading: brokersLoading, refetch: refetchBrokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/report/broker/`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const brokers = brokersData?.data || [];

  const createBrokerMutation = useMutation({
    mutationFn: async (brokerName) => {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/report/broker/`, {
        name: brokerName,
        contact_number: "",
        commission_rate: 0,
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
        refetchBrokers();
        if (data.data?.id) {
          form.setValue("broker_id", String(data.data.id));
          headerFieldOpenedRef.current.broker = true;
          headerReadyForNextTabRef.current.broker = true;
        }
        setIsBrokerDialogOpen(false);
        setNewBrokerName("");
        setBrokerDropdownOpen(false);
        window.requestAnimationFrame(() => brokerTriggerRef.current?.focus());
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
  const watchedBrokerId = form.watch("broker_id");

  const getFilteredBrokers = () => {
    if (!debouncedBrokerSearch) return brokers;
    return brokers.filter((broker) =>
      broker.name?.toLowerCase().includes(debouncedBrokerSearch.toLowerCase())
    );
  };

  useEffect(() => {
    if (isEditMode) return;
    if (brokers.length > 0 && !form.getValues("broker_id")) {
      const directSalesBroker = brokers.find(
        (broker) => broker.name && broker.name.toLowerCase().trim() === "direct sales"
      );
      if (directSalesBroker) {
        form.setValue("broker_id", String(directSalesBroker.id));
      }
    }
  }, [brokers, isEditMode, form]);

  // Fetch purchase order detail when in edit mode
  const { data: editPoData, isLoading: editPoLoading } = useQuery({
    queryKey: ["purchase-order-detail", editIdNum],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/report/purchase-orders/${editIdNum}/`);
      const json = await res.json();
      if (json.status !== 200 || !json.data) throw new Error(json.message || "Failed to load purchase order");
      return json.data;
    },
    enabled: isEditMode && !!AuthService.getAccessToken(),
  });

  // Prefill form when edit data is loaded
  const prefillDone = useRef(false);
  useEffect(() => {
    if (!isEditMode || !editPoData || prefillDone.current) return;
    if (editPoData.is_tally_synced) {
      toast({ title: "Cannot edit", description: "This purchase order is already synced to Tally.", variant: "destructive" });
      window.history.back();
      return;
    }
    if (editPoData.is_editable === false) {
      toast({ title: "Cannot edit", description: "This purchase order has an inward entry and cannot be edited.", variant: "destructive" });
      window.history.back();
      return;
    }
    const effectiveDate = normalizeToIsoDateString(editPoData.effective_date) || format(new Date(), "yyyy-MM-dd");
    const orderDueDate =
      normalizeToIsoDateString(editPoData.order_due_date) || getTodayDateString();
    const items = (editPoData.purchase_items || []).map((it) => {
      const rateVal = it.rate ?? it.unit_rate ?? it.unit_price;
      const remarksVal = it.remarks ?? it.remark ?? "";
      const uomVal = (it.uom || it.item_unit || "").toString().trim().toLowerCase();
      const baseUnitVal = normalizeUnitName(it.item_unit || it.base_unit || it.base_units_name);
      const alternateUnitVal = normalizeUnitName(it.alternate_unit || it.secondary_unit || it.secondary_units_name);
      let uom = "base";
      if (uomVal === "alternate" || uomVal === "alternate_unit") uom = "alternate";
      else if (uomVal === "base" || uomVal === "base_unit") uom = "base";
      else if (baseUnitVal && uomVal === baseUnitVal) uom = "base";
      else if (alternateUnitVal && uomVal === alternateUnitVal) uom = "alternate";
      else if (it.uom || it.item_unit) {
        const unitStr = String(it.uom || it.item_unit).trim();
        if (unitStr) uom = unitStr;
      }
      const qualityFields = parseItemQualityFields(it.item_quality);
      return {
        item_id: String(it.item_id ?? (typeof it.stock_item === "object" && it.stock_item?.id) ?? ""),
        actual_qty: parseQtyFromString(it.actual_qty) || (it.qty != null ? String(it.qty) : ""),
        billed_qty: parseQtyFromString(it.billed_qty) || (it.qty != null ? String(it.qty) : ""),
        rate: parseRateFromString(rateVal),
        remarks: typeof remarksVal === "string" ? remarksVal : String(remarksVal ?? ""),
        uom,
        good_quality: qualityFields.good_quality,
        moisture: qualityFields.moisture,
      };
    });
    if (items.length === 0) items.push({ ...EMPTY_ITEM_ROW });
    const prefillStockLabels = {};
    const prefillStockMeta = {};
    (editPoData.purchase_items || []).forEach((it) => {
      const itemId = String(it.item_id ?? (typeof it.stock_item === "object" ? it.stock_item?.id : ""));
      if (!itemId) return;
      const stockName =
        typeof it.stock_item === "string"
          ? it.stock_item
          : (it.stock_item?.name ?? it.item_name ?? it.product_name ?? "");
      const baseName = it.item_unit || it.base_unit || it.base_units_name || "";
      const altName = it.alternate_unit || it.secondary_unit || it.secondary_units_name || "";
      prefillStockLabels[itemId] = stockName;
      prefillStockMeta[itemId] = {
        baseName,
        altName,
        conversion: it.conversion,
      };
    });
    setSelectedStockLabelsByItemId((prev) => ({ ...prev, ...prefillStockLabels }));
    setSelectedStockMetaByItemId((prev) => ({ ...prev, ...prefillStockMeta }));
    setVoiceRemarks(editPoData.voice_remarks || "");
    const brokerId =
      editPoData.broker?.id != null
        ? String(editPoData.broker.id)
        : editPoData.broker_id != null
          ? String(editPoData.broker_id)
          : "";

    form.reset({
      party: editPoData.party || "",
      broker_id: brokerId,
      reference: editPoData.reference || "",
      date: effectiveDate,
      order_due_date: orderDueDate,
      items,
    });
    prefillDone.current = true;
  }, [isEditMode, editPoData, form, toast]);

  useEffect(() => {
    if (!isEditMode) prefillDone.current = false;
  }, [isEditMode]);

  // Fetch stock items mapped as PO Material (item_grouping filter)
  const fetchStockItemsList = async ({ pageParam = 1, queryKey }) => {
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

    const response = await apiRequest(
      "POST",
      `${API_BASE_URL}/api/stock-items-list/`,
      requestBody
    );

    const data = await response.json();

    if (data.status && Number(data.status) >= 400) {
      throw new Error(data.message || "Failed to fetch stock items");
    }

    return {
      results: data.data || [],
      nextPage: data.pagination?.has_next ? pageParam + 1 : undefined,
    };
  };

  const {
    data: stockPages,
    fetchNextPage: fetchNextStockPage,
    hasNextPage: hasNextStockPage,
    isFetchingNextPage: fetchingMoreStock,
    isLoading: stockLoading,
  } = useInfiniteQuery({
    queryKey: ["/api/stock-items-list", "PO Material", stockDebounced],
    queryFn: fetchStockItemsList,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken(),
  });

  const stockOptions = stockPages?.pages?.flatMap((page) => page.results) ?? [];

  const getPurchaseOrderItemAmount = (itemIndex) => {
    const qtyBase = parseFloat(form.watch(`items.${itemIndex}.actual_qty`));
    const rateVal = parseFloat(form.watch(`items.${itemIndex}.rate`));
    const uomVal = form.watch(`items.${itemIndex}.uom`);
    const itemId = form.watch(`items.${itemIndex}.item_id`);
    if (!Number.isFinite(rateVal) || rateVal < 0) return null;

    const selectedStock = stockOptions.find((stock) => stock.id.toString() === String(itemId));
    const cachedMeta = selectedStockMetaByItemId[String(itemId)] || {};
    const editItem = isEditMode && editPoData?.purchase_items?.[itemIndex];
    const baseUnitName = normalizeUnitName(
      selectedStock?.base_units_name ||
      selectedStock?.base_unit_name ||
      selectedStock?.base_unit?.name ||
      selectedStock?.base_units?.name ||
      cachedMeta.baseName ||
      editItem?.item_unit
    );
    const uomStr = normalizeUnitName(uomVal);
    const isBaseUom =
      uomStr === "base" ||
      uomStr === "base_unit" ||
      (!!baseUnitName && uomStr === baseUnitName);
    const conversionFromStock = parseFloat(selectedStock?.conversion ?? cachedMeta.conversion ?? 0) || 0;
    const conversionFromEdit = editItem?.conversion != null ? parseFloat(editItem.conversion) : NaN;
    const editItemWeight = parseFloat(parseQtyFromString(editItem?.item_weight));
    const editItemQty = parseFloat(parseQtyFromString(editItem?.actual_qty));
    const conversionFromWeight =
      Number.isFinite(editItemWeight) && Number.isFinite(editItemQty) && editItemQty > 0
        ? editItemWeight / editItemQty
        : NaN;
    const conversion = Number.isFinite(conversionFromEdit) && conversionFromEdit > 0
      ? conversionFromEdit
      : (conversionFromStock > 0 ? conversionFromStock : conversionFromWeight);
    const qtyForCalc = !isBaseUom && conversion > 0
      ? qtyBase * conversion
      : qtyBase;

    return Number.isFinite(qtyForCalc) && qtyForCalc >= 0
      ? rateVal * qtyForCalc
      : null;
  };
  const purchaseOrderTotal = itemFields.reduce(
    (total, _, itemIndex) => total + (getPurchaseOrderItemAmount(itemIndex) ?? 0),
    0
  );

  // Purchase ledgers for Tally sync (same as purchaseorders-reports)
  const { data: tallyPurchaseLedgersResponse, isLoading: isLoadingPurchaseLedgers } = useQuery({
    queryKey: [
      `${API_BASE_URL}/api/report/get-ledgers/`,
      "tally-purchase-ledgers-add-po",
      debouncedLedgerSearch,
      ledgerPage,
      isLedgerModalOpen,
    ],
    queryFn: async () => {
      const search = debouncedLedgerSearch.trim() || "purchase";
      const params = new URLSearchParams({
        search,
        page: String(ledgerPage),
        per_page: String(LEDGER_MODAL_PER_PAGE),
        is_active: "true",
      });
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`
      );
      const responseData = await response.json();
      return {
        data: responseData.data || [],
        pagination: responseData.pagination || {},
      };
    },
    enabled: !!AuthService.getAccessToken() && isLedgerModalOpen,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
  const tallyPurchaseLedgersData = tallyPurchaseLedgersResponse?.data || [];
  const tallyPurchaseLedgersPagination = tallyPurchaseLedgersResponse?.pagination || {};

  const { data: voucherTypesResponse, isLoading: isLoadingVoucherTypes } = useQuery({
    queryKey: ["voucher-types-add-po", debouncedVoucherSearch, isLedgerModalOpen],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedVoucherSearch || "purchase",
      });
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/get-voucher-types/?${params.toString()}`
      );
      const json = await response.json();
      if (response.ok && json.data) return json.data;
      return [];
    },
    enabled: !!AuthService.getAccessToken() && isLedgerModalOpen,
  });
  const voucherTypesList = Array.isArray(voucherTypesResponse) ? voucherTypesResponse : [];

  const syncToTallyMutation = useMutation({
    mutationFn: async ({ purchase_order_id, item_ledger_name, voucher_type, godown_name }) => {
      const payload = {
        purchase_order_id:
          typeof purchase_order_id === "number"
            ? purchase_order_id
            : parseInt(purchase_order_id, 10),
        item_ledger_name: (item_ledger_name || "").trim(),
      };
      if (voucher_type && String(voucher_type).trim()) {
        payload.voucher_type = String(voucher_type).trim();
      }
      if (godown_name && String(godown_name).trim()) {
        payload.godown_name = String(godown_name).trim();
      }
      const headers = { ...AuthService.getAuthHeaders(), "Content-Type": "application/json" };
      const response = await fetch(`${API_BASE_URL}/api/sync-purchase-order-to-tally/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, ...data };
    },
    onSuccess: (result) => {
      if (result.ok && result.status === 200) {
        setCreatedPoTallySynced(true);
        setIsLedgerModalOpen(false);
        setLedgerNameInput("");
        setLedgerSearchTerm("");
        setLedgerPage(1);
        setVoucherSearchTerm("");
        setSelectedVoucherType("");
        toast({
          title: "Success",
          variant: "success",
          description: result.message || "Synced to Tally successfully",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || result.error || "Sync to Tally failed.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error?.message || "Sync to Tally failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/create-purchase-order/`, data);
      const responseData = await response.json();
      return { status: response.status, ...responseData };
    },
    onSuccess: (data) => {
      if (data.status === 200 || data.status === 201) {
        const voucherNo = data.data?.voucher_number || "";
        const poId =
          data.data?.id ??
          data.data?.purchase_order_id ??
          data.data?.purchase_order?.id ??
          null;
        if (!editIdNum && voucherNo) {
          setCreatedVoucherNumber(voucherNo);
          setCreatedPurchaseOrderId(poId != null ? Number(poId) : null);
          setCreatedPoTallySynced(Boolean(data.data?.is_tally_synced));
          setPoSuccessOpen(true);
        } else {
          toast({
            title: "✅ Success",
            description: data.data?.tally_message || data.message || (editIdNum ? "Purchase order updated successfully" : "Purchase Order Created Successfully"),
            className: "bg-green-50 border-green-100 text-green-800",
          });
          if (!editIdNum && !voucherNo) {
            form.reset({
              party: "",
              broker_id: "",
              reference: "",
              date: format(new Date(), "yyyy-MM-dd"),
              order_due_date: getTodayDateString(),
              items: [{ ...EMPTY_ITEM_ROW }],
            });
            setSelectedStockLabelsByItemId({});
            setSelectedStockMetaByItemId({});
            clearVoiceRemarks();
            window.scrollTo({ top: 0, behavior: "smooth" });
            window.location.href = "/reports/purchaseorders-reports";
          }
        }
        if (editIdNum) {
          setSelectedStockLabelsByItemId({});
          setSelectedStockMetaByItemId({});
          clearVoiceRemarks();
          window.scrollTo({ top: 0, behavior: "smooth" });
          window.location.href = "/reports/purchaseorders-reports";
        }

      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create purchase order",
          variant: "destructive",
        });
      }

    },
    onError: (error) => {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });

  const closeAllHeaderDropdowns = useCallback(() => {
    setPartyDropdownOpen(false);
    setBrokerDropdownOpen(false);
    setIsDatePickerOpen(false);
    setIsDueDatePickerOpen(false);
  }, []);

  const focusHeaderField = useCallback(
    (field, { open = true } = {}) => {
      closeAllHeaderDropdowns();
      window.requestAnimationFrame(() => {
        if (field === "party") {
          if (open && !isEditMode) {
            headerFieldOpenedRef.current.party = true;
            partyListHighlightRef.current = 0;
            setPartyListHighlight(0);
            setPartyDropdownOpen(true);
            window.requestAnimationFrame(() => partySearchInputRef.current?.focus());
          } else {
            partyTriggerRef.current?.focus();
          }
          return;
        }
        if (field === "remarks") {
          remarksRef.current?.focus();
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
    },
    [closeAllHeaderDropdowns, isEditMode]
  );

  const markHeaderSelected = useCallback((field) => {
    headerFieldOpenedRef.current[field] = true;
    headerReadyForNextTabRef.current[field] = true;
  }, []);

  const handleHeaderComboboxTab = useCallback(
    (field, event) => {
      const openMap = {
        party: partyDropdownOpen,
        broker: brokerDropdownOpen,
      };
      const setOpenMap = {
        party: setPartyDropdownOpen,
        broker: setBrokerDropdownOpen,
      };
      const nextMap = {
        party: "remarks",
        remarks: "broker",
        broker: "dueDate",
      };
      const prevMap = {
        remarks: "party",
        broker: "remarks",
        dueDate: "broker",
      };

      if (event.key === "ArrowDown") {
        if (!openMap[field]) {
          event.preventDefault();
          if (field === "party" && isEditMode) return;
          headerFieldOpenedRef.current[field] = true;
          setOpenMap[field](true);
          if (field === "party") {
            partyListHighlightRef.current = 0;
            setPartyListHighlight(0);
            window.requestAnimationFrame(() => partySearchInputRef.current?.focus());
          }
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

      if (!isOpen && !readyForNext) {
        if (field === "party" && isEditMode) {
          focusHeaderField("remarks", { open: false });
          return;
        }
        headerFieldOpenedRef.current[field] = true;
        setOpenMap[field](true);
        if (field === "party") {
          partyListHighlightRef.current = 0;
          setPartyListHighlight(0);
          window.requestAnimationFrame(() => partySearchInputRef.current?.focus());
        }
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
      if (next === "remarks" || next === "dueDate") {
        focusHeaderField(next, { open: false });
      } else if (next) {
        focusHeaderField(next, { open: true });
      }
    },
    [partyDropdownOpen, brokerDropdownOpen, focusHeaderField, isEditMode]
  );

  const handleRemarksKeyDown = (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    if (event.shiftKey) {
      focusHeaderField("party", { open: false });
      return;
    }
    focusHeaderField("broker", { open: true });
  };

  const selectPartyFromList = (party, onChange) => {
    if (!party) return;
    if (typeof onChange === "function") {
      onChange(party.name);
    } else {
      form.setValue("party", party.name, { shouldValidate: true, shouldDirty: true });
    }
    markHeaderSelected("party");
    setPartyDropdownOpen(false);
    setPartySearchTerm("");
    window.requestAnimationFrame(() => partyTriggerRef.current?.focus());
  };

  const handlePartyListKeyDown = (event, onChange) => {
    const options = filteredParties || [];

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (options.length === 0) return;
      const current = partyListHighlightRef.current ?? 0;
      const next = Math.min(current + 1, options.length - 1);
      partyListHighlightRef.current = next;
      setPartyListHighlight(next);
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-party-option="${next}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (options.length === 0) return;
      const current = partyListHighlightRef.current ?? 0;
      const next = Math.max(current - 1, 0);
      partyListHighlightRef.current = next;
      setPartyListHighlight(next);
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-party-option="${next}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const party = options[partyListHighlightRef.current ?? 0];
      if (party) selectPartyFromList(party, onChange);
      return;
    }

    if (event.key === "Tab" && !event.shiftKey) {
      handleHeaderComboboxTab("party", event);
    }
  };

  const selectBrokerFromList = (broker) => {
    if (!broker) return;
    form.setValue("broker_id", String(broker.id));
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

    if (event.key === "Tab" && !event.shiftKey) {
      handleHeaderComboboxTab("broker", event);
    }
  };

  const focusItemRowField = useCallback((index, field) => {
    window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-item-row="${index}"]`);
      if (!row) return;
      if (field === "item") {
        itemListHighlightByRowRef.current = {
          ...itemListHighlightByRowRef.current,
          [index]: 0,
        };
        setItemListHighlightByRow((prev) => ({ ...prev, [index]: 0 }));
        setStockDropdownOpenIndex(index);
        window.requestAnimationFrame(() => {
          itemSearchInputRefs.current[index]?.focus?.();
        });
        return;
      }
      if (field === "quantity") {
        row.querySelector('[data-item-qty="true"]')?.focus?.();
        return;
      }
      if (field === "rate") {
        row.querySelector('[data-item-rate="true"]')?.focus?.();
        return;
      }
      if (field === "uom") {
        setUomDropdownOpenIndex(index);
        window.requestAnimationFrame(() => {
          row.querySelector('[data-item-uom="true"]')?.focus?.();
        });
      }
    });
  }, []);

  const openStockDropdown = useCallback((index) => {
    itemListHighlightByRowRef.current = {
      ...itemListHighlightByRowRef.current,
      [index]: 0,
    };
    setItemListHighlightByRow((prev) => ({ ...prev, [index]: 0 }));
    setStockDropdownOpenIndex(index);
    window.requestAnimationFrame(() => {
      itemSearchInputRefs.current[index]?.focus?.();
    });
  }, []);

  const selectStockItemForRow = (index, stockItem, onChange) => {
    if (!stockItem) return;
    const id =
      stockItem.id != null
        ? typeof stockItem.id === "number"
          ? stockItem.id
          : parseInt(stockItem.id, 10)
        : "";
    if (typeof onChange === "function") {
      onChange(id);
    } else {
      form.setValue(`items.${index}.item_id`, id, { shouldValidate: true, shouldDirty: true });
    }
    setSelectedStockLabelsByItemId((prev) => ({
      ...prev,
      [String(id)]: stockItem.name ?? "",
    }));
    setSelectedStockMetaByItemId((prev) => ({
      ...prev,
      [String(id)]: {
        baseName: stockItem.base_units_name || stockItem.base_unit?.name || "",
        altName: stockItem.secondary_unit || stockItem.alternate_units?.name || "",
        conversion: stockItem.conversion,
      },
    }));
    itemReadyForNextTabRef.current[index] = true;
    setStockDropdownOpenIndex(null);
    setStockSearch("");
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-item-row="${index}"] [data-item-trigger="true"]`)
        ?.focus?.();
    });
  };

  const moveItemListHighlight = (index, direction) => {
    const options = stockOptions || [];
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
    window.requestAnimationFrame(() => {
      const popover = document.querySelector(`[data-item-popover="${index}"]`);
      const option =
        popover?.querySelector(`[data-item-option="${next}"]`) ||
        document.querySelector(`[data-item-option="${next}"]`);
      option?.scrollIntoView({ block: "nearest", inline: "nearest" });
      // Infinite scroll: near end, load more
      if (
        direction === "down" &&
        next >= options.length - 3 &&
        hasNextStockPage &&
        !fetchingMoreStock
      ) {
        fetchNextStockPage();
      }
    });
  };

  const handleItemListKeyDown = (index, event, onChange) => {
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
      const options = stockOptions || [];
      if (options.length === 0) return;
      const highlight = itemListHighlightByRowRef.current[index] ?? 0;
      selectStockItemForRow(index, options[highlight], onChange);
      return;
    }
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      setStockDropdownOpenIndex(null);
      setStockSearch("");
      if (watchedItems?.[index]?.item_id || itemReadyForNextTabRef.current[index]) {
        itemReadyForNextTabRef.current[index] = false;
        focusItemRowField(index, "quantity");
      } else {
        document
          .querySelector(`[data-item-row="${index}"] [data-item-trigger="true"]`)
          ?.focus?.();
      }
    }
  };

  // Prevent page scroll from arrow keys while a stock dropdown is open
  useEffect(() => {
    if (stockDropdownOpenIndex === null) return;
    const onKeyDownCapture = (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDownCapture, true);
    return () => window.removeEventListener("keydown", onKeyDownCapture, true);
  }, [stockDropdownOpenIndex]);

  // Land on page: focus Party so first Tab can open it
  useEffect(() => {
    if (isEditMode || isLoading || partiesLoading) return;
    const id = window.requestAnimationFrame(() => {
      partyTriggerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isEditMode, isLoading, partiesLoading]);

  // After "Add item", open the new row's stock dropdown
  useEffect(() => {
    if (pendingFocusLineIndex === null) return;
    const index = pendingFocusLineIndex;
    setPendingFocusLineIndex(null);
    window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-item-row="${index}"]`);
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      openStockDropdown(index);
    });
  }, [pendingFocusLineIndex, openStockDropdown]);

  const watchedItems = form.watch("items");

  const shouldShowNextStepModal = (index) => {
    if (isEditMode) return false;
    if (index !== (watchedItems?.length ?? 0) - 1) return false;
    return isLineReadyForNextStep(watchedItems?.[index]);
  };

  const tryShowNextStepModal = (index) => {
    if (isEditMode || showNextStepModal || nextStepPromptedRef.current) return;
    if (!shouldShowNextStepModal(index)) return;
    nextStepPromptedRef.current = true;
    setShowNextStepModal(true);
  };

  const handleUomTabNext = (index, event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    if (index !== (watchedItems?.length ?? 0) - 1) return;
    if (!isLineReadyForNextStep(watchedItems?.[index])) return;
    event.preventDefault();
    event.stopPropagation();
    tryShowNextStepModal(index);
  };

  const handleQuantityTab = (index, event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    focusItemRowField(index, "rate");
  };

  const handleRateTab = (index, event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    focusItemRowField(index, "uom");
  };

  const handleItemTriggerKeyDown = (index, event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
      if (stockDropdownOpenIndex !== index) {
        if (event.key === "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        openStockDropdown(index);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") {
        const options = stockOptions || [];
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
    const readyForNext =
      itemReadyForNextTabRef.current[index] || Boolean(watchedItems?.[index]?.item_id);
    if (stockDropdownOpenIndex !== index && !readyForNext) {
      openStockDropdown(index);
      return;
    }
    itemReadyForNextTabRef.current[index] = false;
    setStockDropdownOpenIndex(null);
    setStockSearch("");
    focusItemRowField(index, "quantity");
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

    if (index === (watchedItems?.length ?? 0) - 1 && isLineReadyForNextStep(watchedItems?.[index])) {
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
    const lastIndex = (watchedItems?.length ?? 0) - 1;
    if (shouldShowNextStepModal(lastIndex)) {
      nextStepPromptedRef.current = true;
      setShowNextStepModal(true);
      return true;
    }
    return false;
  };

  const addNewItem = ({ focusNew = false } = {}) => {
    const newIndex = itemFields.length;
    appendItem({ ...EMPTY_ITEM_ROW });
    if (focusNew) {
      nextStepPromptedRef.current = false;
      setPendingFocusLineIndex(newIndex);
    }
  };

  const handleAddItemFromModal = () => {
    handleDismissNextStepModal();
    addNewItem({ focusNew: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const setPoItemQuantity = (itemIndex, value) => {
    form.setValue(`items.${itemIndex}.actual_qty`, value, { shouldValidate: true, shouldDirty: true });
    form.setValue(`items.${itemIndex}.billed_qty`, value, { shouldDirty: true });
  };

  const tryApplyPoQuantityInput = (itemIndex, rawValue) => {
    const val = allowOnlyNumeric(rawValue);
    if (val === "") {
      setPoItemQuantity(itemIndex, "");
      return;
    }
    const intLen = getQtyIntegerPartLength(val);
    if (intLen > QUANTITY_MAX_INTEGER_DIGITS) return;
    if (intLen === QUANTITY_MAX_INTEGER_DIGITS) {
      setQuantityExceedDialog({
        open: true,
        itemIndex,
        pendingQuantity: val,
      });
      return;
    }
    setPoItemQuantity(itemIndex, val);
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

  const startBackgroundVoiceUpload = (blob) => {
    setIsUploadingVoice(true);
    const uploadPromise = uploadPurchaseOrderVoice(blob)
      .then((url) => {
        setVoiceRemarks(url);
        toast({
          title: "Voice note saved",
          description: "It will be sent with the purchase order when you save.",
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
        description: "Stop the recording before saving the purchase order.",
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

      recorder.onstop = async () => {
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

  const handleQuantityExceedConfirm = () => {
    const { itemIndex, pendingQuantity } = quantityExceedDialog;
    if (itemIndex !== null && pendingQuantity != null) {
      const val = allowOnlyNumeric(String(pendingQuantity));
      if (val && getQtyIntegerPartLength(val) <= QUANTITY_MAX_INTEGER_DIGITS) {
        setPoItemQuantity(itemIndex, val);
      }
    }
    setQuantityExceedDialog({ open: false, itemIndex: null, pendingQuantity: null });
  };

  const submitPurchaseOrder = async (data) => {
    try {
      const voiceReady = await waitForVoiceUploadIfNeeded();
      if (!voiceReady) return;

      // Transform data to ensure correct types
      const orderDueDate = data.order_due_date;
      if (!orderDueDate) {
        toast({ title: "Validation Error", description: "Order due date is required.", variant: "destructive" });
        return;
      }
      const transformedData = {
        party: data.party,
        reference: data.reference || "",
        ...(poVoiceRemarksEnabled
          ? { voice_remarks: voiceRemarksUrlRef.current || voiceRemarksUrl || "" }
          : {}),
        date: data.date,
        order_due_date: orderDueDate,
        ...(data.broker_id ? { broker_id: parseInt(data.broker_id, 10) } : {}),
        ...(isEditMode && editIdNum ? { purchase_order_id: editIdNum } : {}),
        items: data.items.map(item => {
          const qty = parseFloat(item.actual_qty);
          const payload = {
            item_id: typeof item.item_id === "string" ? parseInt(item.item_id) : item.item_id,
            actual_qty: qty,
            billed_qty: qty,
            rate: item.rate !== "" && !isNaN(parseFloat(item.rate)) ? parseFloat(item.rate) : null,
            remarks: item.remarks || "",
          };
          if (item.uom && String(item.uom).trim()) payload.uom = item.uom; // "base" | "alternate" | unit name
          if (poTestingParamsEnabled) {
            const itemQuality = formatItemQualityForApi(item.good_quality, item.moisture);
            if (itemQuality) payload.item_quality = itemQuality;
          }
          return payload;
        })
      };

      await submitMutation.mutateAsync(transformedData);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const onSubmit = async (data) => {
    if (!isEditMode && maybeShowNextStepModal()) return;
    await submitPurchaseOrder(data);
  };

  const handleCreateFromModal = async () => {
    setShowNextStepModal(false);
    const isValid = await form.trigger();
    if (!isValid) {
      handleDismissNextStepModal();
      return;
    }
    await submitPurchaseOrder(form.getValues());
  };

  if (isLoading || permissionsLoading || (isEditMode && editPoLoading)) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="flex-1 flex items-center justify-center">
          <Loader />
        </div>
      </div>
    );
  }

  const canCreate = hasPermission("purchase_order", "create");
  const canUpdate = hasPermission("purchase_order", "update");
  if (!canCreate && !(isEditMode && canUpdate)) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
            <FileText className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">You don't have permission to {isEditMode ? "edit" : "create"} purchase orders.</p>
            <Button onClick={() => window.history.back()} variant="outline">Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  const watchedDate = form.watch("date");
  const watchedOrderDueDate = form.watch("order_due_date");
  const dueDaysFromOrder = computeDaysFromOrderDate(watchedDate, watchedOrderDueDate);

  const resetCreatedPoSuccessState = () => {
    setPoSuccessOpen(false);
    setCreatedVoucherNumber("");
    setCreatedPurchaseOrderId(null);
    setCreatedPoTallySynced(false);
    form.reset({
      party: "",
      broker_id: "",
      reference: "",
      date: format(new Date(), "yyyy-MM-dd"),
      order_due_date: getTodayDateString(),
      items: [{ ...EMPTY_ITEM_ROW }],
    });
    setSelectedStockLabelsByItemId({});
    setSelectedStockMetaByItemId({});
    clearVoiceRemarks();
  };

  const handleCopyVoucher = async () => {
    if (!createdVoucherNumber) return;
    try {
      await navigator.clipboard.writeText(createdVoucherNumber);
      toast({ title: "Copied", description: "Voucher number copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  const fetchCreatedPurchaseOrderDetail = async (poId) => {
    const res = await apiRequest("GET", `${API_BASE_URL}/api/report/purchase-orders/${poId}/`);
    const json = await res.json();
    if (!res.ok || !json.data) {
      throw new Error(json.message || "Failed to load purchase order details");
    }
    return json.data;
  };

  const handleDownloadPurchaseOrderPdf = async (entryDetail) => {
    if (!entryDetail) return;
    try {
      await downloadPurchaseOrderPdf(entryDetail, { userData });
    } catch (err) {
      console.error("Failed to generate purchase order PDF:", err);
      toast({
        title: "Error",
        description: "Unable to download PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCreatedPoPdf = async () => {
    if (!createdPurchaseOrderId) {
      toast({
        title: "Error",
        description: "Purchase order id not available for PDF download.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const detail = await fetchCreatedPurchaseOrderDetail(createdPurchaseOrderId);
      await handleDownloadPurchaseOrderPdf(detail);
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

  const openLedgerModalForCreatedPo = () => {
    if (!createdPurchaseOrderId) {
      toast({
        title: "Error",
        description: "Purchase order id not available for Tally sync.",
        variant: "destructive",
      });
      return;
    }
    setLedgerNameInput("");
    setLedgerSearchTerm("");
    setLedgerPage(1);
    setVoucherSearchTerm("");
    setSelectedVoucherType("");
    setIsLedgerModalOpen(true);
  };

  const handleConfirmLedgerSync = () => {
    if (!createdPurchaseOrderId) return;
    const trimmed = (ledgerNameInput || "").trim();
    syncToTallyMutation.mutate({
      purchase_order_id: createdPurchaseOrderId,
      item_ledger_name: trimmed || undefined,
      voucher_type: selectedVoucherType || undefined,
    });
  };

  const finishPoSuccess = () => {
    resetCreatedPoSuccessState();
    window.location.href = "/reports/purchaseorders-reports";
  };

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? "Edit Purchase Order" : "Add Purchase Order"}</h1>
              <p className="text-gray-600">{isEditMode ? "Update purchase order" : "Create New Purchase Order"}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            <Calendar className="h-4 w-4 mr-1" />

            {new Date().toLocaleDateString('en-GB')}
          </Badge>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4 min-h-0">
          <div className="max-w-7xl mx-auto">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              {/* Basic Information */}
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <FileText className="h-4 w-4" />
                    <span>Basic Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4">
                    <div className="sm:col-span-2 xl:col-span-3 min-w-0">
                      <Label htmlFor="party">Party (Supplier)</Label>
                      <Controller
                        name="party"
                        control={form.control}
                        render={({ field }) => (
                          <Popover
                            open={partyDropdownOpen}
                            onOpenChange={(open) => {
                              if (isEditMode) return;
                              setPartyDropdownOpen(open);
                              if (open) {
                                setPartyListHighlight(0);
                                partyListHighlightRef.current = 0;
                                window.requestAnimationFrame(() =>
                                  partySearchInputRef.current?.focus()
                                );
                              } else {
                                setPartySearchTerm("");
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                ref={partyTriggerRef}
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={partyDropdownOpen}
                                disabled={isEditMode}
                                onKeyDown={(e) => handleHeaderComboboxTab("party", e)}
                                className={`w-full justify-between text-left min-h-[2.75rem] ${form.formState.errors.party ? "border-red-500" : ""} ${isEditMode ? "cursor-not-allowed opacity-100" : ""}`}
                              >
                                <span className="truncate flex-1 text-left min-w-0">
                                  {field.value
                                    ? (parties?.find((p) => p.name === field.value)?.name || field.value)
                                    : "Select Party"}
                                </span>
                                {!isEditMode && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[max(20rem,var(--radix-popover-trigger-width))] max-w-[min(32rem,95vw)] p-2 z-50"
                              align="start"
                              side="bottom"
                              sideOffset={4}
                              onOpenAutoFocus={(e) => e.preventDefault()}
                              onCloseAutoFocus={(e) => e.preventDefault()}
                            >
                              <Input
                                ref={partySearchInputRef}
                                placeholder="Search parties..."
                                value={partySearchTerm}
                                onChange={(e) => {
                                  e.preventDefault();
                                  setPartySearchTerm(e.target.value);
                                  partyListHighlightRef.current = 0;
                                  setPartyListHighlight(0);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => handlePartyListKeyDown(e, field.onChange)}
                                className="mb-2"
                              />
                              <div
                                className="max-h-64 overflow-y-auto"
                                onWheel={(e) => e.stopPropagation()}
                                onKeyDown={(e) => handlePartyListKeyDown(e, field.onChange)}
                              >
                                {partiesLoading ? (
                                  <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading Parties...
                                  </div>
                                ) : filteredParties.length > 0 ? (
                                  filteredParties.map((party, optionIndex) => {
                                    const isHighlighted = (partyListHighlight ?? 0) === optionIndex;
                                    const isSelected = field.value === party.name;
                                    return (
                                      <button
                                        key={party.id}
                                        type="button"
                                        data-party-option={optionIndex}
                                        tabIndex={-1}
                                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-start gap-3 ${
                                          isHighlighted ? "bg-gray-100" : "hover:bg-gray-50"
                                        }`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          selectPartyFromList(party, field.onChange);
                                        }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onMouseEnter={() => {
                                          partyListHighlightRef.current = optionIndex;
                                          setPartyListHighlight(optionIndex);
                                        }}
                                      >
                                        <Check
                                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                                            isSelected ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium text-gray-900 leading-snug">
                                            {party.name}
                                          </div>
                                          {party.parent && (
                                            <div className="text-sm text-gray-500">{party.parent}</div>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="p-2 text-center text-sm text-muted-foreground">
                                    No parties found.
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {form.formState.errors.party && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.party.message}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 xl:col-span-2">
                      <Label htmlFor="reference">Remarks</Label>
                      <Input
                        id="reference"
                        placeholder="Enter Remarks..."
                        {...(() => {
                          const { ref: registerRef, ...rest } = form.register("reference");
                          return {
                            ...rest,
                            ref: (node) => {
                              remarksRef.current = node;
                              if (typeof registerRef === "function") registerRef(node);
                            },
                          };
                        })()}
                        onKeyDown={handleRemarksKeyDown}
                      />
                      {form.formState.errors.reference && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.reference.message}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 xl:col-span-2">
                      <Label htmlFor="broker">Broker</Label>
                      <Popover
                        open={brokerDropdownOpen}
                        onOpenChange={(open) => {
                          setBrokerDropdownOpen(open);
                          if (open) {
                            setBrokerListHighlight(0);
                            window.requestAnimationFrame(() =>
                              brokerSearchInputRef.current?.focus()
                            );
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            ref={brokerTriggerRef}
                            type="button"
                            variant="outline"
                            className="w-full justify-between text-left min-h-[2.75rem]"
                            onKeyDown={(e) => handleHeaderComboboxTab("broker", e)}
                          >
                            <span className="truncate">
                              {(() => {
                                const selectedBroker = brokers.find(
                                  (b) => String(b.id) === String(watchedBrokerId)
                                );
                                return selectedBroker?.name || "Select Broker";
                              })()}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[300px] p-2"
                          align="start"
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
                              title="Add new broker"
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
                                  className={`w-full text-left px-2 py-1 rounded text-sm ${
                                    isHighlighted ? "bg-gray-100" : "hover:bg-gray-100"
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
                                No Brokers Found
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="min-w-0 xl:col-span-2">
                      <Label htmlFor="date">Date</Label>
                      <Popover
                        open={isDatePickerOpen}
                        onOpenChange={setIsDatePickerOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            id="date"
                            type="button"
                            variant="outline"
                            tabIndex={-1}
                            className={`h-10 w-full justify-start text-left font-normal pointer-events-auto ${form.formState.errors.date ? "border-red-500" : ""}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {form.watch("date")
                                ? formatFormDateDisplay(form.watch("date"))
                                : "Select date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            key={`po-date-${form.watch("date") || "null"}`}
                            mode="single"
                            selected={parseFormDate(form.watch("date"))}
                            defaultMonth={parseFormDate(form.watch("date")) || getTodayStart()}
                            disabled={allowBackDateOrderEntry ? undefined : { before: getTodayStart() }}
                            onSelect={(date) => {
                              if (!date) return;
                              const newDate = format(date, "yyyy-MM-dd");
                              form.setValue("date", newDate, { shouldValidate: true });
                              const currentDue = form.getValues("order_due_date");
                              const today = getTodayDateString();
                              const minDue = newDate > today ? newDate : today;
                              if (currentDue && currentDue < minDue) {
                                form.setValue("order_due_date", minDue, { shouldValidate: true });
                              }
                              setIsDatePickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {form.formState.errors.date && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.date.message}
                        </p>
                      )}
                    </div>

                    <div className={`min-w-0 ${poVoiceRemarksEnabled ? "xl:col-span-2" : "xl:col-span-3"}`}>
                      <Label htmlFor="order_due_date">Order Due Date</Label>
                      <Popover
                        open={isDueDatePickerOpen}
                        onOpenChange={setIsDueDatePickerOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            ref={dueDateRef}
                            id="order_due_date"
                            type="button"
                            variant="outline"
                            className={`h-10 w-full min-w-[9.5rem] justify-start text-left font-normal ${form.formState.errors.order_due_date ? "border-red-500" : ""}`}
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
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {watchedOrderDueDate
                                ? formatFormDateDisplay(watchedOrderDueDate)
                                : "Select due date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            key={`po-due-date-${watchedOrderDueDate || "null"}`}
                            mode="single"
                            selected={parseFormDate(watchedOrderDueDate)}
                            defaultMonth={parseFormDate(watchedOrderDueDate) || getTodayStart()}
                            disabled={{ before: getTodayStart() }}
                            onSelect={(date) => {
                              if (!date) return;
                              form.setValue("order_due_date", format(date, "yyyy-MM-dd"), { shouldValidate: true });
                              setIsDueDatePickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {dueDaysFromOrder != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {dueDaysFromOrder} {dueDaysFromOrder === 1 ? "day" : "days"} From Order Date
                        </p>
                      )}
                      {poVoiceRemarksEnabled && isRecordingVoice && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                          Recording… Tap Stop to Upload in Background
                        </p>
                      )}
                      {poVoiceRemarksEnabled && isUploadingVoice && !isRecordingVoice && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Uploading Voice Note… You Can Continue Filling the Form
                        </p>
                      )}
                      {poVoiceRemarksEnabled && voiceRemarksUrl && !isRecordingVoice && !isUploadingVoice && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-green-700">
                          <span className="truncate">Voice Note Attached</span>
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
                      {form.formState.errors.order_due_date && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.order_due_date.message}
                        </p>
                      )}
                    </div>

                    {poVoiceRemarksEnabled && (
                      <div className="xl:col-span-1 min-w-0 xl:pt-7">
                        <Label className="sr-only">Record Voice Remark</Label>
                        <Button
                          type="button"
                          tabIndex={-1}
                          variant={isRecordingVoice ? "destructive" : "outline"}
                          size="icon"
                          className="h-10 w-10"
                          disabled={isUploadingVoice || submitMutation.isPending}
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
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* GST Details */}
              {/* <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Hash className="h-5 w-5" />
                    <span>GST Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="cgst_rate">CGST Rate (%)</Label>
                      <Input
                        id="cgst_rate"
                        type="number"
                        step="0.01"
                        placeholder="Enter CGST rate"
                        {...form.register("gst_details.cgst_rate", { valueAsNumber: true })}
                      />
                      {form.formState.errors.gst_details?.cgst_rate && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.gst_details.cgst_rate.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="sgst_rate">SGST Rate (%)</Label>
                      <Input
                        id="sgst_rate"
                        type="number"
                        step="0.01"
                        placeholder="Enter SGST rate"
                        {...form.register("gst_details.sgst_rate", { valueAsNumber: true })}
                      />
                      {form.formState.errors.gst_details?.sgst_rate && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.gst_details.sgst_rate.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="igst_rate">IGST Rate (%)</Label>
                      <Input
                        id="igst_rate"
                        type="number"
                        step="0.01"
                        placeholder="Enter IGST rate"
                        {...form.register("gst_details.igst_rate", { valueAsNumber: true })}
                      />
                      {form.formState.errors.gst_details?.igst_rate && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.gst_details.igst_rate.message}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card> */}

              {/* Items */}
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4" />
                      <span>Items</span>
                    </div>
                    <Button type="button" tabIndex={-1} onClick={() => addNewItem()} size="sm" className="h-8">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="rounded-md border divide-y bg-white">
                    {/* Column headings (desktop) */}
                    <div
                      className={`hidden md:grid ${poTestingParamsEnabled ? "md:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_6rem_7.5rem_7rem_4.75rem]" : "md:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_6rem_7.5rem_7rem_2.25rem]"} gap-x-2 px-3 py-1.5 bg-muted/40 text-xs font-medium text-muted-foreground`}
                    >
                      <span>#</span>
                      <span>Stock Item</span>
                      <span>Quantity</span>
                      <span>Rate</span>
                      <span>UOM</span>
                      <span>Amount</span>
                      <span />
                    </div>

                    {itemFields.map((item, itemIndex) => (
                      <div
                        key={item.id}
                        data-item-row={itemIndex}
                        className="px-3 py-2"
                        onKeyDown={(e) => handleItemRowKeyDown(itemIndex, e)}
                        onBlur={(e) => handleItemRowBlur(itemIndex, e)}
                      >
                        <div
                          className={`grid grid-cols-2 ${poTestingParamsEnabled ? "md:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_6rem_7.5rem_7rem_4.75rem]" : "md:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_6rem_7.5rem_7rem_2.25rem]"} gap-x-2 gap-y-1.5 items-start`}
                        >
                          <span className="hidden md:flex h-9 items-center text-xs text-muted-foreground">
                            {itemIndex + 1}
                          </span>

                          <div className="col-span-2 md:col-span-1 min-w-0">
                            <Label className="md:hidden whitespace-nowrap mb-1 block text-xs">Item {itemIndex + 1} · Stock Item</Label>
                            <Controller
                              name={`items.${itemIndex}.item_id`}
                              control={form.control}
                              render={({ field }) => {
                                const editItem = isEditMode && editPoData?.purchase_items?.[itemIndex];
                                const canEditStockItem = !(isEditMode && !!editItem);
                                const apiItemName =
                                  typeof editItem?.stock_item === "string"
                                    ? editItem.stock_item
                                    : (editItem?.stock_item?.name ?? editItem?.item_name ?? editItem?.product_name);
                                const fromOptions = stockOptions.find((s) => s.id.toString() === field.value?.toString())?.name;
                                const fromCache = field.value != null && selectedStockLabelsByItemId[field.value.toString()];
                                const displayLabel =
                                  apiItemName && field.value
                                    ? apiItemName
                                    : (fromOptions ?? fromCache ?? null);
                                return (
                                  <Popover
                                    open={stockDropdownOpenIndex === itemIndex}
                                    onOpenChange={(open) => {
                                      if (!canEditStockItem) return;
                                      if (open) {
                                        openStockDropdown(itemIndex);
                                      } else {
                                        setStockDropdownOpenIndex(null);
                                        setStockSearch("");
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        data-item-trigger="true"
                                        aria-expanded={stockDropdownOpenIndex === itemIndex}
                                        disabled={!canEditStockItem}
                                        onKeyDown={(e) => handleItemTriggerKeyDown(itemIndex, e)}
                                        className={`w-full justify-between text-left h-9 ${form.formState.errors.items?.[itemIndex]?.item_id ? "border-red-500" : ""} ${!canEditStockItem ? "cursor-not-allowed opacity-100" : ""}`}
                                      >
                                        <span className="truncate">
                                          {displayLabel != null ? displayLabel : "Select Stock Item"}
                                        </span>
                                        {canEditStockItem && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      data-item-popover={itemIndex}
                                      className="w-[--radix-popover-trigger-width] p-2 z-50"
                                      align="start"
                                      side="bottom"
                                      sideOffset={4}
                                      onOpenAutoFocus={(e) => {
                                        e.preventDefault();
                                        window.requestAnimationFrame(() => {
                                          itemSearchInputRefs.current[itemIndex]?.focus?.();
                                        });
                                      }}
                                      onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                      <Input
                                        ref={(node) => {
                                          if (node) itemSearchInputRefs.current[itemIndex] = node;
                                          else delete itemSearchInputRefs.current[itemIndex];
                                        }}
                                        placeholder="Search stock items..."
                                        value={stockSearch}
                                        onChange={(e) => {
                                          e.preventDefault();
                                          setStockSearch(e.target.value);
                                          itemListHighlightByRowRef.current = {
                                            ...itemListHighlightByRowRef.current,
                                            [itemIndex]: 0,
                                          };
                                          setItemListHighlightByRow((prev) => ({
                                            ...prev,
                                            [itemIndex]: 0,
                                          }));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) =>
                                          handleItemListKeyDown(itemIndex, e, field.onChange)
                                        }
                                        className="mb-2"
                                      />
                                      <div
                                        data-item-list-scroll="true"
                                        className="max-h-60 overflow-y-auto overscroll-contain"
                                        onWheel={(e) => e.stopPropagation()}
                                        onScroll={(e) => {
                                          const target = e.currentTarget;
                                          if (
                                            target.scrollTop + target.clientHeight >=
                                              target.scrollHeight - 20 &&
                                            hasNextStockPage &&
                                            !fetchingMoreStock
                                          ) {
                                            fetchNextStockPage();
                                          }
                                        }}
                                        onKeyDown={(e) =>
                                          handleItemListKeyDown(itemIndex, e, field.onChange)
                                        }
                                      >
                                        {stockLoading ? (
                                          <div className="p-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading...
                                          </div>
                                        ) : stockOptions.length > 0 ? (
                                          <>
                                            {stockOptions.map((stock, optionIndex) => {
                                              const isHighlighted =
                                                (itemListHighlightByRow[itemIndex] ?? 0) ===
                                                optionIndex;
                                              const isSelected =
                                                field.value?.toString() === stock.id.toString();
                                              return (
                                                <button
                                                  key={stock.id}
                                                  type="button"
                                                  data-item-option={optionIndex}
                                                  tabIndex={-1}
                                                  className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-3 ${
                                                    isHighlighted
                                                      ? "bg-blue-100 text-blue-900"
                                                      : "hover:bg-gray-50"
                                                  }`}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    selectStockItemForRow(
                                                      itemIndex,
                                                      stock,
                                                      field.onChange
                                                    );
                                                  }}
                                                  onMouseDown={(e) => e.preventDefault()}
                                                  onMouseEnter={() => {
                                                    itemListHighlightByRowRef.current = {
                                                      ...itemListHighlightByRowRef.current,
                                                      [itemIndex]: optionIndex,
                                                    };
                                                    setItemListHighlightByRow((prev) => ({
                                                      ...prev,
                                                      [itemIndex]: optionIndex,
                                                    }));
                                                  }}
                                                >
                                                  <Check
                                                    className={`h-4 w-4 shrink-0 ${
                                                      isSelected
                                                        ? "opacity-100 text-blue-600"
                                                        : "opacity-0"
                                                    }`}
                                                  />
                                                  <span className="font-medium truncate">
                                                    {stock.name}
                                                  </span>
                                                </button>
                                              );
                                            })}
                                            {fetchingMoreStock && (
                                              <div className="p-2 text-center text-sm">
                                                Loading more...
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <div className="p-2 text-center text-sm text-muted-foreground">
                                            No stock items found.
                                          </div>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              }}
                            />
                            {form.formState.errors.items?.[itemIndex]?.item_id && (
                              <p className="text-red-500 text-xs mt-0.5">
                                {form.formState.errors.items[itemIndex].item_id.message}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <Label className="md:hidden whitespace-nowrap mb-1 text-xs">Quantity</Label>
                            <Controller
                              name={`items.${itemIndex}.actual_qty`}
                              control={form.control}
                              render={({ field }) => (
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Qty"
                                  className="w-full h-9"
                                  data-item-qty="true"
                                  name={field.name}
                                  ref={field.ref}
                                  onBlur={field.onBlur}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    tryApplyPoQuantityInput(itemIndex, e.target.value);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Tab" && !e.shiftKey) {
                                      handleQuantityTab(itemIndex, e);
                                      return;
                                    }
                                    const input = e.currentTarget;
                                    const start = input.selectionStart ?? input.value.length;
                                    const end = input.selectionEnd ?? input.value.length;
                                    const insertAt = (ch) =>
                                      allowOnlyNumeric(
                                        input.value.slice(0, start) + ch + input.value.slice(end)
                                      );

                                    if (/^\d$/.test(e.key)) {
                                      const nextValue = insertAt(e.key);
                                      const intLen = getQtyIntegerPartLength(nextValue);
                                      if (intLen > QUANTITY_MAX_INTEGER_DIGITS) {
                                        e.preventDefault();
                                        return;
                                      }
                                      if (intLen === QUANTITY_MAX_INTEGER_DIGITS) {
                                        e.preventDefault();
                                        setQuantityExceedDialog({
                                          open: true,
                                          itemIndex,
                                          pendingQuantity: nextValue,
                                        });
                                        return;
                                      }
                                    } else if (e.key === ".") {
                                      const nextValue = insertAt(".");
                                      if (getQtyIntegerPartLength(nextValue) > QUANTITY_MAX_INTEGER_DIGITS) {
                                        e.preventDefault();
                                      }
                                    } else if (
                                      e.key.length === 1 &&
                                      !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Enter", "Home", "End"].includes(e.key)
                                    ) {
                                      e.preventDefault();
                                    }
                                  }}
                                  onPaste={(e) => {
                                    e.preventDefault();
                                    const pastedText = e.clipboardData.getData("text").trim();
                                    if (pastedText) {
                                      tryApplyPoQuantityInput(itemIndex, pastedText);
                                    }
                                  }}
                                />
                              )}
                            />
                            {form.formState.errors.items?.[itemIndex]?.actual_qty && (
                              <p className="text-red-500 text-xs mt-0.5">
                                {form.formState.errors.items[itemIndex].actual_qty.message}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <Label className="md:hidden whitespace-nowrap mb-1 text-xs">Rate (Optional)</Label>
                            <Controller
                              name={`items.${itemIndex}.rate`}
                              control={form.control}
                              render={({ field }) => (
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Rate"
                                  className="w-full h-9"
                                  data-item-rate="true"
                                  {...field}
                                  onChange={(e) => field.onChange(allowOnlyNumeric(e.target.value))}
                                  onKeyDown={(e) => handleRateTab(itemIndex, e)}
                                />
                              )}
                            />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <Label className="md:hidden whitespace-nowrap mb-1 text-xs">UOM (Per Unit)</Label>
                            <Controller
                              name={`items.${itemIndex}.uom`}
                              control={form.control}
                              render={({ field }) => {
                                const itemId = form.watch(`items.${itemIndex}.item_id`);
                                const selectedStock = stockOptions.find((s) => s.id.toString() === String(itemId));
                                const cachedMeta = selectedStockMetaByItemId[String(itemId)] || {};
                                const baseName = selectedStock?.base_units_name || selectedStock?.base_unit?.name || cachedMeta.baseName;
                                const altName = selectedStock?.secondary_unit || selectedStock?.alternate_units?.name || cachedMeta.altName;
                                const hasAlternate = !!altName;
                                const val = field.value || "base";
                                const isCustomUnit = val && val !== "base" && val !== "alternate";
                                const displayLabel = val === "alternate" && altName ? altName : (val === "base" && baseName ? baseName : (isCustomUnit ? val : ""));
                                return (
                                  <Select
                                    value={val}
                                    open={uomDropdownOpenIndex === itemIndex}
                                    onOpenChange={(open) => {
                                      setUomDropdownOpenIndex(open ? itemIndex : null);
                                    }}
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setUomDropdownOpenIndex(null);
                                    }}
                                  >
                                    <SelectTrigger
                                      className="w-full h-9"
                                      data-item-uom="true"
                                      onKeyDown={(e) => handleUomTabNext(itemIndex, e)}
                                    >
                                      <SelectValue placeholder="Unit">{displayLabel || "Select Unit"}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {baseName && (
                                        <SelectItem value="base">{baseName}</SelectItem>
                                      )}
                                      {hasAlternate && altName && (
                                        <SelectItem value="alternate">{altName}</SelectItem>
                                      )}
                                      {isCustomUnit && (
                                        <SelectItem value={val}>{val}</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                );
                              }}
                            />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <Label className="md:hidden whitespace-nowrap mb-1 text-xs">Amount</Label>
                            <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 py-1 text-sm">
                              {(() => {
                                const amount = getPurchaseOrderItemAmount(itemIndex);
                                return amount == null ? "—" : formatMoneyDisplay(amount);
                              })()}
                            </div>
                          </div>
                          <div className="col-span-2 md:col-span-1 flex items-center justify-end gap-1 md:items-start">
                            {poTestingParamsEnabled && (() => {
                              const goodQ = form.watch(`items.${itemIndex}.good_quality`);
                              const moistQ = form.watch(`items.${itemIndex}.moisture`);
                              const hasQuality =
                                String(goodQ ?? "").trim() !== "" || String(moistQ ?? "").trim() !== "";
                              return (
                                <Button
                                  type="button"
                                  tabIndex={-1}
                                  variant="outline"
                                  size="icon"
                                  className={`h-9 w-9 shrink-0 ${hasQuality ? "border-primary text-primary" : ""}`}
                                  title="Item quality"
                                  aria-label="Item quality"
                                  onClick={() => setQualityDialogIndex(itemIndex)}
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </Button>
                              );
                            })()}
                            {itemFields.length > 1 && (
                              <Button
                                type="button"
                                tabIndex={-1}
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                title="Remove item"
                                aria-label="Remove item"
                                onClick={() => removeItem(itemIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Unit conversion hint (only renders when there is something to show) */}
                        <div className="md:pl-8 mt-0.5 empty:hidden">
                            {(() => {
                              const itemId = form.watch(`items.${itemIndex}.item_id`);
                              const qtyStr = form.watch(`items.${itemIndex}.actual_qty`);
                              const qtyBase = parseFloat(qtyStr);
                              const selectedStock = stockOptions.find((s) => s.id.toString() === String(itemId));
                              const cachedMeta = selectedStockMetaByItemId[String(itemId)] || {};
                              const editItem = isEditMode ? editPoData?.purchase_items?.[itemIndex] : null;
                              const itemWeight = editItem?.item_weight;
                              const billedQty = editItem?.billed_qty;
                              const baseName =
                                selectedStock?.base_units_name ||
                                selectedStock?.base_unit_name ||
                                selectedStock?.base_unit?.name ||
                                selectedStock?.base_units?.name ||
                                cachedMeta.baseName ||
                                editItem?.item_unit;
                              const altName =
                                selectedStock?.secondary_unit ||
                                selectedStock?.secondary_units_name ||
                                selectedStock?.alternate_units?.name ||
                                cachedMeta.altName ||
                                (editItem?.uom && editItem?.uom !== editItem?.item_unit ? editItem.uom : null);
                              const convFromStock = parseFloat(selectedStock?.conversion ?? cachedMeta.conversion ?? 0) || 0;
                              const convFromEdit = editItem?.conversion != null ? parseFloat(editItem.conversion) : NaN;
                              const conversion = Number.isFinite(convFromEdit) ? convFromEdit : convFromStock;
                              const displayAltName = altName || (editItem?.uom && editItem?.uom !== baseName ? editItem.uom : null);
                              const hasConversion = conversion > 0 && baseName && displayAltName;
                              if (!baseName) return null;
                              if (hasConversion && Number.isFinite(qtyBase) && qtyBase > 0) {
                                const qtyAlt = qtyBase * conversion;
                                return (
                                  <p className="text-xs text-muted-foreground">
                                    {qtyBase.toFixed(2)} {baseName} and {qtyAlt.toFixed(2)} {displayAltName}
                                  </p>
                                );
                              }
                              if (billedQty != null || itemWeight != null) {
                                const wDisplay = formatItemWeightWithAlternateUnit(
                                  itemWeight,
                                  editItem?.alternate_unit
                                );
                                return (
                                  <p className="text-xs text-muted-foreground">
                                    {billedQty ?? "-"} = {wDisplay ?? "-"}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end border-t pt-3 text-sm font-semibold">
                    <span>Total Amount: {formatMoneyDisplay(purchaseOrderTotal)}</span>
                  </div>
                </CardContent>
              </Card>

              {poTestingParamsEnabled && (
              <Dialog
                open={qualityDialogIndex !== null}
                onOpenChange={(open) => {
                  if (!open) setQualityDialogIndex(null);
                }}
              >
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      Item Quality
                      {qualityDialogIndex !== null ? ` (Item ${qualityDialogIndex + 1})` : ""}
                    </DialogTitle>
                  </DialogHeader>
                  {qualityDialogIndex !== null ? (
                    <div className="space-y-4 py-2">
                      <div>
                        <Label htmlFor="po-good-quality">Good Quality</Label>
                        <Input
                          id="po-good-quality"
                          placeholder="e.g. 85-95%"
                          {...form.register(`items.${qualityDialogIndex}.good_quality`)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="po-moisture">Moisture</Label>
                        <Input
                          id="po-moisture"
                          placeholder="e.g. 8-12 %"
                          {...form.register(`items.${qualityDialogIndex}.moisture`)}
                        />
                      </div>
                      {formatItemQualityForApi(
                        form.watch(`items.${qualityDialogIndex}.good_quality`),
                        form.watch(`items.${qualityDialogIndex}.moisture`)
                      ) ? (
                        <p className="text-sm text-muted-foreground">
                          Preview:{" "}
                          {formatItemQualityForApi(
                            form.watch(`items.${qualityDialogIndex}.good_quality`),
                            form.watch(`items.${qualityDialogIndex}.moisture`)
                          )}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <DialogFooter>
                    <Button type="button" onClick={() => setQualityDialogIndex(null)}>
                      Done
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-4 pb-6">
                <Button
                  type="button"
                  variant="outline"
                  tabIndex={-1}
                  onClick={() => {
                    form.reset({
                      party: "",
                      broker_id: "",
                      reference: "",
                      date: format(new Date(), "yyyy-MM-dd"),
                      order_due_date: getTodayDateString(),
                      items: [{ ...EMPTY_ITEM_ROW }],
                    });
                    setSelectedStockLabelsByItemId({});
                    setSelectedStockMetaByItemId({});
                    clearVoiceRemarks();
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={submitMutation.isPending || isRecordingVoice}
                  className="bg-black hover:bg-gray-800"
                >
                  {submitMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {isEditMode ? "Updating..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isEditMode ? "Update Purchase Order" : "Create Purchase Order"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>

      <Dialog
        open={poSuccessOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetCreatedPoSuccessState();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Your Purchase Order Voucher Number:</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="flex-1 font-mono text-base font-semibold text-foreground break-all">
                {createdVoucherNumber}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopyVoucher}
                title="Copy voucher number"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-nowrap items-center gap-2 pt-2">
              <Button
                type="button"
                className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                disabled={!createdPurchaseOrderId || isDownloadingPdf}
                onClick={handleDownloadCreatedPoPdf}
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
              {isTallyEnabled && !createdPoTallySynced && hasPermission("purchase_order", "update") && (
                <Button
                  type="button"
                  className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  disabled={!createdPurchaseOrderId || syncToTallyMutation.isPending}
                  onClick={openLedgerModalForCreatedPo}
                >
                  {syncToTallyMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin shrink-0" />
                      <span className="truncate">Syncing...</span>
                    </>
                  ) : (
                    <span className="truncate">Sync to Tally</span>
                  )}
                </Button>
              )}
              {isTallyEnabled && createdPoTallySynced && (
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
                onClick={resetCreatedPoSuccessState}
              >
                <span className="truncate">Skip</span>
              </Button>
              <Button
                type="button"
                className="flex-1 min-w-0 h-9 px-2 text-xs sm:text-sm border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                onClick={finishPoSuccess}
              >
                <span className="truncate">Purchase Orders</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ledger Name Modal for Tally Sync (same as purchaseorders-reports) */}
      <Dialog open={isLedgerModalOpen} onOpenChange={setIsLedgerModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync Purchase Order to Tally</DialogTitle>
            <DialogDescription>
              Choose voucher type and enter the purchase ledger to use while syncing this purchase order to Tally.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Voucher Type (optional)
              </Label>
              <Command className="rounded-md border border-input min-h-10 mt-1">
                <CommandInput
                  placeholder="Search voucher types (default filter: purchase)..."
                  value={voucherSearchTerm}
                  onValueChange={setVoucherSearchTerm}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingVoucherTypes ? "Loading voucher types..." : "No voucher types found."}
                  </CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-40">
                      <CommandItem
                        value="default purchase order"
                        onSelect={() => setSelectedVoucherType("")}
                        className={!selectedVoucherType ? "bg-primary/10" : ""}
                      >
                        Default (Purchase Order)
                      </CommandItem>
                      {voucherTypesList.map((v) => {
                        const value = v.name || String(v.id);
                        const isSelected = selectedVoucherType === value;
                        return (
                          <CommandItem
                            key={v.id}
                            value={`${value} ${v.parent || ""}`}
                            onSelect={() => setSelectedVoucherType(value)}
                            className={isSelected ? "bg-primary/10" : ""}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{v.name}</span>
                              {v.parent && (
                                <span className="text-xs text-gray-500">{v.parent}</span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
              {selectedVoucherType && (
                <p className="text-xs text-primary mt-1">
                  Selected:{" "}
                  {(() => {
                    const v = voucherTypesList.find(
                      (x) => (x.name || String(x.id)) === selectedVoucherType
                    );
                    return v
                      ? `${v.name}${v.parent ? ` (${v.parent})` : ""}`
                      : selectedVoucherType;
                  })()}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">
                Voucher types filtered by &quot;purchase&quot;. Leave default to use Purchase Order.
              </p>
            </div>
            <div>
              <Label htmlFor="ledger_name_add_po" className="text-sm font-medium text-gray-700">
                Purchase Ledger (optional)
              </Label>
              <Command className="rounded-md border border-input min-h-10">
                <CommandInput
                  placeholder="Search by Tally name or ledger name..."
                  value={ledgerSearchTerm}
                  onValueChange={(value) => {
                    setLedgerSearchTerm(value);
                    setLedgerNameInput(value);
                  }}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingPurchaseLedgers
                      ? "Loading ledgers..."
                      : "No ledgers found. Continue typing or enter manually."}
                  </CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-64">
                      {Array.isArray(tallyPurchaseLedgersData) &&
                        tallyPurchaseLedgersData.map((ledger) => {
                          const displayTallyName =
                            (ledger.tally_name || ledger.name || "").trim() || ledger.name;
                          const isSelected = ledgerNameInput === displayTallyName;
                          return (
                            <CommandItem
                              key={ledger.id}
                              value={`${displayTallyName} ${ledger.parent || ""}`}
                              onSelect={() => {
                                setLedgerNameInput(displayTallyName);
                                setLedgerSearchTerm(displayTallyName);
                              }}
                              className={isSelected ? "bg-primary/10" : ""}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                  {displayTallyName}
                                </span>
                                {ledger.parent && (
                                  <span className="text-xs text-gray-500">
                                    {ledger.parent}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
              {(tallyPurchaseLedgersPagination.total_pages || 0) > 1 && (
                <div className="flex items-center justify-between mt-2 text-sm">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      isLoadingPurchaseLedgers ||
                      !tallyPurchaseLedgersPagination.has_previous
                    }
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-gray-600">
                    Page {tallyPurchaseLedgersPagination.current_page || ledgerPage} of{" "}
                    {tallyPurchaseLedgersPagination.total_pages || 1}
                    {tallyPurchaseLedgersPagination.total_count != null && (
                      <> ({tallyPurchaseLedgersPagination.total_count} ledgers)</>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      isLoadingPurchaseLedgers || !tallyPurchaseLedgersPagination.has_next
                    }
                    onClick={() => setLedgerPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Ledgers show Tally name; the same Tally name is sent in the sync payload. Item names use reserved name from stock master. Godown defaults to &quot;A Main Location&quot;. Sync is without GST.
            </p>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsLedgerModalOpen(false);
                setLedgerNameInput("");
                setLedgerSearchTerm("");
                setLedgerPage(1);
                setVoucherSearchTerm("");
                setSelectedVoucherType("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmLedgerSync}
              disabled={syncToTallyMutation.isPending}
            >
              {syncToTallyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync to Tally"
              )}
            </Button>
          </div>
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
                  if (e.key === "Enter") {
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
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PurchaseOrderItemNextStepModal
        open={showNextStepModal}
        onAddItem={handleAddItemFromModal}
        onCreateOrder={handleCreateFromModal}
        onDismiss={handleDismissNextStepModal}
        isSaving={submitMutation.isPending}
        isEdit={isEditMode}
      />
    </div>
  );
}