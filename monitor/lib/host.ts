import os from "node:os";
import type { HostSnapshot } from "./types";

export function readHost(): HostSnapshot {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    loadavg: os.loadavg() as [number, number, number],
    totalMem,
    freeMem,
    usedMem: totalMem - freeMem,
    uptimeSec: Math.round(os.uptime()),
    process: {
      pid: process.pid,
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      uptimeSec: Math.round(process.uptime()),
    },
  };
}
