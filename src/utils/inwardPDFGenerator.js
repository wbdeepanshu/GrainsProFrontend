import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Professional PDF Generator for Inward Details
 * Handles images, tables, and layout with proper formatting
 */
export class InwardPDFGenerator {
  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
    this.margin = 20;
    this.contentWidth = this.pageWidth - (this.margin * 2);
    this.yPosition = 20;
    this.lineHeight = 6;
    this.sectionSpacing = 15;
  }

  /**
   * Wait for all images to load completely
   */
  async waitForAllImages() {
    try {
      const images = document.querySelectorAll('img');
      // console.log(`Found ${images.length} images on page`);
      
      if (images.length === 0) {
        // console.log('No images found, skipping image loading');
        return;
      }

      const imagePromises = Array.from(images).map((img, index) => {
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`Image ${index + 1} load timeout: ${img.src}`);
            resolve(); // Continue even if timeout
          }, 5000); // 5 second timeout per image

          if (img.complete && img.naturalHeight !== 0) {
            clearTimeout(timeout);
            // console.log(`Image ${index + 1} already loaded: ${img.src}`);
            resolve();
          } else {
            img.onload = () => {
              clearTimeout(timeout);
              // console.log(`Image ${index + 1} loaded successfully: ${img.src}`);
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              console.warn(`Image ${index + 1} failed to load: ${img.src}`);
              resolve(); // Continue even if image fails
            };
          }
        });
      });

      await Promise.all(imagePromises);
      // console.log(`Completed waiting for ${images.length} images`);
    } catch (error) {
      console.error('Error in waitForAllImages:', error);
      // Don't throw error, just log and continue
    }
  }

  /**
   * Load image and convert to base64
   */
  async loadImageAsBase64(imageUrl) {
    try {
      // console.log('Loading image:', imageUrl);
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('Image load timeout:', imageUrl);
          resolve(null);
        }, 10000);

        img.onload = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set reasonable max dimensions
            const maxWidth = 400;
            const maxHeight = 400;
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width *= ratio;
              height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            resolve({ dataURL, width, height });
          } catch (error) {
            console.error('Canvas error:', error);
            resolve(null);
          }
        };

        img.onerror = () => {
          clearTimeout(timeout);
          console.error('Image load error:', imageUrl);
          resolve(null);
        };

        img.src = imageUrl;
      });
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
  }

  /**
   * Add text with word wrapping
   */
  addText(text, x, y, options = {}) {
    const { fontSize = 10, fontStyle = 'normal', color = '#000000', maxWidth = this.contentWidth } = options;
    this.pdf.setFontSize(fontSize);
    this.pdf.setFont('helvetica', fontStyle);
    this.pdf.setTextColor(color);
    
    const lines = this.pdf.splitTextToSize(text, maxWidth);
    this.pdf.text(lines, x, y);
    return y + (lines.length * fontSize * 0.35); // Reduced line height for better spacing
  }

  /**
   * Add a new page if needed
   */
  checkNewPage(requiredHeight = 20) {
    if (this.yPosition + requiredHeight > this.pageHeight - this.margin) {
      this.pdf.addPage();
      this.yPosition = this.margin;
      return true;
    }
    return false;
  }

  /**
   * Add a horizontal line
   */
  addLine(x = this.margin, y = null, width = this.contentWidth) {
    if (y === null) y = this.yPosition;
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.line(x, y, x + width, y);
    this.yPosition = y + 2; // Reduced spacing after line
  }

  /**
   * Add section header with proper alignment
   */
  addSectionHeader(title, fontSize = 14) {
    this.checkNewPage(15);
    
    // Add the title
    this.yPosition = this.addText(title, this.margin, this.yPosition, { 
      fontSize, 
      fontStyle: 'bold',
      color: '#1f2937'
    });
    
    // Add consistent spacing between title and table
    this.yPosition += 4;
    
    // Add a subtle line under the title for better visual connection
    this.addLine();
  }

  /**
   * Add images in a grid layout (3 per row)
   */
  async addImageGrid(images, title = 'Images') {
    if (!images || images.length === 0) return;

    this.addSectionHeader(title);
    
    const imagesPerRow = 3;
    const imageWidth = 50;
    const imageHeight = 50;
    const imageSpacing = 10;
    const rowSpacing = 60;

    for (let i = 0; i < images.length; i += imagesPerRow) {
      this.checkNewPage(rowSpacing);
      
      const rowImages = images.slice(i, i + imagesPerRow);
      
      // Add images in current row
      for (let j = 0; j < rowImages.length; j++) {
        const image = rowImages[j];
        const x = this.margin + (j * (imageWidth + imageSpacing));
        
        if (image && image.image_url) {
          try {
            const imageData = await this.loadImageAsBase64(image.image_url);
            if (imageData) {
              this.pdf.addImage(
                imageData.dataURL,
                'JPEG',
                x,
                this.yPosition,
                imageWidth,
                imageHeight
              );
              
              // Add image label
              const label = image.type_display || image.type || `Image ${i + j + 1}`;
              this.addText(label, x, this.yPosition + imageHeight + 3, {
                fontSize: 8,
                color: '#666666',
                maxWidth: imageWidth
              });
            } else {
              this.addText(`[Failed to load]`, x, this.yPosition, { fontSize: 8, color: '#999999' });
            }
          } catch (error) {
            console.error('Error adding image:', error);
            this.addText(`[Error]`, x, this.yPosition, { fontSize: 8, color: '#999999' });
          }
        }
      }
      
      this.yPosition += rowSpacing;
    }
  }

  /**
   * Add a table using jspdf-autotable with proper alignment
   */
  addTable(data, columns, title = null) {
    if (title) {
      this.addSectionHeader(title);
    }

    this.checkNewPage(50);
    
    try {
      autoTable(this.pdf, {
        startY: this.yPosition,
        head: columns.length > 0 ? [columns] : undefined,
        body: data,
        theme: 'grid',
        headStyles: {
          fillColor: [31, 41, 55],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 4,
          halign: 'left'
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          fontSize: 8,
          cellPadding: 4,
          halign: 'left'
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        margin: { left: this.margin, right: this.margin },
        tableWidth: 'auto',
        columnWidth: 'auto',
        showHead: columns.length > 0,
        styles: {
          halign: 'left'
        }
      });

      this.yPosition = this.pdf.lastAutoTable.finalY + 5; // Consistent spacing after table
    } catch (error) {
      console.error('Error creating table with autoTable:', error);
      // Fallback to simple table
      this.addSimpleTable(data, columns);
    }
  }

  /**
   * Fallback simple table without autoTable
   */
  addSimpleTable(data, columns) {
    const cellHeight = 8;
    const cellPadding = 2;
    const startX = this.margin;
    const tableWidth = this.contentWidth;
    const colWidth = tableWidth / columns.length;

    // Draw header
    this.pdf.setFillColor(31, 41, 55);
    this.pdf.rect(startX, this.yPosition, tableWidth, cellHeight, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    
    columns.forEach((col, index) => {
      const x = startX + (index * colWidth) + cellPadding;
      this.pdf.text(col, x, this.yPosition + 6);
    });
    
    this.yPosition += cellHeight;

    // Draw rows
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFont('helvetica', 'normal');
    
    data.forEach((row, rowIndex) => {
      if (this.yPosition + cellHeight > this.pageHeight - this.margin) {
        this.pdf.addPage();
        this.yPosition = this.margin;
      }

      // Alternate row background
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(249, 250, 251);
        this.pdf.rect(startX, this.yPosition, tableWidth, cellHeight, 'F');
      }

      row.forEach((cell, colIndex) => {
        const x = startX + (colIndex * colWidth) + cellPadding;
        this.pdf.text(String(cell || ''), x, this.yPosition + 6);
      });
      
      this.yPosition += cellHeight;
    });

    this.yPosition += 5; // Reduced spacing after simple table
  }

  /**
   * Generate the complete PDF
   */
  async generatePDF(data, items, labTestParams = [], images = []) {
    try {
      // console.log('Starting PDF generation with parameters:', {
      //   data: data,
      //   itemsCount: items?.length || 0,
      //   labTestParamsCount: labTestParams?.length || 0,
      //   imagesCount: images?.length || 0
      // });

      // Validate inputs
      if (!data) {
        throw new Error('Data is required for PDF generation');
      }
      if (!items || !Array.isArray(items)) {
        throw new Error('Items array is required for PDF generation');
      }

      // Wait for all images to load
      // console.log('Waiting for images to load...');
      await this.waitForAllImages();
      // console.log('Images loaded successfully');
      
      // Title
      this.addText('INWARD ENTRY DETAILS', this.margin, this.yPosition, { 
        fontSize: 18, 
        fontStyle: 'bold',
        color: '#1f2937'
      });
      this.yPosition += 8; // Reduced spacing after title

      // Header Information - Horizontal Layout
      const headerData = [
        `Entry Number: ${data.sl_no}`,
        `Date: ${data.date}`,
        `Supplier: ${data.supplier_name || 'N/A'}`,
        `Vehicle No: ${data.vehicle_no || 'N/A'}`,
        `Bill No: ${data.bill_no || 'N/A'}`,
        `Status: ${this.capitalizeFirst(data.status)}`
      ];

      // Create a more compact table for header information
      const headerTableData = [
        ['Entry Number', 'Date', 'Vehicle No', 'Bill No'],
        [data.sl_no, data.date, data.vehicle_no || 'N/A', data.bill_no || 'N/A'],
        ['Supplier', 'Status', '', ''],
        [data.supplier_name || 'N/A', this.capitalizeFirst(data.status), '', '']
      ];

      this.addTable(headerTableData, [], 'BASIC INFORMATION');

      // Add consistent spacing between sections
      this.yPosition += 8;

      // Summary Section - Horizontal Layout
      const totalWeight = items.reduce((sum, item) => sum + (parseFloat(item.total_weight) || 0), 0);
      const totalBags = items.reduce((sum, item) => sum + (parseInt(item.number_of_bags) || 0), 0);
      
      const summaryTableData = [
        ['Total Weight', 'Total Bags', 'Total Items'],
        [`${totalWeight.toFixed(2)} Qtl`, `${totalBags}`, `${items.length}`]
      ];

      this.addTable(summaryTableData, [], 'SUMMARY');

      // Add consistent spacing before items section
      this.yPosition += 8;

      // Items Section
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        
        // New page for each item (except first)
        if (index > 0) {
          this.pdf.addPage();
          this.yPosition = this.margin;
        }

        // Add item header with better visual connection
        this.checkNewPage(20);
        this.yPosition = this.addText(`ITEM ${index + 1}: ${item.item_name}`, this.margin, this.yPosition, { 
          fontSize: 14, 
          fontStyle: 'bold',
          color: '#1f2937'
        });
        this.yPosition += 3;

        // Item details in a compact horizontal table format
        const itemTableData = [
          ['Brand', 'Unit', 'Godown', 'Quality'],
          [item.brand || 'N/A', item.unit || 'N/A', item.godown_name || 'N/A', item.quality || 'N/A'],
          ['Number of Bags', 'Supervisor', 'Total Weight', 'Remarks'],
          [item.number_of_bags || 'N/A', item.supervisor_name || 'N/A', `${item.total_weight || 'N/A'} Qtl`, item.remarks || 'N/A']
        ];

        // Add table without separate section header for better visual connection
        this.checkNewPage(50);
        
        try {
          autoTable(this.pdf, {
            startY: this.yPosition,
            head: [],
            body: itemTableData,
            theme: 'grid',
            headStyles: {
              fillColor: [31, 41, 55],
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 9,
              cellPadding: 4,
              halign: 'left'
            },
            bodyStyles: {
              textColor: [0, 0, 0],
              fontSize: 8,
              cellPadding: 4,
              halign: 'left'
            },
            alternateRowStyles: {
              fillColor: [249, 250, 251]
            },
            margin: { left: this.margin, right: this.margin },
            tableWidth: 'auto',
            columnWidth: 'auto',
            showHead: false,
            styles: {
              halign: 'left'
            }
          });

          this.yPosition = this.pdf.lastAutoTable.finalY + 5;
        } catch (error) {
          console.error('Error creating item table:', error);
          this.addSimpleTable(itemTableData, []);
        }

        // Lab Testing Results for this item
        const itemLabTests = item.lab_tests || [];
        if (itemLabTests.length > 0) {
          // Group tests by parameter name
          const testGroups = {};
          itemLabTests.forEach(test => {
            const paramName = test.parameter_name || 'Unknown Parameter';
            if (!testGroups[paramName]) {
              testGroups[paramName] = {
                parameter_name: paramName,
                unit: test.unit || '',
                pre_testing: null,
                post_testing: null
              };
            }
            
            if (test.test_type === 'post_testing') {
              testGroups[paramName].post_testing = {
                value: test.value || 'N/A',
                remarks: test.remarks || ''
              };
            } else {
              testGroups[paramName].pre_testing = {
                value: test.value || 'N/A',
                remarks: test.remarks || ''
              };
            }
          });

          // Convert to table format
          const labData = Object.values(testGroups).map(group => [
            group.parameter_name,
            group.pre_testing ? `${group.pre_testing.value} ${group.unit}`.trim() : 'N/A',
            group.post_testing ? `${group.post_testing.value} ${group.unit}`.trim() : 'N/A'
          ]);

          this.addTable(labData, ['Parameter', 'Pre-Testing', 'Post-Testing'], 'LAB TESTING RESULTS');
        }

        // Images for this item
        const itemImages = item.images || [];
        // console.log(`Item ${item.id} has ${itemImages.length} images`);
        
        if (itemImages.length > 0) {
          try {
            await this.addImageGrid(itemImages, 'IMAGES & SAMPLES');
            // console.log(`Successfully added ${itemImages.length} images for item ${item.id}`);
          } catch (imageError) {
            console.error(`Error adding images for item ${item.id}:`, imageError);
            // Continue with PDF generation even if images fail
            this.addText(`[Error loading images for this item]`, this.margin, this.yPosition, { 
              fontSize: 9, 
              color: '#666666' 
            });
            this.yPosition += 10;
          }
        }
      }

      // Testing Information - Check both main data and items for testing info
      let hasTestingInfo = false;
      const allTestingData = [];

      // Check main data for testing information
      if (data.tested_by || data.tested_date || data.approved_by || data.approved_date) {
        hasTestingInfo = true;
        if (data.tested_by) allTestingData.push(['Tested By', data.tested_by]);
        if (data.tested_date) allTestingData.push(['Tested Date', data.tested_date]);
        if (data.approved_by) allTestingData.push(['Approved By', data.approved_by]);
        if (data.approved_date) allTestingData.push(['Approved Date', data.approved_date]);
      }

      // Check items for testing information
      items.forEach((item, index) => {
        if (item.tested_by || item.tested_date || item.approved_by || item.approved_date) {
          hasTestingInfo = true;
          if (item.tested_by) allTestingData.push([`Item ${index + 1} - Tested By`, item.tested_by]);
          if (item.tested_date) allTestingData.push([`Item ${index + 1} - Tested Date`, item.tested_date]);
          if (item.approved_by) allTestingData.push([`Item ${index + 1} - Approved By`, item.approved_by]);
          if (item.approved_date) allTestingData.push([`Item ${index + 1} - Approved Date`, item.approved_date]);
        }
      });

      if (hasTestingInfo) {
        this.addSectionHeader('TESTING INFORMATION');
        this.addTable(allTestingData, ['Property', 'Value']);
      }

      // console.log('PDF generation completed successfully');
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Save the PDF with given filename
   */
  save(filename) {
    this.pdf.save(filename);
  }

  /**
   * Utility function to capitalize first letter
   */
  capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
