# PDF Generation Troubleshooting Guide

## Quick Fixes for "Failed to generate PDF" Error

### 1. **Enable Debug Mode** (Immediate Solution)

In `src/pages/inward-details.jsx`, uncomment this line:
```jsx
// Change this:
// return <PDFDebugger />;

// To this:
return <PDFDebugger />;
```

This will show a debug interface that tests PDF generation with sample data.

### 2. **Check Browser Console**

Open browser DevTools (F12) and look for error messages when clicking "Download PDF". Common errors:

#### **CORS Errors**
```
Access to image at 'https://example.com/image.jpg' from origin 'http://localhost:3000' has been blocked by CORS policy
```
**Solution:** Images need proper CORS headers or use same-origin images.

#### **Memory Errors**
```
PDF generation failed due to memory issues
```
**Solution:** Reduce image sizes or number of images.

#### **Data Validation Errors**
```
PDF generation failed: No data provided
```
**Solution:** Ensure `data` and `items` are properly loaded.

### 3. **Common Issues & Solutions**

#### **Issue: "No data available for PDF generation"**
**Cause:** `data` or `items` is null/undefined
**Solution:**
```jsx
// Check if data is loaded
// console.log('Data:', data);
// console.log('Items:', items);

// Ensure data is available before rendering button
{data && items && (
  <InwardPDFButton
    data={data}
    items={items}
    labTestParams={labTestParams}
    images={images}
  />
)}
```

#### **Issue: "Image loading failed due to CORS policy"**
**Cause:** Images from external domains without CORS headers
**Solution:**
1. Use same-origin images
2. Configure server CORS headers
3. Use proxy for external images
4. Skip images temporarily

#### **Issue: "PDF generation timed out"**
**Cause:** Large images or slow network
**Solution:**
1. Reduce image sizes
2. Increase timeout in code
3. Use fewer images

#### **Issue: "Cannot read property 'sl_no' of undefined"**
**Cause:** Data structure mismatch
**Solution:**
```jsx
// Add null checks
const pdfFilename = filename || `Inward_Entry_${data?.sl_no || 'Unknown'}.pdf`;
```

### 4. **Step-by-Step Debugging**

#### **Step 1: Check Data Structure**
```jsx
// Add this to your component
useEffect(() => {
  // console.log('PDF Debug - Data structure:', {
  //   data: data,
  //   items: items,
  //   labTestParams: labTestParams,
  //   images: images
  // });
}, [data, items, labTestParams, images]);
```

#### **Step 2: Test with Sample Data**
Use the PDFDebugger component to test with known good data.

#### **Step 3: Test Image Loading**
```jsx
// Add this function to test images
const testImages = () => {
  const images = document.querySelectorAll('img');
  // console.log(`Found ${images.length} images`);
  
  images.forEach((img, index) => {
    // console.log(`Image ${index + 1}:`, {
    //   src: img.src,
    //   complete: img.complete,
    //   naturalWidth: img.naturalWidth,
    //   naturalHeight: img.naturalHeight
    // });
  });
};
```

#### **Step 4: Test PDF Generation Step by Step**
```jsx
const testPDFStepByStep = async () => {
  try {
    // console.log('Step 1: Creating PDF generator');
    const pdfGenerator = new InwardPDFGenerator();
    
    // console.log('Step 2: Waiting for images');
    await pdfGenerator.waitForAllImages();
    
    // console.log('Step 3: Generating PDF');
    await pdfGenerator.generatePDF(data, items, labTestParams, images);
    
    // console.log('Step 4: Saving PDF');
    pdfGenerator.save('test.pdf');
    
    // console.log('PDF generation successful!');
  } catch (error) {
    console.error('PDF generation failed at step:', error);
  }
};
```

### 5. **Fallback Solutions**

#### **Solution 1: Skip Images Temporarily**
```jsx
// Modify InwardPDFButton to skip images
<InwardPDFButton
  data={data}
  items={items}
  labTestParams={labTestParams}
  images={[]} // Empty array to skip images
/>
```

#### **Solution 2: Use Simple PDF Generation**
```jsx
// Create a simple PDF without images
const generateSimplePDF = () => {
  const pdf = new jsPDF();
  pdf.text('Inward Entry Details', 20, 20);
  pdf.text(`Entry: ${data.sl_no}`, 20, 30);
  pdf.text(`Date: ${data.date}`, 20, 40);
  pdf.save('simple_inward_entry.pdf');
};
```

#### **Solution 3: Server-Side PDF Generation**
Consider generating PDFs on the server side if client-side generation continues to fail.

### 6. **Performance Optimization**

#### **Reduce Image Sizes**
```jsx
// In loadImageAsBase64 function
const maxWidth = 200; // Reduce from 400
const maxHeight = 200; // Reduce from 400
```

#### **Limit Number of Images**
```jsx
// Limit images per item
const limitedImages = item.images?.slice(0, 3) || []; // Max 3 images per item
```

#### **Use Image Compression**
```jsx
// Compress images before adding to PDF
const dataURL = canvas.toDataURL('image/jpeg', 0.6); // Reduce quality
```

### 7. **Error Monitoring**

#### **Add Error Tracking**
```jsx
const handlePDFError = (error) => {
  // Log error details
  console.error('PDF Error:', {
    message: error.message,
    stack: error.stack,
    data: data,
    items: items,
    timestamp: new Date().toISOString()
  });
  
  // Send to error tracking service
  // errorTrackingService.captureException(error);
};
```

### 8. **Testing Checklist**

- [ ] Data is loaded and not null
- [ ] Items array exists and has content
- [ ] Images are accessible (no CORS issues)
- [ ] Browser supports required features
- [ ] Sufficient memory available
- [ ] No JavaScript errors in console
- [ ] PDF libraries are properly imported

### 9. **Browser Compatibility**

#### **Supported Browsers**
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

#### **Required Features**
- Canvas API
- File API
- Promise support
- ES6 modules

### 10. **Quick Test Commands**

```bash
# Check if packages are installed
npm list jspdf jspdf-autotable

# Reinstall packages if needed
npm install jspdf jspdf-autotable

# Clear cache and rebuild
npm run build
```

## Still Having Issues?

1. **Enable debug mode** and check console output
2. **Test with sample data** using PDFDebugger
3. **Check browser console** for specific error messages
4. **Verify data structure** matches expected format
5. **Test image accessibility** manually
6. **Try fallback solutions** (skip images, simple PDF)

## Contact Support

If issues persist, provide:
1. Browser console error messages
2. Data structure (console output)
3. Steps to reproduce
4. Browser version and OS
5. Debug output from PDFDebugger
