"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  FilterBar,
  Guard,
  Panel,
  Select,
  StatCard,
  statusTone,
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
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Platform overview
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Live operations for{" "}
              {user?.adminStaffRole?.toLowerCase() ?? "admin"} staff.
            </p>
          </div>

          <FilterBar>
            <Select
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="">All cities</option>
              <option>New York</option>
              <option>Miami</option>
            </Select>

            <Select
              value={rideType}
              onChange={(event) => setRideType(event.target.value)}
            >
              <option value="">All services</option>
              <option value="STANDARD">Standard</option>
              <option value="AIRPORT">Airport</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CORPORATE">Corporate</option>
            </Select>
          </FilterBar>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading || !data ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
            Loading KPIs…
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Riders" value={data.totals.riders} />
              <StatCard label="Drivers" value={data.totals.drivers} />
              <StatCard label="Vehicles" value={data.totals.vehicles} />
              <StatCard
                label="Active users"
                value={data.totals.activeUsers}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Panel title="Live map">
                <div className="relative h-80 overflow-hidden rounded-xl border border-slate-700 bg-[radial-gradient(circle_at_20%_20%,#13314d,transparent_35%),radial-gradient(circle_at_75%_65%,#123b35,transparent_30%),linear-gradient(135deg,#0b1726,#020617)]">
                  <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:32px_32px]" />

                  {data.liveMap.drivers.map((driver, index) => (
                    <span
                      key={driver.id}
                      className="absolute z-10 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]"
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
                      className="absolute z-10 h-3 w-3 rounded-full border-2 border-slate-950 bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.65)]"
                      style={{
                        left: `${30 + (index * 21) % 55}%`,
                        top: `${28 + (index * 19) % 50}%`,
                      }}
                      title={`${trip.bookingCode} · ${trip.rider}`}
                    />
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-600">Green:</span>{" "}
                  active drivers.{" "}
                  <span className="font-semibold text-amber-600">Amber:</span>{" "}
                  live trips.
                </p>
              </Panel>

              <Panel title="Queues">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3.5">
                    <span className="text-slate-600 font-medium">
                      Driver approval queue
                    </span>

                    <span className="font-bold text-slate-900">
                      {data.queues.driverApprovals}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3.5">
                    <span className="text-slate-600 font-medium">
                      Unresolved tickets
                    </span>

                    <span className="font-bold text-slate-900">
                      {data.queues.openTickets}
                    </span>
                  </div>
                </div>
              </Panel>

              <Panel title="Alerts">
                <div className="space-y-3">
                  {data.alerts.length === 0 ? (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
                      No active alerts.
                    </div>
                  ) : (
                    data.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {alert.title}
                          </p>

                          <Badge tone={statusTone(alert.severity)}>
                            {alert.kind}
                          </Badge>
                        </div>

                        <p className="text-xs leading-5 text-slate-600">
                          {alert.body}
                        </p>

                        {alert.city ? (
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {alert.city}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </Guard>
  );
}