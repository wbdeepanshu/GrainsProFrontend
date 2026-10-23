import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, MessageSquare, Phone, Send, X } from 'lucide-react'
import { getApiErrorMessage } from '@/hooks/useSuccessPopup'
import { uploadMediaFile } from '@/lib/media_upload_api'
import {
  fetchMessageTemplates,
  getTemplateComponent,
  sendSalesInvoiceMessages,
} from '@/lib/promotional_api'
import { formatCurrency } from '@/lib/dashboardHelpers'
import { gstInvoiceNetTotal } from '@/lib/gstRounding'
import { flattenOutwardDetailItems } from '@/lib/outward_delivery_helpers'
import {
  getGstLineDetail,
  getGstLineDisplayTotal,
} from '@/components/common/GstLinePriceDetail'
import { createDeliveryNotePdfBlob } from '@/utils/deliveryNotePdfGenerator'

function computeItemsGstTotals(items) {
  return items.reduce(
    (acc, item) => {
      const detail = getGstLineDetail(item)
      const lineAmount = Number(item.amount) || 0
      const lineTotal = getGstLineDisplayTotal(item, lineAmount)
      acc.total += lineTotal
      if (detail) {
        acc.taxable += Number(detail.sales_order_price) || 0
        acc.gst += Number(detail.gst_amount) || 0
      } else {
        acc.taxable += lineTotal
      }
      return acc
    },
    { taxable: 0, gst: 0, total: 0 },
  )
}

function computeInvoiceRoundOff(total) {
  const computed = Math.round((Number(total) || 0) * 100) / 100
  const rounded = Math.round(computed)
  return { rounded }
}

function getInvoiceOfferDiscountAmount(detail) {
  return Number(detail?.discount_amount) || 0
}

function formatInvoiceAmount(value) {
  const amount = Number(value) || 0
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isApprovedTemplate(template) {
  return String(template?.status || '').toUpperCase() === 'APPROVED'
}

function looksLikeInvoiceTemplate(template) {
  const name = String(template?.name || '').toLowerCase()
  return name.includes('invoice') || name.startsWith('si_')
}

function getTemplateBodyPreview(template) {
  return String(getTemplateComponent(template, 'BODY')?.text || template?.body_preview || '').trim()
}

export function getSalesInvoiceNotifySummary(detail) {
  const party = detail?.party || detail?.party_info || {}
  const org =
    detail?.organization ||
    detail?.organization_details ||
    detail?.organization_info ||
    {}
  const flatItems = Array.isArray(detail?.items) && detail.items.length
    ? detail.items
    : flattenOutwardDetailItems(detail || {})
  const gstTotals = computeItemsGstTotals(flatItems)
  const overallTotal = gstInvoiceNetTotal(
    gstTotals,
    detail?.total_amount ?? gstTotals.total,
  )
  const { rounded } = computeInvoiceRoundOff(
    Math.max(0, overallTotal - getInvoiceOfferDiscountAmount(detail)),
  )
  const netTotal =
    detail?.net_total_amount != null && detail.net_total_amount !== ''
      ? Number(detail.net_total_amount)
      : rounded

  return {
    customerName:
      party.customer_name ||
      party.name ||
      detail?.party_name ||
      detail?.customer_name ||
      'Customer',
    contact:
      party.whatsapp_number ||
      party.contact_number ||
      '',
    invoiceNumber:
      String(detail?.invoice_number || '').trim() ||
      String(detail?.outward_number || '').trim() ||
      String(detail?.order_id || detail?.so_number || '').trim() ||
      '—',
    date:
      detail?.invoice_date ||
      detail?.outward_date_display ||
      detail?.outward_date ||
      detail?.order_date ||
      '',
    amount: netTotal,
    amountText: formatInvoiceAmount(netTotal),
    companyName: org.name || org.company_name || 'GrainsPro',
  }
}

export function buildSalesInvoiceSmsPreview(summary, url = '') {
  const dated = summary.date ? ` dated ${summary.date}` : ''
  const link = url || '[invoice PDF link]'
  return (
    `Dear ${summary.customerName}, your sales invoice ${summary.invoiceNumber}` +
    `${dated} for Rs.${summary.amountText} is ready. Download: ${link} - ${summary.companyName}`
  )
}

export default function SalesInvoiceNotifyModal({
  open,
  onClose,
  detail,
  branchDetail,
  organizationLogo = '',
  branchDetailLoading = false,
  organizationLogoLoading = false,
  onSuccess,
  onError,
}) {
  const [sendWhatsapp, setSendWhatsapp] = useState(true)
  const [sendSms, setSendSms] = useState(true)
  const [templateName, setTemplateName] = useState('')

  const templatesQuery = useQuery({
    queryKey: ['promotional-message-templates'],
    queryFn: () => fetchMessageTemplates(),
    enabled: open,
    staleTime: 30_000,
  })

  const approvedTemplates = useMemo(
    () => (templatesQuery.data?.templates || []).filter(isApprovedTemplate),
    [templatesQuery.data],
  )

  useEffect(() => {
    if (!open) return
    setTemplateName((current) => {
      if (current && approvedTemplates.some((item) => item.name === current)) {
        return current
      }
      const invoiceMatch = approvedTemplates.find(looksLikeInvoiceTemplate)
      return (invoiceMatch || approvedTemplates[0])?.name || ''
    })
  }, [open, approvedTemplates])

  const selectedTemplate = approvedTemplates.find((item) => item.name === templateName)
  const templatePreview = selectedTemplate ? getTemplateBodyPreview(selectedTemplate) : ''

  const summary = useMemo(
    () => (detail ? getSalesInvoiceNotifySummary(detail) : null),
    [detail],
  )
  const preview = useMemo(
    () => (summary ? buildSalesInvoiceSmsPreview(summary) : ''),
    [summary],
  )

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
      if (!detail) {
        throw new Error('Sales invoice is still loading.')
      }

      const { blob, fileName, blobUrl } = await createDeliveryNotePdfBlob(detail, {
        branchDetail,
        organizationLogo,
      })
      try {
        const file = new File(
          [blob],
          fileName || 'sales-invoice.pdf',
          { type: 'application/pdf' },
        )
        const url = await uploadMediaFile(file, 'sales_invoices')
        return sendSalesInvoiceMessages({
          outward_entry_id:
            detail.outward_entry_id ||
            detail.outward_id ||
            detail.id,
          sales_order_id:
            detail.sales_order_id ||
            detail.sales_order?.sales_order_id ||
            detail.order_id ||
            detail.so_number,
          outward_sales_order_id:
            detail.outward_sales_order_id ||
            detail.sales_order?.outward_sales_order_id,
          url,
          channels,
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
      onError?.(getApiErrorMessage(error, error?.message || 'Failed to notify customer'))
    },
  })

  if (!open) return null

  const busy =
    mutation.isPending ||
    branchDetailLoading ||
    organizationLogoLoading ||
    (sendWhatsapp && templatesQuery.isLoading)
  const canSend =
    Boolean(detail) &&
    (sendWhatsapp || sendSms) &&
    !busy &&
    (!sendWhatsapp || Boolean(templateName))

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="font-semibold text-lg text-slate-900">Notify customer</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Send this sales invoice on WhatsApp and SMS with the PDF link.
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

        <div className="px-5 py-4 space-y-4">
          {summary ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Customer</p>
                <p className="font-medium text-slate-900 break-words">{summary.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Mobile</p>
                <p className="font-medium text-slate-900">{summary.contact || 'Not on ledger'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Invoice No</p>
                <p className="font-medium text-slate-900">{summary.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount</p>
                <p className="font-medium text-slate-900">{formatCurrency(summary.amount)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading invoice details…</p>
          )}

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
                      ? 'Select an approved template'
                      : 'No approved templates for this organization'}
                </option>
                {approvedTemplates.map((template) => (
                  <option key={template.local_id || template.id || template.name} value={template.name}>
                    {template.name}
                    {template.category ? ` · ${template.category}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Only templates you created. Create one under Promotional → Templates
                if this list is empty.
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

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/80">
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
