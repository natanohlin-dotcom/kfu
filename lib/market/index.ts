import { optionalEnv } from "@/lib/env";
import { withCache } from "./cache";
import { createDemoProvider } from "./demo-provider";
import { createYahooProvider } from "./yahoo-provider";
import type { MarketDataProvider } from "./types";

/**
 * Vilken källa som används: MARKET_PROVIDER=demo ger påhittade kurser för lokal utveckling
 * (se demo-provider.ts), annars Yahoo. Byt eller lägg till källor här och ingen annanstans.
 */
export type ProviderName = "yahoo" | "demo";

export function providerName(fromEnv: string | undefined = optionalEnv("MARKET_PROVIDER")): ProviderName {
  return fromEnv === "demo" ? "demo" : "yahoo";
}

function create(db: D1Database, name: ProviderName): MarketDataProvider {
  return name === "demo" ? createDemoProvider() : createYahooProvider(db);
}

/** Marknadsdata för sidor och API, bakom D1-cache. */
export function getMarket(db: D1Database, name: ProviderName = providerName()): MarketDataProvider {
  return withCache(db, create(db, name), name);
}

/** Utan cache – för kurssynk, som alltid ska ha färsk data. */
export function getRawMarket(db: D1Database, name: ProviderName = providerName()): MarketDataProvider {
  return create(db, name);
}

export * from "./types";
