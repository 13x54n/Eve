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

const GALLI_AUTOCOMPLETE_URL =
  "https://route-init.gallimap.com/api/v1/search/autocomplete";
const GALLI_SEARCH_URL = "https://route-init.gallimap.com/api/v1/search";
const GALLI_ACCESS_TOKEN = process.env.EXPO_PUBLIC_GALLI_ACCESS_TOKEN;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractLatLng(value: unknown): { lat: number; lng: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const lat = asNumber(record.lat ?? record.latitude ?? record.y);
  const lng = asNumber(record.lng ?? record.lon ?? record.longitude ?? record.x);
  if (lat != null && lng != null) return { lat, lng };

  const geometry = record.geometry;
  if (geometry && typeof geometry === "object") {
    const coordinates = (geometry as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const geoLng = asNumber(coordinates[0]);
      const geoLat = asNumber(coordinates[1]);
      if (geoLat != null && geoLng != null) return { lat: geoLat, lng: geoLng };
    }
  }

  if (Array.isArray(record.coordinates) && record.coordinates.length >= 2) {
    const geoLng = asNumber(record.coordinates[0]);
    const geoLat = asNumber(record.coordinates[1]);
    if (geoLat != null && geoLng != null) return { lat: geoLat, lng: geoLng };
  }

  return extractLatLng(record.location) ?? extractLatLng(record.position);
}

export async function geocodeSuggestion(
  item: AddressSuggestion,
  center?: { lat: number; lng: number },
): Promise<{ lat: number; lng: number } | undefined> {
  if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
  if (!GALLI_ACCESS_TOKEN) return undefined;

  const params = new URLSearchParams({
    accessToken: GALLI_ACCESS_TOKEN,
    name: item.label,
    lat: String(center?.lat ?? 27.7172),
    lng: String(center?.lng ?? 85.324),
  });
  if (item.id) params.set("id", item.id);

  try {
    const response = await fetch(`${GALLI_SEARCH_URL}?${params}`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { data?: unknown; features?: unknown };
    const rows = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.features)
        ? body.features
        : [];
    for (const row of rows) {
      const coords = extractLatLng(row);
      if (coords) return coords;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function searchAddresses(
  query: string,
  onResults: (results: AddressSuggestion[]) => void,
  center?: { lat: number; lng: number }
) {
  if (debounceTimer) clearTimeout(debounceTimer);

  if (!query || query.trim().length < 3) {
    onResults([]);
    return;
  }

  if (!GALLI_ACCESS_TOKEN) {
    console.warn(
      "EXPO_PUBLIC_GALLI_ACCESS_TOKEN is not configured; address search is disabled.",
    );
    onResults([]);
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const params = new URLSearchParams({
        accessToken: GALLI_ACCESS_TOKEN,
        word: query.trim(),
        lat: String(center?.lat ?? 27.7172),
        lng: String(center?.lng ?? 85.324),
      });
      const response = await fetch(`${GALLI_AUTOCOMPLETE_URL}?${params}`);

      if (!response.ok) throw new Error(`Galli autocomplete failed: ${response.status}`);

      const body = (await response.json()) as {
        success?: boolean;
        data?: Array<Record<string, unknown>>;
      };

      const results: AddressSuggestion[] = (body.data ?? []).map((item) => {
        const name = typeof item.name === "string" ? item.name : undefined;
        const nameLower = typeof item.nameLower === "string" ? item.nameLower : undefined;
        const municipality = typeof item.municipality === "string" ? item.municipality : undefined;
        const district = typeof item.district === "string" ? item.district : undefined;
        const province = typeof item.province === "string" ? item.province : undefined;
        const ward = typeof item.ward === "string" ? item.ward : undefined;
        const id = typeof item.id === "string" ? item.id : undefined;
        const parts = [name, municipality, district, province].filter(
          (part): part is string => Boolean(part),
        );
        const displayName = parts.join(", ");
        const coords = extractLatLng(item);

        return {
          label: name ?? nameLower ?? "Unknown location",
          display_name: displayName || nameLower || "Unknown location",
          id,
          province,
          district,
          municipality,
          ward,
          lat: coords?.lat,
          lng: coords?.lng,
        };
      });

      onResults(results);
    } catch {
      onResults([]);
    }
  }, 400);
}
