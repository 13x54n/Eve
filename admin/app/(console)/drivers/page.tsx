"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    return `/admin/drivers?${params}`;
  }, [q, status]);
  const { data } = useApi<DriverList>(path);

  return (
    <Guard allowed={can(user, "drivers:read")}>
      <h1 className="mb-2 text-2xl font-semibold text-white">
        Drivers & onboarding
      </h1>
      <p className="mb-4 text-sm text-slate-400">
        Review identity, license, insurance, and vehicle documents before approval.
      </p>
      <FilterBar>
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search drivers" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="NEEDS_INFO">Needs info</option>
          <option value="APPROVED">Approved</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </FilterBar>
      <Panel title={`Verification queue · ${data?.total ?? 0}`}>
        <Table
          columns={["Driver", "Presence", "Approval", "Docs", "Rating"]}
          rows={(data?.items ?? []).map((driver) => [
            <Link key={driver.id} className="text-emerald-300" href={`/drivers/${driver.id}`}>
              {driver.user.name}
            </Link>,
            driver.presence,
            <Badge key="a" tone={statusTone(driver.approvalStatus)}>
              {driver.approvalStatus}
            </Badge>,
            `${driver.documents.filter((doc) => doc.status === "PENDING").length} pending`,
            driver.rating,
          ])}
        />
      </Panel>
    </Guard>
  );
}
