import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown, FileSpreadsheet, FileText, Loader2, Users, X } from 'lucide-react'
import SearchSelectDropdown from '@/components/common/SearchSelectDropdown'
import { generatePriceListPdf } from '@/utils/priceListPdfGenerator'
import { generatePriceListExcel } from '@/utils/priceListExcelGenerator'
import { fetchItemPriceMarginMatrix, fetchPricingCustomers } from '@/lib/margin_settings_api'
import { fetchBranchSettings, getBranchFromSettingsList } from '@/lib/branches_api'
import { fetchLedgerDetail } from '@/lib/tally_api'
import { fetchCreditTypesResponse } from '@/lib/customer_api'

const selectClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800 disabled:bg-slate-50 disabled:text-slate-400'

function resolveCustomerBusinessTypeId(customer, businessTypes = []) {
  if (!customer) return ''
  const directId =
    customer.customer_type_id ??
    customer.business_type_id ??
    customer.classification_info?.business_type?.id ??
    customer.classification_info?.bussiness_type?.id
  if (directId != null && directId !== '') return String(directId)

  const name = String(
    customer.business_type ||
      customer.customer_type ||
      customer.customer_type_name ||
      customer.classification_info?.business_type?.name ||
      customer.classification_info?.bussiness_type?.name ||
      '',
  )
    .trim()
    .toLowerCase()
  if (!name) return ''
  const match = businessTypes.find(
    (bt) => String(bt.name || '').trim().toLowerCase() === name,
  )
  return match?.id != null ? String(match.id) : ''
}

function resolveCustomerCategoryTypeId(customer, categoryTypes = []) {
  if (!customer) return ''
  const directId =
    customer.category_type_id ?? customer.classification_info?.category_type?.id
  if (directId != null && directId !== '') return String(directId)

  const name = String(
    customer.category_type ||
      customer.category_type_name ||
      customer.classification_info?.category_type?.name ||
      customer.classification_info?.category_type?.type ||
      '',
  )
    .trim()
    .toLowerCase()
  if (!name) return ''
  const match = categoryTypes.find((cat) => {
    const label = String(cat.name || cat.type || '')
      .trim()
      .toLowerCase()
    return label === name
  })
  return match?.id != null || match?.category_type_id != null
    ? String(match.id ?? match.category_type_id)
    : ''
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
      customer.classification_info?.credit_type?.name ||
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
    customer.party_name ||
    `Customer ${customer.id}`
  )
}

export default function DownloadPriceListDialog({
  open,
  onClose,
  businessTypes = [],
  categoryTypes = [],
  creditTypes = [],
  draftItems = [],
  totalItems = 0,
  activeFilters = {},
  cloneMatrixItemsFn = null,
  /** When set, export uses so-items-list prices instead of the margin matrix. */
  resolveSoItemsFn = null,
  /** Prefill customer / BT / category / credit when opening (e.g. Price Master). */
  initialSelection = null,
  onSuccess,
  onError,
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [pendingCustomer, setPendingCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedBtId, setSelectedBtId] = useState('')
  const [selectedCatId, setSelectedCatId] = useState('')
  const [selectedCreditTypeId, setSelectedCreditTypeId] = useState('')
  const [scope, setScope] = useState('all')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingFormat, setGeneratingFormat] = useState(null)
  const [mappingNote, setMappingNote] = useState('')

  const useSoItemsExport = typeof resolveSoItemsFn === 'function'

  const { data: matrixMeta, isLoading: isMetaLoading } = useQuery({
    queryKey: ['item-price-margin-matrix-meta'],
    queryFn: () => fetchItemPriceMarginMatrix({ page: 1, per_page: 1 }),
    enabled: open && (!businessTypes.length || !categoryTypes.length),
    staleTime: 300_000,
  })

  const { data: branchSettings } = useQuery({
    queryKey: ['branch-settings', 'price-list-pdf'],
    queryFn: () => fetchBranchSettings(),
    enabled: open,
    staleTime: 300_000,
  })

  const { data: customersRaw = [], isLoading: customersLoading } = useQuery({
    queryKey: ['price-list-customers', customerSearch],
    queryFn: () =>
      fetchPricingCustomers({
        search: customerSearch || undefined,
        per_page: 50,
        is_active: 'true',
        is_supplier: 'false',
      }),
    enabled: open,
    staleTime: 60_000,
  })

  const { data: creditTypesResponse, isLoading: creditTypesLoading } = useQuery({
    queryKey: ['price-list-credit-types', String(selectedCustomerId || '')],
    queryFn: () =>
      fetchCreditTypesResponse({
        page_size: 500,
        ...(selectedCustomerId ? { customer_id: selectedCustomerId } : {}),
      }),
    enabled: open,
    staleTime: 60_000,
  })

  const branchDetail = useMemo(
    () => getBranchFromSettingsList(branchSettings, activeFilters?.branch_id),
    [branchSettings, activeFilters?.branch_id],
  )

  const resolvedBusinessTypes = useMemo(() => {
    if (businessTypes.length) return businessTypes
    return matrixMeta?.business_types || []
  }, [businessTypes, matrixMeta])

  const resolvedCategoryTypes = useMemo(() => {
    if (categoryTypes.length) return categoryTypes
    return matrixMeta?.category_types || []
  }, [categoryTypes, matrixMeta])

  const creditTypeOptions = useMemo(() => {
    const apiRows = creditTypesResponse?.data
    const source =
      Array.isArray(apiRows) && apiRows.length
        ? apiRows
        : creditTypes.length
          ? creditTypes
          : matrixMeta?.credit_types || []
    const rows = (source || [])
      .filter((ct) => String(ct.name || ct.type || '').trim().toLowerCase() !== 'cash')
      .map((ct) => ({
        value: String(ct.id),
        label: ct.name || ct.type || `Credit Type ${ct.id}`,
      }))
    return [{ value: '', label: 'Cash' }, ...rows]
  }, [creditTypesResponse, creditTypes, matrixMeta])

  const customerOptions = useMemo(() => {
    return (customersRaw || []).map((party) => ({
      value: String(party.id),
      label: customerDisplayName(party),
      hint: [
        party.business_type ||
          party.customer_type ||
          party.classification_info?.business_type?.name ||
          party.classification_info?.bussiness_type?.name,
        party.category_type ||
          party.category_type_name ||
          party.classification_info?.category_type?.name ||
          party.classification_info?.category_type?.type,
      ]
        .filter(Boolean)
        .join(' · '),
      raw: party,
    }))
  }, [customersRaw])

  const selectedBt = useMemo(() => {
    return resolvedBusinessTypes.find((bt) => String(bt.id) === String(selectedBtId)) || null
  }, [resolvedBusinessTypes, selectedBtId])

  const selectedCat = useMemo(() => {
    return (
      resolvedCategoryTypes.find(
        (cat) =>
          String(cat.id) === String(selectedCatId) ||
          String(cat.category_type_id) === String(selectedCatId),
      ) || null
    )
  }, [resolvedCategoryTypes, selectedCatId])

  const selectedCreditType = useMemo(() => {
    if (!selectedCreditTypeId) return { value: '', label: 'Cash' }
    return (
      creditTypeOptions.find((opt) => String(opt.value) === String(selectedCreditTypeId)) || {
        value: selectedCreditTypeId,
        label: `Credit Type ${selectedCreditTypeId}`,
      }
    )
  }, [creditTypeOptions, selectedCreditTypeId])

  const activeDraftCount = useMemo(() => {
    if (useSoItemsExport) {
      return (draftItems || []).length
    }
    return (draftItems || []).filter((item) => {
      if (item.is_active === false || item.is_active === 0) return false
      if (selectedBt && selectedCat) {
        const bt = (item.business_types || []).find(
          (b) => Number(b.business_type_id) === Number(selectedBt.id),
        )
        const cat = (bt?.categories || []).find(
          (c) =>
            Number(c.category_type_id) ===
            Number(selectedCat.id ?? selectedCat.category_type_id),
        )
        if (cat && (cat.is_active === false || cat.is_active === 0)) return false
      }
      return true
    }).length
  }, [draftItems, selectedBt, selectedCat, useSoItemsExport])

  const canDownload = Boolean(selectedBtId && selectedCatId && !isGenerating)

  useEffect(() => {
    if (!open) {
      setSelectedCustomerId('')
      setSelectedCustomerName('')
      setPendingCustomer(null)
      setCustomerSearch('')
      setMappingNote('')
      setSelectedBtId('')
      setSelectedCatId('')
      setSelectedCreditTypeId('')
      setScope('all')
      return
    }

    if (!initialSelection) return

    if (initialSelection.customerId) {
      setSelectedCustomerId(String(initialSelection.customerId))
      setSelectedCustomerName(initialSelection.customerName || '')
    }
    if (initialSelection.businessTypeId) {
      setSelectedBtId(String(initialSelection.businessTypeId))
    }
    if (initialSelection.categoryTypeId) {
      setSelectedCatId(String(initialSelection.categoryTypeId))
    }
    if (initialSelection.creditTypeId != null && initialSelection.creditTypeId !== undefined) {
      setSelectedCreditTypeId(
        initialSelection.creditTypeId === '' ? '' : String(initialSelection.creditTypeId),
      )
    }
    if (initialSelection.mappingNote) {
      setMappingNote(initialSelection.mappingNote)
    } else if (initialSelection.customerName) {
      setMappingNote(
        `Price list for ${initialSelection.customerName} — using current Price Master filters.`,
      )
    }
  }, [open, initialSelection])

  useEffect(() => {
    if (!pendingCustomer || creditTypesLoading) return
    const ctId = resolveCustomerCreditTypeId(pendingCustomer, creditTypeOptions)
    setSelectedCreditTypeId(ctId)
    const ctLabel =
      creditTypeOptions.find((opt) => String(opt.value) === String(ctId))?.label ||
      (ctId ? `Credit Type ${ctId}` : 'Cash')

    const btId = resolveCustomerBusinessTypeId(pendingCustomer, resolvedBusinessTypes)
    const catId = resolveCustomerCategoryTypeId(pendingCustomer, resolvedCategoryTypes)
    const btLabel =
      resolvedBusinessTypes.find((bt) => String(bt.id) === String(btId))?.name ||
      (btId ? `Business Type ${btId}` : 'Not mapped')
    const catMeta = resolvedCategoryTypes.find(
      (cat) =>
        String(cat.id) === String(catId) || String(cat.category_type_id) === String(catId),
    )
    const catLabel = catMeta?.name || catMeta?.type || (catId ? `Category ${catId}` : 'Not mapped')
    const name = customerDisplayName(pendingCustomer) || selectedCustomerName

    if (!btId || !catId) {
      setMappingNote(
        `${name}: business type or category type is not mapped. Select them manually. Credit: ${ctLabel}.`,
      )
    } else {
      setMappingNote(
        `Price list for ${name} — using ${btLabel} / ${catLabel} / ${ctLabel} rates (category + credit margins).`,
      )
    }
    setPendingCustomer(null)
  }, [
    pendingCustomer,
    creditTypesLoading,
    creditTypeOptions,
    resolvedBusinessTypes,
    resolvedCategoryTypes,
    selectedCustomerName,
  ])

  const applyCustomerMapping = (customer, displayName) => {
    const btId = resolveCustomerBusinessTypeId(customer, resolvedBusinessTypes)
    const catId = resolveCustomerCategoryTypeId(customer, resolvedCategoryTypes)
    setSelectedBtId(btId)
    setSelectedCatId(catId)
    setSelectedCreditTypeId('')
    setPendingCustomer(customer)
    setMappingNote(`Loading mapped credit types for ${displayName}...`)
  }

  const handleCustomerChange = async (value) => {
    const option = customerOptions.find((opt) => String(opt.value) === String(value))
    if (!value || !option) {
      setSelectedCustomerId('')
      setSelectedCustomerName('')
      setPendingCustomer(null)
      setSelectedCreditTypeId('')
      setMappingNote('')
      return
    }

    setSelectedCustomerId(String(value))
    setSelectedCustomerName(option.label)
    let customer = option.raw || null

    const hasBt = Boolean(resolveCustomerBusinessTypeId(customer, resolvedBusinessTypes))
    const hasCat = Boolean(resolveCustomerCategoryTypeId(customer, resolvedCategoryTypes))
    if ((!hasBt || !hasCat) && value) {
      try {
        const detail = await fetchLedgerDetail(value)
        if (detail) customer = { ...customer, ...detail }
      } catch {
        // Keep list payload.
      }
    }

    applyCustomerMapping(customer, option.label)
  }

  const handleClose = () => {
    if (isGenerating) return
    onClose()
  }

  const prepareItemsForExport = async () => {
    if (!selectedBt || !selectedCat) return null

    const filterParts = []
    if (activeFilters.search) filterParts.push(`Search: "${activeFilters.search}"`)
    if (activeFilters.is_active === 'true' || activeFilters.is_active === true) {
      filterParts.push('Status: Active')
    } else if (activeFilters.is_active === 'false' || activeFilters.is_active === false) {
      filterParts.push('Status: Inactive')
    }
    if (activeFilters.base_price_filter === 'provided') {
      filterParts.push('Base Price: Provided')
    } else if (activeFilters.base_price_filter === 'zero') {
      filterParts.push('Base Price: 0')
    }
    if (activeFilters.gst_rate) filterParts.push(`GST: ${activeFilters.gst_rate}`)
    if (activeFilters.stock_group) filterParts.push(`Group: ${activeFilters.stock_group}`)
    if (activeFilters.stock_category) filterParts.push(`Category: ${activeFilters.stock_category}`)
    if (activeFilters.stock_sub_category) {
      filterParts.push(`Sub-Category: ${activeFilters.stock_sub_category}`)
    }
    if (activeFilters.no_supplier) {
      filterParts.push('Ledger: No Supplier')
    } else if (activeFilters.ledger_id) {
      filterParts.push(`Ledger ID: ${activeFilters.ledger_id}`)
    }
    if (activeFilters.insight_filter) {
      filterParts.push(`Filter: ${activeFilters.insight_filter}`)
    }

    const catName = selectedCat.name || selectedCat.type || `Category ${selectedCat.id}`
    const meta = {
      businessTypeId: selectedBt.id,
      businessTypeName: selectedBt.name || `Business Type ${selectedBt.id}`,
      categoryTypeId: selectedCat.id ?? selectedCat.category_type_id,
      categoryTypeName: catName,
      creditTypeId: selectedCreditTypeId || null,
      creditTypeName: selectedCreditType?.label || 'Cash',
      customerName: selectedCustomerName || '',
      customerId: selectedCustomerId || '',
      filterDescription: filterParts.join(' | '),
      branchDetail,
    }

    if (useSoItemsExport) {
      const soItems = await resolveSoItemsFn({
        scope,
        businessTypeId: selectedBt.id,
        categoryTypeId: selectedCat.id ?? selectedCat.category_type_id,
        creditTypeId: selectedCreditTypeId || null,
        customerId: selectedCustomerId || null,
      })
      const list = Array.isArray(soItems) ? soItems : []
      if (!list.length) {
        throw new Error('No active items found to generate price list.')
      }
      return { ...meta, soItems: list, items: [] }
    }

    let itemsToUse = draftItems

    // "All Filtered Items" (default): fetch every page with the page's active filters
    // so the download is not limited to the current pagination page.
    if (scope === 'all') {
      const targetTotal = Math.max(Number(totalItems) || 0, draftItems.length || 0, 1)
      const pageSize = Math.min(Math.max(targetTotal, 100), 5000)
      const collected = []
      let page = 1
      let reportedTotal = targetTotal

      while (collected.length < reportedTotal) {
        const res = await fetchItemPriceMarginMatrix({
          ...activeFilters,
          page,
          per_page: pageSize,
        })
        const rawItems = Array.isArray(res?.data) ? res.data : []
        const paginationTotal = Number(res?.pagination?.total)
        if (Number.isFinite(paginationTotal) && paginationTotal >= 0) {
          reportedTotal = paginationTotal
        }
        if (!rawItems.length) break
        collected.push(...rawItems)
        if (rawItems.length < pageSize) break
        page += 1
        // Safety: avoid unbounded loops on bad pagination metadata.
        if (page > 200) break
      }

      itemsToUse =
        typeof cloneMatrixItemsFn === 'function' ? cloneMatrixItemsFn(collected) : collected
    } else if (!itemsToUse.length || !itemsToUse[0]?.business_types?.length) {
      // Current page requested but draft rows lack BT payload — refetch filtered set once.
      const res = await fetchItemPriceMarginMatrix({
        ...activeFilters,
        page: 1,
        per_page: Math.min(Math.max(Number(totalItems) || draftItems.length || 100, 1), 5000),
      })
      const rawItems = res?.data || []
      itemsToUse = typeof cloneMatrixItemsFn === 'function' ? cloneMatrixItemsFn(rawItems) : rawItems
    }

    itemsToUse = (itemsToUse || []).filter((item) => {
      if (item.is_active === false || item.is_active === 0) return false
      const bt = (item.business_types || []).find(
        (b) => Number(b.business_type_id) === Number(selectedBt.id),
      )
      const cat = (bt?.categories || []).find(
        (c) =>
          Number(c.category_type_id) ===
          Number(selectedCat.id ?? selectedCat.category_type_id),
      )
      if (cat && (cat.is_active === false || cat.is_active === 0)) return false
      return true
    })

    if (!itemsToUse.length) {
      throw new Error('No active items found to generate price list.')
    }

    return { ...meta, items: itemsToUse }
  }

  const handleDownload = async (format) => {
    if (!canDownload || !selectedBt || !selectedCat) return
    setIsGenerating(true)
    setGeneratingFormat(format)

    try {
      const exportArgs = await prepareItemsForExport()
      if (!exportArgs) return

      const result =
        format === 'excel'
          ? await generatePriceListExcel(exportArgs)
          : await generatePriceListPdf(exportArgs)

      const label = format === 'excel' ? 'Excel' : 'PDF'
      const forWho = selectedCustomerName ? ` for ${selectedCustomerName}` : ''
      onSuccess?.(`Downloaded price list ${label}${forWho} with ${result.count} item(s).`)
      onClose()
    } catch (err) {
      console.error(`Failed to generate price list ${format}:`, err)
      onError?.(err.message || `Failed to generate price list ${format === 'excel' ? 'Excel' : 'PDF'}.`)
    } finally {
      setIsGenerating(false)
      setGeneratingFormat(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg flex flex-col overflow-hidden max-h-[min(92vh,720px)]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-900">Download Pricffe List</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Export rates for the selected business type, category, and credit type (same stack as
                sales order / item price margin).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {isMetaLoading ? (
            <div className="flex items-center justify-center py-4 text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-800" />
              Loading business and category types...
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              1. Select Customer <span className="text-slate-400 font-medium">(optional)</span>
            </label>
            <SearchSelectDropdown
              value={selectedCustomerId}
              selectedLabel={selectedCustomerName}
              options={customerOptions}
              onChange={handleCustomerChange}
              onSearchChange={setCustomerSearch}
              filterLocally={false}
              loading={customersLoading}
              clearable
              placeholder="Select customer"
              searchPlaceholder="Search customers..."
              emptyText="No customers found"
              disabled={isGenerating}
              useFixedMenu
            />
            {mappingNote ? (
              <p className="mt-2 text-[11px] leading-snug text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 flex gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-800" />
                <span>{mappingNote}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Choosing a customer fills business type, category, and credit type from their mapping.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              2. Select Business Type <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedBtId}
              onChange={(e) => {
                setSelectedBtId(e.target.value)
                if (selectedCustomerName) {
                  setMappingNote(
                    `Price list for ${selectedCustomerName} — business type overridden manually.`,
                  )
                }
              }}
              disabled={isGenerating || !resolvedBusinessTypes.length}
              className={selectClass}
            >
              <option value="">-- Choose Business Type --</option>
              {resolvedBusinessTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.name || `Business Type ${bt.id}`}
                </option>
              ))}
            </select>
            {!resolvedBusinessTypes.length && !isMetaLoading ? (
              <p className="text-[11px] text-amber-600 mt-1">No business types found.</p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              3. Select Category Type <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedCatId}
              onChange={(e) => {
                setSelectedCatId(e.target.value)
                if (selectedCustomerName) {
                  setMappingNote(
                    `Price list for ${selectedCustomerName} — category type overridden manually.`,
                  )
                }
              }}
              disabled={!selectedBtId || isGenerating || !resolvedCategoryTypes.length}
              className={selectClass}
            >
              <option value="">
                {!selectedBtId ? '-- Select Business Type first --' : '-- Choose Category Type --'}
              </option>
              {resolvedCategoryTypes.map((cat) => (
                <option key={cat.id ?? cat.category_type_id} value={cat.id ?? cat.category_type_id}>
                  {cat.name || cat.type || `Category ${cat.id}`}
                </option>
              ))}
            </select>
            {!resolvedCategoryTypes.length && selectedBtId && !isMetaLoading ? (
              <p className="text-[11px] text-amber-600 mt-1">No category types found.</p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              4. Select Credit Type
            </label>
            <select
              value={selectedCreditTypeId}
              onChange={(e) => {
                setSelectedCreditTypeId(e.target.value)
                const label =
                  creditTypeOptions.find((opt) => String(opt.value) === String(e.target.value))
                    ?.label || 'Cash'
                if (selectedCustomerName) {
                  setMappingNote(
                    `Price list for ${selectedCustomerName} — credit type set to ${label}.`,
                  )
                }
              }}
              disabled={isGenerating || creditTypesLoading}
              className={selectClass}
            >
              {creditTypeOptions.map((opt) => (
                <option key={opt.value || 'cash'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {selectedCustomerId
                ? 'Options follow the customer credit-type mapping (same as create sales order). Cash applies no credit margin.'
                : 'Cash applies no credit margin. Select a customer to load mapped credit types.'}
            </p>
          </div>

          {totalItems > draftItems.length || draftItems.length > 0 ? (
            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                5. Items to Include
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('current')}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer ${
                    scope === 'current'
                      ? 'border-blue-800 bg-blue-50 text-blue-900 ring-1 ring-blue-800/30'
                      : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold">Current Page</div>
                  <div className="text-[11px] text-slate-500">
                    {draftItems.length} item(s) (with live edits)
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer ${
                    scope === 'all'
                      ? 'border-blue-800 bg-blue-50 text-blue-900 ring-1 ring-blue-800/30'
                      : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold">All Filtered Items</div>
                  <div className="text-[11px] text-slate-500">
                    {totalItems || draftItems.length} total item(s) across pages
                  </div>
                </button>
              </div>
            </div>
          ) : null}

          {selectedBt && selectedCat ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3.5 space-y-1.5">
              <div className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-800" />
                Price List Summary
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                {selectedCustomerName ? (
                  <div className="col-span-2">
                    <span className="text-slate-500">Customer:</span>{' '}
                    <span className="font-semibold text-slate-900">{selectedCustomerName}</span>
                  </div>
                ) : null}
                <div>
                  <span className="text-slate-500">Business Type:</span>{' '}
                  <span className="font-semibold text-slate-900">{selectedBt.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Category:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedCat.name || selectedCat.type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Credit Type:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedCreditType?.label || 'Cash'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Active Items:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    {scope === 'all'
                      ? `${totalItems || activeDraftCount} (all filtered)`
                      : activeDraftCount}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Rate logic:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    {useSoItemsExport
                      ? 'Sales-order price list rates (unit + pack)'
                      : selectedCreditTypeId
                        ? 'Landing + category margin + credit type margin (ceil ₹)'
                        : 'Landing + category margin (Cash — ceil ₹, no credit margin)'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleDownload('excel')}
            disabled={!canDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-700 bg-white text-emerald-800 text-sm font-medium hover:bg-emerald-50 cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating && generatingFormat === 'excel' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Excel...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Download Excel
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={!canDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium hover:bg-blue-900 cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating && generatingFormat === 'pdf' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
