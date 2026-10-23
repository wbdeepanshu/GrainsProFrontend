import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  ArrowLeftRight,
  CalendarIcon,
  Menu,
  Search,
  RefreshCw,
  Download,
  Settings,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

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

const toDdMmYyyy = (dateText) => {
  const d = new Date(dateText);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

function isSjBrandTransferVoucher(v) {
  const n = (v?.name || "").replace(/\s+/g, " ").trim().toLowerCase();
  return n === "sj brand transfer" || n.startsWith("sj brand transfer");
}

export default function BrandTransferReport() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("monthly");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    voucherNo: true,
    sourceItemName: true,
    sourceQty: true,
    location: true,
    finishedItemName: true,
    finishedQty: true,
    enteredBy: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    "date",
    "voucherNo",
    "sourceItemName",
    "sourceQty",
    "location",
    "finishedItemName",
    "finishedQty",
    "enteredBy",
  ]);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const columnOptions = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Voucher No" },
    { key: "sourceItemName", label: "Source Items" },
    { key: "sourceQty", label: "Qty" },
    { key: "location", label: "Godown" },
    { key: "finishedItemName", label: "Destination Item" },
    { key: "finishedQty", label: "Qty" },
    { key: "enteredBy", label: "Entered By" },
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

  const columnLayout = useMemo(
    () => ({
      date: {
        headerClass: "px-2 py-2 text-left w-[100px] whitespace-nowrap",
        cellClass: "px-2 py-2 whitespace-nowrap",
        header: "Date",
        cell: (row) => row.date || "—",
        sortValue: (row) => row.date || "",
      },
      voucherNo: {
        headerClass: "px-2 py-2 text-left min-w-[140px] whitespace-nowrap",
        cellClass: "px-2 py-2 whitespace-nowrap",
        header: "Voucher No",
        cell: (row) => row.voucherNo || "—",
        sortValue: (row) => row.voucherNo || "",
      },
      sourceItemName: {
        headerClass: "px-2 py-2 text-left min-w-[180px]",
        cellClass: "px-2 py-2 break-words",
        header: "Source Items",
        cell: (row) => row.sourceItemName || "—",
        sortValue: (row) => row.sourceItemName || "",
      },
      sourceQty: {
        headerClass: "px-2 py-2 text-left min-w-[120px] whitespace-nowrap",
        cellClass: "px-2 py-2 text-left font-mono whitespace-normal break-words",
        header: "Qty",
        cell: (row) => row.sourceQty ?? "—",
        sortValue: (row) => {
          const q = row.sourceQty;
          if (q == null || q === "—" || q === "") return "";
          const n = Number.parseFloat(String(q));
          return Number.isFinite(n) ? n : String(q);
        },
      },
      location: {
        headerClass: "px-2 py-2 text-left min-w-[150px]",
        cellClass: "px-2 py-2 break-words",
        header: "Godown",
        cell: (row) => row.location || "—",
        sortValue: (row) => row.location || "",
      },
      finishedItemName: {
        headerClass: "px-2 py-2 text-left min-w-[180px]",
        cellClass: "px-2 py-2 break-words",
        header: "Destination Item",
        cell: (row) => row.finishedItemName || "—",
        sortValue: (row) => row.finishedItemName || "",
      },
      finishedQty: {
        headerClass: "px-2 py-2 text-left min-w-[120px] whitespace-nowrap",
        cellClass: "px-2 py-2 text-left font-mono whitespace-normal break-words",
        header: "Qty",
        cell: (row) => row.finishedQty ?? "—",
        sortValue: (row) => {
          const q = row.finishedQty;
          if (q == null || q === "—" || q === "") return "";
          const n = Number.parseFloat(String(q));
          return Number.isFinite(n) ? n : String(q);
        },
      },
      enteredBy: {
        headerClass: "px-2 py-2 text-left min-w-[130px]",
        cellClass: "px-2 py-2 break-words",
        header: "Entered By",
        cell: (row) => row.enteredBy || "—",
        sortValue: (row) => row.enteredBy || "",
      },
    }),
    []
  );

  const orderedVisibleColumns = useMemo(
    () => columnOrder.filter((key) => visibleColumns[key] && columnLayout[key]),
    [columnOrder, visibleColumns, columnLayout]
  );

  const { hasReadPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead = hasReadPermission("stock_journals");

  useEffect(() => {
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

  const { data: voucherTypesData, isLoading: voucherTypesLoading } = useQuery({
    queryKey: ["voucher-types-brand-transfer-report"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-voucher-types/?is_active=true`);
      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to fetch voucher types");
      }
      return Array.isArray(data?.data) ? data.data : [];
    },
    enabled: !!AuthService.getAccessToken() && canRead && !permissionsLoading,
    refetchOnWindowFocus: false,
  });

  const brandTransferVoucherTypeIds = useMemo(() => {
    const list = Array.isArray(voucherTypesData) ? voucherTypesData : [];
    return list.filter(isSjBrandTransferVoucher).map((v) => String(v.id));
  }, [voucherTypesData]);

  const fetchReport = async () => {
    const params = new URLSearchParams();
    params.append("from_date", toDdMmYyyy(fromDate));
    params.append("to_date", toDdMmYyyy(toDate));
    brandTransferVoucherTypeIds.forEach((id) => params.append("voucher_type_id", id));

    const response = await apiRequest("GET", `${API_BASE_URL}/api/process/stock-journal-voucher-report/?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to fetch brand transfer report");
    }
    return data;
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["brand-transfer-report", fromDate, toDate, brandTransferVoucherTypeIds.join(",")],
    queryFn: fetchReport,
    enabled: !!AuthService.getAccessToken() && canRead && !permissionsLoading && brandTransferVoucherTypeIds.length > 0,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map((row, idx) => ({
      key: `${row.transaction_id ?? ""}-${row.voucher_no ?? ""}-${idx}`,
      date: row.date || "—",
      voucherNo: (row.voucher_no || "").trim() || "—",
      sourceItemName: (row.source_item || "").trim() || "—",
      sourceQty: row.consumption_qty ?? "—",
      location: (row.source_godown || row.branch_name || row.branch || "").trim() || "—",
      finishedItemName: (row.destination_item || "").trim() || "—",
      finishedQty: row.production_qty ?? "—",
      enteredBy: (row.entered_by || row.created_by || "").trim() || "—",
    }));
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      [r.date, r.voucherNo, r.sourceItemName, r.sourceQty, r.location, r.finishedItemName, r.finishedQty, r.enteredBy]
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const reportRows = filteredRows;

  const getSelectedColumnDefs = () => {
    const allDefs = [
      { key: "date", header: "Date", value: (row) => row.date || "-" },
      { key: "voucherNo", header: "Voucher No", value: (row) => row.voucherNo || "-" },
      { key: "sourceItemName", header: "Source Items", value: (row) => row.sourceItemName || "-" },
      { key: "sourceQty", header: "Qty", value: (row) => row.sourceQty ?? "-" },
      { key: "location", header: "Godown", value: (row) => row.location || "-" },
      { key: "finishedItemName", header: "Destination Item", value: (row) => row.finishedItemName || "-" },
      { key: "finishedQty", header: "Qty", value: (row) => row.finishedQty ?? "-" },
      { key: "enteredBy", header: "Entered By", value: (row) => row.enteredBy || "-" },
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
        // ignore
      }

      const currentDate = format(new Date(), "d MMMM yyyy");
      const colCount = selectedDefs.length;
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Brand Transfer Report");

      ws.addRow([orgName]);
      ws.addRow([`Branch Name: ${branchName}`]);
      ws.addRow([`Date: ${currentDate}`]);
      ws.addRow(["Brand Transfer Report"]);
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
          cell.border = r <= 5 ? undefined : lightBorder;
          cell.alignment = {
            vertical: "middle",
            horizontal: r <= 6 ? "center" : "left",
            wrapText: true,
          };
        }
      }
      for (let r = 1; r <= 6; r += 1) ws.getCell(r, 1).font = { bold: true };
      for (let c = 1; c <= colCount; c += 1) ws.getCell(6, c).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brand_transfer_report_${format(new Date(), "yyyyMMdd")}.xlsx`;
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
        // ignore
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
      doc.text("BRAND TRANSFER REPORT", pageWidth / 2, headerY + 6.7, { align: "center" });

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
          doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - 8, pageHeight - 5.3, {
            align: "right",
          });
        },
        margin: { left: 8, right: 8 },
      });

      doc.save(`brand_transfer_report_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err?.message || "Could not generate PDF file.",
        variant: "destructive",
      });
    }
  };

  const sortedReportRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction || !columnLayout[sortConfig.key]) {
      return reportRows;
    }

    const parseSortable = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "number") return value;
      const raw = String(value).trim();
      if (!raw) return "";
      const numeric = Number.parseFloat(raw);
      if (!Number.isNaN(numeric) && raw !== "") return numeric;
      if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
        const [dd, mm, yyyy] = raw.split("-").map(Number);
        return new Date(yyyy, (mm || 1) - 1, dd || 1).getTime();
      }
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

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load brand transfer report",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const clearAllFilters = () => {
    setDateRangePreset("monthly");
    setFromDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setToDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setSearch("");
  };

  if (permissionsLoading) return <Loader />;

  if (!canRead) {
    return (
      <div className="app-layout bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-gray-600 dark:text-gray-400">You do not have permission to view this report.</p>
        </div>
      </div>
    );
  }

  const showLoader = voucherTypesLoading || (brandTransferVoucherTypeIds.length > 0 && isLoading);

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="app-main-content">
        {isMobile && (
          <div className="bg-white shadow-sm border-b p-4 flex items-center justify-between">
            <button type="button" onClick={() => setIsMobileSidebarOpen(true)} className="p-2 rounded-md hover:bg-gray-100">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold">Brand Transfer Report</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="h-7 w-7 text-gray-700 dark:text-gray-200" />
                Brand Transfer Report
              </h1>
            </div>          
            <div className="flex items-center gap-2 md:mt-1 flex-wrap">
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
                  <Button variant="outline" type="button">
                    <Settings className="h-8 w-8" />
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
                            className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
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
                  </div>
                </PopoverContent>
              </Popover>
              
            </div>
          </div>

          {brandTransferVoucherTypeIds.length === 0 && !voucherTypesLoading && (
            <Card className="mb-4 border-amber-200 bg-amber-50/80 dark:bg-amber-950/20">
              <CardContent className="py-4 text-sm text-amber-900 dark:text-amber-100">
                No active voucher type named <strong>Sj Brand Transfer</strong> was found.
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
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
                        <span className="truncate">{fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "Start date"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={fromDate ? new Date(fromDate) : undefined}
                        onSelect={(date) => {
                          const dateStr = date ? format(date, "yyyy-MM-dd") : "";
                          setFromDate(dateStr);
                          if (dateStr && toDate && dateStr > toDate) setToDate(dateStr);
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
                        <span className="truncate">{toDate ? format(new Date(toDate), "dd-MM-yyyy") : "End date"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
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
                <div className="md:col-span-4">
                  <Label className="text-xs text-gray-500 mb-1 block">Search</Label>
                  <div className="relative">
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in table..." className="pl-9" />
                  </div>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button type="button" variant="outline" className="w-full" onClick={clearAllFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {showLoader ? (
            <Loader />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Brand transfer listing ({sortedReportRows.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                  <table className="min-w-[1100px] w-full text-xs table-fixed">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        {orderedVisibleColumns.map((key) => (
                          <th key={key} className={columnLayout[key].headerClass}>
                            <div className="flex items-center gap-1">
                              <span>{columnLayout[key].header}</span>
                              <div className="flex items-center gap-1 leading-none">
                                <button
                                  type="button"
                                  onClick={() => setSortConfig({ key, direction: "desc" })}
                                  className={`h-3 w-3 inline-flex items-center justify-center ${
                                    sortConfig.key === key && sortConfig.direction === "desc"
                                      ? "text-black dark:text-white"
                                      : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
                                      ? "text-black dark:text-white"
                                      : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
                      {sortedReportRows.length === 0 ? (
                        <tr>
                          <td colSpan={Math.max(orderedVisibleColumns.length, 1)} className="text-center text-muted-foreground py-10">
                            {brandTransferVoucherTypeIds.length === 0
                              ? "Cannot load data without Sj Brand Transfer voucher type."
                              : "No records in this period."}
                          </td>
                        </tr>
                      ) : (
                        sortedReportRows.map((row) => (
                          <tr key={row.key} className="border-b border-gray-200 dark:border-gray-700 align-top">
                            {orderedVisibleColumns.map((key) => (
                              <td key={key} className={columnLayout[key].cellClass}>
                                {columnLayout[key].cell(row)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
