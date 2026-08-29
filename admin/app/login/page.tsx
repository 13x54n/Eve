"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

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
    <div className="grid min-h-screen bg-sidebar lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <img
            src="https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742"
            alt="Eve"
            className="h-8 w-auto object-contain invert"
          />
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            Eve Operations
          </span>
        </div>
        <div>
          <p className="max-w-sm text-7xl font-semibold tracking-tight">
            Dispatch, Safety, and Support.
          </p>
          <p className="mt-3 max-w-sm text-sm text-neutral-400">
            {/* Role-based access for live ride-hailing operations. */}
          </p>
        </div>
        <p className="text-xs text-neutral-600">Eve · Internal use only</p>
      </div>

      <div className="grid place-items-center bg-background px-4 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden mb-2">
            <img
              src="https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742"
              alt="Eve"
              className="h-8 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your staff credentials to open the console.
            </p>
          </div>

          <label className="block text-sm font-medium">
            Email
            <Input
              className="mt-1.5 w-full"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="name@company.com"
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <Input
              className="mt-1.5 w-full"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button className="w-full h-10" disabled={pending}>
            {pending ? "Signing in…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
