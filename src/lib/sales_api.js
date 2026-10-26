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

/** SO / Price Master priced stock list (Murli: growth so-items-list). */
export async function fetchMarginStockItems({
  customerId,
  branchId,
  search = '',
  page = 1,
  perPage = 50,
  stockItemId,
  businessTypeId,
  categoryTypeId,
  creditTypeId,
  deliveryType,
  excludeAdditionalCharges = false,
  includeZeroSellingStock = false,
  stockGroupIds,
  stockGroupName,
  stockCategoryIds,
}) {
  const hasTypePricing = Boolean(businessTypeId || creditTypeId)
  if (!customerId && !hasTypePricing) {
    return {
      status: 200,
      data: { stock_items: [] },
      pagination: { has_next: false, current_page: 1 },
    }
  }
  const groupIds = Array.isArray(stockGroupIds)
    ? stockGroupIds.filter((id) => id != null && String(id).trim() !== '')
    : stockGroupIds != null && String(stockGroupIds).trim() !== ''
      ? [stockGroupIds]
      : []
  const categoryIds = Array.isArray(stockCategoryIds)
    ? stockCategoryIds.filter((id) => id != null && String(id).trim() !== '')
    : stockCategoryIds != null && String(stockCategoryIds).trim() !== ''
      ? [stockCategoryIds]
      : []
  const groupName = String(stockGroupName || '').trim()
  const selfDelivery =
    String(deliveryType || '').trim().toLowerCase() === 'self' ||
    Boolean(excludeAdditionalCharges)
  const res = await apiRequest('POST', apiUrl('/api/growth/so-items-list/'), {
    ...(customerId ? { customer_id: customerId } : {}),
    branch_id: branchId || undefined,
    search: search.trim(),
    page,
    per_page: perPage,
    ...(stockItemId ? { stock_item_id: stockItemId } : {}),
    ...(businessTypeId ? { business_type_id: businessTypeId } : {}),
    ...(categoryTypeId ? { category_type_id: categoryTypeId } : {}),
    ...(creditTypeId ? { credit_type_id: creditTypeId } : {}),
    ...(selfDelivery ? { delivery_type: 'self' } : {}),
    ...(includeZeroSellingStock ? { include_zero_selling_stock: true } : {}),
    ...(groupIds.length === 1
      ? { stock_group_id: groupIds[0] }
      : groupIds.length > 1
        ? { stock_group_ids: groupIds }
        : {}),
    ...(groupName ? { stock_group: groupName } : {}),
    ...(categoryIds.length === 1
      ? { category_id: categoryIds[0] }
      : categoryIds.length > 1
        ? { category_ids: categoryIds }
        : {}),
  })
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load stock items')
  }
  return data
}

export async function fetchSoItemPricing({
  customerId,
  stockItemId,
  branchId,
  search = '',
  businessTypeId,
  categoryTypeId,
  creditTypeId,
  deliveryType,
  excludeAdditionalCharges = false,
}) {
  const hasTypePricing = Boolean(businessTypeId || creditTypeId)
  if ((!customerId && !hasTypePricing) || !stockItemId) return null
  const byId = await fetchMarginStockItems({
    customerId,
    branchId,
    stockItemId,
    page: 1,
    perPage: 10,
    businessTypeId,
    categoryTypeId,
    creditTypeId,
    deliveryType,
    excludeAdditionalCharges,
  })
  const items = byId?.data?.stock_items || byId?.data || []
  const list = Array.isArray(items) ? items : []
  return list.find((row) => String(row.id) === String(stockItemId)) || list[0] || null
}

export async function fetchCustomerLastSalesOrder(customerId) {
  if (!customerId) return null
  try {
    const res = await apiRequest(
      'GET',
      apiUrl(`/api/sales/customer-last-sales-order/?customer_id=${encodeURIComponent(customerId)}`),
    )
    const data = await parseJsonResponse(res)
    return data?.data ?? null
  } catch {
    return null
  }
}

export async function searchSalesCustomers(search = '', page = 1) {
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/get-ledgers/?search=${encodeURIComponent(search || '')}&page=${page}&per_page=20&is_active=true`),
  )
  const data = await parseJsonResponse(res)
  return data?.data ?? []
}
