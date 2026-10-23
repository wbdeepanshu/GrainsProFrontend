import { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Link as RouteLink, useLocation } from "wouter";
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
  ChevronDown,
  ChevronRight,
  FileText,
  Activity,
  Clock,
  TrendingUp,
  Warehouse,
  Package,
  Link,
  Link2,
  Folder, // 👈 Added for Masters menu
  ShoppingCart, // 👈 Added for Sales Order Reports
  Route, // 👈 Added for Route Management
  UserPlus, // 👈 Added for Route Assignment
  IndianRupee, // 👈 Added for Indian Rupee
  Receipt,
  Percent, // 👈 Added for Margin Settings
  Building2, // 👈 Added for Business Types
  CreditCard, // 👈 Added for Credit Types
  MapPin, // 👈 Added for Geographic
  Settings2, // 👈 Added for Price Rules
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
  Truck, // 👈 For Hamali Type Masters
  Tag, // 👈 For Base Price Master
  DollarSign as PriceTag, // 👈 For Stock Item Pricing
  Map, // 👈 For States
  MapPin as DistrictPin, // 👈 For Districts
  Navigation, // 👈 For Cities
  Cog, // 👈 For Machine Params
  Sliders, // 👈 For Price Rules
  Image, // 👈 For Banners
  UserSearch, // 👈 For Customer Analysis
  Wallet, // 👈 For Outstanding Reports
  Percent as BrokerageIcon, // 👈 For Brokerage Configuration
  Video, // 👈 Help Videos
  GitCompare, // Process stock flow report
  Bell,
  HardHat, // Labour Management
  ArrowRightLeft, // Stock Transfer
  Layers, // Analyzer Report (stock group analysis)
  Megaphone, // Promotional
  Send, // Promotional Activity
  LayoutTemplate, // Promotional Templates
  Target, // Sales Target
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const iconMap = {
  gauge: Gauge,
  users: Users,
  warehouse: Warehouse,
  package: Package,
  link: Link,
  upload: Upload,
  plus: Plus,
  settings: Settings,
  "bar-chart-3": BarChart3,
  "user-pen": UserPen,
  "shield-check": ShieldCheck,
  "log-out": LogOut,
  folder: Folder, // 👈 added for Masters
  route: Route, // 👈 added for Route Management
  "user-plus": UserPlus, // 👈 added for Route Assignment
 // receipt: Receipt, // 👈 added for Expense
  "shopping-cart": ShoppingCart, // 👈 added for Sales Order Reports
  "indian-rupee": IndianRupee, // 👈 added for Indian Rupee
  "receipt": Receipt, // 👈 added for Expense Reports
  "percent": Percent, // 👈 added for Margin Settings
  "activity": History, // 👈 changed to History for Recent Activity
  "building-2": Building2, // 👈 added for Business Types
  "credit-card": CreditCard, // 👈 added for Credit Types
  "map-pin": MapPin, // 👈 added for Geographic
  "settings-2": Settings2, // 👈 added for Price Rules
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
    { name: "Purchase Orders", icon: ShoppingBag, path: "/reports/po-reports", module: "purchase_order" },
    { name: "PO Deviation Report", icon: FileText, path: "/reports/po-deviation-report", module: "purchase_order" },
    { name: "Lab Test ", icon: TestTube, path: "/reports/lab-test-report", module: "inward" },
    { name: "Unloading ", icon: ClipboardList, path: "/reports/unloading-report", module: "inward" },
    { name: "APMC Permit Report", icon: FileText, path: "/reports/apmc-permit-report", module: "inward" },
    { name: "Loading ", icon: ClipboardList, path: "/reports/loading-report", module: "sales_order" },
    { name: "Production ", icon: GitCompare, path: "/reports/production-report", module: "process_report" },
    { name: "Process ", icon: GitCompare, path: "/reports/process-stock-flow", module: "process_report" },
    { name: "Machine ", icon: Cpu, path: "/reports/machine-reports", module: "machine_reports" },
    { name: "Hamali ", icon: TrendingUp, path: "/reports/hamali", module: "hamali" },
    { name: "Brokerage ", icon: BrokerageIcon, path: "/reports/brokerage-reports", module: "brokerage" },
    { name: "Route Activity Report", icon: Route, path: "/reports/route-activity-report", module: "route_management" },
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
    if (
      menu.module === "customer_analysis" ||
      menu.module === "salesman_analysis" ||
      menu.module === "item_analysis" ||
      menu.module === "stock_group_analysis"
    ) {
      // Analysis reports - need read access for analysis_reports module
      return hasPermission("analysis_reports", "read");
    }
    if (menu.module === "voucher_analysis") {
      // Voucher Analysis - needs read access for stock_journals module
      const hasAccess = hasPermission("stock_journals", "read");
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

// 👇 Route Management Submenus
const routeManagementSubMenus = [
  { name: "Activity name", icon: ClipboardList, path: "/route-activities" },
  { name: "Create Route", icon: Route, path: "/route-management" },
  { name: "Assign Route", icon: UserPlus, path: "/route-assignment" },
  { name: "Route Activity", icon: Activity, path: "/route-activity" },
  { name: "Live Tracking", icon: Navigation, path: "/live-tracking" },
];

const logisticsSubMenus = [
  { name: "Providers", icon: Building2, path: "/logistics/providers" },
  { name: "Drivers", icon: UserRound, path: "/logistics/drivers" },
  { name: "Vehicles", icon: Truck, path: "/logistics/vehicles" },
  { name: "Serviceable Routes", icon: MapPin, path: "/logistics/serviceable-routes" },
];

// 👇 Expense Submenus
const expenseSubMenus = [
  // { name: "Add Expense", icon: Plus, path: "/add-expense" },
  { name: "Expense List", icon: IndianRupee, path: "/reports/expense-list" },
];

// 👇 Sales Order Reports Submenus
const salesOrderReportsSubMenus = [
  { name: "Sales Order List", icon: ShoppingCart, path: "/reports/sales-order-list" },
  { name: "SO Dispatch Report", icon: ShoppingCart, path: "/reports/sales-order-dispatch-report" },
  //{ name: "Add Sales Order", icon: Plus, path: "/add-sales-order" },
];

// 👇 Margin Settings Submenus (Brokerage Configuration added when user has brokerage read permission)
const marginSettingsSubMenus = [
  { name: "Business Types", icon: Building2, path: "/margin-settings/business-types" },
  { name: "Credit Types", icon: CreditCard, path: "/margin-settings/credit-types" },
  { name: "Branch Settings", icon: Building2, path: "/margin-settings/branch-settings" },
  { name: "States", icon: Map, path: "/margin-settings/states" },
  { name: "Districts", icon: DistrictPin, path: "/margin-settings/districts" },
  { name: "Cities", icon: Navigation, path: "/margin-settings/cities" },
  { name: "Price Rules", icon: Sliders, path: "/margin-settings/price-rules" },
  { name: "Stock Item Pricing", icon: PriceTag, path: "/margin-settings/stock-item-pricing" },
];


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
  if (hasPermission("ledgers_account", "read")) {
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
    { name: "Additional Ledgers", icon: Layers, path: "/additional-ledgers", module: "ledger_masters" },
    { name: "Ledgers Credit Settings", icon: CreditCard, path: "/ledger-credit-settings", module: "ledger_masters" },
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
  location.includes("/additional-ledgers") ||
  location.includes("/ledger-credit-settings") ||
  location.includes("/area-listing") ||
  location.includes("/kyc-document-type-masters");

const isLedgerSubMenuActive = (location, path) => {
  if (!path) return false;
  return location === path || location.startsWith(`${path}/`);
};

const SIDEBAR_COLLAPSED_KEY = "grainspro-sidebar-collapsed";
const SIDEBAR_OPEN_KEY = "grainspro-sidebar-open-sections";
const SIDEBAR_SCROLL_KEY = "grainspro-sidebar-scroll";

function readOpenSections() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SIDEBAR_OPEN_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}
const SIDEBAR_DROPDOWNS = [
  "Reports",
  "Masters",
  "Ledger Management",
  "Route Management",
  "Logistics",
  "Margin Settings",
  "Outward",
  "Inward",
  "Purchase",
  "Sales",
  "Promotional",
  "Receipt",
];

export const SidebarShellContext = createContext(false);

export default function Sidebar({ owner }) {
  const shellActive = useContext(SidebarShellContext);
  if (shellActive && owner !== "shell") return null;
  return <SidebarBody />;
}

function SidebarBody() {
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [collapsedFlyout, setCollapsedFlyout] = useState(null);
  const [isReportsOpen, setIsReportsOpen] = useState(() => readOpenSections().has("Reports"));
  const [isMastersOpen, setIsMastersOpen] = useState(() => readOpenSections().has("Masters"));
  const [isLedgerManagementOpen, setIsLedgerManagementOpen] = useState(() => readOpenSections().has("Ledger Management"));
  const [isRouteManagementOpen, setIsRouteManagementOpen] = useState(() => readOpenSections().has("Route Management"));
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(() => readOpenSections().has("Logistics"));
  const [isMarginSettingsOpen, setIsMarginSettingsOpen] = useState(() => readOpenSections().has("Margin Settings"));
  const [isOutwardOpen, setIsOutwardOpen] = useState(() => readOpenSections().has("Outward"));
  const [isInwardOpen, setIsInwardOpen] = useState(() => readOpenSections().has("Inward"));
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(() => readOpenSections().has("Purchase"));
  const [isSalesOpen, setIsSalesOpen] = useState(() => readOpenSections().has("Sales"));
  const [isPromotionalOpen, setIsPromotionalOpen] = useState(() =>
    readOpenSections().has("Promotional") ||
    location.includes("promotional-activity") ||
    location.includes("promotional-templates") ||
    location.startsWith("/promotional/")
  );
  const [isReceiptOpen, setIsReceiptOpen] = useState(() => readOpenSections().has("Receipt"));
  const [isProductionVoucherTypesOpen, setIsProductionVoucherTypesOpen] = useState(() =>
    readOpenSections().has("Production Voucher Types")
  );
  const navRef = useRef(null); // 👈 ref for the nav element
  
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
  
  // Check if user is superadmin
  const isSuperAdmin = () => {
    const superadminToken = localStorage.getItem("superadmin_token");
    const superadminUser = localStorage.getItem("superadmin_user");
    if (superadminToken && superadminUser) {
      try {
        const userData = JSON.parse(superadminUser);
        return userData.role_id === 10;
      } catch {
        return false;
      }
    }
    return false;
  };

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
    if (location.includes("sales-order-list") || location.includes("create-sales-order") ||
        location.includes("sales-register") ||
        location.includes("so-quotations") ||
        location.includes("create-so-quotation") ||
        location.includes("sales-return-reports") || location.includes("add-sales-return") ||
        location.includes("sales-targets")) {
      setIsSalesOpen(true);
    }
  }, [location]);

  // Keep Promotional submenu open while on its pages
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
        location.includes("/voucher-settings") || location.includes("/margin-settings/brokerage-configuration")) {
      setIsMastersOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (isLedgerManagementPath(location)) {
      setIsLedgerManagementOpen(true);
    }
  }, [location]);

  // Auto-open Reports dropdown when on any report page
  useEffect(() => {
    if (location.includes("receipt-list") || location.includes("/add-receipt") ||
        location.includes("/update-receipt") || location.includes("/edit-receipt") ||
        location.includes("outstanding-reports")) {
      setIsReceiptOpen(true);
    }
  }, [location]);

  useEffect(() => {
    if (location.includes("stock-journal") || location.includes("machine-reports") || 
        location.includes("/reports/hamali") || location.includes("customer-analysis") ||
        location.includes("stock-group-analysis") || location.includes("item-analysis") ||
        location.includes("salesman-analysis") || location.includes("voucher-analysis") ||
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
    queryKey: ["voucher-types-production-sidebar"],
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

  // Auto-open Margin Settings dropdown when on any margin-settings page
  useEffect(() => {
    if (location.includes("margin-settings")) {
      setIsMarginSettingsOpen(true);
    }
  }, [location]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Sidebar still collapses for this page if storage is blocked.
    }
  }, [collapsed]);

  useEffect(() => {
    const open = [];
    if (isReportsOpen) open.push("Reports");
    if (isMastersOpen) open.push("Masters");
    if (isLedgerManagementOpen) open.push("Ledger Management");
    if (isRouteManagementOpen) open.push("Route Management");
    if (isLogisticsOpen) open.push("Logistics");
    if (isMarginSettingsOpen) open.push("Margin Settings");
    if (isOutwardOpen) open.push("Outward");
    if (isInwardOpen) open.push("Inward");
    if (isPurchaseOpen) open.push("Purchase");
    if (isSalesOpen) open.push("Sales");
    if (isPromotionalOpen) open.push("Promotional");
    if (isReceiptOpen) open.push("Receipt");
    if (isProductionVoucherTypesOpen) open.push("Production Voucher Types");
    try {
      sessionStorage.setItem(SIDEBAR_OPEN_KEY, JSON.stringify(open));
    } catch {
      // Open menus still work for this visit if storage is blocked.
    }
  }, [
    isReportsOpen,
    isMastersOpen,
    isLedgerManagementOpen,
    isRouteManagementOpen,
    isLogisticsOpen,
    isMarginSettingsOpen,
    isOutwardOpen,
    isInwardOpen,
    isPurchaseOpen,
    isSalesOpen,
    isPromotionalOpen,
    isReceiptOpen,
    isProductionVoucherTypesOpen,
  ]);

  const scrollRestored = useRef(false);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || permissionsLoading) return;
    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
    } catch {
      saved = 0;
    }
    if (!Number.isFinite(saved) || saved <= 0) {
      scrollRestored.current = true;
      return;
    }
    const maxScroll = nav.scrollHeight - nav.clientHeight;
    if (maxScroll + 1 < saved) return;
    nav.scrollTop = saved;
    scrollRestored.current = true;
  }, [permissionsLoading, collapsed, productionVoucherTypeOptions.length]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const saveScroll = () => {
      if (!scrollRestored.current) return;
      try {
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop));
      } catch {
        // Scroll still works for this visit if storage is blocked.
      }
    };
    nav.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveScroll);
    return () => {
      nav.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
    };
  }, []);

  useEffect(() => {
    setCollapsedFlyout(null);
  }, [location]);

  useEffect(() => {
    if (!collapsedFlyout || !navRef.current) return undefined;
    const nav = navRef.current;
    const placeFlyout = () => {
      const menu = nav.querySelector(".sidebar-submenu");
      const icon = nav.querySelector(`[data-sidebar-dropdown="${collapsedFlyout}"]`);
      if (!menu || !icon) return;
      const iconTop = icon.getBoundingClientRect().top;
      const height = menu.offsetHeight;
      let top = iconTop;
      if (top + height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - height - 8);
      }
      menu.style.top = `${top}px`;
    };
    const frame = requestAnimationFrame(placeFlyout);
    const closeFlyout = (event) => {
      const target = event.target;
      if (target?.closest?.("[data-sidebar-dropdown], .sidebar-submenu")) return;
      setCollapsedFlyout(null);
    };
    const closeOnScroll = () => setCollapsedFlyout(null);
    document.addEventListener("mousedown", closeFlyout);
    nav.addEventListener("scroll", closeOnScroll);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", closeFlyout);
      nav.removeEventListener("scroll", closeOnScroll);
    };
  }, [collapsedFlyout]);

  const showSection = (name, open) => (collapsed ? collapsedFlyout === name : open);

  const openCollapsedSection = (name, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const top = Math.max(8, rect.top);
    event.currentTarget.parentElement?.style.setProperty("--flyout-top", `${top}px`);
    setCollapsedFlyout((current) => (current === name ? null : name));
  };

  const handleNavigation = async (path, name) => {
    if (name === "Log out") {
      try {
        await AuthService.logout();
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        setLocation("/login");
      } catch (error) {
        console.error("Logout error:", error);
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        setLocation("/login");
      }
    } else if (name === "Reports") {
      setIsReportsOpen(!isReportsOpen);
    } else if (name === "Masters") { // 👈 toggle masters submenu
      setIsMastersOpen(!isMastersOpen);
    } else if (name === "Ledger Management") {
      setIsLedgerManagementOpen(!isLedgerManagementOpen);
    } else if (name === "Route Management") { // 👈 toggle route management submenu
      setIsRouteManagementOpen(!isRouteManagementOpen);
    } else if (name === "Logistics") {
      setIsLogisticsOpen(!isLogisticsOpen);
    } else if (name === "Margin Settings") { // 👈 toggle margin settings submenu
      setIsMarginSettingsOpen(!isMarginSettingsOpen);
    } else if (name === "Outward") { // 👈 toggle outward submenu
      setIsOutwardOpen((prev) => {
        const onPage = location.includes("outward-list") || location.includes("add-outward") ||
          location.includes("delivery-notes") || location.includes("invoices") || location.includes("outward-details");
        return onPage ? true : !prev;
      });
    } else if (name === "Inward") {
      setIsInwardOpen((prev) => {
        const onPage = location.includes("inward-list") || location.includes("purchase-invoices") ||
          location.includes("add-inward") || location.includes("inward-details");
        return onPage ? true : !prev;
      });
    } else if (name === "Purchase") {
      setIsPurchaseOpen((prev) => {
        const onPage = location.includes("purchaseorders-reports") || location.includes("purchase-register") || location.includes("add-purchase-order") ||
          location.includes("purchase-return-reports") || location.includes("add-purchase-return");
        return onPage ? true : !prev;
      });
    } else if (name === "Sales") {
      setIsSalesOpen((prev) => {
        const onPage = location.includes("sales-order-list") || location.includes("create-sales-order") ||
          location.includes("sales-register") || location.includes("so-quotations") ||
          location.includes("create-so-quotation") || location.includes("sales-return-reports") || location.includes("add-sales-return") ||
          location.includes("sales-targets");
        return onPage ? true : !prev;
      });
    } else if (name === "Promotional") {
      setIsPromotionalOpen((prev) => {
        const onPage =
          location.includes("promotional-activity") ||
          location.includes("promotional-templates") ||
          location.startsWith("/promotional/");
        // Same as Sales/Outward: stay open on page, otherwise toggle
        return onPage ? true : !prev;
      });
    } else if (name === "Receipt") {
      setIsReceiptOpen((prev) => {
        const onPage = location.includes("receipt-list") || location.includes("/add-receipt") ||
          location.includes("/update-receipt") || location.includes("/edit-receipt") ||
          location.includes("outstanding-reports");
        return onPage ? true : !prev;
      });
    } else if (name === "Production") {
      setIsProductionVoucherTypesOpen(!isProductionVoucherTypesOpen);
    } else if (name === "Stock Journals") {
      // Set flag for sidebar navigation to reset dates and filters
      localStorage.setItem("fromSidebarNavigation", "true");
      setLocation(path);
    } else {
      setLocation(path);
    }
  };

  return (
    <div className={cn(
      "sidebar-gradient text-white flex-shrink-0 h-screen flex flex-col transition-[width] duration-200 ease-in-out",
      collapsed
        ? "w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] basis-[4.5rem] sidebar-collapsed overflow-hidden"
        : "w-[16.5rem] min-w-[16.5rem] max-w-[16.5rem] basis-[16.5rem] overflow-x-hidden"
    )}
    style={collapsed
      ? { width: "4.5rem", minWidth: "4.5rem", maxWidth: "4.5rem", flex: "0 0 4.5rem" }
      : { width: "16.5rem", minWidth: "16.5rem", maxWidth: "16.5rem", flex: "0 0 16.5rem" }
    }>
      <div className={cn("border-b border-gray-700 flex-shrink-0", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        <div className={cn("flex", collapsed ? "flex-col items-center gap-2" : "items-center justify-between")}>
          <div className={cn("flex items-center", collapsed ? "" : "gap-3 min-w-0")}>
            <div className={cn("bg-white rounded-full flex-shrink-0 overflow-hidden", collapsed && "h-10 w-10")}>
              <img src={logo} alt="GrainsPro ERP Logo" className={cn("object-contain", collapsed ? "h-10 w-10" : "h-11 w-auto")} />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <h1 className="text-base font-bold text-white leading-none whitespace-nowrap">GrainsPro ERP</h1>
                <p className="text-gray-300 text-[10px] leading-none mt-1 whitespace-nowrap">Enterprise Resource Planning</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setCollapsedFlyout(null);
              setCollapsed((open) => !open);
            }}
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            title={collapsed ? "Show sidebar" : "Hide sidebar"}
            className="p-1.5 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
      </div>
      
      <nav
        ref={navRef}
        className="flex-1 min-h-0 overflow-y-auto hide-scrollbar mt-2"
        style={{ overflowAnchor: "none" }}
      >

        
        {sidebarMenuItems.map((item, index) => {
          const Icon = iconMap[item.icon];
          const isActive =
            location === item.path || 
            (item.name === "Dashboard" && location === "/dashboard") || 
            (item.name === "Import Data" && location === "/import") ||
            (item.name === "User List" && (location === "/users" || location.includes("/add-user") || location.includes("/update-user") || location.includes("/edit-user"))) ||
            (item.name === "Help Videos" && location === "/help-videos") ||
            (item.name === "Privacy" && location === "/privacy")||      
            (item.name === "Admin Settings" && location === "/admin-settings") ||
            (item.name === "Contact Us" && location === "/contact-us")||      
            
            (item.name === "Purchase" && (location.includes("purchaseorders-reports") || location.includes("purchase-register") || location.includes("add-purchase-order") || location.includes("purchase-return-reports") || location.includes("add-purchase-return"))) ||
            (item.name === "Reports" && location.startsWith("/reports") && !location.includes("inward-list") && !location.includes("purchaseorders-reports") && !location.includes("sales-order-list") && !location.includes("sales-register") && !location.includes("sales-return-reports") && !location.includes("expense-list") && !location.includes("customer-analysis") && !location.includes("outstanding-reports")) ||
            (item.name === "Masters" && (["/branches","/godown-masters","/stock-masters","/broker-masters","/item-masters","/all-item-mapping","/gst-masters","/lab-test-params","/machine-params","/voucher-settings","/margin-settings/brokerage-configuration","/labour-management"].includes(location) || location.includes("/labour-management"))) ||
            (item.name === "Ledger Management" && isLedgerManagementPath(location)) ||
            (item.name === "Route Management" && (location.startsWith("/route-management") || location.startsWith("/route-assignment") || location.startsWith("/route-activity") || location.startsWith("/route-activities"))) ||
            (item.name === "Logistics" && (location.includes("/logistics/") || location.includes("/logistics-management"))) ||
            (item.name === "Margin Settings" && location.startsWith("/margin-settings") && location !== "/margin-settings/brokerage-configuration") ||
            (item.name === "Recent Activity" && location === "/recent-activity") ||
            (item.name === "Stock Auditing" && location === "/stock-auditing") ||
            (item.name === "Notification Settings" && location === "/notification-settings") ||
            (item.name === "Banners" && location === "/banners") ||
            (item.name === "Inward" && (location.includes("inward-list") || location.includes("purchase-invoices") || location.includes("add-inward") || location.includes("inward-details"))) ||
            (item.name === "Item Testing" && (location.includes("/item-testing"))) ||
            (item.name === "Weighbridge" && location.includes("/vehicle-info")) ||
            ((item.name === "Stock Transfer" || item.name === "Godown Transfer") &&
              location.includes("/stock-transfer")) ||
            (item.name === "Outward" && (location.startsWith("/outward") || location.includes("outward-details"))) ||
            (item.name === "Sales" && (location.includes("sales-order-list") || location.includes("sales-register") || location.includes("so-quotations") || location.includes("create-so-quotation") || location.includes("create-sales-order") || location.includes("sales-return-reports") || location.includes("add-sales-return") || location.includes("sales-targets"))) ||
            (item.name === "Promotional" && (
              location === "/promotional-activity" ||
              location === "/promotional-templates" ||
              location.startsWith("/promotional/")
            )) ||
            (item.name === "Expense" && (location.includes("expense-list") || location.includes("/add-expense") || location.includes("/update-expense") || location.includes("/edit-expense"))) ||
            (item.name === "Receipt" && (location.includes("receipt-list") || location.includes("/add-receipt") || location.includes("/update-receipt") || location.includes("/edit-receipt") || location.includes("outstanding-reports")));
          // Check if this is a dropdown item
          const isDropdownItem = SIDEBAR_DROPDOWNS.includes(item.name);
          const itemLabel = item.name === "Stock Transfer" ? "Godown Transfer" : item.name;
          
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
            // Filter expense submenus based on permissions
            const filteredExpenseSubMenus = expenseSubMenus.filter(subMenu => {
              return hasPermission("expense", "read");
            });
            // Removed salesOrderReportsSubMenus check as it's already in Outward section
            // Hide Reports menu if all submenus are empty
            if (reportSubMenus.length === 0 && filteredExpenseSubMenus.length === 0) {
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
            if (!hasPermission("margin_settings", "read")) {
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
            // Notification Settings should be visible only for role 1
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
            <div key={index} data-sidebar-section={isDropdownItem ? item.name : undefined}>
              {item.separator && <div className="border-t border-gray-700 mt-4" />}
              {isDropdownItem ? (
                // Hide Margin Settings dropdown button when user only has brokerage (no margin_settings); Brokerage link shows below
                (item.name === "Margin Settings" && !hasPermission("margin_settings", "read")) ? null : (
                <>
                <button
                  type="button"
                  data-sidebar-dropdown={item.name}
                  data-sidebar-item-active={isActive ? "true" : undefined}
                  title={itemLabel}
                  onClick={(event) => {
                    if (collapsed) {
                      openCollapsedSection(item.name, event);
                      return;
                    }
                    handleNavigation(item.path, item.name);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-3 transition-all text-left",
                    item.name === "Log out" ? "text-white hover:bg-gray-700 hover:text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white",
                    isActive && "border-r-4 border-white bg-gray-700 text-white"
                  )}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-5 w-5" />
                    <span>
                      {item.name === "Stock Transfer" ? "Godown Transfer" : item.name}
                    </span>
                  </div>
                  <div className="ml-2">
                    {(item.name === "Reports" && isReportsOpen) || (item.name === "Masters" && isMastersOpen) || (item.name === "Ledger Management" && isLedgerManagementOpen) || (item.name === "Route Management" && isRouteManagementOpen) || (item.name === "Logistics" && isLogisticsOpen) || (item.name === "Margin Settings" && isMarginSettingsOpen) || (item.name === "Outward" && isOutwardOpen) || (item.name === "Inward" && isInwardOpen) || (item.name === "Purchase" && isPurchaseOpen) || (item.name === "Sales" && isSalesOpen) || (item.name === "Promotional" && isPromotionalOpen) || (item.name === "Receipt" && isReceiptOpen) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {item.name === "Sales" && showSection("Sales", isSalesOpen) && (
                  <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                    {getSalesSubMenus(hasPermission).map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location === subItem.path || location.includes(subItem.path) ||
                        (subItem.name === "Sales Orders" && location.includes("create-sales-order")) ||
                        (subItem.name === "SO Quotation" && location.includes("create-so-quotation")) ||
                        (subItem.name === "Sales Return" && (location.includes("sales-return-reports") || location.includes("add-sales-return")));
                      return (
                        <RouteLink
                          key={subIndex}
                          href={subItem.path}
                          data-sidebar-sub-active={isSubActive ? "true" : undefined}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                          style={{ display: "flex", alignItems: "center" }}
                        >
                          <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: "inline-block" }} />
                          <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                        </RouteLink>
                      );
                    })}
                  </div>
                )}
                </>
                )
              ) : (
                <RouteLink
                  href={item.path}
                  data-sidebar-item-active={isActive ? "true" : undefined}
                  title={itemLabel}
                  onClick={(e) => {
                    if (item.name === "Log out") {
                      e.preventDefault();
                      handleNavigation(item.path, item.name);
                    } else {
                      // Let the browser handle the navigation for regular links
                      // This enables right-click "Open in new tab" functionality
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-3 transition-all text-left block",
                    item.name === "Log out" ? "text-white hover:bg-gray-700 hover:text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white",
                    isActive && "border-r-4 border-white bg-gray-700 text-white"
                  )}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-5 w-5" />
                    <span>
                      {item.name === "Stock Transfer" ? "Godown Transfer" : item.name}
                    </span>
                  </div>
                </RouteLink>
              )}

              {item.name === "Inward" && showSection("Inward", isInwardOpen) && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                  {getInwardSubMenus().map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive =
                      location === subItem.path ||
                      (subItem.path === "/reports/inward-list" &&
                        (location.includes("inward-list") ||
                          location.includes("add-inward") ||
                          location.includes("inward-details"))) ||
                      (subItem.path === "/reports/purchase-invoices" &&
                        location.includes("purchase-invoices"));
                    return (
                      <RouteLink
                        key={subItem.path}
                        href={subItem.path}
                        data-sidebar-sub-active={isSubActive ? "true" : undefined}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: "inline-block" }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

              {/* Reports Submenu */}
              {item.name === "Reports" && showSection("Reports", isReportsOpen) && (() => {
                const reportSubMenus = getReportSubMenus(hasModuleAccess, hasPermission, isTallyEnabled);
                const filteredExpenseSubMenus = expenseSubMenus.filter(subMenu => {
                  return hasPermission("expense", "read");
                });
                // Removed salesOrderReportsSubMenus as it's already in Outward section
                const allReportSubMenus = [...reportSubMenus, ...filteredExpenseSubMenus];
                
                if (allReportSubMenus.length === 0) {
                  return null;
                }
                
                return (
                  <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                    {allReportSubMenus.map((subItem, subIndex) => {
                      const SubIcon = subItem.icon;
                    // Match exact path or if location includes the report page name
                    const isSubActive = location === subItem.path || location.includes(subItem.path);

                    if (subItem.path === "/reports/production-report") {
                      return (
                        <div key={subIndex}>
                          <button
                            type="button"
                            data-sidebar-sub-active={isSubActive ? "true" : undefined}
                            onClick={() => handleNavigation(subItem.path, "Production")}
                            className={cn(
                              "w-full flex items-center justify-between px-6 py-2 text-left transition-all",
                              "text-gray-300 hover:bg-gray-700 hover:text-white",
                              isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                            )}
                          >
                            <div className="flex items-center">
                              <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" />
                              <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                            </div>
                            <div className="ml-2">
                              {isProductionVoucherTypesOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
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
                                    data-sidebar-sub-active={isVtActive ? "true" : undefined}
                                    onClick={() => setLocation(`/reports/production-report?voucher_type_id=${vt.id}`)}
                                    className={cn(
                                      "w-full flex items-center px-10 py-2 text-left transition-all",
                                      "text-gray-300 hover:bg-gray-700 hover:text-white",
                                      isVtActive && "bg-gray-700 text-white border-r-4 border-gray-300"
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
                      <RouteLink
                        key={subIndex}
                        href={subItem.path}
                        data-sidebar-sub-active={isSubActive ? "true" : undefined}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: 'inline-block' }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                  </div>
                );
              })()}

                {/* Receipt Submenu */}
                {item.name === "Receipt" && showSection("Receipt", isReceiptOpen) && (
                  <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
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
                        <RouteLink
                          key={subIndex}
                          href={subItem.path}
                          className={cn(
                            "w-full flex items-center px-6 py-2 text-left transition-all block",
                            "text-gray-300 hover:bg-gray-700 hover:text-white",
                            isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                          )}
                          style={{ display: "flex", alignItems: "center" }}
                        >
                          <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: "inline-block" }} />
                          <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                        </RouteLink>
                      );
                    })}
                  </div>
                )}

                {/* Purchase Submenu */}
              {item.name === "Purchase" && showSection("Purchase", isPurchaseOpen) && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                  {getPurchaseSubMenus(hasPermission).map((subItem, subIndex) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = location === subItem.path || location.includes(subItem.path) ||
                      (subItem.name === "Purchase Orders" && location.includes("add-purchase-order")) ||
                      (subItem.name === "Purchase Return" && location.includes("add-purchase-return"));
                    return (
                      <RouteLink
                        key={subIndex}
                        href={subItem.path}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: "inline-block" }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

              {/* Outward Submenu */}
              {item.name === "Outward" && showSection("Outward", isOutwardOpen) && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
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
                      isSubActive = location === subItem.path;
                    }
                    return (
                      <RouteLink
                        key={subIndex}
                        href={subItem.path}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: 'inline-block' }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

              {/* Promotional Submenu — same placement as Outward/Purchase */}
              {item.name === "Promotional" && showSection("Promotional", isPromotionalOpen) && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                  {promotionalSubMenus.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive =
                      location === subItem.path ||
                      location.startsWith(`${subItem.path}/`);
                    return (
                      <RouteLink
                        key={subItem.path}
                        href={subItem.path}
                        data-sidebar-sub-active={isSubActive ? "true" : undefined}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: "inline-block" }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}


              {item.name === "Ledger Management" && showSection("Ledger Management", isLedgerManagementOpen) && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                  {getLedgerManagementSubMenus(hasPermission).map((subItem) => {
                    const SubIcon = subItem.icon || BookOpen;
                    const isSubActive = isLedgerSubMenuActive(location, subItem.path);
                    return (
                      <RouteLink
                        key={subItem.path}
                        href={subItem.path}
                        data-sidebar-sub-active={isSubActive ? "true" : undefined}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: "inline-block" }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

              {/* Masters Submenu */}
              {item.name === "Masters" && showSection("Masters", isMastersOpen) && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
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
                      <RouteLink
                        key={subIndex}
                        href={subItem.path}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: 'inline-block' }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

              {/* Route Management Submenu */}
              {item.name === "Route Management" && showSection("Route Management", isRouteManagementOpen) && hasPermission("route_management", "read") && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                  {routeManagementSubMenus.map((subItem, subIndex) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = location === subItem.path;
                    return (
                      <RouteLink
                        key={subIndex}
                        href={subItem.path}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: 'inline-block' }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

              {/* Logistics Submenu */}
              {item.name === "Logistics" && showSection("Logistics", isLogisticsOpen) && hasPermission("logistics_management", "read") && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                  {logisticsSubMenus.map((subItem, subIndex) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = location === subItem.path;
                    return (
                      <RouteLink
                        key={subIndex}
                        href={subItem.path}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: "inline-block" }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

              {/* Margin Settings Submenu - only Business Types, Credit Types, etc. (no Brokerage here) */}
              {item.name === "Margin Settings" && showSection("Margin Settings", isMarginSettingsOpen) && hasPermission("margin_settings", "read") && (
                <div className="sidebar-submenu bg-gray-800 border-l-4 border-gray-600 ml-0">
                  {marginSettingsSubMenus.map((subItem, subIndex) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = location === subItem.path || location.includes(subItem.path);
                    return (
                      <RouteLink
                        key={subIndex}
                        href={subItem.path}
                        className={cn(
                          "w-full flex items-center px-6 py-2 text-left transition-all block",
                          "text-gray-300 hover:bg-gray-700 hover:text-white",
                          isSubActive && "sidebar-link-active bg-gray-700 text-white border-r-4 border-gray-300"
                        )}
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <SubIcon className="mr-3 h-4 w-4 flex-shrink-0" style={{ display: 'inline-block' }} />
                        <span className="text-sm whitespace-nowrap">{subItem.name}</span>
                      </RouteLink>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}
      </nav>
      
      {!collapsed && (
      <div className="border-t border-gray-700 p-2 flex-shrink-0">
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
      )}
    </div>
  );
}
