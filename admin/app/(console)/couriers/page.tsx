"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  ErrorBanner,
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
    recipientName: string | null;
    recipientPhone: string | null;
    trackingToken: string | null;
    rider: { id: string; name: string };
    driver: { id: string; name: string; profileId: string } | null;
  }[];
};

export default function CouriersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const delayedQ = useDebouncedValue(q);
  const path = useMemo(() => {
    const params = new URLSearchParams();
    params.set("rideType", "COURIER");
    if (delayedQ) params.set("q", delayedQ);
    if (status) params.set("status", status);
    return `/admin/trips?${params}`;
  }, [delayedQ, status]);
  const { data, error, loading } = useApi<TripList>(path);

  return (
    <Guard allowed={can(user, "trips:read")}>
      <PageHeader title="Couriers" subtitle="Package deliveries using the same driver marketplace as rides." />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <Panel
        title={`${data?.total ?? 0} couriers`}
        actions={
          <FilterBar>
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search booking, sender, recipient"
              className="w-64"
            />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40">
              <option value="">All statuses</option>
              <option value="SEARCHING">SEARCHING</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="ONGOING">ONGOING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </Select>
          </FilterBar>
        }
        flush
      >
        <Table
          loading={loading && !data}
          columns={["Booking", "Sender", "Recipient", "Status", "City", "Fare"]}
          rows={(data?.items ?? []).map((trip) => [
            <Link key={trip.id} href={`/trips/${trip.id}`} className="font-medium text-foreground">
              {trip.bookingCode}
            </Link>,
            <EntityLink key={`${trip.id}-rider`} href={`/riders/${trip.rider.id}`}>
              {trip.rider.name}
            </EntityLink>,
            trip.recipientName
              ? `${trip.recipientName}${trip.recipientPhone ? ` · ${trip.recipientPhone}` : ""}`
              : "—",
            <Badge key={`${trip.id}-status`} tone={statusTone(trip.status)}>
              {trip.status}
            </Badge>,
            trip.city,
            money(trip.fareTotal),
          ])}
        />
      </Panel>
    </Guard>
  );
}
