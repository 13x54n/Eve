import type { StyleProp, ViewStyle } from "react-native";

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type EveCameraPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type EveCamera = {
  center: LatLng;
  zoom?: number;
  bounds?: LatLng[];
  padding?: EveCameraPadding;
};

export type EveMapProps = {
  style?: StyleProp<ViewStyle>;
  camera: EveCamera;
  interactive?: boolean;
  onPress?: (coordinate: LatLng) => void;
  children?: React.ReactNode;
};

export type EveMarkerProps = {
  id: string;
  coordinate: LatLng;
  color?: string;
  title?: string;
};

export type EveRouteProps = {
  id?: string;
  coordinates: LatLng[];
  color?: string;
};
