# Datakällor för börsdata – utredning

Utredning 2026-10-16 om alternativ till Yahoo Finance (inofficiellt API). Priser och villkor ändras ofta, så kontrollera mot leverantörens sida innan ni köper något. Uppgifter som inte gick att bekräfta på leverantörens egen sida är märkta *ej verifierat*.

## Bakgrund

- Appen hämtar all marknadsdata server-side från Workern och cachar i D1 (`lib/market/`). Webbläsaren och campusnätet anropar aldrig källan direkt.
- Allt går via `MarketDataProvider` (`lib/market/types.ts`), så en ny källa är en ny fil (`<källa>-provider.ts`) plus ett val i `lib/market/index.ts`. Resten av appen påverkas inte.
- Yahoo svarade på alla ändpunkter från Cloudflare i fas 0. Från Uppsala universitets nät (130.243.x.x) ger Yahoo 429 sedan 2026-10-16. Det påverkar bara lokal utveckling (lös med `MARKET_PROVIDER=demo`) så länge Cloudflare inte också blir spärrat.

Behov: **1** dagskurser 10 år + aktuell kurs, **2** tickersök, **3** nyckeltal, **4** årsbokslut för DCF, **5** analytiker (rekommendationer, estimat, riktkurser), **6** svenska ägarlistor.

## Jämförelse

| Källa | Norden | 1 | 2 | 3 | 4 | 5 | 6 | Gratis | Pris/mån | Viktigaste villkor |
|---|---|---|---|---|---|---|---|---|---|---|
| **Yahoo Finance** (nuvarande) | Bra | J | J | J | J | J | Delvis (främst USA-institutioner) | Ja | 0 | Inofficiellt, kan ändras och spärra (429) |
| **EODHD** | ST, CO, HE, OL; index *ej verifierat* | J | J | J | J | Delvis | Delvis (institutioner) | 20 anrop/dag | EOD ~20 $, Fundamentals ~60 $, **50 % studentrabatt** första året | Personliga och kommersiella planer; fundamenta kostar 10 anrop per förfrågan |
| **Börsdata API** | Mycket bra (inkl. First North) | J | J | J | J | Delvis | Delvis (Pro+) | Nej | Pro+ 59 €/mån (API:t kräver Pro+ sedan 2025-02) | **Endast personlig analys, och det är förbjudet att visa datan i externa system.** Passar därför inte en delad arbetsyta. |
| **stooq** | Bra EOD för .ST, ^OMXS30 och valutor | J (bara EOD) | N | N | N | N | N | Ja, men API-nyckel krävs sedan 2026 (hämtas manuellt) | 0 | Inofficiellt, IP-spärrar har rapporterats |
| **ECB referenskurser** | EUR-baserade valutor | Bara valuta | – | – | – | – | – | Ja | 0 | Officiellt och stabilt; räcker för EUR/USD/DKK mot SEK |
| **Massive (f.d. Polygon)** | Bara USA | J (USA) | J | Delvis | Delvis | N | N | 5 anrop/min | från 29 $ | Bra reserv för amerikanska aktier |
| **Financial Modeling Prep** | Norden bara på dyraste planen (*ej verifierat*) | J | J | J | J | J (främst USA) | N | 250/dag | ~150 $ för global täckning (*ej verifierat*) | För dyrt |
| **Twelve Data** | Norden kräver Pro | J | J | Delvis | Delvis | Delvis | N | 800/dag (USA) | Pro 229 $ | För dyrt |
| **Finnhub** | Internationellt är premium (*ej verifierat*) | Delvis | J | Delvis | Delvis | Delvis (USA gratis) | N | 60/min (USA) | Dyrt per datapaket | Bara reserv för USA |
| **Alpha Vantage** | Svag för Norden | Delvis | J | Delvis | Delvis | N | N | 25/dag | från 50 $ | Räcker inte |
| **Marketstack** | Oklar nordisk täckning | J (EOD) | J | N | Delvis (dyr plan) | N | N | 100/mån | ~10 $ | Måste verifieras för .ST |
| **Nasdaq Nordic Data** | Officiell | Bara filer | N | N | N | N | N | Nej | ~1 000 €/mån | Orimligt |
| **Modular Finance / Holdings** | Källan till svenska ägarlistor | N | N | N | N | N | J | Nej | Offert | B2B, inget publikt API |
| **Avanzas inofficiella API** | Mycket bra | J | J | J | Delvis | Delvis | J | – | 0 | Odokumenterat och sannolikt mot användarvillkoren; kan spärras. **Används inte.** |

## Rekommendation

1. **Behåll Yahoo som primärkälla** så länge den svarar från Cloudflare. Den är gratis och täcker behov 1–5, och D1-cachen gör att tillfälliga 429 inte syns (utgångna värden används).
2. **Reserv om Yahoo slutar fungera från Cloudflare: EODHD med studentrabatt.** Det är ett dokumenterat API med nyckel och fetch, och det fungerar i Workers.
   - Bara kurser: EOD-planen, ca 110 kr/mån med rabatt.
   - Även nyckeltal, bokslut och estimat: Fundamentals-planen, ca 320 kr/mån med rabatt.
   - Testa med en provnyckel innan köp: täckning för OMXS30/OMXSPI, om EOD-kurser ingår i Fundamentals-planen, och hur fullständiga analytikerdata är för .ST-bolag.
3. **Gratis nödreserv för kurser:** stooq (EOD för aktier, index och valutor) plus ECB för valutakurser. Bygg en `stooq-provider.ts` för `history` och `quotes` först när det behövs.
4. **Svenska ägarlistor:** det finns ingen laglig gratiskälla.
   - Förslag: låt utskottet mata in de tio största ägarna per bevakat bolag manuellt (kvartalsvis) i D1, med källa och datum, och länka till bolagets ägarsida.
   - Alternativ: fråga Modular Finance om en akademisk licens.
5. **Analytikerestimat:** Yahoo (`recommendationTrend`, `earningsTrend`, riktkurser) räcker. För mindre svenska bolag saknas ofta estimat, och sidan döljer då rutan.

## Källor

- EODHD: https://eodhd.com/pricing, https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds, https://eodhd.com/list-of-stock-markets
- Börsdata: https://borsdata.se/info/api/api_info, https://borsdata.se/en/pricetable
- Twelve Data: https://twelvedata.com/pricing
- Alpha Vantage: https://www.alphavantage.co/premium/
- Marketstack: https://marketstack.com/pricing
- Massive: https://massive.com/pricing
- stooq (API-nyckel): https://github.com/pydata/pandas-datareader/issues/1012
- Nasdaq prislista: https://www.nasdaq.com/docs/data/Nasdaq-European-Other-Markets-Data-Products-Price-List-October-2026
- Holdings (Modular Finance): https://mfn.se/all/a/modfin/modular-finance-launches-holdings-uk
