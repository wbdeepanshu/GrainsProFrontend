import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Menu, Search, CalendarDays, CheckCircle, Clock, Users, Download, Settings, GripVertical, ArrowUp, ArrowDown, CalendarIcon, Unlock, Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useSearch } from "wouter";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

/** Rotating styles for voucher-type picker cards */
const VOUCHER_CARD_STYLES = [
  {
    border: "border-blue-300",
    bg: "bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100",
    title: "text-blue-950",
  },
  {
    border: "border-emerald-300",
    bg: "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-100",
    title: "text-emerald-950",
  },
  {
    border: "border-violet-300",
    bg: "bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-100",
    title: "text-violet-950",
  },
  {
    border: "border-amber-300",
    bg: "bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100",
    title: "text-amber-950",
  },
  {
    border: "border-rose-300",
    bg: "bg-gradient-to-br from-rose-50 via-pink-50 to-red-100",
    title: "text-rose-950",
  },
  {
    border: "border-cyan-300",
    bg: "bg-gradient-to-br from-cyan-50 via-blue-50 to-slate-100",
    title: "text-cyan-950",
  },
];

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

const getBranchValue = (row) =>
  row.branch_name ||
  row.branch ||
  row.inward_branch_name ||
  row.po_branch_name ||
  row.godown_branch_name ||
  "";

export default function ProductionReport() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [location] = useLocation();
  const searchString = useSearch();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("monthly");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [search, setSearch] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [enteredByFilter, setEnteredByFilter] = useState("all");
  const [selectedVoucherTypeIds, setSelectedVoucherTypeIds] = useState([]);
  const [isVoucherTypeDialogOpen, setIsVoucherTypeDialogOpen] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    date: true,
    voucher: true,
    sourceItem: true,
    sourceGodown: true,
    consumptionQty: true,
    processConsumptionQty: true,
    destinationItem: true,
    destinationGodown: true,
    productionQty: true,
    startedAt: true,
    endAt: true,
    enteredBy: true,
    updatedBy: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    "status",
    "date",
    "voucher",
    "sourceItem",
    "sourceGodown",
    "consumptionQty",
    "processConsumptionQty",
    "destinationItem",
    "destinationGodown",
    "productionQty",
    "startedAt",
    "endAt",
    "enteredBy",
    "updatedBy",
  ]);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

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

  const { data: voucherTypesData, isPending: voucherTypesPending } = useQuery({
    queryKey: ["voucher-types-production-report"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-voucher-types/?is_active=true`);
      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to fetch voucher types");
      }
      return Array.isArray(data?.data) ? data.data : [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

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

  const voucherTypeOptions = useMemo(() => {
    const list = Array.isArray(voucherTypesData) ? voucherTypesData : [];
    return list.map((v) => ({
      id: String(v.id),
      name: v.name || `Voucher ${v.id}`,
    }));
  }, [voucherTypesData]);

  const selectedVoucherTypeLabel = useMemo(() => {
    if (!voucherTypeOptions.length) return "Select voucher type";
    if (selectedVoucherTypeIds.length === 0) return "Select voucher type";
    const match = voucherTypeOptions.find((v) => v.id === selectedVoucherTypeIds[0]);
    return match?.name || "Select voucher type";
  }, [selectedVoucherTypeIds, voucherTypeOptions]);

  const isConsumptionVoucherSelected = useMemo(() => {
    const activeVoucherName = selectedVoucherTypeLabel || "";
    return /consumption/i.test(activeVoucherName);
  }, [selectedVoucherTypeLabel]);

  const isProductionVoucherSelected = useMemo(() => {
    const activeVoucherName = selectedVoucherTypeLabel || "";
    return /production/i.test(activeVoucherName);
  }, [selectedVoucherTypeLabel]);

  const isStockTransferVoucherSelected = useMemo(() => {
    const activeVoucherName = selectedVoucherTypeLabel || "";
    return /stock\s*transfer/i.test(activeVoucherName);
  }, [selectedVoucherTypeLabel]);

  const isBrandTransferVoucherSelected = useMemo(() => {
    const activeVoucherName = selectedVoucherTypeLabel || "";
    return /brand\s*transfer/i.test(activeVoucherName);
  }, [selectedVoucherTypeLabel]);

  // Fumigation vouchers carry a `fumigation_info` block from the backend and
  // need a tailored column set (Qty + Fumigation Godown + Started At + End At).
  const isFumigationVoucherSelected = useMemo(() => {
    const activeVoucherName = selectedVoucherTypeLabel || "";
    return /fumigation/i.test(activeVoucherName);
  }, [selectedVoucherTypeLabel]);

  const sourceItemHeaderLabel = isStockTransferVoucherSelected
    ? "Item"
    : isConsumptionVoucherSelected
      ? "Items"
    : isProductionVoucherSelected
      ? "Process"
      : "Source Item";
  const sourceGodownHeaderLabel = isConsumptionVoucherSelected
    ? "Consumption Godown"
    : isBrandTransferVoucherSelected
      ? "Location"
      : "Source Godown";
  const consumptionQtyHeaderLabel =
    (isStockTransferVoucherSelected || isProductionVoucherSelected || isFumigationVoucherSelected)
      ? "Qty"
      : "Consumption Qty";
  const processConsumptionQtyHeaderLabel = isConsumptionVoucherSelected ? "Qty" : "Process Consumption Qty";
  const destinationItemHeaderLabel = isConsumptionVoucherSelected
    ? "Process"
    : isProductionVoucherSelected
      ? "Finished Item"
      : "Destination Item";
  const destinationGodownHeaderLabel = isConsumptionVoucherSelected
    ? "Process Godown"
    : isFumigationVoucherSelected
      ? "Fumigation Godown"
      : "Destination Godown";
  const productionQtyHeaderLabel = isConsumptionVoucherSelected ? "Process Op Stock" : "Production Qty";
  const hideDestinationItemColumn = isStockTransferVoucherSelected || isFumigationVoucherSelected;
  const hideProductionQtyColumn =
    isStockTransferVoucherSelected || isConsumptionVoucherSelected || isFumigationVoucherSelected;
  const hideDestinationGodownColumn = isBrandTransferVoucherSelected || isProductionVoucherSelected;
  const activeVoucherReportBase = selectedVoucherTypeIds.length > 0
    ? selectedVoucherTypeLabel
    : "Production";
  const reportTitle = `${activeVoucherReportBase} Report`;
  const reportSubtitle = `Voucher-wise ${activeVoucherReportBase.toLowerCase()} report from stock journal entries`;
  const listingTitle = `${activeVoucherReportBase} Listing`;

  const orderedColumnKeys = useMemo(
    () => {
      // Consumption vouchers need a fixed, business-defined sequence.
      if (isConsumptionVoucherSelected) {
        const base = columnOrder.filter((key) => {
          if (key === "sourceGodown") return false; // remove Consumption Godown
          if (key === "destinationGodown") return false; // remove Process Godown
          if (key === "productionQty") return false; // Process Op Stock — not shown / not in API
          if (key === "startedAt" || key === "endAt") return false; // fumigation-only
          if (key === "status") return false; // fumigation-only
          return true;
        });
        const has = new Set(base);
        const seq = [
          "date",
          "voucher",
          "sourceItem",
          "consumptionQty",
          "destinationItem",
          "processConsumptionQty",
          "enteredBy",
          "updatedBy",
        ].filter((k) => has.has(k));
        const remaining = base.filter((k) => !seq.includes(k));
        return [...seq, ...remaining];
      }

      // Fumigation vouchers: fixed sequence with Status (+ Release) as the
      // first column, then Qty + Fumigation Godown + Started At + End At
      // sourced from the new fumigation_info section.
      if (isFumigationVoucherSelected) {
        const seq = [
          "status",
          "date",
          "voucher",
          "sourceItem",
          "sourceGodown",
          "consumptionQty",
          "destinationGodown",
          "startedAt",
          "endAt",
          "enteredBy",
          "updatedBy",
        ];
        return seq;
      }

      const filtered = columnOrder.filter((key) => {
        if (isProductionVoucherSelected && key === "sourceGodown") return false;
        if (hideDestinationItemColumn && key === "destinationItem") return false;
        if (hideDestinationGodownColumn && key === "destinationGodown") return false;
        if (hideProductionQtyColumn && key === "productionQty") return false;
        if (key.endsWith("Balance")) return false;
        if (!isConsumptionVoucherSelected && key === "processConsumptionQty") return false;
        if (key === "startedAt" || key === "endAt") return false; // fumigation-only
        if (key === "status") return false; // fumigation-only
        return true;
      });

      if (!isStockTransferVoucherSelected && !isBrandTransferVoucherSelected) return filtered;

      const withSwap = [...filtered];
      const sourceGodownIndex = withSwap.indexOf("sourceGodown");
      const consumptionQtyIndex = withSwap.indexOf("consumptionQty");
      if (sourceGodownIndex === -1 || consumptionQtyIndex === -1) return withSwap;

      [withSwap[sourceGodownIndex], withSwap[consumptionQtyIndex]] = [
        withSwap[consumptionQtyIndex],
        withSwap[sourceGodownIndex],
      ];
      return withSwap;
    },
    [
      columnOrder,
      isConsumptionVoucherSelected,
      isProductionVoucherSelected,
      isStockTransferVoucherSelected,
      hideDestinationGodownColumn,
      hideDestinationItemColumn,
      hideProductionQtyColumn,
      isBrandTransferVoucherSelected,
      isFumigationVoucherSelected,
    ]
  );

  const columnOptions = useMemo(
    () => [
      { key: "status", label: "Status" },
      { key: "date", label: "Date" },
      { key: "voucher", label: "Voucher" },
      { key: "sourceItem", label: sourceItemHeaderLabel },
      { key: "sourceGodown", label: sourceGodownHeaderLabel },
      { key: "consumptionQty", label: consumptionQtyHeaderLabel },
      { key: "processConsumptionQty", label: processConsumptionQtyHeaderLabel },
      {
        key: "destinationItem",
        label: destinationItemHeaderLabel,
      },
      {
        key: "destinationGodown",
        label: destinationGodownHeaderLabel,
      },
      {
        key: "productionQty",
        label: productionQtyHeaderLabel,
      },
      { key: "startedAt", label: "Start Time" },
      { key: "endAt", label: "End Time" },
      { key: "enteredBy", label: "Entered By" },
      { key: "updatedBy", label: "Updated By" },
    ],
    [
      sourceItemHeaderLabel,
      sourceGodownHeaderLabel,
      consumptionQtyHeaderLabel,
      processConsumptionQtyHeaderLabel,
      destinationItemHeaderLabel,
      destinationGodownHeaderLabel,
      productionQtyHeaderLabel,
    ]
  );

  const visibleColumnState = useMemo(
    () => ({
      ...visibleColumns,
      sourceGodown:
        (isProductionVoucherSelected || isConsumptionVoucherSelected) ? false : visibleColumns.sourceGodown,
      destinationGodown: hideDestinationGodownColumn ? false : visibleColumns.destinationGodown,
      destinationItem: hideDestinationItemColumn ? false : visibleColumns.destinationItem,
      productionQty: hideProductionQtyColumn ? false : visibleColumns.productionQty,
      processConsumptionQty: isConsumptionVoucherSelected ? visibleColumns.processConsumptionQty : false,
      // Started At / End At / Status are sourced from the fumigation_info
      // block and only meaningful for fumigation vouchers.
      startedAt: isFumigationVoucherSelected ? visibleColumns.startedAt : false,
      endAt: isFumigationVoucherSelected ? visibleColumns.endAt : false,
      status: isFumigationVoucherSelected ? visibleColumns.status : false,
    }),
    [
      visibleColumns,
      isConsumptionVoucherSelected,
      isProductionVoucherSelected,
      isStockTransferVoucherSelected,
      hideDestinationGodownColumn,
      hideDestinationItemColumn,
      hideProductionQtyColumn,
      isFumigationVoucherSelected,
    ]
  );

  const shownColumnCount = Object.values(visibleColumnState).filter(Boolean).length;
  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      if (isConsumptionVoucherSelected && (key === "sourceGodown" || key === "destinationGodown")) return prev;
      if (isProductionVoucherSelected && key === "sourceGodown") return prev;
      if (hideDestinationItemColumn && key === "destinationItem") return prev;
      if (hideDestinationGodownColumn && key === "destinationGodown") return prev;
      if (hideProductionQtyColumn && key === "productionQty") return prev;
      if (prev[key] && shownColumnCount === 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const applySingleVoucherType = (id) => {
    if (!id) return;
    setSelectedVoucherTypeIds([id]);
    setIsVoucherTypeDialogOpen(false);
  };

  React.useEffect(() => {
    // Keep selected voucher in sync with query changes from sidebar:
    // /reports/production-report?voucher_type_id=123
    try {
      const paramId = new URLSearchParams(searchString || "").get("voucher_type_id");
      if (paramId && String(paramId).trim()) {
        setSelectedVoucherTypeIds([String(paramId).trim()]);
        setIsVoucherTypeDialogOpen(false);
      } else if (selectedVoucherTypeIds.length === 0) {
        setIsVoucherTypeDialogOpen(true);
      }
    } catch {
      // ignore
    }
  }, [location, searchString, selectedVoucherTypeIds.length]);

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
    setVoucherId("");
    setBranchFilter("all");
    setEnteredByFilter("all");
  };

  const getSelectedColumnDefs = () => {
    const toLines = (arr) => ((arr || []).length ? arr.join("\n") : "-");
    const allDefs = [
      {
        key: "status",
        header: "Status",
        value: (row) => row?.fumigation_info?.status || "-",
      },
      { key: "date", header: "Date", value: (row) => row.date || "-" },
      {
        key: "voucher",
        header: "Voucher",
        value: (row) => `${row.voucher_no || "-"}${row.voucher_name ? `\n${row.voucher_name}` : ""}`,
      },
      { key: "sourceItem", header: sourceItemHeaderLabel, value: (row) => toLines(row.source_lines) },
      { key: "sourceGodown", header: sourceGodownHeaderLabel, value: (row) => toLines(row.source_godown_lines) },
      { key: "consumptionQty", header: consumptionQtyHeaderLabel, value: (row) => toLines(row.consumption_lines) },
      { key: "processConsumptionQty", header: processConsumptionQtyHeaderLabel, value: (row) => toLines(row.consumption_lines) },
      {
        key: "destinationItem",
        header: destinationItemHeaderLabel,
        value: (row) => toLines(row.destination_lines),
      },
      {
        key: "destinationGodown",
        header: destinationGodownHeaderLabel,
        value: (row) => toLines(row.destination_godown_lines),
      },
      {
        key: "productionQty",
        header: productionQtyHeaderLabel,
        value: (row) => toLines(row.production_lines),
      },
      {
        key: "startedAt",
        header: "Start Time",
        value: (row) => formatFumigationTimestamp(row?.fumigation_info?.created_at),
      },
      {
        key: "endAt",
        header: "End Time",
        value: (row) => formatFumigationTimestamp(row?.fumigation_info?.locking_end_at),
      },
      { key: "enteredBy", header: "Entered By", value: (row) => row.entered_by || "-" },
      { key: "updatedBy", header: "Updated By", value: (row) => row.updated_by || "N/A" },
    ];
    const defsByKey = new Map(allDefs.map((def) => [def.key, def]));
    return orderedColumnKeys
      .filter((key) => visibleColumnState[key] && defsByKey.has(key))
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
      const ws = workbook.addWorksheet(reportTitle);

      ws.addRow([orgName]);
      ws.addRow([`Branch Name: ${branchName}`]);
      ws.addRow([`Date: ${currentDate}`]);
      ws.addRow([reportTitle]);
      ws.addRow([]);
      ws.addRow(selectedDefs.map((d) => d.header));
      rows.forEach((row) => ws.addRow(selectedDefs.map((d) => d.value(row))));

      ws.mergeCells(1, 1, 1, colCount);
      ws.mergeCells(2, 1, 2, colCount);
      ws.mergeCells(3, 1, 3, colCount);
      ws.mergeCells(4, 1, 4, colCount);

      ws.columns = selectedDefs.map(() => ({ width: 24 }));

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
      a.download = `production_report_${format(new Date(), "yyyyMMdd")}.xlsx`;
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
      doc.text(reportTitle.toUpperCase(), pageWidth / 2, headerY + 6.7, { align: "center" });

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
      const body = rows.map((row) => selectedDefs.map((d) => d.value(row)));

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

      doc.save(`production_report_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err?.message || "Could not generate PDF file.",
        variant: "destructive",
      });
    }
  };

  const fetchReport = async () => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");

    const params = new URLSearchParams();
    params.append("from_date", toDdMmYyyy(fromDate));
    params.append("to_date", toDdMmYyyy(toDate));
    if (voucherId.trim()) params.append("voucher_id", voucherId.trim());
    selectedVoucherTypeIds.forEach((id) => params.append("voucher_type_id", id));

    const response = await apiRequest("GET", `${API_BASE_URL}/api/process/stock-journal-voucher-report/?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to fetch production report");
    }
    return data;
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["production-report", fromDate, toDate, voucherId, selectedVoucherTypeIds.join(",")],
    queryFn: fetchReport,
    enabled:
      !!AuthService.getAccessToken() &&
      selectedVoucherTypeIds.length === 1,
    refetchOnWindowFocus: false,
  });

  // Tracks per-voucher release-in-flight so the button can show a spinner
  // and the row's other Release buttons (if any) stay disabled. Keyed by
  // voucher_no.
  const [releasingVoucherNo, setReleasingVoucherNo] = useState(null);

  const releaseFumigationLock = async (voucherNo) => {
    if (!voucherNo || releasingVoucherNo) return;
    const token = AuthService.getAccessToken();
    if (!token) {
      toast({
        title: "Auth error",
        description: "No authentication token found",
        variant: "destructive",
      });
      return;
    }
    setReleasingVoucherNo(voucherNo);
    try {
      const response = await fetch(`${API_BASE_URL}/api/release-stock-batch-lock/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ voucher_number: voucherNo }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || (body?.status && body.status >= 400)) {
        throw new Error(body?.message || `HTTP error! status: ${response.status}`);
      }
      const releasedCount = body?.data?.released_count ?? 0;
      toast({
        title: releasedCount > 0 ? "Stock released" : "No locks to release",
        description:
          releasedCount > 0
            ? `${releasedCount} batch lock${releasedCount === 1 ? "" : "s"} released for ${voucherNo}.`
            : body?.message || "No active future locks were found.",
      });
      await refetch();
    } catch (e) {
      toast({
        title: "Release failed",
        description: e?.message || "Failed to release locked stock",
        variant: "destructive",
      });
    } finally {
      setReleasingVoucherNo(null);
    }
  };

  const { data: branchesData = [] } = useQuery({
    queryKey: ["production-report-branches"],
    queryFn: fetchBranches,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Renders an ISO timestamp from the `fumigation_info` block as
  // "dd-MMM-yy HH:mm" to match the existing date column style. Returns
  // "N/A" when the value is null / unparseable so the cell never goes
  // blank for fumigation rows that pre-date the new column.
  const formatFumigationTimestamp = (value) => {
    if (!value) return "N/A";
    try {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return "N/A";
      return format(parsed, "dd-MMM-yy HH:mm");
    } catch {
      return "N/A";
    }
  };

  const groupedRows = useMemo(() => {
    const list = Array.isArray(data?.data) ? data.data : [];
    const groupedMap = new Map();

    list.forEach((row) => {
      const key = `${row.transaction_id || ""}__${row.voucher_no || ""}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          ...row,
          source_lines: [],
          source_godown_lines: [],
          destination_lines: [],
          destination_godown_lines: [],
          consumption_lines: [],
          production_lines: [],
        });
      }

      const group = groupedMap.get(key);

      if (row.source_item || row.source_godown || row.consumption_qty) {
        const srcLine = row.source_item || "-";
        const srcGodownLine = row.source_godown || "-";
        const srcQtyLine = row.consumption_qty || "-";
        if (!group.source_lines.includes(srcLine)) group.source_lines.push(srcLine);
        if (!group.source_godown_lines.includes(srcGodownLine)) group.source_godown_lines.push(srcGodownLine);
        if (!group.consumption_lines.includes(srcQtyLine)) group.consumption_lines.push(srcQtyLine);
      }

      if (row.destination_item || row.destination_godown || row.production_qty) {
        const dstLine = row.destination_item || "-";
        const dstGodownLine = row.destination_godown || "-";
        const dstQtyLine = row.production_qty || "-";
        if (!group.destination_lines.includes(dstLine)) group.destination_lines.push(dstLine);
        if (!group.destination_godown_lines.includes(dstGodownLine)) group.destination_godown_lines.push(dstGodownLine);
        if (!group.production_lines.includes(dstQtyLine)) group.production_lines.push(dstQtyLine);
      }
    });

    return Array.from(groupedMap.values());
  }, [data]);

  const branchOptions = useMemo(() => {
    const branchNamesFromApi = Array.isArray(branchesData)
      ? branchesData.map((b) => b?.name).filter(Boolean)
      : [];
    const branchNamesFromRows = groupedRows.map((r) => getBranchValue(r)).filter(Boolean);
    const merged = [...new Set([...branchNamesFromApi, ...branchNamesFromRows])];
    return ["all", ...merged];
  }, [branchesData, groupedRows]);

  const enteredByOptions = useMemo(() => {
    const names = groupedRows
      .map((r) => String(r.entered_by || "").trim())
      .filter(Boolean);
    return ["all", ...new Set(names)];
  }, [groupedRows]);

  const rows = useMemo(() => {
    let list = [...groupedRows];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((row) =>
        String(row.voucher_no || "").toLowerCase().includes(term) ||
        String(row.voucher_name || "").toLowerCase().includes(term) ||
        String((row.source_lines || []).join(" ")).toLowerCase().includes(term) ||
        String((row.destination_lines || []).join(" ")).toLowerCase().includes(term) ||
        String((row.consumption_lines || []).join(" ")).toLowerCase().includes(term) ||
        String((row.production_lines || []).join(" ")).toLowerCase().includes(term) ||
        String(row.entered_by || "").toLowerCase().includes(term)
      );
    }

    const hasBranchInRows = list.some((row) => String(getBranchValue(row) || "").trim() !== "");
    if (branchFilter !== "all" && hasBranchInRows) {
      list = list.filter((row) => String(getBranchValue(row) || "") === branchFilter);
    }

    if (enteredByFilter !== "all") {
      list = list.filter((row) => String(row.entered_by || "") === enteredByFilter);
    }

    return list;
  }, [groupedRows, search, branchFilter, enteredByFilter]);

  const summary = useMemo(() => {
    const totalRows = rows.length;
    const totalQty = rows.reduce((sum, r) => sum + (parseFloat(r.production_qty) || 0), 0);
    const totalConsumption = rows.reduce((sum, r) => sum + (parseFloat(r.consumption_qty) || 0), 0);
    const uniqueEnteredBy = new Set(rows.map((r) => (r.entered_by || "").trim()).filter(Boolean)).size;
    return { totalRows, totalQty, totalConsumption, uniqueEnteredBy };
  }, [rows]);

  const columnLayout = useMemo(
    () => ({
      status: {
        header: "Status",
        headerClass: "px-2 py-2 text-left w-[14%] whitespace-nowrap",
        cellClass: "px-2 py-2 whitespace-nowrap",
        cell: (row) => {
          const status = row?.fumigation_info?.status || "";
          const voucherNo = row?.voucher_no || "";
          const isPending = String(status).toLowerCase() === "pending";
          const isCompleted = String(status).toLowerCase() === "completed";
          const isReleasingThis =
            !!voucherNo && releasingVoucherNo === voucherNo;
          return (
            <div className="inline-flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                  <CheckCircle className="h-3 w-3" />
                  Completed
                </span>
              ) : isPending ? (
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-100 text-amber-700 text-xs">
                  <Clock className="h-3 w-3" />
                  Pending
                </span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
              {isPending && voucherNo ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 p-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    releaseFumigationLock(voucherNo);
                  }}
                  disabled={!!releasingVoucherNo}
                  title="Release lock"
                  aria-label="Release lock"
                >
                  {isReleasingThis ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}
            </div>
          );
        },
        sortValue: (row) => row?.fumigation_info?.status || "",
      },
      date: {
        header: "Date",
        headerClass: "px-2 py-2 text-left w-[8%]",
        cellClass: "px-2 py-2",
        cell: (row) => row.date || "-",
        sortValue: (row) => row.date || "",
      },
      voucher: {
        header: "Voucher",
        headerClass: "px-2 py-2 text-left w-[12%]",
        cellClass: "px-2 py-2",
        cell: (row) => (
          <>
            <div className="font-medium">{row.voucher_no || "-"}</div>
            <div className="text-[11px] text-gray-600">{row.voucher_name || "-"}</div>
          </>
        ),
        sortValue: (row) => `${row.voucher_no || ""} ${row.voucher_name || ""}`.trim(),
      },
      sourceItem: {
        header: sourceItemHeaderLabel,
        headerClass: "px-2 py-2 text-left w-[16%]",
        cellClass: "px-2 py-2 break-words",
        cell: (row) =>
          (row.source_lines || []).length > 0 ? (
            <div className="space-y-0.5">
              {row.source_lines.map((line, i) => (
                <div key={`src-line-${row.transaction_id}-${i}`}>{line}</div>
              ))}
            </div>
          ) : "-",
        sortValue: (row) => (row.source_lines || []).join(" "),
      },
      sourceGodown: {
        header: sourceGodownHeaderLabel,
        headerClass: "px-2 py-2 text-left w-[13%]",
        cellClass: "px-2 py-2 break-words",
        cell: (row) =>
          (row.source_godown_lines || []).length > 0 ? (
            <div className="space-y-0.5">
              {(row.source_godown_lines || []).map((line, i) => (
                <div key={`src-godown-${row.transaction_id}-${i}`}>{line || "-"}</div>
              ))}
            </div>
          ) : "-",
        sortValue: (row) => (row.source_godown_lines || []).join(" "),
      },
      consumptionQty: {
        header: consumptionQtyHeaderLabel,
        headerClass: "px-2 py-2 text-left w-[10%]",
        cellClass: "px-2 py-2",
        cell: (row) =>
          (row.consumption_lines || []).length > 0 ? (
            <div className="space-y-0.5">
              {row.consumption_lines.map((qty, i) => (
                <div key={`cons-line-${row.transaction_id}-${i}`}>{qty}</div>
              ))}
            </div>
          ) : "-",
        sortValue: (row) =>
          (row.consumption_lines || [])
            .map((qty) => Number.parseFloat(qty))
            .find((num) => Number.isFinite(num)) ?? 0,
      },
      processConsumptionQty: {
        header: processConsumptionQtyHeaderLabel,
        headerClass: "px-2 py-2 text-left w-[10%]",
        cellClass: "px-2 py-2",
        cell: (row) =>
          (row.consumption_lines || []).length > 0 ? (
            <div className="space-y-0.5">
              {row.consumption_lines.map((qty, i) => (
                <div key={`pcons-line-${row.transaction_id}-${i}`}>{qty}</div>
              ))}
            </div>
          ) : "-",
        sortValue: (row) =>
          (row.consumption_lines || [])
            .map((qty) => Number.parseFloat(qty))
            .find((num) => Number.isFinite(num)) ?? 0,
      },
      destinationItem: {
        header: destinationItemHeaderLabel,
        headerClass: "px-2 py-2 text-left w-[16%]",
        cellClass: "px-2 py-2 break-words",
        cell: (row) =>
          (row.destination_lines || []).length > 0 ? (
            <div className="space-y-0.5">
              {row.destination_lines.map((line, i) => (
                <div key={`dst-line-${row.transaction_id}-${i}`}>{line}</div>
              ))}
            </div>
          ) : "-",
        sortValue: (row) => (row.destination_lines || []).join(" "),
      },
      destinationGodown: {
        header: destinationGodownHeaderLabel,
        headerClass: "px-2 py-2 text-left w-[13%]",
        cellClass: "px-2 py-2 break-words",
        cell: (row) =>
          (row.destination_godown_lines || []).length > 0 ? (
            <div className="space-y-0.5">
              {(row.destination_godown_lines || []).map((line, i) => (
                <div key={`dst-godown-${row.transaction_id}-${i}`}>{line || "-"}</div>
              ))}
            </div>
          ) : "-",
        sortValue: (row) => (row.destination_godown_lines || []).join(" "),
      },
      productionQty: {
        header: productionQtyHeaderLabel,
        headerClass: "px-2 py-2 text-left w-[10%]",
        cellClass: "px-2 py-2",
        cell: (row) =>
          (row.production_lines || []).length > 0 ? (
            <div className="space-y-0.5">
              {row.production_lines.map((qty, i) => (
                <div key={`prod-line-${row.transaction_id}-${i}`}>{qty}</div>
              ))}
            </div>
          ) : "-",
        sortValue: (row) =>
          (row.production_lines || [])
            .map((qty) => Number.parseFloat(qty))
            .find((num) => Number.isFinite(num)) ?? 0,
      },
      startedAt: {
        header: "Start Time",
        headerClass: "px-2 py-2 text-left w-[12%]",
        cellClass: "px-2 py-2",
        cell: (row) => formatFumigationTimestamp(row?.fumigation_info?.created_at),
        sortValue: (row) => row?.fumigation_info?.created_at || "",
      },
      endAt: {
        header: "End Time",
        headerClass: "px-2 py-2 text-left w-[12%]",
        cellClass: "px-2 py-2",
        cell: (row) => formatFumigationTimestamp(row?.fumigation_info?.locking_end_at),
        sortValue: (row) => row?.fumigation_info?.locking_end_at || "",
      },
      enteredBy: {
        header: "Entered By",
        headerClass: "px-2 py-2 text-left w-[10%]",
        cellClass: "px-2 py-2",
        cell: (row) => row.entered_by || "-",
        sortValue: (row) => row.entered_by || "",
      },
      updatedBy: {
        header: "Updated By",
        headerClass: "px-2 py-2 text-left w-[10%]",
        cellClass: "px-2 py-2",
        cell: (row) => row.updated_by || "N/A",
        sortValue: (row) => row.updated_by || "",
      },
    }),
    [
      sourceItemHeaderLabel,
      sourceGodownHeaderLabel,
      consumptionQtyHeaderLabel,
      processConsumptionQtyHeaderLabel,
      destinationItemHeaderLabel,
      destinationGodownHeaderLabel,
      productionQtyHeaderLabel,
      releasingVoucherNo,
    ]
  );

  const orderedVisibleColumns = useMemo(
    () => orderedColumnKeys.filter((key) => visibleColumnState[key] && columnLayout[key]),
    [orderedColumnKeys, visibleColumnState, columnLayout]
  );

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction || !columnLayout[sortConfig.key]?.sortValue) {
      return rows;
    }

    const parseSortable = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "number") return value;
      const text = String(value).trim();
      if (!text) return "";
      const numeric = Number.parseFloat(text);
      if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(text)) return numeric;
      if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
        const [dd, mm, yyyy] = text.split("-").map(Number);
        return new Date(yyyy, (mm || 1) - 1, dd || 1).getTime();
      }
      const dateValue = Date.parse(text);
      if (!Number.isNaN(dateValue)) return dateValue;
      return text.toLowerCase();
    };

    const getSortValue = columnLayout[sortConfig.key].sortValue;
    return [...rows].sort((a, b) => {
      const valueA = parseSortable(getSortValue(a));
      const valueB = parseSortable(getSortValue(b));
      let cmp = 0;
      if (typeof valueA === "number" && typeof valueB === "number") {
        cmp = valueA - valueB;
      } else {
        cmp = String(valueA).localeCompare(String(valueB), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sortConfig, columnLayout]);

  React.useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load production report",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const showBlockingLoader =
    isLoading && selectedVoucherTypeIds.length === 1 && !isVoucherTypeDialogOpen;

  if (showBlockingLoader) return <Loader />;

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      <Dialog modal={false} open={isVoucherTypeDialogOpen} onOpenChange={setIsVoucherTypeDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select voucher type</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tap a voucher card to load the Production Listing for that type.
            </p>
            {voucherTypesPending ? (
              <div className="py-10 flex justify-center text-sm text-gray-500">Loading voucher types…</div>
            ) : voucherTypeOptions.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">No voucher types available.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {voucherTypeOptions.map((option, idx) => {
                  const st = VOUCHER_CARD_STYLES[idx % VOUCHER_CARD_STYLES.length];
                  const isSelected = selectedVoucherTypeIds[0] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => applySingleVoucherType(option.id)}
                      className={[
                        "rounded-xl border-2 p-4 text-left shadow-sm transition hover:shadow-md",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2",
                        st.border,
                        st.bg,
                        isSelected ? "ring-2 ring-gray-900 ring-offset-2" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className={`text-sm font-semibold leading-snug ${st.title}`}>{option.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="app-main-content">
        {isMobile && (
          <div className="bg-white shadow-sm border-b p-4 flex items-center justify-between">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 rounded-md hover:bg-gray-100">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold">{reportTitle}</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-6">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{reportTitle}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{reportSubtitle}</p>
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
                      {orderedColumnKeys.map((key) => {
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
                            checked={visibleColumnState[col.key]}
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

          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 sm:pt-2 shrink-0">
                Voucher type
              </Label>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto sm:min-w-[280px] justify-start gap-2 font-normal h-10"
                onClick={() => setIsVoucherTypeDialogOpen(true)}
              >
                <span className="truncate text-left text-sm">{selectedVoucherTypeLabel}</span>
              </Button>
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
                        <SelectItem key={branch} value={branch}>
                          {branch === "all" ? "All Branches" : branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Entered By</Label>
                  <Select value={enteredByFilter} onValueChange={setEnteredByFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      {enteredByOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name === "all" ? "All" : name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4">
                  <Label className="text-xs text-gray-500 mb-1 block">Search</Label>
                  <div className="relative">
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search production listing..."
                      className="pl-9"
                    />
                  </div>
                </div>
                
                
                <div className="md:col-span-2 flex items-end">
                  <Button variant="outline" onClick={resetAllFilters} className="w-full">
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-700">Total Rows</div>
                  <div className="text-xl font-bold text-blue-900">{summary.totalRows}</div>
                </div>
                <CalendarDays className="h-6 w-6 text-blue-500" />
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-700">Total Consumption</div>
                  <div className="text-xl font-bold text-amber-900">{summary.totalConsumption.toFixed(2)}</div>
                </div>
                <Clock className="h-6 w-6 text-amber-500" />
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-100/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-green-700">Total Qty</div>
                  <div className="text-xl font-bold text-green-900">{summary.totalQty.toFixed(2)}</div>
                </div>
                <CheckCircle className="h-6 w-6 text-green-500" />
              </CardContent>
            </Card>
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-purple-100/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-violet-700">Entered By</div>
                  <div className="text-xl font-bold text-violet-900">{summary.uniqueEnteredBy}</div>
                </div>
                <Users className="h-6 w-6 text-violet-500" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{listingTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full max-h-[min(72vh,calc(100vh-14rem))] overflow-auto relative isolate">
                <table className="w-full text-xs table-fixed min-w-[1400px] border-separate border-spacing-0">
                  <thead className="bg-gray-100">
                    <tr>
                      {orderedVisibleColumns.map((key) => (
                        <th
                          key={key}
                          className={`${columnLayout[key].headerClass} sticky top-0 z-30 bg-gray-100 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{columnLayout[key].header}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Sort ${columnLayout[key].header} descending`}
                                onClick={() => setSortConfig({ key, direction: "desc" })}
                                className={`p-0.5 rounded hover:bg-gray-200 ${
                                  sortConfig.key === key && sortConfig.direction === "desc"
                                    ? "text-gray-900"
                                    : "text-gray-400"
                                }`}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Sort ${columnLayout[key].header} ascending`}
                                onClick={() => setSortConfig({ key, direction: "asc" })}
                                className={`p-0.5 rounded hover:bg-gray-200 ${
                                  sortConfig.key === key && sortConfig.direction === "asc"
                                    ? "text-gray-900"
                                    : "text-gray-400"
                                }`}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, idx) => (
                      <tr key={`${row.transaction_id}-${idx}`} className="border-b align-top">
                        {orderedVisibleColumns.map((key) => (
                          <td key={key} className={columnLayout[key].cellClass}>
                            {columnLayout[key].cell(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {sortedRows.length === 0 && (
                      <tr>
                        <td className="px-2 py-8 text-center text-gray-500" colSpan={Math.max(orderedVisibleColumns.length, 1)}>
                          No records found.
                        </td>
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

