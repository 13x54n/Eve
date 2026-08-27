"use client";

import { use } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  Guard,
  Panel,
  StatCard,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Driver = {
  id: string;
  approvalStatus: string;
  presence: string;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  onlineHours: number;
  earningsTotal: number;
  commissionTier: string;
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
  trips: { bookingCode: string; status: string }[];
  incidents: { type: string; severity: string }[];
  incentives: { kind: string; amount: number; note: string | null }[];
};

export default function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload } = useApi<Driver>(`/admin/drivers/${id}`);
  const write = can(user, "drivers:approve");

  async function review(body: Record<string, unknown>) {
    try {
      await api(`/admin/drivers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await reload();
      toast.success("Driver updated");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
        Loading driver…
      </div>
    );
  }

  return (
    <Guard allowed={can(user, "drivers:read")}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{data.user.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.user.email} · <span className="capitalize">{data.presence.toLowerCase()}</span> · {data.city ?? "No city"}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard label="Rating" value={data.rating ? `★ ${data.rating.toFixed(1)}` : "—"} />
          <StatCard label="Acceptance" value={`${data.acceptanceRate}%`} />
          <StatCard label="Cancellations" value={`${data.cancellationRate}%`} />
          <StatCard label="Earnings" value={`$${data.earningsTotal.toFixed(2)}`} />
        </div>
        {write ? (
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => void review({ approvalStatus: "APPROVED" })}>
              Approve
            </Button>
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
        ) : null}
        <Panel title="Documents">
          <Table
            columns={["Type", "Status", "Expires", "Action"]}
            rows={data.documents.map((doc) => [
              <span key="t" className="font-medium text-slate-900">{doc.type}</span>,
              <Badge key={doc.id} tone={statusTone(doc.status)}>
                {doc.status}
              </Badge>,
              doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString() : "—",
              write ? (
                <div key="a" className="flex gap-3">
                  <button
                    className="font-semibold text-emerald-700 hover:text-emerald-800 text-xs transition hover:underline cursor-pointer"
                    onClick={() =>
                      void review({ documentId: doc.id, documentStatus: "APPROVED" })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="font-semibold text-rose-600 hover:text-rose-700 text-xs transition hover:underline cursor-pointer"
                    onClick={() =>
                      void review({ documentId: doc.id, documentStatus: "REJECTED" })
                    }
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
          <Panel title="Vehicles">
          <Table
            columns={["Plate", "Vehicle", "Type"]}
            rows={data.vehicles.map((vehicle) => [
              <span key="p" className="font-mono font-semibold text-slate-800">{vehicle.plateNumber}</span>,
              `${vehicle.make} ${vehicle.model}`,
              <span key="t" className="font-semibold text-slate-700">{vehicle.vehicleType === "BIKE" ? "Bike" : "Car"}</span>,
            ])}
          />
        </Panel>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Trip history">
            <Table
              columns={["Booking", "Status"]}
              rows={data.trips.map((trip) => [
                <span key="b" className="font-mono font-medium text-slate-800">{trip.bookingCode}</span>,
                <Badge key="s" tone={statusTone(trip.status)}>{trip.status}</Badge>,
              ])}
            />
          </Panel>
          <Panel title="Safety & incentives">
            <Table
              columns={["Record", "Detail"]}
              rows={[
                ...data.incidents.map((item) => [
                  <span key="i" className="font-medium text-slate-900">{item.type}</span>,
                  <Badge key="s" tone={statusTone(item.severity)}>{item.severity}</Badge>,
                ]),
                ...data.incentives.map((item) => [
                  <span key="k" className="font-medium text-slate-900">{item.kind}</span>,
                  <span key="a" className="font-semibold text-emerald-700">{`$${item.amount}`}</span>,
                ]),
              ]}
            />
          </Panel>
        </div>
        <p className="text-xs text-slate-500">
          Fleet: <span className="font-medium text-slate-700">{data.fleetCompany?.name ?? "Independent"}</span> · Commission tier{" "}
          <span className="font-medium text-slate-700">{data.commissionTier}</span> · Online hours <span className="font-medium text-slate-700">{data.onlineHours}</span>
        </p>
      </div>
    </Guard>
  );
}

