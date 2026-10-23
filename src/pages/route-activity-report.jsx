import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import {
  Menu,
  Download,
  Filter,
  Eye,
  ArrowLeft,
  MapPin,
  Route,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  Activity,
  Loader2,
  CalendarIcon,
  ChevronsUpDown,
  Check,
  Search,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import CommonLoader from "@/components/common/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { getOrgInfoSync } from "@/lib/orgInfo";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const formatCurrency = (amount) => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatCustomerNameWithContact = (row) => {
  const name = row?.customer_name || row?.party_name || "—";
  const contact = String(row?.contact_number || "").trim();
  return contact ? `${name} (${contact})` : name;
};

/** PDF-safe currency (Helvetica cannot render ₹ reliably). */
const formatCurrencyPdf = (amount) => {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  return `Rs. ${safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDisplayDate = (isoOrYmd) => {
  if (!isoOrYmd) return "—";
  try {
    const d = new Date(isoOrYmd);
    if (Number.isNaN(d.getTime())) return String(isoOrYmd);
    return format(d, "dd-MM-yyyy");
  } catch {
    return String(isoOrYmd);
  }
};

/** Date column for PDF — prefer visit_date, else parse date from visit datetime/time. */
const extractVisitDateForPdf = (row) => {
  if (row?.visit_date) {
    const formatted = formatDisplayDate(row.visit_date);
    return formatted === "—" ? String(row.visit_date) : formatted;
  }
  const raw = String(row?.visit_datetime || row?.visit_time || "").trim();
  if (!raw) return "—";
  const dmy = raw.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return format(d, "dd-MM-yyyy");
  } catch {
    // ignore
  }
  return formatDisplayDate(raw);
};

/** Visit time column — extract time portion from visit_time / visit_datetime. */
const extractVisitTimeForPdf = (row) => {
  const raw = String(row?.visit_time || row?.visit_datetime || "").trim();
  if (!raw) return "—";
  if (/^\d{1,2}:\d{2}(?::\d{2})?(\s*[AaPp][Mm])?$/.test(raw)) return raw;
  const ampm = raw.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*[AaPp][Mm])/);
  if (ampm) return ampm[1].replace(/\s+/g, " ");
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return format(d, "hh:mm a");
  } catch {
    // ignore
  }
  const hms = raw.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
  if (hms) return hms[1];
  return raw;
};

const getPartyNameForPdf = (row) => row?.party_name || row?.customer_name || "—";

const formatRouteCountsForPdf = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .map((row) => `${row.route_name || "Unassigned Route"}: ${row.count ?? 0}`)
    .join(", ");
};

const formatVisitDisplayForPdf = (row) => {
  const datePart = extractVisitDateForPdf(row);
  const timePart = extractVisitTimeForPdf(row);
  if (datePart !== "—" && timePart !== "—") return `${datePart} ${timePart}`;
  if (datePart !== "—") return datePart;
  if (timePart !== "—") return timePart;
  return row?.visit_datetime || row?.visit_date || "—";
};

const StatCard = ({ label, value, tone = "blue", icon: Icon }) => {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
  };
  return (
    <Card className={`border shadow-sm h-full min-w-0 ${tones[tone] || tones.blue}`}>
      <CardContent className="p-3 h-full min-h-[84px] flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide opacity-80 leading-tight line-clamp-2">
            {label}
          </p>
          {Icon ? <Icon className="h-4 w-4 opacity-70 shrink-0" /> : null}
        </div>
        <p className="text-base sm:text-lg font-bold mt-2 tabular-nums truncate" title={String(value)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
};

const RouteCountBadges = ({ rows, tone = "green" }) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const tones = {
    green: "border-green-200 bg-green-50 text-green-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rows.map((row) => (
        <span
          key={`${row.route_id ?? "unassigned"}-${row.route_name}`}
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
            tones[tone] || tones.green
          }`}
        >
          {row.route_name || "Unassigned Route"}: {row.count ?? 0}
        </span>
      ))}
    </div>
  );
};

function getOrgHeaderInfo() {
  const org = getOrgInfoSync() || {};
  let organization = org.organization || "";
  let organizationAddress = org.organization_address || "";
  let branch = org.branch || "";
  let branchAddress = org.branch_address || "";

  if (!organization) {
    try {
      const raw = localStorage.getItem("cp_org_info");
      if (raw) {
        const parsed = JSON.parse(raw);
        organization =
          parsed?.organization ||
          parsed?.organization_name ||
          parsed?.org_name ||
          "";
        organizationAddress =
          parsed?.organization_address || parsed?.org_address || "";
        branch = parsed?.branch || parsed?.branch_name || branch;
        branchAddress = parsed?.branch_address || branchAddress;
      }
    } catch {
      // ignore
    }
  }

  return {
    organization: organization || "Organization",
    organizationAddress: organizationAddress || "",
    branch: branch || "",
    branchAddress: branchAddress || "",
  };
}

function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/\u20B9/g, "Rs.")
    .replace(/₹/g, "Rs.")
    .trim();
}

/**
 * Professional report header card:
 * dark title band + org block + meta row + optional stats strip
 * Optional `branch` / `branchAddress` override org defaults (e.g. salesman branch from API).
 */
function drawReportPdfHeader(
  doc,
  { title, meta = [], stats = [], branch, branchAddress, showOrganization = true } = {}
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
  const headerX = marginX;
  const headerWidth = pageWidth - marginX * 2;
  const orgDefaults = getOrgHeaderInfo();
  const org = {
    ...orgDefaults,
    branch:
      branch != null && String(branch).trim() !== ""
        ? String(branch).trim()
        : orgDefaults.branch,
    branchAddress:
      branchAddress != null && String(branchAddress).trim() !== ""
        ? String(branchAddress).trim()
        : orgDefaults.branchAddress,
  };

  const cleanMeta = (meta || [])
    .filter((item) => item && (item.label || item.value))
    .map((item) => ({
      label: sanitizePdfText(item.label),
      value: sanitizePdfText(item.value) || "—",
    }));

  const cleanStats = (stats || [])
    .filter((item) => item && item.label)
    .map((item) => ({
      label: sanitizePdfText(item.label),
      value: sanitizePdfText(item.value),
    }));

  // Measure dynamic height
  const titleBandH = 11;
  let orgBlockH = showOrganization ? 10 : 0;
  if (showOrganization && org.organizationAddress) {
    const addrLines = doc.splitTextToSize(
      sanitizePdfText(org.organizationAddress),
      headerWidth - 16
    );
    orgBlockH += addrLines.length * 3.4;
  }
  if (showOrganization && org.branch) orgBlockH += 4;
  if (showOrganization && org.branchAddress) {
    const branchLines = doc.splitTextToSize(
      sanitizePdfText(org.branchAddress),
      headerWidth - 16
    );
    orgBlockH += branchLines.length * 3.2;
  }

  const metaRows = Math.ceil(Math.max(cleanMeta.length, 1) / 3);
  const metaH = cleanMeta.length ? metaRows * 5.2 + 3 : 2;
  const statsH = cleanStats.length ? 12 : 0;
  const headerHeight = titleBandH + orgBlockH + metaH + statsH + 4;

  const headerY = 8;
  let y = headerY;

  // Outer card
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(headerX, headerY, headerWidth, headerHeight, 2, 2, "F");

  // Title band
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(
    sanitizePdfText(title || "ROUTE ACTIVITY REPORT"),
    pageWidth / 2,
    headerY + 7.2,
    { align: "center" }
  );

  // Light content panel
  const panelY = headerY + titleBandH;
  const panelH = headerHeight - titleBandH - 0.6;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(headerX + 0.6, panelY, headerWidth - 1.2, panelH, 1.2, 1.2, "F");

  y = panelY + 5;

  if (showOrganization) {
    // Organization (centered)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(org.organization), pageWidth / 2, y, { align: "center" });
    y += 4.5;

    if (org.organizationAddress) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const addrLines = doc.splitTextToSize(
        sanitizePdfText(org.organizationAddress),
        headerWidth - 20
      );
      doc.text(addrLines, pageWidth / 2, y, { align: "center" });
      y += addrLines.length * 3.4;
    }

    if (org.branch) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Branch: ${sanitizePdfText(org.branch)}`, pageWidth / 2, y, {
        align: "center",
      });
      y += 3.8;
    }

    if (org.branchAddress) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const branchLines = doc.splitTextToSize(
        sanitizePdfText(org.branchAddress),
        headerWidth - 20
      );
      doc.text(branchLines, pageWidth / 2, y, { align: "center" });
      y += branchLines.length * 3.2;
    }

    // Divider
    y += 1.5;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(headerX + 6, y, headerX + headerWidth - 6, y);
    y += 5;
  }

  // Meta in 3 columns
  if (cleanMeta.length) {
    const cols = 3;
    const colW = (headerWidth - 16) / cols;
    const labelGap = 18;

    cleanMeta.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = headerX + 8 + col * colW;
      const rowY = y + row * 5.2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${item.label}:`, x, rowY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const valueLines = doc.splitTextToSize(item.value, colW - labelGap - 2);
      doc.text(valueLines[0] || "—", x + labelGap, rowY);
    });

    y += metaRows * 5.2 + 2.5;
  }

  // Stats strip inside card
  if (cleanStats.length) {
    const stripH = 10;
    const stripX = headerX + 5;
    const stripW = headerWidth - 10;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(stripX, y, stripW, stripH, 1, 1, "FD");

    const cellW = stripW / cleanStats.length;
    cleanStats.forEach((stat, idx) => {
      const cx = stripX + cellW * idx + cellW / 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text(stat.label.toUpperCase(), cx, y + 3.4, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(stat.value, cx, y + 7.6, { align: "center" });

      if (idx < cleanStats.length - 1) {
        doc.setDrawColor(226, 232, 240);
        const vx = stripX + cellW * (idx + 1);
        doc.line(vx, y + 1.4, vx, y + stripH - 1.4);
      }
    });

    y += stripH + 3;
  }

  return headerY + headerHeight + 5;
}

function addPdfFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  const generatedAt = format(new Date(), "dd-MMM-yyyy hh:mm a");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated at: ${generatedAt}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });
    doc.text(
      "Powered by GrainsPro, Developed by MWB Technologies.",
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, {
      align: "right",
    });
  }
}

function drawPdfSectionHeading(doc, title, requestedY, fillColor = [51, 65, 85]) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(sanitizePdfText(title), pageWidth - 32);
  const headingHeight = Math.max(8, 4 + lines.length * 4);
  let y = requestedY;

  // Keep the heading with at least the beginning of its table.
  if (y > pageHeight - headingHeight - 20) {
    doc.addPage();
    y = 14;
  }

  doc.setFillColor(...fillColor);
  doc.roundedRect(12, y, pageWidth - 24, headingHeight, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(lines, 16, y + 5.3);

  return y + headingHeight + 2;
}

function drawRouteWiseSummaryTable(doc, autoTable, rows, startY) {
  autoTable(doc, {
    startY,
    head: [[
      "Sl.No",
      "Route Name",
      "Route Count",
      "Customers",
      "Visited",
      "Not Visited",
      "Pending",
      "Activities",
      "SO Qty",
      "SO Amount",
      "Receipt",
    ]],
    body:
      rows.length > 0
        ? rows.map((row, idx) => [
            String(idx + 1),
            row.route_name || "Unassigned Route",
            String(row.route_count ?? 1),
            String(row.total_customers ?? 0),
            String(row.visited_customers ?? 0),
            String(row.not_visited_customers ?? 0),
            String(row.pending_customers ?? 0),
            String(row.total_activity ?? 0),
            Number(row.so_quantity || 0).toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            }),
            formatCurrencyPdf(row.so_amount),
            formatCurrencyPdf(row.receipt_amount ?? row.amount_collected),
          ])
        : [["No route-wise data", "", "", "", "", "", "", "", "", "", ""]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.6,
      textColor: [17, 24, 39],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    margin: { left: 12, right: 12, bottom: 16 },
  });
  return doc.lastAutoTable?.finalY || startY;
}

export default function RouteActivityReport() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [dateRangePreset, setDateRangePreset] = useState("today");
  const [fromDate, setFromDate] = useState(format(startOfDay(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfDay(new Date()), "yyyy-MM-dd"));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [branchFilter, setBranchFilter] = useState("all");
  const [salesmanFilter, setSalesmanFilter] = useState("all");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [salesmanDropdownOpen, setSalesmanDropdownOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [salesmanSearch, setSalesmanSearch] = useState("");   
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSalesmanId, setSelectedSalesmanId] = useState(null);
  const [selectedSalesmanMeta, setSelectedSalesmanMeta] = useState(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const canRead = hasPermission("route_management", "read");

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
    if (!response.ok) throw new Error(data?.message || "Failed to fetch branches");
    if (data?.status === 200 && Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  };

  const { data: branchesData = [] } = useQuery({
    queryKey: ["route-activity-report-branches"],
    queryFn: fetchBranches,
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const summaryQueryKey = [
    "route-activity-user-summary",
    fromDate,
    toDate,
    branchFilter,
    salesmanFilter,
  ];

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = useQuery({
    queryKey: summaryQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (branchFilter !== "all") params.set("branch_id", branchFilter);
      if (salesmanFilter !== "all") params.set("user_id", salesmanFilter);
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/route-activity-user-summary/?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to fetch route activity summary");
      }
      return data;
    },
    enabled: !!AuthService.getAccessToken() && canRead && !selectedSalesmanId,
    refetchOnWindowFocus: false,
  });

  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
    isFetching: detailFetching,
  } = useQuery({
    queryKey: [
      "route-activity-user-details",
      selectedSalesmanId,
      fromDate,
      toDate,
      branchFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("user_id", selectedSalesmanId);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (branchFilter !== "all") params.set("branch_id", branchFilter);
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/route-activity-user-details/?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to fetch route activity details");
      }
      return data;
    },
    enabled: !!AuthService.getAccessToken() && canRead && !!selectedSalesmanId,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (summaryError) {
      toast({
        title: "Error",
        description: summaryError.message,
        variant: "destructive",
      });
    }
  }, [summaryError, toast]);

  useEffect(() => {
    if (detailError) {
      toast({
        title: "Error",
        description: detailError.message,
        variant: "destructive",
      });
    }
  }, [detailError, toast]);

  const salesmanOptions = useMemo(() => {
    const fromApi = summaryData?.salesman_users || [];
    if (fromApi.length) return fromApi;
    return (summaryData?.data || []).map((row) => ({
      user_id: row.user_id,
      user_name: row.user_name || row.salesman_name,
      branch_name: row.branch_name,
      role_name: row.role_name,
    }));
  }, [summaryData]);

  const filteredBranches = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    if (!q) return branchesData;
    return branchesData.filter((branch) =>
      String(branch.name || "").toLowerCase().includes(q)
    );
  }, [branchesData, branchSearch]);

  const filteredSalesmen = useMemo(() => {
    const q = salesmanSearch.trim().toLowerCase();
    if (!q) return salesmanOptions;
    return salesmanOptions.filter((user) => {
      const name = String(user.user_name || user.salesman_name || "").toLowerCase();
      const id = String(user.user_id || "").toLowerCase();
      const branch = String(user.branch_name || "").toLowerCase();
      const role = String(user.role_name || "").toLowerCase();
      return name.includes(q) || id.includes(q) || branch.includes(q) || role.includes(q);
    });
  }, [salesmanOptions, salesmanSearch]);

  const selectedBranchLabel =
    branchFilter === "all"
      ? "All branches"
      : branchesData.find((b) => String(b.id) === String(branchFilter))?.name || "Select branch";

  const selectedSalesmanLabel =
    salesmanFilter === "all"
      ? "All salesmen"
      : salesmanOptions.find((u) => String(u.user_id) === String(salesmanFilter))?.user_name ||
        salesmanOptions.find((u) => String(u.user_id) === String(salesmanFilter))?.salesman_name ||
        "Select salesman";

  const summaryRows = useMemo(() => {
    const rows = summaryData?.data || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.salesman_name,
        row.user_name,
        row.user_id,
        row.role_name,
        row.branch_name,
        row.route_count,
        row.total_routes,
        row.total_customers,
        row.visited_customers,
        row.not_visited_customers,
        row.pending_customers,
        row.so_amount,
        row.receipt_amount,
        row.amount_collected,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [summaryData, searchQuery]);

  const totals = summaryData?.totals || {};
  const reportMeta = selectedSalesmanId
    ? detailData?.report_meta
    : summaryData?.report_meta;

  const detailTotals = detailData?.data?.totals || {};
  const detailSummary = detailData?.data?.summary || {};
  const detailUser = detailData?.data?.user || selectedSalesmanMeta || {};
  const routeWiseSummary = detailData?.data?.route_wise_summary || {};
  const routeSummaryRows = routeWiseSummary?.routes || [];
  const visitedRouteCounts = routeWiseSummary?.visited || [];
  const notVisitedRouteCounts = routeWiseSummary?.not_visited || [];
  const pendingRouteCounts = routeWiseSummary?.pending || [];
  const soCategorySummary = detailData?.data?.so_category_summary || {};
  const soCategoryRows = soCategorySummary?.categories || [];
  const soCategoryItemRows = useMemo(() => {
    if (Array.isArray(soCategorySummary?.items) && soCategorySummary.items.length > 0) {
      return soCategorySummary.items;
    }
    // Fallback: flatten categories[].items when flat list is absent
    const flat = [];
    let sl = 1;
    (soCategoryRows || []).forEach((cat) => {
      (cat.items || []).forEach((item) => {
        flat.push({
          sl_no: sl++,
          category_id: cat.category_id,
          category_name: cat.category_name,
          stock_item_id: item.stock_item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          value: item.value,
        });
      });
    });
    return flat;
  }, [soCategorySummary, soCategoryRows]);

  const isNotVisitedActivity = (item) => {
    const name = String(item?.activity_name || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\s+/g, " ");
    return name === "not visited" || name === "not available" || name === "skipped";
  };

  const visitedList = useMemo(() => {
    const raw =
      detailData?.data?.visited_customers_list ||
      detailData?.data?.activities ||
      [];
    const list = raw.filter((item) => !isNotVisitedActivity(item));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      const haystack = [
        item.customer_name,
        item.party_name,
        item.route_name,
        item.activity_name,
        item.visit_date,
        item.visit_time,
        item.visit_datetime,
        item.activity_type,
        item.type,
        item.so_number,
        item.so_amount,
        item.receipt_amount,
        item.receipt_number,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [detailData, searchQuery]);

  const notVisitedList = useMemo(() => {
    const fromApi = detailData?.data?.not_visited_customers_list;
    const list = Array.isArray(fromApi)
      ? fromApi
      : (detailData?.data?.activities || []).filter((item) => isNotVisitedActivity(item));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      const haystack = [
        item.customer_name,
        item.party_name,
        item.contact_number,
        item.route_name,
        item.activity_name,
        item.visit_date,
        item.visit_time,
        item.visit_datetime,
        item.remarks,
        item.assignment_status,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [detailData, searchQuery]);

  const pendingList = useMemo(() => {
    const list = Array.isArray(detailData?.data?.pending_customers_list)
      ? detailData.data.pending_customers_list
      : [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      const haystack = [
        item.customer_name,
        item.party_name,
        item.contact_number,
        item.route_name,
        item.activity_name,
        item.visit_date,
        item.visit_time,
        item.visit_datetime,
        item.remarks,
        item.assignment_status,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [detailData, searchQuery]);

  const openSalesmanDetail = (row) => {
    setSelectedSalesmanId(row.user_id);
    setSelectedSalesmanMeta(row);
    setSearchQuery("");
  };

  const backToSummary = () => {
    setSelectedSalesmanId(null);
    setSelectedSalesmanMeta(null);
    setSearchQuery("");
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF("l", "mm", "a4");
      const dateLabel = `${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`;
      const branchLabel =
        branchFilter === "all"
          ? "All branches"
          : branchesData.find((b) => String(b.id) === String(branchFilter))?.name ||
            "Selected branch";

      if (selectedSalesmanId) {
        const name =
          detailUser.user_name ||
          detailSummary.salesman_name ||
          selectedSalesmanMeta?.salesman_name ||
          selectedSalesmanMeta?.user_name ||
          "Salesman";
        const responseBranch =
          detailUser.branch_name ||
          detailSummary.branch_name ||
          selectedSalesmanMeta?.branch_name ||
          "";
        const headerEndY = drawReportPdfHeader(doc, {
          title: "ROUTE ACTIVITY REPORT",
          branch: responseBranch,
          showOrganization: false,
          meta: [
            { label: "Salesman", value: name },
            { label: "Period", value: dateLabel },
            { label: "Branch", value: responseBranch || branchLabel },
          ],
          stats: [
            { label: "Routes", value: String(detailTotals.route_count ?? 0) },
            { label: "Customers", value: String(detailTotals.total_customers ?? 0) },
            { label: "Visited", value: String(detailTotals.visited_customers ?? 0) },
            { label: "Not Visited", value: String(detailTotals.not_visited_customers ?? 0) },
            { label: "Pending", value: String(detailTotals.pending_customers ?? 0) },
            { label: "SO Amount", value: formatCurrencyPdf(detailTotals.so_amount) },
            { label: "Receipt", value: formatCurrencyPdf(detailTotals.receipt_amount) },
          ],
        });
        const routeSummaryStartY = drawPdfSectionHeading(
          doc,
          "Route-wise Summary",
          headerEndY,
          [30, 64, 175]
        );
        const routeSummaryEndY = drawRouteWiseSummaryTable(
          doc,
          autoTable,
          routeSummaryRows,
          routeSummaryStartY
        );
        const startY = drawPdfSectionHeading(
          doc,
          `Visited Customers List${
            formatRouteCountsForPdf(visitedRouteCounts)
              ? ` — Route-wise: ${formatRouteCountsForPdf(visitedRouteCounts)}`
              : ""
          }`,
          routeSummaryEndY + 10,
          [22, 101, 52]
        );

        autoTable(doc, {
          startY,
          head: [[
            "Sl.No",
            "Date",
            "Route Name",
            "Party Name",
            "Visit Time",
            "Transaction Type",
            "SO Quantity",
            "Order Value",
            "Collection",
            "Remarks",
          ]],
          body:
            visitedList.length > 0
              ? visitedList.map((row, idx) => [
                  String(idx + 1),
                  extractVisitDateForPdf(row),
                  row.route_name || "—",
                  getPartyNameForPdf(row),
                  extractVisitTimeForPdf(row),
                  row.activity_name || row.activity_type || row.type || "—",
                  Number(row.so_quantity ?? row.quantity ?? 0).toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  }),
                  formatCurrencyPdf(row.order_value ?? row.so_amount),
                  formatCurrencyPdf(row.collection ?? row.receipt_amount),
                  row.remarks || "—",
                ])
              : [["No activities found", "", "", "", "", "", "", "", "", ""]],
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 2,
            textColor: [17, 24, 39],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            valign: "middle",
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [55, 65, 81],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 12, right: 12, bottom: 16 },
        });

        let nextY = drawPdfSectionHeading(
          doc,
          `Not Visited Customers${
            formatRouteCountsForPdf(notVisitedRouteCounts)
              ? ` — Route-wise: ${formatRouteCountsForPdf(notVisitedRouteCounts)}`
              : ""
          }`,
          (doc.lastAutoTable?.finalY || startY) + 10,
          [153, 27, 27]
        );
        autoTable(doc, {
          startY: nextY,
          head: [["Sl.No", "Date", "Route Name", "Party Name", "Remarks"]],
          body:
            notVisitedList.length > 0
              ? notVisitedList.map((row, idx) => [
                  String(idx + 1),
                  extractVisitDateForPdf(row),
                  row.route_name || "—",
                  getPartyNameForPdf(row),
                  row.remarks || "—",
                ])
              : [["No not-visited customers", "", "", "", ""]],
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 2,
            textColor: [17, 24, 39],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            valign: "middle",
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [153, 27, 27],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          alternateRowStyles: { fillColor: [254, 242, 242] },
          margin: { left: 12, right: 12, bottom: 16 },
        });

        nextY = drawPdfSectionHeading(
          doc,
          `Pending Customers${
            formatRouteCountsForPdf(pendingRouteCounts)
              ? ` — Route-wise: ${formatRouteCountsForPdf(pendingRouteCounts)}`
              : ""
          }`,
          (doc.lastAutoTable?.finalY || nextY) + 10,
          [180, 83, 9]
        );
        autoTable(doc, {
          startY: nextY,
          head: [["Sl.No", "Route Name", "Party Name", "Activity", "Visit", "Remarks"]],
          body:
            pendingList.length > 0
              ? pendingList.map((row, idx) => [
                  String(idx + 1),
                  row.route_name || "—",
                  getPartyNameForPdf(row),
                  row.activity_name || "Pending",
                  formatVisitDisplayForPdf(row),
                  row.remarks || "—",
                ])
              : [["No pending customers", "", "", "", "", ""]],
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 2,
            textColor: [17, 24, 39],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            valign: "middle",
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [180, 83, 9],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          alternateRowStyles: { fillColor: [255, 251, 235] },
          margin: { left: 12, right: 12, bottom: 16 },
        });

        nextY = drawPdfSectionHeading(
          doc,
          "Category-Wise Summary",
          (doc.lastAutoTable?.finalY || nextY) + 10,
          [30, 64, 175]
        );
        autoTable(doc, {
          startY: nextY,
          head: [["Sl.No", "Category", "Item Name", "Total Quantity", "Value"]],
          body:
            soCategoryItemRows.length > 0
              ? [
                  ...soCategoryItemRows.map((row, idx) => [
                    String(row.sl_no ?? idx + 1),
                    row.category_name || "Uncategorized",
                    row.item_name || "—",
                    Number(row.quantity || 0).toFixed(2),
                    formatCurrencyPdf(row.value),
                  ]),
                  [
                    { content: "", styles: { fontStyle: "bold" } },
                    { content: "", styles: { fontStyle: "bold" } },
                    { content: "Total", styles: { fontStyle: "bold" } },
                    {
                      content: Number(soCategorySummary.total_quantity || 0).toFixed(2),
                      styles: { fontStyle: "bold" },
                    },
                    {
                      content: formatCurrencyPdf(soCategorySummary.total_value),
                      styles: { fontStyle: "bold" },
                    },
                  ],
                ]
              : [["", "No sales order category data", "", "", ""]],
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 2,
            textColor: [17, 24, 39],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            valign: "middle",
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          alternateRowStyles: { fillColor: [239, 246, 255] },
          margin: { left: 12, right: 12, bottom: 16 },
        });

        addPdfFooter(doc);
        doc.save(
          `route-activity-${String(name).replace(/[\\/:*?"<>|]/g, "_")}-${fromDate}_${toDate}.pdf`
        );
      } else {
        const startY = drawReportPdfHeader(doc, {
          title: "ROUTE ACTIVITY REPORT",
          meta: [
            { label: "Period", value: dateLabel },
            { label: "Branch", value: branchLabel },
            ...(searchQuery.trim()
              ? [{ label: "Search", value: searchQuery.trim() }]
              : []),
          ],
          stats: [
            {
              label: "Salesmen",
              value: String(totals.users_count ?? summaryRows.length),
            },
            { label: "Customers", value: String(totals.total_customers ?? 0) },
            { label: "Visited", value: String(totals.visited_customers ?? 0) },
            { label: "SO Amount", value: formatCurrencyPdf(totals.so_amount) },
            {
              label: "Receipt",
              value: formatCurrencyPdf(totals.receipt_amount ?? totals.amount_collected),
            },
          ],
        });

        const body =
          summaryRows.length > 0
            ? summaryRows.map((row) => [
                `${row.salesman_name || row.user_name || "—"}\n${[row.user_id, row.role_name, row.branch_name].filter(Boolean).join(" · ")}`,
                String(row.route_count ?? row.total_routes ?? 0),
                String(row.total_customers ?? 0),
                String(row.visited_customers ?? 0),
                String(row.not_visited_customers ?? 0),
                String(row.pending_customers ?? 0),
                formatCurrencyPdf(row.so_amount),
                formatCurrencyPdf(row.receipt_amount ?? row.amount_collected),
              ])
            : [["No data found for selected filters", "", "", "", "", "", "", ""]];

        body.push([
          "Total",
          String(totals.route_count ?? totals.total_routes ?? 0),
          String(totals.total_customers ?? 0),
          String(totals.visited_customers ?? 0),
          String(totals.not_visited_customers ?? 0),
          String(totals.pending_customers ?? 0),
          formatCurrencyPdf(totals.so_amount),
          formatCurrencyPdf(totals.receipt_amount ?? totals.amount_collected),
        ]);

        autoTable(doc, {
          startY,
          head: [[
            "Salesman Name",
            "Routes",
            "Customers",
            "Visited",
            "Not Visited",
            "Pending",
            "SO Amount",
            "Receipt",
          ]],
          body,
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 2,
            textColor: [17, 24, 39],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            valign: "middle",
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [55, 65, 81],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          didParseCell: (data) => {
            if (data.section === "body" && data.row.index === body.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [243, 244, 246];
            }
          },
          margin: { left: 12, right: 12, bottom: 16 },
        });

        addPdfFooter(doc);
        doc.save(`route-activity-report-${fromDate}_${toDate}.pdf`);
      }

      toast({
        title: "PDF Downloaded",
        description: "Route activity report PDF has been downloaded.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Download failed",
        description: err?.message || "Failed to generate PDF.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadSalesman = async (row) => {
    setIsDownloadingPdf(true);
    try {
      const params = new URLSearchParams();
      params.set("user_id", row.user_id);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (branchFilter !== "all") params.set("branch_id", branchFilter);
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/voucher/route-activity-user-details/?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to fetch salesman details");
      }

      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF("l", "mm", "a4");

      const user = data?.data?.user || row;
      const totalsRow = data?.data?.totals || {};
      const list = (data?.data?.visited_customers_list || data?.data?.activities || []).filter(
        (item) => {
          const name = String(item?.activity_name || "")
            .trim()
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\s+/g, " ");
          return name !== "not visited" && name !== "not available" && name !== "skipped";
        }
      );
      const notVisited =
        data?.data?.not_visited_customers_list ||
        (data?.data?.activities || []).filter((item) => {
          const name = String(item?.activity_name || "")
            .trim()
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\s+/g, " ");
          return name === "not visited" || name === "not available" || name === "skipped";
        });
      const pending = Array.isArray(data?.data?.pending_customers_list)
        ? data.data.pending_customers_list
        : [];
      const routeSummary = data?.data?.route_wise_summary || {};
      const routeRows = routeSummary?.routes || [];
      const visitedRoutes = routeSummary?.visited || [];
      const notVisitedRoutes = routeSummary?.not_visited || [];
      const pendingRoutes = routeSummary?.pending || [];
      const categorySummary = data?.data?.so_category_summary || {};
      const categoryRows = categorySummary?.categories || [];
      const categoryItemRows =
        Array.isArray(categorySummary?.items) && categorySummary.items.length > 0
          ? categorySummary.items
          : (() => {
              const flat = [];
              let sl = 1;
              (categoryRows || []).forEach((cat) => {
                (cat.items || []).forEach((item) => {
                  flat.push({
                    sl_no: sl++,
                    category_name: cat.category_name,
                    item_name: item.item_name,
                    quantity: item.quantity,
                    value: item.value,
                  });
                });
              });
              return flat;
            })();
      const name = user.user_name || row.salesman_name || row.user_name || "Salesman";
      const dateLabel = `${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`;
      const responseBranch = user.branch_name || row.branch_name || "";

      const headerEndY = drawReportPdfHeader(doc, {
        title: "ROUTE ACTIVITY REPORT",
        branch: responseBranch,
        showOrganization: false,
        meta: [
          { label: "Salesman", value: name },
          { label: "Period", value: dateLabel },
          ...(responseBranch ? [{ label: "Branch", value: responseBranch }] : []),
        ],
        stats: [
          { label: "Visited", value: String(totalsRow.visited_customers ?? 0) },
          { label: "Not Visited", value: String(totalsRow.not_visited_customers ?? 0) },
          { label: "Pending", value: String(totalsRow.pending_customers ?? 0) },
          { label: "SO Amount", value: formatCurrencyPdf(totalsRow.so_amount) },
          { label: "Receipt", value: formatCurrencyPdf(totalsRow.receipt_amount) },
        ],
      });
      const routeSummaryStartY = drawPdfSectionHeading(
        doc,
        "Route-wise Summary",
        headerEndY,
        [30, 64, 175]
      );
      const routeSummaryEndY = drawRouteWiseSummaryTable(
        doc,
        autoTable,
        routeRows,
        routeSummaryStartY
      );
      const startY = drawPdfSectionHeading(
        doc,
        `Visited Customers List${
          formatRouteCountsForPdf(visitedRoutes)
            ? ` — Route-wise: ${formatRouteCountsForPdf(visitedRoutes)}`
            : ""
        }`,
        routeSummaryEndY + 10,
        [22, 101, 52]
      );

      autoTable(doc, {
        startY,
        head: [[
          "Sl.No",
          "Date",
          "Route Name",
          "Party Name",
          "Visit Time",
          "Transaction Type",
          "SO Quantity",
          "Order Value",
          "Collection",
          "Remarks",
        ]],
        body:
          list.length > 0
            ? list.map((item, idx) => [
                String(idx + 1),
                extractVisitDateForPdf(item),
                item.route_name || "—",
                getPartyNameForPdf(item),
                extractVisitTimeForPdf(item),
                item.activity_name || item.activity_type || item.type || "—",
                Number(item.so_quantity ?? item.quantity ?? 0).toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                }),
                formatCurrencyPdf(item.order_value ?? item.so_amount),
                formatCurrencyPdf(item.collection ?? item.receipt_amount),
                item.remarks || "—",
              ])
            : [["No activities", "", "", "", "", "", "", "", "", ""]],
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
          textColor: [17, 24, 39],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [55, 65, 81],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 12, right: 12, bottom: 16 },
      });

      let nextY = drawPdfSectionHeading(
        doc,
        `Not Visited Customers${
          formatRouteCountsForPdf(notVisitedRoutes)
            ? ` — Route-wise: ${formatRouteCountsForPdf(notVisitedRoutes)}`
            : ""
        }`,
        (doc.lastAutoTable?.finalY || startY) + 10,
        [153, 27, 27]
      );
      autoTable(doc, {
        startY: nextY,
        head: [["Sl.No", "Date", "Route Name", "Party Name", "Remarks"]],
        body:
          notVisited.length > 0
            ? notVisited.map((item, idx) => [
                String(idx + 1),
                extractVisitDateForPdf(item),
                item.route_name || "—",
                getPartyNameForPdf(item),
                item.remarks || "—",
              ])
            : [["No not-visited customers", "", "", "", ""]],
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
          textColor: [17, 24, 39],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [153, 27, 27],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: 12, right: 12, bottom: 16 },
      });

      nextY = drawPdfSectionHeading(
        doc,
        `Pending Customers${
          formatRouteCountsForPdf(pendingRoutes)
            ? ` — Route-wise: ${formatRouteCountsForPdf(pendingRoutes)}`
            : ""
        }`,
        (doc.lastAutoTable?.finalY || nextY) + 10,
        [180, 83, 9]
      );
      autoTable(doc, {
        startY: nextY,
        head: [["Sl.No", "Route Name", "Party Name", "Activity", "Visit", "Remarks"]],
        body:
          pending.length > 0
            ? pending.map((item, idx) => [
                String(idx + 1),
                item.route_name || "—",
                getPartyNameForPdf(item),
                item.activity_name || "Pending",
                formatVisitDisplayForPdf(item),
                item.remarks || "—",
              ])
            : [["No pending customers", "", "", "", "", ""]],
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
          textColor: [17, 24, 39],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [180, 83, 9],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        margin: { left: 12, right: 12, bottom: 16 },
      });

      nextY = drawPdfSectionHeading(
        doc,
        "Category-Wise Summary",
        (doc.lastAutoTable?.finalY || nextY) + 10,
        [30, 64, 175]
      );
      autoTable(doc, {
        startY: nextY,
        head: [["Sl.No", "Category", "Item Name", "Total Quantity", "Value"]],
        body:
          categoryItemRows.length > 0
            ? [
                ...categoryItemRows.map((item, idx) => [
                  String(item.sl_no ?? idx + 1),
                  item.category_name || "Uncategorized",
                  item.item_name || "—",
                  Number(item.quantity || 0).toFixed(2),
                  formatCurrencyPdf(item.value),
                ]),
                [
                  { content: "", styles: { fontStyle: "bold" } },
                  { content: "", styles: { fontStyle: "bold" } },
                  { content: "Total", styles: { fontStyle: "bold" } },
                  {
                    content: Number(categorySummary.total_quantity || 0).toFixed(2),
                    styles: { fontStyle: "bold" },
                  },
                  {
                    content: formatCurrencyPdf(categorySummary.total_value),
                    styles: { fontStyle: "bold" },
                  },
                ],
              ]
            : [["", "No sales order category data", "", "", ""]],
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
          textColor: [17, 24, 39],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: 12, right: 12, bottom: 16 },
      });

      addPdfFooter(doc);
      doc.save(
        `route-activity-${String(name).replace(/[\\/:*?"<>|]/g, "_")}-${fromDate}_${toDate}.pdf`
      );

      toast({
        title: "PDF Downloaded",
        description: "Salesman route activity PDF has been downloaded.",
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (permissionsLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="app-main-content flex items-center justify-center">
          <CommonLoader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        )}
        <div className="app-main-content flex items-center justify-center p-6">
          <Card className="max-w-md w-full border-red-200">
            <CardContent className="p-8 text-center">
              <Route className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
              <p className="text-red-600 mb-4">
                You do not have permission to view Route Activity Report.
              </p>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isDetail = !!selectedSalesmanId;
  const isBusy = isDetail ? detailLoading || detailFetching : summaryLoading || summaryFetching;

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <Route className="h-6 w-6 text-gray-600" />
                <h1 className="text-2xl font-bold text-gray-900">Route Activity Report</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf || isBusy}
                className="bg-black hover:bg-gray-800 text-white"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isDownloadingPdf ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {!isDetail && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Filter className="h-4 w-4 text-gray-600" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
                    <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                      <Label className="text-sm font-semibold text-gray-800">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search salesman, branch, role..."
                          className="h-10 pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-gray-800">Date Range</Label>
                      <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
                        <SelectTrigger className="h-10">
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

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-gray-800">From Date</Label>
                      <Popover
                        open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                        onOpenChange={(open) =>
                          dateRangePreset === "custom" &&
                          setIsDatePickerOpen((p) => ({ ...p, from: open }))
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={dateRangePreset !== "custom"}
                            className={`w-full h-10 px-3 inline-flex items-center rounded-md border text-sm ${
                              dateRangePreset === "custom"
                                ? "bg-white"
                                : "bg-gray-100 text-gray-500 cursor-not-allowed"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                            {fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "Start date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={fromDate ? new Date(fromDate) : undefined}
                            onSelect={(d) => {
                              const ds = d ? format(d, "yyyy-MM-dd") : "";
                              setFromDate(ds);
                              if (ds && toDate && ds > toDate) setToDate(ds);
                              setIsDatePickerOpen((p) => ({ ...p, from: false }));
                            }}
                            disabled={{ after: new Date() }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-gray-800">To Date</Label>
                      <Popover
                        open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                        onOpenChange={(open) =>
                          dateRangePreset === "custom" &&
                          setIsDatePickerOpen((p) => ({ ...p, to: open }))
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={dateRangePreset !== "custom"}
                            className={`w-full h-10 px-3 inline-flex items-center rounded-md border text-sm ${
                              dateRangePreset === "custom"
                                ? "bg-white"
                                : "bg-gray-100 text-gray-500 cursor-not-allowed"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                            {toDate ? format(new Date(toDate), "dd-MM-yyyy") : "End date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={toDate ? new Date(toDate) : undefined}
                            onSelect={(d) => {
                              setToDate(d ? format(d, "yyyy-MM-dd") : "");
                              setIsDatePickerOpen((p) => ({ ...p, to: false }));
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

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-gray-800">Branch</Label>
                      <Popover
                        open={branchDropdownOpen}
                        onOpenChange={(open) => {
                          setBranchDropdownOpen(open);
                          if (!open) setBranchSearch("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={branchDropdownOpen}
                            className="w-full justify-between h-10 font-normal"
                          >
                            <span className="truncate">{selectedBranchLabel}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0 z-50"
                          align="start"
                          side="bottom"
                          sideOffset={4}
                        >
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search branches..."
                              value={branchSearch}
                              onValueChange={setBranchSearch}
                            />
                            <CommandList className="max-h-64">
                              <CommandEmpty>
                                {filteredBranches.length === 0 && branchesData.length === 0
                                  ? "No branches found."
                                  : "No branches match your search."}
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    setBranchFilter("all");
                                    setBranchDropdownOpen(false);
                                    setBranchSearch("");
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      branchFilter === "all" ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  All branches
                                </CommandItem>
                                {filteredBranches.map((branch) => (
                                  <CommandItem
                                    key={branch.id}
                                    value={String(branch.name || branch.id)}
                                    onSelect={() => {
                                      setBranchFilter(String(branch.id));
                                      setBranchDropdownOpen(false);
                                      setBranchSearch("");
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        String(branchFilter) === String(branch.id)
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {branch.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-gray-800">Salesman</Label>
                      <Popover
                        open={salesmanDropdownOpen}
                        onOpenChange={(open) => {
                          setSalesmanDropdownOpen(open);
                          if (!open) setSalesmanSearch("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={salesmanDropdownOpen}
                            className="w-full justify-between h-10 font-normal"
                          >
                            <span className="truncate flex items-center gap-2">
                              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              {selectedSalesmanLabel}
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
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search salesman..."
                              value={salesmanSearch}
                              onValueChange={setSalesmanSearch}
                            />
                            <CommandList className="max-h-64">
                              <CommandEmpty>
                                {filteredSalesmen.length === 0 && salesmanOptions.length === 0
                                  ? "No salesmen found."
                                  : "No salesmen match your search."}
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    setSalesmanFilter("all");
                                    setSalesmanDropdownOpen(false);
                                    setSalesmanSearch("");
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      salesmanFilter === "all" ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  All salesmen
                                </CommandItem>
                                {filteredSalesmen.map((user) => {
                                  const label = user.user_name || user.salesman_name || "—";
                                  const meta = [user.user_id, user.role_name, user.branch_name]
                                    .filter(Boolean)
                                    .join(" · ");
                                  return (
                                    <CommandItem
                                      key={user.user_id}
                                      value={`${label} ${meta}`}
                                      onSelect={() => {
                                        setSalesmanFilter(String(user.user_id));
                                        setSalesmanDropdownOpen(false);
                                        setSalesmanSearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          String(salesmanFilter) === String(user.user_id)
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="min-w-0">
                                        <div className="font-medium truncate">{label}</div>
                                        {meta ? (
                                          <div className="text-xs text-gray-500 truncate">{meta}</div>
                                        ) : null}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isDetail ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {detailUser.user_name ||
                        detailSummary.salesman_name ||
                        selectedSalesmanMeta?.salesman_name ||
                        selectedSalesmanMeta?.user_name ||
                        "Salesman"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {[
                        reportMeta?.distributor,
                        reportMeta?.date ? `Date: ${reportMeta.date}` : null,
                        detailUser.branch_name || selectedSalesmanMeta?.branch_name,
                        `${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={backToSummary}
                    className="w-fit sm:ml-auto border-black text-black hover:bg-gray-100"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to summary
                  </Button>
                </div>

                {detailLoading ? (
                  <div className="flex justify-center py-16">
                    <CommonLoader text="Loading salesman details..." />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3">
                      <StatCard label="Routes" value={detailTotals.route_count ?? 0} tone="blue" icon={Route} />
                      <StatCard label="Customers" value={detailTotals.total_customers ?? 0} tone="blue" icon={Users} />
                      <StatCard label="Visited" value={detailTotals.visited_customers ?? 0} tone="green" icon={CheckCircle2} />
                      <StatCard label="Not Visited" value={detailTotals.not_visited_customers ?? 0} tone="red" icon={XCircle} />
                      <StatCard label="Pending" value={detailTotals.pending_customers ?? 0} tone="amber" icon={Clock} />
                      <StatCard label="Activities" value={detailTotals.total_activity ?? 0} tone="gray" icon={Activity} />
                      <StatCard label="SO Amount" value={formatCurrency(detailTotals.so_amount)} tone="sky" icon={IndianRupee} />
                      <StatCard label="Receipt" value={formatCurrency(detailTotals.receipt_amount)} tone="teal" icon={IndianRupee} />
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">User summary</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50/80">
                              <TableHead>Salesman Name</TableHead>
                              <TableHead>Route Count</TableHead>
                              <TableHead>Total Customers</TableHead>
                              <TableHead>Visited</TableHead>
                              <TableHead>Not Visited</TableHead>
                              <TableHead>Pending</TableHead>
                              <TableHead>SO Amount</TableHead>
                              <TableHead>Receipt Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>
                                <div className="font-semibold text-gray-900">
                                  {detailSummary.salesman_name || detailUser.user_name || "—"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {[detailUser.user_id, detailUser.role_name, detailUser.branch_name]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              </TableCell>
                              <TableCell>{detailTotals.route_count ?? 0}</TableCell>
                              <TableCell>{detailTotals.total_customers ?? 0}</TableCell>
                              <TableCell className="text-green-700 font-medium">
                                {detailTotals.visited_customers ?? 0}
                              </TableCell>
                              <TableCell className="text-red-600 font-medium">
                                {detailTotals.not_visited_customers ?? 0}
                              </TableCell>
                              <TableCell className="text-amber-600 font-medium">
                                {detailTotals.pending_customers ?? 0}
                              </TableCell>
                              <TableCell>{formatCurrency(detailTotals.so_amount)}</TableCell>
                              <TableCell>
                                {formatCurrency(detailTotals.receipt_amount)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Route className="h-4 w-4 text-blue-700" />
                          Route-wise Summary ({routeSummaryRows.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-blue-50/80">
                              <TableHead>Sl.No</TableHead>
                              <TableHead>Route Name</TableHead>
                              <TableHead className="text-right">Route Count</TableHead>
                              <TableHead className="text-right">Customers</TableHead>
                              <TableHead className="text-right">Visited</TableHead>
                              <TableHead className="text-right">Not Visited</TableHead>
                              <TableHead className="text-right">Pending</TableHead>
                              <TableHead className="text-right">Activities</TableHead>
                              <TableHead className="text-right">SO Quantity</TableHead>
                              <TableHead className="text-right">SO Amount</TableHead>
                              <TableHead className="text-right">Receipt</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {routeSummaryRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={11} className="py-10 text-center text-gray-500">
                                  No route-wise data found for the selected range.
                                </TableCell>
                              </TableRow>
                            ) : (
                              routeSummaryRows.map((row, idx) => (
                                <TableRow
                                  key={row.route_id ?? `unassigned-${idx}`}
                                  className="hover:bg-blue-50/40"
                                >
                                  <TableCell className="text-gray-600">{idx + 1}</TableCell>
                                  <TableCell className="font-medium">
                                    {row.route_name || "Unassigned Route"}
                                  </TableCell>
                                  <TableCell className="text-right">{row.route_count ?? 1}</TableCell>
                                  <TableCell className="text-right">{row.total_customers ?? 0}</TableCell>
                                  <TableCell className="text-right text-green-700 font-medium">
                                    {row.visited_customers ?? 0}
                                  </TableCell>
                                  <TableCell className="text-right text-red-600 font-medium">
                                    {row.not_visited_customers ?? 0}
                                  </TableCell>
                                  <TableCell className="text-right text-amber-600 font-medium">
                                    {row.pending_customers ?? 0}
                                  </TableCell>
                                  <TableCell className="text-right">{row.total_activity ?? 0}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {Number(row.so_quantity || 0).toLocaleString("en-IN", {
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrency(row.so_amount)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrency(row.receipt_amount ?? row.amount_collected)}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-600" />
                            Visited Customers List ({visitedList.length})
                          </CardTitle>
                          <RouteCountBadges rows={visitedRouteCounts} tone="green" />
                        </div>
                        <div className="relative w-full sm:w-72">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search customer, route, activity..."
                            className="h-9 pl-9"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {visitedList.length === 0 ? (
                          <div className="py-12 text-center text-gray-500">
                            {searchQuery.trim()
                              ? "No visited customers match your search."
                              : "No visited activities found for this salesman in the selected range."}
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50/80">
                                <TableHead>Sl.No</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Route Name</TableHead>
                                <TableHead>Party Name</TableHead>
                                <TableHead>Visit Time</TableHead>
                                <TableHead>Transaction Type</TableHead>
                                <TableHead className="text-right">SO Quantity</TableHead>
                                <TableHead>Order Value</TableHead>
                                <TableHead>Collection</TableHead>
                                <TableHead>Remarks</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visitedList.map((item, idx) => (
                                <TableRow key={item.id || `visited-${idx}`} className="hover:bg-gray-50">
                                  <TableCell className="tabular-nums text-gray-600">{idx + 1}</TableCell>
                                  <TableCell>{extractVisitDateForPdf(item)}</TableCell>
                                  <TableCell>{item.route_name || "—"}</TableCell>
                                  <TableCell className="font-medium">
                                    {getPartyNameForPdf(item)}
                                  </TableCell>
                                  <TableCell>{extractVisitTimeForPdf(item)}</TableCell>
                                  <TableCell>
                                    {item.activity_name || item.activity_type || item.type || "—"}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {Number(item.so_quantity ?? item.quantity ?? 0).toLocaleString(
                                      "en-IN",
                                      { maximumFractionDigits: 2 }
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatCurrency(item.order_value ?? item.so_amount)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCurrency(item.collection ?? item.receipt_amount)}
                                  </TableCell>
                                  <TableCell>{item.remarks || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base flex items-center gap-2 text-red-700">
                            <XCircle className="h-4 w-4" />
                            Not Visited Customers ({notVisitedList.length})
                          </CardTitle>
                          <RouteCountBadges rows={notVisitedRouteCounts} tone="red" />
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {notVisitedList.length === 0 ? (
                          <div className="py-12 text-center text-gray-500">
                            {searchQuery.trim()
                              ? "No not-visited customers match your search."
                              : "No not-visited customers found for this salesman in the selected range."}
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-red-50/80">
                                <TableHead>Sl.No</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Route Name</TableHead>
                                <TableHead>Party Name</TableHead>
                                <TableHead>Remarks</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {notVisitedList.map((item, idx) => (
                                <TableRow key={item.id || `not-visited-${item.customer_id}-${idx}`} className="hover:bg-red-50/40">
                                  <TableCell className="tabular-nums text-gray-600">{idx + 1}</TableCell>
                                  <TableCell>{extractVisitDateForPdf(item)}</TableCell>
                                  <TableCell>{item.route_name || "—"}</TableCell>
                                  <TableCell className="font-medium">
                                    <div>{getPartyNameForPdf(item)}</div>
                                    {item.contact_number ? (
                                      <div className="text-xs text-gray-500 font-normal">
                                        {item.contact_number}
                                      </div>
                                    ) : null}
                                  </TableCell>
                                  <TableCell>{item.remarks || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                            <Clock className="h-4 w-4" />
                            Pending Customers ({pendingList.length})
                          </CardTitle>
                          <RouteCountBadges rows={pendingRouteCounts} tone="amber" />
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {pendingList.length === 0 ? (
                          <div className="py-12 text-center text-gray-500">
                            {searchQuery.trim()
                              ? "No pending customers match your search."
                              : "No pending customers found for this salesman in the selected range."}
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-amber-50/80">
                                <TableHead>Sl.No</TableHead>
                                <TableHead>Route Name</TableHead>
                                <TableHead>Party Name</TableHead>
                                <TableHead>Activity</TableHead>
                                <TableHead>Visit</TableHead>
                                <TableHead>Remarks</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingList.map((item, idx) => (
                                <TableRow
                                  key={item.id || `pending-${item.customer_id}-${idx}`}
                                  className="hover:bg-amber-50/40"
                                >
                                  <TableCell className="tabular-nums text-gray-600">{idx + 1}</TableCell>
                                  <TableCell>{item.route_name || "—"}</TableCell>
                                  <TableCell className="font-medium">
                                    <div>{getPartyNameForPdf(item)}</div>
                                    {item.contact_number ? (
                                      <div className="text-xs text-gray-500 font-normal">
                                        {item.contact_number}
                                      </div>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-amber-700 font-medium">
                                    {item.activity_name || "Pending"}
                                  </TableCell>
                                  <TableCell>{formatVisitDisplayForPdf(item)}</TableCell>
                                  <TableCell>{item.remarks || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <IndianRupee className="h-4 w-4 text-blue-700" />
                          Category-Wise Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {soCategoryItemRows.length === 0 ? (
                          <div className="py-12 text-center text-gray-500">
                            No sales order category data for activities in this range.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-blue-50/80">
                                <TableHead className="w-16">Sl.No</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Item Name</TableHead>
                                <TableHead className="text-right">Total Quantity</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {soCategoryItemRows.map((row, idx) => (
                                <TableRow
                                  key={`${row.category_id ?? row.category_name}-${row.stock_item_id ?? row.item_name}-${idx}`}
                                  className="hover:bg-blue-50/40"
                                >
                                  <TableCell className="tabular-nums text-gray-600">
                                    {row.sl_no ?? idx + 1}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {row.category_name || "Uncategorized"}
                                  </TableCell>
                                  <TableCell>{row.item_name || "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {Number(row.quantity || 0).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrency(row.value)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-gray-50 font-semibold">
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right">Total</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {Number(soCategorySummary.total_quantity || 0).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatCurrency(soCategorySummary.total_value)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            ) : (
              <>
                {summaryLoading ? (
                  <div className="flex justify-center py-16">
                    <CommonLoader text="Loading route activity..." />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
                      <StatCard label="Salesmen" value={totals.users_count ?? summaryRows.length} tone="blue" icon={Users} />
                      {/* <StatCard label="Routes" value={totals.route_count ?? totals.total_routes ?? 0} tone="blue" icon={Route} /> */}
                      <StatCard label="Customers" value={totals.total_customers ?? 0} tone="blue" icon={Users} />
                      <StatCard label="Visited" value={totals.visited_customers ?? 0} tone="green" icon={CheckCircle2} />
                      <StatCard label="Not Visited" value={totals.not_visited_customers ?? 0} tone="red" icon={XCircle} />
                      <StatCard label="Pending" value={totals.pending_customers ?? 0} tone="amber" icon={Clock} />
                      <StatCard label="SO Amount" value={formatCurrency(totals.so_amount)} tone="sky" icon={IndianRupee} />
                      <StatCard label="Receipt" value={formatCurrency(totals.receipt_amount ?? totals.amount_collected)} tone="teal" icon={IndianRupee} />
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Salesman-wise route activity ({summaryRows.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50/80">
                              <TableHead>Salesman Name</TableHead>
                              <TableHead>Route Count</TableHead>
                              <TableHead>Total Customers</TableHead>
                              <TableHead>Visited</TableHead>
                              <TableHead>Not Visited</TableHead>
                              <TableHead>Pending</TableHead>
                              <TableHead>SO Amount</TableHead>
                              <TableHead>Receipt Amount</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summaryRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center text-gray-500 py-10">
                                  {searchQuery.trim()
                                    ? "No salesman route activity matches your search."
                                    : "No salesman route activity found for the selected filters."}
                                </TableCell>
                              </TableRow>
                            ) : (
                              <>
                                {summaryRows.map((row) => (
                                  <TableRow key={row.user_id} className="hover:bg-gray-50">
                                    <TableCell>
                                      <div className="font-semibold text-gray-900">
                                        {row.salesman_name || row.user_name || "—"}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {[row.user_id, row.role_name, row.branch_name]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </div>
                                    </TableCell>
                                    <TableCell>{row.route_count ?? row.total_routes ?? 0}</TableCell>
                                    <TableCell>{row.total_customers ?? 0}</TableCell>
                                    <TableCell
                                      className={
                                        Number(row.visited_customers) > 0
                                          ? "text-green-700 font-medium"
                                          : ""
                                      }
                                    >
                                      {row.visited_customers ?? 0}
                                    </TableCell>
                                    <TableCell
                                      className={
                                        Number(row.not_visited_customers) > 0
                                          ? "text-red-600 font-medium"
                                          : ""
                                      }
                                    >
                                      {row.not_visited_customers ?? 0}
                                    </TableCell>
                                    <TableCell
                                      className={
                                        Number(row.pending_customers) > 0
                                          ? "text-amber-600 font-medium"
                                          : ""
                                      }
                                    >
                                      {row.pending_customers ?? 0}
                                    </TableCell>
                                    <TableCell>{formatCurrency(row.so_amount)}</TableCell>
                                    <TableCell>
                                      {formatCurrency(row.receipt_amount ?? row.amount_collected)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Button
                                          type="button"
                                          size="sm"
                                          title="View details"
                                          onClick={() => openSalesmanDetail(row)}
                                          className="h-8 w-8 p-0 bg-black text-white hover:bg-gray-800 border border-black"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          title="Download"
                                          onClick={() => handleDownloadSalesman(row)}
                                          className="h-8 w-8 p-0 border-blue-600 text-blue-600 hover:bg-blue-50"
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-gray-50 font-semibold">
                                  <TableCell>Total</TableCell>
                                  <TableCell>
                                    {totals.route_count ?? totals.total_routes ?? 0}
                                  </TableCell>
                                  <TableCell>{totals.total_customers ?? 0}</TableCell>
                                  <TableCell>{totals.visited_customers ?? 0}</TableCell>
                                  <TableCell>{totals.not_visited_customers ?? 0}</TableCell>
                                  <TableCell>{totals.pending_customers ?? 0}</TableCell>
                                  <TableCell>{formatCurrency(totals.so_amount)}</TableCell>
                                  <TableCell>
                                    {formatCurrency(
                                      totals.receipt_amount ?? totals.amount_collected
                                    )}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
