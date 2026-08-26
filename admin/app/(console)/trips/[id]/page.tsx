"use client";

import { use } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Guard,
  Input,
  Panel,
  Table,
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
  distanceKm: number;
  durationMin: number;
  fareTotal: number;
  commission: number;
  paymentStatus: string;
  paymentMethod: string;
  cancellationReason: string | null;
  etaMinutes: number | null;
  routeDeviation: boolean;
  rider: { name: string; phone: string | null };
  driver: { name: string; id: string } | null;
  events: { id: string; action: string; createdAt: string }[];
  ledger: { id: string; type: string; amount: number; status: string }[];
};

type DriverList = { items: { id: string; user: { name: string } }[] };

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload } = useApi<Trip>(`/admin/trips/${id}`);
  const { data: drivers } = useApi<DriverList>("/admin/drivers?status=APPROVED");
  const dispatch = can(user, "trips:dispatch");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    await api(`/admin/trips/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action, ...extra }),
    });
    await reload();
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Loading trip…</p>;
  }

  return (
    <Guard allowed={can(user, "trips:read")}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{data.bookingCode}</h1>
            <p className="text-sm text-slate-400">
              {data.rider.name} · {data.driver?.name ?? "No driver"} · {data.city}
            </p>
          </div>
          <Badge tone={statusTone(data.status)}>{data.status}</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Route">
            <p className="text-sm">{data.pickupAddress}</p>
            <p className="text-sm text-slate-400">to {data.dropoffAddress}</p>
            <p className="mt-3 text-xs text-slate-500">
              {data.distanceKm} km · {data.durationMin} min · ETA {data.etaMinutes ?? "—"} ·
              deviation {data.routeDeviation ? "yes" : "no"}
            </p>
            <div className="relative mt-4 h-48 overflow-hidden rounded-xl bg-[linear-gradient(#10263b,#071422)]">
              <span className="absolute left-[22%] top-[58%] h-2 w-2 rounded-full bg-emerald-400" />
              <span className="absolute left-[68%] top-[28%] h-2 w-2 rounded-full bg-amber-300" />
            </div>
          </Panel>
          <Panel title="Fare breakdown">
            <p>Rider fare ${data.fareTotal.toFixed(2)}</p>
            <p>Commission ${data.commission.toFixed(2)}</p>
            <p>Payment {data.paymentMethod} · {data.paymentStatus}</p>
            <p>Cancellation: {data.cancellationReason ?? "—"}</p>
          </Panel>
        </div>
        {dispatch ? (
          <Panel title="Dispatcher actions">
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm"
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
              <Button tone="ghost" onClick={() => void act("complete")}>
                End trip
              </Button>
              <Button
                tone="danger"
                onClick={() =>
                  void act("cancel", { reason: "admin_intervention" })
                }
              >
                Cancel ride
              </Button>
            </div>
          </Panel>
        ) : null}
        <Panel
          title="Immutable trip history"
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
        >
          <Table
            columns={["Action", "When"]}
            rows={data.events.map((event) => [
              event.action,
              new Date(event.createdAt).toLocaleString(),
            ])}
          />
        </Panel>
      </div>
    </Guard>
  );
}
