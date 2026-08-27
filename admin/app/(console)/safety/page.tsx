"use client";

import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Guard,
  PageHeader,
  Panel,
  Table,
  statusTone,
} from "@/components/ui";
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
  const { data, reload, error, loading } = useApi<Safety>("/admin/safety");
  const write = can(user, "safety:write");

  async function update(id: string, status: string) {
    try {
      await api(`/admin/safety/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, assigneeId: user?.id }),
      });
      await reload();
      toast.success("Safety record updated");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "safety:read")}>
      <PageHeader title="Safety" subtitle="SOS, incidents, and account restrictions." />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {(data?.sos ?? []).map((item) => (
          <Panel key={item.id} title={`SOS · ${item.trip?.bookingCode ?? "No trip"}`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-red-700">{item.type}</span>
                <Badge tone="rose">{item.severity}</Badge>
              </div>
              <p>
                Rider: <span className="font-semibold">{item.rider?.user.name ?? "—"}</span> · Driver:{" "}
                <span className="font-semibold">{item.driver?.user.name ?? "—"}</span>
              </p>
              <p className="font-mono text-[12px] text-muted-foreground">
                {item.latitude ?? "—"}, {item.longitude ?? "—"}
              </p>
              {write ? (
                <Button tone="danger" onClick={() => void update(item.id, "ESCALATED")}>
                  Escalate & assign to me
                </Button>
              ) : null}
            </div>
          </Panel>
        ))}
        {!loading && (data?.sos.length ?? 0) === 0 ? (
          <Panel>
            <EmptyState title="No active SOS alerts." body="Critical rider or driver emergencies will appear here." />
          </Panel>
        ) : null}
      </div>
      <Panel title="Incidents" flush>
        <Table
          loading={loading && !data}
          empty="No incidents logged."
          columns={["Type", "Parties", "Severity", "Status", "Actions"]}
          rows={(data?.incidents ?? []).map((item) => [
            <span key="t" className="font-medium">
              {item.type}
            </span>,
            `${item.rider?.user.name ?? "—"} / ${item.driver?.user.name ?? "—"}`,
            <Badge key="s" tone={statusTone(item.severity)}>
              {item.severity}
            </Badge>,
            item.status,
            write ? (
              <div key="a" className="flex gap-3">
                <button
                  className="cursor-pointer text-[12px] font-semibold text-emerald-700 hover:underline"
                  onClick={() => void update(item.id, "RESOLVED")}
                >
                  Resolve
                </button>
                <button
                  className="cursor-pointer text-[12px] font-semibold text-amber-800 hover:underline"
                  onClick={() => void update(item.id, "RESTRICTED")}
                >
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
