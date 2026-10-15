-- Fas 0: grundtabeller för Yahoo-integrationen.
-- Resten av datamodellen (PLAN.md §6) läggs till i senare migreringar.

-- Nyckel–värde för appens interna tillstånd.
--   key        t.ex. 'yahoo.session' (cookie + crumb), 'cron.prices.last_run', 'spike.yahoo.last'
--   value      JSON-text
--   updated_at ISO 8601 UTC
CREATE TABLE app_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Cache för svar från marknadsdatakällan (Yahoo).
--   key          t.ex. 'quote:NOVO-B.CO', 'financials:NOVO-B.CO'
--   payload_json normaliserat svar som JSON
--   fetched_at   ISO 8601 UTC när svaret hämtades
--   ttl_seconds  hur länge svaret räknas som färskt
CREATE TABLE market_cache (
  key          TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  fetched_at   TEXT NOT NULL,
  ttl_seconds  INTEGER NOT NULL
);
