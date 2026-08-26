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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
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
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {actions}
      </div>
      <div className="p-5 text-slate-700">{children}</div>
    </section>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#2e4ed2] focus:ring-2 focus:ring-[#2e4ed2]/15 disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-[#2e4ed2] focus:ring-2 focus:ring-[#2e4ed2]/15 disabled:opacity-50 ${props.className ?? ""}`}
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
    primary: "bg-[#2e4ed2] text-white hover:bg-[#243fb3] active:bg-[#1d35a6] shadow-xs",
    ghost: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs",
    danger: "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-xs",
  };

  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer ${tones[tone]} ${props.className ?? ""}`}
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
    slate: "bg-slate-100 text-slate-700 border border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border border-amber-200",
    rose: "bg-rose-50 text-rose-700 border border-rose-200",
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
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
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/75 border-b border-slate-200">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50/60 transition-colors">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No records found.
        </p>
      ) : null}
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
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
      <p className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-xs">
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

  if (["PENDING", "SCHEDULED", "IDLE", "WAITING", "OPEN", "FLAGGED"].includes(status)) {
    return "amber" as const;
  }

  if (
    ["CANCELLED", "FAILED", "SOS", "CRITICAL", "BLOCKED", "REJECTED", "SUSPENDED"].includes(
      status,
    )
  ) {
    return "rose" as const;
  }

  return "blue" as const;
}

export type { Permission };

