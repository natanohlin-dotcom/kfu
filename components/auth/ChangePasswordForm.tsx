"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PASSWORD_RULES } from "@/lib/auth/password";
import { readApiResult } from "@/lib/api";

type Props = {
  /** Första inloggningen: "nuvarande" är det tillfälliga lösenordet, och vi går vidare till översikten efteråt */
  firstTime?: boolean;
};

export function ChangePasswordForm({ firstTime = false }: Props) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string; repeat?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const currentPassword = String(new FormData(form).get("currentPassword") ?? "");
    if (next !== repeat) {
      setErrors({ repeat: "Lösenorden matchar inte" });
      return;
    }
    setPending(true);
    setErrors({});
    setDone(false);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: next }),
      });
      const result = await readApiResult(res);
      if (!res.ok || !result.success) {
        const field = result.field === "currentPassword" || result.field === "newPassword" ? result.field : "form";
        setErrors({ [field]: result.error ?? "Något gick fel" });
        return;
      }
      if (firstTime) {
        router.replace("/admin/oversikt");
        router.refresh();
        return;
      }
      form.reset();
      setNext("");
      setRepeat("");
      setDone(true);
    } catch {
      setErrors({ form: "Kunde inte nå servern. Försök igen." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        label={firstTime ? "Tillfälligt lösenord" : "Nuvarande lösenord"}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <Field
        label="Nytt lösenord"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.newPassword}
        hint={
          <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(next);
              return (
                <li key={rule.label} className={`flex items-center gap-1.5 transition-colors ${ok ? "text-up" : ""}`}>
                  {ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3" aria-hidden />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        }
      />
      <Field
        label="Upprepa nytt lösenord"
        name="repeat"
        type="password"
        autoComplete="new-password"
        required
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        error={errors.repeat}
      />
      {errors.form && (
        <p role="alert" className="rounded-sm bg-down-soft px-3.5 py-2.5 text-sm text-down">
          {errors.form}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-sm bg-up-soft px-3.5 py-2.5 text-sm text-up">
          Lösenordet är bytt. Andra inloggade sessioner har loggats ut.
        </p>
      )}
      <Button type="submit" disabled={pending} className={firstTime ? "w-full" : "self-start"}>
        {pending ? "Sparar …" : firstTime ? "Spara och fortsätt" : "Byt lösenord"}
      </Button>
    </form>
  );
}
