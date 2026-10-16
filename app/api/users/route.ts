import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { listActiveUsers } from "@/lib/users";

/** GET → aktiva användare (id och namn) för val av ansvarig. */
export async function GET() {
  const auth = await requireApiUser("dashboard:read");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, data: await listActiveUsers() });
}
