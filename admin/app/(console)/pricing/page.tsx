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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pricing, zones & services</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure dynamic fare structures, service tiers, commission rates, and operational zones.
          </p>
        </div>
        {approve ? (
          <Panel title="Propose fare change">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={create}>
              <Input name="city" placeholder="City" defaultValue="New York" required />
              <Input name="zone" placeholder="Zone" />
              <Input name="vehicleType" placeholder="Vehicle type" defaultValue="standard" />
              <Input name="effectiveAt" type="datetime-local" required />
              <Input name="baseFare" placeholder="Base fare ($)" defaultValue="3.5" />
              <Input name="perKm" placeholder="Per km ($)" defaultValue="1.4" />
              <Input name="perMinute" placeholder="Per minute ($)" defaultValue="0.35" />
              <Input name="minFare" placeholder="Minimum fare ($)" defaultValue="8" />
              <Input name="bookingFee" placeholder="Booking fee ($)" defaultValue="1.25" />
              <Input name="airportFee" placeholder="Airport fee ($)" defaultValue="5" />
              <Input name="cancellationFee" placeholder="Cancellation ($)" defaultValue="6" />
              <Input name="waitingFee" placeholder="Waiting fee ($)" defaultValue="0.4" />
              <Input name="commissionPercent" placeholder="Commission %" defaultValue="20" />
              <Input name="surgeMultiplier" placeholder="Surge multiplier" defaultValue="1" />
              <Button className="sm:col-span-2 lg:col-span-4">Submit for approval</Button>
            </form>
          </Panel>
        ) : null}
        <Panel title="Fare configs">
          <Table
            columns={["Market & Tier", "Fare Components", "Commission / Surge", "Status", "Actions"]}
            rows={(data?.configs ?? []).map((row) => [
              <span key="m" className="font-semibold text-slate-900">{`${row.city} / ${row.zone ?? "All"} / ${row.vehicleType}`}</span>,
              <span key="c" className="text-xs text-slate-600 font-medium">{`Base $${row.baseFare} · $${row.perKm}/km · $${row.perMinute}/min · Min $${row.minFare}`}</span>,
              <span key="s" className="font-medium text-slate-800">{`${row.commissionPercent}% commission · ${row.surgeMultiplier}x surge`}</span>,
              <Badge key="b" tone={statusTone(row.status)}>{row.status}</Badge>,
              approve ? (
                <div key="a" className="flex gap-3">
                  <button className="font-semibold text-emerald-700 hover:text-emerald-800 text-xs transition hover:underline cursor-pointer" onClick={() => void transition(row.id, "approve")}>
                    Approve
                  </button>
                  <button className="font-semibold text-rose-600 hover:text-rose-700 text-xs transition hover:underline cursor-pointer" onClick={() => void transition(row.id, "rollback")}>
                    Rollback
                  </button>
                </div>
              ) : (
                "—"
              ),
            ])}
          />
        </Panel>
        <Panel title="Service areas & zones">
          <Table
            columns={["Zone Name", "City", "Kind"]}
            rows={(data?.zones ?? []).map((zone) => [
              <span key="n" className="font-semibold text-slate-900">{zone.name}</span>,
              <span key="c" className="text-slate-700">{zone.city}</span>,
              <span key="k" className="capitalize text-slate-600">{zone.kind.toLowerCase()}</span>,
            ])}
          />
        </Panel>
      </div>
    </Guard>
  );
}

