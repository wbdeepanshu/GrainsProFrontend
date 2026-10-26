import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Loader2,
  Minus,
  Plus,
  Search,
  Tag,
  Users,
  X,
} from 'lucide-react'
import ImagePreviewModal from '@/components/common/ImagePreviewModal'
import Loader from '@/components/common/loader'
import Pagination from '@/components/common/Pagination'
import SearchSelectDropdown from '@/components/common/SearchSelectDropdown'
import PageHeader from '@/components/layout/PageHeader'
import {
  fetchBusinessTypes,
  fetchCommonListings,
  fetchCreditTypesResponse,
} from '@/lib/customer_api'
import { fetchStockCategories, fetchStockGroups } from '@/lib/item_masters_api'
import { storePriceMasterConvertPayload } from '@/lib/price_master_convert'
import {
  fetchCustomerLastSalesOrder,
  fetchMarginStockItems,
  fetchSoItemPricing,
  searchSalesCustomers,
} from '@/lib/sales_api'
import { useDebounce } from '@/hooks/useDebounce'
import { usePermissions } from '@/hooks/usePermissions'
import { useSuccessPopup } from '@/hooks/useSuccessPopup'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { generatePriceMasterExcel, generatePriceMasterPdf, PRICE_MASTER_EXPORT_COLUMNS } from '@/utils/priceMasterExport'

const PAGE_SIZE = 50
const QUANTITY_MAX_DIGITS = 5

/** Same values as Create Sales Order — API uses delivery_type=self for Customer Pickup. */
const DELIVERY_TYPES = {
  REGULAR: 'regular',
  CUSTOMER_PICKUP: 'customer_pickup',
}

const DELIVERY_TYPE_OPTIONS = [
  { value: DELIVERY_TYPES.REGULAR, label: 'Company Delivery' },
  { value: DELIVERY_TYPES.CUSTOMER_PICKUP, label: 'Customer Pickup' },
]

/** Item images arrive as URL strings or {image|url} objects; show first non-empty only. */
function getPrimaryItemImage(item) {
  const raw = Array.isArray(item?.images)
    ? item.images
    : Array.isArray(item?.stock_item?.images)
      ? item.stock_item.images
      : item?.primary_image
        ? [item.primary_image]
        : []
  for (const entry of raw) {
    const url =
      typeof entry === 'string'
        ? entry.trim()
        : String(entry?.image || entry?.url || '').trim()
    if (url) return url
  }
  return ''
}

const inputClass =
  'w-full h-8 pl-8 pr-2.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const PRICE_TH_COMPACT =
  'px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap bg-slate-50 border-b border-slate-200 sticky top-0 z-10'
const PRICE_TD_COMPACT = 'px-2 py-1.5 text-xs align-middle'

function formatPriceListMoney(value, { wholeNumber = false } = {}) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  if (wholeNumber) {
    return `₹${Math.round(n).toLocaleString('en-IN')}`
  }
  const rounded = roundPriceOneDecimal(n)
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`
}

function formatQty(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function formatPriceWithUnit(value, unitName, { wholeNumber = false } = {}) {
  if (value == null || !Number.isFinite(parseFloat(value))) return '—'
  const unit = String(unitName || '').trim()
  const money = formatPriceListMoney(value, { wholeNumber })
  return unit ? `${money} / ${unit}` : money
}

function priceListItemMatchesSearch(item, search) {
  const tokens = String(search || '')
    .trim()
    .toLowerCase()
    .match(/[a-z0-9]+/g)
  if (!tokens?.length) return true
  const haystack = [
    item?.name,
    item?.reserved_name,
    item?.alias_name,
    item?.stock_item?.name,
    item?.stock_item?.reserved_name,
    item?.stock_item?.alias_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, '')
  return tokens.every((token) => haystack.includes(token))
}

function roundPriceOneDecimal(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  const hundredths = Math.round(abs * 100)
  const tenths = Math.floor(hundredths / 10)
  const secondDigit = hundredths % 10
  const roundedTenths = secondDigit > 0 ? tenths + 1 : tenths
  return sign * (roundedTenths / 10)
}

function ceilBaseUnitPrice(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return 0
  if (n >= 0) return Math.ceil(n - Number.EPSILON)
  return -Math.floor(Math.abs(n) - Number.EPSILON)
}

function getPriceListRowPrices(stockItem) {
  if (!stockItem) {
    return {
      unitPrice: null,
      unitName: '',
      basePrice: null,
      baseName: '',
      altPrice: null,
      altName: '',
      maxRate: null,
      hasAlternate: false,
    }
  }
  const baseUnit = stockItem.base_unit || stockItem.stock_item?.base_unit
  const alternateUnit = stockItem.alternate_unit || stockItem.stock_item?.alternate_unit
  const minimumUnit = stockItem.minimum_unit || stockItem.stock_item?.minimum_unit
  const unitPrice = parseFloat(stockItem.unit_price ?? stockItem.stock_item?.unit_price)
  const rawBase = parseFloat(baseUnit?.price ?? stockItem.base_price)
  const basePrice = Number.isFinite(rawBase) ? ceilBaseUnitPrice(rawBase) : null
  const altPrice = parseFloat(alternateUnit?.price)
  const maxRate = parseFloat(stockItem.max_rate ?? stockItem.stock_item?.max_rate)
  const baseName = (baseUnit?.name || 'base').trim() || 'base'
  const minName = String(minimumUnit?.name || '').trim()
  const minId = minimumUnit?.id
  const baseId = baseUnit?.id
  // Same as base (or no separate minimum unit) → show base unit name, never literal "unit".
  const sameAsBase =
    !minName ||
    (baseId != null && minId != null && String(baseId) === String(minId)) ||
    minName.toLowerCase() === baseName.toLowerCase()
  return {
    unitPrice: Number.isFinite(unitPrice) ? roundPriceOneDecimal(unitPrice) : null,
    unitName: sameAsBase ? baseName : minName,
    basePrice,
    baseName,
    altPrice: Number.isFinite(altPrice) ? roundPriceOneDecimal(altPrice) : null,
    altName: (alternateUnit?.name || 'alt').trim() || 'alt',
    maxRate: Number.isFinite(maxRate) && maxRate > 0 ? roundPriceOneDecimal(maxRate) : null,
    hasAlternate: Boolean(alternateUnit?.id || alternateUnit?.name),
  }
}

function getClosingBalance(item) {
  const raw =
    item?.closing_balance ??
    item?.total_closing_balance ??
    item?.total_selling_stock ??
    item?.stock_item?.closing_balance ??
    item?.stock_item?.total_closing_balance
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function getMaxQty(item) {
  const raw =
    item?.max_quantity ??
    item?.max_qty ??
    item?.rule_max_qty ??
    item?.stock_item?.max_quantity
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function resolveCustomerBusinessTypeId(customer, businessTypeOptions = []) {
  if (!customer) return ''
  const directId =
    customer.customer_type_id ??
    customer.business_type_id ??
    customer.classification_info?.business_type?.id ??
    customer.classification_info?.bussiness_type?.id
  if (directId != null && directId !== '') return String(directId)
  const name = String(
    customer.business_type || customer.customer_type || customer.customer_type_name || '',
  )
    .trim()
    .toLowerCase()
  if (!name) return ''
  const match = businessTypeOptions.find(
    (opt) => String(opt.label || '').trim().toLowerCase() === name,
  )
  return match?.value != null && match.value !== '' ? String(match.value) : ''
}

function resolveCustomerCategoryTypeId(customer, categoryTypeOptions = []) {
  if (!customer) return ''
  const directId =
    customer.category_type_id ?? customer.classification_info?.category_type?.id
  if (directId != null && directId !== '') return String(directId)
  const name = String(customer.category_type || customer.category_type_name || '')
    .trim()
    .toLowerCase()
  if (!name) return ''
  const match = categoryTypeOptions.find(
    (opt) => String(opt.label || '').trim().toLowerCase() === name,
  )
  return match?.value != null && match.value !== '' ? String(match.value) : ''
}

function resolveCustomerCreditTypeId(customer, creditTypeOptions = []) {
  if (!customer) return ''
  const directId =
    customer.credit_type_id ??
    customer.payment_type_id ??
    customer.classification_info?.credit_type?.id ??
    customer.classification_info?.payment_type?.id
  if (directId != null && directId !== '') return String(directId)
  const name = String(
    customer.credit_type ||
      customer.credit_type_name ||
      customer.payment_type ||
      customer.payment_type_name ||
      '',
  )
    .trim()
    .toLowerCase()
  if (!name || name === 'cash') return ''
  const match = creditTypeOptions.find(
    (opt) => String(opt.label || '').trim().toLowerCase() === name,
  )
  return match?.value != null && match.value !== '' ? String(match.value) : ''
}

function customerDisplayName(customer) {
  if (!customer) return ''
  return (
    customer.name ||
    customer.ledger_name ||
    customer.tally_name ||
    customer.alias_name ||
    customer.party_name ||
    `Customer ${customer.id}`
  )
}

async function fetchAllMarginStockItems(params, { maxPages = 100 } = {}) {
  const first = await fetchMarginStockItems({ ...params, page: 1, perPage: PAGE_SIZE })
  const items = [...(first?.data?.stock_items ?? [])]
  const totalPages = Math.max(1, Number(first?.pagination?.total_pages) || 1)
  const pagesToFetch = Math.min(totalPages, maxPages)
  for (let page = 2; page <= pagesToFetch; page += 1) {
    const res = await fetchMarginStockItems({ ...params, page, perPage: PAGE_SIZE })
    items.push(...(res?.data?.stock_items ?? []))
  }
  return items
}

export default function PriceMaster() {
  const [, navigate] = useLocation()
  const permissionsLoaded = usePermissions()
  const { hasReadPermission, userInfo } = useUserPermissions()
  const { showSuccess, showError } = useSuccessPopup()
  const canRead = hasReadPermission('stock_items')

  const branchId = userInfo?.branch_id ? String(userInfo.branch_id) : ''

  /** 'customer' | 'types' — either pick a customer, or set BT/Category/Credit manually. */
  const [filterMode, setFilterMode] = useState('types')
  const [customerId, setCustomerId] = useState('')
  const [customerLabel, setCustomerLabel] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [businessTypeId, setBusinessTypeId] = useState('')
  const [categoryTypeId, setCategoryTypeId] = useState('')
  const [creditTypeId, setCreditTypeId] = useState('')
  const [deliveryType, setDeliveryType] = useState(DELIVERY_TYPES.REGULAR)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  /** null | { kind: 'favourite' } | { kind: 'frequent' } | { kind: 'stock_group', id?, name } */
  const [insightFilter, setInsightFilter] = useState(null)
  const [stockCategoryId, setStockCategoryId] = useState('')
  /** { [itemId]: { item, qty } } — same selection model as Create SO Price List. */
  const [itemSelections, setItemSelections] = useState({})
  /** Keyboard nav zones — same model as Create SO Price List. */
  const [kbZone, setKbZone] = useState('search')
  const [focusFilterIdx, setFocusFilterIdx] = useState(0)
  const [focusItemIdx, setFocusItemIdx] = useState(0)
  const searchInputRef = useRef(null)
  const filterStripRef = useRef(null)
  const listRef = useRef(null)
  const convertButtonRef = useRef(null)
  const resultsSectionRef = useRef(null)
  const topFiltersRef = useRef(null)
  /** After page change via keyboard: 'first' | 'last' | null */
  const pendingPageFocusRef = useRef(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingFormat, setGeneratingFormat] = useState(null)
  /** Optional columns for download — Item is always included. Default: none selected. */
  const [downloadColumns, setDownloadColumns] = useState(() =>
    Object.fromEntries(PRICE_MASTER_EXPORT_COLUMNS.map((col) => [col.key, false])),
  )
  const [previewImage, setPreviewImage] = useState(null)
  const [previewImages, setPreviewImages] = useState([])

  const selectedDownloadColumnKeys = useMemo(
    () => PRICE_MASTER_EXPORT_COLUMNS.filter((col) => downloadColumns[col.key]).map((col) => col.key),
    [downloadColumns],
  )
  const canDownloadWithColumns = selectedDownloadColumnKeys.length > 0

  const openDownloadDialog = () => {
    setDownloadColumns(
      Object.fromEntries(PRICE_MASTER_EXPORT_COLUMNS.map((col) => [col.key, false])),
    )
    setDownloadOpen(true)
  }

  const toggleDownloadColumn = (key) => {
    setDownloadColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const openItemImagePreview = (item) => {
    const url = getPrimaryItemImage(item)
    if (!url) return
    const title = item?.name || item?.stock_item?.name || 'Item image'
    const gallery = [{ id: url, src: url, title }]
    setPreviewImages(gallery)
    setPreviewImage(gallery[0])
  }

  const closeItemImagePreview = () => {
    setPreviewImage(null)
    setPreviewImages([])
  }

  const { data: businessTypes = [] } = useQuery({
    queryKey: ['price-master-business-types'],
    queryFn: () => fetchBusinessTypes({ page_size: 500 }),
    enabled: permissionsLoaded && canRead,
    staleTime: 10 * 60 * 1000,
  })

  const { data: categoryTypesListing } = useQuery({
    queryKey: ['price-master-category-types'],
    queryFn: () => fetchCommonListings(['category_types']),
    enabled: permissionsLoaded && canRead,
    staleTime: 10 * 60 * 1000,
  })

  const { data: creditTypesResponse } = useQuery({
    queryKey: ['price-master-credit-types', String(customerId || '')],
    queryFn: () =>
      fetchCreditTypesResponse({
        page_size: 500,
        ...(customerId ? { customer_id: customerId } : {}),
      }),
    enabled: permissionsLoaded && canRead,
    staleTime: 5 * 60 * 1000,
  })

  const businessTypeOptions = useMemo(
    () => [
      { value: '', label: 'Select business type' },
      ...businessTypes.map((type) => ({
        value: String(type.id),
        label: type.name || type.type || `Business Type ${type.id}`,
      })),
    ],
    [businessTypes],
  )

  const categoryTypes = useMemo(() => {
    const nested = categoryTypesListing?.data?.category_types
    if (Array.isArray(nested)) return nested
    const top = categoryTypesListing?.category_types
    if (Array.isArray(top)) return top
    return []
  }, [categoryTypesListing])

  const categoryTypeOptions = useMemo(() => {
    return [
      { value: '', label: 'Select category' },
      ...categoryTypes.map((cat) => ({
        value: String(cat.id ?? cat.category_type_id),
        label: cat.type || cat.name || `Category ${cat.id ?? cat.category_type_id}`,
      })),
    ]
  }, [categoryTypes])

  const creditTypes = useMemo(() => {
    const rows = creditTypesResponse?.data ?? []
    return Array.isArray(rows) ? rows : []
  }, [creditTypesResponse])

  const creditTypeOptions = useMemo(() => {
    const list = creditTypes
      .filter((ct) => String(ct.name || ct.type || '').trim().toLowerCase() !== 'cash')
      .map((ct) => ({
        value: String(ct.id),
        label: ct.name || ct.type || `Credit Type ${ct.id}`,
      }))
    return [{ value: '', label: 'Cash' }, ...list]
  }, [creditTypes])

  const debouncedCustomerSearch = useDebounce(customerSearch, 300)
  const { data: customersResponse, isFetching: customersLoading } = useQuery({
    queryKey: ['price-master-customers', debouncedCustomerSearch, branchId],
    queryFn: () => searchSalesCustomers(debouncedCustomerSearch || '', 1, null, branchId || null),
    enabled: permissionsLoaded && canRead && filterMode === 'customer',
    staleTime: 60_000,
  })

  const customerOptions = useMemo(() => {
    const list = Array.isArray(customersResponse?.data) ? customersResponse.data : []
    return list.map((party) => ({
      value: String(party.id),
      label: customerDisplayName(party),
      hint: [
        party.business_type ||
          party.customer_type ||
          party.classification_info?.business_type?.name,
        party.category_type ||
          party.category_type_name ||
          party.classification_info?.category_type?.name,
      ]
        .filter(Boolean)
        .join(' · '),
      raw: party,
    }))
  }, [customersResponse])

  // Types mode: default Business Type / Category Type to the first dropdown value.
  useEffect(() => {
    if (filterMode !== 'types') return
    if (businessTypeId || !businessTypes.length) return
    const firstId = businessTypes[0]?.id
    if (firstId != null && firstId !== '') setBusinessTypeId(String(firstId))
  }, [filterMode, businessTypes, businessTypeId])

  useEffect(() => {
    if (filterMode !== 'types') return
    if (categoryTypeId || !categoryTypes.length) return
    const first = categoryTypes[0]
    const firstId = first?.id ?? first?.category_type_id
    if (firstId != null && firstId !== '') setCategoryTypeId(String(firstId))
  }, [filterMode, categoryTypes, categoryTypeId])

  // When a customer is selected, map their BT / category / credit like Create SO.
  useEffect(() => {
    if (filterMode !== 'customer') return
    if (!selectedCustomer) return
    setBusinessTypeId(resolveCustomerBusinessTypeId(selectedCustomer, businessTypeOptions))
    setCategoryTypeId(resolveCustomerCategoryTypeId(selectedCustomer, categoryTypeOptions))
    setCreditTypeId(resolveCustomerCreditTypeId(selectedCustomer, creditTypeOptions))
  }, [
    filterMode,
    selectedCustomer,
    businessTypeOptions,
    categoryTypeOptions,
    creditTypeOptions,
  ])

  const handleSelectCustomer = (value) => {
    const option = customerOptions.find((opt) => String(opt.value) === String(value))
    if (!value || !option) {
      setCustomerId('')
      setCustomerLabel('')
      setSelectedCustomer(null)
      setInsightFilter(null)
      setStockCategoryId('')
      setBusinessTypeId('')
      setCategoryTypeId('')
      setCreditTypeId('')
      setPage(1)
      return
    }
    setCustomerId(String(value))
    setCustomerLabel(option.label)
    setSelectedCustomer(option.raw || null)
    setInsightFilter(null)
    setStockCategoryId('')
    setPage(1)
  }

  const switchFilterMode = (mode) => {
    setFilterMode(mode)
    setInsightFilter(null)
    setSearch('')
    setPage(1)
    setDeliveryType(DELIVERY_TYPES.REGULAR)
    if (mode === 'types') {
      setCustomerId('')
      setCustomerLabel('')
      setSelectedCustomer(null)
      setCustomerSearch('')
      const firstBtId = businessTypes[0]?.id
      setBusinessTypeId(firstBtId != null && firstBtId !== '' ? String(firstBtId) : '')
      const firstCat = categoryTypes[0]
      const firstCatId = firstCat?.id ?? firstCat?.category_type_id
      setCategoryTypeId(firstCatId != null && firstCatId !== '' ? String(firstCatId) : '')
    } else {
      setBusinessTypeId('')
      setCategoryTypeId('')
      setCreditTypeId('')
    }
    setStockCategoryId('')
  }

  const hasPricingBasis =
    filterMode === 'customer'
      ? Boolean(customerId)
      : Boolean(businessTypeId || creditTypeId)

  // Customer Pickup → delivery_type=self so so-items-list deducts business-type additional.
  const pricingDeliveryType =
    deliveryType === DELIVERY_TYPES.CUSTOMER_PICKUP ? 'self' : undefined

  const pricingParams = useMemo(
    () => ({
      customerId: filterMode === 'customer' ? customerId || undefined : undefined,
      branchId: branchId || undefined,
      businessTypeId: businessTypeId || undefined,
      categoryTypeId: categoryTypeId || undefined,
      creditTypeId: creditTypeId || undefined,
      deliveryType: pricingDeliveryType,
    }),
    [
      filterMode,
      customerId,
      branchId,
      businessTypeId,
      categoryTypeId,
      creditTypeId,
      pricingDeliveryType,
    ],
  )

  const isInsightIdFilter =
    insightFilter?.kind === 'favourite' || insightFilter?.kind === 'frequent'

  // Reset to page 1 when search / pricing filters / insight chips change.
  useEffect(() => {
    setPage(1)
  }, [
    debouncedSearch,
    pricingParams.customerId,
    pricingParams.branchId,
    pricingParams.businessTypeId,
    pricingParams.categoryTypeId,
    pricingParams.creditTypeId,
    pricingParams.deliveryType,
    insightFilter?.kind,
    insightFilter?.id,
    insightFilter?.name,
    stockCategoryId,
  ])

  const stockGroupFilterIds =
    insightFilter?.kind === 'stock_group' && insightFilter.id
      ? [insightFilter.id]
      : undefined
  const stockGroupFilterName =
    insightFilter?.kind === 'stock_group' ? insightFilter.name : undefined
  const stockCategoryFilterIds = stockCategoryId ? [stockCategoryId] : undefined

  const {
    data: priceListData,
    isFetching: priceListLoading,
  } = useQuery({
    queryKey: [
      'price-master-list',
      pricingParams.customerId || '',
      pricingParams.branchId || '',
      debouncedSearch,
      pricingParams.businessTypeId || '',
      pricingParams.categoryTypeId || '',
      pricingParams.creditTypeId || '',
      pricingParams.deliveryType || '',
      insightFilter?.kind === 'stock_group'
        ? String(insightFilter.id || insightFilter.name || '')
        : '',
      stockCategoryId || '',
      page,
    ],
    queryFn: () =>
      fetchMarginStockItems({
        ...pricingParams,
        search: debouncedSearch,
        page,
        perPage: PAGE_SIZE,
        stockGroupIds: stockGroupFilterIds,
        stockGroupName: stockGroupFilterName,
        stockCategoryIds: stockCategoryFilterIds,
        includeZeroSellingStock: true,
      }),
    enabled: permissionsLoaded && canRead && hasPricingBasis && !isInsightIdFilter,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  })

  const priceListItems = useMemo(
    () => priceListData?.data?.stock_items ?? [],
    [priceListData],
  )

  const apiPagination = priceListData?.pagination || {}

  const { data: customerInsight, isFetching: insightLoading } = useQuery({
    queryKey: ['price-master-customer-insight', String(customerId || ''), String(branchId || '')],
    queryFn: () => fetchCustomerLastSalesOrder(customerId, branchId),
    enabled: permissionsLoaded && canRead && filterMode === 'customer' && Boolean(customerId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: stockGroupsData } = useQuery({
    queryKey: ['price-master-stock-groups'],
    queryFn: () => fetchStockGroups({ is_active: true }),
    enabled: permissionsLoaded && canRead && hasPricingBasis,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: stockCategoriesData } = useQuery({
    queryKey: ['price-master-stock-categories'],
    queryFn: () => fetchStockCategories(),
    enabled: permissionsLoaded && canRead && hasPricingBasis,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const stockGroupIdByName = useMemo(() => {
    const map = new Map()
    const groups = stockGroupsData?.data ?? []
    groups.forEach((group) => {
      const name = String(group?.name || '').trim()
      if (!name || group?.id == null) return
      map.set(name.toLowerCase(), group.id)
    })
    return map
  }, [stockGroupsData])

  useEffect(() => {
    if (insightFilter?.kind !== 'stock_group') return
    if (insightFilter.id != null) return
    const nameKey = String(insightFilter.name || '')
      .trim()
      .toLowerCase()
    if (!nameKey) return
    const id = stockGroupIdByName.get(nameKey)
    if (id == null) return
    setInsightFilter((prev) =>
      prev?.kind === 'stock_group' && prev.id == null ? { ...prev, id } : prev,
    )
  }, [insightFilter, stockGroupIdByName])

  const insights = useMemo(() => {
    const mostOrdered = Array.isArray(customerInsight?.most_ordered_items)
      ? customerInsight.most_ordered_items
      : []
    const favouriteIds = new Set()
    const frequentIds = new Set()
    const stockGroups = []
    const seenGroups = new Set()

    mostOrdered.forEach((row) => {
      if (row?.stock_item_id == null) return
      const key = String(row.stock_item_id)
      const parent = String(row.parent || '').trim()
      if (row.type === 'favourite') favouriteIds.add(key)
      else if (row.type === 'frequent_purchase') frequentIds.add(key)
      if (parent) {
        const groupKey = parent.toLowerCase()
        if (!seenGroups.has(groupKey)) {
          seenGroups.add(groupKey)
          stockGroups.push({
            name: parent,
            id: stockGroupIdByName.get(groupKey) ?? null,
          })
        }
      }
    })

    return {
      favouriteIds,
      frequentIds,
      stockGroups,
      favouriteCount: favouriteIds.size,
      frequentCount: frequentIds.size,
    }
  }, [customerInsight, stockGroupIdByName])

  const stockGroupSelectOptions = useMemo(() => {
    const groups = stockGroupsData?.data ?? []
    return [
      { value: '', label: 'All stock groups' },
      ...groups
        .filter((g) => g?.id != null && String(g.name || '').trim())
        .map((g) => ({
          value: String(g.id),
          label: String(g.name).trim(),
        })),
    ]
  }, [stockGroupsData])

  const stockCategorySelectOptions = useMemo(() => {
    const categories = stockCategoriesData?.data ?? []
    return [
      { value: '', label: 'All stock categories' },
      ...categories
        .filter((cat) => cat?.id != null && String(cat.name || '').trim())
        .map((cat) => ({
          value: String(cat.id),
          label: String(cat.name).trim(),
        })),
    ]
  }, [stockCategoriesData])

  const filterCards = useMemo(() => {
    const cards = []
    if (filterMode === 'customer' && customerId) {
      cards.push(
        { key: 'favourite', filter: { kind: 'favourite' } },
        { key: 'frequent', filter: { kind: 'frequent' } },
      )
    }
    ;(insights.stockGroups || []).forEach((group) => {
      const groupName = group?.name || group
      const groupId = group?.id ?? null
      cards.push({
        key: groupId != null ? `sg-${groupId}` : `sg-${String(groupName)}`,
        filter: { kind: 'stock_group', name: groupName, id: groupId },
      })
    })
    return cards
  }, [filterMode, customerId, insights.stockGroups])

  const insightFilterIds = useMemo(() => {
    if (!insightFilter?.kind) return []
    if (insightFilter.kind === 'favourite') return Array.from(insights.favouriteIds)
    if (insightFilter.kind === 'frequent') return Array.from(insights.frequentIds)
    return []
  }, [insightFilter, insights])

  const { data: insightOnlyItems = [], isFetching: insightItemsLoading } = useQuery({
    queryKey: [
      'price-master-insight-items',
      pricingParams.customerId || '',
      pricingParams.branchId || '',
      pricingParams.businessTypeId || '',
      pricingParams.categoryTypeId || '',
      pricingParams.creditTypeId || '',
      pricingParams.deliveryType || '',
      insightFilter?.kind || '',
      insightFilterIds.join(','),
      stockCategoryId || '',
    ],
    queryFn: async () => {
      const results = await Promise.all(
        insightFilterIds.map((stockItemId) =>
          fetchSoItemPricing({
            ...pricingParams,
            stockItemId,
          }),
        ),
      )
      const items = results.filter(Boolean)
      if (!stockCategoryId) return items
      return items.filter((item) => {
        const itemCategoryId =
          item?.category_id ?? item?.category?.id ?? item?.stock_item?.category_id
        return String(itemCategoryId || '') === String(stockCategoryId)
      })
    },
    enabled:
      permissionsLoaded &&
      canRead &&
      hasPricingBasis &&
      isInsightIdFilter &&
      insightFilterIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const itemsForDisplay = useMemo(() => {
    if (isInsightIdFilter) return insightOnlyItems
    return priceListItems
  }, [isInsightIdFilter, insightOnlyItems, priceListItems])

  const sortedItems = useMemo(() => {
    let rows = [...itemsForDisplay]

    const searchTrim = debouncedSearch.trim()
    if (searchTrim) {
      rows = rows.filter((item) => priceListItemMatchesSearch(item, searchTrim))
    }

    const insightRank = (item) => {
      const key = String(item.id)
      if (insights.favouriteIds.has(key)) return 0
      if (insights.frequentIds.has(key)) return 1
      return 2
    }

    const valueFor = (item) => {
      const prices = getPriceListRowPrices(item)
      if (sort.key === 'unit') return prices.unitPrice
      if (sort.key === 'base') return prices.basePrice
      if (sort.key === 'alt') return prices.altPrice
      if (sort.key === 'closing') return getClosingBalance(item)
      if (sort.key === 'max_qty') return getMaxQty(item)
      return null
    }

    rows.sort((a, b) => {
      const rankDiff = insightRank(a) - insightRank(b)
      if (rankDiff !== 0) return rankDiff
      if (!sort.key) return 0
      const av = valueFor(a)
      const bv = valueFor(b)
      const aMissing = av == null || !Number.isFinite(av)
      const bMissing = bv == null || !Number.isFinite(bv)
      if (aMissing && bMissing) return 0
      if (aMissing) return 1
      if (bMissing) return -1
      const cmp = av - bv
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [itemsForDisplay, debouncedSearch, insights, sort])

  // Client-side page slice only for favourite / frequent insight lists.
  const insightTotal = sortedItems.length
  const insightTotalPages = Math.max(1, Math.ceil(insightTotal / PAGE_SIZE) || 1)
  const displayItems = useMemo(() => {
    if (!isInsightIdFilter) return sortedItems
    const start = (page - 1) * PAGE_SIZE
    return sortedItems.slice(start, start + PAGE_SIZE)
  }, [isInsightIdFilter, sortedItems, page])

  const pagination = useMemo(() => {
    if (isInsightIdFilter) {
      return {
        current_page: page,
        per_page: PAGE_SIZE,
        total_count: insightTotal,
        total_pages: insightTotalPages,
      }
    }
    return {
      current_page: apiPagination.current_page ?? page,
      per_page: apiPagination.per_page ?? PAGE_SIZE,
      total_count: apiPagination.total_count ?? sortedItems.length,
      total_pages: Math.max(1, apiPagination.total_pages ?? 1),
    }
  }, [isInsightIdFilter, page, insightTotal, insightTotalPages, apiPagination, sortedItems.length])

  const listLoading =
    (isInsightIdFilter ? insightItemsLoading : priceListLoading) && !displayItems.length

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  const toggleInsightFilter = (nextFilter) => {
    setInsightFilter((prev) => {
      if (!nextFilter) return null
      if (!prev) return nextFilter
      if (prev.kind !== nextFilter.kind) return nextFilter
      if (prev.kind === 'stock_group') {
        const sameId =
          prev.id != null &&
          nextFilter.id != null &&
          String(prev.id) === String(nextFilter.id)
        const sameName =
          String(prev.name || '').toLowerCase() === String(nextFilter.name || '').toLowerCase()
        if (sameId || sameName) return null
      } else {
        return null
      }
      return nextFilter
    })
  }

  const toggleItemSelection = (item) => {
    if (!item?.id) return
    const key = String(item.id)
    setItemSelections((prev) => {
      if (prev[key]) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: { item, qty: '1' } }
    })
  }

  const ensureItemSelection = (item, qty) => {
    if (!item?.id) return
    const key = String(item.id)
    setItemSelections((prev) => {
      if (prev[key]) return prev
      return {
        ...prev,
        [key]: {
          item,
          qty: qty === '' || qty == null ? '1' : String(qty),
        },
      }
    })
  }

  const bumpItemQty = (itemId, delta, itemFallback = null) => {
    const key = String(itemId)
    setItemSelections((prev) => {
      const cur =
        prev[key] ||
        (itemFallback ? { item: itemFallback, qty: '1' } : null)
      if (!cur) return prev
      const current = parseFloat(cur.qty)
      const base = Number.isFinite(current) ? current : 0
      const next = Math.max(0, Math.round((base + delta) * 100) / 100)
      if (next <= 0) {
        const cleared = { ...prev }
        delete cleared[key]
        return cleared
      }
      return { ...prev, [key]: { ...cur, qty: String(next) } }
    })
  }

  const updateItemQty = (itemId, rawValue, itemFallback = null) => {
    const key = String(itemId)
    const digits = String(rawValue ?? '').replace(/[^\d.]/g, '')
    const parts = digits.split('.')
    const sanitized =
      parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}` : parts[0] || ''
    const capped =
      sanitized.replace('.', '').length > QUANTITY_MAX_DIGITS
        ? sanitized.slice(0, QUANTITY_MAX_DIGITS + (sanitized.includes('.') ? 1 : 0))
        : sanitized
    setItemSelections((prev) => {
      const cur =
        prev[key] ||
        (itemFallback ? { item: itemFallback, qty: '1' } : null)
      if (!cur) return prev
      return { ...prev, [key]: { ...cur, qty: capped } }
    })
  }

  const selectedItemEntries = useMemo(
    () =>
      Object.values(itemSelections).filter((entry) => {
        const qtyNum = parseFloat(entry?.qty)
        return entry?.item?.id != null && Number.isFinite(qtyNum) && qtyNum > 0
      }),
    [itemSelections],
  )

  const handleConvertToSalesOrder = () => {
    if (!selectedItemEntries.length) {
      showError('Select at least one item with quantity to convert.')
      return
    }
    if (!businessTypeId && !categoryTypeId && filterMode === 'types') {
      showError('Select business type and category type before converting.')
      return
    }
    const payload = {
      businessTypeId: businessTypeId ? String(businessTypeId) : '',
      categoryTypeId: categoryTypeId ? String(categoryTypeId) : '',
      creditTypeId: creditTypeId ? String(creditTypeId) : '',
      deliveryType:
        deliveryType === DELIVERY_TYPES.CUSTOMER_PICKUP
          ? DELIVERY_TYPES.CUSTOMER_PICKUP
          : DELIVERY_TYPES.REGULAR,
      items: selectedItemEntries.map(({ item, qty }) => ({
        item,
        qty: String(qty),
      })),
    }
    storePriceMasterConvertPayload(payload)
    navigate('/create-sales-order', { state: { priceMasterConvert: payload } })
  }

  const scrollFilterIntoView = (index) => {
    const strip = filterStripRef.current
    if (!strip) return
    const btn = strip.querySelector(`[data-price-master-filter-idx="${index}"]`)
    btn?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  const scrollItemIntoView = (index) => {
    const list = listRef.current
    if (!list) return
    const row = list.querySelector(`[data-price-master-item-idx="${index}"]`)
    if (!row) return
    // Prefer end/start so sticky header / page edges don't leave the highlight above the viewport.
    const max = Math.max(0, displayItems.length - 1)
    const block = index <= 0 ? 'start' : index >= max ? 'end' : 'nearest'
    row.scrollIntoView({ block, inline: 'nearest' })
  }

  // Focus search when pricing basis is ready (same entry point as Create SO Price List).
  useEffect(() => {
    if (!hasPricingBasis || downloadOpen || previewImage) return undefined
    setKbZone('search')
    setFocusFilterIdx(0)
    setFocusItemIdx(0)
    pendingPageFocusRef.current = null
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus?.()
    }, 50)
    return () => window.clearTimeout(focusTimer)
  }, [hasPricingBasis])

  // After keyboard page change, land on first/last row once the new page items are ready.
  useEffect(() => {
    const pending = pendingPageFocusRef.current
    if (!pending) return
    if (!displayItems.length) return
    const listBusy = isInsightIdFilter ? insightItemsLoading : priceListLoading
    if (listBusy) return

    const idx =
      pending === 'last' ? Math.max(0, displayItems.length - 1) : 0
    pendingPageFocusRef.current = null
    setKbZone('items')
    setFocusItemIdx(idx)
    window.requestAnimationFrame(() => {
      scrollItemIntoView(idx)
    })
  }, [
    page,
    displayItems,
    priceListLoading,
    insightItemsLoading,
    isInsightIdFilter,
  ])

  // Keep focused item index in range when the list length changes (never jump to 0 while empty/loading).
  useEffect(() => {
    if (pendingPageFocusRef.current) return
    setFocusItemIdx((prev) => {
      if (!displayItems.length) return prev
      return Math.min(prev, displayItems.length - 1)
    })
  }, [displayItems.length])

  useEffect(() => {
    setFocusFilterIdx((prev) => {
      if (!filterCards.length) return 0
      return Math.min(prev, filterCards.length - 1)
    })
  }, [filterCards.length])

  // Keyboard navigation: ↑↓ items/filters · ←→ qty/filters · Enter select · Tab convert
  useEffect(() => {
    if (!hasPricingBasis || downloadOpen || previewImage) return undefined

    const focusConvert = () => {
      setKbZone('footer')
      window.requestAnimationFrame(() => {
        convertButtonRef.current?.focus?.()
      })
    }

    const currentPage = Number(pagination.current_page) || page || 1
    const totalPages = Math.max(1, Number(pagination.total_pages) || 1)
    const listBusy = isInsightIdFilter ? insightItemsLoading : priceListLoading

    const handleKeyDown = (event) => {
      const key = event.key
      const active = document.activeElement
      const inSearch = active === searchInputRef.current
      const inQtyInput =
        active?.tagName === 'INPUT' &&
        active?.getAttribute?.('aria-label')?.startsWith?.('Quantity for')
      const inConvert = active === convertButtonRef.current
      const inTopFilters = Boolean(topFiltersRef.current?.contains(active))
      const inResults = Boolean(resultsSectionRef.current?.contains(active))
      const navActive =
        inSearch ||
        inQtyInput ||
        inConvert ||
        inResults ||
        kbZone === 'filters' ||
        kbZone === 'items' ||
        kbZone === 'footer'

      const inToolbarSelect = Boolean(
        active?.closest?.('[data-price-master-toolbar-select]'),
      )
      // Let Business Type / Category / Credit / Delivery / stock dropdowns work normally.
      if (inTopFilters && !inSearch && !inResults && !inConvert) return
      if (inToolbarSelect) return
      if (!navActive && !inSearch) return
      if (listBusy && (key === 'ArrowDown' || key === 'ArrowUp')) return

      if (key === 'Escape') {
        if (inQtyInput || kbZone === 'items' || kbZone === 'filters' || kbZone === 'footer') {
          event.preventDefault()
          event.stopPropagation()
          setKbZone('search')
          searchInputRef.current?.focus?.()
        }
        return
      }

      if (key === 'Tab') {
        if (inConvert) {
          if (event.shiftKey) {
            event.preventDefault()
            event.stopPropagation()
            if (displayItems.length) {
              setKbZone('items')
              scrollItemIntoView(focusItemIdx)
            } else {
              setKbZone('search')
              searchInputRef.current?.focus?.()
            }
          }
          return
        }
        if (inSearch || inQtyInput || kbZone === 'items' || kbZone === 'filters') {
          event.preventDefault()
          event.stopPropagation()
          if (event.shiftKey) {
            setKbZone('search')
            searchInputRef.current?.focus?.()
            return
          }
          focusConvert()
        }
        return
      }

      if (key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        if (inSearch || kbZone === 'search') {
          if (filterCards.length) {
            setKbZone('filters')
            setFocusFilterIdx(0)
            scrollFilterIntoView(0)
            searchInputRef.current?.blur?.()
          } else if (displayItems.length) {
            setKbZone('items')
            setFocusItemIdx(0)
            scrollItemIntoView(0)
            searchInputRef.current?.blur?.()
          }
          return
        }
        if (kbZone === 'filters') {
          if (displayItems.length) {
            setKbZone('items')
            setFocusItemIdx(0)
            scrollItemIntoView(0)
          }
          return
        }
        if (kbZone === 'items' || inQtyInput) {
          setKbZone('items')
          const max = Math.max(0, displayItems.length - 1)
          const atLast = (focusItemIdx || 0) >= max
          if (atLast && currentPage < totalPages) {
            pendingPageFocusRef.current = 'first'
            setPage(currentPage + 1)
            if (inQtyInput) active?.blur?.()
            return
          }
          setFocusItemIdx((prev) => {
            const next = Math.min(max, (prev || 0) + 1)
            window.requestAnimationFrame(() => scrollItemIntoView(next))
            return next
          })
          if (inQtyInput) active?.blur?.()
        }
        return
      }

      if (key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        if (kbZone === 'items' || inQtyInput) {
          const atFirst = (focusItemIdx || 0) <= 0
          if (atFirst && currentPage > 1) {
            pendingPageFocusRef.current = 'last'
            setPage(currentPage - 1)
            setKbZone('items')
            if (inQtyInput) active?.blur?.()
            return
          }
          setFocusItemIdx((prev) => {
            const next = Math.max(0, (prev || 0) - 1)
            if ((prev || 0) <= 0) {
              if (filterCards.length) {
                setKbZone('filters')
                scrollFilterIntoView(focusFilterIdx)
              } else {
                setKbZone('search')
                searchInputRef.current?.focus?.()
              }
              return 0
            }
            window.requestAnimationFrame(() => scrollItemIntoView(next))
            return next
          })
          if (inQtyInput) active?.blur?.()
          return
        }
        if (kbZone === 'filters') {
          setKbZone('search')
          searchInputRef.current?.focus?.()
          return
        }
        if (kbZone === 'footer') {
          if (displayItems.length) {
            setKbZone('items')
            scrollItemIntoView(focusItemIdx)
            convertButtonRef.current?.blur?.()
          } else {
            setKbZone('search')
            searchInputRef.current?.focus?.()
          }
        }
        return
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (kbZone === 'items' && displayItems.length) {
          const item = displayItems[focusItemIdx]
          if (item?.id != null && itemSelections[String(item.id)]) {
            event.preventDefault()
            event.stopPropagation()
            bumpItemQty(item.id, key === 'ArrowRight' ? 1 : -1, item)
          }
          return
        }
        if (kbZone !== 'filters' && !inSearch) return
        if (!filterCards.length) return
        event.preventDefault()
        event.stopPropagation()
        setKbZone('filters')
        searchInputRef.current?.blur?.()
        setFocusFilterIdx((prev) => {
          const max = filterCards.length - 1
          const next =
            key === 'ArrowRight'
              ? Math.min(max, (prev || 0) + 1)
              : Math.max(0, (prev || 0) - 1)
          scrollFilterIntoView(next)
          return next
        })
        return
      }

      if (key === 'Enter' || key === ' ') {
        if (inSearch && key === 'Enter') {
          if (displayItems.length) {
            event.preventDefault()
            setKbZone('items')
            setFocusItemIdx(0)
            scrollItemIntoView(0)
            searchInputRef.current?.blur?.()
          }
          return
        }
        if (kbZone === 'filters') {
          event.preventDefault()
          event.stopPropagation()
          const card = filterCards[focusFilterIdx]
          if (card?.filter) toggleInsightFilter(card.filter)
          return
        }
        if (kbZone === 'items' && !inQtyInput) {
          event.preventDefault()
          event.stopPropagation()
          const item = displayItems[focusItemIdx]
          if (item) toggleItemSelection(item)
          return
        }
        // Convert button: let native Enter/click handle submit (avoid double fire).
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [
    hasPricingBasis,
    downloadOpen,
    previewImage,
    kbZone,
    focusFilterIdx,
    focusItemIdx,
    filterCards,
    displayItems,
    itemSelections,
    selectedItemEntries.length,
    pagination.current_page,
    pagination.total_pages,
    page,
    priceListLoading,
    insightItemsLoading,
    isInsightIdFilter,
  ])

  const resolveSoItemsForDownload = async () => {
    // Full list for the filters currently applied on this page (not only the visible page).
    if (isInsightIdFilter) {
      return sortedItems
    }
    return fetchAllMarginStockItems({
      ...pricingParams,
      search: debouncedSearch,
      stockGroupIds: stockGroupFilterIds,
      stockGroupName: stockGroupFilterName,
      stockCategoryIds: stockCategoryFilterIds,
      includeZeroSellingStock: true,
    })
  }

  const businessLabel =
    businessTypeOptions.find((o) => String(o.value) === String(businessTypeId))?.label || ''
  const categoryLabel =
    categoryTypeOptions.find((o) => String(o.value) === String(categoryTypeId))?.label || ''
  const creditLabel =
    creditTypeOptions.find((o) => String(o.value) === String(creditTypeId))?.label || 'Cash'
  const deliveryLabel =
    DELIVERY_TYPE_OPTIONS.find((o) => o.value === deliveryType)?.label || 'Company Delivery'

  const handleDownloadFormat = async (format) => {
    if (!hasPricingBasis || isGenerating || !canDownloadWithColumns) return
    setIsGenerating(true)
    setGeneratingFormat(format)
    try {
      const soItems = await resolveSoItemsForDownload()
      const list = Array.isArray(soItems) ? soItems : []
      if (!list.length) {
        throw new Error('No items found to download for the current filters.')
      }

      const filterParts = []
      if (filterMode === 'customer' && customerLabel) {
        filterParts.push(`Customer: ${customerLabel}`)
      }
      if (businessLabel) filterParts.push(`Business: ${businessLabel}`)
      if (categoryLabel) filterParts.push(`Category: ${categoryLabel}`)
      if (creditLabel) filterParts.push(`Credit: ${creditLabel}`)
      if (deliveryLabel) filterParts.push(`Delivery: ${deliveryLabel}`)
      if (debouncedSearch) filterParts.push(`Search: "${debouncedSearch}"`)
      if (insightFilter?.kind === 'favourite') filterParts.push('Favourite items')
      if (insightFilter?.kind === 'frequent') filterParts.push('Frequent order')
      if (insightFilter?.kind === 'stock_group') {
        filterParts.push(`Stock group: ${insightFilter.name}`)
      }
      if (stockCategoryId) {
        const stockCategoryLabel =
          stockCategorySelectOptions.find((o) => String(o.value) === String(stockCategoryId))
            ?.label || stockCategoryId
        filterParts.push(`Stock category: ${stockCategoryLabel}`)
      }

      const exportArgs = {
        soItems: list,
        businessTypeName: businessLabel,
        categoryTypeName: categoryLabel,
        creditTypeName: creditLabel,
        customerName: filterMode === 'customer' ? customerLabel : '',
        filterDescription: filterParts.join(' | '),
        columns: selectedDownloadColumnKeys,
      }

      const result =
        format === 'excel'
          ? await generatePriceMasterExcel(exportArgs)
          : await generatePriceMasterPdf(exportArgs)

      const label = format === 'excel' ? 'Excel' : 'PDF'
      const forWho =
        filterMode === 'customer' && customerLabel ? ` for ${customerLabel}` : ''
      showSuccess(`Downloaded price list ${label}${forWho} with ${result.count} item(s).`)
      setDownloadOpen(false)
    } catch (err) {
      console.error(`Failed to generate price list ${format}:`, err)
      showError(
        err?.message ||
          `Failed to generate price list ${format === 'excel' ? 'Excel' : 'PDF'}.`,
      )
    } finally {
      setIsGenerating(false)
      setGeneratingFormat(null)
    }
  }

  if (!permissionsLoaded) return <Loader isLoading text="Loading permissions..." />
  if (!canRead) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-gray-600">You do not have permission to view Price Master.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100/80">
      <PageHeader title="Price Master">
        <button
          ref={convertButtonRef}
          type="button"
          onClick={handleConvertToSalesOrder}
          onFocus={() => setKbZone('footer')}
          disabled={!selectedItemEntries.length}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg btn-brand text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-800/30 focus:ring-offset-1"
          title="Convert selected items to Create Sales Order"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Convert to Sales Order</span>
          <span className="sm:hidden">Convert</span>
          {selectedItemEntries.length ? ` (${selectedItemEntries.length})` : ''}
        </button>
      </PageHeader>

      <main className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col min-h-0">
        <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-2.5 min-h-0 flex-1">
          {/* <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-sm shrink-0">
              <IndianRupee className="h-4 w-4 text-white" />
            </div>
            <p className="text-xs sm:text-sm text-slate-500 leading-snug">
              Browse item prices by customer or by business / category / credit / delivery type
              (same pricing as Create Sales Order).
            </p>
          </div> */}

          <section
            ref={topFiltersRef}
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-2 space-y-2 shrink-0"
          >
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => switchFilterMode('customer')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                  filterMode === 'customer'
                    ? 'border-blue-800 bg-blue-800 text-white'
                    : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                By Customer
              </button>
              <button
                type="button"
                onClick={() => switchFilterMode('types')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                  filterMode === 'types'
                    ? 'border-blue-800 bg-blue-800 text-white'
                    : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                By Business / Category / Credit
              </button>
            </div>

            {filterMode === 'customer' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div className="text-xs">
                  <span className="font-medium text-slate-600">Customer</span>
                  <div className="mt-0.5">
                    <SearchSelectDropdown
                      value={customerId}
                      options={customerOptions}
                      onChange={handleSelectCustomer}
                      selectedLabel={customerLabel}
                      placeholder="Select customer"
                      searchPlaceholder="Search customer..."
                      filterLocally={false}
                      onSearchChange={setCustomerSearch}
                      loading={customersLoading}
                      clearable
                    />
                  </div>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-slate-600">Delivery Type</span>
                  <div className="mt-0.5">
                    <SearchSelectDropdown
                      value={deliveryType}
                      options={DELIVERY_TYPE_OPTIONS}
                      onChange={(value) => {
                        setDeliveryType(
                          value === DELIVERY_TYPES.CUSTOMER_PICKUP
                            ? DELIVERY_TYPES.CUSTOMER_PICKUP
                            : DELIVERY_TYPES.REGULAR,
                        )
                        setPage(1)
                      }}
                      placeholder="Select delivery type"
                      searchPlaceholder="Search delivery type..."
                      useFixedMenu
                      compact
                    />
                  </div>
                </div>
                <div className="text-xs space-y-1 pt-4 md:pt-5">
                  {customerId ? (
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {[
                        businessLabel ? `Business: ${businessLabel}` : null,
                        categoryLabel ? `Category: ${categoryLabel}` : null,
                        `Credit: ${creditLabel}`,
                        `Delivery: ${deliveryLabel}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Select a customer to load prices (types map from the customer, like Sales
                      Order).
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="text-xs">
                  <span className="font-medium text-slate-600">Business Type</span>
                  <div className="mt-0.5">
                    <SearchSelectDropdown
                      value={businessTypeId}
                      options={businessTypeOptions}
                      onChange={(value) => {
                        setBusinessTypeId(value)
                        setInsightFilter(null)
                        setPage(1)
                      }}
                      placeholder="Select business type"
                      searchPlaceholder="Search business type..."
                      useFixedMenu
                      compact
                      clearable
                    />
                  </div>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-slate-600">Category Type</span>
                  <div className="mt-0.5">
                    <SearchSelectDropdown
                      value={categoryTypeId}
                      options={categoryTypeOptions}
                      onChange={(value) => {
                        setCategoryTypeId(value)
                        setInsightFilter(null)
                        setPage(1)
                      }}
                      placeholder="Select category"
                      searchPlaceholder="Search category type..."
                      useFixedMenu
                      compact
                      clearable
                    />
                  </div>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-slate-600">Credit Type</span>
                  <div className="mt-0.5">
                    <SearchSelectDropdown
                      value={creditTypeId}
                      options={creditTypeOptions}
                      onChange={(value) => {
                        setCreditTypeId(value)
                        setInsightFilter(null)
                        setPage(1)
                      }}
                      placeholder="Cash"
                      searchPlaceholder="Search credit type..."
                      useFixedMenu
                      compact
                      clearable
                    />
                  </div>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-slate-600">Delivery Type</span>
                  <div className="mt-0.5">
                    <SearchSelectDropdown
                      value={deliveryType}
                      options={DELIVERY_TYPE_OPTIONS}
                      onChange={(value) => {
                        setDeliveryType(
                          value === DELIVERY_TYPES.CUSTOMER_PICKUP
                            ? DELIVERY_TYPES.CUSTOMER_PICKUP
                            : DELIVERY_TYPES.REGULAR,
                        )
                        setInsightFilter(null)
                        setPage(1)
                      }}
                      placeholder="Select delivery type"
                      searchPlaceholder="Search delivery type..."
                      useFixedMenu
                      compact
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section
            ref={resultsSectionRef}
            className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden"
          >
            <div className="border-b border-gray-200 px-3 py-2 bg-slate-50/80 space-y-1.5 shrink-0">
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative flex-1 min-w-[12rem]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setKbZone('search')}
                    placeholder="Search items..."
                    disabled={!hasPricingBasis}
                    className={inputClass}
                  />
                </div>
                <div className="w-44 sm:w-52 shrink-0" data-price-master-toolbar-select>
                  <SearchSelectDropdown
                    value={
                      insightFilter?.kind === 'stock_group' && insightFilter.id != null
                        ? String(insightFilter.id)
                        : ''
                    }
                    options={stockGroupSelectOptions}
                    onChange={(value) => {
                      if (!value) {
                        setInsightFilter((prev) =>
                          prev?.kind === 'stock_group' ? null : prev,
                        )
                        setPage(1)
                        return
                      }
                      const opt = stockGroupSelectOptions.find(
                        (o) => String(o.value) === String(value),
                      )
                      setInsightFilter({
                        kind: 'stock_group',
                        id: value,
                        name: opt?.label || '',
                      })
                      setPage(1)
                    }}
                    placeholder="All stock groups"
                    searchPlaceholder="Search stock groups..."
                    disabled={!hasPricingBasis}
                    useFixedMenu
                    compact
                    clearable
                  />
                </div>
                <div className="w-44 sm:w-52 shrink-0" data-price-master-toolbar-select>
                  <SearchSelectDropdown
                    value={stockCategoryId}
                    options={stockCategorySelectOptions}
                    onChange={(value) => {
                      setStockCategoryId(value)
                      setPage(1)
                    }}
                    placeholder="All stock categories"
                    searchPlaceholder="Search stock categories..."
                    disabled={!hasPricingBasis}
                    useFixedMenu
                    compact
                    clearable
                  />
                </div>
                <button
                  type="button"
                  onClick={openDownloadDialog}
                  disabled={!hasPricingBasis}
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 shrink-0 rounded-lg btn-brand text-[11px] font-semibold cursor-pointer shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download Price List"
                  aria-label="Download Price List"
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0" />
                  Download
                </button>
              </div>

              {filterCards.length > 0 ? (
                <div
                  ref={filterStripRef}
                  className="flex gap-1 overflow-x-auto pb-0.5 -mx-0.5 px-0.5"
                  role="listbox"
                  aria-label="Price master filters"
                >
                  {filterCards.map((card, filterIdx) => {
                    const filter = card.filter
                    const isFavourite = filter.kind === 'favourite'
                    const isFrequent = filter.kind === 'frequent'
                    const isStockGroup = filter.kind === 'stock_group'
                    const active = isFavourite
                      ? insightFilter?.kind === 'favourite'
                      : isFrequent
                        ? insightFilter?.kind === 'frequent'
                        : insightFilter?.kind === 'stock_group' &&
                          ((filter.id != null &&
                            insightFilter.id != null &&
                            String(insightFilter.id) === String(filter.id)) ||
                            String(insightFilter.name || '').toLowerCase() ===
                              String(filter.name || '').toLowerCase())
                    const kbFocused =
                      kbZone === 'filters' && focusFilterIdx === filterIdx
                    return (
                      <button
                        key={card.key}
                        type="button"
                        data-price-master-filter-idx={filterIdx}
                        role="option"
                        aria-selected={active}
                        onClick={() => toggleInsightFilter(filter)}
                        onMouseEnter={() => {
                          setKbZone('filters')
                          setFocusFilterIdx(filterIdx)
                        }}
                        className={`shrink-0 rounded-md border px-2 py-1 text-left cursor-pointer transition-colors shadow-sm ${
                          isStockGroup ? 'max-w-[10.5rem]' : ''
                        } ${
                          active
                            ? 'border-blue-800 bg-blue-800 text-white'
                            : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                        } ${kbFocused ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                        title={
                          isFavourite
                            ? 'Show favourite items from customer history'
                            : isFrequent
                              ? 'Show frequent order items from customer history'
                              : `Filter by stock group: ${filter.name}`
                        }
                      >
                        <p
                          className={`text-[9px] uppercase tracking-wide font-medium leading-none ${
                            active ? 'text-blue-100' : 'text-blue-700'
                          }`}
                        >
                          {isFavourite
                            ? 'Favourite items'
                            : isFrequent
                              ? 'Frequent order'
                              : 'Stock group'}
                        </p>
                        {isStockGroup ? (
                          <p className="text-[11px] font-semibold leading-tight mt-0.5 truncate">
                            {filter.name}
                          </p>
                        ) : (
                          <p className="text-xs font-semibold tabular-nums leading-tight mt-0.5">
                            {insightLoading &&
                            !(isFavourite ? insights.favouriteCount : insights.frequentCount)
                              ? '…'
                              : isFavourite
                                ? insights.favouriteCount
                                : insights.frequentCount}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              <p className="text-[11px] text-slate-500">
                {hasPricingBasis
                  ? `${pagination.total_count} item${pagination.total_count === 1 ? '' : 's'}`
                  : 'Choose a filter above to load prices'}
                {selectedItemEntries.length
                  ? ` · ${selectedItemEntries.length} selected`
                  : ''}
                {insightFilter?.kind === 'favourite'
                  ? ' · Favourite filter'
                  : insightFilter?.kind === 'frequent'
                    ? ' · Frequent filter'
                    : insightFilter?.kind === 'stock_group'
                      ? ` · ${insightFilter.name}`
                      : ''}
                {priceListLoading || insightItemsLoading ? ' · Loading...' : ''}
                <span className="hidden sm:inline text-slate-400">
                  {' '}
                  · ↑↓ items · ←→ qty/filters · Enter select · Tab convert
                </span>
              </p>
            </div>

            <div ref={listRef} className="flex-1 overflow-auto min-h-0">
              {!hasPricingBasis ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  {filterMode === 'customer'
                    ? 'Select a customer to view the price list.'
                    : 'Select a business type and/or credit type to view prices.'}
                </div>
              ) : listLoading ? (
                <div className="p-10 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading price list...
                </div>
              ) : !displayItems.length ? (
                <div className="p-10 text-center text-sm text-slate-500 space-y-2">
                  <p>
                    {insightFilter
                      ? 'No matching items for this filter.'
                      : 'No stock items found for this pricing basis.'}
                  </p>
                  {insightFilter ? (
                    <button
                      type="button"
                      onClick={() => setInsightFilter(null)}
                      className="text-blue-800 font-medium hover:underline cursor-pointer"
                    >
                      Clear filter
                    </button>
                  ) : null}
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className={`${PRICE_TH_COMPACT} text-left`}>Item</th>
                      {[
                        { key: 'closing', label: 'Closing Balance', align: 'center' },
                        { key: 'max_qty', label: 'Max Qty', align: 'center' },
                        { key: 'unit', label: 'Unit', align: 'right' },
                        { key: 'base', label: 'Base', align: 'right' },
                        { key: 'alt', label: 'Alt', align: 'right' },
                      ].map((col) => {
                        const active = sort.key === col.key
                        const isCenter = col.align === 'center'
                        return (
                          <th
                            key={col.key}
                            className={`${PRICE_TH_COMPACT} ${
                              isCenter ? 'text-center' : 'text-right'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key)}
                              className={`inline-flex items-center gap-0.5 w-full cursor-pointer ${
                                isCenter ? 'justify-center' : 'justify-end'
                              } ${active ? 'text-blue-800' : 'hover:text-slate-800'}`}
                              title={`Sort by ${col.label}`}
                            >
                              <span>{col.label}</span>
                              {active && sort.dir === 'asc' ? (
                                <ArrowUp className="h-3 w-3 shrink-0" />
                              ) : active && sort.dir === 'desc' ? (
                                <ArrowDown className="h-3 w-3 shrink-0" />
                              ) : (
                                <span className="inline-flex flex-col leading-none opacity-40">
                                  <ArrowUp className="h-2.5 w-2.5" />
                                  <ArrowDown className="h-2.5 w-2.5 -mt-0.5" />
                                </span>
                              )}
                            </button>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayItems.map((item, itemIdx) => {
                      const prices = getPriceListRowPrices(item)
                      const key = String(item.id)
                      const selected = itemSelections[key]
                      const showQty = Boolean(selected)
                      const displayQty = selected?.qty ?? '1'
                      const isFavourite = insights.favouriteIds.has(key)
                      const isFrequent = insights.frequentIds.has(key)
                      const isInsightItem = isFavourite || isFrequent
                      const closing = getClosingBalance(item)
                      const maxQty = getMaxQty(item)
                      const imageUrl = getPrimaryItemImage(item)
                      const kbFocused = kbZone === 'items' && focusItemIdx === itemIdx
                      return (
                        <tr
                          key={item.id}
                          data-price-master-item-idx={itemIdx}
                          onClick={() => {
                            setKbZone('items')
                            setFocusItemIdx(itemIdx)
                            toggleItemSelection(item)
                          }}
                          onMouseEnter={() => {
                            setKbZone('items')
                            setFocusItemIdx(itemIdx)
                          }}
                          className={`cursor-pointer even:bg-slate-50/30 ${
                            showQty ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                          } ${kbFocused ? 'ring-2 ring-inset ring-blue-600 bg-blue-50' : ''}`}
                        >
                          <td className={`${PRICE_TD_COMPACT} font-medium min-w-[180px] max-w-[320px]`}>
                            <div className="flex items-center gap-2 min-w-0">
                              {imageUrl ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openItemImagePreview(item)
                                  }}
                                  className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white cursor-zoom-in hover:border-blue-300"
                                  title="Click to zoom"
                                  aria-label={`View image of ${item.name || 'item'}`}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={item.name || 'Item'}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : null}
                              <div className="min-w-0">
                                <div
                                  className={`leading-snug line-clamp-2 ${
                                    isInsightItem
                                      ? 'text-blue-600 font-semibold'
                                      : 'text-slate-900'
                                  }`}
                                  title={item.name || ''}
                                >
                                  {item.name || '—'}
                                </div>
                                {showQty ? (
                                  <div
                                    className="mt-1 inline-flex items-center gap-0.5 rounded-md border border-blue-200 bg-white p-0.5 shadow-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!selected) ensureItemSelection(item, displayQty)
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        bumpItemQty(item.id, -1, item)
                                      }}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded text-blue-800 hover:bg-blue-50 cursor-pointer"
                                      aria-label="Decrease quantity"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      tabIndex={-1}
                                      value={displayQty}
                                      onChange={(e) =>
                                        updateItemQty(item.id, e.target.value, item)
                                      }
                                      onFocus={(e) => {
                                        e.target.select()
                                        setKbZone('items')
                                        setFocusItemIdx(itemIdx)
                                        if (!selected) ensureItemSelection(item, displayQty)
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-12 h-6 px-0.5 border-0 text-xs text-center tabular-nums bg-transparent focus:outline-none focus:ring-0"
                                      aria-label={`Quantity for ${item.name || 'item'}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        bumpItemQty(item.id, 1, item)
                                      }}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded text-blue-800 hover:bg-blue-50 cursor-pointer"
                                      aria-label="Increase quantity"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className={`${PRICE_TD_COMPACT} text-center tabular-nums text-slate-800 whitespace-nowrap`}>
                            {formatQty(closing)}
                          </td>
                          <td className={`${PRICE_TD_COMPACT} text-center tabular-nums text-slate-800 whitespace-nowrap`}>
                            {formatQty(maxQty)}
                          </td>
                          <td className={`${PRICE_TD_COMPACT} text-right tabular-nums text-slate-800 whitespace-nowrap`}>
                            {formatPriceWithUnit(prices.unitPrice, prices.unitName)}
                          </td>
                          <td className={`${PRICE_TD_COMPACT} text-right tabular-nums text-slate-800 whitespace-nowrap`}>
                            {formatPriceWithUnit(prices.basePrice, prices.baseName, {
                              wholeNumber: true,
                            })}
                          </td>
                          <td className={`${PRICE_TD_COMPACT} text-right tabular-nums text-slate-800 whitespace-nowrap`}>
                            {prices.hasAlternate
                              ? formatPriceWithUnit(prices.altPrice, prices.altName)
                              : (
                                  <span className="text-slate-300">—</span>
                                )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {hasPricingBasis && pagination.total_pages > 1 ? (
              <div className="px-3 py-2 border-t border-gray-100 shrink-0">
                <Pagination
                  currentPage={pagination.current_page}
                  totalPages={pagination.total_pages}
                  totalCount={pagination.total_count}
                  pageSize={pagination.per_page || PAGE_SIZE}
                  onPageChange={(next) => {
                    const current = Number(pagination.current_page) || page || 1
                    pendingPageFocusRef.current = next > current ? 'first' : 'last'
                    setPage(next)
                    setKbZone('items')
                  }}
                />
              </div>
            ) : null}
          </section>
        </div>
      </main>

      {downloadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                  <FileDown className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base text-slate-900">Download Price List</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {[
                      filterMode === 'customer' && customerLabel ? customerLabel : null,
                      businessLabel,
                      categoryLabel,
                      creditLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Current filters'}
                    {pagination.total_count
                      ? ` · ${pagination.total_count} item${pagination.total_count === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isGenerating && setDownloadOpen(false)}
                disabled={isGenerating}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Columns to include</p>
                <p className="text-xs text-slate-500 mb-3">
                  Select at least one column to download. Item name is always included in the file.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRICE_MASTER_EXPORT_COLUMNS.map((col) => {
                    const checked = Boolean(downloadColumns[col.key])
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          checked
                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isGenerating}
                          onChange={() => toggleDownloadColumn(col.key)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800/30 cursor-pointer"
                        />
                        <span className="font-medium">{col.label}</span>
                      </label>
                    )
                  })}
                </div>
                {!canDownloadWithColumns ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Select at least one column to download.
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-sm text-slate-600 mb-2">Choose a format</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isGenerating || !canDownloadWithColumns}
                    onClick={() => handleDownloadFormat('pdf')}
                    className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-sm font-semibold hover:bg-blue-100 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGenerating && generatingFormat === 'pdf' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    PDF
                  </button>
                  <button
                    type="button"
                    disabled={isGenerating || !canDownloadWithColumns}
                    onClick={() => handleDownloadFormat('excel')}
                    className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg btn-brand text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGenerating && generatingFormat === 'excel' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage && previewImages.length > 0 ? (
        <ImagePreviewModal
          image={previewImage}
          images={previewImages}
          onClose={closeItemImagePreview}
          onNavigate={setPreviewImage}
        />
      ) : null}
    </div>
  )
}
