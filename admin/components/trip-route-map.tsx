"use client";

import { useEffect, useRef } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

function coord(value: number) {
  return Number.isFinite(value) ? value : NaN;
}

function Pin({ color, label }: { color: string; label: string }) {
  return (
    <span
      title={label}
      style={{
        display: "block",
        width: 14,
        height: 14,
        borderRadius: 999,
        background: color,
        border: "2px solid #fff",
        boxShadow: "0 0 0 1px rgba(0,0,0,.25)",
      }}
    />
  );
}

export default function TripRouteMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
}: {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}) {
  const mapRef = useRef<MapRef>(null);
  const pickup = { lat: coord(pickupLat), lng: coord(pickupLng) };
  const dropoff = { lat: coord(dropoffLat), lng: coord(dropoffLng) };
  const valid =
    Number.isFinite(pickup.lat) &&
    Number.isFinite(pickup.lng) &&
    Number.isFinite(dropoff.lat) &&
    Number.isFinite(dropoff.lng);

  function fit(map: MapRef) {
    if (pickup.lat === dropoff.lat && pickup.lng === dropoff.lng) {
      map.flyTo({ center: [pickup.lng, pickup.lat], zoom: 14, duration: 400 });
      return;
    }
    map.fitBounds(
      [
        [Math.min(pickup.lng, dropoff.lng), Math.min(pickup.lat, dropoff.lat)],
        [Math.max(pickup.lng, dropoff.lng), Math.max(pickup.lat, dropoff.lat)],
      ],
      { padding: 48, maxZoom: 14, duration: 500 },
    );
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !valid) return;
    fit(map);
  }, [valid, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-muted-foreground">
        Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to load the trip map.
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-muted-foreground">
        This trip has no usable pickup or dropoff coordinates.
      </div>
    );
  }

  const line = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: [
        [pickup.lng, pickup.lat],
        [dropoff.lng, dropoff.lat],
      ],
    },
  };

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={MAP_STYLE}
      initialViewState={{
        longitude: (pickup.lng + dropoff.lng) / 2,
        latitude: (pickup.lat + dropoff.lat) / 2,
        zoom: 12,
      }}
      style={{ width: "100%", height: "100%" }}
      attributionControl
      onLoad={() => {
        const map = mapRef.current;
        if (!map) return;
        map.getMap().resize();
        fit(map);
      }}
    >
      <Source id="trip-route" type="geojson" data={line}>
        <Layer
          id="trip-route-line"
          type="line"
          paint={{
            "line-color": "#0c0c0c",
            "line-width": 3,
            "line-opacity": 0.7,
          }}
        />
      </Source>
      <Marker longitude={pickup.lng} latitude={pickup.lat} anchor="center">
        <Pin color="#06c167" label="Pickup" />
      </Marker>
      <Marker longitude={dropoff.lng} latitude={dropoff.lat} anchor="center">
        <Pin color="#d97706" label="Dropoff" />
      </Marker>
    </Map>
  );
}
