import { Camera, LineLayer, MapView, PointAnnotation, ShapeSource } from "@rnmapbox/maps";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/theme-context";
import { boundsFromPoints, mapStyleForScheme } from "./config";
import type { EveMapProps, EveMarkerProps, EveRouteProps } from "./types";

export function EveMap({
  style,
  camera,
  interactive = true,
  onPress,
  children,
}: EveMapProps) {
  const { scheme } = useAppTheme();
  const fitted = camera.bounds?.length ? boundsFromPoints(camera.bounds) : undefined;
  const padding = camera.padding;

  return (
    <MapView
      style={[{ flex: 1 }, style]}
      styleURL={mapStyleForScheme(scheme)}
      scaleBarEnabled={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
      onPress={
        onPress
          ? (feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              if (typeof lng === "number" && typeof lat === "number") {
                onPress({ latitude: lat, longitude: lng });
              }
            }
          : undefined
      }
    >
      <Camera
        defaultSettings={{
          centerCoordinate: [camera.center.longitude, camera.center.latitude],
          zoomLevel: camera.zoom ?? 13,
        }}
        centerCoordinate={fitted ? undefined : [camera.center.longitude, camera.center.latitude]}
        zoomLevel={fitted ? undefined : camera.zoom ?? 13}
        bounds={
          fitted
            ? {
                ne: fitted.ne,
                sw: fitted.sw,
                paddingTop: padding?.top ?? 48,
                paddingRight: padding?.right ?? 48,
                paddingBottom: padding?.bottom ?? 48,
                paddingLeft: padding?.left ?? 48,
              }
            : undefined
        }
        animationDuration={400}
        animationMode="easeTo"
      />
      {children}
    </MapView>
  );
}

export function EveMarker({ id, coordinate, color = "#2E4ED5" }: EveMarkerProps) {
  return (
    <PointAnnotation id={id} coordinate={[coordinate.longitude, coordinate.latitude]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </PointAnnotation>
  );
}

export function EveRoute({
  id = "route",
  coordinates,
  color = "#2E4ED5",
}: EveRouteProps) {
  if (coordinates.length < 2) return null;
  return (
    <ShapeSource
      id={id}
      shape={{
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates.map((point) => [point.longitude, point.latitude]),
        },
      }}
    >
      <LineLayer
        id={`${id}-line`}
        style={{
          lineColor: color,
          lineWidth: 4,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    </ShapeSource>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
