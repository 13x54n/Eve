"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  ErrorBanner,
  Field,
  Guard,
  PageHeader,
  Panel,
  statusTone,
} from "@/components/ui";
import { EntityLink } from "@/components/entity-link";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { addAdminSocketListener } from "@/lib/socket";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  channel: string;
  rider: { user: { id: string; name: string; phone: string | null } } | null;
  requester?: { id: string; name: string; role: string } | null;
  trip: {
    id: string;
    bookingCode: string;
    status: string;
    rider: { id: string; user: { id: string; name: string; phone: string | null } };
    driver: { id: string; user: { id: string; name: string; phone: string | null } } | null;
    vehicle: { plateNumber: string; make: string; model: string } | null;
  } | null;
  assignee: { name: string } | null;
  messages: {
    id: string;
    authorId: string;
    body: string;
    internal: boolean;
    createdAt: string;
    author: { id: string; name: string; role: string };
  }[];
};

export default function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload, error, loading } = useApi<Ticket>(`/admin/tickets/${id}`, { intervalMs: 4000 });
  const write = can(user, "support:write");
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return addAdminSocketListener((event, payload) => {
      if (event !== "admin:ticket" || !payload || typeof payload !== "object") {
        return;
      }
      const body = payload as { ticketId?: string };
      if (body.ticketId === id) {
        void reload();
      }
    });
  }, [id, reload]);

  async function update(body: Record<string, unknown>, success = "Ticket updated") {
    try {
      setSending(true);
      await api(`/admin/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setDraft("");
      await reload();
      toast.success(success);
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  async function reply() {
    const message = draft.trim();
    if (!message) return;
    await update({
      message,
      internal,
      ...(data?.status === "OPEN" ? { status: "IN_PROGRESS" } : {}),
    }, internal ? "Internal note added" : "Reply sent");
  }

  const counterpart = data?.requester?.role === "DRIVER" ? "driver" : "rider";
  const riderUser = data?.rider?.user ?? data?.trip?.rider.user ?? null;
  const driverProfile = data?.trip?.driver ?? null;

  return (
    <Guard allowed={can(user, "support:read")}>
      {error ? <ErrorBanner message={error} /> : null}
      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-white" />
      ) : !data ? (
        <p className="text-[13px] text-muted-foreground">Ticket not found.</p>
      ) : (
        <div className="space-y-5">
          <PageHeader
            backHref="/support"
            backLabel="Support"
            title={data.subject}
            subtitle={`${data.category} · ${data.channel} · ${data.requester?.name ?? riderUser?.name ?? "Unknown"}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(data.priority)}>{data.priority}</Badge>
                <Badge tone={statusTone(data.status)}>{data.status}</Badge>
              </div>
            }
          />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Panel title="Conversation">
              <div className="space-y-3">
                {data.messages.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No messages yet.</p>
                ) : (
                  data.messages.map((row) => {
                    const mine = row.authorId === user?.id;
                    return (
                      <div
                        key={row.id}
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] ${
                          row.internal
                            ? "border border-amber-200 bg-amber-50"
                            : mine
                              ? "ml-auto bg-neutral-900 text-white"
                              : "bg-muted"
                        }`}
                      >
                        <p className={`text-[11px] ${mine && !row.internal ? "text-white/70" : "text-muted-foreground"}`}>
                          {row.author.name}
                          {row.author.role !== "ADMIN" ? ` · ${row.author.role.toLowerCase()}` : ""}
                          {row.internal ? " · internal" : ""}
                          {" · "}
                          {new Date(row.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
                      </div>
                    );
                  })
                )}
              </div>
              {write ? (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <Field label="Reply">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-400"
                      placeholder={`Write a reply to the ${counterpart}`}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(event) => setInternal(event.target.checked)}
                    />
                    Internal note (not visible to the {counterpart})
                  </label>
                  <Button disabled={sending || !draft.trim()} onClick={() => void reply()}>
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              ) : null}
            </Panel>
            <div className="space-y-5">
              <Panel title="Involvement">
                <dl className="space-y-3 text-[13px]">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Requester</dt>
                    <dd className="mt-1 font-medium">
                      {data.requester?.name ?? "Unknown"}
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({data.requester?.role?.toLowerCase() ?? "—"})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Rider</dt>
                    <dd className="mt-1">
                      {riderUser ? (
                        <>
                          <EntityLink href={`/riders/${riderUser.id}`}>{riderUser.name}</EntityLink>
                          {riderUser.phone ? (
                            <p className="text-[12px] text-muted-foreground">{riderUser.phone}</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not on this ticket</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Driver</dt>
                    <dd className="mt-1">
                      {driverProfile ? (
                        <>
                          <EntityLink href={`/drivers/${driverProfile.id}`}>{driverProfile.user.name}</EntityLink>
                          {driverProfile.user.phone ? (
                            <p className="text-[12px] text-muted-foreground">{driverProfile.user.phone}</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unassigned or no trip</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Trip</dt>
                    <dd className="mt-1">
                      {data.trip ? (
                        <>
                          <EntityLink href={`/trips/${data.trip.id}`} className="font-mono">
                            {data.trip.bookingCode}
                          </EntityLink>
                          <p className="text-[12px] text-muted-foreground">{data.trip.status}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No linked trip</span>
                      )}
                    </dd>
                  </div>
                  {data.trip?.vehicle ? (
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Vehicle</dt>
                      <dd className="mt-1 font-mono">{data.trip.vehicle.plateNumber}</dd>
                      <dd className="text-[12px] text-muted-foreground">
                        {data.trip.vehicle.make} {data.trip.vehicle.model}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </Panel>
              <Panel title="Actions">
                <p className="text-[13px] text-muted-foreground">
                  Assignee {data.assignee?.name ?? "Unassigned"}
                </p>
                {write ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <Button
                      disabled={sending}
                      onClick={() =>
                        void update(
                          { status: "RESOLVED", csatScore: 5, message: "Resolved via canned response." },
                          "Ticket resolved",
                        )
                      }
                    >
                      Resolve
                    </Button>
                    <Button
                      tone="ghost"
                      disabled={sending}
                      onClick={() =>
                        void update(
                          {
                            status: "IN_PROGRESS",
                            assigneeId: user?.id,
                            message: "Escalating internally.",
                            internal: true,
                          },
                          "Ticket escalated",
                        )
                      }
                    >
                      Escalate
                    </Button>
                  </div>
                ) : null}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </Guard>
  );
}
