import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Menu, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Loader from '@/components/common/loader'
import MobileSidebar from '@/components/layout/mobile-sidebar'
import Sidebar from '@/components/layout/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useToast } from '@/hooks/use-toast'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import {
  fetchQuotationBusinessTypes,
  fetchQuotationCreditTypes,
  fetchQuotationStockItems,
  fetchSoQuotationDetail,
  saveSoQuotation,
} from '@/lib/sales_quotation_api'

const inputClass = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function money(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function roundRate(value) {
  const rate = Number(value)
  return Number.isFinite(rate) ? Math.round((rate + Number.EPSILON) * 100) / 100 : 0
}

function emptyLine() {
  return { item_id: '', quantity: 1, rate: 0, rate_per_unit: '', unit_id: '', gst_percentage: 0, comment: '' }
}

function getItemRate(item, businessTypeId, creditTypeId, businessTypes, creditTypes) {
  const matchedBusiness = item?.business_types?.find(
    (entry) => String(entry.business_type?.id) === String(businessTypeId),
  )
  const basePrice = Number(item?.base_price || 0)
  const businessType = businessTypes.find((entry) => String(entry.id) === String(businessTypeId))
  const creditType = creditTypes.find((entry) => String(entry.id) === String(creditTypeId))
  let price = Number(
    matchedBusiness?.business_type_base_price
      ?? basePrice * (1 + Number(businessType?.margin_percent || 0) / 100),
  )
  if (matchedBusiness && creditTypeId) {
    const matchedCredit = matchedBusiness.credit_types?.find(
      (entry) => String(entry.credit_type?.id) === String(creditTypeId),
    )
    if (matchedCredit) price = Number(matchedCredit.final_price)
    else price *= 1 + Number(creditType?.margin_percent || 0) / 100
  } else if (creditTypeId) {
    price *= 1 + Number(creditType?.margin_percent || 0) / 100
  }
  return { price, factor: basePrice > 0 ? price / basePrice : 1 }
}

function makeLine(item, businessTypeId, creditTypeId, businessTypes, creditTypes) {
  const { factor } = getItemRate(item, businessTypeId, creditTypeId, businessTypes, creditTypes)
  const unit = item.base_unit || item.alternate_unit || {}
  return {
    item_id: String(item.id),
    item_name: item.name || '',
    quantity: 1,
    rate: roundRate(Number(unit.price || item.base_price || 0) * factor),
    rate_per_unit: unit.name || '',
    unit_id: unit.id || '',
    base_unit_id: item.base_unit?.id || '',
    alternate_unit: item.alternate_unit || null,
    base_unit: item.base_unit || null,
    conversion: Number(item.conversion || 1),
    gst_percentage: Number(item.gst_rate || 0),
    comment: '',
  }
}

function lineAmount(line) {
  return (Number(line.quantity) || 0) * (Number(line.rate) || 0)
}

export default function CreateSoQuotation() {
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [, navigate] = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const {
    isLoading: permissionsLoading,
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    userInfo,
  } = useUserPermissions()
  const quotationId = new URLSearchParams(window.location.search).get('id') || ''
  const isEdit = Boolean(quotationId)
  const canRead = hasReadPermission('sales_order')
  const canSave = isEdit ? hasUpdatePermission('sales_order') : hasCreatePermission('sales_order')
  const branchId = userInfo?.branch || ''

  const [header, setHeader] = useState({
    customer: '',
    customer_mobile: '',
    customer_address: '',
    order_date: todayIso(),
    valid_till: '',
    business_type_id: '',
    credit_type_id: '',
    remarks: '',
  })
  const [lines, setLines] = useState([emptyLine()])
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const businessQuery = useQuery({
    queryKey: ['so-quotation-business-types'],
    queryFn: fetchQuotationBusinessTypes,
    enabled: !permissionsLoading && canRead,
  })
  const creditQuery = useQuery({
    queryKey: ['so-quotation-credit-types'],
    queryFn: fetchQuotationCreditTypes,
    enabled: !permissionsLoading && canRead,
  })
  const detailQuery = useQuery({
    queryKey: ['so-quotation-detail', quotationId],
    queryFn: () => fetchSoQuotationDetail(quotationId),
    enabled: !permissionsLoading && canRead && isEdit,
  })
  const pricingReady = Boolean(header.business_type_id || header.credit_type_id)
  const itemQuery = useQuery({
    queryKey: ['so-quotation-stock-items', search, branchId],
    queryFn: () => fetchQuotationStockItems({ search, page: 1, perPage: 100, branchId }),
    enabled: !permissionsLoading && canRead && pricingReady,
  })

  const businessTypes = businessQuery.data || []
  const creditTypes = creditQuery.data || []
  const stockItems = itemQuery.data?.data?.stock_items || []
  const stockItemsById = useMemo(() => {
    const map = new Map(stockItems.map((item) => [String(item.id), item]))
    lines.forEach((line) => {
      if (line.stock_item_data) map.set(String(line.item_id), line.stock_item_data)
    })
    return map
  }, [stockItems, lines])

  useEffect(() => {
    const detail = detailQuery.data
    if (!isEdit || !detail || hydrated) return
    setHeader({
      customer: detail.customer || '',
      customer_mobile: detail.customer_mobile || '',
      customer_address: detail.customer_address || '',
      order_date: detail.order_date || todayIso(),
      valid_till: detail.valid_till || '',
      business_type_id: detail.business_type ? String(detail.business_type) : '',
      credit_type_id: detail.credit_type ? String(detail.credit_type) : '',
      remarks: detail.remarks || '',
    })
    setLines((detail.items || []).map((item) => ({
      ...emptyLine(),
      item_id: String(item.stock_item_id || ''),
      item_name: item.stock_item_name || '',
      quantity: Number(item.quantity) || 0,
      rate: roundRate(item.rate),
      rate_per_unit: item.rate_per_unit || item.base_unit_name || '',
      unit_id: String(item.base_unit_id || ''),
      base_unit_id: item.base_unit_id || '',
      gst_percentage: Number(item.gst_percentage) || 0,
      comment: item.comment || '',
    })))
    setHydrated(true)
  }, [detailQuery.data, hydrated, isEdit])

  const setHeaderField = (field, value) => setHeader((previous) => ({ ...previous, [field]: value }))
  const updateLine = (index, patch) => setLines((previous) => previous.map((line, row) => row === index ? { ...line, ...patch } : line))

  const selectItem = (index, itemId) => {
    const item = stockItemsById.get(String(itemId))
    if (!item) return
    if (lines.some((line, row) => row !== index && String(line.item_id) === String(itemId))) {
      setFormError('An item can only be added once to a quotation.')
      return
    }
    setFormError('')
    updateLine(index, makeLine(
      item,
      header.business_type_id,
      header.credit_type_id,
      businessTypes,
      creditTypes,
    ))
  }

  const addLine = () => setLines((previous) => [...previous, emptyLine()])
  const removeLine = (index) => setLines((previous) => previous.length === 1 ? [emptyLine()] : previous.filter((_, row) => row !== index))

  const totals = useMemo(() => {
    const taxable = lines.reduce((sum, line) => sum + (line.item_id ? lineAmount(line) : 0), 0)
    const gst = lines.reduce((sum, line) => sum + (line.item_id ? lineAmount(line) * (Number(line.gst_percentage) || 0) / 100 : 0), 0)
    return { taxable, gst, total: taxable + gst }
  }, [lines])

  const saveMutation = useMutation({
    mutationFn: saveSoQuotation,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['so-quotations'] })
      queryClient.invalidateQueries({ queryKey: ['so-quotation-detail'] })
      toast({ title: 'Success', description: result.message || 'Quotation saved successfully.' })
      navigate('/sales/so-quotations')
    },
    onError: (error) => setFormError(error.message || 'Unable to save quotation.'),
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!header.customer.trim()) return setFormError('Party name is required.')
    if (!pricingReady) return setFormError('Select a business type or credit type to price the items.')
    const selectedLines = lines.filter((line) => line.item_id)
    if (!selectedLines.length) return setFormError('Add at least one item.')
    if (selectedLines.some((line) => Number(line.quantity) <= 0 || Number(line.rate) < 0)) {
      return setFormError('Every item must have a quantity greater than zero and a valid rate.')
    }
    setFormError('')
    saveMutation.mutate({
      ...(isEdit ? { id: Number(quotationId) } : {}),
      customer: header.customer.trim(),
      customer_mobile: header.customer_mobile.trim(),
      customer_address: header.customer_address.trim(),
      order_date: header.order_date,
      valid_till: header.valid_till || undefined,
      branch_id: branchId || undefined,
      business_type_id: header.business_type_id ? Number(header.business_type_id) : undefined,
      credit_type_id: header.credit_type_id ? Number(header.credit_type_id) : undefined,
      remarks: header.remarks.trim(),
      items: selectedLines.map((line) => ({
        item_id: Number(line.item_id),
        quantity: Number(line.quantity),
        price: roundRate(line.rate),
        rate_per_unit: line.rate_per_unit,
        base_unit_id: line.unit_id || line.base_unit_id || undefined,
        gst_percentage: Number(line.gst_percentage) || 0,
        comment: line.comment || '',
      })),
    })
  }

  if (permissionsLoading) return <Loader isLoading text="Loading permissions..." />
  if (!canRead) return <div className="p-8 text-center text-gray-600">You do not have permission to view quotations.</div>
  if (isEdit && detailQuery.isLoading) return <Loader isLoading text="Loading quotation..." />
  if (!canSave) return <div className="p-8 text-center text-gray-600">You do not have permission to save quotations.</div>

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />}
      <div className="app-main-content">
        <header className="app-header border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6">
          <div className="flex items-center gap-3">
            {isMobile && <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>}
            <Button variant="outline" size="sm" onClick={() => navigate('/sales/so-quotations')}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <div><h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Quotation' : 'Create Quotation'}</h1><p className="text-sm text-gray-500">Prepare a price quotation for a customer</p></div>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="mx-auto max-w-7xl space-y-4">
            {formError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
            {detailQuery.error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{detailQuery.error.message}</div>}

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-lg font-bold">Party Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">Party Name *
                  <input className={`${inputClass} mt-1`} value={header.customer} onChange={(event) => setHeaderField('customer', event.target.value)} placeholder="Enter party name" />
                </label>
                <label className="text-sm font-medium">Mobile
                  <input className={`${inputClass} mt-1`} value={header.customer_mobile} onChange={(event) => setHeaderField('customer_mobile', event.target.value)} placeholder="Mobile number" />
                </label>
              </div>
              <label className="mt-4 block text-sm font-medium">Address
                <textarea className={`${inputClass} mt-1 min-h-20 py-2`} value={header.customer_address} onChange={(event) => setHeaderField('customer_address', event.target.value)} placeholder="Customer address" />
              </label>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-1 text-lg font-bold">Quotation Details</h2>
              <p className="mb-4 text-xs text-gray-500">Item pricing uses the selected business and credit type margins.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm font-medium">Quotation Date
                  <input className={`${inputClass} mt-1`} type="date" value={header.order_date} onChange={(event) => setHeaderField('order_date', event.target.value)} />
                </label>
                <label className="text-sm font-medium">Valid Till
                  <input className={`${inputClass} mt-1`} type="date" min={header.order_date} value={header.valid_till} onChange={(event) => setHeaderField('valid_till', event.target.value)} />
                </label>
                <label className="text-sm font-medium">Business Type
                  <select className={`${inputClass} mt-1`} value={header.business_type_id} onChange={(event) => { setHeaderField('business_type_id', event.target.value); setLines([emptyLine()]) }}>
                    <option value="">Select business type</option>
                    {businessTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">Credit Type
                  <select className={`${inputClass} mt-1`} value={header.credit_type_id} onChange={(event) => { setHeaderField('credit_type_id', event.target.value); setLines([emptyLine()]) }}>
                    <option value="">Select credit type</option>
                    {creditTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm font-medium">Remarks
                <input className={`${inputClass} mt-1`} value={header.remarks} onChange={(event) => setHeaderField('remarks', event.target.value)} placeholder="Remarks" />
              </label>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Items</h2>
                <Button type="button" variant="outline" disabled={!pricingReady} onClick={addLine}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
              </div>
              {!pricingReady ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">Select a business type or credit type to load available priced items.</p> : (
                <>
                  <div className="mb-3 max-w-sm">
                    <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stock items..." />
                  </div>
                  {itemQuery.error && <p className="mb-3 text-sm text-red-600">{itemQuery.error.message}</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-sm">
                      <thead><tr className="bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-2">Item</th><th className="p-2 text-center">Qty</th><th className="p-2 text-center">Rate</th><th className="p-2">UOM</th><th className="p-2 text-center">GST %</th><th className="p-2 text-right">Amount</th><th className="p-2" /></tr></thead>
                      <tbody>
                        {lines.map((line, index) => {
                          const selected = stockItemsById.get(String(line.item_id))
                          const units = [selected?.base_unit, selected?.alternate_unit].filter((unit) => unit?.id)
                          return <tr key={index} className="border-b">
                            <td className="p-2">
                              <select className={`${inputClass} min-w-56`} value={line.item_id} onChange={(event) => selectItem(index, event.target.value)} disabled={itemQuery.isLoading}>
                                <option value="">{itemQuery.isLoading ? 'Loading items...' : 'Select item'}</option>
                                {line.item_id && !stockItems.some((item) => String(item.id) === String(line.item_id)) && <option value={line.item_id}>{line.item_name || 'Previously selected item'}</option>}
                                {stockItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                            </td>
                            <td className="p-2"><input className={`${inputClass} w-24 text-center`} type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></td>
                            <td className="p-2"><input className={`${inputClass} w-28 text-center`} type="number" min="0" step="0.01" value={Number(line.rate || 0).toFixed(2)} onChange={(event) => updateLine(index, { rate: event.target.value })} onBlur={(event) => updateLine(index, { rate: roundRate(event.target.value) })} /></td>
                            <td className="p-2">
                              {units.length > 1 ? <select className={`${inputClass} w-28`} value={line.unit_id || ''} onChange={(event) => {
                                const unit = units.find((item) => String(item.id) === event.target.value)
                                const { factor } = getItemRate(selected, header.business_type_id, header.credit_type_id, businessTypes, creditTypes)
                                updateLine(index, { unit_id: unit?.id || '', rate_per_unit: unit?.name || '', rate: roundRate(Number(unit?.price || 0) * factor) })
                              }}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select> : <span>{line.rate_per_unit || selected?.base_unit?.name || '-'}</span>}
                            </td>
                            <td className="p-2"><input className={`${inputClass} w-20 text-center`} type="number" min="0" max="100" step="0.01" value={line.gst_percentage} onChange={(event) => updateLine(index, { gst_percentage: event.target.value })} /></td>
                            <td className="p-2 text-right font-semibold">{money(lineAmount(line))}</td>
                            <td className="p-2"><button type="button" onClick={() => removeLine(index)} aria-label="Remove item" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="ml-auto mt-4 w-full max-w-xs space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
                <div className="flex justify-between"><span>Taxable Amount</span><strong>{money(totals.taxable)}</strong></div>
                <div className="flex justify-between"><span>GST</span><strong>{money(totals.gst)}</strong></div>
                <div className="flex justify-between border-t pt-2 text-base"><span>Total</span><strong>{money(totals.total)}</strong></div>
              </div>
            </section>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => navigate('/sales/so-quotations')}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? 'Saving...' : 'Save Quotation'}</Button></div>
          </form>
        </main>
      </div>
    </div>
  )
}
