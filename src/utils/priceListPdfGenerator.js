import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { AuthService } from '@/lib/auth'
import { getSavedOrganizationInfo, fetchOrganizationInfo } from '@/lib/dashboard_api'
import {
  drawPdfCompanyHeader,
  resolvePdfCompanyHeader,
} from '@/utils/pdfCompanyHeader'

const MARGIN = 12

const COLORS = {
  primary: [30, 58, 138], // Blue 900
  headerBg: [248, 250, 252], // Slate 50
  border: [203, 213, 225], // Slate 300
  text: [15, 23, 42], // Slate 900
  muted: [100, 116, 139], // Slate 500
  priceGreen: [22, 101, 52], // Emerald 800
}

export function toNum(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function kgConversionFactor(item) {
  if (item?.kg_conversion_factor != null && Number(item.kg_conversion_factor) > 0) {
    return toNum(item.kg_conversion_factor, 1)
  }
  const conv = toNum(item?.conversion, 0)
  const factor = conv * 100
  return factor > 0 ? factor : 1
}

export function defaultPriceConversion(item) {
  if (item?.default_price_conversion != null && toNum(item.default_price_conversion) > 0) {
    return toNum(item.default_price_conversion, 1)
  }
  const sec = toNum(item?.secondary_conversion, 0)
  if (sec > 1) return sec
  return kgConversionFactor(item)
}

export function priceConversionFactor(item) {
  const stored = toNum(item?.price_conversion, 0)
  if (stored > 0) return stored
  return defaultPriceConversion(item)
}

const MAX_THREE_DIGIT = 999
const MAX_PRICE_CONVERSION = 9999

function clampThreeDigit(value) {
  const n = toNum(value, 0)
  if (n < 0) return 0
  if (n > MAX_THREE_DIGIT) return MAX_THREE_DIGIT
  return n
}

function clampPriceConversion(value) {
  const n = toNum(value, 0)
  if (n < 0) return 0
  if (n > MAX_PRICE_CONVERSION) return MAX_PRICE_CONVERSION
  return Math.round(n * 1000) / 1000
}

/**
 * Merge shared base_price with selected business-type cost fields.
 * Must match Item Price Margin page `itemWithBusinessTypeSettings`.
 */
export function itemWithBusinessTypeSettings(item, businessTypeId) {
  if (!item) return item
  const bt =
    (item.business_types || []).find(
      (row) => String(row.business_type_id) === String(businessTypeId),
    ) || null
  if (!bt) return item
  return {
    ...item,
    freight_amount: clampThreeDigit(bt.freight_amount),
    additional_amount: clampThreeDigit(bt.additional_amount),
    discount_percent: clampThreeDigit(bt.discount_percent),
    sale_margin_percent: clampThreeDigit(bt.sale_margin_percent),
    price_conversion:
      bt.price_conversion != null && toNum(bt.price_conversion) > 0
        ? clampPriceConversion(bt.price_conversion)
        : priceConversionFactor(item),
  }
}

/**
 * Ceil any fractional rupee to a whole number — same as Item Price Margin / Price Master Base.
 * Example: 101.12 → 102, 101.0 → 101
 */
export function ceilBaseUnitPrice(value) {
  const n = toNum(value, 0)
  if (!Number.isFinite(n)) return 0
  if (n >= 0) return Math.ceil(n - Number.EPSILON)
  return -Math.floor(Math.abs(n) - Number.EPSILON)
}

/**
 * Price Master unit/alt rounding: bump to the next tenth whenever any hundredth is present.
 * Example: 28.01 → 28.1, 32.40 → 32.4, 28.0 → 28.0
 */
export function roundPriceOneDecimal(value) {
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

/** Discount on ceiled base first, then freight + additional (matches page). */
export function computeItemSettingsSubtotalKg(item) {
  const base = ceilBaseUnitPrice(item.base_price)
  const freight = toNum(item.freight_amount, 0)
  const additional = toNum(item.additional_amount, 0)
  const discountPct = toNum(item.discount_percent, 0)
  const discountedBase = Math.max(0, base * (1 - discountPct / 100))
  return discountedBase + freight + additional
}

export function computeLandingUnitPrice(item) {
  const subtotal = computeItemSettingsSubtotalKg(item)
  const saleMarginPct = toNum(item.sale_margin_percent, 0)
  return subtotal * (1 + saleMarginPct / 100)
}

/**
 * Landing / pack price = ceil of
 * ((base_ceiled * (1 - discount%/100)) + freight + additional) * (1 + sale_margin%/100)
 *   × price_conversion
 */
export function computeLandingPrice(item) {
  return ceilBaseUnitPrice(
    computeLandingUnitPrice(item) * priceConversionFactor(item),
  )
}

/** Customer/category margin on landing; result ceiled to whole ₹ (matches page). */
export function computeEffectivePrice(item, marginPercent) {
  const landing = computeLandingPrice(item)
  const marginPct = toNum(marginPercent, 0)
  const marginAmt = (landing * marginPct) / 100
  return ceilBaseUnitPrice(Math.max(0, landing + marginAmt))
}

/**
 * Pack/base rate matching Item Price Margin page + credit:
 * landing → + category margin (ceil) → + credit margin (ceil).
 * ``computeLandingPrice`` is already the pack landing.
 */
export function computeCustomerPackPrice(item, categoryMarginPercent, creditMarginPercent = 0) {
  const withCategory = computeEffectivePrice(item, categoryMarginPercent)
  const creditPct = toNum(creditMarginPercent, 0)
  if (!creditPct) return withCategory
  return ceilBaseUnitPrice(Math.max(0, withCategory * (1 + creditPct / 100)))
}

/** Unit / KG (or secondary) rate from the final pack price — 1 decimal like Price Master. */
export function computeCustomerUnitPrice(item, categoryMarginPercent, creditMarginPercent = 0) {
  const pktPrice = computeCustomerPackPrice(item, categoryMarginPercent, creditMarginPercent)
  if (hasSecondaryUnitConversion(item)) {
    const sec = toNum(item?.secondary_conversion, 0)
    if (!(sec > 1)) return pktPrice
    return roundPriceOneDecimal(pktPrice / sec)
  }
  const factor = priceConversionFactor(item)
  if (!(factor > 0)) return pktPrice
  return roundPriceOneDecimal(pktPrice / factor)
}

/**
 * Alternate-unit factor from the item master, e.g. 0.1 when one base unit
 * (a 10 kg packet) is a tenth of the alternate unit (a quintal).
 */
export function alternateUnitConversion(item) {
  return toNum(item?.conversion, 0)
}

/**
 * Rate for one alternate unit. ``computeEffectivePrice`` is the base-unit rate,
 * so the alternate rate is that divided by the item conversion. Returns null
 * when the master has no usable conversion.
 */
export function computeAlternateUnitPrice(item, marginPercent) {
  const factor = alternateUnitConversion(item)
  if (!(factor > 0)) return null
  const basePrice = computeEffectivePrice(item, marginPercent)
  return roundPriceOneDecimal(basePrice / factor)
}

/**
 * Unit / KG price matching the Landing Price sub-value on Item Price Margin
 * (landing unit price + category margin %), i.e. pkt effective ÷ price_conversion.
 */
export function computeEffectiveUnitPrice(item, marginPercent) {
  const pktPrice = computeEffectivePrice(item, marginPercent)
  const factor = priceConversionFactor(item)
  if (!(factor > 0)) return pktPrice
  return roundPriceOneDecimal(pktPrice / factor)
}

/** True when secondary_conversion is configured meaningfully (not 0/1). */
export function hasSecondaryUnitConversion(item) {
  const sec = toNum(item?.secondary_conversion, 0)
  return sec > 1
}

/**
 * Minimum-unit price from pack/base effective price when secondary_conversion > 1
 * (e.g. 20 Pcs per Pkt → pkt price / 20).
 */
export function computeSecondaryUnitPrice(item, marginPercent) {
  const sec = toNum(item?.secondary_conversion, 0)
  if (!(sec > 1)) return null
  const pktPrice = computeEffectivePrice(item, marginPercent)
  return roundPriceOneDecimal(pktPrice / sec)
}

/**
 * First PDF price column: secondary/minimum-unit rate when secondary_conversion > 1,
 * otherwise the existing KG / unit landing price.
 */
export function computePdfFirstColumnPrice(item, marginPercent) {
  if (hasSecondaryUnitConversion(item)) {
    return computeSecondaryUnitPrice(item, marginPercent)
  }
  return computeEffectiveUnitPrice(item, marginPercent)
}

/** Unit label for the first PDF price column. */
export function pdfFirstColumnUnitLabel(item) {
  if (hasSecondaryUnitConversion(item)) {
    return unitLabel(item?.minimum_unit_name) || null
  }
  return isQtlAlternateUnit(item?.alternate_unit_name) ? 'Kg' : null
}

/** True when the alternate unit is quintal (qtl / qtls, any case). */
export function isQtlAlternateUnit(unitName) {
  const text = String(unitName || '').trim().toLowerCase()
  if (!text) return false
  return /\bqtls?\b/.test(text) || text === 'qtl' || text === 'qtls'
}

function unitLabel(name) {
  const text = String(name || '').trim()
  return text || null
}

/**
 * Format money like Price Master:
 * - wholeNumber → Base/Pkt (₹280)
 * - otherwise → Unit/Alt with one decimal (₹28.0)
 */
export function formatPriceListMoney(value, { wholeNumber = false } = {}) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  if (wholeNumber) {
    return ceilBaseUnitPrice(n).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }
  const rounded = roundPriceOneDecimal(n)
  return rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** "28.0 / PC" or "280 / Pkt" — matches Price Master Unit / Base columns. */
export function priceWithUnit(value, unitName, { wholeNumber = false } = {}) {
  if (value == null || !Number.isFinite(parseFloat(value))) return '—'
  const label = unitLabel(unitName)
  const amount = formatPriceListMoney(value, { wholeNumber })
  return label ? `${amount} / ${label}` : amount
}

/** Base price display — keep decimals as entered / stored (matches page). */
export function formatBasePriceDisplay(value) {
  const n = toNum(value, 0)
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/** Landing / pack selling price — whole ₹ after ceil (Price Master Base column). */
export function formatEffectivePrice(value) {
  return formatPriceListMoney(value, { wholeNumber: true })
}

/** Unit / alt selling price — one decimal (Price Master Unit / Alt columns). */
export function formatUnitPrice(value) {
  return formatPriceListMoney(value, { wholeNumber: false })
}

export function getPriceListSubCategory(item) {
  return String(item?.sub_category || item?.stock_sub_category || '').trim()
}

export function filterActivePriceListItems(items, businessTypeId, categoryTypeId) {
  return (items || []).filter((item) => {
    if (item.is_active === false || item.is_active === 0) return false
    const bt = (item.business_types || []).find(
      (b) => Number(b.business_type_id) === Number(businessTypeId),
    )
    const cat = (bt?.categories || []).find(
      (c) => Number(c.category_type_id) === Number(categoryTypeId),
    )
    if (cat && (cat.is_active === false || cat.is_active === 0)) return false
    return true
  })
}

export function sortPriceListItemsBySubCategory(items) {
  return [...(items || [])].sort((a, b) => {
    const sa = getPriceListSubCategory(a).toLowerCase()
    const sb = getPriceListSubCategory(b).toLowerCase()
    if (sa !== sb) {
      if (!sa) return 1
      if (!sb) return -1
      return sa.localeCompare(sb)
    }
    const na = String(a.stock_item_name || a.stock_item_reserved_name || '').toLowerCase()
    const nb = String(b.stock_item_name || b.stock_item_reserved_name || '').toLowerCase()
    return na.localeCompare(nb)
  })
}

/**
 * Landing Prices matrix rows — same columns and calc as the Item Price Margin
 * "% Landing Prices" table:
 * Stock Item | Base Price | Conversion | Landing Price per business type
 */
export function buildLandingPricesMatrixRows(items = [], businessTypes = []) {
  const activeItems = sortPriceListItemsBySubCategory(
    (items || []).filter((item) => !(item.is_active === false || item.is_active === 0)),
  )
  const btList = Array.isArray(businessTypes) ? businessTypes : []

  const rows = activeItems.map((item, idx) => {
    const itemName =
      item.stock_item_name || item.stock_item_reserved_name || `Item #${item.stock_item_id || idx + 1}`
    const subCategory = getPriceListSubCategory(item) || '—'
    // Overview conversion column uses the shared item factor (same as the page).
    const conversion = priceConversionFactor(item)
    const landingByBusinessType = {}
    btList.forEach((btMeta) => {
      const btId = btMeta?.id ?? btMeta?.business_type_id
      if (btId == null) return
      const pricedItem = itemWithBusinessTypeSettings(item, btId)
      landingByBusinessType[String(btId)] = computeLandingPrice(pricedItem)
    })

    return {
      slNo: String(idx + 1),
      subCategory,
      productName: itemName,
      basePrice: toNum(item?.base_price, 0),
      conversion,
      landingByBusinessType,
    }
  })

  return { activeItems, rows, businessTypes: btList }
}

/**
 * Build export rows from so-items-list / Price Master stock items (already-priced).
 * Columns match the margin price-list PDF/Excel: Sub Category, Product, KG/PC, Pkt/Bag.
 */
export function buildPriceListExportRowsFromSoItems(items = []) {
  const normalized = (items || []).map((item) => ({
    ...item,
    stock_item_name: item?.stock_item_name || item?.name || item?.item_name || '',
    stock_item_reserved_name: item?.stock_item_reserved_name || item?.reserved_name || '',
    sub_category:
      item?.sub_category ||
      item?.stock_sub_category ||
      item?.parent ||
      item?.category ||
      '',
  }))
  const activeItems = sortPriceListItemsBySubCategory(
    normalized.filter((item) => !(item.is_active === false || item.is_active === 0)),
  )

  const rows = activeItems.map((item, idx) => {
    const itemName =
      item.stock_item_name || item.stock_item_reserved_name || `Item #${item.id || idx + 1}`
    const subCategory = getPriceListSubCategory(item) || '—'
    const unitPrice = parseFloat(item.unit_price ?? item.minimum_unit?.price)
    const rawBase = parseFloat(item.base_unit?.price ?? item.base_price)
    const basePrice = Number.isFinite(rawBase) ? ceilBaseUnitPrice(rawBase) : null
    const unitName = (
      item.minimum_unit?.name ||
      item.unit_of_measurement?.name ||
      'unit'
    ).trim()
    const baseName = (item.base_unit?.name || 'base').trim() || 'base'
    // Price Master: unit = 1 decimal, base/pkt = whole ₹.
    const firstPrice = Number.isFinite(unitPrice) ? roundPriceOneDecimal(unitPrice) : null
    const pktPrice = Number.isFinite(basePrice) ? basePrice : null

    return {
      slNo: String(idx + 1),
      subCategory,
      productName: itemName,
      basePrice: pktPrice ?? 0,
      conversion: toNum(item.conversion, 0),
      landingPrice: pktPrice ?? 0,
      categoryMargin: 0,
      creditMargin: 0,
      kgPcPrice: firstPrice == null ? '-' : priceWithUnit(firstPrice, unitName),
      pktBagPrice:
        pktPrice == null ? '-' : priceWithUnit(pktPrice, baseName, { wholeNumber: true }),
      kgPcPriceValue: firstPrice,
      pktBagPriceValue: pktPrice,
    }
  })

  return { activeItems, rows }
}

/** Shared row payloads for PDF / Excel price list exports (single BT + category [+ credit]). */
export function buildPriceListExportRows(
  items,
  businessTypeId,
  categoryTypeId,
  creditTypeId = null,
) {
  const activeItems = sortPriceListItemsBySubCategory(
    filterActivePriceListItems(items, businessTypeId, categoryTypeId),
  )

  const rows = activeItems.map((item, idx) => {
    const itemName =
      item.stock_item_name || item.stock_item_reserved_name || `Item #${item.stock_item_id || idx + 1}`
    const subCategory = getPriceListSubCategory(item) || '—'

    // Same BT merge + landing math as the Item Price Margin page.
    const pricedItem = itemWithBusinessTypeSettings(item, businessTypeId)
    const bt = (item.business_types || []).find(
      (b) => String(b.business_type_id) === String(businessTypeId),
    )
    const cat = (bt?.categories || []).find(
      (c) => String(c.category_type_id) === String(categoryTypeId),
    )
    const categoryMargin = cat ? toNum(cat.margin_percent, 0) : 0

    let creditMargin = 0
    if (creditTypeId != null && creditTypeId !== '') {
      const creditRows = bt?.credit_types || item.credit_types || []
      const ctRow = creditRows.find(
        (ct) => String(ct.credit_type_id) === String(creditTypeId),
      )
      creditMargin = ctRow ? toNum(ctRow.margin_percent, 0) : 0
    }

    const landingPrice = computeLandingPrice(pricedItem)
    const pktPrice = computeCustomerPackPrice(pricedItem, categoryMargin, creditMargin)
    const firstPrice = computeCustomerUnitPrice(pricedItem, categoryMargin, creditMargin)
    const firstUnitLabel = pdfFirstColumnUnitLabel(pricedItem)
    const conversion = priceConversionFactor(pricedItem)

    return {
      slNo: String(idx + 1),
      subCategory,
      productName: itemName,
      basePrice: toNum(pricedItem?.base_price, 0),
      conversion,
      landingPrice,
      categoryMargin,
      creditMargin,
      // Price Master format: Unit = 1 decimal, Base/Pkt = whole ₹.
      kgPcPrice: firstPrice == null ? '-' : priceWithUnit(firstPrice, firstUnitLabel),
      pktBagPrice: priceWithUnit(pktPrice, pricedItem.base_unit_name, { wholeNumber: true }),
      kgPcPriceValue: firstPrice == null ? null : firstPrice,
      pktBagPriceValue: pktPrice,
    }
  })

  return { activeItems, rows }
}

/**
 * Build Price List autoTable body with consecutive Sub Category values merged
 * via rowSpan (one label for a run of the same sub category).
 */
export function buildPriceListPdfBodyWithMergedSubCategories(rows = []) {
  const body = []
  let index = 0
  while (index < rows.length) {
    const current = rows[index]
    const subKey = String(current.subCategory || '—').trim().toLowerCase()
    let span = 1
    while (index + span < rows.length) {
      const nextKey = String(rows[index + span].subCategory || '—').trim().toLowerCase()
      if (nextKey !== subKey) break
      span += 1
    }

    for (let offset = 0; offset < span; offset += 1) {
      const row = rows[index + offset]
      if (offset === 0) {
        body.push([
          row.slNo,
          {
            content: row.subCategory || '—',
            rowSpan: span,
            styles: {
              valign: 'middle',
              halign: 'left',
              fontStyle: 'bold',
            },
          },
          row.productName,
          row.kgPcPrice,
          row.pktBagPrice,
        ])
      } else {
        // Skip Sub Category cell — covered by the rowSpan above.
        body.push([
          row.slNo,
          row.productName,
          row.kgPcPrice,
          row.pktBagPrice,
        ])
      }
    }
    index += span
  }
  return body
}

function readCpOrgInfo() {
  try {
    const raw = localStorage.getItem('cp_org_info')
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function resolveOrgHeaderInfo(optionsOrgInfo = null) {
  if (optionsOrgInfo && typeof optionsOrgInfo === 'object') {
    const orgName =
      optionsOrgInfo.organizationName ||
      optionsOrgInfo.organization_name ||
      optionsOrgInfo.name ||
      optionsOrgInfo.organization ||
      ''
    const orgAddress =
      optionsOrgInfo.address ||
      optionsOrgInfo.organization_address ||
      optionsOrgInfo.full_address ||
      ''
    const gstin = optionsOrgInfo.gstin || optionsOrgInfo.gst_number || ''
    if (orgName || orgAddress) {
      return { organizationName: orgName || 'MWB Technologies India Pvt. Ltd.', address: orgAddress, gstin }
    }
  }

  // 1. Try reading saved org info from localStorage ('cp_org_info') or AuthService
  const saved = getSavedOrganizationInfo()
  let organizationName = saved?.organizationName || ''
  let address = saved?.address || ''
  let gstin = saved?.gstin || ''

  // Fallback to reading raw localStorage or userData if saved didn't have both
  if (!organizationName || !address) {
    const rawOrg = readCpOrgInfo()
    const userData = AuthService.getUserData() || {}
    const userInfo = userData?.user_info || userData || {}
    const org = userData?.organization || {}

    if (!organizationName) {
      organizationName =
        rawOrg.organization_name ||
        rawOrg.name ||
        rawOrg.organization ||
        org.organization_name ||
        org.name ||
        (typeof org === 'string' ? org : '') ||
        userInfo.organization_name ||
        userInfo.organization ||
        userData.organization_name ||
        userData.organization ||
        ''
    }

    if (!address) {
      address =
        rawOrg.organization_address ||
        rawOrg.address ||
        rawOrg.branch_address ||
        org.organization_address ||
        org.address ||
        [org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ') ||
        userInfo.organization_address ||
        userInfo.address ||
        [userInfo.address, userInfo.city, userInfo.state, userInfo.pincode].filter(Boolean).join(', ') ||
        ''
    }

    if (!gstin) {
      gstin =
        rawOrg.gst_number ||
        rawOrg.gst ||
        rawOrg.gstin ||
        org.gst_number ||
        org.gst ||
        org.gstin ||
        userInfo.gst_number ||
        ''
    }
  }

  // 2. If organizationName or address is still not found, fetch from dashboard API (user_info)
  if (!organizationName || !address) {
    try {
      const fetched = await fetchOrganizationInfo()
      if (fetched) {
        if (fetched.organizationName) organizationName = fetched.organizationName
        if (fetched.address) address = fetched.address
        if (fetched.gstin) gstin = fetched.gstin
      }
    } catch (err) {
      console.warn('Could not fetch organization info from dashboard API:', err)
    }
  }

  return {
    organizationName: organizationName || 'MWB Technologies India Pvt. Ltd.',
    address: address || '',
    gstin: gstin || '',
  }
}

/**
 * Builds and downloads the Price List PDF for one business type + category.
 * Optional customerName is shown in the header when exporting for a customer.
 *
 * Price List exports use portrait A4. Landing Prices matrix (many BT columns)
 * stays landscape A4 so the extra columns still fit.
 */
export async function generatePriceListPdf({
  items = [],
  soItems = null,
  businessTypes = null,
  businessTypeId,
  businessTypeName = '',
  categoryTypeId,
  categoryTypeName = '',
  creditTypeId = null,
  creditTypeName = '',
  customerName = '',
  filterDescription = '',
  orgInfo = null,
  branchDetail = null,
}) {
  const useSoItems = Array.isArray(soItems)
  // Prefer single BT + category rate when businessTypeId is provided.
  const useMatrix =
    !useSoItems &&
    Array.isArray(businessTypes) &&
    businessTypes.length > 0 &&
    (businessTypeId == null || businessTypeId === '')

  // Portrait A4 for the customer Price List; landscape only for wide BT matrix.
  const orientation = useMatrix ? 'landscape' : 'portrait'
  const pageW = useMatrix ? 297 : 210
  const pageH = useMatrix ? 210 : 297
  const contentW = pageW - MARGIN * 2

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  })

  const matrix = useMatrix
    ? buildLandingPricesMatrixRows(items, businessTypes)
    : null
  const listExport = useMatrix
    ? null
    : useSoItems
      ? buildPriceListExportRowsFromSoItems(soItems)
      : buildPriceListExportRows(items, businessTypeId, categoryTypeId, creditTypeId)

  const activeItems = useMatrix ? matrix.activeItems : listExport.activeItems
  const exportRows = useMatrix ? matrix.rows : listExport.rows
  const btColumns = useMatrix ? matrix.businessTypes : []

  const now = new Date()
  const generatedAt = format(now, 'dd-MM-yyyy hh:mm a')

  const { branch, logo } = await resolvePdfCompanyHeader({
    detail: orgInfo ? { organization: orgInfo } : {},
    branchDetail,
  })

  const infoRows = useMatrix
    ? [
        { label: 'Generated On', value: generatedAt },
        { label: 'Report', value: 'Landing Prices' },
        { label: 'Total Items', value: String(activeItems.length) },
      ]
    : [
        { label: 'Generated On', value: generatedAt },
        ...(customerName ? [{ label: 'Customer', value: customerName }] : []),
        { label: 'Business Type', value: businessTypeName || '-' },
        { label: 'Category', value: categoryTypeName || '-' },
        { label: 'Credit Type', value: creditTypeName || 'Cash' },
        { label: 'Total Items', value: String(activeItems.length) },
      ]

  let y = drawPdfCompanyHeader(doc, {
    startY: MARGIN,
    branch,
    headerLogo: logo,
    title: useMatrix ? 'LANDING PRICES' : 'PRICE LIST',
    marginX: MARGIN,
    contentW,
    includeLicenceNumbers: false,
    infoRows,
  })

  if (customerName && !useMatrix) {
    const greetingDate = format(now, 'dd-MM-yyyy')
    const greeting =
      'Hello Dear ' +
      customerName +
      ', Please find the updated price list of the stock items for ' +
      greetingDate +
      '.'
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    const wrappedGreeting = doc.splitTextToSize(greeting, contentW - 6)
    const greetHeight = wrappedGreeting.length * 3.6 + 4
    doc.setDrawColor(...COLORS.border)
    doc.setFillColor(239, 246, 255)
    doc.rect(MARGIN, y, contentW, greetHeight, 'FD')
    doc.setTextColor(...COLORS.primary)
    doc.text(wrappedGreeting, MARGIN + 3, y + 4.2)
    y += greetHeight + 1
  }

  if (filterDescription) {
    const noteLines = ['Active Filters: ' + filterDescription]
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    const wrappedNote = noteLines.flatMap((line) =>
      doc.splitTextToSize(line, contentW - 6),
    )
    const noteHeight = wrappedNote.length * 3.4 + 3.6

    doc.setDrawColor(...COLORS.border)
    doc.setFillColor(...COLORS.headerBg)
    doc.rect(MARGIN, y, contentW, noteHeight, 'FD')
    doc.setTextColor(...COLORS.muted)
    doc.text(wrappedNote, MARGIN + 3, y + 4)
    y += noteHeight
  }

  let head
  let tableRows
  let columnStyles
  const bodyFontSize = useMatrix ? 6.5 : 8
  const headFontSize = useMatrix ? 6.5 : 8

  if (useMatrix) {
    const btNames = btColumns.map(
      (bt) => String(bt.name || ('Business ' + bt.id)).toUpperCase(),
    )
    head = [['Sl No.', 'Stock Item', 'Base Price', 'Conversion', ...btNames]]
    tableRows = exportRows.map((row) => [
      row.slNo,
      row.productName,
      formatBasePriceDisplay(row.basePrice),
      String(row.conversion ?? ''),
      ...btColumns.map((bt) => {
        const btId = bt.id ?? bt.business_type_id
        const value = row.landingByBusinessType[String(btId)]
        return value == null ? '-' : formatEffectivePrice(value)
      }),
    ])
    const btCount = Math.max(btColumns.length, 1)
    const fixedW = 12 + 70 + 22 + 20
    const btColW = Math.max(22, Math.min(36, (contentW - fixedW) / btCount))
    columnStyles = {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 70 },
      2: { halign: 'center', cellWidth: 22, fontStyle: 'bold', textColor: COLORS.priceGreen },
      3: { halign: 'center', cellWidth: 20 },
    }
    btColumns.forEach((_, i) => {
      columnStyles[4 + i] = {
        halign: 'center',
        cellWidth: btColW,
        fontStyle: 'bold',
        textColor: COLORS.priceGreen,
      }
    })
  } else {
    head = [[
      'Sl No.',
      'Sub Category',
      'Product Name',
      'KG/PC Price',
      'Pkt/ Bag Price',
    ]]
    tableRows = buildPriceListPdfBodyWithMergedSubCategories(exportRows)
    // Portrait A4 content width (~186mm): keep columns within page bounds.
    const slW = 12
    const subW = 34
    const kgW = 34
    const pktW = 34
    const productW = Math.max(48, contentW - slW - subW - kgW - pktW)
    columnStyles = {
      0: { halign: 'center', cellWidth: slW, valign: 'middle' },
      1: { halign: 'left', cellWidth: subW, valign: 'middle' },
      2: { halign: 'left', cellWidth: productW, valign: 'middle' },
      3: {
        halign: 'center',
        cellWidth: kgW,
        fontStyle: 'bold',
        textColor: COLORS.priceGreen,
        valign: 'middle',
      },
      4: {
        halign: 'center',
        cellWidth: pktW,
        fontStyle: 'bold',
        textColor: COLORS.priceGreen,
        valign: 'middle',
      },
    }
  }

  const emptyRow = useMatrix
    ? [['-', 'No active items found', '-', '-', ...btColumns.map(() => '-')]]
    : [['-', '-', 'No active items found', '-', '-']]

  autoTable(doc, {
    startY: y + 4,
    margin: { left: MARGIN, right: MARGIN, bottom: 14 },
    tableWidth: contentW,
    head,
    body: tableRows.length > 0 ? tableRows : emptyRow,
    theme: 'grid',
    styles: {
      fontSize: bodyFontSize,
      cellPadding: useMatrix ? 1.4 : 2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: headFontSize,
      cellPadding: useMatrix ? 1.6 : 2.2,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: bodyFontSize,
      cellPadding: useMatrix ? 1.4 : 2,
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.15,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
  })

  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.15)
    doc.line(MARGIN, pageH - 10, pageW - MARGIN, pageH - 10)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text(
      'MWB ERP - A Premium Product by MWB Technologies India Pvt. Ltd.',
      pageW / 2,
      pageH - 6.8,
      { align: 'center' },
    )
    doc.text('Page ' + i + ' of ' + totalPages, pageW / 2, pageH - 3.4, { align: 'center' })
  }

  const cleanBt = String(businessTypeName || (useMatrix ? 'Landing_Prices' : 'All')).replace(
    /[^a-zA-Z0-9_-]/g,
    '_',
  )
  const cleanCat = String(categoryTypeName || (useMatrix ? 'All' : 'Category')).replace(
    /[^a-zA-Z0-9_-]/g,
    '_',
  )
  const cleanCustomer = String(customerName || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40)
  const dateSuffix = format(new Date(), 'yyyyMMdd_HHmm')
  const fileName = useMatrix
    ? 'Landing_Prices_' + dateSuffix + '.pdf'
    : cleanCustomer
      ? 'Price_List_' + cleanCustomer + '_' + cleanBt + '_' + cleanCat + '_' + dateSuffix + '.pdf'
      : 'Price_List_' + cleanBt + '_' + cleanCat + '_' + dateSuffix + '.pdf'

  doc.save(fileName)
  return { fileName, count: activeItems.length }
}
