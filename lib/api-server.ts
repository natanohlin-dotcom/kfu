import "server-only";
import { NextResponse } from "next/server";
import { MarketDataError } from "@/lib/market/types";

/** Gemensam felhantering för API-routes (mall §6): { error } med rätt status. */
export function apiError(err: unknown, context: string): NextResponse {
  if (err instanceof MarketDataError) {
    return NextResponse.json({ error: err.status === 404 ? err.message : "Marknadsdata kunde inte hämtas just nu" }, { status: err.status });
  }
  console.error(context, err);
  return NextResponse.json({ error: "Serverfel" }, { status: 500 });
}
