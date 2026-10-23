import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Menu, Search, CalendarDays, CheckCircle, Clock, Users, Download, Settings, GripVertical, ArrowUp, ArrowDown, CalendarIcon, Edit3, Loader2, ChevronsUpDown } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const toDdMmYyyy = (dateText) => {
  const d = new Date(dateText);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

let generatedBy = "-";
try {
  const managerRaw = localStorage.getItem("cp_manager_user_data");
  if (managerRaw) {
    const managerParsed = JSON.parse(managerRaw);
    generatedBy =
      managerParsed?.name ||
      managerParsed?.data?.name ||
      managerParsed?.user?.name ||
      generatedBy;
  }
} catch {
  // ignore localStorage parse errors
}

const getBranchId = (row) =>
  row.branch_id != null && row.branch_id !== ""
    ? String(row.branch_id)
    : "";

const getBranchValue = (row) =>
  row.branch_name ||
  row.branch ||
  row.inward_branch_name ||
  row.po_branch_name ||
  "";

const getCreatedByValue = (row) =>
  row.created_by ||
  row.created_by_name ||
  row.creator ||
  "";

const getBrokerNameValue = (row) => {
  if (row.broker_name) return String(row.broker_name).trim();
  if (row.broker && typeof row.broker === "object" && row.broker.name) {
    return String(row.broker.name).trim();
  }
  if (typeof row.broker === "string") return row.broker.trim();
  return "";
};

const getPartyNameValue = (row) =>
  row.party_name ||
  row.supplier_name ||
  row.vendor_name ||
  "";

const getItemNameValue = (row) =>
  row.item_name ||
  row.stock_item_name ||
  row.product_name ||
  "";

const getStatusValue = (row) =>
  row.status ||
  row.po_status ||
  row.inward_status ||
  "";

const normalizeStatusValue = (status) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const formatStatusLabel = (status) => {
  const normalized = normalizeStatusValue(status);
  if (!normalized) return "-";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const NUMERIC_RANGE_FILTER_FIELDS = [
  { key: "pending_qty", label: "Pending Qty" },
  { key: "rate", label: "Rate" },
  { key: "amount", label: "Amount" },
  { key: "aging", label: "Aging" },
];

const parseNumericFilterValue = (raw) => {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const text = String(raw).trim();
  if (!text) return NaN;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : NaN;
};

const getRowNumericFilterValue = (row, fieldKey) => {
  switch (fieldKey) {
    case "pending_qty":
      return parseNumericFilterValue(row.pending_qty);
    case "rate":
      return parseNumericFilterValue(row.rate);
    case "amount":
      return parseNumericFilterValue(row.amount);
    case "aging":
      return parseNumericFilterValue(row.aging);
    default:
      return NaN;
  }
};

const matchesNumericRangeFilter = (row, fieldKey, minValue, maxValue) => {
  if (!fieldKey || fieldKey === "none") return true;

  const minTrim = String(minValue ?? "").trim();
  const maxTrim = String(maxValue ?? "").trim();
  if (!minTrim && !maxTrim) return true;

  const rowValue = getRowNumericFilterValue(row, fieldKey);
  if (Number.isNaN(rowValue)) return false;

  if (minTrim) {
    const min = Number.parseFloat(minTrim);
    if (Number.isFinite(min) && rowValue < min) return false;
  }
  if (maxTrim) {
    const max = Number.parseFloat(maxTrim);
    if (Number.isFinite(max) && rowValue > max) return false;
  }
  return true;
};

export default function POReports() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [updateStatusModal, setUpdateStatusModal] = useState({ open: false, row: null });
  const [updateStatusValue, setUpdateStatusValue] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("monthly");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [branchFilter, setBranchFilter] = useState("all");
  const [brokerFilter, setBrokerFilter] = useState("all");
  const [brokerDropdownOpen, setBrokerDropdownOpen] = useState(false);
  const [brokerSearchTerm, setBrokerSearchTerm] = useState("");
  const debouncedBrokerSearch = useDebounce((brokerSearchTerm || "").trim(), 300);
  const [partyNameFilter, setPartyNameFilter] = useState("all");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState("");
  const debouncedPartySearch = useDebounce((partySearchTerm || "").trim(), 300);
  const [itemNameFilter, setItemNameFilter] = useState("all");
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const debouncedItemSearch = useDebounce((itemSearchTerm || "").trim(), 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [numericRangeField, setNumericRangeField] = useState("none");
  const [numericRangeMin, setNumericRangeMin] = useState("");
  const [numericRangeMax, setNumericRangeMax] = useState("");
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    poNumber: true,
    partyName: true,
    itemName: true,
    poQty: true,
    rate: true,
    amount: true,
    receivedQty: true,
    pendingQty: true,
    dueDate: true,
    deliveryDate: true,
    aging: true,
    status: true,
    createdBy: true,
    updatedBy: true,
    updatedDate: true,
    remark: true,
    action: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    "status",
    "action",
    "date",
    "poNumber",
    "partyName",
    "itemName",
    "poQty",
    "rate",
    "amount",
    "receivedQty",
    "pendingQty",
    "dueDate",
    "deliveryDate",
    "aging",
    "createdBy",
    "updatedBy",
    "updatedDate",
    "remark",
  ]);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const columnOptions = [
    { key: "status", label: "Status" },
    { key: "date", label: "Date" },
    { key: "poNumber", label: "PO Number" },
    { key: "partyName", label: "Party Name" },
    { key: "itemName", label: "Item Name" },
    { key: "poQty", label: "PO Qty" },
    { key: "rate", label: "Rate" },
    { key: "amount", label: "Amount" },
    { key: "receivedQty", label: "Received Qty" },
    { key: "pendingQty", label: "Pending Qty" },
    { key: "dueDate", label: "Due Date" },
    { key: "deliveryDate", label: "Delivery Date" },
    { key: "aging", label: "Aging" },
    { key: "createdBy", label: "Created By" },
    { key: "updatedBy", label: "Updated By" },
    { key: "updatedDate", label: "Updated Date" },
    { key: "remark", label: "Remark" },
    { key: "action", label: "Action" },
  ];

  const shownColumnCount = Object.values(visibleColumns).filter(Boolean).length;
  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      if (prev[key] && shownColumnCount === 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const moveColumn = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(fromKey);
      const toIndex = next.indexOf(toKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const columnLayout = useMemo(() => ({
    date: { headerClass: "px-2 py-2 text-left w-[90px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Date", cell: (row) => row.created_at || "-", sortValue: (row) => row.created_at || "" },
    poNumber: {
      headerClass: "px-2 py-2 text-left w-[150px] whitespace-nowrap",
      cellClass: "px-2 py-2 whitespace-nowrap",
      header: "PO Number",
      cell: (row) => (
        <div>
          <div className="font-medium text-gray-900">{row.voucher_number || "-"}</div>
          {getBranchValue(row) ? (
            <div className="text-[10px] leading-tight text-gray-500 font-normal mt-0.5 truncate max-w-[140px]" title={getBranchValue(row)}>
              {getBranchValue(row)}
            </div>
          ) : null}
        </div>
      ),
      sortValue: (row) => row.voucher_number || "",
    },
    partyName: { headerClass: "px-2 py-2 text-left w-[190px]", cellClass: "px-2 py-2 break-words", header: "Party Name", cell: (row) => getPartyNameValue(row) || "-", sortValue: (row) => getPartyNameValue(row) || "" },
    itemName: { headerClass: "px-2 py-2 text-left w-[190px]", cellClass: "px-2 py-2 break-words", header: "Item Name", cell: (row) => getItemNameValue(row) || "-", sortValue: (row) => getItemNameValue(row) || "" },
    poQty: { headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "PO Qty", cell: (row) => row.po_qty || "-", sortValue: (row) => row.po_qty ?? "" },
    rate: { headerClass: "px-2 py-2 text-left w-[90px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Rate", cell: (row) => row.rate || "-", sortValue: (row) => row.rate ?? "" },
    amount: { headerClass: "px-2 py-2 text-left w-[110px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Amount", cell: (row) => row.amount ?? "-", sortValue: (row) => row.amount ?? "" },
    receivedQty: {
      headerClass: "px-2 py-2 text-left w-[110px] whitespace-nowrap",
      cellClass: "px-2 py-2 whitespace-nowrap",
      header: "Received Qty",
      cell: (row) =>
        row.received_qty != null
          ? `${row.received_qty} ${row.base_unit ?? ""}`.trim()
          : "-",
      sortValue: (row) => row.received_qty ?? ""
    },
    pendingQty: {
      headerClass: "px-2 py-2 text-left w-[110px] whitespace-nowrap",
      cellClass: "px-2 py-2 whitespace-nowrap",
      header: "Pending Qty",
      cell: (row) =>
        row.pending_qty != null
          ? `${row.pending_qty} ${row.base_unit ?? ""}`.trim()
          : "-",
      sortValue: (row) => row.pending_qty ?? ""
    },
    dueDate: { headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Due Date", cell: (row) => row.due_date || "-", sortValue: (row) => row.due_date || "" },
    deliveryDate: { headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Delivery Date", cell: (row) => row.delivery_date || "-", sortValue: (row) => row.delivery_date || "" },
    aging: { headerClass: "px-2 py-2 text-left w-[70px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Aging", cell: (row) => row.aging ?? "-", sortValue: (row) => row.aging ?? "" },
    status: { headerClass: "px-2 py-2 text-left w-[110px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Status", cell: null, sortValue: (row) => getStatusValue(row) || "" },
    createdBy: { headerClass: "px-2 py-2 text-left w-[120px]", cellClass: "px-2 py-2 break-words", header: "Created By", cell: (row) => getCreatedByValue(row) || "-", sortValue: (row) => getCreatedByValue(row) || "" },
    updatedBy: { headerClass: "px-2 py-2 text-left w-[120px]", cellClass: "px-2 py-2 break-words", header: "Updated By", cell: (row) => row.updated_by || "-", sortValue: (row) => row.updated_by || "" },
    updatedDate: { headerClass: "px-2 py-2 text-left w-[105px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Updated Date", cell: (row) => row.updated_date || "-", sortValue: (row) => row.updated_date || "" },
    remark: { headerClass: "px-2 py-2 text-left w-[180px]", cellClass: "px-2 py-2 break-words", header: "Remark", cell: (row) => row.remark || "-", sortValue: (row) => row.remark || "" },
    action: { headerClass: "px-2 py-2 text-left w-[140px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", header: "Action", cell: null, sortValue: () => "" },
  }), []);

  const orderedVisibleColumns = useMemo(
    () => columnOrder.filter((key) => visibleColumns[key] && columnLayout[key]),
    [columnOrder, visibleColumns, columnLayout]
  );

  const fetchReport = async () => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");
    const params = new URLSearchParams();
    params.append("from_date", toDdMmYyyy(fromDate));
    params.append("to_date", toDdMmYyyy(toDate));
    if (branchFilter && branchFilter !== "all") {
      params.append("branch_id", branchFilter);
    }
    const response = await apiRequest("GET", `${API_BASE_URL}/api/report/purchase-orders-with-inward/?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to fetch PO reports");
    }
    return data;
  };

  const fetchBranches = async () => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");

    const response = await fetch(`${API_BASE_URL}/api/get-branches/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Failed to fetch branches");
    }

    if (data?.status === 200 && Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  };

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["po-reports", fromDate, toDate, branchFilter],
    queryFn: fetchReport,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const { data: branchesData = [] } = useQuery({
    queryKey: ["po-reports-branches"],
    queryFn: fetchBranches,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: brokersData, isLoading: brokersLoading } = useQuery({
    queryKey: ["brokers"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/report/broker/`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const brokers = brokersData?.data || [];

  const filteredBrokers = useMemo(() => {
    if (!debouncedBrokerSearch) return brokers;
    const q = debouncedBrokerSearch.toLowerCase();
    return brokers.filter((broker) => broker.name?.toLowerCase().includes(q));
  }, [brokers, debouncedBrokerSearch]);

  React.useEffect(() => {
    const now = new Date();
    if (dateRangePreset === "today") {
      setFromDate(format(startOfDay(now), "yyyy-MM-dd"));
      setToDate(format(endOfDay(now), "yyyy-MM-dd"));
    } else if (dateRangePreset === "weekly") {
      setFromDate(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setToDate(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (dateRangePreset === "monthly") {
      setFromDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(now), "yyyy-MM-dd"));
    }
  }, [dateRangePreset]);

  const resetAllFilters = () => {
    setDateRangePreset("monthly");
    setFromDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setToDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setSearch("");
    setBranchFilter("all");
    setBrokerFilter("all");
    setBrokerSearchTerm("");
    setPartyNameFilter("all");
    setPartySearchTerm("");
    setItemNameFilter("all");
    setItemSearchTerm("");
    setStatusFilter("all");
    setNumericRangeField("none");
    setNumericRangeMin("");
    setNumericRangeMax("");
  };

  const getSelectedColumnDefs = () => {
    const allDefs = [
      { key: "date", header: "Date", value: (row) => row.created_at || "-" },
      {
        key: "poNumber",
        header: "PO Number",
        value: (row) => {
          const branch = getBranchValue(row);
          const poNo = row.voucher_number || "-";
          return branch ? `${poNo}\n${branch}` : poNo;
        },
      },
      { key: "partyName", header: "Party Name", value: (row) => getPartyNameValue(row) || "-" },
      { key: "itemName", header: "Item Name", value: (row) => getItemNameValue(row) || "-" },
      { key: "poQty", header: "PO Qty", value: (row) => row.po_qty || "-" },
      { key: "rate", header: "Rate", value: (row) => row.rate || "-" },
      { key: "amount", header: "Amount", value: (row) => row.amount ?? "-" },
      { key: "receivedQty", header: "Received Qty", value: (row) => row.received_qty ?? "-" },
      { key: "pendingQty", header: "Pending Qty", value: (row) => row.pending_qty ?? "-" },
      { key: "dueDate", header: "Due Date", value: (row) => row.due_date || "-" },
      { key: "deliveryDate", header: "Delivery Date", value: (row) => row.delivery_date || "-" },
      { key: "aging", header: "Aging", value: (row) => row.aging ?? "-" },
      { key: "status", header: "Status", value: (row) => getStatusValue(row) || "-" },
      { key: "createdBy", header: "Created By", value: (row) => getCreatedByValue(row) || "-" },
      { key: "updatedBy", header: "Updated By", value: (row) => row.updated_by || "-" },
      { key: "updatedDate", header: "Updated Date", value: (row) => row.updated_date || "-" },
      { key: "remark", header: "Remark", value: (row) => row.remark || "-" },
    ];
    const defsByKey = new Map(allDefs.map((def) => [def.key, def]));
    return columnOrder
      .filter((key) => visibleColumns[key] && defsByKey.has(key))
      .map((key) => defsByKey.get(key));
  };

  const handleDownloadExcel = async () => {
    try {
      const ExcelJS = await import("exceljs");
      const selectedDefs = getSelectedColumnDefs();
      if (selectedDefs.length === 0) {
        toast({
          title: "No columns selected",
          description: "Select at least one header to download.",
          variant: "destructive",
        });
        return;
      }

      let orgName = "-";
      let branchName = "-";
     
      try {
        const raw = localStorage.getItem("cp_org_info");
        if (raw) {
          const parsed = JSON.parse(raw);
          orgName =
            parsed?.organization_name ||
            parsed?.organization ||
            parsed?.org_name ||
            parsed?.data?.organization ||
            orgName;
          branchName =
            parsed?.branch_name ||
            parsed?.branch ||
            parsed?.data?.branch ||
            branchName;
        }
      } catch {
        // ignore localStorage parse errors
      }

      

      const currentDate = format(new Date(), "d MMMM yyyy");
      const colCount = selectedDefs.length;
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("PO Reports");

      ws.addRow([orgName]);
      ws.addRow([`Branch Name: ${branchName}`]);
      ws.addRow([`Date: ${currentDate}`]);
      ws.addRow(["PO Reports"]);
      ws.addRow([]);
      ws.addRow(selectedDefs.map((d) => d.header));
      reportRows.forEach((row) => ws.addRow(selectedDefs.map((d) => d.value(row))));

      ws.mergeCells(1, 1, 1, colCount);
      ws.mergeCells(2, 1, 2, colCount);
      ws.mergeCells(3, 1, 3, colCount);
      ws.mergeCells(4, 1, 4, colCount);

      ws.columns = selectedDefs.map(() => ({ width: 22 }));

      const lightBorder = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      const lastRow = ws.rowCount;
      for (let r = 1; r <= lastRow; r += 1) {
        for (let c = 1; c <= colCount; c += 1) {
          const cell = ws.getCell(r, c);
          // Keep top report header area clean without grid lines.
          // Row mapping:
          // 1: Org, 2: Branch, 3: Date, 4: Report title, 5: spacer, 6+: table header/data
          cell.border = r <= 5 ? undefined : lightBorder;
          cell.alignment = {
            vertical: "middle",
            horizontal: r <= 6 ? "center" : "left",
            wrapText: true,
          };
        }
      }

      for (let r = 1; r <= 6; r += 1) {
        ws.getCell(r, 1).font = { bold: true };
      }
      for (let c = 1; c <= colCount; c += 1) {
        ws.getCell(6, c).font = { bold: true };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `po_reports_${format(new Date(), "yyyyMMdd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err?.message || "Could not generate Excel file.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default;
      const selectedDefs = getSelectedColumnDefs();
      if (selectedDefs.length === 0) {
        toast({
          title: "No columns selected",
          description: "Select at least one header to download.",
          variant: "destructive",
        });
        return;
      }

      let orgName = "-";
      let branchName = "-";
      try {
        const raw = localStorage.getItem("cp_org_info");
        if (raw) {
          const parsed = JSON.parse(raw);
          orgName =
            parsed?.organization_name ||
            parsed?.organization ||
            parsed?.org_name ||
            parsed?.data?.organization ||
            orgName;
          branchName =
            parsed?.branch_name ||
            parsed?.branch ||
            parsed?.data?.branch ||
            branchName;
        }
      } catch {
        // ignore localStorage parse errors
      }

      const doc = new jsPDF("l", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const currentDate = format(new Date(), "d MMMM yyyy,hh:mm:ss a");

      const headerX = 8;
      const headerY = 8;
      const headerWidth = pageWidth - 16;
      const headerHeight = 34;
      const titleBandHeight = 10;
      const infoY = headerY + titleBandHeight + 2;

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(headerX, headerY, headerWidth, headerHeight, 2, 2, "F");
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(
        headerX + 0.6,
        headerY + titleBandHeight,
        headerWidth - 1.2,
        headerHeight - titleBandHeight - 0.6,
        1,
        1,
        "F"
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("PO REPORTS", pageWidth / 2, headerY + 6.7, { align: "center" });

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.text(orgName, pageWidth / 2, infoY + 4.8, { align: "center" });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(headerX + 5, infoY + 7, headerX + headerWidth - 5, infoY + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Branch: ${branchName}`, headerX + 8, infoY + 13);
      doc.text(`Generated By: ${generatedBy}`, pageWidth / 2, infoY + 13, { align: "center" });
      doc.text(`Generated At: ${currentDate}`, headerX + headerWidth - 8, infoY + 13, { align: "right" });

      const head = [selectedDefs.map((d) => d.header)];
      const body = reportRows.map((row) => selectedDefs.map((d) => d.value(row)));

      autoTable(doc, {
        startY: headerY + headerHeight + 6,
        head,
        body,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          cellPadding: { top: 2.1, right: 1.8, bottom: 2.1, left: 1.8 },
          textColor: [15, 23, 42],
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fontStyle: "bold",
          halign: "center",
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          lineColor: [148, 163, 184],
          lineWidth: 0.2,
        },
        bodyStyles: {
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didDrawPage: () => {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(8, pageHeight - 9, pageWidth - 8, pageHeight - 9);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Page ${doc.getCurrentPageInfo().pageNumber}`,
            pageWidth - 8,
            pageHeight - 5.3,
            { align: "right" }
          );
        },
        margin: { left: 8, right: 8 },
      });

      doc.save(`po_reports_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err?.message || "Could not generate PDF file.",
        variant: "destructive",
      });
    }
  };

  const baseRows = useMemo(() => {
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }, [data]);

  const filterOptions = useMemo(() => {
    const list = baseRows;
    const uniq = (arr) => [...new Set(arr.map((v) => String(v || "").trim()).filter(Boolean))].sort();
    return {
      partyName: uniq(list.map((r) => getPartyNameValue(r))),
      itemName: uniq(list.map((r) => getItemNameValue(r))),
      status: uniq(list.map((r) => normalizeStatusValue(getStatusValue(r)))),
    };
  }, [baseRows]);

  const filteredPartyNames = useMemo(() => {
    if (!debouncedPartySearch) return filterOptions.partyName;
    const q = debouncedPartySearch.toLowerCase();
    return filterOptions.partyName.filter((name) => name.toLowerCase().includes(q));
  }, [filterOptions.partyName, debouncedPartySearch]);

  const filteredItemNames = useMemo(() => {
    if (!debouncedItemSearch) return filterOptions.itemName;
    const q = debouncedItemSearch.toLowerCase();
    return filterOptions.itemName.filter((name) => name.toLowerCase().includes(q));
  }, [filterOptions.itemName, debouncedItemSearch]);

  const branchOptions = useMemo(() => {
    const byId = new Map();
    const addBranch = (b) => {
      if (!b?.id || !b?.name) return;
      byId.set(String(b.id), { id: String(b.id), name: b.name });
    };
    if (Array.isArray(branchesData)) {
      branchesData.forEach(addBranch);
    }
    if (Array.isArray(data?.branches)) {
      data.branches.forEach(addBranch);
    }
    baseRows.forEach((row) => {
      const id = getBranchId(row);
      const name = getBranchValue(row);
      if (id && name) byId.set(id, { id, name });
    });
    return [{ id: "all", name: "All Branches" }, ...[...byId.values()].sort((a, b) => a.name.localeCompare(b.name))];
  }, [branchesData, data?.branches, baseRows]);

  const reportRows = useMemo(() => {
    let list = [...baseRows];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((row) =>
        String(row.voucher_number || "").toLowerCase().includes(term) ||
        String(getPartyNameValue(row) || "").toLowerCase().includes(term) ||
        String(getItemNameValue(row) || "").toLowerCase().includes(term) ||
        String(getStatusValue(row) || "").toLowerCase().includes(term) ||
        String(getBrokerNameValue(row) || "").toLowerCase().includes(term) ||
        String(getCreatedByValue(row) || "").toLowerCase().includes(term) ||
        String(row.updated_by || "").toLowerCase().includes(term)
      );
    }

    if (branchFilter !== "all") {
      list = list.filter((row) => getBranchId(row) === branchFilter);
    }
    if (brokerFilter !== "all") {
      list = list.filter((row) => String(getBrokerNameValue(row) || "") === brokerFilter);
    }
    if (partyNameFilter !== "all") {
      list = list.filter((row) => String(getPartyNameValue(row) || "") === partyNameFilter);
    }
    if (itemNameFilter !== "all") {
      list = list.filter((row) => String(getItemNameValue(row) || "") === itemNameFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((row) => normalizeStatusValue(getStatusValue(row)) === statusFilter);
    }
    if (numericRangeField !== "none") {
      list = list.filter((row) =>
        matchesNumericRangeFilter(row, numericRangeField, numericRangeMin, numericRangeMax)
      );
    }

    return list;
  }, [baseRows, search, branchFilter, brokerFilter, partyNameFilter, itemNameFilter, statusFilter, numericRangeField, numericRangeMin, numericRangeMax]);

  const sortedReportRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction || !columnLayout[sortConfig.key]) {
      return reportRows;
    }

    const parseSortable = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "number") return value;
      const raw = String(value).trim();
      if (!raw) return "";
      const numeric = Number(raw);
      if (!Number.isNaN(numeric) && raw !== "") return numeric;
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return date.getTime();
      return raw.toLowerCase();
    };

    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
    return [...reportRows].sort((a, b) => {
      const aVal = parseSortable(columnLayout[sortConfig.key].sortValue(a));
      const bVal = parseSortable(columnLayout[sortConfig.key].sortValue(b));
      if (aVal === bVal) return 0;
      if (aVal === "") return 1;
      if (bVal === "") return -1;
      return aVal > bVal ? directionMultiplier : -directionMultiplier;
    });
  }, [reportRows, sortConfig, columnLayout]);

  const summary = useMemo(() => {
    const totalCount = reportRows.length;
    const totalCompleted = reportRows.filter(
      (row) => String(row.status || "").toLowerCase() === "completed"
    ).length;
    const totalPending = reportRows.filter(
      (row) => String(row.status || "").toLowerCase() !== "completed"
    ).length;
    const uniquePartyCount = new Set(
      reportRows.map((row) => (row.party_name || "").trim()).filter(Boolean)
    ).size;

    return { totalCount, totalCompleted, totalPending, uniquePartyCount };
  }, [reportRows]);

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ purchaseOrderIds, status }) => {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/report/purchase-orders/bulk-update-status/`,
        {
          purchase_order_ids: purchaseOrderIds,
          status,
          update_items: true,
        }
      );
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Status updated",
        description: data?.message || "Purchase order status updated successfully.",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      setUpdateStatusModal({ open: false, row: null });
      setUpdateStatusValue("");
      await queryClient.invalidateQueries({ queryKey: ["po-reports"], refetchType: "all" });
      await refetch();
    },
    onError: (err) => {
      console.error("Bulk status update failed:", err);
      toast({
        title: "Update failed",
        description: err?.message || "Unable to update purchase order status.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUpdatingStatus(false);
    },
  });

  const openUpdateStatusModal = (row) => {
    setUpdateStatusValue("");
    setUpdateStatusModal({ open: true, row });
  };

  const handleUpdateStatusConfirm = () => {
    const row = updateStatusModal.row;
    if (!row || !updateStatusValue) return;
    const poId =
      row.purchase_order_id ??
      row.po_id ??
      row.id ??
      null;
    if (poId === null || poId === undefined || poId === "") {
      toast({
        title: "Missing PO id",
        description: "Cannot identify the purchase order to update.",
        variant: "destructive",
      });
      return;
    }
    setIsUpdatingStatus(true);
    bulkUpdateStatusMutation.mutate({
      purchaseOrderIds: [poId],
      status: updateStatusValue,
    });
  };

  const getStatusBadgeClasses = (status) => {
    const normalized = normalizeStatusValue(status);
    if (normalized === "rejected") return "bg-red-100 text-red-800 border-red-300";
    if (normalized === "completed") return "bg-green-100 text-green-800 border-green-300";
    if (
      normalized === "partial_completed" ||
      normalized === "partial completed" ||
      normalized === "partially completed"
    ) {
      return "bg-blue-100 text-blue-800 border-blue-300";
    }
    if (normalized === "pending") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  React.useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load PO report",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return <Loader />;
  }

  const formatStatus = (s) => {
    if (!s) return "-";
  
    return s
      .toLowerCase()
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="app-main-content">
        {isMobile && (
          <div className="bg-white shadow-sm border-b p-4 flex items-center justify-between">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 rounded-md hover:bg-gray-100">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold">PO Reports</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PO Reports</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View purchase orders with date-range filters and status-wise summary
              </p>
            </div>
            <div className="flex items-center gap-2 md:mt-1">
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handleDownloadExcel}>
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Settings className="h-8 w-8 " />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500">Select headers to display</p>
                    <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                      {columnOrder.map((key) => {
                        const col = columnOptions.find((item) => item.key === key);
                        if (!col) return null;
                        return (
                        <label
                          key={col.key}
                          draggable
                          onDragStart={() => setDraggedColumnKey(col.key)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            moveColumn(draggedColumnKey, col.key);
                            setDraggedColumnKey(null);
                          }}
                          className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-1 hover:bg-gray-50"
                        >
                          <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />
                          <Checkbox
                            checked={visibleColumns[col.key]}
                            onCheckedChange={() => toggleColumn(col.key)}
                          />
                          <span>{col.label}</span>
                        </label>
                      )})}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Date Range</Label>
                  <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="weekly">This Week (Mon-Sun)</SelectItem>
                      <SelectItem value="monthly">This Month</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">From Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, from: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-10 px-3 inline-flex items-center justify-start rounded-md border text-sm ${
                          dateRangePreset === "custom"
                            ? "bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            : "bg-gray-100 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "Start date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`from-${fromDate || "null"}`}
                        mode="single"
                        selected={fromDate ? new Date(fromDate) : undefined}
                        onSelect={(date) => {
                          const dateStr = date ? format(date, "yyyy-MM-dd") : "";
                          setFromDate(dateStr);
                          if (dateStr && toDate && dateStr > toDate) {
                            setToDate(dateStr);
                          }
                          setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                        }}
                        disabled={{ after: new Date() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">To Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, to: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-10 px-3 inline-flex items-center justify-start rounded-md border text-sm ${
                          dateRangePreset === "custom"
                            ? "bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            : "bg-gray-100 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {toDate ? format(new Date(toDate), "dd-MM-yyyy") : "End date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`to-${toDate || "null"}`}
                        mode="single"
                        selected={toDate ? new Date(toDate) : undefined}
                        onSelect={(date) => {
                          setToDate(date ? format(date, "yyyy-MM-dd") : "");
                          setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                        }}
                        disabled={[
                          fromDate ? { before: new Date(fromDate) } : null,
                          { after: new Date() },
                        ].filter(Boolean)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Branch</Label>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Broker</Label>
                  <Popover
                    open={brokerDropdownOpen}
                    onOpenChange={(open) => {
                      setBrokerDropdownOpen(open);
                      if (!open) setBrokerSearchTerm("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={brokersLoading}
                        className="w-full h-10 justify-between text-left font-normal"
                      >
                        <span className="truncate">
                          {brokersLoading
                            ? "Loading..."
                            : brokerFilter === "all"
                              ? "All"
                              : brokerFilter}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[280px] p-2"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <Input
                        placeholder="Search brokers..."
                        value={brokerSearchTerm}
                        onChange={(e) => setBrokerSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mb-2 h-9"
                      />
                      <div
                        className="max-h-48 overflow-y-auto"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={`w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm ${brokerFilter === "all" ? "bg-gray-50 font-medium" : ""}`}
                          onClick={() => {
                            setBrokerFilter("all");
                            setBrokerDropdownOpen(false);
                            setBrokerSearchTerm("");
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          All
                        </button>
                        {filteredBrokers.length > 0 ? (
                          filteredBrokers.map((broker) => (
                            <button
                              key={broker.id}
                              type="button"
                              className={`w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm ${brokerFilter === broker.name ? "bg-gray-50 font-medium" : ""}`}
                              onClick={() => {
                                setBrokerFilter(broker.name);
                                setBrokerDropdownOpen(false);
                                setBrokerSearchTerm("");
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {broker.name}
                            </button>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            No brokers found
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Party Name</Label>
                  <Popover
                    open={partyDropdownOpen}
                    onOpenChange={(open) => {
                      setPartyDropdownOpen(open);
                      if (!open) setPartySearchTerm("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 justify-between text-left font-normal"
                      >
                        <span className="truncate">
                          {partyNameFilter === "all" ? "All" : partyNameFilter}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[280px] p-2"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <Input
                        placeholder="Search party names..."
                        value={partySearchTerm}
                        onChange={(e) => setPartySearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mb-2 h-9"
                      />
                      <div
                        className="max-h-48 overflow-y-auto"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={`w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm ${partyNameFilter === "all" ? "bg-gray-50 font-medium" : ""}`}
                          onClick={() => {
                            setPartyNameFilter("all");
                            setPartyDropdownOpen(false);
                            setPartySearchTerm("");
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          All
                        </button>
                        {filteredPartyNames.length > 0 ? (
                          filteredPartyNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              className={`w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm ${partyNameFilter === name ? "bg-gray-50 font-medium" : ""}`}
                              onClick={() => {
                                setPartyNameFilter(name);
                                setPartyDropdownOpen(false);
                                setPartySearchTerm("");
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            No party names found
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Item Name</Label>
                  <Popover
                    open={itemDropdownOpen}
                    onOpenChange={(open) => {
                      setItemDropdownOpen(open);
                      if (!open) setItemSearchTerm("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 justify-between text-left font-normal"
                      >
                        <span className="truncate">
                          {itemNameFilter === "all" ? "All" : itemNameFilter}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[280px] p-2"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <Input
                        placeholder="Search item names..."
                        value={itemSearchTerm}
                        onChange={(e) => setItemSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mb-2 h-9"
                      />
                      <div
                        className="max-h-48 overflow-y-auto"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={`w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm ${itemNameFilter === "all" ? "bg-gray-50 font-medium" : ""}`}
                          onClick={() => {
                            setItemNameFilter("all");
                            setItemDropdownOpen(false);
                            setItemSearchTerm("");
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          All
                        </button>
                        {filteredItemNames.length > 0 ? (
                          filteredItemNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              className={`w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm ${itemNameFilter === name ? "bg-gray-50 font-medium" : ""}`}
                              onClick={() => {
                                setItemNameFilter(name);
                                setItemDropdownOpen(false);
                                setItemSearchTerm("");
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            No item names found
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.status.map((name) => (
                        <SelectItem key={name} value={name}>{formatStatusLabel(name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Filter By</Label>
                  <Select
                    value={numericRangeField}
                    onValueChange={(value) => {
                      setNumericRangeField(value);
                      setNumericRangeMin("");
                      setNumericRangeMax("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {NUMERIC_RANGE_FILTER_FIELDS.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {numericRangeField !== "none" ? (
                  <>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-gray-500 mb-1 block">
                        Min ({NUMERIC_RANGE_FILTER_FIELDS.find((f) => f.key === numericRangeField)?.label})
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        value={numericRangeMin}
                        onChange={(e) => setNumericRangeMin(e.target.value)}
                        placeholder="Min value"
                        className="h-10"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-gray-500 mb-1 block">
                        Max ({NUMERIC_RANGE_FILTER_FIELDS.find((f) => f.key === numericRangeField)?.label})
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        value={numericRangeMax}
                        onChange={(e) => setNumericRangeMax(e.target.value)}
                        placeholder="Max value"
                        className="h-10"
                      />
                    </div>
                  </>
                ) : null}

                <div className="md:col-span-2 flex items-end">
                  <Button variant="outline" onClick={resetAllFilters} className="w-full">
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Total Count</div>
                  <div className="text-xl font-bold">{summary.totalCount}</div>
                </div>
                <CalendarDays className="h-6 w-6 text-gray-400" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Total Pending</div>
                  <div className="text-xl font-bold">{summary.totalPending}</div>
                </div>
                <Clock className="h-6 w-6 text-amber-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Total Completed</div>
                  <div className="text-xl font-bold">{summary.totalCompleted}</div>
                </div>
                <CheckCircle className="h-6 w-6 text-green-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Total Party</div>
                  <div className="text-xl font-bold">{summary.uniquePartyCount}</div>
                </div>
                <Users className="h-6 w-6 text-blue-500" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">PO Listing</CardTitle>
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by PO number, party, item, status, broker..."
                    className="pl-9 h-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                <table className="min-w-[2200px] text-xs table-fixed">
                  <thead className="bg-gray-100">
                    <tr>
                      {orderedVisibleColumns.map((key) => (
                        <th key={key} className={`${columnLayout[key].headerClass} sticky top-0 z-20 bg-gray-100`}>
                          <div className="flex items-center gap-1">
                            <span>{columnLayout[key].header}</span>
                            <div className="flex items-center gap-1 leading-none">
                              <button
                                type="button"
                                onClick={() => setSortConfig({ key, direction: "desc" })}
                                className={`h-3 w-3 inline-flex items-center justify-center ${sortConfig.key === key && sortConfig.direction === "desc" ? "text-black" : "text-gray-400 hover:text-gray-700"}`}
                                title="Sort descending"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSortConfig({ key, direction: "asc" })}
                                className={`h-3 w-3 inline-flex items-center justify-center ${sortConfig.key === key && sortConfig.direction === "asc" ? "text-black" : "text-gray-400 hover:text-gray-700"}`}
                                title="Sort ascending"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReportRows.map((row, idx) => {
                      const normalizedRowStatus = normalizeStatusValue(getStatusValue(row));
                      return (
                      <tr key={`${row.purchase_order_id}-${row.purchase_item_id}-${row.inward_id || "no-inward"}-${idx}`} className="border-b align-top">
                        {orderedVisibleColumns.map((key) => {
                          if (key === "status") {
                            return (
                              <td key={key} className={columnLayout[key].cellClass}>
                                <Badge variant="outline" className={getStatusBadgeClasses(row.status)}>
                                  {formatStatus(getStatusValue(row))}
                                </Badge>
                              </td>
                            );
                          }
                          if (key === "action") {
                            return (
                              <td key={key} className={columnLayout[key].cellClass}>
                                {normalizedRowStatus === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openUpdateStatusModal(row)}
                                    className="h-7 px-2 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                                    title="Update Status"
                                  >
                                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                                    Update Status
                                  </Button>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            );
                          }
                          return (
                            <td key={key} className={columnLayout[key].cellClass}>
                              {columnLayout[key].cell(row)}
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                    {sortedReportRows.length === 0 && (
                      <tr>
                        <td className="px-3 py-8 text-center text-gray-500" colSpan={Math.max(orderedVisibleColumns.length, 1)}>No records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={updateStatusModal.open}
        onOpenChange={(open) => {
          if (!open && !isUpdatingStatus) {
            setUpdateStatusModal({ open: false, row: null });
            setUpdateStatusValue("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>Update Status</span>
            </DialogTitle>
            <DialogDescription>
              Update the status of purchase order
              {" "}
              <span className="font-medium text-gray-800">
                {updateStatusModal.row?.voucher_number || ""}
              </span>
              {" "}and its associated items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Select New Status</Label>
              <Select value={updateStatusValue} onValueChange={setUpdateStatusValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="partial_unloaded">Partial Unloaded</SelectItem>
                  <SelectItem value="partial_rejected">Partial Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This will update both the purchase order status and all associated item statuses to "{updateStatusValue}".
              </p>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setUpdateStatusModal({ open: false, row: null });
                  setUpdateStatusValue("");
                }}
                className="flex-1"
                disabled={isUpdatingStatus}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatusConfirm}
                disabled={!updateStatusValue || isUpdatingStatus}
                className="flex-1"
              >
                {isUpdatingStatus ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

