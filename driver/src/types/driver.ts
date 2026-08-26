export type DriverApprovalStatus =
  | 'PENDING'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export type DriverPresence = 'OFFLINE' | 'ONLINE' | 'IDLE' | 'ON_TRIP';

export type DocumentType =
  | 'IDENTITY'
  | 'LICENSE'
  | 'INSURANCE'
  | 'BACKGROUND_CHECK'
  | 'VEHICLE_REGISTRATION'
  | 'VEHICLE_INSPECTION';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface Vehicle {
  id: string;
  driverId: string | null;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  color: string;
  serviceCategory: string;
  capacity: number;
  inspectionStatus: ReviewStatus;
  city?: string | null;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  type: DocumentType;
  status: ReviewStatus;
  expiresAt: string | null;
  notes: string | null;
  reviewedAt: string | null;
}

export interface DriverUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'DRIVER' | 'RIDER' | 'ADMIN';
  city: string | null;
  accountStatus: string;
  isActive: boolean;
  createdAt: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  user: DriverUser;
  approvalStatus: DriverApprovalStatus;
  presence: DriverPresence;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  onlineHours: number;
  earningsTotal: number;
  commissionTier: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  documents: DriverDocument[];
  activeTrip: Trip | null;
  todayStats: {
    earnings: number;
    completedTrips: number;
    onlineHours: number;
  };
}

export interface Trip {
  id: string;
  bookingCode: string;
  status:
    | 'SCHEDULED'
    | 'SEARCHING'
    | 'ASSIGNED'
    | 'ONGOING'
    | 'COMPLETED'
    | 'CANCELLED';
  rideType: string;
  city: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  durationMin: number;
  fareTotal: number;
  commission?: number;
  netEarnings?: number;
  estimatedEarnings?: number;
  paymentStatus: string;
  paymentMethod: string;
  riderName?: string;
  riderRating?: number;
  cancellationReason?: string | null;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface EarningsOverview {
  summary: {
    todayEarnings: number;
    todayTrips: number;
    todayOnlineHours: number;
    weekEarnings: number;
    weekTrips: number;
    lifetimeEarnings: number;
    rating: number;
    acceptanceRate: number;
    cancellationRate: number;
  };
  recentTrips: Array<{
    id: string;
    bookingCode: string;
    pickupAddress: string;
    dropoffAddress: string;
    fareTotal: number;
    netEarnings: number;
    distanceKm: number;
    durationMin: number;
    createdAt: string;
  }>;
}
