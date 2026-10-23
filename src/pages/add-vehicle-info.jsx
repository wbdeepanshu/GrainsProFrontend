import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, Loader2, Menu, Save, Truck, X } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { uploadVoucherMediaFile, MAX_VOUCHER_MEDIA_BYTES } from "@/lib/voucherMediaUpload";
import { isAdminSettingEnabled } from "@/lib/adminSettings";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const VOUCHER_API = `${API_BASE_URL}/api/voucher`;
const MODULE = "way_bridge_info";

const canvasToBlob = (canvas, type = "image/jpeg", quality = 0.9) =>
  new Promise((resolve) => {
    if (!canvas) {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const captureCanvasImage = async (canvas) => {
  const preview = canvas.toDataURL("image/jpeg", 0.9);
  let blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
  if (!blob || blob.size === 0) {
    blob = await dataUrlToBlob(preview);
  }
  return { preview, blob };
};

const themedCardClass = "shadow-lg border-0 bg-white/80 backdrop-blur-sm overflow-hidden h-full";
const themedCardHeaderClass = "bg-black text-white rounded-t-lg px-4 py-2.5";
const fieldLabelClass = "text-sm font-medium text-gray-700";
const fieldTriggerClass =
  "h-10 w-full border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const toNumber = (value) => {
  const parsed = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeVehicleNumber = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// Matches Indian registration number patterns such as KA25A1234.
const VEHICLE_REGEX = /([A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4})/gi;

const extractVehicleCandidates = (ocrText) => {
  if (!ocrText) return [];
  const rawMatches = String(ocrText).toUpperCase().match(VEHICLE_REGEX) || [];
  const normalized = rawMatches
    .map(normalizeVehicleNumber)
    .filter((value) => /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(value));
  return [...new Set(normalized)].sort((a, b) => b.length - a.length);
};

const VALID_INDIAN_STATE_CODES = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ", "HP", "HR",
  "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "PB",
  "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP", "WB",
]);

const resolveValidStateCode = (rawCode) => {
  const code = String(rawCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
  if (code.length < 2) return "";
  const normalized =
    `${normalizeOcrCharacter(code[0], "alpha")}${normalizeOcrCharacter(code[1], "alpha")}`
      .replace(/[^A-Z]/g, "");
  if (normalized.length === 2 && VALID_INDIAN_STATE_CODES.has(normalized)) return normalized;
  return "";
};

const detectBhSeriesVehicleNumber = (rawText) => {
  const text = normalizeVehicleNumber(rawText);
  if (!text || text.length < 8) return "";

  const isBLike = (c) => ["B", "8", "3", "R"].includes(c);
  const isHLike = (c) => ["H", "M", "N", "4"].includes(c);
  const normalizeSuffixChar = (c) => {
    const x = normalizeOcrCharacter(c, "alpha");
    return x || "";
  };

  // Scan for BH/8H-like center token: [YY][BH][NNNN][A/AA]
  for (let i = 2; i < text.length - 5; i += 1) {
    const c1 = text[i];
    const c2 = text[i + 1];
    if (!isBLike(c1) || !isHLike(c2)) continue;

    const y1 = normalizeOcrCharacter(text[i - 2], "digit");
    const y2 = normalizeOcrCharacter(text[i - 1], "digit");
    if (!y1 || !y2) continue;
    const year = `${y1}${y2}`;

    let number = "";
    for (let j = i + 2; j < i + 6; j += 1) {
      const d = normalizeOcrCharacter(text[j], "digit");
      if (!d) {
        number = "";
        break;
      }
      number += d;
    }
    if (number.length !== 4) continue;

    let suffix = "";
    for (let j = i + 6; j < text.length && suffix.length < 2; j += 1) {
      const a = normalizeSuffixChar(text[j]);
      if (a) suffix += a;
      else if (suffix.length > 0) break;
    }
    if (!suffix) continue;

    return `${year}BH${number}${suffix}`;
  }

  return "";
};

const extractDirectVehicleMatches = (rawText) => {
  const compact = normalizeVehicleNumber(rawText);
  if (!compact) return [];
  const matches = compact.match(/[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2}/g) || [];
  return matches.filter((plate) => {
    if (/^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(plate)) return true;
    const state = plate.slice(0, 2);
    return VALID_INDIAN_STATE_CODES.has(state);
  });
};

const normalizeOcrCharacter = (char, type) => {
  const c = String(char || "").toUpperCase();
  if (!c) return "";
  if (type === "alpha") {
    if (c === "0") return "O";
    if (c === "1") return "I";
    if (c === "7") return "T";
    if (c === "2") return "Z";
    if (c === "5") return "S";
    if (c === "8") return "B";
    if (c === "4") return "A";
    return /[A-Z]/.test(c) ? c : "";
  }
  if (type === "digit") {
    if (c === "O" || c === "Q" || c === "D") return "0";
    if (c === "I" || c === "L" || c === "T") return "1";
    if (c === "Z") return "2";
    if (c === "A") return "4";
    if (c === "S") return "5";
    if (c === "G") return "6";
    if (c === "B") return "8";
    return /\d/.test(c) ? c : "";
  }
  return c;
};

const extractVehicleNumberFromText = (rawText) => {
  const text = String(rawText || "").toUpperCase();
  if (!text.trim()) return "";

  // Keep only likely plate chars, collapse separators, and remove spaces.
  const compact = text
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "");

  // Priority path: detect BH series format (e.g. 22BH6517A).
  const bhSeriesNumber = detectBhSeriesVehicleNumber(compact);
  if (bhSeriesNumber) return bhSeriesNumber;

  // Prefer realistic non-BH Indian plate structure: SSRRXNNNN or SSRRXXNNNN/SSRRXXXNNNN.
  const allMatches = compact.match(/[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}/g) || [];

  // If OCR returns ambiguous chars, normalize candidate per slot type.
  const normalizeCandidate = (candidate) => {
    const raw = String(candidate || "");
    if (raw.length < 7) return "";

    const chars = raw.split("");
    const out = [];

    // State code: 2 letters
    const rawState = `${normalizeOcrCharacter(chars[0], "alpha")}${normalizeOcrCharacter(chars[1], "alpha")}`;
    const resolvedState = resolveValidStateCode(rawState);
    if (!resolvedState) return "";
    out.push(resolvedState[0]);
    out.push(resolvedState[1]);

    // RTO code: 1-2 digits
    let index = 2;
    let rtoDigits = "";
    while (index < chars.length && rtoDigits.length < 2) {
      const d = normalizeOcrCharacter(chars[index], "digit");
      if (d) {
        rtoDigits += d;
        index += 1;
      } else {
        break;
      }
    }
    if (!rtoDigits) return "";
    out.push(rtoDigits);

    // Last exactly 4 digits from end
    let tailDigits = "";
    for (let i = chars.length - 1; i >= 0 && tailDigits.length < 4; i -= 1) {
      const d = normalizeOcrCharacter(chars[i], "digit");
      if (d) tailDigits = d + tailDigits;
      else if (tailDigits.length > 0) break;
    }
    if (tailDigits.length !== 4) return "";

    // Middle series letters (between rto block and tail block)
    const middleStart = 2 + rtoDigits.length;
    const middleEnd = Math.max(middleStart, chars.length - tailDigits.length);
    let series = "";
    for (let i = middleStart; i < middleEnd; i += 1) {
      const a = normalizeOcrCharacter(chars[i], "alpha");
      if (a) series += a;
    }
    series = series.slice(0, 3);

    const merged = `${out[0]}${out[1]}${out[2]}${series}${tailDigits}`;
    const normalized = normalizeVehicleNumber(merged);
    if (!/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(normalized)) return "";
    const state = normalized.slice(0, 2);
    if (!VALID_INDIAN_STATE_CODES.has(state)) return "";
    return normalized;
  };

  const normalizedMatches = allMatches
    .map(normalizeCandidate)
    .filter(Boolean);

  if (normalizedMatches.length > 0) {
    // Prefer valid structure and stable detections.
    normalizedMatches.sort((a, b) => {
      const aState = VALID_INDIAN_STATE_CODES.has(a.slice(0, 2)) ? 1 : 0;
      const bState = VALID_INDIAN_STATE_CODES.has(b.slice(0, 2)) ? 1 : 0;
      if (aState !== bState) return bState - aState;
      return b.length - a.length;
    });
    return normalizedMatches[0];
  }

  // Fallback: OCR can return noisy strings (e.g. KA25A123L4, KA25A/1234).
  // Try broader candidates and normalize each slot.
  const tokens = text
    .split(/[\s\n\r\t/\\|,_-]+/)
    .map((t) => normalizeVehicleNumber(t))
    .filter((t) => t.length >= 7);

  const fallbackCandidates = new Set();
  fallbackCandidates.add(compact);
  tokens.forEach((t) => fallbackCandidates.add(t));

  const normalizedFallback = Array.from(fallbackCandidates)
    .map(normalizeCandidate)
    .filter(Boolean);

  if (normalizedFallback.length > 0) {
    normalizedFallback.sort((a, b) => {
      const aState = VALID_INDIAN_STATE_CODES.has(a.slice(0, 2)) ? 1 : 0;
      const bState = VALID_INDIAN_STATE_CODES.has(b.slice(0, 2)) ? 1 : 0;
      if (aState !== bState) return bState - aState;
      const aTail4 = /\d{4}$/.test(a) ? 1 : 0;
      const bTail4 = /\d{4}$/.test(b) ? 1 : 0;
      if (aTail4 !== bTail4) return bTail4 - aTail4;
      return b.length - a.length;
    });
    return normalizedFallback[0];
  }

  // Final loose fallback: parse by slot from any contiguous window.
  // Format: SS RR X(1-3) NNNN where:
  // SS = valid state, RR = 2 digits, X = 1..3 letters, N = digits.
  const source = normalizeVehicleNumber(compact);
  const looseCandidates = [];
  for (let start = 0; start < source.length; start += 1) {
    for (let seriesLen = 1; seriesLen <= 3; seriesLen += 1) {
      const len = 2 + 2 + seriesLen + 4;
      const chunk = source.slice(start, start + len);
      if (chunk.length !== len) continue;

      const state = resolveValidStateCode(
        `${normalizeOcrCharacter(chunk[0], "alpha")}${normalizeOcrCharacter(chunk[1], "alpha")}`
      );
      if (!state) continue;

      const rto0 = normalizeOcrCharacter(chunk[2], "digit");
      const rto1 = normalizeOcrCharacter(chunk[3], "digit");
      if (!rto0 || !rto1) continue;

      let series = "";
      for (let i = 0; i < seriesLen; i += 1) {
        const a = normalizeOcrCharacter(chunk[4 + i], "alpha");
        if (!a) {
          series = "";
          break;
        }
        series += a;
      }
      if (!series) continue;

      let tail = "";
      for (let i = 0; i < 4; i += 1) {
        const d = normalizeOcrCharacter(chunk[4 + seriesLen + i], "digit");
        if (!d) {
          tail = "";
          break;
        }
        tail += d;
      }
      if (tail.length !== 4) continue;

      const plate = `${state}${rto0}${rto1}${series}${tail}`;
      if (/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(plate)) {
        looseCandidates.push(plate);
      }
    }
  }

  if (looseCandidates.length > 0) {
    // Prefer KA-like known state and shorter series first (common in sample style).
    looseCandidates.sort((a, b) => {
      const aKa = a.startsWith("KA") ? 1 : 0;
      const bKa = b.startsWith("KA") ? 1 : 0;
      if (aKa !== bKa) return bKa - aKa;
      const aSeries = a.length - 8;
      const bSeries = b.length - 8;
      if (aSeries !== bSeries) return aSeries - bSeries;
      return a.length - b.length;
    });
    return looseCandidates[0];
  }

  return "";
};

const preprocessPlateImages = (sourceCanvas) => {
  const makeVariant = (threshold = null, invert = false) => {
    const out = document.createElement("canvas");
    // Upscale to improve OCR on distant plates.
    out.width = sourceCanvas.width * 2;
    out.height = sourceCanvas.height * 2;
    const ctx = out.getContext("2d");
    if (!ctx) return sourceCanvas.toDataURL("image/jpeg", 0.92);

    // Focus on central band where the number is likely to appear.
    const bandY = Math.floor(sourceCanvas.height * 0.18);
    const bandH = Math.floor(sourceCanvas.height * 0.68);
    ctx.drawImage(
      sourceCanvas,
      0,
      bandY,
      sourceCanvas.width,
      bandH,
      0,
      0,
      out.width,
      out.height
    );

    const img = ctx.getImageData(0, 0, out.width, out.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      let value = gray;
      if (threshold != null) value = gray > threshold ? 255 : 0;
      if (invert) value = 255 - value;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(img, 0, 0);
    return out.toDataURL("image/jpeg", 0.95);
  };

  // Multiple variants increase resilience to different light/camera angles.
  // Multiple variants for better OCR robustness under angle/light changes.
  return [
    sourceCanvas.toDataURL("image/jpeg", 0.92),
    makeVariant(null, false), // grayscale
    makeVariant(110, false), // lower threshold
    makeVariant(145, false), // medium threshold (works best for most plates)
    makeVariant(175, false), // higher threshold
  ];
};

export default function AddVehicleInfo() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canCreate = hasPermission(MODULE, "create");
  const allowMultipleWeighbridgeImages = isAdminSettingEnabled("multiple_weighbridge_images");

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [remarks, setRemarks] = useState("");
  const [images, setImages] = useState([]);
  const [uploadingImageCount, setUploadingImageCount] = useState(0);
  const [isDetectingVehicleNumber, setIsDetectingVehicleNumber] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const netPreview = useMemo(() => {
    const gross = toNumber(grossWeight);
    return gross > 0 ? gross : null;
  }, [grossWeight]);

  const isSinglePhotoLimitReached =
    !allowMultipleWeighbridgeImages && images.length >= 1;

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", `${VOUCHER_API}/vehicle-waybridge-entry/`, payload);
      const json = await res.json();
      if (json?.status && Number(json.status) >= 400) {
        throw new Error(json?.message || "Failed to create vehicle entry");
      }
      return json;
    },
    onSuccess: (json) => {
      toast({
        title: "Success",
        description: json?.message || "Vehicle inward entry created",
        className: "bg-green-50 border-green-100 text-green-800",
      });
      queryClient.invalidateQueries({ queryKey: ["vehicle-waybridge-list"] });
      setLocation("/vehicle-info");
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Unable to save vehicle entry",
        variant: "destructive",
      });
    },
  });

  const uploadEntryImage = async (fileOrBlob, previewUrl, fileName = "vehicle-entry.jpg") => {
    if (!fileOrBlob) return;

    if (!allowMultipleWeighbridgeImages && images.length >= 1) {
      toast({
        title: "Single photo only",
        description: "Only one entry photo is allowed.",
        variant: "destructive",
      });
      return;
    }

    if (fileOrBlob.size > MAX_VOUCHER_MEDIA_BYTES) {
      toast({
        title: "Image too large",
        description: "Image size should be less than 50MB.",
        variant: "destructive",
      });
      return;
    }

    const tempId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setImages((prev) => [
      ...prev,
      {
        id: tempId,
        image: "",
        image_type: "entry",
        preview: previewUrl,
        uploading: true,
      },
    ]);
    setUploadingImageCount((count) => count + 1);

    try {
      const file =
        fileOrBlob instanceof File
          ? fileOrBlob
          : new File([fileOrBlob], fileName, { type: fileOrBlob.type || "image/jpeg" });
      const url = await uploadVoucherMediaFile(file);
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempId ? { ...img, image: url, uploading: false, preview: url } : img
        )
      );
      toast({
        title: "Image uploaded",
        description: "Photo saved and will be attached to this entry.",
        className: "bg-green-50 border-green-100 text-green-800",
      });
    } catch (error) {
      setImages((prev) => prev.filter((img) => img.id !== tempId));
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImageCount((count) => Math.max(0, count - 1));
    }
  };

  const handleImageUpload = (file) => {
    if (!file) return;
    if (isSinglePhotoLimitReached) {
      toast({
        title: "Single photo only",
        description: "Only one entry photo is allowed.",
        variant: "destructive",
      });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    uploadEntryImage(file, previewUrl, file.name || "vehicle-entry.jpg");
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!cameraOpen) {
      stopCameraStream();
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        setCameraError("");
        setCameraLoading(true);
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
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        console.error("Unable to access camera:", error);
        setCameraError("Unable to open webcam. Please allow camera permission and try again.");
      } finally {
        if (!cancelled) setCameraLoading(false);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraOpen]);

  const handleCaptureImage = async () => {
    if (isSinglePhotoLimitReached) {
      toast({
        title: "Single photo only",
        description: "Only one entry photo is allowed.",
        variant: "destructive",
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
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

    let imageData = "";
    let captureBlob = null;
    try {
      const captured = await captureCanvasImage(canvas);
      imageData = captured.preview;
      captureBlob = captured.blob;
    } catch (error) {
      console.error("Failed to capture image from canvas:", error);
      toast({
        title: "Capture failed",
        description: "Could not process the captured photo. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!captureBlob || captureBlob.size === 0) {
      toast({
        title: "Capture failed",
        description: "Captured photo was empty. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setCameraOpen(false);
    void uploadEntryImage(
      captureBlob,
      imageData,
      `vehicle-capture-${Date.now()}.jpg`
    );

    const detectVehicleNumber = async () => {
      try {
        setIsDetectingVehicleNumber(true);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        await worker.setParameters({
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -/",
        });

        const processedImages = preprocessPlateImages(canvas);
        const directCandidateScores = new Map();
        const correctedCandidateScores = new Map();
        const rawOcrTexts = [];
        const addNormalizedFallback = (text, confidence = 0, bonus = 0) => {
          const normalizedPlate = extractVehicleNumberFromText(text);
          if (!normalizedPlate) return;
          const cleaned = normalizeVehicleNumber(normalizedPlate);
          if (!cleaned) return;
          const prev = correctedCandidateScores.get(cleaned) || { score: 0, hits: 0 };
          const confidenceScore = Number.isFinite(confidence) ? Math.max(0, confidence) / 24 : 0;
          correctedCandidateScores.set(cleaned, {
            score: prev.score + 2 + confidenceScore + bonus,
            hits: prev.hits + 1,
          });
        };
        const addCandidate = (text, confidence = 0) => {
          if (!text) return;
          rawOcrTexts.push(String(text));
          const matches = extractVehicleCandidates(text);
          for (const plate of matches) {
            const prev = directCandidateScores.get(plate) || { score: 0, hits: 0 };
            const confidenceScore = Number.isFinite(confidence) ? Math.max(0, confidence) / 20 : 0;
            directCandidateScores.set(plate, {
              // Prioritize exact OCR regex candidates over corrected guesses.
              score: prev.score + 4 + confidenceScore,
              hits: prev.hits + 1,
            });
          }
          // OCR fallback path for noisy reads like KA2SAI234 / KAZ5A1234.
          addNormalizedFallback(text, confidence);
        };

        for (const psm of ["7", "6", "8", "11"]) {
          await worker.setParameters({ tessedit_pageseg_mode: psm });
          for (const src of processedImages) {
            const { data } = await worker.recognize(src);
            addCandidate(data?.text, data?.confidence);
            if (Array.isArray(data?.words) && data.words.length > 0) {
              addCandidate(data.words.map((w) => w?.text || "").join(" "), data?.confidence);
            }
          }
        }
        await worker.terminate();

        const combinedRawText = rawOcrTexts.join(" ").toUpperCase();
        console.log("[Vehicle OCR] RAW_TEXT:", combinedRawText.slice(0, 800));
        const mergedCandidates = extractVehicleCandidates(combinedRawText);
        for (const plate of mergedCandidates) {
          const prev = directCandidateScores.get(plate) || { score: 0, hits: 0 };
          directCandidateScores.set(plate, {
            score: prev.score + 6,
            hits: prev.hits + 1,
          });
        }
        addNormalizedFallback(combinedRawText, 80, 2);

        const rankedDirect = Array.from(directCandidateScores.entries()).sort((a, b) => {
          if (b[1].score !== a[1].score) return b[1].score - a[1].score;
          if (b[1].hits !== a[1].hits) return b[1].hits - a[1].hits;
          return b[0].length - a[0].length;
        });
        const rankedCorrected = Array.from(correctedCandidateScores.entries()).sort((a, b) => {
          if (b[1].score !== a[1].score) return b[1].score - a[1].score;
          if (b[1].hits !== a[1].hits) return b[1].hits - a[1].hits;
          return b[0].length - a[0].length;
        });

        const detectedNumber = (
          rankedDirect.length > 0 ? rankedDirect : rankedCorrected
        )
          .sort((a, b) => {
            if (b[1].score !== a[1].score) return b[1].score - a[1].score;
            if (b[1].hits !== a[1].hits) return b[1].hits - a[1].hits;
            return b[0].length - a[0].length;
          });

        const [best, secondBest] = detectedNumber;
        const bestScore = best?.[1]?.score ?? 0;
        const bestHits = best?.[1]?.hits ?? 0;
        const secondScore = secondBest?.[1]?.score ?? 0;
        const strongLead = bestScore - secondScore >= 1.5;
        const isConfident = !!best?.[0] && ((bestHits >= 2 && strongLead) || bestScore >= 10);

        if (best?.[0] && isConfident) {
          // Enforce requested output rules:
          // - only number
          // - no spaces/special chars
          // - uppercase
          const normalized = normalizeVehicleNumber(best[0]);
          console.log("[Vehicle OCR] Detected (ranked):", normalized);
          setVehicleNumber(normalized);
          toast({
            title: "Captured & detected",
            description: `Vehicle number detected: ${normalized}`,
            className: "bg-green-50 border-green-100 text-green-800",
          });
        } else if (best?.[0]) {
          console.log("[Vehicle OCR] LOW_CONFIDENCE candidate:", best?.[0]);
          toast({
            title: "Captured",
            description: "Detected number is low confidence. Please enter manually.",
            variant: "destructive",
          });
        } else {
          console.log("[Vehicle OCR] NOT_FOUND");
          toast({
            title: "Captured",
            description:
              "NOT_FOUND",
            variant: "destructive",
          });
        }
        return;
      } catch (error) {
        console.error("Vehicle number OCR failed:", error);
        toast({
          title: "Captured",
          description:
            "Photo captured, but vehicle number detection failed. Please enter manually.",
          variant: "destructive",
        });
      } finally {
        setIsDetectingVehicleNumber(false);
      }
    };

    void detectVehicleNumber();
  };

  const handlePreviewDialogChange = (open) => {
    if (open) return;
    setPreviewImage(null);
  };

  const handleImageThumbnailClose = (indexToRemove) => {
    setImages((prev) => {
      const removed = prev[indexToRemove];
      if (removed?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== indexToRemove);
    });
    setVehicleNumber("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const vehicle = vehicleNumber.trim().toUpperCase();
    const gross = toNumber(grossWeight);
    if (!vehicle) {
      toast({ title: "Required", description: "Vehicle number is required.", variant: "destructive" });
      return;
    }
    if (!gross) {
      toast({ title: "Required", description: "Entry weight is required.", variant: "destructive" });
      return;
    }
    const cleanedDriverMobile = driverMobile.replace(/\D/g, "");
    if (cleanedDriverMobile && cleanedDriverMobile.length < 10) {
      toast({
        title: "Invalid driver mobile",
        description: "Driver mobile number must be 10 digits.",
        variant: "destructive",
      });
      return;
    }
    if (uploadingImageCount > 0 || images.some((img) => img.uploading)) {
      toast({
        title: "Upload in progress",
        description: "Please wait for image upload to finish before saving.",
        variant: "destructive",
      });
      return;
    }

    const readyImages = images
      .filter((img) => img.image && !img.uploading)
      .map(({ image, image_type }) => ({
        image,
        image_url: image,
        image_type,
      }));

    createMutation.mutate({
      vehicle_number: vehicle,
      driver_name: driverName.trim() || null,
      driver_mobile: cleanedDriverMobile || null,
      gross_weight: gross,
      remarks: remarks.trim() || null,
      images: readyImages,
    });
  };

  if (permissionsLoading) {
    return (
      <div className="flex h-screen">
        <Loader />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="app-layout bg-gray-50">
        <Sidebar />
        <div className="app-main-content flex items-center justify-center p-6">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You do not have create permission for Vehicle Info.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setLocation("/vehicle-info")}>
                Back to list
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout bg-gray-50">
      <Sidebar />
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className="app-main-content flex flex-col overflow-hidden min-w-0">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-3 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile && (
              <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)} className="lg:hidden p-2">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/vehicle-info")}
              className="border-gray-300 shrink-0 h-9"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600 shrink-0" />
                New vehicle inward
              </h1>
              <p className="text-xs text-gray-500 hidden md:block">Record weighbridge entry (entry weight)</p>
            </div>
          </div>
          <Button
            type="submit"
            form="vehicle-inward-form"
            // className="bg-gradient-to-r from-black to-gray-600 text-white shrink-0 h-9"
            disabled={createMutation.isPending || uploadingImageCount > 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {createMutation.isPending ? "Saving..." : "Save Inward Entry"}
          </Button>
        </header>

        <main className="app-main-scrollable p-3 sm:p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 min-h-0">
          <form id="vehicle-inward-form" onSubmit={handleSubmit} className="w-full space-y-3">
            <Card className={themedCardClass}>
              <CardHeader className={themedCardHeaderClass}>
                <CardTitle className="text-sm font-semibold text-white">Vehicle details</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Vehicle number *</Label>
                    <Input
                      className={fieldTriggerClass}
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. MH12AB1234"
                      required
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Driver name</Label>
                    <Input
                      className={fieldTriggerClass}
                      value={driverName}
                      maxLength={30}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[A-Za-z\s]*$/.test(value)) {
                          setDriverName(value);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Driver mobile</Label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="\d*"
                      className={fieldTriggerClass}
                      value={driverMobile}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setDriverMobile(digitsOnly);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key.length === 1 &&
                          !/^\d$/.test(e.key) &&
                          !e.ctrlKey &&
                          !e.metaKey
                        ) {
                          e.preventDefault();
                        }
                      }}
                      onPaste={(e) => {
                        const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "");
                        if (pasted) {
                          e.preventDefault();
                          setDriverMobile(pasted.slice(0, 10));
                        }
                      }}
                      maxLength={10}
                      placeholder="10-digit mobile number"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 items-stretch">
              <Card className={themedCardClass}>
                <CardHeader className={themedCardHeaderClass}>
                  <CardTitle className="text-sm font-semibold text-white">Weight</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 md:gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <Label className={fieldLabelClass}>Entry weight (kg) *</Label>
                      <Input
                        type="number"
                        step="0.001"
                        className={fieldTriggerClass}
                        value={grossWeight}
                        onChange={(e) => setGrossWeight(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {netPreview != null && (
                    <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                      Gross: <strong>{netPreview.toLocaleString("en-IN")} kg</strong>
                      <span className="text-gray-400 ml-1">— net calculated on exit</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className={themedCardClass}>
                <CardHeader className={themedCardHeaderClass}>
                  <CardTitle className="text-sm font-semibold text-white">Remarks &amp; photos</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className={fieldLabelClass}>Remarks</Label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={2}
                      className="min-h-[2.5rem] resize-y border-gray-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={fieldLabelClass}>
                      {allowMultipleWeighbridgeImages ? "Entry photos (optional)" : "Entry photo (optional)"}
                    </Label>
                    <div className="flex flex-wrap gap-2 items-center min-h-10">
                      <label
                        className={cn(
                          "inline-flex items-center gap-2 h-10 px-3 border rounded-md text-sm",
                          isSinglePhotoLimitReached
                            ? "opacity-50 cursor-not-allowed pointer-events-none"
                            : "cursor-pointer hover:bg-gray-50"
                        )}
                      >
                        <Camera className="h-4 w-4" />
                        Add photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isSinglePhotoLimitReached}
                          onChange={(e) => {
                            handleImageUpload(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-3"
                        disabled={isSinglePhotoLimitReached}
                        onClick={() => {
                          if (isSinglePhotoLimitReached) return;
                          setCameraOpen(true);
                        }}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Capture image
                      </Button>
                      {images.map((img, idx) => {
                        const thumbSrc = img.preview || img.image;
                        return (
                          <div key={img.id || idx} className="relative w-10 h-10 rounded border overflow-hidden shrink-0">
                            <button
                              type="button"
                              className="w-full h-full"
                              onClick={() => thumbSrc && setPreviewImage(thumbSrc)}
                              title="View image"
                              disabled={!thumbSrc || img.uploading}
                            >
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
                            </button>
                            <button
                              type="button"
                              className="absolute top-0 right-0 bg-black/60 text-white p-0.5"
                              onClick={() => handleImageThumbnailClose(idx)}
                              disabled={img.uploading}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </main>
      </div>

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Capture image from webcam</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-black overflow-hidden">
              {cameraError ? (
                <div className="h-64 flex items-center justify-center text-sm text-red-600 bg-red-50 px-4 text-center">
                  {cameraError}
                </div>
              ) : (
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              )}
            </div>
            {cameraLoading && !cameraError && (
              <p className="text-xs text-gray-500">Opening camera...</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCameraOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCaptureImage}
                disabled={cameraLoading || !!cameraError}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isDetectingVehicleNumber ? "Detecting..." : "Capture"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keep canvas mounted outside the dialog so toBlob still works after close */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <Dialog open={!!previewImage} onOpenChange={handlePreviewDialogChange}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>
          <div className="rounded-md border overflow-hidden bg-black/5">
            {previewImage && (
              <img
                src={previewImage}
                alt="Entry photo preview"
                className="w-full max-h-[75vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
