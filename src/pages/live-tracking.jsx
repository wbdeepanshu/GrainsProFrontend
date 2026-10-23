import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import LiveRouteMap from "@/components/live-tracking/GoogleLiveRouteMap";
import CommonLoader from "@/components/common/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  fetchLiveTrackingCoordinates,
  fetchLiveTrackingHistory,
  fetchTrackingRoadRoute,
  fetchUserDailyRoute,
  LIVE_TRACKING_REFRESH_MS,
  parseCoordinate,
  ROUTE_DISPLAY_MODES,
  ROUTE_DISPLAY_OPTIONS,
  todayInputDate,
} from "@/lib/liveTrackingApi";
import {
  buildRouteSummary,
  distanceKm,
  formatDuration,
  formatStartClock,
  formatTrackingAddress,
  formatTrackingTime,
} from "@/lib/liveTrackingMapUtils";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Menu,
  Navigation,
  RefreshCw,
  Route,
  User,
  X,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const USER_COLOR = "#dc2626";

function RouteStat({ label, value }) {
  return (
    <div className="rounded-md border border-gray-100 bg-white p-1.5">
      <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function RouteActivitiesPanel({ activities = [], summary, isLoading }) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-slate-500">
        Loading route activities...
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-3 text-xs text-slate-500">
        No route activities recorded for this user on the selected date.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Route activities
        </p>
        <span className="text-[11px] text-slate-500">
          {summary?.total_activities ?? activities.length} visits
        </span>
      </div>
      <ol className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {activities.map((activity, index) => (
          <li key={activity.id ?? `${activity.customer_id}-${index}`} className="flex gap-2.5">
            <div className="flex flex-col items-center pt-1">
              <span className="h-5 w-5 rounded-full shrink-0 bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center">
                {index + 1}
              </span>
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {activity.route_name || "Route"}
              </p>
              <p className="text-[11px] text-slate-700 truncate">
                {activity.customer_name || "Customer"}
                {activity.activity_name ? ` · ${activity.activity_name}` : ""}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatTrackingTime(activity.visit_date)}
              </p>
              {activity.approval_status ? (
                <p className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                  {activity.approval_status}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TrackingUserCard({
  tracking,
  fallbackUser,
  route,
  routeLoading,
  historyPoints = [],
  color,
}) {
  const name =
    tracking?.user_name ||
    tracking?.user?.name ||
    fallbackUser?.name ||
    `User #${tracking?.user_id || fallbackUser?.user_id || ""}`;
  const branch = tracking?.user?.branch || fallbackUser?.branch_name || "—";
  const lat = tracking?.lat;
  const lng = tracking?.long ?? tracking?.lng;
  const address = formatTrackingAddress(tracking?.address);
  const hasCoords = parseCoordinate(lat) != null && parseCoordinate(lng) != null;
  const displayedCoordinates = historyPoints.length
    ? historyPoints
    : hasCoords
      ? [{ lat, lng, recorded_at: tracking?.updated_at }]
      : [];

  return (
    <div className="w-full text-left rounded-lg border border-blue-200 bg-white p-2.5 space-y-2.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white"
          style={{ backgroundColor: color }}
        >
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
          <p className="text-[11px] text-slate-500 truncate">{branch}</p>
        </div>
      </div>

      {displayedCoordinates.length ? (
        <div className="rounded-md border border-gray-100 bg-slate-50/80 p-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Coordinates ({displayedCoordinates.length})
          </p>
          <ol className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {displayedCoordinates.map((point, index) => (
              <li
                key={point.id ?? `${point.recorded_at ?? "location"}-${index}`}
                className="flex items-start justify-between gap-2 border-b border-gray-100 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="shrink-0 text-[10px] text-slate-400">{index + 1}.</span>
                <span className="min-w-0 flex-1 break-all text-xs font-semibold tabular-nums text-slate-900">
                  {point.lat}, {point.lng}
                </span>
                {point.recorded_at ? (
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {formatTrackingTime(point.recorded_at)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-200 bg-slate-50 p-2 text-[11px] text-slate-500">
          No location data available for this user.
        </div>
      )}

      {address ? (
        <div className="rounded-md border border-gray-100 bg-slate-50/80 p-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-0.5">
            Address
          </p>
          <p className="text-xs text-slate-700 break-words">{address}</p>
        </div>
      ) : null}

      {routeLoading ? (
        <div className="rounded-md border border-gray-100 bg-slate-50/80 p-2 text-[11px] text-slate-500">
          Loading travelled route...
        </div>
      ) : route?.hasRoute ? (
        <div className="rounded-md border border-gray-100 bg-slate-50/80 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <Route className="h-3 w-3" style={{ color }} />
            Travelled route
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <RouteStat label="Distance" value={`${route.distanceKm.toFixed(2)} km`} />
            <RouteStat label="Start Time" value={formatStartClock(route.startTime)} />
            <RouteStat label="End Time" value={formatStartClock(route.endTime)} />
            <RouteStat label="Duration" value={formatDuration(route.totalDurationSeconds)} />
            <RouteStat label="Points" value={route.points.length} />
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-200 bg-slate-50 p-2 text-[11px] text-slate-500">
          No travelled route recorded for the selected date.
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-0.5 border-t border-gray-100">
        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span>Last updated: {formatTrackingTime(tracking?.updated_at)}</span>
      </div>
    </div>
  );
}

export default function LiveTracking() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [routeDate, setRouteDate] = useState(() => todayInputDate());
  const [routeDisplayMode, setRouteDisplayMode] = useState(ROUTE_DISPLAY_MODES.COORDINATE);

  const { hasReadPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead = hasReadPermission("route_management");

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["live-tracking-branches"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-branches/`);
      const payload = await response.json();
      if (payload?.status === 200 && Array.isArray(payload.data)) return payload.data;
      return Array.isArray(payload) ? payload : [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["live-tracking-users"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-users/?type=location_tracking`);
      const payload = await response.json();
      if (payload?.status === 200 && Array.isArray(payload.data)) return payload.data;
      return [];
    },
    enabled: !!AuthService.getAccessToken() && canRead,
  });

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(selectedBranchId)) || null,
    [branches, selectedBranchId],
  );

  const branchUsers = useMemo(() => {
    if (!selectedBranchId) return [];
    const branchName = selectedBranch?.name;
    return users
      .filter((user) => {
        if (user.branch_id != null && String(user.branch_id) !== "") {
          return String(user.branch_id) === String(selectedBranchId);
        }
        if (branchName && user.branch_name) {
          return String(user.branch_name).trim() === String(branchName).trim();
        }
        return false;
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [users, selectedBranchId, selectedBranch]);

  const selectedUser = useMemo(
    () => branchUsers.find((user) => user.user_id === selectedUserId) || null,
    [branchUsers, selectedUserId],
  );

  const today = todayInputDate();
  const isToday = routeDate === today;
  const hasActiveFilters =
    Boolean(selectedBranchId) || Boolean(selectedUserId) || routeDate !== today;

  const clearFilters = () => {
    setSelectedBranchId("");
    setSelectedUserId("");
    setRouteDate(today);
  };

  const {
    data: liveData,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["live-tracking", selectedUserId],
    queryFn: () => fetchLiveTrackingCoordinates(selectedUserId),
    enabled: Boolean(selectedUserId) && canRead,
    staleTime: 0,
    refetchInterval: selectedUserId && isToday ? LIVE_TRACKING_REFRESH_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const {
    data: routeData,
    isLoading: routeLoading,
    isFetching: routeFetching,
    refetch: refetchRoute,
  } = useQuery({
    queryKey: ["user-daily-route", selectedUserId, routeDate],
    queryFn: () => fetchUserDailyRoute({ userId: selectedUserId, date: routeDate }),
    enabled: Boolean(selectedUserId && routeDate) && canRead,
    staleTime: 0,
    refetchInterval: selectedUserId && isToday ? LIVE_TRACKING_REFRESH_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const {
    data: trackingHistoryData,
    isLoading: trackingHistoryLoading,
    refetch: refetchTrackingHistory,
  } = useQuery({
    queryKey: ["live-tracking-history", selectedUserId, routeDate],
    queryFn: () => fetchLiveTrackingHistory({ userId: selectedUserId, date: routeDate }),
    enabled: Boolean(selectedUserId && routeDate) && canRead,
    staleTime: 0,
    refetchInterval: selectedUserId && isToday ? LIVE_TRACKING_REFRESH_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const tracking = useMemo(() => {
    const raw = liveData?.data;
    if (!raw) return null;
    const rows = Array.isArray(raw) ? raw : [raw];
    return (
      rows.find(
        (row) => String(row.user_id || row.user?.user_id || "") === String(selectedUserId),
      ) || rows[0] || null
    );
  }, [liveData, selectedUserId]);

  const trackingHistoryPoints = useMemo(() => {
    const rows = trackingHistoryData?.data;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((sample) => {
        const lat = parseCoordinate(sample.lat);
        const lng = parseCoordinate(sample.long ?? sample.lng);
        if (lat == null || lng == null) return null;
        return {
          ...sample,
          lat,
          lng,
          from_time: sample.recorded_at,
          to_time: sample.recorded_at,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = new Date(a.recorded_at).getTime();
        const bTime = new Date(b.recorded_at).getTime();
        if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return 0;
        return aTime - bTime;
      });
  }, [trackingHistoryData]);

  const trackingHistoryRoute = useMemo(() => {
    if (!trackingHistoryPoints.length) return null;
    const firstTime = new Date(trackingHistoryPoints[0].recorded_at).getTime();
    const lastTime = new Date(
      trackingHistoryPoints[trackingHistoryPoints.length - 1].recorded_at,
    ).getTime();
    return {
      hasRoute: true,
      points: trackingHistoryPoints,
      distanceKm: distanceKm(trackingHistoryPoints),
      totalDurationSeconds:
        Number.isFinite(firstTime) && Number.isFinite(lastTime)
          ? Math.max(0, Math.floor((lastTime - firstTime) / 1000))
          : 0,
      startTime: trackingHistoryPoints[0].recorded_at,
      endTime: trackingHistoryPoints[trackingHistoryPoints.length - 1].recorded_at,
    };
  }, [trackingHistoryPoints]);

  const baseRouteSummary = useMemo(() => buildRouteSummary(routeData), [routeData]);

  const historyPointsForDirections = useMemo(() => {
    const points =
      trackingHistoryPoints.length > 1
        ? trackingHistoryPoints
        : baseRouteSummary?.points || [];
    return points
      .map((point) => ({ lat: point.lat, lng: point.lng }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }, [baseRouteSummary, trackingHistoryPoints]);

  const directionsFingerprint = useMemo(() => {
    const points = historyPointsForDirections;
    if (points.length < 2) return "";
    const first = points[0];
    const last = points[points.length - 1];
    return `${points.length}:${first.lat.toFixed(5)},${first.lng.toFixed(5)}:${last.lat.toFixed(5)},${last.lng.toFixed(5)}`;
  }, [historyPointsForDirections]);

  const {
    data: roadRouteData,
    isFetching: roadRouteFetching,
    error: roadRouteError,
  } = useQuery({
    queryKey: ["tracking-road-route", selectedUserId, routeDate, directionsFingerprint],
    queryFn: () => fetchTrackingRoadRoute(historyPointsForDirections),
    enabled: Boolean(
      selectedUserId &&
        directionsFingerprint &&
        historyPointsForDirections.length >= 2 &&
        routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE,
    ),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const googleRoadPath = useMemo(() => {
    const raw = roadRouteData?.data?.path;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((point) => ({
        lat: Number(point.lat),
        lng: Number(point.lng ?? point.long),
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }, [roadRouteData]);

  const trackingHistorySummary = useMemo(() => {
    if (!trackingHistoryRoute) return null;
    const useRoadDistance =
      routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE && googleRoadPath.length > 1;
    return {
      ...trackingHistoryRoute,
      distanceKm: useRoadDistance
        ? distanceKm(googleRoadPath)
        : trackingHistoryRoute.distanceKm,
    };
  }, [trackingHistoryRoute, routeDisplayMode, googleRoadPath]);

  const routeSummary = useMemo(() => {
    if (!baseRouteSummary) return null;

    const preferRoad =
      routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE && googleRoadPath.length > 1;
    if (preferRoad) {
      const roadKm = distanceKm(googleRoadPath);
      return {
        ...baseRouteSummary,
        distanceKm: roadKm > 0 ? roadKm : baseRouteSummary.distanceKm,
        roadPath: googleRoadPath,
        pathSource: roadRouteData?.data?.source || "google_directions",
      };
    }
    return baseRouteSummary;
  }, [baseRouteSummary, googleRoadPath, routeDisplayMode, roadRouteData]);

  const selectedUserName =
    tracking?.user_name || tracking?.user?.name || selectedUser?.name || "";

  const mapPoints = useMemo(() => {
    if (!isToday || !selectedUserId) return [];
    const lat = parseCoordinate(tracking?.lat);
    const lng = parseCoordinate(tracking?.long ?? tracking?.lng);
    if (lat == null || lng == null) return [];
    return [
      {
        userId: String(selectedUserId),
        lat,
        lng,
        label: selectedUserName || String(selectedUserId),
        address: formatTrackingAddress(tracking?.address),
        color: USER_COLOR,
      },
    ];
  }, [isToday, selectedUserId, tracking, selectedUserName]);

  const mapRoutes = useMemo(() => {
    if (!selectedUserId) return [];
    const routes = [];
    if (routeSummary && trackingHistoryPoints.length < 2) {
      const coordinatePath = routeSummary.mapPath || [];
      const polylineSegments =
        routeDisplayMode === ROUTE_DISPLAY_MODES.POLYLINE && routeSummary.pathSegments?.length
          ? routeSummary.pathSegments
          : [];
      const polylinePath =
        routeSummary.polylinePath?.length > 1 ? routeSummary.polylinePath : coordinatePath;
      const roadPath = googleRoadPath.length > 1 ? googleRoadPath : routeSummary.roadPath || [];

      const displayPath =
        routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE
          ? roadPath.length > 1
            ? roadPath
            : coordinatePath
          : polylineSegments.length
            ? polylineSegments[0]
            : polylinePath;
      const pathSegments =
        routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE
          ? roadPath.length > 1
            ? [roadPath]
            : coordinatePath.length > 1
              ? [coordinatePath]
              : []
          : polylineSegments.length
            ? polylineSegments
            : coordinatePath.length > 1
              ? [coordinatePath]
              : [];

      const hasRouteData =
        routeSummary.points?.length > 0 ||
        coordinatePath.length > 1 ||
        polylinePath.length > 1 ||
        polylineSegments.length > 0 ||
        googleRoadPath.length > 1 ||
        roadPath.length > 1;
      if (hasRouteData) {
        routes.push({
          userId: String(selectedUserId),
          points: routeSummary.points,
          path: displayPath,
          pathSegments,
          color: USER_COLOR,
          label: selectedUserName || `User #${selectedUserId}`,
          distanceKm: routeSummary.distanceKm,
          totalDurationSeconds: routeSummary.totalDurationSeconds,
          startTime: routeSummary.startTime,
          firstLocationTime: routeSummary.firstLocationTime,
          lastLocationTime: routeSummary.lastLocationTime,
          segmentCount: routeSummary.segmentCount || pathSegments.length || 0,
        });
      }
    }

    if (trackingHistoryPoints.length) {
      const gpsPath = trackingHistoryPoints.map(({ lat, lng }) => ({ lat, lng }));
      const path =
        routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE && googleRoadPath.length > 1
          ? googleRoadPath
          : gpsPath;
      routes.push({
        userId: String(selectedUserId),
        points: trackingHistoryPoints,
        path,
        pathSegments: path.length > 1 ? [path] : [],
        isTrackingHistory: true,
        pathMode:
          routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE && googleRoadPath.length > 1
            ? "road"
            : "gps",
        color: USER_COLOR,
        label: `${selectedUserName || `User #${selectedUserId}`} GPS track`,
        startTime: trackingHistoryPoints[0].recorded_at,
        firstLocationTime: trackingHistoryPoints[0].recorded_at,
        lastLocationTime: trackingHistoryPoints[trackingHistoryPoints.length - 1].recorded_at,
      });
    }
    return routes;
  }, [
    selectedUserId,
    routeSummary,
    selectedUserName,
    googleRoadPath,
    routeDisplayMode,
    trackingHistoryPoints,
  ]);

  const refreshAll = () => {
    refetch();
    refetchRoute();
    refetchTrackingHistory();
  };

  if (permissionsLoading || branchesLoading || usersLoading) {
    return <CommonLoader text="Loading live tracking..." />;
  }

  if (!canRead) {
    return (
      <div className="flex h-screen bg-gray-50">
        {isMobile ? (
          <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
        ) : (
          <Sidebar />
        )}
        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-red-700">Access Denied</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              You do not have permission to view live tracking.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {isMobile ? (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      ) : (
        <Sidebar />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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
              <Navigation className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Live Tracking</h1>
                <p className="text-sm text-gray-500">
                  {isToday
                    ? `Live location + route history (auto-refresh ${LIVE_TRACKING_REFRESH_MS / 1000}s)`
                    : "Route history for selected date"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={!selectedUserId || isFetching || routeFetching}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching || routeFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-4 sm:p-6 flex flex-col min-h-0">
          <div className="mx-auto w-full max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4">
            <Card className="shrink-0">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Branch
                    </Label>
                    <Select
                      value={selectedBranchId || "none"}
                      onValueChange={(value) => {
                        setSelectedBranchId(value === "none" ? "" : value);
                        setSelectedUserId("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select branch</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={String(branch.id)}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User
                    </Label>
                    <Select
                      value={selectedUserId || "none"}
                      onValueChange={(value) => setSelectedUserId(value === "none" ? "" : value)}
                      disabled={!selectedBranchId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select user</SelectItem>
                        {branchUsers.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Route date
                    </Label>
                    <input
                      type="date"
                      max={today}
                      value={routeDate}
                      onChange={(e) => setRouteDate(e.target.value || today)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-2 flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label className="flex items-center gap-2">
                        <Route className="h-4 w-4" />
                        Route display
                      </Label>
                      <Select value={routeDisplayMode} onValueChange={setRouteDisplayMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROUTE_DISPLAY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={clearFilters}
                        title="Clear filters"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {!selectedUserId ? (
                <CardContent className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <Navigation className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900">Select a user to track</h3>
                  <p className="text-sm text-gray-500 mt-2 max-w-md">
                    Choose branch and user to view live GPS, travelled route polyline, and visit markers.
                  </p>
                </CardContent>
              ) : (
                <div className="flex flex-1 flex-col xl:flex-row min-h-0 relative">
                  {isLoading && !tracking ? (
                    <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70">
                      <CommonLoader text="Loading location..." />
                    </div>
                  ) : null}

                  <aside className="w-full xl:w-72 shrink-0 border-b xl:border-b-0 xl:border-r border-gray-100 bg-slate-50/60 p-3 space-y-2.5 overflow-y-auto max-h-[40vh] xl:max-h-none">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Tracking user
                      </p>
                      <p className="flex items-center gap-1.5 text-[11px] text-blue-700 font-medium">
                        {isToday ? (
                          <>
                            <RefreshCw
                              className={`h-3 w-3 ${isFetching || routeFetching ? "animate-spin" : ""}`}
                            />
                            Auto {LIVE_TRACKING_REFRESH_MS / 1000}s
                          </>
                        ) : (
                          "History view"
                        )}
                      </p>
                    </div>

                    {error ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        {error.message}
                      </div>
                    ) : null}

                    <TrackingUserCard
                      tracking={tracking}
                      fallbackUser={selectedUser}
                      routeLoading={routeLoading || trackingHistoryLoading}
                      route={trackingHistorySummary || (routeSummary?.hasRoute ? routeSummary : null)}
                      historyPoints={trackingHistoryPoints}
                      color={USER_COLOR}
                    />

                    <RouteActivitiesPanel
                      activities={routeSummary?.activities || []}
                      summary={routeSummary?.activitiesSummary}
                      isLoading={routeLoading}
                    />
                  </aside>

                  <div className="flex-1 min-h-[480px] xl:min-h-0 relative bg-slate-100 overflow-hidden">
                    <LiveRouteMap
                      points={mapPoints}
                      routes={mapRoutes}
                      activities={routeSummary?.activities || []}
                      activeUserId={selectedUserId}
                    />

                    {mapRoutes.length || (routeSummary?.activities || []).some((a) => a.hasCoords) ? (
                      <div className="absolute bottom-4 left-4 z-[450] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-sm text-[11px] text-slate-600 space-y-1 pointer-events-none max-w-[220px]">
                        <p className="font-semibold text-slate-800 text-xs">Map legend</p>
                        <p className="flex items-center gap-1.5">
                          <span className="inline-block h-0.5 w-4 rounded bg-red-600" />
                          {routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE
                            ? "Road route"
                            : "Route polyline"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full border-2 border-red-600 bg-white" />
                          Hover point for location & time
                        </p>
                        {roadRouteFetching ? (
                          <p className="text-blue-700">Loading road route...</p>
                        ) : null}
                        {roadRouteError && routeDisplayMode === ROUTE_DISPLAY_MODES.COORDINATE ? (
                          <p className="text-red-700">
                            Road route unavailable: {roadRouteError.message}
                          </p>
                        ) : null}
                        {isToday ? (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-red-600" />
                            Live pin
                          </p>
                        ) : null}
                        {routeSummary?.distanceKm != null ? (
                          <p className="pt-1 border-t border-gray-100">
                            {routeSummary.distanceKm.toFixed(2)} km ·{" "}
                            {formatDuration(routeSummary.totalDurationSeconds)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
