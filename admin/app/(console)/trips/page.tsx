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
      <h1 className="mb-4 text-2xl font-semibold text-white">Trip & dispatch</h1>
      <FilterBar>
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Booking, rider, driver, route" />
        <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City / zone" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {["SCHEDULED", "SEARCHING", "ASSIGNED", "ONGOING", "COMPLETED", "CANCELLED", "NO_DRIVER", "DRIVER_NO_SHOW", "RIDER_NO_SHOW", "TECHNICAL_FAILURE"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </FilterBar>
      {dispatch ? (
        <Panel title="Create booking on behalf of a rider">
          <form className="grid gap-2 md:grid-cols-5" onSubmit={createTrip}>
            <Input name="riderId" placeholder="Rider user or profile ID" required />
            <Input name="pickup" placeholder="Pickup" required />
            <Input name="dropoff" placeholder="Destination" required />
            <Input name="city" placeholder="City" defaultValue="New York" />
            <Select name="rideType" defaultValue="STANDARD">
              <option>STANDARD</option>
              <option>AIRPORT</option>
              <option>MULTI_STOP</option>
              <option>SCHEDULED</option>
              <option>CORPORATE</option>
            </Select>
            <Button className="md:col-span-5">Create trip</Button>
          </form>
        </Panel>
      ) : null}
      <div className="h-4" />
      <Panel title={`${data?.total ?? 0} trips`}>
        <Table
          columns={["Booking", "People", "Route", "Type", "Fare", "Status"]}
          rows={(data?.items ?? []).map((trip) => [
            <Link key={trip.id} className="text-emerald-300" href={`/trips/${trip.id}`}>
              {trip.bookingCode}
            </Link>,
            `${trip.rider.name} → ${trip.driver?.name ?? "unassigned"}`,
            `${trip.pickupAddress} → ${trip.dropoffAddress}`,
            trip.rideType,
            `$${trip.fareTotal.toFixed(2)}`,
            <Badge key="s" tone={statusTone(trip.status)}>{trip.status}</Badge>,
          ])}
        />
      </Panel>
    </Guard>
  );
}
