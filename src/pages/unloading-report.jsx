import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Menu, Search, RefreshCw, CalendarDays, CheckCircle, Clock, Users, Download, Settings, GripVertical, ArrowUp, ArrowDown, CalendarIcon } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
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

const getStatusBadgeClasses = (status) => {
  const normalized = String(status || "").toLowerCase().trim();
  if (normalized === "completed" || normalized === "approved") return "bg-green-100 text-green-800 border-green-300";
  if (normalized.includes("pending") || normalized.includes("not_unloaded")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (normalized.includes("reject")) return "bg-red-100 text-red-800 border-red-300";
  return "bg-gray-100 text-gray-700 border-gray-300";
};

export default function UnloadingReport() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("monthly");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [search, setSearch] = useState("");
  const [poVoucher, setPoVoucher] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [assignedByFilter, setAssignedByFilter] = useState("all");
  const [unloadedByFilter, setUnloadedByFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [visibleColumns, setVisibleColumns] = useState({
    unloadingDate: true,
    purchaseOrder: true,
    poDate: true,
    vehicle: true,
    unloadingTime: true,
    partyName: true,
    itemName: true,
    poQty: true,
    receivedQty: true,
    assignedBy: true,
    unloadedBy: true,
    status: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    "status",
    "unloadingDate",
    "purchaseOrder",
    "poDate",
    "vehicle",
    "unloadingTime",
    "partyName",
    "itemName",
    "poQty",
    "receivedQty",
    "assignedBy",
    "unloadedBy",
  ]);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);

  const columnOptions = [
    { key: "status", label: "Status" },
    { key: "unloadingDate", label: "Unloading Date" },
    { key: "purchaseOrder", label: "Purchase Order" },
    { key: "poDate", label: "PO Date" },
    { key: "vehicle", label: "Vehicle" },
    { key: "unloadingTime", label: "Unloading Time" },
    { key: "partyName", label: "Party Name" },
    { key: "itemName", label: "Item Name" },
    { key: "poQty", label: "PO Qty" },
    { key: "receivedQty", label: "Received Qty" },
    { key: "assignedBy", label: "Assigned By" },
    { key: "unloadedBy", label: "Unloaded By" },
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

  const getSelectedColumnDefs = () => {
    const allDefs = [
      { key: "unloadingDate", header: "Unloading Date", value: (row) => row.unloading_date || "-" },
      { key: "purchaseOrder", header: "Purchase Order", value: (row) => row.po_number || "-" },
      { key: "poDate", header: "PO Date", value: (row) => row.po_date || "-" },
      { key: "vehicle", header: "Vehicle", value: (row) => row.vehicle || "-" },
      { key: "unloadingTime", header: "Unloading Time", value: (row) => row.unloading_time || "-" },
      { key: "partyName", header: "Party Name", value: (row) => row.party_name || "-" },
      { key: "itemName", header: "Item Name", value: (row) => row.item_name || "-" },
      { key: "poQty", header: "Po Qty", value: (row) => `${row.po_qty ?? "-"}` },
      { key: "receivedQty", header: "Received Qty", value: (row) => `${row.received_qty ?? "-"}` },
      { key: "assignedBy", header: "Assigned By", value: (row) => row.assigned_by || "-" },
      { key: "unloadedBy", header: "Unloaded By", value: (row) => row.unloaded_by || "-" },
      { key: "status", header: "Status", value: (row) => row.status || "-" },
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
      const ws = workbook.addWorksheet("Unloading Report");

      ws.addRow([orgName]);
      ws.addRow([`Branch Name: ${branchName}`]);
      ws.addRow([`Date: ${currentDate}`]);
      ws.addRow(["Unloading Report"]);
      ws.addRow([]);
      ws.addRow(selectedDefs.map((d) => d.header));
      rows.forEach((row) => ws.addRow(selectedDefs.map((d) => d.value(row))));

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
          // Keep report header area clean without border lines.
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
      a.download = `unloading_report_${format(new Date(), "yyyyMMdd")}.xlsx`;
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
      doc.text("UNLOADING REPORT", pageWidth / 2, headerY + 6.7, { align: "center" });

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

      doc.save(`unloading_report_${format(new Date(), "yyyyMMdd")}.pdf`);
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
    if (poVoucher.trim()) params.append("po_voucher", poVoucher.trim());
    if (branchFilter !== "all") params.append("branch_name", branchFilter);
    if (statusFilter !== "all") params.append("status", statusFilter);

    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/report/unloading-report/?${params.toString()}`
    );
    const data = await response.json();
    if (!response.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to fetch unloading report");
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
    queryKey: ["unloading-report", fromDate, toDate, poVoucher, branchFilter, statusFilter],
    queryFn: fetchReport,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const { data: branchesData = [] } = useQuery({
    queryKey: ["unloading-report-branches"],
    queryFn: fetchBranches,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    retry: 1,
  });

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
    setPoVoucher("");
    setBranchFilter("all");
    setAssignedByFilter("all");
    setUnloadedByFilter("all");
    setStatusFilter("all");
  };

  const filterOptions = useMemo(() => {
    const list = data?.data || [];
    const uniq = (arr) => [...new Set(arr.map((v) => String(v || "").trim()).filter(Boolean))].sort();
    return {
      branch: uniq(list.map((r) => r.branch_name || r.branch || r.inward_branch_name || "")),
      assignedBy: uniq(list.map((r) => r.assigned_by)),
      unloadedBy: uniq(list.map((r) => r.unloaded_by)),
      status: uniq(list.map((r) => r.status)),
    };
  }, [data]);

  const branchOptions = useMemo(() => {
    const branchNamesFromApi = Array.isArray(branchesData)
      ? branchesData.map((b) => b?.name).filter(Boolean)
      : [];
    const merged = [...new Set([...branchNamesFromApi, ...filterOptions.branch])];
    return ["all", ...merged];
  }, [branchesData, filterOptions.branch]);

  const rows = useMemo(() => {
    let list = [...(data?.data || [])];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((row) =>
        String(row.po_number || "").toLowerCase().includes(term) ||
        String(row.party_name || "").toLowerCase().includes(term) ||
        String(row.item_name || "").toLowerCase().includes(term) ||
        String(row.vehicle || "").toLowerCase().includes(term) ||
        String(row.unloading_time || "").toLowerCase().includes(term)
      );
    }

    if (branchFilter !== "all") {
      list = list.filter(
        (row) =>
          String(row.branch_name || row.branch || row.inward_branch_name || "") === branchFilter
      );
    }

    if (assignedByFilter !== "all") {
      list = list.filter((row) => String(row.assigned_by || "") === assignedByFilter);
    }

    if (unloadedByFilter !== "all") {
      list = list.filter((row) => String(row.unloaded_by || "") === unloadedByFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((row) => String(row.status || "") === statusFilter);
    }

    return list;
  }, [data, search, branchFilter, assignedByFilter, unloadedByFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalCount = rows.length;
    const completedCount = rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return s === "completed" || s === "approved";
    }).length;
    const pendingCount = rows.filter((r) => String(r.status || "").toLowerCase().includes("pending")).length;
    const uniquePartyCount = new Set(rows.map((r) => (r.party_name || "").trim()).filter(Boolean)).size;
    return { totalCount, completedCount, pendingCount, uniquePartyCount };
  }, [rows]);

  const columnLayout = useMemo(
    () => ({
      unloadingDate: {
        header: "Unloading Date",
        headerClass: "px-2 py-2 text-left font-semibold w-[10%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.unloading_date || "-",
      },
      purchaseOrder: {
        header: "Purchase Order",
        headerClass: "px-2 py-2 text-left font-semibold w-[12%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.po_number || "-",
      },
      poDate: {
        header: "PO Date",
        headerClass: "px-2 py-2 text-left font-semibold w-[9%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.po_date || "-",
      },
      vehicle: {
        header: "Vehicle",
        headerClass: "px-2 py-2 text-left font-semibold w-[9%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.vehicle || "-",
      },
      unloadingTime: {
        header: "Unloading Time",
        headerClass: "px-2 py-2 text-left font-semibold w-[10%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => {
          const v = row.unloading_time;
          if (!v) return "-";
          const low = String(v).toLowerCase();
          if (low === "in progress") {
            return <span className="text-amber-700 font-medium">{v}</span>;
          }
          return v;
        },
      },
      partyName: {
        header: "Party Name",
        headerClass: "px-2 py-2 text-left font-semibold w-[16%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words leading-4 border-r border-gray-200",
        cell: (row) => row.party_name || "-",
      },
      itemName: {
        header: "Item Name",
        headerClass: "px-2 py-2 text-left font-semibold w-[14%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.item_name || "-",
      },
      poQty: {
        header: "PO Qty",
        headerClass: "px-2 py-2 text-left font-semibold w-[10%] border-r border-gray-300",
        cellClass: "px-2 py-2 border-r border-gray-200",
        cell: (row) => row.po_qty ?? "-",
      },
      receivedQty: {
        header: "Received Qty",
        headerClass: "px-2 py-2 text-left font-semibold w-[10%] border-r border-gray-300",
        cellClass: "px-2 py-2 border-r border-gray-200",
        cell: (row) =>
          row.received_qty != null
            ? `${row.received_qty} ${row.base_unit ?? ""}`.trim()
            : "-",
      },
      assignedBy: {
        header: "Assigned By",
        headerClass: "px-2 py-2 text-left font-semibold w-[10%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.assigned_by || "-",
      },
      unloadedBy: {
        header: "Unloaded By",
        headerClass: "px-2 py-2 text-left font-semibold w-[10%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.unloaded_by || "-",
      },
      status: {
        header: "Status",
        headerClass: "px-2 py-2 text-left font-semibold w-[8%]",
        cellClass: "py-2",
        cell: (row) => (
          <Badge variant="outline" className={getStatusBadgeClasses(row.status)}>
            {row.status || "-"}
          </Badge>
        ),
      },
    }),
    []
  );

  const orderedVisibleColumns = useMemo(
    () => columnOrder.filter((key) => visibleColumns[key] && columnLayout[key]),
    [columnOrder, visibleColumns, columnLayout]
  );

  const getSortValueByColumn = (row, key) => {
    switch (key) {
      case "unloadingDate":
        return row.unloading_date || "";
      case "purchaseOrder":
        return row.po_number || "";
      case "poDate":
        return row.po_date || "";
      case "vehicle":
        return row.vehicle || "";
      case "unloadingTime":
        return row.unloading_time || "";
      case "partyName":
        return row.party_name || "";
      case "itemName":
        return row.item_name || "";
      case "poQty":
        return row.po_qty ?? "";
      case "receivedQty":
        return row.received_qty ?? "";
      case "assignedBy":
        return row.assigned_by || "";
      case "unloadedBy":
        return row.unloaded_by || "";
      case "status":
        return row.status || "";
      default:
        return "";
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return rows;

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
    return [...rows].sort((a, b) => {
      const aVal = parseSortable(getSortValueByColumn(a, sortConfig.key));
      const bVal = parseSortable(getSortValueByColumn(b, sortConfig.key));
      if (aVal === bVal) return 0;
      if (aVal === "") return 1;
      if (bVal === "") return -1;
      return aVal > bVal ? directionMultiplier : -directionMultiplier;
    });
  }, [rows, sortConfig]);

  React.useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load unloading report",
        variant: "destructive",
      });
    }
  }, [error, toast]);

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
            <h1 className="text-xl font-bold">Unloading Report</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-6">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Unloading Report</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Item-wise purchase order unloading report
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
                  <div className="space-y-2">
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
                      )
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
                  <Label className="text-xs text-gray-500 mb-1 block">Assigned By</Label>
                  <Select value={assignedByFilter} onValueChange={setAssignedByFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.assignedBy.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Unloaded By</Label>
                  <Select value={unloadedByFilter} onValueChange={setUnloadedByFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.unloadedBy.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.status.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4">
                  <Label className="text-xs text-gray-500 mb-1 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by PO number, party, item, vehicle..."
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
                  <div className="text-xs text-blue-700">Total Entries</div>
                  <div className="text-xl font-bold text-blue-900">{summary.totalCount}</div>
                </div>
                <CalendarDays className="h-6 w-6 text-blue-500" />
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-700">Pending</div>
                  <div className="text-xl font-bold text-amber-900">{summary.pendingCount}</div>
                </div>
                <Clock className="h-6 w-6 text-amber-500" />
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-100/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-green-700">Completed</div>
                  <div className="text-xl font-bold text-green-900">{summary.completedCount}</div>
                </div>
                <CheckCircle className="h-6 w-6 text-green-500" />
              </CardContent>
            </Card>
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-purple-100/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-violet-700">Total Parties</div>
                  <div className="text-xl font-bold text-violet-900">{summary.uniquePartyCount}</div>
                </div>
                <Users className="h-6 w-6 text-violet-500" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Unloading Listing</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full max-h-[min(72vh,calc(100vh-14rem))] overflow-auto relative isolate">
                <table className="min-w-[1420px] w-full text-xs table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-100">
                    <tr>
                      {orderedVisibleColumns.map((key) => (
                        <th
                          key={key}
                          className={`${columnLayout[key].headerClass} sticky top-0 z-30 bg-gray-100 shadow-[inset_0_-1px_0_0_rgb(229_231_235)]`}
                        >
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
                    {sortedRows.map((row) => (
                      <tr key={row.inward_item_id} className="border-b align-top">
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

