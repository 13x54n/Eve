"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  ErrorBanner,
  FilterBar,
  Guard,
  Input,
  PageHeader,
  Panel,
  StatCard,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type VehicleList = {
  total: number;
  items: {
    id: string;
    make: string;
    model: string;
    year: number;
    plateNumber: string;
    color: string;
    vehicleType: "BIKE" | "CAR";
    serviceCategory: string;
    capacity: number;
    inspectionStatus: string;
    city: string | null;
    driver: { user: { name: string } } | null;
    fleetCompany: { name: string } | null;
  }[];
};

type DriverList = {
  items: { id: string; user: { name: string } }[];
};

export default function VehiclesPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const delayedQ = useDebouncedValue(q);
  const path = useMemo(() => `/admin/vehicles?q=${encodeURIComponent(delayedQ)}`, [delayedQ]);
  const { data, reload, error, loading } = useApi<VehicleList>(path);
  const { data: fleets } = useApi<{ name: string; _count: { drivers: number; vehicles: number } }[]>(
    "/admin/fleets",
  );
  const { data: drivers } = useApi<DriverList>("/admin/drivers");
  const write = can(user, "vehicles:write");

  return (
    <Guard allowed={can(user, "drivers:read")}>
      <PageHeader
        title="Vehicles & fleets"
        subtitle="Fleet inventory, inspections, and driver assignments."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {(fleets ?? []).map((fleet) => (
          <StatCard
            key={fleet.name}
            label={fleet.name}
            value={fleet._count.vehicles}
            hint={`${fleet._count.drivers} drivers`}
          />
        ))}
      </div>
      <Panel
        title={`${data?.total ?? 0} vehicles`}
        actions={
          <FilterBar>
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search plate, make, model"
              className="w-56"
            />
          </FilterBar>
        }
        flush
      >
        <Table
          loading={loading && !data}
          empty="No vehicles found."
          columns={["Plate", "Vehicle", "Type", "Service", "Inspection", "Assigned driver", "Quick assign"]}
          rows={(data?.items ?? []).map((vehicle) => [
            <span key="p" className="font-mono font-semibold">
              {vehicle.plateNumber}
            </span>,
            `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.color}`,
            vehicle.vehicleType === "BIKE" ? "Bike" : "Car",
            `${vehicle.serviceCategory} (${vehicle.capacity} pax)`,
            <Badge key="i" tone={statusTone(vehicle.inspectionStatus)}>
              {vehicle.inspectionStatus}
            </Badge>,
            vehicle.driver?.user.name ?? "Unassigned",
            write ? (
              <select
                key="s"
                className="h-8 cursor-pointer rounded-md border border-input bg-white px-2 text-[12px] outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
                defaultValue={
                  vehicle.driver
                    ? (drivers?.items.find((driver) => driver.user.name === vehicle.driver?.user.name)?.id ?? "")
                    : ""
                }
                onChange={(event) => {
                  void api(`/admin/vehicles/${vehicle.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      driverId: event.target.value || null,
                    }),
                  }).then(() => reload());
                }}
              >
                <option value="">Unassign</option>
                {(drivers?.items ?? []).map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.user.name}
                  </option>
                ))}
              </select>
            ) : (
              "—"
            ),
          ])}
        />
      </Panel>
    </Guard>
  );
}
