/** Accounts / growth listing helpers used by margin settings and related pages. */

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

export async function fetchBusinessTypes(params = {}) {
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/accounts/business-types/${buildQuery({ page_size: 500, ...params })}`),
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load business types')
  }
  return data.data ?? []
}

export async function fetchCreditTypes(params = {}) {
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/accounts/credit-types/${buildQuery({ page_size: 500, ...params })}`),
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load credit types')
  }
  return data.data ?? []
}

export async function fetchCommonListings(names, filters = {}) {
  const res = await apiRequest('POST', apiUrl('/api/growth/get-list/'), { names, filters })
  return parseJsonResponse(res)
}
