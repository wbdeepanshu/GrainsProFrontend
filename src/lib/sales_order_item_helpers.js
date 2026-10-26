export function emptySalesOrderLine() {
  return {
    item_id: '',
    item_name: '',
    quantity: 1,
    price: 0,
    comment: '',
    base_unit_id: null,
    price_uom_id: null,
    conversion: 1,
    base_unit_price: 0,
    alternate_unit_price: 0,
    base_unit_price_for_calc: 0,
    gst_percentage: 0,
    is_free_gift: false,
    gift_offer_id: null,
  }
}

function normalizedUnitName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/**
 * 1-decimal bump rule: if 2nd decimal digit > 0, bump 1st decimal by 1.
 * Example: 145.23 → 145.3 (conversion-wise / piece / alternate)
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

/**
 * Main / shared base price: ceil any fractional part to a whole number.
 * Example: 101.12 → 102
 */
export function ceilBaseUnitPrice(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return 0
  if (n >= 0) return Math.ceil(n - Number.EPSILON)
  return -Math.floor(Math.abs(n) - Number.EPSILON)
}

function unitMatches(unitOfMeasurement, unit) {
  if (!unitOfMeasurement || !unit) return false
  if (
    unitOfMeasurement.id != null &&
    unit.id != null &&
    String(unitOfMeasurement.id) === String(unit.id)
  ) {
    return true
  }
  const configuredName = normalizedUnitName(unitOfMeasurement.name)
  const unitName = normalizedUnitName(unit.name)
  return Boolean(configuredName && unitName && configuredName === unitName)
}

function isStockItemPriceConfiguredInAlternate(stockItem) {
  if (!stockItem?.alternate_unit) return false
  return unitMatches(stockItem.unit_of_measurement, stockItem.alternate_unit)
}

export function applyStockItemToLine(stockItem) {
  if (!stockItem) return emptySalesOrderLine()

  const conversion = parseFloat(stockItem.conversion || 1) || 1
  const baseUnitId = stockItem.base_unit?.id ?? null
  const alternateUnitId = stockItem.alternate_unit?.id ?? null
  // Pack (base unit) price is ceiled; piece/alternate stay 1-decimal.
  const basePrice = ceilBaseUnitPrice(stockItem.base_unit?.price || 0)
  const altPrice = roundPriceOneDecimal(stockItem.alternate_unit?.price || 0)
  const useAlternatePrice =
    Boolean(alternateUnitId) && isStockItemPriceConfiguredInAlternate(stockItem)
  const priceUomId = useAlternatePrice ? alternateUnitId : baseUnitId
  const displayPrice = useAlternatePrice ? altPrice : basePrice
  const basePriceForCalc = useAlternatePrice
    ? roundPriceOneDecimal(altPrice * conversion)
    : basePrice

  return clampLinePriceToRateLimits(
    {
      item_id: String(stockItem.id),
      item_name: stockItem.name || '',
      quantity: 1,
      price: displayPrice,
      comment: '',
      base_unit_id: baseUnitId,
      price_uom_id: priceUomId,
      conversion,
      base_unit_price: basePrice,
      alternate_unit_price: altPrice,
      base_unit_price_for_calc: basePriceForCalc,
      gst_percentage: parseFloat(stockItem.gst_rate || 0),
      is_free_gift: false,
      gift_offer_id: null,
    },
    stockItem,
  )
}

/** Best matching quantity-price tier for order qty (highest min_quantity <= qty). */
export function resolveQuantityPriceTier(stockItem, quantity, categoryId = null) {
  const tiers = Array.isArray(stockItem?.quantity_price_tiers)
    ? stockItem.quantity_price_tiers
    : []
  if (!tiers.length) return null
  const qty = parseFloat(quantity)
  if (!Number.isFinite(qty) || qty <= 0) return null

  const qtyMatches = tiers.filter(
    (tier) => Number.isFinite(parseFloat(tier?.min_quantity)) && qty >= parseFloat(tier.min_quantity),
  )
  if (!qtyMatches.length) return null

  const sortByQtyDesc = (a, b) => parseFloat(b.min_quantity) - parseFloat(a.min_quantity)
  const rawCategoryId = categoryId ?? stockItem?.customer_category_id ?? null
  const normalizedCategoryId =
    rawCategoryId != null && String(rawCategoryId).trim() !== '' ? String(rawCategoryId) : null

  if (normalizedCategoryId) {
    const specific = qtyMatches
      .filter((tier) => tier?.category_id != null && String(tier.category_id) === normalizedCategoryId)
      .sort(sortByQtyDesc)
    if (specific[0]) return specific[0]
  }

  const general = qtyMatches
    .filter((tier) => tier?.category_id == null || String(tier.category_id).trim() === '')
    .sort(sortByQtyDesc)

  return general[0] || null
}

/** Margin or tier dual-unit prices for the given order quantity. */
export function getEffectiveUnitPricesForQuantity(stockItem, quantity, categoryId = null) {
  if (!stockItem) {
    return { base: 0, alt: 0 }
  }

  const tier = resolveQuantityPriceTier(stockItem, quantity, categoryId)
  if (tier) {
    const base = parseFloat(tier.base_unit?.price ?? tier.unit_price ?? 0) || 0
    const alt = parseFloat(
      tier.alternate_unit?.price ??
        (stockItem.conversion
          ? base / (parseFloat(stockItem.conversion) || 1)
          : 0),
    )
    return {
      base: parseFloat(base.toFixed(2)),
      alt: parseFloat((Number.isFinite(alt) ? alt : 0).toFixed(2)),
    }
  }

  const marginBase = parseFloat(
    stockItem.margin_base_unit_price ?? stockItem.base_unit?.price ?? 0,
  )
  const marginAlt = parseFloat(
    stockItem.margin_alternate_unit_price ?? stockItem.alternate_unit?.price ?? 0,
  )
  return {
    base: parseFloat((Number.isFinite(marginBase) ? marginBase : 0).toFixed(2)),
    alt: parseFloat((Number.isFinite(marginAlt) ? marginAlt : 0).toFixed(2)),
  }
}

/**
 * Recompute line rate from quantity-price tiers (or margin prices) while keeping
 * the selected UOM, quantity, and remarks.
 */
export function applyQuantityPriceVariationToLine(line, stockItem, quantity, categoryId = null) {
  if (!stockItem) {
    return { ...line, quantity }
  }

  const prices = getEffectiveUnitPricesForQuantity(stockItem, quantity, categoryId)
  const pricedItem = {
    ...stockItem,
    base_unit: stockItem.base_unit
      ? { ...stockItem.base_unit, price: prices.base }
      : stockItem.base_unit,
    alternate_unit: stockItem.alternate_unit
      ? { ...stockItem.alternate_unit, price: prices.alt }
      : stockItem.alternate_unit,
  }

  const next = applyPriceUomToLine(
    { ...line, quantity },
    pricedItem,
    line.price_uom_id || pricedItem.base_unit?.id,
  )
  return {
    ...next,
    quantity,
    base_unit_price: prices.base,
    alternate_unit_price: prices.alt,
  }
}

export function applyPriceUomToLine(line, stockItem, priceUomId) {
  if (!stockItem) return { ...line, price_uom_id: priceUomId }

  const baseUnitId = stockItem.base_unit?.id
  const alternateUnitId = stockItem.alternate_unit?.id
  const conversion = parseFloat(line.conversion || stockItem.conversion || 1) || 1
  const next = { ...line, price_uom_id: priceUomId }

  if (String(priceUomId) === String(baseUnitId)) {
    const baseUnitPrice = parseFloat(stockItem.base_unit?.price || 0)
    if (baseUnitPrice > 0) {
      next.price = parseFloat(baseUnitPrice.toFixed(2))
      next.base_unit_price_for_calc = parseFloat(baseUnitPrice.toFixed(2))
    } else {
      const currentBasePrice = parseFloat(line.base_unit_price_for_calc || line.price || 0)
      next.price = parseFloat(currentBasePrice.toFixed(2))
      next.base_unit_price_for_calc = parseFloat(currentBasePrice.toFixed(2))
    }
  } else if (String(priceUomId) === String(alternateUnitId)) {
    const alternateUnitPrice = parseFloat(stockItem.alternate_unit?.price || 0)
    if (alternateUnitPrice > 0) {
      next.price = parseFloat(alternateUnitPrice.toFixed(2))
      next.base_unit_price_for_calc = parseFloat((alternateUnitPrice * conversion).toFixed(2))
    } else {
      const currentBasePrice = parseFloat(line.base_unit_price_for_calc || line.price || 0)
      next.price =
        conversion > 0
          ? parseFloat((currentBasePrice / conversion).toFixed(2))
          : parseFloat(currentBasePrice.toFixed(2))
      next.base_unit_price_for_calc = parseFloat(currentBasePrice.toFixed(2))
    }
  } else {
    const currentBasePrice = parseFloat(line.base_unit_price_for_calc || line.price || 0)
    next.price = parseFloat(currentBasePrice.toFixed(2))
    next.base_unit_price_for_calc = parseFloat(currentBasePrice.toFixed(2))
  }

  return clampLinePriceToRateLimits(next, stockItem)
}

/**
 * Switch price UOM while keeping the line's entered base rate.
 * Used when the user already typed a rate — only the display amount changes.
 */
export function convertLinePriceUomPreservingRate(line, stockItem, priceUomId) {
  if (!stockItem) return { ...line, price_uom_id: priceUomId }

  const conversion = parseFloat(line.conversion || stockItem.conversion || 1) || 1
  const alternateUnitId = stockItem.alternate_unit?.id
  const base = parseFloat(line.base_unit_price_for_calc ?? line.price) || 0
  let displayPrice = base
  if (String(priceUomId) === String(alternateUnitId) && conversion > 0) {
    displayPrice = parseFloat((base / conversion).toFixed(2))
  } else {
    displayPrice = parseFloat(base.toFixed(2))
  }

  return {
    ...line,
    price_uom_id: priceUomId,
    price: displayPrice,
    base_unit_price_for_calc: parseFloat(base.toFixed(2)),
  }
}

export function getLineBaseRateFromPriceInput(line, stockItem, rawPrice) {
  const price = parseFloat(parseFloat(rawPrice || 0).toFixed(2))
  if (!stockItem) return price

  const baseUnitId = stockItem.base_unit?.id
  const alternateUnitId = stockItem.alternate_unit?.id
  const conversion = parseFloat(line.conversion || stockItem.conversion || 1) || 1
  const priceUomId = line.price_uom_id

  if (String(priceUomId) === String(alternateUnitId)) {
    return parseFloat((price * conversion).toFixed(2))
  }

  return price
}

export function getMaxRateClampAlertMessage(stockItem, line) {
  const maxRate = line
    ? getLineEffectiveMaxBaseRate(line, stockItem)
    : getStockItemMaxRate(stockItem)
  if (maxRate == null) return null
  const displayLimit = line
    ? getLineRateLimitsForDisplay(line, stockItem).maxRate
    : maxRate
  const limitText = (displayLimit ?? maxRate).toFixed(2)
  return `Entered rate exceeds maximum allowed rate of ${limitText}. Rate has been set to ${limitText}.`
}

export function getBaseRateClampAlertMessage(stockItem, line) {
  const baseRate = line
    ? getLineEffectiveMinBaseRate(line, stockItem)
    : getStockItemBaseRate(stockItem)
  if (baseRate == null) return null
  const displayLimit = line
    ? getLineRateLimitsForDisplay(line, stockItem).minRate
    : baseRate
  const limitText = (displayLimit ?? baseRate).toFixed(2)
  return `Entered rate is below the minimum allowed rate of ${limitText}. Rate has been set to ${limitText}.`
}

export function applyLinePriceChange(line, stockItem, rawPrice, options = {}) {
  const { clampRates = true } = options
  const price = parseFloat(parseFloat(rawPrice || 0).toFixed(2))
  if (!stockItem) return { ...line, price }

  const baseUnitId = stockItem.base_unit?.id
  const alternateUnitId = stockItem.alternate_unit?.id
  const conversion = parseFloat(line.conversion || stockItem.conversion || 1) || 1
  const priceUomId = line.price_uom_id

  let next
  if (String(priceUomId) === String(alternateUnitId)) {
    next = {
      ...line,
      price,
      base_unit_price_for_calc: parseFloat((price * conversion).toFixed(2)),
    }
  } else if (String(priceUomId) === String(baseUnitId)) {
    next = {
      ...line,
      price,
      base_unit_price_for_calc: price,
    }
  } else {
    next = {
      ...line,
      price,
      base_unit_price_for_calc: price,
    }
  }

  return clampRates ? clampLinePriceToRateLimits(next, stockItem) : next
}

export function getStockItemBaseRate(stockItem) {
  if (!stockItem) return null
  const raw =
    stockItem.base_unit?.price ??
    stockItem.stock_item?.base_unit?.price ??
    stockItem.base_price ??
    stockItem.stock_item?.base_price
  const parsed = parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function getStockItemMaxRate(stockItem) {
  if (!stockItem) return null
  const raw = stockItem.max_rate ?? stockItem.stock_item?.max_rate
  if (raw == null || raw === '') return null
  const parsed = parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  const configuredBasePrice = parseFloat(
    stockItem.base_price ?? stockItem.stock_item?.base_price,
  )
  // When max_rate is unset, API may echo base_price — treat that as no upper cap.
  if (Number.isFinite(configuredBasePrice) && parsed <= configuredBasePrice) return null

  const pricingStockItem = stockItem.stock_item || stockItem
  if (isStockItemPriceConfiguredInAlternate(pricingStockItem)) {
    const conversion = parseFloat(pricingStockItem.conversion || 1) || 1
    return parseFloat((parsed * conversion).toFixed(2))
  }
  return parsed
}

function formatRateDisplay(value) {
  const parsed = parseFloat(value)
  if (!Number.isFinite(parsed)) return null
  return parsed.toFixed(2)
}

/**
 * Small-text pricing meta shown under the selected item name.
 * Format: "100.00 / Pcs", "100.00 / bag", "500.00 / qtl"
 * When quantity is provided, uses the matching quantity-price slab.
 */
function resolveMinimumUnitName(stockItem) {
  const minimumUnit = stockItem?.minimum_unit || stockItem?.stock_item?.minimum_unit
  const fallbackName = stockItem?.display_rates?.find(
    (rate) => rate?.type === 'unit_price',
  )?.unit
  return (minimumUnit?.name || fallbackName || 'piece').trim() || 'piece'
}

export function getStockItemPriceMetaForDisplay(stockItem, quantity, categoryId = null) {
  if (!stockItem) return []

  const parts = []
  const baseUnit = stockItem.base_unit || stockItem.stock_item?.base_unit
  const alternateUnit = stockItem.alternate_unit || stockItem.stock_item?.alternate_unit
  const minimumUnitName = resolveMinimumUnitName(stockItem)

  const catalogUnitPrice = parseFloat(
    stockItem.unit_price ?? stockItem.stock_item?.unit_price,
  )
  const catalogBasePrice = parseFloat(baseUnit?.price ?? stockItem.base_price)
  let unitPriceValue = catalogUnitPrice
  let baseUnitPriceValue = catalogBasePrice
  let altUnitPriceValue = parseFloat(alternateUnit?.price)

  const qty = parseFloat(quantity)
  const tier =
    Number.isFinite(qty) && qty > 0
      ? resolveQuantityPriceTier(stockItem, qty, categoryId)
      : null

  if (tier) {
    const prices = getEffectiveUnitPricesForQuantity(stockItem, qty, categoryId)
    if (prices.base > 0) baseUnitPriceValue = prices.base
    if (prices.alt > 0) altUnitPriceValue = prices.alt

    const tierUnitPrice = parseFloat(tier.unit_price)
    const tierBasePrice = parseFloat(tier.base_unit?.price)
    const unitPriceIsPiece =
      Number.isFinite(tierUnitPrice) &&
      Number.isFinite(tierBasePrice) &&
      Math.abs(tierUnitPrice - tierBasePrice) > 0.001

    if (unitPriceIsPiece) {
      unitPriceValue = tierUnitPrice
    } else if (
      Number.isFinite(catalogUnitPrice) &&
      Number.isFinite(catalogBasePrice) &&
      catalogBasePrice > 0 &&
      Number.isFinite(baseUnitPriceValue)
    ) {
      unitPriceValue = catalogUnitPrice * (baseUnitPriceValue / catalogBasePrice)
    }
  }

  const unitPrice = formatRateDisplay(unitPriceValue)
  if (unitPrice != null) {
    parts.push({ text: `${unitPrice} / ${minimumUnitName}` })
  }

  const baseUnitPrice = formatRateDisplay(baseUnitPriceValue)
  if (baseUnitPrice != null) {
    const baseName = (baseUnit?.name || 'base').trim() || 'base'
    parts.push({ text: `${baseUnitPrice} / ${baseName}` })
  }

  if (alternateUnit?.id || alternateUnit?.name) {
    const altPrice = formatRateDisplay(altUnitPriceValue)
    if (altPrice != null) {
      const altName = (alternateUnit?.name || 'alt').trim() || 'alt'
      parts.push({ text: `${altPrice} / ${altName}` })
    }
  }

  return parts
}

/**
 * Base-unit and alternate-unit rates shown under an item in Sales Order Details,
 * derived from the rate stored on the order line instead of today's catalog/margin
 * price, so an old order keeps showing the rates it was placed with.
 * `displayRate` is in the line rate_per_unit UOM.
 */
export function getSalesOrderItemPriceMetaForDisplay(item, stockItem, displayRate) {
  if (!item) return []

  const baseUnit = item.base_unit || stockItem?.base_unit || item.stock_item?.base_unit
  const alternateUnit =
    item.alternate_unit || stockItem?.alternate_unit || item.stock_item?.alternate_unit
  const conversion =
    parseFloat(item.stock_item?.conversion ?? stockItem?.conversion ?? item.conversion ?? 1) || 1

  const rateInLineUom =
    displayRate === undefined || displayRate === null || displayRate === ''
      ? getSalesOrderItemDisplayRate(item)
      : displayRate
  const orderedBaseRate = toSalesOrderItemBaseRate(item, rateInLineUom)
  if (!Number.isFinite(orderedBaseRate) || orderedBaseRate <= 0) return []

  // Derive from the line rate so an edited rate stays consistent across both units.
  const apiAlternateRate = parseFloat(item.alternate_rate)
  const orderedAlternateRate =
    conversion > 0
      ? orderedBaseRate / conversion
      : Number.isFinite(apiAlternateRate) && apiAlternateRate > 0
        ? apiAlternateRate
        : null

  const parts = []

  const baseUnitPrice = formatRateDisplay(orderedBaseRate)
  if (baseUnitPrice != null) {
    const baseName = (baseUnit?.name || 'base').trim() || 'base'
    parts.push({ text: `${baseUnitPrice} / ${baseName}` })
  }

  if (alternateUnit?.id || alternateUnit?.name) {
    const altPrice = formatRateDisplay(orderedAlternateRate)
    if (altPrice != null) {
      const altName = (alternateUnit?.name || 'alt').trim() || 'alt'
      parts.push({ text: `${altPrice} / ${altName}` })
    }
  }

  return parts
}

/** Rows for quantity-price variation tooltip (Create Sales Order item info button). */
export function getQuantityPriceVariationRows(stockItem) {
  const tiers = Array.isArray(stockItem?.quantity_price_tiers)
    ? stockItem.quantity_price_tiers
    : []
  if (!tiers.length) return []

  const baseUnitName = (
    stockItem.base_unit?.name ||
    stockItem.stock_item?.base_unit?.name ||
    ''
  ).trim()
  const altUnitName = (
    stockItem.alternate_unit?.name ||
    stockItem.stock_item?.alternate_unit?.name ||
    ''
  ).trim()

  return [...tiers]
    .filter((tier) => tier?.min_quantity != null)
    .sort((a, b) => {
      const qtyDiff = parseFloat(a.min_quantity) - parseFloat(b.min_quantity)
      if (qtyDiff !== 0) return qtyDiff
      return String(a.category_name || '').localeCompare(String(b.category_name || ''))
    })
    .map((tier) => {
      const basePriceRaw = tier.base_unit?.price ?? tier.unit_price
      const altPriceRaw = tier.alternate_unit?.price
      const basePrice = parseFloat(basePriceRaw)
      const altPrice = parseFloat(altPriceRaw)
      return {
        minQuantity: parseFloat(tier.min_quantity),
        categoryName: tier.category_name || (tier.category_id != null ? `Category #${tier.category_id}` : 'All'),
        categoryId: tier.category_id ?? null,
        basePrice: Number.isFinite(basePrice) ? basePrice : null,
        altPrice: Number.isFinite(altPrice) ? altPrice : null,
        baseUnitName,
        altUnitName,
      }
    })
}

function convertBaseRateToPriceUom(baseRate, line, stockItem) {
  if (baseRate == null) return null

  const alternateUnitId = stockItem.alternate_unit?.id
  const conversion = parseFloat(line.conversion || stockItem.conversion || 1) || 1
  const priceUomId = line.price_uom_id

  if (String(priceUomId) === String(alternateUnitId) && conversion > 0) {
    return parseFloat((baseRate / conversion).toFixed(2))
  }

  return parseFloat(baseRate.toFixed(2))
}

/**
 * Catalog / margin base rate in base-unit terms (ignores quantity tiers).
 */
export function getStockItemMarginBaseRate(stockItem) {
  if (!stockItem) return null
  const raw =
    stockItem.margin_base_unit_price ??
    stockItem.base_unit?.price ??
    stockItem.stock_item?.base_unit?.price ??
    stockItem.base_price ??
    stockItem.stock_item?.base_price
  const parsed = parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  // Match Create SO pack/base pricing (ceil fractional pack rates).
  return ceilBaseUnitPrice(parsed)
}

/**
 * Minimum allowed rate in base-unit terms for this line quantity.
 * Uses quantity-price variation when a tier matches; otherwise margin/base price.
 */
export function getLineEffectiveMinBaseRate(line, stockItem) {
  if (!stockItem) return null

  const tier = resolveQuantityPriceTier(stockItem, line?.quantity)
  if (tier) {
    const tierBase = parseFloat(tier.base_unit?.price ?? tier.unit_price ?? 0)
    if (Number.isFinite(tierBase) && tierBase > 0) {
      // unit_price alone may be in alternate UOM; prefer dual-unit base_unit.price.
      if (tier.base_unit?.price != null) {
        return ceilBaseUnitPrice(tierBase)
      }
      if (isStockItemPriceConfiguredInAlternate(stockItem.stock_item || stockItem)) {
        const conversion = parseFloat(stockItem.conversion || 1) || 1
        return roundPriceOneDecimal(tierBase * conversion)
      }
      return ceilBaseUnitPrice(tierBase)
    }
  }

  return (
    getStockItemMarginBaseRate(stockItem) ??
    (() => {
      const base = getStockItemBaseRate(stockItem)
      return base != null ? ceilBaseUnitPrice(base) : null
    })()
  )
}

/**
 * Maximum allowed rate in base-unit terms for this line quantity.
 * Keeps configured max_rate as the ceiling, scaled when the active variation
 * differs from the margin/base price so the allowed band tracks the tier.
 */
export function getLineEffectiveMaxBaseRate(line, stockItem) {
  if (!stockItem) return null

  const maxRate = getStockItemMaxRate(stockItem)
  if (maxRate == null) return null

  const marginBase = getStockItemMarginBaseRate(stockItem)
  const effectiveMin = getLineEffectiveMinBaseRate(line, stockItem)
  const tier = resolveQuantityPriceTier(stockItem, line?.quantity)

  if (
    tier &&
    marginBase != null &&
    marginBase > 0 &&
    effectiveMin != null &&
    Math.abs(effectiveMin - marginBase) >= 0.005
  ) {
    return parseFloat(((maxRate * effectiveMin) / marginBase).toFixed(2))
  }

  return maxRate
}

export function getLineRateLimitsForDisplay(line, stockItem) {
  if (!stockItem) return { minRate: null, maxRate: null }

  let minBase = getLineEffectiveMinBaseRate(line, stockItem)
  let maxBase = getLineEffectiveMaxBaseRate(line, stockItem)

  // If a high variation pushes min above max, collapse to a single allowed rate.
  if (minBase != null && maxBase != null && minBase > maxBase) {
    maxBase = minBase
  }

  let minRate = convertBaseRateToPriceUom(minBase, line, stockItem)
  let maxRate = convertBaseRateToPriceUom(maxBase, line, stockItem)

  const alternateUnitId = stockItem.alternate_unit?.id
  const priceInAlternate =
    alternateUnitId != null && String(line?.price_uom_id) === String(alternateUnitId)

  // Same display rounding as Create SO (pack/base → whole number, alt → 1 decimal).
  if (minRate != null) {
    minRate = priceInAlternate ? roundPriceOneDecimal(minRate) : ceilBaseUnitPrice(minRate)
  }
  if (maxRate != null) {
    maxRate = roundPriceOneDecimal(maxRate)
  }

  return { minRate, maxRate }
}

/**
 * Build stock/line shapes for rate validation from a sales-order detail item.
 * Display price is the rate shown/edited for the item's rate_per_unit UOM.
 * Prefer the live margin pricing payload so min/max match Create Sales Order.
 */
export function buildDetailItemRateContext(
  item,
  displayPrice,
  pricingOverride = null,
  options = {},
) {
  if (!item) return { stockItem: null, line: null }

  const stock = item.stock_item || {}
  const pricing =
    pricingOverride && typeof pricingOverride === 'object' ? pricingOverride : {}
  const quantityRaw =
    options.quantity ?? item.approved_quantity ?? item.quantity ?? 1
  const quantity = parseFloat(quantityRaw)
  const baseUnitSource =
    pricing.base_unit || item.base_unit || stock.base_unit || null
  const alternateUnitSource =
    pricing.alternate_unit || item.alternate_unit || stock.alternate_unit || null
  const conversion =
    parseFloat(
      pricing.conversion ?? stock.conversion ?? item.conversion ?? 1,
    ) || 1
  const ratePerUnit = String(item.rate_per_unit || '').trim().toLowerCase()

  const rawBasePrice = parseFloat(
    baseUnitSource?.price ??
      pricing.base_price ??
      stock.base_price ??
      item.base_price,
  )
  const rawAltPrice = parseFloat(alternateUnitSource?.price)
  const rawMaxRate = parseFloat(
    pricing.max_rate ?? stock.max_rate ?? item.max_rate,
  )
  const rawUnitPrice = parseFloat(
    pricing.unit_price ?? stock.unit_price ?? item.unit_price,
  )

  const baseUnit = baseUnitSource
    ? {
        id: baseUnitSource.id,
        name: baseUnitSource.name,
        price: Number.isFinite(rawBasePrice)
          ? ceilBaseUnitPrice(rawBasePrice)
          : baseUnitSource.price,
      }
    : null
  const alternateUnit = alternateUnitSource
    ? {
        id: alternateUnitSource.id,
        name: alternateUnitSource.name,
        price: Number.isFinite(rawAltPrice)
          ? roundPriceOneDecimal(rawAltPrice)
          : alternateUnitSource.price,
      }
    : null

  let priceUomId = baseUnit?.id ?? null
  const altName = String(alternateUnit?.name || '').trim().toLowerCase()
  const baseName = String(baseUnit?.name || '').trim().toLowerCase()
  if (ratePerUnit && altName && ratePerUnit === altName) {
    priceUomId = alternateUnit.id
  } else if (ratePerUnit && baseName && ratePerUnit === baseName) {
    priceUomId = baseUnit.id
  }

  const stockItem = {
    ...stock,
    ...pricing,
    id: item.stock_item_id || pricing.id || stock.id,
    name: item.item_name || pricing.name || stock.name || '',
    base_price: Number.isFinite(rawBasePrice)
      ? ceilBaseUnitPrice(rawBasePrice)
      : pricing.base_price ?? stock.base_price ?? item.base_price ?? null,
    max_rate:
      Number.isFinite(rawMaxRate) && rawMaxRate > 0
        ? roundPriceOneDecimal(rawMaxRate)
        : pricing.max_rate ?? stock.max_rate ?? item.max_rate ?? null,
    unit_price: Number.isFinite(rawUnitPrice)
      ? roundPriceOneDecimal(rawUnitPrice)
      : pricing.unit_price ?? stock.unit_price ?? item.unit_price ?? null,
    conversion,
    base_unit: baseUnit,
    alternate_unit: alternateUnit,
    unit_of_measurement:
      pricing.unit_of_measurement ||
      stock.unit_of_measurement ||
      item.unit_of_measurement ||
      null,
    quantity_price_tiers:
      pricing.quantity_price_tiers ||
      stock.quantity_price_tiers ||
      item.quantity_price_tiers ||
      [],
    margin_base_unit_price:
      pricing.margin_base_unit_price ?? stock.margin_base_unit_price ?? null,
    customer_category_id:
      pricing.customer_category_id ?? stock.customer_category_id ?? null,
  }

  const line = {
    item_name: item.item_name || stock.name || '',
    price: displayPrice,
    price_uom_id: priceUomId,
    conversion,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  }

  return { stockItem, line }
}

export function getLinePriceViolation(line, stockItem) {
  if (!stockItem || line?.price === '' || line?.price == null) return null

  const enteredBase = getLineBaseRateFromPriceInput(line, stockItem, line.price)
  const baseRate = getLineEffectiveMinBaseRate(line, stockItem)
  const maxRate = getLineEffectiveMaxBaseRate(line, stockItem)
  const effectiveMax =
    baseRate != null && maxRate != null && baseRate > maxRate ? baseRate : maxRate

  if (baseRate != null && enteredBase < baseRate) return 'below_min'
  if (effectiveMax != null && enteredBase > effectiveMax) return 'above_max'
  return null
}

export function getLinePriceViolationMessage(line, stockItem) {
  const violation = getLinePriceViolation(line, stockItem)
  if (!violation) return null

  const limits = getLineRateLimitsForDisplay(line, stockItem)
  const itemName = line.item_name || stockItem?.name || 'Item'

  if (violation === 'below_min') {
    const minText = limits.minRate != null ? limits.minRate.toFixed(2) : 'the base rate'
    return `${itemName}: price is below the minimum rate of ${minText}.`
  }

  const maxText = limits.maxRate != null ? limits.maxRate.toFixed(2) : 'the maximum rate'
  return `${itemName}: price exceeds the maximum rate of ${maxText}.`
}

function applyClampedBaseRateToLine(line, stockItem, clampedBase) {
  const alternateUnitId = stockItem.alternate_unit?.id
  const conversion = parseFloat(line.conversion || stockItem.conversion || 1) || 1
  const priceUomId = line.price_uom_id

  if (String(priceUomId) === String(alternateUnitId)) {
    const displayPrice =
      conversion > 0 ? parseFloat((clampedBase / conversion).toFixed(2)) : clampedBase
    return {
      ...line,
      price: displayPrice,
      base_unit_price_for_calc: clampedBase,
    }
  }

  return {
    ...line,
    price: clampedBase,
    base_unit_price_for_calc: clampedBase,
  }
}

/** Clamp to quantity-aware min rate and max_rate (scaled when variation differs). */
export function clampLinePriceToRateLimits(line, stockItem) {
  if (!stockItem) return line

  let next = line
  let basePriceForCalc = parseFloat(next.base_unit_price_for_calc ?? next.price) || 0

  const minRate = getLineEffectiveMinBaseRate(next, stockItem)
  if (minRate != null && basePriceForCalc < minRate) {
    next = applyClampedBaseRateToLine(next, stockItem, parseFloat(minRate.toFixed(2)))
    basePriceForCalc = parseFloat(next.base_unit_price_for_calc ?? next.price) || 0
  }

  let maxRate = getLineEffectiveMaxBaseRate(next, stockItem)
  if (minRate != null && maxRate != null && minRate > maxRate) {
    maxRate = minRate
  }
  if (maxRate != null && basePriceForCalc > maxRate) {
    next = applyClampedBaseRateToLine(next, stockItem, parseFloat(maxRate.toFixed(2)))
  }

  return next
}

/** @deprecated Prefer clampLinePriceToRateLimits */
export function clampLinePriceToMaxRate(line, stockItem) {
  return clampLinePriceToRateLimits(line, stockItem)
}

export function calcLineItemTotal(line) {
  const qty = parseFloat(line.quantity) || 0
  const rate = parseFloat(line.base_unit_price_for_calc ?? line.price) || 0
  return qty * rate
}

function normalizeUnitName(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

/**
 * Whether the stored SO line rate is denominated in the alternate UOM.
 * Stored `rate`/`price` is always the base-unit amount; `rate_per_unit` names the display UOM.
 */
export function isSalesOrderItemRateInAlternate(item) {
  if (!item) return false
  const ratePerUnit = normalizeUnitName(item.rate_per_unit)
  const baseName = normalizeUnitName(
    item.base_unit?.name || item.stock_item?.base_unit?.name,
  )
  const altName = normalizeUnitName(
    item.alternate_unit?.name ||
      item.stock_item?.alternate_unit?.name ||
      item.stock_item?.alternate_units?.name,
  )

  if (ratePerUnit && altName && ratePerUnit === altName) return true
  if (ratePerUnit && baseName && ratePerUnit === baseName) return false

  const primary = item.is_primary_unit
  if (primary === false || primary === 'false' || primary === 0 || primary === '0') {
    return Boolean(altName)
  }
  return false
}

/** Rate shown in the line's rate_per_unit UOM (alternate_rate when priced in alternate). */
export function getSalesOrderItemDisplayRate(item) {
  if (!item) return 0
  const storedRate = parseFloat(item.rate ?? item.price ?? 0) || 0
  if (!isSalesOrderItemRateInAlternate(item)) return storedRate

  const fromApi = parseFloat(item.alternate_rate)
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi

  const conversion =
    parseFloat(item.stock_item?.conversion ?? item.conversion ?? 1) || 1
  if (conversion > 0) {
    return parseFloat((storedRate / conversion).toFixed(2))
  }
  return storedRate
}

/** Convert a UI display rate (in rate_per_unit UOM) back to stored base-unit rate. */
export function toSalesOrderItemBaseRate(item, displayRate) {
  const rate = parseFloat(displayRate)
  if (!Number.isFinite(rate)) return 0
  if (!isSalesOrderItemRateInAlternate(item)) {
    return parseFloat(rate.toFixed(2))
  }
  const conversion =
    parseFloat(item.stock_item?.conversion ?? item.conversion ?? 1) || 1
  return parseFloat((rate * conversion).toFixed(2))
}

export function mapDetailLineToFormRow(row, stockItem) {
  const stock = stockItem || {}
  const conversion =
    parseFloat(stock.conversion || row.stock_item?.conversion || 1) || 1
  const storedRate = parseFloat(row.rate || row.price || 0)
  const baseUnitId = row.base_unit?.id || stock.base_unit?.id || null
  const alternateUnit =
    stock.alternate_unit ||
    row.alternate_unit ||
    row.stock_item?.alternate_unit ||
    null
  const alternateUnitId =
    alternateUnit?.id || row.stock_item?.alternate_units?.id || null
  const altRate = row.alternate_rate
    ? parseFloat(row.alternate_rate)
    : conversion > 0
      ? parseFloat((storedRate / conversion).toFixed(2))
      : 0

  const rateInAlternate = isSalesOrderItemRateInAlternate({
    ...row,
    stock_item: {
      ...(row.stock_item || {}),
      conversion,
      base_unit: row.base_unit || stock.base_unit || row.stock_item?.base_unit,
      alternate_unit: alternateUnit || row.stock_item?.alternate_unit,
    },
  })

  let priceUomId = baseUnitId
  let displayPrice = storedRate
  let baseUnitPriceForCalc = storedRate

  if (rateInAlternate && alternateUnitId) {
    priceUomId = alternateUnitId
    displayPrice = altRate
    baseUnitPriceForCalc = storedRate
  }

  const qty = parseFloat(row.quantity)
  const quantity = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1

  const comment = row.comment || row.remarks || ''
  const isFreeGift =
    Boolean(row.is_free_gift) ||
    Boolean(row.is_gift_item) ||
    String(comment).trim().toLowerCase() === 'free gift item'

  const deliveredQty = parseFloat(row.delivered_quantity)
  const orderedQty = parseFloat(row.ordered_quantity)

  return {
    item_id: row.stock_item_id ? String(row.stock_item_id) : '',
    item_name: row.item_name || stock.name || '',
    quantity,
    price: displayPrice,
    comment,
    base_unit_id: baseUnitId,
    price_uom_id: priceUomId,
    conversion,
    base_unit_price: storedRate,
    alternate_unit_price: altRate,
    base_unit_price_for_calc: baseUnitPriceForCalc,
    gst_percentage: parseFloat(row.gst_percentage) || 0,
    is_free_gift: isFreeGift,
    gift_offer_id:
      row.gift_offer_id != null && String(row.gift_offer_id) !== ''
        ? Number(row.gift_offer_id)
        : null,
    so_item_id: row.id != null ? Number(row.id) : null,
    delivered_quantity: Number.isFinite(deliveredQty) && deliveredQty > 0 ? deliveredQty : 0,
    ordered_quantity: Number.isFinite(orderedQty) && orderedQty > 0 ? orderedQty : quantity,
    is_approved: Boolean(row.is_approved),
    is_rejected: Boolean(row.is_rejected),
    approved_quantity:
      row.approved_quantity != null && row.approved_quantity !== ''
        ? parseFloat(row.approved_quantity) || 0
        : 0,
  }
}

export function getRatePerUnitForSubmit(line, stockItem) {
  if (!stockItem || !line.price_uom_id) {
    return stockItem?.base_unit?.name || undefined
  }
  const priceUomId = line.price_uom_id
  if (String(priceUomId) === String(stockItem.base_unit?.id)) {
    return stockItem.base_unit?.name || undefined
  }
  if (String(priceUomId) === String(stockItem.alternate_unit?.id)) {
    return stockItem.alternate_unit?.name || undefined
  }
  return stockItem.base_unit?.name || undefined
}

/** Price sent to create-direct-so: amount in the selected price UOM (rate_per_unit). */
export function getPriceForSubmit(line) {
  const price = parseFloat(line.price)
  return Number.isFinite(price) ? price : 0
}
