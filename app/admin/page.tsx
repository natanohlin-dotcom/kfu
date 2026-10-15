import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Logga in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.mustChange ? "/admin/byt-losenord" : "/admin/oversikt");

  return (
    <AuthFrame title="Logga in" intro="Använd kontot du fått av utskottets administratör.">
      <LoginForm />
    </AuthFrame>
  );
}
