/**
 * import-counts API: masters listed in “Import actions pending” when count is 0.
 * Other keys (units, stock group, category, purchase orders, sync, outstandings) are not shown here.
 */
export const IMPORT_COUNT_KEYS_ZERO_PENDING = [
  { key: "tblGodownMaster", label: "Godown Master" },
  { key: "tblStockItemMaster", label: "Item Master" },
  { key: "tblVoucherTypeMaster", label: "Voucher Type Master" },
  { key: "tblPartyInfo", label: "Ledger Master" },
  { key: "tblUserCreation", label: "User Master" },
];

export const COUNT_KEYS_EXCLUDED_FROM_PENDING_UI = new Set([
  "tblPurchaseOrders",
  "tblStockItemMasterSync",
  "tblLedgersOutstandings",
]);

export function parseImportCountNumeric(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const first = value.split("/")[0].trim();
    const n = Number(first);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function getPendingZeroImportItems(importCounts) {
  if (!importCounts || typeof importCounts !== "object") return [];
  return IMPORT_COUNT_KEYS_ZERO_PENDING.filter(
    ({ key }) => parseImportCountNumeric(importCounts[key]) === 0,
  );
}
