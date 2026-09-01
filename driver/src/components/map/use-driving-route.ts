import { useEffect, useState } from "react";
import { getDrivingRoute } from "@/services/location";
import type { LatLng } from "./types";

export type DrivingRouteResult = {
  coordinates: LatLng[];
  durationMin: number | null;
};

export function useDrivingRoute(from?: LatLng | null, to?: LatLng | null): DrivingRouteResult {
  const fromKey = from ? `${from.latitude.toFixed(3)},${from.longitude.toFixed(3)}` : "";
  const toKey = to ? `${to.latitude.toFixed(3)},${to.longitude.toFixed(3)}` : "";
  const [coordinates, setCoordinates] = useState<LatLng[]>([]);
  const [durationMin, setDurationMin] = useState<number | null>(null);

  useEffect(() => {
    if (!fromKey || !toKey || !from || !to) {
      setCoordinates([]);
      setDurationMin(null);
      return;
    }
    const origin = from;
    const dest = to;
    setCoordinates([origin, dest]);
    setDurationMin(null);
    let cancelled = false;
    void getDrivingRoute(origin, dest).then((route) => {
      if (cancelled || !route?.coordinates.length) return;
      setCoordinates(route.coordinates);
      setDurationMin(Math.max(1, Math.ceil(route.durationSeconds / 60)));
    });
    return () => {
      cancelled = true;
    };
    // Keys are rounded so live GPS does not hit Directions on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey]);

  return { coordinates, durationMin };
}
