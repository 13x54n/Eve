"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
      toast.success("Signed in");
      router.replace("/dashboard");
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "Unable to sign in";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-[#f7f8ef] place-items-center px-4 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/60"
      >
        <div className="flex flex-col items-center text-center">
          <img
            src="https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742"
            alt="Eve"
            className="h-10 w-auto object-contain mb-4"
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Operations Console · Role-based & audited access
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <label className="block text-sm font-medium text-slate-700">
            Email address
            <Input
              className="mt-1.5 w-full"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="name@company.com"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <Input
              className="mt-1.5 w-full"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
              required
            />
          </label>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 font-medium">
            {error}
          </div>
        ) : null}

        <Button className="w-full h-11 text-sm font-semibold" disabled={pending}>
          {pending ? "Signing in…" : "Sign in to Console"}
        </Button>
      </form>
    </div>
  );
}

