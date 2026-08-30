export const MATCH_RADIUS_KM = 15;
export const MATCH_LIMIT = 5;

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(toLat - fromLat);
  const longitudeDelta = radians(toLng - fromLng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function durationMinutes(distance: number) {
  return Math.max(5, Math.ceil(distance / 0.45));
}
