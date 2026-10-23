/** Grayscale theme matching Sales Order / lab PDF reference: black borders, dark text. */
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];
const DARK_GRAY = [85, 85, 85]; // #555 — items table headers
const SECTION_GRAY = [169, 169, 169]; // #A9A9A9 — section headers
const LABEL_GRAY = [211, 211, 211]; // #D3D3D3 — label cells

const DUMMY_ORG_ADDRESS =
  "123 Business Park, Industrial Area, Near Main Road, City - 560001";

const LABEL_CELL = {
  fontStyle: "bold",
  fillColor: LABEL_GRAY,
  textColor: BLACK,
  fontSize: 8,
  cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 5 },
};

const VALUE_CELL = {
  textColor: BLACK,
  fontSize: 9,
  cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
};

const GRID = {
  theme: "grid",
  styles: {
    fontSize: 9,
    cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    valign: "top",
    lineColor: BLACK,
    lineWidth: 0.35,
    overflow: "linebreak",
    textColor: BLACK,
  },
};

const SECTION_HEAD = {
  fillColor: SECTION_GRAY,
  textColor: BLACK,
  fontStyle: "bold",
  halign: "center",
  fontSize: 9,
};

const TABLE_HEAD = {
  fillColor: DARK_GRAY,
  textColor: WHITE,
  fontStyle: "bold",
  halign: "center",
  fontSize: 8,
};

const joinLines = (parts) =>
  parts.filter((p) => p != null && String(p).trim() !== "").join("\n");

const chunkPairs = (rows, size = 2) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

const metaLabelCell = (text) => ({ content: text, styles: { ...LABEL_CELL } });

const metaValueCell = (text, overrides = {}) => ({
  content: String(text ?? "").trim() || "-",
  styles: { ...VALUE_CELL, ...overrides },
});

const getOrgNameFromStorage = () => {
  try {
    const raw = localStorage.getItem("cp_org_info");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return (
      parsed?.organization_name ||
      parsed?.organization ||
      parsed?.org_name ||
      parsed?.name ||
      parsed?.data?.organization ||
      ""
    );
  } catch {
    return "";
  }
};

const getOrgAddressFromStorage = () => {
  try {
    const raw = localStorage.getItem("cp_org_info");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed?.organization_address || "";
  } catch {
    return "";
  }
};

const getBrokerName = (entryDetail) => {
  const broker = entryDetail?.broker;
  if (!broker) return "";
  if (typeof broker === "object" && broker.name) return String(broker.name);
  return "";
};

/**
 * Generate and download a Purchase Order PDF (grayscale tabular layout).
 */
export async function downloadPurchaseOrderPdf(entryDetail, options = {}) {
  if (!entryDetail) {
    throw new Error("Purchase order details are not available");
  }

  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF("p", "mm", "a4");

  const userData = options.userData || null;
  const orgFromUser = userData?.organization || userData?.user_info?.organization || {};
  const orgName =
    getOrgNameFromStorage() ||
    orgFromUser?.name ||
    orgFromUser?.company_name ||
    "Organization";
const OrgAddress = 
  getOrgAddressFromStorage() ||
  orgFromUser?.address ||
  orgFromUser?.organization_address ||
  "Organization Address";


  const orgAddress = getOrgAddressFromStorage() || OrgAddress;

  const voucher = entryDetail.voucher_number || `PO-${entryDetail.id || ""}`;
  const party = entryDetail.party || "N/A";
  const reference = entryDetail.reference || "N/A";
  const date = entryDetail.effective_date || "N/A";
  const voucherType = entryDetail.voucher_type || "";
  const createdBy = entryDetail.created_by || "";
  const pi = entryDetail.party_info || null;
  const partyBlockName = (pi?.name || party || "N/A").toString();
  const partyAddr = (pi?.address || "").toString().trim();
  const partyCityState = [pi?.city, pi?.state].filter(Boolean).join(", ");
  const partyPin = (pi?.pincode || "").toString().trim();
  const partyCountry = (pi?.country || "").toString().trim();
  const partyGst = (pi?.gst_number || "").toString().trim();
  const partyContact = (pi?.contact_number || "").toString().trim();
  const brokerName = getBrokerName(entryDetail);

  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const rightX = pageW - margin;
  const contentW = pageW - margin * 2;

  const drawPageFooter = (pageNumber) => {
    if (pageNumber > 1) {
      doc.setFontSize(8);
      doc.setTextColor(...BLACK);
      doc.text(`Purchase Order - ${voucher} (page ${pageNumber})`, margin, pageH - 8);
    }
  };

  let y = margin;

  // Centered title + organization details below
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, valign: "top", lineWidth: 0, textColor: BLACK },
    body: [
      [
        {
          content: "PURCHASE ORDER",
          styles: {
            fontSize: 18,
            fontStyle: "bold",
            halign: "center",
            textColor: BLACK,
            cellPadding: { top: 0, right: 0, bottom: 4, left: 0 },
          },
        },
      ],
      [
        {
          content: orgName,
          styles: {
            fontSize: 12,
            fontStyle: "bold",
            halign: "center",
            textColor: BLACK,
            cellPadding: { top: 0, right: 0, bottom: 2, left: 0 },
          },
        },
      ],
      [
        {
          content: orgAddress,
          styles: {
            fontSize: 9,
            fontStyle: "normal",
            halign: "center",
            textColor: BLACK,
            cellPadding: { top: 0, right: 0, bottom: 4, left: 0 },
          },
        },
      ],
    ],
    columnStyles: { 0: { cellWidth: contentW } },
  });

  y = doc.lastAutoTable.finalY + 2;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);
  y += 6;

  // Bill To (party) + Order Information
  const partyBlock = joinLines([
    partyBlockName,
    partyAddr,
    partyCityState,
    [partyPin, partyCountry].filter(Boolean).join(" "),
    partyGst ? `GSTIN: ${partyGst}` : "",
    partyContact ? `Contact: ${partyContact}` : "",
  ]);

  const orderMeta = [
    ["Voucher No", voucher],
    ["Date", date],
    voucherType ? ["Voucher Type", voucherType] : null,
    ["Reference", reference],
    brokerName ? ["Broker", brokerName] : null,
    createdBy ? ["Created By", createdBy] : null,
  ].filter(Boolean);

  const metaRowGroups = chunkPairs(orderMeta, 2);
  const partyColW = contentW * 0.36;
  const orderColW = contentW - partyColW;
  const metaLabelW = orderColW * 0.22;
  const metaValueW = orderColW * 0.28;

  const orderInfoBody = metaRowGroups.map((pair, groupIdx) => {
    const row = [];

    if (groupIdx === 0) {
      row.push({
        content: partyBlock || partyBlockName,
        rowSpan: metaRowGroups.length,
        styles: {
          valign: "top",
          fontSize: 9,
          textColor: BLACK,
          lineColor: BLACK,
          cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
        },
      });
    }

    pair.forEach(([label, value]) => {
      const valueStyles =
        label === "Voucher No"
          ? { fontStyle: "bold", textColor: BLACK }
          : { textColor: BLACK };
      row.push(metaLabelCell(label), metaValueCell(value, valueStyles));
    });

    if (pair.length === 1) {
      row.push(
        { content: "", styles: { fillColor: WHITE, lineWidth: 0.35, lineColor: BLACK } },
        { content: "", styles: { fillColor: WHITE, lineWidth: 0.35, lineColor: BLACK } }
      );
    }

    return row;
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    ...GRID,
    head: [
      [
        { content: "Bill To", styles: { ...SECTION_HEAD } },
        { content: "Order Information", colSpan: 4, styles: { ...SECTION_HEAD } },
      ],
    ],
    body: orderInfoBody,
    columnStyles: {
      0: { cellWidth: partyColW },
      1: { cellWidth: metaLabelW },
      2: { cellWidth: metaValueW },
      3: { cellWidth: metaLabelW },
      4: { cellWidth: metaValueW },
    },
    alternateRowStyles: { fillColor: WHITE },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 1 || data.column.index === 3) {
        data.cell.styles.fillColor = LABEL_CELL.fillColor;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = LABEL_CELL.textColor;
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // Items
  const items = Array.isArray(entryDetail.purchase_items) ? entryDetail.purchase_items : [];
  const fmtMoney = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v ?? "0");
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const pdfPrimaryUnit = (it) => String(it?.uom || it?.item_unit || "").trim();
  const formatPdfQtyValue = (it, field) => {
    const raw = it?.[field];
    if (raw == null || raw === "") return field === "billed_qty" ? "-" : "0";
    const s = String(raw).trim();
    const u = pdfPrimaryUnit(it);
    if (/^-?[\d.,]+\s*$/.test(s)) {
      return u ? `${s} ${u}` : s;
    }
    return s;
  };

  const descColW = Math.max(40, contentW - (12 + 26 + 28 + 28 + 30));
  const itemBody = items.map((it, idx) => [
    String(idx + 1),
    it?.stock_item || "N/A",
    formatPdfQtyValue(it, "actual_qty"),
    formatPdfQtyValue(it, "billed_qty"),
    fmtMoney(it?.rate ?? 0),
    fmtMoney(it?.amount ?? 0),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    ...GRID,
    head: [
      [{ content: "Order Items", colSpan: 6, styles: { ...SECTION_HEAD } }],
      ["#", "Description", "Qty", "Billed Qty", "Rate (Rs.)", "Amount (Rs.)"],
    ],
    body: itemBody.length ? itemBody : [[{ content: "No items", colSpan: 6 }]],
    headStyles: TABLE_HEAD,
    bodyStyles: { fontSize: 8, textColor: BLACK },
    alternateRowStyles: { fillColor: WHITE },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: descColW, halign: "left" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
    },
    didDrawPage: (data) => drawPageFooter(data.pageNumber),
  });

  y = doc.lastAutoTable.finalY + 6;

  const totalAmount = Number(entryDetail.amount || 0);
  const summaryTableW = 72;
  autoTable(doc, {
    startY: y,
    margin: { left: rightX - summaryTableW, right: margin },
    tableWidth: summaryTableW,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      lineColor: BLACK,
      lineWidth: 0.35,
      textColor: BLACK,
    },
    body: [
      [
        {
          content: "Total Amount",
          styles: { fontStyle: "bold", fillColor: SECTION_GRAY, textColor: BLACK },
        },
        {
          content: `Rs. ${fmtMoney(totalAmount)}`,
          styles: { halign: "right", fontStyle: "bold", textColor: BLACK },
        },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 38 },
    },
  });

  y = doc.lastAutoTable.finalY + 8;
  const centerX = pageW / 2;
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const generatedAt =
    [
      String(now.getDate()).padStart(2, "0"),
      String(now.getMonth() + 1).padStart(2, "0"),
      now.getFullYear(),
    ].join("-") +
    ` ${String(hours % 12 || 12).padStart(2, "0")}:${minutes} ${hours >= 12 ? "PM" : "AM"
    }`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text("This is a system-generated purchase order document.", centerX, y, {
    align: "center",
  });
  y += 5;
  doc.text(`Generated at: ${generatedAt}`, centerX, y, { align: "center" });
  y += 5;
  doc.text("Powered by GrainsPro, Developed by MWB Technologies.", centerX, y, {
    align: "center",
  });

  const fileSafeVoucher = String(voucher).replace(/[\\/:*?"<>|]/g, "_");
  doc.save(`purchase-order-${fileSafeVoucher}.pdf`);
}

export async function createPurchaseOrderPdfBlob(params = {}) {
  throw new Error(
    "Purchase order PDF blob export is not available yet. Upload the order PDF URL in the notify dialog, or generate PDF from the Purchase Order screen first."
  )
}

