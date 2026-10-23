import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  LayoutTemplate,
  List,
  Loader2,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import Loader from '@/components/common/Loader'
import AppPageShell from '@/components/layout/AppPageShell'
import PageHeader from '@/components/layout/PageHeader'
import WhatsAppTemplatePreview from '@/components/whatsapp/WhatsAppTemplatePreview'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { uploadMediaFile } from '@/lib/media_upload_api'
import {
  createMessageTemplate,
  buildTemplateComponentsPayload,
  deleteMessageTemplate,
  editMessageTemplate,
  extractTemplatePlaceholders,
  fetchMessageTemplates,
  getDefaultTemplateName,
  getReadyTemplateStarter,
  getTemplateInsertChips,
  getTemplateSampleValues,
  getTemplateUseCaseLabel,
  sendPromotionalImageMessages,
  sendPromotionalMessages,
  TEMPLATE_USE_CASE_OPTIONS,
} from '@/lib/promotional_api'

const searchInputClass =
  'w-full h-11 pl-10 pr-9 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const fieldClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'
const fieldClassLowercase =
  'w-full px-3 py-2.5 lowercase  border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const CATEGORY_OPTIONS = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
]

const LANGUAGE_OPTIONS = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
]

const BUTTON_TYPE_OPTIONS = [
  { value: 'URL', label: 'Visit website (URL)' },
  { value: 'PHONE_NUMBER', label: 'Call phone' },
  { value: 'QUICK_REPLY', label: 'Quick reply' },
]

const MAX_TEMPLATE_BUTTONS = 2

const BULLET_SYMBOLS = [
  { symbol: '•', label: 'Bullet' },
  { symbol: '◦', label: 'White bullet' },
  { symbol: '▪', label: 'Square' },
  { symbol: '▫', label: 'White square' },
  { symbol: '–', label: 'En dash' },
  { symbol: '—', label: 'Em dash' },
  { symbol: '→', label: 'Arrow' },
  { symbol: '✓', label: 'Check' },
  { symbol: '✔', label: 'Heavy check' },
  { symbol: '★', label: 'Star' },
  { symbol: '☆', label: 'Hollow star' },
  { symbol: '◆', label: 'Diamond' },
  { symbol: '○', label: 'Circle' },
  { symbol: '●', label: 'Filled circle' },
  { symbol: '①', label: 'Circled 1' },
  { symbol: '②', label: 'Circled 2' },
  { symbol: '③', label: 'Circled 3' },
  { symbol: '※', label: 'Reference' },
  { symbol: '»', label: 'Guillemet' },
  { symbol: '›', label: 'Single angle' },
]

const EMOJI_CATALOG = [
  { emoji: '😀', keywords: 'grin smiling happy face' },
  { emoji: '😃', keywords: 'smile happy open mouth' },
  { emoji: '😄', keywords: 'smile happy eyes' },
  { emoji: '😁', keywords: 'beaming grin teeth' },
  { emoji: '😆', keywords: 'laughing squinting' },
  { emoji: '😅', keywords: 'sweat smile relief' },
  { emoji: '🤣', keywords: 'rofl rolling laughing' },
  { emoji: '😂', keywords: 'tears joy laughing cry' },
  { emoji: '🙂', keywords: 'slight smile' },
  { emoji: '😉', keywords: 'wink' },
  { emoji: '😊', keywords: 'blush smile happy' },
  { emoji: '😇', keywords: 'angel halo innocent' },
  { emoji: '🥰', keywords: 'love hearts smile' },
  { emoji: '😍', keywords: 'heart eyes love' },
  { emoji: '🤩', keywords: 'star struck wow' },
  { emoji: '😘', keywords: 'kiss blow' },
  { emoji: '😗', keywords: 'kissing' },
  { emoji: '😋', keywords: 'yum tasty delicious' },
  { emoji: '😛', keywords: 'tongue' },
  { emoji: '😜', keywords: 'wink tongue playful' },
  { emoji: '🤪', keywords: 'zany crazy' },
  { emoji: '😝', keywords: 'squint tongue' },
  { emoji: '🤑', keywords: 'money rich dollar' },
  { emoji: '🤗', keywords: 'hug' },
  { emoji: '🤔', keywords: 'thinking ponder' },
  { emoji: '🤨', keywords: 'raised eyebrow' },
  { emoji: '😐', keywords: 'neutral' },
  { emoji: '😑', keywords: 'expressionless' },
  { emoji: '😶', keywords: 'no mouth silent' },
  { emoji: '🙄', keywords: 'eye roll' },
  { emoji: '😏', keywords: 'smirk' },
  { emoji: '😣', keywords: 'persevering' },
  { emoji: '😥', keywords: 'sad relief' },
  { emoji: '😮', keywords: 'open mouth surprised' },
  { emoji: '😯', keywords: 'hushed surprised' },
  { emoji: '😲', keywords: 'astonished shocked' },
  { emoji: '😳', keywords: 'flushed embarrassed' },
  { emoji: '🥺', keywords: 'pleading puppy eyes' },
  { emoji: '😢', keywords: 'cry sad tear' },
  { emoji: '😭', keywords: 'sobbing cry loud' },
  { emoji: '😤', keywords: 'triumph steam angry' },
  { emoji: '😠', keywords: 'angry mad' },
  { emoji: '😡', keywords: 'rage pouting' },
  { emoji: '🤬', keywords: 'cursing swearing' },
  { emoji: '😈', keywords: 'devil smile' },
  { emoji: '💀', keywords: 'skull dead' },
  { emoji: '💩', keywords: 'poop' },
  { emoji: '🤡', keywords: 'clown' },
  { emoji: '👻', keywords: 'ghost' },
  { emoji: '👽', keywords: 'alien' },
  { emoji: '🤖', keywords: 'robot' },
  { emoji: '👋', keywords: 'wave hello hi bye' },
  { emoji: '🤚', keywords: 'raised hand' },
  { emoji: '✋', keywords: 'stop hand' },
  { emoji: '👌', keywords: 'ok okay' },
  { emoji: '✌️', keywords: 'peace victory' },
  { emoji: '🤞', keywords: 'fingers crossed luck' },
  { emoji: '🤟', keywords: 'love you gesture' },
  { emoji: '🤘', keywords: 'rock on' },
  { emoji: '👍', keywords: 'thumbs up like yes' },
  { emoji: '👎', keywords: 'thumbs down dislike no' },
  { emoji: '👏', keywords: 'clap applause' },
  { emoji: '🙌', keywords: 'raising hands celebrate' },
  { emoji: '🙏', keywords: 'pray thanks please namaste' },
  { emoji: '💪', keywords: 'muscle strong flex' },
  { emoji: '❤️', keywords: 'red heart love' },
  { emoji: '🧡', keywords: 'orange heart' },
  { emoji: '💛', keywords: 'yellow heart' },
  { emoji: '💚', keywords: 'green heart' },
  { emoji: '💙', keywords: 'blue heart' },
  { emoji: '💜', keywords: 'purple heart' },
  { emoji: '🖤', keywords: 'black heart' },
  { emoji: '💕', keywords: 'two hearts' },
  { emoji: '💞', keywords: 'revolving hearts' },
  { emoji: '💖', keywords: 'sparkling heart' },
  { emoji: '💗', keywords: 'growing heart' },
  { emoji: '💘', keywords: 'heart arrow' },
  { emoji: '💝', keywords: 'gift heart' },
  { emoji: '✨', keywords: 'sparkles shine' },
  { emoji: '⭐', keywords: 'star' },
  { emoji: '🌟', keywords: 'glowing star' },
  { emoji: '💫', keywords: 'dizzy' },
  { emoji: '🔥', keywords: 'fire hot lit' },
  { emoji: '💯', keywords: 'hundred score' },
  { emoji: '🎉', keywords: 'party popper celebrate' },
  { emoji: '🎊', keywords: 'confetti' },
  { emoji: '🎈', keywords: 'balloon' },
  { emoji: '🎁', keywords: 'gift present' },
  { emoji: '🏆', keywords: 'trophy win' },
  { emoji: '🥇', keywords: 'gold medal first' },
  { emoji: '🎯', keywords: 'target bullseye' },
  { emoji: '📢', keywords: 'megaphone announce' },
  { emoji: '📣', keywords: 'cheering megaphone' },
  { emoji: '🔔', keywords: 'bell notification' },
  { emoji: '💡', keywords: 'bulb idea' },
  { emoji: '📌', keywords: 'pin' },
  { emoji: '📍', keywords: 'location pin' },
  { emoji: '📎', keywords: 'paperclip attach' },
  { emoji: '🔗', keywords: 'link' },
  { emoji: '📦', keywords: 'package box delivery' },
  { emoji: '🚚', keywords: 'truck delivery' },
  { emoji: '🛍️', keywords: 'shopping bags' },
  { emoji: '🛒', keywords: 'cart shopping' },
  { emoji: '💳', keywords: 'credit card payment' },
  { emoji: '💵', keywords: 'dollar money cash' },
  { emoji: '💰', keywords: 'money bag' },
  { emoji: '🧾', keywords: 'receipt invoice bill' },
  { emoji: '📄', keywords: 'document page' },
  { emoji: '📋', keywords: 'clipboard' },
  { emoji: '✅', keywords: 'check mark done' },
  { emoji: '❌', keywords: 'cross mark no' },
  { emoji: '⚠️', keywords: 'warning caution' },
  { emoji: '❗', keywords: 'exclamation' },
  { emoji: '❓', keywords: 'question' },
  { emoji: '☀️', keywords: 'sun sunny' },
  { emoji: '🌙', keywords: 'moon night' },
  { emoji: '☕', keywords: 'coffee tea cup' },
  { emoji: '🍵', keywords: 'tea green' },
  { emoji: '🍕', keywords: 'pizza food' },
  { emoji: '🍔', keywords: 'burger food' },
  { emoji: '🥗', keywords: 'salad healthy' },
  { emoji: '🍎', keywords: 'apple fruit' },
  { emoji: '🌾', keywords: 'grain crop agro farm' },
  { emoji: '🌿', keywords: 'herb leaf plant' },
  { emoji: '🌱', keywords: 'seedling plant grow' },
  { emoji: '🏡', keywords: 'house home' },
  { emoji: '🏢', keywords: 'office building' },
  { emoji: '🏪', keywords: 'store shop' },
  { emoji: '📞', keywords: 'phone call telephone' },
  { emoji: '📱', keywords: 'mobile phone' },
  { emoji: '💬', keywords: 'speech bubble chat' },
  { emoji: '🕐', keywords: 'clock time' },
  { emoji: '📅', keywords: 'calendar date' },
  { emoji: '🛵', keywords: 'scooter delivery' },
  { emoji: '🚗', keywords: 'car' },
]

const USE_CASE_CARD_HINTS = {
  sales_order: 'Send when a sales order is ready',
  purchase_order: 'Send when a purchase order is ready',
  sales_invoice: 'Send when a sales invoice PDF is ready',
  general: 'Offers, greetings, and other messages',
}

function buildCreateFormFromUseCase(useCase = 'sales_invoice', companyName = 'WB Agro Pvt Ltd') {
  const starter = getReadyTemplateStarter(useCase)
  const company = String(companyName || '').trim() || 'WB Agro Pvt Ltd'
  return {
    name: starter.name || getDefaultTemplateName(useCase),
    use_case: useCase,
    category: 'UTILITY',
    language: 'en_US',
    allow_category_change: true,
    show_company_header: Boolean(starter.show_company_header),
    company_name: company,
    header_type: starter.show_company_header ? 'text' : 'none',
    header_text: starter.header_text || '',
    header_image_url: '',
    header_document_url: '',
    body_text: starter.body_text || '',
    footer_text: company,
    header_examples: {},
    body_examples: {},
    buttons: [],
  }
}

const emptyCreateForm = () => buildCreateFormFromUseCase('sales_invoice')

function emptyTemplateButton() {
  return {
    key: `btn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'URL',
    text: 'Visit website',
    url: 'https://',
    url_example: '',
    phone_number: '',
  }
}

function examplesArrayToMap(text, examples = []) {
  const map = {}
  const indexes = extractTemplatePlaceholders(text)
  indexes.forEach((index, i) => {
    const value = String(examples[i] ?? '').trim()
    if (value) map[index] = value
  })
  return map
}

function phoneForFormInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length > 10) return digits.slice(-10)
  return digits
}

/** Prefill create/edit form from an existing WhatsApp template. */
function buildFormFromTemplate(template) {
  const header = getComponent(template, 'HEADER')
  const body = getComponent(template, 'BODY')
  const footer = getComponent(template, 'FOOTER')
  const buttons = getButtons(template)
  const format = String(header?.format || '').toUpperCase()
  const headerText = String(header?.text || '').trim()
  const bodyText = String(body?.text || template?.body_preview || '').trim()
  const footerText = String(footer?.text || '').trim()
  const company = footerText || 'WB Agro Pvt Ltd'

  let header_type = 'none'
  let header_image_url = ''
  let header_document_url = ''
  let show_company_header = false

  if (format === 'IMAGE') {
    header_type = 'image'
    const handles = header?.example?.header_handle
    header_image_url = Array.isArray(handles) && handles[0] ? String(handles[0]) : ''
  } else if (format === 'DOCUMENT') {
    header_type = 'document'
    const handles = header?.example?.header_handle
    header_document_url = Array.isArray(handles) && handles[0] ? String(handles[0]) : ''
  } else if (headerText) {
    header_type = 'text'
    show_company_header = headerText.includes('{{')
  }

  const useCase =
    TEMPLATE_USE_CASE_OPTIONS.some((opt) => opt.value === template?.use_case)
      ? template.use_case
      : 'general'

  return {
    name: String(template?.name || '').trim(),
    use_case: useCase,
    category: String(template?.category || 'UTILITY').toUpperCase() || 'UTILITY',
    language: template?.language || 'en_US',
    allow_category_change: template?.allow_category_change ?? true,
    show_company_header,
    company_name: company,
    header_type,
    header_text: headerText,
    header_image_url,
    header_document_url,
    body_text: bodyText,
    footer_text: footerText || company,
    header_examples: examplesArrayToMap(headerText, getComponentExamples(header)),
    body_examples: examplesArrayToMap(bodyText, getComponentExamples(body)),
    buttons: buttons.slice(0, MAX_TEMPLATE_BUTTONS).map((button, index) => {
      const type = String(button?.type || 'QUICK_REPLY').toUpperCase()
      const urlExample = Array.isArray(button?.example)
        ? String(button.example[0] || '')
        : String(button?.example || '')
      return {
        key: `edit-btn-${index}-${Date.now()}`,
        type: ['URL', 'PHONE_NUMBER', 'QUICK_REPLY'].includes(type) ? type : 'QUICK_REPLY',
        text: String(button?.text || ''),
        url: String(button?.url || 'https://'),
        url_example: urlExample,
        phone_number: phoneForFormInput(button?.phone_number),
      }
    }),
  }
}

function normalizeTemplateButtonsForPayload(buttons = [], { forEdit = false } = {}) {
  return (Array.isArray(buttons) ? buttons : [])
    .map((button) => {
      const type = String(button?.type || 'QUICK_REPLY').toUpperCase()
      const text = String(button?.text || '').trim()
      if (!text) return null
      if (type === 'URL') {
        const url = String(button?.url || '').trim()
        if (!url || url === 'https://') return null
        const row = { type: 'URL', text, url }
        const urlPlaceholders = extractTemplatePlaceholders(url)
        if (urlPlaceholders.length) {
          const example = String(button?.url_example || '').trim()
          if (example) row.example = [example]
        }
        return row
      }
      if (type === 'PHONE_NUMBER') {
        const e164 = normalizeWhatsAppPhoneNumber(button?.phone_number)
        if (!e164) return null
        // Edit API expects digits with country code (no +), e.g. 917022261919
        const phone_number = forEdit ? e164.replace(/^\+/, '') : e164
        return { type: 'PHONE_NUMBER', text, phone_number }
      }
      return { type: 'QUICK_REPLY', text }
    })
    .filter(Boolean)
    .slice(0, MAX_TEMPLATE_BUTTONS)
}

/** WhatsApp CTA phones must be E.164, e.g. +917022261919. */
function normalizeWhatsAppPhoneNumber(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const hasPlus = text.startsWith('+')
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  if (hasPlus) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return `+${digits}`
}

function isValidWhatsAppPhoneNumber(phone) {
  return /^\+[1-9]\d{7,14}$/.test(String(phone || '').trim())
}

function extractTemplateCreateError(err) {
  const payload = err?.payload || err?.result || {}
  const nestedError = payload?.error
  const candidates = [
    nestedError?.error_user_msg,
    nestedError?.message,
    nestedError?.error_data?.details,
    typeof nestedError === 'string' ? nestedError : '',
    payload?.errors?.[0]?.message,
    Array.isArray(payload?.data)
      ? payload.data.map((row) => row?.message).filter(Boolean).join(' ')
      : '',
    payload?.message,
    err?.message,
  ]
  for (const value of candidates) {
    const text = String(value || '').trim()
    if (text) return text
  }
  return 'Failed to create template'
}

function humanizeTemplateCreateError(message) {
  const text = String(message || '').trim()
  if (/phone_number.*not a valid phone number/i.test(text) || /#192/.test(text)) {
    return 'Call button phone number is invalid. Use country code format like +917022261919.'
  }
  if (/url.*not a valid/i.test(text)) {
    return 'Website button URL is invalid. Use a full URL like https://example.com.'
  }
  return text || 'Failed to create template'
}

function EmojiPickerPanel({ onPick, onClose }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return EMOJI_CATALOG
    return EMOJI_CATALOG.filter(
      (item) => item.emoji.includes(q) || item.keywords.includes(q),
    )
  }, [query])

  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-[min(100%,22rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-slate-700">Emojis</p>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close emoji picker"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emojis…"
          className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-y-auto grid grid-cols-8 gap-1">
        {filtered.map((item) => (
          <button
            key={`${item.emoji}-${item.keywords}`}
            type="button"
            title={item.keywords}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item.emoji)}
            className="h-8 w-8 rounded-md text-lg leading-none hover:bg-slate-100"
          >
            {item.emoji}
          </button>
        ))}
        {!filtered.length ? (
          <p className="col-span-8 text-center text-xs text-slate-500 py-4">No emojis found</p>
        ) : null}
      </div>
    </div>
  )
}

function BulletPickerPanel({ onPick, onClose }) {
  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-slate-700">Bullets & symbols</p>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close symbol picker"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {BULLET_SYMBOLS.map((item) => (
          <button
            key={item.symbol}
            type="button"
            title={item.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item.symbol)}
            className="h-9 rounded-md border border-slate-100 text-base text-slate-800 hover:bg-slate-50 hover:border-slate-200"
          >
            {item.symbol}
          </button>
        ))}
      </div>
    </div>
  )
}

const HEADER_TYPE_OPTIONS = [
  { value: 'none', label: 'No header' },
  { value: 'text', label: 'Text header' },
  { value: 'image', label: 'Image header' },
  { value: 'document', label: 'Document header (PDF)' },
]


function statusTone(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 'PENDING' || value === 'IN_APPEAL') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (value === 'REJECTED' || value === 'DISABLED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function getComponent(template, type) {
  return (template?.components || []).find(
    (item) => String(item?.type || '').toUpperCase() === String(type).toUpperCase(),
  )
}

function getHeaderImageUrl(template) {
  const header = getComponent(template, 'HEADER')
  if (!header) return null
  if (String(header.format || '').toUpperCase() !== 'IMAGE') return null
  const handles = header.example?.header_handle
  if (Array.isArray(handles) && handles[0]) return String(handles[0])
  return null
}

function getBodyText(template) {
  return getComponent(template, 'BODY')?.text || template?.body_preview || ''
}

function getFooterText(template) {
  return getComponent(template, 'FOOTER')?.text || ''
}

function getButtons(template) {
  const buttons = getComponent(template, 'BUTTONS')?.buttons
  return Array.isArray(buttons) ? buttons : []
}

const DEMO_HEADER_VALUES = ['WB Agro Products Pvt Ltd', 'Bengaluru', '09-09-2026']
const DEMO_BODY_VALUES = [
  'Ramesh Kumar',
  'SO-2627-0033',
  '09-09-2026',
  '12,500.00',
  'https://mwbtech.in/MWB-ERP/demo-order.pdf',
]

function getComponentExamples(component) {
  const example = component?.example
  if (!example) return []
  if (Array.isArray(example.header_text)) return example.header_text
  if (Array.isArray(example.body_text?.[0])) return example.body_text[0]
  return []
}

/** Sample values for {{1}}, {{2}}… — template examples first, then demo data. */
function buildDemoValues(component, fallbacks) {
  const indexes = extractTemplatePlaceholders(component?.text)
  if (!indexes.length) return null

  const examples = getComponentExamples(component)
  const maxIndex = Math.max(...indexes)
  return Array.from({ length: maxIndex }, (_, slot) => {
    const example = String(examples[slot] ?? '').trim()
    if (example) return example
    return fallbacks[slot] || `Demo ${slot + 1}`
  })
}

/** Text template params for a live test send (header/body arrays → Samb components). */
function buildDemoComponents(template, headerValues, bodyValues) {
  const components = []
  const header = getComponent(template, 'HEADER')
  if (header && String(header.format || '').toUpperCase() === 'TEXT' && headerValues?.length) {
    components.push({
      type: 'header',
      parameters: headerValues.map((value) => ({ type: 'text', text: String(value) })),
    })
  }
  if (bodyValues?.length) {
    components.push({
      type: 'body',
      parameters: bodyValues.map((value) => ({ type: 'text', text: String(value) })),
    })
  }
  return components
}

function TemplateDemoModal({ template, onClose }) {
  const emptyRecipient = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mobile: '',
    name: '',
  })

  const [recipients, setRecipients] = useState(() => [emptyRecipient()])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')
  const [documentFilename, setDocumentFilename] = useState('document.pdf')
  const [documentUploading, setDocumentUploading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [sendResults, setSendResults] = useState([])

  const header = getComponent(template, 'HEADER')
  const body = getComponent(template, 'BODY')
  const headerFormat = String(header?.format || '').toUpperCase()
  const isImageTemplate = headerFormat === 'IMAGE'
  const isDocumentTemplate = headerFormat === 'DOCUMENT'
  const isApproved = String(template?.status || '').toUpperCase() === 'APPROVED'

  useEffect(() => {
    setRecipients([emptyRecipient()])
    setImageFile(null)
    setImagePreview('')
    setDocumentUrl('')
    setDocumentFilename('document.pdf')
    setDocumentUploading(false)
    setFeedback(null)
    setSendResults([])
  }, [template?.id, template?.name])

  // Object URLs must be released or the blob stays in memory for the session.
  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return undefined
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const headerValues = useMemo(
    () => buildDemoValues(header, DEMO_HEADER_VALUES),
    [header],
  )
  const bodyValues = useMemo(() => buildDemoValues(body, DEMO_BODY_VALUES), [body])

  const bodyParamsMap = useMemo(() => {
    if (!bodyValues?.length) return {}
    const map = {}
    bodyValues.forEach((value, index) => {
      map[index + 1] = value
    })
    return map
  }, [bodyValues])

  // Show the picked image inside the preview instead of the Samb sample.
  const displayTemplate = useMemo(() => {
    if (!template || !imagePreview) return template
    return {
      ...template,
      components: (template.components || []).map((component) =>
        String(component.type || '').toUpperCase() === 'HEADER' &&
          String(component.format || '').toUpperCase() === 'IMAGE'
          ? { ...component, example: { ...(component.example || {}), header_handle: [imagePreview] } }
          : component,
      ),
    }
  }, [template, imagePreview])

  const updateRecipient = (key, field, value) => {
    setRecipients((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    )
  }

  const addRecipient = () => {
    setRecipients((prev) => [...prev, emptyRecipient()])
  }

  const removeRecipient = (key) => {
    setRecipients((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)))
  }

  const sendMutation = useMutation({
    mutationFn: (payload) =>
      payload.kind === 'image'
        ? sendPromotionalImageMessages(payload.body)
        : sendPromotionalMessages(payload.body),
    onSuccess: (result) => {
      const rows = Array.isArray(result?.data) ? result.data : []
      setSendResults(rows)
      const sent = rows.filter((row) => String(row?.status || '').toLowerCase() === 'sent').length
      const failed = rows.filter((row) => String(row?.status || '').toLowerCase() === 'failed').length
      const skipped = rows.filter((row) => String(row?.status || '').toLowerCase() === 'skipped').length
      const firstFail = rows.find((row) => String(row?.status || '').toLowerCase() !== 'sent')
      const detail =
        (typeof firstFail?.details === 'string' && firstFail.details) ||
        (firstFail?.details && JSON.stringify(firstFail.details)) ||
        ''
      if (sent > 0 && failed === 0 && skipped === 0) {
        setFeedback({
          type: 'success',
          text: `Sent to ${sent} recipient${sent === 1 ? '' : 's'}`,
        })
        return
      }
      setFeedback({
        type: failed > 0 || sent === 0 ? 'error' : 'success',
        text:
          result?.message ||
          [firstFail?.message, detail].filter(Boolean).join(' — ') ||
          `Completed: ${sent} sent, ${failed} failed, ${skipped} skipped`,
      })
    },
    onError: (error) => {
      const rows = Array.isArray(error?.result?.data) ? error.result.data : []
      if (rows.length) setSendResults(rows)
      const row = rows[0] || null
      const detail =
        (typeof row?.details === 'string' && row.details) ||
        (row?.details && JSON.stringify(row.details)) ||
        ''
      const reason = [row?.message, detail, error.message].filter(Boolean).join(' — ')
      setFeedback({
        type: 'error',
        text: reason || 'Failed to send test message',
      })
    },
  })

  if (!template) return null

  const handleSendTest = () => {
    setFeedback(null)
    setSendResults([])

    const parsed = []
    for (const row of recipients) {
      const digits = String(row.mobile || '').replace(/\D+/g, '')
      const name = String(row.name || '').trim() || 'Test Customer'
      if (!digits && !String(row.name || '').trim()) continue
      if (digits.length < 10) {
        setFeedback({
          type: 'error',
          text: `Enter a valid 10-digit mobile for ${name}.`,
        })
        return
      }
      parsed.push({ to: digits, name })
    }

    if (!parsed.length) {
      setFeedback({ type: 'error', text: 'Add at least one recipient with a mobile number.' })
      return
    }
    if (!isApproved) {
      setFeedback({
        type: 'error',
        text: `Only APPROVED templates can be sent. Current status: ${template.status || 'UNKNOWN'}.`,
      })
      return
    }
    if (isImageTemplate && !imageFile) {
      setFeedback({ type: 'error', text: 'Choose an image for this template header.' })
      return
    }
    if (isDocumentTemplate && !documentUrl) {
      setFeedback({ type: 'error', text: 'Upload a PDF for this document template.' })
      return
    }

    const bodyHasVariables = Boolean(bodyValues?.length)

    if (isImageTemplate) {
      sendMutation.mutate({
        kind: 'image',
        body: {
          imageFile,
          template_name: template.name,
          language_code: template.language || 'en_US',
          personalize_body_with_name: bodyHasVariables,
          create_template: false,
          recipients: parsed,
        },
      })
      return
    }

    if (isDocumentTemplate) {
      sendMutation.mutate({
        kind: 'text',
        body: {
          template_name: template.name,
          language_code: template.language || 'en_US',
          components: buildTemplateComponentsPayload(template, {
            bodyParams: bodyParamsMap,
            documentLink: documentUrl,
            documentFilename,
          }),
          personalize_body_with_name: bodyHasVariables,
          recipients: parsed,
        },
      })
      return
    }

    sendMutation.mutate({
      kind: 'text',
      body: {
        template_name: template.name,
        language_code: template.language || 'en_US',
        components: buildDemoComponents(template, headerValues, bodyValues),
        personalize_body_with_name: bodyHasVariables,
        recipients: parsed,
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate" title={template.name}>
              {template.name || 'Untitled template'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Demo preview with sample values — send a test to your own number to verify it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-5 px-5 py-5 bg-slate-50">
          <WhatsAppTemplatePreview
            template={displayTemplate}
            headerValues={headerValues}
            bodyValues={bodyValues}
            compact
          />

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Send Message</h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700">Recipients</p>
                  <button
                    type="button"
                    onClick={addRecipient}
                    disabled={sendMutation.isPending}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 hover:underline disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add number
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Country code 91 is added automatically. Each name fills body {'{{1}}'} when the
                  template has that variable.
                </p>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-2 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
                    <span>Mobile</span>
                    <span>Name</span>
                    <span className="w-7" />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {recipients.map((row) => (
                      <div
                        key={row.key}
                        className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-2 items-center px-2.5 py-1.5"
                      >
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={row.mobile}
                          onChange={(e) => updateRecipient(row.key, 'mobile', e.target.value)}
                          placeholder="10-digit mobile"
                          className="w-full h-9 px-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                          disabled={sendMutation.isPending}
                        />
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateRecipient(row.key, 'name', e.target.value)}
                          placeholder="Name"
                          className="w-full h-9 px-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                          disabled={sendMutation.isPending}
                        />
                        <button
                          type="button"
                          onClick={() => removeRecipient(row.key)}
                          disabled={recipients.length <= 1 || sendMutation.isPending}
                          className="inline-flex h-8 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          aria-label="Remove recipient"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {isImageTemplate ? (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Header image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-800 hover:file:bg-blue-100"
                  />
                  {imageFile ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="truncate text-xs text-slate-600" title={imageFile.name}>
                        {imageFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setImageFile(null)}
                        className="shrink-0 text-xs text-slate-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Uploaded to Cloudinary and used as the WhatsApp header image.
                    </p>
                  )}
                </div>
              ) : null}

              {isDocumentTemplate ? (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Document (PDF)</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={documentUploading || sendMutation.isPending}
                    className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-800 hover:file:bg-blue-100 disabled:opacity-60"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) {
                        setDocumentUrl('')
                        setDocumentFilename('document.pdf')
                        return
                      }
                      setFeedback(null)
                      setDocumentUploading(true)
                      try {
                        const url = await uploadMediaFile(file, 'promotional_whatsapp')
                        setDocumentUrl(url)
                        setDocumentFilename(file.name || 'document.pdf')
                      } catch (err) {
                        setFeedback({
                          type: 'error',
                          text: err.message || 'Failed to upload PDF',
                        })
                        setDocumentUrl('')
                      } finally {
                        setDocumentUploading(false)
                      }
                    }}
                  />
                  {documentUploading ? (
                    <p className="text-[11px] text-slate-500 mt-1">Uploading PDF to Cloudinary…</p>
                  ) : null}
                  {documentUrl ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
                      <p className="truncate text-xs font-medium text-slate-700">
                        {documentFilename}
                      </p>
                      <p className="text-[11px] text-slate-500 break-all">{documentUrl}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setDocumentUrl('')
                          setDocumentFilename('document.pdf')
                        }}
                        className="text-xs text-slate-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Required for document templates — same PDF is attached in WhatsApp.
                    </p>
                  )}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSendTest}
                disabled={!isApproved || sendMutation.isPending || documentUploading}
                className=" cursor-pointer w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg btn-brand text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                title={
                  isApproved
                    ? 'Send test message'
                    : `Only APPROVED templates can be sent. Current status: ${template.status || 'UNKNOWN'}.`
                }
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sendMutation.isPending ? 'Sending...' : 'Send Message'}
              </button>

              {feedback ? (
                <p
                  className={`rounded-lg border px-3 py-2 text-xs ${feedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                >
                  {feedback.text}
                </p>
              ) : null}

              {sendResults.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
                    <span>
                      Sent{' '}
                      {
                        sendResults.filter((row) => String(row?.status || '').toLowerCase() === 'sent')
                          .length
                      }
                    </span>
                    <span>
                      Failed{' '}
                      {
                        sendResults.filter(
                          (row) => String(row?.status || '').toLowerCase() === 'failed',
                        ).length
                      }
                    </span>
                    <span>Total {sendResults.length}</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {sendResults.map((row, index) => {
                      const status = String(row.status || '').toLowerCase()
                      return (
                        <div
                          key={`${row.to || row.name}-${index}`}
                          className="flex items-start justify-between gap-2 px-2.5 py-1.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">
                              {row.name || '—'} · {row.to || '—'}
                            </p>
                            {row.message ? (
                              <p className="text-[11px] text-slate-500 truncate" title={row.message}>
                                {row.message}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${status === 'sent'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                              }`}
                          >
                            {String(row.status || 'unknown').toUpperCase()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {!isApproved ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Status is {template.status || 'UNKNOWN'}. WhatsApp only delivers APPROVED templates.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-100 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  onView,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  deleting = false,
}) {
  const imageUrl = getHeaderImageUrl(template)
  const bodyText = getBodyText(template)
  const footerText = getFooterText(template)
  const buttons = getButtons(template)
  const status = template.status || '—'
  const category = template.category || '—'
  const language = template.language || '—'
  const useCaseLabel =
    template.use_case_label || getTemplateUseCaseLabel(template.use_case) || ''

  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col hover:border-blue-200 hover:shadow-md transition-all">
      {imageUrl ? (
        <div className="relative aspect-[16/9] bg-slate-100 border-b border-slate-100">
          <img
            src={imageUrl}
            alt={template.name || 'Template header'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="px-4 pt-4 pb-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <LayoutTemplate className="h-3.5 w-3.5 text-blue-800" />
            Text template
          </div>
        </div>
      )}

      <div className={`p-4 flex flex-col gap-3 flex-1 ${imageUrl ? '' : 'pt-3'}`}>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate" title={template.name}>
            {template.name || 'Untitled template'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">ID: {template.id || '—'}</p>
          {template.created_by?.name ? (
            <p className="text-[11px] text-slate-500 truncate">
              Created by {template.created_by.name}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {useCaseLabel ? (
            <span className="inline-flex px-2 py-0.5 rounded-md border border-violet-200 bg-violet-50 text-violet-800 text-[11px] font-medium">
              Used for: {useCaseLabel}
            </span>
          ) : null}
          <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-medium ${statusTone(status)}`}>
            {status}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-md border border-blue-100 bg-blue-50 text-blue-800 text-[11px] font-medium">
            {category}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-medium">
            {language}
          </span>
        </div>

        {bodyText ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-5">{bodyText}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No body text</p>
        )}

        {footerText ? (
          <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">{footerText}</p>
        ) : null}

        {buttons.length > 0 ? (
          <div className="pt-1 flex flex-wrap gap-1.5">
            {buttons.slice(0, 4).map((button, index) => {
              const type = String(button.type || '').toUpperCase()
              const Icon = type === 'PHONE_NUMBER' ? Phone : type === 'URL' ? Type : LayoutTemplate
              return (
                <span
                  key={`${button.text || 'btn'}-${index}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
                  title={button.url || button.phone_number || button.text}
                >
                  <Icon className="h-3 w-3 text-blue-800" />
                  {button.text || type}
                </span>
              )
            })}
            {buttons.length > 4 ? (
              <span className="inline-flex items-center px-2 py-1 text-[11px] text-slate-500">
                +{buttons.length - 4} more
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onView?.(template)}
            className="flex-1 cursor-pointer btn-brand inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
          >
            <Eye className="h-4 w-4" />
            View Message
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => onEdit?.(template)}
              disabled={!template?.name}
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
              title="Edit template"
              aria-label="Edit template"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete?.(template)}
              disabled={deleting || !template?.name}
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
              title="Delete template"
              aria-label="Delete template"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function ExampleFields({ indexes, values, onChange, labelPrefix }) {
  if (!indexes.length) return null
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-600">
        Example values for {labelPrefix} variables (required for approval)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {indexes.map((index) => (
          <div key={`${labelPrefix}-${index}`}>
            <label className="block text-xs text-slate-500 mb-1">{`{{${index}}}`}</label>
            <input
              type="text"
              className={fieldClass}
              value={values[index] || ''}
              onChange={(e) => onChange(index, e.target.value)}
              placeholder={`Example for {{${index}}}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateTemplateModal({ open, onClose, onCreated, editTemplate = null }) {
  const isEdit = Boolean(editTemplate?.name)
  const [form, setForm] = useState(emptyCreateForm)
  const [error, setError] = useState('')
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [bulletPickerOpen, setBulletPickerOpen] = useState(false)
  const bodyTextareaRef = useRef(null)
  const errorBannerRef = useRef(null)
  const formScrollRef = useRef(null)
  const messageToolsRef = useRef(null)
  const buttonsSectionRef = useRef(null)

  useEffect(() => {
    if (open) {
      const nextForm = editTemplate ? buildFormFromTemplate(editTemplate) : emptyCreateForm()
      setForm(nextForm)
      setError('')
      setUploadingHeader(false)
      setAdvancedOpen(
        Boolean(
          editTemplate &&
            (nextForm.header_type === 'image' ||
              nextForm.header_type === 'document' ||
              (nextForm.header_type === 'text' && !nextForm.show_company_header)),
        ),
      )
      setEmojiPickerOpen(false)
      setBulletPickerOpen(false)
    }
  }, [open, editTemplate])

  useEffect(() => {
    if (!error) return
    const banner = errorBannerRef.current
    if (banner?.scrollIntoView) {
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [error])

  useEffect(() => {
    if (!emojiPickerOpen && !bulletPickerOpen) return undefined
    const onPointerDown = (event) => {
      if (messageToolsRef.current && !messageToolsRef.current.contains(event.target)) {
        setEmojiPickerOpen(false)
        setBulletPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [emojiPickerOpen, bulletPickerOpen])

  const headerIndexes = useMemo(
    () =>
      form.header_type === 'text' ? extractTemplatePlaceholders(form.header_text) : [],
    [form.header_type, form.header_text],
  )
  const bodyIndexes = useMemo(
    () => extractTemplatePlaceholders(form.body_text),
    [form.body_text],
  )

  const sampleValues = useMemo(
    () => getTemplateSampleValues(form.use_case, form.company_name || form.footer_text),
    [form.use_case, form.company_name, form.footer_text],
  )

  const previewTemplate = useMemo(() => {
    const components = []
    if (form.header_type === 'text' && form.header_text.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: form.header_text.trim(),
      })
    } else if (form.header_type === 'image' && form.header_image_url) {
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
        example: { header_handle: [form.header_image_url] },
      })
    } else if (form.header_type === 'document' && form.header_document_url) {
      components.push({
        type: 'HEADER',
        format: 'DOCUMENT',
        example: { header_handle: [form.header_document_url] },
      })
    }
    if (form.body_text.trim()) {
      components.push({ type: 'BODY', text: form.body_text.trim() })
    }
    if (form.footer_text.trim()) {
      components.push({ type: 'FOOTER', text: form.footer_text.trim() })
    }
    const previewButtons = (form.buttons || [])
      .filter((button) => String(button?.text || '').trim())
      .slice(0, MAX_TEMPLATE_BUTTONS)
      .map((button) => {
        const type = String(button.type || 'QUICK_REPLY').toUpperCase()
        const text = String(button.text || '').trim()
        if (type === 'URL') return { type: 'URL', text, url: button.url || '' }
        if (type === 'PHONE_NUMBER') {
          return { type: 'PHONE_NUMBER', text, phone_number: button.phone_number || '' }
        }
        return { type: 'QUICK_REPLY', text }
      })
    if (previewButtons.length) {
      components.push({ type: 'BUTTONS', buttons: previewButtons })
    }
    return {
      name: form.name || getDefaultTemplateName(form.use_case),
      status: 'PREVIEW',
      category: form.category,
      language: form.language,
      components,
    }
  }, [form])

  const previewHeaderValues = useMemo(() => {
    if (form.header_type !== 'text') return []
    return headerIndexes.map((index) => {
      const custom = String(form.header_examples[index] || '').trim()
      if (custom) return custom
      return sampleValues.header[index - 1] || sampleValues.company
    })
  }, [form.header_type, form.header_examples, headerIndexes, sampleValues])

  const previewBodyValues = useMemo(
    () =>
      bodyIndexes.map((index) => {
        const custom = String(form.body_examples[index] || '').trim()
        if (custom) return custom
        return sampleValues.body[index - 1] || `Sample ${index}`
      }),
    [bodyIndexes, form.body_examples, sampleValues],
  )

  const insertChips = useMemo(
    () => getTemplateInsertChips(form.use_case),
    [form.use_case],
  )

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? editMessageTemplate(payload) : createMessageTemplate(payload),
    onSuccess: (result) => {
      onCreated?.(result, { isEdit })
      onClose()
    },
    onError: (err) => {
      setError(humanizeTemplateCreateError(extractTemplateCreateError(err)))
    },
  })

  if (!open) return null

  const updateField = (key, value) => {
    setError('')
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const applyUseCase = (useCase) => {
    if (isEdit) {
      // Keep existing copy when editing; only switch the use-case tag.
      setForm((prev) => ({ ...prev, use_case: useCase }))
      setError('')
      return
    }
    setForm((prev) =>
      buildCreateFormFromUseCase(useCase, prev.company_name || prev.footer_text),
    )
    setError('')
  }

  const syncCompanyName = (value) => {
    const company = value
    setForm((prev) => {
      const next = {
        ...prev,
        company_name: company,
        footer_text: company,
      }
      if (prev.show_company_header || prev.header_type === 'text') {
        const starter = getReadyTemplateStarter(prev.use_case)
        // Keep starter header pattern with {{1}} when in simple company-header mode
        if (prev.show_company_header && starter.header_text) {
          next.header_text = starter.header_text
          next.header_type = 'text'
        }
      }
      return next
    })
  }

  const toggleCompanyHeader = (checked) => {
    const starter = getReadyTemplateStarter(form.use_case)
    setForm((prev) => ({
      ...prev,
      show_company_header: checked,
      header_type: checked ? 'text' : prev.header_type === 'text' ? 'none' : prev.header_type,
      header_text: checked
        ? starter.header_text || 'Message from {{1}}'
        : prev.header_type === 'text'
          ? ''
          : prev.header_text,
    }))
  }

  const insertChipIntoBody = (token) => {
    const textarea = bodyTextareaRef.current
    const current = form.body_text || ''
    const scrollParent = formScrollRef.current
    const savedScrollTop = scrollParent?.scrollTop ?? null

    const restoreFocusAndScroll = (cursorStart, tokenLen) => {
      const restore = () => {
        if (textarea) {
          try {
            textarea.focus({ preventScroll: true })
          } catch {
            textarea.focus()
          }
          const cursor = cursorStart + tokenLen
          try {
            textarea.setSelectionRange(cursor, cursor)
          } catch {
            // ignore selection failures on unmounted nodes
          }
        }
        if (scrollParent != null && savedScrollTop != null) {
          scrollParent.scrollTop = savedScrollTop
        }
      }
      // Restore after React paint (example fields may appear and shift layout).
      requestAnimationFrame(() => {
        restore()
        requestAnimationFrame(restore)
      })
    }

    if (!textarea) {
      updateField('body_text', `${current}${current ? ' ' : ''}${token}`)
      return
    }
    const start = textarea.selectionStart ?? current.length
    const end = textarea.selectionEnd ?? current.length
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`
    updateField('body_text', next)
    restoreFocusAndScroll(start, String(token).length)
  }

  const insertIntoBody = (token) => {
    insertChipIntoBody(token)
    setEmojiPickerOpen(false)
    setBulletPickerOpen(false)
  }

  const addTemplateButton = () => {
    setError('')
    setForm((prev) => {
      if ((prev.buttons || []).length >= MAX_TEMPLATE_BUTTONS) return prev
      return { ...prev, buttons: [...(prev.buttons || []), emptyTemplateButton()] }
    })
    // Keep the editor in the left form visible (sticky footer can cover it).
    requestAnimationFrame(() => {
      buttonsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }

  const updateTemplateButton = (key, patch) => {
    setError('')
    setForm((prev) => ({
      ...prev,
      buttons: (prev.buttons || []).map((button) =>
        button.key === key ? { ...button, ...patch } : button,
      ),
    }))
  }

  const removeTemplateButton = (key) => {
    setError('')
    setForm((prev) => ({
      ...prev,
      buttons: (prev.buttons || []).filter((button) => button.key !== key),
    }))
  }

  const fillExamplesFromSamples = () => {
    const headerExamples = {}
    headerIndexes.forEach((index) => {
      headerExamples[index] =
        String(form.header_examples[index] || '').trim() ||
        sampleValues.header[index - 1] ||
        sampleValues.company
    })
    const bodyExamples = {}
    bodyIndexes.forEach((index) => {
      bodyExamples[index] =
        String(form.body_examples[index] || '').trim() ||
        sampleValues.body[index - 1] ||
        `Sample ${index}`
    })
    return { headerExamples, bodyExamples }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    const name = (form.name || getDefaultTemplateName(form.use_case)).trim()
    const bodyText = form.body_text.trim()
    if (!form.use_case) {
      setError('Select what you will send with this message.')
      return
    }
    if (!name) {
      setError('Template name is required')
      return
    }
    if (!bodyText) {
      setError('Please write the message body.')
      return
    }

    const { headerExamples, bodyExamples } = fillExamplesFromSamples()

    for (const index of headerIndexes) {
      if (!String(headerExamples[index] || '').trim()) {
        setError(`Please provide an example for header {{${index}}}`)
        return
      }
    }
    for (const index of bodyIndexes) {
      if (!String(bodyExamples[index] || '').trim()) {
        setError(`Please provide an example for body {{${index}}}`)
        return
      }
    }

    const configuredButtons = Array.isArray(form.buttons) ? form.buttons : []
    for (const button of configuredButtons) {
      const label = String(button?.text || '').trim()
      const type = String(button?.type || '').toUpperCase()
      if (
        !label &&
        !String(button?.url || '').replace('https://', '').trim() &&
        !String(button?.phone_number || '').trim()
      ) {
        continue
      }
      if (!label) {
        setError('Enter a label for each button, or remove empty buttons.')
        return
      }
      if (type === 'URL') {
        const url = String(button?.url || '').trim()
        if (!url || url === 'https://') {
          setError(`Enter a website URL for the "${label}" button.`)
          return
        }
        const urlPlaceholders = extractTemplatePlaceholders(url)
        if (urlPlaceholders.length && !String(button?.url_example || '').trim()) {
          setError(
            `Enter a sample value for the dynamic URL on "${label}" (example: v1788347339/file.pdf).`,
          )
          return
        }
      }
      if (type === 'PHONE_NUMBER') {
        const rawPhone = String(button?.phone_number || '').trim()
        if (!rawPhone) {
          setError(`Enter a phone number for the "${label}" button.`)
          return
        }
        const phone = normalizeWhatsAppPhoneNumber(rawPhone)
        if (!isValidWhatsAppPhoneNumber(phone)) {
          setError(
            `Call button "${label}" needs a valid phone with country code (example: +917022261919).`,
          )
          return
        }
        if (phone !== rawPhone && !isEdit) {
          updateTemplateButton(button.key, { phone_number: phone })
        }
      }
    }

    const buttons = normalizeTemplateButtonsForPayload(configuredButtons, { forEdit: isEdit })
    const footerText = form.footer_text.trim()
    const bodyExampleList = bodyIndexes.map(
      (index) => String(bodyExamples[index] || '').trim(),
    )

    // Edit API sample shape:
    // { name, category, body_text, body_examples, footer_text, buttons[{type,text,url,example}|{type,text,phone_number}] }
    if (isEdit) {
      const editPayload = {
        name,
        category: form.category || 'UTILITY',
        body_text: bodyText,
      }

      if (bodyExampleList.length) {
        editPayload.body_examples = bodyExampleList
      }
      if (footerText) {
        editPayload.footer_text = footerText
      }

      if (form.header_type === 'image') {
        if (!form.header_image_url) {
          setError('Upload a header image, or switch the header type.')
          return
        }
        editPayload.header_format = 'IMAGE'
        editPayload.header_image_url = form.header_image_url
      } else if (form.header_type === 'document') {
        if (!form.header_document_url) {
          setError('Upload a PDF document, or switch the header type.')
          return
        }
        editPayload.header_format = 'DOCUMENT'
        editPayload.header_document_url = form.header_document_url
      } else if (form.header_type === 'text' || form.show_company_header) {
        const headerText = form.header_text.trim()
        if (headerText) {
          editPayload.header_text = headerText
          if (headerIndexes.length) {
            editPayload.header_examples = headerIndexes.map(
              (index) => String(headerExamples[index] || '').trim(),
            )
          }
        }
      }

      if (buttons.length) {
        editPayload.buttons = buttons
      }

      saveMutation.mutate(editPayload)
      return
    }

    const payload = {
      name,
      use_case: form.use_case,
      category: form.category || 'UTILITY',
      language: form.language || 'en_US',
      allow_category_change: Boolean(form.allow_category_change),
      body_text: bodyText,
    }

    if (form.header_type === 'image') {
      if (!form.header_image_url) {
        setError('Upload a header image, or switch the header type.')
        return
      }
      payload.header_format = 'IMAGE'
      payload.header_image_url = form.header_image_url
    } else if (form.header_type === 'document') {
      if (!form.header_document_url) {
        setError('Upload a PDF document, or switch the header type.')
        return
      }
      payload.header_format = 'DOCUMENT'
      payload.header_document_url = form.header_document_url
    } else if (form.header_type === 'text' || form.show_company_header) {
      const headerText = form.header_text.trim()
      if (headerText) {
        payload.header_text = headerText
        if (headerIndexes.length) {
          payload.header_examples = headerIndexes.map(
            (index) => String(headerExamples[index] || '').trim(),
          )
        }
      }
    }

    if (bodyExampleList.length) {
      payload.body_examples = bodyExampleList
    }

    if (footerText) {
      payload.footer_text = footerText
    }

    if (buttons.length) {
      payload.buttons = buttons
    }
    payload.is_button_added = buttons.length > 0
    payload.button_added = buttons.length

    saveMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative w-full max-w-5xl max-h-[min(94vh,900px)] my-auto overflow-hidden rounded-xl bg-white shadow-xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 shrink-0 gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Edit message template' : 'Create message template'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? 'Update the message, buttons, and media, then save. WhatsApp may re-review the template.'
                : 'Choose what you will send, edit the message, and check the WhatsApp preview on the right. Then send it for approval.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div
            ref={formScrollRef}
            className="overflow-y-auto overscroll-contain px-5 py-4 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col min-w-0"
          >
            <div className="space-y-4 flex-1 pb-28">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  What will you send with this?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEMPLATE_USE_CASE_OPTIONS.map((option) => {
                    const selected = form.use_case === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyUseCase(option.value)}
                        className={`text-left rounded-xl border px-3.5 py-3 transition-colors ${selected
                            ? 'border-blue-800 bg-blue-50 ring-1 ring-blue-800/30'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {USE_CASE_CARD_HINTS[option.value] || ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Company name
                </label>
                <input
                  type="text"
                  className={fieldClass}
                  value={form.company_name}
                  onChange={(e) => syncCompanyName(e.target.value)}
                  placeholder="WB Agro Pvt Ltd"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                    checked={Boolean(form.show_company_header)}
                    onChange={(e) => toggleCompanyHeader(e.target.checked)}
                    disabled={
                      form.header_type === 'image' || form.header_type === 'document'
                    }
                  />
                  Show company name on top of the message
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Template name
                </label>
                <input
                  type="text"
                  className={fieldClassLowercase}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Enter Template Name Here.."
                  readOnly={isEdit}
                  disabled={isEdit}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {isEdit
                    ? 'Template name cannot be changed when editing.'
                    : 'Lowercase letters, numbers and underscores. Made unique for your organization automatically.'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700"
                >
                  Advanced options
                  <span className="text-xs text-slate-400">{advancedOpen ? 'Hide' : 'Show'}</span>
                </button>
                {advancedOpen ? (
                  <div className="border-t border-slate-200 px-3 py-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Category
                        </label>
                        <select
                          className={fieldClass}
                          value={form.category}
                          onChange={(e) => updateField('category', e.target.value)}
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Language
                        </label>
                        <select
                          className={fieldClass}
                          value={form.language}
                          onChange={(e) => updateField('language', e.target.value)}
                        >
                          {LANGUAGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Header <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <select
                        className={fieldClass}
                        value={form.header_type}
                        onChange={(e) => {
                          const nextType = e.target.value
                          updateField('header_type', nextType)
                          updateField(
                            'show_company_header',
                            nextType === 'text' && String(form.header_text || '').includes('{{'),
                          )
                        }}
                      >
                        {HEADER_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {form.header_type === 'text' ? (
                        <div className="mt-3">
                          <input
                            type="text"
                            className={fieldClass}
                            value={form.header_text}
                            onChange={(e) => updateField('header_text', e.target.value)}
                            placeholder="Tax Invoice from {{1}}"
                          />
                          <ExampleFields
                            indexes={headerIndexes}
                            values={form.header_examples}
                            labelPrefix="header"
                            onChange={(index, value) =>
                              setForm((prev) => ({
                                ...prev,
                                header_examples: { ...prev.header_examples, [index]: value },
                              }))
                            }
                          />
                        </div>
                      ) : null}

                      {form.header_type === 'image' ? (
                        <div className="mt-3 space-y-2">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingHeader || saveMutation.isPending}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 disabled:opacity-60"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setError('')
                              setUploadingHeader(true)
                              try {
                                const url = await uploadMediaFile(file, 'promotional_whatsapp')
                                updateField('header_image_url', url)
                                updateField('show_company_header', false)
                              } catch (err) {
                                setError(err.message || 'Failed to upload header image')
                              } finally {
                                setUploadingHeader(false)
                              }
                            }}
                          />
                          {uploadingHeader ? (
                            <p className="text-[11px] text-slate-500">Uploading to Cloudinary…</p>
                          ) : null}
                          {form.header_image_url ? (
                            <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-2">
                              <img
                                src={form.header_image_url}
                                alt="Header preview"
                                className="h-16 w-16 rounded object-cover"
                              />
                              <p className="text-[11px] text-slate-500 break-all">
                                {form.header_image_url}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {form.header_type === 'document' ? (
                        <div className="mt-3 space-y-2">
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={uploadingHeader || saveMutation.isPending}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 disabled:opacity-60"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setError('')
                              setUploadingHeader(true)
                              try {
                                const url = await uploadMediaFile(file, 'promotional_whatsapp')
                                updateField('header_document_url', url)
                                updateField('show_company_header', false)
                              } catch (err) {
                                setError(err.message || 'Failed to upload document')
                              } finally {
                                setUploadingHeader(false)
                              }
                            }}
                          />
                          {uploadingHeader ? (
                            <p className="text-[11px] text-slate-500">Uploading PDF to Cloudinary…</p>
                          ) : null}
                          {form.header_document_url ? (
                            <div className="rounded-lg border border-slate-200 p-2 space-y-1">
                              <p className="text-xs font-medium text-slate-800">PDF ready</p>
                              <p className="text-[11px] text-slate-500 break-all">
                                {form.header_document_url}
                              </p>
                              <button
                                type="button"
                                className="text-xs text-slate-500 hover:text-red-600"
                                onClick={() => updateField('header_document_url', '')}
                              >
                                Remove
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                        checked={form.allow_category_change}
                        onChange={(e) => updateField('allow_category_change', e.target.checked)}
                      />
                      Allow category change during review
                    </label>
                  </div>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Message</label>
                  <div className="relative flex items-center gap-1.5" ref={messageToolsRef}>
                    <p className="text-[11px] text-slate-400 mr-1 hidden sm:inline">
                      Tap a chip to insert a detail
                    </p>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setBulletPickerOpen(false)
                      setEmojiPickerOpen((prev) => !prev)
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${emojiPickerOpen
                      ? 'border-blue-800 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    title="Insert emoji"
                  >
                    <Smile className="h-3.5 w-3.5" />
                    Emoji
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setEmojiPickerOpen(false)
                      setBulletPickerOpen((prev) => !prev)
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${bulletPickerOpen
                      ? 'border-blue-800 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    title="Insert bullet or symbol"
                  >
                    <List className="h-3.5 w-3.5" />
                    Bullets
                  </button>
                    {emojiPickerOpen ? (
                      <EmojiPickerPanel
                        onPick={insertIntoBody}
                        onClose={() => setEmojiPickerOpen(false)}
                      />
                    ) : null}
                    {bulletPickerOpen ? (
                      <BulletPickerPanel
                        onPick={insertIntoBody}
                        onClose={() => setBulletPickerOpen(false)}
                      />
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {insertChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertChipIntoBody(chip.token)}
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  className={`${fieldClass} min-h-[160px] resize-y`}
                  value={form.body_text}
                  onChange={(e) => updateField('body_text', e.target.value)}
                  placeholder="Write the message the customer will receive…"
                />
              </div>

              <ExampleFields
                indexes={bodyIndexes}
                values={form.body_examples}
                labelPrefix="body"
                onChange={(index, value) =>
                  setForm((prev) => ({
                    ...prev,
                    body_examples: { ...prev.body_examples, [index]: value },
                  }))
                }
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Footer line <span className="text-slate-400 font-normal">(company name)</span>
                </label>
                <input
                  type="text"
                  className={fieldClass}
                  value={form.footer_text}
                  onChange={(e) => updateField('footer_text', e.target.value)}
                  placeholder="WB Agro Pvt Ltd"
                />
              </div>

              <div
                id="template-buttons-section"
                ref={buttonsSectionRef}
                className="rounded-xl border border-blue-100 bg-blue-50/40 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-blue-100/80">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Buttons</p>
                    <p className="text-[11px] text-slate-500">
                      Configure up to {MAX_TEMPLATE_BUTTONS} buttons here. Preview on the right updates live.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTemplateButton}
                    disabled={(form.buttons || []).length >= MAX_TEMPLATE_BUTTONS}
                    className="inline-flex items-center gap-1 rounded-lg btn-brand px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add button
                  </button>
                </div>
                <div className="p-3 space-y-3">
                  {(form.buttons || []).length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No buttons yet. Example: “Visit our site” and “Call us”.
                    </p>
                  ) : (
                    (form.buttons || []).map((button, index) => (
                      <div
                        key={button.key}
                        className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-600">Button {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeTemplateButton(button.key)}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Type
                            </label>
                            <select
                              className={fieldClass}
                              value={button.type}
                              onChange={(e) =>
                                updateTemplateButton(button.key, { type: e.target.value })
                              }
                            >
                              {BUTTON_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              className={fieldClass}
                              value={button.text}
                              maxLength={25}
                              onChange={(e) =>
                                updateTemplateButton(button.key, { text: e.target.value })
                              }
                              placeholder={
                                button.type === 'PHONE_NUMBER'
                                  ? 'Call us'
                                  : button.type === 'URL'
                                    ? 'Visit our site'
                                    : 'Yes'
                              }
                            />
                          </div>
                        </div>
                        {button.type === 'URL' ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Website URL
                              </label>
                              <input
                                type="text"
                                className={fieldClass}
                                value={button.url}
                                onChange={(e) =>
                                  updateTemplateButton(button.key, { url: e.target.value })
                                }
                                placeholder="https://example.com/path/{{1}}"
                              />
                              <p className="text-[11px] text-slate-500 mt-1">
                                Use {'{{1}}'} at the end for a dynamic link (invoice PDF, etc.).
                              </p>
                            </div>
                            {extractTemplatePlaceholders(button.url).length > 0 ? (
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                  URL example value
                                </label>
                                <input
                                  type="text"
                                  className={fieldClass}
                                  value={button.url_example || ''}
                                  onChange={(e) =>
                                    updateTemplateButton(button.key, {
                                      url_example: e.target.value,
                                    })
                                  }
                                  placeholder="v1788347339/file.pdf"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">
                                  Sample value WhatsApp uses for {'{{1}}'} in the URL.
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {button.type === 'PHONE_NUMBER' ? (
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Phone number
                            </label>
                            <input
                              type="tel"
                              inputMode="numeric"
                              className={fieldClass}
                              value={button.phone_number}
                              maxLength={10}
                              onChange={(e) =>
                                updateTemplateButton(button.key, {
                                  phone_number: e.target.value.replace(/\D/g, ''),
                                })
                              }
                              placeholder="7022261919"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">
                              Enter 10-digit mobile number. Sent to WhatsApp as +91…
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 bg-white border-t border-slate-100 space-y-2 shrink-0 z-20">
              {error ? (
                <div
                  ref={errorBannerRef}
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-red-900">
                        {isEdit ? 'Couldn’t update template' : 'Couldn’t create template'}
                      </p>
                      <p className="mt-0.5 break-words whitespace-pre-wrap">{error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="p-0.5 rounded text-red-500 hover:bg-red-100 hover:text-red-700"
                      aria-label="Dismiss error"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-brand text-sm font-medium disabled:opacity-60"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isEdit ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {saveMutation.isPending
                    ? isEdit
                      ? 'Saving…'
                      : 'Sending…'
                    : isEdit
                      ? 'Save Changes'
                      : 'Create Template'}
                </button>
              </div>
            </div>
          </div>

          <aside className="overflow-y-auto overscroll-contain bg-slate-50 px-4 py-4 min-w-0 lg:max-w-[340px]">
            <p className="text-sm font-semibold text-slate-900 mb-1">
              Customer will see this on WhatsApp
            </p>
            <p className="text-[11px] text-slate-500 mb-3">
              Live preview only — edit buttons in the form on the left.
            </p>
            <div className="lg:sticky lg:top-0">
              <WhatsAppTemplatePreview
                template={previewTemplate}
                headerValues={previewHeaderValues}
                bodyValues={previewBodyValues}
                compact
                emptyText="Write a message to see the WhatsApp preview."
              />
              <p className="mt-3 text-[11px] text-slate-500 text-center px-2">
                After you send for approval, WhatsApp must approve it before you can send real
                messages.
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  )
}

export default function PromotionalTemplates() {
  const queryClient = useQueryClient()
  const { hasPermission, permissions = [] } = useUserPermissions()

  // GrainPro may not have promotions_management in role matrix yet — allow
  // create/edit/delete when that module is missing so the page is usable.
  const hasPromoModule = permissions.some((permission) => {
    const key = String(permission?.alias || permission?.module_name || '').toLowerCase()
    return (
      key === 'promotions_management' ||
      key === 'promotional' ||
      key === 'promotions'
    )
  })
  const canCreate =
    !hasPromoModule ||
    hasPermission('promotions_management', 'create') ||
    hasPermission('promotions_management', 'update')
  const canEdit =
    !hasPromoModule ||
    hasPermission('promotions_management', 'update') ||
    canCreate
  const canDelete =
    !hasPromoModule ||
    hasPermission('promotions_management', 'delete') ||
    canCreate

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [useCaseFilter, setUseCaseFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [feedback, setFeedback] = useState('')

  const openCreate = () => {
    setEditTemplate(null)
    setCreateOpen(true)
  }
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['promotional-message-templates'],
    queryFn: () => fetchMessageTemplates(),
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (template) => deleteMessageTemplate({ name: template?.name }),
    onSuccess: (result, template) => {
      setDeleteTarget(null)
      setFeedback(result?.message || `Template "${template?.name}" deleted successfully.`)
      queryClient.invalidateQueries({ queryKey: ['promotional-message-templates'] })
    },
    onError: (err) => {
      setFeedback(err?.message || 'Failed to delete template.')
    },
  })

  const templates = data?.templates || []

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return templates.filter((template) => {
      const status = String(template.status || '').toUpperCase()
      if (statusFilter !== 'all' && status !== statusFilter) return false
      const useCase = String(template.use_case || '').toLowerCase()
      if (useCaseFilter !== 'all' && useCase !== useCaseFilter) return false
      if (!q) return true
      const haystack = [
        template.name,
        template.id,
        template.category,
        template.use_case,
        template.use_case_label || getTemplateUseCaseLabel(template.use_case),
        template.language,
        getBodyText(template),
        getFooterText(template),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [templates, searchTerm, statusFilter, useCaseFilter])

  const statusOptions = useMemo(() => {
    const set = new Set(
      templates.map((item) => String(item.status || '').toUpperCase()).filter(Boolean),
    )
    return ['all', ...Array.from(set).sort()]
  }, [templates])

  return (
    <AppPageShell>
    <div className="flex flex-col min-h-0 flex-1 bg-gradient-to-b from-slate-50 via-slate-50 to-blue-50/30">
      {(isLoading || isFetching) && <Loader />}

      <PageHeader
        title="Promotional Templates"
        description="Create and manage WhatsApp message templates for your organization."
      >
        <div className="flex items-center gap-2">
          {canCreate ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-lg btn-brand text-sm font-medium shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Template
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </PageHeader>

      <main className="flex-1 p-4 sm:p-6 space-y-4 pb-8">
        {feedback ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start justify-between gap-3 shadow-sm">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback('')} className="opacity-70 hover:opacity-100">
              ×
            </button>
          </div>
        ) : null}

        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, body, category..."
                className={searchInputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Used for</label>
              <select
                value={useCaseFilter}
                onChange={(e) => setUseCaseFilter(e.target.value)}
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              >
                <option value="all">All uses</option>
                {TEMPLATE_USE_CASE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All statuses' : option}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline-flex h-11 items-center justify-center rounded-lg border border-blue-100 bg-blue-50/70 px-3 text-xs font-semibold text-blue-900">
              <Megaphone className="h-3.5 w-3.5 mr-1.5 text-blue-800" />
              {filtered.length} of {templates.length} templates
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
            <p className="text-red-700 mb-4">{error.message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-brand text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : !isLoading && filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 sm:p-14 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-800 ring-1 ring-blue-100">
              <LayoutTemplate className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">No promotional templates yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Create a WhatsApp template, submit it for approval, then use it from Send Messages once it is approved.
            </p>
            {canCreate ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-brand text-sm font-medium shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id || template.name}
                template={template}
                onView={setPreviewTemplate}
                canEdit={canEdit}
                onEdit={(template) => {
                  setCreateOpen(false)
                  setEditTemplate(template)
                }}
                canDelete={canDelete}
                onDelete={(template) => {
                  deleteMutation.reset()
                  setDeleteTarget(template)
                }}
                deleting={
                  deleteMutation.isPending &&
                  deleteTarget?.name === template.name
                }
              />
            ))}
          </div>
        )}
      </main>

      <TemplateDemoModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="Close delete confirmation"
            onClick={() => {
              if (!deleteMutation.isPending) setDeleteTarget(null)
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100 shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900">Delete template</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Are you sure you want to delete{' '}
                  <strong className="break-all">{deleteTarget.name}</strong>? This cannot be
                  undone.
                </p>
              </div>
            </div>
            {deleteMutation.isError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteMutation.error?.message || 'Failed to delete template.'}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleteMutation.isPending ? 'Deleting…' : 'OK, Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateTemplateModal
        open={createOpen || Boolean(editTemplate)}
        editTemplate={editTemplate}
        onClose={() => {
          setCreateOpen(false)
          setEditTemplate(null)
        }}
        onCreated={(result, meta) => {
          const submittedName =
            result?.request_payload?.name || editTemplate?.name || result?.name
          if (meta?.isEdit) {
            setFeedback(
              submittedName
                ? `Template "${submittedName}" updated successfully.`
                : 'Template updated successfully.',
            )
          } else {
            setFeedback(
              submittedName
                ? `Template sent for approval. Use it after status becomes Approved. (WhatsApp name: ${submittedName})`
                : 'Template sent for approval. Use it after status becomes Approved.',
            )
          }
          queryClient.invalidateQueries({ queryKey: ['promotional-message-templates'] })
        }}
      />
    </div>
    </AppPageShell>
  )
}
