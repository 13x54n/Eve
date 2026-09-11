"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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
import { BarList } from "@/components/bar-list";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import type { Analytics, Dashboard } from "@/lib/ops-types";

const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[12px] text-muted-foreground">Loading map…</div>,
});

function formatWait(minutes: number) {
  if (!minutes) {
    return "—";
  }
  if (minutes < 1) {
    return "<1m";
  }
  return `${minutes.toFixed(1)}m`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [city, setCity] = useState("");
  const [rideType, setRideType] = useState("");
  const canAnalytics = can(user, "analytics:read");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (rideType) params.set("rideType", rideType);
    const suffix = params.toString();
    return `/admin/dashboard${suffix ? `?${suffix}` : ""}`;
  }, [city, rideType]);

  const analyticsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (rideType) params.set("rideType", rideType);
    const suffix = params.toString();
    return `/admin/analytics${suffix ? `?${suffix}` : ""}`;
  }, [city, rideType]);

  const { data, error, loading } = useApi<Dashboard>(query, { intervalMs: 8000 });
  const { data: analytics } = useApi<Analytics>(canAnalytics ? analyticsQuery : null, {
    intervalMs: 30_000,
  });

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
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
              <StatCard label="Online" value={data.drivers.online} hint={`${data.drivers.offline} offline`} />
              <StatCard label="Idle" value={data.drivers.idle} />
              <StatCard label="On trip" value={data.drivers.onTrip} />
              <StatCard label="Searching" value={data.rides.searching} hint={`${data.rides.live} live`} />
              <StatCard label="Avg wait" value={formatWait(data.waits.searchingMinutes)} hint={`${formatWait(data.waits.matchMinutes)} to match`} />
              <StatCard label="Open SOS" value={data.queues.openSos} hint={`${data.queues.openIncidents} incidents`} />
              <StatCard label="Open tickets" value={data.queues.openTickets} hint={`${data.queues.slaBreachedTickets} past SLA`} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Bookings today" value={data.finance.dailyBookings} />
              <StatCard
                label="Matched fares today"
                value={money(data.finance.matchedFares)}
                hint="Off-platform · no Eve commission"
              />
              <StatCard label="Completed" value={data.rides.completed} hint={`${data.rides.cancelled} cancelled`} />
              <StatCard label="Assigned / ongoing" value={`${data.rides.assigned} / ${data.rides.ongoing}`} />
            </div>

            <Panel title="Live map">
              <div className="relative h-[480px] overflow-hidden rounded-md">
                <LiveMap
                  drivers={data.liveMap.drivers}
                  trips={data.liveMap.trips}
                  sos={data.liveMap.sos ?? []}
                  fitKey={`${city}-${rideType}`}
                />
              </div>
              <p className="mt-2.5 text-[12px] text-muted-foreground">
                <span className="font-medium text-emerald-700">Green</span> available drivers ·{" "}
                <span className="font-medium text-blue-700">Blue</span> on trip ·{" "}
                <span className="font-medium text-amber-700">Amber</span> searching ·{" "}
                <span className="font-medium text-red-700">Red</span> SOS
              </p>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Queues">
                <div className="space-y-2">
                  <QueueRow href="/drivers" label="Driver approvals" value={data.queues.driverApprovals} />
                  <QueueRow href="/support" label="Open tickets" value={data.queues.openTickets} />
                  <QueueRow href="/support" label="SLA breached" value={data.queues.slaBreachedTickets} />
                  <QueueRow href="/safety" label="Open incidents" value={data.queues.openIncidents} />
                </div>
              </Panel>

              <Panel title="Trip mix" flush>
                <div className="p-4">
                  <BarList
                    items={[
                      { label: "Searching", value: data.rides.searching },
                      { label: "Assigned", value: data.rides.assigned },
                      { label: "Ongoing", value: data.rides.ongoing },
                      { label: "Completed", value: data.rides.completed },
                      { label: "Cancelled", value: data.rides.cancelled },
                    ]}
                  />
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

            {canAnalytics && analytics ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Bookings by city">
                  <BarList
                    items={analytics.cities.map((row) => ({ label: row.city || "Unknown", value: row.count }))}
                    empty="No city volume yet."
                  />
                </Panel>
                <Panel title="Incidents by type">
                  <BarList
                    items={analytics.incidents.map((row) => ({
                      label: row.type,
                      value: row._count._all,
                    }))}
                    empty="No incidents recorded."
                  />
                </Panel>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Guard>
  );
}

function QueueRow({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md bg-muted px-3.5 py-3 transition hover:bg-neutral-200"
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </Link>
  );
}
