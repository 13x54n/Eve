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
  Select,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type DriverList = {
  total: number;
  items: {
    id: string;
    approvalStatus: string;
    presence: string;
    rating: number;
    city: string | null;
    user: { name: string; email: string; phone: string | null };
    documents: { status: string }[];
  }[];
};

export default function DriversPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const delayedQ = useDebouncedValue(q);
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (delayedQ) params.set("q", delayedQ);
    if (status) params.set("status", status);
    return `/admin/drivers?${params}`;
  }, [delayedQ, status]);
  const { data, error, loading } = useApi<DriverList>(path);

  return (
    <Guard allowed={can(user, "drivers:read")}>
      <PageHeader
        title="Drivers"
        subtitle="Review identity, license, insurance, and vehicle documents before approval."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <Panel
        title={`Verification queue · ${data?.total ?? 0}`}
        actions={
          <FilterBar>
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search name or email"
              className="w-56"
            />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="NEEDS_INFO">Needs info</option>
              <option value="APPROVED">Approved</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </FilterBar>
        }
        flush
      >
        <Table
          loading={loading && !data}
          empty="No drivers in this queue."
          columns={["Driver", "Presence", "Approval", "Pending docs", "Rating"]}
          rows={(data?.items ?? []).map((driver) => [
            <Link key={driver.id} className="font-semibold hover:underline" href={`/drivers/${driver.id}`}>
              {driver.user.name}
            </Link>,
            <span key="p" className="capitalize">
              {driver.presence.toLowerCase()}
            </span>,
            <Badge key="a" tone={statusTone(driver.approvalStatus)}>
              {driver.approvalStatus}
            </Badge>,
            `${driver.documents.filter((doc) => doc.status === "PENDING").length} pending`,
            driver.rating ? `★ ${driver.rating.toFixed(1)}` : "—",
          ])}
        />
      </Panel>
    </Guard>
  );
}
