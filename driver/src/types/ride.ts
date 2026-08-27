export type RideStatus =
  | "REQUESTED"
  | "SEARCHING"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVING"
  | "DRIVER_ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationPoint = Coordinates & {
  address: string;
};

export type Ride = {
  id: string;
  riderId: string;
  driverId?: string;
  pickup: LocationPoint;
  destination: LocationPoint;
  status: RideStatus;
  estimatedFare?: number;
  finalFare?: number;
  estimatedDurationMinutes?: number;
  requestedAt: string;
};