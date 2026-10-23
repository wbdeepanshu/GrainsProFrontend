import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, ChevronLeft, ChevronRight, Package, Menu, TrendingUp, RefreshCw, X, Loader2 } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS_PER_PAGE = 25;

export default function LiveStocks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // API Fetch Function
  const fetchLiveStockBalance = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;

    const response = await fetch(`${API_BASE_URL}/api/sales/get-live-stock-balance/`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();

    return {
      data: responseData.data || [],
      count: responseData.count || 0,
      status: responseData.status || 200,
      message: responseData.message || "Stock balance retrieved successfully"
    };
  };

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['live-stock-balance'],
    queryFn: fetchLiveStockBalance,
    enabled: !!AuthService.getAccessToken(),
    staleTime: 1 * 60 * 1000, // 1 minute - live data should refresh frequently
    cacheTime: 2 * 60 * 1000, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Extract stock items data from response
  const allStockItems = useMemo(() => {
    if (!data) return [];
    return data.data || [];
  }, [data]);

  // Filter items based on search term (client-side filtering)
  const filteredItems = useMemo(() => {
    if (!searchTerm) return allStockItems;
    
    const searchLower = searchTerm.toLowerCase();
    return allStockItems.filter(item => {
      const matchesSearch = 
        (item.name && item.name.toLowerCase().includes(searchLower)) ||
        (item.unit && item.unit.toLowerCase().includes(searchLower)) ||
        (item.closing_balance && item.closing_balance.toLowerCase().includes(searchLower));
      
      return matchesSearch;
    });
  }, [allStockItems, searchTerm]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!filteredItems.length) return [];
    
    const sorted = [...filteredItems].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle different data types
      if (sortField === 'quantity') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredItems, sortField, sortDirection]);

  // Paginate sorted results
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage]);

  // Pagination calculations
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startItem = totalItems > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  // Event Handlers
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing data",
      description: "Fetching latest stock balance from Tally...",
    });
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSortField("name");
    setSortDirection("asc");
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const formatQuantity = (quantity) => {
    if (quantity === null || quantity === undefined) return "0.00";
    return parseFloat(quantity).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Generate pagination numbers
  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  // Error handling
  if (error) {
    return (
      <div className="app-layout bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="app-main-content">
          <div className="flex-1 p-6 overflow-auto">
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="mx-auto h-16 w-16 text-red-400 mb-4" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Error Loading Stock Balance
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  {error.message || "Failed to fetch live stock balance from Tally. Please check your Tally server connection."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className="mt-4 flex items-center space-x-2 mx-auto"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>Retry</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return <CommonLoader text="Loading live stock balance from Tally..." />;
  }

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main-content">
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Stocks</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="p-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">View Live Stocks</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Real-time stock balance from Tally system
                </p>
              </div>
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Filters Section */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-600" />
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-8 h-11"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Results Summary */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Items
                  </label>
                  <div className="flex items-center space-x-2 h-11 px-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {allStockItems.length} item{allStockItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Filtered Results */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Filtered Results
                  </label>
                  <div className="flex items-center space-x-2 h-11 px-3 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Clear Filters */}
                {searchTerm && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Actions
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                      className="flex items-center gap-2 h-11 w-full border-gray-300 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="h-3 w-3" />
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stock Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Live Stock Balance</span>
                </div>
                <div className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  {isFetching && (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Refreshing...</span>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalItems > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Stock Item Name</span>
                              <span className="text-xs">{getSortIcon('name')}</span>
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleSort('closing_balance')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Closing Balance</span>
                              <span className="text-xs">{getSortIcon('closing_balance')}</span>
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-right"
                            onClick={() => handleSort('quantity')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Quantity</span>
                              <span className="text-xs">{getSortIcon('quantity')}</span>
                            </div>
                          </TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedItems.map((item, index) => (
                          <TableRow 
                            key={index} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <TableCell>
                              {startItem + index}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center space-x-2">
                                <Package className="h-4 w-4 text-blue-500" />
                                <span>{item.name || 'N/A'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {item.closing_balance || '0.00'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <TrendingUp className={`h-4 w-4 ${(item.quantity || 0) > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                                <span className="font-semibold">
                                  {formatQuantity(item.quantity)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.unit ? (
                                <Badge variant="outline">{item.unit}</Badge>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Showing <span className="font-semibold">{startItem}</span> to{" "}
                        <span className="font-semibold">{endItem}</span> of{" "}
                        <span className="font-semibold">{totalItems}</span> results
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>

                        {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                          page === "..." ? (
                            <span key={idx} className="px-2">...</span>
                          ) : (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </Button>
                          )
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Empty State */
                <div className="text-center py-12">
                  <Package className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                    {allStockItems.length === 0 ? 'No stock items available' : 'No items found'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    {allStockItems.length === 0 
                      ? "Unable to fetch stock balance from Tally. Please check your Tally server connection."
                      : "No items match your current search criteria. Try adjusting your search terms."
                    }
                  </p>
                  {searchTerm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                      className="mt-4 flex items-center space-x-2 mx-auto"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear Search</span>
                    </Button>
                  )}
                  {allStockItems.length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isFetching}
                      className="mt-4 flex items-center space-x-2 mx-auto"
                    >
                      <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                      <span>Retry</span>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
