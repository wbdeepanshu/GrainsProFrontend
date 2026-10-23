import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { Menu, Search, CalendarDays, CheckCircle, Clock, Users, CalendarIcon, Download, Settings, GripVertical, ArrowUp, ArrowDown, Check, X, LayoutGrid, Table2, ChevronsUpDown } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const toDdMmYyyy = (dateText) => {
  const d = new Date(dateText);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
const statusLabel = (status) =>
  normalizeStatus(status)
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Parse numeric qty from API (number or string like "12.5 Qtl"). */
const parseQtyValue = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).trim();
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number.parseFloat(m[0]) : 0;
};

const fmtQty = (n) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

const NUMERIC_RANGE_FILTER_FIELDS = [
  { key: "pending_qty", label: "Pending Qty" },
  { key: "rate", label: "Rate" },
  { key: "amount", label: "Amount" },
  { key: "dispatch_qty", label: "Dispatch Qty" },
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
    case "dispatch_qty":
      return parseNumericFilterValue(row.dispatch_qty);
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

export default function SalesOrderDispatchReport() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState("monthly");
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [statusFilter, setStatusFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [brokerFilter, setBrokerFilter] = useState("all");
  const [brokerDropdownOpen, setBrokerDropdownOpen] = useState(false);
  const [brokerSearchTerm, setBrokerSearchTerm] = useState("");
  const debouncedBrokerSearch = useDebounce((brokerSearchTerm || "").trim(), 300);
  const [numericRangeField, setNumericRangeField] = useState("none");
  const [numericRangeMin, setNumericRangeMin] = useState("");
  const [numericRangeMax, setNumericRangeMax] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    date: true,
    soNumber: true,
    partyName: true,
    itemName: true,
    soQty: true,
    approvedQty: true,
    rate: true,
    amount: true,
    dispatchQty: true,
    pendingQty: true,
    dueDate: true,
    createdBy: true,
    updatedBy: true,
    updatedDate: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    "status",
    "date",
    "soNumber",
    "partyName",
    "itemName",
    "soQty",
    "approvedQty",
    "rate",
    "amount",
    "dispatchQty",
    "pendingQty",
    "dueDate",
    "createdBy",
    "updatedBy",
    "updatedDate",
  ]);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisViewTab, setAnalysisViewTab] = useState("cards");
  const [analysisItemSearch, setAnalysisItemSearch] = useState("");

  const columnOptions = [
    { key: "status", label: "Status" },
    { key: "date", label: "Date" },
    { key: "soNumber", label: "SO Number" },
    { key: "partyName", label: "Party Name" },
    { key: "itemName", label: "Item Name" },
    { key: "soQty", label: "SO Qty" },
    { key: "approvedQty", label: "Approved Qty" },
    { key: "rate", label: "Rate" },
    { key: "amount", label: "Amount" },
    { key: "dispatchQty", label: "Dispatch Qty" },
    { key: "pendingQty", label: "Pending Qty" },
    { key: "dueDate", label: "Due Date" },
    { key: "createdBy", label: "Created By" },
    { key: "updatedBy", label: "Updated By" },
    { key: "updatedDate", label: "Updated Date" },
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

  const fetchReport = async () => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");
    const params = new URLSearchParams();
    params.append("from_date", toDdMmYyyy(fromDate));
    params.append("to_date", toDdMmYyyy(toDate));
    const response = await apiRequest("GET", `${API_BASE_URL}/api/report/sales-order-dispatch-report/?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to fetch sales order dispatch report");
    }
    return data?.data || [];
  };

  const { data: reportRows = [], isLoading, error } = useQuery({
    queryKey: ["sales-order-dispatch-report", fromDate, toDate],
    queryFn: fetchReport,
    enabled: !!AuthService.getAccessToken(),
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

  const approveRejectMutation = useMutation({
    mutationFn: async ({ soNumber, action, items, orderRemarks }) => {
      const response = await apiRequest("PUT", `${API_BASE_URL}/api/sales/sales-orders/${soNumber}/approve-reject/`, {
        action,
        items: items || [],
        order_remarks: orderRemarks || "",
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data?.message || "Sales order item updated",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["sales-order-dispatch-report"] });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to update sales order item",
        variant: "destructive",
      });
    },
  });

  const handleItemApproveReject = (row, action) => {
    if (!row?.so_number || !row?.so_item_id) return;
    let remarks = "";
    if (action === "reject") {
      const reason = window.prompt("Enter rejection reason:");
      if (!reason || !reason.trim()) {
        toast({
          title: "Validation Error",
          description: "Rejection reason is required",
          variant: "destructive",
        });
        return;
      }
      remarks = reason.trim();
    }

    const approvedQty = action === "approve" ? Number(row.ordered_qty_value || 0) : 0;
    const itemPayload = {
      item_id: row.so_item_id,
      approved_quantity: approvedQty,
      action_remarks: remarks,
    };
    if (action === "approve") {
      if (row.rate_value !== undefined && row.rate_value !== null) {
        itemPayload.rate = Number(row.rate_value);
      }
      if (row.base_unit_id !== undefined && row.base_unit_id !== null) {
        itemPayload.base_unit_id = row.base_unit_id;
      }
    }

    approveRejectMutation.mutate({
      soNumber: row.so_number,
      action,
      items: [itemPayload],
      orderRemarks: "",
    });
  };

  React.useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load report",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  React.useEffect(() => {
    if (analysisOpen) {
      setAnalysisViewTab("cards");
      setAnalysisItemSearch("");
    }
  }, [analysisOpen]);

  const filterOptions = useMemo(() => {
    const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
    return {
      status: unique(reportRows.map((r) => r.status)),
      party: unique(reportRows.map((r) => r.party_name)),
      item: unique(reportRows.map((r) => r.item_name)),
    };
  }, [reportRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reportRows.filter((row) => {
      if (statusFilter !== "all" && (row.status || "") !== statusFilter) return false;
      if (partyFilter !== "all" && (row.party_name || "") !== partyFilter) return false;
      if (itemFilter !== "all" && (row.item_name || "") !== itemFilter) return false;
      if (brokerFilter !== "all" && (row.broker_name || "") !== brokerFilter) return false;
      if (numericRangeField !== "none") {
        if (!matchesNumericRangeFilter(row, numericRangeField, numericRangeMin, numericRangeMax)) {
          return false;
        }
      }
      if (!q) return true;
      return [
        row.so_number, row.party_name, row.item_name, row.status, row.broker_name, row.created_by, row.updated_by, row.date
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [reportRows, statusFilter, partyFilter, itemFilter, brokerFilter, numericRangeField, numericRangeMin, numericRangeMax, search]);

  const summary = useMemo(() => {
    const totalCount = filteredRows.length;
    const totalPending = filteredRows.filter((r) => normalizeStatus(r.status) === "pending").length;
    const totalCompleted = filteredRows.filter((r) => normalizeStatus(r.status) === "completed").length;
    const uniquePartyCount = new Set(filteredRows.map((r) => r.party_name).filter(Boolean)).size;
    return { totalCount, totalPending, totalCompleted, uniquePartyCount };
  }, [filteredRows]);

  /** Item-wise sums from current filtered listing — cards + analysis table. */
  const itemWiseAnalysisRows = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      const label = String(row.item_name || "").trim() || "Unknown item";
      if (!map.has(label)) {
        map.set(label, {
          itemLabel: label,
          totalSalesOrderQty: 0,
          approvedQty: 0,
          dispatchedQty: 0,
          pendingQty: 0,
          _soNumbers: new Set(),
        });
      }
      const agg = map.get(label);
      const soNum = row.so_number != null ? String(row.so_number).trim() : "";
      if (soNum) agg._soNumbers.add(soNum);
      const ordered =
        row.ordered_qty_value !== undefined && row.ordered_qty_value !== null
          ? Number(row.ordered_qty_value)
          : parseQtyValue(row.so_qty);
      agg.totalSalesOrderQty += Number.isFinite(ordered) ? ordered : 0;
      agg.approvedQty += parseQtyValue(row.approved_qty);
      agg.dispatchedQty += parseQtyValue(row.dispatch_qty);
      agg.pendingQty += parseQtyValue(row.pending_qty);
    });
    return Array.from(map.values())
      .map(({ _soNumbers, ...rest }) => ({
        ...rest,
        totalSalesOrderCount: _soNumbers.size,
      }))
      .sort((a, b) => a.itemLabel.localeCompare(b.itemLabel, undefined, { sensitivity: "base" }));
  }, [filteredRows]);

  const filteredItemWiseAnalysisRows = useMemo(() => {
    const q = analysisItemSearch.trim().toLowerCase();
    if (!q) return itemWiseAnalysisRows;
    return itemWiseAnalysisRows.filter((r) => r.itemLabel.toLowerCase().includes(q));
  }, [itemWiseAnalysisRows, analysisItemSearch]);

  const statusBadgeClass = (status) => {
    const normalized = normalizeStatus(status);
    if (normalized === "completed") return "bg-green-100 text-green-800 border-green-300";
    if (normalized === "partial_completed" || normalized === "partially_approved") return "bg-blue-100 text-blue-800 border-blue-300";
    if (normalized === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (normalized === "gate_pass_created") return "bg-sky-100 text-sky-900 border-sky-300";
    if (normalized === "rejected") return "bg-red-100 text-red-800 border-red-300";
    if (normalized === "pending") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setPartyFilter("all");
    setItemFilter("all");
    setBrokerFilter("all");
    setBrokerSearchTerm("");
    setNumericRangeField("none");
    setNumericRangeMin("");
    setNumericRangeMax("");
    setSearch("");
  };

  const getSelectedColumnDefs = () => {
    const allDefs = [
      { key: "status", header: "Status", value: (row) => statusLabel(row.status) || "-" },
      { key: "date", header: "Date", value: (row) => row.date || "-" },
      { key: "soNumber", header: "SO Number", value: (row) => row.so_number || "-" },
      { key: "partyName", header: "Party Name", value: (row) => row.party_name || "-" },
      { key: "itemName", header: "Item Name", value: (row) => row.item_name || "-" },
      { key: "soQty", header: "SO Qty", value: (row) => row.so_qty || "-" },
      { key: "approvedQty", header: "Approved Qty", value: (row) => row.approved_qty || "-" },
      { key: "rate", header: "Rate", value: (row) => row.rate || "-" },
      { key: "amount", header: "Amount", value: (row) => row.amount ?? "-" },
      { key: "dispatchQty", header: "Dispatch Qty", value: (row) => row.dispatch_qty || "-" },
      { key: "pendingQty", header: "Pending Qty", value: (row) => row.pending_qty || "-" },
      { key: "dueDate", header: "Due Date", value: (row) => row.due_date || "-" },
      { key: "createdBy", header: "Created By", value: (row) => row.created_by || "-" },
      { key: "updatedBy", header: "Updated By", value: (row) => row.updated_by || "-" },
      { key: "updatedDate", header: "Updated Date", value: (row) => row.updated_date || "-" },
    ];
    const defsByKey = new Map(allDefs.map((def) => [def.key, def]));
    return columnOrder
      .filter((key) => visibleColumns[key] && defsByKey.has(key))
      .map((key) => defsByKey.get(key));
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
      const ws = workbook.addWorksheet("SO Dispatch Report");

      ws.addRow([orgName]);
      ws.addRow([`Branch Name: ${branchName}`]);
      ws.addRow([`Date: ${currentDate}`]);
      ws.addRow(["SO Dispatch Report"]);
      ws.addRow([]);
      ws.addRow(selectedDefs.map((d) => d.header));
      filteredRows.forEach((row) => ws.addRow(selectedDefs.map((d) => d.value(row))));

      ws.mergeCells(1, 1, 1, colCount);
      ws.mergeCells(2, 1, 2, colCount);
      ws.mergeCells(3, 1, 3, colCount);
      ws.mergeCells(4, 1, 4, colCount);

      ws.columns = selectedDefs.map(() => ({ width: 20 }));

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
      a.download = `sales_order_dispatch_report_${format(new Date(), "yyyyMMdd")}.xlsx`;
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
      const currentDate = format(new Date(), "d MMMM yyyy, hh:mm:ss a");

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
      doc.text("SO DISPATCH REPORT", pageWidth / 2, headerY + 6.7, { align: "center" });

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
      const body = filteredRows.map((row) => selectedDefs.map((d) => d.value(row)));

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

      doc.save(`sales_order_dispatch_report_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err?.message || "Could not generate PDF file.",
        variant: "destructive",
      });
    }
  };

  const columnLayout = useMemo(
    () => ({
      status: {
        header: "Status",
        headerClass: "px-2 py-2 text-left w-[110px] whitespace-nowrap",
        cellClass: "px-2 py-2 whitespace-nowrap",
        cell: (row) => (
          <Badge variant="outline" className={statusBadgeClass(row.status)}>
            {statusLabel(row.status)}
          </Badge>
        ),
      },
      date: { header: "Date", headerClass: "px-2 py-2 text-left w-[90px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.date || "-" },
      soNumber: { header: "SO Number", headerClass: "px-2 py-2 text-left w-[130px] whitespace-nowrap", cellClass: "px-2 py-2 font-medium whitespace-nowrap", cell: (row) => row.so_number || "-" },
      partyName: { header: "Party Name", headerClass: "px-2 py-2 text-left w-[180px]", cellClass: "px-2 py-2 break-words", cell: (row) => row.party_name || "-" },
      itemName: { header: "Item Name", headerClass: "px-2 py-2 text-left w-[180px]", cellClass: "px-2 py-2 break-words", cell: (row) => row.item_name || "-" },
      soQty: { header: "SO Qty", headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.so_qty || "-" },
      approvedQty: { header: "Approved Qty", headerClass: "px-2 py-2 text-left w-[120px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.approved_qty || "-" },
      rate: { header: "Rate", headerClass: "px-2 py-2 text-left w-[90px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.rate || "-" },
      amount: { header: "Amount", headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.amount ?? "-" },
      dispatchQty: { header: "Dispatch Qty", headerClass: "px-2 py-2 text-left w-[110px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.dispatch_qty || "-" },
      pendingQty: { header: "Pending Qty", headerClass: "px-2 py-2 text-left w-[110px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.pending_qty || "-" },
      dueDate: { header: "Due Date", headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.due_date || "-" },
      createdBy: { header: "Created By", headerClass: "px-2 py-2 text-left w-[120px]", cellClass: "px-2 py-2 break-words", cell: (row) => row.created_by || "-" },
      updatedBy: { header: "Updated By", headerClass: "px-2 py-2 text-left w-[120px]", cellClass: "px-2 py-2 break-words", cell: (row) => row.updated_by || "-" },
      updatedDate: { header: "Updated Date", headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap", cellClass: "px-2 py-2 whitespace-nowrap", cell: (row) => row.updated_date || "-" },
    }),
    []
  );

  const orderedVisibleColumns = useMemo(
    () => columnOrder.filter((key) => visibleColumns[key] && columnLayout[key]),
    [columnOrder, visibleColumns, columnLayout]
  );

  const getSortValueByColumn = (row, key) => {
    switch (key) {
      case "status":
        return statusLabel(row.status) || "";
      case "date":
        return row.date || "";
      case "soNumber":
        return row.so_number || "";
      case "partyName":
        return row.party_name || "";
      case "itemName":
        return row.item_name || "";
      case "soQty":
        return row.so_qty ?? "";
      case "approvedQty":
        return row.approved_qty ?? "";
      case "rate":
        return row.rate ?? "";
      case "amount":
        return row.amount ?? "";
      case "dispatchQty":
        return row.dispatch_qty ?? "";
      case "pendingQty":
        return row.pending_qty ?? "";
      case "dueDate":
        return row.due_date || "";
      case "createdBy":
        return row.created_by || "";
      case "updatedBy":
        return row.updated_by || "";
      case "updatedDate":
        return row.updated_date || "";
      default:
        return "";
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredRows;

    const parseSortable = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "number") return value;
      const raw = String(value).trim();
      if (!raw) return "";
      const numeric = Number(raw);
      if (!Number.isNaN(numeric)) return numeric;
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return date.getTime();
      return raw.toLowerCase();
    };

    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const aVal = parseSortable(getSortValueByColumn(a, sortConfig.key));
      const bVal = parseSortable(getSortValueByColumn(b, sortConfig.key));
      if (aVal === bVal) return 0;
      if (aVal === "") return 1;
      if (bVal === "") return -1;
      return aVal > bVal ? directionMultiplier : -directionMultiplier;
    });
  }, [filteredRows, sortConfig]);

  if (isLoading) return <Loader />;

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
            <h1 className="text-xl font-bold">SO Dispatch Report</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SO Dispatch Report</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View sales order item-wise dispatch and pending quantities
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
                <PopoverContent align="end" className="w-64">
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    <p className="text-xs font-medium text-gray-500">Select headers to display</p>
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
                      );
                    })}
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
              <div className="grid grid-cols-1 md:grid-cols-12 md:items-end gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Date Range</Label>
                  <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
                    <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
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
                    onOpenChange={(open) => dateRangePreset === "custom" && setIsDatePickerOpen((p) => ({ ...p, from: open }))}
                  >
                    <PopoverTrigger asChild>
                      <button type="button" disabled={dateRangePreset !== "custom"} className={`w-full h-10 px-3 inline-flex items-center rounded-md border text-sm ${dateRangePreset === "custom" ? "bg-white" : "bg-gray-100 text-gray-500 cursor-not-allowed"}`}>
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        {fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "Start date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={fromDate ? new Date(fromDate) : undefined} onSelect={(d) => {
                        const ds = d ? format(d, "yyyy-MM-dd") : "";
                        setFromDate(ds);
                        if (ds && toDate && ds > toDate) setToDate(ds);
                        setIsDatePickerOpen((p) => ({ ...p, from: false }));
                      }} disabled={{ after: new Date() }} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">To Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                    onOpenChange={(open) => dateRangePreset === "custom" && setIsDatePickerOpen((p) => ({ ...p, to: open }))}
                  >
                    <PopoverTrigger asChild>
                      <button type="button" disabled={dateRangePreset !== "custom"} className={`w-full h-10 px-3 inline-flex items-center rounded-md border text-sm ${dateRangePreset === "custom" ? "bg-white" : "bg-gray-100 text-gray-500 cursor-not-allowed"}`}>
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        {toDate ? format(new Date(toDate), "dd-MM-yyyy") : "End date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={toDate ? new Date(toDate) : undefined} onSelect={(d) => {
                        setToDate(d ? format(d, "yyyy-MM-dd") : "");
                        setIsDatePickerOpen((p) => ({ ...p, to: false }));
                      }} disabled={[fromDate ? { before: new Date(fromDate) } : null, { after: new Date() }].filter(Boolean)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.status.map((name) => (
                        <SelectItem key={name} value={name}>{statusLabel(name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Party Name</Label>
                  <Select value={partyFilter} onValueChange={setPartyFilter}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.party.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Item Name</Label>
                  <Select value={itemFilter} onValueChange={setItemFilter}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.item.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
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
                  <Label className="text-xs text-gray-500 mb-1 block">Filter By</Label>
                  <Select
                    value={numericRangeField}
                    onValueChange={(value) => {
                      setNumericRangeField(value);
                      setNumericRangeMin("");
                      setNumericRangeMax("");
                    }}
                  >
                    <SelectTrigger className="h-10">
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

                <div className="md:col-span-2 flex flex-col justify-end">
                  <Label className="text-xs text-gray-500 mb-1 block invisible select-none" aria-hidden>
                    Actions
                  </Label>
                  <Button type="button" variant="outline" onClick={resetFilters} className="w-full h-10 shrink-0">
                    Clear Filters
                  </Button>
                </div>
                <div className="md:col-span-2 flex flex-col justify-end">
                  <Label className="text-xs text-gray-500 mb-1 block invisible select-none" aria-hidden>
                    Actions
                  </Label>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full h-10 shrink-0 inline-flex items-center justify-center gap-2"
                    onClick={() => setAnalysisOpen(true)}
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0" />
                    Analysis
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Item-wise dispatch analysis</DialogTitle>

              </DialogHeader>
              {itemWiseAnalysisRows.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">
                  No rows match the current filters — adjust filters and try again.
                </p>
              ) : (
                <Tabs value={analysisViewTab} onValueChange={setAnalysisViewTab} className="pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                    <TabsList className="grid w-full sm:w-auto sm:min-w-[280px] grid-cols-2 shrink-0">
                      <TabsTrigger value="cards" className="gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Cards
                      </TabsTrigger>
                      <TabsTrigger value="table" className="gap-2">
                        <Table2 className="h-4 w-4" />
                        Table
                      </TabsTrigger>
                    </TabsList>
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={analysisItemSearch}
                        onChange={(e) => setAnalysisItemSearch(e.target.value)}
                        placeholder="Search items by name..."
                        className="pl-9 h-10"
                      />
                    </div>
                  </div>
                  <TabsContent value="cards" className="mt-4 outline-none">

                    {filteredItemWiseAnalysisRows.length === 0 ? (
                      <p className="text-sm text-gray-500 py-8 text-center">No items match your search.</p>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[62vh] overflow-y-auto pr-1">
                      {filteredItemWiseAnalysisRows.map((r) => {
                        const totalMovement = r.dispatchedQty + r.pendingQty;
                        const pctDispatched =
                          totalMovement > 0 ? Math.round((r.dispatchedQty / totalMovement) * 100) : 0;
                        return (
                          <Card key={r.itemLabel} className="border shadow-sm overflow-hidden">
                            <CardHeader className="py-3 px-4 space-y-0">
                              <CardTitle className="text-sm font-semibold leading-snug break-words text-foreground">
                                {r.itemLabel}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 pt-0 space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700 px-2 py-2">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Total sales order
                                  </div>
                                  <div className="text-base font-semibold tabular-nums mt-0.5">
                                    {r.totalSalesOrderCount.toLocaleString()}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700 px-2 py-2">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Total sales order Qty
                                  </div>
                                  <div className="text-base font-semibold tabular-nums mt-0.5">{fmtQty(r.totalSalesOrderQty)}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-muted/60 px-2 py-2">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Approved
                                  </div>
                                  <div className="text-base font-semibold tabular-nums mt-0.5">{fmtQty(r.approvedQty)}</div>
                                </div>
                                <div className="rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200/80 dark:border-green-800 px-2 py-2">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-green-800 dark:text-green-300">
                                    Dispatched
                                  </div>
                                  <div className="text-base font-semibold tabular-nums text-green-800 dark:text-green-200 mt-0.5">
                                    {fmtQty(r.dispatchedQty)}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 px-2 py-2">
                                  <div className="text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
                                    Pending
                                  </div>
                                  <div className="text-base font-semibold tabular-nums text-amber-900 dark:text-amber-100 mt-0.5">
                                    {fmtQty(r.pendingQty)}
                                  </div>
                                </div>
                              </div>
                              {totalMovement > 0 ? (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] text-muted-foreground">
                                    <span>Dispatched vs pending (movement)</span>
                                    <span className="tabular-nums">{pctDispatched}% dispatched</span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                                    <div
                                      className="h-full bg-green-600 transition-all"
                                      style={{ width: `${pctDispatched}%` }}
                                      title="Dispatched share"
                                    />
                                    <div
                                      className="h-full bg-amber-500 transition-all"
                                      style={{ width: `${100 - pctDispatched}%` }}
                                      title="Pending share"
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    )}
                  </TabsContent>
                  <TabsContent value="table" className="mt-4 outline-none">
                    {filteredItemWiseAnalysisRows.length === 0 ? (
                      <p className="text-sm text-gray-500 py-8 text-center border rounded-md">No items match your search.</p>
                    ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium">Item</th>
                            <th className="text-right p-2 font-medium whitespace-nowrap">Total sales order</th>
                            <th className="text-right p-2 font-medium whitespace-nowrap">Total sales order Qty</th>
                            <th className="text-right p-2 font-medium">Approved qty</th>
                            <th className="text-right p-2 font-medium">Dispatched</th>
                            <th className="text-right p-2 font-medium">Pending</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItemWiseAnalysisRows.map((r) => (
                            <tr key={r.itemLabel} className="border-t">
                              <td className="p-2 max-w-[280px] break-words">{r.itemLabel}</td>
                              <td className="p-2 text-right tabular-nums whitespace-nowrap">
                                {r.totalSalesOrderCount.toLocaleString()}
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {r.totalSalesOrderQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {r.approvedQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                              <td className="p-2 text-right tabular-nums text-green-700">
                                {r.dispatchedQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                              <td className="p-2 text-right tabular-nums text-amber-700">
                                {r.pendingQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card><CardContent className="py-4 flex items-center justify-between"><div><div className="text-xs text-gray-500">Total Count</div><div className="text-xl font-bold">{summary.totalCount}</div></div><CalendarDays className="h-6 w-6 text-gray-400" /></CardContent></Card>
            <Card><CardContent className="py-4 flex items-center justify-between"><div><div className="text-xs text-gray-500">Total Pending</div><div className="text-xl font-bold">{summary.totalPending}</div></div><Clock className="h-6 w-6 text-amber-500" /></CardContent></Card>
            <Card><CardContent className="py-4 flex items-center justify-between"><div><div className="text-xs text-gray-500">Total Completed</div><div className="text-xl font-bold">{summary.totalCompleted}</div></div><CheckCircle className="h-6 w-6 text-green-500" /></CardContent></Card>
            <Card><CardContent className="py-4 flex items-center justify-between"><div><div className="text-xs text-gray-500">Total Party</div><div className="text-xl font-bold">{summary.uniquePartyCount}</div></div><Users className="h-6 w-6 text-blue-500" /></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">SO Listing</CardTitle>
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by SO number, party, item, broker, status..."
                    className="pl-9 h-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                <table className="min-w-[1600px] text-xs table-fixed">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left w-[130px] sticky top-0 z-20 bg-gray-100">Action</th>
                      {orderedVisibleColumns.map((key) => (
                        <th key={key} className={`${columnLayout[key].headerClass} sticky top-0 z-20 bg-gray-100`}>
                          <div className="flex items-center gap-1">
                            <span>{columnLayout[key].header}</span>
                            <div className="flex items-center gap-1 leading-none">
                              <button
                                type="button"
                                onClick={() => setSortConfig({ key, direction: "desc" })}
                                className={`h-3 w-3 inline-flex items-center justify-center ${
                                  sortConfig.key === key && sortConfig.direction === "desc"
                                    ? "text-black"
                                    : "text-gray-400 hover:text-gray-700"
                                }`}
                                title="Sort descending"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSortConfig({ key, direction: "asc" })}
                                className={`h-3 w-3 inline-flex items-center justify-center ${
                                  sortConfig.key === key && sortConfig.direction === "asc"
                                    ? "text-black"
                                    : "text-gray-400 hover:text-gray-700"
                                }`}
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
                    {sortedRows.map((row, idx) => (
                      <tr key={`${row.so_number}-${idx}`} className="border-b align-top">
                        <td className="px-2 py-2">
                          {normalizeStatus(row.status) === "pending" ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 border-green-600 text-green-700 hover:bg-green-50 inline-flex items-center gap-1"
                                onClick={() => handleItemApproveReject(row, "approve")}
                                disabled={approveRejectMutation.isPending}
                              >
                                <Check className="h-3.5 w-3.5" />
                                
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 border-red-600 text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
                                onClick={() => handleItemApproveReject(row, "reject")}
                                disabled={approveRejectMutation.isPending}
                              >
                                <X className="h-3.5 w-3.5" />
                                
                              </Button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        {orderedVisibleColumns.map((key) => (
                          <td key={key} className={columnLayout[key].cellClass}>
                            {columnLayout[key].cell(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {sortedRows.length === 0 && (
                      <tr>
                        <td className="px-3 py-8 text-center text-gray-500" colSpan={Math.max(shownColumnCount + 1, 2)}>No records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

