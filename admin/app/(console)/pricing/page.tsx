"use client";

import { FormEvent } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Guard, Input, Panel, Table, statusTone } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Pricing = {
  configs: {
    id: string;
    city: string;
    zone: string | null;
    vehicleType: string;
    baseFare: number;
    perKm: number;
    perMinute: number;
    minFare: number;
    bookingFee: number;
    airportFee: number;
    cancellationFee: number;
    waitingFee: number;
    commissionPercent: number;
    surgeMultiplier: number;
    status: string;
    effectiveAt: string;
  }[];
  zones: { id: string; name: string; city: string; kind: string }[];
};

export default function PricingPage() {
  const { user } = useAuth();
  const { data, reload } = useApi<Pricing>("/admin/pricing");
  const approve = can(user, "pricing:approve");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/admin/pricing", {
      method: "POST",
      body: JSON.stringify({
        city: form.get("city"),
        zone: form.get("zone") || null,
        vehicleType: form.get("vehicleType"),
        baseFare: Number(form.get("baseFare")),
        perKm: Number(form.get("perKm")),
        perMinute: Number(form.get("perMinute")),
        minFare: Number(form.get("minFare")),
        bookingFee: Number(form.get("bookingFee")),
        airportFee: Number(form.get("airportFee")),
        cancellationFee: Number(form.get("cancellationFee")),
        waitingFee: Number(form.get("waitingFee")),
        commissionPercent: Number(form.get("commissionPercent")),
        surgeMultiplier: Number(form.get("surgeMultiplier")),
        effectiveAt: form.get("effectiveAt"),
        status: "PENDING_APPROVAL",
      }),
    });
    await reload();
  }

  async function transition(id: string, action: "approve" | "rollback") {
    await api(`/admin/pricing/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    await reload();
  }

  return (
    <Guard allowed={can(user, "pricing:read")}>
      <h1 className="mb-4 text-2xl font-semibold text-white">Pricing, zones & services</h1>
      {approve ? (
        <Panel title="Propose fare change">
          <form className="grid gap-2 md:grid-cols-4" onSubmit={create}>
            <Input name="city" placeholder="City" defaultValue="New York" required />
            <Input name="zone" placeholder="Zone" />
            <Input name="vehicleType" placeholder="Vehicle type" defaultValue="standard" />
            <Input name="effectiveAt" type="datetime-local" required />
            <Input name="baseFare" placeholder="Base fare" defaultValue="3.5" />
            <Input name="perKm" placeholder="Per km" defaultValue="1.4" />
            <Input name="perMinute" placeholder="Per minute" defaultValue="0.35" />
            <Input name="minFare" placeholder="Minimum" defaultValue="8" />
            <Input name="bookingFee" placeholder="Booking fee" defaultValue="1.25" />
            <Input name="airportFee" placeholder="Airport fee" defaultValue="5" />
            <Input name="cancellationFee" placeholder="Cancellation" defaultValue="6" />
            <Input name="waitingFee" placeholder="Waiting" defaultValue="0.4" />
            <Input name="commissionPercent" placeholder="Commission %" defaultValue="20" />
            <Input name="surgeMultiplier" placeholder="Surge" defaultValue="1" />
            <Button className="md:col-span-4">Submit for approval</Button>
          </form>
        </Panel>
      ) : null}
      <div className="h-4" />
      <Panel title="Fare configs">
        <Table
          columns={["Market", "Components", "Commission", "Status", "Actions"]}
          rows={(data?.configs ?? []).map((row) => [
            `${row.city} / ${row.zone ?? "all"} / ${row.vehicleType}`,
            `base ${row.baseFare} · km ${row.perKm} · min ${row.perMinute} · min fare ${row.minFare}`,
            `${row.commissionPercent}% · surge ${row.surgeMultiplier}x`,
            <Badge key="s" tone={statusTone(row.status)}>{row.status}</Badge>,
            approve ? (
              <div key="a" className="flex gap-2">
                <button className="text-emerald-300" onClick={() => void transition(row.id, "approve")}>
                  Approve
                </button>
                <button className="text-rose-300" onClick={() => void transition(row.id, "rollback")}>
                  Rollback
                </button>
              </div>
            ) : (
              "—"
            ),
          ])}
        />
      </Panel>
      <div className="h-4" />
      <Panel title="Service areas">
        <Table
          columns={["Zone", "City", "Kind"]}
          rows={(data?.zones ?? []).map((zone) => [zone.name, zone.city, zone.kind])}
        />
      </Panel>
    </Guard>
  );
}
