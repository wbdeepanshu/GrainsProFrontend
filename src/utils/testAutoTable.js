import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Test function to verify autoTable is working correctly
 */
export const testAutoTable = () => {
  try {
    // console.log('Testing autoTable import...');
    
    // Create a simple PDF
    const pdf = new jsPDF();
    
    // Test data
    const data = [
      ['Name', 'Age', 'City'],
      ['John', '25', 'New York'],
      ['Jane', '30', 'London']
    ];
    
    // Test autoTable function
    autoTable(pdf, {
      head: [data[0]],
      body: data.slice(1),
      startY: 20
    });
    
    // console.log('✅ autoTable test successful!');
    return true;
  } catch (error) {
    console.error('❌ autoTable test failed:', error);
    return false;
  }
};

/**
 * Test PDF generation with tables
 */
export const testPDFGeneration = () => {
  try {
    // console.log('Testing PDF generation with tables...');
    
    const pdf = new jsPDF();
    
    // Add title
    pdf.text('Test PDF with Tables', 20, 20);
    
    // Add table
    autoTable(pdf, {
      head: [['Parameter', 'Value', 'Unit']],
      body: [
        ['Temperature', '25.5', '°C'],
        ['Humidity', '60', '%'],
        ['Pressure', '1013', 'hPa']
      ],
      startY: 30,
      theme: 'grid',
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: 255,
        fontStyle: 'bold'
      }
    });
    
    // Save test PDF
    pdf.save('test_autotable.pdf');
    // console.log('✅ PDF generation test successful!');
    return true;
  } catch (error) {
    console.error('❌ PDF generation test failed:', error);
    return false;
  }
};
