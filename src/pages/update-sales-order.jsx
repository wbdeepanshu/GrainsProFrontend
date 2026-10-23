import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Menu,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  ShoppingCart,
  User,
  Calendar,
  Package,
  DollarSign,
  MapPin,
  FileText,
  Loader2,
  AlertCircle,
  Edit,
  IndianRupee,
  ChevronsUpDown
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useToast } from "../hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SALES_ORDERS_LIST_REFRESH_KEY = "salesOrdersListRefresh";
const SALES_ORDERS_DETAIL_REFRESH_SO_KEY = "salesOrdersListRefreshSoNumber";

export default function UpdateSalesOrder() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [, params] = useRoute('/update-sales-order/:soNumber');
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Stock items search state - individual for each item
  const [itemSearchTerms, setItemSearchTerms] = useState({});
  const [itemDebouncedTerms, setItemDebouncedTerms] = useState({});
  const [itemDropdownOpen, setItemDropdownOpen] = useState({});
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollPositionRef = useRef(0);
  const [isSearching, setIsSearching] = useState(false);
  const scrollLockRef = useRef(false);

  const soNumber = params?.soNumber;

  // Form state
  const [formData, setFormData] = useState({
    customer_id: "",
    date: "",
    so_number: "",
    status: "PENDING",
    remarks: "",
    address: "",
    lat: "",
    long: "",
    order_by: "",
    items: []
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch sales order details
  const { data: orderDetail, isLoading: orderLoading } = useQuery({
    queryKey: ['sales-order-detail', soNumber],
    queryFn: async () => {
      if (!soNumber) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/sales-orders/${soNumber}/`);
      const data = await response.json();
      return data.data;
    },
    enabled: !!soNumber && !!AuthService.getAccessToken(),
  });

  // Fetch customers
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/sales/get-customers/`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
  });

  // Lock scroll position during search operations
  useEffect(() => {
    const handleScroll = (e) => {
      if (scrollLockRef.current || isSearching) {
        e.preventDefault();
        e.stopPropagation();
        window.scrollTo(0, scrollPositionRef.current);
        return false;
      }
      scrollPositionRef.current = window.scrollY;
      setScrollPosition(window.scrollY);
    };

    const handleWheel = (e) => {
      if (scrollLockRef.current || isSearching) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleKeyDown = (e) => {
      if (scrollLockRef.current || isSearching) {
        // Prevent arrow keys, page up/down, home, end from scrolling
        if ([32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearching]);

  // Debounce stock search for each item
  useEffect(() => {
    const timeouts = {};
    
    Object.keys(itemSearchTerms).forEach(itemIndex => {
      timeouts[itemIndex] = setTimeout(() => {
        // Lock scroll during search
        scrollLockRef.current = true;
        setIsSearching(true);
        
        // Add CSS to prevent scrolling
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPositionRef.current}px`;
        document.body.style.width = '100%';
        
        setItemDebouncedTerms(prev => ({
          ...prev,
          [itemIndex]: itemSearchTerms[itemIndex]
        }));
        
        // Unlock scroll after a short delay to allow API call to complete
        setTimeout(() => {
          scrollLockRef.current = false;
          setIsSearching(false);
          
          // Remove CSS scroll lock
          document.body.style.overflow = '';
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.width = '';
          
          // Restore scroll position
          const currentScroll = scrollPositionRef.current;
          if (currentScroll > 0) {
            requestAnimationFrame(() => {
              window.scrollTo({
                top: currentScroll,
                behavior: 'instant'
              });
            });
          }
        }, 500);
      }, 300);
    });

    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, [itemSearchTerms]);

  // Fetch stock items using the same API as add-inward.jsx
  const fetchStockItems = async ({ pageParam = 1, queryKey }) => {
    const [, { search }] = queryKey;

    const response = await apiRequest('POST', `${API_BASE_URL}/api/get-stock-items/`, {
      page: pageParam,
      per_page: 50,
      search: search || "",
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stock items');
    }

    const data = await response.json();
    return {
      data: data.data || [],
      nextPage: data.data && data.data.length === 50 ? pageParam + 1 : undefined,
    };
  };

  // Get the most recent search term for API calls
  const currentSearchTerm = Object.values(itemDebouncedTerms).pop() || "";

  const {
    data: stockItemsData,
    fetchNextPage: fetchNextStockPage,
    hasNextPage: hasNextStockPage,
    isFetchingNextPage: isFetchingNextStockPage,
    isLoading: stockItemsLoading,
    isFetching: isStockItemsFetching,
  } = useInfiniteQuery({
    queryKey: ['stock-items', { search: currentSearchTerm }],
    queryFn: fetchStockItems,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,  // Prevent refetch on window focus
    refetchOnMount: false,        // Prevent refetch on mount
    staleTime: 5 * 60 * 1000,    // Consider data fresh for 5 minutes
  });

  // Lock scroll during data fetching
  useEffect(() => {
    if (isStockItemsFetching) {
      scrollLockRef.current = true;
      setIsSearching(true);
      
      // Add CSS to prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';
    } else {
      // Unlock scroll after fetching is complete
      setTimeout(() => {
        scrollLockRef.current = false;
        setIsSearching(false);
        
        // Remove CSS scroll lock
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore scroll position
        const currentScroll = scrollPositionRef.current;
        if (currentScroll > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: currentScroll,
              behavior: 'instant'
            });
          });
        }
      }, 100);
    }
  }, [isStockItemsFetching]);

  const customers = customersData?.data || [];
  const stockItems = stockItemsData?.pages?.flatMap(page => page.data) || [];

  // Restore scroll position when data changes
  useEffect(() => {
    const currentScroll = scrollPositionRef.current;
    if (currentScroll > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        window.scrollTo({
          top: currentScroll,
          behavior: 'instant'
        });
      });
    }
  }, [stockItemsData]);

  // Helper functions for item search
  const handleItemSearch = (itemIndex, searchTerm) => {
    // Lock scroll immediately when user starts typing
    scrollLockRef.current = true;
    setIsSearching(true);
    
    // Preserve current scroll position before search
    scrollPositionRef.current = window.scrollY;
    
    // Add CSS to prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';
    
    setItemSearchTerms(prev => ({
      ...prev,
      [itemIndex]: searchTerm
    }));
  };

  const getItemSearchTerm = (itemIndex) => {
    return itemSearchTerms[itemIndex] || "";
  };

  const getFilteredStockItems = (itemIndex) => {
    const searchTerm = getItemSearchTerm(itemIndex);
    return stockItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleDropdownOpenChange = (itemIndex, open) => {
    setItemDropdownOpen(prev => ({
      ...prev,
      [itemIndex]: open
    }));
  };

  const isDropdownOpen = (itemIndex) => {
    return itemDropdownOpen[itemIndex] || false;
  };

  // Populate form when order details are loaded
  useEffect(() => {
    if (orderDetail) {
      setFormData({
        customer_id: orderDetail.header?.customer_id || "",
        date: orderDetail.header?.order_date || "",
        so_number: orderDetail.header?.so_number || "",
        status: orderDetail.header?.status || "PENDING",
        remarks: orderDetail.header?.remarks || "",
        address: orderDetail.header?.address || "",
        lat: orderDetail.header?.lat || "",
        long: orderDetail.header?.long || "",
        order_by: orderDetail.header?.order_by || "",
        items: orderDetail.items?.map(item => ({
          id: item.id,
          item_id: item.item_id || "",
          quantity: item.quantity || 1,
          price: item.price || 0,
          comment: item.comment || "",
          base_unit_id: item.base_unit?.id || item.stock_item?.base_unit?.id || null,
          base_price: item.price || 0,
          conversion: item.stock_item?.conversion || 1.0
        })) || []
      });
    }
  }, [orderDetail]);

  // Handle form field changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  // Handle item changes
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    
    // Auto-fill price and UOM when item is selected
    if (field === 'item_id') {
      if (value) {
        const selectedStockItem = stockItems.find(item => item.id.toString() === value.toString());
        if (selectedStockItem) {
          // Store conversion for display purposes
          const conversion = selectedStockItem.conversion || 1.0;
          newItems[index].conversion = parseFloat(conversion);
          
          // Store base_price for reference (price in unit_of_measurement's unit)
          const basePrice = selectedStockItem.final_price || selectedStockItem.base_price || 0;
          newItems[index].base_price = parseFloat(parseFloat(basePrice).toFixed(2));
          
          // Use unit_of_measurement from API as the default UOM (this is the UOM for the rate)
          const defaultUOM = selectedStockItem.unit_of_measurement;
          if (defaultUOM && defaultUOM.id) {
            newItems[index].base_unit_id = defaultUOM.id;
            // Use the price from API based on the selected UOM
            const baseUnitId = selectedStockItem.base_unit?.id;
            const alternateUnitId = selectedStockItem.alternate_unit?.id;
            
            if (defaultUOM.id === baseUnitId) {
              // Price is in base unit - use base_unit.price from API
              newItems[index].price = parseFloat(parseFloat(selectedStockItem.base_unit?.price || basePrice).toFixed(2));
            } else if (defaultUOM.id === alternateUnitId) {
              // Price is in alternate unit - use alternate_unit.price from API
              newItems[index].price = parseFloat(parseFloat(selectedStockItem.alternate_unit?.price || basePrice).toFixed(2));
            } else {
              // Fallback to base_price
              newItems[index].price = parseFloat(parseFloat(basePrice).toFixed(2));
            }
          } else if (selectedStockItem.base_unit && selectedStockItem.base_unit.id) {
            // Fallback to base_unit if unit_of_measurement is not available
            newItems[index].base_unit_id = selectedStockItem.base_unit.id;
            newItems[index].price = parseFloat(parseFloat(selectedStockItem.base_unit?.price || basePrice).toFixed(2));
          }
        }
      } else {
        // If item is cleared, reset all fields
        newItems[index].base_unit_id = null;
        newItems[index].base_price = 0;
        newItems[index].conversion = 1.0;
        newItems[index].price = 0;
      }
    }

    // Handle UOM change - use price directly from API response
    if (field === 'base_unit_id') {
      const selectedStockItem = stockItems.find(item => item.id.toString() === newItems[index].item_id?.toString());
      if (selectedStockItem) {
        const baseUnitId = selectedStockItem.base_unit?.id;
        const alternateUnitId = selectedStockItem.alternate_unit?.id;
        
        // Use price directly from API response based on selected unit
        if (value === baseUnitId) {
          // Base unit selected - use base_unit.price from API
          if (selectedStockItem.base_unit?.price !== undefined && selectedStockItem.base_unit.price !== null) {
            newItems[index].price = parseFloat(parseFloat(selectedStockItem.base_unit.price).toFixed(2));
          } else {
            // Fallback to base_price
            newItems[index].price = parseFloat(parseFloat(newItems[index].base_price || 0).toFixed(2));
          }
        } else if (value === alternateUnitId) {
          // Alternate unit selected - use alternate_unit.price from API
          if (selectedStockItem.alternate_unit?.price !== undefined && selectedStockItem.alternate_unit.price !== null) {
            newItems[index].price = parseFloat(parseFloat(selectedStockItem.alternate_unit.price).toFixed(2));
          } else {
            // Fallback to base_price
            newItems[index].price = parseFloat(parseFloat(newItems[index].base_price || 0).toFixed(2));
          }
        }
      }
    }

    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    
    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  // Add new item
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          item_id: "",
          quantity: 1,
          price: 0,
          comment: "",
          base_unit_id: null,
          base_price: 0,
          conversion: 1.0
        }
      ]
    }));
  };

  // Remove item
  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        items: newItems
      }));
    }
  };

  // Calculate total amount
  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      return total + (parseFloat(item.quantity || 0) * parseFloat(item.price || 0));
    }, 0);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.customer_id) {
      newErrors.customer_id = "Customer is required";
    }

    if (!formData.date) {
      newErrors.date = "Order date is required";
    }

    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    }

    formData.items.forEach((item, index) => {
      if (!item.item_id) {
        newErrors[`item_${index}_item_id`] = "Item is required";
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = "Quantity must be greater than 0";
      }
      if (!item.price || item.price < 0) {
        newErrors[`item_${index}_price`] = "Price must be 0 or greater";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Update sales order mutation
  const updateSalesOrderMutation = useMutation({
    mutationFn: async (data) => {
      // Since there's no dedicated update API, we'll use the create API with the existing SO number
      const response = await apiRequest('POST', `${API_BASE_URL}/api/sales/create-direct-so/`, {
        ...data,
        so_number: soNumber // Use existing SO number to update
      });
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: data?.message || "Sales order updated successfully",
        variant: "default",
      });
      try {
        const soToRefresh = soNumber || data?.data?.so_number || data?.data?.order_id;
        sessionStorage.setItem(SALES_ORDERS_LIST_REFRESH_KEY, "1");
        if (soToRefresh) {
          sessionStorage.setItem(SALES_ORDERS_DETAIL_REFRESH_SO_KEY, String(soToRefresh));
        }
        await queryClient.invalidateQueries({ queryKey: ["sales-orders"], exact: false });
        await queryClient.refetchQueries({ queryKey: ["sales-orders"], exact: false });
        if (soToRefresh) {
          await queryClient.invalidateQueries({ queryKey: ["sales-order-detail", soToRefresh] });
          await queryClient.refetchQueries({ queryKey: ["sales-order-detail", soToRefresh] });
        }
        await queryClient.invalidateQueries({ queryKey: ["sales-order-detail"], exact: false });
      } catch (refreshError) {
        console.error("Failed to refresh sales orders list cache:", refreshError);
      }
      setLocation("/reports/sales-order-list");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update sales order",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await updateSalesOrderMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Error updating sales order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderLoading || customersLoading || stockItemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (!orderDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sales Order Not Found</h2>
          <p className="text-gray-600 mb-4">The sales order you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation('/reports/sales-order-list')}>
            Back to Sales Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Update Sales Order</h1>
            <div className="w-10" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/reports/sales-order-list')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Update Sales Order</h1>
              <p className="text-gray-600">Edit sales order {soNumber}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-sm">
              <Edit className="h-4 w-4 mr-1" />
              Editing
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date().toLocaleDateString()}
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-auto min-w-0">
          <div className=" mx-auto w-full p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <ShoppingCart className="h-5 w-5" />
                    <span>Basic Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer_id">Customer *</Label>
                      <Select
                        value={formData.customer_id}
                        onValueChange={(value) => handleInputChange('customer_id', value)}
                      >
                        <SelectTrigger className={errors.customer_id ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.firm_name || customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.customer_id && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.customer_id}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="date">Order Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange('date', e.target.value)}
                        className={errors.date ? "border-red-500" : ""}
                      />
                      {errors.date && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.date}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="so_number">SO Number</Label>
                      <Input
                        id="so_number"
                        value={formData.so_number}
                        disabled
                        className="bg-gray-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">SO number cannot be changed</p>
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => handleInputChange('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="PROCESSING">Processing</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="order_by">Order By</Label>
                      <Input
                        id="order_by"
                        value={formData.order_by}
                        onChange={(e) => handleInputChange('order_by', e.target.value)}
                        placeholder="Person who placed the order"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Delivery Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter delivery address"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="lat">Latitude</Label>
                      <Input
                        id="lat"
                        type="number"
                        step="any"
                        value={formData.lat}
                        onChange={(e) => handleInputChange('lat', e.target.value)}
                        placeholder="e.g., 19.0760"
                      />
                    </div>

                    <div>
                      <Label htmlFor="long">Longitude</Label>
                      <Input
                        id="long"
                        type="number"
                        step="any"
                        value={formData.long}
                        onChange={(e) => handleInputChange('long', e.target.value)}
                        placeholder="e.g., 72.8777"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      placeholder="Additional notes or remarks"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center space-x-2">
                      <Package className="h-5 w-5" />
                      <span>Order Items</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addItem}
                      className="flex items-center space-x-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Item</span>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        {formData.items.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <Label>Item *</Label>
                          <Popover open={isDropdownOpen(index)} onOpenChange={(open) => handleDropdownOpenChange(index, open)}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`w-full border rounded px-3 py-2 text-left flex items-center justify-between ${errors[`item_${index}_item_id`] ? "border-red-500" : ""}`}
                              >
                                <span>
                                  {(() => {
                                    const selectedItem = stockItems.find(stockItem => stockItem.id.toString() === item.item_id?.toString());
                                    return selectedItem?.name || "Select item";
                                  })()}
                                </span>
                                <ChevronsUpDown className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-[300px] p-2"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                              onCloseAutoFocus={(e) => e.preventDefault()}
                            >
                              <Input
                                placeholder="Search stock items..."
                                value={getItemSearchTerm(index)}
                                onChange={(e) => {
                                  e.preventDefault();
                                  handleItemSearch(index, e.target.value);
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onKeyUp={(e) => {
                                  e.stopPropagation();
                                }}
                                className="mb-2"
                              />
                              <div
                                className="max-h-60 overflow-auto"
                                onScroll={(e) => {
                                  e.stopPropagation();
                                  const target = e.currentTarget;
                                  if (
                                    target.scrollTop + target.clientHeight >= target.scrollHeight - 20 &&
                                    hasNextStockPage &&
                                    !isFetchingNextStockPage
                                  ) {
                                    fetchNextStockPage();
                                  }
                                }}
                                onWheel={(e) => e.stopPropagation()}
                              >
                                {getFilteredStockItems(index).map((stockItem) => (
                                  <button
                                    key={stockItem.id}
                                    type="button"
                                    className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleItemChange(index, 'item_id', stockItem.id);
                                      handleDropdownOpenChange(index, false);
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                  >
                                    {stockItem.name}
                                  </button>
                                ))}

                                {/* Infinite scroll loading */}
                                {isFetchingNextStockPage && (
                                  <div className="p-2 text-center text-sm">Loading more...</div>
                                )}

                                {/* No results */}
                                {!isFetchingNextStockPage && getFilteredStockItems(index).length === 0 && (
                                  <div className="p-2 text-center text-sm text-muted-foreground">
                                    No stock items found
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          {errors[`item_${index}_item_id`] && (
                            <p className="text-red-500 text-sm mt-1 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              {errors[`item_${index}_item_id`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              // Allow empty, numbers, and decimal numbers
                              if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
                                const value = inputValue === '' ? 0 : parseFloat(inputValue) || 0;
                                handleItemChange(index, 'quantity', value);
                              }
                            }}
                            className={errors[`item_${index}_quantity`] ? "border-red-500" : ""}
                          />
                          {errors[`item_${index}_quantity`] && (
                            <p className="text-red-500 text-sm mt-1 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              {errors[`item_${index}_quantity`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label>Price *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                            className={errors[`item_${index}_price`] ? "border-red-500" : ""}
                          />
                          {errors[`item_${index}_price`] && (
                            <p className="text-red-500 text-sm mt-1 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              {errors[`item_${index}_price`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label>Comment</Label>
                          <Input
                            value={item.comment}
                            onChange={(e) => handleItemChange(index, 'comment', e.target.value)}
                            placeholder="Item comment"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {errors.items && (
                    <p className="text-red-500 text-sm flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.items}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <IndianRupee className="h-5 w-5" />
                    <span>Order Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total Amount:</span>
                    <span className="text-green-600">
                      ₹{calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/reports/sales-order-list')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-black hover:bg-gray-800"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Sales Order
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
