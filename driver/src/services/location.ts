import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const NYC_COORDINATES: Coordinates = {
  latitude: 40.758,
  longitude: -73.9855,
};

export const DEFAULT_DELTA = {
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getCurrentDriverLocation(): Promise<Coordinates> {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      return NYC_COORDINATES;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.warn('Could not fetch device location, using fallback:', error);
    return NYC_COORDINATES;
  }
}
