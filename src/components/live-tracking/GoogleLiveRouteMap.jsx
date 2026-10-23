import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMapsApi } from "@/lib/googleMapsLoader";
import {
  buildPathMetrics,
  escapeHtml,
  formatDuration,
  formatTrackingTime,
  pointAlongPath,
} from "@/lib/liveTrackingMapUtils";
import salesmanMarker from "@/assets/live-tracking/salesmen.svg";

const DEFAULT_CENTER = { lat: 15.35, lng: 75.08 };

function popupContent(title, lines) {
  return `
    <div style="font:12px/1.45 system-ui,sans-serif;min-width:150px;max-width:260px;color:#0f172a">
      <strong>${escapeHtml(title)}</strong>
      ${lines.filter(Boolean).map((line) => `<div style="margin-top:3px;color:#475569">${line}</div>`).join("")}
    </div>
  `;
}

function validPoint(point) {
  return (
    Number.isFinite(Number(point?.lat)) &&
    Number.isFinite(Number(point?.lng)) &&
    Math.abs(Number(point.lat)) <= 90 &&
    Math.abs(Number(point.lng)) <= 180
  );
}

export default function GoogleLiveRouteMap({
  points = [],
  routes = [],
  activities = [],
  activeUserId,
  onMarkerClick,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const infoWindowRef = useRef(null);
  const lastBoundsKeyRef = useRef("");
  const travelerMarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const animationDataRef = useRef({ path: [], metrics: { total: 0, cumulatives: [0], segments: [] } });
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const activeRoutes = routes.filter((route) => String(route.userId) === String(activeUserId));
  const animationRoute =
    activeRoutes.find((route) => route.isTrackingHistory) ||
    activeRoutes.find((route) => route.points?.some((point) => point.recorded_at)) ||
    activeRoutes.find((route) => Array.isArray(route.points) && route.points.length > 1);
  const animation = animationRoute
    ? {
        path:
          animationRoute.path?.filter(validPoint).length > 1
            ? animationRoute.path
                .filter(validPoint)
                .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
            : animationRoute.points
                .filter(validPoint)
                .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })),
        firstPoint: animationRoute.points.find(validPoint),
      }
    : null;
  const animationPath = animation?.path || [];
  animationDataRef.current = {
    path: animationPath,
    metrics: buildPathMetrics(animationPath),
  };
  const firstAnimationPoint = animation?.firstPoint;
  const animationKey = firstAnimationPoint
    ? `${activeUserId}:${firstAnimationPoint.id ?? firstAnimationPoint.recorded_at ?? `${firstAnimationPoint.lat},${firstAnimationPoint.lng}`}:${animationRoute?.pathMode || ""}`
    : "";

  const hasMapData =
    points.some(validPoint) ||
    routes.some((route) => {
      const path = Array.isArray(route.path) ? route.path : [];
      return (
        path.some(validPoint) ||
        route.pathSegments?.some(
          (segment) => Array.isArray(segment) && segment.some(validPoint),
        ) ||
        route.points?.some(validPoint)
      );
    }) ||
    activities.some((activity) => activity.hasCoords && validPoint(activity));

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 6,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setMapReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "Unable to load Google Maps");
        }
      });

    return () => {
      cancelled = true;
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      travelerMarkerRef.current?.setMap(null);
      travelerMarkerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || animationPath.length < 2 || !animationKey) return undefined;

    const google = window.google;
    const start = animationPath[0];
    const marker = new google.maps.OverlayView();
    const markerElement = document.createElement("div");
    markerElement.style.position = "absolute";
    markerElement.style.width = "42px";
    markerElement.style.height = "58px";
    markerElement.style.transform = "translate(-50%, -100%)";
    markerElement.style.zIndex = "2000";
    markerElement.style.pointerEvents = "none";
    const markerImage = document.createElement("img");
    markerImage.src = salesmanMarker;
    markerImage.alt = "";
    markerImage.draggable = false;
    markerImage.style.width = "42px";
    markerImage.style.height = "58px";
    markerImage.style.transformOrigin = "50% 100%";
    markerImage.style.willChange = "transform";
    markerElement.appendChild(markerImage);

    let markerPosition = new google.maps.LatLng(start.lat, start.lng);
    let markerHeading = 0;
    marker.onAdd = () => {
      marker.getPanes()?.overlayMouseTarget?.appendChild(markerElement);
    };
    marker.draw = () => {
      const pixel = marker.getProjection()?.fromLatLngToDivPixel(markerPosition);
      if (!pixel) return;
      markerElement.style.left = `${pixel.x}px`;
      markerElement.style.top = `${pixel.y}px`;
      markerImage.style.transform = `rotate(${markerHeading}deg)`;
    };
    marker.onRemove = () => markerElement.remove();
    marker.setPose = (position, heading) => {
      markerPosition = new google.maps.LatLng(position.lat, position.lng);
      markerHeading = heading;
      marker.draw();
    };
    marker.setMap(map);
    travelerMarkerRef.current = marker;

    const durationMs = 18000;
    const startedAt = performance.now();
    const animate = (now) => {
      if (travelerMarkerRef.current !== marker) return;
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const { path, metrics } = animationDataRef.current;
      const currentPath = path.length > 1 ? path : [start];
      const pose = pointAlongPath(currentPath, metrics, metrics.total * progress);
      if (pose?.point) marker.setPose(pose.point, pose.heading);
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      marker.setMap(null);
      if (travelerMarkerRef.current === marker) travelerMarkerRef.current = null;
    };
  }, [mapReady, activeUserId, animationKey]);

  useEffect(() => {
    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;
    if (!mapReady || !map || !infoWindow) return undefined;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;
    let hasRouteOrActivity = false;
    const addMarker = (position, options, title, html, onClick) => {
      const marker = new google.maps.Marker({ map, position, ...options });
      overlaysRef.current.push(marker);
      bounds.extend(position);
      hasBounds = true;
      if (html) {
        marker.addListener("click", () => {
          infoWindow.setContent(html);
          infoWindow.open({ map, anchor: marker });
          onClick?.();
        });
      } else if (onClick) {
        marker.addListener("click", onClick);
      }
      if (title) marker.setTitle(title);
      return marker;
    };

    routes.forEach((route) => {
      const routePoints = (Array.isArray(route.points) ? route.points : []).filter(validPoint);
      const segments = Array.isArray(route.pathSegments)
        ? route.pathSegments.filter((segment) => Array.isArray(segment) && segment.length > 1)
        : [];
      const path = Array.isArray(route.path) ? route.path.filter(validPoint) : [];
      const paths = segments.length ? segments : path.length > 1 ? [path] : [];

      paths.forEach((segment) => {
        const pathPoints = segment.filter(validPoint).map((point) => ({
          lat: Number(point.lat),
          lng: Number(point.lng),
        }));
        if (pathPoints.length < 2) return;
        hasRouteOrActivity = true;
        const line = new google.maps.Polyline({
          map,
          path: pathPoints,
          strokeColor: route.color || "#dc2626",
          strokeOpacity: 0.9,
          strokeWeight: 5,
          geodesic: true,
        });
        overlaysRef.current.push(line);
        pathPoints.forEach((point) => {
          bounds.extend(point);
          hasBounds = true;
        });
      });

      routePoints.forEach((point, index) => {
        hasRouteOrActivity = true;
        const position = { lat: Number(point.lat), lng: Number(point.lng) };
        const isStart = index === 0;
        const isEnd = index === routePoints.length - 1;
        const color = isStart ? "#059669" : isEnd ? route.color || "#dc2626" : "#ffffff";
        const label = isStart ? "Start" : isEnd ? "End" : `Point ${index + 1}`;
        const lines = [
          `<span style="font-family:monospace">${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}</span>`,
          `From: ${escapeHtml(formatTrackingTime(point.from_time))}`,
          `To: ${escapeHtml(formatTrackingTime(point.to_time))}`,
          `Duration: ${escapeHtml(formatDuration(Number(point.duration_seconds)))}`,
        ];
        addMarker(
          position,
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: isStart || isEnd ? 7 : 5,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            zIndex: isStart || isEnd ? 20 : 10,
          },
          label,
          popupContent(`${label} · ${route.label || "Route"}`, lines),
        );
      });
    });

    activities.filter((activity) => activity.hasCoords && validPoint(activity)).forEach((activity) => {
      hasRouteOrActivity = true;
      const position = { lat: Number(activity.lat), lng: Number(activity.lng) };
      addMarker(
        position,
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#c2410c",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          zIndex: 30,
        },
        activity.customer_name || "Route activity",
        popupContent(activity.route_name || "Route activity", [
          escapeHtml(activity.customer_name || "Customer"),
          escapeHtml(activity.activity_name || "Visit"),
          escapeHtml(formatTrackingTime(activity.visit_date)),
        ]),
      );
    });

    points.filter(validPoint).forEach((point) => {
      const position = { lat: Number(point.lat), lng: Number(point.lng) };
      const isActive = String(point.userId) === String(activeUserId);
      addMarker(
        position,
        {
          zIndex: isActive ? 1000 : 100,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: isActive ? 7 : 6,
            fillColor: point.color || "#1e40af",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        },
        point.label || "User location",
        popupContent(point.label || "User location", [
          escapeHtml(point.address || "Address not available"),
          `<span style="font-family:monospace">${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}</span>`,
        ]),
        () => onMarkerClick?.(point.userId),
      );
    });

    if (hasBounds) {
      const livePoints = points.filter(validPoint);
      const boundsKey = [
        bounds.getSouthWest().lat().toFixed(5),
        bounds.getSouthWest().lng().toFixed(5),
        bounds.getNorthEast().lat().toFixed(5),
        bounds.getNorthEast().lng().toFixed(5),
        String(activeUserId || ""),
      ].join("|");
      if (lastBoundsKeyRef.current !== boundsKey) {
        lastBoundsKeyRef.current = boundsKey;
        if (livePoints.length === 1 && !hasRouteOrActivity) {
          const point = livePoints[0];
          map.setCenter({ lat: Number(point.lat), lng: Number(point.lng) });
          map.setZoom(16);
        } else {
          map.fitBounds(bounds, 56);
        }
      }
    }

    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      infoWindow.close();
    };
  }, [mapReady, points, routes, activities, activeUserId, onMarkerClick]);

  return (
    <div className="absolute inset-0 h-full w-full bg-slate-100">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {mapError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-red-700">
          {mapError}
        </div>
      ) : null}
      {!mapReady && !mapError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 text-sm text-slate-600">
          Loading Google Maps...
        </div>
      ) : null}
      {mapReady && !hasMapData ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/70 px-6 text-center">
          <MapPin className="mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">
            Map preview unavailable without valid coordinates.
          </p>
        </div>
      ) : null}
    </div>
  );
}
