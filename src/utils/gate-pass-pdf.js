import { fetchOrgInfo, getOrgInfoSync } from "@/lib/orgInfo";

/**
 * Generate Gate Pass PDF in Delivery Note format
 * @param {Object} detailsData - Gate Pass details data
 * @param {Function} toast - Toast notification function
 * @returns {Promise<void>}
 */
export const generateGatePassPDF = async (detailsData, toast) => {
  try {
    // Dynamically import jsPDF
    const { default: jsPDF } = await import('jspdf');

    // Validate data exists
    if (!detailsData) {
      throw new Error('No data available to generate PDF');
    }

    // Load organization/branch from cache or dashboard API
    let orgName = getOrgInfoSync()?.organization || '';
    let branchName = getOrgInfoSync()?.branch || '';
    if (!orgName || !branchName) {
      const fetched = await fetchOrgInfo();
      orgName = fetched?.organization || orgName;
      branchName = fetched?.branch || branchName;
    }

    // Initialize PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10; // Margin on all sides
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredHeight) => {
      if (currentY + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
        return true;
      }
      return false;
    };

    // Helper function to format date
    const formatDate = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        return `${day}-${month}-${year}`;
      } catch (e) {
        return dateString;
      }
    };

    // Helper function to add text
    const addText = (text, x, y, fontSize = 10, isBold = false, align = 'left') => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.text(String(text || ''), x, y, { align });
    };

    // Helper function to draw table cell
    const drawCell = (text, x, y, width, height, fontSize = 10, isBold = false, align = 'left', border = true) => {
      if (border) {
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.1);
        pdf.rect(x, y, width, height);
      }
      
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      // Handle text wrapping
      const lines = pdf.splitTextToSize(String(text || ''), width - 2);
      const lineHeight = fontSize * 0.4;
      const startY = y + (height / 2) - ((lines.length - 1) * lineHeight / 2) + 2;
      
      lines.forEach((line, index) => {
        let xPos = x + 2;
        if (align === 'center') {
          xPos = x + (width / 2);
        } else if (align === 'right') {
          xPos = x + width - 2;
        }
        pdf.text(line, xPos, startY + (index * lineHeight), { align });
      });
    };

    // Header: DELIVERY NOTE
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DELIVERY NOTE', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // First table: Company info and Delivery Note details
    const table1Y = currentY;
    const col1Width = contentWidth * 0.5; // 50%
    const col2Width = contentWidth * 0.25; // 25%
    const col3Width = contentWidth * 0.25; // 25%
    
    // Add company details (you may need to get these from organization settings)
    // Declare companyDetails first before using it
    const companyDetails = [
      'FSSAI 11215413800004S',
      'Ph: 9164800424, 9164800425',
      'CIN NO. U01410KA2006PTC120',
      'State Name: Karnataka, Code: 29',
      'GSTIN:29AABCW4850C1ZD',
      'PAN:AABCW4850C',
      'Contact: +91-7022261913, 7022261915',
      'E-Mail: purchase@wbvenki@gmail.com',
      'www.mothersindia.in'
    ];
    
    // Calculate dynamic row height based on content
    const estimatedCompanyHeight = 9 + (companyDetails.length * 3.5) + 5; // Company info + details + padding
    const row1Height = Math.max(50, estimatedCompanyHeight);

    // Company Information (Left column)
    let companyInfo = orgName || 'W B Agro Products Pvt Ltd.';
    if (branchName) {
      companyInfo += `\n(${branchName})`;
    }
    companyInfo += `\nPLOT NO 113 TO 116 & 86 TO 89, INDUSTRIAL AREA, RAYAPUR,\nDHARWAD-580009`;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companyInfo.split('\n')[0], margin + 2, table1Y + 5, { align: 'left' });
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const companyLines = pdf.splitTextToSize(companyInfo, col1Width - 6);
    let companyY = table1Y + 9;
    companyLines.forEach((line, index) => {
      if (index > 0) {
        pdf.text(line, margin + 2, companyY, { align: 'left' });
        companyY += 3.5;
      }
    });

    // Start company details after company info with proper spacing
    let detailY = companyY + 2;
    companyDetails.forEach((detail, index) => {
      pdf.setFontSize(7);
      // Wrap long details if needed
      const detailLines = pdf.splitTextToSize(detail, col1Width - 6);
      detailLines.forEach((line, lineIndex) => {
        pdf.text(line, margin + 2, detailY + (lineIndex * 3), { align: 'left' });
      });
      detailY += (detailLines.length * 3) + 0.5;
    });

    // Delivery Note details (Middle and Right columns)
    const deliveryNoteNo = detailsData.bill_no || 'N/A';
    const deliveryDate = formatDate(detailsData.date);
    const referenceNo = detailsData.bill_no || '';
    const referenceDate = formatDate(detailsData.date);
    const buyerOrderNo = detailsData.sales_orders?.[0]?.so_number || detailsData.sales_orders?.[0]?.order_id || '';
    const buyerOrderDate = formatDate(detailsData.sales_orders?.[0]?.order_date);
    const dispatchDocNo = detailsData.bill_no || '';
    const vehicleNo = detailsData.vehicle_no || 'N/A';
    const destination = branchName || 'RAYAPUR';

    // Middle column - with proper spacing to avoid overlap
    let midX = margin + col1Width;
    let midY = table1Y + 4;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Delivery Note No.', midX + 2, midY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const deliveryNoteLines = pdf.splitTextToSize(deliveryNoteNo, col2Width - 4);
    deliveryNoteLines.forEach((line, index) => {
      pdf.text(line, midX + 2, midY + 4 + (index * 3.5), { align: 'left' });
    });
    midY += 4 + (deliveryNoteLines.length * 3.5) + 2;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Reference No. & Date', midX + 2, midY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    const refLines = pdf.splitTextToSize(`${referenceNo}/DT dt ${referenceDate}`, col2Width - 4);
    refLines.forEach((line, index) => {
      pdf.text(line, midX + 2, midY + 3.5 + (index * 3), { align: 'left' });
    });
    midY += 3.5 + (refLines.length * 3) + 1.5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Buyer\'s Order No.', midX + 2, midY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    const buyerOrderLines = pdf.splitTextToSize(`${buyerOrderNo}/DT/${buyerOrderDate}`, col2Width - 4);
    buyerOrderLines.forEach((line, index) => {
      pdf.text(line, midX + 2, midY + 3.5 + (index * 3), { align: 'left' });
    });
    midY += 3.5 + (buyerOrderLines.length * 3) + 1.5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Dispatch Doc No.', midX + 2, midY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    const dispatchLines = pdf.splitTextToSize(dispatchDocNo, col2Width - 4);
    dispatchLines.forEach((line, index) => {
      pdf.text(line, midX + 2, midY + 3.5 + (index * 3), { align: 'left' });
    });
    midY += 3.5 + (dispatchLines.length * 3) + 1.5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Dispatched through', midX + 2, midY, { align: 'left' });

    // Right column - with proper spacing to avoid overlap
    let rightX = margin + col1Width + col2Width;
    let rightY = table1Y + 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Dated', rightX + 2, rightY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(deliveryDate, rightX + 2, rightY + 4, { align: 'left' });
    rightY += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Other Reference', rightX + 2, rightY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text('DIRECT', rightX + 2, rightY + 3.5, { align: 'left' });
    rightY += 7;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Dated', rightX + 2, rightY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(buyerOrderDate, rightX + 2, rightY + 3.5, { align: 'left' });
    rightY += 7;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Destination', rightX + 2, rightY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    const destLines = pdf.splitTextToSize(destination, col3Width - 4);
    destLines.forEach((line, index) => {
      pdf.text(line, rightX + 2, rightY + 3.5 + (index * 3), { align: 'left' });
    });

    // Draw table borders
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    pdf.rect(margin, table1Y, col1Width, row1Height);
    pdf.rect(margin + col1Width, table1Y, col2Width, row1Height);
    pdf.rect(margin + col1Width + col2Width, table1Y, col3Width, row1Height);
    pdf.line(margin, table1Y, margin + contentWidth, table1Y);
    pdf.line(margin, table1Y + row1Height, margin + contentWidth, table1Y + row1Height);

    currentY = table1Y + row1Height + 5;

    // Second table: Consignee and Vehicle info
    const table2Y = currentY;
    // Calculate dynamic row height - will be updated after content is placed
    let row2Height = 40;
    const consigneeColWidth = contentWidth * 0.5;
    const vehicleColWidth = contentWidth * 0.25;

    // Get customer/party info from first sales order
    const firstSO = detailsData.sales_orders?.[0];
    const customerName = firstSO?.customer_name || orgName || 'N/A';
    const customerAddress = firstSO?.customer_address || 'N/A';
    const customerGST = firstSO?.gst_number || '29AABCW4850C1ZD';
    const customerPAN = firstSO?.pan_number || 'AABCW4850C';
    const customerState = firstSO?.state || 'Karnataka';
    const customerCode = firstSO?.state_code || '29';
    const customerContact = firstSO?.contact_number || '+91-7022261913, 7022261915';

    // Consignee (Ship to) - Left side with proper spacing
    let consigneeY = table2Y + 4;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Consignee (Ship to)', margin + 2, consigneeY, { align: 'left' });
    consigneeY += 4;
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const customerNameLines = pdf.splitTextToSize(customerName, consigneeColWidth - 4);
    customerNameLines.forEach((line, index) => {
      pdf.text(line, margin + 2, consigneeY + (index * 3.5), { align: 'left' });
    });
    consigneeY += (customerNameLines.length * 3.5) + 1;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const addressLines = pdf.splitTextToSize(customerAddress, consigneeColWidth - 4);
    addressLines.forEach((line, index) => {
      pdf.text(line, margin + 2, consigneeY + (index * 3), { align: 'left' });
    });
    consigneeY += (addressLines.length * 3) + 1;
    
    pdf.setFontSize(7);
    pdf.text(`${customerState} - ${firstSO?.pincode || '580009'}, India`, margin + 2, consigneeY, { align: 'left' });
    consigneeY += 3;
    pdf.text(`GSTIN/UIN: ${customerGST}`, margin + 2, consigneeY, { align: 'left' });
    consigneeY += 3;
    pdf.text(`PAN/IT No: ${customerPAN}`, margin + 2, consigneeY, { align: 'left' });
    consigneeY += 3;
    pdf.text(`State Name: ${customerState}, Code: ${customerCode}`, margin + 2, consigneeY, { align: 'left' });
    consigneeY += 3;
    pdf.text(`Contact: ${customerContact}`, margin + 2, consigneeY, { align: 'left' });
    
    // Calculate actual consignee height
    const consigneeHeight = consigneeY - table2Y + 4;

    // Bill of Lading and Vehicle No - Right side
    const billOfLadingX = margin + consigneeColWidth;
    let billY = table2Y + 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Bill of Lading/LR-RR No.', billOfLadingX + 2, billY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(`dt. ${deliveryDate}`, billOfLadingX + 2, billY + 3.5, { align: 'left' });

    const vehicleX = margin + consigneeColWidth + vehicleColWidth;
    let vehicleY = table2Y + 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Motor Vehicle No.', vehicleX + 2, vehicleY, { align: 'left' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    const vehicleLines = pdf.splitTextToSize(vehicleNo, vehicleColWidth - 4);
    vehicleLines.forEach((line, index) => {
      pdf.text(line, vehicleX + 2, vehicleY + 3.5 + (index * 3), { align: 'left' });
    });
    
    // Update row height to fit content
    row2Height = Math.max(row2Height, consigneeHeight, 20);

    // Draw table borders
    pdf.rect(margin, table2Y, consigneeColWidth, row2Height);
    pdf.rect(margin + consigneeColWidth, table2Y, vehicleColWidth, row2Height);
    pdf.rect(margin + consigneeColWidth + vehicleColWidth, table2Y, vehicleColWidth, row2Height);
    pdf.line(margin, table2Y, margin + contentWidth, table2Y);
    pdf.line(margin, table2Y + row2Height, margin + contentWidth, table2Y + row2Height);

    currentY = table2Y + row2Height + 5;

    // Third table: Buyer (Bill to) with proper spacing
    const table3Y = currentY;
    // Calculate dynamic row height - will be updated after content is placed
    let row3Height = 35;
    
    let buyerY = table3Y + 4;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Buyer (Bill to)', margin + 2, buyerY, { align: 'left' });
    buyerY += 4;
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const buyerNameLines = pdf.splitTextToSize(customerName, consigneeColWidth - 4);
    buyerNameLines.forEach((line, index) => {
      pdf.text(line, margin + 2, buyerY + (index * 3.5), { align: 'left' });
    });
    buyerY += (buyerNameLines.length * 3.5) + 1;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const buyerAddressLines = pdf.splitTextToSize(customerAddress, consigneeColWidth - 4);
    buyerAddressLines.forEach((line, index) => {
      pdf.text(line, margin + 2, buyerY + (index * 3), { align: 'left' });
    });
    buyerY += (buyerAddressLines.length * 3) + 1;
    
    pdf.setFontSize(7);
    pdf.text(`${customerState} - ${firstSO?.pincode || '580009'}, India`, margin + 2, buyerY, { align: 'left' });
    buyerY += 3;
    pdf.text(`GSTIN/UIN: ${customerGST}`, margin + 2, buyerY, { align: 'left' });
    buyerY += 3;
    pdf.text(`PAN/IT No: ${customerPAN}`, margin + 2, buyerY, { align: 'left' });
    buyerY += 3;
    pdf.text(`State Name: ${customerState}, Code: ${customerCode}`, margin + 2, buyerY, { align: 'left' });
    buyerY += 3;
    pdf.text(`Place of Supply: ${customerState}`, margin + 2, buyerY, { align: 'left' });
    buyerY += 3;
    pdf.text(`Contact: ${customerContact}`, margin + 2, buyerY, { align: 'left' });
    
    // Calculate actual buyer height
    const buyerHeight = buyerY - table3Y + 4;
    row3Height = Math.max(row3Height, buyerHeight);

    // Draw table border
    pdf.rect(margin, table3Y, contentWidth, row3Height);
    pdf.line(margin, table3Y, margin + contentWidth, table3Y);
    pdf.line(margin, table3Y + row3Height, margin + contentWidth, table3Y + row3Height);

    currentY = table3Y + row3Height + 5;

    // Items table
    checkPageBreak(60);
    const itemsTableY = currentY;
    const itemRowHeight = 8;
    const headerHeight = 6;

    // Table headers
    const colWidths = [
      contentWidth * 0.05,  // SI No
      contentWidth * 0.35,  // Description
      contentWidth * 0.10,  // HSN/SAC
      contentWidth * 0.08,  // GST Rate
      contentWidth * 0.10,  // Alt. Quantity
      contentWidth * 0.10,  // Quantity
      contentWidth * 0.10,  // Rate
      contentWidth * 0.12   // per
    ];

    // Collect all items from all sales orders
    const allItems = [];
    if (detailsData.sales_orders) {
      detailsData.sales_orders.forEach((soGroup) => {
        if (soGroup.items) {
          soGroup.items.forEach((item) => {
            allItems.push(item);
          });
        }
      });
    }

    // Only draw table if there are items
    if (allItems.length === 0) {
      pdf.setFontSize(10);
      pdf.text('No items found', margin, currentY, { align: 'left' });
      currentY += 10;
    } else {
      // Draw header row
      let headerX = margin;
      const headers = ['SI\nNo.', 'Description of Goods', 'HSN/SAC', 'GST\nRate', 'Alt. Quantity', 'Quantity', 'Rate', 'per'];
      headers.forEach((header, index) => {
        drawCell(header, headerX, itemsTableY, colWidths[index], headerHeight, 8, true, 'center');
        headerX += colWidths[index];
      });

      currentY = itemsTableY + headerHeight;

      // Calculate totals
      let totalAltQty = 0;
      let totalQty = 0;
      let totalTaxableValue = 0;

      // Items rows - only for actual items
      allItems.forEach((item, index) => {
        checkPageBreak(itemRowHeight);
        
        const itemRowY = currentY;
        let cellX = margin;

        // SI No
        drawCell(String(index + 1), cellX, itemRowY, colWidths[0], itemRowHeight, 8, false, 'center');
        cellX += colWidths[0];

        // Description
        drawCell(item.item_name || 'N/A', cellX, itemRowY, colWidths[1], itemRowHeight, 8, false, 'left');
        cellX += colWidths[1];

        // HSN/SAC (you may need to get this from item data)
        const hsnCode = item.hsn_code || item.hsn || '07133990';
        drawCell(hsnCode, cellX, itemRowY, colWidths[2], itemRowHeight, 8, false, 'center');
        cellX += colWidths[2];

        // GST Rate
        const gstRate = item.gst_percentage ? `${item.gst_percentage}%` : '0%';
        drawCell(gstRate, cellX, itemRowY, colWidths[3], itemRowHeight, 8, false, 'center');
        cellX += colWidths[3];

        // Alt. Quantity (in qtl - you may need to calculate this)
        const altQty = parseFloat(item.loaded_quantity || item.loaded_bags || 0) / 100; // Assuming conversion
        const altQtyText = `${altQty.toFixed(3)} qtl`;
        drawCell(altQtyText, cellX, itemRowY, colWidths[4], itemRowHeight, 8, false, 'center');
        totalAltQty += altQty;
        cellX += colWidths[4];

        // Quantity (in packets/bags)
        const qty = parseFloat(item.loaded_quantity || item.loaded_bags || 0);
        const qtyUnit = item.base_unit?.name || 'pkt';
        const qtyText = `${qty.toFixed(2)} ${qtyUnit}`;
        drawCell(qtyText, cellX, itemRowY, colWidths[5], itemRowHeight, 8, false, 'center');
        totalQty += qty;
        cellX += colWidths[5];

        // Rate
        const rate = parseFloat(item.rate || item.price || 0);
        const rateText = rate > 0 ? rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
        drawCell(rateText, cellX, itemRowY, colWidths[6], itemRowHeight, 8, false, 'center');
        cellX += colWidths[6];

        // per
        const perUnit = item.base_unit?.name || 'qtl';
        drawCell(perUnit, cellX, itemRowY, colWidths[7], itemRowHeight, 8, false, 'center');

        // Calculate taxable value
        totalTaxableValue += (altQty * rate);

        currentY += itemRowHeight;
      });

      // Draw table outer borders
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      // Top border
      pdf.line(margin, itemsTableY, margin + contentWidth, itemsTableY);
      // Bottom border (before total row)
      pdf.line(margin, currentY, margin + contentWidth, currentY);
      // Left border
      pdf.line(margin, itemsTableY, margin, currentY);
      // Right border
      pdf.line(margin + contentWidth, itemsTableY, margin + contentWidth, currentY);
      
      // Draw vertical lines between columns
      let colX = margin;
      colWidths.forEach((width) => {
        colX += width;
        pdf.line(colX, itemsTableY, colX, currentY);
      });
      
      // Draw horizontal lines between rows
      let rowY = itemsTableY + headerHeight;
      allItems.forEach(() => {
        pdf.line(margin, rowY, margin + contentWidth, rowY);
        rowY += itemRowHeight;
      });

      // Total row - only if there are items
      checkPageBreak(itemRowHeight);
      const totalRowY = currentY;
      let totalCellX = margin;
      
      // Total label spans first 4 columns
      const totalLabelWidth = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
      drawCell('Total', totalCellX, totalRowY, totalLabelWidth, itemRowHeight, 8, true, 'center');
      totalCellX += totalLabelWidth;

      // Total Alt Quantity
      drawCell(`${totalAltQty.toFixed(3)} qtl`, totalCellX, totalRowY, colWidths[4], itemRowHeight, 8, true, 'center');
      totalCellX += colWidths[4];

      // Total Quantity
      drawCell(`${totalQty.toFixed(2)} pkt`, totalCellX, totalRowY, colWidths[5], itemRowHeight, 8, true, 'center');
      totalCellX += colWidths[5];

      // Empty cells for Rate and per
      pdf.rect(totalCellX, totalRowY, colWidths[6], itemRowHeight);
      totalCellX += colWidths[6];
      pdf.rect(totalCellX, totalRowY, colWidths[7], itemRowHeight);

      // Draw borders for total row
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      pdf.line(margin, totalRowY, margin + contentWidth, totalRowY);
      pdf.line(margin, totalRowY + itemRowHeight, margin + contentWidth, totalRowY + itemRowHeight);
      // Vertical lines for total row
      let totalColX = margin;
      colWidths.forEach((width) => {
        totalColX += width;
        pdf.line(totalColX, totalRowY, totalColX, totalRowY + itemRowHeight);
      });

      currentY = totalRowY + itemRowHeight + 5;

      // HSN/SAC and Taxable Value table - only if there are items
      // Note: totalTaxableValue is already calculated above
      checkPageBreak(20);
      const taxTableY = currentY;
      const taxRowHeight = 6;

      // HSN/SAC column (60%)
      const hsnColWidth = contentWidth * 0.6;
      const taxColWidth = contentWidth * 0.4;

      // Get unique HSN codes
      const uniqueHSN = [...new Set(allItems.map(item => item.hsn_code || item.hsn || '07133990'))];

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('HSN/SAC', margin + 2, taxTableY + 4, { align: 'left' });
      pdf.text('E. & O.E', margin + hsnColWidth + 2, taxTableY + 2, { align: 'right' });
      pdf.text('Taxable\nValue', margin + hsnColWidth + 2, taxTableY + 4, { align: 'right' });

      pdf.rect(margin, taxTableY, hsnColWidth, taxRowHeight);
      pdf.rect(margin + hsnColWidth, taxTableY, taxColWidth, taxRowHeight);
      currentY = taxTableY + taxRowHeight;

      // HSN rows - only for unique HSN codes
      uniqueHSN.forEach((hsn) => {
        checkPageBreak(taxRowHeight);
        pdf.rect(margin, currentY, hsnColWidth, taxRowHeight);
        pdf.rect(margin + hsnColWidth, currentY, taxColWidth, taxRowHeight);
        
        pdf.setFont('helvetica', 'normal');
        pdf.text(hsn, margin + 2, currentY + 4, { align: 'left' });
        
        // Calculate taxable value for this HSN
        const hsnTaxableValue = allItems
          .filter(item => (item.hsn_code || item.hsn || '07133990') === hsn)
          .reduce((sum, item) => {
            const altQty = parseFloat(item.loaded_quantity || item.loaded_bags || 0) / 100;
            const rate = parseFloat(item.rate || item.price || 0);
            return sum + (altQty * rate);
          }, 0);
        
        pdf.text(hsnTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
          margin + hsnColWidth + 2, currentY + 4, { align: 'right' });
        
        currentY += taxRowHeight;
      });

      // Total row
      checkPageBreak(taxRowHeight);
      pdf.rect(margin, currentY, hsnColWidth, taxRowHeight);
      pdf.rect(margin + hsnColWidth, currentY, taxColWidth, taxRowHeight);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Total', margin + hsnColWidth + 2, currentY + 4, { align: 'right' });
      
      currentY += taxRowHeight;
      
      // Total value row
      checkPageBreak(taxRowHeight);
      pdf.rect(margin, currentY, hsnColWidth, taxRowHeight);
      pdf.rect(margin + hsnColWidth, currentY, taxColWidth, taxRowHeight);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
        margin + hsnColWidth + 2, currentY + 4, { align: 'right' });
      
      currentY += taxRowHeight + 5;
    }

    // Footer table: Remarks and Signature
    checkPageBreak(40);
    const footerTableY = currentY;
    const footerRowHeight = 35;
    const footerColWidth = contentWidth * 0.5;

    // Left side: Remarks
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Tax Amount (in words): NIL', margin + 2, footerTableY + 5, { align: 'left' });
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Remarks:', margin + 2, footerTableY + 10, { align: 'left' });
    
    pdf.setFont('helvetica', 'normal');
    const remarks = `TO LORRY NO: ${vehicleNo}`;
    pdf.text(remarks, margin + 2, footerTableY + 14, { align: 'left' });
    
    pdf.text('Company\'s VAT TIN: 29401182028', margin + 2, footerTableY + 20, { align: 'left' });
    pdf.text('Company\'s CST No.: 29401182028', margin + 2, footerTableY + 23.5, { align: 'left' });
    pdf.text(`Company's PAN: ${customerPAN}`, margin + 2, footerTableY + 27, { align: 'left' });
    pdf.text('Rood. in Good Condition', margin + 2, footerTableY + 30.5, { align: 'left' });

    // Right side: Signature
    pdf.setFont('helvetica', 'normal');
    pdf.text('for W B Agro Products Pvt Ltd', margin + footerColWidth + 2, footerTableY + 25, { align: 'right' });
    pdf.text('Authorised Signatory', margin + footerColWidth + 2, footerTableY + 30, { align: 'right' });

    // Draw footer borders
    pdf.rect(margin, footerTableY, footerColWidth, footerRowHeight);
    pdf.rect(margin + footerColWidth, footerTableY, footerColWidth, footerRowHeight);
    pdf.line(margin, footerTableY, margin + contentWidth, footerTableY);
    pdf.line(margin, footerTableY + footerRowHeight, margin + contentWidth, footerTableY + footerRowHeight);

    currentY = footerTableY + footerRowHeight + 5;

    // Final footer text
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('SUBJECT TO RAYAPUR-DHARAWADA JURISDICTION', pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
    pdf.text('This is a Computer Generated Document', pageWidth / 2, currentY, { align: 'center' });

    // Download the PDF
    const fileName = `gate-pass-${deliveryNoteNo}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    toast({
      title: "PDF Downloaded",
      description: "Gate Pass has been downloaded as PDF",
      className: "bg-green-50 border-green-100 text-green-800",
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast({
      title: "Error",
      description: error?.message || "Failed to generate PDF. Please try again.",
      variant: "destructive",
    });
    throw error;
  }
};

