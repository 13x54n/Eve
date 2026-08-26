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
    profile: { rating: number; walletBalance: number } | null;
  }[];
};

export default function RidersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    return `/admin/riders?${params}`;
  }, [q, city]);
  const { data, error } = useApi<RiderList>(path);

  return (
    <Guard allowed={can(user, "riders:read")}>
      <h1 className="mb-4 text-2xl font-semibold text-white">Rider management</h1>
      <FilterBar>
        <Input
          placeholder="Name, phone, email, or user ID"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <Input
          placeholder="City"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
      </FilterBar>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <Panel title={`${data?.total ?? 0} riders`}>
        <Table
          columns={["Rider", "Contact", "City", "Status", "Rating", "Wallet"]}
          rows={(data?.items ?? []).map((rider) => [
            <Link key={rider.id} href={`/riders/${rider.id}`} className="text-emerald-300">
              {rider.name}
            </Link>,
            <>
              {rider.email}
              <div className="text-xs text-slate-500">{rider.phone}</div>
            </>,
            rider.city ?? "—",
            <Badge key="s" tone={statusTone(rider.accountStatus)}>
              {rider.flagged ? "FLAGGED" : rider.accountStatus}
            </Badge>,
            rider.profile?.rating ?? "—",
            rider.profile ? `$${rider.profile.walletBalance.toFixed(2)}` : "—",
          ])}
        />
      </Panel>
    </Guard>
  );
}
