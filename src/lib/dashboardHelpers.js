/** Coerce API values to displayable numbers; empty/null → 0 */
export function num(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value) {
  const rounded = Math.round(num(value));
  return `₹${rounded.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export const DEFAULT_SALES_ORDER = {
  total_sales_orders: 0,
  total_sales_order_value: 0,
  total_sales_orders_approved: 0,
  total_approved_value: 0,
  total_sales_orders_pending: 0,
  total_count: 0,
  pending_count: 0,
  approved_count: 0,
  error: null,
};

export const DEFAULT_ITEM_DETAILS = {
  top_selling_items_count: 0,
  party_wise_purchase_order_count: 0,
  purchase_order_count: 0,
  top_selling_items: [],
  party_wise_purchase_orders: [],
  error: null,
};

export const DEFAULT_SYNC_STATUS = {
  sales_invoice_not_synced: 0,
  sales_return_not_synced: 0,
  purchase_invoice_not_synced: 0,
  gate_pass_pending_or_partial: 0,
  inward_not_completed: 0,
  credit_note_not_synced: 0,
  debit_note_not_synced: 0,
  contra_entry_not_synced: 0,
  error: null,
};

export function withNumericDefaults(source, defaults) {
  const out = { ...defaults };
  if (!source || typeof source !== "object") return out;
  Object.keys(defaults).forEach((key) => {
    if (source[key] === undefined || source[key] === null) return;
    if (typeof defaults[key] === "number") {
      out[key] = num(source[key]);
    } else if (Array.isArray(defaults[key])) {
      out[key] = Array.isArray(source[key]) ? source[key] : defaults[key];
    } else {
      out[key] = source[key];
    }
  });
  return out;
}
