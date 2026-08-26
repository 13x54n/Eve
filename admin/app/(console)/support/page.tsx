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
      <h1 className="mb-4 text-2xl font-semibold text-white">Support & disputes</h1>
      <FilterBar>
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Subject or category" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option>OPEN</option>
          <option>IN_PROGRESS</option>
          <option>WAITING</option>
          <option>RESOLVED</option>
        </Select>
      </FilterBar>
      <Panel title={`${data?.total ?? 0} tickets`}>
        <Table
          columns={["Ticket", "People", "Priority", "Status", "SLA tools"]}
          rows={(data?.items ?? []).map((ticket) => [
            <div key="t">
              <p>{ticket.subject}</p>
              <p className="text-xs text-slate-500">
                {ticket.category} · {ticket.channel} · {ticket.trip?.bookingCode ?? "no trip"}
              </p>
            </div>,
            ticket.rider?.user.name ?? "—",
            <Badge key="p" tone={statusTone(ticket.priority)}>{ticket.priority}</Badge>,
            ticket.status,
            write ? (
              <div key="a" className="flex flex-wrap gap-2">
                <button className="text-emerald-300" onClick={() => void update(ticket.id, { status: "RESOLVED", csatScore: 5, message: "Resolved via canned response." })}>
                  Resolve
                </button>
                <button className="text-sky-300" onClick={() => void update(ticket.id, { status: "IN_PROGRESS", assigneeId: user?.id, message: "Escalating internally.", internal: true })}>
                  Escalate
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
