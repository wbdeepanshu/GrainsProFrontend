import {
  cropPlateRegion,
  preprocessPlateForOcr,
  preprocessGreenInkForOcr,
} from "@/utils/imageUtils";

const VALID_INDIAN_STATE_CODES = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ", "HP", "HR",
  "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "PB",
  "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP", "WB",
]);

const VEHICLE_REGEX = /([A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4})/gi;
const HIGH_CONFIDENCE_THRESHOLD = 0.9;

export const normalizeVehicleNumber = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Slot-aware OCR correction: O↔0, I↔1, B↔8, S↔5, Z↔2, G↔6 */
export const normalizeOcrCharacter = (char, type) => {
  const c = String(char || "").toUpperCase();
  if (!c) return "";
  if (type === "alpha") {
    if (c === "0") return "O";
    if (c === "1") return "I";
    if (c === "2") return "Z";
    if (c === "5") return "S";
    if (c === "6") return "G";
    if (c === "8") return "B";
    return /[A-Z]/.test(c) ? c : "";
  }
  if (type === "digit") {
    if (c === "O" || c === "Q" || c === "D") return "0";
    if (c === "I" || c === "L") return "1";
    if (c === "Z") return "2";
    if (c === "S") return "5";
    if (c === "G") return "6";
    if (c === "B") return "8";
    return /\d/.test(c) ? c : "";
  }
  return c;
};

/** Digit-slot alternatives when OCR is ambiguous (handwritten plates). */
const AMBIGUOUS_DIGIT_ALTERNATIVES = {
  "0": ["0", "4", "6", "8"],
  "4": ["4", "0", "9"],
  "1": ["1", "7", "I"],
  "2": ["2", "7", "Z"],
  "5": ["5", "6", "S"],
  "6": ["6", "0", "5", "G"],
  "8": ["8", "0", "3", "B"],
  "3": ["3", "8"],
  "7": ["7", "1", "2"],
  "9": ["9", "4"],
};

export const parsePlateComponents = (vehicleNumber) => {
  const n = normalizeVehicleNumber(vehicleNumber);
  if (!n) {
    return { stateCode: "", rtoCode: "", series: "", number: "" };
  }

  const bhMatch = n.match(/^(\d{2})BH(\d{4})([A-Z]{1,2})$/);
  if (bhMatch) {
    return {
      stateCode: "BH",
      rtoCode: bhMatch[1],
      series: "BH",
      number: `${bhMatch[2]}${bhMatch[3]}`,
    };
  }

  const stdMatch = n.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  if (stdMatch) {
    return {
      stateCode: stdMatch[1],
      rtoCode: stdMatch[2],
      series: stdMatch[3],
      number: stdMatch[4],
    };
  }

  return { stateCode: "", rtoCode: "", series: "", number: "" };
};

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
  const normalizeSuffixChar = (c) => normalizeOcrCharacter(c, "alpha") || "";

  for (let i = 2; i < text.length - 5; i += 1) {
    const c1 = text[i];
    const c2 = text[i + 1];
    if (!isBLike(c1) || !isHLike(c2)) continue;

    const y1 = normalizeOcrCharacter(text[i - 2], "digit");
    const y2 = normalizeOcrCharacter(text[i - 1], "digit");
    if (!y1 || !y2) continue;

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

    return `${y1}${y2}BH${number}${suffix}`;
  }

  return "";
};

export const isValidIndianPlate = (plate) => {
  const n = normalizeVehicleNumber(plate);
  if (/^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(n)) return true;
  if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(n)) return false;
  return VALID_INDIAN_STATE_CODES.has(n.slice(0, 2));
};

const getSlotType = (index, rtoLen, seriesLen) => {
  if (index < 2) return "alpha";
  if (index < 2 + rtoLen) return "digit";
  if (index < 2 + rtoLen + seriesLen) return "alpha";
  return "digit";
};

const verifyPlateCharByChar = (plate) => {
  const n = normalizeVehicleNumber(plate);
  if (!isValidIndianPlate(n)) return false;

  const bh = n.match(/^(\d{2})BH(\d{4})([A-Z]{1,2})$/);
  if (bh) {
    const chars = n.split("");
    for (let i = 0; i < chars.length; i += 1) {
      let type = "digit";
      if (i >= 4 && i < 4 + 1 + bh[3].length) type = "alpha";
      const expected = normalizeOcrCharacter(chars[i], type);
      if (expected !== chars[i]) return false;
    }
    return true;
  }

  const match = n.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  if (!match) return false;

  const rtoLen = match[2].length;
  const seriesLen = match[3].length;
  const chars = n.split("");
  for (let i = 0; i < chars.length; i += 1) {
    const type = getSlotType(i, rtoLen, seriesLen);
    const expected = normalizeOcrCharacter(chars[i], type);
    if (expected !== chars[i]) return false;
  }
  return true;
};

const extractVehicleCandidates = (ocrText) => {
  if (!ocrText) return [];
  const rawMatches = String(ocrText).toUpperCase().match(VEHICLE_REGEX) || [];
  const normalized = rawMatches
    .map(normalizeVehicleNumber)
    .filter((value) => isValidIndianPlate(value) && verifyPlateCharByChar(value));
  return [...new Set(normalized)].sort((a, b) => b.length - a.length);
};

const repairNoisyCompact = (compact) => {
  let s = normalizeVehicleNumber(compact);
  if (!s) return s;

  // KA25AK1234 — spurious K before the last 4 digits.
  s = s.replace(/^([A-Z]{2}\d{2}[A-Z])K(\d{4})$/, "$1$2");
  s = s.replace(/^([A-Z]{2}\d{2}[A-Z]{1,2})I(\d{3})$/, "$11$2");
  s = s.replace(/^([A-Z]{2}\d{2}[A-Z])O(\d{4})$/, "$10$2");

  return s;
};

/** Vote per character across similar-length plate candidates. */
const reconcileByCharacterVotes = (plates) => {
  const valid = [...new Set(plates.filter((p) => isValidIndianPlate(p)))];
  if (valid.length === 0) return "";
  if (valid.length === 1) return valid[0];

  const byLength = new Map();
  for (const plate of valid) {
    const len = plate.length;
    if (!byLength.has(len)) byLength.set(len, []);
    byLength.get(len).push(plate);
  }

  let bestAssembly = "";
  let bestScore = -1;

  for (const group of byLength.values()) {
    if (group.length === 0) continue;
    const len = group[0].length;
    const charVotes = Array.from({ length: len }, () => new Map());

    for (const plate of group) {
      const parts = parsePlateComponents(plate);
      const rtoLen = parts.rtoCode.length;
      const seriesLen = parts.series.length;

      for (let i = 0; i < len; i += 1) {
        const type = getSlotType(i, rtoLen, seriesLen);
        const ch = plate[i];
        const normalized = normalizeOcrCharacter(ch, type) || ch;
        const bucket = charVotes[i];
        bucket.set(normalized, (bucket.get(normalized) || 0) + 1);

        if (type === "digit" && AMBIGUOUS_DIGIT_ALTERNATIVES[normalized]) {
          for (const alt of AMBIGUOUS_DIGIT_ALTERNATIVES[normalized]) {
            if (alt !== normalized) {
              bucket.set(alt, (bucket.get(alt) || 0) + 0.35);
            }
          }
        }
      }
    }

    let assembled = "";
    for (let i = 0; i < len; i += 1) {
      const bucket = charVotes[i];
      const parts = parsePlateComponents(group[0]);
      const rtoLen = parts.rtoCode.length;
      const seriesLen = parts.series.length;
      const type = getSlotType(i, rtoLen, seriesLen);

      const ranked = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
      const winner = ranked[0]?.[0] || group[0][i];
      assembled += normalizeOcrCharacter(winner, type) || winner;
    }

    const score = group.length;
    if (isValidIndianPlate(assembled) && score > bestScore) {
      bestScore = score;
      bestAssembly = assembled;
    }
  }

  return bestAssembly;
};

export const extractVehicleNumberFromText = (rawText) => {
  const text = String(rawText || "").toUpperCase();
  if (!text.trim()) return "";

  const compact = repairNoisyCompact(normalizeVehicleNumber(text));

  const bhSeriesNumber = detectBhSeriesVehicleNumber(compact);
  if (bhSeriesNumber && verifyPlateCharByChar(bhSeriesNumber)) return bhSeriesNumber;

  const normalizeCandidate = (candidate) => {
    const raw = String(candidate || "");
    if (raw.length < 7) return "";

    const chars = raw.split("");
    const rawState = `${normalizeOcrCharacter(chars[0], "alpha")}${normalizeOcrCharacter(chars[1], "alpha")}`;
    const resolvedState = resolveValidStateCode(rawState);
    if (!resolvedState) return "";

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

    let tailDigits = "";
    for (let i = chars.length - 1; i >= 0 && tailDigits.length < 4; i -= 1) {
      const d = normalizeOcrCharacter(chars[i], "digit");
      if (d) tailDigits = d + tailDigits;
      else if (tailDigits.length > 0) break;
    }
    if (tailDigits.length !== 4) return "";

    const middleStart = 2 + rtoDigits.length;
    const middleEnd = Math.max(middleStart, chars.length - tailDigits.length);
    let series = "";
    for (let i = middleStart; i < middleEnd; i += 1) {
      const a = normalizeOcrCharacter(chars[i], "alpha");
      if (a) series += a;
    }
    series = series.slice(0, 3);

    const merged = `${resolvedState}${rtoDigits}${series}${tailDigits}`;
    const normalized = normalizeVehicleNumber(merged);
    if (!isValidIndianPlate(normalized) || !verifyPlateCharByChar(normalized)) return "";
    return normalized;
  };

  const directMatches = (compact.match(/[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}/g) || [])
    .map(normalizeCandidate)
    .filter(Boolean);
  if (directMatches.length > 0) return directMatches[0];

  const tokens = text
    .split(/[\s\n\r\t/\\|,_\-.]+/)
    .map((t) => normalizeVehicleNumber(t))
    .filter((t) => t.length >= 7);

  for (const token of [compact, ...tokens]) {
    const result = normalizeCandidate(token);
    if (result) return result;
  }

  const source = compact;
  for (let start = 0; start < source.length; start += 1) {
    for (let seriesLen = 1; seriesLen <= 3; seriesLen += 1) {
      for (let rtoLen = 1; rtoLen <= 2; rtoLen += 1) {
        const len = 2 + rtoLen + seriesLen + 4;
        const chunk = source.slice(start, start + len);
        if (chunk.length !== len) continue;
        const result = normalizeCandidate(chunk);
        if (result) return result;
      }
    }
  }

  return "";
};

const makePreprocessVariants = (sourceCanvas) => {
  const makeVariant = (threshold = null, invert = false, scale = 2, mode = "gray") => {
    const out = document.createElement("canvas");
    out.width = sourceCanvas.width * scale;
    out.height = sourceCanvas.height * scale;
    const ctx = out.getContext("2d");
    if (!ctx) return sourceCanvas.toDataURL("image/jpeg", 0.92);

    ctx.drawImage(sourceCanvas, 0, 0, out.width, out.height);
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let gray = r * 0.299 + g * 0.587 + b * 0.114;
      let value = gray;

      if (mode === "green") {
        value = Math.max(0, g - Math.max(r, b) * 0.5);
        value = 255 - Math.min(255, value * 2.5);
      } else if (mode === "contrast") {
        value = Math.max(0, Math.min(255, (gray - 128) * 1.8 + 128));
      }

      if (threshold != null) value = value > threshold ? 255 : 0;
      if (invert) value = 255 - value;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(img, 0, 0);
    return out.toDataURL("image/jpeg", 0.95);
  };

  const centerBand = () => {
    const out = document.createElement("canvas");
    const bandY = Math.floor(sourceCanvas.height * 0.2);
    const bandH = Math.floor(sourceCanvas.height * 0.6);
    out.width = sourceCanvas.width * 2;
    out.height = bandH * 2;
    const ctx = out.getContext("2d");
    if (!ctx) return sourceCanvas.toDataURL("image/jpeg", 0.92);
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
    return out.toDataURL("image/jpeg", 0.95);
  };

  return [
    sourceCanvas.toDataURL("image/jpeg", 0.92),
    centerBand(),
    makeVariant(null, false, 2, "gray"),
    makeVariant(null, false, 3, "green"),
    makeVariant(120, false, 3, "green"),
    makeVariant(140, false, 3, "green"),
    makeVariant(110, true, 3, "green"),
    makeVariant(null, false, 2, "contrast"),
    makeVariant(110, false, 2),
    makeVariant(145, false, 2),
    makeVariant(175, false, 2),
    makeVariant(145, true, 2),
    makeVariant(130, false, 3),
  ];
};

const canvasFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

const buildProcessedImages = async (sourceCanvas) => {
  const baseUrl = sourceCanvas.toDataURL("image/jpeg", 0.92);
  const allImages = new Set(makePreprocessVariants(sourceCanvas));
  let plateCanvas = sourceCanvas;

  try {
    const { croppedDataUrl } = await cropPlateRegion(baseUrl);
    allImages.add(croppedDataUrl);
    allImages.add(await preprocessPlateForOcr(croppedDataUrl));
    allImages.add(await preprocessGreenInkForOcr(croppedDataUrl, { upscale: 3 }));
    allImages.add(await preprocessGreenInkForOcr(croppedDataUrl, { threshold: 130, upscale: 4 }));
    allImages.add(await preprocessGreenInkForOcr(croppedDataUrl, { threshold: 120, upscale: 4, invert: true }));

    plateCanvas = await canvasFromDataUrl(croppedDataUrl);
    makePreprocessVariants(plateCanvas).forEach((url) => allImages.add(url));
  } catch {
    allImages.add(await preprocessGreenInkForOcr(baseUrl, { upscale: 3 }));
    allImages.add(await preprocessGreenInkForOcr(baseUrl, { threshold: 130, upscale: 4 }));
  }

  allImages.add(baseUrl);
  return { plateFocused: Array.from(allImages), fullFrame: [baseUrl], plateCanvas };
};

const cropTailRegionDataUrls = (sourceCanvas) => {
  const urls = [];
  const addCrop = (xRatio, wRatio, scale = 4) => {
    const x = Math.floor(sourceCanvas.width * xRatio);
    const w = Math.max(1, Math.floor(sourceCanvas.width * wRatio));
    const h = sourceCanvas.height;
    const out = document.createElement("canvas");
    out.width = w * scale;
    out.height = h * scale;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(sourceCanvas, x, 0, w, h, 0, 0, out.width, out.height);
    urls.push(out.toDataURL("image/jpeg", 0.96));
  };

  addCrop(0.5, 0.5, 4);
  addCrop(0.55, 0.45, 5);
  addCrop(0.6, 0.4, 5);
  addCrop(0.65, 0.35, 6);
  return urls;
};

const preprocessTailForDigits = async (dataUrl) => {
  const canvas = await canvasFromDataUrl(dataUrl);
  const out = document.createElement("canvas");
  out.width = canvas.width * 2;
  out.height = canvas.height * 2;
  const ctx = out.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let value = Math.max(0, g - Math.max(r, b) * 0.45);
    value = 255 - Math.min(255, value * 2.8);
    value = value > 125 ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return out.toDataURL("image/jpeg", 0.98);
};

const readTailDigits = async (worker, sourceCanvas) => {
  const tailImages = cropTailRegionDataUrls(sourceCanvas);
  const processed = await Promise.all(tailImages.map((url) => preprocessTailForDigits(url)));
  const allTailImages = [...tailImages, ...processed];

  await worker.setParameters({
    tessedit_char_whitelist: "0123456789",
    tessedit_pageseg_mode: "7",
  });

  const digitVotes = new Map();
  const fourDigitVotes = new Map();

  for (const src of allTailImages) {
    for (const psm of ["7", "8", "13"]) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await worker.recognize(src);
      const raw = normalizeVehicleNumber(data?.text || "").replace(/[^0-9]/g, "");

      for (const ch of raw) {
        digitVotes.set(ch, (digitVotes.get(ch) || 0) + 1);
        if (AMBIGUOUS_DIGIT_ALTERNATIVES[ch]) {
          for (const alt of AMBIGUOUS_DIGIT_ALTERNATIVES[ch]) {
            if (alt !== ch) digitVotes.set(alt, (digitVotes.get(alt) || 0) + 0.4);
          }
        }
      }

      const chunks = raw.match(/\d{4}/g) || [];
      for (const chunk of chunks) {
        fourDigitVotes.set(chunk, (fourDigitVotes.get(chunk) || 0) + 2);
      }
      if (raw.length >= 4) {
        const tail = raw.slice(-4);
        fourDigitVotes.set(tail, (fourDigitVotes.get(tail) || 0) + 3);
      }
    }
  }

  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    preserve_interword_spaces: "0",
  });

  const rankedTail = Array.from(fourDigitVotes.entries()).sort((a, b) => b[1] - a[1]);

  const posVotes = Array.from({ length: 4 }, () => new Map());
  for (const [chunk, weight] of fourDigitVotes.entries()) {
    if (chunk.length !== 4) continue;
    for (let i = 0; i < 4; i += 1) {
      const ch = chunk[i];
      posVotes[i].set(ch, (posVotes[i].get(ch) || 0) + weight);
      if (AMBIGUOUS_DIGIT_ALTERNATIVES[ch]) {
        for (const alt of AMBIGUOUS_DIGIT_ALTERNATIVES[ch]) {
          if (alt !== ch) posVotes[i].set(alt, (posVotes[i].get(alt) || 0) + weight * 0.45);
        }
      }
    }
  }

  const positionalTail = posVotes
    .map((bucket) => {
      const ranked = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
      return ranked[0]?.[0] || "";
    })
    .join("");

  const bestTail = /^\d{4}$/.test(positionalTail)
    ? positionalTail
    : rankedTail[0]?.[0] || "";

  return {
    bestTail,
    tailVotes: fourDigitVotes,
    digitVotes,
    positionalTail,
  };
};

const mergePlateWithTail = (plate, tailResult) => {
  if (!plate || !isValidIndianPlate(plate) || !tailResult?.bestTail) return plate;
  const parts = parsePlateComponents(plate);
  if (!parts.number || parts.number.length !== 4) return plate;

  const prefix = plate.slice(0, -4);
  const tail = tailResult.bestTail;
  if (!/^\d{4}$/.test(tail)) return plate;

  const merged = `${prefix}${tail}`;
  if (!isValidIndianPlate(merged)) return plate;

  const currentVotes = tailResult.tailVotes.get(parts.number) || 0;
  const newVotes = tailResult.tailVotes.get(tail) || 0;

  if (tail !== parts.number && newVotes >= currentVotes * 0.85) {
    return merged;
  }
  if (tail !== parts.number && newVotes > currentVotes) {
    return merged;
  }
  if (
    tail !== parts.number &&
    tailResult.positionalTail &&
    /^\d{4}$/.test(tailResult.positionalTail) &&
    tail === tailResult.positionalTail
  ) {
    return merged;
  }
  return plate;
};

const collectAllPlateCandidates = (tripleReads, fallbackRaw) => {
  const plates = [];
  for (const read of tripleReads) {
    if (read.best?.plate) plates.push(read.best.plate);
    if (read.plateVotes) {
      for (const plate of read.plateVotes.keys()) plates.push(plate);
    }
  }
  for (const plate of extractVehicleCandidates(fallbackRaw)) plates.push(plate);
  const parsed = extractVehicleNumberFromText(fallbackRaw);
  if (parsed) plates.push(parsed);

  const spaced = fallbackRaw.replace(/\s+/g, "");
  const fromSpaced = extractVehicleNumberFromText(spaced);
  if (fromSpaced) plates.push(fromSpaced);

  return plates;
};

const pickBestFromOcr = (text, ocrConfidence = 0) => {
  const raw = String(text || "").toUpperCase();
  const plate = extractVehicleNumberFromText(raw);
  if (!plate) return null;
  return {
    plate,
    confidence: Number.isFinite(ocrConfidence) ? ocrConfidence / 100 : 0,
    raw,
  };
};

const runSingleReadPass = async (worker, images, psm) => {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  let best = null;
  const rawParts = [];
  const plateVotes = new Map();

  const registerPlate = (plate, ocrConfidence = 0) => {
    if (!plate || !isValidIndianPlate(plate)) return;
    const prev = plateVotes.get(plate) || { count: 0, conf: 0 };
    plateVotes.set(plate, {
      count: prev.count + 1,
      conf: prev.conf + (Number.isFinite(ocrConfidence) ? ocrConfidence / 100 : 0),
    });
    const score = plateVotes.get(plate);
    if (!best || score.count > best.votes || (score.count === best.votes && score.conf > best.conf)) {
      best = { plate, votes: score.count, conf: score.conf };
    }
  };

  for (const src of images) {
    const { data } = await worker.recognize(src);
    const text = data?.text || "";
    rawParts.push(text);

    const candidate = pickBestFromOcr(text, data?.confidence);
    if (candidate) registerPlate(candidate.plate, data?.confidence);

    for (const plate of extractVehicleCandidates(text)) {
      registerPlate(plate, data?.confidence);
    }

    if (Array.isArray(data?.words) && data.words.length > 0) {
      const wordText = data.words.map((w) => w?.text || "").join("");
      const wordConf =
        data.words.reduce((sum, w) => sum + (Number(w?.confidence) || 0), 0) /
        Math.max(1, data.words.length);
      rawParts.push(wordText);
      const wordCandidate = pickBestFromOcr(wordText, wordConf);
      if (wordCandidate) registerPlate(wordCandidate.plate, wordConf);
      for (const plate of extractVehicleCandidates(wordText)) {
        registerPlate(plate, wordConf);
      }
    }
  }

  const bestPlate = best?.plate || "";
  return {
    best: bestPlate
      ? { plate: bestPlate, confidence: best?.conf || 0, raw: rawParts.join(" ") }
      : null,
    rawText: rawParts.join(" ").toUpperCase(),
    plateVotes,
  };
};

const reconcileThreeReads = (reads) => {
  const validReads = reads.filter((r) => r?.best?.plate);
  if (validReads.length === 0) {
    return { plate: "", confidence: 0, rawDetectedText: "" };
  }

  const voteMap = new Map();
  for (const read of validReads) {
    const plate = read.best.plate;
    const prev = voteMap.get(plate) || { count: 0, ocrSum: 0, raws: [] };
    voteMap.set(plate, {
      count: prev.count + 1,
      ocrSum: prev.ocrSum + read.best.confidence,
      raws: [...prev.raws, read.rawText],
    });
  }

  const ranked = Array.from(voteMap.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return b[1].ocrSum - a[1].ocrSum;
  });

  const [winnerPlate, winnerMeta] = ranked[0];
  const agreement = winnerMeta.count / validReads.length;
  const avgOcr = winnerMeta.ocrSum / winnerMeta.count;

  let confidence;
  if (winnerMeta.count === 3) {
    confidence = Math.min(0.99, 0.92 + avgOcr * 0.07);
  } else if (winnerMeta.count === 2) {
    confidence = Math.min(0.89, 0.78 + avgOcr * 0.1);
  } else {
    confidence = Math.min(0.75, 0.45 + avgOcr * 0.3);
  }

  if (agreement < 1 && ranked.length > 1 && ranked[1][1].count === winnerMeta.count) {
    confidence = Math.min(confidence, 0.72);
  }

  return {
    plate: winnerPlate,
    confidence: Math.round(confidence * 100) / 100,
    rawDetectedText: winnerMeta.raws.join(" | ").slice(0, 500),
  };
};

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

const buildResult = (plate, confidence, rawDetectedText) => {
  if (!plate || !isValidIndianPlate(plate) || !verifyPlateCharByChar(plate)) {
    return emptyResult();
  }

  const vehicleNumber = normalizeVehicleNumber(plate);
  const parts = parsePlateComponents(vehicleNumber);
  const lowConfidence = confidence < HIGH_CONFIDENCE_THRESHOLD;

  return {
    vehicleNumber,
    stateCode: parts.stateCode,
    rtoCode: parts.rtoCode,
    series: parts.series,
    number: parts.number,
    confidence: Math.round(confidence * 100) / 100,
    rawDetectedText,
    lowConfidence,
  };
};

/**
 * ANPR: locate plate, triple-read, validate Indian format, return structured result.
 */
export async function detectVehicleNumberFromCanvas(sourceCanvas) {
  if (!sourceCanvas) return emptyResult();

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1);
  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    preserve_interword_spaces: "0",
  });

  const { plateFocused, fullFrame, plateCanvas } = await buildProcessedImages(sourceCanvas);
  const primaryImages = plateFocused.length > 0 ? plateFocused : fullFrame;

  const readPasses = [
    { images: primaryImages, psm: "7" },
    { images: primaryImages, psm: "8" },
    { images: primaryImages, psm: "6" },
    { images: fullFrame.concat(primaryImages.slice(0, 4)), psm: "11" },
  ];

  const tripleReads = [];
  for (const pass of readPasses) {
    tripleReads.push(await runSingleReadPass(worker, pass.images, pass.psm));
  }

  const tailSource = plateCanvas || sourceCanvas;
  const tailResult = await readTailDigits(worker, tailSource);

  await worker.terminate();

  const fallbackRaw = tripleReads.map((r) => r.rawText).join(" ");
  const allCandidates = collectAllPlateCandidates(tripleReads, fallbackRaw);

  if (tailResult.positionalTail && /^\d{4}$/.test(tailResult.positionalTail)) {
    for (const plate of [...allCandidates]) {
      if (plate.length >= 8) {
        const variant = `${plate.slice(0, -4)}${tailResult.positionalTail}`;
        if (isValidIndianPlate(variant)) allCandidates.push(variant);
      }
    }
  }

  let winnerPlate = reconcileByCharacterVotes(allCandidates);

  if (!winnerPlate) {
    const globalVotes = new Map();
    for (const read of tripleReads) {
      if (read.best?.plate) {
        const plate = read.best.plate;
        const prev = globalVotes.get(plate) || { count: 0, conf: 0 };
        globalVotes.set(plate, {
          count: prev.count + 2,
          conf: prev.conf + (read.best.confidence || 0),
        });
      }
      if (read.plateVotes) {
        for (const [plate, meta] of read.plateVotes.entries()) {
          const prev = globalVotes.get(plate) || { count: 0, conf: 0 };
          globalVotes.set(plate, {
            count: prev.count + meta.count,
            conf: prev.conf + meta.conf,
          });
        }
      }
    }
    const ranked = Array.from(globalVotes.entries()).sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return b[1].conf - a[1].conf;
    });
    winnerPlate = ranked[0]?.[0] || "";
  }

  if (winnerPlate) {
    winnerPlate = mergePlateWithTail(winnerPlate, tailResult);
    const tailCorrected = reconcileByCharacterVotes(
      allCandidates.map((p) => mergePlateWithTail(p, tailResult))
    );
    if (tailCorrected && isValidIndianPlate(tailCorrected)) {
      winnerPlate = tailCorrected;
    }
  }

  if (!winnerPlate) {
    const reconciled = reconcileThreeReads(tripleReads);
    winnerPlate = mergePlateWithTail(reconciled.plate, tailResult);
    if (!winnerPlate) {
      return { ...emptyResult(), rawDetectedText: fallbackRaw.slice(0, 500) };
    }
    return buildResult(winnerPlate, reconciled.confidence, reconciled.rawDetectedText);
  }

  const voteCount = allCandidates.filter((p) => p === winnerPlate).length;
  const tailBoost = tailResult.bestTail && winnerPlate.endsWith(tailResult.bestTail) ? 0.08 : 0;
  let confidence;
  if (voteCount >= 4) {
    confidence = Math.min(0.99, 0.93 + tailBoost);
  } else if (voteCount >= 2) {
    confidence = Math.min(0.91, 0.82 + tailBoost);
  } else {
    confidence = Math.min(0.78, 0.62 + tailBoost);
  }

  return buildResult(winnerPlate, confidence, fallbackRaw.slice(0, 500));
};

export async function detectVehicleNumberFromDataUrl(dataUrl) {
  if (!dataUrl) return emptyResult();
  const canvas = await canvasFromDataUrl(dataUrl);
  return detectVehicleNumberFromCanvas(canvas);
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export async function detectVehicleNumberFromFile(file) {
  if (!file) return emptyResult();
  const dataUrl = await fileToDataUrl(file);
  return detectVehicleNumberFromDataUrl(dataUrl);
}
