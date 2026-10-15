import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getSessionUser } from "@/lib/auth/dal";
import { navModulesFor } from "@/lib/modules";

/**
 * Skalet för allt bakom inloggning. Layouten hämtar användaren för menyn, men själva
 * behörighetskontrollen görs i varje sida/route via requireUser() (layouter körs inte om vid navigering).
 */
export default async function AppLayout({ children }: LayoutProps<"/admin">) {
  const user = await getSessionUser();
  if (!user) redirect("/admin");
  if (user.mustChange) redirect("/admin/byt-losenord");

  return (
    <AppShell user={user} modules={navModulesFor(user)}>
      {children}
    </AppShell>
  );
}
