"use client";

import { api } from "@/lib/api";
import { Badge, Button, Guard, Panel, Table, statusTone } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Safety = {
  total: number;
  sos: {
    id: string;
    type: string;
    severity: string;
    latitude: number | null;
    longitude: number | null;
    rider: { user: { name: string } } | null;
    driver: { user: { name: string } } | null;
    trip: { bookingCode: string } | null;
  }[];
  incidents: {
    id: string;
    type: string;
    severity: string;
    status: string;
    notes: string | null;
    rider: { user: { name: string } } | null;
    driver: { user: { name: string } } | null;
  }[];
};

export default function SafetyPage() {
  const { user } = useAuth();
  const { data, reload } = useApi<Safety>("/admin/safety");
  const write = can(user, "safety:write");

  async function update(id: string, status: string) {
    await api(`/admin/safety/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, assigneeId: user?.id }),
    });
    await reload();
  }

  return (
    <Guard allowed={can(user, "safety:read")}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Safety console</h1>
          <p className="mt-1 text-sm text-slate-500">
            Emergency SOS signals, critical safety events, incident management, and risk containment.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(data?.sos ?? []).map((item) => (
            <Panel key={item.id} title={`SOS Alert · ${item.trip?.bookingCode ?? "No trip"}`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-700">{item.type}</span>
                  <Badge tone="rose">{item.severity}</Badge>
                </div>
                <p className="text-sm font-medium text-slate-800">
                  Rider: <span className="font-semibold text-slate-900">{item.rider?.user.name ?? "—"}</span> · Driver: <span className="font-semibold text-slate-900">{item.driver?.user.name ?? "—"}</span>
                </p>
                <p className="font-mono text-xs text-slate-500">
                  Coordinates: {item.latitude ?? "—"}, {item.longitude ?? "—"}
                </p>
                {write ? (
                  <div className="pt-2">
                    <Button tone="danger" onClick={() => void update(item.id, "ESCALATED")}>
                      Escalate & assign to me
                    </Button>
                  </div>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
        <Panel title="Incidents log">
          <Table
            columns={["Incident Type", "Parties Involved", "Severity", "Status", "Actions"]}
            rows={(data?.incidents ?? []).map((item) => [
              <span key="t" className="font-medium text-slate-900">{item.type}</span>,
              <span key="p" className="text-slate-800">{`${item.rider?.user.name ?? "—"} (Rider) / ${item.driver?.user.name ?? "—"} (Driver)`}</span>,
              <Badge key="s" tone={statusTone(item.severity)}>{item.severity}</Badge>,
              <span key="st" className="font-medium text-slate-700">{item.status}</span>,
              write ? (
                <div key="a" className="flex items-center gap-3">
                  <button className="font-semibold text-emerald-700 hover:text-emerald-800 text-xs transition hover:underline cursor-pointer" onClick={() => void update(item.id, "RESOLVED")}>
                    Resolve
                  </button>
                  <button className="font-semibold text-amber-800 hover:text-amber-900 text-xs transition hover:underline cursor-pointer" onClick={() => void update(item.id, "RESTRICTED")}>
                    Restrict accounts
                  </button>
                </div>
              ) : (
                "—"
              ),
            ])}
          />
        </Panel>
      </div>
    </Guard>
  );
}

