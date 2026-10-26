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

export async function fetchLiveStockBalance(params = {}) {
  const q = new URLSearchParams()
  if (params.branch_id) q.set('branch_id', String(params.branch_id))
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await apiRequest('GET', apiUrl(`/api/get-live-stock-balance/${suffix}`))
  const data = await parseJsonResponse(res)
  return {
    data: data.data || [],
    count: data.count ?? (data.data || []).length,
    message: data.message || 'Stock balance retrieved successfully',
    status: data.status || 200,
    branch_id: data.branch_id ?? null,
    branch_name: data.branch_name ?? null,
  }
}

export async function fetchStockJournals(params = {}) {
  const res = await apiRequest('GET', apiUrl(`/api/get-stock-journals/${buildQuery(params)}`))
  return parseJsonResponse(res)
}

export async function fetchStockJournalDetail(transactionId) {
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/get-stock-journals-detail/${encodeURIComponent(transactionId)}/`),
  )
  const data = await parseJsonResponse(res)
  return data.data ?? null
}

export async function fetchGodowns() {
  const res = await apiRequest('GET', apiUrl('/api/get-godowns/'))
  const data = await parseJsonResponse(res)
  return data.data ?? []
}

export async function fetchStockItemsList(params = {}) {
  // Stock Journal (and similar) can request an active-only list with optional search.
  if (params.minimal) {
    const body = {
      is_active: params.is_active !== undefined ? params.is_active : true,
      new_page: params.page || params.new_page || 1,
      per_page: params.per_page || 50,
    }
    const search = String(params.search || '').trim()
    if (search) body.search = search

    const res = await apiRequest('POST', apiUrl('/api/stock-items-list/'), body)
    const data = await parseJsonResponse(res)
    if (data.status && Number(data.status) >= 400) {
      throw new Error(data.message || data.error || 'Failed to load stock items')
    }
    return {
      items: Array.isArray(data.data) ? data.data : [],
      pagination: data.pagination ?? {},
    }
  }

  const body = {
    list_mode: params.list_mode || 'default',
    stock_group: params.stock_group || '',
    stock_category: params.stock_category || '',
    is_active: params.is_active !== undefined ? params.is_active : true,
    new_page: params.page || params.new_page || 1,
    per_page: params.per_page || 50,
  }
  const godownName = String(params.godown_name || params.godown || '').trim()
  if (godownName && !params.omit_godown) {
    body.godown_name = godownName
    body.godown = godownName
  }
  if (params.type) body.type = params.type
  const search = String(params.search || '').trim()
  if (search) body.search = search
  if (params.in_stock === true) body.in_stock = true
  if (params.in_stock === false) body.in_stock = false
  if (params.voucher_type) body.voucher_type = params.voucher_type

  const res = await apiRequest('POST', apiUrl('/api/stock-items-list/'), body)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || data.error || 'Failed to load stock items')
  }
  return {
    items: Array.isArray(data.data) ? data.data : [],
    pagination: data.pagination ?? {},
  }
}

export async function fetchItemLotDetails(params = {}) {
  const body = {}
  if (params.stock_item_id || params.stockItemId) {
    body.stock_item_id = params.stock_item_id || params.stockItemId
  }
  if (params.item_name || params.itemName) {
    body.item_name = params.item_name || params.itemName
  }
  if (params.godown_name || params.godownName) {
    body.godown_name = params.godown_name || params.godownName
  }
  const res = await apiRequest('POST', apiUrl('/api/item-lot-details/'), body)
  const data = await parseJsonResponse(res)
  if (data.error) throw new Error(data.error)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || data.error || 'Failed to load batch details')
  }
  return data
}

export async function createDirectStockJournal(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-direct-stock-journal/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || data.error || 'Failed to create stock journal')
  }
  return data
}

export async function updateDirectStockJournal(payload) {
  const res = await apiRequest('POST', apiUrl('/api/update-direct-stock-journal/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || data.error || 'Failed to update stock journal')
  }
  return data
}

export async function fetchStockItemPoAveragePrices(params = {}) {
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/stock-item-po-average-prices/${buildQuery(params)}`),
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || data.error || 'Failed to load purchase-order average prices')
  }
  return {
    type: data.type || params.type || 'standard_weight',
    data: Array.isArray(data.data) ? data.data : [],
    pagination: data.pagination ?? {},
    message: data.message || 'Stock item purchase-order average prices retrieved successfully',
  }
}

export async function fetchAllStockItemPoAveragePrices(params = {}) {
  const byItemId = {}
  try {
    let page = 1
    const pageSize = Number(params.page_size) > 0 ? Number(params.page_size) : 500
    for (let i = 0; i < 40; i += 1) {
      const result = await fetchStockItemPoAveragePrices({
        ...params,
        page,
        page_size: pageSize,
      })
      ;(result.data || []).forEach((row) => {
        if (row?.item_id == null) return
        byItemId[String(row.item_id)] = row
      })
      if (!result.pagination?.has_next) break
      page += 1
    }
  } catch {
    // PO average endpoint may be absent in Murli — Item Price Margin still works.
  }
  return byItemId
}

export async function syncStockJournalToTally(transactionId) {
  const res = await apiRequest('POST', apiUrl('/api/sync-stock-journal-to-tally/'), {
    transaction_id: transactionId,
  })
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || data.error || 'Failed to sync stock journal to Tally')
  }
  return data
}
