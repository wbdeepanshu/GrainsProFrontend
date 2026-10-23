const toImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const toCanvas = (img) => {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return canvas;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Lightweight, frontend-only plate region heuristic.
// Detects dense text-like horizontal bands and chooses a wide rectangle.
export async function cropPlateRegion(imageDataUrl) {
  const img = await toImage(imageDataUrl);
  const canvas = toCanvas(img);
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert to grayscale.
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }

  // Row-wise edge energy score.
  const rowScore = new Float32Array(height);
  for (let y = 1; y < height - 1; y += 1) {
    let sum = 0;
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
      const gy = Math.abs(gray[idx + width] - gray[idx - width]);
      sum += gx + gy;
    }
    rowScore[y] = sum / width;
  }

  // Find strongest contiguous band.
  let bestStart = Math.floor(height * 0.3);
  let bestEnd = Math.floor(height * 0.7);
  let bestBandScore = -1;
  const threshold =
    rowScore.reduce((acc, v) => acc + v, 0) / Math.max(1, rowScore.length) * 1.15;

  let runStart = -1;
  let runAccum = 0;
  for (let y = 0; y < height; y += 1) {
    if (rowScore[y] > threshold) {
      if (runStart === -1) {
        runStart = y;
        runAccum = 0;
      }
      runAccum += rowScore[y];
    } else if (runStart !== -1) {
      const runEnd = y - 1;
      const runH = runEnd - runStart + 1;
      if (runH >= Math.floor(height * 0.08) && runAccum > bestBandScore) {
        bestBandScore = runAccum;
        bestStart = runStart;
        bestEnd = runEnd;
      }
      runStart = -1;
      runAccum = 0;
    }
  }

  const bandPad = Math.floor(height * 0.03);
  let y1 = clamp(bestStart - bandPad, 0, height - 1);
  let y2 = clamp(bestEnd + bandPad, y1 + 1, height);

  // Column-wise score only within selected rows.
  const colScore = new Float32Array(width);
  for (let x = 1; x < width - 1; x += 1) {
    let sum = 0;
    for (let y = y1 + 1; y < y2 - 1; y += 1) {
      const idx = y * width + x;
      const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
      const gy = Math.abs(gray[idx + width] - gray[idx - width]);
      sum += gx + gy;
    }
    colScore[x] = sum / Math.max(1, y2 - y1);
  }

  const colAvg = colScore.reduce((acc, v) => acc + v, 0) / Math.max(1, width);
  const colThreshold = colAvg * 1.1;
  let x1 = Math.floor(width * 0.15);
  let x2 = Math.floor(width * 0.85);

  for (let x = 0; x < width; x += 1) {
    if (colScore[x] > colThreshold) {
      x1 = x;
      break;
    }
  }
  for (let x = width - 1; x >= 0; x -= 1) {
    if (colScore[x] > colThreshold) {
      x2 = x;
      break;
    }
  }

  // Keep expected plate aspect fallback (wide rectangle).
  if (x2 - x1 < width * 0.35) {
    x1 = Math.floor(width * 0.2);
    x2 = Math.floor(width * 0.9);
  }
  if (y2 - y1 < height * 0.08) {
    y1 = Math.floor(height * 0.45);
    y2 = Math.floor(height * 0.75);
  }

  const cropW = clamp(x2 - x1, 1, width);
  const cropH = clamp(y2 - y1, 1, height);
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  outCtx.drawImage(canvas, x1, y1, cropW, cropH, 0, 0, cropW, cropH);

  return {
    croppedDataUrl: out.toDataURL("image/jpeg", 0.95),
    bbox: { x: x1, y: y1, width: cropW, height: cropH },
  };
}

// Preprocess cropped plate for OCR: grayscale + contrast + threshold.
export async function preprocessPlateForOcr(croppedDataUrl) {
  const img = await toImage(croppedDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * 2;
  canvas.height = img.height * 2;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const contrasted = clamp((gray - 128) * 1.6 + 128, 0, 255);
    const bin = contrasted > 130 ? 255 : 0;
    data[i] = bin;
    data[i + 1] = bin;
    data[i + 2] = bin;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.98);
}

/** Isolate green/dark marker ink strokes on white paper for handwritten plates. */
export async function preprocessGreenInkForOcr(dataUrl, { threshold = null, upscale = 3, invert = false } = {}) {
  const img = await toImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * upscale;
  canvas.height = img.height * upscale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let value = Math.max(0, g - Math.max(r, b) * 0.5);
    value = 255 - Math.min(255, value * 2.5);
    if (threshold != null) value = value > threshold ? 255 : 0;
    if (invert) value = 255 - value;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}
