"use client";

import { api } from "@/lib/api";
import {
  Badge,
  FilterBar,
  Guard,
  Input,
  Panel,
  Select,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
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
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    return `/admin/tickets?${params}`;
  }, [q, status]);
  const { data, reload } = useApi<Tickets>(path);
  const write = can(user, "support:write");

  async function update(id: string, body: Record<string, unknown>) {
    await api(`/admin/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await reload();
  }

  return (
    <Guard allowed={can(user, "support:read")}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Support & disputes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Handle customer service inquiries, rider disputes, lost item claims, and escalation tickets.
          </p>
        </div>
        <FilterBar>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search subject or category"
            className="w-full sm:w-80"
          />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-48">
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="WAITING">Waiting</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </FilterBar>
        <Panel title={`${data?.total ?? 0} support tickets`}>
          <Table
            columns={["Ticket Details", "Rider", "Priority", "Status", "SLA Actions"]}
            rows={(data?.items ?? []).map((ticket) => [
              <div key="t">
                <p className="font-semibold text-slate-900">{ticket.subject}</p>
                <p className="text-xs text-slate-500">
                  {ticket.category} · Channel: {ticket.channel} · {ticket.trip?.bookingCode ? `Trip: ${ticket.trip.bookingCode}` : "No trip"}
                </p>
              </div>,
              <span key="r" className="font-medium text-slate-800">{ticket.rider?.user.name ?? "—"}</span>,
              <Badge key="p" tone={statusTone(ticket.priority)}>{ticket.priority}</Badge>,
              <span key="st" className="font-medium text-slate-700">{ticket.status}</span>,
              write ? (
                <div key="a" className="flex items-center gap-3">
                  <button
                    className="font-semibold text-emerald-700 hover:text-emerald-800 text-xs transition hover:underline cursor-pointer"
                    onClick={() => void update(ticket.id, { status: "RESOLVED", csatScore: 5, message: "Resolved via canned response." })}
                  >
                    Resolve
                  </button>
                  <button
                    className="font-semibold text-[#2e4ed2] hover:text-[#233eb8] text-xs transition hover:underline cursor-pointer"
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

