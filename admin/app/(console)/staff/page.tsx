"use client";

import { FormEvent, useState } from "react";
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
import { canAccessStaff, isOwner } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  adminStaffRole: "OWNER" | "OPERATIONS" | "FINANCE" | "SUPPORT" | "SAFETY" | null;
  adminStaffTitle: "MANAGER" | "MEMBER" | null;
  accountStatus: string;
  lastLoginAt: string | null;
};

const DEPARTMENTS = ["OPERATIONS", "FINANCE", "SUPPORT", "SAFETY"] as const;

export default function StaffPage() {
  const { user } = useAuth();
  const { data, reload, error, loading } = useApi<StaffMember[]>("/admin/staff");
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const owner = isOwner(user);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    try {
      await api("/admin/staff", {
        method: "POST",
        body: JSON.stringify({
          name: payload.get("name"),
          email: payload.get("email"),
          phone: payload.get("phone") || undefined,
          password: payload.get("password"),
          ...(owner ? { adminStaffRole: payload.get("adminStaffRole") } : {}),
        }),
      });
      form.reset();
      await reload();
      toast.success(owner ? "Manager created" : "Staff member created");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function resetPassword(id: string) {
    const password = passwords[id];
    if (!password) {
      toast.error("Enter a new password first");
      return;
    }
    try {
      await api(`/admin/staff/${id}/credentials`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPasswords((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await reload();
      toast.success("Password updated");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  return (
    <Guard allowed={canAccessStaff(user)}>
      <PageHeader
        title="Staff"
        subtitle={
          owner
            ? "Appoint a manager for each department. Managers hire their own team."
            : `Add people to the ${user?.adminStaffRole?.toLowerCase() ?? ""} team and set their console login.`
        }
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <div className="mb-5">
      <Panel title={owner ? "Add department manager" : "Add team member"}>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end" onSubmit={create}>
          {owner ? (
            <Field label="Department">
              <Select name="adminStaffRole" required defaultValue="OPERATIONS">
                {DEPARTMENTS.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Name">
            <Input name="name" required minLength={2} maxLength={80} placeholder="Jane Doe" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required placeholder="jane@eve.local" />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" placeholder="+15550000000" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required minLength={8} maxLength={128} />
          </Field>
          <Button type="submit">{owner ? "Create manager" : "Create member"}</Button>
        </form>
      </Panel>
      </div>

      <Panel title={`Directory · ${data?.length ?? 0}`} flush>
        <Table
          columns={["Name", "Role", "Status", "Last login", ""]}
          loading={loading}
          empty="No staff yet."
          rows={(data ?? []).map((item) => [
            <div key={`${item.id}-name`}>
              <p className="font-medium">{item.name}</p>
              <p className="text-[12px] text-muted-foreground">{item.email}</p>
            </div>,
            <div key={`${item.id}-role`} className="flex flex-wrap gap-1.5">
              <Badge>{item.adminStaffRole?.toLowerCase() ?? "admin"}</Badge>
              {item.adminStaffTitle ? (
                <Badge tone="blue">{item.adminStaffTitle.toLowerCase()}</Badge>
              ) : null}
            </div>,
            <Badge key={`${item.id}-status`} tone={statusTone(item.accountStatus)}>
              {item.accountStatus}
            </Badge>,
            item.lastLoginAt
              ? new Date(item.lastLoginAt).toLocaleString()
              : "Never",
            item.id === user?.id ||
            (owner && item.adminStaffTitle !== "MANAGER") ||
            (!owner && item.adminStaffTitle !== "MEMBER") ? (
              <span key={`${item.id}-actions`} className="text-[12px] text-muted-foreground">
                —
              </span>
            ) : (
              <div key={`${item.id}-actions`} className="flex min-w-[220px] items-center justify-end gap-2">
                <Input
                  type="password"
                  placeholder="New password"
                  minLength={8}
                  value={passwords[item.id] ?? ""}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                />
                <Button type="button" tone="ghost" onClick={() => void resetPassword(item.id)}>
                  Reset
                </Button>
              </div>
            ),
          ])}
        />
      </Panel>
    </Guard>
  );
}
