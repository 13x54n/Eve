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

  const { data, reload, error, loading } = useApi<Rider>(
    `/admin/riders/${id}`,
  );

  const [credit, setCredit] = useState("10");
  const [message, setMessage] = useState("");

  async function patch(body: Record<string, unknown>) {
    await api(`/admin/riders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    await reload();
  }

  const isEditable = can(user, "riders:write");

  return (
    <Guard allowed={can(user, "riders:read")}>
      <div className="space-y-6">
        {!data ? (
          <div
            className={`rounded-2xl border p-8 text-center text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-500 shadow-xs"
            }`}
          >
            {error || (loading ? "Loading rider…" : "Rider not found.")}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {data.name}
                  </h1>

                  {data.flagged ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      Flagged
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 break-all text-sm text-slate-500">
                  {data.email}
                  <span className="mx-2 text-slate-300">·</span>
                  {data.phone ?? "No phone"}
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="font-mono text-xs text-slate-400">
                    {data.id}
                  </span>
                </p>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  {data.city ?? "No city assigned"}
                </p>
              </div>

              <Badge tone={statusTone(data.accountStatus)}>
                {data.accountStatus}
              </Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Profile">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Verification
                    </dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {data.profile?.verificationStatus ?? "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Rating
                    </dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {data.profile?.rating ? `★ ${data.profile.rating.toFixed(1)}` : "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Wallet balance
                    </dt>
                    <dd className="mt-1 font-bold text-emerald-700">
                      {data.profile
                        ? `$${data.profile.walletBalance.toFixed(2)}`
                        : "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Loyalty points
                    </dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {data.profile?.loyaltyPoints ?? "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Marketing consent
                    </dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {data.profile?.consentMarketing ? "Yes" : "No"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Deletion request
                    </dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {data.profile?.deletionRequestedAt ?? "None"}
                    </dd>
                  </div>
                </dl>
              </Panel>

              <Panel title="Payment methods">
                <p className="mb-3 text-xs text-slate-500">
                  Full card numbers are never stored or shown.
                </p>

                <Table
                  columns={["Method", "Brand", "Last 4"]}
                  rows={(data.profile?.paymentMethods ?? []).map(
                    (method) => [
                      method.kind,
                      method.brand ?? "—",
                      method.last4 ? `•••• ${method.last4}` : "—",
                    ],
                  )}
                />
              </Panel>
            </div>

            {isEditable ? (
              <Panel title="Account actions">
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    onClick={() =>
                      void patch({ accountStatus: "SUSPENDED" })
                    }
                  >
                    Suspend
                  </Button>

                  <Button
                    tone="danger"
                    onClick={() =>
                      void patch({ accountStatus: "BLOCKED" })
                    }
                  >
                    Block
                  </Button>

                  <Button
                    tone="ghost"
                    onClick={() =>
                      void patch({
                        accountStatus: "ACTIVE",
                        flagged: false,
                      })
                    }
                  >
                    Unblock
                  </Button>

                  <Button
                    tone="ghost"
                    onClick={() => void patch({ flagged: true })}
                  >
                    Flag account
                  </Button>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={credit}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-label="Wallet credit amount"
                    onChange={(event) => setCredit(event.target.value)}
                    className="sm:w-36"
                    placeholder="Amount"
                  />

                  <Button
                    tone="ghost"
                    onClick={() => {
                      const amount = Number(credit);

                      if (!Number.isFinite(amount) || amount <= 0) return;

                      void patch({ credit: amount });
                    }}
                  >
                    Add wallet credit
                  </Button>

                  <Select
                    defaultValue=""
                    aria-label="Contact rider channel"
                    onChange={(event) => {
                      const channel = event.target.value;

                      if (!channel) return;

                      void api("/admin/notifications", {
                        method: "POST",
                        body: JSON.stringify({
                          userId: data.id,
                          channel,
                          template: "support",
                          title: "Message from Eve support",
                          body: "A support agent needs to reach you about your account.",
                        }),
                      });

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

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Complaints & tickets">
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

              <Panel title="Lost items & privacy">
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

            <Panel title="Internal notes">
              <textarea
                className="h-28 w-full resize-y rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-[#2e4ed2] focus:ring-2 focus:ring-[#2e4ed2]/15"
                placeholder="Add internal notes visible to authorized staff only…"
                defaultValue={data.profile?.notes ?? ""}
                onChange={(event) => setMessage(event.target.value)}
                disabled={!isEditable}
              />

              {isEditable ? (
                <div className="mt-3">
                  <Button onClick={() => void patch({ notes: message })}>
                    Save notes
                  </Button>
                </div>
              ) : null}
            </Panel>
          </div>
        )}
      </div>
    </Guard>
  );
}