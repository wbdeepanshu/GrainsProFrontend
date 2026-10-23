# Professional PDF Generation for Inward Details

This system provides a comprehensive PDF generation solution specifically designed for inward entry details, with professional formatting, proper image handling, and table layouts.

## Features

✅ **Professional Layout**: Clean, well-formatted PDF with proper spacing and typography
✅ **Image Handling**: Waits for all images to load, displays 3 per row as thumbnails
✅ **Table Support**: Professional tables using jspdf-autotable
✅ **Section Headers**: Bold headers with proper spacing and lines
✅ **Multi-page Support**: Each item on separate page when needed
✅ **Progress Tracking**: Real-time progress indicators
✅ **Error Handling**: Graceful handling of failed images and errors
✅ **CORS Support**: Handles cross-origin images properly

## Quick Start

### 1. Basic Usage

```jsx
import InwardPDFButton from '@/components/InwardPDFButton';

function InwardDetails() {
  return (
    <div>
      {/* Your inward details content */}
      
      <InwardPDFButton
        data={data}
        items={items}
        labTestParams={labTestParams}
        images={images}
        filename="Inward_Entry_123.pdf"
      />
    </div>
  );
}
```

### 2. Advanced Usage with Callbacks

```jsx
<InwardPDFButton
  data={data}
  items={items}
  labTestParams={labTestParams}
  images={images}
  filename={`Inward_Entry_${data.sl_no}.pdf`}
  variant="default"
  size="lg"
  onSuccess={(filename) => {
    // console.log(`PDF ${filename} downloaded successfully!`);
    // Show success notification
  }}
  onError={(error) => {
    console.error('PDF generation failed:', error);
    // Show error notification
  }}
/>
```

## Components

### InwardPDFButton

A specialized PDF download button for inward details.

**Props:**
- `data` (object, required): Main inward entry data
- `items` (array, required): Array of items with images
- `labTestParams` (array): Lab test parameters
- `images` (array): Additional images
- `filename` (string): PDF filename (default: auto-generated)
- `variant` (string): Button variant (default: 'outline')
- `size` (string): Button size (default: 'sm')
- `onSuccess` (function): Success callback
- `onError` (function): Error callback

### InwardPDFGenerator

The core PDF generation class with professional formatting.

**Key Methods:**
- `waitForAllImages()`: Waits for all images to load
- `addImageGrid(images, title)`: Adds images in 3-per-row grid
- `addTable(data, columns, title)`: Adds professional tables
- `addSectionHeader(title)`: Adds formatted section headers
- `generatePDF(data, items, labTestParams, images)`: Main generation method

## PDF Structure

The generated PDF includes:

### 1. Header Section
- Entry number, date, supplier
- Vehicle number, bill number, status
- Professional formatting with bold headers

### 2. Summary Section
- Total weight, total bags, total items
- Calculated from all items

### 3. Items Section (Each on separate page)
- Item name as main header
- Item details in professional table format
- Lab test results in formatted table
- Images in 3-per-row grid layout

### 4. Testing Information
- Tested by, tested date
- Approved by, approved date
- Formatted as professional table

## Image Handling

### Automatic Image Loading
- Waits for all images to load before PDF generation
- Handles CORS issues with proper crossOrigin settings
- Resizes large images to prevent memory issues
- Shows progress during loading

### Image Layout
- **3 images per row** in PDF
- **50x50mm thumbnails** with labels
- **Grouped by type** (Lab Samples, Quality Check, etc.)
- **Error handling** for failed images

### Supported Image Properties
```jsx
// Supports multiple URL property names:
const imageUrl = image.image_url || image.url || image.src;
```

## Table Formatting

### Professional Tables
- **Grid theme** with alternating row colors
- **Bold headers** with dark background
- **Auto-sizing** columns
- **Proper spacing** and margins

### Lab Test Results Table
```
| Parameter      | Pre-Testing | Post-Testing |
|----------------|-------------|--------------|
| Moisture       | 12.5%       | 11.8%        |
| Protein        | 24.2%       | 24.5%        |
| Foreign Matter | 0.8%        | 0.5%         |
```

## Error Handling

### Image Loading Errors
- **Timeout protection** (10 seconds per image)
- **Retry logic** for failed images
- **Fallback display** showing URL for failed images
- **Graceful degradation** - PDF continues even if some images fail

### PDF Generation Errors
- **Progress tracking** with percentage
- **User feedback** via toast notifications
- **Console logging** for debugging
- **Error callbacks** for custom handling

## Configuration Options

### PDF Settings
```jsx
const pdfGenerator = new InwardPDFGenerator({
  format: 'a4',           // PDF format
  orientation: 'portrait', // Page orientation
  margin: 20,             // Page margins (mm)
  imageWidth: 50,         // Image width (mm)
  imageHeight: 50,        // Image height (mm)
  imagesPerRow: 3         // Images per row
});
```

### Button Styling
```jsx
<InwardPDFButton
  variant="default"  // 'default', 'outline', 'destructive', etc.
  size="lg"          // 'sm', 'md', 'lg', 'xl'
  className="custom-class"
/>
```

## Progress Indicators

### Loading States
- **"Generating PDF... 25%"** - During image loading
- **"Generating PDF... 50%"** - During PDF generation
- **"Generating PDF... 75%"** - During final processing
- **"Generating PDF... 100%"** - Completion

### Button States
- **Loading**: Spinner with progress text
- **Ready**: Download icon with "Download PDF"
- **Disabled**: When no data available

## Best Practices

### 1. Data Structure
Ensure your data follows the expected structure:
```jsx
const data = {
  sl_no: 'IW/2025/0017',
  date: '25-10-2025',
  supplier_name: 'Supplier Name',
  // ... other fields
};

const items = [
  {
    id: 1,
    item_name: 'Item Name',
    images: [
      {
        image_url: 'https://example.com/image.jpg',
        type: 'lab_samples',
        type_display: 'Lab Samples'
      }
    ]
    // ... other fields
  }
];
```

### 2. Image Optimization
- Use appropriately sized images (400x400px max recommended)
- Ensure images are accessible (no CORS issues)
- Use descriptive alt text and labels

### 3. Error Handling
- Always provide onSuccess and onError callbacks
- Show user feedback for PDF generation status
- Log errors for debugging

## Troubleshooting

### Images Not Appearing
1. Check console for CORS errors
2. Verify image URLs are accessible
3. Check image property names (image_url, url, src)
4. Ensure images are in item.images array

### PDF Generation Fails
1. Check browser console for errors
2. Verify all required data is provided
3. Check if images are loading properly
4. Ensure sufficient memory for large documents

### Performance Issues
1. Reduce image sizes before loading
2. Limit number of images per item
3. Use image compression
4. Monitor memory usage

## Dependencies

- `jspdf`: PDF generation
- `jspdf-autotable`: Professional table formatting
- `react`: React framework
- `lucide-react`: Icons

## Installation

```bash
npm install jspdf jspdf-autotable
```

## Example Files

- `src/components/InwardPDFButton.jsx` - Main button component
- `src/utils/inwardPDFGenerator.js` - PDF generation logic
- `src/examples/InwardPDFExample.jsx` - Complete usage example
- `src/pages/inward-details.jsx` - Integration example

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify data structure matches expected format
3. Test with sample data first
4. Check image accessibility and CORS settings
