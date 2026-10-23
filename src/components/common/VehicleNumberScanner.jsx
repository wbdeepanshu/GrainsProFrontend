import { useCallback, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import Tesseract from "tesseract.js";
import { Camera, Loader2, RefreshCcw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Indian registration regex (requested format).
const VEHICLE_REGEX = /([A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4})/gi;

const cleanVehicleNumber = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * Extract all vehicle-number-like matches from OCR text, normalize each, and
 * return unique candidates sorted by length (more specific first).
 */
const extractVehicleCandidates = (ocrText) => {
  if (!ocrText) return [];
  const rawMatches = String(ocrText).toUpperCase().match(VEHICLE_REGEX) || [];
  const normalized = rawMatches
    .map(cleanVehicleNumber)
    .filter((value) => /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(value));
  return [...new Set(normalized)].sort((a, b) => b.length - a.length);
};

/**
 * Draw input image on canvas and apply preprocessing:
 * 1) grayscale conversion
 * 2) contrast enhancement
 * Output is returned as JPEG dataURL for OCR.
 */
const preprocessImage = async (imageDataUrl) => {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return imageDataUrl;

  // Draw original image first.
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Read pixels so we can apply grayscale + contrast.
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1.45;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Step 1: grayscale luminance.
    let gray = r * 0.299 + g * 0.587 + b * 0.114;

    // Step 2: contrast enhancement around midpoint 128.
    gray = (gray - 128) * contrast + 128;
    const clamped = Math.max(0, Math.min(255, gray));

    data[i] = clamped;
    data[i + 1] = clamped;
    data[i + 2] = clamped;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
};

/**
 * VehicleNumberScanner
 *
 * Features:
 * - Image upload
 * - Webcam capture (react-webcam)
 * - OCR using Tesseract.js
 * - Live OCR progress
 * - Regex extraction and normalization
 * - Auto-fill vehicle number input
 * - Graceful error handling
 */
export default function VehicleNumberScanner({
  onDetected,
  onError,
  initialValue = "",
  title = "Vehicle Number Scanner",
}) {
  const fileInputRef = useRef(null);
  const webcamRef = useRef(null);

  const [vehicleNumber, setVehicleNumber] = useState(cleanVehicleNumber(initialValue));
  const [imagePreview, setImagePreview] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const hasResult = useMemo(() => !!vehicleNumber, [vehicleNumber]);

  const handleDetectedValue = useCallback(
    (value) => {
      const normalized = cleanVehicleNumber(value);
      setVehicleNumber(normalized);
      if (normalized) onDetected?.(normalized);
    },
    [onDetected]
  );

  const runOcr = useCallback(
    async (dataUrl) => {
      try {
        setIsScanning(true);
        setErrorMessage("");
        setOcrProgress(0);
        setCandidates([]);
        setImagePreview(dataUrl);

        // Preprocess image before OCR for better readability.
        const processedDataUrl = await preprocessImage(dataUrl);

        const result = await Tesseract.recognize(processedDataUrl, "eng", {
          logger: (m) => {
            // Live OCR progress (0..1 -> 0..100).
            if (m?.status === "recognizing text" && Number.isFinite(m.progress)) {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });

        const rawText = result?.data?.text || "";
        const foundCandidates = extractVehicleCandidates(rawText);
        setCandidates(foundCandidates);

        if (foundCandidates.length > 0) {
          // Auto-fill best candidate.
          handleDetectedValue(foundCandidates[0]);
        } else {
          setErrorMessage("No vehicle number found. Please retry with a clearer image.");
          onError?.("NOT_FOUND");
        }
      } catch (error) {
        console.error("Vehicle OCR error:", error);
        const message = "OCR failed. Please try again.";
        setErrorMessage(message);
        onError?.(message);
      } finally {
        setIsScanning(false);
      }
    },
    [handleDetectedValue, onError]
  );

  const onUploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Read selected file as dataURL and run OCR.
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = String(e.target?.result || "");
      if (dataUrl) await runOcr(dataUrl);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const onCaptureFromCamera = async () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      setErrorMessage("Unable to capture image from webcam.");
      return;
    }
    await runOcr(screenshot);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Vehicle number *</Label>
          <Input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(cleanVehicleNumber(e.target.value))}
            placeholder="e.g. KA25A1234"
            maxLength={10}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Upload action */}
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onUploadFile}
          />

          {/* Webcam toggle */}
          <Button
            type="button"
            variant={isCameraOpen ? "secondary" : "outline"}
            onClick={() => setIsCameraOpen((prev) => !prev)}
            disabled={isScanning}
          >
            <Camera className="h-4 w-4 mr-2" />
            {isCameraOpen ? "Close camera" : "Open camera"}
          </Button>

          {isCameraOpen && (
            <Button type="button" onClick={onCaptureFromCamera} disabled={isScanning}>
              Capture & detect
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setVehicleNumber("");
              setImagePreview("");
              setCandidates([]);
              setErrorMessage("");
              setOcrProgress(0);
            }}
            disabled={isScanning}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {isCameraOpen && (
          <div className="rounded-md overflow-hidden border bg-black">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.95}
              videoConstraints={{ facingMode: "environment" }}
              className="w-full h-[280px] object-cover"
            />
          </div>
        )}

        {isScanning && (
          <div className="rounded-md border bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running OCR... {ocrProgress}%
            </div>
            <div className="mt-2 h-2 rounded bg-amber-100 overflow-hidden">
              <div
                className="h-2 bg-amber-500 transition-all"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        )}

        {!!errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {candidates.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Detected options:</p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((candidate) => (
                <Button
                  key={candidate}
                  type="button"
                  variant={candidate === vehicleNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDetectedValue(candidate)}
                >
                  {candidate}
                </Button>
              ))}
            </div>
          </div>
        )}

        {imagePreview && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Latest image:</p>
            <div className="rounded-md overflow-hidden border bg-muted/20">
              <img
                src={imagePreview}
                alt="Vehicle scan source"
                className="w-full max-h-[320px] object-contain"
              />
            </div>
          </div>
        )}

        {hasResult && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Detected vehicle number: <strong>{vehicleNumber}</strong>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

