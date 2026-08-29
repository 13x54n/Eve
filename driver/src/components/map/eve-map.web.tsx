import { createContext, useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useAppTheme } from "@/context/theme-context";
import { MAPBOX_ACCESS_TOKEN, boundsFromPoints, mapStyleForScheme } from "./config";
import type { EveMapProps, EveMarkerProps, EveRouteProps } from "./types";

const WebMapContext = createContext<{ map: mapboxgl.Map | null }>({ map: null });

export function EveMap({
  style,
  camera,
  interactive = true,
  onPress,
  children,
}: EveMapProps) {
  const { scheme } = useAppTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current || !MAPBOX_ACCESS_TOKEN) return;

    const instance = new mapboxgl.Map({
      container: el,
      style: mapStyleForScheme(scheme),
      center: [camera.center.longitude, camera.center.latitude],
      zoom: camera.zoom ?? 13,
      interactive,
      accessToken: MAPBOX_ACCESS_TOKEN,
      attributionControl: true,
    });
    mapRef.current = instance;
    instance.on("load", () => setMap(instance));
    instance.on("click", (event) => {
      onPressRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });

    const resize = () => instance.resize();
    window.addEventListener("resize", resize);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(el);

    return () => {
      window.removeEventListener("resize", resize);
      observer?.disconnect();
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
    // Created once per style/interaction mode; camera updates in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme, interactive]);

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance?.loaded()) return;
    const fitted = camera.bounds?.length ? boundsFromPoints(camera.bounds) : undefined;
    if (fitted) {
      instance.fitBounds([fitted.sw, fitted.ne], {
        padding: camera.padding ?? 48,
        duration: 400,
        maxZoom: 15,
      });
      return;
    }
    instance.easeTo({
      center: [camera.center.longitude, camera.center.latitude],
      zoom: camera.zoom ?? 13,
      duration: 400,
    });
  }, [camera]);

  return (
    <View style={[styles.host, style]}>
      <div ref={containerRef} style={webFill} />
      <WebMapContext.Provider value={{ map }}>{children}</WebMapContext.Provider>
    </View>
  );
}

export function EveMarker({ id, coordinate, color = "#2E4ED5" }: EveMarkerProps) {
  const { map } = useContext(WebMapContext);

  useEffect(() => {
    if (!map) return;
    const el = document.createElement("div");
    el.title = id;
    el.style.cssText = [
      "width:16px",
      "height:16px",
      "border-radius:999px",
      `background:${color}`,
      "border:2px solid #fff",
      "box-shadow:0 0 0 1px rgba(0,0,0,.25)",
    ].join(";");
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([coordinate.longitude, coordinate.latitude])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, id, coordinate.latitude, coordinate.longitude, color]);

  return null;
}

export function EveRoute({
  id = "route",
  coordinates,
  color = "#2E4ED5",
}: EveRouteProps) {
  const { map } = useContext(WebMapContext);
  const layerId = `${id}-line`;
  const coordsKey = coordinates.map((point) => `${point.longitude},${point.latitude}`).join(";");

  useEffect(() => {
    if (!map || coordinates.length < 2) return;
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coordinates.map((point) => [point.longitude, point.latitude]),
      },
    };

    const apply = () => {
      const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource(id, { type: "geojson", data });
      map.addLayer({
        id: layerId,
        type: "line",
        source: id,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 4 },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(id)) map.removeSource(id);
    };
  }, [map, id, layerId, coordsKey, color, coordinates]);

  return null;
}

const styles = StyleSheet.create({
  host: { flex: 1, overflow: "hidden" },
});

const webFill = {
  position: "absolute",
  inset: 0,
} as const;
