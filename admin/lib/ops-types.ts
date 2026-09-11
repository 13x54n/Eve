export type LiveDriver = {
  id: string;
  userId: string;
  name: string;
  presence: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

export type LiveTrip = {
  id: string;
  bookingCode: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  etaMinutes: number | null;
  rider: string;
  driver: string | null;
  driverId: string | null;
  driverLat: number | null;
  driverLng: number | null;
};

export type LiveSos = {
  id: string;
  lat: number | null;
  lng: number | null;
  severity: string;
  tripId: string | null;
  bookingCode: string | null;
};

export type Dashboard = {
  totals: {
    riders: number;
    drivers: number;
    vehicles: number;
    activeUsers: number;
  };
  drivers: {
    online: number;
    offline: number;
    idle: number;
    onTrip: number;
  };
  rides: {
    searching: number;
    assigned: number;
    ongoing: number;
    live: number;
    completed: number;
    cancelled: number;
    scheduled: number;
  };
  waits: {
    searchingMinutes: number;
    matchMinutes: number;
  };
  finance: {
    dailyBookings: number;
    matchedFares: number;
  };
  queues: {
    driverApprovals: number;
    openTickets: number;
    slaBreachedTickets: number;
    openSos: number;
    openIncidents: number;
  };
  alerts: {
    id: string;
    kind: string;
    title: string;
    body: string;
    severity: string;
    city: string | null;
  }[];
  liveMap: {
    drivers: LiveDriver[];
    trips: LiveTrip[];
    sos: LiveSos[];
  };
};

export type Analytics = {
  trips: { status: string; count: number; avgFare: number; avgDistance: number; avgDuration: number }[];
  cities: { city: string; count: number; bookings: number }[];
  rideTypes: { rideType: string; _count: { _all: number } }[];
  incidents: { type: string; _count: { _all: number } }[];
};
