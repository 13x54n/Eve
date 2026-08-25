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
const GALLI_ACCESS_TOKEN = process.env.EXPO_PUBLIC_GALLI_ACCESS_TOKEN;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

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
        data?: Array<{
          name?: string;
          province?: string;
          district?: string;
          municipality?: string;
          ward?: string;
          nameLower?: string;
          id?: string;
        }>;
      };

      const results: AddressSuggestion[] = (body.data ?? []).map((item) => {
        const parts = [item.name, item.municipality, item.district, item.province].filter(
          (part): part is string => Boolean(part),
        );
        const displayName = parts.join(", ");

        return {
          label: item.name ?? item.nameLower ?? "Unknown location",
          display_name: displayName || item.nameLower || "Unknown location",
          id: item.id,
          province: item.province,
          district: item.district,
          municipality: item.municipality,
          ward: item.ward,
        };
      });

      onResults(results);
    } catch {
      onResults([]);
    }
  }, 400);
}