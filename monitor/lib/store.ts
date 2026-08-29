import type { HistoryPoint, OverallStatus, ProbeResult } from "./types";

const MAX_POINTS = 72;

const history: HistoryPoint[] = [];

export function recordPings(targets: ProbeResult[]): HistoryPoint {
  const point: HistoryPoint = {
    at: new Date().toISOString(),
    pings: Object.fromEntries(targets.map((target) => [target.id, target.ok ? target.pingMs : null])),
  };

  history.push(point);
  if (history.length > MAX_POINTS) {
    history.splice(0, history.length - MAX_POINTS);
  }

  return point;
}

export function getHistory(): HistoryPoint[] {
  return history.slice();
}

export function overallStatus(targets: ProbeResult[]): OverallStatus {
  const required = targets.filter((target) => !target.optional);
  if (required.length === 0) {
    return targets.every((target) => target.ok) ? "up" : "down";
  }

  const up = required.filter((target) => target.ok).length;
  if (up === required.length) {
    return "up";
  }
  if (up === 0) {
    return "down";
  }
  return "degraded";
}
