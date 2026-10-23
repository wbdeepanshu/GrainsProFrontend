import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  FileText,
  Loader2,
  Menu,
  Package,
  Plus,
  Receipt,
  Save,
  Trash2,
} from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { fetchDeliveryNoteDetail, fetchDeliveryNotes } from "@/lib/outward_api";
import {
  formatSelectedInvoiceNumbers,
  parseSelectedInvoiceNumbers,
  toNumber as helperToNumber,
  parseRate as helperParseRate,
} from "@/lib/return_helpers";
import { createOrUpdateSalesReturn } from "@/lib/sales_api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const RETURN_TYPE_OPTIONS = [
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
];

const toNumber = (value) => helperToNumber(value);
const parseRate = (rawRate) => helperParseRate(rawRate);

let rowSequence = 0;
function createEmptyLine() {
  rowSequence += 1;
  return {
    key: `return-line-${Date.now()}-${rowSequence}`,
    stock_item_id: "",
    stock_item_name: "",
    return_qty: "1",
    rate: "0",
    uom: "",
    remarks: "",
    delivery_note_number: "",
    from_invoice: false,
    itemDropdownOpen: false,
    itemSearch: "",
  };
}

function formatInvoiceLabel(row) {
  return (
    row?.invoice_number ||
    row?.bill_no ||
    row?.order_id ||
    row?.so_number ||
    `DN #${row?.outward_sales_order_id || row?.id || ""}`
  );
}

function getInvoiceRowKey(row) {
  return String(row?.outward_sales_order_id || row?.id || "");
}

function parseDisplayQty(value) {
  if (value == null || value === "") return 0;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function appendDeliveryNoteNumber(existing, incoming) {
  const next = String(incoming || "").trim();
  if (!next) return String(existing || "").trim();
  const parts = String(existing || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.includes(next)) parts.push(next);
  return parts.join(", ");
}

function mapInvoiceItemToReturnLine(dnItem, options = {}) {
  const stockItemId = dnItem.item || dnItem.stock_item_id;
  const qty =
    parseDisplayQty(dnItem.loaded_quantity) ||
    parseDisplayQty(dnItem.loaded_qty) ||
    parseDisplayQty(dnItem.total_quantity) ||
    parseDisplayQty(dnItem.quantity);
  if (!stockItemId || qty <= 0) return null;

  const rate = parseRate(dnItem.rate);
  const uom = dnItem.base_unit?.name || dnItem.uom || "";
  rowSequence += 1;

  return {
    key: `invoice-item-${dnItem.id}-${Date.now()}-${rowSequence}`,
    stock_item_id: String(stockItemId),
    stock_item_name: dnItem.item_name || dnItem.stock_item_name || `Item #${stockItemId}`,
    return_qty: String(qty),
    rate: rate ? String(rate) : "0",
    uom,
    remarks: dnItem.remarks || dnItem.sup_remarks || "",
    delivery_note_number: options.deliveryNoteNumber || "",
    from_invoice: true,
    itemDropdownOpen: false,
    itemSearch: "",
  };
}

function lineAmount(line) {
  return toNumber(line.return_qty) * toNumber(line.rate);
}

function displayOutwardDate(value) {
  if (!value) return "—";
  const raw = String(value).trim();
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    try {
      return format(new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`), "dd MMM yy");
    } catch {
      return raw;
    }
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    try {
      return format(new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`), "dd MMM yy");
    } catch {
      return raw;
    }
  }
  return raw;
}

export default function AddSalesReturn() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(
    typeof searchString === "string"
      ? searchString
      : typeof window !== "undefined"
        ? window.location.search
        : "",
  );
  const editId = searchParams.get("edit");
  const editIdNum = editId ? parseInt(editId, 10) : null;
  const isEditMode = !!editIdNum && !Number.isNaN(editIdNum);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [returnDate, setReturnDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [returnType, setReturnType] = useState("");
  const [remarks, setRemarks] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [items, setItems] = useState(() => [createEmptyLine()]);
  const [selectedInvoiceKeys, setSelectedInvoiceKeys] = useState(() => new Set());
  const [selectedInvoiceLabels, setSelectedInvoiceLabels] = useState([]);
  const [activeItemSearch, setActiveItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");

  const [invoicePickerRow, setInvoicePickerRow] = useState(null);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const [selectedInvoiceItemIds, setSelectedInvoiceItemIds] = useState(() => new Set());

  const canCreate =
    hasPermission("sales_return", "create") || hasPermission("sales_order", "create");
  const canUpdate =
    hasPermission("sales_return", "update") || hasPermission("sales_order", "update");
  const canAccess = isEditMode ? canUpdate : canCreate;

  useEffect(() => {
    const t = setTimeout(() => setIsBootLoading(false), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerSearch(customerSearchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [customerSearchTerm]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedItemSearch(activeItemSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [activeItemSearch]);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-for-sales-return"],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const json = await res.json();
      return json?.data || json?.branches || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (branchId || !branches.length) return;
    const first = branches[0];
    const id = first?.id ?? first?.branch_id;
    if (id != null) setBranchId(String(id));
  }, [branches, branchId]);

  const { data: customers = [], isFetching: customersLoading } = useQuery({
    queryKey: ["customers-for-sales-return", debouncedCustomerSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("per_page", "1000");
      if (debouncedCustomerSearch) params.append("search", debouncedCustomerSearch);
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`,
      );
      const json = await res.json();
      return json?.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const invoiceDateRange = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 30);
    return {
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
    };
  }, []);

  const {
    data: deliveryNotesData,
    isLoading: deliveryNotesLoading,
    isFetching: deliveryNotesFetching,
  } = useQuery({
    queryKey: ["sales-return-invoices", customerId, invoiceDateRange],
    queryFn: () =>
      fetchDeliveryNotes({
        start_date: invoiceDateRange.start_date,
        end_date: invoiceDateRange.end_date,
      }),
    enabled: !!AuthService.getAccessToken() && !!customerId && !isEditMode,
    refetchOnWindowFocus: false,
  });

  const invoiceRows = useMemo(() => {
    const rows = deliveryNotesData?.data || [];
    return rows.filter((row) => {
      if (!(row.order_id || row.sales_order_id || row.outward_sales_order_id)) return false;
      const partyId = row.party_info?.id ?? row.customer_id;
      if (customerId && partyId != null && String(partyId) !== String(customerId)) {
        return false;
      }
      if (customerId && partyId == null) {
        const name = String(row.customer_name || row.party_info?.name || "")
          .trim()
          .toLowerCase();
        if (name && name !== String(customerName || "").trim().toLowerCase()) return false;
      }
      return true;
    });
  }, [deliveryNotesData, customerId, customerName]);

  const { data: stockItems = [], isFetching: stockItemsLoading } = useQuery({
    queryKey: ["sales-return-stock-items", customerId, debouncedItemSearch],
    queryFn: async () => {
      const res = await apiRequest("POST", `${API_BASE_URL}/api/get-stock-items/`, {
        search: debouncedItemSearch || "",
        page: 1,
        per_page: 100,
      });
      const json = await res.json();
      const list = json?.data?.stock_items || json?.data || json?.stock_items || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: !!AuthService.getAccessToken() && !!customerId && !isEditMode,
    refetchOnWindowFocus: false,
  });

  const { data: salesReturnDetail, isLoading: editLoading } = useQuery({
    queryKey: ["sales-return-detail", editIdNum],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/sales-return-orders/${editIdNum}/`,
      );
      const json = await res.json();
      if (json?.status !== 200 || !json?.data) {
        throw new Error(json?.message || "Failed to load sales return");
      }
      return json.data;
    },
    enabled: isEditMode && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!salesReturnDetail) return;
    setSalesOrderId(String(salesReturnDetail.order_id || salesReturnDetail.so_number || ""));
    setCustomerName(salesReturnDetail.customer_name || "");
    setCustomerId(
      salesReturnDetail.customer_id != null ? String(salesReturnDetail.customer_id) : "",
    );
    if (salesReturnDetail.branch_id != null) {
      setBranchId(String(salesReturnDetail.branch_id));
    }
    setRemarks(salesReturnDetail.remarks || "");
    setReturnType(String(salesReturnDetail.return_type || "").toLowerCase());
    if (salesReturnDetail.return_date) {
      const raw = String(salesReturnDetail.return_date);
      const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      setReturnDate(dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : raw.slice(0, 10));
    }
    setSelectedInvoiceLabels(
      parseSelectedInvoiceNumbers(salesReturnDetail.selected_invoice_numbers),
    );
    setItems(
      (salesReturnDetail.items || []).map((line, idx) => ({
        key: `existing-${line.id || idx}`,
        stock_item_id: String(line.stock_item_id || ""),
        stock_item_name: line.stock_item_name || "",
        return_qty: line.return_qty != null ? String(line.return_qty) : "1",
        rate: parseRate(line.rate) ? String(parseRate(line.rate)) : "0",
        uom: line.uom || line.rate_per_unit || "",
        remarks: line.remarks || "",
        delivery_note_number: line.delivery_note_number || "",
        from_invoice: Boolean(line.delivery_note_number),
        itemDropdownOpen: false,
        itemSearch: "",
      })),
    );
  }, [salesReturnDetail]);

  const resetCreateForm = () => {
    setCustomerId("");
    setCustomerName("");
    setCustomerSearchTerm("");
    setReturnDate(format(new Date(), "yyyy-MM-dd"));
    setReturnType("");
    setRemarks("");
    setSalesOrderId("");
    setItems([createEmptyLine()]);
    setSelectedInvoiceKeys(new Set());
    setSelectedInvoiceLabels([]);
    setInvoicePickerRow(null);
    setInvoiceDetail(null);
    setSelectedInvoiceItemIds(new Set());
  };

  const handleBranchChange = (value) => {
    if (String(value) === String(branchId)) return;
    setBranchId(value);
    setCustomerId("");
    setCustomerName("");
    setCustomerSearchTerm("");
    setSalesOrderId("");
    setItems([createEmptyLine()]);
    setSelectedInvoiceKeys(new Set());
    setSelectedInvoiceLabels([]);
  };

  const handleCustomerSelect = (customer) => {
    const nextId = String(customer.id);
    if (nextId !== String(customerId)) {
      setSalesOrderId("");
      setItems([createEmptyLine()]);
      setSelectedInvoiceKeys(new Set());
      setSelectedInvoiceLabels([]);
    }
    setCustomerId(nextId);
    setCustomerName(customer.name || "");
    setCustomerDropdownOpen(false);
    setCustomerSearchTerm("");
  };

  const openInvoiceItemPicker = async (row) => {
    const osoId = row?.outward_sales_order_id || row?.id;
    if (!osoId) return;

    const rowSo = String(row.order_id || row.sales_order_id || row.so_number || "");
    if (salesOrderId && rowSo && rowSo !== String(salesOrderId)) {
      toast({
        title: "Different sales order",
        description:
          "This invoice belongs to another sales order. One return can only include invoices from the same SO.",
        variant: "destructive",
      });
      return;
    }

    setInvoicePickerRow(row);
    setInvoiceDetail(null);
    setSelectedInvoiceItemIds(new Set());
    setInvoiceDetailLoading(true);
    try {
      const detail = await fetchDeliveryNoteDetail(osoId);
      setInvoiceDetail(detail);
      const detailItems = (detail?.items || []).filter(
        (item) =>
          parseDisplayQty(item.loaded_quantity || item.loaded_qty || item.total_quantity) > 0,
      );
      setSelectedInvoiceItemIds(new Set(detailItems.map((item) => String(item.id))));
    } catch (error) {
      toast({
        title: "Unable to load invoice items",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
      setInvoicePickerRow(null);
    } finally {
      setInvoiceDetailLoading(false);
    }
  };

  const closeInvoiceItemPicker = () => {
    setInvoicePickerRow(null);
    setInvoiceDetail(null);
    setSelectedInvoiceItemIds(new Set());
    setInvoiceDetailLoading(false);
  };

  const toggleInvoiceItemSelection = (itemId) => {
    const key = String(itemId);
    setSelectedInvoiceItemIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const invoicePickerItems = useMemo(() => {
    return (invoiceDetail?.items || []).filter(
      (item) =>
        parseDisplayQty(item.loaded_quantity || item.loaded_qty || item.total_quantity) > 0,
    );
  }, [invoiceDetail]);

  const allInvoiceItemsSelected =
    invoicePickerItems.length > 0 &&
    invoicePickerItems.every((item) => selectedInvoiceItemIds.has(String(item.id)));

  const someInvoiceItemsSelected =
    invoicePickerItems.some((item) => selectedInvoiceItemIds.has(String(item.id))) &&
    !allInvoiceItemsSelected;

  const selectAllInvoiceItems = () => {
    setSelectedInvoiceItemIds(new Set(invoicePickerItems.map((item) => String(item.id))));
  };

  const unselectAllInvoiceItems = () => {
    setSelectedInvoiceItemIds(new Set());
  };

  const toggleAllInvoiceItems = (checked) => {
    if (checked) selectAllInvoiceItems();
    else unselectAllInvoiceItems();
  };

  const confirmInvoiceItemSelection = () => {
    const detailItems = invoiceDetail?.items || [];
    const selectedItems = detailItems.filter((item) =>
      selectedInvoiceItemIds.has(String(item.id)),
    );
    if (!selectedItems.length) {
      toast({
        title: "Select items",
        description: "Select at least one item from the invoice",
        variant: "destructive",
      });
      return;
    }

    const deliveryNoteNumber =
      formatInvoiceLabel(invoicePickerRow) || formatInvoiceLabel(invoiceDetail);
    const newLines = selectedItems
      .map((item) => mapInvoiceItemToReturnLine(item, { deliveryNoteNumber }))
      .filter(Boolean);

    if (!newLines.length) {
      toast({
        title: "No usable items",
        description: "Selected invoice items could not be mapped",
        variant: "destructive",
      });
      return;
    }

    const invoiceKey = getInvoiceRowKey(invoicePickerRow);
    const invoiceLabel = formatInvoiceLabel(invoicePickerRow);
    const invoiceSoNumber =
      invoicePickerRow?.order_id ||
      invoicePickerRow?.sales_order_id ||
      invoiceDetail?.order_id ||
      invoiceDetail?.sales_order_id ||
      "";

    setItems((current) => {
      const kept = current.filter((line) => line.stock_item_id);
      const merged = [...kept];
      newLines.forEach((line) => {
        const existingIndex = merged.findIndex(
          (existing) => String(existing.stock_item_id) === String(line.stock_item_id),
        );
        if (existingIndex >= 0) {
          const existing = merged[existingIndex];
          const combinedQty = toNumber(existing.return_qty) + toNumber(line.return_qty);
          merged[existingIndex] = {
            ...existing,
            return_qty: String(combinedQty),
            delivery_note_number: appendDeliveryNoteNumber(
              existing.delivery_note_number,
              line.delivery_note_number,
            ),
            from_invoice: true,
          };
        } else {
          merged.push(line);
        }
      });
      return merged.length ? merged : newLines;
    });

    setSelectedInvoiceKeys((current) => {
      const next = new Set(current);
      next.add(invoiceKey);
      return next;
    });
    setSelectedInvoiceLabels((current) =>
      current.includes(invoiceLabel) ? current : [...current, invoiceLabel],
    );
    if (invoiceSoNumber) {
      setSalesOrderId((current) => current || String(invoiceSoNumber));
    }
    closeInvoiceItemPicker();
  };

  const updateLine = (key, changes) => {
    setItems((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
  };

  const selectStockItemForLine = (lineKey, stockItem) => {
    const baseUnit =
      stockItem.base_unit?.name ||
      stockItem.base_units?.name ||
      stockItem.uom ||
      "";
    updateLine(lineKey, {
      stock_item_id: String(stockItem.id),
      stock_item_name: stockItem.name || `Item #${stockItem.id}`,
      uom: baseUnit,
      rate: stockItem.rate != null ? String(parseRate(stockItem.rate) || stockItem.rate) : "0",
      from_invoice: false,
      delivery_note_number: "",
      itemDropdownOpen: false,
      itemSearch: "",
    });
    setActiveItemSearch("");
  };

  const removeLine = (key) => {
    setItems((current) => {
      const next = current.filter((line) => line.key !== key);
      return next.length ? next : [createEmptyLine()];
    });
  };

  const addLine = () => {
    setItems((current) => [...current, createEmptyLine()]);
  };

  const totalAmount = useMemo(
    () => items.reduce((sum, line) => sum + lineAmount(line), 0),
    [items],
  );

  const mutateSave = useMutation({
    mutationFn: createOrUpdateSalesReturn,
    onSuccess: (json) => {
      if (json?.status === 200) {
        toast({
          title: "Success",
          description: json.message || "Sales return saved",
          className: "bg-green-50 border-green-100 text-green-800",
        });
        if (!isEditMode) resetCreateForm();
        window.location.href = "/reports/sales-return-reports";
      } else {
        toast({
          title: "Error",
          description: json?.message || "Unable to save sales return",
          variant: "destructive",
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Unable to save sales return",
        variant: "destructive",
      });
    },
  });

  const onSubmit = () => {
    if (!branchId) {
      toast({ title: "Validation", description: "Select a branch", variant: "destructive" });
      return;
    }
    if (!customerId) {
      toast({ title: "Validation", description: "Select a customer", variant: "destructive" });
      return;
    }
    if (!returnDate) {
      toast({ title: "Validation", description: "Select return date", variant: "destructive" });
      return;
    }
    if (!returnType || !["cancelled", "rescheduled"].includes(returnType)) {
      toast({
        title: "Validation",
        description: "Select return type (Cancelled or Rescheduled)",
        variant: "destructive",
      });
      return;
    }

    const validItems = items.filter(
      (line) => line.stock_item_id && toNumber(line.return_qty) > 0,
    );
    if (!validItems.length) {
      toast({
        title: "Validation",
        description: "Select at least one item and enter its quantity",
        variant: "destructive",
      });
      return;
    }
    if (validItems.length !== items.filter((l) => l.stock_item_id || toNumber(l.return_qty) > 0 || l.from_invoice).length
      && items.some((l) => !l.stock_item_id && (toNumber(l.return_qty) > 0 || l.remarks))) {
      toast({
        title: "Validation",
        description: "Complete or remove empty item rows",
        variant: "destructive",
      });
      return;
    }

    const orderId = String(salesOrderId || "").trim();
    if (!orderId) {
      toast({
        title: "Validation",
        description: "Select items from a sales invoice so the linked sales order can be set",
        variant: "destructive",
      });
      return;
    }

    const invoiceList =
      selectedInvoiceLabels.length > 0
        ? selectedInvoiceLabels
        : parseSelectedInvoiceNumbers(
            validItems.map((line) => line.delivery_note_number).filter(Boolean).join(", "),
          );

    if (!invoiceList.length) {
      toast({
        title: "Validation",
        description: "Select items from at least one sales invoice",
        variant: "destructive",
      });
      return;
    }

    mutateSave.mutate({
      ...(isEditMode ? { sales_return_id: editIdNum } : {}),
      order_id: orderId,
      so_number: orderId,
      remarks,
      return_type: returnType,
      return_date: returnDate,
      selected_invoice_numbers: formatSelectedInvoiceNumbers(invoiceList),
      status: "pending",
      items: validItems.map((line) => ({
        stock_item_id: Number(line.stock_item_id),
        return_qty: toNumber(line.return_qty),
        quantity: toNumber(line.return_qty),
        rate: line.rate === "" ? null : toNumber(line.rate),
        uom: line.uom,
        remarks: line.remarks || "",
        delivery_note_number: line.delivery_note_number || undefined,
      })),
    });
  };

  if (isBootLoading || permissionsLoading || (isEditMode && editLoading)) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="flex-1 flex items-center justify-center">
          <Loader />
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-gray-600">
            You do not have permission to {isEditMode ? "update" : "create"} sales returns.
          </p>
        </div>
      </div>
    );
  }

  if (
    isEditMode &&
    salesReturnDetail &&
    String(salesReturnDetail.status || "").toLowerCase() !== "pending"
  ) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-amber-50 border border-amber-200 rounded-lg p-8 max-w-md">
            <h3 className="text-lg font-semibold text-amber-900 mb-2">Cannot Edit</h3>
            <p className="text-amber-800 mb-4">Only pending sales returns can be edited.</p>
            <Button onClick={() => window.history.back()} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showBranchFilter = branches.length > 1;
  const selectedStockIds = new Set(
    items.map((line) => String(line.stock_item_id || "")).filter(Boolean),
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button variant="outline" size="sm" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                window.location.href = "/reports/sales-return-reports";
              }}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? "Edit Sales Return" : "Add Sales Return"}
              </h1>
              <p className="text-gray-600">
                Select branch and customer, pick items from sales invoices or add manually.
              </p>
            </div>
          </div>
          <Badge variant="outline">
            {format(new Date(`${returnDate}T00:00:00`), "dd/MM/yyyy")}
          </Badge>
        </div>

        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 min-h-0">
          <div className="max-w-7xl mx-auto space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Basic Information
                  </CardTitle>
                  {showBranchFilter ? (
                    <div className="w-full lg:w-72">
                      <Label className="text-xs">
                        Branch <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={branchId}
                        onValueChange={handleBranchChange}
                        disabled={isEditMode}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => {
                            const id = String(branch.id ?? branch.branch_id);
                            return (
                              <SelectItem key={id} value={id}>
                                {branch.name || branch.branch_name || `Branch #${id}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>
                    Customer <span className="text-red-500">*</span>
                  </Label>
                  <Popover
                    open={customerDropdownOpen}
                    onOpenChange={(open) => {
                      if (isEditMode) return;
                      setCustomerDropdownOpen(open);
                      if (!open) setCustomerSearchTerm("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between text-left mt-1"
                        disabled={isEditMode}
                      >
                        <span className="truncate">{customerName || "Select customer"}</span>
                        {!isEditMode && (
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0 z-50"
                      align="start"
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search customer..."
                          value={customerSearchTerm}
                          onValueChange={setCustomerSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                              {customersLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Searching...
                                </>
                              ) : (
                                "No customers found"
                              )}
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              {customers.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={String(customer.id)}
                                  onSelect={() => handleCustomerSelect(customer)}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      String(customerId) === String(customer.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                  <span className="truncate">{customer.name}</span>
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>
                    Return Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label>
                    Return Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={returnType} onValueChange={setReturnType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select return type" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Remarks</Label>
                  <Input
                    className="mt-1"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional remarks..."
                  />
                </div>
              </CardContent>
            </Card>

            {!isEditMode && customerId ? (
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Receipt className="h-5 w-5 text-slate-700 mt-0.5" />
                      <div>
                        <CardTitle className="text-base">Sales Invoices (Last 30 days)</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Select items from one or more invoices. You can keep adding from other
                          invoices.
                        </p>
                        {selectedInvoiceLabels.length ? (
                          <p className="text-xs text-blue-800 mt-1.5">
                            Selected:{" "}
                            <span className="font-medium">{selectedInvoiceLabels.join(", ")}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {deliveryNotesFetching && !deliveryNotesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {deliveryNotesLoading ? (
                    <div className="py-10 flex justify-center">
                      <Loader />
                    </div>
                  ) : invoiceRows.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-10">
                      No sales invoices found for this customer in the last 30 days.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border rounded-md">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-slate-50 border-b text-slate-600">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Invoice Number</th>
                            <th className="px-4 py-3 text-left font-semibold">Date</th>
                            <th className="px-4 py-3 text-center font-semibold">Items</th>
                            <th className="px-4 py-3 text-right font-semibold">Amount</th>
                            <th className="px-4 py-3 text-right font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {invoiceRows.map((row) => {
                            const invoiceKey = getInvoiceRowKey(row);
                            const invoiceLabel = formatInvoiceLabel(row);
                            const isSelected =
                              selectedInvoiceKeys.has(invoiceKey) ||
                              selectedInvoiceLabels.includes(invoiceLabel);
                            return (
                              <tr key={invoiceKey} className="hover:bg-slate-50/80">
                                <td className="px-4 py-3 font-medium text-slate-900">
                                  {invoiceLabel}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {displayOutwardDate(row.outward_date_iso || row.outward_date)}
                                </td>
                                <td className="px-4 py-3 text-center text-slate-700">
                                  {row.item_count ?? row.total_items_count ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-right font-medium tabular-nums">
                                  ₹
                                  {Number(row.total_amount || 0).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className={
                                      isSelected
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                        : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                                    }
                                    onClick={() => openInvoiceItemPicker(row)}
                                  >
                                    {isSelected ? "Add more items" : "Select items"}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5" />
                    Return Items ({items.filter((l) => l.stock_item_id).length || items.length})
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full min-w-[1100px] text-sm">
                    <thead className="bg-slate-50 border-b text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Item
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase w-[140px]">
                          Sales Invoice
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase w-[120px]">
                          Quantity
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase w-[120px]">
                          Rate
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase w-[110px]">
                          UOM
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Remarks
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase w-[120px]">
                          Amount
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase w-[72px]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((line) => {
                        const itemOptions = stockItems.filter(
                          (item) =>
                            String(item.id) === String(line.stock_item_id) ||
                            !selectedStockIds.has(String(item.id)),
                        );
                        return (
                          <tr
                            key={line.key}
                            className="border-b align-middle hover:bg-slate-50/60"
                          >
                            <td className="p-2 min-w-[220px]">
                              {line.from_invoice ? (
                                <div className="h-9 flex items-center px-3 rounded-md border bg-slate-50 text-sm font-medium">
                                  {line.stock_item_name || `Item #${line.stock_item_id}`}
                                </div>
                              ) : (
                                <Popover
                                  open={Boolean(line.itemDropdownOpen)}
                                  onOpenChange={(open) => {
                                    updateLine(line.key, {
                                      itemDropdownOpen: open,
                                      itemSearch: open ? line.itemSearch || "" : "",
                                    });
                                    if (open) setActiveItemSearch(line.itemSearch || "");
                                    else setActiveItemSearch("");
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="w-full h-9 justify-between text-left font-normal"
                                      disabled={!customerId}
                                    >
                                      <span className="truncate">
                                        {line.stock_item_name ||
                                          (customerId
                                            ? "Select stock item"
                                            : "Select branch and customer first")}
                                      </span>
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[--radix-popover-trigger-width] p-0 z-50"
                                    align="start"
                                  >
                                    <Command shouldFilter={false}>
                                      <CommandInput
                                        placeholder="Search item name..."
                                        value={line.itemSearch || ""}
                                        onValueChange={(value) => {
                                          updateLine(line.key, { itemSearch: value });
                                          setActiveItemSearch(value);
                                        }}
                                      />
                                      <CommandList>
                                        <CommandEmpty>
                                          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                                            {stockItemsLoading ? (
                                              <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Searching...
                                              </>
                                            ) : (
                                              "No stock items found"
                                            )}
                                          </div>
                                        </CommandEmpty>
                                        <CommandGroup>
                                          <ScrollArea className="h-56">
                                            {itemOptions.map((item) => (
                                              <CommandItem
                                                key={item.id}
                                                value={String(item.id)}
                                                onSelect={() =>
                                                  selectStockItemForLine(line.key, item)
                                                }
                                                className="cursor-pointer"
                                              >
                                                <Check
                                                  className={`mr-2 h-4 w-4 ${
                                                    String(line.stock_item_id) === String(item.id)
                                                      ? "opacity-100"
                                                      : "opacity-0"
                                                  }`}
                                                />
                                                <span className="truncate">
                                                  {item.name || `Item #${item.id}`}
                                                </span>
                                              </CommandItem>
                                            ))}
                                          </ScrollArea>
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </td>
                            <td className="p-2">
                              <div
                                className="h-9 flex items-center px-2 text-xs font-semibold text-indigo-700"
                                title={line.delivery_note_number || undefined}
                              >
                                {line.delivery_note_number || "—"}
                              </div>
                            </td>
                            <td className="p-2">
                              <Input
                                className="h-9 text-center"
                                value={line.return_qty}
                                onChange={(e) => {
                                  if (/^\d*\.?\d*$/.test(e.target.value)) {
                                    updateLine(line.key, { return_qty: e.target.value });
                                  }
                                }}
                                placeholder="Qty"
                              />
                            </td>
                            <td className="p-2">
                              {line.from_invoice ? (
                                <div className="h-9 flex items-center justify-center rounded-md border bg-slate-50 tabular-nums">
                                  {line.rate || "0.00"}
                                </div>
                              ) : (
                                <Input
                                  className="h-9 text-center"
                                  value={line.rate}
                                  onChange={(e) => {
                                    if (/^\d*\.?\d*$/.test(e.target.value)) {
                                      updateLine(line.key, { rate: e.target.value });
                                    }
                                  }}
                                />
                              )}
                            </td>
                            <td className="p-2">
                              <div className="h-9 flex items-center justify-center rounded-md border bg-slate-50 text-sm">
                                {line.uom || (line.stock_item_id ? "—" : "Select item first")}
                              </div>
                            </td>
                            <td className="p-2">
                              <Input
                                className="h-9"
                                value={line.remarks}
                                onChange={(e) =>
                                  updateLine(line.key, { remarks: e.target.value })
                                }
                                placeholder="Optional"
                              />
                            </td>
                            <td className="p-2 text-right font-medium text-emerald-700 tabular-nums">
                              ₹
                              {lineAmount(line).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeLine(line.key)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Estimated total:{" "}
                    <span className="font-semibold text-foreground">
                      ₹
                      {totalAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </p>
                  <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={mutateSave.isPending}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {mutateSave.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save return
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog
        open={Boolean(invoicePickerRow)}
        onOpenChange={(open) => {
          if (!open) closeInvoiceItemPicker();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Select items — {formatInvoiceLabel(invoicePickerRow || {})}
            </DialogTitle>
          </DialogHeader>
          {invoiceDetailLoading ? (
            <div className="py-10 flex justify-center">
              <Loader />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {selectedInvoiceItemIds.size} of {invoicePickerItems.length} selected
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={selectAllInvoiceItems}
                    disabled={!invoicePickerItems.length || allInvoiceItemsSelected}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={unselectAllInvoiceItems}
                    disabled={!invoicePickerItems.length || selectedInvoiceItemIds.size === 0}
                  >
                    Unselect all
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto border rounded-md max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <Checkbox
                          checked={
                            allInvoiceItemsSelected
                              ? true
                              : someInvoiceItemsSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) => toggleAllInvoiceItems(Boolean(checked))}
                          aria-label="Select all items"
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Loaded Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-left">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicePickerItems.map((item) => {
                      const checked = selectedInvoiceItemIds.has(String(item.id));
                      return (
                        <tr key={item.id} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleInvoiceItemSelection(item.id)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {item.item_name || `Item #${item.item}`}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {item.loaded_quantity ?? item.loaded_qty ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {item.rate != null ? Number(item.rate).toFixed(2) : "—"}
                          </td>
                          <td className="px-3 py-2">{item.base_unit?.name || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeInvoiceItemPicker}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmInvoiceItemSelection}
              disabled={invoiceDetailLoading}
            >
              Add selected items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
