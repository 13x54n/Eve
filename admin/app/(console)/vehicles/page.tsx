"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
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

type VehicleList = {
  total: number;
  items: {
    id: string;
    make: string;
    model: string;
    year: number;
    plateNumber: string;
    color: string;
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
  const path = useMemo(() => `/admin/vehicles?q=${encodeURIComponent(q)}`, [q]);
  const { data, reload } = useApi<VehicleList>(path);
  const { data: fleets } = useApi<{ name: string; _count: { drivers: number; vehicles: number } }[]>(
    "/admin/fleets",
  );
  const { data: drivers } = useApi<DriverList>("/admin/drivers");
  const write = can(user, "vehicles:write");

  return (
    <Guard allowed={can(user, "drivers:read")}>
      <h1 className="mb-4 text-2xl font-semibold text-white">Vehicles & fleets</h1>
      <FilterBar>
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Plate, make, model" />
      </FilterBar>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {(fleets ?? []).map((fleet) => (
          <Panel key={fleet.name} title={fleet.name}>
            <p className="text-sm text-slate-300">
              {fleet._count.drivers} drivers · {fleet._count.vehicles} vehicles
            </p>
          </Panel>
        ))}
      </div>
      <Panel title={`${data?.total ?? 0} vehicles`}>
        <Table
          columns={["Plate", "Vehicle", "Service", "Inspection", "Assigned", "Assign"]}
          rows={(data?.items ?? []).map((vehicle) => [
            vehicle.plateNumber,
            `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.color}`,
            `${vehicle.serviceCategory} / ${vehicle.capacity}`,
            <Badge key="i" tone={statusTone(vehicle.inspectionStatus)}>
              {vehicle.inspectionStatus}
            </Badge>,
            vehicle.driver?.user.name ?? "Unassigned",
            write ? (
              <select
                key="s"
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                defaultValue={""}
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
