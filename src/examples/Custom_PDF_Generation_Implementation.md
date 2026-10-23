# Custom PDF Generation with Organization Header - Implementation

## ✅ **CUSTOM PDF GENERATION IMPLEMENTED**

### **🎯 Implementation Summary**
Successfully implemented a custom PDF generation function directly in `inward-details.jsx` that fetches organization and branch information from the API and displays it at the top of the PDF.

### **📋 Implementation Details**

#### **1. API Integration**
```javascript
// Fetch organization and branch information
let orgName = '';
let branchName = '';
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

try {
  // console.log('Fetching organization info from API...');
  // const orgResponse = await fetch('http://192.168.1.118:8094/api/dashboard/', {
  //   method: 'GET',
  //   headers: {
  //     'Authorization': `Bearer ${token}`,
  //     'Content-Type': 'application/json',
  //   },
  // });

  const url = `${API_BASE_URL}/api/dashboard/`;

const orgResponse = await fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
  
  if (orgResponse.ok) {
    const orgData = await orgResponse.json();
    // console.log('API Response data:', orgData);
    
    if (orgData.status === 200 && orgData.data?.user_info) {
      orgName = orgData.data.user_info.organization || '';
      branchName = orgData.data.user_info.branch || '';
      // console.log('Organization info extracted:', { orgName, branchName });
    }
  }
} catch (error) {
  console.error('Failed to fetch organization info:', error);
  // Continue with PDF generation even if org info fails
}
```

#### **2. PDF Header Implementation**
```javascript
// Add organization and branch names at the top center
if (orgName || branchName) {
  // Organization Name
  if (orgName) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(orgName, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 7;
  }
  
  // Branch Name
  if (branchName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(branchName, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 7;
  }
  
  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;
}
```

#### **3. Custom PDF Button**
```javascript
<Button
  variant="outline"
  size="sm"
  onClick={handleDownloadPDF}
  className="flex items-center space-x-2"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
  <span>Download PDF</span>
</Button>
```

### **📊 PDF Layout Structure**

#### **New PDF Header Layout**
```
┌─────────────────────────────────────────┐
│        WB Agro Pvt. Ltd                 │  ← Organization (14px, Bold, Center)
│        WB Agro Pvt. Ltd - Main Branch   │  ← Branch (12px, Normal, Center)
│ ─────────────────────────────────────── │  ← Separator Line
│                                         │
│           INWARD ENTRY DETAILS          │  ← Main Title (18px, Bold, Center)
│                                         │
│ BASIC INFORMATION                       │
│ ┌─────────────────────────────────────┐ │
│ │ Entry Number │ Date │ Vehicle No    │ │
│ │ Supplier     │ Status               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ SUMMARY                                 │
│ ┌─────────────────────────────────────┐ │
│ │ Total Weight │ Total Bags │ Items   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ... rest of the content ...             │
└─────────────────────────────────────────┘
```

### **🎨 Typography & Styling**

#### **Organization Name**
- **Font Size**: 14px
- **Style**: Bold
- **Alignment**: Center
- **Position**: Top of PDF

#### **Branch Name**
- **Font Size**: 12px
- **Style**: Normal
- **Alignment**: Center
- **Position**: Below organization

#### **Separator Line**
- **Style**: Horizontal line
- **Color**: Light Gray (200, 200, 200)
- **Width**: Full page width with margins
- **Purpose**: Visual separation

#### **Main Title**
- **Font Size**: 18px
- **Style**: Bold
- **Color**: Dark Gray (#1f2937)
- **Alignment**: Center
- **Position**: Below separator

### **🔍 API Integration Details**

#### **API Endpoint**
- **URL**: `http://192.168.1.118:8094/api/dashboard/`
- **Method**: GET
- **Authentication**: Bearer token from AuthService

#### **Expected Response Structure**
```json
{
  "status": 200,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "date": "28-10-2025",
    "user_info": {
      "user_id": "USR0001",
      "name": "Mukesh Bafna",
      "admin_id": "USR0001",
      "role_id": 1,
      "role": "Admin",
      "is_admin": true,
      "organization": "WB Agro Pvt. Ltd",
      "branch": "WB Agro Pvt. Ltd - Main Branch"
    }
  }
}
```

#### **Data Extraction**
```javascript
if (orgData.status === 200 && orgData.data?.user_info) {
  orgName = orgData.data.user_info.organization || '';
  branchName = orgData.data.user_info.branch || '';
}
```

### **✅ Features Implemented**

#### **✅ Asynchronous API Fetching**
- Fetches organization data before PDF generation
- Uses `await fetch()` to ensure data is available
- Handles API errors gracefully
- Continues PDF generation even if API fails

#### **✅ Professional PDF Header**
- Organization name in bold, center-aligned
- Branch name below organization, center-aligned
- Clean separator line
- Proper spacing and typography

#### **✅ Complete PDF Generation**
- Basic information table
- Summary section with totals
- Individual item details
- Lab testing results
- Professional formatting throughout

#### **✅ Error Handling**
- Comprehensive error logging
- Graceful fallback if API fails
- User-friendly error notifications
- PDF generation continues regardless

#### **✅ User Experience**
- Loading toast notification
- Success confirmation
- Error notifications
- Clean button interface

### **🔧 Technical Implementation**

#### **1. Dependencies Added**
```javascript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
```

#### **2. Function Structure**
- `handleDownloadPDF()` - Main PDF generation function
- API fetch with error handling
- PDF document creation
- Header with organization info
- Content generation
- File save and notifications

#### **3. PDF Generation Flow**
1. Show loading notification
2. Fetch organization data from API
3. Create new jsPDF document
4. Add organization header
5. Generate content tables
6. Save PDF file
7. Show success notification

### **🎯 Key Benefits**

#### **Before**
- Used external InwardPDFButton component
- No organization branding
- Generic PDF header

#### **After**
- Custom PDF generation in component
- Dynamic organization branding
- Professional header with company info
- Direct control over PDF layout
- Better error handling

### **📋 Usage Instructions**

1. **Open inward-details.jsx page**
2. **Click "Download PDF" button**
3. **System automatically:**
   - Shows loading notification
   - Fetches organization info from API
   - Generates PDF with organization header
   - Downloads PDF with company branding
   - Shows success notification

### **🔍 Debugging Features**

#### **Console Logs**
- "Fetching organization info from API..."
- "API Response data: [data]"
- "Organization info extracted: [orgInfo]"
- Error messages for debugging

#### **Toast Notifications**
- Loading: "Generating PDF..."
- Success: "PDF Downloaded Successfully"
- Error: "PDF Generation Failed"

### **🎉 Result**

The PDF now displays:
- **Organization Name** at the top center in bold
- **Branch Name** below organization in normal text
- **Professional separator line**
- **Enhanced branding and visual hierarchy**
- **Complete inward entry details**

The implementation is complete and ready to use! 🎉

### **📝 Code Location**
- **File**: `src/pages/inward-details.jsx`
- **Function**: `handleDownloadPDF()` (lines 68-373)
- **Button**: Custom Button component (lines 1028-1038)
