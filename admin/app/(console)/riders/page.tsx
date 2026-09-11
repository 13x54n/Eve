"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  ErrorBanner,
  FilterBar,
  Guard,
  Input,
  PageHeader,
  Panel,
  Table,
  money,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

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
  const delayedQ = useDebouncedValue(q);
  const delayedCity = useDebouncedValue(city);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (delayedQ.trim()) params.set("q", delayedQ.trim());
    if (delayedCity.trim()) params.set("city", delayedCity.trim());
    const query = params.toString();
    return `/admin/riders${query ? `?${query}` : ""}`;
  }, [delayedQ, delayedCity]);

  const { data, error, loading } = useApi<RiderList>(path);

  return (
    <Guard allowed={can(user, "riders:read")}>
      <PageHeader title="Riders" subtitle="Search, review, and manage rider accounts." />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <Panel
        title={`${data?.total ?? 0} riders`}
        actions={
          <FilterBar>
            <Input
              placeholder="Name, phone, email, or ID"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              className="w-56"
            />
            <Input
              placeholder="City"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="w-36"
            />
          </FilterBar>
        }
        flush
      >
        <Table
          loading={loading && !data}
          empty="No riders match the current filters."
          columns={["Rider", "Contact", "City", "Status", "Rating", "Wallet"]}
          rows={(data?.items ?? []).map((rider) => [
            <Link key={rider.id} href={`/riders/${rider.id}`} className="font-semibold hover:underline">
              {rider.name}
            </Link>,
            <div key={`${rider.id}-contact`}>
              <p className="font-medium">{rider.email}</p>
              <p className="text-[12px] text-muted-foreground">{rider.phone ?? "No phone"}</p>
            </div>,
            rider.city ?? "—",
            <Badge key={`${rider.id}-status`} tone={statusTone(rider.flagged ? "FLAGGED" : rider.accountStatus)}>
              {rider.flagged ? "FLAGGED" : rider.accountStatus}
            </Badge>,
            rider.profile?.rating ? `★ ${rider.profile.rating.toFixed(1)}` : "—",
            <span key={`${rider.id}-wallet`} className="font-semibold text-emerald-700">
              {rider.profile ? money(rider.profile.walletBalance) : "—"}
            </span>,
          ])}
        />
      </Panel>
    </Guard>
  );
}
