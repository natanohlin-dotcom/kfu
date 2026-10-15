// Egen Worker-entry: OpenNexts genererade fetch-hanterare + scheduled() för cron.
// https://opennext.js.org/cloudflare/howtos/custom-worker
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- filen finns bara efter bygget
// @ts-ignore `.open-next/worker.js` skapas vid bygget
import { default as handler } from "./.open-next/worker.js";
import { runYahooSpike } from "./lib/market/spike";

export default {
  fetch: handler.fetch,

  async scheduled(_event, env, ctx) {
    // Fas 0: kör Yahoo-spiken från cron för att se att även schemalagda anrop når Yahoo.
    // Fas 2: ersätts av den dagliga uppdateringen av price_history.
    ctx.waitUntil(
      runYahooSpike(env.DB, { symbol: "NOVO-B.CO", benchmark: "^OMX", trigger: "cron" }).then(
        (r) => console.log(`Yahoo-spike (cron): ${r.allOk ? "alla OK" : "fel"}`, JSON.stringify(r.checks)),
      ),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
