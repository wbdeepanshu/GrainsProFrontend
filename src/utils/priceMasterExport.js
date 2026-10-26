/**
 * Price Master PDF / Excel export — matches the Price Master page UI columns
 * (Item, Closing Balance, Max Qty, Unit, Base, Alt). Separate from Item Price Margin.
 */
import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  drawPdfCompanyHeader,
  resolvePdfCompanyHeader,
} from '@/utils/pdfCompanyHeader'

const MARGIN = 10

const COLORS = {
  primary: [30, 58, 138],
  headerBg: [241, 245, 249],
  border: [203, 213, 225],
  text: [15, 23, 42],
  muted: [100, 116, 139],
  price: [22, 101, 52],
  altRow: [248, 250, 252],
  accentBar: [219, 234, 254],
}

function toNum(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function roundPriceOneDecimal(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return null
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  const hundredths = Math.round(abs * 100)
  const tenths = Math.floor(hundredths / 10)
  const secondDigit = hundredths % 10
  const roundedTenths = secondDigit > 0 ? tenths + 1 : tenths
  return sign * (roundedTenths / 10)
}

function ceilBaseUnitPrice(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return null
  if (n >= 0) return Math.ceil(n - Number.EPSILON)
  return -Math.floor(Math.abs(n) - Number.EPSILON)
}

function formatMoney(value, { wholeNumber = false } = {}) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  if (wholeNumber) {
    return Math.round(n).toLocaleString('en-IN')
  }
  return n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

function formatQty(value) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function formatPriceWithUnit(value, unitName, { wholeNumber = false } = {}) {
  if (value == null || !Number.isFinite(parseFloat(value))) return '—'
  const unit = String(unitName || '').trim()
  const money = formatMoney(value, { wholeNumber })
  return unit ? `${money} / ${unit}` : money
}

function getClosingBalance(item) {
  const raw =
    item?.closing_balance ??
    item?.total_closing_balance ??
    item?.total_selling_stock ??
    item?.stock_item?.closing_balance ??
    item?.stock_item?.total_closing_balance
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function getMaxQty(item) {
  const raw =
    item?.max_quantity ??
    item?.max_qty ??
    item?.rule_max_qty ??
    item?.stock_item?.max_quantity ??
    item?.stock_item?.max_qty
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function getRowPrices(item) {
  const baseUnit = item?.base_unit || item?.stock_item?.base_unit
  const alternateUnit = item?.alternate_unit || item?.stock_item?.alternate_unit
  const minimumUnit = item?.minimum_unit || item?.stock_item?.minimum_unit
  const unitPrice = parseFloat(item?.unit_price ?? item?.stock_item?.unit_price)
  const rawBase = parseFloat(baseUnit?.price ?? item?.base_price)
  const basePrice = Number.isFinite(rawBase) ? ceilBaseUnitPrice(rawBase) : null
  const altPrice = parseFloat(alternateUnit?.price)
  const baseName = (baseUnit?.name || '').trim() || 'Base'
  const minName = String(minimumUnit?.name || '').trim()
  const minId = minimumUnit?.id
  const baseId = baseUnit?.id
  const sameAsBase =
    !minName ||
    (baseId != null && minId != null && String(baseId) === String(minId)) ||
    minName.toLowerCase() === baseName.toLowerCase()

  return {
    unitPrice: Number.isFinite(unitPrice) ? roundPriceOneDecimal(unitPrice) : null,
    unitName: sameAsBase ? baseName : minName,
    basePrice,
    baseName,
    altPrice: Number.isFinite(altPrice) ? roundPriceOneDecimal(altPrice) : null,
    altName: (alternateUnit?.name || '').trim() || 'Alt',
    hasAlternate: Boolean(alternateUnit?.id || alternateUnit?.name),
  }
}

function buildPriceMasterRows(items = []) {
  const list = (items || []).filter((item) => !(item.is_active === false || item.is_active === 0))
  list.sort((a, b) => {
    const na = String(a.name || a.stock_item_name || a.reserved_name || '').toLowerCase()
    const nb = String(b.name || b.stock_item_name || b.reserved_name || '').toLowerCase()
    return na.localeCompare(nb)
  })

  return list.map((item, idx) => {
    const prices = getRowPrices(item)
    const name =
      item.name || item.stock_item_name || item.reserved_name || `Item #${item.id || idx + 1}`
    return {
      slNo: String(idx + 1),
      itemName: name,
      closing: getClosingBalance(item),
      maxQty: getMaxQty(item),
      unit: formatPriceWithUnit(prices.unitPrice, prices.unitName),
      base: formatPriceWithUnit(prices.basePrice, prices.baseName, { wholeNumber: true }),
      alt: prices.hasAlternate
        ? formatPriceWithUnit(prices.altPrice, prices.altName)
        : '—',
    }
  })
}

function resolveCompanyName(branchDetail) {
  return (
    branchDetail?.organization_name ||
    branchDetail?.organization?.name ||
    branchDetail?.name ||
    'MWB ERP'
  )
}

/** Optional export columns (Item + SI No. are always included). */
export const PRICE_MASTER_EXPORT_COLUMNS = [
  { key: 'closing', label: 'Closing Balance', align: 'center', isPrice: false },
  { key: 'max_qty', label: 'Max Qty', align: 'center', isPrice: false },
  { key: 'unit', label: 'Piece Price', align: 'right', isPrice: true },
  { key: 'base', label: 'Base Price', align: 'right', isPrice: true },
  { key: 'alt', label: 'Quintal Price', align: 'right', isPrice: true },
]

function normalizeExportColumns(columns) {
  const allowed = new Set(PRICE_MASTER_EXPORT_COLUMNS.map((c) => c.key))
  const selected = (Array.isArray(columns) ? columns : []).filter((key) => allowed.has(key))
  return PRICE_MASTER_EXPORT_COLUMNS.filter((col) => selected.includes(col.key))
}

function buildExportTable(rows, columns) {
  const optionalCols = normalizeExportColumns(columns)
  if (!optionalCols.length) {
    throw new Error('Select at least one column to download.')
  }

  const head = ['SI No.', 'Item', ...optionalCols.map((c) => c.label)]
  const body = rows.map((row) => {
    const cells = [row.slNo, row.itemName]
    optionalCols.forEach((col) => {
      if (col.key === 'closing') cells.push(formatQty(row.closing))
      else if (col.key === 'max_qty') cells.push(formatQty(row.maxQty))
      else if (col.key === 'unit') cells.push(row.unit)
      else if (col.key === 'base') cells.push(row.base)
      else if (col.key === 'alt') cells.push(row.alt)
    })
    return cells
  })
  return { head, body, optionalCols }
}

function pdfColumnStyles(optionalCols, contentW) {
  const styles = {
    0: { cellWidth: 14, halign: 'center' },
    1: { cellWidth: Math.max(50, contentW * 0.32), halign: 'left', fontStyle: 'bold' },
  }
  const remaining = contentW - styles[0].cellWidth - styles[1].cellWidth
  const each = Math.max(22, remaining / Math.max(optionalCols.length, 1))
  optionalCols.forEach((col, i) => {
    styles[2 + i] = {
      cellWidth: each,
      halign: col.align || 'center',
      ...(col.isPrice
        ? { textColor: COLORS.price, fontStyle: 'bold' }
        : {}),
    }
  })
  return styles
}

/**
 * Beautiful landscape A4 PDF matching Price Master page columns.
 */
export async function generatePriceMasterPdf({
  soItems = [],
  businessTypeName = '',
  categoryTypeName = '',
  creditTypeName = '',
  customerName = '',
  filterDescription = '',
  columns = null,
  orgInfo = null,
  branchDetail = null,
}) {
  const rows = buildPriceMasterRows(soItems)
  if (!rows.length) {
    throw new Error('No items found to generate price list.')
  }

  const { head, body, optionalCols } = buildExportTable(
    rows,
    columns || PRICE_MASTER_EXPORT_COLUMNS.map((c) => c.key),
  )

  const pageW = 297
  const pageH = 210
  const contentW = pageW - MARGIN * 2
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const now = new Date()
  const generatedAt = format(now, 'dd-MM-yyyy hh:mm a')

  const { branch, logo } = await resolvePdfCompanyHeader({
    detail: orgInfo ? { organization: orgInfo } : {},
    branchDetail,
  })

  const infoRows = [
    { label: 'Generated On', value: generatedAt },
    ...(customerName ? [{ label: 'Customer', value: customerName }] : []),
    { label: 'Business Type', value: businessTypeName || '—' },
    { label: 'Category', value: categoryTypeName || '—' },
    { label: 'Credit Type', value: creditTypeName || 'Cash' },
    { label: 'Total Items', value: String(rows.length) },
  ]

  let y = drawPdfCompanyHeader(doc, {
    startY: MARGIN,
    branch,
    headerLogo: logo,
    title: 'PRICE MASTER',
    marginX: MARGIN,
    contentW,
    includeLicenceNumbers: false,
    infoRows,
  })

  if (customerName) {
    const greeting =
      `Hello Dear ${customerName}, please find the updated price master for ${format(now, 'dd-MM-yyyy')}.`
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    const wrapped = doc.splitTextToSize(greeting, contentW - 6)
    const h = wrapped.length * 3.6 + 4
    doc.setDrawColor(...COLORS.border)
    doc.setFillColor(239, 246, 255)
    doc.rect(MARGIN, y, contentW, h, 'FD')
    doc.setTextColor(...COLORS.primary)
    doc.text(wrapped, MARGIN + 3, y + 4.2)
    y += h + 2
  }

  if (filterDescription) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    const note = `Filters: ${filterDescription}`
    const wrapped = doc.splitTextToSize(note, contentW - 6)
    const h = wrapped.length * 3.2 + 3.5
    doc.setDrawColor(...COLORS.border)
    doc.setFillColor(...COLORS.accentBar)
    doc.rect(MARGIN, y, contentW, h, 'FD')
    doc.setTextColor(...COLORS.muted)
    doc.text(wrapped, MARGIN + 3, y + 3.8)
    y += h + 2
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 12 },
    head: [head],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.2,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: COLORS.altRow,
    },
    columnStyles: pdfColumnStyles(optionalCols, contentW),
    didDrawPage: () => {
      const pageCount = doc.internal.getNumberOfPages()
      const page = doc.internal.getCurrentPageInfo().pageNumber
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.muted)
      doc.text(`Page ${page} of ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' })
      doc.text('Price Master · MWB ERP', MARGIN, pageH - 6)
    },
  })

  const stamp = format(now, 'yyyyMMdd_HHmm')
  const safeName = String(customerName || businessTypeName || 'price_master')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40)
  doc.save(`Price_Master_${safeName}_${stamp}.pdf`)

  return { count: rows.length, filename: `Price_Master_${safeName}_${stamp}.pdf` }
}

/**
 * Excel workbook matching Price Master page columns.
 */
export async function generatePriceMasterExcel({
  soItems = [],
  businessTypeName = '',
  categoryTypeName = '',
  creditTypeName = '',
  customerName = '',
  filterDescription = '',
  columns = null,
  branchDetail = null,
}) {
  const rows = buildPriceMasterRows(soItems)
  if (!rows.length) {
    throw new Error('No items found to generate price list.')
  }

  const { head, body, optionalCols } = buildExportTable(
    rows,
    columns || PRICE_MASTER_EXPORT_COLUMNS.map((c) => c.key),
  )

  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MWB ERP'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Price Master', {
    views: [{ state: 'frozen', ySplit: 5 }],
  })

  const colCount = head.length
  const now = new Date()
  const generatedAt = format(now, 'dd-MM-yyyy hh:mm a')
  const companyName = resolveCompanyName(branchDetail)

  const thin = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  }

  ws.mergeCells(1, 1, 1, colCount)
  const title = ws.getCell(1, 1)
  title.value = companyName
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 24

  ws.mergeCells(2, 1, 2, colCount)
  const report = ws.getCell(2, 1)
  report.value = 'PRICE MASTER'
  report.font = { bold: true, size: 12, color: { argb: 'FF0F172A' }, name: 'Calibri' }
  report.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 20

  ws.mergeCells(3, 1, 3, colCount)
  ws.getCell(3, 1).value = [
    `Generated On: ${generatedAt}`,
    ...(customerName ? [`Customer: ${customerName}`] : []),
    `Business Type: ${businessTypeName || '—'}`,
    `Category: ${categoryTypeName || '—'}`,
    `Credit Type: ${creditTypeName || 'Cash'}`,
    `Total Items: ${rows.length}`,
  ].join('  ·  ')
  ws.getCell(3, 1).font = { size: 9, color: { argb: 'FF64748B' }, name: 'Calibri' }
  ws.getCell(3, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  ws.getRow(3).height = 18

  let nextRow = 4
  if (filterDescription) {
    ws.mergeCells(nextRow, 1, nextRow, colCount)
    const filterCell = ws.getCell(nextRow, 1)
    filterCell.value = `Filters: ${filterDescription}`
    filterCell.font = { size: 9, italic: true, color: { argb: 'FF1E3A8A' }, name: 'Calibri' }
    filterCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
    filterCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    ws.getRow(nextRow).height = 18
    nextRow += 1
  }

  const headerRow = ws.getRow(nextRow)
  head.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = label
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    cell.alignment = {
      horizontal: i === 1 ? 'left' : 'center',
      vertical: 'middle',
      wrapText: true,
    }
    cell.border = thin
  })
  headerRow.height = 22
  nextRow += 1

  body.forEach((values, idx) => {
    const excelRow = ws.getRow(nextRow)
    const alt = idx % 2 === 1
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1)
      cell.value = value
      const optionalIndex = i - 2
      const optionalMeta = optionalIndex >= 0 ? optionalCols[optionalIndex] : null
      const isPrice = Boolean(optionalMeta?.isPrice)
      cell.font = {
        size: 9,
        name: 'Calibri',
        bold: isPrice || i === 1,
        color: { argb: isPrice ? 'FF166534' : 'FF0F172A' },
      }
      let horizontal = 'center'
      if (i === 1) horizontal = 'left'
      else if (optionalMeta?.align === 'right') horizontal = 'right'
      cell.alignment = { vertical: 'middle', horizontal, wrapText: true }
      cell.border = thin
      if (alt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    })
    excelRow.height = 18
    nextRow += 1
  })

  const widths = [10, 48]
  optionalCols.forEach((col) => {
    if (col.key === 'closing') widths.push(16)
    else if (col.key === 'max_qty') widths.push(12)
    else widths.push(18)
  })
  ws.columns = widths.map((width) => ({ width }))

  const stamp = format(now, 'yyyyMMdd_HHmm')
  const safeName = String(customerName || businessTypeName || 'price_master')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40)
  const filename = `Price_Master_${safeName}_${stamp}.xlsx`

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return { count: rows.length, filename }
}
