"use client";

import { useMemo, useState } from "react";
import { Badge, FilterBar, Guard, Panel, Select, StatCard, statusTone } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Dashboard = {
  totals: { riders: number; drivers: number; vehicles: number; activeUsers: number };
  drivers: { online: number; offline: number; idle: number; onTrip: number };
  rides: { ongoing: number; completed: number; cancelled: number; scheduled: number };
  finance: {
    dailyBookings: number;
    revenue: number;
    commissions: number;
    refunds: number;
    pendingPayouts: number;
  };
  queues: { driverApprovals: number; openTickets: number };
  alerts: {
    id: string;
    kind: string;
    title: string;
    body: string;
    severity: string;
    city: string | null;
  }[];
  liveMap: {
    drivers: { id: string; name: string; presence: string; lat: number | null; lng: number | null }[];
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

  return (
    <Guard allowed={can(user, "dashboard:read")}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Platform overview</h1>
          <p className="text-sm text-slate-400">
            Live operations for {user?.adminStaffRole.toLowerCase()} staff.
          </p>
        </div>
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
      {error ? <p className="mb-4 text-sm text-rose-400">{error}</p> : null}
      {loading || !data ? (
        <p className="text-sm text-slate-500">Loading KPIs…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Riders" value={data.totals.riders} />
            <StatCard label="Drivers" value={data.totals.drivers} />
            <StatCard label="Vehicles" value={data.totals.vehicles} />
            <StatCard label="Active users" value={data.totals.activeUsers} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Online drivers" value={data.drivers.online} />
            <StatCard label="Idle" value={data.drivers.idle} />
            <StatCard label="On trip" value={data.drivers.onTrip} />
            <StatCard label="Offline" value={data.drivers.offline} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Ongoing rides" value={data.rides.ongoing} />
            <StatCard label="Completed" value={data.rides.completed} />
            <StatCard label="Cancelled" value={data.rides.cancelled} />
            <StatCard label="Scheduled" value={data.rides.scheduled} />
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <StatCard label="Today bookings" value={data.finance.dailyBookings} />
            <StatCard label="Revenue" value={`$${data.finance.revenue.toFixed(2)}`} />
            <StatCard label="Commission" value={`$${data.finance.commissions.toFixed(2)}`} />
            <StatCard label="Refunds" value={`$${data.finance.refunds.toFixed(2)}`} />
            <StatCard label="Pending payouts" value={`$${data.finance.pendingPayouts.toFixed(2)}`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Live map" >
              <div className="relative h-80 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_20%_20%,#13314d,transparent_35%),linear-gradient(#082033,#061221)]">
                {data.liveMap.drivers.map((driver, index) => (
                  <span
                    key={driver.id}
                    className="absolute h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]"
                    style={{
                      left: `${20 + (index * 17) % 70}%`,
                      top: `${18 + (index * 23) % 60}%`,
                    }}
                    title={`${driver.name} · ${driver.presence}`}
                  />
                ))}
                {data.liveMap.trips.map((trip, index) => (
                  <span
                    key={trip.id}
                    className="absolute h-2 w-2 rounded-full bg-amber-300"
                    style={{
                      left: `${30 + (index * 21) % 55}%`,
                      top: `${28 + (index * 19) % 50}%`,
                    }}
                    title={`${trip.bookingCode} · ${trip.rider}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Green: active drivers. Amber: live trips.
              </p>
            </Panel>
            <Panel title="Queues">
              <div className="space-y-3 text-sm">
                <p className="flex justify-between">
                  Driver approval queue
                  <span>{data.queues.driverApprovals}</span>
                </p>
                <p className="flex justify-between">
                  Unresolved tickets
                  <span>{data.queues.openTickets}</span>
                </p>
              </div>
            </Panel>
            <Panel title="Alerts">
              <div className="space-y-3">
                {data.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-xl bg-slate-950 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm text-white">{alert.title}</p>
                      <Badge tone={statusTone(alert.severity)}>{alert.kind}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">{alert.body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </Guard>
  );
}
