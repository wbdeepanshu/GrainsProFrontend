import type { User, DashboardData } from "@shared/schema";
import {  
  IndianRupee 
} from "lucide-react";

export const mockUser: User = {
  id: 1,
  userId: "USR0001",
  mobile: "9999999999",
  password: "", // Not exposed
  name: "Mukesh Bafna",
  roleId: 1,
  role: "Admin",
  accessToken: null,
  tokenType: "Bearer",
  lastLogin: null,
};

export const mockDashboardData: DashboardData = {
  id: 1,
  date: "18-07-2025",
  userId: "USR0001",
  totalInwardEntries: 47,
  approvedEntries: 28,
  pendingEntries: 12,
  rejectedEntries: 7,
  consumptionNotes: 156,
  productionNotes: 89,
  brandTransfers: 34,
  stockTransfers: 67,
  tallyRunning: true,
  totalVoucherTypes: 6,
  hamaliEntries: 23,
  hamaliAmount: 15750.50,
  tallyItemCount: 1628,
  syncedItemCount: 1628,
  isSynced: true,
};

export const voucherTypes = [
  {
    name: "Sj Consumption [R]",
    count: 156,
    description: "Raw Item to Process Item",
    icon: "minus-circle",
    color: "purple",
  },
  {
    name: "Sj Production [R]",
    count: 89,
    description: "Process Item to Final Item", 
    icon: "plus-circle",
    color: "indigo",
  },
  {
    name: "Sj Brand Transfer",
    count: 34,
    description: "Source to Destination",
    icon: "arrow-right-left",
    color: "teal",
  },
  {
    name: "Sj Stock Transfer",
    count: 67,
    description: "Location Transfer",
    icon: "truck",
    color: "orange",
  },
];

// Inward entries data from API response
export const inwardEntriesData = [
  {
    id: 20,
    sl_no: "IW/2025/0013",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "rejected",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:33:39",
    created_at: "17-07-2025 17:33:39"
  },
  {
    id: 18,
    sl_no: "IW/2025/0012",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "rejected",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:30:56",
    created_at: "17-07-2025 17:30:56"
  },
  {
    id: 16,
    sl_no: "IW/2025/0011",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "approved",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:22:55",
    created_at: "17-07-2025 17:22:55"
  },
  {
    id: 13,
    sl_no: "IW/2025/0010",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "approved",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:11:14",
    created_at: "17-07-2025 17:11:14"
  },
  {
    id: 12,
    sl_no: "IW/2025/0009",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "rejected",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:11:13",
    created_at: "17-07-2025 17:11:13"
  },
  {
    id: 11,
    sl_no: "IW/2025/0008",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "rejected",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:11:11",
    created_at: "17-07-2025 17:11:11"
  },
  {
    id: 10,
    sl_no: "IW/2025/0007",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "approved",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:11:10",
    created_at: "17-07-2025 17:11:10"
  },
  {
    id: 9,
    sl_no: "IW/2025/0006",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "approved",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:06:08",
    created_at: "17-07-2025 17:06:08"
  },
  {
    id: 8,
    sl_no: "IW/2025/0005",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "approved",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:06:00",
    created_at: "17-07-2025 17:06:00"
  },
  {
    id: 7,
    sl_no: "IW/2025/0004",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "rejected",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Mukesh Bafna",
    test_date: "17-07-2025 17:05:58",
    created_at: "17-07-2025 17:05:58"
  },
  {
    id: 6,
    sl_no: "IW/2025/0003",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "approved",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Deep",
    test_date: "17-07-2025 13:28:41",
    created_at: "16-07-2025 17:28:41"
  },
  {
    id: 5,
    sl_no: "IW/2025/0002",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "rejected",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Deep",
    test_date: "17-07-2025 12:28:30",
    created_at: "16-07-2025 17:28:30"
  },
  {
    id: 4,
    sl_no: "IW/2025/0001",
    date: "17-07-2025",
    party_name: "ABC Agro Limited",
    vehicle_no: "KA25 U 2832",
    bill_no: "BILL001",
    broker_name: "Naveen",
    status: "approved",
    item_count: 0,
    total_bags: 0,
    net_weight: "1500.00",
    tested_by: "Deep",
    test_date: "17-07-2025 13:28:22",
    created_at: "16-07-2025 17:28:22"
  }
];

// Sample detail for inward entry
export const inwardEntryDetail = {
  id: 20,
  sl_no: "IW/2025/0013",
  date: "17-07-2025",
  party: "ABC Agro Limited",
  broker: "Naveen",
  vehicle_no: "KA25 U 2832",
  bill_no: "BILL001",
  loading_at: "",
  unloading_at: "",
  gross_weight: "1700.00",
  tare_weight: "200.00",
  net_weight: "1500.00",
  tested_by: "Mukesh Bafna",
  test_date: "17-07-2025 17:33:39",
  status: "rejected",
  total_items: 0,
  total_bags: 0,
  total_weight: "0",
  status_summary: {
    approved_items: 0,
    rejected_items: 0,
    pending_items: 0
  },
  stock_items: [],
  created_at: "17-07-2025 17:33:39",
  updated_at: "17-07-2025 17:33:39"
};

// Supervisor list for approval workflow
export const supervisorList = [
  { id: 1, name: "Mukesh Bafna", designation: "Senior Supervisor" },
  { id: 2, name: "Deep Sharma", designation: "Quality Supervisor" },
  { id: 3, name: "Rajesh Kumar", designation: "Floor Supervisor" },
  { id: 4, name: "Priya Singh", designation: "Warehouse Supervisor" }
];

// Godown list for approval workflow
export const godownList = [
  { id: 1, name: "Main Warehouse", location: "Ground Floor" },
  { id: 2, name: "Cold Storage", location: "Section A" },
  { id: 3, name: "Raw Material Store", location: "Section B" },
  { id: 4, name: "Finished Goods", location: "Section C" },
  { id: 5, name: "Quality Hold", location: "Section D" }
];

// Stock journal entries data  
export const stockJournalData = [
  {
    id: 1,
    transaction_id: "TR000001",
    voucher_number: "SJ001/2025",
    voucher_type_name: "Sj Production [R]",
    date: "21-07-2025",
    reference: "PROD-REF-001",
    description: "Raw material to finished product conversion",
    total_items: 5,
    total_quantity: 1250.00,
    is_tally_synced: true,
    created_at: "21-07-2025 10:30:00",
    updated_at: "21-07-2025 11:00:00"
  },
  {
    id: 2,
    transaction_id: "TR000002",
    voucher_number: "SJ002/2025",
    voucher_type_name: "Sj Consumption [R]",
    date: "21-07-2025",
    reference: "CONS-REF-002",
    description: "Raw material consumption for production",
    total_items: 3,
    total_quantity: 850.00,
    is_tally_synced: false,
    created_at: "21-07-2025 09:15:00",
    updated_at: "21-07-2025 09:15:00"
  },
  {
    id: 3,
    transaction_id: "TR000003",
    voucher_number: "SJ003/2025",
    voucher_type_name: "Sj Brand Transfer",
    date: "20-07-2025",
    reference: "BT-REF-003",
    description: "Brand transfer between locations",
    total_items: 2,
    total_quantity: 500.00,
    is_tally_synced: true,
    created_at: "20-07-2025 16:45:00",
    updated_at: "20-07-2025 17:00:00"
  },
  {
    id: 4,
    transaction_id: "TR000004",
    voucher_number: "SJ004/2025",
    voucher_type_name: "Sj Stock Transfer",
    date: "20-07-2025",
    reference: "ST-REF-004",
    description: "Stock transfer to warehouse",
    total_items: 4,
    total_quantity: 920.00,
    is_tally_synced: false,
    created_at: "20-07-2025 14:20:00",
    updated_at: "20-07-2025 14:20:00"
  },
  {
    id: 5,
    transaction_id: "TR000005",
    voucher_number: "SJ005/2025",
    voucher_type_name: "Sj Production [R]",
    date: "19-07-2025",
    reference: "PROD-REF-005",
    description: "Bulk production processing",
    total_items: 8,
    total_quantity: 2100.00,
    is_tally_synced: true,
    created_at: "19-07-2025 11:30:00",
    updated_at: "19-07-2025 12:00:00"
  },
  {
    id: 6,
    transaction_id: "TR000006",
    voucher_number: "SJ006/2025",
    voucher_type_name: "Sj Consumption [R]",
    date: "19-07-2025",
    reference: "CONS-REF-006",
    description: "Quality testing material consumption",
    total_items: 1,
    total_quantity: 150.00,
    is_tally_synced: false,
    created_at: "19-07-2025 10:00:00",
    updated_at: "19-07-2025 10:00:00"
  }
];

// Stock journal detail data
export const stockJournalDetailData = {
  TR000001: {
    id: 1,
    transaction_id: "TR000001",
    voucher_number: "SJ001/2025",
    voucher_type_name: "Sj Production [R]",
    date: "21-07-2025",
    reference: "PROD-REF-001",
    description: "Raw material to finished product conversion",
    total_items: 5,
    total_quantity: 1250.00,
    is_tally_synced: true,
    items: [
      {
        id: 1,
        item_name: "Rice Flour Grade A",
        quantity_in: 0,
        quantity_out: 500.00,
        unit: "KG",
        rate: 45.00,
        amount: 22500.00
      },
      {
        id: 2,
        item_name: "Wheat Flour Premium",
        quantity_in: 750.00,
        quantity_out: 0,
        unit: "KG", 
        rate: 38.50,
        amount: 28875.00
      }
    ],
    created_at: "21-07-2025 10:30:00",
    updated_at: "21-07-2025 11:00:00"
  }
};

// Available voucher types for stock journals
export const stockVoucherTypes = [
  {
    id: 1,
    name: "Sj Production [R]",
    description: "Production voucher for raw materials",
    is_active: true
  },
  {
    id: 2,
    name: "Sj Consumption [R]",
    description: "Consumption voucher for raw materials", 
    is_active: true
  },
  {
    id: 3,
    name: "Sj Brand Transfer",
    description: "Brand transfer between locations",
    is_active: true
  },
  {
    id: 4,
    name: "Sj Stock Transfer",
    description: "Stock transfer voucher",
    is_active: true
  }
];

export const sidebarMenuItems = [
  { name: "Dashboard", icon: "gauge", path: "/dashboard", active: true },
  { name: "User List", icon: "users", path: "/users", active: false },
  {
    name: "Masters",
    icon: "folder",
    path: "/masters", // fake root, not used
  },
  {
    name: "Ledger Management",
    icon: "book-open",
    path: "/ledger-management",
  },
  {
    name: "Purchase",
    icon: "shopping-bag",
    path: "/purchase", // fake root, not used
  },

  { name: "Inward", icon: "clipboard-list", path: "/reports/inward-list", active: false },
  { name: "Item Testing", icon: "test-tube", path: "/item-testing", active: false },
  { name: "Weighbridge", icon: "truck", path: "/vehicle-info", active: false },
  { name: "Stock Transfer", icon: "arrow-right-left", path: "/stock-transfer", active: false },
  {
    name: "Sales",
    icon: "shopping-cart",
    path: "/sales",
  },
  {
    name: "Promotional",
    icon: "megaphone",
    path: "/promotional",
  },
  {
    name: "Outward",
    icon: "package",
    path: "/outward", // fake root, not used
  },
  { name: "Expense", icon: "receipt", path: "/reports/expense-list", active: false },
  {
    name: "Receipt",
    icon: "file-check",
    path: "/receipt",
  },
 
  { name: "Reports", icon: "bar-chart-3", path: "/reports", active: false },
  { name: "Import Data", icon: "upload", path: "/import", active: false },
  
  { name: "Route Management", icon: "route", path: "/route-management", active: false },
  { name: "Logistics", icon: "truck", path: "/logistics", active: false },
  { name: "Margin Settings", icon: "percent", path: "/margin-settings", active: false },
  { name: "Recent Activity", icon: "activity", path: "/recent-activity", active: false },
  { name: "Stock Auditing", icon: "clipboard-list", path: "/stock-auditing", active: false },
  // { name: "Notification Settings", icon: "bell", path: "/notification-settings", active: false },
  { name: "Banners", icon: "image", path: "/banners", active: false },
  
  { name: "Help Videos", icon: "video", path: "/help-videos", active: false },
  { name: "Privacy Policy", icon: "shield-check", path: "/privacy", active: false },
  { name: "Admin Settings", icon: "settings", path: "/admin-settings", active: false },
  { name: "Contact Us", icon: "file-text", path: "/contact-us", active: false },
  { name: "Log out", icon: "log-out", path: "/logout", active: false, separator: true },
];
