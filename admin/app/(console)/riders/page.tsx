"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  FilterBar,
  Guard,
  Input,
  Panel,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type RiderList = {
  total: number;
  items: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    accountStatus: string;
    flagged: boolean;
    createdAt: string;
    profile: {
      rating: number;
      walletBalance: number;
    } | null;
  }[];
};

export default function RidersPage() {
  const { user } = useAuth();

  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams();

    if (q.trim()) params.set("q", q.trim());
    if (city.trim()) params.set("city", city.trim());

    const query = params.toString();

    return `/admin/riders${query ? `?${query}` : ""}`;
  }, [q, city]);

  const { data, error, loading } = useApi<RiderList>(path);

  return (
    <Guard allowed={can(user, "riders:read")}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Rider management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Search, review, and manage rider accounts.
          </p>
        </div>

        <FilterBar>
          <Input
            placeholder="Name, phone, email, or user ID"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="w-full sm:w-80"
          />

          <Input
            placeholder="Filter by city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-full sm:w-48"
          />
        </FilterBar>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
            Loading riders…
          </div>
        ) : (
          <Panel title={`${data?.total ?? 0} riders`}>
            {!data?.items.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500">
                No riders match the current filters.
              </div>
            ) : (
              <Table
                columns={[
                  "Rider",
                  "Contact",
                  "City",
                  "Status",
                  "Rating",
                  "Wallet",
                ]}
                rows={data.items.map((rider) => [
                  <Link
                    key={rider.id}
                    href={`/riders/${rider.id}`}
                    className="font-semibold text-[#2e4ed2] transition hover:underline"
                  >
                    {rider.name}
                  </Link>,

                  <div key={`${rider.id}-contact`}>
                    <p className="text-sm font-medium text-slate-800">{rider.email}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {rider.phone ?? "No phone number"}
                    </p>
                  </div>,

                  <span key={`${rider.id}-city`} className="text-slate-700">
                    {rider.city ?? "—"}
                  </span>,

                  <Badge
                    key={`${rider.id}-status`}
                    tone={statusTone(rider.flagged ? "FLAGGED" : rider.accountStatus)}
                  >
                    {rider.flagged ? "FLAGGED" : rider.accountStatus}
                  </Badge>,

                  <span key={`${rider.id}-rating`} className="text-slate-700">
                    {rider.profile?.rating ? `★ ${rider.profile.rating.toFixed(1)}` : "—"}
                  </span>,

                  <span
                    key={`${rider.id}-wallet`}
                    className="font-semibold text-emerald-700"
                  >
                    {rider.profile
                      ? `$${rider.profile.walletBalance.toFixed(2)}`
                      : "—"}
                  </span>,
                ])}
              />
            )}
          </Panel>
        )}
      </div>
    </Guard>
  );
}