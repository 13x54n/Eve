import { readHost } from "@/lib/host";
import { probeAll } from "@/lib/probe";
import { getHistory, overallStatus, recordPings } from "@/lib/store";
import { getTargets } from "@/lib/targets";
import type { Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

const INTERVAL_MS = 5_000;

let inFlight: Promise<Snapshot> | null = null;

async function takeSnapshot(): Promise<Snapshot> {
  const targets = await probeAll(getTargets());
  recordPings(targets);

  return {
    checkedAt: new Date().toISOString(),
    intervalMs: INTERVAL_MS,
    overall: overallStatus(targets),
    targets,
    history: getHistory(),
    host: readHost(),
  };
}

export async function GET() {
  if (!inFlight) {
    inFlight = takeSnapshot().finally(() => {
      inFlight = null;
    });
  }

  const snapshot = await inFlight;
  return Response.json(snapshot, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
