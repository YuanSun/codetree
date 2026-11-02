/* Wires the calculators on tools.html to FAA (calc.js). */
(function () {
  "use strict";
  const C = window.FAA;
  const $ = (id) => document.getElementById(id);
  const num = (id) => parseFloat($(id).value) || 0;
  const fmt = (x, dp = 2) => (x == null || !isFinite(x)) ? "n/a" : x.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const rows = (pairs) => pairs.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join("");
  const bind = (ids, fn) => { ids.forEach((i) => $(i).addEventListener("input", fn)); fn(); };
  const lines = (id) => $(id).value.split("\n").map((l) => l.split(",").map((s) => s.trim())).filter((p) => p.length >= 2 && p[0]);

  bind(["nav-a", "nav-l", "nav-s"], () => {
    const r = C.nav({ assets: num("nav-a"), liabilities: num("nav-l"), shares: num("nav-s") });
    $("nav-out").innerHTML = rows([["Net asset value", fmt(r.nav)], ["NAV per share", fmt(r.navPerShare, 4)]]);
  });

  bind(["ac-par", "ac-rate", "ac-conv", "ac-freq", "ac-last", "ac-settle", "ac-next"], () => {
    try {
      const r = C.accruedInterest({ par: num("ac-par"), rate: num("ac-rate") / 100, convention: $("ac-conv").value,
        lastCoupon: $("ac-last").value, settle: $("ac-settle").value, nextCoupon: $("ac-next").value, freq: num("ac-freq") });
      $("ac-out").innerHTML = rows([["Days accrued", r.days], ["Fraction of year", fmt(r.fraction, 6)], ["Accrued interest", fmt(r.accrued)]]);
    } catch (e) { $("ac-out").textContent = e.message; }
  });

  bind(["pf-open", "pf-close", "pf-hwm", "pf-rate", "pf-hurdle", "pf-hard"], () => {
    const r = C.performanceFee({ openingNav: num("pf-open"), closingPreFee: num("pf-close"), hwm: num("pf-hwm"),
      rate: num("pf-rate") / 100, hurdle: num("pf-hurdle") / 100, hardHurdle: $("pf-hard").value === "1" });
    $("pf-out").innerHTML = rows([["Chargeable profit", fmt(r.chargeable)], ["Performance fee", fmt(r.fee)],
      ["Closing NAV after fee", fmt(r.closing)], ["New high-water mark", fmt(r.newHwm)]]);
  });
  bind(["mf-nav", "mf-rate", "mf-days", "mf-basis"], () => {
    const f = C.managementFee({ nav: num("mf-nav"), annualRate: num("mf-rate") / 100, days: num("mf-days"), basis: num("mf-basis") });
    $("mf-out").innerHTML = rows([["Management fee for the period", fmt(f)]]);
  });

  bind(["wf-c", "wf-d", "wf-p", "wf-y", "wf-k", "wf-u"], () => {
    const w = C.waterfall({ contributed: num("wf-c"), distributed: num("wf-d"), prefRate: num("wf-p") / 100,
      years: num("wf-y"), carry: num("wf-k") / 100, catchup: num("wf-u") / 100 });
    const profit = num("wf-d") - num("wf-c");
    $("wf-out").innerHTML = rows([["1 Return of capital (LP)", fmt(w.roc)], ["2 Preferred return (LP)", fmt(w.pref)],
      ["3 Catch-up tier (total)", fmt(w.catchupTotal)], ["4 Residual split (total)", fmt(w.split)],
      ["GP carried interest", fmt(w.gp) + (profit > 0 ? ` (${fmt(w.gp / profit * 100, 1)}% of profit)` : "")], ["LP total", fmt(w.lp)]]);
  });

  bind(["rt-flows", "rt-nav"], () => {
    const fl = lines("rt-flows").map((p) => ({ date: p[0], amount: parseFloat(p[1]) })).filter((f) => f.date && isFinite(f.amount));
    if (fl.length < 2) { $("rt-out").textContent = "Enter at least two cash flows."; return; }
    const paid = -fl.filter((f) => f.amount < 0).reduce((s, f) => s + f.amount, 0);
    const dist = fl.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0);
    const nav = num("rt-nav");
    const withNav = nav ? fl.concat([{ date: fl[fl.length - 1].date, amount: nav }]) : fl;
    const irr = C.xirr(withNav);
    $("rt-out").innerHTML = rows([["Paid-in", fmt(paid)], ["Distributions", fmt(dist)], ["DPI", fmt(C.dpi(dist, paid), 3) + "x"],
      ["RVPI", fmt(nav / paid, 3) + "x"], ["TVPI / MOIC", fmt(C.tvpi(dist, nav, paid), 3) + "x"], ["IRR (XIRR)", irr == null ? "n/a" : fmt(irr * 100, 2) + "%"]]);
  });

  bind(["al-pnl", "al-inv"], () => {
    const accts = lines("al-inv").map((p) => ({ name: p[0], capital: parseFloat(p[1]) })).filter((a) => a.capital > 0);
    if (!accts.length) { $("al-out").textContent = "Add investors."; return; }
    $("al-out").innerHTML = rows(C.allocate(num("al-pnl"), accts).map((a) => [`${a.name} (${fmt(a.share * 100, 2)}%)`, fmt(a.pnl)]));
  });

  /* ----- journal entry trainer ----- */
  const S = [
    { t: "Buy 1,000 shares at $50 on trade date; commission $25. Settles T+1.", e: [{ account: "Investments at cost", dr: 50025 }, { account: "Payable for investments purchased", cr: 50025 }] },
    { t: "Settlement of the purchase above: cash leaves the fund.", e: [{ account: "Payable for investments purchased", dr: 50025 }, { account: "Cash", cr: 50025 }] },
    { t: "Sell shares with cost $40,000 for net proceeds $46,000 on trade date (no unrealized recorded earlier).", e: [{ account: "Receivable for investments sold", dr: 46000 }, { account: "Investments at cost", cr: 40000 }, { account: "Realized gain", cr: 6000 }] },
    { t: "Daily bond coupon accrual: $100,000 par, 5%, 1 day on 30/360 (round to the cent).", e: [{ account: "Interest receivable", dr: 13.89 }, { account: "Interest income", cr: 13.89 }] },
    { t: "Accrue management fee for the day: $1,000,000 NAV x 2% / 365 (round to the cent).", e: [{ account: "Management fee expense", dr: 54.79 }, { account: "Accrued management fee", cr: 54.79 }] },
    { t: "Ex-date for a $0.50 dividend on 10,000 shares held long.", e: [{ account: "Dividends receivable", dr: 5000 }, { account: "Dividend income", cr: 5000 }] },
    { t: "Investment held at cost $100,000 is marked up to fair value $108,000.", e: [{ account: "Unrealized appreciation on investments", dr: 8000 }, { account: "Net change in unrealized gain", cr: 8000 }] },
    { t: "Investor redeems $250,000 on the dealing day; cash is paid next week.", e: [{ account: "Investor capital", dr: 250000 }, { account: "Redemptions payable", cr: 250000 }] }
  ];
  const ACCTS = [...new Set(S.flatMap((s) => s.e.map((l) => l.account)))].sort();
  const pick = $("je-pick"), tb = $("je-rows"), msg = $("je-msg");
  S.forEach((s, i) => pick.append(new Option(`${i + 1}. ${s.t.slice(0, 60)}${s.t.length > 60 ? "…" : ""}`, i)));
  function drawRows() {
    $("je-text").textContent = S[pick.value].t;
    msg.textContent = "";
    tb.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><select>${'<option value="">(choose)</option>' + ACCTS.map((a) => `<option>${a}</option>`).join("")}</select></td>
        <td><input type="number" step="0.01"></td><td><input type="number" step="0.01"></td>`;
      tb.append(tr);
    }
  }
  function read() {
    return [...tb.rows].map((r) => ({ account: r.cells[0].firstChild.value, dr: parseFloat(r.cells[1].firstChild.value) || 0, cr: parseFloat(r.cells[2].firstChild.value) || 0 }))
      .filter((l) => l.account && (l.dr || l.cr));
  }
  pick.onchange = drawRows;
  $("je-check").onclick = () => {
    const given = read();
    if (!given.length) { msg.innerHTML = '<span class="bad-text">Enter some lines first.</span>'; return; }
    if (!C.entryBalances(given)) msg.innerHTML = '<span class="bad-text">Debits do not equal credits.</span>';
    else if (C.sameEntry(S[pick.value].e, given)) msg.innerHTML = '<span class="ok-text">Correct.</span>';
    else msg.innerHTML = '<span class="bad-text">It balances, but accounts or amounts differ from the expected entry. Re-read the scenario.</span>';
  };
  $("je-show").onclick = () => {
    msg.innerHTML = S[pick.value].e.map((l) => `${l.dr ? "Dr" : "Cr"} ${l.account} ${fmt(l.dr || l.cr)}`).join(" &nbsp;/&nbsp; ");
  };
  drawRows();
})();
