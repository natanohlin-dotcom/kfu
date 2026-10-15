import { SignJWT, jwtVerify } from "jose";
import { requireEnv } from "@/lib/env";

/** Sessionen är en JWT (HS256) i en httpOnly-cookie (mall §7). */

export const SESSION_COOKIE = "kfu_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dagar

export type SessionClaims = {
  /** users.id */
  sub: string;
  /** users.password_changed_at när sessionen skapades ("" om inget eget lösenord ännu) */
  pwc: string;
};

function secretKey(): Uint8Array {
  const secret = requireEnv("AUTH_SECRET");
  if (secret.length < 32) throw new Error("AUTH_SECRET måste vara minst 32 tecken");
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ pwc: claims.pwc })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.pwc !== "string") return null;
    return { sub: payload.sub, pwc: payload.pwc };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
