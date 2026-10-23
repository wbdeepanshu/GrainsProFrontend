export function toNumber(value) {
  const parsed = parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseRate(rawRate) {
  if (!rawRate) return 0;
  const rateText = String(rawRate).split("/")[0]?.trim() || "0";
  return toNumber(rateText);
}

export function parseQtyPrimary(qtyStr) {
  if (!qtyStr) return "";
  const match = String(qtyStr).trim().match(/^(\d+\.?\d*)/);
  return match ? match[1] : String(qtyStr);
}

export function normalizeStatusKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

export function getSalesReturnStatusKey(row) {
  if (row?.status === "Inward Created") return "inward_created";
  if (row?.status_key) return normalizeStatusKey(row.status_key);
  return normalizeStatusKey(row?.status);
}

export function isSalesReturnInwardEligible(row) {
  const statusKey = getSalesReturnStatusKey(row);
  if (statusKey === "inward_created") return false;
  if (typeof row?.is_inward_eligible === "boolean") return row.is_inward_eligible;
  return ["approved", "partially_completed", "partially_approved"].includes(statusKey);
}

export function formatSelectedInvoiceNumbers(labels) {
  return (labels || []).filter(Boolean).join(", ");
}

export function parseSelectedInvoiceNumbers(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
