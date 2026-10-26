import { apiUrl, parseJsonResponse } from '@/lib/api'
import { apiRequest } from '@/lib/queryClient'
import { AuthService } from '@/lib/auth'

function buildQuery(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, String(value))
    }
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'registration', label: 'Registration Document' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'identity_proof', label: 'Identity Proof' },
  { value: 'income_proof', label: 'Income Proof' },
]

export async function fetchKycDocumentTypes(params = {}) {
  const res = await apiRequest('GET', apiUrl(`/api/kyc-document-types/${buildQuery(params)}`))
  return parseJsonResponse(res)
}

export async function saveKycDocumentType(payload) {
  const res = await apiRequest('POST', apiUrl('/api/kyc-document-types/create/'), payload)
  return parseJsonResponse(res)
}

export async function deleteKycDocumentType(id) {
  const res = await apiRequest('POST', apiUrl(`/api/kyc-document-types/delete/${id}/`))
  return parseJsonResponse(res)
}

export async function fetchPartyDetail(partyId) {
  const res = await apiRequest('GET', apiUrl(`/api/get-ledgers/${partyId}/`))
  return parseJsonResponse(res)
}

export async function fetchPartyEntriesList(params = {}) {
  const res = await apiRequest('GET', apiUrl(`/api/get-ledgers/${buildQuery(params)}`))
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.error || data.message || 'Failed to load ledgers')
  }
  return data
}

export async function createOrUpdateCustomer(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-customer/'), payload)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      data?.update_status ||
      (data && typeof data === 'object'
        ? Object.entries(data)
            .map(([key, value]) => {
              if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
              if (value && typeof value === 'object') return `${key}: ${JSON.stringify(value)}`
              return `${key}: ${value}`
            })
            .join('; ')
        : `Request failed (${res.status})`)
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return data
}

export async function fetchCommonListings(names, filters = {}) {
  const res = await apiRequest('POST', apiUrl('/api/growth/get-list/'), { names, filters })
  return parseJsonResponse(res)
}

export async function fetchBusinessTypes(params = {}) {
  const res = await apiRequest('GET', apiUrl(`/api/accounts/business-types/${buildQuery(params)}`))
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load business types')
  }
  return data.data ?? []
}

export async function fetchCreditTypes(params = {}) {
  const res = await apiRequest('GET', apiUrl(`/api/accounts/credit-types/${buildQuery(params)}`))
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load credit types')
  }
  return data.data ?? []
}

/** Normalize API eligibility flags (boolean / 0-1 / "true"|"false"). Missing → eligible. */
function normalizeCreditEligibility(value) {
  if (value === false || value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'false' || normalized === 'no' || normalized === 'n') return false
    if (normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1') {
      return true
    }
  }
  if (value === true || value === 1) return true
  // Field omitted / null / unknown → treat as eligible (same as prior !== false).
  return value !== false
}

/** Full credit-types response (includes credit_limit/days/bills/eligibility when customer_id is passed). */
export async function fetchCreditTypesResponse(params = {}) {
  const res = await apiRequest('GET', apiUrl(`/api/accounts/credit-types/${buildQuery(params)}`))
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load credit types')
  }
  // Prefer top-level ledger fields from get_credit_types (tblPartyCreditDetails).
  // Do not fall back to CreditTypes master credit_days_from / credit_days_to.
  const firstRow = Array.isArray(data.data) && data.data.length ? data.data[0] : null
  const ledgerDays =
    data.credit_days != null && data.credit_days !== ''
      ? data.credit_days
      : firstRow?.credit_days != null && firstRow.credit_days !== ''
        ? firstRow.credit_days
        : 0
  const configuredAmount =
    data.credit_limit_amount != null && data.credit_limit_amount !== ''
      ? data.credit_limit_amount
      : firstRow?.credit_amount != null && firstRow.credit_amount !== ''
        ? firstRow.credit_amount
        : ''
  return {
    data: data.data ?? [],
    credit_limit: data.credit_limit ?? '',
    // Configured ledger amount (tblPartyCreditDetails), not remaining available.
    credit_limit_amount: configuredAmount,
    credit_days: ledgerDays,
    credit_bills_count: data.credit_bills_count ?? data.credit_bills ?? 0,
    credit_bills: data.credit_bills ?? data.credit_bills_count ?? 0,
    is_eligible: normalizeCreditEligibility(data.is_eligible),
    eligibility_message: data.eligibility_message || '',
    eligibility_reasons: Array.isArray(data.eligibility_reasons) ? data.eligibility_reasons : [],
    used_credit_amount: data.used_credit_amount ?? 0,
    outstanding_bills_count: data.outstanding_bills_count ?? 0,
    has_overdue_bills: Boolean(data.has_overdue_bills),
    mapped_only: Boolean(data.mapped_only),
    pagination: data.pagination ?? null,
  }
}

export async function fetchPartyCreditTypeMapping(partyId) {
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/party-credit-type-mapping/${buildQuery({ party_id: partyId })}`),
  )
  const data = await parseJsonResponse(res)
  return data.data ?? null
}

export async function createOrUpdatePartyCreditTypeMapping(payload) {
  const res = await apiRequest(
    'POST',
    apiUrl('/api/create-update-party-credit-type-mapping/'),
    payload,
  )
  return parseJsonResponse(res)
}

/** Paginated audit logs for ledger credit-type / credit-limit mapping changes. */
export async function fetchPartyCreditTypeMappingLogs({
  page = 1,
  page_size = 20,
  search,
  action,
  party_id,
} = {}) {
  const params = {
    page,
    page_size,
  }
  if (search) params.search = search
  if (action) params.action = action
  if (party_id != null && party_id !== '') params.party_id = party_id

  const res = await apiRequest(
    'GET',
    apiUrl(`/api/party-credit-type-mapping-logs/${buildQuery(params)}`),
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to load credit type mapping logs')
  }
  return data.data ?? { logs: [], pagination: {} }
}

export async function uploadCustomerKycFile(file) {
  const token = AuthService.getAccessToken()
  if (!token) throw new Error('No authentication token found')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', 'customer_kyc')

  const res = await fetch(apiUrl('/api/upload-media-file/'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status !== 200) {
    throw new Error(data.message || 'Failed to upload file')
  }
  return data.data?.url
}
