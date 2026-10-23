import { AuthService } from "@/lib/auth";
import { loadGoogleMapsApi } from "@/lib/googleMapsLoader";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
/** Live map + route polling interval (ms). */
export const LIVE_TRACKING_REFRESH_MS = 10000;

/** Legacy alias used by session hook. */
export const LIVE_TRACKING_UPDATE_INTERVAL_MS = 30000;

export const POLYLINE_GAP_SEPARATOR = "||";

export const ROUTE_DISPLAY_MODES = {
  POLYLINE: "polyline",
  COORDINATE: "coordinate",
};

export const ROUTE_DISPLAY_OPTIONS = [
  { value: ROUTE_DISPLAY_MODES.COORDINATE, label: "Road wise (Google)" },
  { value: ROUTE_DISPLAY_MODES.POLYLINE, label: "GPS straight line" },
];

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (response.status === 404 || payload?.status === 404) {
    return { payload, notFound: true };
  }
  if (!response.ok || (payload?.status && payload.status !== 200)) {
    throw new Error(payload?.message || "Request failed");
  }
  return { payload, notFound: false };
}

export function parseCoordinate(value) {
  if (value == null || String(value).trim() === "") return null;
  const num = Number(String(value).replace(",", "").trim());
  return Number.isFinite(num) ? num : null;
}

export function toApiDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return "";
  return `${day}-${month}-${year}`;
}

export function todayInputDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * POST /api/live-tracking/update-coordinates/ (simple web pin).
 */
export async function updateLiveTrackingCoordinates(lat, long) {
  if (!API_BASE_URL) {
    throw new Error("VITE_BASE_URL is not configured");
  }

  const response = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/live-tracking/update-coordinates/`,
    { lat: String(lat), long: String(long) },
  );
  const { payload } = await parseApiResponse(response);
  return payload.data ?? null;
}

/**
 * GET /api/live-tracking/coordinates/ — live pin(s) for one or more users.
 * Backend accepts: user_id (single), or all=true
 */
export async function fetchLiveTrackingCoordinates(userIds) {
  const ids = Array.isArray(userIds)
    ? userIds.map(String).filter(Boolean)
    : userIds
      ? [String(userIds)]
      : [];
  if (!ids.length) {
    throw new Error("At least one user is required");
  }

  const response = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/live-tracking/coordinates/${buildQuery({ user_id: ids[0] })}`,
  );
  const { payload, notFound } = await parseApiResponse(response);
  if (notFound) return null;
  return payload;
}

/**
 * GET /api/live-tracking/history/ — all GPS samples for one user on one date.
 */
export async function fetchLiveTrackingHistory({ userId, date } = {}) {
  if (!userId || !date) {
    throw new Error("User ID and date are required");
  }

  const response = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/live-tracking/history/${buildQuery({ user_id: userId, date })}`,
  );
  const { payload } = await parseApiResponse(response);
  return payload;
}

/**
 * GET /api/growth/get-assigned-routes/ — daily assigned routes + customer visits.
 * This replaces the non-existent /api/get-tracking-route/ endpoint.
 * Transforms response to match expected format for buildRouteSummary.
 */
export async function fetchUserDailyRoute({ userId, date } = {}) {
  if (!userId || !date) {
    throw new Error("User ID and date are required");
  }

  // date comes in as YYYY-MM-DD from the date input; keep it that way for backend
  const apiDate = date;

  const [routesRes, activitiesRes] = await Promise.all([
    apiRequest(
      "GET",
      `${API_BASE_URL}/api/growth/get-assigned-routes/${buildQuery({ date: apiDate })}`,
    ),
    apiRequest(
      "GET",
      `${API_BASE_URL}/api/growth/route/activities/${buildQuery({ salesman_id: userId, date_from: apiDate, date_to: apiDate })}`,
    ),
  ]);

  const routesResult = await parseApiResponse(routesRes);
  const activitiesResult = await parseApiResponse(activitiesRes);

  const routesData = routesResult.payload?.data || { routes: [] };
  const activitiesData = activitiesResult.payload?.data || [];

  // Build coordinates array from customer visits with lat/long
  const coordinates = [];
  const mapPath = [];

  routesData.routes?.forEach((route) => {
    route.customers?.forEach((customer) => {
      const lat = parseCoordinate(customer.lat);
      const lng = parseCoordinate(customer.long);
      if (lat != null && lng != null) {
        const coordEntry = {
          lat: customer.lat,
          long: customer.long,
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          visit_sequence: customer.visit_sequence,
          status: customer.status,
          from_time: customer.visited_at || customer.visits?.[0]?.activity_time,
          to_time: customer.visits?.[customer.visits.length - 1]?.activity_time,
        };
        coordinates.push(coordEntry);
        mapPath.push({ lat, lng });
      }
    });
  });

  // Calculate basic route stats
  const totalCustomers = routesData.total_customers || 0;
  const visitedCustomers = routesData.routes?.reduce((sum, r) =>
    sum + (r.customers?.filter((c) => c.status === "VISITED").length || 0), 0) || 0;

  return {
    data: {
      coordinates,
      path: mapPath,
      polyline: "",
      path_segments: [],
      polyline_segments: [],
      distance_km: 0,
      start_time: coordinates[0]?.from_time || null,
      end_time: coordinates[coordinates.length - 1]?.to_time || coordinates[coordinates.length - 1]?.from_time || null,
      first_location_time: coordinates[0]?.from_time || null,
      last_location_time: coordinates[coordinates.length - 1]?.to_time || coordinates[coordinates.length - 1]?.from_time || null,
      total_pushes: coordinates.length,
      total_duration_seconds: 0,
      tracking_date: date,
      path_source: "assigned_routes",
      route_activities: activitiesData,
      routes: routesData.routes || [],
      activitiesSummary: {
        total_activities: activitiesData.length,
        visited_customers: visitedCustomers,
        total_customers: totalCustomers,
      },
    },
  };
}

/** Build a road-following driving path with the Google Maps JavaScript API. */
export async function fetchTrackingRoadRoute(points = []) {
  const normalized = (Array.isArray(points) ? points : [])
    .map((point) => ({
      lat: point.lat,
      lng: point.lng ?? point.long,
    }))
    .filter(
      (point) =>
        Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)),
    );

  if (normalized.length < 2) {
    throw new Error("At least 2 history coordinates are required");
  }

  const maxDirectionsPoints = 25;
  const directionPoints =
    normalized.length <= maxDirectionsPoints
      ? normalized
      : Array.from({ length: maxDirectionsPoints }, (_, index) => {
          const sourceIndex = Math.round(
            (index * (normalized.length - 1)) / (maxDirectionsPoints - 1),
          );
          return normalized[sourceIndex];
        });
  const google = await loadGoogleMapsApi();
  const directionsService = new google.maps.DirectionsService();

  return new Promise((resolve, reject) => {
    directionsService.route(
      {
        origin: { lat: Number(directionPoints[0].lat), lng: Number(directionPoints[0].lng) },
        destination: {
          lat: Number(directionPoints[directionPoints.length - 1].lat),
          lng: Number(directionPoints[directionPoints.length - 1].lng),
        },
        waypoints: directionPoints.slice(1, -1).map((point) => ({
          location: { lat: Number(point.lat), lng: Number(point.lng) },
          stopover: false,
        })),
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        const path = result?.routes?.[0]?.overview_path;
        if (status !== google.maps.DirectionsStatus.OK || !path?.length) {
          reject(new Error(`Google Directions request failed: ${status}`));
          return;
        }
        resolve({
          data: {
            path: path.map((point) => ({ lat: point.lat(), lng: point.lng() })),
            source: "google_directions",
          },
        });
      },
    );
  });
}
