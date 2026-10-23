import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Menu, Database, Building2, Layers, Tags, Package, FileType, Upload, CheckCircle, AlertCircle, Receipt, Loader2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import Loader from "@/components/common/loader";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  IMPORT_COUNT_KEYS_ZERO_PENDING,
  COUNT_KEYS_EXCLUDED_FROM_PENDING_UI,
  getPendingZeroImportItems,
  parseImportCountNumeric,
} from "@/lib/importCountsPending";
import { ImportPendingDialog } from "@/components/import/ImportPendingDialog";

const DEFAULT_UNIT_OPTIONS = [
  "Kg",
  "Qtl",
  "Bags",
  "Pkt",
  "Tons",
  "Bundle",
  "Gm",
  "Dozen",
  "Nos",
  "Ltr",
  "Box",
  "Pcs",
  "Mtr",
  "Quintal",
  "Mt",
  "Gram",
];

export default function ImportData() {
  const getDefaultVoucherForm = () => ({
    name: "",
    display_name: "",
    parent: "Primary",
    is_active: true,
    allow_zero_stocks: true,
    is_batch: false,
    is_batch_validation: false,
    add_bardan: false,
    add_bardan_only: false,
    in_source: false,
    in_destination: false,
    source_alias: "source",
    destination_alias: "destination",
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingledger, setIsUploadingledger] = useState(false);
  const [isUploadingSalesOrders, setIsUploadingSalesOrders] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileledger, setSelectedFileledger] = useState(null);
  const [selectedFileSalesOrders, setSelectedFileSalesOrders] = useState(null);
  const [importingMasters, setImportingMasters] = useState({});
  const [importPendingPopupDismissed, setImportPendingPopupDismissed] = useState(false);
  const [staticUploadLoading, setStaticUploadLoading] = useState({});
  const [staticUploadResults, setStaticUploadResults] = useState({});
  const [isVoucherFormOpen, setIsVoucherFormOpen] = useState(false);
  const [isCreatingVoucher, setIsCreatingVoucher] = useState(false);
  const [showVoucherAdditional, setShowVoucherAdditional] = useState(false);
  const [isDisplayNameEdited, setIsDisplayNameEdited] = useState(false);
  const [voucherForm, setVoucherForm] = useState(getDefaultVoucherForm);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  const importCountsQueryKey = [`${API_BASE_URL}/api/import-counts/`];
  const { toast } = useToast();
  const { hasPermission } = useUserPermissions();
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
  const [staticUploads, setStaticUploads] = useState({});
  const [stockItemUploadChoiceOpen, setStockItemUploadChoiceOpen] = useState(false);
  const [ledgerUploadChoiceOpen, setLedgerUploadChoiceOpen] = useState(false);
  const [isUnitMasterDialogOpen, setIsUnitMasterDialogOpen] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [isCreatingUnits, setIsCreatingUnits] = useState(false);
  const stockItemExcelInputRef = useRef(null);
  const stockItemXmlInputRef = useRef(null);
  const ledgerExcelInputRef = useRef(null);
  const ledgerXmlInputRef = useRef(null);

  // Simulate loading import options
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  // Fetch for every logged-in user (not only Tally orgs); UI still gates Tally-only flows elsewhere.
  const importCountsQueryEnabled = AuthService.isAuthenticated();

  const {
    data: importCountsData,
    isSuccess: importCountsQuerySuccess,
    isFetched: importCountsFetched,
  } = useQuery({
    queryKey: importCountsQueryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/import-counts/`);
      const result = await response.json();
      if (result?.status === 200 && result?.data) {
        return result.data;
      }
      throw new Error(result?.message || "Invalid import-counts response");
    },
    enabled: importCountsQueryEnabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const importCounts = importCountsData ?? {};
  const importCountsValid = importCountsQuerySuccess && importCountsData != null;
  const importCountsLoaded = !importCountsQueryEnabled || importCountsFetched;

  useEffect(() => {
    if (isDisplayNameEdited) return;
    setVoucherForm((prev) => {
      if (prev.display_name === prev.name) return prev;
      return { ...prev, display_name: prev.name };
    });
  }, [voucherForm.name, isDisplayNameEdited]);

  // Check if any master import is in progress
  const isAnyImportInProgress = Object.values(importingMasters).some(Boolean);

  // Filter import options based on permissions
  const allImportOptions = [
    {
      title: "Import Unit Master",
      description: "Import measurement units",
      icon: Database,
      gradient: "from-blue-500 to-blue-600",
      textColor: "text-blue-100",
      bgColor: "bg-blue-400",
      action: "unit-master",
      endpoint: "/api/fetch-units/",
      countKey: "tblUnitsMaster"
    },
    {
      title: "Godown Master",
      description: "Import warehouse and storage locations",
      icon: Building2,
      gradient: "from-green-500 to-green-600",
      textColor: "text-green-100",
      bgColor: "bg-green-400",
      action: "godown-master",
      endpoint: "/api/fetch-godowns/",
      countKey: "tblGodownMaster"
    },
    {
      title: "Stock Groups",
      description: "Import stock classification groups",
      icon: Layers,
      gradient: "from-purple-500 to-purple-600",
      textColor: "text-purple-100",
      bgColor: "bg-purple-400",
      action: "stock-groups",
      endpoint: "/api/fetch-stock-group/",
      countKey: "tblStockGroup"
    },
    {
      title: "Stock Category",
      description: "Import product categories and types",
      icon: Tags,
      gradient: "from-indigo-500 to-indigo-600",
      textColor: "text-indigo-100",
      bgColor: "bg-indigo-400",
      action: "stock-category",
      endpoint: "/api/fetch-stock-category/",
      countKey: "tblStockCategory"
    },
//     {
//       title: "Stock Item Master",
//       description: "Import complete stock item details (Static for now)",
//       icon: Package,
//       gradient: "from-teal-500 to-teal-600",
//       textColor: "text-teal-100",
//       bgColor: "bg-teal-400",
//       action: "stock-item-master",
//       endpoint: null // Static for now
//     },
    {
      title: "Import New Stocks",
      description: "Import only new stock items by GUID",
      icon: Package,
      gradient: "from-cyan-500 to-cyan-600",
      textColor: "text-cyan-100",
      bgColor: "bg-cyan-400",
      action: "import-new-stocks",
      endpoint: "/api/import-stock-item-master/",
      countKey: "tblStockItemMasterSync"
    },
    // {
    //   title: "Purchase Orders",
    //   description: "Import complete purchase orders from tally",
    //   icon: Package,
    //   gradient: "from-teal-500 to-teal-600",
    //   textColor: "text-teal-100",
    //   bgColor: "bg-teal-400",
    //   action: "purchase-orders",
    //   endpoint: "/api/fetch-purchase-orders/",
    //   countKey: "tblPurchaseOrders"
    // },
    {
      title: "Voucher Type Masters",
      description: "Import transaction voucher types",
      icon: FileType,
      gradient: "from-orange-500 to-orange-600",
      textColor: "text-orange-100",
      bgColor: "bg-orange-400",
      action: "voucher-types",
      endpoint: "/api/fetch-voucher-types/",
      countKey: "tblVoucherTypeMaster"
    },
    {
      title: "Import Ledgers",
      description: "Fetch and sync ledgers from Tally",
      icon: Users,
      gradient: "from-blue-500 to-blue-600",
      textColor: "text-blue-100",
      bgColor: "bg-blue-400",
      action: "import-ledgers",
      endpoint: "/api/fetch-and-store-ledgers/",
      countKey: "tblPartyInfo"
    },
    {
      title: "Import Outstanding",
      description: "Import ledger-eise outstandings bills",
      icon: Receipt,
      gradient: "from-amber-500 to-amber-600",
      textColor: "text-amber-100",
      bgColor: "bg-amber-400",
      action: "import-outstanding",
      endpoint: "/api/accounts/fetch-ledgers-outstanding/",
      needsDateRange: true,
      countKey: "tblLedgersOutstandings"
    }
  ];

  // Filter import options based on permissions
  const importOptions = useMemo(() => {
    return allImportOptions.filter(option => {
      // Voucher Type Masters - show for all users in import data page
      // (Separate voucher-settings page is hidden if permission not there)
      if (option.action === "voucher-types") {
        return true; // Always visible in import data page
      }
      // Purchase Orders - show only if inward permission exists
      if (option.action === "purchase-orders") {
        return hasPermission("inward", "read");
      }
      // Import Ledgers — Tally fetch; requires Customer Management read
      if (option.action === "import-ledgers") {
        return hasPermission("customer_management", "read");
      }
      // Import Outstanding - show only if ledgers_account create or update permission (API returns alias: ledgers_account)
      if (option.action === "import-outstanding") {
        return hasPermission("ledgers_account", "create") || hasPermission("ledgers_account", "update");
      }
      // Other options are always visible
      return true;
    });
  }, [hasPermission, allImportOptions]);

  const nonTallyImportOptions = useMemo(() => ([
    {
      title: "Unit Master",
      description: "Import measurement units",
      icon: Database,
      gradient: "from-blue-500 to-blue-600",
      textColor: "text-blue-100",
      bgColor: "bg-blue-400",
      action: "unit-master",
      countKey: "tblUnitsMaster",
    },
    {
      title: "Godown Master",
      description: "Import warehouse and storage locations",
      icon: Building2,
      gradient: "from-green-500 to-green-600",
      textColor: "text-green-100",
      bgColor: "bg-green-400",
      action: "godown-master",
      countKey: "tblGodownMaster",
    },
    {
      title: "Upload Stock Item Master",
      description: "Upload stock item master using Excel or XML file",
      icon: Package,
      gradient: "from-gray-500 to-gray-600",
      textColor: "text-gray-100",
      bgColor: "bg-gray-400",
      action: "stock-item-master",
      countKey: "tblStockItemMaster",
    },
    {
      title: "Add Ledgers File",
      description: "Upload ledgers using excel file",
      icon: Receipt,
      gradient: "from-blue-500 to-blue-600",
      textColor: "text-blue-100",
      bgColor: "bg-blue-400",
      action: "ledgers-file",
      countKey: "tblLedgersOutstandings",
    },
    {
      title: "Upload Current Stocks",
      description: "Upload current stock balance by godown and batch",
      icon: Upload,
      gradient: "from-purple-500 to-purple-600",
      textColor: "text-purple-100",
      bgColor: "bg-purple-400",
      action: "current-stocks",
      countKey: "tblStockItemMaster",
    },
    {
      title: "Create Voucher",
      description: "Create voucher type with required settings",
      icon: FileType,
      gradient: "from-orange-500 to-orange-600",
      textColor: "text-orange-100",
      bgColor: "bg-orange-400",
      action: "create-voucher",
      countKey: "tblVoucherTypeMaster",
    }
  ]), []);

  const displayedImportOptions = useMemo(() => {
    const baseOptions = isTallyEnabled ? importOptions : nonTallyImportOptions;
    const stockItemMasterCount = parseImportCountNumeric(importCounts.tblStockItemMaster);
    const shouldHideCurrentStocksCard =
      importCountsLoaded && importCountsValid && stockItemMasterCount === 0;

    if (!shouldHideCurrentStocksCard) {
      return baseOptions;
    }

    return baseOptions.filter((option) => option.action !== "current-stocks");
  }, [
    isTallyEnabled,
    importOptions,
    nonTallyImportOptions,
    importCounts,
    importCountsLoaded,
    importCountsValid,
  ]);

  const pendingZeroImportItems = useMemo(() => {
    if (!importCountsLoaded || !importCountsValid) return [];
    return getPendingZeroImportItems(importCounts);
  }, [importCounts, importCountsLoaded, importCountsValid]);

  const importModuleStatuses = useMemo(() => {
    if (!importCountsLoaded || !importCountsValid) return [];
    return IMPORT_COUNT_KEYS_ZERO_PENDING.map(({ key, label }) => {
      const value = importCounts[key] ?? 0;
      return {
        key,
        label,
        value,
        pending: parseImportCountNumeric(value) === 0,
      };
    });
  }, [importCounts, importCountsLoaded, importCountsValid]);

  useEffect(() => {
    if (pendingZeroImportItems.length === 0) {
      setImportPendingPopupDismissed(false);
    }
  }, [pendingZeroImportItems.length]);

  const showImportPendingPopup =
    importCountsLoaded &&
    importCountsValid &&
    pendingZeroImportItems.length > 0 &&
    !importPendingPopupDismissed;

  const handleImportClick = async (action, title, endpoint, needsDateRange) => {
    // Skip API call for Stock Item Master (static for now)
    if (action === "stock-item-master") {
      toast({
        title: "Static Feature",
        description: "Stock Item Master is currently static and not connected to API",
        variant: "default",
      });
      return;
    }

    if (!endpoint) {
      toast({
        title: "Error",
        description: "No API endpoint configured for this import",
        variant: "destructive",
      });
      return;
    }

    // Set loading state for this specific import
    setImportingMasters(prev => ({ ...prev, [action]: true }));

    try {
      // Get authentication token
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found. Please login again.");
      }

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;

      // Build request body: Import Outstanding needs from_date, to_date (current month)
      let body = {};
      if (needsDateRange && action === "import-outstanding") {
        const now = new Date();
        const from_date = new Date(now.getFullYear(), now.getMonth(), 1);
        const to_date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        body = {
          from_date: from_date.toISOString().slice(0, 10),
          to_date: to_date.toISOString().slice(0, 10),
        };
      }

      // Call the API endpoint
      const isLongRunningImport = action === "import-ledgers";
      const controller = new AbortController();
      const timeoutId = isLongRunningImport
        ? setTimeout(() => controller.abort(), 15 * 60 * 1000)
        : null;

      let response;
      try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Import failed with status: ${response.status}`);
      }

      let description = result.message || `${title} completed successfully.`;
      if (action === "import-ledgers" && result.data) {
        const d = result.data;
        description = `${result.message || "Ledgers synced from Tally."} Created: ${d.ledgers_created ?? 0}, Updated: ${d.ledgers_updated ?? 0}, Skipped: ${d.ledgers_skipped ?? 0}.`;
        if ((d.total_errors ?? 0) > 0) {
          description += ` Errors: ${d.total_errors}.`;
        }
      }
      if (action === "import-outstanding" && result.data?.summary) {
        const s = result.data.summary;
        description += ` Ledgers: ${s.ledgers_created ?? 0} created. Bills: ${s.bills_created ?? 0} created, ${s.bills_updated ?? 0} updated, ${s.bills_removed ?? 0} removed. ${s.skipped_no_party ?? 0} skipped (no party).`;
        queryClient.invalidateQueries({ queryKey: ["ledgers-outstanding"] });
        queryClient.invalidateQueries({ queryKey: ["ledgers-outstanding-list"] });
      }
      toast({
        title: "Import Successful",
        description,
        variant: "success",
      });

      queryClient.invalidateQueries({ queryKey: importCountsQueryKey });
    } catch (error) {
      console.error(`${title} import error:`, error);

      toast({
        title: "Import Failed",
        description: error?.name === "AbortError"
          ? "Request timed out. Large ledger sync can take several minutes — try again or check server logs."
          : (error.message || `Failed to import ${title}. Please try again.`),
        variant: "destructive",
      });
    } finally {
      setImportingMasters(prev => ({ ...prev, [action]: false }));
    }
  };

  const handleDownloadTemplate = async (title, action) => {
    let rows;
    let godownNames = [];

    if (action === "current-stocks") {
      try {
        const token = AuthService.getAccessToken();
        if (!token) {
          throw new Error("No authentication token found. Please login again.");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const collectedNames = new Set();
        const collectedGodowns = new Set();
        let page = 1;
        let totalPages = 1;

        // Pull all pages so template contains all available stock items.
        while (page <= totalPages) {
          const response = await fetch(`${API_BASE_URL}/api/get-stock-items/`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              search: "",
              type: "",
              stock_group: "",
              stock_category: "",
              godown: "",
              is_active: true,
              new_page: page,
              per_page: 1000,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch stock items (status: ${response.status})`);
          }

          const result = await response.json().catch(() => ({}));
          const items = Array.isArray(result?.data) ? result.data : [];
          items.forEach((item) => {
            const name = String(item?.name ?? "").trim();
            if (name) collectedNames.add(name);
          });

          const pagination = result?.pagination || {};
          totalPages = Number(pagination?.total_pages || 1);
          page += 1;
          if (page > 50) break;
        }

        const sortedNames = Array.from(collectedNames).sort((a, b) => a.localeCompare(b));

        // Fetch godowns for dropdown values in template.
        const godownsResponse = await fetch(`${API_BASE_URL}/api/get-godowns/`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!godownsResponse.ok) {
          throw new Error(`Failed to fetch godowns (status: ${godownsResponse.status})`);
        }

        const godownsResult = await godownsResponse.json().catch(() => ({}));
        const godownData = Array.isArray(godownsResult?.data) ? godownsResult.data : [];
        godownData.forEach((godown) => {
          const value = String(
            godown?.name ?? godown?.godown_name ?? godown?.location ?? ""
          ).trim();
          if (value) collectedGodowns.add(value);
        });
        godownNames = Array.from(collectedGodowns).sort((a, b) => a.localeCompare(b));

        rows = sortedNames.length
          ? sortedNames.map((name) => ({
              stock_item_name: name,
              balance: "",
              godown_name: "",
              batch_name: "",
            }))
          : [{
              stock_item_name: "",
              balance: "",
              godown_name: "",
              batch_name: "",
            }];

        // Use ExcelJS for current-stocks template so godown dropdown is available in each row.
        const workbook = new ExcelJS.Workbook();
        const templateSheet = workbook.addWorksheet("Template");
        const godownSheet = workbook.addWorksheet("Godown List");

        templateSheet.columns = [
          { header: "stock_item_name", key: "stock_item_name", width: 35 },
          { header: "balance", key: "balance", width: 14 },
          { header: "godown_name", key: "godown_name", width: 28 },
          { header: "batch_name", key: "batch_name", width: 20 },
        ];

        rows.forEach((row) => templateSheet.addRow(row));

        godownSheet.columns = [{ header: "godown_name", key: "godown_name", width: 35 }];
        godownNames.forEach((name) => godownSheet.addRow({ godown_name: name }));
        godownSheet.state = "veryHidden";

        const validationMaxRow = Math.max(rows.length + 1, 1000);
        const godownRangeEnd = Math.max(godownNames.length + 1, 2);
        for (let rowIndex = 2; rowIndex <= validationMaxRow; rowIndex += 1) {
          templateSheet.getCell(`C${rowIndex}`).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [`'Godown List'!$A$2:$A$${godownRangeEnd}`],
            showErrorMessage: true,
            errorTitle: "Invalid Godown",
            error: "Please select a godown from the dropdown list.",
          };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const fileName = `${title.toLowerCase().replace(/\s+/g, "-")}-template.xlsx`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return;
      } catch (error) {
        toast({
          title: "Template Download Failed",
          description: error.message || "Failed to fetch stock items for template.",
          variant: "destructive",
        });
        return;
      }
    } else if (action === "stock-item-master") {
      try {
        const token = AuthService.getAccessToken();
        if (!token) {
          throw new Error("No authentication token found. Please login again.");
        }
        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(`${API_BASE_URL}/api/user/download-stock-item-master-excel/`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          let message = `Download failed with status: ${response.status}`;
          try {
            const err = await response.json();
            if (err?.message) message = err.message;
          } catch {
            /* non-JSON error body */
          }
          throw new Error(message);
        }
        const blob = await response.blob();
        const fileName = "stock-item-master-template.xlsx";
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return;
      } catch (error) {
        toast({
          title: "Template Download Failed",
          description: error.message || "Failed to download stock item master template.",
          variant: "destructive",
        });
        return;
      }
    } else {
      rows =
        action === "godown-master"
            ? [{ godown_name: "Godown 1", branch: "Main Branch" }]
          : action === "ledgers-file"
            ? [{
              ledger_name: "Suraj Traders",
              ledger_group: "Hubli Debitors",
              firm_name: "Suraj Trading House",
              email: "test@email.com",
              mobile: "9898989898",
              taxation_type: "Registered",
              customer_type: "Dealership",
              address: "Deshpande nagar, Hubballi",
              city: "Hubballi",
              state: "Karnataka",
              pincode: "580029",
              landmark: "Cotton Market",
              country: "India",
              contact_person: "Suraj Javali",
              contact_number: "9879879879",
              religion: "Hindu",
              is_supplier: "Yes"
            }]
          : [{ sample_column_1: "Value A", sample_column_2: "Value B", sample_column_3: "Value C" }];
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    const fileName = `${title.toLowerCase().replace(/\s+/g, "-")}-template.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleStaticFileUpload = async (key, event, format = "excel") => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Integrate static upload APIs for non-tally users.
    if (key === "godown-master" || key === "ledgers-file" || key === "stock-item-master" || key === "current-stocks") {
      const token = AuthService.getAccessToken();
      if (!token) {
        toast({
          title: "Upload Failed",
          description: "No authentication token found. Please login again.",
          variant: "destructive",
        });
        event.target.value = "";
        return;
      }

      try {
        if (!API_BASE_URL) {
          throw new Error("API base URL is not configured. Set VITE_BASE_URL in your environment.");
        }

        setStaticUploadLoading((prev) => ({ ...prev, [key]: true }));
        const formData = new FormData();
        formData.append("file", file);

        const endpoint =
          key === "godown-master"
              ? "/api/user/upload-godown-master-excel/"
              : key === "stock-item-master"
                ? format === "xml"
                  ? (isTallyEnabled ? "/api/user/upload-stock-item-master-xml/" : "/api/upload-xml/")
                  : "/api/user/upload-stock-item-master-excel/"
                : key === "ledgers-file"
                  ? (format === "xml" ? "/api/report/upload-ledgers/" : "/api/user/upload-ledger-master-excel/")
                : key === "current-stocks"
                  ? "/api/user/upload-current-stocks-excel/"
                : "/api/user/upload-ledger-master-excel/";

        if (key === "stock-item-master") {
          const lower = file.name.toLowerCase();
          if (format === "xml" && !lower.endsWith(".xml")) {
            toast({
              title: "Invalid file",
              description: "Please choose an .xml file for XML upload.",
              variant: "destructive",
            });
            event.target.value = "";
            setStaticUploadLoading((prev) => ({ ...prev, [key]: false }));
            return;
          }
          if (format === "excel" && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
            toast({
              title: "Invalid file",
              description: "Please choose an .xlsx or .xls file for Excel upload.",
              variant: "destructive",
            });
            event.target.value = "";
            setStaticUploadLoading((prev) => ({ ...prev, [key]: false }));
            return;
          }
        }

        if (key === "ledgers-file") {
          const lower = file.name.toLowerCase();
          if (format === "xml" && !lower.endsWith(".xml")) {
            toast({
              title: "Invalid file",
              description: "Please choose an .xml file for ledger upload.",
              variant: "destructive",
            });
            event.target.value = "";
            setStaticUploadLoading((prev) => ({ ...prev, [key]: false }));
            return;
          }
        }

        const isLongRunningStockXml = key === "stock-item-master" && format === "xml";
        const controller = new AbortController();
        const xmlTimeoutMs = 15 * 60 * 1000;
        const timeoutId = isLongRunningStockXml
          ? setTimeout(() => controller.abort(), xmlTimeoutMs)
          : null;

        let response;
        try {
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
            signal: controller.signal,
          });
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Unexpected server response (${response.status}). Check VITE_BASE_URL points to the Django API.`
          );
        }

        const result = await response.json().catch(() => ({}));
        const apiStatus = Number(result?.status);
        if (!response.ok || (Number.isFinite(apiStatus) && apiStatus >= 400)) {
          throw new Error(result?.message || `Upload failed with status: ${response.status}`);
        }

        const uploadData = result?.data || {};
        const itemsCreated = uploadData.items_created ?? 0;
        const itemsUpdated = uploadData.items_updated ?? 0;
        const skippedInvalid = uploadData.skipped_invalid ?? 0;

        if (key === "stock-item-master") {
          const totalRows = uploadData.total_rows ?? 0;
          if (totalRows > 0 && itemsCreated === 0 && itemsUpdated === 0) {
            const errHint = Array.isArray(uploadData.create_errors)?.[0]?.error;
            throw new Error(
              result?.message ||
                `No items were saved (${skippedInvalid} row(s) skipped).${errHint ? ` ${errHint}` : ""}`
            );
          }
        }

        setStaticUploads((prev) => ({ ...prev, [key]: file.name }));
        setStaticUploadResults((prev) => ({ ...prev, [key]: uploadData }));
        queryClient.invalidateQueries({ queryKey: importCountsQueryKey });
        const elapsed =
          uploadData.elapsed_seconds != null ? ` (${uploadData.elapsed_seconds}s)` : "";
        let description = result?.message || "File uploaded successfully.";
        if (key === "stock-item-master") {
          description = `${description} Created: ${itemsCreated}, Updated: ${itemsUpdated}${skippedInvalid ? `, Skipped: ${skippedInvalid}` : ""}${elapsed}`;
        } else if (
          key === "current-stocks" &&
          Array.isArray(uploadData.skipped_items_not_created) &&
          uploadData.skipped_items_not_created.length > 0
        ) {
          description = `${description} Skipped items: ${uploadData.skipped_items_not_created.length}${elapsed}`;
        } else {
          description = `${description}${elapsed}`;
        }
        toast({
          title: "Upload Successful",
          description,
          variant: "success",
        });
      } catch (error) {
        const isAbort = error?.name === "AbortError";
        toast({
          title: "Upload Failed",
          description: isAbort
            ? "Request timed out (15 min). Large XML can take longer — check server logs for [stock_item_master_xml] progress, or raise proxy/Gunicorn timeout."
            : (error.message || "Failed to upload unit master excel."),
          variant: "destructive",
        });
      } finally {
        setStaticUploadLoading((prev) => ({ ...prev, [key]: false }));
        event.target.value = "";
      }
      return;
    }

    // Other static cards remain file-selection only.
    setStaticUploads((prev) => ({ ...prev, [key]: file.name }));
    toast({
      title: "File Selected",
      description: `${file.name} selected (static mode).`,
      variant: "success",
    });
    event.target.value = "";
  };

  const toggleUnitSelection = (unitName) => {
    setSelectedUnits((prev) =>
      prev.includes(unitName)
        ? prev.filter((name) => name !== unitName)
        : [...prev, unitName]
    );
  };

  const handleSelectAllUnits = () => {
    setSelectedUnits([...DEFAULT_UNIT_OPTIONS]);
  };

  const handleClearUnitSelection = () => {
    setSelectedUnits([]);
  };

  const handleCreateUnitMasters = async () => {
    if (selectedUnits.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one unit to import.",
        variant: "destructive",
      });
      return;
    }

    const token = AuthService.getAccessToken();
    if (!token) {
      toast({
        title: "Import Failed",
        description: "No authentication token found. Please login again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingUnits(true);
      const response = await fetch(`${API_BASE_URL}/api/user/create-unit-masters/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ units: selectedUnits }),
      });

      const result = await response.json().catch(() => ({}));
      const apiStatus = Number(result?.status);
      if (!response.ok || (Number.isFinite(apiStatus) && apiStatus >= 400)) {
        throw new Error(result?.message || `Import failed with status: ${response.status}`);
      }

      const summary = result?.data || {};
      toast({
        title: "Import Successful",
        description:
          result?.message ||
          `Created ${summary.created ?? 0} unit(s). Skipped existing: ${summary.skipped_existing ?? 0}.`,
        variant: "success",
      });

      setIsUnitMasterDialogOpen(false);
      setSelectedUnits([]);
      queryClient.invalidateQueries({ queryKey: importCountsQueryKey });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to create unit masters.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingUnits(false);
    }
  };

  const handleCreateVoucher = async () => {
    const token = AuthService.getAccessToken();
    if (!token) {
      toast({
        title: "Create Failed",
        description: "No authentication token found. Please login again.",
        variant: "destructive",
      });
      return;
    }

    if (!voucherForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Voucher Name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingVoucher(true);
      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      const payload = {
        ...voucherForm,
        name: voucherForm.name.trim(),
        display_name: voucherForm.display_name.trim() || voucherForm.name.trim(),
        parent: voucherForm.parent.trim(),
        source_alias: voucherForm.source_alias.trim() || "source",
        destination_alias: voucherForm.destination_alias.trim() || "destination",
      };

      const response = await fetch(`${API_BASE_URL}/api/create-voucher/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.status >= 400) {
        throw new Error(result?.message || result?.error || `Create failed with status: ${response.status}`);
      }

      toast({
        title: "Voucher Created",
        description: result?.message || "Voucher type created successfully.",
        variant: "success",
      });

      setVoucherForm(getDefaultVoucherForm());
      setShowVoucherAdditional(false);
      setIsDisplayNameEdited(false);
      setIsVoucherFormOpen(false);
    } catch (error) {
      toast({
        title: "Create Failed",
        description: error.message || "Failed to create voucher.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingVoucher(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setIsUploading(true);

    try {
      // Get authentication token
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found. Please login again.");
      }

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      // Upload file to API
      const response = await fetch(API_BASE_URL + '/api/upload-xml/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status: ${response.status}`);
      }

      const result = await response.json();

      toast({
        title: "Upload Successful",
        description: `File "${file.name}" uploaded successfully. ${result.message || ''}`,
        className: "text-white",
          style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
      });

      queryClient.invalidateQueries({ queryKey: importCountsQueryKey });

      // Reset file input
      event.target.value = '';
      setSelectedFile(null);

    } catch (error) {
      console.error("Upload error:", error);

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });

      // Reset file input on error
      event.target.value = '';
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLedgersFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFileledger(file);
    setIsUploadingledger(true);

    try {
      // Get authentication token
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found. Please login again.");
      }

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      // Upload file to API with correct endpoint
      const response = await fetch(API_BASE_URL + '/api/report/upload-ledgers/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status: ${response.status}`);
      }

      const result = await response.json();

      toast({
        title: "Upload Successful",
        description: `File "${file.name}" uploaded successfully. ${result.message || ''}`,
        className: "text-white",
        style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
      });

      queryClient.invalidateQueries({ queryKey: importCountsQueryKey });

      // Reset file input
      event.target.value = '';
      setIsUploadingledger(null);

    } catch (error) {
      console.error("Upload error:", error);

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });

      // Reset file input on error
      event.target.value = '';
      setIsUploadingledger(null);
    } finally {
      setIsUploadingledger(false);
    }
  };

  const handleSalesOrdersFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type (XML)
    const allowedTypes = ['.xml', 'text/xml', 'application/xml'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidType = fileExtension === 'xml' || allowedTypes.includes(file.type);

    if (!isValidType) {
      toast({
        title: "Invalid File Type",
        description: "Please select a valid XML file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 200MB)
    const maxSize = 200 * 1024 * 1024; // 200MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 200MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFileSalesOrders(file);
    setIsUploadingSalesOrders(true);

    try {
      // Get authentication token
      const token = AuthService.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found. Please login again.");
      }

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);

      const API_BASE_URL = import.meta.env.VITE_BASE_URL;
      // Upload file to API
      const response = await fetch(API_BASE_URL + '/api/sales/upload-sales-orders-xml/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status: ${response.status}`);
      }

      const result = await response.json();

      // Show detailed success message with statistics
      const data = result.data || {};
      const successMessage = data.orders_created || data.orders_updated 
        ? `Uploaded successfully! Created: ${data.orders_created || 0}, Updated: ${data.orders_updated || 0}, Items: ${data.items_created || 0}`
        : result.message || 'File uploaded successfully';

      toast({
        title: "Upload Successful",
        description: successMessage,
        variant: "success",
      });

      // Show errors if any
      if (data.errors && data.errors.length > 0) {
        const errorCount = data.errors.length;
        toast({
          title: "Upload Completed with Warnings",
          description: `${errorCount} error(s) occurred during upload. Check console for details.`,
          variant: "destructive",
        });
        console.log("Upload errors:", data.errors);
      }

      // Reset file input
      event.target.value = '';
      setSelectedFileSalesOrders(null);

    } catch (error) {
      console.error("Upload error:", error);

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });

      // Reset file input on error
      event.target.value = '';
      setSelectedFileSalesOrders(null);
    } finally {
      setIsUploadingSalesOrders(false);
    }
  };

  const importCardButtonClass =
    "w-full text-white border-white/50 bg-white/20 hover:bg-white/30 h-8 text-xs px-2";
  const importCardButtonGroupClass = "w-full flex flex-col gap-2";

  return (
    <div className="flex h-screen bg-gray-50">
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[1800px] mx-auto">
            <div className="space-y-8">
              {/* Import Masters Section */}
              <div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {displayedImportOptions.map((option, index) => {
                    const Icon = option.icon;
                    const isTallyImportCard = isTallyEnabled && option.endpoint;
                    return (
                      <Card
                        key={index}
                        className={`bg-gradient-to-br ${option.gradient} shadow-md border-0 cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group h-full ${importingMasters[option.action] ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                        onClick={() =>
                          isTallyImportCard &&
                          !importingMasters[option.action] &&
                          handleImportClick(option.action, option.title, option.endpoint, option.needsDateRange)
                        }
                      >
                        <CardContent className="p-4 text-white relative flex flex-col min-h-[220px] h-full">
                          {option.countKey ? (
                            <div className="absolute top-2 right-2 min-w-7 h-7 px-1.5 rounded-full bg-white/25 border border-white/40 text-white text-[10px] font-semibold flex items-center justify-center">
                              {COUNT_KEYS_EXCLUDED_FROM_PENDING_UI.has(option.countKey)
                                ? String(importCounts[option.countKey] ?? 0)
                                : parseImportCountNumeric(importCounts[option.countKey]) === 0
                                  ? "Pending"
                                  : String(parseImportCountNumeric(importCounts[option.countKey]))}
                            </div>
                          ) : null}
                          <div className="flex flex-col items-center text-center space-y-2.5 w-full flex-1">
                            <div className={`${option.bgColor} bg-opacity-30 p-2.5 rounded-full group-hover:scale-105 transition-transform duration-300`}>
                              <Icon className="h-6 w-6 animate-pulse" />
                            </div>
                            <div className="w-full">
                              <h3 className="text-sm font-semibold mb-1 leading-tight">{option.title}</h3>
                              <p className={`${option.textColor} text-xs leading-snug`}>{option.description}</p>
                            </div>
                            {isTallyEnabled ? (
                              <div className={`${importCardButtonGroupClass} mt-auto`}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={importingMasters[option.action]}
                                  className={`${importCardButtonClass} transition-all duration-300 ${
                                    importingMasters[option.action]
                                      ? "bg-white/10 cursor-not-allowed"
                                      : ""
                                  }`}
                                >
                                  {importingMasters[option.action] ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                      Importing...
                                    </>
                                  ) : (
                                    "Import Now"
                                  )}
                                </Button>
                              </div>
                            ) : option.action === "create-voucher" ? (
                              <div className={`${importCardButtonGroupClass} mt-auto`}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVoucherForm(getDefaultVoucherForm());
                                    setShowVoucherAdditional(false);
                                    setIsDisplayNameEdited(false);
                                    setIsVoucherFormOpen(true);
                                  }}
                                >
                                  Create Voucher
                                </Button>
                              </div>
                            ) : option.action === "unit-master" ? (
                              <div className={`${importCardButtonGroupClass} mt-auto`}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  disabled={isCreatingUnits}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedUnits([]);
                                    setIsUnitMasterDialogOpen(true);
                                  }}
                                >
                                  {isCreatingUnits ? "Importing..." : "Select Units"}
                                </Button>
                              </div>
                            ) : option.action === "stock-item-master" ? (
                              <div className={`${importCardButtonGroupClass} mt-auto`}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadTemplate(option.title, option.action);
                                  }}
                                >
                                  Download Template
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  disabled={staticUploadLoading[option.action]}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStockItemUploadChoiceOpen(true);
                                  }}
                                >
                                  {staticUploadLoading[option.action] ? "Uploading..." : "Upload File"}
                                </Button>
                                <input
                                  ref={stockItemExcelInputRef}
                                  type="file"
                                  accept=".xlsx,.xls"
                                  className="hidden"
                                  onChange={(event) => handleStaticFileUpload(option.action, event, "excel")}
                                />
                                <input
                                  ref={stockItemXmlInputRef}
                                  type="file"
                                  accept=".xml,application/xml,text/xml"
                                  className="hidden"
                                  onChange={(event) => handleStaticFileUpload(option.action, event, "xml")}
                                />
                              </div>
                            ) : option.action === "ledgers-file" ? (
                              <div className={`${importCardButtonGroupClass} mt-auto`}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadTemplate(option.title, option.action);
                                  }}
                                >
                                  Download Template
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  disabled={staticUploadLoading[option.action]}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLedgerUploadChoiceOpen(true);
                                  }}
                                >
                                  {staticUploadLoading[option.action] ? "Uploading..." : "Upload File"}
                                </Button>
                              </div>
                            ) : (
                              <div className={`${importCardButtonGroupClass} mt-auto`}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadTemplate(option.title, option.action);
                                  }}
                                >
                                  Download Template
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className={importCardButtonClass}
                                  disabled={staticUploadLoading[option.action]}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    document.getElementById(`static-upload-${option.action}`)?.click();
                                  }}
                                >
                                  {staticUploadLoading[option.action] ? "Uploading..." : "Upload File"}
                                </Button>
                                <input
                                  id={`static-upload-${option.action}`}
                                  type="file"
                                  accept=".xlsx,.xls"
                                  className="hidden"
                                  onChange={(event) => handleStaticFileUpload(option.action, event)}
                                />
                              </div>
                            )}
                            {!isTallyEnabled && staticUploads[option.action] ? (
                              <div className="w-full space-y-1 text-left">
                                <p className="text-xs text-white/90">Selected: {staticUploads[option.action]}</p>
                                {option.action === "current-stocks" &&
                                  Array.isArray(staticUploadResults?.[option.action]?.skipped_items_not_created) &&
                                  staticUploadResults[option.action].skipped_items_not_created.length > 0 ? (
                                  <p className="text-xs text-red-100">
                                    Skipped (not in stock master):{" "}
                                    {staticUploadResults[option.action].skipped_items_not_created
                                      .map((item) => item.stock_item_name)
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* File Upload Section */}
              {isTallyEnabled && <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">File Upload</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="shadow-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors duration-300">
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center animate-bounce">
                          <Upload className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Upload Stock Item Master
                          </h3>
                          <p className="text-gray-600 mb-3 text-sm">
                            Upload XML file containing stock item master data
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            Supported format: .xml (Max size: 300MB)
                          </p>
                        </div>
                        <div className="space-y-3">
                          {selectedFile && !isUploading && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-xs font-medium text-green-800">
                                  File selected: {selectedFile.name}
                                </span>
                              </div>
                            </div>
                          )}

                          {isUploading && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-xs font-medium text-blue-800">
                                  Uploading {selectedFile?.name}...
                                </span>
                              </div>
                            </div>
                          )}

                          <label
                            htmlFor="file-upload"
                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white transition-all duration-300 transform hover:scale-105 ${isUploading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 cursor-pointer'
                              }`}
                          >
                            {isUploading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Choose XML File
                              </>
                            )}
                          </label>
                          <input
                            id="file-upload"
                            type="file"
                            accept=".xml,text/xml,application/xml"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="hidden"
                          />
                          <p className="text-xs text-gray-500">
                            Or drag and drop your XML file here
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Add Ledgers File - Show only if customer_management permission exists */}
                  {/* {hasPermission("customer_management", "read") && (
                  <Card className="shadow-lg border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors duration-300">
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center animate-bounce">
                          <Upload className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Add Ledgers File
                          </h3>
                          <p className="text-gray-600 mb-3 text-sm">
                            Upload XML file containing ledgers master data
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            Supported format: .xml (Max size: 300MB)
                          </p>
                        </div>
                        <div className="space-y-3">
                          {selectedFileledger && !isUploadingledger && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-xs font-medium text-green-800">
                                  File selected: {selectedFileledger.name}
                                </span>
                              </div>
                            </div>
                          )}

                          {isUploadingledger && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-xs font-medium text-blue-800">
                                  Uploading {selectedFileledger?.name}...
                                </span>
                            </div>
                          </div>
                          )}

                          <Button
                            type="button"
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white transition-all duration-300 transform hover:scale-105 ${isUploadingledger
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                              }`}
                            disabled={isUploadingledger || staticUploadLoading["ledgers-file"]}
                            onClick={() => setLedgerUploadChoiceOpen(true)}
                          >
                            {isUploadingledger || staticUploadLoading["ledgers-file"] ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload File
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-gray-500">
                            Choose XML or Excel from the upload popup
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  )} */}

                  {/* Sales Orders Upload Card - Show only if sales_order permission exists */}
                  {/* {hasPermission("sales_order", "read") && (
                  <Card className="shadow-lg border-2 border-dashed border-purple-300 hover:border-purple-400 transition-colors duration-300">
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center animate-bounce">
                          <Upload className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Upload Sales Orders
                          </h3>
                          <p className="text-gray-600 mb-3 text-sm">
                            Upload DayBook.xml file containing sales order data
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            Supported format: .xml (Max size: 300MB)
                          </p>
                        </div>
                        <div className="space-y-3">
                          {selectedFileSalesOrders && !isUploadingSalesOrders && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-xs font-medium text-green-800">
                                  File selected: {selectedFileSalesOrders.name}
                                </span>
                              </div>
                            </div>
                          )}

                          {isUploadingSalesOrders && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-xs font-medium text-blue-800">
                                  Uploading {selectedFileSalesOrders?.name}...
                                </span>
                              </div>
                            </div>
                          )}

                          <label
                            htmlFor="sales-orders-file-upload"
                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white transition-all duration-300 transform hover:scale-105 ${isUploadingSalesOrders
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 cursor-pointer'
                              }`}
                          >
                            {isUploadingSalesOrders ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Choose XML File
                              </>
                            )}
                          </label>
                          <input
                            id="sales-orders-file-upload"
                            type="file"
                            accept=".xml,text/xml,application/xml"
                            onChange={handleSalesOrdersFileUpload}
                            disabled={isUploadingSalesOrders}
                            className="hidden"
                          />
                          <p className="text-xs text-gray-500">
                            Or drag and drop your XML file here
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  )} */}
                </div>
              </div>}

              
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Instructions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Master Data Import</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {isTallyEnabled ? (
                          <>
                            <li>• Click on any import card to start the process</li>
                            <li>• Import Ledgers fetches live data from Tally (Customer Management read required)</li>
                            <li>• Data will be synchronized with Tally automatically</li>
                            <li>• Existing records will be updated if duplicates found</li>
                            <li>• Import process runs in background</li>
                            <li>• Only XML format is supported</li>
                          </>
                        ) : (
                          <>
                            <li>• Unit Master: open Select Units and choose from default units (Kg, Qtl, Bags, etc.)</li>
                            <li>• Click Download Template for the required master (Excel)</li>
                            <li>• Fill data in the provided Excel format where applicable</li>
                            <li>• Upload using the Upload File button; for Stock Item Master, choose Excel or XML</li>
                            <li>• Duplicate names are checked in lowercase and skipped</li>
                            <li>• Excel (.xlsx/.xls) for most cards; Stock Item Master also accepts Tally-style XML</li>
                          </>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">{isTallyEnabled ? "XML File Upload Guidelines" : "Excel Upload Guidelines"}</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {isTallyEnabled ? (
                          <>
                            <li>• Ensure XML file structure is correct</li>
                            <li>• Upload will be processed immediately</li>
                            <li>• Stock Item Master: Upload inventory data</li>
                            <li>• Ledgers File: Upload accounting ledger data</li>
                            <li>• Sales Orders: Upload DayBook.xml with sales order data</li>
                          </>
                        ) : (
                          <>
                            <li>• Ensure required column names match template headers</li>
                            <li>• Unit Master: select units from the popup list and submit</li>
                            <li>• Godown Master: use godown_name column</li>
                            <li>• Stock Item Master Excel: item_name, stock_group, stock_category, base_unit, alternate_unit, conversion, gst_rate (or XML)</li>
                            <li>• Ledgers File: use ledger template columns as provided</li>
                            <li>• Current Stocks: use stock_item_name, balance, godown_name, batch_name columns</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <ImportPendingDialog
        open={showImportPendingPopup}
        pendingItems={pendingZeroImportItems}
        moduleStatuses={importModuleStatuses}
        onSkip={() => setImportPendingPopupDismissed(true)}
        showGoToImport={false}
      />

      <Dialog
        open={isUnitMasterDialogOpen}
        onOpenChange={(open) => {
          setIsUnitMasterDialogOpen(open);
          if (!open) setSelectedUnits([]);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Unit Master</DialogTitle>
            <DialogDescription>
              Select the measurement units to create in Unit Master. Existing units are skipped automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-sm text-gray-600">
              {selectedUnits.length} of {DEFAULT_UNIT_OPTIONS.length} selected
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSelectAllUnits}>
                Select All
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearUnitSelection}>
                Clear
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1 flex-1 min-h-0 max-h-[50vh]">
            {DEFAULT_UNIT_OPTIONS.map((unitName) => {
              const checked = selectedUnits.includes(unitName);
              return (
                <label
                  key={unitName}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    checked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleUnitSelection(unitName)}
                  />
                  <span className="font-medium">{unitName}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUnitMasterDialogOpen(false)}
              disabled={isCreatingUnits}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateUnitMasters}
              disabled={isCreatingUnits || selectedUnits.length === 0}
            >
              {isCreatingUnits ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Selected"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockItemUploadChoiceOpen} onOpenChange={setStockItemUploadChoiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Stock Item Master</DialogTitle>
            <DialogDescription>
              Choose how you want to upload. Excel uses the downloadable template; XML should follow the same
              Tally stock item export structure used for sync.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStockItemUploadChoiceOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStockItemUploadChoiceOpen(false);
                requestAnimationFrame(() => stockItemExcelInputRef.current?.click());
              }}
            >
              Excel (.xlsx / .xls)
            </Button>
            <Button
              type="button"
              className="bg-gray-800 hover:bg-gray-900"
              onClick={() => {
                setStockItemUploadChoiceOpen(false);
                requestAnimationFrame(() => stockItemXmlInputRef.current?.click());
              }}
            >
              XML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={ledgerExcelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => handleStaticFileUpload("ledgers-file", event, "excel")}
      />
      <input
        ref={ledgerXmlInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(event) => handleStaticFileUpload("ledgers-file", event, "xml")}
      />

      <Dialog open={ledgerUploadChoiceOpen} onOpenChange={setLedgerUploadChoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Ledgers</DialogTitle>
            <DialogDescription>
              Choose the file format for ledger upload.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start gap-2">
            <Button
              type="button"
              onClick={() => {
                setLedgerUploadChoiceOpen(false);
                ledgerXmlInputRef.current?.click();
              }}
            >
              Upload XML
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLedgerUploadChoiceOpen(false);
                ledgerExcelInputRef.current?.click();
              }}
            >
              Upload Excel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLedgerUploadChoiceOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading Overlays */}
      {isLoading && <Loader text="Loading import options..." />}
      {isAnyImportInProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Importing Master Data</h3>
            <p className="text-gray-600">Please wait while the data is being imported...</p>
          </div>
        </div>
      )}

      {!isTallyEnabled && isVoucherFormOpen ? (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Voucher</h3>
            <div className="space-y-4">
              <input
                className="border rounded px-3 py-2 text-sm w-full"
                placeholder="Voucher Name *"
                value={voucherForm.name}
                onChange={(e) => setVoucherForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowVoucherAdditional((prev) => !prev)}
              >
                {showVoucherAdditional ? "Hide Additional Info" : "Additional Info"}
              </Button>
              {showVoucherAdditional ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-md p-4 bg-gray-50">
                  <input
                    className="border rounded px-3 py-2 text-sm"
                    placeholder="Display Name (default: Voucher Name)"
                    value={voucherForm.display_name}
                    onChange={(e) => {
                      setIsDisplayNameEdited(true);
                      setVoucherForm((p) => ({ ...p, display_name: e.target.value }));
                    }}
                  />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Parent (default: Primary)" value={voucherForm.parent} onChange={(e) => setVoucherForm((p) => ({ ...p, parent: e.target.value }))} />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Source Alias" value={voucherForm.source_alias} onChange={(e) => setVoucherForm((p) => ({ ...p, source_alias: e.target.value }))} />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Destination Alias" value={voucherForm.destination_alias} onChange={(e) => setVoucherForm((p) => ({ ...p, destination_alias: e.target.value }))} />
                  <div className="flex flex-wrap gap-3 text-sm text-gray-700 md:col-span-2">
                    {[
                      ["is_active", "Active"],
                      ["allow_zero_stocks", "Allow Zero Stocks"],
                      ["is_batch", "Batch"],
                      ["is_batch_validation", "Batch Validation"],
                      ["add_bardan", "Add Bardan"],
                      ["add_bardan_only", "Add Bardan Only"],
                      ["in_source", "In Source"],
                      ["in_destination", "In Destination"],
                    ].map(([key, label]) => (
                      <label key={key} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(voucherForm[key])}
                          onChange={(e) => setVoucherForm((p) => ({ ...p, [key]: e.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setVoucherForm(getDefaultVoucherForm());
                  setShowVoucherAdditional(false);
                  setIsDisplayNameEdited(false);
                  setIsVoucherFormOpen(false);
                }}
                disabled={isCreatingVoucher}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateVoucher} disabled={isCreatingVoucher}>
                {isCreatingVoucher ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}