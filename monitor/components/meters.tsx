type BarProps = {
  value: number;
  tone?: "info" | "up" | "warn" | "down";
};

const toneClass = {
  info: "bg-info",
  up: "bg-up",
  warn: "bg-warn",
  down: "bg-down",
};

export function Meter({ value, tone = "info" }: BarProps) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${toneClass[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function LoadLane({ label, value, cores }: { label: string; value: number; cores: number }) {
  const pct = cores > 0 ? (value / cores) * 100 : 0;
  const tone = pct >= 90 ? "down" : pct >= 70 ? "warn" : "info";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular-nums">{value.toFixed(2)}</span>
      </div>
      <Meter value={pct} tone={tone} />
    </div>
  );
}
