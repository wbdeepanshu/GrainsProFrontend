import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Package,
  Truck,
  User,
  Weight,
  CalendarDays,
  ChevronLeft,
  Menu,
  Scale,
  Tag,
  Image,
  CheckCircle,
  XCircle,
  UserCheck,
  Loader2,
  Upload,
  Camera,
  Plus,
  Minus,
  X,
  TestTube,
  FlaskConical,
  AlertTriangle,
  Download,
  Printer,
  QrCode,
  Check,
  ChevronsUpDown,
  Receipt,
  Layers,
  PlayCircle,
  Volume2,
  FileText,
  Eye,
  Play,
} from "lucide-react";
import CommonLoader from "@/components/common/loader";
import vehicleTopView from "@/assets/vehicle.png";
import { AuthService } from "@/lib/auth";
import { isAdminSettingEnabled, isAdminSettingEnabledByName } from "@/lib/adminSettings";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { fetchOrgInfo, getOrgInfoSync } from "@/lib/orgInfo";
import {
  formatTotalWeightDisplay,
  formatInwardItemTotalWeightDisplay,
} from "@/lib/weightDisplay";
import { uploadInwardVoice } from "@/lib/purchaseOrderVoiceUpload";
import { useVoiceRemarks } from "@/hooks/useVoiceRemarks";
import VoiceRemarkMicButton from "@/components/common/VoiceRemarkMicButton";
import VoiceRemarkStatus from "@/components/common/VoiceRemarkStatus";
import VoiceRemarkPlaybackButton from "@/components/common/VoiceRemarkPlaybackButton";
import InwardItemRemarksSection from "@/components/common/InwardItemVoiceRemarks";
import {
  buildInwardLabTestTableModel,
  computeInwardTestDifferenceDetails,
  enrichInwardLabTestsWithBreakdowns,
  formatInwardTestValue,
  getLatestInwardTest,
} from "@/lib/inwardLabTests";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
/** Localized inward image type labels for PDF captions (backend keys → display text). */
const PDF_IMAGE_TYPE_LABELS = {
  en: {
    bardan_quality: "Bardan Quality",
    inward_chitti: "Inward Chitti",
    bucket_photo: "Bucket Photo",
    lab_samples: "Lab Samples",
    breakdown_image: "Breakdown Image",
    post_test_samples: "Post-Test Samples",
    pre_test_samples: "Pre-Test Samples",
    others: "Others",
  },
  hi: {
    bardan_quality: "बर्दान गुणवत्ता",
    inward_chitti: "इनवर्ड चिट्ठी",
    bucket_photo: "बाल्टी फोटो",
    lab_samples: "प्रयोगशाला नमूने",
    breakdown_image: "ब्रेकडाउन छवि",
    post_test_samples: "पोस्ट-टेस्ट नमूने",
    pre_test_samples: "प्री-टेस्ट नमूने",
    others: "अन्य",
  },
  kn: {
    bardan_quality: "ಬರದಾನ್ ಗುಣಮಟ್ಟ",
    inward_chitti: "ಒಳಹರಿವು ಚಿಟ್ಟಿ",
    bucket_photo: "ಬಕೆಟ್ ಫೋಟೋ",
    lab_samples: "ಪ್ರಯೋಗಾಲಯ ಮಾದರಿಗಳು",
    breakdown_image: "ಬ್ರೇಕ್‌ಡೌನ್ ಚಿತ್ರ",
    post_test_samples: "ಪೋಸ್ಟ್-ಪರೀಕ್ಷಾ ಮಾದರಿಗಳು",
    pre_test_samples: "ಪ್ರೀ-ಪರೀಕ್ಷಾ ಮಾದರಿಗಳು",
    others: "ಇತರೆ",
  },
  gu: {
    bardan_quality: "બરદાન ગુણવત્તા",
    inward_chitti: "અંદરની ચીટી",
    bucket_photo: "બકેટ ફોટો",
    lab_samples: "પ્રયોગશાળાના નમૂનાઓ",
    breakdown_image: "બ્રેકડાઉન છબી",
    post_test_samples: "પોસ્ટ ટેસ્ટ નમૂનાઓ",
    pre_test_samples: "પ્રી ટેસ્ટ નમૂનાઓ",
    others: "અન્ય",
  },
};

/** Admin-setting keys → API image types for supervisor unloading uploads */
const UNLOADING_IMAGE_SETTINGS = [
  {
    settingKey: "before_unloading_image",
    apiType: "before_unloading",
    label: "Before Unloading",
  },
  {
    settingKey: "after_unloading_image",
    apiType: "after_unloading",
    label: "After Unloading",
  },
  {
    settingKey: "bucket_sample_image",
    apiType: "bucket_photo",
    label: "Bucket Sample",
  },
  {
    settingKey: "inwad_slip_image",
    apiType: "inward_chitti",
    label: "Inward Slip",
  },
];

const isSnakeCaseImageTypeKey = (value) =>
  /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/i.test(String(value ?? "").trim());

const resolvePdfImageTypeKey = (image) => {
  const candidates = [
    image?.type,
    image?.image_type,
    image?.name,
    image?.image_name,
    image?.file_name,
    image?.filename,
    image?.title,
  ];
  for (const candidate of candidates) {
    const key = String(candidate ?? "").trim().toLowerCase();
    if (key && isSnakeCaseImageTypeKey(key)) return key;
  }
  const typeDisplay = String(image?.type_display ?? "").trim();
  if (typeDisplay) {
    for (const [key, enLabel] of Object.entries(PDF_IMAGE_TYPE_LABELS.en)) {
      if (enLabel.toLowerCase() === typeDisplay.toLowerCase()) return key;
    }
  }
  return String(image?.type || image?.image_type || "").trim().toLowerCase();
};

const getPdfImageDisplayLabel = (image, language = "en") => {
  const lang = PDF_IMAGE_TYPE_LABELS[language] ? language : "en";
  const labels = PDF_IMAGE_TYPE_LABELS[lang];
  const typeKey = resolvePdfImageTypeKey(image);

  if (typeKey && labels[typeKey]) return labels[typeKey];

  const typeDisplay = String(image?.type_display ?? "").trim();
  if (typeDisplay && !isSnakeCaseImageTypeKey(typeDisplay)) {
    if (lang !== "en") {
      for (const [key, enLabel] of Object.entries(PDF_IMAGE_TYPE_LABELS.en)) {
        if (enLabel.toLowerCase() === typeDisplay.toLowerCase() && labels[key]) {
          return labels[key];
        }
      }
    }
    return typeDisplay;
  }

  const fallback = String(
    image?.name || image?.image_name || image?.file_name || image?.filename || image?.title || ""
  ).trim();
  if (fallback && labels[fallback.toLowerCase()]) return labels[fallback.toLowerCase()];
  if (fallback && !isSnakeCaseImageTypeKey(fallback)) return fallback;

  if (typeKey) {
    return (
      labels[typeKey] ||
      typeKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  return typeDisplay || fallback || "Image";
};

const getUserDisplayName = (user) => {
  const name = user?.name || user?.user_name || user?.full_name || "—";
  const role = user?.role_name || user?.designation || "User";
  return `${name} - ${role}`;
};

function UserStatusBadge({ activeStatus }) {
  const isPresent = activeStatus === true;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold leading-none ${
        isPresent ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {isPresent ? "Present" : "Absent"}
    </span>
  );
}

const renderUserSelectOption = (user, isSelected) => (
  <div className="flex w-full min-w-0 items-center justify-between gap-3 pr-1">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Check
        className={`h-4 w-4 shrink-0 ${
          isSelected ? "opacity-100 text-blue-600" : "opacity-0"
        }`}
      />
      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-900">
        {getUserDisplayName(user)}
      </span>
    </div>
    <UserStatusBadge activeStatus={user?.active_status} />
  </div>
);

const pdfIsOnlyNumericLike = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return true;
  return /^[\d\s.,:/()%+-]+$/.test(s);
};

const pdfIsLikelyCodeOrIdentifier = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return false;
  if (/^(https?:\/\/|www\.|mailto:)/i.test(s)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
  if (/^[A-Z0-9\-_/]{4,}$/.test(s)) return true;
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(s)) return true;
  return false;
};

const pdfIsAlreadyTargetScript = (value, language) => {
  const s = String(value ?? "");
  if (!s) return false;
  if (language === "kn") return /[\u0C80-\u0CFF]/.test(s);
  if (language === "hi") return /[\u0900-\u097F]/.test(s);
  if (language === "gu") return /[\u0A80-\u0AFF]/.test(s);
  return false;
};

const PDF_STATUS_LABELS = {
  en: {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
    unloaded: "UNLOADED",
    unloaded_but_rejected: "UNLOADED BUT REJECTED",
    assignment_pending: "ASSIGNMENT PENDING",
    completed: "COMPLETED",
    not_unloaded: "NOT UNLOADED",
    unknown: "UNKNOWN",
  },
  hi: {
    pending: "लंबित",
    approved: "स्वीकृत",
    rejected: "अस्वीकृत",
    unloaded: "उतारा गया",
    unloaded_but_rejected: "उतारा व अस्वीकृत",
    assignment_pending: "नियुक्ति लंबित",
    completed: "पूर्ण",
    not_unloaded: "उतारा नहीं",
    unknown: "अज्ञात",
  },
  kn: {
    pending: "ಬಾಕಿ ಇದೆ",
    approved: "ಅನುಮೋದಿತ",
    rejected: "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    unloaded: "ಇಳಿಸಲಾಗಿದೆ",
    unloaded_but_rejected: "ಇಳಿಸಿ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    assignment_pending: "ನಿಯೋಜನೆ ಬಾಕಿ",
    completed: "ಪೂರ್ಣಗೊಂಡಿದೆ",
    not_unloaded: "ಇಳಿಸಲಾಗಿಲ್ಲ",
    unknown: "ಅಜ್ಞಾತ",
  },
  gu: {
    pending: "બાકી",
    approved: "મંજૂર",
    rejected: "નકારાયેલ",
    unloaded: "ઉતારેલ",
    unloaded_but_rejected: "ઉતારી નકારાયેલ",
    assignment_pending: "સોંપણી બાકી",
    completed: "પૂર્ણ",
    not_unloaded: "ઉતાર્યું નથી",
    unknown: "અજાણ્યું",
  },
};

const PDF_PHRASE_GLOSSARY = {
  kn: {
    "good quality": "ಉತ್ತಮ ಗುಣಮಟ್ಟ",
    average: "ಸರಾಸರಿ",
    premium: "ಪ್ರೀಮಿಯಂ",
    regular: "ಸಾಮಾನ್ಯ",
    quintal: "ಕ್ವಿಂಟಾಲ್",
    qtl: "ಕ್ವಿಂಟಾಲ್",
    pkt: "ಪ್ಯಾಕೆಟ್",
    bags: "ಚೀಲಗಳು",
    "weight breakdowns": "ತೂಕ ವಿಭಜನೆ",
    "status type": "ಸ್ಥಿತಿ ಪ್ರಕಾರ",
    quantity: "ಪ್ರಮಾಣ",
    weight: "ತೂಕ",
    remarks: "ಟಿಪ್ಪಣಿಗಳು",
    parameter: "ಪರಿಮಾಣ",
    "pre-testing": "ಪೂರ್ವ ಪರೀಕ್ಷೆ",
    "post-testing": "ನಂತರದ ಪರೀಕ್ಷೆ",
    "post-testing (breakdowns)": "ನಂತರದ ಪರೀಕ್ಷೆ (ವಿಭಜನೆ)",
    "post-testing (main item)": "ನಂತರದ ಪರೀಕ್ಷೆ (ಮುಖ್ಯ ವಸ್ತು)",
    unknown: "ಅಜ್ಞಾತ",
    "n/a": "ಲಭ್ಯವಿಲ್ಲ",
    completed: "ಪೂರ್ಣಗೊಂಡಿದೆ",
    pending: "ಬಾಕಿ ಇದೆ",
    approved: "ಅನುಮೋದಿತ",
    rejected: "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    unloaded: "ಇಳಿಸಲಾಗಿದೆ",
  },
};

const PDF_LANGUAGE_CORRECTIONS = {
  kn: [
    ["ಕ್ಯೂಂಟಾಲ್", "ಕ್ವಿಂಟಾಲ್"],
    ["ಕ್ಯೂಂಟಲ್", "ಕ್ವಿಂಟಾಲ್"],
    ["ಕ್ವಿಂಟಲ್", "ಕ್ವಿಂಟಾಲ್"],
    ["ಪಿಒ", "ಖರೀದಿ ಆದೇಶ"],
    ["ಐಟಂಗಳು", "ವಸ್ತುಗಳು"],
    ["ಐಟಂ", "ವಸ್ತು"],
    ["ಬ್ರೋಕರ್", "ದಲ್ಲಾಳ"],
    ["ಶುದ್ಧ ತೂಕ", "ನಿವ್ವಳ ತೂಕ"],
    ["ಒಳಹರಿವು", "ಒಳಸರಾವು"],
  ],
};

const getPdfStatusLabel = (status, language = "en") => {
  const key = String(status || "unknown").toLowerCase();
  const labels = PDF_STATUS_LABELS[language] || PDF_STATUS_LABELS.en;
  return labels[key] || PDF_STATUS_LABELS.en[key] || String(status || "Unknown");
};

const applyPdfLanguageCorrections = (text, language) => {
  let result = String(text ?? "");
  if (!result || language === "en") return result;
  const corrections = PDF_LANGUAGE_CORRECTIONS[language] || [];
  for (const [wrong, right] of corrections) {
    result = result.split(wrong).join(right);
  }
  return result;
};

const lookupPdfPhraseGlossary = (text, language) => {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || language === "en") return null;
  const glossary = PDF_PHRASE_GLOSSARY[language];
  if (!glossary) return null;
  return glossary[trimmed.toLowerCase()] || null;
};

const translatePdfPhrase = async (text, language, cache) => {
  const raw = String(text ?? "");
  if (!raw || language === "en" || pdfIsOnlyNumericLike(raw) || pdfIsLikelyCodeOrIdentifier(raw)) {
    return raw;
  }
  if (pdfIsAlreadyTargetScript(raw, language)) return raw;

  const glossaryHit = lookupPdfPhraseGlossary(raw, language);
  if (glossaryHit) return glossaryHit;

  const cacheKey = `${language}::en::${raw}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(language)}&dt=t&q=${encodeURIComponent(raw)}`
    );
    if (!response.ok) return raw;
    const json = await response.json();
    let translated = Array.isArray(json?.[0])
      ? json[0].map((seg) => seg?.[0] || "").join("")
      : raw;
    if (!translated.trim()) translated = raw;
    translated = applyPdfLanguageCorrections(translated, language);
    cache.set(cacheKey, translated);
    return translated;
  } catch {
    return raw;
  }
};

const translatePdfKeepNumbers = async (value, language, cache) => {
  const raw = String(value ?? "");
  if (!raw || language === "en" || pdfIsOnlyNumericLike(raw) || pdfIsLikelyCodeOrIdentifier(raw)) {
    return raw;
  }
  if (pdfIsAlreadyTargetScript(raw, language)) return applyPdfLanguageCorrections(raw, language);

  const parts = raw.split(/(\d+(?:[.,:/-]\d+)*)/g).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (/\d/.test(part) || pdfIsOnlyNumericLike(part) || pdfIsLikelyCodeOrIdentifier(part)) {
      out.push(part);
      continue;
    }
    const trimmed = part.trim();
    if (!trimmed) {
      out.push(part);
      continue;
    }
    const translated = await translatePdfPhrase(trimmed, language, cache);
    const lead = part.match(/^\s*/)?.[0] || "";
    const trail = part.match(/\s*$/)?.[0] || "";
    out.push(`${lead}${translated}${trail}`);
  }
  const finalText = applyPdfLanguageCorrections(out.join(""), language);
  return finalText.trim() ? finalText : raw;
};

const DEFAULT_STACK_ROW_COUNT = 6;

/**
 * Vehicle preview alignment on vehicle.png (top view).
 * All values are % — adjust manually to fit columns inside the cargo bed.
 *
 * VEHICLE_CARGO_OVERLAY — outer cargo bed box (W1 front → W3 rear, W2 top → W4 bottom)
 *   left   : distance from image left edge to cargo front (W1)
 *   top    : distance from image top — increase to move entire overlay down
 *   width  : cargo bed width — decrease to add gap before rear wall (W3)
 *   height : cargo bed height — decrease if columns are too tall
 *
 * VEHICLE_COLUMN_INSET — inner padding inside the cargo box (pushes column bars)
 *   top    : increase to start column bars lower (more space below W2)
 *   right  : increase to stop last column before W3 (fixes rear overlap)
 *   left   : gap after front wall (W1)
 *   bottom : gap before bottom wall (W4)
 */
const VEHICLE_CARGO_OVERLAY = {
  left: 22,
  top: 22,
  width: 67.5,
  height: 60,
};

const VEHICLE_COLUMN_INSET = {
  top: 14,
  right: -2,
  left: 2,
  bottom: 4,
};

const hasStackBagEntries = (stackRows = []) =>
  (stackRows || []).some((row) => String(row.bags_count ?? "").trim() !== "");

const getStackTotalBags = (stackRows = []) =>
  (stackRows || []).reduce((sum, row) => {
    const bags = parseFloat(row.bags_count);
    return sum + (Number.isFinite(bags) ? bags : 0);
  }, 0);

const formatStackTotalForWeight = (total) => {
  if (!Number.isFinite(total) || total <= 0) return "";
  return Number.isInteger(total) ? String(total) : String(Number(total.toFixed(2)));
};

const sortStackColumnsForVehicle = (stackRows = []) =>
  [...(stackRows || [])]
    .filter((row) => String(row.bags_count ?? "").trim() !== "")
    .sort((a, b) => {
      const aNum = parseInt(a.stack_number, 10) || 0;
      const bNum = parseInt(b.stack_number, 10) || 0;
      return aNum - bNum;
    });

const apiStackInfoToLocalRows = (stackInfo = []) =>
  (stackInfo || []).map((entry, index) => ({
    localId: `api-${entry.id ?? entry.stack_number ?? index}`,
    stack_number: String(entry.stack_number ?? ""),
    bags_count: String(entry.bags_count ?? ""),
    remarks: entry.remarks || "",
    images: (entry.images || []).map((img, imgIndex) => ({
      localId: `api-img-${img.id ?? imgIndex}`,
      url: img.media_url || img.url || "",
      uploading: false,
    })),
  }));

const buildStackStateFromItems = (itemsList = []) => {
  const rowsByItem = {};
  const openByItem = {};
  const formByItem = {};

  itemsList.forEach((item) => {
    const stackInfo = item?.stack_info;
    if (Array.isArray(stackInfo) && stackInfo.length) {
      rowsByItem[item.id] = apiStackInfoToLocalRows(stackInfo);
      if (item.status === "not_unloaded") {
        openByItem[item.id] = true;
      }
    }

    const hasUnloadMeta =
      (item.unloaded_weight != null && item.unloaded_weight !== "") ||
      item.supervisor_remarks;

    if (hasUnloadMeta) {
      formByItem[item.id] = {
        status:
          item.status === "unloaded_but_rejected"
            ? "unloaded_but_rejected"
            : "unloaded",
        supervisor_remarks: item.supervisor_remarks || "",
        unloaded_weight:
          item.unloaded_weight != null && item.unloaded_weight !== ""
            ? String(item.unloaded_weight)
            : "",
      };
    }
  });

  return { rowsByItem, openByItem, formByItem };
};

function StackRowInputGrid({
  stackRows = [],
  itemId,
  isUpdating,
  allowMultipleImages = false,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  onImageSelect,
  onRemoveImage,
}) {
  const totalUploadedImages = (stackRows || []).reduce(
    (count, row) =>
      count + row.images.filter((img) => img.url && !img.uploading).length,
    0
  );

  return (
    <div className="mt-2 rounded-md border bg-slate-50/80 p-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-blue-600" />
          Row-wise stacking
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onAddRow}
          disabled={isUpdating || (!allowMultipleImages && totalUploadedImages >= 1)}
        >
          <Plus className="h-3 w-3 mr-0.5" />
          Row
        </Button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {stackRows.map((row, rowIndex) => {
          const uploadedImage = row.images.find((img) => img.url && !img.uploading);
          const isUploading = row.images.some((img) => img.uploading);
          const rowHasImage = Boolean(uploadedImage);
          const cameraDisabled =
            isUpdating ||
            isUploading ||
            (!allowMultipleImages && totalUploadedImages >= 1 && !rowHasImage);
          return (
            <div
              key={row.localId}
              className="rounded border bg-white px-1.5 py-1 flex flex-col gap-1 min-w-0"
            >
              <div className="flex items-center justify-between gap-0.5">
                <span className="text-[10px] font-semibold text-gray-600 truncate">
                  Row {row.stack_number}
                </span>
                {rowIndex >= DEFAULT_STACK_ROW_COUNT && (
                  <button
                    type="button"
                    onClick={() => onRemoveRow(itemId, row.localId)}
                    disabled={isUpdating}
                    className="text-red-400 hover:text-red-600 shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Bags"
                  className="h-7 text-xs px-1.5 min-w-0"
                  value={row.bags_count}
                  onChange={(e) =>
                    onUpdateRow(itemId, row.localId, { bags_count: e.target.value })
                  }
                  disabled={isUpdating}
                />
                <label
                  className={`relative inline-flex items-center justify-center h-7 w-7 shrink-0 rounded border ${
                    cameraDisabled
                      ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                      : uploadedImage
                      ? "border-blue-400 bg-blue-50 cursor-pointer"
                      : "border-dashed border-gray-300 hover:bg-gray-50 cursor-pointer"
                  }`}
                >
                  {isUploading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                  ) : uploadedImage ? (
                    <>
                      <img
                        src={uploadedImage.url || uploadedImage.previewUrl}
                        alt=""
                        className="h-full w-full object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveImage(itemId, row.localId, uploadedImage.localId);
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </>
                  ) : (
                    <Camera className="h-3 w-3 text-blue-600" />
                  )}
                  {!cameraDisabled && (
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImageSelect(itemId, row.localId, file);
                      e.target.value = "";
                    }}
                  />
                  )}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStackRowImageUrls(row) {
  return (row?.images || [])
    .map((img) => img?.url || img?.media_url || img?.image_url || "")
    .filter((url) => String(url).trim());
}

/** Detect video / non-image URLs that should not be rendered as <img> thumbnails. */
function isInwardVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  const path = lower.split("?")[0];
  const videoExtensions = [".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".ogg", ".3gp"];
  if (videoExtensions.some((ext) => path.endsWith(ext))) return true;
  if (lower.includes("/video/upload")) return true;
  if (lower.includes("resource_type=video")) return true;
  if (lower.includes("/view") || lower.includes("view?")) return true;
  return false;
}

/** Keep only still-image media in inward PDF exports (exclude videos). */
function isInwardPdfImageMedia(image) {
  if (!image) return false;
  const url = String(image.image_url || image.url || image.media_url || "").trim();
  if (!url) return false;
  if (isInwardVideoUrl(url)) return false;
  const mime = String(image.mime_type || image.content_type || image.file_type || "").toLowerCase();
  if (mime.startsWith("video/")) return false;
  if (String(image.media_type || "").toLowerCase() === "video") return false;
  if (String(image.type || "").toLowerCase() === "video") return false;
  return true;
}

function openInwardMediaViewer(image, { setSelectedImage, setIsImageDialogOpen, setImageZoom, setImagePosition }) {
  setSelectedImage(image);
  setIsImageDialogOpen(true);
  setImageZoom(1);
  setImagePosition({ x: 0, y: 0 });
}

function InwardMediaThumb({ image, index, onView }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = image?.image_url || "";
  const isVideo = isInwardVideoUrl(url);
  const label = image.type_display || image.type || `Image ${index + 1}`;

  return (
    <div className="relative group">
      <div className="aspect-square w-full rounded-md overflow-hidden bg-white border border-gray-200 shadow-sm">
        {isVideo ? (
          <button
            type="button"
            onClick={() => onView(image)}
            className="w-full h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label={`Play ${label}`}
          >
            <Play className="h-9 w-9 text-gray-500" />
          </button>
        ) : imgFailed ? (
          <button
            type="button"
            onClick={() => onView(image)}
            className="w-full h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label={`View ${label}`}
          >
            <Image className="h-8 w-8 text-gray-400" />
          </button>
        ) : (
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onView(image)}
            onError={() => setImgFailed(true)}
          />
        )}
      </div>
      <div className="mt-1.5 text-center px-0.5">
        <p className="text-[11px] font-medium text-gray-700 line-clamp-2 leading-tight">
          {label}
        </p>
      </div>
    </div>
  );
}

function StackRowImageViewDialog({ open, onOpenChange, imageUrls = [], rowLabel = "" }) {
  if (!imageUrls.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Stack image{imageUrls.length > 1 ? "s" : ""} — {rowLabel}
          </DialogTitle>
          <DialogDescription>
            {imageUrls.length > 1
              ? `${imageUrls.length} images for this stack row`
              : "Preview of the uploaded stack image"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {imageUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="rounded-lg border bg-gray-50 p-2">
              <img
                src={url}
                alt={`${rowLabel} ${index + 1}`}
                className="w-full max-h-[70vh] object-contain rounded-md mx-auto"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SavedStackInfoSection({ item, stackRows = [] }) {
  const [previewRow, setPreviewRow] = useState(null);

  if (!stackRows.length) return null;

  const previewImageUrls = previewRow ? getStackRowImageUrls(previewRow.row) : [];
  const previewLabel = previewRow ? `Row ${previewRow.row.stack_number}` : "";

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-blue-600" />
        <span>Stacking Details</span>
      </h4>

      {item.unloaded_weight != null && item.unloaded_weight !== "" && (
        <div className="text-sm mb-3">
          <span className="text-gray-500">Unloaded Weight: </span>
          <span className="font-medium">{item.unloaded_weight}</span>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
        {stackRows.map((row) => {
          const imageUrls = getStackRowImageUrls(row);
          const hasImages = imageUrls.length > 0;

          return (
          <div
            key={row.localId}
            className="rounded border bg-white px-1.5 py-1.5 min-w-0"
          >
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 min-w-0">
              <span className="text-xs font-medium text-gray-800 whitespace-nowrap">
                Row {row.stack_number}
              </span>
              <span className="text-xs font-medium tabular-nums text-center text-gray-900">
                {row.bags_count} bags
              </span>
              {hasImages ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => setPreviewRow({ row })}
                  className="h-6 w-6 shrink-0 bg-black hover:bg-gray-900 text-white"
                  title="View image"
                  aria-label={`View image for row ${row.stack_number}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <span className="h-6 w-6 shrink-0" aria-hidden />
              )}
            </div>
          </div>
          );
        })}
      </div>

      <StackRowImageViewDialog
        open={Boolean(previewRow)}
        onOpenChange={(open) => {
          if (!open) setPreviewRow(null);
        }}
        imageUrls={previewImageUrls}
        rowLabel={previewLabel}
      />

      <VehicleStackColumnPreview stackRows={stackRows} unloadStatus={item.status} />
    </div>
  );
}

function VehicleStackColumnPreview({ stackRows = [], unloadStatus = "" }) {
  const columns = sortStackColumnsForVehicle(stackRows);
  const isUnloadingFlow =
    unloadStatus === "unloaded" || unloadStatus === "unloaded_but_rejected";
  // Unloading: rows 1..n left → right (rear/W3 on the right, front/W1 on the left)
  const displayColumns = columns;
  const totalBags = getStackTotalBags(stackRows);

  if (!displayColumns.length) return null;

  const maxBagsInColumn = displayColumns.reduce((max, row) => {
    const bags = parseFloat(row.bags_count);
    return Number.isFinite(bags) && bags > max ? bags : max;
  }, 0);

  return (
    <div className="rounded-lg border bg-gradient-to-b from-slate-50 to-white p-2.5 mt-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
          <Truck className="h-3.5 w-3.5 text-blue-600" />
          Vehicle preview
        </p>
        <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">
          {formatStackTotalForWeight(totalBags)} bags
        </Badge>
      </div>

      <div className="relative w-full max-w-3xl mx-auto select-none">
        <img
          src={vehicleTopView}
          alt="Vehicle top view"
          className="w-full h-auto block pointer-events-none"
          draggable={false}
        />

        {/* Cargo bed overlay — tune VEHICLE_CARGO_OVERLAY & VEHICLE_COLUMN_INSET above */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${VEHICLE_CARGO_OVERLAY.left}%`,
            top: `${VEHICLE_CARGO_OVERLAY.top}%`,
            width: `${VEHICLE_CARGO_OVERLAY.width}%`,
            height: `${VEHICLE_CARGO_OVERLAY.height}%`,
          }}
        >
          <div
            className="absolute flex items-stretch justify-stretch overflow-hidden"
            style={{
              top: `${VEHICLE_COLUMN_INSET.top}%`,
              right: `${VEHICLE_COLUMN_INSET.right}%`,
              left: `${VEHICLE_COLUMN_INSET.left}%`,
              bottom: `${VEHICLE_COLUMN_INSET.bottom}%`,
            }}
          >
          {displayColumns.map((row, index) => {
            const bags = parseFloat(row.bags_count);
            const fillPct =
              maxBagsInColumn > 0 && Number.isFinite(bags)
                ? Math.min(100, Math.round((bags / maxBagsInColumn) * 100))
                : 0;

            return (
              <div
                key={row.localId}
                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center ${
                  index > 0 ? "border-l border-blue-500/25" : ""
                }`}
              >
                <div
                  className="absolute inset-1 rounded-sm bg-blue-500/15 transition-all"
                  style={{ opacity: 0.35 + (fillPct / 100) * 0.65 }}
                />
                <div
                  className="absolute bottom-1 left-1 right-1 rounded-sm bg-blue-500/55 transition-all"
                  style={{ height: `${Math.max(18, fillPct)}%` }}
                />
                <span className="relative z-[1] text-[8px] sm:text-[9px] font-semibold text-slate-700 leading-none mb-0.5">
                  C{row.stack_number}
                </span>
                <span className="relative z-[1] text-[11px] sm:text-sm font-bold text-blue-950 tabular-nums leading-none">
                  {row.bags_count}
                </span>
                <span className="relative z-[1] text-[7px] sm:text-[8px] text-slate-600 leading-none mt-0.5">
                  bags
                </span>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <p className="text-[9px] text-gray-500 text-center mt-1.5">
        {isUnloadingFlow
          ? "Rear (W3) ← Front (W1) · Rows flow right to left from rear when unloaded"
          : "Front (W1) → Rear (W3) · Columns show row-wise stack counts"}
      </p>
    </div>
  );
}

function UnloadingImageUploadSection({
  enabledSettings = [],
  imagesByType = {},
  allowMultiple = false,
  isUpdating = false,
  onAddImage,
  onRemoveImage,
}) {
  if (!enabledSettings.length) return null;

  const handleFileSelect = (settingKey, event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const images = imagesByType[settingKey] || [];
    const filesToProcess = allowMultiple ? files : files.slice(0, 1);

    if (!allowMultiple && images.length >= 1) {
      event.target.value = "";
      return;
    }

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      onAddImage(settingKey, file);
    });

    event.target.value = "";
  };

  const openFilePicker = (settingKey, useCamera = false) => {
    const images = imagesByType[settingKey] || [];
    const hasUploading = images.some((img) => img.uploading);
    if (hasUploading) return;
    if (!allowMultiple && images.length >= 1) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (useCamera) {
      input.capture = "environment";
    }
    if (allowMultiple) {
      input.multiple = true;
    }
    input.onchange = (event) => handleFileSelect(settingKey, event);
    input.click();
  };

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Image className="h-3.5 w-3.5 text-gray-600" />
        <span className="text-xs font-semibold text-gray-700">Unloading Images</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
        {enabledSettings.map(({ settingKey, label }) => {
          const images = imagesByType[settingKey] || [];
          const hasUploading = images.some((img) => img.uploading);
          const uploadedCount = images.filter((img) => img.url && !img.uploading).length;
          const limitReached = !allowMultiple && uploadedCount >= 1;
          const actionsDisabled = isUpdating || hasUploading || limitReached;

          return (
            <div
              key={settingKey}
              className="flex items-center gap-2 rounded border bg-white px-2 py-1.5 min-w-0"
            >
              <span
                className="text-[11px] font-medium text-gray-600 shrink-0 w-[5.5rem] truncate"
                title={label}
              >
                {label}
              </span>

              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={actionsDisabled}
                  onClick={() => openFilePicker(settingKey, false)}
                  className="h-7 w-7 p-0"
                  title="Upload image"
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={actionsDisabled}
                  onClick={() => openFilePicker(settingKey, true)}
                  className="h-7 w-7 p-0"
                  title="Take photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
                {images.length === 0 ? (
                  <span className="text-[10px] text-gray-400 truncate">No image</span>
                ) : (
                  images.map((image) => (
                    <div
                      key={image.localId}
                      className="relative h-9 w-9 shrink-0 rounded border overflow-hidden bg-gray-100"
                    >
                      <img
                        src={image.previewUrl || image.url}
                        alt={label}
                        className="h-full w-full object-cover"
                      />
                      {image.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                        </div>
                      )}
                      {!image.uploading && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => onRemoveImage(settingKey, image.localId)}
                          className="absolute top-0 right-0 h-4 w-4 flex items-center justify-center bg-red-500 text-white rounded-bl"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const mapInwardQrCodeToState = (qrCode, { alreadyExists = false } = {}) => {
  if (!qrCode?.qr_uid || !(qrCode.url_link || qrCode.qr_url) || qrCode.error) {
    return null;
  }

  return {
    qr_uid: qrCode.qr_uid,
    url_link: qrCode.url_link,
    qr_url: qrCode.qr_url,
    created_at: qrCode.created_at,
    created_by: qrCode.created_by,
    generated_by: qrCode.generated_by,
    generated_by_name: qrCode.generated_by_name,
    item_name: qrCode.item_name,
    our_brand: qrCode.our_brand,
    remarks: qrCode.remarks,
    unloaded_by: qrCode.unloaded_by,
    unloaded_on: qrCode.unloaded_on,
    already_exists: alreadyExists || qrCode.already_exists || false,
  };
};

const mergeInwardQrCodesData = (prev, incoming) => {
  const next = { ...prev };
  Object.entries(incoming).forEach(([itemId, qr]) => {
    next[itemId] = { ...prev[itemId], ...qr };
  });
  return next;
};

const fetchInwardQrCodesFromServer = async (inwardEntryId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/report/get-qr-codes/${inwardEntryId}/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  if (result.status !== 200 || !result.data?.qr_codes?.length) {
    return {};
  }

  const qrCodesByItem = {};
  result.data.qr_codes.forEach((qrCode) => {
    const mapped = mapInwardQrCodeToState(qrCode, { alreadyExists: true });
    if (mapped) {
      qrCodesByItem[qrCode.inward_item_id] = mapped;
    }
  });
  return qrCodesByItem;
};

export default function InwardDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const token = AuthService.getAccessToken();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();

  // Get user permissions
  const {
    hasCreatePermission,
    hasReadPermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    hasPermission,
    isLoading: permissionsLoading
  } = useUserPermissions();

  const hasSalesReturnAccess = hasModuleAccess("sales_return");

  // Check if user has inward assignment access with 'c' or 'r' permission
  const hasInwardAssignmentAccess = hasModuleAccess("inward_assignment") &&
    (hasPermission("inward_assignment", "create") || hasPermission("inward_assignment", "read"));

  const uploadInwardVoiceMemo = useCallback((blob) => uploadInwardVoice(blob), []);
  const voiceRemarks = useVoiceRemarks(uploadInwardVoiceMemo);
  const canRecordVoice =
    hasUpdatePermission("inward") || hasInwardAssignmentAccess;
  const canSupervisorUnload =
    hasUpdatePermission("inward") || hasInwardAssignmentAccess;
  const stackwiseUnloadingEnabled = isAdminSettingEnabled("stackwise_unloading");
  const allowMultipleInwardImages = isAdminSettingEnabled("inward_multiple_images");
  const enabledUnloadingImageSettings = UNLOADING_IMAGE_SETTINGS.filter((setting) =>
    isAdminSettingEnabled(setting.settingKey)
  );

  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [weighmentForm, setWeighmentForm] = useState({
    gross_weight: "",
    tare_weight: "",
    party_gross_weight: "",
    party_tare_weight: "",
    additional_payment: "",
  });
  const [finalRemarksByItem, setFinalRemarksByItem] = useState({});
  const [isSavingWeighment, setIsSavingWeighment] = useState(false);
  const [labTestParams, setLabTestParams] = useState([]);
  const [jaliDetails, setJaliDetails] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarks, setRemarks] = useState("");
  const role = localStorage.getItem("cp_manager_user_data");
  const userRole = JSON.parse(role).role;
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  const [godowns, setGodowns] = useState([]);
  const [selectedGodown, setSelectedGodown] = useState("");
  const [godownDropdownOpen, setGodownDropdownOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [labTechRemarks, setLabTechRemarks] = useState("");

  // New state for approve/reject modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [updateType, setUpdateType] = useState(""); // admin_approval or assign_supervisor
  const [ourBrand, setOurBrand] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const renderVoiceRemarkMic = (disabled = isUpdating) =>
    canRecordVoice ? (
      <VoiceRemarkMicButton
        isRecordingVoice={voiceRemarks.isRecordingVoice}
        isUploadingVoice={voiceRemarks.isUploadingVoice}
        hasVoiceRemarks={voiceRemarks.hasVoiceRemarks}
        disabled={disabled}
        onMicClick={voiceRemarks.handleVoiceMicClick}
      />
    ) : null;

  const renderVoiceRemarkStatus = () =>
    canRecordVoice ? (
      <VoiceRemarkStatus
        isRecordingVoice={voiceRemarks.isRecordingVoice}
        isUploadingVoice={voiceRemarks.isUploadingVoice}
        hasVoiceRemarks={voiceRemarks.hasVoiceRemarks}
        onClear={voiceRemarks.clearVoiceRemarks}
      />
    ) : null;

  const [completionChoiceByItem, setCompletionChoiceByItem] = useState({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPdfLanguageDialogOpen, setIsPdfLanguageDialogOpen] = useState(false);
  const [selectedPdfLanguage, setSelectedPdfLanguage] = useState("en");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrCodesData, setQrCodesData] = useState({}); // Store QR codes by item_id
  const [isQRCodeDialogOpen, setIsQRCodeDialogOpen] = useState(false);
  const [selectedQRCodeItem, setSelectedQRCodeItem] = useState(null); // Store which item's QR code to display
  const [isQRPrintDialogOpen, setIsQRPrintDialogOpen] = useState(false);
  const [qrPaperSize, setQrPaperSize] = useState("A4");
  const [qrPrintWidthMm, setQrPrintWidthMm] = useState("210");
  const [qrPrintHeightMm, setQrPrintHeightMm] = useState("297");

  // Post-testing state variables
  const [postTestParams, setPostTestParams] = useState([]);
  const [selectedPostTestParams, setSelectedPostTestParams] = useState({});
  const [postTestValues, setPostTestValues] = useState({});
  const [postTestRemarks, setPostTestRemarks] = useState({});
  const [postTestImages, setPostTestImages] = useState({});
  const [postTestImageUploading, setPostTestImageUploading] = useState({});
  const [postTestBreakdowns, setPostTestBreakdowns] = useState({}); // Store breakdown_id for each test
  const [selectedBreakdownForTesting, setSelectedBreakdownForTesting] = useState({}); // Store array of selected breakdown IDs per item (including "null" for Main Item)
  const [showPostTestSection, setShowPostTestSection] = useState(false);
  const [stackingOpenByItem, setStackingOpenByItem] = useState({});
  const [stackRowsByItem, setStackRowsByItem] = useState({});
  const [supervisorUnloadFormByItem, setSupervisorUnloadFormByItem] = useState({});
  const [supervisorUnloadImagesByItem, setSupervisorUnloadImagesByItem] = useState({});
  const [startUnloadingDialogOpen, setStartUnloadingDialogOpen] = useState(false);
  const [startUnloadingItem, setStartUnloadingItem] = useState(null);
  const [isStartingUnloading, setIsStartingUnloading] = useState(false);

  // Image viewer dialog state
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Popup state for lab test selection (similar to add inward)
  const [isLabTestPopupOpen, setIsLabTestPopupOpen] = useState({});
  const [popupSelectedItemGroup, setPopupSelectedItemGroup] = useState({});
  const [popupSelectedParams, setPopupSelectedParams] = useState({});
  const [popupSelectedTestType, setPopupSelectedTestType] = useState({});
  const [itemGroups, setItemGroups] = useState([]);

  const handleBackToList = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/reports/inward-list");
  };

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true);
        //const API_URL = "http://192.168.1.193:8096";
        const res = await fetch(
          `${API_BASE_URL}/api/report/get-inwards/${id}/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (!res.ok) throw new Error("Failed to fetch details");
        const result = await res.json();

        if (result.status === 200) {
          const itemsList = result.items || [];
          setData(result.data);
          setItems(itemsList);
          setWeighmentForm({
            gross_weight: result.data?.gross_weight ?? "",
            tare_weight: result.data?.tare_weight ?? "",
            party_gross_weight: result.data?.party_gross_weight ?? "",
            party_tare_weight: result.data?.party_tare_weight ?? "",
            additional_payment: result.data?.additional_payment ?? "",
          });
          setFinalRemarksByItem(
            Object.fromEntries(itemsList.map((item) => [item.id, item.final_remarks ?? ""]))
          );
          setLabTestParams(result.lab_test_parameters || []);
          setJaliDetails(result.jali_details || []);
          // Entry-level images live on data.images; keep fallback for older API shape
          setImages(result.data?.images || result.images || []);

          const { rowsByItem, openByItem, formByItem } = buildStackStateFromItems(itemsList);
          setStackRowsByItem(rowsByItem);
          setStackingOpenByItem(
            isAdminSettingEnabled("stackwise_unloading") ? openByItem : {}
          );
          setSupervisorUnloadFormByItem(formByItem);
        } else {
          throw new Error(result.message || "Failed to fetch details");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id, token]);

  const handleSaveCompletedWeighment = async () => {
    const completedItems = items.filter((item) => item.status === "completed");
    if (!data || completedItems.length !== items.length || completedItems.length === 0) return;

    setIsSavingWeighment(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/report/update-inward/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inward_entry_id: data.id,
          update_type: "weighment_update",
          ...Object.fromEntries(
            Object.entries(weighmentForm).map(([field, value]) => [
              field,
              String(value ?? "").trim() || null,
            ])
          ),
          items: completedItems.map((item) => ({
            inward_item_id: item.id,
            final_remarks: finalRemarksByItem[item.id] ?? "",
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to save completed inward details");
      }

      toast({
        title: "Saved",
        description: result.message || "Completed inward details updated successfully",
        variant: "success",
      });
      window.location.reload();
    } catch (saveError) {
      toast({
        title: "Error",
        description: saveError.message || "Failed to save completed inward details",
        variant: "destructive",
      });
    } finally {
      setIsSavingWeighment(false);
    }
  };

  // Fetch existing QR codes on page load (one per item)
  useEffect(() => {
    async function fetchQRCodes() {
      if (!data?.id) return;

      try {
        const qrCodesByItem = await fetchInwardQrCodesFromServer(data.id, token);
        if (qrCodesByItem) {
          setQrCodesData(qrCodesByItem);
        }
      } catch {
        // Silently fail - QR codes might not exist yet
      }
    }

    fetchQRCodes();
  }, [data, token]);

  // Prefetch organization/branch info into cache for later PDF use
  useEffect(() => {
    if (!token) return;
    fetchOrgInfo(API_BASE_URL, token);
  }, [API_BASE_URL, token]);

  // Fetch lab test parameters for post-testing
  useEffect(() => {
    async function fetchLabTestParams() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/report/lab-test-params/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (res.ok) {
          const result = await res.json();
          setPostTestParams(result.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch lab test parameters:", err);
      }
    }
    fetchLabTestParams();
  }, [token]);

  // Fetch item groups for filtering
  useEffect(() => {
    async function fetchItemGroups() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/report/test-params-groups/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (res.ok) {
          const result = await res.json();
          setItemGroups(result.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch item groups:", err);
      }
    }
    fetchItemGroups();
  }, [token]);

  // Ensure unloaded items without multiple breakdowns have a default test target.
  useEffect(() => {
    if (!items || items.length === 0) return;

    setSelectedBreakdownForTesting(prev => {
      const updated = { ...prev };
      let hasChanges = false;

      items.forEach((item) => {
        // Only apply to items with unloaded status (where this dropdown is shown)
        const breakdownCount = Array.isArray(item.weight_breakdowns)
          ? item.weight_breakdowns.length
          : 0;
        if (
          (item.status === 'unloaded' || item.status === 'unloaded_but_rejected') &&
          breakdownCount <= 1
        ) {
          // Check if nothing is selected yet for this item
          const currentSelected = updated[item.id];
          if (!currentSelected || currentSelected.length === 0) {
            // Auto-select "Main Item (All Bags)" which is represented as "null"
            updated[item.id] = ["null"];
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [items]);

  const resetForm = () => {
    setSelectedItem(null);
    setNewStatus("");
    setUpdateType("");
    setOurBrand("");
    setRemarks("");
    setRejectionReason("");
    setSelectedSupervisor("");
    setSelectedGodown("");
    setLabTechRemarks("");
    setCompletionChoiceByItem({});
    // Reset post-testing state
    setSelectedPostTestParams({});
    setPostTestValues({});
    setPostTestRemarks({});
    setPostTestImages({});
    setPostTestBreakdowns({});
    setSelectedBreakdownForTesting({});
    setShowPostTestSection(false);
    // Reset popup state
    setIsLabTestPopupOpen({});
    setPopupSelectedItemGroup({});
    setPopupSelectedParams({});
    setPopupSelectedTestType({});
    voiceRemarks.clearVoiceRemarks();
    setStackingOpenByItem({});
    setStackRowsByItem({});
    setSupervisorUnloadFormByItem({});
    setSupervisorUnloadImagesByItem({});
  };

  const createEmptyStackRow = (stackNumber = "") => ({
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stack_number: stackNumber ? String(stackNumber) : "",
    bags_count: "",
    remarks: "",
    images: [],
  });

  const buildInitialStackRows = (count = DEFAULT_STACK_ROW_COUNT) =>
    Array.from({ length: count }, (_, index) => createEmptyStackRow(index + 1));

  const getSupervisorUnloadForm = (itemId) =>
    supervisorUnloadFormByItem[itemId] || {
      status: "unloaded",
      supervisor_remarks: "",
      unloaded_weight: "",
    };

  const updateSupervisorUnloadForm = (itemId, patch) => {
    setSupervisorUnloadFormByItem((prev) => ({
      ...prev,
      [itemId]: {
        status: "unloaded",
        supervisor_remarks: "",
        unloaded_weight: "",
        ...(prev[itemId] || {}),
        ...patch,
      },
    }));
  };

  const toggleStackingPanel = (itemId) => {
    setStackingOpenByItem((prev) => {
      const nextOpen = !prev[itemId];
      if (nextOpen && !(stackRowsByItem[itemId] || []).length) {
        setStackRowsByItem((rowsPrev) => ({
          ...rowsPrev,
          [itemId]: buildInitialStackRows(),
        }));
      }
      return { ...prev, [itemId]: nextOpen };
    });
  };

  const getItemStackRows = (item) =>
    stackRowsByItem[item.id]?.length
      ? stackRowsByItem[item.id]
      : apiStackInfoToLocalRows(item.stack_info || []);

  const hasSavedStackInfo = (item) => getItemStackRows(item).length > 0;

  const hasUnloadingStarted = (item) =>
    Boolean(item?.unloading_start_time);

  const openStartUnloadingDialog = (item) => {
    setStartUnloadingItem(item);
    setStartUnloadingDialogOpen(true);
  };

  const handleStartUnloading = async () => {
    if (!startUnloadingItem?.id || !data?.id) return;

    setIsStartingUnloading(true);
    try {
      const token = AuthService.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/report/add-inward/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inward_id: data.id,
          update_type: "start_unloading",
          items: [{ inward_item_id: startUnloadingItem.id }],
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.status !== 200) {
        throw new Error(
          result.error || result.message || "Failed to start unloading"
        );
      }

      const updatedRow = result.data?.items?.[0];
      const startTime =
        updatedRow?.unloading_start_time ||
        new Date().toLocaleString("en-GB", { hour12: false }).replace(",", "");

      setItems((prev) =>
        prev.map((it) =>
          it.id === startUnloadingItem.id
            ? { ...it, unloading_start_time: startTime }
            : it
        )
      );

      toast({
        title: "Unloading started",
        description:
          result.message ||
          `Start time recorded for ${startUnloadingItem.item_name || "item"}.`,
        className: "bg-green-50 border-green-100 text-green-800",
      });

      setStartUnloadingDialogOpen(false);
      setStartUnloadingItem(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Could not start unloading",
        variant: "destructive",
      });
    } finally {
      setIsStartingUnloading(false);
    }
  };

  const addStackRow = (itemId) => {
    setStackRowsByItem((prev) => {
      const existing = prev[itemId] || [];
      const maxRow = existing.reduce((max, row) => {
        const num = parseInt(row.stack_number, 10);
        return Number.isFinite(num) && num > max ? num : max;
      }, 0);
      const nextRow = createEmptyStackRow(maxRow + 1);
      return {
        ...prev,
        [itemId]: [...existing, nextRow],
      };
    });
  };

  const syncUnloadedWeightFromStack = (itemId, stackRows) => {
    const formatted = formatStackTotalForWeight(getStackTotalBags(stackRows));
    setSupervisorUnloadFormByItem((prev) => ({
      ...prev,
      [itemId]: {
        status: "unloaded",
        supervisor_remarks: "",
        ...(prev[itemId] || {}),
        unloaded_weight: formatted,
      },
    }));
  };

  const removeStackRow = (itemId, rowLocalId) => {
    setStackRowsByItem((prev) => {
      const nextRows = (prev[itemId] || []).filter((row) => row.localId !== rowLocalId);
      syncUnloadedWeightFromStack(itemId, nextRows);
      return { ...prev, [itemId]: nextRows };
    });
  };

  const updateStackRow = (itemId, rowLocalId, patch) => {
    setStackRowsByItem((prev) => {
      const nextRows = (prev[itemId] || []).map((row) =>
        row.localId === rowLocalId ? { ...row, ...patch } : row
      );
      if ("bags_count" in patch) {
        syncUnloadedWeightFromStack(itemId, nextRows);
      }
      return { ...prev, [itemId]: nextRows };
    });
  };

  const uploadMediaFile = async (file) => {
    const token = AuthService.getAccessToken();
    if (!token) throw new Error("No authentication token found");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/voucher/upload-media-file/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 200) {
      throw new Error(result.message || "Failed to upload media");
    }
    return result.data?.url;
  };

  const handleStackImageSelect = async (itemId, rowLocalId, file) => {
    if (!file) return;

    if (!allowMultipleInwardImages) {
      const rows = stackRowsByItem[itemId] || [];
      const totalUploaded = rows.reduce(
        (count, row) =>
          count + row.images.filter((img) => img.url && !img.uploading).length,
        0
      );
      if (totalUploaded >= 1) {
        toast({
          title: "Single image only",
          description: "Only one stack image is allowed.",
          variant: "destructive",
        });
        return;
      }
    }

    const imageLocalId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const previewUrl = URL.createObjectURL(file);

    setStackRowsByItem((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map((row) =>
        row.localId === rowLocalId
          ? {
              ...row,
              images: [
                ...row.images,
                { localId: imageLocalId, url: "", uploading: true, previewUrl },
              ],
            }
          : row
      ),
    }));

    try {
      const url = await uploadMediaFile(file);
      setStackRowsByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] || []).map((row) =>
          row.localId === rowLocalId
            ? {
                ...row,
                images: row.images.map((img) =>
                  img.localId === imageLocalId
                    ? { ...img, url, uploading: false }
                    : img
                ),
              }
            : row
        ),
      }));
    } catch (error) {
      setStackRowsByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] || []).map((row) =>
          row.localId === rowLocalId
            ? {
                ...row,
                images: row.images.filter((img) => img.localId !== imageLocalId),
              }
            : row
        ),
      }));
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload stack image",
        variant: "destructive",
      });
    }
  };

  const removeStackImage = (itemId, rowLocalId, imageLocalId) => {
    setStackRowsByItem((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map((row) =>
        row.localId === rowLocalId
          ? {
              ...row,
              images: row.images.filter((img) => img.localId !== imageLocalId),
            }
          : row
      ),
    }));
  };

  const getSupervisorUnloadImages = (itemId) =>
    supervisorUnloadImagesByItem[itemId] || {};

  const hasUploadingSupervisorUnloadImages = (itemId) => {
    const imagesByType = getSupervisorUnloadImages(itemId);
    return enabledUnloadingImageSettings.some(({ settingKey }) =>
      (imagesByType[settingKey] || []).some((image) => image.uploading)
    );
  };

  const addSupervisorUnloadImage = async (itemId, settingKey, file) => {
    if (!file?.type?.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select only image files.",
        variant: "destructive",
      });
      return;
    }

    const existing = getSupervisorUnloadImages(itemId)[settingKey] || [];
    if (!allowMultipleInwardImages && existing.some((img) => img.url && !img.uploading)) {
      return;
    }

    const imageLocalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previewUrl = URL.createObjectURL(file);
    const newImage = {
      localId: imageLocalId,
      previewUrl,
      url: "",
      name: file.name,
      uploading: true,
    };

    setSupervisorUnloadImagesByItem((prev) => {
      const itemImages = prev[itemId] || {};
      const current = itemImages[settingKey] || [];
      const nextImages = allowMultipleInwardImages ? [...current, newImage] : [newImage];

      return {
        ...prev,
        [itemId]: {
          ...itemImages,
          [settingKey]: nextImages,
        },
      };
    });

    try {
      const url = await uploadMediaFile(file);
      setSupervisorUnloadImagesByItem((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {}),
          [settingKey]: (prev[itemId]?.[settingKey] || []).map((image) =>
            image.localId === imageLocalId
              ? { ...image, url, uploading: false, previewUrl: url }
              : image
          ),
        },
      }));
    } catch (error) {
      setSupervisorUnloadImagesByItem((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {}),
          [settingKey]: (prev[itemId]?.[settingKey] || []).filter(
            (image) => image.localId !== imageLocalId
          ),
        },
      }));
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload image",
        variant: "destructive",
      });
    }
  };

  const removeSupervisorUnloadImage = (itemId, settingKey, imageLocalId) => {
    setSupervisorUnloadImagesByItem((prev) => {
      const target = (prev[itemId]?.[settingKey] || []).find(
        (image) => image.localId === imageLocalId
      );
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return {
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {}),
          [settingKey]: (prev[itemId]?.[settingKey] || []).filter(
            (image) => image.localId !== imageLocalId
          ),
        },
      };
    });
  };

  const buildSupervisorUnloadImagesPayload = (itemId) => {
    const imagesByType = getSupervisorUnloadImages(itemId);
    return enabledUnloadingImageSettings.flatMap(({ settingKey, apiType }) =>
      (imagesByType[settingKey] || [])
        .filter((image) => image.url && !image.uploading)
        .map((image) => ({
          type: apiType,
          image: image.url,
          remarks: "",
        }))
    );
  };

  const buildStackInfoPayload = (itemId) => {
    if (!stackwiseUnloadingEnabled || !stackingOpenByItem[itemId]) return undefined;

    const rows = (stackRowsByItem[itemId] || []).filter(
      (row) => String(row.bags_count || "").trim() !== ""
    );
    if (!rows.length) return undefined;

    return rows.map((row) => {
      const imageUrls = row.images
        .filter((img) => img.url && !img.uploading)
        .map((img) => img.url);
      return {
        stack_number: Number(row.stack_number),
        bags_count: String(row.bags_count),
        ...(row.remarks?.trim() ? { remarks: row.remarks.trim() } : {}),
        ...(imageUrls.length ? { images: imageUrls } : {}),
      };
    });
  };

  const handleSupervisorUnload = async (item) => {
    if (!canSupervisorUnload) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to update unloading status.",
        variant: "destructive",
      });
      return;
    }

    if (!data?.id || !item?.id) return;

    if (!hasUnloadingStarted(item)) {
      toast({
        title: "Start unloading first",
        description: "Please start unloading before marking the item as unloaded.",
        variant: "destructive",
      });
      return;
    }

    const form = getSupervisorUnloadForm(item.id);
    const stackRows = stackRowsByItem[item.id] || [];

    if (stackingOpenByItem[item.id]) {
      const hasUploadingImage = stackRows.some((row) =>
        row.images.some((img) => img.uploading)
      );
      if (hasUploadingImage) {
        toast({
          title: "Please wait",
          description: "Stack images are still uploading.",
          variant: "destructive",
        });
        return;
      }

      const rowsWithPartialData = stackRows.filter((row) => {
        const hasBags = String(row.bags_count || "").trim() !== "";
        const hasImages = row.images?.some((img) => img.url && !img.uploading);
        return hasBags || hasImages;
      });
      if (!rowsWithPartialData.length && stackingOpenByItem[item.id]) {
        // Stacking open but nothing entered — skip stack_info (optional)
      }
    }

    if (hasUploadingSupervisorUnloadImages(item.id)) {
      toast({
        title: "Please wait",
        description: "Unloading images are still uploading.",
        variant: "destructive",
      });
      return;
    }

    const voiceReady = await voiceRemarks.waitForVoiceUploadIfNeeded();
    if (!voiceReady) return;

    const voiceUrlForSubmit = voiceRemarks.getVoiceUrlForSubmit();
    const stackInfo = buildStackInfoPayload(item.id);
    const unloadImages = buildSupervisorUnloadImagesPayload(item.id);

    const itemPayload = {
      inward_item_id: item.id,
      status: form.status || "unloaded",
      ...(form.supervisor_remarks?.trim()
        ? { supervisor_remarks: form.supervisor_remarks.trim() }
        : {}),
      ...(form.unloaded_weight !== "" && form.unloaded_weight != null
        ? { unloaded_weight: String(form.unloaded_weight) }
        : {}),
      ...(voiceUrlForSubmit ? { voice_remarks: voiceUrlForSubmit } : {}),
      ...(stackInfo ? { stack_info: stackInfo } : {}),
      ...(unloadImages.length ? { images: unloadImages } : {}),
    };

    setIsUpdating(true);
    try {
      const token = AuthService.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/report/update-inward/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inward_entry_id: data.id,
          update_type: "supervisor_update",
          items: [itemPayload],
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      const result = await response.json();
      toast({
        title: "Success",
        description: result.message || "Item marked as unloaded successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update unloading status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = (item) => {
    voiceRemarks.clearVoiceRemarks();
    setSelectedItem(item);
    setNewStatus("approved");
    setUpdateType("admin_approval");
    setIsStatusModalOpen(true);
  };

  const handleReject = (item) => {
    voiceRemarks.clearVoiceRemarks();
    setSelectedItem(item);
    setNewStatus("rejected");
    setUpdateType("admin_approval");
    setIsStatusModalOpen(true);
  };

  const handleAssignSupervisor = async (item) => {
    // console.log("Assign supervisor clicked for item:", item);
    // console.log("Selected supervisor:", selectedSupervisor);
    // console.log("Selected godown:", selectedGodown);

    // Check if user has inward assignment access with 'c' or 'r' permission
    if (!hasInwardAssignmentAccess) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to assign supervisor and godown.",
        variant: "destructive",
      });
      return;
    }

    // Check if required data is loaded
    if (!users || users.length === 0) {
      toast({
        title: "Error",
        description: "Supervisors data is not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!godowns || godowns.length === 0) {
      toast({
        title: "Error",
        description: "Godowns data is not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    // Check if supervisor and godown are selected
    if (!selectedSupervisor) {
      toast({
        title: "Error",
        description: "Please select a supervisor.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedGodown) {
      toast({
        title: "Error",
        description: "Please select a godown.",
        variant: "destructive",
      });
      return;
    }

    setSelectedItem(item);
    setNewStatus("not_unloaded");
    setUpdateType("assign_supervisor");

    await handleStatusSubmit({
      item,
      updateType: "assign_supervisor",
      newStatus: "not_unloaded",
    });
  };

  const handleFinalCompletion = async (item) => {
    setSelectedItem(item);
    setUpdateType("final_completion");
    await handleStatusSubmit({
      item,
      updateType: "final_completion",
    });
  };

  // Post-testing handler functions
  const handlePostTestParamToggle = (itemId, paramId) => {
    const currentSelected = selectedPostTestParams[itemId] || [];
    const isSelected = currentSelected.includes(paramId);

    let updatedSelected;
    if (isSelected) {
      // Remove parameter
      updatedSelected = currentSelected.filter(id => id !== paramId);
      // Remove from values and remarks
      setPostTestValues(prev => {
        const newValues = { ...prev };
        delete newValues[`${itemId}_${paramId}`];
        return newValues;
      });
      setPostTestRemarks(prev => {
        const newRemarks = { ...prev };
        delete newRemarks[`${itemId}_${paramId}`];
        return newRemarks;
      });
      setPostTestImages(prev => {
        const newImages = { ...prev };
        delete newImages[`${itemId}_${paramId}`];
        return newImages;
      });
      setPostTestBreakdowns(prev => {
        const newBreakdowns = { ...prev };
        delete newBreakdowns[`${itemId}_${paramId}`];
        return newBreakdowns;
      });
    } else {
      // Add parameter
      updatedSelected = [...currentSelected, paramId];
      // If a breakdown is selected for this item, automatically assign it to this parameter
      const selectedBreakdown = selectedBreakdownForTesting[itemId];
      if (selectedBreakdown && selectedBreakdown !== "null" && selectedBreakdown !== "") {
        setPostTestBreakdowns(prev => ({
          ...prev,
          [`${itemId}_${paramId}`]: parseInt(selectedBreakdown)
        }));
      }
    }

    setSelectedPostTestParams(prev => ({
      ...prev,
      [itemId]: updatedSelected
    }));
  };

  const handleBreakdownForTestingChange = (itemId, breakdownId) => {
    setSelectedBreakdownForTesting(prev => ({
      ...prev,
      [itemId]: breakdownId
    }));

    // Update all existing selected parameters to use this breakdown
    const currentSelected = selectedPostTestParams[itemId] || [];
    if (currentSelected.length > 0) {
      const newBreakdowns = { ...postTestBreakdowns };
      currentSelected.forEach(paramId => {
        if (breakdownId === "null" || breakdownId === "") {
          delete newBreakdowns[`${itemId}_${paramId}`];
        } else {
          newBreakdowns[`${itemId}_${paramId}`] = parseInt(breakdownId);
        }
      });
      setPostTestBreakdowns(newBreakdowns);
    }
  };

  const handlePostTestValueChange = (itemId, paramId, breakdownId, value) => {
    const key = breakdownId === null || breakdownId === "null"
      ? `${itemId}_${paramId}_null`
      : `${itemId}_${paramId}_${breakdownId}`;
    setPostTestValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePostTestRemarksChange = (itemId, paramId, breakdownId, remarks) => {
    const key = breakdownId === null || breakdownId === "null"
      ? `${itemId}_${paramId}_null`
      : `${itemId}_${paramId}_${breakdownId}`;
    setPostTestRemarks(prev => ({
      ...prev,
      [key]: remarks
    }));
  };

  const handlePostTestImageChange = async (itemId, paramId, breakdownId, file) => {
    if (!file) return;

    const key = breakdownId === null || breakdownId === "null"
      ? `${itemId}_${paramId}_null`
      : `${itemId}_${paramId}_${breakdownId}`;

    setPostTestImageUploading((prev) => ({ ...prev, [key]: true }));

    try {
      const url = await uploadMediaFile(file);
      setPostTestImages((prev) => ({
        ...prev,
        [key]: url,
      }));
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload lab test image",
        variant: "destructive",
      });
    } finally {
      setPostTestImageUploading((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const getPostTestValue = (itemId, paramId, breakdownId) => {
    const key = breakdownId === null || breakdownId === "null"
      ? `${itemId}_${paramId}_null`
      : `${itemId}_${paramId}_${breakdownId}`;
    return postTestValues[key] || "";
  };

  const getPostTestRemarks = (itemId, paramId, breakdownId) => {
    const key = breakdownId === null || breakdownId === "null"
      ? `${itemId}_${paramId}_null`
      : `${itemId}_${paramId}_${breakdownId}`;
    return postTestRemarks[key] || "";
  };

  const getPostTestImage = (itemId, paramId, breakdownId) => {
    const key = breakdownId === null || breakdownId === "null"
      ? `${itemId}_${paramId}_null`
      : `${itemId}_${paramId}_${breakdownId}`;
    return postTestImages[key] || null;
  };

  const isPostTestImageUploading = (itemId, paramId, breakdownId) => {
    const key = breakdownId === null || breakdownId === "null"
      ? `${itemId}_${paramId}_null`
      : `${itemId}_${paramId}_${breakdownId}`;
    return Boolean(postTestImageUploading[key]);
  };

  // Popup handlers (similar to add inward)
  const handleOpenLabTestPopup = (itemId) => {
    setIsLabTestPopupOpen(prev => ({
      ...prev,
      [itemId]: true
    }));

    // Find the item
    const item = items.find(i => i.id === itemId);
    const isPostTesting = item && (item.status === 'unloaded' || item.status === 'unloaded_but_rejected');

    // For post testing, check if item has item_group_id from response
    let defaultItemGroup = null;
    if (isPostTesting && item) {
      // Check for item_group_id or item_group in response
      const itemGroupId = item.item_group_id || (item.item_group && item.item_group.item_group_id);
      if (itemGroupId && itemGroups.length > 0) {
        // Find the item group from the fetched list
        defaultItemGroup = itemGroups.find(g => g.id === itemGroupId);
      }
    }

    // Initialize popup state for this item
    setPopupSelectedItemGroup(prev => ({
      ...prev,
      [itemId]: defaultItemGroup
    }));
    setPopupSelectedParams(prev => ({
      ...prev,
      [itemId]: []
    }));

    // Set default test type
    setPopupSelectedTestType(prev => ({
      ...prev,
      [itemId]: isPostTesting ? "post_test" : "all"
    }));
  };

  const handleCloseLabTestPopup = (itemId) => {
    setIsLabTestPopupOpen(prev => ({
      ...prev,
      [itemId]: false
    }));
  };

  const handlePopupItemGroupChange = (itemId, itemGroup) => {
    setPopupSelectedItemGroup(prev => ({
      ...prev,
      [itemId]: itemGroup
    }));
    // Clear selected params when item group changes
    setPopupSelectedParams(prev => ({
      ...prev,
      [itemId]: []
    }));
    // Automatically set to "post_test" when item group is selected and status is "unloaded"
    const item = items.find(i => i.id === itemId);
    if (itemGroup && item && (item.status === 'unloaded' || item.status === 'unloaded_but_rejected')) {
      setPopupSelectedTestType(prev => ({
        ...prev,
        [itemId]: "post_test"
      }));
    } else if (!itemGroup) {
      setPopupSelectedTestType(prev => ({
        ...prev,
        [itemId]: "all"
      }));
    }
  };

  const handlePopupParamToggle = (itemId, paramId) => {
    const currentSelected = popupSelectedParams[itemId] || [];
    const isSelected = currentSelected.includes(paramId);

    if (isSelected) {
      setPopupSelectedParams(prev => ({
        ...prev,
        [itemId]: currentSelected.filter(id => id !== paramId)
      }));
    } else {
      setPopupSelectedParams(prev => ({
        ...prev,
        [itemId]: [...currentSelected, paramId]
      }));
    }
  };

  const handleApplyLabTestSelection = (itemId) => {
    const selectedParams = popupSelectedParams[itemId] || [];
    const currentSelected = selectedPostTestParams[itemId] || [];

    // Get newly added parameters (not in current selection)
    const newlyAdded = selectedParams.filter(paramId => !currentSelected.includes(paramId));

    // Update the main form with selected parameters
    setSelectedPostTestParams(prev => ({
      ...prev,
      [itemId]: selectedParams
    }));

    // If a breakdown is selected, assign it to newly added parameters
    const selectedBreakdown = selectedBreakdownForTesting[itemId];
    if (selectedBreakdown && selectedBreakdown !== "null" && selectedBreakdown !== "" && newlyAdded.length > 0) {
      const newBreakdowns = { ...postTestBreakdowns };
      newlyAdded.forEach(paramId => {
        newBreakdowns[`${itemId}_${paramId}`] = parseInt(selectedBreakdown);
      });
      setPostTestBreakdowns(newBreakdowns);
    }

    // Close popup
    handleCloseLabTestPopup(itemId);
  };

  // Get filtered lab test parameters for popup
  const getFilteredLabTestParams = (itemId) => {
    const selectedItemGroup = popupSelectedItemGroup[itemId];
    const selectedTestType = popupSelectedTestType[itemId] || "all";

    let filtered = postTestParams;

    // First filter by item group if selected
    if (selectedItemGroup) {
      filtered = filtered.filter(param =>
        param.item_groups && param.item_groups.some(group => group.id === selectedItemGroup.id)
      );
    }

    // Then filter by test type if selected
    if (selectedTestType && selectedTestType !== "all") {
      filtered = filtered.filter(param => {
        if (!param.test_type) return false;
        // Filter based on test_type field
        if (selectedTestType === "pre_test") {
          return param.test_type === "pre_test" || param.test_type === "both";
        } else if (selectedTestType === "post_test") {
          return param.test_type === "post_test" || param.test_type === "both";
        }
        return true;
      });
    }

    return filtered;
  };

  // Get validation status for parameters
  const getValidationStatus = (param) => {
    if (param.is_validation_required) {
      return { status: "required", text: "Validation Required", icon: AlertTriangle, color: "text-orange-500" };
    }
    return { status: "optional", text: "Optional", icon: CheckCircle, color: "text-green-500" };
  };

  const handleStatusSubmit = async (submitOptions = {}) => {
    const activeItem = submitOptions.item ?? selectedItem;
    const activeUpdateType = submitOptions.updateType ?? updateType;
    const activeNewStatus = submitOptions.newStatus ?? newStatus;

    if (!activeItem || !data) return;

    const voiceReady = await voiceRemarks.waitForVoiceUploadIfNeeded();
    if (!voiceReady) return;

    const voiceUrlForSubmit = voiceRemarks.getVoiceUrlForSubmit();
    const voicePayload = voiceUrlForSubmit ? { voice_remarks: voiceUrlForSubmit } : {};

    setIsUpdating(true);
    try {
      const isCompletionMode =
        (completionChoiceByItem[activeItem.id] || "retest") === "complete";

      const resolveLabTestType = (param) => {
        if (param?.test_type === "pre_test") return "pre_testing";
        if (param?.test_type === "post_test") return "post_testing";
        if (popupSelectedTestType[activeItem.id] === "pre_test") return "pre_testing";
        return "post_testing";
      };

      // Validate countable post-test parameters:
      // for selected item group, sum of is_countable=true params must be exactly 100
      // for each selected context (Main Item and each selected breakdown).
      // Skip this when saving pre-test / re-test only (do not mark completed).
      if (activeUpdateType === "final_completion" && isCompletionMode) {
        const selectedGroupIdRaw =
          popupSelectedItemGroup[activeItem.id]?.id ??
          activeItem.item_group_id ??
          activeItem.item_group?.item_group_id ??
          null;
        const selectedGroupId = Number(selectedGroupIdRaw);

        const selectedParamIds = selectedPostTestParams[activeItem.id] || [];
        const selectedBreakdowns = selectedBreakdownForTesting[activeItem.id] || [];

        // Build contexts to validate: "null" (Main Item) and selected breakdown IDs
        const contexts = selectedBreakdowns.filter((ctx) => ctx === "null" || ctx === null || ctx === "" || Number.isFinite(Number(ctx)));

        // If user selected parameters but no context, default to Main Item validation
        const contextsToCheck = contexts.length > 0 ? contexts : ["null"];

        if (Number.isFinite(selectedGroupId) && selectedGroupId > 0 && selectedParamIds.length > 0) {
          const countableParamIds = selectedParamIds.filter((paramId) => {
            const param = postTestParams.find((p) => p.id === paramId);
            if (!param || param.is_countable !== true) return false;
            return Array.isArray(param.item_groups) && param.item_groups.some((g) => Number(g.id) === selectedGroupId);
          });

          if (countableParamIds.length > 0) {
            for (const context of contextsToCheck) {
              const isMainContext = context === "null" || context === null || context === "";
              const label = isMainContext ? "Main Item" : `Breakdown ${context}`;

              const values = countableParamIds.map((paramId) => {
                const value = getPostTestValue(
                  activeItem.id,
                  paramId,
                  isMainContext ? null : Number(context)
                );
                return String(value ?? "").trim();
              });

              const hasInvalidOrEmpty = values.some((raw) => raw === "" || Number.isNaN(parseFloat(raw)));
              if (hasInvalidOrEmpty) {
                toast({
                  title: "Validation Error",
                  description: `${label}: Enter numeric values for all countable parameters.`,
                  variant: "destructive",
                });
                setIsUpdating(false);
                return;
              }

              const total = values.reduce((sum, raw) => sum + parseFloat(raw), 0);
              if (Math.abs(total - 100) > 0.001) {
                toast({
                  title: "Validation Error",
                  description: `${label}: Countable parameters total is ${total}%. It must be exactly 100%.`,
                  variant: "destructive",
                });
                setIsUpdating(false);
                return;
              }
            }
          }
        }
      }

      const updateData = {
        inward_entry_id: data.id,
        update_type: activeUpdateType,
        items: [
          {
            inward_item_id: activeItem.id,
            ...voicePayload,
            ...(activeUpdateType === 'admin_approval' && {
              status: activeNewStatus,
              ...(activeNewStatus === 'approved' && {
                our_brand: ourBrand,
                remarks: remarks
              }),
              ...(activeNewStatus === 'rejected' && {
                remarks: rejectionReason
              })
            }),
            ...(activeUpdateType === 'assign_supervisor' && {
              supervisor_id: selectedSupervisor,
              godown_id: selectedGodown,
              lab_tech_remarks: labTechRemarks || ""
            }),
            ...(activeUpdateType === 'final_completion' && {
              complete_item: isCompletionMode,
              lab_tests: (() => {
                const labTests = [];
                const selectedParams = selectedPostTestParams[activeItem.id] || [];
                const breakdowns = activeItem.weight_breakdowns || [];

                // For each parameter
                selectedParams.forEach(paramId => {
                  const param = postTestParams.find(p => p.id === paramId);
                  if (!param) return;

                  const selectedBreakdowns = selectedBreakdownForTesting[activeItem.id] || [];

                  // Add test for main item (null breakdown) if selected and value exists
                  if (selectedBreakdowns.includes("null")) {
                    const mainValue = getPostTestValue(activeItem.id, paramId, null);
                    if (mainValue) {
                      labTests.push({
                        test_param_id: paramId,
                        value: mainValue,
                        remarks: getPostTestRemarks(activeItem.id, paramId, null) || "",
                        breakdown_id: null,
                        test_type: resolveLabTestType(param),
                        ...(param?.is_image_required && getPostTestImage(activeItem.id, paramId, null) && {
                          image: getPostTestImage(activeItem.id, paramId, null)
                        })
                      });
                    }
                  }

                  // Add test for each selected breakdown if value exists
                  breakdowns
                    .filter(breakdown => selectedBreakdowns.includes(breakdown.id.toString()))
                    .forEach(breakdown => {
                      const breakdownValue = getPostTestValue(activeItem.id, paramId, breakdown.id);
                      if (breakdownValue) {
                        labTests.push({
                          test_param_id: paramId,
                          value: breakdownValue,
                          remarks: getPostTestRemarks(activeItem.id, paramId, breakdown.id) || "",
                          breakdown_id: breakdown.id,
                          test_type: resolveLabTestType(param),
                          ...(param?.is_image_required && getPostTestImage(activeItem.id, paramId, breakdown.id) && {
                            image: getPostTestImage(activeItem.id, paramId, breakdown.id)
                          })
                        });
                      }
                    });
                });

                return labTests;
              })()
            })
          }
        ]
      };

      // console.log("Sending update data:", updateData);

      const response = await fetch(`${API_BASE_URL}/api/report/update-inward/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) throw new Error("Failed to update");

      const result = await response.json();

      toast({
        title: "✅ Success",
        description: result.message || "Inward entry updated successfully",
        className: "bg-green-50 border-green-100 text-green-800",
      });

      // Refresh the data
      window.location.reload();

      voiceRemarks.clearVoiceRemarks();

      // Close modal and reset form
      setIsStatusModalOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Error in updating inward entry",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchGodowns();
    fetchUsers();
  }, []);
  const fetchGodowns = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-godowns/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch godowns");
      const data = await response.json();
      // console.log("Godowns data:", data);
      setGodowns(data.data);
      if (data.data && data.data.length > 0) setSelectedGodown(data.data[0].id.toString());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-users/?type=loading_unloading`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      // console.log("Users data:", data);
      setUsers(data.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {

    }
  };


  const handleGodownChange = (value) => {
    const godown = godowns.find(g => g.name === value);
    setSelectedGodown(godown.id);
    //alert(godown.id);
  };

  const handleUserChange = (value) => {
    const user = users.find(u => u.name === value);
    setSelectedUser(user.user_id);
    //alert(user.user_id);
  };

  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'unloaded':
        return 'outline';
      case 'completed':
        return 'default';
      default:
        return 'outline';
    }
  };

  // Check permissions before rendering
  if (permissionsLoading) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        <div className="app-main-content flex items-center justify-center">
          <CommonLoader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  // Check if user has read permission for inward
  if (!hasReadPermission("inward")) {
    return (
      <div className="app-layout bg-gray-50">
        {!isMobile && <Sidebar />}
        <div className="app-main-content flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view inward details.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <CommonLoader text="Loading inward details..." />;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!data) return <div className="p-6">No data found</div>;

  const capitalizeFirst = (str) => {
    if (!str) return "";
    // Split by underscore, capitalize each word, and join with space
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  const PDF_LANGUAGES = [
    { code: "en", label: "English" },
    { code: "kn", label: "Kannada (ಕನ್ನಡ)" },
    { code: "hi", label: "Hindi (हिंदी)" },
    { code: "gu", label: "Gujarati (ગુજરાતી)" },
  ];

  // PDF Generation function with proper page breaks
  const generatePDF = async (language = "en") => {
    setIsGeneratingPDF(true);
    try {
      // Dynamically import jsPDF
      const { default: jsPDF } = await import('jspdf');

      // Validate data exists
      if (!data) {
        throw new Error('No data available to generate PDF');
      }

      const PDF_TEXT = {
        en: {
          title: "INWARD ENTRY DETAILS",
          entry: "Entry",
          generatedBy: "Generated by",
          downloaded: "Inward entry details have been downloaded as PDF",
          poDate: "PO Date:",
          party: "Party:",
          partyName: "Party Name:",
          vehicle: "Vehicle:",
          billNo: "Bill No:",
          itemsCount: "Items:",
          bags: "Quantity",
          weight: "Weight:",
          driver: "Driver:",
          broker: "Broker:",
          driverPhone: "Driver Phone:",
          supervisor: "Supervisor",
          verifiedBy: "Verified By:",
          remarks: "FINAL REMARKS:",
          itemsTitle: "ITEMS",
          supplierBrand: "Supplier Brand",
          ourBrand: "Our Brand",
          quality: "Quality",
          totalWeight: "Total Weight",
          netWeight: "Net Weight",
          godown: "Godown",
          jaliTitle: "JALI DETAILS",
          gross: "Gross:",
          tare: "Tare:",
          net: "Net:",
          jaliNumber: "JALI Number:",
          weightType: "Weight Type:",
          testParamsTitle: "LAB TEST PARAMETERS",
          imagesTitle: "IMAGES",
          weightBreakdowns: "UNLOADING QUALITY DETAILS",
          statusType: "Status Type",
          quantity: "Quantity",
          weightCol: "Weight",
          remarksCol: "Remarks",
          parameter: "Parameter",
          preTesting: "Pre-Testing",
          postTesting: "Post-Testing",
          postTestingBreakdowns: "Post-Testing (Breakdowns)",
          postTestingMain: "Post-Testing (Main Item)",
          difference: "Difference",
          value: "Value",
          statusCol: "Status",
          weighmentTitle: "WEIGHMENT DETAILS",
          grossWeight: "Gross Weight:",
          tareWeight: "Tare Weight:",
          partyGrossWeight: "Party Gross Weight:",
          partyTareWeight: "Party Tare Weight:",
          ourWeight: "Our Weight",
          partyWeight: "Party Weight",
          freightTitle: "FREIGHT DETAILS",
          freightAmount: "Amount:",
          inwardInfoTitle: "INWARD INFORMATION",
          testedBy: "Pre Sample Tested By:",
          testedDate: "Pre Sample Tested Date:",
          actionBy: "Approved / Rejected By:",
          actionDate: "Approved / Rejected Action Date:",
          unloadedBy: "Unloaded By:",
          unloadedDate: "Unloaded Date:",
          postTestedBy: "Post Sample Tested By:",
          postTestedDate: "Post Sample Tested Date:",
          reTestedBy: "Re Tested By:",
          reTestingDate: "Re Testing Date:",
          itemRemarksTitle: "REMARKS",
          remarkLabTech: "Lab Tech",
          remarkAdmin: "Admin",
          remarkAssignment: "Assignment",
          remarkSupervisor: "Supervisor",
          remarkFinal: "Final",
        },
        hi: {
          title: "इनवर्ड एंट्री विवरण",
          entry: "एंट्री",
          generatedBy: "द्वारा जनरेट",
          downloaded: "चयनित भाषा में पीडीएफ डाउनलोड हो गई",
          poDate: "पीओ दिनांक:",
          party: "पार्टी:",
          partyName: "पार्टी नाम:",
          vehicle: "वाहन:",
          billNo: "बिल नं:",
          itemsCount: "आइटम:",
          bags: "बैग:",
          weight: "वजन:",
          driver: "ड्राइवर:",
          broker: "ब्रोकर:",
          driverPhone: "ड्राइवर फोन:",
          supervisor: "सुपरवाइज़र:",
          verifiedBy: "सत्यापित द्वारा:",
          remarks: "टिप्पणी:",
          itemsTitle: "आइटम्स",
          supplierBrand: "सप्लायर ब्रांड:",
          ourBrand: "हमारा ब्रांड:",
          quality: "गुणवत्ता:",
          totalWeight: "कुल वजन:",
          netWeight: "शुद्ध वजन:",
          godown: "गोदाम:",
          jaliTitle: "जाली विवरण",
          gross: "ग्रॉस:",
          tare: "टेयर:",
          net: "नेट:",
          jaliNumber: "जाली नंबर:",
          weightType: "वजन प्रकार:",
          testParamsTitle: "लैब टेस्ट पैरामीटर्स",
          imagesTitle: "छवियां",
          weightBreakdowns: "वजन विभाजन:",
          statusType: "स्थिति प्रकार",
          quantity: "मात्रा",
          weightCol: "वजन",
          remarksCol: "टिप्पणी",
          parameter: "पैरामीटर",
          preTesting: "पूर्व परीक्षण",
          postTesting: "पश्च परीक्षण",
          postTestingBreakdowns: "पश्च परीक्षण (विभाजन)",
          postTestingMain: "पश्च परीक्षण (मुख्य वस्तु)",
          difference: "अंतर",
          value: "मान",
          statusCol: "स्थिति",
          weighmentTitle: "तौल विवरण",
          grossWeight: "ग्रॉस वजन:",
          tareWeight: "टेयर वजन:",
          inwardInfoTitle: "इनवर्ड जानकारी",
          testedBy: "परीक्षणकर्ता:",
          testedDate: "परीक्षण दिनांक:",
          actionBy: "कार्रवाई द्वारा:",
          actionDate: "कार्रवाई दिनांक:",
          unloadedBy: "उतारा गया:",
          unloadedDate: "उतारने की तारीख:",
          postTestedBy: "पोस्ट परीक्षणकर्ता:",
          postTestedDate: "पोस्ट परीक्षण दिनांक:",
          reTestedBy: "पुन: परीक्षणकर्ता:",
          reTestingDate: "पुन: परीक्षण दिनांक:",
          itemRemarksTitle: "टिप्पणियाँ",
          remarkLabTech: "लैब तकनीशियन",
          remarkAdmin: "एडमिन",
          remarkAssignment: "असाइनमेंट",
          remarkSupervisor: "सुपरवाइज़र",
          remarkFinal: "अंतिम",
        },
        kn: {
          title: "ಒಳಸರಾವು ದಾಖಲೆಯ ವಿವರಗಳು",
          entry: "ದಾಖಲೆ ಸಂಖ್ಯೆ",
          generatedBy: "ರಚಿಸಿದವರು",
          downloaded: "ಆಯ್ಕೆ ಮಾಡಿದ ಭಾಷೆಯಲ್ಲಿ ಪಿಡಿಎಫ್ ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ",
          poDate: "ಖರೀದಿ ಆದೇಶ ದಿನಾಂಕ:",
          party: "ಪಕ್ಷ:",
          partyName: "ಪಕ್ಷದ ಹೆಸರು:",
          vehicle: "ವಾಹನ ಸಂಖ್ಯೆ:",
          billNo: "ಬಿಲ್ ಸಂಖ್ಯೆ:",
          itemsCount: "ವಸ್ತುಗಳ ಸಂಖ್ಯೆ:",
          bags: "ಪ್ರಮಾಣ:",
          weight: "ಒಟ್ಟು ತೂಕ:",
          driver: "ಚಾಲಕ:",
          broker: "ದಲ್ಲಾಳ:",
          driverPhone: "ಚಾಲಕ ದೂರವಾಣಿ:",
          supervisor: "ಮೇಲ್ವಿಚಾರಕ:",
          verifiedBy: "ಪರಿಶೀಲಿಸಿದವರು:",
          remarks: "ಟಿಪ್ಪಣಿ:",
          itemsTitle: "ವಸ್ತುಗಳ ವಿವರ",
          supplierBrand: "ಪೂರೈಕೆದಾರ ಬ್ರ್ಯಾಂಡ್:",
          ourBrand: "ನಮ್ಮ ಬ್ರ್ಯಾಂಡ್:",
          quality: "ಗುಣಮಟ್ಟ:",
          totalWeight: "ಒಟ್ಟು ತೂಕ:",
          netWeight: "ನಿವ್ವಳ ತೂಕ:",
          godown: "ಗೋದಾಮು:",
          jaliTitle: "ಜಾಲಿ ವಿವರಗಳು",
          gross: "ಒಟ್ಟು ತೂಕ:",
          tare: "ಖಾಲಿ ತೂಕ:",
          net: "ನಿವ್ವಳ ತೂಕ:",
          jaliNumber: "ಜಾಲಿ ಸಂಖ್ಯೆ:",
          weightType: "ತೂಕದ ಪ್ರಕಾರ:",
          testParamsTitle: "ಪ್ರಯೋಗಾಲಯ ಪರೀಕ್ಷಾ ಪರಿಮಾಣಗಳು",
          imagesTitle: "ಚಿತ್ರಗಳು",
          weightBreakdowns: "ತೂಕ ವಿಭಜನೆ:",
          statusType: "ಸ್ಥಿತಿ ಪ್ರಕಾರ",
          quantity: "ಪ್ರಮಾಣ",
          weightCol: "ತೂಕ",
          remarksCol: "ಟಿಪ್ಪಣಿಗಳು",
          parameter: "ಪರಿಮಾಣ",
          preTesting: "ಪೂರ್ವ ಪರೀಕ್ಷೆ",
          postTesting: "ನಂತರದ ಪರೀಕ್ಷೆ",
          postTestingBreakdowns: "ನಂತರದ ಪರೀಕ್ಷೆ (ವಿಭಜನೆ)",
          postTestingMain: "ನಂತರದ ಪರೀಕ್ಷೆ (ಮುಖ್ಯ ವಸ್ತು)",
          difference: "ವ್ಯತ್ಯಾಸ",
          value: "ಮೌಲ್ಯ",
          statusCol: "ಸ್ಥಿತಿ",
          weighmentTitle: "ತೂಕದ ವಿವರಗಳು",
          grossWeight: "ಒಟ್ಟು ತೂಕ:",
          tareWeight: "ಟೇರ್ ತೂಕ:",
          inwardInfoTitle: "ಒಳಸರಾವು ಮಾಹಿತಿ",
          testedBy: "ಪರೀಕ್ಷಿಸಿದವರು:",
          testedDate: "ಪರೀಕ್ಷಾ ದಿನಾಂಕ:",
          actionBy: "ಕ್ರಮ ತೆಗೆದುಕೊಂಡವರು:",
          actionDate: "ಕ್ರಮ ದಿನಾಂಕ:",
          unloadedBy: "ಇಳಿಸಿದವರು:",
          unloadedDate: "ಇಳಿಸಿದ ದಿನಾಂಕ:",
          postTestedBy: "ನಂತರದ ಪರೀಕ್ಷಿಸಿದವರು:",
          postTestedDate: "ನಂತರದ ಪರೀಕ್ಷಾ ದಿನಾಂಕ:",
          reTestedBy: "ಮರು ಪರೀಕ್ಷಿಸಿದವರು:",
          reTestingDate: "ಮರು ಪರೀಕ್ಷಾ ದಿನಾಂಕ:",
          itemRemarksTitle: "ಟಿಪ್ಪಣಿಗಳು",
          remarkLabTech: "ಲ್ಯಾಬ್ ತಂತ್ರಜ್ಞ",
          remarkAdmin: "ನಿರ್ವಾಹಕ",
          remarkAssignment: "ನಿಯೋಜನೆ",
          remarkSupervisor: "ಮೇಲ್ವಿಚಾರಕ",
          remarkFinal: "ಅಂತಿಮ",
        },
        gu: {
          title: "ઇનવર્ડ એન્ટ્રી વિગતો",
          entry: "એન્ટ્રી",
          generatedBy: "દ્વારા બનાવેલ",
          downloaded: "પસંદ કરેલી ભાષામાં PDF ડાઉનલોડ થઈ ગઈ",
          poDate: "પી.ઓ. તારીખ:",
          party: "પાર્ટી:",
          partyName: "પાર્ટી નામ:",
          vehicle: "વાહન:",
          billNo: "બિલ નં:",
          itemsCount: "આઇટમ્સ:",
          bags: "બેગ્સ:",
          weight: "વજન:",
          driver: "ડ્રાઇવર:",
          broker: "બ્રોકર:",
          driverPhone: "ડ્રાઇવર ફોન:",
          supervisor: "સુપરવાઇઝર:",
          verifiedBy: "ચકાસનાર:",
          remarks: "ટિપ્પણી:",
          itemsTitle: "આઇટમ્સ",
          supplierBrand: "સપ્લાયર બ્રાન્ડ:",
          ourBrand: "અમારો બ્રાન્ડ:",
          quality: "ગુણવત્તા:",
          totalWeight: "કુલ વજન:",
          netWeight: "શુદ્ધ વજન:",
          godown: "ગોડાઉન:",
          jaliTitle: "જાળી વિગતો",
          gross: "ગ્રોસ:",
          tare: "ટેર:",
          net: "નેટ:",
          jaliNumber: "જાળી નંબર:",
          weightType: "વજન પ્રકાર:",
          testParamsTitle: "લેબ ટેસ્ટ પેરામીટર્સ",
          imagesTitle: "છબીઓ",
          weightBreakdowns: "વજન વિભાજન:",
          statusType: "સ્થિતિ પ્રકાર",
          quantity: "જથ્થો",
          weightCol: "વજન",
          remarksCol: "ટિપ્પણી",
          parameter: "પરિમાણ",
          preTesting: "પૂર્વ પરીક્ષણ",
          postTesting: "પછીની પરીક્ષણ",
          postTestingBreakdowns: "પછીની પરીક્ષણ (વિભાજન)",
          postTestingMain: "પછીની પરીક્ષણ (મુખ્ય વસ્તુ)",
          difference: "તફાવત",
          value: "મૂલ્ય",
          statusCol: "સ્થિતિ",
          weighmentTitle: "વજન વિગતો",
          grossWeight: "ગ્રોસ વજન:",
          tareWeight: "ટેર વજન:",
          inwardInfoTitle: "ઇનવર્ડ માહિતી",
          testedBy: "પરીક્ષણ કરનાર:",
          testedDate: "પરીક્ષણ તારીખ:",
          actionBy: "ક્રિયા કરનાર:",
          actionDate: "ક્રિયા તારીખ:",
          unloadedBy: "ઉતારનાર:",
          unloadedDate: "ઉતારવાની તારીખ:",
          postTestedBy: "પોસ્ટ પરીક્ષણ કરનાર:",
          postTestedDate: "પોસ્ટ પરીક્ષણ તારીખ:",
          reTestedBy: "ફરી પરીક્ષણ કરનાર:",
          reTestingDate: "ફરી પરીક્ષણ તારીખ:",
          itemRemarksTitle: "ટિપ્પણીઓ",
          remarkLabTech: "લેબ ટેક",
          remarkAdmin: "એડમિન",
          remarkAssignment: "સોંપણી",
          remarkSupervisor: "સુપરવાઇઝર",
          remarkFinal: "અંતિમ",
        },
      };
      let L = PDF_TEXT[language] || PDF_TEXT.en;

      const translationCache = new Map();
      const translateKeepNumbers = async (value) =>
        translatePdfKeepNumbers(value, language, translationCache);
      const formatPdfWeight = async (weight, unit, fallbackUnit = "Qtl") => {
        const text = formatTotalWeightDisplay(weight, unit, fallbackUnit);
        return language === "en" ? text : translateKeepNumbers(String(text));
      };
      const formatPdfItemWeight = async (totalWeight, alternateUnit) => {
        const text = formatInwardItemTotalWeightDisplay(totalWeight, alternateUnit);
        return language === "en" ? text : translateKeepNumbers(String(text));
      };
      const translateDeep = async (value) => {
        if (value == null) return value;
        if (typeof value === "string") return translateKeepNumbers(value);
        if (Array.isArray(value)) {
          const arr = [];
          for (const item of value) arr.push(await translateDeep(item));
          return arr;
        }
        if (typeof value === "object") {
          const out = {};
          for (const [k, v] of Object.entries(value)) out[k] = await translateDeep(v);
          return out;
        }
        return value;
      };

      const rawData = data || {};
      const pdfData = language === "en" ? data : await translateDeep(data);
      const pdfItems = language === "en" ? items : await translateDeep(items);
      const pdfJaliDetails = language === "en" ? jaliDetails : await translateDeep(jaliDetails);
      const pdfLabTestParams = language === "en" ? labTestParams : await translateDeep(labTestParams);
      const pdfImages = language === "en" ? images : await translateDeep(images);

      // Load organization/branch from cache or dashboard API
      let orgName = getOrgInfoSync()?.organization || '';
      let branchName = getOrgInfoSync()?.branch || '';
      if (!orgName || !branchName) {
        const fetched = await fetchOrgInfo();
        orgName = fetched?.organization || orgName;
        branchName = fetched?.branch || branchName;
      }
      // Keep these header values stable to ensure they always render in all languages.
      orgName = String(orgName || rawData?.organization_name || rawData?.organization_info?.name || "").trim();
      branchName = String(branchName || rawData?.branch_name || "").trim();

      // Get user name from localStorage (cp_manager_user_data)
      let generatedBy = '';
      try {
        const userDataStr = localStorage.getItem('cp_manager_user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          generatedBy = userData?.name || '';
        }
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
      }

      // Initialize PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      // Darker table borders/headers for print clarity (PDF only)
      pdf.setLineWidth(0.4);
      const PDF_TABLE_BORDER = [40, 40, 40];
      const PDF_TABLE_HEADER_FILL = [140, 140, 140];
      let effectiveLanguage = language;
      let unicodeFontFamily = null;
      let lastRequestedStyle = "normal";
      const originalSetFont = pdf.setFont.bind(pdf);
      const originalText = pdf.text.bind(pdf);
      const originalSplitTextToSize = pdf.splitTextToSize.bind(pdf);
      const unicodeFontConfig = {
        hi: { fileName: "NotoSansDevanagari-Regular.ttf", family: "NotoSansDevanagari", url: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf" },
        kn: { fileName: "NotoSansKannada-Regular.ttf", family: "NotoSansKannada", url: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansKannada/NotoSansKannada-Regular.ttf" },
        gu: { fileName: "NotoSansGujarati-Regular.ttf", family: "NotoSansGujarati", url: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansGujarati/NotoSansGujarati-Regular.ttf" },
      };
      if (effectiveLanguage !== "en" && unicodeFontConfig[effectiveLanguage]) {
        try {
          const cfg = unicodeFontConfig[effectiveLanguage];
          const response = await fetch(cfg.url);
          if (!response.ok) {
            throw new Error(`Font download failed with status ${response.status}`);
          }
          const fontBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(fontBuffer);
          let binary = "";
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
          }
          const base64Font = btoa(binary);
          pdf.addFileToVFS(cfg.fileName, base64Font);
          pdf.addFont(cfg.fileName, cfg.family, "normal");
          unicodeFontFamily = cfg.family;
        } catch (fontError) {
          console.error("Unicode font load failed, falling back to English PDF:", fontError);
          effectiveLanguage = "en";
          L = PDF_TEXT.en;
          toast({
            title: "Language font not available",
            description: "Could not load selected language font. Downloaded PDF in English.",
            variant: "destructive",
          });
        }
      }
      const entryNumber = String(rawData?.sl_no || pdfData?.sl_no || "").trim();
      const generatedByDisplay = String(
        generatedBy || rawData?.generated_by_name || rawData?.created_by_name || ""
      ).trim();
      const now = new Date();
      const pad2 = (n) => String(n).padStart(2, "0");
      const hours24 = now.getHours();
      const hours12 = hours24 % 12 || 12;
      const ampm = hours24 >= 12 ? "PM" : "AM";
      const generatedAtDisplay = `${pad2(now.getDate())}-${pad2(now.getMonth() + 1)}-${now.getFullYear()} ${pad2(hours12)}:${pad2(now.getMinutes())} ${ampm}`;
      const containsNonAscii = (value) => /[^\u0000-\u007F]/.test(String(value ?? ""));
      const applyAutoFontForText = (value) => {
        if (unicodeFontFamily && containsNonAscii(value)) {
          // Use Unicode font for non-Latin scripts to avoid gibberish.
          originalSetFont(unicodeFontFamily, "normal");
        } else {
          originalSetFont("helvetica", lastRequestedStyle);
        }
      };
      pdf.setFont = (family = "helvetica", style = "normal") => {
        lastRequestedStyle = style || "normal";
        return originalSetFont(family, style);
      };
      pdf.text = (text, ...args) => {
        const sample = Array.isArray(text) ? (text[0] ?? "") : text;
        applyAutoFontForText(sample);
        return originalText(text, ...args);
      };
      pdf.splitTextToSize = (text, ...args) => {
        applyAutoFontForText(text);
        return originalSplitTextToSize(text, ...args);
      };
      const setPdfFont = (isBold = false) => {
        if (unicodeFontFamily) {
          lastRequestedStyle = "normal";
          originalSetFont(unicodeFontFamily, "normal");
        } else {
          lastRequestedStyle = isBold ? "bold" : "normal";
          originalSetFont("helvetica", lastRequestedStyle);
        }
      };
      // Improve readability for complex scripts (Kannada/Gujarati/Hindi).
      pdf.setLineHeightFactor(unicodeFontFamily ? 1.25 : 1.1);
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 8; // Compact margin for one-page fit
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin; // Current Y position on page

      // Helper function to check if we need a new page
      const checkPageBreak = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          return true;
        }
        return false;
      };

      // Helper function to add text with word wrap
      const addText = (text, fontSize, isBold = false, color = [0, 0, 0], align = 'left') => {
        if (!text) return currentY;

        try {
          pdf.setFontSize(fontSize);
          setPdfFont(isBold);
          pdf.setTextColor(color[0], color[1], color[2]);

          const lines = pdf.splitTextToSize(String(text), contentWidth);
          const lineHeight = fontSize * 0.35;

          checkPageBreak(lineHeight * lines.length);

          lines.forEach((line) => {
            if (currentY + lineHeight > pageHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            const xPos = align === 'center' ? pageWidth / 2 : margin;
            pdf.text(String(line), xPos, currentY, { align });
            currentY += lineHeight;
          });
        } catch (error) {
          console.error('Error adding text to PDF:', error);
        }

        return currentY;
      };

      // Helper function to add a line
      const addLine = () => {
        checkPageBreak(3);
        pdf.setDrawColor(...PDF_TABLE_BORDER);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 3;
      };

      // Same visual design as Supplier Brand item table (dark header + bordered data rows)
      const renderSupplierStyleTable = (headers, rows, options = {}) => {
        const {
          afterGap = 3,
          headerFontSize = 8,
          dataFontSize = 9,
          pad = 1.2,
          lineHeight = 3.4,
          minHeaderHeight = 6.5,
          minRowHeight = 7,
          colWidths = null,
          startX = margin,
          tableWidth = contentWidth,
        } = options;

        if (!headers?.length) return;

        const colCount = headers.length;
        const widths =
          Array.isArray(colWidths) && colWidths.length === colCount
            ? colWidths
            : headers.map(() => tableWidth / colCount);
        const textMaxWidths = widths.map((w) => Math.max(4, w - pad * 2));

        pdf.setFontSize(headerFontSize);
        setPdfFont(true);
        const headerLineSets = headers.map((header, i) =>
          pdf.splitTextToSize(String(header ?? ""), textMaxWidths[i])
        );
        const headerBlockHeight = Math.max(
          minHeaderHeight,
          ...headerLineSets.map((lines) => lines.length * lineHeight + pad * 2)
        );

        pdf.setFontSize(dataFontSize);
        setPdfFont(false);
        const preparedRows = (rows || []).map((row) => {
          const cellMetas = headers.map((_, i) => {
            const cell = row?.[i];
            const text =
              cell && typeof cell === "object" && !Array.isArray(cell)
                ? String(cell.text ?? "")
                : String(cell ?? "");
            const bold = Boolean(cell && typeof cell === "object" && cell.bold);
            return {
              text,
              bold,
              lines: pdf.splitTextToSize(text, textMaxWidths[i]),
            };
          });
          const rowHeight = Math.max(
            minRowHeight,
            ...cellMetas.map((cell) => cell.lines.length * lineHeight + pad * 2)
          );
          return { cellMetas, rowHeight };
        });

        checkPageBreak(headerBlockHeight + (preparedRows[0]?.rowHeight || minRowHeight) + 1);

        pdf.setFillColor(60, 60, 60);
        pdf.rect(startX, currentY, tableWidth, headerBlockHeight, "F");
        pdf.setDrawColor(...PDF_TABLE_BORDER);
        pdf.rect(startX, currentY, tableWidth, headerBlockHeight, "S");

        let headerX = startX;
        headers.forEach((_, colIdx) => {
          if (colIdx > 0) {
            pdf.line(headerX, currentY, headerX, currentY + headerBlockHeight);
          }
          const cellX = headerX + pad;
          let cellY = currentY + pad + lineHeight * 0.85;
          pdf.setFontSize(headerFontSize);
          setPdfFont(true);
          pdf.setTextColor(255, 255, 255);
          headerLineSets[colIdx].forEach((line) => {
            pdf.text(line, cellX, cellY, { align: "left", maxWidth: textMaxWidths[colIdx] });
            cellY += lineHeight;
          });
          headerX += widths[colIdx];
        });

        currentY += headerBlockHeight;

        preparedRows.forEach(({ cellMetas, rowHeight }) => {
          checkPageBreak(rowHeight + 2);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(startX, currentY, tableWidth, rowHeight, "F");
          pdf.setDrawColor(...PDF_TABLE_BORDER);
          pdf.rect(startX, currentY, tableWidth, rowHeight, "S");

          let rowX = startX;
          cellMetas.forEach((cell, colIdx) => {
            if (colIdx > 0) {
              pdf.line(rowX, currentY, rowX, currentY + rowHeight);
            }
            const cellX = rowX + pad;
            const contentHeight = cell.lines.length * lineHeight;
            let cellY = currentY + (rowHeight - contentHeight) / 2 + lineHeight * 0.85;
            pdf.setFontSize(dataFontSize);
            setPdfFont(Boolean(cell.bold));
            pdf.setTextColor(0, 0, 0);
            cell.lines.forEach((line) => {
              pdf.text(line, cellX, cellY, { align: "left", maxWidth: textMaxWidths[colIdx] });
              cellY += lineHeight;
            });
            rowX += widths[colIdx];
          });

          currentY += rowHeight;
        });

        currentY += afterGap;
        pdf.setTextColor(0, 0, 0);
      };

      const renderLabelValueGridTable = (pairs, options = {}) => {
        const {
          title = null,
          columnsPerRow = 3,
          showTitle = Boolean(title),
          titleMarginTop = 2,
          titleGap = 3,
          afterGap = 2,
          colWidths = null,
        } = options;

        const validPairs = (pairs || []).filter((pair) => pair && pair[0]);
        if (validPairs.length === 0) return;

        const gridColCount = columnsPerRow;
        const widths =
          Array.isArray(colWidths) && colWidths.length === gridColCount
            ? colWidths
            : Array.from({ length: gridColCount }, () => contentWidth / gridColCount);
        const gridCellPad = 1.2;
        const gridLabelSize = 8.5;
        const gridValueSize = 10;
        const gridLabelLineHeight = 3.4;
        const gridValueLineHeight = 4;

        if (showTitle && title) {
          checkPageBreak(14);
          currentY += titleMarginTop;
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(String(title), margin, currentY);
          currentY += titleGap;
          pdf.setTextColor(0, 0, 0);
        }

        for (let pairIndex = 0; pairIndex < validPairs.length; pairIndex += gridColCount) {
          const rowPairs = validPairs.slice(pairIndex, pairIndex + gridColCount);
          while (rowPairs.length < gridColCount) {
            rowPairs.push(['', '']);
          }

          const cellData = rowPairs.map(([label, value], colIdx) => {
            if (!label) {
              return { labelLines: [], valueLines: [], contentHeight: 0, textMaxWidth: 0 };
            }
            const textMaxWidth = Math.max(4, widths[colIdx] - gridCellPad * 2 - 1);
            pdf.setFontSize(gridLabelSize);
            setPdfFont(true);
            const labelLines = pdf.splitTextToSize(String(label), textMaxWidth);
            pdf.setFontSize(gridValueSize);
            setPdfFont(false);
            const valueLines = pdf.splitTextToSize(String(value || ''), textMaxWidth);
            const labelGap = labelLines.length > 0 ? 0.2 : 0;
            const contentHeight =
              labelLines.length * gridLabelLineHeight +
              labelGap +
              Math.max(valueLines.length, 1) * gridValueLineHeight;
            return { labelLines, valueLines, contentHeight, textMaxWidth };
          });

          const rowHeight = Math.max(
            7,
            ...cellData.map((cell) => cell.contentHeight + gridCellPad * 2)
          );
          checkPageBreak(rowHeight + 1);

          pdf.setDrawColor(...PDF_TABLE_BORDER);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(margin, currentY, contentWidth, rowHeight, 'S');

          let dividerX = margin;
          for (let colIdx = 0; colIdx < gridColCount - 1; colIdx += 1) {
            dividerX += widths[colIdx];
            pdf.line(dividerX, currentY, dividerX, currentY + rowHeight);
          }

          let cellStartX = margin;
          rowPairs.forEach(([label], colIdx) => {
            if (label) {
              const { labelLines, valueLines, contentHeight, textMaxWidth } = cellData[colIdx];
              const cellX = cellStartX + gridCellPad;
              let cellY = currentY + (rowHeight - contentHeight) / 2 + gridLabelLineHeight * 0.85;

              pdf.setFontSize(gridLabelSize);
              setPdfFont(true);
              pdf.setTextColor(0, 0, 0);
              labelLines.forEach((line) => {
                pdf.text(line, cellX, cellY, { align: 'left', maxWidth: textMaxWidth });
                cellY += gridLabelLineHeight;
              });

              if (labelLines.length > 0) {
                cellY += 0.4;
              }
              pdf.setFontSize(gridValueSize);
              setPdfFont(false);
              pdf.setTextColor(0, 0, 0);
              if (valueLines.length > 0) {
                valueLines.forEach((line) => {
                  pdf.text(line, cellX, cellY, { align: 'left', maxWidth: textMaxWidth });
                  cellY += gridValueLineHeight;
                });
              } else {
                pdf.text('-', cellX, cellY, { align: 'left', maxWidth: textMaxWidth });
              }
            }
            cellStartX += widths[colIdx];
          });

          currentY += rowHeight;
        }

        currentY += afterGap;
      };

      const addItemRemarksSection = (item) => {
        const status = String(data.status || "").toLowerCase();
        const remarkColumns = [
          {
            label: L.remarkLabTech,
            text: item.lab_tech_remarks,
            skip: status === "pending" || status === "not_unloaded",
          },
          {
            label: L.remarkAdmin,
            text: item.remarks,
            skip:
              status !== "not_unloaded" &&
              status !== "unloaded" &&
              status !== "completed",
          },
          { label: L.remarkAssignment, text: item.assignment_remarks, skip: false },
          {
            label: L.remarkSupervisor,
            text: item.supervisor_remarks,
            skip: status === "unloaded",
          },
          {
            label: L.remarkFinal,
            text: item.final_remarks,
            skip: status === "completed",
          },
        ].filter((col) => String(col.text ?? "").trim() && !col.skip);

        if (remarkColumns.length === 0) return;

        checkPageBreak(18);
        currentY += 0.5;

        pdf.setFontSize(9.5);
        setPdfFont(true);
        pdf.setTextColor(0, 0, 0);
        pdf.text(String(L.itemRemarksTitle).toUpperCase(), margin, currentY);
        currentY += 1.5;

        renderSupplierStyleTable(
          remarkColumns.map((col) => String(col.label).toUpperCase()),
          [remarkColumns.map((col) => String(col.text).trim())],
          {
            afterGap: 2,
            headerFontSize: 7.5,
            dataFontSize: 8.5,
            pad: 1,
            lineHeight: 3.2,
            minHeaderHeight: 6,
            minRowHeight: 6.5,
          }
        );
      };

      const addStatusRemarksTable = (remarkText) => {
        if (!String(remarkText ?? "").trim()) return;

        const label = String(L.remarks).replace(/:$/, "").trim();
        const value = String(remarkText).trim();
        const labelWidth = contentWidth * 0.22;
        const valueWidth = contentWidth - labelWidth;
        const pad = 1.2;
        const fontSize = 8.5;
        const lineHeight = 3.2;
        const minRowHeight = 7;

        pdf.setFontSize(fontSize);
        setPdfFont(true);
        const labelLines = pdf.splitTextToSize(label, Math.max(4, labelWidth - pad * 2));
        setPdfFont(false);
        const valueLines = pdf.splitTextToSize(value, Math.max(4, valueWidth - pad * 2));
        const rowHeight = Math.max(
          minRowHeight,
          labelLines.length * lineHeight + pad * 2,
          valueLines.length * lineHeight + pad * 2
        );

        checkPageBreak(rowHeight + 2);
        currentY += 1;

        // Label cell (dark)
        pdf.setFillColor(60, 60, 60);
        pdf.rect(margin, currentY, labelWidth, rowHeight, "F");
        pdf.setDrawColor(...PDF_TABLE_BORDER);
        pdf.rect(margin, currentY, labelWidth, rowHeight, "S");

        // Value cell (white)
        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin + labelWidth, currentY, valueWidth, rowHeight, "F");
        pdf.rect(margin + labelWidth, currentY, valueWidth, rowHeight, "S");

        const labelContentHeight = labelLines.length * lineHeight;
        let labelY = currentY + (rowHeight - labelContentHeight) / 2 + lineHeight * 0.85;
        pdf.setFontSize(fontSize);
        setPdfFont(true);
        pdf.setTextColor(255, 255, 255);
        labelLines.forEach((line) => {
          pdf.text(line, margin + pad, labelY, {
            align: "left",
            maxWidth: Math.max(4, labelWidth - pad * 2),
          });
          labelY += lineHeight;
        });

        const valueContentHeight = valueLines.length * lineHeight;
        let valueY = currentY + (rowHeight - valueContentHeight) / 2 + lineHeight * 0.85;
        setPdfFont(false);
        pdf.setTextColor(0, 0, 0);
        valueLines.forEach((line) => {
          pdf.text(line, margin + labelWidth + pad, valueY, {
            align: "left",
            maxWidth: Math.max(4, valueWidth - pad * 2),
          });
          valueY += lineHeight;
        });

        currentY += rowHeight + 2;
        pdf.setTextColor(0, 0, 0);
      };

      // Compact report header — org name near top of page
      let headerTextY = 8;

      if (orgName) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(orgName, pageWidth / 2, headerTextY, { align: 'center' });
        headerTextY += 5;
      }

      if (branchName) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text(branchName, pageWidth / 2, headerTextY, { align: 'center' });
        headerTextY += 4;
      }

      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(L.title, pageWidth / 2, headerTextY + 2, { align: 'center' });

      currentY = headerTextY + 5;
      addLine();

      // Summary Table
      checkPageBreak(22);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);

      const summaryWeightText = await formatPdfWeight(
        pdfData.total_weight,
        pdfData.total_weight_unit,
        "Qtl"
      );

      const partySummaryValue =
        String(pdfData.party_name || 'N/A') +
        (pdfData.urd_party && pdfData.urd_party.trim() !== ""
          ? `\n(${L.partyName} ${pdfData.urd_party})`
          : '');

      const summaryRow1 = [
        [L.billNo, String(pdfData.bill_no || 'N/A')],
        [L.poDate, String(pdfData.date || 'N/A')],
        [L.vehicle, String(pdfData.vehicle_no || 'N/A')],
        [L.bags, String(pdfData.total_bags || 0)],
        [L.weight, String(summaryWeightText)],
      ];
      const summaryRow2 = [
        [L.party, partySummaryValue],
        [L.broker, String(pdfData.broker_name || 'N/A')],
      ];

      renderLabelValueGridTable(summaryRow1, {
        showTitle: false,
        columnsPerRow: 5,
        afterGap: 0,
        // Bill No wider; PO Date / Vehicle / Quantity / Weight tighter
        colWidths: [
          contentWidth * 0.34,
          contentWidth * 0.15,
          contentWidth * 0.17,
          contentWidth * 0.14,
          contentWidth * 0.20,
        ],
      });
      renderLabelValueGridTable(summaryRow2, {
        showTitle: false,
        columnsPerRow: 2,
        afterGap: 3,
      });

      // Remarks
      if (data.remarks) {
        checkPageBreak(8);
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, currentY - 2, contentWidth, 7, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(L.remarks, margin + 2, currentY + 1.5);
        pdf.setFont('helvetica', 'normal');
        addText(data.remarks, 9, false, [0, 0, 0], 'left');
        currentY += 3;
      }

      // Items Section
      if (pdfItems && pdfItems.length > 0) {
        checkPageBreak(12);
        currentY += 1.5;

        const itemWeightDisplays = await Promise.all(
          pdfItems.map((item) => formatPdfItemWeight(item.total_weight, item.alternate_unit))
        );

        pdfItems.forEach((item, index) => {
          checkPageBreak(25);

          // Item header: ITEMS: <item name>
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          const itemName = String(item.item_name || 'Unknown');
          pdf.text(`${L.itemsTitle}: ${itemName}`, margin, currentY, { align: 'left' });
          currentY += 2;

          // Item details - horizontal table (header row + values row)
          const itemTableColumns = [
            { label: L.supplierBrand, value: String(item.brand || 'N/A') },
            { label: L.ourBrand, value: String(item.our_brand || 'N/A') },
            { label: L.quality, value: String(item.quality_name || 'N/A') },
            { label: L.bags, value: String(item.number_of_bags || 0) },
            {
              label: L.totalWeight,
              value: String(
                itemWeightDisplays[index] ||
                  formatInwardItemTotalWeightDisplay(item.total_weight, item.alternate_unit)
              ),
            },
            { label: L.netWeight, value: String(item.net_weight || 'N/A') },
            { label: L.godown, value: String(item.godown_location || 'N/A') },
            { label: L.supervisor, value: String(item.supervisor || 'N/A') },
          ];

          const itemColCount = itemTableColumns.length;
          const itemColWidth = contentWidth / itemColCount;
          const itemTablePad = 1.2;
          const itemHeaderFontSize = 7.5;
          const itemDataFontSize = 8.5;
          const itemTextMaxWidth = itemColWidth - itemTablePad * 2;
          const itemLineHeight = 3.4;

          pdf.setFontSize(itemHeaderFontSize);
          setPdfFont(true);
          const headerLineSets = itemTableColumns.map((col) =>
            pdf.splitTextToSize(String(col.label), itemTextMaxWidth)
          );
          const headerBlockHeight = Math.max(
            6.5,
            ...headerLineSets.map((lines) => lines.length * itemLineHeight + itemTablePad * 2)
          );

          pdf.setFontSize(itemDataFontSize);
          setPdfFont(false);
          const dataLineSets = itemTableColumns.map((col) =>
            pdf.splitTextToSize(String(col.value), itemTextMaxWidth)
          );
          const dataBlockHeight = Math.max(
            7,
            ...dataLineSets.map((lines) => lines.length * itemLineHeight + itemTablePad * 2)
          );

          checkPageBreak(headerBlockHeight + dataBlockHeight + 1);

          pdf.setFillColor(60, 60, 60);
          pdf.rect(margin, currentY, contentWidth, headerBlockHeight, 'F');
          pdf.setDrawColor(...PDF_TABLE_BORDER);
          pdf.rect(margin, currentY, contentWidth, headerBlockHeight, 'S');

          itemTableColumns.forEach((_, colIdx) => {
            if (colIdx > 0) {
              const dividerX = margin + itemColWidth * colIdx;
              pdf.line(dividerX, currentY, dividerX, currentY + headerBlockHeight);
            }
            const cellX = margin + itemColWidth * colIdx + itemTablePad;
            let cellY = currentY + itemTablePad + itemLineHeight * 0.85;
            pdf.setFontSize(itemHeaderFontSize);
            setPdfFont(true);
            pdf.setTextColor(255, 255, 255);
            headerLineSets[colIdx].forEach((line) => {
              pdf.text(line, cellX, cellY, { align: 'left', maxWidth: itemTextMaxWidth });
              cellY += itemLineHeight;
            });
          });

          currentY += headerBlockHeight;

          pdf.setFillColor(255, 255, 255);
          pdf.rect(margin, currentY, contentWidth, dataBlockHeight, 'F');
          pdf.setDrawColor(...PDF_TABLE_BORDER);
          pdf.rect(margin, currentY, contentWidth, dataBlockHeight, 'S');

          itemTableColumns.forEach((_, colIdx) => {
            if (colIdx > 0) {
              const dividerX = margin + itemColWidth * colIdx;
              pdf.line(dividerX, currentY, dividerX, currentY + dataBlockHeight);
            }
            const cellX = margin + itemColWidth * colIdx + itemTablePad;
            const contentHeight = dataLineSets[colIdx].length * itemLineHeight;
            let cellY = currentY + (dataBlockHeight - contentHeight) / 2 + itemLineHeight * 0.85;
            pdf.setFontSize(itemDataFontSize);
            setPdfFont(false);
            pdf.setTextColor(0, 0, 0);
            dataLineSets[colIdx].forEach((line) => {
              pdf.text(line, cellX, cellY, { align: 'left', maxWidth: itemTextMaxWidth });
              cellY += itemLineHeight;
            });
          });

          currentY += dataBlockHeight + 2;

          addItemRemarksSection(item);

          // Weight breakdowns / Unloading Quality Details
          if (item.weight_breakdowns && item.weight_breakdowns.length > 0) {
            checkPageBreak(12);
            currentY += 2.5;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            pdf.text(L.weightBreakdowns, margin, currentY, { align: 'left' });
            currentY += 2;

            const statusColWidth = contentWidth * 0.25;
            const bagsColWidth = contentWidth * 0.125;
            const weightColWidth = contentWidth * 0.125;
            const remarksColWidth = contentWidth * 0.50;

            renderSupplierStyleTable(
              [L.statusType, L.quantity, L.weightCol, L.remarksCol],
              item.weight_breakdowns.map((w) => [
                w.status_type_display || w.status_type || 'N/A',
                w.number_of_bags || 0,
                w.weight || 'N/A',
                w.remarks || '-',
              ]),
              {
                colWidths: [statusColWidth, bagsColWidth, weightColWidth, remarksColWidth],
                afterGap: 2,
              }
            );
          }


          if (data.status.toLowerCase() === 'pending') {
            if (item.lab_tech_remarks) {
              addStatusRemarksTable(item.lab_tech_remarks);
            }
          }

          if (data.status.toLowerCase() === 'not_unloaded') {
            if (item.lab_tech_remarks) {
              addStatusRemarksTable(item.lab_tech_remarks);
            }
          }

          if (data.status.toLowerCase() === 'unloaded') {
            if (item.supervisor_remarks) {
              addStatusRemarksTable(item.supervisor_remarks);
            }
          }

          if (data.status.toLowerCase() === 'completed') {
            if (item.final_remarks) {
              addStatusRemarksTable(item.final_remarks);
            }
          }

          // Item remarks
          if (item.remarks && data.status.toLowerCase() !== 'not_unloaded' && data.status.toLowerCase() !== 'unloaded' && data.status.toLowerCase() !== 'completed') {
            addStatusRemarksTable(item.remarks);
          }

          currentY += 2.5;
        });
      }

      // JALI Details Section
      if (pdfJaliDetails && pdfJaliDetails.length > 0) {
        checkPageBreak(10);
        addLine();
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 64, 175);
        pdf.text(`${L.jaliTitle} (${pdfJaliDetails.length})`, margin, currentY);
        currentY += 5;

        pdfJaliDetails.forEach((jali, index) => {
          checkPageBreak(16);
          const relatedItem = pdfItems.find(item => item.id === jali.item_id);

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${index + 1}. ${relatedItem ? relatedItem.item_name : 'Unknown'}`, margin, currentY, { align: 'left' });
          currentY += 4;

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          const jaliDetails = [
            [L.gross, jali.gross_weight || jali.weight_value || 'N/A', L.tare, jali.tare_weight || 'N/A', L.net, jali.net_weight || 'N/A', L.bags, (jali.number_of_bags || jali.bags_count || 0).toString()],
          ];

          if (jali.jali_number) {
            jaliDetails.push([L.jaliNumber, jali.jali_number, L.weightType, jali.weight_type_display || jali.weight_type || 'N/A', '', '']);
          }

          jaliDetails.forEach((row) => {
            checkPageBreak(10);
            let xPos = margin;
            const colWidth = contentWidth / 4;
            let maxRowHeight = 6;
            const rowValueLines = [];
            const rowLabelGaps = [];
            const rowValueWidths = [];
            for (let i = 0; i < row.length; i += 2) {
              if (row[i]) {
                pdf.setFont('helvetica', 'bold');
                const labelWidth = pdf.getTextWidth(String(row[i]));
                const dynamicGap = Math.max(20, Math.min(40, labelWidth + 4));
                const valueWidth = Math.max(12, colWidth - dynamicGap - 2);
                const valueLines = pdf.splitTextToSize(String(row[i + 1] || ''), valueWidth);
                rowValueLines.push(valueLines);
                rowLabelGaps.push(dynamicGap);
                rowValueWidths.push(valueWidth);
                maxRowHeight = Math.max(maxRowHeight, valueLines.length * 4 + 2);
              } else {
                rowValueLines.push([]);
                rowLabelGaps.push(20);
                rowValueWidths.push(colWidth - 22);
              }
            }
            checkPageBreak(maxRowHeight);
            let colIndex = 0;
            for (let i = 0; i < row.length; i += 2) {
              if (row[i]) {
                pdf.setFont('helvetica', 'bold');
                pdf.text(String(row[i]), xPos, currentY, { align: 'left' });
                pdf.setFont('helvetica', 'normal');
                const valueLines = rowValueLines[colIndex];
                valueLines.forEach((line, lineIndex) => {
                  pdf.text(line, xPos + rowLabelGaps[colIndex], currentY + (lineIndex * 4), {
                    align: 'left',
                    maxWidth: rowValueWidths[colIndex]
                  });
                });
              }
              xPos += colWidth;
              colIndex++;
            }
            currentY += maxRowHeight;
          });

          if (jali.jali_remarks) {
            checkPageBreak(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text(L.remarks, margin, currentY, { align: 'left' });
            pdf.setFont('helvetica', 'normal');
            addText(jali.jali_remarks, 9, false, [0, 0, 0], 'left');
            currentY += 3;
          }

          currentY += 5;
        });
      }

      // Lab Test Parameters Section
      if (pdfLabTestParams && pdfLabTestParams.length > 0) {
        checkPageBreak(10);
        addLine();
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 64, 175);
        pdf.text(`${L.testParamsTitle} (${pdfLabTestParams.length})`, margin, currentY);
        currentY += 5;

        pdfLabTestParams.forEach((param, index) => {
          checkPageBreak(12);
          const relatedItem = pdfItems.find(item => item.id === param.item_id);

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${relatedItem ? relatedItem.item_name : 'Unknown'}`, margin, currentY, { align: 'left' });
          currentY += 4;

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          const paramDetails = [
            [
              `${L.parameter}:`,
              param.parameter_name || 'N/A',
              `${L.value}:`,
              `${(param.value || 'N/A')} ${(param.unit || '')}`.trim(),
              `${L.statusCol}:`,
              getPdfStatusLabel(param.status, effectiveLanguage),
            ],
          ];

          paramDetails.forEach((row) => {
            checkPageBreak(10);
            let xPos = margin;
            const colWidth = contentWidth / 3;
            let maxRowHeight = 6;
            const rowValueLines = [];
            const rowLabelGaps = [];
            const rowValueWidths = [];
            for (let i = 0; i < row.length; i += 2) {
              if (row[i]) {
                pdf.setFont('helvetica', 'bold');
                const labelWidth = pdf.getTextWidth(String(row[i]));
                const dynamicGap = Math.max(24, Math.min(44, labelWidth + 4));
                const valueWidth = Math.max(16, colWidth - dynamicGap - 4);
                const valueLines = pdf.splitTextToSize(String(row[i + 1] || ''), valueWidth);
                rowValueLines.push(valueLines);
                rowLabelGaps.push(dynamicGap);
                rowValueWidths.push(valueWidth);
                maxRowHeight = Math.max(maxRowHeight, valueLines.length * 4 + 2);
              } else {
                rowValueLines.push([]);
                rowLabelGaps.push(24);
                rowValueWidths.push(colWidth - 28);
              }
            }
            checkPageBreak(maxRowHeight);
            let colIndex = 0;
            for (let i = 0; i < row.length; i += 2) {
              if (row[i]) {
                pdf.setFont('helvetica', 'bold');
                pdf.text(String(row[i]), xPos, currentY, { align: 'left' });
                pdf.setFont('helvetica', 'normal');
                const valueLines = rowValueLines[colIndex];
                valueLines.forEach((line, lineIndex) => {
                  pdf.text(line, xPos + rowLabelGaps[colIndex], currentY + (lineIndex * 4), {
                    align: 'left',
                    maxWidth: rowValueWidths[colIndex]
                  });
                });
              }
              xPos += colWidth;
              colIndex++;
            }
            currentY += maxRowHeight;
          });

          if (param.remarks) {
            checkPageBreak(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text(L.remarks, margin, currentY, { align: 'left' });
            pdf.setFont('helvetica', 'normal');
            addText(param.remarks, 9, false, [120, 53, 15], 'left');
            currentY += 3;
          }

          currentY += 2;
        });
      }

      // Lab Testing Results Section
      if (pdfItems.some(item => item.lab_tests && item.lab_tests.length > 0)) {
        checkPageBreak(10);
        currentY += 1;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('LAB TESTING RESULTS', margin, currentY);

        const labTestItems = pdfItems.filter(item => item.lab_tests && item.lab_tests.length > 0);
        // Single item: title goes straight to table (2mm). Multiple: space before "1. Item…"
        currentY += labTestItems.length > 1 ? 5 : 2;

        labTestItems.forEach((item, labItemIndex) => {
          checkPageBreak(28);

          if (labTestItems.length > 1) {
            if (labItemIndex > 0) currentY += 2;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 64, 175);
            pdf.text(`${labItemIndex + 1}. ${item.item_name || 'Unknown'}`, margin, currentY, { align: 'left' });
            currentY += 2;
            pdf.setTextColor(0, 0, 0);
          }

          const preTests = item.lab_tests.filter(test => test.test_type === 'pre_testing');
          const postTests = item.lab_tests.filter(test => test.test_type === 'post_testing' || test.test_type === 're_testing');
          const allParams = [...new Set([...preTests, ...postTests].map(test => test.parameter_name))];

          // Get unique breakdowns from post-tests (using Map to ensure uniqueness by ID)
          const breakdownMap = new Map();
          postTests
            .filter(test => test.breakdown)
            .forEach(test => {
              const breakdownId = test.breakdown.id;
              if (!breakdownMap.has(breakdownId)) {
                breakdownMap.set(breakdownId, {
                  id: breakdownId,
                  status_type: test.breakdown.status_type_display || test.breakdown.status_type,
                  number_of_bags: test.breakdown.number_of_bags
                });
              }
            });
          const postTestBreakdowns = Array.from(breakdownMap.values());

          const hasBreakdownTests = postTestBreakdowns.length > 0;
          const hasMainItemTests = postTests.some(test => !test.breakdown);

          const formatLabTestCell = (tests) => {
            if (!tests || tests.length === 0) return '0';
            return tests
              .map((test) => {
                const baseValue = `${test.value || 'N/A'} ${test.unit || ''}`.trim();
                return test.test_type === 're_testing' ? `${baseValue} (Re-Test)` : baseValue;
              })
              .join(', ');
          };

          const headers = [L.parameter, L.preTesting];
          if (hasBreakdownTests) {
            postTestBreakdowns.forEach((breakdown) => {
              headers.push(`${breakdown.status_type} (${breakdown.number_of_bags})`);
            });
          }
          if (hasMainItemTests) {
            headers.push(hasBreakdownTests ? L.postTestingMain : L.postTesting);
          } else if (!hasBreakdownTests) {
            headers.push(L.postTesting);
          }
          headers.push(L.difference);

          const equalColWidth = contentWidth / headers.length;
          const colWidths = headers.map(() => equalColWidth);

          const rows = allParams.map((paramName) => {
            const preTest = preTests.find(test => test.parameter_name === paramName);
            const paramPostTests = postTests.filter(test => test.parameter_name === paramName);
            const postTestsByBreakdown = paramPostTests.reduce((acc, test) => {
              const key = test.breakdown ? test.breakdown.id : 'main';
              if (!acc[key]) acc[key] = [];
              acc[key].push(test);
              return acc;
            }, {});

            const row = [
              { text: paramName, bold: true },
              preTest ? `${preTest.value || 'N/A'} ${preTest.unit || ''}`.trim() : '0',
            ];

            if (hasBreakdownTests) {
              postTestBreakdowns.forEach((breakdown) => {
                row.push(formatLabTestCell(postTestsByBreakdown[breakdown.id] || []));
              });
            }
            if (hasMainItemTests) {
              row.push(formatLabTestCell(postTestsByBreakdown.main || []));
            } else if (!hasBreakdownTests) {
              row.push(formatLabTestCell(paramPostTests));
            }

            const postOnlyTests = item.lab_tests.filter(
              (test) => test.test_type === 'post_testing' && test.parameter_name === paramName
            );
            const latestPostForDiff = getLatestInwardTest(postOnlyTests);
            const differenceDetails = computeInwardTestDifferenceDetails(preTest, latestPostForDiff);
            row.push({
              text: differenceDetails.text,
              bold: Boolean(differenceDetails.isIncrease),
            });
            return row;
          });

          renderSupplierStyleTable(headers, rows, {
            colWidths,
            afterGap: 1.5,
            headerFontSize: 7.5,
            dataFontSize: 8.5,
            pad: 1,
            lineHeight: 3.2,
            minHeaderHeight: 6,
            minRowHeight: 6.5,
          });
        });
      }

      const buildInwardInfoPairs = (item) =>
        [
          item.tested_by ? [L.testedBy, String(item.tested_by)] : null,
          item.tested_date ? [L.testedDate, String(item.tested_date)] : null,
          item.approved_by ? [L.actionBy, String(item.approved_by)] : null,
          item.approved_date ? [L.actionDate, String(item.approved_date)] : null,
          item.supervisor ? [L.unloadedBy, String(item.supervisor)] : null,
          item.unloading_date ? [L.unloadedDate, String(item.unloading_date)] : null,
          item.re_tested_by ? [L.postTestedBy, String(item.re_tested_by)] : null,
          item.re_testing_date ? [L.postTestedDate, String(item.re_testing_date)] : null,
          item.additional_tested_by ? [L.reTestedBy, String(item.additional_tested_by)] : null,
          item.additional_testing_date ? [L.reTestingDate, String(item.additional_testing_date)] : null,
        ].filter(Boolean);

      const inwardInfoSections = (pdfItems || [])
        .map((item) => ({ item, pairs: buildInwardInfoPairs(item) }))
        .filter(({ pairs }) => pairs.length > 0);

      if (inwardInfoSections.length > 0) {
        checkPageBreak(22);
        currentY += 4;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(L.inwardInfoTitle, margin, currentY);
        // Single section: title goes straight to table (2mm). Multiple: space before "1. Item…"
        currentY += inwardInfoSections.length > 1 ? 5 : 2;

        inwardInfoSections.forEach(({ item, pairs }, sectionIndex) => {
          if (inwardInfoSections.length > 1) {
            checkPageBreak(24);
            if (sectionIndex > 0) currentY += 2;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 64, 175);
            pdf.text(`${sectionIndex + 1}. ${item.item_name || 'Unknown'}`, margin, currentY);
            currentY += 2;
            pdf.setTextColor(0, 0, 0);
          }

          renderLabelValueGridTable(pairs, {
            showTitle: false,
            afterGap: 3,
            columnsPerRow: 4,
          });
        });
      }

      // Testing Info
      if (data.tested_by || data.test_date) {
        checkPageBreak(10);
        pdf.setFillColor(240, 253, 244);
        pdf.rect(margin, currentY - 3, contentWidth, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        let testInfo = 'Testing: ' + (data.tested_by || 'N/A') + ' | Date: ' + (data.test_date || 'N/A');
        if (data.lab_tech_remarks) {
          testInfo += ` | ${L.remarks} ${data.lab_tech_remarks}`;
        }
        pdf.text(testInfo, margin + 2, currentY + 2, { align: 'left' });
        currentY += 10;
      }

      // Images Section — controlled by "Display images in inward pdf" admin setting (localStorage)
      const displayImagesInInwardPdf = isAdminSettingEnabledByName("Display images in inward pdf");
      const allImages = displayImagesInInwardPdf
        ? [
            ...(Array.isArray(pdfImages) ? pdfImages : []),
            ...(Array.isArray(pdfItems)
              ? pdfItems.flatMap((it) => (Array.isArray(it.images) ? it.images : []))
              : []),
          ].filter(isInwardPdfImageMedia)
        : [];

      if (allImages.length > 0) {
        checkPageBreak(14);
        addLine();
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 64, 175);
        pdf.text(`${L.imagesTitle} (${allImages.length})`, margin, currentY);
        currentY += 5;

        // Helper function to load image using html2canvas for better CORS handling
        const loadImageAsDataURL = async (url) => {
          // If it's already a data URL, return it
          if (url.startsWith('data:')) {
            return url;
          }

          // If it's a blob URL, convert it
          if (url.startsWith('blob:')) {
            try {
              const response = await fetch(url);
              const blob = await response.blob();
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } catch (error) {
              console.error('Error converting blob URL:', error);
              throw error;
            }
          }

          try {
            // Create a temporary container with the image
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '400px';
            container.style.height = '300px';
            container.style.backgroundColor = 'white';
            container.style.overflow = 'hidden';

            const img = document.createElement('img');
            img.src = url;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.display = 'block';

            // Only set crossOrigin for http/https URLs
            if (url.startsWith('http://') || url.startsWith('https://')) {
              img.crossOrigin = 'anonymous';
            }

            container.appendChild(img);
            document.body.appendChild(container);

            // Wait for image to load
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                if (container.parentNode) {
                  document.body.removeChild(container);
                }
                reject(new Error('Image loading timeout'));
              }, 12000);

              if (img.complete && img.naturalHeight !== 0) {
                clearTimeout(timeout);
                resolve();
              } else {
                img.onload = () => {
                  clearTimeout(timeout);
                  resolve();
                };
                img.onerror = (err) => {
                  clearTimeout(timeout);
                  if (container.parentNode) {
                    document.body.removeChild(container);
                  }
                  reject(new Error('Failed to load image: ' + (err.message || 'Unknown error')));
                };
              }
            });

            // Use html2canvas to convert to canvas (handles CORS better)
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(container, {
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              scale: 1,
              logging: false,
              width: 400,
              height: 300,
              imageTimeout: 10000
            });

            // Clean up
            if (container.parentNode) {
              document.body.removeChild(container);
            }

            // Convert to data URL
            const dataURL = canvas.toDataURL('image/jpeg', 0.85);
            return dataURL;
          } catch (error) {
            console.error('Error loading image with html2canvas:', error);
            // Fallback: try direct image loading
            return new Promise((resolve, reject) => {
              const img = new Image();

              // Only set crossOrigin for http/https URLs
              if (url.startsWith('http://') || url.startsWith('https://')) {
                img.crossOrigin = 'anonymous';
              }

              const timeout = setTimeout(() => {
                reject(new Error('Image loading timeout'));
              }, 8000);

              img.onload = () => {
                clearTimeout(timeout);
                try {
                  const canvas = document.createElement('canvas');
                  const maxWidth = 800;
                  const maxHeight = 600;
                  let width = img.width;
                  let height = img.height;

                  if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, width, height);
                  const dataURL = canvas.toDataURL('image/jpeg', 0.8);
                  resolve(dataURL);
                } catch (err) {
                  reject(err);
                }
              };

              img.onerror = (err) => {
                clearTimeout(timeout);
                reject(new Error('Failed to load image: ' + (err.message || 'Unknown error')));
              };

              img.src = url;
            });
          }
        };

        // Add images in a grid layout (2 columns)
        const imagesPerRow = 3;
        const imageSpacing = 5;
        const imageWidth = (contentWidth - imageSpacing) / imagesPerRow;
        const imageHeight = 40; // Fixed height for images
        const labelHeight = 8; // Space for image label

        for (let i = 0; i < allImages.length; i++) {
          const image = allImages[i];
          const row = Math.floor(i / imagesPerRow);
          const col = i % imagesPerRow;

          try {
            // Check if we need a new page before starting a new row
            if (col === 0 && row > 0) {
              const requiredHeight = imageHeight + labelHeight + 5;
              if (currentY + requiredHeight > pageHeight - margin) {
                pdf.addPage();
                currentY = margin;
              }
            }

            // Load image with timeout
            let imageDataURL = null;
            try {
              // Ensure we have a valid URL
              const imageUrl = image.image_url;
              if (!imageUrl) {
                throw new Error('No image URL provided');
              }

              // Convert relative URLs to absolute if needed
              let fullUrl = imageUrl;
              if (imageUrl.startsWith('/')) {
                const API_BASE_URL = import.meta.env.VITE_BASE_URL || '';
                fullUrl = API_BASE_URL + imageUrl;
              } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
                const API_BASE_URL = import.meta.env.VITE_BASE_URL || '';
                fullUrl = API_BASE_URL + '/' + imageUrl;
              }

              // console.log(`Loading image ${i + 1}: ${fullUrl}`);

              imageDataURL = await Promise.race([
                loadImageAsDataURL(fullUrl),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
              ]);

              // console.log(`Successfully loaded image ${i + 1}`);
            } catch (loadError) {
              console.error(`Error loading image ${i + 1}:`, loadError);
              console.error(`Image URL was: ${image.image_url}`);
              // Will handle below with placeholder
            }

            // Calculate position
            const xPos = margin + (col * (imageWidth + imageSpacing));
            let yPos = currentY;

            // Check if image fits on current page
            if (yPos + imageHeight + labelHeight > pageHeight - margin) {
              pdf.addPage();
              currentY = margin;
              yPos = currentY;
            }

            if (imageDataURL) {
              // Add the image
              pdf.addImage(imageDataURL, 'JPEG', xPos, yPos, imageWidth, imageHeight);
            } else {
              // Draw placeholder rectangle for failed images
              pdf.setDrawColor(...PDF_TABLE_BORDER);
              pdf.setFillColor(...PDF_TABLE_HEADER_FILL);
              pdf.rect(xPos, yPos, imageWidth, imageHeight, 'FD');
              pdf.setFontSize(8);
              pdf.setTextColor(156, 163, 175);
              pdf.setFont('helvetica', 'normal');
              const placeholderText = 'Image unavailable';
              const textWidth = pdf.getTextWidth(placeholderText);
              pdf.text(placeholderText, xPos + (imageWidth - textWidth) / 2, yPos + imageHeight / 2);
            }

            // Add image label below
            const imageName =
              getPdfImageDisplayLabel(image, language) || `Image ${i + 1}`;
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);

            const labelY = currentY + imageHeight + 2;
            if (labelY + labelHeight > pageHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }

            const labelLines = pdf.splitTextToSize(imageName, imageWidth);
            labelLines.forEach((line, lineIdx) => {
              pdf.text(line, xPos, currentY + imageHeight + 3 + (lineIdx * 3));
            });

            // Move to next row if this is the last column
            if (col === imagesPerRow - 1) {
              const maxLabelHeight = labelLines.length * 3;
              currentY += imageHeight + maxLabelHeight + imageSpacing;
            }

          } catch (error) {
            console.error(`Error processing image ${i + 1}:`, error);
            // Draw placeholder for error case
            const xPos = margin + (col * (imageWidth + imageSpacing));
            let yPos = currentY;

            if (yPos + imageHeight + labelHeight > pageHeight - margin) {
              pdf.addPage();
              currentY = margin;
              yPos = currentY;
            }

            pdf.setDrawColor(...PDF_TABLE_BORDER);
            pdf.setFillColor(...PDF_TABLE_HEADER_FILL);
            pdf.rect(xPos, yPos, imageWidth, imageHeight, 'FD');
            pdf.setFontSize(8);
            pdf.setTextColor(239, 68, 68);
            pdf.setFont('helvetica', 'normal');
            const errorText = 'Error loading image';
            const textWidth = pdf.getTextWidth(errorText);
            pdf.text(errorText, xPos + (imageWidth - textWidth) / 2, yPos + imageHeight / 2);

            // Add label
            const imageName =
              getPdfImageDisplayLabel(image, language) || `Image ${i + 1}`;
            const labelLines = pdf.splitTextToSize(imageName, imageWidth);
            labelLines.forEach((line, lineIdx) => {
              pdf.text(line, xPos, currentY + imageHeight + 2 + (lineIdx * 3));
            });

            if (col === imagesPerRow - 1) {
              const maxLabelHeight = labelLines.length * 3;
              currentY += imageHeight + maxLabelHeight + imageSpacing;
            }
          }
        }

        // Move to next line after last row if incomplete
        if (allImages.length % imagesPerRow !== 0) {
          currentY += imageHeight + labelHeight + 5;
        } else {
          currentY += 5;
        }
      }

      const hasNumericWeight = (value) =>
        value != null && String(value).trim() !== "" && !Number.isNaN(Number(value));
      const formatKg = (value) => (hasNumericWeight(value) ? `${value} kg` : "-");
      const formatWeightDiff = (left, right) =>
        hasNumericWeight(left) && hasNumericWeight(right)
          ? `${(Number(left) - Number(right)).toFixed(2)} kg`
          : "-";
      const ourNet =
        hasNumericWeight(data.gross_weight) && hasNumericWeight(data.tare_weight)
          ? (Number(data.gross_weight) - Number(data.tare_weight)).toFixed(2)
          : null;
      const partyNet =
        hasNumericWeight(data.party_gross_weight) && hasNumericWeight(data.party_tare_weight)
          ? (Number(data.party_gross_weight) - Number(data.party_tare_weight)).toFixed(2)
          : null;

      const hasWeighmentDetails =
        hasNumericWeight(data.gross_weight) ||
        hasNumericWeight(data.tare_weight) ||
        hasNumericWeight(data.party_gross_weight) ||
        hasNumericWeight(data.party_tare_weight);
      const freightAmount =
        data.additional_payment != null && String(data.additional_payment).trim() !== ""
          ? String(data.additional_payment).trim()
          : "";

      if (hasWeighmentDetails || freightAmount) {
        const sectionGap = 4;
        const freightWidth = freightAmount ? Math.min(48, contentWidth * 0.26) : 0;
        const weighmentWidth = freightAmount
          ? contentWidth - freightWidth - sectionGap
          : contentWidth;
        const freightX = margin + weighmentWidth + sectionGap;

        checkPageBreak(28);
        currentY += 1.5;
        const titlesY = currentY;

        if (hasWeighmentDetails) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(L.weighmentTitle, margin, titlesY);
        }
        if (freightAmount) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(L.freightTitle || "FREIGHT DETAILS", freightX, titlesY);
        }
        currentY += 2;
        const tablesStartY = currentY;

        if (hasWeighmentDetails) {
          renderSupplierStyleTable(
            [
              L.parameter,
              L.grossWeight.replace(/:$/, ""),
              L.tareWeight.replace(/:$/, ""),
              String(L.netWeight || "Net Weight").replace(/:$/, ""),
            ],
            [
              [
                L.ourWeight,
                formatKg(data.gross_weight),
                formatKg(data.tare_weight),
                formatKg(ourNet),
              ],
              [
                L.partyWeight,
                formatKg(data.party_gross_weight),
                formatKg(data.party_tare_weight),
                formatKg(partyNet),
              ],
              [
                L.difference,
                formatWeightDiff(data.gross_weight, data.party_gross_weight),
                formatWeightDiff(data.tare_weight, data.party_tare_weight),
                formatWeightDiff(ourNet, partyNet),
              ],
            ],
            {
              afterGap: 0,
              headerFontSize: 7.5,
              dataFontSize: 8.5,
              pad: 1,
              lineHeight: 3.2,
              minHeaderHeight: 6,
              minRowHeight: 6.5,
              startX: margin,
              tableWidth: weighmentWidth,
            }
          );
        }
        const afterWeighmentY = currentY;

        if (freightAmount) {
          currentY = tablesStartY;
          renderSupplierStyleTable(
            [L.parameter, String(L.value || "Value")],
            [[String(L.freightAmount || "Amount").replace(/:$/, ""), freightAmount]],
            {
              afterGap: 0,
              headerFontSize: 7.5,
              dataFontSize: 8.5,
              pad: 1,
              lineHeight: 3.2,
              minHeaderHeight: 6,
              minRowHeight: 6.5,
              startX: freightX,
              tableWidth: freightWidth,
            }
          );
          currentY = Math.max(afterWeighmentY, currentY);
        }

        currentY += 2;
      }

      // Footer — keep on same page when possible (tighter bottom margin)
      const footerBottomMargin = 4;
      const footerBlockHeight = 12;
      if (currentY + footerBlockHeight > pageHeight - footerBottomMargin) {
        pdf.addPage();
        currentY = margin;
      }
      // addLine();
      currentY += 3.5;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      const footerText = `Entry #${entryNumber || 'N/A'} | ${L.generatedBy}: ${generatedByDisplay || 'N/A'} | Generated on ${generatedAtDisplay}`;
      pdf.text(footerText, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        'Powered By GrainsPro, Developed By MWB Technologies India Pvt Ltd',
        pageWidth / 2,
        currentY,
        { align: 'center' }
      );

      // Download the PDF
      pdf.save(`inward-entry-${entryNumber || "N-A"}-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "PDF Downloaded",
        description: L.downloaded,
        className: "text-white",
        style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      toast({
        title: "Error",
        description: error?.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Generate QR Code function (for all items or a specific item)
  const generateQRCode = async (itemId = null) => {
    if (!data || !data.id) {
      toast({
        title: "Error",
        description: "Inward entry data not available",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingQR(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/report/generate-qr-code/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inward_entry_id: data.id,
        }),
      });

      const result = await response.json();

      // Handle different response statuses
      if (result.status === 200) {
        // Success - QR codes generated or already exist
        const refreshedQrCodes = await fetchInwardQrCodesFromServer(data.id, token);
        if (refreshedQrCodes) {
          setQrCodesData((prev) => mergeInwardQrCodesData(prev, refreshedQrCodes));

          // If a specific item was requested, open its QR code dialog
          if (itemId && refreshedQrCodes[itemId]) {
            setSelectedQRCodeItem(itemId);
            setIsQRCodeDialogOpen(true);
          }
        } else if (result.data?.qr_codes?.length > 0) {
          const qrCodesByItem = {};
          result.data.qr_codes.forEach((qrCode) => {
            const mapped = mapInwardQrCodeToState(qrCode, {
              alreadyExists: qrCode.already_exists || false,
            });
            if (mapped) {
              qrCodesByItem[qrCode.inward_item_id] = mapped;
            }
          });
          setQrCodesData((prev) => mergeInwardQrCodesData(prev, qrCodesByItem));

          if (itemId && qrCodesByItem[itemId]) {
            setSelectedQRCodeItem(itemId);
            setIsQRCodeDialogOpen(true);
          }
        }

        toast({
          title: result.data?.all_exist ? "QR Codes Displayed" : "✅ QR Codes Generated",
          description: result.message || "QR codes processed successfully",
          className: result.data?.all_exist
            ? "bg-blue-50 border-blue-100 text-blue-800"
            : "bg-green-50 border-green-100 text-green-800",
        });
      } else if (result.status === 400) {
        // Validation error - items not completed
        if (result.data && result.data.incomplete_items) {
          const incompleteItems = result.data.incomplete_items;
          const itemsList = incompleteItems.map(item =>
            `${item.item_name || 'Item'} (ID: ${item.inward_item_id}, Status: ${item.current_status})`
          ).join(', ');

          toast({
            title: "Cannot Generate QR Code",
            description: `${result.message}\n\nIncomplete items: ${itemsList}\n\nPlease complete all items before generating QR code.`,
            variant: "destructive",
            duration: 6000,
          });
        } else {
          toast({
            title: "Validation Error",
            description: result.message || "Cannot generate QR code",
            variant: "destructive",
          });
        }
      } else if (result.status === 404) {
        // Not found error
        toast({
          title: "Not Found",
          description: result.message || "Inward entry or items not found",
          variant: "destructive",
        });
      } else if (!response.ok) {
        // Other errors
        throw new Error(result.message || "Failed to generate QR code");
      } else {
        throw new Error(result.message || "Failed to generate QR code");
      }
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // View QR Code for a specific item
  const viewQRCode = async (itemId) => {
    if (!data?.id) return;

    try {
      const refreshedQrCodes = await fetchInwardQrCodesFromServer(data.id, token);
      if (refreshedQrCodes?.[itemId]) {
        setQrCodesData((prev) => mergeInwardQrCodesData(prev, refreshedQrCodes));
        setSelectedQRCodeItem(itemId);
        setIsQRCodeDialogOpen(true);
        return;
      }

      if (qrCodesData[itemId]) {
        setSelectedQRCodeItem(itemId);
        setIsQRCodeDialogOpen(true);
        return;
      }

      await generateQRCode(itemId);
    } catch (error) {
      console.error("Error loading QR code:", error);
      if (qrCodesData[itemId]) {
        setSelectedQRCodeItem(itemId);
        setIsQRCodeDialogOpen(true);
      } else {
        await generateQRCode(itemId);
      }
    }
  };

  const qrPaperSizeOptions = {
    "Thermal 80mm": { width: "80", height: "" },
    "Thermal 58mm": { width: "58", height: "" },
    A4: { width: "210", height: "297" },
    A3: { width: "297", height: "420" },
    A5: { width: "148", height: "210" },
    Letter: { width: "216", height: "279" },
    Legal: { width: "216", height: "356" },
    Custom: null,
  };

  const handleQrPaperSizeChange = (value) => {
    setQrPaperSize(value);
    const preset = qrPaperSizeOptions[value];
    if (preset) {
      setQrPrintWidthMm(preset.width);
      setQrPrintHeightMm(preset.height);
    }
  };

  const printQRCodeLabel = async () => {
    if (!selectedQRCodeItem || !qrCodesData[selectedQRCodeItem]) {
      toast({
        title: "Error",
        description: "QR code data is missing",
        variant: "destructive",
      });
      return;
    }

    const width = parseFloat(qrPrintWidthMm);
    const heightRaw = parseFloat(qrPrintHeightMm);

    if (!Number.isFinite(width) || width <= 0) {
      toast({
        title: "Invalid page size",
        description: "Please enter a valid width in mm.",
        variant: "destructive",
      });
      return;
    }

    // Thermal roll: narrow, continuous portrait paper. Height is auto so the
    // roll only advances as far as the content needs (no long blank labels).
    const isThermal =
      qrPaperSize === "Thermal 80mm" ||
      qrPaperSize === "Thermal 58mm" ||
      !Number.isFinite(heightRaw) ||
      heightRaw <= 0 ||
      width <= 100;

    const height = Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : 0;

    if (!isThermal && height <= 0) {
      toast({
        title: "Invalid page size",
        description: "Please enter a valid height in mm.",
        variant: "destructive",
      });
      return;
    }

    const qrCodeData = qrCodesData[selectedQRCodeItem];

    const qrImageUrl = qrCodeData.url_link || qrCodeData.qr_url || "";
    const safe = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let pageSizeCss;
    let bodyHeightCss;
    let sheetMinHeightCss;
    let sheetJustifyCss;
    let paddingMm;
    let gapMm;
    let qrSizeMm;
    let titleSizeMm;
    let metaSizeMm;
    let uidSizeMm;
    let labelSizeMm;
    let remarksSizeMm;

    if (isThermal) {
      // Base everything on the roll width; length grows with content.
      const printableWidth = width;
      pageSizeCss = `${width}mm auto`;
      bodyHeightCss = "auto";
      sheetMinHeightCss = "auto";
      sheetJustifyCss = "flex-start";
      paddingMm = Math.min(Math.max(printableWidth * 0.05, 2), 4);
      gapMm = Math.min(Math.max(printableWidth * 0.03, 1.5), 3);
      qrSizeMm = Math.max(printableWidth - paddingMm * 2 - 4, 30);
      titleSizeMm = Math.min(Math.max(printableWidth * 0.06, 3.6), 5);
      metaSizeMm = Math.min(Math.max(printableWidth * 0.042, 2.6), 3.6);
      uidSizeMm = Math.min(Math.max(printableWidth * 0.05, 3), 4.2);
      labelSizeMm = Math.min(Math.max(printableWidth * 0.038, 2.4), 3.2);
      remarksSizeMm = Math.min(Math.max(printableWidth * 0.04, 2.5), 3.4);
    } else {
      const minPageDim = Math.min(width, height);
      pageSizeCss = `${width}mm ${height}mm`;
      bodyHeightCss = `${height}mm`;
      sheetMinHeightCss = `${height}mm`;
      sheetJustifyCss = "center";
      paddingMm = Math.min(Math.max(minPageDim * 0.045, 6), 12);
      gapMm = Math.min(Math.max(minPageDim * 0.018, 2), 5);
      qrSizeMm = Math.min(Math.max(minPageDim * 0.34, 38), 78);
      titleSizeMm = Math.min(Math.max(minPageDim * 0.028, 4.2), 6.5);
      metaSizeMm = Math.min(Math.max(minPageDim * 0.02, 3), 4.5);
      uidSizeMm = Math.min(Math.max(minPageDim * 0.024, 3.5), 5.5);
      labelSizeMm = Math.min(Math.max(minPageDim * 0.018, 2.6), 4);
      remarksSizeMm = Math.min(Math.max(minPageDim * 0.019, 2.8), 4.2);
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>QR Print - ${safe(qrCodeData.qr_uid || "Label")}</title>
          <style>
            @page {
              size: ${pageSizeCss};
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: ${width}mm;
              height: ${bodyHeightCss};
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sheet {
              width: ${width}mm;
              min-height: ${sheetMinHeightCss};
              padding: ${paddingMm}mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: ${sheetJustifyCss};
              text-align: center;
              gap: ${gapMm}mm;
            }
            .top {
              width: 100%;
              flex: 0 0 auto;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: ${Math.max(gapMm * 0.6, 1.5)}mm;
            }
            .middle {
              width: 100%;
              flex: 0 0 auto;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .bottom {
              width: 100%;
              flex: 0 0 auto;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: ${Math.max(gapMm * 0.75, 2)}mm;
            }
            .title {
              font-size: ${titleSizeMm}mm;
              font-weight: 700;
              line-height: 1.2;
              color: #0f172a;
            }
            .meta {
              font-size: ${metaSizeMm}mm;
              line-height: 1.35;
              color: #1f2937;
            }
            .meta-row {
              width: 100%;
              display: flex;
              flex-direction: ${isThermal ? "column" : "row"};
              flex-wrap: wrap;
              align-items: center;
              justify-content: center;
              gap: ${Math.max(gapMm, 1.2)}mm ${Math.max(gapMm * 2, 4)}mm;
            }
            .meta-row .meta {
              flex: 0 1 auto;
              min-width: 0;
            }
            .qr-wrap {
              width: ${qrSizeMm}mm;
              height: ${qrSizeMm}mm;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 0.35mm solid #22c55e;
              border-radius: 1.5mm;
              padding: 2mm;
              background: #fff;
              box-sizing: border-box;
            }
            .qr {
              width: 100%;
              height: 100%;
              object-fit: contain;
              display: block;
            }
            .uid-block {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.8mm;
            }
            .uid {
              font-weight: 700;
              font-size: ${uidSizeMm}mm;
              color: #047857;
              line-height: 1.2;
              letter-spacing: 0.02em;
            }
            .label {
              font-size: ${labelSizeMm}mm;
              color: #4b5563;
              font-weight: 600;
            }
            .remarks {
              font-size: ${remarksSizeMm}mm;
              max-width: 100%;
              word-break: break-word;
              line-height: 1.35;
              color: #374151;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top">
              <div class="title">QR Code Information</div>
              <div class="meta"><span class="label">Item:</span> ${safe(qrCodeData.item_name || "-")}</div>
              <div class="meta"><span class="label">Our Brand:</span> ${safe(qrCodeData.our_brand || "-")}</div>
            </div>
            <div class="middle">
              ${qrImageUrl ? `<div class="qr-wrap"><img class="qr" src="${safe(qrImageUrl)}" alt="QR Code" /></div>` : ""}
            </div>
            <div class="bottom">
              <div class="uid-block">
                <div class="label">QR UID</div>
                <div class="uid">${safe(qrCodeData.qr_uid || "-")}</div>
              </div>
              <div class="meta-row">
                <div class="meta"><span class="label">Generated At:</span> ${safe(qrCodeData.created_at || "-")}</div>
                <div class="meta"><span class="label">Generated By:</span> ${safe(qrCodeData.created_by || qrCodeData.generated_by_name || "-")}</div>
              </div>
              <div class="remarks"><span class="label">Remarks:</span> ${safe(qrCodeData.remarks || "-")}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Use hidden iframe so popup blockers do not block print flow.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      toast({
        title: "Error",
        description: "Unable to initialize print preview.",
        variant: "destructive",
      });
      return;
    }

    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    };

    const qrImgEl = iframeDoc.querySelector("img");
    if (qrImgEl && !qrImgEl.complete) {
      qrImgEl.onload = triggerPrint;
      qrImgEl.onerror = triggerPrint;
    } else {
      setTimeout(triggerPrint, 200);
    }

    setIsQRPrintDialogOpen(false);
  };

  // Generate QR Label PDF with QR code and details
  const generateQRLabelPDF = async () => {
    if (!selectedQRCodeItem || !qrCodesData[selectedQRCodeItem] || !data) {
      toast({
        title: "Error",
        description: "QR code data or inward entry data is missing",
        variant: "destructive",
      });
      return;
    }

    const qrCodeData = qrCodesData[selectedQRCodeItem];

    try {
      setIsGeneratingPDF(true);

      // Dynamically import jsPDF and html2canvas
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Get the selected item for this QR code
      const selectedItem = items.find(item => item.id === selectedQRCodeItem);

      // Extract test parameters - look for specific parameter names
      const getTestParamValue = (paramName) => {
        // Search in labTestParams
        const param = labTestParams.find(p =>
          p.parameter_name && p.parameter_name.toLowerCase().includes(paramName.toLowerCase())
        );
        if (param) return param.value || '';

        // Search in selected item's lab_tests
        if (selectedItem && selectedItem.lab_tests) {
          const test = selectedItem.lab_tests.find(t =>
            t.parameter_name && t.parameter_name.toLowerCase().includes(paramName.toLowerCase())
          );
          if (test) return test.value || '';
        }

        return '';
      };

      // Extract specific test parameters
      const sizing = getTestParamValue('sizing') || getTestParamValue('size');
      const fullBody = getTestParamValue('full body') || getTestParamValue('fullbody');
      const fullBodyMOI = getTestParamValue('moi') || '';
      const halfBody = getTestParamValue('half body') || getTestParamValue('halfbody');
      const dots = getTestParamValue('dots');
      const kawadi = getTestParamValue('kawadi');
      const sawa = getTestParamValue('sawa');
      const green = getTestParamValue('green');
      const broken = getTestParamValue('broken') || getTestParamValue('3/4 broken') || getTestParamValue('3/4');
      const gund = getTestParamValue('gund');
      const dunk = getTestParamValue('dunk');
      const tenGramCounts = getTestParamValue('10gram') || getTestParamValue('10 gram') || getTestParamValue('counts');

      // Format date
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = String(date.getFullYear()).slice(-2);
          return `${day}/${month}/${year}`;
        } catch {
          return dateStr;
        }
      };

      // Create a temporary container for PDF content
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '210mm'; // A4 width
      pdfContainer.style.backgroundColor = 'white';
      pdfContainer.style.padding = '20mm';
      pdfContainer.style.fontFamily = 'Arial, Helvetica, sans-serif';
      pdfContainer.style.fontSize = '14px';
      pdfContainer.style.lineHeight = '1.6';
      // console.log("QR CODE DATA"+ data.created_at)
      // Generate label HTML content - matching the white label format
      const labelHTML = `
        <div style="background: white; padding: 30px; font-family: Arial, sans-serif;">
          <div style="text-align: center; margin-bottom: 25px;">
            ${qrCodeData.url_link || qrCodeData.qr_url ? `
              <img
                src="${qrCodeData.url_link || qrCodeData.qr_url}"
                alt="QR Code"
                style="max-width: 180px; max-height: 180px; border: 2px solid #000; padding: 15px; background: white; display: inline-block;"
              />
            ` : ''}
          </div>

          <div style="font-weight: bold; font-size: 18px; line-height: 1.8; color: #000; text-align: left;">
            <div style="margin-bottom: 10px;"><strong>PARTY NAME:</strong> ${data.party_name || 'N/A'}</div>
            <div style="margin-bottom: 10px;"><strong>DATE:</strong> ${data.created_at}</div>
            <div style="margin-bottom: 10px;"><strong>ITEM:</strong> ${selectedItem ? selectedItem.item_name : 'N/A'}</div>
            <div style="margin-bottom: 10px;"><strong>BRAND:</strong> ${selectedItem ? (selectedItem.brand || selectedItem.our_brand || 'N/A') : 'N/A'}</div>
            <div style="margin-bottom: 10px;"><strong>VEHICLE:</strong> ${data.vehicle_no || 'N/A'}</div>
            ${sizing ? `<div style="margin-bottom: 10px;"><strong>SIZING:</strong> ${sizing}</div>` : ''}
            ${fullBody || fullBodyMOI ? `
              <div style="margin-bottom: 10px;">
                <strong>FULL BODY:</strong> ${fullBody ? fullBody + '%' : ''} ${fullBodyMOI ? (fullBody ? ' ' : '') + 'MOI: ' + fullBodyMOI : ''}
              </div>
            ` : ''}
            ${halfBody ? `<div style="margin-bottom: 10px;"><strong>HALF BODY:</strong> ${halfBody}%</div>` : ''}
            ${dots ? `<div style="margin-bottom: 10px;"><strong>DOTS:</strong> ${dots}%</div>` : ''}
            ${kawadi ? `<div style="margin-bottom: 10px;"><strong>KAWADI:</strong> ${kawadi}%</div>` : ''}
            ${sawa ? `<div style="margin-bottom: 10px;"><strong>SAWA:</strong> ${sawa}%</div>` : ''}
            ${green ? `<div style="margin-bottom: 10px;"><strong>GREEN:</strong> ${green}%</div>` : ''}
            ${broken ? `<div style="margin-bottom: 10px;"><strong>3/4 BROKEN:</strong> ${broken}%</div>` : ''}
            ${gund ? `<div style="margin-bottom: 10px;"><strong>GUND:</strong> ${gund}%</div>` : ''}
            ${dunk ? `<div style="margin-bottom: 10px;"><strong>DUNK:</strong> ${dunk}%</div>` : ''}
            ${tenGramCounts ? `<div style="margin-bottom: 10px;"><strong>10gram Counts:</strong> ${tenGramCounts}</div>` : ''}
          </div>
        </div>
      `;

      pdfContainer.innerHTML = labelHTML;
      document.body.appendChild(pdfContainer);

      // Wait for QR code image to load
      const qrImage = pdfContainer.querySelector('img');
      if (qrImage) {
        await new Promise((resolve) => {
          if (qrImage.complete) {
            resolve();
          } else {
            qrImage.onload = resolve;
            qrImage.onerror = resolve; // Continue even if image fails
          }
        });
      }

      // Convert to canvas
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min((pdfWidth - 40) / imgWidth, (pdfHeight - 40) / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      const xOffset = (pdfWidth - imgScaledWidth) / 2;
      const yOffset = (pdfHeight - imgScaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);

      // Clean up
      document.body.removeChild(pdfContainer);

      // Download the PDF
      const filename = `QR_Label_${data.party_name || 'Label'}_${data.created_at.replace(/\//g, '-')}.pdf`;
      pdf.save(filename);

      toast({
        title: "PDF Downloaded",
        description: "QR label PDF has been downloaded",
        className: "bg-green-50 border-green-100 text-green-800",
      });
    } catch (error) {
      console.error('Error generating QR label PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR label PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Generate PDF content HTML - Compact 2-page version
  const generatePDFContent = (orgName, branchName, generatedBy = '') => {
    const statusColors = {
      'pending': '#fbbf24',
      'approved': '#10b981',
      'rejected': '#ef4444',
      'unloaded': '#3b82f6',
      'unloaded_but_rejected': '#ef4444',
      'assignment_pending': '#f59e0b',
      'completed': '#10b981'
    };


    const getStatusColor = (status) => statusColors[status?.toLowerCase()] || '#6b7280';

    // Collect all images
    const allImages = [
      ...(Array.isArray(images) ? images : []),
      ...(Array.isArray(items) ? items.flatMap((it) => Array.isArray(it.images) ? it.images : []) : [])
    ].filter((im) => im && im.image_url);

    return `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; margin: 0; padding: 0; border: 2px solid #e5e7eb;">
        <!-- Organization and Branch Header -->
        ${orgName || branchName ? `
        <div style="text-align: center; margin-bottom: 15px; padding: 12px; background: #f8fafc; border-bottom: 2px solid #2563eb; border-radius: 4px;">
          ${orgName ? `
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e40af;">${orgName}</p>
          ` : ''}
          ${branchName ? `
            <p style="margin: ${orgName ? '5px 0 0' : '0'}; font-size: 12px; font-weight: 600; color: #374151;">${branchName}</p>
          ` : ''}
          </div>
        ` : ''}

        <!-- Compact Header -->
        <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #2563eb;">
          <h1 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">INWARD ENTRY DETAILS</h1>

          <div style="display: flex; justify-content: center; align-items: center; gap: 20px; font-size: 10px; color: #6b7280; margin-top: 10px; flex-wrap: wrap;">
            <p style="margin: 0; padding: 4px 8px;  border-radius: 4px;">Entry: <strong> #${data.sl_no || 'N/A'} </strong></p>
            <p style="margin: 0;">Generated by: <strong style="color: #374151;">${generatedBy || 'N/A'}</strong></p>
            <p style="margin: 0;">Generated at: <strong style="color: #374151;">${new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</strong></p>
        </div>
            </div>
        <!-- Summary Table - Compact -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; border: 1px solid #e5e7eb;">
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>PO Date:</strong> ${data.date || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Party:</strong> ${data.party_name || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Vehicle:</strong> ${data.vehicle_no || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Bill No:</strong> ${data.bill_no || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Items:</strong> ${data.total_items || 0}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Bags:</strong> ${data.total_bags || 0}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Weight:</strong> ${formatTotalWeightDisplay(data.total_weight, data.total_weight_unit, 'Qtl')}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Driver:</strong> ${data.driver_name || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Broker:</strong> ${data.broker_name || 'N/A'}</td>
          </tr>
          ${data.driver_phone || data.supervised_by || data.verified_by ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Driver Phone:</strong> ${data.driver_phone || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Supervisor:</strong> ${data.supervised_by || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Verified By:</strong> ${data.verified_by || 'N/A'}</td>
          </tr>
          ` : ''}
        </table>

            ${data.remarks ? `
          <div style="margin-bottom: 15px; padding: 8px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 10px; border-radius: 3px;">
            <strong>Remarks:</strong> ${data.remarks}
              </div>
            ` : ''}

        <!-- Items Section - Compact -->
        ${items && items.length > 0 ? `
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">
            ITEMS (${items.length})
          </h3>
          ${items.map((item, index) => `
            <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; background: #fafafa;">
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 11px; color: #1e40af;">${item.item_name || 'Unknown'}</strong>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px;">
                <tr>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Supplier Brand:</strong> ${item.brand || 'N/A'}</td>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Our Brand:</strong> ${item.our_brand || 'N/A'}</td>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Quality:</strong> ${item.quality_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Bags:</strong> ${item.number_of_bags || 0}</td>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Total Weight:</strong> ${formatInwardItemTotalWeightDisplay(item.total_weight, item.alternate_unit)}</td>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Net Weight:</strong> ${item.net_weight || 'N/A'}</td>
                </tr>
                ${item.godown_location || item.supervisor ? `
                  <tr>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Godown:</strong> ${item.godown_location || 'N/A'}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Supervisor:</strong> ${item.supervisor || 'N/A'}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"></td>
                  </tr>
                ` : ''}
                ${item.weight_breakdowns && item.weight_breakdowns.length > 0 ? `
                  <tr>
                    <td colspan="3" style="padding: 8px; border: 1px solid #e5e7eb; background: #fff7ed; font-size: 9px;">
                      <strong>Weight Breakdowns:</strong>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9px;">
                        <thead style="background: #f9fafb;">
                          <tr>
                            <th style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">Status Type</th>
                            <th style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">Bags</th>
                            <th style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">Weight</th>
                            <th style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${item.weight_breakdowns.map((w, idx) => `
                            <tr>
                              <td style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">${w.status_type_display || w.status_type || 'N/A'}</td>
                              <td style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">${w.number_of_bags || 0}</td>
                              <td style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">${w.weight || 'N/A'}</td>
                              <td style="padding: 5px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">${w.remarks || '-'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ` : ''}
              ${item.remarks ? `
                  <tr>
                    <td colspan="3" style="padding: 6px; border: 1px solid #e5e7eb; font-size: 9px; color: #78350f; text-align: center; vertical-align: middle;">
                      <strong>Remarks:</strong> ${item.remarks}
                    </td>

                  </tr>
              ` : ''}
              </table>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- JALI Details - Compact -->
        ${jaliDetails && jaliDetails.length > 0 ? `
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">
            JALI DETAILS (${jaliDetails.length})
          </h3>
          ${jaliDetails.map((jali, index) => {
      const relatedItem = items.find(item => item.id === jali.item_id);
      return `
              <div style="margin-bottom: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 10px; background: #fafafa;">
                <strong>${index + 1}. ${relatedItem ? relatedItem.item_name : 'Unknown'}</strong>
                <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px;">
                  <tr>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Gross:</strong> ${jali.gross_weight || jali.weight_value || 'N/A'}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Tare:</strong> ${jali.tare_weight || 'N/A'}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Net:</strong> ${jali.net_weight || 'N/A'}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Bags:</strong> ${jali.number_of_bags || jali.bags_count || 0}</td>
                  </tr>
                  ${jali.jali_number ? `
                    <tr>
                      <td colspan="2" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>JALI Number:</strong> ${jali.jali_number}</td>
                      <td colspan="2" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Weight Type:</strong> ${jali.weight_type_display || jali.weight_type || 'N/A'}</td>
                    </tr>
                  ` : ''}
                  ${jali.jali_remarks ? `
                    <tr>
                      <td colspan="4" style="padding: 6px; border: 1px solid #e5e7eb; font-size: 9px; text-align: center; vertical-align: middle;"><strong>Remarks:</strong> ${jali.jali_remarks}</td>
                    </tr>
                  ` : ''}
                </table>
              </div>
            `;
    }).join('')}
        </div>
        ` : ''}

        <!-- Lab Test Parameters - Compact -->
        ${labTestParams && labTestParams.length > 0 ? `
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">
            LAB TEST PARAMETERS (${labTestParams.length})
          </h3>
          ${labTestParams.map((param, index) => {
      const relatedItem = items.find(item => item.id === param.item_id);
      return `
              <div style="margin-bottom: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 10px; background: #fafafa;">
                <strong>${index + 1}. ${relatedItem ? relatedItem.item_name : 'Unknown'}</strong>
                <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px;">
                  <tr>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Parameter:</strong> ${param.parameter_name || 'N/A'}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Value:</strong> ${param.value || 'N/A'} ${param.unit || ''}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle;"><strong>Status:</strong> ${(param.status || 'Unknown').toUpperCase().replace(/_/g, ' ')}</td>
                  </tr>
                ${param.remarks ? `
                    <tr>
                      <td colspan="3" style="padding: 6px; border: 1px solid #e5e7eb; font-size: 9px; color: #78350f; text-align: center; vertical-align: middle;">
                        <strong>Remarks:</strong> ${param.remarks}
                      </td>
                    </tr>
                ` : ''}
                </table>
              </div>
            `;
    }).join('')}
        </div>
        ` : ''}

        <!-- Lab Testing Results - Compact -->
        ${items.some(item => item.lab_tests && item.lab_tests.length > 0) ? `
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">
            LAB TESTING RESULTS
          </h3>
          ${items.filter(item => item.lab_tests && item.lab_tests.length > 0).map((item, itemIndex) => {
      const preTests = item.lab_tests.filter(test => test.test_type === 'pre_testing');
      const postTests = item.lab_tests.filter(test => test.test_type === 'post_testing' || test.test_type === 're_testing');
      const allParams = [...new Set([...preTests, ...postTests].map(test => test.parameter_name))];

      // Get unique breakdowns from post-tests (using Map to ensure uniqueness by ID)
      const breakdownMap = new Map();
      postTests
        .filter(test => test.breakdown)
        .forEach(test => {
          const breakdownId = test.breakdown.id;
          if (!breakdownMap.has(breakdownId)) {
            breakdownMap.set(breakdownId, {
              id: breakdownId,
              status_type: test.breakdown.status_type_display || test.breakdown.status_type,
              number_of_bags: test.breakdown.number_of_bags
            });
          }
        });
      const postTestBreakdowns = Array.from(breakdownMap.values());

      // Check if there are any post-tests with breakdowns
      const hasBreakdownTests = postTestBreakdowns.length > 0;
      // Check if there are any post-tests without breakdowns (main item)
      const hasMainItemTests = postTests.some(test => !test.breakdown);

      return `
              <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 10px; background: #fafafa;">
                <strong>${itemIndex + 1}. ${item.item_name || 'Unknown'}</strong>
                <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px;">
                    <thead style="background: #f9fafb;">
                      <tr>
                        <th rowspan="${hasBreakdownTests ? 2 : 1}" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 10px;">Parameter</th>
                        <th rowspan="${hasBreakdownTests ? 2 : 1}" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 10px;">Pre-Testing</th>
                        ${hasBreakdownTests || hasMainItemTests ? `
                          ${hasBreakdownTests ? `<th colspan="${postTestBreakdowns.length}" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 10px;">Post-Testing (Breakdowns)</th>` : ''}
                          ${hasMainItemTests ? `<th rowspan="${hasBreakdownTests ? 2 : 1}" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 10px;">Post-Testing<br/>(Main Item)</th>` : ''}
                        ` : `
                          <th rowspan="1" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 10px;">Post-Testing</th>
                        `}
                        <th rowspan="${hasBreakdownTests ? 2 : 1}" style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 10px;">Net Testing</th>
                      </tr>
                      ${hasBreakdownTests ? `
                        <tr>
                          ${postTestBreakdowns.map((breakdown) => `
                            <th style="padding: 4px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 9px;">
                              ${breakdown.status_type}<br/>
                              <span style="font-size: 8px; color: #6b7280;">(${breakdown.number_of_bags} bags)</span>
                            </th>
                          `).join('')}
                        </tr>
                      ` : ''}
                    </thead>
                    <tbody>
                    ${allParams.map((paramName) => {
        const preTest = preTests.find(test => test.parameter_name === paramName);
        const paramPostTests = postTests.filter(test => test.parameter_name === paramName);

        // Group post-tests by breakdown
        const postTestsByBreakdown = paramPostTests.reduce((acc, test) => {
          const key = test.breakdown ? test.breakdown.id : 'main';
          if (!acc[key]) acc[key] = [];
          acc[key].push(test);
          return acc;
        }, {});

        const postOnlyTests = item.lab_tests.filter(
          (test) => test.test_type === 'post_testing' && test.parameter_name === paramName
        );
        const latestPostForDiff = getLatestInwardTest(postOnlyTests);
        const differenceDetails = computeInwardTestDifferenceDetails(preTest, latestPostForDiff);

        return `
                        <tr>
                          <td style="padding: 6px; border: 1px solid #e5e7eb; font-size: 9px; text-align: center; vertical-align: middle;">${paramName}</td>
                          <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 9px;">${preTest ? (preTest.value || 'N/A') + ' ' + (preTest.unit || '') : '0'}</td>
                          ${hasBreakdownTests || hasMainItemTests ? `
                            ${hasBreakdownTests ? postTestBreakdowns.map((breakdown) => {
          const breakdownTests = postTestsByBreakdown[breakdown.id] || [];
          const values = breakdownTests.length > 0
            ? breakdownTests.map(test => {
              const baseValue = (test.value || 'N/A') + ' ' + (test.unit || '');
              return test.test_type === 're_testing' ? baseValue + ' <span style="color: #ea580c; font-weight: 600;">(Re-Test)</span>' : baseValue;
            }).join(', ')
            : '0';
          return `<td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 9px; color: #16a34a;">${values}</td>`;
        }).join('') : ''}
                            ${hasMainItemTests ? (() => {
              const mainTests = postTestsByBreakdown['main'] || [];
              const values = mainTests.length > 0
                ? mainTests.map(test => {
                  const baseValue = (test.value || 'N/A') + ' ' + (test.unit || '');
                  return test.test_type === 're_testing' ? baseValue + ' <span style="color: #ea580c; font-weight: 600;">(Re-Test)</span>' : baseValue;
                }).join(', ')
                : '0';
              return `<td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 9px; color: #16a34a;">${values}</td>`;
            })() : ''}
                          ` : `
                            <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 9px; color: #16a34a;">
                              ${paramPostTests.length > 0
            ? paramPostTests.map(test => {
              const baseValue = (test.value || 'N/A') + ' ' + (test.unit || '');
              return test.test_type === 're_testing' ? baseValue + ' <span style="color: #ea580c; font-weight: 600;">(Re-Test)</span>' : baseValue;
            }).join(', ')
            : '0'}
                            </td>
                          `}
                          <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; font-size: 9px; color: #1d4ed8; font-weight: ${differenceDetails.isIncrease ? '700' : '500'};">
                            ${differenceDetails.text}
                          </td>
                          </tr>
                        `;
      }).join('')}
                    </tbody>
                  </table>
              </div>
            `;
    }).join('')}
        </div>
        ` : ''}

        ${allImages.length > 0 ? `
        <!-- Images Section - Compact Grid -->
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">
            IMAGES (${allImages.length})
          </h3>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
            ${allImages.map((image, idx) => {
      // Try multiple possible field names for image name
      const imageName = image.image_name || image.name || image.file_name || image.filename || image.title || `Image ${idx + 1}`;
      return `
              <div style="border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; background: #f9fafb;">
                <div style="width: 100%; padding-top: 100%; position: relative; overflow: hidden;">
                  <img src="${image.image_url}" alt="${imageName}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" />
              </div>
                <div style="padding: 4px; text-align: center; font-size: 8px; color: #374151; background: white; border-top: 1px solid #e5e7eb; font-weight: 500; line-height: 1.2;">
                  ${imageName}
          </div>
        </div>
            `;
    }).join('')}
                  </div>
        </div>
        ` : ''}

        ${data.tested_by || data.test_date ? `
        <!-- Testing Info - Compact -->
        <div style="margin-bottom: 15px; padding: 8px; background: #f0fdf4; border-left: 4px solid #10b981; font-size: 10px; border-radius: 3px;">
          <strong>Testing:</strong> ${data.tested_by || 'N/A'} | <strong>Date:</strong> ${data.test_date || 'N/A'}
          ${data.lab_tech_remarks ? ` | <strong>Remarks:</strong> ${data.lab_tech_remarks}` : ''}
        </div>
        ` : ''}

        <!-- Footer - Compact -->
        <div style="margin-top: 15px; padding-top: 8px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 9px; color: #6b7280;">
          <p style="margin: 0;">Generated on ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} | Entry #${data.sl_no || 'N/A'}</p>
        </div>
      </div>
    `;
  };
  const statusColors = {
    approved: "bg-green-100 text-green-700",
    completed: "bg-green-200 text-green-800",
    rejected: "bg-red-100 text-red-700",
    unloaded_but_rejected: "bg-red-200 text-red-800",
    pending: "bg-yellow-100 text-yellow-700",
    "assignment-pending": "bg-yellow-200 text-yellow-800",
    unloaded: "bg-blue-100 text-blue-700",
    "not uploaded": "bg-gray-100 text-gray-700",
  };

  if (loading) return <CommonLoader text="Loading inward details..." />;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!data) return <div className="p-6">No data found</div>;

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main-content">
        {/* Mobile Header */}
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Inward Details
            </h1>
            <div className="w-10" />
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto space-y-6">
          {/* Back Button */}
          <Button
            variant="outline"
            onClick={handleBackToList}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>

          {/* Header Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Inward Entry #{data.sl_no}</span>
                <div className="relative z-10 flex shrink-0 items-center space-x-3">
                  {/* Show Generate All QR Codes button only if status is completed */}
                  {data.status === 'completed' && (
                    <Button
                      onClick={() => {
                        generateQRCode();
                      }}
                      disabled={isGeneratingQR}
                      className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>{isGeneratingQR ? "Generating..." : "Generate All QR Codes"}</span>
                    </Button>
                  )}
                  <Button
                    onClick={() => setIsPdfLanguageDialogOpen(true)}
                    disabled={isGeneratingPDF}
                    className="relative z-10 shrink-0 flex items-center space-x-2 bg-blue-600 hover:bg-green-800 text-white"
                  >
                    <Download className="h-4 w-4" />
                    <span>{isGeneratingPDF ? "Processing Images..." : "Download PDF"}</span>
                  </Button>
                  <span className={`text-center text-sm px-2 py-1 rounded
                                 ${statusColors[data.status] || "bg-gray-200 text-gray-800"}
                                `}>{capitalizeFirst(data.status)}
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <CalendarDays className="w-4 h-4 text-gray-500" />
                  <span>{data.date}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>
                    {data.party_name}
                    <br></br>
                    {data.urd_party && data.urd_party.trim() !== "" && (
                      <span> (Party Name: {data.urd_party})</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-gray-500" />
                  <span>{data.vehicle_no}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span>Total Items: {data.total_items}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Weight className="w-4 h-4 text-gray-500" />
                  <span>
                    Total Weight:{" "}
                    {formatTotalWeightDisplay(
                      data.total_weight,
                      data.total_weight_unit,
                      "Qtl"
                    )}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span>Total Quantity: {data.total_bags}</span>
                </div>
                <div className="flex items-center space-x-2 min-w-0">
                  <Package className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="truncate">Bill No: {data.bill_no}</span>
                </div>
                {data.purchase_order_no ? (
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">PO: {data.purchase_order_no}</span>
                  </div>
                ) : null}
                {hasSalesReturnAccess && data.sales_return_no ? (
                  <div className="flex items-center space-x-2 min-w-0">
                    <Receipt className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">Sales Return: {data.sales_return_no}</span>
                  </div>
                ) : null}
                {hasSalesReturnAccess && data.sales_return_status ? (
                  <div className="flex items-center space-x-2 min-w-0">
                    <Tag className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate capitalize">Return Status: {data.sales_return_status}</span>
                  </div>
                ) : null}
                {hasSalesReturnAccess && data.return_type ? (
                  <div className="flex items-center space-x-2 min-w-0">
                    <Tag className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate capitalize">
                      Return Type: {String(data.return_type).replaceAll("_", " ")}
                    </span>
                  </div>
                ) : null}
                {hasSalesReturnAccess && data.sales_return_remarks ? (
                  <div className="flex items-start space-x-2 min-w-0 sm:col-span-2">
                    <FileText className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 line-clamp-2">
                      Return Remarks: {data.sales_return_remarks}
                    </span>
                  </div>
                ) : null}
                {(data.po_voice_remarks || "").trim() ? (
                  <div className="flex items-center space-x-2 min-w-0">
                    <Volume2 className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-gray-600 whitespace-nowrap shrink-0">PO Voice Remarks:</span>
                    <VoiceRemarkPlaybackButton
                      url={data.po_voice_remarks}
                      title="Play purchase order voice remarks"
                      size="icon"
                    />
                  </div>
                ) : null}

              </div>

              {(() => {
                const entryImages = (Array.isArray(data?.images) && data.images.length
                  ? data.images
                  : Array.isArray(images)
                    ? images
                    : []
                ).filter(
                  (img) =>
                    img &&
                    img !== "No images updated" &&
                    !img.item_id &&
                    String(img.image_url || img.url || "").trim()
                );
                if (!entryImages.length) return null;
                return (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Image className="h-4 w-4 text-gray-600" />
                      <h4 className="text-sm font-semibold text-gray-800">Entry Images</h4>
                      <Badge variant="outline" className="text-[10px]">
                        {entryImages.length}
                      </Badge>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                        {entryImages.map((image, index) => (
                          <InwardMediaThumb
                            key={image.id || `entry-img-${index}`}
                            image={image}
                            index={index}
                            onView={(img) =>
                              openInwardMediaViewer(img, {
                                setSelectedImage,
                                setIsImageDialogOpen,
                                setImageZoom,
                                setImagePosition,
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Invoice Summary Section */}
          {data.invoice_summary && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-green-800">
                  <Receipt className="h-5 w-5" />
                  <span>Invoice Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Invoiced Items</p>
                    <p className="font-semibold text-lg text-green-700">{data.invoice_summary.total_invoiced_items || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Invoice Amount</p>
                    <p className="font-semibold text-lg text-green-700">
                      ₹{data.invoice_summary.total_invoice_amount ? parseFloat(data.invoice_summary.total_invoice_amount).toFixed(2) : '0.00'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Invoice Numbers</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {data.invoice_summary.invoice_numbers && data.invoice_summary.invoice_numbers.length > 0 ? (
                        data.invoice_summary.invoice_numbers.map((invNum, idx) => (
                          <Badge key={idx} variant="outline" className="bg-white">
                            {invNum}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-500">No invoices</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600">Invoice Number</p>
                    <p className="font-semibold text-lg text-green-700">{data.invoice_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Additional Amount</p>
                    <p className="font-semibold text-lg text-green-700">
                      ₹{data.additional_payment ? parseFloat(data.additional_payment).toFixed(2) : '0.00'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* QR Code Dialog/Popup */}
          <Dialog open={isQRCodeDialogOpen} onOpenChange={setIsQRCodeDialogOpen}>
            <DialogContent className="max-w-3xl gap-3 p-5 sm:p-6">
              <DialogHeader className="space-y-1">
                <DialogTitle className="flex items-center justify-between pr-8">
                  <span className="flex items-center space-x-2 text-green-800">
                    <QrCode className="h-5 w-5 shrink-0" />
                    <span>QR Code Information</span>
                  </span>
                  {/* Download PDF Icon */}
                  {selectedQRCodeItem && qrCodesData[selectedQRCodeItem] && data && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        onClick={() => setIsQRPrintDialogOpen(true)}
                        variant="ghost"
                        size="sm"
                        className="text-green-700 hover:text-green-800 hover:bg-green-100"
                        title="Print setup"
                      >
                        <Printer className="h-5 w-5" />
                      </Button>
                      <Button
                        onClick={generateQRLabelPDF}
                        disabled={isGeneratingPDF}
                        variant="ghost"
                        size="sm"
                        className="text-green-700 hover:text-green-800 hover:bg-green-100"
                        title={isGeneratingPDF ? "Generating PDF..." : "Download PDF Sticker"}
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </DialogTitle>
              </DialogHeader>
              {selectedQRCodeItem && qrCodesData[selectedQRCodeItem] && (() => {
                const qrCodeData = qrCodesData[selectedQRCodeItem];
                return (
                  <div className="flex flex-col items-center space-y-3 py-1">
                    {/* Item Name */}
                    {qrCodeData.item_name && (
                      <div className="text-center w-full space-y-1">
                        <p className="text-base text-gray-700">
                          <span className="font-semibold text-xl">Item: </span>
                          <span className="text-gray-900 font-medium text-2xl">{qrCodeData.item_name}</span>
                        </p>
                        <p className="text-base text-gray-700">
                          <span className="font-semibold text-xl">Our Brand: </span>
                          <span className="text-gray-900 font-medium text-2xl">{qrCodeData.our_brand}</span>
                        </p>
                      </div>
                    )}

                    {/* QR Code Image */}
                    {(qrCodeData.url_link || qrCodeData.qr_url) && (
                      <div className="flex items-center justify-center">
                        <img
                          src={qrCodeData.url_link || qrCodeData.qr_url}
                          alt="QR Code"
                          className="w-[180px] h-[180px] border-2 border-green-300 rounded-lg bg-white shadow-md object-contain"
                        />
                      </div>
                    )}

                    {/* QR UID */}
                    <div className="text-center w-full space-y-2">
                      <div>
                        <span className="font-semibold text-gray-700 text-xl">QR UID: </span>
                        <span className="text-green-700 font-mono text-sm font-bold text-xl">{qrCodeData.qr_uid}</span>
                      </div>

                      {/* Unloaded By & Unloaded On */}
                      <div className="grid grid-cols-2 gap-x-10 gap-y-1 w-full px-1">
                        <div className="text-center min-w-0">
                          <span className="font-semibold text-gray-700 text-sm block mb-0.5 text-xl">Unloaded By:</span>
                          <span className="text-gray-900 font-medium  text-2xl">
                            {qrCodeData.unloaded_by || "-"}
                          </span>
                        </div>
                        <div className="text-center min-w-0">
                          <span className="font-semibold text-gray-700 text-sm block mb-0.5 text-xl">Unloaded On:</span>
                          <span className="text-gray-900 font-medium  text-2xl whitespace-nowrap">
                            {qrCodeData.unloaded_on || "-"}
                          </span>
                        </div>
                      </div>

                      {qrCodeData.remarks !== undefined && qrCodeData.remarks !== null && (
                        <p className="text-base text-gray-700 pt-0.5">
                          <span className="font-semibold text-xl">Remarks: </span>
                          <span className="text-gray-900 font-medium text-2xl">{qrCodeData.remarks || "NA"}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          <Dialog open={isQRPrintDialogOpen} onOpenChange={setIsQRPrintDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  QR Print Setup
                </DialogTitle>
                <DialogDescription>
                  Choose paper size from dropdown or enter custom page width/height in millimeters.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm mb-2 block">Paper Size</Label>
                  <Select value={qrPaperSize} onValueChange={handleQrPaperSizeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select paper size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Thermal 80mm">Thermal Roll 80mm</SelectItem>
                      <SelectItem value="Thermal 58mm">Thermal Roll 58mm</SelectItem>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="A3">A3</SelectItem>
                      <SelectItem value="A5">A5</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                      <SelectItem value="Legal">Legal</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm mb-2 block">Width (mm)</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={qrPrintWidthMm}
                      onChange={(e) => setQrPrintWidthMm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-2 block">Height (mm)</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={qrPrintHeightMm}
                      disabled={qrPaperSize === "Thermal 80mm" || qrPaperSize === "Thermal 58mm"}
                      placeholder={
                        qrPaperSize === "Thermal 80mm" || qrPaperSize === "Thermal 58mm"
                          ? "Auto"
                          : ""
                      }
                      onChange={(e) => setQrPrintHeightMm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  {qrPaperSize === "Thermal 80mm" || qrPaperSize === "Thermal 58mm" ? (
                    <>
                      Thermal roll: {qrPrintWidthMm || "-"}mm wide, auto (continuous)
                      length, portrait.
                    </>
                  ) : (
                    <>Selected page: {qrPrintWidthMm || "-"}mm x {qrPrintHeightMm || "-"}mm</>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsQRPrintDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={printQRCodeLabel}>
                    Print
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={startUnloadingDialogOpen}
            onOpenChange={(open) => {
              setStartUnloadingDialogOpen(open);
              if (!open) setStartUnloadingItem(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-amber-600" />
                  Start Unloading
                </DialogTitle>
                <DialogDescription>
                  This will record the current time as unloading start time for{" "}
                  <span className="font-medium text-gray-900">
                    {startUnloadingItem?.item_name || "this item"}
                  </span>
                  . You can then enter unload details and mark as unloaded.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartUnloadingDialogOpen(false);
                    setStartUnloadingItem(null);
                  }}
                  disabled={isStartingUnloading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStartUnloading}
                  disabled={isStartingUnloading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isStartingUnloading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Confirm Start
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Items List */}
          {items && items.length > 0 ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <Package className="h-6 w-6" />
                <span>Items ({items.length})</span>
              </h2>

              {items.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Package className="h-5 w-5" />
                        <span>{item.item_name}</span>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {capitalizeFirst(item.status)}
                        </Badge>
                      </CardTitle>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex space-x-2">
                        {item.status === 'pending' && (
                          <>
                            <Button
                              // variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              size="sm"
                              onClick={() => handleApprove(item)}
                              disabled={isUpdating}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReject(item)}
                              disabled={isUpdating}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {(item.status === 'approved' || item.status === 'not_unloaded') && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(item)}
                            disabled={isUpdating}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        )}
                        {item.status === 'not_unloaded' &&
                          canSupervisorUnload &&
                          stackwiseUnloadingEnabled &&
                          hasUnloadingStarted(item) && (
                          <Button
                            type="button"
                            variant={stackingOpenByItem[item.id] ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleStackingPanel(item.id)}
                            disabled={isUpdating}
                            title="Optional row-wise stacking details"
                          >
                            <Layers className="w-4 h-4" />
                          </Button>
                        )}
                        {(item.status === 'pending' ||
                          item.status === 'approved' ||
                          item.status === 'not_unloaded') &&
                          renderVoiceRemarkMic()}
                        {/* QR Code button for completed items */}
                        {item.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewQRCode(item.id)}
                            className="flex items-center space-x-1 border-green-600 text-green-700 hover:bg-green-50"
                            title={qrCodesData[item.id] ? "View QR Code" : "Generate QR Code"}
                          >
                            <QrCode className="w-4 h-4" />
                            <span>{qrCodesData[item.id] ? "View QR" : "Generate QR"}</span>
                          </Button>
                        )}
                        </div>
                        {(item.status === 'pending' ||
                          item.status === 'approved' ||
                          item.status === 'not_unloaded') &&
                          renderVoiceRemarkStatus()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Brand</p>
                        <p className="font-medium">{item.brand || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Our Brand</p>
                        <p className="font-medium">{item.our_brand || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Quality</p>
                        <p className="font-medium">{item.quality_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Quantity</p>
                        <p className="font-medium">
                          {item.number_of_bags || 0  }
                          { " " + item.base_unit }
                         
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Weight</p>
                        <p className="font-medium">
                          {formatInwardItemTotalWeightDisplay(
                              item.total_weight,
                              item.alternate_unit || item.base_unit
                            )}
                        </p>
                      </div>
                      {/* <div>
                        <p className="text-gray-500">Priority Level</p>
                        <p className="font-medium">{item.priority_level || 'N/A'}</p>
                      </div> */}
                      <div>
                        <p className="text-gray-500">Godown Location</p>
                        <p className="font-medium">{item.godown_location || 'Not Assigned'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Supervisor</p>
                        <p className="font-medium">
                          {item.supervisor || 'Not Assigned'}
                          {item.unloading_time_taken ? (
                            <span className="ml-2 text-sm font-normal text-gray-600">
                              ({item.unloading_time_taken})
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <InwardItemRemarksSection item={item} className="border-t pt-4 mt-2" />

                    {item.status === 'not_unloaded' && canSupervisorUnload && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center space-x-2">
                          <Truck className="h-4 w-4" />
                          <span>Supervisor Unloading</span>
                        </h4>

                        {!hasUnloadingStarted(item) ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm text-amber-900 mb-3">
                              Start unloading to record the start time before entering unload
                              details.
                            </p>
                            <Button
                              type="button"
                              onClick={() => openStartUnloadingDialog(item)}
                              disabled={isUpdating || isStartingUnloading}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              <PlayCircle className="w-4 h-4 mr-2" />
                              Start Unloading
                            </Button>
                          </div>
                        ) : (
                          <>
                        {item.unloading_start_time && (
                          <p className="text-xs text-gray-500 mb-3">
                            Unloading started at:{" "}
                            <span className="font-medium text-gray-700">
                              {item.unloading_start_time}
                            </span>
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Unload Status *
                            </label>
                            <Select
                              value={getSupervisorUnloadForm(item.id).status}
                              onValueChange={(value) =>
                                updateSupervisorUnloadForm(item.id, { status: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unloaded">Unloaded</SelectItem>
                                <SelectItem value="unloaded_but_rejected">Unloaded but Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Unloaded Weight
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Enter unloaded weight"
                              value={getSupervisorUnloadForm(item.id).unloaded_weight}
                              onChange={(e) =>
                                updateSupervisorUnloadForm(item.id, {
                                  unloaded_weight: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Supervisor Remarks
                            </label>
                            <div className="flex items-start gap-2">
                              <Textarea
                                placeholder="Enter supervisor remarks (optional)"
                                value={getSupervisorUnloadForm(item.id).supervisor_remarks}
                                onChange={(e) =>
                                  updateSupervisorUnloadForm(item.id, {
                                    supervisor_remarks: e.target.value,
                                  })
                                }
                                rows={2}
                                className="flex-1"
                              />
                              {renderVoiceRemarkMic(isUpdating)}
                            </div>
                            {renderVoiceRemarkStatus()}
                          </div>
                        </div>

                        <UnloadingImageUploadSection
                          enabledSettings={enabledUnloadingImageSettings}
                          imagesByType={getSupervisorUnloadImages(item.id)}
                          allowMultiple={allowMultipleInwardImages}
                          isUpdating={isUpdating}
                          onAddImage={(settingKey, file) =>
                            addSupervisorUnloadImage(item.id, settingKey, file)
                          }
                          onRemoveImage={(settingKey, imageLocalId) =>
                            removeSupervisorUnloadImage(item.id, settingKey, imageLocalId)
                          }
                        />

                        {stackwiseUnloadingEnabled && stackingOpenByItem[item.id] && (
                          <>
                            <StackRowInputGrid
                              stackRows={getItemStackRows(item)}
                              itemId={item.id}
                              isUpdating={isUpdating}
                              allowMultipleImages={allowMultipleInwardImages}
                              onUpdateRow={updateStackRow}
                              onRemoveRow={removeStackRow}
                              onAddRow={() => addStackRow(item.id)}
                              onImageSelect={handleStackImageSelect}
                              onRemoveImage={removeStackImage}
                            />
                            <VehicleStackColumnPreview
                              stackRows={getItemStackRows(item)}
                              unloadStatus={getSupervisorUnloadForm(item.id).status}
                            />
                          </>
                        )}

                        <div className="mt-4">
                          <Button
                            onClick={() => handleSupervisorUnload(item)}
                            disabled={
                              isUpdating ||
                              voiceRemarks.isRecordingVoice ||
                              hasUploadingSupervisorUnloadImages(item.id)
                            }
                
                          >
                            {isUpdating ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Mark as Unloaded
                              </>
                            )}
                          </Button>
                        </div>
                          </>
                        )}
                      </div>
                    )}

                    {item.status !== "not_unloaded" && hasSavedStackInfo(item) && (
                      <SavedStackInfoSection
                        item={item}
                        stackRows={getItemStackRows(item)}
                      />
                    )}

                    {/* Invoice Details Section */}
                    {(data.invoice_number || data.additional_payment || item.billed_amount || item.billing_date) && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center space-x-2 text-green-700">
                          <Receipt className="h-4 w-4" />
                          <span>Invoice Details</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm bg-green-50 p-4 rounded-lg">
                          {data.invoice_number && (
                            <div>
                              <p className="text-gray-600">Invoice Number</p>
                              <p className="font-semibold text-green-700">{data.invoice_number}</p>
                            </div>
                          )}
                          {data.additional_payment && (
                            <div>
                              <p className="text-gray-600">Additional Amount</p>
                              <p className="font-semibold text-green-700">
                                ₹{parseFloat(data.additional_payment || 0).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {item.billed_amount && (
                            <div>
                              <p className="text-gray-600">Billed Amount</p>
                              <p className="font-semibold text-green-700">
                                ₹{parseFloat(item.billed_amount || 0).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {item.billing_date && (
                            <div>
                              <p className="text-gray-600">Billing Date</p>
                              <p className="font-semibold text-green-700">{item.billing_date}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Assignment Section for Pending or Approved Items - Only show if user has permission */}
                    {(item.status === 'pending' || item.status === 'approved') && hasInwardAssignmentAccess && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center space-x-2">
                          <UserCheck className="h-4 w-4" />
                          <span>Assignment Details</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              <User className="h-4 w-4 text-blue-600" />
                              Select User *
                            </label>
                            <div className="relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    {(() => {
                                      const selectedUser = users?.find(
                                        (u) =>
                                          (u.id || u.user_id)?.toString() === selectedSupervisor
                                      );
                                      if (selectedUser) {
                                        return (
                                          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden pr-1 text-left">
                                            <span className="min-w-0 flex-1 truncate text-sm">
                                              {getUserDisplayName(selectedUser)}
                                            </span>
                                            <UserStatusBadge activeStatus={selectedUser.active_status} />
                                          </div>
                                        );
                                      }
                                      return (
                                        <span className="truncate text-muted-foreground">
                                          Select User
                                        </span>
                                      );
                                    })()}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-[400px] min-w-[var(--radix-popover-trigger-width)] p-0 z-50"
                                  align="start"
                                  side="bottom"
                                  sideOffset={4}
                                >
                                  <Command className="w-full">
                                    <CommandInput placeholder="Search users..." />
                                    <CommandList>
                                      <CommandEmpty>
                                        {users && users.length === 0 ? (
                                          "No users available"
                                        ) : (
                                          "No users match your search."
                                        )}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        <ScrollArea className="h-64">
                                          {users && users.length > 0 ? users.map(user => {
                                            const userId = (user.id || user.user_id || "").toString();
                                            const isSelected = selectedSupervisor === userId;
                                            return (
                                              <CommandItem
                                                key={user.id || user.user_id}
                                                value={`${user.name} ${getUserDisplayName(user)} Present Absent`}
                                                onSelect={() => {
                                                  setSelectedSupervisor(userId);
                                                }}
                                                className="cursor-pointer px-3 py-2 w-full"
                                              >
                                                {renderUserSelectOption(user, isSelected)}
                                              </CommandItem>
                                            );
                                          }) : (
                                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                              No users available
                                            </div>
                                          )}
                                        </ScrollArea>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              Select Godown *
                            </label>
                            <div className="relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <span className="truncate">
                                      {selectedGodown
                                        ? godowns?.find(g => g.id?.toString() === selectedGodown)
                                          ? `${godowns.find(g => g.id?.toString() === selectedGodown).name} - ${godowns.find(g => g.id?.toString() === selectedGodown).location || 'Location'}`
                                          : "Select godown"
                                        : "Select godown"}
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
                                    <CommandInput placeholder="Search godowns..." />
                                    <CommandList>
                                      <CommandEmpty>
                                        {godowns && godowns.length === 0 ? (
                                          "No godowns available"
                                        ) : (
                                          "No godowns match your search."
                                        )}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        <ScrollArea className="h-64">
                                          {godowns && godowns.length > 0 ? godowns.map(godown => (
                                            <CommandItem
                                              key={godown.id}
                                              value={`${godown.name} ${godown.location || 'Location'}`}
                                              onSelect={() => {
                                                setSelectedGodown((godown.id || '').toString());
                                              }}
                                              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                            >
                                              <div className="flex items-center gap-3">
                                                <Check
                                                  className={`h-4 w-4 ${selectedGodown === (godown.id || '').toString()
                                                    ? "opacity-100 text-blue-600"
                                                    : "opacity-0"
                                                    }`}
                                                />
                                                <div>
                                                  <div className="font-medium text-gray-900">{godown.name}</div>
                                                  {godown.location && (
                                                    <div className="text-sm text-gray-500">{godown.location}</div>
                                                  )}
                                                </div>
                                              </div>
                                            </CommandItem>
                                          )) : (
                                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                              No godowns available
                                            </div>
                                          )}
                                        </ScrollArea>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lab Tech Remarks</label>
                            <div className="flex items-start gap-2">
                              <Textarea
                                placeholder="Enter any remarks..."
                                value={labTechRemarks}
                                onChange={(e) => setLabTechRemarks(e.target.value)}
                                rows={2}
                                className="flex-1"
                              />
                              {renderVoiceRemarkMic()}
                            </div>
                            {renderVoiceRemarkStatus()}
                          </div>
                          <div>
                            <br></br>
                            <Button
                              onClick={() => handleAssignSupervisor(item)}
                              disabled={isUpdating || !selectedSupervisor || !selectedGodown || voiceRemarks.isRecordingVoice}
                            >
                              {isUpdating ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2 " />
                                  {item.status === 'approved' ? 'Assign Supervisor' : 'Update Assignment'}
                                </>
                              )}
                            </Button>

                          </div>


                        </div>


                      </div>
                    )}

                    {/* Final Completion Section for Unloaded Items */}
                    {(item.status === 'unloaded' || item.status === 'unloaded_but_rejected') && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Final Completion</span>
                        </h4>

                        {hasCreatePermission("inward") && (
                          <div className="mb-4 flex justify-center">
                            <div className="inline-flex items-center rounded-lg border border-gray-300 bg-gray-50 p-1 shadow-sm">
                              <Button
                                type="button"
                                size="sm"
                                variant={(completionChoiceByItem[item.id] || "retest") === "retest" ? "default" : "ghost"}
                                className="h-8 min-w-[130px] font-medium"
                                onClick={() =>
                                  setCompletionChoiceByItem((prev) => ({ ...prev, [item.id]: "retest" }))
                                }
                              >
                                Re-Test Item
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={(completionChoiceByItem[item.id] || "retest") === "complete" ? "default" : "ghost"}
                                className="h-8 min-w-[150px] font-medium"
                                onClick={() =>
                                  setCompletionChoiceByItem((prev) => ({ ...prev, [item.id]: "complete" }))
                                }
                              >
                                Mark as Completed
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Completion action */}
                        {hasCreatePermission("inward") &&
                          (completionChoiceByItem[item.id] || "retest") === "complete" && (
                          <div className="mb-4 flex justify-end">
                              <Button
                                onClick={() => handleFinalCompletion(item)}
                                disabled={isUpdating || voiceRemarks.isRecordingVoice}
                                className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                              >
                                {isUpdating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Mark as Completed
                                  </>
                                )}
                              </Button>
                          </div>
                        )}

                        {/* Post-Testing Section - Only show if user has inward created permission */}
                        {hasCreatePermission("inward") &&
                          (completionChoiceByItem[item.id] || "retest") === "retest" && (
                          <div className="mb-4">
                            
                            <div className="flex items-center justify-center flex-wrap gap-3 mb-3">
                              <h5 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                                <FlaskConical className="h-4 w-4" />
                                <span>Post-Testing (Optional)</span>
                              </h5>
                              <div className="flex items-center gap-2">
                                {/* Multi-Select Breakdown Selection for Testing */}
                                {item.weight_breakdowns && item.weight_breakdowns.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                                      Test For:
                                    </Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="text-xs h-8 w-[250px] justify-between"
                                        >
                                          <span className="truncate">
                                            {(() => {
                                              const selected = selectedBreakdownForTesting[item.id] || [];
                                              if (selected.length === 0) return "Select breakdowns";
                                              const mainItemSelected = selected.includes("null");
                                              const breakdownCount = selected.filter(id => id !== "null").length;
                                              if (mainItemSelected && breakdownCount > 0) {
                                                return `Main Item + ${breakdownCount} breakdown${breakdownCount > 1 ? 's' : ''}`;
                                              } else if (mainItemSelected) {
                                                return "Main Item";
                                              } else {
                                                return `${breakdownCount} breakdown${breakdownCount > 1 ? 's' : ''} selected`;
                                              }
                                            })()}
                                          </span>
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[280px] p-3" align="start">
                                        <div className="space-y-2">
                                          <Label className="text-sm font-medium">Select Breakdowns to Test</Label>
                                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                            {/* Main Item Option */}
                                            <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                                              <Checkbox
                                                id={`main-item-${item.id}`}
                                                checked={selectedBreakdownForTesting[item.id]?.includes("null") || false}
                                                onCheckedChange={(checked) => {
                                                  const current = selectedBreakdownForTesting[item.id] || [];
                                                  if (checked) {
                                                    setSelectedBreakdownForTesting(prev => ({
                                                      ...prev,
                                                      [item.id]: [...current, "null"]
                                                    }));
                                                  } else {
                                                    setSelectedBreakdownForTesting(prev => ({
                                                      ...prev,
                                                      [item.id]: current.filter(id => id !== "null")
                                                    }));
                                                  }
                                                }}
                                              />
                                              <label
                                                htmlFor={`main-item-${item.id}`}
                                                className="text-sm font-medium leading-none cursor-pointer flex-1"
                                              >
                                                Main Item (All Bags)
                                              </label>
                                            </div>

                                            {/* Breakdown Options */}
                                            {item.weight_breakdowns.map((breakdown) => (
                                              <div key={breakdown.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                                                <Checkbox
                                                  id={`breakdown-${item.id}-${breakdown.id}`}
                                                  checked={selectedBreakdownForTesting[item.id]?.includes(breakdown.id.toString()) || false}
                                                  onCheckedChange={(checked) => {
                                                    const current = selectedBreakdownForTesting[item.id] || [];
                                                    if (checked) {
                                                      setSelectedBreakdownForTesting(prev => ({
                                                        ...prev,
                                                        [item.id]: [...current, breakdown.id.toString()]
                                                      }));
                                                    } else {
                                                      setSelectedBreakdownForTesting(prev => ({
                                                        ...prev,
                                                        [item.id]: current.filter(id => id !== breakdown.id.toString())
                                                      }));
                                                    }
                                                  }}
                                                />
                                                <label
                                                  htmlFor={`breakdown-${item.id}-${breakdown.id}`}
                                                  className="text-sm font-medium leading-none cursor-pointer flex-1"
                                                >
                                                  {breakdown.status_type_display || breakdown.status_type} ({breakdown.number_of_bags})
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                )}
                                <Dialog open={isLabTestPopupOpen[item.id] || false} onOpenChange={(open) => {
                                  if (open) {
                                    handleOpenLabTestPopup(item.id);
                                  } else {
                                    handleCloseLabTestPopup(item.id);
                                  }
                                }}>
                                  <DialogTrigger asChild>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-black hover:bg-gray-800 text-white"
                                    >
                                      <Plus />
                                      Add Test Parameter
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <FlaskConical className="h-5 w-5" />
                                        Select Lab Test Parameters
                                      </DialogTitle>
                                    </DialogHeader>

                                    <div className="space-y-6">
                                      {/* Item Group Filter */}
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium">Filter by Item Group</Label>
                                        {(() => {
                                          const isPostTesting = item.status === 'unloaded' || item.status === 'unloaded_but_rejected';
                                          const itemGroupId = item.item_group_id || (item.item_group && item.item_group.item_group_id);
                                          const isItemGroupLocked = isPostTesting && itemGroupId;

                                          return (
                                            <>
                                              <Select
                                                value={popupSelectedItemGroup[item.id]?.id?.toString() || "all"}
                                                onValueChange={(value) => {
                                                  if (!isItemGroupLocked) {
                                                    if (value && value !== "all") {
                                                      const itemGroup = itemGroups.find(g => g.id.toString() === value);
                                                      handlePopupItemGroupChange(item.id, itemGroup);
                                                    } else {
                                                      handlePopupItemGroupChange(item.id, null);
                                                    }
                                                  }
                                                }}
                                                disabled={isItemGroupLocked}
                                              >
                                                <SelectTrigger className="w-full">
                                                  <SelectValue placeholder="Select item group to filter parameters" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {!isItemGroupLocked && (
                                                    <SelectItem value="all">All Parameters</SelectItem>
                                                  )}
                                                  {itemGroups.map((group) => (
                                                    <SelectItem key={group.id} value={group.id.toString()}>
                                                      {group.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                              {popupSelectedItemGroup[item.id] && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                  <Package className="h-4 w-4" />
                                                  <span>Showing parameters for: <strong>{popupSelectedItemGroup[item.id].name}</strong></span>
                                                  {isItemGroupLocked && (
                                                    <span className="text-xs text-gray-500 ml-2">(Locked from item group)</span>
                                                  )}
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>

                                      {/* Test Type Filter - Only show when item group is selected */}
                                      {popupSelectedItemGroup[item.id] && (
                                        <div className="space-y-2">
                                          <Label className="text-sm font-medium">Filter by Test Type</Label>
                                          <div className="flex gap-2">
                                            <Button
                                              type="button"
                                              variant={popupSelectedTestType[item.id] === "all" || !popupSelectedTestType[item.id] ? "default" : "outline"}
                                              size="sm"
                                              onClick={() => setPopupSelectedTestType(prev => ({
                                                ...prev,
                                                [item.id]: "all"
                                              }))}
                                              className="flex-1"
                                            >
                                              All Tests
                                            </Button>
                                            <Button
                                              type="button"
                                              variant={popupSelectedTestType[item.id] === "pre_test" ? "default" : "outline"}
                                              size="sm"
                                              onClick={() => setPopupSelectedTestType(prev => ({
                                                ...prev,
                                                [item.id]: "pre_test"
                                              }))}
                                              className="flex-1"
                                            >
                                              Pre Test
                                            </Button>
                                            <Button
                                              type="button"
                                              variant={popupSelectedTestType[item.id] === "post_test" ? "default" : "outline"}
                                              size="sm"
                                              onClick={() => setPopupSelectedTestType(prev => ({
                                                ...prev,
                                                [item.id]: "post_test"
                                              }))}
                                              className="flex-1"
                                            >
                                              Post Test
                                            </Button>
                                          </div>
                                          {popupSelectedTestType[item.id] && popupSelectedTestType[item.id] !== "all" && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                              <FlaskConical className="h-4 w-4" />
                                              <span>Showing: <strong>
                                                {popupSelectedTestType[item.id] === "pre_test" ? "Pre Test" :
                                                  popupSelectedTestType[item.id] === "post_test" ? "Post Test" : "All Tests"}
                                              </strong> parameters</span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Lab Test Parameters List */}
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-sm font-medium">Available Parameters</Label>
                                          <Button
                                            type="button"
                                            // variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const filteredParams = getFilteredLabTestParams(item.id);
                                              const allParamIds = filteredParams.map(param => param.id);
                                              const currentSelected = popupSelectedParams[item.id] || [];

                                              // Check if all are selected
                                              const allSelected = allParamIds.every(id => currentSelected.includes(id));

                                              if (allSelected) {
                                                // Deselect all
                                                setPopupSelectedParams(prev => ({
                                                  ...prev,
                                                  [item.id]: []
                                                }));
                                              } else {
                                                // Select all
                                                setPopupSelectedParams(prev => ({
                                                  ...prev,
                                                  [item.id]: allParamIds
                                                }));
                                              }
                                            }}
                                            className="text-xs px-3 py-1 h-7"
                                          >
                                            {(() => {
                                              const filteredParams = getFilteredLabTestParams(item.id);
                                              const allParamIds = filteredParams.map(param => param.id);
                                              const currentSelected = popupSelectedParams[item.id] || [];
                                              const allSelected = allParamIds.every(id => currentSelected.includes(id));
                                              return allSelected ? 'Deselect All' : 'Select All';
                                            })()}
                                          </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                          {getFilteredLabTestParams(item.id).map((param) => {
                                            const validation = getValidationStatus(param);
                                            const ValidationIcon = validation.icon;
                                            const isSelected = popupSelectedParams[item.id]?.includes(param.id) || false;

                                            return (
                                              <div
                                                key={param.id}
                                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${isSelected
                                                  ? 'border-purple-500 bg-purple-50'
                                                  : 'border-gray-200 hover:border-purple-300'
                                                  }`}
                                                onClick={() => handlePopupParamToggle(item.id, param.id)}
                                              >
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <Checkbox
                                                      checked={isSelected}
                                                      onChange={() => handlePopupParamToggle(item.id, param.id)}
                                                    />
                                                    <FlaskConical className="h-4 w-4 text-purple-500" />
                                                    <span className="text-sm font-medium">{param.parameter_name}</span>
                                                    {param.unit && (
                                                      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                                        {param.unit}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <ValidationIcon className={`h-3 w-3 ${validation.color}`} />
                                                    {param.is_image_required && (
                                                      <Camera className="h-3 w-3 text-blue-500" />
                                                    )}
                                                  </div>
                                                </div>
                                                {param.remarks && (
                                                  <p className="text-xs text-gray-500 mt-1 ml-6">{param.remarks}</p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex justify-end gap-2 pt-4 border-t">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => handleCloseLabTestPopup(item.id)}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          type="button"
                                          onClick={() => handleApplyLabTestSelection(item.id)}
                                          disabled={!popupSelectedParams[item.id]?.length}
                                        >
                                          Apply Selection ({popupSelectedParams[item.id]?.length || 0})
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentSelected = selectedPostTestParams[item.id] || [];

                                    // Clear all selected params in one state update (avoid one-by-one visual removal)
                                    setSelectedPostTestParams(prev => ({
                                      ...prev,
                                      [item.id]: []
                                    }));

                                    // Remove all related values/remarks/images for this item's selected params
                                    setPostTestValues(prev => {
                                      const next = { ...prev };
                                      currentSelected.forEach((paramId) => {
                                        const mainKey = `${item.id}_${paramId}`;
                                        delete next[mainKey];

                                        // Also clear any breakdown-level values for this param
                                        Object.keys(next).forEach((k) => {
                                          if (k.startsWith(`${item.id}_${paramId}_`)) {
                                            delete next[k];
                                          }
                                        });
                                      });
                                      return next;
                                    });

                                    setPostTestRemarks(prev => {
                                      const next = { ...prev };
                                      currentSelected.forEach((paramId) => {
                                        const mainKey = `${item.id}_${paramId}`;
                                        delete next[mainKey];
                                        Object.keys(next).forEach((k) => {
                                          if (k.startsWith(`${item.id}_${paramId}_`)) {
                                            delete next[k];
                                          }
                                        });
                                      });
                                      return next;
                                    });

                                    setPostTestImages(prev => {
                                      const next = { ...prev };
                                      currentSelected.forEach((paramId) => {
                                        const mainKey = `${item.id}_${paramId}`;
                                        delete next[mainKey];
                                        Object.keys(next).forEach((k) => {
                                          if (k.startsWith(`${item.id}_${paramId}_`)) {
                                            delete next[k];
                                          }
                                        });
                                      });
                                      return next;
                                    });
                                  }}
                                  disabled={!selectedPostTestParams[item.id]?.length}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Clear All
                                </Button>
                              </div>
                            </div>

                            {/* Selected Test Parameters Input - Row wise boxes */}
                            {selectedPostTestParams[item.id] && selectedPostTestParams[item.id].length > 0 && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                  {[...(selectedPostTestParams[item.id] || [])]
                                    .sort((a, b) => {
                                      const paramA = postTestParams.find((p) => p.id === a);
                                      const paramB = postTestParams.find((p) => p.id === b);
                                      const aCountable = paramA?.is_countable ? 1 : 0;
                                      const bCountable = paramB?.is_countable ? 1 : 0;
                                      return aCountable - bCountable;
                                    })
                                    .map((paramId) => {
                                    const param = postTestParams.find((p) => p.id === paramId);
                                    if (!param) return null;

                                    const selectedTargets = [];
                                    if (selectedBreakdownForTesting[item.id]?.includes("null")) {
                                      selectedTargets.push({ key: "null", label: "Main Item (All Bags)", breakdownId: null });
                                    }
                                    if (item.weight_breakdowns) {
                                      item.weight_breakdowns
                                        .filter((breakdown) =>
                                          selectedBreakdownForTesting[item.id]?.includes(breakdown.id.toString())
                                        )
                                        .forEach((breakdown) => {
                                          selectedTargets.push({
                                            key: breakdown.id.toString(),
                                            label: `${breakdown.status_type_display || breakdown.status_type} (${breakdown.number_of_bags} bags)`,
                                            breakdownId: breakdown.id,
                                          });
                                        });
                                    }

                                    return (
                                      <div
                                        key={paramId}
                                        className={`border rounded-md p-3 h-full ${
                                          param.is_countable
                                            ? "bg-blue-50 border-blue-200"
                                            : "bg-white border-gray-200"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <FlaskConical className="h-4 w-4 text-purple-500" />
                                            <span className="text-sm font-medium text-gray-900">{param.parameter_name}</span>
                                            {param.unit && (
                                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                                {param.unit}
                                              </Badge>
                                            )}
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handlePostTestParamToggle(item.id, paramId)}
                                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>

                                        {param.is_validation_required && param.min_value && param.max_value && (
                                          <p className="text-[10px] text-blue-700 mb-2">
                                            Range: {param.min_value} - {param.max_value} {param.unit || ""}
                                          </p>
                                        )}

                                        <div
                                          className={`grid grid-cols-1 gap-3 ${selectedTargets.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"}`}
                                        >
                                          {selectedTargets.map((target) => (
                                            <div key={target.key} className="border border-gray-100 rounded-md p-2 bg-gray-50 w-full">
                                              <Label className="text-[11px] font-medium text-gray-700">{target.label}</Label>
                                              <div className="relative mt-1">
                                                <Input
                                                  placeholder="Enter value"
                                                  value={getPostTestValue(item.id, paramId, target.breakdownId)}
                                                  onChange={(e) =>
                                                    handlePostTestValueChange(item.id, paramId, target.breakdownId, e.target.value)
                                                  }
                                                  onWheel={(e) => e.currentTarget.blur()}
                                                  type={param.is_validation_required ? "number" : "text"}
                                                  step="0.001"
                                                  className={`text-xs h-8 w-full ${param.is_image_required ? "pr-10" : ""}`}
                                                />
                                                {param.is_image_required && (
                                                  <div className="absolute inset-y-0 right-2 flex items-center">
                                                    <div className="relative">
                                                      <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                          const file = e.target.files?.[0];
                                                          if (file) {
                                                            handlePostTestImageChange(item.id, paramId, target.breakdownId, file);
                                                          }
                                                          e.target.value = "";
                                                        }}
                                                        className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer"
                                                      />
                                                      <div className="w-6 h-6 inline-flex items-center justify-center rounded border border-dashed border-gray-300 hover:border-purple-400 bg-white">
                                                        {isPostTestImageUploading(item.id, paramId, target.breakdownId) ? (
                                                          <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                                        ) : (
                                                          <Camera className={`h-3 w-3 ${getPostTestImage(item.id, paramId, target.breakdownId) ? "text-green-600" : "text-gray-500"}`} />
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                              {param.is_image_required && (
                                                <p className="text-[9px] text-gray-500 mt-1">
                                                  {isPostTestImageUploading(item.id, paramId, target.breakdownId)
                                                    ? "Uploading image..."
                                                    : getPostTestImage(item.id, paramId, target.breakdownId)
                                                      ? "Image uploaded"
                                                      : "Click camera to upload image"}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {selectedPostTestParams[item.id] && selectedPostTestParams[item.id].length > 0 && (
                              <div className="mt-4 flex justify-end">
                                <Button
                                  onClick={() => handleFinalCompletion(item)}
                                  disabled={isUpdating || voiceRemarks.isRecordingVoice}
                                  className="bg-blue-600 hover:bg-green-700"
                                >
                                  {isUpdating ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <FlaskConical className="w-4 h-4 mr-2" />
                                      Submit Post-Testing
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    )}

                    {/* Responsive Layout: Lab Test Results, Images, and Testing Information */}
                    {((item.lab_tests && item.lab_tests.length > 0) || (item.images && item.images.length > 0) || (item.tested_by || item.tested_date || item.approved_by || item.approved_date)) ? (
                      <div className="border-t pt-4">

                        {/* Weight Breakdowns */}
                        {item.weight_breakdowns && item.weight_breakdowns.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold mb-2">Unloading Quality Details</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border">
                                <thead className="bg-gray-50 border-b-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                                  <tr>
                                    <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs border">Status Type</th>
                                    <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs border">Quantity</th>
                                    <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs border">Weight</th>
                                    <th className="h-12 px-4 py-3 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs border">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.weight_breakdowns.map((w, idx) => (
                                    <tr key={idx}>
                                      <td className="p-2 border">{w.status_type_display || w.status_type}</td>
                                      <td className="p-2 border">{w.number_of_bags}</td>
                                      <td className="p-2 border">{w.weight}</td>
                                      <td className="p-2 border">{w.remarks || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        <br></br>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                          {/* Left Column - Lab Testing Results and Images & Samples */}
                          <div className="xl:col-span-2 space-y-4">
                            {/* Lab Testing Results */}
                            {item.lab_tests && item.lab_tests.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center space-x-2">
                                  <FlaskConical className="h-4 w-4" />
                                  <span>Lab Testing Results</span>
                                </h4>

                                {(() => {
                                  const labTests = enrichInwardLabTestsWithBreakdowns(
                                    item.lab_tests,
                                    item.weight_breakdowns
                                  );
                                  const {
                                    preTests,
                                    postTests,
                                    reTests,
                                    allParams,
                                    postTestBreakdowns,
                                    reTestBreakdowns,
                                    hasBreakdownTests,
                                    hasMainItemPostTests,
                                    hasMainItemReTests,
                                    postColCount,
                                    reColCount,
                                    hasSecondHeaderRow,
                                    showAggregatedPostColumn,
                                    groupByBreakdown,
                                    getLatestTest,
                                    hasValidTestValue,
                                  } = buildInwardLabTestTableModel(labTests, item.weight_breakdowns);

                                  const headerRowSpan = hasSecondHeaderRow ? 2 : 1;

                                  return (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs border border-gray-200 rounded-lg">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th rowSpan={headerRowSpan} className="px-2 py-1.5 text-left font-medium text-gray-700 border text-[13px] align-top">Parameter</th>
                                            <th rowSpan={headerRowSpan} className="px-2 py-1.5 text-center font-medium text-gray-700 border text-[13px] align-top">Pre-Testing</th>
                                            {postColCount > 0 && (
                                              <th colSpan={postColCount} className="px-2 py-1.5 text-center font-medium text-gray-700 border text-[13px]">
                                                Post-Testing
                                              </th>
                                            )}
                                            {reColCount > 0 && (
                                              <th colSpan={reColCount} className="px-2 py-1.5 text-center font-medium text-gray-700 border text-[13px]">
                                                Re-Testing
                                              </th>
                                            )}
                                            <th rowSpan={headerRowSpan} className="px-2 py-1.5 text-center font-medium text-gray-700 border text-[13px] align-top">
                                              Difference
                                            </th>
                                          </tr>
                                          {hasSecondHeaderRow && (
                                            <tr>
                                              {hasBreakdownTests && postTestBreakdowns.map((breakdown) => (
                                                <th key={`post-header-${breakdown.id}`} className="px-1 py-1 text-center font-medium text-green-700 border text-[11px] bg-green-50">
                                                  {breakdown.status_type}
                                                  <br />
                                                  <span className="text-[9px] text-gray-500">({breakdown.number_of_bags})</span>
                                                </th>
                                              ))}
                                              {hasMainItemPostTests && (
                                                <th className="px-2 py-1 text-center font-medium text-green-700 border text-[11px] bg-green-50">
                                                  Main Item
                                                </th>
                                              )}
                                              {reTestBreakdowns.map((breakdown) => (
                                                <th key={`re-header-${breakdown.id}`} className="px-1 py-1 text-center font-medium text-orange-700 border text-[11px] bg-orange-50">
                                                  {breakdown.status_type}
                                                  <br />
                                                  <span className="text-[9px] text-gray-500">({breakdown.number_of_bags})</span>
                                                </th>
                                              ))}
                                              {hasMainItemReTests && (
                                                <th className="px-2 py-1 text-center font-medium text-orange-700 border text-[11px] bg-orange-50">
                                                  Main Item
                                                </th>
                                              )}
                                            </tr>
                                          )}
                                        </thead>
                                        <tbody>
                                          {allParams.map((paramName, index) => {
                                            const preTest = preTests.find((test) => test.parameter_name === paramName);
                                            const paramPostTests = postTests.filter((test) => test.parameter_name === paramName);
                                            const paramReTests = reTests.filter((test) => test.parameter_name === paramName);
                                            const postTestsByBreakdown = groupByBreakdown(paramPostTests);
                                            const reTestsByBreakdown = groupByBreakdown(paramReTests);

                                            return (
                                              <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="px-2 py-1.5 font-medium text-gray-900 text-[13px] border">
                                                  {paramName}
                                                </td>
                                                <td className="px-2 py-1.5 text-center border">
                                                  {preTest ? (
                                                    <span className="font-medium text-gray-900 text-[12px]">
                                                      {formatInwardTestValue(preTest)}
                                                    </span>
                                                  ) : (
                                                    <span className="text-gray-400 text-[12px]">0</span>
                                                  )}
                                                </td>
                                                {hasBreakdownTests && postTestBreakdowns.map((breakdown) => {
                                                  const latestPostTest = getLatestTest(postTestsByBreakdown[breakdown.id] || []);
                                                  return (
                                                    <td key={`post-${breakdown.id}-${paramName}`} className="px-1 py-1.5 text-center align-top bg-green-50/30 border">
                                                      {latestPostTest ? (
                                                        <span className="font-medium text-green-700 text-[11px]">
                                                          {formatInwardTestValue(latestPostTest)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-400 text-[11px]">0</span>
                                                      )}
                                                    </td>
                                                  );
                                                })}
                                                {hasMainItemPostTests && (
                                                  <td className="px-2 py-1.5 text-center align-top bg-green-50/30 border">
                                                    {(() => {
                                                      const latestPostTest = getLatestTest(postTestsByBreakdown.main || []);
                                                      return latestPostTest ? (
                                                        <span className="font-medium text-green-700 text-[12px]">
                                                          {formatInwardTestValue(latestPostTest)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-400 text-[12px]">0</span>
                                                      );
                                                    })()}
                                                  </td>
                                                )}
                                                {showAggregatedPostColumn && (
                                                  <td className="px-2 py-1.5 text-center align-top bg-green-50/30 border">
                                                    {(() => {
                                                      const latestPostTest = getLatestTest(paramPostTests);
                                                      return latestPostTest ? (
                                                        <span className="font-medium text-green-700 text-[12px]">
                                                          {formatInwardTestValue(latestPostTest)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-400 text-[12px]">0</span>
                                                      );
                                                    })()}
                                                  </td>
                                                )}
                                                {reTestBreakdowns.map((breakdown) => {
                                                  const latestReTest = getLatestTest(reTestsByBreakdown[breakdown.id] || []);
                                                  return (
                                                    <td key={`re-${breakdown.id}-${paramName}`} className="px-1 py-1.5 text-center align-top bg-orange-50/30 border">
                                                      {latestReTest && hasValidTestValue(latestReTest) ? (
                                                        <span className="font-medium text-orange-700 text-[11px]">
                                                          {formatInwardTestValue(latestReTest)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-400 text-[11px]">0</span>
                                                      )}
                                                    </td>
                                                  );
                                                })}
                                                {hasMainItemReTests && (
                                                  <td className="px-2 py-1.5 text-center align-top bg-orange-50/30 border">
                                                    {(() => {
                                                      const latestReTest = getLatestTest(reTestsByBreakdown.main || []);
                                                      return latestReTest && hasValidTestValue(latestReTest) ? (
                                                        <span className="font-medium text-orange-700 text-[12px]">
                                                          {formatInwardTestValue(latestReTest)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-400 text-[12px]">0</span>
                                                      );
                                                    })()}
                                                  </td>
                                                )}
                                                <td className="px-2 py-1.5 text-center align-top bg-blue-50/30 border">
                                                  {(() => {
                                                    const latestPostForDiff = getLatestTest(paramPostTests);
                                                    const differenceDetails = computeInwardTestDifferenceDetails(
                                                      preTest,
                                                      latestPostForDiff
                                                    );
                                                    return (
                                                      <span
                                                        className={`text-[12px] ${
                                                          differenceDetails.isIncrease
                                                            ? "text-blue-700 font-bold"
                                                            : "text-blue-700 font-medium"
                                                        }`}
                                                      >
                                                        {differenceDetails.text}
                                                      </span>
                                                    );
                                                  })()}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>

                                      <div className="flex items-center gap-1 mt-2">
                                        {preTests.length > 0 && (
                                          <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5">
                                            Pre: {preTests.length}
                                          </Badge>
                                        )}
                                        {postTests.length > 0 && (
                                          <Badge variant="default" className="text-[11px] px-1.5 py-0.5">
                                            Post: {postTests.length}
                                          </Badge>
                                        )}
                                        {reTests.length > 0 && (
                                          <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 border-orange-300 text-orange-700">
                                            Re-Test: {reTests.length}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}




                          </div>

                          {/* Right Column - Testing Information */}
                          {(item.tested_by || item.tested_date || item.approved_by || item.approved_date || item.re_tested_by || item.re_testing_date) && (
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold flex items-center space-x-2">
                                <Tag className="h-4 w-4" />
                                <span>Inward Information</span>
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {item.tested_by && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Tested By</p>
                                    <p className="font-medium text-[12px]">{item.tested_by}</p>
                                  </div>
                                )}
                                {item.tested_date && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Tested Date</p>
                                    <p className="font-medium text-[12px]">{item.tested_date}</p>
                                  </div>
                                )}
                                {item.approved_by && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Action By</p>
                                    <p className="font-medium text-[12px]">{item.approved_by}</p>
                                  </div>
                                )}
                                {item.approved_date && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Action Date</p>
                                    <p className="font-medium text-[12px]">{item.approved_date}</p>
                                  </div>
                                )}
                                {item.supervisor && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Unloaded By</p>
                                    <p className="font-medium text-[12px]">
                                      {item.supervisor}
                                      {item.unloading_time_taken ? (
                                        <span className="font-normal text-gray-600">
                                          {" "}
                                          ({item.unloading_time_taken})
                                        </span>
                                      ) : null}
                                    </p>
                                  </div>
                                )}
                                {item.unloading_date && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Unloaded Date</p>
                                    <p className="font-medium text-[12px]">{item.unloading_date}</p>
                                  </div>
                                )}
                                {item.re_tested_by && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Post Tested By</p>
                                    <p className="font-medium text-[12px]">{item.re_tested_by}</p>
                                  </div>
                                )}
                                {item.re_testing_date && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Post Tested Date</p>
                                    <p className="font-medium text-[12px]">{item.re_testing_date}</p>
                                  </div>
                                )}
                                {item.additional_tested_by && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Re Tested By</p>
                                    <p className="font-medium text-[12px]">{item.additional_tested_by}</p>
                                  </div>
                                )}
                                {item.additional_testing_date && (
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <p className="text-gray-500 text-[12px]">Re Testing Date</p>
                                    <p className="font-medium text-[12px]">{item.additional_testing_date}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}


                    <div className="grid grid-cols-12 gap-4">
                      {item.images && item.images.length > 0 && (
                        <div className="col-span-12 space-y-3">
                          <h4 className="text-sm font-semibold flex items-center space-x-2">
                            <Image className="h-4 w-4" />
                            <span>Images & Samples</span>
                            <Badge variant="outline" className="text-[10px]">
                              {item.images.length}
                            </Badge>
                          </h4>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                              {item.images.map((image, index) => (
                                <InwardMediaThumb
                                  key={image.id || index}
                                  image={image}
                                  index={index}
                                  onView={(img) =>
                                    openInwardMediaViewer(img, {
                                      setSelectedImage,
                                      setIsImageDialogOpen,
                                      setImageZoom,
                                      setImagePosition,
                                    })
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>


                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No items found for this entry</p>
              </CardContent>
            </Card>
          )}

          {/* JALI Details Section */}
          {jaliDetails && jaliDetails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Scale className="h-5 w-5" />
                  <span>JALI Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jaliDetails.map((jali, idx) => {
                    const relatedItem = items.find(item => item.id === jali.item_id);

                    return (
                      <div key={idx} className="border rounded-lg p-4">
                        <h5 className="font-medium text-sm mb-3 text-gray-700">
                          {relatedItem ? relatedItem.item_name : `Item ${jali.item_id}`} - JALI Details
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Jali Number</p>
                            <p className="font-medium">{jali.jali_number}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Weight Type</p>
                            <p className="font-medium">{jali.weight_type_display || jali.weight_type}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Weight Value</p>
                            <p className="font-medium">{jali.weight_value}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Bags Count</p>
                            <p className="font-medium">{jali.bags_count}</p>
                          </div>
                          {jali.jali_remarks && (
                            <div className="col-span-full">
                              <p className="text-gray-500">Remarks</p>
                              <p className="font-medium">{jali.jali_remarks}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lab Test Parameters */}
          {labTestParams && labTestParams.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Tag className="h-5 w-5" />
                  <span>Lab Test Parameters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {labTestParams.map((param, idx) => {
                    const relatedItem = items.find(item => item.id === param.item_id);
                    return (
                      <div key={idx} className="border rounded-lg p-4">
                        <h5 className="font-medium text-sm mb-3 text-gray-700">
                          {relatedItem ? relatedItem.item_name : `Item ${param.item_id}`} - Test Parameters
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Parameter Name</p>
                            <p className="font-medium">{param.parameter_name}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Value</p>
                            <p className="font-medium">{param.value}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Images (item-linked only; entry-level images show in Inward Entry section above) */}
          {images && images.length > 0 && images[0] !== "No images updated" && images.some((img) => img?.item_id) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Image className="h-5 w-5" />
                  <span>Images</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {images.filter((img) => img?.item_id).map((image, idx) => {
                    const relatedItem = items.find(item => item.id === image.item_id);
                    return (
                      <div key={image.id || idx} className="border rounded-lg p-4">
                        <h5 className="font-medium text-sm mb-3 text-gray-700">
                          {relatedItem ? relatedItem.item_name : `Item ${image.item_id}`} - Images
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <img
                              src={image.image_url}
                              alt={`${image.type_display || image.type} - ${image.image_remarks || 'Image'}`}
                              className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => {
                                setSelectedImage(image);
                                setIsImageDialogOpen(true);
                                setImageZoom(1);
                                setImagePosition({ x: 0, y: 0 });
                              }}
                            />
                            <div className="text-sm">
                              <p className="font-medium">{image.type_display || image.type}</p>
                              {image.image_remarks && (
                                <p className="text-gray-500">{image.image_remarks}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {(() => {
            const isCompleted =
              items.length > 0 && items.every((item) => item.status === "completed");
            const canEditWeighment = isCompleted && hasUpdatePermission("inward");
            const hasWeighment =
              (data?.gross_weight != null && String(data.gross_weight).trim() !== "") ||
              (data?.tare_weight != null && String(data.tare_weight).trim() !== "") ||
              (data?.party_gross_weight != null && String(data.party_gross_weight).trim() !== "") ||
              (data?.party_tare_weight != null && String(data.party_tare_weight).trim() !== "");
            const freightValue =
              data?.additional_payment != null && String(data.additional_payment).trim() !== ""
                ? String(data.additional_payment).trim()
                : "";
            if (!canEditWeighment && !hasWeighment && !freightValue) return null;
            return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {canEditWeighment ? (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Completed Inward Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gross Weight</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter gross weight"
                      value={weighmentForm.gross_weight}
                      onChange={(event) => setWeighmentForm((prev) => ({ ...prev, gross_weight: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tare Weight</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter tare weight"
                      value={weighmentForm.tare_weight}
                      onChange={(event) => setWeighmentForm((prev) => ({ ...prev, tare_weight: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Freight / Additional Payment</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter freight amount"
                      value={weighmentForm.additional_payment}
                      onChange={(event) => setWeighmentForm((prev) => ({ ...prev, additional_payment: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Party Gross Weight</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter party gross weight"
                      value={weighmentForm.party_gross_weight}
                      onChange={(event) => setWeighmentForm((prev) => ({ ...prev, party_gross_weight: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Party Tare Weight</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter party tare weight"
                      value={weighmentForm.party_tare_weight}
                      onChange={(event) => setWeighmentForm((prev) => ({ ...prev, party_tare_weight: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {items.filter((item) => item.status === "completed").map((item) => (
                    <div key={item.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Final Remarks - {item.item_name || `Item ${item.id}`}
                      </label>
                      <Textarea
                        placeholder="Enter final completion remarks (optional)..."
                        value={finalRemarksByItem[item.id] ?? ""}
                        onChange={(event) =>
                          setFinalRemarksByItem((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSaveCompletedWeighment}
                    disabled={isSavingWeighment}
                  >
                    {isSavingWeighment ? "Saving..." : "Save Details"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {hasWeighment ? (
            <Card className={freightValue ? "lg:col-span-2" : "lg:col-span-3"}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Scale className="h-5 w-5" />
                  <span>Weighment Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border">Particulars</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border">Gross Weight</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border">Tare Weight</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border">Net Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const hasNum = (value) =>
                          value != null && String(value).trim() !== "" && !Number.isNaN(Number(value));
                        const kg = (value) => (hasNum(value) ? `${value} kg` : "-");
                        const diff = (left, right) =>
                          hasNum(left) && hasNum(right)
                            ? `${(Number(left) - Number(right)).toFixed(2)} kg`
                            : "-";
                        const ourNet =
                          hasNum(data.gross_weight) && hasNum(data.tare_weight)
                            ? (Number(data.gross_weight) - Number(data.tare_weight)).toFixed(2)
                            : null;
                        const partyNet =
                          hasNum(data.party_gross_weight) && hasNum(data.party_tare_weight)
                            ? (Number(data.party_gross_weight) - Number(data.party_tare_weight)).toFixed(2)
                            : null;
                        return (
                          <>
                            <tr>
                              <td className="px-3 py-2 border font-medium">Our Weight</td>
                              <td className="px-3 py-2 border">{kg(data.gross_weight)}</td>
                              <td className="px-3 py-2 border">{kg(data.tare_weight)}</td>
                              <td className="px-3 py-2 border">{kg(ourNet)}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 border font-medium">Party Weight</td>
                              <td className="px-3 py-2 border">{kg(data.party_gross_weight)}</td>
                              <td className="px-3 py-2 border">{kg(data.party_tare_weight)}</td>
                              <td className="px-3 py-2 border">{kg(partyNet)}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 border font-medium">Difference</td>
                              <td className="px-3 py-2 border">{diff(data.gross_weight, data.party_gross_weight)}</td>
                              <td className="px-3 py-2 border">{diff(data.tare_weight, data.party_tare_weight)}</td>
                              <td className="px-3 py-2 border">{diff(ourNet, partyNet)}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {freightValue ? (
            <Card className={hasWeighment ? "lg:col-span-1" : "lg:col-span-3"}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Receipt className="h-5 w-5" />
                  <span>Freight Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border">Parameter</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 border font-medium">Amount</td>
                        <td className="px-3 py-2 border">{freightValue}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
          </div>
            );
          })()}

          {/* Status Change Modal */}
          <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {updateType === 'admin_approval'
                    ? (newStatus === 'approved' ? 'Approve Item' : 'Reject Item')
                    : 'Assign User & Godown'
                  }
                </DialogTitle>
                <DialogDescription>
                  {updateType === 'admin_approval'
                    ? (newStatus === 'approved'
                      ? 'Approve this item and optionally set our brand and remarks.'
                      : 'Provide a reason for rejecting this item.')
                    : 'Assign user and godown for this item. Status will be updated to "not_unloaded".'
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Admin Approval Fields */}
                {updateType === 'admin_approval' && newStatus === 'approved' && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Our Brand (Optional)</label>
                      <Input
                        placeholder="Enter our brand name..."
                        value={ourBrand}
                        onChange={(e) => setOurBrand(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Remarks (Optional)</label>
                      <div className="flex items-start gap-2 mt-1">
                        <Textarea
                          placeholder="Enter any remarks..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          rows={3}
                          className="flex-1"
                        />
                        {renderVoiceRemarkMic()}
                      </div>
                      {renderVoiceRemarkStatus()}
                    </div>
                  </>
                )}

                {/* Rejection Reason */}
                {updateType === 'admin_approval' && newStatus === 'rejected' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Rejection Reason *</label>
                    <div className="flex items-start gap-2 mt-1">
                      <Textarea
                        placeholder="Please provide reason for rejection..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        className="flex-1"
                      />
                      {renderVoiceRemarkMic()}
                    </div>
                    {renderVoiceRemarkStatus()}
                  </div>
                )}

                {/* Assignment Fields */}
                {updateType === 'assign_supervisor' && hasInwardAssignmentAccess && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        Select User *
                      </label>
                      <div className="relative">
                        <Popover open={supervisorDropdownOpen} onOpenChange={setSupervisorDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={supervisorDropdownOpen}
                              className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {(() => {
                                const selectedUser = users?.find(
                                  (u) =>
                                    (u.id || u.user_id)?.toString() === selectedSupervisor
                                );
                                if (selectedUser) {
                                  return (
                                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden pr-1 text-left">
                                      <span className="min-w-0 flex-1 truncate text-sm">
                                        {getUserDisplayName(selectedUser)}
                                      </span>
                                      <UserStatusBadge activeStatus={selectedUser.active_status} />
                                    </div>
                                  );
                                }
                                return (
                                  <span className="truncate text-muted-foreground">
                                    Select User
                                  </span>
                                );
                              })()}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[400px] min-w-[var(--radix-popover-trigger-width)] p-0 z-50"
                            align="start"
                            side="bottom"
                            sideOffset={4}
                          >
                            <Command className="w-full">
                              <CommandInput placeholder="Search users..." />
                              <CommandList>
                                <CommandEmpty>
                                  {users && users.length === 0 ? (
                                    "No users available"
                                  ) : (
                                    "No users match your search."
                                  )}
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    {users && users.length > 0 ? users.map(user => {
                                      const userId = (user.id || user.user_id || "").toString();
                                      const isSelected = selectedSupervisor === userId;
                                      return (
                                        <CommandItem
                                          key={user.id || user.user_id}
                                          value={`${user.name} ${getUserDisplayName(user)} Present Absent`}
                                          onSelect={() => {
                                            setSelectedSupervisor(userId);
                                            setSupervisorDropdownOpen(false);
                                          }}
                                          className="cursor-pointer px-3 py-2 w-full"
                                        >
                                          {renderUserSelectOption(user, isSelected)}
                                        </CommandItem>
                                      );
                                    }) : (
                                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                        No users available
                                      </div>
                                    )}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-600" />
                        Select Godown *
                      </label>
                      <div className="relative">
                        <Popover open={godownDropdownOpen} onOpenChange={setGodownDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={godownDropdownOpen}
                              className="w-full justify-between h-11 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <span className="truncate">
                                {selectedGodown
                                  ? godowns?.find(g => g.id?.toString() === selectedGodown)
                                    ? `${godowns.find(g => g.id?.toString() === selectedGodown).name} - ${godowns.find(g => g.id?.toString() === selectedGodown).location || 'Location'}`
                                    : "Select godown"
                                  : "Select godown"}
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
                              <CommandInput placeholder="Search godowns..." />
                              <CommandList>
                                <CommandEmpty>
                                  {godowns && godowns.length === 0 ? (
                                    "No godowns available"
                                  ) : (
                                    "No godowns match your search."
                                  )}
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    {godowns && godowns.length > 0 ? godowns.map(godown => (
                                      <CommandItem
                                        key={godown.id}
                                        value={`${godown.name} ${godown.location || 'Location'}`}
                                        onSelect={() => {
                                          setSelectedGodown((godown.id || '').toString());
                                          setGodownDropdownOpen(false);
                                        }}
                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Check
                                            className={`h-4 w-4 ${selectedGodown === (godown.id || '').toString()
                                              ? "opacity-100 text-blue-600"
                                              : "opacity-0"
                                              }`}
                                          />
                                          <div>
                                            <div className="font-medium text-gray-900">{godown.name}</div>
                                            {godown.location && (
                                              <div className="text-sm text-gray-500">{godown.location}</div>
                                            )}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    )) : (
                                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                        No godowns available
                                      </div>
                                    )}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Lab Tech Remarks (Optional)</label>
                      <div className="flex items-start gap-2 mt-1">
                        <Textarea
                          placeholder="Enter any remarks..."
                          value={labTechRemarks}
                          onChange={(e) => setLabTechRemarks(e.target.value)}
                          rows={3}
                          className="flex-1"
                        />
                        {renderVoiceRemarkMic()}
                      </div>
                      {renderVoiceRemarkStatus()}
                    </div>
                  </>
                )}

                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsStatusModalOpen(false)}
                    className="flex-1"
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStatusSubmit}
                    disabled={
                      isUpdating ||
                      voiceRemarks.isRecordingVoice ||
                      (updateType === 'admin_approval' && newStatus === 'rejected' && !rejectionReason) ||
                      (updateType === 'assign_supervisor' && (!selectedSupervisor || !selectedGodown)) ||
                      (updateType === 'assign_supervisor' && !hasInwardAssignmentAccess)
                    }
                    className="flex-1"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {updateType === 'admin_approval'
                          ? (newStatus === 'approved' ? 'Approve' : 'Reject')
                          : 'Assign'
                        }
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Image Viewer Dialog */}
          <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] p-0">
              {selectedImage && (
                <>
                  {(() => {
                    const mediaIsVideo = isInwardVideoUrl(selectedImage.image_url);
                    return (
                      <>
                  <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="flex items-center space-x-2">
                        {mediaIsVideo ? (
                          <Play className="h-5 w-5" />
                        ) : (
                          <Image className="h-5 w-5" />
                        )}
                        <span>{selectedImage.type_display || selectedImage.type || (mediaIsVideo ? 'Video' : 'Image')}</span>
                      </DialogTitle>
                    </div>
                    {selectedImage.image_remarks && (
                      <p className="text-sm text-gray-600 mt-2">{selectedImage.image_remarks}</p>
                    )}
                  </DialogHeader>

                  <div
                    className={`relative flex items-center justify-center bg-black/50 p-6 min-h-[400px] max-h-[70vh] overflow-hidden ${
                      mediaIsVideo ? "" : "cursor-move"
                    }`}
                    onMouseDown={(e) => {
                      if (mediaIsVideo) return;
                      if (e.button === 0) {
                        setIsDragging(true);
                        setDragStart({
                          x: e.clientX - imagePosition.x,
                          y: e.clientY - imagePosition.y
                        });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (mediaIsVideo || !isDragging) return;
                      setImagePosition({
                        x: e.clientX - dragStart.x,
                        y: e.clientY - dragStart.y
                      });
                    }}
                    onMouseUp={() => {
                      setIsDragging(false);
                    }}
                    onMouseLeave={() => {
                      setIsDragging(false);
                    }}
                    onWheel={(e) => {
                      if (mediaIsVideo) return;
                      e.preventDefault();
                      const delta = e.deltaY > 0 ? -0.1 : 0.1;
                      setImageZoom(prev => {
                        const newZoom = Math.max(0.5, Math.min(3, prev + delta));
                        return newZoom;
                      });
                    }}
                  >
                    {mediaIsVideo ? (
                      <video
                        src={selectedImage.image_url}
                        controls
                        className="max-w-full max-h-[70vh] rounded-md bg-black"
                        playsInline
                      >
                        Your browser does not support video playback.
                      </video>
                    ) : (
                    <div
                      className="relative inline-block"
                      style={{
                        transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        cursor: isDragging ? 'grabbing' : 'grab',
                      }}
                    >
                      <img
                        src={selectedImage.image_url}
                        alt={selectedImage.type_display || selectedImage.type || 'Image'}
                        className="max-w-full max-h-[70vh] object-contain select-none"
                        draggable={false}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
                    {!mediaIsVideo ? (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImageZoom(prev => Math.max(0.5, prev - 0.25))}
                        disabled={imageZoom <= 0.5}
                      >
                        <Minus className="h-4 w-4 mr-1" />
                        Zoom Out
                      </Button>
                      <span className="text-sm text-gray-600 px-2">
                        {Math.round(imageZoom * 100)}%
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImageZoom(prev => Math.min(3, prev + 0.25))}
                        disabled={imageZoom >= 3}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Zoom In
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setImageZoom(1);
                          setImagePosition({ x: 0, y: 0 });
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                    ) : (
                      <span className="text-sm text-gray-500">Video preview</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedImage.image_url, '_blank')}
                    >
                      Open in New Tab
                    </Button>
                  </div>
                      </>
                    );
                  })()}
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isPdfLanguageDialogOpen} onOpenChange={setIsPdfLanguageDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Select PDF language</DialogTitle>
                <DialogDescription>
                  Choose the language for PDF download. Numbers remain unchanged.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedPdfLanguage} onValueChange={setSelectedPdfLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {PDF_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsPdfLanguageDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={isGeneratingPDF}
                    onClick={async () => {
                      const language = selectedPdfLanguage || "en";
                      setIsPdfLanguageDialogOpen(false);
                      await generatePDF(language);
                    }}
                  >
                    {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Download
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

