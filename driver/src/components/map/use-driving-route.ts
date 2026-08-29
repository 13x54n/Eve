import { useEffect, useState } from "react";
import { getDrivingRoute } from "@/services/location";
import type { LatLng } from "./types";

export function useDrivingRoute(from?: LatLng | null, to?: LatLng | null): LatLng[] {
  const fromKey = from ? `${from.latitude.toFixed(3)},${from.longitude.toFixed(3)}` : "";
  const toKey = to ? `${to.latitude.toFixed(3)},${to.longitude.toFixed(3)}` : "";
  const [coordinates, setCoordinates] = useState<LatLng[]>([]);

  useEffect(() => {
    if (!fromKey || !toKey || !from || !to) {
      setCoordinates([]);
      return;
    }
    const origin = from;
    const dest = to;
    setCoordinates([origin, dest]);
    let cancelled = false;
    void getDrivingRoute(origin, dest).then((route) => {
      if (!cancelled && route?.coordinates.length) setCoordinates(route.coordinates);
    });
    return () => {
      cancelled = true;
    };
    // Keys are rounded so live GPS does not hit Directions on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey]);

  return coordinates;
}
