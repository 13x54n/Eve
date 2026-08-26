"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { can, type Permission } from "@/lib/permissions";

const nav: { href: string; label: string; permission: Permission }[] = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:read" },
  { href: "/riders", label: "Riders", permission: "riders:read" },
  { href: "/drivers", label: "Drivers", permission: "drivers:read" },
  { href: "/vehicles", label: "Vehicles", permission: "drivers:read" },
  { href: "/trips", label: "Trips", permission: "trips:read" },
  { href: "/pricing", label: "Pricing & zones", permission: "pricing:read" },
  { href: "/payments", label: "Payments", permission: "payments:read" },
  { href: "/safety", label: "Safety", permission: "safety:read" },
  { href: "/support", label: "Support", permission: "support:read" },
  { href: "/promotions", label: "Promotions", permission: "promotions:write" },
  { href: "/notifications", label: "Notifications", permission: "notifications:send" },
  { href: "/analytics", label: "Analytics", permission: "analytics:read" },
  { href: "/audit", label: "Audit log", permission: "audit:read" },
  { href: "/staff", label: "Staff & security", permission: "admin:manage" },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-400">
        Loading console…
      </div>
    );
  }

  const items = nav.filter((item) => can(user, item.permission));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-950/95 p-4">
        <div className="mb-6 px-2">
          <p className="text-lg font-semibold tracking-tight text-white">Eve Admin</p>
          <p className="text-xs text-slate-500">{user.adminStaffRole}</p>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3 py-2 text-sm ${
                  active
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="ml-64">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
          >
            Sign out
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
