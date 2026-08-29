import { api } from './api';

export type RiderVehicleType = 'BIKE' | 'CAR';
export type RideType = 'STANDARD' | 'AIRPORT' | 'MULTI_STOP' | 'SCHEDULED' | 'CORPORATE' | 'COURIER';

export type Trip = {
  id: string;
  bookingCode: string;
  status: string;
  rideType?: RideType;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  durationMin: number;
  etaMinutes?: number | null;
  fareTotal: number;
  vehicleType?: RiderVehicleType;
  recipientName?: string | null;
  recipientPhone?: string | null;
  packageNote?: string | null;
  trackingToken?: string | null;
  recipientUserId?: string | null;
  viewerRole?: 'sender' | 'recipient';
  canManage?: boolean;
  direction?: 'sent' | 'receiving';
  driver?: {
    rating?: number;
    latitude?: number | null;
    longitude?: number | null;
    user?: { name: string; phone?: string | null };
  };
  vehicle?: { make: string; model: string; plateNumber: string; color?: string };
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
  rideType?: RideType;
  recipientName?: string;
  recipientPhone?: string;
  packageNote?: string;
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

export async function getActiveTrip() {
  const { data } = await api.get<{ trip: Trip | null }>('/rider/trips/active');
  return data.trip;
}

export type TripMessage = {
  id: string;
  tripId: string;
  authorId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  authorName: string;
  authorRole: string;
};

export async function getTripMessages(tripId: string) {
  const { data } = await api.get<{ messages: TripMessage[] }>(`/rider/trips/${tripId}/messages`);
  return data.messages;
}

export async function sendTripMessage(tripId: string, body: string) {
  const { data } = await api.post<{ message: TripMessage }>(`/rider/trips/${tripId}/messages`, { body });
  return data.message;
}

export async function markTripMessagesRead(tripId: string) {
  await api.post(`/rider/trips/${tripId}/messages/read`);
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