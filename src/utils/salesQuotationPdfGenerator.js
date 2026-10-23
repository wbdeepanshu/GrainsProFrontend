const text = (value, fallback = "-") => {
  const result = value == null ? "" : String(value).trim()
  return result || fallback
}

const money = (value) => {
  const number = Number(value)
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const dateLabel = (value) => {
  if (!value) return "-"
  const [year, month, day] = String(value).slice(0, 10).split("-")
  return year && month && day ? `${day}-${month}-${year}` : String(value)
}

const numberWords = (value) => {
  const ones = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
  const underThousand = (number) => {
    const parts = []
    if (number >= 100) {
      parts.push(`${ones[Math.floor(number / 100)]} Hundred`)
      number %= 100
    }
    if (number >= 20) {
      parts.push(tens[Math.floor(number / 10)])
      number %= 10
    }
    if (number > 0) parts.push(ones[number])
    return parts.join(" ")
  }

  let number = Math.floor(Math.abs(Number(value) || 0))
  if (!number) return "Zero Rupees Only"

  const groups = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ]
  const words = []
  groups.forEach(([size, label]) => {
    if (number >= size) {
      const count = Math.floor(number / size)
      words.push(`${underThousand(count)} ${label}`)
      number %= size
    }
  })
  if (number) words.push(underThousand(number))
  return `${words.join(" ")} Rupees Only`
}

const getOrganizationInfo = () => {
  try {
    const raw = localStorage.getItem("cp_org_info")
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    console.warn("Unable to read organization details for quotation PDF.", error)
    return {}
  }
}

const itemAmount = (item) => {
  const amount = Number(item.amount)
  return Number.isFinite(amount)
    ? amount
    : (Number(item.quantity) || 0) * (Number(item.rate) || 0)
}

export async function createSoQuotationPdfBlob(quotation) {
  if (!quotation) throw new Error("Quotation details are not available.")

  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  const autoTable = autoTableModule.default
  const doc = new jsPDF("p", "mm", "a4")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const organization = getOrganizationInfo()
  const companyName = text(organization.organization, text(quotation.branch_name, "Company"))
  const companyAddress = text(
    organization.branch_address || organization.organization_address,
    "",
  )
  const items = Array.isArray(quotation.items) ? quotation.items : []
  const taxableAmount = items.reduce((sum, item) => sum + itemAmount(item), 0)
  const taxAmount = items.reduce(
    (sum, item) => sum + itemAmount(item) * (Number(item.gst_percentage) || 0) / 100,
    0,
  )
  const grandTotal = Number(quotation.total_amount)
  const total = Number.isFinite(grandTotal) ? grandTotal : taxableAmount + taxAmount
  const borderColor = [0, 0, 0]
  const common = {
    theme: "grid",
    margin: { left: margin + 1, right: margin + 1 },
    tableWidth: contentWidth - 2,
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      textColor: borderColor,
      lineColor: borderColor,
      lineWidth: 0.25,
      cellPadding: 1.5,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: borderColor,
      fontStyle: "bold",
      halign: "center",
    },
  }
  let y = margin + 2

  autoTable(doc, {
    ...common,
    startY: y,
    body: [[
      {
        content: companyName,
        styles: { fontStyle: "bold", fontSize: 10, halign: "center", minCellHeight: 16 },
      },
      {
        content: "QUOTATION",
        styles: { fontStyle: "bold", fontSize: 16, halign: "center", minCellHeight: 16 },
      },
    ]],
    columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: contentWidth - 60 } },
  })
  y = doc.lastAutoTable.finalY

  const companyLines = [companyName, companyAddress, organization.branch ? `Branch: ${organization.branch}` : ""]
    .filter(Boolean)
    .join("\n")
  const partyLines = [
    text(quotation.customer),
    quotation.customer_address ? `Address: ${quotation.customer_address}` : "",
    quotation.customer_mobile ? `Contact: ${quotation.customer_mobile}` : "",
  ].filter(Boolean).join("\n")
  autoTable(doc, {
    ...common,
    startY: y,
    body: [[
      { content: ` ${companyLines}`, styles: { fontStyle: "bold" } },
      { content: `Party Details\n${partyLines}`, styles: { fontStyle: "normal" } },
    ]],
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: contentWidth - 112 } },
  })
  y = doc.lastAutoTable.finalY

  autoTable(doc, {
    ...common,
    startY: y,
    head: [[
      "QUOTATION NO.", "QUOTATION DATE", "VALID TILL", "BUSINESS TYPE", "CREDIT TYPE",
    ]],
    body: [[
      text(quotation.quotation_number),
      dateLabel(quotation.order_date),
      dateLabel(quotation.valid_till),
      text(quotation.business_type_name),
      text(quotation.credit_type_name),
    ]],
    styles: { ...common.styles, fontSize: 7, halign: "center" },
  })
  y = doc.lastAutoTable.finalY

  const itemRows = items.map((item, index) => {
    const rate = Number(item.rate) || 0
    const gstPercent = Number(item.gst_percentage) || 0
    const amount = itemAmount(item)
    const tax = amount * gstPercent / 100
    return [
      String(index + 1),
      text(item.stock_item_name),
      `${money(gstPercent)}%`,
      `${text(item.quantity, "0")} ${text(item.rate_per_unit || item.base_unit_name, "")}`.trim(),
      "-",
      money(rate * (1 + gstPercent / 100)),
      money(rate),
      money(tax),
      money(amount + tax),
    ]
  })
  itemRows.push(["", "Total", "", "", "", "", "", money(taxAmount), money(total)])
  autoTable(doc, {
    ...common,
    startY: y,
    head: [[
      "Sl No.", "Product Description", "GST %", "QTY", "Weight",
      "Rate incl. of Tax", "Rate excl. of Tax", "Tax Amt", "Total",
    ]],
    body: itemRows,
    styles: { ...common.styles, fontSize: 6.5, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 11, halign: "center" },
      1: { cellWidth: 49 },
      2: { cellWidth: 13, halign: "right" },
      3: { cellWidth: 21, halign: "right" },
      4: { cellWidth: 15, halign: "right" },
      5: { cellWidth: 23, halign: "right" },
      6: { cellWidth: 23, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 15, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === itemRows.length - 1) {
        data.cell.styles.fontStyle = "bold"
      }
    },
  })
  y = doc.lastAutoTable.finalY

  autoTable(doc, {
    ...common,
    startY: y,
    body: [[
      {
        content: "Bank Details\nBank Name: -\nBank Account No.: -\nIFSC Code: -",
        styles: { fontStyle: "bold", minCellHeight: 18 },
      },
      { content: "", styles: { minCellHeight: 18 } },
    ]],
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: contentWidth - 112 } },
  })
  y = doc.lastAutoTable.finalY

  autoTable(doc, {
    ...common,
    startY: y,
    body: [[
      {
        content: `Terms and Conditions\n${text(quotation.remarks, "")}`,
        styles: { fontStyle: "normal", minCellHeight: 22 },
      },
      { content: "", styles: { minCellHeight: 22 } },
    ]],
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: contentWidth - 112 } },
  })
  y = doc.lastAutoTable.finalY

  autoTable(doc, {
    ...common,
    startY: y,
    body: [[
      { content: `Amount in Words:\n${numberWords(total)}`, styles: { fontStyle: "bold" } },
      { content: `Grand Bill Total\n${money(total)}`, styles: { fontStyle: "bold", halign: "right" } },
    ]],
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: contentWidth - 112 } },
  })
  y = doc.lastAutoTable.finalY

  autoTable(doc, {
    ...common,
    startY: y,
    body: [[
      {
        content: "Declaration: We hereby certify that the goods/products mentioned in this quotation are warranted to be of the nature and quality represented.",
        styles: { fontSize: 7, minCellHeight: 11 },
      },
    ]],
  })
  const contentEndY = doc.lastAutoTable.finalY

  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(0.3)
    const frameBottom = pageCount === 1
      ? Math.min(contentEndY + 1, pageHeight - margin)
      : pageHeight - margin
    doc.rect(margin, margin, contentWidth, frameBottom - margin)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    const footerY = pageCount === 1 ? frameBottom + 4 : pageHeight - 5
    doc.text("This is a computer generated quotation.", pageWidth / 2, footerY, {
      align: "center",
    })
  }

  const blob = doc.output("blob")
  return { blobUrl: URL.createObjectURL(blob), blob }
}

export async function downloadSoQuotationPdf(quotation) {
  const { blob } = await createSoQuotationPdfBlob(quotation)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${text(quotation.quotation_number, "quotation")}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
