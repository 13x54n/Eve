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
  const path = useMemo(() => `/admin/vehicles?q=${encodeURIComponent(q)}`, [q]);
  const { data, reload } = useApi<VehicleList>(path);
  const { data: fleets } = useApi<{ name: string; _count: { drivers: number; vehicles: number } }[]>(
    "/admin/fleets",
  );
  const { data: drivers } = useApi<DriverList>("/admin/drivers");
  const write = can(user, "vehicles:write");

  return (
    <Guard allowed={can(user, "drivers:read")}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vehicles & fleets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage fleet inventory, service tiers, inspections, and driver assignments.
          </p>
        </div>
        <FilterBar>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search plate, make, model"
            className="w-full sm:w-80"
          />
        </FilterBar>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {(fleets ?? []).map((fleet) => (
            <Panel key={fleet.name} title={fleet.name}>
              <p className="text-sm font-medium text-slate-700">
                <span className="font-semibold text-slate-900">{fleet._count.drivers}</span> drivers · <span className="font-semibold text-slate-900">{fleet._count.vehicles}</span> vehicles
              </p>
            </Panel>
          ))}
        </div>
        <Panel title={`${data?.total ?? 0} vehicles`}>
          <Table
            columns={["Plate", "Vehicle", "Type", "Service", "Inspection", "Assigned Driver", "Quick Assign"]}
            rows={(data?.items ?? []).map((vehicle) => [
              <span key="p" className="font-mono font-semibold text-slate-900">{vehicle.plateNumber}</span>,
              `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.color}`,
              <span key="t" className="font-semibold text-slate-700">{vehicle.vehicleType === "BIKE" ? "Bike" : "Car"}</span>,
              <span key="c" className="font-medium text-slate-700">{`${vehicle.serviceCategory} (${vehicle.capacity} pax)`}</span>,
              <Badge key="i" tone={statusTone(vehicle.inspectionStatus)}>
                {vehicle.inspectionStatus}
              </Badge>,
              <span key="d" className="font-medium text-slate-800">{vehicle.driver?.user.name ?? "Unassigned"}</span>,
              write ? (
                <select
                  key="s"
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-[#2e4ed2] focus:ring-2 focus:ring-[#2e4ed2]/15 outline-none cursor-pointer"
                  defaultValue={vehicle.driver ? (drivers?.items.find(d => d.user.name === vehicle.driver?.user.name)?.id ?? "") : ""}
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
      </div>
    </Guard>
  );
}

