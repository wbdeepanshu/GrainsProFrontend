import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  Building,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  CreditCard,
  FileText,
  Filter,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import BrandDatePicker from '@/components/common/BrandDatePicker'
import Loader from '@/components/common/Loader'
import Pagination from '@/components/common/Pagination'
import SearchSelectDropdown from '@/components/common/SearchSelectDropdown'
import SimpleSelect from '@/components/common/SimpleSelect'
import CarouselImagePicker from '@/components/whatsapp/CarouselImagePicker'
import WhatsAppTemplatePreview, {
  humanizeTemplateValue,
} from '@/components/whatsapp/WhatsAppTemplatePreview'
import AppPageShell from '@/components/layout/AppPageShell'
import PageHeader from '@/components/layout/PageHeader'
import { fetchBusinessTypes, fetchCommonListings, fetchCreditTypes } from '@/lib/accounts_api'
import { isAdminSettingEnabled } from '@/lib/adminSettings'
import { AuthService } from '@/lib/auth'
import { fetchBranchSettings, getDashboardSelectedBranchId } from '@/lib/branches_api'
import { uploadMediaFile } from '@/lib/media_upload_api'
import {
  MAX_CAROUSEL_CARDS,
  MIN_CAROUSEL_CARDS,
  buildTemplateComponentsPayload,
  createCarouselTemplate,
  extractTemplatePlaceholders,
  fetchMessageTemplates,
  getCarouselCards,
  getTemplateComponent,
  sendCarouselMessages,
  sendPromotionalEmails,
  sendPromotionalImageMessages,
  sendPromotionalMessages,
  sendPromotionalSms,
} from '@/lib/promotional_api'
import {
  fetchLedgerAreaGroups,
  fetchLedgerGroups,
  fetchLedgers,
  fetchLedgersBreakdown,
} from '@/lib/tally_api'
import { fetchUsersForFilter, getUserDisplayName, getUserId } from '@/lib/users_api'
import { usePermissions } from '@/hooks/usePermissions'
import { useSuccessPopup } from '@/hooks/useSuccessPopup'

const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 500
const BREAKDOWN_EMPTY_VALUE = '__empty__'
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
]

const STATUS_HINT_CLASS = {
  APPROVED: 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700',
  PENDING: 'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700',
  REJECTED: 'rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700',
  PAUSED: 'rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-600',
}

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const filterInputClass =
  'w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const LEDGER_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'both', label: 'Both' },
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
]

const LEDGER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' },
]

const LEDGER_TALLY_SYNC_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Synced' },
  { value: 'false', label: 'Not Synced' },
]

const DATE_PRESET_OPTIONS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'weekly', label: 'Weekly (Mon–Sun)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
]

const WEEK_OFF_OPTIONS = [
  { value: '', label: 'All week offs' },
  { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
  { value: 'Sunday', label: 'Sunday' },
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
]

const CHANNEL_SUBTITLES = {
  whatsapp: 'Select ledgers and send approved WhatsApp template notifications.',
  email: 'Select ledgers with valid email addresses and send promotional emails.',
  sms: 'Select ledgers with valid mobile numbers and send promotional SMS.',
}

const WHATSAPP_SEND_MODE_OPTIONS = [
  { value: 'message_only', label: 'Only message' },
  { value: 'message_with_image', label: 'Message with image' },
  { value: 'message_with_document', label: 'Message with document (PDF)' },
  { value: 'carousel', label: 'Multiple images (swipeable carousel)' },
]

const MAX_WHATSAPP_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_WHATSAPP_DOCUMENT_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

const FOOTER_BUTTON_LABELS = {
  whatsapp: 'Choose Template & Send',
  email: 'Compose Email & Send',
  sms: 'Compose SMS & Send',
}

function FilterLabel({ icon: Icon, children }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
      <Icon className="h-4 w-4 text-blue-800" />
      {children}
    </label>
  )
}

function resolveIsTallyEnabled() {
  const userData = AuthService.getUserData()
  const raw =
    userData?.is_tally_enabled ??
    userData?.user_info?.is_tally_enabled ??
    userData?.organization?.is_tally_enabled
  return !(raw === false || raw === 0 || raw === '0' || raw === 'false' || raw === 'False')
}

function toIsoDateOnly(value) {
  if (!value) return ''
  const raw = String(value).trim()
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd')
  return ''
}

function isCreatedAtInRange(createdAt, fromDate, toDate) {
  const day = toIsoDateOnly(createdAt)
  if (!day) return false
  if (fromDate && day < fromDate) return false
  if (toDate && day > toDate) return false
  return true
}

function resolveLedgerType(entry) {
  if (entry?.ledger_type) {
    return String(entry.ledger_type).toLowerCase()
  }
  if (entry?.is_supplier === true) return 'supplier'
  if (entry?.is_supplier === false) return 'customer'
  return ''
}

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '')
}

/** Prefer international form for display; backend also prefixes 91 for 10-digit IN mobiles. */
function toWhatsAppNumber(value) {
  let digits = normalizePhone(value)
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) return `91${digits}`
  return digits
}

function getLedgerMobile(entry) {
  const raw =
    entry?.whatsapp_number ||
    entry?.contact_number ||
    entry?.whatsapp_number2 ||
    entry?.contact_number2 ||
    ''
  return toWhatsAppNumber(raw)
}

/** Prefer the same label the ledger list shows, then firm / Tally names. */
function getLedgerDisplayName(entry) {
  return String(
    entry?.name || entry?.firm_name || entry?.tally_name || entry?.alias_name || '',
  ).trim()
}

function resolveTemplateLanguage(template) {
  const lang = template?.language
  if (lang && typeof lang === 'object') {
    return String(lang.code || lang.language || lang.locale || 'en_US').trim() || 'en_US'
  }
  return String(lang || 'en_US').trim() || 'en_US'
}

function getLedgerEmail(entry) {
  return String(entry?.email || entry?.email_id || entry?.mail || '').trim()
}

function isValidEmail(value) {
  return SIMPLE_EMAIL_RE.test(String(value || '').trim())
}

function getLedgerState(entry) {
  return String(entry?.state || entry?.state_name || entry?.mailing_state || '').trim()
}

function isRowSelectable(entry, channel) {
  if (channel === 'email') return isValidEmail(getLedgerEmail(entry))
  return getLedgerMobile(entry).length >= 10
}

function getRecipientContact(entry, channel) {
  if (channel === 'email') return getLedgerEmail(entry)
  return getLedgerMobile(entry)
}

function ChannelToggle({ channel, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-blue-100 bg-slate-50 p-1 gap-1">
      {CHANNELS.map(({ id, label, icon: Icon }) => {
        const active = channel === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              active
                ? 'btn-brand shadow-sm'
                : 'bg-white text-slate-600 border border-gray-200 hover:border-blue-300 hover:text-blue-900'
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? '' : 'text-blue-800'}`} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function PromotionalSendMessages() {
  const permissionsLoaded = usePermissions()
  const { showSuccess, showError } = useSuccessPopup()
  const isTallyEnabled = resolveIsTallyEnabled()
  const areaGroupListingEnabled = isAdminSettingEnabled('area_group_listing')

  const [channel, setChannel] = useState('whatsapp')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedParent, setSelectedParent] = useState(null)
  const [selectedAreaGroup, setSelectedAreaGroup] = useState('')
  const [selectedLedgerType, setSelectedLedgerType] = useState('all')
  const [selectedIsActive, setSelectedIsActive] = useState('active')
  const [selectedIsTallySync, setSelectedIsTallySync] = useState(null)
  const [selectedCreatedById, setSelectedCreatedById] = useState('')
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState('')
  const [selectedCreditTypeId, setSelectedCreditTypeId] = useState('')
  const [selectedCategoryTypeId, setSelectedCategoryTypeId] = useState('')
  const [selectedReligion, setSelectedReligion] = useState('')
  const [selectedWeekOff, setSelectedWeekOff] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [selectedTaxationTypeId, setSelectedTaxationTypeId] = useState('')
  const [dateRangePreset, setDateRangePreset] = useState('all')
  const [fromDate, setFromDate] = useState(() => format(startOfDay(new Date()), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(() => format(endOfDay(new Date()), 'yyyy-MM-dd'))
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [selectedById, setSelectedById] = useState({})
  const [manualRecipients, setManualRecipients] = useState([])
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [whatsappSendMode, setWhatsappSendMode] = useState('message_only')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')
  const [documentFilename, setDocumentFilename] = useState('document.pdf')
  const [documentUploading, setDocumentUploading] = useState(false)
  const [carouselImageUrls, setCarouselImageUrls] = useState([])
  const [carouselCreateOpen, setCarouselCreateOpen] = useState(false)
  const [carouselNewName, setCarouselNewName] = useState('')
  const [carouselNewBody, setCarouselNewBody] = useState('')
  const [carouselButtonText, setCarouselButtonText] = useState('Know more')
  const [headerParams, setHeaderParams] = useState({})
  const [bodyParams, setBodyParams] = useState({})
  const [personalizeBodyName, setPersonalizeBodyName] = useState(true)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailHtmlBody, setEmailHtmlBody] = useState('')
  const [emailPersonalizeWithName, setEmailPersonalizeWithName] = useState(true)
  const [smsMessage, setSmsMessage] = useState('')
  const [smsPersonalizeWithName, setSmsPersonalizeWithName] = useState(true)
  const [lastResults, setLastResults] = useState([])
  const [lastSummary, setLastSummary] = useState(null)
  const [sendPopupOpen, setSendPopupOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setSelectedIds(new Set())
    setSelectedById({})
    setManualRecipients([])
    setLastResults([])
    setLastSummary(null)
    setSendPopupOpen(false)
  }, [channel])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  // Templates are mode-specific (image / document / carousel), so drop the old pick.
  useEffect(() => {
    setSelectedTemplateName('')
    setCarouselCreateOpen(false)
    setDocumentUrl('')
    setDocumentFilename('document.pdf')
    setImageFile(null)
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
  }, [whatsappSendMode])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    debouncedSearch,
    selectedBranchId,
    selectedParent,
    selectedAreaGroup,
    selectedLedgerType,
    selectedIsActive,
    selectedIsTallySync,
    selectedCreatedById,
    selectedBusinessTypeId,
    selectedCreditTypeId,
    selectedCategoryTypeId,
    selectedReligion,
    selectedWeekOff,
    selectedCity,
    selectedState,
    selectedTaxationTypeId,
    dateRangePreset,
  ])

  useEffect(() => {
    if (!areaGroupListingEnabled && selectedAreaGroup) {
      setSelectedAreaGroup('')
    }
  }, [areaGroupListingEnabled, selectedAreaGroup])

  useEffect(() => {
    const current = new Date()
    if (dateRangePreset === 'today') {
      setFromDate(format(startOfDay(current), 'yyyy-MM-dd'))
      setToDate(format(endOfDay(current), 'yyyy-MM-dd'))
    } else if (dateRangePreset === 'weekly') {
      setFromDate(format(startOfWeek(current, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      setToDate(format(endOfWeek(current, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
    } else if (dateRangePreset === 'monthly') {
      setFromDate(format(startOfMonth(current), 'yyyy-MM-dd'))
      setToDate(format(endOfMonth(current), 'yyyy-MM-dd'))
    }
  }, [dateRangePreset])

  const effectiveFromDate =
    dateRangePreset === 'all'
      ? ''
      : dateRangePreset === 'custom'
        ? fromDate
        : (() => {
            const n = new Date()
            if (dateRangePreset === 'today') return format(startOfDay(n), 'yyyy-MM-dd')
            if (dateRangePreset === 'weekly') {
              return format(startOfWeek(n, { weekStartsOn: 1 }), 'yyyy-MM-dd')
            }
            if (dateRangePreset === 'monthly') return format(startOfMonth(n), 'yyyy-MM-dd')
            return fromDate
          })()

  const effectiveToDate =
    dateRangePreset === 'all'
      ? ''
      : dateRangePreset === 'custom'
        ? toDate
        : (() => {
            const n = new Date()
            if (dateRangePreset === 'today') return format(endOfDay(n), 'yyyy-MM-dd')
            if (dateRangePreset === 'weekly') {
              return format(endOfWeek(n, { weekStartsOn: 1 }), 'yyyy-MM-dd')
            }
            if (dateRangePreset === 'monthly') return format(endOfMonth(n), 'yyyy-MM-dd')
            return toDate
          })()

  const dateFilterActive = Boolean(effectiveFromDate && effectiveToDate)

  const buildLedgerParams = () => {
    const params = {}
    if (debouncedSearch) params.search = debouncedSearch
    if (selectedBranchId) params.branch_id = String(selectedBranchId)
    if (selectedParent) params.parent = selectedParent
    if (areaGroupListingEnabled && selectedAreaGroup) {
      params.address_1 = selectedAreaGroup
    }
    if (selectedLedgerType && selectedLedgerType !== 'all') {
      params.ledger_type = selectedLedgerType
    }
    if (selectedIsActive && selectedIsActive !== 'all') {
      params.is_active = selectedIsActive === 'active' ? 'true' : 'false'
    } else if (selectedIsActive === 'all') {
      params.is_active = 'all'
    }
    if (selectedIsTallySync !== null) params.is_tally_sync = selectedIsTallySync
    if (selectedCreatedById) params.created_by_id = String(selectedCreatedById)
    if (selectedBusinessTypeId) params.business_type_id = String(selectedBusinessTypeId)
    if (selectedCreditTypeId) params.credit_type_id = String(selectedCreditTypeId)
    if (selectedCategoryTypeId) params.category_type_id = String(selectedCategoryTypeId)
    if (selectedReligion) params.religion = selectedReligion
    if (selectedWeekOff) params.week_off = selectedWeekOff
    if (selectedCity) params.city = selectedCity
    if (selectedState) params.state = selectedState
    if (selectedTaxationTypeId) params.taxation_type_id = String(selectedTaxationTypeId)
    if (effectiveFromDate) {
      params.created_from = effectiveFromDate
      params.from_date = effectiveFromDate
      params.date_from = effectiveFromDate
    }
    if (effectiveToDate) {
      params.created_to = effectiveToDate
      params.to_date = effectiveToDate
      params.date_to = effectiveToDate
    }
    if (dateFilterActive) {
      params.page = 1
      params.per_page = 5000
    } else {
      params.page = currentPage
      params.per_page = PAGE_SIZE
    }
    return params
  }

  const templatesQueryEnabled = permissionsLoaded && channel === 'whatsapp'

  const {
    data: templatesData,
    isLoading: templatesLoading,
    isFetching: templatesFetching,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['promotional-message-templates'],
    queryFn: () => fetchMessageTemplates(),
    staleTime: 60_000,
    enabled: templatesQueryEnabled,
  })

  const templates = useMemo(() => templatesData?.templates || [], [templatesData])

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.name === selectedTemplateName) || null,
    [templates, selectedTemplateName],
  )

  const selectedStatus = String(selectedTemplate?.status || '').toUpperCase()
  const canSendSelectedTemplate = selectedStatus === 'APPROVED'

  const headerPlaceholders = useMemo(() => {
    const header = getTemplateComponent(selectedTemplate, 'HEADER')
    if (!header || String(header.format || '').toUpperCase() !== 'TEXT') return []
    return extractTemplatePlaceholders(header.text)
  }, [selectedTemplate])

  const bodyPlaceholders = useMemo(() => {
    const body = getTemplateComponent(selectedTemplate, 'BODY')
    return extractTemplatePlaceholders(body?.text)
  }, [selectedTemplate])

  useEffect(() => {
    setHeaderParams({})
    setBodyParams({})
    const body = getTemplateComponent(selectedTemplate, 'BODY')
    const examples = body?.example?.body_text?.[0]
    if (Array.isArray(examples)) {
      const next = {}
      examples.forEach((value, index) => {
        next[index + 1] = String(value ?? '')
      })
      setBodyParams(next)
    }
    const header = getTemplateComponent(selectedTemplate, 'HEADER')
    const headerExamples = header?.example?.header_text
    if (Array.isArray(headerExamples)) {
      const next = {}
      headerExamples.forEach((value, index) => {
        next[index + 1] = String(value ?? '')
      })
      setHeaderParams(next)
    }
  }, [selectedTemplateName])

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branch-settings', 'promotional-send-filter'],
    queryFn: () => fetchBranchSettings({ include_inactive: true }),
    enabled: permissionsLoaded,
  })

  const branchOptions = useMemo(
    () => [
      { value: '', label: 'All branches' },
      ...branches.map((branch) => ({
        value: String(branch.id),
        label: branch.name || String(branch.id),
      })),
    ],
    [branches],
  )
  const showBranchFilter = branches.length > 1

  const didApplyDashboardBranchRef = useRef(false)

  useEffect(() => {
    if (!showBranchFilter) return
    if (didApplyDashboardBranchRef.current) return
    didApplyDashboardBranchRef.current = true
    if (selectedBranchId) return
    const preferred = getDashboardSelectedBranchId()
    if (!preferred) return
    if (!branches.some((branch) => String(branch.id) === preferred)) return
    setSelectedBranchId(preferred)
  }, [showBranchFilter, branches, selectedBranchId])

  const { data: usersList = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users-list-promotional-send-filter'],
    queryFn: fetchUsersForFilter,
    enabled: permissionsLoaded,
    staleTime: 60_000,
  })

  const {
    data: ledgerResponse,
    isLoading: ledgersLoading,
    isFetching: ledgersFetching,
    error: ledgersError,
    refetch: refetchLedgers,
  } = useQuery({
    queryKey: [
      'promotional-send-ledgers',
      debouncedSearch,
      selectedBranchId,
      selectedParent,
      selectedAreaGroup,
      selectedLedgerType,
      selectedIsActive,
      selectedIsTallySync,
      selectedCreatedById,
      selectedBusinessTypeId,
      selectedCreditTypeId,
      selectedCategoryTypeId,
      selectedReligion,
      selectedWeekOff,
      selectedCity,
      selectedState,
      selectedTaxationTypeId,
      effectiveFromDate,
      effectiveToDate,
      dateFilterActive ? 'date-all' : currentPage,
      areaGroupListingEnabled,
    ],
    queryFn: () => fetchLedgers(buildLedgerParams()),
    enabled: permissionsLoaded,
    placeholderData: (previous) => previous,
  })

  const createdByOptions = useMemo(() => {
    const byId = new Map()
    for (const user of usersList) {
      const id = getUserId(user)
      const label = getUserDisplayName(user)
      if (!id || !label) continue
      byId.set(id, {
        value: id,
        label,
        searchText: [label, user.mobile, user.role_name, id].filter(Boolean).join(' '),
        hint: user.is_active === false || user.is_active === 0 ? 'Inactive' : undefined,
        hintClassName: 'text-amber-600',
      })
    }
    for (const entry of ledgerResponse?.data ?? []) {
      const id = String(
        entry?.created_by_id ??
          entry?.created_by?.id ??
          entry?.created_by?.user_id ??
          '',
      ).trim()
      if (!id || byId.has(id)) continue
      const label =
        (typeof entry.created_by === 'string' && entry.created_by.trim()) ||
        entry.created_by?.name ||
        entry.created_by_name ||
        id
      byId.set(id, {
        value: id,
        label,
        searchText: `${label} ${id}`,
      })
    }
    return [
      { value: '', label: 'All users' },
      ...[...byId.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [usersList, ledgerResponse?.data])

  const filteredLedgerRows = useMemo(() => {
    let rows = ledgerResponse?.data ?? []
    if (selectedLedgerType && selectedLedgerType !== 'all') {
      rows = rows.filter((entry) => resolveLedgerType(entry) === selectedLedgerType)
    }
    if (dateFilterActive) {
      rows = rows.filter((entry) =>
        isCreatedAtInRange(entry.created_at, effectiveFromDate, effectiveToDate),
      )
    }
    return rows
  }, [ledgerResponse?.data, selectedLedgerType, dateFilterActive, effectiveFromDate, effectiveToDate])

  const dateFilteredTotal = filteredLedgerRows.length
  const dateFilteredPages = Math.max(1, Math.ceil(dateFilteredTotal / PAGE_SIZE))
  const safeDatePage = Math.min(currentPage, dateFilteredPages)

  const ledgers = useMemo(() => {
    if (!dateFilterActive) return filteredLedgerRows
    const start = (safeDatePage - 1) * PAGE_SIZE
    return filteredLedgerRows.slice(start, start + PAGE_SIZE)
  }, [filteredLedgerRows, dateFilterActive, safeDatePage])

  const pagination = dateFilterActive
    ? {
        current_page: safeDatePage,
        total_count: dateFilteredTotal,
        total_pages: dateFilteredPages,
        per_page: PAGE_SIZE,
        has_next: safeDatePage < dateFilteredPages,
        has_previous: safeDatePage > 1,
      }
    : ledgerResponse?.pagination ?? {}
  const totalCount = pagination.total_count ?? 0
  const totalPages = pagination.total_pages ?? 1
  const currentPageNum = pagination.current_page ?? currentPage

  const {
    data: ledgersBreakdown,
    isLoading: breakdownLoading,
  } = useQuery({
    queryKey: ['ledgers-breakdown', 'promotional-send', selectedBranchId, selectedIsActive],
    queryFn: () => {
      const params = {}
      if (selectedBranchId) params.branch_id = String(selectedBranchId)
      if (selectedIsActive === 'active') params.is_active = 'true'
      else if (selectedIsActive === 'inactive') params.is_active = 'false'
      return fetchLedgersBreakdown(params)
    },
    enabled: permissionsLoaded && moreFiltersOpen,
  })

  const { data: parentGroups = [] } = useQuery({
    queryKey: ['ledger-groups-parent-filter', 'promotional-send', selectedBranchId],
    queryFn: async () => {
      const params = { is_live: 'true', page: 1, per_page: 1000 }
      if (selectedBranchId) params.branch_id = String(selectedBranchId)
      const res = await fetchLedgerGroups(params)
      return res.data ?? []
    },
    enabled: permissionsLoaded,
  })

  const uniqueParents = useMemo(() => {
    const names = [...new Set(parentGroups.map((g) => g.name).filter((n) => n && n.trim()))]
    return names.sort()
  }, [parentGroups])

  const parentFilterOptions = useMemo(
    () => [
      { value: '', label: 'All parents' },
      ...uniqueParents.map((p) => ({ value: p, label: p })),
    ],
    [uniqueParents],
  )

  const { data: areaGroupsData, isLoading: areaGroupsLoading } = useQuery({
    queryKey: ['ledger-area-groups-filter', 'promotional-send', selectedBranchId],
    queryFn: () => {
      const params = { is_active: 'true', page: 1, per_page: 1000 }
      if (selectedBranchId) params.branch_id = String(selectedBranchId)
      return fetchLedgerAreaGroups(params)
    },
    enabled: permissionsLoaded && areaGroupListingEnabled,
  })

  const areaGroupFilterOptions = useMemo(() => {
    const names = [
      ...new Set(
        (areaGroupsData?.data ?? [])
          .map((row) => String(row?.name || '').trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b))
    return [
      { value: '', label: 'All area groups' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [areaGroupsData])

  const { data: filterBusinessTypes = [], isLoading: filterBusinessLoading } = useQuery({
    queryKey: ['business-types-promotional-send-filter'],
    queryFn: () => fetchBusinessTypes({ page_size: 500 }),
    enabled: permissionsLoaded,
    staleTime: 60_000,
  })

  const { data: filterCreditTypes = [], isLoading: filterCreditLoading } = useQuery({
    queryKey: ['credit-types-promotional-send-filter'],
    queryFn: () => fetchCreditTypes({ page_size: 500 }),
    enabled: permissionsLoaded,
    staleTime: 60_000,
  })

  const { data: classificationListings, isLoading: classificationListingsLoading } = useQuery({
    queryKey: ['promotional-send-classification-listings'],
    queryFn: () => fetchCommonListings(['category_types', 'religions']),
    enabled: permissionsLoaded,
    staleTime: 60_000,
  })

  const businessTypeFilterOptions = useMemo(
    () => [
      { value: '', label: 'All business types' },
      { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
      ...filterBusinessTypes.map((row) => ({
        value: String(row.id),
        label: row.name || String(row.id),
      })),
    ],
    [filterBusinessTypes],
  )

  const creditTypeFilterOptions = useMemo(
    () => [
      { value: '', label: 'All credit types' },
      { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
      ...filterCreditTypes.map((row) => ({
        value: String(row.id),
        label: row.name || String(row.id),
      })),
    ],
    [filterCreditTypes],
  )

  const categoryTypeFilterOptions = useMemo(() => {
    const rows = classificationListings?.data?.category_types ?? []
    return [
      { value: '', label: 'All category types' },
      { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
      ...rows.map((row) => ({
        value: String(row.id),
        label: row.type || row.name || String(row.id),
      })),
    ]
  }, [classificationListings])

  const religionFilterOptions = useMemo(() => {
    const rows = classificationListings?.data?.religions ?? []
    const names = [
      ...new Set(
        rows
          .map((row) => String(row.religion || row.name || '').trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b))
    return [
      { value: '', label: 'All religions' },
      { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [classificationListings])

  const cityFilterOptions = useMemo(() => {
    const names = [
      ...new Set(
        (ledgersBreakdown?.cities ?? [])
          .map((row) => String(row?.name || '').trim())
          .filter((name) => name && name.toLowerCase() !== 'not set'),
      ),
    ].sort((a, b) => a.localeCompare(b))
    return [
      { value: '', label: 'All cities' },
      { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [ledgersBreakdown])

  const stateFilterOptions = useMemo(() => {
    const names = [
      ...new Set(
        (ledgersBreakdown?.states ?? [])
          .map((row) => String(row?.name || '').trim())
          .filter((name) => name && name.toLowerCase() !== 'not set'),
      ),
    ].sort((a, b) => a.localeCompare(b))
    return [
      { value: '', label: 'All states' },
      { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [ledgersBreakdown])

  const taxationTypeFilterOptions = useMemo(() => {
    const rows = ledgersBreakdown?.taxation_types ?? []
    const options = rows
      .map((row) => ({
        value: row?.id != null && row.id !== '' ? String(row.id) : BREAKDOWN_EMPTY_VALUE,
        label: String(row?.name || 'Not set').trim() || 'Not set',
      }))
      .filter((row) => row.label)
    const unique = []
    const seen = new Set()
    for (const option of options) {
      if (seen.has(option.value)) continue
      seen.add(option.value)
      unique.push(option)
    }
    return [
      { value: '', label: 'All taxation types' },
      { value: BREAKDOWN_EMPTY_VALUE, label: 'Not set' },
      ...unique.filter((option) => option.value !== BREAKDOWN_EMPTY_VALUE),
    ]
  }, [ledgersBreakdown])

  const carouselTemplates = useMemo(
    () => templates.filter((template) => getCarouselCards(template).length > 0),
    [templates],
  )

  const templateOptions = useMemo(() => {
    let list = templates
    if (whatsappSendMode === 'message_with_image') {
      const imageTemplates = templates.filter((template) => {
        const header = getTemplateComponent(template, 'HEADER')
        return String(header?.format || '').toUpperCase() === 'IMAGE'
      })
      list = imageTemplates.length ? imageTemplates : templates
    } else if (whatsappSendMode === 'message_with_document') {
      const documentTemplates = templates.filter((template) => {
        const header = getTemplateComponent(template, 'HEADER')
        return String(header?.format || '').toUpperCase() === 'DOCUMENT'
      })
      list = documentTemplates
    } else if (whatsappSendMode === 'carousel') {
      list = carouselTemplates
    } else {
      // Text / no-media templates — exclude media-header and carousel templates.
      list = templates.filter((template) => {
        if (getCarouselCards(template).length > 0) return false
        const header = getTemplateComponent(template, 'HEADER')
        const format = String(header?.format || '').toUpperCase()
        return format !== 'IMAGE' && format !== 'DOCUMENT' && format !== 'VIDEO'
      })
    }

    return [
      { value: '', label: 'Select template' },
      ...list.map((template) => {
        const status = String(template.status || 'UNKNOWN').toUpperCase()
        const cardCount = getCarouselCards(template).length
        return {
          value: template.name,
          label: `${template.name} (${template.language || 'n/a'})${
            cardCount ? ` · ${cardCount} cards` : ''
          }`,
          searchText: `${template.name} ${template.language || ''} ${status} ${template.category || ''}`,
          hint: humanizeTemplateValue(status),
          hintClassName: STATUS_HINT_CLASS[status] || STATUS_HINT_CLASS.PAUSED,
        }
      }),
    ]
  }, [templates, carouselTemplates, whatsappSendMode])

  const carouselCardCount = useMemo(
    () => getCarouselCards(selectedTemplate).length,
    [selectedTemplate],
  )

  const carouselCardCountMatches =
    carouselCardCount > 0 && carouselCardCount === carouselImageUrls.length

  const hasCarouselTemplates = carouselTemplates.length > 0
  // With nothing to pick from, the create form is the only way forward — keep it open.
  const showCarouselCreate = carouselCreateOpen || !hasCarouselTemplates

  const clearImageSelection = () => {
    setImageFile(null)
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
  }

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      clearImageSelection()
      return
    }
    const type = String(file.type || '').toLowerCase()
    if (type && !ACCEPTED_IMAGE_TYPES.includes(type) && !type.startsWith('image/')) {
      showError('Please select a JPG, PNG, or WEBP image.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_WHATSAPP_IMAGE_BYTES) {
      showError('Image is too large (max 5 MB).')
      event.target.value = ''
      return
    }
    setImageFile(file)
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const previewHeaderValues = useMemo(() => {
    if (!headerPlaceholders.length) return undefined
    return headerPlaceholders.map((index) => headerParams[index] || '')
  }, [headerPlaceholders, headerParams])

  const previewBodyValues = useMemo(() => {
    if (!bodyPlaceholders.length) return undefined
    return bodyPlaceholders.map((index) => {
      if (personalizeBodyName && index === 1) {
        return bodyParams[index] || 'Customer Name'
      }
      return bodyParams[index] || ''
    })
  }, [bodyPlaceholders, bodyParams, personalizeBodyName])

  const pageSelectableIds = useMemo(
    () =>
      ledgers
        .filter((entry) => isRowSelectable(entry, channel))
        .map((entry) => entry.id),
    [ledgers, channel],
  )

  const allPageSelected =
    pageSelectableIds.length > 0 && pageSelectableIds.every((id) => selectedIds.has(id))

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageSelectableIds.forEach((id) => next.delete(id))
      } else {
        pageSelectableIds.forEach((id) => next.add(id))
      }
      return next
    })
    setSelectedById((prev) => {
      const next = { ...prev }
      if (allPageSelected) {
        pageSelectableIds.forEach((id) => {
          delete next[id]
        })
      } else {
        ledgers.forEach((entry) => {
          if (isRowSelectable(entry, channel)) {
            next[entry.id] = entry
          }
        })
      }
      return next
    })
  }

  const toggleRow = (entry) => {
    if (!isRowSelectable(entry, channel)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(entry.id)) next.delete(entry.id)
      else next.add(entry.id)
      return next
    })
    setSelectedById((prev) => {
      const next = { ...prev }
      if (next[entry.id]) delete next[entry.id]
      else next[entry.id] = entry
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectedById({})
  }

  const emptyManualRecipient = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mobile: '',
    name: '',
  })

  const addManualRecipient = () => {
    setManualRecipients((prev) => [...prev, emptyManualRecipient()])
  }

  const updateManualRecipient = (key, field, value) => {
    setManualRecipients((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    )
  }

  const removeManualRecipient = (key) => {
    setManualRecipients((prev) => prev.filter((row) => row.key !== key))
  }

  const parsedManualRecipients = useMemo(() => {
    const rows = []
    for (const row of manualRecipients) {
      const digits = normalizePhone(row.mobile)
      const name = String(row.name || '').trim()
      if (!digits && !name) continue
      rows.push({
        key: row.key,
        to: digits,
        name: name || 'Customer',
        valid: digits.length >= 10,
      })
    }
    return rows
  }, [manualRecipients])

  const validManualRecipients = useMemo(
    () => parsedManualRecipients.filter((row) => row.valid),
    [parsedManualRecipients],
  )

  const totalRecipientCount = selectedIds.size + validManualRecipients.length

  const buildSendRecipients = () => {
    const fromLedgers = Array.from(selectedIds).map((id) => {
      const entry = selectedById[id]
      return {
        party_id: id,
        to: getLedgerMobile(entry),
        name: getLedgerDisplayName(entry),
        email: getLedgerEmail(entry),
      }
    })
    const fromManual = validManualRecipients.map((row) => ({
      party_id: null,
      to: row.to,
      name: row.name,
      email: '',
    }))
    return [...fromLedgers, ...fromManual]
  }

  const handleSendSuccess = (result) => {
    const rows = Array.isArray(result.data) ? result.data : []
    setLastResults(rows)
    const summary = result.summary || {
      total: rows.length,
      sent: rows.filter((row) => String(row?.status || '').toLowerCase() === 'sent').length,
      failed: rows.filter((row) => String(row?.status || '').toLowerCase() === 'failed').length,
      skipped: rows.filter((row) => String(row?.status || '').toLowerCase() === 'skipped').length,
    }
    setLastSummary(summary)
    const message =
      result.message ||
      `Send completed: ${summary.sent || 0} sent, ${summary.failed || 0} failed, ${summary.skipped || 0} skipped`
    const hasFailures = Number(summary.failed || 0) > 0
    const missingIds = rows.some(
      (row) => row?.status === 'sent' && !row?.message_id,
    )
    if (hasFailures || missingIds) showError(message)
    else showSuccess(message, { duration: 3500 })
    setSendPopupOpen(false)
  }

  const handleSendError = (error) => {
    const result = error?.result
    const rows = Array.isArray(result?.data) ? result.data : []
    if (rows.length) setLastResults(rows)
    if (result?.summary) {
      setLastSummary(result.summary)
    } else if (rows.length) {
      setLastSummary({
        total: rows.length,
        sent: rows.filter((row) => String(row?.status || '').toLowerCase() === 'sent').length,
        failed: rows.filter((row) => String(row?.status || '').toLowerCase() === 'failed').length,
        skipped: rows.filter((row) => String(row?.status || '').toLowerCase() === 'skipped').length,
      })
    }
    showError(error.message || 'Failed to send messages')
  }

  const whatsappSendMutation = useMutation({
    mutationFn: sendPromotionalMessages,
    onSuccess: handleSendSuccess,
    onError: handleSendError,
  })

  const whatsappImageSendMutation = useMutation({
    mutationFn: sendPromotionalImageMessages,
    onSuccess: handleSendSuccess,
    onError: handleSendError,
  })

  const carouselSendMutation = useMutation({
    mutationFn: sendCarouselMessages,
    onSuccess: handleSendSuccess,
    onError: handleSendError,
  })

  const carouselTemplateMutation = useMutation({
    mutationFn: createCarouselTemplate,
    onSuccess: (result) => {
      showSuccess(result.message || 'Carousel template submitted to Meta for approval', {
        duration: 6000,
      })
      setCarouselCreateOpen(false)
      setCarouselNewName('')
      setCarouselNewBody('')
      refetchTemplates()
      const createdName = result?.data?.template_name
      if (createdName) setSelectedTemplateName(createdName)
    },
    onError: (error) => showError(error.message || 'Failed to create carousel template'),
  })

  const emailSendMutation = useMutation({
    mutationFn: sendPromotionalEmails,
    onSuccess: handleSendSuccess,
    onError: handleSendError,
  })

  const smsSendMutation = useMutation({
    mutationFn: sendPromotionalSms,
    onSuccess: handleSendSuccess,
    onError: handleSendError,
  })

  const isSending =
    whatsappSendMutation.isPending ||
    whatsappImageSendMutation.isPending ||
    carouselSendMutation.isPending ||
    emailSendMutation.isPending ||
    smsSendMutation.isPending

  const validateWhatsappBeforeSend = () => {
    if (!totalRecipientCount) {
      showError('Please select at least one ledger or add a mobile number.')
      return false
    }
    const invalidManual = parsedManualRecipients.find((row) => !row.valid)
    if (invalidManual) {
      showError(`Enter a valid 10-digit mobile for ${invalidManual.name}.`)
      return false
    }

    if (whatsappSendMode === 'carousel') {
      if (carouselImageUrls.length < MIN_CAROUSEL_CARDS) {
        showError(`Upload and select at least ${MIN_CAROUSEL_CARDS} images for a carousel.`)
        return false
      }
      if (!selectedTemplate) {
        showError('Please select an approved carousel template.')
        return false
      }
      if (!canSendSelectedTemplate) {
        showError(
          `Only APPROVED templates can be sent. Current status: ${selectedStatus || 'UNKNOWN'}.`,
        )
        return false
      }
      if (!carouselCardCountMatches) {
        showError(
          `"${selectedTemplate.name}" was approved for ${carouselCardCount} cards, but ` +
            `${carouselImageUrls.length} images are selected. The counts must match.`,
        )
        return false
      }
      for (const index of bodyPlaceholders) {
        if (personalizeBodyName && index === 1) continue
        if (!String(bodyParams[index] || '').trim()) {
          showError(`Please fill body parameter {{${index}}}.`)
          return false
        }
      }
      return true
    }

    if (whatsappSendMode === 'message_with_image') {
      if (!selectedTemplate) {
        showError('Please select a WhatsApp image template.')
        return false
      }
      if (!canSendSelectedTemplate) {
        showError(
          `Only APPROVED templates can be sent. Current status: ${selectedStatus || 'UNKNOWN'}.`,
        )
        return false
      }
      if (!imageFile) {
        showError('Please upload an image from your device.')
        return false
      }
      for (const index of bodyPlaceholders) {
        if (personalizeBodyName && index === 1) continue
        if (!String(bodyParams[index] || '').trim()) {
          showError(`Please fill body parameter {{${index}}}.`)
          return false
        }
      }
      return true
    }

    if (whatsappSendMode === 'message_with_document') {
      if (!selectedTemplate) {
        showError('Please select a WhatsApp document template.')
        return false
      }
      if (!canSendSelectedTemplate) {
        showError(
          `Only APPROVED templates can be sent. Current status: ${selectedStatus || 'UNKNOWN'}.`,
        )
        return false
      }
      if (!documentUrl) {
        showError('Please upload a PDF document.')
        return false
      }
      for (const index of bodyPlaceholders) {
        if (personalizeBodyName && index === 1) continue
        if (!String(bodyParams[index] || '').trim()) {
          showError(`Please fill body parameter {{${index}}}.`)
          return false
        }
      }
      return true
    }

    if (!selectedTemplate) {
      showError('Please select a WhatsApp template.')
      return false
    }
    if (!canSendSelectedTemplate) {
      showError(
        `Only APPROVED templates can be sent. Current status: ${selectedStatus || 'UNKNOWN'}.`,
      )
      return false
    }
    for (const index of headerPlaceholders) {
      if (!String(headerParams[index] || '').trim()) {
        showError(`Please fill header parameter {{${index}}}.`)
        return false
      }
    }
    for (const index of bodyPlaceholders) {
      if (personalizeBodyName && index === 1) continue
      if (!String(bodyParams[index] || '').trim()) {
        showError(`Please fill body parameter {{${index}}}.`)
        return false
      }
    }
    return true
  }

  const validateEmailBeforeSend = () => {
    if (!totalRecipientCount) {
      showError('Please select at least one ledger or add a recipient.')
      return false
    }
    if (validManualRecipients.length) {
      showError('Manual mobile numbers are for WhatsApp/SMS only. Select ledgers with email for email send.')
      return false
    }
    if (!emailSubject.trim()) {
      showError('Please enter an email subject.')
      return false
    }
    if (!emailBody.trim()) {
      showError('Please enter an email body.')
      return false
    }
    return true
  }

  const validateSmsBeforeSend = () => {
    if (!totalRecipientCount) {
      showError('Please select at least one ledger or add a mobile number.')
      return false
    }
    const invalidManual = parsedManualRecipients.find((row) => !row.valid)
    if (invalidManual) {
      showError(`Enter a valid 10-digit mobile for ${invalidManual.name}.`)
      return false
    }
    if (!smsMessage.trim()) {
      showError('Please enter an SMS message.')
      return false
    }
    return true
  }

  const openSendPopup = () => {
    if (!totalRecipientCount) {
      showError('Please select at least one ledger or add a mobile number.')
      return
    }
    const invalidManual = parsedManualRecipients.find((row) => !row.valid)
    if (invalidManual) {
      showError(`Enter a valid 10-digit mobile for ${invalidManual.name}.`)
      return
    }
    setSendPopupOpen(true)
  }

  const handleWhatsappSend = () => {
    if (!validateWhatsappBeforeSend()) return

    const recipients = buildSendRecipients().map((row) => ({
      party_id: row.party_id,
      to: row.to,
      name: row.name,
    }))

    if (whatsappSendMode === 'carousel') {
      carouselSendMutation.mutate({
        template_name: selectedTemplate.name,
        language_code: resolveTemplateLanguage(selectedTemplate),
        body_params: bodyPlaceholders.map((index) => String(bodyParams[index] ?? '')),
        cards: carouselImageUrls.map((url) => ({ image_url: url })),
        personalize_body_with_name: personalizeBodyName && bodyPlaceholders.includes(1),
        recipients,
      })
      return
    }

    if (whatsappSendMode === 'message_with_image') {
      whatsappImageSendMutation.mutate({
        imageFile,
        template_name: selectedTemplate.name,
        language_code: resolveTemplateLanguage(selectedTemplate),
        personalize_body_with_name: personalizeBodyName && bodyPlaceholders.includes(1),
        create_template: false,
        body_param: bodyParams[1] || '',
        recipients,
      })
      return
    }

    if (whatsappSendMode === 'message_with_document') {
      const components = buildTemplateComponentsPayload(selectedTemplate, {
        headerParams,
        bodyParams,
        documentLink: documentUrl,
        documentFilename,
      })
      whatsappSendMutation.mutate({
        template_name: selectedTemplate.name,
        language_code: resolveTemplateLanguage(selectedTemplate),
        components,
        personalize_body_with_name: personalizeBodyName && bodyPlaceholders.includes(1),
        recipients,
      })
      return
    }

    const components = buildTemplateComponentsPayload(selectedTemplate, {
      headerParams,
      bodyParams,
    })

    whatsappSendMutation.mutate({
      template_name: selectedTemplate.name,
      language_code: resolveTemplateLanguage(selectedTemplate),
      components,
      personalize_body_with_name: personalizeBodyName && bodyPlaceholders.includes(1),
      recipients,
    })
  }

  const handleCreateCarouselTemplate = () => {
    if (carouselImageUrls.length < MIN_CAROUSEL_CARDS) {
      showError(`Select at least ${MIN_CAROUSEL_CARDS} uploaded images first.`)
      return
    }
    if (!carouselNewName.trim()) {
      showError('Enter a name for the carousel template.')
      return
    }
    if (!carouselNewBody.trim()) {
      showError('Enter the message body shown above the cards.')
      return
    }

    carouselTemplateMutation.mutate({
      name: carouselNewName.trim(),
      body_text: carouselNewBody.trim(),
      body_examples: ['Customer'],
      language_code: 'en_US',
      button_text: carouselButtonText.trim() || 'Know more',
      cards: carouselImageUrls.map((url) => ({ image_url: url })),
    })
  }

  const handleEmailSend = () => {
    if (!validateEmailBeforeSend()) return

    const recipients = buildSendRecipients().map((row) => ({
      party_id: row.party_id,
      email: row.email,
      name: row.name,
    }))

    const payload = {
      subject: emailSubject.trim(),
      body: emailBody.trim(),
      personalize_with_name: emailPersonalizeWithName,
      recipients,
    }
    if (emailHtmlBody.trim()) {
      payload.html_body = emailHtmlBody.trim()
    }

    emailSendMutation.mutate(payload)
  }

  const handleSmsSend = () => {
    if (!validateSmsBeforeSend()) return

    const recipients = buildSendRecipients().map((row) => ({
      party_id: row.party_id,
      to: row.to,
      name: row.name,
    }))

    smsSendMutation.mutate({
      message: smsMessage.trim(),
      personalize_with_name: smsPersonalizeWithName,
      recipients,
    })
  }

  const clearAllFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setSelectedBranchId('')
    setSelectedParent(null)
    setSelectedAreaGroup('')
    setSelectedLedgerType('all')
    setSelectedIsActive('active')
    setSelectedIsTallySync(null)
    setSelectedCreatedById('')
    setSelectedBusinessTypeId('')
    setSelectedCreditTypeId('')
    setSelectedCategoryTypeId('')
    setSelectedReligion('')
    setSelectedWeekOff('')
    setSelectedCity('')
    setSelectedState('')
    setSelectedTaxationTypeId('')
    setDateRangePreset('all')
    const now = new Date()
    setFromDate(format(startOfDay(now), 'yyyy-MM-dd'))
    setToDate(format(endOfDay(now), 'yyyy-MM-dd'))
    setCurrentPage(1)
  }

  const clearMoreFilters = () => {
    setSelectedBranchId('')
    setSelectedParent(null)
    setSelectedAreaGroup('')
    setSelectedLedgerType('all')
    setSelectedIsActive('active')
    setSelectedIsTallySync(null)
    setSelectedCreatedById('')
    setSelectedBusinessTypeId('')
    setSelectedCreditTypeId('')
    setSelectedCategoryTypeId('')
    setSelectedReligion('')
    setSelectedWeekOff('')
    setSelectedCity('')
    setSelectedState('')
    setSelectedTaxationTypeId('')
    setCurrentPage(1)
  }

  const hasMoreFiltersActive =
    Boolean(selectedBranchId) ||
    Boolean(selectedParent) ||
    Boolean(selectedAreaGroup) ||
    selectedLedgerType !== 'all' ||
    selectedIsActive !== 'active' ||
    selectedIsTallySync !== null ||
    Boolean(selectedCreatedById) ||
    Boolean(selectedBusinessTypeId) ||
    Boolean(selectedCreditTypeId) ||
    Boolean(selectedCategoryTypeId) ||
    Boolean(selectedReligion) ||
    Boolean(selectedWeekOff) ||
    Boolean(selectedCity) ||
    Boolean(selectedState) ||
    Boolean(selectedTaxationTypeId)

  const hasActiveFilters =
    Boolean(debouncedSearch) || dateRangePreset !== 'all' || hasMoreFiltersActive

  const isBusy =
    !permissionsLoaded ||
    (channel === 'whatsapp' && templatesLoading && !templatesData) ||
    (ledgersLoading && !ledgerResponse) ||
    isSending
  const isSearchingCustomers = ledgersFetching && Boolean(ledgerResponse)

  const selectedRecipientsPreview = useMemo(
    () =>
      Array.from(selectedIds)
        .slice(0, 8)
        .map((id) => selectedById[id])
        .filter(Boolean),
    [selectedIds, selectedById],
  )

  const showContactColumn = channel === 'whatsapp' || channel === 'sms'
  const tableColSpan = 5

  const renderRecipientsList = () => (
    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
      {selectedRecipientsPreview.map((entry) => (
        <div key={entry.id} className="px-3 py-2.5 text-sm">
          <p className="font-medium text-slate-900 truncate">{getLedgerDisplayName(entry) || '—'}</p>
          <p className="text-xs text-slate-500">
            {getRecipientContact(entry, channel) || '—'}
            {entry.city ? ` · ${entry.city}` : ''}
            {getLedgerState(entry) ? ` · ${getLedgerState(entry)}` : ''}
          </p>
        </div>
      ))}
      {validManualRecipients.map((row) => (
        <div key={row.key} className="px-3 py-2.5 text-sm">
          <p className="font-medium text-slate-900 truncate">{row.name}</p>
          <p className="text-xs text-slate-500">{row.to} · manual</p>
        </div>
      ))}
      {selectedIds.size > selectedRecipientsPreview.length ? (
        <div className="px-3 py-2.5 text-xs text-slate-500">
          +{selectedIds.size - selectedRecipientsPreview.length} more ledgers selected
        </div>
      ) : null}
      {!totalRecipientCount ? (
        <div className="px-3 py-3 text-sm text-slate-500">No recipients selected</div>
      ) : null}
    </div>
  )

  return (
    <AppPageShell>
    <div className="flex flex-col min-h-0 flex-1">
      {isBusy ? <Loader /> : null}

      <PageHeader title="Send notifications">
        <ChannelToggle channel={channel} onChange={setChannel} />
        <button
          type="button"
          onClick={() => {
            if (channel === 'whatsapp') refetchTemplates()
            refetchLedgers()
          }}
          disabled={(channel === 'whatsapp' && templatesFetching) || ledgersFetching}
          className="inline-flex items-center gap-2 h-9 sm:h-11 px-3 sm:px-4 rounded-lg border border-gray-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {(channel === 'whatsapp' && templatesFetching) || ledgersFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </PageHeader>

      <main className="flex-1 p-4 sm:p-6 space-y-4 pb-28">
        <p className="text-sm text-slate-500 -mt-1">{CHANNEL_SUBTITLES[channel]}</p>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col xl:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0 w-full">
              <FilterLabel icon={Search}>Search</FilterLabel>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search ledgers..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className={filterInputClass}
                />
              </div>
            </div>
            <div className="w-full xl:w-44 shrink-0">
              <FilterLabel icon={Calendar}>Date Range</FilterLabel>
              <SimpleSelect
                id="promotionalDateRangePreset"
                value={dateRangePreset}
                options={DATE_PRESET_OPTIONS}
                onChange={(value) => {
                  setDateRangePreset(value)
                  setCurrentPage(1)
                }}
                placeholder="Select range"
              />
            </div>
            <div className="w-full xl:w-44 shrink-0">
              <FilterLabel icon={Calendar}>From Date</FilterLabel>
              <BrandDatePicker
                value={fromDate}
                disabled={dateRangePreset !== 'custom'}
                onChange={(value) => {
                  setFromDate(value)
                  if (toDate && value > toDate) {
                    setToDate(value)
                  }
                  setCurrentPage(1)
                }}
                fullWidth
                menuAlign="left"
              />
            </div>
            <div className="w-full xl:w-44 shrink-0">
              <FilterLabel icon={Calendar}>To Date</FilterLabel>
              <BrandDatePicker
                value={toDate}
                min={dateRangePreset === 'custom' ? fromDate : undefined}
                disabled={dateRangePreset !== 'custom'}
                onChange={(value) => {
                  setToDate(value)
                  setCurrentPage(1)
                }}
                fullWidth
                menuAlign="left"
              />
            </div>
            <div className="w-full xl:w-auto shrink-0">
              <span className="mb-1.5 block h-5" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setMoreFiltersOpen(true)}
                className={`relative inline-flex h-[42px] w-full xl:w-[42px] items-center justify-center gap-2 rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer ${
                  hasMoreFiltersActive ? 'btn-brand ring-2 ring-blue-800/30 ring-offset-1' : 'btn-brand'
                }`}
                title="More filters"
                aria-label="Open more filters"
              >
                <Filter className="h-4 w-4" />
                <span className="xl:hidden">More filters</span>
                {hasMoreFiltersActive && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                    !
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {totalCount} ledger{totalCount !== 1 ? 's' : ''}
              {selectedIds.size > 0 ? ` · ${selectedIds.size} ledger selected` : ''}
              {validManualRecipients.length > 0
                ? ` · ${validManualRecipients.length} manual number${validManualRecipients.length === 1 ? '' : 's'}`
                : ''}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-800 font-medium"
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <User className="h-5 w-5 text-blue-800 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Ledgers</h2>
                <p className="text-sm text-slate-500">
                  {selectedIds.size} selected · showing page {currentPageNum} of {totalPages} ({totalCount} total)
                </p>
              </div>
            </div>
            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={clearSelection}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Clear selection
              </button>
            ) : null}
          </div>

          {ledgersError ? (
            <div className="p-6 text-center text-red-700">{ledgersError.message}</div>
          ) : (
            <>
              <div className={`overflow-x-auto transition-opacity ${isSearchingCustomers ? 'opacity-60' : 'opacity-100'}`}>
                <table className="w-full min-w-[860px] text-sm border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left w-12">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                          checked={allPageSelected}
                          onChange={toggleSelectAllPage}
                          aria-label="Select all on page"
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Ledger Name
                      </th>
                      {showContactColumn ? (
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Mobile
                        </th>
                      ) : (
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Email
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        City
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        State
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgers.map((entry) => {
                      const contact = getRecipientContact(entry, channel)
                      const canSelect = isRowSelectable(entry, channel)
                      const invalidContactLabel =
                        channel === 'email' ? 'No valid email' : 'No valid mobile'
                      return (
                        <tr
                          key={entry.id}
                          className={`hover:bg-blue-50/40 ${selectedIds.has(entry.id) ? 'bg-blue-50/50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800 disabled:opacity-40"
                              checked={selectedIds.has(entry.id)}
                              disabled={!canSelect}
                              onChange={() => toggleRow(entry)}
                              aria-label={`Select ${getLedgerDisplayName(entry) || entry.id}`}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-900">{getLedgerDisplayName(entry) || '—'}</p>
                            {entry.branch_name ? (
                              <p className="text-[11px] text-slate-500 truncate">{entry.branch_name}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <div className="inline-flex items-center gap-1.5 text-slate-700">
                              {channel === 'email' ? (
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                              ) : (
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                              )}
                              {contact || '—'}
                            </div>
                            {!canSelect ? (
                              <p className="text-[11px] text-amber-700 mt-0.5">{invalidContactLabel}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <div className="inline-flex items-center gap-1.5 text-slate-700">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {entry.city || '—'}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{getLedgerState(entry) || '—'}</td>
                        </tr>
                      )
                    })}
                    {!ledgers.length && !ledgersLoading ? (
                      <tr>
                        <td colSpan={tableColSpan} className="px-4 py-10 text-center text-slate-500">
                          No ledgers found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {totalCount > 0 ? (
                <div className="px-4 sm:px-5 pb-4">
                  <Pagination
                    currentPage={currentPageNum}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalCount={totalCount}
                    pageSize={PAGE_SIZE}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>

        {lastResults.length > 0 ? (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Last send results</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Per-recipient status for the most recent send on this page.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/promotional/send-history"
                  className="text-xs font-medium text-blue-800 hover:text-blue-900"
                >
                  View in history
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setLastResults([])
                    setLastSummary(null)
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Total</p>
                <p className="text-lg font-semibold text-slate-900">
                  {lastSummary?.total ?? lastResults.length}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] text-emerald-700">Success</p>
                <p className="text-lg font-semibold text-emerald-800">
                  {lastSummary?.sent ??
                    lastResults.filter((row) => String(row?.status || '').toLowerCase() === 'sent')
                      .length}
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[11px] text-red-700">Failed</p>
                <p className="text-lg font-semibold text-red-800">
                  {lastSummary?.failed ??
                    lastResults.filter((row) => String(row?.status || '').toLowerCase() === 'failed')
                      .length}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] text-amber-700">Skipped</p>
                <p className="text-lg font-semibold text-amber-800">
                  {lastSummary?.skipped ??
                    lastResults.filter((row) => String(row?.status || '').toLowerCase() === 'skipped')
                      .length}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
                <span>Name</span>
                <span>Mobile / Email</span>
                <span>Status</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {lastResults.map((row, index) => {
                  const status = String(row.status || '').toLowerCase()
                  const statusClass =
                    status === 'sent'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : status === 'skipped'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-red-700 bg-red-50 border-red-200'
                  return (
                    <div
                      key={`${row.party_id || row.to || row.email}-${index}`}
                      className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-2 items-start px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{row.name || '—'}</p>
                        {row.message ? (
                          <p className="text-[11px] text-slate-500 truncate" title={row.message}>
                            {row.message}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-slate-600 truncate">{row.to || row.email || '—'}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}
                      >
                        {status === 'sent' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {String(row.status || 'unknown').toUpperCase()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {(channel === 'whatsapp' || channel === 'sms') && (
        <section className="px-4 sm:px-6 pb-3">
          <div className="max-w-[1600px] mx-auto rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Manual numbers</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add extra WhatsApp/SMS recipients by name and mobile. These are sent along with
                  any selected ledgers.
                </p>
              </div>
              <button
                type="button"
                onClick={addManualRecipient}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-sm font-medium text-blue-900 hover:bg-blue-100"
              >
                <Plus className="h-4 w-4" />
                Add number
              </button>
            </div>

            {manualRecipients.length ? (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
                    <span>Mobile</span>
                    <span>Name</span>
                    <span className="w-8" />
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {manualRecipients.map((row) => (
                      <div
                        key={row.key}
                        className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-2 items-center px-3 py-1.5"
                      >
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={row.mobile}
                          onChange={(e) => updateManualRecipient(row.key, 'mobile', e.target.value)}
                          placeholder="10-digit mobile"
                          className="w-full h-9 px-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                        />
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateManualRecipient(row.key, 'name', e.target.value)}
                          placeholder="Name"
                          className="w-full h-9 px-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                        />
                        <button
                          type="button"
                          onClick={() => removeManualRecipient(row.key)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove recipient"
                          title="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Country code 91 is added automatically for 10-digit Indian mobiles.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No manual numbers yet. Use <span className="font-medium">Add number</span> when the
                person is not in ledgers.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm text-slate-600">
            Ready to send to <span className="font-semibold text-slate-900">{totalRecipientCount}</span>{' '}
            recipient{totalRecipientCount === 1 ? '' : 's'} via{' '}
            <span className="font-semibold text-slate-900">
              {CHANNELS.find((item) => item.id === channel)?.label}
            </span>
          </p>
          <button
            type="button"
            onClick={openSendPopup}
            disabled={!totalRecipientCount}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg btn-brand text-sm font-medium disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {FOOTER_BUTTON_LABELS[channel]}
          </button>
        </div>
      </div>

      {moreFiltersOpen && (
        <div className="fixed inset-0 z-[55] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] cursor-pointer"
            aria-label="Close filters"
            onClick={() => setMoreFiltersOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-gray-200">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  More filters
                </h2>
                <p className="text-xs text-blue-100 mt-1">Apply additional ledger filters</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreFiltersOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/10 cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FilterLabel icon={MapPin}>City</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedCity}
                    options={cityFilterOptions}
                    onChange={(value) => {
                      setSelectedCity(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All cities"
                    searchPlaceholder="Search cities..."
                    emptyText="No cities found"
                    loading={breakdownLoading && !ledgersBreakdown}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={Building}>State</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedState}
                    options={stateFilterOptions}
                    onChange={(value) => {
                      setSelectedState(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All states"
                    searchPlaceholder="Search states..."
                    emptyText="No states found"
                    loading={breakdownLoading && !ledgersBreakdown}
                    clearable
                    useFixedMenu
                  />
                </div>

                {showBranchFilter && (
                  <div className="sm:col-span-2">
                    <FilterLabel icon={Building2}>Branch</FilterLabel>
                    <SearchSelectDropdown
                      value={selectedBranchId}
                      options={branchOptions}
                      onChange={(value) => {
                        setSelectedBranchId(value == null ? '' : String(value))
                        setSelectedParent(null)
                        setCurrentPage(1)
                      }}
                      placeholder="All branches"
                      searchPlaceholder="Search branches..."
                      emptyText="No branches found"
                      loading={branchesLoading}
                      useFixedMenu
                    />
                  </div>
                )}

                <div>
                  <FilterLabel icon={CheckCircle}>Status</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedIsActive}
                    options={LEDGER_STATUS_OPTIONS}
                    onChange={(value) => {
                      setSelectedIsActive(value)
                      setCurrentPage(1)
                    }}
                    placeholder="Select status"
                    searchPlaceholder="Search status..."
                    emptyText="No status found"
                    useFixedMenu
                  />
                </div>

                {isTallyEnabled && (
                  <div>
                    <FilterLabel icon={RefreshCw}>Tally Sync</FilterLabel>
                    <SearchSelectDropdown
                      value={selectedIsTallySync ?? 'all'}
                      options={LEDGER_TALLY_SYNC_OPTIONS}
                      onChange={(value) => {
                        setSelectedIsTallySync(value === 'all' ? null : value)
                        setCurrentPage(1)
                      }}
                      placeholder="All"
                      searchPlaceholder="Search..."
                      emptyText="No options found"
                      useFixedMenu
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <FilterLabel icon={Building}>Parent</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedParent || ''}
                    options={parentFilterOptions}
                    onChange={(value) => {
                      setSelectedParent(value || null)
                      setCurrentPage(1)
                    }}
                    placeholder="All parents"
                    searchPlaceholder="Search parents..."
                    emptyText="No parents found"
                    useFixedMenu
                  />
                </div>

                {areaGroupListingEnabled && (
                  <div className="sm:col-span-2">
                    <FilterLabel icon={MapPin}>Area Group</FilterLabel>
                    <SearchSelectDropdown
                      value={selectedAreaGroup}
                      options={areaGroupFilterOptions}
                      onChange={(value) => {
                        setSelectedAreaGroup(value == null ? '' : String(value))
                        setCurrentPage(1)
                      }}
                      placeholder="All area groups"
                      searchPlaceholder="Search area groups..."
                      emptyText="No area groups found"
                      loading={areaGroupsLoading}
                      clearable
                      useFixedMenu
                    />
                  </div>
                )}

                <div>
                  <FilterLabel icon={User}>Ledger Type</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedLedgerType}
                    options={LEDGER_TYPE_OPTIONS}
                    onChange={(value) => {
                      setSelectedLedgerType(value)
                      setCurrentPage(1)
                    }}
                    placeholder="All"
                    searchPlaceholder="Search type..."
                    emptyText="No options found"
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={Users}>Created By</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedCreatedById}
                    options={createdByOptions}
                    onChange={(value) => {
                      setSelectedCreatedById(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All users"
                    searchPlaceholder="Search users..."
                    emptyText="No users found"
                    loading={usersLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={Building2}>Business Type</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedBusinessTypeId}
                    options={businessTypeFilterOptions}
                    onChange={(value) => {
                      setSelectedBusinessTypeId(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All business types"
                    searchPlaceholder="Search business types..."
                    emptyText="No business types found"
                    loading={filterBusinessLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={CreditCard}>Credit Type</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedCreditTypeId}
                    options={creditTypeFilterOptions}
                    onChange={(value) => {
                      setSelectedCreditTypeId(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All credit types"
                    searchPlaceholder="Search credit types..."
                    emptyText="No credit types found"
                    loading={filterCreditLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={FileText}>Category Type</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedCategoryTypeId}
                    options={categoryTypeFilterOptions}
                    onChange={(value) => {
                      setSelectedCategoryTypeId(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All category types"
                    searchPlaceholder="Search category types..."
                    emptyText="No category types found"
                    loading={classificationListingsLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={FileText}>Taxation Type</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedTaxationTypeId}
                    options={taxationTypeFilterOptions}
                    onChange={(value) => {
                      setSelectedTaxationTypeId(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All taxation types"
                    searchPlaceholder="Search taxation types..."
                    emptyText="No taxation types found"
                    loading={breakdownLoading && !ledgersBreakdown}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={Users}>Religion</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedReligion}
                    options={religionFilterOptions}
                    onChange={(value) => {
                      setSelectedReligion(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All religions"
                    searchPlaceholder="Search religion..."
                    emptyText="No religions found"
                    loading={classificationListingsLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={Calendar}>Week Off</FilterLabel>
                  <SearchSelectDropdown
                    value={selectedWeekOff}
                    options={WEEK_OFF_OPTIONS}
                    onChange={(value) => {
                      setSelectedWeekOff(value == null ? '' : String(value))
                      setCurrentPage(1)
                    }}
                    placeholder="All week offs"
                    searchPlaceholder="Search week off..."
                    emptyText="No options found"
                    clearable
                    useFixedMenu
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 flex items-center gap-2 bg-slate-50">
              <button
                type="button"
                onClick={clearMoreFilters}
                disabled={!hasMoreFiltersActive}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => setMoreFiltersOpen(false)}
                className="flex-1 inline-flex items-center justify-center h-10 rounded-lg btn-brand text-sm font-medium cursor-pointer"
              >
                Apply
              </button>
            </div>
          </aside>
        </div>
      )}

      {sendPopupOpen && channel === 'whatsapp' && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#075e54] via-[#128c7e] to-[#25d366] text-white flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Choose Template & Send</h2>
                <p className="text-sm text-emerald-50 mt-0.5 truncate">
                  {totalRecipientCount} recipient{totalRecipientCount === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSending && setSendPopupOpen(false)}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-5 p-5">
              <div className="space-y-4 min-w-0">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Template type
                  </label>
                  <SimpleSelect
                    value={whatsappSendMode}
                    onChange={setWhatsappSendMode}
                    options={WHATSAPP_SEND_MODE_OPTIONS}
                    disabled={isSending}
                  />
                </div>

                {whatsappSendMode === 'carousel' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Card images
                      </label>
                      <CarouselImagePicker
                        onChange={setCarouselImageUrls}
                        onNotice={showError}
                        disabled={isSending}
                        minCards={MIN_CAROUSEL_CARDS}
                        maxCards={MAX_CAROUSEL_CARDS}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Carousel template
                      </label>
                      {!templatesLoading && !hasCarouselTemplates ? (
                        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          You have no carousel templates yet, so this list is empty. A carousel
                          cannot reuse your existing image templates — Meta needs a separate
                          template that declares the card count. Upload your images above, then
                          submit one below.
                        </p>
                      ) : null}
                      <SearchSelectDropdown
                        id="promotionalCarouselTemplatePopup"
                        value={selectedTemplateName}
                        options={templateOptions}
                        onChange={setSelectedTemplateName}
                        placeholder={
                          hasCarouselTemplates
                            ? 'Select carousel template'
                            : 'No carousel templates yet'
                        }
                        searchPlaceholder="Search carousel templates..."
                        emptyText={
                          templatesLoading
                            ? 'Loading templates...'
                            : 'No carousel templates yet — create one below'
                        }
                        disabled={templatesLoading || isSending || !hasCarouselTemplates}
                        useFixedMenu
                        compact
                      />
                      {selectedTemplate ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {carouselCardCount} card{carouselCardCount === 1 ? '' : 's'}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {selectedTemplate.language || '—'}
                          </span>
                          {!canSendSelectedTemplate ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                              Waiting for Meta approval — cannot send yet
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedTemplate && !carouselCardCountMatches ? (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          This template is approved for exactly {carouselCardCount} card
                          {carouselCardCount === 1 ? '' : 's'}, but {carouselImageUrls.length} image
                          {carouselImageUrls.length === 1 ? ' is' : 's are'} selected. Adjust your
                          selection or create a template for {carouselImageUrls.length} cards.
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {hasCarouselTemplates ? (
                        <button
                          type="button"
                          onClick={() => setCarouselCreateOpen((open) => !open)}
                          disabled={isSending}
                          className="text-sm font-medium text-blue-800 hover:underline disabled:opacity-60"
                        >
                          {carouselCreateOpen ? 'Hide' : 'Create a new carousel template'}
                        </button>
                      ) : (
                        <p className="text-sm font-medium text-slate-800">
                          Create your first carousel template
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Meta must approve a carousel template before its first send, and the card
                        count is fixed at creation.
                      </p>

                      {showCarouselCreate ? (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">
                              Template name
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={carouselNewName}
                              onChange={(e) => setCarouselNewName(e.target.value)}
                              placeholder="e.g. diwali_offers_2026"
                              disabled={carouselTemplateMutation.isPending}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">
                              Message body (shown above the cards)
                            </label>
                            <textarea
                              className={`${inputClass} min-h-[80px] resize-y`}
                              value={carouselNewBody}
                              onChange={(e) => setCarouselNewBody(e.target.value)}
                              placeholder="Hi {{1}}, here are this week's offers."
                              disabled={carouselTemplateMutation.isPending}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">
                              Button label (on every card)
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={carouselButtonText}
                              onChange={(e) => setCarouselButtonText(e.target.value)}
                              placeholder="Know more"
                              disabled={carouselTemplateMutation.isPending}
                            />
                            <p className="mt-1 text-xs text-slate-500">
                              Meta requires at least one button on every carousel card.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateCarouselTemplate}
                            disabled={
                              carouselTemplateMutation.isPending ||
                              carouselImageUrls.length < MIN_CAROUSEL_CARDS
                            }
                            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg btn-brand text-sm font-medium disabled:opacity-60"
                          >
                            {carouselTemplateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            {carouselTemplateMutation.isPending
                              ? 'Submitting...'
                              : carouselImageUrls.length < MIN_CAROUSEL_CARDS
                                ? `Select at least ${MIN_CAROUSEL_CARDS} images first`
                                : `Submit ${carouselImageUrls.length}-card template for approval`}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {selectedTemplate && bodyPlaceholders.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bodyPlaceholders.map((index) => (
                          <div key={`carousel-body-${index}`}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Body parameter {`{{${index}}}`}
                              {personalizeBodyName && index === 1 ? (
                                <span className="ml-1 text-xs font-normal text-blue-800">
                                  (uses ledger name)
                                </span>
                              ) : null}
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={bodyParams[index] || ''}
                              disabled={(personalizeBodyName && index === 1) || isSending}
                              onChange={(e) =>
                                setBodyParams((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                              placeholder={
                                personalizeBodyName && index === 1
                                  ? 'Filled from each ledger name'
                                  : `Value for {{${index}}}`
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {bodyPlaceholders.includes(1) ? (
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                          checked={personalizeBodyName}
                          onChange={(e) => setPersonalizeBodyName(e.target.checked)}
                          disabled={isSending}
                        />
                        Personalize body {'{{1}}'} with each ledger&apos;s name
                      </label>
                    ) : null}
                  </>
                ) : whatsappSendMode === 'message_with_image' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Message template
                      </label>
                      <SearchSelectDropdown
                        id="promotionalImageTemplatePopup"
                        value={selectedTemplateName}
                        options={templateOptions}
                        onChange={setSelectedTemplateName}
                        placeholder="Select image template"
                        searchPlaceholder="Search templates..."
                        emptyText={
                          templatesLoading ? 'Loading templates...' : 'No image templates found'
                        }
                        disabled={templatesLoading || isSending}
                        useFixedMenu
                        compact
                      />
                      {selectedTemplate ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {selectedTemplate.category || '—'}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {selectedTemplate.language || '—'}
                          </span>
                          {!canSendSelectedTemplate ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                              Only approved templates can be sent
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Upload image
                      </label>
                        <input
                        key={imageFile ? `${imageFile.name}-${imageFile.size}` : 'no-image'}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700`}
                        onChange={handleImageFileChange}
                        disabled={isSending}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        JPG, PNG, or WEBP from your device (max 5 MB). This mode sends one image
                        per message — switch Template type to{' '}
                        <button
                          type="button"
                          onClick={() => setWhatsappSendMode('carousel')}
                          disabled={isSending}
                          className="font-medium text-blue-800 hover:underline disabled:opacity-60"
                        >
                          Multiple images (swipeable carousel)
                        </button>{' '}
                        to select several.
                      </p>
                      {imageFile ? (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <span className="truncate">{imageFile.name}</span>
                          <button
                            type="button"
                            onClick={clearImageSelection}
                            disabled={isSending}
                            className="shrink-0 text-rose-600 hover:text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {selectedTemplate && bodyPlaceholders.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bodyPlaceholders.map((index) => (
                          <div key={`image-body-${index}`}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Body parameter {`{{${index}}}`}
                              {personalizeBodyName && index === 1 ? (
                                <span className="ml-1 text-xs font-normal text-blue-800">
                                  (uses ledger name)
                                </span>
                              ) : null}
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={bodyParams[index] || ''}
                              disabled={(personalizeBodyName && index === 1) || isSending}
                              onChange={(e) =>
                                setBodyParams((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                              placeholder={
                                personalizeBodyName && index === 1
                                  ? 'Filled from each ledger name'
                                  : `Value for {{${index}}}`
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {bodyPlaceholders.includes(1) ? (
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                          checked={personalizeBodyName}
                          onChange={(e) => setPersonalizeBodyName(e.target.checked)}
                          disabled={isSending}
                        />
                        Personalize body {'{{1}}'} with each ledger&apos;s name
                      </label>
                    ) : null}
                  </>
                ) : whatsappSendMode === 'message_with_document' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Document (PDF)
                      </label>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={isSending || documentUploading}
                        className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 disabled:opacity-60"
                        onChange={async (event) => {
                          const file = event.target.files?.[0]
                          if (!file) {
                            setDocumentUrl('')
                            setDocumentFilename('document.pdf')
                            return
                          }
                          const type = String(file.type || '').toLowerCase()
                          const name = String(file.name || '').toLowerCase()
                          if (type && type !== 'application/pdf' && !name.endsWith('.pdf')) {
                            showError('Please select a PDF file.')
                            event.target.value = ''
                            return
                          }
                          if (file.size > MAX_WHATSAPP_DOCUMENT_BYTES) {
                            showError('PDF is too large (max 10 MB).')
                            event.target.value = ''
                            return
                          }
                          setDocumentUploading(true)
                          try {
                            const url = await uploadMediaFile(file, 'promotional_whatsapp')
                            setDocumentUrl(url)
                            setDocumentFilename(file.name || 'document.pdf')
                          } catch (err) {
                            showError(err.message || 'Failed to upload PDF')
                            setDocumentUrl('')
                          } finally {
                            setDocumentUploading(false)
                          }
                        }}
                      />
                      {documentUploading ? (
                        <p className="mt-1 text-[11px] text-slate-500">Uploading PDF to Cloudinary…</p>
                      ) : null}
                      {documentUrl ? (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {documentFilename}
                          </p>
                          <p className="text-[11px] text-slate-500 break-all">{documentUrl}</p>
                          <button
                            type="button"
                            className="text-xs text-slate-500 hover:text-red-600"
                            onClick={() => {
                              setDocumentUrl('')
                              setDocumentFilename('document.pdf')
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-500">
                          One PDF is sent to every selected ledger. Each name fills body {'{{1}}'}.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Document template
                      </label>
                      <SearchSelectDropdown
                        id="promotionalDocumentTemplatePopup"
                        value={selectedTemplateName}
                        options={templateOptions}
                        onChange={setSelectedTemplateName}
                        placeholder="Select document template"
                        searchPlaceholder="Search templates..."
                        emptyText={
                          templatesLoading
                            ? 'Loading templates...'
                            : 'No document templates found — create one with a PDF header'
                        }
                        disabled={templatesLoading || isSending}
                        useFixedMenu
                        compact
                      />
                      {selectedTemplate ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {selectedTemplate.category || '—'}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {selectedTemplate.language || '—'}
                          </span>
                          {!canSendSelectedTemplate ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                              Only approved templates can be sent
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {selectedTemplate && bodyPlaceholders.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bodyPlaceholders.map((index) => (
                          <div key={`doc-body-${index}`}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Body parameter {`{{${index}}}`}
                              {personalizeBodyName && index === 1 ? (
                                <span className="ml-1 text-xs font-normal text-blue-800">
                                  (uses ledger name)
                                </span>
                              ) : null}
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={bodyParams[index] || ''}
                              disabled={(personalizeBodyName && index === 1) || isSending}
                              onChange={(e) =>
                                setBodyParams((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                              placeholder={
                                personalizeBodyName && index === 1
                                  ? 'Filled from each ledger name'
                                  : `Value for {{${index}}}`
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {bodyPlaceholders.includes(1) ? (
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                          checked={personalizeBodyName}
                          onChange={(e) => setPersonalizeBodyName(e.target.checked)}
                          disabled={isSending}
                        />
                        Personalize body {'{{1}}'} with each ledger&apos;s name
                      </label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Message template
                      </label>
                      <SearchSelectDropdown
                        id="promotionalTemplatePopup"
                        value={selectedTemplateName}
                        options={templateOptions}
                        onChange={setSelectedTemplateName}
                        placeholder="Select template"
                        searchPlaceholder="Search templates..."
                        emptyText={templatesLoading ? 'Loading templates...' : 'No templates found'}
                        disabled={templatesLoading || isSending}
                        useFixedMenu
                        compact
                      />
                      {selectedTemplate ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {selectedTemplate.category || '—'}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-1">
                            {selectedTemplate.language || '—'}
                          </span>
                          {!canSendSelectedTemplate ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                              Only approved templates can be sent
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {selectedTemplate && (headerPlaceholders.length > 0 || bodyPlaceholders.length > 0) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {headerPlaceholders.map((index) => (
                          <div key={`header-${index}`}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Header parameter {`{{${index}}}`}
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={headerParams[index] || ''}
                              onChange={(e) =>
                                setHeaderParams((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                              placeholder={`Value for {{${index}}}`}
                              disabled={isSending}
                            />
                          </div>
                        ))}
                        {bodyPlaceholders.map((index) => (
                          <div key={`body-${index}`}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Body parameter {`{{${index}}}`}
                              {personalizeBodyName && index === 1 ? (
                                <span className="ml-1 text-xs font-normal text-blue-800">
                                  (uses ledger name)
                                </span>
                              ) : null}
                            </label>
                            <input
                              type="text"
                              className={inputClass}
                              value={bodyParams[index] || ''}
                              disabled={(personalizeBodyName && index === 1) || isSending}
                              onChange={(e) =>
                                setBodyParams((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                              placeholder={
                                personalizeBodyName && index === 1
                                  ? 'Filled from each ledger name'
                                  : `Value for {{${index}}}`
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {bodyPlaceholders.includes(1) ? (
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                          checked={personalizeBodyName}
                          onChange={(e) => setPersonalizeBodyName(e.target.checked)}
                          disabled={isSending}
                        />
                        Personalize body {'{{1}}'} with each ledger&apos;s name
                      </label>
                    ) : null}
                  </>
                )}

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Recipients</p>
                  {renderRecipientsList()}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                {whatsappSendMode === 'message_with_image' ? (
                  imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="WhatsApp header"
                      className="w-full max-w-[280px] rounded-lg border border-slate-200 object-cover max-h-40"
                    />
                  ) : (
                    <div className="flex h-28 w-full max-w-[280px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                      Upload an image to preview
                    </div>
                  )
                ) : null}
                {whatsappSendMode === 'message_with_document' ? (
                  documentUrl ? (
                    <div className="w-full max-w-[280px] rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <p className="font-medium truncate">{documentFilename}</p>
                      <p className="mt-1 text-slate-500 break-all line-clamp-3">{documentUrl}</p>
                    </div>
                  ) : (
                    <div className="flex h-28 w-full max-w-[280px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                      Upload a PDF to preview
                    </div>
                  )
                ) : null}
                <WhatsAppTemplatePreview
                  template={selectedTemplate}
                  headerValues={previewHeaderValues}
                  bodyValues={previewBodyValues}
                  carouselImages={
                    whatsappSendMode === 'carousel' ? carouselImageUrls : undefined
                  }
                  compact
                />
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setSendPopupOpen(false)}
                disabled={isSending}
                className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWhatsappSend}
                disabled={
                  isSending ||
                  documentUploading ||
                  !canSendSelectedTemplate ||
                  (whatsappSendMode === 'message_with_image' && !imageFile) ||
                  (whatsappSendMode === 'message_with_document' && !documentUrl) ||
                  (whatsappSendMode === 'carousel' && !carouselCardCountMatches)
                }
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg btn-brand text-sm font-medium disabled:opacity-60"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSending
                  ? 'Sending...'
                  : `Send to ${totalRecipientCount} recipient${totalRecipientCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendPopupOpen && channel === 'email' && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Compose Email & Send
                </h2>
                <p className="text-sm text-blue-100 mt-0.5 truncate">
                  {totalRecipientCount} recipient{totalRecipientCount === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSending && setSendPopupOpen(false)}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
                <input
                  type="text"
                  className={inputClass}
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Body</label>
                <textarea
                  className={`${inputClass} min-h-[120px] resize-y`}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Plain text email body. Use {{name}} for personalization."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  HTML body <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y font-mono text-xs`}
                  value={emailHtmlBody}
                  onChange={(e) => setEmailHtmlBody(e.target.value)}
                  placeholder="<p>HTML version of the email (optional)</p>"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                  checked={emailPersonalizeWithName}
                  onChange={(e) => setEmailPersonalizeWithName(e.target.checked)}
                />
                Personalize with each ledger&apos;s name using {'{{name}}'}
              </label>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Recipients</p>
                {renderRecipientsList()}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setSendPopupOpen(false)}
                disabled={isSending}
                className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmailSend}
                disabled={isSending}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg btn-brand text-sm font-medium disabled:opacity-60"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSending ? 'Sending...' : `Send to ${totalRecipientCount} recipient${totalRecipientCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendPopupOpen && channel === 'sms' && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 text-white flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Compose SMS & Send
                </h2>
                <p className="text-sm text-slate-200 mt-0.5 truncate">
                  {totalRecipientCount} recipient{totalRecipientCount === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSending && setSendPopupOpen(false)}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                <textarea
                  className={`${inputClass} min-h-[140px] resize-y`}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="SMS message text. Use {{name}} for personalization."
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                  checked={smsPersonalizeWithName}
                  onChange={(e) => setSmsPersonalizeWithName(e.target.checked)}
                />
                Personalize with each ledger&apos;s name using {'{{name}}'}
              </label>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Recipients</p>
                {renderRecipientsList()}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setSendPopupOpen(false)}
                disabled={isSending}
                className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSmsSend}
                disabled={isSending}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg btn-brand text-sm font-medium disabled:opacity-60"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSending ? 'Sending...' : `Send to ${totalRecipientCount} recipient${totalRecipientCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AppPageShell>
  )
}
