"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { can, type Permission } from "@/lib/permissions";
import { useAdminSocket } from "@/lib/socket";
import { OpsInbox } from "@/components/ops-inbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Car,
  LayoutDashboard,
  MapPin,
  User,
  Users,
  Tag,
  Shield,
  Headphones,
  LogOut,
} from "lucide-react";

const navGroups: {
  label: string;
  items: { href: string; label: string; permission: Permission; icon: React.ReactNode }[];
}[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        permission: "dashboard:read",
        icon: <LayoutDashboard size={16} strokeWidth={1.75} />,
      },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/riders", label: "Riders", permission: "riders:read", icon: <Users size={16} strokeWidth={1.75} /> },
      { href: "/drivers", label: "Drivers", permission: "drivers:read", icon: <User size={16} strokeWidth={1.75} /> },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/vehicles", label: "Vehicles", permission: "vehicles:read", icon: <Car size={16} strokeWidth={1.75} /> },
      { href: "/trips", label: "Trips", permission: "trips:read", icon: <MapPin size={16} strokeWidth={1.75} /> },
      { href: "/pricing", label: "Pricing & zones", permission: "pricing:read", icon: <Tag size={16} strokeWidth={1.75} /> },
    ],
  },
  {
    label: "Risk",
    items: [
      { href: "/safety", label: "Safety", permission: "safety:read", icon: <Shield size={16} strokeWidth={1.75} /> },
      { href: "/support", label: "Support", permission: "support:read", icon: <Headphones size={16} strokeWidth={1.75} /> },
    ],
  },
];

function pageTitle(pathname: string) {
  if (pathname.startsWith("/riders/")) return "Rider";
  if (pathname.startsWith("/drivers/")) return "Driver";
  if (pathname.startsWith("/trips/")) return "Trip";
  const match = navGroups.flatMap((group) => group.items).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.label ?? "Console";
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { connected } = useAdminSocket();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-sidebar text-sm text-sidebar-foreground">
        Loading console…
      </div>
    );
  }

  const groups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(user, item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar text-sidebar-foreground flex flex-col z-30">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <img
            src="https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742"
            className="h-6 w-auto object-contain brightness-0 invert"
            alt="Eve"
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
            Ops
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-r-md border-l-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                        active
                          ? "border-white bg-sidebar-accent text-white"
                          : "border-transparent text-neutral-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className={active ? "text-white" : "text-neutral-500"}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <p className="truncate text-xs font-medium text-white">{user.name}</p>
          <p className="truncate text-[11px] capitalize text-neutral-500">
            {user.adminStaffRole?.toLowerCase()}
          </p>
        </div>
      </aside>

      <div className="flex-1 ml-60 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-white px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight">{pageTitle(pathname)}</h1>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className={`inline-flex h-1.5 w-1.5 rounded-full ${connected ? "bg-success" : "bg-neutral-300"}`} />
              <span className="text-[11px] font-medium text-muted-foreground">{connected ? "Live" : "Polling"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OpsInbox />
            <Popover>
            <PopoverTrigger
              render={
                <button className="flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1 transition hover:bg-muted cursor-pointer">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-medium leading-tight">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{user.email}</p>
                  </div>
                </button>
              }
            />
            <PopoverContent align="end" className="w-52 p-1.5">
              <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1">
                Signed in as <span className="font-medium text-foreground">{user.name}</span>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-red-50 transition cursor-pointer"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </PopoverContent>
          </Popover>
          </div>
        </header>
        <main className="p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
