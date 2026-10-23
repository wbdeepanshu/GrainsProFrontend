import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Utility class for generating PDFs with proper image handling
 */
export class PDFGenerator {
  constructor(options = {}) {
    this.options = {
      format: 'a4',
      orientation: 'portrait',
      unit: 'mm',
      margin: 20,
      imageQuality: 0.8,
      maxImageWidth: 60,
      maxImageHeight: 60,
      ...options
    };
  }

  /**
   * Generate PDF from HTML element with proper image handling
   * @param {HTMLElement} element - The element to convert to PDF
   * @param {string} filename - Name of the PDF file
   * @param {Object} options - Additional options
   * @returns {Promise<void>}
   */
  async generateFromElement(element, filename = 'document.pdf', options = {}) {
    try {
      // console.log('Starting PDF generation from element...');
      
      // Wait for all images to load
      await this.waitForImages(element);
      
      // Generate canvas from HTML
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        ...options.html2canvas
      });

      // Create PDF
      const pdf = new jsPDF({
        format: this.options.format,
        orientation: this.options.orientation,
        unit: this.options.unit
      });

      const imgData = canvas.toDataURL('image/png', this.options.imageQuality);
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Save PDF
      pdf.save(filename);
      
      // console.log('PDF generated successfully:', filename);
      return true;
    } catch (error) {
      console.error('Error generating PDF from element:', error);
      throw error;
    }
  }

  /**
   * Generate PDF with custom content and loaded images
   * @param {Object} content - Content structure
   * @param {string} filename - Name of the PDF file
   * @returns {Promise<void>}
   */
  async generateCustomPDF(content, filename = 'document.pdf') {
    try {
      // console.log('Starting custom PDF generation...');
      
      const pdf = new jsPDF({
        format: this.options.format,
        orientation: this.options.orientation,
        unit: this.options.unit
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = this.options.margin;
      const contentWidth = pageWidth - (this.options.margin * 2);

      // Helper function to add text with word wrapping
      const addText = (text, x, y, options = {}) => {
        const { fontSize = 10, fontStyle = 'normal', color = '#000000', maxWidth = contentWidth } = options;
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', fontStyle);
        pdf.setTextColor(color);
        
        const lines = pdf.splitTextToSize(text, maxWidth);
        pdf.text(lines, x, y);
        return y + (lines.length * fontSize * 0.4);
      };

      // Helper function to add a new page if needed
      const checkNewPage = (requiredHeight) => {
        if (yPosition + requiredHeight > pageHeight - this.options.margin) {
          pdf.addPage();
          yPosition = this.options.margin;
          return true;
        }
        return false;
      };

      // Process content sections
      for (const section of content.sections || []) {
        checkNewPage(20);
        
        // Add section title
        yPosition = addText(section.title, this.options.margin, yPosition, { 
          fontSize: 14, 
          fontStyle: 'bold' 
        });
        yPosition += 10;

        // Add section content
        if (section.text) {
          yPosition = addText(section.text, this.options.margin, yPosition);
          yPosition += 5;
        }

        // Add images if any
        if (section.images && section.images.length > 0) {
          yPosition = addText('Images:', this.options.margin, yPosition, { 
            fontSize: 12, 
            fontStyle: 'bold' 
          });
          yPosition += 5;

          // Add images in rows
          for (let i = 0; i < section.images.length; i += 2) {
            checkNewPage(this.options.maxImageHeight + 10);
            
            const image1 = section.images[i];
            const image2 = section.images[i + 1];

            // Add first image
            if (image1 && image1.dataURL) {
              try {
                pdf.addImage(
                  image1.dataURL, 
                  'JPEG', 
                  this.options.margin, 
                  yPosition, 
                  this.options.maxImageWidth, 
                  this.options.maxImageHeight
                );
              } catch (error) {
                console.error('Error adding image to PDF:', error);
                yPosition = addText(`[Image ${i + 1} - Error]`, this.options.margin, yPosition, { 
                  fontSize: 9, 
                  color: '#666666' 
                });
              }
            }

            // Add second image if exists
            if (image2 && image2.dataURL) {
              try {
                pdf.addImage(
                  image2.dataURL, 
                  'JPEG', 
                  this.options.margin + this.options.maxImageWidth + 10, 
                  yPosition, 
                  this.options.maxImageWidth, 
                  this.options.maxImageHeight
                );
              } catch (error) {
                console.error('Error adding image to PDF:', error);
                yPosition = addText(`[Image ${i + 2} - Error]`, 
                  this.options.margin + this.options.maxImageWidth + 10, 
                  yPosition, 
                  { fontSize: 9, color: '#666666' }
                );
              }
            }

            yPosition += this.options.maxImageHeight + 10;
          }
        }

        yPosition += 10;
      }

      // Save PDF
      pdf.save(filename);
      // console.log('Custom PDF generated successfully:', filename);
      return true;
    } catch (error) {
      console.error('Error generating custom PDF:', error);
      throw error;
    }
  }

  /**
   * Wait for all images in an element to load
   * @param {HTMLElement} element - The element containing images
   * @returns {Promise<void>}
   */
  async waitForImages(element) {
    const images = element.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
      return new Promise((resolve) => {
        if (img.complete && img.naturalHeight !== 0) {
          resolve();
        } else {
          img.onload = () => resolve();
          img.onerror = () => {
            console.warn('Image failed to load:', img.src);
            resolve(); // Continue even if image fails
          };
        }
      });
    });

    await Promise.all(imagePromises);
    // console.log(`Waited for ${images.length} images to load`);
  }

  /**
   * Extract all image URLs from an element
   * @param {HTMLElement} element - The element to scan
   * @returns {Array<string>} - Array of image URLs
   */
  extractImageUrls(element) {
    const images = element.querySelectorAll('img');
    return Array.from(images)
      .map(img => img.src)
      .filter(url => url && url !== 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'); // Filter out placeholder images
  }
}

// Export default instance
export default new PDFGenerator();
