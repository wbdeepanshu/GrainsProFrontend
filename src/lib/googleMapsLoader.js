/**
 * Load Google Maps JavaScript API (requires VITE_GOOGLE_MAPS_API_KEY).
 * Uses the callback pattern for reliable initialization.
 */
const CALLBACK_NAME = "__cpGoogleMapsInit";

let loadPromise = null;

export function getGoogleMapsApiKey() {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
}

export function isGoogleMapsReady() {
  return Boolean(window.google?.maps?.Map);
}

export function loadGoogleMapsApi() {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY in your .env file."
      )
    );
  }

  if (isGoogleMapsReady()) {
    return Promise.resolve(window.google);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const finish = (google) => {
      if (google?.maps?.Map) {
        resolve(google);
      } else {
        loadPromise = null;
        reject(new Error("Google Maps failed to initialize"));
      }
    };

    if (isGoogleMapsReady()) {
      finish(window.google);
      return;
    }

    const existing = document.querySelector('script[data-google-maps="true"]');
    if (existing) {
      const waitForReady = (attempt = 0) => {
        if (isGoogleMapsReady()) {
          finish(window.google);
        } else if (attempt < 100) {
          setTimeout(() => waitForReady(attempt + 1), 100);
        } else {
          loadPromise = null;
          reject(new Error("Google Maps failed to initialize"));
        }
      };
      waitForReady();
      return;
    }

    window[CALLBACK_NAME] = () => {
      try {
        delete window[CALLBACK_NAME];
        finish(window.google);
      } catch (err) {
        loadPromise = null;
        reject(err instanceof Error ? err : new Error("Google Maps failed to initialize"));
      }
    };

    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&libraries=geocoding&callback=${CALLBACK_NAME}`;
    script.onerror = () => {
      loadPromise = null;
      delete window[CALLBACK_NAME];
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
