-- Fas 4: bevakningar, anteckningar och aktivitetslogg (PLAN.md §6).

-- En bevakning per värdepapper (arkiverade kan återupptas).
--   status            'ide' | 'bevakning' | 'analys' | 'kop' | 'avsta' | 'arkiverad' (lib/watchlist/status.ts)
--   thesis            investeringstes, fri text (markdown tillåten)
--   triggers          vad som ska få oss att agera (rapport, kursnivå, händelse), fri text
--   target_price      målkurs i värdepapperets valuta (securities.currency), NULL = ingen
--   owner_id          ansvarig medlem (users.id), NULL = ingen
--   status_changed_at ISO 8601 UTC för senaste statusbyte
CREATE TABLE watchlist_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  security_id       INTEGER NOT NULL UNIQUE REFERENCES securities(id),
  status            TEXT NOT NULL DEFAULT 'ide' CHECK (status IN ('ide', 'bevakning', 'analys', 'kop', 'avsta', 'arkiverad')),
  thesis            TEXT,
  triggers          TEXT,
  target_price      REAL CHECK (target_price IS NULL OR target_price > 0),
  owner_id          INTEGER REFERENCES users(id),
  created_by        INTEGER REFERENCES users(id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  status_changed_at TEXT NOT NULL
);

-- Anteckningar på en bevakning, i tidsordning (diskussion, nyheter, mötesbeslut).
CREATE TABLE watchlist_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX watchlist_notes_by_item ON watchlist_notes (item_id, created_at);

-- Vad som hänt i arbetsytan, för flödet på översikten och spårbarhet.
--   action     t.ex. 'transaction.created', 'watchlist.status', 'benchmark.added' (lib/activity.ts)
--   entity     'transaction' | 'watchlist' | 'benchmark' | …
--   entity_id  id i den tabellen (kan vara borttagen sedan)
--   href       länk i gränssnittet, NULL om ingen
--   summary    färdig text på svenska ("Köp 100 Atlas Copco AB")
CREATE TABLE activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  href       TEXT,
  summary    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX activity_log_by_time ON activity_log (created_at);
