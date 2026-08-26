"use client";

import { use } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Guard,
  Panel,
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
  vehicles: { id: string; plateNumber: string; make: string; model: string }[];
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
    await api(`/admin/drivers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await reload();
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Loading driver…</p>;
  }

  return (
    <Guard allowed={can(user, "drivers:read")}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{data.user.name}</h1>
          <p className="text-sm text-slate-400">
            {data.user.email} · {data.presence} · {data.city}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Panel title="Rating">{data.rating}</Panel>
          <Panel title="Acceptance">{data.acceptanceRate}%</Panel>
          <Panel title="Cancellations">{data.cancellationRate}%</Panel>
          <Panel title="Earnings">${data.earningsTotal.toFixed(2)}</Panel>
        </div>
        {write ? (
          <div className="flex flex-wrap gap-2">
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
              doc.type,
              <Badge key={doc.id} tone={statusTone(doc.status)}>
                {doc.status}
              </Badge>,
              doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString() : "—",
              write ? (
                <div key="a" className="flex gap-2">
                  <button
                    className="text-emerald-300"
                    onClick={() =>
                      void review({ documentId: doc.id, documentStatus: "APPROVED" })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="text-rose-300"
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
            columns={["Plate", "Vehicle"]}
            rows={data.vehicles.map((vehicle) => [
              vehicle.plateNumber,
              `${vehicle.make} ${vehicle.model}`,
            ])}
          />
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Trip history">
            <Table
              columns={["Booking", "Status"]}
              rows={data.trips.map((trip) => [trip.bookingCode, trip.status])}
            />
          </Panel>
          <Panel title="Safety & incentives">
            <Table
              columns={["Record", "Detail"]}
              rows={[
                ...data.incidents.map((item) => [item.type, item.severity]),
                ...data.incentives.map((item) => [item.kind, `$${item.amount}`]),
              ]}
            />
          </Panel>
        </div>
        <p className="text-xs text-slate-500">
          Fleet: {data.fleetCompany?.name ?? "Independent"} · Commission tier{" "}
          {data.commissionTier} · Online hours {data.onlineHours}
        </p>
      </div>
    </Guard>
  );
}
