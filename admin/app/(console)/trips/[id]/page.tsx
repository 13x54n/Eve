"use client";

import { use } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  Guard,
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
    try {
      await api(`/admin/trips/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...extra }),
      });
      await reload();
      toast.success("Trip updated");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
        Loading trip…
      </div>
    );
  }

  return (
    <Guard allowed={can(user, "trips:read")}>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{data.bookingCode}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Rider: <span className="font-semibold text-slate-800">{data.rider.name}</span> · Driver: <span className="font-semibold text-slate-800">{data.driver?.name ?? "No driver"}</span> · {data.city}
            </p>
          </div>
          <Badge tone={statusTone(data.status)}>{data.status}</Badge>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Route">
            <p className="text-sm font-medium text-slate-900">{data.pickupAddress}</p>
            <p className="text-sm text-slate-500">to <span className="font-medium text-slate-900">{data.dropoffAddress}</span></p>
            <p className="mt-3 text-xs text-slate-500">
              {data.distanceKm} km · {data.durationMin} min · ETA {data.etaMinutes ? `${data.etaMinutes} min` : "—"} ·
              deviation {data.routeDeviation ? "yes" : "no"}
            </p>
            <div className="relative mt-4 h-48 overflow-hidden rounded-xl bg-[linear-gradient(#10263b,#071422)]">
              <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:24px_24px]" />
              <span className="absolute left-[22%] top-[58%] h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" title="Pickup" />
              <span className="absolute left-[68%] top-[28%] h-2.5 w-2.5 rounded-full bg-amber-400 ring-4 ring-amber-400/20" title="Dropoff" />
            </div>
          </Panel>
          <Panel title="Fare breakdown">
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <dt className="text-slate-500">Rider fare</dt>
                <dd className="font-bold text-slate-900">${data.fareTotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <dt className="text-slate-500">Platform commission</dt>
                <dd className="font-semibold text-emerald-700">${data.commission.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <dt className="text-slate-500">Payment method & status</dt>
                <dd className="font-medium text-slate-800">{data.paymentMethod} · {data.paymentStatus}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">Cancellation reason</dt>
                <dd className="font-medium text-slate-800">{data.cancellationReason ?? "None"}</dd>
              </div>
            </dl>
          </Panel>
        </div>
        {dispatch ? (
          <Panel title="Dispatcher actions">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-[#2e4ed2] focus:ring-2 focus:ring-[#2e4ed2]/15 outline-none cursor-pointer"
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
            columns={["Action", "Timestamp"]}
            rows={data.events.map((event) => [
              <span key="a" className="font-medium text-slate-900">{event.action}</span>,
              <span key="w" className="text-slate-500">{new Date(event.createdAt).toLocaleString()}</span>,
            ])}
          />
        </Panel>
      </div>
    </Guard>
  );
}

