import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { findUserById, toPublicUser, type PublicUser } from "@/lib/users";
import { can, type Permission } from "./permissions";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * Data Access Layer för sessionen (Next 16: kontrollera nära datan, inte i layouter).
 * Användaren läses alltid från D1 så att rollbyte, inaktivering och lösenordsbyte slår igenom direkt.
 */
export const getSessionUser = cache(async (): Promise<PublicUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await findUserById(Number(claims.sub));
  if (!user || user.disabled) return null;
  if ((user.passwordChangedAt ?? "") !== claims.pwc) return null;
  return toPublicUser(user);
});

/** För sidor: skickar till inloggning/lösenordsbyte, och till översikten om rättighet saknas. */
export async function requireUser(permission?: Permission): Promise<PublicUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin");
  if (user.mustChange) redirect("/admin/byt-losenord");
  if (permission && !can(user, permission)) redirect("/admin/oversikt");
  return user;
}

type ApiAuth = { ok: true; user: PublicUser } | { ok: false; response: NextResponse };

/** För API-routes: 401 utan session, 403 utan rättighet eller om lösenordet måste bytas. */
export async function requireApiUser(permission?: Permission, opts: { allowMustChange?: boolean } = {}): Promise<ApiAuth> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Obehörig" }, { status: 401 }) };
  if (user.mustChange && !opts.allowMustChange) {
    return { ok: false, response: NextResponse.json({ error: "Byt lösenord först" }, { status: 403 }) };
  }
  if (permission && !can(user, permission)) {
    return { ok: false, response: NextResponse.json({ error: "Saknar behörighet" }, { status: 403 }) };
  }
  return { ok: true, user };
}
