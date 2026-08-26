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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Drivers & onboarding
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review identity, license, insurance, and vehicle documents before approval.
          </p>
        </div>
        <FilterBar>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search drivers by name or email"
            className="w-full sm:w-80"
          />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full sm:w-48">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="NEEDS_INFO">Needs info</option>
            <option value="APPROVED">Approved</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </FilterBar>
        <Panel title={`Verification queue · ${data?.total ?? 0}`}>
          <Table
            columns={["Driver", "Presence", "Approval", "Pending Docs", "Rating"]}
            rows={(data?.items ?? []).map((driver) => [
              <Link key={driver.id} className="font-semibold text-[#2e4ed2] transition hover:underline" href={`/drivers/${driver.id}`}>
                {driver.user.name}
              </Link>,
              <span key="p" className="text-slate-700 font-medium capitalize">
                {driver.presence.toLowerCase()}
              </span>,
              <Badge key="a" tone={statusTone(driver.approvalStatus)}>
                {driver.approvalStatus}
              </Badge>,
              <span key="d" className="text-slate-700 font-medium">
                {`${driver.documents.filter((doc) => doc.status === "PENDING").length} pending`}
              </span>,
              <span key="r" className="text-slate-700 font-medium">
                {driver.rating ? `★ ${driver.rating.toFixed(1)}` : "—"}
              </span>,
            ])}
          />
        </Panel>
      </div>
    </Guard>
  );
}

