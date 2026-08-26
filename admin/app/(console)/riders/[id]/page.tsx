"use client";

import { use, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
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
    paymentMethods: { id: string; kind: string; brand: string | null; last4: string | null }[];
    trips: { id: string; bookingCode: string; status: string; fareTotal: unknown }[];
    tickets: { id: string; subject: string; status: string }[];
    lostItems: { id: string; description: string; status: string }[];
    privacyRequests: { id: string; kind: string; status: string }[];
  } | null;
};

export default function RiderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, reload, error } = useApi<Rider>(`/admin/riders/${id}`);
  const [credit, setCredit] = useState("10");
  const [message, setMessage] = useState("");

  async function patch(body: Record<string, unknown>) {
    await api(`/admin/riders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await reload();
  }

  return (
    <Guard allowed={can(user, "riders:read")}>
      {!data ? (
        <p className="text-sm text-slate-500">{error || "Loading rider…"}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{data.name}</h1>
              <p className="text-sm text-slate-400">
                {data.email} · {data.phone} · {data.id}
              </p>
            </div>
            <Badge tone={statusTone(data.accountStatus)}>{data.accountStatus}</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Profile">
              <div className="space-y-2 text-sm text-slate-300">
                <p>Verification: {data.profile?.verificationStatus}</p>
                <p>Rating: {data.profile?.rating}</p>
                <p>Wallet: ${data.profile?.walletBalance.toFixed(2)}</p>
                <p>Loyalty: {data.profile?.loyaltyPoints}</p>
                <p>Marketing consent: {data.profile?.consentMarketing ? "yes" : "no"}</p>
                <p>
                  Deletion request:{" "}
                  {data.profile?.deletionRequestedAt ?? "none"}
                </p>
              </div>
            </Panel>
            <Panel title="Payment methods">
              <p className="mb-3 text-xs text-slate-500">
                Full card numbers are never stored or shown.
              </p>
              <Table
                columns={["Method", "Brand", "Last 4"]}
                rows={(data.profile?.paymentMethods ?? []).map((method) => [
                  method.kind,
                  method.brand ?? "—",
                  method.last4 ? `•••• ${method.last4}` : "—",
                ])}
              />
            </Panel>
          </div>
          {can(user, "riders:write") ? (
            <Panel title="Account actions">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void patch({ accountStatus: "SUSPENDED" })}>
                  Suspend
                </Button>
                <Button tone="danger" onClick={() => void patch({ accountStatus: "BLOCKED" })}>
                  Block
                </Button>
                <Button tone="ghost" onClick={() => void patch({ accountStatus: "ACTIVE", flagged: false })}>
                  Unblock
                </Button>
                <Button tone="ghost" onClick={() => void patch({ flagged: true })}>
                  Flag
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Input
                  value={credit}
                  onChange={(event) => setCredit(event.target.value)}
                  className="w-28"
                />
                <Button
                  tone="ghost"
                  onClick={() => void patch({ credit: Number(credit) })}
                >
                  Add wallet credit
                </Button>
                <Select
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) {
                      void api("/admin/notifications", {
                        method: "POST",
                        body: JSON.stringify({
                          userId: data.id,
                          channel: event.target.value,
                          template: "support",
                          title: "Message from Eve support",
                          body: "A support agent needs to reach you about your account.",
                        }),
                      });
                    }
                  }}
                >
                  <option value="">Contact rider</option>
                  <option value="push">Push</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="chat">Support chat</option>
                </Select>
              </div>
            </Panel>
          ) : null}
          <Panel title="Ride history">
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Complaints & tickets">
              <Table
                columns={["Subject", "Status"]}
                rows={(data.profile?.tickets ?? []).map((ticket) => [
                  ticket.subject,
                  ticket.status,
                ])}
              />
            </Panel>
            <Panel title="Lost items & privacy">
              <Table
                columns={["Item", "Status"]}
                rows={[
                  ...(data.profile?.lostItems ?? []).map((item) => [
                    item.description,
                    item.status,
                  ]),
                  ...(data.profile?.privacyRequests ?? []).map((item) => [
                    item.kind,
                    item.status,
                  ]),
                ]}
              />
            </Panel>
          </div>
          <textarea
            className="h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
            placeholder="Internal notes"
            defaultValue={data.profile?.notes ?? ""}
            onChange={(event) => setMessage(event.target.value)}
          />
          {can(user, "riders:write") ? (
            <Button onClick={() => void patch({ notes: message })}>Save notes</Button>
          ) : null}
        </div>
      )}
    </Guard>
  );
}
