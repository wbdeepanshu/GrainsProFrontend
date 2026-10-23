import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import UserInfoCard from "@/components/dashboard/user-info-card";
import InwardEntriesMetrics from "@/components/dashboard/inward-entries-metrics";
import OutwardEntriesMetrics from "@/components/dashboard/outward-entries-metrics";
import VoucherTypesMetrics from "@/components/dashboard/voucher-types-metrics";
import RouteSummaryMetrics from "@/components/dashboard/route-summary-metrics";
import RecentActivity from "@/components/dashboard/recent-activity";
import StockSyncStatus from "@/components/dashboard/stock-sync-status";
import ReceiptSummary from "@/components/dashboard/receipt-summary";
import AdditionalMetrics from "@/components/dashboard/additional-metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Menu, Filter, Loader2, ChevronDown, ChevronUp, Mic, Plus, Calendar as CalendarIcon } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { initializePermissions } from "@/lib/permissionUtils";
import { getModulePermissions } from "@/lib/permissionUtils";
import { mergeOrgInfoFromDashboardPayload } from "@/lib/orgInfo";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import CommonLoader from "@/components/common/loader";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/notifications/NotificationBell";
import popUpNotAllowedEmoji from "@/assets/pop_up_not_allowed.png";
import {
  IMPORT_COUNT_KEYS_ZERO_PENDING,
  getPendingZeroImportItems,
  parseImportCountNumeric,
} from "@/lib/importCountsPending";
import { ImportPendingDialog } from "@/components/import/ImportPendingDialog";
// import { useVoiceAssistant } from "@/components/voice-assistant/SimpleVoiceAssistantProvider";
// import VoiceAssistantStatus from "@/components/voice-assistant/VoiceAssistantStatus";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const LOCATION_VALIDATION_API = `${API_BASE_URL}/api/validate-location/`;

/** Same rules as Import Data: Tally on unless stored user/org explicitly disables it. */
function isTallyEnabledFromStoredUser(): boolean {
  const userData = AuthService.getUserData() as
    | (Record<string, unknown> & {
        user_info?: { is_tally_enabled?: boolean | number | string };
        organization?: { is_tally_enabled?: boolean | number | string };
      })
    | null;
  if (!userData) return true;
  const raw =
    userData.is_tally_enabled ??
    userData.user_info?.is_tally_enabled ??
    userData.organization?.is_tally_enabled;
  if (
    raw === false ||
    raw === 0 ||
    raw === "0" ||
    raw === "false" ||
    raw === "False"
  ) {
    return false;
  }
  return true;
}

// Voice Assistant Button Component (temporarily disabled)
// const VoiceAssistantButton = () => {
//   const { openAssistant, isListening } = useVoiceAssistant();
//   
//   return (
//     <Button
//       onClick={openAssistant}
//       className={`w-10 h-10 rounded-full transition-all duration-200 ${
//         isListening 
//           ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
//           : "bg-blue-500 hover:bg-blue-600 text-white hover:scale-105"
//       }`}
//       title="Voice Assistant - Click to open or say 'Hey Assistant'"
//     >
//       <Mic className="h-4 w-4" />
//     </Button>
//   );
// };


interface DashboardAPIResponse {
  status: number;
  message: string;
  data: {
    date: string;
    user_info: {
      user_id: string;
      name: string;
      admin_id: string;
      role_id: number;
      role: string;
      is_admin: boolean;
      is_tally_enabled?: boolean;
      organization: string;
      branch: string;
      organization_address?: string;
      branch_address?: string;
      is_tracking_enabled?: boolean;
    };
    voucher_summary: {
      voucher_types: Array<{
        voucher_type_name: string;
        total_transaction_count: number;
        user_transaction_count: number;
        is_batch: boolean;
        is_bardan: boolean;
        in_source: boolean;
        in_destination: boolean;
        source_alias: string;
        destination_alias: string;
      }>;
      total_voucher_types: number;
      total_organization_transactions: number;
      total_user_transactions: number;
    };
    hamali_summary: {
      total_hamali_entries: number;
      total_hamali_amount: number;
      transfer_types: Array<{
        transfer_type: string;
        transfer_type_display: string;
      }>;
    };
    stock_items_summary: {
      is_synced: boolean;
      difference: number;
      tally_item_count: number;
      synced_item_count: number;
    };
    inward_entries_summary: {
      total_pending?: number;
      total_admin_approved?: number;
      rejected?: number;
      unloading_pending?: number;
      unloaded?: number;
      in_progress?: number;
      inward_completed?: number;
      error: null | string;
    };
    outward_entries_summary?: {
      gate_pass_count?: number;
      delivery_note_count?: number;
      total_count?: number;
      pending_count?: number;
      approved_count?: number;
      error: null | string;
    };
    sales_order_summary?: {
      total_count?: number;
      approved_count?: number;
      pending_count?: number;
      error: null | string;
    };
    receipts_summary?: {
      total_receipts: number;
      total_amount: number;
      error: null | string;
    };
    expense_summary?: {
      total_entries: number;
      total_amount: number;
      error: null | string;
    };
    ledger_summary?: {
      overall_count: number;
      not_synced_to_tally_count: number;
      error: null | string;
    };
    recent_activities: {
      activities: Array<{
        id: number;
        sync_module: string;
        description: string;
        sync_date: string;
        sync_by: string;
        branch: string;
      }>;
      error: string | null;
    };
    tally_running_status: boolean;
    route_summary?: {
      total_routes_assigned?: number;
      total_visits_completed?: number;
      total_visits_pending?: number;
      error: null | string;
    };
  };
  filters_applied: {
    date: string;
    branch: string;
  };
}

function DashboardContent() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isUserCardVisible, setIsUserCardVisible] = useState(false);
  const [locationRestrictionDialogOpen, setLocationRestrictionDialogOpen] = useState(false);
  const [locationRestrictionMessage, setLocationRestrictionMessage] = useState("");
  const [locationPermissionState, setLocationPermissionState] = useState<PermissionState | "unknown">("unknown");
  const isMobile = useIsMobile();
  const permissions = getModulePermissions('Inward');
  const permissionsStock = getModulePermissions('Stock Journals');
  const permissionsLoaded = usePermissions();
  const { hasReadPermission, hasPermission, isLoading: userPermissionsLoading } = useUserPermissions();
  const hasControlSettingsRead = hasReadPermission("control_settings");
  const hasSalesOrderOrOutwardPermission = hasReadPermission("sales_order") || hasReadPermission("outward");
  const hasReceiptRead = hasReadPermission("receipt_management");
  const hasExpenseRead =
    hasReadPermission("expense_management") || hasReadPermission("expense");
  const hasRouteManagementRead = hasPermission("route_management", "read");
  const showReceiptExpenseSummary = hasReceiptRead || hasExpenseRead;
  const userCardRef = useRef<HTMLDivElement>(null);
  const isLocationValidationInProgress = useRef(false);

  // Initialize permissions when dashboard loads
  useEffect(() => {
    initializePermissions();
  }, []);

  const getCurrentLocation = async (): Promise<GeolocationPosition> => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by this browser.");
    }

    const getPosition = (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    const getPositionByWatch = (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        let watchId: number | null = null;
        const timeoutId = window.setTimeout(() => {
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
          }
          reject({ code: 3, message: "Location watch timed out." } as GeolocationPositionError);
        }, options.timeout ?? 15000);

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            window.clearTimeout(timeoutId);
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
            }
            resolve(position);
          },
          (error) => {
            window.clearTimeout(timeoutId);
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
            }
            reject(error);
          },
          options
        );
      });

    try {
      // First attempt: accurate and fresh.
      return await getPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      });
    } catch (firstError) {
      console.warn("[dashboard-location-validation] getCurrentPosition(high-accuracy) failed:", firstError);
      try {
        // Fallback attempt: relaxed settings for devices/browsers that fail strict mode.
        return await getPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      } catch (secondError) {
        console.warn("[dashboard-location-validation] getCurrentPosition(relaxed) failed:", secondError);
        // Final fallback: watchPosition is sometimes more reliable than getCurrentPosition.
        return await getPositionByWatch({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 120000,
        });
      }
    }
  };

  const validateDashboardUserLocation = async () => {
    if (isLocationValidationInProgress.current) return;
    if (!AuthService.getAccessToken()) return;
    isLocationValidationInProgress.current = true;

    try {
      const statusResponse = await fetch(LOCATION_VALIDATION_API, {
        method: "POST",
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (statusResponse.status === 401) return;

      const statusData = await statusResponse.json().catch(() => ({}));
      const isLocationRestriction = Boolean(
        statusData?.is_location_restriction ?? statusData?.data?.is_location_restriction
      );
      // console.log("[dashboard-location-validation] restriction-status-response:", statusData);

      if (!isLocationRestriction) {
        setLocationRestrictionDialogOpen(false);
        setLocationRestrictionMessage("");
        return;
      }

      const permissionApi = (navigator as Navigator & {
        permissions?: {
          query: (params: { name: PermissionName }) => Promise<{ state: PermissionState }>;
        };
      }).permissions;
      if (permissionApi?.query) {
        const permissionStatus = await permissionApi.query({ name: "geolocation" });
        setLocationPermissionState(permissionStatus.state);
        //console.log("[dashboard-location-validation] geolocation-permission-state:", permissionStatus.state);

        if (permissionStatus.state !== "granted") {
          setLocationRestrictionMessage(
            "Location permission is required to continue. Click Retry, then allow location access in the browser prompt."
          );
          setLocationRestrictionDialogOpen(true);
          return;
        }
      }

      // Permission already granted -> validate silently in background.
      let position: GeolocationPosition;
      try {
        position = await getCurrentLocation();
        // console.log("[dashboard-location-validation] auto current-coordinates:", {
        //   lat: position.coords.latitude,
        //   long: position.coords.longitude,
        // });
      } catch (geoError) {
        console.error("Auto location fetch failed for restriction validation:", geoError);
        setLocationRestrictionMessage(
          "Location validation is required. Click Retry to verify your current location."
        );
        setLocationRestrictionDialogOpen(true);
        return;
      }

      const validationResponse = await fetch(LOCATION_VALIDATION_API, {
        method: "POST",
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({
          lat: String(position.coords.latitude),
          long: String(position.coords.longitude),
        }),
        credentials: "include",
      });

      const validationData = await validationResponse.json().catch(() => ({}));
      const validationStatus = Number(validationData?.status ?? validationResponse.status);
      //console.log("[dashboard-location-validation] auto coordinate-validation-response:", validationData);

      if (validationStatus === 403) {
        const blockedMessage =
          validationData?.message ||
          "You can nnot login the GrainsPro from this location. try using app from the branches";
        setLocationRestrictionMessage(blockedMessage);
        setLocationRestrictionDialogOpen(true);
        return;
      }

      setLocationRestrictionDialogOpen(false);
      setLocationRestrictionMessage("");
    } catch (error) {
      console.error("Error validating login location in dashboard:", error);
    } finally {
      isLocationValidationInProgress.current = false;
    }
  };

  const handleRetryLocationValidation = async () => {
    if (isLocationValidationInProgress.current) return;
    isLocationValidationInProgress.current = true;

    try {
      let position: GeolocationPosition;
      try {
        position = await getCurrentLocation();
        // console.log("[dashboard-location-validation] current-coordinates:", {
        //   lat: position.coords.latitude,
        //   long: position.coords.longitude,
        // });
      } catch (geoError) {
        console.error("Location fetch failed for restriction validation:", geoError);
        const geoCode = (geoError as GeolocationPositionError)?.code;
        const geoMessage =
          geoCode === 1
            ? "Location permission is denied. Please click the lock icon in the address bar, allow Location for this site, then click Retry."
            : geoCode === 2
            ? "Location is unavailable right now. Please turn on device location service/GPS and click Retry."
            : geoCode === 3
            ? "Location request timed out. Please ensure location service is on and click Retry."
            : "Location access is required to continue. Please allow browser location permission and click Retry.";
        setLocationRestrictionMessage(geoMessage);
        setLocationRestrictionDialogOpen(true);
        return;
      }

      const validationResponse = await fetch(LOCATION_VALIDATION_API, {
        method: "POST",
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({
          lat: String(position.coords.latitude),
          long: String(position.coords.longitude),
        }),
        credentials: "include",
      });

      const validationData = await validationResponse.json().catch(() => ({}));
      const validationStatus = Number(validationData?.status ?? validationResponse.status);
      // console.log("[dashboard-location-validation] coordinate-validation-response:", validationData);

      if (validationStatus === 403) {
        const blockedMessage =
          validationData?.message ||
          "You can nnot login the GrainsPro from this location. try using app from the branches";
        setLocationRestrictionMessage(blockedMessage);
        setLocationRestrictionDialogOpen(true);
        return;
      }

      setLocationRestrictionDialogOpen(false);
      setLocationRestrictionMessage("");
    } catch (error) {
      console.error("Error validating location on retry:", error);
    } finally {
      isLocationValidationInProgress.current = false;
    }
  };

  const handleLocationRestrictionLogout = async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error("Error during location restriction logout:", error);
    } finally {
      window.location.href = "/login";
    }
  };

  // Run in background whenever dashboard is opened/returned to visible.
  useEffect(() => {
    void validateDashboardUserLocation();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void validateDashboardUserLocation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Handle click outside to close user card
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userCardRef.current && !userCardRef.current.contains(event.target as Node)) {
        setIsUserCardVisible(false);
      }
    };

    if (isUserCardVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserCardVisible]);

  const dashboardObjects = [
    "date",
    "user_info",
    "voucher_summary",
    "hamali_summary",
    "stock_items_summary",
    "inward_entries_summary",
    "receipts_summary",
    "expense_summary",
    "recent_activities",
    "outward_entries_summary",
    "route_summary",
  ] as const;

  const dashboardModuleQueries = useQueries({
    queries: dashboardObjects.map((objectName) => ({
      queryKey: [`${API_BASE_URL}/api/dashboard-data/`, objectName, selectedDate],
      queryFn: async () => {
        const response = await apiRequest("POST", `${API_BASE_URL}/api/dashboard-data/`, {
          object_name: objectName,
          date: selectedDate,
        });
        const res = await response.json();
        return res;
      },
      enabled:
        !!AuthService.getAccessToken() &&
        !userPermissionsLoading &&
        (objectName !== "receipts_summary" || hasReceiptRead) &&
        (objectName !== "expense_summary" || hasExpenseRead) &&
        (objectName !== "route_summary" || hasRouteManagementRead),
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = dashboardModuleQueries.some((query) => query.isLoading);
  const errorQuery = dashboardModuleQueries.find((query) => query.error);
  const error = errorQuery?.error as Error | null;

  const dashboardModuleDataMap = useMemo(() => {
    const map: Record<string, any> = {};
    dashboardModuleQueries.forEach((query, idx) => {
      const key = dashboardObjects[idx];
      map[key] = query.data?.data?.[key];
      if (key === "stock_items_summary" && query.data?.data?.tally_running_status !== undefined) {
        map.tally_running_status = query.data.data.tally_running_status;
      }
    });
    return map;
  }, [dashboardModuleQueries]);

  useEffect(() => {
    dashboardModuleQueries.forEach((query) => {
      if (query.data) {
        mergeOrgInfoFromDashboardPayload(query.data);
      }
    });
  }, [dashboardModuleQueries]);

  const dashboardData = useMemo(() => {
    const baseData = {
      date: dashboardModuleDataMap.date ?? format(new Date(selectedDate), "dd-MM-yyyy"),
      user_info: dashboardModuleDataMap.user_info ?? null,
      voucher_summary: dashboardModuleDataMap.voucher_summary ?? null,
      hamali_summary: dashboardModuleDataMap.hamali_summary ?? null,
      stock_items_summary: dashboardModuleDataMap.stock_items_summary ?? null,
      inward_entries_summary: dashboardModuleDataMap.inward_entries_summary ?? null,
      outward_entries_summary: dashboardModuleDataMap.outward_entries_summary ?? null,
      receipts_summary: dashboardModuleDataMap.receipts_summary ?? null,
      expense_summary: dashboardModuleDataMap.expense_summary ?? null,
      recent_activities: dashboardModuleDataMap.recent_activities ?? null,
      route_summary: dashboardModuleDataMap.route_summary ?? null,
      tally_running_status: dashboardModuleDataMap.tally_running_status ?? false,
    };

    return {
      status: 200,
      message: "Dashboard data retrieved successfully",
      data: baseData,
      filters_applied: {
        date: selectedDate,
        branch: "",
      },
    } as DashboardAPIResponse;
  }, [dashboardModuleDataMap, selectedDate]);

  const refetchAll = () => {
    dashboardModuleQueries.forEach((query) => query.refetch());
  };
  
  // Get user role from dashboard data or localStorage
  const userRole = dashboardData?.data?.user_info?.role || (() => {
    try {
      const userDataStr = localStorage.getItem('cp_manager_user_data');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        return userData?.role || '';
      }
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
    }
    return '';
  })();
  
  // Check if user is Lab Tech (case-insensitive)
  const isLabTech = userRole?.toLowerCase() === 'lab tech' || userRole?.toLowerCase() === 'labtech' || userRole?.toLowerCase()?.includes('lab tech');

  // Do not wait for /api/dashboard/: import-counts should run right after login (token + stored user).
  // If dashboard later returns user_info.is_tally_enabled === false, turn Tally features off.
  const dashboardTallyExplicitlyOff =
    dashboardData?.data?.user_info != null &&
    dashboardData.data.user_info.is_tally_enabled === false;
  const isTallyEnabled =
    isTallyEnabledFromStoredUser() && !dashboardTallyExplicitlyOff;

  const [importPendingDismissed, setImportPendingDismissed] = useState(false);

  // import-counts only when user has Control Settings read permission.
  const importCountsQueryEnabled =
    !!AuthService.getAccessToken() &&
    !userPermissionsLoading &&
    hasControlSettingsRead;

  const { data: importCountsData, isSuccess: importCountsQuerySuccess } = useQuery({
    queryKey: [`${API_BASE_URL}/api/import-counts/`],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/import-counts/`);
      const result = await response.json();
      if (result?.status === 200 && result?.data) {
        return result.data as Record<string, number | string>;
      }
      return null;
    },
    enabled: importCountsQueryEnabled,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 30 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const pendingZeroImportItems = useMemo(() => {
    if (!importCountsQuerySuccess || !importCountsData) return [];
    return getPendingZeroImportItems(importCountsData);
  }, [importCountsQuerySuccess, importCountsData]);

  const importModuleStatuses = useMemo(() => {
    if (!importCountsQuerySuccess || !importCountsData) return [];
    return IMPORT_COUNT_KEYS_ZERO_PENDING.map(({ key, label }) => {
      const value = importCountsData[key] ?? 0;
      return {
        key,
        label,
        value,
        pending: parseImportCountNumeric(value) === 0,
      };
    });
  }, [importCountsQuerySuccess, importCountsData]);

  useEffect(() => {
    if (pendingZeroImportItems.length === 0) {
      setImportPendingDismissed(false);
    }
  }, [pendingZeroImportItems.length]);

  const showImportPendingPopup =
    hasControlSettingsRead &&
    importCountsQuerySuccess &&
    importCountsData != null &&
    pendingZeroImportItems.length > 0 &&
    !importPendingDismissed;

  const handleDateChange = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(format(date, 'yyyy-MM-dd'));
  };

  if (!permissionsLoaded) {
    return <CommonLoader text="Loading permissions..." />;
  }


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
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 sm:flex sm:items-center sm:justify-between min-w-0">
            <div className="flex items-center min-w-0 col-start-1 row-start-1">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-2 shrink-0"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Dashboard</h1>
            </div>

            <div className="col-start-2 row-start-1 flex items-center gap-2 justify-end shrink-0 sm:order-last">
              <NotificationBell className="text-gray-700 hover:bg-blue-100 hover:text-gray-900 bg-blue-50 border border-blue-200 rounded-full shadow-md shrink-0" />

              <div className="relative shrink-0" ref={userCardRef}>
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 sm:px-2 py-1 rounded-lg transition-colors duration-200"
                  onClick={() => setIsUserCardVisible(!isUserCardVisible)}
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-black to-gray-600 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {dashboardData?.data?.user_info?.name?.split(" ").map((n) => n[0]).join("") || "U"}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[8rem] truncate">
                    {dashboardData?.data?.user_info?.name || "User"}
                  </span>
                  {isUserCardVisible ? (
                    <ChevronUp className="h-4 w-4 text-gray-500 hidden sm:block shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500 hidden sm:block shrink-0" />
                  )}
                </div>

                {isUserCardVisible && (
                  <UserInfoCard
                    user={dashboardData?.data?.user_info}
                    tallyRunning={dashboardData?.data?.tally_running_status}
                  />
                )}
              </div>
            </div>

            <div className="col-span-2 row-start-2 flex items-center gap-2 min-w-0 sm:col-span-1 sm:row-start-1 sm:flex-1 sm:justify-end">
              {isTallyEnabled && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-gray-50 to-gray-100 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-gray-200 shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      dashboardData?.data?.tally_running_status ? "bg-green-500" : "bg-red-500"
                    } animate-pulse`}
                  />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                    Tally: {dashboardData?.data?.tally_running_status ? "Running" : "Stopped"}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none sm:shrink-0">
                <Label htmlFor="dateFilter" className="sr-only">
                  Filter by date
                </Label>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 font-normal text-sm min-w-0",
                        isMobile ? "flex-1 justify-start px-2.5" : "w-40 justify-start text-left shrink-0"
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0 text-gray-500" />
                      <span className="truncate text-xs sm:text-sm">
                        {selectedDate
                          ? format(new Date(selectedDate), isMobile ? "dd/MM/yy" : "dd-MM-yyyy")
                          : format(new Date(), isMobile ? "dd/MM/yy" : "dd-MM-yyyy")}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(selectedDate)}
                      onSelect={(date) => {
                        handleDateChange(date);
                        setIsDatePickerOpen(false);
                      }}
                      disabled={{ after: new Date() }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-600 shrink-0" />}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">
                  <p className="text-lg font-semibold">Failed to load dashboard data</p>
                  <p className="text-sm">{error.message}</p>
                </div>
                <Button onClick={refetchAll} variant="outline">
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Inward Entries Metrics */}
                {dashboardData?.data?.inward_entries_summary && (
                  <InwardEntriesMetrics data={dashboardData?.data?.inward_entries_summary} selectedDate={selectedDate} />
                )}
                {/* Outward Entries Metrics - show when data exists; component shows boxes by permission (sales_order R / outward R) */}
                {dashboardData?.data?.outward_entries_summary && (
                  <OutwardEntriesMetrics 
                    data={dashboardData?.data?.outward_entries_summary} 
                    selectedDate={selectedDate}
                  />
                )}
                {/* Voucher Types Metrics */}
                {permissionsStock.canRead && (<VoucherTypesMetrics data={dashboardData?.data?.voucher_summary} selectedDate={selectedDate} />)
                }
                {/* Route Summary — route_management read permission (same as sidebar) */}
                {hasRouteManagementRead && dashboardData?.data?.route_summary != null && (
                  <RouteSummaryMetrics
                    data={dashboardData.data.route_summary}
                    selectedDate={selectedDate}
                  />
                )}
                {/* Charts and Stats - Recent Activity, Stock Synchronization, and Receipt Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <RecentActivity data={dashboardData?.data?.recent_activities} />
                  {isTallyEnabled && (
                    <StockSyncStatus data={dashboardData?.data?.stock_items_summary} />
                  )}
                  {showReceiptExpenseSummary && (
                    <div className="min-w-0">
                    <ReceiptSummary 
                      data={hasReceiptRead ? dashboardData?.data?.receipts_summary : undefined}
                      showReceiptSummary={hasReceiptRead}
                      showLedgerSummary={false}
                      expenseData={hasExpenseRead ? dashboardData?.data?.expense_summary : undefined}
                      showExpenseSummary={hasExpenseRead}
                    />
                    </div>
                  )}
                </div>

                {/* Additional Metrics */}
                <AdditionalMetrics
                  data={dashboardData?.data?.hamali_summary}
                  selectedDate={selectedDate}
                />
                
                {/* Voice Assistant Demo Section (temporarily disabled) */}
                {/* <div className="mt-8">
                  <VoiceAssistantTest />
                </div> */}
              </div>
            )}
          </div>
        </main>
      </div>

      <ImportPendingDialog
        open={showImportPendingPopup}
        pendingItems={pendingZeroImportItems}
        moduleStatuses={importModuleStatuses}
        onSkip={() => setImportPendingDismissed(true)}
        showGoToImport
      />

      <Dialog open={locationRestrictionDialogOpen} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-lg rounded-2xl border-0 shadow-2xl p-0 overflow-hidden [&>button]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border-b border-red-100 px-6 py-3">
            <DialogHeader>
              <DialogTitle className="text-red-700 text-2xl flex items-center justify-center text-center">
                Location Access Restricted
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4 bg-white">
            <div className="flex justify-center">
              <img
                src={popUpNotAllowedEmoji}
                alt="Location restricted"
                className="h-32 w-32 object-contain"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <DialogDescription className="m-0">
              <span className="block rounded-xl bg-white border border-red-200 text-red-900 px-4 py-4 text-[20px] leading-relaxed font-semibold shadow-sm">
                {locationRestrictionMessage}
              </span>

            </DialogDescription>
          </div>

          <div className="px-6 pb-5 flex justify-end gap-2 bg-white">
            <Button
              variant="destructive"
              className="rounded-xl px-6 h-11 font-semibold shadow-md"
              onClick={() => {
                void handleLocationRestrictionLogout();
              }}
            >
              Logout
            </Button>
            <Button
              variant="default"
              className="rounded-xl px-6 h-11 font-semibold shadow-md"
              onClick={() => {
                void handleRetryLocationValidation();
              }}
            >
              Retry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
  // Temporarily disabled voice assistant provider
  // return (
  //   <VoiceAssistantProvider>
  //     <DashboardContent />
  //   </VoiceAssistantProvider>
  // );
}
