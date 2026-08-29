import type { ProbeResult, ServiceHealth, Target } from "./types";

const TIMEOUT_MS = 8_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseHealth(body: unknown): ServiceHealth | null {
  if (!isRecord(body)) {
    return null;
  }

  const memory = isRecord(body.memory) ? body.memory : null;
  const host = isRecord(body.host) ? body.host : null;

  return {
    status: typeof body.status === "string" ? body.status : undefined,
    service: typeof body.service === "string" ? body.service : undefined,
    timestamp: typeof body.timestamp === "string" ? body.timestamp : undefined,
    uptimeSec: typeof body.uptimeSec === "number" ? body.uptimeSec : undefined,
    pid: typeof body.pid === "number" ? body.pid : undefined,
    memory: memory
      ? {
          rss: Number(memory.rss) || 0,
          heapUsed: Number(memory.heapUsed) || 0,
          heapTotal: Number(memory.heapTotal) || 0,
          external: Number(memory.external) || 0,
        }
      : undefined,
    host: host
      ? {
          hostname: String(host.hostname ?? ""),
          platform: String(host.platform ?? ""),
          arch: String(host.arch ?? ""),
          cpus: Number(host.cpus) || 0,
          loadavg: Array.isArray(host.loadavg)
            ? [
                Number(host.loadavg[0]) || 0,
                Number(host.loadavg[1]) || 0,
                Number(host.loadavg[2]) || 0,
              ]
            : [0, 0, 0],
          totalMem: Number(host.totalMem) || 0,
          freeMem: Number(host.freeMem) || 0,
        }
      : undefined,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return "Timed out";
    }
    return error.message;
  }
  return "Request failed";
}

export async function probeTarget(target: Target): Promise<ProbeResult> {
  const started = performance.now();

  try {
    const response = await fetch(target.url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json, text/html;q=0.8, */*;q=0.5" },
    });

    const pingMs = Math.round(performance.now() - started);
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const health = parseHealth(parsed);
    const healthyJson =
      target.group === "frontend" ||
      health?.status === "ok" ||
      (isRecord(parsed) && parsed.status === "ok");
    const ok = response.ok && healthyJson;

    return {
      ...target,
      ok,
      statusCode: response.status,
      pingMs,
      error: ok ? null : `HTTP ${response.status}`,
      health,
    };
  } catch (error) {
    return {
      ...target,
      ok: false,
      statusCode: null,
      pingMs: Math.round(performance.now() - started),
      error: errorMessage(error),
      health: null,
    };
  }
}

export async function probeAll(targets: Target[]): Promise<ProbeResult[]> {
  return Promise.all(targets.map(probeTarget));
}
