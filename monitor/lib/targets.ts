import type { Target } from "./types";

function envUrl(name: string, fallback: string): string | null {
  const raw = process.env[name];
  if (raw === "") {
    return null;
  }
  return (raw ?? fallback).trim() || null;
}

export function getTargets(): Target[] {
  const requireSplit = process.env.MONITOR_REQUIRE_SPLIT === "1";

  const specs: Array<Omit<Target, "url"> & { url: string | null }> = [
    {
      id: "gateway",
      name: "Gateway",
      group: "api",
      optional: false,
      url: envUrl("MONITOR_GATEWAY_URL", "http://localhost:4000/api/health"),
    },
    {
      id: "auth",
      name: "Auth",
      group: "api",
      optional: !requireSplit,
      url: envUrl("MONITOR_AUTH_URL", "http://localhost:4000/api/auth/health"),
    },
    {
      id: "location",
      name: "Location",
      group: "api",
      optional: !requireSplit,
      url: envUrl("MONITOR_LOCATION_URL", "http://localhost:4000/api/location/health"),
    },
    {
      id: "ride",
      name: "Ride",
      group: "api",
      optional: !requireSplit,
      url: envUrl("MONITOR_RIDE_URL", "http://localhost:4000/api/ride/health"),
    },
    {
      id: "notify",
      name: "Notify",
      group: "api",
      optional: !requireSplit,
      url: envUrl("MONITOR_NOTIFY_URL", "http://localhost:4000/api/notify/health"),
    },
    {
      id: "admin",
      name: "Admin",
      group: "frontend",
      optional: false,
      url: envUrl("MONITOR_ADMIN_URL", "http://localhost:3000"),
    },
    {
      id: "rider",
      name: "Rider",
      group: "frontend",
      optional: true,
      url: envUrl("MONITOR_RIDER_URL", "http://localhost:8081"),
    },
    {
      id: "driver",
      name: "Driver",
      group: "frontend",
      optional: true,
      url: envUrl("MONITOR_DRIVER_URL", "http://localhost:8082"),
    },
  ];

  return specs.filter((target): target is Target => Boolean(target.url));
}
