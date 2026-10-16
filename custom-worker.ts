// Egen Worker-entry: OpenNexts genererade fetch-hanterare + scheduled() för cron.
// https://opennext.js.org/cloudflare/howtos/custom-worker
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- filen finns bara efter bygget
// @ts-ignore `.open-next/worker.js` skapas vid bygget
import { default as handler } from "./.open-next/worker.js";
import { getRawMarket, providerName } from "./lib/market";
import { runDailyPriceUpdate } from "./lib/market/prices";

export default {
  fetch: handler.fetch,

  async scheduled(_event, env, ctx) {
    // Daglig kursuppdatering efter Stockholmsbörsens stängning (PLAN.md §8)
    ctx.waitUntil(
      runDailyPriceUpdate(env.DB, getRawMarket(env.DB, providerName((env as { MARKET_PROVIDER?: string }).MARKET_PROVIDER))).then((r) =>
        console.log(`Kursuppdatering: ${r.updated.length} OK, ${r.failed.length} fel, ${r.remaining} kvar`, JSON.stringify(r.failed)),
      ),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
