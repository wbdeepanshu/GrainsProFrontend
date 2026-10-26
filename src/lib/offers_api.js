import { apiUrl, parseJsonResponse } from '@/lib/api'
import { apiRequest } from '@/lib/queryClient'

function buildQuery(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    q.set(key, String(value))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function fetchSalesOffers(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/sales-offers/')}${buildQuery({
      page: 1,
      per_page: 200,
      ...params,
    })}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch offers')
  }
  return data
}

export async function createSalesOffer(payload) {
  const res = await apiRequest('POST', apiUrl('/api/sales-offers/create/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to create offer')
  }
  return data
}

export async function updateSalesOffer(payload) {
  const res = await apiRequest('POST', apiUrl('/api/sales-offers/update/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to update offer')
  }
  return data
}

export async function saveSalesOffer(payload) {
  if (payload?.id) {
    return updateSalesOffer(payload)
  }
  return createSalesOffer(payload)
}

export async function deleteSalesOffer(offerId) {
  const res = await apiRequest('POST', apiUrl('/api/sales-offers/delete/'), { id: offerId })
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to delete offer')
  }
  return data
}

export async function fetchSalesOfferLogs(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/sales-offer-logs/')}${buildQuery({
      page: 1,
      page_size: 15,
      ...params,
    })}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch offer logs')
  }
  return data.data ?? { logs: [], pagination: {} }
}

/** Eligible offers for a sales order value + customer (discounts + gifts). */
export async function fetchEligibleSalesOffers(orderValue, params = {}) {
  const {
    customer_id,
    customerId,
    business_type_id,
    businessTypeId,
    category_type_id,
    categoryTypeId,
    credit_type_id,
    creditTypeId,
    items,
    order_items,
    ...rest
  } = params || {}
  const payload = {
    order_value: Number(orderValue) || 0,
    customer_id: customer_id || customerId || undefined,
    business_type_id: business_type_id || businessTypeId || undefined,
    category_type_id: category_type_id || categoryTypeId || undefined,
    credit_type_id: credit_type_id || creditTypeId || undefined,
    // Always send items (even []) so item-quantity free offers can be evaluated.
    items: Array.isArray(items)
      ? items
      : Array.isArray(order_items)
        ? order_items
        : [],
    ...rest,
  }
  // Prefer POST so order line items can be sent for item-quantity free offers.
  const res = await apiRequest('POST', apiUrl('/api/sales-offers/eligible/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch eligible offers')
  }
  return {
    order_value: data.order_value ?? 0,
    ...(data.data || {
      discounts: [],
      gifts: [],
      item_quantity_gifts: [],
      wallet_points: [],
      best_discount_amount: 0,
      has_eligible: false,
    }),
  }
}
