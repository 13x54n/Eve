import { api } from './api';

export type PublicCourier = {
  bookingCode: string;
  status: string;
  rideType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  etaMinutes: number | null;
  recipientName: string | null;
  packageNote: string | null;
  vehicle: { make: string; model: string; color: string; plateNumber: string } | null;
  driverLocation: { latitude: number; longitude: number } | null;
};

export async function getPublicCourier(token: string) {
  const { data } = await api.get<{ courier: PublicCourier }>(`/public/courier/${token}`);
  return data.courier;
}
