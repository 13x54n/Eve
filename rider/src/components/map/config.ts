export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

export const FALLBACK_CENTER = {
  latitude: 27.7172,
  longitude: 85.324,
};

export const MAPBOX_STYLE_STREETS = "mapbox://styles/mapbox/streets-v12";
export const MAPBOX_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";

export function mapStyleForScheme(scheme: "light" | "dark") {
  return scheme === "dark" ? MAPBOX_STYLE_DARK : MAPBOX_STYLE_STREETS;
}

export function boundsFromPoints(points: { latitude: number; longitude: number }[]) {
  if (points.length === 0) return undefined;
  let minLat = points[0]!.latitude;
  let maxLat = points[0]!.latitude;
  let minLng = points[0]!.longitude;
  let maxLng = points[0]!.longitude;
  for (const point of points) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  }
  if (minLat === maxLat) {
    minLat -= 0.002;
    maxLat += 0.002;
  }
  if (minLng === maxLng) {
    minLng -= 0.002;
    maxLng += 0.002;
  }
  return {
    ne: [maxLng, maxLat] as [number, number],
    sw: [minLng, minLat] as [number, number],
  };
}
