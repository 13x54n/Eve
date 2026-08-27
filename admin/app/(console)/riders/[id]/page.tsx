"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  ErrorBanner,
  Guard,
  Input,
  PageHeader,
  Panel,
  Select,
  Table,
  money,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Rider = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  accountStatus: string;
  flagged: boolean;
  createdAt: string;
  profile: {
    verificationStatus: string;
    rating: number;
    walletBalance: number;
    loyaltyPoints: number;
    consentMarketing: boolean;
    deletionRequestedAt: string | null;
    notes: string | null;
    paymentMethods: {
      id: string;
      kind: string;
      brand: string | null;
      last4: string | null;
    }[];
    trips: {
      id: string;
      bookingCode: string;
      status: string;
      fareTotal: unknown;
    }[];
    tickets: {
      id: string;
      subject: string;
      status: string;
    }[];
    lostItems: {
      id: string;
      description: string;
      status: string;
    }[];
    privacyRequests: {
      id: string;
      kind: string;
      status: string;
    }[];
  } | null;
};

export default function RiderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload, error, loading } = useApi<Rider>(`/admin/riders/${id}`);
  const [credit, setCredit] = useState("10");
  const [message, setMessage] = useState("");
  const isEditable = can(user, "riders:write");

  async function patch(body: Record<string, unknown>) {
    try {
      await api(`/admin/riders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await reload();
      toast.success("Rider updated");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "riders:read")}>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-lg border border-border bg-white" />
      ) : !data ? (
        <p className="text-[13px] text-muted-foreground">Rider not found.</p>
      ) : (
        <div className="space-y-5">
          <PageHeader
            backHref="/riders"
            backLabel="Riders"
            title={data.name}
            subtitle={`${data.email} · ${data.phone ?? "No phone"} · ${data.city ?? "No city"}`}
            actions={<Badge tone={statusTone(data.accountStatus)}>{data.accountStatus}</Badge>}
          />
          {data.flagged ? <Badge tone="amber">Flagged</Badge> : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <Panel title="Profile">
                <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Verification</dt>
                    <dd className="mt-1 font-medium">{data.profile?.verificationStatus ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Rating</dt>
                    <dd className="mt-1 font-medium">
                      {data.profile?.rating ? `★ ${data.profile.rating.toFixed(1)}` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Wallet</dt>
                    <dd className="mt-1 font-semibold text-emerald-700">
                      {data.profile ? money(data.profile.walletBalance) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Loyalty</dt>
                    <dd className="mt-1 font-medium">{data.profile?.loyaltyPoints ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Marketing</dt>
                    <dd className="mt-1 font-medium">{data.profile?.consentMarketing ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Deletion</dt>
                    <dd className="mt-1 font-medium">{data.profile?.deletionRequestedAt ?? "None"}</dd>
                  </div>
                </dl>
                <p className="mt-4 font-mono text-[11px] text-muted-foreground">{data.id}</p>
              </Panel>

              <Panel title="Ride history" flush>
                <Table
                  columns={["Booking", "Status"]}
                  rows={(data.profile?.trips ?? []).map((trip) => [
                    trip.bookingCode,
                    <Badge key={trip.id} tone={statusTone(trip.status)}>
                      {trip.status}
                    </Badge>,
                  ])}
                />
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Tickets" flush>
                  <Table
                    columns={["Subject", "Status"]}
                    rows={(data.profile?.tickets ?? []).map((ticket) => [
                      ticket.subject,
                      <Badge key={ticket.id} tone={statusTone(ticket.status)}>
                        {ticket.status}
                      </Badge>,
                    ])}
                  />
                </Panel>
                <Panel title="Lost items & privacy" flush>
                  <Table
                    columns={["Item or request", "Status"]}
                    rows={[
                      ...(data.profile?.lostItems ?? []).map((item) => [
                        item.description,
                        <Badge key={item.id} tone={statusTone(item.status)}>
                          {item.status}
                        </Badge>,
                      ]),
                      ...(data.profile?.privacyRequests ?? []).map((request) => [
                        request.kind,
                        <Badge key={request.id} tone={statusTone(request.status)}>
                          {request.status}
                        </Badge>,
                      ]),
                    ]}
                  />
                </Panel>
              </div>
            </div>

            <div className="space-y-5">
              {isEditable ? (
                <Panel title="Account actions">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void patch({ accountStatus: "SUSPENDED" })}>Suspend</Button>
                    <Button tone="danger" onClick={() => void patch({ accountStatus: "BLOCKED" })}>
                      Block
                    </Button>
                    <Button
                      tone="ghost"
                      onClick={() => void patch({ accountStatus: "ACTIVE", flagged: false })}
                    >
                      Unblock
                    </Button>
                    <Button tone="ghost" onClick={() => void patch({ flagged: true })}>
                      Flag
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={credit}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        aria-label="Wallet credit amount"
                        onChange={(event) => setCredit(event.target.value)}
                        className="w-28"
                      />
                      <Button
                        tone="ghost"
                        onClick={() => {
                          const amount = Number(credit);
                          if (!Number.isFinite(amount) || amount <= 0) return;
                          void patch({ credit: amount });
                        }}
                      >
                        Add credit
                      </Button>
                    </div>
                    <Select
                      defaultValue=""
                      aria-label="Contact rider channel"
                      className="w-full"
                      onChange={(event) => {
                        const channel = event.target.value;
                        if (!channel) return;
                        api("/admin/notifications", {
                          method: "POST",
                          body: JSON.stringify({
                            userId: data.id,
                            channel,
                            template: "support",
                            title: "Message from Eve support",
                            body: "A support agent needs to reach you about your account.",
                          }),
                        })
                          .then(() => toast.success(`Message sent via ${channel}`))
                          .catch((caught) => toast.error(apiErrorMessage(caught)));
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Contact rider</option>
                      <option value="push">Push notification</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="chat">Support chat</option>
                    </Select>
                  </div>
                </Panel>
              ) : null}

              <Panel title="Payment methods" flush>
                <Table
                  columns={["Method", "Brand", "Last 4"]}
                  empty="No payment methods on file."
                  rows={(data.profile?.paymentMethods ?? []).map((method) => [
                    method.kind,
                    method.brand ?? "—",
                    method.last4 ? `•••• ${method.last4}` : "—",
                  ])}
                />
              </Panel>

              <Panel title="Internal notes">
                <textarea
                  className="h-28 w-full resize-y rounded-md border border-input bg-white p-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground"
                  placeholder="Staff-only notes…"
                  defaultValue={data.profile?.notes ?? ""}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={!isEditable}
                />
                {isEditable ? (
                  <div className="mt-3">
                    <Button onClick={() => void patch({ notes: message })}>Save notes</Button>
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
