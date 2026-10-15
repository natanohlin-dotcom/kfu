import { getCloudflareContext } from "@opennextjs/cloudflare";

/** D1-databasen. Enda stället som vet hur bindningen nås (mall §4). */
export function getDb(): D1Database {
  return getCloudflareContext().env.DB;
}
