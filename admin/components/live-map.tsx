"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { addAdminSocketListener } from "@/lib/socket";
import type { LiveDriver, LiveSos, LiveTrip } from "@/lib/ops-types";

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_CENTER: [number, number] = [40.758, -73.985];

function dotIcon(color: string) {
  return L.divIcon({
    className: "eve-map-dot",
    html: `<span style="display:block;width:12px;height:12px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

const ICONS = {
  online: dotIcon("#06c167"),
  idle: dotIcon("#16a34a"),
  onTrip: dotIcon("#2563eb"),
  searching: dotIcon("#d97706"),
  sos: dotIcon("#de1135"),
};

function driverColor(presence: string) {
  if (presence === "ON_TRIP") return ICONS.onTrip;
  if (presence === "IDLE") return ICONS.idle;
  return ICONS.online;
}

function FitBounds({ points, fitKey }: { points: { lat: number; lng: number }[]; fitKey: string }) {
  const map = useMap();
  const fittedKey = useRef<string | null>(null);

  useEffect(() => {
    if (points.length === 0) {
      if (fittedKey.current !== fitKey) {
        map.setView(DEFAULT_CENTER, 12);
      }
      return;
    }
    if (fittedKey.current === fitKey) {
      return;
    }
    fittedKey.current = fitKey;
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
  }, [map, fitKey, points]);

  return null;
}

export default function LiveMap({
  drivers,
  trips,
  sos,
  fitKey = "",
}: {
  drivers: LiveDriver[];
  trips: LiveTrip[];
  sos: LiveSos[];
  fitKey?: string;
}) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    return addAdminSocketListener((event, payload) => {
      if (event !== "driver:location" || !payload || typeof payload !== "object") {
        return;
      }
      const body = payload as { userId?: string; latitude?: number; longitude?: number };
      if (
        typeof body.userId !== "string" ||
        typeof body.latitude !== "number" ||
        typeof body.longitude !== "number"
      ) {
        return;
      }
      setOverrides((current) => ({
        ...current,
        [body.userId!]: { lat: body.latitude!, lng: body.longitude! },
      }));
    });
  }, []);

  const positionedDrivers = useMemo(
    () =>
      drivers
        .map((driver) => {
          const override = overrides[driver.userId];
          return {
            ...driver,
            lat: override?.lat ?? driver.lat,
            lng: override?.lng ?? driver.lng,
          };
        })
        .filter((driver) => driver.lat != null && driver.lng != null),
    [drivers, overrides],
  );

  const driverById = useMemo(
    () => Object.fromEntries(positionedDrivers.map((driver) => [driver.id, driver])),
    [positionedDrivers],
  );

  const searchingTrips = trips.filter((trip) => trip.status === "SEARCHING");

  const points = useMemo(() => {
    const next: { lat: number; lng: number }[] = [];
    for (const driver of positionedDrivers) {
      next.push({ lat: driver.lat as number, lng: driver.lng as number });
    }
    for (const trip of searchingTrips) {
      next.push({ lat: trip.pickupLat, lng: trip.pickupLng });
    }
    for (const incident of sos) {
      if (incident.lat != null && incident.lng != null) {
        next.push({ lat: incident.lat, lng: incident.lng });
      }
    }
    return next;
  }, [positionedDrivers, searchingTrips, sos]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer attribution="&copy; OpenStreetMap" url={OSM_TILES} />
      <FitBounds points={points} fitKey={fitKey} />
      {positionedDrivers.map((driver) => (
        <Marker
          key={driver.id}
          position={[driver.lat as number, driver.lng as number]}
          icon={driverColor(driver.presence)}
          eventHandlers={{ click: () => router.push(`/drivers/${driver.id}`) }}
        >
          <Popup>
            <p className="font-semibold">{driver.name}</p>
            <p className="text-[12px] text-muted-foreground">{driver.presence}</p>
          </Popup>
        </Marker>
      ))}
      {searchingTrips.map((trip) => (
        <Marker
          key={trip.id}
          position={[trip.pickupLat, trip.pickupLng]}
          icon={ICONS.searching}
          eventHandlers={{ click: () => router.push(`/trips/${trip.id}`) }}
        >
          <Popup>
            <p className="font-semibold">{trip.bookingCode}</p>
            <p className="text-[12px] text-muted-foreground">
              Searching · {trip.rider}
              {trip.etaMinutes != null ? ` · ${trip.etaMinutes} min ETA` : ""}
            </p>
          </Popup>
        </Marker>
      ))}
      {trips
        .filter((trip) => trip.status !== "SEARCHING" && !(trip.driverId && driverById[trip.driverId]))
        .map((trip) => {
          const lat = trip.driverLat ?? trip.pickupLat;
          const lng = trip.driverLng ?? trip.pickupLng;
          return (
            <Marker
              key={`trip-${trip.id}`}
              position={[lat, lng]}
              icon={ICONS.onTrip}
              eventHandlers={{ click: () => router.push(`/trips/${trip.id}`) }}
            >
              <Popup>
                <p className="font-semibold">{trip.bookingCode}</p>
                <p className="text-[12px] text-muted-foreground">
                  {trip.status} · {trip.rider}
                  {trip.driver ? ` · ${trip.driver}` : ""}
                </p>
              </Popup>
            </Marker>
          );
        })}
      {sos
        .filter((incident) => incident.lat != null && incident.lng != null)
        .map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.lat as number, incident.lng as number]}
            icon={ICONS.sos}
            eventHandlers={{
              click: () => router.push(incident.tripId ? `/trips/${incident.tripId}` : "/safety"),
            }}
          >
            <Popup>
              <p className="font-semibold">SOS · {incident.bookingCode ?? "No trip"}</p>
              <p className="text-[12px] text-muted-foreground">{incident.severity}</p>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
