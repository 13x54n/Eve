export type TargetGroup = "api" | "frontend";

export type Target = {
  id: string;
  name: string;
  group: TargetGroup;
  url: string;
  optional: boolean;
};

export type ServiceHealth = {
  status?: string;
  service?: string;
  timestamp?: string;
  uptimeSec?: number;
  pid?: number;
  memory?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  host?: {
    hostname: string;
    platform: string;
    arch: string;
    cpus: number;
    loadavg: [number, number, number];
    totalMem: number;
    freeMem: number;
  };
};

export type ProbeResult = {
  id: string;
  name: string;
  group: TargetGroup;
  url: string;
  optional: boolean;
  ok: boolean;
  statusCode: number | null;
  pingMs: number | null;
  error: string | null;
  health: ServiceHealth | null;
};

export type HostSnapshot = {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  loadavg: [number, number, number];
  totalMem: number;
  freeMem: number;
  usedMem: number;
  uptimeSec: number;
  process: {
    pid: number;
    rss: number;
    heapUsed: number;
    heapTotal: number;
    uptimeSec: number;
  };
};

export type HistoryPoint = {
  at: string;
  pings: Record<string, number | null>;
};

export type OverallStatus = "up" | "degraded" | "down";

export type Snapshot = {
  checkedAt: string;
  intervalMs: number;
  overall: OverallStatus;
  targets: ProbeResult[];
  history: HistoryPoint[];
  host: HostSnapshot;
};
