import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";

export async function GET() {
  const auth = await requireApiUser(undefined, { allowMustChange: true });
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, data: auth.user });
}
