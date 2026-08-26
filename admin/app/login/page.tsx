"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("owner@eve.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to sign in",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-8"
      >
        <div>
          <p className="text-sm text-emerald-300">Eve operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Admin console
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with a staff account. Access is role-based and audited.
          </p>
        </div>
        <label className="block text-sm text-slate-400">
          Email
          <Input
            className="mt-1 w-full"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>
        <label className="block text-sm text-slate-400">
          Password
          <Input
            className="mt-1 w-full"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </label>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <Button className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
