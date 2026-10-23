/**
 * Live tracking session — sends GPS to POST /api/live-tracking/update-coordinates/ only.
 * Calls are made every 30 seconds when is_tracking_enabled is true.
 */

import { AuthService } from "@/lib/auth";
import {
  LIVE_TRACKING_UPDATE_INTERVAL_MS,
  updateLiveTrackingCoordinates,
} from "@/lib/liveTrackingApi";

export function isLiveTrackingEnabled(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

let activeSessionStop = null;
let activeSessionKey = null;

function getPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function getPositionByWatch(options) {
  return new Promise((resolve, reject) => {
    let watchId = null;
    const timeoutId = window.setTimeout(() => {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
      reject(new Error("Location watch timed out"));
    }, options.timeout ?? 20000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        if (watchId != null) {
          navigator.geolocation.clearWatch(watchId);
        }
        resolve(position);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        if (watchId != null) {
          navigator.geolocation.clearWatch(watchId);
        }
        reject(error);
      },
      options
    );
  });
}

async function readCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported in this browser");
  }

  try {
    return await getPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 8000,
    });
  } catch {
    try {
      return await getPosition({
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 15000,
      });
    } catch {
      return await getPositionByWatch({
        enableHighAccuracy: false,
        maximumAge: 120000,
        timeout: 20000,
      });
    }
  }
}

/**
 * Start at most one tracking session app-wide.
 * Pass enabled=false or call stopLiveTrackingSession() to tear down.
 */
export function ensureLiveTrackingSession({
  enabled,
  intervalMs = LIVE_TRACKING_UPDATE_INTERVAL_MS,
  onLocationAck,
  onError,
}) {
  const accessToken = AuthService.getAccessToken();
  const shouldRun = Boolean(enabled && accessToken);

  if (!shouldRun) {
    stopLiveTrackingSession();
    return;
  }

  const sessionKey = String(accessToken);
  if (activeSessionStop && activeSessionKey === sessionKey) {
    return;
  }

  stopLiveTrackingSession();
  activeSessionKey = sessionKey;
  activeSessionStop = startLiveTrackingSession({
    intervalMs,
    onLocationAck,
    onError,
  });
}

export function stopLiveTrackingSession() {
  if (activeSessionStop) {
    activeSessionStop();
    activeSessionStop = null;
    activeSessionKey = null;
  }
}

/**
 * Read GPS and POST to update-coordinates every `intervalMs` (default 30s).
 */
export function startLiveTrackingSession({
  intervalMs = LIVE_TRACKING_UPDATE_INTERVAL_MS,
  onLocationAck,
  onError,
}) {
  let intervalId = null;
  let inFlight = false;
  let stopped = false;

  const sendLocation = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const position = await readCurrentPosition();
      const data = await updateLiveTrackingCoordinates(
        position.coords.latitude,
        position.coords.longitude
      );
      onLocationAck?.(data);
    } catch (err) {
      onError?.(err?.message || "Live tracking error");
    } finally {
      inFlight = false;
    }
  };

  sendLocation();
  intervalId = window.setInterval(sendLocation, intervalMs);

  return () => {
    stopped = true;
    if (intervalId != null) {
      window.clearInterval(intervalId);
    }
  };
}
