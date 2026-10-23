export const INDIAN_PLATE_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

export function sanitizeOcrText(rawText) {
  return String(rawText || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function extractIndianVehicleNumber(rawText) {
  const cleaned = sanitizeOcrText(rawText);
  if (!cleaned) return "";

  // Strict scan by segment lengths: SS + R(1-2) + S(1-3) + N(4)
  for (let start = 0; start < cleaned.length; start += 1) {
    for (let rtoLen = 1; rtoLen <= 2; rtoLen += 1) {
      for (let seriesLen = 1; seriesLen <= 3; seriesLen += 1) {
        const totalLen = 2 + rtoLen + seriesLen + 4;
        const chunk = cleaned.slice(start, start + totalLen);
        if (chunk.length !== totalLen) continue;
        if (INDIAN_PLATE_REGEX.test(chunk)) return chunk;
      }
    }
  }

  return "";
}
