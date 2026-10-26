import { apiUrl, parseJsonResponse } from '@/lib/api'
import { AuthService } from '@/lib/auth'
import { apiRequest } from '@/lib/queryClient'
import { fetchBranches } from '@/lib/users_api'
import { fetchCommonListings } from '@/lib/accounts_api'

function withAppBase(path) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}` || normalized
}

function buildQuery(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    q.set(key, String(value))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

async function parseListResponse(res) {
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Request failed')
  }
  return data.data ?? []
}

export async function fetchMarginStates(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/states/')}${buildQuery({ page: 1, page_size: 500, ...params })}`,
  )
  return parseListResponse(res)
}

export async function saveMarginState(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-state/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save state')
  }
  return data
}

export async function fetchMarginDistricts(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/districts/')}${buildQuery({ page: 1, page_size: 500, ...params })}`,
  )
  return parseListResponse(res)
}

export async function saveMarginDistrict(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-district/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save district')
  }
  return data
}

export async function fetchMarginCities(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/cities/')}${buildQuery({ page: 1, page_size: 500, ...params })}`,
  )
  return parseListResponse(res)
}

export async function saveMarginCity(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-city/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save city')
  }
  return data
}

export async function fetchMarginPincodes(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/pincodes/')}${buildQuery({ page: 1, page_size: 500, ...params })}`,
  )
  return parseListResponse(res)
}

export async function saveMarginPincode(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-pincode/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save pincode')
  }
  return data
}

export async function fetchPriceMarginRules(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/price-margin-rules/')}${buildQuery({ page: 1, page_size: 500, ...params })}`,
  )
  return parseListResponse(res)
}

export async function savePriceMarginRule(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-price-margin-rule/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save price rule')
  }
  return data
}

export async function fetchStockItemPricing(params = {}) {
  const res = await apiRequest('POST', apiUrl('/api/growth/so-items-list/'), {
    page: 1,
    per_page: 50,
    ...params,
  })
  const body = await parseJsonResponse(res)
  if (body.status && Number(body.status) >= 400) {
    throw new Error(body.message || 'Failed to load stock item pricing')
  }

  const payload = body.data
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.stock_items)
      ? payload.stock_items
      : []

  return {
    items,
    summary: (payload && !Array.isArray(payload) ? payload.summary : null) ?? body.summary ?? null,
    pagination: body.pagination ?? {},
  }
}

export async function uploadStockItemBasePricesExcel(formData) {
  const res = await apiRequest('POST', apiUrl('/api/upload-excel-base-prices/'), formData, {
    isFormData: true,
  })
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to upload base prices')
  }
  return data
}

export async function fetchPricingCustomers(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/get-ledgers/')}${buildQuery({ page: 1, per_page: 50, ...params })}`,
  )
  const data = await parseJsonResponse(res)
  return data.data ?? []
}

export async function fetchPricingBranches() {
  return fetchBranches()
}

export async function fetchPriceRuleLookups() {
  const parseData = async (res) => {
    const body = await parseJsonResponse(res)
    return body.data ?? []
  }

  const [
    states,
    districts,
    cities,
    pincodes,
    businessTypes,
    creditTypes,
    branches,
    stockGroups,
    stockItems,
    customers,
  ] = await Promise.all([
    fetchMarginStates(),
    fetchMarginDistricts(),
    fetchMarginCities(),
    fetchMarginPincodes(),
    apiRequest('GET', `${apiUrl('/api/accounts/business-types/')}${buildQuery({ page: 1, page_size: 500 })}`).then(parseData),
    apiRequest('GET', `${apiUrl('/api/accounts/credit-types/')}${buildQuery({ page: 1, page_size: 500 })}`).then(parseData),
    fetchBranches(),
    apiRequest('POST', apiUrl('/api/get-stock-groups/'), {}).then(parseData),
    apiRequest('POST', apiUrl('/api/stock-items-list/'), { page: 1, per_page: 500 }).then(parseData),
    fetchPricingCustomers({ per_page: 200 }),
  ])

  return {
    states,
    districts,
    cities,
    pincodes,
    businessTypes,
    creditTypes,
    branches,
    stockGroups,
    stockItems,
    customers,
  }
}

/** Sync State / District / City / Pincode masters from org party ledgers. */
export async function autofillGeoFromParties() {
  const res = await apiRequest('POST', apiUrl('/api/autofill-geo-from-parties/'), {})
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch geo data from parties')
  }
  return data
}

export { fetchCommonListings }

export async function fetchCustomerPriceMargins(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/customer-price-margins/')}${buildQuery(params)}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch customer price margins')
  }
  return data.data ?? {}
}

export async function saveCustomerPriceMargins(payload) {
  const res = await apiRequest('POST', apiUrl('/api/save-customer-price-margins/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save customer price margins')
  }
  return data
}

export async function fetchFreightMargins(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/freight-margins/')}${buildQuery(params)}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch freight margins')
  }
  return data.data ?? {}
}

export async function saveFreightMargins(payload) {
  const res = await apiRequest('POST', apiUrl('/api/save-freight-margins/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save freight margins')
  }
  return data
}

async function downloadMarginExcelTemplate(path, filename) {
  const token = AuthService.getAccessToken()
  if (!token) throw new Error('No authentication token found')

  const res = await fetch(apiUrl(path), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })

  if (res.status === 401) {
    AuthService.clearAuthData()
    window.location.href = withAppBase('/login')
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Download failed (${res.status})`)
  }

  const rowCountRaw = res.headers.get('X-Template-Row-Count')
  const rowCount = rowCountRaw != null && rowCountRaw !== '' ? Number(rowCountRaw) : null
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)

  return { rowCount, downloaded: blob.size > 0 }
}

async function uploadMarginExcel(path, file) {
  const token = AuthService.getAccessToken()
  if (!token) throw new Error('No authentication token found')

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    credentials: 'include',
  })

  if (res.status === 401) {
    AuthService.clearAuthData()
    window.location.href = withAppBase('/login')
    throw new Error('Session expired')
  }

  const data = await res.json()
  if (!res.ok || (data.status && Number(data.status) >= 400)) {
    throw new Error(data.message || 'Failed to upload Excel file')
  }
  return data
}

export async function downloadCustomerPriceMarginTemplate() {
  return downloadMarginExcelTemplate(
    '/api/download-customer-price-margin-template/',
    'customer_price_margin_template.xlsx',
  )
}

export async function uploadCustomerPriceMarginExcel(file) {
  return uploadMarginExcel('/api/upload-customer-price-margin-excel/', file)
}

export async function downloadFreightMarginTemplate() {
  return downloadMarginExcelTemplate(
    '/api/download-freight-margin-template/',
    'freight_margin_template.xlsx',
  )
}

export async function uploadFreightMarginExcel(file) {
  return uploadMarginExcel('/api/upload-freight-margin-excel/', file)
}

export async function fetchMarginChangeLogs(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/margin-change-logs/')}${buildQuery(params)}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch margin change logs')
  }
  return data.data ?? { logs: [], pagination: {} }
}

/** Item × business type × category type price variation matrix (0% defaults). */
export async function fetchItemPriceMarginMatrix(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/stock-item-price-variations/')}${buildQuery({
      matrix: true,
      page: 1,
      per_page: 50,
      ...params,
    })}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch item price margins')
  }
  return data
}

export async function saveItemPriceMargins(payload) {
  const res = await apiRequest('POST', apiUrl('/api/stock-item-price-variations/create/'), payload)
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save item price margins')
  }
  return data
}

/** Save only changed items in one API call (faster than per-item sequential saves). */
export async function saveItemPriceMarginsBulk(items = []) {
  if (!items.length) {
    return { created_count: 0, updated_count: 0 }
  }
  if (items.length === 1) {
    return saveItemPriceMargins(items[0])
  }
  const res = await apiRequest('POST', apiUrl('/api/stock-item-price-variations/create/'), { items })
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save item price margins')
  }
  return data
}

export async function fetchItemPriceMarginLogs(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/stock-item-price-margin-logs/')}${buildQuery({
      page: 1,
      page_size: 15,
      ...params,
    })}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch item price margin logs')
  }
  return data.data ?? { logs: [], pagination: {} }
}

/** Item × credit type margin matrix (0% defaults). Landing from item settings. */
export async function fetchItemCreditTypeMarginMatrix(params = {}) {
  const res = await apiRequest(
    'GET',
    `${apiUrl('/api/stock-item-credit-type-margins/')}${buildQuery({
      matrix: true,
      page: 1,
      per_page: 50,
      ...params,
    })}`,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to fetch credit type margins')
  }
  return data
}

export async function saveItemCreditTypeMargins(payload) {
  const res = await apiRequest(
    'POST',
    apiUrl('/api/stock-item-credit-type-margins/create/'),
    payload,
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save credit type margins')
  }
  return data
}

export async function saveItemCreditTypeMarginsBulk(items = []) {
  if (!items.length) {
    return { created_count: 0, updated_count: 0 }
  }
  if (items.length === 1) {
    return saveItemCreditTypeMargins(items[0])
  }
  const res = await apiRequest(
    'POST',
    apiUrl('/api/stock-item-credit-type-margins/create/'),
    { items },
  )
  const data = await parseJsonResponse(res)
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || 'Failed to save credit type margins')
  }
  return data
}
