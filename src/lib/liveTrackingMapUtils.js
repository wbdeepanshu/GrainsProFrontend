import { POLYLINE_GAP_SEPARATOR } from "@/lib/liveTrackingApi";

const MAX_POLYLINE_POINTS = 8000;
const MAX_SANE_SEGMENT_KM = 80;

export function formatTrackingTime(value) {
  if (!value) return "—";
  try {
    let date = new Date(value);
    if (Number.isNaN(date.getTime()) && typeof value === "string") {
      const match = value.match(
        /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
      );
      if (match) {
        date = new Date(
          Number(match[3]),
          Number(match[2]) - 1,
          Number(match[1]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6] || 0),
        );
      }
    }
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatTrackingAddress(address) {
  if (!address) return "";
  if (typeof address === "string") return address.trim();
  if (typeof address === "object") {
    const formatted =
      address.formatted_address ||
      address.formattedAddress ||
      [address.address, address.city, address.state, address.pincode]
        .filter(Boolean)
        .join(", ");
    return String(formatted || "").trim();
  }
  return String(address);
}

export function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "—";
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${Math.max(minutes, 1)}m`;
}

export function formatStartClock(value) {
  if (!value) return "—";
  const date = parseTrackingDateTime(value);
  if (!date) return String(value);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function parseTrackingDateTime(value) {
  if (!value) return null;
  let date = new Date(value);
  if (Number.isNaN(date.getTime()) && typeof value === "string") {
    const match = value.match(
      /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
    );
    if (match) {
      date = new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6] || 0),
      );
    }
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function elapsedSecondsBetween(startValue, endValue) {
  const start = parseTrackingDateTime(startValue);
  const end = parseTrackingDateTime(endValue);
  if (!start || !end || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}

function resolveRouteDurationSeconds(data, points) {
  const startTime =
    data.start_time ||
    data.elapsed_start_time ||
    data.first_location_time ||
    points[0]?.from_time ||
    null;
  const endTime =
    data.end_time ||
    data.elapsed_end_time ||
    data.last_location_time ||
    points[points.length - 1]?.to_time ||
    points[points.length - 1]?.from_time ||
    null;

  const elapsed = elapsedSecondsBetween(startTime, endTime);
  if (elapsed > 0) return elapsed;

  const apiDuration = Number(data.total_duration_seconds);
  return Number.isFinite(apiDuration) && apiDuration > 0 ? apiDuration : 0;
}

function parseCoordinate(value) {
  const num = Number(String(value ?? "").replace(",", "").trim());
  return Number.isFinite(num) ? num : null;
}

function sanitizePolylinePath(path, maxPoints = MAX_POLYLINE_POINTS) {
  if (!Array.isArray(path) || !path.length) return [];
  const cleaned = [];
  let prev = null;
  for (const point of path) {
    if (cleaned.length >= maxPoints) break;
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    if (prev) {
      const segKm = distanceKm([prev, { lat, lng }]);
      if (segKm > MAX_SANE_SEGMENT_KM) continue;
    }
    cleaned.push({ lat, lng });
    prev = cleaned[cleaned.length - 1];
  }
  return cleaned;
}

function splitConcatenatedPolyline(encoded) {
  const text = String(encoded || "").trim();
  if (!text) return [];
  const searchWindow = Math.min(24, Math.max(0, Math.floor(text.length / 3)));
  for (let anchorLen = Math.min(16, Math.floor(text.length / 2)); anchorLen >= 5; anchorLen -= 1) {
    for (let start = 0; start < searchWindow; start += 1) {
      if (start + anchorLen > text.length) break;
      const anchor = text.slice(start, start + anchorLen);
      if (text.split(anchor).length < 3) continue;
      const parts = text.split(anchor);
      const rebuilt = parts
        .map((part, idx) => (idx > 0 ? anchor + part : part).trim())
        .filter(Boolean);
      if (rebuilt.length >= 2) return rebuilt;
    }
  }
  return [text];
}

function splitPolylineByGap(encoded) {
  const text = String(encoded || "").trim();
  if (!text) return [];
  if (text.includes(POLYLINE_GAP_SEPARATOR)) {
    return text.split(POLYLINE_GAP_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  }
  return [text];
}

function decodeGooglePolylineSegment(encoded) {
  if (!encoded || typeof encoded !== "string") return [];

  let index = 0;
  const segment = encoded;
  const len = segment.length;
  const path = [];
  let lat = 0;
  let lng = 0;
  const maxShift = 32;

  while (index < len) {
    let shift = 0;
    let result = 0;
    let byte = null;
    do {
      if (index >= len) return sanitizePolylinePath(path);
      byte = segment.charCodeAt(index) - 63;
      if (!Number.isFinite(byte)) return sanitizePolylinePath(path);
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && shift <= maxShift);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      if (index >= len) return sanitizePolylinePath(path);
      byte = segment.charCodeAt(index) - 63;
      if (!Number.isFinite(byte)) return sanitizePolylinePath(path);
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && shift <= maxShift);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return sanitizePolylinePath(path);
}

function decodeGooglePolyline(encoded) {
  if (!encoded || typeof encoded !== "string") return [];

  const gapParts = splitPolylineByGap(encoded);
  if (gapParts.length > 1) {
    for (const part of gapParts) {
      const path = decodeGooglePolylineSegment(part);
      if (path.length >= 2) return path;
    }
    return [];
  }

  const mergeSegments = (segments) => {
    const merged = [];
    for (const segment of segments) {
      let part = sanitizePolylinePath(
        decodeGooglePolylineSegment(segment),
        MAX_POLYLINE_POINTS - merged.length,
      );
      if (!part.length) continue;
      if (merged.length) {
        const last = merged[merged.length - 1];
        const first = part[0];
        if (distanceKm([last, first]) <= 0.035) {
          part = part.slice(1);
        }
      }
      merged.push(...part);
      if (merged.length >= MAX_POLYLINE_POINTS) break;
    }
    return sanitizePolylinePath(merged);
  };

  const full = decodeGooglePolylineSegment(encoded);
  if (full.length >= 2) return full;

  const chunks = splitConcatenatedPolyline(encoded);
  if (chunks.length > 1) {
    const merged = mergeSegments(chunks);
    if (merged.length >= 2) return merged;
  }

  return full;
}

function sanitizePathSegment(segment) {
  if (!Array.isArray(segment)) return [];
  return sanitizePolylinePath(
    segment
      .map((entry) => ({
        lat: parseCoordinate(entry?.lat),
        lng: parseCoordinate(entry?.long ?? entry?.lng),
      }))
      .filter((point) => point.lat != null && point.lng != null),
  );
}

function resolveRoutePathSegments(data) {
  if (!data) return [];

  if (Array.isArray(data.path_segments) && data.path_segments.length) {
    const segments = data.path_segments
      .map((segment) => sanitizePathSegment(segment))
      .filter((segment) => segment.length >= 2);
    if (segments.length) return segments;
  }

  if (Array.isArray(data.polyline_segments) && data.polyline_segments.length) {
    const segments = data.polyline_segments
      .map((encoded) => decodeGooglePolylineSegment(String(encoded)))
      .filter((segment) => segment.length >= 2);
    if (segments.length) return segments;
  }

  if (data.polyline && String(data.polyline).includes(POLYLINE_GAP_SEPARATOR)) {
    const segments = splitPolylineByGap(data.polyline)
      .map((encoded) => decodeGooglePolylineSegment(encoded))
      .filter((segment) => segment.length >= 2);
    if (segments.length) return segments;
  }

  return [];
}

export function distanceKm(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  const radius = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  let total = 0;

  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const curr = path[i];
    const dLat = toRad(curr.lat - prev.lat);
    const dLng = toRad(curr.lng - prev.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(prev.lat)) * Math.cos(toRad(curr.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  return total;
}

export function buildRouteSummary(payload) {
  const data = payload?.data || null;
  if (!data) return null;

  const coordinates = Array.isArray(data.coordinates) ? data.coordinates : [];
  const points = coordinates
    .map((entry) => {
      const lat = parseCoordinate(entry.lat);
      const lng = parseCoordinate(entry.long ?? entry.lng);
      if (lat == null || lng == null) return null;
      return {
        ...entry,
        lat,
        lng,
        segmentDistanceKm:
          entry.segment_distance_km != null
            ? Number(entry.segment_distance_km)
            : null,
      };
    })
    .filter(Boolean);

  const mapPath = points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const pathSegments = resolveRoutePathSegments(data);

  const apiPath = Array.isArray(data.path)
    ? data.path
        .map((entry) => ({
          lat: parseCoordinate(entry.lat),
          lng: parseCoordinate(entry.long ?? entry.lng),
        }))
        .filter((point) => point.lat != null && point.lng != null)
    : [];

  let polylinePath = [];
  if (pathSegments.length === 1) {
    polylinePath = pathSegments[0];
  } else if (pathSegments.length > 1) {
    polylinePath = pathSegments[0];
  } else if (apiPath.length > 1) {
    polylinePath = sanitizePolylinePath(apiPath);
  } else if (data.polyline) {
    polylinePath = decodeGooglePolyline(String(data.polyline));
  }
  if (polylinePath.length < 2 && mapPath.length >= 2) {
    polylinePath = sanitizePolylinePath(mapPath);
  }

  const segmentPathDistance = pathSegments.length
    ? pathSegments.reduce((total, segment) => total + distanceKm(segment), 0)
    : 0;
  let computedDistance = segmentPathDistance;
  if (computedDistance <= 0 && mapPath.length >= 2) {
    computedDistance = distanceKm(mapPath);
  }
  if (computedDistance <= 0 && polylinePath.length >= 2) {
    computedDistance = distanceKm(polylinePath);
  }
  const apiDistance = Number(data.distance_km);
  const distance =
    Number.isFinite(apiDistance) && apiDistance > 0
      ? apiDistance
      : computedDistance;

  const activitiesRaw = Array.isArray(payload?.route_activities?.data)
    ? payload.route_activities.data
    : Array.isArray(data.route_activities)
      ? data.route_activities
      : [];

  const activities = activitiesRaw
    .map((entry) => {
      const lat = parseCoordinate(entry.lat);
      const lng = parseCoordinate(entry.long ?? entry.lng);
      return {
        ...entry,
        lat,
        lng,
        hasCoords: lat != null && lng != null,
      };
    })
    .sort((a, b) => {
      const ta = Date.parse(a.visit_date || "") || 0;
      const tb = Date.parse(b.visit_date || "") || 0;
      return ta - tb;
    });

  const startTime =
    data.start_time ||
    data.elapsed_start_time ||
    data.first_location_time ||
    points[0]?.from_time ||
    null;
  const endTime =
    data.end_time ||
    data.elapsed_end_time ||
    data.last_location_time ||
    points[points.length - 1]?.to_time ||
    points[points.length - 1]?.from_time ||
    null;

  return {
    trackingDate: data.tracking_date || "",
    firstLocationTime: data.first_location_time || startTime,
    lastLocationTime: data.last_location_time || endTime,
    startTime,
    endTime,
    totalPushes: Number(data.total_pushes) || points.length,
    totalDurationSeconds: resolveRouteDurationSeconds(data, points),
    points,
    mapPath,
    polylinePath,
    pathSegments,
    segmentCount: pathSegments.length || (polylinePath.length > 1 ? 1 : 0),
    pathSource: data.path_source || null,
    activities,
    activitiesSummary: payload?.route_activities?.summary || {
      total_activities: activities.length,
    },
    distanceKm: distance,
    hasRoute:
      mapPath.length > 0 ||
      points.length > 0 ||
      activities.some((a) => a.hasCoords),
  };
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPathMetrics(path) {
  if (!Array.isArray(path) || path.length < 2) {
    return { total: 0, cumulatives: [0], segments: [] };
  }
  const cumulatives = [0];
  const segments = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const seg = distanceKm([path[i - 1], path[i]]);
    total += seg;
    segments.push(seg);
    cumulatives.push(total);
  }
  return { total, cumulatives, segments };
}

export function bearingDegrees(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function pointAlongPath(path, metrics, distanceAlongKm) {
  if (!path?.length) return null;
  if (path.length === 1 || metrics.total <= 0) {
    return { point: path[0], heading: 0 };
  }
  const target = Math.max(0, Math.min(distanceAlongKm, metrics.total));
  let index = 0;
  while (index < metrics.cumulatives.length - 1 && metrics.cumulatives[index + 1] < target) {
    index += 1;
  }
  const start = path[index];
  const end = path[Math.min(index + 1, path.length - 1)];
  const segStart = metrics.cumulatives[index];
  const segLen = metrics.segments[index] || 0;
  const t = segLen > 0 ? (target - segStart) / segLen : 0;
  return {
    point: {
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    },
    heading: bearingDegrees(start, end),
  };
}
