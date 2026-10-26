import { format } from 'date-fns'
import {
  buildLandingPricesMatrixRows,
  buildPriceListExportRows,
  buildPriceListExportRowsFromSoItems,
  formatBasePriceDisplay,
  formatEffectivePrice,
} from '@/utils/priceListPdfGenerator'

const EXCEL_COLORS = {
  titleFill: 'FF1E3A8A',
  titleFont: 'FFFFFFFF',
  headerFill: 'FF1E3A8A',
  headerFont: 'FFFFFFFF',
  altRowFill: 'FFF8FAFC',
  border: 'FFCBD5E1',
  text: 'FF0F172A',
  muted: 'FF64748B',
  priceGreen: 'FF166534',
}

function thinBorder() {
  const edge = { style: 'thin', color: { argb: EXCEL_COLORS.border } }
  return { top: edge, left: edge, bottom: edge, right: edge }
}

function resolveCompanyName(branchDetail) {
  return (
    branchDetail?.organization_name ||
    branchDetail?.organization?.name ||
    branchDetail?.name ||
    'MWB ERP'
  )
}

function styleHeaderCell(cell) {
  cell.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.headerFont }, name: 'Calibri' }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.headerFill } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = thinBorder()
}

function styleBodyCell(cell, { isPrice = false, align = 'center', alt = false } = {}) {
  cell.font = {
    size: 9,
    name: 'Calibri',
    bold: isPrice,
    color: { argb: isPrice ? EXCEL_COLORS.priceGreen : EXCEL_COLORS.text },
  }
  cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true }
  cell.border = thinBorder()
  if (alt) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.altRowFill },
    }
  }
}

/**
 * Builds and downloads Excel for one business type + category price list.
 * Optional customerName is shown in the header when exporting for a customer.
 */
export async function generatePriceListExcel({
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
  branchDetail = null,
}) {
  const useSoItems = Array.isArray(soItems)
  const useMatrix =
    !useSoItems &&
    Array.isArray(businessTypes) &&
    businessTypes.length > 0 &&
    (businessTypeId == null || businessTypeId === '')
  const matrix = useMatrix
    ? buildLandingPricesMatrixRows(items, businessTypes)
    : null
  const listExport = useMatrix
    ? null
    : useSoItems
      ? buildPriceListExportRowsFromSoItems(soItems)
      : buildPriceListExportRows(items, businessTypeId, categoryTypeId, creditTypeId)

  const activeItems = useMatrix ? matrix.activeItems : listExport.activeItems
  const rows = useMatrix ? matrix.rows : listExport.rows
  const btColumns = useMatrix ? matrix.businessTypes : []

  if (!rows.length) {
    throw new Error('No active items found to generate price list.')
  }

  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MWB ERP'
  workbook.created = new Date()

  const sheetName = useMatrix ? 'Landing Prices' : 'Price List'
  const ws = workbook.addWorksheet(sheetName)

  const headers = useMatrix
    ? [
        'Sl No.',
        'Stock Item',
        'Base Price',
        'Conversion',
        ...btColumns.map((bt) =>
          String(bt.name || ('Business ' + bt.id)).toUpperCase(),
        ),
      ]
    : [
        'Sl No.',
        'Sub Category',
        'Product Name',
        'KG/PC Price',
        'Pkt/ Bag Price',
      ]

  const colCount = headers.length
  const now = new Date()
  const generatedAt = format(now, 'dd-MM-yyyy hh:mm a')
  const greetingDate = format(now, 'dd-MM-yyyy')
  const companyName = resolveCompanyName(branchDetail)
  const hasGreeting = Boolean(customerName) && !useMatrix
  const greetingText = hasGreeting
    ? 'Hello Dear ' +
      customerName +
      ', Please find the updated price list of the stock items for ' +
      greetingDate +
      '.'
    : ''

  ws.mergeCells(1, 1, 1, colCount)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = companyName
  titleCell.font = { bold: true, size: 14, color: { argb: EXCEL_COLORS.titleFont }, name: 'Calibri' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.titleFill } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(2, 1, 2, colCount)
  const reportCell = ws.getCell(2, 1)
  reportCell.value = useMatrix ? 'LANDING PRICES' : 'PRICE LIST'
  reportCell.font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.text }, name: 'Calibri' }
  reportCell.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells(3, 1, 3, colCount)
  ws.getCell(3, 1).value = useMatrix
    ? ['Generated On: ' + generatedAt, 'Total Items: ' + activeItems.length].join('  |  ')
    : [
        'Generated On: ' + generatedAt,
        ...(customerName ? ['Customer: ' + customerName] : []),
        'Business Type: ' + (businessTypeName || '-'),
        'Category: ' + (categoryTypeName || '-'),
        'Credit Type: ' + (creditTypeName || 'Cash'),
        'Total Items: ' + activeItems.length,
      ].join('  |  ')
  ws.getCell(3, 1).font = { size: 9, color: { argb: EXCEL_COLORS.muted }, name: 'Calibri' }
  ws.getCell(3, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

  let nextRow = 4
  if (hasGreeting) {
    ws.mergeCells(nextRow, 1, nextRow, colCount)
    ws.getCell(nextRow, 1).value = greetingText
    ws.getCell(nextRow, 1).font = {
      size: 10,
      italic: true,
      bold: true,
      color: { argb: EXCEL_COLORS.titleFill },
      name: 'Calibri',
    }
    ws.getCell(nextRow, 1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    ws.getRow(nextRow).height = 22
    nextRow += 1
  }

  ws.mergeCells(nextRow, 1, nextRow, colCount)
  ws.getCell(nextRow, 1).value = filterDescription
    ? 'Active Filters: ' + filterDescription
    : ''
  ws.getCell(nextRow, 1).font = { size: 9, italic: true, color: { argb: EXCEL_COLORS.muted }, name: 'Calibri' }
  ws.getCell(nextRow, 1).alignment = { horizontal: 'center', vertical: 'middle' }
  nextRow += 1

  // Spacer row
  ws.getRow(nextRow).height = 8
  nextRow += 1

  ws.getRow(1).height = 24
  ws.getRow(2).height = 20
  ws.getRow(3).height = 20

  const headerRowIndex = nextRow
  ws.views = [{ state: 'frozen', ySplit: headerRowIndex }]
  headers.forEach((label, index) => {
    const cell = ws.getCell(headerRowIndex, index + 1)
    cell.value = label
    styleHeaderCell(cell)
  })
  ws.getRow(headerRowIndex).height = 20

  rows.forEach((row, rowIndex) => {
    const r = headerRowIndex + 1 + rowIndex
    const alt = rowIndex % 2 === 1
    const values = useMatrix
      ? [
          row.slNo,
          row.productName,
          formatBasePriceDisplay(row.basePrice),
          row.conversion,
          ...btColumns.map((bt) => {
            const btId = bt.id ?? bt.business_type_id
            const value = row.landingByBusinessType[String(btId)]
            return value == null ? '-' : formatEffectivePrice(value)
          }),
        ]
      : [
          row.slNo,
          row.subCategory,
          row.productName,
          row.kgPcPrice,
          row.pktBagPrice,
        ]

    values.forEach((value, colIndex) => {
      const cell = ws.getCell(r, colIndex + 1)
      cell.value = value
      const isPriceCol = useMatrix ? colIndex >= 2 : colIndex >= 3
      const align =
        useMatrix
          ? colIndex === 1
            ? 'left'
            : 'center'
          : colIndex === 1 || colIndex === 2
            ? 'left'
            : 'center'
      styleBodyCell(cell, { isPrice: isPriceCol, align, alt })
    })
  })

  if (useMatrix) {
    ws.getColumn(1).width = 10
    ws.getColumn(2).width = 36
    ws.getColumn(3).width = 14
    ws.getColumn(4).width = 12
    btColumns.forEach((_, i) => {
      ws.getColumn(5 + i).width = 16
    })
  } else {
    ws.getColumn(1).width = 10
    ws.getColumn(2).width = 24
    ws.getColumn(3).width = 44
    ws.getColumn(4).width = 18
    ws.getColumn(5).width = 18
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const cleanBt = String(businessTypeName || 'All').replace(/[^a-zA-Z0-9_-]/g, '_')
  const cleanCat = String(categoryTypeName || 'Category').replace(/[^a-zA-Z0-9_-]/g, '_')
  const cleanCustomer = String(customerName || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40)
  const dateSuffix = format(new Date(), 'yyyyMMdd_HHmm')
  const fileName = useMatrix
    ? 'Landing_Prices_' + dateSuffix + '.xlsx'
    : cleanCustomer
      ? 'Price_List_' + cleanCustomer + '_' + cleanBt + '_' + cleanCat + '_' + dateSuffix + '.xlsx'
      : 'Price_List_' + cleanBt + '_' + cleanCat + '_' + dateSuffix + '.xlsx'

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)

  return { fileName, count: activeItems.length }
}
