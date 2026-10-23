/**
 * Build a delivery-note / sales-invoice PDF blob for WhatsApp notify upload.
 * Uses the same jsPDF approach as the delivery-notes download path.
 */
export async function createDeliveryNotePdfBlob(detail = {}, options = {}) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");

  const party = detail.party || detail.party_info || {};
  const org =
    detail.organization ||
    detail.organization_details ||
    detail.organization_info ||
    options.branchDetail ||
    {};
  const items = Array.isArray(detail.items) ? detail.items : [];
  const invoiceNo =
    String(detail.invoice_number || "").trim() ||
    String(detail.outward_number || "").trim() ||
    String(detail.order_id || detail.so_number || detail.id || "note");
  const fileName = `sales-invoice-${invoiceNo}-${new Date().toISOString().split("T")[0]}.pdf`;

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  const line = (text, size = 11, style = "normal") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(30, 30, 30);
    const lines = pdf.splitTextToSize(String(text || ""), pageWidth - margin * 2);
    lines.forEach((row) => {
      if (y > 280) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(row, margin, y);
      y += size * 0.45 + 2;
    });
  };

  line(org.name || org.company_name || "Organization", 14, "bold");
  line("SALES INVOICE / DELIVERY NOTE", 12, "bold");
  y += 2;
  line(`Invoice / Ref: ${invoiceNo}`);
  line(
    `Date: ${detail.invoice_date || detail.outward_date_display || detail.outward_date || detail.order_date || "—"}`,
  );
  y += 2;
  line(
    `Customer: ${party.customer_name || party.name || detail.party_name || detail.customer_name || "Customer"}`,
    11,
    "bold",
  );
  if (party.contact_number || party.whatsapp_number) {
    line(`Contact: ${party.whatsapp_number || party.contact_number}`);
  }
  if (party.address) line(`Address: ${party.address}`);
  y += 4;

  if (items.length) {
    line("Items", 12, "bold");
    items.forEach((item, idx) => {
      const name =
        item.item_name ||
        item.stock_item_name ||
        item.stock_item?.name ||
        item.name ||
        `Item ${idx + 1}`;
      const qty = item.loaded_quantity ?? item.quantity ?? item.billed_quantity ?? "";
      const amount = item.amount ?? item.net_amount ?? item.total_amount ?? "";
      line(`${idx + 1}. ${name}  |  Qty: ${qty}  |  Amt: ${amount}`);
    });
    y += 2;
  }

  if (detail.total_amount != null || detail.net_total_amount != null) {
    line(
      `Total: ${detail.net_total_amount ?? detail.total_amount}`,
      12,
      "bold",
    );
  }

  y += 6;
  line(`Generated ${new Date().toLocaleString()}`, 9);

  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  return { blob, fileName, blobUrl };
}
