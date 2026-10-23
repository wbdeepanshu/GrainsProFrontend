const fmtMoney = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtQty = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (value, formatDateFn) => {
  if (!value) return "-";
  if (typeof formatDateFn === "function") return formatDateFn(value);
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return String(value);
  }
};

const getItemName = (item) => {
  if (typeof item?.stock_item === "string") return item.stock_item;
  return item?.stock_item?.name || item?.stock_item_name || item?.item_name || "N/A";
};

const getItemUom = (item) => {
  const ratePerUnit = item?.rate_per_unit ? String(item.rate_per_unit).trim() : "";
  if (ratePerUnit) return ratePerUnit;
  return (
    item?.stock_item?.base_unit?.name
    || item?.base_unit?.name
    || item?.uom
    || "-"
  );
};

const getItemRate = (item) => {
  const ratePerUnit = item?.rate_per_unit
    ? String(item.rate_per_unit).trim().toUpperCase()
    : "";
  const altName = item?.stock_item?.alternate_unit?.name
    ? String(item.stock_item.alternate_unit.name).trim().toUpperCase()
    : "";
  if (ratePerUnit === altName && item?.alternate_rate != null) {
    return parseFloat(item.alternate_rate) || 0;
  }
  return parseFloat(item?.price || item?.rate || 0) || 0;
};

const getItemLineTotal = (item) => {
  if (item?.amount != null && item.amount !== "") {
    return parseFloat(item.amount) || 0;
  }
  if (item?.total != null && item.total !== "") {
    return parseFloat(item.total) || 0;
  }
  const qty = parseFloat(item?.approved_quantity ?? item?.quantity ?? 0) || 0;
  return qty * getItemRate(item);
};

const joinLines = (parts) =>
  parts.filter((p) => p != null && String(p).trim() !== "").join("\n");

const getOrgInfoFromStorage = () => {
  try {
    const raw = localStorage.getItem("cp_org_info");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const chunkPairs = (rows, size = 2) => {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

/** Grayscale theme matching lab/inward PDF reference: black borders, dark text. */
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];
const DARK_GRAY = [85, 85, 85];       // #555 — main table headers
const MEDIUM_GRAY = [153, 153, 153];  // #999 — section / label headers

const LABEL_CELL = {
  fontStyle: "bold",
  fillColor: MEDIUM_GRAY,
  textColor: BLACK,
  fontSize: 8,
  cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 5 },
};

const VALUE_CELL = {
  textColor: BLACK,
  fontSize: 9,
  cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
};

const metaLabelCell = (text) => ({ content: text, styles: { ...LABEL_CELL } });

const metaValueCell = (text, overrides = {}) => ({
  content: String(text ?? "").trim() || "-",
  styles: { ...VALUE_CELL, ...overrides },
});

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
  fillColor: MEDIUM_GRAY,
  textColor: BLACK,
  fontStyle: "bold",
  halign: "left",
  fontSize: 9,
};

const TABLE_HEAD = {
  fillColor: DARK_GRAY,
  textColor: WHITE,
  fontStyle: "bold",
  halign: "center",
  fontSize: 8,
};

/**
 * Generate and download a professional Sales Order PDF with tabular layout.
 */
export async function downloadSalesOrderPdf({
  orderDetail,
  userData,
  branchRecord,
  totalAmount,
  showBillingAmount = false,
  showBrokerage = false,
  hasBilledData = false,
  formatDateFn,
}) {
  if (!orderDetail?.header) {
    throw new Error("Sales order details are not available");
  }

  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF("p", "mm", "a4");

  const header = orderDetail.header;
  const items = Array.isArray(orderDetail.items) ? orderDetail.items : [];

  const org = userData?.organization || userData?.user_info?.organization || {};
  const orgFromStorage = getOrgInfoFromStorage();
  const orgName =
    (orgFromStorage.organization && String(orgFromStorage.organization).trim()) ||
    org?.name ||
    org?.company_name ||
    "";
  const orgAddress =
    (orgFromStorage.organization_address && String(orgFromStorage.organization_address).trim()) ||
    org?.address ||
    org?.registered_address ||
    "";

  const branch = branchRecord || {};
  const branchName =
    (orgFromStorage.branch && String(orgFromStorage.branch).trim()) ||
    header.branch ||
    branch.name ||
    "N/A";
  const branchAddress =
    (orgFromStorage.branch_address && String(orgFromStorage.branch_address).trim()) ||
    branch.address ||
    "";
  const partyName = header.customer_name || "N/A";
  const partyAddress = (header.shipping_address || header.address || "").trim();

  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const rightX = pageW - margin;
  const contentW = pageW - margin * 2;

  const drawPageFooter = (pageNumber) => {
    if (pageNumber > 1) {
      doc.setFontSize(8);
      doc.setTextColor(...BLACK);
      doc.text(
        `Sales Order - ${header.so_number || ""} (page ${pageNumber})`,
        margin,
        pageH - 8
      );
    }
  };

  let y = margin;

  // Title + organization header
  const orgBlock = joinLines([orgName, orgAddress]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, valign: "top", lineWidth: 0, textColor: BLACK },
    body: [
      [
        {
          content: "SALES ORDER",
          styles: {
            fontSize: 18,
            fontStyle: "bold",
            halign: "center",
            textColor: BLACK,
            cellPadding: { top: 0, right: 0, bottom: 4, left: 0 },
          },
        },
      ],
      ...(orgBlock.trim()
        ? [[
          {
            content: orgBlock,
            styles: {
              halign: "center",
              fontSize: 9,
              textColor: BLACK,
              cellPadding: { top: 0, right: 0, bottom: 4, left: 0 },
            },
          },
        ]]
        : []),
    ],
    columnStyles: { 0: { cellWidth: contentW } },
  });

  y = doc.lastAutoTable.finalY + 2;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);
  y += 6;

  // Branch + order information (structured key-value grid)
  const branchBlock = joinLines([branchName, branchAddress]);

  const orderMeta = [
    ["SO Number", header.so_number],
    ["Order Number", header.order_number],
    ["Order Date", fmtDate(header.order_date, formatDateFn)],
    ["Due Date", fmtDate(header.due_date, formatDateFn)],
    ["Status", header.so_status || header.status],
    ["Broker", header.broker_name],
    ["Created By", header.order_by_name],
    ["Credit Type", header.credit_type],
    ["Total Items", header.total_item != null ? String(header.total_item) : ""],
  ].filter(([, value]) => value != null && String(value).trim() !== "");

  const metaRowGroups = chunkPairs(orderMeta, 2);
  const branchColW = contentW * 0.36;
  const orderColW = contentW - branchColW;
  const metaLabelW = orderColW * 0.22;
  const metaValueW = orderColW * 0.28;

  const orderInfoBody = metaRowGroups.map((pair, groupIdx) => {
    const row = [];

    if (groupIdx === 0) {
      row.push({
        content: branchBlock || branchName,
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
        label === "Status" || label === "SO Number"
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
        { content: "Branch Details", styles: { ...SECTION_HEAD } },
        { content: "Order Information", colSpan: 4, styles: { ...SECTION_HEAD } },
      ],
    ],
    body: orderInfoBody,
    columnStyles: {
      0: { cellWidth: branchColW },
      1: { cellWidth: metaLabelW },
      2: { cellWidth: metaValueW },
      3: { cellWidth: metaLabelW },
      4: { cellWidth: metaValueW },
    },
    alternateRowStyles: { fillColor: WHITE },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      // Keep label cells grey even on alternate rows
      if (data.column.index === 1 || data.column.index === 3) {
        data.cell.styles.fillColor = LABEL_CELL.fillColor;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = LABEL_CELL.textColor;
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // Party / delivery address
  const partyBlock = joinLines([
    partyName,
    partyAddress || "No delivery address provided",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    ...GRID,
    head: [["Party / Delivery Address"]],
    body: [[partyBlock]],
    headStyles: { ...SECTION_HEAD },
    columnStyles: { 0: { cellWidth: contentW } },
  });

  y = doc.lastAutoTable.finalY + 6;

  if (header.remarks) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      ...GRID,
      head: [["Remarks"]],
      body: [[String(header.remarks)]],
      headStyles: { ...SECTION_HEAD },
      columnStyles: { 0: { cellWidth: contentW } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Order items
  const tableHead = ["#", "Item", "Ordered", "Approved", "Rate (Rs.)", "UOM", "GST %"];
  if (hasBilledData && showBillingAmount) tableHead.push("Billed");
  if (showBrokerage) tableHead.push("Brokerage");
  tableHead.push("Amount (Rs.)");

  const colCount = tableHead.length;
  const fixedWidths = {
    0: 8,
    2: 16,
    3: 16,
    4: 20,
    5: 14,
    6: 12,
  };
  if (hasBilledData && showBillingAmount) fixedWidths[7] = 14;
  const amountCol = colCount - 1;
  fixedWidths[amountCol] = 24;
  if (showBrokerage) {
    const brokerageCol = hasBilledData && showBillingAmount ? 8 : 7;
    fixedWidths[brokerageCol] = 18;
  }

  let usedWidth = 0;
  Object.values(fixedWidths).forEach((w) => { usedWidth += w; });
  const itemColWidth = Math.max(36, contentW - usedWidth - 2);

  const columnStyles = { 0: { cellWidth: 8, halign: "center" } };
  const rightAlignCols = new Set([2, 3, 4, amountCol]);
  if (showBrokerage) rightAlignCols.add(colCount - 2);

  tableHead.forEach((_, idx) => {
    if (idx === 0) return;
    if (idx === 1) {
      columnStyles[1] = { cellWidth: itemColWidth, halign: "left" };
      return;
    }
    if (fixedWidths[idx]) {
      columnStyles[idx] = {
        cellWidth: fixedWidths[idx],
        halign: rightAlignCols.has(idx) ? "right" : "center",
      };
    }
  });

  const itemBody = items.map((item, idx) => {
    const row = [
      String(idx + 1),
      getItemName(item),
      fmtQty(item.quantity),
      fmtQty(item.approved_quantity ?? item.quantity),
      fmtMoney(getItemRate(item)),
      getItemUom(item),
      item.gst_percent != null && item.gst_percent !== "" ? String(item.gst_percent) : "-",
    ];
    if (hasBilledData && showBillingAmount) {
      row.push(item.billed_quantity != null ? fmtQty(item.billed_quantity) : "-");
    }
    if (showBrokerage) {
      row.push(item.brokerage_amount != null ? fmtMoney(item.brokerage_amount) : "-");
    }
    row.push(fmtMoney(getItemLineTotal(item)));
    return row;
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    ...GRID,
    head: [
      [{ content: "Order Items", colSpan: colCount, styles: { ...SECTION_HEAD } }],
      tableHead,
    ],
    body: itemBody.length ? itemBody : [[{ content: "No items found", colSpan: colCount }]],
    headStyles: TABLE_HEAD,
    bodyStyles: { fontSize: 8, textColor: BLACK },
    alternateRowStyles: { fillColor: WHITE },
    columnStyles,
    didDrawPage: (data) => drawPageFooter(data.pageNumber),
  });

  y = doc.lastAutoTable.finalY + 6;

  // Summary totals
  const resolvedTotal =
    totalAmount != null ? Number(totalAmount) : Number(header.amount || 0);

  const summaryRows = [["Total Amount", `Rs. ${fmtMoney(resolvedTotal)}`]];
  if (showBillingAmount && header.billing_amount) {
    summaryRows.push(["Billing Amount", `Rs. ${fmtMoney(header.billing_amount)}`]);
  }

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
    body: summaryRows.map(([label, value]) => [
      {
        content: label,
        styles: { fontStyle: "bold", fillColor: MEDIUM_GRAY, textColor: BLACK },
      },
      {
        content: value,
        styles: { halign: "right", fontStyle: "bold", textColor: BLACK },
      },
    ]),
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
    ` ${String(hours % 12 || 12).padStart(2, "0")}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
    
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text("This is a system-generated sales order document.", centerX, y, { align: "center" });
  y += 5;
  doc.text(`Generated at: ${generatedAt}`, centerX, y, { align: "center" });
  y += 5;
  doc.text("Powered by GrainsPro, Developed by MWB Technologies.", centerX, y, {
    align: "center",
  });

  const fileName = `sales-order-${header.so_number || "document"}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

export async function createSalesOrderPdfBlob(params = {}) {
  throw new Error(
    "Sales order PDF blob export is not available yet. Upload the order PDF URL in the notify dialog, or generate PDF from the Sales Order screen first."
  )
}

