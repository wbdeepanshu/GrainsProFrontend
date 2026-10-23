import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  extractVehicleNumberFromText,
  isValidIndianPlate,
  normalizeVehicleNumber,
  parsePlateComponents,
} from "@/utils/vehiclePlateOcr";

const HIGH_CONFIDENCE_THRESHOLD = 0.9;
const GEMINI_MODEL = "gemini-1.5-flash";

const VEHICLE_PLATE_PROMPT = `You are an expert ANPR (Automatic Number Plate Recognition) system for Indian vehicles.

Analyze the image and extract ONLY the vehicle registration number from the number plate.

Rules:
1. Focus only on the registration number — ignore stickers, branding, dates, watermarks, and background text.
2. Indian formats: KA01AB1234, KA25A1234, TS09EF5678, AP39CD1234, MH12AB1234, DL01AA1234, 22BH6517A (BH series).
3. Remove spaces, hyphens, dots, and special characters.
4. Return uppercase letters and digits only in vehicleNumber.
5. Do not guess characters that are not clearly visible.
6. O↔0, I↔1, B↔8, S↔5, Z↔2, G↔6 corrections only when visually ambiguous.

Respond with ONLY valid JSON (no markdown, no explanation):
{"vehicleNumber":"KA25A1234","confidence":0.95}

If no plate found:
{"vehicleNumber":"","confidence":0}`;

const emptyResult = () => ({
  vehicleNumber: "",
  stateCode: "",
  rtoCode: "",
  series: "",
  number: "",
  confidence: 0,
  rawDetectedText: "",
  lowConfidence: true,
});

const buildResult = (vehicleNumber, confidence, rawDetectedText) => {
  const normalized = normalizeVehicleNumber(vehicleNumber);
  if (!normalized || !isValidIndianPlate(normalized)) {
    return emptyResult();
  }

  const parts = parsePlateComponents(normalized);
  const conf = Math.min(0.99, Math.max(0, Number(confidence) || 0));

  return {
    vehicleNumber: normalized,
    stateCode: parts.stateCode,
    rtoCode: parts.rtoCode,
    series: parts.series,
    number: parts.number,
    confidence: Math.round(conf * 100) / 100,
    rawDetectedText: String(rawDetectedText || "").slice(0, 500),
    lowConfidence: conf < HIGH_CONFIDENCE_THRESHOLD,
  };
};

const parseGeminiResponse = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const tryParse = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(raw);
  if (parsed) return parsed;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) parsed = tryParse(fenced[1].trim());
  if (parsed) return parsed;

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) parsed = tryParse(objectMatch[0]);
  if (parsed) return parsed;

  const fromText = extractVehicleNumberFromText(raw);
  if (fromText) {
    return { vehicleNumber: fromText, confidence: 0.75 };
  }

  return null;
};

const blobToGenerativePart = async (blob, mimeType = "image/jpeg") => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    inlineData: {
      data: btoa(binary),
      mimeType: blob.type || mimeType,
    },
  };
};

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_GENERATIVE_AI_KEY;
  if (!apiKey) {
    throw new Error("VITE_GOOGLE_GENERATIVE_AI_KEY is not configured.");
  }
  return new GoogleGenerativeAI(apiKey);
};

const detectFromImagePart = async (imagePart) => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent([VEHICLE_PLATE_PROMPT, imagePart]);
  const responseText = result?.response?.text?.() || "";
  const parsed = parseGeminiResponse(responseText);

  if (!parsed?.vehicleNumber) {
    const fallback = extractVehicleNumberFromText(responseText);
    if (fallback) {
      return buildResult(fallback, parsed?.confidence ?? 0.7, responseText);
    }
    return { ...emptyResult(), rawDetectedText: responseText.slice(0, 500) };
  }

  return buildResult(parsed.vehicleNumber, parsed.confidence ?? 0.9, responseText);
};

export async function detectVehicleNumberWithGeminiFromBlob(blob, mimeType = "image/jpeg") {
  if (!blob) return emptyResult();
  const imagePart = await blobToGenerativePart(blob, mimeType);
  return detectFromImagePart(imagePart);
}

export async function detectVehicleNumberWithGeminiFromFile(file) {
  if (!file) return emptyResult();
  return detectVehicleNumberWithGeminiFromBlob(file, file.type || "image/jpeg");
}

export async function detectVehicleNumberWithGeminiFromCanvas(canvas) {
  if (!canvas) return emptyResult();
  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
  if (!blob) return emptyResult();
  return detectVehicleNumberWithGeminiFromBlob(blob, "image/jpeg");
}

export async function detectVehicleNumberWithGeminiFromDataUrl(dataUrl) {
  if (!dataUrl) return emptyResult();
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return detectVehicleNumberWithGeminiFromBlob(blob, blob.type || "image/jpeg");
}
