const GOOGLE_PLACES_SRC_BASE = "https://maps.googleapis.com/maps/api/js";
const DEFAULT_GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  "AIzaSyDAB5BuHgOkYcnAcTJk6jLEkS7hSHtqNwo";

let googlePlacesScriptPromise = null;
const GOOGLE_READY_TIMEOUT_MS = 12000;
const GOOGLE_READY_POLL_MS = 100;

async function waitForGooglePlacesReady() {
  if (window.google?.maps?.places) return window.google.maps.places;

  if (window.google?.maps?.importLibrary) {
    try {
      await window.google.maps.importLibrary("places");
    } catch {
      // Fall through to polling fallback.
    }
    if (window.google?.maps?.places) return window.google.maps.places;
  }

  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.google?.maps?.places) {
        resolve(window.google.maps.places);
        return;
      }

      if (Date.now() - startedAt > GOOGLE_READY_TIMEOUT_MS) {
        reject(new Error("Google Places library unavailable after script load"));
        return;
      }

      window.setTimeout(check, GOOGLE_READY_POLL_MS);
    };
    check();
  });
}

export async function ensureGooglePlacesLoaded({
  apiKey = DEFAULT_GOOGLE_MAPS_API_KEY,
  libraries = ["places"],
} = {}) {
  if (window.google?.maps?.places) return window.google.maps.places;
  if (!apiKey) throw new Error("Google Maps API key is missing");
  if (googlePlacesScriptPromise) return googlePlacesScriptPromise;

  const librariesParam = Array.isArray(libraries) ? libraries.join(",") : "places";
  const src = `${GOOGLE_PLACES_SRC_BASE}?key=${encodeURIComponent(
    apiKey
  )}&libraries=${encodeURIComponent(librariesParam)}&loading=async`;

  googlePlacesScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-places="true"]');
    if (existing) {
      existing.addEventListener(
        "load",
        () => resolve(window.google?.maps?.places || null),
        { once: true }
      );
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Places script")),
        { once: true }
      );

      if (existing.dataset.loaded === "true" || existing.readyState === "complete") {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.googlePlaces = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google Places script"));
    document.head.appendChild(script);
  })
    .then(() => waitForGooglePlacesReady())
    .catch((error) => {
      googlePlacesScriptPromise = null;
      throw error;
    });

  return googlePlacesScriptPromise;
}

export function parseGoogleAddressComponents(place) {
  const components = place?.address_components || [];
  const result = {
    lot_number: "",
    unit_number: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    country: "",
    street_number: "",
    street: "",
    formatted_address: place?.formatted_address || "",
  };

  components.forEach((component) => {
    if (component.types.includes("subpremise")) result.unit_number = component.long_name;
    if (component.types.includes("premise")) result.lot_number = component.long_name;
    if (component.types.includes("lot_number")) result.lot_number = component.long_name;
    if (component.types.includes("street_number")) result.street_number = component.long_name;
    if (component.types.includes("route")) result.street = component.long_name;
    if (component.types.includes("locality")) result.city = component.long_name;
    if (
      component.types.includes("sublocality") ||
      component.types.includes("sublocality_level_1")
    ) {
      result.city = component.long_name;
    }
    if (component.types.includes("administrative_area_level_1")) {
      result.state = component.short_name;
    }
    if (component.types.includes("postal_code")) result.zip_code = component.long_name;
    if (component.types.includes("country")) result.country = component.short_name;
  });

  const formatted = result.formatted_address || "";
  const unitMatch =
    formatted.match(/(Unit|Apt|Apartment|Suite)\s*([\w-]+)/i) ||
    formatted.match(/^([\w-]+)\//);
  if (!result.unit_number && unitMatch) {
    result.unit_number = unitMatch[2] || unitMatch[1] || "";
  }

  const lotMatch = formatted.match(/Lot\s*([\w-]+)/i) || formatted.match(/\bL(\d+)\b/i);
  if (!result.lot_number && lotMatch) {
    result.lot_number = lotMatch[1] || "";
  }

  result.address = `${result.street_number} ${result.street}`.trim() || formatted;
  return result;
}
