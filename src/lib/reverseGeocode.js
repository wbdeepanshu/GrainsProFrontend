import { loadGoogleMapsApi } from "@/lib/googleMapsLoader";

let geocoderInstance = null;

const LOCATION_TYPE_SCORE = {
  ROOFTOP: 4,
  RANGE_INTERPOLATED: 3,
  GEOMETRIC_CENTER: 2,
  APPROXIMATE: 1,
};

const PLUS_CODE_LEADING_RE = /^[23456789CFGHJMPQRVWX]{4,}\+/i;

async function getGeocoder() {
  if (!geocoderInstance) {
    const google = await loadGoogleMapsApi();
    geocoderInstance = new google.maps.Geocoder();
  }
  return geocoderInstance;
}

function pickComponent(components, type, useShort = false) {
  const match = components.find((c) => c.types.includes(type));
  if (!match) return "";
  return useShort ? match.short_name || match.long_name || "" : match.long_name || "";
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readResultLatLng(result) {
  const location = result?.geometry?.location;
  if (!location) return null;
  const lat = typeof location.lat === "function" ? location.lat() : location.lat;
  const lng = typeof location.lng === "function" ? location.lng() : location.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Google may return several candidates; the first one is often a Plus Code or a
 * landmark far from the requested point. Pick the closest high-accuracy result.
 */
export function pickBestGeocoderResult(results, lat, lng) {
  if (!results?.length) return null;

  let best = results[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const result of results) {
    const point = readResultLatLng(result);
    if (!point) continue;

    const distance = haversineMeters(lat, lng, point.lat, point.lng);
    const typeScore = LOCATION_TYPE_SCORE[result?.geometry?.location_type] || 0;
    const score = typeScore * 1000 - distance;

    if (score > bestScore) {
      bestScore = score;
      best = result;
    }
  }

  return best;
}

function buildStreetAddress(components) {
  const streetNumber = pickComponent(components, "street_number");
  const route = pickComponent(components, "route");
  const premise = pickComponent(components, "premise");
  const sublocality =
    pickComponent(components, "sublocality_level_2") ||
    pickComponent(components, "sublocality_level_1") ||
    pickComponent(components, "sublocality") ||
    pickComponent(components, "neighborhood");

  const parts = [streetNumber, route].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (premise) return premise;
  if (sublocality) return sublocality;
  return "";
}

function buildFormattedFromComponents(components) {
  const sublocality =
    pickComponent(components, "sublocality_level_2") ||
    pickComponent(components, "sublocality_level_1") ||
    pickComponent(components, "sublocality") ||
    pickComponent(components, "neighborhood");
  const locality =
    pickComponent(components, "locality") ||
    pickComponent(components, "administrative_area_level_3") ||
    pickComponent(components, "administrative_area_level_2");
  const state = pickComponent(components, "administrative_area_level_1");
  const pincode = pickComponent(components, "postal_code");
  const street = buildStreetAddress(components);

  const parts = [];
  if (street) parts.push(street);
  if (sublocality) parts.push(sublocality);
  if (locality && locality !== sublocality) parts.push(locality);
  if (state) parts.push(state);
  if (pincode) parts.push(pincode);

  return parts.filter(Boolean).join(", ");
}

export function parseGeocoderResult(result) {
  const components = result?.address_components || [];
  const street = buildStreetAddress(components);
  const city =
    pickComponent(components, "locality") ||
    pickComponent(components, "administrative_area_level_3") ||
    pickComponent(components, "administrative_area_level_2") ||
    pickComponent(components, "sublocality_level_1");
  const state = pickComponent(components, "administrative_area_level_1");
  const pincode = pickComponent(components, "postal_code");

  let formattedAddress = result?.formatted_address || "";
  if (PLUS_CODE_LEADING_RE.test(formattedAddress.trim())) {
    const built = buildFormattedFromComponents(components);
    if (built) formattedAddress = built;
  }

  return {
    formattedAddress,
    address: street || formattedAddress,
    city,
    state,
    pincode,
  };
}

const geocodeCache = new Map();

function cacheKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

export function clearReverseGeocodeCache() {
  geocodeCache.clear();
}

/**
 * Reverse geocode lat/lng to address fields using Google Geocoding API.
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) {
    return null;
  }

  const key = cacheKey(lat, lng);
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  const geocoder = await getGeocoder();
  const request = {
    location: { lat: Number(lat), lng: Number(lng) },
  };

  const promise = new Promise((resolve) => {
    geocoder.geocode(request, (results, status) => {
      if (status === "OK" && results?.length) {
        const best = pickBestGeocoderResult(results, Number(lat), Number(lng));
        resolve(parseGeocoderResult(best || results[0]));
      } else {
        resolve({
          formattedAddress: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
        });
      }
    });
  });

  geocodeCache.set(key, promise);
  return promise;
}
