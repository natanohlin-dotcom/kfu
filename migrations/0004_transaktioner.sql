-- Fas 3: transaktioner – källan till sanning för portföljen (PLAN.md §6).
-- Innehav, kassa och avkastning räknas fram ur dessa rader i lib/portfolio/.

-- En händelse i portföljen.
--   type          'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend' | 'fee'
--   trade_date    affärsdag (YYYY-MM-DD)
--   security_id   värdepapper för buy/sell/dividend, annars NULL
--   quantity      antal (buy/sell), annars NULL
--   price         kurs per aktie i transaktionens valuta (buy/sell), annars NULL
--   currency      transaktionens valuta (värdepapprets handelsvaluta; SEK för insättning/uttag/avgift)
--   amount_local  bruttobelopp i transaktionens valuta: antal × kurs (buy/sell), utdelningens totalbelopp,
--                 insättningens/uttagets/avgiftens belopp. Alltid positivt.
--   fx_rate       valutakurs till SEK på affärsdagen (1 för SEK)
--   fees_sek      courtage och avgifter i SEK (≥ 0)
--   cash_sek      kassapåverkan i SEK med tecken: + in (insättning, försäljning, utdelning), − ut
--                 (köp, uttag, avgift). Räknas på servern; klienten skickar aldrig detta.
--   note          fri text
--   created_by    users.id
CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'buy', 'sell', 'dividend', 'fee')),
  trade_date   TEXT NOT NULL,
  security_id  INTEGER REFERENCES securities(id),
  quantity     REAL,
  price        REAL,
  currency     TEXT NOT NULL,
  amount_local REAL NOT NULL CHECK (amount_local >= 0),
  fx_rate      REAL NOT NULL CHECK (fx_rate > 0),
  fees_sek     REAL NOT NULL DEFAULT 0 CHECK (fees_sek >= 0),
  cash_sek     REAL NOT NULL,
  note         TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL
);

CREATE INDEX transactions_by_date ON transactions (trade_date, id);
CREATE INDEX transactions_by_security ON transactions (security_id, trade_date);
