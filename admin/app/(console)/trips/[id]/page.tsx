"use client";

import { use } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  ErrorBanner,
  Guard,
  PageHeader,
  Panel,
  Table,
  money,
  statusTone,
} from "@/components/ui";
import { downloadText, toCsv } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Trip = {
  id: string;
  bookingCode: string;
  status: string;
  rideType: string;
  city: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  durationMin: number;
  fareTotal: number;
  suggestedFare: number;
  paymentStatus: string;
  paymentMethod: string;
  cancellationReason: string | null;
  etaMinutes: number | null;
  routeDeviation: boolean;
  rider: { name: string; phone: string | null };
  driver: { name: string; id: string } | null;
  events: { id: string; action: string; createdAt: string }[];
  offers: { id: string; proposedFare: number; etaMinutes: number; status: string; driverName: string }[];
  ledger: { id: string; type: string; amount: number; status: string }[];
};

type DriverList = { items: { id: string; user: { name: string } }[] };

function plot(lat: number, lng: number, a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const minLat = Math.min(a.lat, b.lat);
  const maxLat = Math.max(a.lat, b.lat);
  const minLng = Math.min(a.lng, b.lng);
  const maxLng = Math.max(a.lng, b.lng);
  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;
  return {
    left: `${14 + ((lng - minLng) / lngSpan) * 72}%`,
    top: `${18 + ((maxLat - lat) / latSpan) * 64}%`,
  };
}

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload, error, loading } = useApi<Trip>(`/admin/trips/${id}`);
  const { data: drivers } = useApi<DriverList>("/admin/drivers?status=APPROVED");
  const dispatch = can(user, "trips:dispatch");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    try {
      await api(`/admin/trips/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...extra }),
      });
      await reload();
      toast.success("Trip updated");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "trips:read")}>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-white" />
      ) : !data ? (
        <p className="text-[13px] text-muted-foreground">Trip not found.</p>
      ) : (
        <div className="space-y-5">
          <PageHeader
            backHref="/trips"
            backLabel="Trips"
            title={data.bookingCode}
            subtitle={`Rider ${data.rider.name} · Driver ${data.driver?.name ?? "Unassigned"} · ${data.city}`}
            actions={<Badge tone={statusTone(data.status)}>{data.status}</Badge>}
          />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <Panel title="Route">
                <p className="font-medium">{data.pickupAddress}</p>
                <p className="text-muted-foreground">
                  to <span className="font-medium text-foreground">{data.dropoffAddress}</span>
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {data.distanceKm} km · {data.durationMin} min · ETA{" "}
                  {data.etaMinutes ? `${data.etaMinutes} min` : "—"} · deviation{" "}
                  {data.routeDeviation ? "yes" : "no"}
                </p>
                <div className="relative mt-3 h-44 overflow-hidden rounded-md bg-[#111]">
                  <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#3a3a3a_1px,transparent_1px),linear-gradient(90deg,#3a3a3a_1px,transparent_1px)] [background-size:24px_24px]" />
                  <span
                    className="absolute h-2.5 w-2.5 rounded-full bg-live"
                    style={plot(
                      data.pickupLat,
                      data.pickupLng,
                      { lat: data.pickupLat, lng: data.pickupLng },
                      { lat: data.dropoffLat, lng: data.dropoffLng },
                    )}
                    title="Pickup"
                  />
                  <span
                    className="absolute h-2.5 w-2.5 rounded-full bg-amber-400"
                    style={plot(
                      data.dropoffLat,
                      data.dropoffLng,
                      { lat: data.pickupLat, lng: data.pickupLng },
                      { lat: data.dropoffLat, lng: data.dropoffLng },
                    )}
                    title="Dropoff"
                  />
                </div>
              </Panel>
              <Panel
                title="Trip history"
                actions={
                  <Button
                    tone="ghost"
                    onClick={() =>
                      downloadText(
                        `${data.bookingCode}.csv`,
                        toCsv(
                          data.events.map((event) => ({
                            action: event.action,
                            at: event.createdAt,
                          })),
                        ),
                        "text/csv",
                      )
                    }
                  >
                    Download log
                  </Button>
                }
                flush
              >
                <Table
                  columns={["Action", "Timestamp"]}
                  rows={data.events.map((event) => [
                    event.action,
                    new Date(event.createdAt).toLocaleString(),
                  ])}
                />
              </Panel>
            </div>
            <div className="space-y-5">
              <Panel title="Fare audit">
                <dl className="space-y-2 text-[13px]">
                  <div className="flex justify-between border-b border-border py-1.5">
                    <dt className="text-muted-foreground">Suggested fare</dt>
                    <dd className="font-semibold">{money(data.suggestedFare)}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border py-1.5">
                    <dt className="text-muted-foreground">Matched fare</dt>
                    <dd className="font-semibold">{money(data.fareTotal)}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border py-1.5">
                    <dt className="text-muted-foreground">Settlement</dt>
                    <dd>
                      Off-platform · {data.paymentMethod} · {data.paymentStatus}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <dt className="text-muted-foreground">Cancel reason</dt>
                    <dd>{data.cancellationReason ?? "None"}</dd>
                  </div>
                </dl>
              </Panel>
              <Panel title="Offers" flush>
                <Table
                  columns={["Driver", "Offer", "Status"]}
                  empty="No offers yet."
                  rows={(data.offers ?? []).map((offer) => [
                    offer.driverName,
                    money(offer.proposedFare),
                    <Badge key={offer.id} tone={statusTone(offer.status)}>
                      {offer.status}
                    </Badge>,
                  ])}
                />
              </Panel>
              {dispatch ? (
                <Panel title="Dispatch">
                  <div className="space-y-2">
                    <select
                      className="h-9 w-full cursor-pointer rounded-md border border-input bg-white px-3 text-[13px] outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
                      onChange={(event) => {
                        if (event.target.value) {
                          void act("assign", { driverId: event.target.value });
                        }
                      }}
                    >
                      <option value="">Assign / reassign driver</option>
                      {(drivers?.items ?? []).map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.user.name}
                        </option>
                      ))}
                    </select>
                    <Button className="w-full" tone="ghost" onClick={() => void act("complete")}>
                      End trip
                    </Button>
                    <Button
                      className="w-full"
                      tone="danger"
                      onClick={() => void act("cancel", { reason: "admin_intervention" })}
                    >
                      Cancel ride
                    </Button>
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Guard>
  );
}
