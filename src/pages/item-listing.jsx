import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { AuthService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Package,
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Table,
  Grid3X3,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Hash,
  Tag,
  Plus,
  Save,
  Loader2,
  ChevronsUpDown,
  Edit,
  Upload,
  Download,
  FileSpreadsheet,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS_PER_PAGE = 20;

export default function ItemListing() {
  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  const [includeInactive, setIncludeInactive] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  // Add Price Modal State
  const [isAddPriceModalOpen, setIsAddPriceModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [basePrice, setBasePrice] = useState("");
  const [uom, setUom] = useState("");
  const [stockItemSearch, setStockItemSearch] = useState("");
  const [stockItemDebounced, setStockItemDebounced] = useState("");
  const [isStockItemDropdownOpen, setIsStockItemDropdownOpen] = useState(false);
  
  // Edit Price Modal State
  const [isEditPriceModalOpen, setIsEditPriceModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editBasePrice, setEditBasePrice] = useState("");
  const [editUom, setEditUom] = useState("");
  
  // Excel Upload State
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Hooks
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce stock item search
  useEffect(() => {
    const timer = setTimeout(() => {
      setStockItemDebounced(stockItemSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [stockItemSearch]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, includeInactive]);

  // Fetch stock item base prices
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stock-item-base-prices', currentPage, debouncedSearchTerm, includeInactive],
    queryFn: () => fetchStockItemBasePrices(currentPage, debouncedSearchTerm, includeInactive),
    retry: 1,
  });

  // Fetch stock items for Add Price modal
  const {
    data: stockItemsPages,
    fetchNextPage: fetchNextStockPage,
    hasNextPage: hasNextStockPage,
    isFetchingNextPage: isFetchingNextStockPage,
    isLoading: stockItemsLoading,
  } = useInfiniteQuery({
    queryKey: ['/api/stock-items-list', 'SO Material', stockItemDebounced],
    queryFn: ({ pageParam = 1, queryKey }) => fetchStockItems(pageParam, queryKey[2]),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: isStockItemDropdownOpen && !!AuthService.getAccessToken(),
    retry: 1,
  });

  const stockItems = stockItemsPages?.pages?.flatMap((page) => page.results) ?? [];

  // Fetch units for UOM dropdown
  const { data: unitsData } = useQuery({
    queryKey: ['units-master'],
    queryFn: async () => {
      try {
        const token = AuthService.getAccessToken();
        if (!token) {
          throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

        const response = await fetch(`${backendUrl}/api/get-unit-masters/`, {
          method: 'GET',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.data || [];
      } catch (error) {
        console.error('Fetch units error:', error);
        return [];
      }
    },
    enabled: !!AuthService.getAccessToken(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const units = unitsData || [];

  // Normalize item from get_stock_item_base_prices: API returns fields under stock_item, support both shapes
  const getItemDisplay = (item) => ({
    base_price: item.stock_item?.base_price ?? item.base_price,
    old_base_price: item.stock_item?.old_base_price ?? item.old_base_price,
    unit_of_measurement: item.stock_item?.unit_of_measurement ?? item.unit_of_measurement,
    uom: item.stock_item?.uom ?? item.uom,
    updated_at: item.stock_item?.updated_at ?? item.updated_at,
    updated_by: item.stock_item?.updated_by ?? item.updated_by,
    created_at: item.stock_item?.created_at ?? item.created_at,
    price_change: item.stock_item?.price_change ?? item.price_change,
    price_change_percent: item.stock_item?.price_change_percent ?? item.price_change_percent,
  });

  // Add modal: UOM options only from selected stock item's base_units_name and secondary_unit
  const addModalUomOptions = useMemo(() => {
    if (!selectedStockItem) return [];
    const base = selectedStockItem.base_units_name?.trim?.() || selectedStockItem.base_units_name;
    const secondary = selectedStockItem.secondary_unit?.trim?.() || selectedStockItem.secondary_unit;
    const opts = [];
    if (base) opts.push({ id: 'base', name: base });
    if (secondary && String(secondary).toLowerCase() !== String(base).toLowerCase()) {
      opts.push({ id: 'secondary', name: secondary });
    }
    return opts;
  }, [selectedStockItem]);

  // Edit modal: UOM options only from editing item's base_unit and alternate_unit (same as Add modal)
  const editModalUomOptions = useMemo(() => {
    if (!editingItem?.stock_item) return [];
    const base = editingItem.stock_item?.base_unit?.name?.trim?.() || editingItem.stock_item?.base_unit?.name;
    const alt = editingItem.stock_item?.alternate_unit?.name?.trim?.() || editingItem.stock_item?.alternate_unit?.name;
    const opts = [];
    if (base) opts.push({ id: 'base', name: base });
    if (alt && String(alt).toLowerCase() !== String(base || '').toLowerCase()) {
      opts.push({ id: 'secondary', name: alt });
    }
    // Include current UOM if set and not already in list (so Select shows current value)
    if (editUom && editUom.trim()) {
      const cur = editUom.trim();
      if (!opts.some((o) => (o.name || '').toLowerCase() === cur.toLowerCase())) {
        opts.unshift({ id: 'current-uom', name: cur });
      }
    }
    return opts;
  }, [editingItem, editUom]);

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateStockItemBasePrices,
    onSuccess: (data) => {
      const action = editingItem ? "updated" : "added";
      toast({
        title: "Success",
        description: `Successfully ${action} stock item price.`,
        variant: "default",
      });
      // Reset forms first
      setSelectedStockItem(null);
      setBasePrice("");
      setUom("");
      setStockItemSearch("");
      setIsAddPriceModalOpen(false);
      setEditingItem(null);
      setEditBasePrice("");
      setEditUom("");
      setIsEditPriceModalOpen(false);
      // If adding a new item, reset to page 1 to see the new item
      if (!editingItem) {
        setCurrentPage(1);
      }
      // Invalidate all queries with this prefix to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['stock-item-base-prices'] });
      // Refetch will happen automatically due to query invalidation and page change
    },
    onError: (error) => {
      // Extract detailed error message
      let errorMessage = error.message || "Failed to update stock item prices.";
      
      // If error has response data with errors, show them
      if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        const errorDetails = error.response.data.errors.map(e => e.error || 'Unknown error').join('; ');
        errorMessage = `${errorMessage} Details: ${errorDetails}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  async function fetchStockItemBasePrices(page = 1, search = "", includeInactive = false) {
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
      params.append('page_size', ITEMS_PER_PAGE.toString());
      if (search.trim()) {
        params.append('search', search.trim());
      }
      if (includeInactive) {
        params.append('include_inactive', 'true');
      }

      const response = await fetch(`${backendUrl}/api/growth/get-base-prices/?${params.toString()}`, {
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

      if (result.status !== 200) {
        throw new Error(result.message || 'Failed to fetch stock item base prices');
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching stock item base prices:", error);
      throw error;
    }
  }

  async function fetchStockItems(page = 1, search = "") {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const searchTerm = String(search ?? "").trim();
      const requestBody = {
        type: "SO Material",
        list_mode: "default",
        stock_group: "",
        stock_category: "",
        is_active: true,
        new_page: page,
        per_page: 50,
      };
      if (searchTerm) {
        requestBody.search = searchTerm;
      }

      const response = await fetch(`${backendUrl}/api/stock-items-list/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status && Number(result.status) >= 400) {
        throw new Error(result.message || 'Failed to fetch stock items');
      }

      return {
        results: result.data || [],
        nextPage: result.pagination?.has_next ? page + 1 : undefined,
        pagination: result.pagination || {
          current_page: page,
          per_page: 50,
          total_pages: 1,
          has_next: false,
          has_previous: false,
          next_page: null,
          previous_page: null
        },
        total_count: result.total_count || 0
      };
    } catch (error) {
      console.error("Error fetching stock items:", error);
      throw error;
    }
  }

  /** Fetch every stock item base-price row from the listing API (all pages). */
  async function fetchAllStockItemBasePrices(includeInactiveFlag = false) {
    const allItems = [];
    let page = 1;
    let hasNext = true;
    const pageSize = 200;

    while (hasNext) {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("page_size", String(pageSize));
      if (includeInactiveFlag) {
        params.append("include_inactive", "true");
      }

      const response = await fetch(
        `${backendUrl}/api/growth/get-base-prices/?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.status !== 200) {
        throw new Error(result.message || "Failed to fetch stock item base prices");
      }

      const batch = result.data?.stock_items || [];
      allItems.push(...batch);

      const pagination = result.data?.pagination || {};
      if (pagination.has_next) {
        page += 1;
      } else {
        hasNext = false;
      }
    }

    return allItems;
  }

  async function bulkUpdateStockItemBasePrices(stockItemPrices) {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/growth/stock-base-prices/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          stock_item_prices: stockItemPrices
        })
      });

      const result = await response.json();

      // Handle partial success (207 status) or errors
      if (result.status === 207) {
        // Multi-status: some items succeeded, some failed
        const errorDetails = result.data?.errors?.length > 0 
          ? result.data.errors.map(e => {
              const stockItemId = e.stock_item_id || 'unknown';
              const errorMsg = e.error || 'Unknown error';
              return `Stock Item ID ${stockItemId}: ${errorMsg}`;
            }).join('; ')
          : 'Unknown error occurred';
        const errorMessage = `${result.message}. ${errorDetails}`;
        const error = new Error(errorMessage);
        error.response = { data: result };
        throw error;
      }
      
      if (result.status !== 200) {
        const errorDetails = result.data?.errors?.length > 0 
          ? result.data.errors.map(e => {
              const stockItemId = e.stock_item_id || 'unknown';
              const errorMsg = e.error || 'Unknown error';
              return `Stock Item ID ${stockItemId}: ${errorMsg}`;
            }).join('; ')
          : result.message || 'Failed to update stock item base prices';
        const error = new Error(errorDetails);
        error.response = { data: result };
        throw error;
      }

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.response = { data: result };
        throw error;
      }

      return result.data;
    } catch (error) {
      console.error("Error updating stock item base prices:", error);
      throw error;
    }
  }

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
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/growth/download-excel-template/`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : 'stock_item_base_prices_template.xlsx';

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

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

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Stock item base prices have been refreshed.",
      variant: "default",
    });
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleAddPrice = () => {
    if (!selectedStockItem || !basePrice) {
      toast({
        title: "Validation Error",
        description: "Please select a stock item and enter a base price.",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(basePrice);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid base price (positive number).",
        variant: "destructive",
      });
      return;
    }

    const stockItemPrices = [{
      stock_item_id: selectedStockItem.id,
      base_price: price,
      uom: uom && uom.trim() !== "" && uom !== "none" ? uom.trim() : undefined
    }];

    bulkUpdateMutation.mutate(stockItemPrices);
  };

  const handleStockItemSelect = (stockItem) => {
    setSelectedStockItem(stockItem);
    setStockItemSearch(stockItem.name);
    setIsStockItemDropdownOpen(false);
  };

  const handleEditPrice = (item) => {
    setEditingItem(item);
    const display = getItemDisplay(item);
    const price = display.base_price ?? item.stock_item?.base_unit?.price;
    setEditBasePrice(price != null ? String(price) : "");
    // Set UOM from unit_of_measurement (object) or uom (string) so user can change unit if required
    const currentUom = typeof display.unit_of_measurement === 'object' && display.unit_of_measurement?.name
      ? display.unit_of_measurement.name
      : (display.uom || "");
    setEditUom(currentUom);
    setIsEditPriceModalOpen(true);
  };

  const handleUpdatePrice = () => {
    if (!editingItem || !editBasePrice) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid base price.",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(editBasePrice);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid base price (positive number).",
        variant: "destructive",
      });
      return;
    }

    const stockItemPrices = [{
      stock_item_id: editingItem.stock_item.id,
      base_price: price,
      uom: editUom && editUom.trim() !== "" && editUom !== "none" ? editUom.trim() : undefined
    }];

    bulkUpdateMutation.mutate(stockItemPrices);
  };

  // Use stockItems directly - API already handles search filtering
  // No need for client-side filtering as it conflicts with pagination

  const handleExcelFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

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

    setSelectedExcelFile(file);
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
        variant: "default",
      });

      // Show detailed errors if any
      if (errors.length > 0) {
        console.warn("Upload errors:", errors);
      }
      if (not_found_items.length > 0) {
        console.warn("Items not found:", not_found_items);
      }

      // Refresh the data
      queryClient.invalidateQueries(['stock-item-base-prices']);
      
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

  // Excel template with all stock items from the base-price listing
  const handleDownloadStaticTemplate = async () => {
    try {
      const XLSX = await import('xlsx');

      toast({
        title: "Preparing template",
        description: "Loading all stock items…",
        variant: "default",
      });

      const listingItems = await fetchAllStockItemBasePrices(includeInactive);

      const templateRows = [
        ['stock_item_name', 'base_price', 'uom'],
        ...listingItems.map((item) => {
          const display = getItemDisplay(item);
          const uomName =
            (typeof display.unit_of_measurement === 'object' && display.unit_of_measurement?.name)
              || display.uom
              || item.stock_item?.base_unit?.name
              || '';
          return [
            item.stock_item?.name || '',
            display.base_price != null && display.base_price !== '' ? display.base_price : '',
            uomName || '',
          ];
        }),
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(templateRows);

      ws['!cols'] = [
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Stock Item Base Prices');
      XLSX.writeFile(wb, 'stock_item_base_prices_template.xlsx');

      toast({
        title: "Template Downloaded",
        description: listingItems.length
          ? `Excel includes ${listingItems.length} stock item(s).`
          : "Excel template downloaded (no stock items found).",
        variant: "default",
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to generate template. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isStockItemDropdownOpen && !event.target.closest('.stock-item-dropdown')) {
        setIsStockItemDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStockItemDropdownOpen]);

  const formatPrice = (price) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

  // Insert a space after ₹ if not already present
  return formatted.replace(/^(\D)/, '$1 ');
};

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriceChangeIcon = (priceChange) => {
    if (priceChange > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (priceChange < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />;
  };

  const getPriceChangeColor = (priceChange) => {
    if (priceChange > 0) return "text-green-600";
    if (priceChange < 0) return "text-red-600";
    return "text-gray-600";
  };

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Error Loading Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{error.message}</p>
                <Button onClick={handleRefresh} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Item Base Price Listing</h1>
                <p className="text-gray-600">View and manage stock item base prices</p>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={isAddPriceModalOpen} onOpenChange={setIsAddPriceModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Stock Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Stock Item Base Price</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="stock-item">Stock Item</Label>
                        <div className="relative stock-item-dropdown">
                          <Input
                            id="stock-item"
                            placeholder="Search and select stock item..."
                            value={stockItemSearch}
                            onChange={(e) => {
                              setStockItemSearch(e.target.value);
                              setIsStockItemDropdownOpen(true);
                            }}
                            onFocus={() => setIsStockItemDropdownOpen(true)}
                          />
                          {selectedStockItem && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-md space-y-1.5">
                              <div className="font-medium text-gray-900">{selectedStockItem.name}</div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-gray-600">
                                <span>
                                  <span className="font-medium text-gray-700">Base unit:</span>{' '}
                                  {selectedStockItem.base_units_name ?? '—'}
                                </span>
                                <span>
                                  <span className="font-medium text-gray-700">Alternate unit:</span>{' '}
                                  {selectedStockItem.secondary_unit ?? '—'}
                                </span>
                              </div>
                            </div>
                          )}
                          {isStockItemDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {stockItemsLoading && stockItems.length === 0 ? (
                                <div className="p-2 text-center">
                                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                </div>
                              ) : stockItems.length > 0 ? (
                                <>
                                  {stockItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                      onClick={() => handleStockItemSelect(item)}
                                    >
                                      <div className="font-medium">{item.name}</div>
                                      <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                        <span>ID: {item.id}</span>
                                        {item.parent && (
                                          <>
                                            <span>•</span>
                                            <span>Group: {item.parent}</span>
                                          </>
                                        )}
                                        {item.base_units_name && (
                                          <>
                                            <span>•</span>
                                            <span>Unit: {item.base_units_name}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {hasNextStockPage && (
                                    <div className="p-2 text-center border-t bg-gray-50">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchNextStockPage()}
                                        disabled={isFetchingNextStockPage}
                                        className="w-full"
                                      >
                                        {isFetchingNextStockPage ? (
                                          <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Loading...
                                          </>
                                        ) : (
                                          <>
                                            Load More
                                            {(() => {
                                              // Get total_count from the first page (it's the same across all pages)
                                              const firstPage = stockItemsPages?.pages?.[0];
                                              const totalCount = firstPage?.total_count;
                                              return totalCount ? (
                                                <span className="ml-2 text-xs text-gray-500">
                                                  ({stockItems.length} of {totalCount})
                                                </span>
                                              ) : null;
                                            })()}
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                  {!hasNextStockPage && (() => {
                                    const firstPage = stockItemsPages?.pages?.[0];
                                    const totalCount = firstPage?.total_count;
                                    return totalCount && stockItems.length > 0 ? (
                                      <div className="p-2 text-center border-t bg-gray-50 text-xs text-gray-500">
                                        Showing all {stockItems.length} of {totalCount} items
                                      </div>
                                    ) : null;
                                  })()}
                                </>
                              ) : (
                                <div className="p-2 text-center text-gray-500">
                                  {stockItemSearch ? `No stock items found for "${stockItemSearch}"` : 'No stock items found'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="base-price">Base Price (₹)</Label>
                        <Input
                          id="base-price"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter base price..."
                          value={basePrice}
                          onChange={(e) => setBasePrice(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="uom">Unit of Measurement (Optional)</Label>
                        <Select
                          value={uom && uom !== "" ? uom : undefined}
                          onValueChange={(value) => {
                            if (value === "none") {
                              setUom("");
                            } else {
                              setUom(value);
                            }
                          }}
                          disabled={!selectedStockItem || addModalUomOptions.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={selectedStockItem ? "Select base or alternate unit" : "Select a stock item first"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Use stock item base unit)</SelectItem>
                            {addModalUomOptions.map((unit) => (
                              <SelectItem key={unit.id} value={unit.name}>
                                {unit.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          {selectedStockItem ? "Choose base unit or alternate unit for this item" : "Select a stock item to choose unit"}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddPriceModalOpen(false);
                            setSelectedStockItem(null);
                            setBasePrice("");
                            setUom("");
                            setStockItemSearch("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddPrice}
                          disabled={bulkUpdateMutation.isPending}
                        >
                          {bulkUpdateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Add Stock Item
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Edit Price Modal */}
                <Dialog open={isEditPriceModalOpen} onOpenChange={setIsEditPriceModalOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Stock Item Base Price</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {editingItem && (
                        <div className="space-y-2">
                          <div className="p-3 bg-gray-50 rounded-md space-y-1.5">
                            <div className="font-medium text-gray-900">{editingItem.stock_item?.name}</div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-gray-600">
                              <span>
                                <span className="font-medium text-gray-700">Base unit:</span>{' '}
                                {editingItem.stock_item?.base_unit?.name ?? '—'}
                              </span>
                              <span>
                                <span className="font-medium text-gray-700">Alternate unit:</span>{' '}
                                {editingItem.stock_item?.alternate_unit?.name ?? '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="edit-base-price">Base Price (₹)</Label>
                        <Input
                          id="edit-base-price"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter new base price..."
                          value={editBasePrice}
                          onChange={(e) => setEditBasePrice(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-uom">Unit of Measurement (change if required)</Label>
                        <Select
                          value={editUom && editUom !== "" ? editUom : "none"}
                          onValueChange={(value) => {
                            if (value === "none") {
                              setEditUom("");
                            } else {
                              setEditUom(value);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Use stock item base unit)</SelectItem>
                            {editModalUomOptions.map((unit) => (
                              <SelectItem key={unit.id || unit.name} value={unit.name}>
                                {unit.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          Choose base unit or alternate unit for this item
                        </p>
                      </div>
                      {editingItem && (getItemDisplay(editingItem).old_base_price ?? 0) > 0 && (
                        <div className="space-y-2">
                          <Label>Current Old Price</Label>
                          <div className="p-3 bg-gray-50 rounded-md">
                            <div className="font-medium">{formatPrice(getItemDisplay(editingItem).old_base_price)}</div>
                            <div className="text-sm text-gray-500">This will be updated when you save</div>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditPriceModalOpen(false);
                            setEditingItem(null);
                            setEditBasePrice("");
                            setEditUom("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleUpdatePrice}
                          disabled={bulkUpdateMutation.isPending}
                        >
                          {bulkUpdateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Update Price
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Excel Upload Section */}
                <div className="flex items-center gap-2">
                  {/* Download Template Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadStaticTemplate}
                    className="h-9 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Template
                  </Button>
                  
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelFileSelect}
                      className="hidden"
                      id="excel-upload"
                      disabled={isUploadingExcel}
                    />
                    <label
                      htmlFor="excel-upload"
                      className={`inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                        isUploadingExcel
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingExcel ? 'Uploading...' : 'Upload Excel'}
                    </label>
                  </div>
                  
                  {selectedExcelFile && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <FileSpreadsheet className="h-4 w-4" />
                        {selectedExcelFile.name}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExcelUpload}
                        disabled={isUploadingExcel}
                        className="h-8"
                      >
                        {isUploadingExcel ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedExcelFile(null);
                          setUploadProgress(0);
                        }}
                        disabled={isUploadingExcel}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Upload Progress */}
                {isUploadingExcel && uploadProgress > 0 && (
                  <div className="w-32">
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {uploadProgress}%
                    </div>
                  </div>
                )}
                
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />

                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by item name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <Table className="h-4 w-4 mr-2" />

              </Button>
              <Button
                variant={viewMode === 'card' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('card')}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />

              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <CommonLoader />
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6">


                {/* Items Display */}
                {data?.stock_items && data.stock_items.length > 0 ? (
                  <>
                    {viewMode === 'table' ? (
                      <Card>
                        <CardHeader>
                          <CardTitle>Stock Items Base Prices</CardTitle>
                          <CardDescription>
                            Showing {data.pagination?.start_index || 0} to {data.pagination?.end_index || 0} of {data.pagination?.total_count || 0} items
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-black text-white">
                                <tr className="border-b">
                                  <th className="text-left py-3 px-4 font-medium">Item Details</th>
                                  <th className="text-left py-3 px-4 font-medium">Base Price</th>
                                  <th className="text-left py-3 px-4 font-medium">UOM</th>
                                  <th className="text-left py-3 px-4 font-medium">Old Price</th>
{/*                                   <th className="text-left py-3 px-4 font-medium">Price Change</th> */}
                                  <th className="text-left py-3 px-4 font-medium">Created</th>
                                  <th className="text-left py-3 px-4 font-medium">Updated By</th>
                                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.stock_items.map((item) => {
                                  const d = getItemDisplay(item);
                                  return (
                                  <tr key={item.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                      <div>
                                        <p className="font-medium text-gray-900">{item.stock_item?.name}</p>

                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">

                                        <span className="font-medium text-gray-900">
                                          {formatPrice(d.base_price)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline" className="text-xs">
                                        {d.unit_of_measurement?.name || d.uom || item.stock_item?.base_unit?.name || 'N/A'}
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="text-gray-600">
                                        {(d.old_base_price ?? 0) > 0 ? formatPrice(d.old_base_price) : formatPrice(d.base_price)}
                                      </span>
                                    </td>
{/*                                     <td className="py-3 px-4"> */}
{/*                                       <div className="flex items-center gap-2"> */}
{/*                                         {getPriceChangeIcon(item.price_change)} */}
{/*                                         <span className={`font-medium ${getPriceChangeColor(item.price_change)}`}> */}
{/*                                           {item.price_change > 0 ? '+' : ''}{formatPrice(item.price_change)} */}
{/*                                         </span> */}
{/*                                         {item.price_change_percent !== 0 && ( */}
{/*                                           <Badge variant="outline" className={getPriceChangeColor(item.price_change)}> */}
{/*                                             {item.price_change_percent > 0 ? '+' : ''}{item.price_change_percent}% */}
{/*                                           </Badge> */}
{/*                                         )} */}
{/*                                       </div> */}
{/*                                     </td> */}

                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-1 text-sm text-gray-500">
                                        <Calendar className="h-3 w-3" />
                                        {d.updated_at}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-1 text-sm text-gray-500">
                                        <Calendar className="h-3 w-3" />
                                        {d.updated_by}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEditPrice(item)}
                                        className="h-8 w-8 p-0"
                                        title="Edit Price"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.stock_items.map((item) => {
                          const d = getItemDisplay(item);
                          return (
                          <Card key={item.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-lg line-clamp-2">{item.stock_item?.name}</CardTitle>

                                </div>

                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Base Price:</span>
                                  <div className="flex items-center gap-1">

                                    <span className="font-medium text-gray-900">
                                      {formatPrice(d.base_price)}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Unit of Measurement:</span>
                                  <Badge variant="outline" className="text-xs">
                                    {d.unit_of_measurement?.name || d.uom || item.stock_item?.base_unit?.name || 'N/A'}
                                  </Badge>
                                </div>

                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Old Price:</span>
                                    <span className="text-gray-600">
                                      {(d.old_base_price ?? 0) > 0 ? formatPrice(d.old_base_price) : formatPrice(d.base_price)}
                                    </span>
                                  </div>

                                

                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Price Change:</span>
                                    <div className="flex items-center gap-2">
                                      {getPriceChangeIcon(d.price_change ?? 0)}
                                      <span className={`font-medium ${getPriceChangeColor(d.price_change ?? 0)}`}>
                                        {(d.price_change ?? 0) > 0 ? '+' : ''}{formatPrice(d.price_change ?? 0)}
                                      </span>
                                      {(d.price_change_percent ?? 0) !== 0 && (
                                        <Badge variant="outline" className={getPriceChangeColor(d.price_change ?? 0)}>
                                          {(d.price_change_percent ?? 0) > 0 ? '+' : ''}{d.price_change_percent}%
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                <Separator />
                                
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>Created:</span>
                                  <span>{formatDate(d.created_at)}</span>
                                </div>

                                
                                <Separator />
                                
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditPrice(item)}
                                    className="h-8"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Price
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    )}

                    {/* Pagination */}
                    {data.pagination && data.pagination.total_pages > 1 && (
                      <div className="flex items-center justify-between mt-6">
                        <div className="text-sm text-gray-700">
                          Showing {data.pagination.start_index} to {data.pagination.end_index} of {data.pagination.total_count} results
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={!data.pagination.has_previous}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, data.pagination.total_pages) }, (_, i) => {
                              const pageNum = i + 1;
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={!data.pagination.has_next}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
                      <p className="text-gray-600 mb-4">
                        {searchTerm ? 'No items match your search criteria.' : 'No stock items with base prices found.'}
                      </p>
                      {searchTerm && (
                        <Button variant="outline" onClick={() => setSearchTerm('')}>
                          Clear Search
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
