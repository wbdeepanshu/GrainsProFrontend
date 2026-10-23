import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  Menu,
  Plus,
  Search,
  Eye,
  Truck,
  Scale,
  Clock,
  FileText,
  User,
  Filter,
  LogOut,
  LogIn,
  Camera,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  Printer,
} from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  captureCanvasImage,
  MAX_VOUCHER_MEDIA_BYTES,
  uploadVoucherMediaFile,
} from "@/lib/voucherMediaUpload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getOrgInfoSync } from "@/lib/orgInfo";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const VOUCHER_API = `${API_BASE_URL}/api/voucher`;
const MODULE = "way_bridge_info";

const themedCardClass = "shadow-lg border-0 bg-white/80 backdrop-blur-sm overflow-hidden";
const themedCardHeaderClass = "bg-black text-white rounded-t-lg p-3";
const fieldTriggerClass =
  "h-10 w-full border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const toNumber = (value) => {
  const parsed = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatWeight = (value) => {
  const num = toNumber(value);
  if (!num) return "—";
  return `${num.toLocaleString("en-IN", { maximumFractionDigits: 3 })} Kg`;
};

const hasExitCompleted = (entry) => {
  const exit = entry?.exit_time;
  if (exit == null) return false;
  const text = String(exit).trim();
  return Boolean(text && text !== "—");
};

/** Read entry_type from API row or raw string (no frontend inference). */
const getApiEntryType = (rowOrType) => {
  if (rowOrType == null) return "";
  if (typeof rowOrType === "string") {
    return String(rowOrType).trim().toLowerCase();
  }
  return String(rowOrType.entry_type ?? "").trim().toLowerCase();
};

const formatEntryTypeLabel = (rowOrType) => {
  const type = getApiEntryType(rowOrType);
  if (!type) return "—";
  if (type === "outward") return "Outward";
  if (type === "inside") return "Inside";
  if (type === "inward") return "Inward";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const getEntryTypeBadge = (rowOrType) => {
  const type = getApiEntryType(rowOrType);
  if (type === "outward") {
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Outward</Badge>;
  }
  if (type === "inside") {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Inside</Badge>;
  }
  if (type === "inward") {
    return <Badge className="bg-green-100 text-green-800 border-green-200">Inward</Badge>;
  }
  return (
    <Badge variant="outline" className="capitalize">
      {formatEntryTypeLabel(type)}
    </Badge>
  );
};

const getNetWeightClassName = (rowOrType) => {
  const type = getApiEntryType(rowOrType);
  if (type === "outward") return "font-semibold text-red-600";
  if (type === "inward") return "font-semibold text-green-600";
  return "font-medium text-gray-900";
};

const canShowOutwardComplete = (entry) => {
  if (!entry || hasExitCompleted(entry)) return false;
  if (typeof entry.is_inside === "boolean") return entry.is_inside;
  return getApiEntryType(entry) === "inside";
};

const formatLoadingTime = (loadingTime) => {
  if (!loadingTime) return "—";
  if (loadingTime.label) return loadingTime.label;
  const hours = loadingTime.hours;
  const minutes = loadingTime.minutes;
  if (hours == null && minutes == null) return "—";
  return `${hours ?? 0}h ${minutes ?? 0}m`;
};

const groupImagesByType = (images) => {
  const bucket = {};
  (images || []).forEach((img) => {
    const key = String(img.image_type || "other").trim().toLowerCase() || "other";
    if (!bucket[key]) bucket[key] = [];
    bucket[key].push(img);
  });
  const priority = ["entry", "exit"];
  const groups = [];
  priority.forEach((type) => {
    if (bucket[type]?.length) {
      groups.push({ type, items: bucket[type] });
      delete bucket[type];
    }
  });
  Object.keys(bucket)
    .sort()
    .forEach((type) => groups.push({ type, items: bucket[type] }));
  return groups;
};

function DetailSectionCard({ title, children }) {
  return (
    <Card className={themedCardClass}>
      <CardHeader className={cn(themedCardHeaderClass, "py-2 px-3")}>
        <CardTitle className="text-sm font-semibold text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">{children}</CardContent>
    </Card>
  );
}

function DetailField({ label, value, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm font-medium text-gray-900 break-words">{children ?? value ?? "—"}</div>
    </div>
  );
}

export default function VehicleInfoList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState("all");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("all");
  const [dateRangePreset, setDateRangePreset] = useState("today");
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfDay(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfDay(now), "yyyy-MM-dd"));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [outwardTarget, setOutwardTarget] = useState(null);
  const [isOutwardOpen, setIsOutwardOpen] = useState(false);
  const [tareWeight, setTareWeight] = useState("");
  const [outwardRemarks, setOutwardRemarks] = useState("");
  const [exitImages, setExitImages] = useState([]);
  const [uploadingExitImageCount, setUploadingExitImageCount] = useState(0);
  const [exitCameraOpen, setExitCameraOpen] = useState(false);
  const [exitCameraError, setExitCameraError] = useState("");
  const [exitCameraLoading, setExitCameraLoading] = useState(false);
  const exitVideoRef = useRef(null);
  const exitCanvasRef = useRef(null);
  const exitStreamRef = useRef(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead = hasPermission(MODULE, "read");
  const canCreate = hasPermission(MODULE, "create");
  const canUpdate = hasPermission(MODULE, "update");

  useEffect(() => {
    const n = new Date();
    if (dateRangePreset === "today") {
      setFromDate(format(startOfDay(n), "yyyy-MM-dd"));
      setToDate(format(endOfDay(n), "yyyy-MM-dd"));
    } else if (dateRangePreset === "weekly") {
      setFromDate(format(startOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setToDate(format(endOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (dateRangePreset === "monthly") {
      setFromDate(format(startOfMonth(n), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(n), "yyyy-MM-dd"));
    }
  }, [dateRangePreset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (entryTypeFilter !== "all") params.append("entry_type", entryTypeFilter);
    if (vehicleStatusFilter !== "all") params.append("vehicle_status", vehicleStatusFilter);
    if (fromDate) params.append("start_date", fromDate);
    if (toDate) params.append("end_date", toDate);
    params.append("new_page", String(currentPage));
    params.append("per_page", "20");
    return params.toString();
  }, [debouncedSearch, entryTypeFilter, vehicleStatusFilter, fromDate, toDate, currentPage]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["vehicle-waybridge-list", queryParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `${VOUCHER_API}/vehicle-waybridge-entries/?${queryParams}`);
      const json = await res.json();
      if (json?.status && Number(json.status) >= 400) {
        throw new Error(json?.message || "Failed to load vehicle entries");
      }
      return json;
    },
    enabled: !!AuthService.getAccessToken() && canRead,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const { data: detailPayload, isLoading: detailLoading } = useQuery({
    queryKey: ["vehicle-waybridge-detail", selectedId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${VOUCHER_API}/vehicle-waybridge-entries/${selectedId}/`);
      const json = await res.json();
      if (json?.status && Number(json.status) >= 400) {
        throw new Error(json?.message || "Failed to load entry detail");
      }
      return json;
    },
    enabled: !!selectedId && isDetailOpen && canRead,
    refetchOnWindowFocus: false,
  });

  const outwardMutation = useMutation({
    mutationFn: async ({ entryId, payload }) => {
      const res = await apiRequest(
        "PUT",
        `${VOUCHER_API}/vehicle-waybridge-entries/${entryId}/update/`,
        payload
      );
      const json = await res.json();
      if (json?.status && Number(json.status) >= 400) {
        throw new Error(json?.message || "Failed to complete outward");
      }
      return json;
    },
    onSuccess: (json) => {
      toast({
        title: "Success",
        description: json?.message || "Vehicle outward updated successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      setIsOutwardOpen(false);
      setOutwardTarget(null);
      setTareWeight("");
      setOutwardRemarks("");
      setExitImages([]);
      setIsDetailOpen(false);
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["vehicle-waybridge-list"] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["vehicle-waybridge-detail", selectedId] });
      }
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Unable to update vehicle entry",
        variant: "destructive",
      });
    },
  });

  const rows = data?.data || [];
  const pagination = data?.pagination || {};
  const summary = data?.summary || {};
  const detail = detailPayload?.data;

  const uploadExitImage = async (fileOrBlob, previewUrl, fileName = "vehicle-exit.jpg") => {
    if (!fileOrBlob) return;

    if (fileOrBlob.size > MAX_VOUCHER_MEDIA_BYTES) {
      toast({
        title: "Image too large",
        description: "Image size should be less than 50MB.",
        variant: "destructive",
      });
      return;
    }

    const tempId = `exit-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setExitImages((prev) => [
      ...prev,
      {
        id: tempId,
        image: "",
        image_type: "exit",
        preview: previewUrl,
        uploading: true,
      },
    ]);
    setUploadingExitImageCount((count) => count + 1);

    try {
      const file =
        fileOrBlob instanceof File
          ? fileOrBlob
          : new File([fileOrBlob], fileName, { type: fileOrBlob.type || "image/jpeg" });
      const url = await uploadVoucherMediaFile(file);
      setExitImages((prev) =>
        prev.map((img) =>
          img.id === tempId ? { ...img, image: url, uploading: false, preview: url } : img
        )
      );
      toast({
        title: "Image uploaded",
        description: "Exit photo saved and will be attached on save.",
        className: "bg-green-50 border-green-100 text-green-800",
      });
    } catch (error) {
      setExitImages((prev) => prev.filter((img) => img.id !== tempId));
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setUploadingExitImageCount((count) => Math.max(0, count - 1));
    }
  };

  const handleExitImageUpload = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    uploadExitImage(file, previewUrl, file.name || "vehicle-exit.jpg");
  };

  const stopExitCameraStream = () => {
    if (exitStreamRef.current) {
      exitStreamRef.current.getTracks().forEach((track) => track.stop());
      exitStreamRef.current = null;
    }
    if (exitVideoRef.current) {
      exitVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!exitCameraOpen) {
      stopExitCameraStream();
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        setExitCameraError("");
        setExitCameraLoading(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        exitStreamRef.current = stream;
        if (exitVideoRef.current) {
          exitVideoRef.current.srcObject = stream;
          await exitVideoRef.current.play();
        }
      } catch (error) {
        console.error("Unable to access camera:", error);
        setExitCameraError("Unable to open webcam. Please allow camera permission and try again.");
      } finally {
        if (!cancelled) setExitCameraLoading(false);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopExitCameraStream();
    };
  }, [exitCameraOpen]);

  const handleExitCaptureImage = async () => {
    const video = exitVideoRef.current;
    const canvas = exitCanvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      toast({
        title: "Camera not ready",
        description: "Please wait for the camera preview to load.",
        variant: "destructive",
      });
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const { preview, blob } = await captureCanvasImage(canvas);
      if (!blob || blob.size === 0) {
        toast({
          title: "Capture failed",
          description: "Captured photo was empty. Please try again.",
          variant: "destructive",
        });
        return;
      }
      setExitCameraOpen(false);
      await uploadExitImage(blob, preview, `vehicle-exit-capture-${Date.now()}.jpg`);
    } catch (error) {
      console.error("Exit image capture failed:", error);
      toast({
        title: "Capture failed",
        description: "Could not process the captured photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeExitImage = (indexToRemove) => {
    setExitImages((prev) => {
      const removed = prev[indexToRemove];
      if (removed?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== indexToRemove);
    });
  };

  const handlePrintDetail = () => {
    if (!detail) {
      toast({
        title: "Nothing to print",
        description: "Detail is still loading. Please wait.",
        variant: "destructive",
      });
      return;
    }

    const escapeHtml = (value) => {
      if (value === null || value === undefined) return "—";
      const s = String(value);
      if (!s.trim()) return "—";
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const formatWeightPrint = (value) => {
      const num = toNumber(value);
      if (!num) return "—";
      return num.toLocaleString("en-IN", { maximumFractionDigits: 3 });
    };

    const DIGIT_WORDS = [
      "ZERO",
      "ONE",
      "TWO",
      "THREE",
      "FOUR",
      "FIVE",
      "SIX",
      "SEVEN",
      "EIGHT",
      "NINE",
    ];
    const numberToWordsDigits = (value) => {
      const num = toNumber(value);
      if (!num) return "ZERO";
      const str = String(num);
      const out = [];
      for (const ch of str) {
        if (ch === ".") out.push("POINT");
        else if (ch >= "0" && ch <= "9") out.push(DIGIT_WORDS[Number(ch)]);
      }
      return out.join(" ") || "ZERO";
    };

    const entryTypeLabel = formatEntryTypeLabel(detail.entry_type);

    const org = getOrgInfoSync();
    const orgName = org?.organization || "GrainsPro ERP";
    const branchName = org?.branch || "";

    const loadingTimeText = formatLoadingTime(detail.loading_time);
    const remarks = escapeHtml(detail.remarks);
    const returnRemarks = escapeHtml(detail.return_remarks);

    const orgAddress = org?.address || "";
    const stNo = detail.id || detail.entry_no || detail.voucher_number || "—";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Consolas", "Menlo", "Courier New", monospace;
      font-size: 13px;
      line-height: 1.55;
    }
    .page {
      max-width: 640px;
      margin: 0 auto;
      padding: 20px 24px;
    }
    .org {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .branch {
      text-align: center;
      font-size: 12px;
      letter-spacing: 0.5px;
      margin-top: 2px;
      text-transform: uppercase;
    }
    .divider {
      border: none;
      border-top: 1px dashed #111;
      margin: 10px 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 16px;
    }
    .info-grid .item {
      white-space: nowrap;
    }
    .info-grid .item .k {
      display: inline-block;
      min-width: 90px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .info-grid .item .v {
      font-weight: 600;
    }
    .weight-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
    }
    .weight-row .left {
      white-space: nowrap;
    }
    .weight-row .left .k {
      display: inline-block;
      min-width: 70px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .weight-row .left .v {
      font-weight: 700;
    }
    .weight-row .right {
      font-size: 12px;
      white-space: nowrap;
    }
    .signature-block {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      font-size: 12px;
    }
    .signature-line {
      flex: 1;
      border-bottom: 1px dashed #111;
      height: 24px;
      margin-left: 8px;
    }
    .footer-note {
      margin-top: 18px;
      text-align: right;
      font-size: 11px;
    }
    .remark-row {
      margin-top: 4px;
      font-size: 12px;
    }
    .remark-row .k {
      display: inline-block;
      min-width: 90px;
      font-weight: 600;
      text-transform: uppercase;
    }
    @page {
      size: auto;
      margin: 0;
    }
    @media print {
      .no-print { display: none !important; }
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        margin: 0 !important;
        padding: 0 !important;
      }
      .page { padding: 14px 18px; }
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #fff;
      padding: 10px 0 14px 0;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 14px;
    }
    .btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn:hover { background: #1d4ed8; }
    .btn.secondary {
      background: #fff;
      color: #111;
      border: 1px solid #d1d5db;
    }
    .btn.secondary:hover { background: #f3f4f6; }
  </style>
</head>
<body>
  <div class="page">
    <div class="print-bar no-print">
      <button class="btn secondary" onclick="window.close()">Close</button>
      <button class="btn" onclick="window.print()">Print</button>
    </div>

    <div class="org">${escapeHtml(orgName)}</div>
    ${branchName || orgAddress ? `<div class="branch">${escapeHtml(branchName || orgAddress)}</div>` : ""}

    <hr class="divider" />

    <div class="info-grid">
      <div class="item"><span class="k">ST NO</span>: <span class="v">${escapeHtml(stNo)}</span></div>
      <div class="item"><span class="k">VEHICLE NO</span>: <span class="v">${escapeHtml(detail.vehicle_number)}</span></div>
      <div class="item"><span class="k">DRIVER</span>: <span class="v">${escapeHtml(detail.driver_name)}</span></div>
      <div class="item"><span class="k">MOBILE</span>: <span class="v">${escapeHtml(detail.driver_mobile)}</span></div>
      <div class="item"><span class="k">ENTRY TYPE</span>: <span class="v">${escapeHtml(entryTypeLabel)}</span></div>
      <div class="item"><span class="k">LOADING</span>: <span class="v">${escapeHtml(loadingTimeText)}</span></div>
    </div>

    <hr class="divider" />

    <div class="weight-row">
      <div class="left"><span class="k">ENTRY</span>: <span class="v">${escapeHtml(formatWeightPrint(detail.gross_weight))} kg</span></div>
      <div class="right">${escapeHtml(detail.entry_time || "—")}</div>
    </div>
    <div class="weight-row">
      <div class="left"><span class="k">EXIT</span>: <span class="v">${escapeHtml(formatWeightPrint(detail.tare_weight))} kg</span></div>
      <div class="right">${escapeHtml(detail.exit_time || "—")}</div>
    </div>
    <div class="weight-row">
      <div class="left"><span class="k">NET</span>: <span class="v">${escapeHtml(formatWeightPrint(detail.net_weight))} kg</span></div>
      <div class="right">${escapeHtml(numberToWordsDigits(detail.net_weight))} KG</div>
    </div>

    <hr class="divider" />

    <div class="info-grid">
      <div class="item"><span class="k">ENTERED BY</span>: <span class="v">${escapeHtml(detail.entered_by)}</span></div>
      <div class="item"><span class="k">UPDATED BY</span>: <span class="v">${escapeHtml(detail.updated_by)}</span></div>
    </div>

    ${
      (detail.remarks && String(detail.remarks).trim()) ||
      (detail.return_remarks && String(detail.return_remarks).trim())
        ? `<hr class="divider" />
           ${
             detail.remarks && String(detail.remarks).trim()
               ? `<div class="remark-row"><span class="k">ENTRY REMARK</span>: ${remarks}</div>`
               : ""
           }
           ${
             detail.return_remarks && String(detail.return_remarks).trim()
               ? `<div class="remark-row"><span class="k">RETURN REMARK</span>: ${returnRemarks}</div>`
               : ""
           }`
        : ""
    }

    <hr class="divider" />

    <div class="signature-block">
      <div>Operator's Signature:</div>
      <div class="signature-line"></div>
    </div>

    <div class="footer-note">Contact for repairs at tel no</div>
  </div>

  <script>
    (function () {
      setTimeout(function () {
        try { window.focus(); window.print(); } catch (e) {}
      }, 250);
    })();
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=900");
    if (!printWindow) {
      toast({
        title: "Pop-up blocked",
        description: "Please allow pop-ups to print the entry slip.",
        variant: "destructive",
      });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const openOutwardDialog = (row) => {
    if (!canShowOutwardComplete(row)) {
      toast({
        title: "Already completed",
        description: "This vehicle entry already has an exit time.",
        variant: "destructive",
      });
      return;
    }
    setOutwardTarget(row);
    setTareWeight("");
    setOutwardRemarks(row?.return_remarks || "");
    setExitImages([]);
    setUploadingExitImageCount(0);
    setExitCameraOpen(false);
    setIsOutwardOpen(true);
  };

  const submitOutward = () => {
    if (!outwardTarget?.id) return;
    if (!canShowOutwardComplete(outwardTarget)) {
      toast({
        title: "Already completed",
        description: "Exit is already recorded for this entry.",
        variant: "destructive",
      });
      return;
    }
    const tare = toNumber(tareWeight);
    if (!tare) {
      toast({ title: "Required", description: "Exit weight is required.", variant: "destructive" });
      return;
    }
    if (uploadingExitImageCount > 0 || exitImages.some((img) => img.uploading)) {
      toast({
        title: "Upload in progress",
        description: "Please wait for image upload to finish before saving.",
        variant: "destructive",
      });
      return;
    }

    const readyImages = exitImages
      .filter((img) => img.image && !img.uploading)
      .map(({ image, image_type }) => ({
        image,
        image_url: image,
        image_type,
      }));

    outwardMutation.mutate({
      entryId: outwardTarget.id,
      payload: {
        tare_weight: tare,
        return_remarks: outwardRemarks.trim() || null,
        images: readyImages,
      },
    });
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        )}
        <div className="flex-1 flex items-center justify-center">
          <Loader />
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        )}
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You do not have read permission for Vehicle Info.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => window.history.back()}>
                Go back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4 min-w-0">
            {isMobile && (
              <Button variant="outline" size="sm" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="h-7 w-7 text-gray-700 shrink-0" />
                Vehicle Info
              </h1>
              <p className="text-gray-600 text-sm">Weighbridge inward / outward tracking</p>
            </div>
          </div>
          {canCreate && (
            <Button
              className="bg-gradient-to-r from-black to-gray-600 text-white shrink-0"
              onClick={() => setLocation("/vehicle-info/add")}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Inward
            </Button>
          )}
        </div>

        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 min-h-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total entries", value: summary.total_entries ?? 0, icon: FileText, color: "from-slate-700 to-slate-900" },
              { label: "Inside premises", value: summary.inside_vehicles ?? 0, icon: LogIn, color: "from-emerald-600 to-emerald-800" },
              { label: "Inward", value: summary.inward_entries ?? 0, icon: Scale, color: "from-emerald-600 to-emerald-800" },
              { label: "Outward", value: summary.outward_entries ?? 0, icon: LogOut, color: "from-orange-600 to-orange-800" },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className={cn("bg-gradient-to-br text-white border-0", card.color)}>
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-sm">{card.label}</p>
                      <p className="text-3xl font-bold">{card.value}</p>
                    </div>
                    <Icon className="h-8 w-8 text-white/70" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
          <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleDateRangePreset">Date Range</Label>
                  <Select
                    value={dateRangePreset}
                    onValueChange={(value) => {
                      setDateRangePreset(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger id="vehicleDateRangePreset" className={fieldTriggerClass}>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="weekly">Weekly (Mon–Sun)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleFromDate">From Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, from: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="vehicleFromDate"
                        variant="outline"
                        disabled={dateRangePreset !== "custom"}
                        className={cn(
                          fieldTriggerClass,
                          "justify-start text-left font-normal",
                          dateRangePreset !== "custom" && "bg-gray-100 text-gray-500 cursor-not-allowed"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {fromDate ? format(new Date(fromDate), "dd-MM-yyyy") : "From Date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`vehicle-from-${fromDate || "null"}`}
                        mode="single"
                        selected={fromDate ? new Date(fromDate) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          const iso = format(date, "yyyy-MM-dd");
                          setFromDate(iso);
                          if (toDate && iso > toDate) setToDate(iso);
                          setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                          setCurrentPage(1);
                        }}
                        disabled={{ after: new Date() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleToDate">To Date</Label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, to: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="vehicleToDate"
                        variant="outline"
                        disabled={dateRangePreset !== "custom"}
                        className={cn(
                          fieldTriggerClass,
                          "justify-start text-left font-normal",
                          dateRangePreset !== "custom" && "bg-gray-100 text-gray-500 cursor-not-allowed"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {toDate ? format(new Date(toDate), "dd-MM-yyyy") : "To Date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`vehicle-to-${toDate || "null"}`}
                        mode="single"
                        selected={toDate ? new Date(toDate) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          const iso = format(date, "yyyy-MM-dd");
                          setToDate(iso);
                          setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                          setCurrentPage(1);
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
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      className={cn(fieldTriggerClass, "pl-9")}
                      placeholder="Vehicle no, driver, mobile..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Entry type</Label>
                  <Select
                    value={entryTypeFilter}
                    onValueChange={(v) => {
                      setEntryTypeFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className={fieldTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="inside">Inside</SelectItem>
                      <SelectItem value="inward">Inward</SelectItem>
                      <SelectItem value="outward">Outward</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={vehicleStatusFilter}
                    onValueChange={(v) => {
                      setVehicleStatusFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className={fieldTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="inside">Inside</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button variant="outline" className="w-full h-10" onClick={() => refetch()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={themedCardClass}>
          <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Entries</span>
                </CardTitle>
              </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Entry Weight</TableHead>
                    <TableHead>Exit Weight</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Entry Time</TableHead>
                    <TableHead>Exit Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        No vehicle entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const canCompleteOutward = canUpdate && canShowOutwardComplete(row);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.vehicle_number}</TableCell>
                          <TableCell>
                            <div>{row.driver_name || "—"}</div>
                            {row.driver_mobile && (
                              <div className="text-xs text-muted-foreground">{row.driver_mobile}</div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{formatWeight(row.gross_weight)}</TableCell>
                          <TableCell className="font-medium">{formatWeight(row.tare_weight)}</TableCell>
                          <TableCell className={getNetWeightClassName(row)}>
                            {formatWeight(row.net_weight)}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{row.entry_time || "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{row.exit_time || "—"}</TableCell>
                          <TableCell>{getEntryTypeBadge(row)}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedId(row.id);
                                setIsDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canCompleteOutward && (
                              <Button
                                size="sm"
                                className="bg-orange-600 hover:bg-orange-700 text-white mt-1"
                                onClick={() => openOutwardDialog(row)}
                              >
                                <LogOut className="h-4 w-4 mr-1" />
                                Exit
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {pagination?.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_previous}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.current_page} of {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_next}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </main>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b bg-white shrink-0">
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center justify-between gap-3">
              <span>Vehicle Entry Detail</span>
              {detail && (
                <Button
                  size="sm"
                  onClick={handlePrintDetail}
                  className="h-8 px-3 text-xs mr-6 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600"
                  title="Print this entry slip"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Print
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 flex justify-center">
              <Loader />
            </div>
          ) : detail ? (
            <div className="space-y-3 px-4 pb-4">
              <DetailSectionCard title="Vehicle & driver">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <DetailField label="Vehicle" value={detail.vehicle_number} />
                  <DetailField label="Driver" value={detail.driver_name} />
                  <DetailField label="Mobile" value={detail.driver_mobile} />
                  <DetailField label="Entry type">{getEntryTypeBadge(detail)}</DetailField>
                </div>
              </DetailSectionCard>

              <DetailSectionCard title="Weight summary">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <DetailField label="Entry weight" value={formatWeight(detail.gross_weight)} />
                  <DetailField label="Exit weight" value={formatWeight(detail.tare_weight)} />
                  <DetailField label="Net weight">
                    <span className={getNetWeightClassName(detail)}>
                      {formatWeight(detail.net_weight)}
                    </span>
                  </DetailField>
                </div>
              </DetailSectionCard>

              <DetailSectionCard title="Entry timeline">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <DetailField label="Entry time" value={detail.entry_time} />
                  <DetailField label="Exit time" value={detail.exit_time} />
                  <DetailField label="Loading time">
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {formatLoadingTime(detail.loading_time)}
                      {detail.loading_time?.status === "in_progress" && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0">
                          In progress
                        </Badge>
                      )}
                    </span>
                  </DetailField>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-3 pt-3 border-t border-gray-100">
                  <DetailField label="Entered by" value={detail.entered_by} />
                  <DetailField label="Updated by" value={detail.updated_by} />
                </div>
              </DetailSectionCard>

              <DetailSectionCard title="Remarks">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-md border border-gray-100 bg-slate-50/80 p-2.5 min-h-[4rem]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Entry remarks
                    </p>
                    <p className="text-sm text-gray-800 break-words">{detail.remarks || "—"}</p>
                  </div>
                  <div className="rounded-md border border-gray-100 bg-slate-50/80 p-2.5 min-h-[4rem]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Return remarks
                    </p>
                    <p className="text-sm text-gray-800 break-words">{detail.return_remarks || "—"}</p>
                  </div>
                </div>
              </DetailSectionCard>

              {Array.isArray(detail.images) && detail.images.length > 0 && (
                <DetailSectionCard title="Images">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    {groupImagesByType(detail.images).map((group) => (
                      <div key={group.type} className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-2 capitalize">
                          {group.type} ({group.items.length})
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {group.items.map((img) => (
                            <a
                              key={img.id}
                              href={img.image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-md border overflow-hidden bg-gray-50 hover:ring-2 hover:ring-gray-300"
                            >
                              <img
                                src={img.image_url}
                                alt={group.type}
                                className="w-full h-20 object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSectionCard>
              )}

              {canUpdate && canShowOutwardComplete(detail) && (
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 h-9"
                  onClick={() => {
                    setIsDetailOpen(false);
                    openOutwardDialog(detail);
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Complete outward / exit
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No detail available.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isOutwardOpen}
        onOpenChange={(open) => {
          setIsOutwardOpen(open);
          if (!open) {
            setExitCameraOpen(false);
            setExitImages([]);
            setUploadingExitImageCount(0);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete outward — {outwardTarget?.vehicle_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Entry weight: <strong>{formatWeight(outwardTarget?.gross_weight)}</strong>
            </p>
            <div className="space-y-2">
              <Label>Exit weight (kg) *</Label>
              <Input
                type="number"
                step="0.001"
                className={fieldTriggerClass}
                value={tareWeight}
                onChange={(e) => setTareWeight(e.target.value)}
                placeholder="Vehicle Weight"
              />
            </div>
            <div className="space-y-2">
              <Label>Return remarks</Label>
              <Textarea value={outwardRemarks} onChange={(e) => setOutwardRemarks(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Exit photos (optional)</Label>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="inline-flex items-center gap-2 h-10 px-3 border rounded-md cursor-pointer hover:bg-gray-50 text-sm">
                  <Camera className="h-4 w-4" />
                  Add photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingExitImageCount > 0}
                    onChange={(e) => {
                      handleExitImageUpload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-3"
                  disabled={uploadingExitImageCount > 0}
                  onClick={() => setExitCameraOpen(true)}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capture image
                </Button>
                {exitImages.map((img, idx) => {
                  const thumbSrc = img.preview || img.image;
                  return (
                    <div key={img.id || idx} className="relative w-16 h-16 rounded border overflow-hidden shrink-0">
                      {thumbSrc ? (
                        <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100" />
                      )}
                      {img.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-black/60 text-white p-0.5"
                        onClick={() => removeExitImage(idx)}
                        disabled={img.uploading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={outwardMutation.isPending || uploadingExitImageCount > 0}
              onClick={submitOutward}
            >
              {outwardMutation.isPending ? "Saving..." : "Save outward & exit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exitCameraOpen} onOpenChange={setExitCameraOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Capture exit photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-black overflow-hidden">
              {exitCameraError ? (
                <div className="h-64 flex items-center justify-center text-sm text-red-600 bg-red-50 px-4 text-center">
                  {exitCameraError}
                </div>
              ) : (
                <video
                  ref={exitVideoRef}
                  className="w-full h-64 object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              )}
            </div>
            {exitCameraLoading && !exitCameraError && (
              <p className="text-xs text-gray-500">Opening camera...</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setExitCameraOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleExitCaptureImage}
                disabled={exitCameraLoading || !!exitCameraError || uploadingExitImageCount > 0}
                className="bg-black text-white hover:bg-gray-800"
              >
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <canvas ref={exitCanvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
