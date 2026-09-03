"use client";

import dynamic from "next/dynamic";
import { use, useEffect } from "react";
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
import { EntityLink } from "@/components/entity-link";
import { downloadText, toCsv } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { addAdminSocketListener, subscribeTrip, unsubscribeTrip } from "@/lib/socket";

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
  rider: { id: string; name: string; phone: string | null };
  driver: { id: string; name: string; profileId: string } | null;
  recipientName: string | null;
  recipientPhone: string | null;
  packageNote: string | null;
  trackingToken: string | null;
  events: { id: string; action: string; createdAt: string }[];
  offers: { id: string; proposedFare: number; etaMinutes: number; status: string; driverId: string; driverName: string }[];
  ledger: { id: string; type: string; amount: number; status: string }[];
  tickets: { id: string; subject: string; status: string }[];
  chatMessages: {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    authorName: string;
    authorRole: string;
  }[];
};

type DriverList = { items: { id: string; user: { name: string } }[] };

const TripRouteMap = dynamic(() => import("@/components/trip-route-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-[12px] text-muted-foreground">
      Loading map…
    </div>
  ),
});

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload, error, loading, setData } = useApi<Trip>(`/admin/trips/${id}`);
  const { data: drivers } = useApi<DriverList>("/admin/drivers?status=APPROVED");
  const dispatch = can(user, "trips:dispatch");

  useEffect(() => {
    subscribeTrip(id);
    return () => {
      unsubscribeTrip();
    };
  }, [id]);

  useEffect(() => {
    return addAdminSocketListener((event, payload) => {
      if (event !== "trip:message" || !payload || typeof payload !== "object") {
        return;
      }
      const message = payload as Trip["chatMessages"][number] & { tripId?: string };
      if (message.tripId && message.tripId !== id) {
        return;
      }
      setData((current) => {
        if (!current || current.chatMessages.some((row) => row.id === message.id)) {
          return current;
        }
        return { ...current, chatMessages: [...current.chatMessages, message] };
      });
    });
  }, [id, setData]);

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
            subtitle={
              <span>
                Rider <EntityLink href={`/riders/${data.rider.id}`}>{data.rider.name}</EntityLink>
                {" · Driver "}
                {data.driver?.profileId ? (
                  <EntityLink href={`/drivers/${data.driver.profileId}`}>{data.driver.name}</EntityLink>
                ) : (
                  "Unassigned"
                )}
                {` · ${data.city}${data.rideType === "COURIER" ? " · Courier" : ""}`}
              </span>
            }
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
                <div className="relative mt-3 h-72 overflow-hidden rounded-md bg-muted">
                  <TripRouteMap
                    pickupLat={Number(data.pickupLat)}
                    pickupLng={Number(data.pickupLng)}
                    dropoffLat={Number(data.dropoffLat)}
                    dropoffLng={Number(data.dropoffLng)}
                  />
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  <span className="font-medium text-emerald-700">Green</span> pickup ·{" "}
                  <span className="font-medium text-amber-700">Amber</span> dropoff
                </p>
              </Panel>
              {data.rideType === "COURIER" ? (
                <Panel title="Courier">
                  <p className="font-medium">{data.recipientName ?? "Recipient"}</p>
                  <p className="text-muted-foreground">{data.recipientPhone ?? "No phone"}</p>
                  {data.packageNote ? <p className="mt-2 text-[13px]">{data.packageNote}</p> : null}
                  {data.trackingToken ? (
                    <p className="mt-2 break-all text-[12px] text-muted-foreground">
                      Tracking token: {data.trackingToken}
                    </p>
                  ) : null}
                </Panel>
              ) : data.recipientName || data.recipientPhone ? (
                <Panel title="Passenger">
                  <p className="font-medium">{data.recipientName ?? "Passenger"}</p>
                  <p className="text-muted-foreground">{data.recipientPhone ?? "No phone"}</p>
                  {data.trackingToken ? (
                    <p className="mt-2 break-all text-[12px] text-muted-foreground">
                      Tracking token: {data.trackingToken}
                    </p>
                  ) : null}
                </Panel>
              ) : null}
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
              <Panel title="In-trip chat">
                {(data.chatMessages ?? []).length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No rider–driver messages on this trip.</p>
                ) : (
                  <div className="space-y-2">
                    {data.chatMessages.map((row) => (
                      <div key={row.id} className="rounded-md bg-muted px-3 py-2 text-[13px]">
                        <p className="text-[11px] text-muted-foreground">
                          {row.authorName} · {row.authorRole.toLowerCase()} ·{" "}
                          {new Date(row.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Read-only. Reply to riders or drivers from a support ticket.
                </p>
              </Panel>
              <Panel title="Support tickets" flush>
                <Table
                  columns={["Subject", "Status"]}
                  empty="No tickets on this trip."
                  rows={(data.tickets ?? []).map((ticket) => [
                    <EntityLink key={ticket.id} href={`/support/${ticket.id}`}>
                      {ticket.subject}
                    </EntityLink>,
                    <Badge key={`${ticket.id}-s`} tone={statusTone(ticket.status)}>
                      {ticket.status}
                    </Badge>,
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
                    <EntityLink key={offer.id} href={`/drivers/${offer.driverId}`}>
                      {offer.driverName}
                    </EntityLink>,
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
