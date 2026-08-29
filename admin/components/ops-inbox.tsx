"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { addAdminSocketListener } from "@/lib/socket";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const STORAGE_KEY = "eve_ops_inbox";

type InboxItem = {
  id: string;
  kind: "ticket" | "sos";
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

type StoredInbox = {
  lastSeen: string;
  toasted: string[];
};

function loadStore(): StoredInbox {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const now = new Date().toISOString();
      return { lastSeen: now, toasted: [] };
    }
    const parsed = JSON.parse(raw) as StoredInbox;
    return {
      lastSeen: parsed.lastSeen ?? new Date(0).toISOString(),
      toasted: Array.isArray(parsed.toasted) ? parsed.toasted.slice(-200) : [],
    };
  } catch {
    return { lastSeen: new Date(0).toISOString(), toasted: [] };
  }
}

function saveStore(store: StoredInbox) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function OpsInbox() {
  const { user } = useAuth();
  const canTickets = can(user, "support:read");
  const canSafety = can(user, "safety:read");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const storeRef = useRef<StoredInbox>({ lastSeen: new Date(0).toISOString(), toasted: [] });
  const seededRef = useRef(false);

  const remember = useCallback((id: string) => {
    const store = storeRef.current;
    if (store.toasted.includes(id)) {
      return;
    }
    store.toasted = [...store.toasted, id].slice(-200);
    saveStore(store);
  }, []);

  const announce = useCallback((item: InboxItem) => {
    const store = storeRef.current;
    if (store.toasted.includes(item.id)) {
      return;
    }
    remember(item.id);
    setItems((current) => [item, ...current.filter((row) => row.id !== item.id)].slice(0, 20));
    setUnread((count) => count + 1);
    toast(item.title, {
      description: item.body,
      action: {
        label: "Open",
        onClick: () => {
          window.location.href = item.href;
        },
      },
    });
  }, [remember]);

  useEffect(() => {
    storeRef.current = loadStore();
  }, []);

  useEffect(() => {
    if (!canTickets && !canSafety) {
      return;
    }

    return addAdminSocketListener((event, payload) => {
      if (event === "admin:ticket" && canTickets && payload && typeof payload === "object") {
        const body = payload as { ticketId?: string; subject?: string; requesterName?: string; kind?: string };
        if (!body.ticketId) {
          return;
        }
        announce({
          id: body.kind === "reply" ? `${body.ticketId}:reply:${Date.now()}` : body.ticketId,
          kind: "ticket",
          title: body.kind === "reply" ? "Support reply" : "New support ticket",
          body: `${body.requesterName ?? "Customer"} · ${body.subject ?? "Ticket"}`,
          href: `/support/${body.ticketId}`,
          createdAt: new Date().toISOString(),
        });
      }
      if (event === "admin:sos" && canSafety && payload && typeof payload === "object") {
        const body = payload as { id?: string; bookingCode?: string };
        announce({
          id: body.id ?? `sos:${Date.now()}`,
          kind: "sos",
          title: "SOS alert",
          body: body.bookingCode ? `Trip ${body.bookingCode}` : "Open safety incident",
          href: "/safety",
          createdAt: new Date().toISOString(),
        });
      }
    });
  }, [announce, canSafety, canTickets]);

  useEffect(() => {
    if (!canTickets && !canSafety) {
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const [tickets, safety] = await Promise.all([
          canTickets
            ? api<{
                items: {
                  id: string;
                  subject: string;
                  status: string;
                  createdAt: string;
                  requester?: { name: string } | null;
                }[];
              }>("/admin/tickets?take=20")
            : Promise.resolve({ items: [] }),
          canSafety
            ? api<{
                sos: { id: string; trip: { bookingCode: string } | null }[];
              }>("/admin/safety")
            : Promise.resolve({ sos: [] }),
        ]);

        if (cancelled) {
          return;
        }

        const next: InboxItem[] = [];
        for (const ticket of tickets.items) {
          if (!["OPEN", "IN_PROGRESS", "WAITING"].includes(ticket.status)) {
            continue;
          }
          const item: InboxItem = {
            id: ticket.id,
            kind: "ticket",
            title: ticket.subject,
            body: ticket.requester?.name ?? "Customer",
            href: `/support/${ticket.id}`,
            createdAt: ticket.createdAt,
          };
          next.push(item);
          if (!seededRef.current) {
            remember(item.id);
          } else {
            announce(item);
          }
        }
        for (const incident of safety.sos) {
          const item: InboxItem = {
            id: incident.id,
            kind: "sos",
            title: "Open SOS",
            body: incident.trip?.bookingCode ?? "No trip",
            href: "/safety",
            createdAt: new Date().toISOString(),
          };
          next.push(item);
          if (!seededRef.current) {
            remember(item.id);
          } else {
            announce(item);
          }
        }
        seededRef.current = true;
        setItems(next.slice(0, 20));
      } catch {
        /* poll is a fallback; socket still works */
      }
    }

    void poll();
    const timer = window.setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [announce, canSafety, canTickets, remember]);

  const markSeen = useCallback(() => {
    storeRef.current = { ...storeRef.current, lastSeen: new Date().toISOString() };
    saveStore(storeRef.current);
    setUnread(0);
  }, []);

  const empty = useMemo(() => items.length === 0, [items.length]);

  if (!canTickets && !canSafety) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={markSeen}
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white transition hover:bg-muted cursor-pointer"
            aria-label="Ops inbox"
          >
            <Bell size={16} strokeWidth={1.75} />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-[12px] font-semibold">Live inbox</div>
        {empty ? (
          <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">No open tickets or SOS.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted"
              >
                <p className="text-[12px] font-semibold">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.body}</p>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
