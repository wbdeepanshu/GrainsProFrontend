/**
 * Real-time live tracking via WebSocket.
 *
 * Connect: ws(s)://<host>/ws/live-tracking/?access_token=<JWT>
 * Send every 5–10s: { "lat": "12.9716", "long": "77.5946" }
 */

export function isLiveTrackingEnabled(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

let activeSessionStop = null;
let activeSessionKey = null;

/**
 * Start at most one tracking session app-wide; no-op if already running for same token.
 * Pass enabled=false or call stopLiveTrackingSession() to tear down.
 */
export function ensureLiveTrackingSession({
  enabled,
  baseUrl,
  accessToken,
  intervalMs = 5000,
  onLocationAck,
  onLocationUpdated,
  onError,
}) {
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
    baseUrl,
    accessToken,
    intervalMs,
    onLocationAck,
    onLocationUpdated,
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

export function createLiveTrackingSocket({ baseUrl, accessToken, onMessage, onError, onOpen, onClose }) {
  if (!accessToken) {
    throw new Error("accessToken is required for live tracking WebSocket");
  }

  const wsBase = String(baseUrl || "").replace(/^http/i, (match) =>
    match.toLowerCase() === "https" ? "wss" : "ws"
  );
  const url = `${wsBase.replace(/\/$/, "")}/ws/live-tracking/?access_token=${encodeURIComponent(accessToken)}`;
  const socket = new WebSocket(url);

  socket.onopen = () => onOpen?.();
  socket.onclose = (event) => onClose?.(event);
  socket.onerror = (event) => onError?.(event);
  socket.onmessage = (event) => {
    try {
      onMessage?.(JSON.parse(event.data));
    } catch {
      onMessage?.({ type: "error", message: "Invalid WebSocket payload" });
    }
  };

  return {
    socket,
    sendLocation(lat, long) {
      if (socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ lat: String(lat), long: String(long) }));
      return true;
    },
    close() {
      socket.close();
    },
  };
}

/**
 * Start browser GPS + WebSocket pings every `intervalMs` (default 5000).
 * Returns cleanup function — call on logout/unmount.
 */
export function startLiveTrackingSession({
  baseUrl,
  accessToken,
  intervalMs = 5000,
  onLocationAck,
  onLocationUpdated,
  onError,
}) {
  if (!navigator.geolocation) {
    onError?.("Geolocation is not supported in this browser");
    return () => {};
  }

  const client = createLiveTrackingSocket({
    baseUrl,
    accessToken,
    onMessage: (msg) => {
      if (msg?.type === "location_ack") onLocationAck?.(msg);
      if (msg?.type === "location_updated") onLocationUpdated?.(msg);
      if (msg?.type === "error") onError?.(msg.message || "Live tracking error");
    },
    onError: (event) => onError?.(event),
  });

  let watchId = null;
  let lastSent = 0;

  const pushCoords = (latitude, longitude) => {
    const now = Date.now();
    if (now - lastSent < intervalMs) return;
    lastSent = now;
    client.sendLocation(latitude, longitude);
  };

  watchId = navigator.geolocation.watchPosition(
    (pos) => pushCoords(pos.coords.latitude, pos.coords.longitude),
    (err) => onError?.(err.message || "Failed to read GPS"),
    { enableHighAccuracy: true, maximumAge: intervalMs, timeout: 15000 }
  );

  return () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    client.close();
  };
}
