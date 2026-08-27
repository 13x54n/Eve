"use client";

import { FormEvent } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  ErrorBanner,
  Field,
  Guard,
  Input,
  PageHeader,
  Panel,
  Table,
  statusTone,
} from "@/components/ui";
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
  const { data, reload, error, loading } = useApi<Pricing>("/admin/pricing");
  const approve = can(user, "pricing:approve");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
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
      toast.success("Fare change submitted for approval");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function transition(id: string, action: "approve" | "rollback") {
    try {
      await api(`/admin/pricing/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await reload();
      toast.success(action === "approve" ? "Fare config approved" : "Fare config rolled back");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "pricing:read")}>
      <PageHeader title="Pricing & zones" subtitle="Fare structures, commissions, and service areas." />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {approve ? (
        <div className="mb-5">
          <Panel title="Propose fare change">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={create}>
              <Field label="City">
                <Input name="city" className="w-full" defaultValue="New York" required />
              </Field>
              <Field label="Zone">
                <Input name="zone" className="w-full" />
              </Field>
              <Field label="Vehicle type">
                <Input name="vehicleType" className="w-full" defaultValue="standard" />
              </Field>
              <Field label="Effective at">
                <Input name="effectiveAt" className="w-full" type="datetime-local" required />
              </Field>
              <Field label="Base fare">
                <Input name="baseFare" className="w-full" defaultValue="3.5" />
              </Field>
              <Field label="Per km">
                <Input name="perKm" className="w-full" defaultValue="1.4" />
              </Field>
              <Field label="Per minute">
                <Input name="perMinute" className="w-full" defaultValue="0.35" />
              </Field>
              <Field label="Minimum fare">
                <Input name="minFare" className="w-full" defaultValue="8" />
              </Field>
              <Field label="Booking fee">
                <Input name="bookingFee" className="w-full" defaultValue="1.25" />
              </Field>
              <Field label="Airport fee">
                <Input name="airportFee" className="w-full" defaultValue="5" />
              </Field>
              <Field label="Cancellation">
                <Input name="cancellationFee" className="w-full" defaultValue="6" />
              </Field>
              <Field label="Waiting fee">
                <Input name="waitingFee" className="w-full" defaultValue="0.4" />
              </Field>
              <Field label="Commission %">
                <Input name="commissionPercent" className="w-full" defaultValue="20" />
              </Field>
              <Field label="Surge">
                <Input name="surgeMultiplier" className="w-full" defaultValue="1" />
              </Field>
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <Button>Submit for approval</Button>
              </div>
            </form>
          </Panel>
        </div>
      ) : null}
      <div className="space-y-5">
        <Panel title="Fare configs" flush>
          <Table
            loading={loading && !data}
            empty="No fare configs yet."
            columns={["Market", "Components", "Commission / surge", "Status", "Actions"]}
            rows={(data?.configs ?? []).map((row) => [
              <span key="m" className="font-semibold">{`${row.city} / ${row.zone ?? "All"} / ${row.vehicleType}`}</span>,
              <span key="c" className="text-[12px] text-muted-foreground">{`Base $${row.baseFare} · $${row.perKm}/km · $${row.perMinute}/min · Min $${row.minFare}`}</span>,
              `${row.commissionPercent}% · ${row.surgeMultiplier}x`,
              <Badge key="b" tone={statusTone(row.status)}>
                {row.status}
              </Badge>,
              approve ? (
                <div key="a" className="flex gap-3">
                  <button
                    className="cursor-pointer text-[12px] font-semibold text-emerald-700 hover:underline"
                    onClick={() => void transition(row.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="cursor-pointer text-[12px] font-semibold text-red-600 hover:underline"
                    onClick={() => void transition(row.id, "rollback")}
                  >
                    Rollback
                  </button>
                </div>
              ) : (
                "—"
              ),
            ])}
          />
        </Panel>
        <Panel title="Service areas" flush>
          <Table
            loading={loading && !data}
            empty="No zones configured."
            columns={["Zone", "City", "Kind"]}
            rows={(data?.zones ?? []).map((zone) => [
              <span key="n" className="font-semibold">
                {zone.name}
              </span>,
              zone.city,
              <span key="k" className="capitalize">
                {zone.kind.toLowerCase()}
              </span>,
            ])}
          />
        </Panel>
      </div>
    </Guard>
  );
}
