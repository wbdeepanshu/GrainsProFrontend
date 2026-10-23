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

export async function fetchSoQuotations(params = {}) {
  const response = await apiRequest(
    'GET',
    apiUrl(`/api/sales/so-quotations/${buildQuery(params)}`),
  )
  const result = await parseJsonResponse(response)
  return { data: result.data || [], pagination: result.pagination || {} }
}

export async function fetchSoQuotationDetail(id) {
  const response = await apiRequest(
    'GET',
    apiUrl(`/api/sales/so-quotations/${encodeURIComponent(id)}/`),
  )
  const result = await parseJsonResponse(response)
  return result.data
}

export async function saveSoQuotation(payload) {
  const response = await apiRequest(
    'POST',
    apiUrl('/api/sales/so-quotations/create/'),
    payload,
  )
  return parseJsonResponse(response)
}

export async function deleteSoQuotation(id) {
  const response = await apiRequest(
    'DELETE',
    apiUrl(`/api/sales/so-quotations/delete/${encodeURIComponent(id)}/`),
  )
  return parseJsonResponse(response)
}

export async function fetchQuotationStockItems({ search = '', page = 1, perPage = 100, branchId } = {}) {
  const response = await apiRequest('POST', apiUrl('/api/growth/so-items-list/'), {
    search: search.trim(),
    page,
    per_page: perPage,
    branch_id: branchId || undefined,
  })
  return parseJsonResponse(response)
}

async function fetchAccountTypes(endpoint) {
  const response = await apiRequest(
    'GET',
    apiUrl(`/api/accounts/${endpoint}/?page=1&page_size=500`),
  )
  const result = await parseJsonResponse(response)
  return result.data || []
}

export const fetchQuotationBusinessTypes = () => fetchAccountTypes('business-types')
export const fetchQuotationCreditTypes = () => fetchAccountTypes('credit-types')
