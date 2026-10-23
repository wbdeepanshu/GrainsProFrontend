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
  Users,
  Calculator,
  BarChart3,
  MapPin,
  Settings2,
  Eye,
  Download,
  Check,
  ChevronsUpDown,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ComprehensivePricingAnalysis() {
  // State Management
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showStockItemAnalysis, setShowStockItemAnalysis] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  
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

  // Fetch comprehensive pricing analysis
  const { data: analysisData, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery({
    queryKey: ['comprehensive-pricing-analysis', selectedCustomer?.id, selectedStockItem?.id],
    queryFn: () => fetchComprehensivePricingAnalysis(selectedCustomer?.id, selectedStockItem?.id),
    retry: 1,
    enabled: !!selectedCustomer,
  });

  // Fetch stock items for selection
  const { data: stockItemsData, isLoading: stockItemsLoading } = useQuery({
    queryKey: ['stock-items'],
    queryFn: fetchStockItems,
    retry: 1,
  });

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

  async function fetchStockItems() {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/growth/margin-calculations/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status !== 200) {
        throw new Error(result.message || 'Failed to fetch stock items');
      }

      return result.data?.stock_items || [];
    } catch (error) {
      console.error("Error fetching stock items:", error);
      return [];
    }
  }

  async function fetchComprehensivePricingAnalysis(customerId, stockItemId) {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/accounts/comprehensive-pricing-analysis/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customer_id: customerId,
          stock_item_id: stockItemId,
          include_rule_breakdown: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status !== 200) {
        throw new Error(result.message || 'Failed to fetch comprehensive pricing analysis');
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching comprehensive pricing analysis:", error);
      throw error;
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setSelectedStockItem(null);
    setShowStockItemAnalysis(false);
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

  // Handle stock item selection
  const handleStockItemSelect = (stockItemId) => {
    const stockItem = stockItems.find(item => item.id === parseInt(stockItemId));
    setSelectedStockItem(stockItem);
    setShowStockItemAnalysis(true);
  };

  // Load stock items when customer is selected
  useEffect(() => {
    if (selectedCustomer && analysisData?.stock_item_analysis) {
      // Extract stock items from the analysis data
      const items = analysisData.stock_item_analysis ? [analysisData.stock_item_analysis.stock_item] : [];
      setStockItems(items);
    }
  }, [selectedCustomer, analysisData]);

  if (customersLoading || analysisLoading) {
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
                <BarChart3 className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Comprehensive Pricing Analysis</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAnalysis()}
                className="flex items-center space-x-1"
                disabled={!selectedCustomer}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-6">
            {/* Customer Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customer Selection
                </CardTitle>
                <CardDescription>
                  Select a customer to analyze their comprehensive pricing structure and applicable price rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                            {selectedCustomer ? selectedCustomer.name : "Select a customer for pricing analysis"}
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
                          setSelectedStockItem(null);
                          setShowStockItemAnalysis(false);
                          setCustomerSearchTerm("");
                        }}
                        className="flex items-center gap-2"
                      >
                        Clear Selection
                      </Button>
                    )}
                  </div>
                  
                  {/* Stock Item Selection */}
                  {selectedCustomer && (
                    <div className="flex gap-4 items-center">
                      <div className="flex-1">
                        <Select value={selectedStockItem?.id?.toString()} onValueChange={handleStockItemSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a stock item for detailed analysis (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {stockItemsData?.map((item) => (
                              <SelectItem key={item.id} value={item.id.toString()}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedStockItem && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedStockItem(null);
                            setShowStockItemAnalysis(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          Clear Item
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            {selectedCustomer && analysisData?.customer_info && (
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Users className="h-5 w-5 text-blue-600" />
                    Customer Information
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    Detailed customer attributes affecting pricing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-blue-100">
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        {analysisData.customer_info.customer_type?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Business Type</div>
                      <div className="text-xs text-gray-500 mt-1">
                        +{analysisData.customer_info.customer_type?.margin_percent || 0}% margin
                      </div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-green-100">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {analysisData.customer_info.credit_type?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Credit Type</div>
                      <div className="text-xs text-gray-500 mt-1">
                        +{analysisData.customer_info.credit_type?.margin_percent || 0}% margin
                      </div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-purple-100">
                      <div className="text-2xl font-bold text-purple-600 mb-1">
                        {analysisData.customer_info.state || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">State</div>
                      <div className="text-xs text-gray-500 mt-1">Geographic factor</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-orange-100">
                      <div className="text-2xl font-bold text-orange-600 mb-1">
                        {analysisData.customer_info.city || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">City</div>
                      <div className="text-xs text-gray-500 mt-1">Location factor</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Margin Breakdown */}
            {selectedCustomer && analysisData?.margin_breakdown && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Margin Breakdown
                  </CardTitle>
                  <CardDescription>
                    Base margin components for this customer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        +{analysisData.margin_breakdown.business_type_margin?.toFixed(2) || '0.00'}%
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Business Type</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        +{analysisData.margin_breakdown.credit_type_margin?.toFixed(2) || '0.00'}%
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Credit Type</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 mb-1">
                        +{analysisData.margin_breakdown.geographic_margin?.toFixed(2) || '0.00'}%
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Geographic</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Applicable Price Rules */}
            {selectedCustomer && analysisData?.applicable_price_rules && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Applicable Price Rules ({analysisData.total_applicable_rules || 0})
                  </CardTitle>
                  <CardDescription>
                    All price rules that apply to this customer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analysisData.applicable_price_rules.length === 0 ? (
                    <div className="text-center py-8">
                      <Settings2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No specific price rules apply to this customer</p>
                      <p className="text-sm text-gray-500 mt-1">Only base margins will be applied</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {analysisData.applicable_price_rules.map((rule, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-semibold text-lg">{rule.rule_name}</div>
                              <div className="text-sm text-gray-600">
                                {rule.rule_type} • Priority: {rule.priority}
                              </div>
                              {rule.city_types && (
                                <div className="text-xs text-gray-500 mt-1">
                                  City Types: {rule.city_types}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-orange-600">
                                {rule.rule_type === 'DISCOUNT' ? '-' : '+'}{rule.margin_percent?.toFixed(2) || '0.00'}%
                              </div>
                              <div className="text-sm text-gray-600">
                                {rule.rule_type === 'DISCOUNT' ? 'Discount' : 'Additional'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                            {rule.applies_to.states.length > 0 && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">States:</div>
                                <div className="text-gray-600">
                                  {rule.applies_to.states.map(s => s.name).join(', ')}
                                </div>
                              </div>
                            )}
                            {rule.applies_to.cities.length > 0 && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">Cities:</div>
                                <div className="text-gray-600">
                                  {rule.applies_to.cities.map(c => c.name).join(', ')}
                                </div>
                              </div>
                            )}
                            {rule.applies_to.business_types.length > 0 && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">Business Types:</div>
                                <div className="text-gray-600">
                                  {rule.applies_to.business_types.map(bt => bt.name).join(', ')}
                                </div>
                              </div>
                            )}
                            {rule.applies_to.credit_types.length > 0 && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">Credit Types:</div>
                                <div className="text-gray-600">
                                  {rule.applies_to.credit_types.map(ct => ct.name).join(', ')}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stock Item Analysis */}
            {selectedCustomer && analysisData?.stock_item_analysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Stock Item Analysis
                  </CardTitle>
                  <CardDescription>
                    Detailed pricing breakdown for specific stock items
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Stock Item Info */}
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-lg">{analysisData.stock_item_analysis.stock_item.name}</div>
                          <div className="text-sm text-gray-600">{analysisData.stock_item_analysis.stock_item.description}</div>
                        </div>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          Stock Item ID: {analysisData.stock_item_analysis.stock_item.id}
                        </Badge>
                      </div>
                    </div>

                    {/* Pricing Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          <IndianRupee className="inline h-6 w-6 mr-2" />
                          {analysisData.stock_item_analysis.pricing?.base_price?.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) || '0.00'}
                        </div>
                        <div className="text-sm text-gray-600">Base Price</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          +{analysisData.stock_item_analysis.pricing?.total_margin_percent?.toFixed(2) || '0.00'}%
                        </div>
                        <div className="text-sm text-gray-600">Total Margin %</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          <IndianRupee className="inline h-6 w-6 mr-2" />
                          {analysisData.stock_item_analysis.pricing?.total_margin_amount?.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) || '0.00'}
                        </div>
                        <div className="text-sm text-gray-600">Total Margin Amount</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          <IndianRupee className="inline h-6 w-6 mr-2" />
                          {analysisData.stock_item_analysis.pricing?.final_price?.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) || '0.00'}
                        </div>
                        <div className="text-sm text-gray-600">Final Price</div>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    {analysisData.stock_item_analysis.pricing?.breakdown && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-lg">Detailed Margin Breakdown</h4>
                        
                        {/* Business Type */}
                        {analysisData.stock_item_analysis.pricing.breakdown.business_type && (
                          <div className="border rounded-lg p-3 bg-blue-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">Business Type Margin</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-blue-600">
                                  +{analysisData.stock_item_analysis.pricing.breakdown.business_type.margin_percent?.toFixed(2) || '0.00'}%
                                </div>
                                <div className="text-sm text-gray-600">
                                  <IndianRupee className="inline h-3 w-3 mr-1" />
                                  {analysisData.stock_item_analysis.pricing.breakdown.business_type.margin_amount?.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }) || '0.00'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Credit Type */}
                        {analysisData.stock_item_analysis.pricing.breakdown.credit_type && (
                          <div className="border rounded-lg p-3 bg-green-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-green-600" />
                                <span className="font-medium">Credit Type Margin</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-green-600">
                                  +{analysisData.stock_item_analysis.pricing.breakdown.credit_type.margin_percent?.toFixed(2) || '0.00'}%
                                </div>
                                <div className="text-sm text-gray-600">
                                  <IndianRupee className="inline h-3 w-3 mr-1" />
                                  {analysisData.stock_item_analysis.pricing.breakdown.credit_type.margin_amount?.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }) || '0.00'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Geographic */}
                        {analysisData.stock_item_analysis.pricing.breakdown.geographic && (
                          <div className="border rounded-lg p-3 bg-purple-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-purple-600" />
                                <span className="font-medium">Geographic Margin</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-purple-600">
                                  +{analysisData.stock_item_analysis.pricing.breakdown.geographic.margin_percent?.toFixed(2) || '0.00'}%
                                </div>
                                <div className="text-sm text-gray-600">
                                  <IndianRupee className="inline h-3 w-3 mr-1" />
                                  {analysisData.stock_item_analysis.pricing.breakdown.geographic.margin_amount?.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }) || '0.00'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Price Rules */}
                        {analysisData.stock_item_analysis.pricing.breakdown.price_rules && 
                         analysisData.stock_item_analysis.pricing.breakdown.price_rules.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="font-medium">Applicable Price Rules:</h5>
                            {analysisData.stock_item_analysis.pricing.breakdown.price_rules.map((rule, index) => (
                              <div key={index} className="border rounded-lg p-3 bg-orange-50">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">{rule.rule_name}</div>
                                    <div className="text-sm text-gray-600">
                                      {rule.rule_type} • Priority: {rule.priority}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-orange-600">
                                      {rule.rule_type === 'DISCOUNT' ? '-' : '+'}{rule.margin_percent?.toFixed(2) || '0.00'}%
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
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Customer Selected */}
            {!selectedCustomer && (
              <Card>
                <CardContent className="text-center py-12">
                  <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Customer</h3>
                  <p className="text-gray-600 mb-4">
                    Please select a customer from the dropdown above to view comprehensive pricing analysis
                  </p>
                  <p className="text-sm text-gray-500">
                    This will show all applicable price rules, margin breakdowns, and detailed pricing calculations
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
