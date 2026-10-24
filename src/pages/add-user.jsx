import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation, useSearch } from "wouter";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, ArrowLeft, User, Save, X, Eye, EyeOff, ChevronDown, Check, Loader2, Package, Filter, Search, ChevronsUpDown, Info, CheckCircle, TrendingUp } from "lucide-react";
import Loader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";
import { isAdminSettingEnabled } from "@/lib/adminSettings";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/** Filter dropdown options (same as item-masters — `type` on stock-items-list API). */
const ITEM_GROUPING_FILTER_OPTIONS = [
  "Raw Material",
  "Process Machine",
  "Finished Materials",
  "PO Material",
  "SO Material",
  "Bags/ Bardans",
];

const formatItemGroupingsLabel = (item) => {
  const g = item?.item_groupings;
  if (Array.isArray(g)) return g.filter(Boolean).join(", ") || "—";
  if (g) return String(g);
  return "—";
};

export default function AddUser() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { hasReadPermission } = useUserPermissions();
  const locationRestrictLoginEnabled = isAdminSettingEnabled("location_restrict_login");
  const canManageTracking = hasReadPermission("route_management");

  const handleBackToUsers = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/users");
  };

  // Get URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const isEditMode = searchParams.get('edit') === 'true';
  const userId = searchParams.get('user_id');

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    password: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    is_location_restrict_login: false,
    login_ratio: "",
    is_tracking_enabled: false,
    role_id: "",
    branch_ids: [], // Changed to array for multiselect
    godown_ids: [],  // Changed to array for multiselect
    voucher_ids: [],  // Added for voucher multiselect
    customer_ids: [], // Customers (party) mapping
    user_ids: [],  // Added for user assignment
    machine_ids: [],  // Machine assignments
    item_ids: [],  // Stock item assignments (edit mode only)
    item_modules: []  // Assigned items with name, group, category (from API for display)
  });
  const [addressErrors, setAddressErrors] = useState({
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  // Dropdown data
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [users, setUsers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [accessModules, setAccessModules] = useState([]);
  const [hasControlSettings, setHasControlSettings] = useState(false);

  // Permission state
  const [permissions, setPermissions] = useState({});

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  // Assignment dropdowns multi-select state
  const [godownPopoverOpen, setGodownPopoverOpen] = useState(false);
  const [godownSearchTerm, setGodownSearchTerm] = useState("");
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);
  const [voucherPopoverOpen, setVoucherPopoverOpen] = useState(false);
  const [voucherSearchTerm, setVoucherSearchTerm] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [machinePopoverOpen, setMachinePopoverOpen] = useState(false);
  const [machineSearchTerm, setMachineSearchTerm] = useState("");
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  // Assign Item dialog (popup) - reference from item-masters
  const [isAssignItemDialogOpen, setIsAssignItemDialogOpen] = useState(false);
  const [isSelectedItemsViewOpen, setIsSelectedItemsViewOpen] = useState(false);
  const [assignItemDialogSelectedIds, setAssignItemDialogSelectedIds] = useState([]);
  const [assignItemSearchTerm, setAssignItemSearchTerm] = useState("");
  const [assignItemDebouncedSearch, setAssignItemDebouncedSearch] = useState("");
  const [assignItemSelectedItemGrouping, setAssignItemSelectedItemGrouping] = useState("");
  const [assignItemInStockFilter, setAssignItemInStockFilter] = useState("all");
  const [assignItemActiveStatusFilter, setAssignItemActiveStatusFilter] = useState("active");
  const [assignItemPage, setAssignItemPage] = useState(1);
  const ASSIGN_ITEMS_PER_PAGE = 50; // Items per page in Assign Items dialog; backend also enforces min 50

  // Keep all assignment dropdowns visible for all roles.
  const hideGodownsAndVouchers = false;
  const hideCustomers = false;
  const hideAssignedUsers = false;

  // Google Places Autocomplete
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isGoogleScriptLoaded, setIsGoogleScriptLoaded] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Fetch customers (same API as create-sales-order) for CUSTOMERS module mapping
  const fetchCustomers = async () => {
    const params = new URLSearchParams();
    params.append("per_page", "1000");
    const response = await apiRequest("GET", `${API_BASE_URL}/api/sales/get-customers/?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to fetch customers");
    }
    const data = await response.json();
    return data.data || [];
  };

  const {
    data: customers = [],
    isLoading: customersLoading,
  } = useQuery({
    queryKey: ["customers-add-user"],
    queryFn: fetchCustomers,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch stock items for item assignment (edit mode only)
  const fetchStockItems = async () => {
    const response = await apiRequest("POST", `${API_BASE_URL}/api/get-stock-items/`, {
      search: "",
      type: "",
      stock_group: "",
      godown: ""
    });
    const data = await response.json();
    return data.data || [];
  };
  const { data: stockItems = [], isLoading: stockItemsLoading } = useQuery({
    queryKey: ["stock-items-add-user"],
    queryFn: fetchStockItems,
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch current item mappings for user (edit mode only)
  const { data: itemMappingsResponse } = useQuery({
    queryKey: ["user-item-mappings", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-item-mappings/?user_id=${userId}&page_size=1`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken() && isEditMode && !!userId,
    refetchOnWindowFocus: false,
  });

  // When item mappings load in edit mode, set form item_ids
  useEffect(() => {
    if (!isEditMode || !userId || !itemMappingsResponse?.data?.length) return;
    const userData = itemMappingsResponse.data.find((u) => String(u.user_id) === String(userId)) || itemMappingsResponse.data[0];
    const ids = (userData?.items || []).map((i) => String(i.item_id));
    setFormData((prev) => ({ ...prev, item_ids: ids }));
  }, [isEditMode, userId, itemMappingsResponse]);

  // Debounce search for Assign Item dialog
  useEffect(() => {
    const t = setTimeout(() => setAssignItemDebouncedSearch(assignItemSearchTerm), 300);
    return () => clearTimeout(t);
  }, [assignItemSearchTerm]);

  // When Assign Item dialog opens, sync temp selection from form
  useEffect(() => {
    if (isAssignItemDialogOpen) {
      setAssignItemDialogSelectedIds([...(formData.item_ids || [])]);
      setAssignItemPage(1);
    }
  }, [isAssignItemDialogOpen]);

  // Reset to page 1 when Assign Item dialog filters change
  useEffect(() => {
    if (isAssignItemDialogOpen) setAssignItemPage(1);
  }, [assignItemDebouncedSearch, assignItemSelectedItemGrouping, assignItemInStockFilter, assignItemActiveStatusFilter]);

  const clearAssignItemFilters = () => {
    setAssignItemSearchTerm("");
    setAssignItemSelectedItemGrouping("");
    setAssignItemInStockFilter("all");
    setAssignItemActiveStatusFilter("active");
    setAssignItemPage(1);
  };

  // Stock items for Assign Item dialog (filtered, paginated — same API as item-masters)
  const fetchAssignDialogItems = async () => {
    let isActiveValue = null;
    if (assignItemActiveStatusFilter === "active") isActiveValue = true;
    else if (assignItemActiveStatusFilter === "deactive") isActiveValue = false;

    const requestBody = {
      type: assignItemSelectedItemGrouping || "",
      list_mode: "default",
      stock_group: "",
      stock_category: "",
      is_active: isActiveValue,
      new_page: assignItemPage,
      per_page: ASSIGN_ITEMS_PER_PAGE,
    };

    const searchTerm = assignItemDebouncedSearch.trim();
    if (searchTerm) {
      requestBody.search = searchTerm;
    }

    if (assignItemInStockFilter === "in_stock") {
      requestBody.in_stock = true;
    } else if (assignItemInStockFilter === "out_of_stock") {
      requestBody.in_stock = false;
    }

    const response = await apiRequest("POST", `${API_BASE_URL}/api/stock-items-list/`, requestBody);
    const data = await response.json();

    if (data.status && Number(data.status) >= 400) {
      throw new Error(data.message || "Failed to fetch stock items");
    }

    return {
      data: data.data || [],
      total_count: data.total_count ?? 0,
      pagination: data.pagination ?? { current_page: assignItemPage, per_page: ASSIGN_ITEMS_PER_PAGE, total_pages: 1, has_next: false, has_previous: false },
    };
  };
  const { data: assignDialogItemsResponse, isLoading: assignDialogItemsLoading } = useQuery({
    queryKey: [
      "/api/stock-items-list",
      "assign-dialog",
      assignItemDebouncedSearch,
      assignItemSelectedItemGrouping,
      assignItemInStockFilter,
      assignItemActiveStatusFilter,
      assignItemPage,
    ],
    queryFn: fetchAssignDialogItems,
    enabled: !!AuthService.getAccessToken() && isAssignItemDialogOpen,
  });

  const assignDialogItems = assignDialogItemsResponse?.data ?? [];
  const assignDialogPagination = assignDialogItemsResponse?.pagination ?? {};
  const assignDialogTotalCount = assignDialogItemsResponse?.total_count ?? 0;
  const assignDialogTotalPages = assignDialogPagination.total_pages ?? 1;

  // Show already mapped (assigned) items first in the listing
  const assignDialogItemsSorted = useMemo(() => {
    if (!Array.isArray(assignDialogItems) || assignDialogItems.length === 0) return assignDialogItems;
    const mappedIds = new Set((formData.item_ids || []).map(String));
    if (mappedIds.size === 0) return assignDialogItems;
    return [...assignDialogItems].sort((a, b) => {
      const aMapped = mappedIds.has(String(a.id));
      const bMapped = mappedIds.has(String(b.id));
      if (aMapped && !bMapped) return -1;
      if (!aMapped && bMapped) return 1;
      return 0;
    });
  }, [assignDialogItems, formData.item_ids]);

  // Load user data for editing
  const loadUserData = async (token) => {
    if (!isEditMode || !userId) return;

    // console.log('Loading user data for edit mode, userId:', userId); // Debug log

    try {
      const response = await fetch(`${API_BASE_URL}/api/get-user-permissions/?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        // console.log('User data received:', userData); // Debug log

        const userInfo = userData.user_info;
        const permissions = userData.data;
        const moduleMappings = userData.module_mappings;
        const itemModules = userData.item_modules || [];
        const itemIdsFromApi = (userData.item_ids || []).map((id) => String(id));

        // Get branch, godown, voucher, customer, user, and machine IDs from module mappings
        let branchIds = [];
        let godownIds = [];
        let voucherIds = [];
        let customerIds = [];
        let userIds = [];
        let machineIds = [];
        // console.log('Module mappings:', moduleMappings); // Debug log
        if (moduleMappings) {
          const branchMapping = moduleMappings.find(m => m.module_name === "BRANCH");
          const godownMapping = moduleMappings.find(m => m.module_name === "GODOWN");
          const voucherMapping = moduleMappings.find(m => m.module_name === "VOUCHERS");
          const customerMapping = moduleMappings.find(m => m.module_name === "CUSTOMERS");
          const userMapping = moduleMappings.find(m => m.module_name === "USERS");
          const machineMapping = moduleMappings.find(m => m.module_name === "MACHINE");

          if (branchMapping && branchMapping.entities.length > 0) {
            branchIds = branchMapping.entities.map(entity => entity.id.toString());
          }

          if (godownMapping && godownMapping.entities.length > 0) {
            godownIds = godownMapping.entities.map(entity => entity.id.toString());
            // console.log('Godown entities from API:', godownMapping.entities); // Debug log
          }

          if (voucherMapping && voucherMapping.entities.length > 0) {
            voucherIds = voucherMapping.entities.map(entity => entity.id.toString());
            // console.log('Voucher entities from API:', voucherMapping.entities); // Debug log
          }

          if (customerMapping && customerMapping.entities.length > 0) {
            customerIds = customerMapping.entities.map(entity => entity.id.toString());
          }

          if (userMapping && userMapping.entities.length > 0) {
            userIds = userMapping.entities.map(entity => entity.id.toString());
            // console.log('User entities from API:', userMapping.entities); // Debug log
          }

          if (machineMapping && machineMapping.entities.length > 0) {
            machineIds = machineMapping.entities.map(entity => entity.id.toString());
          }
        }

        // console.log('Branch IDs from mappings:', branchIds); // Debug log
        // console.log('Godown IDs from mappings:', godownIds); // Debug log
        // console.log('Voucher IDs from mappings:', voucherIds); // Debug log

        // Populate form data (item_ids from API so assigned items show without separate fetch)
        const formDataToSet = {
          name: userInfo.name || "",
          mobile: userInfo.mobile || "",
          password: userInfo.password || "",
          email: userInfo.email || "",
          address: userInfo.address || "",
          city: userInfo.city || "",
          state: userInfo.state || "",
          pincode: userInfo.pincode || "",
          is_location_restrict_login: Number(userInfo.login_ratio || 0) > 0,
          login_ratio: Number(userInfo.login_ratio || 0) > 0 ? String(userInfo.login_ratio) : "",
          is_tracking_enabled: Boolean(userInfo.is_tracking_enabled),
          role_id: userInfo.role_id?.toString() || "",
          branch_ids: branchIds,
          godown_ids: godownIds,
          voucher_ids: voucherIds,
          customer_ids: customerIds,
          user_ids: userIds,
          machine_ids: machineIds,
          item_ids: itemIdsFromApi,
          item_modules: itemModules
        };

        // console.log('Form data being set:', formDataToSet); // Debug log
        setFormData(formDataToSet);

        // Populate permissions by matching alias - store by alias for UI
        if (permissions) {
          const permissionsObj = {};
          permissions.forEach(perm => {
            permissionsObj[perm.alias] = perm.permission_summary || [];
            // console.log(`Set permissions for alias ${perm.alias}:`, perm.permission_summary);
          });
          setPermissions(permissionsObj);

          // Check if "Control Settings" module exists in permissions array
          const controlSettingsExists = permissions.some(perm =>
            perm.module_name === "Control Settings"
          );
          setHasControlSettings(controlSettingsExists);
          // console.log('Permissions set by alias:', permissionsObj); // Debug log
          // console.log('Access modules available:', accessModules.length); // Debug log
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive"
      });
    }
  };

  // Load Google Places API script
  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      console.warn('Google API key not found in environment variables. Please set VITE_GOOGLE_API_KEY in your .env file');
      return;
    }

    // Check if script is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      // console.log('Google Places API already loaded');
      setIsGoogleScriptLoaded(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // console.log('Google Places API script tag exists, waiting for load...');
      if (existingScript.getAttribute('data-loaded') === 'true') {
        setIsGoogleScriptLoaded(true);
        return;
      }
      existingScript.addEventListener('load', () => {
        // console.log('Google Places API script loaded from existing tag');
        existingScript.setAttribute('data-loaded', 'true');
        setIsGoogleScriptLoaded(true);
      });
      return;
    }

    // Load Google Places API script
    // console.log('Loading Google Places API script...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // console.log('Google Places API script onload fired');
      // Wait a bit for Google to fully initialize
      setTimeout(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          // console.log('Google Places API loaded successfully');
          script.setAttribute('data-loaded', 'true');
          setIsGoogleScriptLoaded(true);
        } else {
          console.error('Google Places API not available after script load');
        }
      }, 100);
    };

    script.onerror = (error) => {
      console.error('Failed to load Google Places API:', error);
      toast({
        title: "Error",
        description: "Failed to load Google Places API. Please check your API key.",
        variant: "destructive"
      });
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup - don't remove script as it might be used by other components
    };
  }, [GOOGLE_API_KEY, toast]);

  // Add styles for Google Places Autocomplete dropdown
  useEffect(() => {
    const styleId = 'google-places-autocomplete-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .pac-container {
        z-index: 9999 !important;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border: 1px solid #e5e7eb;
        margin-top: 4px;
        font-family: inherit;
      }
      .pac-item {
        padding: 8px 12px;
        cursor: pointer;
        border-top: 1px solid #f3f4f6;
        font-size: 14px;
      }
      .pac-item:first-child {
        border-top: none;
      }
      .pac-item:hover {
        background-color: #f9fafb;
      }
      .pac-item-selected {
        background-color: #f3f4f6;
      }
      .pac-icon {
        margin-right: 8px;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!isGoogleScriptLoaded || !addressInputRef.current || !window.google || !window.google.maps || !window.google.maps.places) {
      return;
    }

    // Get the actual input DOM element
    const inputElement = addressInputRef.current;
    if (!inputElement || inputElement.tagName !== 'INPUT') {
      console.error('Address input ref does not point to an INPUT element');
      return;
    }

    // Don't re-initialize if already initialized for this element
    if (autocompleteRef.current && autocompleteRef.current.inputElement === inputElement) {
      return;
    }

    try {
      // Initialize autocomplete
      const autocomplete = new window.google.maps.places.Autocomplete(
        inputElement,
        {
          types: ['geocode', 'establishment'], // Allow both addresses and establishments
          componentRestrictions: { country: 'in' }, // Restrict to India
          fields: ['address_components', 'formatted_address', 'geometry', 'name']
        }
      );

      // Store reference with input element for comparison
      autocomplete.inputElement = inputElement;
      autocompleteRef.current = autocomplete;

      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place || !place.address_components) {
          console.warn('Place selection returned no address components');
          return;
        }

        // Extract address components
        let city = '';
        let state = '';
        let pincode = '';
        let address = place.formatted_address || place.name || '';

        // Parse address components
        place.address_components.forEach((component) => {
          const types = component.types;

          if (types.includes('postal_code')) {
            pincode = component.long_name;
          } else if (types.includes('locality')) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_2') && !city) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
          }
        });

        // Update form data
        setFormData((prev) => ({
          ...prev,
          address: address,
          city: city || prev.city,
          state: state || prev.state,
          pincode: pincode || prev.pincode
        }));
      });

      // console.log('Google Places Autocomplete initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
      toast({
        title: "Error",
        description: "Failed to initialize address autocomplete. Please refresh the page.",
        variant: "destructive"
      });
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current && window.google && window.google.maps && window.google.maps.event) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (error) {
          console.error('Error clearing autocomplete listeners:', error);
        }
        autocompleteRef.current = null;
      }
    };
  }, [isGoogleScriptLoaded, toast]);

  // Load dropdown data
  useEffect(() => {
    const token = localStorage.getItem('cp_manager_access_token');
    if (!token) {
      setLocation('/login');
      return;
    }

    const loadDropdownData = async () => {
      setIsLoading(true);
      try {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // Load roles
        const rolesResponse = await fetch(`${API_BASE_URL}/api/get-roles/`, {
          method: 'GET',
          headers
        });
        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
          setRoles(rolesData?.data || []);
        }

        // Load branches
        const branchesResponse = await fetch(`${API_BASE_URL}/api/get-branches/`, {
          method: 'GET',
          headers
        });
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          setBranches(branchesData?.data || []);
        }

        // Load godowns
        const godownsResponse = await fetch(`${API_BASE_URL}/api/get-godowns/`, {
          method: 'GET',
          headers
        });
        if (godownsResponse.ok) {
          const godownsData = await godownsResponse.json();
          setGodowns(godownsData?.data || []);
          // console.log('Godowns loaded:', godownsData?.data); // Debug log
        }

        // Load vouchers
        const vouchersResponse = await fetch(`${API_BASE_URL}/api/get-voucher-types/?is_active=true&page=1&limit=50`, {
          method: 'GET',
          headers
        });
        if (vouchersResponse.ok) {
          const vouchersData = await vouchersResponse.json();
          setVouchers(vouchersData?.data || []);
          // console.log('Vouchers loaded:', vouchersData?.data); // Debug log
        }

        // Load machines for assignment
        const machinesResponse = await fetch(`${API_BASE_URL}/api/process/machines/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({})
        });
        if (machinesResponse.ok) {
          const machinesData = await machinesResponse.json();
          setMachines(machinesData?.data || []);
        }

        // Load users (excluding current user if in edit mode)
        const usersResponse = await fetch(`${API_BASE_URL}/api/get-users/`, {
          method: 'GET',
          headers
        });
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          // Filter out the current user if in edit mode
          let usersList = usersData?.data || [];
          if (isEditMode && userId) {
            usersList = usersList.filter(u => u.user_id !== userId);
          }
          setUsers(usersList);
          // console.log('Users loaded:', usersList); // Debug log
        }

        // Load access modules FIRST
        const modulesResponse = await fetch(`${API_BASE_URL}/api/get-access-modules/`, {
          method: 'GET',
          headers
        });
        if (modulesResponse.ok) {
          const modulesData = await modulesResponse.json();
          const modules = modulesData?.data || [];
          setAccessModules(modules);
          // console.log('Access modules loaded:', modules?.length || 0, 'modules'); // Debug log

          // Check if "Control Settings" module exists in access modules (for add mode)
          if (!isEditMode) {
            const controlSettingsExists = modules.some(module =>
              module.name === "Control Settings"
            );
            setHasControlSettings(controlSettingsExists);
          }

          // After access modules are loaded, load user data if in edit mode
          if (isEditMode && userId) {
            // console.log('Access modules loaded, now loading user data...'); // Debug log
            await loadUserData(token);
          }
        }

      } catch (error) {
        console.error('Error loading dropdown data:', error);
        toast({
          title: "Error",
          description: "Failed to load form data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDropdownData();
  }, [API_BASE_URL, setLocation, toast, isEditMode, userId]);

  // Auto-select branch if only one branch is available (only in add mode, not edit mode)
  useEffect(() => {
    if (!isEditMode && branches.length === 1 && formData.branch_ids.length === 0) {
      const singleBranch = branches[0];
      if (singleBranch && singleBranch.id) {
        setFormData(prev => ({
          ...prev,
          branch_ids: [singleBranch.id.toString()]
        }));
      }
    }
  }, [branches, isEditMode, formData.branch_ids.length]);

  // Users filtered by selected branch(es) for Assigned Users dropdown
  const usersBySelectedBranch = useMemo(() => {
    if (!formData.branch_ids?.length) return users;
    const selectedBranchNames = formData.branch_ids
      .map((id) => branches.find((b) => b.id.toString() === id.toString())?.name)
      .filter(Boolean);
    if (selectedBranchNames.length === 0) return users;
    return users.filter((u) => u.branch_name && selectedBranchNames.includes(u.branch_name));
  }, [users, formData.branch_ids, branches]);

  const selectedRoleLabel = useMemo(() => {
    if (!formData.role_id) return "Select role";
    const role = roles.find((r) => String(r.id) === String(formData.role_id));
    return role?.name || "Select role";
  }, [formData.role_id, roles]);

  // Effect to map permissions to access modules when both are loaded
  useEffect(() => {
    if (isEditMode && accessModules.length > 0 && Object.keys(permissions).length > 0) {
      // console.log('Mapping permissions to access modules:', { accessModules, permissions });

      // Debug: Check if permissions match access modules
      accessModules.forEach(module => {
        const modulePermissions = permissions[module.alias];
        // console.log(`Module ${module.id} (${module.name}, alias: ${module.alias}):`, {
        //   hasPermissions: !!modulePermissions,
        //   permissions: modulePermissions,
        //   create: modulePermissions?.includes('c'),
        //   read: modulePermissions?.includes('r'),
        //   update: modulePermissions?.includes('u'),
        //   delete: modulePermissions?.includes('d')
        // });
      });
    }
  }, [accessModules, permissions, isEditMode]);

  // Debug effect to show current state
  useEffect(() => {
    // console.log('Current state:', {
    //   isEditMode,
    //   accessModulesCount: accessModules.length,
    //   permissionsCount: Object.keys(permissions).length,
    //   permissions: permissions,
    //   accessModules: accessModules.map(m => ({ id: m.id, name: m.name, alias: m.alias }))
    // });
  }, [isEditMode, accessModules, permissions]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (field === "address" || field === "city" || field === "state" || field === "pincode") {
      setAddressErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // Handle clearing address fields
  const handleClearAddress = () => {
    setFormData(prev => ({
      ...prev,
      address: "",
      city: "",
      state: "",
      pincode: ""
    }));
    setAddressErrors({
      address: "",
      city: "",
      state: "",
      pincode: "",
    });
  };

  // Handle permission changes
  const handlePermissionChange = (moduleAlias, permission, checked) => {
    setPermissions(prev => {
      const newPermissions = { ...prev };
      if (!newPermissions[moduleAlias]) {
        newPermissions[moduleAlias] = [];
      }

      if (checked) {
        if (!newPermissions[moduleAlias].includes(permission)) {
          newPermissions[moduleAlias].push(permission);
        }
      } else {
        newPermissions[moduleAlias] = newPermissions[moduleAlias].filter(p => p !== permission);
      }

      return newPermissions;
    });
  };

  // Handle select all permissions for a module
  const handleSelectAll = (moduleAlias, checked) => {
    setPermissions(prev => {
      const newPermissions = { ...prev };
      if (checked) {
        newPermissions[moduleAlias] = ['c', 'r', 'u', 'd'];
      } else {
        newPermissions[moduleAlias] = [];
      }
      return newPermissions;
    });
  };

  // Check if all permissions are selected for a module
  const isAllSelected = (moduleAlias) => {
    const modulePermissions = permissions[moduleAlias] || [];
    return modulePermissions.length === 4 &&
      modulePermissions.includes('c') &&
      modulePermissions.includes('r') &&
      modulePermissions.includes('u') &&
      modulePermissions.includes('d');
  };

  // Handle select all modules (all checkboxes for all modules)
  const handleSelectAllModules = (checked) => {
    setPermissions(prev => {
      const newPermissions = { ...prev };
      accessModules.forEach(module => {
        if (checked) {
          newPermissions[module.alias] = ['c', 'r', 'u', 'd'];
        } else {
          newPermissions[module.alias] = [];
        }
      });
      return newPermissions;
    });
  };

  // Check if all modules have all permissions selected
  const isAllModulesSelected = () => {
    return accessModules.every(module => isAllSelected(module.alias));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // console.log("Form submitted!"); // Debug log
    const nextAddressErrors = {
      address: formData.address?.trim() ? "" : "Address is required",
      city: formData.city?.trim() ? "" : "City is required",
      state: formData.state?.trim() ? "" : "State is required",
      pincode: formData.pincode?.trim() ? "" : "Pincode is required",
    };
    const hasAddressErrors = Object.values(nextAddressErrors).some(Boolean);
    setAddressErrors(nextAddressErrors);

    if (hasAddressErrors) {
      toast({
        title: "Validation Error",
        description: "Address, City, State and Pincode are mandatory.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('cp_manager_access_token');
      // console.log("Token found:", !!token); // Debug log

      // Prepare permissions array - convert aliases back to module IDs
      const permissionsArray = Object.entries(permissions)
        .filter(([_, perms]) => perms.length > 0)
        .map(([moduleAlias, perms]) => {
          // Find the module with matching alias to get its ID
          const module = accessModules.find(m => m.alias === moduleAlias);
          return {
            module_id: module ? parseInt(module.id) : null,
            access: perms
          };
        })
        .filter(item => item.module_id !== null); // Remove any items where module wasn't found

      // console.log("Permissions array:", permissionsArray); // Debug log

      const module_mapping = isEditMode
        ? [
          { module_name: "BRANCH", module_ids: formData.branch_ids || [] },
          { module_name: "GODOWN", module_ids: formData.godown_ids || [] },
          { module_name: "VOUCHERS", module_ids: formData.voucher_ids || [] },
          { module_name: "CUSTOMERS", module_ids: formData.customer_ids || [] },
          { module_name: "USERS", module_ids: formData.user_ids || [] },
          { module_name: "MACHINE", module_ids: formData.machine_ids || [] },
        ]
        : [
          ...(formData.branch_ids.length > 0 ? [{
            module_name: "BRANCH",
            module_ids: formData.branch_ids
          }] : []),
          ...(formData.godown_ids.length > 0 ? [{
            module_name: "GODOWN",
            module_ids: formData.godown_ids
          }] : []),
          ...(formData.voucher_ids.length > 0 ? [{
            module_name: "VOUCHERS",
            module_ids: formData.voucher_ids
          }] : []),
          ...(formData.customer_ids.length > 0 ? [{
            module_name: "CUSTOMERS",
            module_ids: formData.customer_ids
          }] : []),
          ...(formData.user_ids.length > 0 ? [{
            module_name: "USERS",
            module_ids: formData.user_ids
          }] : []),
          ...(formData.machine_ids.length > 0 ? [{
            module_name: "MACHINE",
            module_ids: formData.machine_ids
          }] : [])
        ]


      const requestData = {
        name: formData.name,
        mobile: formData.mobile,
        password: formData.password,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        ...(locationRestrictLoginEnabled
          ? {
              login_ratio: formData.is_location_restrict_login
                ? (parseInt(formData.login_ratio || "0", 10) || 0)
                : 0,
            }
          : {}),
        ...(canManageTracking ? { is_tracking_enabled: formData.is_tracking_enabled } : {}),
        role_id: parseInt(formData.role_id),
        permissions: permissionsArray,
        module_mapping,
        ...(isEditMode && { user_id: userId }),
        ...(formData.item_ids != null && formData.item_ids.length >= 0 && { item_ids: formData.item_ids })
      };

      // console.log('Request data being sent:', requestData); // Debug log
      const response = await fetch(`${API_BASE_URL}/api/add-user/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const resData = await response.json().catch(() => ({}));
        const itemAssignment = resData?.data?.item_assignment;
        if (itemAssignment?.errors?.length) {
          toast({
            title: isEditMode ? "User updated" : "User created",
            description: "Saved, but item assignment had errors: " + itemAssignment.errors.join("; "),
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: isEditMode ? "User updated successfully" : "User added successfully",
          });
        }
        // If new user has Broker role, redirect to Brokerage Configuration with this broker pre-selected
        const isBrokerRole = /^broker$/i.test((roles.find((r) => r.id?.toString() === formData.role_id)?.name || "").trim());
        if (!isEditMode && isBrokerRole) {
          const createdUserId = resData?.data?.user_id ?? resData?.data?.id ?? resData?.user_id;
          if (createdUserId != null) {
            try {
              sessionStorage.setItem("brokerage_config_open_with_broker", String(createdUserId));
            } catch (_) { }
            setLocation("/margin-settings/brokerage-configuration");
            return;
          }
        }
        // Tell user-list to restore filters once (only on successful update navigation,
        // not on a page refresh of the list).
        if (isEditMode) {
          try {
            sessionStorage.setItem("user_list_restore_filters_once", "1");
          } catch (_) { }
        }
        setLocation('/users');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add user');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add user",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-layout bg-gray-50">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Sidebar */}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="app-main-content">
        {/* Top Header */}
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center space-x-2 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToUsers}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="bg-gradient-to-r from-black to-gray-600 p-1.5 rounded-md shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">
                    {isEditMode ? "Edit User" : "Add New User"}
                  </h1>
                  <p className="text-xs text-gray-600 truncate">
                    {isEditMode ? "Update user account and permissions" : "Create a new user account with permissions"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main-scrollable p-2.5 sm:p-3">
          <div className="max-w-[1600px] mx-auto">
            <div className="space-y-1">
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Basic Information */}
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="p-3 pb-1.5">
                    <CardTitle className="text-sm font-semibold text-gray-900">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1.5 space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="name" className="text-xs font-medium text-gray-700">Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => {
                            const onlyLetters = e.target.value.replace(/[^A-Za-z ]/g, "");
                            handleInputChange("name", onlyLetters);
                          }}
                          placeholder="Enter full name"
                          maxLength={25}
                          required
                          className="h-9 text-sm border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="mobile" className="text-xs font-medium text-gray-700">Mobile *</Label>
                        <Input
                          id="mobile"
                          value={formData.mobile}
                          onChange={(e) => {
                            const onlyNumbers = e.target.value.replace(/[^0-9]/g, "");
                            handleInputChange("mobile", onlyNumbers);
                          }}
                          placeholder="Enter mobile number"
                          maxLength={10}
                          required
                          className="h-9 text-sm border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="email" className="text-xs font-medium text-gray-700">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          maxLength={30}
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="Enter email address"
                          className="h-9 text-sm border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="password" className="text-xs font-medium text-gray-700">Password {!isEditMode && "*"}</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            maxLength={15}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            placeholder={isEditMode ? "Leave blank to keep current password" : "Enter password"}
                            required={!isEditMode}
                            // disabled={isEditMode}
                            className="h-9 text-sm border-gray-300 focus:border-gray-500 focus:ring-gray-500 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="role" className="text-xs font-medium text-gray-700">Role *</Label>
                        <Popover
                          open={rolePopoverOpen}
                          onOpenChange={setRolePopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              id="role"
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={rolePopoverOpen}
                              className="w-full h-9 justify-between font-normal border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                            >
                              <span className="truncate">{selectedRoleLabel}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0 z-50"
                            align="start"
                            side="bottom"
                            sideOffset={4}
                          >
                            <Command>
                              <CommandInput placeholder="Search roles..." />
                              <CommandList>
                                <CommandEmpty>
                                  {roles.length === 0
                                    ? "No roles found."
                                    : "No roles match your search."}
                                </CommandEmpty>
                                <CommandGroup>
                                  <ScrollArea className="h-64">
                                    {roles.map((role) => {
                                      const roleId = role.id.toString();
                                      const isSelected =
                                        String(formData.role_id) === roleId;
                                      return (
                                        <CommandItem
                                          key={role.id}
                                          value={`${role.name} ${roleId}`}
                                          onSelect={() => {
                                            handleInputChange("role_id", roleId);
                                            setRolePopoverOpen(false);
                                          }}
                                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <Check
                                              className={`h-4 w-4 shrink-0 ${
                                                isSelected
                                                  ? "opacity-100 text-gray-600"
                                                  : "opacity-0"
                                              }`}
                                            />
                                            <span className="font-medium text-gray-900 truncate">
                                              {role.name}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </ScrollArea>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {locationRestrictLoginEnabled && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-medium text-gray-700">Is location restrict Login</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700 focus:outline-none"
                                aria-label="Location restriction info"
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 text-sm text-gray-700" align="start">
                              Distance entered in KM is used as the login restriction radius for this user to access the app.
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="h-9 flex items-center rounded-md border border-gray-300 px-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox
                              checked={formData.is_location_restrict_login}
                              onCheckedChange={(checked) => {
                                const enabled = !!checked;
                                setFormData((prev) => ({
                                  ...prev,
                                  is_location_restrict_login: enabled,
                                  login_ratio: enabled ? (prev.login_ratio || "") : ""
                                }));
                              }}
                            />
                            <span className="text-sm text-gray-700">Enable</span>
                          </label>
                        </div>
                      </div>
                      )}
                      {canManageTracking && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-700">Is tracking enabled</Label>
                        <div className="h-9 flex items-center rounded-md border border-gray-300 px-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox
                              checked={formData.is_tracking_enabled}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  is_tracking_enabled: !!checked,
                                }));
                              }}
                            />
                            <span className="text-sm text-gray-700">Enable</span>
                          </label>
                        </div>
                      </div>
                      )}
                      {locationRestrictLoginEnabled && formData.is_location_restrict_login && (
                        <div className="space-y-1">
                          <Label htmlFor="login_ratio" className="text-xs font-medium text-gray-700">Login radius (KM)</Label>
                          <Input
                            id="login_ratio"
                            value={formData.login_ratio}
                            onChange={(e) => {
                              const onlyNumbers = e.target.value.replace(/[^0-9]/g, "");
                              handleInputChange('login_ratio', onlyNumbers);
                            }}
                            placeholder="Enter KM"
                            className="h-9 text-sm border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                          />
                        </div>
                      )}

                      <div className="space-y-4 min-w-0">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="branches" className="text-xs font-medium text-gray-700">Branches *</Label>
                          {formData.branch_ids.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInputChange('branch_ids', [])}
                              className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
                        <Popover open={branchPopoverOpen} onOpenChange={(open) => { setBranchPopoverOpen(open); if (!open) setBranchSearchTerm(""); }}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={branchPopoverOpen}
                              className="w-full h-9 justify-between border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                            >
                              <span className="truncate">
                                {formData.branch_ids.length > 0 ? `${formData.branch_ids.length} branch${formData.branch_ids.length > 1 ? "es" : ""} selected` : "Select branches"}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput placeholder="Search branches..." value={branchSearchTerm} onValueChange={setBranchSearchTerm} />
                              <CommandList>
                                <CommandEmpty>No branch found.</CommandEmpty>
                                <CommandGroup>
                                  {(() => {
                                    const filteredBranches = branches.filter(b => b.name?.toLowerCase().includes((branchSearchTerm || "").toLowerCase()));
                                    const allFilteredSelected = filteredBranches.length > 0 && filteredBranches.every(b => formData.branch_ids.includes(b.id.toString()));
                                    const unselectedFiltered = filteredBranches.filter(b => !formData.branch_ids.includes(b.id.toString()));
                                    return (
                                      <>
                                        {unselectedFiltered.length > 0 && (
                                          <>
                                            <CommandItem
                                              value="select-all-branches"
                                              onSelect={() => {
                                                const ids = unselectedFiltered.map(b => b.id.toString());
                                                handleInputChange('branch_ids', [...formData.branch_ids, ...ids]);
                                              }}
                                              className="cursor-pointer"
                                            >
                                              <div className="flex items-center space-x-2 w-full">
                                                <Checkbox
                                                  checked={allFilteredSelected}
                                                  onCheckedChange={(checked) => {
                                                    if (checked) handleInputChange('branch_ids', [...formData.branch_ids, ...unselectedFiltered.map(b => b.id.toString())]);
                                                    else handleInputChange('branch_ids', formData.branch_ids.filter(id => !filteredBranches.map(b => b.id.toString()).includes(id)));
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="font-medium flex-1">Select All ({unselectedFiltered.length} available)</span>
                                              </div>
                                            </CommandItem>
                                            <div className="my-1 h-px bg-gray-200" />
                                          </>
                                        )}
                                        {filteredBranches.map((branch) => {
                                          const isSelected = formData.branch_ids.includes(branch.id.toString());
                                          const toggle = () => {
                                            if (isSelected) handleInputChange('branch_ids', formData.branch_ids.filter(id => id !== branch.id.toString()));
                                            else handleInputChange('branch_ids', [...formData.branch_ids, branch.id.toString()]);
                                          };
                                          return (
                                            <CommandItem key={branch.id} value={`${branch.name}-${branch.id}`} onSelect={toggle} className="cursor-pointer">
                                              <div className="flex items-center space-x-2 w-full">
                                                <Checkbox checked={isSelected} onCheckedChange={toggle} onClick={(e) => e.stopPropagation()} />
                                                <span className="flex-1">{branch.name}</span>
                                                {isSelected && <Check className="h-4 w-4 text-gray-600" />}
                                              </div>
                                            </CommandItem>
                                          );
                                        })}
                                      </>
                                    );
                                  })()}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {formData.branch_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 p-2 bg-gray-50 rounded-md border">
                            {formData.branch_ids.map((branchId) => {
                              const branch = branches.find(b => b.id.toString() === branchId);
                              return (
                                <Badge key={branchId} variant="secondary" className="text-xs flex items-center gap-1">
                                  {branch?.name || branchId}
                                  <button type="button" onClick={() => handleInputChange('branch_ids', formData.branch_ids.filter(id => id !== branchId))} className="ml-1 hover:bg-gray-300 rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Branch, Godown, Voucher, Customers and Assigned Users - single row on large screens */}
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="p-3 pb-1.5">
                    <CardTitle className="text-sm font-semibold text-gray-900">Assignment</CardTitle>
                  </CardHeader>

                  <CardContent className="p-3 pt-1.5 space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 items-start">
                      {!hideGodownsAndVouchers && (
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="godowns" className="text-xs font-medium text-gray-700">Godowns</Label>
                            {formData.godown_ids.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleInputChange('godown_ids', [])}
                                className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                          <div className="relative">
                            <Popover
                              open={godownPopoverOpen}
                              onOpenChange={(open) => {
                                setGodownPopoverOpen(open);
                                if (!open) {
                                  setGodownSearchTerm("");
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={godownPopoverOpen}
                                  className="w-full h-9 justify-between border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                                >
                                  <span className="truncate">
                                    {formData.godown_ids.length > 0
                                      ? `${formData.godown_ids.length} godown${formData.godown_ids.length > 1 ? 's' : ''} selected`
                                      : "Select godowns"}
                                  </span>
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0" align="start">
                                <Command shouldFilter={false}>
                                  <CommandInput
                                    placeholder="Search godowns..."
                                    value={godownSearchTerm}
                                    onValueChange={setGodownSearchTerm}
                                  />
                                  <CommandList>
                                    <CommandEmpty>No godown found.</CommandEmpty>
                                    <CommandGroup>
                                      {(() => {
                                        // Filter godowns based on search term
                                        const filteredGodowns = godowns.filter((godown) =>
                                          godown.name.toLowerCase().includes(godownSearchTerm.toLowerCase())
                                        );

                                        // Check if all filtered godowns are selected
                                        const allFilteredSelected = filteredGodowns.length > 0 &&
                                          filteredGodowns.every(godown =>
                                            formData.godown_ids.includes(godown.id.toString())
                                          );

                                        // Get unselected filtered godowns
                                        const unselectedFilteredGodowns = filteredGodowns.filter(
                                          godown => !formData.godown_ids.includes(godown.id.toString())
                                        );

                                        return (
                                          <>
                                            {unselectedFilteredGodowns.length > 0 && (
                                              <>
                                                <CommandItem
                                                  value={`select-all-${godownSearchTerm}`}
                                                  onSelect={() => {
                                                    const unselectedIds = unselectedFilteredGodowns.map(
                                                      godown => godown.id.toString()
                                                    );
                                                    handleInputChange('godown_ids', [
                                                      ...formData.godown_ids,
                                                      ...unselectedIds
                                                    ]);
                                                  }}
                                                  className="cursor-pointer"
                                                >
                                                  <div className="flex items-center space-x-2 w-full">
                                                    <Checkbox
                                                      checked={allFilteredSelected}
                                                      onCheckedChange={(checked) => {
                                                        if (checked) {
                                                          const unselectedIds = unselectedFilteredGodowns.map(
                                                            godown => godown.id.toString()
                                                          );
                                                          handleInputChange('godown_ids', [
                                                            ...formData.godown_ids,
                                                            ...unselectedIds
                                                          ]);
                                                        } else {
                                                          // Deselect all filtered godowns
                                                          const filteredIds = filteredGodowns.map(
                                                            godown => godown.id.toString()
                                                          );
                                                          handleInputChange(
                                                            'godown_ids',
                                                            formData.godown_ids.filter(id => !filteredIds.includes(id))
                                                          );
                                                        }
                                                      }}
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <span className="font-medium flex-1">
                                                      Select All ({unselectedFilteredGodowns.length} available)
                                                    </span>
                                                  </div>
                                                </CommandItem>
                                                <div className="my-1 h-px bg-gray-200" />
                                              </>
                                            )}
                                            {filteredGodowns.map((godown) => {
                                              const isSelected = formData.godown_ids.includes(godown.id.toString());
                                              const toggleGodown = () => {
                                                if (isSelected) {
                                                  handleInputChange(
                                                    'godown_ids',
                                                    formData.godown_ids.filter(id => id !== godown.id.toString())
                                                  );
                                                } else {
                                                  handleInputChange('godown_ids', [
                                                    ...formData.godown_ids,
                                                    godown.id.toString()
                                                  ]);
                                                }
                                              };
                                              return (
                                                <CommandItem
                                                  key={godown.id}
                                                  value={`${godown.name}-${godown.id}`}
                                                  onSelect={toggleGodown}
                                                  className="cursor-pointer"
                                                >
                                                  <div className="flex items-center space-x-2 w-full">
                                                    <Checkbox
                                                      checked={isSelected}
                                                      onCheckedChange={toggleGodown}
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <span className="flex-1">{godown.name}</span>
                                                    {isSelected && (
                                                      <Check className="h-4 w-4 text-gray-600" />
                                                    )}
                                                  </div>
                                                </CommandItem>
                                              );
                                            })}
                                          </>
                                        );
                                      })()}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>

                            {/* Selected items display */}
                            {formData.godown_ids.length > 0 && formData.godown_ids.length <= 3 && (
                              <div className="flex flex-wrap gap-1 mt-2 p-2 bg-gray-50 rounded-md border">
                                {formData.godown_ids.map((godownId) => {
                                  const godown = godowns.find(g => g.id.toString() === godownId.toString());
                                  return (
                                    <Badge
                                      key={godownId}
                                      variant="secondary"
                                      className="text-xs flex items-center gap-1"
                                    >
                                      {godown?.name || godownId}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleInputChange('godown_ids', formData.godown_ids.filter(id => id !== godownId));
                                        }}
                                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {!hideGodownsAndVouchers && (
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="vouchers" className="text-xs font-medium text-gray-700">Vouchers</Label>
                            {formData.voucher_ids.length > 0 && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleInputChange('voucher_ids', [])} className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                                <X className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                          <Popover open={voucherPopoverOpen} onOpenChange={(open) => { setVoucherPopoverOpen(open); if (!open) setVoucherSearchTerm(""); }}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" role="combobox" aria-expanded={voucherPopoverOpen} className="w-full h-9 justify-between border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                                <span className="truncate">
                                  {formData.voucher_ids.length > 0 ? `${formData.voucher_ids.length} voucher${formData.voucher_ids.length > 1 ? "s" : ""} selected` : "Select vouchers"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput placeholder="Search vouchers..." value={voucherSearchTerm} onValueChange={setVoucherSearchTerm} />
                                <CommandList>
                                  <CommandEmpty>No voucher found.</CommandEmpty>
                                  <CommandGroup>
                                    {(() => {
                                      const filteredVouchers = vouchers.filter(v => (v.name || "").toLowerCase().includes((voucherSearchTerm || "").toLowerCase()));
                                      const allFilteredSelected = filteredVouchers.length > 0 && filteredVouchers.every(v => formData.voucher_ids.includes(v.id.toString()));
                                      const unselectedFiltered = filteredVouchers.filter(v => !formData.voucher_ids.includes(v.id.toString()));
                                      return (
                                        <>
                                          {unselectedFiltered.length > 0 && (
                                            <>
                                              <CommandItem
                                                value="select-all-vouchers"
                                                onSelect={() => handleInputChange('voucher_ids', [...formData.voucher_ids, ...unselectedFiltered.map(v => v.id.toString())])}
                                                className="cursor-pointer"
                                              >
                                                <div className="flex items-center space-x-2 w-full">
                                                  <Checkbox
                                                    checked={allFilteredSelected}
                                                    onCheckedChange={(checked) => {
                                                      if (checked) handleInputChange('voucher_ids', [...formData.voucher_ids, ...unselectedFiltered.map(v => v.id.toString())]);
                                                      else handleInputChange('voucher_ids', formData.voucher_ids.filter(id => !filteredVouchers.map(v => v.id.toString()).includes(id)));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                  <span className="font-medium flex-1">Select All ({unselectedFiltered.length} available)</span>
                                                </div>
                                              </CommandItem>
                                              <div className="my-1 h-px bg-gray-200" />
                                            </>
                                          )}
                                          {filteredVouchers.map((voucher) => {
                                            const isSelected = formData.voucher_ids.includes(voucher.id.toString());
                                            const toggle = () => {
                                              if (isSelected) handleInputChange('voucher_ids', formData.voucher_ids.filter(id => id !== voucher.id.toString()));
                                              else handleInputChange('voucher_ids', [...formData.voucher_ids, voucher.id.toString()]);
                                            };
                                            return (
                                              <CommandItem key={voucher.id} value={`${voucher.name}-${voucher.id}`} onSelect={toggle} className="cursor-pointer">
                                                <div className="flex items-center space-x-2 w-full">
                                                  <Checkbox checked={isSelected} onCheckedChange={toggle} onClick={(e) => e.stopPropagation()} />
                                                  <span className="flex-1">{voucher.name}</span>
                                                  {isSelected && <Check className="h-4 w-4 text-gray-600" />}
                                                </div>
                                              </CommandItem>
                                            );
                                          })}
                                        </>
                                      );
                                    })()}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {formData.voucher_ids.length > 0 && formData.voucher_ids.length <= 3 && (
                            <div className="flex flex-wrap gap-1 mt-2 p-2 bg-gray-50 rounded-md border">
                              {formData.voucher_ids.map((voucherId) => {
                                const voucher = vouchers.find(v => v.id.toString() === voucherId.toString());
                                return (
                                  <Badge key={voucherId} variant="secondary" className="text-xs flex items-center gap-1">
                                    {voucher?.name || voucherId}
                                    <button
                                      type="button"
                                      onClick={() => handleInputChange('voucher_ids', formData.voucher_ids.filter(id => id !== voucherId))}
                                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {!hideCustomers && (
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="customers" className="text-xs font-medium text-gray-700">Customers</Label>
                            {formData.customer_ids.length > 0 && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleInputChange('customer_ids', [])} className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                                <X className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                          <Popover open={customerPopoverOpen} onOpenChange={(open) => { setCustomerPopoverOpen(open); if (!open) setCustomerSearchTerm(""); }}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" role="combobox" aria-expanded={customerPopoverOpen} className="w-full h-9 justify-between border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                                <span className="truncate">
                                  {formData.customer_ids.length > 0 ? `${formData.customer_ids.length} customer${formData.customer_ids.length > 1 ? "s" : ""} selected` : "Select customers"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput placeholder="Search customers..." value={customerSearchTerm} onValueChange={setCustomerSearchTerm} />
                                <CommandList>
                                  <CommandEmpty>
                                    {customersLoading ? (
                                      <div className="flex items-center justify-center py-6">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Loading customers...
                                      </div>
                                    ) : (
                                      "No customers found."
                                    )}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {!customersLoading && (() => {
                                      const filteredCustomers = (customers || []).filter(c => (c.name || "").toLowerCase().includes((customerSearchTerm || "").toLowerCase()));
                                      const allFilteredSelected = filteredCustomers.length > 0 && filteredCustomers.every(c => formData.customer_ids.includes(c.id.toString()));
                                      const unselectedFiltered = filteredCustomers.filter(c => !formData.customer_ids.includes(c.id.toString()));
                                      return (
                                        <>
                                          {unselectedFiltered.length > 0 && (
                                            <>
                                              <CommandItem
                                                value="select-all-customers"
                                                onSelect={() => handleInputChange('customer_ids', [...formData.customer_ids, ...unselectedFiltered.map(c => c.id.toString())])}
                                                className="cursor-pointer"
                                              >
                                                <div className="flex items-center space-x-2 w-full">
                                                  <Checkbox
                                                    checked={allFilteredSelected}
                                                    onCheckedChange={(checked) => {
                                                      if (checked) handleInputChange('customer_ids', [...formData.customer_ids, ...unselectedFiltered.map(c => c.id.toString())]);
                                                      else handleInputChange('customer_ids', formData.customer_ids.filter(id => !filteredCustomers.map(c => c.id.toString()).includes(id)));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                  <span className="font-medium flex-1">Select All ({unselectedFiltered.length} available)</span>
                                                </div>
                                              </CommandItem>
                                              <div className="my-1 h-px bg-gray-200" />
                                            </>
                                          )}
                                          <ScrollArea className="h-64">
                                            {filteredCustomers.map((customer) => {
                                              const isSelected = formData.customer_ids.includes(customer.id.toString());
                                              const toggle = () => {
                                                if (isSelected) handleInputChange('customer_ids', formData.customer_ids.filter(id => id !== customer.id.toString()));
                                                else handleInputChange('customer_ids', [...formData.customer_ids, customer.id.toString()]);
                                              };
                                              return (
                                                <CommandItem key={customer.id} value={`${customer.name}-${customer.id}`} onSelect={toggle} className="cursor-pointer">
                                                  <div className="flex items-center space-x-2 w-full">
                                                    <Checkbox checked={isSelected} onCheckedChange={toggle} onClick={(e) => e.stopPropagation()} />
                                                    <span className="flex-1">{customer.name}</span>
                                                    {isSelected && <Check className="h-4 w-4 text-gray-600" />}
                                                  </div>
                                                </CommandItem>
                                              );
                                            })}
                                          </ScrollArea>
                                        </>
                                      );
                                    })()}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {formData.customer_ids.length > 0 && formData.customer_ids.length <= 3 && (
                            <div className="flex flex-wrap gap-1 mt-2 p-2 bg-gray-50 rounded-md border">
                              {formData.customer_ids.map((customerId) => {
                                const customer = customers.find(c => c.id.toString() === customerId.toString());
                                return (
                                  <Badge key={customerId} variant="secondary" className="text-xs flex items-center gap-1">
                                    {customer?.name || customerId}
                                    <button type="button" onClick={() => handleInputChange('customer_ids', formData.customer_ids.filter(id => id !== customerId))} className="ml-1 hover:bg-gray-300 rounded-full p-0.5">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}


                      {!hideAssignedUsers && (
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="users" className="text-xs font-medium text-gray-700">Assigned Users</Label>
                            {formData.user_ids.length > 0 && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleInputChange('user_ids', [])} className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                                <X className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                          <Popover open={userPopoverOpen} onOpenChange={(open) => { setUserPopoverOpen(open); if (!open) setUserSearchTerm(""); }}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={userPopoverOpen}
                                className="w-full h-9 justify-between border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                              >
                                <span className="truncate">
                                  {formData.user_ids.length > 0 ? `${formData.user_ids.length} user${formData.user_ids.length > 1 ? "s" : ""} selected` : "Select users"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput placeholder="Search users..." value={userSearchTerm} onValueChange={setUserSearchTerm} />
                                <CommandList>
                                  <CommandEmpty>No user found.</CommandEmpty>
                                  <CommandGroup>
                                    {(() => {
                                      const filteredUsers = usersBySelectedBranch.filter(u =>
                                        `${u.name || ""} ${u.mobile || ""}`.toLowerCase().includes((userSearchTerm || "").toLowerCase())
                                      );
                                      const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => formData.user_ids.includes(u.user_id.toString()));
                                      const unselectedFiltered = filteredUsers.filter(u => !formData.user_ids.includes(u.user_id.toString()));
                                      return (
                                        <>
                                          {unselectedFiltered.length > 0 && (
                                            <>
                                              <CommandItem
                                                value="select-all-users"
                                                onSelect={() => handleInputChange('user_ids', [...formData.user_ids, ...unselectedFiltered.map(u => u.user_id.toString())])}
                                                className="cursor-pointer"
                                              >
                                                <div className="flex items-center space-x-2 w-full">
                                                  <Checkbox
                                                    checked={allFilteredSelected}
                                                    onCheckedChange={(checked) => {
                                                      if (checked) handleInputChange('user_ids', [...formData.user_ids, ...unselectedFiltered.map(u => u.user_id.toString())]);
                                                      else handleInputChange('user_ids', formData.user_ids.filter(id => !filteredUsers.map(u => u.user_id.toString()).includes(id)));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                  <span className="font-medium flex-1">Select All ({unselectedFiltered.length} available)</span>
                                                </div>
                                              </CommandItem>
                                              <div className="my-1 h-px bg-gray-200" />
                                            </>
                                          )}
                                          {filteredUsers.map((user) => {
                                            const isSelected = formData.user_ids.includes(user.user_id.toString());
                                            const toggle = () => {
                                              if (isSelected) handleInputChange('user_ids', formData.user_ids.filter(id => id !== user.user_id.toString()));
                                              else handleInputChange('user_ids', [...formData.user_ids, user.user_id.toString()]);
                                            };
                                            return (
                                              <CommandItem key={user.user_id} value={`${user.name}-${user.user_id}`} onSelect={toggle} className="cursor-pointer">
                                                <div className="flex items-center space-x-2 w-full">
                                                  <Checkbox checked={isSelected} onCheckedChange={toggle} onClick={(e) => e.stopPropagation()} />
                                                  <span className="flex-1">{user.name} {user.mobile ? `(${user.mobile})` : ""}</span>
                                                  {isSelected && <Check className="h-4 w-4 text-gray-600" />}
                                                </div>
                                              </CommandItem>
                                            );
                                          })}
                                        </>
                                      );
                                    })()}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {formData.user_ids.length > 0 && formData.user_ids.length <= 3 && (
                            <div className="flex flex-wrap gap-1 mt-2 p-2 bg-gray-50 rounded-md border">
                              {formData.user_ids.map((userId) => {
                                const user = users.find(u => u.user_id.toString() === userId.toString());
                                return (
                                  <Badge
                                    key={userId}
                                    variant="secondary"
                                    className="text-xs flex items-center gap-1"
                                  >
                                    {user?.name || userId}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleInputChange('user_ids', formData.user_ids.filter(id => id !== userId));
                                      }}
                                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-gray-700">Assigned Items</Label>
                          {formData.item_ids.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInputChange('item_ids', [])}
                              className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.item_ids.length > 0) setIsSelectedItemsViewOpen(true);
                            else setIsAssignItemDialogOpen(true);
                          }}
                          className="w-full h-9 px-3 rounded-md border border-gray-300 bg-white text-sm text-left text-gray-900 flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        >
                          <span className="truncate">
                            {formData.item_ids.length > 0
                              ? `${formData.item_ids.length} item${formData.item_ids.length !== 1 ? "s" : ""} selected`
                              : "Select items"}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </div>

                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="machines" className="text-xs font-medium text-gray-700">Machines</Label>
                          {formData.machine_ids.length > 0 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleInputChange('machine_ids', [])} className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                              <X className="h-3 w-3 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
                        <Popover open={machinePopoverOpen} onOpenChange={(open) => { setMachinePopoverOpen(open); if (!open) setMachineSearchTerm(""); }}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" role="combobox" aria-expanded={machinePopoverOpen} className="w-full h-9 justify-between border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                              <span className="truncate">
                                {formData.machine_ids.length > 0 ? `${formData.machine_ids.length} machine${formData.machine_ids.length > 1 ? "s" : ""} selected` : "Select machines"}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput placeholder="Search machines..." value={machineSearchTerm} onValueChange={setMachineSearchTerm} />
                              <CommandList>
                                <CommandEmpty>No machine found.</CommandEmpty>
                                <CommandGroup>
                                  {(() => {
                                    const filteredMachines = machines.filter(m => (m.machine_name || "").toLowerCase().includes((machineSearchTerm || "").toLowerCase()));
                                    const allFilteredSelected = filteredMachines.length > 0 && filteredMachines.every(m => formData.machine_ids.includes(m.id.toString()));
                                    const unselectedFiltered = filteredMachines.filter(m => !formData.machine_ids.includes(m.id.toString()));
                                    return (
                                      <>
                                        {unselectedFiltered.length > 0 && (
                                          <>
                                            <CommandItem
                                              value="select-all-machines"
                                              onSelect={() => handleInputChange('machine_ids', [...formData.machine_ids, ...unselectedFiltered.map(m => m.id.toString())])}
                                              className="cursor-pointer"
                                            >
                                              <div className="flex items-center space-x-2 w-full">
                                                <Checkbox
                                                  checked={allFilteredSelected}
                                                  onCheckedChange={(checked) => {
                                                    if (checked) handleInputChange('machine_ids', [...formData.machine_ids, ...unselectedFiltered.map(m => m.id.toString())]);
                                                    else handleInputChange('machine_ids', formData.machine_ids.filter(id => !filteredMachines.map(m => m.id.toString()).includes(id)));
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="font-medium flex-1">Select All ({unselectedFiltered.length} available)</span>
                                              </div>
                                            </CommandItem>
                                            <div className="my-1 h-px bg-gray-200" />
                                          </>
                                        )}
                                        {filteredMachines.map((machine) => {
                                          const isSelected = formData.machine_ids.includes(machine.id.toString());
                                          const toggle = () => {
                                            if (isSelected) handleInputChange('machine_ids', formData.machine_ids.filter(id => id !== machine.id.toString()));
                                            else handleInputChange('machine_ids', [...formData.machine_ids, machine.id.toString()]);
                                          };
                                          return (
                                            <CommandItem key={machine.id} value={`${machine.machine_name}-${machine.id}`} onSelect={toggle} className="cursor-pointer">
                                              <div className="flex items-center space-x-2 w-full">
                                                <Checkbox checked={isSelected} onCheckedChange={toggle} onClick={(e) => e.stopPropagation()} />
                                                <span className="flex-1">{machine.machine_name}</span>
                                                {isSelected && <Check className="h-4 w-4 text-gray-600" />}
                                              </div>
                                            </CommandItem>
                                          );
                                        })}
                                      </>
                                    );
                                  })()}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {formData.machine_ids.length > 0 && formData.machine_ids.length <= 3 && (
                          <div className="flex flex-wrap gap-1 mt-2 p-2 bg-gray-50 rounded-md border">
                            {formData.machine_ids.map((machineId) => {
                              const machine = machines.find(m => m.id.toString() === machineId.toString());
                              return (
                                <Badge key={machineId} variant="secondary" className="text-xs flex items-center gap-1">
                                  {machine?.machine_name || machineId}
                                  <button
                                    type="button"
                                    onClick={() => handleInputChange('machine_ids', formData.machine_ids.filter(id => id !== machineId))}
                                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Address Information */}
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="p-3 pb-1.5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-gray-900">Address Information</CardTitle>
                      {(formData.address || formData.city || formData.state || formData.pincode) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleClearAddress}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-1.5 space-y-2.5">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address *</Label>
                      <div className="relative">
                        <Input
                          ref={addressInputRef}
                          id="address"
                          type="text"
                          value={formData.address}
                          onChange={(e) => {
                            // Allow manual typing while autocomplete is active
                            handleInputChange('address', e.target.value);
                          }}
                          placeholder="Start typing address..."
                          autoComplete="address-line1"
                          className={addressErrors.address ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                      </div>
                      {addressErrors.address && (
                        <p className="text-xs text-red-600">{addressErrors.address}</p>
                      )}
                      {GOOGLE_API_KEY ? (
                        <p className="text-xs text-gray-500">
                          {isGoogleScriptLoaded ? (
                            "Start typing to see address suggestions from Google"
                          ) : (
                            "Loading Google Places API..."
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-600">
                          Google API key not configured. Address autocomplete will not work.
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => {
                            // Only allow letters and spaces, no numbers
                            const onlyLetters = e.target.value.replace(/[^A-Za-z ]/g, "");
                            handleInputChange('city', onlyLetters);
                          }}
                          placeholder="Enter city"
                          className={addressErrors.city ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {addressErrors.city && (
                          <p className="text-xs text-red-600">{addressErrors.city}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => {
                            // Only allow letters and spaces, no numbers
                            const onlyLetters = e.target.value.replace(/[^A-Za-z ]/g, "");
                            handleInputChange('state', onlyLetters);
                          }}
                          placeholder="Enter state"
                          className={addressErrors.state ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {addressErrors.state && (
                          <p className="text-xs text-red-600">{addressErrors.state}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input
                          id="pincode"
                          value={formData.pincode}
                          maxLength={6}
                          onChange={(e) => {
                            // Only allow numbers, no letters or special characters
                            const onlyNumbers = e.target.value.replace(/[^0-9]/g, "");
                            handleInputChange('pincode', onlyNumbers);
                          }}
                          placeholder="Enter pincode"
                          className={addressErrors.pincode ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {addressErrors.pincode && (
                          <p className="text-xs text-red-600">{addressErrors.pincode}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Access Permission Module Assignment */}
                <Card className="shadow-sm border border-gray-200">
                  <CardHeader className="p-3 pb-1.5">
                    <CardTitle className="text-sm font-semibold text-gray-900">Access Permissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                          <tr>
                            <th className="h-9 px-3 py-2 text-center align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs w-25">
                              <div className="flex flex-col items-center space-y-1">
                                <span>Select All</span>
                                <Checkbox
                                  checked={isAllModulesSelected()}
                                  onCheckedChange={handleSelectAllModules}
                                />
                              </div>
                            </th>
                            <th className="h-9 px-3 py-2 text-left align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs w-1/3">Add Modules</th>
                            <th className="h-9 px-3 py-2 text-center align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs w-1/6">Create</th>
                            <th className="h-9 px-3 py-2 text-center align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs w-1/6">Read</th>
                            <th className="h-9 px-3 py-2 text-center align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs w-1/6">Update</th>
                            <th className="h-9 px-3 py-2 text-center align-middle font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs w-1/6">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {accessModules.map((module) => (
                            <tr key={module.id} className="hover:bg-gray-50">
                              <td className="px-2 py-3 text-center w-25">
                                <Checkbox
                                  checked={isAllSelected(module.alias)}
                                  onCheckedChange={(checked) => handleSelectAll(module.alias, checked)}
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 w-1/3">
                                {module.name}
                              </td>
                              <td className="px-4 py-3 text-center w-1/6">
                                <Checkbox
                                  checked={permissions[module.alias]?.includes('c') || false}
                                  onCheckedChange={(checked) => handlePermissionChange(module.alias, 'c', checked)}
                                />
                              </td>
                              <td className="px-4 py-3 text-center w-1/6">
                                <Checkbox
                                  checked={permissions[module.alias]?.includes('r') || false}
                                  onCheckedChange={(checked) => handlePermissionChange(module.alias, 'r', checked)}
                                />
                              </td>
                              <td className="px-4 py-3 text-center w-1/6">
                                <Checkbox
                                  checked={permissions[module.alias]?.includes('u') || false}
                                  onCheckedChange={(checked) => handlePermissionChange(module.alias, 'u', checked)}
                                />
                              </td>
                              <td className="px-4 py-3 text-center w-1/6">
                                <Checkbox
                                  checked={permissions[module.alias]?.includes('d') || false}
                                  onCheckedChange={(checked) => handlePermissionChange(module.alias, 'd', checked)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="flex justify-end space-x-4 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBackToUsers}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {isEditMode ? "Updating User..." : "Adding User..."}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isEditMode ? "Update User" : "Add User"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>

      {/* Selected items view popup - list only, no inline space */}
      <Dialog open={isSelectedItemsViewOpen} onOpenChange={setIsSelectedItemsViewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Selected items ({formData.item_ids?.length ?? 0})
            </DialogTitle>
            <DialogDescription>
              Items assigned to this user. Remove individually or use Change selection to add/remove in bulk.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex-1 min-h-0 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2 space-y-1.5 list-none">
            {(formData.item_ids || []).map((itemId) => {
              const item = (stockItems || []).find((i) => i.id.toString() === itemId.toString());
              const moduleItem = (formData.item_modules || []).find((m) => String(m.item_id) === String(itemId));
              const displayName = item?.name || moduleItem?.item_name || itemId;
              const group = moduleItem?.group;
              const category = moduleItem?.category;
              return (
                <li key={itemId} className="flex items-center justify-between gap-2 py-2 px-3 rounded bg-white border border-gray-100 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900 block truncate">{displayName}</span>
                    {(group || category) && (
                      <span className="text-xs text-gray-500 truncate block">
                        {[group, category].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange('item_ids', formData.item_ids.filter((id) => id !== itemId))}
                    className="shrink-0 p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2 justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setIsSelectedItemsViewOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsSelectedItemsViewOpen(false);
                setIsAssignItemDialogOpen(true);
              }}
            >
              Change selection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Item Dialog (popup) - reference from item-masters: group/category filter, select all */}
      <Dialog open={isAssignItemDialogOpen} onOpenChange={setIsAssignItemDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Assign Items
            </DialogTitle>
            <DialogDescription>
              Filter by item grouping, status, and stock balance, then select items to assign to this user. Use Select All to select all items on the current page.
            </DialogDescription>
          </DialogHeader>

          {/* Filters — same as item-masters */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end py-2">
            <div className="space-y-2 flex-1 min-w-0">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-600" />
                Search Items
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name..."
                  value={assignItemSearchTerm}
                  onChange={(e) => setAssignItemSearchTerm(e.target.value)}
                  className="pl-10 pr-8 h-9 w-full"
                />
                {assignItemSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setAssignItemSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 w-full lg:w-52 shrink-0">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Filter className="h-4 w-4 text-purple-600" />
                Item Grouping
              </label>
              <Select
                value={assignItemSelectedItemGrouping || "all"}
                onValueChange={(value) => setAssignItemSelectedItemGrouping(value === "all" ? "" : value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select item grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groupings</SelectItem>
                  {ITEM_GROUPING_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={`assign-filter-grouping-${option}`} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full lg:w-40 shrink-0">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Status
              </label>
              <Select value={assignItemActiveStatusFilter} onValueChange={setAssignItemActiveStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deactive">Deactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full lg:w-44 shrink-0">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Stock
              </label>
              <Select value={assignItemInStockFilter} onValueChange={setAssignItemInStockFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All balances</SelectItem>
                  <SelectItem value="in_stock">In stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-11 shrink-0"
              onClick={clearAssignItemFilters}
              title="Clear filters"
              aria-label="Clear filters"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex items-center lg:pb-0.5 shrink-0">
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {assignItemDialogSelectedIds.length} selected
              </span>
            </div>
          </div>

          {/* Table with Select All - fixed height so all 50 items scroll */}
          <div className="border rounded-md min-h-[200px] h-[50vh] max-h-[480px] overflow-hidden flex flex-col">
            {assignDialogItemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : assignDialogItemsSorted.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">No items match the filters.</div>
            ) : (
              <ScrollArea className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={assignDialogItemsSorted.length > 0 && assignDialogItemsSorted.every((item) => assignItemDialogSelectedIds.includes(String(item.id)))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setAssignItemDialogSelectedIds((prev) => {
                                const add = assignDialogItemsSorted.map((i) => String(i.id));
                                return [...new Set([...prev, ...add])];
                              });
                            } else {
                              const removeIds = new Set(assignDialogItemsSorted.map((i) => String(i.id)));
                              setAssignItemDialogSelectedIds((prev) => prev.filter((id) => !removeIds.has(id)));
                            }
                          }}
                          aria-label="Select all on page"
                        />
                      </TableHead>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Item Grouping</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignDialogItemsSorted.map((item, index) => {
                      const idStr = String(item.id);
                      const isSelected = assignItemDialogSelectedIds.includes(idStr);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {
                                setAssignItemDialogSelectedIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== idStr) : [...prev, idStr]
                                );
                              }}
                              aria-label={`Select ${item.name}`}
                            />
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {(assignItemPage - 1) * ASSIGN_ITEMS_PER_PAGE + index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-500" />
                              {item.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-[200px] truncate" title={formatItemGroupingsLabel(item)}>
                            {formatItemGroupingsLabel(item)}
                          </TableCell>
                          <TableCell>{item.parent || "—"}</TableCell>
                          <TableCell>{item.category ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>

          {/* Pagination */}
          {assignDialogTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-gray-500">
                Page {assignItemPage} of {assignDialogTotalPages} ({assignDialogTotalCount} items)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={assignItemPage <= 1}
                  onClick={() => setAssignItemPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={assignItemPage >= assignDialogTotalPages}
                  onClick={() => setAssignItemPage((p) => Math.min(assignDialogTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAssignItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleInputChange('item_ids', assignItemDialogSelectedIds);
                setIsAssignItemDialogOpen(false);
              }}
            >
              Confirm ({assignItemDialogSelectedIds.length} selected)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loader */}
      <Loader isLoading={isLoading} text="Loading user list" />
    </div>
  );
}