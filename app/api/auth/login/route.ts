import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { optionalEnv } from "@/lib/env";
import { matchAdminKey, parseAdminKeys } from "@/lib/auth/admin-keys";
import { verifyPassword } from "@/lib/auth/password";
import { clearFailures, isLocked, recordFailure } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { createUserFromKey, findUserByUsername, recordLogin, type User } from "@/lib/users";

const Body = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

const INVALID = "Fel användarnamn eller lösenord";

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: INVALID }, { status: 400 });
  const { username, password } = parsed.data;

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "okänd";
  const limitKeys = [`u:${username}`, `ip:${ip}`];

  try {
    if (await isLocked(limitKeys)) {
      return NextResponse.json({ error: "För många försök. Vänta en kvart och försök igen." }, { status: 429 });
    }

    let user: User | null = await findUserByUsername(username);
    let valid = false;

    if (user?.passwordHash) {
      // Eget lösenord valt: bara det gäller (det tillfälliga i ADMIN_KEYS är förbrukat).
      valid = await verifyPassword(password, user.passwordHash);
    } else {
      // Första inloggningen: tillfälligt lösenord från ADMIN_KEYS.
      const key = await matchAdminKey(parseAdminKeys(optionalEnv("ADMIN_KEYS")), username, password);
      if (key) {
        user ??= await createUserFromKey(key);
        valid = true;
      }
    }

    if (!user || !valid || user.disabled) {
      await recordFailure(limitKeys);
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    await Promise.all([clearFailures(limitKeys), recordLogin(user.id)]);
    const token = await signSession({ sub: String(user.id), pwc: user.passwordChangedAt ?? "" });
    const res = NextResponse.json({ success: true, data: { mustChange: user.mustChange } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("Inloggning misslyckades", err);
    return NextResponse.json({ error: "Serverfel vid inloggning" }, { status: 500 });
  }
}
