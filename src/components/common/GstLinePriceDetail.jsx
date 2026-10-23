/** Minimal stubs used by SalesInvoiceNotifyModal price breakdown UI. */
export function GstLinePriceDetail() {
  return null;
}

export function formatGstLinePrice() {
  return "";
}

export function getGstLineDetail() {
  return null;
}

export function getGstLineDisplayTotal(item, fallbackAmount = 0) {
  const amount = Number(
    item?.net_amount ?? item?.amount ?? item?.total_amount ?? fallbackAmount ?? 0,
  );
  return Number.isFinite(amount) ? amount : 0;
}
