import { api } from './api';

export type RiderVehicleType = 'BIKE' | 'CAR';

export type Trip = {
  id: string;
  bookingCode: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  durationMin: number;
  fareTotal: number;
  vehicleType?: RiderVehicleType;
  offers?: TripOffer[];
  createdAt: string;
};

export type TripOffer = {
  id: string;
  proposedFare: number;
  etaMinutes: number;
  status: string;
  driver?: { id: string; rating: number; user: { name: string } };
};

export async function createTrip(input: {
  pickupAddress: string;
  dropoffAddress: string;
  city: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: RiderVehicleType;
}) {
  const { data } = await api.post<{ trip: Trip }>('/rider/trips', input);
  return data.trip;
}

export async function getTrip(id: string) {
  const { data } = await api.get<{ trip: Trip }>(`/rider/trips/${id}`);
  return data.trip;
}

export async function getTrips() {
  const { data } = await api.get<{ trips: Trip[] }>('/rider/trips');
  return data.trips;
}

export async function acceptOffer(tripId: string, offerId: string) {
  const { data } = await api.post<{ trip: Trip }>(
    `/rider/trips/${tripId}/offers/${offerId}/accept`,
  );
  return data.trip;
}

export async function cancelTrip(id: string) {
  const { data } = await api.post<{ trip: Trip }>(`/rider/trips/${id}/cancel`);
  return data.trip;
}