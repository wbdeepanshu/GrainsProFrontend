import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsApi } from "@/lib/googleMapsLoader";

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_ZOOM = 5;
const TRACKING_ZOOM = 16;

function buildInfoContent({ userName, lat, lng, addressInfo }) {
  const lines = [
    `<div style="font-family:system-ui,sans-serif;min-width:200px;max-width:280px;padding:2px 0">`,
    `<strong style="font-size:14px;color:#111">${userName || "User"}</strong>`,
  ];

  if (addressInfo?.formattedAddress) {
    lines.push(
      `<p style="margin:6px 0 0;font-size:12px;color:#374151;line-height:1.4">${addressInfo.formattedAddress}</p>`
    );
  } else if (addressInfo?.address) {
    lines.push(
      `<p style="margin:6px 0 0;font-size:12px;color:#374151;line-height:1.4">${addressInfo.address}</p>`
    );
  }

  const meta = [
    addressInfo?.city && `City: ${addressInfo.city}`,
    addressInfo?.state && `State: ${addressInfo.state}`,
    addressInfo?.pincode && `PIN: ${addressInfo.pincode}`,
  ].filter(Boolean);

  if (meta.length) {
    lines.push(`<p style="margin:4px 0 0;font-size:11px;color:#6b7280">${meta.join(" · ")}</p>`);
  }

  if (lat != null && lng != null) {
    lines.push(
      `<p style="margin:6px 0 0;font-size:11px;color:#9ca3af">${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}</p>`
    );
  }

  lines.push("</div>");
  return lines.join("");
}

export default function LiveTrackingMap({
  lat,
  lng,
  userName,
  hasSelection,
  addressInfo,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !containerRef.current) return;

        mapRef.current = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        markerRef.current = new google.maps.Marker({
          map: mapRef.current,
          visible: false,
          title: userName || "User location",
        });

        infoWindowRef.current = new google.maps.InfoWindow();

        setMapReady(true);
        setMapError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setMapError(err?.message || "Unable to load Google Maps");
        }
      });

    return () => {
      cancelled = true;
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      markerRef.current = null;
      infoWindowRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerRef.current) return;

    if (lat == null || lng == null) {
      markerRef.current.setVisible(false);
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      mapRef.current.setCenter(DEFAULT_CENTER);
      mapRef.current.setZoom(hasSelection ? DEFAULT_ZOOM : DEFAULT_ZOOM);
      return;
    }

    const position = { lat, lng };
    markerRef.current.setPosition(position);
    markerRef.current.setTitle(userName || "User location");
    markerRef.current.setVisible(true);
    mapRef.current.panTo(position);
    mapRef.current.setZoom(TRACKING_ZOOM);

    if (infoWindowRef.current) {
      infoWindowRef.current.setContent(
        buildInfoContent({ userName, lat, lng, addressInfo })
      );
      infoWindowRef.current.open({
        map: mapRef.current,
        anchor: markerRef.current,
      });
    }
  }, [lat, lng, userName, mapReady, hasSelection, addressInfo]);

  if (mapError) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
        {mapError}
      </div>
    );
  }

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-gray-200">
      <div ref={containerRef} className="h-full w-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-600">
          Loading map...
        </div>
      )}
    </div>
  );
}
