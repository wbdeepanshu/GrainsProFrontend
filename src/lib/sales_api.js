import { apiRequest } from "@/lib/queryClient";
import { apiUrl, parseJsonResponse } from "@/lib/api";

export { fetchSalesOrderDetail } from "@/lib/dashboard_api";

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** List sales returns — GrainsPRO vouchersApp routes */
export async function fetchSalesReturnOrders(params = {}) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/voucher/sales-return-orders/${buildQuery(params)}`),
  );
  return parseJsonResponse(res);
}

export async function fetchSalesReturnDetail(salesReturnId) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/voucher/sales-return-orders/${salesReturnId}/`),
  );
  const data = await parseJsonResponse(res);
  return data?.data ?? data;
}

export async function createOrUpdateSalesReturn(payload) {
  const res = await apiRequest(
    "POST",
    apiUrl("/api/voucher/sales-return-order/"),
    payload,
  );
  return parseJsonResponse(res);
}

export async function approveRejectSalesReturn(salesReturnId, payload) {
  const res = await apiRequest(
    "PUT",
    apiUrl(`/api/voucher/sales-return-orders/${salesReturnId}/approve-reject/`),
    payload,
  );
  return parseJsonResponse(res);
}

export async function deleteSalesReturn(salesReturnId) {
  const res = await apiRequest(
    "DELETE",
    apiUrl(`/api/voucher/sales-return-orders/${salesReturnId}/delete/`),
  );
  return parseJsonResponse(res);
}

export async function syncSalesReturnToTally({
  salesReturnId,
  forceResync = false,
  markSynced = false,
  tallyXml,
  voucherTypeName,
} = {}) {
  const payload = { sales_return_id: salesReturnId };
  if (forceResync) payload.force_resync = true;
  if (markSynced) payload.mark_synced = true;
  if (tallyXml) payload.tally_xml = tallyXml;
  if (voucherTypeName) payload.voucher_type_name = voucherTypeName;

  try {
    const res = await apiRequest(
      "POST",
      apiUrl("/api/voucher/sync-sales-return-tally/"),
      payload,
    );
    return parseJsonResponse(res);
  } catch (err) {
    const raw = String(err?.message || "");
    const jsonPart = raw.match(/^\d+:\s*(\{[\s\S]*\})$/);
    if (jsonPart) {
      try {
        const parsed = JSON.parse(jsonPart[1]);
        throw new Error(parsed.message || parsed.error || raw);
      } catch (inner) {
        if (inner instanceof Error && !/^\d+:\s*\{/.test(inner.message)) {
          throw inner;
        }
      }
    }
    throw err;
  }
}
