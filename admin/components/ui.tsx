"use client";

import Link from "next/link";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref ? (
          <Link href={backHref} className="mb-1.5 inline-block text-[12px] font-medium text-muted-foreground hover:text-foreground">
            ← {backLabel}
          </Link>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <div className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ErrorBanner({
  children,
  message,
}: {
  children?: React.ReactNode;
  message?: string;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
      {message ?? children}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      {body ? <p className="mt-1 text-[12px] text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-[88px] animate-pulse rounded-lg border border-border bg-white" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-9 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

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
    <div className="rounded-lg border border-border bg-white px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  flush,
  padded,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  padded?: boolean;
}) {
  const isFlush = flush || padded === false;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white">
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className={isFlush ? "" : "p-4 text-[13px] text-foreground"}>{children}</div>
    </section>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 rounded-md border border-input bg-white px-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition focus:border-foreground focus:ring-1 focus:ring-foreground disabled:opacity-50",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 rounded-md border border-input bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-foreground focus:ring-1 focus:ring-foreground disabled:opacity-50",
        props.className,
      )}
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
    primary: "bg-primary text-primary-foreground hover:bg-neutral-800",
    ghost: "border border-border bg-white text-foreground hover:bg-muted",
    danger: "bg-destructive text-white hover:bg-red-700",
  };

  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3.5 text-[13px] font-medium transition-colors disabled:opacity-50",
        tones[tone],
        props.className,
      )}
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
    slate: "bg-muted text-foreground",
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-red-50 text-red-700",
    blue: "bg-neutral-100 text-neutral-700",
  };

  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone])}>
      {children}
    </span>
  );
}

export function Table({
  columns,
  rows,
  loading,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-2.5 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={index} className="transition-colors hover:bg-muted/40">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {loading && rows.length === 0 ? <TableSkeleton rows={5} /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState title={empty ?? "No records found."} />
      ) : null}
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[12px] font-medium text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
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
      <section className="rounded-lg border border-border bg-white">
        <EmptyState
          title="You don’t have access to this module."
          body="Ask an owner to grant the required permission for your role."
        />
      </section>
    );
  }

  return children;
}

export function statusTone(status: string) {
  if (["COMPLETED", "APPROVED", "ACTIVE", "PAID", "RESOLVED", "ONLINE", "ON_TRIP"].includes(status)) {
    return "green" as const;
  }

  if (["PENDING", "SCHEDULED", "IDLE", "WAITING", "OPEN", "FLAGGED", "SEARCHING", "ASSIGNED", "ONGOING"].includes(status)) {
    return "amber" as const;
  }

  if (
    ["CANCELLED", "FAILED", "SOS", "CRITICAL", "BLOCKED", "REJECTED", "SUSPENDED", "OFFLINE"].includes(
      status,
    )
  ) {
    return "rose" as const;
  }

  return "blue" as const;
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
}

export type { Permission };
