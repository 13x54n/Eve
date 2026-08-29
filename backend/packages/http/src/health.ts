import os from "node:os";

export type HealthPayload = {
  status: "ok";
  service: string;
  timestamp: string;
  uptimeSec: number;
  pid: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  host: {
    hostname: string;
    platform: string;
    arch: string;
    cpus: number;
    loadavg: [number, number, number];
    totalMem: number;
    freeMem: number;
  };
};

export function healthPayload(service: string): HealthPayload {
  const mem = process.memoryUsage();
  const load = os.loadavg() as [number, number, number];

  return {
    status: "ok",
    service,
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    host: {
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      loadavg: load,
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
    },
  };
}
