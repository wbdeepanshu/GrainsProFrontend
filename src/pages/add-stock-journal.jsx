import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2, ArrowLeft, Menu, ChevronsUpDown, Check, Calendar as CalendarIcon } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { apiRequest } from "@/lib/queryClient";
import { AuthService } from "@/lib/auth";
import Loader from "@/components/common/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const ITEM_GROUPING_FILTER_OPTIONS = [
  "Raw Material",
  "Process Machine",
  "Finished Materials",
  "PO Material",
  "SO Material",
  "Bags/ Bardans",
];

const STOCK_BALANCE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

/** Cache key segment when destination stock items are not filtered by godown */
const DESTINATION_STOCK_ITEMS_SCOPE = "__all_godowns__";

const isDestinationStockItemScope = (listType, rowSection = "") =>
  listType === "destination" ||
  rowSection === "destination" ||
  rowSection === "destination-bardan";

const LOCKING_PERIOD_HOUR_OPTIONS = [
  { value: "12", label: "12 Hours" },
  { value: "24", label: "24 Hours" },
  { value: "36", label: "36 Hours" },
  { value: "48", label: "48 Hours" },
  { value: "72", label: "72 Hours" },
];

const formatLockingPeriodIso = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const computeLockingPeriodFromHours = (hoursValue) => {
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const endAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  return formatLockingPeriodIso(endAt);
};

const DEFAULT_DESTINATION_BATCH_NAME = "Primary Batch";

const normalizeDestinationBatchName = (batchName) => {
  const trimmed = String(batchName || "").trim();
  return trimmed || DEFAULT_DESTINATION_BATCH_NAME;
};

const sanitizeFumigationBatchSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, " ");

const formatFumigationBatchDate = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

const formatFumigationBatchTime = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}${pad(date.getMinutes())}`;
};

const getFumigationBatchUserName = () => {
  const user = AuthService.getUserData();
  const label = user?.name || user?.mobile || "User";
  return sanitizeFumigationBatchSegment(label);
};

const buildFumigationBatchName = () => {
  const now = new Date();
  return [
    "Fumigation",
    formatFumigationBatchDate(now),
    formatFumigationBatchTime(now),
    getFumigationBatchUserName(),
  ].join("/");
};

const applyStockItemMetaToLine = (line, stockItemName, selected) => ({
  ...line,
  stockItemName: String(stockItemName || "").trim(),
  stockItemId: selected?.id ?? line?.stockItemId ?? null,
  selectedClosingBalance: selected?.total_closing_balance ?? selected?.current_balance ?? "",
  selectedBaseUnit: selected?.base_units_name || "",
  selectedAltUnit: selected?.secondary_unit || "",
  selectedConversion: selected?.conversion || "",
});

const emptyLine = {
  stockItemId: null,
  stockItemName: "",
  actualQty: "",
  alternateQtyInput: "",
  qtyInputMode: "qty",
  godownName: "",
  batchName: "Primary Batch",
  selectedClosingBalance: "",
  selectedBaseUnit: "",
  selectedAltUnit: "",
  selectedConversion: "",
};

const trimDecimalText = (value, digits = 3) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toFixed(digits).replace(/\.?0+$/, "");
};

/** Dropdown row: balance count visible in list only, not in selected trigger text. */
function StockItemSelectOption({ value, label, countSuffix, className }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <div className="flex w-full min-w-0 items-center justify-between gap-2 pr-1">
        <SelectPrimitive.ItemText className="truncate">{label}</SelectPrimitive.ItemText>
        {countSuffix != null && countSuffix !== "" ? (
          <span className="shrink-0 text-xs text-muted-foreground">{countSuffix}</span>
        ) : null}
      </div>
    </SelectPrimitive.Item>
  );
}

const parseNumericQty = (value) => {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
};

/** Allow typing decimals including in-progress values like "12." or ".5" */
const DECIMAL_QTY_INPUT_PATTERN = /^-?\d*\.?\d*$/;

const normalizeQtyInputText = (value) => {
  let text = String(value ?? "").replace(/,/g, "").trim();
  if (text === "" || text === "-") return text;

  const negative = text.startsWith("-");
  text = text.replace(/-/g, "");
  const dotParts = text.split(".");
  if (dotParts.length > 2) {
    text = `${dotParts[0]}.${dotParts.slice(1).join("")}`;
  }
  return negative ? `-${text}` : text;
};

const isIncompleteDecimalQtyInput = (value) => {
  const text = String(value ?? "").trim();
  return text === "." || text === "-." || text.endsWith(".");
};

/** Store base-unit qty only (from API primary_qty or first number in full_text). */
const applyMatchedStockItemToLine = (line, matched, prefilledName) => ({
  ...line,
  stockItemName: String(matched?.name || prefilledName || "").trim(),
  stockItemId: matched?.id ?? line?.stockItemId ?? null,
  selectedClosingBalance:
    matched?.total_closing_balance ?? matched?.current_balance ?? line.selectedClosingBalance ?? "",
  selectedBaseUnit: matched?.base_units_name || line.selectedBaseUnit || "",
  selectedAltUnit: matched?.secondary_unit || line.selectedAltUnit || "",
  selectedConversion: matched?.conversion ?? line.selectedConversion ?? "",
});

const normalizeBaseQtyFromApiQty = (actualQtyObj, fallbackText = "") => {
  if (actualQtyObj != null && actualQtyObj.primary_qty != null && actualQtyObj.primary_qty !== "") {
    const primary = Number(actualQtyObj.primary_qty);
    if (Number.isFinite(primary)) {
      return trimDecimalText(primary, 3);
    }
  }
  const fromText = parseNumericQty(actualQtyObj?.full_text ?? fallbackText);
  if (Number.isFinite(fromText)) {
    return trimDecimalText(fromText, 3);
  }
  return "";
};

const getLineUnitMeta = (line) => {
  const conversion = Number(line?.selectedConversion || 0);
  const baseUnit = String(line?.selectedBaseUnit || "").trim();
  const altUnit = String(line?.selectedAltUnit || "").trim();
  const canUseWeight = conversion > 0 && !!altUnit && !!baseUnit;
  return { conversion, baseUnit, altUnit, canUseWeight };
};

const getWeightFromBase = (baseQty, conversion) => {
  if (!Number.isFinite(baseQty) || !conversion) return NaN;
  return baseQty * conversion;
};

const getBaseFromWeight = (weightQty, conversion) => {
  if (!Number.isFinite(weightQty) || !conversion) return NaN;
  return weightQty / conversion;
};

const formatDualUnitText = (qtyValue, baseUnit, altUnit, conversion) => {
  const qty = Number(qtyValue);
  if (!Number.isFinite(qty) || !baseUnit) return "";
  const baseText = `${trimDecimalText(qty, 3)} ${baseUnit}`.trim();
  const conv = Number(conversion || 0);
  if (conv > 0 && altUnit) {
    const altQty = qty * conv;
    return `${baseText} = ${trimDecimalText(altQty, 3)} ${altUnit}`.trim();
  }
  return baseText;
};

/** Normalize API/display dates to yyyy-mm-dd for <input type="date" />. */
const formatDateForInput = (dateStr) => {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
};

const formatSectionTotalDisplay = (lines) => {
  let totalBase = 0;
  let totalAlt = 0;
  let baseUnit = "";
  let altUnit = "";
  let showDual = false;
  let hasAny = false;

  for (const line of lines || []) {
    const base = parseNumericQty(line.actualQty);
    if (!Number.isFinite(base)) continue;
    hasAny = true;
    const { baseUnit: bu, altUnit: au, conversion, canUseWeight } = getLineUnitMeta(line);
    totalBase += base;
    if (canUseWeight) {
      totalAlt += base * conversion;
      showDual = true;
      if (!baseUnit) baseUnit = bu;
      if (!altUnit) altUnit = au;
    } else if (!baseUnit) {
      baseUnit = bu;
    }
  }

  if (!hasAny) return "0";
  if (showDual && altUnit) {
    return `${trimDecimalText(totalBase, 3)} ${baseUnit} = ${trimDecimalText(totalAlt, 3)} ${altUnit}`;
  }
  if (baseUnit) return `${trimDecimalText(totalBase, 3)} ${baseUnit}`;
  return trimDecimalText(totalBase, 3);
};

function SearchableGodownSelect({
  value,
  onValueChange,
  godowns,
  placeholder = "Select godown",
  disabled = false,
  triggerClassName = "h-10 w-full justify-between font-normal",
}) {
  const [open, setOpen] = useState(false);
  const selected = value || "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={triggerClassName}
        >
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
            {selected || placeholder}
          </span>
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
          <CommandInput placeholder="Search godown..." />
          <CommandList>
            <CommandEmpty>No godown found.</CommandEmpty>
            <CommandGroup>
              {(godowns || []).map((g) => (
                <CommandItem
                  key={g.id}
                  value={g.name}
                  onSelect={() => {
                    onValueChange?.(g.name);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Check
                    className={`h-4 w-4 ${selected === g.name ? "opacity-100 text-blue-600" : "opacity-0"
                      }`}
                  />
                  <span className="flex-1 truncate">{g.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function AddStockJournal() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { hasCreatePermission, hasUpdatePermission, isLoading: permissionsLoading } = useUserPermissions();
  const canCreate = hasCreatePermission("stock_journals");
  const canUpdate = hasUpdatePermission("stock_journals");
  const editTransactionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("transaction_id") || "";
  }, []);
  const isEditMode = !!editTransactionId;

  const [voucherTypeName, setVoucherTypeName] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [isEntryDatePickerOpen, setIsEntryDatePickerOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [lockingPeriodHours, setLockingPeriodHours] = useState("");
  const [sourceLines, setSourceLines] = useState([{ ...emptyLine }]);
  const [destinationLines, setDestinationLines] = useState([{ ...emptyLine }]);
  const [sourceBardanLines, setSourceBardanLines] = useState([]);
  const [destinationBardanLines, setDestinationBardanLines] = useState([]);
  const [stockItemsByContext, setStockItemsByContext] = useState({});
  const [loadingStockItemsByContext, setLoadingStockItemsByContext] = useState({});
  const [stockItemsPaginationByContext, setStockItemsPaginationByContext] = useState({});
  const [itemSearchByRow, setItemSearchByRow] = useState({});
  const [itemGroupingByRow, setItemGroupingByRow] = useState({});
  const [stockBalanceByRow, setStockBalanceByRow] = useState({});
  const [sourceBatchOptionsByRow, setSourceBatchOptionsByRow] = useState({});
  const [loadingSourceBatchOptionsByRow, setLoadingSourceBatchOptionsByRow] = useState({});
  const stockItemSearchTimersRef = useRef({});
  const editStockPrefillRef = useRef(null);

  const selectedEntryDate = useMemo(() => {
    if (!entryDate) return undefined;
    const date = new Date(`${entryDate}T00:00:00`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }, [entryDate]);

  const { data: editDetailData, isLoading: editDetailLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-stock-journals-detail/edit`, editTransactionId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/get-stock-journals-detail/${editTransactionId}/`, {
        headers: AuthService.getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to load stock journal detail");
      return response.json();
    },
    enabled: !!editTransactionId && !!AuthService.getAccessToken(),
  });

  const { data: voucherTypesData, isLoading: voucherTypesLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-voucher-types/stock-journal-create`],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-voucher-types/?is_active=true`);
      const payload = await response.json();
      return payload?.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const { data: godownsData, isLoading: godownsLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-godowns/stock-journal-create`],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-godowns/`);
      const payload = await response.json();
      return payload?.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const voucherTypes = voucherTypesData || [];
  const godowns = godownsData || [];

  const selectedVoucher = useMemo(
    () => voucherTypes.find((v) => v.name === voucherTypeName) || null,
    [voucherTypes, voucherTypeName]
  );

  const isFumigationVoucher = useMemo(() => {
    const category = String(selectedVoucher?.voucher_category || "").trim().toLowerCase();
    return category === "fumigation";
  }, [selectedVoucher]);

  const isBrandTransferVoucher = useMemo(() => {
    const category = String(selectedVoucher?.voucher_category || "").trim().toLowerCase();
    return category === "brand_transfer";
  }, [selectedVoucher]);

  const isStockTransferVoucher = useMemo(() => {
    const category = String(selectedVoucher?.voucher_category || "").trim().toLowerCase();
    return category === "stock_transfer";
  }, [selectedVoucher]);

  const linksDestinationStockFromSource =
    isFumigationVoucher || isStockTransferVoucher;

  const resetJournalLineState = () => {
    Object.values(stockItemSearchTimersRef.current).forEach((timerId) => {
      if (timerId) clearTimeout(timerId);
    });
    stockItemSearchTimersRef.current = {};

    setSourceLines([{ ...emptyLine }]);
    setDestinationLines([{ ...emptyLine }]);
    setSourceBardanLines([]);
    setDestinationBardanLines([]);
    setStockItemsByContext({});
    setLoadingStockItemsByContext({});
    setStockItemsPaginationByContext({});
    setItemSearchByRow({});
    setItemGroupingByRow({});
    setStockBalanceByRow({});
    setSourceBatchOptionsByRow({});
    setLoadingSourceBatchOptionsByRow({});
    setLockingPeriodHours("");
  };

  const handleVoucherTypeChange = (nextName) => {
    if (nextName === voucherTypeName) return;
    setVoucherTypeName(nextName);
    resetJournalLineState();
  };

  const clearLinkedDestinationStockAtIndex = (idx) => {
    setDestinationLines((prev) => {
      if (!prev[idx]) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        stockItemId: null,
        stockItemName: "",
        selectedClosingBalance: "",
        selectedBaseUnit: "",
        selectedAltUnit: "",
        selectedConversion: "",
      };
      return next;
    });
  };

  const syncBrandTransferDestinationGodown = (idx, godownName, variant = "main") => {
    if (!isBrandTransferVoucher) return;
    const setter = variant === "bardan" ? setDestinationBardanLines : setDestinationLines;
    setter((prev) => {
      if (!prev[idx]) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], godownName: godownName };
      return next;
    });
  };

  const getRowKey = (section, idx) => `${section}-${idx}`;
  const getRowItemGrouping = (rowKey) => itemGroupingByRow[rowKey] || "";
  const getRowStockBalance = (rowKey) => stockBalanceByRow[rowKey] || "all";
  const resolveRowFilters = (rowKey, overrides = {}) => ({
    grouping: overrides.grouping !== undefined ? overrides.grouping : getRowItemGrouping(rowKey),
    balance: overrides.balance !== undefined ? overrides.balance : getRowStockBalance(rowKey),
    perPage: overrides.perPage,
  });
  const getStockItemsContextKey = (
    type,
    godownName,
    rowKey,
    searchText = "",
    filterOverrides = {},
    rowSection = ""
  ) => {
    const { grouping, balance } = resolveRowFilters(rowKey, filterOverrides);
    const godownKey = isDestinationStockItemScope(type, rowSection)
      ? DESTINATION_STOCK_ITEMS_SCOPE
      : (godownName || "").trim();
    return `${type || "default"}::${godownKey}::${grouping}::${balance}::${String(searchText || "").trim().toLowerCase()}`;
  };
  const getVisibleItemsForRow = (type, godownName, rowKey, filterOverrides = {}, rowSection = "") => {
    const search = itemSearchByRow[rowKey] || "";
    const key = getStockItemsContextKey(type, godownName, rowKey, search, filterOverrides, rowSection);
    return stockItemsByContext[key] || [];
  };
  const matchStockItemByName = (list, stockItemName) => {
    const target = String(stockItemName || "").trim().toLowerCase();
    if (!target || !Array.isArray(list)) return null;
    return (
      list.find((it) => {
        const name = String(it?.name || "").trim().toLowerCase();
        const reserved = String(it?.reserved_name || "").trim().toLowerCase();
        return name === target || reserved === target;
      }) || null
    );
  };

  const findStockItemByName = (type, godownName, stockItemName, rowSection = "") => {
    const target = String(stockItemName || "").trim().toLowerCase();
    if (!target) return null;

    const omitGodown = isDestinationStockItemScope(type, rowSection);
    const godownKey = omitGodown ? DESTINATION_STOCK_ITEMS_SCOPE : (godownName || "").trim();
    if (!omitGodown && !godownKey) return null;

    const prefix = `${type || "default"}::${godownKey}::`;
    for (const [cacheKey, list] of Object.entries(stockItemsByContext)) {
      if (!Array.isArray(list)) continue;
      if (!cacheKey.startsWith(prefix)) continue;
      const found = matchStockItemByName(list, stockItemName);
      if (found) return found;
    }
    return null;
  };

  const findStockItemAcrossCaches = (stockItemName) => {
    for (const list of Object.values(stockItemsByContext)) {
      const found = matchStockItemByName(list, stockItemName);
      if (found) return found;
    }
    return null;
  };

  const resolveStockItemForApi = (line, listType, rowSection = "", rowIndex = 0) => {
    const isDestinationRow =
      rowSection === "destination" || rowSection === "destination-bardan";
    const stockItemName = linksDestinationStockFromSource && isDestinationRow
      ? String(sourceLines[rowIndex]?.stockItemName || line.stockItemName || "").trim()
      : String(line.stockItemName || "").trim();

    if (!stockItemName) return null;

    let stockItem = findStockItemByName(listType, line.godownName, stockItemName, rowSection);

    if (!stockItem && linksDestinationStockFromSource && isDestinationRow) {
      const sourceLine = sourceLines[rowIndex];
      stockItem = findStockItemByName(
        "source",
        sourceLine?.godownName,
        sourceLine?.stockItemName || stockItemName,
        "source"
      );
    }

    if (!stockItem && isDestinationRow) {
      stockItem =
        findStockItemByName("destination", line.godownName, stockItemName, "destination") ||
        findStockItemByName("bardan", line.godownName, stockItemName, rowSection);
    }

    if (!stockItem) {
      stockItem = findStockItemAcrossCaches(stockItemName);
    }

    return stockItem;
  };
  const formatLineQtyForApi = (line, itemType) => {
    const rawQty = String(line.actualQty || "").trim();
    const numericQty = parseNumericQty(rawQty);
    if (!Number.isFinite(numericQty)) return rawQty;

    const selected = findStockItemByName(itemType, line.godownName, line.stockItemName);

    const baseUnit = String(line.selectedBaseUnit || selected?.base_units_name || "").trim();
    const altUnit = String(line.selectedAltUnit || selected?.secondary_unit || "").trim();
    const conversion = Number(line.selectedConversion || selected?.conversion || 0);
    const qtyText = trimDecimalText(numericQty, 3);

    if (!baseUnit) return rawQty;
    if (conversion > 0 && altUnit) {
      const altQty = numericQty * conversion;
      return `${qtyText} ${baseUnit} = ${trimDecimalText(altQty, 3)} ${altUnit}`.trim();
    }
    return `${qtyText} ${baseUnit}`.trim();
  };

  const getQtyInputDisplayValue = (line) => {
    const meta = getLineUnitMeta(line);
    const mode = line.qtyInputMode === "weight" && meta.canUseWeight ? "weight" : "qty";

    if (mode === "weight") {
      let raw = normalizeQtyInputText(line.alternateQtyInput ?? "");
      if (!raw) {
        const base = parseNumericQty(line.actualQty);
        if (Number.isFinite(base) && meta.conversion) {
          return trimDecimalText(getWeightFromBase(base, meta.conversion), 3);
        }
        return "";
      }
      if (DECIMAL_QTY_INPUT_PATTERN.test(raw) && isIncompleteDecimalQtyInput(raw)) {
        return raw;
      }
      const weightQty = parseNumericQty(raw);
      if (!Number.isFinite(weightQty)) {
        return DECIMAL_QTY_INPUT_PATTERN.test(raw) ? raw : "";
      }
      return trimDecimalText(weightQty, 3);
    }

    const raw = normalizeQtyInputText(line.actualQty ?? "");
    if (!raw) return "";

    if (DECIMAL_QTY_INPUT_PATTERN.test(raw) && isIncompleteDecimalQtyInput(raw)) {
      return raw;
    }

    const base = parseNumericQty(raw);
    if (!Number.isFinite(base)) {
      return DECIMAL_QTY_INPUT_PATTERN.test(raw) ? raw : "";
    }
    return trimDecimalText(base, 3);
  };

  const getClosingBalanceDisplay = (line) =>
    formatDualUnitText(
      line.selectedClosingBalance,
      line.selectedBaseUnit,
      line.selectedAltUnit,
      line.selectedConversion
    );

  const getEnteredQtyDisplay = (line) =>
    formatDualUnitText(
      parseNumericQty(line.actualQty),
      line.selectedBaseUnit,
      line.selectedAltUnit,
      line.selectedConversion
    );

  const syncLinkedStockItemAtIndex = (idx, stockItemName, selected, { fromSection }) => {
    if (!linksDestinationStockFromSource || fromSection === "destination-bardan" || fromSection === "source-bardan") {
      return;
    }

    if (fromSection === "source") {
      setDestinationLines((prev) => {
        if (!prev[idx]) return prev;
        const next = [...prev];
        next[idx] = applyStockItemMetaToLine(next[idx], stockItemName, selected);
        return next;
      });
      return;
    }

    if (fromSection === "destination") {
      setSourceLines((prev) => {
        if (!prev[idx]) return prev;
        const next = [...prev];
        next[idx] = applyStockItemMetaToLine(next[idx], stockItemName, selected);
        const godown = next[idx]?.godownName;
        if (godown) {
          loadSourceBatchOptions("source", idx, stockItemName, godown, setSourceLines);
        }
        return next;
      });
    }
  };

  const onSelectStockItem = (setter, lines, idx, value, type, rowSection) => {
    const rowKey = getRowKey(rowSection, idx);
    const list = getVisibleItemsForRow(type, lines[idx]?.godownName, rowKey, {}, rowSection);
    const selected = list.find((it) => String(it.name || "").trim() === String(value || "").trim());
    const updatedLine = applyStockItemMetaToLine(lines[idx], value, selected);
    const next = [...lines];
    next[idx] = updatedLine;
    setter(next);

    if (linksDestinationStockFromSource && (rowSection === "source" || rowSection === "destination")) {
      syncLinkedStockItemAtIndex(idx, value, selected, { fromSection: rowSection });
      if (rowSection === "source") {
        loadSourceBatchOptions("source", idx, value, lines[idx]?.godownName, setSourceLines);
      }
    }
  };

  const buildEditPrefillStockItemsRequestBody = (godownName, searchText, page = 1, perPage = 50) => {
    const body = {
      list_mode: "default",
      type: "",
      is_active: true,
      new_page: page,
      per_page: perPage,
      godown_name: godownName,
      godown: godownName,
    };
    const trimmedSearch = String(searchText || "").trim();
    if (trimmedSearch) {
      body.search = trimmedSearch;
    }
    return body;
  };

  const buildStockItemsListRequestBody = (
    listMode,
    godownName,
    rowKey,
    searchText,
    page,
    filterOverrides = {},
    omitGodown = false
  ) => {
    const { grouping, balance, perPage } = resolveRowFilters(rowKey, filterOverrides);
    const requestBody = {
      list_mode: listMode || "default",
      stock_group: "",
      stock_category: "",
      is_active: true,
      new_page: page,
      per_page: perPage ?? 50,
    };
    if (!omitGodown && (godownName || "").trim()) {
      const trimmedGodown = String(godownName).trim();
      requestBody.godown_name = trimmedGodown;
      requestBody.godown = trimmedGodown;
    }
    if (grouping) {
      requestBody.type = grouping;
    }
    const trimmedSearch = String(searchText || "").trim();
    if (trimmedSearch) {
      requestBody.search = trimmedSearch;
    }
    if (balance === "in_stock") {
      requestBody.in_stock = true;
    } else if (balance === "out_of_stock") {
      requestBody.in_stock = false;
    }
    if (voucherTypeName) {
      requestBody.voucher_type = voucherTypeName;
    }
    return requestBody;
  };

  const loadStockItemsForContext = async (
    type,
    godownName,
    rowKey,
    searchText = "",
    page = 1,
    append = false,
    filterOverrides = {},
    { forceRefresh = false, editPrefill = false, rowSection = "" } = {}
  ) => {
    const omitGodown = isDestinationStockItemScope(type, rowSection);
    const trimmedGodown = (godownName || "").trim();
    if (!omitGodown && !trimmedGodown) return [];
    const listMode = type === "source" || type === "destination" || type === "bardan" ? type : "default";
    const key = getStockItemsContextKey(
      type,
      omitGodown ? DESTINATION_STOCK_ITEMS_SCOPE : trimmedGodown,
      rowKey,
      searchText,
      filterOverrides,
      rowSection
    );
    if (!append && page === 1 && !forceRefresh && stockItemsByContext[key]) return stockItemsByContext[key];

    const { perPage } = resolveRowFilters(rowKey, filterOverrides);
    const requestBody =
      editPrefill && !omitGodown
        ? buildEditPrefillStockItemsRequestBody(trimmedGodown, searchText, page, perPage ?? 50)
        : buildStockItemsListRequestBody(
          listMode,
          trimmedGodown,
          rowKey,
          searchText,
          page,
          filterOverrides,
          omitGodown
        );

    setLoadingStockItemsByContext((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/stock-items-list/`,
        requestBody
      );
      const payload = await response.json();
      if (payload?.status && Number(payload.status) >= 400) {
        throw new Error(payload.message || "Failed to fetch stock items");
      }
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const pagination = payload?.pagination || null;

      setStockItemsPaginationByContext((prev) => ({ ...prev, [key]: pagination }));
      setStockItemsByContext((prev) => {
        if (!append) {
          return { ...prev, [key]: rows };
        }
        const existing = prev[key] || [];
        const merged = [...existing, ...rows].filter(
          (item, index, arr) => arr.findIndex((x) => x.id === item.id) === index
        );
        return { ...prev, [key]: merged };
      });
      return rows;
    } catch (error) {
      return [];
    } finally {
      setLoadingStockItemsByContext((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderStockItemPickerContent = (listType, rowSection, idx, godownName, selectedStockItemName = "") => {
    const rowKey = getRowKey(rowSection, idx);
    const search = itemSearchByRow[rowKey] || "";
    const grouping = getRowItemGrouping(rowKey);
    const balance = getRowStockBalance(rowKey);
    const omitGodown = isDestinationStockItemScope(listType, rowSection);
    const contextKey = getStockItemsContextKey(listType, godownName, rowKey, search, {}, rowSection);
    const items = getVisibleItemsForRow(listType, godownName, rowKey, {}, rowSection);
    const pagination = stockItemsPaginationByContext[contextKey];
    const isLoading = loadingStockItemsByContext[contextKey];
    const selectedName = String(selectedStockItemName || "").trim();
    const selectedInList = selectedName
      ? items.some((item) => String(item?.name || "").trim() === selectedName)
      : false;
    const getItemCount = (item) => {
      const raw =
        item?.total_closing_balance ??
        item?.current_balance ??
        item?.available_qty ??
        item?.qty ??
        item?.quantity ??
        item?.balance ??
        0;
      const num = Number(raw);
      if (Number.isFinite(num)) {
        const formatted = trimDecimalText(num, 3);
        return formatted === "" ? "0" : formatted;
      }
      const fallback = String(raw ?? "").trim();
      return fallback === "" ? "0" : fallback;
    };

    const reloadItems = (nextSearch = search, filterOverrides = {}, forceRefresh = true) => {
      if (!omitGodown && !godownName) return;
      loadStockItemsForContext(listType, godownName, rowKey, nextSearch, 1, false, filterOverrides, {
        forceRefresh,
        rowSection,
      });
    };

    return (
      <>
        <div
          className="p-2 border-b space-y-2 bg-muted/30"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Item grouping</Label>
              <Select
                value={grouping || "__all__"}
                onValueChange={(v) => {
                  const nextGrouping = v === "__all__" ? "" : v;
                  setItemGroupingByRow((prev) => ({ ...prev, [rowKey]: nextGrouping }));
                  reloadItems(search, { grouping: nextGrouping, balance });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  <SelectItem value="__all__">All groupings</SelectItem>
                  {ITEM_GROUPING_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stock balance</Label>
              <Select
                value={balance}
                onValueChange={(v) => {
                  setStockBalanceByRow((prev) => ({ ...prev, [rowKey]: v }));
                  reloadItems(search, { grouping, balance: v });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {STOCK_BALANCE_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setItemSearchByRow((prev) => ({ ...prev, [rowKey]: val }));
              if (stockItemSearchTimersRef.current[rowKey]) {
                clearTimeout(stockItemSearchTimersRef.current[rowKey]);
              }
              stockItemSearchTimersRef.current[rowKey] = setTimeout(() => {
                reloadItems(val, { grouping, balance });
              }, 300);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Search item..."
            className="h-8"
          />
        </div>
        {isLoading && !items.length ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Loading items...</div>
        ) : null}
        {!isLoading && !items.length && !selectedName ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No items found.</div>
        ) : null}
        {selectedName && !selectedInList ? (
          <StockItemSelectOption
            key={`selected-${selectedName}`}
            value={selectedName}
            label={selectedName}
          />
        ) : null}
        {items.map((item) => (
          <StockItemSelectOption
            key={item.id}
            value={item.name}
            label={item.name}
            countSuffix={getItemCount(item)}
          />
        ))}
        {pagination?.has_next ? (
          <div className="p-2 border-t" onPointerDown={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                loadStockItemsForContext(listType, godownName, rowKey, search, pagination.next_page, true, {
                  grouping,
                  balance,
                }, { rowSection });
              }}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Load More"}
            </Button>
          </div>
        ) : null}
      </>
    );
  };

  const loadSourceBatchOptions = async (rowSection, idx, itemName, godownName, setter) => {
    const rowKey = getRowKey(rowSection, idx);
    if (!itemName || !godownName) {
      setSourceBatchOptionsByRow((prev) => ({ ...prev, [rowKey]: [{ name: "Primary Batch", qty: "" }] }));
      return;
    }
    setLoadingSourceBatchOptionsByRow((prev) => ({ ...prev, [rowKey]: true }));
    try {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/item-lot-details/`, {
        item_name: itemName,
        godown_name: godownName,
      });
      const payload = await response.json();
      const raw = payload?.batch_allocations || [];
      const mapped = raw.map((row) => ({
        name: String(row.batch_name || row.batch || row.name || "Primary Batch").trim(),
        qty: row.current_balance ?? row.opening_balance ?? "",
      })).filter((x) => x.name);
      const finalOptions = mapped.length > 0 ? mapped : [{ name: "Primary Batch", qty: "" }];
      setSourceBatchOptionsByRow((prev) => ({ ...prev, [rowKey]: finalOptions }));

      if (setter) {
        setter((prev) => {
          if (!Array.isArray(prev) || !prev[idx]) return prev;
          const current = prev[idx]?.batchName;
          if (current && finalOptions.some((opt) => opt.name === current)) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], batchName: finalOptions[0].name };
          return next;
        });
      }
    } catch (error) {
      setSourceBatchOptionsByRow((prev) => ({ ...prev, [rowKey]: [{ name: "Primary Batch", qty: "" }] }));
    } finally {
      setLoadingSourceBatchOptionsByRow((prev) => ({ ...prev, [rowKey]: false }));
    }
  };

  useEffect(() => {
    if (!isFumigationVoucher) {
      setLockingPeriodHours("");
      return;
    }
    const autoBatch = buildFumigationBatchName();
    const withAutoBatch = (line) => ({
      ...line,
      batchName:
        isEditMode && String(line.batchName || "").trim()
          ? line.batchName
          : autoBatch,
    });
    setDestinationLines((prev) => prev.map(withAutoBatch));
    setDestinationBardanLines((prev) => prev.map(withAutoBatch));
  }, [isFumigationVoucher, isEditMode]);

  useEffect(() => {
    if (!isBrandTransferVoucher) return;
    setDestinationLines((prev) =>
      prev.map((line, idx) => ({
        ...line,
        godownName: sourceLines[idx]?.godownName || line.godownName,
      }))
    );
    setDestinationBardanLines((prev) =>
      prev.map((line, idx) => ({
        ...line,
        godownName: sourceBardanLines[idx]?.godownName || line.godownName,
      }))
    );
  }, [isBrandTransferVoucher]);

  // Fumigation / stock transfer: destination stock item is mirrored from source.
  // Stock transfer also mirrors quantity; godown and batch stay independent on destination.
  useEffect(() => {
    if (!isFumigationVoucher && !isStockTransferVoucher) return;
    const mirrorFromSource = (line, srcLine) => {
      if (!srcLine) return line;
      const nextStockItemName = srcLine.stockItemName || line.stockItemName || "";
      const nextBaseUnit = srcLine.selectedBaseUnit || "";
      const nextAltUnit = srcLine.selectedAltUnit || "";
      const nextConversion = srcLine.selectedConversion ?? "";
      const nextActualQty = isStockTransferVoucher ? (srcLine.actualQty ?? "") : line.actualQty;
      const nextAlternateQtyInput = isStockTransferVoucher
        ? (srcLine.alternateQtyInput ?? "")
        : line.alternateQtyInput;
      const nextQtyInputMode = isStockTransferVoucher
        ? (srcLine.qtyInputMode || "qty")
        : line.qtyInputMode;
      if (
        line.stockItemName === nextStockItemName &&
        line.selectedBaseUnit === nextBaseUnit &&
        line.selectedAltUnit === nextAltUnit &&
        String(line.selectedConversion ?? "") === String(nextConversion ?? "") &&
        (!isStockTransferVoucher ||
          (line.actualQty === nextActualQty &&
            line.alternateQtyInput === nextAlternateQtyInput &&
            line.qtyInputMode === nextQtyInputMode))
      ) {
        return line;
      }
      return {
        ...line,
        stockItemName: nextStockItemName,
        stockItemId: srcLine.stockItemId ?? line.stockItemId ?? null,
        selectedClosingBalance: srcLine.selectedClosingBalance ?? line.selectedClosingBalance ?? "",
        selectedBaseUnit: nextBaseUnit,
        selectedAltUnit: nextAltUnit,
        selectedConversion: nextConversion,
        ...(isStockTransferVoucher
          ? {
              actualQty: nextActualQty,
              alternateQtyInput: nextAlternateQtyInput,
              qtyInputMode: nextQtyInputMode,
            }
          : {}),
      };
    };
    setDestinationLines((prev) => prev.map((line, idx) => mirrorFromSource(line, sourceLines[idx])));
    setDestinationBardanLines((prev) =>
      prev.map((line, idx) => mirrorFromSource(line, sourceBardanLines[idx]))
    );
  }, [isFumigationVoucher, isStockTransferVoucher, sourceLines, sourceBardanLines]);

  useEffect(() => {
    if (!isStockTransferVoucher) return;
    setDestinationLines((prev) => {
      const targetLen = sourceLines.length;
      if (prev.length === targetLen) return prev;
      if (prev.length < targetLen) {
        const extras = Array.from({ length: targetLen - prev.length }, () => ({ ...emptyLine }));
        return [...prev, ...extras];
      }
      return prev.slice(0, targetLen);
    });
  }, [isStockTransferVoucher, sourceLines.length]);

  const sourceLabel = selectedVoucher?.source_alias || "Source";
  const destinationLabel = selectedVoucher?.destination_alias || "Destination";
  const showSourceSection = true;
  const showDestinationSection = true;
  const showBardanInSource = selectedVoucher ? !!selectedVoucher.add_bardan && !!selectedVoucher.in_source : false;
  const showBardanInDestination = selectedVoucher ? !!selectedVoucher.add_bardan && !!selectedVoucher.in_destination : false;

  useEffect(() => {
    if (!isEditMode || !editDetailData?.data) return;

    const detail = editDetailData.data;
    const prefillKey = editTransactionId || detail.transaction_id || "";
    if (editStockPrefillRef.current === prefillKey) return;
    editStockPrefillRef.current = prefillKey;

    setVoucherTypeName(detail.voucher_type_name || "");
    setEntryDate(formatDateForInput(detail.date_input || detail.date));
    setRemarks(detail.remarks || "");

    const toLine = (entry, batch) => {
      const qtySource = batch?.actual_qty || entry?.actual_qty;
      const fallbackText = batch?.actualQty || entry?.actual_qty?.full_text || entry?.actualQty || "";
      return {
        ...emptyLine,
        stockItemId: entry?.stock_item_id ?? null,
        stockItemName: entry?.stock_item || "",
        actualQty: normalizeBaseQtyFromApiQty(qtySource, fallbackText),
        godownName: batch?.godown || "",
        batchName: batch?.batch_name || "Primary Batch",
      };
    };

    const outEntries = Array.isArray(detail.inventory_entries_out) ? detail.inventory_entries_out : [];
    const inEntries = Array.isArray(detail.inventory_entries_in) ? detail.inventory_entries_in : [];

    const mappedSource = outEntries.flatMap((entry) => {
      const batches = Array.isArray(entry.batch_allocations) ? entry.batch_allocations : [];
      if (!batches.length) return [toLine(entry, null)];
      return batches.map((batch) => toLine(entry, batch));
    });
    const mappedDestination = inEntries.flatMap((entry) => {
      const batches = Array.isArray(entry.batch_allocations) ? entry.batch_allocations : [];
      if (!batches.length) return [toLine(entry, null)];
      return batches.map((batch) => toLine(entry, batch));
    });

    const sourceLinesData = mappedSource.length ? mappedSource : [{ ...emptyLine }];
    const destinationLinesData = mappedDestination.length ? mappedDestination : [{ ...emptyLine }];

    setSourceLines(sourceLinesData);
    setDestinationLines(destinationLinesData);
    setSourceBardanLines([]);
    setDestinationBardanLines([]);

    const findStockItemMatch = (items, prefilledName) => {
      const target = prefilledName.toLowerCase();
      return (items || []).find((it) => {
        const itemName = String(it?.name || "").trim().toLowerCase();
        const reservedName = String(it?.reserved_name || "").trim().toLowerCase();
        return itemName === target || reservedName === target;
      });
    };

    const resolvePrefilledLines = async (lines, setter, type, rowSection) => {
      if (!Array.isArray(lines) || lines.length === 0) return;

      const omitGodown = isDestinationStockItemScope(type, rowSection);
      const patches = new Map();
      const batchLoads = [];

      for (let idx = 0; idx < lines.length; idx += 1) {
        const godown = String(lines[idx]?.godownName || "").trim();
        const prefilledName = String(lines[idx]?.stockItemName || "").trim();
        if (!prefilledName) continue;
        if (!omitGodown && !godown) continue;

        const rowKey = getRowKey(rowSection, idx);
        const items = await loadStockItemsForContext(
          type,
          godown,
          rowKey,
          prefilledName,
          1,
          false,
          { perPage: 50 },
          { forceRefresh: true, editPrefill: !omitGodown, rowSection }
        );

        const listContextKey = getStockItemsContextKey(
          type,
          omitGodown ? DESTINATION_STOCK_ITEMS_SCOPE : godown,
          rowKey,
          "",
          {},
          rowSection
        );
        const searchContextKey = getStockItemsContextKey(
          type,
          omitGodown ? DESTINATION_STOCK_ITEMS_SCOPE : godown,
          rowKey,
          prefilledName,
          {},
          rowSection
        );
        setStockItemsByContext((prev) => {
          const list = items?.length ? items : prev[listContextKey] || [];
          return {
            ...prev,
            [listContextKey]: list,
            [searchContextKey]: list,
          };
        });

        let matched = findStockItemMatch(items, prefilledName);
        if (!matched && items?.length === 1) {
          matched = items[0];
        }
        if (matched) {
          patches.set(idx, applyMatchedStockItemToLine(lines[idx], matched, prefilledName));
        }

        if (type === "source" || type === "bardan") {
          const itemName = matched?.name || prefilledName;
          batchLoads.push({ idx, itemName, godown });
        }
      }

      if (patches.size > 0) {
        setter((prev) => {
          const next = [...prev];
          patches.forEach((patch, idx) => {
            next[idx] = patch;
          });
          return next;
        });
      }

      for (const { idx, itemName, godown } of batchLoads) {
        await loadSourceBatchOptions(rowSection, idx, itemName, godown, setter);
      }
    };

    (async () => {
      await resolvePrefilledLines(sourceLinesData, setSourceLines, "source", "source");
      await resolvePrefilledLines(destinationLinesData, setDestinationLines, "destination", "destination");
    })();
  }, [isEditMode, editDetailData, editTransactionId]);

  useEffect(() => {
    if (isEditMode) return;
    editStockPrefillRef.current = null;
  }, [isEditMode]);

  const updateLine = (setter, lines, idx, key, value, { clearStockItemOnGodownChange = true } = {}) => {
    const next = [...lines];
    const current = { ...next[idx], [key]: value };
    if (key === "godownName" && clearStockItemOnGodownChange) {
      current.stockItemId = null;
      current.stockItemName = "";
    }
    next[idx] = current;
    setter(next);
  };

  const setLineQtyInputMode = (setter, lines, idx, mode) => {
    const line = lines[idx];
    const meta = getLineUnitMeta(line);
    let alternateQtyInput = line.alternateQtyInput || "";

    if (mode === "weight" && meta.canUseWeight) {
      const base = parseNumericQty(line.actualQty);
      if (Number.isFinite(base) && meta.conversion) {
        alternateQtyInput = trimDecimalText(getWeightFromBase(base, meta.conversion), 3);
      }
    } else {
      alternateQtyInput = "";
    }

    const next = [...lines];
    next[idx] = { ...next[idx], qtyInputMode: mode, alternateQtyInput };
    setter(next);
  };

  const updateLineQtyValue = (setter, lines, idx, rawValue, mode) => {
    const line = lines[idx];
    const meta = getLineUnitMeta(line);
    const normalized = normalizeQtyInputText(rawValue);

    if (mode === "weight" && meta.canUseWeight) {
      let alternateQtyInput = normalized;
      let actualQty = line.actualQty || "";

      if (!normalized.trim()) {
        alternateQtyInput = "";
        actualQty = "";
      } else if (!DECIMAL_QTY_INPUT_PATTERN.test(normalized)) {
        alternateQtyInput = line.alternateQtyInput || "";
      } else if (isIncompleteDecimalQtyInput(normalized)) {
        alternateQtyInput = normalized;
      } else {
        const weightQty = parseNumericQty(normalized);
        if (Number.isFinite(weightQty)) {
          alternateQtyInput = normalized;
          actualQty = trimDecimalText(getBaseFromWeight(weightQty, meta.conversion), 3);
        } else {
          alternateQtyInput = line.alternateQtyInput || "";
        }
      }

      const next = [...lines];
      next[idx] = { ...next[idx], actualQty, alternateQtyInput, qtyInputMode: mode };
      setter(next);
      return;
    }

    let actualQty = normalized;
    if (normalized && !DECIMAL_QTY_INPUT_PATTERN.test(normalized)) {
      actualQty = line.actualQty || "";
    }

    const next = [...lines];
    next[idx] = { ...next[idx], actualQty, alternateQtyInput: "", qtyInputMode: mode };
    setter(next);
  };

  const qtyWeightSegmentClass = (active) =>
    active
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
      : "text-muted-foreground hover:bg-background/70 hover:text-foreground";

  const renderQtyWeightInput = (setter, lines, idx, line, { readOnly = false, readOnlyLine = null } = {}) => {
    const displayLine = readOnly && readOnlyLine ? readOnlyLine : line;
    const meta = getLineUnitMeta(displayLine);
    const mode = displayLine.qtyInputMode === "weight" && meta.canUseWeight ? "weight" : "qty";
    const qtyLabel = meta.baseUnit ? `Qty (${meta.baseUnit})` : "Qty";
    const weightLabel = meta.altUnit ? `Weight (${meta.altUnit})` : "Weight";
    const qtyToggleLabel = meta.baseUnit || "Qty";
    const weightToggleLabel = meta.altUnit || "Wt";
    const fieldLabel = meta.canUseWeight ? "Quantity" : qtyLabel;
    const placeholder =
      mode === "weight" && meta.canUseWeight
        ? meta.altUnit
          ? `Enter ${meta.altUnit}`
          : "Enter weight"
        : meta.baseUnit
          ? `Enter ${meta.baseUnit}`
          : "Enter qty";

    if (readOnly) {
      return (
        <div className="md:col-span-2 space-y-1.5">
          <Label className="leading-none">{fieldLabel}</Label>
          <Input
            className="h-10 bg-muted/50"
            readOnly
            value={getQtyInputDisplayValue({ ...displayLine, qtyInputMode: mode })}
            placeholder="Set quantity in source section"
          />
        </div>
      );
    }

    const qtyInput = (
      <Input
        type="text"
        inputMode="decimal"
        className={
          meta.canUseWeight
            ? "h-full min-w-0 flex-1 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
            : "h-10"
        }
        value={getQtyInputDisplayValue({ ...line, qtyInputMode: mode })}
        onChange={(e) => updateLineQtyValue(setter, lines, idx, e.target.value, mode)}
        placeholder={placeholder}
        aria-label={mode === "weight" ? weightLabel : qtyLabel}
      />
    );

    return (
      <div className="md:col-span-2 space-y-1.5">
        <Label className="leading-none">{fieldLabel}</Label>
        {meta.canUseWeight ? (
          <div
            className="flex h-10 w-full overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
            role="group"
            aria-label="Quantity unit"
          >
            <div
              className="flex shrink-0 items-center gap-0.5 border-r border-input bg-muted/50 px-1"
              role="tablist"
              aria-orientation="horizontal"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "qty"}
                title={qtyLabel}
                className={`h-8 rounded-sm px-2.5 text-xs font-semibold transition-all ${qtyWeightSegmentClass(mode === "qty")}`}
                onClick={() => setLineQtyInputMode(setter, lines, idx, "qty")}
              >
                {qtyToggleLabel}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "weight"}
                title={weightLabel}
                className={`h-8 rounded-sm px-2.5 text-xs font-semibold transition-all ${qtyWeightSegmentClass(mode === "weight")}`}
                onClick={() => setLineQtyInputMode(setter, lines, idx, "weight")}
              >
                {weightToggleLabel}
              </button>
            </div>
            {qtyInput}
          </div>
        ) : (
          qtyInput
        )}
      </div>
    );
  };

  const renderDeleteColumn = (setter, lines, idx, { onRemove } = {}) => (
    <div className="md:col-span-1 space-y-1.5">
      <Label className="pointer-events-none invisible leading-none select-none" aria-hidden>
        Remove
      </Label>
      <Button
        variant="destructive"
        size="icon"
        className="h-10 w-10 shrink-0"
        onClick={() => (onRemove ? onRemove(idx) : removeLine(setter, lines, idx))}
        aria-label="Remove row"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderLineMetaRow = (line, rowSection, idx, { listType = null, itemsLoadingLabel = "", showBatchLoading = false } = {}) => {
    const rowKey = getRowKey(rowSection, idx);
    const canShowItemsMeta =
      listType &&
      (isDestinationStockItemScope(listType, rowSection) || line.godownName);
    const itemsContextKey = canShowItemsMeta
      ? getStockItemsContextKey(listType, line.godownName, rowKey, itemSearchByRow[rowKey] || "", {}, rowSection)
      : "";
    const itemsLoading = Boolean(listType && itemsLoadingLabel && loadingStockItemsByContext[itemsContextKey]);
    const batchLoading = Boolean(showBatchLoading && loadingSourceBatchOptionsByRow[rowKey]);
    const closing =
      line.stockItemName && getClosingBalanceDisplay(line)
        ? `Closing Balance: ${getClosingBalanceDisplay(line)}`
        : "";
    const qtyText = line.actualQty && getEnteredQtyDisplay(line) ? getEnteredQtyDisplay(line) : "";

    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs min-h-[1.25rem]">
        <div className="hidden md:block md:col-span-3" />
        <div className="md:col-span-4 truncate text-muted-foreground">
          {itemsLoading ? <span className="text-gray-500">{itemsLoadingLabel}</span> : null}
          {!itemsLoading && closing ? <span className="text-gray-600">{closing}</span> : null}
        </div>
        <div className="md:col-span-2 text-muted-foreground">
          {batchLoading ? <span className="text-gray-500">Loading batches...</span> : null}
        </div>
        <div className="md:col-span-2 truncate text-gray-600">{qtyText}</div>
        <div className="hidden md:block md:col-span-1" />
      </div>
    );
  };

  const addLine = (setter, lines, lineOverrides = {}) => setter([...lines, { ...emptyLine, ...lineOverrides }]);

  const addSourceLine = () => {
    addLine(setSourceLines, sourceLines);
    if (isStockTransferVoucher) {
      addLine(setDestinationLines, destinationLines, newDestinationLineDefaults());
    }
  };

  const newDestinationLineDefaults = (variant = "main") => {
    const defaults = {
      batchName: isFumigationVoucher ? buildFumigationBatchName() : "",
    };
    if (isBrandTransferVoucher) {
      const sourceRows = variant === "bardan" ? sourceBardanLines : sourceLines;
      const nextIdx = variant === "bardan" ? destinationBardanLines.length : destinationLines.length;
      defaults.godownName =
        sourceRows[nextIdx]?.godownName || sourceRows[0]?.godownName || "";
    }
    return defaults;
  };

  const renderLinkedDestinationGodown = (idx, line, linkedSourceGodown) => (
    <div className="md:col-span-3 space-y-1.5">
      <Label>Godown</Label>
      <Input
        className="h-10 bg-muted/50"
        readOnly
        value={linkedSourceGodown || line.godownName || ""}
        placeholder="Select godown in source section"
      />
    </div>
  );

  const renderBatchField = (setter, lines, idx, line, { section, isDestination }) => {
    const rowKey = getRowKey(section, idx);

    if (isDestination) {
      if (isFumigationVoucher) {
        const displayBatch = String(line.batchName || "").trim() || buildFumigationBatchName();
        return (
          <div className="md:col-span-2 space-y-1.5">
            <Label>Batch name</Label>
            <Input
              className="h-10 bg-muted/50 text-xs"
              readOnly
              value={displayBatch}
              title={displayBatch}
            />
          </div>
        );
      }

      return (
        <div className="md:col-span-2 space-y-1.5">
          <Label>Batch</Label>
          <Input
            className="h-10"
            value={line.batchName}
            placeholder={`${DEFAULT_DESTINATION_BATCH_NAME} (default if empty)`}
            onChange={(e) => updateLine(setter, lines, idx, "batchName", e.target.value)}
          />
        </div>
      );
    }

    return (
      <div className="md:col-span-2 space-y-1.5">
        <Label>Batch</Label>
        <Select value={line.batchName} onValueChange={(v) => updateLine(setter, lines, idx, "batchName", v)}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select batch" />
          </SelectTrigger>
          <SelectContent>
            {(sourceBatchOptionsByRow[rowKey] || [{ name: "Primary Batch", qty: "" }]).map((batch, bIdx) => (
              <SelectItem key={`${batch.name}-${bIdx}`} value={batch.name}>
                {batch.name}
                {batch.qty !== "" && batch.qty !== null && batch.qty !== undefined
                  ? ` (Qty: ${batch.qty})`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };
  const removeLine = (setter, lines, idx) => {
    if (lines.length === 1) return;
    setter(lines.filter((_, i) => i !== idx));
  };

  const removeSourceLine = (idx) => {
    if (sourceLines.length <= 1) return;
    removeLine(setSourceLines, sourceLines, idx);
    if (isStockTransferVoucher && destinationLines.length > 1) {
      removeLine(setDestinationLines, destinationLines, idx);
    }
  };

  const validateLine = (line) => line.stockItemName && line.actualQty && line.godownName && line.batchName;

  const validateDestinationLine = (line, rowIndex = 0) => {
    const stockItemName = linksDestinationStockFromSource
      ? String(sourceLines[rowIndex]?.stockItemName || line.stockItemName || "").trim()
      : String(line.stockItemName || "").trim();
    const actualQty = isStockTransferVoucher
      ? String(sourceLines[rowIndex]?.actualQty || line.actualQty || "").trim()
      : String(line.actualQty || "").trim();
    if (!stockItemName || !actualQty || !line.godownName) return false;
    return true;
  };

  const buildDirectApiSectionRow = (line, listType, rowSection = "", rowIndex = 0) => {
    const godown = godowns.find(
      (g) => String(g?.name || "").trim() === String(line.godownName || "").trim()
    );
    const stockItem = resolveStockItemForApi(line, listType, rowSection, rowIndex);
    const isDestinationRow =
      rowSection === "destination" || rowSection === "destination-bardan";
    const qtyText =
      isStockTransferVoucher && rowSection === "destination"
        ? sourceLines[rowIndex]?.actualQty ?? line.actualQty
        : line.actualQty;
    const quantity = parseNumericQty(qtyText);
    const batch_name = isDestinationRow && isFumigationVoucher
      ? buildFumigationBatchName()
      : isDestinationRow
        ? normalizeDestinationBatchName(line.batchName)
        : String(line.batchName || "").trim() || DEFAULT_DESTINATION_BATCH_NAME;
    const stockItemId =
      line.stockItemId != null && line.stockItemId !== ""
        ? Number(line.stockItemId)
        : stockItem?.id ?? null;

    return {
      godown_id: godown?.id ?? null,
      stock_item_id: Number.isFinite(stockItemId) ? stockItemId : null,
      batch_name,
      quantity: Number.isFinite(quantity) ? quantity : null,
    };
  };

  // Group flat rows into the new nested payload:
  //   { stock_item_id, batches: [{ godown_id, batch_name, quantity }, ...] }
  // Preserves the order in which stock items first appear so source/destination keep
  // matching item positions (used by Fumigation auto-batch resolution on the backend).
  const groupFlatRowsByStockItem = (rows) => {
    const itemMap = new Map();
    for (const row of rows) {
      if (!itemMap.has(row.stock_item_id)) {
        itemMap.set(row.stock_item_id, {
          stock_item_id: row.stock_item_id,
          batches: [],
        });
      }
      itemMap.get(row.stock_item_id).batches.push({
        godown_id: row.godown_id,
        batch_name: row.batch_name,
        quantity: row.quantity,
      });
    }
    return Array.from(itemMap.values());
  };

  const handleSubmit = async () => {
    if (!voucherTypeName) {
      toast({ title: "Validation", description: "Please select voucher type", variant: "destructive" });
      return;
    }

    const voucherTypeId = selectedVoucher?.id;
    if (!voucherTypeId) {
      toast({ title: "Validation", description: "Invalid voucher type selected", variant: "destructive" });
      return;
    }

    if (isFumigationVoucher && !lockingPeriodHours) {
      toast({
        title: "Validation",
        description: "Please select a locking period for Fumigation voucher type",
        variant: "destructive",
      });
      return;
    }

    const hasInvalidSource = showSourceSection && !sourceLines.every(validateLine);
    const hasInvalidSourceBardan =
      showSourceSection && sourceBardanLines.length > 0 && !sourceBardanLines.every(validateLine);
    const hasInvalidDestination =
      showDestinationSection && !destinationLines.every((line, idx) => validateDestinationLine(line, idx));
    const hasInvalidDestinationBardan =
      showDestinationSection &&
      destinationBardanLines.length > 0 &&
      !destinationBardanLines.every((line, idx) => validateDestinationLine(line, idx));

    if (hasInvalidSource || hasInvalidSourceBardan || hasInvalidDestination || hasInvalidDestinationBardan) {
      toast({
        title: "Validation",
        description: isFumigationVoucher
          ? "Please fill stock item, quantity, godown and batch name in all rows"
          : "Please fill stock item, quantity, godown and batch in all rows",
        variant: "destructive",
      });
      return;
    }

    const sourceFlatRows = showSourceSection
      ? [
        ...sourceLines.map((line, idx) => buildDirectApiSectionRow(line, "source", "source", idx)),
        ...sourceBardanLines.map((line, idx) =>
          buildDirectApiSectionRow(line, "bardan", "source-bardan", idx)
        ),
      ]
      : [];

    const destinationFlatRows = showDestinationSection
      ? [
        ...destinationLines.map((line, idx) =>
          buildDirectApiSectionRow(line, "destination", "destination", idx)
        ),
        ...destinationBardanLines.map((line, idx) =>
          buildDirectApiSectionRow(line, "bardan", "destination-bardan", idx)
        ),
      ]
      : [];

    if (!sourceFlatRows.length && !destinationFlatRows.length) {
      toast({
        title: "Validation",
        description: "Add at least one item in source and/or destination",
        variant: "destructive",
      });
      return;
    }

    const source_section = groupFlatRowsByStockItem(
      sourceFlatRows.filter((row) => row.stock_item_id != null && row.quantity > 0)
    );
    const destination_section = groupFlatRowsByStockItem(
      destinationFlatRows.filter((row) => row.stock_item_id != null && row.quantity > 0)
    );

    if (!source_section.length && !destination_section.length) {
      toast({
        title: "Validation",
        description: "Could not build update payload. Re-select godown and stock items, then try again.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      voucher_type_id: voucherTypeId,
      date: entryDate,
      remarks: remarks || "",
      source_section,
      destination_section,
    };

    if (isFumigationVoucher) {
      payload.locking_period = computeLockingPeriodFromHours(lockingPeriodHours);
    }

    if (isEditMode) {
      payload.transaction_id = editTransactionId;
    }

    try {
      setIsSubmitting(true);
      const endpoint = isEditMode
        ? `${API_BASE_URL}/api/voucher/update-direct-stock-journal/`
        : `${API_BASE_URL}/api/voucher/create-direct-stock-journal/`;
      const response = await apiRequest("POST", endpoint, payload);
      const result = await response.json();
      toast({
        title: "Success",
        description:
          result?.message ||
          (isEditMode ? "Stock journal updated successfully." : "Stock journal created successfully."),
        variant: "success",
      });
      try {
        sessionStorage.setItem("stock_journal_restore_filters_once", "1");
      } catch (_) {
        // ignore storage errors
      }
      setLocation("/stock-journal");
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message || (isEditMode ? "Failed to update stock journal" : "Failed to create stock journal"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (permissionsLoading || voucherTypesLoading || godownsLoading || editDetailLoading) {
    return <Loader loadingText="Loading stock journal form..." />;
  }

  if ((!isEditMode && !canCreate) || (isEditMode && !canUpdate)) {
    return (
      <div className="app-layout bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p>
              {isEditMode
                ? "You do not have permission to update stock journals."
                : "You do not have permission to create stock journals."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900 h-[100dvh] overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      <div className="app-main-content h-full min-h-0 flex flex-col">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b shrink-0">
          <div className="px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/stock-journal")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <h1 className="text-lg sm:text-xl font-bold truncate">
                {isEditMode ? "Update Stock Journal Entry" : "Stock Journal Entry"}
              </h1>
            </div>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (isEditMode ? "Update Entry" : "Save Entry")}
            </Button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 pb-24">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className={isFumigationVoucher ? "md:col-span-4" : "md:col-span-5"}>
                <Label>Voucher Type</Label>
                <Select value={voucherTypeName} onValueChange={handleVoucherTypeChange}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select voucher type" /></SelectTrigger>
                  <SelectContent>
                    {voucherTypes.map((voucher) => (
                      <SelectItem key={voucher.id} value={voucher.name}>
                        {voucher.display_name || voucher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Date</Label>
                <Popover open={isEntryDatePickerOpen} onOpenChange={setIsEntryDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
                      <span className="truncate">
                        {selectedEntryDate
                          ? format(selectedEntryDate, "dd-MM-yyyy")
                          : format(new Date(), "dd-MM-yyyy")}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedEntryDate}
                      onSelect={(date) => {
                        if (date) {
                          setEntryDate(format(date, "yyyy-MM-dd"));
                        }
                        setIsEntryDatePickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {isFumigationVoucher && (
                <div className="md:col-span-3">
                  <Label>
                    Locking period <span className="text-destructive">*</span>
                  </Label>
                  <Select value={lockingPeriodHours} onValueChange={setLockingPeriodHours}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select hours" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCKING_PERIOD_HOUR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={isFumigationVoucher ? "md:col-span-3" : "md:col-span-5"}>
                <Label>Additional Remarks (optional)</Label>
                <Textarea
                  className="h-10 min-h-10 resize-none"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={1}
                />
              </div>
            </CardContent>
          </Card>

          {showSourceSection && (
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{sourceLabel}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={addSourceLine}>
                    <Plus className="h-4 w-4 mr-1" /> Item
                  </Button>
                  {showBardanInSource && (
                    <Button size="sm" variant="secondary" onClick={() => addLine(setSourceBardanLines, sourceBardanLines)}>
                      <Plus className="h-4 w-4 mr-1" /> Bardan
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {sourceLines.map((line, idx) => (
                  <div key={`src-${idx}`} className="space-y-1">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                      <div className="md:col-span-3 space-y-1.5">
                        <Label>Godown</Label>
                        <SearchableGodownSelect
                          value={line.godownName}
                          godowns={godowns}
                          onValueChange={(v) => {
                            updateLine(setSourceLines, sourceLines, idx, "godownName", v);
                            if (isFumigationVoucher) {
                              clearLinkedDestinationStockAtIndex(idx);
                            }
                            const rowKey = getRowKey("source", idx);
                            const search = itemSearchByRow[rowKey] || "";
                            loadStockItemsForContext("source", v, rowKey, search, 1, false);
                            if (sourceLines[idx]?.stockItemName) {
                              loadSourceBatchOptions("source", idx, sourceLines[idx].stockItemName, v, setSourceLines);
                            }
                            syncBrandTransferDestinationGodown(idx, v, "main");
                          }}
                        />
                      </div>
                      <div className="md:col-span-4 space-y-1.5">
                        <Label>Stock Item</Label>
                        <Select
                          value={line.stockItemName}
                          onOpenChange={(open) => {
                            if (!open || !line.godownName) return;
                            const rowKey = getRowKey("source", idx);
                            const search = itemSearchByRow[rowKey] || "";
                            const key = getStockItemsContextKey("source", line.godownName, rowKey, search);
                            if (!stockItemsByContext[key]) {
                              loadStockItemsForContext("source", line.godownName, rowKey, search, 1, false);
                            }
                          }}
                          onValueChange={(v) => {
                            onSelectStockItem(setSourceLines, sourceLines, idx, v, "source", "source");
                            loadSourceBatchOptions("source", idx, v, line.godownName, setSourceLines);
                          }}
                          disabled={!line.godownName}
                        >
                          <SelectTrigger className="h-10"><SelectValue placeholder={!line.godownName ? "Select godown first" : "Select item"} /></SelectTrigger>
                          <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
                            {renderStockItemPickerContent("source", "source", idx, line.godownName, line.stockItemName)}
                          </SelectContent>
                        </Select>
                      </div>
                      {renderBatchField(setSourceLines, sourceLines, idx, line, {
                        section: "source",
                        isDestination: false,
                      })}
                      {renderQtyWeightInput(setSourceLines, sourceLines, idx, line)}
                      {renderDeleteColumn(setSourceLines, sourceLines, idx, {
                        onRemove: isStockTransferVoucher ? removeSourceLine : undefined,
                      })}
                    </div>
                    {renderLineMetaRow(line, "source", idx, {
                      listType: "source",
                      itemsLoadingLabel: "Loading source items...",
                      showBatchLoading: true,
                    })}
                  </div>
                ))}
                {sourceBardanLines.map((line, idx) => (
                  <div key={`src-brd-${idx}`} className="space-y-1 border-t pt-3 mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                      <div className="md:col-span-3 space-y-1.5">
                        <Label>Godown</Label>
                        <SearchableGodownSelect
                          value={line.godownName}
                          godowns={godowns}
                          onValueChange={(v) => {
                            updateLine(setSourceBardanLines, sourceBardanLines, idx, "godownName", v);
                            const rowKey = getRowKey("source-bardan", idx);
                            const search = itemSearchByRow[rowKey] || "";
                            loadStockItemsForContext("bardan", v, rowKey, search, 1, false);
                            if (sourceBardanLines[idx]?.stockItemName) {
                              loadSourceBatchOptions("source-bardan", idx, sourceBardanLines[idx].stockItemName, v, setSourceBardanLines);
                            }
                            syncBrandTransferDestinationGodown(idx, v, "bardan");
                          }}
                        />
                      </div>
                      <div className="md:col-span-4 space-y-1.5">
                        <Label>Bardan Item</Label>
                        <Select
                          value={line.stockItemName}
                          onOpenChange={(open) => {
                            if (!open || !line.godownName) return;
                            const rowKey = getRowKey("source-bardan", idx);
                            const search = itemSearchByRow[rowKey] || "";
                            const key = getStockItemsContextKey("bardan", line.godownName, rowKey, search);
                            if (!stockItemsByContext[key]) {
                              loadStockItemsForContext("bardan", line.godownName, rowKey, search, 1, false);
                            }
                          }}
                          onValueChange={(v) => {
                            onSelectStockItem(setSourceBardanLines, sourceBardanLines, idx, v, "bardan", "source-bardan");
                            loadSourceBatchOptions("source-bardan", idx, v, line.godownName, setSourceBardanLines);
                          }}
                          disabled={!line.godownName}
                        >
                          <SelectTrigger className="h-10"><SelectValue placeholder={!line.godownName ? "Select godown first" : "Select bardan item"} /></SelectTrigger>
                          <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
                            {renderStockItemPickerContent("bardan", "source-bardan", idx, line.godownName, line.stockItemName)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <Label>Batch</Label>
                        <Select value={line.batchName} onValueChange={(v) => updateLine(setSourceBardanLines, sourceBardanLines, idx, "batchName", v)}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Select batch" /></SelectTrigger>
                          <SelectContent>
                            {(sourceBatchOptionsByRow[getRowKey("source-bardan", idx)] || [{ name: "Primary Batch", qty: "" }]).map((batch, bIdx) => (
                              <SelectItem key={`${batch.name}-${bIdx}`} value={batch.name}>
                                {batch.name}{batch.qty !== "" && batch.qty !== null && batch.qty !== undefined ? ` (Qty: ${batch.qty})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {renderQtyWeightInput(setSourceBardanLines, sourceBardanLines, idx, line)}
                      {renderDeleteColumn(setSourceBardanLines, sourceBardanLines, idx)}
                    </div>
                    {renderLineMetaRow(line, "source-bardan", idx, {
                      listType: "bardan",
                      itemsLoadingLabel: "Loading items...",
                      showBatchLoading: true,
                    })}
                  </div>
                ))}
                <div className="text-sm font-semibold pt-1">Total Source Weight: {formatSectionTotalDisplay(sourceLines)}</div>
                {sourceBardanLines.length > 0 && (
                  <div className="text-sm font-semibold pt-1">Total Source Bardan Weight: {formatSectionTotalDisplay(sourceBardanLines)}</div>
                )}
              </CardContent>
            </Card>
          )}

          {showDestinationSection && (
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{destinationLabel}</CardTitle>
                <div className="flex items-center gap-2">
                  {!isStockTransferVoucher && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addLine(setDestinationLines, destinationLines, newDestinationLineDefaults())}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Item
                    </Button>
                  )}
                  {showBardanInDestination && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        addLine(setDestinationBardanLines, destinationBardanLines, newDestinationLineDefaults("bardan"))
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Bardan
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {destinationLines.map((line, idx) => (
                  <div key={`dst-${idx}`} className="space-y-1">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                      {isBrandTransferVoucher ? (
                        renderLinkedDestinationGodown(idx, line, sourceLines[idx]?.godownName)
                      ) : (
                        <div className="md:col-span-3 space-y-1.5">
                          <Label>Godown</Label>
                          <SearchableGodownSelect
                            value={line.godownName}
                            godowns={godowns}
                            onValueChange={(v) =>
                              updateLine(setDestinationLines, destinationLines, idx, "godownName", v, {
                                clearStockItemOnGodownChange: false,
                              })
                            }
                          />
                        </div>
                      )}
                      <div className="md:col-span-4 space-y-1.5">
                        <Label>Stock Item</Label>
                        {linksDestinationStockFromSource ? (
                          <Input
                            className="h-10 bg-muted/50"
                            readOnly
                            value={sourceLines[idx]?.stockItemName || line.stockItemName || ""}
                            placeholder="Select item in source section"
                          />
                        ) : (
                          <Select
                            value={line.stockItemName}
                            onOpenChange={(open) => {
                              if (!open) return;
                              const rowKey = getRowKey("destination", idx);
                              const search = itemSearchByRow[rowKey] || "";
                              const key = getStockItemsContextKey(
                                "destination",
                                line.godownName,
                                rowKey,
                                search,
                                {},
                                "destination"
                              );
                              if (!stockItemsByContext[key]) {
                                loadStockItemsForContext("destination", "", rowKey, search, 1, false, {}, {
                                  rowSection: "destination",
                                });
                              }
                            }}
                            onValueChange={(v) =>
                              onSelectStockItem(setDestinationLines, destinationLines, idx, v, "destination", "destination")
                            }
                          >
                            <SelectTrigger className="h-10"><SelectValue placeholder="Select item" /></SelectTrigger>
                            <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
                              {renderStockItemPickerContent("destination", "destination", idx, line.godownName, line.stockItemName)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {renderBatchField(setDestinationLines, destinationLines, idx, line, {
                        section: "destination",
                        isDestination: true,
                      })}
                      {renderQtyWeightInput(setDestinationLines, destinationLines, idx, line, {
                        readOnly: isStockTransferVoucher,
                        readOnlyLine: sourceLines[idx],
                      })}
                      {!isStockTransferVoucher ? (
                        renderDeleteColumn(setDestinationLines, destinationLines, idx)
                      ) : (
                        <div className="hidden md:block md:col-span-1" aria-hidden />
                      )}
                    </div>
                    {renderLineMetaRow(line, "destination", idx, {
                      listType: "destination",
                      itemsLoadingLabel: "Loading destination items...",
                      showBatchLoading: false,
                    })}
                  </div>
                ))}
                {destinationBardanLines.map((line, idx) => (
                  <div key={`brd-in-dst-${idx}`} className="space-y-1 border-t pt-3 mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                      {isBrandTransferVoucher ? (
                        renderLinkedDestinationGodown(idx, line, sourceBardanLines[idx]?.godownName)
                      ) : (
                        <div className="md:col-span-3 space-y-1.5">
                          <Label>Godown</Label>
                          <SearchableGodownSelect
                            value={line.godownName}
                            godowns={godowns}
                            onValueChange={(v) =>
                              updateLine(setDestinationBardanLines, destinationBardanLines, idx, "godownName", v, {
                                clearStockItemOnGodownChange: false,
                              })
                            }
                          />
                        </div>
                      )}
                      <div className="md:col-span-4 space-y-1.5">
                        <Label>Bardan Item</Label>
                        <Select
                          value={line.stockItemName}
                          onOpenChange={(open) => {
                            if (!open) return;
                            const rowKey = getRowKey("destination-bardan", idx);
                            const search = itemSearchByRow[rowKey] || "";
                            const key = getStockItemsContextKey(
                              "bardan",
                              line.godownName,
                              rowKey,
                              search,
                              {},
                              "destination-bardan"
                            );
                            if (!stockItemsByContext[key]) {
                              loadStockItemsForContext("bardan", "", rowKey, search, 1, false, {}, {
                                rowSection: "destination-bardan",
                              });
                            }
                          }}
                          onValueChange={(v) =>
                            onSelectStockItem(setDestinationBardanLines, destinationBardanLines, idx, v, "bardan", "destination-bardan")
                          }
                        >
                          <SelectTrigger className="h-10"><SelectValue placeholder="Select bardan item" /></SelectTrigger>
                          <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
                            {renderStockItemPickerContent("bardan", "destination-bardan", idx, line.godownName, line.stockItemName)}
                          </SelectContent>
                        </Select>
                      </div>
                      {renderBatchField(setDestinationBardanLines, destinationBardanLines, idx, line, {
                        section: "destination-bardan",
                        isDestination: true,
                      })}
                      {renderQtyWeightInput(setDestinationBardanLines, destinationBardanLines, idx, line)}
                      {renderDeleteColumn(setDestinationBardanLines, destinationBardanLines, idx)}
                    </div>
                    {renderLineMetaRow(line, "destination-bardan", idx, {
                      listType: "bardan",
                      itemsLoadingLabel: "Loading items...",
                      showBatchLoading: false,
                    })}
                  </div>
                ))}
                <div className="text-sm font-semibold pt-1">Total Destination Weight: {formatSectionTotalDisplay(destinationLines)}</div>
                {destinationBardanLines.length > 0 && (
                  <div className="text-sm font-semibold pt-1">Total Bardan Weight: {formatSectionTotalDisplay(destinationBardanLines)}</div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button className="w-full md:w-auto" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : (isEditMode ? "Update" : "Submit")}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

