"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  ErrorBanner,
  FilterBar,
  Guard,
  KpiSkeleton,
  Panel,
  Select,
  StatCard,
  statusTone,
  money,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Dashboard = {
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
    ongoing: number;
    completed: number;
    cancelled: number;
    scheduled: number;
  };
  finance: {
    dailyBookings: number;
    revenue: number;
    commissions: number;
    refunds: number;
    pendingPayouts: number;
  };
  queues: {
    driverApprovals: number;
    openTickets: number;
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
    drivers: {
      id: string;
      name: string;
      presence: string;
      lat: number | null;
      lng: number | null;
    }[];
    trips: {
      id: string;
      bookingCode: string;
      status: string;
      pickupLat: number;
      pickupLng: number;
      rider: string;
    }[];
  };
};

function mapPoints(data: Dashboard["liveMap"]) {
  return [
    ...data.drivers
      .filter((driver) => driver.lat != null && driver.lng != null)
      .map((driver) => ({ lat: driver.lat as number, lng: driver.lng as number })),
    ...data.trips.map((trip) => ({ lat: trip.pickupLat, lng: trip.pickupLng })),
  ];
}

function position(lat: number, lng: number, points: { lat: number; lng: number }[], index: number) {
  if (!points.length) {
    return { left: `${20 + (index * 17) % 70}%`, top: `${18 + (index * 23) % 60}%` };
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;
  const pad = 12;

  return {
    left: `${pad + ((lng - minLng) / lngSpan) * (100 - pad * 2)}%`,
    top: `${pad + ((maxLat - lat) / latSpan) * (100 - pad * 2)}%`,
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [city, setCity] = useState("");
  const [rideType, setRideType] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (rideType) params.set("rideType", rideType);
    const suffix = params.toString();
    return `/admin/dashboard${suffix ? `?${suffix}` : ""}`;
  }, [city, rideType]);

  const { data, error, loading } = useApi<Dashboard>(query);
  const points = data ? mapPoints(data.liveMap) : [];

  return (
    <Guard allowed={can(user, "dashboard:read")}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground">
            Live operations for {user?.adminStaffRole?.toLowerCase() ?? "admin"} staff.
          </p>
          <FilterBar>
            <Select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">All cities</option>
              <option>New York</option>
              <option>Miami</option>
            </Select>
            <Select value={rideType} onChange={(event) => setRideType(event.target.value)}>
              <option value="">All services</option>
              <option value="STANDARD">Standard</option>
              <option value="AIRPORT">Airport</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CORPORATE">Corporate</option>
            </Select>
          </FilterBar>
        </div>

        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        {loading && !data ? (
          <div className="space-y-5">
            <KpiSkeleton count={4} />
            <KpiSkeleton count={4} />
          </div>
        ) : data ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Riders" value={data.totals.riders} />
              <StatCard label="Drivers" value={data.totals.drivers} />
              <StatCard label="Vehicles" value={data.totals.vehicles} />
              <StatCard label="Active users" value={data.totals.activeUsers} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Online" value={data.drivers.online} hint={`${data.drivers.onTrip} on trip`} />
              <StatCard label="Idle" value={data.drivers.idle} />
              <StatCard label="Trips live" value={data.rides.ongoing} hint={`${data.rides.scheduled} scheduled`} />
              <StatCard
                label="Completed"
                value={data.rides.completed}
                hint={`${data.rides.cancelled} cancelled`}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Bookings today" value={data.finance.dailyBookings} />
              <StatCard label="Revenue" value={money(data.finance.revenue)} />
              <StatCard label="Commission" value={money(data.finance.commissions)} />
              <StatCard label="Pending payouts" value={money(data.finance.pendingPayouts)} hint={`${money(data.finance.refunds)} refunds`} />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Live map">
                <div className="relative h-72 overflow-hidden rounded-md bg-[#111]">
                  <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#3a3a3a_1px,transparent_1px),linear-gradient(90deg,#3a3a3a_1px,transparent_1px)] [background-size:28px_28px]" />
                  {data.liveMap.drivers.map((driver, index) => (
                    <span
                      key={driver.id}
                      className="absolute z-10 h-2.5 w-2.5 rounded-full border border-black bg-live"
                      style={
                        driver.lat != null && driver.lng != null
                          ? position(driver.lat, driver.lng, points, index)
                          : position(0, 0, [], index)
                      }
                      title={`${driver.name} · ${driver.presence}`}
                    />
                  ))}
                  {data.liveMap.trips.map((trip, index) => (
                    <span
                      key={trip.id}
                      className="absolute z-10 h-2.5 w-2.5 rounded-full border border-black bg-amber-400"
                      style={position(trip.pickupLat, trip.pickupLng, points, index)}
                      title={`${trip.bookingCode} · ${trip.rider}`}
                    />
                  ))}
                </div>
                <p className="mt-2.5 text-[12px] text-muted-foreground">
                  <span className="font-medium text-emerald-700">Green</span> drivers ·{" "}
                  <span className="font-medium text-amber-700">Amber</span> live trips
                </p>
              </Panel>

              <Panel title="Queues">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-muted px-3.5 py-3">
                    <span className="text-[13px] text-muted-foreground">Driver approvals</span>
                    <span className="text-lg font-semibold">{data.queues.driverApprovals}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted px-3.5 py-3">
                    <span className="text-[13px] text-muted-foreground">Open tickets</span>
                    <span className="text-lg font-semibold">{data.queues.openTickets}</span>
                  </div>
                </div>
              </Panel>

              <Panel title="Alerts" flush>
                <div className="max-h-80 divide-y divide-border overflow-y-auto">
                  {data.alerts.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">No active alerts.</p>
                  ) : (
                    data.alerts.map((alert) => (
                      <div key={alert.id} className="px-4 py-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold">{alert.title}</p>
                          <Badge tone={statusTone(alert.severity)}>{alert.kind}</Badge>
                        </div>
                        <p className="text-[12px] leading-5 text-muted-foreground">{alert.body}</p>
                        {alert.city ? (
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{alert.city}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </div>
        ) : null}
      </div>
    </Guard>
  );
}
