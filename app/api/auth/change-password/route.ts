import { NextResponse } from "next/server";
import { z } from "zod";
import { optionalEnv } from "@/lib/env";
import { requireApiUser } from "@/lib/auth/dal";
import { matchAdminKey, parseAdminKeys } from "@/lib/auth/admin-keys";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { findUserById, setPassword } from "@/lib/users";

const Body = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().max(200),
});

export async function POST(req: Request) {
  const auth = await requireApiUser(undefined, { allowMustChange: true });
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;

  try {
    const user = await findUserById(auth.user.id);
    if (!user) return NextResponse.json({ error: "Obehörig" }, { status: 401 });

    const currentOk = user.passwordHash
      ? await verifyPassword(currentPassword, user.passwordHash)
      : !!(await matchAdminKey(parseAdminKeys(optionalEnv("ADMIN_KEYS")), user.username, currentPassword));
    if (!currentOk) {
      return NextResponse.json({ error: "Nuvarande lösenord stämmer inte", field: "currentPassword" }, { status: 400 });
    }

    const problems = passwordProblems(newPassword);
    if (problems.length) {
      return NextResponse.json({ error: `Lösenordet uppfyller inte kraven: ${problems.join(", ")}`, field: "newPassword" }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: "Välj ett annat lösenord än det nuvarande", field: "newPassword" }, { status: 400 });
    }

    const changedAt = await setPassword(user.id, await hashPassword(newPassword));
    // Ny token med nya pwc: den här sessionen fortsätter, alla andra loggas ut.
    const token = await signSession({ sub: String(user.id), pwc: changedAt });
    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("Lösenordsbyte misslyckades", err);
    return NextResponse.json({ error: "Serverfel vid lösenordsbyte" }, { status: 500 });
  }
}
