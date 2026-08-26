import { api } from './api';
import type {
  DriverDocument,
  DriverPresence,
  DriverProfile,
  EarningsOverview,
  Trip,
  Vehicle,
} from '../types/driver';

export async function getDriverProfile(): Promise<DriverProfile> {
  const { data } = await api.get<{ driver: DriverProfile }>('/driver/me');
  return data.driver;
}

export async function updateDriverPresence(
  presence: DriverPresence,
  coords?: { latitude?: number; longitude?: number },
): Promise<DriverProfile> {
  const { data } = await api.patch<{ driver: DriverProfile }>('/driver/presence', {
    presence,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
  });
  return data.driver;
}

export async function saveDriverVehicle(vehicle: Partial<Vehicle>): Promise<DriverProfile> {
  const { data } = await api.post<{ driver: DriverProfile }>('/driver/vehicles', vehicle);
  return data.driver;
}

export async function saveDriverDocument(document: Partial<DriverDocument>): Promise<DriverProfile> {
  const { data } = await api.post<{ driver: DriverProfile }>('/driver/documents', document);
  return data.driver;
}

export async function getIncomingTrips(): Promise<Trip[]> {
  const { data } = await api.get<{ trips: Trip[] }>('/driver/trips/incoming');
  return data.trips;
}

export async function getDriverTrips(status?: string): Promise<Trip[]> {
  const { data } = await api.get<{ trips: Trip[] }>('/driver/trips', {
    params: status ? { status } : undefined,
  });
  return data.trips;
}

export async function acceptTrip(tripId: string): Promise<Trip> {
  const { data } = await api.post<{ trip: Trip }>(`/driver/trips/${tripId}/accept`);
  return data.trip;
}

export async function markArrivedAtPickup(tripId: string): Promise<Trip> {
  const { data } = await api.post<{ trip: Trip }>(`/driver/trips/${tripId}/arrived`);
  return data.trip;
}

export async function startTrip(tripId: string): Promise<Trip> {
  const { data } = await api.post<{ trip: Trip }>(`/driver/trips/${tripId}/start`);
  return data.trip;
}

export async function completeTrip(
  tripId: string,
  payload?: { rating?: number; feedback?: string },
): Promise<{ trip: Trip; earnings: any }> {
  const { data } = await api.post<{ trip: Trip; earnings: any }>(
    `/driver/trips/${tripId}/complete`,
    payload || {},
  );
  return data;
}

export async function cancelTrip(tripId: string, reason?: string): Promise<Trip> {
  const { data } = await api.post<{ trip: Trip }>(`/driver/trips/${tripId}/cancel`, {
    reason,
  });
  return data.trip;
}

export async function getDriverEarnings(): Promise<EarningsOverview> {
  const { data } = await api.get<EarningsOverview>('/driver/earnings');
  return data;
}
