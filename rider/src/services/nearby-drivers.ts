import { api } from "./api";

export type NearbyDriverPin = {
  id: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

export async function getNearbyDrivers(lat: number, lng: number) {
  const { data } = await api.get<{ drivers: NearbyDriverPin[] }>("/rider/nearby-drivers", {
    params: { lat, lng },
  });
  return data.drivers ?? [];
}
