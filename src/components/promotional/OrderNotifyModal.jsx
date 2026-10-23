import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, MessageSquare, Phone, Plus, Send, X } from 'lucide-react'
import { fetchBranchSettings, getBranchFromSettingsList } from '@/lib/branches_api'
import { fetchOrganizationLogo } from '@/lib/dashboard_api'
import { getApiErrorMessage } from '@/hooks/useSuccessPopup'
import { uploadMediaFile } from '@/lib/media_upload_api'
import { fetchPurchaseOrderDetail } from '@/lib/purchase_api'
import {
  fetchMessageTemplates,
  getTemplateComponent,
  isTemplateForUseCase,
  sendOrderMessages,
} from '@/lib/promotional_api'
import { fetchSalesOrderDetail } from '@/lib/sales_api'
import { formatCurrency } from '@/lib/dashboardHelpers'
import { createPurchaseOrderPdfBlob } from '@/utils/purchaseOrderPdfGenerator'
import { createSalesOrderPdfBlob } from '@/utils/salesOrderPdfGenerator'

function isApprovedTemplate(template) {
  return String(template?.status || '').toUpperCase() === 'APPROVED'
}

function getTemplateBodyPreview(template) {
  return String(getTemplateComponent(template, 'BODY')?.text || template?.body_preview || '').trim()
}

function normalizeMobileDigits(value) {
  return String(value || '').replace(/\D+/g, '')
}

function isValidMobileInput(value) {
  const digits = normalizeMobileDigits(value)
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'))
}

function formatAmountText(value) {
  const amount = Number(value) || 0
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseAmountValue(value) {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** Prefer the first amount that is a real order total (> 0). */
function firstOrderAmount(...values) {
  for (const value of values) {
    const num = parseAmountValue(value)
    if (num != null && num > 0) return num
  }
  for (const value of values) {
    const num = parseAmountValue(value)
    if (num != null) return num
  }
  return 0
}

function sumSalesOrderItemAmounts(items) {
  if (!Array.isArray(items) || !items.length) return null
  let total = 0
  let sawLine = false
  for (const item of items) {
    const direct =
      parseAmountValue(item?.amount) ??
      parseAmountValue(item?.billing_amount) ??
      parseAmountValue(item?.line_total)
    if (direct != null) {
      total += direct
      sawLine = true
      continue
    }
    const qty =
      parseAmountValue(item?.quantity) ??
      parseAmountValue(item?.billed_quantity) ??
      parseAmountValue(item?.actual_qty) ??
      0
    const rate = parseAmountValue(item?.rate) ?? 0
    if (qty || rate) {
      total += qty * rate
      sawLine = true
    }
  }
  return sawLine ? total : null
}

function formatPdfDate(dateString) {
  if (!dateString) return '-'
  try {
    return format(new Date(dateString), 'dd-MM-yyyy')
  } catch {
    return dateString
  }
}

export function getSalesOrderNotifySummary(detail, totalAmount = null) {
  const header = detail?.header || {}
  const summary = detail?.summary || {}
  const cash = detail?.cash_ledger_info || {}
  // discounted_amount on SO is the offer discount (often 0), not the order total.
  const amount = firstOrderAmount(
    totalAmount,
    sumSalesOrderItemAmounts(detail?.items),
    summary.total_amount,
    summary.final_amount,
    header.amount,
    header.billing_amount,
    header.total_amount,
  )
  return {
    partyName: header.customer_name || cash.name || 'Customer',
    contact:
      cash.mobile ||
      header.customer_mobile ||
      header.whatsapp_number ||
      header.contact_number ||
      '',
    orderNumber: header.so_number || header.order_id || header.order_number || '—',
    date: header.order_date || '',
    amount,
    amountText: formatAmountText(amount),
    companyName: header.organization_name || 'MWB Agro',
    customerId: header.customer_id || null,
    branchId: header.branch_id || null,
  }
}

export function getPurchaseOrderNotifySummary(detail, totalAmount = null) {
  const partyInfo = detail?.party_info || {}
  const amount = firstOrderAmount(
    totalAmount,
    detail?.amount,
    detail?.total_amount,
    detail?.net_amount,
  )
  return {
    partyName: detail?.party || partyInfo.name || 'Supplier',
    contact:
      partyInfo.contact_number ||
      partyInfo.whatsapp_number ||
      partyInfo.mobile ||
      detail?.party_mobile ||
      '',
    orderNumber: detail?.voucher_number || '—',
    date: detail?.effective_date || detail?.order_date || '',
    amount,
    amountText: formatAmountText(amount),
    companyName: detail?.organization_name || 'MWB Agro',
    customerId: detail?.party_id || partyInfo.id || null,
    branchId: detail?.branch_id || null,
    purchaseOrderId: detail?.id || null,
  }
}

function buildOrderSmsPreview(summary, documentLabel, url = '') {
  const dated = summary.date ? ` dated ${summary.date}` : ''
  const link = url || `[${documentLabel} PDF link]`
  return (
    `Dear ${summary.partyName}, your ${documentLabel} ${summary.orderNumber}` +
    `${dated} for Rs.${summary.amountText} is ready. Download: ${link} - ${summary.companyName}`
  )
}

export default function OrderNotifyModal({
  open,
  onClose,
  useCase = 'sales_order',
  soNumber = '',
  poId = null,
  orderDetail = null,
  userData = null,
  branches = [],
  totalAmount = null,
  onSuccess,
  onError,
}) {
  const isSalesOrder = useCase === 'sales_order'
  const documentLabel = isSalesOrder ? 'sales order' : 'purchase order'
  const partyLabel = isSalesOrder ? 'Customer' : 'Supplier'
  const useCaseFilter = isSalesOrder ? 'sales_order' : 'purchase_order'

  const [sendWhatsapp, setSendWhatsapp] = useState(true)
  const [sendSms, setSendSms] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [includeCustomerPhone, setIncludeCustomerPhone] = useState(true)
  const [extraPhones, setExtraPhones] = useState([])
  const [extraPhoneDraft, setExtraPhoneDraft] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const shouldFetchSo = open && isSalesOrder && Boolean(soNumber) && !orderDetail
  const shouldFetchPo = open && !isSalesOrder && Boolean(poId) && !orderDetail

  const soDetailQuery = useQuery({
    queryKey: ['sales-order-detail', soNumber, 'notify'],
    queryFn: () => fetchSalesOrderDetail(soNumber),
    enabled: shouldFetchSo,
  })

  const poDetailQuery = useQuery({
    queryKey: ['purchase-order-detail', poId, 'notify'],
    queryFn: () => fetchPurchaseOrderDetail(poId),
    enabled: shouldFetchPo,
  })

  const resolvedDetail = orderDetail || (isSalesOrder ? soDetailQuery.data : poDetailQuery.data)
  const detailLoading =
    (shouldFetchSo && (soDetailQuery.isLoading || soDetailQuery.isFetching)) ||
    (shouldFetchPo && (poDetailQuery.isLoading || poDetailQuery.isFetching))

  const summary = useMemo(() => {
    if (!resolvedDetail) return null
    return isSalesOrder
      ? getSalesOrderNotifySummary(resolvedDetail, totalAmount)
      : getPurchaseOrderNotifySummary(resolvedDetail, totalAmount)
  }, [isSalesOrder, resolvedDetail, totalAmount])

  const branchId = summary?.branchId
  const branchSettingsQuery = useQuery({
    queryKey: ['branch-settings-notify', branchId],
    queryFn: () => fetchBranchSettings({ branch_id: branchId }),
    enabled: open && Boolean(branchId),
    staleTime: 60_000,
  })
  const organizationLogoQuery = useQuery({
    queryKey: ['organization-logo-notify'],
    queryFn: fetchOrganizationLogo,
    enabled: open && isSalesOrder,
    staleTime: 60_000,
  })

  const branchDetail = useMemo(() => {
    if (branchId) {
      const fromSettings = getBranchFromSettingsList(branchSettingsQuery.data, branchId)
      if (fromSettings) return fromSettings
    }
    if (!branchId) return null
    return branches.find((branch) => String(branch.id) === String(branchId)) || null
  }, [branchId, branchSettingsQuery.data, branches])

  const templatesQuery = useQuery({
    queryKey: ['promotional-message-templates'],
    queryFn: () => fetchMessageTemplates(),
    enabled: open,
    staleTime: 30_000,
  })

  const approvedTemplates = useMemo(
    () =>
      (templatesQuery.data?.templates || []).filter(
        (template) =>
          isApprovedTemplate(template) && isTemplateForUseCase(template, useCaseFilter),
      ),
    [templatesQuery.data, useCaseFilter],
  )

  useEffect(() => {
    if (!open) return
    setIncludeCustomerPhone(true)
    setExtraPhones([])
    setExtraPhoneDraft('')
    setPhoneError('')
    setTemplateName((current) => {
      if (current && approvedTemplates.some((item) => item.name === current)) {
        return current
      }
      return approvedTemplates[0]?.name || ''
    })
  }, [open, approvedTemplates])

  const selectedTemplate = approvedTemplates.find((item) => item.name === templateName)
  const templatePreview = selectedTemplate ? getTemplateBodyPreview(selectedTemplate) : ''
  const preview = useMemo(
    () => (summary ? buildOrderSmsPreview(summary, documentLabel) : ''),
    [summary, documentLabel],
  )

  const hasCustomerPhone = Boolean(normalizeMobileDigits(summary?.contact))

  const resolveExtraPhonesForSend = () => {
    const phones = [...extraPhones]
    const draft = extraPhoneDraft.trim()
    if (!draft) return { phones, error: '' }
    if (!isValidMobileInput(draft)) {
      return { phones, error: 'Enter a valid 10-digit mobile number, then send again.' }
    }
    const digits = normalizeMobileDigits(draft)
    const alreadyAdded = phones.some((item) => normalizeMobileDigits(item) === digits)
    const matchesCustomer =
      hasCustomerPhone && normalizeMobileDigits(summary?.contact) === digits
    if (!alreadyAdded && !matchesCustomer) {
      phones.push(draft)
    }
    return { phones, error: '' }
  }

  const destinationCount =
    (includeCustomerPhone && hasCustomerPhone ? 1 : 0) +
    resolveExtraPhonesForSend().phones.length

  const addExtraPhone = () => {
    const value = extraPhoneDraft.trim()
    if (!value) {
      setPhoneError('Enter a mobile number to add.')
      return
    }
    if (!isValidMobileInput(value)) {
      setPhoneError('Enter a valid 10-digit mobile number.')
      return
    }
    const digits = normalizeMobileDigits(value)
    const alreadyAdded = extraPhones.some(
      (item) => normalizeMobileDigits(item) === digits,
    )
    const matchesCustomer =
      hasCustomerPhone && normalizeMobileDigits(summary.contact) === digits
    if (alreadyAdded || matchesCustomer) {
      setPhoneError('This number is already included.')
      return
    }
    setExtraPhones((prev) => [...prev, value])
    setExtraPhoneDraft('')
    setPhoneError('')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const channels = []
      if (sendWhatsapp) channels.push('whatsapp')
      if (sendSms) channels.push('sms')
      if (!channels.length) {
        throw new Error('Select WhatsApp, SMS, or both.')
      }
      if (sendWhatsapp && !templateName) {
        throw new Error('Select an approved WhatsApp template for this organization.')
      }
      if (!resolvedDetail || !summary) {
        throw new Error(`${isSalesOrder ? 'Sales order' : 'Purchase order'} is still loading.`)
      }

      const { phones: phonesToSend, error: draftError } = resolveExtraPhonesForSend()
      if (draftError) {
        setPhoneError(draftError)
        throw new Error(draftError)
      }
      if (phonesToSend.length !== extraPhones.length) {
        setExtraPhones(phonesToSend)
        setExtraPhoneDraft('')
      }

      const destinations =
        (includeCustomerPhone && hasCustomerPhone ? 1 : 0) + phonesToSend.length
      if (!destinations) {
        throw new Error('Add at least one mobile number to send to.')
      }

      let blob
      let fileName
      let blobUrl
      if (isSalesOrder) {
        const generated = await createSalesOrderPdfBlob({
          orderDetail: resolvedDetail,
          userData,
          branchRecord: branchDetail,
          branchDetail,
          organizationLogo: organizationLogoQuery.data || '',
          totalAmount: totalAmount ?? summary.amount,
          formatDateFn: formatPdfDate,
        })
        blob = generated.blob
        fileName = generated.fileName
        blobUrl = generated.blobUrl
      } else {
        const generated = await createPurchaseOrderPdfBlob({
          orderDetail: resolvedDetail,
          userData,
          branchRecord: branchDetail,
          branchDetail,
          totalAmount: totalAmount ?? summary.amount,
          formatDateFn: formatPdfDate,
        })
        blob = generated.blob
        fileName = generated.fileName
        blobUrl = generated.blobUrl
      }

      try {
        const file = new File(
          [blob],
          fileName || `${isSalesOrder ? 'sales-order' : 'purchase-order'}.pdf`,
          { type: 'application/pdf' },
        )
        const url = await uploadMediaFile(
          file,
          isSalesOrder ? 'sales_orders' : 'purchase_orders',
        )
        return sendOrderMessages({
          template_type: useCaseFilter,
          bill_number: summary.orderNumber,
          ...(isSalesOrder
            ? {}
            : {
                purchase_order_id: summary.purchaseOrderId || poId,
                party_id: summary.customerId,
              }),
          url,
          channels,
          include_customer_phone: includeCustomerPhone,
          extra_phones: phonesToSend,
          ...(sendWhatsapp ? { template_name: templateName } : {}),
        })
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl)
      }
    },
    onSuccess: (result) => {
      onSuccess?.(result)
      onClose?.()
    },
    onError: (error) => {
      onError?.(getApiErrorMessage(error, error?.message || 'Failed to notify party'))
    },
  })

  if (!open) return null

  const busy =
    mutation.isPending ||
    detailLoading ||
    branchSettingsQuery.isLoading ||
    (isSalesOrder && organizationLogoQuery.isLoading) ||
    (sendWhatsapp && templatesQuery.isLoading)
  const canSend =
    Boolean(resolvedDetail && summary) &&
    (sendWhatsapp || sendSms) &&
    !busy &&
    destinationCount > 0 &&
    (!sendWhatsapp || Boolean(templateName))

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[min(90vh,720px)] my-auto flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-lg text-slate-900">
              Notify {isSalesOrder ? 'customer' : 'supplier'}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Send this {documentLabel} on WhatsApp and SMS with the PDF link.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {summary ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">{partyLabel}</p>
                <p className="font-medium text-slate-900 break-words">{summary.partyName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Mobile</p>
                <p className="font-medium text-slate-900">{summary.contact || 'Not on ledger'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{isSalesOrder ? 'SO No' : 'PO No'}</p>
                <p className="font-medium text-slate-900">{summary.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount</p>
                <p className="font-medium text-slate-900">{formatCurrency(summary.amount)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {detailLoading ? `Loading ${documentLabel} details…` : 'Order details unavailable.'}
            </p>
          )}

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCustomerPhone}
                onChange={(event) => setIncludeCustomerPhone(event.target.checked)}
                disabled={mutation.isPending || !hasCustomerPhone}
              />
              Send to {isSalesOrder ? 'customer' : 'supplier'} number
              {summary?.contact ? (
                <span className="font-medium text-slate-900">({summary.contact})</span>
              ) : (
                <span className="text-slate-400">(not on ledger)</span>
              )}
            </label>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                Also send to
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={extraPhoneDraft}
                  onChange={(event) => {
                    setExtraPhoneDraft(event.target.value)
                    if (phoneError) setPhoneError('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addExtraPhone()
                    }
                  }}
                  disabled={mutation.isPending}
                  placeholder="Enter another mobile number"
                  className="flex-1 h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                />
                <button
                  type="button"
                  onClick={addExtraPhone}
                  disabled={mutation.isPending}
                  className="inline-flex items-center gap-1.5 h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              {phoneError ? (
                <p className="mt-1 text-xs text-red-600">{phoneError}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  Type a number and click Add (or just Send — a valid number in the box is included
                  automatically).
                </p>
              )}
              {extraPhones.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extraPhones.map((phone) => (
                    <span
                      key={phone}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-700"
                    >
                      {phone}
                      <button
                        type="button"
                        onClick={() =>
                          setExtraPhones((prev) => prev.filter((item) => item !== phone))
                        }
                        disabled={mutation.isPending}
                        className="text-slate-400 hover:text-slate-700"
                        aria-label={`Remove ${phone}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-1.5 text-[11px] text-slate-500">
                Sending to {destinationCount} number{destinationCount === 1 ? '' : 's'}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800 cursor-pointer">
              <input
                type="checkbox"
                checked={sendWhatsapp}
                onChange={(event) => setSendWhatsapp(event.target.checked)}
                disabled={mutation.isPending}
              />
              <Phone className="h-4 w-4" />
              WhatsApp
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sky-200 bg-sky-50 text-sm text-sky-800 cursor-pointer">
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(event) => setSendSms(event.target.checked)}
                disabled={mutation.isPending}
              />
              <MessageSquare className="h-4 w-4" />
              SMS
            </label>
          </div>

          {sendWhatsapp ? (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                WhatsApp template
              </label>
              <select
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                disabled={mutation.isPending || templatesQuery.isLoading}
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              >
                <option value="">
                  {templatesQuery.isLoading
                    ? 'Loading templates…'
                    : approvedTemplates.length
                      ? `Select a ${documentLabel} template`
                      : `No approved ${documentLabel} templates`}
                </option>
                {approvedTemplates.map((template) => (
                  <option
                    key={template.local_id || template.id || template.name}
                    value={template.name}
                  >
                    {template.name}
                    {template.category ? ` · ${template.category}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Shows only templates marked as {isSalesOrder ? 'Sales Order' : 'Purchase Order'}.
                Create more under Promotional → Templates if you need another option.
              </p>
              {templatePreview ? (
                <p className="mt-2 text-xs text-slate-600 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2">
                  {templatePreview}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
              Message
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!canSend}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-brand text-sm font-semibold disabled:opacity-60"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {mutation.isPending ? 'Sending…' : 'Generate PDF & Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
