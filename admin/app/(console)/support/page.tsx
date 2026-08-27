"use client";

import { api } from "@/lib/api";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import {
  Badge,
  ErrorBanner,
  FilterBar,
  Guard,
  Input,
  Panel,
  PageHeader,
  Select,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useMemo, useState } from "react";

type Tickets = {
  total: number;
  items: {
    id: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    channel: string;
    csatScore: number | null;
    rider: { user: { name: string } } | null;
    trip: { bookingCode: string } | null;
    messages: { id: string; body: string; internal: boolean }[];
  }[];
};

export default function SupportPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (status) params.set("status", status);
    return `/admin/tickets?${params}`;
  }, [debouncedQ, status]);
  const { data, reload, error, loading } = useApi<Tickets>(path);
  const write = can(user, "support:write");

  async function update(id: string, body: Record<string, unknown>) {
    try {
      await api(`/admin/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await reload();
      toast.success("Ticket updated");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "support:read")}>
      <div className="space-y-5">
        <PageHeader title="Support" subtitle="Inquiries, disputes, and escalations." />
        {error ? <ErrorBanner message={error} /> : null}
        <Panel
          title={`${data?.total ?? 0} tickets`}
          padded={false}
          actions={
            <FilterBar>
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Subject or category"
                className="w-56"
              />
              <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40">
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="WAITING">Waiting</option>
                <option value="RESOLVED">Resolved</option>
              </Select>
            </FilterBar>
          }
        >
          <Table
            loading={loading && !data}
            empty="No tickets match the current filters."
            columns={["Ticket", "Rider", "Priority", "Status", "Actions"]}
            rows={(data?.items ?? []).map((ticket) => [
              <div key="t">
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.category} · {ticket.channel}
                  {ticket.trip?.bookingCode ? ` · ${ticket.trip.bookingCode}` : ""}
                </p>
              </div>,
              ticket.rider?.user.name ?? "—",
              <Badge key="p" tone={statusTone(ticket.priority)}>{ticket.priority}</Badge>,
              ticket.status,
              write ? (
                <div key="a" className="flex gap-3">
                  <button
                    className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                    onClick={() => void update(ticket.id, { status: "RESOLVED", csatScore: 5, message: "Resolved via canned response." })}
                  >
                    Resolve
                  </button>
                  <button
                    className="text-xs font-medium hover:underline cursor-pointer"
                    onClick={() => void update(ticket.id, { status: "IN_PROGRESS", assigneeId: user?.id, message: "Escalating internally.", internal: true })}
                  >
                    Escalate
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
