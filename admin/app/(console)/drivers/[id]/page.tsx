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
  StatCard,
  Table,
  money,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { EntityLink } from "@/components/entity-link";

type Driver = {
  id: string;
  approvalStatus: string;
  presence: string;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  onlineHours: number;
  earningsTotal: number;
  city: string | null;
  notes: string | null;
  user: { name: string; email: string; phone: string | null; accountStatus: string };
  fleetCompany: { name: string } | null;
  vehicles: { id: string; plateNumber: string; make: string; model: string; vehicleType: "BIKE" | "CAR" }[];
  documents: {
    id: string;
    type: string;
    status: string;
    expiresAt: string | null;
  }[];
  trips: { id: string; bookingCode: string; status: string }[];
  tickets: { id: string; subject: string; status: string }[];
  incidents: { id: string; type: string; severity: string; tripId: string | null }[];
  incentives: { kind: string; amount: number; note: string | null }[];
};

export default function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload, error, loading } = useApi<Driver>(`/admin/drivers/${id}`);
  const write = can(user, "drivers:approve");

  async function review(body: Record<string, unknown>) {
    try {
      await api(`/admin/drivers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await reload();
      toast.success("Driver updated");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "drivers:read")}>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-white" />
      ) : !data ? (
        <p className="text-[13px] text-muted-foreground">Driver not found.</p>
      ) : (
        <div className="space-y-5">
          <PageHeader
            backHref="/drivers"
            backLabel="Drivers"
            title={data.user.name}
            subtitle={`${data.user.email} · ${data.presence.toLowerCase()} · ${data.city ?? "No city"}`}
            actions={<Badge tone={statusTone(data.approvalStatus)}>{data.approvalStatus}</Badge>}
          />
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <StatCard label="Rating" value={data.rating ? `★ ${data.rating.toFixed(1)}` : "—"} />
            <StatCard label="Acceptance" value={`${data.acceptanceRate}%`} />
            <StatCard label="Cancellations" value={`${data.cancellationRate}%`} />
            <StatCard label="Matched fares" value={money(data.earningsTotal)} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <Panel title="Documents" flush>
                <Table
                  columns={["Type", "Status", "Expires", "Action"]}
                  rows={data.documents.map((doc) => [
                    doc.type,
                    <Badge key={doc.id} tone={statusTone(doc.status)}>
                      {doc.status}
                    </Badge>,
                    doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString() : "—",
                    write ? (
                      <div key="a" className="flex gap-3">
                        <button
                          className="cursor-pointer text-[12px] font-semibold text-emerald-700 hover:underline"
                          onClick={() => void review({ documentId: doc.id, documentStatus: "APPROVED" })}
                        >
                          Approve
                        </button>
                        <button
                          className="cursor-pointer text-[12px] font-semibold text-red-600 hover:underline"
                          onClick={() => void review({ documentId: doc.id, documentStatus: "REJECTED" })}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "—"
                    ),
                  ])}
                />
              </Panel>
              <Panel title="Vehicles" flush>
                <Table
                  columns={["Plate", "Vehicle", "Type"]}
                  rows={data.vehicles.map((vehicle) => [
                    <span key="p" className="font-mono font-semibold">
                      {vehicle.plateNumber}
                    </span>,
                    `${vehicle.make} ${vehicle.model}`,
                    vehicle.vehicleType === "BIKE" ? "Bike" : "Car",
                  ])}
                />
              </Panel>
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Trip history" flush>
                  <Table
                    columns={["Booking", "Status"]}
                    rows={data.trips.map((trip) => [
                      <EntityLink key={trip.id} href={`/trips/${trip.id}`} className="font-mono">
                        {trip.bookingCode}
                      </EntityLink>,
                      <Badge key={`${trip.id}-s`} tone={statusTone(trip.status)}>
                        {trip.status}
                      </Badge>,
                    ])}
                  />
                </Panel>
                <Panel title="Tickets" flush>
                  <Table
                    columns={["Subject", "Status"]}
                    empty="No tickets from this driver."
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
              <Panel title="Safety & incentives" flush>
                <Table
                  columns={["Record", "Detail"]}
                  rows={[
                    ...data.incidents.map((item) => [
                      item.tripId ? (
                        <EntityLink key={item.id} href={`/trips/${item.tripId}`}>
                          {item.type}
                        </EntityLink>
                      ) : (
                        item.type
                      ),
                      <Badge key={`${item.id}-s`} tone={statusTone(item.severity)}>
                        {item.severity}
                      </Badge>,
                    ]),
                    ...data.incentives.map((item) => [
                      item.kind,
                      <span key="a" className="font-semibold text-emerald-700">
                        {money(item.amount)}
                      </span>,
                    ]),
                  ]}
                />
              </Panel>
            </div>
            <div className="space-y-5">
              {write ? (
                <Panel title="Review">
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => void review({ approvalStatus: "APPROVED" })}>Approve</Button>
                    <Button tone="ghost" onClick={() => void review({ approvalStatus: "NEEDS_INFO" })}>
                      Request info
                    </Button>
                    <Button tone="danger" onClick={() => void review({ approvalStatus: "REJECTED" })}>
                      Reject
                    </Button>
                    <Button tone="ghost" onClick={() => void review({ approvalStatus: "SUSPENDED" })}>
                      Suspend
                    </Button>
                    <Button tone="ghost" onClick={() => void review({ approvalStatus: "DEACTIVATED" })}>
                      Deactivate
                    </Button>
                  </div>
                </Panel>
              ) : null}
              <Panel title="Fleet">
                <p className="text-[13px]">
                  {data.fleetCompany?.name ?? "Independent"}
                  <br />
                  <span className="text-muted-foreground">
                    {data.onlineHours}h online
                  </span>
                </p>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </Guard>
  );
}
