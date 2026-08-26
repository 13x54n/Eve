"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  FilterBar,
  Guard,
  Input,
  Panel,
  Select,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type TripList = {
  total: number;
  items: {
    id: string;
    bookingCode: string;
    status: string;
    rideType: string;
    city: string;
    pickupAddress: string;
    dropoffAddress: string;
    fareTotal: number;
    rider: { name: string };
    driver: { name: string } | null;
  }[];
};

export default function TripsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (city) params.set("city", city);
    return `/admin/trips?${params}`;
  }, [q, status, city]);
  const { data, reload } = useApi<TripList>(path);
  const dispatch = can(user, "trips:dispatch");

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/admin/trips", {
      method: "POST",
      body: JSON.stringify({
        riderId: form.get("riderId"),
        pickupAddress: form.get("pickup"),
        dropoffAddress: form.get("dropoff"),
        city: form.get("city"),
        rideType: form.get("rideType"),
      }),
    });
    await reload();
  }

  return (
    <Guard allowed={can(user, "trips:read")}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trip & dispatch</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor real-time ride states, dispatch interventions, and manage bookings.
          </p>
        </div>
        <FilterBar>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search booking, rider, driver, route"
            className="w-full sm:w-72"
          />
          <Input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="City / zone"
            className="w-full sm:w-44"
          />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-48">
            <option value="">All statuses</option>
            {["SCHEDULED", "SEARCHING", "ASSIGNED", "ONGOING", "COMPLETED", "CANCELLED", "NO_DRIVER", "DRIVER_NO_SHOW", "RIDER_NO_SHOW", "TECHNICAL_FAILURE"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </FilterBar>
        {dispatch ? (
          <Panel title="Create booking on behalf of a rider">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={createTrip}>
              <Input name="riderId" placeholder="Rider user or profile ID" required />
              <Input name="pickup" placeholder="Pickup address" required />
              <Input name="dropoff" placeholder="Destination address" required />
              <Input name="city" placeholder="City" defaultValue="New York" />
              <Select name="rideType" defaultValue="STANDARD">
                <option>STANDARD</option>
                <option>AIRPORT</option>
                <option>MULTI_STOP</option>
                <option>SCHEDULED</option>
                <option>CORPORATE</option>
              </Select>
              <Button className="sm:col-span-2 lg:col-span-5">Create trip</Button>
            </form>
          </Panel>
        ) : null}
        <Panel title={`${data?.total ?? 0} trips`}>
          <Table
            columns={["Booking Code", "People", "Route", "Service", "Fare", "Status"]}
            rows={(data?.items ?? []).map((trip) => [
              <Link key={trip.id} className="font-mono font-semibold text-[#2e4ed2] transition hover:underline" href={`/trips/${trip.id}`}>
                {trip.bookingCode}
              </Link>,
              <div key="p">
                <p className="font-medium text-slate-800">{trip.rider.name}</p>
                <p className="text-xs text-slate-500">{trip.driver?.name ? `Driver: ${trip.driver.name}` : "No driver assigned"}</p>
              </div>,
              <div key="r" className="max-w-xs truncate text-xs text-slate-600">
                <p className="truncate font-medium text-slate-800">{trip.pickupAddress}</p>
                <p className="truncate text-slate-500">to {trip.dropoffAddress}</p>
              </div>,
              <span key="t" className="font-medium text-slate-700">{trip.rideType}</span>,
              <span key="f" className="font-semibold text-slate-900">{`$${trip.fareTotal.toFixed(2)}`}</span>,
              <Badge key="s" tone={statusTone(trip.status)}>{trip.status}</Badge>,
            ])}
          />
        </Panel>
      </div>
    </Guard>
  );
}

