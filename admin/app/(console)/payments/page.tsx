"use client";

import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  FilterBar,
  Guard,
  Input,
  Panel,
  Select,
  Table,
  statusTone,
} from "@/components/ui";
import { downloadText, toCsv } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/use-api";

type Ledger = {
  total: number;
  items: {
    id: string;
    type: string;
    status: string;
    method: string;
    amount: number;
    brand: string | null;
    last4: string | null;
    userId: string;
    note: string | null;
    createdAt: string;
  }[];
};

export default function PaymentsPage() {
  const { user } = useAuth();
  const [type, setType] = useState("");
  const path = useMemo(
    () => `/admin/ledger${type ? `?type=${type}` : ""}`,
    [type],
  );
  const { data, reload } = useApi<Ledger>(path);

  async function refund(id: string) {
    const amount = Number(window.prompt("Refund amount") ?? 0);
    if (!amount) return;
    await api(`/admin/ledger/${id}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
    await reload();
  }

  async function payout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/admin/payouts", {
      method: "POST",
      body: JSON.stringify({
        userId: form.get("userId"),
        amount: Number(form.get("amount")),
        note: form.get("note"),
      }),
    });
    await reload();
  }

  return (
    <Guard allowed={can(user, "payments:read")}>
      <h1 className="mb-4 text-2xl font-semibold text-white">
        Payments, commissions & payouts
      </h1>
      <FilterBar>
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          {["CHARGE", "REFUND", "COMMISSION", "PAYOUT", "WALLET_TOPUP", "CREDIT"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Button
          tone="ghost"
          onClick={() =>
            downloadText(
              "ledger.csv",
              toCsv((data?.items ?? []) as unknown as Record<string, unknown>[]),
              "text/csv",
            )
          }
        >
          Export CSV
        </Button>
      </FilterBar>
      {can(user, "payments:payout") ? (
        <Panel title="Manual payout">
          <form className="grid gap-2 md:grid-cols-4" onSubmit={payout}>
            <Input name="userId" placeholder="Driver user ID" required />
            <Input name="amount" placeholder="Amount" required />
            <Input name="note" placeholder="Note" />
            <Button>Pay out</Button>
          </form>
        </Panel>
      ) : null}
      <div className="h-4" />
      <Panel title={`${data?.total ?? 0} transactions`}>
        <Table
          columns={["Type", "Masked method", "Amount", "Status", "When", "Action"]}
          rows={(data?.items ?? []).map((row) => [
            row.type,
            `${row.method}${row.last4 ? ` · ${row.brand ?? ""} •••• ${row.last4}` : ""}`,
            `$${row.amount.toFixed(2)}`,
            <Badge key="s" tone={statusTone(row.status)}>{row.status}</Badge>,
            new Date(row.createdAt).toLocaleString(),
            can(user, "payments:refund") && row.type === "CHARGE" ? (
              <button key="r" className="text-emerald-300" onClick={() => void refund(row.id)}>
                Refund
              </button>
            ) : (
              "—"
            ),
          ])}
        />
      </Panel>
    </Guard>
  );
}
