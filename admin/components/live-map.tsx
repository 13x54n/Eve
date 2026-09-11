"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Map, { Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { addAdminSocketListener } from "@/lib/socket";
import type { LiveDriver, LiveSos, LiveTrip } from "@/lib/ops-types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";
const FALLBACK = { longitude: 85.324, latitude: 27.7172, zoom: 12 };

const COLORS = {
  online: "#06c167",
  idle: "#16a34a",
  onTrip: "#2563eb",
  searching: "#d97706",
  sos: "#de1135",
};

function driverColor(presence: string) {
  if (presence === "ON_TRIP") return COLORS.onTrip;
  if (presence === "IDLE") return COLORS.idle;
  return COLORS.online;
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "block",
        width: 12,
        height: 12,
        borderRadius: 999,
        background: color,
        border: "2px solid #fff",
        boxShadow: "0 0 0 1px rgba(0,0,0,.25)",
        cursor: "pointer",
      }}
    />
  );
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
  const mapRef = useRef<MapRef>(null);
  const fittedKey = useRef<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { lat: number; lng: number }>>({});
  const [popup, setPopup] = useState<{
    lat: number;
    lng: number;
    title: string;
    body: string;
  } | null>(null);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedKey.current === fitKey) return;
    fittedKey.current = fitKey;
    if (points.length === 0) {
      map.flyTo({ center: [FALLBACK.longitude, FALLBACK.latitude], zoom: 12, duration: 400 });
      return;
    }
    if (points.length === 1) {
      map.flyTo({ center: [points[0]!.lng, points[0]!.lat], zoom: 14, duration: 400 });
      return;
    }
    const lngs = points.map((point) => point.lng);
    const lats = points.map((point) => point.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 28, maxZoom: 14, duration: 600 },
    );
  }, [fitKey, points]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-muted-foreground">
        Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to load the live map.
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={MAP_STYLE}
      initialViewState={FALLBACK}
      style={{ width: "100%", height: "100%" }}
      attributionControl
    >
      {positionedDrivers.map((driver) => (
        <Marker
          key={driver.id}
          longitude={driver.lng as number}
          latitude={driver.lat as number}
          anchor="center"
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            setPopup({
              lat: driver.lat as number,
              lng: driver.lng as number,
              title: driver.name,
              body: driver.presence,
            });
            router.push(`/drivers/${driver.id}`);
          }}
        >
          <Dot color={driverColor(driver.presence)} />
        </Marker>
      ))}
      {searchingTrips.map((trip) => (
        <Marker
          key={trip.id}
          longitude={trip.pickupLng}
          latitude={trip.pickupLat}
          anchor="center"
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            setPopup({
              lat: trip.pickupLat,
              lng: trip.pickupLng,
              title: trip.bookingCode,
              body: `Searching · ${trip.rider}${trip.etaMinutes != null ? ` · ${trip.etaMinutes} min ETA` : ""}`,
            });
            router.push(`/trips/${trip.id}`);
          }}
        >
          <Dot color={COLORS.searching} />
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
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                setPopup({
                  lat,
                  lng,
                  title: trip.bookingCode,
                  body: `${trip.status} · ${trip.rider}${trip.driver ? ` · ${trip.driver}` : ""}`,
                });
                router.push(`/trips/${trip.id}`);
              }}
            >
              <Dot color={COLORS.onTrip} />
            </Marker>
          );
        })}
      {sos
        .filter((incident) => incident.lat != null && incident.lng != null)
        .map((incident) => (
          <Marker
            key={incident.id}
            longitude={incident.lng as number}
            latitude={incident.lat as number}
            anchor="center"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              setPopup({
                lat: incident.lat as number,
                lng: incident.lng as number,
                title: `SOS · ${incident.bookingCode ?? "No trip"}`,
                body: incident.severity,
              });
              router.push(incident.tripId ? `/trips/${incident.tripId}` : "/safety");
            }}
          >
            <Dot color={COLORS.sos} />
          </Marker>
        ))}
      {popup ? (
        <Popup
          longitude={popup.lng}
          latitude={popup.lat}
          anchor="bottom"
          offset={12}
          onClose={() => setPopup(null)}
          closeOnClick={false}
        >
          <p className="font-semibold">{popup.title}</p>
          <p className="text-[12px] text-muted-foreground">{popup.body}</p>
        </Popup>
      ) : null}
    </Map>
  );
}
