"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { can, type Permission } from "@/lib/permissions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Car,
  Cpu,
  MapPin,
  User,
  Users,
  Tag,
  Shield,
  Headphones,
  LogOut,
} from "lucide-react";

const nav: { href: string; label: string; permission: Permission; icon: React.ReactNode }[] = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:read", icon: <Cpu size={18} strokeWidth={1.75} /> },
  { href: "/riders", label: "Riders", permission: "riders:read", icon: <Users size={18} strokeWidth={1.75} /> },
  { href: "/drivers", label: "Drivers", permission: "drivers:read", icon: <User size={18} strokeWidth={1.75} /> },
  { href: "/vehicles", label: "Vehicles", permission: "vehicles:read", icon: <Car size={18} strokeWidth={1.75} /> },
  { href: "/trips", label: "Trips", permission: "trips:read", icon: <MapPin size={18} strokeWidth={1.75} /> },
  { href: "/pricing", label: "Pricing & zones", permission: "pricing:read", icon: <Tag size={18} strokeWidth={1.75} /> },
  { href: "/safety", label: "Safety", permission: "safety:read", icon: <Shield size={18} strokeWidth={1.75} /> },
  { href: "/support", label: "Support", permission: "support:read", icon: <Headphones size={18} strokeWidth={1.75} /> },
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
      <div className="grid min-h-screen place-items-center text-sm font-medium text-slate-500 bg-[#f7f8ef]">
        Loading console…
      </div>
    );
  }

  const items = nav.filter((item) => can(user, item.permission));

  return (
    <div className="min-h-screen bg-[#f7f8ef] text-slate-900 flex">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200/80 bg-white flex flex-col z-30">
        <div className="flex h-16 items-center px-6 border-b border-slate-100">
          <img
            src="https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742"
            className="h-8 w-auto object-contain"
            alt="Eve"
          />
        </div>
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-[#2e4ed2] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <span className={active ? "text-white" : "text-slate-500"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="rounded-xl bg-[#f7f8ef] border border-slate-200/60 p-3">
            <p className="text-xs font-semibold text-slate-800">{user.name}</p>
            <p className="text-[11px] text-slate-500 capitalize">{user.adminStaffRole?.toLowerCase()} Console</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-500">Live Operations</span>
          </div>
          <Popover>
            <PopoverTrigger render={
              <button className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs transition hover:bg-slate-50 cursor-pointer">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-[#2e4ed2] text-white text-xs font-semibold">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</p>
                  <p className="text-[11px] text-slate-500 leading-tight">{user.email}</p>
                </div>
              </button>
            } />
            <PopoverContent align="end" className="w-52 p-2">
              <div className="px-2 py-1.5 text-xs text-slate-500 border-b border-slate-100 mb-1">
                Signed in as <span className="font-semibold text-slate-800">{user.name}</span>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </PopoverContent>
          </Popover>
        </header>
        <main className="p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

