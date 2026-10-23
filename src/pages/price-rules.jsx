import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, ChevronLeft, ChevronRight, Settings2, CheckCircle, XCircle, Menu, RefreshCw, Filter, X, Plus, Edit, Trash2 } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS_PER_PAGE = 25;

const RULE_TYPES = [
  { value: "ADDITIONAL", label: "Additional" },
  { value: "DISCOUNT", label: "Discount" },
  { value: "OVERRIDE", label: "Override" },
];

const CITY_TYPES = [
  { value: "METRO", label: "Metro" },
  { value: "TIER_1", label: "Tier 1" },
  { value: "TIER_2", label: "Tier 2" },
  { value: "TIER_3", label: "Tier 3" },
  { value: "RURAL", label: "Rural" },
];

export default function PriceRules() {
  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Related data state
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [cities, setCities] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [creditTypes, setCreditTypes] = useState([]);
  const [stockGroups, setStockGroups] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [relatedDataLoaded, setRelatedDataLoaded] = useState(false);
  
  // Form state - Updated for ManyToMany fields
  const [formData, setFormData] = useState({
    rule_name: "",
    rule_type: "",
    priority: "",
    margin_percent: "",
    state_ids: [],
    district_ids: [],
    city_ids: [],
    city_types: "",
    stock_group_ids: [],
    stock_item_ids: [],
    business_type_ids: [],
    credit_type_ids: [],
    branch_ids: [],
    customer_ids: [],
    valid_from: "",
    valid_to: "",
    is_active: true
  });
  
  // Hooks
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Load related data on component mount
  useEffect(() => {
    const loadRelatedData = async () => {
      try {
        // console.log('Loading related data...');
        const data = await fetchRelatedData();
        // console.log('Related data loaded:', data);
        
        setStates(data.states || []);
        setDistricts(data.districts || []);
        setCities(data.cities || []);
        setBusinessTypes(data.businessTypes || []);
        setCreditTypes(data.creditTypes || []);
        setStockGroups(data.stockGroups || []);
        setStockItems(data.stockItems || []);
        setBranches(data.branches || []);
        setCustomers(data.customers || []);
        setRelatedDataLoaded(true);
        
        // console.log('Related data state updated successfully');
      } catch (error) {
        console.error("Error loading related data:", error);
        // Set empty arrays to prevent UI from breaking
        setStates([]);
        setDistricts([]);
        setCities([]);
        setBusinessTypes([]);
        setCreditTypes([]);
        setStockGroups([]);
        setStockItems([]);
        setBranches([]);
        setCustomers([]);
        setRelatedDataLoaded(true);
      }
    };

    loadRelatedData();
  }, []);

  // API Fetch Function
  const fetchPriceRules = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const params = new URLSearchParams({
        page: "1",
        page_size: "500",
      });

      const response = await fetch(`${backendUrl}/api/accounts/price-margin-rules/?${params}`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching price rules:", error);
      throw error;
    }
  };

  // Fetch related data for dropdowns
  const fetchRelatedData = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        console.error("No authentication token found");
        return { states: [], districts: [], cities: [], businessTypes: [], creditTypes: [], stockGroups: [], stockItems: [], branches: [], customers: [] };
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      // console.log('Fetching related data from:', backendUrl);

      const [statesRes, districtsRes, citiesRes, businessTypesRes, creditTypesRes, stockGroupsRes, stockItemsRes, branchesRes, customersRes] = await Promise.all([
        fetch(`${backendUrl}/api/accounts/states/?page_size=1000`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/accounts/districts/?page_size=1000`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/accounts/cities/?page_size=1000`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/accounts/business-types/?page_size=1000`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/accounts/credit-types/?page_size=1000`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/get-stock-groups/`, {
          method: 'POST',
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ "is_active": true })
        }),
        fetch(`${backendUrl}/api/stock-items/`, {
          method: 'POST',
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }),
        fetch(`${backendUrl}/api/get-branches/`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/report/get-ledgers/`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      // Debug: Check response status codes
      // console.log('API Response Status Codes:', {
      //   states: statesRes.status,
      //   districts: districtsRes.status,
      //   cities: citiesRes.status,
      //   businessTypes: businessTypesRes.status,
      //   creditTypes: creditTypesRes.status,
      //   stockGroups: stockGroupsRes.status,
      //   stockItems: stockItemsRes.status,
      //   branches: branchesRes.status,
      //   customers: customersRes.status
      // });

      const [states, districts, cities, businessTypes, creditTypes, stockGroups, stockItems, branches, customers] = await Promise.all([
        statesRes.json().then(data => {
          // console.log('States API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing states response:', err);
          return [];
        }),
        districtsRes.json().then(data => {
          // console.log('Districts API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing districts response:', err);
          return [];
        }),
        citiesRes.json().then(data => {
          // console.log('Cities API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing cities response:', err);
          return [];
        }),
        businessTypesRes.json().then(data => {
          // console.log('Business Types API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing business types response:', err);
          return [];
        }),
        creditTypesRes.json().then(data => {
          // console.log('Credit Types API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing credit types response:', err);
          return [];
        }),
        stockGroupsRes.json().then(data => {
          // console.log('Stock Groups API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing stock groups response:', err);
          return [];
        }),
        stockItemsRes.json().then(data => {
          // console.log('Stock Items API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing stock items response:', err);
          return [];
        }),
        branchesRes.json().then(data => {
          // console.log('Branches API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing branches response:', err);
          return [];
        }),
        customersRes.json().then(data => {
          // console.log('Customers API Response:', data);
          return data.data || [];
        }).catch(err => {
          console.error('Error parsing customers response:', err);
          return [];
        })
      ]);

      return { states, districts, cities, businessTypes, creditTypes, stockGroups, stockItems, branches, customers };
    } catch (error) {
      console.error("Error fetching related data:", error);
      return { states: [], districts: [], cities: [], businessTypes: [], creditTypes: [], stockGroups: [], stockItems: [], branches: [], customers: [] };
    }
  };

  // Create/Update Function
  const createUpdatePriceRule = async (data) => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || API_BASE_URL;

      const response = await fetch(`${backendUrl}/api/accounts/create-price-margin-rule/`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error creating/updating price rule:", error);
      throw error;
    }
  };

  // React Query hooks
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['price-rules'],
    queryFn: fetchPriceRules,
    retry: 1,
  });


  const createUpdateMutation = useMutation({
    mutationFn: createUpdatePriceRule,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['price-rules']);
      toast({
        title: "Success",
        description: data.message || "Price rule saved successfully",
      });
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save price rule",
        variant: "destructive",
      });
    },
  });

  // Computed values
  const priceRules = data?.data || [];

  const getPriceRuleSearchText = (item) => {
    const parts = [
      item.rule_name,
      item.rule_type,
      item.priority,
      item.margin_percent,
      item.city_types,
      item.valid_from,
      item.valid_to,
    ];
    [
      "states_data",
      "districts_data",
      "cities_data",
      "stock_groups_data",
      "stock_items_data",
      "business_types_data",
      "credit_types_data",
      "branches_data",
      "customers_data",
    ].forEach((field) => {
      const entries = item[field];
      if (Array.isArray(entries)) {
        entries.forEach((entry) => {
          parts.push(entry?.name || entry?.title || entry?.label);
        });
      }
    });
    return parts.filter(Boolean).join(" ").toLowerCase();
  };

  const filteredPriceRules = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return priceRules;
    return priceRules.filter((item) => getPriceRuleSearchText(item).includes(term));
  }, [priceRules, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPriceRules.length / ITEMS_PER_PAGE));

  const paginatedPriceRules = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPriceRules.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPriceRules, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);
  
  // Debug: Log the data to see what's being received
  // console.log('Related data received:', {
  //   states: states.length,
  //   districts: districts.length,
  //   cities: cities.length,
  //   businessTypes: businessTypes.length,
  //   creditTypes: creditTypes.length,
  //   stockGroups: stockGroups.length,
  //   stockItems: stockItems.length,
  //   branches: branches.length,
  //   customers: customers.length
  // });
  
  // Helper function to get the correct field name for display
  const getDisplayName = (item, fallback = 'name') => {
    if (!item) return '';
    return item.name || item.title || item.label || item.display_name || item[fallback] || 'Unknown';
  };

  // Debug: Log sample data to see structure
  if (states.length > 0) {
    // console.log('Sample state data:', states[0]);
    // console.log('State data keys:', Object.keys(states[0]));
  }
  if (businessTypes.length > 0) {
    // console.log('Sample business type data:', businessTypes[0]);
    // console.log('Business type data keys:', Object.keys(businessTypes[0]));
  }
  if (stockGroups.length > 0) {
    // console.log('Sample stock group data:', stockGroups[0]);
    // console.log('Stock group data keys:', Object.keys(stockGroups[0]));
  }
  if (customers.length > 0) {
    // console.log('Sample customer data:', customers[0]);
    // console.log('Customer data keys:', Object.keys(customers[0]));
  }

  // Form handlers
  const resetForm = () => {
    setFormData({
      rule_name: "",
      rule_type: "",
      priority: "",
      margin_percent: "",
      state_ids: [],
      district_ids: [],
      city_ids: [],
      city_types: "",
      stock_group_ids: [],
      stock_item_ids: [],
      business_type_ids: [],
      credit_type_ids: [],
      branch_ids: [],
      customer_ids: [],
      valid_from: "",
      valid_to: "",
      is_active: true
    });
    setEditingItem(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayFieldChange = (field, value, checked) => {
    setFormData(prev => {
      const currentArray = prev[field] || [];
      if (checked) {
        return {
          ...prev,
          [field]: [...currentArray, value]
        };
      } else {
        return {
          ...prev,
          [field]: currentArray.filter(id => id !== value)
        };
      }
    });
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      rule_name: item.rule_name || "",
      rule_type: item.rule_type || "",
      priority: item.priority || "",
      margin_percent: item.margin_percent || "",
      state_ids: item.states_data?.map(s => s.id) || [],
      district_ids: item.districts_data?.map(d => d.id) || [],
      city_ids: item.cities_data?.map(c => c.id) || [],
      city_types: item.city_types || "",
      stock_group_ids: item.stock_groups_data?.map(sg => sg.id) || [],
      stock_item_ids: item.stock_items_data?.map(si => si.id) || [],
      business_type_ids: item.business_types_data?.map(bt => bt.id) || [],
      credit_type_ids: item.credit_types_data?.map(ct => ct.id) || [],
      branch_ids: item.branches_data?.map(b => b.id) || [],
      customer_ids: item.customers_data?.map(c => c.id) || [],
      valid_from: item.valid_from || "",
      valid_to: item.valid_to || "",
      is_active: item.is_active
    });
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.rule_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Rule name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.rule_type) {
      toast({
        title: "Validation Error",
        description: "Rule type selection is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.priority || isNaN(parseInt(formData.priority))) {
      toast({
        title: "Validation Error",
        description: "Valid priority is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.margin_percent || isNaN(parseFloat(formData.margin_percent))) {
      toast({
        title: "Validation Error",
        description: "Valid margin percentage is required",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
      priority: parseInt(formData.priority),
      margin_percent: parseFloat(formData.margin_percent),
      // Remove empty arrays and strings
      state_ids: formData.state_ids.length > 0 ? formData.state_ids : undefined,
      district_ids: formData.district_ids.length > 0 ? formData.district_ids : undefined,
      city_ids: formData.city_ids.length > 0 ? formData.city_ids : undefined,
      city_types: formData.city_types || undefined,
      stock_group_ids: formData.stock_group_ids.length > 0 ? formData.stock_group_ids : undefined,
      stock_item_ids: formData.stock_item_ids.length > 0 ? formData.stock_item_ids : undefined,
      business_type_ids: formData.business_type_ids.length > 0 ? formData.business_type_ids : undefined,
      credit_type_ids: formData.credit_type_ids.length > 0 ? formData.credit_type_ids : undefined,
      branch_ids: formData.branch_ids.length > 0 ? formData.branch_ids : undefined,
      customer_ids: formData.customer_ids.length > 0 ? formData.customer_ids : undefined,
      valid_from: formData.valid_from || undefined,
      valid_to: formData.valid_to || undefined,
    };

    createUpdateMutation.mutate(submitData);
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  // Loading state
  if (isLoading && !data) {
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
                <Settings2 className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Price Rules</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                onClick={handleCreate}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Price Rule</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Search and Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search price rules..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center space-x-1"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Rules List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Price Rules ({filteredPriceRules.length}
                  {searchTerm.trim() && filteredPriceRules.length !== priceRules.length
                    ? ` of ${priceRules.length}`
                    : ""}
                  )
                </span>
                {filteredPriceRules.length > 0 && (
                  <Badge variant="secondary">
                    Page {currentPage} of {totalPages}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPriceRules.length === 0 ? (
                <div className="text-center py-8">
                  <Settings2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm.trim() ? "No price rules match your search" : "No price rules found"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm.trim() ? "Try adjusting your search criteria" : "Get started by creating your first price rule"}
                  </p>
                  {!searchTerm.trim() && (
                    <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Price Rule
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Rule Name</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Priority</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Margin %</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Location</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Created</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPriceRules.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{item.rule_name}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{item.rule_type}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary">{item.priority}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={item.margin_percent >= 0 ? "default" : "destructive"}>
                                {item.margin_percent > 0 ? "+" : ""}{item.margin_percent}%
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-gray-600">
                                {(() => {
                                  const locations = [];
                                  if (item.states_data?.length > 0) {
                                    locations.push(`States: ${item.states_data.map(s => s.name).join(", ")}`);
                                  }
                                  if (item.cities_data?.length > 0) {
                                    locations.push(`Cities: ${item.cities_data.map(c => c.name).join(", ")}`);
                                  }
                                  return locations.length > 0 ? locations.join(" | ") : "Global";
                                })()}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                {item.is_active ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className={`text-sm ${item.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-500">
                        Showing {filteredPriceRules.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredPriceRules.length)} of{" "}
                        {filteredPriceRules.length} results
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
                        <span className="text-sm text-gray-500">
                          Page {currentPage} of {totalPages}
                        </span>
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Price Rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rule_name">Rule Name *</Label>
                <Input
                  id="rule_name"
                  value={formData.rule_name}
                  onChange={(e) => handleInputChange('rule_name', e.target.value)}
                  placeholder="Enter rule name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rule_type">Rule Type *</Label>
                <Select value={formData.rule_type} onValueChange={(value) => handleInputChange('rule_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority *</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  placeholder="Enter priority (lower = higher priority)"
                  required
                />
              </div>
              <div>
                <Label htmlFor="margin_percent">Margin Percentage *</Label>
                <Input
                  id="margin_percent"
                  type="number"
                  step="0.01"
                  value={formData.margin_percent}
                  onChange={(e) => handleInputChange('margin_percent', e.target.value)}
                  placeholder="Enter margin percentage"
                  required
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Geographic Filters (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <Label>States</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {states.length > 0 ? (
                      states.map((state) => (
                        <div key={state.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`state-${state.id}`}
                            checked={formData.state_ids.includes(state.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('state_ids', state.id, checked)}
                          />
                          <Label htmlFor={`state-${state.id}`} className="text-sm">{getDisplayName(state)}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No states available' : 'Loading states...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Districts</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {districts.length > 0 ? (
                      districts.map((district) => (
                        <div key={district.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`district-${district.id}`}
                            checked={formData.district_ids.includes(district.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('district_ids', district.id, checked)}
                          />
                          <Label htmlFor={`district-${district.id}`} className="text-sm">{getDisplayName(district)}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No districts available' : 'Loading districts...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Cities</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {cities.length > 0 ? (
                      cities.map((city) => (
                        <div key={city.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`city-${city.id}`}
                            checked={formData.city_ids.includes(city.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('city_ids', city.id, checked)}
                          />
                          <Label htmlFor={`city-${city.id}`} className="text-sm">{city.name}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No cities available' : 'Loading cities...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="city_types">City Types (comma-separated)</Label>
                  <Input
                    id="city_types"
                    value={formData.city_types}
                    onChange={(e) => handleInputChange('city_types', e.target.value)}
                    placeholder="e.g., METRO,TIER1,TIER2"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Business Filters (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <Label>Business Types</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {businessTypes.length > 0 ? (
                      businessTypes.map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`business-type-${type.id}`}
                            checked={formData.business_type_ids.includes(type.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('business_type_ids', type.id, checked)}
                          />
                          <Label htmlFor={`business-type-${type.id}`} className="text-sm">{getDisplayName(type)}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No business types available' : 'Loading business types...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Credit Types</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {creditTypes.length > 0 ? (
                      creditTypes.map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`credit-type-${type.id}`}
                            checked={formData.credit_type_ids.includes(type.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('credit_type_ids', type.id, checked)}
                          />
                          <Label htmlFor={`credit-type-${type.id}`} className="text-sm">{type.name}</Label>
                </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No credit types available' : 'Loading credit types...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Stock Groups</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {stockGroups.length > 0 ? (
                      stockGroups.map((group) => (
                        <div key={group.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`stock-group-${group.id}`}
                            checked={formData.stock_group_ids.includes(group.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('stock_group_ids', group.id, checked)}
                          />
                          <Label htmlFor={`stock-group-${group.id}`} className="text-sm">{group.name}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No stock groups available' : 'Loading stock groups...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Stock Items</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {stockItems.length > 0 ? (
                      stockItems.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`stock-item-${item.id}`}
                            checked={formData.stock_item_ids.includes(item.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('stock_item_ids', item.id, checked)}
                          />
                          <Label htmlFor={`stock-item-${item.id}`} className="text-sm">{item.name}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No stock items available' : 'Loading stock items...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Branches</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {branches.length > 0 ? (
                      branches.map((branch) => (
                        <div key={branch.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`branch-${branch.id}`}
                            checked={formData.branch_ids.includes(branch.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('branch_ids', branch.id, checked)}
                          />
                          <Label htmlFor={`branch-${branch.id}`} className="text-sm">{branch.name}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No branches available' : 'Loading branches...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Customers</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {customers.length > 0 ? (
                      customers.map((customer) => (
                        <div key={customer.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`customer-${customer.id}`}
                            checked={formData.customer_ids.includes(customer.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('customer_ids', customer.id, checked)}
                          />
                          <Label htmlFor={`customer-${customer.id}`} className="text-sm">{customer.name}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No customers available' : 'Loading customers...'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Validity Period (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valid_from">Valid From</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => handleInputChange('valid_from', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="valid_to">Valid To</Label>
                  <Input
                    id="valid_to"
                    type="date"
                    value={formData.valid_to}
                    onChange={(e) => handleInputChange('valid_to', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUpdateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createUpdateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Price Rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_rule_name">Rule Name *</Label>
                <Input
                  id="edit_rule_name"
                  value={formData.rule_name}
                  onChange={(e) => handleInputChange('rule_name', e.target.value)}
                  placeholder="Enter rule name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_rule_type">Rule Type *</Label>
                <Select value={formData.rule_type} onValueChange={(value) => handleInputChange('rule_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_priority">Priority *</Label>
                <Input
                  id="edit_priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  placeholder="Enter priority (lower = higher priority)"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_margin_percent">Margin Percentage *</Label>
                <Input
                  id="edit_margin_percent"
                  type="number"
                  step="0.01"
                  value={formData.margin_percent}
                  onChange={(e) => handleInputChange('margin_percent', e.target.value)}
                  placeholder="Enter margin percentage"
                  required
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Geographic Filters (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <Label>States</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {states.length > 0 ? (
                      states.map((state) => (
                        <div key={state.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-state-${state.id}`}
                            checked={formData.state_ids.includes(state.id)}
                            onCheckedChange={(checked) => handleArrayFieldChange('state_ids', state.id, checked)}
                          />
                          <Label htmlFor={`edit-state-${state.id}`} className="text-sm">{state.name}</Label>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">
                        {relatedDataLoaded ? 'No states available' : 'Loading states...'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Districts</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                      {districts.map((district) => (
                      <div key={district.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-district-${district.id}`}
                          checked={formData.district_ids.includes(district.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('district_ids', district.id, checked)}
                        />
                        <Label htmlFor={`edit-district-${district.id}`} className="text-sm">{district.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Cities</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                      {cities.map((city) => (
                      <div key={city.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-city-${city.id}`}
                          checked={formData.city_ids.includes(city.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('city_ids', city.id, checked)}
                        />
                        <Label htmlFor={`edit-city-${city.id}`} className="text-sm">{city.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit_city_types">City Types (comma-separated)</Label>
                  <Input
                    id="edit_city_types"
                    value={formData.city_types}
                    onChange={(e) => handleInputChange('city_types', e.target.value)}
                    placeholder="e.g., METRO,TIER1,TIER2"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Business Filters (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <Label>Business Types</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                      {businessTypes.map((type) => (
                      <div key={type.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-business-type-${type.id}`}
                          checked={formData.business_type_ids.includes(type.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('business_type_ids', type.id, checked)}
                        />
                        <Label htmlFor={`edit-business-type-${type.id}`} className="text-sm">{type.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Credit Types</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                      {creditTypes.map((type) => (
                      <div key={type.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-credit-type-${type.id}`}
                          checked={formData.credit_type_ids.includes(type.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('credit_type_ids', type.id, checked)}
                        />
                        <Label htmlFor={`edit-credit-type-${type.id}`} className="text-sm">{type.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Stock Groups</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {stockGroups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-stock-group-${group.id}`}
                          checked={formData.stock_group_ids.includes(group.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('stock_group_ids', group.id, checked)}
                        />
                        <Label htmlFor={`edit-stock-group-${group.id}`} className="text-sm">{group.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Stock Items</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {stockItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-stock-item-${item.id}`}
                          checked={formData.stock_item_ids.includes(item.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('stock_item_ids', item.id, checked)}
                        />
                        <Label htmlFor={`edit-stock-item-${item.id}`} className="text-sm">{item.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Branches</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {branches.map((branch) => (
                      <div key={branch.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-branch-${branch.id}`}
                          checked={formData.branch_ids.includes(branch.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('branch_ids', branch.id, checked)}
                        />
                        <Label htmlFor={`edit-branch-${branch.id}`} className="text-sm">{branch.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Customers</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {customers.map((customer) => (
                      <div key={customer.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-customer-${customer.id}`}
                          checked={formData.customer_ids.includes(customer.id)}
                          onCheckedChange={(checked) => handleArrayFieldChange('customer_ids', customer.id, checked)}
                        />
                        <Label htmlFor={`edit-customer-${customer.id}`} className="text-sm">{customer.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">Validity Period (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_valid_from">Valid From</Label>
                  <Input
                    id="edit_valid_from"
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => handleInputChange('valid_from', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_valid_to">Valid To</Label>
                  <Input
                    id="edit_valid_to"
                    type="date"
                    value={formData.valid_to}
                    onChange={(e) => handleInputChange('valid_to', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="edit_is_active">Active</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUpdateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createUpdateMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
