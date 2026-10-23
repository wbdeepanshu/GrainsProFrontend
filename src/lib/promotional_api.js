import { apiUrl, parseJsonResponse } from '@/lib/api'
import { AuthService } from '@/lib/auth'
import { apiRequest } from '@/lib/queryClient'

/** Where a WhatsApp template is used in the ERP. */
export const TEMPLATE_USE_CASE_OPTIONS = [
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'sales_invoice', label: 'Sales Invoice' },
  { value: 'general', label: 'General / Promotional' },
]

export function getTemplateUseCaseLabel(useCase) {
  const match = TEMPLATE_USE_CASE_OPTIONS.find((item) => item.value === useCase)
  return match?.label || ''
}

/** Default WhatsApp template name generated for each ERP use case. */
export function getDefaultTemplateName(useCase) {
  switch (String(useCase || '').trim()) {
    case 'sales_order':
      return 'so_order_notify'
    case 'purchase_order':
      return 'po_order_notify'
    case 'sales_invoice':
      return 'si_invoice_notify'
    case 'general':
      return 'promo_message'
    default:
      return 'message_template'
  }
}

/**
 * Ready message starters for non-IT create flow.
 * Returns header/body/footer with {{n}} already in place.
 */
export function getReadyTemplateStarter(useCase) {
  const key = String(useCase || '').trim()
  if (key === 'sales_order') {
    return {
      name: 'so_order_notify',
      header_text: 'Sales Order from {{1}}',
      body_text:
        'Dear {{1}},\n\nYour sales order {{2}} dated {{3}} for Rs.{{4}} has been created.\n\nPlease download your order PDF here:\n{{5}}\n\nThank you for your order.',
      footer_text: 'WB Agro Pvt Ltd',
      show_company_header: true,
    }
  }
  if (key === 'purchase_order') {
    return {
      name: 'po_order_notify',
      header_text: 'Purchase Order from {{1}}',
      body_text:
        'Dear {{1}},\n\nPurchase order {{2}} dated {{3}} for Rs.{{4}} has been created.\n\nPlease download your purchase order PDF here:\n{{5}}\n\nThank you.',
      footer_text: 'WB Agro Pvt Ltd',
      show_company_header: true,
    }
  }
  if (key === 'sales_invoice') {
    return {
      name: 'si_invoice_notify',
      header_text: 'Tax Invoice from {{1}}',
      body_text:
        'Dear {{1}},\n\nYour sales invoice {{2}} dated {{3}} for Rs.{{4}} is ready.\n\nPlease download your invoice PDF here:\n{{5}}\n\nThank you for your business.',
      footer_text: 'WB Agro Pvt Ltd',
      show_company_header: true,
    }
  }
  return {
    name: 'promo_message',
    header_text: '',
    body_text: 'Dear {{1}},\n\n{{2}}\n\nThank you.',
    footer_text: 'WB Agro Pvt Ltd',
    show_company_header: false,
  }
}

/** Insert chips shown in the simple create UI. */
export function getTemplateInsertChips(useCase) {
  const key = String(useCase || '').trim()
  if (key === 'purchase_order') {
    return [
      { key: 'party', label: 'Supplier name', token: '{{1}}' },
      { key: 'number', label: 'PO number', token: '{{2}}' },
      { key: 'date', label: 'Date', token: '{{3}}' },
      { key: 'amount', label: 'Amount', token: '{{4}}' },
      { key: 'link', label: 'PDF link', token: '{{5}}' },
    ]
  }
  if (key === 'sales_order') {
    return [
      { key: 'party', label: 'Customer name', token: '{{1}}' },
      { key: 'number', label: 'SO number', token: '{{2}}' },
      { key: 'date', label: 'Date', token: '{{3}}' },
      { key: 'amount', label: 'Amount', token: '{{4}}' },
      { key: 'link', label: 'PDF link', token: '{{5}}' },
    ]
  }
  if (key === 'sales_invoice') {
    return [
      { key: 'party', label: 'Customer name', token: '{{1}}' },
      { key: 'number', label: 'Invoice number', token: '{{2}}' },
      { key: 'date', label: 'Date', token: '{{3}}' },
      { key: 'amount', label: 'Amount', token: '{{4}}' },
      { key: 'link', label: 'PDF link', token: '{{5}}' },
    ]
  }
  return [
    { key: 'party', label: 'Customer name', token: '{{1}}' },
    { key: 'message', label: 'Message detail', token: '{{2}}' },
  ]
}

/** Sample values used for live preview + Meta examples on submit. */
export function getTemplateSampleValues(useCase, companyName = 'WB Agro Pvt Ltd') {
  const company = String(companyName || '').trim() || 'WB Agro Pvt Ltd'
  const today = new Date()
  const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(
    today.getMonth() + 1,
  ).padStart(2, '0')}-${today.getFullYear()}`
  const key = String(useCase || '').trim()

  if (key === 'purchase_order') {
    return {
      company,
      header: [company],
      body: [
        'Supplier Traders',
        'PO-2627-0012',
        dateStr,
        '45,000.00',
        'https://mwbtech.in/MWB-ERP/demo-order.pdf',
      ],
    }
  }
  if (key === 'sales_order') {
    return {
      company,
      header: [company],
      body: [
        'Ramesh Kumar',
        'SO-2627-0033',
        dateStr,
        '12,500.00',
        'https://mwbtech.in/MWB-ERP/demo-order.pdf',
      ],
    }
  }
  if (key === 'sales_invoice') {
    return {
      company,
      header: [company],
      body: [
        'Ramesh Kumar',
        'SI-2026-001',
        dateStr,
        '12,500.00',
        'https://mwbtech.in/MWB-ERP/demo-order.pdf',
      ],
    }
  }
  return {
    company,
    header: [company],
    body: ['Ramesh Kumar', 'Special offer for you this week.'],
  }
}

/**
 * True when the template is tagged for this use case.
 * Legacy rows without use_case still match sales_invoice by name heuristics.
 */
export function isTemplateForUseCase(template, useCase) {
  const tagged = String(template?.use_case || '').trim().toLowerCase()
  const wanted = String(useCase || '').trim().toLowerCase()
  if (!wanted) return true
  if (tagged) return tagged === wanted
  const name = String(template?.name || '').toLowerCase()
  if (wanted === 'sales_invoice') {
    return name.includes('invoice') || name.startsWith('si_')
  }
  if (wanted === 'sales_order') {
    return name.startsWith('so_') || name.includes('sales_order') || name.includes('so_order')
  }
  if (wanted === 'purchase_order') {
    return name.startsWith('po_') || name.includes('purchase_order') || name.includes('po_order')
  }
  return false
}

/**
 * Fetch WhatsApp / Samb message templates via promotionalApp proxy.
 * GET /api/promotional/message-templates/
 */
export async function fetchMessageTemplates(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.append(key, String(value))
    }
  })
  const query = search.toString()
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/promotional/message-templates/${query ? `?${query}` : ''}`),
  )
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to fetch message templates')
  }
  return {
    templates: Array.isArray(result.data) ? result.data : [],
    total_count: result.total_count ?? (Array.isArray(result.data) ? result.data.length : 0),
    paging: result.paging ?? null,
    message: result.message,
  }
}

/**
 * Create / submit a WhatsApp message template for approval.
 * POST /api/promotional/message-templates/create/
 */
export async function createMessageTemplate(payload) {
  try {
    const res = await apiRequest('POST', apiUrl('/api/promotional/message-templates/create/'), payload)
    const result = await parseJsonResponse(res)
    if (result.status && Number(result.status) >= 400) {
      const detail =
        result.error?.error_user_msg ||
        result.error?.message ||
        result.errors?.[0]?.message ||
        (typeof result.error === 'string' ? result.error : '') ||
        (Array.isArray(result.data) ? result.data.map((row) => row?.message).filter(Boolean).join(' ') : '') ||
        result.message ||
        'Failed to create message template'
      const err = new Error(detail)
      err.result = result
      throw err
    }
    return result
  } catch (error) {
    if (error?.result || error?.payload) throw error
    const payloadBody = error?.payload
    if (payloadBody) {
      const detail =
        payloadBody.error?.error_user_msg ||
        payloadBody.error?.message ||
        payloadBody.message ||
        error.message
      const err = new Error(detail || 'Failed to create message template')
      err.result = payloadBody
      err.payload = payloadBody
      throw err
    }
    throw error
  }
}

/**
 * Delete a WhatsApp message template by name.
 * DELETE /api/promotional/message-templates/delete/
 * Body: { name: "template_name" }
 */
export async function deleteMessageTemplate({ name }) {
  const templateName = String(name || '').trim()
  if (!templateName) {
    throw new Error('Template name is required to delete')
  }
  try {
    const res = await apiRequest('DELETE', apiUrl('/api/promotional/message-templates/delete/'), {
      name: templateName,
    })
    const result = await parseJsonResponse(res)
    if (result.status && Number(result.status) >= 400) {
      const err = new Error(result.message || 'Failed to delete message template')
      err.result = result
      throw err
    }
    return result
  } catch (error) {
    if (error?.result || error?.payload) throw error
    const payloadBody = error?.payload
    if (payloadBody) {
      const detail =
        payloadBody.error?.error_user_msg ||
        payloadBody.error?.message ||
        payloadBody.message ||
        error.message
      const err = new Error(detail || 'Failed to delete message template')
      err.result = payloadBody
      err.payload = payloadBody
      throw err
    }
    throw error
  }
}

/**
 * Edit / update a WhatsApp message template.
 * PUT /api/promotional/message-templates/edit/
 *
 * Sample body:
 * {
 *   name, category, body_text, body_examples?, footer_text?,
 *   buttons?: [
 *     { type: "URL", text, url, example?: ["sample"] },
 *     { type: "PHONE_NUMBER", text, phone_number: "917022261919" }
 *   ]
 * }
 */
export async function editMessageTemplate(payload) {
  try {
    const res = await apiRequest('PUT', apiUrl('/api/promotional/message-templates/edit/'), payload)
    const result = await parseJsonResponse(res)
    if (result.status && Number(result.status) >= 400) {
      const detail =
        result.error?.error_user_msg ||
        result.error?.message ||
        result.errors?.[0]?.message ||
        (typeof result.error === 'string' ? result.error : '') ||
        (Array.isArray(result.data) ? result.data.map((row) => row?.message).filter(Boolean).join(' ') : '') ||
        result.message ||
        'Failed to edit message template'
      const err = new Error(detail)
      err.result = result
      throw err
    }
    return result
  } catch (error) {
    if (error?.result || error?.payload) throw error
    const payloadBody = error?.payload
    if (payloadBody) {
      const detail =
        payloadBody.error?.error_user_msg ||
        payloadBody.error?.message ||
        payloadBody.message ||
        error.message
      const err = new Error(detail || 'Failed to edit message template')
      err.result = payloadBody
      err.payload = payloadBody
      throw err
    }
    throw error
  }
}

/**
 * Send WhatsApp template messages to one or more recipients.
 * POST /api/promotional/send-messages/
 */
export async function sendPromotionalMessages(payload) {
  const res = await apiRequest('POST', apiUrl('/api/promotional/send-messages/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to send promotional messages')
    err.result = result
    throw err
  }
  return result
}

/**
 * Send WhatsApp messages with an image header.
 * POST /api/promotional/send-image-messages/
 *
 * Accepts either:
 * - JSON: { image_url, template_name, recipients, ... }
 * - { imageFile, template_name, recipients, ... } → multipart FormData
 * - FormData instance
 */
export async function sendPromotionalImageMessages(payload) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
  const hasFile =
    !isFormData &&
    payload &&
    typeof payload === 'object' &&
    (payload.imageFile instanceof Blob || payload.image instanceof Blob)

  let res
  if (isFormData || hasFile) {
    let formData = payload
    if (!isFormData) {
      formData = new FormData()
      const file = payload.imageFile || payload.image
      const fileName =
        file instanceof File && file.name ? file.name : `promotional-${Date.now()}.jpg`
      formData.append('image', file, fileName)
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'imageFile' || key === 'image' || value === undefined || value === null) return
        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value))
        } else {
          formData.append(key, String(value))
        }
      })
    }

    const headers = { ...AuthService.getAuthHeaders() }
    delete headers['Content-Type']

    res = await fetch(apiUrl('/api/promotional/send-image-messages/'), {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    })

    if (res.status === 401) {
      AuthService.clearAuthData()
      throw new Error('Session expired. Please sign in again.')
    }
  } else {
    res = await apiRequest('POST', apiUrl('/api/promotional/send-image-messages/'), payload)
  }

  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to send promotional image messages')
    err.result = result
    throw err
  }
  if (!res.ok) {
    throw new Error(result.message || 'Failed to send promotional image messages')
  }
  return result
}

/**
 * Send promotional / notification emails to one or more recipients.
 * POST /api/promotional/send-emails/
 */
export async function sendPromotionalEmails(payload) {
  const res = await apiRequest('POST', apiUrl('/api/promotional/send-emails/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to send promotional emails')
    err.result = result
    throw err
  }
  return result
}

/**
 * Send promotional SMS notifications to one or more recipients.
 * POST /api/promotional/send-sms/
 */
export async function sendPromotionalSms(payload) {
  const res = await apiRequest('POST', apiUrl('/api/promotional/send-sms/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to send promotional SMS')
    err.result = result
    throw err
  }
  return result
}

/**
 * Send sales-invoice WhatsApp / SMS with the uploaded PDF link.
 * POST /api/promotional/send-invoice/
 */
export async function sendSalesInvoiceMessages(payload) {
  const res = await apiRequest('POST', apiUrl('/api/promotional/send-invoice/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to send sales invoice messages')
    err.result = result
    throw err
  }
  return result
}

/**
 * Send sales-order or purchase-order WhatsApp / SMS with the uploaded PDF link.
 * POST /api/promotional/send-order/
 */
export async function sendOrderMessages(payload) {
  const res = await apiRequest('POST', apiUrl('/api/promotional/send-order/'), payload)
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to send order messages')
    err.result = result
    throw err
  }
  return result
}

export const MIN_CAROUSEL_CARDS = 2
export const MAX_CAROUSEL_CARDS = 10

/** Cards from a WhatsApp CAROUSEL template component (creation/list shape). */
export function getCarouselCards(template) {
  const components = Array.isArray(template?.components) ? template.components : []
  const carousel = components.find(
    (item) => String(item?.type || '').toUpperCase() === 'CAROUSEL',
  )
  return Array.isArray(carousel?.cards) ? carousel.cards : []
}

/**
 * Create a WhatsApp carousel template for Meta approval.
 * POST /api/promotional/carousel-templates/create/
 */
export async function createCarouselTemplate(payload) {
  const res = await apiRequest(
    'POST',
    apiUrl('/api/promotional/carousel-templates/create/'),
    payload,
  )
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to create carousel template')
    err.result = result
    throw err
  }
  return result
}

/**
 * Send an approved carousel template to recipients.
 * POST /api/promotional/send-carousel-messages/
 */
export async function sendCarouselMessages(payload) {
  const res = await apiRequest(
    'POST',
    apiUrl('/api/promotional/send-carousel-messages/'),
    payload,
  )
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    const err = new Error(result.message || 'Failed to send carousel messages')
    err.result = result
    throw err
  }
  return result
}

/**
 * List promotional send-history campaigns.
 * GET /api/promotional/campaigns/
 */
export async function fetchPromotionalCampaigns(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.append(key, String(value))
    }
  })
  const query = search.toString()
  const res = await apiRequest(
    'GET',
    apiUrl(`/api/promotional/campaigns/${query ? `?${query}` : ''}`),
  )
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to fetch promotional campaigns')
  }
  return {
    campaigns: Array.isArray(result.data) ? result.data : [],
    summary: result.summary || null,
    total_count: result.total_count ?? (Array.isArray(result.data) ? result.data.length : 0),
    message: result.message,
  }
}

/**
 * Fetch one promotional campaign with recipient results.
 * GET /api/promotional/campaigns/:id/
 */
export async function fetchPromotionalCampaign(campaignId) {
  const res = await apiRequest('GET', apiUrl(`/api/promotional/campaigns/${campaignId}/`))
  const result = await parseJsonResponse(res)
  if (result.status && Number(result.status) >= 400) {
    throw new Error(result.message || 'Failed to fetch promotional campaign')
  }
  return result.data || result
}

/** Extract positional placeholders like {{1}} from a template component text. */
export function extractTemplatePlaceholders(text) {
  const matches = String(text || '').matchAll(/\{\{(\d+)\}\}/g)
  const indexes = new Set()
  for (const match of matches) {
    indexes.add(Number(match[1]))
  }
  return Array.from(indexes).sort((a, b) => a - b)
}

export function getTemplateComponent(template, type) {
  return (template?.components || []).find(
    (item) => String(item?.type || '').toUpperCase() === String(type).toUpperCase(),
  )
}

/**
 * Build WhatsApp template components payload from filled parameter maps.
 * headerParams / bodyParams: { 1: 'value', 2: 'value' }
 */
export function buildTemplateComponentsPayload(template, { headerParams = {}, bodyParams = {} } = {}) {
  const components = []
  const header = getTemplateComponent(template, 'HEADER')
  if (header && String(header.format || '').toUpperCase() === 'TEXT') {
    const indexes = extractTemplatePlaceholders(header.text)
    if (indexes.length) {
      components.push({
        type: 'header',
        parameters: indexes.map((index) => ({
          type: 'text',
          text: String(headerParams[index] ?? '').trim(),
        })),
      })
    }
  }

  const body = getTemplateComponent(template, 'BODY')
  if (body) {
    const indexes = extractTemplatePlaceholders(body.text)
    if (indexes.length) {
      components.push({
        type: 'body',
        parameters: indexes.map((index) => ({
          type: 'text',
          text: String(bodyParams[index] ?? '').trim(),
        })),
      })
    }
  }

  return components
}
