import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { sidebarMenuItems } from "@/lib/static-data";
import { AuthService } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import logo from "@/assets/gp_logo1.png";
import { useQuery } from "@tanstack/react-query";
import {
  Gauge,
  Users,
  Upload,
  Plus,
  Settings,
  BarChart3,
  UserPen,
  ShieldCheck,
  LogOut,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Activity,
  Clock,
  TrendingUp,
  Warehouse,
  Package,
  Link as LinkIcon,
  Link2,
  Receipt,
  ShoppingCart,
  UserPlus,
  Building2,
  CreditCard,
  MapPin,
  Folder,
  Route,
  IndianRupee,
  Percent,
  // New unique icons
  ClipboardList, // 👈 For Inward Reports
  BookOpen, // 👈 For Ledger Masters
  Cpu, // 👈 For Machine Reports
  TestTube, // 👈 For Testing Params
  History, // 👈 For Recent Activity
  ShoppingBag, // 👈 For Purchase Report
  Calendar, // 👈 For Attendance Report
  DollarSign, // 👈 For Expense Reports
  FileCheck, // 👈 For Receipt Reports
  Box, // 👈 For Item Masters
  Image, // 👈 For Banners
  Truck, // 👈 For Hamali Type Masters
  Tag, // 👈 For Base Price Master
  Navigation, // 👈 For Live Tracking
  Cog, // 👈 For Machine Params
  Wallet, // 👈 For Outstanding Reports
  Video, // 👈 Help Videos
  GitCompare,
  Bell,
  HardHat,
  UserSearch,
  Layers,
  ArrowRightLeft,
  Megaphone,
  Send,
  LayoutTemplate,
  Target,
  Smartphone,
} from "lucide-react";

const iconMap = {
  gauge: Gauge,
  users: Users,
  warehouse: Warehouse,
  package: Package,
  link: LinkIcon,
  upload: Upload,
  plus: Plus,
  settings: Settings,
  "bar-chart-3": BarChart3,
  "user-pen": UserPen,
  "shield-check": ShieldCheck,
  "log-out": LogOut,
  folder: Folder,
  route: Route,
  "user-plus": UserPlus,
  "indian-rupee": IndianRupee,
  receipt: Receipt,
  "shopping-cart": ShoppingCart,
  percent: Percent,
  activity: History, // 👈 changed to History for Recent Activity
  "building-2": Building2,
  "credit-card": CreditCard,
  "map-pin": MapPin,
  "clipboard-list": ClipboardList, // 👈 Inward menu
  "shopping-bag": ShoppingBag, // 👈 Purchase Orders (unique from Sales Orders)
  "file-check": FileCheck, // 👈 added for Receipt
  "file-text": FileText, // 👈 added for Contact Us
  "book-open": BookOpen,
  "image": Image, // 👈 added for Banners
  "wallet": Wallet, // 👈 added for Outstanding Reports
  "video": Video, // 👈 Help Videos
  "bell": Bell,
  "test-tube": TestTube,
  truck: Truck,
  "hard-hat": HardHat,
  "arrow-right-left": ArrowRightLeft,
  megaphone: Megaphone,
};

// Filter Outward submenus based on permissions (Sales Order Report moved to standalone menu)
const getOutwardSubMenus = (hasModuleAccess, hasPermission, isTallyEnabled) => {
  const allOutwardMenus = [
    { name: "Gate Pass Report", icon: Package, path: "/outward/outward-list", module: "outward" },
    { name: "Delivery Note", icon: FileText, path: "/outward/delivery-notes", module: "outward" },
  ];
  
  return allOutwardMenus.filter((menu) => {
    if (!hasPermission("outward", "read")) return false;
    return true;
  });
};

// Filter report submenus based on permissions (excluding items moved to Inward/Outward/Expense/Receipt)
const getReportSubMenus = (hasModuleAccess, hasPermission, isTallyEnabled) => {
  const allReportMenus = [
    { name: "Stock Summary", icon: Warehouse, path: "/reports/stock-summary", module: "stock_summary_report" },
    { name: "Stock Journals", icon: BarChart3, path: "/reports/stock-journal", module: "stock_journal" },
    { name: "SO Reports", icon: ShoppingCart, path: "/reports/sales-order-dispatch-report", module: "sales_order" },
    { name: "Sales Master Report", icon: Receipt, path: "/reports/sales-master-report", module: "sales_order" },
    { name: "SO Deviation Report", icon: FileText, path: "/reports/so-deviation-report", module: "sales_order" },
    { name: "PO Reports", icon: ShoppingBag, path: "/reports/po-reports", module: "purchase_order" },
    { name: "PO Deviation Report", icon: FileText, path: "/reports/po-deviation-report", module: "purchase_order" },
    { name: "Lab Test Report", icon: TestTube, path: "/reports/lab-test-report", module: "inward" },
    { name: "Unloading Report", icon: ClipboardList, path: "/reports/unloading-report", module: "inward" },
    { name: "APMC Permit Report", icon: FileText, path: "/reports/apmc-permit-report", module: "inward" },
    { name: "Loading Report", icon: ClipboardList, path: "/reports/loading-report", module: "sales_order" },
    { name: "Production Report", icon: GitCompare, path: "/reports/production-report", module: "process_report" },
    { name: "Process Report", icon: GitCompare, path: "/reports/process-stock-flow", module: "process_report" },
    { name: "Machine Performance", icon: Cpu, path: "/reports/machine", module: "machine_reports" },
    { name: "Hamali Report", icon: TrendingUp, path: "/reports/hamali", module: "hamali" },
    { name: "Brokerage Report", icon: Percent, path: "/reports/brokerage-reports", module: "brokerage" },
    { name: "Route Activity Report", icon: Route, path: "/reports/route-activity-report", module: "route_management" },
    { name: "Attendance Report", icon: Calendar, path: "/reports/attendance", module: "attendance" },
    { name: "Customer Analysis", icon: UserSearch, path: "/reports/customer-analysis", module: "customer_analysis" },
    { name: "User Analysis", icon: Users, path: "/reports/salesman-analysis", module: "salesman_analysis" },
    { name: "Salesman Report", icon: Target, path: "/reports/user-sales-order-report", module: "sales_order" },
    { name: "Item Analysis", icon: Package, path: "/reports/item-analysis", module: "item_analysis" },
    { name: "Analyzer Report", icon: Layers, path: "/reports/stock-group-analysis", module: "stock_group_analysis" },
    { name: "Voucher Analysis", icon: Receipt, path: "/reports/voucher-analysis", module: "voucher_analysis" },
  ];
  
  // Stock Summary is an unrestricted catalog report; other reports use module permissions.
  return allReportMenus.filter(menu => {
    if (menu.module === "stock_summary_report") {
      return true;
    }
    if (menu.module === "ledgers_account" && !isTallyEnabled) {
      return false;
    }
    if (menu.module === "hamali") {
      // Check exact module name from API: "hamali"
      const hasAccess = hasPermission("hamali", "read");
      return hasAccess;
    }
    if (menu.module === "stock_journal") {
      // Check exact module name from API: "stock_journals" (plural)
      const hasAccess = hasPermission("stock_journals", "read");
      return hasAccess;
    }
    if (menu.module === "process_report") {
      return hasPermission("stock_journals", "read");
    }
    if (menu.module === "machine_reports") {
      // Check if user has read permission for machine performance - reports require read access
      const hasAccess = hasPermission("machine_performance", "read");
      
      return hasAccess;
    }
    if (menu.module === "brokerage") {
      // Brokerage Report - needs read access for brokerage module
      const hasAccess = hasPermission("brokerage", "read");
      return hasAccess;
    }
    if (menu.module === "route_management") {
      return hasPermission("route_management", "read");
    }
    if (menu.module === "purchase_order") {
      return hasPermission("purchase_order", "read");
    }
    if (menu.module === "sales_order") {
      return hasPermission("sales_order", "read");
    }
    if (menu.module === "inward") {
      return hasPermission("inward", "read");
    }
    if (
      menu.module === "customer_analysis" ||
      menu.module === "salesman_analysis" ||
      menu.module === "item_analysis" ||
      menu.module === "stock_group_analysis"
    ) {
      return hasPermission("analysis_reports", "read");
    }
    if (menu.module === "voucher_analysis") {
      return hasPermission("stock_journals", "read");
    }
    return true; // For other modules, show by default (can be updated later)
  });
};

// Filter masters submenus based on permissions
const getMastersSubMenus = (hasModuleAccess, hasPermission, isTallyEnabled) => {
  const allMastersMenus = [
    { name: "Branches", icon: Building2, path: "/branches", module: "branches_menu" },
    { name: "Godown Masters", icon: Warehouse, path: "/godown-masters", module: "godown_masters" },
    { name: "Stock Masters", icon: Layers, path: "/stock-masters", module: "stock_masters" },
    { name: "Brokers Master", icon: Users, path: "/broker-masters", module: "broker_master" },
    { name: "Item Masters", icon: Box, path: "/item-masters", module: "item_masters" },
    { name: "GST Masters", icon: Percent, path: "/gst-masters", module: "customer_management" },
    { name: "Testing Params", icon: TestTube, path: "/lab-test-params", module: "lab_test_params" },
    { name: "Machine Params", icon: Cog, path: "/machine-params", module: "machine_params" },
    { name: "Hamali Type Masters", icon: Truck, path: "/hamali-type-masters", module: "hamali" },
    { name: "Expense Types", icon: Receipt, path: "/expense-type-masters", module: "expense_management" },
    { name: "Labour Management", icon: HardHat, path: "/labour-management", module: "labour_management" },
    { name: "Base Price Master", icon: Tag, path: "/item-listing", module: "item_listing" },
    { name: "View Live Stocks", icon: Activity, path: "/live-stocks", module: "live_stocks" },
    { name: "Brokerage", icon: Wallet, path: "/margin-settings/brokerage-configuration", module: "brokerage" },
    { name: "Voucher Settings", icon: Settings, path: "/voucher-settings", module: "control_settings" },
  ];
  
  // Filter based on permissions - user needs appropriate access to see the master
  return allMastersMenus.filter(menu => {
    if (menu.module === "branches_menu") {
      return AuthService.getUserData()?.role_id === 1;
    }
    if (menu.module === "live_stocks" && !isTallyEnabled) {
      return false;
    }
    if (menu.module === "brokerage") {
      return hasPermission("brokerage", "read");
    }
    if (menu.module === "control_settings") {
      return hasPermission("control_settings", "read");
    }
    if (menu.module === "hamali") {
      // Check exact module name from API: "hamali" - needs read access
      const hasAccess = hasPermission("hamali", "read");
      return hasAccess;
    }
    if (menu.module === "labour_management") {
      return hasPermission("hamali", "read");
    }
    if (menu.module === "expense_management") {
      return hasPermission("expense_management", "read");
    }
    if (menu.module === "customer_management") {
      return hasPermission("customer_management", "read");
    }
    if (menu.module === "lab_test_params") {
      // Testing Params - needs create access for inward module
      const hasAccess = hasPermission("inward", "create");
      
      return hasAccess;
    }
    if (menu.module === "machine_params") {
      // Machine Params - needs create access for machine_performance module
      const hasAccess = hasPermission("machine_performance", "create");
      
      return hasAccess;
    }
    if (menu.module === "item_listing") {
      // Base Price Master - needs read access for sales_order module
      const hasAccess = hasPermission("sales_order", "read");
      
      return hasAccess;
    }
    return true; // For other modules, show by default (can be updated later)
  });
};

// Route Management Submenus
const routeManagementSubMenus = [
  { name: "Activity name", icon: ClipboardList, path: "/route-activities" },
  { name: "Create Route", icon: Route, path: "/route-management" },
  { name: "Assign Route", icon: UserPlus, path: "/route-assignment" },
  { name: "Route Activity", icon: Activity, path: "/route-activity" },
  { name: "Live Tracking", icon: Navigation, path: "/live-tracking" },
];

const logisticsSubMenus = [
  { name: "Providers", icon: Building2, path: "/logistics/providers" },
  { name: "Drivers", icon: Users, path: "/logistics/drivers" },
  { name: "Vehicles", icon: Truck, path: "/logistics/vehicles" },
  { name: "Serviceable Routes", icon: MapPin, path: "/logistics/serviceable-routes" },
];

// Margin Settings Submenus
const getMarginSettingsSubMenus = (hasPermission) => {
  const items = [
    {
      name: "Item Price Margin",
      icon: Percent,
      path: "/margin-settings/item-price-margin",
      module: "item_price_margin",
    },
    {
      name: "Price Master",
      icon: IndianRupee,
      path: "/price-master",
      module: "price_master",
    },
  ];
  return items.filter((menu) => {
    if (menu.module === "item_price_margin") {
      return hasPermission("margin_settings", "read");
    }
    if (menu.module === "price_master") {
      return hasPermission("stock_items", "read");
    }
    return true;
  });
};


const getSalesSubMenus = (hasPermission) => {
  const allSalesMenus = [
    { name: "Sales Orders", icon: ShoppingCart, path: "/reports/sales-order-list", module: "sales_order", action: "read" },
    { name: "Sales Register", icon: Receipt, path: "/reports/sales-register", module: "sales_order", action: "read" },
    { name: "SO Quotation", icon: FileText, path: "/sales/so-quotations", module: "sales_order", action: "read" },
    { name: "Sales Target", icon: Target, path: "/sales/sales-targets", module: "sales_order", action: "read" },
    { name: "Sales Return", icon: Receipt, path: "/reports/sales-return-reports", module: "sales_return", action: "read" },
  ];

  return allSalesMenus.filter((menu) => {
    if (menu.name === "Sales Return") {
      return (
        hasPermission("sales_return", "read") ||
        hasPermission("sales_order", "read")
      );
    }
    return hasPermission(menu.module, menu.action || "read");
  });
};

const getInwardSubMenus = () => [
  { name: "Inward List", icon: ClipboardList, path: "/reports/inward-list" },
  { name: "Purchase Invoice", icon: FileText, path: "/reports/purchase-invoices" },
];

const getPurchaseSubMenus = (hasPermission) => {
  const allPurchaseMenus = [
    { name: "Purchase Orders", icon: ShoppingBag, path: "/reports/purchaseorders-reports", module: "purchase_order" },
    { name: "Purchase Register", icon: Receipt, path: "/reports/purchase-register", module: "purchase_order" },
    { name: "Purchase Return", icon: Receipt, path: "/reports/purchase-return-reports", module: "purchase_return" },
  ];

  return allPurchaseMenus.filter((menu) => {
    if (menu.name === "Purchase Return") {
      return (
        hasPermission("purchase_return", "read") ||
        hasPermission("purchase_order", "read")
      );
    }
    return hasPermission(menu.module, "read");
  });
};

const promotionalSubMenus = [
  { name: "Templates", icon: LayoutTemplate, path: "/promotional/templates" },
  { name: "Send Messages", icon: Send, path: "/promotional/send-messages" },
  { name: "Send History", icon: History, path: "/promotional/send-history" },
];

const getReceiptSubMenus = (hasPermission, isTallyEnabled) => {
  const items = [];
  if (hasPermission("receipt_management", "read")) {
    items.push({
      name: "Receipt List",
      icon: FileCheck,
      path: "/receipt-list",
      module: "receipt_management",
    });
  }
  if (isTallyEnabled && hasPermission("ledgers_account", "read")) {
    items.push({
      name: "Outstanding Report",
      icon: Wallet,
      path: "/reports/outstanding-reports",
      module: "ledgers_account",
    });
  }
  return items;
};

const getLedgerManagementSubMenus = (hasPermission) => {
  const items = [
    { name: "Ledger Masters", icon: BookOpen, path: "/ledger-masters", module: "ledger_masters" },
    { name: "Ledgers Group", icon: Building2, path: "/ledgers-group", module: "ledger_masters" },
    { name: "Additional Ledgers", icon: Layers, path: "/additional-ledgers", module: "ledger_masters" },
    { name: "Ledgers Credit Settings", icon: CreditCard, path: "/ledger-credit-settings", module: "ledger_masters" },
    { name: "Retailers Info", icon: Smartphone, path: "/retailers-info", module: "ledger_masters" },
    { name: "Area Listing", icon: MapPin, path: "/area-listing", module: "customer_management" },
    { name: "KYC Document Types", icon: FileText, path: "/kyc-document-type-masters", module: "customer_management" },
  ];
  const canRead = typeof hasPermission === "function" ? hasPermission : () => true;
  return items.filter((menu) => {
    if (menu.module === "customer_management") {
      try {
        return !!canRead("customer_management", "read");
      } catch {
        return true;
      }
    }
    return true;
  });
};

const isLedgerManagementPath = (location) =>
  location.includes("/ledger-masters") ||
  location.includes("/ledgers-group") ||
  location.includes("/additional-ledgers") ||
  location.includes("/ledger-credit-settings") ||
  location.includes("/retailers-info") ||
  location.includes("/area-listing") ||
  location.includes("/kyc-document-type-masters");

const isLedgerSubMenuActive = (location, path) => {
  if (!path) return false;
  return location === path || location.startsWith(`${path}/`);
};

export default function MobileSidebar({ isOpen, onClose }) {
  const [location, setLocation] = useLocation();
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isMastersOpen, setIsMastersOpen] = useState(false);
  const [isLedgerManagementOpen, setIsLedgerManagementOpen] = useState(false);
  const [isRouteManagementOpen, setIsRouteManagementOpen] = useState(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [isMarginSettingsOpen, setIsMarginSettingsOpen] = useState(false);
  const [isOutwardOpen, setIsOutwardOpen] = useState(false); // 👈 new state for Outward dropdown
  const [isInwardOpen, setIsInwardOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isPromotionalOpen, setIsPromotionalOpen] = useState(() =>
    location.includes("promotional-activity") ||
    location.includes("promotional-templates") ||
    location.startsWith("/promotional/")
  );
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isProductionVoucherTypesOpen, setIsProductionVoucherTypesOpen] = useState(false);
  
  // Get user permissions
  const { hasModuleAccess, hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const userData = AuthService.getUserData();
  const rawTallyEnabled =
    userData?.is_tally_enabled ??
    userData?.user_info?.is_tally_enabled ??
    userData?.organization?.is_tally_enabled;
  const isTallyEnabled = !(
    rawTallyEnabled === false ||
    rawTallyEnabled === 0 ||
    rawTallyEnabled === "0" ||
    rawTallyEnabled === "false" ||
    rawTallyEnabled === "False"
  );

  // Auto-open Outward dropdown when on outward-list, add-outward, delivery-notes, or invoices pages
  useEffect(() => {
    if (location.includes("outward-list") || location.includes("add-outward") ||
        location.includes("delivery-notes") || location.includes("invoices")) {
      setIsOutwardOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (location.includes("inward-list") || location.includes("purchase-invoices") ||
        location.includes("add-inward") || location.includes("inward-details")) {
      setIsInwardOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (location.includes("purchaseorders-reports") || location.includes("purchase-register") || location.includes("add-purchase-order") ||
        location.includes("purchase-return-reports") || location.includes("add-purchase-return")) {
      setIsPurchaseOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (location.includes("sales-order-list") || location.includes("sales-register") || location.includes("so-quotations") || location.includes("create-so-quotation") || location.includes("create-sales-order") ||
        location.includes("sales-return-reports") || location.includes("add-sales-return") ||
        location.includes("sales-targets")) {
      setIsSalesOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (
      location.includes("promotional-activity") ||
      location.includes("promotional-templates") ||
      location.startsWith("/promotional/")
    ) {
      setIsPromotionalOpen(true);
    }
  }, [location]);

  // Auto-open Masters dropdown when on any masters page
  useEffect(() => {
    if (location.includes("godown-masters") || location.includes("item-masters") || 
        location.includes("all-item-mapping") ||
        location.includes("gst-masters") || location.includes("lab-test-params") ||
        location.includes("machine-params") || location.includes("hamali-type-masters") ||
        location.includes("expense-type-masters") ||
        location.includes("labour-management") ||
        location.includes("item-listing") || location.includes("/branches") ||
        location.includes("/voucher-settings") || location.includes("/margin-settings/brokerage-configuration") ||
        location.includes("/margin-settings/item-price-margin") || location.includes("/price-master")) {
      setIsMastersOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (isLedgerManagementPath(location)) {
      setIsLedgerManagementOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (location.includes("receipt-list") || location.includes("/add-receipt") ||
        location.includes("/update-receipt") || location.includes("/edit-receipt") ||
        location.includes("outstanding-reports")) {
      setIsReceiptOpen(true);
    }
  }, [location]);

  // Auto-open Reports dropdown when on any report page
  useEffect(() => {
    if (location.includes("stock-journal") || location.includes("machine-reports") || 
        location.includes("/reports/hamali") ||
        (location.startsWith("/reports/") &&
          !location.includes("outstanding-reports") &&
          !location.includes("sales-order-list") &&
          !location.includes("sales-register") &&
          !location.includes("sales-return-reports") &&
          !location.includes("create-sales-order") &&
          !location.includes("add-sales-return"))) {
      setIsReportsOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (location.startsWith("/reports/production-report")) {
      setIsProductionVoucherTypesOpen(true);
    }
  }, [location]);

  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  const { data: productionVoucherTypesData = [] } = useQuery({
    queryKey: ["voucher-types-production-mobile-sidebar"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-voucher-types/?is_active=true`);
      const data = await response.json();
      if (!response.ok || data?.status !== 200) {
        throw new Error(data?.message || "Failed to fetch voucher types");
      }
      return Array.isArray(data?.data) ? data.data : [];
    },
    enabled: !!AuthService.getAccessToken() && hasPermission("stock_journals", "read"),
    refetchOnWindowFocus: false,
  });

  const productionVoucherTypeOptions = useMemo(
    () =>
      (Array.isArray(productionVoucherTypesData) ? productionVoucherTypesData : []).map((v) => ({
        id: String(v.id),
        name: v.name || `Voucher ${v.id}`,
      })),
    [productionVoucherTypesData]
  );

  // Auto-open Route Management dropdown when on route-management or route-assignment pages
  useEffect(() => {
    if (location.includes("route-management") || location.includes("route-assignment") || location.includes("route-activity") || location.includes("route-activities") || location.includes("live-tracking")) {
      setIsRouteManagementOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (location.includes("/logistics/") || location.includes("/logistics-management")) {
      setIsLogisticsOpen(true);
    }
  }, [location]);

  // Auto-open Margin Settings dropdown when on its pages
  useEffect(() => {
    if (
      location.includes("/margin-settings/item-price-margin") ||
      location.includes("/price-master")
    ) {
      setIsMarginSettingsOpen(true);
    }
  }, [location]);

  const handleNavigation = async (path, name) => {
    if (name === "Log out") {
      try {
        await AuthService.logout();
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        setLocation("/login");
        onClose();
      } catch (error) {
        console.error("Logout error:", error);
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        setLocation("/login");
        onClose();
      }
    } else if (name === "Reports") {
      setIsReportsOpen(!isReportsOpen);
    } else if (name === "Masters") {
      setIsMastersOpen(!isMastersOpen);
    } else if (name === "Ledger Management") {
      setIsLedgerManagementOpen(!isLedgerManagementOpen);
    } else if (name === "Route Management") {
      setIsRouteManagementOpen(!isRouteManagementOpen);
    } else if (name === "Logistics") {
      setIsLogisticsOpen(!isLogisticsOpen);
    } else if (name === "Margin Settings") {
      setIsMarginSettingsOpen(!isMarginSettingsOpen);
    } else if (name === "Outward") { // 👈 toggle outward submenu
      const onPage = location.includes("outward-list") || location.includes("add-outward") ||
        location.includes("delivery-notes") || location.includes("invoices");
      setIsOutwardOpen(onPage ? true : !isOutwardOpen);
    } else if (name === "Inward") {
      const onPage = location.includes("inward-list") || location.includes("purchase-invoices") ||
        location.includes("add-inward") || location.includes("inward-details");
      setIsInwardOpen(onPage ? true : !isInwardOpen);
    } else if (name === "Purchase") {
      const onPage = location.includes("purchaseorders-reports") || location.includes("purchase-register") || location.includes("add-purchase-order") ||
        location.includes("purchase-return-reports") || location.includes("add-purchase-return");
      setIsPurchaseOpen(onPage ? true : !isPurchaseOpen);
    } else if (name === "Sales") {
      const onPage = location.includes("sales-order-list") || location.includes("sales-register") || location.includes("so-quotations") || location.includes("create-so-quotation") || location.includes("create-sales-order") ||
        location.includes("sales-return-reports") || location.includes("add-sales-return") ||
        location.includes("sales-targets");
      setIsSalesOpen(onPage ? true : !isSalesOpen);
    } else if (name === "Promotional") {
      const onPage =
        location.includes("promotional-activity") ||
        location.includes("promotional-templates") ||
        location.startsWith("/promotional/");
      setIsPromotionalOpen(onPage ? true : !isPromotionalOpen);
    } else if (name === "Receipt") {
      const onPage = location.includes("receipt-list") || location.includes("/add-receipt") ||
        location.includes("/update-receipt") || location.includes("/edit-receipt") ||
        location.includes("outstanding-reports");
      setIsReceiptOpen(onPage ? true : !isReceiptOpen);
    } else if (name === "Production") {
      setIsProductionVoucherTypesOpen(!isProductionVoucherTypesOpen);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="fixed left-0 top-0 h-full w-64 sidebar-gradient text-white transform transition-transform flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-start space-x-3 flex-1">
            <div className="bg-white rounded-full flex-shrink-0">
              <img src={logo} alt="GrainsPro ERP Logo" className="h-8 w-auto" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-white leading-tight">GrainsPro ERP</h1>
              <p className="text-gray-300 text-xs leading-tight">Enterprise Resource Planning</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto hide-scrollbar mt-2">
          {sidebarMenuItems.map((item, index) => {
            const Icon = iconMap[item.icon] || Package;
            const isActive = location === item.path ||
            (item.name === "Banners" && location === "/banners") ||
                            (item.name === "Dashboard" && location === "/dashboard") || 
                            (item.name === "Import Data" && location === "/import") ||
                            (item.name === "User List" && (location === "/users" || location.includes("/add-user") || location.includes("/update-user") || location.includes("/edit-user"))) ||
                            (item.name === "Help Videos" && location === "/help-videos") ||
                            (item.name === "Privacy" && location === "/privacy")||      
                            (item.name === "Admin Settings" && location === "/admin-settings") ||
                            (item.name === "Contact Us" && location === "/contact-us")||      
                            (item.name === "Purchase" && (location.includes("purchaseorders-reports") || location.includes("purchase-register") || location.includes("add-purchase-order") || location.includes("purchase-return-reports") || location.includes("add-purchase-return"))) ||
                            (item.name === "Reports" && location.startsWith("/reports") && !location.includes("inward-list") && !location.includes("purchase-invoices") && !location.includes("purchaseorders-reports") && !location.includes("purchase-register") && !location.includes("sales-order-list") && !location.includes("sales-register") && !location.includes("sales-return-reports") && !location.includes("expense-list") && !location.includes("outstanding-reports")) ||
                            (item.name === "Masters" && (
                              ["/branches","/godown-masters","/stock-masters","/broker-masters","/item-masters","/all-item-mapping","/gst-masters","/lab-test-params","/machine-params","/voucher-settings","/margin-settings/brokerage-configuration","/labour-management","/item-listing"].includes(location) ||
                              location.includes("/labour-management")
                            )) ||
                            (item.name === "Ledger Management" && isLedgerManagementPath(location)) ||
                            (item.name === "Route Management" && (location.startsWith("/route-management") || location.startsWith("/route-assignment") || location.startsWith("/route-activity") || location.startsWith("/route-activities"))) ||
                            (item.name === "Logistics" && (location.includes("/logistics/") || location.includes("/logistics-management"))) ||
                            (item.name === "Margin Settings" && (
                              location.includes("/margin-settings/item-price-margin") ||
                              location.includes("/price-master")
                            )) ||
                            (item.name === "Recent Activity" && location === "/recent-activity") ||
                            (item.name === "Stock Auditing" && location === "/stock-auditing") ||
                            (item.name === "Notification Settings" && location === "/notification-settings") ||
                            (item.name === "Inward" && (location.includes("inward-list") || location.includes("purchase-invoices") || location.includes("add-inward") || location.includes("inward-details"))) ||
                            (item.name === "Item Testing" && location.includes("/item-testing")) ||
                            (item.name === "Weighbridge" && location.includes("/vehicle-info")) ||
                            (item.name === "Stock Transfer" && location.includes("/stock-transfer")) ||
                            (item.name === "Outward" && (location.startsWith("/outward") || location.includes("outward-details"))) ||
                            (item.name === "Sales" && (location.includes("sales-order-list") || location.includes("sales-register") || location.includes("so-quotations") || location.includes("create-so-quotation") || location.includes("create-sales-order") || location.includes("sales-return-reports") || location.includes("add-sales-return") || location.includes("sales-targets"))) ||
                            (item.name === "Promotional" && (location.includes("promotional-activity") || location.includes("promotional-templates") || location.startsWith("/promotional/"))) ||
                            (item.name === "Expense" && (location.includes("expense-list") || location.includes("/add-expense") || location.includes("/update-expense") || location.includes("/edit-expense"))) ||
                            (item.name === "Receipt" && (location.includes("receipt-list") || location.includes("/add-receipt") || location.includes("/update-receipt") || location.includes("/edit-receipt") || location.includes("outstanding-reports")));
            
            // Hide menu items based on read permissions
            // Dashboard, Privacy Policy, Contact Us, Log out - always visible (no permission check)
            if (item.name === "Dashboard" || item.name === "Help Videos" || item.name === "Privacy Policy" || item.name === "Contact Us" || item.name === "Log out") {
              // Always show these items
            } else if (item.name === "Admin Settings") {
              if (!hasModuleAccess("admin_settings")) {
                return null;
              }
            } else if (item.name === "User List") {
              // Hide User List if no read permission
              if (!hasPermission("user_management", "read")) {
                return null;
              }
            } else if (item.name === "Inward") {
              // Hide Inward if no read permission
              if (!hasPermission("inward", "read")) {
                return null;
              }
            } else if (item.name === "Item Testing") {
              if (!hasPermission("item_testing", "read")) {
                return null;
              }
            } else if (item.name === "Weighbridge") {
              if (!hasPermission("way_bridge_info", "read")) {
                return null;
              }
            } else if (item.name === "Stock Transfer" || item.name === "Godown Transfer") {
              if (!hasPermission("stock_transfer", "read")) {
                return null;
              }
            } else if (item.name === "Purchase") {
              const purchaseSubMenus = getPurchaseSubMenus(hasPermission);
              if (purchaseSubMenus.length === 0) {
                return null;
              }
            } else if (item.name === "Outward") {
              // Hide Outward if no read permission
              if (!hasPermission("outward", "read")) {
                return null;
              }
            } else if (item.name === "Sales") {
              const salesSubMenus = getSalesSubMenus(hasPermission);
              if (salesSubMenus.length === 0) {
                return null;
              }
            } else if (item.name === "Expense") {
              // Hide Expense if no read permission
              if (!hasPermission("expense_management", "read")) {
                return null;
              }
            } else if (item.name === "Receipt") {
              const receiptSubMenus = getReceiptSubMenus(hasPermission, isTallyEnabled);
              if (receiptSubMenus.length === 0) {
                return null;
              }
            } else if (item.name === "Masters") {
              // Hide Masters if user doesn't have read permission for any master module
              // Check if user has access to at least one master submenu
              const mastersSubMenus = getMastersSubMenus(hasModuleAccess, hasPermission, isTallyEnabled);
              if (mastersSubMenus.length === 0) {
                return null;
              }
            } else if (item.name === "Ledger Management") {
              if (getLedgerManagementSubMenus(hasPermission).length === 0) {
                return null;
              }
            } else if (item.name === "Reports") {
              // Hide Reports if user doesn't have read permission for any report module
              // Check if user has access to at least one report submenu
              const reportSubMenus = getReportSubMenus(hasModuleAccess, hasPermission, isTallyEnabled);
              // Note: Inward and Outward are separate menu items, not under Reports
              // Check if Reports menu should be hidden (only check reportSubMenus)
              if (reportSubMenus.length === 0) {
                return null;
              }
            } else if (item.name === "Import Data") {
              // Import Data is visible to all users - no access module validation
              // Always show Import Data menu
            } else if (item.name === "Route Management") {
              // Hide Route Management if user doesn't have read permission
              if (!hasPermission("route_management", "read")) {
                return null;
              }
            } else if (item.name === "Logistics") {
              if (!hasPermission("logistics_management", "read")) {
                return null;
              }
            } else if (item.name === "Margin Settings") {
              if (getMarginSettingsSubMenus(hasPermission).length === 0) {
                return null;
              }
            } else if (item.name === "Recent Activity") {
              // Recent Activity - show if user has any module access (optional, can be always visible)
              // For now, keeping it visible
            } else if (item.name === "Stock Auditing") {
              if (!hasPermission("stock_audit", "read")) {
                return null;
              }
            } else if (item.name === "Notification Settings") {
              if (userData?.role_id !== 1) {
                return null;
              }
            } else if (item.name === "Banners") {
              // Hide Banners if user doesn't have read permission
              if (!hasPermission("banners", "read")) {
                return null;
              }
            }

            return (
              <div key={index}>
                {item.separator && <div className="border-t border-gray-700 mt-4" />}

                {/* Navigation buttons */}
                {["Reports", "Masters", "Ledger Management", "Route Management", "Logistics", "Margin Settings", "Outward", "Inward", "Purchase", "Sales", "Promotional", "Receipt"].includes(item.name) ? (
                  <button
                    onClick={() => handleNavigation(item.path, item.name)}
                    className={cn(
                      "w-full flex items-center justify-between px-6 py-3 transition-all text-left",
                      "text-gray-300 hover:bg-gray-700 hover:text-white",
                      isActive && "border-r-4 border-white bg-gray-700 text-white"
                    )}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                    {((item.name === "Reports" && isReportsOpen) || 
                      (item.name === "Masters" && isMastersOpen) ||
                      (item.name === "Ledger Management" && isLedgerManagementOpen) || 
                      (item.name === "Route Management" && isRouteManagementOpen) || 
                      (item.name === "Logistics" && isLogisticsOpen) ||
                      (item.name === "Margin Settings" && isMarginSettingsOpen) ||
                      (item.name === "Outward" && isOutwardOpen) ||
                      (item.name === "Inward" && isInwardOpen) ||
                      (item.name === "Purchase" && isPurchaseOpen) || (item.name === "Sales" && isSalesOpen) || (item.name === "Promotional" && isPromotionalOpen) || (item.name === "Receipt" && isReceiptOpen)) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ) : item.name === "Log out" ? (
                  <button
                    onClick={() => handleNavigation(item.path, item.name)}
                    className={cn(
                      "w-full flex items-center justify-between px-6 py-3 transition-all text-left",
                      "text-white hover:bg-gray-700 hover:text-white"
                    )}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                  </button>
                ) : item.name === "Privacy Policy" ? (
                  <button
                    onClick={() => {
                      window.open(item.path, '_blank');
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-6 py-3 transition-all text-left",
                      "text-gray-300 hover:bg-gray-700 hover:text-white",
                      isActive && "border-r-4 border-white bg-gray-700 text-white"
                    )}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                  </button>
                ) : (
                  <Link
                    href={item.path}
                    onClick={onClose}
                    className={cn(
                      "w-full flex items-center justify-between px-6 py-3 transition-all text-left block",
                      "text-gray-300 hover:bg-gray-700 hover:text-white",
                      isActive && "border-r-4 border-white bg-gray-700 text-white"
                    )}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      <span>{item.name === "Stock Transfer" ? "Godown Transfer" : item.name}</span>
                    </div>
                  </Link>
                )}

                {/* Reports Submenu */}
                {item.name === "Reports" && isReportsOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getReportSubMenus(hasModuleAccess, hasPermission, isTallyEnabled).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      // Match exact path or if location includes the report page name
                      const isSubActive = location === subItem.path || location.includes(subItem.path);
                      
                      // Special handling for Stock Journal to set sidebar navigation flag
                      if (subItem.name === "Stock Journals") {
                        return (
                          <button
                            key={subIndex}
                            onClick={() => {
                              localStorage.setItem("fromSidebarNavigation", "true");
                              // Force navigation even if already on the same page
                              if (location === subItem.path) {
                                // If already on the same page, trigger a custom event
                                window.dispatchEvent(new CustomEvent('stockJournalSidebarNavigation'));
                              } else {
                                setLocation(subItem.path);
                              }
                              onClose();
                            }}
                            className={cn(
                              "w-full flex items-center px-6 py-2 text-left transition-all",
                              "text-gray-300 hover:bg-gray-700 hover:text-white",
                              isSubActive &&
                                "bg-gray-700 text-white border-r-4 border-gray-300"
                            )}
                          >
                            <SubIcon className="mr-3 h-4 w-4" />
                            <span className="text-sm">{subItem.name}</span>
                          </button>
                        );
                      }
                      
                      if (subItem.path === "/reports/production-report") {
                        return (
                          <div key={subIndex}>
                            <button
                              type="button"
                              onClick={() => handleNavigation(subItem.path, "Production")}
                              className={cn(
                                "w-full flex items-center justify-between px-6 py-2 text-left transition-all",
                                "text-gray-300 hover:bg-gray-700 hover:text-white",
                                isSubActive &&
                                  "bg-gray-700 text-white border-r-4 border-gray-300"
                              )}
                            >
                              <div className="flex items-center">
                                <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" />
                                <span className="text-sm">{subItem.name}</span>
                              </div>
                              {isProductionVoucherTypesOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>

                            {isProductionVoucherTypesOpen && (
                              <div className="bg-gray-900/40 border-l-4 border-gray-700 ml-0">
                                {productionVoucherTypeOptions.map((vt) => {
                                  const isVtActive =
                                    location.startsWith("/reports/production-report") &&
                                    typeof window !== "undefined" &&
                                    new URLSearchParams(window.location.search).get("voucher_type_id") === vt.id;
                                  return (
                                    <button
                                      key={vt.id}
                                      type="button"
                                      onClick={() => {
                                        setLocation(`/reports/production-report?voucher_type_id=${vt.id}`);
                                        onClose();
                                      }}
                                      className={cn(
                                        "w-full flex items-center px-10 py-2 text-left transition-all",
                                        "text-gray-300 hover:bg-gray-700 hover:text-white",
                                        isVtActive &&
                                          "bg-gray-700 text-white border-r-4 border-gray-300"
                                      )}
                                    >
                                      <span className="text-sm truncate">{vt.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive &&
                              "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Outward Submenu */}
                {item.name === "Outward" && isOutwardOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getOutwardSubMenus(hasModuleAccess, hasPermission, isTallyEnabled).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      // More specific matching to avoid highlighting multiple items
                      let isSubActive = false;
                      if (subItem.path.includes("delivery-notes")) {
                        // Delivery Note: match exact path or delivery-notes in location
                        isSubActive = location === subItem.path || location.includes("delivery-notes");
                      } else if (subItem.path.includes("invoices")) {
                        // Invoice: match exact path or invoices in location
                        isSubActive = location === subItem.path || location.includes("invoices");
                      } else if (subItem.path.includes("outward-list")) {
                        // Gate Pass Report: match exact path or outward-list or add-outward in location, but not delivery-notes or invoices
                        isSubActive = (location === subItem.path || location.includes("outward-list") || location.includes("add-outward")) && !location.includes("delivery-notes") && !location.includes("invoices");
                      } else {
                        // Fallback to exact match
                        isSubActive = location === subItem.path || location.includes(subItem.path);
                      }
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive &&
                              "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                
                {/* Sales Submenu */}
                {item.name === "Inward" && isInwardOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-0">
                    {getInwardSubMenus().map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive =
                        location === subItem.path ||
                        (subItem.path === "/reports/inward-list" && location.includes("inward-list")) ||
                        (subItem.path === "/reports/purchase-invoices" && location.includes("purchase-invoices"));
                      return (
                        <Link
                          key={subItem.path}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive && "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {item.name === "Sales" && isSalesOpen && (
                  <div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getSalesSubMenus(hasPermission).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location === subItem.path || location.includes(subItem.path) ||
                        (subItem.name === "Sales Orders" && location.includes("create-sales-order")) ||
                        (subItem.name === "SO Quotation" && location.includes("create-so-quotation")) ||
                        (subItem.name === "Sales Return" && (location.includes("sales-return-reports") || location.includes("add-sales-return")));
                      return (
                        <button
                          key={subIndex}
                          type="button"
                          onClick={() => { handleNavigation(subItem.path, subItem.name); onClose(); }}
                          className={cn(
                            "w-full flex items-center px-6 py-2.5 text-sm font-medium transition-colors duration-200",
                            isSubActive ? "bg-gray-700 text-white border-r-4 border-blue-500" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{subItem.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {item.name === "Promotional" && isPromotionalOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {promotionalSubMenus.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive =
                        location === subItem.path ||
                        location.startsWith(`${subItem.path}/`);
                      return (
                        <button
                          key={subItem.path}
                          type="button"
                          onClick={() => { handleNavigation(subItem.path, subItem.name); onClose(); }}
                          className={cn(
                            "w-full flex items-center px-6 py-2.5 text-sm font-medium transition-colors duration-200",
                            isSubActive ? "bg-gray-700 text-white border-r-4 border-blue-500" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{subItem.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                
                {/* Purchase Submenu */}
                {item.name === "Purchase" && isPurchaseOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getPurchaseSubMenus(hasPermission).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location === subItem.path || location.includes(subItem.path) ||
                        (subItem.name === "Purchase Orders" && location.includes("add-purchase-order")) ||
                        (subItem.name === "Purchase Return" && location.includes("add-purchase-return"));
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive && "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Receipt Submenu */}
                {item.name === "Receipt" && isReceiptOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getReceiptSubMenus(hasPermission, isTallyEnabled).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      const isSubActive =
                        location === subItem.path ||
                        location.includes(subItem.path) ||
                        (subItem.path === "/receipt-list" &&
                          (location.includes("/add-receipt") ||
                            location.includes("/update-receipt") ||
                            location.includes("/edit-receipt")));
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive && "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {item.name === "Ledger Management" && isLedgerManagementOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getLedgerManagementSubMenus(hasPermission).map((subItem) => {
                      const SubIcon = subItem.icon || BookOpen;
                      const isSubActive = isLedgerSubMenuActive(location, subItem.path);
                      return (
                        <Link
                          key={subItem.path}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive && "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Masters Submenu */}
                {item.name === "Masters" && isMastersOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getMastersSubMenus(hasModuleAccess, hasPermission, isTallyEnabled).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      // Match exact path or if location includes the master page name
                      // For Base Price Master (item-listing), check for item-listing in location
                      let isSubActive = false;
                      if (subItem.path.includes("item-listing")) {
                        isSubActive = location === subItem.path || location.includes("item-listing");
                      } else {
                        isSubActive = location === subItem.path || location.includes(subItem.path);
                      }
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive &&
                              "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Route Management Submenu */}
                {item.name === "Route Management" && isRouteManagementOpen && hasPermission("route_management", "read") && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {routeManagementSubMenus.map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location === subItem.path;
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive &&
                              "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Logistics Submenu */}
                {item.name === "Logistics" && isLogisticsOpen && hasPermission("logistics_management", "read") && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {logisticsSubMenus.map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location === subItem.path;
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive &&
                              "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Margin Settings Submenu */}
                {item.name === "Margin Settings" && isMarginSettingsOpen && (
                  <div className="bg-gray-800 border-l-4 border-gray-600 ml-6">
                    {getMarginSettingsSubMenus(hasPermission).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      const isSubActive =
                        location === subItem.path ||
                        (subItem.path !== "/" && location.includes(subItem.path));
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.path}
                          onClick={onClose}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive &&
                              "bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                        >
                          <SubIcon className="mr-3 h-4 w-4" />
                          <span className="text-sm">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </nav>
        
        {/* Footer */}
        <div className="border-t border-gray-700 p-4 flex-shrink-0">
          <div className="text-center">
            <div className="text-xs text-gray-400">
              <span>© 2026 All rights reserved</span>
              <span className="mx-1">•</span>
              <a 
                href="https://www.wbtechindia.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-gray-300 hover:text-white transition-colors duration-200"
              >
                MWB Technologies India Pvt Ltd
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
