import { apiUrl, parseJsonResponse } from '@/lib/api'
import { AuthService } from '@/lib/auth'
import { withAppBase } from '@/lib/basePath'
import { apiRequest } from '@/lib/queryClient'

export async function fetchStockItemsList(body) {
  const res = await apiRequest('POST', apiUrl('/api/stock-items-list/'), body)
  return parseJsonResponse(res)
}

export async function fetchStockCategories(params = {}) {
  const q = new URLSearchParams()
  if (params.branch_id) q.set('branch_id', String(params.branch_id))
  if (params.stock_group) q.set('stock_group', String(params.stock_group))
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await apiRequest('GET', apiUrl(`/api/get-stock-categories/${suffix}`))
  return parseJsonResponse(res)
}

export async function fetchStockSubCategories(params = {}) {
  const q = new URLSearchParams()
  if (params.branch_id) q.set('branch_id', String(params.branch_id))
  if (params.category_id) q.set('category_id', String(params.category_id))
  if (params.search) q.set('search', String(params.search))
  if (params.is_active != null && params.is_active !== '') {
    q.set('is_active', String(params.is_active))
  }
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await apiRequest('GET', apiUrl(`/api/get-stock-sub-categories/${suffix}`))
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to fetch stock sub categories')
  }
  return result
}

export async function createStockSubCategory(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-stock-sub-category/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to create stock sub category')
  }
  return result
}

export async function createStockGroup(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-stock-group/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to create stock group')
  }
  return result
}

export async function createStockCategory(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-stock-category/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to create stock category')
  }
  return result
}

export async function fetchStockGroups(params = {}) {
  const body = {}
  if (params.branch_id) body.branch_id = params.branch_id
  if (params.is_active != null) body.is_active = params.is_active
  if (params.search) body.search = params.search
  const res = await apiRequest('POST', apiUrl('/api/get-stock-groups/'), body)
  return parseJsonResponse(res)
}

export async function deleteStockGroup(groupId) {
  const res = await apiRequest('DELETE', apiUrl(`/api/delete-stock-group/${groupId}/`))
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to delete stock group')
  }
  return result
}

export async function fetchGodowns(options = {}) {
  let url = apiUrl('/api/get-godowns/')
  const q = new URLSearchParams()
  if (options.isSubGodown !== undefined && options.isSubGodown !== null) {
    q.set('is_sub_godown', options.isSubGodown ? 'true' : 'false')
  }
  if (options.branch_id) q.set('branch_id', String(options.branch_id))
  const qs = q.toString()
  if (qs) url = `${url}?${qs}`
  const res = await apiRequest('GET', url)
  return parseJsonResponse(res)
}

export async function updateStockCategory(payload) {
  const res = await apiRequest('POST', apiUrl('/api/update-stock-category/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to update stock category')
  }
  return result
}

export async function updateStockCategoryImage(categoryId, imageUrl) {
  const res = await apiRequest('POST', apiUrl('/api/update-stock-category-image/'), {
    category_id: categoryId,
    image_url: imageUrl ?? null,
  })
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to update stock category image')
  }
  return result
}

export async function updateStockGroupImage(groupId, imageUrl) {
  const res = await apiRequest('POST', apiUrl('/api/update-stock-group-image/'), {
    group_id: groupId,
    image_url: imageUrl ?? null,
  })
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to update stock group image')
  }
  return result
}

export async function updateStockCategoryGodown(categoryId, godownId) {
  const res = await apiRequest('POST', apiUrl('/api/update-stock-category-godown/'), {
    category_id: categoryId,
    godown_id: godownId ?? null,
  })
  return parseJsonResponse(res)
}

export async function fetchItemWiseGodowns(stockItemId) {
  const res = await apiRequest('POST', apiUrl('/api/item-wise-godowns/'), {
    stock_item_id: stockItemId,
  })
  return parseJsonResponse(res)
}

export async function enableStockItems(itemIds, isActive) {
  const res = await apiRequest('POST', apiUrl('/api/enable-stock/'), {
    item_ids: itemIds,
    is_active: isActive,
  })
  return parseJsonResponse(res)
}

export async function updateStockItemGroupings(items) {
  const res = await apiRequest('POST', apiUrl('/api/update-stock-item-groupings/'), { items })
  return parseJsonResponse(res)
}

export async function fetchItemLotDetails(stockItemId, godownName) {
  const body = { stock_item_id: stockItemId }
  if (godownName) body.godown_name = godownName
  const res = await apiRequest('POST', apiUrl('/api/item-lot-details/'), body)
  return parseJsonResponse(res)
}

export async function releaseStockBatchLock(itemId, batchName) {
  const body = { item_id: itemId }
  if (batchName) body.batch_name = batchName
  const res = await apiRequest('POST', apiUrl('/api/release-stock-batch-lock/'), body)
  return parseJsonResponse(res)
}

export async function updateStockItemDetails(itemId, payload) {
  const res = await apiRequest('POST', apiUrl('/api/update-stock-item-details/'), {
    item_id: itemId,
    ...payload,
  })
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to update stock item details')
  }
  return result
}

export async function createStockItem(payload) {
  const res = await apiRequest('POST', apiUrl('/api/create-stock-item/'), payload)
  return parseJsonResponse(res)
}

export async function fetchUnitMasters() {
  const res = await apiRequest('GET', apiUrl('/api/get-unit-masters/'))
  return parseJsonResponse(res)
}

export async function downloadStockItemListExcel(filters = {}) {
  const res = await apiRequest('POST', apiUrl('/api/download-item-list-excel/'), filters)
  return parseJsonResponse(res)
}

export async function uploadStockItemListExcel(file, branchId) {
  const token = AuthService.getAccessToken()
  if (!token) throw new Error('No authentication token found')
  if (!branchId) throw new Error('Please select a branch to upload Excel.')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('branch_id', String(branchId))

  const res = await fetch(apiUrl('/api/upload-item-list-excel/'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    credentials: 'include',
  })

  if (res.status === 401) {
    AuthService.clearAuthData()
    window.location.href = withAppBase('/login')
    throw new Error('Session expired')
  }

  const result = await res.json().catch(() => ({}))
  if (!res.ok || (result.status && Number(result.status) >= 400)) {
    throw new Error(result.message || 'Failed to upload item list Excel.')
  }
  return result
}
