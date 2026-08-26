"use client";

import type { Permission } from "@/lib/permissions";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400 ${props.className ?? ""}`}
    />
  );
}

export function Button({
  children,
  tone = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost" | "danger";
}) {
  const tones = {
    primary: "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
    ghost: "border border-slate-700 text-slate-200 hover:bg-slate-800",
    danger: "bg-rose-500 text-white hover:bg-rose-400",
  };

  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium disabled:opacity-50 ${tones[tone]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "blue";
}) {
  const tones = {
    slate: "bg-slate-800 text-slate-300",
    green: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    rose: "bg-rose-500/15 text-rose-300",
    blue: "bg-sky-500/15 text-sky-300",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-800">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2.5 text-slate-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-slate-500">
          No records found.
        </p>
      ) : null}
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap gap-2">{children}</div>;
}

export function Guard({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) {
  if (!allowed) {
    return (
      <p className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-sm text-slate-400">
        Your role does not include this module.
      </p>
    );
  }

  return children;
}

export function statusTone(status: string) {
  if (["COMPLETED", "APPROVED", "ACTIVE", "PAID", "RESOLVED"].includes(status)) {
    return "green" as const;
  }

  if (["PENDING", "SCHEDULED", "IDLE", "WAITING", "OPEN"].includes(status)) {
    return "amber" as const;
  }

  if (
    ["CANCELLED", "FAILED", "SOS", "CRITICAL", "BLOCKED", "REJECTED"].includes(
      status,
    )
  ) {
    return "rose" as const;
  }

  return "blue" as const;
}

export type { Permission };
