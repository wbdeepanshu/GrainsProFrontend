import {
  Battery,
  Check,
  CheckCheck,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Phone,
  Play,
  Reply,
  Signal,
  Video,
  Wifi,
} from 'lucide-react'

const statusStyles = {
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  PAUSED: 'bg-slate-100 text-slate-600 border-slate-200',
}

const chatBackground = {
  backgroundColor: '#efeae2',
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27 viewBox=%270 0 120 120%27%3E%3Cg fill=%27none%27 stroke=%27%23928b80%27 stroke-width=%271.2%27 opacity=%27.16%27%3E%3Cpath d=%27M12 18h13a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-5l-5 4 1-4h-4a5 5 0 0 1-5-5v-7a5 5 0 0 1 5-5Z%27/%3E%3Cpath d=%27M79 12c5 3 8 8 8 14s-3 11-8 14M73 17c3 2 5 5 5 9s-2 7-5 9%27/%3E%3Ccircle cx=%2752%27 cy=%2762%27 r=%278%27/%3E%3Cpath d=%27m52 49 2 6 6 1-5 4 2 6-5-3-5 3 2-6-5-4 6-1 2-6ZM89 73h18v14H89zM94 73v-4h8v4M16 83c8-7 17 2 10 10s-16-1-10-10ZM57 98c4-7 13-7 17 0M64 92v13M101 35l5 5-5 5-5-5 5-5Z%27/%3E%3C/g%3E%3C/svg%3E")',
  backgroundSize: '120px 120px',
}

function WhatsAppLogo({ className = 'h-10 w-10' }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
      <MessageCircle className="absolute inset-0 h-full w-full fill-[#25d366] text-[#25d366]" />
      <Phone className="relative h-[43%] w-[43%] -rotate-12 fill-white text-white" strokeWidth={2.8} />
    </span>
  )
}

export function humanizeTemplateValue(value) {
  return String(value || '—')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getWhatsAppComponent(template, type) {
  return template?.components?.find(
    (component) => String(component.type || '').toUpperCase() === String(type || '').toUpperCase(),
  )
}

function getExampleValues(component) {
  if (!component?.example) return []
  if (Array.isArray(component.example.header_text)) return component.example.header_text
  if (Array.isArray(component.example.body_text?.[0])) return component.example.body_text[0]
  return []
}

function applyParams(text, values = []) {
  if (!text) return ''
  return String(text).replace(/\{\{(\d+)\}\}/g, (match, index) => {
    const value = values[Number(index) - 1]
    if (value == null || value === '') return `{{${index}}}`
    return String(value)
  })
}

export function applyTemplateExamples(text, component) {
  if (!text) return ''

  let result = applyParams(text, getExampleValues(component))

  const namedValues =
    component?.example?.body_text_named_params ||
    component?.example?.header_text_named_params ||
    []
  namedValues.forEach((parameter) => {
    if (parameter?.param_name) {
      result = result.replaceAll(
        `{{${parameter.param_name}}}`,
        parameter.example || parameter.param_name,
      )
    }
  })

  return result
}

function FormattedText({ text }) {
  const parts = String(text || '').split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g)
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <strong key={`${part}-${index}`}>{part.slice(1, -1)}</strong>
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('~') && part.endsWith('~')) {
      return <s key={`${part}-${index}`}>{part.slice(1, -1)}</s>
    }
    return <span key={`${part}-${index}`}>{part}</span>
  })
}

export function WhatsAppStatusBadge({ status }) {
  const normalized = String(status || 'UNKNOWN').toUpperCase()
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        statusStyles[normalized] || 'bg-slate-50 text-slate-600 border-slate-200'
      }`}
    >
      {normalized === 'APPROVED' ? <Check className="h-3 w-3" /> : null}
      {humanizeTemplateValue(normalized)}
    </span>
  )
}

function HeaderMedia({ component }) {
  if (!component || String(component.format || '').toUpperCase() === 'TEXT') return null

  const format = String(component.format || '').toUpperCase()
  const mediaUrl = component.example?.header_handle?.[0]

  if (format === 'IMAGE') {
    return mediaUrl ? (
      <img src={mediaUrl} alt="Template header" className="block h-auto w-full bg-slate-100" />
    ) : (
      <div className="flex h-28 items-center justify-center bg-slate-100 text-slate-400">
        <ImageIcon className="h-8 w-8" />
      </div>
    )
  }

  if (format === 'VIDEO') {
    return mediaUrl ? (
      <video src={mediaUrl} controls className="block max-h-36 w-full bg-black" />
    ) : (
      <div className="flex h-28 items-center justify-center bg-slate-800 text-white">
        <Play className="h-8 w-8" />
      </div>
    )
  }

  if (format === 'DOCUMENT') {
    return (
      <div className="flex items-center gap-3 bg-slate-50 px-3 py-3.5 text-slate-600">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Document</p>
          <p className="text-[11px] text-slate-500">PDF / file attachment</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-24 flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500">
      <FileText className="h-7 w-7" />
      <span className="text-xs font-medium">{humanizeTemplateValue(format)} attachment</span>
    </div>
  )
}

function ButtonIcon({ type }) {
  const normalized = String(type || '').toUpperCase()
  if (normalized === 'PHONE_NUMBER') return <Phone className="h-3.5 w-3.5" />
  if (normalized === 'URL') return <ExternalLink className="h-3.5 w-3.5" />
  if (normalized === 'QUICK_REPLY') return <Reply className="h-3.5 w-3.5" />
  return null
}

function getCardComponent(card, type) {
  return (card?.components || []).find(
    (component) => String(component?.type || '').toUpperCase() === type,
  )
}

/** Horizontally swipeable cards shown under the message body, like WhatsApp carousels. */
function CarouselCards({ cards, images }) {
  if (!cards.length) return null

  return (
    <div className="ml-1.5 mt-1.5 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1.5">
      {cards.map((card, index) => {
        const cardHeader = getCardComponent(card, 'HEADER')
        const cardBody = getCardComponent(card, 'BODY')
        const cardButtons = getCardComponent(card, 'BUTTONS')?.buttons || []
        const image = images?.[index] || cardHeader?.example?.header_handle?.[0]

        return (
          <div
            key={`carousel-card-${index}`}
            className="w-[172px] shrink-0 snap-start overflow-hidden rounded-md bg-white shadow-sm"
          >
            {image ? (
              <img
                src={image}
                alt={`Card ${index + 1}`}
                className="block h-24 w-full bg-slate-100 object-cover"
              />
            ) : (
              <div className="flex h-24 items-center justify-center bg-slate-100 text-slate-400">
                <ImageIcon className="h-7 w-7" />
              </div>
            )}

            {cardBody?.text ? (
              <p className="px-2 pb-1.5 pt-1.5 text-[11.5px] leading-[1.4] text-slate-800">
                <FormattedText text={applyTemplateExamples(cardBody.text, cardBody)} />
              </p>
            ) : null}

            {cardButtons.length ? (
              <div className="border-t border-slate-100">
                {cardButtons.map((button, buttonIndex) => (
                  <div
                    key={`card-${index}-button-${buttonIndex}`}
                    className="flex items-center justify-center gap-1.5 border-b border-slate-100 px-2 py-1.5 text-center text-[11px] font-medium text-[#00a5f4] last:border-b-0"
                  >
                    <ButtonIcon type={button.type} />
                    {button.text || humanizeTemplateValue(button.type)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function MobileStatusBar() {
  return (
    <div className="relative z-20 flex items-center justify-between bg-[#075e54] px-5 pt-2.5 pb-1 text-white">
      <span className="text-[11px] font-semibold tracking-wide">9:41</span>
      <div className="absolute left-1/2 top-1.5 h-5 w-20 -translate-x-1/2 rounded-full bg-black/90" />
      <div className="flex items-center gap-1.5">
        <Signal className="h-3 w-3" />
        <Wifi className="h-3 w-3" />
        <Battery className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

/**
 * Mobile-framed WhatsApp chat bubble preview for Meta message templates.
 */
export default function WhatsAppTemplatePreview({
  template,
  headerValues,
  bodyValues,
  carouselImages,
  compact = false,
  emptyText = 'Select a template to see its WhatsApp preview.',
}) {
  if (!template) {
    return (
      <div className="mx-auto w-full max-w-[300px]">
        <div
          className={`flex items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500 ${
            compact ? 'h-[520px]' : 'h-[580px]'
          }`}
        >
          {emptyText}
        </div>
      </div>
    )
  }

  const header = getWhatsAppComponent(template, 'HEADER')
  const body = getWhatsAppComponent(template, 'BODY')
  const footer = getWhatsAppComponent(template, 'FOOTER')
  const buttons = getWhatsAppComponent(template, 'BUTTONS')?.buttons || []
  const carouselCards = getWhatsAppComponent(template, 'CAROUSEL')?.cards || []

  const headerText = headerValues
    ? applyParams(header?.text, headerValues)
    : applyTemplateExamples(header?.text, header)
  const bodyText = bodyValues
    ? applyParams(body?.text, bodyValues)
    : applyTemplateExamples(body?.text, body)

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="mb-2 flex justify-center">
        <WhatsAppStatusBadge status={template.status} />
      </div>

      <div className="relative mx-auto rounded-[2.15rem] bg-slate-900 p-[10px] shadow-2xl shadow-slate-900/30 ring-1 ring-slate-700/60">
        {/* Side buttons */}
        <span className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l-sm bg-slate-700" />
        <span className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-sm bg-slate-700" />
        <span className="absolute -left-[2px] top-52 h-12 w-[3px] rounded-l-sm bg-slate-700" />
        <span className="absolute -right-[2px] top-40 h-16 w-[3px] rounded-r-sm bg-slate-700" />

        <div className="overflow-hidden rounded-[1.7rem] bg-white">
          <MobileStatusBar />

          <div className="flex items-center gap-2.5 bg-[#075e54] px-3 pb-2.5 pt-1 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
              <WhatsAppLogo className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">Business Account</p>
              <p className="truncate text-[10px] text-emerald-100">online</p>
            </div>
          </div>

          <div
            className={`overflow-y-auto px-2.5 py-3 ${compact ? 'h-[390px]' : 'h-[450px]'}`}
            style={chatBackground}
          >
            <div className="relative ml-1.5 max-w-[94%]">
              <span
                aria-hidden="true"
                className="absolute -left-2 top-0 h-0 w-0 border-b-[9px] border-r-[9px] border-b-transparent border-r-white"
              />
              <div
                className="overflow-hidden rounded-md bg-white shadow-sm"
                style={{ borderTopLeftRadius: 0 }}
              >
                <HeaderMedia component={header} />
                <div className="px-2.5 pt-2">
                  {header?.format === 'TEXT' && headerText ? (
                    <p className="mb-1 whitespace-pre-wrap text-[13px] font-semibold text-slate-900">
                      <FormattedText text={headerText} />
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.45] text-slate-800">
                    <FormattedText text={bodyText || 'No message body'} />
                  </p>
                  {footer?.text ? (
                    <p className="mt-1.5 text-[10px] text-slate-400">{footer.text}</p>
                  ) : null}
                  <div className="flex items-center justify-end gap-1 pb-1.5 pt-1 text-[10px] text-slate-400">
                    <span>12:30 PM</span>
                    <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                  </div>
                </div>
              </div>

              {/* CTA / reply buttons sit under the bubble (not inside the message body) */}
              {buttons.length ? (
                <div className="mt-1 overflow-hidden rounded-md bg-white shadow-sm">
                  {buttons.map((button, index) => (
                    <div
                      key={`${button.type}-${button.text}-${index}`}
                      className="flex items-center justify-center gap-2 border-b border-slate-100 px-3 py-2 text-center text-xs font-medium text-[#00a5f4] last:border-b-0"
                    >
                      <ButtonIcon type={button.type} />
                      {button.text || humanizeTemplateValue(button.type)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <CarouselCards cards={carouselCards} images={carouselImages} />
          </div>

          <div className="flex items-center justify-center bg-[#f0f2f5] px-3 py-2">
            <div className="h-[4px] w-24 rounded-full bg-slate-300" />
          </div>
        </div>
      </div>
    </div>
  )
}
