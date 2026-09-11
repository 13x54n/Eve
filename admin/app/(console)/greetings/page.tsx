"use client";

import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import {
  Badge,
  Button,
  ErrorBanner,
  Field,
  Guard,
  Input,
  PageHeader,
  Panel,
  Select,
  Table,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Greeting = {
  id: string;
  template: string;
  enabled: boolean;
};

type GreetingState = {
  items: Greeting[];
  settings: {
    mode: "PINNED" | "ROTATE";
    pinnedGreetingId: string | null;
  };
};

function interpolate(template: string, name = "Lex") {
  return template.replaceAll("{name}", name);
}

export default function GreetingsPage() {
  const { user } = useAuth();
  const { data, reload, error, loading } = useApi<GreetingState>("/admin/greetings");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const preview = useMemo(() => {
    if (!data) {
      return "Nice to see you, Lex";
    }
    const pinned = data.items.find((item) => item.id === data.settings.pinnedGreetingId);
    const enabled = data.items.filter((item) => item.enabled);
    const source =
      data.settings.mode === "PINNED" && pinned?.enabled
        ? pinned
        : enabled[0];
    return interpolate(source?.template ?? "Nice to see you, {name}");
  }, [data]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    try {
      await api("/admin/greetings", {
        method: "POST",
        body: JSON.stringify({
          template: payload.get("template"),
          enabled: true,
        }),
      });
      form.reset();
      await reload();
      toast.success("Greeting added");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function saveTemplate(id: string) {
    const template = drafts[id];
    if (!template) {
      return;
    }
    try {
      await api(`/admin/greetings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ template }),
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await reload();
      toast.success("Greeting updated");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function setEnabled(id: string, enabled: boolean) {
    try {
      await api(`/admin/greetings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      await reload();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function pin(id: string) {
    try {
      await api("/admin/greetings/settings", {
        method: "PATCH",
        body: JSON.stringify({ mode: "PINNED", pinnedGreetingId: id }),
      });
      await reload();
      toast.success("Pinned greeting");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function setMode(mode: "PINNED" | "ROTATE") {
    try {
      await api("/admin/greetings/settings", {
        method: "PATCH",
        body: JSON.stringify({ mode }),
      });
      await reload();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function remove(id: string) {
    try {
      await api(`/admin/greetings/${id}`, { method: "DELETE" });
      await reload();
      toast.success("Greeting removed");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={can(user, "content:write")}>
      <PageHeader
        title="Greetings"
        subtitle="Home-screen copy for riders. Use {name} for their first name."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <Panel title="Add greeting">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={create}>
            <Field label="Template">
              <Input
                name="template"
                className="w-full min-w-[240px] sm:w-80"
                placeholder="Nice to see you, {name}"
                maxLength={80}
                required
              />
            </Field>
            <Button type="submit">Add</Button>
          </form>
        </Panel>
        <Panel title="Rider preview">
          <p className="text-lg font-semibold tracking-tight">{preview}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {data?.settings.mode === "ROTATE"
              ? "Rotates daily among enabled lines."
              : "Pinned line shown to every rider."}
          </p>
        </Panel>
      </div>

      <Panel
        title="Lines"
        actions={
          <Select
            value={data?.settings.mode ?? "PINNED"}
            onChange={(event) =>
              void setMode(event.target.value as "PINNED" | "ROTATE")
            }
            disabled={!data}
          >
            <option value="PINNED">Pin one</option>
            <option value="ROTATE">Rotate among enabled</option>
          </Select>
        }
        flush
      >
        <Table
          columns={["Template", "Status", ""]}
          loading={loading}
          empty="No greetings yet."
          rows={(data?.items ?? []).map((item) => {
            const draft = drafts[item.id] ?? item.template;
            const dirty = draft !== item.template;
            const pinned =
              data?.settings.mode === "PINNED" &&
              data.settings.pinnedGreetingId === item.id;
            return [
              <div key={`${item.id}-template`} className="flex min-w-[280px] items-center gap-2">
                <Input
                  value={draft}
                  maxLength={80}
                  className="w-full"
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  tone="ghost"
                  disabled={!dirty}
                  onClick={() => void saveTemplate(item.id)}
                >
                  Save
                </Button>
              </div>,
              <div key={`${item.id}-status`} className="flex items-center gap-2">
                <Badge tone={statusTone(item.enabled ? "ACTIVE" : "OFFLINE")}>
                  {item.enabled ? "Enabled" : "Disabled"}
                </Badge>
                {pinned ? <Badge tone="blue">Pinned</Badge> : null}
              </div>,
              <div key={`${item.id}-actions`} className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  tone="ghost"
                  onClick={() => void setEnabled(item.id, !item.enabled)}
                >
                  {item.enabled ? "Disable" : "Enable"}
                </Button>
                {data?.settings.mode === "PINNED" ? (
                  <Button
                    type="button"
                    tone="ghost"
                    disabled={pinned || !item.enabled}
                    onClick={() => void pin(item.id)}
                  >
                    Pin
                  </Button>
                ) : null}
                <Button
                  type="button"
                  tone="danger"
                  onClick={() => void remove(item.id)}
                >
                  Delete
                </Button>
              </div>,
            ];
          })}
        />
      </Panel>
    </Guard>
  );
}
