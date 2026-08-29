"use client";

export function BarList({
  items,
  empty = "No data yet.",
}: {
  items: { label: string; value: number }[];
  empty?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  if (items.length === 0) {
    return <p className="py-6 text-center text-[12px] text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="w-[88px] shrink-0 truncate text-[11px] text-muted-foreground">{item.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-2 rounded bg-neutral-800"
              style={{ width: `${max === 0 ? 0 : Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
