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

/** Staff retailers APIs are mounted at /api/retailer/ in GrainsPro_Murli. */
const RETAILER_API = '/api/retailer'

export async function fetchRetailersInfo(params = {}) {
  const res = await apiRequest('GET', apiUrl(`${RETAILER_API}/list/${buildQuery(params)}`))
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load retailers')
  }
  return {
    data: data.data ?? [],
    pagination: data.pagination ?? {
      current_page: 1,
      total_count: 0,
      total_pages: 1,
      has_next: false,
      has_previous: false,
      per_page: params.per_page ?? 50,
    },
    status: data.status,
    message: data.message,
  }
}

export async function fetchRetailerInfoDetail(retailerId) {
  const res = await apiRequest(
    'GET',
    apiUrl(`${RETAILER_API}/detail/${buildQuery({ retailer_id: retailerId })}`),
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load retailer details')
  }
  return data.data ?? null
}

export async function removeRetailerAccess(retailerId) {
  const res = await apiRequest('POST', apiUrl(`${RETAILER_API}/remove-access/`), {
    retailer_id: retailerId,
  })
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to remove mobile app access')
  }
  return data
}

export async function registerRetailerFromParty({
  partyId,
  organizationId,
  points = 0,
  pointsType = 'wallet',
} = {}) {
  const payload = { party_id: partyId }
  if (organizationId != null && organizationId !== '') {
    payload.organization_id = String(organizationId).trim()
  }
  const pointsValue = Number(points)
  if (Number.isFinite(pointsValue) && pointsValue > 0) {
    payload.points = pointsValue
    payload.points_type = pointsType || 'wallet'
  }
  const res = await apiRequest('POST', apiUrl(`${RETAILER_API}/register-party/`), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to allow mobile app access')
  }
  return data
}

export async function removeRetailerAccessFromParty(partyId, organizationId) {
  const payload = { party_id: partyId }
  if (organizationId != null && organizationId !== '') {
    payload.organization_id = String(organizationId).trim()
  }
  const res = await apiRequest('POST', apiUrl(`${RETAILER_API}/remove-party-access/`), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to remove mobile app access')
  }
  return data
}
