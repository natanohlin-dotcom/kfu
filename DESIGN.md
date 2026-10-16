# Designriktlinjer – KFU

Gäller **allt** i projektet: arbetsytan nu och den publika sajten senare. Läs detta innan du bygger en ny sida eller komponent.

**Riktning:** Hedvig-inspirerat (hedvig.com). Kritvit bakgrund, stilrent och lugnt, mycket luft, stora mjuka rundningar, inga kanter eller skuggor som dekoration. Hierarki skapas med storlek, luft och färgton, inte med fetstil eller ramar. Innehåll i KFU:s grafiska profil (`docs/brand/KFU-grafisk-profil.pdf`): typsnitt, färger och logotyp.

---

## 1. Principer

1. **Kritvitt och luftigt.** Sidan är `canvas` (#FAFAFA). Innehåll ligger på vita ytor (`surface`) eller i halvgenomskinliga gråfyllningar (`fill`). Hellre mer luft än fler avdelare.
2. **Ingen dekoration utan funktion.** Inga ramar runt kort, inga skuggor (utom på det som svävar: menyer, dialoger, mobilmenyn), inga gradienter, inga ikoner som bara pyntar.
3. **Vikt 400 nästan överallt.** Rubriker får sin tyngd från serifen och storleken. Fetstil (Lato 700) bara för enstaka betoning i löptext.
4. **Färg betyder något.** Text och knappar är mörkblå (`ink`). Blått (`accent`) markerar val och länkar och är portföljens färg i grafer. Orange (`brand`) är logga och små signaturdetaljer. Grönt och rött används bara för upp/ner.
5. **Siffror står i kolumn.** Alla belopp, procent och kurser har `tabular` och högerställs i tabeller.

## 2. Färger (tokens i `app/globals.css`)

| Token | Värde | Används till |
|---|---|---|
| `canvas` | #FAFAFA | Sidbakgrund ("kritvit") |
| `surface` | #FFFFFF | Kort, paneler, fält i fokus |
| `fill` / `fill-hover` / `fill-strong` | #14213D med 5 / 8 / 12 % | Sekundära knappar, chips, fält, aktiv menypost, rutor i kort |
| `line` | #14213D med 8 % | Tunna linjer där de behövs (tabellrader). Aldrig ram runt kort. |
| `ink` | #14213D | Text, primärknapp (profilens "mörk text") |
| `ink-muted` | #646A7A | Sekundär text (≥4,5:1 mot canvas) |
| `ink-subtle` | #9A9FAC | Platshållare och tomma värden. Aldrig viktig text. |
| `accent` / `accent-soft` | #1F4990 | Profilens blå: aktivt val, länkar, fokusring, portföljserien |
| `brand` / `brand-soft` | #FE9A04 | Profilens orange: logga, små markörer, första jämförelseindex. **Aldrig som textfärg på ljus botten** (för låg kontrast). |
| `up` / `down` / `warn` (+ `-soft`) | grönt / rött / brunorange | Kursrörelse, fel, varningar |
| `series-1…5` | #2b5aa6 blå, #db8400 orange, #11977a grönblå, #9065d6 lila, #cf4f84 rosa | Dataserier i grafer, i fast ordning (portföljen alltid `series-1`). Validerad med dataviz-validatorn: ljushetsband, mättnad och färgblindhetsseparation godkända. Orange har under 3:1 kontrast mot vitt, så grafer ska alltid ha förklaring, direktetiketter och en tabellvy. |

Hårdkoda aldrig hex i komponenter, utan använd klasserna (`bg-fill`, `text-ink-muted` …).

## 3. Typografi

| Roll | Typsnitt | Storlek / vikt | Klass |
|---|---|---|---|
| Sidrubrik (h1), hero | Cormorant Garamond (profilens reserv för The Seasons) | 34–44 px, 500, tät radhöjd | `font-display text-4xl` via `PageHeader` |
| Stor rubrik i paneler (inloggning) | Cormorant Garamond | 40–56 px, 500 | `font-display` |
| Kortrubrik (h2) | Lato | 17 px, 400 | `Card title` |
| Brödtext | Lato | 15–16 px, 400 | standard |
| Etiketter, hjälptext | Lato | 13–14 px, 400, `ink-muted` | |
| Nyckeltal | Lato | 28–32 px, 400, `tabular` | |

- Serifen används bara för rubriker på sidnivå och stora tal i fokus, aldrig i tabeller, knappar eller formulär.
- Inga versaler med spärrning (utom logotypen). Gruppetiketter i menyn skrivs i gemener, i `ink-subtle`.
- Svensk typografi: "–" i intervall, hårt mellanslag före "%" och "kr" (sköts av `lib/format.ts`).

## 4. Form och rytm

- **Rundning:** `rounded-sm` 10 px (knappar, fält, chips, menyposter), `rounded-md` 16 px (rutor i kort), `rounded-lg` 24 px (kort), `rounded-xl` 32 px (stora paneler).
- **Luft:** kort har 24 px innerpadding (`p-6`), 16–24 px mellan kort, 40 px mellan sidrubrik och innehåll på desktop.
- **Höjder:** knappar och fält 40 px (`md`) / 32 px (`sm`). Tryckyta minst 40 px på mobil.
- **Skuggor:** bara `shadow-pop` på svävande element.

## 5. Komponenter (`components/ui/`)

- **Button:** `primary` (mörkblå fyllning, vit text) för sidans huvudhandling, högst en per vy. `secondary` (`fill`) för övrigt. `ghost` för ikonknappar och diskreta val. `danger` bara för det som raderar.
- **Field:** grå fyllning utan ram, blir vit med blå ring i fokus. Etikett ovanför, hjälptext och fel under.
- **Card:** vit yta, 24 px rundning, ingen ram, ingen avdelare mellan rubrik och innehåll. `tone="fill"` ger en grå ruta för sekundärt innehåll.
- **Badge:** pillerform, `fill` som standard, tonade varianter för status.
- **Segmenterad väljare** (perioder m.m.): `fill`-behållare, valt alternativ som vit pill.
- **Tomt läge (EmptyState):** ikon i grå cirkel, en rad rubrik och en rad förklaring. Ingen illustration.

## 6. Logotyp

- Fil: `public/brand/kfu-logo.svg` (orange, beskuren). Original: `docs/brand/kfu-logo-original.svg`.
- Enligt profilen används logotypen bara i vitt, orange eller blått mot kompletterande bakgrund. Här: **orange på kritvitt eller vitt**. Cirkeln och tjuren är inbäddade bilder i SVG:n och går inte att färga om. Vit eller blå variant kräver en ny export från Canva.
- Minsta storlek med läsbar text är ca 96 px. I menyn (36–40 px) fungerar den som emblem, och namnet står bredvid i text.
- Ändra aldrig proportionerna, och lägg inte logotypen på foton eller mönster.

## 7. Layout för arbetsytan

- **Sidomeny till vänster** (256 px) på samma kritvita botten som sidan, utan kant. Emblem och "Kapitalförvaltning" (serif) överst, grupper av menyposter, användaren nederst. Aktiv post har `fill-strong`, hover `fill`.
- **Mobil:** toppfält med meny-knapp och emblem, och menyn som låda från vänster (`shadow-pop`).
- **Innehåll:** max 1280 px brett. Sidrubrik i serif, sedan nyckeltal, sedan huvudinnehåll och sist widgets i rutnät.
- **Inloggning:** delad vy på desktop med en grå panel (32 px rundning, inskjuten från kanten) med logga och budskap till vänster och formuläret till höger. På mobil bara formuläret.

## 8. Tillgänglighet (oförhandlbart)

Mall §9 gäller: kopplade etiketter, `aria-invalid`/`aria-describedby`, synlig `:focus-visible`-ring (`accent`), `prefers-reduced-motion`, 16 px i fält på mobil, kontrast minst 4,5:1 för text. Orange används därför aldrig som text på ljus botten.
