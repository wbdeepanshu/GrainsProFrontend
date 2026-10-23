import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { AuthService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, 
  Package, 
  IndianRupee, 
  TrendingUp, 
  Building2, 
  CreditCard,
  Info,
  AlertCircle,
  Menu,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Table,
  Grid3X3,
  Users,
  Calculator,
  BarChart3,
  Check,
  ChevronsUpDown,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS_PER_PAGE = 20;

export default function StockItemPricing() {
  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'card'
  const [detailedViewItem, setDetailedViewItem] = useState(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  
  // Excel Upload State
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Hooks
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchTerm]);

  // Debounce stock item search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCustomer?.id, selectedBranch?.id]);

  // Fetch stock items with margin calculations
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['stock-item-pricing', selectedCustomer?.id, selectedBranch?.id, currentPage, debouncedSearchTerm],
    queryFn: () => fetchStockItemPricing({
      customerId: selectedCustomer?.id,
      branchId: selectedBranch?.id,
      search: debouncedSearchTerm,
      page: currentPage,
      perPage: ITEMS_PER_PAGE,
    }),
    retry: 1,
    placeholderData: (previousData) => previousData,
  });

  // Fetch branches
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    retry: 1,
  });

  // Fetch customers with infinite scroll and search
  const {
    data: customersData,
    fetchNextPage: fetchNextCustomerPage,
    hasNextPage: hasNextCustomerPage,
    isFetchingNextPage: isFetchingNextCustomerPage,
    isLoading: customersLoading,
  } = useInfiniteQuery({
    queryKey: ['customers', debouncedCustomerSearch],
    queryFn: ({ pageParam = 1 }) => fetchCustomers(pageParam, debouncedCustomerSearch),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination?.has_next ? lastPage.pagination.current_page + 1 : undefined;
    },
    enabled: customerDropdownOpen, // Only fetch when dropdown is open
    retry: 1,
  });

  async function fetchBranches() {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/get-branches/`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    }
  }

  async function fetchCustomers(page = 1, search = "") {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('per_page', '20'); // Load 20 customers per page
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await fetch(`${backendUrl}/api/report/get-ledgers/?${params.toString()}`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        data: result.data || [],
        pagination: result.pagination || {
          current_page: 1,
          total_count: 0,
          total_pages: 1,
          has_next: false,
          has_previous: false
        }
      };
    } catch (error) {
      console.error("Error fetching customers:", error);
      return {
        data: [],
        pagination: {
          current_page: 1,
          total_count: 0,
          total_pages: 1,
          has_next: false,
          has_previous: false
        }
      };
    }
  }

  async function fetchStockItemPricing({ customerId, branchId, search = "", page = 1, perPage = ITEMS_PER_PAGE }) {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const body = {
        page,
        per_page: perPage,
      };
      if (customerId) body.customer_id = customerId;
      if (branchId) body.branch_id = branchId;
      if (search.trim()) body.search = search.trim();

      const response = await fetch(`${backendUrl}/api/growth/so-items-list/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status !== 200) {
        throw new Error(result.message || 'Failed to fetch stock item pricing');
      }

      const pagination = result.pagination || {
        current_page: page,
        total_count: result.data?.stock_items?.length || 0,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      };

      return {
        stock_items: result.data?.stock_items || [],
        customer: result.data?.customer,
        summary: result.data?.summary,
        pagination,
      };
    } catch (error) {
      console.error("Error fetching stock item pricing:", error);
      throw error;
    }
  }

  // Upload Excel functions
  async function uploadExcelStockItemBasePrices(file) {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      // console.log("Uploading Excel file...");
      const response = await fetch(`${backendUrl}/api/growth/upload-excel-base-prices/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status !== 200 && result.status !== 207) {
        throw new Error(result.message || 'Failed to upload Excel file');
      }

      return result.data;
    } catch (error) {
      console.error("Error uploading Excel file:", error);
      throw error;
    }
  }

  async function downloadExcelTemplate() {
    try {
      // Create a link to download the static template file
      const link = document.createElement('a');
      link.href = '/stock_item_base_prices_template.xlsx';
      link.download = 'stock_item_base_prices_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Template Downloaded",
        description: "Excel template has been downloaded successfully.",
        variant: "default",
      });

    } catch (error) {
      console.error("Error downloading template:", error);
      throw error;
    }
  }

  // Process data for display
  const { processedData, customerInfo, branchInfo, businessTypes } = useMemo(() => {
    if (!data?.stock_items) return { processedData: [], customerInfo: null, branchInfo: null, businessTypes: [] };

    const items = data.stock_items;

    if (selectedCustomer) {
      return {
        processedData: items,
        customerInfo: data.customer,
        branchInfo: null,
        businessTypes: []
      };
    }

    const allBusinessTypes = new Set();
    const businessTypeMap = new Map();

    items.forEach(item => {
      if (item.business_types && item.business_types.length > 0) {
        item.business_types.forEach(businessTypeData => {
          const businessType = businessTypeData.business_type;
          allBusinessTypes.add(businessType.id);
          if (!businessTypeMap.has(businessType.id)) {
            businessTypeMap.set(businessType.id, {
              id: businessType.id,
              name: businessType.name,
              margin_percent: businessType.margin_percent
            });
          }
        });
      }
    });

    const businessTypesList = Array.from(businessTypeMap.values());

    const processedItems = items.map(item => {
      const businessTypeData = {};

      if (item.business_types && item.business_types.length > 0) {
        item.business_types.forEach(businessTypeItem => {
          const businessType = businessTypeItem.business_type;
          const businessTypeId = businessType.id;

          businessTypeData[businessTypeId] = {
            businessType: businessType,
            businessTypeBasePrice: businessTypeItem.business_type_base_price,
            creditTypes: businessTypeItem.credit_types.map(creditTypeData => ({
              id: creditTypeData.credit_type.id,
              name: creditTypeData.credit_type.name,
              margin_percent: creditTypeData.credit_type.margin_percent,
              credit_type_margin_amount: creditTypeData.credit_type_margin_amount,
              final_price: creditTypeData.final_price
            }))
          };
        });
      }

      return {
        ...item,
        businessTypeData
      };
    });

    return {
      processedData: processedItems,
      customerInfo: null,
      branchInfo: null,
      businessTypes: businessTypesList
    };
  }, [data?.stock_items, data?.customer, selectedCustomer]);

  const totalPages = data?.pagination?.total_pages || 1;
  const paginatedItems = processedData;

  // Toggle expanded state for items
  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Handle search
  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle branch selection
  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setSelectedCustomer(null); // Clear customer selection when branch is selected
    setCurrentPage(1); // Reset to first page
    setBranchDropdownOpen(false);
  };

  // Handle customer selection
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setSelectedBranch(null); // Clear branch selection when customer is selected
    setCurrentPage(1); // Reset to first page
    setCustomerDropdownOpen(false);
    setCustomerSearchTerm("");
  };

  // Handle infinite scroll for customer dropdown
  const handleCustomerScroll = useCallback((event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasNextCustomerPage && !isFetchingNextCustomerPage) {
      fetchNextCustomerPage();
    }
  }, [hasNextCustomerPage, isFetchingNextCustomerPage, fetchNextCustomerPage]);

  // Flatten customers data from infinite query
  const allCustomers = useMemo(() => {
    return customersData?.pages?.flatMap(page => page.data) || [];
  }, [customersData]);

  // Handle detailed view for pricing breakdown
  const handlePricingClick = (item) => {
    setDetailedViewItem(item);
  };

  // Handle detailed view for business type
  const handleBusinessTypeClick = (item, businessType) => {
    setDetailedViewItem(item);
    setSelectedBusinessType(businessType);
  };

  // Close detailed view
  const closeDetailedView = () => {
    setDetailedViewItem(null);
    setSelectedBusinessType(null);
  };

  // Upload handlers
  const handleExcelFileSelect = (event) => {
    // console.log("File selection triggered:", event.target.files);
    const file = event.target.files[0];
    if (!file) {
      // console.log("No file selected");
      return;
    }

    // console.log("Selected file:", file.name, file.size, file.type);

    // Validate file type
    const allowedTypes = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidType = allowedTypes.includes(`.${fileExtension}`);

    if (!isValidType) {
      toast({
        title: "Invalid File Type",
        description: "Please select a valid Excel file (.xlsx or .xls).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }

    // console.log("File validation passed, setting selected file");
    setSelectedExcelFile(file);
    
    toast({
      title: "File Selected",
      description: `${file.name} is ready to upload.`,
      variant: "default",
    });
  };

  const handleExcelUpload = async () => {
    if (!selectedExcelFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingExcel(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result = await uploadExcelStockItemBasePrices(selectedExcelFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Show detailed results
      const { results, file_info, not_found_items, errors } = result;
      
      let message = `File processed successfully!\n`;
      message += `• Created: ${results.created_count} items\n`;
      message += `• Updated: ${results.updated_count} items\n`;
      message += `• Total processed: ${results.total_processed} items\n`;
      
      if (results.not_found_count > 0) {
        message += `• Not found: ${results.not_found_count} items\n`;
      }
      if (results.errors_count > 0) {
        message += `• Errors: ${results.errors_count} items\n`;
      }

      toast({
        title: "Upload Successful",
        description: message,
        variant: "success",
      });

      // Show detailed errors if any
      if (errors.length > 0) {
        console.warn("Upload errors:", errors);
      }
      if (not_found_items.length > 0) {
        console.warn("Items not found:", not_found_items);
      }

      // Refresh the data
      refetch();
      
      // Reset form
      setSelectedExcelFile(null);
      setUploadProgress(0);

    } catch (error) {
      console.error("Excel upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload Excel file. Please try again.",
        variant: "destructive",
      });
      setUploadProgress(0);
    } finally {
      setIsUploadingExcel(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadExcelTemplate();
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download template. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <CommonLoader />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {isMobile ? (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      ) : (
        <Sidebar />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="p-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <Package className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Stock Item Pricing</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Upload Section */}
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelFileSelect}
                  className="hidden"
                  id="excel-upload"
                  ref={(input) => {
                    if (input) {
                      input.setAttribute('style', 'display: none;');
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1 cursor-pointer"
                  disabled={isUploadingExcel}
                  onClick={() => {
                    const fileInput = document.getElementById('excel-upload');
                    if (fileInput) {
                      fileInput.click();
                    }
                  }}
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload Excel</span>
                </Button>
                
                {selectedExcelFile && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-green-600 font-medium">
                      {selectedExcelFile.name}
                    </span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleExcelUpload}
                      disabled={isUploadingExcel}
                      className="flex items-center space-x-1"
                    >
                      {isUploadingExcel ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="hidden sm:inline">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-4 w-4" />
                          <span className="hidden sm:inline">Process</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedExcelFile(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </Button>
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Template</span>
                </Button>
              </div>
              
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'chart' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('chart')}
                  className="rounded-r-none"
                >
                  <Table className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="rounded-l-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Upload Progress and File Info */}
        {(selectedExcelFile || isUploadingExcel) && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {selectedExcelFile ? selectedExcelFile.name : 'Processing...'}
                  </p>
                  {selectedExcelFile && (
                    <p className="text-xs text-blue-600">
                      {(selectedExcelFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>
              {isUploadingExcel && (
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-blue-700">{uploadProgress}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-6">
            {/* Branch and Customer Selection */}
            <div className="flex gap-4">
              {/* Branch Selection Card */}
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Branch Selection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-center">
                    <div className="flex-1">
                      <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={branchDropdownOpen}
                            className="w-full justify-between"
                          >
                            {selectedBranch ? selectedBranch.name : "Select a branch to view pricing"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandList>
                              <CommandEmpty>
                                {branchesLoading ? "Loading branches..." : "No branches found."}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-64">
                                  {branchesData?.map((branch) => (
                                    <CommandItem
                                      key={branch.id}
                                      value={branch.name}
                                      onSelect={() => handleBranchSelect(branch)}
                                      className="flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Check
                                          className={`h-4 w-4 ${
                                            selectedBranch?.id === branch.id ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        <div>
                                          <div className="font-medium">{branch.name}</div>
                                          {branch.organization && (
                                            <div className="text-sm text-gray-500">{branch.organization}</div>
                                          )}
                                        </div>
                                      </div>
                                      {branch.margin_percent > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{branch.margin_percent}%
                                        </Badge>
                                      )}
                                    </CommandItem>
                                  ))}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {selectedBranch && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedBranch(null);
                        }}
                        className="flex items-center gap-2"
                      >
                        Clear Selection
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Customer Selection Card */}
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customer Selection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-center">
                    <div className="flex-1">
                      <Popover open={customerDropdownOpen} onOpenChange={setCustomerDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={customerDropdownOpen}
                            className="w-full justify-between"
                          >
                            {selectedCustomer ? selectedCustomer.name : "Select a customer to view pricing"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search customers..."
                              value={customerSearchTerm}
                              onValueChange={setCustomerSearchTerm}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {customersLoading ? "Loading customers..." : "No customers found."}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea
                                  className="h-64"
                                  onScrollCapture={handleCustomerScroll}
                                >
                                  {allCustomers.map((customer) => (
                                    <CommandItem
                                      key={customer.id}
                                      value={customer.name}
                                      onSelect={() => handleCustomerSelect(customer)}
                                      className="flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Check
                                          className={`h-4 w-4 ${
                                            selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        <div>
                                          <div className="font-medium">{customer.name}</div>
                                          {customer.parent && (
                                            <div className="text-sm text-gray-500">{customer.parent}</div>
                                          )}
                                        </div>
                                      </div>
                                      {customer.state && (
                                        <Badge variant="outline" className="text-xs">
                                          {customer.state}
                                        </Badge>
                                      )}
                                    </CommandItem>
                                  ))}
                                  {isFetchingNextCustomerPage && (
                                    <div className="flex items-center justify-center p-4">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span className="ml-2 text-sm text-gray-500">Loading more customers...</span>
                                    </div>
                                  )}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {selectedCustomer && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearchTerm("");
                        }}
                        className="flex items-center gap-2"
                      >
                        Clear Selection
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Search and Filters Card */}
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search & Filter
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search by stock item name..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10"
                      />
                      {isFetching && debouncedSearchTerm && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stock Items List */}
            {viewMode === 'chart' ? (
              /* Chart View */
              <div className="space-y-4">
                {paginatedItems.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        {searchTerm ? 'No stock items found matching your search.' : 'No stock items with pricing found for this customer.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                                Stock Item
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-20 bg-gray-50 z-10">
                                {selectedBranch ? `Base Price` : 'Base Price'}
                              </th>
                              {selectedCustomer ? (
                                <>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                                    <div className="flex flex-col items-center">
                                      <Calculator className="h-4 w-4 text-blue-600 mb-1" />
                                      <div className="font-semibold">Margin Amount</div>
                                    </div>
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                                    <div className="flex flex-col items-center">
                                      <IndianRupee className="h-4 w-4 text-green-600 mb-1" />
                                      <div className="font-semibold">Final Price</div>
                                      <div className="text-xs text-gray-400">With all margins</div>
                                    </div>
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                                    Actions
                                  </th>
                                </>
                              ) : (
                                businessTypes.map((businessType) => (
                                <th key={businessType.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                                  <div className="flex flex-col items-center">
                                    <Building2 className="h-4 w-4 text-blue-600 mb-1" />
                                    <div className="font-semibold">{businessType.name}</div>
                                    <div className="text-xs text-gray-400">+{businessType.margin_percent}%</div>
                                  </div>
                                </th>
                                ))
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedItems.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                                  <div className="flex items-center">
                                    <Package className="h-5 w-5 text-blue-600 mr-3" />
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{item.name}</div>

                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap sticky left-20 bg-white z-10">
                                  <div className="text-sm font-semibold text-green-600">
                                    <IndianRupee className="inline h-4 w-4 mr-1" />
                                    {item.base_price?.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    }) || '0.00'}
                                  </div>
                                  {selectedBranch && selectedBranch.margin_percent > 0 && (
                                    <div className="text-xs text-blue-600 mt-1">
                                      (Original: ₹{((item.base_price || 0) / (1 + selectedBranch.margin_percent / 100)).toLocaleString('en-IN', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })})
                                    </div>
                                  )}
                                </td>
                                {selectedCustomer ? (
                                  <>
                                    <td className="px-4 py-4 text-center">
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-600">
                                          <IndianRupee className="inline h-3 w-3 mr-1" />
                                          {item.total_margin_amount?.toLocaleString('en-IN', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                          }) || '0.00'}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      <div className="text-sm font-semibold text-green-600">
                                        <IndianRupee className="inline h-4 w-4 mr-1" />
                                        {item.final_price?.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        }) || '0.00'}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePricingClick(item)}
                                        className="flex items-center gap-1"
                                      >
                                        <Eye className="h-4 w-4" />
                                        Details
                                      </Button>
                                    </td>
                                  </>
                                ) : (
                                  businessTypes.map((businessType) => {
                                  const businessTypeData = item.businessTypeData[businessType.id];
                                  if (businessTypeData && businessTypeData.creditTypes.length > 0) {
                                    const businessTypeBasePrice = businessTypeData.businessTypeBasePrice;
                                    return (
                                      <td key={businessType.id} className="px-4 py-4 text-center">
                                        <div className="space-y-1">
                                          <div
                                            className="text-sm font-semibold text-blue-600 cursor-pointer hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                                            onClick={() => handleBusinessTypeClick(item, businessTypeData)}
                                            title="Click to view credit type details"
                                          >
                                            <IndianRupee className="inline h-3 w-3 mr-1" />
                                            {businessTypeBasePrice.toLocaleString('en-IN', {
                                              minimumFractionDigits: 0,
                                              maximumFractionDigits: 0
                                            })}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  } else {
                                    return (
                                      <td key={businessType.id} className="px-4 py-4 text-center">
                                        <div className="text-sm text-gray-400">-</div>
                                      </td>
                                    );
                                  }
                                  })
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              /* Card View */
              <div className="space-y-4">
                {paginatedItems.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        {searchTerm ? 'No stock items found matching your search.' : 'No stock items with base pricing found.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  paginatedItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardHeader
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-blue-600" />
                            <div>
                              <CardTitle className="text-lg">{item.name}</CardTitle>

                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-lg font-semibold text-green-600">
                                <IndianRupee className="inline h-4 w-4 mr-1" />
                                {item.base_price.toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </div>
                              <div className="text-sm text-gray-600">Base Price</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Show first business type if available
                                  const firstBusinessType = Object.values(item.businessTypeData)[0];
                                  if (firstBusinessType) {
                                    handleBusinessTypeClick(item, firstBusinessType);
                                  }
                                }}
                                className="flex items-center gap-1"
                              >
                                <Eye className="h-4 w-4" />
                                Details
                              </Button>

                              <Button variant="ghost" size="sm">
                                {expandedItems.has(item.id) ? '▼' : '▶'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      {/* Expanded Content */}
                      {expandedItems.has(item.id) && (
                        <CardContent className="pt-0">
                          <Separator className="mb-4" />

                          {Object.keys(item.businessTypeData).length > 0 ? (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="h-4 w-4 text-blue-600" />
                                <h4 className="font-semibold">Business Type Pricing</h4>
                              </div>

                              <div className="space-y-3">
                                {Object.values(item.businessTypeData).map((businessTypeData) => (
                                  <div key={businessTypeData.businessType.id} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">{businessTypeData.businessType.name}</span>
                                        <Badge variant="outline">+{businessTypeData.businessType.margin_percent}%</Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-semibold text-blue-600">
                                          <IndianRupee className="inline h-3 w-3 mr-1" />
                                          {businessTypeData.businessTypeBasePrice.toLocaleString('en-IN', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                          })}
                                        </div>
                                        <Badge variant="secondary">
                                          {businessTypeData.creditTypes.length} Credit Types
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      Base Price: {businessTypeData.businessTypeBasePrice.toLocaleString('en-IN', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })} | Click "View Details" to see all credit type combinations
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <Info className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-600">No margin calculations available for this item</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Margins are calculated based on business types and credit types
                              </p>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Detailed Pricing Breakdown Modal */}
      {detailedViewItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold">{detailedViewItem.name || 'Unknown Item'}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedCustomer && (
                  <Badge variant="outline" className="text-xs">
                    Customer: {data.customer?.name || 'Selected'}
                  </Badge>
                )}
                {selectedBranch && (
                  <Badge variant="outline" className="text-xs">
                    Branch: {selectedBranch.name} (+{selectedBranch.margin_percent}%)
                  </Badge>
                )}
                <Button variant="outline" onClick={closeDetailedView}>
                  Close
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">

              {/* Pricing Summary - Hide when business type is selected */}
              {!selectedBusinessType && (
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        <IndianRupee className="inline h-6 w-6 mr-2" />
                        {detailedViewItem.base_price?.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '0.00'}
                      </div>
                      <div className="text-sm text-green-700">
                        {selectedBranch ? `Base Price (incl. ${selectedBranch.margin_percent}% branch margin)` : 'Base Price'}
                      </div>
                      {selectedBranch && selectedBranch.margin_percent > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          Original: ₹{((detailedViewItem.base_price || 0) / (1 + selectedBranch.margin_percent / 100)).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </div>
                      )}
                    </div>

                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {detailedViewItem.total_margin_percent?.toFixed(2) || '0.00'}%
                      </div>
                      <div className="text-sm text-blue-700">Total Margin %</div>
                    </div>

                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        <IndianRupee className="inline h-6 w-6 mr-2" />
                        {detailedViewItem.total_margin_amount?.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '0.00'}
                      </div>
                      <div className="text-sm text-purple-700">Total Margin Amount</div>
                    </div>

                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        <IndianRupee className="inline h-6 w-6 mr-2" />
                        {detailedViewItem.final_price?.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '0.00'}
                      </div>
                      <div className="text-sm text-orange-700">Final Price</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Information - Hide when business type is selected */}
              {!selectedBusinessType && detailedViewItem.customer_info && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                    <Users className="h-4 w-4 text-blue-600" />
                    Customer Information
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Name:</span>
                        <span className="font-medium text-gray-800">{detailedViewItem.customer_info.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Business:</span>
                        <span className="font-medium text-gray-800">{detailedViewItem.customer_info.business_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Credit:</span>
                        <span className="font-medium text-gray-800">{detailedViewItem.customer_info.credit_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Branch:</span>
                        <span className="font-medium text-gray-800">
                          {detailedViewItem.customer_info.branch?.name || 'Not specified'}
                          {detailedViewItem.customer_info.branch?.margin_percent > 0 && (
                            <span className="text-xs text-blue-600 ml-1">
                              (+{detailedViewItem.customer_info.branch.margin_percent}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">City:</span>
                        <span className="font-medium text-gray-800">{detailedViewItem.customer_info.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">State:</span>
                        <span className="font-medium text-gray-800">{detailedViewItem.customer_info.state}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Applied Rules & Calculation Breakdown - Hide when business type is selected */}
              {!selectedBusinessType && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Applied Rules & Calculation Breakdown
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Applied Rules */}
                    <div>
                      <h4 className="font-medium mb-3 text-gray-700">Applied Rules</h4>
                      <div className="space-y-3">
                        {detailedViewItem.applied_rules?.map((rule, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">{rule.rule_name}</div>
                                <div className="text-sm text-gray-600 mb-2">Type: {rule.rule_type}</div>
                                {rule.priority && (
                                  <Badge variant="outline" className="text-xs">
                                    Priority: {rule.priority}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-semibold text-green-600 text-lg">
                                  +{rule.margin_percent?.toFixed(2) || '0.00'}%
                                </div>
                                <div className="text-sm text-gray-600">
                                  <IndianRupee className="inline h-3 w-3 mr-1" />
                                  {rule.margin_amount?.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }) || '0.00'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Calculation Breakdown */}
                    <div>
                      <h4 className="font-medium mb-3 text-gray-700">Calculation Steps</h4>
                      <div className="space-y-3">
                        {detailedViewItem.calculation_breakdown?.map((step, index) => (
                          <div key={index} className="p-4 bg-blue-50 rounded-lg border">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">{step.step}</div>
                                <div className="text-sm text-gray-600">
                                  Amount: <IndianRupee className="inline h-3 w-3 mr-1" />
                                  {step.amount?.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }) || '0.00'}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-semibold text-blue-600 text-lg">
                                  <IndianRupee className="inline h-4 w-4 mr-1" />
                                  {step.running_total?.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }) || '0.00'}
                                </div>
                                <div className="text-xs text-gray-500">Running Total</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Credit Type Details - Clean tabular view when business type is selected */}
            {!selectedCustomer && selectedBusinessType && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Business Type</p>
                          <p className="text-lg font-bold text-blue-800">
                            {selectedBusinessType.businessType?.name || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <IndianRupee className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm text-green-600 font-medium">Base Price</p>
                          <p className="text-lg font-bold text-green-800">
                            {selectedBusinessType.businessTypeBasePrice?.toLocaleString('en-IN', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            }) || '0.00'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="text-sm text-purple-600 font-medium">Credit Types</p>
                          <p className="text-lg font-bold text-purple-800">
                            {selectedBusinessType.creditTypes?.length || 0} Available
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Credit Types Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                      Credit Type Margin Details
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Showing credit type variations for {selectedBusinessType.businessType?.name || 'Business Type'} 
                      (Base: ₹{selectedBusinessType.businessTypeBasePrice?.toFixed(2) || '0.00'})
                    </p>
                  </CardHeader>
                  <CardContent>
                    {selectedBusinessType.creditTypes && selectedBusinessType.creditTypes.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-50">
                                Credit Type
                              </th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50">
                                Margin %
                              </th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 bg-gray-50">
                                Margin Amount
                              </th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 bg-gray-50">
                                Final Price
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedBusinessType.creditTypes.map((creditType, index) => (
                              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                      <span className="text-sm font-bold text-purple-700">
                                        {creditType.name || 'N/A'}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-900">
                                        {creditType.name || 'Credit Type'}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-semibold">
                                    +{creditType.margin_percent || 0}%
                                  </Badge>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="font-semibold text-gray-900">
                                    <IndianRupee className="inline h-4 w-4 mr-1" />
                                    {creditType.credit_type_margin_amount?.toLocaleString('en-IN', { 
                                      minimumFractionDigits: 2, 
                                      maximumFractionDigits: 2 
                                    }) || '0.00'}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="font-bold text-lg text-green-600">
                                    <IndianRupee className="inline h-5 w-5 mr-1" />
                                    {creditType.final_price?.toLocaleString('en-IN', { 
                                      minimumFractionDigits: 2, 
                                      maximumFractionDigits: 2 
                                    }) || '0.00'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <CreditCard className="h-8 w-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No Credit Types Available</h4>
                        <p className="text-gray-500">This business type doesn't have any credit type variations configured.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Business Types and Credit Types Breakdown - for default view (hide when business type is selected) */}
            {!selectedCustomer && !selectedBusinessType && detailedViewItem.business_types && detailedViewItem.business_types.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Business Types & Credit Types Pricing
                </h3>
                
                {detailedViewItem.business_types.map((businessType, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        {businessType.business_type?.name || 'Business Type'}
                        <Badge variant="outline" className="ml-2">
                          +{businessType.business_type?.margin_percent || 0}%
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div>
                            <div className="font-medium">Base Price with Business Type Margin</div>
                            <div className="text-sm text-gray-600">
                              Base: ₹{detailedViewItem.base_price?.toFixed(2) || '0.00'} + 
                              {businessType.business_type?.margin_percent || 0}% = 
                              ₹{businessType.business_type_base_price?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-blue-600">
                              <IndianRupee className="inline h-4 w-4 mr-1" />
                              {businessType.business_type_base_price?.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }) || '0.00'}
                            </div>
                          </div>
                        </div>
                        
                        {businessType.credit_types && businessType.credit_types.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-gray-700">Credit Type Variations:</h4>
                            {businessType.credit_types.map((creditType, ctIndex) => (
                              <div key={ctIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div>
                                  <div className="font-medium text-sm">{creditType.credit_type?.name || 'Credit Type'}</div>
                                  <div className="text-xs text-gray-600">
                                    +{creditType.credit_type?.margin_percent || 0}% on business type price
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold text-green-600">
                                    <IndianRupee className="inline h-3 w-3 mr-1" />
                                    {creditType.final_price?.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    }) || '0.00'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Fallback for new data structure */}
            {selectedCustomer && !detailedViewItem.applied_rules && !detailedViewItem.calculation_breakdown && (
              <div className="text-center py-8">
                <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No additional price rules applied</p>
                <p className="text-sm text-gray-500 mt-2">
                  Pricing is based on customer's business type and credit type only
                </p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Customer Information:</h4>
                  <div className="text-sm text-blue-700">
                    <p>Business Type: {data.customer?.business_type || 'Not specified'}</p>
                    <p>Credit Type: {data.customer?.credit_type || 'Not specified'}</p>
                    <p>Branch: {data.customer?.branch?.name || 'Not specified'}</p>
                    <p>Location: {data.customer?.state || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* No data message */}
            {!selectedCustomer && !selectedBusinessType && (!detailedViewItem.business_types || detailedViewItem.business_types.length === 0) && (
              <div className="text-center py-8">
                <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No margin calculations available for this item</p>
                <p className="text-sm text-gray-500 mt-2">
                  Margins are calculated based on business types and credit types
                </p>
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">Item Information:</h4>
                  <div className="text-sm text-yellow-700">
                    <p>Item Name: {detailedViewItem.name || 'Unknown'}</p>
                    <p>Base Price: ₹{detailedViewItem.base_price?.toFixed(2) || '0.00'}</p>
                    <p>Status: {detailedViewItem.is_active ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
