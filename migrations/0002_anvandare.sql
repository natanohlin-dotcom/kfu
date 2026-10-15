-- Fas 1: användare och inloggningsskydd (PLAN.md §5).

-- Användare som kan logga in i arbetsytan.
--   username            gemener, unikt, används vid inloggning
--   display_name        visas i gränssnittet ("Natan Ohlin")
--   role                'admin' | 'member' (rättigheter i lib/auth/permissions.ts)
--   password_hash       'pbkdf2-sha256$<iterationer>$<salt b64>$<hash b64>', NULL tills eget lösenord valts
--   password_changed_at ISO 8601 UTC; jämförs mot sessionens 'pwc' så att byte loggar ut andra sessioner
--   must_change         1 = måste välja nytt lösenord innan något annat (första inloggning via ADMIN_KEYS)
--   disabled_at         satt = inaktiverad (raderas inte, så att författarskap finns kvar)
CREATE TABLE users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  username            TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  password_hash       TEXT,
  password_changed_at TEXT,
  must_change         INTEGER NOT NULL DEFAULT 1,
  disabled_at         TEXT,
  last_login_at       TEXT,
  created_at          TEXT NOT NULL
);

-- Misslyckade inloggningar per användarnamn och IP, för spärr mot gissning.
--   key               'u:<användarnamn>' eller 'ip:<adress>'
--   failures          antal misslyckanden sedan first_failure_at
--   first_failure_at  ISO 8601 UTC; fönstret nollställs efter LOCK_WINDOW i lib/auth/rate-limit.ts
CREATE TABLE login_attempts (
  key              TEXT PRIMARY KEY,
  failures         INTEGER NOT NULL,
  first_failure_at TEXT NOT NULL
);
