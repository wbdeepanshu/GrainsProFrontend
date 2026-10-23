/** Round to 2 decimal places using integer math (avoids floating-point drift). */
export function roundMoney(value) {
  if (value == null || value === "") return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/** Format for API submission — string with exactly 2 decimal places. */
export function formatMoneyForApi(value) {
  const rounded = roundMoney(value);
  if (rounded == null) return null;
  return rounded.toFixed(2);
}

/** Normalize API / computed values for form inputs. */
export function normalizeMoneyFromApi(value) {
  const rounded = roundMoney(value);
  if (rounded == null) return "";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Currency display helper. */
export function formatMoneyDisplay(value) {
  const rounded = roundMoney(value);
  if (rounded == null) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function isValidMoneyAmount(value) {
  const rounded = roundMoney(value);
  return rounded != null && rounded > 0;
}

/** Allow digits and at most one decimal point (max 2 fractional digits). */
export function sanitizeMoneyInput(raw) {
  if (raw == null) return "";
  const str = String(raw).replace(/,/g, "");
  if (str === "" || str === ".") return str;
  const match = str.match(/^\d*\.?\d{0,2}/);
  return match ? match[0] : "";
}
