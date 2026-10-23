import { apiUrl, parseJsonResponse } from '@/lib/api'
import { apiRequest } from '@/lib/queryClient'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

export async function fetchStockSummary(params = {}) {
  const response = await apiRequest(
    'GET',
    apiUrl(`/api/report/current-stock-summary/${buildQuery(params)}`),
  )
  return parseJsonResponse(response)
}

export async function fetchStockSummaryItemVouchers(params = {}) {
  const response = await apiRequest(
    'GET',
    apiUrl(`/api/report/stock-summary-item-vouchers/${buildQuery(params)}`),
  )
  return parseJsonResponse(response)
}

export async function fetchStockSummaryBranches() {
  const response = await apiRequest('GET', apiUrl('/api/get-branches/'))
  const result = await parseJsonResponse(response)
  return result.data || []
}

export async function fetchStockSummaryCategories() {
  const response = await apiRequest('GET', apiUrl('/api/get-stock-categories/'))
  const result = await parseJsonResponse(response)
  return result.data || []
}
