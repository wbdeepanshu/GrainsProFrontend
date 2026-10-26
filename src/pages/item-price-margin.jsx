import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  FileDown,
  Filter,
  FolderTree,
  History,
  Layers,
  Percent,
  RefreshCw,
  Save,
  Search,
  Settings,
  Tags,
  Users,
  X,
} from 'lucide-react'
import Loader from '@/components/common/loader'
import Pagination from '@/components/common/Pagination'
import SearchSelectDropdown from '@/components/common/SearchSelectDropdown'
import PageHeader from '@/components/layout/PageHeader'
import DownloadPriceListDialog from '@/components/margin/DownloadPriceListDialog'
import ItemPriceMarginLogsDialog from '@/components/margin/ItemPriceMarginLogsDialog'
import {
  fetchItemPriceMarginMatrix,
  saveItemCreditTypeMarginsBulk,
  saveItemPriceMarginsBulk,
} from '@/lib/margin_settings_api'
import {
  fetchStockCategories,
  fetchStockGroups,
  fetchStockSubCategories,
} from '@/lib/item_masters_api'
import { fetchAllStockItemPoAveragePrices } from '@/lib/stocks_api'
import { fetchLedgers } from '@/lib/tally_api'
import { usePermissions } from '@/hooks/usePermissions'
import { useSuccessPopup, getApiSuccessMessage } from '@/hooks/useSuccessPopup'
import { useUserPermissions } from '@/hooks/useUserPermissions'

const PAGE_SIZE = 60

const PO_AVERAGE_TYPE_OPTIONS = [
  { value: 'standard_weight', label: 'Standard Weight' },
  { value: 'fifo', label: 'FIFO' },
  { value: 'current_average', label: 'Current Average' },
]

const GST_RATE_OPTIONS = [
  { value: '', label: 'All GST rates' },
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '18', label: '18%' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const BASE_PRICE_FILTER_OPTIONS = [
  { value: 'provided', label: 'Base price provided' },
  { value: 'zero', label: 'Base price 0' },
  { value: 'all', label: 'All base prices' },
]

const filterInputClass =
  'w-full h-9 pl-9 pr-3 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const filterSelectClass =
  'w-full h-9 px-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

/** Blur on wheel so focused number inputs do not spin when the mouse scrolls. */
const preventNumberInputWheel = (e) => {
  e.currentTarget.blur()
}

/**
 * ArrowUp/Down adjust by whole integers only.
 * Typing can still enter decimals; returns true when the event was handled.
 */
const applyIntegerArrowKey = (e) => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false
  e.preventDefault()
  const input = e.currentTarget
  if (input.disabled || input.readOnly) return true
  const raw = String(input.value ?? '').trim()
  const current = raw === '' || Number.isNaN(Number(raw)) ? 0 : Number(raw)
  let next = e.key === 'ArrowUp' ? current + 1 : current - 1
  if (input.min !== '') {
    const min = Number(input.min)
    if (Number.isFinite(min)) next = Math.max(min, next)
  }
  if (input.max !== '') {
    const max = Number(input.max)
    if (Number.isFinite(max)) next = Math.min(max, next)
  }
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  proto?.set?.call(input, String(next))
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

function FilterLabel({ icon: Icon, children }) {
  return (
    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
      <Icon className="h-3.5 w-3.5 text-blue-800" />
      {children}
    </label>
  )
}

/**
 * Roles that only need the finished landing price when they cannot edit
 * (no margin_settings create/update). With create or update on margin_settings,
 * role 1 and role 6 both see and can edit Base Price and the other Item Settings
 * inputs. Without edit rights, role 6 collapses Item Settings to Landing Price only.
 */
const LANDING_PRICE_ONLY_ROLE_IDS = new Set([6])

/**
 * Editable Item Settings columns that sit before Landing Price
 * (Base Price and Conversion are edited on the Landing Prices page only).
 */
const ITEM_SETTINGS_INPUT_COLS = 4

/** Operator glyph columns (+ / = ) rendered between the Item Settings inputs. */
const ITEM_SETTINGS_OPERATOR_COLS = 4

const BT_HEADER_STYLES = [
  'bg-sky-100 text-sky-900 border-sky-200',
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-violet-100 text-violet-900 border-violet-200',
  'bg-rose-100 text-rose-900 border-rose-200',
]

const CT_HEADER_STYLES = [
  'bg-indigo-100 text-indigo-900 border-indigo-200',
  'bg-teal-100 text-teal-900 border-teal-200',
  'bg-orange-100 text-orange-900 border-orange-200',
  'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
  'bg-cyan-100 text-cyan-900 border-cyan-200',
]

const BT_SCREEN = {
  SETTINGS: 'settings',
  MARGINS: 'margins',
  CREDIT_TYPE: 'credit_type',
}

const inputNoSpinner =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
const inputBase = `w-[5.5rem] px-1.5 py-1.5 border border-gray-200 rounded-md text-xs bg-white text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800 ${inputNoSpinner}`
const inputCompact = `w-[3.25rem] px-1 py-1.5 border border-gray-200 rounded-md text-[14px] font-bold bg-white text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800 ${inputNoSpinner}`

const inputSelectedExtra = 'ring-2 ring-blue-500 bg-blue-50 border-blue-400'

/** Narrow columns holding the × / − / + / = glyphs that link the pricing cells. */
const operatorHeaderClass =
  'px-0.5 py-2 text-center align-middle text-sm font-semibold text-slate-500 w-6'
const operatorCellClass =
  'px-0.5 py-2 text-center align-middle text-sm font-semibold text-slate-400 w-6'

function parseCellKey(key) {
  const [row, col] = String(key || '').split('-').map((part) => Number(part))
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null
  return { row, col }
}

function cellsInSelectionRange(range) {
  if (!range) return []
  const rowStart = Math.min(range.anchorRow, range.focusRow)
  const rowEnd = Math.max(range.anchorRow, range.focusRow)
  const colStart = Math.min(range.anchorCol, range.focusCol)
  const colEnd = Math.max(range.anchorCol, range.focusCol)
  const cells = []
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      cells.push({ row, col })
    }
  }
  return cells
}

function isCellInSelectionRange(range, row, col) {
  if (!range) return false
  const rowStart = Math.min(range.anchorRow, range.focusRow)
  const rowEnd = Math.max(range.anchorRow, range.focusRow)
  const colStart = Math.min(range.anchorCol, range.focusCol)
  const colEnd = Math.max(range.anchorCol, range.focusCol)
  return row >= rowStart && row <= rowEnd && col >= colStart && col <= colEnd
}

function readMatrixCellMeta(el) {
  if (!el) return null
  const key = parseCellKey(el.getAttribute('data-margin-cell'))
  if (!key) return null
  return {
    ...key,
    kind: el.getAttribute('data-margin-kind') || 'item',
    itemId: el.getAttribute('data-margin-item-id'),
    field: el.getAttribute('data-margin-field'),
    businessTypeId: el.getAttribute('data-margin-bt-id'),
    categoryTypeId: el.getAttribute('data-margin-cat-id'),
    creditTypeId: el.getAttribute('data-margin-ct-id'),
    value: el.value,
  }
}

const MAX_THREE_DIGIT = 999
const MAX_MARGIN_PERCENT = 99
const MAX_MAX_QTY = 999
const MAX_PRICE_CONVERSION = 9999

function toNum(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Shared base price — keep up to 2 decimal places only.
 * Do not ceil to a whole rupee (landing prices still use ceil separately).
 */
function toBasePrice2(value) {
  const n = toNum(value, 0)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function formatNum(value) {
  const n = toNum(value, 0)
  return Number.isInteger(n) ? String(n) : String(n)
}

/**
 * Stock item.conversion is stored in qtl.
 * Kg pack factor = conversion × 100 (0/null → 1).
 */
function kgConversionFactor(item) {
  if (item?.kg_conversion_factor != null && Number(item.kg_conversion_factor) > 0) {
    return toNum(item.kg_conversion_factor, 1)
  }
  const conv = toNum(item?.conversion, 0)
  const factor = conv * 100
  return factor > 0 ? factor : 1
}

/** Default landing multiplier when price_conversion is not saved. */
function defaultPriceConversion(item) {
  if (item?.default_price_conversion != null && toNum(item.default_price_conversion) > 0) {
    return toNum(item.default_price_conversion, 1)
  }
  const sec = toNum(item?.secondary_conversion, 0)
  if (sec > 1) return sec
  return kgConversionFactor(item)
}

/** User-editable conversion for landing price (pack/piece multiplier). */
function priceConversionFactor(item) {
  const stored = toNum(item?.price_conversion, 0)
  if (stored > 0) return stored
  return defaultPriceConversion(item)
}

function clampPriceConversion(value) {
  const n = toNum(value, 0)
  if (n < 0) return 0
  if (n > MAX_PRICE_CONVERSION) return MAX_PRICE_CONVERSION
  return Math.round(n * 1000) / 1000
}

function clampThreeDigit(value) {
  const n = toNum(value, 0)
  if (n < 0) return 0
  if (n > MAX_THREE_DIGIT) return MAX_THREE_DIGIT
  return n
}

function clampMarginPercent(value) {
  const n = toNum(value, 0)
  if (n < 0) return 0
  if (n > MAX_MARGIN_PERCENT) return MAX_MARGIN_PERCENT
  return Math.round(n * 100) / 100
}

function clampMaxQty(value) {
  const n = toNum(value, 0)
  if (n < 0) return 0
  if (n > MAX_MAX_QTY) return MAX_MAX_QTY
  return n
}

/** Discount on base first, then freight + additional on the discounted amount (min unit / Kg). */
function computeItemSettingsSubtotalKg(item) {
  // Use stored base as-is (e.g. 65.76); ceil only the final landing/pack price.
  const base = toBasePrice2(item.base_price)
  const freight = toNum(item.freight_amount, 0)
  const additional = toNum(item.additional_amount, 0)
  const discountPct = toNum(item.discount_percent, 0)
  const discountedBase = Math.max(0, base * (1 - discountPct / 100))
  return discountedBase + freight + additional
}

/** Convert an input-unit amount using the item's price conversion factor. */
function convertWithPriceFactor(amount, item) {
  return toNum(amount, 0) * priceConversionFactor(item)
}

/** Base price only × price conversion (stored base; final pack still ceiled separately). */
function computeBasePriceConverted(item) {
  return convertWithPriceFactor(toBasePrice2(item.base_price), item)
}

function computeFreightConverted(item) {
  return convertWithPriceFactor(item.freight_amount, item)
}

function computeAdditionalConverted(item) {
  return convertWithPriceFactor(item.additional_amount, item)
}

/**
 * Net unit price after discount, charges, and sale margin %:
 * subtotal * (1 + sale_margin%/100)
 */
function computeLandingUnitPrice(item) {
  const subtotal = computeItemSettingsSubtotalKg(item)
  const saleMarginPct = toNum(item.sale_margin_percent, 0)
  return subtotal * (1 + saleMarginPct / 100)
}

/**
 * Landing / pack price = ceil of
 * ((base * (1 - discount%/100)) + freight + additional) * (1 + sale_margin%/100)
 *   × price_conversion
 * Base decimals are kept through the margin math; only this pack result is ceiled.
 */
function computeLandingPrice(item) {
  return ceilBaseUnitPrice(
    computeLandingUnitPrice(item) * priceConversionFactor(item),
  )
}

/** True when any BT cost field differs from zero (settings applied for that BT). */
function isBusinessTypeItemSettingsApplied(item) {
  return (
    toNum(item?.discount_percent, 0) !== 0 ||
    toNum(item?.freight_amount, 0) !== 0 ||
    toNum(item?.additional_amount, 0) !== 0 ||
    toNum(item?.sale_margin_percent, 0) !== 0
  )
}

/**
 * Landing display tone: green when BT settings change the price;
 * red when landing is just base × conversion (no BT settings).
 */
function landingPriceToneClass(item) {
  return isBusinessTypeItemSettingsApplied(item)
    ? 'text-emerald-900'
    : 'text-red-600'
}

/** Customer/category margin applies on landing price; result ceiled to whole ₹. */
function computeEffectivePrice(item, marginPercent) {
  const landing = computeLandingPrice(item)
  const marginPct = toNum(marginPercent, 0)
  const marginAmt = (landing * marginPct) / 100
  return ceilBaseUnitPrice(Math.max(0, landing + marginAmt))
}

/** Conversion is editable only while shared base price is 0. */
function isConversionEditable(item) {
  return toNum(item?.base_price, 0) === 0
}

/**
 * Main base price: ceil any fractional part to a whole number (for calc / pack display).
 * Example: 101.12 → 102, 101.0 → 101
 * The Base Price input still accepts and stores decimals.
 */
function ceilBaseUnitPrice(value) {
  const n = toNum(value, 0)
  if (!Number.isFinite(n)) return 0
  // Avoid Math.ceil(0 - EPSILON) → -0, which formats as "-0".
  if (n === 0) return 0
  if (n > 0) {
    const result = Math.ceil(n - Number.EPSILON)
    return result === 0 ? 0 : result
  }
  const result = -Math.floor(Math.abs(n) - Number.EPSILON)
  return result === 0 ? 0 : result
}

/** Base price display — keep decimals as entered / stored. */
function formatBasePriceDisplay(value) {
  const n = toNum(value, 0)
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/**
 * Landing / pack selling price — ceil any fraction to a whole number.
 * Example: 2585.30 → 2586, 1617.2 → 1618
 */
function formatEffectivePrice(value) {
  const n = ceilBaseUnitPrice(value)
  // Normalize -0 so the UI never shows "-0".
  const whole = n === 0 ? 0 : n
  return whole.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Price Master–style unit rounding: bump to the next tenth when any hundredth is present.
 * Example: 53.01 → 53.1, 40.10 → 40.1, 28.0 → 28.0
 */
function roundPriceOneDecimal(value) {
  const n = toNum(value, 0)
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  const hundredths = Math.round(abs * 100)
  const tenths = Math.floor(hundredths / 10)
  const secondDigit = hundredths % 10
  const roundedTenths = secondDigit > 0 ? tenths + 1 : tenths
  return sign * (roundedTenths / 10)
}

/** Unit price under landing — one decimal digit (e.g. 53.1), not whole-rupee ceil. */
function formatUnitPriceOneDecimal(value) {
  const n = roundPriceOneDecimal(value)
  const amount = n === 0 ? 0 : n
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function cloneMatrixItems(items = []) {
  return (items || []).map((item) => {
    // Conversion is shared for the stock item (all business types), like base_price.
    const sharedConversion =
      item.price_conversion != null && toNum(item.price_conversion) > 0
        ? clampPriceConversion(item.price_conversion)
        : defaultPriceConversion(item)
    return {
      ...item,
      conversion: toNum(item.conversion, 0),
      secondary_conversion: toNum(item.secondary_conversion, 0),
      kg_conversion_factor: kgConversionFactor(item),
      default_price_conversion: defaultPriceConversion(item),
      base_price: toBasePrice2(item.base_price),
      // Top-level cost fields kept for credit-type / legacy fallbacks.
      freight_amount: clampThreeDigit(item.freight_amount),
      additional_amount: clampThreeDigit(item.additional_amount),
      discount_percent: clampThreeDigit(item.discount_percent),
      sale_margin_percent: clampThreeDigit(item.sale_margin_percent),
      price_conversion: sharedConversion,
      business_types: (item.business_types || []).map((bt) => {
        // Prefer BT-scoped credit_types; fall back to legacy item-level list once.
        const btCreditTypes =
          Array.isArray(bt.credit_types) && bt.credit_types.length
            ? bt.credit_types
            : item.credit_types || []
        return {
          ...bt,
          freight_amount: clampThreeDigit(
            bt.freight_amount != null ? bt.freight_amount : item.freight_amount,
          ),
          additional_amount: clampThreeDigit(
            bt.additional_amount != null ? bt.additional_amount : item.additional_amount,
          ),
          discount_percent: clampThreeDigit(
            bt.discount_percent != null ? bt.discount_percent : item.discount_percent,
          ),
          sale_margin_percent: clampThreeDigit(
            bt.sale_margin_percent != null ? bt.sale_margin_percent : item.sale_margin_percent,
          ),
          price_conversion: sharedConversion,
          categories: (bt.categories || []).map((cat) => ({
            ...cat,
            margin_percent: clampMarginPercent(cat.margin_percent),
            max_quantity: clampMaxQty(cat.max_quantity),
          })),
          credit_types: btCreditTypes.map((ct) => ({
            ...ct,
            business_type_id: bt.business_type_id,
            margin_percent: clampMarginPercent(ct.margin_percent),
            max_quantity: clampMaxQty(ct.max_quantity),
          })),
        }
      }),
    }
  })
}

/** Merge shared base_price + conversion with selected business-type cost fields for landing math. */
function itemWithBusinessTypeSettings(item, businessTypeId) {
  if (!item) return item
  const bt =
    (item.business_types || []).find(
      (row) => String(row.business_type_id) === String(businessTypeId),
    ) || null
  // No BT row yet → treat cost fields as unset (landing = base × conversion).
  if (!bt) {
    return {
      ...item,
      freight_amount: 0,
      additional_amount: 0,
      discount_percent: 0,
      sale_margin_percent: 0,
      price_conversion: priceConversionFactor(item),
    }
  }
  return {
    ...item,
    freight_amount: clampThreeDigit(bt.freight_amount),
    additional_amount: clampThreeDigit(bt.additional_amount),
    discount_percent: clampThreeDigit(bt.discount_percent),
    sale_margin_percent: clampThreeDigit(bt.sale_margin_percent),
    // Conversion is shared for the item across all business types.
    price_conversion: priceConversionFactor(item),
  }
}

function categoryLabel(name) {
  const raw = String(name || '').trim()
  return raw || '—'
}

function buildItemSavePayload(item) {
  // Shared conversion is item-level and must be sent at the top level so the
  // backend upserts tblStockItemPriceSetting.price_conversion (not wiped to null).
  // The same value is mirrored onto every business-type row.
  const sharedConversion =
    clampPriceConversion(
      item.price_conversion != null && toNum(item.price_conversion) > 0
        ? item.price_conversion
        : priceConversionFactor(item),
    ) || null
  return {
    stock_item_id: item.stock_item_id,
    base_price: toBasePrice2(item.base_price),
    price_conversion: sharedConversion,
    business_types: (item.business_types || []).map((bt) => ({
      business_type_id: bt.business_type_id,
      freight_amount: clampThreeDigit(bt.freight_amount),
      additional_amount: clampThreeDigit(bt.additional_amount),
      discount_percent: clampThreeDigit(bt.discount_percent),
      sale_margin_percent: clampThreeDigit(bt.sale_margin_percent),
      price_conversion: sharedConversion,
      categories: (bt.categories || []).map((cat) => ({
        category_type_id: cat.category_type_id,
        margin_percent: clampMarginPercent(cat.margin_percent),
        max_quantity: clampMaxQty(cat.max_quantity),
      })),
    })),
  }
}

function buildCreditMarginsOnlyPayload(item) {
  return {
    stock_item_id: item.stock_item_id,
    business_types: (item.business_types || []).map((bt) => ({
      business_type_id: bt.business_type_id,
      credit_types: (bt.credit_types || []).map((ct) => ({
        credit_type_id: ct.credit_type_id,
        margin_percent: clampMarginPercent(ct.margin_percent),
        max_quantity: clampMaxQty(ct.max_quantity),
      })),
    })),
  }
}

function FeedbackBanner({ message, type, onClose }) {
  if (!message) return null
  const styles =
    type === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${styles}`}>
      <span>{message}</span>
      <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function formatPoQtyDisplay(value) {
  const n = toNum(value, 0)
  return n.toLocaleString('en-IN', {
    maximumFractionDigits: 3,
  })
}

function formatPoMoneyDisplay(value) {
  const n = toNum(value, 0)
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function avgPriceTypeLabel(priceType) {
  if (priceType === 'fifo') return 'FIFO'
  if (priceType === 'current_average') return 'Current Avg'
  return 'Std. Weight'
}

function AvgPriceHoverCell({ avg, priceType = 'standard_weight' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  if (!avg) {
    return <span className="text-xs font-medium text-slate-400 tabular-nums">—</span>
  }

  const isFifo = priceType === 'fifo'
  const isCurrent = priceType === 'current_average'
  const remainingQty = avg.closing_balance != null ? avg.closing_balance : 0
  const totalQty = toNum(avg.total_qty_ordered, 0)
  const totalAmount = toNum(avg.total_purchase_amount, 0)
  const rawAverage = toNum(avg.raw_average_price, 0)
  const conversion = toNum(avg.conversion, 1) || 1
  const averagePrice = toNum(avg.average_price, 0)
  const sellingBalance = toNum(avg.selling_balance, 0)
  const fifoQty = toNum(avg.fifo_qty, 0)
  const fifoRate = toNum(avg.fifo_rate, 0)
  const fifoAmount = toNum(avg.fifo_amount, 0)
  const pendingQty = toNum(avg.pending_po_qty, 0)
  const pendingRate = toNum(avg.pending_po_rate, 0)
  const pendingAmount = toNum(avg.pending_po_amount, 0)
  const hasCalc =
    totalQty > 0 &&
    (avg.total_purchase_amount != null || avg.raw_average_price != null)
  const popupWidth = isCurrent ? 340 : 300

  return (
    <>
      <button
        type="button"
        className="w-full text-right text-[14px] font-bold text-slate-800 tabular-nums whitespace-nowrap cursor-default"
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const left = Math.min(rect.right + 8, window.innerWidth - popupWidth - 12)
          const top = Math.min(rect.top, window.innerHeight - (isCurrent ? 420 : 280))
          setPos({ top: Math.max(8, top), left: Math.max(8, left) })
          setOpen(true)
        }}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Average price calculation details"
      >
        {formatBasePriceDisplay(avg.average_price)}
      </button>
      {open
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[80] rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg"
              style={{ top: pos.top, left: pos.left, width: popupWidth }}
            >
              <p className="mb-1 text-xs font-semibold text-slate-800">
                Average price calculation
              </p>
              <p className="mb-2 text-[11px] leading-snug text-slate-500">
                {isCurrent
                  ? 'Current average: FIFO rate on selling stock, blended with pending PO qty and rate.'
                  : isFifo
                    ? 'FIFO: newest purchase orders first, only until closing balance qty is covered.'
                    : 'Standard weight: qty-weighted average across all purchase order lines.'}
              </p>

              {isCurrent ? (
                <dl className="space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Selling stock</dt>
                    <dd className="font-semibold tabular-nums text-slate-800">
                      {formatPoQtyDisplay(sellingBalance)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>FIFO qty used</dt>
                    <dd className="font-semibold tabular-nums text-slate-800">
                      {formatPoQtyDisplay(fifoQty)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Pending PO qty</dt>
                    <dd className="font-semibold tabular-nums text-slate-800">
                      {formatPoQtyDisplay(pendingQty)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <dt>PO count used</dt>
                    <dd className="font-semibold tabular-nums text-slate-800">
                      {toNum(avg.total_po_count, 0)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>{isFifo ? 'Qty used from POs' : 'Total PO qty'}</dt>
                    <dd className="font-semibold tabular-nums text-slate-800">
                      {formatPoQtyDisplay(totalQty)}
                    </dd>
                  </div>
                  {isFifo ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt>Closing balance</dt>
                      <dd className="font-semibold tabular-nums text-slate-800">
                        {formatPoQtyDisplay(remainingQty)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              )}

              {isCurrent ? (
                hasCalc ? (
                  <div className="mt-2.5 rounded-md border border-amber-100 bg-amber-50/70 px-2.5 py-2 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      How it is calculated
                    </p>
                    <div className="text-[11px] text-slate-700 space-y-1 leading-snug">
                      <p>
                        <span className="text-slate-500">1.</span>{' '}
                        FIFO{' '}
                        <span className="font-semibold tabular-nums">
                          {formatPoQtyDisplay(fifoQty)}
                        </span>
                        {' qty × rate '}
                        <span className="font-semibold tabular-nums">
                          ₹{formatPoMoneyDisplay(fifoRate)}
                        </span>
                        {' = '}
                        <span className="font-semibold tabular-nums">
                          ₹{formatPoMoneyDisplay(fifoAmount)}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-500">2.</span>{' '}
                        Pending PO{' '}
                        <span className="font-semibold tabular-nums">
                          {formatPoQtyDisplay(pendingQty)}
                        </span>
                        {' qty × rate '}
                        <span className="font-semibold tabular-nums">
                          ₹{formatPoMoneyDisplay(pendingRate)}
                        </span>
                        {' = '}
                        <span className="font-semibold tabular-nums">
                          ₹{formatPoMoneyDisplay(pendingAmount)}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-500">3.</span>{' '}
                        ({formatPoQtyDisplay(fifoQty)} × ₹{formatPoMoneyDisplay(fifoRate)}
                        {' + '}
                        {formatPoQtyDisplay(pendingQty)} × ₹{formatPoMoneyDisplay(pendingRate)})
                        {' ÷ '}
                        ({formatPoQtyDisplay(fifoQty)} + {formatPoQtyDisplay(pendingQty)})
                      </p>
                      <p className="pl-3 text-slate-600">
                        = raw avg{' '}
                        <span className="font-semibold tabular-nums text-slate-800">
                          ₹{formatPoMoneyDisplay(rawAverage)}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-500">4.</span>{' '}
                        Raw avg{' '}
                        <span className="font-semibold tabular-nums">
                          ₹{formatPoMoneyDisplay(rawAverage)}
                        </span>
                        {' ÷ '}
                        conversion{' '}
                        <span className="font-semibold tabular-nums">
                          {formatPoMoneyDisplay(conversion)}
                        </span>
                      </p>
                      <p className="pl-3 font-semibold text-emerald-800 tabular-nums">
                        = avg price ₹{formatPoMoneyDisplay(averagePrice)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500 leading-snug">
                    Current avg = (FIFO qty × FIFO rate + pending qty × pending rate) ÷ (FIFO qty + pending qty) ÷ conversion.
                    {totalQty <= 0 ? ' No selling stock or pending PO qty for this item.' : ''}
                  </div>
                )
              ) : hasCalc ? (
                <div className="mt-2.5 rounded-md border border-amber-100 bg-amber-50/70 px-2.5 py-2 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    How it is calculated
                  </p>
                  <div className="text-[11px] text-slate-700 space-y-1 leading-snug">
                    <p>
                      <span className="text-slate-500">1.</span>{' '}
                      Total amount{' '}
                      <span className="font-semibold tabular-nums">
                        ₹{formatPoMoneyDisplay(totalAmount)}
                      </span>
                      {' ÷ '}
                      qty{' '}
                      <span className="font-semibold tabular-nums">
                        {formatPoQtyDisplay(totalQty)}
                      </span>
                    </p>
                    <p className="pl-3 text-slate-600">
                      = raw avg{' '}
                      <span className="font-semibold tabular-nums text-slate-800">
                        ₹{formatPoMoneyDisplay(rawAverage)}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-500">2.</span>{' '}
                      Raw avg{' '}
                      <span className="font-semibold tabular-nums">
                        ₹{formatPoMoneyDisplay(rawAverage)}
                      </span>
                      {' ÷ '}
                      conversion{' '}
                      <span className="font-semibold tabular-nums">
                        {formatPoMoneyDisplay(conversion)}
                      </span>
                    </p>
                    <p className="pl-3 font-semibold text-emerald-800 tabular-nums">
                      = avg price ₹{formatPoMoneyDisplay(averagePrice)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500 leading-snug">
                  Avg price = (Σ PO amount) ÷ (Σ PO qty) ÷ conversion.
                  {totalQty <= 0 ? ' No purchase qty available for this item.' : ''}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export default function MarginItemPriceMargin() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useSuccessPopup()
  const permissionsLoaded = usePermissions()
  const { hasReadPermission, hasCreatePermission, hasUpdatePermission, userInfo } =
    useUserPermissions()

  const canRead = hasReadPermission('margin_settings')
  // Create or update both count as edit rights, so a role holding either one can maintain
  // margins (including base price for role 1 and role 6); without them the matrix stays read-only.
  const canUpdate =
    hasCreatePermission('margin_settings') || hasUpdatePermission('margin_settings')
  // Item Settings is the maintenance screen: only create AND update together open it.
  // Read-only users stay on the default landing price page with no settings icon.
  const canOpenItemSettings =
    hasCreatePermission('margin_settings') && hasUpdatePermission('margin_settings')
  // Role 6 sees landing-price-only only when they lack margin_settings c/u.
  // With c or u they get the same editable Base Price + Item Settings as role 1.
  const landingPriceOnly =
    LANDING_PRICE_ONLY_ROLE_IDS.has(Number(userInfo?.role_id)) && !canUpdate
  const itemSettingsColSpan = landingPriceOnly
    ? 1
    : ITEM_SETTINGS_INPUT_COLS + ITEM_SETTINGS_OPERATOR_COLS + 1

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('true')
  const [basePriceFilter, setBasePriceFilter] = useState('all')
  const [gstRate, setGstRate] = useState('')
  const [stockGroup, setStockGroup] = useState('')
  const [stockCategory, setStockCategory] = useState('')
  const [stockSubCategory, setStockSubCategory] = useState('')
  const [ledgerId, setLedgerId] = useState('')
  const [page, setPage] = useState(1)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [dirtyItemIds, setDirtyItemIds] = useState(() => new Set())
  const [bulkBasePriceDelta, setBulkBasePriceDelta] = useState('')
  /** Bulk Increase by mode: flat rupees or percent of current base. */
  const [bulkIncreaseMode, setBulkIncreaseMode] = useState('rs')
  /** Selected stock item ids on Landing Prices (for Increase by). */
  const [selectedLandingItemIds, setSelectedLandingItemIds] = useState(() => new Set())
  /** Client-side sort for Landing Prices overview: base_price | landing_<btId>. */
  const [landingSortConfig, setLandingSortConfig] = useState({
    key: null,
    direction: 'asc',
  })
  /** Client-side sort for BT settings: discount_percent | freight_amount | additional_amount | sale_margin_percent. */
  const [settingsSortConfig, setSettingsSortConfig] = useState({
    key: null,
    direction: null,
  })
  const [poAverageByItemId, setPoAverageByItemId] = useState(null)
  const [poAveragePickerOpen, setPoAveragePickerOpen] = useState(false)
  const [poAverageType, setPoAverageType] = useState('')
  const [dirty, setDirty] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', type: 'success' })
  const [btScreen, setBtScreen] = useState(BT_SCREEN.SETTINGS)
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState(null)
  const [priceListDialogOpen, setPriceListDialogOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  // Item Settings stays collapsed until the header settings icon is used; the
  // default view is the read-only landing price overview.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bulkColumnDialog, setBulkColumnDialog] = useState(null)
  const [bulkColumnValue, setBulkColumnValue] = useState('')
  const [cellRange, setCellRange] = useState(null)
  const pendingFocusRef = useRef(null)
  const copiedMatrixValueRef = useRef(null)
  const shiftSelectingRef = useRef(false)

  const { data: stockGroupsData, isLoading: stockGroupsLoading } = useQuery({
    queryKey: ['item-price-margin-stock-groups'],
    queryFn: () => fetchStockGroups({ is_active: true }),
    enabled: permissionsLoaded && canRead,
    staleTime: 120_000,
  })

  const { data: stockCategoriesData, isLoading: stockCategoriesLoading } = useQuery({
    queryKey: ['item-price-margin-stock-categories'],
    queryFn: () => fetchStockCategories(),
    enabled: permissionsLoaded && canRead,
    staleTime: 120_000,
  })

  const { data: supplierLedgersData, isLoading: supplierLedgersLoading } = useQuery({
    queryKey: ['item-price-margin-supplier-ledgers'],
    queryFn: () =>
      fetchLedgers({
        per_page: 500,
        is_active: 'true',
        type: 'supplier',
      }),
    enabled: permissionsLoaded && canRead,
    staleTime: 120_000,
  })

  const selectedCategoryId = useMemo(() => {
    if (!stockCategory) return null
    const categories = stockCategoriesData?.data ?? []
    const match = categories.find(
      (cat) =>
        String(cat.id) === String(stockCategory) ||
        String(cat.name || '').trim().toLowerCase() === String(stockCategory).trim().toLowerCase(),
    )
    return match?.id ?? null
  }, [stockCategoriesData, stockCategory])

  const { data: stockSubCategoriesData, isLoading: stockSubCategoriesLoading } = useQuery({
    queryKey: ['item-price-margin-stock-sub-categories', selectedCategoryId],
    queryFn: () =>
      fetchStockSubCategories({
        category_id: selectedCategoryId || undefined,
        is_active: true,
      }),
    enabled: permissionsLoaded && canRead,
    staleTime: 120_000,
  })

  const stockGroupOptions = useMemo(() => {
    const groups = stockGroupsData?.data ?? []
    return [
      { value: '', label: 'All stock groups' },
      ...groups.map((group) => ({
        value: group.name || String(group.id),
        label: group.name || String(group.id),
      })),
    ]
  }, [stockGroupsData])

  const stockCategoryOptions = useMemo(() => {
    const categories = stockCategoriesData?.data ?? []
    return [
      { value: '', label: 'All stock categories' },
      ...categories.map((cat) => ({
        value: cat.name || String(cat.id),
        label: cat.name || String(cat.id),
      })),
    ]
  }, [stockCategoriesData])

  const stockSubCategoryOptions = useMemo(() => {
    const rows = stockSubCategoriesData?.data ?? []
    const names = new Set()
    const options = [{ value: '', label: 'All stock sub categories' }]
    rows.forEach((row) => {
      const name = String(row.name || row.sub_category || '').trim()
      if (!name || names.has(name.toLowerCase())) return
      names.add(name.toLowerCase())
      options.push({ value: name, label: name })
    })
    if (stockSubCategory && !names.has(stockSubCategory.toLowerCase())) {
      options.push({ value: stockSubCategory, label: stockSubCategory })
    }
    return options
  }, [stockSubCategoriesData, stockSubCategory])

  const ledgerOptions = useMemo(() => {
    const parties = supplierLedgersData?.data ?? []
    return [
      { value: '', label: 'All suppliers' },
      { value: 'none', label: 'No Supplier' },
      ...parties.map((party) => ({
        value: String(party.id),
        label: party.name || party.ledger_name || party.tally_name || `Party ${party.id}`,
      })),
    ]
  }, [supplierLedgersData])

  const showItemSettingsOnly = btScreen === BT_SCREEN.SETTINGS
  const showCategoryMargins = btScreen === BT_SCREEN.MARGINS
  const showCreditTypeMargins = btScreen === BT_SCREEN.CREDIT_TYPE
  const showMarginScreens = showCategoryMargins || showCreditTypeMargins

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [
      'item-price-margin-matrix',
      search,
      statusFilter,
      basePriceFilter,
      gstRate,
      stockGroup,
      stockCategory,
      stockSubCategory,
      ledgerId,
      page,
    ],
    queryFn: () => {
      const params = {
        search,
        is_active: statusFilter || undefined,
        base_price_filter: basePriceFilter || undefined,
        gst_rate: gstRate || undefined,
        stock_group: stockGroup || undefined,
        stock_category: stockCategory || undefined,
        stock_sub_category: stockSubCategory || undefined,
        page,
        per_page: PAGE_SIZE,
      }
      if (ledgerId === 'none') {
        params.no_supplier = true
      } else if (ledgerId) {
        params.ledger_id = ledgerId
      }
      return fetchItemPriceMarginMatrix(params)
    },
    enabled: permissionsLoaded && canRead,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (!data) return
    setDraftItems(cloneMatrixItems(data?.data || []))
    setDirtyItemIds(new Set())
    setSelectedLandingItemIds(new Set())
    setBulkBasePriceDelta('')
    setDirty(false)
  }, [data])

  const refreshMatrix = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['item-price-margin-matrix'],
    })
    await queryClient.invalidateQueries({ queryKey: ['item-price-margin-logs'] })
    await refetch()
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const itemsToSave = draftItems.filter((item) => dirtyItemIds.has(item.stock_item_id))
      if (!itemsToSave.length) {
        return { created_count: 0, updated_count: 0 }
      }
      const btResult = await saveItemPriceMarginsBulk(itemsToSave.map(buildItemSavePayload))
      const ctResult = await saveItemCreditTypeMarginsBulk(
        itemsToSave.map(buildCreditMarginsOnlyPayload),
      )
      return {
        created_count:
          Number(btResult.created_count || 0) + Number(ctResult.created_count || 0),
        updated_count:
          Number(btResult.updated_count || 0) + Number(ctResult.updated_count || 0),
        message: btResult.message || ctResult.message,
      }
    },
    onSuccess: async (result) => {
      const created = Number(result.created_count || 0)
      const updated = Number(result.updated_count || 0)
      showSuccess(
        getApiSuccessMessage(
          result,
          `Item price margins saved. Created ${created}, updated ${updated}.`,
        ),
      )
      setFeedback({ message: '', type: 'success' })
      setDirty(false)
      setDirtyItemIds(new Set())
      await refreshMatrix()
    },
    onError: (err) => {
      showError(err)
    },
  })

  const poAverageMutation = useMutation({
    mutationFn: (type) =>
      fetchAllStockItemPoAveragePrices({
        type: type || 'standard_weight',
        page_size: 500,
      }),
    onSuccess: (byItemId) => {
      setPoAverageByItemId(byItemId || {})
    },
    onError: (err) => {
      showError(err)
    },
  })

  const bulkBasePriceMutation = useMutation({
    mutationFn: async () => {
      const delta = Number(bulkBasePriceDelta)
      if (!Number.isFinite(delta) || delta === 0) {
        throw new Error(
          bulkIncreaseMode === 'percent'
            ? 'Enter a non-zero percent to adjust base price (e.g. 2 or 5).'
            : 'Enter a non-zero amount to adjust base price (e.g. 2 or 5).',
        )
      }
      if (!draftItems.length) {
        throw new Error('No items on this page to update.')
      }
      if (!selectedLandingItemIds.size) {
        throw new Error('Select at least one item (or use Select all) before applying Increase by.')
      }

      const selectedIds = selectedLandingItemIds
      const targets = draftItems.filter((item) =>
        selectedIds.has(String(item.stock_item_id)),
      )
      if (!targets.length) {
        throw new Error('No selected items on this page to update.')
      }

      const updatedTargets = targets.map((item) => {
        const current = toNum(item.base_price, 0)
        const nextRaw =
          bulkIncreaseMode === 'percent'
            ? current * (1 + delta / 100)
            : current + delta
        // Keep 2 decimal places only — never ceil base price to a whole number.
        const nextBase = Math.max(0, toBasePrice2(nextRaw))
        return { ...item, base_price: nextBase }
      })

      // Save only selected items so others are untouched.
      const result = await saveItemPriceMarginsBulk(
        updatedTargets.map(buildItemSavePayload),
      )
      return {
        result,
        delta,
        mode: bulkIncreaseMode,
        count: updatedTargets.length,
        updatedTargets,
      }
    },
    onSuccess: async ({ result, delta, mode, count, updatedTargets }) => {
      const byId = new Map(
        updatedTargets.map((item) => [String(item.stock_item_id), item]),
      )
      setDraftItems((prev) =>
        prev.map((item) => byId.get(String(item.stock_item_id)) || item),
      )
      const absDelta = Math.abs(delta)
      const direction = delta > 0 ? 'increased' : 'decreased'
      const unitLabel = mode === 'percent' ? `${absDelta}%` : `₹${absDelta}`
      showSuccess(
        getApiSuccessMessage(
          result,
          `Base price ${direction} by ${unitLabel} for ${count} selected item(s).`,
        ),
      )
      setFeedback({ message: '', type: 'success' })
      setBulkBasePriceDelta('')
      setDirty(false)
      setDirtyItemIds(new Set())
      await refreshMatrix()
    },
    onError: (err) => {
      showError(err)
    },
  })

  const bulkColumnMutation = useMutation({
    mutationFn: async ({ dialog, rawValue }) => {
      if (!dialog) throw new Error('Nothing to update.')
      if (!draftItems.length) throw new Error('No items on this page to update.')

      const field = dialog.field
      const btId = dialog.businessTypeId
      if (btId == null || btId === '') {
        throw new Error('Select a business type before bulk updating this column.')
      }

      const settingsFields = new Set([
        'discount_percent',
        'freight_amount',
        'additional_amount',
        'sale_margin_percent',
      ])
      const nextValue = settingsFields.has(field)
        ? clampThreeDigit(rawValue)
        : field === 'margin_percent'
          ? clampMarginPercent(rawValue)
          : clampMaxQty(rawValue)

      const updatedItems = draftItems.map((item) => {
        if (dialog.kind === 'settings') {
          const existingBts = item.business_types || []
          const hasBt = existingBts.some(
            (bt) => String(bt.business_type_id) === String(btId),
          )
          const nextBusinessTypes = hasBt
            ? existingBts.map((bt) =>
                String(bt.business_type_id) === String(btId)
                  ? { ...bt, [field]: nextValue }
                  : bt,
              )
            : [
                ...existingBts,
                {
                  business_type_id: btId,
                  freight_amount: field === 'freight_amount' ? nextValue : 0,
                  additional_amount: field === 'additional_amount' ? nextValue : 0,
                  discount_percent: field === 'discount_percent' ? nextValue : 0,
                  sale_margin_percent: field === 'sale_margin_percent' ? nextValue : 0,
                  categories: [],
                  credit_types: [],
                },
              ]
          return { ...item, business_types: nextBusinessTypes }
        }

        if (dialog.kind === 'category') {
          const catId = dialog.categoryTypeId
          const existingBts = item.business_types || []
          const hasBt = existingBts.some(
            (bt) => String(bt.business_type_id) === String(btId),
          )
          const nextBusinessTypes = hasBt
            ? existingBts.map((bt) => {
                if (String(bt.business_type_id) !== String(btId)) return bt
                const existing = bt.categories || []
                const found = existing.some(
                  (cat) => String(cat.category_type_id) === String(catId),
                )
                return {
                  ...bt,
                  categories: found
                    ? existing.map((cat) =>
                        String(cat.category_type_id) === String(catId)
                          ? { ...cat, [field]: nextValue }
                          : cat,
                      )
                    : [
                        ...existing,
                        {
                          category_type_id: catId,
                          margin_percent: field === 'margin_percent' ? nextValue : 0,
                          max_quantity: field === 'max_quantity' ? nextValue : 0,
                        },
                      ],
                }
              })
            : [
                ...existingBts,
                {
                  business_type_id: btId,
                  freight_amount: 0,
                  additional_amount: 0,
                  discount_percent: 0,
                  sale_margin_percent: 0,
                  categories: [
                    {
                      category_type_id: catId,
                      margin_percent: field === 'margin_percent' ? nextValue : 0,
                      max_quantity: field === 'max_quantity' ? nextValue : 0,
                    },
                  ],
                  credit_types: [],
                },
              ]
          return { ...item, business_types: nextBusinessTypes }
        }

        const ctId = dialog.creditTypeId
        const existingBts = item.business_types || []
        const hasBt = existingBts.some(
          (bt) => String(bt.business_type_id) === String(btId),
        )
        const nextBusinessTypes = hasBt
          ? existingBts.map((bt) => {
              if (String(bt.business_type_id) !== String(btId)) return bt
              const existing = bt.credit_types || []
              const found = existing.some(
                (ct) => String(ct.credit_type_id) === String(ctId),
              )
              return {
                ...bt,
                credit_types: found
                  ? existing.map((ct) =>
                      String(ct.credit_type_id) === String(ctId)
                        ? { ...ct, [field]: nextValue }
                        : ct,
                    )
                  : [
                      ...existing,
                      {
                        credit_type_id: ctId,
                        business_type_id: bt.business_type_id,
                        margin_percent: field === 'margin_percent' ? nextValue : 0,
                        max_quantity: field === 'max_quantity' ? nextValue : 0,
                      },
                    ],
              }
            })
          : [
              ...existingBts,
              {
                business_type_id: btId,
                freight_amount: 0,
                additional_amount: 0,
                discount_percent: 0,
                sale_margin_percent: 0,
                categories: [],
                credit_types: [
                  {
                    credit_type_id: ctId,
                    business_type_id: btId,
                    margin_percent: field === 'margin_percent' ? nextValue : 0,
                    max_quantity: field === 'max_quantity' ? nextValue : 0,
                  },
                ],
              },
            ]
        return { ...item, business_types: nextBusinessTypes }
      })

      // Save only the selected business type × column so other BTs are untouched.
      let result
      if (dialog.kind === 'settings') {
        const scopedPayload = updatedItems.map((item) => {
          const bt =
            (item.business_types || []).find(
              (row) => String(row.business_type_id) === String(btId),
            ) || null
          return {
            stock_item_id: item.stock_item_id,
            business_types: [
              {
                business_type_id: btId,
                freight_amount: clampThreeDigit(bt?.freight_amount),
                additional_amount: clampThreeDigit(bt?.additional_amount),
                discount_percent: clampThreeDigit(bt?.discount_percent),
                sale_margin_percent: clampThreeDigit(bt?.sale_margin_percent),
              },
            ],
          }
        })
        result = await saveItemPriceMarginsBulk(scopedPayload)
      } else if (dialog.kind === 'category') {
        const catId = dialog.categoryTypeId
        const scopedPayload = updatedItems.map((item) => {
          const bt =
            (item.business_types || []).find(
              (row) => String(row.business_type_id) === String(btId),
            ) || null
          const cat =
            (bt?.categories || []).find(
              (row) => String(row.category_type_id) === String(catId),
            ) || null
          return {
            stock_item_id: item.stock_item_id,
            business_types: [
              {
                business_type_id: btId,
                categories: [
                  {
                    category_type_id: catId,
                    margin_percent: clampMarginPercent(cat?.margin_percent),
                    max_quantity: clampMaxQty(cat?.max_quantity),
                  },
                ],
              },
            ],
          }
        })
        result = await saveItemPriceMarginsBulk(scopedPayload)
      } else {
        const ctId = dialog.creditTypeId
        const scopedPayload = updatedItems.map((item) => {
          const bt =
            (item.business_types || []).find(
              (row) => String(row.business_type_id) === String(btId),
            ) || null
          const ct =
            (bt?.credit_types || []).find(
              (row) => String(row.credit_type_id) === String(ctId),
            ) || null
          return {
            stock_item_id: item.stock_item_id,
            business_types: [
              {
                business_type_id: btId,
                credit_types: [
                  {
                    credit_type_id: ctId,
                    margin_percent: clampMarginPercent(ct?.margin_percent),
                    max_quantity: clampMaxQty(ct?.max_quantity),
                  },
                ],
              },
            ],
          }
        })
        result = await saveItemCreditTypeMarginsBulk(scopedPayload)
      }

      const fieldLabel =
        dialog.fieldLabel ||
        (field === 'margin_percent'
          ? 'Margin %'
          : field === 'max_quantity'
            ? 'Max Qty'
            : field)

      return {
        result,
        nextValue,
        field,
        fieldLabel,
        groupLabel: dialog.groupLabel,
        count: updatedItems.length,
        updatedItems,
      }
    },
    onSuccess: async ({ result, nextValue, fieldLabel, groupLabel, count, updatedItems }) => {
      setDraftItems(updatedItems)
      setDirty(false)
      setDirtyItemIds(new Set())
      setBulkColumnDialog(null)
      setBulkColumnValue('')
      showSuccess(
        getApiSuccessMessage(
          result,
          `${fieldLabel} set to ${formatNum(nextValue)} for ${count} item(s)` +
            (groupLabel ? ` (${groupLabel})` : '') +
            '.',
        ),
      )
      setFeedback({ message: '', type: 'success' })
      await refreshMatrix()
    },
    onError: (err) => {
      showError(err)
    },
  })

  const isSavingPrices =
    saveMutation.isPending ||
    bulkBasePriceMutation.isPending ||
    bulkColumnMutation.isPending

  const landingPageItemIds = useMemo(
    () => draftItems.map((item) => String(item.stock_item_id)),
    [draftItems],
  )

  const sortedLandingDraftItems = useMemo(() => {
    const key = landingSortConfig?.key
    const direction = landingSortConfig?.direction === 'desc' ? 'desc' : 'asc'
    if (!key || !draftItems.length) return draftItems

    const getSortValue = (item) => {
      if (key === 'base_price') return toNum(item?.base_price, 0)
      if (String(key).startsWith('landing_')) {
        const btId = String(key).slice('landing_'.length)
        return computeLandingPrice(itemWithBusinessTypeSettings(item, btId))
      }
      return 0
    }

    const sorted = [...draftItems].sort((left, right) => {
      const a = getSortValue(left)
      const b = getSortValue(right)
      if (a === b) {
        return String(left.stock_item_name || '').localeCompare(
          String(right.stock_item_name || ''),
          undefined,
          { sensitivity: 'base' },
        )
      }
      return a < b ? -1 : 1
    })
    return direction === 'desc' ? sorted.reverse() : sorted
  }, [draftItems, landingSortConfig])

  const renderLandingSortButtons = (sortKey, iconClass = 'text-slate-700') => {
    const active = landingSortConfig.key === sortKey
    const isDesc = active && landingSortConfig.direction === 'desc'
    const isAsc = active && landingSortConfig.direction === 'asc'
    return (
      <div className="inline-flex items-center gap-0.5 leading-none ml-1 align-middle">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setLandingSortConfig({ key: sortKey, direction: 'desc' })
          }}
          className={`h-3.5 w-3.5 inline-flex items-center justify-center ${
            isDesc ? 'opacity-100' : 'opacity-45 hover:opacity-100'
          }`}
          title="Sort descending"
          aria-label="Sort descending"
        >
          <ArrowUp className={`h-3.5 w-3.5 ${iconClass}`} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setLandingSortConfig({ key: sortKey, direction: 'asc' })
          }}
          className={`h-3.5 w-3.5 inline-flex items-center justify-center ${
            isAsc ? 'opacity-100' : 'opacity-45 hover:opacity-100'
          }`}
          title="Sort ascending"
          aria-label="Sort ascending"
        >
          <ArrowDown className={`h-3.5 w-3.5 ${iconClass}`} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  const toggleSettingsSort = (sortKey) => {
    setSettingsSortConfig((prev) => {
      if (prev.key !== sortKey || !prev.direction) {
        return { key: sortKey, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { key: sortKey, direction: 'desc' }
      }
      return { key: null, direction: null }
    })
  }

  const renderSettingsSortIcon = (sortKey) => {
    const active = settingsSortConfig.key === sortKey && settingsSortConfig.direction
    const isAsc = active && settingsSortConfig.direction === 'asc'
    const SortIcon = isAsc ? ArrowUp : ArrowDown
    const nextLabel = !active
      ? 'Sort ascending'
      : isAsc
        ? 'Sort descending'
        : 'Clear sort'
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggleSettingsSort(sortKey)
        }}
        className={`ml-0.5 h-3.5 w-3.5 inline-flex items-center justify-center align-middle ${
          active ? 'opacity-100 text-emerald-950' : 'opacity-45 hover:opacity-100 text-emerald-900'
        }`}
        title={nextLabel}
        aria-label={nextLabel}
      >
        <SortIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    )
  }

  const sortedSettingsDraftItems = useMemo(() => {
    const key = settingsSortConfig?.key
    const direction = settingsSortConfig?.direction
    if (!key || !direction || !draftItems.length) return draftItems

    const sorted = [...draftItems].sort((left, right) => {
      const leftVal = toNum(
        itemWithBusinessTypeSettings(left, selectedBusinessTypeId)?.[key],
        0,
      )
      const rightVal = toNum(
        itemWithBusinessTypeSettings(right, selectedBusinessTypeId)?.[key],
        0,
      )
      if (leftVal === rightVal) {
        return String(left.stock_item_name || '').localeCompare(
          String(right.stock_item_name || ''),
          undefined,
          { sensitivity: 'base' },
        )
      }
      return leftVal < rightVal ? -1 : 1
    })
    return direction === 'desc' ? sorted.reverse() : sorted
  }, [draftItems, settingsSortConfig, selectedBusinessTypeId])

  const allLandingItemsSelected =
    landingPageItemIds.length > 0 &&
    landingPageItemIds.every((id) => selectedLandingItemIds.has(id))
  const someLandingItemsSelected =
    landingPageItemIds.some((id) => selectedLandingItemIds.has(id)) &&
    !allLandingItemsSelected

  const toggleLandingItemSelected = (itemId) => {
    const key = String(itemId)
    setSelectedLandingItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAllLandingItems = () => {
    setSelectedLandingItemIds((prev) => {
      if (
        landingPageItemIds.length > 0 &&
        landingPageItemIds.every((id) => prev.has(id))
      ) {
        return new Set()
      }
      return new Set(landingPageItemIds)
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim()
      if (next === search) return
      setPage(1)
      setSearch(next)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return
    pendingFocusRef.current = null
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-margin-cell="${pending.row}-${pending.col}"]`,
      )
      if (!el || el.disabled) return
      el.focus()
      if (typeof el.select === 'function') el.select()
    })
  }, [draftItems])

  const businessTypes = data?.business_types || []
  const categoryTypes = data?.category_types || []
  const creditTypes = data?.credit_types || []
  const pagination = data?.pagination || { page: 1, per_page: PAGE_SIZE, total: 0, total_pages: 1 }

  // Keep the user's business-type choice across search/filter refetches.
  // While a new query has no data yet, businessTypes is briefly [] — do not
  // clear selection then, or the next load would fall back to the default (first) BT.
  useEffect(() => {
    if (!businessTypes.length) return
    setSelectedBusinessTypeId((prev) => {
      if (prev != null && businessTypes.some((bt) => String(bt.id) === String(prev))) {
        return prev
      }
      return businessTypes[0].id
    })
  }, [businessTypes])

  useEffect(() => {
    setCellRange(null)
  }, [btScreen, page, selectedBusinessTypeId])

  const selectedBusinessType = useMemo(
    () => businessTypes.find((bt) => String(bt.id) === String(selectedBusinessTypeId)) || null,
    [businessTypes, selectedBusinessTypeId],
  )

  const selectedBusinessTypeIndex = useMemo(
    () => businessTypes.findIndex((bt) => String(bt.id) === String(selectedBusinessTypeId)),
    [businessTypes, selectedBusinessTypeId],
  )

  const markItemDirty = (itemId) => {
    setDirtyItemIds((prev) => {
      const next = new Set(prev)
      next.add(itemId)
      return next
    })
    setDirty(true)
  }

  /** Shared conversion on Landing Prices overview — updates item + all BT rows.
   * Editable only when base price is 0 (set base to 0, edit conversion, then restore base). */
  const updateSharedPriceConversion = (itemId, value) => {
    const target = draftItems.find((item) => String(item.stock_item_id) === String(itemId))
    if (!target || !isConversionEditable(target)) return
    const nextValue = clampPriceConversion(value)
    setDraftItems((prev) =>
      prev.map((item) => {
        if (String(item.stock_item_id) !== String(itemId)) return item
        return {
          ...item,
          price_conversion: nextValue,
          business_types: (item.business_types || []).map((bt) => ({
            ...bt,
            price_conversion: nextValue,
          })),
        }
      }),
    )
    markItemDirty(itemId)
  }

  const updateItemField = (itemId, field, value) => {
    // Conversion is shared for the item across all business types.
    if (field === 'price_conversion') {
      updateSharedPriceConversion(itemId, value)
      return
    }

    const numericFields = new Set([
      'freight_amount',
      'additional_amount',
      'discount_percent',
      'sale_margin_percent',
    ])
    const nextValue = numericFields.has(field) ? clampThreeDigit(value) : value

    // Business-type cost fields (not base_price / conversion) are stored per selected BT.
    const btScopedFields = new Set([
      'freight_amount',
      'additional_amount',
      'discount_percent',
      'sale_margin_percent',
    ])
    const useBtScope =
      btScopedFields.has(field) &&
      selectedBusinessTypeId != null

    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.stock_item_id !== itemId) return item
        if (!useBtScope) {
          return { ...item, [field]: nextValue }
        }
        return {
          ...item,
          business_types: (item.business_types || []).map((bt) =>
            String(bt.business_type_id) === String(selectedBusinessTypeId)
              ? { ...bt, [field]: nextValue }
              : bt,
          ),
        }
      }),
    )
    markItemDirty(itemId)
  }

  const updateCategoryField = (itemId, businessTypeId, categoryTypeId, field, value) => {
    const nextValue =
      field === 'margin_percent'
        ? clampMarginPercent(value)
        : field === 'max_quantity'
          ? clampMaxQty(value)
          : value
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.stock_item_id !== itemId) return item
        return {
          ...item,
          business_types: (item.business_types || []).map((bt) => {
            if (bt.business_type_id !== businessTypeId) return bt
            return {
              ...bt,
              categories: (bt.categories || []).map((cat) =>
                cat.category_type_id === categoryTypeId ? { ...cat, [field]: nextValue } : cat,
              ),
            }
          }),
        }
      }),
    )
    markItemDirty(itemId)
  }

  const updateCreditTypeField = (itemId, creditTypeId, field, value) => {
    const nextValue =
      field === 'margin_percent'
        ? clampMarginPercent(value)
        : field === 'max_quantity'
          ? clampMaxQty(value)
          : value
    const btId = selectedBusinessTypeId
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.stock_item_id !== itemId) return item
        return {
          ...item,
          business_types: (item.business_types || []).map((bt) => {
            if (String(bt.business_type_id) !== String(btId)) return bt
            const existing = bt.credit_types || []
            const found = existing.some(
              (ct) => String(ct.credit_type_id) === String(creditTypeId),
            )
            return {
              ...bt,
              credit_types: found
                ? existing.map((ct) =>
                    String(ct.credit_type_id) === String(creditTypeId)
                      ? { ...ct, [field]: nextValue }
                      : ct,
                  )
                : [
                    ...existing,
                    {
                      credit_type_id: creditTypeId,
                      business_type_id: bt.business_type_id,
                      margin_percent: field === 'margin_percent' ? nextValue : 0,
                      max_quantity: field === 'max_quantity' ? nextValue : 0,
                    },
                  ],
            }
          }),
        }
      }),
    )
    markItemDirty(itemId)
  }

  const openBulkColumnDialog = (dialog) => {
    if (!canUpdate || !dialog) return
    setBulkColumnDialog(dialog)
    setBulkColumnValue('')
  }

  const closeBulkColumnDialog = () => {
    setBulkColumnDialog(null)
    setBulkColumnValue('')
  }

  /** Apply Margin % / Max Qty / BT settings column to every item on this page and auto-save. */
  const applyBulkColumnToPage = () => {
    if (!bulkColumnDialog || !canUpdate || bulkColumnMutation.isPending) return
    if (!draftItems.length) {
      showError('No items on this page to update.')
      return
    }
    bulkColumnMutation.mutate({
      dialog: bulkColumnDialog,
      rawValue: bulkColumnValue,
    })
  }

  const openSettingsBulkDialog = (field, fieldLabel) => {
    if (!canUpdate || selectedBusinessTypeId == null) return
    openBulkColumnDialog({
      kind: 'settings',
      businessTypeId: selectedBusinessTypeId,
      field,
      fieldLabel,
      groupLabel: selectedBusinessType
        ? `${selectedBusinessType.name || 'Business type'} settings`
        : 'Business type settings',
    })
  }

  const focusMatrixCell = (rowIndex, colIndex) => {
    const el = document.querySelector(`[data-margin-cell="${rowIndex}-${colIndex}"]`)
    if (!el || el.disabled) return
    el.focus()
    if (typeof el.select === 'function') el.select()
  }

  const setSingleCellRange = (rowIndex, colIndex) => {
    setCellRange({
      anchorRow: rowIndex,
      anchorCol: colIndex,
      focusRow: rowIndex,
      focusCol: colIndex,
    })
  }

  const extendCellRange = (rowIndex, colIndex) => {
    setCellRange((prev) => {
      if (!prev) {
        return {
          anchorRow: rowIndex,
          anchorCol: colIndex,
          focusRow: rowIndex,
          focusCol: colIndex,
        }
      }
      return {
        ...prev,
        focusRow: rowIndex,
        focusCol: colIndex,
      }
    })
  }

  const applyPasteValueToMetas = (rawValue, metas) => {
    if (!canUpdate || !metas?.length) return
    const valueText = String(rawValue ?? '').trim()
    const dirtyIds = new Set()

    setDraftItems((prev) => {
      let next = prev
      metas.forEach((meta) => {
        if (!meta?.itemId || !meta?.field) return
        const itemId = Number(meta.itemId) || meta.itemId
        dirtyIds.add(itemId)

        if (meta.kind === 'category') {
          const businessTypeId = Number(meta.businessTypeId) || meta.businessTypeId
          const categoryTypeId = Number(meta.categoryTypeId) || meta.categoryTypeId
          const nextValue =
            meta.field === 'margin_percent'
              ? clampMarginPercent(valueText)
              : meta.field === 'max_quantity'
                ? clampMaxQty(valueText)
                : valueText
          next = next.map((item) => {
            if (String(item.stock_item_id) !== String(itemId)) return item
            return {
              ...item,
              business_types: (item.business_types || []).map((bt) => {
                if (String(bt.business_type_id) !== String(businessTypeId)) return bt
                return {
                  ...bt,
                  categories: (bt.categories || []).map((cat) =>
                    String(cat.category_type_id) === String(categoryTypeId)
                      ? { ...cat, [meta.field]: nextValue }
                      : cat,
                  ),
                }
              }),
            }
          })
          return
        }

        if (meta.kind === 'credit') {
          const creditTypeId = Number(meta.creditTypeId) || meta.creditTypeId
          const businessTypeId =
            Number(meta.businessTypeId) || meta.businessTypeId || selectedBusinessTypeId
          const nextValue =
            meta.field === 'margin_percent'
              ? clampMarginPercent(valueText)
              : meta.field === 'max_quantity'
                ? clampMaxQty(valueText)
                : valueText
          next = next.map((item) => {
            if (String(item.stock_item_id) !== String(itemId)) return item
            return {
              ...item,
              business_types: (item.business_types || []).map((bt) => {
                if (String(bt.business_type_id) !== String(businessTypeId)) return bt
                const existing = bt.credit_types || []
                const found = existing.some(
                  (ct) => String(ct.credit_type_id) === String(creditTypeId),
                )
                return {
                  ...bt,
                  credit_types: found
                    ? existing.map((ct) =>
                        String(ct.credit_type_id) === String(creditTypeId)
                          ? { ...ct, [meta.field]: nextValue }
                          : ct,
                      )
                    : [
                        ...existing,
                        {
                          credit_type_id: creditTypeId,
                          business_type_id: bt.business_type_id,
                          margin_percent: meta.field === 'margin_percent' ? nextValue : 0,
                          max_quantity: meta.field === 'max_quantity' ? nextValue : 0,
                        },
                      ],
                }
              }),
            }
          })
          return
        }

        // item settings / base price / shared conversion
        const numericFields = new Set([
          'base_price',
          'freight_amount',
          'additional_amount',
          'discount_percent',
          'sale_margin_percent',
          'price_conversion',
        ])
        let nextValue = valueText
        if (numericFields.has(meta.field)) {
          nextValue =
            meta.field === 'price_conversion'
              ? clampPriceConversion(valueText)
              : meta.field === 'base_price'
                ? Math.max(0, toBasePrice2(valueText))
                : clampThreeDigit(valueText)
        }
        // Conversion is shared (like base_price); only cost fields are BT-scoped.
        const btScopedFields = new Set([
          'freight_amount',
          'additional_amount',
          'discount_percent',
          'sale_margin_percent',
        ])
        const useBtScope =
          btScopedFields.has(meta.field) &&
          selectedBusinessTypeId != null

        next = next.map((item) => {
          if (String(item.stock_item_id) !== String(itemId)) return item
          if (meta.field === 'price_conversion') {
            // Conversion locked unless base price is currently 0.
            if (!isConversionEditable(item)) return item
            return {
              ...item,
              price_conversion: nextValue,
              business_types: (item.business_types || []).map((bt) => ({
                ...bt,
                price_conversion: nextValue,
              })),
            }
          }
          if (!useBtScope) {
            return { ...item, [meta.field]: nextValue }
          }
          return {
            ...item,
            business_types: (item.business_types || []).map((bt) =>
              String(bt.business_type_id) === String(selectedBusinessTypeId)
                ? { ...bt, [meta.field]: nextValue }
                : bt,
            ),
          }
        })
      })
      return next
    })

    if (dirtyIds.size) {
      setDirtyItemIds((prev) => {
        const next = new Set(prev)
        dirtyIds.forEach((id) => next.add(id))
        return next
      })
      setDirty(true)
    }
  }

  const pasteValueIntoSelection = (rawValue, fallbackMeta) => {
    const selected = cellsInSelectionRange(cellRange)
    const targets = (selected.length ? selected : fallbackMeta ? [fallbackMeta] : [])
      .map(({ row, col }) => {
        const el = document.querySelector(`[data-margin-cell="${row}-${col}"]`)
        return readMatrixCellMeta(el)
      })
      .filter((meta) => meta && meta.field && meta.itemId)
    applyPasteValueToMetas(rawValue, targets)
  }

  const handleMatrixCopy = (event, rowIndex, colIndex) => {
    const el =
      event?.currentTarget ||
      document.querySelector(`[data-margin-cell="${rowIndex}-${colIndex}"]`)
    const meta = readMatrixCellMeta(el)
    const value = meta?.value ?? el?.value ?? ''
    copiedMatrixValueRef.current = value
    if (event?.clipboardData) {
      event.clipboardData.setData('text/plain', String(value))
      event.preventDefault()
    } else if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(String(value)).catch(() => {})
    }
    setSingleCellRange(rowIndex, colIndex)
  }

  const handleMatrixPaste = (event, rowIndex, colIndex) => {
    if (!canUpdate) return
    const clipboardText =
      event?.clipboardData?.getData('text/plain') ??
      copiedMatrixValueRef.current ??
      ''
    // Excel-style: take the first cell value when a block is pasted.
    const firstCell = String(clipboardText)
      .replace(/\r\n/g, '\n')
      .split('\n')[0]
      .split('\t')[0]
    event?.preventDefault?.()
    if (!cellRange) setSingleCellRange(rowIndex, colIndex)
    pasteValueIntoSelection(firstCell, { row: rowIndex, col: colIndex })
  }

  const handleMatrixCellMouseDown = (event, rowIndex, colIndex) => {
    if (event.shiftKey) {
      shiftSelectingRef.current = true
      extendCellRange(rowIndex, colIndex)
      return
    }
    shiftSelectingRef.current = false
    setSingleCellRange(rowIndex, colIndex)
  }

  const handleMatrixCellFocus = (rowIndex, colIndex) => {
    if (shiftSelectingRef.current) {
      extendCellRange(rowIndex, colIndex)
      shiftSelectingRef.current = false
      return
    }
    setCellRange((prev) => {
      if (
        prev &&
        prev.anchorRow === rowIndex &&
        prev.anchorCol === colIndex &&
        prev.focusRow === rowIndex &&
        prev.focusCol === colIndex
      ) {
        return prev
      }
      // Keep multi-cell selection when focusing inside an existing range via click-drag.
      if (
        prev &&
        isCellInSelectionRange(prev, rowIndex, colIndex) &&
        (prev.anchorRow !== prev.focusRow || prev.anchorCol !== prev.focusCol)
      ) {
        return prev
      }
      return {
        anchorRow: rowIndex,
        anchorCol: colIndex,
        focusRow: rowIndex,
        focusCol: colIndex,
      }
    })
  }

  const handleMatrixKeyDown = (event, rowIndex, colIndex) => {
    const isMod = event.ctrlKey || event.metaKey
    if (isMod && String(event.key).toLowerCase() === 'c') {
      handleMatrixCopy(event, rowIndex, colIndex)
      return
    }
    if (isMod && String(event.key).toLowerCase() === 'v') {
      // Native paste event also fires; prevent double-handling by relying on onPaste.
      return
    }

    if (event.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
      let nextRow = rowIndex
      let nextCol = colIndex
      if (event.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1)
      if (event.key === 'ArrowDown') nextRow = rowIndex + 1
      if (event.key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1)
      if (event.key === 'ArrowRight') nextCol = colIndex + 1
      const target = document.querySelector(`[data-margin-cell="${nextRow}-${nextCol}"]`)
      if (!target || target.disabled) return
      extendCellRange(nextRow, nextCol)
      shiftSelectingRef.current = true
      target.focus()
      if (typeof target.select === 'function') target.select()
      return
    }

    if (applyIntegerArrowKey(event)) return

    if (event.key !== 'Enter') return
    event.preventDefault()
    const nextRow = rowIndex + 1
    if (canUpdate && dirty && !isSavingPrices) {
      pendingFocusRef.current = { row: nextRow, col: colIndex }
      saveMutation.mutate(undefined, {
        onSettled: () => {
          requestAnimationFrame(() => focusMatrixCell(nextRow, colIndex))
        },
      })
      return
    }
    focusMatrixCell(nextRow, colIndex)
  }

  const matrixCellClass = (baseClass, rowIndex, colIndex) =>
    `${baseClass} ${
      isCellInSelectionRange(cellRange, rowIndex, colIndex) ? inputSelectedExtra : ''
    }`

  const bindMatrixItemCell = (rowIndex, colIndex, { itemId, field, className }) => ({
    'data-margin-cell': `${rowIndex}-${colIndex}`,
    'data-margin-kind': 'item',
    'data-margin-item-id': itemId,
    'data-margin-field': field,
    className: matrixCellClass(className, rowIndex, colIndex),
    onMouseDown: (e) => handleMatrixCellMouseDown(e, rowIndex, colIndex),
    onFocus: () => handleMatrixCellFocus(rowIndex, colIndex),
    onCopy: (e) => handleMatrixCopy(e, rowIndex, colIndex),
    onPaste: (e) => handleMatrixPaste(e, rowIndex, colIndex),
    onKeyDown: (e) => handleMatrixKeyDown(e, rowIndex, colIndex),
    onWheel: preventNumberInputWheel,
  })

  const saveButton = canUpdate ? (
    <button
      type="button"
      disabled={!dirty || isSavingPrices}
      onClick={() => saveMutation.mutate()}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
    >
      <Save className="h-4 w-4" />
      {isSavingPrices ? 'Saving...' : 'Save Changes'}
    </button>
  ) : null

  const applyFilters = ({
    nextGroup = stockGroup,
    nextCategory = stockCategory,
    nextSubCategory = stockSubCategory,
    nextLedgerId = ledgerId,
    nextGstRate = gstRate,
  } = {}) => {
    setStockGroup(nextGroup)
    setStockCategory(nextCategory)
    setStockSubCategory(nextSubCategory)
    setLedgerId(nextLedgerId)
    setGstRate(nextGstRate)
    setPage(1)
  }

  const hasMoreFiltersActive = Boolean(
    (basePriceFilter && basePriceFilter !== 'all') ||
      ledgerId ||
      stockGroup ||
      stockCategory ||
      stockSubCategory ||
      gstRate,
  )
  const hasActiveFilters = Boolean(
    search || statusFilter !== 'true' || hasMoreFiltersActive,
  )

  const clearMoreFilters = () => {
    setBasePriceFilter('all')
    applyFilters({
      nextGroup: '',
      nextCategory: '',
      nextSubCategory: '',
      nextLedgerId: '',
      nextGstRate: '',
    })
  }

  const clearAllFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatusFilter('true')
    clearMoreFilters()
  }

  const catsPerBt = Math.max(categoryTypes.length, 1)
  const showItemSettingsSection = settingsOpen && canOpenItemSettings
  // Combined Item Settings: BT cost fields + category margins + credit margins for the
  // selected business type on one scrollable page (no separate Category/Credit screens).
  const showCombinedCategoryMargins =
    showItemSettingsSection && !landingPriceOnly && categoryTypes.length > 0
  const showCombinedCreditMargins =
    showItemSettingsSection && !landingPriceOnly && creditTypes.length > 0

  // Keep the settings matrix on the BT settings layout; category/credit columns append beside it.
  useEffect(() => {
    if (showItemSettingsSection && btScreen !== BT_SCREEN.SETTINGS) {
      setBtScreen(BT_SCREEN.SETTINGS)
    }
  }, [showItemSettingsSection, btScreen])

  const minTableWidth = useMemo(() => {
    // Combined Item Settings: BT cost fields + optional category + credit columns.
    const inputColsW = landingPriceOnly ? 0 : ITEM_SETTINGS_INPUT_COLS * 48
    const operatorColsW = landingPriceOnly ? 0 : ITEM_SETTINGS_OPERATOR_COLS * 24
    const baseRateColW = landingPriceOnly ? 0 : 96
    const settingsW = 40 + 220 + baseRateColW + operatorColsW + inputColsW + 88
    if (!showItemSettingsSection || landingPriceOnly) return settingsW
    const categoryW = showCombinedCategoryMargins
      ? categoryTypes.length * (64 + 48)
      : 0
    const creditW = showCombinedCreditMargins ? creditTypes.length * (64 + 48) : 0
    return settingsW + categoryW + creditW
  }, [
    creditTypes.length,
    categoryTypes.length,
    landingPriceOnly,
    showItemSettingsSection,
    showCombinedCategoryMargins,
    showCombinedCreditMargins,
  ])

  // Overview: stock item + shared base price + conversion + one landing price per business type.
  const overviewTableWidth = useMemo(
    () =>
      220 +
      (poAverageByItemId ? 88 : 0) +
      (landingPriceOnly ? 0 : 96 + 72) +
      Math.max(businessTypes.length, 1) * 120,
    [businessTypes.length, landingPriceOnly, poAverageByItemId],
  )

  const toggleItemSettings = () => {
    if (!canOpenItemSettings) return
    const next = !settingsOpen
    setSettingsOpen(next)
    if (next) setBtScreen(BT_SCREEN.SETTINGS)
  }

  if (!permissionsLoaded) return <Loader isLoading text="Loading permissions..." />
  if (!canRead) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-gray-600">You do not have permission to view item price margins.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100/80">
      <PageHeader
        title={
          <span className="inline-flex items-baseline gap-2 min-w-0">
            <span className="truncate">Item Price Margin</span>
            <span className="text-sm sm:text-base font-medium text-slate-500 whitespace-nowrap tabular-nums">
              ({pagination.total || draftItems.length} item
              {(pagination.total || draftItems.length) === 1 ? '' : 's'}
              {hasActiveFilters ? ' filtered' : ''})
            </span>
          </span>
        }
      >
        <button
          type="button"
          onClick={() => setLogsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <History className="h-4 w-4" />
          Logs
        </button>
        {canOpenItemSettings ? (
          <button
            type="button"
            onClick={toggleItemSettings}
            className={`inline-flex items-center justify-center h-[38px] w-[38px] rounded-lg border bg-white cursor-pointer shadow-sm transition-colors ${
              settingsOpen
                ? 'border-blue-800 text-blue-800 ring-2 ring-blue-800/30'
                : 'border-gray-200 text-slate-700 hover:bg-slate-50 hover:text-blue-800'
            }`}
          title={settingsOpen ? 'Hide Business Type Settings' : 'Business Type Settings'}
          aria-label={settingsOpen ? 'Hide Business Type Settings' : 'Show Business Type Settings'}
            aria-pressed={settingsOpen}
          >
            <Settings className="h-4 w-4 text-blue-800" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex btn-brand items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setPriceListDialogOpen(true)}
          className="inline-flex items-center justify-center h-[38px] w-[38px] rounded-lg border border-gray-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-800 cursor-pointer shadow-sm transition-colors"
          title="Download Price List"
          aria-label="Download Price List"
        >
          <FileDown className="h-4 w-4 text-blue-800" />
        </button>
      </PageHeader>

      <main className="flex-1 overflow-y-auto p-2.5 sm:p-3">
        <div className="max-w-[1600px] mx-auto space-y-2.5">
          <FeedbackBanner
            message={feedback.message}
            type={feedback.type}
            onClose={() => setFeedback({ message: '', type: 'success' })}
          />

          <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-2.5 sm:p-3 space-y-2.5">
            <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-end">
              <div className="flex-1 min-w-0">
                <FilterLabel icon={Search}>Search</FilterLabel>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by item name..."
                    className={filterInputClass}
                  />
                </div>
              </div>
              <div className="w-full sm:w-40 shrink-0">
                <FilterLabel icon={Tags}>Status</FilterLabel>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Active / Inactive"
                  className={filterSelectClass}
                >
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto shrink-0">
                <span className="mb-1.5 hidden lg:block h-5" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setMoreFiltersOpen(true)}
                  className={`relative inline-flex h-[42px] w-full sm:w-auto sm:min-w-[42px] px-3 sm:px-0 items-center justify-center gap-2 rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer ${
                    hasMoreFiltersActive
                      ? 'btn-brand ring-2 ring-blue-800/30 ring-offset-1'
                      : 'btn-brand'
                  }`}
                  title="More filters"
                  aria-label="Open more filters"
                >
                  <Filter className="h-4 w-4" />
                  <span className="sm:hidden">More filters</span>
                  {hasMoreFiltersActive && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                      !
                    </span>
                  )}
                </button>
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error.message || 'Failed to load item price margins'}
            </div>
          ) : null}
          {saveMutation.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveMutation.error.message || 'Failed to save'}
            </div>
          ) : null}

          {!showItemSettingsSection ? (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 sm:px-4 py-3 border-b border-gray-200 flex flex-nowrap items-center gap-2.5 overflow-x-auto">
                <Percent className="h-4 w-4 text-blue-800 shrink-0" />
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 whitespace-nowrap shrink-0">
                  Landing Prices
                </h2>
                <div className="flex items-center gap-3 ml-auto shrink-0">
                  {isFetching && (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Refreshing...</span>
                    </span>
                  )}
                  <span className="text-[14px] font-bold text-slate-500 whitespace-nowrap">
                    {pagination.total || draftItems.length} item
                    {(pagination.total || draftItems.length) === 1 ? '' : 's'}
                  </span>
                  {canUpdate && !landingPriceOnly && draftItems.length > 0 ? (
                    <div className="flex flex-nowrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 shrink-0">
                      <span className="text-[14px] font-bold text-slate-600 whitespace-nowrap">
                        Increase by
                      </span>
                      <div
                        className="inline-flex h-8 rounded-md border border-gray-200 bg-white p-0.5 shrink-0"
                        role="group"
                        aria-label="Increase by rupees or percent"
                      >
                        <button
                          type="button"
                          onClick={() => setBulkIncreaseMode('rs')}
                          disabled={isSavingPrices}
                          className={`px-2 rounded text-[14px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                            bulkIncreaseMode === 'rs'
                              ? 'bg-blue-800 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          aria-pressed={bulkIncreaseMode === 'rs'}
                        >
                          Rs
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkIncreaseMode('percent')}
                          disabled={isSavingPrices}
                          className={`px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                            bulkIncreaseMode === 'percent'
                              ? 'bg-blue-800 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          aria-pressed={bulkIncreaseMode === 'percent'}
                        >
                          %
                        </button>
                      </div>
                      <input
                        type="number"
                        step={bulkIncreaseMode === 'percent' ? '0.01' : '0.01'}
                        value={bulkBasePriceDelta}
                        onChange={(e) => setBulkBasePriceDelta(e.target.value)}
                        onWheel={preventNumberInputWheel}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          if (
                            isSavingPrices ||
                            !String(bulkBasePriceDelta || '').trim() ||
                            !selectedLandingItemIds.size
                          ) {
                            return
                          }
                          bulkBasePriceMutation.mutate()
                        }}
                        placeholder={bulkIncreaseMode === 'percent' ? 'e.g. 2' : 'e.g. 2.5'}
                        disabled={isSavingPrices}
                        className="text-[14px] font-bold w-20 h-8 px-2 border border-gray-200 rounded-md text-xs bg-white text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800 disabled:opacity-50"
                        aria-label={
                          bulkIncreaseMode === 'percent'
                            ? 'Increase base price by percent'
                            : 'Increase base price by amount in rupees'
                        }
                      />
                      <span className="text-xs text-slate-500 w-4 text-center">
                        {bulkIncreaseMode === 'percent' ? '%' : '₹'}
                      </span>
                      <span className="text-[14px] font-bold text-slate-500 whitespace-nowrap tabular-nums">
                        {selectedLandingItemIds.size
                          ? `${selectedLandingItemIds.size} selected`
                          : 'Select items'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            isSavingPrices ||
                            !String(bulkBasePriceDelta || '').trim() ||
                            !selectedLandingItemIds.size
                          ) {
                            return
                          }
                          bulkBasePriceMutation.mutate()
                        }}
                        disabled={
                          isSavingPrices ||
                          !String(bulkBasePriceDelta || '').trim() ||
                          !selectedLandingItemIds.size
                        }
                        className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-blue-800 text-white text-xs font-medium hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {bulkBasePriceMutation.isPending ? 'Updating...' : 'Apply'}
                      </button>
                    </div>
                  ) : null}
                  {saveButton}
                </div>
              </div>

              {isLoading ? (
                <Loader isLoading text="Loading item price margins..." />
              ) : !draftItems.length ? (
                <div className="p-6 text-center text-sm text-slate-500">No stock items found.</div>
              ) : !businessTypes.length ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Configure business types and category types first to set item price margins.
                </div>
              ) : (
                <div className="max-h-[min(78vh,calc(100vh-11rem))] overflow-auto">
                  <table
                    className="text-sm border-collapse"
                    style={{ minWidth: overviewTableWidth }}
                  >
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-slate-50">
                        <th
                          rowSpan={2}
                          className="sticky left-0 z-30 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700 border-b-2 border-r-2 border-slate-400 min-w-[240px]"
                        >
                          <div className="flex items-center gap-2.5">
                            {canUpdate && !landingPriceOnly ? (
                              <input
                                type="checkbox"
                                checked={allLandingItemsSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = someLandingItemsSelected
                                }}
                                onChange={toggleSelectAllLandingItems}
                                className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800/30 cursor-pointer shrink-0"
                                aria-label="Select all items on this page"
                                title="Select all"
                              />
                            ) : null}
                            <span>Stock Item</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPoAveragePickerOpen((open) => !open)
                              }}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white text-slate-600 shadow-sm transition-colors cursor-pointer hover:bg-blue-50 hover:text-blue-800 hover:border-blue-300 ${
                                poAveragePickerOpen || poAverageByItemId
                                  ? 'border-blue-800 text-blue-800 ring-1 ring-blue-800/30'
                                  : 'border-gray-200'
                              }`}
                              title="Choose PO average price type"
                              aria-label="Choose purchase order average price type"
                              aria-expanded={poAveragePickerOpen}
                            >
                              <Calculator className="h-3.5 w-3.5" />
                            </button>
                            {poAveragePickerOpen ? (
                              <select
                                value={poAverageType}
                                disabled={poAverageMutation.isPending}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  const nextType = e.target.value
                                  setPoAverageType(nextType)
                                  if (!nextType) {
                                    setPoAverageByItemId(null)
                                    return
                                  }
                                  poAverageMutation.mutate(nextType)
                                }}
                                className="h-7 max-w-[11rem] rounded-md border border-blue-800 bg-white px-1.5 text-[11px] font-semibold text-blue-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-800/30 disabled:opacity-60"
                                aria-label="Average price type"
                              >
                                <option value="">Select type</option>
                                {PO_AVERAGE_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                        </th>
                        {poAverageByItemId ? (
                          <th
                            rowSpan={2}
                            className="px-3 py-2 text-center font-semibold text-slate-800 border-b-2 border-r border-slate-400 bg-amber-100 min-w-[5.5rem]"
                          >
                            <span className="block">Avg Price</span>
                            <span className="block text-[11px] font-medium normal-case tracking-normal text-slate-500">
                              {avgPriceTypeLabel(poAverageType)}
                            </span>
                          </th>
                        ) : null}
                        {landingPriceOnly ? null : (
                          <>
                            <th
                              rowSpan={2}
                              className="px-3 py-2 text-center font-semibold text-slate-800 border-b-2 border-r border-slate-400 bg-slate-200 min-w-[6rem]"
                            >
                              <span className="block">Base Price</span>
                              <div className="flex justify-center mt-0.5">
                                {renderLandingSortButtons('base_price')}
                              </div>
                              <span className="block text-[11px] font-medium normal-case tracking-normal text-slate-500">
                                (Inc. of Tax)
                              </span>
                            </th>
                            <th
                              rowSpan={2}
                              className="px-2 py-2 text-center font-semibold text-slate-800 border-b-2 border-r-2 border-slate-400 bg-slate-200 min-w-[4.5rem]"
                            >
                              Conversion

                            </th>
                          </>
                        )}
                        {businessTypes.map((bt, index) => (
                          <th
                            key={bt.id}
                            className={`px-3 py-2 text-center font-semibold border-b border-r-2 border-slate-400 min-w-[7rem] ${BT_HEADER_STYLES[index % BT_HEADER_STYLES.length]}`}
                          >
                            <div className="inline-flex items-center justify-center gap-0.5 flex-wrap">
                              <span>{(bt.name || `Business ${bt.id}`).toUpperCase()}</span>
                              {renderLandingSortButtons(`landing_${bt.id}`, 'text-current')}
                            </div>
                          </th>
                        ))}
                      </tr>
                      <tr className="text-[11px] uppercase tracking-wide text-slate-600">
                        {businessTypes.map((bt) => (
                          <th
                            key={`${bt.id}-landing`}
                            className="text-[11px] font-semibold px-1 py-2 text-center border-b-2 border-r-2 border-slate-400 whitespace-nowrap bg-emerald-100 text-emerald-950"
                          >
                            Landing Price
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLandingDraftItems.map((item) => {
                        const itemKey = String(item.stock_item_id)
                        const isSelected = selectedLandingItemIds.has(itemKey)
                        const canSelectRow = canUpdate && !landingPriceOnly
                        return (
                        <tr
                          key={item.stock_item_id}
                          onClick={
                            canSelectRow
                              ? () => toggleLandingItemSelected(item.stock_item_id)
                              : undefined
                          }
                          className={`hover:bg-slate-50/70 ${
                            canSelectRow ? 'cursor-pointer' : ''
                          } ${isSelected ? 'bg-blue-50/80 hover:bg-blue-50' : ''}`}
                        >
                          <td
                            className={`sticky left-0 z-10 px-3 py-3 border-b border-r-2 border-slate-300 min-w-[240px] ${
                              isSelected ? 'bg-blue-50' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {canSelectRow ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleLandingItemSelected(item.stock_item_id)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800/30 cursor-pointer shrink-0"
                                  aria-label={`Select ${item.stock_item_name || item.stock_item_id}`}
                                />
                              ) : null}
                              <div
                                className={`font-medium leading-snug select-none ${
                                  item.stock_item_is_active === false
                                    ? 'text-red-600'
                                    : 'text-slate-900'
                                }`}
                              >
                                {item.stock_item_name ||
                                  item.stock_item_reserved_name ||
                                  `#${item.stock_item_id}`}
                              </div>
                            </div>
                          </td>
                          {poAverageByItemId ? (
                            <td
                              className="px-2 py-2 border-b border-r border-slate-400 bg-amber-50 text-right align-middle"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AvgPriceHoverCell
                                avg={poAverageByItemId[String(item.stock_item_id)] || null}
                                priceType={poAverageType || 'standard_weight'}
                              />
                            </td>
                          ) : null}
                          {landingPriceOnly ? null : (
                            <>
                              <td
                                className="px-2 py-2 border-b border-r border-slate-400 bg-slate-100 text-right align-middle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {canUpdate ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formatNum(item.base_price)}
                                    onChange={(e) =>
                                      updateItemField(
                                        item.stock_item_id,
                                        'base_price',
                                        e.target.value,
                                      )
                                    }
                                    onBlur={(e) => {
                                      const raw = String(e.target.value ?? '').trim()
                                      if (raw === '') return
                                      const next = Math.max(0, toBasePrice2(raw))
                                      if (toNum(item.base_price, 0) === next) return
                                      updateItemField(item.stock_item_id, 'base_price', next)
                                    }}
                                    onWheel={preventNumberInputWheel}
                                    onKeyDown={(e) => {
                                      if (e.key !== 'Enter') return
                                      e.preventDefault()
                                      if (!dirty || isSavingPrices) return
                                      e.currentTarget.blur()
                                      saveMutation.mutate()
                                    }}
                                    // className={inputBase}
                                    className={`${inputBase} text-[14px] font-bold`}
                                    aria-label={`Base price for ${item.stock_item_name || item.stock_item_id}`}
                                  />
                                ) : (
                                  <span className="text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                                    {formatBasePriceDisplay(item.base_price)}
                                  </span>
                                )}
                              </td>
                              <td
                                className="px-2 py-2 border-b border-r-2 border-slate-400 bg-slate-100 text-right align-middle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {canUpdate ? (
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={formatNum(
                                      item.price_conversion != null
                                        ? toNum(item.price_conversion, 0)
                                        : priceConversionFactor(item),
                                    )}
                                    disabled={!isConversionEditable(item)}
                                    onChange={(e) =>
                                      updateSharedPriceConversion(
                                        item.stock_item_id,
                                        e.target.value,
                                      )
                                    }
                                    onWheel={preventNumberInputWheel}
                                    onKeyDown={(e) => {
                                      if (!isConversionEditable(item)) return
                                      if (applyIntegerArrowKey(e)) return
                                      if (e.key !== 'Enter') return
                                      e.preventDefault()
                                      if (!dirty || isSavingPrices) return
                                      e.currentTarget.blur()
                                      saveMutation.mutate()
                                    }}
                                    className={`${inputBase} ${
                                      isConversionEditable(item)
                                        ? ''
                                        : 'text-[14px] font-bold bg-slate-100 text-slate-500 cursor-not-allowed opacity-80'
                                    }`}
                                    aria-label={`Conversion for ${item.stock_item_name || item.stock_item_id}`}
                                    title={
                                      isConversionEditable(item)
                                        ? 'Shared conversion (all business types). Set base price back after editing.'
                                        : 'Set Base Price to 0 to edit Conversion, then restore Base Price'
                                    }
                                  />
                                ) : (
                                  <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                                    {formatNum(priceConversionFactor(item))}
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                          {businessTypes.map((bt) => {
                            const pricedItem = itemWithBusinessTypeSettings(item, bt.id)
                            const settingsApplied = isBusinessTypeItemSettingsApplied(pricedItem)
                            return (
                              <td
                                key={bt.id}
                                className="px-3 py-3 border-b border-r-2 border-slate-400 align-top bg-emerald-100"
                                style={{ backgroundColor: '#d1fae5' }}
                              >
                                <div className="flex flex-col items-end gap-0.5">
                                  <div
                                    className={`text-right text-[14px] font-bold tabular-nums whitespace-nowrap ${landingPriceToneClass(pricedItem)}`}
                                    title={
                                      settingsApplied
                                        ? '((Base − Discount%) + Freight + Additional) × (1 + Sale Margin%) × Conversion — base kept as entered; pack result ceiled'
                                        : 'No business-type settings applied — landing equals Base × Conversion'
                                    }
                                  >
                                    {formatEffectivePrice(computeLandingPrice(pricedItem))}
                                  </div>
                                  <span
                                    className="text-[11px] leading-tight text-slate-500 tabular-nums whitespace-nowrap"
                                    title="Base price rate with margin without conversion (net unit price)"
                                  >
                                    {formatUnitPriceOneDecimal(computeLandingUnitPrice(pricedItem))}
                                  </span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {pagination.total_pages > 1 ? (
                <div className="px-4 py-3 border-t border-gray-200">
                  <Pagination
                    currentPage={page}
                    totalPages={pagination.total_pages}
                    totalCount={pagination.total || 0}
                    pageSize={pagination.per_page || PAGE_SIZE}
                    onPageChange={(next) => {
                      setPage(next)
                    }}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {showItemSettingsSection ? (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-gray-200 flex flex-nowrap items-center gap-2.5 overflow-x-auto">
              <Percent className="h-4 w-4 text-blue-800 shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 whitespace-nowrap shrink-0">
                Business Type Settings
                {selectedBusinessType?.name ? (
                  <span className="text-slate-500 font-medium">
                    {' '}
                    - {selectedBusinessType.name}
                  </span>
                ) : null}
              </h2>
              <select
                value={selectedBusinessTypeId ?? ''}
                onChange={(e) => setSelectedBusinessTypeId(e.target.value || null)}
                aria-label="Business Type"
                className="h-9 min-w-[9.5rem] shrink-0 px-3 border-2 border-blue-800 rounded-lg text-sm font-semibold bg-blue-50 text-blue-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-800/30 focus:border-blue-900"
              >
                {businessTypes.map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.name || `Business ${bt.id}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 whitespace-nowrap shrink-0 hidden lg:inline">
                Scroll for category and credit margins
              </p>
              <div className="flex items-center gap-3 ml-auto shrink-0">
                {isFetching && (
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Refreshing...</span>
                  </span>
                )}
                <span className="text-sm text-slate-500 whitespace-nowrap">
                  {pagination.total || draftItems.length} item
                  {(pagination.total || draftItems.length) === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {isLoading ? (
              <Loader isLoading text="Loading item price margins..." />
            ) : !draftItems.length ? (
              <div className="p-6 text-center text-sm text-slate-500">No stock items found.</div>
            ) : !businessTypes.length ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Configure business types first to set item price margins.
              </div>
            ) : (
              <div className="max-h-[min(80vh,calc(100vh-10rem))] overflow-auto">
                <table className="text-sm border-collapse" style={{ minWidth: minTableWidth }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-slate-50">
                      <th
                        rowSpan={3}
                        className="sticky left-0 z-30 bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-700 border-b-2 border-r-2 border-slate-400 min-w-[180px]"
                      >
                        Stock Item
                      </th>
                      {showMarginScreens ? null : (
                        <th
                          rowSpan={3}
                          className="px-3 py-2 text-center font-semibold text-slate-800 border-b-2 border-r-2 border-slate-400 bg-slate-200 min-w-[6rem]"
                        >
                          Base Rate
                          <span className="block text-[10px] font-medium normal-case tracking-normal text-slate-500">
                            (Inc. of Tax)
                          </span>
                        </th>
                      )}
                      {showMarginScreens ? (
                        <>
                          <th
                            rowSpan={3}
                            className="px-3 py-2 text-center font-semibold text-emerald-950 border-b-2 border-r-2 border-slate-400 bg-emerald-300 min-w-[5.5rem]"
                          >
                            Landing Price
                          </th>
                          {showCategoryMargins && selectedBusinessType ? (
                            <th
                              colSpan={categoryTypes.length * 2}
                              className={`px-3 py-2 text-center font-semibold border-b border-r-2 border-slate-400 ${BT_HEADER_STYLES[Math.max(selectedBusinessTypeIndex, 0) % BT_HEADER_STYLES.length]}`}
                            >
                              {selectedBusinessType.name
                                ? `${selectedBusinessType.name} - Cash Type`
                                : 'Cash Type'}
                            </th>
                          ) : null}
                          {showCreditTypeMargins && creditTypes.length ? (
                            <th
                              colSpan={creditTypes.length * 2}
                              className={`px-3 py-2 text-center font-semibold border-b border-r-2 border-slate-400 ${CT_HEADER_STYLES[0]}`}
                            >
                              {selectedBusinessType?.name
                                ? `${selectedBusinessType.name} - Credit Type`
                                : 'Credit Type'}
                            </th>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <th
                            colSpan={itemSettingsColSpan}
                            className="px-3 py-2 text-center font-semibold text-emerald-950 border-b border-r-2 border-slate-400 bg-emerald-300"
                          >
                            Business Type Settings
                          </th>
                          {showCombinedCategoryMargins && selectedBusinessType ? (
                            <th
                              colSpan={categoryTypes.length * 2}
                              className={`px-3 py-2 text-center font-semibold border-b border-r-2 border-slate-400 ${BT_HEADER_STYLES[Math.max(selectedBusinessTypeIndex, 0) % BT_HEADER_STYLES.length]}`}
                            >
                              {selectedBusinessType.name
                                ? `${selectedBusinessType.name} - Cash Type`
                                : 'Cash Type'}
                            </th>
                          ) : null}
                          {showCombinedCreditMargins && creditTypes.length ? (
                            <th
                              colSpan={creditTypes.length * 2}
                              className={`px-3 py-2 text-center font-semibold border-b border-r-2 border-slate-400 ${CT_HEADER_STYLES[0]}`}
                            >
                              {selectedBusinessType?.name
                                ? `${selectedBusinessType.name} - Credit Type`
                                : 'Credit Type'}
                            </th>
                          ) : null}
                        </>
                      )}
                    </tr>
                    <tr className="text-[11px] tracking-wide text-slate-700">
                      {showMarginScreens
                        ? (
                          <>
                            {showCategoryMargins && selectedBusinessType
                              ? categoryTypes.map((cat) => (
                                  <th
                                    key={`${selectedBusinessType.id}-${cat.id}-label`}
                                    colSpan={2}
                                    className={`px-1 py-1.5 text-center font-semibold border-b border-r-2 border-slate-500 min-w-[6.5rem] ${BT_HEADER_STYLES[Math.max(selectedBusinessTypeIndex, 0) % BT_HEADER_STYLES.length]}`}
                                    title={cat.name || cat.type}
                                  >
                                    <span className="block leading-snug normal-case text-[12px]">
                                      {categoryLabel(cat.name || cat.type)}
                                    </span>
                                  </th>
                                ))
                              : null}
                            {showCreditTypeMargins
                              ? creditTypes.map((ct, index) => (
                                  <th
                                    key={`${ct.id}-label`}
                                    colSpan={2}
                                    className={`px-1 py-1.5 text-center font-semibold border-b border-r-2 border-slate-500 min-w-[6.5rem] ${CT_HEADER_STYLES[index % CT_HEADER_STYLES.length]}`}
                                    title={ct.name || `Credit ${ct.id}`}
                                  >
                                    <span className="block leading-snug normal-case text-[12px]">
                                      {(ct.name || `Credit ${ct.id}`).toUpperCase()}
                                    </span>
                                  </th>
                                ))
                              : null}
                          </>
                        )
                        : (
                          <>
                            <th
                              colSpan={itemSettingsColSpan}
                              className="px-2 py-1.5 text-center font-semibold border-b border-r-2 border-slate-400 bg-emerald-200 uppercase"
                            >
                              {selectedBusinessType
                                ? `${selectedBusinessType.name || 'Business type'} settings`
                                : 'Business type settings'}
                            </th>
                            {showCombinedCategoryMargins && selectedBusinessType
                              ? categoryTypes.map((cat) => (
                                  <th
                                    key={`${selectedBusinessType.id}-${cat.id}-label`}
                                    colSpan={2}
                                    className={`px-1 py-1.5 text-center font-semibold border-b border-r-2 border-slate-500 min-w-[6.5rem] ${BT_HEADER_STYLES[Math.max(selectedBusinessTypeIndex, 0) % BT_HEADER_STYLES.length]}`}
                                    title={cat.name || cat.type}
                                  >
                                    <span className="block leading-snug normal-case text-[12px]">
                                      {categoryLabel(cat.name || cat.type)}
                                    </span>
                                  </th>
                                ))
                              : null}
                            {showCombinedCreditMargins
                              ? creditTypes.map((ct, index) => (
                                  <th
                                    key={`${ct.id}-label`}
                                    colSpan={2}
                                    className={`px-1 py-1.5 text-center font-semibold border-b border-r-2 border-slate-500 min-w-[6.5rem] ${CT_HEADER_STYLES[index % CT_HEADER_STYLES.length]}`}
                                    title={ct.name || `Credit ${ct.id}`}
                                  >
                                    <span className="block leading-snug normal-case text-[12px]">
                                      {(ct.name || `Credit ${ct.id}`).toUpperCase()}
                                    </span>
                                  </th>
                                ))
                              : null}
                          </>
                        )}
                    </tr>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-600">
                      {showMarginScreens ? (
                        <>
                          {showCategoryMargins && selectedBusinessType
                            ? categoryTypes.map((cat) => (
                                <CategorySubHeader
                                  key={`${selectedBusinessType.id}-${cat.id}-sub`}
                                  canUpdate={canUpdate}
                                  onMarginClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'category',
                                      businessTypeId: selectedBusinessType.id,
                                      categoryTypeId: cat.id,
                                      field: 'margin_percent',
                                      groupLabel: `${selectedBusinessType.name || 'Business type'} · ${categoryLabel(cat.name || cat.type)}`,
                                      fieldLabel: 'Margin %',
                                    })
                                  }
                                  onMaxQtyClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'category',
                                      businessTypeId: selectedBusinessType.id,
                                      categoryTypeId: cat.id,
                                      field: 'max_quantity',
                                      groupLabel: `${selectedBusinessType.name || 'Business type'} · ${categoryLabel(cat.name || cat.type)}`,
                                      fieldLabel: 'Max Qty',
                                    })
                                  }
                                />
                              ))
                            : null}
                          {showCreditTypeMargins
                            ? creditTypes.map((ct) => (
                                <CategorySubHeader
                                  key={`${ct.id}-sub`}
                                  canUpdate={canUpdate}
                                  onMarginClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'credit',
                                      businessTypeId: selectedBusinessTypeId,
                                      creditTypeId: ct.id,
                                      field: 'margin_percent',
                                      groupLabel: `${selectedBusinessType?.name || 'Business type'} · ${(ct.name || `Credit ${ct.id}`).toUpperCase()}`,
                                      fieldLabel: 'Margin %',
                                    })
                                  }
                                  onMaxQtyClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'credit',
                                      businessTypeId: selectedBusinessTypeId,
                                      creditTypeId: ct.id,
                                      field: 'max_quantity',
                                      groupLabel: `${selectedBusinessType?.name || 'Business type'} · ${(ct.name || `Credit ${ct.id}`).toUpperCase()}`,
                                      fieldLabel: 'Max Qty',
                                    })
                                  }
                                />
                              ))
                            : null}
                        </>
                      ) : (
                        <>
                          {landingPriceOnly ? null : (
                            <>
                              <SettingsColumnHeader
                                label="Discount %"
                                canUpdate={canUpdate && selectedBusinessTypeId != null}
                                onClick={() =>
                                  openSettingsBulkDialog('discount_percent', 'Discount %')
                                }
                                sortIcon={renderSettingsSortIcon('discount_percent')}
                              />
                              <th
                                className={`${operatorHeaderClass} border-b-2 border-slate-400 bg-emerald-100 text-emerald-900`}
                                aria-hidden="true"
                              >
                                +
                              </th>
                              <SettingsColumnHeader
                                label="Freight"
                                canUpdate={canUpdate && selectedBusinessTypeId != null}
                                onClick={() =>
                                  openSettingsBulkDialog('freight_amount', 'Freight')
                                }
                                sortIcon={renderSettingsSortIcon('freight_amount')}
                              />
                              <th
                                className={`${operatorHeaderClass} border-b-2 border-slate-400 bg-emerald-100 text-emerald-900`}
                                aria-hidden="true"
                              >
                                +
                              </th>
                              <SettingsColumnHeader
                                label="Additional"
                                canUpdate={canUpdate && selectedBusinessTypeId != null}
                                onClick={() =>
                                  openSettingsBulkDialog('additional_amount', 'Additional')
                                }
                                sortIcon={renderSettingsSortIcon('additional_amount')}
                              />
                              <th
                                className={`${operatorHeaderClass} border-b-2 border-slate-400 bg-emerald-100 text-emerald-900`}
                                aria-hidden="true"
                              >
                                +
                              </th>
                              <SettingsColumnHeader
                                label="Sale Margin %"
                                canUpdate={canUpdate && selectedBusinessTypeId != null}
                                onClick={() =>
                                  openSettingsBulkDialog(
                                    'sale_margin_percent',
                                    'Sale Margin %',
                                  )
                                }
                                sortIcon={renderSettingsSortIcon('sale_margin_percent')}
                              />
                              <th
                                className={`${operatorHeaderClass} border-b-2 border-slate-400 bg-emerald-100 text-emerald-900`}
                                aria-hidden="true"
                              >
                                =
                              </th>
                            </>
                          )}
                          <th className="px-1 py-2 text-center font-semibold border-b-2 border-r-2 border-slate-400 whitespace-nowrap bg-emerald-100 text-emerald-950 w-[5.5rem]">
                            Landing Price
                          </th>
                          {showCombinedCategoryMargins && selectedBusinessType
                            ? categoryTypes.map((cat) => (
                                <CategorySubHeader
                                  key={`${selectedBusinessType.id}-${cat.id}-sub`}
                                  canUpdate={canUpdate}
                                  onMarginClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'category',
                                      businessTypeId: selectedBusinessType.id,
                                      categoryTypeId: cat.id,
                                      field: 'margin_percent',
                                      groupLabel: `${selectedBusinessType.name || 'Business type'} · ${categoryLabel(cat.name || cat.type)}`,
                                      fieldLabel: 'Margin %',
                                    })
                                  }
                                  onMaxQtyClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'category',
                                      businessTypeId: selectedBusinessType.id,
                                      categoryTypeId: cat.id,
                                      field: 'max_quantity',
                                      groupLabel: `${selectedBusinessType.name || 'Business type'} · ${categoryLabel(cat.name || cat.type)}`,
                                      fieldLabel: 'Max Qty',
                                    })
                                  }
                                />
                              ))
                            : null}
                          {showCombinedCreditMargins
                            ? creditTypes.map((ct) => (
                                <CategorySubHeader
                                  key={`${ct.id}-sub`}
                                  canUpdate={canUpdate}
                                  onMarginClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'credit',
                                      businessTypeId: selectedBusinessTypeId,
                                      creditTypeId: ct.id,
                                      field: 'margin_percent',
                                      groupLabel: `${selectedBusinessType?.name || 'Business type'} · ${(ct.name || `Credit ${ct.id}`).toUpperCase()}`,
                                      fieldLabel: 'Margin %',
                                    })
                                  }
                                  onMaxQtyClick={() =>
                                    openBulkColumnDialog({
                                      kind: 'credit',
                                      businessTypeId: selectedBusinessTypeId,
                                      creditTypeId: ct.id,
                                      field: 'max_quantity',
                                      groupLabel: `${selectedBusinessType?.name || 'Business type'} · ${(ct.name || `Credit ${ct.id}`).toUpperCase()}`,
                                      fieldLabel: 'Max Qty',
                                    })
                                  }
                                />
                              ))
                            : null}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSettingsDraftItems.map((item, rowIndex) => {
                      const settingsItem = itemWithBusinessTypeSettings(
                        item,
                        selectedBusinessTypeId,
                      )
                      const settingsApplied = isBusinessTypeItemSettingsApplied(settingsItem)
                      return (
                      <tr key={item.stock_item_id} className="hover:bg-slate-50/70 align-top">
                        <td className="sticky left-0 z-10 bg-white px-2.5 py-1.5 border-b border-r-2 border-slate-300 min-w-[180px]">
                          <div
                            className={`font-medium leading-snug ${
                              item.stock_item_is_active === false
                                ? 'text-red-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {item.stock_item_name || item.stock_item_reserved_name || `#${item.stock_item_id}`}
                          </div>
                        </td>
                        {showMarginScreens ? null : (
                          <td className="px-2 py-2 border-b border-r-2 border-slate-400 bg-slate-100 text-right align-middle">
                            <span
                              className="text-[14px] font-bold text-slate-800 tabular-nums whitespace-nowrap"
                              title="Shared base price from Landing Prices"
                            >
                              {formatBasePriceDisplay(item.base_price)}
                            </span>
                          </td>
                        )}
                        {landingPriceOnly || showMarginScreens ? null : (
                          <>
                        <td className="px-1 py-2 border-b border-slate-300 bg-emerald-50">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={MAX_THREE_DIGIT}
                            disabled={!canUpdate}
                            value={formatNum(settingsItem.discount_percent)}
                            onChange={(e) =>
                              updateItemField(item.stock_item_id, 'discount_percent', e.target.value)
                            }
                            {...bindMatrixItemCell(rowIndex, 0, {
                              itemId: item.stock_item_id,
                              field: 'discount_percent',
                              className: inputCompact,
                            })}
                          />
                        </td>
                        <td
                          className={`${operatorCellClass} border-b border-slate-300 bg-emerald-50`}
                          aria-hidden="true"
                        >
                          +
                        </td>
                        <td className="px-1 py-2 border-b border-slate-300 bg-emerald-50 align-top">
                          <div className="flex flex-col items-end gap-0.5">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max={MAX_THREE_DIGIT}
                              disabled={!canUpdate}
                              value={formatNum(settingsItem.freight_amount)}
                              onChange={(e) =>
                                updateItemField(item.stock_item_id, 'freight_amount', e.target.value)
                              }
                              {...bindMatrixItemCell(rowIndex, 1, {
                                itemId: item.stock_item_id,
                                field: 'freight_amount',
                                className: inputCompact,
                              })}
                            />
                            <span
                              className="text-[12px] font-bold leading-tight text-slate-500 tabular-nums whitespace-nowrap"
                              title={`Freight × conversion (${priceConversionFactor(settingsItem)})`}
                            >
                              {formatEffectivePrice(computeFreightConverted(settingsItem))}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`${operatorCellClass} border-b border-slate-300 bg-emerald-50`}
                          aria-hidden="true"
                        >
                          +
                        </td>
                        <td className="px-1 py-2 border-b border-slate-300 bg-emerald-50 align-top">
                          <div className="flex flex-col items-end gap-0.5">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max={MAX_THREE_DIGIT}
                              disabled={!canUpdate}
                              value={formatNum(settingsItem.additional_amount)}
                              onChange={(e) =>
                                updateItemField(item.stock_item_id, 'additional_amount', e.target.value)
                              }
                            {...bindMatrixItemCell(rowIndex, 2, {
                              itemId: item.stock_item_id,
                              field: 'additional_amount',
                              className: inputCompact,
                            })}
                            />
                            <span
                              className="text-[12px] font-bold leading-tight text-slate-500 tabular-nums whitespace-nowrap"
                              title={`Additional × conversion (${priceConversionFactor(settingsItem)})`}
                            >
                              {formatEffectivePrice(computeAdditionalConverted(settingsItem))}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`${operatorCellClass} border-b border-slate-300 bg-emerald-50`}
                          aria-hidden="true"
                        >
                          +
                        </td>
                        <td className="px-1 py-2 border-b border-slate-300 bg-emerald-50">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={MAX_THREE_DIGIT}
                            disabled={!canUpdate}
                            value={formatNum(settingsItem.sale_margin_percent)}
                            onChange={(e) =>
                              updateItemField(item.stock_item_id, 'sale_margin_percent', e.target.value)
                            }
                            {...bindMatrixItemCell(rowIndex, 3, {
                              itemId: item.stock_item_id,
                              field: 'sale_margin_percent',
                              className: inputCompact,
                            })}
                          />
                        </td>
                        <td
                          className={`${operatorCellClass} border-b border-slate-300 bg-emerald-50`}
                          aria-hidden="true"
                        >
                          =
                        </td>
                          </>
                        )}
                        <td className="px-1 py-2 border-b border-r-2 border-slate-400 bg-emerald-50 align-top">
                          <div className="flex flex-col items-end gap-0.5 px-1.5 py-1.5">
                            <div
                              className={`text-right text-[14px] font-bold tabular-nums whitespace-nowrap ${landingPriceToneClass(settingsItem)}`}
                              title={
                                settingsApplied
                                  ? '((Base − Discount%) + Freight + Additional) × (1 + Sale Margin%) × Conversion — base kept as entered; pack result ceiled'
                                  : 'No business-type settings applied — landing equals Base × Conversion'
                              }
                            >
                              {formatEffectivePrice(computeLandingPrice(settingsItem))}
                            </div>
                            <span
                              className="text-[12px] font-bold leading-tight text-slate-500 tabular-nums whitespace-nowrap"
                              title="Net unit price after discount, charges, and sale margin"
                            >
                              {formatUnitPriceOneDecimal(computeLandingUnitPrice(settingsItem))}
                            </span>
                          </div>
                        </td>
                        {showCombinedCategoryMargins
                          ? (() => {
                              const bt =
                                (item.business_types || []).find(
                                  (row) =>
                                    String(row.business_type_id) === String(selectedBusinessTypeId),
                                ) || null
                              if (!bt) return null
                              return (
                                <BusinessTypeCategoryCells
                                  key={`${item.stock_item_id}-${bt.business_type_id}`}
                                  item={settingsItem}
                                  itemId={item.stock_item_id}
                                  bt={bt}
                                  btIndex={0}
                                  rowIndex={rowIndex}
                                  categoryTypes={categoryTypes}
                                  canUpdate={canUpdate}
                                  onCategoryFieldChange={updateCategoryField}
                                  onMatrixKeyDown={handleMatrixKeyDown}
                                  onMatrixCopy={handleMatrixCopy}
                                  onMatrixPaste={handleMatrixPaste}
                                  onMatrixCellMouseDown={handleMatrixCellMouseDown}
                                  onMatrixCellFocus={handleMatrixCellFocus}
                                  matrixCellClass={matrixCellClass}
                                />
                              )
                            })()
                          : null}
                        {showCombinedCreditMargins ? (
                          <CreditTypeMarginCells
                            item={item}
                            pricingItem={settingsItem}
                            itemId={item.stock_item_id}
                            businessTypeId={selectedBusinessTypeId}
                            creditTypes={creditTypes}
                            rowIndex={rowIndex}
                            colOffset={6 + categoryTypes.length * 2}
                            canUpdate={canUpdate}
                            onCreditTypeFieldChange={updateCreditTypeField}
                            onMatrixKeyDown={handleMatrixKeyDown}
                            onMatrixCopy={handleMatrixCopy}
                            onMatrixPaste={handleMatrixPaste}
                            onMatrixCellMouseDown={handleMatrixCellMouseDown}
                            onMatrixCellFocus={handleMatrixCellFocus}
                            matrixCellClass={matrixCellClass}
                          />
                        ) : null}
                        {showMarginScreens ? (
                          <>
                            {showCategoryMargins
                              ? (() => {
                                  const bt =
                                    (item.business_types || []).find(
                                      (row) =>
                                        String(row.business_type_id) === String(selectedBusinessTypeId),
                                    ) || null
                                  if (!bt) return null
                                  return (
                                    <BusinessTypeCategoryCells
                                      key={`${item.stock_item_id}-${bt.business_type_id}-legacy`}
                                      item={settingsItem}
                                      itemId={item.stock_item_id}
                                      bt={bt}
                                      btIndex={0}
                                      rowIndex={rowIndex}
                                      categoryTypes={categoryTypes}
                                      canUpdate={canUpdate}
                                      onCategoryFieldChange={updateCategoryField}
                                      onMatrixKeyDown={handleMatrixKeyDown}
                                      onMatrixCopy={handleMatrixCopy}
                                      onMatrixPaste={handleMatrixPaste}
                                      onMatrixCellMouseDown={handleMatrixCellMouseDown}
                                      onMatrixCellFocus={handleMatrixCellFocus}
                                      matrixCellClass={matrixCellClass}
                                    />
                                  )
                                })()
                              : null}
                            {showCreditTypeMargins ? (
                              <CreditTypeMarginCells
                                item={item}
                                pricingItem={settingsItem}
                                itemId={item.stock_item_id}
                                businessTypeId={selectedBusinessTypeId}
                                creditTypes={creditTypes}
                                rowIndex={rowIndex}
                                colOffset={showCategoryMargins ? 6 + categoryTypes.length * 2 : 0}
                                canUpdate={canUpdate}
                                onCreditTypeFieldChange={updateCreditTypeField}
                                onMatrixKeyDown={handleMatrixKeyDown}
                                onMatrixCopy={handleMatrixCopy}
                                onMatrixPaste={handleMatrixPaste}
                                onMatrixCellMouseDown={handleMatrixCellMouseDown}
                                onMatrixCellFocus={handleMatrixCellFocus}
                                matrixCellClass={matrixCellClass}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.total_pages > 1 ? (
              <div className="px-4 py-3 border-t border-gray-200">
                <Pagination
                  currentPage={page}
                  totalPages={pagination.total_pages}
                  totalCount={pagination.total || 0}
                  pageSize={pagination.per_page || PAGE_SIZE}
                  onPageChange={(next) => {
                    setPage(next)
                  }}
                />
              </div>
            ) : null}

            {saveButton ? (
              <div className="px-4 py-3 border-t border-gray-200 bg-slate-50/80 flex justify-end">
                {saveButton}
              </div>
            ) : null}
          </section>
          ) : null}
        </div>
      </main>

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
                <p className="text-xs text-blue-100 mt-1">
                  Filter by base price, GST, supplier ledger, and stock hierarchy
                </p>
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
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <FilterLabel icon={Percent}>Base Price</FilterLabel>
                  <select
                    value={basePriceFilter}
                    onChange={(e) => {
                      setBasePriceFilter(e.target.value)
                      setPage(1)
                    }}
                    aria-label="Base price filter"
                    className={filterSelectClass}
                  >
                    {BASE_PRICE_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all-base'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FilterLabel icon={Percent}>GST Rate</FilterLabel>
                  <select
                    value={gstRate}
                    onChange={(e) =>
                      applyFilters({ nextGstRate: e.target.value == null ? '' : String(e.target.value) })
                    }
                    aria-label="GST Rate"
                    className={filterSelectClass}
                  >
                    {GST_RATE_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FilterLabel icon={Users}>Ledger</FilterLabel>
                  <SearchSelectDropdown
                    value={ledgerId}
                    options={ledgerOptions}
                    onChange={(value) =>
                      applyFilters({ nextLedgerId: value == null ? '' : String(value) })
                    }
                    placeholder="All suppliers"
                    searchPlaceholder="Search supplier ledgers..."
                    emptyText="No supplier ledgers found"
                    loading={supplierLedgersLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={Layers}>Stock Group</FilterLabel>
                  <SearchSelectDropdown
                    value={stockGroup}
                    options={stockGroupOptions}
                    onChange={(value) =>
                      applyFilters({ nextGroup: value == null ? '' : String(value) })
                    }
                    placeholder="All stock groups"
                    searchPlaceholder="Search stock groups..."
                    emptyText="No stock groups found"
                    loading={stockGroupsLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={Tags}>Stock Category</FilterLabel>
                  <SearchSelectDropdown
                    value={stockCategory}
                    options={stockCategoryOptions}
                    onChange={(value) =>
                      applyFilters({
                        nextCategory: value == null ? '' : String(value),
                        nextSubCategory: '',
                      })
                    }
                    placeholder="All stock categories"
                    searchPlaceholder="Search categories..."
                    emptyText="No categories found"
                    loading={stockCategoriesLoading}
                    clearable
                    useFixedMenu
                  />
                </div>

                <div>
                  <FilterLabel icon={FolderTree}>Stock Sub Category</FilterLabel>
                  <SearchSelectDropdown
                    value={stockSubCategory}
                    options={stockSubCategoryOptions}
                    onChange={(value) =>
                      applyFilters({ nextSubCategory: value == null ? '' : String(value) })
                    }
                    placeholder="All stock sub categories"
                    searchPlaceholder="Search sub categories..."
                    emptyText="No sub categories found"
                    loading={stockSubCategoriesLoading}
                    clearable
                    useFixedMenu
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex-1 inline-flex items-center justify-center h-10 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
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

      <ItemPriceMarginLogsDialog
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        title="Item Price Margin Logs"
      />

      <DownloadPriceListDialog
        open={priceListDialogOpen}
        onClose={() => setPriceListDialogOpen(false)}
        businessTypes={businessTypes}
        categoryTypes={categoryTypes}
        creditTypes={creditTypes}
        draftItems={draftItems}
        totalItems={pagination.total || draftItems.length}
        activeFilters={{
          search,
          is_active: statusFilter || undefined,
          base_price_filter: basePriceFilter || undefined,
          gst_rate: gstRate || undefined,
          stock_group: stockGroup || undefined,
          stock_category: stockCategory || undefined,
          stock_sub_category: stockSubCategory || undefined,
          ...(ledgerId === 'none'
            ? { no_supplier: true }
            : ledgerId
              ? { ledger_id: ledgerId }
              : {}),
        }}
        cloneMatrixItemsFn={cloneMatrixItems}
        onSuccess={(msg) => showSuccess(msg)}
        onError={(err) => showError(err)}
      />

      {bulkColumnDialog ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] cursor-pointer"
            aria-label="Close bulk update"
            onClick={closeBulkColumnDialog}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Bulk update {bulkColumnDialog.fieldLabel}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bulkColumnDialog.groupLabel} · applies to all {draftItems.length} item
                  {draftItems.length === 1 ? '' : 's'} on this page
                </p>
              </div>
              <button
                type="button"
                onClick={closeBulkColumnDialog}
                className="rounded-lg p-1.5 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                {bulkColumnDialog.fieldLabel}
                <input
                  type="number"
                  min="0"
                  max={
                    bulkColumnDialog.kind === 'settings'
                      ? MAX_THREE_DIGIT
                      : bulkColumnDialog.field === 'margin_percent'
                        ? MAX_MARGIN_PERCENT
                        : MAX_MAX_QTY
                  }
                  step={
                    bulkColumnDialog.kind === 'settings' ||
                    bulkColumnDialog.field === 'margin_percent'
                      ? '0.01'
                      : '1'
                  }
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                  value={bulkColumnValue}
                  onChange={(e) => setBulkColumnValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyBulkColumnToPage()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      closeBulkColumnDialog()
                    }
                  }}
                  placeholder={
                    bulkColumnDialog.kind === 'settings'
                      ? 'e.g. 3'
                      : bulkColumnDialog.field === 'margin_percent'
                        ? 'e.g. 5'
                        : 'e.g. 50'
                  }
                />
              </label>
              <p className="text-xs text-slate-500">
                {bulkColumnDialog.kind === 'settings'
                  ? 'Updates only this column for the selected business type on every item on this page, then saves immediately. Other columns and business types are left unchanged.'
                  : 'Updates only this column for the selected business type on every item on this page, then saves immediately. Other categories and business types are left unchanged.'}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={closeBulkColumnDialog}
                disabled={bulkColumnMutation.isPending}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyBulkColumnToPage}
                disabled={bulkColumnMutation.isPending}
                className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer disabled:opacity-50"
              >
                {bulkColumnMutation.isPending ? 'Saving...' : 'Apply & Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CategorySubHeader({ canUpdate = false, onMarginClick, onMaxQtyClick }) {
  const clickableClass = canUpdate
    ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-900 transition-colors'
    : ''
  return (
    <>
      <th
        className={`px-1 py-2 text-center font-semibold border-b-2 border-slate-400 whitespace-nowrap bg-white w-14 ${clickableClass}`}
        title={canUpdate ? 'Click to bulk update Margin % for this column on this page' : undefined}
        onClick={canUpdate ? onMarginClick : undefined}
      >
        Margin %
      </th>
      <th
        className={`px-1 py-2 text-center font-semibold border-b-2 border-r-2 border-slate-500 whitespace-nowrap bg-white w-12 ${clickableClass}`}
        title={canUpdate ? 'Click to bulk update Max Qty for this column on this page' : undefined}
        onClick={canUpdate ? onMaxQtyClick : undefined}
      >
        Max Qty
      </th>
    </>
  )
}

function SettingsColumnHeader({ label, canUpdate = false, onClick, sortIcon = null }) {
  const clickableClass = canUpdate
    ? 'cursor-pointer hover:bg-emerald-50 hover:text-emerald-950 transition-colors'
    : ''
  return (
    <th
      className={`px-1 py-2 text-center font-semibold border-b-2 border-slate-400 whitespace-nowrap bg-emerald-100 text-emerald-950 w-12 ${clickableClass}`}
      title={
        canUpdate
          ? `Click to bulk update ${label} for this column on this page`
          : undefined
      }
      onClick={canUpdate ? onClick : undefined}
    >
      <span className="inline-flex items-center justify-center gap-0.5">
        <span>{label}</span>
        {sortIcon}
      </span>
    </th>
  )
}

function CreditTypeMarginCells({
  item,
  pricingItem,
  itemId,
  businessTypeId,
  creditTypes,
  rowIndex,
  colOffset = 6,
  canUpdate,
  onCreditTypeFieldChange,
  onMatrixKeyDown,
  onMatrixCopy,
  onMatrixPaste,
  onMatrixCellMouseDown,
  onMatrixCellFocus,
  matrixCellClass,
}) {
  const marginsById = useMemo(() => {
    const map = new Map()
    const bt =
      (item.business_types || []).find(
        (row) => String(row.business_type_id) === String(businessTypeId),
      ) || null
    const creditRows = bt?.credit_types || item.credit_types || []
    creditRows.forEach((ct) => map.set(Number(ct.credit_type_id), ct))
    return map
  }, [item.business_types, item.credit_types, businessTypeId])
  const landingSource = pricingItem || item

  return (
    <>
      {creditTypes.map((ct, ctIndex) => {
        const row = marginsById.get(Number(ct.id))
        const margin = row ? toNum(row.margin_percent, 0) : 0
        const maxQty = row ? toNum(row.max_quantity, 0) : 0
        const effectivePrice = computeEffectivePrice(landingSource, margin)
        const marginCol = colOffset + ctIndex * 2
        const maxQtyCol = marginCol + 1
        return (
          <Fragment key={ct.id}>
            <td className="px-1 py-2 border-b border-slate-300 align-top">
              <div className="flex flex-col items-end gap-0.5">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={MAX_MARGIN_PERCENT}
                  disabled={!canUpdate}
                  className={matrixCellClass?.(inputCompact, rowIndex, marginCol) || inputCompact}
                  data-margin-cell={`${rowIndex}-${marginCol}`}
                  data-margin-kind="credit"
                  data-margin-item-id={itemId}
                  data-margin-field="margin_percent"
                  data-margin-bt-id={businessTypeId ?? ''}
                  data-margin-ct-id={ct.id}
                  value={formatNum(margin)}
                  onChange={(e) =>
                    onCreditTypeFieldChange(itemId, ct.id, 'margin_percent', e.target.value)
                  }
                  onWheel={preventNumberInputWheel}
                  onMouseDown={(e) => onMatrixCellMouseDown?.(e, rowIndex, marginCol)}
                  onFocus={() => onMatrixCellFocus?.(rowIndex, marginCol)}
                  onCopy={(e) => onMatrixCopy?.(e, rowIndex, marginCol)}
                  onPaste={(e) => onMatrixPaste?.(e, rowIndex, marginCol)}
                  onKeyDown={(e) => onMatrixKeyDown?.(e, rowIndex, marginCol)}
                />
                <span
                  className="text-[12px] font-bold leading-tight text-slate-500 tabular-nums whitespace-nowrap"
                  title="BT landing price + credit type margin %"
                >
                  {formatEffectivePrice(effectivePrice)}
                </span>
              </div>
            </td>
            <td className="px-1 py-2 border-b border-r-2 border-slate-500">
              <input
                type="number"
                step="1"
                min="0"
                max={MAX_MAX_QTY}
                disabled={!canUpdate}
                className={matrixCellClass?.(inputCompact, rowIndex, maxQtyCol) || inputCompact}
                data-margin-cell={`${rowIndex}-${maxQtyCol}`}
                data-margin-kind="credit"
                data-margin-item-id={itemId}
                data-margin-field="max_quantity"
                data-margin-bt-id={businessTypeId ?? ''}
                data-margin-ct-id={ct.id}
                value={formatNum(maxQty)}
                onChange={(e) =>
                  onCreditTypeFieldChange(itemId, ct.id, 'max_quantity', e.target.value)
                }
                onWheel={preventNumberInputWheel}
                onMouseDown={(e) => onMatrixCellMouseDown?.(e, rowIndex, maxQtyCol)}
                onFocus={() => onMatrixCellFocus?.(rowIndex, maxQtyCol)}
                onCopy={(e) => onMatrixCopy?.(e, rowIndex, maxQtyCol)}
                onPaste={(e) => onMatrixPaste?.(e, rowIndex, maxQtyCol)}
                onKeyDown={(e) => onMatrixKeyDown?.(e, rowIndex, maxQtyCol)}
              />
            </td>
          </Fragment>
        )
      })}
    </>
  )
}

function BusinessTypeCategoryCells({
  item,
  itemId,
  bt,
  btIndex,
  rowIndex,
  categoryTypes,
  canUpdate,
  onCategoryFieldChange,
  onMatrixKeyDown,
  onMatrixCopy,
  onMatrixPaste,
  onMatrixCellMouseDown,
  onMatrixCellFocus,
  matrixCellClass,
}) {
  const categoriesById = useMemo(() => {
    const map = new Map()
    ;(bt.categories || []).forEach((cat) => map.set(Number(cat.category_type_id), cat))
    return map
  }, [bt.categories])

  return (
    <>
      {categoryTypes.map((cat, catIndex) => {
        const row = categoriesById.get(Number(cat.id))
        const margin = row ? toNum(row.margin_percent, 0) : 0
        const maxQty = row ? toNum(row.max_quantity, 0) : 0
        const effectivePrice = computeEffectivePrice(item, margin)
        const marginCol = 6 + btIndex * categoryTypes.length * 2 + catIndex * 2
        const maxQtyCol = marginCol + 1
        return (
          <Fragment key={cat.id}>
            <td className="px-1 py-2 border-b border-slate-300 align-top">
              <div className="flex flex-col items-end gap-0.5">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={MAX_MARGIN_PERCENT}
                  disabled={!canUpdate}
                  className={matrixCellClass?.(inputCompact, rowIndex, marginCol) || inputCompact}
                  data-margin-cell={`${rowIndex}-${marginCol}`}
                  data-margin-kind="category"
                  data-margin-item-id={itemId}
                  data-margin-field="margin_percent"
                  data-margin-bt-id={bt.business_type_id}
                  data-margin-cat-id={cat.id}
                  value={formatNum(margin)}
                  onChange={(e) =>
                    onCategoryFieldChange(
                      itemId,
                      bt.business_type_id,
                      cat.id,
                      'margin_percent',
                      e.target.value,
                    )
                  }
                  onWheel={preventNumberInputWheel}
                  onMouseDown={(e) => onMatrixCellMouseDown?.(e, rowIndex, marginCol)}
                  onFocus={() => onMatrixCellFocus?.(rowIndex, marginCol)}
                  onCopy={(e) => onMatrixCopy?.(e, rowIndex, marginCol)}
                  onPaste={(e) => onMatrixPaste?.(e, rowIndex, marginCol)}
                  onKeyDown={(e) => onMatrixKeyDown?.(e, rowIndex, marginCol)}
                />
                <span
                  className="text-[12px] font-bold leading-tight text-slate-500 tabular-nums whitespace-nowrap"
                  title="Landing price + category margin %"
                >
                  {formatEffectivePrice(effectivePrice)}
                </span>
              </div>
            </td>
            <td className="px-1 py-2 border-b border-r-2 border-slate-500">
              <input
                type="number"
                step="1"
                min="0"
                max={MAX_MAX_QTY}
                disabled={!canUpdate}
                className={matrixCellClass?.(inputCompact, rowIndex, maxQtyCol) || inputCompact}
                data-margin-cell={`${rowIndex}-${maxQtyCol}`}
                data-margin-kind="category"
                data-margin-item-id={itemId}
                data-margin-field="max_quantity"
                data-margin-bt-id={bt.business_type_id}
                data-margin-cat-id={cat.id}
                value={formatNum(maxQty)}
                onChange={(e) =>
                  onCategoryFieldChange(
                    itemId,
                    bt.business_type_id,
                    cat.id,
                    'max_quantity',
                    e.target.value,
                  )
                }
                onWheel={preventNumberInputWheel}
                onMouseDown={(e) => onMatrixCellMouseDown?.(e, rowIndex, maxQtyCol)}
                onFocus={() => onMatrixCellFocus?.(rowIndex, maxQtyCol)}
                onCopy={(e) => onMatrixCopy?.(e, rowIndex, maxQtyCol)}
                onPaste={(e) => onMatrixPaste?.(e, rowIndex, maxQtyCol)}
                onKeyDown={(e) => onMatrixKeyDown?.(e, rowIndex, maxQtyCol)}
              />
            </td>
          </Fragment>
        )
      })}
    </>
  )
}
