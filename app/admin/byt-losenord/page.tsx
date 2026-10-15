import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { getSessionUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Välj lösenord" };

export default async function FirstPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin");
  if (!user.mustChange) redirect("/admin/installningar");

  return (
    <AuthFrame
      title={`Välkommen, ${user.displayName.split(" ")[0]}`}
      intro="Välj ett eget lösenord innan du fortsätter. Det tillfälliga slutar gälla när du sparat."
    >
      <ChangePasswordForm firstTime />
    </AuthFrame>
  );
}
