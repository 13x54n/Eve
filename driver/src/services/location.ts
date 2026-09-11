export type AddressSuggestion = {
  label: string;
  lat?: number;
  lng?: number;
  display_name: string;
  id?: string;
  province?: string;
  district?: string;
  municipality?: string;
  ward?: string;
};

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type DrivingRoute = {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward";
const REVERSE_URL = "https://api.mapbox.com/search/geocode/v6/reverse";
const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
const FALLBACK_LAT = 27.7172;
const FALLBACK_LNG = 85.324;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let searchAbort: AbortController | undefined;

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function featureCoords(feature: Record<string, unknown>): { lat: number; lng: number } | undefined {
  const properties = feature.properties as Record<string, unknown> | undefined;
  const propertyCoords = properties?.coordinates as Record<string, unknown> | undefined;
  const propLat = asNumber(propertyCoords?.latitude);
  const propLng = asNumber(propertyCoords?.longitude);
  if (propLat != null && propLng != null) return { lat: propLat, lng: propLng };

  const geometry = feature.geometry as { coordinates?: unknown } | undefined;
  if (Array.isArray(geometry?.coordinates) && geometry.coordinates.length >= 2) {
    const lng = asNumber(geometry.coordinates[0]);
    const lat = asNumber(geometry.coordinates[1]);
    if (lat != null && lng != null) return { lat, lng };
  }
  return undefined;
}

function featureToSuggestion(feature: Record<string, unknown>): AddressSuggestion {
  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const name =
    (typeof properties.name_preferred === "string" && properties.name_preferred) ||
    (typeof properties.name === "string" && properties.name) ||
    "Unknown location";
  const display =
    (typeof properties.full_address === "string" && properties.full_address) ||
    (typeof properties.place_formatted === "string" && properties.place_formatted) ||
    name;
  const coords = featureCoords(feature);
  return {
    id: typeof feature.id === "string" ? feature.id : undefined,
    label: name,
    display_name: display,
    lat: coords?.lat,
    lng: coords?.lng,
  };
}

function warnMissingToken() {
  console.warn("EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not configured; address search is disabled.");
}

export async function geocodeSuggestion(
  item: AddressSuggestion,
  center?: { lat: number; lng: number },
): Promise<{ lat: number; lng: number } | undefined> {
  if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
  if (!MAPBOX_TOKEN) return undefined;

  const params = new URLSearchParams({
    q: item.label,
    access_token: MAPBOX_TOKEN,
    limit: "1",
    proximity: `${center?.lng ?? FALLBACK_LNG},${center?.lat ?? FALLBACK_LAT}`,
  });
  try {
    const response = await fetch(`${GEOCODE_URL}?${params}`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { features?: Record<string, unknown>[] };
    for (const feature of body.features ?? []) {
      const coords = featureCoords(feature);
      if (coords) return coords;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | undefined> {
  if (!MAPBOX_TOKEN) return undefined;
  const params = new URLSearchParams({
    longitude: String(longitude),
    latitude: String(latitude),
    access_token: MAPBOX_TOKEN,
    limit: "1",
  });
  try {
    const response = await fetch(`${REVERSE_URL}?${params}`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { features?: Record<string, unknown>[] };
    const first = body.features?.[0];
    if (!first) return undefined;
    return featureToSuggestion(first).display_name;
  } catch {
    return undefined;
  }
}

export function searchAddresses(
  query: string,
  onResults: (results: AddressSuggestion[]) => void,
  center?: { lat: number; lng: number },
) {
  if (debounceTimer) clearTimeout(debounceTimer);
  searchAbort?.abort();

  if (!query || query.trim().length < 3) {
    onResults([]);
    return;
  }

  if (!MAPBOX_TOKEN) {
    warnMissingToken();
    onResults([]);
    return;
  }

  debounceTimer = setTimeout(async () => {
    const controller = new AbortController();
    searchAbort = controller;
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        access_token: MAPBOX_TOKEN,
        autocomplete: "true",
        limit: "6",
        proximity: `${center?.lng ?? FALLBACK_LNG},${center?.lat ?? FALLBACK_LAT}`,
      });
      const response = await fetch(`${GEOCODE_URL}?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Mapbox geocode failed: ${response.status}`);
      const body = (await response.json()) as { features?: Record<string, unknown>[] };
      onResults((body.features ?? []).map(featureToSuggestion));
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      onResults([]);
    }
  }, 400);
}

export async function getDrivingRoute(from: LatLng, to: LatLng): Promise<DrivingRoute | undefined> {
  if (!MAPBOX_TOKEN) return undefined;
  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    access_token: MAPBOX_TOKEN,
  });
  try {
    const response = await fetch(`${DIRECTIONS_URL}/${path}?${params}`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: unknown };
      }>;
    };
    const route = body.routes?.[0];
    const raw = route?.geometry?.coordinates;
    if (!Array.isArray(raw) || raw.length < 2) return undefined;
    const coordinates: LatLng[] = [];
    for (const pair of raw) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lng = asNumber(pair[0]);
      const lat = asNumber(pair[1]);
      if (lat != null && lng != null) coordinates.push({ latitude: lat, longitude: lng });
    }
    if (coordinates.length < 2) return undefined;
    return {
      coordinates,
      distanceMeters: route?.distance ?? 0,
      durationSeconds: route?.duration ?? 0,
    };
  } catch {
    return undefined;
  }
}
