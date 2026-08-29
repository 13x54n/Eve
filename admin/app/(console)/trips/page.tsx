"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  ErrorBanner,
  Field,
  FilterBar,
  Guard,
  Input,
  PageHeader,
  Panel,
  Select,
  Table,
  money,
  statusTone,
} from "@/components/ui";
import { EntityLink } from "@/components/entity-link";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

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
    rider: { id: string; name: string };
    driver: { id: string; name: string; profileId: string } | null;
  }[];
};

export default function TripsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const delayedQ = useDebouncedValue(q);
  const delayedCity = useDebouncedValue(city);
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (delayedQ) params.set("q", delayedQ);
    if (status) params.set("status", status);
    if (delayedCity) params.set("city", delayedCity);
    return `/admin/trips?${params}`;
  }, [delayedQ, status, delayedCity]);
  const { data, reload, error, loading } = useApi<TripList>(path);
  const dispatch = can(user, "trips:dispatch");

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/admin/trips", {
        method: "POST",
        body: JSON.stringify({
          riderId: form.get("riderId"),
          pickupAddress: form.get("pickup"),
          dropoffAddress: form.get("dropoff"),
          city: form.get("city"),
          rideType: form.get("rideType"),
          vehicleType: form.get("vehicleType"),
          pickupLat: Number(form.get("pickupLat")),
          pickupLng: Number(form.get("pickupLng")),
          dropoffLat: Number(form.get("dropoffLat")),
          dropoffLng: Number(form.get("dropoffLng")),
        }),
      });
      await reload();
      toast.success("Trip created");
      event.currentTarget.reset();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "trips:read")}>
      <PageHeader title="Trips" subtitle="Live ride states, dispatch, and bookings." />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {dispatch ? (
        <div className="mb-5">
          <Panel title="Create booking on behalf of a rider">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={createTrip}>
              <Field label="Rider ID">
                <Input name="riderId" className="w-full" placeholder="User or profile ID" required />
              </Field>
              <Field label="Pickup">
                <Input name="pickup" className="w-full" placeholder="Pickup address" required />
              </Field>
              <Field label="Dropoff">
                <Input name="dropoff" className="w-full" placeholder="Destination" required />
              </Field>
              <Field label="City">
                <Input name="city" className="w-full" placeholder="City" required />
              </Field>
              <Field label="Service">
                <Select name="rideType" defaultValue="STANDARD" className="w-full">
                  <option>STANDARD</option>
                  <option>AIRPORT</option>
                  <option>MULTI_STOP</option>
                  <option>SCHEDULED</option>
                  <option>CORPORATE</option>
                </Select>
              </Field>
              <Field label="Vehicle">
                <Select name="vehicleType" defaultValue="CAR" className="w-full">
                  <option value="CAR">Car</option>
                  <option value="BIKE">Bike</option>
                </Select>
              </Field>
              <Field label="Pickup lat">
                <Input name="pickupLat" className="w-full" type="number" step="any" required />
              </Field>
              <Field label="Pickup lng">
                <Input name="pickupLng" className="w-full" type="number" step="any" required />
              </Field>
              <Field label="Dropoff lat">
                <Input name="dropoffLat" className="w-full" type="number" step="any" required />
              </Field>
              <Field label="Dropoff lng">
                <Input name="dropoffLng" className="w-full" type="number" step="any" required />
              </Field>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button>Create trip</Button>
              </div>
            </form>
          </Panel>
        </div>
      ) : null}
      <Panel
        title={`${data?.total ?? 0} trips`}
        actions={
          <FilterBar>
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Booking, rider, driver"
              className="w-52"
            />
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City"
              className="w-32"
            />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40">
              <option value="">All statuses</option>
              {[
                "SCHEDULED",
                "SEARCHING",
                "ASSIGNED",
                "ONGOING",
                "COMPLETED",
                "CANCELLED",
                "NO_DRIVER",
                "DRIVER_NO_SHOW",
                "RIDER_NO_SHOW",
                "TECHNICAL_FAILURE",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </FilterBar>
        }
        flush
      >
        <Table
          loading={loading && !data}
          empty="No trips match the current filters."
          columns={["Booking", "People", "Route", "Service", "Fare", "Status"]}
          rows={(data?.items ?? []).map((trip) => [
            <Link key={trip.id} className="font-mono font-semibold hover:underline" href={`/trips/${trip.id}`}>
              {trip.bookingCode}
            </Link>,
            <div key="p">
              <p>
                <EntityLink href={`/riders/${trip.rider.id}`}>{trip.rider.name}</EntityLink>
              </p>
              <p className="text-[12px] text-muted-foreground">
                {trip.driver?.profileId ? (
                  <>
                    Driver:{" "}
                    <EntityLink href={`/drivers/${trip.driver.profileId}`}>{trip.driver.name}</EntityLink>
                  </>
                ) : (
                  "Unassigned"
                )}
              </p>
            </div>,
            <div key="r" className="max-w-xs">
              <p className="truncate font-medium">{trip.pickupAddress}</p>
              <p className="truncate text-[12px] text-muted-foreground">to {trip.dropoffAddress}</p>
            </div>,
            trip.rideType,
            <span key="f" className="font-semibold">
              {money(trip.fareTotal)}
            </span>,
            <Badge key="s" tone={statusTone(trip.status)}>
              {trip.status}
            </Badge>,
          ])}
        />
      </Panel>
    </Guard>
  );
}
