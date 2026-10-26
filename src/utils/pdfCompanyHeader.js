/**
 * Lightweight company header helpers for price-list / report PDFs.
 * Kept separate from the slim delivery-note blob generator used for WhatsApp.
 */

function pickText(...candidates) {
  for (const value of candidates) {
    if (value == null || value === '') continue
    if (typeof value === 'object') {
      const nested =
        value.organization_name ||
        value.organization ||
        value.branch_name ||
        value.branch ||
        value.name ||
        value.org_name
      if (nested != null && String(nested).trim()) return String(nested).trim()
      continue
    }
    const text = String(value).trim()
    if (text && text !== '-' && text.toLowerCase() !== 'null') return text
  }
  return ''
}

function dash(value) {
  const text = String(value ?? '').trim()
  return text || '-'
}

function buildAddress(source = {}) {
  return pickText(
    source.organization_address,
    source.full_address,
    source.address,
    [source.address, source.city, source.state, source.pincode].filter(Boolean).join(', '),
    source.branch_address,
  )
}

function normalizeBranch(detail = {}, branchDetail = null) {
  const org =
    detail.organization ||
    detail.organization_details ||
    detail.organization_info ||
    {}
  const source = branchDetail || detail.branch || org || detail || {}

  const name = pickText(
    source.organization_name,
    source.organization?.name,
    org.organization_name,
    org.name,
    source.name,
    source.branch_name,
    detail.organizationName,
    'Organization',
  )
  const address = buildAddress({ ...org, ...source, ...detail })
  const gstin = pickText(
    source.gst_number,
    source.gstin,
    org.gst_number,
    org.gstin,
    detail.gstin,
    detail.gst_number,
  )

  return {
    name,
    organization_name: name,
    address,
    organization_address: address,
    gst_number: gstin,
    gstin,
    fssai_licence_number: source.fssai_licence_number || org.fssai_licence_number || '',
    drug_licence_number: source.drug_licence_number || org.drug_licence_number || '',
    ...source,
  }
}

async function tryLoadLogoDataUrl(url) {
  if (!url || typeof url !== 'string') return ''
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

export async function resolvePdfCompanyHeader(options = {}) {
  const branch = normalizeBranch(options.detail || {}, options.branchDetail)
  const logoCandidate =
    options.headerLogo ||
    options.logo ||
    branch.organization_logo ||
    branch.logo ||
    ''
  const logo =
    typeof logoCandidate === 'string' && logoCandidate.startsWith('data:')
      ? logoCandidate
      : await tryLoadLogoDataUrl(logoCandidate)
  return { branch, logo }
}

function tryAddLogo(doc, headerLogo, x, y, w, h) {
  if (!headerLogo) return false
  try {
    doc.addImage(headerLogo, 'PNG', x, y, w, h)
    return true
  } catch {
    try {
      doc.addImage(headerLogo, 'JPEG', x, y, w, h)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Draws a bordered title band + company/meta row. Returns Y below the header.
 */
export function drawPdfCompanyHeader(
  doc,
  {
    startY = 12,
    branch = {},
    headerLogo = '',
    title = '',
    infoRows = [],
    marginX = 12,
    contentW = 186,
    includeLicenceNumbers = true,
  } = {},
) {
  const titleH = 22
  let y = startY

  doc.setDrawColor(203, 213, 225)
  doc.setFillColor(248, 250, 252)
  doc.rect(marginX, y, contentW, titleH, 'FD')

  const logoDrawn = tryAddLogo(doc, headerLogo, marginX + 2.5, y + 3.2, 28, 15)
  if (!logoDrawn) {
    doc.setFillColor(226, 232, 240)
    doc.rect(marginX + 2.5, y + 3.5, 26, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 58, 138)
    doc.text('GP', marginX + 15.5, y + 12, { align: 'center' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text(String(title || '').toUpperCase(), marginX + contentW / 2, y + 13, {
    align: 'center',
  })
  y += titleH

  const rows = (infoRows || []).filter((row) => row && row.label)
  const leftW = Math.round(contentW * 0.58 * 100) / 100
  const rightW = contentW - leftW
  const rowH = Math.max(24, 4.5 + rows.length * 4.4)

  doc.setDrawColor(203, 213, 225)
  doc.rect(marginX, y, leftW, rowH)
  doc.rect(marginX + leftW, y, rightW, rowH)

  const companyName = pickText(
    branch.organization_name,
    branch.name,
    branch.branch_name,
    'Organization',
  )
  const address = buildAddress(branch)
  const gstin = pickText(branch.gst_number, branch.gstin)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  const titleLines = doc.splitTextToSize(companyName, leftW - 4)
  doc.text(titleLines, marginX + 2, y + 4.2)

  let cursor = y + 4.2 + titleLines.length * 3.8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  if (address) {
    const addrLines = doc.splitTextToSize(address, leftW - 4)
    doc.text(addrLines, marginX + 2, cursor + 0.5)
    cursor += addrLines.length * 3.4 + 0.5
  }
  if (gstin) {
    doc.text(`GSTIN: ${gstin}`, marginX + 2, cursor + 0.5)
    cursor += 3.6
  }
  if (includeLicenceNumbers) {
    const fssai = pickText(branch.fssai_licence_number)
    const drug = pickText(branch.drug_licence_number)
    if (fssai) {
      doc.text(`FSSAI: ${fssai}`, marginX + 2, cursor + 0.5)
      cursor += 3.4
    }
    if (drug) {
      doc.text(`Drug Lic.: ${drug}`, marginX + 2, cursor + 0.5)
    }
  }

  let infoCursor = y + 5
  rows.forEach((row) => {
    if (infoCursor > y + rowH - 2) return
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42)
    const labelText = `${row.label} : `
    doc.text(labelText, marginX + leftW + 2, infoCursor)
    const labelW = doc.getTextWidth(labelText)
    doc.setFont('helvetica', 'normal')
    const valueLines = doc.splitTextToSize(
      dash(row.value),
      Math.max(6, rightW - labelW - 4),
    )
    doc.text(valueLines, marginX + leftW + 2 + labelW, infoCursor)
    infoCursor += Math.max(1, valueLines.length) * 4.4
  })

  return y + rowH
}
