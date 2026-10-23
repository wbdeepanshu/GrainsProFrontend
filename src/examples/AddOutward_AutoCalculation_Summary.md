# Add Outward - Auto-Calculation Feature

## ✅ **FEATURE ADDED: Auto-Calculation of Total Weight**

### **🎯 What Was Added**
Added automatic calculation of Total Weight based on Number of Bags × Conversion Factor in `add-outward.jsx`, matching the functionality in `add-inward.jsx`.

### **🔧 Implementation Details**

#### **1. Number of Bags Input Auto-Calculation**
Added onChange handler to the Number of Bags input field:

```javascript
onChange={(e) => {
  // Auto-calculate total weight when number of bags changes
  const numberOfBags = parseFloat(e.target.value);
  const selectedItemId = form.watch(`items.${index}.item_id`);
  
  if (numberOfBags && numberOfBags > 0 && selectedItemId) {
    const selectedStockItem = stockOptionsForDropdown.find(item => item.id === selectedItemId);
    if (selectedStockItem && selectedStockItem.conversion) {
      const conversion = parseFloat(selectedStockItem.conversion);
      const totalWeight = numberOfBags * conversion;
      form.setValue(`items.${index}.total_weight`, totalWeight.toFixed(3));
      
      // Show calculation alert
      toast({
        title: "Total Weight Calculated",
        description: `${numberOfBags} × ${conversion} = ${totalWeight.toFixed(3)} Qtl`,
      });
    }
  }
  
  // Call the original register onChange
  form.register(`items.${index}.number_of_bags`).onChange(e);
}}
```

#### **2. Stock Item Selection Auto-Calculation**
Enhanced the stock item selection to trigger calculation if number of bags is already entered:

```javascript
// Auto-calculate total weight if number of bags is already entered
const numberOfBags = form.watch(`items.${index}.number_of_bags`);
if (numberOfBags && numberOfBags > 0) {
  const conversion = parseFloat(selectedItem.conversion);
  const totalWeight = numberOfBags * conversion;
  form.setValue(`items.${index}.total_weight`, totalWeight.toFixed(3));
  toast({
    title: "Total Weight Calculated",
    description: `${numberOfBags} × ${conversion} = ${totalWeight.toFixed(3)} Qtl`,
  });
}
```

### **🎨 User Experience**

#### **1. Calculation Triggers**
The auto-calculation happens in two scenarios:

**Scenario 1: Enter Number of Bags**
1. User selects a stock item (with conversion factor)
2. User enters number of bags
3. Total Weight is automatically calculated
4. Toast notification shows the calculation

**Scenario 2: Select Stock Item After Entering Bags**
1. User enters number of bags first
2. User selects a stock item (with conversion factor)
3. Total Weight is automatically calculated
4. Toast notification shows the calculation

#### **2. Toast Notifications**

**Calculation Alert:**
```
Title: "Total Weight Calculated"
Description: "41 × 0.5 = 20.500 Qtl"
Style: Green success toast
```

#### **3. Calculation Formula**
```
Total Weight = Number of Bags × Conversion Factor
```

### **🔍 How It Works**

#### **1. Data Flow**
1. **Stock item selected** → Conversion factor retrieved from API response
2. **Number of bags entered** → Triggers calculation
3. **Calculation performed** → Number of Bags × Conversion Factor
4. **Total Weight updated** → Automatically filled in the form
5. **User notified** → Toast shows the calculation details

#### **2. Validation**
- **Checks if number of bags > 0** before calculating
- **Checks if stock item has conversion factor** before calculating
- **Handles missing data gracefully** without errors

#### **3. Precision**
- **3 decimal places** for total weight (e.g., 20.500)
- **Accurate calculations** using parseFloat for precision
- **Consistent formatting** across all calculations

### **📊 Example Scenarios**

#### **Scenario 1: Normal Flow**
1. Select "Raw Moong Harvest [GJ] [50kg]" (Conversion: 0.5)
2. Enter "41" in Number of Bags
3. Total Weight automatically becomes "20.500"
4. Toast shows: "41 × 0.5 = 20.500 Qtl"

#### **Scenario 2: Reverse Flow**
1. Enter "100" in Number of Bags
2. Select "Raw Gram Bags Rayapur" (Conversion: 0.25)
3. Total Weight automatically becomes "25.000"
4. Toast shows: "100 × 0.25 = 25.000 Qtl"

#### **Scenario 3: No Conversion**
1. Select stock item without conversion factor
2. Enter number of bags
3. No auto-calculation occurs
4. User can manually enter total weight

### **✅ Benefits**

1. **Automatic Calculation** - No manual calculation needed
2. **Real-time Updates** - Immediate feedback when values change
3. **Error Prevention** - Reduces calculation errors
4. **User Friendly** - Clear notifications show the calculation
5. **Consistent UX** - Same behavior as add-inward.jsx
6. **Flexible Input** - Works regardless of input order

### **📋 Files Modified**
- `src/pages/add-outward.jsx` - Added auto-calculation functionality

### **🎯 Expected Behavior**

When working with items in add-outward.jsx:

1. **Select a stock item** → See conversion factor alert
2. **Enter number of bags** → Total Weight automatically calculated
3. **Change number of bags** → Total Weight recalculated
4. **Select different stock item** → Total Weight recalculated with new conversion
5. **See calculation details** → Toast notifications show the math

The auto-calculation feature now works seamlessly in add-outward.jsx, making it easy to calculate total weights automatically! 🎉
