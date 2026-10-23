# PDF Generation with Image Loading

This solution provides a comprehensive PDF generation system that properly handles asynchronous image loading using jsPDF and html2canvas.

## Features

- ✅ **Asynchronous Image Loading**: Waits for all images to load before generating PDF
- ✅ **Progress Tracking**: Shows loading progress for images and PDF generation
- ✅ **Error Handling**: Graceful handling of failed image loads
- ✅ **Retry Logic**: Automatic retry for failed images
- ✅ **CORS Support**: Handles cross-origin images properly
- ✅ **Memory Optimization**: Resizes large images to prevent memory issues
- ✅ **Batch Processing**: Loads images in batches to avoid overwhelming the browser
- ✅ **Reusable Components**: Easy-to-use React components

## Quick Start

### 1. Basic Usage

```jsx
import PDFDownloadButton from '@/components/PDFDownloadButton';

function MyComponent() {
  return (
    <div id="my-content">
      {/* Your content with images */}
      <img src="image1.jpg" alt="Image 1" />
      <img src="image2.jpg" alt="Image 2" />
      
      {/* PDF Download Button */}
      <PDFDownloadButton
        targetElementId="my-content"
        filename="my-document.pdf"
        buttonText="Download PDF"
      />
    </div>
  );
}
```

### 2. Advanced Usage

```jsx
import PDFDownloadButton from '@/components/PDFDownloadButton';
import { useImageLoader } from '@/hooks/useImageLoader';

function AdvancedComponent() {
  const imageUrls = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
  const { isLoading, loadedCount, allLoaded } = useImageLoader(imageUrls);

  return (
    <div id="advanced-content">
      {/* Your content */}
      
      <PDFDownloadButton
        targetElementId="advanced-content"
        filename="advanced-document.pdf"
        buttonText="Download PDF"
        variant="default"
        size="lg"
        onSuccess={(filename) => {
          // console.log(`PDF ${filename} downloaded!`);
        }}
        onError={(error) => {
          console.error('PDF generation failed:', error);
        }}
      />
    </div>
  );
}
```

### 3. Custom PDF Generation

```jsx
import { PDFGenerator } from '@/utils/pdfGenerator';
import { useImageLoader } from '@/hooks/useImageLoader';

function CustomPDFComponent() {
  const imageUrls = ['image1.jpg', 'image2.jpg'];
  const { loadedImages, allLoaded } = useImageLoader(imageUrls);

  const handleCustomPDF = async () => {
    if (!allLoaded) return;

    const pdfGenerator = new PDFGenerator();
    
    const content = {
      sections: [
        {
          title: "My Section",
          text: "Section description",
          images: imageUrls.map(url => ({
            url,
            dataURL: loadedImages[url]?.dataURL,
            loaded: !!loadedImages[url]
          }))
        }
      ]
    };

    await pdfGenerator.generateCustomPDF(content, 'custom.pdf');
  };

  return (
    <button onClick={handleCustomPDF} disabled={!allLoaded}>
      Generate Custom PDF
    </button>
  );
}
```

## Components

### PDFDownloadButton

A ready-to-use button component that handles PDF generation with image loading.

**Props:**
- `targetElementId` (string): ID of the element to convert to PDF
- `filename` (string): Name of the PDF file (default: 'document.pdf')
- `buttonText` (string): Text to display on button
- `variant` (string): Button variant (default: 'outline')
- `size` (string): Button size (default: 'sm')
- `className` (string): Additional CSS classes
- `onSuccess` (function): Callback when PDF is generated successfully
- `onError` (function): Callback when PDF generation fails

### useImageLoader Hook

Custom hook for managing image loading state.

**Returns:**
- `isLoading` (boolean): Whether images are currently loading
- `loadedCount` (number): Number of successfully loaded images
- `errorCount` (number): Number of failed images
- `allLoaded` (boolean): Whether all images have finished loading (success or error)
- `loadedImages` (object): Object containing loaded image data
- `isImageLoaded` (function): Check if specific image is loaded
- `getImageData` (function): Get data for specific image

### PDFGenerator Class

Utility class for generating PDFs with custom content.

**Methods:**
- `generateFromElement(element, filename, options)`: Generate PDF from HTML element
- `generateCustomPDF(content, filename)`: Generate PDF with custom content structure
- `waitForImages(element)`: Wait for all images in element to load
- `extractImageUrls(element)`: Extract image URLs from element

## Configuration Options

### useImageLoader Options

```jsx
const options = {
  timeout: 10000,        // Timeout per image (ms)
  retries: 2,           // Number of retries for failed images
  crossOrigin: 'anonymous' // CORS setting
};

const { ... } = useImageLoader(imageUrls, options);
```

### PDFGenerator Options

```jsx
const options = {
  format: 'a4',         // PDF format
  orientation: 'portrait', // Page orientation
  unit: 'mm',           // Measurement unit
  margin: 20,           // Page margin
  imageQuality: 0.8,    // Image quality (0-1)
  maxImageWidth: 60,    // Max image width in PDF
  maxImageHeight: 60    // Max image height in PDF
};

const pdfGenerator = new PDFGenerator(options);
```

## Error Handling

The system includes comprehensive error handling:

1. **Image Load Failures**: Failed images are retried automatically
2. **CORS Issues**: Handled with proper crossOrigin settings
3. **Memory Issues**: Large images are automatically resized
4. **Network Timeouts**: Configurable timeout with retry logic
5. **PDF Generation Errors**: Graceful fallback with user feedback

## Best Practices

1. **Image Optimization**: Use appropriately sized images to improve loading speed
2. **Error Boundaries**: Wrap PDF generation in error boundaries
3. **Loading States**: Show loading indicators while images are loading
4. **User Feedback**: Provide clear feedback about PDF generation status
5. **Memory Management**: Avoid loading too many large images simultaneously

## Troubleshooting

### Images Not Appearing in PDF

1. Check console for CORS errors
2. Verify image URLs are accessible
3. Ensure images are fully loaded before PDF generation
4. Check if images are filtered out by placeholder detection

### PDF Generation Fails

1. Check browser console for errors
2. Verify target element exists
3. Ensure sufficient memory for large documents
4. Check if all required dependencies are installed

### Performance Issues

1. Reduce image sizes before loading
2. Use batch processing for many images
3. Consider lazy loading for off-screen images
4. Monitor memory usage in browser dev tools

## Dependencies

- `jspdf`: PDF generation
- `html2canvas`: HTML to canvas conversion
- `react`: React framework
- `lucide-react`: Icons

## Installation

```bash
npm install jspdf html2canvas
```

## Examples

See the example files:
- `src/examples/PDFExample.jsx` - Comprehensive example
- `src/examples/SimplePDFExample.jsx` - Basic usage example
