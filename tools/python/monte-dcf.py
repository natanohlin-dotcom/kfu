import pandas as pd
import numpy as np
import yfinance as yf
import matplotlib.pyplot as plt

# ============================================================
# AKTIEANTAL – MANUELL KÄLLA (uppdatera från senaste börsmeddelande)
# ------------------------------------------------------------
# yfinance kan för bolag med flera aktieslag (A/B) returnera bara
# det noterade slaget. Därför anges antalet här uttryckligen.
# Novo Nordisk: totalt antal A+B-aktier inkl. egna aktier, samt
# egna (återköpta) aktier enligt återköpsmeddelande juni 2026.
# Återköpen pågår – uppdatera 'treasury' från senaste meddelandet.
# ============================================================
MANUAL_SHARES = {
    "NOVO-B.CO": {
        "total_issued": 4_465_000_000,
        "treasury": 35_944_480,
        "source": "Novo Nordisk återköpsmeddelande, 8 juni 2026",
    },
}

# ============================================================
# SKATT
# ------------------------------------------------------------
# TAX_METHOD:
#   "effective" – Yahoos 'Tax Rate For Calcs' (snitt över åren), annars
#                 Tax Provision / Pretax Income. Bolagsspecifik.
#   "statutory" – nominell bolagsskatt i bolagets hemland (tabell nedan).
#   ett tal     – t.ex. 0.21 för att sätta skatten manuellt.
# Yahoo har ingen nominell skattesats, därav tabellen (approximativa
# nationella satser, uppdatera vid behov).
# ============================================================
TAX_METHOD = "effective"
STATUTORY_TAX = {
    "Denmark": 0.22, "Sweden": 0.206, "Norway": 0.22, "Finland": 0.20,
    "United States": 0.21, "United Kingdom": 0.25, "Netherlands": 0.258,
    "France": 0.25, "Germany": 0.30, "Ireland": 0.125,
}
DEFAULT_TAX = 0.22  # Används bara om inget annat går att få fram
TAX_SANITY = (0.05, 0.40)  # År utanför intervallet räknas som brus


# ============================================================
# HJÄLPFUNKTIONER
# ============================================================
def _safe(x):
    """Returnerar ett positivt, ändligt tal eller None."""
    try:
        x = float(x)
        return x if np.isfinite(x) and x > 0 else None
    except (TypeError, ValueError):
        return None


def _yearly(x, t):
    """Årets värde om x är en lista, annars det fasta värdet."""
    return x[t] if isinstance(x, (list, tuple, np.ndarray)) else x


def _print_table(df, money_cols=(), pct_cols=(), ratio_cols=()):
    out = pd.DataFrame(index=df.index)
    for c in df.columns:
        if c in money_cols:
            out[c + " (mdr)"] = (df[c] / 1e9).map("{:,.1f}".format)
        elif c in pct_cols:
            out[c] = df[c].map("{:.1%}".format)
        elif c in ratio_cols:
            out[c] = df[c].map("{:.2f}".format)
    print(out.to_string())


# ============================================================
# AKTIEANTAL – samla alla källor, välj ett, redovisa tydligt
# ============================================================
def resolve_share_count(ticker_symbol, info, tolerance=0.05):
    ticker = yf.Ticker(ticker_symbol)
    candidates = {
        "info.sharesOutstanding": _safe(info.get("sharesOutstanding")),
        "info.impliedSharesOutstanding": _safe(info.get("impliedSharesOutstanding")),
    }
    price = _safe(info.get("currentPrice")) or _safe(info.get("regularMarketPrice"))
    mcap = _safe(info.get("marketCap"))
    candidates["info.marketCap / kurs"] = mcap / price if (mcap and price) else None

    try:
        bs = ticker.balance_sheet

        def latest(row):
            if row in bs.index:
                s = bs.loc[row].dropna()
                return _safe(s.iloc[0]) if not s.empty else None
            return None

        candidates["balansräkning: Ordinary Shares Number"] = latest("Ordinary Shares Number")
        candidates["balansräkning: Share Issued"] = latest("Share Issued")
        candidates["balansräkning: Treasury Shares Number"] = latest("Treasury Shares Number")
    except Exception as e:
        print(f"  (Kunde inte läsa balansräkningen: {e})")

    manual = MANUAL_SHARES.get(ticker_symbol)
    if manual:
        manual_count = manual["total_issued"] - manual.get("treasury", 0)
        candidates["MANUELL: utestående exkl. egna aktier"] = manual_count
        chosen, source = manual_count, f"manuell – {manual['source']}"
    else:
        # Prioritetsordning: balansräkningens antal (omfattar alla aktieslag),
        # därefter implied, därefter största tillgängliga värde (ett för lågt
        # tal tyder oftast på att bara ett aktieslag räknats).
        chosen = (candidates["balansräkning: Ordinary Shares Number"]
                  or candidates["info.impliedSharesOutstanding"])
        if chosen:
            source = "yfinance (balansräkning/implied)"
        else:
            available = [v for k, v in candidates.items() if v and "Treasury" not in k]
            if not available:
                raise ValueError(f"Hittade inget aktieantal för {ticker_symbol}. "
                                 f"Lägg till det i MANUAL_SHARES.")
            chosen, source = max(available), "yfinance (största tillgängliga värde)"

    print("\n--- AKTIEANTAL ---")
    for k, v in candidates.items():
        if "Treasury" in k:
            print(f"  {k:<45} {v:>16,.0f}" if v else f"  {k:<45} {'saknas':>16}")
            continue
        if v:
            diff = v / chosen - 1
            flag = "  ⚠ avviker" if abs(diff) > tolerance else ""
            print(f"  {k:<45} {v:>16,.0f}  ({diff:+.1%}){flag}")
        else:
            print(f"  {k:<45} {'saknas':>16}")
    print(f"\n  >>> RÄKNAR PÅ {chosen:,.0f} AKTIER  [källa: {source}]")
    return chosen, source


# ============================================================
# SKATTESATS – samla källor, välj enligt TAX_METHOD, redovisa
# ============================================================
def resolve_tax_rate(hist_data, info, method=TAX_METHOD):
    lo, hi = TAX_SANITY

    def clean(series):
        s = pd.Series(series).replace([np.inf, -np.inf], np.nan).dropna()
        return s[(s >= lo) & (s <= hi)]

    yahoo = clean(hist_data["Tax Rate For Calcs"])
    pretax = hist_data["Pretax Income"].replace(0, np.nan)
    computed = clean(hist_data["Tax Provision"] / pretax)
    country = info.get("country")
    statutory = STATUTORY_TAX.get(country)

    print("\n--- SKATTESATS ---")
    if not yahoo.empty:
        per_year = ", ".join(f"{d.year}: {v:.1%}" for d, v in yahoo.items())
        print(f"  Yahoo 'Tax Rate For Calcs':        snitt {yahoo.mean():.1%}  ({per_year})")
    else:
        print("  Yahoo 'Tax Rate For Calcs':        saknas")
    if not computed.empty:
        per_year = ", ".join(f"{d.year}: {v:.1%}" for d, v in computed.items())
        print(f"  Tax Provision / Pretax Income:     snitt {computed.mean():.1%}  ({per_year})")
    else:
        print("  Tax Provision / Pretax Income:     saknas")
    print(f"  Nominell skatt ({country or 'okänt land'}):"
          f"{'':<{max(1, 19 - len(country or 'okänt land'))}}"
          f"{f'{statutory:.1%}' if statutory is not None else 'saknas i tabellen'}")

    if isinstance(method, (int, float)):
        rate, source = float(method), "manuellt angiven"
    elif method == "statutory" and statutory is not None:
        rate, source = statutory, f"nominell skatt, {country}"
    elif method == "effective" and not yahoo.empty:
        rate, source = yahoo.mean(), "Yahoo 'Tax Rate For Calcs', snitt"
    elif method == "effective" and not computed.empty:
        rate, source = computed.mean(), "Tax Provision / Pretax Income, snitt"
    elif statutory is not None:
        rate, source = statutory, f"nominell skatt, {country} (reserv)"
    else:
        rate, source = DEFAULT_TAX, "DEFAULT_TAX (reserv – kontrollera!)"

    print(f"\n  >>> RÄKNAR MED {rate:.1%} SKATT  [källa: {source}]")
    return rate, source


# ============================================================
# DATA
# ============================================================
def fetch_financial_data(ticker_symbol):
    ticker = yf.Ticker(ticker_symbol)
    income_stmt = ticker.financials
    cash_flow = ticker.cashflow

    if income_stmt.empty or cash_flow.empty:
        print(f"Hittade ingen finansiell data för {ticker_symbol}.")
        return None

    def get_row(df, row_name):
        if row_name in df.index:
            return df.loc[row_name]
        return pd.Series(np.nan, index=df.columns)

    dcf_data = pd.DataFrame()
    dcf_data["Revenue"] = get_row(income_stmt, "Total Revenue")
    dcf_data["EBIT"] = get_row(income_stmt, "EBIT")
    dcf_data["Pretax Income"] = get_row(income_stmt, "Pretax Income")
    dcf_data["Tax Provision"] = get_row(income_stmt, "Tax Provision")
    dcf_data["Tax Rate For Calcs"] = get_row(income_stmt, "Tax Rate For Calcs")
    dcf_data["D&A"] = get_row(cash_flow, "Depreciation And Amortization")
    capex = get_row(cash_flow, "Capital Expenditure")
    dcf_data["CapEx"] = capex.abs()
    # Kassaflödestecken: negativt = rörelsekapitalet ökade (kassa binds)
    dcf_data["NWC CF"] = get_row(cash_flow, "Change In Working Capital")

    dcf_data = dcf_data.sort_index()
    dcf_data = dcf_data.dropna(subset=["Revenue"])
    dcf_data["EBIT"] = dcf_data["EBIT"].interpolate(method="linear", limit_direction="both")
    dcf_data = dcf_data.fillna(0)
    return dcf_data


def calculate_historical_drivers(dcf_data):
    d = pd.DataFrame(index=dcf_data.index)
    rev = dcf_data["Revenue"]
    d["Tillväxt"] = rev.pct_change()
    d["EBIT-marginal"] = dcf_data["EBIT"] / rev
    d["Skattesats"] = np.where(dcf_data["Pretax Income"] != 0,
                               dcf_data["Tax Provision"] / dcf_data["Pretax Income"],
                               DEFAULT_TAX)
    d["D&A % oms"] = dcf_data["D&A"] / rev
    d["CapEx % oms"] = dcf_data["CapEx"] / rev
    d["NWC CF % oms"] = dcf_data["NWC CF"] / rev
    # Historisk FCFF beräknad på samma sätt som i prognosen
    nopat = dcf_data["EBIT"] * (1 - d["Skattesats"])
    d["FCF-marginal"] = (nopat + dcf_data["D&A"] - dcf_data["CapEx"] + dcf_data["NWC CF"]) / rev
    return d


# ============================================================
# KLASSISK DCF – FCF-marginalen BERÄKNAS, den matas inte in
# ============================================================
def calculate_classic_dcf(current_revenue, rev_growth, ebit_margin, tax_rate,
                          da_pct, capex_pct, nwc_cf_pct, wacc, terminal_growth,
                          total_cash, total_debt, shares_out, years_to_project=5):
    rows = []
    rev = current_revenue
    for t in range(years_to_project):
        g = _yearly(rev_growth, t)
        rev = rev * (1 + g)
        ebit = rev * _yearly(ebit_margin, t)
        nopat = ebit * (1 - _yearly(tax_rate, t))
        da = rev * _yearly(da_pct, t)
        capex = rev * _yearly(capex_pct, t)
        nwc_cf = rev * _yearly(nwc_cf_pct, t)
        net_reinvestment = capex - da - nwc_cf  # positivt = kapital som investeras
        fcff = nopat - net_reinvestment
        rows.append({
            "År": t + 1, "Omsättning": rev, "Tillväxt": g,
            "EBIT": ebit, "EBIT-marginal": ebit / rev, "NOPAT": nopat,
            "Nettoinvestering": net_reinvestment,
            "Återinvesteringsgrad": net_reinvestment / nopat if nopat else np.nan,
            "FCFF": fcff, "FCF-marginal": fcff / rev,
        })
    table = pd.DataFrame(rows).set_index("År")

    discount = (1 + wacc) ** np.arange(1, years_to_project + 1)
    table["PV FCFF"] = table["FCFF"].values / discount

    fcff_last = table["FCFF"].iloc[-1]
    terminal_value = fcff_last * (1 + terminal_growth) / (wacc - terminal_growth)
    pv_tv = terminal_value / (1 + wacc) ** years_to_project

    enterprise_value = table["PV FCFF"].sum() + pv_tv
    equity_value = enterprise_value + total_cash - total_debt
    share_price = max(equity_value / shares_out, 0)

    # Rimlighetskontroll: vilken avkastning på nya investeringar krävs för
    # att den eviga tillväxten ska gå ihop med år 5:s återinvestering?
    # g = RONIC × återinvesteringsgrad  →  RONIC = g / återinvesteringsgrad
    reinv_rate = table["Återinvesteringsgrad"].iloc[-1]
    implied_ronic = terminal_growth / reinv_rate if reinv_rate and reinv_rate > 0 else np.inf

    return {
        "table": table, "share_price": share_price,
        "pv_explicit": table["PV FCFF"].sum(), "pv_tv": pv_tv,
        "enterprise_value": enterprise_value, "equity_value": equity_value,
        "cash": total_cash, "debt": total_debt, "shares": shares_out,
        "implied_ronic": implied_ronic, "wacc": wacc, "g": terminal_growth,
    }


def print_scenario(name, res, currency):
    print(f"\n=== {name.upper()} CASE  (WACC {res['wacc']:.1%}, evig tillväxt {res['g']:.1%}) ===")
    _print_table(res["table"],
                 money_cols=("Omsättning", "EBIT", "NOPAT", "Nettoinvestering", "FCFF"),
                 pct_cols=("Tillväxt", "EBIT-marginal", "Återinvesteringsgrad", "FCF-marginal"))
    ev = res["enterprise_value"]
    print(f"\n  PV explicita kassaflöden   {res['pv_explicit']/1e9:>10,.1f} mdr")
    print(f"  PV terminalvärde           {res['pv_tv']/1e9:>10,.1f} mdr  ({res['pv_tv']/ev:.0%} av EV)")
    print(f"  = Enterprise value         {ev/1e9:>10,.1f} mdr")
    print(f"  + Kassa                    {res['cash']/1e9:>10,.1f} mdr")
    print(f"  − Skuld                    {res['debt']/1e9:>10,.1f} mdr")
    print(f"  = Eget kapital             {res['equity_value']/1e9:>10,.1f} mdr")
    print(f"  / Aktier                   {res['shares']:>14,.0f}")
    print(f"  = Värde per aktie          {res['share_price']:>10,.2f} {currency}")
    r = res["implied_ronic"]
    r_txt = "∞ (tillväxt utan nettoinvestering)" if not np.isfinite(r) else f"{r:.0%}"
    print(f"  Implicit RONIC i terminalen: {r_txt}")


# ============================================================
# MONTE CARLO
# ============================================================
def simulate_fcff(hist_data, hist_drivers, years_to_project=5, num_paths=1000):
    g_mean, g_std = hist_drivers["Tillväxt"].mean(), hist_drivers["Tillväxt"].std()
    m_mean, m_std = hist_drivers["EBIT-marginal"].mean(), hist_drivers["EBIT-marginal"].std()
    tax_rate = hist_drivers["Skattesats"].mean()
    net_reinv_pct = (hist_drivers["CapEx % oms"].mean()
                     - hist_drivers["D&A % oms"].mean()
                     - hist_drivers["NWC CF % oms"].mean())
    revenues = np.zeros((num_paths, years_to_project))
    fcff = np.zeros((num_paths, years_to_project))
    prev = np.full(num_paths, hist_data["Revenue"].iloc[-1])
    for t in range(years_to_project):
        g = np.random.normal(g_mean, g_std, num_paths)
        m = np.random.normal(m_mean, m_std, num_paths)
        revenues[:, t] = prev * (1 + g)
        fcff[:, t] = revenues[:, t] * m * (1 - tax_rate) - revenues[:, t] * net_reinv_pct
        prev = revenues[:, t]
    return revenues, fcff


def calculate_valuation(sim_fcff, total_cash, total_debt, shares_out, wacc, terminal_growth):
    years = sim_fcff.shape[1]
    discount = (1 + wacc) ** np.arange(1, years + 1)
    pv_fcff = np.sum(sim_fcff / discount, axis=1)
    tv = sim_fcff[:, -1] * (1 + terminal_growth) / (wacc - terminal_growth)
    pv_tv = tv / (1 + wacc) ** years
    equity = pv_fcff + pv_tv + total_cash - total_debt
    return np.maximum(equity / shares_out, 0)


# ============================================================
# PLOT
# ============================================================
def plot_valuation_with_scenarios(share_prices, ticker_symbol, info, shares, currency,
                                  scenarios=None, mc_label=""):
    plt.figure(figsize=(12, 7))
    current_price = _safe(info.get("currentPrice")) or _safe(info.get("regularMarketPrice"))
    if current_price is None:
        hist = yf.Ticker(ticker_symbol).history(period="1d")
        current_price = hist["Close"].iloc[-1] if not hist.empty else 0

    p1, p99 = np.percentile(share_prices, [1, 99])
    filtered = share_prices[(share_prices > p1) & (share_prices < p99)]
    plt.hist(filtered, bins=50, color="skyblue", edgecolor="black", alpha=0.5)

    mean_price = np.mean(share_prices)
    plt.axvline(mean_price, color="blue", linestyle="--", linewidth=2,
                label=f"MC medelvärde ({mc_label}): {mean_price:.2f}")
    if scenarios:
        colors = {"Bear": "red", "Base": "orange", "Bull": "green"}
        for name, price in scenarios.items():
            plt.axvline(price, color=colors.get(name, "black"), linewidth=2,
                        label=f"{name} case: {price:.2f}")
    if current_price:
        plt.axvline(current_price, color="black", linewidth=3,
                    label=f"Faktisk kurs: {current_price:.2f}")

    plt.title(f"Värderingsutfall och scenarier för {ticker_symbol}\n"
              f"Beräknat på {shares:,.0f} aktier")
    plt.xlabel(f"Värde per aktie ({currency})")
    plt.ylabel("Frekvens")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.6)
    plt.show()


# ============================================================
# HUVUDFLÖDE
# ============================================================
def sensitivity_matrix(dcf_kwargs, wacc_grid, g_grid):
    """Värde per aktie för varje kombination av WACC (rader) och evig tillväxt (kolumner)."""
    m = pd.DataFrame(index=[f"{w:.1%}" for w in wacc_grid],
                     columns=[f"{g:.1%}" for g in g_grid], dtype=float)
    m.index.name, m.columns.name = "WACC", "g"
    for w in wacc_grid:
        for g in g_grid:
            if w <= g + 0.005:  # TV-formeln spricker när WACC närmar sig g
                continue
            res = calculate_classic_dcf(wacc=w, terminal_growth=g, **dcf_kwargs)
            m.loc[f"{w:.1%}", f"{g:.1%}"] = res["share_price"]
    return m


def plot_sensitivity(matrices, ticker_symbol, current_price, currency, wacc, g):
    from matplotlib.colors import TwoSlopeNorm
    n = len(matrices)
    fig, axes = plt.subplots(1, n, figsize=(6 * n, 5.5), squeeze=False)
    all_vals = np.concatenate([m.values.ravel() for m in matrices.values()])
    all_vals = all_vals[np.isfinite(all_vals)]
    vmin, vmax = all_vals.min(), all_vals.max()
    # Färgskala centrerad på dagens kurs: grönt = över kurs, rött = under
    if current_price and vmin < current_price < vmax:
        norm = TwoSlopeNorm(vmin=vmin, vcenter=current_price, vmax=vmax)
    else:
        norm = None
    for ax, (name, m) in zip(axes[0], matrices.items()):
        im = ax.imshow(m.values.astype(float), cmap="RdYlGn", norm=norm,
                       vmin=None if norm else vmin, vmax=None if norm else vmax)
        ax.set_xticks(range(len(m.columns)), m.columns)
        ax.set_yticks(range(len(m.index)), m.index)
        ax.set_xlabel("Evig tillväxt (g)")
        ax.set_ylabel("WACC")
        ax.set_title(f"{name} case")
        for i, w_lbl in enumerate(m.index):
            for j, g_lbl in enumerate(m.columns):
                v = m.iloc[i, j]
                txt = "–" if not np.isfinite(v) else f"{v:.0f}"
                bold = (w_lbl == f"{wacc:.1%}" and g_lbl == f"{g:.1%}")
                ax.text(j, i, txt, ha="center", va="center", fontsize=9,
                        fontweight="bold" if bold else "normal")
    cbar = fig.colorbar(im, ax=axes[0].tolist(), shrink=0.8)
    cbar.set_label(f"Värde per aktie ({currency})")
    sub = f" – kurs idag {current_price:.2f}" if current_price else ""
    fig.suptitle(f"Känslighet WACC × evig tillväxt, {ticker_symbol}{sub}\n"
                 f"(fetstil = valt antagande: WACC {wacc:.1%}, g {g:.1%})")
    plt.show()


def run_valuation(ticker_symbol, scenarios, wacc, term_growth,
                  wacc_grid, g_grid, mc_scenario="Base", num_paths=10000):
    print(f"Hämtar data för {ticker_symbol}...")
    hist_data = fetch_financial_data(ticker_symbol)
    if hist_data is None:
        return
    hist_drivers = calculate_historical_drivers(hist_data)

    info = yf.Ticker(ticker_symbol).info
    cash = info.get("totalCash") or 0
    debt = info.get("totalDebt") or 0
    fin_ccy, quote_ccy = info.get("financialCurrency"), info.get("currency")
    currency = fin_ccy or quote_ccy or ""
    if fin_ccy and quote_ccy and fin_ccy != quote_ccy:
        print(f"⚠ Rapportvaluta ({fin_ccy}) skiljer sig från handelsvaluta ({quote_ccy}). "
              f"Värdet per aktie är i {fin_ccy} och måste valutaomräknas.")
    current_price = _safe(info.get("currentPrice")) or _safe(info.get("regularMarketPrice"))

    shares, _ = resolve_share_count(ticker_symbol, info)
    tax, _ = resolve_tax_rate(hist_data, info)

    print("\n--- HISTORIK ---")
    hist_show = hist_drivers.copy()
    hist_show.index = [d.year for d in hist_show.index]
    _print_table(hist_show, pct_cols=tuple(hist_show.columns))

    curr_rev = hist_data["Revenue"].iloc[-1]
    da_p = hist_drivers["D&A % oms"].mean()
    nwc_p = hist_drivers["NWC CF % oms"].mean()
    print(f"\nStartomsättning: {curr_rev/1e9:,.1f} mdr {currency} "
          f"(räkenskapsår {hist_data.index[-1].year})")
    print(f"Gemensamma antaganden: WACC {wacc:.1%}, evig tillväxt {term_growth:.1%}, "
          f"skatt {tax:.1%}, D&A {da_p:.1%} av oms, NWC-kassaflöde {nwc_p:+.1%} av oms")

    prices, matrices = {}, {}
    for name, s in scenarios.items():
        dcf_kwargs = dict(
            current_revenue=curr_rev, rev_growth=s["growth"], ebit_margin=s["margin"],
            tax_rate=tax, da_pct=da_p, capex_pct=s["capex"], nwc_cf_pct=nwc_p,
            total_cash=cash, total_debt=debt, shares_out=shares)
        res = calculate_classic_dcf(wacc=wacc, terminal_growth=term_growth, **dcf_kwargs)
        print_scenario(name, res, currency)
        prices[name] = res["share_price"]

        matrices[name] = sensitivity_matrix(dcf_kwargs, wacc_grid, g_grid)
        print(f"\n  Känslighet {name} (värde per aktie, {currency}):")
        print(matrices[name].map(lambda v: "–" if pd.isna(v) else f"{v:,.0f}")
              .to_string().replace("\n", "\n  "))

    print(f"\nKör Monte Carlo-simulering ({num_paths:,} banor, "
          f"WACC {wacc:.1%}, g {term_growth:.1%})...")
    _, sim_fcff = simulate_fcff(hist_data, hist_drivers, 5, num_paths)
    mc_prices = calculate_valuation(sim_fcff, cash, debt, shares, wacc, term_growth)

    plot_valuation_with_scenarios(mc_prices, ticker_symbol, info, shares, currency,
                                  scenarios=prices, mc_label="historiska drivare")
    plot_sensitivity(matrices, ticker_symbol, current_price, currency, wacc, term_growth)


# ============================================================
# GEMENSAMMA DISKONTERINGSANTAGANDEN
# ------------------------------------------------------------
# WACC och evig tillväxt speglar risk och långsiktig ekonomi, inte
# hur optimistiskt scenariot är – därför samma för alla scenarier.
# Effekten av andra värden syns i känslighetsmatrisen.
# ============================================================
WACC = 0.075
TERM_GROWTH = 0.02
WACC_GRID = [0.065, 0.070, 0.075, 0.080, 0.085, 0.090]
G_GRID = [0.010, 0.015, 0.020, 0.025, 0.030]

# ============================================================
# SCENARIER (år 1 = räkenskapsåret efter senaste rapport, dvs. 2026)
# Illustrativa siffror förankrade i Novos guidning för 2026.
# ============================================================
scenarios = {
    # Fortsatt prispress, Lilly tar andelar, fler patentutgångar
    "Bear": dict(growth=[-0.06, -0.03, 0.01, 0.02, 0.02],
                 margin=[0.40, 0.38, 0.36, 0.35, 0.34],
                 capex=[0.17, 0.14, 0.10, 0.08, 0.07]),
    # 2026 enligt guidning, sedan måttlig volymdriven återhämtning
    "Base": dict(growth=[-0.03, 0.04, 0.06, 0.05, 0.04],
                 margin=[0.42, 0.42, 0.42, 0.41, 0.40],
                 capex=[0.17, 0.14, 0.11, 0.09, 0.08]),
    # Pillret tar stora volymer, nya indikationer, priserna stabiliseras
    "Bull": dict(growth=[0.00, 0.10, 0.12, 0.10, 0.07],
                 margin=[0.43, 0.44, 0.45, 0.45, 0.45],
                 capex=[0.17, 0.13, 0.10, 0.08, 0.07]),
}

if __name__ == "__main__":
    run_valuation("NOVO-B.CO", scenarios, wacc=WACC, term_growth=TERM_GROWTH,
                  wacc_grid=WACC_GRID, g_grid=G_GRID)