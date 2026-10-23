/** Match MWB gst helpers used by SalesInvoiceNotifyModal. */

export function splitGstHalfAmount(totalGst) {
  const gst = Number(totalGst) || 0;
  const half = Math.round((gst / 2) * 100) / 100;
  return half;
}

/**
 * @param {{ taxable?: number, gst?: number } | Array} totalsOrItems
 * @param {number} [fallbackTotal]
 */
export function gstInvoiceNetTotal(totalsOrItems = {}, fallbackTotal) {
  if (Array.isArray(totalsOrItems)) {
    return totalsOrItems.reduce((sum, item) => {
      const amount = Number(
        item?.net_amount ?? item?.amount ?? item?.total_amount ?? 0,
      );
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  const taxable = Number(totalsOrItems?.taxable) || 0;
  const gst = Number(totalsOrItems?.gst) || 0;
  if (gst <= 0) return Number(fallbackTotal) || taxable || 0;

  const half = splitGstHalfAmount(gst);
  const net = taxable + half * 2;
  return Math.round(net * 100) / 100;
}
