# Outward List View Screen Fix

## ✅ **ISSUE FIXED: "statusColors is not defined"**

### **🔧 Problem**
When clicking the "View" button in `outward-list.jsx`, the screen was empty with the error:
```
Uncaught ReferenceError: statusColors is not defined
    at OutwardEntryDetails (outward-list.jsx:64:21)
```

### **🔍 Root Cause**
The `statusColors` constant was defined inside the main component function, but the `OutwardEntryDetails` component was defined outside of it and was trying to access `statusColors` before it was defined.

### **🛠️ Solution Applied**

#### **1. Moved Constants to Global Scope**
Moved `statusColors` and `capitalizeFirst` function to the top of the file, outside of any component:

```javascript
// Status colors matching inward-list.jsx
const statusColors = {
  approved: "bg-green-100 text-green-700",
  completed: "bg-green-200 text-green-800",
  rejected: "bg-red-100 text-red-700",
  unloaded_but_rejected: "bg-red-200 text-red-800",
  pending: "bg-yellow-100 text-yellow-700",
  "assignment-pending": "bg-yellow-200 text-yellow-800",
  unloaded: "bg-blue-100 text-blue-700",
  "not uploaded": "bg-gray-100 text-gray-700",
  partial_completed: "bg-orange-100 text-orange-700",
};

const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};
```

#### **2. Removed Duplicate Definitions**
Removed the duplicate `statusColors` and `capitalizeFirst` definitions from inside the main component function.

### **✅ Result**
- **View button now works** without errors
- **Status colors display correctly** in the outward entry details modal
- **No duplicate code** - cleaner file structure
- **Consistent with inward-list.jsx** - same status color scheme

### **🎯 What's Fixed**
- ✅ **View Screen Error** - No more "statusColors is not defined" error
- ✅ **Status Display** - Status badges show with correct colors
- ✅ **Modal Functionality** - Outward entry details modal works properly
- ✅ **Code Organization** - Constants moved to appropriate scope

### **📋 Files Modified**
- `src/pages/outward-list.jsx` - Fixed statusColors scope issue

The outward list view screen should now work perfectly when you click the "View" button! 🎉
