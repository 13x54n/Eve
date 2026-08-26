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
      <h1 className="mb-4 text-2xl font-semibold text-white">Safety console</h1>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {(data?.sos ?? []).map((item) => (
          <Panel key={item.id} title={`SOS · ${item.trip?.bookingCode ?? "no trip"}`}>
            <p className="text-sm text-rose-300">{item.severity}</p>
            <p className="text-sm">
              Rider {item.rider?.user.name ?? "—"} · Driver {item.driver?.user.name ?? "—"}
            </p>
            <p className="text-xs text-slate-500">
              {item.latitude}, {item.longitude}
            </p>
            {write ? (
              <Button className="mt-3" onClick={() => void update(item.id, "ESCALATED")}>
                Escalate / assign me
              </Button>
            ) : null}
          </Panel>
        ))}
      </div>
      <Panel title="Incidents">
        <Table
          columns={["Type", "People", "Severity", "Status", "Action"]}
          rows={(data?.incidents ?? []).map((item) => [
            item.type,
            `${item.rider?.user.name ?? "—"} / ${item.driver?.user.name ?? "—"}`,
            <Badge key="s" tone={statusTone(item.severity)}>{item.severity}</Badge>,
            item.status,
            write ? (
              <div key="a" className="flex gap-2">
                <button className="text-emerald-300" onClick={() => void update(item.id, "RESOLVED")}>
                  Resolve
                </button>
                <button className="text-amber-300" onClick={() => void update(item.id, "RESTRICTED")}>
                  Restrict accounts
                </button>
              </div>
            ) : (
              "—"
            ),
          ])}
        />
      </Panel>
    </Guard>
  );
}
