-- Fas 2: värdepapper, kurshistorik och jämförelseindex (PLAN.md §6, §8).

-- Gemensamt register över allt vi följer: aktier, fonder, index och valutor.
--   symbol             Yahoo-symbol, versaler, unik ('NOVO-B.CO', '^OMX', 'USDSEK=X')
--   name               visningsnamn från Yahoo (longName, annars shortName)
--   kind               'stock' | 'etf' | 'fund' | 'index' | 'fx' | 'other'
--   currency           handelsvaluta (ISO, t.ex. 'DKK'); kurserna i price_history är i den
--   exchange           börsens visningsnamn ('Copenhagen', 'Stockholm')
--   country, sector    från Yahoos bolagsprofil (bara aktier, kan saknas)
--   financial_currency rapportvaluta om den skiljer sig från handelsvalutan (DCF, fas 5)
--   manual_shares_json manuellt aktieantal {"total_issued","treasury","source"} (motsvarar MANUAL_SHARES i Python-skriptet)
--   prices_synced_at   ISO 8601 UTC för senaste kurssynk; cron tar äldst först
CREATE TABLE securities (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol             TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('stock', 'etf', 'fund', 'index', 'fx', 'other')),
  currency           TEXT NOT NULL,
  exchange           TEXT,
  country            TEXT,
  sector             TEXT,
  financial_currency TEXT,
  manual_shares_json TEXT,
  prices_synced_at   TEXT,
  created_at         TEXT NOT NULL
);

-- Dagliga stängningskurser i värdepapperets valuta.
--   date      handelsdag i börsens tidszon (YYYY-MM-DD)
--   close     stängningskurs (pågående dag: senaste kurs, skrivs över vid nästa synk)
--   adj_close justerad för utdelningar och splittar (för avkastningsberäkning)
CREATE TABLE price_history (
  security_id INTEGER NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  close       REAL NOT NULL,
  adj_close   REAL NOT NULL,
  PRIMARY KEY (security_id, date)
) WITHOUT ROWID;

-- Jämförelseindex som portföljen ställs mot (inställningar → jämförelseindex).
--   label      kort namn i grafer ('OMXS30')
--   color      färgtoken ur lib/benchmarks.ts ('series-2' …), inte hex
--   is_default 1 = visas i nyckeltalen på översikten (högst en)
--   sort_order ordning i grafens förklaring
CREATE TABLE benchmarks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  security_id INTEGER NOT NULL UNIQUE REFERENCES securities(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- Startvärde: OMXS30 som standardindex. Kurshistoriken hämtas vid första synken.
INSERT INTO securities (symbol, name, kind, currency, exchange, created_at)
VALUES ('^OMX', 'OMX Stockholm 30 Index', 'index', 'SEK', 'Stockholm', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO benchmarks (security_id, label, color, is_default, sort_order, created_at)
SELECT id, 'OMXS30', 'series-2', 1, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM securities WHERE symbol = '^OMX';
