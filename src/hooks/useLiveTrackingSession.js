import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  ensureLiveTrackingSession,
  isLiveTrackingEnabled,
  stopLiveTrackingSession,
} from "@/lib/liveTrackingSession";
import { LIVE_TRACKING_UPDATE_INTERVAL_MS } from "@/lib/liveTrackingApi";
import { mergeOrgInfoFromDashboardPayload } from "@/lib/orgInfo";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/superadmin/login",
]);

/**
 * App-wide live tracking: when dashboard user_info has is_tracking_enabled,
 * POST GPS to /api/live-tracking/update-coordinates/ every 30 seconds.
 */
export function useLiveTrackingSession() {
  const [location] = useLocation();
  const isAuthenticated = AuthService.isAuthenticated();
  const isPublicRoute = PUBLIC_PATHS.has(location);

  const trackingInfoQuery = useQuery({
    queryKey: [`${API_BASE_URL}/api/dashboard-data/`, "user_info", "live-tracking"],
    queryFn: async () => {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/dashboard-data/`, {
        object_name: "user_info",
        date: new Date().toISOString().split("T")[0],
      });
      return response.json();
    },
    enabled: isAuthenticated && !isPublicRoute && !!API_BASE_URL,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const trackingEnabledFlag =
    trackingInfoQuery.data?.data?.user_info?.is_tracking_enabled;

  useEffect(() => {
    if (trackingInfoQuery.data) {
      mergeOrgInfoFromDashboardPayload(trackingInfoQuery.data);
    }
  }, [trackingInfoQuery.data]);

  useEffect(() => {
    if (!isAuthenticated || isPublicRoute) {
      stopLiveTrackingSession();
      return;
    }

    const userInfo = trackingInfoQuery.data?.data?.user_info;
    if (!userInfo) {
      return;
    }

    ensureLiveTrackingSession({
      enabled: isLiveTrackingEnabled(userInfo.is_tracking_enabled),
      intervalMs: LIVE_TRACKING_UPDATE_INTERVAL_MS,
      onLocationAck: (data) => {
        if (import.meta.env.DEV) {
          console.log("[live-tracking] updated", data?.action ?? "ok");
        }
      },
      onError: (message) => {
        console.warn("[live-tracking]", message);
      },
    });
  }, [isAuthenticated, isPublicRoute, trackingEnabledFlag, trackingInfoQuery.data]);
}
