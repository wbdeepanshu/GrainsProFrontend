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
  if (normalized === "approved" || normalized === "completed") return "bg-green-100 text-green-800 border-green-300";
  if (normalized.includes("reject")) return "bg-red-100 text-red-800 border-red-300";
  if (normalized.includes("pending") || normalized.includes("not_unloaded")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-gray-100 text-gray-700 border-gray-300";
};

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

const getPhaseTestedBy = (row) => ({
  preTestedBy: row?.tested_by || null,
  postTestedBy: row?.re_tested_by || null,
  reTestedBy: row?.additional_tested_by || null,
});

const getTestedByDisplay = (row) => {
  const { preTestedBy, postTestedBy, reTestedBy } = getPhaseTestedBy(row);
  const lines = [];
  if (preTestedBy) lines.push(`Pre-Test: ${preTestedBy}`);
  if (postTestedBy) lines.push(`Post-Test: ${postTestedBy}`);
  if (reTestedBy) lines.push(`Re-Test: ${reTestedBy}`);
  return lines.length ? lines.join("\n") : "-";
};

export default function LabTestReport() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateRangePreset, setDateRangePreset] = useState("monthly"); // today | weekly | monthly | custom
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [search, setSearch] = useState("");
  const [poVoucher, setPoVoucher] = useState("");
  const [testedByFilter, setTestedByFilter] = useState("all");
  const [approvedByFilter, setApprovedByFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [visibleColumns, setVisibleColumns] = useState({
    inwardEntry: true,
    purchaseOrder: true,
    poDate: true,
    vehicle: true,
    partyName: true,
    itemName: true,
    qty: true,
    testingParameters: true,
    testedBy: true,
    approver: true,
    status: true,
  });
  const [columnOrder, setColumnOrder] = useState([
    "status",
    "inwardEntry",
    "purchaseOrder",
    "vehicle",
    "partyName",
    "itemName",
    "qty",
    "testingParameters",
    "testedBy",
    "approver",
  ]);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);


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
  const columnOptions = [
    { key: "status", label: "Status" },
    { key: "inwardEntry", label: "Inward Entry" },
    { key: "purchaseOrder", label: "Purchase Order" },
//     { key: "poDate", label: "PO Date" },
    { key: "vehicle", label: "Vehicle" },
    { key: "partyName", label: "Party Name" },
    { key: "itemName", label: "Item Name" },
    { key: "qty", label: "Qty" },
    { key: "testingParameters", label: "Testing Parameters" },
    { key: "testedBy", label: "Tested By" },
    { key: "approver", label: "Approver" },
  ];

  const shownColumnCount = Object.values(visibleColumns).filter(Boolean).length;
  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      if (prev[key] && shownColumnCount === 1) return prev; // keep at least one column visible
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

  const formatStatus = (s) => {
    if (!s) return "-";
  
    return s
      .toLowerCase()
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const resetAllFilters = () => {
    setDateRangePreset("monthly");
    setFromDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setToDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setSearch("");
    setPoVoucher("");
    setTestedByFilter("all");
    setApprovedByFilter("all");
    setStatusFilter("all");
    setBranchFilter("all");
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

  const getSelectedColumnDefs = () => {
    const allDefs = [
      { key: "inwardEntry", header: "Inward Entry", value: (row) => row.inward_created_at || "-" },
      { key: "purchaseOrder", header: "Purchase Order", value: (row) => row.po_voucher_number || "-" },
//       { key: "poDate", header: "PO Date", value: (row) => row.po_created_at || "-" },
      { key: "vehicle", header: "Vehicle", value: (row) => row.vehicle_no || "-" },
      { key: "partyName", header: "Party Name", value: (row) => row.party_name || "-" },
      { key: "itemName", header: "Item Name", value: (row) => row.stock_item_name || "-" },
      { key: "qty", header: "Qty", value: (row) => row.quantity ?? "-" },
      {
        key: "testingParameters",
        header: "Testing Parameters",
        value: (row) => {
          const grouped = row.testing_params_grouped || {};
          const lines = [];

          const preTesting = grouped.pre_testing || [];
          const postTesting = grouped.post_testing || [];
          const reTesting = grouped.re_testing || [];

          if (preTesting.length > 0) {
            lines.push("Pre-Test");
            preTesting.forEach((tp) =>
              lines.push(
                `${tp.parameter_name || "Param"} ${tp.value ?? "-"}${tp.unit ? ` ${tp.unit}` : ""}`
              )
            );
          }

          if (preTesting.length > 0 && postTesting.length > 0) {
            lines.push("--------------------------------");
          }

          if (postTesting.length > 0) {
            lines.push("Post-Test");
            postTesting.forEach((tp) =>
              lines.push(
                `${tp.parameter_name || "Param"} ${tp.value ?? "-"}${tp.unit ? ` ${tp.unit}` : ""}`
              )
            );
          }

          if ((preTesting.length > 0 || postTesting.length > 0) && reTesting.length > 0) {
            lines.push("--------------------------------");
          }

          if (reTesting.length > 0) {
            lines.push("Re-Test");
            reTesting.forEach((tp) =>
              lines.push(
                `${tp.parameter_name || "Param"} ${tp.value ?? "-"}${tp.unit ? ` ${tp.unit}` : ""}`
              )
            );
          }

          return lines.length ? lines.join("\n") : "-";
        },
      },
      { key: "testedBy", header: "Tested By", value: (row) => getTestedByDisplay(row) },
      { key: "approver", header: "Approver", value: (row) => row.approved_by || "-" },
      { key: "status", header: "Status", value: (row) => row.inward_status || "-" },
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
      const ws = workbook.addWorksheet("Lab Testing Report");

      ws.addRow([orgName]); // 1
      ws.addRow([`Branch Name: ${branchName}`]); // 2
      ws.addRow([`Date: ${currentDate}`]); // 3
      ws.addRow(["Lab Testing Report"]); // 4
      ws.addRow([]); // 5 blank spacer
      ws.addRow(selectedDefs.map((d) => d.header)); // 6 table header
      rows.forEach((row) => ws.addRow(selectedDefs.map((d) => d.value(row)))); // data

      // Merge title/header rows across selected columns
      ws.mergeCells(1, 1, 1, colCount);
      ws.mergeCells(2, 1, 2, colCount);
      ws.mergeCells(3, 1, 3, colCount);
      ws.mergeCells(4, 1, 4, colCount);

      // Column widths
      ws.columns = selectedDefs.map((d) => ({
        width: d.key === "testingParameters" ? 40 : 20,
      }));

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
          // Keep top report header rows clean without grid lines.
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

      // Header rows + table header bold/center
      for (let r = 1; r <= 6; r += 1) {
        const cell = ws.getCell(r, 1);
        cell.font = { bold: true };
      }
      for (let c = 1; c <= colCount; c += 1) {
        ws.getCell(6, c).font = { bold: true };
      }

      const testingParamsColIndex = selectedDefs.findIndex((d) => d.key === "testingParameters");
      if (testingParamsColIndex !== -1) {
        rows.forEach((row, rowIndex) => {
          const cell = ws.getCell(7 + rowIndex, testingParamsColIndex + 1);
          const rawText = selectedDefs[testingParamsColIndex].value(row);
          if (!rawText || rawText === "-") return;

          const lines = String(rawText).split("\n");
          const richText = [];
          lines.forEach((line, index) => {
            const trimmed = line.trim();
            const isSectionLabel =
              trimmed === "Pre-Test" || trimmed === "Post-Test" || trimmed === "Re-Test";
            richText.push(isSectionLabel ? { text: line, font: { bold: true } } : { text: line });
            if (index < lines.length - 1) {
              richText.push({ text: "\n" });
            }
          });

          cell.value = { richText };
          cell.alignment = {
            ...cell.alignment,
            horizontal: "left",
            vertical: "top",
            wrapText: true,
          };
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lab_testing_report_${format(new Date(), "yyyyMMdd")}.xlsx`;
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

      // Professional header block
      const headerX = 8;
      const headerY = 8;
      const headerWidth = pageWidth - 16;
      const headerHeight = 34;
      const titleBandHeight = 10;
      const infoY = headerY + titleBandHeight + 2;
      const infoMidX = pageWidth / 2;

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
      doc.text("LAB TESTING REPORT", pageWidth / 2, headerY + 6.7, { align: "center" });

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
      const testingParametersPdfColIndex = selectedDefs.findIndex((d) => d.key === "testingParameters");

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
        didParseCell: (hookData) => {
          if (
            hookData.section === "body" &&
            testingParametersPdfColIndex !== -1 &&
            hookData.column.index === testingParametersPdfColIndex
          ) {
            const text = Array.isArray(hookData.cell.text)
              ? hookData.cell.text.join("\n")
              : String(hookData.cell.text || "");
            if (
              text.includes("Pre-Test") ||
              text.includes("Post-Test") ||
              text.includes("Re-Test")
            ) {
              hookData.cell.styles.fontStyle = "bold";
            }
          }
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

      doc.save(`lab_testing_report_${format(new Date(), "yyyyMMdd")}.pdf`);
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
    if (branchFilter !== "all") {
      params.append("branch", branchFilter);
      params.append("branch_name", branchFilter);
    }

    const response = await apiRequest(
      "GET",
      `${API_BASE_URL}/api/report/purchase-order-lab-testing-report/?${params.toString()}`
    );
    const data = await response.json();
    if (!response.ok || data?.status !== 200) {
      throw new Error(data?.message || "Failed to fetch lab test report");
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
    queryKey: ["lab-test-report", fromDate, toDate, branchFilter],
    queryFn: fetchReport,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const { data: branchesData = [] } = useQuery({
    queryKey: ["lab-test-report-branches"],
    queryFn: fetchBranches,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const baseRows = useMemo(() => data?.data || [], [data]);

  const getBranchValue = (row) =>
    row.branch_name ||
    row.branch ||
    row.inward_branch_name ||
    row.po_branch_name ||
    "";

  const filterOptions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.map((v) => String(v || "").trim()).filter(Boolean))].sort();
    return {
      testedBy: uniq(
        baseRows.flatMap((r) => {
          const { preTestedBy, postTestedBy, reTestedBy } = getPhaseTestedBy(r);
          return [preTestedBy, postTestedBy, reTestedBy].filter(Boolean);
        })
      ),
      approvedBy: uniq(baseRows.map((r) => r.approved_by)),
      status: uniq(baseRows.map((r) => normalizeStatusValue(r.inward_status))),
      branch: uniq(baseRows.map((r) => getBranchValue(r))),
    };
  }, [baseRows]);
  const branchOptions = useMemo(() => {
    const branchNamesFromApi = Array.isArray(branchesData)
      ? branchesData.map((b) => b?.name).filter(Boolean)
      : [];
    const merged = [...new Set([...branchNamesFromApi, ...filterOptions.branch])];
    return ["all", ...merged];
  }, [branchesData, filterOptions.branch]);

  const rows = useMemo(() => {
    let list = [...baseRows];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((row) =>
        String(row.po_voucher_number || "").toLowerCase().includes(term) ||
        String(row.party_name || "").toLowerCase().includes(term) ||
        String(row.stock_item_name || "").toLowerCase().includes(term) ||
        String(row.vehicle_no || "").toLowerCase().includes(term)
      );
    }

    if (poVoucher.trim()) {
      const poTerm = poVoucher.trim().toLowerCase();
      list = list.filter((row) =>
        String(row.po_voucher_number || "").toLowerCase().includes(poTerm)
      );
    }

    if (testedByFilter !== "all") {
      list = list.filter((row) => {
        const { preTestedBy, postTestedBy, reTestedBy } = getPhaseTestedBy(row);
        return [preTestedBy, postTestedBy, reTestedBy].some((name) => String(name || "") === testedByFilter);
      });
    }
    if (approvedByFilter !== "all") {
      list = list.filter((row) => String(row.approved_by || "") === approvedByFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((row) => normalizeStatusValue(row.inward_status) === statusFilter);
    }
    const hasBranchInRows = list.some((row) => String(getBranchValue(row) || "").trim() !== "");
    if (branchFilter !== "all" && hasBranchInRows) {
      list = list.filter((row) => String(getBranchValue(row) || "") === branchFilter);
    }

    return list;
  }, [baseRows, search, poVoucher, testedByFilter, approvedByFilter, statusFilter, branchFilter]);

  const summary = useMemo(() => {
    const totalCount = rows.length;
    const completedCount = rows.filter((r) =>
      ["completed", "approved", "invoice_created"].includes(String(r.inward_status || "").toLowerCase())
    ).length;
    const pendingCount = rows.filter((r) =>
      String(r.inward_status || "").toLowerCase().includes("pending") ||
      String(r.inward_status || "").toLowerCase().includes("not_unloaded")
    ).length;
    const uniquePartyCount = new Set(rows.map((r) => (r.party_name || "").trim()).filter(Boolean)).size;
    return { totalCount, completedCount, pendingCount, uniquePartyCount };
  }, [rows]);

  const columnLayout = useMemo(
    () => ({
      inwardEntry: {
        header: "Inward Entry",
        headerClass: "px-2 py-2 text-left font-semibold w-[7%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => (
          <>
            <div className="font-medium">{row.inward_created_at || "-"}</div>
            <div className="text-[11px] text-gray-600 mt-0.5">{row.inward_sl_no || "-"}</div>
          </>
        ),
      },
      purchaseOrder: {
        header: "Purchase Order",
        headerClass: "px-2 py-2 text-left font-semibold w-[7%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => (
          <>
            <div className="font-medium">{row.po_voucher_number || "-"}</div>
            <div className="text-[11px] text-gray-600 mt-0.5">{row.po_created_at || "-"}</div>
          </>
        ),
      },
      vehicle: {
        header: "Vehicle",
        headerClass: "px-2 py-2 text-left font-semibold w-[5%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.vehicle_no || "-",
      },
      partyName: {
        header: "Party Name",
        headerClass: "px-2 py-2 text-left font-semibold w-[6%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words leading-4 border-r border-gray-200",
        cell: (row) => <div className="line-clamp-3">{row.party_name || "-"}</div>,
      },
      itemName: {
        header: "Item Name",
        headerClass: "px-2 py-2 text-left font-semibold w-[6%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.stock_item_name || "-",
      },
      qty: {
        header: "Qty",
        headerClass: "px-2 py-2 text-left font-semibold w-[3%] border-r border-gray-300",
        cellClass: "px-2 py-2 border-r border-gray-200",
        cell: (row) => row.quantity ?? "-",
      },
      testingParameters: {
        header: "Testing Parameters",
        headerClass: "px-2 py-2 text-left font-semibold w-[10%] border-r border-gray-300",
        cellClass: "px-2 py-2 min-w-[220px] border-r border-gray-200",
        cell: (row) =>
          !row.testing_params_grouped ||
          (
            (row.testing_params_grouped.pre_testing || []).length === 0 &&
            (row.testing_params_grouped.post_testing || []).length === 0 &&
            (row.testing_params_grouped.re_testing || []).length === 0
          ) ? (
            <span className="text-gray-500">-</span>
          ) : (
            <div className="space-y-1 break-words leading-4">
              {(row.testing_params_grouped.pre_testing || []).length > 0 && (
                <div>
                  <div className="font-bold text-[11px] text-blue-700">Pre-Test</div>
                  {(row.testing_params_grouped.pre_testing || []).map((tp) => (
                    <div key={`pre-${tp.test_id}`}>
                      {tp.parameter_name || "Param"}: {tp.value ?? "-"}{tp.unit ? ` ${tp.unit}` : ""}
                    </div>
                  ))}
                </div>
              )}
              {(row.testing_params_grouped.post_testing || []).length > 0 && (
                <div className="border-t border-gray-300 pt-1 mt-1">
                  <div className="font-bold text-[11px] text-emerald-700">Post-Test</div>
                  {(row.testing_params_grouped.post_testing || []).map((tp) => (
                    <div key={`post-${tp.test_id}`}>
                      {tp.parameter_name || "Param"}: {tp.value ?? "-"}{tp.unit ? ` ${tp.unit}` : ""}
                    </div>
                  ))}
                </div>
              )}
              {(row.testing_params_grouped.re_testing || []).length > 0 && (
                <div className="border-t border-gray-300 pt-1 mt-1">
                  <div className="font-bold text-[11px] text-purple-700">Re-Test</div>
                  {(row.testing_params_grouped.re_testing || []).map((tp) => (
                    <div key={`re-${tp.test_id}`}>
                      {tp.parameter_name || "Param"}: {tp.value ?? "-"}{tp.unit ? ` ${tp.unit}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
      },
      testedBy: {
        header: "Tested By",
        headerClass: "px-2 py-2 text-left font-semibold w-[6%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => {
          const { preTestedBy, postTestedBy, reTestedBy } = getPhaseTestedBy(row);
          if (!preTestedBy && !postTestedBy && !reTestedBy) return "-";
          return (
            <div className="space-y-1 break-words leading-4">
              {preTestedBy && <div><span className="font-bold text-[11px] text-blue-700">Pre-Test:</span> {preTestedBy}</div>}
              {postTestedBy && <div><span className="font-bold text-[11px] text-emerald-700">Post-Test:</span> {postTestedBy}</div>}
              {reTestedBy && <div><span className="font-bold text-[11px] text-purple-700">Re-Test:</span> {reTestedBy}</div>}
            </div>
          );
        },
      },
      approver: {
        header: "Approver",
        headerClass: "px-2 py-2 text-left font-semibold w-[6%] border-r border-gray-300",
        cellClass: "px-2 py-2 break-words border-r border-gray-200",
        cell: (row) => row.approved_by || "-",
      },
      status: {
        header: "Status",
        headerClass: "px-2 py-2 text-left font-semibold w-[8%]",
        cellClass: "px-2 py-4",
        cell: (row) => (
          <Badge variant="outline" className={getStatusBadgeClasses(row.inward_status)}>
          {formatStatus(row.inward_status)}
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
      case "inwardEntry":
        return row.inward_created_at || "";
      case "purchaseOrder":
        return row.po_voucher_number || "";
      case "vehicle":
        return row.vehicle_no || "";
      case "partyName":
        return row.party_name || "";
      case "itemName":
        return row.stock_item_name || "";
      case "qty":
        return row.quantity ?? "";
      case "testingParameters":
        return JSON.stringify(row.testing_params_grouped || {});
      case "testedBy":
        return getTestedByDisplay(row);
      case "approver":
        return row.approved_by || "";
      case "status":
        return row.inward_status || "";
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
        description: error.message || "Failed to load lab test report",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (isLoading) return <Loader text="Loading lab test report" />;

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
            <h1 className="text-xl font-bold">Lab Test Report</h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-6">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Test Report</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Purchase order and inward item-wise testing report
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
                    )})}
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
                  <Label className="text-xs text-gray-500 mb-1 block">Tested By</Label>
                  <Select value={testedByFilter} onValueChange={setTestedByFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.testedBy.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Approved By</Label>
                  <Select value={approvedByFilter} onValueChange={setApprovedByFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.approvedBy.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Inward Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.status.map((status) => (
                        <SelectItem key={status} value={status}>{formatStatusLabel(status)}</SelectItem>
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
              <CardTitle className="text-base">Lab Testing Listing</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Single overflow-auto scrollport so sticky <th> works (overflow-x-only ancestors break vertical sticky) */}
              <div className="w-full max-h-[min(72vh,calc(100vh-14rem))] overflow-auto relative isolate">
                <table className="min-w-[1300px] w-full text-xs table-fixed border-separate border-spacing-0">
                  {sortedRows.length > 0 && (
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
                  )}
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
                        <td className="px-2 py-8 text-center text-gray-500" colSpan={Math.max(shownColumnCount, 1)}>
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

