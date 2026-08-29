"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadLane, Meter } from "@/components/meters";
import { Sparkline } from "@/components/sparkline";
import { formatBytes, formatDuration, formatPing, hostLabel } from "@/lib/format";
import type { OverallStatus, ProbeResult, Snapshot } from "@/lib/types";

const POLL_MS = 5_000;

const overallCopy: Record<OverallStatus, { label: string; className: string }> = {
  up: { label: "All systems up", className: "text-up border-up/30 bg-up/10" },
  degraded: { label: "Degraded", className: "text-warn border-warn/30 bg-warn/10" },
  down: { label: "Required systems down", className: "text-down border-down/30 bg-down/10" },
};

function pingTone(ms: number | null, ok: boolean): string {
  if (!ok || ms == null) {
    return "text-down";
  }
  if (ms >= 400) {
    return "text-warn";
  }
  return "text-up";
}

function memoryTone(used: number, total: number): "info" | "warn" | "down" {
  const pct = total > 0 ? used / total : 0;
  if (pct >= 0.9) {
    return "down";
  }
  if (pct >= 0.75) {
    return "warn";
  }
  return "info";
}

function timeAgo(iso: string | null): string {
  if (!iso) {
    return "never";
  }
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  if (delta < 2_000) {
    return "just now";
  }
  if (delta < 60_000) {
    return `${Math.round(delta / 1000)}s ago`;
  }
  return `${Math.round(delta / 60_000)}m ago`;
}

export function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/snapshot", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Snapshot failed (${response.status})`);
      }
      const data = (await response.json()) as Snapshot;
      setSnapshot(data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load snapshot");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), POLL_MS);
    const clock = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [load]);

  const required = snapshot?.targets.filter((target) => !target.optional) ?? [];
  const requiredUp = required.filter((target) => target.ok).length;
  const pings = (snapshot?.targets ?? [])
    .filter((target) => target.ok && target.pingMs != null)
    .map((target) => target.pingMs as number);
  const avgPing = pings.length ? Math.round(pings.reduce((sum, value) => sum + value, 0) / pings.length) : null;
  const memPct = snapshot ? (snapshot.host.usedMem / snapshot.host.totalMem) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-info uppercase">Eve · observability</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Monitor</h1>
          <p className="mt-1 text-sm text-muted">Liveness, ping, memory, and host performance for APIs and frontends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {snapshot ? (
            <span
              className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide uppercase ${overallCopy[snapshot.overall].className}`}
            >
              {overallCopy[snapshot.overall].label}
            </span>
          ) : null}
          <span key={tick} className="font-mono text-[11px] text-muted">
            {timeAgo(snapshot?.checkedAt ?? null)}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-line bg-panel-2 px-3 py-1.5 font-mono text-[11px] tracking-wide uppercase transition hover:border-ring"
          >
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-5 rounded-lg border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{error}</p>
      ) : null}

      {loading && !snapshot ? (
        <p className="font-mono text-sm text-muted">Probing services…</p>
      ) : snapshot ? (
        <>
          <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Required up" value={`${requiredUp}/${required.length}`} hint="Gateway + admin" />
            <Kpi label="Avg ping" value={avgPing == null ? "—" : `${avgPing} ms`} hint={`${pings.length} live targets`} />
            <Kpi
              label="Host memory"
              value={`${memPct.toFixed(0)}%`}
              hint={`${formatBytes(snapshot.host.usedMem)} of ${formatBytes(snapshot.host.totalMem)}`}
            />
            <Kpi
              label="Load 1m"
              value={snapshot.host.loadavg[0].toFixed(2)}
              hint={`${snapshot.host.cpus} cores · ${snapshot.host.hostname}`}
            />
          </section>

          <Section title="API services" note="Split ports are optional unless MONITOR_REQUIRE_SPLIT=1">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.targets
                .filter((target) => target.group === "api")
                .map((target) => (
                  <TargetCard key={target.id} target={target} history={snapshot.history} />
                ))}
            </div>
          </Section>

          <Section title="Frontends" note="HTTP GET of the public origin">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.targets
                .filter((target) => target.group === "frontend")
                .map((target) => (
                  <TargetCard key={target.id} target={target} history={snapshot.history} />
                ))}
            </div>
          </Section>

          <Section title="Host performance" note="This monitor process and machine">
            <HostPanel snapshot={snapshot} />
          </Section>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-4">
      <p className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">{label}</p>
      <p className="mt-2 font-mono text-2xl tracking-tight">{value}</p>
      <p className="mt-1 text-[12px] text-muted">{hint}</p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
        <p className="text-[12px] text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

function TargetCard({ target, history }: { target: ProbeResult; history: Snapshot["history"] }) {
  const series = useMemo(
    () => history.map((point) => point.pings[target.id] ?? null),
    [history, target.id],
  );
  const mem = target.health?.memory;
  const host = target.health?.host;
  const usedHost = host ? host.totalMem - host.freeMem : 0;

  return (
    <article className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{target.name}</h3>
            {target.optional ? (
              <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-muted uppercase">
                optional
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{hostLabel(target.url)}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${
            target.ok ? "bg-up/10 text-up" : "bg-down/10 text-down"
          }`}
        >
          {target.ok ? "up" : "down"}
        </span>
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div className={`w-28 text-info ${target.ok ? "" : "opacity-40"}`}>
          <Sparkline values={series} />
        </div>
        <p className={`font-mono text-lg tabular-nums ${pingTone(target.pingMs, target.ok)}`}>
          {formatPing(target.ok ? target.pingMs : null)}
        </p>
      </div>

      {target.ok && mem ? (
        <div className="space-y-2 border-t border-line pt-3">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-muted">Heap</span>
            <span>
              {formatBytes(mem.heapUsed)} / {formatBytes(mem.heapTotal)}
            </span>
          </div>
          <Meter
            value={mem.heapTotal ? (mem.heapUsed / mem.heapTotal) * 100 : 0}
            tone={memoryTone(mem.heapUsed, mem.heapTotal)}
          />
          <div className="flex justify-between font-mono text-[11px] text-muted">
            <span>RSS {formatBytes(mem.rss)}</span>
            {target.health?.uptimeSec != null ? <span>up {formatDuration(target.health.uptimeSec)}</span> : null}
          </div>
          {host ? (
            <p className="font-mono text-[11px] text-muted">
              {host.hostname} · load {host.loadavg[0].toFixed(2)} · {formatBytes(usedHost)} / {formatBytes(host.totalMem)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-line pt-3 font-mono text-[11px] text-muted">
          {target.error ?? `HTTP ${target.statusCode ?? "—"}`}
        </p>
      )}
    </article>
  );
}

function HostPanel({ snapshot }: { snapshot: Snapshot }) {
  const { host } = snapshot;
  const memPct = (host.usedMem / host.totalMem) * 100;
  const heapPct = host.process.heapTotal ? (host.process.heapUsed / host.process.heapTotal) * 100 : 0;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-line bg-panel p-4 lg:col-span-2">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">Machine</p>
        <p className="mt-2 text-lg font-semibold">{host.hostname}</p>
        <p className="mt-1 font-mono text-[12px] text-muted">
          {host.platform}/{host.arch} · {host.cpus} CPUs · up {formatDuration(host.uptimeSec)}
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex justify-between text-[12px]">
            <span className="text-muted">Memory</span>
            <span className="font-mono">
              {formatBytes(host.usedMem)} / {formatBytes(host.totalMem)} ({memPct.toFixed(0)}%)
            </span>
          </div>
          <Meter value={memPct} tone={memoryTone(host.usedMem, host.totalMem)} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <LoadLane label="Load 1m" value={host.loadavg[0]} cores={host.cpus} />
          <LoadLane label="Load 5m" value={host.loadavg[1]} cores={host.cpus} />
          <LoadLane label="Load 15m" value={host.loadavg[2]} cores={host.cpus} />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">Monitor process</p>
        <dl className="mt-3 space-y-3 font-mono text-[12px]">
          <Row label="PID" value={String(host.process.pid)} />
          <Row label="Uptime" value={formatDuration(host.process.uptimeSec)} />
          <Row label="RSS" value={formatBytes(host.process.rss)} />
          <Row label="Heap" value={`${formatBytes(host.process.heapUsed)} / ${formatBytes(host.process.heapTotal)}`} />
        </dl>
        <div className="mt-4">
          <Meter value={heapPct} tone={memoryTone(host.process.heapUsed, host.process.heapTotal)} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
