"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { readApiResult } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = await readApiResult<{ mustChange: boolean }>(res);
      if (!res.ok || !result.success) {
        setError(result.error ?? "Inloggningen misslyckades");
        setPending(false);
        return;
      }
      router.replace(result.data?.mustChange ? "/admin/byt-losenord" : "/admin/oversikt");
      router.refresh();
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Användarnamn" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
      <Field label="Lösenord" name="password" type="password" autoComplete="current-password" required />
      {error && (
        <p role="alert" className="rounded-sm bg-down-soft px-3.5 py-2.5 text-sm text-down">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Loggar in …" : "Logga in"}
      </Button>
    </form>
  );
}
